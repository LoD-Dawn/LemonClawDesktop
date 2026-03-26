import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store';
import { ChevronDownIcon, CheckIcon } from '@heroicons/react/24/outline';
import { setSelectedModel, isSameModelIdentity, getModelIdentityKey } from '../store/slices/modelSlice';

interface ModelSelectorProps {
  dropdownDirection?: 'up' | 'down';
}

const ModelSelector: React.FC<ModelSelectorProps> = ({ dropdownDirection = 'down' }) => {
  const dispatch = useDispatch();
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const selectedModel = useSelector((state: RootState) => state.model.selectedModel);
  const availableModels = useSelector((state: RootState) => state.model.availableModels);
  const quotaModels = useSelector((state: RootState) => state.quota.overview.models);

  // 点击外部区域关闭下拉框
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleModelSelect = (model: typeof availableModels[0]) => {
    dispatch(setSelectedModel(model));
    setIsOpen(false);
  };

  // 如果没有可用模型，显示提示
  if (availableModels.length === 0 || !selectedModel) {
    return (
      <div className="px-3 py-1.5 rounded-xl dark:bg-dark-surface bg-surface dark:text-dark-text-secondary text-text-secondary text-sm">
        请先在设置中配置模型
      </div>
    );
  }

  const dropdownPositionClass = dropdownDirection === 'up'
    ? 'bottom-full mb-1'
    : 'top-full mt-1';

  const getModelUsageMeta = (providerKey?: string, modelId?: string) => {
    if (!providerKey || !modelId || !quotaModels?.providers?.length) {
      return null;
    }
    return quotaModels.providers
      .find((provider) => provider.provider === providerKey)
      ?.models.find((model) => model.model === modelId)
      ?.usageMeta ?? null;
  };

  return (
    <div ref={containerRef} className="relative cursor-pointer">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl dark:hover:bg-dark-surface-hover hover:bg-surface-hover dark:text-dark-text text-text-primary transition-colors cursor-pointer ${isOpen ? 'dark:bg-dark-surface-hover bg-surface-hover' : ''}`}
      >
        <span className="font-medium text-sm">{selectedModel.name}</span>
        <ChevronDownIcon className="h-4 w-4 dark:text-dark-text-secondary text-text-secondary" />
      </button>

      {isOpen && (
        <div className={`absolute ${dropdownPositionClass} w-52 dark:bg-dark-surface bg-surface rounded-xl popover-enter shadow-popover z-50 dark:border-dark-border border-border border overflow-hidden`}>
          <div className="max-h-64 overflow-y-auto">
            {availableModels.map((model) => {
              const usageMeta = getModelUsageMeta(model.providerKey, model.id);
              const isDisabled = model.enabled === false;
              return (
                <button
                  key={getModelIdentityKey(model)}
                  onClick={() => {
                    if (!isDisabled) {
                      handleModelSelect(model);
                    }
                  }}
                  disabled={isDisabled}
                  title={isDisabled ? '当前模型暂不可用' : undefined}
                  className={`w-full px-4 py-2.5 text-left dark:text-dark-text text-text-primary flex items-center justify-between transition-colors ${
                    isDisabled
                      ? 'opacity-50 cursor-not-allowed'
                      : 'dark:hover:bg-dark-surface-hover hover:bg-surface-hover'
                  } ${
                    isSameModelIdentity(model, selectedModel) ? 'dark:bg-dark-surface-hover/50 bg-surface-hover/50' : ''
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="text-sm">{model.name}</span>
                    {model.provider && (
                      <span className="text-xs dark:text-dark-text-secondary text-text-secondary">{model.provider}</span>
                    )}
                    {usageMeta?.creditPerMinute !== null && usageMeta?.creditPerMinute !== undefined && (
                      <span className="text-[11px] dark:text-dark-text-secondary/80 text-text-secondary/80">
                        {usageMeta.creditPerMinute} 积分/分钟
                      </span>
                    )}
                    {isDisabled && (
                      <span className="text-[11px] text-amber-600 dark:text-amber-400">
                        暂不可用
                      </span>
                    )}
                  </div>
                  {isSameModelIdentity(model, selectedModel) && (
                    <CheckIcon className="h-4 w-4 text-primary" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default ModelSelector;
