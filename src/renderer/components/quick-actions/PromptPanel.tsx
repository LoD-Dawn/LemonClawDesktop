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
      <div className="mb-4 space-y-2 px-0.5">
        <span className="soft-pill text-[11px]">
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
                group comfort-card relative flex flex-col items-start gap-2 px-4 py-4 text-left
                ${
                  isPromptSelected
                    ? 'bg-primary-muted border-primary/45 dark:bg-primary-lighter/15 dark:border-primary-lighter/40 shadow-card'
                    : ''
                }
              `}
            >
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

              {prompt.description && (
                <p className="text-xs leading-6 dark:text-dark-text-secondary text-text-secondary line-clamp-2">
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
