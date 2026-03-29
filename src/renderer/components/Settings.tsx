import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { configService } from '../services/config';
import { checkForAppUpdate } from '../services/appUpdate';
import type { AppUpdateInfo } from '../services/appUpdate';
import { themeService } from '../services/theme';
import { i18nService, LanguageType } from '../services/i18n';
import { coworkService } from '../services/cowork';
import ErrorMessage from './ErrorMessage';
import { XMarkIcon, Cog6ToothIcon, CheckCircleIcon, XCircleIcon, CubeIcon, ChatBubbleLeftIcon, ShieldCheckIcon, EnvelopeIcon, InformationCircleIcon, CommandLineIcon, ChartBarIcon } from '@heroicons/react/24/outline';
import BrainIcon from './icons/BrainIcon';
import PlusCircleIcon from './icons/PlusCircleIcon';
import { ProviderSettingsPanel } from './settings/ProviderSettingsPanel';
import { ProviderModelDialog } from './settings/ProviderModelDialog';
import CoworkQuotaPanel from './cowork/CoworkQuotaPanel';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import type {
  CoworkExecutionMode,
  CoworkUserMemoryEntry,
  CoworkMemoryStats,
  CoworkSandboxProgress,
  CoworkSandboxStatus,
} from '../types/cowork';
import IMSettings from './im/IMSettings';
import EmailSkillConfig from './skills/EmailSkillConfig';
import { defaultConfig, type AppConfig, getVisibleProviders } from '../config';
import {
  OpenAIIcon,
  DeepSeekIcon,
  GeminiIcon,
  AnthropicIcon,
  MoonshotIcon,
  ZhipuIcon,
  MiniMaxIcon,
  YouDaoZhiYunIcon,
  QwenIcon,
  XiaomiIcon,
  StepfunIcon,
  VolcengineIcon,
  OpenRouterIcon,
  OllamaIcon,
  CustomProviderIcon,
} from './icons/providers';

type TabType = 'general' | 'usageStatistics' | 'model' | 'coworkSandbox' | 'coworkMemory' | 'shortcuts' | 'im' | 'email' | 'about';

export type SettingsOpenOptions = {
  initialTab?: TabType;
  notice?: string;
};

interface SettingsProps extends SettingsOpenOptions {
  onClose: () => void;
  onUpdateFound?: (info: AppUpdateInfo) => void;
}

const providerKeys = [
  'openai',
  'gemini',
  'anthropic',
  'deepseek',
  'moonshot',
  'zhipu',
  'minimax',
  'volcengine',
  'qwen',
  'youdaozhiyun',
  'stepfun',
  'xiaomi',
  'openrouter',
  'ollama',
  'custom',
] as const;
const localEditableProviderKeys = ['ollama', 'custom'] as const;

type ProviderType = (typeof providerKeys)[number];
type ProvidersConfig = NonNullable<AppConfig['providers']>;
type ProviderConfig = ProvidersConfig[string];
type Model = NonNullable<ProviderConfig['models']>[number];
type EditableProviderStoreConfig = {
  enabled: boolean;
  apiKey: string;
  baseUrl: string;
  apiFormat?: 'anthropic' | 'openai';
  codingPlanEnabled?: boolean;
  models: Model[];
};
type ProviderConnectionTestResult = {
  success: boolean;
  message: string;
  provider: ProviderType;
};

const providerMeta: Record<ProviderType, { label: string; icon: React.ReactNode }> = {
  openai: { label: 'OpenAI', icon: <OpenAIIcon /> },
  deepseek: { label: 'DeepSeek', icon: <DeepSeekIcon /> },
  gemini: { label: 'Gemini', icon: <GeminiIcon /> },
  anthropic: { label: 'Anthropic', icon: <AnthropicIcon /> },
  moonshot: { label: 'Moonshot', icon: <MoonshotIcon /> },
  zhipu: { label: 'Zhipu', icon: <ZhipuIcon /> },
  minimax: { label: 'MiniMax', icon: <MiniMaxIcon /> },
  youdaozhiyun: { label: 'Youdao', icon: <YouDaoZhiYunIcon /> },
  qwen: { label: 'Qwen', icon: <QwenIcon /> },
  xiaomi: { label: 'Xiaomi', icon: <XiaomiIcon /> },
  stepfun: { label: 'StepFun', icon: <StepfunIcon /> },
  volcengine: { label: 'Volcengine', icon: <VolcengineIcon /> },
  openrouter: { label: 'OpenRouter', icon: <OpenRouterIcon /> },
  ollama: { label: 'Ollama', icon: <OllamaIcon /> },
  custom: { label: 'Custom', icon: <CustomProviderIcon /> },
};

const isKnownProviderType = (provider: string): provider is ProviderType => (
  providerKeys.includes(provider as ProviderType)
);

const isEditableProvider = (provider: ProviderType): boolean => (
  (localEditableProviderKeys as readonly string[]).includes(provider)
);

const normalizeProviderModels = (models?: Model[]): Model[] => (
  (models ?? []).map((model) => ({
    ...model,
    supportsImage: model.supportsImage ?? false,
  }))
);

const maskSecret = (value: string): string => {
  if (!value) {
    return '';
  }
  if (value.length <= 8) {
    return '*'.repeat(value.length);
  }
  return `${value.slice(0, 3)}${'*'.repeat(Math.max(4, value.length - 6))}${value.slice(-3)}`;
};

const toEditableProviderStoreConfig = (providerKey: ProviderType, providerConfig: ProviderConfig): EditableProviderStoreConfig => ({
  enabled: providerConfig.enabled,
  apiKey: providerConfig.apiKey,
  baseUrl: resolveBaseUrl(providerKey, providerConfig.baseUrl, getEffectiveApiFormat(providerKey, providerConfig.apiFormat)),
  apiFormat: getEffectiveApiFormat(providerKey, providerConfig.apiFormat),
  codingPlanEnabled: providerConfig.codingPlanEnabled ?? false,
  models: normalizeProviderModels(providerConfig.models),
});

const providerSwitchableDefaultBaseUrls: Partial<Record<ProviderType, { anthropic: string; openai: string }>> = {
  deepseek: {
    anthropic: 'https://api.deepseek.com/anthropic',
    openai: 'https://api.deepseek.com',
  },
  moonshot: {
    anthropic: 'https://api.moonshot.cn/anthropic',
    openai: 'https://api.moonshot.cn/v1',
  },
  zhipu: {
    anthropic: 'https://open.bigmodel.cn/api/anthropic',
    openai: 'https://open.bigmodel.cn/api/paas/v4',
  },
  minimax: {
    anthropic: 'https://api.minimaxi.com/anthropic',
    openai: 'https://api.minimaxi.com/v1',
  },
  qwen: {
    anthropic: 'https://dashscope.aliyuncs.com/apps/anthropic',
    openai: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  },
  xiaomi: {
    anthropic: 'https://api.xiaomimimo.com/anthropic',
    openai: 'https://api.xiaomimimo.com/v1/chat/completions',
  },
  volcengine: {
    anthropic: 'https://ark.cn-beijing.volces.com/api/compatible',
    openai: 'https://ark.cn-beijing.volces.com/api/v3',
  },
  openrouter: {
    anthropic: 'https://openrouter.ai/api',
    openai: 'https://openrouter.ai/api/v1',
  },
  ollama: {
    anthropic: 'http://localhost:11434',
    openai: 'http://localhost:11434/v1',
  },
  custom: {
    anthropic: '',
    openai: '',
  },
};

const providerRequiresApiKey = (provider: ProviderType) => provider !== 'ollama';
const normalizeBaseUrl = (baseUrl: string): string => baseUrl.trim().replace(/\/+$/, '').toLowerCase();
const normalizeApiFormat = (value: unknown): 'anthropic' | 'openai' => (
  value === 'openai' ? 'openai' : 'anthropic'
);
const ABOUT_CONTACT_EMAIL = 'lemonclaw.project@rd.netease.com';
const ABOUT_USER_MANUAL_URL = 'https://gitee.com/omini_1/lemon-claw-desktop/blob/master/README_zh.md';
const ABOUT_SERVICE_TERMS_URL = 'https://gitee.com/omini_1/lemon-claw-desktop/blob/master/LICENSE';

const copyTextFallback = (text: string): boolean => {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  textarea.style.pointerEvents = 'none';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, text.length);
  const copied = document.execCommand('copy');
  document.body.removeChild(textarea);
  return copied;
};

const copyTextToClipboard = async (text: string): Promise<boolean> => {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (clipboardError) {
      console.warn('Navigator clipboard write failed, trying fallback:', clipboardError);
    }
  }

  try {
    return copyTextFallback(text);
  } catch (fallbackError) {
    console.error('Fallback clipboard copy failed:', fallbackError);
    return false;
  }
};

const getFixedApiFormatForProvider = (provider: string): 'anthropic' | 'openai' | null => {
  if (provider === 'openai' || provider === 'gemini' || provider === 'stepfun') {
    return 'openai';
  }
  if (provider === 'youdaozhiyun') {
    return 'openai';
  }
  if (provider === 'anthropic') {
    return 'anthropic';
  }
  return null;
};
const getEffectiveApiFormat = (provider: string, value: unknown): 'anthropic' | 'openai' => (
  getFixedApiFormatForProvider(provider) ?? normalizeApiFormat(value)
);
const shouldShowApiFormatSelector = (provider: string): boolean => (
  getFixedApiFormatForProvider(provider) === null
);
const getProviderDefaultBaseUrl = (
  provider: ProviderType,
  apiFormat: 'anthropic' | 'openai'
): string | null => {
  const defaults = providerSwitchableDefaultBaseUrls[provider];
  return defaults ? defaults[apiFormat] : null;
};
const resolveBaseUrl = (
  provider: ProviderType,
  baseUrl: string,
  apiFormat: 'anthropic' | 'openai'
): string => {
  if (baseUrl.trim()) return baseUrl;
  return getProviderDefaultBaseUrl(provider, apiFormat)
    || defaultConfig.providers?.[provider]?.baseUrl
    || '';
};
const shouldAutoSwitchProviderBaseUrl = (provider: ProviderType, currentBaseUrl: string): boolean => {
  const defaults = providerSwitchableDefaultBaseUrls[provider];
  if (!defaults) {
    return false;
  }

  const normalizedCurrent = normalizeBaseUrl(currentBaseUrl);
  return (
    normalizedCurrent === normalizeBaseUrl(defaults.anthropic)
    || normalizedCurrent === normalizeBaseUrl(defaults.openai)
  );
};
const buildOpenAICompatibleChatCompletionsUrl = (baseUrl: string, provider: string): string => {
  const normalized = baseUrl.trim().replace(/\/+$/, '');
  if (!normalized) {
    return '/v1/chat/completions';
  }
  if (normalized.endsWith('/chat/completions')) {
    return normalized;
  }

  const isGeminiLike = provider === 'gemini' || normalized.includes('generativelanguage.googleapis.com');
  if (isGeminiLike) {
    if (normalized.endsWith('/v1beta/openai') || normalized.endsWith('/v1/openai')) {
      return `${normalized}/chat/completions`;
    }
    if (normalized.endsWith('/v1beta') || normalized.endsWith('/v1')) {
      const betaBase = normalized.endsWith('/v1')
        ? `${normalized.slice(0, -3)}v1beta`
        : normalized;
      return `${betaBase}/openai/chat/completions`;
    }
    return `${normalized}/v1beta/openai/chat/completions`;
  }

  // Handle /v1, /v4 etc. versioned paths
  if (/\/v\d+$/.test(normalized)) {
    return `${normalized}/chat/completions`;
  }
  return `${normalized}/v1/chat/completions`;
};
const buildOpenAIResponsesUrl = (baseUrl: string): string => {
  const normalized = baseUrl.trim().replace(/\/+$/, '');
  if (!normalized) {
    return '/v1/responses';
  }
  if (normalized.endsWith('/responses')) {
    return normalized;
  }
  if (normalized.endsWith('/v1')) {
    return `${normalized}/responses`;
  }
  return `${normalized}/v1/responses`;
};
const shouldUseOpenAIResponsesForProvider = (provider: string): boolean => (
  provider === 'openai'
);
const shouldUseMaxCompletionTokensForOpenAI = (provider: string, modelId?: string): boolean => {
  if (provider !== 'openai') {
    return false;
  }
  const normalizedModel = (modelId ?? '').toLowerCase();
  const resolvedModel = normalizedModel.includes('/')
    ? normalizedModel.slice(normalizedModel.lastIndexOf('/') + 1)
    : normalizedModel;
  return resolvedModel.startsWith('gpt-5')
    || resolvedModel.startsWith('o1')
    || resolvedModel.startsWith('o3')
    || resolvedModel.startsWith('o4');
};
const CONNECTIVITY_TEST_TOKEN_BUDGET = 64;

const getDefaultProviders = (): ProvidersConfig => {
  const providers = (defaultConfig.providers ?? {}) as ProvidersConfig;
  const entries = Object.entries(providers) as Array<[string, ProviderConfig]>;
  return Object.fromEntries(
    entries.map(([providerKey, providerConfig]) => [
      providerKey,
      {
        ...providerConfig,
        models: providerConfig.models?.map(model => ({
          ...model,
          supportsImage: model.supportsImage ?? false,
        })),
      },
    ])
  ) as ProvidersConfig;
};

const getDefaultActiveProvider = (): ProviderType => {
  const providers = (defaultConfig.providers ?? {}) as ProvidersConfig;
  const firstEnabledProvider = providerKeys.find(providerKey => providers[providerKey]?.enabled);
  return firstEnabledProvider ?? providerKeys[0];
};

const Settings: React.FC<SettingsProps> = ({ onClose, initialTab, notice, onUpdateFound }) => {
  // 状态
  const [activeTab, setActiveTab] = useState<TabType>(initialTab ?? 'general');
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');
  const [language, setLanguage] = useState<LanguageType>('zh');
  const [autoLaunch, setAutoLaunchState] = useState(false);
  const [useSystemProxy, setUseSystemProxy] = useState(false);
  const [isUpdatingAutoLaunch, setIsUpdatingAutoLaunch] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(notice ?? null);
  const [testResult, setTestResult] = useState<ProviderConnectionTestResult | null>(null);
  const [isTestResultModalOpen, setIsTestResultModalOpen] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const initialThemeRef = useRef<'light' | 'dark' | 'system'>(themeService.getTheme());
  const initialLanguageRef = useRef<LanguageType>(i18nService.getLanguage());
  const didSaveRef = useRef(false);

  // Add state for active provider
  const [activeProvider, setActiveProvider] = useState<ProviderType>(getDefaultActiveProvider());
  const [showApiKey, setShowApiKey] = useState(false);

  // Add state for providers configuration
  const [providers, setProviders] = useState<ProvidersConfig>(() => getDefaultProviders());
  const [tenantVisibleProviderKeys, setTenantVisibleProviderKeys] = useState<ProviderType[]>([]);
  const activeProviderEditable = isEditableProvider(activeProvider);

  const isBaseUrlLocked = !!(
    (activeProvider === 'zhipu' && providers.zhipu.codingPlanEnabled)
    || (activeProvider === 'qwen' && providers.qwen.codingPlanEnabled)
    || (activeProvider === 'volcengine' && providers.volcengine.codingPlanEnabled)
    || (activeProvider === 'moonshot' && providers.moonshot.codingPlanEnabled)
  );

  // 创建引用来确保内容区域的滚动
  const contentRef = useRef<HTMLDivElement>(null);
  const emailCopiedTimerRef = useRef<number | null>(null);
  const updateCheckTimerRef = useRef<number | null>(null);

  // 快捷键设置
  const [shortcuts, setShortcuts] = useState({
    newChat: 'Ctrl+N',
    search: 'Ctrl+F',
    settings: 'Ctrl+,',
  });

  // State for model editing
  const [isAddingModel, setIsAddingModel] = useState(false);
  const [isEditingModel, setIsEditingModel] = useState(false);
  const [editingModelId, setEditingModelId] = useState<string | null>(null);
  const [newModelName, setNewModelName] = useState('');
  const [newModelId, setNewModelId] = useState('');
  const [newModelSupportsImage, setNewModelSupportsImage] = useState(false);
  const [modelFormError, setModelFormError] = useState<string | null>(null);

  // About tab
  const [appVersion, setAppVersion] = useState('');
  const [emailCopied, setEmailCopied] = useState(false);
  const [isExportingLogs, setIsExportingLogs] = useState(false);
  const [testMode, setTestMode] = useState(false);
  const [logoClickCount, setLogoClickCount] = useState(0);
  const [testModeUnlocked, setTestModeUnlocked] = useState(false);
  const [updateCheckStatus, setUpdateCheckStatus] = useState<'idle' | 'checking' | 'upToDate' | 'error'>('idle');

  useEffect(() => {
    window.electron.appInfo.getVersion().then(setAppVersion);
  }, []);

  useEffect(() => {
    setShowApiKey(false);
  }, [activeProvider]);

  const handleCopyContactEmail = useCallback(async () => {
    const copied = await copyTextToClipboard(ABOUT_CONTACT_EMAIL);
    if (copied) {
      setEmailCopied(true);
      if (emailCopiedTimerRef.current != null) {
        window.clearTimeout(emailCopiedTimerRef.current);
      }
      emailCopiedTimerRef.current = window.setTimeout(() => {
        setEmailCopied(false);
        emailCopiedTimerRef.current = null;
      }, 1200);
    }
  }, []);

  const handleCheckUpdate = useCallback(async () => {
    if (updateCheckStatus === 'checking' || !appVersion) return;
    setUpdateCheckStatus('checking');
    try {
      const info = await checkForAppUpdate(appVersion);
      if (info) {
        setUpdateCheckStatus('idle');
        onUpdateFound?.(info);
      } else {
        setUpdateCheckStatus('upToDate');
        if (updateCheckTimerRef.current != null) {
          window.clearTimeout(updateCheckTimerRef.current);
        }
        updateCheckTimerRef.current = window.setTimeout(() => {
          setUpdateCheckStatus('idle');
          updateCheckTimerRef.current = null;
        }, 3000);
      }
    } catch {
      setUpdateCheckStatus('error');
      if (updateCheckTimerRef.current != null) {
        window.clearTimeout(updateCheckTimerRef.current);
      }
      updateCheckTimerRef.current = window.setTimeout(() => {
        setUpdateCheckStatus('idle');
        updateCheckTimerRef.current = null;
      }, 3000);
    }
  }, [appVersion, updateCheckStatus, onUpdateFound]);

  const handleOpenUserManual = useCallback(() => {
    void window.electron.shell.openExternal(ABOUT_USER_MANUAL_URL);
  }, []);

  const handleOpenServiceTerms = useCallback(() => {
    void window.electron.shell.openExternal(ABOUT_SERVICE_TERMS_URL);
  }, []);

  const handleExportLogs = useCallback(async () => {
    if (isExportingLogs) {
      return;
    }

    setError(null);
    setNoticeMessage(null);
    setIsExportingLogs(true);
    try {
      const result = await window.electron.log.exportZip();
      if (!result.success) {
        setError(result.error || i18nService.t('aboutExportLogsFailed'));
        return;
      }
      if (result.canceled) {
        return;
      }

      if (result.path) {
        await window.electron.shell.showItemInFolder(result.path);
      }

      if ((result.missingEntries?.length ?? 0) > 0) {
        const missingList = result.missingEntries?.join(', ') || '';
        setNoticeMessage(`${i18nService.t('aboutExportLogsPartial')}: ${missingList}`);
      } else {
        setNoticeMessage(i18nService.t('aboutExportLogsSuccess'));
      }
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : i18nService.t('aboutExportLogsFailed'));
    } finally {
      setIsExportingLogs(false);
    }
  }, [isExportingLogs]);

  const coworkConfig = useSelector((state: RootState) => state.cowork.config);

  const [coworkExecutionMode, setCoworkExecutionMode] = useState<CoworkExecutionMode>(coworkConfig.executionMode || 'local');
  const [coworkMemoryEnabled, setCoworkMemoryEnabled] = useState<boolean>(coworkConfig.memoryEnabled ?? true);
  const [coworkMemoryLlmJudgeEnabled, setCoworkMemoryLlmJudgeEnabled] = useState<boolean>(coworkConfig.memoryLlmJudgeEnabled ?? false);
  const [coworkMemoryEntries, setCoworkMemoryEntries] = useState<CoworkUserMemoryEntry[]>([]);
  const [coworkMemoryStats, setCoworkMemoryStats] = useState<CoworkMemoryStats | null>(null);
  const [coworkMemoryListLoading, setCoworkMemoryListLoading] = useState<boolean>(false);
  const [coworkMemoryQuery, setCoworkMemoryQuery] = useState<string>('');
  const [coworkMemoryEditingId, setCoworkMemoryEditingId] = useState<string | null>(null);
  const [coworkMemoryDraftText, setCoworkMemoryDraftText] = useState<string>('');
  const [showMemoryModal, setShowMemoryModal] = useState<boolean>(false);
  const [coworkSandboxStatus, setCoworkSandboxStatus] = useState<CoworkSandboxStatus | null>(null);
  const [coworkSandboxLoading, setCoworkSandboxLoading] = useState(true);
  const [coworkSandboxProgress, setCoworkSandboxProgress] = useState<CoworkSandboxProgress | null>(null);
  const [coworkSandboxInstalling, setCoworkSandboxInstalling] = useState(false);

  useEffect(() => {
    setCoworkExecutionMode(coworkConfig.executionMode || 'local');
    setCoworkMemoryEnabled(coworkConfig.memoryEnabled ?? true);
    setCoworkMemoryLlmJudgeEnabled(coworkConfig.memoryLlmJudgeEnabled ?? false);
  }, [
    coworkConfig.executionMode,
    coworkConfig.memoryEnabled,
    coworkConfig.memoryLlmJudgeEnabled,
  ]);

  useEffect(() => () => {
    if (emailCopiedTimerRef.current != null) {
      window.clearTimeout(emailCopiedTimerRef.current);
    }
    if (updateCheckTimerRef.current != null) {
      window.clearTimeout(updateCheckTimerRef.current);
    }
  }, []);

  const loadCoworkSandboxStatus = useCallback(async () => {
    setCoworkSandboxLoading(true);
    try {
      const status = await coworkService.getSandboxStatus();
      setCoworkSandboxStatus(status);
      if (status?.progress) {
        setCoworkSandboxProgress(status.progress);
      }
    } catch (loadError) {
      console.error('Failed to load cowork sandbox status:', loadError);
      setCoworkSandboxStatus(null);
    } finally {
      setCoworkSandboxLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCoworkSandboxStatus();
  }, [loadCoworkSandboxStatus]);

  useEffect(() => {
    const unsubscribe = coworkService.onSandboxDownloadProgress((progress) => {
      setCoworkSandboxProgress(progress);
      if (progress.percent !== undefined && progress.percent >= 1) {
        void loadCoworkSandboxStatus();
      }
    });
    return () => unsubscribe();
  }, [loadCoworkSandboxStatus]);

  useEffect(() => {
    void (async () => {
      try {
        const config = configService.getConfig();
        const [preferences, resolvedConfig] = await Promise.all([
          window.electron.config.getUserPreferences(),
          window.electron.config.getResolvedModelConfig(),
        ]);

        initialThemeRef.current = preferences.theme ?? config.theme;
        initialLanguageRef.current = preferences.language ?? config.language;
        setTheme(preferences.theme ?? config.theme);
        setLanguage(preferences.language ?? config.language);
        setUseSystemProxy(preferences.useSystemProxy ?? config.useSystemProxy ?? false);
        const savedTestMode = config.app?.testMode ?? false;
        setTestMode(savedTestMode);
        if (savedTestMode) setTestModeUnlocked(true);

        window.electron.autoLaunch.get().then(({ enabled }) => {
          setAutoLaunchState(enabled);
        }).catch(err => {
          console.error('Failed to load auto-launch setting:', err);
        });

        const nextProviders = getDefaultProviders();
        providerKeys.forEach((providerKey) => {
          const resolvedProvider = resolvedConfig.providers[providerKey];
          if (!resolvedProvider) {
            return;
          }
          nextProviders[providerKey] = {
            ...nextProviders[providerKey],
            ...resolvedProvider,
            apiFormat: getEffectiveApiFormat(providerKey, resolvedProvider.apiFormat),
            models: normalizeProviderModels(resolvedProvider.models as Model[] | undefined),
          };
        });

        setTenantVisibleProviderKeys(
          resolvedConfig.status.hasTenantConfig
            ? Object.keys(resolvedConfig.providers).filter(isKnownProviderType)
            : []
        );
        setProviders(nextProviders);

        const initialProvider = (
          (preferences.preferredProvider && providerKeys.includes(preferences.preferredProvider as ProviderType)
            ? preferences.preferredProvider as ProviderType
            : undefined)
          ?? (resolvedConfig.selectedProvider && providerKeys.includes(resolvedConfig.selectedProvider as ProviderType)
            ? resolvedConfig.selectedProvider as ProviderType
            : undefined)
          ?? providerKeys.find((providerKey) => nextProviders[providerKey]?.enabled)
          ?? getDefaultActiveProvider()
        );
        setActiveProvider(initialProvider);

        if (preferences.shortcuts || config.shortcuts) {
          setShortcuts(prev => ({
            ...prev,
            ...(preferences.shortcuts ?? config.shortcuts),
          }));
        }
      } catch (error) {
        setError('Failed to load settings');
      }
    })();
  }, []);

  useEffect(() => {
    return () => {
      if (didSaveRef.current) {
        return;
      }
      themeService.setTheme(initialThemeRef.current);
      i18nService.setLanguage(initialLanguageRef.current, { persist: false });
    };
  }, []);

  // 监听标签页切换，确保内容区域滚动到顶部
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [activeTab]);

  useEffect(() => {
    setNoticeMessage(notice ?? null);
  }, [notice]);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Subscribe to language changes
  useEffect(() => {
    const unsubscribe = i18nService.subscribe(() => {
      setLanguage(i18nService.getLanguage());
    });
    return unsubscribe;
  }, []);

  // Compute visible providers based on language
  const visibleProviders = useMemo(() => {
    const visibleKeys = tenantVisibleProviderKeys.length > 0
      ? [
          ...tenantVisibleProviderKeys,
          ...providerKeys.filter((providerKey) => isEditableProvider(providerKey)),
        ]
      : [...getVisibleProviders(language).filter(isKnownProviderType)];
    const filtered: Partial<ProvidersConfig> = {};
    for (const key of [...new Set(visibleKeys)]) {
      if (providers[key as keyof ProvidersConfig]) {
        filtered[key as keyof ProvidersConfig] = providers[key as keyof ProvidersConfig];
      }
    }
    return filtered as ProvidersConfig;
  }, [language, providers, tenantVisibleProviderKeys]);

  // Ensure activeProvider is always in visibleProviders when language changes
  useEffect(() => {
    const visibleKeys = Object.keys(visibleProviders) as ProviderType[];
    if (visibleKeys.length > 0 && !visibleKeys.includes(activeProvider)) {
      // If current activeProvider is not visible, switch to first visible provider
      const firstEnabledVisible = visibleKeys.find(key => visibleProviders[key]?.enabled);
      setActiveProvider(firstEnabledVisible ?? visibleKeys[0]);
    }
  }, [visibleProviders, activeProvider]);

  // Handle provider change
  const resetProviderModelEditor = useCallback(() => {
    setIsAddingModel(false);
    setIsEditingModel(false);
    setEditingModelId(null);
    setNewModelName('');
    setNewModelId('');
    setNewModelSupportsImage(false);
    setModelFormError(null);
  }, []);

  const handleProviderChange = (provider: ProviderType) => {
    resetProviderModelEditor();
    setActiveProvider(provider);
    // 切换 provider 时清除测试结果
    setIsTestResultModalOpen(false);
    setTestResult(null);
  };

  // Handle provider configuration change
  const handleProviderConfigChange = (provider: ProviderType, field: string, value: string) => {
    if (!isEditableProvider(provider)) {
      return;
    }
    setProviders(prev => {
      if (field === 'apiFormat') {
        const nextApiFormat = getEffectiveApiFormat(provider, value);
        const nextProviderConfig: ProviderConfig = {
          ...prev[provider],
          apiFormat: nextApiFormat,
        };

        // Only auto-switch URL when current value is still a known default URL.
        if (shouldAutoSwitchProviderBaseUrl(provider, prev[provider].baseUrl)) {
          const defaultBaseUrl = getProviderDefaultBaseUrl(provider, nextApiFormat);
          if (defaultBaseUrl) {
            nextProviderConfig.baseUrl = defaultBaseUrl;
          }
        }

        return {
          ...prev,
          [provider]: nextProviderConfig,
        };
      }

      // Handle codingPlanEnabled toggle for zhipu
      if (field === 'codingPlanEnabled' && provider === 'zhipu') {
        const codingPlanEnabled = value === 'true';
        return {
          ...prev,
          zhipu: {
            ...prev.zhipu,
            codingPlanEnabled,
          },
        };
      }

      // Handle codingPlanEnabled toggle for qwen
      if (field === 'codingPlanEnabled' && provider === 'qwen') {
        const codingPlanEnabled = value === 'true';
        return {
          ...prev,
          qwen: {
            ...prev.qwen,
            codingPlanEnabled,
          },
        };
      }

      // Handle codingPlanEnabled toggle for volcengine
      if (field === 'codingPlanEnabled' && provider === 'volcengine') {
        const codingPlanEnabled = value === 'true';
        return {
          ...prev,
          volcengine: {
            ...prev.volcengine,
            codingPlanEnabled,
          },
        };
      }

      // Handle codingPlanEnabled toggle for moonshot
      if (field === 'codingPlanEnabled' && provider === 'moonshot') {
        const codingPlanEnabled = value === 'true';
        return {
          ...prev,
          moonshot: {
            ...prev.moonshot,
            codingPlanEnabled,
          },
        };
      }

      return {
        ...prev,
        [provider]: {
          ...prev[provider],
          [field]: value,
        },
      };
    });
  };

  const hasCoworkConfigChanges = coworkExecutionMode !== coworkConfig.executionMode
    || coworkMemoryEnabled !== coworkConfig.memoryEnabled
    || coworkMemoryLlmJudgeEnabled !== coworkConfig.memoryLlmJudgeEnabled;

  const coworkSandboxDisabled = !coworkSandboxStatus?.supported
    || !coworkSandboxStatus?.runtimeReady
    || !coworkSandboxStatus?.imageReady;

  const coworkSandboxStatusHint = useMemo(() => {
    if (coworkSandboxLoading) return i18nService.t('coworkSandboxChecking');
    if (!coworkSandboxStatus?.supported) return i18nService.t('coworkSandboxUnsupported');
    if (coworkSandboxStatus?.downloading) return i18nService.t('coworkSandboxDownloading');
    if (!coworkSandboxStatus?.runtimeReady) return i18nService.t('coworkSandboxRuntimeMissing');
    if (!coworkSandboxStatus?.imageReady) return i18nService.t('coworkSandboxImageMissing');
    return '';
  }, [coworkSandboxLoading, coworkSandboxStatus]);

  const coworkSandboxPercent = useMemo(() => {
    if (!coworkSandboxProgress) return null;
    if (coworkSandboxProgress.percent !== undefined && Number.isFinite(coworkSandboxProgress.percent)) {
      return Math.min(100, Math.max(0, Math.round(coworkSandboxProgress.percent * 100)));
    }
    if (coworkSandboxProgress.total && coworkSandboxProgress.total > 0) {
      return Math.min(100, Math.max(0, Math.round((coworkSandboxProgress.received / coworkSandboxProgress.total) * 100)));
    }
    return null;
  }, [coworkSandboxProgress]);

  const coworkSandboxStageLabel = coworkSandboxProgress?.stage === 'image'
    ? (i18nService.getLanguage() === 'zh' ? '镜像' : 'Image')
    : (i18nService.getLanguage() === 'zh' ? '运行时' : 'Runtime');

  const handleInstallCoworkSandbox = async () => {
    setCoworkSandboxInstalling(true);
    try {
      const result = await coworkService.installSandbox();
      if (result?.status) {
        setCoworkSandboxStatus(result.status);
        if (result.status.progress) {
          setCoworkSandboxProgress(result.status.progress);
        }
      }
    } finally {
      setCoworkSandboxInstalling(false);
    }
  };

  const loadCoworkMemoryData = useCallback(async () => {
    setCoworkMemoryListLoading(true);
    try {
      const [entries, stats] = await Promise.all([
        coworkService.listMemoryEntries({
          query: coworkMemoryQuery.trim() || undefined,
        }),
        coworkService.getMemoryStats(),
      ]);
      setCoworkMemoryEntries(entries);
      setCoworkMemoryStats(stats);
    } catch (loadError) {
      console.error('Failed to load cowork memory data:', loadError);
      setCoworkMemoryEntries([]);
      setCoworkMemoryStats(null);
    } finally {
      setCoworkMemoryListLoading(false);
    }
  }, [
    coworkMemoryQuery,
  ]);

  useEffect(() => {
    if (activeTab !== 'coworkMemory') return;
    void loadCoworkMemoryData();
  }, [activeTab, loadCoworkMemoryData]);

  const resetCoworkMemoryEditor = () => {
    setCoworkMemoryEditingId(null);
    setCoworkMemoryDraftText('');
    setShowMemoryModal(false);
  };

  const handleSaveCoworkMemoryEntry = async () => {
    const text = coworkMemoryDraftText.trim();
    if (!text) return;

    setCoworkMemoryListLoading(true);
    try {
      if (coworkMemoryEditingId) {
        await coworkService.updateMemoryEntry({
          id: coworkMemoryEditingId,
          text,
          status: 'created',
          isExplicit: true,
        });
      } else {
        await coworkService.createMemoryEntry({
          text,
          isExplicit: true,
        });
      }
      resetCoworkMemoryEditor();
      await loadCoworkMemoryData();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : i18nService.t('coworkMemoryCrudSaveFailed'));
    } finally {
      setCoworkMemoryListLoading(false);
    }
  };

  const handleEditCoworkMemoryEntry = (entry: CoworkUserMemoryEntry) => {
    setCoworkMemoryEditingId(entry.id);
    setCoworkMemoryDraftText(entry.text);
    setShowMemoryModal(true);
  };

  const handleDeleteCoworkMemoryEntry = async (entry: CoworkUserMemoryEntry) => {
    setCoworkMemoryListLoading(true);
    try {
      await coworkService.deleteMemoryEntry({ id: entry.id });
      if (coworkMemoryEditingId === entry.id) {
        resetCoworkMemoryEditor();
      }
      await loadCoworkMemoryData();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : i18nService.t('coworkMemoryCrudDeleteFailed'));
    } finally {
      setCoworkMemoryListLoading(false);
    }
  };

  const getMemoryStatusLabel = (status: CoworkUserMemoryEntry['status']): string => {
    if (status === 'created') return i18nService.t('coworkMemoryStatusActive');
    if (status === 'stale') return i18nService.t('coworkMemoryStatusInactive');
    return i18nService.t('coworkMemoryStatusDeleted');
  };

  const formatMemoryUpdatedAt = (timestamp: number): string => {
    if (!Number.isFinite(timestamp) || timestamp <= 0) return '-';
    try {
      return new Date(timestamp).toLocaleString();
    } catch {
      return '-';
    }
  };

  const handleOpenCoworkMemoryModal = () => {
    resetCoworkMemoryEditor();
    setShowMemoryModal(true);
  };

  // Toggle provider enabled status
  const toggleProviderEnabled = (provider: ProviderType) => {
    if (!isEditableProvider(provider)) {
      return;
    }
    const providerConfig = providers[provider];
    const isEnabling = !providerConfig.enabled;
    const missingApiKey = providerRequiresApiKey(provider) && !providerConfig.apiKey.trim();

    if (isEnabling && missingApiKey) {
      setError(i18nService.t('apiKeyRequired'));
      return;
    }

    setProviders(prev => ({
      ...prev,
      [provider]: {
        ...prev[provider],
        enabled: !prev[provider].enabled
      }
    }));
  };

  const enableProvider = (provider: ProviderType) => {
    if (!isEditableProvider(provider)) {
      return;
    }
    setProviders(prev => {
      if (prev[provider].enabled) {
        return prev;
      }

      return {
        ...prev,
        [provider]: {
          ...prev[provider],
          enabled: true,
        },
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      const normalizedLocalProviders = Object.fromEntries(
        Object.entries(providers)
          .filter(([providerKey]) => isEditableProvider(providerKey as ProviderType))
          .map(([providerKey, providerConfig]) => {
            return [
              providerKey,
              toEditableProviderStoreConfig(providerKey as ProviderType, providerConfig),
            ];
          })
      ) as Record<string, EditableProviderStoreConfig>;

      await configService.updateConfig({
        app: {
          ...configService.getConfig().app,
          testMode,
        },
      });

      await window.electron.config.updateUserPreferences({
        theme,
        language,
        useSystemProxy,
        shortcuts,
        localProviders: normalizedLocalProviders,
      });
      configService.applyUserPreferences({
        theme,
        language,
        useSystemProxy,
        shortcuts,
      });

      // 应用主题
      themeService.setTheme(theme);

      // 应用语言
      i18nService.setLanguage(language, { persist: false });

      if (hasCoworkConfigChanges) {
        await coworkService.updateConfig({
          executionMode: coworkExecutionMode,
          memoryEnabled: coworkMemoryEnabled,
          memoryLlmJudgeEnabled: coworkMemoryLlmJudgeEnabled,
        });
      }

      didSaveRef.current = true;
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  // 标签页切换处理
  const handleTabChange = (tab: TabType) => {
    if (tab !== 'model') {
      resetProviderModelEditor();
    }
    setActiveTab(tab);
  };

  // 阻止点击设置窗口时事件传播到背景
  const handleSettingsClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const handleShortcutChange = (key: keyof typeof shortcuts, value: string) => {
    setShortcuts((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  // Handlers for model operations
  const handleAddModel = () => {
    if (!activeProviderEditable) {
      return;
    }
    resetProviderModelEditor();
    setIsAddingModel(true);
  };

  const handleEditModel = (modelId: string, modelName: string, supportsImage?: boolean) => {
    if (!activeProviderEditable) {
      return;
    }
    resetProviderModelEditor();
    setIsEditingModel(true);
    setEditingModelId(modelId);
    setNewModelName(modelName);
    setNewModelId(modelId);
    setNewModelSupportsImage(!!supportsImage);
  };

  const handleDeleteModel = (modelId: string) => {
    if (!activeProviderEditable || !providers[activeProvider].models) return;

    const updatedModels = providers[activeProvider].models.filter(
      model => model.id !== modelId
    );

    setProviders(prev => ({
      ...prev,
      [activeProvider]: {
        ...prev[activeProvider],
        models: updatedModels
      }
    }));
  };

  const handleSaveNewModel = () => {
    if (!activeProviderEditable) {
      return;
    }
    const modelId = newModelId.trim();

    if (activeProvider === 'ollama') {
      // For Ollama, only the model name (stored as modelId) is required
      if (!modelId) {
        setModelFormError(i18nService.t('ollamaModelNameRequired'));
        return;
      }
    } else {
      const modelName = newModelName.trim();
      if (!modelName || !modelId) {
        setModelFormError(i18nService.t('modelNameAndIdRequired'));
        return;
      }
    }

    // For Ollama, auto-fill display name from modelId if not provided
    const modelName = activeProvider === 'ollama'
      ? (newModelName.trim() && newModelName.trim() !== modelId ? newModelName.trim() : modelId)
      : newModelName.trim();

    const currentModels = providers[activeProvider].models ?? [];
    const duplicateModel = currentModels.find(
      model => model.id === modelId && (!isEditingModel || model.id !== editingModelId)
    );
    if (duplicateModel) {
      setModelFormError(i18nService.t('modelIdExists'));
      return;
    }

    const nextModel = {
      id: modelId,
      name: modelName,
      supportsImage: newModelSupportsImage,
    };
    const updatedModels = isEditingModel && editingModelId
      ? currentModels.map(model => (model.id === editingModelId ? nextModel : model))
      : [...currentModels, nextModel];

    setProviders(prev => ({
      ...prev,
      [activeProvider]: {
        ...prev[activeProvider],
        models: updatedModels
      }
    }));

    resetProviderModelEditor();
  };

  const handleCancelModelEdit = () => {
    resetProviderModelEditor();
  };

  const showTestResultModal = (
    result: Omit<ProviderConnectionTestResult, 'provider'>,
    provider: ProviderType
  ) => {
    setTestResult({
      ...result,
      provider,
    });
    setIsTestResultModalOpen(true);
  };

  // 测试 API 连接
  const handleTestConnection = async () => {
    const testingProvider = activeProvider;
    const providerConfig = providers[testingProvider];
    setIsTesting(true);
    setIsTestResultModalOpen(false);
    setTestResult(null);

    if (providerRequiresApiKey(testingProvider) && !providerConfig.apiKey) {
      showTestResultModal({ success: false, message: i18nService.t('apiKeyRequired') }, testingProvider);
      setIsTesting(false);
      return;
    }

    // 获取第一个可用模型
    const firstModel = providerConfig.models?.[0];
    if (!firstModel) {
      showTestResultModal({ success: false, message: i18nService.t('noModelsConfigured') }, testingProvider);
      setIsTesting(false);
      return;
    }

    try {
      let response: Awaited<ReturnType<typeof window.electron.api.fetch>>;
      // Apply Coding Plan endpoint switch
      let effectiveBaseUrl = resolveBaseUrl(testingProvider, providerConfig.baseUrl, getEffectiveApiFormat(testingProvider, providerConfig.apiFormat));
      let effectiveApiFormat = getEffectiveApiFormat(testingProvider, providerConfig.apiFormat);

      // Handle Zhipu GLM Coding Plan endpoint switch
      if (testingProvider === 'zhipu' && (providerConfig as { codingPlanEnabled?: boolean }).codingPlanEnabled) {
        if (effectiveApiFormat === 'anthropic') {
          effectiveBaseUrl = 'https://open.bigmodel.cn/api/anthropic';
        } else {
          effectiveBaseUrl = 'https://open.bigmodel.cn/api/coding/paas/v4';
          effectiveApiFormat = 'openai';
        }
      }
      // Handle Qwen Coding Plan endpoint switch
      if (testingProvider === 'qwen' && (providerConfig as { codingPlanEnabled?: boolean }).codingPlanEnabled) {
        if (effectiveApiFormat === 'anthropic') {
          effectiveBaseUrl = 'https://coding.dashscope.aliyuncs.com/apps/anthropic';
        } else {
          effectiveBaseUrl = 'https://coding.dashscope.aliyuncs.com/v1';
          effectiveApiFormat = 'openai';
        }
      }
      // Handle Volcengine Coding Plan endpoint switch
      if (testingProvider === 'volcengine' && (providerConfig as { codingPlanEnabled?: boolean }).codingPlanEnabled) {
        if (effectiveApiFormat === 'anthropic') {
          effectiveBaseUrl = 'https://ark.cn-beijing.volces.com/api/coding';
        } else {
          effectiveBaseUrl = 'https://ark.cn-beijing.volces.com/api/coding/v3';
          effectiveApiFormat = 'openai';
        }
      }
      // Handle Moonshot Coding Plan endpoint switch
      if (testingProvider === 'moonshot' && (providerConfig as { codingPlanEnabled?: boolean }).codingPlanEnabled) {
        if (effectiveApiFormat === 'anthropic') {
          effectiveBaseUrl = 'https://api.kimi.com/coding';
        } else {
          effectiveBaseUrl = 'https://api.kimi.com/coding/v1';
          effectiveApiFormat = 'openai';
        }
      }

      const normalizedBaseUrl = effectiveBaseUrl.replace(/\/+$/, '');
      // 统一为两种协议格式：
      // - anthropic: /v1/messages
      // - openai provider: /v1/responses
      // - other openai-compatible providers: /v1/chat/completions
      const useAnthropicFormat = effectiveApiFormat === 'anthropic';

      if (useAnthropicFormat) {
        const anthropicUrl = normalizedBaseUrl.endsWith('/v1')
          ? `${normalizedBaseUrl}/messages`
          : `${normalizedBaseUrl}/v1/messages`;
        response = await window.electron.api.fetch({
          url: anthropicUrl,
          method: 'POST',
          headers: {
            'x-api-key': providerConfig.apiKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: firstModel.id,
            max_tokens: CONNECTIVITY_TEST_TOKEN_BUDGET,
            messages: [{ role: 'user', content: 'Hi' }],
          }),
        });
      } else {
        const useResponsesApi = shouldUseOpenAIResponsesForProvider(testingProvider);
        const openaiUrl = useResponsesApi
          ? buildOpenAIResponsesUrl(normalizedBaseUrl)
          : buildOpenAICompatibleChatCompletionsUrl(normalizedBaseUrl, testingProvider);
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (providerConfig.apiKey) {
          headers.Authorization = `Bearer ${providerConfig.apiKey}`;
        }
        const openAIRequestBody: Record<string, unknown> = useResponsesApi
          ? {
            model: firstModel.id,
            input: [{ role: 'user', content: [{ type: 'input_text', text: 'Hi' }] }],
            max_output_tokens: CONNECTIVITY_TEST_TOKEN_BUDGET,
          }
          : {
            model: firstModel.id,
            messages: [{ role: 'user', content: 'Hi' }],
          };
        if (!useResponsesApi && shouldUseMaxCompletionTokensForOpenAI(testingProvider, firstModel.id)) {
          openAIRequestBody.max_completion_tokens = CONNECTIVITY_TEST_TOKEN_BUDGET;
        } else {
          if (!useResponsesApi) {
            openAIRequestBody.max_tokens = CONNECTIVITY_TEST_TOKEN_BUDGET;
          }
        }
        response = await window.electron.api.fetch({
          url: openaiUrl,
          method: 'POST',
          headers,
          body: JSON.stringify(openAIRequestBody),
        });
      }

      if (response.ok) {
        if (isEditableProvider(testingProvider)) {
          enableProvider(testingProvider);
        }
        showTestResultModal({ success: true, message: i18nService.t('connectionSuccess') }, testingProvider);
      } else {
        const data = response.data || {};
        // 提取错误信息
        const errorMessage = data.error?.message || data.message || `${i18nService.t('connectionFailed')}: ${response.status}`;
        if (typeof errorMessage === 'string' && errorMessage.toLowerCase().includes('model output limit was reached')) {
          if (isEditableProvider(testingProvider)) {
            enableProvider(testingProvider);
          }
          showTestResultModal({ success: true, message: i18nService.t('connectionSuccess') }, testingProvider);
          return;
        }
        showTestResultModal({ success: false, message: errorMessage }, testingProvider);
      }
    } catch (err) {
      showTestResultModal({
        success: false,
        message: err instanceof Error ? err.message : i18nService.t('connectionFailed'),
      }, testingProvider);
    } finally {
      setIsTesting(false);
    }
  };

  // 渲染标签页
  const sidebarTabs: { key: TabType; label: string; icon: React.ReactNode }[] = useMemo(() => [
    { key: 'general', label: i18nService.t('general'), icon: <Cog6ToothIcon className="h-5 w-5" /> },
    { key: 'usageStatistics', label: i18nService.t('usageStatistics'), icon: <ChartBarIcon className="h-5 w-5" /> },
    { key: 'model', label: i18nService.t('model'), icon: <CubeIcon className="h-5 w-5" /> },
    { key: 'im', label: i18nService.t('imBot'), icon: <ChatBubbleLeftIcon className="h-5 w-5" /> },
    { key: 'email', label: i18nService.t('emailTab'), icon: <EnvelopeIcon className="h-5 w-5" /> },
    { key: 'coworkMemory', label: i18nService.t('coworkMemoryTitle'), icon: <BrainIcon className="h-5 w-5" /> },
    { key: 'coworkSandbox', label: i18nService.t('coworkSandbox'), icon: <ShieldCheckIcon className="h-5 w-5" /> },
    { key: 'shortcuts', label: i18nService.t('shortcuts'), icon: <CommandLineIcon className="h-5 w-5" /> },
    { key: 'about', label: i18nService.t('about'), icon: <InformationCircleIcon className="h-5 w-5" /> },
  ], [language]);

  const activeTabLabel = useMemo(() => {
    return sidebarTabs.find(t => t.key === activeTab)?.label ?? '';
  }, [activeTab, sidebarTabs]);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'general':
        return (
          <div className="space-y-8">
            {/* Auto-launch Section */}
            <div>
              <h4 className="text-sm font-medium dark:text-dark-text text-text-primary mb-3">
                {i18nService.t('autoLaunch')}
              </h4>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm dark:text-claude-darkSecondaryText text-claude-secondaryText">
                  {i18nService.t('autoLaunchDescription')}
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={autoLaunch}
                  onClick={async () => {
                    if (isUpdatingAutoLaunch) return;
                    const next = !autoLaunch;
                    setIsUpdatingAutoLaunch(true);
                    try {
                      const result = await window.electron.autoLaunch.set(next);
                      if (result.success) {
                        setAutoLaunchState(next);
                      } else {
                        setError(result.error || 'Failed to update auto-launch setting');
                      }
                    } catch (err) {
                      console.error('Failed to set auto-launch:', err);
                      setError('Failed to update auto-launch setting');
                    } finally {
                      setIsUpdatingAutoLaunch(false);
                    }
                  }}
                  disabled={isUpdatingAutoLaunch}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${isUpdatingAutoLaunch ? 'opacity-50 cursor-not-allowed' : ''
                    } ${autoLaunch
                      ? 'bg-primary'
                      : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${autoLaunch ? 'translate-x-6' : 'translate-x-1'
                      }`}
                  />
                </button>
              </label>
            </div>

            {/* System proxy Section */}
            <div>
              <h4 className="text-sm font-medium dark:text-dark-text text-text-primary mb-3">
                {i18nService.t('useSystemProxy')}
              </h4>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm dark:text-claude-darkSecondaryText text-claude-secondaryText">
                  {i18nService.t('useSystemProxyDescription')}
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={useSystemProxy}
                  onClick={() => {
                    setUseSystemProxy((prev) => !prev);
                  }}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${useSystemProxy
                    ? 'bg-primary'
                    : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${useSystemProxy ? 'translate-x-6' : 'translate-x-1'
                      }`}
                  />
                </button>
              </label>
            </div>

            {/* Appearance Section */}
            <div>
              <h4 className="text-sm font-medium dark:text-dark-text text-text-primary mb-3">
                {i18nService.t('appearance')}
              </h4>
              <div className="grid grid-cols-3 gap-4">
                {([
                  { value: 'light' as const, label: i18nService.t('light') },
                  { value: 'dark' as const, label: i18nService.t('dark') },
                  { value: 'system' as const, label: i18nService.t('system') },
                ]).map((option) => {
                  const isSelected = theme === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setTheme(option.value);
                        themeService.setTheme(option.value);
                      }}
                      className={`flex flex-col items-center rounded-xl border-2 p-3 transition-colors cursor-pointer ${isSelected
                        ? 'border-primary/60 bg-primary/5 dark:border-primary-lighter/40 dark:bg-primary-lighter/15'
                        : 'dark:border-dark-border border-border hover:border-primary/50 dark:hover:border-primary/50'
                        }`}
                    >
                      <svg viewBox="0 0 120 80" className="w-full h-auto rounded-md mb-2 overflow-hidden" xmlns="http://www.w3.org/2000/svg">
                        {option.value === 'light' && (
                          <>
                            <rect width="120" height="80" fill="#F8F9FB" />
                            <rect x="0" y="0" width="30" height="80" fill="#EBEDF0" />
                            <rect x="4" y="8" width="22" height="4" rx="2" fill="#C8CBD0" />
                            <rect x="4" y="16" width="18" height="3" rx="1.5" fill="#D5D7DB" />
                            <rect x="4" y="22" width="20" height="3" rx="1.5" fill="#D5D7DB" />
                            <rect x="4" y="28" width="16" height="3" rx="1.5" fill="#D5D7DB" />
                            <rect x="36" y="8" width="78" height="64" rx="4" fill="#FFFFFF" />
                            <rect x="42" y="16" width="50" height="4" rx="2" fill="#D5D7DB" />
                            <rect x="42" y="24" width="66" height="3" rx="1.5" fill="#E2E4E7" />
                            <rect x="42" y="30" width="60" height="3" rx="1.5" fill="#E2E4E7" />
                            <rect x="42" y="36" width="55" height="3" rx="1.5" fill="#E2E4E7" />
                            <rect x="42" y="46" width="40" height="4" rx="2" fill="#D5D7DB" />
                            <rect x="42" y="54" width="66" height="3" rx="1.5" fill="#E2E4E7" />
                            <rect x="42" y="60" width="58" height="3" rx="1.5" fill="#E2E4E7" />
                          </>
                        )}
                        {option.value === 'dark' && (
                          <>
                            <rect width="120" height="80" fill="#0F1117" />
                            <rect x="0" y="0" width="30" height="80" fill="#151820" />
                            <rect x="4" y="8" width="22" height="4" rx="2" fill="#3A3F4B" />
                            <rect x="4" y="16" width="18" height="3" rx="1.5" fill="#2A2F3A" />
                            <rect x="4" y="22" width="20" height="3" rx="1.5" fill="#2A2F3A" />
                            <rect x="4" y="28" width="16" height="3" rx="1.5" fill="#2A2F3A" />
                            <rect x="36" y="8" width="78" height="64" rx="4" fill="#1A1D27" />
                            <rect x="42" y="16" width="50" height="4" rx="2" fill="#3A3F4B" />
                            <rect x="42" y="24" width="66" height="3" rx="1.5" fill="#252930" />
                            <rect x="42" y="30" width="60" height="3" rx="1.5" fill="#252930" />
                            <rect x="42" y="36" width="55" height="3" rx="1.5" fill="#252930" />
                            <rect x="42" y="46" width="40" height="4" rx="2" fill="#3A3F4B" />
                            <rect x="42" y="54" width="66" height="3" rx="1.5" fill="#252930" />
                            <rect x="42" y="60" width="58" height="3" rx="1.5" fill="#252930" />
                          </>
                        )}
                        {option.value === 'system' && (
                          <>
                            <defs>
                              <clipPath id="left-half">
                                <rect x="0" y="0" width="60" height="80" />
                              </clipPath>
                              <clipPath id="right-half">
                                <rect x="60" y="0" width="60" height="80" />
                              </clipPath>
                            </defs>
                            {/* Light half */}
                            <g clipPath="url(#left-half)">
                              <rect width="120" height="80" fill="#F8F9FB" />
                              <rect x="0" y="0" width="30" height="80" fill="#EBEDF0" />
                              <rect x="4" y="8" width="22" height="4" rx="2" fill="#C8CBD0" />
                              <rect x="4" y="16" width="18" height="3" rx="1.5" fill="#D5D7DB" />
                              <rect x="4" y="22" width="20" height="3" rx="1.5" fill="#D5D7DB" />
                              <rect x="4" y="28" width="16" height="3" rx="1.5" fill="#D5D7DB" />
                              <rect x="36" y="8" width="78" height="64" rx="4" fill="#FFFFFF" />
                              <rect x="42" y="16" width="50" height="4" rx="2" fill="#D5D7DB" />
                              <rect x="42" y="24" width="66" height="3" rx="1.5" fill="#E2E4E7" />
                              <rect x="42" y="30" width="60" height="3" rx="1.5" fill="#E2E4E7" />
                              <rect x="42" y="36" width="55" height="3" rx="1.5" fill="#E2E4E7" />
                              <rect x="42" y="46" width="40" height="4" rx="2" fill="#D5D7DB" />
                              <rect x="42" y="54" width="66" height="3" rx="1.5" fill="#E2E4E7" />
                            </g>
                            {/* Dark half */}
                            <g clipPath="url(#right-half)">
                              <rect width="120" height="80" fill="#0F1117" />
                              <rect x="0" y="0" width="30" height="80" fill="#151820" />
                              <rect x="4" y="8" width="22" height="4" rx="2" fill="#3A3F4B" />
                              <rect x="4" y="16" width="18" height="3" rx="1.5" fill="#2A2F3A" />
                              <rect x="4" y="22" width="20" height="3" rx="1.5" fill="#2A2F3A" />
                              <rect x="4" y="28" width="16" height="3" rx="1.5" fill="#2A2F3A" />
                              <rect x="36" y="8" width="78" height="64" rx="4" fill="#1A1D27" />
                              <rect x="42" y="16" width="50" height="4" rx="2" fill="#3A3F4B" />
                              <rect x="42" y="24" width="66" height="3" rx="1.5" fill="#252930" />
                              <rect x="42" y="30" width="60" height="3" rx="1.5" fill="#252930" />
                              <rect x="42" y="36" width="55" height="3" rx="1.5" fill="#252930" />
                              <rect x="42" y="46" width="40" height="4" rx="2" fill="#3A3F4B" />
                              <rect x="42" y="54" width="66" height="3" rx="1.5" fill="#252930" />
                            </g>
                            {/* Divider line */}
                            <line x1="60" y1="0" x2="60" y2="80" stroke="#888" strokeWidth="0.5" />
                          </>
                        )}
                      </svg>
                      <span className={`text-xs font-medium ${isSelected
                        ? 'text-primary dark:text-dark-text'
                        : 'dark:text-dark-text text-text-primary'
                        }`}>
                        {option.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        );

      case 'email':
        return <EmailSkillConfig />;

      case 'usageStatistics':
        return (
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium dark:text-dark-text text-text-primary mb-1">
                {i18nService.t('usageStatistics')}
              </h4>
              <p className="text-sm dark:text-claude-darkSecondaryText text-claude-secondaryText">
                {language === 'zh'
                  ? '查看当前积分额度、剩余时长和近 7 天使用情况。'
                  : 'View your current credit balance, remaining time, and usage over the last 7 days.'}
              </p>
            </div>
            <CoworkQuotaPanel title={i18nService.t('usageStatistics')} showSessionReservation={false} />
          </div>
        );

      case 'coworkSandbox':
        return (
          <div className="space-y-6">
            <div className="space-y-3">
              <label className="block text-sm font-medium dark:text-dark-text text-text-primary">
                {i18nService.t('coworkExecutionMode')}
              </label>
              <div className="space-y-2">
                {([
                  {
                    value: 'auto',
                    label: i18nService.t('coworkExecutionModeAuto'),
                    hint: i18nService.t('coworkExecutionModeAutoHint'),
                  },
                  {
                    value: 'local',
                    label: i18nService.t('coworkExecutionModeLocal'),
                    hint: i18nService.t('coworkExecutionModeLocalHint'),
                  },
                  {
                    value: 'sandbox',
                    label: i18nService.t('coworkExecutionModeSandbox'),
                    hint: i18nService.t('coworkExecutionModeSandboxHint'),
                  },
                ] as Array<{ value: CoworkExecutionMode; label: string; hint: string }>).map((option) => {
                  const isDisabled = option.value === 'sandbox' && coworkSandboxDisabled;
                  return (
                    <label
                      key={option.value}
                      className={`flex items-start gap-3 rounded-xl border px-3 py-2 text-sm transition-colors ${isDisabled
                        ? 'cursor-not-allowed opacity-60 dark:border-dark-border border-border'
                        : 'cursor-pointer dark:border-dark-border border-border hover:border-primary'
                        }`}
                    >
                      <input
                        type="radio"
                        name="cowork-execution-mode"
                        value={option.value}
                        checked={coworkExecutionMode === option.value}
                        onChange={() => setCoworkExecutionMode(option.value)}
                        disabled={isDisabled}
                        className="mt-1"
                      />
                      <span>
                        <span className="block font-medium dark:text-dark-text text-text-primary">
                          {option.label}
                        </span>
                        <span className="block text-xs dark:text-dark-text-secondary text-text-secondary">
                          {option.hint}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>

              {coworkSandboxStatusHint && (
                <div className="text-xs dark:text-dark-text-secondary text-text-secondary">
                  {coworkSandboxStatusHint}
                </div>
              )}

              {coworkSandboxProgress && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs dark:text-dark-text-secondary text-text-secondary">
                    <span>
                      {coworkSandboxStageLabel}
                    </span>
                    {coworkSandboxPercent !== null && (
                      <span>{coworkSandboxPercent}%</span>
                    )}
                  </div>
                  <div className="h-2 rounded-full dark:bg-dark-border bg-border overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${coworkSandboxPercent ?? 0}%` }}
                    />
                  </div>
                </div>
              )}

              {coworkSandboxDisabled && coworkSandboxStatus?.supported && (
                <button
                  type="button"
                  onClick={handleInstallCoworkSandbox}
                  disabled={coworkSandboxInstalling || coworkSandboxLoading}
                  className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-primary hover:bg-primary-light text-white text-sm font-medium transition-colors disabled:opacity-50 active:scale-[0.98]"
                >
                  {coworkSandboxInstalling ? i18nService.t('coworkSandboxInstalling') : i18nService.t('coworkSandboxInstall')}
                </button>
              )}

              {coworkSandboxDisabled && !coworkSandboxStatus?.supported && (
                <div className="text-xs text-blue-500 dark:text-blue-400">
                  {i18nService.t('coworkSandboxSelectionBlocked')}
                </div>
              )}
            </div>
          </div>
        );

      case 'coworkMemory':
        return (
          <div className="space-y-6">
            <div className="space-y-3 rounded-xl border px-4 py-4 dark:border-dark-border border-border">
              <div className="text-sm font-medium dark:text-dark-text text-text-primary">
                {i18nService.t('coworkMemoryTitle')}
              </div>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={coworkMemoryEnabled}
                  onChange={(event) => setCoworkMemoryEnabled(event.target.checked)}
                  className="mt-1"
                />
                <span>
                  <span className="block text-sm dark:text-dark-text text-text-primary">
                    {i18nService.t('coworkMemoryEnabled')}
                  </span>
                  <span className="block text-xs dark:text-dark-text-secondary text-text-secondary">
                    {i18nService.t('coworkMemoryEnabledHint')}
                  </span>
                  <span className="mt-1 block text-xs dark:text-dark-text-secondary text-text-secondary">
                    {i18nService.t('coworkMemorySimpleHint')}
                  </span>
                </span>
              </label>
              <label className={`flex items-start gap-3 ${coworkMemoryEnabled ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}>
                <input
                  type="checkbox"
                  checked={coworkMemoryLlmJudgeEnabled}
                  onChange={(event) => setCoworkMemoryLlmJudgeEnabled(event.target.checked)}
                  disabled={!coworkMemoryEnabled}
                  className="mt-1"
                />
                <span>
                  <span className="block text-sm dark:text-dark-text text-text-primary">
                    {i18nService.t('coworkMemoryLlmJudgeEnabled')}
                  </span>
                  <span className="block text-xs dark:text-dark-text-secondary text-text-secondary">
                    {i18nService.t('coworkMemoryLlmJudgeEnabledHint')}
                  </span>
                </span>
              </label>
            </div>

            <div className="space-y-4 rounded-xl border px-4 py-4 dark:border-dark-border border-border">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="text-sm font-medium dark:text-dark-text text-text-primary">
                    {i18nService.t('coworkMemoryCrudTitle')}
                  </div>
                  <div className="text-xs dark:text-dark-text-secondary text-text-secondary">
                    {i18nService.t('coworkMemoryManageHint')}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleOpenCoworkMemoryModal}
                  className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-light text-white text-sm transition-colors active:scale-[0.98]"
                >
                  <PlusCircleIcon className="h-4 w-4 mr-1.5" />
                  {i18nService.t('coworkMemoryCrudCreate')}
                </button>
              </div>

              {coworkMemoryStats && (
                <div className="text-xs dark:text-dark-text-secondary text-text-secondary">
                  {`${i18nService.t('coworkMemoryTotalLabel')}: ${coworkMemoryStats.created + coworkMemoryStats.stale} · ${i18nService.t('coworkMemoryActiveLabel')}: ${coworkMemoryStats.created} · ${i18nService.t('coworkMemoryInactiveLabel')}: ${coworkMemoryStats.stale}`}
                </div>
              )}

              <input
                type="text"
                value={coworkMemoryQuery}
                onChange={(event) => setCoworkMemoryQuery(event.target.value)}
                placeholder={i18nService.t('coworkMemorySearchPlaceholder')}
                className="w-full rounded-lg border px-3 py-2 text-sm dark:border-dark-border border-border dark:bg-dark-surface bg-surface"
              />

              <div className="max-h-[500px] overflow-auto rounded-lg border dark:border-dark-border border-border">
                {coworkMemoryListLoading ? (
                  <div className="px-3 py-3 text-xs dark:text-dark-text-secondary text-text-secondary">
                    {i18nService.t('loading')}
                  </div>
                ) : coworkMemoryEntries.length === 0 ? (
                  <div className="px-3 py-3 text-xs dark:text-dark-text-secondary text-text-secondary">
                    {i18nService.t('coworkMemoryEmpty')}
                  </div>
                ) : (
                  <div className="divide-y dark:divide-dark-border divide-border">
                    {coworkMemoryEntries.map((entry) => (
                      <div key={entry.id} className="px-3 py-3 text-xs hover:bg-surface-hover dark:hover:bg-dark-surface-hover transition-colors">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 space-y-1 min-w-0">
                            <div className="font-medium dark:text-dark-text text-text-primary break-words">
                              {entry.text}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 dark:text-dark-text-secondary text-text-secondary">
                              <span className="rounded-full border px-2 py-0.5 dark:border-dark-border border-border">
                                {getMemoryStatusLabel(entry.status)}
                              </span>
                              <span>
                                {`${i18nService.t('coworkMemoryUpdatedAt')}: ${formatMemoryUpdatedAt(entry.updatedAt)}`}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              type="button"
                              onClick={() => handleEditCoworkMemoryEntry(entry)}
                              className="rounded border px-2 py-1 dark:border-dark-border border-border dark:text-dark-text text-text-primary hover:bg-surface-hover dark:hover:bg-dark-surface-hover transition-colors"
                            >
                              {i18nService.t('edit')}
                            </button>
                            <button
                              type="button"
                              onClick={() => { void handleDeleteCoworkMemoryEntry(entry); }}
                              className="rounded border px-2 py-1 text-red-500 dark:border-dark-border border-border hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-60 transition-colors"
                              disabled={coworkMemoryListLoading}
                            >
                              {i18nService.t('delete')}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>
        );

      case 'shortcuts':
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <h4 className="text-sm font-medium dark:text-dark-text text-text-primary">
                {i18nService.t('keyboardShortcuts')}
              </h4>
              <p className="text-xs dark:text-dark-text-secondary text-text-secondary">
                使用 `Ctrl`、`Shift`、`Alt`、`Cmd`/`Meta` 加上主键，例如 `Ctrl+N`、`Ctrl+Shift+F`、`Ctrl+,`。
              </p>
            </div>

            <div className="space-y-3 rounded-xl border px-4 py-4 dark:border-dark-border border-border">
              {([
                { key: 'newChat', label: i18nService.t('newChat') },
                { key: 'search', label: i18nService.t('search') },
                { key: 'settings', label: i18nService.t('openSettings') },
              ] as Array<{ key: keyof typeof shortcuts; label: string }>).map((item) => (
                <label key={item.key} className="flex items-center justify-between gap-4">
                  <span className="text-sm dark:text-dark-text text-text-primary">
                    {item.label}
                  </span>
                  <input
                    type="text"
                    value={shortcuts[item.key]}
                    onChange={(event) => handleShortcutChange(item.key, event.target.value)}
                    data-shortcut-input="true"
                    spellCheck={false}
                    className="w-40 rounded-xl border px-3 py-2 text-sm dark:border-dark-border border-border dark:bg-dark-surface bg-surface dark:text-dark-text text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
                  />
                </label>
              ))}
            </div>
          </div>
        );

      case 'model':
        return (
          <ProviderSettingsPanel
            visibleProviders={visibleProviders}
            providers={providers}
            providerMeta={providerMeta}
            activeProvider={activeProvider}
            activeProviderEditable={activeProviderEditable}
            isTesting={isTesting}
            showApiKey={showApiKey}
            isBaseUrlLocked={isBaseUrlLocked}
            currentBaseUrlValue={
              activeProvider === 'zhipu' && providers.zhipu.codingPlanEnabled
                ? (getEffectiveApiFormat('zhipu', providers.zhipu.apiFormat) === 'anthropic'
                  ? 'https://open.bigmodel.cn/api/anthropic'
                  : 'https://open.bigmodel.cn/api/coding/paas/v4')
                : activeProvider === 'qwen' && providers.qwen.codingPlanEnabled
                  ? (getEffectiveApiFormat('qwen', providers.qwen.apiFormat) === 'anthropic'
                    ? 'https://coding.dashscope.aliyuncs.com/apps/anthropic'
                    : 'https://coding.dashscope.aliyuncs.com/v1')
                  : activeProvider === 'volcengine' && providers.volcengine.codingPlanEnabled
                    ? (getEffectiveApiFormat('volcengine', providers.volcengine.apiFormat) === 'anthropic'
                      ? 'https://ark.cn-beijing.volces.com/api/coding'
                      : 'https://ark.cn-beijing.volces.com/api/coding/v3')
                    : activeProvider === 'moonshot' && providers.moonshot.codingPlanEnabled
                      ? (getEffectiveApiFormat('moonshot', providers.moonshot.apiFormat) === 'anthropic'
                        ? 'https://api.kimi.com/coding'
                        : 'https://api.kimi.com/coding/v1')
                      : providers[activeProvider].baseUrl
            }
            currentBaseUrlPlaceholder={
              getProviderDefaultBaseUrl(activeProvider, getEffectiveApiFormat(activeProvider, providers[activeProvider].apiFormat))
              || defaultConfig.providers?.[activeProvider]?.baseUrl
              || i18nService.t('baseUrlPlaceholder')
            }
            currentProviderLabel={providerMeta[activeProvider]?.label ?? activeProvider.charAt(0).toUpperCase() + activeProvider.slice(1)}
            customBaseUrlHintVisible={activeProvider === 'custom'}
            apiFormatSelectorVisible={shouldShowApiFormatSelector(activeProvider)}
            currentApiFormat={getEffectiveApiFormat(activeProvider, providers[activeProvider].apiFormat)}
            showManagedProviderTestHint={!activeProviderEditable}
            showManagedProviderModelsHint={!activeProviderEditable}
            canTestConnection={!isTesting && !(providerRequiresApiKey(activeProvider) && !providers[activeProvider].apiKey)}
            showZhipuCodingPlan={activeProvider === 'zhipu' && !!providers.zhipu.codingPlanEnabled}
            showQwenCodingPlan={activeProvider === 'qwen' && !!providers.qwen.codingPlanEnabled}
            showVolcengineCodingPlan={activeProvider === 'volcengine' && !!providers.volcengine.codingPlanEnabled}
            showMoonshotCodingPlan={activeProvider === 'moonshot' && !!providers.moonshot.codingPlanEnabled}
            onProviderChange={(provider) => handleProviderChange(provider as ProviderType)}
            onToggleProvider={(provider) => toggleProviderEnabled(provider as ProviderType)}
            onProviderConfigChange={(provider, field, value) => handleProviderConfigChange(provider as ProviderType, field, value)}
            onToggleApiKeyVisibility={() => setShowApiKey(!showApiKey)}
            onTestConnection={handleTestConnection}
            onAddModel={handleAddModel}
            onEditModel={handleEditModel}
            onDeleteModel={handleDeleteModel}
            maskSecret={maskSecret}
            providerRequiresApiKey={(provider) => providerRequiresApiKey(provider as ProviderType)}
            isEditableProvider={(provider) => isEditableProvider(provider as ProviderType)}
          />
        );
      case 'im':
        return <IMSettings />;

      case 'about':
        return (
          <div className="flex min-h-full flex-col items-center pt-6 pb-3">
            {/* Logo & App Name */}
            <img
              src="logo.png"
              alt="LemonClaw"
              className="w-16 h-16 mb-3 cursor-pointer select-none"
              onClick={() => {
                const next = logoClickCount + 1;
                setLogoClickCount(next);
                if (next >= 10 && !testModeUnlocked) {
                  setTestModeUnlocked(true);
                }
              }}
            />
            <h3 className="text-lg font-semibold dark:text-dark-text text-text-primary">LemonClaw</h3>
            <span className="text-xs dark:text-dark-text-secondary text-text-secondary mt-1">v{appVersion}</span>

            {/* Info Card */}
            <div className="w-full mt-8 rounded-xl border border-border dark:border-dark-border overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border dark:border-dark-border">
                <span className="text-sm dark:text-dark-text text-text-primary">{i18nService.t('aboutVersion')}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm dark:text-dark-text-secondary text-text-secondary">{appVersion}</span>
                  <button
                    type="button"
                    disabled={updateCheckStatus === 'checking'}
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleCheckUpdate();
                    }}
                    className="text-xs px-2 py-0.5 rounded-md border border-border dark:border-dark-border dark:text-dark-text-secondary text-text-secondary hover:text-primary dark:hover:text-primary hover:border-primary dark:hover:border-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {updateCheckStatus === 'checking' && i18nService.t('updateChecking')}
                    {updateCheckStatus === 'upToDate' && i18nService.t('updateUpToDate')}
                    {updateCheckStatus === 'error' && i18nService.t('updateCheckFailed')}
                    {updateCheckStatus === 'idle' && i18nService.t('checkForUpdate')}
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between px-4 py-3 border-b border-border dark:border-dark-border">
                <span className="text-sm dark:text-dark-text text-text-primary">{i18nService.t('aboutContactEmail')}</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleCopyContactEmail();
                    }}
                    title={i18nService.t('copyToClipboard')}
                    className="text-sm dark:text-dark-text-secondary text-text-secondary bg-transparent border-none appearance-none p-0 m-0 cursor-pointer focus:outline-none"
                  >
                    {ABOUT_CONTACT_EMAIL}
                  </button>
                  {emailCopied && (
                    <span className="text-[11px] leading-4 text-emerald-600 dark:text-emerald-400">
                      {language === 'zh' ? '已复制' : 'Copied'}
                    </span>
                  )}
                </div>
              </div>
              <div className={`flex items-center justify-between px-4 py-3${testModeUnlocked ? ' border-b border-border dark:border-dark-border' : ''}`}>
                <span className="text-sm dark:text-dark-text text-text-primary">{i18nService.t('aboutUserManual')}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenUserManual();
                  }}
                  className="text-sm dark:text-dark-text-secondary text-text-secondary hover:text-primary dark:hover:text-primary bg-transparent border-none appearance-none px-1.5 py-0.5 -mx-1.5 -my-0.5 rounded-md cursor-pointer focus:outline-none dark:hover:bg-dark-surface-hover hover:bg-surface-hover transition-colors"
                >
                  {ABOUT_USER_MANUAL_URL}
                </button>
              </div>
              {testModeUnlocked && (
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm dark:text-dark-text text-text-primary">{i18nService.t('testMode')}</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={testMode}
                    onClick={() => setTestMode((prev) => !prev)}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${testMode ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${testMode ? 'translate-x-6' : 'translate-x-1'
                        }`}
                    />
                  </button>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="mt-auto w-full pt-14 pb-2 flex flex-col items-center">
              <div className="flex items-center justify-center text-sm dark:text-dark-text-secondary text-text-secondary">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenServiceTerms();
                  }}
                  className="bg-transparent border-none appearance-none px-1.5 py-0.5 -mx-1.5 -my-0.5 rounded-md cursor-pointer hover:text-primary dark:hover:text-primary transition-colors"
                >
                  {i18nService.t('aboutServiceTerms')}
                </button>
                <span className="mx-3 text-xs opacity-40">|</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleExportLogs();
                  }}
                  disabled={isExportingLogs}
                  className="bg-transparent border-none appearance-none px-1.5 py-0.5 -mx-1.5 -my-0.5 rounded-md cursor-pointer hover:text-primary dark:hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isExportingLogs ? i18nService.t('aboutExportingLogs') : i18nService.t('aboutExportLogs')}
                </button>
              </div>

              <p className="mt-5 text-xs dark:text-dark-text-secondary text-text-secondary">
                {language === 'zh' ? 'LemonClaw 版权所有' : 'LemonClaw. All rights reserved.'}
              </p>
              <p className="mt-1 text-xs dark:text-dark-text-secondary text-text-secondary">
                Copyright &copy; {new Date().getFullYear()} LemonClaw. All Rights Reserved.
              </p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 modal-backdrop flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="relative flex w-[900px] h-[80vh] rounded-2xl dark:border-dark-border border-border border shadow-modal overflow-hidden modal-content"
        onClick={handleSettingsClick}
      >
        {/* Left sidebar */}
        <div className="w-[220px] shrink-0 flex flex-col dark:bg-dark-surface-muted bg-surface-muted border-r dark:border-dark-border border-border rounded-l-2xl overflow-y-auto">
          <div className="px-5 pt-5 pb-3">
            <h2 className="text-lg font-semibold dark:text-dark-text text-text-primary">{i18nService.t('settings')}</h2>
          </div>
          <nav className="flex flex-col gap-0.5 px-3 pb-4">
            {sidebarTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => handleTabChange(tab.key)}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg border text-sm font-medium transition-colors text-left ${activeTab === tab.key
                  ? 'border-primary/25 bg-primary/10 text-primary dark:border-primary-lighter/35 dark:bg-primary-lighter/15 dark:text-dark-text'
                  : 'border-transparent dark:text-dark-text-secondary text-text-secondary dark:hover:text-dark-text hover:text-text-primary dark:hover:bg-dark-surface-hover hover:bg-surface-hover'
                  }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Right content */}
        <div className="relative flex-1 flex flex-col min-w-0 overflow-hidden dark:bg-dark-bg bg-page rounded-r-2xl">
          {/* Content header */}
          <div className="flex justify-between items-center px-6 pt-5 pb-3 shrink-0">
            <h3 className="text-lg font-semibold dark:text-dark-text text-text-primary">{activeTabLabel}</h3>
            <button
              onClick={onClose}
              className="dark:text-dark-text-secondary text-text-secondary dark:hover:text-dark-text hover:text-text-primary p-1.5 dark:hover:bg-dark-surface-hover hover:bg-surface-hover rounded-lg transition-colors"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          {noticeMessage && (
            <div className="px-6">
              <ErrorMessage
                message={noticeMessage}
                onClose={() => setNoticeMessage(null)}
              />
            </div>
          )}

          {error && (
            <div className="px-6">
              <ErrorMessage
                message={error}
                onClose={() => setError(null)}
              />
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
            {/* Tab content */}
            <div
              ref={contentRef}
              className="px-6 py-4 flex-1 overflow-y-auto"
              style={{ scrollbarGutter: 'stable' }}
            >
              {renderTabContent()}
            </div>

            {/* Footer buttons */}
            <div className="flex justify-end space-x-4 p-4 dark:border-dark-border border-border border-t dark:bg-dark-bg bg-page shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 dark:text-dark-text text-text-primary dark:hover:bg-dark-surface-hover hover:bg-surface-hover rounded-xl transition-colors text-sm font-medium border dark:border-dark-border border-border active:scale-[0.98]"
              >
                {i18nService.t('cancel')}
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-4 py-2 bg-primary hover:bg-primary-light text-white rounded-xl transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
              >
                {isSaving ? i18nService.t('saving') : i18nService.t('save')}
              </button>
            </div>
          </form>

        </div>

        {isTestResultModalOpen && testResult && (
          <div
            className="absolute inset-0 z-30 flex items-center justify-center bg-black/35 px-4 rounded-2xl"
            onClick={() => setIsTestResultModalOpen(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label={i18nService.t('connectionTestResult')}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl dark:bg-dark-surface bg-page dark:border-dark-border border-border border shadow-modal p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold dark:text-dark-text text-text-primary">
                  {i18nService.t('connectionTestResult')}
                </h4>
                <button
                  type="button"
                  onClick={() => setIsTestResultModalOpen(false)}
                  className="p-1 dark:text-dark-text-secondary text-text-secondary dark:hover:text-dark-text hover:text-text-primary rounded-md dark:hover:bg-dark-surface-hover hover:bg-surface-hover"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </div>

              <div className="flex items-center gap-2 text-xs dark:text-dark-text-secondary text-text-secondary">
                <span>{providerMeta[testResult.provider]?.label ?? testResult.provider}</span>
                <span className="text-[11px]">•</span>
                <span className={`inline-flex items-center gap-1 ${testResult.success ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {testResult.success ? (
                    <CheckCircleIcon className="h-4 w-4" />
                  ) : (
                    <XCircleIcon className="h-4 w-4" />
                  )}
                  {testResult.success ? i18nService.t('connectionSuccess') : i18nService.t('connectionFailed')}
                </span>
              </div>

              <p className="mt-3 text-xs leading-5 dark:text-dark-text text-text-primary whitespace-pre-wrap break-words max-h-56 overflow-y-auto">
                {testResult.message}
              </p>

              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsTestResultModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-medium rounded-xl border dark:border-dark-border border-border dark:text-dark-text text-text-primary dark:hover:bg-dark-surface-hover hover:bg-surface-hover transition-colors active:scale-[0.98]"
                >
                  {i18nService.t('close')}
                </button>
              </div>
            </div>
          </div>
        )}

        <ProviderModelDialog
          open={isAddingModel || isEditingModel}
          isEditing={isEditingModel}
          activeProvider={activeProvider}
          modelName={newModelName}
          modelId={newModelId}
          supportsImage={newModelSupportsImage}
          error={modelFormError}
          onClose={handleCancelModelEdit}
          onSave={handleSaveNewModel}
          onModelNameChange={(value) => {
            if (activeProvider === 'ollama') {
              setNewModelName(value || newModelId);
            } else {
              setNewModelName(value);
            }
            if (modelFormError) {
              setModelFormError(null);
            }
          }}
          onModelIdChange={(value) => {
            setNewModelId(value);
            if (activeProvider === 'ollama' && (!newModelName || newModelName === newModelId)) {
              setNewModelName(value);
            }
            if (modelFormError) {
              setModelFormError(null);
            }
          }}
          onSupportsImageChange={setNewModelSupportsImage}
        />
        {/* Memory Modal */}
        {showMemoryModal && (
          <div
            className="absolute inset-0 z-20 flex items-center justify-center bg-black/35 px-4 rounded-2xl"
            onClick={resetCoworkMemoryEditor}
          >
            <div
              className="dark:bg-dark-surface bg-surface dark:border-dark-border border-border border rounded-2xl shadow-xl w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-5 pt-5 pb-4 border-b dark:border-dark-border border-border">
                <h3 className="text-base font-semibold dark:text-dark-text text-text-primary">
                  {coworkMemoryEditingId ? i18nService.t('coworkMemoryCrudUpdate') : i18nService.t('coworkMemoryCrudCreate')}
                </h3>
              </div>

              <div className="px-5 py-4 space-y-4">
                {coworkMemoryEditingId && (
                  <div className="rounded-lg border px-2 py-1 text-xs dark:border-dark-border border-border dark:text-dark-text-secondary text-text-secondary">
                    {i18nService.t('coworkMemoryEditingTag')}
                  </div>
                )}
                <textarea
                  value={coworkMemoryDraftText}
                  onChange={(event) => setCoworkMemoryDraftText(event.target.value)}
                  placeholder={i18nService.t('coworkMemoryCrudTextPlaceholder')}
                  autoFocus
                  className="min-h-[200px] w-full rounded-lg border px-3 py-2 text-sm dark:border-dark-border border-border dark:bg-dark-surface bg-surface dark:text-dark-text text-text-primary focus:border-primary focus:ring-1 focus:ring-primary/30"
                />
              </div>

              <div className="flex justify-end space-x-2 px-5 pb-5">
                <button
                  type="button"
                  onClick={resetCoworkMemoryEditor}
                  className="px-3 py-1.5 text-sm dark:text-dark-text text-text-primary dark:hover:bg-dark-surface-hover hover:bg-surface-hover rounded-xl border dark:border-dark-border border-border transition-colors"
                >
                  {i18nService.t('cancel')}
                </button>
                <button
                  type="button"
                  onClick={() => { void handleSaveCoworkMemoryEntry(); }}
                  disabled={!coworkMemoryDraftText.trim() || coworkMemoryListLoading}
                  className="px-3 py-1.5 text-sm text-white bg-primary hover:bg-primary-light rounded-xl disabled:opacity-60 disabled:cursor-not-allowed transition-colors active:scale-[0.98]"
                >
                  {coworkMemoryEditingId ? i18nService.t('save') : i18nService.t('coworkMemoryCrudCreate')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Settings; 
