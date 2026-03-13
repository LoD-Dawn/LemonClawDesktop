import type { SqliteStore } from '../sqliteStore';
import type { ProviderConfig, UserPreferences } from '../../shared/modelConfig';
import { normalizeProviderApiFormat } from './coworkFormatTransform';

type LegacyAppConfig = {
  theme?: 'light' | 'dark' | 'system';
  language?: 'zh' | 'en';
  useSystemProxy?: boolean;
  shortcuts?: Record<string, string | undefined>;
  model?: {
    defaultModel?: string;
    defaultModelProvider?: string;
  };
  providers?: Record<string, {
    enabled?: boolean;
    apiKey?: string;
    baseUrl?: string;
    apiFormat?: 'anthropic' | 'openai' | 'native';
    codingPlanEnabled?: boolean;
    models?: Array<{
      id?: string;
      name?: string;
      supportsImage?: boolean;
    }>;
  }>;
};

const USER_PREFERENCES_KEY = 'user_preferences';
const LOCAL_PROVIDER_KEYS = new Set(['ollama', 'custom']);

function normalizeModels(models: LegacyAppConfig['providers'][string]['models']): ProviderConfig['models'] {
  return (models ?? [])
    .filter((model): model is NonNullable<typeof model> & { id: string } => typeof model?.id === 'string' && model.id.trim().length > 0)
    .map((model) => {
      const id = model.id.trim();
      return {
        id,
        name: typeof model.name === 'string' && model.name.trim().length > 0 ? model.name.trim() : id,
        supportsImage: model.supportsImage ?? false,
      };
    });
}

function normalizeLocalProviders(providers: LegacyAppConfig['providers']): UserPreferences['localProviders'] {
  if (!providers) {
    return undefined;
  }

  const entries = Object.entries(providers)
    .filter(([providerKey]) => LOCAL_PROVIDER_KEYS.has(providerKey))
    .map(([providerKey, providerConfig]) => [
      providerKey,
      {
        enabled: providerConfig.enabled ?? false,
        apiKey: providerConfig.apiKey ?? '',
        baseUrl: providerConfig.baseUrl?.trim().replace(/\/+$/, '') ?? '',
        apiFormat: normalizeProviderApiFormat(providerConfig.apiFormat),
        codingPlanEnabled: providerConfig.codingPlanEnabled ?? false,
        models: normalizeModels(providerConfig.models),
      } satisfies ProviderConfig,
    ] as const);

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function migrateFromLegacyAppConfig(store: SqliteStore): UserPreferences {
  const legacyConfig = store.get<LegacyAppConfig>('app_config') ?? {};
  const migrated: UserPreferences = {
    theme: legacyConfig.theme,
    language: legacyConfig.language,
    useSystemProxy: legacyConfig.useSystemProxy,
    shortcuts: legacyConfig.shortcuts,
    preferredProvider: legacyConfig.model?.defaultModelProvider,
    preferredModel: legacyConfig.model?.defaultModel,
    localProviders: normalizeLocalProviders(legacyConfig.providers),
  };

  store.set(USER_PREFERENCES_KEY, migrated);
  return migrated;
}

export function getUserPreferences(store: SqliteStore): UserPreferences {
  const stored = store.get<UserPreferences>(USER_PREFERENCES_KEY);
  if (stored) {
    return stored;
  }

  return migrateFromLegacyAppConfig(store);
}

export function updateUserPreferences(store: SqliteStore, patch: Partial<UserPreferences>): UserPreferences {
  const current = getUserPreferences(store);
  const next: UserPreferences = {
    ...current,
    ...patch,
    localProviders: patch.localProviders ?? current.localProviders,
    shortcuts: patch.shortcuts ?? current.shortcuts,
  };
  store.set(USER_PREFERENCES_KEY, next);
  return next;
}
