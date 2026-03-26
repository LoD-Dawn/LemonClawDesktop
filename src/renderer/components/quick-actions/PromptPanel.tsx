import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../store';
import { selectPrompt } from '../../store/slices/quickActionSlice';
import type { LocalizedQuickAction, LocalizedPrompt } from '../../types/quickAction';
import { ArrowRightIcon } from '@heroicons/react/24/outline';

interface PromptPanelProps {
  action: LocalizedQuickAction;
  onPromptSelect: (prompt: string) => void;
}

const PromptPanel: React.FC<PromptPanelProps> = ({ action, onPromptSelect }) => {
  const dispatch = useDispatch();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollArrowDir, setScrollArrowDir] = useState<'right' | 'left' | null>('right');
  const selectedPromptId = useSelector(
    (state: RootState) => state.quickAction.selectedPromptId
  );

  const handlePromptClick = (prompt: LocalizedPrompt) => {
    dispatch(selectPrompt(prompt.id));
    onPromptSelect(prompt.prompt);
  };

  // Update arrow direction based on scroll position
  const updateArrow = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const hasOverflow = el.scrollWidth > el.clientWidth + 1;
    if (!hasOverflow) {
      setScrollArrowDir(null);
      return;
    }
    const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 2;
    setScrollArrowDir(atEnd ? 'left' : 'right');
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateArrow();
    el.addEventListener('scroll', updateArrow, { passive: true });
    return () => el.removeEventListener('scroll', updateArrow);
  }, [action, updateArrow]);

  const handleArrowClick = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (scrollArrowDir === 'right') {
      el.scrollBy({ left: 220, behavior: 'smooth' });
    } else {
      el.scrollTo({ left: 0, behavior: 'smooth' });
    }
  }, [scrollArrowDir]);



  if (!action.prompts || action.prompts.length === 0) {
    return null;
  }

  return (
    <div className="w-full animate-fade-in-up">
      {/* 标题 */}
      <div className="mb-2.5 px-0.5">
        <span className="text-xs font-medium dark:text-dark-text-secondary text-text-secondary">
          {action.label}
        </span>
      </div>

      {/* 提示词卡片列表 + 箭头 */}
      <div className="flex items-center gap-3">
        <div
          ref={scrollRef}
          className="flex overflow-x-auto gap-2 pb-1 -mx-2 px-2 scrollbar-hide snap-x flex-1 min-w-0"
        >
          {action.prompts.map((prompt) => {
            const isPromptSelected = selectedPromptId === prompt.id;

            return (
              <button
                key={prompt.id}
                type="button"
                onClick={() => handlePromptClick(prompt)}
                className={`
                  group relative flex flex-col items-start gap-1 px-3 py-2.5 rounded-lg
                  border text-left transition-all duration-200 flex-shrink-0 min-w-[180px] max-w-[260px] snap-start
                  ${
                    isPromptSelected
                      ? 'bg-primary-muted border-primary/50 dark:bg-primary-lighter/15 dark:border-primary-lighter/40'
                      : 'dark:bg-dark-surface bg-surface dark:border-dark-border border-border dark:hover:border-dark-border hover:border-border dark:hover:bg-dark-surface-hover hover:bg-surface-hover'
                  }
                `}
              >
                {/* 标题 */}
                <div className="flex items-center justify-between w-full gap-2">
                  <span className={`text-[13px] font-medium truncate ${isPromptSelected ? 'text-primary dark:text-dark-text' : 'dark:text-dark-text text-text-primary'}`}>
                    {prompt.label}
                  </span>
                  <ArrowRightIcon
                    className={`
                      flex-shrink-0 w-3 h-3 transition-all duration-200
                      ${
                        isPromptSelected
                          ? 'text-primary dark:text-[#8EC5FF] translate-x-0 opacity-100'
                          : 'dark:text-dark-text-secondary text-text-secondary -translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-100'
                      }
                    `}
                  />
                </div>

                {/* 描述 */}
                {prompt.description && (
                  <p className="text-[11px] dark:text-dark-text-secondary text-text-secondary line-clamp-2 w-full">
                    {prompt.description}
                  </p>
                )}
              </button>
            );
          })}
        </div>

        {/* 箭头导航按钮 */}
        {scrollArrowDir && (
          <button
            type="button"
            onClick={handleArrowClick}
            className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full border border-border dark:border-dark-border bg-surface dark:bg-dark-surface hover:bg-surface-hover dark:hover:bg-dark-surface-hover transition-colors"
          >
            <svg className="w-3.5 h-3.5 text-text-secondary dark:text-dark-text-secondary" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              {scrollArrowDir === 'right' ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
              )}
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};

export default PromptPanel;
