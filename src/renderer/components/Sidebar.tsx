import React, { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { coworkService } from '../services/cowork';
import { i18nService, type LanguageType } from '../services/i18n';
import CoworkSessionList from './cowork/CoworkSessionList';
import ComposeIcon from './icons/ComposeIcon';
import ConnectorIcon from './icons/ConnectorIcon';
import SidebarToggleIcon from './icons/SidebarToggleIcon';
import TrashIcon from './icons/TrashIcon';
import {
  AdjustmentsHorizontalIcon,
  ArrowRightOnRectangleIcon,
  CheckIcon,
  ChevronRightIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  GlobeAltIcon,
  MagnifyingGlassIcon,
  PuzzlePieceIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';


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
  const authUser = useSelector((state: RootState) => state.auth.user);
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState<LanguageType>(i18nService.getLanguage());
  const settingsMenuRef = useRef<HTMLDivElement | null>(null);
  const isMac = window.electron.platform === 'darwin';

  useEffect(() => {
    if (!isCollapsed) return;
    setIsBatchMode(false);
    setSelectedIds(new Set());
    setShowBatchDeleteConfirm(false);
    setShowSettingsMenu(false);
    setShowLanguageMenu(false);
  }, [isCollapsed]);

  useEffect(() => {
    if (!showSettingsMenu) {
      setShowLanguageMenu(false);
    }
  }, [showSettingsMenu]);

  useEffect(() => {
    return i18nService.subscribe(() => {
      setCurrentLanguage(i18nService.getLanguage());
    });
  }, []);

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

  const navButtonBase = 'w-full inline-flex items-center gap-3 rounded-[24px] px-4 py-3.5 text-sm font-medium transition-all duration-200';
  const navButtonActive = 'bg-gradient-to-r from-primary via-primary to-primary-light text-white shadow-card hover:shadow-card-hover';
  const navButtonInactive = 'dark:text-dark-text-secondary text-text-secondary hover:text-text-primary dark:hover:text-dark-text hover:bg-white/70 dark:hover:bg-dark-surface-hover/80 hover:shadow-subtle';
  const secondaryNavButtonBase = 'w-full inline-flex items-center gap-3 rounded-[22px] px-3.5 py-3 text-sm transition-all duration-200';
  const secondaryNavButtonActive = 'bg-white/80 dark:bg-dark-surface-hover/85 text-text-primary dark:text-dark-text shadow-subtle';
  const secondaryNavButtonInactive = 'dark:text-dark-text-secondary text-text-secondary hover:bg-white/72 dark:hover:bg-dark-surface-hover/75 hover:text-text-primary dark:hover:text-dark-text';
  const sidebarBaseClass = 'relative shrink-0 dark:bg-dark-surface-muted/45 bg-white/28 flex flex-col sidebar-transition overflow-hidden backdrop-blur-xl';
  const sidebarFrameClass = isEmbedded
    ? `${isCollapsed ? 'border-r-0' : 'border-r dark:border-dark-border/70 border-border/70'}`
    : 'border dark:border-dark-border/80 border-border/80 rounded-[28px] shadow-card';
  const languageOptions: Array<{ value: LanguageType; label: string }> = [
    { value: 'zh', label: i18nService.t('chinese') },
    { value: 'en', label: i18nService.t('english') },
  ];
  const organizationLabel = authUser?.organization?.name || authUser?.organization?.path;
  const displayUserName = authUser
    ? [organizationLabel, authUser.name].filter((value): value is string => typeof value === 'string' && value.trim().length > 0).join('-')
    : '';

  const handleLanguageChange = useCallback((nextLanguage: LanguageType) => {
    setCurrentLanguage(nextLanguage);
    i18nService.setLanguage(nextLanguage, { persist: true });
  }, []);

  return (
    <aside
      className={`${sidebarBaseClass} ${sidebarFrameClass} ${isCollapsed ? 'w-0 -translate-x-2 opacity-0 pointer-events-none' : 'w-64 translate-x-0 opacity-100'
        }`}
    >
      <div className="px-3 pb-2 pt-3">
        <div className="draggable sidebar-header-drag h-8 flex items-center justify-between">
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
        <div className="brand-soft-panel brand-glow mt-3 px-4 py-4">
          <div className="soft-pill w-fit">
            <span className="h-1.5 w-1.5 rounded-full bg-secondary" />
            LemonClaw
          </div>
          <div className="mt-4 space-y-1.5">
            <div className="brand-title text-[22px] font-semibold text-text-primary dark:text-dark-text">LemonClaw</div>
            <p className="text-xs leading-5 text-text-secondary dark:text-dark-text-secondary">
              {i18nService.t('coworkSidebarTagline')}
            </p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="soft-pill">AI</span>
            <span className="soft-pill">{i18nService.t('coworkSidebarAutomation')}</span>
          </div>
        </div>
        <div className="mt-3 space-y-3">
          <div className="comfort-card p-2.5">
            <div className="px-2 pb-2 pt-1 text-[11px] font-semibold tracking-[0.18em] uppercase text-text-secondary/85 dark:text-dark-text-secondary/85">
              {i18nService.t('coworkPrimarySectionTitle')}
            </div>
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={onNewChat}
                className={`${navButtonBase} ${activeView === 'cowork'
                  ? navButtonActive
                  : navButtonInactive
                  }`}
              >
                <ComposeIcon className="h-4 w-4" />
                {i18nService.t('startConversation')}
              </button>
              <button
                type="button"
                onClick={onOpenSearch}
                className={`${navButtonBase} ${navButtonInactive}`}
              >
                <MagnifyingGlassIcon className="h-4 w-4" />
                {i18nService.t('searchHistory')}
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
                {i18nService.t('coworkSidebarAutomation')}
              </button>
            </div>
          </div>

          <div className="comfort-card p-2.5">
            <div className="px-2 pb-2 pt-1 text-[11px] font-semibold tracking-[0.18em] uppercase text-text-secondary/80 dark:text-dark-text-secondary/80">
              {i18nService.t('coworkAdvancedSectionTitle')}
            </div>
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={onShowSkills}
                className={`${secondaryNavButtonBase} ${activeView === 'skills'
                  ? secondaryNavButtonActive
                  : secondaryNavButtonInactive
                  }`}
              >
                <PuzzlePieceIcon className="h-4 w-4" />
                {i18nService.t('coworkSidebarSkills')}
              </button>
              <button
                type="button"
                onClick={onShowMcp}
                className={`${secondaryNavButtonBase} ${activeView === 'mcp'
                  ? secondaryNavButtonActive
                  : secondaryNavButtonInactive
                  }`}
              >
                <ConnectorIcon className="h-4 w-4" />
                {i18nService.t('coworkSidebarConnections')}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="mx-3 mb-3 h-px dark:bg-dark-border/70 bg-border-light/90" />
      <div className="flex-1 overflow-y-auto px-2.5 pb-4">
        <div className="sticky top-0 z-[1] mb-2 rounded-full px-3 py-2 text-[11px] font-semibold tracking-[0.18em] dark:text-dark-text-secondary/90 text-text-secondary/90 dark:bg-dark-surface-muted/70 bg-white/70 backdrop-blur-md">
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
              className="px-3 py-1.5 text-sm font-medium rounded-2xl dark:text-dark-text-secondary text-text-secondary hover:bg-surface-hover dark:hover:bg-dark-surface-hover transition-colors"
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
                <AdjustmentsHorizontalIcon className="h-4 w-4" />
                {i18nService.t('settings')}
              </span>
            </button>
            {showSettingsMenu && (
              <div className="absolute bottom-full left-0 z-20 mb-2 w-56 overflow-hidden rounded-[26px] border dark:border-dark-border/80 border-border/80 dark:bg-dark-surface bg-surface shadow-popover backdrop-blur-xl">
                <div className="px-4 pb-2 pt-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full dark:bg-dark-surface-hover bg-surface-hover dark:text-dark-text-secondary text-text-secondary">
                      <UserCircleIcon className="h-4 w-4" />
                    </div>
                    <div className="text-sm font-medium">
                      <span className="dark:text-dark-text-secondary text-text-secondary">{displayUserName || authUser?.name || "-"}</span>
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
                    <AdjustmentsHorizontalIcon className="h-4 w-4 text-current" />
                    {i18nService.t('settings')}
                  </button>
                  <div className="my-1">
                    <button
                      type="button"
                      onClick={() => setShowLanguageMenu(prev => !prev)}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                        showLanguageMenu
                          ? 'dark:bg-dark-surface-hover bg-surface-hover dark:text-dark-text text-text-primary'
                          : 'dark:text-dark-text text-text-primary hover:bg-surface-hover dark:hover:bg-dark-surface-hover'
                      }`}
                      aria-expanded={showLanguageMenu}
                      aria-haspopup="true"
                      role="menuitem"
                    >
                      <GlobeAltIcon className="h-4 w-4" />
                      <span className="flex-1 text-left">{i18nService.t('language')}</span>
                      <span className="text-xs dark:text-dark-text-secondary text-text-secondary">
                        {languageOptions.find((option) => option.value === currentLanguage)?.label}
                      </span>
                      <ChevronRightIcon className={`h-4 w-4 transition-transform ${showLanguageMenu ? 'rotate-90' : ''}`} />
                    </button>
                    {showLanguageMenu && (
                      <div className="mt-1 space-y-1 px-1 pb-1">
                        {languageOptions.map((option) => {
                          const selected = option.value === currentLanguage;
                          return (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => handleLanguageChange(option.value)}
                              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                                selected
                                  ? 'dark:text-dark-text text-text-primary hover:bg-surface-hover dark:hover:bg-dark-surface-hover'
                                  : 'dark:text-dark-text-secondary text-text-secondary hover:bg-surface-hover dark:hover:bg-dark-surface-hover'
                              }`}
                              role="menuitemradio"
                              aria-checked={selected}
                            >
                              <span className="flex-1 text-left">{option.label}</span>
                              <span className={`text-primary transition-opacity ${selected ? 'opacity-100' : 'opacity-0'}`}>
                                <CheckIcon className="h-4 w-4 stroke-[2.5]" />
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <div className="mx-3 my-1 h-px dark:bg-dark-border/80 bg-border/80" />
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
                      <ArrowRightOnRectangleIcon className="h-4 w-4" />
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
      {showBatchDeleteConfirm && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center modal-backdrop"
          onClick={() => setShowBatchDeleteConfirm(false)}
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
                {i18nService.t('batchDeleteConfirmTitle')}
              </h2>
            </div>
            <div className="px-5 pb-4">
              <p className="text-sm text-text-secondary dark:text-dark-text-secondary">
                {i18nService.t('batchDeleteConfirmMessage').replace('{count}', String(selectedIds.size))}
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-border px-5 py-4 dark:border-dark-border">
              <button
                onClick={() => setShowBatchDeleteConfirm(false)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-hover dark:text-dark-text-secondary dark:hover:bg-dark-surface-hover"
              >
                {i18nService.t('cancel')}
              </button>
              <button
                onClick={handleBatchDelete}
                className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-600"
              >
                {i18nService.t('batchDelete')} ({selectedIds.size})
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </aside>
  );
};

export default Sidebar;

