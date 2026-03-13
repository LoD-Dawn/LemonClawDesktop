import React from 'react';
import { SignalIcon } from '@heroicons/react/24/outline';
import { EyeIcon, EyeSlashIcon, XCircleIcon as XCircleIconSolid } from '@heroicons/react/20/solid';
import { i18nService } from '../../services/i18n';
import PlusCircleIcon from '../icons/PlusCircleIcon';
import TrashIcon from '../icons/TrashIcon';
import PencilIcon from '../icons/PencilIcon';

type ProviderConfigLike = {
  enabled: boolean;
  apiKey: string;
  baseUrl: string;
  apiFormat?: 'anthropic' | 'openai';
  codingPlanEnabled?: boolean;
  models?: Array<{
    id: string;
    name: string;
    supportsImage?: boolean;
  }>;
};

type ProviderMetaEntry = {
  label: string;
  icon: React.ReactNode;
};

type ManagedHintProps = {
  compact?: boolean;
  className?: string;
};

const ManagedProviderBadge: React.FC<ManagedHintProps> = ({ compact = false, className = '' }) => (
  <div
    className={`${compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs'} rounded-lg border border-primary/20 bg-primary/8 font-medium text-primary ${className}`.trim()}
  >
    {compact ? i18nService.t('managedProviderTag') : i18nService.t('managedProviderStatus')}
  </div>
);

const ManagedProviderNotice: React.FC = () => (
  <div className="rounded-xl border border-primary/20 bg-primary/8 px-3 py-2">
    <p className="text-xs font-medium text-primary">
      {i18nService.t('managedProviderTitle')}
    </p>
    <p className="mt-1 text-[11px] leading-5 text-primary/80">
      {i18nService.t('managedProviderHint')}
    </p>
  </div>
);

type ProviderSettingsPanelProps = {
  visibleProviders: Record<string, ProviderConfigLike>;
  providers: Record<string, ProviderConfigLike>;
  providerMeta: Record<string, ProviderMetaEntry>;
  activeProvider: string;
  activeProviderEditable: boolean;
  isTesting: boolean;
  isImportingProviders: boolean;
  isExportingProviders: boolean;
  showApiKey: boolean;
  importInputRef: React.RefObject<HTMLInputElement>;
  isBaseUrlLocked: boolean;
  currentBaseUrlValue: string;
  currentBaseUrlPlaceholder: string;
  currentProviderLabel: string;
  customBaseUrlHintVisible: boolean;
  apiFormatSelectorVisible: boolean;
  currentApiFormat: 'anthropic' | 'openai';
  showManagedProviderTestHint: boolean;
  showManagedProviderModelsHint: boolean;
  canTestConnection: boolean;
  showZhipuCodingPlan: boolean;
  showQwenCodingPlan: boolean;
  showVolcengineCodingPlan: boolean;
  showMoonshotCodingPlan: boolean;
  onImportClick: () => void;
  onExportClick: () => void;
  onImportChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onProviderChange: (provider: string) => void;
  onToggleProvider: (provider: string) => void;
  onProviderConfigChange: (provider: string, field: string, value: string) => void;
  onToggleApiKeyVisibility: () => void;
  onTestConnection: () => void;
  onAddModel: () => void;
  onEditModel: (modelId: string, modelName: string, supportsImage?: boolean) => void;
  onDeleteModel: (modelId: string) => void;
  maskSecret: (value: string) => string;
  providerRequiresApiKey: (provider: string) => boolean;
  isEditableProvider: (provider: string) => boolean;
};

export const ProviderSettingsPanel: React.FC<ProviderSettingsPanelProps> = ({
  visibleProviders,
  providers,
  providerMeta,
  activeProvider,
  activeProviderEditable,
  isTesting,
  isImportingProviders,
  isExportingProviders,
  showApiKey,
  importInputRef,
  isBaseUrlLocked,
  currentBaseUrlValue,
  currentBaseUrlPlaceholder,
  currentProviderLabel,
  customBaseUrlHintVisible,
  apiFormatSelectorVisible,
  currentApiFormat,
  showManagedProviderTestHint,
  showManagedProviderModelsHint,
  canTestConnection,
  showZhipuCodingPlan,
  showQwenCodingPlan,
  showVolcengineCodingPlan,
  showMoonshotCodingPlan,
  onImportClick,
  onExportClick,
  onImportChange,
  onProviderChange,
  onToggleProvider,
  onProviderConfigChange,
  onToggleApiKeyVisibility,
  onTestConnection,
  onAddModel,
  onEditModel,
  onDeleteModel,
  maskSecret,
  providerRequiresApiKey,
  isEditableProvider,
}) => {
  const activeConfig = providers[activeProvider];

  return (
    <div className="flex h-full">
      <div className="w-2/5 border-r dark:border-dark-border border-border pr-3 space-y-1.5 overflow-y-auto">
        <div className="flex items-center justify-between mb-2 px-1">
          <h3 className="text-sm font-medium dark:text-dark-text text-text-primary">
            {i18nService.t('modelProviders')}
          </h3>
          <div className="flex items-center space-x-1">
            <button
              type="button"
              onClick={onImportClick}
              disabled={isImportingProviders || isExportingProviders}
              className="inline-flex items-center px-2 py-1 text-[11px] font-medium rounded-lg border dark:border-dark-border border-border dark:text-dark-text text-text-primary dark:hover:bg-dark-surface-hover hover:bg-surface-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors active:scale-[0.98]"
            >
              {i18nService.t('import')}
            </button>
            <button
              type="button"
              onClick={onExportClick}
              disabled={isImportingProviders || isExportingProviders}
              className="inline-flex items-center px-2 py-1 text-[11px] font-medium rounded-lg border dark:border-dark-border border-border dark:text-dark-text text-text-primary dark:hover:bg-dark-surface-hover hover:bg-surface-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors active:scale-[0.98]"
            >
              {i18nService.t('export')}
            </button>
          </div>
        </div>
        <input
          ref={importInputRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={onImportChange}
        />
        {Object.entries(visibleProviders).map(([provider, config]) => {
          const providerInfo = providerMeta[provider];
          const missingApiKey = providerRequiresApiKey(provider) && !config.apiKey.trim();
          const editable = isEditableProvider(provider);
          const canToggleProvider = editable && (config.enabled || !missingApiKey);
          return (
            <div
              key={provider}
              onClick={() => onProviderChange(provider)}
              className={`flex items-center p-2 rounded-xl cursor-pointer transition-colors ${activeProvider === provider
                ? 'bg-primary/10 dark:bg-primary-lighter/15 border border-primary/30 dark:border-primary-lighter/35 shadow-subtle'
                : 'dark:bg-dark-surface/50 bg-surface hover:bg-surface-hover dark:hover:bg-dark-surface-hover border border-transparent'
                }`}
            >
              <div className="flex flex-1 items-center">
                <div className="mr-2 flex h-7 w-7 items-center justify-center">
                  <span className="dark:text-dark-text text-text-primary">
                    {providerInfo?.icon}
                  </span>
                </div>
                <span className={`text-sm font-medium truncate ${activeProvider === provider
                  ? 'text-primary dark:text-dark-text'
                  : 'dark:text-dark-text text-text-primary'
                  }`}>
                  {providerInfo?.label ?? provider.charAt(0).toUpperCase() + provider.slice(1)}
                </span>
                {!editable && (
                  <ManagedProviderBadge compact className="ml-2 rounded-md" />
                )}
              </div>
              <div className="flex items-center ml-2">
                <div
                  title={!canToggleProvider ? i18nService.t('configureApiKey') : undefined}
                  className={`w-7 h-4 rounded-full flex items-center transition-colors ${config.enabled ? 'bg-primary' : 'dark:bg-dark-border bg-border'
                    } ${canToggleProvider ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'
                    }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!canToggleProvider) {
                      return;
                    }
                    onToggleProvider(provider);
                  }}
                >
                  <div
                    className={`w-3 h-3 rounded-full bg-white shadow-md transform transition-transform ${config.enabled ? 'translate-x-3.5' : 'translate-x-0.5'
                      }`}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="w-3/5 pl-4 pr-2 space-y-4 overflow-y-auto [scrollbar-gutter:stable]">
        <div className="flex items-center justify-between pb-2 border-b dark:border-dark-border border-border">
          <h3 className="text-base font-medium dark:text-dark-text text-text-primary">
            {currentProviderLabel} {i18nService.t('providerSettings')}
          </h3>
          <div className="flex items-center gap-2">
            {!activeProviderEditable && (
              <ManagedProviderBadge />
            )}
            <div
              className={`px-2 py-0.5 rounded-lg border text-xs font-medium ${activeConfig.enabled
                ? 'border-green-500/25 bg-green-500/12 text-green-700 dark:border-green-500/30 dark:bg-green-500/15 dark:text-green-300'
                : 'bg-red-500/20 text-red-600 dark:text-red-400'
                }`}
            >
              {activeConfig.enabled ? i18nService.t('providerStatusOn') : i18nService.t('providerStatusOff')}
            </div>
          </div>
        </div>

        {!activeProviderEditable && (
          <ManagedProviderNotice />
        )}

        {providerRequiresApiKey(activeProvider) && (
          <div>
            <label htmlFor={`${activeProvider}-apiKey`} className="block text-xs font-medium dark:text-dark-text text-text-primary mb-1">
              {i18nService.t('apiKey')}
            </label>
            <div className="relative">
              <input
                type={!activeProviderEditable ? 'text' : (showApiKey ? 'text' : 'password')}
                id={`${activeProvider}-apiKey`}
                value={!activeProviderEditable ? maskSecret(activeConfig.apiKey) : activeConfig.apiKey}
                onChange={(e) => onProviderConfigChange(activeProvider, 'apiKey', e.target.value)}
                readOnly={!activeProviderEditable}
                disabled={!activeProviderEditable}
                className={`block w-full rounded-xl bg-surface-inset dark:bg-dark-surface-inset dark:border-dark-border border-border border focus:border-primary focus:ring-1 focus:ring-primary/30 dark:text-dark-text text-text-primary px-3 py-2 pr-16 text-xs ${!activeProviderEditable ? 'opacity-70 cursor-not-allowed' : ''}`}
                placeholder={!activeProviderEditable ? i18nService.t('managedApiKeyPlaceholder') : i18nService.t('apiKeyPlaceholder')}
              />
              <div className="absolute right-2 inset-y-0 flex items-center gap-1">
                {activeConfig.apiKey && activeProviderEditable && (
                  <button
                    type="button"
                    onClick={() => onProviderConfigChange(activeProvider, 'apiKey', '')}
                    className="p-0.5 rounded text-text-secondary dark:text-dark-text-secondary hover:text-primary transition-colors"
                    title={i18nService.t('clear') || 'Clear'}
                  >
                    <XCircleIconSolid className="h-4 w-4" />
                  </button>
                )}
                <button
                  type="button"
                  disabled={!activeProviderEditable}
                  onClick={onToggleApiKeyVisibility}
                  className="p-0.5 rounded text-text-secondary dark:text-dark-text-secondary hover:text-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  title={showApiKey ? (i18nService.t('hide') || 'Hide') : (i18nService.t('show') || 'Show')}
                >
                  {showApiKey ? <EyeIcon className="h-4 w-4" /> : <EyeSlashIcon className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
        )}

        <div>
          <label htmlFor={`${activeProvider}-baseUrl`} className="block text-xs font-medium dark:text-dark-text text-text-primary mb-1">
            {i18nService.t('baseUrl')}
          </label>
          <div className="relative">
            <input
              type="text"
              id={`${activeProvider}-baseUrl`}
              value={currentBaseUrlValue}
              onChange={(e) => onProviderConfigChange(activeProvider, 'baseUrl', e.target.value)}
              readOnly={!activeProviderEditable}
              disabled={isBaseUrlLocked || !activeProviderEditable}
              className={`block w-full rounded-xl bg-surface-inset dark:bg-dark-surface-inset dark:border-dark-border border-border border focus:border-primary focus:ring-1 focus:ring-primary/30 dark:text-dark-text text-text-primary px-3 py-2 pr-8 text-xs ${(isBaseUrlLocked || !activeProviderEditable) ? 'opacity-50 cursor-not-allowed' : ''}`}
              placeholder={currentBaseUrlPlaceholder}
            />
            {activeConfig.baseUrl && !isBaseUrlLocked && activeProviderEditable && (
              <div className="absolute right-2 inset-y-0 flex items-center">
                <button
                  type="button"
                  onClick={() => onProviderConfigChange(activeProvider, 'baseUrl', '')}
                  className="p-0.5 rounded text-text-secondary dark:text-dark-text-secondary hover:text-primary transition-colors"
                  title={i18nService.t('clear') || 'Clear'}
                >
                  <XCircleIconSolid className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
          {customBaseUrlHintVisible && (
            <div className="mt-1.5 space-y-0.5 text-[11px] text-claude-secondaryText dark:text-claude-darkSecondaryText">
              <p>
                <span className="text-sm text-primary/50 mr-1">•</span>
                {i18nService.t('baseUrlHint1')}
                <code className="ml-1 text-primary/80 dark:text-primary/70 break-all">{i18nService.t('baseUrlHintExample1')}</code>
              </p>
              <p>
                <span className="text-sm text-primary/50 mr-1">•</span>
                {i18nService.t('baseUrlHint2')}
                <code className="ml-1 text-primary/80 dark:text-primary/70 break-all">{i18nService.t('baseUrlHintExample2')}</code>
              </p>
            </div>
          )}
          {showZhipuCodingPlan && (
            <div className="mt-1.5 p-2 rounded-lg bg-primary/10 border border-primary/20">
              <p className="text-[11px] text-primary dark:text-primary">
                <span className="font-medium">GLM Coding Plan:</span> {i18nService.t('zhipuCodingPlanEndpointHint')}
              </p>
            </div>
          )}
          {showQwenCodingPlan && (
            <div className="mt-1.5 p-2 rounded-lg bg-primary/10 border border-primary/20">
              <p className="text-[11px] text-primary dark:text-primary">
                <span className="font-medium">Coding Plan:</span> {i18nService.t('qwenCodingPlanEndpointHint')}
              </p>
            </div>
          )}
          {showVolcengineCodingPlan && (
            <div className="mt-1.5 p-2 rounded-lg bg-primary/10 border border-primary/20">
              <p className="text-[11px] text-primary dark:text-primary">
                <span className="font-medium">Coding Plan:</span> {i18nService.t('volcengineCodingPlanEndpointHint')}
              </p>
            </div>
          )}
          {showMoonshotCodingPlan && (
            <div className="mt-1.5 p-2 rounded-lg bg-primary/10 border border-primary/20">
              <p className="text-[11px] text-primary dark:text-primary">
                <span className="font-medium">Coding Plan:</span> {i18nService.t('moonshotCodingPlanEndpointHint')}
              </p>
            </div>
          )}
        </div>

        {apiFormatSelectorVisible && (
          <div>
            <label htmlFor={`${activeProvider}-apiFormat`} className="block text-xs font-medium dark:text-dark-text text-text-primary mb-1">
              {i18nService.t('apiFormat')}
            </label>
            <div className="flex items-center space-x-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  name={`${activeProvider}-apiFormat`}
                  value="anthropic"
                  checked={currentApiFormat !== 'openai'}
                  disabled={!activeProviderEditable}
                  onChange={() => onProviderConfigChange(activeProvider, 'apiFormat', 'anthropic')}
                  className="h-3.5 w-3.5 text-primary focus:ring-primary dark:bg-dark-surface bg-surface"
                />
                <span className="ml-2 text-xs dark:text-dark-text text-text-primary">
                  {i18nService.t('apiFormatNative')}
                </span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name={`${activeProvider}-apiFormat`}
                  value="openai"
                  checked={currentApiFormat === 'openai'}
                  disabled={!activeProviderEditable}
                  onChange={() => onProviderConfigChange(activeProvider, 'apiFormat', 'openai')}
                  className="h-3.5 w-3.5 text-primary focus:ring-primary dark:bg-dark-surface bg-surface"
                />
                <span className="ml-2 text-xs dark:text-dark-text text-text-primary">
                  {i18nService.t('apiFormatOpenAI')}
                </span>
              </label>
            </div>
            <p className="mt-1 text-xs dark:text-dark-text-secondary text-text-secondary">
              {i18nService.t('apiFormatHint')}
            </p>
          </div>
        )}

        {(['zhipu', 'qwen', 'volcengine', 'moonshot'] as const).map((providerKey) => {
          if (activeProvider !== providerKey) {
            return null;
          }
          const hintKeyMap = {
            zhipu: 'zhipuCodingPlanHint',
            qwen: 'qwenCodingPlanHint',
            volcengine: 'volcengineCodingPlanHint',
            moonshot: 'moonshotCodingPlanHint',
          } as const;
          const badgeMap = {
            zhipu: 'Beta',
            qwen: '订阅套餐',
            volcengine: 'Beta',
            moonshot: 'Beta',
          } as const;
          const titleMap = {
            zhipu: 'GLM Coding Plan',
            qwen: 'Coding Plan',
            volcengine: 'Coding Plan',
            moonshot: 'Coding Plan',
          } as const;
          return (
            <div key={providerKey} className="flex items-center justify-between p-3 rounded-xl dark:bg-dark-surface/50 bg-surface/50 border dark:border-dark-border border-border">
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-medium dark:text-dark-text text-text-primary">
                    {titleMap[providerKey]}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-primary/10 text-primary">
                    {badgeMap[providerKey]}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] dark:text-dark-text-secondary text-text-secondary">
                  {i18nService.t(hintKeyMap[providerKey])}
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer ml-3">
                <input
                  type="checkbox"
                  checked={activeConfig.codingPlanEnabled ?? false}
                  disabled={!activeProviderEditable}
                  onChange={(e) => onProviderConfigChange(providerKey, 'codingPlanEnabled', e.target.checked ? 'true' : 'false')}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/50 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
              </label>
            </div>
          );
        })}

        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={onTestConnection}
            disabled={!canTestConnection}
            className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-xl border dark:border-dark-border border-border dark:text-dark-text text-text-primary dark:hover:bg-dark-surface-hover hover:bg-surface-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors active:scale-[0.98]"
          >
            <SignalIcon className="h-3.5 w-3.5 mr-1.5" />
            {isTesting ? i18nService.t('testing') : i18nService.t('testConnection')}
          </button>
          {showManagedProviderTestHint && (
            <span className="text-[11px] dark:text-dark-text-secondary text-text-secondary">
              {i18nService.t('managedProviderTestHint')}
            </span>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <h3 className="text-xs font-medium dark:text-dark-text text-text-primary">
              {i18nService.t('availableModels')}
            </h3>
            <button
              type="button"
              onClick={onAddModel}
              disabled={!activeProviderEditable}
              className="inline-flex items-center text-xs text-primary hover:text-primary-light disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <PlusCircleIcon className="h-3.5 w-3.5 mr-1" />
              {i18nService.t('addModel')}
            </button>
          </div>

          <div className="space-y-1.5 max-h-60 overflow-y-auto">
            {activeConfig.models?.map(model => (
              <div
                key={model.id}
                className="dark:bg-dark-surface/50 bg-surface/50 p-2 rounded-xl dark:border-dark-border border-border border transition-colors hover:border-primary group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-400"></div>
                    <span className="dark:text-dark-text text-text-primary font-medium text-[11px]">{model.name}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className="text-[10px] px-1.5 py-0.5 bg-surface-hover dark:bg-dark-surface-hover rounded-md dark:text-dark-text-secondary text-text-secondary">{model.id}</span>
                    {model.supportsImage && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-primary/10 text-primary">
                        {i18nService.t('imageInput')}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => onEditModel(model.id, model.name, model.supportsImage)}
                      disabled={!activeProviderEditable}
                      className="p-0.5 dark:text-dark-text-secondary text-text-secondary hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <PencilIcon className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteModel(model.id)}
                      disabled={!activeProviderEditable}
                      className="p-0.5 dark:text-dark-text-secondary text-text-secondary hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <TrashIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {(!activeConfig.models || activeConfig.models.length === 0) && (
              <div className="dark:bg-dark-surface/20 bg-surface/20 p-2.5 rounded-xl border dark:border-dark-border/50 border-border/50 text-center">
                <p className="text-[11px] dark:text-dark-text-secondary text-text-secondary">{i18nService.t('noModelsAvailable')}</p>
                <button
                  type="button"
                  onClick={onAddModel}
                  disabled={!activeProviderEditable}
                  className="mt-1.5 inline-flex items-center text-[11px] font-medium text-primary hover:text-primary-light disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <PlusCircleIcon className="h-3 w-3 mr-1" />
                  {i18nService.t('addFirstModel')}
                </button>
              </div>
            )}
          </div>
          {showManagedProviderModelsHint && (
            <p className="mt-2 text-[11px] dark:text-dark-text-secondary text-text-secondary">
              {i18nService.t('managedProviderModelsHint')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
