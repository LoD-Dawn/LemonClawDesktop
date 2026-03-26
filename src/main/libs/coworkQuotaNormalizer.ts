import type {
  ClawModelItem,
  ClawModelsSnapshot,
  ClawProviderModels,
  ClawQuotaOverview,
  ClawQuotaSnapshot,
  ClawUsageSummary,
} from '../../shared/quota';

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

export const safeClone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export const mergeQuotaOverview = (
  current: ClawQuotaOverview,
  patch: Partial<ClawQuotaOverview>
): ClawQuotaOverview => ({
  models: patch.models !== undefined ? patch.models : current.models,
  quota: patch.quota !== undefined ? patch.quota : current.quota,
  usageSummary: patch.usageSummary !== undefined ? patch.usageSummary : current.usageSummary,
});

export const applyQuotaSnapshotPatch = (
  current: ClawQuotaSnapshot | null,
  input: {
    creditBalance?: number | null;
    remainingClawSeconds?: number | null;
    pricingVersion?: string | null;
    isUnlimited?: boolean;
  }
): ClawQuotaSnapshot | null => {
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
};

export const normalizeModelsSnapshot = (raw: unknown): ClawModelsSnapshot | null => {
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
};

export const normalizeQuotaSnapshot = (raw: unknown): ClawQuotaSnapshot | null => {
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
};

export const normalizeUsageSummary = (raw: unknown, fallbackRange: string): ClawUsageSummary | null => {
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
};
