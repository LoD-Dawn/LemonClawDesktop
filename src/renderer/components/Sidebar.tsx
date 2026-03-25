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

  const navButtonBase = 'codex-nav-btn';
  const navButtonActive = 'codex-nav-btn-active';
  const navButtonInactive = 'codex-nav-btn-idle';
  const secondaryNavButtonBase = 'codex-nav-btn';
  const secondaryNavButtonActive = 'codex-nav-btn-active';
  const secondaryNavButtonInactive = 'codex-nav-btn-idle';
  const pinnedSessionsCount = sessions.filter((session) => session.pinned).length;
  const sidebarBaseClass = 'relative shrink-0 flex flex-col sidebar-transition overflow-hidden bg-[#0d1620] text-slate-100';
  const sidebarFrameClass = isEmbedded
    ? `${isCollapsed ? 'border-r-0' : 'border-r border-white/10'}`
    : 'border border-white/10 rounded-[32px] shadow-[0_26px_64px_rgba(0,0,0,0.22)]';
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
      className={`${sidebarBaseClass} ${sidebarFrameClass} ${isCollapsed ? 'w-0 -translate-x-2 opacity-0 pointer-events-none' : 'w-[304px] translate-x-0 opacity-100'
        }`}
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="desktop-shell-grid absolute inset-x-0 top-0 h-40 opacity-30" />
        <div className="absolute left-[-90px] top-[120px] h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(255,210,95,0.14)_0%,rgba(255,210,95,0)_72%)]" />
        <div className="absolute bottom-[-70px] right-[-50px] h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(120,164,205,0.18)_0%,rgba(120,164,205,0)_72%)]" />
      </div>

      <div className="relative px-4 pb-3 pt-4">
        <div className="draggable sidebar-header-drag flex h-10 items-center justify-between">
          <div className={`min-w-0 ${isMac ? 'pl-[68px]' : ''}`}>
            <div className="codex-kicker text-white/[0.45]">Personal AI Desk</div>
            <div className="font-display truncate text-[24px] font-semibold tracking-[-0.06em] text-white">
              LemonClaw
            </div>
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

        <div className="mt-4 space-y-4">
          <div>
            <div className="app-section-label px-2 text-white/[0.32]">
              {i18nService.t('coworkPrimarySectionTitle')}
            </div>
            <div className="mt-2 space-y-1.5">
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
          <div className="flex flex-wrap gap-2 px-1">
            <span className="soft-pill border-white/10 bg-white/[0.08] text-white/[0.72]">
              {sessions.length} 条记录
            </span>
            <span className="soft-pill border-white/10 bg-white/[0.08] text-white/[0.72]">
              已固定 {pinnedSessionsCount}
            </span>
            {organizationLabel && (
              <span className="soft-pill border-white/10 bg-white/[0.08] text-white/[0.72]">
                {organizationLabel}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="relative mx-4 mb-3 h-px bg-white/10" />
      <div className="relative flex-1 overflow-y-auto px-3 pb-4">
        <div className="rounded-[28px] border border-white/10 bg-white/5 p-2 backdrop-blur-xl">
          <div className="sticky top-0 z-[1] mb-1.5 flex items-center justify-between rounded-[20px] bg-[#101925]/90 px-3 py-2 backdrop-blur-xl">
            <div className="app-section-label text-white/[0.34]">
              {i18nService.t('coworkHistory')}
            </div>
            {!isBatchMode && updateBadge ? <div className="non-draggable">{updateBadge}</div> : null}
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
      </div>
      {!isBatchMode && (
        <div className="relative border-t border-white/10 px-4 py-3">
          <div className="app-section-label px-1 text-white/[0.32]">
            {i18nService.t('coworkAdvancedSectionTitle')}
          </div>
          <div className="mt-2 space-y-1.5">
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
      )}
      {isBatchMode ? (
        <div className="relative flex items-center justify-between border-t border-white/10 px-4 pb-4 pt-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
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
                : 'bg-white/10 text-white/[0.35] cursor-not-allowed'
                }`}
            >
              <TrashIcon className="h-3.5 w-3.5" />
              {selectedIds.size > 0 ? `${selectedIds.size}` : ''}
            </button>
            <button
              type="button"
              onClick={handleExitBatchMode}
              className="rounded-2xl px-3 py-1.5 text-sm font-medium text-slate-300 transition-colors hover:bg-white/10"
            >
              {i18nService.t('batchCancel')}
            </button>
          </div>
        </div>
      ) : (
        <div className="relative border-t border-white/10 px-4 pb-4 pt-3">
          <div className="relative" ref={settingsMenuRef}>
            <button
              type="button"
              onClick={() => setShowSettingsMenu(prev => !prev)}
              className="flex w-full items-center gap-3 rounded-[24px] border border-white/10 bg-white/5 px-3 py-3 text-left transition-colors duration-150 hover:bg-white/10"
              aria-label={i18nService.t('settings')}
              aria-haspopup="menu"
              aria-expanded={showSettingsMenu}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] bg-white/10 text-white">
                <AdjustmentsHorizontalIcon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-white">
                  {displayUserName || authUser?.name || 'LemonClaw'}
                </span>
                <span className="block truncate text-xs text-white/[0.46]">
                  {i18nService.t('settings')}
                </span>
              </span>
              <ChevronRightIcon className={`h-4 w-4 shrink-0 text-white/[0.42] transition-transform ${showSettingsMenu ? 'rotate-90' : ''}`} />
            </button>
            {showSettingsMenu && (
              <div className="absolute bottom-full left-0 z-20 mb-2 w-56 overflow-hidden rounded-[24px] border border-white/10 bg-[#13202d] shadow-popover">
                <div className="px-4 pb-2 pt-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/70">
                      <UserCircleIcon className="h-4 w-4" />
                    </div>
                    <div className="text-sm font-medium">
                      <span className="text-white/[0.72]">{displayUserName || authUser?.name || "-"}</span>
                    </div>
                  </div>
                </div>
                <div className="mx-3 h-px bg-white/10" />
                <div className="p-1.5" role="menu" aria-label={i18nService.t('settings')}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowSettingsMenu(false);
                      onShowSettings();
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/10"
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
                          ? 'bg-white/10 text-white'
                          : 'text-white hover:bg-white/10'
                      }`}
                      aria-expanded={showLanguageMenu}
                      aria-haspopup="true"
                      role="menuitem"
                    >
                      <GlobeAltIcon className="h-4 w-4" />
                      <span className="flex-1 text-left">{i18nService.t('language')}</span>
                      <span className="text-xs text-white/[0.52]">
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
                                  ? 'text-white hover:bg-white/10'
                                  : 'text-white/[0.62] hover:bg-white/10'
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
                  <div className="mx-3 my-1 h-px bg-white/10" />
                  {onShowLogin && (
                    <button
                      id="btn-logout"
                      type="button"
                      onClick={() => {
                        setShowSettingsMenu(false);
                        void onShowLogin();
                      }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/10"
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
