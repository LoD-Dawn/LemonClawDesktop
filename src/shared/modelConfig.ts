export type ProviderModelConfig = {
  id: string;
  name: string;
  supportsImage?: boolean;
};

export type ProviderConfig = {
  enabled: boolean;
  apiKey: string;
  baseUrl: string;
  apiFormat?: 'anthropic' | 'openai';
  codingPlanEnabled?: boolean;
  models: ProviderModelConfig[];
};

export type TenantConfig = {
  tenantLabel: string;
  fetchedAt: number;
  version?: string;
  providers: Record<string, ProviderConfig>;
  defaults: {
    provider?: string;
    model?: string;
  };
};

export type TenantConfigMeta = {
  lastAttemptAt?: number;
  lastSuccessAt?: number;
  lastError?: string;
  stale?: boolean;
};

export type UserPreferences = {
  theme?: 'light' | 'dark' | 'system';
  language?: 'zh' | 'en';
  useSystemProxy?: boolean;
  shortcuts?: Record<string, string | undefined>;
  preferredProvider?: string;
  preferredModel?: string;
  localProviders?: Record<string, ProviderConfig>;
};

export type ResolvedProviderConfig = ProviderConfig & {
  source: 'tenant' | 'local';
};

export type ResolvedModelItem = {
  id: string;
  name: string;
  providerKey: string;
  providerLabel: string;
  source: 'tenant' | 'local';
  supportsImage?: boolean;
};

export type ResolvedModelConfig = {
  providers: Record<string, ResolvedProviderConfig>;
  availableModels: ResolvedModelItem[];
  selectedProvider?: string;
  selectedModel?: string;
  api: {
    apiKey: string;
    baseUrl: string;
    apiFormat?: 'anthropic' | 'openai';
  } | null;
  status: {
    hasTenantConfig: boolean;
    staleTenantConfig: boolean;
  };
};
