// vendor/openclaw-runtime/win-x64/extensions/mattermost/index.ts
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";

// vendor/openclaw-runtime/win-x64/extensions/mattermost/src/channel.ts
import {
  applyAccountNameToChannelSection,
  buildChannelConfigSchema,
  DEFAULT_ACCOUNT_ID as DEFAULT_ACCOUNT_ID3,
  deleteAccountFromConfigSection,
  formatPairingApproveHint,
  migrateBaseNameToDefaultAccount,
  normalizeAccountId as normalizeAccountId3,
  resolveAllowlistProviderRuntimeGroupPolicy as resolveAllowlistProviderRuntimeGroupPolicy2,
  resolveDefaultGroupPolicy as resolveDefaultGroupPolicy2,
  setAccountEnabledInConfigSection
} from "openclaw/plugin-sdk";

// vendor/openclaw-runtime/win-x64/extensions/mattermost/src/config-schema.ts
import {
  BlockStreamingCoalesceSchema,
  DmPolicySchema,
  GroupPolicySchema,
  MarkdownConfigSchema,
  requireOpenAllowFrom
} from "openclaw/plugin-sdk";
import { z as z2 } from "zod";

// vendor/openclaw-runtime/win-x64/extensions/mattermost/src/secret-input.ts
import {
  hasConfiguredSecretInput,
  normalizeResolvedSecretInputString,
  normalizeSecretInputString
} from "openclaw/plugin-sdk";
import { z } from "zod";
function buildSecretInputSchema() {
  return z.union([
    z.string(),
    z.object({
      source: z.enum(["env", "file", "exec"]),
      provider: z.string().min(1),
      id: z.string().min(1)
    })
  ]);
}

// vendor/openclaw-runtime/win-x64/extensions/mattermost/src/config-schema.ts
var MattermostAccountSchemaBase = z2.object({
  name: z2.string().optional(),
  capabilities: z2.array(z2.string()).optional(),
  dangerouslyAllowNameMatching: z2.boolean().optional(),
  markdown: MarkdownConfigSchema,
  enabled: z2.boolean().optional(),
  configWrites: z2.boolean().optional(),
  botToken: buildSecretInputSchema().optional(),
  baseUrl: z2.string().optional(),
  chatmode: z2.enum(["oncall", "onmessage", "onchar"]).optional(),
  oncharPrefixes: z2.array(z2.string()).optional(),
  requireMention: z2.boolean().optional(),
  dmPolicy: DmPolicySchema.optional().default("pairing"),
  allowFrom: z2.array(z2.union([z2.string(), z2.number()])).optional(),
  groupAllowFrom: z2.array(z2.union([z2.string(), z2.number()])).optional(),
  groupPolicy: GroupPolicySchema.optional().default("allowlist"),
  textChunkLimit: z2.number().int().positive().optional(),
  chunkMode: z2.enum(["length", "newline"]).optional(),
  blockStreaming: z2.boolean().optional(),
  blockStreamingCoalesce: BlockStreamingCoalesceSchema.optional(),
  responsePrefix: z2.string().optional(),
  actions: z2.object({
    reactions: z2.boolean().optional()
  }).optional()
}).strict();
var MattermostAccountSchema = MattermostAccountSchemaBase.superRefine((value, ctx) => {
  requireOpenAllowFrom({
    policy: value.dmPolicy,
    allowFrom: value.allowFrom,
    ctx,
    path: ["allowFrom"],
    message: 'channels.mattermost.dmPolicy="open" requires channels.mattermost.allowFrom to include "*"'
  });
});
var MattermostConfigSchema = MattermostAccountSchemaBase.extend({
  accounts: z2.record(z2.string(), MattermostAccountSchema.optional()).optional(),
  defaultAccount: z2.string().optional()
}).superRefine((value, ctx) => {
  requireOpenAllowFrom({
    policy: value.dmPolicy,
    allowFrom: value.allowFrom,
    ctx,
    path: ["allowFrom"],
    message: 'channels.mattermost.dmPolicy="open" requires channels.mattermost.allowFrom to include "*"'
  });
});

// vendor/openclaw-runtime/win-x64/extensions/mattermost/src/mattermost/accounts.ts
import {
  DEFAULT_ACCOUNT_ID,
  normalizeAccountId,
  normalizeOptionalAccountId
} from "openclaw/plugin-sdk/account-id";

// vendor/openclaw-runtime/win-x64/extensions/mattermost/src/mattermost/client.ts
function normalizeMattermostBaseUrl(raw) {
  const trimmed = raw?.trim();
  if (!trimmed) {
    return void 0;
  }
  const withoutTrailing = trimmed.replace(/\/+$/, "");
  return withoutTrailing.replace(/\/api\/v4$/i, "");
}
function buildMattermostApiUrl(baseUrl, path) {
  const normalized = normalizeMattermostBaseUrl(baseUrl);
  if (!normalized) {
    throw new Error("Mattermost baseUrl is required");
  }
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${normalized}/api/v4${suffix}`;
}
async function readMattermostError(res) {
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const data = await res.json();
    if (data?.message) {
      return data.message;
    }
    return JSON.stringify(data);
  }
  return await res.text();
}
function createMattermostClient(params) {
  const baseUrl = normalizeMattermostBaseUrl(params.baseUrl);
  if (!baseUrl) {
    throw new Error("Mattermost baseUrl is required");
  }
  const apiBaseUrl = `${baseUrl}/api/v4`;
  const token = params.botToken.trim();
  const fetchImpl = params.fetchImpl ?? fetch;
  const request = async (path, init) => {
    const url = buildMattermostApiUrl(baseUrl, path);
    const headers = new Headers(init?.headers);
    headers.set("Authorization", `Bearer ${token}`);
    if (typeof init?.body === "string" && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    const res = await fetchImpl(url, { ...init, headers });
    if (!res.ok) {
      const detail = await readMattermostError(res);
      throw new Error(
        `Mattermost API ${res.status} ${res.statusText}: ${detail || "unknown error"}`
      );
    }
    if (res.status === 204) {
      return void 0;
    }
    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      return await res.json();
    }
    return await res.text();
  };
  return { baseUrl, apiBaseUrl, token, request };
}
async function fetchMattermostMe(client) {
  return await client.request("/users/me");
}
async function fetchMattermostUser(client, userId) {
  return await client.request(`/users/${userId}`);
}
async function fetchMattermostUserByUsername(client, username) {
  return await client.request(`/users/username/${encodeURIComponent(username)}`);
}
async function fetchMattermostChannel(client, channelId) {
  return await client.request(`/channels/${channelId}`);
}
async function sendMattermostTyping(client, params) {
  const payload = {
    channel_id: params.channelId
  };
  const parentId = params.parentId?.trim();
  if (parentId) {
    payload.parent_id = parentId;
  }
  await client.request("/users/me/typing", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}
async function createMattermostDirectChannel(client, userIds) {
  return await client.request("/channels/direct", {
    method: "POST",
    body: JSON.stringify(userIds)
  });
}
async function createMattermostPost(client, params) {
  const payload = {
    channel_id: params.channelId,
    message: params.message
  };
  if (params.rootId) {
    payload.root_id = params.rootId;
  }
  if (params.fileIds?.length) {
    payload.file_ids = params.fileIds;
  }
  return await client.request("/posts", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}
async function uploadMattermostFile(client, params) {
  const form = new FormData();
  const fileName = params.fileName?.trim() || "upload";
  const bytes = Uint8Array.from(params.buffer);
  const blob = params.contentType ? new Blob([bytes], { type: params.contentType }) : new Blob([bytes]);
  form.append("files", blob, fileName);
  form.append("channel_id", params.channelId);
  const res = await fetch(`${client.apiBaseUrl}/files`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${client.token}`
    },
    body: form
  });
  if (!res.ok) {
    const detail = await readMattermostError(res);
    throw new Error(`Mattermost API ${res.status} ${res.statusText}: ${detail || "unknown error"}`);
  }
  const data = await res.json();
  const info = data.file_infos?.[0];
  if (!info?.id) {
    throw new Error("Mattermost file upload failed");
  }
  return info;
}

// vendor/openclaw-runtime/win-x64/extensions/mattermost/src/mattermost/accounts.ts
function listConfiguredAccountIds(cfg) {
  const accounts = cfg.channels?.mattermost?.accounts;
  if (!accounts || typeof accounts !== "object") {
    return [];
  }
  return Object.keys(accounts).filter(Boolean);
}
function listMattermostAccountIds(cfg) {
  const ids = listConfiguredAccountIds(cfg);
  if (ids.length === 0) {
    return [DEFAULT_ACCOUNT_ID];
  }
  return ids.toSorted((a, b) => a.localeCompare(b));
}
function resolveDefaultMattermostAccountId(cfg) {
  const preferred = normalizeOptionalAccountId(cfg.channels?.mattermost?.defaultAccount);
  if (preferred && listMattermostAccountIds(cfg).some((accountId) => normalizeAccountId(accountId) === preferred)) {
    return preferred;
  }
  const ids = listMattermostAccountIds(cfg);
  if (ids.includes(DEFAULT_ACCOUNT_ID)) {
    return DEFAULT_ACCOUNT_ID;
  }
  return ids[0] ?? DEFAULT_ACCOUNT_ID;
}
function resolveAccountConfig(cfg, accountId) {
  const accounts = cfg.channels?.mattermost?.accounts;
  if (!accounts || typeof accounts !== "object") {
    return void 0;
  }
  return accounts[accountId];
}
function mergeMattermostAccountConfig(cfg, accountId) {
  const {
    accounts: _ignored,
    defaultAccount: _ignoredDefaultAccount,
    ...base
  } = cfg.channels?.mattermost ?? {};
  const account = resolveAccountConfig(cfg, accountId) ?? {};
  return { ...base, ...account };
}
function resolveMattermostRequireMention(config) {
  if (config.chatmode === "oncall") {
    return true;
  }
  if (config.chatmode === "onmessage") {
    return false;
  }
  if (config.chatmode === "onchar") {
    return true;
  }
  return config.requireMention;
}
function resolveMattermostAccount(params) {
  const accountId = normalizeAccountId(params.accountId);
  const baseEnabled = params.cfg.channels?.mattermost?.enabled !== false;
  const merged = mergeMattermostAccountConfig(params.cfg, accountId);
  const accountEnabled = merged.enabled !== false;
  const enabled = baseEnabled && accountEnabled;
  const allowEnv = accountId === DEFAULT_ACCOUNT_ID;
  const envToken = allowEnv ? process.env.MATTERMOST_BOT_TOKEN?.trim() : void 0;
  const envUrl = allowEnv ? process.env.MATTERMOST_URL?.trim() : void 0;
  const configToken = params.allowUnresolvedSecretRef ? normalizeSecretInputString(merged.botToken) : normalizeResolvedSecretInputString({
    value: merged.botToken,
    path: `channels.mattermost.accounts.${accountId}.botToken`
  });
  const configUrl = merged.baseUrl?.trim();
  const botToken = configToken || envToken;
  const baseUrl = normalizeMattermostBaseUrl(configUrl || envUrl);
  const requireMention = resolveMattermostRequireMention(merged);
  const botTokenSource = configToken ? "config" : envToken ? "env" : "none";
  const baseUrlSource = configUrl ? "config" : envUrl ? "env" : "none";
  return {
    accountId,
    enabled,
    name: merged.name?.trim() || void 0,
    botToken,
    baseUrl,
    botTokenSource,
    baseUrlSource,
    config: merged,
    chatmode: merged.chatmode,
    oncharPrefixes: merged.oncharPrefixes,
    requireMention,
    textChunkLimit: merged.textChunkLimit,
    blockStreaming: merged.blockStreaming,
    blockStreamingCoalesce: merged.blockStreamingCoalesce
  };
}

// vendor/openclaw-runtime/win-x64/extensions/mattermost/src/group-mentions.ts
function resolveMattermostGroupRequireMention(params) {
  const account = resolveMattermostAccount({
    cfg: params.cfg,
    accountId: params.accountId
  });
  if (typeof account.requireMention === "boolean") {
    return account.requireMention;
  }
  return true;
}

// vendor/openclaw-runtime/win-x64/extensions/mattermost/src/mattermost/monitor.ts
import {
  buildAgentMediaPayload,
  DM_GROUP_ACCESS_REASON,
  createScopedPairingAccess,
  createReplyPrefixOptions,
  createTypingCallbacks,
  logInboundDrop,
  logTypingFailure,
  buildPendingHistoryContextFromMap,
  clearHistoryEntriesIfEnabled,
  DEFAULT_GROUP_HISTORY_LIMIT,
  recordPendingHistoryEntryIfEnabled,
  isDangerousNameMatchingEnabled,
  resolveControlCommandGate,
  readStoreAllowFromForDmPolicy,
  resolveDmGroupAccessWithLists,
  resolveAllowlistProviderRuntimeGroupPolicy,
  resolveDefaultGroupPolicy,
  resolveChannelMediaMaxBytes,
  warnMissingProviderGroupPolicyFallbackOnce
} from "openclaw/plugin-sdk";

// vendor/openclaw-runtime/win-x64/extensions/mattermost/src/runtime.ts
var runtime = null;
function setMattermostRuntime(next) {
  runtime = next;
}
function getMattermostRuntime() {
  if (!runtime) {
    throw new Error("Mattermost runtime not initialized");
  }
  return runtime;
}

// vendor/openclaw-runtime/win-x64/extensions/mattermost/src/mattermost/monitor-auth.ts
import { resolveAllowlistMatchSimple, resolveEffectiveAllowFromLists } from "openclaw/plugin-sdk";
function normalizeMattermostAllowEntry(entry) {
  const trimmed = entry.trim();
  if (!trimmed) {
    return "";
  }
  if (trimmed === "*") {
    return "*";
  }
  return trimmed.replace(/^(mattermost|user):/i, "").replace(/^@/, "").toLowerCase();
}
function normalizeMattermostAllowList(entries) {
  const normalized = entries.map((entry) => normalizeMattermostAllowEntry(String(entry))).filter(Boolean);
  return Array.from(new Set(normalized));
}
function isMattermostSenderAllowed(params) {
  const allowFrom = normalizeMattermostAllowList(params.allowFrom);
  if (allowFrom.length === 0) {
    return false;
  }
  const match = resolveAllowlistMatchSimple({
    allowFrom,
    senderId: normalizeMattermostAllowEntry(params.senderId),
    senderName: params.senderName ? normalizeMattermostAllowEntry(params.senderName) : void 0,
    allowNameMatching: params.allowNameMatching
  });
  return match.allowed;
}

// vendor/openclaw-runtime/win-x64/extensions/mattermost/src/mattermost/monitor-helpers.ts
import {
  formatInboundFromLabel as formatInboundFromLabelShared,
  resolveThreadSessionKeys as resolveThreadSessionKeysShared
} from "openclaw/plugin-sdk";
import { createDedupeCache, rawDataToString } from "openclaw/plugin-sdk";
var formatInboundFromLabel = formatInboundFromLabelShared;
function resolveThreadSessionKeys(params) {
  return resolveThreadSessionKeysShared({
    ...params,
    normalizeThreadId: (threadId) => threadId
  });
}

// vendor/openclaw-runtime/win-x64/extensions/mattermost/src/mattermost/monitor-onchar.ts
var DEFAULT_ONCHAR_PREFIXES = [">", "!"];
function resolveOncharPrefixes(prefixes) {
  const cleaned = prefixes?.map((entry) => entry.trim()).filter(Boolean) ?? DEFAULT_ONCHAR_PREFIXES;
  return cleaned.length > 0 ? cleaned : DEFAULT_ONCHAR_PREFIXES;
}
function stripOncharPrefix(text, prefixes) {
  const trimmed = text.trimStart();
  for (const prefix of prefixes) {
    if (!prefix) {
      continue;
    }
    if (trimmed.startsWith(prefix)) {
      return {
        triggered: true,
        stripped: trimmed.slice(prefix.length).trimStart()
      };
    }
  }
  return { triggered: false, stripped: text };
}

// vendor/openclaw-runtime/win-x64/extensions/mattermost/src/mattermost/monitor-websocket.ts
import WebSocket from "ws";
var WebSocketClosedBeforeOpenError = class extends Error {
  constructor(code, reason) {
    super(`websocket closed before open (code ${code})`);
    this.code = code;
    this.reason = reason;
    this.name = "WebSocketClosedBeforeOpenError";
  }
};
var defaultMattermostWebSocketFactory = (url) => new WebSocket(url);
function parsePostedPayload(payload) {
  if (payload.event !== "posted") {
    return null;
  }
  const postData = payload.data?.post;
  if (!postData) {
    return null;
  }
  let post = null;
  if (typeof postData === "string") {
    try {
      post = JSON.parse(postData);
    } catch {
      return null;
    }
  } else if (typeof postData === "object") {
    post = postData;
  }
  if (!post) {
    return null;
  }
  return { payload, post };
}
function createMattermostConnectOnce(opts) {
  const webSocketFactory = opts.webSocketFactory ?? defaultMattermostWebSocketFactory;
  return async () => {
    const ws = webSocketFactory(opts.wsUrl);
    const onAbort = () => ws.terminate();
    opts.abortSignal?.addEventListener("abort", onAbort, { once: true });
    try {
      return await new Promise((resolve, reject) => {
        let opened = false;
        let settled = false;
        const resolveOnce = () => {
          if (settled) {
            return;
          }
          settled = true;
          resolve();
        };
        const rejectOnce = (error) => {
          if (settled) {
            return;
          }
          settled = true;
          reject(error);
        };
        ws.on("open", () => {
          opened = true;
          opts.statusSink?.({
            connected: true,
            lastConnectedAt: Date.now(),
            lastError: null
          });
          ws.send(
            JSON.stringify({
              seq: opts.nextSeq(),
              action: "authentication_challenge",
              data: { token: opts.botToken }
            })
          );
        });
        ws.on("message", async (data) => {
          const raw = rawDataToString(data);
          let payload;
          try {
            payload = JSON.parse(raw);
          } catch {
            return;
          }
          if (payload.event === "reaction_added" || payload.event === "reaction_removed") {
            if (!opts.onReaction) {
              return;
            }
            try {
              await opts.onReaction(payload);
            } catch (err) {
              opts.runtime.error?.(`mattermost reaction handler failed: ${String(err)}`);
            }
            return;
          }
          if (payload.event !== "posted") {
            return;
          }
          const parsed = parsePostedPayload(payload);
          if (!parsed) {
            return;
          }
          try {
            await opts.onPosted(parsed.post, parsed.payload);
          } catch (err) {
            opts.runtime.error?.(`mattermost handler failed: ${String(err)}`);
          }
        });
        ws.on("close", (code, reason) => {
          const message = reasonToString(reason);
          opts.statusSink?.({
            connected: false,
            lastDisconnect: {
              at: Date.now(),
              status: code,
              error: message || void 0
            }
          });
          if (opened) {
            resolveOnce();
            return;
          }
          rejectOnce(new WebSocketClosedBeforeOpenError(code, message || void 0));
        });
        ws.on("error", (err) => {
          opts.runtime.error?.(`mattermost websocket error: ${String(err)}`);
          opts.statusSink?.({
            lastError: String(err)
          });
          try {
            ws.close();
          } catch {
          }
        });
      });
    } finally {
      opts.abortSignal?.removeEventListener("abort", onAbort);
    }
  };
}
function reasonToString(reason) {
  if (!reason) {
    return "";
  }
  if (typeof reason === "string") {
    return reason;
  }
  return reason.length > 0 ? reason.toString("utf8") : "";
}

// vendor/openclaw-runtime/win-x64/extensions/mattermost/src/mattermost/reconnect.ts
async function runWithReconnect(connectFn, opts = {}) {
  const { initialDelayMs = 2e3, maxDelayMs = 6e4 } = opts;
  const jitterRatio = Math.max(0, opts.jitterRatio ?? 0);
  const random = opts.random ?? Math.random;
  let retryDelay = initialDelayMs;
  let attempt = 0;
  while (!opts.abortSignal?.aborted) {
    let shouldIncreaseDelay = false;
    let outcome = "resolved";
    let error;
    try {
      await connectFn();
      retryDelay = initialDelayMs;
    } catch (err) {
      if (opts.abortSignal?.aborted) {
        return;
      }
      outcome = "rejected";
      error = err;
      opts.onError?.(err);
      shouldIncreaseDelay = true;
    }
    if (opts.abortSignal?.aborted) {
      return;
    }
    const delayMs = withJitter(retryDelay, jitterRatio, random);
    const shouldReconnect = opts.shouldReconnect?.({
      attempt,
      delayMs,
      outcome,
      error
    }) ?? true;
    if (!shouldReconnect) {
      return;
    }
    opts.onReconnect?.(delayMs);
    await sleepAbortable(delayMs, opts.abortSignal);
    if (shouldIncreaseDelay) {
      retryDelay = Math.min(retryDelay * 2, maxDelayMs);
    }
    attempt++;
  }
}
function withJitter(baseMs, jitterRatio, random) {
  if (jitterRatio <= 0) {
    return baseMs;
  }
  const normalized = Math.max(0, Math.min(1, random()));
  const spread = baseMs * jitterRatio;
  return Math.max(1, Math.round(baseMs - spread + normalized * spread * 2));
}
function sleepAbortable(ms, signal) {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

// vendor/openclaw-runtime/win-x64/extensions/mattermost/src/mattermost/send.ts
import { loadOutboundMediaFromUrl } from "openclaw/plugin-sdk";
var botUserCache = /* @__PURE__ */ new Map();
var userByNameCache = /* @__PURE__ */ new Map();
var getCore = () => getMattermostRuntime();
function cacheKey(baseUrl, token) {
  return `${baseUrl}::${token}`;
}
function normalizeMessage(text, mediaUrl) {
  const trimmed = text.trim();
  const media = mediaUrl?.trim();
  return [trimmed, media].filter(Boolean).join("\n");
}
function isHttpUrl(value) {
  return /^https?:\/\//i.test(value);
}
function parseMattermostTarget(raw) {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("Recipient is required for Mattermost sends");
  }
  const lower = trimmed.toLowerCase();
  if (lower.startsWith("channel:")) {
    const id = trimmed.slice("channel:".length).trim();
    if (!id) {
      throw new Error("Channel id is required for Mattermost sends");
    }
    return { kind: "channel", id };
  }
  if (lower.startsWith("user:")) {
    const id = trimmed.slice("user:".length).trim();
    if (!id) {
      throw new Error("User id is required for Mattermost sends");
    }
    return { kind: "user", id };
  }
  if (lower.startsWith("mattermost:")) {
    const id = trimmed.slice("mattermost:".length).trim();
    if (!id) {
      throw new Error("User id is required for Mattermost sends");
    }
    return { kind: "user", id };
  }
  if (trimmed.startsWith("@")) {
    const username = trimmed.slice(1).trim();
    if (!username) {
      throw new Error("Username is required for Mattermost sends");
    }
    return { kind: "user", username };
  }
  return { kind: "channel", id: trimmed };
}
async function resolveBotUser(baseUrl, token) {
  const key = cacheKey(baseUrl, token);
  const cached = botUserCache.get(key);
  if (cached) {
    return cached;
  }
  const client = createMattermostClient({ baseUrl, botToken: token });
  const user = await fetchMattermostMe(client);
  botUserCache.set(key, user);
  return user;
}
async function resolveUserIdByUsername(params) {
  const { baseUrl, token, username } = params;
  const key = `${cacheKey(baseUrl, token)}::${username.toLowerCase()}`;
  const cached = userByNameCache.get(key);
  if (cached?.id) {
    return cached.id;
  }
  const client = createMattermostClient({ baseUrl, botToken: token });
  const user = await fetchMattermostUserByUsername(client, username);
  userByNameCache.set(key, user);
  return user.id;
}
async function resolveTargetChannelId(params) {
  if (params.target.kind === "channel") {
    return params.target.id;
  }
  const userId = params.target.id ? params.target.id : await resolveUserIdByUsername({
    baseUrl: params.baseUrl,
    token: params.token,
    username: params.target.username ?? ""
  });
  const botUser = await resolveBotUser(params.baseUrl, params.token);
  const client = createMattermostClient({
    baseUrl: params.baseUrl,
    botToken: params.token
  });
  const channel2 = await createMattermostDirectChannel(client, [botUser.id, userId]);
  return channel2.id;
}
async function sendMessageMattermost(to, text, opts = {}) {
  const core = getCore();
  const logger = core.logging.getChildLogger({ module: "mattermost" });
  const cfg = core.config.loadConfig();
  const account = resolveMattermostAccount({
    cfg,
    accountId: opts.accountId
  });
  const token = opts.botToken?.trim() || account.botToken?.trim();
  if (!token) {
    throw new Error(
      `Mattermost bot token missing for account "${account.accountId}" (set channels.mattermost.accounts.${account.accountId}.botToken or MATTERMOST_BOT_TOKEN for default).`
    );
  }
  const baseUrl = normalizeMattermostBaseUrl(opts.baseUrl ?? account.baseUrl);
  if (!baseUrl) {
    throw new Error(
      `Mattermost baseUrl missing for account "${account.accountId}" (set channels.mattermost.accounts.${account.accountId}.baseUrl or MATTERMOST_URL for default).`
    );
  }
  const target = parseMattermostTarget(to);
  const channelId = await resolveTargetChannelId({
    target,
    baseUrl,
    token
  });
  const client = createMattermostClient({ baseUrl, botToken: token });
  let message = text?.trim() ?? "";
  let fileIds;
  let uploadError;
  const mediaUrl = opts.mediaUrl?.trim();
  if (mediaUrl) {
    try {
      const media = await loadOutboundMediaFromUrl(mediaUrl, {
        mediaLocalRoots: opts.mediaLocalRoots
      });
      const fileInfo = await uploadMattermostFile(client, {
        channelId,
        buffer: media.buffer,
        fileName: media.fileName ?? "upload",
        contentType: media.contentType ?? void 0
      });
      fileIds = [fileInfo.id];
    } catch (err) {
      uploadError = err instanceof Error ? err : new Error(String(err));
      if (core.logging.shouldLogVerbose()) {
        logger.debug?.(
          `mattermost send: media upload failed, falling back to URL text: ${String(err)}`
        );
      }
      message = normalizeMessage(message, isHttpUrl(mediaUrl) ? mediaUrl : "");
    }
  }
  if (message) {
    const tableMode = core.channel.text.resolveMarkdownTableMode({
      cfg,
      channel: "mattermost",
      accountId: account.accountId
    });
    message = core.channel.text.convertMarkdownTables(message, tableMode);
  }
  if (!message && (!fileIds || fileIds.length === 0)) {
    if (uploadError) {
      throw new Error(`Mattermost media upload failed: ${uploadError.message}`);
    }
    throw new Error("Mattermost message is empty");
  }
  const post = await createMattermostPost(client, {
    channelId,
    message,
    rootId: opts.replyToId,
    fileIds
  });
  core.channel.activity.record({
    channel: "mattermost",
    accountId: account.accountId,
    direction: "outbound"
  });
  return {
    messageId: post.id ?? "unknown",
    channelId
  };
}

// vendor/openclaw-runtime/win-x64/extensions/mattermost/src/mattermost/monitor.ts
var RECENT_MATTERMOST_MESSAGE_TTL_MS = 5 * 6e4;
var RECENT_MATTERMOST_MESSAGE_MAX = 2e3;
var CHANNEL_CACHE_TTL_MS = 5 * 6e4;
var USER_CACHE_TTL_MS = 10 * 6e4;
var recentInboundMessages = createDedupeCache({
  ttlMs: RECENT_MATTERMOST_MESSAGE_TTL_MS,
  maxSize: RECENT_MATTERMOST_MESSAGE_MAX
});
function resolveRuntime(opts) {
  return opts.runtime ?? {
    log: console.log,
    error: console.error,
    exit: (code) => {
      throw new Error(`exit ${code}`);
    }
  };
}
function normalizeMention(text, mention) {
  if (!mention) {
    return text.trim();
  }
  const escaped = mention.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`@${escaped}\\b`, "gi");
  return text.replace(re, " ").replace(/\s+/g, " ").trim();
}
function isSystemPost(post) {
  const type = post.type?.trim();
  return Boolean(type);
}
function mapMattermostChannelTypeToChatType(channelType) {
  if (!channelType) {
    return "channel";
  }
  const normalized = channelType.trim().toUpperCase();
  if (normalized === "D") {
    return "direct";
  }
  if (normalized === "G") {
    return "group";
  }
  if (normalized === "P") {
    return "group";
  }
  return "channel";
}
function channelChatType(kind) {
  if (kind === "direct") {
    return "direct";
  }
  if (kind === "group") {
    return "group";
  }
  return "channel";
}
function buildMattermostAttachmentPlaceholder(mediaList) {
  if (mediaList.length === 0) {
    return "";
  }
  if (mediaList.length === 1) {
    const kind = mediaList[0].kind === "unknown" ? "document" : mediaList[0].kind;
    return `<media:${kind}>`;
  }
  const allImages = mediaList.every((media) => media.kind === "image");
  const label = allImages ? "image" : "file";
  const suffix = mediaList.length === 1 ? label : `${label}s`;
  const tag = allImages ? "<media:image>" : "<media:document>";
  return `${tag} (${mediaList.length} ${suffix})`;
}
function buildMattermostWsUrl(baseUrl) {
  const normalized = normalizeMattermostBaseUrl(baseUrl);
  if (!normalized) {
    throw new Error("Mattermost baseUrl is required");
  }
  const wsBase = normalized.replace(/^http/i, "ws");
  return `${wsBase}/api/v4/websocket`;
}
async function monitorMattermostProvider(opts = {}) {
  const core = getMattermostRuntime();
  const runtime2 = resolveRuntime(opts);
  const cfg = opts.config ?? core.config.loadConfig();
  const account = resolveMattermostAccount({
    cfg,
    accountId: opts.accountId
  });
  const pairing = createScopedPairingAccess({
    core,
    channel: "mattermost",
    accountId: account.accountId
  });
  const allowNameMatching = isDangerousNameMatchingEnabled(account.config);
  const botToken = opts.botToken?.trim() || account.botToken?.trim();
  if (!botToken) {
    throw new Error(
      `Mattermost bot token missing for account "${account.accountId}" (set channels.mattermost.accounts.${account.accountId}.botToken or MATTERMOST_BOT_TOKEN for default).`
    );
  }
  const baseUrl = normalizeMattermostBaseUrl(opts.baseUrl ?? account.baseUrl);
  if (!baseUrl) {
    throw new Error(
      `Mattermost baseUrl missing for account "${account.accountId}" (set channels.mattermost.accounts.${account.accountId}.baseUrl or MATTERMOST_URL for default).`
    );
  }
  const client = createMattermostClient({ baseUrl, botToken });
  const botUser = await fetchMattermostMe(client);
  const botUserId = botUser.id;
  const botUsername = botUser.username?.trim() || void 0;
  runtime2.log?.(`mattermost connected as ${botUsername ? `@${botUsername}` : botUserId}`);
  const channelCache = /* @__PURE__ */ new Map();
  const userCache = /* @__PURE__ */ new Map();
  const logger = core.logging.getChildLogger({ module: "mattermost" });
  const logVerboseMessage = (message) => {
    if (!core.logging.shouldLogVerbose()) {
      return;
    }
    logger.debug?.(message);
  };
  const mediaMaxBytes = resolveChannelMediaMaxBytes({
    cfg,
    resolveChannelLimitMb: () => void 0,
    accountId: account.accountId
  }) ?? 8 * 1024 * 1024;
  const historyLimit = Math.max(
    0,
    cfg.messages?.groupChat?.historyLimit ?? DEFAULT_GROUP_HISTORY_LIMIT
  );
  const channelHistories = /* @__PURE__ */ new Map();
  const defaultGroupPolicy = resolveDefaultGroupPolicy(cfg);
  const { groupPolicy, providerMissingFallbackApplied } = resolveAllowlistProviderRuntimeGroupPolicy({
    providerConfigPresent: cfg.channels?.mattermost !== void 0,
    groupPolicy: account.config.groupPolicy,
    defaultGroupPolicy
  });
  warnMissingProviderGroupPolicyFallbackOnce({
    providerMissingFallbackApplied,
    providerKey: "mattermost",
    accountId: account.accountId,
    log: (message) => logVerboseMessage(message)
  });
  const resolveMattermostMedia = async (fileIds) => {
    const ids = (fileIds ?? []).map((id) => id?.trim()).filter(Boolean);
    if (ids.length === 0) {
      return [];
    }
    const out = [];
    for (const fileId of ids) {
      try {
        const fetched = await core.channel.media.fetchRemoteMedia({
          url: `${client.apiBaseUrl}/files/${fileId}`,
          requestInit: {
            headers: {
              Authorization: `Bearer ${client.token}`
            }
          },
          filePathHint: fileId,
          maxBytes: mediaMaxBytes
        });
        const saved = await core.channel.media.saveMediaBuffer(
          fetched.buffer,
          fetched.contentType ?? void 0,
          "inbound",
          mediaMaxBytes
        );
        const contentType = saved.contentType ?? fetched.contentType ?? void 0;
        out.push({
          path: saved.path,
          contentType,
          kind: core.media.mediaKindFromMime(contentType)
        });
      } catch (err) {
        logger.debug?.(`mattermost: failed to download file ${fileId}: ${String(err)}`);
      }
    }
    return out;
  };
  const sendTypingIndicator = async (channelId, parentId) => {
    await sendMattermostTyping(client, { channelId, parentId });
  };
  const resolveChannelInfo = async (channelId) => {
    const cached = channelCache.get(channelId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }
    try {
      const info = await fetchMattermostChannel(client, channelId);
      channelCache.set(channelId, {
        value: info,
        expiresAt: Date.now() + CHANNEL_CACHE_TTL_MS
      });
      return info;
    } catch (err) {
      logger.debug?.(`mattermost: channel lookup failed: ${String(err)}`);
      channelCache.set(channelId, {
        value: null,
        expiresAt: Date.now() + CHANNEL_CACHE_TTL_MS
      });
      return null;
    }
  };
  const resolveUserInfo = async (userId) => {
    const cached = userCache.get(userId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }
    try {
      const info = await fetchMattermostUser(client, userId);
      userCache.set(userId, {
        value: info,
        expiresAt: Date.now() + USER_CACHE_TTL_MS
      });
      return info;
    } catch (err) {
      logger.debug?.(`mattermost: user lookup failed: ${String(err)}`);
      userCache.set(userId, {
        value: null,
        expiresAt: Date.now() + USER_CACHE_TTL_MS
      });
      return null;
    }
  };
  const handlePost = async (post, payload, messageIds) => {
    const channelId = post.channel_id ?? payload.data?.channel_id ?? payload.broadcast?.channel_id;
    if (!channelId) {
      return;
    }
    const allMessageIds = messageIds?.length ? messageIds : post.id ? [post.id] : [];
    if (allMessageIds.length === 0) {
      return;
    }
    const dedupeEntries = allMessageIds.map(
      (id) => recentInboundMessages.check(`${account.accountId}:${id}`)
    );
    if (dedupeEntries.length > 0 && dedupeEntries.every(Boolean)) {
      return;
    }
    const senderId = post.user_id ?? payload.broadcast?.user_id;
    if (!senderId) {
      return;
    }
    if (senderId === botUserId) {
      return;
    }
    if (isSystemPost(post)) {
      return;
    }
    const channelInfo = await resolveChannelInfo(channelId);
    const channelType = payload.data?.channel_type ?? channelInfo?.type ?? void 0;
    const kind = mapMattermostChannelTypeToChatType(channelType);
    const chatType = channelChatType(kind);
    const senderName = payload.data?.sender_name?.trim() || (await resolveUserInfo(senderId))?.username?.trim() || senderId;
    const rawText = post.message?.trim() || "";
    const dmPolicy = account.config.dmPolicy ?? "pairing";
    const normalizedAllowFrom = normalizeMattermostAllowList(account.config.allowFrom ?? []);
    const normalizedGroupAllowFrom = normalizeMattermostAllowList(
      account.config.groupAllowFrom ?? []
    );
    const storeAllowFrom = normalizeMattermostAllowList(
      await readStoreAllowFromForDmPolicy({
        provider: "mattermost",
        accountId: account.accountId,
        dmPolicy,
        readStore: pairing.readStoreForDmPolicy
      })
    );
    const accessDecision = resolveDmGroupAccessWithLists({
      isGroup: kind !== "direct",
      dmPolicy,
      groupPolicy,
      allowFrom: normalizedAllowFrom,
      groupAllowFrom: normalizedGroupAllowFrom,
      storeAllowFrom,
      isSenderAllowed: (allowFrom) => isMattermostSenderAllowed({
        senderId,
        senderName,
        allowFrom,
        allowNameMatching
      })
    });
    const effectiveAllowFrom = accessDecision.effectiveAllowFrom;
    const effectiveGroupAllowFrom = accessDecision.effectiveGroupAllowFrom;
    const allowTextCommands = core.channel.commands.shouldHandleTextCommands({
      cfg,
      surface: "mattermost"
    });
    const hasControlCommand = core.channel.text.hasControlCommand(rawText, cfg);
    const isControlCommand = allowTextCommands && hasControlCommand;
    const useAccessGroups = cfg.commands?.useAccessGroups !== false;
    const commandDmAllowFrom = kind === "direct" ? effectiveAllowFrom : normalizedAllowFrom;
    const senderAllowedForCommands = isMattermostSenderAllowed({
      senderId,
      senderName,
      allowFrom: commandDmAllowFrom,
      allowNameMatching
    });
    const groupAllowedForCommands = isMattermostSenderAllowed({
      senderId,
      senderName,
      allowFrom: effectiveGroupAllowFrom,
      allowNameMatching
    });
    const commandGate = resolveControlCommandGate({
      useAccessGroups,
      authorizers: [
        { configured: commandDmAllowFrom.length > 0, allowed: senderAllowedForCommands },
        {
          configured: effectiveGroupAllowFrom.length > 0,
          allowed: groupAllowedForCommands
        }
      ],
      allowTextCommands,
      hasControlCommand
    });
    const commandAuthorized = commandGate.commandAuthorized;
    if (accessDecision.decision !== "allow") {
      if (kind === "direct") {
        if (accessDecision.reasonCode === DM_GROUP_ACCESS_REASON.DM_POLICY_DISABLED) {
          logVerboseMessage(`mattermost: drop dm (dmPolicy=disabled sender=${senderId})`);
          return;
        }
        if (accessDecision.decision === "pairing") {
          const { code, created } = await pairing.upsertPairingRequest({
            id: senderId,
            meta: { name: senderName }
          });
          logVerboseMessage(`mattermost: pairing request sender=${senderId} created=${created}`);
          if (created) {
            try {
              await sendMessageMattermost(
                `user:${senderId}`,
                core.channel.pairing.buildPairingReply({
                  channel: "mattermost",
                  idLine: `Your Mattermost user id: ${senderId}`,
                  code
                }),
                { accountId: account.accountId }
              );
              opts.statusSink?.({ lastOutboundAt: Date.now() });
            } catch (err) {
              logVerboseMessage(`mattermost: pairing reply failed for ${senderId}: ${String(err)}`);
            }
          }
          return;
        }
        logVerboseMessage(`mattermost: drop dm sender=${senderId} (dmPolicy=${dmPolicy})`);
        return;
      }
      if (accessDecision.reasonCode === DM_GROUP_ACCESS_REASON.GROUP_POLICY_DISABLED) {
        logVerboseMessage("mattermost: drop group message (groupPolicy=disabled)");
        return;
      }
      if (accessDecision.reasonCode === DM_GROUP_ACCESS_REASON.GROUP_POLICY_EMPTY_ALLOWLIST) {
        logVerboseMessage("mattermost: drop group message (no group allowlist)");
        return;
      }
      if (accessDecision.reasonCode === DM_GROUP_ACCESS_REASON.GROUP_POLICY_NOT_ALLOWLISTED) {
        logVerboseMessage(`mattermost: drop group sender=${senderId} (not in groupAllowFrom)`);
        return;
      }
      logVerboseMessage(
        `mattermost: drop group message (groupPolicy=${groupPolicy} reason=${accessDecision.reason})`
      );
      return;
    }
    if (kind !== "direct" && commandGate.shouldBlock) {
      logInboundDrop({
        log: logVerboseMessage,
        channel: "mattermost",
        reason: "control command (unauthorized)",
        target: senderId
      });
      return;
    }
    const teamId = payload.data?.team_id ?? channelInfo?.team_id ?? void 0;
    const channelName = payload.data?.channel_name ?? channelInfo?.name ?? "";
    const channelDisplay = payload.data?.channel_display_name ?? channelInfo?.display_name ?? channelName;
    const roomLabel = channelName ? `#${channelName}` : channelDisplay || `#${channelId}`;
    const route = core.channel.routing.resolveAgentRoute({
      cfg,
      channel: "mattermost",
      accountId: account.accountId,
      teamId,
      peer: {
        kind,
        id: kind === "direct" ? senderId : channelId
      }
    });
    const baseSessionKey = route.sessionKey;
    const threadRootId = post.root_id?.trim() || void 0;
    const threadKeys = resolveThreadSessionKeys({
      baseSessionKey,
      threadId: threadRootId,
      parentSessionKey: threadRootId ? baseSessionKey : void 0
    });
    const sessionKey = threadKeys.sessionKey;
    const historyKey = kind === "direct" ? null : sessionKey;
    const mentionRegexes = core.channel.mentions.buildMentionRegexes(cfg, route.agentId);
    const wasMentioned = kind !== "direct" && ((botUsername ? rawText.toLowerCase().includes(`@${botUsername.toLowerCase()}`) : false) || core.channel.mentions.matchesMentionPatterns(rawText, mentionRegexes));
    const pendingBody = rawText || (post.file_ids?.length ? `[Mattermost ${post.file_ids.length === 1 ? "file" : "files"}]` : "");
    const pendingSender = senderName;
    const recordPendingHistory = () => {
      const trimmed = pendingBody.trim();
      recordPendingHistoryEntryIfEnabled({
        historyMap: channelHistories,
        limit: historyLimit,
        historyKey: historyKey ?? "",
        entry: historyKey && trimmed ? {
          sender: pendingSender,
          body: trimmed,
          timestamp: typeof post.create_at === "number" ? post.create_at : void 0,
          messageId: post.id ?? void 0
        } : null
      });
    };
    const oncharEnabled = account.chatmode === "onchar" && kind !== "direct";
    const oncharPrefixes = oncharEnabled ? resolveOncharPrefixes(account.oncharPrefixes) : [];
    const oncharResult = oncharEnabled ? stripOncharPrefix(rawText, oncharPrefixes) : { triggered: false, stripped: rawText };
    const oncharTriggered = oncharResult.triggered;
    const shouldRequireMention = kind !== "direct" && core.channel.groups.resolveRequireMention({
      cfg,
      channel: "mattermost",
      accountId: account.accountId,
      groupId: channelId
    });
    const shouldBypassMention = isControlCommand && shouldRequireMention && !wasMentioned && commandAuthorized;
    const effectiveWasMentioned = wasMentioned || shouldBypassMention || oncharTriggered;
    const canDetectMention = Boolean(botUsername) || mentionRegexes.length > 0;
    if (oncharEnabled && !oncharTriggered && !wasMentioned && !isControlCommand) {
      recordPendingHistory();
      return;
    }
    if (kind !== "direct" && shouldRequireMention && canDetectMention) {
      if (!effectiveWasMentioned) {
        recordPendingHistory();
        return;
      }
    }
    const mediaList = await resolveMattermostMedia(post.file_ids);
    const mediaPlaceholder = buildMattermostAttachmentPlaceholder(mediaList);
    const bodySource = oncharTriggered ? oncharResult.stripped : rawText;
    const baseText = [bodySource, mediaPlaceholder].filter(Boolean).join("\n").trim();
    const bodyText = normalizeMention(baseText, botUsername);
    if (!bodyText) {
      return;
    }
    core.channel.activity.record({
      channel: "mattermost",
      accountId: account.accountId,
      direction: "inbound"
    });
    const fromLabel = formatInboundFromLabel({
      isGroup: kind !== "direct",
      groupLabel: channelDisplay || roomLabel,
      groupId: channelId,
      groupFallback: roomLabel || "Channel",
      directLabel: senderName,
      directId: senderId
    });
    const preview = bodyText.replace(/\s+/g, " ").slice(0, 160);
    const inboundLabel = kind === "direct" ? `Mattermost DM from ${senderName}` : `Mattermost message in ${roomLabel} from ${senderName}`;
    core.system.enqueueSystemEvent(`${inboundLabel}: ${preview}`, {
      sessionKey,
      contextKey: `mattermost:message:${channelId}:${post.id ?? "unknown"}`
    });
    const textWithId = `${bodyText}
[mattermost message id: ${post.id ?? "unknown"} channel: ${channelId}]`;
    const body = core.channel.reply.formatInboundEnvelope({
      channel: "Mattermost",
      from: fromLabel,
      timestamp: typeof post.create_at === "number" ? post.create_at : void 0,
      body: textWithId,
      chatType,
      sender: { name: senderName, id: senderId }
    });
    let combinedBody = body;
    if (historyKey) {
      combinedBody = buildPendingHistoryContextFromMap({
        historyMap: channelHistories,
        historyKey,
        limit: historyLimit,
        currentMessage: combinedBody,
        formatEntry: (entry) => core.channel.reply.formatInboundEnvelope({
          channel: "Mattermost",
          from: fromLabel,
          timestamp: entry.timestamp,
          body: `${entry.body}${entry.messageId ? ` [id:${entry.messageId} channel:${channelId}]` : ""}`,
          chatType,
          senderLabel: entry.sender
        })
      });
    }
    const to = kind === "direct" ? `user:${senderId}` : `channel:${channelId}`;
    const mediaPayload = buildAgentMediaPayload(mediaList);
    const commandBody = rawText.trim();
    const inboundHistory = historyKey && historyLimit > 0 ? (channelHistories.get(historyKey) ?? []).map((entry) => ({
      sender: entry.sender,
      body: entry.body,
      timestamp: entry.timestamp
    })) : void 0;
    const ctxPayload = core.channel.reply.finalizeInboundContext({
      Body: combinedBody,
      BodyForAgent: bodyText,
      InboundHistory: inboundHistory,
      RawBody: bodyText,
      CommandBody: commandBody,
      BodyForCommands: commandBody,
      From: kind === "direct" ? `mattermost:${senderId}` : kind === "group" ? `mattermost:group:${channelId}` : `mattermost:channel:${channelId}`,
      To: to,
      SessionKey: sessionKey,
      ParentSessionKey: threadKeys.parentSessionKey,
      AccountId: route.accountId,
      ChatType: chatType,
      ConversationLabel: fromLabel,
      GroupSubject: kind !== "direct" ? channelDisplay || roomLabel : void 0,
      GroupChannel: channelName ? `#${channelName}` : void 0,
      GroupSpace: teamId,
      SenderName: senderName,
      SenderId: senderId,
      Provider: "mattermost",
      Surface: "mattermost",
      MessageSid: post.id ?? void 0,
      MessageSids: allMessageIds.length > 1 ? allMessageIds : void 0,
      MessageSidFirst: allMessageIds.length > 1 ? allMessageIds[0] : void 0,
      MessageSidLast: allMessageIds.length > 1 ? allMessageIds[allMessageIds.length - 1] : void 0,
      ReplyToId: threadRootId,
      MessageThreadId: threadRootId,
      Timestamp: typeof post.create_at === "number" ? post.create_at : void 0,
      WasMentioned: kind !== "direct" ? effectiveWasMentioned : void 0,
      CommandAuthorized: commandAuthorized,
      OriginatingChannel: "mattermost",
      OriginatingTo: to,
      ...mediaPayload
    });
    if (kind === "direct") {
      const sessionCfg = cfg.session;
      const storePath = core.channel.session.resolveStorePath(sessionCfg?.store, {
        agentId: route.agentId
      });
      await core.channel.session.updateLastRoute({
        storePath,
        sessionKey: route.mainSessionKey,
        deliveryContext: {
          channel: "mattermost",
          to,
          accountId: route.accountId
        }
      });
    }
    const previewLine = bodyText.slice(0, 200).replace(/\n/g, "\\n");
    logVerboseMessage(
      `mattermost inbound: from=${ctxPayload.From} len=${bodyText.length} preview="${previewLine}"`
    );
    const textLimit = core.channel.text.resolveTextChunkLimit(
      cfg,
      "mattermost",
      account.accountId,
      {
        fallbackLimit: account.textChunkLimit ?? 4e3
      }
    );
    const tableMode = core.channel.text.resolveMarkdownTableMode({
      cfg,
      channel: "mattermost",
      accountId: account.accountId
    });
    const { onModelSelected, ...prefixOptions } = createReplyPrefixOptions({
      cfg,
      agentId: route.agentId,
      channel: "mattermost",
      accountId: account.accountId
    });
    const typingCallbacks = createTypingCallbacks({
      start: () => sendTypingIndicator(channelId, threadRootId),
      onStartError: (err) => {
        logTypingFailure({
          log: (message) => logger.debug?.(message),
          channel: "mattermost",
          target: channelId,
          error: err
        });
      }
    });
    const { dispatcher, replyOptions, markDispatchIdle } = core.channel.reply.createReplyDispatcherWithTyping({
      ...prefixOptions,
      humanDelay: core.channel.reply.resolveHumanDelayConfig(cfg, route.agentId),
      typingCallbacks,
      deliver: async (payload2) => {
        const mediaUrls = payload2.mediaUrls ?? (payload2.mediaUrl ? [payload2.mediaUrl] : []);
        const text = core.channel.text.convertMarkdownTables(payload2.text ?? "", tableMode);
        if (mediaUrls.length === 0) {
          const chunkMode = core.channel.text.resolveChunkMode(
            cfg,
            "mattermost",
            account.accountId
          );
          const chunks = core.channel.text.chunkMarkdownTextWithMode(text, textLimit, chunkMode);
          for (const chunk of chunks.length > 0 ? chunks : [text]) {
            if (!chunk) {
              continue;
            }
            await sendMessageMattermost(to, chunk, {
              accountId: account.accountId,
              replyToId: threadRootId
            });
          }
        } else {
          let first = true;
          for (const mediaUrl of mediaUrls) {
            const caption = first ? text : "";
            first = false;
            await sendMessageMattermost(to, caption, {
              accountId: account.accountId,
              mediaUrl,
              replyToId: threadRootId
            });
          }
        }
        runtime2.log?.(`delivered reply to ${to}`);
      },
      onError: (err, info) => {
        runtime2.error?.(`mattermost ${info.kind} reply failed: ${String(err)}`);
      }
    });
    await core.channel.reply.withReplyDispatcher({
      dispatcher,
      onSettled: () => {
        markDispatchIdle();
      },
      run: () => core.channel.reply.dispatchReplyFromConfig({
        ctx: ctxPayload,
        cfg,
        dispatcher,
        replyOptions: {
          ...replyOptions,
          disableBlockStreaming: typeof account.blockStreaming === "boolean" ? !account.blockStreaming : void 0,
          onModelSelected
        }
      })
    });
    if (historyKey) {
      clearHistoryEntriesIfEnabled({
        historyMap: channelHistories,
        historyKey,
        limit: historyLimit
      });
    }
  };
  const handleReactionEvent = async (payload) => {
    const reactionData = payload.data?.reaction;
    if (!reactionData) {
      return;
    }
    let reaction = null;
    if (typeof reactionData === "string") {
      try {
        reaction = JSON.parse(reactionData);
      } catch {
        return;
      }
    } else if (typeof reactionData === "object") {
      reaction = reactionData;
    }
    if (!reaction) {
      return;
    }
    const userId = reaction.user_id?.trim();
    const postId = reaction.post_id?.trim();
    const emojiName = reaction.emoji_name?.trim();
    if (!userId || !postId || !emojiName) {
      return;
    }
    if (userId === botUserId) {
      return;
    }
    const isRemoved = payload.event === "reaction_removed";
    const action = isRemoved ? "removed" : "added";
    const senderInfo = await resolveUserInfo(userId);
    const senderName = senderInfo?.username?.trim() || userId;
    const channelId = payload.broadcast?.channel_id;
    if (!channelId) {
      logVerboseMessage(
        `mattermost: drop reaction (no channel_id in broadcast, cannot enforce policy)`
      );
      return;
    }
    const channelInfo = await resolveChannelInfo(channelId);
    if (!channelInfo?.type) {
      logVerboseMessage(`mattermost: drop reaction (cannot resolve channel type for ${channelId})`);
      return;
    }
    const kind = mapMattermostChannelTypeToChatType(channelInfo.type);
    const dmPolicy = account.config.dmPolicy ?? "pairing";
    const storeAllowFrom = normalizeMattermostAllowList(
      await readStoreAllowFromForDmPolicy({
        provider: "mattermost",
        accountId: account.accountId,
        dmPolicy,
        readStore: pairing.readStoreForDmPolicy
      })
    );
    const reactionAccess = resolveDmGroupAccessWithLists({
      isGroup: kind !== "direct",
      dmPolicy,
      groupPolicy,
      allowFrom: normalizeMattermostAllowList(account.config.allowFrom ?? []),
      groupAllowFrom: normalizeMattermostAllowList(account.config.groupAllowFrom ?? []),
      storeAllowFrom,
      isSenderAllowed: (allowFrom) => isMattermostSenderAllowed({
        senderId: userId,
        senderName,
        allowFrom,
        allowNameMatching
      })
    });
    if (reactionAccess.decision !== "allow") {
      if (kind === "direct") {
        logVerboseMessage(
          `mattermost: drop reaction (dmPolicy=${dmPolicy} sender=${userId} reason=${reactionAccess.reason})`
        );
      } else {
        logVerboseMessage(
          `mattermost: drop reaction (groupPolicy=${groupPolicy} sender=${userId} reason=${reactionAccess.reason} channel=${channelId})`
        );
      }
      return;
    }
    const teamId = channelInfo?.team_id ?? void 0;
    const route = core.channel.routing.resolveAgentRoute({
      cfg,
      channel: "mattermost",
      accountId: account.accountId,
      teamId,
      peer: {
        kind,
        id: kind === "direct" ? userId : channelId
      }
    });
    const sessionKey = route.sessionKey;
    const eventText = `Mattermost reaction ${action}: :${emojiName}: by @${senderName} on post ${postId} in channel ${channelId}`;
    core.system.enqueueSystemEvent(eventText, {
      sessionKey,
      contextKey: `mattermost:reaction:${postId}:${emojiName}:${userId}:${action}`
    });
    logVerboseMessage(
      `mattermost reaction: ${action} :${emojiName}: by ${senderName} on ${postId}`
    );
  };
  const inboundDebounceMs = core.channel.debounce.resolveInboundDebounceMs({
    cfg,
    channel: "mattermost"
  });
  const debouncer = core.channel.debounce.createInboundDebouncer({
    debounceMs: inboundDebounceMs,
    buildKey: (entry) => {
      const channelId = entry.post.channel_id ?? entry.payload.data?.channel_id ?? entry.payload.broadcast?.channel_id;
      if (!channelId) {
        return null;
      }
      const threadId = entry.post.root_id?.trim();
      const threadKey = threadId ? `thread:${threadId}` : "channel";
      return `mattermost:${account.accountId}:${channelId}:${threadKey}`;
    },
    shouldDebounce: (entry) => {
      if (entry.post.file_ids && entry.post.file_ids.length > 0) {
        return false;
      }
      const text = entry.post.message?.trim() ?? "";
      if (!text) {
        return false;
      }
      return !core.channel.text.hasControlCommand(text, cfg);
    },
    onFlush: async (entries) => {
      const last = entries.at(-1);
      if (!last) {
        return;
      }
      if (entries.length === 1) {
        await handlePost(last.post, last.payload);
        return;
      }
      const combinedText = entries.map((entry) => entry.post.message?.trim() ?? "").filter(Boolean).join("\n");
      const mergedPost = {
        ...last.post,
        message: combinedText,
        file_ids: []
      };
      const ids = entries.map((entry) => entry.post.id).filter(Boolean);
      await handlePost(mergedPost, last.payload, ids.length > 0 ? ids : void 0);
    },
    onError: (err) => {
      runtime2.error?.(`mattermost debounce flush failed: ${String(err)}`);
    }
  });
  const wsUrl = buildMattermostWsUrl(baseUrl);
  let seq = 1;
  const connectOnce = createMattermostConnectOnce({
    wsUrl,
    botToken,
    abortSignal: opts.abortSignal,
    statusSink: opts.statusSink,
    runtime: runtime2,
    webSocketFactory: opts.webSocketFactory,
    nextSeq: () => seq++,
    onPosted: async (post, payload) => {
      await debouncer.enqueue({ post, payload });
    },
    onReaction: async (payload) => {
      await handleReactionEvent(payload);
    }
  });
  await runWithReconnect(connectOnce, {
    abortSignal: opts.abortSignal,
    jitterRatio: 0.2,
    onError: (err) => {
      runtime2.error?.(`mattermost connection failed: ${String(err)}`);
      opts.statusSink?.({ lastError: String(err), connected: false });
    },
    onReconnect: (delayMs) => {
      runtime2.log?.(`mattermost reconnecting in ${Math.round(delayMs / 1e3)}s`);
    }
  });
}

// vendor/openclaw-runtime/win-x64/extensions/mattermost/src/mattermost/probe.ts
async function probeMattermost(baseUrl, botToken, timeoutMs = 2500) {
  const normalized = normalizeMattermostBaseUrl(baseUrl);
  if (!normalized) {
    return { ok: false, error: "baseUrl missing" };
  }
  const url = `${normalized}/api/v4/users/me`;
  const start = Date.now();
  const controller = timeoutMs > 0 ? new AbortController() : void 0;
  let timer = null;
  if (controller) {
    timer = setTimeout(() => controller.abort(), timeoutMs);
  }
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${botToken}` },
      signal: controller?.signal
    });
    const elapsedMs = Date.now() - start;
    if (!res.ok) {
      const detail = await readMattermostError(res);
      return {
        ok: false,
        status: res.status,
        error: detail || res.statusText,
        elapsedMs
      };
    }
    const bot = await res.json();
    return {
      ok: true,
      status: res.status,
      elapsedMs,
      bot
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      status: null,
      error: message,
      elapsedMs: Date.now() - start
    };
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

// vendor/openclaw-runtime/win-x64/extensions/mattermost/src/mattermost/reactions.ts
var BOT_USER_CACHE_TTL_MS = 10 * 6e4;
var botUserIdCache = /* @__PURE__ */ new Map();
async function resolveBotUserId(client, cacheKey2) {
  const cached = botUserIdCache.get(cacheKey2);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.userId;
  }
  const me = await fetchMattermostMe(client);
  const userId = me?.id?.trim();
  if (!userId) {
    return null;
  }
  botUserIdCache.set(cacheKey2, { userId, expiresAt: Date.now() + BOT_USER_CACHE_TTL_MS });
  return userId;
}
async function addMattermostReaction(params) {
  return runMattermostReaction(params, {
    action: "add",
    mutation: createReaction
  });
}
async function removeMattermostReaction(params) {
  return runMattermostReaction(params, {
    action: "remove",
    mutation: deleteReaction
  });
}
async function runMattermostReaction(params, options) {
  const resolved = resolveMattermostAccount({ cfg: params.cfg, accountId: params.accountId });
  const baseUrl = resolved.baseUrl?.trim();
  const botToken = resolved.botToken?.trim();
  if (!baseUrl || !botToken) {
    return { ok: false, error: "Mattermost botToken/baseUrl missing." };
  }
  const client = createMattermostClient({
    baseUrl,
    botToken,
    fetchImpl: params.fetchImpl
  });
  const cacheKey2 = `${baseUrl}:${botToken}`;
  const userId = await resolveBotUserId(client, cacheKey2);
  if (!userId) {
    return { ok: false, error: "Mattermost reactions failed: could not resolve bot user id." };
  }
  try {
    await options.mutation(client, {
      userId,
      postId: params.postId,
      emojiName: params.emojiName
    });
  } catch (err) {
    return { ok: false, error: `Mattermost ${options.action} reaction failed: ${String(err)}` };
  }
  return { ok: true };
}
async function createReaction(client, params) {
  await client.request("/reactions", {
    method: "POST",
    body: JSON.stringify({
      user_id: params.userId,
      post_id: params.postId,
      emoji_name: params.emojiName
    })
  });
}
async function deleteReaction(client, params) {
  const emoji = encodeURIComponent(params.emojiName);
  await client.request(
    `/users/${params.userId}/posts/${params.postId}/reactions/${emoji}`,
    {
      method: "DELETE"
    }
  );
}

// vendor/openclaw-runtime/win-x64/extensions/mattermost/src/normalize.ts
function normalizeMattermostMessagingTarget(raw) {
  const trimmed = raw.trim();
  if (!trimmed) {
    return void 0;
  }
  const lower = trimmed.toLowerCase();
  if (lower.startsWith("channel:")) {
    const id = trimmed.slice("channel:".length).trim();
    return id ? `channel:${id}` : void 0;
  }
  if (lower.startsWith("group:")) {
    const id = trimmed.slice("group:".length).trim();
    return id ? `channel:${id}` : void 0;
  }
  if (lower.startsWith("user:")) {
    const id = trimmed.slice("user:".length).trim();
    return id ? `user:${id}` : void 0;
  }
  if (lower.startsWith("mattermost:")) {
    const id = trimmed.slice("mattermost:".length).trim();
    return id ? `user:${id}` : void 0;
  }
  if (trimmed.startsWith("@")) {
    const id = trimmed.slice(1).trim();
    return id ? `@${id}` : void 0;
  }
  if (trimmed.startsWith("#")) {
    const id = trimmed.slice(1).trim();
    return id ? `channel:${id}` : void 0;
  }
  return `channel:${trimmed}`;
}
function looksLikeMattermostTargetId(raw) {
  const trimmed = raw.trim();
  if (!trimmed) {
    return false;
  }
  if (/^(user|channel|group|mattermost):/i.test(trimmed)) {
    return true;
  }
  if (/^[@#]/.test(trimmed)) {
    return true;
  }
  return /^[a-z0-9]{8,}$/i.test(trimmed);
}

// vendor/openclaw-runtime/win-x64/extensions/mattermost/src/onboarding.ts
import {
  hasConfiguredSecretInput as hasConfiguredSecretInput2,
  promptSingleChannelSecretInput
} from "openclaw/plugin-sdk";
import { DEFAULT_ACCOUNT_ID as DEFAULT_ACCOUNT_ID2, normalizeAccountId as normalizeAccountId2 } from "openclaw/plugin-sdk/account-id";

// vendor/openclaw-runtime/win-x64/extensions/mattermost/src/onboarding-helpers.ts
import { promptAccountId } from "openclaw/plugin-sdk";

// vendor/openclaw-runtime/win-x64/extensions/mattermost/src/onboarding.ts
var channel = "mattermost";
async function noteMattermostSetup(prompter) {
  await prompter.note(
    [
      "1) Mattermost System Console -> Integrations -> Bot Accounts",
      "2) Create a bot + copy its token",
      "3) Use your server base URL (e.g., https://chat.example.com)",
      "Tip: the bot must be a member of any channel you want it to monitor.",
      "Docs: https://docs.openclaw.ai/channels/mattermost"
    ].join("\n"),
    "Mattermost bot token"
  );
}
async function promptMattermostBaseUrl(params) {
  const baseUrl = String(
    await params.prompter.text({
      message: "Enter Mattermost base URL",
      initialValue: params.initialValue,
      validate: (value) => value?.trim() ? void 0 : "Required"
    })
  ).trim();
  return baseUrl;
}
var mattermostOnboardingAdapter = {
  channel,
  getStatus: async ({ cfg }) => {
    const configured = listMattermostAccountIds(cfg).some((accountId) => {
      const account = resolveMattermostAccount({
        cfg,
        accountId,
        allowUnresolvedSecretRef: true
      });
      const tokenConfigured = Boolean(account.botToken) || hasConfiguredSecretInput2(account.config.botToken);
      return tokenConfigured && Boolean(account.baseUrl);
    });
    return {
      channel,
      configured,
      statusLines: [`Mattermost: ${configured ? "configured" : "needs token + url"}`],
      selectionHint: configured ? "configured" : "needs setup",
      quickstartScore: configured ? 2 : 1
    };
  },
  configure: async ({ cfg, prompter, accountOverrides, shouldPromptAccountIds }) => {
    const override = accountOverrides.mattermost?.trim();
    const defaultAccountId = resolveDefaultMattermostAccountId(cfg);
    let accountId = override ? normalizeAccountId2(override) : defaultAccountId;
    if (shouldPromptAccountIds && !override) {
      accountId = await promptAccountId({
        cfg,
        prompter,
        label: "Mattermost",
        currentId: accountId,
        listAccountIds: listMattermostAccountIds,
        defaultAccountId
      });
    }
    let next = cfg;
    const resolvedAccount = resolveMattermostAccount({
      cfg: next,
      accountId,
      allowUnresolvedSecretRef: true
    });
    const accountConfigured = Boolean(resolvedAccount.botToken && resolvedAccount.baseUrl);
    const allowEnv = accountId === DEFAULT_ACCOUNT_ID2;
    const canUseEnv = allowEnv && Boolean(process.env.MATTERMOST_BOT_TOKEN?.trim()) && Boolean(process.env.MATTERMOST_URL?.trim());
    const hasConfigToken = hasConfiguredSecretInput2(resolvedAccount.config.botToken);
    const hasConfigValues = hasConfigToken || Boolean(resolvedAccount.config.baseUrl);
    let botToken = null;
    let baseUrl = null;
    if (!accountConfigured) {
      await noteMattermostSetup(prompter);
    }
    const botTokenResult = await promptSingleChannelSecretInput({
      cfg: next,
      prompter,
      providerHint: "mattermost",
      credentialLabel: "bot token",
      accountConfigured,
      canUseEnv: canUseEnv && !hasConfigValues,
      hasConfigToken,
      envPrompt: "MATTERMOST_BOT_TOKEN + MATTERMOST_URL detected. Use env vars?",
      keepPrompt: "Mattermost bot token already configured. Keep it?",
      inputPrompt: "Enter Mattermost bot token",
      preferredEnvVar: "MATTERMOST_BOT_TOKEN"
    });
    if (botTokenResult.action === "keep") {
      return { cfg: next, accountId };
    }
    if (botTokenResult.action === "use-env") {
      if (accountId === DEFAULT_ACCOUNT_ID2) {
        next = {
          ...next,
          channels: {
            ...next.channels,
            mattermost: {
              ...next.channels?.mattermost,
              enabled: true
            }
          }
        };
      }
      return { cfg: next, accountId };
    }
    botToken = botTokenResult.value;
    baseUrl = await promptMattermostBaseUrl({
      prompter,
      initialValue: resolvedAccount.baseUrl ?? process.env.MATTERMOST_URL?.trim()
    });
    if (accountId === DEFAULT_ACCOUNT_ID2) {
      next = {
        ...next,
        channels: {
          ...next.channels,
          mattermost: {
            ...next.channels?.mattermost,
            enabled: true,
            botToken,
            baseUrl
          }
        }
      };
    } else {
      next = {
        ...next,
        channels: {
          ...next.channels,
          mattermost: {
            ...next.channels?.mattermost,
            enabled: true,
            accounts: {
              ...next.channels?.mattermost?.accounts,
              [accountId]: {
                ...next.channels?.mattermost?.accounts?.[accountId],
                enabled: next.channels?.mattermost?.accounts?.[accountId]?.enabled ?? true,
                botToken,
                baseUrl
              }
            }
          }
        }
      };
    }
    return { cfg: next, accountId };
  },
  disable: (cfg) => ({
    ...cfg,
    channels: {
      ...cfg.channels,
      mattermost: { ...cfg.channels?.mattermost, enabled: false }
    }
  })
};

// vendor/openclaw-runtime/win-x64/extensions/mattermost/src/channel.ts
var mattermostMessageActions = {
  listActions: ({ cfg }) => {
    const actionsConfig = cfg.channels?.mattermost?.actions;
    const baseReactions = actionsConfig?.reactions;
    const hasReactionCapableAccount = listMattermostAccountIds(cfg).map((accountId) => resolveMattermostAccount({ cfg, accountId })).filter((account) => account.enabled).filter((account) => Boolean(account.botToken?.trim() && account.baseUrl?.trim())).some((account) => {
      const accountActions = account.config.actions;
      return (accountActions?.reactions ?? baseReactions ?? true) !== false;
    });
    if (!hasReactionCapableAccount) {
      return [];
    }
    return ["react"];
  },
  supportsAction: ({ action }) => {
    return action === "react";
  },
  handleAction: async ({ action, params, cfg, accountId }) => {
    if (action !== "react") {
      throw new Error(`Mattermost action ${action} not supported`);
    }
    const mmBase = cfg?.channels?.mattermost;
    const accounts = mmBase?.accounts;
    const resolvedAccountId = accountId ?? resolveDefaultMattermostAccountId(cfg);
    const acctConfig = accounts?.[resolvedAccountId];
    const acctActions = acctConfig?.actions;
    const baseActions = mmBase?.actions;
    const reactionsEnabled = acctActions?.reactions ?? baseActions?.reactions ?? true;
    if (!reactionsEnabled) {
      throw new Error("Mattermost reactions are disabled in config");
    }
    const postIdRaw = typeof params?.messageId === "string" ? params.messageId : typeof params?.postId === "string" ? params.postId : "";
    const postId = postIdRaw.trim();
    if (!postId) {
      throw new Error("Mattermost react requires messageId (post id)");
    }
    const emojiRaw = typeof params?.emoji === "string" ? params.emoji : "";
    const emojiName = emojiRaw.trim().replace(/^:+|:+$/g, "");
    if (!emojiName) {
      throw new Error("Mattermost react requires emoji");
    }
    const remove = params?.remove === true;
    if (remove) {
      const result2 = await removeMattermostReaction({
        cfg,
        postId,
        emojiName,
        accountId: resolvedAccountId
      });
      if (!result2.ok) {
        throw new Error(result2.error);
      }
      return {
        content: [
          { type: "text", text: `Removed reaction :${emojiName}: from ${postId}` }
        ],
        details: {}
      };
    }
    const result = await addMattermostReaction({
      cfg,
      postId,
      emojiName,
      accountId: resolvedAccountId
    });
    if (!result.ok) {
      throw new Error(result.error);
    }
    return {
      content: [{ type: "text", text: `Reacted with :${emojiName}: on ${postId}` }],
      details: {}
    };
  }
};
var meta = {
  id: "mattermost",
  label: "Mattermost",
  selectionLabel: "Mattermost (plugin)",
  detailLabel: "Mattermost Bot",
  docsPath: "/channels/mattermost",
  docsLabel: "mattermost",
  blurb: "self-hosted Slack-style chat; install the plugin to enable.",
  systemImage: "bubble.left.and.bubble.right",
  order: 65,
  quickstartAllowFrom: true
};
function normalizeAllowEntry(entry) {
  return entry.trim().replace(/^(mattermost|user):/i, "").replace(/^@/, "").toLowerCase();
}
function formatAllowEntry(entry) {
  const trimmed = entry.trim();
  if (!trimmed) {
    return "";
  }
  if (trimmed.startsWith("@")) {
    const username = trimmed.slice(1).trim();
    return username ? `@${username.toLowerCase()}` : "";
  }
  return trimmed.replace(/^(mattermost|user):/i, "").toLowerCase();
}
var mattermostPlugin = {
  id: "mattermost",
  meta: {
    ...meta
  },
  onboarding: mattermostOnboardingAdapter,
  pairing: {
    idLabel: "mattermostUserId",
    normalizeAllowEntry: (entry) => normalizeAllowEntry(entry),
    notifyApproval: async ({ id }) => {
      console.log(`[mattermost] User ${id} approved for pairing`);
    }
  },
  capabilities: {
    chatTypes: ["direct", "channel", "group", "thread"],
    reactions: true,
    threads: true,
    media: true
  },
  streaming: {
    blockStreamingCoalesceDefaults: { minChars: 1500, idleMs: 1e3 }
  },
  reload: { configPrefixes: ["channels.mattermost"] },
  configSchema: buildChannelConfigSchema(MattermostConfigSchema),
  config: {
    listAccountIds: (cfg) => listMattermostAccountIds(cfg),
    resolveAccount: (cfg, accountId) => resolveMattermostAccount({ cfg, accountId }),
    defaultAccountId: (cfg) => resolveDefaultMattermostAccountId(cfg),
    setAccountEnabled: ({ cfg, accountId, enabled }) => setAccountEnabledInConfigSection({
      cfg,
      sectionKey: "mattermost",
      accountId,
      enabled,
      allowTopLevel: true
    }),
    deleteAccount: ({ cfg, accountId }) => deleteAccountFromConfigSection({
      cfg,
      sectionKey: "mattermost",
      accountId,
      clearBaseFields: ["botToken", "baseUrl", "name"]
    }),
    isConfigured: (account) => Boolean(account.botToken && account.baseUrl),
    describeAccount: (account) => ({
      accountId: account.accountId,
      name: account.name,
      enabled: account.enabled,
      configured: Boolean(account.botToken && account.baseUrl),
      botTokenSource: account.botTokenSource,
      baseUrl: account.baseUrl
    }),
    resolveAllowFrom: ({ cfg, accountId }) => (resolveMattermostAccount({ cfg, accountId }).config.allowFrom ?? []).map(
      (entry) => String(entry)
    ),
    formatAllowFrom: ({ allowFrom }) => allowFrom.map((entry) => formatAllowEntry(String(entry))).filter(Boolean)
  },
  security: {
    resolveDmPolicy: ({ cfg, accountId, account }) => {
      const resolvedAccountId = accountId ?? account.accountId ?? DEFAULT_ACCOUNT_ID3;
      const useAccountPath = Boolean(cfg.channels?.mattermost?.accounts?.[resolvedAccountId]);
      const basePath = useAccountPath ? `channels.mattermost.accounts.${resolvedAccountId}.` : "channels.mattermost.";
      return {
        policy: account.config.dmPolicy ?? "pairing",
        allowFrom: account.config.allowFrom ?? [],
        policyPath: `${basePath}dmPolicy`,
        allowFromPath: basePath,
        approveHint: formatPairingApproveHint("mattermost"),
        normalizeEntry: (raw) => normalizeAllowEntry(raw)
      };
    },
    collectWarnings: ({ account, cfg }) => {
      const defaultGroupPolicy = resolveDefaultGroupPolicy2(cfg);
      const { groupPolicy } = resolveAllowlistProviderRuntimeGroupPolicy2({
        providerConfigPresent: cfg.channels?.mattermost !== void 0,
        groupPolicy: account.config.groupPolicy,
        defaultGroupPolicy
      });
      if (groupPolicy !== "open") {
        return [];
      }
      return [
        `- Mattermost channels: groupPolicy="open" allows any member to trigger (mention-gated). Set channels.mattermost.groupPolicy="allowlist" + channels.mattermost.groupAllowFrom to restrict senders.`
      ];
    }
  },
  groups: {
    resolveRequireMention: resolveMattermostGroupRequireMention
  },
  actions: mattermostMessageActions,
  messaging: {
    normalizeTarget: normalizeMattermostMessagingTarget,
    targetResolver: {
      looksLikeId: looksLikeMattermostTargetId,
      hint: "<channelId|user:ID|channel:ID>"
    }
  },
  outbound: {
    deliveryMode: "direct",
    chunker: (text, limit) => getMattermostRuntime().channel.text.chunkMarkdownText(text, limit),
    chunkerMode: "markdown",
    textChunkLimit: 4e3,
    resolveTarget: ({ to }) => {
      const trimmed = to?.trim();
      if (!trimmed) {
        return {
          ok: false,
          error: new Error(
            "Delivering to Mattermost requires --to <channelId|@username|user:ID|channel:ID>"
          )
        };
      }
      return { ok: true, to: trimmed };
    },
    sendText: async ({ to, text, accountId, replyToId }) => {
      const result = await sendMessageMattermost(to, text, {
        accountId: accountId ?? void 0,
        replyToId: replyToId ?? void 0
      });
      return { channel: "mattermost", ...result };
    },
    sendMedia: async ({ to, text, mediaUrl, mediaLocalRoots, accountId, replyToId }) => {
      const result = await sendMessageMattermost(to, text, {
        accountId: accountId ?? void 0,
        mediaUrl,
        mediaLocalRoots,
        replyToId: replyToId ?? void 0
      });
      return { channel: "mattermost", ...result };
    }
  },
  status: {
    defaultRuntime: {
      accountId: DEFAULT_ACCOUNT_ID3,
      running: false,
      connected: false,
      lastConnectedAt: null,
      lastDisconnect: null,
      lastStartAt: null,
      lastStopAt: null,
      lastError: null
    },
    buildChannelSummary: ({ snapshot }) => ({
      configured: snapshot.configured ?? false,
      botTokenSource: snapshot.botTokenSource ?? "none",
      running: snapshot.running ?? false,
      connected: snapshot.connected ?? false,
      lastStartAt: snapshot.lastStartAt ?? null,
      lastStopAt: snapshot.lastStopAt ?? null,
      lastError: snapshot.lastError ?? null,
      baseUrl: snapshot.baseUrl ?? null,
      probe: snapshot.probe,
      lastProbeAt: snapshot.lastProbeAt ?? null
    }),
    probeAccount: async ({ account, timeoutMs }) => {
      const token = account.botToken?.trim();
      const baseUrl = account.baseUrl?.trim();
      if (!token || !baseUrl) {
        return { ok: false, error: "bot token or baseUrl missing" };
      }
      return await probeMattermost(baseUrl, token, timeoutMs);
    },
    buildAccountSnapshot: ({ account, runtime: runtime2, probe }) => ({
      accountId: account.accountId,
      name: account.name,
      enabled: account.enabled,
      configured: Boolean(account.botToken && account.baseUrl),
      botTokenSource: account.botTokenSource,
      baseUrl: account.baseUrl,
      running: runtime2?.running ?? false,
      connected: runtime2?.connected ?? false,
      lastConnectedAt: runtime2?.lastConnectedAt ?? null,
      lastDisconnect: runtime2?.lastDisconnect ?? null,
      lastStartAt: runtime2?.lastStartAt ?? null,
      lastStopAt: runtime2?.lastStopAt ?? null,
      lastError: runtime2?.lastError ?? null,
      probe,
      lastInboundAt: runtime2?.lastInboundAt ?? null,
      lastOutboundAt: runtime2?.lastOutboundAt ?? null
    })
  },
  setup: {
    resolveAccountId: ({ accountId }) => normalizeAccountId3(accountId),
    applyAccountName: ({ cfg, accountId, name }) => applyAccountNameToChannelSection({
      cfg,
      channelKey: "mattermost",
      accountId,
      name
    }),
    validateInput: ({ accountId, input }) => {
      if (input.useEnv && accountId !== DEFAULT_ACCOUNT_ID3) {
        return "Mattermost env vars can only be used for the default account.";
      }
      const token = input.botToken ?? input.token;
      const baseUrl = input.httpUrl;
      if (!input.useEnv && (!token || !baseUrl)) {
        return "Mattermost requires --bot-token and --http-url (or --use-env).";
      }
      if (baseUrl && !normalizeMattermostBaseUrl(baseUrl)) {
        return "Mattermost --http-url must include a valid base URL.";
      }
      return null;
    },
    applyAccountConfig: ({ cfg, accountId, input }) => {
      const token = input.botToken ?? input.token;
      const baseUrl = input.httpUrl?.trim();
      const namedConfig = applyAccountNameToChannelSection({
        cfg,
        channelKey: "mattermost",
        accountId,
        name: input.name
      });
      const next = accountId !== DEFAULT_ACCOUNT_ID3 ? migrateBaseNameToDefaultAccount({
        cfg: namedConfig,
        channelKey: "mattermost"
      }) : namedConfig;
      if (accountId === DEFAULT_ACCOUNT_ID3) {
        return {
          ...next,
          channels: {
            ...next.channels,
            mattermost: {
              ...next.channels?.mattermost,
              enabled: true,
              ...input.useEnv ? {} : {
                ...token ? { botToken: token } : {},
                ...baseUrl ? { baseUrl } : {}
              }
            }
          }
        };
      }
      return {
        ...next,
        channels: {
          ...next.channels,
          mattermost: {
            ...next.channels?.mattermost,
            enabled: true,
            accounts: {
              ...next.channels?.mattermost?.accounts,
              [accountId]: {
                ...next.channels?.mattermost?.accounts?.[accountId],
                enabled: true,
                ...token ? { botToken: token } : {},
                ...baseUrl ? { baseUrl } : {}
              }
            }
          }
        }
      };
    }
  },
  gateway: {
    startAccount: async (ctx) => {
      const account = ctx.account;
      ctx.setStatus({
        accountId: account.accountId,
        baseUrl: account.baseUrl,
        botTokenSource: account.botTokenSource
      });
      ctx.log?.info(`[${account.accountId}] starting channel`);
      return monitorMattermostProvider({
        botToken: account.botToken ?? void 0,
        baseUrl: account.baseUrl ?? void 0,
        accountId: account.accountId,
        config: ctx.cfg,
        runtime: ctx.runtime,
        abortSignal: ctx.abortSignal,
        statusSink: (patch) => ctx.setStatus({ accountId: ctx.accountId, ...patch })
      });
    }
  }
};

// vendor/openclaw-runtime/win-x64/extensions/mattermost/index.ts
var plugin = {
  id: "mattermost",
  name: "Mattermost",
  description: "Mattermost channel plugin",
  configSchema: emptyPluginConfigSchema(),
  register(api) {
    setMattermostRuntime(api.runtime);
    api.registerChannel({ plugin: mattermostPlugin });
  }
};
var mattermost_default = plugin;
export {
  mattermost_default as default
};
