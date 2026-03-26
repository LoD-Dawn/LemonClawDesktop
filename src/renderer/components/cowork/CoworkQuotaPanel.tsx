import React, { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';

type CoworkQuotaPanelProps = {
  compact?: boolean;
  title?: string;
  showSessionReservation?: boolean;
};

const formatSeconds = (seconds: number | null | undefined): string => {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) {
    return '--';
  }
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
};

const formatSessionSeconds = (seconds: number | null | undefined): string => {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) {
    return '--';
  }
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  const remainSeconds = total % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainSeconds).padStart(2, '0')}`;
};

const CoworkQuotaPanel: React.FC<CoworkQuotaPanelProps> = ({
  compact = false,
  title = '额度',
  showSessionReservation = true,
}) => {
  const selectedModel = useSelector((state: RootState) => state.model.selectedModel);
  const overview = useSelector((state: RootState) => state.quota.overview);
  const loading = useSelector((state: RootState) => state.quota.loading);
  const currentSession = useSelector((state: RootState) => state.cowork.currentSession);

  const currentModelMeta = useMemo(() => {
    if (!selectedModel?.providerKey || !selectedModel.id || !overview.models?.providers?.length) {
      return null;
    }
    return overview.models.providers
      .find((provider) => provider.provider === selectedModel.providerKey)
      ?.models.find((model) => model.model === selectedModel.id)
      ?.usageMeta ?? null;
  }, [overview.models, selectedModel?.id, selectedModel?.providerKey]);

  if (selectedModel?.source === 'local') {
    return (
      <div className={`rounded-2xl border border-dashed dark:border-dark-border/70 border-border/80 dark:bg-dark-surface/30 bg-white/70 ${compact ? 'px-3 py-2' : 'px-4 py-3'}`}>
        <div className="text-[12px] font-medium dark:text-dark-text text-text-primary">本地模型</div>
        <div className="mt-1 text-[12px] dark:text-dark-text-secondary text-text-secondary">
          当前模型不走组织积分结算。
        </div>
      </div>
    );
  }

  const quota = overview.quota;
  const usage = overview.usageSummary;
  const sessionReservation = currentSession?.quotaReservation ?? null;

  return (
    <div className={`rounded-2xl border dark:border-dark-border/70 border-border/80 dark:bg-dark-surface/60 bg-white/80 backdrop-blur-sm ${compact ? 'px-3 py-2' : 'px-4 py-3'}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[12px] font-medium dark:text-dark-text text-text-primary">{title}</div>
          <div className="mt-1 text-[12px] dark:text-dark-text-secondary text-text-secondary">
            {loading && !quota
              ? '正在同步配额...'
              : quota?.isUnlimited
                ? '无限使用'
                : `${quota?.creditBalance ?? '--'} 积分 · ${formatSeconds(quota?.remainingClawSeconds)} 剩余`}
          </div>
        </div>
        {currentModelMeta?.creditPerMinute !== null && currentModelMeta?.creditPerMinute !== undefined && (
          <div className="rounded-full px-2.5 py-1 text-[11px] font-medium dark:bg-white/5 bg-black/5 dark:text-dark-text-secondary text-text-secondary">
            {currentModelMeta.creditPerMinute} 积分/分钟
          </div>
        )}
      </div>

      <div className={`grid ${compact ? 'grid-cols-2 mt-2' : 'grid-cols-2 md:grid-cols-4 mt-3'} gap-2`}>
        <div className="rounded-xl dark:bg-dark-bg/50 bg-page/80 px-3 py-2">
          <div className="text-[11px] dark:text-dark-text-secondary text-text-secondary">当前模型</div>
          <div className="mt-1 text-[12px] font-medium dark:text-dark-text text-text-primary">
            {currentModelMeta?.billingTierName || selectedModel?.name || '--'}
          </div>
        </div>
        <div className="rounded-xl dark:bg-dark-bg/50 bg-page/80 px-3 py-2">
          <div className="text-[11px] dark:text-dark-text-secondary text-text-secondary">7 天用量</div>
          <div className="mt-1 text-[12px] font-medium dark:text-dark-text text-text-primary">
            {usage ? `${usage.consumedCredits} 积分` : '--'}
          </div>
        </div>
        {!compact && (
          <div className="rounded-xl dark:bg-dark-bg/50 bg-page/80 px-3 py-2">
            <div className="text-[11px] dark:text-dark-text-secondary text-text-secondary">7 天时长</div>
            <div className="mt-1 text-[12px] font-medium dark:text-dark-text text-text-primary">
              {usage ? formatSeconds(usage.usedClawSeconds) : '--'}
            </div>
          </div>
        )}
        {!compact && (
          <div className="rounded-xl dark:bg-dark-bg/50 bg-page/80 px-3 py-2">
            <div className="text-[11px] dark:text-dark-text-secondary text-text-secondary">7 天会话</div>
            <div className="mt-1 text-[12px] font-medium dark:text-dark-text text-text-primary">
              {usage?.sessions ?? '--'}
            </div>
          </div>
        )}
      </div>

      {showSessionReservation && sessionReservation && !sessionReservation.closed && (
        <div className="mt-3 rounded-xl border dark:border-emerald-500/20 border-emerald-500/25 dark:bg-emerald-500/5 bg-emerald-500/10 px-3 py-2 text-[12px]">
          <span className="font-medium dark:text-dark-text text-text-primary">
            本次会话 {formatSessionSeconds(sessionReservation.serverAcceptedTotalActiveSeconds)}
          </span>
          <span className="ml-2 dark:text-dark-text-secondary text-text-secondary">
            / 授权 {formatSessionSeconds(sessionReservation.grantedSeconds)}
          </span>
        </div>
      )}
    </div>
  );
};

export default CoworkQuotaPanel;
