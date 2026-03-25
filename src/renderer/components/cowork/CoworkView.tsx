import React, { useEffect, useState, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../store';
import { clearCurrentSession, setCurrentSession, setStreaming } from '../../store/slices/coworkSlice';
import { clearActiveSkills, setActiveSkillIds } from '../../store/slices/skillSlice';
import { setActions, selectAction, clearSelection } from '../../store/slices/quickActionSlice';
import { coworkService } from '../../services/cowork';
import { skillService } from '../../services/skill';
import { quickActionService } from '../../services/quickAction';
import { i18nService } from '../../services/i18n';
import CoworkPromptInput, { type CoworkPromptInputRef } from './CoworkPromptInput';
import CoworkSessionDetail from './CoworkSessionDetail';
import ModelSelector from '../ModelSelector';
import SidebarToggleIcon from '../icons/SidebarToggleIcon';
import ComposeIcon from '../icons/ComposeIcon';
import WindowTitleBar from '../window/WindowTitleBar';
import { QuickActionBar, PromptPanel } from '../quick-actions';
import type { SettingsOpenOptions } from '../Settings';
import type { CoworkSession, CoworkImageAttachment, CoworkSessionSummary } from '../../types/cowork';

export interface CoworkViewProps {
  onRequestAppSettings?: (options?: SettingsOpenOptions) => void;
  onShowSkills?: () => void;
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
  onNewChat?: () => void;
  updateBadge?: React.ReactNode;
}

const CoworkView: React.FC<CoworkViewProps> = ({ onRequestAppSettings, onShowSkills, isSidebarCollapsed, onToggleSidebar, onNewChat, updateBadge }) => {
  const dispatch = useDispatch();
  const isMac = window.electron.platform === 'darwin';
  const [isInitialized, setIsInitialized] = useState(false);
  // Track if we're starting a session to prevent duplicate submissions
  const isStartingRef = useRef(false);
  // Track pending start request so stop can cancel delayed startup.
  const pendingStartRef = useRef<{ requestId: number; cancelled: boolean } | null>(null);
  const startRequestIdRef = useRef(0);
  // Ref for CoworkPromptInput
  const promptInputRef = useRef<CoworkPromptInputRef>(null);

  const {
    currentSession,
    isStreaming,
    config,
    sessions,
  } = useSelector((state: RootState) => state.cowork);

  const activeSkillIds = useSelector((state: RootState) => state.skill.activeSkillIds);
  const skills = useSelector((state: RootState) => state.skill.skills);
  const quickActions = useSelector((state: RootState) => state.quickAction.actions);
  const selectedActionId = useSelector((state: RootState) => state.quickAction.selectedActionId);
  const selectedModel = useSelector((state: RootState) => state.model.selectedModel);

  const buildApiConfigNotice = (error?: string) => {
    const baseNotice = i18nService.t('coworkModelSettingsRequired');
    if (!error) {
      return baseNotice;
    }
    const normalizedError = error.trim();
    if (
      normalizedError.startsWith('No enabled provider found for model:')
      || normalizedError === 'No available model configured in enabled providers.'
    ) {
      return baseNotice;
    }
    return `${baseNotice} (${error})`;
  };

  useEffect(() => {
    const init = async () => {
      await coworkService.init();
      // Load quick actions with localization
      try {
        quickActionService.initialize();
        const actions = await quickActionService.getLocalizedActions();
        dispatch(setActions(actions));
      } catch (error) {
        console.error('Failed to load quick actions:', error);
      }
      try {
        const apiConfig = await coworkService.checkApiConfig();
        if (apiConfig && !apiConfig.hasConfig) {
          onRequestAppSettings?.({
            initialTab: 'model',
            notice: buildApiConfigNotice(apiConfig.error),
          });
        }
      } catch (error) {
        console.error('Failed to check cowork API config:', error);
      }
      setIsInitialized(true);
    };
    init();

    // Subscribe to language changes to reload quick actions
    const unsubscribe = quickActionService.subscribe(async () => {
      try {
        const actions = await quickActionService.getLocalizedActions();
        dispatch(setActions(actions));
      } catch (error) {
        console.error('Failed to reload quick actions:', error);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [dispatch]);

  const handleStartSession = async (prompt: string, skillPrompt?: string, imageAttachments?: CoworkImageAttachment[]) => {
    // Prevent duplicate submissions
    if (isStartingRef.current) return;
    isStartingRef.current = true;
    const requestId = ++startRequestIdRef.current;
    pendingStartRef.current = { requestId, cancelled: false };
    const isPendingStartCancelled = () => {
      const pending = pendingStartRef.current;
      return !pending || pending.requestId !== requestId || pending.cancelled;
    };

    try {
      try {
        const apiConfig = await coworkService.checkApiConfig();
        if (apiConfig && !apiConfig.hasConfig) {
          onRequestAppSettings?.({
            initialTab: 'model',
            notice: buildApiConfigNotice(apiConfig.error),
          });
          isStartingRef.current = false;
          return;
        }
      } catch (error) {
        console.error('Failed to check cowork API config:', error);
      }

      // Create a temporary session with user message to show immediately
      const tempSessionId = `temp-${Date.now()}`;
      const fallbackTitle = prompt.split('\n')[0].slice(0, 50) || i18nService.t('coworkNewSession');
      const now = Date.now();

      // Capture active skill IDs before clearing them
      const sessionSkillIds = [...activeSkillIds];

      const tempSession: CoworkSession = {
        id: tempSessionId,
        title: fallbackTitle,
        claudeSessionId: null,
        status: 'running',
        pinned: false,
        createdAt: now,
        updatedAt: now,
        cwd: config.workingDirectory || '',
        systemPrompt: '',
        executionMode: config.executionMode || 'local',
        activeSkillIds: sessionSkillIds,
        messages: [
          {
            id: `msg-${now}`,
            type: 'user',
            content: prompt,
            timestamp: now,
            metadata: (sessionSkillIds.length > 0 || (imageAttachments && imageAttachments.length > 0))
              ? {
                ...(sessionSkillIds.length > 0 ? { skillIds: sessionSkillIds } : {}),
                ...(imageAttachments && imageAttachments.length > 0 ? { imageAttachments } : {}),
              }
              : undefined,
          },
        ],
      };

      // Immediately show the session detail page with user message
      dispatch(setCurrentSession(tempSession));
      dispatch(setStreaming(true));

      // Clear active skills and quick action selection after starting session
      // so they don't persist to next session
      dispatch(clearActiveSkills());
      dispatch(clearSelection());

      // Combine skill prompt with system prompt
      // If no manual skill selected, use auto-routing prompt
      let effectiveSkillPrompt = skillPrompt;
      if (!skillPrompt) {
        effectiveSkillPrompt = await skillService.getAutoRoutingPrompt() || undefined;
      }
      const combinedSystemPrompt = [effectiveSkillPrompt, config.systemPrompt]
        .filter(p => p?.trim())
        .join('\n\n') || undefined;

      // Start the actual session immediately with fallback title
      const startedSession = await coworkService.startSession({
        prompt,
        title: fallbackTitle,
        cwd: config.workingDirectory || undefined,
        systemPrompt: combinedSystemPrompt,
        activeSkillIds: sessionSkillIds,
        imageAttachments,
      });

      // Generate title in the background and update when ready
      if (startedSession) {
        coworkService.generateSessionTitle(prompt).then(generatedTitle => {
          const betterTitle = generatedTitle?.trim();
          if (betterTitle && betterTitle !== fallbackTitle) {
            coworkService.renameSession(startedSession.id, betterTitle);
          }
        }).catch(error => {
          console.error('Failed to generate cowork session title:', error);
        });
      }

      // Stop immediately if user cancelled while startup request was in flight.
      if (isPendingStartCancelled() && startedSession) {
        await coworkService.stopSession(startedSession.id);
      }
    } finally {
      if (pendingStartRef.current?.requestId === requestId) {
        pendingStartRef.current = null;
      }
      isStartingRef.current = false;
    }
  };

  const handleContinueSession = async (prompt: string, skillPrompt?: string, imageAttachments?: CoworkImageAttachment[]) => {
    if (!currentSession) return;

    console.log('[CoworkView] handleContinueSession called', {
      hasImageAttachments: !!imageAttachments,
      imageAttachmentsCount: imageAttachments?.length ?? 0,
      imageAttachmentsNames: imageAttachments?.map(a => a.name),
      imageAttachmentsBase64Lengths: imageAttachments?.map(a => a.base64Data.length),
    });

    // Capture active skill IDs before clearing
    const sessionSkillIds = [...activeSkillIds];

    // Clear active skills after capturing so they don't persist to next message
    if (sessionSkillIds.length > 0) {
      dispatch(clearActiveSkills());
    }

    // Combine skill prompt with system prompt for continuation
    // If no manual skill selected, use auto-routing prompt
    let effectiveSkillPrompt = skillPrompt;
    if (!skillPrompt) {
      effectiveSkillPrompt = await skillService.getAutoRoutingPrompt() || undefined;
    }
    const combinedSystemPrompt = [effectiveSkillPrompt, config.systemPrompt]
      .filter(p => p?.trim())
      .join('\n\n') || undefined;

    await coworkService.continueSession({
      sessionId: currentSession.id,
      prompt,
      systemPrompt: combinedSystemPrompt,
      activeSkillIds: sessionSkillIds.length > 0 ? sessionSkillIds : undefined,
      imageAttachments,
    });
  };

  const handleStopSession = async () => {
    if (!currentSession) return;
    if (currentSession.id.startsWith('temp-') && pendingStartRef.current) {
      pendingStartRef.current.cancelled = true;
    }
    await coworkService.stopSession(currentSession.id);
  };

  // Get selected quick action
  const selectedAction = React.useMemo(() => {
    return quickActions.find(action => action.id === selectedActionId);
  }, [quickActions, selectedActionId]);

  // Handle quick action button click: select action + activate skill in one batch
  const handleActionSelect = (actionId: string) => {
    dispatch(selectAction(actionId));
    const action = quickActions.find(a => a.id === actionId);
    if (action) {
      const targetSkill = skills.find(s => s.id === action.skillMapping);
      if (targetSkill) {
        dispatch(setActiveSkillIds([targetSkill.id]));
      }
    }
  };

  // When the mapped skill is deactivated from input area, restore the QuickActionBar
  useEffect(() => {
    if (!selectedActionId) return;
    const action = quickActions.find(a => a.id === selectedActionId);
    if (action) {
      const skillStillActive = activeSkillIds.includes(action.skillMapping);
      if (!skillStillActive) {
        dispatch(clearSelection());
      }
    }
  }, [activeSkillIds]);

  // Handle prompt selection from QuickAction
  const handleQuickActionPromptSelect = (prompt: string) => {
    // Fill the prompt into input
    promptInputRef.current?.setValue(prompt);
    promptInputRef.current?.focus();
  };

  const workspaceName = config.workingDirectory?.split(/[\\/]/).filter(Boolean).pop() || 'lemon-claw-desktop';
  const pinnedSessionsCount = React.useMemo(
    () => sessions.filter((session) => session.pinned).length,
    [sessions],
  );
  const latestSession = React.useMemo(
    () => sessions.reduce<CoworkSessionSummary | null>((latest, session) => {
      if (!latest || session.updatedAt > latest.updatedAt) {
        return session;
      }
      return latest;
    }, null),
    [sessions],
  );
  const recentSessions = React.useMemo(
    () => [...sessions].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 4),
    [sessions],
  );

  const handleOpenRecentSession = async (sessionId: string) => {
    await coworkService.loadSession(sessionId);
  };

  useEffect(() => {
    const handleNewSession = () => {
      dispatch(clearCurrentSession());
      dispatch(clearSelection());
      window.dispatchEvent(new CustomEvent('cowork:focus-input', {
        detail: { clear: true },
      }));
    };
    window.addEventListener('cowork:shortcut:new-session', handleNewSession);
    return () => {
      window.removeEventListener('cowork:shortcut:new-session', handleNewSession);
    };
  }, [dispatch]);

  if (!isInitialized) {
    return (
      <div className="flex-1 h-full flex flex-col dark:bg-dark-bg bg-page">
        <div className="app-topbar">
          <div className="app-topbar-inner">
            <div />
            <WindowTitleBar inline />
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="dark:text-dark-text-secondary text-text-secondary">
            {i18nService.t('loading')}
          </div>
        </div>
      </div>
    );
  }

  // When there's a current session, show the session detail view
  if (currentSession) {
    return (
      <>
        <CoworkSessionDetail
          onManageSkills={() => onShowSkills?.()}
          onContinue={handleContinueSession}
          onStop={handleStopSession}
          onNavigateHome={() => dispatch(clearCurrentSession())}
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebar={onToggleSidebar}
          onNewChat={onNewChat}
          updateBadge={updateBadge}
        />
      </>
    );
  }

  // Home view - no current session
  return (
    <div className="flex-1 flex flex-col dark:bg-dark-bg bg-page h-full">
      {/* Header */}
      <div className="app-topbar">
        <div className="app-topbar-inner">
          <div className="non-draggable h-8 flex items-center">
          {isSidebarCollapsed && (
            <div className={`flex items-center gap-1 mr-2 ${isMac ? 'pl-[68px]' : ''}`}>
              <button
                type="button"
                onClick={onToggleSidebar}
                className="app-icon-btn"
              >
                <SidebarToggleIcon className="h-4 w-4" isCollapsed={true} />
              </button>
              <button
                type="button"
                onClick={onNewChat}
                className="app-icon-btn"
              >
                <ComposeIcon className="h-4 w-4" />
              </button>
              {updateBadge}
            </div>
          )}
          <ModelSelector />
          </div>
          <WindowTitleBar inline />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 scroll-smooth">
        <div className="relative mx-auto flex min-h-full w-full max-w-5xl flex-col px-4 pb-10 pt-6 md:px-8 md:pb-12">
          <div className="absolute inset-x-4 top-6 h-40 rounded-[40px] bg-[radial-gradient(circle_at_top_left,rgba(255,214,98,0.16),transparent_56%)] blur-2xl md:inset-x-8" />
          <div className="relative flex flex-1 flex-col gap-5 animate-fade-in-up">
            <section className="editorial-hero-panel p-6 md:p-7">
              <div className="desktop-shell-grid pointer-events-none absolute inset-x-6 top-0 h-28 opacity-35" />
              <div className="relative z-[1] space-y-6">
                <div className="space-y-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="desktop-eyebrow">Cowork</span>
                    {sessions.length > 0 && (
                      <span className="soft-pill border-white/50 bg-white/[0.55] dark:border-dark-border/70 dark:bg-dark-surface/90">
                        最近 {sessions.length} 条记录
                      </span>
                    )}
                  </div>
                  <div className="space-y-3">
                    <h1 className="font-display max-w-3xl text-[34px] font-semibold leading-[0.92] tracking-[-0.06em] text-text-primary dark:text-dark-text md:text-[46px]">
                      {latestSession ? '继续最近任务，或者直接开始新的。' : '把要做的事发进来，马上开始。'}
                    </h1>
                    <p className="max-w-2xl text-[14px] leading-7 text-text-secondary dark:text-dark-text-secondary md:text-[15px]">
                      对 C 端用户来说，最重要的不是系统说明，而是能不能快速接上上一次进度，或者立刻发起一个新任务。
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="soft-pill border-white/50 bg-white/[0.55] text-text-secondary dark:border-dark-border/70 dark:bg-dark-surface/90 dark:text-dark-text-secondary">
                      {workspaceName}
                    </span>
                    <span className="soft-pill border-white/50 bg-white/[0.55] text-text-secondary dark:border-dark-border/70 dark:bg-dark-surface/90 dark:text-dark-text-secondary">
                      {selectedModel?.name || '未配置模型'}
                    </span>
                    <span className="soft-pill border-white/50 bg-white/[0.55] text-text-secondary dark:border-dark-border/70 dark:bg-dark-surface/90 dark:text-dark-text-secondary">
                      已固定 {pinnedSessionsCount} 条
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="codex-kicker">直接开始</div>
                    {sessions.length > 0 && (
                      <span className="soft-pill border-white/50 bg-white/[0.55] text-text-secondary dark:border-dark-border/70 dark:bg-dark-surface/90 dark:text-dark-text-secondary">
                        已有 {sessions.length} 条任务记录
                      </span>
                    )}
                  </div>
                  <p className="text-sm leading-6 text-text-secondary dark:text-dark-text-secondary">
                    一句话也能开始；如果信息还不完整，后面再补截图和文件就行。
                  </p>
                </div>

                <div className="floating-input-panel px-0 pt-1">
                  <CoworkPromptInput
                    ref={promptInputRef}
                    onSubmit={handleStartSession}
                    onStop={handleStopSession}
                    isStreaming={isStreaming}
                    placeholder={i18nService.t('coworkPlaceholder')}
                    size="large"
                    workingDirectory={config.workingDirectory}
                    onWorkingDirectoryChange={async (dir: string) => {
                      await coworkService.updateConfig({ workingDirectory: dir });
                    }}
                    showFolderSelector={true}
                    onManageSkills={() => onShowSkills?.()}
                  />
                </div>
              </div>
            </section>

            {recentSessions.length > 0 && (
              <section className="space-y-3 px-1">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div className="space-y-2">
                    <div className="codex-kicker">继续最近任务</div>
                    <p className="text-sm leading-6 text-text-secondary dark:text-dark-text-secondary">
                      回来以后优先看到最近记录，比看一堆状态说明更有用。
                    </p>
                  </div>
                  <div className="soft-pill border-white/50 bg-white/[0.55] text-text-secondary dark:border-dark-border/70 dark:bg-dark-surface/90 dark:text-dark-text-secondary">
                    最近 {recentSessions.length} 条
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {recentSessions.map((session) => (
                    <button
                      key={session.id}
                      type="button"
                      onClick={() => handleOpenRecentSession(session.id)}
                      className="codex-card flex items-start justify-between gap-4 px-5 py-4 text-left transition-transform duration-200 hover:-translate-y-0.5"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-base font-semibold text-text-primary dark:text-dark-text">
                          {session.title || '未命名任务'}
                        </div>
                        <div className="mt-2 text-sm leading-6 text-text-secondary dark:text-dark-text-secondary">
                          {new Date(session.updatedAt).toLocaleString()}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        {session.pinned && (
                          <span className="soft-pill border-white/50 bg-white/[0.55] text-text-secondary dark:border-dark-border/70 dark:bg-dark-surface/90 dark:text-dark-text-secondary">
                            已固定
                          </span>
                        )}
                        <span className="text-xs uppercase tracking-[0.16em] text-text-muted dark:text-dark-text-muted">
                          继续
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )}

            <section className="space-y-3 px-1">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="space-y-2">
                  <div className="codex-kicker">常用开始方式</div>
                  <p className="text-sm leading-6 text-text-secondary dark:text-dark-text-secondary">
                    不知道怎么开口时，先选一个模板，再按你的真实需求继续改。
                  </p>
                </div>
                <div className="soft-pill border-white/50 bg-white/[0.55] text-text-secondary dark:border-dark-border/70 dark:bg-dark-surface/90 dark:text-dark-text-secondary">
                  模板 {quickActions.length} 个
                </div>
              </div>

              {selectedAction ? (
                <div className="codex-card px-4 py-4 md:px-5">
                  <PromptPanel
                    action={selectedAction}
                    onPromptSelect={handleQuickActionPromptSelect}
                  />
                </div>
              ) : (
                <QuickActionBar actions={quickActions} onActionSelect={handleActionSelect} />
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CoworkView;
