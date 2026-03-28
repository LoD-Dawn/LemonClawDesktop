import crypto from 'crypto';
import { EventEmitter } from 'events';
import type { CoworkMessage, CoworkSession, CoworkStore } from '../coworkStore';
import type { OpenClawGatewayClientManager } from './openclawGatewayClient';
import {
  OPENCLAW_WEIXIN_CHANNEL,
  OPENCLAW_WEIXIN_SESSION_ID_PREFIX,
  parseOpenClawWeixinSessionKey,
} from '../../shared/openclawSession';

const CHANNEL_SESSION_DISCOVERY_LIMIT = 200;
const CHAT_HISTORY_LIMIT = 500;
const CHANNEL_POLL_INTERVAL_MS = 15_000;
const GATEWAY_EVENT_SYNC_DEBOUNCE_MS = 1_200;
const LOCAL_STATUS_GRACE_WINDOW_MS = 10_000;

interface OpenClawSessionRow {
  key?: string;
  channel?: string;
  displayName?: string;
  updatedAt?: number | string;
  lastChannel?: string;
  lastTo?: string;
  abortedLastRun?: boolean;
  origin?: {
    provider?: string;
    label?: string;
    from?: string;
    to?: string;
    accountId?: string;
  };
  deliveryContext?: {
    channel?: string;
    to?: string;
    accountId?: string;
  };
}

interface ResolvedWeixinConversation {
  conversationId: string;
  accountId?: string;
}

type GatewayHistoryRole = 'user' | 'assistant' | 'system';

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
};

const extractGatewayMessageText = (message: unknown): string => {
  if (typeof message === 'string') {
    return message;
  }
  if (!isRecord(message)) {
    return '';
  }

  const content = message.content;
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content)) {
    const chunks: string[] = [];
    for (const item of content) {
      if (!isRecord(item)) continue;
      if (item.type === 'text' && typeof item.text === 'string') {
        chunks.push(item.text);
      }
    }
    if (chunks.length > 0) {
      return chunks.join('\n');
    }
  }
  if (typeof message.text === 'string') {
    return message.text;
  }
  return '';
};

export class OpenClawWeixinSessionBridge extends EventEmitter {
  private readonly coworkStore: CoworkStore;
  private readonly gatewayClientManager: OpenClawGatewayClientManager;
  private readonly getDefaultCwd: () => string;
  private readonly isWeixinEnabled: () => boolean;
  private pollTimer: NodeJS.Timeout | null = null;
  private gatewayEventSyncTimer: NodeJS.Timeout | null = null;
  private started = false;
  private syncPromise: Promise<string[]> | null = null;
  private readonly sessionKeyBySessionId = new Map<string, string>();
  private readonly deletedAtBySessionId = new Map<string, number>();
  private readonly handleGatewayEvent = (_event: unknown): void => {
    if (!this.started || !this.isWeixinEnabled()) {
      return;
    }
    this.scheduleSync(GATEWAY_EVENT_SYNC_DEBOUNCE_MS);
  };

  constructor(options: {
    coworkStore: CoworkStore;
    gatewayClientManager: OpenClawGatewayClientManager;
    getDefaultCwd: () => string;
    isWeixinEnabled: () => boolean;
  }) {
    super();
    this.coworkStore = options.coworkStore;
    this.gatewayClientManager = options.gatewayClientManager;
    this.getDefaultCwd = options.getDefaultCwd;
    this.isWeixinEnabled = options.isWeixinEnabled;
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.gatewayClientManager.on('event', this.handleGatewayEvent);
    this.pollTimer = setInterval(() => {
      void this.syncNow();
    }, CHANNEL_POLL_INTERVAL_MS);
    void this.syncNow();
  }

  stop(): void {
    this.started = false;
    this.gatewayClientManager.off('event', this.handleGatewayEvent);
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.gatewayEventSyncTimer) {
      clearTimeout(this.gatewayEventSyncTimer);
      this.gatewayEventSyncTimer = null;
    }
  }

  getSessionKeyForSession(sessionId: string): string | null {
    const normalizedSessionId = sessionId.trim();
    if (!normalizedSessionId) {
      return null;
    }

    const cached = this.sessionKeyBySessionId.get(normalizedSessionId);
    if (cached) {
      return cached;
    }

    const persisted = this.coworkStore.getImportedSessionKey(normalizedSessionId);
    if (persisted) {
      this.sessionKeyBySessionId.set(normalizedSessionId, persisted);
      return persisted;
    }

    const session = this.coworkStore.getSession(normalizedSessionId);
    const legacySessionKey = session ? this.parseLegacySessionKeyFromSystemPrompt(session.systemPrompt) : null;
    if (legacySessionKey) {
      this.sessionKeyBySessionId.set(normalizedSessionId, legacySessionKey);
      this.coworkStore.setImportedSessionKey(normalizedSessionId, legacySessionKey);
      if (session?.systemPrompt) {
        this.coworkStore.updateSession(normalizedSessionId, { systemPrompt: '' });
      }
      return legacySessionKey;
    }

    return null;
  }

  markSessionDeleted(sessionId: string): void {
    const normalizedSessionId = sessionId.trim();
    if (!normalizedSessionId) {
      return;
    }

    const session = this.coworkStore.getSession(normalizedSessionId);
    const deletedAt = Math.max(Date.now(), session?.updatedAt ?? 0);
    this.deletedAtBySessionId.set(normalizedSessionId, deletedAt);
    this.coworkStore.setImportedSessionDeletedAt(normalizedSessionId, deletedAt);
    this.sessionKeyBySessionId.delete(normalizedSessionId);
    this.coworkStore.deleteImportedSessionKey(normalizedSessionId);
  }

  async syncNow(): Promise<string[]> {
    if (!this.isWeixinEnabled()) {
      return [];
    }
    if (this.syncPromise) {
      return this.syncPromise;
    }

    const promise: Promise<string[]> = this.syncSessions()
      .catch((error): string[] => {
        console.warn('[OpenClawWeixinSessionBridge] Failed to sync Weixin sessions:', error);
        return [];
      })
      .finally(() => {
        if (this.syncPromise === promise) {
          this.syncPromise = null;
        }
      });

    this.syncPromise = promise;
    return promise;
  }

  private async syncSessions(): Promise<string[]> {
    const nextSessions = await this.loadWeixinSessions();
    const changedSessionIds: string[] = [];

    for (const nextSession of nextSessions) {
      const current = this.coworkStore.getSession(nextSession.id);
      if (!this.isSessionSnapshotEqual(current, nextSession)) {
        this.coworkStore.upsertSyncedSession(nextSession);
        changedSessionIds.push(nextSession.id);
      }
    }

    if (changedSessionIds.length > 0) {
      this.emit('sessionsChanged', { sessionIds: changedSessionIds });
    }

    return changedSessionIds;
  }

  private scheduleSync(delayMs: number): void {
    if (this.gatewayEventSyncTimer) {
      clearTimeout(this.gatewayEventSyncTimer);
    }
    this.gatewayEventSyncTimer = setTimeout(() => {
      this.gatewayEventSyncTimer = null;
      void this.syncNow();
    }, delayMs);
  }

  private async loadWeixinSessions(): Promise<CoworkSession[]> {
    const result = await this.gatewayClientManager.request<{ sessions?: unknown[] }>('sessions.list', {
      activeMinutes: 60,
      limit: CHANNEL_SESSION_DISCOVERY_LIMIT,
    });
    const rows = Array.isArray(result?.sessions) ? result.sessions : [];
    const sessions: CoworkSession[] = [];

    for (const rowValue of rows) {
      if (!isRecord(rowValue)) continue;
      const row = rowValue as OpenClawSessionRow;
      const sessionKey = typeof row.key === 'string' ? row.key.trim() : '';
      if (!sessionKey || !this.isWeixinSessionRow(row, sessionKey)) {
        continue;
      }

      const session = await this.buildSessionFromGatewayRow(row, sessionKey);
      if (session) {
        sessions.push(session);
      }
    }

    sessions.sort((left, right) => right.updatedAt - left.updatedAt);
    return sessions;
  }

  private isWeixinSessionRow(row: OpenClawSessionRow, sessionKey: string): boolean {
    return row.channel === OPENCLAW_WEIXIN_CHANNEL
      || row.deliveryContext?.channel === OPENCLAW_WEIXIN_CHANNEL
      || row.lastChannel === OPENCLAW_WEIXIN_CHANNEL
      || row.origin?.provider === OPENCLAW_WEIXIN_CHANNEL
      || parseOpenClawWeixinSessionKey(sessionKey) !== null;
  }

  private async buildSessionFromGatewayRow(
    row: OpenClawSessionRow,
    sessionKey: string,
  ): Promise<CoworkSession | null> {
    const resolvedConversation = this.resolveConversation(row, sessionKey);
    if (!resolvedConversation) {
      return null;
    }

    const stableIdentity = this.buildStableConversationIdentity(resolvedConversation, row, sessionKey);
    const sessionId = this.buildImportedSessionId(stableIdentity);
    const rowUpdatedAt = this.normalizeTimestamp(row.updatedAt);
    const current = this.coworkStore.getSession(sessionId);
    const deletedAt = this.getDeletedAtForSession(sessionId);
    if (deletedAt && rowUpdatedAt <= deletedAt) {
      return null;
    }
    if (deletedAt && rowUpdatedAt > deletedAt) {
      this.deletedAtBySessionId.delete(sessionId);
      this.coworkStore.deleteImportedSessionDeletedAt(sessionId);
    }

    this.sessionKeyBySessionId.set(sessionId, sessionKey);
    this.coworkStore.setImportedSessionKey(sessionId, sessionKey);
    const title = current?.title?.trim()
      || this.buildSessionTitle(row, resolvedConversation.conversationId, sessionKey);

    if (
      current
      && current.messages.length > 0
      && current.status !== 'running'
      && current.updatedAt >= rowUpdatedAt
    ) {
      return current;
    }

    const history = await this.gatewayClientManager.request<{ messages?: unknown[] }>('chat.history', {
      sessionKey,
      limit: CHAT_HISTORY_LIMIT,
    });
    const historyMessages = Array.isArray(history?.messages) ? history.messages : [];
    const fallbackTimestamp = rowUpdatedAt || current?.updatedAt || Date.now();
    const gatewayMessages = this.mapHistoryMessages(sessionId, historyMessages, fallbackTimestamp);
    const messages = current
      ? this.mergePendingLocalMessages(current.messages, gatewayMessages)
      : gatewayMessages;

    if (messages.length === 0) {
      if (!current) {
        return null;
      }
      return {
        ...current,
        title,
        cwd: current.cwd || this.getDefaultCwd(),
        systemPrompt: '',
        updatedAt: Math.max(current.updatedAt, rowUpdatedAt),
      };
    }

    const createdAt = current?.createdAt || messages[0].timestamp || fallbackTimestamp;
    const updatedAt = Math.max(messages[messages.length - 1]?.timestamp || 0, rowUpdatedAt, createdAt);

    return {
      id: sessionId,
      title,
      claudeSessionId: null,
      status: this.reconcileSessionStatus(
        current,
        rowUpdatedAt,
        this.resolveSessionStatus(row, gatewayMessages),
        gatewayMessages,
        messages,
      ),
      pinned: current?.pinned ?? false,
      cwd: current?.cwd || this.getDefaultCwd(),
      systemPrompt: '',
      executionMode: 'local',
      activeSkillIds: [],
      messages,
      createdAt,
      updatedAt,
    };
  }

  private resolveConversation(
    row: OpenClawSessionRow,
    sessionKey: string,
  ): ResolvedWeixinConversation | null {
    const parsed = parseOpenClawWeixinSessionKey(sessionKey);
    if (parsed?.conversationId) {
      return parsed;
    }

    const conversationId = [
      row.deliveryContext?.to,
      row.lastTo,
      row.origin?.to,
      row.origin?.from,
    ]
      .map((value) => (typeof value === 'string' ? value.trim() : ''))
      .find((value) => value.length > 0);

    if (conversationId) {
      const accountId = row.deliveryContext?.accountId?.trim() || row.origin?.accountId?.trim() || undefined;
      return accountId ? { conversationId, accountId } : { conversationId };
    }

    const fallbackConversationId = sessionKey.trim();
    return fallbackConversationId ? { conversationId: fallbackConversationId } : null;
  }

  private buildStableConversationIdentity(
    conversation: ResolvedWeixinConversation,
    row: OpenClawSessionRow,
    sessionKey: string,
  ): string {
    const conversationId = conversation.conversationId.trim();
    const accountId = conversation.accountId?.trim()
      || row.deliveryContext?.accountId?.trim()
      || row.origin?.accountId?.trim()
      || '';

    if (accountId) {
      return `${accountId}:${conversationId}`;
    }

    if (conversationId === sessionKey.trim()) {
      return `session:${conversationId}`;
    }

    return conversationId;
  }

  private buildImportedSessionId(stableIdentity: string): string {
    const digest = crypto.createHash('sha1').update(stableIdentity).digest('hex');
    return `${OPENCLAW_WEIXIN_SESSION_ID_PREFIX}${digest}`;
  }

  private parseLegacySessionKeyFromSystemPrompt(systemPrompt: string): string | null {
    const prefix = 'Imported from OpenClaw Weixin (';
    if (!systemPrompt.startsWith(prefix) || !systemPrompt.endsWith(')')) {
      return null;
    }
    const sessionKey = systemPrompt.slice(prefix.length, -1).trim();
    return sessionKey || null;
  }

  private buildSessionTitle(row: OpenClawSessionRow, conversationId: string, sessionKey: string): string {
    const peerLabel = row.displayName?.trim()
      || row.deliveryContext?.to?.trim()
      || row.lastTo?.trim()
      || row.origin?.label?.trim()
      || row.origin?.from?.trim()
      || row.origin?.to?.trim()
      || conversationId
      || sessionKey;
    return `微信 - ${peerLabel}`;
  }

  private mapHistoryMessages(
    sessionId: string,
    historyMessages: unknown[],
    fallbackTimestamp: number,
  ): CoworkMessage[] {
    const messages: CoworkMessage[] = [];
    let lastTimestamp = fallbackTimestamp > 0 ? fallbackTimestamp : Date.now();

    historyMessages.forEach((message, index) => {
      if (!isRecord(message)) return;
      const role = this.getGatewayHistoryRole(message.role);
      if (!role) return;

      const text = extractGatewayMessageText(message).trim();
      if (!text) return;

      let timestamp = this.extractHistoryTimestamp(message);
      if (!timestamp) {
        timestamp = lastTimestamp + 1;
      } else if (timestamp <= lastTimestamp) {
        timestamp = lastTimestamp + 1;
      }
      lastTimestamp = timestamp;

      messages.push({
        id: this.buildMessageId(sessionId, index, role, text, timestamp),
        type: role === 'assistant' ? 'assistant' : role === 'user' ? 'user' : 'system',
        content: text,
        timestamp,
        metadata: role === 'system' ? { source: 'openclaw-history' } : undefined,
      });
    });

    return messages;
  }

  private getDeletedAtForSession(sessionId: string): number {
    const cached = this.deletedAtBySessionId.get(sessionId);
    if (cached) {
      return cached;
    }

    const persisted = this.coworkStore.getImportedSessionDeletedAt(sessionId);
    if (persisted) {
      this.deletedAtBySessionId.set(sessionId, persisted);
      return persisted;
    }

    return 0;
  }

  private mergePendingLocalMessages(
    currentMessages: CoworkMessage[],
    gatewayMessages: CoworkMessage[],
  ): CoworkMessage[] {
    if (currentMessages.length === 0 || gatewayMessages.length === 0) {
      return gatewayMessages;
    }

    const mergedMessages = [...gatewayMessages];
    const lastGatewayTimestamp = gatewayMessages[gatewayMessages.length - 1]?.timestamp || 0;

    for (const message of currentMessages) {
      if (message.timestamp <= lastGatewayTimestamp) {
        continue;
      }
      if (this.hasEquivalentMessage(mergedMessages, message)) {
        continue;
      }
      mergedMessages.push(message);
    }

    return mergedMessages;
  }

  private hasEquivalentMessage(messages: CoworkMessage[], candidate: CoworkMessage): boolean {
    return messages.some((message) => {
      return message.type === candidate.type
        && message.content === candidate.content
        && Math.abs(message.timestamp - candidate.timestamp) <= 120_000;
    });
  }

  private getGatewayHistoryRole(value: unknown): GatewayHistoryRole | null {
    const role = typeof value === 'string' ? value.trim().toLowerCase() : '';
    return role === 'user' || role === 'assistant' || role === 'system'
      ? role
      : null;
  }

  private buildMessageId(
    sessionId: string,
    index: number,
    role: GatewayHistoryRole,
    content: string,
    timestamp: number,
  ): string {
    const digest = crypto.createHash('sha1')
      .update(`${sessionId}:${index}:${role}:${timestamp}:${content}`)
      .digest('hex');
    return `${sessionId}:history:${digest}`;
  }

  private extractHistoryTimestamp(message: Record<string, unknown>): number {
    const candidates = [
      message.timestamp,
      message.createdAt,
      message.updatedAt,
      message.time,
    ];

    for (const candidate of candidates) {
      const normalized = this.normalizeTimestamp(candidate);
      if (normalized > 0) {
        return normalized;
      }
    }

    return 0;
  }

  private normalizeTimestamp(value: unknown): number {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      return value < 1_000_000_000_000 ? value * 1000 : value;
    }
    if (typeof value === 'string' && value.trim()) {
      const numeric = Number(value);
      if (Number.isFinite(numeric) && numeric > 0) {
        return numeric < 1_000_000_000_000 ? numeric * 1000 : numeric;
      }
      const parsed = Date.parse(value);
      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
      }
    }
    return 0;
  }

  private resolveSessionStatus(
    row: OpenClawSessionRow,
    messages: CoworkMessage[],
  ): 'idle' | 'running' | 'completed' | 'error' {
    if (row.abortedLastRun) {
      return 'error';
    }
    if (messages.length === 0) {
      return 'idle';
    }
    return messages[messages.length - 1]?.type === 'user' ? 'running' : 'completed';
  }

  private reconcileSessionStatus(
    current: CoworkSession | null,
    rowUpdatedAt: number,
    gatewayStatus: 'idle' | 'running' | 'completed' | 'error',
    gatewayMessages: CoworkMessage[],
    mergedMessages: CoworkMessage[],
  ): 'idle' | 'running' | 'completed' | 'error' {
    if (!current) {
      return gatewayStatus;
    }

    const hasLocalTail = mergedMessages.length > gatewayMessages.length;
    if (current.status === 'running' && hasLocalTail) {
      return 'running';
    }

    if (
      current.updatedAt + LOCAL_STATUS_GRACE_WINDOW_MS >= rowUpdatedAt
      && current.status !== 'running'
    ) {
      if (current.status === 'idle' && gatewayStatus === 'running') {
        return 'idle';
      }
      if (current.status === 'error') {
        return 'error';
      }
    }

    return gatewayStatus;
  }

  private isSessionSnapshotEqual(current: CoworkSession | null, next: CoworkSession): boolean {
    if (!current) return false;
    if (current.title !== next.title) return false;
    if (current.status !== next.status) return false;
    if (current.cwd !== next.cwd) return false;
    if (current.updatedAt !== next.updatedAt) return false;
    if (current.messages.length !== next.messages.length) return false;

    const currentLast = current.messages[current.messages.length - 1];
    const nextLast = next.messages[next.messages.length - 1];
    if (!currentLast && !nextLast) return true;
    if (!currentLast || !nextLast) return false;

    return currentLast.id === nextLast.id
      && currentLast.type === nextLast.type
      && currentLast.timestamp === nextLast.timestamp
      && currentLast.content === nextLast.content;
  }
}
