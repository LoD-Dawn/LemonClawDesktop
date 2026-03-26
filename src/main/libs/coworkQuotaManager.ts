import { EventEmitter } from 'events';
import type { SqliteStore } from '../sqliteStore';
import type {
  ClawFinishReason,
  ClawHeartbeatStatus,
  ClawPrepareFailureData,
  ClawPrepareSuccessData,
  ClawQuotaOverview,
  ClawQuotaStreamPayload,
  ClawReservationStatusData,
  ClawSessionEntry,
  ClawSessionReservation,
  ClawHeartbeatSuccessData,
  ClawFinishSuccessData,
} from '../../shared/quota';
import {
  CoworkQuotaApiClient,
  type EnsureAuthResult,
} from './coworkQuotaApiClient';
import {
  CoworkQuotaReservationStore,
  type PersistedReservation,
} from './coworkQuotaReservationStore';
import {
  applyQuotaSnapshotPatch,
  mergeQuotaOverview,
  normalizeModelsSnapshot,
  normalizeQuotaSnapshot,
  normalizeUsageSummary,
  safeClone,
} from './coworkQuotaNormalizer';

const HEARTBEAT_INTERVAL_MS = 30_000;
const USAGE_SUMMARY_RANGE = '7d';

export class CoworkQuotaManager extends EventEmitter {
  private apiClient: CoworkQuotaApiClient;
  private reservationStore: CoworkQuotaReservationStore;
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
    this.apiClient = new CoworkQuotaApiClient({
      ensureAuth: options.ensureAuth,
    });
    this.reservationStore = new CoworkQuotaReservationStore(options.store);
    this.onShouldStop = options.onShouldStop;
    this.reservations = this.reservationStore.hydrate();
    this.startHeartbeatLoop();
  }

  private persist(): void {
    this.reservationStore.persist(this.reservations);
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

  private normalizeQuotaPatch(input: {
    creditBalance?: number | null;
    remainingClawSeconds?: number | null;
    pricingVersion?: string | null;
    isUnlimited?: boolean;
  }): Partial<ClawQuotaOverview> | null {
    const quotaPatch = applyQuotaSnapshotPatch(this.overview.quota, input);
    if (!quotaPatch) {
      return null;
    }
    this.overview = mergeQuotaOverview(this.overview, { quota: quotaPatch });
    return { quota: quotaPatch };
  }

  private updateOverview(patch: Partial<ClawQuotaOverview>, sessionId?: string, reservation?: ClawSessionReservation | null): void {
    this.overview = mergeQuotaOverview(this.overview, patch);
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

  async getOverview(range: string = USAGE_SUMMARY_RANGE): Promise<ClawQuotaOverview> {
    const [modelsResp, quotaResp, usageResp] = await Promise.all([
      this.apiClient.getModels(),
      this.apiClient.getQuota(),
      this.apiClient.getUsageSummary(range),
    ]);

    const patch: Partial<ClawQuotaOverview> = {};
    if (modelsResp.ok) {
      patch.models = normalizeModelsSnapshot(modelsResp.data);
    }
    if (quotaResp.ok) {
      patch.quota = normalizeQuotaSnapshot(quotaResp.data);
    }
    if (usageResp.ok) {
      patch.usageSummary = normalizeUsageSummary(usageResp.data, range);
    }
    this.overview = mergeQuotaOverview(this.overview, patch);

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
    const response = await this.apiClient.prepareSession({
      clientSessionId,
      provider: input.provider,
      model: input.model,
      entry: input.entry,
      workspacePath: input.workspacePath,
      estimatedSeconds: Math.max(60, Number(input.estimatedSeconds) || 900),
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
      const response = await this.apiClient.heartbeat({
        reservationId: reservation.reservationId,
        clientSessionId: reservation.clientSessionId,
        activeSecondsDelta: Math.max(
          0,
          reservation.localTotalActiveSeconds - reservation.serverAcceptedTotalActiveSeconds
        ),
        totalActiveSeconds: reservation.localTotalActiveSeconds,
        status: reservation.heartbeatStatus,
        heartbeatSeq: reservation.heartbeatSeq,
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
      const response = await this.apiClient.finishSession({
        reservationId: reservation.reservationId,
        clientSessionId: reservation.clientSessionId,
        totalActiveSeconds: reservation.localTotalActiveSeconds,
        finishReason: reason,
        lastErrorCode,
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
      const response = await this.apiClient.getReservationStatus(reservation.reservationId);

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
