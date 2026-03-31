import React from 'react';
import type { AuthUser } from '../../types/auth';
import WindowTitleBar from '../window/WindowTitleBar';

interface DisabledScreenProps {
  user: AuthUser | null;
  onSwitchAccount: () => void;
}

/**
 * 账号被禁用时的提示页面
 */
const DisabledScreen: React.FC<DisabledScreenProps> = ({ user, onSwitchAccount }) => {
  const isWindows = window.electron.platform === 'win32';

  const handleQuit = () => {
    window.electron.window.close();
  };

  return (
    <div className="app-shell h-screen overflow-hidden flex flex-col">
      {isWindows && (
        <div className="draggable relative h-11 shrink-0 dark:bg-dark-surface-muted bg-surface-muted">
          <div className="absolute inset-y-0 right-1.5 z-[55] flex items-center">
            <WindowTitleBar inline />
          </div>
        </div>
      )}

      <div className="flex-1 flex items-center justify-center dark:bg-dark-bg bg-page">
        <div className="w-full max-w-sm px-8 flex flex-col items-center gap-6 text-center">
          {/* 禁用图标 */}
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>

          <div>
            <h1 className="text-lg font-semibold dark:text-dark-text text-text-primary">账号访问受限</h1>
            <p className="text-sm dark:text-dark-text-secondary text-text-secondary mt-2 leading-relaxed">
              您的账号已被管理员停用，<br />
              请联系管理员恢复访问权限。
            </p>
            {user?.email && (
              <p className="text-xs dark:text-dark-text-muted text-text-muted mt-2">
                当前账号：{user.email || user.name}
              </p>
            )}
          </div>

          <div className="w-full flex flex-col gap-2">
            <button
              id="btn-switch-account"
              onClick={onSwitchAccount}
              className="
                w-full py-2.5 px-4 rounded-xl font-medium text-sm
                bg-primary hover:bg-primary-light active:scale-[0.98]
                text-white shadow-md transition-all duration-150
              "
            >
              切换账号
            </button>
            <button
              id="btn-quit-app"
              onClick={handleQuit}
              className="
                w-full py-2 px-4 rounded-xl text-sm
                dark:text-dark-text-secondary text-text-secondary
                hover:dark:bg-dark-surface hover:bg-surface
                transition-colors duration-150
              "
            >
              退出应用
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DisabledScreen;



