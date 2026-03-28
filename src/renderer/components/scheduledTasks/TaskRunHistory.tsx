import React from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { scheduledTaskService } from '../../services/scheduledTask';
import { i18nService } from '../../services/i18n';
import type { ScheduledTaskRun } from '../../types/scheduledTask';
import { formatDateTime, formatDuration } from './utils';

interface TaskRunHistoryProps {
  taskId: string;
  runs: ScheduledTaskRun[];
}

const statusIcons: Record<string, { icon: string; color: string }> = {
  success: { icon: '✓', color: 'text-green-500' },
  error: { icon: '✗', color: 'text-red-500' },
  skipped: { icon: '↷', color: 'text-yellow-500' },
  running: { icon: '●', color: 'text-blue-500' },
};

const TaskRunHistory: React.FC<TaskRunHistoryProps> = ({ taskId, runs }) => {
  const hasMore = useSelector((state: RootState) => state.scheduledTask.runsHasMore[taskId] ?? false);

  const handleLoadMore = async () => {
    await scheduledTaskService.loadRuns(taskId, 50, runs.length);
  };

  if (runs.length === 0) {
    return (
      <div className="text-center py-6 text-sm dark:text-dark-text-secondary text-text-secondary">
        {i18nService.t('scheduledTasksNoRuns')}
      </div>
    );
  }

  return (
    <div>
      <div className="divide-y dark:divide-dark-border/50 divide-border/50">
        {runs.map((run) => {
          const statusInfo = statusIcons[run.status] || { icon: '?', color: '' };
          return (
            <div key={run.id} className="flex items-center justify-between py-2.5 px-1">
              <div className="flex items-center gap-3 min-w-0">
                <span className={`text-sm font-bold ${statusInfo.color}`}>{statusInfo.icon}</span>
                <div className="min-w-0">
                  <span className="text-sm dark:text-dark-text text-text-primary">
                    {formatDateTime(new Date(run.startedAt))}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0 ml-2">
                {run.durationMs !== null && (
                  <span className="text-xs dark:text-dark-text-secondary text-text-secondary">
                    {formatDuration(run.durationMs)}
                  </span>
                )}
                {run.status === 'error' && run.error && (
                  <span className="text-xs text-red-500 max-w-[150px] truncate" title={run.error}>
                    {run.error}
                  </span>
                )}
                {run.sessionId && (
                  <button
                    type="button"
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent('scheduledTask:viewSession', {
                        detail: { sessionId: run.sessionId },
                      }));
                    }}
                    className="text-xs text-primary hover:text-primary-light transition-colors"
                  >
                    {i18nService.t('scheduledTasksViewSession')}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {hasMore && (
        <button
          type="button"
          onClick={handleLoadMore}
          className="w-full py-2 mt-2 text-sm text-primary hover:text-primary-light transition-colors"
        >
          {i18nService.t('scheduledTasksLoadMore')}
        </button>
      )}
    </div>
  );
};

export default TaskRunHistory;
