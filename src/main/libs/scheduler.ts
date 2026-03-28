import { BrowserWindow } from 'electron';
import type { CoworkSession, CoworkStore } from '../coworkStore';
import type { CoworkRunner } from './coworkRunner';
import { BindingKind, DeliveryMode, IpcChannel, SessionTarget, TaskStatus } from '../../scheduled-task/constants';
import type { ScheduledTask, ScheduledTaskRun } from '../../scheduled-task/types';
import { ScheduledTaskStore } from '../scheduledTaskStore';
import type { IMGatewayManager } from '../im/imGatewayManager';
import { buildManagedSessionKey, parseManagedSessionKey } from './scheduledTaskSessionKey';

interface SchedulerDeps {
  scheduledTaskStore: ScheduledTaskStore;
  coworkStore: CoworkStore;
  getCoworkRunner: () => CoworkRunner;
  ensureActiveAuthSession?: () => Promise<
    | { ok: true }
    | { ok: false; reason: 'no_token' | 'expired' | 'disabled' | 'scope_required' | 'network_error'; error: string }
  >;
  getIMGatewayManager?: () => IMGatewayManager | null;
  getSkillsPrompt?: () => Promise<string | null>;
}

interface ResolvedExecutionSession {
  sessionId: string;
  sessionKey: string;
  existingSession: CoworkSession | null;
}

const CHANNEL_PLATFORM_MAP = {
  dingtalk: 'dingtalk',
  feishu: 'feishu',
  telegram: 'telegram',
  discord: 'discord',
  nim: 'nim',
  xiaomifeng: 'xiaomifeng',
  qq: 'qq',
  wecom: 'wecom',
} as const;

export class Scheduler {
  private store: ScheduledTaskStore;
  private coworkStore: CoworkStore;
  private getCoworkRunner: () => CoworkRunner;
  private ensureActiveAuthSession: SchedulerDeps['ensureActiveAuthSession'];
  private getIMGatewayManager: (() => IMGatewayManager | null) | null;
  private getSkillsPrompt: (() => Promise<string | null>) | null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private activeTasks: Map<string, AbortController> = new Map();
  private taskSessionIds: Map<string, string> = new Map();

  private static readonly MAX_TIMER_INTERVAL_MS = 60_000;
  private static readonly MAX_CONSECUTIVE_ERRORS = 5;

  constructor(deps: SchedulerDeps) {
    this.store = deps.scheduledTaskStore;
    this.coworkStore = deps.coworkStore;
    this.getCoworkRunner = deps.getCoworkRunner;
    this.ensureActiveAuthSession = deps.ensureActiveAuthSession;
    this.getIMGatewayManager = deps.getIMGatewayManager ?? null;
    this.getSkillsPrompt = deps.getSkillsPrompt ?? null;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    console.log('[Scheduler] Started');
    this.scheduleNext();
  }

  stop(): void {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    for (const controller of this.activeTasks.values()) {
      controller.abort();
    }
    this.activeTasks.clear();
    console.log('[Scheduler] Stopped');
  }

  reschedule(): void {
    if (!this.running) return;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.scheduleNext();
  }

  private scheduleNext(): void {
    if (!this.running) return;

    const nextDueMs = this.store.getNextDueTimeMs();
    const now = Date.now();
    const delayMs = nextDueMs === null
      ? Scheduler.MAX_TIMER_INTERVAL_MS
      : Math.min(Math.max(nextDueMs - now, 0), Scheduler.MAX_TIMER_INTERVAL_MS);

    this.timer = setTimeout(() => {
      this.timer = null;
      void this.tick();
    }, delayMs);
  }

  private async tick(): Promise<void> {
    if (!this.running) return;

    const dueTasks = this.store.getDueTasks(Date.now());
    await Promise.allSettled(dueTasks.map((task) => this.executeTask(task, 'scheduled')));
    this.scheduleNext();
  }

  async executeTask(task: ScheduledTask, trigger: 'scheduled' | 'manual'): Promise<void> {
    if (this.activeTasks.has(task.id)) {
      console.log(`[Scheduler] Task ${task.id} already running, skipping`);
      return;
    }

    const startTime = Date.now();
    const run = this.store.createRun(task.id, trigger, task.sessionKey);
    this.store.markTaskRunning(task.id, startTime);
    this.emitTaskStatusUpdate(task.id);
    this.emitRunUpdate(run);

    const abortController = new AbortController();
    this.activeTasks.set(task.id, abortController);

    let executionSession: ResolvedExecutionSession | null = null;
    let status: Exclude<(typeof TaskStatus)[keyof typeof TaskStatus], 'running'> = 'success';
    let error: string | null = null;

    try {
      executionSession = await this.runTaskPayload(task);
    } catch (err: unknown) {
      status = 'error';
      error = err instanceof Error ? err.message : String(err);
      console.error(`[Scheduler] Task ${task.id} failed:`, error);
    } finally {
      const durationMs = Date.now() - startTime;
      this.activeTasks.delete(task.id);
      this.taskSessionIds.delete(task.id);

      const taskStillExists = this.store.getTask(task.id) !== null;
      if (taskStillExists) {
        this.store.completeRun(
          run.id,
          status,
          executionSession?.sessionId ?? null,
          executionSession?.sessionKey ?? task.sessionKey ?? null,
          durationMs,
          error
        );
        this.store.markTaskCompleted(task.id, status, durationMs, error);

        if (task.schedule.kind === 'at') {
          this.store.toggleTask(task.id, false);
        }

        const updatedTask = this.store.getTask(task.id);
        if (updatedTask && updatedTask.state.consecutiveErrors >= Scheduler.MAX_CONSECUTIVE_ERRORS) {
          this.store.toggleTask(task.id, false);
          console.warn(
            `[Scheduler] Task ${task.id} auto-disabled after ${Scheduler.MAX_CONSECUTIVE_ERRORS} consecutive errors`
          );
        }

        this.store.pruneRuns(task.id, 100);

        await this.deliverTaskResult(
          task,
          status === 'success',
          durationMs,
          error,
          executionSession?.sessionId ?? null,
          executionSession?.sessionKey ?? task.sessionKey ?? null
        );

        this.emitTaskStatusUpdate(task.id);
        const updatedRun = this.store.getRun(run.id);
        if (updatedRun) {
          this.emitRunUpdate(updatedRun);
        }
      }

      this.reschedule();
    }
  }

  private async runTaskPayload(task: ScheduledTask): Promise<ResolvedExecutionSession> {
    if (this.ensureActiveAuthSession) {
      const authCheck = await this.ensureActiveAuthSession();
      if ('error' in authCheck) {
        throw new Error(authCheck.error);
      }
    }

    const resolvedSession = await this.resolveExecutionSession(task);
    const prompt = task.payload.kind === 'systemEvent' ? task.payload.text : task.payload.message;

    if (!prompt.trim()) {
      throw new Error('Scheduled task payload is empty');
    }

    const session = resolvedSession.existingSession ?? this.coworkStore.getSession(resolvedSession.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${resolvedSession.sessionId}`);
    }

    this.taskSessionIds.set(task.id, resolvedSession.sessionId);
    const runner = this.getCoworkRunner();

    if (runner.isSessionActive(resolvedSession.sessionId)) {
      await runner.continueSession(resolvedSession.sessionId, prompt, {
        systemPrompt: session.systemPrompt,
      });
    } else {
      this.coworkStore.updateSession(resolvedSession.sessionId, { status: 'running' });
      await runner.startSession(resolvedSession.sessionId, prompt, {
        workspaceRoot: session.cwd,
        confirmationMode: 'text',
        systemPrompt: session.systemPrompt,
      });
    }

    return resolvedSession;
  }

  private async resolveExecutionSession(task: ScheduledTask): Promise<ResolvedExecutionSession> {
    const binding = task.binding;

    if ('sessionKey' in binding && typeof binding.sessionKey === 'string') {
      const parsed = parseManagedSessionKey(binding.sessionKey);
      if (!parsed) {
        throw new Error(`Unsupported sessionKey: ${binding.sessionKey}`);
      }
      const session = this.coworkStore.getSession(parsed.sessionId);
      if (!session) {
        throw new Error(`Bound session not found: ${parsed.sessionId}`);
      }
      return {
        sessionId: session.id,
        sessionKey: buildManagedSessionKey(session.id),
        existingSession: session,
      };
    }

    if (binding.kind === BindingKind.UISession && 'sessionId' in binding && binding.sessionId) {
      const session = this.coworkStore.getSession(binding.sessionId);
      if (!session) {
        throw new Error(`Bound UI session not found: ${binding.sessionId}`);
      }
      return {
        sessionId: session.id,
        sessionKey: buildManagedSessionKey(session.id),
        existingSession: session,
      };
    }

    if (binding.kind === BindingKind.IMSession) {
      const manager = this.getIMGatewayManager?.() ?? null;
      const sessionId = ('sessionId' in binding ? binding.sessionId : undefined)
        ?? (('conversationId' in binding && 'platform' in binding)
          ? manager?.getIMStore().getSessionMapping(binding.conversationId, binding.platform as any)?.coworkSessionId
          : undefined)
        ?? null;
      if (!sessionId) {
        const target = ('platform' in binding && 'conversationId' in binding)
          ? `${binding.platform}:${binding.conversationId}`
          : 'unknown';
        throw new Error(`IM binding not found: ${target}`);
      }
      const session = this.coworkStore.getSession(sessionId);
      if (!session) {
        throw new Error(`Bound IM session not found: ${sessionId}`);
      }
      return {
        sessionId: session.id,
        sessionKey: buildManagedSessionKey(session.id),
        existingSession: session,
      };
    }

    if (task.sessionKey) {
      const parsed = parseManagedSessionKey(task.sessionKey);
      if (parsed) {
        const session = this.coworkStore.getSession(parsed.sessionId);
        if (session) {
          return {
            sessionId: session.id,
            sessionKey: task.sessionKey,
            existingSession: session,
          };
        }
      }
    }

    if (task.sessionTarget === SessionTarget.Main) {
      const originSessionId = 'sessionId' in task.origin && typeof task.origin.sessionId === 'string'
        ? task.origin.sessionId
        : null;
      if (originSessionId) {
        const session = this.coworkStore.getSession(originSessionId);
        if (!session) {
          throw new Error(`Origin session not found: ${originSessionId}`);
        }
        return {
          sessionId: session.id,
          sessionKey: buildManagedSessionKey(session.id),
          existingSession: session,
        };
      }

      throw new Error('Main session target requires an existing bound session');
    }

    const config = this.coworkStore.getConfig();
    const cwd = (config.workingDirectory || '').trim();
    if (!cwd) {
      throw new Error('Scheduled task working directory is not configured');
    }

    const baseSystemPrompt = config.systemPrompt || '';
    let skillsPrompt: string | null = null;
    if (this.getSkillsPrompt) {
      try {
        skillsPrompt = await this.getSkillsPrompt();
      } catch (error) {
        console.warn('[Scheduler] Failed to build skills prompt for scheduled task:', error);
      }
    }
    const systemPrompt = [skillsPrompt, baseSystemPrompt]
      .filter((value): value is string => Boolean(value?.trim()))
      .join('\n\n');
    const session = this.coworkStore.createSession(
      `[定时] ${task.name}`,
      cwd,
      systemPrompt,
      config.executionMode || 'auto',
      []
    );

    return {
      sessionId: session.id,
      sessionKey: buildManagedSessionKey(session.id),
      existingSession: session,
    };
  }

  private async deliverTaskResult(
    task: ScheduledTask,
    success: boolean,
    durationMs: number,
    error: string | null,
    sessionId: string | null,
    sessionKey: string | null,
  ): Promise<void> {
    if (task.delivery.mode === DeliveryMode.None && !task.delivery.channel) {
      return;
    }

    const durationStr = durationMs < 1000
      ? `${durationMs}ms`
      : `${(durationMs / 1000).toFixed(1)}s`;
    const header = [
      '定时任务通知',
      `任务: ${task.name}`,
      `状态: ${success ? '成功' : '失败'}`,
      `耗时: ${durationStr}`,
      ...(error ? [`错误: ${error}`] : []),
    ].join('\n');

    let resultText = '';
    if (sessionId && success) {
      const session = this.coworkStore.getSession(sessionId);
      if (session) {
        resultText = session.messages
          .filter((message) => message.type === 'assistant' && message.content && !message.metadata?.isThinking)
          .map((message) => message.content)
          .join('\n\n');
      }
    }

    const message = resultText
      ? `${header}\n\n执行结果:\n${resultText.length > 1500 ? `${resultText.slice(0, 1500)}…` : resultText}`
      : header;

    if (task.delivery.mode === DeliveryMode.Webhook && task.delivery.to) {
      await this.deliverWebhook(task, message, success, durationMs, error, sessionId, sessionKey);
      return;
    }

    if (!task.delivery.channel) {
      return;
    }

    const platform = CHANNEL_PLATFORM_MAP[task.delivery.channel as keyof typeof CHANNEL_PLATFORM_MAP];
    if (!platform) {
      return;
    }

    const imManager = this.getIMGatewayManager?.();
    if (!imManager) return;

    try {
      if (task.delivery.to) {
        await imManager.sendConversationNotificationWithMedia(platform, task.delivery.to, message);
      } else {
        await imManager.sendNotificationWithMedia(platform, message);
      }
    } catch (deliveryError) {
      console.warn('[Scheduler] Failed to deliver task result:', deliveryError);
    }
  }

  private async deliverWebhook(
    task: ScheduledTask,
    text: string,
    success: boolean,
    durationMs: number,
    error: string | null,
    sessionId: string | null,
    sessionKey: string | null,
  ): Promise<void> {
    if (!task.delivery.to) return;

    const response = await fetch(task.delivery.to, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        taskId: task.id,
        taskName: task.name,
        success,
        durationMs,
        error,
        sessionId,
        sessionKey,
        text,
      }),
    });

    if (!response.ok) {
      throw new Error(`Webhook delivery failed: ${response.status}`);
    }
  }

  async runManually(taskId: string): Promise<void> {
    const task = this.store.getTask(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);
    await this.executeTask(task, 'manual');
  }

  stopTask(taskId: string): boolean {
    const controller = this.activeTasks.get(taskId);
    if (!controller) return false;

    const sessionId = this.taskSessionIds.get(taskId);
    if (sessionId) {
      try {
        this.getCoworkRunner().stopSession(sessionId);
      } catch (error) {
        console.warn(`[Scheduler] Failed to stop cowork session for task ${taskId}:`, error);
      }
    }

    controller.abort();
    return true;
  }

  private emitTaskStatusUpdate(taskId: string): void {
    const task = this.store.getTask(taskId);
    if (!task) return;

    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) {
        win.webContents.send(IpcChannel.StatusUpdate, {
          taskId: task.id,
          state: task.state,
        });
      }
    });
  }

  private emitRunUpdate(run: ScheduledTaskRun): void {
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) {
        win.webContents.send(IpcChannel.RunUpdate, { run });
      }
    });
  }
}
