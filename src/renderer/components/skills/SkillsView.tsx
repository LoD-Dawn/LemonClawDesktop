import React from 'react';
import { i18nService } from '../../services/i18n';
import SkillsManager from './SkillsManager';
import SidebarToggleIcon from '../icons/SidebarToggleIcon';
import ComposeIcon from '../icons/ComposeIcon';
import WindowTitleBar from '../window/WindowTitleBar';

interface SkillsViewProps {
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
  onNewChat?: () => void;
  updateBadge?: React.ReactNode;
}

const SkillsView: React.FC<SkillsViewProps> = ({ isSidebarCollapsed, onToggleSidebar, onNewChat, updateBadge }) => {
  const isMac = window.electron.platform === 'darwin';
  return (
    <div className="flex-1 flex flex-col dark:bg-dark-bg bg-page h-full">
      <div className="app-topbar">
        <div className="app-topbar-inner">
          <div className="flex items-center space-x-3 h-8">
          {isSidebarCollapsed && (
            <div className={`non-draggable flex items-center gap-1 ${isMac ? 'pl-[68px]' : ''}`}>
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
            <h1 className="app-title">
            {i18nService.t('skills')}
            </h1>
          </div>
          <WindowTitleBar inline />
        </div>
      </div>

      <div className="app-view-scroll">
        <div className="app-view-container">
          <SkillsManager />
        </div>
      </div>
    </div>
  );
};

export default SkillsView;
