import React from 'react';
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
  const selectedPromptId = useSelector(
    (state: RootState) => state.quickAction.selectedPromptId
  );

  const handlePromptClick = (prompt: LocalizedPrompt) => {
    dispatch(selectPrompt(prompt.id));
    onPromptSelect(prompt.prompt);
  };

  if (!action.prompts || action.prompts.length === 0) {
    return null;
  }

  return (
    <div className="w-full animate-fade-in-up">
      <div className="mb-5 space-y-2 px-0.5">
        <span className="soft-pill border-white/50 bg-white/[0.65] text-[11px] dark:border-dark-border/70 dark:bg-dark-surface/90">
          {action.label}
        </span>
        {action.description && (
          <p className="text-sm leading-6 text-text-secondary dark:text-dark-text-secondary">
            {action.description}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {action.prompts.map((prompt) => {
          const isPromptSelected = selectedPromptId === prompt.id;

          return (
            <button
              key={prompt.id}
              type="button"
              onClick={() => handlePromptClick(prompt)}
              className={`
                group relative flex flex-col items-start gap-2.5 rounded-[24px] border px-4 py-4 text-left transition-all duration-200
                ${
                  isPromptSelected
                    ? 'border-amber-300/[0.45] bg-[linear-gradient(145deg,rgba(255,247,206,0.88),rgba(255,255,255,0.88))] shadow-[0_18px_40px_rgba(255,204,90,0.18)] dark:border-amber-300/[0.35] dark:bg-[linear-gradient(145deg,rgba(58,44,21,0.84),rgba(16,30,46,0.92))]'
                    : 'border-white/55 bg-white/[0.62] shadow-[0_16px_38px_rgba(44,36,18,0.06)] hover:-translate-y-0.5 hover:bg-white/[0.82] dark:border-dark-border/70 dark:bg-dark-surface/[0.84] dark:hover:bg-dark-surface'
                }
              `}
            >
              <div className="flex items-center justify-between w-full">
                <span className={`font-display text-[16px] font-semibold tracking-[-0.03em] ${isPromptSelected ? 'text-text-primary dark:text-dark-text' : 'dark:text-dark-text text-text-primary'}`}>
                  {prompt.label}
                </span>
                <ArrowRightIcon
                  className={`
                    h-3.5 w-3.5 transition-all duration-200
                    ${
                      isPromptSelected
                        ? 'translate-x-0 opacity-100 text-amber-500 dark:text-amber-300'
                        : 'dark:text-dark-text-secondary text-text-secondary -translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-100'
                    }
                  `}
                />
              </div>

              {prompt.description && (
                <p className="line-clamp-2 text-xs leading-6 dark:text-dark-text-secondary text-text-secondary">
                  {prompt.description}
                </p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default PromptPanel;
