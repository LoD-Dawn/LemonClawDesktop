import React, { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import type { CoworkSessionSummary } from '../../types/cowork';
import CoworkSessionItem from './CoworkSessionItem';
import { i18nService } from '../../services/i18n';

interface CoworkSessionListProps {
  sessions: CoworkSessionSummary[];
  currentSessionId: string | null;
  isBatchMode: boolean;
  selectedIds: Set<string>;
  showBatchOption?: boolean;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onTogglePin: (sessionId: string, pinned: boolean) => void;
  onRenameSession: (sessionId: string, title: string) => void;
  onToggleSelection: (sessionId: string) => void;
  onEnterBatchMode: (sessionId: string) => void;
}

const CoworkSessionList: React.FC<CoworkSessionListProps> = ({
  sessions,
  currentSessionId,
  isBatchMode,
  selectedIds,
  showBatchOption = true,
  onSelectSession,
  onDeleteSession,
  onTogglePin,
  onRenameSession,
  onToggleSelection,
  onEnterBatchMode,
}) => {
  const unreadSessionIds = useSelector((state: RootState) => state.cowork.unreadSessionIds);
  const unreadSessionIdSet = useMemo(() => new Set(unreadSessionIds), [unreadSessionIds]);

  const sortedSessions = useMemo(() => {
    const sortByRecentActivity = (a: CoworkSessionSummary, b: CoworkSessionSummary) => {
      if (b.updatedAt !== a.updatedAt) {
        return b.updatedAt - a.updatedAt;
      }
      return b.createdAt - a.createdAt;
    };

    const pinnedSessions = sessions
      .filter((session) => session.pinned)
      .sort(sortByRecentActivity);
    const unpinnedSessions = sessions
      .filter((session) => !session.pinned)
      .sort(sortByRecentActivity);
    return [...pinnedSessions, ...unpinnedSessions];
  }, [sessions]);

  if (sessions.length === 0) {
    return (
      <div className="px-6 pt-3 pb-4">
        <div className="text-center select-none">
          <div className="text-[14px] font-medium tracking-[0.01em] dark:text-dark-text text-text-primary">
            {i18nService.t('coworkNoSessions')}
          </div>
          <p className="mt-1.5 text-[12px] leading-5 dark:text-dark-text-secondary/80 text-text-secondary/90">
            {i18nService.t('coworkNoSessionsHint')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {sortedSessions.map((session) => (
        <CoworkSessionItem
          key={session.id}
          session={session}
          hasUnread={unreadSessionIdSet.has(session.id)}
          isActive={session.id === currentSessionId}
          isBatchMode={isBatchMode}
          isSelected={selectedIds.has(session.id)}
          showBatchOption={showBatchOption}
          onSelect={() => onSelectSession(session.id)}
          onDelete={() => onDeleteSession(session.id)}
          onTogglePin={(pinned) => onTogglePin(session.id, pinned)}
          onRename={(title) => onRenameSession(session.id, title)}
          onToggleSelection={() => onToggleSelection(session.id)}
          onEnterBatchMode={() => onEnterBatchMode(session.id)}
        />
      ))}
    </div>
  );
};

export default CoworkSessionList;
