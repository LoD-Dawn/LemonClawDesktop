import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from './store';
import Settings, { type SettingsOpenOptions } from './components/Settings';
import Sidebar from './components/Sidebar';
import Toast from './components/Toast';
import WindowTitleBar from './components/window/WindowTitleBar';
import { CoworkView } from './components/cowork';
import { SkillsView } from './components/skills';
import { ScheduledTasksView } from './components/scheduledTasks';
import { McpView } from './components/mcp';
import CoworkPermissionModal from './components/cowork/CoworkPermissionModal';
import CoworkSearchModal from './components/cowork/CoworkSearchModal';
import CoworkQuestionWizard from './components/cowork/CoworkQuestionWizard';
import LoginScreen from './components/auth/LoginScreen';
import { configService } from './services/config';
import { apiService } from './services/api';
import { themeService } from './services/theme';
import { coworkService } from './services/cowork';
import { scheduledTaskService } from './services/scheduledTask';
import { checkForAppUpdate, type AppUpdateInfo, type AppUpdateDownloadProgress, UPDATE_POLL_INTERVAL_MS, UPDATE_HEARTBEAT_INTERVAL_MS } from './services/appUpdate';
import { defaultConfig } from './config';
import { setAvailableModels, setSelectedModel } from './store/slices/modelSlice';
import { clearSelection } from './store/slices/quickActionSlice';
import { selectTask, setViewMode } from './store/slices/scheduledTaskSlice';
import { setAuthLoggedIn, setAuthLoggedOut } from './store/slices/authSlice';
import type { CoworkPermissionResult } from './types/cowork';
import type { AuthUser } from './types/auth';
import { ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';
import { i18nService } from './services/i18n';
import { matchesShortcut } from './services/shortcuts';
import AppUpdateBadge from './components/update/AppUpdateBadge';
import AppUpdateModal from './components/update/AppUpdateModal';

const App: React.FC = () => {
  const [showSettings, setShowSettings] = useState(false);
  const [settingsOptions, setSettingsOptions] = useState<SettingsOpenOptions>({});
  const [mainView, setMainView] = useState<'cowork' | 'skills' | 'scheduledTasks' | 'mcp'>('cowork');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [, forceLanguageRefresh] = useState(0);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<AppUpdateInfo | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updateModalState, setUpdateModalState] = useState<'info' | 'downloading' | 'installing' | 'error'>('info');
  const [downloadProgress, setDownloadProgress] = useState<AppUpdateDownloadProgress | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const [initNonce, setInitNonce] = useState(0);
  const dispatch = useDispatch();
  const selectedModel = useSelector((state: RootState) => state.model.selectedModel);
  const sessions = useSelector((state: RootState) => state.cowork.sessions);
  const scheduledTasks = useSelector((state: RootState) => state.scheduledTask.tasks);
  const currentSessionId = useSelector((state: RootState) => state.cowork.currentSessionId);
  const pendingPermissions = useSelector((state: RootState) => state.cowork.pendingPermissions);
  const pendingPermission = pendingPermissions[0] ?? null;
  const authStatus = useSelector((state: RootState) => state.auth.status);
  const isWindows = window.electron.platform === 'win32';

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage(null);
      toastTimerRef.current = null;
    }, 2200);
  }, []);

  const applyResolvedModelConfig = useCallback(async () => {
    const resolved = await window.electron.config.getResolvedModelConfig();
    apiService.setConfig({
      apiKey: resolved.api?.apiKey ?? '',
      baseUrl: resolved.api?.baseUrl ?? '',
      apiFormat: resolved.api?.apiFormat,
    });

    const models = resolved.availableModels.map((model) => ({
      id: model.id,
      name: model.name,
      provider: model.providerLabel,
      providerKey: model.providerKey,
      supportsImage: model.supportsImage ?? false,
    }));

    dispatch(setAvailableModels(models));
    if (models.length > 0) {
      const selected = models.find(
        model => model.id === resolved.selectedModel && model.providerKey === resolved.selectedProvider
      ) ?? models[0];
      dispatch(setSelectedModel(selected));
    } else {
      dispatch(setSelectedModel(null));
    }

    return resolved;
  }, [dispatch]);

  const applyAppPreferencesToRuntime = useCallback(async () => {
    const preferences = await window.electron.config.getUserPreferences();
    configService.applyUserPreferences({
      theme: preferences.theme ?? defaultConfig.theme,
      language: preferences.language ?? defaultConfig.language,
      useSystemProxy: preferences.useSystemProxy ?? defaultConfig.useSystemProxy,
      shortcuts: {
        ...(preferences.shortcuts ?? {}),
        newChat: preferences.shortcuts?.newChat ?? defaultConfig.shortcuts!.newChat,
        search: preferences.shortcuts?.search ?? defaultConfig.shortcuts!.search,
        settings: preferences.shortcuts?.settings ?? defaultConfig.shortcuts!.settings,
      },
    });
    return preferences;
  }, []);

  const syncTenantConfig = useCallback(async () => {
    const result = await window.electron.auth.syncTenantConfig();
    if (!result.success) {
      console.warn('[App] Failed to sync tenant config:', result.error);
      showToast(`模型配置同步失败: ${result.error || '未知错误'}`);
      return false;
    }
    return true;
  }, [showToast]);

  useEffect(() => {
    const unsubscribe = window.electron.ipcRenderer.on(
      'auth:sessionInvalid',
      () => {
        coworkService.clearSession();
        dispatch(setAuthLoggedOut());
        setInitError(null);
        setIsInitialized(true);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [dispatch]);

  // 初始化应用
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // 标记平台，用于 CSS 条件样式（如 Windows 标题栏按钮区域留白）
        document.documentElement.classList.add(`platform-${window.electron.platform}`);

        // ===== 1. 认证校验（最优先，失败则不继续初始化）=====
        const verifyResult = await window.electron.auth.verify();
        if (!verifyResult.valid) {
          dispatch(setAuthLoggedOut());
          setIsInitialized(true);
          return; // 停止后续初始化
        }
        dispatch(setAuthLoggedIn(verifyResult.user!));
        // ===== 认证通过，继续正常初始化 =====

        // 初始化配置
        await configService.init();
        await applyAppPreferencesToRuntime();
        await syncTenantConfig();

        // 初始化主题
        themeService.initialize();

        // 初始化语言
        await i18nService.initialize();
        await applyResolvedModelConfig();

        // 初始化定时任务服务
        await scheduledTaskService.init();

        setIsInitialized(true);
      } catch (error) {
        console.error('Failed to initialize app:', error);
        setInitError(i18nService.t('initializationError'));
        setIsInitialized(true);
      }
    };

    initializeApp();
  }, [dispatch, initNonce, applyAppPreferencesToRuntime, applyResolvedModelConfig, syncTenantConfig]);

  useEffect(() => {
    const unsubscribe = i18nService.subscribe(() => {
      forceLanguageRefresh((prev) => prev + 1);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  // Network status monitoring
  useEffect(() => {
    const handleOnline = () => {
      console.log('[Renderer] Network online');
      window.electron.networkStatus.send('online');
    };

    const handleOffline = () => {
      console.log('[Renderer] Network offline');
      window.electron.networkStatus.send('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const currentSelectedModel = selectedModel;
    if (!isInitialized || !currentSelectedModel?.id) return;
    void (async () => {
      const preferences = await window.electron.config.getUserPreferences();
      if (
        preferences.preferredModel === currentSelectedModel.id
        && (preferences.preferredProvider ?? '') === (currentSelectedModel.providerKey ?? '')
      ) {
        return;
      }

      await window.electron.config.updateUserPreferences({
        preferredModel: currentSelectedModel.id,
        preferredProvider: currentSelectedModel.providerKey,
      });
    })();
  }, [isInitialized, selectedModel?.id, selectedModel?.providerKey]);

  const handleShowSettings = useCallback((options?: SettingsOpenOptions) => {
    setSettingsOptions({
      initialTab: options?.initialTab,
      notice: options?.notice,
    });
    setShowSettings(true);
  }, []);

  const handleShowSkills = useCallback(() => {
    setMainView('skills');
  }, []);

  const handleShowCowork = useCallback(() => {
    setMainView('cowork');
  }, []);

  const handleShowScheduledTasks = useCallback(() => {
    setMainView('scheduledTasks');
  }, []);

  const handleSelectScheduledTask = useCallback((taskId: string) => {
    setMainView('scheduledTasks');
    dispatch(selectTask(taskId));
    dispatch(setViewMode('detail'));
  }, [dispatch]);

  const handleShowMcp = useCallback(() => {
    setMainView('mcp');
  }, []);

  const handleOpenSearch = useCallback(() => {
    void scheduledTaskService.loadTasks();
    setIsSearchOpen(true);
  }, []);

  const handleCloseSearch = useCallback(() => {
    setIsSearchOpen(false);
  }, []);

  const handleSelectSessionFromSearch = useCallback(async (sessionId: string) => {
    setMainView('cowork');
    await coworkService.loadSession(sessionId);
  }, []);

  const handleToggleSidebar = useCallback(() => {
    setIsSidebarCollapsed((prev) => !prev);
  }, []);

  const handleNewChat = useCallback(() => {
    const shouldClearInput = mainView === 'cowork' || !!currentSessionId;
    coworkService.clearSession();
    dispatch(clearSelection());
    setMainView('cowork');
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent('cowork:focus-input', {
        detail: { clear: shouldClearInput },
      }));
    }, 0);
  }, [dispatch, mainView, currentSessionId]);

  const handleShowLogin = useCallback(async () => {
    // 登出后直接显示登录页，无需重新跑完整初始化
    await window.electron.auth.logout();
    dispatch(setAuthLoggedOut());
    setInitError(null);
    setIsInitialized(true);
  }, [dispatch]);

  // 处理登录成功（来自 LoginScreen 组件）
  const handleLoginSuccess = useCallback((user: AuthUser) => {
    dispatch(setAuthLoggedIn(user));
    setInitError(null);
    setIsInitialized(false);
    setInitNonce((value) => value + 1);
  }, [dispatch]);
  const runUpdateCheck = useCallback(async () => {
    try {
      const currentVersion = await window.electron.appInfo.getVersion();
      const nextUpdate = await checkForAppUpdate(currentVersion);
      setUpdateInfo(nextUpdate);
      if (!nextUpdate) {
        setShowUpdateModal(false);
      }
    } catch (error) {
      console.error('Failed to check app update:', error);
      setUpdateInfo(null);
      setShowUpdateModal(false);
    }
  }, []);

  const handleOpenUpdateModal = useCallback(() => {
    if (!updateInfo) return;
    setUpdateModalState('info');
    setUpdateError(null);
    setDownloadProgress(null);
    setShowUpdateModal(true);
  }, [updateInfo]);

  const handleUpdateFound = useCallback((info: AppUpdateInfo) => {
    setUpdateInfo(info);
    setUpdateModalState('info');
    setUpdateError(null);
    setDownloadProgress(null);
    setShowUpdateModal(true);
  }, []);

  const handleConfirmUpdate = useCallback(async () => {
    if (!updateInfo) return;

    // If the URL is a fallback page (not a direct file download), open in browser
    if (updateInfo.url.includes('#') || updateInfo.url.endsWith('/download-list')) {
      setShowUpdateModal(false);
      try {
        const result = await window.electron.shell.openExternal(updateInfo.url);
        if (!result.success) {
          showToast(i18nService.t('updateOpenFailed'));
        }
      } catch (error) {
        console.error('Failed to open update url:', error);
        showToast(i18nService.t('updateOpenFailed'));
      }
      return;
    }

    setUpdateModalState('downloading');
    setDownloadProgress(null);
    setUpdateError(null);

    const unsubscribe = window.electron.appUpdate.onDownloadProgress((progress) => {
      setDownloadProgress(progress);
    });

    try {
      const downloadResult = await window.electron.appUpdate.download(updateInfo.url);
      unsubscribe();

      if (!downloadResult.success) {
        // If user cancelled, handleCancelDownload already set the state — don't overwrite
        if (downloadResult.error === 'Download cancelled') {
          return;
        }
        setUpdateModalState('error');
        setUpdateError(downloadResult.error || i18nService.t('updateDownloadFailed'));
        return;
      }

      setUpdateModalState('installing');
      const installResult = await window.electron.appUpdate.install(downloadResult.filePath!);

      if (!installResult.success) {
        setUpdateModalState('error');
        setUpdateError(installResult.error || i18nService.t('updateInstallFailed'));
      }
      // If successful, app will quit and relaunch
    } catch (error) {
      unsubscribe();
      const msg = error instanceof Error ? error.message : '';
      // If user cancelled, handleCancelDownload already set the state — don't overwrite
      if (msg === 'Download cancelled') {
        return;
      }
      setUpdateModalState('error');
      setUpdateError(msg || i18nService.t('updateDownloadFailed'));
    }
  }, [updateInfo, showToast]);

  const handleCancelDownload = useCallback(async () => {
    await window.electron.appUpdate.cancelDownload();
    setUpdateModalState('info');
    setDownloadProgress(null);
  }, []);

  const handleRetryUpdate = useCallback(() => {
    setUpdateModalState('info');
    setUpdateError(null);
    setDownloadProgress(null);
  }, []);

  const handlePermissionResponse = useCallback(async (result: CoworkPermissionResult) => {
    if (!pendingPermission) return;
    await coworkService.respondToPermission(pendingPermission.requestId, result);
  }, [pendingPermission]);

  const handleCloseSettings = () => {
    setShowSettings(false);
    void (async () => {
      await applyAppPreferencesToRuntime();
      await applyResolvedModelConfig();
    })();
  };

  const isShortcutInputActive = () => {
    const activeElement = document.activeElement;
    if (!(activeElement instanceof HTMLElement)) return false;
    return activeElement.dataset.shortcutInput === 'true';
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || isShortcutInputActive()) return;

      const { shortcuts } = configService.getConfig();
      const activeShortcuts = {
        ...defaultConfig.shortcuts,
        ...(shortcuts ?? {}),
      };

      if (matchesShortcut(event, activeShortcuts.newChat)) {
        event.preventDefault();
        handleNewChat();
        return;
      }

      if (matchesShortcut(event, activeShortcuts.search)) {
        event.preventDefault();
        handleOpenSearch();
        return;
      }

      if (matchesShortcut(event, activeShortcuts.settings)) {
        event.preventDefault();
        handleShowSettings();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleOpenSearch, handleShowSettings, handleNewChat]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  // Listen for toast events from child components
  useEffect(() => {
    const handler = (e: Event) => {
      const message = (e as CustomEvent<string>).detail;
      if (message) showToast(message);
    };
    window.addEventListener('app:showToast', handler);
    return () => window.removeEventListener('app:showToast', handler);
  }, [showToast]);

  // 监听托盘菜单打开设置的 IPC 事件
  useEffect(() => {
    const unsubscribe = window.electron.ipcRenderer.on('app:openSettings', () => {
      handleShowSettings();
    });
    return unsubscribe;
  }, [handleShowSettings]);

  // 监听托盘菜单新建任务的 IPC 事件
  useEffect(() => {
    const unsubscribe = window.electron.ipcRenderer.on('app:newTask', () => {
      handleNewChat();
    });
    return unsubscribe;
  }, [handleNewChat]);

  // 监听定时任务查看会话事件
  useEffect(() => {
    const handleViewSession = async (event: Event) => {
      const { sessionId } = (event as CustomEvent).detail;
      if (sessionId) {
        setMainView('cowork');
        await coworkService.loadSession(sessionId);
      }
    };
    window.addEventListener('scheduledTask:viewSession', handleViewSession);
    return () => window.removeEventListener('scheduledTask:viewSession', handleViewSession);
  }, []);

  useEffect(() => {
    if (!isInitialized) return;

    let cancelled = false;
    let lastCheckTime = 0;

    const maybeCheck = async () => {
      if (cancelled) return;
      const now = Date.now();
      if (lastCheckTime > 0 && now - lastCheckTime < UPDATE_POLL_INTERVAL_MS) return;
      lastCheckTime = now;
      await runUpdateCheck();
    };

    // 启动时立即检查
    void maybeCheck();

    // 心跳：每 30 分钟检测是否距上次检查已超过 12 小时
    const timer = window.setInterval(() => {
      void maybeCheck();
    }, UPDATE_HEARTBEAT_INTERVAL_MS);

    // 窗口恢复可见时检测（覆盖休眠唤醒场景）
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void maybeCheck();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isInitialized, runUpdateCheck]);

  // 根据场景选择使用哪个权限组件
  const permissionModal = useMemo(() => {
    if (!pendingPermission) return null;

    // 检查是否为 AskUserQuestion 且有多个问题 -> 使用向导式组件
    const isQuestionTool = pendingPermission.toolName === 'AskUserQuestion';
    if (isQuestionTool && pendingPermission.toolInput) {
      const rawQuestions = (pendingPermission.toolInput as Record<string, unknown>).questions;
      const hasMultipleQuestions = Array.isArray(rawQuestions) && rawQuestions.length > 1;

      if (hasMultipleQuestions) {
        return (
          <CoworkQuestionWizard
            permission={pendingPermission}
            onRespond={handlePermissionResponse}
          />
        );
      }
    }

    // 其他情况使用原有的权限模态框
    return (
      <CoworkPermissionModal
        permission={pendingPermission}
        onRespond={handlePermissionResponse}
      />
    );
  }, [pendingPermission, handlePermissionResponse]);

  const isOverlayActive = showSettings || showUpdateModal || pendingPermissions.length > 0;
  const updateBadge = updateInfo ? (
    <AppUpdateBadge
      latestVersion={updateInfo.latestVersion}
      onClick={handleOpenUpdateModal}
    />
  ) : null;
  const windowsStandaloneTitleBar = isWindows ? (
    <div className="draggable relative mx-3 mt-3 h-10 shrink-0 rounded-[26px] border dark:border-dark-border/70 dark:bg-dark-surface-muted/72 bg-surface/72 border-border/70 shadow-subtle backdrop-blur-xl">
      <WindowTitleBar isOverlayActive={isOverlayActive} />
    </div>
  ) : null;

  if (!isInitialized) {
    return (
      <div className="app-shell h-screen overflow-hidden flex flex-col">
        {windowsStandaloneTitleBar}
        <div className="flex-1 flex items-center justify-center dark:bg-dark-bg bg-page">
          <div className="brand-soft-panel brand-glow flex flex-col items-center space-y-5 px-10 py-9 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-gradient-to-br from-secondary/80 via-secondary to-primary-light text-white shadow-elevated animate-pulse">
              <ChatBubbleLeftRightIcon className="h-8 w-8 text-white" />
            </div>
            <div className="w-28 h-1 rounded-full bg-primary/15 overflow-hidden">
              <div className="h-full w-1/2 rounded-full bg-primary animate-shimmer" />
            </div>
            <div className="space-y-1">
              <div className="brand-title dark:text-dark-text text-text-primary text-xl font-semibold">LemonClaw</div>
              <div className="dark:text-dark-text-secondary text-text-secondary text-sm">{i18nService.t('loading')}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 认证状态渲染分叉
  if (authStatus === 'logged_out') {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  if (initError) {
    return (
      <div className="app-shell h-screen overflow-hidden flex flex-col">
        {windowsStandaloneTitleBar}
        <div className="flex-1 flex flex-col items-center justify-center dark:bg-dark-bg bg-page">
          <div className="brand-soft-panel brand-glow flex max-w-md flex-col items-center space-y-6 px-8 py-9 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-red-500 text-white shadow-lg">
              <ChatBubbleLeftRightIcon className="h-8 w-8 text-white" />
            </div>
            <div className="space-y-2">
              <div className="brand-title dark:text-dark-text text-text-primary text-xl font-semibold">LemonClaw</div>
              <div className="dark:text-dark-text text-text-primary text-base font-medium text-center">{initError}</div>
            </div>
            <button
              onClick={() => handleShowSettings()}
              className="px-6 py-2.5 bg-primary hover:bg-primary-light text-white rounded-2xl shadow-card transition-colors text-sm font-medium"
            >
              {i18nService.t('openSettings')}
            </button>
          </div>
          {showSettings && (
            <Settings
              onClose={handleCloseSettings}
              initialTab={settingsOptions.initialTab}
              notice={settingsOptions.notice}
              onUpdateFound={handleUpdateFound}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell h-screen overflow-hidden flex flex-col">
      {toastMessage && (
        <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
      )}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div className="app-workspace-panel flex flex-1 min-h-0 min-w-0 overflow-hidden animate-fade-in">
          <Sidebar
            onShowLogin={handleShowLogin}
            onShowSettings={handleShowSettings}
            activeView={mainView}
            onShowSkills={handleShowSkills}
            onShowCowork={handleShowCowork}
            onShowScheduledTasks={handleShowScheduledTasks}
            onOpenSearch={handleOpenSearch}
            onShowMcp={handleShowMcp}
            onNewChat={handleNewChat}
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={handleToggleSidebar}
            updateBadge={!isSidebarCollapsed ? updateBadge : null}
            isEmbedded
          />
          <div className="flex-1 min-h-0 min-w-0 overflow-hidden dark:bg-dark-bg/95 bg-page/85">
            {mainView === 'skills' ? (
              <SkillsView
                isSidebarCollapsed={isSidebarCollapsed}
                onToggleSidebar={handleToggleSidebar}
                onNewChat={handleNewChat}
                updateBadge={isSidebarCollapsed ? updateBadge : null}
              />
            ) : mainView === 'scheduledTasks' ? (
              <ScheduledTasksView
                isSidebarCollapsed={isSidebarCollapsed}
                onToggleSidebar={handleToggleSidebar}
                onNewChat={handleNewChat}
                updateBadge={isSidebarCollapsed ? updateBadge : null}
              />
            ) : mainView === 'mcp' ? (
              <McpView
                isSidebarCollapsed={isSidebarCollapsed}
                onToggleSidebar={handleToggleSidebar}
                onNewChat={handleNewChat}
                updateBadge={isSidebarCollapsed ? updateBadge : null}
              />
            ) : (
              <CoworkView
                onRequestAppSettings={handleShowSettings}
                onShowSkills={handleShowSkills}
                isSidebarCollapsed={isSidebarCollapsed}
                onToggleSidebar={handleToggleSidebar}
                onNewChat={handleNewChat}
                updateBadge={isSidebarCollapsed ? updateBadge : null}
              />
            )}
          </div>
        </div>
      </div>
      <CoworkSearchModal
        isOpen={isSearchOpen}
        onClose={handleCloseSearch}
        sessions={sessions}
        scheduledTasks={scheduledTasks}
        onSelectSession={handleSelectSessionFromSearch}
        onSelectScheduledTask={handleSelectScheduledTask}
      />

      {/* 设置窗口显示在所有主内容之上，但不影响主界面的交互 */}
      {showSettings && (
        <Settings
          onClose={handleCloseSettings}
          initialTab={settingsOptions.initialTab}
          notice={settingsOptions.notice}
          onUpdateFound={handleUpdateFound}
        />
      )}
      {showUpdateModal && updateInfo && (
        <AppUpdateModal
          updateInfo={updateInfo}
          onCancel={() => {
            if (updateModalState === 'info' || updateModalState === 'error') {
              setShowUpdateModal(false);
              setUpdateModalState('info');
              setUpdateError(null);
              setDownloadProgress(null);
            }
          }}
          onConfirm={handleConfirmUpdate}
          modalState={updateModalState}
          downloadProgress={downloadProgress}
          errorMessage={updateError}
          onCancelDownload={handleCancelDownload}
          onRetry={handleRetryUpdate}
        />
      )}
      {permissionModal}
    </div>
  );
};

export default App; 

