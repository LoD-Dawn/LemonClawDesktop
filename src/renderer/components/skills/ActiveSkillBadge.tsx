import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import XMarkIcon from '../icons/XMarkIcon';
import PuzzleIcon from '../icons/PuzzleIcon';
import { RootState } from '../../store';
import { toggleActiveSkill, clearActiveSkills } from '../../store/slices/skillSlice';
import { i18nService } from '../../services/i18n';

const ActiveSkillBadge: React.FC = () => {
  const dispatch = useDispatch();
  const activeSkillIds = useSelector((state: RootState) => state.skill.activeSkillIds);
  const skills = useSelector((state: RootState) => state.skill.skills);

  const activeSkills = activeSkillIds
    .map(id => skills.find(s => s.id === id))
    .filter((s): s is NonNullable<typeof s> => s !== undefined);

  if (activeSkills.length === 0) return null;

  const handleRemoveSkill = (e: React.MouseEvent, skillId: string) => {
    e.stopPropagation();
    dispatch(toggleActiveSkill(skillId));
  };

  const handleClearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    dispatch(clearActiveSkills());
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {activeSkills.map(skill => (
        <div
          key={skill.id}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border border-primary/20 bg-primary/10 dark:border-primary-lighter/35 dark:bg-primary-lighter/15"
        >
          <PuzzleIcon className="h-3 w-3 text-primary dark:text-[#8EC5FF]" />
          <span className="text-xs font-medium text-primary dark:text-dark-text max-w-[80px] truncate">
            {skill.name}
          </span>
          <button
            type="button"
            onClick={(e) => handleRemoveSkill(e, skill.id)}
            className="p-0.5 rounded hover:bg-primary/20 dark:hover:bg-primary-lighter/25 transition-colors"
            title={i18nService.t('clearSkill')}
          >
            <XMarkIcon className="h-2.5 w-2.5 text-primary dark:text-[#8EC5FF]" />
          </button>
        </div>
      ))}
      {activeSkills.length > 1 && (
        <button
          type="button"
          onClick={handleClearAll}
          className="text-xs text-primary/70 hover:text-primary dark:text-dark-text-secondary dark:hover:text-[#A6D8FF] transition-colors"
          title={i18nService.t('clearAllSkills')}
        >
          {i18nService.t('clearAll')}
        </button>
      )}
    </div>
  );
};

export default ActiveSkillBadge;
