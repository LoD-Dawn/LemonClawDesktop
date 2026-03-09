import React, { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { scheduledTaskService } from '../../services/scheduledTask';
import { i18nService } from '../../services/i18n';
import type { ScheduledTaskRunWithName } from '../../types/scheduledTask';
import { ClockIcon } from '@heroicons/react/24/outline';

function formatDuration(ms: number | null): string {
  if (!ms) return '-';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms / 60000)}m`;
}

const statusConfig: Record<string, { label: string; textClass: string; badgeClass: string }> = {
  success: {
    label: 'scheduledTasksStatusSuccess',
    textClass: 'text-green-600 dark:text-green-400',
    badgeClass: 'bg-green-100/80 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  },
  error: {
    label: 'scheduledTasksStatusError',
    textClass: 'text-red-600 dark:text-red-400',
    badgeClass: 'bg-red-100/80 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  },
  running: {
    label: 'scheduledTasksStatusRunning',
    textClass: 'text-blue-600 dark:text-blue-400',
    badgeClass: 'bg-blue-100/80 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  },
};

const AllRunsHistory: React.FC = () => {
  const allRuns = useSelector((state: RootState) => state.scheduledTask.allRuns);

  useEffect(() => {
    scheduledTaskService.loadAllRuns(50);
  }, []);

  const handleLoadMore = () => {
    scheduledTaskService.loadAllRuns(50, allRuns.length);
  };

  const handleViewSession = (run: ScheduledTaskRunWithName) => {
    if (run.sessionId) {
      window.dispatchEvent(new CustomEvent('scheduledTask:viewSession', {
        detail: { sessionId: run.sessionId },
      }));
    }
  };

  if (allRuns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6">
        <div className="mb-4 rounded-2xl p-4 dark:bg-dark-surface/50 bg-surface-hover/70">
          <ClockIcon className="h-10 w-10 dark:text-dark-text-secondary/50 text-text-secondary/50" />
        </div>
        <p className="text-base font-semibold dark:text-dark-text text-text-primary">
          {i18nService.t('scheduledTasksHistoryEmpty')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Column Headers */}
      <div className="grid grid-cols-[1.1fr_1fr_120px] items-center gap-3 px-3 py-1">
        <div className="text-xs font-semibold tracking-wide dark:text-dark-text-secondary text-text-secondary">
          {i18nService.t('scheduledTasksHistoryColTitle')}
        </div>
        <div className="text-xs font-semibold tracking-wide dark:text-dark-text-secondary text-text-secondary">
          {i18nService.t('scheduledTasksHistoryColTime')}
        </div>
        <div className="text-xs font-semibold tracking-wide dark:text-dark-text-secondary text-text-secondary">
          {i18nService.t('scheduledTasksHistoryColStatus')}
        </div>
      </div>

      {/* Run rows */}
      {allRuns.map((run) => {
        const cfg = statusConfig[run.status] || statusConfig.success;
        const triggerLabel = run.trigger === 'manual'
          ? i18nService.t('scheduledTasksManual')
          : i18nService.t('scheduledTasksScheduled');
        const clickable = Boolean(run.sessionId);

        return (
          <div
            key={run.id}
            className={`grid grid-cols-[1.1fr_1fr_120px] items-center gap-3 rounded-xl border px-4 py-3 transition-all ${
              clickable
                ? 'cursor-pointer dark:border-dark-border/70 border-border/70 dark:bg-dark-surface/35 bg-white/80 hover:dark:bg-dark-surface-hover/55 hover:bg-surface-hover/70'
                : 'dark:border-dark-border/65 border-border/65 dark:bg-dark-surface/30 bg-white/70'
            }`}
            onClick={() => handleViewSession(run)}
          >
            {/* Task title */}
            <div className="min-w-0">
              <div className="text-sm font-medium dark:text-dark-text text-text-primary truncate">
                {run.taskName}
                {run.status === 'running' && (
                  <svg className="inline-block w-3 h-3 ml-1.5 animate-spin text-blue-500" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                    <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" className="opacity-75" />
                  </svg>
                )}
              </div>
              <div className="mt-1 flex items-center gap-2 text-xs dark:text-dark-text-secondary text-text-secondary">
                <span className="inline-flex items-center rounded-md px-1.5 py-0.5 dark:bg-dark-surface-hover/80 bg-surface-hover/90">
                  {triggerLabel}
                </span>
                {clickable && (
                  <span className="text-primary">{i18nService.t('scheduledTasksViewSession')}</span>
                )}
              </div>
            </div>

            {/* Run time + duration */}
            <div className="min-w-0">
              <div className="text-sm dark:text-dark-text-secondary text-text-secondary truncate">
                {new Date(run.startedAt).toLocaleString()}
              </div>
              <div className="mt-1 text-xs dark:text-dark-text-secondary/80 text-text-secondary/80">
                {run.durationMs !== null ? formatDuration(run.durationMs) : '-'}
              </div>
            </div>

            {/* Status */}
            <div className="flex justify-start">
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${cfg.badgeClass} ${cfg.textClass}`}>
                {i18nService.t(cfg.label)}
              </span>
            </div>

            {run.status === 'error' && run.error && (
              <div className="col-span-full mt-2 rounded-lg border border-red-200/70 dark:border-red-900/40 bg-red-50/80 dark:bg-red-900/20 px-3 py-2 text-xs text-red-600 dark:text-red-300">
                {run.error}
              </div>
            )}
          </div>
        );
      })}

      {/* Load more */}
      {allRuns.length >= 50 && allRuns.length % 50 === 0 && (
        <button
          type="button"
          onClick={handleLoadMore}
          className="w-full py-3 text-sm text-primary hover:text-primary-light transition-colors rounded-lg hover:bg-surface-hover/60 dark:hover:bg-dark-surface-hover/60"
        >
          {i18nService.t('scheduledTasksLoadMore')}
        </button>
      )}
    </div>
  );
};

export default AllRunsHistory;
