// vendor/openclaw-runtime/win-x64/extensions/nostr/index.ts
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";

// vendor/openclaw-runtime/win-x64/extensions/nostr/src/channel.ts
import {
  buildChannelConfigSchema as buildChannelConfigSchema2,
  collectStatusIssuesFromLastError,
  createDefaultChannelRuntimeState,
  DEFAULT_ACCOUNT_ID as DEFAULT_ACCOUNT_ID2,
  formatPairingApproveHint
} from "openclaw/plugin-sdk";

// vendor/openclaw-runtime/win-x64/extensions/nostr/src/config-schema.ts
import { MarkdownConfigSchema, buildChannelConfigSchema } from "openclaw/plugin-sdk";
import { z } from "zod";
var allowFromEntry = z.union([z.string(), z.number()]);
var safeUrlSchema = z.string().url().refine(
  (url) => {
    try {
      const parsed = new URL(url);
      return parsed.protocol === "https:";
    } catch {
      return false;
    }
  },
  { message: "URL must use https:// protocol" }
);
var NostrProfileSchema = z.object({
  /** Username (NIP-01: name) - max 256 chars */
  name: z.string().max(256).optional(),
  /** Display name (NIP-01: display_name) - max 256 chars */
  displayName: z.string().max(256).optional(),
  /** Bio/description (NIP-01: about) - max 2000 chars */
  about: z.string().max(2e3).optional(),
  /** Profile picture URL (must be https) */
  picture: safeUrlSchema.optional(),
  /** Banner image URL (must be https) */
  banner: safeUrlSchema.optional(),
  /** Website URL (must be https) */
  website: safeUrlSchema.optional(),
  /** NIP-05 identifier (e.g., "user@example.com") */
  nip05: z.string().optional(),
  /** Lightning address (LUD-16) */
  lud16: z.string().optional()
});
var NostrConfigSchema = z.object({
  /** Account name (optional display name) */
  name: z.string().optional(),
  /** Optional default account id for routing/account selection. */
  defaultAccount: z.string().optional(),
  /** Whether this channel is enabled */
  enabled: z.boolean().optional(),
  /** Markdown formatting overrides (tables). */
  markdown: MarkdownConfigSchema,
  /** Private key in hex or nsec bech32 format */
  privateKey: z.string().optional(),
  /** WebSocket relay URLs to connect to */
  relays: z.array(z.string()).optional(),
  /** DM access policy: pairing, allowlist, open, or disabled */
  dmPolicy: z.enum(["pairing", "allowlist", "open", "disabled"]).optional(),
  /** Allowed sender pubkeys (npub or hex format) */
  allowFrom: z.array(allowFromEntry).optional(),
  /** Profile metadata (NIP-01 kind:0 content) */
  profile: NostrProfileSchema.optional()
});
var nostrChannelConfigSchema = buildChannelConfigSchema(NostrConfigSchema);

// vendor/openclaw-runtime/win-x64/extensions/nostr/src/nostr-bus.ts
import {
  SimplePool as SimplePool2,
  finalizeEvent as finalizeEvent2,
  getPublicKey,
  verifyEvent,
  nip19
} from "nostr-tools";
import { decrypt, encrypt } from "nostr-tools/nip04";

// vendor/openclaw-runtime/win-x64/extensions/nostr/src/metrics.ts
function createMetrics(onMetric) {
  let eventsReceived = 0;
  let eventsProcessed = 0;
  let eventsDuplicate = 0;
  const eventsRejected = {
    invalidShape: 0,
    wrongKind: 0,
    stale: 0,
    future: 0,
    rateLimited: 0,
    invalidSignature: 0,
    oversizedCiphertext: 0,
    oversizedPlaintext: 0,
    decryptFailed: 0,
    selfMessage: 0
  };
  const relays = /* @__PURE__ */ new Map();
  const rateLimiting = {
    perSenderHits: 0,
    globalHits: 0
  };
  const decrypt2 = {
    success: 0,
    failure: 0
  };
  const memory = {
    seenTrackerSize: 0,
    rateLimiterEntries: 0
  };
  function getOrCreateRelay(url) {
    let relay = relays.get(url);
    if (!relay) {
      relay = {
        connects: 0,
        disconnects: 0,
        reconnects: 0,
        errors: 0,
        messagesReceived: {
          event: 0,
          eose: 0,
          closed: 0,
          notice: 0,
          ok: 0,
          auth: 0
        },
        circuitBreakerState: "closed",
        circuitBreakerOpens: 0,
        circuitBreakerCloses: 0
      };
      relays.set(url, relay);
    }
    return relay;
  }
  function emit(name, value = 1, labels) {
    if (onMetric) {
      onMetric({
        name,
        value,
        timestamp: Date.now(),
        labels
      });
    }
    const relayUrl = labels?.relay;
    switch (name) {
      case "event.received":
        eventsReceived += value;
        break;
      case "event.processed":
        eventsProcessed += value;
        break;
      case "event.duplicate":
        eventsDuplicate += value;
        break;
      case "event.rejected.invalid_shape":
        eventsRejected.invalidShape += value;
        break;
      case "event.rejected.wrong_kind":
        eventsRejected.wrongKind += value;
        break;
      case "event.rejected.stale":
        eventsRejected.stale += value;
        break;
      case "event.rejected.future":
        eventsRejected.future += value;
        break;
      case "event.rejected.rate_limited":
        eventsRejected.rateLimited += value;
        break;
      case "event.rejected.invalid_signature":
        eventsRejected.invalidSignature += value;
        break;
      case "event.rejected.oversized_ciphertext":
        eventsRejected.oversizedCiphertext += value;
        break;
      case "event.rejected.oversized_plaintext":
        eventsRejected.oversizedPlaintext += value;
        break;
      case "event.rejected.decrypt_failed":
        eventsRejected.decryptFailed += value;
        break;
      case "event.rejected.self_message":
        eventsRejected.selfMessage += value;
        break;
      case "relay.connect":
        if (relayUrl) {
          getOrCreateRelay(relayUrl).connects += value;
        }
        break;
      case "relay.disconnect":
        if (relayUrl) {
          getOrCreateRelay(relayUrl).disconnects += value;
        }
        break;
      case "relay.reconnect":
        if (relayUrl) {
          getOrCreateRelay(relayUrl).reconnects += value;
        }
        break;
      case "relay.error":
        if (relayUrl) {
          getOrCreateRelay(relayUrl).errors += value;
        }
        break;
      case "relay.message.event":
        if (relayUrl) {
          getOrCreateRelay(relayUrl).messagesReceived.event += value;
        }
        break;
      case "relay.message.eose":
        if (relayUrl) {
          getOrCreateRelay(relayUrl).messagesReceived.eose += value;
        }
        break;
      case "relay.message.closed":
        if (relayUrl) {
          getOrCreateRelay(relayUrl).messagesReceived.closed += value;
        }
        break;
      case "relay.message.notice":
        if (relayUrl) {
          getOrCreateRelay(relayUrl).messagesReceived.notice += value;
        }
        break;
      case "relay.message.ok":
        if (relayUrl) {
          getOrCreateRelay(relayUrl).messagesReceived.ok += value;
        }
        break;
      case "relay.message.auth":
        if (relayUrl) {
          getOrCreateRelay(relayUrl).messagesReceived.auth += value;
        }
        break;
      case "relay.circuit_breaker.open":
        if (relayUrl) {
          const r = getOrCreateRelay(relayUrl);
          r.circuitBreakerState = "open";
          r.circuitBreakerOpens += value;
        }
        break;
      case "relay.circuit_breaker.close":
        if (relayUrl) {
          const r = getOrCreateRelay(relayUrl);
          r.circuitBreakerState = "closed";
          r.circuitBreakerCloses += value;
        }
        break;
      case "relay.circuit_breaker.half_open":
        if (relayUrl) {
          getOrCreateRelay(relayUrl).circuitBreakerState = "half_open";
        }
        break;
      case "rate_limit.per_sender":
        rateLimiting.perSenderHits += value;
        break;
      case "rate_limit.global":
        rateLimiting.globalHits += value;
        break;
      case "decrypt.success":
        decrypt2.success += value;
        break;
      case "decrypt.failure":
        decrypt2.failure += value;
        break;
      case "memory.seen_tracker_size":
        memory.seenTrackerSize = value;
        break;
      case "memory.rate_limiter_entries":
        memory.rateLimiterEntries = value;
        break;
    }
  }
  function getSnapshot() {
    const relaysObj = {};
    for (const [url, stats] of relays) {
      relaysObj[url] = { ...stats, messagesReceived: { ...stats.messagesReceived } };
    }
    return {
      eventsReceived,
      eventsProcessed,
      eventsDuplicate,
      eventsRejected: { ...eventsRejected },
      relays: relaysObj,
      rateLimiting: { ...rateLimiting },
      decrypt: { ...decrypt2 },
      memory: { ...memory },
      snapshotAt: Date.now()
    };
  }
  function reset() {
    eventsReceived = 0;
    eventsProcessed = 0;
    eventsDuplicate = 0;
    Object.assign(eventsRejected, {
      invalidShape: 0,
      wrongKind: 0,
      stale: 0,
      future: 0,
      rateLimited: 0,
      invalidSignature: 0,
      oversizedCiphertext: 0,
      oversizedPlaintext: 0,
      decryptFailed: 0,
      selfMessage: 0
    });
    relays.clear();
    rateLimiting.perSenderHits = 0;
    rateLimiting.globalHits = 0;
    decrypt2.success = 0;
    decrypt2.failure = 0;
    memory.seenTrackerSize = 0;
    memory.rateLimiterEntries = 0;
  }
  return { emit, getSnapshot, reset };
}
function createNoopMetrics() {
  const emptySnapshot = {
    eventsReceived: 0,
    eventsProcessed: 0,
    eventsDuplicate: 0,
    eventsRejected: {
      invalidShape: 0,
      wrongKind: 0,
      stale: 0,
      future: 0,
      rateLimited: 0,
      invalidSignature: 0,
      oversizedCiphertext: 0,
      oversizedPlaintext: 0,
      decryptFailed: 0,
      selfMessage: 0
    },
    relays: {},
    rateLimiting: { perSenderHits: 0, globalHits: 0 },
    decrypt: { success: 0, failure: 0 },
    memory: { seenTrackerSize: 0, rateLimiterEntries: 0 },
    snapshotAt: 0
  };
  return {
    emit: () => {
    },
    getSnapshot: () => ({ ...emptySnapshot, snapshotAt: Date.now() }),
    reset: () => {
    }
  };
}

// vendor/openclaw-runtime/win-x64/extensions/nostr/src/nostr-profile.ts
import { finalizeEvent } from "nostr-tools";
function profileToContent(profile) {
  const validated = NostrProfileSchema.parse(profile);
  const content = {};
  if (validated.name !== void 0) {
    content.name = validated.name;
  }
  if (validated.displayName !== void 0) {
    content.display_name = validated.displayName;
  }
  if (validated.about !== void 0) {
    content.about = validated.about;
  }
  if (validated.picture !== void 0) {
    content.picture = validated.picture;
  }
  if (validated.banner !== void 0) {
    content.banner = validated.banner;
  }
  if (validated.website !== void 0) {
    content.website = validated.website;
  }
  if (validated.nip05 !== void 0) {
    content.nip05 = validated.nip05;
  }
  if (validated.lud16 !== void 0) {
    content.lud16 = validated.lud16;
  }
  return content;
}
function contentToProfile(content) {
  const profile = {};
  if (content.name !== void 0) {
    profile.name = content.name;
  }
  if (content.display_name !== void 0) {
    profile.displayName = content.display_name;
  }
  if (content.about !== void 0) {
    profile.about = content.about;
  }
  if (content.picture !== void 0) {
    profile.picture = content.picture;
  }
  if (content.banner !== void 0) {
    profile.banner = content.banner;
  }
  if (content.website !== void 0) {
    profile.website = content.website;
  }
  if (content.nip05 !== void 0) {
    profile.nip05 = content.nip05;
  }
  if (content.lud16 !== void 0) {
    profile.lud16 = content.lud16;
  }
  return profile;
}
function createProfileEvent(sk, profile, lastPublishedAt) {
  const content = profileToContent(profile);
  const contentJson = JSON.stringify(content);
  const now = Math.floor(Date.now() / 1e3);
  const createdAt = lastPublishedAt !== void 0 ? Math.max(now, lastPublishedAt + 1) : now;
  const event = finalizeEvent(
    {
      kind: 0,
      content: contentJson,
      tags: [],
      created_at: createdAt
    },
    sk
  );
  return event;
}
var RELAY_PUBLISH_TIMEOUT_MS = 5e3;
async function publishProfileEvent(pool, relays, event) {
  const successes = [];
  const failures = [];
  const publishPromises = relays.map(async (relay) => {
    try {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("timeout")), RELAY_PUBLISH_TIMEOUT_MS);
      });
      await Promise.race([pool.publish([relay], event), timeoutPromise]);
      successes.push(relay);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      failures.push({ relay, error: errorMessage });
    }
  });
  await Promise.all(publishPromises);
  return {
    eventId: event.id,
    successes,
    failures,
    createdAt: event.created_at
  };
}
async function publishProfile(pool, sk, relays, profile, lastPublishedAt) {
  const event = createProfileEvent(sk, profile, lastPublishedAt);
  return publishProfileEvent(pool, relays, event);
}

// vendor/openclaw-runtime/win-x64/extensions/nostr/src/nostr-state-store.ts
import crypto from "crypto";
import fs from "fs/promises";
import os from "os";
import path from "path";

// vendor/openclaw-runtime/win-x64/extensions/nostr/src/runtime.ts
var runtime = null;
function setNostrRuntime(next) {
  runtime = next;
}
function getNostrRuntime() {
  if (!runtime) {
    throw new Error("Nostr runtime not initialized");
  }
  return runtime;
}

// vendor/openclaw-runtime/win-x64/extensions/nostr/src/nostr-state-store.ts
var STORE_VERSION = 2;
var PROFILE_STATE_VERSION = 1;
function normalizeAccountId(accountId) {
  const trimmed = accountId?.trim();
  if (!trimmed) {
    return "default";
  }
  return trimmed.replace(/[^a-z0-9._-]+/gi, "_");
}
function resolveNostrStatePath(accountId, env = process.env) {
  const stateDir = getNostrRuntime().state.resolveStateDir(env, os.homedir);
  const normalized = normalizeAccountId(accountId);
  return path.join(stateDir, "nostr", `bus-state-${normalized}.json`);
}
function resolveNostrProfileStatePath(accountId, env = process.env) {
  const stateDir = getNostrRuntime().state.resolveStateDir(env, os.homedir);
  const normalized = normalizeAccountId(accountId);
  return path.join(stateDir, "nostr", `profile-state-${normalized}.json`);
}
function safeParseState(raw) {
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.version === 2) {
      return {
        version: 2,
        lastProcessedAt: typeof parsed.lastProcessedAt === "number" ? parsed.lastProcessedAt : null,
        gatewayStartedAt: typeof parsed.gatewayStartedAt === "number" ? parsed.gatewayStartedAt : null,
        recentEventIds: Array.isArray(parsed.recentEventIds) ? parsed.recentEventIds.filter((x) => typeof x === "string") : []
      };
    }
    if (parsed?.version === 1) {
      return {
        version: 2,
        lastProcessedAt: typeof parsed.lastProcessedAt === "number" ? parsed.lastProcessedAt : null,
        gatewayStartedAt: typeof parsed.gatewayStartedAt === "number" ? parsed.gatewayStartedAt : null,
        recentEventIds: []
      };
    }
    return null;
  } catch {
    return null;
  }
}
async function readNostrBusState(params) {
  const filePath = resolveNostrStatePath(params.accountId, params.env);
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return safeParseState(raw);
  } catch (err) {
    const code = err.code;
    if (code === "ENOENT") {
      return null;
    }
    return null;
  }
}
async function writeNostrBusState(params) {
  const filePath = resolveNostrStatePath(params.accountId, params.env);
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true, mode: 448 });
  const tmp = path.join(dir, `${path.basename(filePath)}.${crypto.randomUUID()}.tmp`);
  const payload = {
    version: STORE_VERSION,
    lastProcessedAt: params.lastProcessedAt,
    gatewayStartedAt: params.gatewayStartedAt,
    recentEventIds: (params.recentEventIds ?? []).filter((x) => typeof x === "string")
  };
  await fs.writeFile(tmp, `${JSON.stringify(payload, null, 2)}
`, {
    encoding: "utf-8"
  });
  await fs.chmod(tmp, 384);
  await fs.rename(tmp, filePath);
}
function computeSinceTimestamp(state, nowSec = Math.floor(Date.now() / 1e3)) {
  if (!state) {
    return nowSec;
  }
  const candidates = [state.lastProcessedAt, state.gatewayStartedAt].filter(
    (t) => t !== null && t > 0
  );
  if (candidates.length === 0) {
    return nowSec;
  }
  return Math.max(...candidates);
}
function safeParseProfileState(raw) {
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.version === 1) {
      return {
        version: 1,
        lastPublishedAt: typeof parsed.lastPublishedAt === "number" ? parsed.lastPublishedAt : null,
        lastPublishedEventId: typeof parsed.lastPublishedEventId === "string" ? parsed.lastPublishedEventId : null,
        lastPublishResults: parsed.lastPublishResults && typeof parsed.lastPublishResults === "object" ? parsed.lastPublishResults : null
      };
    }
    return null;
  } catch {
    return null;
  }
}
async function readNostrProfileState(params) {
  const filePath = resolveNostrProfileStatePath(params.accountId, params.env);
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return safeParseProfileState(raw);
  } catch (err) {
    const code = err.code;
    if (code === "ENOENT") {
      return null;
    }
    return null;
  }
}
async function writeNostrProfileState(params) {
  const filePath = resolveNostrProfileStatePath(params.accountId, params.env);
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true, mode: 448 });
  const tmp = path.join(dir, `${path.basename(filePath)}.${crypto.randomUUID()}.tmp`);
  const payload = {
    version: PROFILE_STATE_VERSION,
    lastPublishedAt: params.lastPublishedAt,
    lastPublishedEventId: params.lastPublishedEventId,
    lastPublishResults: params.lastPublishResults
  };
  await fs.writeFile(tmp, `${JSON.stringify(payload, null, 2)}
`, {
    encoding: "utf-8"
  });
  await fs.chmod(tmp, 384);
  await fs.rename(tmp, filePath);
}

// vendor/openclaw-runtime/win-x64/extensions/nostr/src/seen-tracker.ts
function createSeenTracker(options) {
  const maxEntries = options?.maxEntries ?? 1e5;
  const ttlMs = options?.ttlMs ?? 60 * 60 * 1e3;
  const pruneIntervalMs = options?.pruneIntervalMs ?? 10 * 60 * 1e3;
  const entries = /* @__PURE__ */ new Map();
  let head = null;
  let tail = null;
  function moveToFront(id) {
    const entry = entries.get(id);
    if (!entry) {
      return;
    }
    if (head === id) {
      return;
    }
    if (entry.prev) {
      const prevEntry = entries.get(entry.prev);
      if (prevEntry) {
        prevEntry.next = entry.next;
      }
    }
    if (entry.next) {
      const nextEntry = entries.get(entry.next);
      if (nextEntry) {
        nextEntry.prev = entry.prev;
      }
    }
    if (tail === id) {
      tail = entry.prev;
    }
    entry.prev = null;
    entry.next = head;
    if (head) {
      const headEntry = entries.get(head);
      if (headEntry) {
        headEntry.prev = id;
      }
    }
    head = id;
    if (!tail) {
      tail = id;
    }
  }
  function removeFromList(id) {
    const entry = entries.get(id);
    if (!entry) {
      return;
    }
    if (entry.prev) {
      const prevEntry = entries.get(entry.prev);
      if (prevEntry) {
        prevEntry.next = entry.next;
      }
    } else {
      head = entry.next;
    }
    if (entry.next) {
      const nextEntry = entries.get(entry.next);
      if (nextEntry) {
        nextEntry.prev = entry.prev;
      }
    } else {
      tail = entry.prev;
    }
  }
  function evictLRU() {
    if (!tail) {
      return;
    }
    const idToEvict = tail;
    removeFromList(idToEvict);
    entries.delete(idToEvict);
  }
  function insertAtFront(id, seenAt) {
    const newEntry = {
      seenAt,
      prev: null,
      next: head
    };
    if (head) {
      const headEntry = entries.get(head);
      if (headEntry) {
        headEntry.prev = id;
      }
    }
    entries.set(id, newEntry);
    head = id;
    if (!tail) {
      tail = id;
    }
  }
  function pruneExpired() {
    const now = Date.now();
    const toDelete = [];
    for (const [id, entry] of entries) {
      if (now - entry.seenAt > ttlMs) {
        toDelete.push(id);
      }
    }
    for (const id of toDelete) {
      removeFromList(id);
      entries.delete(id);
    }
  }
  let pruneTimer;
  if (pruneIntervalMs > 0) {
    pruneTimer = setInterval(pruneExpired, pruneIntervalMs);
    if (pruneTimer.unref) {
      pruneTimer.unref();
    }
  }
  function add(id) {
    const now = Date.now();
    const existing = entries.get(id);
    if (existing) {
      existing.seenAt = now;
      moveToFront(id);
      return;
    }
    while (entries.size >= maxEntries) {
      evictLRU();
    }
    insertAtFront(id, now);
  }
  function has(id) {
    const entry = entries.get(id);
    if (!entry) {
      add(id);
      return false;
    }
    if (Date.now() - entry.seenAt > ttlMs) {
      removeFromList(id);
      entries.delete(id);
      add(id);
      return false;
    }
    entry.seenAt = Date.now();
    moveToFront(id);
    return true;
  }
  function peek(id) {
    const entry = entries.get(id);
    if (!entry) {
      return false;
    }
    if (Date.now() - entry.seenAt > ttlMs) {
      removeFromList(id);
      entries.delete(id);
      return false;
    }
    return true;
  }
  function deleteEntry(id) {
    if (entries.has(id)) {
      removeFromList(id);
      entries.delete(id);
    }
  }
  function clear() {
    entries.clear();
    head = null;
    tail = null;
  }
  function size() {
    return entries.size;
  }
  function stop() {
    if (pruneTimer) {
      clearInterval(pruneTimer);
      pruneTimer = void 0;
    }
  }
  function seed(ids) {
    const now = Date.now();
    for (let i = ids.length - 1; i >= 0; i--) {
      const id = ids[i];
      if (!entries.has(id) && entries.size < maxEntries) {
        insertAtFront(id, now);
      }
    }
  }
  return {
    has,
    add,
    peek,
    delete: deleteEntry,
    clear,
    size,
    stop,
    seed
  };
}

// vendor/openclaw-runtime/win-x64/extensions/nostr/src/nostr-bus.ts
var DEFAULT_RELAYS = ["wss://relay.damus.io", "wss://nos.lol"];
var STARTUP_LOOKBACK_SEC = 120;
var MAX_PERSISTED_EVENT_IDS = 5e3;
var STATE_PERSIST_DEBOUNCE_MS = 5e3;
var CIRCUIT_BREAKER_THRESHOLD = 5;
var CIRCUIT_BREAKER_RESET_MS = 3e4;
var HEALTH_WINDOW_MS = 6e4;
function createCircuitBreaker(relay, metrics, threshold = CIRCUIT_BREAKER_THRESHOLD, resetMs = CIRCUIT_BREAKER_RESET_MS) {
  const state = {
    state: "closed",
    failures: 0,
    lastFailure: 0,
    lastSuccess: Date.now()
  };
  return {
    canAttempt() {
      if (state.state === "closed") {
        return true;
      }
      if (state.state === "open") {
        if (Date.now() - state.lastFailure >= resetMs) {
          state.state = "half_open";
          metrics.emit("relay.circuit_breaker.half_open", 1, { relay });
          return true;
        }
        return false;
      }
      return true;
    },
    recordSuccess() {
      if (state.state === "half_open") {
        state.state = "closed";
        state.failures = 0;
        metrics.emit("relay.circuit_breaker.close", 1, { relay });
      } else if (state.state === "closed") {
        state.failures = 0;
      }
      state.lastSuccess = Date.now();
    },
    recordFailure() {
      state.failures++;
      state.lastFailure = Date.now();
      if (state.state === "half_open") {
        state.state = "open";
        metrics.emit("relay.circuit_breaker.open", 1, { relay });
      } else if (state.state === "closed" && state.failures >= threshold) {
        state.state = "open";
        metrics.emit("relay.circuit_breaker.open", 1, { relay });
      }
    },
    getState() {
      return state.state;
    }
  };
}
function createRelayHealthTracker() {
  const stats = /* @__PURE__ */ new Map();
  function getOrCreate(relay) {
    let s = stats.get(relay);
    if (!s) {
      s = {
        successCount: 0,
        failureCount: 0,
        latencySum: 0,
        latencyCount: 0,
        lastSuccess: 0,
        lastFailure: 0
      };
      stats.set(relay, s);
    }
    return s;
  }
  return {
    recordSuccess(relay, latencyMs) {
      const s = getOrCreate(relay);
      s.successCount++;
      s.latencySum += latencyMs;
      s.latencyCount++;
      s.lastSuccess = Date.now();
    },
    recordFailure(relay) {
      const s = getOrCreate(relay);
      s.failureCount++;
      s.lastFailure = Date.now();
    },
    getScore(relay) {
      const s = stats.get(relay);
      if (!s) {
        return 0.5;
      }
      const total = s.successCount + s.failureCount;
      if (total === 0) {
        return 0.5;
      }
      const successRate = s.successCount / total;
      const now = Date.now();
      const recencyBonus = s.lastSuccess > s.lastFailure ? Math.max(0, 1 - (now - s.lastSuccess) / HEALTH_WINDOW_MS) * 0.2 : 0;
      const avgLatency = s.latencyCount > 0 ? s.latencySum / s.latencyCount : 1e3;
      const latencyPenalty = Math.min(0.2, avgLatency / 1e4);
      return Math.max(0, Math.min(1, successRate + recencyBonus - latencyPenalty));
    },
    getSortedRelays(relays) {
      return [...relays].toSorted((a, b) => this.getScore(b) - this.getScore(a));
    }
  };
}
function validatePrivateKey(key) {
  const trimmed = key.trim();
  if (trimmed.startsWith("nsec1")) {
    const decoded = nip19.decode(trimmed);
    if (decoded.type !== "nsec") {
      throw new Error("Invalid nsec key: wrong type");
    }
    return decoded.data;
  }
  if (!/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    throw new Error("Private key must be 64 hex characters or nsec bech32 format");
  }
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    bytes[i] = parseInt(trimmed.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}
function getPublicKeyFromPrivate(privateKey) {
  const sk = validatePrivateKey(privateKey);
  return getPublicKey(sk);
}
async function startNostrBus(options) {
  const {
    privateKey,
    relays = DEFAULT_RELAYS,
    onMessage,
    onError,
    onEose,
    onMetric,
    maxSeenEntries = 1e5,
    seenTtlMs = 60 * 60 * 1e3
  } = options;
  const sk = validatePrivateKey(privateKey);
  const pk = getPublicKey(sk);
  const pool = new SimplePool2();
  const accountId = options.accountId ?? pk.slice(0, 16);
  const gatewayStartedAt = Math.floor(Date.now() / 1e3);
  const metrics = onMetric ? createMetrics(onMetric) : createNoopMetrics();
  const seen = createSeenTracker({
    maxEntries: maxSeenEntries,
    ttlMs: seenTtlMs
  });
  const circuitBreakers = /* @__PURE__ */ new Map();
  const healthTracker = createRelayHealthTracker();
  for (const relay of relays) {
    circuitBreakers.set(relay, createCircuitBreaker(relay, metrics));
  }
  const state = await readNostrBusState({ accountId });
  const baseSince = computeSinceTimestamp(state, gatewayStartedAt);
  const since = Math.max(0, baseSince - STARTUP_LOOKBACK_SEC);
  if (state?.recentEventIds?.length) {
    seen.seed(state.recentEventIds);
  }
  await writeNostrBusState({
    accountId,
    lastProcessedAt: state?.lastProcessedAt ?? gatewayStartedAt,
    gatewayStartedAt,
    recentEventIds: state?.recentEventIds ?? []
  });
  let pendingWrite;
  let lastProcessedAt = state?.lastProcessedAt ?? gatewayStartedAt;
  let recentEventIds = (state?.recentEventIds ?? []).slice(-MAX_PERSISTED_EVENT_IDS);
  function scheduleStatePersist(eventCreatedAt, eventId) {
    lastProcessedAt = Math.max(lastProcessedAt, eventCreatedAt);
    recentEventIds.push(eventId);
    if (recentEventIds.length > MAX_PERSISTED_EVENT_IDS) {
      recentEventIds = recentEventIds.slice(-MAX_PERSISTED_EVENT_IDS);
    }
    if (pendingWrite) {
      clearTimeout(pendingWrite);
    }
    pendingWrite = setTimeout(() => {
      writeNostrBusState({
        accountId,
        lastProcessedAt,
        gatewayStartedAt,
        recentEventIds
      }).catch((err) => onError?.(err, "persist state"));
    }, STATE_PERSIST_DEBOUNCE_MS);
  }
  const inflight = /* @__PURE__ */ new Set();
  async function handleEvent(event) {
    try {
      metrics.emit("event.received");
      if (seen.peek(event.id) || inflight.has(event.id)) {
        metrics.emit("event.duplicate");
        return;
      }
      inflight.add(event.id);
      if (event.pubkey === pk) {
        metrics.emit("event.rejected.self_message");
        return;
      }
      if (event.created_at < since) {
        metrics.emit("event.rejected.stale");
        return;
      }
      let targetsUs = false;
      for (const t of event.tags) {
        if (t[0] === "p" && t[1] === pk) {
          targetsUs = true;
          break;
        }
      }
      if (!targetsUs) {
        metrics.emit("event.rejected.wrong_kind");
        return;
      }
      if (!verifyEvent(event)) {
        metrics.emit("event.rejected.invalid_signature");
        onError?.(new Error("Invalid signature"), `event ${event.id}`);
        return;
      }
      seen.add(event.id);
      metrics.emit("memory.seen_tracker_size", seen.size());
      let plaintext;
      try {
        plaintext = decrypt(sk, event.pubkey, event.content);
        metrics.emit("decrypt.success");
      } catch (err) {
        metrics.emit("decrypt.failure");
        metrics.emit("event.rejected.decrypt_failed");
        onError?.(err, `decrypt from ${event.pubkey}`);
        return;
      }
      const replyTo = async (text) => {
        await sendEncryptedDm(
          pool,
          sk,
          event.pubkey,
          text,
          relays,
          metrics,
          circuitBreakers,
          healthTracker,
          onError
        );
      };
      await onMessage(event.pubkey, plaintext, replyTo);
      metrics.emit("event.processed");
      scheduleStatePersist(event.created_at, event.id);
    } catch (err) {
      onError?.(err, `event ${event.id}`);
    } finally {
      inflight.delete(event.id);
    }
  }
  const sub = pool.subscribeMany(
    relays,
    [{ kinds: [4], "#p": [pk], since }],
    {
      onevent: handleEvent,
      oneose: () => {
        for (const relay of relays) {
          metrics.emit("relay.message.eose", 1, { relay });
        }
        onEose?.(relays.join(", "));
      },
      onclose: (reason) => {
        for (const relay of relays) {
          metrics.emit("relay.message.closed", 1, { relay });
          options.onDisconnect?.(relay);
        }
        onError?.(new Error(`Subscription closed: ${reason.join(", ")}`), "subscription");
      }
    }
  );
  const sendDm = async (toPubkey, text) => {
    await sendEncryptedDm(
      pool,
      sk,
      toPubkey,
      text,
      relays,
      metrics,
      circuitBreakers,
      healthTracker,
      onError
    );
  };
  const publishProfile2 = async (profile) => {
    const profileState = await readNostrProfileState({ accountId });
    const lastPublishedAt = profileState?.lastPublishedAt ?? void 0;
    const result = await publishProfile(pool, sk, relays, profile, lastPublishedAt);
    const publishResults = {};
    for (const relay of result.successes) {
      publishResults[relay] = "ok";
    }
    for (const { relay, error } of result.failures) {
      publishResults[relay] = error === "timeout" ? "timeout" : "failed";
    }
    await writeNostrProfileState({
      accountId,
      lastPublishedAt: result.createdAt,
      lastPublishedEventId: result.eventId,
      lastPublishResults: publishResults
    });
    return result;
  };
  const getProfileState = async () => {
    const state2 = await readNostrProfileState({ accountId });
    return {
      lastPublishedAt: state2?.lastPublishedAt ?? null,
      lastPublishedEventId: state2?.lastPublishedEventId ?? null,
      lastPublishResults: state2?.lastPublishResults ?? null
    };
  };
  return {
    close: () => {
      sub.close();
      seen.stop();
      if (pendingWrite) {
        clearTimeout(pendingWrite);
        writeNostrBusState({
          accountId,
          lastProcessedAt,
          gatewayStartedAt,
          recentEventIds
        }).catch((err) => onError?.(err, "persist state on close"));
      }
    },
    publicKey: pk,
    sendDm,
    getMetrics: () => metrics.getSnapshot(),
    publishProfile: publishProfile2,
    getProfileState
  };
}
async function sendEncryptedDm(pool, sk, toPubkey, text, relays, metrics, circuitBreakers, healthTracker, onError) {
  const ciphertext = encrypt(sk, toPubkey, text);
  const reply = finalizeEvent2(
    {
      kind: 4,
      content: ciphertext,
      tags: [["p", toPubkey]],
      created_at: Math.floor(Date.now() / 1e3)
    },
    sk
  );
  const sortedRelays = healthTracker.getSortedRelays(relays);
  let lastError;
  for (const relay of sortedRelays) {
    const cb = circuitBreakers.get(relay);
    if (cb && !cb.canAttempt()) {
      continue;
    }
    const startTime = Date.now();
    try {
      await pool.publish([relay], reply);
      const latency = Date.now() - startTime;
      cb?.recordSuccess();
      healthTracker.recordSuccess(relay, latency);
      return;
    } catch (err) {
      lastError = err;
      const latency = Date.now() - startTime;
      cb?.recordFailure();
      healthTracker.recordFailure(relay);
      metrics.emit("relay.error", 1, { relay, latency });
      onError?.(lastError, `publish to ${relay}`);
    }
  }
  throw new Error(`Failed to publish to any relay: ${lastError?.message}`);
}
function normalizePubkey(input) {
  const trimmed = input.trim();
  if (trimmed.startsWith("npub1")) {
    const decoded = nip19.decode(trimmed);
    if (decoded.type !== "npub") {
      throw new Error("Invalid npub key");
    }
    return Array.from(decoded.data).map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  if (!/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    throw new Error("Pubkey must be 64 hex characters or npub format");
  }
  return trimmed.toLowerCase();
}

// vendor/openclaw-runtime/win-x64/extensions/nostr/src/types.ts
import {
  DEFAULT_ACCOUNT_ID,
  normalizeAccountId as normalizeAccountId2,
  normalizeOptionalAccountId
} from "openclaw/plugin-sdk/account-id";
function resolveConfiguredDefaultNostrAccountId(cfg) {
  const nostrCfg = cfg.channels?.nostr;
  return normalizeOptionalAccountId(nostrCfg?.defaultAccount);
}
function listNostrAccountIds(cfg) {
  const nostrCfg = cfg.channels?.nostr;
  if (nostrCfg?.privateKey) {
    return [resolveConfiguredDefaultNostrAccountId(cfg) ?? DEFAULT_ACCOUNT_ID];
  }
  return [];
}
function resolveDefaultNostrAccountId(cfg) {
  const preferred = resolveConfiguredDefaultNostrAccountId(cfg);
  if (preferred) {
    return preferred;
  }
  const ids = listNostrAccountIds(cfg);
  if (ids.includes(DEFAULT_ACCOUNT_ID)) {
    return DEFAULT_ACCOUNT_ID;
  }
  return ids[0] ?? DEFAULT_ACCOUNT_ID;
}
function resolveNostrAccount(opts) {
  const accountId = normalizeAccountId2(opts.accountId ?? resolveDefaultNostrAccountId(opts.cfg));
  const nostrCfg = opts.cfg.channels?.nostr;
  const baseEnabled = nostrCfg?.enabled !== false;
  const privateKey = nostrCfg?.privateKey ?? "";
  const configured = Boolean(privateKey.trim());
  let publicKey = "";
  if (configured) {
    try {
      publicKey = getPublicKeyFromPrivate(privateKey);
    } catch {
    }
  }
  return {
    accountId,
    name: nostrCfg?.name?.trim() || void 0,
    enabled: baseEnabled,
    configured,
    privateKey,
    publicKey,
    relays: nostrCfg?.relays ?? DEFAULT_RELAYS,
    profile: nostrCfg?.profile,
    config: {
      enabled: nostrCfg?.enabled,
      name: nostrCfg?.name,
      privateKey: nostrCfg?.privateKey,
      relays: nostrCfg?.relays,
      dmPolicy: nostrCfg?.dmPolicy,
      allowFrom: nostrCfg?.allowFrom,
      profile: nostrCfg?.profile
    }
  };
}

// vendor/openclaw-runtime/win-x64/extensions/nostr/src/channel.ts
var activeBuses = /* @__PURE__ */ new Map();
var metricsSnapshots = /* @__PURE__ */ new Map();
var nostrPlugin = {
  id: "nostr",
  meta: {
    id: "nostr",
    label: "Nostr",
    selectionLabel: "Nostr",
    docsPath: "/channels/nostr",
    docsLabel: "nostr",
    blurb: "Decentralized DMs via Nostr relays (NIP-04)",
    order: 100
  },
  capabilities: {
    chatTypes: ["direct"],
    // DMs only for MVP
    media: false
    // No media for MVP
  },
  reload: { configPrefixes: ["channels.nostr"] },
  configSchema: buildChannelConfigSchema2(NostrConfigSchema),
  config: {
    listAccountIds: (cfg) => listNostrAccountIds(cfg),
    resolveAccount: (cfg, accountId) => resolveNostrAccount({ cfg, accountId }),
    defaultAccountId: (cfg) => resolveDefaultNostrAccountId(cfg),
    isConfigured: (account) => account.configured,
    describeAccount: (account) => ({
      accountId: account.accountId,
      name: account.name,
      enabled: account.enabled,
      configured: account.configured,
      publicKey: account.publicKey
    }),
    resolveAllowFrom: ({ cfg, accountId }) => (resolveNostrAccount({ cfg, accountId }).config.allowFrom ?? []).map(
      (entry) => String(entry)
    ),
    formatAllowFrom: ({ allowFrom }) => allowFrom.map((entry) => String(entry).trim()).filter(Boolean).map((entry) => {
      if (entry === "*") {
        return "*";
      }
      try {
        return normalizePubkey(entry);
      } catch {
        return entry;
      }
    }).filter(Boolean)
  },
  pairing: {
    idLabel: "nostrPubkey",
    normalizeAllowEntry: (entry) => {
      try {
        return normalizePubkey(entry.replace(/^nostr:/i, ""));
      } catch {
        return entry;
      }
    },
    notifyApproval: async ({ id }) => {
      const bus = activeBuses.get(DEFAULT_ACCOUNT_ID2);
      if (bus) {
        await bus.sendDm(id, "Your pairing request has been approved!");
      }
    }
  },
  security: {
    resolveDmPolicy: ({ account }) => {
      return {
        policy: account.config.dmPolicy ?? "pairing",
        allowFrom: account.config.allowFrom ?? [],
        policyPath: "channels.nostr.dmPolicy",
        allowFromPath: "channels.nostr.allowFrom",
        approveHint: formatPairingApproveHint("nostr"),
        normalizeEntry: (raw) => {
          try {
            return normalizePubkey(raw.replace(/^nostr:/i, "").trim());
          } catch {
            return raw.trim();
          }
        }
      };
    }
  },
  messaging: {
    normalizeTarget: (target) => {
      const cleaned = target.replace(/^nostr:/i, "").trim();
      try {
        return normalizePubkey(cleaned);
      } catch {
        return cleaned;
      }
    },
    targetResolver: {
      looksLikeId: (input) => {
        const trimmed = input.trim();
        return trimmed.startsWith("npub1") || /^[0-9a-fA-F]{64}$/.test(trimmed);
      },
      hint: "<npub|hex pubkey|nostr:npub...>"
    }
  },
  outbound: {
    deliveryMode: "direct",
    textChunkLimit: 4e3,
    sendText: async ({ to, text, accountId }) => {
      const core = getNostrRuntime();
      const aid = accountId ?? DEFAULT_ACCOUNT_ID2;
      const bus = activeBuses.get(aid);
      if (!bus) {
        throw new Error(`Nostr bus not running for account ${aid}`);
      }
      const tableMode = core.channel.text.resolveMarkdownTableMode({
        cfg: core.config.loadConfig(),
        channel: "nostr",
        accountId: aid
      });
      const message = core.channel.text.convertMarkdownTables(text ?? "", tableMode);
      const normalizedTo = normalizePubkey(to);
      await bus.sendDm(normalizedTo, message);
      return {
        channel: "nostr",
        to: normalizedTo,
        messageId: `nostr-${Date.now()}`
      };
    }
  },
  status: {
    defaultRuntime: createDefaultChannelRuntimeState(DEFAULT_ACCOUNT_ID2),
    collectStatusIssues: (accounts) => collectStatusIssuesFromLastError("nostr", accounts),
    buildChannelSummary: ({ snapshot }) => ({
      configured: snapshot.configured ?? false,
      publicKey: snapshot.publicKey ?? null,
      running: snapshot.running ?? false,
      lastStartAt: snapshot.lastStartAt ?? null,
      lastStopAt: snapshot.lastStopAt ?? null,
      lastError: snapshot.lastError ?? null
    }),
    buildAccountSnapshot: ({ account, runtime: runtime2 }) => ({
      accountId: account.accountId,
      name: account.name,
      enabled: account.enabled,
      configured: account.configured,
      publicKey: account.publicKey,
      profile: account.profile,
      running: runtime2?.running ?? false,
      lastStartAt: runtime2?.lastStartAt ?? null,
      lastStopAt: runtime2?.lastStopAt ?? null,
      lastError: runtime2?.lastError ?? null,
      lastInboundAt: runtime2?.lastInboundAt ?? null,
      lastOutboundAt: runtime2?.lastOutboundAt ?? null
    })
  },
  gateway: {
    startAccount: async (ctx) => {
      const account = ctx.account;
      ctx.setStatus({
        accountId: account.accountId,
        publicKey: account.publicKey
      });
      ctx.log?.info(
        `[${account.accountId}] starting Nostr provider (pubkey: ${account.publicKey})`
      );
      if (!account.configured) {
        throw new Error("Nostr private key not configured");
      }
      const runtime2 = getNostrRuntime();
      let busHandle = null;
      const bus = await startNostrBus({
        accountId: account.accountId,
        privateKey: account.privateKey,
        relays: account.relays,
        onMessage: async (senderPubkey, text, reply) => {
          ctx.log?.debug?.(
            `[${account.accountId}] DM from ${senderPubkey}: ${text.slice(0, 50)}...`
          );
          await runtime2.channel.reply.handleInboundMessage?.({
            channel: "nostr",
            accountId: account.accountId,
            senderId: senderPubkey,
            chatType: "direct",
            chatId: senderPubkey,
            // For DMs, chatId is the sender's pubkey
            text,
            reply: async (responseText) => {
              await reply(responseText);
            }
          });
        },
        onError: (error, context) => {
          ctx.log?.error?.(`[${account.accountId}] Nostr error (${context}): ${error.message}`);
        },
        onConnect: (relay) => {
          ctx.log?.debug?.(`[${account.accountId}] Connected to relay: ${relay}`);
        },
        onDisconnect: (relay) => {
          ctx.log?.debug?.(`[${account.accountId}] Disconnected from relay: ${relay}`);
        },
        onEose: (relays) => {
          ctx.log?.debug?.(`[${account.accountId}] EOSE received from relays: ${relays}`);
        },
        onMetric: (event) => {
          if (event.name.startsWith("event.rejected.")) {
            ctx.log?.debug?.(
              `[${account.accountId}] Metric: ${event.name} ${JSON.stringify(event.labels)}`
            );
          } else if (event.name === "relay.circuit_breaker.open") {
            ctx.log?.warn?.(
              `[${account.accountId}] Circuit breaker opened for relay: ${event.labels?.relay}`
            );
          } else if (event.name === "relay.circuit_breaker.close") {
            ctx.log?.info?.(
              `[${account.accountId}] Circuit breaker closed for relay: ${event.labels?.relay}`
            );
          } else if (event.name === "relay.error") {
            ctx.log?.debug?.(`[${account.accountId}] Relay error: ${event.labels?.relay}`);
          }
          if (busHandle) {
            metricsSnapshots.set(account.accountId, busHandle.getMetrics());
          }
        }
      });
      busHandle = bus;
      activeBuses.set(account.accountId, bus);
      ctx.log?.info(
        `[${account.accountId}] Nostr provider started, connected to ${account.relays.length} relay(s)`
      );
      return {
        stop: () => {
          bus.close();
          activeBuses.delete(account.accountId);
          metricsSnapshots.delete(account.accountId);
          ctx.log?.info(`[${account.accountId}] Nostr provider stopped`);
        }
      };
    }
  }
};
async function publishNostrProfile(accountId = DEFAULT_ACCOUNT_ID2, profile) {
  const bus = activeBuses.get(accountId);
  if (!bus) {
    throw new Error(`Nostr bus not running for account ${accountId}`);
  }
  return bus.publishProfile(profile);
}
async function getNostrProfileState(accountId = DEFAULT_ACCOUNT_ID2) {
  const bus = activeBuses.get(accountId);
  if (!bus) {
    return null;
  }
  return bus.getProfileState();
}

// vendor/openclaw-runtime/win-x64/extensions/nostr/src/nostr-profile-http.ts
import {
  createFixedWindowRateLimiter,
  isBlockedHostnameOrIp,
  readJsonBodyWithLimit,
  requestBodyErrorToText
} from "openclaw/plugin-sdk";
import { z as z2 } from "zod";

// vendor/openclaw-runtime/win-x64/extensions/nostr/src/nostr-profile-import.ts
import { SimplePool as SimplePool3, verifyEvent as verifyEvent2 } from "nostr-tools";
var DEFAULT_TIMEOUT_MS = 5e3;
function sanitizeProfileUrls(profile) {
  const result = { ...profile };
  const urlFields = ["picture", "banner", "website"];
  for (const field of urlFields) {
    const value = result[field];
    if (value && typeof value === "string") {
      const validation = validateUrlSafety(value);
      if (!validation.ok) {
        delete result[field];
      }
    }
  }
  return result;
}
async function importProfileFromRelays(opts) {
  const { pubkey, relays, timeoutMs = DEFAULT_TIMEOUT_MS } = opts;
  if (!pubkey || !/^[0-9a-fA-F]{64}$/.test(pubkey)) {
    return {
      ok: false,
      error: "Invalid pubkey format (must be 64 hex characters)",
      relaysQueried: []
    };
  }
  if (relays.length === 0) {
    return {
      ok: false,
      error: "No relays configured",
      relaysQueried: []
    };
  }
  const pool = new SimplePool3();
  const relaysQueried = [];
  try {
    const events = [];
    const timeoutPromise = new Promise((resolve) => {
      setTimeout(resolve, timeoutMs);
    });
    const subscriptionPromise = new Promise((resolve) => {
      let completed = 0;
      for (const relay of relays) {
        relaysQueried.push(relay);
        const sub = pool.subscribeMany(
          [relay],
          [
            {
              kinds: [0],
              authors: [pubkey],
              limit: 1
            }
          ],
          {
            onevent(event) {
              events.push({ event, relay });
            },
            oneose() {
              completed++;
              if (completed >= relays.length) {
                resolve();
              }
            },
            onclose() {
              completed++;
              if (completed >= relays.length) {
                resolve();
              }
            }
          }
        );
        setTimeout(() => {
          sub.close();
        }, timeoutMs);
      }
    });
    await Promise.race([subscriptionPromise, timeoutPromise]);
    if (events.length === 0) {
      return {
        ok: false,
        error: "No profile found on any relay",
        relaysQueried
      };
    }
    let bestEvent = null;
    for (const item of events) {
      if (!bestEvent || item.event.created_at > bestEvent.event.created_at) {
        bestEvent = item;
      }
    }
    if (!bestEvent) {
      return {
        ok: false,
        error: "No valid profile event found",
        relaysQueried
      };
    }
    const isValid = verifyEvent2(bestEvent.event);
    if (!isValid) {
      return {
        ok: false,
        error: "Profile event has invalid signature",
        relaysQueried,
        sourceRelay: bestEvent.relay
      };
    }
    let content;
    try {
      content = JSON.parse(bestEvent.event.content);
    } catch {
      return {
        ok: false,
        error: "Profile event has invalid JSON content",
        relaysQueried,
        sourceRelay: bestEvent.relay
      };
    }
    const profile = contentToProfile(content);
    const sanitizedProfile = sanitizeProfileUrls(profile);
    return {
      ok: true,
      profile: sanitizedProfile,
      event: {
        id: bestEvent.event.id,
        pubkey: bestEvent.event.pubkey,
        created_at: bestEvent.event.created_at
      },
      relaysQueried,
      sourceRelay: bestEvent.relay
    };
  } finally {
    pool.close(relays);
  }
}
function mergeProfiles(local, imported) {
  if (!imported) {
    return local ?? {};
  }
  if (!local) {
    return imported;
  }
  return {
    name: local.name ?? imported.name,
    displayName: local.displayName ?? imported.displayName,
    about: local.about ?? imported.about,
    picture: local.picture ?? imported.picture,
    banner: local.banner ?? imported.banner,
    website: local.website ?? imported.website,
    nip05: local.nip05 ?? imported.nip05,
    lud16: local.lud16 ?? imported.lud16
  };
}

// vendor/openclaw-runtime/win-x64/extensions/nostr/src/nostr-profile-http.ts
var RATE_LIMIT_WINDOW_MS = 6e4;
var RATE_LIMIT_MAX_REQUESTS = 5;
var RATE_LIMIT_MAX_TRACKED_KEYS = 2048;
var profileRateLimiter = createFixedWindowRateLimiter({
  windowMs: RATE_LIMIT_WINDOW_MS,
  maxRequests: RATE_LIMIT_MAX_REQUESTS,
  maxTrackedKeys: RATE_LIMIT_MAX_TRACKED_KEYS
});
function checkRateLimit(accountId) {
  return !profileRateLimiter.isRateLimited(accountId);
}
var publishLocks = /* @__PURE__ */ new Map();
async function withPublishLock(accountId, fn) {
  const prev = publishLocks.get(accountId) ?? Promise.resolve();
  let resolve;
  const next = new Promise((r) => {
    resolve = r;
  });
  publishLocks.set(accountId, next);
  await prev.catch(() => {
  });
  try {
    return await fn();
  } finally {
    resolve();
    if (publishLocks.get(accountId) === next) {
      publishLocks.delete(accountId);
    }
  }
}
function validateUrlSafety(urlStr) {
  try {
    const url = new URL(urlStr);
    if (url.protocol !== "https:") {
      return { ok: false, error: "URL must use https:// protocol" };
    }
    const hostname = url.hostname.toLowerCase();
    if (isBlockedHostnameOrIp(hostname)) {
      return { ok: false, error: "URL must not point to private/internal addresses" };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Invalid URL format" };
  }
}
var nip05FormatSchema = z2.string().regex(/^[a-z0-9._-]+@[a-z0-9.-]+\.[a-z]{2,}$/i, "Invalid NIP-05 format (user@domain.com)").optional();
var lud16FormatSchema = z2.string().regex(/^[a-z0-9._-]+@[a-z0-9.-]+\.[a-z]{2,}$/i, "Invalid Lightning address format").optional();
var ProfileUpdateSchema = NostrProfileSchema.extend({
  nip05: nip05FormatSchema,
  lud16: lud16FormatSchema
});
function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}
async function readJsonBody(req, maxBytes = 64 * 1024, timeoutMs = 3e4) {
  const result = await readJsonBodyWithLimit(req, {
    maxBytes,
    timeoutMs,
    emptyObjectOnEmpty: true
  });
  if (result.ok) {
    return result.value;
  }
  if (result.code === "PAYLOAD_TOO_LARGE") {
    throw new Error("Request body too large");
  }
  if (result.code === "REQUEST_BODY_TIMEOUT") {
    throw new Error(requestBodyErrorToText("REQUEST_BODY_TIMEOUT"));
  }
  if (result.code === "CONNECTION_CLOSED") {
    throw new Error(requestBodyErrorToText("CONNECTION_CLOSED"));
  }
  throw new Error(result.code === "INVALID_JSON" ? "Invalid JSON" : result.error);
}
function parseAccountIdFromPath(pathname) {
  const match = pathname.match(/^\/api\/channels\/nostr\/([^/]+)\/profile/);
  return match?.[1] ?? null;
}
function isLoopbackRemoteAddress(remoteAddress) {
  if (!remoteAddress) {
    return false;
  }
  const ipLower = remoteAddress.toLowerCase().replace(/^\[|\]$/g, "");
  if (ipLower === "::1") {
    return true;
  }
  if (ipLower === "127.0.0.1" || ipLower.startsWith("127.")) {
    return true;
  }
  const v4Mapped = ipLower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (v4Mapped) {
    return isLoopbackRemoteAddress(v4Mapped[1]);
  }
  return false;
}
function isLoopbackOriginLike(value) {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
}
function enforceLoopbackMutationGuards(ctx, req, res) {
  const remoteAddress = req.socket.remoteAddress;
  if (!isLoopbackRemoteAddress(remoteAddress)) {
    ctx.log?.warn?.(`Rejected mutation from non-loopback remoteAddress=${String(remoteAddress)}`);
    sendJson(res, 403, { ok: false, error: "Forbidden" });
    return false;
  }
  const origin = req.headers.origin;
  if (typeof origin === "string" && !isLoopbackOriginLike(origin)) {
    ctx.log?.warn?.(`Rejected mutation with non-loopback origin=${origin}`);
    sendJson(res, 403, { ok: false, error: "Forbidden" });
    return false;
  }
  const referer = req.headers.referer ?? req.headers.referrer;
  if (typeof referer === "string" && !isLoopbackOriginLike(referer)) {
    ctx.log?.warn?.(`Rejected mutation with non-loopback referer=${referer}`);
    sendJson(res, 403, { ok: false, error: "Forbidden" });
    return false;
  }
  return true;
}
function createNostrProfileHttpHandler(ctx) {
  return async (req, res) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    if (!url.pathname.startsWith("/api/channels/nostr/")) {
      return false;
    }
    const accountId = parseAccountIdFromPath(url.pathname);
    if (!accountId) {
      return false;
    }
    const isImport = url.pathname.endsWith("/profile/import");
    const isProfilePath = url.pathname.endsWith("/profile") || isImport;
    if (!isProfilePath) {
      return false;
    }
    try {
      if (req.method === "GET" && !isImport) {
        return await handleGetProfile(accountId, ctx, res);
      }
      if (req.method === "PUT" && !isImport) {
        return await handleUpdateProfile(accountId, ctx, req, res);
      }
      if (req.method === "POST" && isImport) {
        return await handleImportProfile(accountId, ctx, req, res);
      }
      sendJson(res, 405, { ok: false, error: "Method not allowed" });
      return true;
    } catch (err) {
      ctx.log?.error(`Profile HTTP error: ${String(err)}`);
      sendJson(res, 500, { ok: false, error: "Internal server error" });
      return true;
    }
  };
}
async function handleGetProfile(accountId, ctx, res) {
  const configProfile = ctx.getConfigProfile(accountId);
  const publishState = await getNostrProfileState(accountId);
  sendJson(res, 200, {
    ok: true,
    profile: configProfile ?? null,
    publishState: publishState ?? null
  });
  return true;
}
async function handleUpdateProfile(accountId, ctx, req, res) {
  if (!enforceLoopbackMutationGuards(ctx, req, res)) {
    return true;
  }
  if (!checkRateLimit(accountId)) {
    sendJson(res, 429, { ok: false, error: "Rate limit exceeded (5 requests/minute)" });
    return true;
  }
  let body;
  try {
    body = await readJsonBody(req);
  } catch (err) {
    sendJson(res, 400, { ok: false, error: String(err) });
    return true;
  }
  const parseResult = ProfileUpdateSchema.safeParse(body);
  if (!parseResult.success) {
    const errors = parseResult.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    sendJson(res, 400, { ok: false, error: "Validation failed", details: errors });
    return true;
  }
  const profile = parseResult.data;
  if (profile.picture) {
    const pictureCheck = validateUrlSafety(profile.picture);
    if (!pictureCheck.ok) {
      sendJson(res, 400, { ok: false, error: `picture: ${pictureCheck.error}` });
      return true;
    }
  }
  if (profile.banner) {
    const bannerCheck = validateUrlSafety(profile.banner);
    if (!bannerCheck.ok) {
      sendJson(res, 400, { ok: false, error: `banner: ${bannerCheck.error}` });
      return true;
    }
  }
  if (profile.website) {
    const websiteCheck = validateUrlSafety(profile.website);
    if (!websiteCheck.ok) {
      sendJson(res, 400, { ok: false, error: `website: ${websiteCheck.error}` });
      return true;
    }
  }
  const existingProfile = ctx.getConfigProfile(accountId) ?? {};
  const mergedProfile = {
    ...existingProfile,
    ...profile
  };
  try {
    const result = await withPublishLock(accountId, async () => {
      return await publishNostrProfile(accountId, mergedProfile);
    });
    if (result.successes.length > 0) {
      await ctx.updateConfigProfile(accountId, mergedProfile);
      ctx.log?.info(`[${accountId}] Profile published to ${result.successes.length} relay(s)`);
    } else {
      ctx.log?.warn(`[${accountId}] Profile publish failed on all relays`);
    }
    sendJson(res, 200, {
      ok: true,
      eventId: result.eventId,
      createdAt: result.createdAt,
      successes: result.successes,
      failures: result.failures,
      persisted: result.successes.length > 0
    });
  } catch (err) {
    ctx.log?.error(`[${accountId}] Profile publish error: ${String(err)}`);
    sendJson(res, 500, { ok: false, error: `Publish failed: ${String(err)}` });
  }
  return true;
}
async function handleImportProfile(accountId, ctx, req, res) {
  if (!enforceLoopbackMutationGuards(ctx, req, res)) {
    return true;
  }
  const accountInfo = ctx.getAccountInfo(accountId);
  if (!accountInfo) {
    sendJson(res, 404, { ok: false, error: `Account not found: ${accountId}` });
    return true;
  }
  const { pubkey, relays } = accountInfo;
  if (!pubkey) {
    sendJson(res, 400, { ok: false, error: "Account has no public key configured" });
    return true;
  }
  let autoMerge = false;
  try {
    const body = await readJsonBody(req);
    if (typeof body === "object" && body !== null) {
      autoMerge = body.autoMerge === true;
    }
  } catch {
  }
  ctx.log?.info(`[${accountId}] Importing profile for ${pubkey.slice(0, 8)}...`);
  const result = await importProfileFromRelays({
    pubkey,
    relays,
    timeoutMs: 1e4
    // 10 seconds for import
  });
  if (!result.ok) {
    sendJson(res, 200, {
      ok: false,
      error: result.error,
      relaysQueried: result.relaysQueried
    });
    return true;
  }
  if (autoMerge && result.profile) {
    const localProfile = ctx.getConfigProfile(accountId);
    const merged = mergeProfiles(localProfile, result.profile);
    await ctx.updateConfigProfile(accountId, merged);
    ctx.log?.info(`[${accountId}] Profile imported and merged`);
    sendJson(res, 200, {
      ok: true,
      imported: result.profile,
      merged,
      saved: true,
      event: result.event,
      sourceRelay: result.sourceRelay,
      relaysQueried: result.relaysQueried
    });
    return true;
  }
  sendJson(res, 200, {
    ok: true,
    imported: result.profile,
    saved: false,
    event: result.event,
    sourceRelay: result.sourceRelay,
    relaysQueried: result.relaysQueried
  });
  return true;
}

// vendor/openclaw-runtime/win-x64/extensions/nostr/index.ts
var plugin = {
  id: "nostr",
  name: "Nostr",
  description: "Nostr DM channel plugin via NIP-04",
  configSchema: emptyPluginConfigSchema(),
  register(api) {
    setNostrRuntime(api.runtime);
    api.registerChannel({ plugin: nostrPlugin });
    const httpHandler = createNostrProfileHttpHandler({
      getConfigProfile: (accountId) => {
        const runtime2 = getNostrRuntime();
        const cfg = runtime2.config.loadConfig();
        const account = resolveNostrAccount({ cfg, accountId });
        return account.profile;
      },
      updateConfigProfile: async (accountId, profile) => {
        const runtime2 = getNostrRuntime();
        const cfg = runtime2.config.loadConfig();
        const channels = cfg.channels ?? {};
        const nostrConfig = channels.nostr ?? {};
        const updatedNostrConfig = {
          ...nostrConfig,
          profile
        };
        const updatedChannels = {
          ...channels,
          nostr: updatedNostrConfig
        };
        await runtime2.config.writeConfigFile({
          ...cfg,
          channels: updatedChannels
        });
      },
      getAccountInfo: (accountId) => {
        const runtime2 = getNostrRuntime();
        const cfg = runtime2.config.loadConfig();
        const account = resolveNostrAccount({ cfg, accountId });
        if (!account.configured || !account.publicKey) {
          return null;
        }
        return {
          pubkey: account.publicKey,
          relays: account.relays
        };
      },
      log: api.logger
    });
    api.registerHttpRoute({
      path: "/api/channels/nostr",
      auth: "gateway",
      match: "prefix",
      handler: httpHandler
    });
  }
};
var nostr_default = plugin;
export {
  nostr_default as default
};
