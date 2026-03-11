import React, { useState, useCallback, useEffect } from 'react';
import type { AuthUser } from '../../types/auth';

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
        <div className="draggable h-9 shrink-0 dark:bg-dark-surface-muted bg-surface-muted" />
      )}

      <div className="flex-1 flex items-center justify-center dark:bg-dark-bg bg-page">
        <div className="w-full max-w-sm px-8 flex flex-col items-center gap-6">
          {/* Logo / Icon */}
          <div className="flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary-light flex items-center justify-center shadow-glow-accent">
              <svg className="w-9 h-9 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 0 1 21.75 8.25Z" />
              </svg>
            </div>
            <div className="text-center">
              <h1 className="text-xl font-semibold dark:text-dark-text text-text-primary">DiClaw</h1>
              <p className="text-sm dark:text-dark-text-secondary text-text-secondary mt-0.5">
                登录您的账号以继续使用
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
                  w-full py-2.5 px-4 rounded-xl font-medium text-sm
                  bg-primary hover:bg-primary-light active:scale-[0.98]
                  text-white shadow-md transition-all duration-150
                  disabled:opacity-60 disabled:cursor-not-allowed
                  flex items-center justify-center gap-2
                "
              >
                {isOpening ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    正在打开登录页…
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                    </svg>
                    前往管理端登录
                  </>
                )}
              </button>
            ) : (
              /* 等待回跳状态 */
              <div className="w-full py-2.5 px-4 rounded-xl text-sm text-center dark:bg-dark-surface bg-surface dark:text-dark-text-secondary text-text-secondary border dark:border-dark-border border-border flex items-center justify-center gap-2">
                <svg className="w-4 h-4 animate-spin text-primary" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                等待浏览器完成登录…
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
            <div className="w-full rounded-lg px-3 py-2.5 bg-red-500/10 border border-red-500/20 text-red-500 text-xs text-center">
              {error}
            </div>
          )}

          {/* 说明 */}
          <p className="text-xs dark:text-dark-text-muted text-text-muted text-center leading-relaxed">
            点击上方按钮将在浏览器中打开登录页面，<br />
            完成登录后将自动返回应用。
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
