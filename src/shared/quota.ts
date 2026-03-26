export type ClawQuotaApiCode =
  | 'OK'
  | 'UNAUTHORIZED'
  | 'AUTH_INVALID'
  | 'AUTH_MISSING_TOKEN'
  | 'AUTH_INVALID_TOKEN'
  | 'AUTH_USER_INACTIVE'
  | 'FORBIDDEN_RESOURCE_SCOPE_REQUIRED'
  | 'MODEL_DISABLED'
  | 'MODEL_NOT_FOUND'
  | 'QUOTA_NOT_ENOUGH'
  | 'QUOTA_EXHAUSTED'
  | 'RESERVATION_NOT_FOUND'
  | 'RESERVATION_CLOSED'
  | 'IDEMPOTENCY_CONFLICT'
  | 'INVALID_PARAMS';

export type ClawSessionEntry = 'cowork_start' | 'cowork_continue';

export type ClawHeartbeatStatus = 'running' | 'paused' | 'waiting_user';

export type ClawFinishReason =
  | 'completed'
  | 'stopped_by_user'
  | 'error'
  | 'quota_exhausted'
  | 'auth_invalid'
  | 'network_lost';

export type ClawManagedModelSource = 'tenant' | 'local';

export interface ClawQuotaEnvelope<T> {
  code: ClawQuotaApiCode | string;
  normalizedCode?: ClawQuotaApiCode | string;
  error?: string;
  message?: string;
  data?: T;
}

export interface ClawModelUsageMeta {
  billingTier?: string;
  billingTierName?: string;
  creditPerMinute?: number | null;
  maxSessionSeconds?: number | null;
  toolPolicy?: string | null;
  estimatedRemainingMinutes?: number | null;
  isUnlimited?: boolean;
}

export interface ClawModelItem {
  provider: string;
  model: string;
  displayName: string;
  enabled: boolean;
  usageMeta?: ClawModelUsageMeta;
}

export interface ClawProviderModels {
  provider: string;
  models: ClawModelItem[];
}

export interface ClawModelsSnapshot {
  providers: ClawProviderModels[];
  updatedAt?: string;
}

export interface ClawQuotaSnapshot {
  userId?: string;
  isUnlimited: boolean;
  creditBalance: number | null;
  remainingClawSeconds: number | null;
  pricingVersion?: string | null;
  expiresAt?: string | null;
  updatedAt?: string | null;
}

export interface ClawUsageSummary {
  range: string;
  consumedCredits: number;
  usedClawSeconds: number;
  sessions: number;
}

export interface ClawSessionReservation {
  reservationId: string;
  clientSessionId: string;
  provider: string;
  model: string;
  billingTier?: string;
  billingTierName?: string;
  creditPerMinute?: number | null;
  maxSessionSeconds?: number | null;
  toolPolicy?: string | null;
  grantedSeconds?: number | null;
  creditBalance?: number | null;
  remainingClawSeconds?: number | null;
  pricingVersion?: string | null;
  isUnlimited?: boolean;
  serverAcceptedTotalActiveSeconds: number;
  localTotalActiveSeconds?: number;
  shouldStop?: boolean;
  closed?: boolean;
  finalConsumedCredits?: number | null;
  finalActiveSeconds?: number | null;
  finishReason?: ClawFinishReason;
  lastErrorCode?: string | null;
  lastSyncedAt?: number;
  heartbeatStatus?: ClawHeartbeatStatus;
}

export interface ClawQuotaOverview {
  models: ClawModelsSnapshot | null;
  quota: ClawQuotaSnapshot | null;
  usageSummary: ClawUsageSummary | null;
}

export interface ClawPrepareSuccessData {
  allowed: true;
  reservationId: string;
  clientSessionId: string;
  provider: string;
  model: string;
  billingTier?: string;
  billingTierName?: string;
  creditPerMinute?: number | null;
  maxSessionSeconds?: number | null;
  toolPolicy?: string | null;
  grantedSeconds?: number | null;
  creditBalance?: number | null;
  remainingClawSeconds?: number | null;
  pricingVersion?: string | null;
  isUnlimited?: boolean;
}

export interface ClawPrepareFailureData {
  allowed?: false;
  provider?: string;
  model?: string;
  creditBalance?: number | null;
  remainingClawSeconds?: number | null;
  isUnlimited?: boolean;
}

export interface ClawHeartbeatSuccessData {
  allowed: boolean;
  reservationId: string;
  serverAcceptedTotalActiveSeconds: number;
  creditBalance?: number | null;
  remainingClawSeconds?: number | null;
  shouldStop?: boolean;
  isUnlimited?: boolean;
}

export interface ClawFinishSuccessData {
  reservationId: string;
  provider: string;
  model: string;
  billingTier?: string;
  finalConsumedCredits?: number | null;
  finalActiveSeconds?: number | null;
  creditBalance?: number | null;
  remainingClawSeconds?: number | null;
  closed: boolean;
  isUnlimited?: boolean;
}

export interface ClawReservationStatusData {
  reservationId: string;
  status?: string;
  clientSessionId?: string;
  provider?: string;
  model?: string;
  serverAcceptedTotalActiveSeconds?: number;
  closed?: boolean;
}

export interface ClawQuotaStreamPayload {
  sessionId: string;
  reservation: ClawSessionReservation | null;
  overview?: Partial<ClawQuotaOverview>;
}
