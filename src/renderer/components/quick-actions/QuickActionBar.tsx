import React from 'react';
import type { LocalizedQuickAction } from '../../types/quickAction';
import PresentationChartBarIcon from '../icons/PresentationChartBarIcon';
import GlobeAltIcon from '../icons/GlobeAltIcon';
import DevicePhoneMobileIcon from '../icons/DevicePhoneMobileIcon';
import ChartBarIcon from '../icons/ChartBarIcon';
import AcademicCapIcon from '../icons/AcademicCapIcon';

interface QuickActionBarProps {
  actions: LocalizedQuickAction[];
  onActionSelect: (actionId: string) => void;
}

// 图标映射
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  PresentationChartBarIcon,
  GlobeAltIcon,
  DevicePhoneMobileIcon,
  ChartBarIcon,
  AcademicCapIcon,
};

const QuickActionBar: React.FC<QuickActionBarProps> = ({ actions, onActionSelect }) => {
  if (actions.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      {actions.map((action) => {
        const IconComponent = iconMap[action.icon];
        const accentStyle = {
          backgroundColor: `${action.color}18`,
          color: action.color,
        };

        return (
          <button
            key={action.id}
            type="button"
            onClick={() => onActionSelect(action.id)}
            className="quick-action-tile group flex min-h-[136px] flex-col items-start gap-3 rounded-[26px] border border-white/60 bg-white/70 px-4 py-4 text-left shadow-[0_18px_40px_rgba(44,36,18,0.08)] transition-all duration-200 hover:-translate-y-1 hover:bg-white/[0.86] dark:border-dark-border/70 dark:bg-dark-surface/[0.88] dark:shadow-[0_24px_48px_rgba(0,0,0,0.22)] dark:hover:bg-dark-surface"
          >
            <div
              className="absolute inset-x-0 top-0 h-1.5 opacity-80"
              style={{ background: `linear-gradient(90deg, ${action.color}, transparent)` }}
            />
            <div className="flex w-full items-start justify-between gap-3">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-[18px] shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]"
                style={accentStyle}
              >
                {IconComponent && <IconComponent className="h-5 w-5" />}
              </div>
              <span className="soft-pill border-white/50 bg-white/60 text-[11px] dark:border-dark-border/70 dark:bg-dark-surface/90">
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: action.color }} />
                {action.prompts?.length ?? 0}
              </span>
            </div>
            <div className="space-y-1">
              <div className="font-display text-[17px] font-semibold tracking-[-0.04em] text-text-primary dark:text-dark-text">
                {action.label}
              </div>
              {action.description && (
                <p className="text-[12px] leading-5 text-text-secondary dark:text-dark-text-secondary">
                  {action.description}
                </p>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
};

export default QuickActionBar;
