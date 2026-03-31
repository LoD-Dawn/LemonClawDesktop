import React, { useState, useCallback, useEffect } from 'react';
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import type { AuthUser } from '../../types/auth';
import SpinnerIcon from '../icons/SpinnerIcon';
import WindowTitleBar from '../window/WindowTitleBar';

interface LoginScreenProps {
  onLoginSuccess: (user: AuthUser) => void;
}

/**
 * 登录页面：管理端提供登录 URL，点击后在外部浏览器打开。
 * 用户完成登录后管理端回跃到 diclaw://auth?token=xxx，
 * 主进程捕获 token 并通过 IPC 通知此组件完成登录。
 */
const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const logoSrc = `${import.meta.env.BASE_URL}logo.png`;
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
        <div className="draggable relative h-11 shrink-0 dark:bg-dark-surface-muted bg-surface-muted">
          <div className="absolute inset-y-0 right-1.5 z-[55] flex items-center">
            <WindowTitleBar inline />
          </div>
        </div>
      )}

      <div className="flex-1 flex items-center justify-center dark:bg-dark-bg bg-page">
        <div className="w-full max-w-sm px-8 flex flex-col items-center gap-6">
          {/* Logo / Icon */}
          <div className="flex flex-col items-center gap-3">
            <img
              src={logoSrc}
              alt="LemonClaw Logo"
              className="w-16 h-16 object-contain"
            />
            <div className="text-center">
              <h1 className="text-xl font-semibold dark:text-dark-text text-text-primary">LemonClaw</h1>
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
              <div className="w-full py-2.5 px-4 rounded-xl text-sm text-center dark:bg-dark-surface bg-surface dark:text-dark-text-secondary text-text-secondary border dark:border-dark-border border-border flex items-center justify-center gap-2">
                <SpinnerIcon className="w-4 h-4 animate-spin text-primary" />
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



