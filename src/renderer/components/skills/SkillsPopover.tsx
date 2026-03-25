import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useSelector } from 'react-redux';
import { CheckIcon } from '@heroicons/react/24/outline';
import SearchIcon from '../icons/SearchIcon';
import PuzzleIcon from '../icons/PuzzleIcon';
import Cog6ToothIcon from '../icons/Cog6ToothIcon';
import { i18nService } from '../../services/i18n';
import { skillService } from '../../services/skill';
import { RootState } from '../../store';
import { Skill } from '../../types/skill';

interface SkillsPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSkill: (skill: Skill) => void;
  onManageSkills: () => void;
  anchorRef: React.RefObject<HTMLElement>;
}

const SkillsPopover: React.FC<SkillsPopoverProps> = ({
  isOpen,
  onClose,
  onSelectSkill,
  onManageSkills,
  anchorRef,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [maxListHeight, setMaxListHeight] = useState(256); // default max-h-64 = 256px
  const [popoverPosition, setPopoverPosition] = useState<{ left: number; bottom: number } | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const skills = useSelector((state: RootState) => state.skill.skills);
  const activeSkillIds = useSelector((state: RootState) => state.skill.activeSkillIds);

  // Filter enabled skills based on search query
  const filteredSkills = skills
    .filter(s => s.enabled)
    .filter(s =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      skillService.getLocalizedSkillDescription(s.id, s.name, s.description).toLowerCase().includes(searchQuery.toLowerCase())
    );

  // Calculate available height and floating position when popover opens
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setPopoverPosition(null);
      return;
    }

    const updatePosition = () => {
      if (!anchorRef.current) return;
      const anchorRect = anchorRef.current.getBoundingClientRect();
      const popoverWidth = 288;
      const viewportPadding = 12;
      const availableHeight = anchorRect.top - 120 - 60;
      const left = Math.min(
        Math.max(viewportPadding, anchorRect.left),
        window.innerWidth - popoverWidth - viewportPadding
      );
      const bottom = Math.max(viewportPadding, window.innerHeight - anchorRect.top + 8);

      // Clamp between 120px (minimum usable) and 256px (default max)
      setMaxListHeight(Math.max(120, Math.min(256, availableHeight)));
      setPopoverPosition({ left, bottom });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, anchorRef]);

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      if (searchInputRef.current) {
        setTimeout(() => searchInputRef.current?.focus(), 0);
      }
    }
  }, [isOpen]);

  // Handle click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const isInsidePopover = popoverRef.current?.contains(target);
      const isInsideAnchor = anchorRef.current?.contains(target);

      if (!isInsidePopover && !isInsideAnchor) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose, anchorRef]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const handleSelectSkill = (skill: Skill) => {
    onSelectSkill(skill);
    // Don't close popover to allow multi-selection
  };

  const handleManageSkills = () => {
    onManageSkills();
    onClose();
  };

  if (!isOpen || !popoverPosition || typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={popoverRef}
      className="fixed z-[9999] w-72 rounded-xl border dark:border-dark-border border-border dark:bg-dark-surface bg-surface shadow-xl"
      style={{ left: popoverPosition.left, bottom: popoverPosition.bottom }}
    >
      {/* Search input */}
      <div className="p-3 border-b dark:border-dark-border border-border">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 dark:text-dark-text-secondary text-text-secondary" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder={i18nService.t('searchSkills')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg dark:bg-dark-surface bg-surface dark:text-dark-text text-text-primary dark:placeholder-dark-text-secondary placeholder-text-secondary border dark:border-dark-border border-border focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      {/* Skills list */}
      <div className="overflow-y-auto py-1" style={{ maxHeight: `${maxListHeight}px` }}>
        {filteredSkills.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm dark:text-dark-text-secondary text-text-secondary">
            {i18nService.t('noSkillsAvailable')}
          </div>
        ) : (
          filteredSkills.map((skill) => {
            const isActive = activeSkillIds.includes(skill.id);
            return (
              <button
                key={skill.id}
                onClick={() => handleSelectSkill(skill)}
                className={`w-full flex items-start gap-3 px-3 py-2.5 text-left transition-colors ${
                  isActive
                    ? 'bg-primary/10 dark:bg-primary-lighter/15'
                    : 'dark:hover:bg-dark-surface-hover hover:bg-surface-hover'
                }`}
              >
                <div className={`mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  isActive
                    ? 'bg-primary text-white'
                    : 'dark:bg-dark-surface-hover bg-surface-hover'
                }`}>
                  {isActive ? (
                    <CheckIcon className="h-4 w-4" />
                  ) : (
                    <PuzzleIcon className="h-4 w-4 dark:text-dark-text-secondary text-text-secondary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium truncate ${
                      isActive
                        ? 'text-primary dark:text-dark-text'
                        : 'dark:text-dark-text text-text-primary'
                    }`}>
                      {skill.name}
                    </span>
                    {skill.isOfficial && (
                      <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-primary/10 text-primary dark:bg-primary-lighter/20 dark:text-[#8EC5FF] flex-shrink-0">
                        {i18nService.t('official')}
                      </span>
                    )}
                  </div>
                  <p className="text-xs dark:text-dark-text-secondary text-text-secondary truncate mt-0.5">
                    {skillService.getLocalizedSkillDescription(skill.id, skill.name, skill.description)}
                  </p>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Footer - Manage Skills */}
      <div className="border-t dark:border-dark-border border-border">
        <button
          onClick={handleManageSkills}
          className="w-full flex items-center justify-between px-4 py-3 text-sm dark:text-dark-text text-text-primary dark:hover:bg-dark-surface-hover hover:bg-surface-hover transition-colors rounded-b-xl"
        >
          <span>{i18nService.t('manageSkills')}</span>
          <Cog6ToothIcon className="h-4 w-4 dark:text-dark-text-secondary text-text-secondary" />
        </button>
      </div>
    </div>,
    document.body
  );
};

export default SkillsPopover;
