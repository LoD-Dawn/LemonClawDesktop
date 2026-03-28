export const OPENCLAW_WEIXIN_CHANNEL = 'openclaw-weixin';
export const OPENCLAW_WEIXIN_SESSION_ID_PREFIX = 'openclaw-weixin:';

type ParsedOpenClawWeixinSessionKey = {
  conversationId: string;
  accountId?: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
};

export const isOpenClawWeixinSessionId = (sessionId: string | null | undefined): boolean => {
  return typeof sessionId === 'string' && sessionId.startsWith(OPENCLAW_WEIXIN_SESSION_ID_PREFIX);
};

const normalizeWeixinConversationId = (value: string | null | undefined): string => {
  const trimmed = (value || '').trim();
  if (!trimmed) return '';

  const normalized = trimmed
    .replace(/^(?:dm|direct|peer):/i, '')
    .replace(/^(?:user|conversation):/i, '');

  return normalized.trim() || trimmed;
};

const parseWeixinRouteParts = (parts: string[]): ParsedOpenClawWeixinSessionKey | null => {
  if (parts.length === 0) return null;

  if (parts[0] === OPENCLAW_WEIXIN_CHANNEL) {
    return parseWeixinRouteParts(parts.slice(1));
  }

  if (parts[0] === 'dm' || parts[0] === 'direct' || parts[0] === 'peer') {
    const conversationId = normalizeWeixinConversationId(parts.slice(1).join(':'));
    return conversationId ? { conversationId } : null;
  }

  if (parts.length >= 2 && (parts[1] === 'dm' || parts[1] === 'direct' || parts[1] === 'peer')) {
    const accountId = parts[0].trim();
    const conversationId = normalizeWeixinConversationId(parts.slice(2).join(':'));
    if (!conversationId) return null;
    return accountId ? { conversationId, accountId } : { conversationId };
  }

  const conversationId = normalizeWeixinConversationId(parts.join(':'));
  return conversationId ? { conversationId } : null;
};

export const parseOpenClawWeixinSessionKey = (
  sessionKey: string | null | undefined,
): ParsedOpenClawWeixinSessionKey | null => {
  const raw = (sessionKey || '').trim();
  if (!raw) return null;

  if (raw.startsWith('agent:')) {
    const jsonIdx = raw.indexOf(':{');
    if (jsonIdx > 0) {
      const jsonStr = raw.slice(jsonIdx + 1);
      try {
        const context = JSON.parse(jsonStr) as unknown;
        if (isRecord(context) && context.channel === OPENCLAW_WEIXIN_CHANNEL) {
          const conversationId = [context.peerid, context.conversationId, context.accountid, jsonStr]
            .find((value) => typeof value === 'string' && value.trim()) as string | undefined;
          if (conversationId) {
            const normalizedConversationId = normalizeWeixinConversationId(conversationId);
            const accountId = typeof context.accountid === 'string' ? context.accountid.trim() : '';
            return accountId
              ? { conversationId: normalizedConversationId, accountId }
              : { conversationId: normalizedConversationId };
          }
        }
      } catch {
        // Fall back to colon-split parsing below.
      }
    }

    const parts = raw.split(':');
    const channelIdx = parts.indexOf(OPENCLAW_WEIXIN_CHANNEL);
    if (channelIdx >= 0 && channelIdx < parts.length - 1) {
      return parseWeixinRouteParts(parts.slice(channelIdx + 1));
    }

    if (parts.length >= 4 && (parts[2] === 'dm' || parts[2] === 'direct' || parts[2] === 'peer')) {
      return parseWeixinRouteParts(parts.slice(2));
    }

    return null;
  }

  if (raw.startsWith(`${OPENCLAW_WEIXIN_CHANNEL}:`)) {
    return parseWeixinRouteParts(raw.slice(OPENCLAW_WEIXIN_CHANNEL.length + 1).split(':'));
  }

  return null;
};
