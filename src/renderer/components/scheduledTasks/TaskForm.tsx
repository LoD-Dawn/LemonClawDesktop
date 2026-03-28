import React, { useEffect, useState } from 'react';
import { scheduledTaskService } from '../../services/scheduledTask';
import { i18nService } from '../../services/i18n';
import type {
  ScheduledTask,
  ScheduledTaskChannelOption,
  ScheduledTaskConversationOption,
  ScheduledTaskInput,
} from '../../types/scheduledTask';
import { formatScheduleLabel, type PlanType, scheduleToPlanInfo } from './utils';

interface TaskFormProps {
  mode: 'create' | 'edit';
  task?: ScheduledTask;
  onCancel: () => void;
  onSaved: () => void;
}

interface FormState {
  name: string;
  description: string;
  planType: PlanType;
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number;
  monthDay: number;
  payloadText: string;
  notifyChannel: string;
  notifyTo: string;
}

function nowDefaults() {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
    hour: 9,
    minute: 0,
    second: 0,
  };
}

const DEFAULT_FORM_STATE: FormState = {
  name: '',
  description: '',
  planType: 'daily',
  ...nowDefaults(),
  weekday: 1,
  monthDay: 1,
  payloadText: '',
  notifyChannel: 'none',
  notifyTo: '',
};

const IM_CHANNEL_VALUES = new Set([
  'dingtalk',
  'feishu',
  'telegram',
  'discord',
  'qq',
  'wecom',
  'nim',
  'xiaomifeng',
]);

function isIMChannel(channel: string): boolean {
  return IM_CHANNEL_VALUES.has(channel);
}

function createFormState(task?: ScheduledTask): FormState {
  if (!task) return { ...DEFAULT_FORM_STATE, ...nowDefaults() };

  const planInfo = scheduleToPlanInfo(task.schedule);
  return {
    name: task.name,
    description: task.description,
    planType: planInfo.planType,
    year: planInfo.year,
    month: planInfo.month,
    day: planInfo.day,
    hour: planInfo.hour,
    minute: planInfo.minute,
    second: planInfo.second,
    weekday: planInfo.weekday,
    monthDay: planInfo.monthDay,
    payloadText: task.payload.kind === 'systemEvent' ? task.payload.text : task.payload.message,
    notifyChannel: task.delivery.channel || 'none',
    notifyTo: task.delivery.to || '',
  };
}

function buildScheduleInput(form: FormState): ScheduledTaskInput['schedule'] {
  if (form.planType === 'once') {
    const date = new Date(form.year, form.month - 1, form.day, form.hour, form.minute, form.second);
    return { kind: 'at', at: date.toISOString() };
  }

  const min = String(form.minute);
  const hour = String(form.hour);
  if (form.planType === 'daily') {
    return { kind: 'cron', expr: `${min} ${hour} * * *` };
  }
  if (form.planType === 'weekly') {
    return { kind: 'cron', expr: `${min} ${hour} * * ${form.weekday}` };
  }
  return { kind: 'cron', expr: `${min} ${hour} ${form.monthDay} * *` };
}

const WEEKDAY_KEYS = [
  'scheduledTasksFormWeekSun',
  'scheduledTasksFormWeekMon',
  'scheduledTasksFormWeekTue',
  'scheduledTasksFormWeekWed',
  'scheduledTasksFormWeekThu',
  'scheduledTasksFormWeekFri',
  'scheduledTasksFormWeekSat',
] as const;

const TaskForm: React.FC<TaskFormProps> = ({ mode, task, onCancel, onSaved }) => {
  const [form, setForm] = useState<FormState>(() => createFormState(task));
  const [channelOptions, setChannelOptions] = useState<ScheduledTaskChannelOption[]>([]);
  const [conversations, setConversations] = useState<ScheduledTaskConversationOption[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isAdvanced = form.planType === 'advanced';
  const showConversationSelector = isIMChannel(form.notifyChannel);

  useEffect(() => {
    setForm(createFormState(task));
  }, [task]);

  useEffect(() => {
    let cancelled = false;
    void scheduledTaskService.listChannels().then((channels) => {
      if (cancelled) return;
      setChannelOptions(channels);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!showConversationSelector) {
      setConversations([]);
      return;
    }

    let cancelled = false;
    setConversationsLoading(true);
    void scheduledTaskService.listChannelConversations(form.notifyChannel).then((result) => {
      if (cancelled) return;
      setConversations(result);
      setConversationsLoading(false);
      if (result.length > 0 && !form.notifyTo) {
        setForm((current) => ({ ...current, notifyTo: result[0].conversationId }));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [form.notifyChannel, form.notifyTo, showConversationSelector]);

  const updateForm = (patch: Partial<FormState>) => {
    setForm((current) => ({ ...current, ...patch }));
  };

  const validate = (): boolean => {
    const nextErrors: Record<string, string> = {};

    if (!form.name.trim()) {
      nextErrors.name = i18nService.t('scheduledTasksFormValidationNameRequired');
    }
    if (!form.payloadText.trim()) {
      nextErrors.payloadText = i18nService.t('scheduledTasksFormValidationPromptRequired');
    }
    if (form.planType === 'once') {
      const runAt = new Date(form.year, form.month - 1, form.day, form.hour, form.minute, form.second);
      if (runAt.getTime() <= Date.now()) {
        nextErrors.schedule = i18nService.t('scheduledTasksFormValidationDatetimeFuture');
      }
    }
    if (!isAdvanced && (form.hour < 0 || form.hour > 23 || form.minute < 0 || form.minute > 59)) {
      nextErrors.schedule = i18nService.t('scheduledTasksFormValidationTimeRequired');
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setSubmitting(true);
    try {
      const payload = task?.payload.kind === 'systemEvent'
        ? {
            kind: 'systemEvent' as const,
            text: form.payloadText.trim(),
          }
        : {
            kind: 'agentTurn' as const,
            message: form.payloadText.trim(),
          };
      const delivery = form.notifyChannel === 'none'
        ? { mode: 'none' as const }
        : {
            mode: 'announce' as const,
            channel: form.notifyChannel,
            ...(form.notifyTo ? { to: form.notifyTo } : {}),
          };
      const schedule = isAdvanced && task ? task.schedule : buildScheduleInput(form);

      if (mode === 'create') {
        const input: ScheduledTaskInput = {
          name: form.name.trim(),
          description: '',
          enabled: true,
          schedule,
          sessionTarget: 'isolated',
          wakeMode: 'now',
          payload,
          delivery,
        };
        await scheduledTaskService.createTask(input);
      } else if (task) {
        await scheduledTaskService.updateTaskById(task.id, {
          name: form.name.trim(),
          description: task.description,
          enabled: task.enabled,
          schedule,
          sessionTarget: task.sessionTarget,
          wakeMode: task.wakeMode,
          payload,
          delivery,
          agentId: task.agentId,
          sessionKey: task.sessionKey,
          origin: task.origin,
          binding: task.binding,
        });
      }
      onSaved();
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = 'w-full rounded-xl border dark:border-dark-border/80 border-border/80 dark:bg-dark-surface/80 bg-white/95 px-3 py-2.5 text-sm dark:text-dark-text text-text-primary shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-colors';
  const labelClass = 'block text-sm font-semibold dark:text-dark-text text-text-primary mb-1.5';
  const errorClass = 'text-xs text-red-500 mt-1';

  const timeValue = `${String(form.hour).padStart(2, '0')}:${String(form.minute).padStart(2, '0')}`;
  const handleTimeChange = (value: string) => {
    const [hour, minute] = value.split(':').map(Number);
    if (!Number.isNaN(hour) && !Number.isNaN(minute)) {
      updateForm({ hour, minute });
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 rounded-2xl border dark:border-dark-border/70 border-border/70 dark:bg-dark-surface/40 bg-surface-hover/35 px-4 py-3">
        <h2 className="text-lg font-semibold dark:text-dark-text text-text-primary">
          {mode === 'create' ? i18nService.t('scheduledTasksFormCreate') : i18nService.t('scheduledTasksFormUpdate')}
        </h2>
        <p className="mt-1 text-xs dark:text-dark-text-secondary text-text-secondary">
          {i18nService.t('scheduledTasksEmptyHint')}
        </p>
      </div>

      <div className="mt-5 flex-1 min-h-0 overflow-y-auto pr-1">
        <div className="space-y-5 pb-4">
          <div className="rounded-2xl border dark:border-dark-border/70 border-border/70 dark:bg-dark-surface/35 bg-white/60 p-4">
            <label className={labelClass}>{i18nService.t('scheduledTasksFormName')}</label>
            <input
              type="text"
              value={form.name}
              onChange={(event) => updateForm({ name: event.target.value })}
              className={inputClass}
              placeholder={i18nService.t('scheduledTasksFormNamePlaceholder')}
            />
            {errors.name && <p className={errorClass}>{errors.name}</p>}
          </div>

          <div className="rounded-2xl border dark:border-dark-border/70 border-border/70 dark:bg-dark-surface/35 bg-white/60 p-4">
            <label className={labelClass}>{i18nService.t('scheduledTasksFormPayloadTextAgent')}</label>
            <textarea
              value={form.payloadText}
              onChange={(event) => updateForm({ payloadText: event.target.value })}
              className={`${inputClass} h-32 resize-y min-h-28`}
              placeholder={i18nService.t('scheduledTasksFormPromptPlaceholder')}
            />
            {errors.payloadText && <p className={errorClass}>{errors.payloadText}</p>}
          </div>

          <div className="rounded-2xl border dark:border-dark-border/70 border-border/70 dark:bg-dark-surface/35 bg-white/60 p-4">
            <label className={labelClass}>{i18nService.t('scheduledTasksFormScheduleType')}</label>
            {isAdvanced ? (
              <div className="rounded-lg bg-surface-hover/30 dark:bg-dark-surface-hover/30 p-3">
                <p className="text-sm dark:text-dark-text-secondary text-text-secondary">
                  {task ? formatScheduleLabel(task.schedule) : ''}
                </p>
                <p className="text-xs dark:text-dark-text-secondary text-text-secondary mt-1">
                  {i18nService.t('scheduledTasksAdvancedSchedule')}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <select
                  value={form.planType}
                  onChange={(event) => updateForm({ planType: event.target.value as PlanType })}
                  className={inputClass}
                >
                  <option value="once">{i18nService.t('scheduledTasksFormScheduleModeOnce')}</option>
                  <option value="daily">{i18nService.t('scheduledTasksFormScheduleModeDaily')}</option>
                  <option value="weekly">{i18nService.t('scheduledTasksFormScheduleModeWeekly')}</option>
                  <option value="monthly">{i18nService.t('scheduledTasksFormScheduleModeMonthly')}</option>
                </select>

                {form.planType === 'once' ? (
                  <input
                    type="date"
                    value={`${form.year}-${String(form.month).padStart(2, '0')}-${String(form.day).padStart(2, '0')}`}
                    onChange={(event) => {
                      const [year, month, day] = event.target.value.split('-').map(Number);
                      if (!Number.isNaN(year)) updateForm({ year, month, day });
                    }}
                    className={inputClass}
                  />
                ) : form.planType === 'weekly' ? (
                  <select
                    value={form.weekday}
                    onChange={(event) => updateForm({ weekday: Number(event.target.value) })}
                    className={inputClass}
                  >
                    {WEEKDAY_KEYS.map((key, index) => (
                      <option key={key} value={index}>{i18nService.t(key)}</option>
                    ))}
                  </select>
                ) : form.planType === 'monthly' ? (
                  <select
                    value={form.monthDay}
                    onChange={(event) => updateForm({ monthDay: Number(event.target.value) })}
                    className={inputClass}
                  >
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                      <option key={day} value={day}>
                        {day}{i18nService.t('scheduledTasksFormMonthDaySuffix')}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input type="time" value={timeValue} onChange={(event) => handleTimeChange(event.target.value)} className={inputClass} />
                )}

                <input
                  type={form.planType === 'once' ? 'time' : 'time'}
                  step={form.planType === 'once' ? 1 : undefined}
                  value={form.planType === 'once'
                    ? `${timeValue}:${String(form.second).padStart(2, '0')}`
                    : timeValue}
                  onChange={(event) => {
                    const parts = event.target.value.split(':').map(Number);
                    const patch: Partial<FormState> = {};
                    if (!Number.isNaN(parts[0])) patch.hour = parts[0];
                    if (!Number.isNaN(parts[1])) patch.minute = parts[1];
                    if (parts.length > 2 && !Number.isNaN(parts[2])) patch.second = parts[2];
                    updateForm(patch);
                  }}
                  className={inputClass}
                />
              </div>
            )}
            {errors.schedule && <p className={errorClass}>{errors.schedule}</p>}
          </div>

          <div className="rounded-2xl border dark:border-dark-border/70 border-border/70 dark:bg-dark-surface/35 bg-white/60 p-4">
            <label className={labelClass}>{i18nService.t('scheduledTasksFormNotifyChannel')}</label>
            <div className={`grid gap-2 ${showConversationSelector ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
              <select
                value={form.notifyChannel}
                onChange={(event) => updateForm({ notifyChannel: event.target.value, notifyTo: '' })}
                className={inputClass}
              >
                <option value="none">{i18nService.t('scheduledTasksFormNotifyChannelNone')}</option>
                {channelOptions.map((channel) => (
                  <option key={channel.value} value={channel.value}>
                    {channel.label}
                  </option>
                ))}
              </select>
              {showConversationSelector && (
                <select
                  value={form.notifyTo}
                  onChange={(event) => updateForm({ notifyTo: event.target.value })}
                  disabled={conversationsLoading}
                  className={inputClass}
                >
                  {conversationsLoading ? (
                    <option value="">{i18nService.t('scheduledTasksFormNotifyConversationLoading')}</option>
                  ) : conversations.length === 0 ? (
                    <option value="">{i18nService.t('scheduledTasksFormNotifyConversationNone')}</option>
                  ) : (
                    conversations.map((conversation) => (
                      <option key={conversation.conversationId} value={conversation.conversationId}>
                        {conversation.conversationId}
                      </option>
                    ))
                  )}
                </select>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="shrink-0 border-t dark:border-dark-border/70 border-border/70 dark:bg-dark-bg/95 bg-page/95 backdrop-blur-sm pt-3 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm rounded-lg dark:text-dark-text-secondary text-text-secondary hover:bg-surface-hover dark:hover:bg-dark-surface-hover transition-colors"
        >
          {i18nService.t('cancel')}
        </button>
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={submitting}
          className="px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary-light transition-colors disabled:opacity-50"
        >
          {submitting
            ? i18nService.t('saving')
            : mode === 'create'
              ? i18nService.t('scheduledTasksFormCreate')
              : i18nService.t('scheduledTasksFormUpdate')}
        </button>
      </div>
    </div>
  );
};

export default TaskForm;
