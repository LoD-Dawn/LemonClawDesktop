import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { coworkService } from '../services/cowork';
import { i18nService } from '../services/i18n';
import CoworkSessionList from './cowork/CoworkSessionList';
import ComposeIcon from './icons/ComposeIcon';
import ConnectorIcon from './icons/ConnectorIcon';
import SearchIcon from './icons/SearchIcon';
import ClockIcon from './icons/ClockIcon';
import PuzzleIcon from './icons/PuzzleIcon';
import SidebarToggleIcon from './icons/SidebarToggleIcon';
import TrashIcon from './icons/TrashIcon';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

interface SidebarProps {
  onShowSettings: () => void;
  onShowLogin?: () => void;
  activeView: 'cowork' | 'skills' | 'scheduledTasks' | 'mcp';
  onShowSkills: () => void;
  onShowCowork: () => void;
  onShowScheduledTasks: () => void;
  onOpenSearch: () => void;
  onShowMcp: () => void;
  onNewChat: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  updateBadge?: React.ReactNode;
  isEmbedded?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({
  onShowSettings,
  onShowLogin,
  activeView,
  onShowSkills,
  onShowCowork,
  onShowScheduledTasks,
  onOpenSearch,
  onShowMcp,
  onNewChat,
  isCollapsed,
  onToggleCollapse,
  updateBadge,
  isEmbedded = false,
}) => {
  const sessions = useSelector((state: RootState) => state.cowork.sessions);
  const currentSessionId = useSelector((state: RootState) => state.cowork.currentSessionId);
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const settingsMenuRef = useRef<HTMLDivElement | null>(null);
  const isMac = window.electron.platform === 'darwin';

  useEffect(() => {
    if (!isCollapsed) return;
    setIsBatchMode(false);
    setSelectedIds(new Set());
    setShowBatchDeleteConfirm(false);
    setShowSettingsMenu(false);
  }, [isCollapsed]);

  useEffect(() => {
    if (!showSettingsMenu) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!settingsMenuRef.current?.contains(event.target as Node)) {
        setShowSettingsMenu(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowSettingsMenu(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showSettingsMenu]);

  const handleSelectSession = async (sessionId: string) => {
    onShowCowork();
    await coworkService.loadSession(sessionId);
  };

  const handleDeleteSession = async (sessionId: string) => {
    await coworkService.deleteSession(sessionId);
  };

  const handleTogglePin = async (sessionId: string, pinned: boolean) => {
    await coworkService.setSessionPinned(sessionId, pinned);
  };

  const handleRenameSession = async (sessionId: string, title: string) => {
    await coworkService.renameSession(sessionId, title);
  };

  const handleEnterBatchMode = useCallback((sessionId: string) => {
    setIsBatchMode(true);
    setSelectedIds(new Set([sessionId]));
  }, []);

  const handleExitBatchMode = useCallback(() => {
    setIsBatchMode(false);
    setSelectedIds(new Set());
    setShowBatchDeleteConfirm(false);
  }, []);

  const handleToggleSelection = useCallback((sessionId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(sessionId)) {
        next.delete(sessionId);
      } else {
        next.add(sessionId);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedIds(prev => {
      if (prev.size === sessions.length) {
        return new Set();
      }
      return new Set(sessions.map(s => s.id));
    });
  }, [sessions]);

  const handleBatchDeleteClick = useCallback(() => {
    if (selectedIds.size === 0) return;
    setShowBatchDeleteConfirm(true);
  }, [selectedIds.size]);

  const handleBatchDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    await coworkService.deleteSessions(ids);
    handleExitBatchMode();
  }, [selectedIds, handleExitBatchMode]);

  const navButtonBase = 'w-full inline-flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200';
  const navButtonActive = 'bg-primary text-white shadow-subtle hover:bg-primary-light hover:shadow-card';
  const navButtonInactive = 'dark:text-dark-text-secondary text-text-secondary hover:text-text-primary dark:hover:text-dark-text hover:bg-surface-hover dark:hover:bg-dark-surface-hover';
  const sidebarBaseClass = 'shrink-0 dark:bg-dark-surface-muted/90 bg-surface/90 flex flex-col sidebar-transition overflow-hidden';
  const sidebarFrameClass = isEmbedded
    ? `${isCollapsed ? 'border-r-0' : 'border-r dark:border-dark-border/70 border-border/70'}`
    : 'border dark:border-dark-border/80 border-border/80 rounded-2xl shadow-card';

  return (
    <aside
      className={`${sidebarBaseClass} ${sidebarFrameClass} ${isCollapsed ? 'w-0 -translate-x-2 opacity-0 pointer-events-none' : 'w-64 translate-x-0 opacity-100'
        }`}
    >
      <div className="pt-3 pb-2">
        <div className="draggable sidebar-header-drag h-8 flex items-center justify-between px-3">
          <div className={`${isMac ? 'pl-[68px]' : ''}`}>
            {updateBadge}
          </div>
          <button
            type="button"
            onClick={onToggleCollapse}
            className="non-draggable app-icon-btn"
            aria-label={isCollapsed ? i18nService.t('expand') : i18nService.t('collapse')}
          >
            <SidebarToggleIcon className="h-4 w-4" isCollapsed={isCollapsed} />
          </button>
        </div>
        <div className="mt-3 space-y-1.5 px-3">
          <button
            type="button"
            onClick={onNewChat}
            className={`${navButtonBase} ${activeView === 'cowork'
              ? navButtonActive
              : navButtonInactive
              }`}
          >
            <ComposeIcon className="h-4 w-4" />
            {i18nService.t('newChat')}
          </button>
          <button
            type="button"
            onClick={onOpenSearch}
            className={`${navButtonBase} ${navButtonInactive}`}
          >
            <SearchIcon className="h-4 w-4" />
            {i18nService.t('search')}
          </button>
          <button
            type="button"
            onClick={onShowScheduledTasks}
            className={`${navButtonBase} ${activeView === 'scheduledTasks'
              ? navButtonActive
              : navButtonInactive
              }`}
          >
            <ClockIcon className="h-4 w-4" />
            {i18nService.t('scheduledTasks')}
          </button>
          <button
            type="button"
            onClick={onShowSkills}
            className={`${navButtonBase} ${activeView === 'skills'
              ? navButtonActive
              : navButtonInactive
              }`}
          >
            <PuzzleIcon className="h-4 w-4" />
            {i18nService.t('skills')}
          </button>
          <button
            type="button"
            onClick={onShowMcp}
            className={`${navButtonBase} ${activeView === 'mcp'
              ? navButtonActive
              : navButtonInactive
              }`}
          >
            <ConnectorIcon className="h-4 w-4" />
            {i18nService.t('mcpServers')}
          </button>
        </div>
      </div>
      <div className="mx-3 mb-3 h-px dark:bg-dark-border bg-border-light" />
      <div className="flex-1 overflow-y-auto px-2.5 pb-4">
        <div className="sticky top-0 z-[1] px-3 pb-2.5 pt-1 text-xs font-semibold tracking-wide uppercase dark:text-dark-text-secondary/90 text-text-secondary/90 dark:bg-dark-surface-muted/85 bg-surface/85 backdrop-blur-sm">
          {i18nService.t('coworkHistory')}
        </div>
        <CoworkSessionList
          sessions={sessions}
          currentSessionId={currentSessionId}
          isBatchMode={isBatchMode}
          selectedIds={selectedIds}
          onSelectSession={handleSelectSession}
          onDeleteSession={handleDeleteSession}
          onTogglePin={handleTogglePin}
          onRenameSession={handleRenameSession}
          onToggleSelection={handleToggleSelection}
          onEnterBatchMode={handleEnterBatchMode}
        />
      </div>
      {isBatchMode ? (
        <div className="px-3 pb-3 pt-2 flex items-center justify-between border-t dark:border-dark-border/80 border-border/80">
          <label className="flex items-center gap-2 cursor-pointer text-sm dark:text-dark-text-secondary text-text-secondary">
            <input
              type="checkbox"
              checked={selectedIds.size === sessions.length && sessions.length > 0}
              onChange={handleSelectAll}
              className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 accent-primary cursor-pointer"
            />
            {i18nService.t('batchSelectAll')}
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleBatchDeleteClick}
              disabled={selectedIds.size === 0}
              className={`inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${selectedIds.size > 0
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                }`}
            >
              <TrashIcon className="h-3.5 w-3.5" />
              {selectedIds.size > 0 ? `${selectedIds.size}` : ''}
            </button>
            <button
              type="button"
              onClick={handleExitBatchMode}
              className="px-3 py-1.5 text-sm font-medium rounded-xl dark:text-dark-text-secondary text-text-secondary hover:bg-surface-hover dark:hover:bg-dark-surface-hover transition-colors"
            >
              {i18nService.t('batchCancel')}
            </button>
          </div>
        </div>
      ) : (
        <div className="px-3 pb-3 pt-2 border-t dark:border-dark-border/80 border-border/80">
          <div className="relative" ref={settingsMenuRef}>
            <button
              type="button"
              onClick={() => setShowSettingsMenu(prev => !prev)}
              className={`${navButtonBase} ${navButtonInactive} justify-between`}
              aria-label={i18nService.t('settings')}
              aria-haspopup="menu"
              aria-expanded={showSettingsMenu}
            >
              <span className="inline-flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M14 17H5" /><path d="M19 7h-9" /><circle cx="17" cy="17" r="3" /><circle cx="7" cy="7" r="3" /></svg>
                {i18nService.t('settings')}
              </span>

            </button>
            {showSettingsMenu && (
              <div className="absolute bottom-full left-0 z-20 mb-2 w-56 overflow-hidden rounded-2xl border dark:border-dark-border/80 border-border/80 dark:bg-dark-surface bg-surface shadow-[0_16px_40px_rgba(15,23,42,0.18)] backdrop-blur-xl">
                <div className="px-4 pb-2 pt-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full dark:bg-dark-surface-hover bg-surface-hover dark:text-dark-text-secondary text-text-secondary">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                        <path d="M20 21a8 8 0 0 0-16 0" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                    </div>
                    <div className="text-sm font-medium">
                      <span className="dark:text-dark-text-secondary text-text-secondary">中科闻歌-xx</span>
                    </div>
                  </div>
                </div>
                <div className="mx-3 h-px dark:bg-dark-border/80 bg-border/80" />
                <div className="p-1.5" role="menu" aria-label={i18nService.t('settings')}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowSettingsMenu(false);
                      onShowSettings();
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium dark:text-dark-text text-text-primary hover:bg-surface-hover dark:hover:bg-dark-surface-hover transition-colors"
                    role="menuitem"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-current"><path d="M14 17H5" /><path d="M19 7h-9" /><circle cx="17" cy="17" r="3" /><circle cx="7" cy="7" r="3" /></svg>
                    {i18nService.t('settings')}
                  </button>
                  {onShowLogin && (
                    <button
                      id="btn-logout"
                      type="button"
                      onClick={() => {
                        setShowSettingsMenu(false);
                        void onShowLogin();
                      }}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium dark:text-dark-text text-text-primary hover:bg-surface-hover dark:hover:bg-dark-surface-hover transition-colors"
                      aria-label={i18nService.t('logout')}
                      role="menuitem"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                        <polyline points="16 17 21 12 16 7" />
                        <line x1="21" y1="12" x2="9" y2="12" />
                      </svg>
                      {i18nService.t('logout')}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Batch Delete Confirmation Modal */}
      {showBatchDeleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop"
          onClick={() => setShowBatchDeleteConfirm(false)}
        >
          <div
            className="app-modal-surface w-full max-w-sm mx-4 modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-5 py-4">
              <div className="p-2 rounded-full bg-red-100 dark:bg-red-900/30">
                <ExclamationTriangleIcon className="h-5 w-5 text-red-600 dark:text-red-500" />
              </div>
              <h2 className="text-base font-semibold dark:text-dark-text text-text-primary">
                {i18nService.t('batchDeleteConfirmTitle')}
              </h2>
            </div>
            <div className="px-5 pb-4">
              <p className="text-sm dark:text-dark-text-secondary text-text-secondary">
                {i18nService.t('batchDeleteConfirmMessage').replace('{count}', String(selectedIds.size))}
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 px-5 py-4 border-t dark:border-dark-border border-border">
              <button
                onClick={() => setShowBatchDeleteConfirm(false)}
                className="px-4 py-2 text-sm font-medium rounded-lg dark:text-dark-text-secondary text-text-secondary dark:hover:bg-dark-surface-hover hover:bg-surface-hover transition-colors"
              >
                {i18nService.t('cancel')}
              </button>
              <button
                onClick={handleBatchDelete}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors"
              >
                {i18nService.t('batchDelete')} ({selectedIds.size})
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;

