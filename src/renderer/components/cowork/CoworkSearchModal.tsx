import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChatBubbleLeftRightIcon, ClockIcon, XMarkIcon } from '@heroicons/react/24/outline';
import SearchIcon from '../icons/SearchIcon';
import { i18nService } from '../../services/i18n';
import type { CoworkSessionSummary } from '../../types/cowork';
import type { ScheduledTask } from '../../types/scheduledTask';

type SearchScope = 'all' | 'sessions' | 'tasks';

type SearchResult = {
  id: string;
  kind: 'session' | 'task';
  title: string;
  subtitle: string;
};

type SearchSection = {
  key: 'sessions' | 'tasks';
  title: string;
  items: SearchResult[];
};

interface CoworkSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: CoworkSessionSummary[];
  scheduledTasks: ScheduledTask[];
  onSelectSession: (sessionId: string) => Promise<void> | void;
  onSelectScheduledTask: (taskId: string) => void;
}

const RECENT_RESULT_LIMIT = 8;

const highlightText = (text: string, query: string): React.ReactNode => {
  if (!query.trim()) return text;

  const normalizedText = text.toLowerCase();
  const normalizedQuery = query.toLowerCase();
  const parts: React.ReactNode[] = [];
  let startIndex = 0;
  let matchIndex = normalizedText.indexOf(normalizedQuery, startIndex);

  while (matchIndex !== -1) {
    if (matchIndex > startIndex) {
      parts.push(text.slice(startIndex, matchIndex));
    }
    const endIndex = matchIndex + query.length;
    parts.push(
      <mark
        key={`${matchIndex}-${endIndex}`}
        className="rounded bg-primary/15 px-0.5 text-inherit dark:bg-primary/25"
      >
        {text.slice(matchIndex, endIndex)}
      </mark>
    );
    startIndex = endIndex;
    matchIndex = normalizedText.indexOf(normalizedQuery, startIndex);
  }

  if (startIndex < text.length) {
    parts.push(text.slice(startIndex));
  }

  return <>{parts}</>;
};

const formatSessionSubtitle = (session: CoworkSessionSummary): string => (
  new Date(session.updatedAt).toLocaleString()
);

const formatTaskSubtitle = (task: ScheduledTask): string => {
  const statusLabel = task.enabled ? i18nService.t('enabled') : i18nService.t('disabled');
  const nextRun = task.state.nextRunAtMs
    ? new Date(task.state.nextRunAtMs).toLocaleString()
    : i18nService.t('scheduledTasksNotSet');
  return `${statusLabel} · ${i18nService.t('scheduledTasksNextRun')}: ${nextRun}`;
};

const formatSessionStatus = (status: CoworkSessionSummary['status']): string => {
  if (status === 'running') return i18nService.t('coworkStatusRunning');
  if (status === 'completed') return i18nService.t('coworkStatusCompleted');
  if (status === 'error') return i18nService.t('coworkStatusError');
  return i18nService.t('coworkStatusIdle');
};

const CoworkSearchModal: React.FC<CoworkSearchModalProps> = ({
  isOpen,
  onClose,
  sessions,
  scheduledTasks,
  onSelectSession,
  onSelectScheduledTask,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchScope, setSearchScope] = useState<SearchScope>('all');
  const [activeIndex, setActiveIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const normalizedQuery = searchQuery.trim().toLowerCase();

  const sessionResults = useMemo<SearchResult[]>(() => {
    const sortedSessions = [...sessions].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.updatedAt - a.updatedAt;
    });
    const matchedSessions = normalizedQuery
      ? sortedSessions.filter((session) => session.title.toLowerCase().includes(normalizedQuery))
      : sortedSessions.slice(0, RECENT_RESULT_LIMIT);

    return matchedSessions.map((session) => ({
      id: session.id,
      kind: 'session',
      title: session.title,
      subtitle: formatSessionSubtitle(session),
    }));
  }, [sessions, normalizedQuery]);

  const taskResults = useMemo<SearchResult[]>(() => {
    const sortedTasks = [...scheduledTasks].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
    const matchedTasks = normalizedQuery
      ? sortedTasks.filter((task) => {
          const taskText = `${task.name} ${task.prompt} ${task.workingDirectory}`.toLowerCase();
          return taskText.includes(normalizedQuery);
        })
      : sortedTasks.slice(0, RECENT_RESULT_LIMIT);

    return matchedTasks.map((task) => ({
      id: task.id,
      kind: 'task',
      title: task.name,
      subtitle: normalizedQuery && task.prompt.toLowerCase().includes(normalizedQuery)
        ? task.prompt
        : formatTaskSubtitle(task),
    }));
  }, [scheduledTasks, normalizedQuery]);

  const sections = useMemo<SearchSection[]>(() => {
    const nextSections: SearchSection[] = [];
    if (searchScope !== 'tasks' && sessionResults.length > 0) {
      nextSections.push({
        key: 'sessions',
        title: i18nService.t('searchScopeSessions'),
        items: sessionResults,
      });
    }
    if (searchScope !== 'sessions' && taskResults.length > 0) {
      nextSections.push({
        key: 'tasks',
        title: i18nService.t('searchScopeScheduledTasks'),
        items: taskResults,
      });
    }
    return nextSections;
  }, [searchScope, sessionResults, taskResults]);

  const flattenedResults = useMemo(
    () => sections.flatMap((section) => section.items),
    [sections]
  );

  const activeResult = activeIndex >= 0 ? flattenedResults[activeIndex] ?? null : null;
  const activeSession = useMemo(
    () => activeResult?.kind === 'session' ? sessions.find((s) => s.id === activeResult.id) ?? null : null,
    [activeResult, sessions]
  );
  const activeTask = useMemo(
    () => activeResult?.kind === 'task' ? scheduledTasks.find((t) => t.id === activeResult.id) ?? null : null,
    [activeResult, scheduledTasks]
  );

  const handleActivateResult = useCallback(async (result: SearchResult | null) => {
    if (!result) return;
    if (result.kind === 'session') {
      await onSelectSession(result.id);
    } else {
      onSelectScheduledTask(result.id);
    }
    onClose();
  }, [onClose, onSelectScheduledTask, onSelectSession]);

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => {
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      });
      return;
    }
    setSearchQuery('');
    setSearchScope('all');
    setActiveIndex(0);
  }, [isOpen]);

  useEffect(() => {
    if (flattenedResults.length === 0) {
      setActiveIndex(-1);
      return;
    }
    setActiveIndex((prev) => {
      if (prev < 0) return 0;
      return Math.min(prev, flattenedResults.length - 1);
    });
  }, [flattenedResults]);

  useEffect(() => {
    if (activeIndex < 0 || !isOpen) return;
    const activeItem = document.getElementById(`search-result-item-${activeIndex}`);
    activeItem?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (flattenedResults.length === 0) return;
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveIndex((prev) => (prev + 1) % flattenedResults.length);
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveIndex((prev) => (prev - 1 + flattenedResults.length) % flattenedResults.length);
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        void handleActivateResult(flattenedResults[activeIndex] ?? null);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [activeIndex, flattenedResults, handleActivateResult, isOpen, onClose]);

  if (!isOpen) return null;

  const sessionCount = sessionResults.length;
  const taskCount = taskResults.length;
  const totalCount = sessionCount + taskCount;
  const scopeButtons: Array<{ key: SearchScope; label: string; count: number }> = [
    { key: 'all', label: i18nService.t('searchScopeAll'), count: totalCount },
    { key: 'sessions', label: i18nService.t('searchScopeSessions'), count: sessionCount },
    { key: 'tasks', label: i18nService.t('searchScopeScheduledTasks'), count: taskCount },
  ];

  return (
    <div
      className="fixed inset-0 z-50 modal-backdrop flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="relative flex w-[900px] h-[80vh] max-w-[92vw] max-h-[80vh] rounded-2xl dark:border-dark-border border-border border shadow-modal overflow-hidden modal-content"
        role="dialog"
        aria-modal="true"
        aria-label={i18nService.t('search')}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="w-[280px] shrink-0 flex flex-col dark:bg-dark-surface-muted bg-surface-muted border-r dark:border-dark-border border-border rounded-l-2xl overflow-hidden">
          <div className="px-5 pt-5 pb-3 shrink-0">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold dark:text-dark-text text-text-primary">{i18nService.t('search')}</h2>
              <button
                type="button"
                onClick={onClose}
                className="dark:text-dark-text-secondary text-text-secondary dark:hover:text-dark-text hover:text-text-primary p-1.5 dark:hover:bg-dark-surface-hover hover:bg-surface-hover rounded-lg transition-colors"
                aria-label={i18nService.t('close')}
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="relative mt-3">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 dark:text-dark-text-secondary text-text-secondary" />
              <input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={i18nService.t('searchConversations')}
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg dark:bg-dark-surface bg-surface dark:text-dark-text text-text-primary dark:placeholder-dark-text-secondary placeholder-text-secondary border dark:border-dark-border border-border focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              {scopeButtons.map((scope) => (
                <button
                  key={scope.key}
                  type="button"
                  onClick={() => setSearchScope(scope.key)}
                  className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs transition-colors ${
                    searchScope === scope.key
                      ? 'bg-primary text-white'
                      : 'dark:bg-dark-surface-hover bg-surface-hover dark:text-dark-text-secondary text-text-secondary hover:dark:text-dark-text hover:text-text-primary'
                  }`}
                >
                  {scope.label}
                  <span className="opacity-80">{scope.count}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="px-3 pb-3 flex-1 min-h-0 overflow-y-auto">
            {sections.length === 0 ? (
              <div className="py-8 text-center text-sm dark:text-dark-text-secondary text-text-secondary">
                {i18nService.t('searchNoResults')}
              </div>
            ) : (
              (() => {
                let sectionStartIndex = 0;
                return sections.map((section) => {
                  const currentStartIndex = sectionStartIndex;
                  sectionStartIndex += section.items.length;
                  return (
                    <div key={section.key} className="mb-2 last:mb-0">
                      <div className="px-2 py-1 text-xs font-semibold uppercase tracking-wide dark:text-dark-text-secondary text-text-secondary">
                        {section.title}
                      </div>
                      <div className="space-y-1">
                        {section.items.map((item, itemIndex) => {
                          const itemGlobalIndex = currentStartIndex + itemIndex;
                          const isActive = itemGlobalIndex === activeIndex;
                          return (
                            <button
                              id={`search-result-item-${itemGlobalIndex}`}
                              key={`${item.kind}-${item.id}`}
                              type="button"
                              onClick={() => setActiveIndex(itemGlobalIndex)}
                              onDoubleClick={() => void handleActivateResult(item)}
                              className={`w-full text-left rounded-xl px-3 py-2.5 border transition-colors ${
                                isActive
                                  ? 'border-primary/50 bg-primary/10 dark:bg-primary/15'
                                  : 'dark:border-transparent border-transparent hover:dark:bg-dark-surface-hover hover:bg-surface-hover'
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                <span className={`shrink-0 ${item.kind === 'session' ? 'text-primary' : 'text-cyan-500'}`}>
                                  {item.kind === 'session' ? (
                                    <ChatBubbleLeftRightIcon className="h-4 w-4" />
                                  ) : (
                                    <ClockIcon className="h-4 w-4" />
                                  )}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <div className="truncate text-sm font-medium dark:text-dark-text text-text-primary">
                                    {highlightText(item.title, normalizedQuery)}
                                  </div>
                                  <div className="truncate text-xs dark:text-dark-text-secondary text-text-secondary">
                                    {highlightText(item.subtitle, normalizedQuery)}
                                  </div>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                });
              })()
            )}
          </div>

          <div className="px-5 py-3 border-t dark:border-dark-border border-border text-xs dark:text-dark-text-secondary text-text-secondary shrink-0">
            {i18nService.t('searchKeyboardHint')}
          </div>
        </div>

        <div className="relative flex-1 flex flex-col min-w-0 overflow-hidden dark:bg-dark-bg bg-page rounded-r-2xl">
          <div className="flex justify-between items-center px-6 pt-5 pb-3 shrink-0 border-b dark:border-dark-border border-border">
            <h3 className="text-lg font-semibold dark:text-dark-text text-text-primary">{i18nService.t('searchPreviewTitle')}</h3>
          </div>

          <div className="px-6 py-5 flex-1 overflow-y-auto">
            {!activeResult ? (
              <div className="h-full flex items-center justify-center text-sm dark:text-dark-text-secondary text-text-secondary">
                {i18nService.t('searchPreviewEmpty')}
              </div>
            ) : activeSession ? (
              <div className="space-y-5">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs dark:bg-dark-surface-hover bg-surface-hover dark:text-dark-text-secondary text-text-secondary">
                    <ChatBubbleLeftRightIcon className="h-3.5 w-3.5" />
                    {i18nService.t('searchScopeSessions')}
                  </div>
                  <h4 className="mt-3 text-xl font-semibold dark:text-dark-text text-text-primary">{activeSession.title}</h4>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-xl border dark:border-dark-border border-border p-4">
                    <div className="text-xs dark:text-dark-text-secondary text-text-secondary mb-1">{i18nService.t('scheduledTasksStatus')}</div>
                    <div className="text-sm font-medium dark:text-dark-text text-text-primary">{formatSessionStatus(activeSession.status)}</div>
                  </div>
                  <div className="rounded-xl border dark:border-dark-border border-border p-4">
                    <div className="text-xs dark:text-dark-text-secondary text-text-secondary mb-1">{i18nService.t('coworkHistory')}</div>
                    <div className="text-sm font-medium dark:text-dark-text text-text-primary">{new Date(activeSession.updatedAt).toLocaleString()}</div>
                  </div>
                </div>
              </div>
            ) : activeTask ? (
              <div className="space-y-5">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs dark:bg-dark-surface-hover bg-surface-hover dark:text-dark-text-secondary text-text-secondary">
                    <ClockIcon className="h-3.5 w-3.5" />
                    {i18nService.t('searchScopeScheduledTasks')}
                  </div>
                  <h4 className="mt-3 text-xl font-semibold dark:text-dark-text text-text-primary">{activeTask.name}</h4>
                </div>
                <div className="rounded-xl border dark:border-dark-border border-border p-4">
                  <div className="text-xs dark:text-dark-text-secondary text-text-secondary mb-2">{i18nService.t('scheduledTasksPrompt')}</div>
                  <div className="text-sm leading-relaxed dark:text-dark-text text-text-primary whitespace-pre-wrap break-words">{activeTask.prompt}</div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-xl border dark:border-dark-border border-border p-4">
                    <div className="text-xs dark:text-dark-text-secondary text-text-secondary mb-1">{i18nService.t('scheduledTasksStatus')}</div>
                    <div className="text-sm font-medium dark:text-dark-text text-text-primary">{activeTask.enabled ? i18nService.t('enabled') : i18nService.t('disabled')}</div>
                  </div>
                  <div className="rounded-xl border dark:border-dark-border border-border p-4">
                    <div className="text-xs dark:text-dark-text-secondary text-text-secondary mb-1">{i18nService.t('scheduledTasksNextRun')}</div>
                    <div className="text-sm font-medium dark:text-dark-text text-text-primary">
                      {activeTask.state.nextRunAtMs
                        ? new Date(activeTask.state.nextRunAtMs).toLocaleString()
                        : i18nService.t('scheduledTasksNotSet')}
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border dark:border-dark-border border-border p-4">
                  <div className="text-xs dark:text-dark-text-secondary text-text-secondary mb-2">{i18nService.t('scheduledTasksWorkingDirectory')}</div>
                  <div className="text-sm font-mono dark:text-dark-text text-text-primary break-all">{activeTask.workingDirectory || '-'}</div>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-sm dark:text-dark-text-secondary text-text-secondary">
                {i18nService.t('searchPreviewEmpty')}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t dark:border-dark-border border-border shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium rounded-lg dark:text-dark-text-secondary text-text-secondary dark:hover:bg-dark-surface-hover hover:bg-surface-hover transition-colors"
            >
              {i18nService.t('cancel')}
            </button>
            <button
              type="button"
              onClick={() => void handleActivateResult(activeResult)}
              disabled={!activeResult}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeResult
                  ? 'bg-primary hover:bg-primary-light text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
              }`}
            >
              {i18nService.t('searchOpenAction')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CoworkSearchModal;
