import type {
  ProviderConfig,
  ResolvedModelConfig,
  ResolvedModelItem,
  ResolvedProviderConfig,
  TenantConfig,
  TenantConfigMeta,
  UserPreferences,
} from '../../shared/modelConfig';
import { normalizeProviderApiFormat } from './coworkFormatTransform';

type LegacyAppConfig = {
  api?: {
    key?: string;
    baseUrl?: string;
  };
  model?: {
    availableModels?: Array<{
      id?: string;
      name?: string;
      supportsImage?: boolean;
    }>;
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

const LOCAL_PROVIDER_KEYS = new Set(['ollama', 'custom']);

function toProviderLabel(providerKey: string): string {
  return providerKey.charAt(0).toUpperCase() + providerKey.slice(1);
}

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

function normalizeLegacyProviders(providers: LegacyAppConfig['providers']): Record<string, ProviderConfig> {
  if (!providers) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(providers).map(([providerKey, providerConfig]) => [
      providerKey,
      {
        enabled: providerConfig.enabled ?? false,
        apiKey: providerConfig.apiKey ?? '',
        baseUrl: providerConfig.baseUrl?.trim().replace(/\/+$/, '') ?? '',
        apiFormat: normalizeProviderApiFormat(providerConfig.apiFormat),
        codingPlanEnabled: providerConfig.codingPlanEnabled ?? false,
        models: normalizeModels(providerConfig.models),
      } satisfies ProviderConfig,
    ])
  );
}

function buildAvailableModels(providers: Record<string, ResolvedProviderConfig>): ResolvedModelItem[] {
  const models: ResolvedModelItem[] = [];
  Object.entries(providers).forEach(([providerKey, providerConfig]) => {
    if (!providerConfig.enabled) {
      return;
    }
    providerConfig.models.forEach((model) => {
      models.push({
        id: model.id,
        name: model.name,
        providerKey,
        providerLabel: toProviderLabel(providerKey),
        source: providerConfig.source,
        supportsImage: model.supportsImage ?? false,
      });
    });
  });
  return models;
}

function pickSelection(
  availableModels: ResolvedModelItem[],
  tenantConfig: TenantConfig | null,
  legacyAppConfig: LegacyAppConfig | null,
  userPreferences: UserPreferences | null
): { selectedProvider?: string; selectedModel?: string } {
  const preferredProvider = userPreferences?.preferredProvider?.trim();
  const preferredModel = userPreferences?.preferredModel?.trim();

  if (preferredModel) {
    const matchedPreferred = availableModels.find((model) => (
      model.id === preferredModel
      && (!preferredProvider || model.providerKey === preferredProvider)
    ));
    if (matchedPreferred) {
      return {
        selectedProvider: matchedPreferred.providerKey,
        selectedModel: matchedPreferred.id,
      };
    }
  }

  const tenantDefaultProvider = tenantConfig?.defaults.provider?.trim();
  const tenantDefaultModel = tenantConfig?.defaults.model?.trim();
  if (tenantDefaultModel) {
    const matchedTenantDefault = availableModels.find((model) => (
      model.id === tenantDefaultModel
      && (!tenantDefaultProvider || model.providerKey === tenantDefaultProvider)
    ));
    if (matchedTenantDefault) {
      return {
        selectedProvider: matchedTenantDefault.providerKey,
        selectedModel: matchedTenantDefault.id,
      };
    }
  }

  const legacyDefaultProvider = legacyAppConfig?.model?.defaultModelProvider?.trim();
  const legacyDefaultModel = legacyAppConfig?.model?.defaultModel?.trim();
  if (legacyDefaultModel) {
    const matchedLegacyDefault = availableModels.find((model) => (
      model.id === legacyDefaultModel
      && (!legacyDefaultProvider || model.providerKey === legacyDefaultProvider)
    ));
    if (matchedLegacyDefault) {
      return {
        selectedProvider: matchedLegacyDefault.providerKey,
        selectedModel: matchedLegacyDefault.id,
      };
    }
  }

  return {
    selectedProvider: availableModels[0]?.providerKey,
    selectedModel: availableModels[0]?.id,
  };
}

export function resolveModelConfig(input: {
  tenantConfig: TenantConfig | null;
  tenantMeta: TenantConfigMeta | null;
  userPreferences: UserPreferences | null;
  legacyAppConfig: LegacyAppConfig | null;
}): ResolvedModelConfig {
  const { tenantConfig, tenantMeta, userPreferences, legacyAppConfig } = input;

  const resolvedProviders: Record<string, ResolvedProviderConfig> = {};

  if (tenantConfig?.providers) {
    Object.entries(tenantConfig.providers).forEach(([providerKey, providerConfig]) => {
      resolvedProviders[providerKey] = {
        ...providerConfig,
        source: 'tenant',
      };
    });
  }

  const localProviders = userPreferences?.localProviders;
  if (localProviders) {
    Object.entries(localProviders).forEach(([providerKey, providerConfig]) => {
      if (!LOCAL_PROVIDER_KEYS.has(providerKey) || resolvedProviders[providerKey]) {
        return;
      }
      resolvedProviders[providerKey] = {
        ...providerConfig,
        source: 'local',
      };
    });
  }

  if (Object.keys(resolvedProviders).length === 0) {
    const legacyProviders = normalizeLegacyProviders(legacyAppConfig?.providers);
    Object.entries(legacyProviders).forEach(([providerKey, providerConfig]) => {
      resolvedProviders[providerKey] = {
        ...providerConfig,
        source: LOCAL_PROVIDER_KEYS.has(providerKey) ? 'local' : 'tenant',
      };
    });
  }

  const availableModels = buildAvailableModels(resolvedProviders);
  const selection = pickSelection(availableModels, tenantConfig, legacyAppConfig, userPreferences);
  const selectedProviderConfig = selection.selectedProvider ? resolvedProviders[selection.selectedProvider] : undefined;

  let api: ResolvedModelConfig['api'] = null;
  if (selectedProviderConfig) {
    api = {
      apiKey: selectedProviderConfig.apiKey,
      baseUrl: selectedProviderConfig.baseUrl,
      apiFormat: selectedProviderConfig.apiFormat,
    };
  } else if (legacyAppConfig?.api?.key || legacyAppConfig?.api?.baseUrl) {
    api = {
      apiKey: legacyAppConfig.api.key ?? '',
      baseUrl: legacyAppConfig.api.baseUrl?.trim().replace(/\/+$/, '') ?? '',
    };
  }

  return {
    providers: resolvedProviders,
    availableModels,
    selectedProvider: selection.selectedProvider,
    selectedModel: selection.selectedModel,
    api,
    status: {
      hasTenantConfig: !!tenantConfig,
      staleTenantConfig: tenantMeta?.stale === true,
    },
  };
}
