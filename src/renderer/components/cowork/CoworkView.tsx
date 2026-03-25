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
import type { CoworkSession, CoworkImageAttachment } from '../../types/cowork';
import { CpuChipIcon, FolderOpenIcon, SparklesIcon, Squares2X2Icon } from '@heroicons/react/24/outline';

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
  } = useSelector((state: RootState) => state.cowork);

  const activeSkillIds = useSelector((state: RootState) => state.skill.activeSkillIds);
  const skills = useSelector((state: RootState) => state.skill.skills);
  const quickActions = useSelector((state: RootState) => state.quickAction.actions);
  const selectedActionId = useSelector((state: RootState) => state.quickAction.selectedActionId);

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

  const executionModeLabel = React.useMemo(() => {
    switch (config.executionMode) {
      case 'auto':
        return i18nService.t('coworkExecutionModeAuto');
      case 'sandbox':
        return i18nService.t('coworkExecutionModeSandbox');
      default:
        return i18nService.t('coworkExecutionModeLocal');
    }
  }, [config.executionMode]);

  const workingDirectoryDisplay = config.workingDirectory?.trim() || i18nService.t('noFolderSelected');

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
        <div className="relative mx-auto flex max-w-5xl flex-col gap-6 px-4 pb-8 pt-5 md:gap-7 md:px-5 md:pb-10 md:pt-6 animate-fade-in-up">
          <div className="pointer-events-none absolute -top-16 left-0 h-48 w-48 rounded-full bg-secondary/20 blur-3xl" />
          <div className="pointer-events-none absolute right-0 top-12 h-56 w-56 rounded-full bg-primary/16 blur-3xl" />

          <section className="brand-soft-panel brand-glow px-6 py-6 md:px-8 md:py-8">
            <div className="relative z-[1] space-y-6">
              <div className="brand-badge">
                <SparklesIcon className="h-3.5 w-3.5 text-secondary" />
                {i18nService.t('coworkHeroEyebrow')}
              </div>

              <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                <div className="max-w-2xl space-y-4">
                  <div className="flex items-center gap-4">
                    <img src="logo.png" alt="LemonClaw logo" className="h-14 w-14 rounded-2xl shadow-subtle md:h-16 md:w-16" />
                    <div className="space-y-1">
                      <div className="brand-title text-3xl font-semibold text-text-primary dark:text-dark-text md:text-4xl">
                        {i18nService.t('coworkHeroTitle')}
                      </div>
                      <div className="text-sm font-medium text-primary dark:text-secondary-dark">
                        {i18nService.t('coworkWelcome')}
                      </div>
                    </div>
                  </div>
                  <p className="max-w-2xl text-sm leading-7 text-text-secondary dark:text-dark-text-secondary md:text-[15px]">
                    {i18nService.t('coworkHeroDescription')}
                  </p>
                  <div className="flex flex-wrap gap-2.5">
                    <span className="brand-badge">{i18nService.t('coworkHeroBenefitPersonal')}</span>
                    <span className="brand-badge">{i18nService.t('coworkHeroBenefitGentle')}</span>
                    <span className="brand-badge">{i18nService.t('coworkHeroBenefitReady')}</span>
                  </div>
                </div>

                <div className="grid w-full gap-3 md:max-w-[320px]">
                  <div className="rounded-[24px] border border-border/80 bg-surface/80 p-4 shadow-subtle dark:border-dark-border/80 dark:bg-dark-surface/75">
                    <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-text-secondary dark:text-dark-text-secondary">
                      <CpuChipIcon className="h-4 w-4 text-primary" />
                      {i18nService.t('coworkHeroCardMode')}
                    </div>
                    <div className="mt-2 text-sm font-medium text-text-primary dark:text-dark-text">
                      {executionModeLabel}
                    </div>
                  </div>
                  <div className="rounded-[24px] border border-border/80 bg-surface/80 p-4 shadow-subtle dark:border-dark-border/80 dark:bg-dark-surface/75">
                    <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-text-secondary dark:text-dark-text-secondary">
                      <FolderOpenIcon className="h-4 w-4 text-primary" />
                      {i18nService.t('coworkHeroCardSpace')}
                    </div>
                    <div className="mt-2 truncate text-sm font-medium text-text-primary dark:text-dark-text" title={workingDirectoryDisplay}>
                      {workingDirectoryDisplay}
                    </div>
                  </div>
                  <div className="rounded-[24px] border border-border/80 bg-surface/80 p-4 shadow-subtle dark:border-dark-border/80 dark:bg-dark-surface/75">
                    <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-text-secondary dark:text-dark-text-secondary">
                      <Squares2X2Icon className="h-4 w-4 text-primary" />
                      {i18nService.t('coworkHeroCardAction')}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary dark:bg-primary-lighter/20 dark:text-secondary-dark">{i18nService.t('skills')}</span>
                      <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary dark:bg-primary-lighter/20 dark:text-secondary-dark">{i18nService.t('mcpServers')}</span>
                      <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary dark:bg-primary-lighter/20 dark:text-secondary-dark">{i18nService.t('scheduledTasks')}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="brand-soft-panel px-4 py-4 md:px-5 md:py-5">
            <div className="relative z-[1] space-y-4">
              <div className="space-y-1 px-1">
                <h3 className="brand-title text-xl font-semibold text-text-primary dark:text-dark-text">
                  {i18nService.t('coworkHeroPanelTitle')}
                </h3>
                <p className="text-sm leading-6 text-text-secondary dark:text-dark-text-secondary">
                  {i18nService.t('coworkHeroPanelDescription')}
                </p>
              </div>
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
          </section>

          <section className="brand-soft-panel px-4 py-4 md:px-5 md:py-5">
            <div className="relative z-[1] space-y-4">
              <div className="space-y-1 px-1">
                <h3 className="brand-title text-lg font-semibold text-text-primary dark:text-dark-text">
                  {i18nService.t('coworkQuickActionsTitle')}
                </h3>
                <p className="text-sm leading-6 text-text-secondary dark:text-dark-text-secondary">
                  {i18nService.t('coworkQuickActionsDescription')}
                </p>
              </div>
              {selectedAction ? (
                <PromptPanel
                  action={selectedAction}
                  onPromptSelect={handleQuickActionPromptSelect}
                />
              ) : (
                <QuickActionBar actions={quickActions} onActionSelect={handleActionSelect} />
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default CoworkView;
