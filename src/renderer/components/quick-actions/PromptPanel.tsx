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
      <div className="mb-3 space-y-1 px-0.5">
        <span className="text-xs font-semibold tracking-[0.16em] uppercase dark:text-dark-text-secondary text-text-secondary">
          {action.label}
        </span>
        {action.description && (
          <p className="text-sm leading-6 text-text-secondary dark:text-dark-text-secondary">
            {action.description}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {action.prompts.map((prompt) => {
          const isPromptSelected = selectedPromptId === prompt.id;

          return (
            <button
              key={prompt.id}
              type="button"
              onClick={() => handlePromptClick(prompt)}
              className={`
                group relative flex flex-col items-start gap-1.5 px-4 py-3.5 rounded-2xl
                border text-left transition-all duration-200
                ${
                  isPromptSelected
                    ? 'bg-primary-muted border-primary/45 dark:bg-primary-lighter/15 dark:border-primary-lighter/40 shadow-subtle'
                    : 'dark:bg-dark-surface/75 bg-surface/75 dark:border-dark-border/80 border-border/80 dark:hover:border-dark-border hover:border-primary/20 dark:hover:bg-dark-surface-hover hover:bg-surface'
                }
              `}
            >
              {/* 标题 */}
              <div className="flex items-center justify-between w-full">
                <span className={`text-sm font-medium ${isPromptSelected ? 'text-primary dark:text-dark-text' : 'dark:text-dark-text text-text-primary'}`}>
                  {prompt.label}
                </span>
                <ArrowRightIcon
                  className={`
                    w-3.5 h-3.5 transition-all duration-200
                    ${
                      isPromptSelected
                        ? 'text-primary dark:text-secondary-dark translate-x-0 opacity-100'
                        : 'dark:text-dark-text-secondary text-text-secondary -translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-100'
                    }
                  `}
                />
              </div>

              {/* 描述 */}
              {prompt.description && (
                <p className="text-xs dark:text-dark-text-secondary text-text-secondary line-clamp-2">
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
