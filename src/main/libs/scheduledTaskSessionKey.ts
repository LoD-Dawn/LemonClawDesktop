const MANAGED_PREFIX = 'lc:managed:';

export function buildManagedSessionKey(sessionId: string): string {
  return `${MANAGED_PREFIX}${sessionId}`;
}

export function parseManagedSessionKey(sessionKey: string | null | undefined): { sessionId: string } | null {
  const raw = (sessionKey ?? '').trim();
  if (!raw.startsWith(MANAGED_PREFIX)) {
    return null;
  }
  const sessionId = raw.slice(MANAGED_PREFIX.length).trim();
  return sessionId ? { sessionId } : null;
}
