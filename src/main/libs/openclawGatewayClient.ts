import { app } from 'electron';
import { EventEmitter } from 'events';
import type {
  OpenClawEngineManager,
  OpenClawGatewayConnectionInfo,
} from './openclawEngineManager';

type GatewayClientLike = {
  start: () => void;
  stop: () => void;
  request: <T = Record<string, unknown>>(
    method: string,
    params?: unknown,
    opts?: { expectFinal?: boolean },
  ) => Promise<T>;
};

type GatewayClientCtor = new (options: Record<string, unknown>) => GatewayClientLike;

const GATEWAY_READY_TIMEOUT_MS = 15_000;

const waitWithTimeout = async <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  let timeoutId: NodeJS.Timeout | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timeoutId = setTimeout(() => reject(new Error('OpenClaw gateway handshake timed out.')), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

export class OpenClawGatewayClientManager extends EventEmitter {
  private readonly engineManager: OpenClawEngineManager;
  private gatewayClient: GatewayClientLike | null = null;
  private gatewayClientVersion: string | null = null;
  private gatewayClientEntryPath: string | null = null;
  private gatewayReadyPromise: Promise<void> | null = null;
  private gatewayClientInitLock: Promise<void> | null = null;
  private gatewayStoppingIntentionally = false;

  constructor(engineManager: OpenClawEngineManager) {
    super();
    this.engineManager = engineManager;
  }

  async ensureReady(): Promise<void> {
    if (this.gatewayClientInitLock) {
      await this.gatewayClientInitLock;
      return;
    }

    this.gatewayClientInitLock = this.ensureReadyImpl().finally(() => {
      this.gatewayClientInitLock = null;
    });
    await this.gatewayClientInitLock;
  }

  async request<T = Record<string, unknown>>(
    method: string,
    params?: unknown,
    opts?: { expectFinal?: boolean },
  ): Promise<T> {
    await this.ensureReady();
    if (!this.gatewayClient) {
      throw new Error('OpenClaw gateway client is unavailable.');
    }
    return this.gatewayClient.request<T>(method, params, opts);
  }

  dispose(): void {
    this.stopGatewayClient();
  }

  private async ensureReadyImpl(): Promise<void> {
    const engineStatus = await this.engineManager.startGateway();
    if (engineStatus.phase !== 'running') {
      throw new Error(engineStatus.message || 'OpenClaw gateway is not running.');
    }

    const connection = this.engineManager.getGatewayConnectionInfo();
    const missing: string[] = [];
    if (!connection.url) missing.push('url');
    if (!connection.token) missing.push('token');
    if (!connection.version) missing.push('version');
    if (!connection.clientEntryPath) missing.push('clientEntryPath');
    if (missing.length > 0) {
      throw new Error(`OpenClaw gateway connection info is incomplete (missing: ${missing.join(', ')})`);
    }

    const needsNewClient = !this.gatewayClient
      || this.gatewayClientVersion !== connection.version
      || this.gatewayClientEntryPath !== connection.clientEntryPath;

    if (!needsNewClient && this.gatewayReadyPromise) {
      await waitWithTimeout(this.gatewayReadyPromise, GATEWAY_READY_TIMEOUT_MS);
      return;
    }

    this.stopGatewayClient();
    await this.createGatewayClient(connection as Required<OpenClawGatewayConnectionInfo>);
    if (this.gatewayReadyPromise) {
      await waitWithTimeout(this.gatewayReadyPromise, GATEWAY_READY_TIMEOUT_MS);
    }
  }

  private async createGatewayClient(connection: Required<OpenClawGatewayConnectionInfo>): Promise<void> {
    const GatewayClient = await this.loadGatewayClientCtor(connection.clientEntryPath);

    let resolveReady: (() => void) | null = null;
    let rejectReady: ((error: Error) => void) | null = null;
    let settled = false;

    this.gatewayReadyPromise = new Promise<void>((resolve, reject) => {
      resolveReady = resolve;
      rejectReady = reject;
    });

    const settleResolve = () => {
      if (settled) return;
      settled = true;
      resolveReady?.();
    };

    const settleReject = (error: Error) => {
      if (settled) return;
      settled = true;
      rejectReady?.(error);
    };

    const client = new GatewayClient({
      url: connection.url,
      token: connection.token,
      clientDisplayName: 'LemonClaw',
      clientVersion: app.getVersion(),
      mode: 'backend',
      caps: [],
      role: 'operator',
      scopes: ['operator.admin'],
      onHelloOk: () => settleResolve(),
      onConnectError: (error: Error) => settleReject(error),
      onClose: (_code: number, reason: string) => {
        if (!settled) {
          settleReject(new Error(reason || 'OpenClaw gateway disconnected before handshake'));
        }
        if (this.gatewayStoppingIntentionally) {
          return;
        }
        this.gatewayClient = null;
        this.gatewayClientVersion = null;
        this.gatewayClientEntryPath = null;
        this.gatewayReadyPromise = null;
      },
      onEvent: (event: unknown) => {
        this.emit('event', event);
      },
    });

    client.start();
    this.gatewayClient = client;
    this.gatewayClientVersion = connection.version;
    this.gatewayClientEntryPath = connection.clientEntryPath;
  }

  private stopGatewayClient(): void {
    if (!this.gatewayClient) {
      this.gatewayReadyPromise = null;
      return;
    }

    this.gatewayStoppingIntentionally = true;
    try {
      this.gatewayClient.stop();
    } catch {
      // Ignore shutdown errors.
    } finally {
      this.gatewayStoppingIntentionally = false;
      this.gatewayClient = null;
      this.gatewayClientVersion = null;
      this.gatewayClientEntryPath = null;
      this.gatewayReadyPromise = null;
    }
  }

  private async loadGatewayClientCtor(clientEntryPath: string): Promise<GatewayClientCtor> {
    const loaded = require(clientEntryPath) as Record<string, unknown>;
    const direct = loaded.GatewayClient;
    if (typeof direct === 'function') {
      return direct as GatewayClientCtor;
    }

    for (const candidate of Object.values(loaded)) {
      if (typeof candidate !== 'function') continue;
      const maybeCtor = candidate as {
        name?: string;
        prototype?: {
          start?: unknown;
          stop?: unknown;
          request?: unknown;
        };
      };
      if (maybeCtor.name === 'GatewayClient') {
        return candidate as GatewayClientCtor;
      }
      const proto = maybeCtor.prototype;
      if (
        proto
        && typeof proto.start === 'function'
        && typeof proto.stop === 'function'
        && typeof proto.request === 'function'
      ) {
        return candidate as GatewayClientCtor;
      }
    }

    throw new Error(`Invalid OpenClaw gateway client module: ${clientEntryPath}`);
  }
}
