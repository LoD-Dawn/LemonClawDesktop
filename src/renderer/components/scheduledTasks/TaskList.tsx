import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../store';
import { selectTask, setViewMode } from '../../store/slices/scheduledTaskSlice';
import { scheduledTaskService } from '../../services/scheduledTask';
import { i18nService } from '../../services/i18n';
import type { ScheduledTask, Schedule } from '../../types/scheduledTask';
import { EllipsisVerticalIcon, ClockIcon, PlusIcon } from '@heroicons/react/24/outline';

const weekdayKeys: Record<number, string> = {
  0: 'scheduledTasksFormWeekSun',
  1: 'scheduledTasksFormWeekMon',
  2: 'scheduledTasksFormWeekTue',
  3: 'scheduledTasksFormWeekWed',
  4: 'scheduledTasksFormWeekThu',
  5: 'scheduledTasksFormWeekFri',
  6: 'scheduledTasksFormWeekSat',
};

function formatScheduleLabel(schedule: Schedule): string {
  if (schedule.type === 'at') {
    const dt = schedule.datetime ?? '';
    if (dt.includes('T')) {
      const date = new Date(dt);
      return `${i18nService.t('scheduledTasksFormScheduleModeOnce')} · ${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    return i18nService.t('scheduledTasksFormScheduleModeOnce');
  }

  if (schedule.type === 'cron' && schedule.expression) {
    const parts = schedule.expression.trim().split(/\s+/);
    if (parts.length >= 5) {
      const [min, hour, dom, , dow] = parts;
      const timeStr = `${hour.padStart(2, '0')}:${min.padStart(2, '0')}`;

      if (dow !== '*' && dom === '*') {
        const dayNum = parseInt(dow) || 0;
        return `${i18nService.t('scheduledTasksFormScheduleModeWeekly')} · ${i18nService.t(weekdayKeys[dayNum] ?? 'scheduledTasksFormWeekSun')} ${timeStr}`;
      }
      if (dom !== '*' && dow === '*') {
        return `${i18nService.t('scheduledTasksFormScheduleModeMonthly')} · ${dom}${i18nService.t('scheduledTasksFormMonthDaySuffix')} ${timeStr}`;
      }
      return `${i18nService.t('scheduledTasksFormScheduleModeDaily')} · ${timeStr}`;
    }
  }

  if (schedule.type === 'interval') {
    return i18nService.t('scheduledTasksFormScheduleModeDaily');
  }

  return '';
}

interface TaskListItemProps {
  task: ScheduledTask;
  onRequestDelete: (taskId: string, taskName: string) => void;
}

const TaskListItem: React.FC<TaskListItemProps> = ({ task, onRequestDelete }) => {
  const dispatch = useDispatch();
  const [showMenu, setShowMenu] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const statusLabel = task.enabled
    ? i18nService.t('scheduledTasksEnabled')
    : i18nService.t('scheduledTasksDisabled');

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const warning = await scheduledTaskService.toggleTask(task.id, !task.enabled);
    if (warning) {
      const msg = warning === 'TASK_AT_PAST'
        ? i18nService.t('scheduledTasksToggleWarningAtPast')
        : warning === 'TASK_EXPIRED'
          ? i18nService.t('scheduledTasksToggleWarningExpired')
          : warning;
      window.dispatchEvent(new CustomEvent('app:showToast', { detail: msg }));
    }
  };

  const handleRunNow = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    await scheduledTaskService.runManually(task.id);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    dispatch(selectTask(task.id));
    dispatch(setViewMode('edit'));
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    onRequestDelete(task.id, task.name);
  };

  return (
    <div
      className={`group grid grid-cols-[1fr_1fr_110px_40px] items-center gap-3 rounded-xl border px-4 py-3 cursor-pointer transition-all ${
        task.state.runningAtMs
          ? 'dark:border-blue-500/30 border-blue-300/60 dark:bg-blue-500/10 bg-blue-50/70'
          : 'dark:border-dark-border/70 border-border/70 dark:bg-dark-surface/35 bg-white/80 hover:dark:bg-dark-surface-hover/55 hover:bg-surface-hover/70'
      }`}
      onClick={() => dispatch(selectTask(task.id))}
    >
      {/* Title */}
      <div className={`text-sm truncate ${task.enabled ? 'dark:text-dark-text text-text-primary' : 'dark:text-dark-text-secondary text-text-secondary'}`}>
        {task.name}
      </div>

      {/* Schedule */}
      <div className="text-sm dark:text-dark-text-secondary text-text-secondary truncate">
        {formatScheduleLabel(task.schedule)}
      </div>

      {/* Status: toggle + running indicator */}
      <div className="flex items-center justify-between gap-2">
        <span className={`text-xs font-medium ${task.enabled ? 'text-primary' : 'dark:text-dark-text-secondary text-text-secondary'}`}>
          {statusLabel}
        </span>

        {/* Running indicator */}
        {task.state.runningAtMs && (
          <span className="inline-flex items-center text-xs text-blue-500">
            <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
              <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" className="opacity-75" />
            </svg>
          </span>
        )}

        {/* Toggle switch */}
        <button
          type="button"
          onClick={handleToggle}
          className={`relative shrink-0 w-7 h-4 rounded-full transition-colors ${
            task.enabled
              ? 'bg-primary'
              : 'dark:bg-dark-surface-hover bg-border'
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform shadow-sm ${
              task.enabled ? 'translate-x-3' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {/* More menu */}
      <div className="flex justify-center">
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
            className="p-1.5 rounded-md dark:text-dark-text-secondary text-text-secondary hover:bg-surface-hover dark:hover:bg-dark-surface-hover transition-colors"
          >
            <EllipsisVerticalIcon className="w-5 h-5" />
          </button>
          {showMenu && (
            <div className="absolute right-0 top-full mt-1 w-32 rounded-lg shadow-lg dark:bg-dark-surface bg-white border dark:border-dark-border border-border z-50 py-1">
              <button
                type="button"
                onClick={handleRunNow}
                disabled={!!task.state.runningAtMs}
                className="w-full text-left px-3 py-1.5 text-sm dark:text-dark-text text-text-primary hover:bg-surface-hover dark:hover:bg-dark-surface-hover disabled:opacity-50"
              >
                {i18nService.t('scheduledTasksRun')}
              </button>
              <button
                type="button"
                onClick={handleEdit}
                className="w-full text-left px-3 py-1.5 text-sm dark:text-dark-text text-text-primary hover:bg-surface-hover dark:hover:bg-dark-surface-hover"
              >
                {i18nService.t('scheduledTasksEdit')}
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="w-full text-left px-3 py-1.5 text-sm text-red-500 hover:bg-surface-hover dark:hover:bg-dark-surface-hover"
              >
                {i18nService.t('scheduledTasksDelete')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface TaskListProps {
  onRequestDelete: (taskId: string, taskName: string) => void;
  onCreateTask?: () => void;
}

const TaskList: React.FC<TaskListProps> = ({ onRequestDelete, onCreateTask }) => {
  const tasks = useSelector((state: RootState) => state.scheduledTask.tasks);
  const loading = useSelector((state: RootState) => state.scheduledTask.loading);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="dark:text-dark-text-secondary text-text-secondary">
          {i18nService.t('loading')}
        </div>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6">
        <div className="mb-4 rounded-2xl p-4 dark:bg-dark-surface/50 bg-surface-hover/70">
          <ClockIcon className="h-10 w-10 dark:text-dark-text-secondary/50 text-text-secondary/50" />
        </div>
        <p className="text-base font-semibold dark:text-dark-text text-text-primary mb-1.5">
          {i18nService.t('scheduledTasksEmptyState')}
        </p>
        <p className="text-sm dark:text-dark-text-secondary/80 text-text-secondary/80 text-center mb-5 max-w-md">
          {i18nService.t('scheduledTasksEmptyHint')}
        </p>
        <button
          type="button"
          onClick={onCreateTask}
          className="app-primary-btn h-10 gap-1.5 px-4 text-sm"
        >
          <PlusIcon className="h-4 w-4" />
          {i18nService.t('scheduledTasksNewTask')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Column Headers */}
      <div className="grid grid-cols-[1fr_1fr_110px_40px] items-center gap-3 px-3 py-1">
        <div className="text-xs font-semibold tracking-wide dark:text-dark-text-secondary text-text-secondary">
          {i18nService.t('scheduledTasksListColTitle')}
        </div>
        <div className="text-xs font-semibold tracking-wide dark:text-dark-text-secondary text-text-secondary">
          {i18nService.t('scheduledTasksListColSchedule')}
        </div>
        <div className="text-xs font-semibold tracking-wide dark:text-dark-text-secondary text-text-secondary">
          {i18nService.t('scheduledTasksListColStatus')}
        </div>
        <div className="text-xs font-semibold tracking-wide dark:text-dark-text-secondary text-text-secondary text-center">
          {i18nService.t('scheduledTasksListColMore')}
        </div>
      </div>
      {tasks.map((task) => (
        <TaskListItem key={task.id} task={task} onRequestDelete={onRequestDelete} />
      ))}
    </div>
  );
};

export default TaskList;
