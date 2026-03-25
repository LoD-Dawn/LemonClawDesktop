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
    <div className="flex flex-wrap items-center justify-start gap-2.5">
      {actions.map((action) => {
        const IconComponent = iconMap[action.icon];

        return (
          <button
            key={action.id}
            type="button"
            onClick={() => onActionSelect(action.id)}
            className="flex items-center gap-2 rounded-2xl border border-border/80 dark:border-dark-border/80 bg-surface/80 dark:bg-dark-surface/70 px-4 py-2.5 text-sm font-medium text-text-secondary dark:text-dark-text-secondary transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:bg-surface hover:text-text-primary dark:hover:bg-dark-surface-hover dark:hover:text-dark-text"
          >
            {IconComponent && (
              <IconComponent className="h-4 w-4 text-primary dark:text-secondary-dark" />
            )}
            <span>{action.label}</span>
          </button>
        );
      })}
    </div>
  );
};

export default QuickActionBar;
