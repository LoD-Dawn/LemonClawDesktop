import React from 'react';
import { useSelector } from 'react-redux';
import { selectQuotaBadgeViewModel } from '../store/selectors/quotaSelectors';

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
  const viewModel = useSelector(selectQuotaBadgeViewModel);

  if (!viewModel.visible) {
    return null;
  }

  const usedText = viewModel.loading
    ? '同步中...'
    : viewModel.usedCreditsInRange !== null
      ? `${formatCredits(viewModel.usedCreditsInRange)}积分`
      : '--';
  const remainingText = viewModel.isUnlimited
    ? '无限'
    : viewModel.remainingCredits !== null
      ? `${formatCredits(viewModel.remainingCredits)}积分`
      : '--';

  return (
    <div
      title={viewModel.isUnlimited ? '近 7 天已用积分，当前剩余额度无限' : '近 7 天已用积分，当前剩余积分'}
      className="non-draggable inline-flex h-8 items-center gap-1.5 rounded-full border dark:border-dark-border/70 border-border/80 dark:bg-dark-surface/60 bg-surface/75 px-3 text-[11px] font-medium dark:text-dark-text-secondary text-text-secondary backdrop-blur-sm"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500/90 shadow-[0_0_0_3px_rgba(16,185,129,0.12)]" />
      <span className="whitespace-nowrap">
        7天已用 {usedText}，剩余 {remainingText}
      </span>
    </div>
  );
};

export default QuotaStatusBadge;
