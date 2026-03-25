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
      <div className="rounded-[18px] border border-white/60 bg-white/[0.62] px-3 py-2 text-sm text-text-secondary shadow-[0_12px_24px_rgba(44,36,18,0.06)] dark:border-dark-border/70 dark:bg-dark-surface/90 dark:text-dark-text-secondary">
        请先在设置中配置模型
      </div>
    );
  }

  const dropdownPositionClass = dropdownDirection === 'up'
    ? 'bottom-full mb-1'
    : 'top-full mt-1';

  return (
    <div ref={containerRef} className="relative cursor-pointer">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-3 rounded-[20px] border border-white/55 bg-white/[0.64] px-3.5 py-2 text-left shadow-[0_14px_28px_rgba(44,36,18,0.06)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/[0.82] dark:border-dark-border/70 dark:bg-dark-surface/90 dark:text-dark-text dark:hover:bg-dark-surface ${isOpen ? 'bg-white/[0.82] dark:bg-dark-surface' : ''}`}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold text-text-primary dark:text-dark-text">
            {selectedModel.name}
          </span>
          {selectedModel.provider && (
            <span className="block truncate text-[10px] uppercase tracking-[0.16em] text-text-muted dark:text-dark-text-muted">
              {selectedModel.provider}
            </span>
          )}
        </span>
        <ChevronDownIcon className="h-4 w-4 flex-shrink-0 dark:text-dark-text-secondary text-text-secondary" />
      </button>

      {isOpen && (
        <div className={`absolute ${dropdownPositionClass} z-50 w-60 overflow-hidden rounded-[24px] border border-white/60 bg-white/92 shadow-popover popover-enter dark:border-dark-border/70 dark:bg-dark-surface/96`}>
          <div className="max-h-64 overflow-y-auto">
          {availableModels.map((model) => (
            <button
              key={getModelIdentityKey(model)}
              onClick={() => handleModelSelect(model)}
              className={`flex w-full items-center justify-between px-4 py-3 text-left transition-colors ${
                isSameModelIdentity(model, selectedModel) ? 'bg-amber-100/60 dark:bg-amber-300/10' : 'hover:bg-surface-hover/80 dark:hover:bg-dark-surface-hover'
              }`}
            >
              <div className="flex flex-col">
                <span className="text-sm font-medium dark:text-dark-text text-text-primary">{model.name}</span>
                {model.provider && (
                  <span className="text-[10px] uppercase tracking-[0.16em] dark:text-dark-text-secondary text-text-secondary">{model.provider}</span>
                )}
              </div>
              {isSameModelIdentity(model, selectedModel) && (
                <CheckIcon className="h-4 w-4 text-amber-500 dark:text-amber-300" />
              )}
            </button>
          ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ModelSelector;
