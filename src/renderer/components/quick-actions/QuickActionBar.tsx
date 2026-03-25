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
            className="comfort-card group flex flex-col items-start gap-3 px-4 py-4 text-left"
          >
            <div className="flex w-full items-start justify-between gap-3">
              <div
                className="flex h-11 w-11 items-center justify-center rounded-[18px]"
                style={accentStyle}
              >
                {IconComponent && <IconComponent className="h-5 w-5" />}
              </div>
              <span className="soft-pill text-[11px]">
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: action.color }} />
                {action.prompts?.length ?? 0}
              </span>
            </div>
            <div className="space-y-1">
              <div className="text-[15px] font-semibold text-text-primary dark:text-dark-text">
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
