import React from 'react';
import { createPortal } from 'react-dom';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { i18nService } from '../../services/i18n';

interface DeleteConfirmModalProps {
  taskName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  taskName,
  onConfirm,
  onCancel,
}) => {
  if (typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center modal-backdrop"
      onClick={onCancel}
    >
      <div
        className="app-modal-surface relative w-80 p-5 modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col items-center text-center">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />
          </div>
          <h3 className="mb-2 text-sm font-semibold text-text-primary dark:text-dark-text">
            {i18nService.t('scheduledTasksDelete')}
          </h3>
          <p className="mb-5 text-sm text-text-secondary dark:text-dark-text-secondary">
            {i18nService.t('scheduledTasksDeleteConfirm').replace('{name}', taskName)}
          </p>
          <div className="flex w-full items-center gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="app-secondary-btn flex-1 px-4 py-2 text-sm"
            >
              {i18nService.t('cancel')}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="flex-1 rounded-lg bg-red-500 px-4 py-2 text-sm text-white transition-colors hover:bg-red-600"
            >
              {i18nService.t('scheduledTasksDelete')}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default DeleteConfirmModal;
