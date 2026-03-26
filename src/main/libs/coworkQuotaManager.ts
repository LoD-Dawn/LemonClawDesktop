import { app } from 'electron';
import { EventEmitter } from 'events';
import crypto from 'crypto';
import type { SqliteStore } from '../sqliteStore';
import { ADMIN_API_BASE_URL } from '../../shared/appConstants';
import type {
  ClawFinishReason,
  ClawHeartbeatStatus,
  ClawModelItem,
  ClawModelsSnapshot,
  ClawPrepareFailureData,
  ClawPrepareSuccessData,
  ClawProviderModels,
  ClawQuotaEnvelope,
  ClawQuotaOverview,
  ClawQuotaSnapshot,
  ClawQuotaStreamPayload,
  ClawReservationStatusData,
  ClawSessionEntry,
  ClawSessionReservation,
  ClawUsageSummary,
  ClawHeartbeatSuccessData,
  ClawFinishSuccessData,
} from '../../shared/quota';

type EnsureAuthResult =
  | { ok: true; accessToken: string }
  | { ok: false; reason: 'no_token' | 'expired' | 'disabled' | 'scope_required' | 'network_error'; error: string };

type EnsureAuthFailure = Extract<EnsureAuthResult, { ok: false }>;

type PersistedReservation = ClawSessionReservation & {
  entry: ClawSessionEntry;
  heartbeatSeq: number;
  heartbeatStatus: ClawHeartbeatStatus;
  localTotalActiveSeconds: number;
  phaseStartedAtMs: number | null;
  workspacePath?: string | null;
};

type ApiResult<T> =
  | { ok: true; code: string; message: string; data: T }
  | { ok: false; code: string; message: string; data?: T };

const STORE_KEY = 'cowork_quota_state_v1';
const HEARTBEAT_INTERVAL_MS = 30_000;
const REQUEST_TIMEOUT_MS = 10_000;
const USAGE_SUMMARY_RANGE = '7d';

const isRecordObject = (value: unknown): value is Record<string, unknown> => (
  !!value && typeof value === 'object' && !Array.isArray(value)
);

const asNullableNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const asOptionalString = (value: unknown): string | undefined => {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
};

const asOptionalBoolean = (value: unknown): boolean | undefined => {
  return typeof value === 'boolean' ? value : undefined;
};

const safeClone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export class CoworkQuotaManager extends EventEmitter {
  private store: SqliteStore;
  private ensureAuth: () => Promise<EnsureAuthResult>;
  private reservations = new Map<string, PersistedReservation>();
  private overview: ClawQuotaOverview = {
    models: null,
    quota: null,
    usageSummary: null,
  };
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private heartbeatInFlight = new Set<string>();
  private finishInFlight = new Set<string>();
  private finishRetryTimers = new Map<string, NodeJS.Timeout>();
  private onShouldStop?: (sessionId: string, message: string) => void;

  constructor(options: {
    store: SqliteStore;
    ensureAuth: () => Promise<EnsureAuthResult>;
    onShouldStop?: (sessionId: string, message: string) => void;
  }) {
    super();
    this.store = options.store;
    this.ensureAuth = options.ensureAuth;
    this.onShouldStop = options.onShouldStop;
    this.hydrate();
    this.startHeartbeatLoop();
  }

  private hydrate(): void {
    const raw = this.store.get<Record<string, PersistedReservation>>(STORE_KEY) ?? {};
    Object.entries(raw).forEach(([sessionId, reservation]) => {
      if (!reservation || typeof reservation !== 'object') {
        return;
      }
      this.reservations.set(sessionId, {
        ...reservation,
        phaseStartedAtMs: null,
        heartbeatStatus: reservation.closed ? 'paused' : reservation.heartbeatStatus ?? 'paused',
        localTotalActiveSeconds: Math.max(
          Number(reservation.localTotalActiveSeconds || 0),
          Number(reservation.serverAcceptedTotalActiveSeconds || 0)
        ),
        heartbeatSeq: Number(reservation.heartbeatSeq || 0),
      });
    });
  }

  private persist(): void {
    const serialized: Record<string, PersistedReservation> = {};
    this.reservations.forEach((reservation, sessionId) => {
      serialized[sessionId] = {
        ...reservation,
        phaseStartedAtMs: null,
      };
    });
    this.store.set(STORE_KEY, serialized);
  }

  private startHeartbeatLoop(): void {
    if (this.heartbeatTimer) {
      return;
    }
    this.heartbeatTimer = setInterval(() => {
      void this.runHeartbeatTick();
    }, HEARTBEAT_INTERVAL_MS);
    this.heartbeatTimer.unref?.();
  }

  private async runHeartbeatTick(): Promise<void> {
    for (const [sessionId, reservation] of this.reservations.entries()) {
      if (reservation.closed || this.heartbeatInFlight.has(sessionId) || this.finishInFlight.has(sessionId)) {
        continue;
      }
      await this.syncHeartbeat(sessionId);
    }
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

  private async request<T>(input: {
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

  private normalizeQuotaPatch(input: {
    creditBalance?: number | null;
    remainingClawSeconds?: number | null;
    pricingVersion?: string | null;
    isUnlimited?: boolean;
  }): Partial<ClawQuotaOverview> | null {
    const quotaPatch = this.applyQuotaSnapshotFromReservation(input);
    if (!quotaPatch) {
      return null;
    }
    this.overview = {
      ...this.overview,
      quota: quotaPatch,
    };
    return { quota: quotaPatch };
  }

  private normalizeModelsSnapshot(raw: unknown): ClawModelsSnapshot | null {
    const source = isRecordObject(raw) && isRecordObject(raw.data) ? raw.data : raw;
    if (!isRecordObject(source) || !Array.isArray(source.providers)) {
      return null;
    }

    const providers: ClawProviderModels[] = source.providers
      .map((provider): ClawProviderModels | null => {
        if (!isRecordObject(provider)) {
          return null;
        }
        const providerName = asOptionalString(provider.provider);
        if (!providerName || !Array.isArray(provider.models)) {
          return null;
        }

        const models: ClawModelItem[] = provider.models
          .map((model): ClawModelItem | null => {
            if (!isRecordObject(model)) {
              return null;
            }
            const modelId = asOptionalString(model.model) ?? asOptionalString(model.id);
            const displayName = asOptionalString(model.displayName) ?? asOptionalString(model.name) ?? modelId;
            if (!modelId || !displayName) {
              return null;
            }
            const usageMeta = isRecordObject(model.usageMeta)
              ? {
                  billingTier: asOptionalString(model.usageMeta.billingTier),
                  billingTierName: asOptionalString(model.usageMeta.billingTierName),
                  creditPerMinute: asNullableNumber(model.usageMeta.creditPerMinute),
                  maxSessionSeconds: asNullableNumber(model.usageMeta.maxSessionSeconds),
                  toolPolicy: asOptionalString(model.usageMeta.toolPolicy) ?? null,
                  estimatedRemainingMinutes: asNullableNumber(model.usageMeta.estimatedRemainingMinutes),
                  isUnlimited: asOptionalBoolean(model.usageMeta.isUnlimited),
                }
              : undefined;

            return {
              provider: providerName,
              model: modelId,
              displayName,
              enabled: model.enabled !== false,
              ...(usageMeta ? { usageMeta } : {}),
            };
          })
          .filter((item): item is ClawModelItem => item !== null);

        return {
          provider: providerName,
          models,
        };
      })
      .filter((item): item is ClawProviderModels => item !== null);

    return {
      providers,
      updatedAt: asOptionalString(source.updatedAt),
    };
  }

  private normalizeQuotaSnapshot(raw: unknown): ClawQuotaSnapshot | null {
    const source = isRecordObject(raw) && isRecordObject(raw.data) ? raw.data : raw;
    if (!isRecordObject(source)) {
      return null;
    }

    return {
      userId: asOptionalString(source.userId),
      isUnlimited: source.isUnlimited === true,
      creditBalance: asNullableNumber(source.creditBalance),
      remainingClawSeconds: asNullableNumber(source.remainingClawSeconds),
      pricingVersion: asOptionalString(source.pricingVersion) ?? null,
      expiresAt: asOptionalString(source.expiresAt) ?? null,
      updatedAt: asOptionalString(source.updatedAt) ?? null,
    };
  }

  private normalizeUsageSummary(raw: unknown, fallbackRange: string): ClawUsageSummary | null {
    const source = isRecordObject(raw) && isRecordObject(raw.data) ? raw.data : raw;
    if (!isRecordObject(source)) {
      return null;
    }

    return {
      range: asOptionalString(source.range) ?? fallbackRange,
      consumedCredits: Math.max(0, Number(source.consumedCredits) || 0),
      usedClawSeconds: Math.max(0, Number(source.usedClawSeconds) || 0),
      sessions: Math.max(0, Number(source.sessions) || 0),
    };
  }

  private updateOverview(patch: Partial<ClawQuotaOverview>, sessionId?: string, reservation?: ClawSessionReservation | null): void {
    this.overview = {
      models: patch.models !== undefined ? patch.models : this.overview.models,
      quota: patch.quota !== undefined ? patch.quota : this.overview.quota,
      usageSummary: patch.usageSummary !== undefined ? patch.usageSummary : this.overview.usageSummary,
    };
    this.emitQuotaUpdate(sessionId ?? '', reservation ?? null, patch);
  }

  private emitQuotaUpdate(sessionId: string, reservation: ClawSessionReservation | null, overview?: Partial<ClawQuotaOverview>): void {
    const payload: ClawQuotaStreamPayload = {
      sessionId,
      reservation: reservation ? safeClone(reservation) : null,
      ...(overview ? { overview: safeClone(overview) } : {}),
    };
    this.emit('quotaUpdate', payload);
  }

  private clearFinishRetry(sessionId: string): void {
    const timer = this.finishRetryTimers.get(sessionId);
    if (timer) {
      clearTimeout(timer);
      this.finishRetryTimers.delete(sessionId);
    }
  }

  private scheduleFinishRetry(sessionId: string, reason: ClawFinishReason, lastErrorCode?: string | null): void {
    if (this.finishRetryTimers.has(sessionId)) {
      return;
    }
    const timer = setTimeout(() => {
      this.finishRetryTimers.delete(sessionId);
      void this.finishSession(sessionId, reason, lastErrorCode);
    }, 15_000);
    timer.unref?.();
    this.finishRetryTimers.set(sessionId, timer);
  }

  private mergeReservationBase(
    current: PersistedReservation | undefined,
    incoming: Partial<ClawSessionReservation>
  ): ClawSessionReservation {
    return {
      reservationId: incoming.reservationId ?? current?.reservationId ?? '',
      clientSessionId: incoming.clientSessionId ?? current?.clientSessionId ?? '',
      provider: incoming.provider ?? current?.provider ?? '',
      model: incoming.model ?? current?.model ?? '',
      billingTier: incoming.billingTier ?? current?.billingTier,
      billingTierName: incoming.billingTierName ?? current?.billingTierName,
      creditPerMinute: incoming.creditPerMinute ?? current?.creditPerMinute ?? null,
      maxSessionSeconds: incoming.maxSessionSeconds ?? current?.maxSessionSeconds ?? null,
      toolPolicy: incoming.toolPolicy ?? current?.toolPolicy ?? null,
      grantedSeconds: incoming.grantedSeconds ?? current?.grantedSeconds ?? null,
      creditBalance: incoming.creditBalance ?? current?.creditBalance ?? null,
      remainingClawSeconds: incoming.remainingClawSeconds ?? current?.remainingClawSeconds ?? null,
      pricingVersion: incoming.pricingVersion ?? current?.pricingVersion ?? null,
      isUnlimited: incoming.isUnlimited ?? current?.isUnlimited,
      serverAcceptedTotalActiveSeconds: Math.max(
        0,
        Number(incoming.serverAcceptedTotalActiveSeconds ?? current?.serverAcceptedTotalActiveSeconds ?? 0)
      ),
      localTotalActiveSeconds: Math.max(
        0,
        Number(incoming.localTotalActiveSeconds ?? current?.localTotalActiveSeconds ?? 0)
      ),
      shouldStop: incoming.shouldStop ?? current?.shouldStop,
      closed: incoming.closed ?? current?.closed,
      finalConsumedCredits: incoming.finalConsumedCredits ?? current?.finalConsumedCredits ?? null,
      finalActiveSeconds: incoming.finalActiveSeconds ?? current?.finalActiveSeconds ?? null,
      finishReason: incoming.finishReason ?? current?.finishReason,
      lastErrorCode: incoming.lastErrorCode ?? current?.lastErrorCode ?? null,
      lastSyncedAt: incoming.lastSyncedAt ?? current?.lastSyncedAt,
      heartbeatStatus: incoming.heartbeatStatus ?? current?.heartbeatStatus ?? 'paused',
    };
  }

  private setReservation(sessionId: string, next: PersistedReservation, overviewPatch?: Partial<ClawQuotaOverview>): void {
    this.reservations.set(sessionId, next);
    this.persist();
    this.emitQuotaUpdate(sessionId, next, overviewPatch);
  }

  private flushElapsedSeconds(reservation: PersistedReservation): void {
    if (reservation.closed || reservation.heartbeatStatus !== 'running' || !reservation.phaseStartedAtMs) {
      return;
    }
    const now = Date.now();
    const deltaSeconds = Math.max(0, Math.floor((now - reservation.phaseStartedAtMs) / 1000));
    if (deltaSeconds <= 0) {
      return;
    }
    reservation.localTotalActiveSeconds += deltaSeconds;
    reservation.phaseStartedAtMs += deltaSeconds * 1000;
  }

  private applyQuotaSnapshotFromReservation(input: {
    creditBalance?: number | null;
    remainingClawSeconds?: number | null;
    pricingVersion?: string | null;
    isUnlimited?: boolean;
  }): ClawQuotaSnapshot | null {
    const current = this.overview.quota;
    if (!current && input.creditBalance === undefined && input.remainingClawSeconds === undefined && input.isUnlimited === undefined) {
      return null;
    }

    return {
      userId: current?.userId,
      isUnlimited: input.isUnlimited ?? current?.isUnlimited ?? false,
      creditBalance: input.creditBalance ?? current?.creditBalance ?? null,
      remainingClawSeconds: input.remainingClawSeconds ?? current?.remainingClawSeconds ?? null,
      pricingVersion: input.pricingVersion ?? current?.pricingVersion ?? null,
      expiresAt: current?.expiresAt ?? null,
      updatedAt: new Date().toISOString(),
    };
  }

  async getOverview(range: string = USAGE_SUMMARY_RANGE): Promise<ClawQuotaOverview> {
    const [modelsResp, quotaResp, usageResp] = await Promise.all([
      this.request<unknown>({ path: '/me/models' }),
      this.request<unknown>({ path: '/me/quota' }),
      this.request<unknown>({ path: `/me/usage-summary?range=${encodeURIComponent(range)}` }),
    ]);

    const patch: Partial<ClawQuotaOverview> = {};
    if (modelsResp.ok) {
      patch.models = this.normalizeModelsSnapshot(modelsResp.data);
    }
    if (quotaResp.ok) {
      patch.quota = this.normalizeQuotaSnapshot(quotaResp.data);
    }
    if (usageResp.ok) {
      patch.usageSummary = this.normalizeUsageSummary(usageResp.data, range);
    }

    this.overview = {
      models: patch.models !== undefined ? patch.models : this.overview.models,
      quota: patch.quota !== undefined ? patch.quota : this.overview.quota,
      usageSummary: patch.usageSummary !== undefined ? patch.usageSummary : this.overview.usageSummary,
    };

    return safeClone(this.overview);
  }

  getSessionReservation(sessionId: string): ClawSessionReservation | null {
    const reservation = this.reservations.get(sessionId);
    return reservation ? safeClone(reservation) : null;
  }

  hasOpenReservation(sessionId: string): boolean {
    const reservation = this.reservations.get(sessionId);
    return !!reservation && reservation.closed !== true;
  }

  setSessionHeartbeatStatus(sessionId: string, status: ClawHeartbeatStatus): void {
    const reservation = this.reservations.get(sessionId);
    if (!reservation || reservation.closed) {
      return;
    }

    this.flushElapsedSeconds(reservation);
    reservation.heartbeatStatus = status;
    reservation.phaseStartedAtMs = status === 'running' ? Date.now() : null;
    reservation.lastSyncedAt = Date.now();
    this.setReservation(sessionId, reservation);
  }

  async prepareSession(input: {
    sessionId: string;
    provider: string;
    model: string;
    entry: ClawSessionEntry;
    workspacePath?: string;
    estimatedSeconds?: number;
    clientSessionId?: string;
  }): Promise<{ success: true; reservation: ClawSessionReservation } | { success: false; code: string; error: string; data?: ClawPrepareFailureData }> {
    const clientSessionId = input.clientSessionId?.trim() || `${input.sessionId}:${Date.now()}`;
    const response = await this.request<ClawPrepareSuccessData | ClawPrepareFailureData>({
      path: '/claw/sessions/prepare',
      method: 'POST',
      body: {
        clientSessionId,
        provider: input.provider,
        model: input.model,
        entry: input.entry,
        workspacePath: input.workspacePath?.trim() || undefined,
        estimatedSeconds: Math.max(60, Number(input.estimatedSeconds) || 900),
        idempotencyKey: `prepare_${clientSessionId}`,
      },
    });

    if (!response.ok || !response.data || (response.data as ClawPrepareSuccessData).allowed !== true) {
      const failed = response.data as ClawPrepareFailureData | undefined;
      const overviewPatch = this.normalizeQuotaPatch({
        creditBalance: failed?.creditBalance,
        remainingClawSeconds: failed?.remainingClawSeconds,
        isUnlimited: failed?.isUnlimited,
      });
      if (overviewPatch) {
        this.emitQuotaUpdate(input.sessionId, null, overviewPatch);
      }
      return {
        success: false,
        code: response.code,
        error: response.message || 'Failed to prepare quota reservation',
        data: failed,
      };
    }

    const prepared = response.data as ClawPrepareSuccessData;
    const reservation: PersistedReservation = {
      ...this.mergeReservationBase(undefined, {
        reservationId: prepared.reservationId,
        clientSessionId: prepared.clientSessionId,
        provider: prepared.provider,
        model: prepared.model,
        billingTier: prepared.billingTier,
        billingTierName: prepared.billingTierName,
        creditPerMinute: prepared.creditPerMinute ?? null,
        maxSessionSeconds: prepared.maxSessionSeconds ?? null,
        toolPolicy: prepared.toolPolicy ?? null,
        grantedSeconds: prepared.grantedSeconds ?? null,
        creditBalance: prepared.creditBalance ?? null,
        remainingClawSeconds: prepared.remainingClawSeconds ?? null,
        pricingVersion: prepared.pricingVersion ?? null,
        isUnlimited: prepared.isUnlimited,
        serverAcceptedTotalActiveSeconds: 0,
        localTotalActiveSeconds: 0,
        closed: false,
        heartbeatStatus: 'running',
        lastSyncedAt: Date.now(),
      }),
      entry: input.entry,
      heartbeatSeq: 0,
      heartbeatStatus: 'running',
      localTotalActiveSeconds: 0,
      phaseStartedAtMs: Date.now(),
      workspacePath: input.workspacePath?.trim() || null,
    };

    const overviewPatch = this.normalizeQuotaPatch({
      creditBalance: prepared.creditBalance ?? null,
      remainingClawSeconds: prepared.remainingClawSeconds ?? null,
      pricingVersion: prepared.pricingVersion ?? null,
      isUnlimited: prepared.isUnlimited,
    });
    this.setReservation(input.sessionId, reservation, overviewPatch ?? undefined);

    return {
      success: true,
      reservation: safeClone(reservation),
    };
  }

  async syncHeartbeat(sessionId: string): Promise<boolean> {
    const reservation = this.reservations.get(sessionId);
    if (!reservation || reservation.closed) {
      return true;
    }

    this.flushElapsedSeconds(reservation);
    this.heartbeatInFlight.add(sessionId);
    try {
      const response = await this.request<ClawHeartbeatSuccessData>({
        path: '/claw/sessions/heartbeat',
        method: 'POST',
        body: {
          reservationId: reservation.reservationId,
          clientSessionId: reservation.clientSessionId,
          activeSecondsDelta: Math.max(
            0,
            reservation.localTotalActiveSeconds - reservation.serverAcceptedTotalActiveSeconds
          ),
          totalActiveSeconds: reservation.localTotalActiveSeconds,
          status: reservation.heartbeatStatus,
          sentAt: new Date().toISOString(),
          idempotencyKey: `heartbeat_${reservation.reservationId}_${reservation.heartbeatSeq + 1}`,
        },
      });

      reservation.heartbeatSeq += 1;

      if (!response.ok || !response.data) {
        if (response.code === 'RESERVATION_CLOSED') {
          reservation.closed = true;
          reservation.phaseStartedAtMs = null;
          reservation.lastSyncedAt = Date.now();
          this.setReservation(sessionId, reservation);
          return true;
        }

        if (response.code === 'QUOTA_EXHAUSTED') {
          const data = response.data as ClawHeartbeatSuccessData | undefined;
          reservation.shouldStop = true;
          reservation.creditBalance = data?.creditBalance ?? 0;
          reservation.remainingClawSeconds = data?.remainingClawSeconds ?? 0;
          reservation.lastSyncedAt = Date.now();
          const overviewPatch = this.normalizeQuotaPatch({
            creditBalance: reservation.creditBalance,
            remainingClawSeconds: reservation.remainingClawSeconds,
            isUnlimited: data?.isUnlimited,
          });
          this.setReservation(sessionId, reservation, overviewPatch ?? undefined);
          this.onShouldStop?.(sessionId, response.message || '配额已用尽，请结束当前会话');
          return false;
        }

        return false;
      }

      const heartbeat = response.data;
      reservation.serverAcceptedTotalActiveSeconds = Math.max(0, Number(heartbeat.serverAcceptedTotalActiveSeconds) || 0);
      reservation.localTotalActiveSeconds = reservation.serverAcceptedTotalActiveSeconds;
      reservation.creditBalance = heartbeat.creditBalance ?? reservation.creditBalance ?? null;
      reservation.remainingClawSeconds = heartbeat.remainingClawSeconds ?? reservation.remainingClawSeconds ?? null;
      reservation.isUnlimited = heartbeat.isUnlimited ?? reservation.isUnlimited;
      reservation.shouldStop = heartbeat.shouldStop ?? false;
      reservation.lastSyncedAt = Date.now();
      reservation.phaseStartedAtMs = reservation.heartbeatStatus === 'running' ? Date.now() : null;

      const overviewPatch = this.normalizeQuotaPatch({
        creditBalance: heartbeat.creditBalance ?? reservation.creditBalance ?? null,
        remainingClawSeconds: heartbeat.remainingClawSeconds ?? reservation.remainingClawSeconds ?? null,
        isUnlimited: heartbeat.isUnlimited ?? reservation.isUnlimited,
      });
      this.setReservation(sessionId, reservation, overviewPatch ?? undefined);

      if (heartbeat.shouldStop) {
        this.onShouldStop?.(sessionId, response.message || '配额已用尽，请结束当前会话');
      }
      return !heartbeat.shouldStop;
    } finally {
      this.heartbeatInFlight.delete(sessionId);
    }
  }

  async finishSession(sessionId: string, reason: ClawFinishReason, lastErrorCode?: string | null): Promise<boolean> {
    const reservation = this.reservations.get(sessionId);
    if (!reservation) {
      return true;
    }
    if (reservation.closed) {
      this.clearFinishRetry(sessionId);
      this.emitQuotaUpdate(sessionId, reservation);
      return true;
    }
    if (this.finishInFlight.has(sessionId)) {
      return false;
    }

    this.flushElapsedSeconds(reservation);
    reservation.phaseStartedAtMs = null;
    reservation.heartbeatStatus = 'paused';
    reservation.lastErrorCode = lastErrorCode ?? reservation.lastErrorCode ?? null;

    this.finishInFlight.add(sessionId);
    try {
      const response = await this.request<ClawFinishSuccessData>({
        path: '/claw/sessions/finish',
        method: 'POST',
        body: {
          reservationId: reservation.reservationId,
          clientSessionId: reservation.clientSessionId,
          totalActiveSeconds: reservation.localTotalActiveSeconds,
          finishReason: reason,
          lastErrorCode: lastErrorCode ?? null,
          idempotencyKey: `finish_${reservation.reservationId}`,
        },
      });

      if (!response.ok && response.code !== 'RESERVATION_CLOSED') {
        reservation.finishReason = reason;
        reservation.lastSyncedAt = Date.now();
        this.setReservation(sessionId, reservation);
        this.scheduleFinishRetry(sessionId, reason, lastErrorCode);
        return false;
      }

      const finish = response.data as ClawFinishSuccessData | undefined;
      reservation.closed = true;
      reservation.finishReason = reason;
      reservation.phaseStartedAtMs = null;
      reservation.heartbeatStatus = 'paused';
      reservation.finalConsumedCredits = finish?.finalConsumedCredits ?? reservation.finalConsumedCredits ?? null;
      reservation.finalActiveSeconds = finish?.finalActiveSeconds ?? reservation.localTotalActiveSeconds;
      reservation.localTotalActiveSeconds = Math.max(0, Number(reservation.finalActiveSeconds ?? 0));
      reservation.serverAcceptedTotalActiveSeconds = reservation.localTotalActiveSeconds;
      reservation.creditBalance = finish?.creditBalance ?? reservation.creditBalance ?? null;
      reservation.remainingClawSeconds = finish?.remainingClawSeconds ?? reservation.remainingClawSeconds ?? null;
      reservation.isUnlimited = finish?.isUnlimited ?? reservation.isUnlimited;
      reservation.lastSyncedAt = Date.now();

      const overviewPatch = this.normalizeQuotaPatch({
        creditBalance: finish?.creditBalance ?? reservation.creditBalance ?? null,
        remainingClawSeconds: finish?.remainingClawSeconds ?? reservation.remainingClawSeconds ?? null,
        isUnlimited: finish?.isUnlimited ?? reservation.isUnlimited,
      });
      this.clearFinishRetry(sessionId);
      this.setReservation(sessionId, reservation, overviewPatch ?? undefined);
      return true;
    } finally {
      this.finishInFlight.delete(sessionId);
    }
  }

  async recoverOpenReservations(): Promise<void> {
    const entries = Array.from(this.reservations.entries()).filter(([, reservation]) => !reservation.closed);
    for (const [sessionId, reservation] of entries) {
      const response = await this.request<ClawReservationStatusData>({
        path: `/claw/sessions/${encodeURIComponent(reservation.reservationId)}`,
      });

      if (response.ok && response.data?.closed === true) {
        reservation.closed = true;
        reservation.serverAcceptedTotalActiveSeconds = Math.max(
          reservation.serverAcceptedTotalActiveSeconds,
          Number(response.data.serverAcceptedTotalActiveSeconds || 0)
        );
        reservation.localTotalActiveSeconds = reservation.serverAcceptedTotalActiveSeconds;
        reservation.phaseStartedAtMs = null;
        reservation.lastSyncedAt = Date.now();
        this.setReservation(sessionId, reservation);
        continue;
      }

      if (response.ok && response.data) {
        reservation.serverAcceptedTotalActiveSeconds = Math.max(
          reservation.serverAcceptedTotalActiveSeconds,
          Number(response.data.serverAcceptedTotalActiveSeconds || 0)
        );
        reservation.localTotalActiveSeconds = reservation.serverAcceptedTotalActiveSeconds;
      }

      await this.finishSession(sessionId, 'network_lost');
    }
  }

  async finishAllOpenReservations(reason: ClawFinishReason): Promise<void> {
    const sessionIds = Array.from(this.reservations.entries())
      .filter(([, reservation]) => !reservation.closed)
      .map(([sessionId]) => sessionId);
    for (const sessionId of sessionIds) {
      await this.finishSession(sessionId, reason);
    }
  }
}
