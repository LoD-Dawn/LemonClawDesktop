import React from 'react';
import { i18nService } from '../../services/i18n';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

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
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center modal-backdrop"
      onClick={onCancel}
    >
      {/* Modal */}
      <div
        className="app-modal-surface relative w-80 p-5 modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col items-center text-center">
          <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-3">
            <ExclamationTriangleIcon className="w-5 h-5 text-red-500" />
          </div>
          <h3 className="text-sm font-semibold dark:text-dark-text text-text-primary mb-2">
            {i18nService.t('scheduledTasksDelete')}
          </h3>
          <p className="text-sm dark:text-dark-text-secondary text-text-secondary mb-5">
            {i18nService.t('scheduledTasksDeleteConfirm').replace('{name}', taskName)}
          </p>
          <div className="flex items-center gap-3 w-full">
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
              className="flex-1 px-4 py-2 text-sm rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors"
            >
              {i18nService.t('scheduledTasksDelete')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmModal;
