import { app } from 'electron';
import crypto from 'crypto';
import { ADMIN_API_BASE_URL } from '../../shared/appConstants';
import type {
  ClawFinishReason,
  ClawHeartbeatStatus,
  ClawHeartbeatSuccessData,
  ClawPrepareFailureData,
  ClawPrepareSuccessData,
  ClawQuotaEnvelope,
  ClawReservationStatusData,
  ClawSessionEntry,
  ClawFinishSuccessData,
} from '../../shared/quota';

export type EnsureAuthResult =
  | { ok: true; accessToken: string }
  | { ok: false; reason: 'no_token' | 'expired' | 'disabled' | 'scope_required' | 'network_error'; error: string };

type EnsureAuthFailure = Extract<EnsureAuthResult, { ok: false }>;

export type ApiResult<T> =
  | { ok: true; code: string; message: string; data: T }
  | { ok: false; code: string; message: string; data?: T };

const REQUEST_TIMEOUT_MS = 10_000;

export class CoworkQuotaApiClient {
  private ensureAuth: () => Promise<EnsureAuthResult>;

  constructor(options: { ensureAuth: () => Promise<EnsureAuthResult> }) {
    this.ensureAuth = options.ensureAuth;
  }

  private buildRequestHeaders(accessToken: string, requestId: string): Record<string, string> {
    return {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Client-Version': app.getVersion(),
      'X-Platform': `desktop-${process.platform}`,
      'X-Request-Id': requestId,
    };
  }

  async request<T>(input: {
    path: string;
    method?: 'GET' | 'POST';
    body?: Record<string, unknown>;
  }): Promise<ApiResult<T>> {
    const auth = await this.ensureAuth();
    if (!auth.ok) {
      const failedAuth = auth as EnsureAuthFailure;
      return {
        ok: false,
        code:
          failedAuth.reason === 'network_error'
            ? 'NETWORK_ERROR'
            : failedAuth.reason === 'scope_required'
              ? 'UNAUTHORIZED'
              : 'AUTH_INVALID',
        message: failedAuth.error,
      };
    }

    const requestId = crypto.randomUUID();
    const url = `${ADMIN_API_BASE_URL}/api/external/v1${input.path}`;

    try {
      const response = await fetch(url, {
        method: input.method ?? 'GET',
        headers: this.buildRequestHeaders(auth.accessToken, requestId),
        body: input.body ? JSON.stringify(input.body) : undefined,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      let payload: ClawQuotaEnvelope<T> | null = null;
      try {
        payload = await response.json() as ClawQuotaEnvelope<T>;
      } catch {
        payload = null;
      }

      const code = typeof payload?.normalizedCode === 'string'
        ? payload.normalizedCode
        : typeof payload?.code === 'string'
          ? payload.code
          : response.ok
            ? 'OK'
            : `HTTP_${response.status}`;
      const message = typeof payload?.message === 'string'
        ? payload.message
        : typeof payload?.error === 'string'
          ? payload.error
          : response.statusText || 'Request failed';
      const data = (payload?.data ?? payload) as T;

      if (!response.ok || code !== 'OK') {
        return { ok: false, code, message, data };
      }

      return { ok: true, code, message, data };
    } catch (error) {
      return {
        ok: false,
        code: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'Network request failed',
      };
    }
  }

  getModels(): Promise<ApiResult<unknown>> {
    return this.request<unknown>({ path: '/me/models' });
  }

  getQuota(): Promise<ApiResult<unknown>> {
    return this.request<unknown>({ path: '/me/quota' });
  }

  getUsageSummary(range: string): Promise<ApiResult<unknown>> {
    return this.request<unknown>({ path: `/me/usage-summary?range=${encodeURIComponent(range)}` });
  }

  prepareSession(input: {
    clientSessionId: string;
    provider: string;
    model: string;
    entry: ClawSessionEntry;
    workspacePath?: string;
    estimatedSeconds: number;
  }): Promise<ApiResult<ClawPrepareSuccessData | ClawPrepareFailureData>> {
    return this.request<ClawPrepareSuccessData | ClawPrepareFailureData>({
      path: '/claw/sessions/prepare',
      method: 'POST',
      body: {
        clientSessionId: input.clientSessionId,
        provider: input.provider,
        model: input.model,
        entry: input.entry,
        workspacePath: input.workspacePath?.trim() || undefined,
        estimatedSeconds: input.estimatedSeconds,
        idempotencyKey: `prepare_${input.clientSessionId}`,
      },
    });
  }

  heartbeat(input: {
    reservationId: string;
    clientSessionId: string;
    activeSecondsDelta: number;
    totalActiveSeconds: number;
    status: ClawHeartbeatStatus;
    heartbeatSeq: number;
  }): Promise<ApiResult<ClawHeartbeatSuccessData>> {
    return this.request<ClawHeartbeatSuccessData>({
      path: '/claw/sessions/heartbeat',
      method: 'POST',
      body: {
        reservationId: input.reservationId,
        clientSessionId: input.clientSessionId,
        activeSecondsDelta: input.activeSecondsDelta,
        totalActiveSeconds: input.totalActiveSeconds,
        status: input.status,
        sentAt: new Date().toISOString(),
        idempotencyKey: `heartbeat_${input.reservationId}_${input.heartbeatSeq + 1}`,
      },
    });
  }

  finishSession(input: {
    reservationId: string;
    clientSessionId: string;
    totalActiveSeconds: number;
    finishReason: ClawFinishReason;
    lastErrorCode?: string | null;
  }): Promise<ApiResult<ClawFinishSuccessData>> {
    return this.request<ClawFinishSuccessData>({
      path: '/claw/sessions/finish',
      method: 'POST',
      body: {
        reservationId: input.reservationId,
        clientSessionId: input.clientSessionId,
        totalActiveSeconds: input.totalActiveSeconds,
        finishReason: input.finishReason,
        lastErrorCode: input.lastErrorCode ?? null,
        idempotencyKey: `finish_${input.reservationId}`,
      },
    });
  }

  getReservationStatus(reservationId: string): Promise<ApiResult<ClawReservationStatusData>> {
    return this.request<ClawReservationStatusData>({
      path: `/claw/sessions/${encodeURIComponent(reservationId)}`,
    });
  }
}
