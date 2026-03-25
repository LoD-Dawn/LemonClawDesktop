import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CoworkSessionSummary, CoworkSessionStatus } from '../../types/cowork';
import { EllipsisHorizontalIcon, ExclamationTriangleIcon, PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';
import ListChecksIcon from '../icons/ListChecksIcon';
import PushPinIcon from '../icons/PushPinIcon';
import { i18nService } from '../../services/i18n';

interface CoworkSessionItemProps {
  session: CoworkSessionSummary;
  hasUnread: boolean;
  isActive: boolean;
  isBatchMode: boolean;
  isSelected: boolean;
  showBatchOption?: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onTogglePin: (pinned: boolean) => void;
  onRename: (title: string) => void;
  onToggleSelection: () => void;
  onEnterBatchMode: () => void;
}

const statusLabels: Record<CoworkSessionStatus, string> = {
  idle: 'coworkStatusIdle',
  running: 'coworkStatusRunning',
  completed: 'coworkStatusCompleted',
  error: 'coworkStatusError',
};

const formatRelativeTime = (timestamp: number): { compact: string; full: string } => {
  const now = Date.now();
  const diff = now - timestamp;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) {
    return {
      compact: 'now',
      full: i18nService.t('justNow'),
    };
  } else if (minutes < 60) {
    return {
      compact: `${minutes}m`,
      full: `${minutes} ${i18nService.t('minutesAgo')}`,
    };
  } else if (hours < 24) {
    return {
      compact: `${hours}h`,
      full: `${hours} ${i18nService.t('hoursAgo')}`,
    };
  } else if (days === 1) {
    return {
      compact: '1d',
      full: i18nService.t('yesterday'),
    };
  } else {
    return {
      compact: `${days}d`,
      full: `${days} ${i18nService.t('daysAgo')}`,
    };
  }
};

const CoworkSessionItem: React.FC<CoworkSessionItemProps> = ({
  session,
  hasUnread,
  isActive,
  isBatchMode,
  isSelected,
  showBatchOption = true,
  onSelect,
  onDelete,
  onTogglePin,
  onRename,
  onToggleSelection,
  onEnterBatchMode,
}) => {
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(session.title);
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const actionButtonRef = useRef<HTMLButtonElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const ignoreNextBlurRef = useRef(false);

  useEffect(() => {
    if (!isRenaming) {
      setRenameValue(session.title);
      ignoreNextBlurRef.current = false;
    }
  }, [isRenaming, session.title]);

  const calculateMenuPosition = (height: number) => {
    const rect = actionButtonRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const menuWidth = 180;
    const padding = 8;
    const x = Math.min(
      Math.max(padding, rect.right - menuWidth),
      window.innerWidth - menuWidth - padding
    );
    const y = Math.min(rect.bottom + 8, window.innerHeight - height - padding);
    return { x, y };
  };

  const openMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isRenaming) return;
    if (menuPosition) {
      closeMenu();
      return;
    }
    const menuHeight = showBatchOption ? 156 : 120;
    const position = calculateMenuPosition(menuHeight);
    if (position) {
      setMenuPosition(position);
    }
    setShowConfirmDelete(false);
  };

  const closeMenu = () => {
    setMenuPosition(null);
    setShowConfirmDelete(false);
  };

  const handleTogglePin = (e: React.MouseEvent) => {
    e.stopPropagation();
    onTogglePin(!session.pinned);
    closeMenu();
  };

  const handleRenameClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    ignoreNextBlurRef.current = false;
    setIsRenaming(true);
    setShowConfirmDelete(false);
    setRenameValue(session.title);
    setMenuPosition(null);
  };

  const handleRenameSave = (e?: React.SyntheticEvent) => {
    e?.stopPropagation();
    ignoreNextBlurRef.current = true;
    const nextTitle = renameValue.trim();
    if (nextTitle && nextTitle !== session.title) {
      onRename(nextTitle);
    }
    setIsRenaming(false);
  };

  const handleRenameCancel = (e?: React.MouseEvent | React.KeyboardEvent) => {
    e?.stopPropagation();
    ignoreNextBlurRef.current = true;
    setRenameValue(session.title);
    setIsRenaming(false);
  };

  const handleRenameBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    if (ignoreNextBlurRef.current) {
      ignoreNextBlurRef.current = false;
      return;
    }
    handleRenameSave(event);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowConfirmDelete(true);
    setMenuPosition(null);
  };

  const handleConfirmDelete = () => {
    onDelete();
    setShowConfirmDelete(false);
  };

  const handleCancelDelete = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setShowConfirmDelete(false);
  };

  const handleBatchClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    closeMenu();
    onEnterBatchMode();
  };

  useEffect(() => {
    if (!menuPosition) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !actionButtonRef.current?.contains(target)) {
        closeMenu();
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMenu();
      }
    };
    const handleScroll = () => closeMenu();
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleScroll);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleScroll);
    };
  }, [menuPosition]);

  useEffect(() => {
    if (!menuPosition) return;
    const menuHeight = showConfirmDelete ? 112 : (showBatchOption ? 156 : 120);
    const position = calculateMenuPosition(menuHeight);
    if (position && (position.x !== menuPosition.x || position.y !== menuPosition.y)) {
      setMenuPosition(position);
    }
  }, [menuPosition, showConfirmDelete]);

  useEffect(() => {
    if (!isRenaming) return;
    requestAnimationFrame(() => {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    });
  }, [isRenaming]);

  const pinButtonLabel = session.pinned ? i18nService.t('coworkUnpinSession') : i18nService.t('coworkPinSession');
  const actionLabel = i18nService.t('coworkSessionActions');
  const renameLabel = i18nService.t('renameConversation');
  const deleteLabel = i18nService.t('deleteSession');
  const relativeTime = formatRelativeTime(session.updatedAt);
  const showRunningIndicator = session.status === 'running';
  const showUnreadIndicator = !showRunningIndicator && hasUnread;
  const showStatusIndicator = showRunningIndicator || showUnreadIndicator;
  const batchLabel = i18nService.t('batchOperations');
  const menuItems = useMemo(() => {
    const items = [
      { key: 'rename', label: renameLabel, onClick: handleRenameClick, tone: 'neutral' as const },
      { key: 'pin', label: pinButtonLabel, onClick: handleTogglePin, tone: 'neutral' as const },
      { key: 'delete', label: deleteLabel, onClick: handleDeleteClick, tone: 'danger' as const },
    ];
    if (showBatchOption) {
      items.unshift({ key: 'batch', label: batchLabel, onClick: handleBatchClick, tone: 'neutral' as const });
    }
    return items;
  }, [
    batchLabel,
    deleteLabel,
    handleBatchClick,
    handleDeleteClick,
    handleRenameClick,
    handleTogglePin,
    pinButtonLabel,
    renameLabel,
    showBatchOption,
  ]);

  return (
    <div
      onClick={() => {
        if (isRenaming) return;
        closeMenu();
        if (isBatchMode) {
          onToggleSelection();
          return;
        }
        onSelect();
      }}
      className={`group relative cursor-pointer overflow-hidden rounded-[22px] border px-3.5 py-3.5 transition-all duration-200 ${
        isActive
          ? 'border-white/[0.16] bg-white/[0.11] shadow-[0_18px_34px_rgba(0,0,0,0.16)]'
          : 'border-transparent bg-transparent hover:border-white/10 hover:bg-white/[0.06]'
      }`}
    >
      <div className={`pointer-events-none absolute inset-y-3 left-0 w-[3px] rounded-full transition-colors ${
        isActive
          ? 'bg-gradient-to-b from-amber-300 via-amber-200 to-transparent'
          : 'bg-transparent group-hover:from-sky-300/70 group-hover:via-white/40 group-hover:to-transparent'
      }`}
      />
      {/* Content area */}
      <div className="flex items-start">
        {isBatchMode && (
          <div className="flex items-center mr-2 mt-0.5 flex-shrink-0">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => {
                e.stopPropagation();
                onToggleSelection();
              }}
              onClick={(e) => e.stopPropagation()}
              className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 accent-primary cursor-pointer"
            />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className={`mb-1.5 flex items-center ${showStatusIndicator ? 'gap-1.5' : 'gap-0'}`}>
            {/* Status indicator */}
            {showStatusIndicator && (
              <span
                className={`block h-2 w-2 flex-shrink-0 rounded-full ${
                  showRunningIndicator ? 'animate-pulse' : ''
                } ${showRunningIndicator ? 'bg-amber-300' : 'bg-sky-300'}`}
                title={showRunningIndicator ? i18nService.t(statusLabels[session.status]) : undefined}
              />
            )}
            {isRenaming ? (
              <input
                ref={renameInputRef}
                value={renameValue}
                onChange={(event) => setRenameValue(event.target.value)}
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    handleRenameSave(event);
                  }
                  if (event.key === 'Escape') {
                    handleRenameCancel(event);
                  }
                }}
                onBlur={handleRenameBlur}
                className="flex-1 min-w-0 rounded-xl border border-white/10 bg-[#111c28] px-2.5 py-1.5 text-[13px] font-medium text-white focus:outline-none focus:ring-2 focus:ring-amber-300/40"
              />
            ) : (
              <h3 className="truncate pr-8 text-[13px] font-medium leading-5 text-white">
                {session.title}
              </h3>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-white/[0.58]">
            <span className="inline-flex whitespace-nowrap rounded-full border border-white/10 bg-white/[0.08] px-2 py-0.5 text-[10px] text-white/[0.58]" title={relativeTime.full}>
              {relativeTime.compact}
            </span>
            <span className="text-[10px] whitespace-nowrap text-white/[0.38]">
              {i18nService.t(statusLabels[session.status])}
            </span>
          </div>
        </div>
      </div>

      {/* Actions - absolutely positioned overlay */}
      {!isBatchMode && (
      <div
        className={`absolute right-1.5 top-1.5 transition-opacity ${
          isRenaming
            ? 'opacity-0 pointer-events-none'
            : session.pinned
              ? 'opacity-100'
              : 'opacity-0 group-hover:opacity-100'
        }`}
      >
        <button
          ref={actionButtonRef}
          onClick={openMenu}
          className="app-icon-btn-soft bg-transparent p-1 text-white/[0.65]"
          aria-label={actionLabel}
        >
          {session.pinned ? (
            <span className="relative block h-4 w-4">
              <PushPinIcon className="h-4 w-4 transition-opacity duration-150 group-hover:opacity-0" strokeWidth={2} />
              <EllipsisHorizontalIcon className="absolute inset-0 h-4 w-4 opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
            </span>
          ) : (
            <EllipsisHorizontalIcon className="h-4 w-4" />
          )}
        </button>
      </div>
      )}

      {menuPosition && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          className="fixed z-[9999] min-w-[180px] overflow-hidden rounded-2xl border border-white/10 bg-[#13202d] shadow-popover popover-enter"
          style={{ top: menuPosition.y, left: menuPosition.x }}
          role="menu"
        >
          {menuItems.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={item.onClick}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                item.tone === 'danger'
                  ? 'text-red-500 hover:bg-red-500/10'
                  : 'text-white hover:bg-white/10'
              }`}
            >
              {item.key === 'batch' && <ListChecksIcon className="h-4 w-4" />}
              {item.key === 'rename' && <PencilSquareIcon className="h-4 w-4" />}
              {item.key === 'pin' && (
                <PushPinIcon
                  slashed={session.pinned}
                  strokeWidth={2}
                  className={`h-4 w-4 ${session.pinned ? 'opacity-60' : ''}`}
                />
              )}
              {item.key === 'delete' && <TrashIcon className="h-4 w-4" />}
              {item.label}
            </button>
          ))}
        </div>,
        document.body
      )}

      {/* Delete Confirmation Modal */}
      {showConfirmDelete && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center modal-backdrop"
          onClick={handleCancelDelete}
        >
          <div
            className="app-modal-surface mx-4 w-full max-w-sm modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-5 py-4">
              <div className="rounded-full bg-red-100 p-2 dark:bg-red-900/30">
                <ExclamationTriangleIcon className="h-5 w-5 text-red-600 dark:text-red-500" />
              </div>
              <h2 className="text-base font-semibold text-text-primary dark:text-dark-text">
                {i18nService.t('deleteTaskConfirmTitle')}
              </h2>
            </div>

            <div className="px-5 pb-4">
              <p className="text-sm text-text-secondary dark:text-dark-text-secondary">
                {i18nService.t('deleteTaskConfirmMessage')}
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-border px-5 py-4 dark:border-dark-border">
              <button
                onClick={handleCancelDelete}
                className="rounded-lg px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-hover dark:text-dark-text-secondary dark:hover:bg-dark-surface-hover"
              >
                {i18nService.t('cancel')}
              </button>
              <button
                onClick={handleConfirmDelete}
                className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-600"
              >
                {i18nService.t('deleteSession')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default CoworkSessionItem;
