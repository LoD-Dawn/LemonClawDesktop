import { i18nService } from '../../services/i18n';
import type {
  ScheduledTask,
  ScheduledTaskDelivery,
  ScheduledTaskPayload,
  Schedule,
  ScheduleCron,
  TaskLastStatus,
} from '../../types/scheduledTask';

const WEEKDAY_KEYS = [
  'scheduledTasksFormWeekSun',
  'scheduledTasksFormWeekMon',
  'scheduledTasksFormWeekTue',
  'scheduledTasksFormWeekWed',
  'scheduledTasksFormWeekThu',
  'scheduledTasksFormWeekFri',
  'scheduledTasksFormWeekSat',
] as const;

function pad2(value: number): string {
  return value.toString().padStart(2, '0');
}

function tpl(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? '');
}

function parseField(field: string):
  | { type: 'any' }
  | { type: 'value'; value: number }
  | { type: 'step'; step: number }
  | { type: 'range'; from: number; to: number }
  | null {
  if (field === '*') return { type: 'any' };
  if (/^\d+$/.test(field)) return { type: 'value', value: Number(field) };
  const stepMatch = field.match(/^\*\/(\d+)$/);
  if (stepMatch) return { type: 'step', step: Number(stepMatch[1]) };
  const rangeMatch = field.match(/^(\d+)-(\d+)$/);
  if (rangeMatch) return { type: 'range', from: Number(rangeMatch[1]), to: Number(rangeMatch[2]) };
  return null;
}

function fallbackCron(schedule: ScheduleCron): string {
  const tzLabel = schedule.tz ? ` (${schedule.tz})` : '';
  return `Cron · ${schedule.expr}${tzLabel}`;
}

function formatCronExpr(schedule: ScheduleCron): string {
  const parts = schedule.expr.trim().split(/\s+/);
  if (parts.length !== 5) return fallbackCron(schedule);

  const [minRaw, hourRaw, domRaw, monRaw, dowRaw] = parts;
  const min = parseField(minRaw);
  const hour = parseField(hourRaw);
  const dom = parseField(domRaw);
  const mon = parseField(monRaw);
  const dow = parseField(dowRaw);

  if (!min || !hour || !dom || !mon || !dow) return fallbackCron(schedule);

  if (min.type === 'step' && hour.type === 'any' && dom.type === 'any' && mon.type === 'any' && dow.type === 'any') {
    if (min.step === 1) return i18nService.t('scheduledTasksCronEveryMinute');
    return tpl(i18nService.t('scheduledTasksCronEveryNMinutes'), { n: String(min.step) });
  }

  if (min.type === 'value' && hour.type === 'step' && dom.type === 'any' && mon.type === 'any' && dow.type === 'any') {
    if (hour.step === 1) return i18nService.t('scheduledTasksCronEveryHour');
    return tpl(i18nService.t('scheduledTasksCronEveryNHours'), { n: String(hour.step) });
  }

  if (min.type === 'value' && hour.type === 'any' && dom.type === 'any' && mon.type === 'any' && dow.type === 'any') {
    return tpl(i18nService.t('scheduledTasksCronEveryHourAtMinute'), { min: pad2(min.value) });
  }

  if (min.type !== 'value' || hour.type !== 'value') return fallbackCron(schedule);
  const time = `${pad2(hour.value)}:${pad2(min.value)}`;

  if (dom.type === 'any' && mon.type === 'any' && dow.type === 'any') {
    return tpl(i18nService.t('scheduledTasksCronAtTime'), {
      schedule: i18nService.t('scheduledTasksCronEveryDay'),
      time,
    });
  }

  if (dom.type === 'any' && mon.type === 'any') {
    if (dow.type === 'range' && dow.from === 1 && dow.to === 5) {
      return tpl(i18nService.t('scheduledTasksCronAtTime'), {
        schedule: i18nService.t('scheduledTasksCronWeekdays'),
        time,
      });
    }
    if (dow.type === 'value' && dow.value >= 0 && dow.value <= 6) {
      const dayName = i18nService.t(WEEKDAY_KEYS[dow.value]);
      return tpl(i18nService.t('scheduledTasksCronAtTime'), {
        schedule: `${i18nService.t('scheduledTasksCronEveryWeek')}${dayName}`,
        time,
      });
    }
  }

  if (dom.type === 'value' && mon.type === 'any' && dow.type === 'any') {
    return tpl(i18nService.t('scheduledTasksCronAtMonthDay'), {
      schedule: i18nService.t('scheduledTasksCronEveryMonth'),
      day: String(dom.value),
      time,
    });
  }

  return fallbackCron(schedule);
}

export function formatScheduleLabel(schedule: Schedule): string {
  if (schedule.kind === 'at') {
    const date = new Date(schedule.at);
    if (Number.isFinite(date.getTime())) {
      return `${i18nService.t('scheduledTasksFormScheduleModeOnce')} · ${formatDateTime(date)}`;
    }
    return i18nService.t('scheduledTasksFormScheduleModeOnce');
  }

  if (schedule.kind === 'every') {
    const everyMs = schedule.everyMs;
    if (everyMs % 86_400_000 === 0) {
      return `${i18nService.t('scheduledTasksScheduleEvery')} ${everyMs / 86_400_000} ${i18nService.t('scheduledTasksFormIntervalDays')}`;
    }
    if (everyMs % 3_600_000 === 0) {
      return `${i18nService.t('scheduledTasksScheduleEvery')} ${everyMs / 3_600_000} ${i18nService.t('scheduledTasksFormIntervalHours')}`;
    }
    return `${i18nService.t('scheduledTasksScheduleEvery')} ${Math.max(1, Math.round(everyMs / 60_000))} ${i18nService.t('scheduledTasksFormIntervalMinutes')}`;
  }

  return formatCronExpr(schedule);
}

export function formatDateTime(date: Date): string {
  return i18nService.getLanguage() === 'zh'
    ? date.toLocaleString('zh-CN', { hour12: false })
    : date.toLocaleString('en-US');
}

export function formatDuration(ms: number | null): string {
  if (ms === null) return '-';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms / 60_000)}m`;
}

export function formatPayloadLabel(payload: ScheduledTaskPayload): string {
  if (payload.kind === 'systemEvent') {
    return `${i18nService.t('scheduledTasksFormPayloadKindSystemEvent')} · ${payload.text}`;
  }
  const timeoutLabel = typeof payload.timeoutSeconds === 'number' ? ` · ${payload.timeoutSeconds}s` : '';
  return `${i18nService.t('scheduledTasksFormPayloadKindAgentTurn')} · ${payload.message}${timeoutLabel}`;
}

export function formatDeliveryLabel(delivery: ScheduledTaskDelivery): string {
  if (delivery.mode === 'none' && !delivery.channel) {
    return i18nService.t('scheduledTasksFormDeliveryModeNone');
  }

  if (delivery.mode === 'webhook') {
    return delivery.to
      ? `${i18nService.t('scheduledTasksFormDeliveryModeWebhook')} · ${delivery.to}`
      : i18nService.t('scheduledTasksFormDeliveryModeWebhook');
  }

  const channel = delivery.channel || 'last';
  const toLabel = delivery.to ? ` -> ${delivery.to}` : '';
  if (delivery.mode === 'announce') {
    return `${i18nService.t('scheduledTasksFormDeliveryModeAnnounce')} · ${channel}${toLabel}`;
  }
  return `${channel}${toLabel}`;
}

export type PlanType = 'once' | 'daily' | 'weekly' | 'monthly' | 'advanced';

export interface PlanInfo {
  planType: PlanType;
  hour: number;
  minute: number;
  second: number;
  weekday: number;
  monthDay: number;
  year: number;
  month: number;
  day: number;
}

const DEFAULT_PLAN_INFO: PlanInfo = {
  planType: 'daily',
  hour: 9,
  minute: 0,
  second: 0,
  weekday: 1,
  monthDay: 1,
  year: new Date().getFullYear(),
  month: new Date().getMonth() + 1,
  day: new Date().getDate(),
};

export function scheduleToPlanInfo(schedule: Schedule): PlanInfo {
  if (schedule.kind === 'at') {
    const date = new Date(schedule.at);
    if (!Number.isFinite(date.getTime())) return { ...DEFAULT_PLAN_INFO, planType: 'once' };
    return {
      planType: 'once',
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
      hour: date.getHours(),
      minute: date.getMinutes(),
      second: date.getSeconds(),
      weekday: DEFAULT_PLAN_INFO.weekday,
      monthDay: DEFAULT_PLAN_INFO.monthDay,
    };
  }

  if (schedule.kind === 'every') {
    return { ...DEFAULT_PLAN_INFO, planType: 'advanced' };
  }

  const parts = schedule.expr.trim().split(/\s+/);
  if (parts.length !== 5) return { ...DEFAULT_PLAN_INFO, planType: 'advanced' };

  const [minRaw, hourRaw, domRaw, , dowRaw] = parts;
  const min = parseField(minRaw);
  const hour = parseField(hourRaw);
  const dom = parseField(domRaw);
  const dow = parseField(dowRaw);

  if (!min || !hour || min.type !== 'value' || hour.type !== 'value') {
    return { ...DEFAULT_PLAN_INFO, planType: 'advanced' };
  }

  const base: PlanInfo = {
    ...DEFAULT_PLAN_INFO,
    hour: hour.value,
    minute: min.value,
  };

  if (dom && dom.type === 'any' && dow && dow.type === 'any') {
    return { ...base, planType: 'daily' };
  }
  if (dom && dom.type === 'any' && dow && dow.type === 'value' && dow.value >= 0 && dow.value <= 6) {
    return { ...base, planType: 'weekly', weekday: dow.value };
  }
  if (dom && dom.type === 'value' && dow && dow.type === 'any') {
    return { ...base, planType: 'monthly', monthDay: dom.value };
  }

  return { ...DEFAULT_PLAN_INFO, planType: 'advanced' };
}

export function getTaskPromptText(task: ScheduledTask): string {
  return task.payload.kind === 'systemEvent' ? task.payload.text : task.payload.message;
}

export function getStatusTone(status: TaskLastStatus): string {
  if (status === 'success') return 'text-green-500';
  if (status === 'error') return 'text-red-500';
  if (status === 'skipped') return 'text-yellow-500';
  if (status === 'running') return 'text-blue-500';
  return 'dark:text-dark-text-secondary text-text-secondary';
}

export function getStatusLabelKey(status: TaskLastStatus): string {
  if (status === 'success') return 'scheduledTasksStatusSuccess';
  if (status === 'error') return 'scheduledTasksStatusError';
  if (status === 'skipped') return 'scheduledTasksStatusSkipped';
  if (status === 'running') return 'scheduledTasksStatusRunning';
  return 'scheduledTasksStatusIdle';
}
