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
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
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
            className="group flex flex-col items-start gap-3 rounded-[24px] border border-border/80 dark:border-dark-border/80 bg-surface/82 dark:bg-dark-surface/72 px-4 py-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:bg-surface dark:hover:bg-dark-surface-hover hover:shadow-subtle"
          >
            <div className="flex w-full items-start gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-2xl"
                style={accentStyle}
              >
                {IconComponent && <IconComponent className="h-5 w-5" />}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-sm font-semibold text-text-primary dark:text-dark-text">
                {action.label}
              </div>
              {action.description && (
                <p className="text-xs leading-6 text-text-secondary dark:text-dark-text-secondary">
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
