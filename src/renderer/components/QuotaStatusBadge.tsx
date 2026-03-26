import React from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../store';

const formatCredits = (value: number | null | undefined): string => {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '--';
  }

  const normalized = Math.max(0, value);
  if (normalized >= 10000) {
    const wan = normalized / 10000;
    const rounded = wan >= 100 ? Math.round(wan) : Math.round(wan * 10) / 10;
    return `${rounded}万`;
  }

  if (normalized >= 1000) {
    return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 }).format(normalized);
  }

  const rounded = Math.round(normalized * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(1);
};

const QuotaStatusBadge: React.FC = () => {
  const selectedModel = useSelector((state: RootState) => state.model.selectedModel);
  const { overview, loading, liveUsedCreditsBase, sessionReservations } = useSelector((state: RootState) => state.quota);

  if (selectedModel?.source === 'local') {
    return null;
  }

  const quota = overview.quota;
  if (!quota && !loading) {
    return null;
  }

  const liveUsedCreditsByBalance = liveUsedCreditsBase !== null
    && quota?.creditBalance !== null
    && quota?.creditBalance !== undefined
    ? Math.max(0, liveUsedCreditsBase - quota.creditBalance)
    : null;
  const liveUsedCreditsBySessions = Object.values(sessionReservations).reduce((sum, reservation) => {
    if (!reservation?.finalConsumedCredits || !Number.isFinite(reservation.finalConsumedCredits)) {
      return sum;
    }
    return sum + Math.max(0, reservation.finalConsumedCredits);
  }, 0);
  const liveUsedCreditsBySummary = overview.usageSummary?.consumedCredits ?? 0;
  const liveUsedCredits = Math.max(
    liveUsedCreditsByBalance ?? 0,
    liveUsedCreditsBySessions,
    liveUsedCreditsBySummary,
  );
  const usedText = `${formatCredits(liveUsedCredits)}积分`;
  const remainingText = quota?.isUnlimited
    ? '无限'
    : quota ? `${formatCredits(quota.creditBalance)}积分` : '--';

  return (
    <div
      title={quota?.isUnlimited ? '实时已用积分，当前剩余额度无限' : '实时已用积分，当前剩余积分'}
      className="non-draggable inline-flex h-8 items-center gap-1.5 rounded-full border dark:border-dark-border/70 border-border/80 dark:bg-dark-surface/60 bg-surface/75 px-3 text-[11px] font-medium dark:text-dark-text-secondary text-text-secondary backdrop-blur-sm"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500/90 shadow-[0_0_0_3px_rgba(16,185,129,0.12)]" />
      <span className="whitespace-nowrap">
        已用 {usedText}，剩余 {remainingText}
      </span>
    </div>
  );
};

export default QuotaStatusBadge;
