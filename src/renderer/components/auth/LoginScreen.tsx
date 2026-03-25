import React, { useState, useCallback, useEffect } from 'react';
import { ArrowTopRightOnSquareIcon, KeyIcon } from '@heroicons/react/24/outline';
import type { AuthUser } from '../../types/auth';
import SpinnerIcon from '../icons/SpinnerIcon';
import WindowTitleBar from '../window/WindowTitleBar';
import { i18nService } from '../../services/i18n';

interface LoginScreenProps {
  onLoginSuccess: (user: AuthUser) => void;
}

/**
 * 登录页面：管理端提供登录 URL，点击后在外部浏览器打开。
 * 用户完成登录后管理端回跃到 diclaw://auth?token=xxx，
 * 主进程捕获 token 并通过 IPC 通知此组件完成登录。
 */
const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [isOpening, setIsOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [waitingForCallback, setWaitingForCallback] = useState(false);

  // 监听主进程发来的 auth:loginSuccess 事件（深链接回调后触发）
  useEffect(() => {
    const unsubscribe = window.electron.ipcRenderer.on('auth:loginSuccess', (user: AuthUser) => {
      setWaitingForCallback(false);
      setError(null);
      onLoginSuccess(user);
    });

    const unsubscribeError = window.electron.ipcRenderer.on('auth:loginError', (message: string) => {
      setWaitingForCallback(false);
      setIsOpening(false);
      setError(message || '登录失败，请重试');
    });

    return () => {
      unsubscribe();
      unsubscribeError();
    };
  }, [onLoginSuccess]);

  const handleLogin = useCallback(async () => {
    setError(null);
    setIsOpening(true);
    try {
      // 让主进程打开管理端登录 URL（主进程知道正确的 URL）
      await window.electron.auth.openLoginUrl();
      setWaitingForCallback(true);
    } catch (err) {
      setError('无法打开登录页面，请检查网络连接');
    } finally {
      setIsOpening(false);
    }
  }, []);

  const isWindows = window.electron.platform === 'win32';

  return (
    <div className="app-shell h-screen overflow-hidden flex flex-col">
      {/* Windows 标题栏占位（匹配主界面风格） */}
      {isWindows && (
        <div className="draggable relative mb-3 h-9 shrink-0 rounded-2xl border border-border/70 dark:border-dark-border/70 dark:bg-dark-surface-muted/80 bg-surface/80">
          <WindowTitleBar className="top-1.5 right-1.5" />
        </div>
      )}

      <div className="flex-1 flex items-center justify-center dark:bg-dark-bg bg-page">
        <div className="brand-soft-panel brand-glow w-full max-w-md px-8 py-9 flex flex-col items-center gap-6 text-center">
          {/* Logo / Icon */}
          <div className="flex flex-col items-center gap-3">
            <div className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-gradient-to-br from-secondary via-secondary to-primary-light shadow-elevated">
              <KeyIcon className="w-9 h-9 text-white" />
            </div>
            <div className="text-center space-y-1.5">
              <div className="brand-badge justify-center">
                <span className="h-1.5 w-1.5 rounded-full bg-secondary" />
                LemonClaw
              </div>
              <h1 className="brand-title text-2xl font-semibold dark:text-dark-text text-text-primary">
                {i18nService.t('loginScreenTitle')}
              </h1>
              <p className="text-sm leading-6 dark:text-dark-text-secondary text-text-secondary">
                {i18nService.t('loginScreenDescription')}
              </p>
            </div>
          </div>

          {/* 登录按钮 */}
          <div className="w-full flex flex-col gap-3">
            {!waitingForCallback ? (
              <button
                id="btn-open-login"
                onClick={handleLogin}
                disabled={isOpening}
                className="
                  w-full py-3 px-4 rounded-2xl font-medium text-sm
                  bg-primary hover:bg-primary-light active:scale-[0.98]
                  text-white shadow-card transition-all duration-150
                  disabled:opacity-60 disabled:cursor-not-allowed
                  flex items-center justify-center gap-2
                "
              >
                {isOpening ? (
                  <>
                    <SpinnerIcon className="w-4 h-4 animate-spin" />
                    正在打开登录页…
                  </>
                ) : (
                  <>
                    <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                    前往管理端登录
                  </>
                )}
              </button>
            ) : (
              /* 等待回跳状态 */
              <div className="w-full py-3 px-4 rounded-2xl text-sm text-center dark:bg-dark-surface bg-surface dark:text-dark-text-secondary text-text-secondary border dark:border-dark-border border-border flex items-center justify-center gap-2">
                <SpinnerIcon className="w-4 h-4 animate-spin text-primary" />
                {i18nService.t('loginWaitingForBrowser')}
              </div>
            )}

            {/* 取消等待 */}
            {waitingForCallback && (
              <button
                onClick={() => { setWaitingForCallback(false); setIsOpening(false); }}
                className="text-xs dark:text-dark-text-muted text-text-muted hover:underline text-center"
              >
                取消
              </button>
            )}
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="w-full rounded-2xl px-3 py-3 bg-red-500/10 border border-red-500/20 text-red-500 text-xs text-center">
              {error}
            </div>
          )}

          {/* 说明 */}
          <p className="text-xs dark:text-dark-text-muted text-text-muted text-center leading-6">
            {i18nService.t('loginScreenHint')}
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;



