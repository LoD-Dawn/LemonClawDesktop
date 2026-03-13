import React from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { i18nService } from '../../services/i18n';

type ProviderModelDialogProps = {
  open: boolean;
  isEditing: boolean;
  activeProvider: string;
  modelName: string;
  modelId: string;
  supportsImage: boolean;
  error: string | null;
  onClose: () => void;
  onSave: () => void;
  onModelNameChange: (value: string) => void;
  onModelIdChange: (value: string) => void;
  onSupportsImageChange: (value: boolean) => void;
};

export const ProviderModelDialog: React.FC<ProviderModelDialogProps> = ({
  open,
  isEditing,
  activeProvider,
  modelName,
  modelId,
  supportsImage,
  error,
  onClose,
  onSave,
  onModelNameChange,
  onModelIdChange,
  onSupportsImageChange,
}) => {
  if (!open) {
    return null;
  }

  const isOllama = activeProvider === 'ollama';

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      onSave();
    }
  };

  return (
    <div
      className="absolute inset-0 z-20 flex items-center justify-center bg-black/35 px-4 rounded-2xl"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isEditing ? i18nService.t('editModel') : i18nService.t('addNewModel')}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={handleKeyDown}
        className="w-full max-w-md rounded-2xl dark:bg-dark-surface bg-page dark:border-dark-border border-border border shadow-modal p-4"
      >
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold dark:text-dark-text text-text-primary">
            {isEditing ? i18nService.t('editModel') : i18nService.t('addNewModel')}
          </h4>
          <button
            type="button"
            onClick={onClose}
            className="p-1 dark:text-dark-text-secondary text-text-secondary dark:hover:text-dark-text hover:text-text-primary rounded-md dark:hover:bg-dark-surface-hover hover:bg-surface-hover"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <p className="mb-3 text-xs text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        <div className="space-y-3">
          {isOllama ? (
            <>
              <div>
                <label className="block text-xs font-medium dark:text-dark-text-secondary text-text-secondary mb-1">
                  {i18nService.t('ollamaModelName')}
                </label>
                <input
                  autoFocus
                  type="text"
                  value={modelId}
                  onChange={(event) => onModelIdChange(event.target.value)}
                  className="block w-full rounded-xl bg-surface-inset dark:bg-dark-surface-inset dark:border-dark-border border-border border focus:border-primary focus:ring-1 focus:ring-primary/30 dark:text-dark-text text-text-primary px-3 py-2 text-xs"
                  placeholder={i18nService.t('ollamaModelNamePlaceholder')}
                />
                <p className="mt-1 text-[11px] dark:text-dark-text-secondary/70 text-text-secondary/70">
                  {i18nService.t('ollamaModelNameHint')}
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium dark:text-dark-text-secondary text-text-secondary mb-1">
                  {i18nService.t('ollamaDisplayName')}
                </label>
                <input
                  type="text"
                  value={modelName === modelId ? '' : modelName}
                  onChange={(event) => onModelNameChange(event.target.value)}
                  className="block w-full rounded-xl bg-surface-inset dark:bg-dark-surface-inset dark:border-dark-border border-border border focus:border-primary focus:ring-1 focus:ring-primary/30 dark:text-dark-text text-text-primary px-3 py-2 text-xs"
                  placeholder={i18nService.t('ollamaDisplayNamePlaceholder')}
                />
                <p className="mt-1 text-[11px] dark:text-dark-text-secondary/70 text-text-secondary/70">
                  {i18nService.t('ollamaDisplayNameHint')}
                </p>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-xs font-medium dark:text-dark-text-secondary text-text-secondary mb-1">
                  {i18nService.t('modelName')}
                </label>
                <input
                  autoFocus
                  type="text"
                  value={modelName}
                  onChange={(event) => onModelNameChange(event.target.value)}
                  className="block w-full rounded-xl bg-surface-inset dark:bg-dark-surface-inset dark:border-dark-border border-border border focus:border-primary focus:ring-1 focus:ring-primary/30 dark:text-dark-text text-text-primary px-3 py-2 text-xs"
                  placeholder="GPT-4"
                />
              </div>
              <div>
                <label className="block text-xs font-medium dark:text-dark-text-secondary text-text-secondary mb-1">
                  {i18nService.t('modelId')}
                </label>
                <input
                  type="text"
                  value={modelId}
                  onChange={(event) => onModelIdChange(event.target.value)}
                  className="block w-full rounded-xl bg-surface-inset dark:bg-dark-surface-inset dark:border-dark-border border-border border focus:border-primary focus:ring-1 focus:ring-primary/30 dark:text-dark-text text-text-primary px-3 py-2 text-xs"
                  placeholder="gpt-4"
                />
              </div>
            </>
          )}
          <div className="flex items-center space-x-2">
            <input
              id={`${activeProvider}-supportsImage`}
              type="checkbox"
              checked={supportsImage}
              onChange={(event) => onSupportsImageChange(event.target.checked)}
              className="h-3.5 w-3.5 text-primary focus:ring-primary dark:bg-dark-surface bg-surface border-border dark:border-dark-border rounded"
            />
            <label
              htmlFor={`${activeProvider}-supportsImage`}
              className="text-xs dark:text-dark-text-secondary text-text-secondary"
            >
              {i18nService.t('supportsImageInput')}
            </label>
          </div>
        </div>

        <div className="flex justify-end space-x-2 mt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs dark:text-dark-text text-text-primary dark:hover:bg-dark-surface-hover hover:bg-surface-hover rounded-xl border dark:border-dark-border border-border"
          >
            {i18nService.t('cancel')}
          </button>
          <button
            type="button"
            onClick={onSave}
            className="px-3 py-1.5 text-xs text-white bg-primary hover:bg-primary-light rounded-xl active:scale-[0.98]"
          >
            {i18nService.t('save')}
          </button>
        </div>
      </div>
    </div>
  );
};
