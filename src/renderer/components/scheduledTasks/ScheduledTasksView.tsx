import React, { useCallback, useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../store';
import { setViewMode, selectTask } from '../../store/slices/scheduledTaskSlice';
import { scheduledTaskService } from '../../services/scheduledTask';
import { i18nService } from '../../services/i18n';
import TaskList from './TaskList';
import TaskForm from './TaskForm';
import TaskDetail from './TaskDetail';
import AllRunsHistory from './AllRunsHistory';
import DeleteConfirmModal from './DeleteConfirmModal';
import { ArrowLeftIcon, PlusIcon } from '@heroicons/react/24/outline';
import SidebarToggleIcon from '../icons/SidebarToggleIcon';
import ComposeIcon from '../icons/ComposeIcon';
import WindowTitleBar from '../window/WindowTitleBar';

interface ScheduledTasksViewProps {
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
  onNewChat?: () => void;
  updateBadge?: React.ReactNode;
}

type TabType = 'tasks' | 'history';

const ScheduledTasksView: React.FC<ScheduledTasksViewProps> = ({
  isSidebarCollapsed,
  onToggleSidebar,
  onNewChat,
  updateBadge,
}) => {
  const dispatch = useDispatch();
  const isMac = window.electron.platform === 'darwin';
  const viewMode = useSelector((state: RootState) => state.scheduledTask.viewMode);
  const selectedTaskId = useSelector((state: RootState) => state.scheduledTask.selectedTaskId);
  const tasks = useSelector((state: RootState) => state.scheduledTask.tasks);
  const selectedTask = selectedTaskId ? tasks.find((t) => t.id === selectedTaskId) ?? null : null;
  const [activeTab, setActiveTab] = useState<TabType>('tasks');
  const [deleteTaskInfo, setDeleteTaskInfo] = useState<{ id: string; name: string } | null>(null);

  const handleRequestDelete = useCallback((taskId: string, taskName: string) => {
    setDeleteTaskInfo({ id: taskId, name: taskName });
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTaskInfo) return;
    const taskId = deleteTaskInfo.id;
    setDeleteTaskInfo(null);
    await scheduledTaskService.deleteTask(taskId);
    // If we were viewing this task's detail, go back to list
    if (selectedTaskId === taskId) {
      dispatch(selectTask(null));
      dispatch(setViewMode('list'));
    }
  }, [deleteTaskInfo, selectedTaskId, dispatch]);

  const handleCancelDelete = useCallback(() => {
    setDeleteTaskInfo(null);
  }, []);

  const handleCreateTask = useCallback(() => {
    setActiveTab('tasks');
    dispatch(selectTask(null));
    dispatch(setViewMode('create'));
  }, [dispatch]);

  useEffect(() => {
    scheduledTaskService.loadTasks();
  }, []);

  const handleBackToList = () => {
    dispatch(selectTask(null));
    dispatch(setViewMode('list'));
  };

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    if (tab === 'tasks') {
      dispatch(selectTask(null));
      dispatch(setViewMode('list'));
    }
  };

  // Show tabs only in list view (not in create/edit/detail sub-views)
  const showTabs = viewMode === 'list' && !selectedTaskId;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
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
            {viewMode !== 'list' && (
              <button
                onClick={handleBackToList}
                className="non-draggable app-icon-btn-soft h-9 w-9"
                aria-label={i18nService.t('back')}
              >
                <ArrowLeftIcon className="h-5 w-5" />
              </button>
            )}
            <h1 className="app-title">
              {i18nService.t('scheduledTasksTitle')}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <WindowTitleBar inline />
          </div>
        </div>
      </div>

      {/* Tabs */}
      {showTabs && (
        <div className="app-tabs-bar px-0">
          <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-2 md:px-3">
            <div className="flex">
              <button
                type="button"
                onClick={() => handleTabChange('tasks')}
                className={`app-tab ${
                  activeTab === 'tasks'
                    ? 'app-tab-active'
                    : 'app-tab-inactive'
                } !px-3`}
              >
                {i18nService.t('scheduledTasksTabTasks')}
              </button>
              <button
                type="button"
                onClick={() => handleTabChange('history')}
                className={`app-tab ${
                  activeTab === 'history'
                    ? 'app-tab-active'
                    : 'app-tab-inactive'
                } !px-3`}
              >
                {i18nService.t('scheduledTasksTabHistory')}
              </button>
            </div>
            <button
              type="button"
              onClick={handleCreateTask}
              className="app-primary-btn h-7 gap-1 px-2.5 text-xs"
            >
              <PlusIcon className="h-3.5 w-3.5" />
              {i18nService.t('scheduledTasksNewTask')}
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="app-view-scroll">
        <div className="mx-auto w-full max-w-5xl px-2 md:px-3 py-5 md:py-6">
          {showTabs && activeTab === 'history' ? (
            <AllRunsHistory />
          ) : (
            <>
              {viewMode === 'list' && (
                <TaskList
                  onRequestDelete={handleRequestDelete}
                  onCreateTask={handleCreateTask}
                />
              )}
              {viewMode === 'create' && (
                <TaskForm
                  mode="create"
                  onCancel={handleBackToList}
                  onSaved={handleBackToList}
                />
              )}
              {viewMode === 'edit' && selectedTask && (
                <TaskForm
                  mode="edit"
                  task={selectedTask}
                  onCancel={() => dispatch(setViewMode('detail'))}
                  onSaved={() => dispatch(setViewMode('detail'))}
                />
              )}
              {viewMode === 'detail' && selectedTask && (
                <TaskDetail task={selectedTask} onRequestDelete={handleRequestDelete} />
              )}
            </>
          )}
        </div>
      </div>

      {/* Delete confirmation modal */}
      {deleteTaskInfo && (
        <DeleteConfirmModal
          taskName={deleteTaskInfo.name}
          onConfirm={handleConfirmDelete}
          onCancel={handleCancelDelete}
        />
      )}
    </div>
  );
};

export default ScheduledTasksView;
