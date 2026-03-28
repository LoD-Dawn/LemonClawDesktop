import { Database } from 'sql.js';
import { v4 as uuidv4 } from 'uuid';
import { CronExpressionParser } from 'cron-parser';
import { BindingKind, OriginKind, TaskStatus } from '../scheduled-task/constants';
import type {
  ExecutionBinding,
  Schedule,
  ScheduledTask,
  ScheduledTaskInput,
  ScheduledTaskRun,
  ScheduledTaskRunWithName,
  ScheduledTaskDelivery,
  ScheduledTaskPayload,
  TaskOrigin,
  TaskState,
} from '../scheduled-task/types';
import { buildManagedSessionKey } from './libs/scheduledTaskSessionKey';

interface TaskRow {
  id: string;
  name: string;
  description: string;
  enabled: number;
  schedule_json: string;
  session_target: string;
  wake_mode: string;
  payload_json: string;
  delivery_json: string;
  agent_id: string | null;
  session_key: string | null;
  origin_json: string;
  binding_json: string;
  next_run_at_ms: number | null;
  last_run_at_ms: number | null;
  last_status: string | null;
  last_error: string | null;
  last_duration_ms: number | null;
  running_at_ms: number | null;
  consecutive_errors: number;
  created_at: string;
  updated_at: string;
}

interface RunRow {
  id: string;
  task_id: string;
  session_id: string | null;
  session_key: string | null;
  status: string;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  error: string | null;
  trigger_type: string;
}

type TaskCompletionStatus = Exclude<(typeof TaskStatus)[keyof typeof TaskStatus], 'running'>;

const DEFAULT_TASK_STATE: TaskState = {
  nextRunAtMs: null,
  lastRunAtMs: null,
  lastStatus: null,
  lastError: null,
  lastDurationMs: null,
  runningAtMs: null,
  consecutiveErrors: 0,
};

function normalizeDelivery(delivery?: ScheduledTaskDelivery): ScheduledTaskDelivery {
  return delivery ?? { mode: 'none' };
}

function normalizeOrigin(origin?: TaskOrigin): TaskOrigin {
  return origin ?? { kind: OriginKind.Manual };
}

function normalizeBinding(binding?: ExecutionBinding): ExecutionBinding {
  return binding ?? { kind: BindingKind.NewSession };
}

function normalizeWakeMode(): ScheduledTask['wakeMode'] {
  return 'now';
}

function inferSessionKey(binding: ExecutionBinding, explicitSessionKey?: string | null): string | null {
  if (explicitSessionKey !== undefined) {
    return explicitSessionKey;
  }

  if ('sessionKey' in binding && typeof binding.sessionKey === 'string') {
    return binding.sessionKey;
  }

  if ('sessionId' in binding && typeof binding.sessionId === 'string' && binding.sessionId.trim()) {
    return buildManagedSessionKey(binding.sessionId);
  }

  return null;
}

export class ScheduledTaskStore {
  private db: Database;
  private saveDb: () => void;

  constructor(db: Database, saveDb: () => void) {
    this.db = db;
    this.saveDb = saveDb;
    this.resetStuckRunningTasks();
  }

  private getOne<T>(sql: string, params: (string | number | null)[] = []): T | undefined {
    const result = this.db.exec(sql, params);
    if (!result[0]?.values[0]) return undefined;
    const columns = result[0].columns;
    const values = result[0].values[0];
    const row: Record<string, unknown> = {};
    columns.forEach((col, i) => {
      row[col] = values[i];
    });
    return row as T;
  }

  private getAll<T>(sql: string, params: (string | number | null)[] = []): T[] {
    const result = this.db.exec(sql, params);
    if (!result[0]?.values) return [];
    const columns = result[0].columns;
    return result[0].values.map((values) => {
      const row: Record<string, unknown> = {};
      columns.forEach((col, i) => {
        row[col] = values[i];
      });
      return row as T;
    });
  }

  private resetStuckRunningTasks(): void {
    try {
      const now = new Date().toISOString();
      this.db.run(`
        UPDATE scheduled_task_runs
        SET status = 'error',
            finished_at = ?,
            error = 'Application was closed during execution'
        WHERE status = 'running'
      `, [now]);

      this.db.run(`
        UPDATE scheduled_tasks
        SET running_at_ms = NULL,
            last_status = 'error',
            last_error = 'Application was closed during execution'
        WHERE running_at_ms IS NOT NULL
      `);

      this.saveDb();
    } catch (error) {
      console.warn('Failed to reset stuck running tasks:', error);
    }
  }

  listTasks(): ScheduledTask[] {
    const rows = this.getAll<TaskRow>('SELECT * FROM scheduled_tasks ORDER BY created_at DESC');
    return rows.map((row) => this.rowToTask(row));
  }

  getTask(id: string): ScheduledTask | null {
    const row = this.getOne<TaskRow>('SELECT * FROM scheduled_tasks WHERE id = ?', [id]);
    return row ? this.rowToTask(row) : null;
  }

  createTask(input: ScheduledTaskInput): ScheduledTask {
    const id = uuidv4();
    const now = new Date().toISOString();
    const binding = normalizeBinding(input.binding);
    const sessionKey = inferSessionKey(binding, input.sessionKey);
    const nextRunAtMs = input.enabled ? this.calculateNextRunTime(input.schedule, null) : null;

    this.db.run(`
      INSERT INTO scheduled_tasks (
      id, name, description, enabled, schedule_json, session_target, wake_mode,
        payload_json, delivery_json, agent_id, session_key, origin_json, binding_json,
        next_run_at_ms, last_run_at_ms, last_status, last_error, last_duration_ms,
        running_at_ms, consecutive_errors, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, NULL, 0, ?, ?)
    `, [
      id,
      input.name,
      input.description,
      input.enabled ? 1 : 0,
      JSON.stringify(input.schedule),
      input.sessionTarget,
      normalizeWakeMode(),
      JSON.stringify(input.payload),
      JSON.stringify(normalizeDelivery(input.delivery)),
      input.agentId ?? null,
      sessionKey,
      JSON.stringify(normalizeOrigin(input.origin)),
      JSON.stringify(binding),
      nextRunAtMs,
      now,
      now,
    ]);

    this.saveDb();
    return this.getTask(id)!;
  }

  updateTask(id: string, input: Partial<ScheduledTaskInput>): ScheduledTask | null {
    const existing = this.getTask(id);
    if (!existing) return null;

    const binding = input.binding !== undefined ? normalizeBinding(input.binding) : existing.binding;
    const schedule = input.schedule ?? existing.schedule;
    const enabled = input.enabled ?? existing.enabled;
    const sessionKey = input.sessionKey !== undefined
      ? inferSessionKey(binding, input.sessionKey)
      : (input.binding !== undefined ? inferSessionKey(binding) : existing.sessionKey);
    const now = new Date().toISOString();

    let nextRunAtMs = existing.state.nextRunAtMs;
    if (input.schedule !== undefined || input.enabled !== undefined) {
      nextRunAtMs = enabled
        ? this.calculateNextRunTime(schedule, existing.state.lastRunAtMs)
        : null;
    }

    this.db.run(`
      UPDATE scheduled_tasks
      SET name = ?, description = ?, enabled = ?, schedule_json = ?, session_target = ?,
          wake_mode = ?, payload_json = ?, delivery_json = ?, agent_id = ?, session_key = ?,
          origin_json = ?, binding_json = ?, next_run_at_ms = ?, updated_at = ?
      WHERE id = ?
    `, [
      input.name ?? existing.name,
      input.description ?? existing.description,
      enabled ? 1 : 0,
      JSON.stringify(schedule),
      input.sessionTarget ?? existing.sessionTarget,
      input.wakeMode !== undefined ? normalizeWakeMode() : normalizeWakeMode(),
      JSON.stringify(input.payload ?? existing.payload),
      JSON.stringify(input.delivery !== undefined ? normalizeDelivery(input.delivery) : existing.delivery),
      input.agentId !== undefined ? (input.agentId ?? null) : existing.agentId,
      sessionKey,
      JSON.stringify(input.origin ?? existing.origin),
      JSON.stringify(binding),
      nextRunAtMs,
      now,
      id,
    ]);

    this.saveDb();
    return this.getTask(id)!;
  }

  deleteTask(id: string): boolean {
    this.db.run('DELETE FROM scheduled_task_runs WHERE task_id = ?', [id]);
    this.db.run('DELETE FROM scheduled_tasks WHERE id = ?', [id]);
    this.saveDb();
    return true;
  }

  toggleTask(id: string, enabled: boolean): { task: ScheduledTask | null; warning: string | null } {
    const task = this.updateTask(id, { enabled });
    if (!task || !enabled) return { task, warning: null };
    return { task, warning: this.validateTaskActivation(task) };
  }

  validateTaskActivation(task: ScheduledTask): string | null {
    if (task.schedule.kind === 'at') {
      const targetMs = new Date(task.schedule.at).getTime();
      if (!Number.isFinite(targetMs) || targetMs <= Date.now()) {
        return 'TASK_AT_PAST';
      }
    }
    return null;
  }

  markTaskRunning(id: string, runningAtMs: number): void {
    this.db.run(`
      UPDATE scheduled_tasks
      SET running_at_ms = ?, last_status = 'running', updated_at = ?
      WHERE id = ?
    `, [runningAtMs, new Date().toISOString(), id]);
    this.saveDb();
  }

  markTaskCompleted(
    id: string,
    status: TaskCompletionStatus,
    durationMs: number | null,
    error: string | null
  ): void {
    const task = this.getTask(id);
    if (!task) return;

    const nowMs = Date.now();
    const consecutiveErrors = status === 'success' ? 0 : task.state.consecutiveErrors + 1;
    const nextRunAtMs = task.enabled
      ? this.calculateNextRunTime(task.schedule, nowMs)
      : null;

    this.db.run(`
      UPDATE scheduled_tasks
      SET running_at_ms = NULL,
          last_run_at_ms = ?,
          last_status = ?,
          last_error = ?,
          last_duration_ms = ?,
          consecutive_errors = ?,
          next_run_at_ms = ?,
          updated_at = ?
      WHERE id = ?
    `, [
      nowMs,
      status,
      error,
      durationMs,
      consecutiveErrors,
      nextRunAtMs,
      new Date().toISOString(),
      id,
    ]);

    this.saveDb();
  }

  createRun(taskId: string, trigger: 'scheduled' | 'manual', sessionKey?: string | null): ScheduledTaskRun {
    const id = uuidv4();
    const now = new Date().toISOString();
    this.db.run(`
      INSERT INTO scheduled_task_runs (id, task_id, session_id, session_key, status, started_at, trigger_type)
      VALUES (?, ?, NULL, ?, 'running', ?, ?)
    `, [id, taskId, sessionKey ?? null, now, trigger]);
    this.saveDb();
    return this.getRun(id)!;
  }

  completeRun(
    runId: string,
    status: TaskCompletionStatus,
    sessionId: string | null,
    sessionKey: string | null,
    durationMs: number | null,
    error: string | null
  ): ScheduledTaskRun | null {
    const now = new Date().toISOString();
    this.db.run(`
      UPDATE scheduled_task_runs
      SET status = ?, session_id = ?, session_key = ?, finished_at = ?, duration_ms = ?, error = ?
      WHERE id = ?
    `, [status, sessionId, sessionKey, now, durationMs, error, runId]);
    this.saveDb();
    return this.getRun(runId);
  }

  getRun(id: string): ScheduledTaskRun | null {
    const row = this.getOne<RunRow>('SELECT * FROM scheduled_task_runs WHERE id = ?', [id]);
    return row ? this.rowToRun(row) : null;
  }

  listRuns(taskId: string, limit = 50, offset = 0): ScheduledTaskRun[] {
    const rows = this.getAll<RunRow>(
      'SELECT * FROM scheduled_task_runs WHERE task_id = ? ORDER BY started_at DESC LIMIT ? OFFSET ?',
      [taskId, limit, offset]
    );
    return rows.map((row) => this.rowToRun(row));
  }

  listAllRuns(limit = 50, offset = 0): ScheduledTaskRunWithName[] {
    const rows = this.getAll<RunRow & { task_name: string }>(`
      SELECT r.*, t.name AS task_name
      FROM scheduled_task_runs r
      LEFT JOIN scheduled_tasks t ON r.task_id = t.id
      ORDER BY r.started_at DESC
      LIMIT ? OFFSET ?
    `, [limit, offset]);

    return rows.map((row) => ({
      ...this.rowToRun(row),
      taskName: row.task_name ?? '',
    }));
  }

  countRuns(taskId: string): number {
    const row = this.getOne<{ count: number }>(
      'SELECT COUNT(*) AS count FROM scheduled_task_runs WHERE task_id = ?',
      [taskId]
    );
    return Number(row?.count ?? 0);
  }

  pruneRuns(taskId: string, keepCount = 100): void {
    const keepRows = this.getAll<{ id: string }>(
      'SELECT id FROM scheduled_task_runs WHERE task_id = ? ORDER BY started_at DESC LIMIT ?',
      [taskId, keepCount]
    );
    const keepIds = keepRows.map((row) => row.id);
    if (keepIds.length === 0) return;

    const placeholders = keepIds.map(() => '?').join(',');
    this.db.run(
      `DELETE FROM scheduled_task_runs WHERE task_id = ? AND id NOT IN (${placeholders})`,
      [taskId, ...keepIds]
    );
    this.saveDb();
  }

  getDueTasks(nowMs: number): ScheduledTask[] {
    const rows = this.getAll<TaskRow>(`
      SELECT * FROM scheduled_tasks
      WHERE enabled = 1
        AND next_run_at_ms IS NOT NULL
        AND next_run_at_ms <= ?
        AND running_at_ms IS NULL
      ORDER BY next_run_at_ms ASC
    `, [nowMs]);
    return rows.map((row) => this.rowToTask(row));
  }

  getNextDueTimeMs(): number | null {
    const row = this.getOne<{ min_time: number | null }>(`
      SELECT MIN(next_run_at_ms) AS min_time
      FROM scheduled_tasks
      WHERE enabled = 1
        AND next_run_at_ms IS NOT NULL
        AND running_at_ms IS NULL
    `);
    return row?.min_time ?? null;
  }

  calculateNextRunTime(schedule: Schedule, lastRunAtMs: number | null): number | null {
    const now = Date.now();

    if (schedule.kind === 'at') {
      const targetMs = new Date(schedule.at).getTime();
      return Number.isFinite(targetMs) && targetMs > now ? targetMs : null;
    }

    if (schedule.kind === 'every') {
      if (!Number.isFinite(schedule.everyMs) || schedule.everyMs <= 0) return null;
      if (lastRunAtMs !== null) {
        return Math.max(lastRunAtMs + schedule.everyMs, now);
      }
      const anchor = schedule.anchorMs ?? now;
      if (anchor > now) return anchor;
      const steps = Math.floor((now - anchor) / schedule.everyMs) + 1;
      return anchor + steps * schedule.everyMs;
    }

    return this.getNextCronTime(schedule.expr, schedule.tz, now);
  }

  private getNextCronTime(expression: string, tz: string | undefined, afterMs: number): number | null {
    try {
      const interval = CronExpressionParser.parse(expression, {
        currentDate: new Date(afterMs),
        ...(tz ? { tz } : {}),
      });
      return interval.next().toDate().getTime();
    } catch {
      return null;
    }
  }

  private rowToTask(row: TaskRow): ScheduledTask {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      enabled: row.enabled === 1,
      schedule: JSON.parse(row.schedule_json) as Schedule,
      sessionTarget: row.session_target as ScheduledTask['sessionTarget'],
      wakeMode: normalizeWakeMode(),
      payload: JSON.parse(row.payload_json) as ScheduledTaskPayload,
      delivery: JSON.parse(row.delivery_json || '{"mode":"none"}') as ScheduledTaskDelivery,
      agentId: row.agent_id,
      sessionKey: row.session_key,
      origin: JSON.parse(row.origin_json || `{"kind":"${OriginKind.Manual}"}`) as TaskOrigin,
      binding: JSON.parse(row.binding_json || `{"kind":"${BindingKind.NewSession}"}`) as ExecutionBinding,
      state: {
        nextRunAtMs: row.next_run_at_ms,
        lastRunAtMs: row.last_run_at_ms,
        lastStatus: row.last_status as TaskState['lastStatus'],
        lastError: row.last_error,
        lastDurationMs: row.last_duration_ms,
        runningAtMs: row.running_at_ms,
        consecutiveErrors: row.consecutive_errors,
      },
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private rowToRun(row: RunRow): ScheduledTaskRun {
    return {
      id: row.id,
      taskId: row.task_id,
      sessionId: row.session_id,
      sessionKey: row.session_key,
      status: row.status as ScheduledTaskRun['status'],
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      durationMs: row.duration_ms,
      error: row.error,
    };
  }
}
