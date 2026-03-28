// vendor/openclaw-runtime/win-x64/extensions/nextcloud-talk/index.ts
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";

// vendor/openclaw-runtime/win-x64/extensions/nextcloud-talk/src/channel.ts
import {
  applyAccountNameToChannelSection,
  buildChannelConfigSchema,
  DEFAULT_ACCOUNT_ID as DEFAULT_ACCOUNT_ID3,
  deleteAccountFromConfigSection,
  formatPairingApproveHint,
  normalizeAccountId as normalizeAccountId3,
  resolveAllowlistProviderRuntimeGroupPolicy as resolveAllowlistProviderRuntimeGroupPolicy2,
  resolveDefaultGroupPolicy as resolveDefaultGroupPolicy2,
  setAccountEnabledInConfigSection
} from "openclaw/plugin-sdk";
import { waitForAbortSignal } from "../../../src/infra/abort-signal.js";

// vendor/openclaw-runtime/win-x64/extensions/nextcloud-talk/src/accounts.ts
import { readFileSync } from "fs";
import {
  listConfiguredAccountIds as listConfiguredAccountIdsFromSection,
  resolveAccountWithDefaultFallback
} from "openclaw/plugin-sdk";
import {
  DEFAULT_ACCOUNT_ID,
  normalizeAccountId,
  normalizeOptionalAccountId
} from "openclaw/plugin-sdk/account-id";

// vendor/openclaw-runtime/win-x64/extensions/nextcloud-talk/src/secret-input.ts
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

// vendor/openclaw-runtime/win-x64/extensions/nextcloud-talk/src/accounts.ts
function isTruthyEnvValue(value) {
  const normalized = (value ?? "").trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on";
}
var debugAccounts = (...args) => {
  if (isTruthyEnvValue(process.env.OPENCLAW_DEBUG_NEXTCLOUD_TALK_ACCOUNTS)) {
    console.warn("[nextcloud-talk:accounts]", ...args);
  }
};
function listConfiguredAccountIds(cfg) {
  return listConfiguredAccountIdsFromSection({
    accounts: cfg.channels?.["nextcloud-talk"]?.accounts,
    normalizeAccountId
  });
}
function listNextcloudTalkAccountIds(cfg) {
  const ids = listConfiguredAccountIds(cfg);
  debugAccounts("listNextcloudTalkAccountIds", ids);
  if (ids.length === 0) {
    return [DEFAULT_ACCOUNT_ID];
  }
  return ids.toSorted((a, b) => a.localeCompare(b));
}
function resolveDefaultNextcloudTalkAccountId(cfg) {
  const preferred = normalizeOptionalAccountId(cfg.channels?.["nextcloud-talk"]?.defaultAccount);
  if (preferred && listNextcloudTalkAccountIds(cfg).some(
    (accountId) => normalizeAccountId(accountId) === preferred
  )) {
    return preferred;
  }
  const ids = listNextcloudTalkAccountIds(cfg);
  if (ids.includes(DEFAULT_ACCOUNT_ID)) {
    return DEFAULT_ACCOUNT_ID;
  }
  return ids[0] ?? DEFAULT_ACCOUNT_ID;
}
function resolveAccountConfig(cfg, accountId) {
  const accounts = cfg.channels?.["nextcloud-talk"]?.accounts;
  if (!accounts || typeof accounts !== "object") {
    return void 0;
  }
  const direct = accounts[accountId];
  if (direct) {
    return direct;
  }
  const normalized = normalizeAccountId(accountId);
  const matchKey = Object.keys(accounts).find((key) => normalizeAccountId(key) === normalized);
  return matchKey ? accounts[matchKey] : void 0;
}
function mergeNextcloudTalkAccountConfig(cfg, accountId) {
  const {
    accounts: _ignored,
    defaultAccount: _ignoredDefaultAccount,
    ...base
  } = cfg.channels?.["nextcloud-talk"] ?? {};
  const account = resolveAccountConfig(cfg, accountId) ?? {};
  return { ...base, ...account };
}
function resolveNextcloudTalkSecret(cfg, opts) {
  const merged = mergeNextcloudTalkAccountConfig(cfg, opts.accountId ?? DEFAULT_ACCOUNT_ID);
  const envSecret = process.env.NEXTCLOUD_TALK_BOT_SECRET?.trim();
  if (envSecret && (!opts.accountId || opts.accountId === DEFAULT_ACCOUNT_ID)) {
    return { secret: envSecret, source: "env" };
  }
  if (merged.botSecretFile) {
    try {
      const fileSecret = readFileSync(merged.botSecretFile, "utf-8").trim();
      if (fileSecret) {
        return { secret: fileSecret, source: "secretFile" };
      }
    } catch {
    }
  }
  const inlineSecret = normalizeResolvedSecretInputString({
    value: merged.botSecret,
    path: `channels.nextcloud-talk.accounts.${opts.accountId ?? DEFAULT_ACCOUNT_ID}.botSecret`
  });
  if (inlineSecret) {
    return { secret: inlineSecret, source: "config" };
  }
  return { secret: "", source: "none" };
}
function resolveNextcloudTalkAccount(params) {
  const baseEnabled = params.cfg.channels?.["nextcloud-talk"]?.enabled !== false;
  const resolve = (accountId) => {
    const merged = mergeNextcloudTalkAccountConfig(params.cfg, accountId);
    const accountEnabled = merged.enabled !== false;
    const enabled = baseEnabled && accountEnabled;
    const secretResolution = resolveNextcloudTalkSecret(params.cfg, { accountId });
    const baseUrl = merged.baseUrl?.trim()?.replace(/\/$/, "") ?? "";
    debugAccounts("resolve", {
      accountId,
      enabled,
      secretSource: secretResolution.source,
      baseUrl: baseUrl ? "[set]" : "[missing]"
    });
    return {
      accountId,
      enabled,
      name: merged.name?.trim() || void 0,
      baseUrl,
      secret: secretResolution.secret,
      secretSource: secretResolution.source,
      config: merged
    };
  };
  return resolveAccountWithDefaultFallback({
    accountId: params.accountId,
    normalizeAccountId,
    resolvePrimary: resolve,
    hasCredential: (account) => account.secretSource !== "none",
    resolveDefaultAccountId: () => resolveDefaultNextcloudTalkAccountId(params.cfg)
  });
}

// vendor/openclaw-runtime/win-x64/extensions/nextcloud-talk/src/config-schema.ts
import {
  DmPolicySchema,
  GroupPolicySchema,
  MarkdownConfigSchema,
  ReplyRuntimeConfigSchemaShape,
  ToolPolicySchema,
  requireOpenAllowFrom
} from "openclaw/plugin-sdk";
import { z as z2 } from "zod";
var NextcloudTalkRoomSchema = z2.object({
  requireMention: z2.boolean().optional(),
  tools: ToolPolicySchema,
  skills: z2.array(z2.string()).optional(),
  enabled: z2.boolean().optional(),
  allowFrom: z2.array(z2.string()).optional(),
  systemPrompt: z2.string().optional()
}).strict();
var NextcloudTalkAccountSchemaBase = z2.object({
  name: z2.string().optional(),
  enabled: z2.boolean().optional(),
  markdown: MarkdownConfigSchema,
  baseUrl: z2.string().optional(),
  botSecret: buildSecretInputSchema().optional(),
  botSecretFile: z2.string().optional(),
  apiUser: z2.string().optional(),
  apiPassword: buildSecretInputSchema().optional(),
  apiPasswordFile: z2.string().optional(),
  dmPolicy: DmPolicySchema.optional().default("pairing"),
  webhookPort: z2.number().int().positive().optional(),
  webhookHost: z2.string().optional(),
  webhookPath: z2.string().optional(),
  webhookPublicUrl: z2.string().optional(),
  allowFrom: z2.array(z2.string()).optional(),
  groupAllowFrom: z2.array(z2.string()).optional(),
  groupPolicy: GroupPolicySchema.optional().default("allowlist"),
  rooms: z2.record(z2.string(), NextcloudTalkRoomSchema.optional()).optional(),
  ...ReplyRuntimeConfigSchemaShape
}).strict();
var NextcloudTalkAccountSchema = NextcloudTalkAccountSchemaBase.superRefine(
  (value, ctx) => {
    requireOpenAllowFrom({
      policy: value.dmPolicy,
      allowFrom: value.allowFrom,
      ctx,
      path: ["allowFrom"],
      message: 'channels.nextcloud-talk.dmPolicy="open" requires channels.nextcloud-talk.allowFrom to include "*"'
    });
  }
);
var NextcloudTalkConfigSchema = NextcloudTalkAccountSchemaBase.extend({
  accounts: z2.record(z2.string(), NextcloudTalkAccountSchema.optional()).optional(),
  defaultAccount: z2.string().optional()
}).superRefine((value, ctx) => {
  requireOpenAllowFrom({
    policy: value.dmPolicy,
    allowFrom: value.allowFrom,
    ctx,
    path: ["allowFrom"],
    message: 'channels.nextcloud-talk.dmPolicy="open" requires channels.nextcloud-talk.allowFrom to include "*"'
  });
});

// vendor/openclaw-runtime/win-x64/extensions/nextcloud-talk/src/monitor.ts
import { createServer } from "http";
import os from "os";
import {
  createLoggerBackedRuntime,
  isRequestBodyLimitError,
  readRequestBodyWithLimit,
  requestBodyErrorToText
} from "openclaw/plugin-sdk";

// vendor/openclaw-runtime/win-x64/extensions/nextcloud-talk/src/inbound.ts
import {
  GROUP_POLICY_BLOCKED_LABEL,
  createScopedPairingAccess,
  createNormalizedOutboundDeliverer,
  createReplyPrefixOptions,
  formatTextWithAttachmentLinks,
  logInboundDrop,
  readStoreAllowFromForDmPolicy,
  resolveDmGroupAccessWithCommandGate,
  resolveOutboundMediaUrls,
  resolveAllowlistProviderRuntimeGroupPolicy,
  resolveDefaultGroupPolicy,
  warnMissingProviderGroupPolicyFallbackOnce
} from "openclaw/plugin-sdk";

// vendor/openclaw-runtime/win-x64/extensions/nextcloud-talk/src/policy.ts
import {
  buildChannelKeyCandidates,
  normalizeChannelSlug,
  resolveChannelEntryMatchWithFallback,
  resolveMentionGatingWithBypass,
  resolveNestedAllowlistDecision
} from "openclaw/plugin-sdk";
function normalizeAllowEntry(raw) {
  return raw.trim().toLowerCase().replace(/^(nextcloud-talk|nc-talk|nc):/i, "");
}
function normalizeNextcloudTalkAllowlist(values) {
  return (values ?? []).map((value) => normalizeAllowEntry(String(value))).filter(Boolean);
}
function resolveNextcloudTalkAllowlistMatch(params) {
  const allowFrom = normalizeNextcloudTalkAllowlist(params.allowFrom);
  if (allowFrom.length === 0) {
    return { allowed: false };
  }
  if (allowFrom.includes("*")) {
    return { allowed: true, matchKey: "*", matchSource: "wildcard" };
  }
  const senderId = normalizeAllowEntry(params.senderId);
  if (allowFrom.includes(senderId)) {
    return { allowed: true, matchKey: senderId, matchSource: "id" };
  }
  return { allowed: false };
}
function resolveNextcloudTalkRoomMatch(params) {
  const rooms = params.rooms ?? {};
  const allowlistConfigured = Object.keys(rooms).length > 0;
  const roomName = params.roomName?.trim() || void 0;
  const roomCandidates = buildChannelKeyCandidates(
    params.roomToken,
    roomName,
    roomName ? normalizeChannelSlug(roomName) : void 0
  );
  const match = resolveChannelEntryMatchWithFallback({
    entries: rooms,
    keys: roomCandidates,
    wildcardKey: "*",
    normalizeKey: normalizeChannelSlug
  });
  const roomConfig = match.entry;
  const allowed = resolveNestedAllowlistDecision({
    outerConfigured: allowlistConfigured,
    outerMatched: Boolean(roomConfig),
    innerConfigured: false,
    innerMatched: false
  });
  return {
    roomConfig,
    wildcardConfig: match.wildcardEntry,
    roomKey: match.matchKey ?? match.key,
    matchSource: match.matchSource,
    allowed,
    allowlistConfigured
  };
}
function resolveNextcloudTalkGroupToolPolicy(params) {
  const cfg = params.cfg;
  const roomToken = params.groupId?.trim();
  if (!roomToken) {
    return void 0;
  }
  const roomName = params.groupChannel?.trim() || void 0;
  const match = resolveNextcloudTalkRoomMatch({
    rooms: cfg.channels?.["nextcloud-talk"]?.rooms,
    roomToken,
    roomName
  });
  return match.roomConfig?.tools ?? match.wildcardConfig?.tools;
}
function resolveNextcloudTalkRequireMention(params) {
  if (typeof params.roomConfig?.requireMention === "boolean") {
    return params.roomConfig.requireMention;
  }
  if (typeof params.wildcardConfig?.requireMention === "boolean") {
    return params.wildcardConfig.requireMention;
  }
  return true;
}
function resolveNextcloudTalkGroupAllow(params) {
  if (params.groupPolicy === "disabled") {
    return { allowed: false, outerMatch: { allowed: false }, innerMatch: { allowed: false } };
  }
  if (params.groupPolicy === "open") {
    return { allowed: true, outerMatch: { allowed: true }, innerMatch: { allowed: true } };
  }
  const outerAllow = normalizeNextcloudTalkAllowlist(params.outerAllowFrom);
  const innerAllow = normalizeNextcloudTalkAllowlist(params.innerAllowFrom);
  if (outerAllow.length === 0 && innerAllow.length === 0) {
    return { allowed: false, outerMatch: { allowed: false }, innerMatch: { allowed: false } };
  }
  const outerMatch = resolveNextcloudTalkAllowlistMatch({
    allowFrom: params.outerAllowFrom,
    senderId: params.senderId
  });
  const innerMatch = resolveNextcloudTalkAllowlistMatch({
    allowFrom: params.innerAllowFrom,
    senderId: params.senderId
  });
  const allowed = resolveNestedAllowlistDecision({
    outerConfigured: outerAllow.length > 0 || innerAllow.length > 0,
    outerMatched: outerAllow.length > 0 ? outerMatch.allowed : true,
    innerConfigured: innerAllow.length > 0,
    innerMatched: innerMatch.allowed
  });
  return { allowed, outerMatch, innerMatch };
}
function resolveNextcloudTalkMentionGate(params) {
  const result = resolveMentionGatingWithBypass({
    isGroup: params.isGroup,
    requireMention: params.requireMention,
    canDetectMention: true,
    wasMentioned: params.wasMentioned,
    allowTextCommands: params.allowTextCommands,
    hasControlCommand: params.hasControlCommand,
    commandAuthorized: params.commandAuthorized
  });
  return { shouldSkip: result.shouldSkip, shouldBypassMention: result.shouldBypassMention };
}

// vendor/openclaw-runtime/win-x64/extensions/nextcloud-talk/src/room-info.ts
import { readFileSync as readFileSync2 } from "fs";
import { fetchWithSsrFGuard } from "openclaw/plugin-sdk";
var ROOM_CACHE_TTL_MS = 5 * 60 * 1e3;
var ROOM_CACHE_ERROR_TTL_MS = 30 * 1e3;
var roomCache = /* @__PURE__ */ new Map();
function resolveRoomCacheKey(params) {
  return `${params.accountId}:${params.roomToken}`;
}
function readApiPassword(params) {
  const inlinePassword = normalizeResolvedSecretInputString({
    value: params.apiPassword,
    path: "channels.nextcloud-talk.apiPassword"
  });
  if (inlinePassword) {
    return inlinePassword;
  }
  if (!params.apiPasswordFile) {
    return void 0;
  }
  try {
    const value = readFileSync2(params.apiPasswordFile, "utf-8").trim();
    return value || void 0;
  } catch {
    return void 0;
  }
}
function coerceRoomType(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : void 0;
  }
  return void 0;
}
function resolveRoomKindFromType(type) {
  if (!type) {
    return void 0;
  }
  if (type === 1 || type === 5 || type === 6) {
    return "direct";
  }
  return "group";
}
async function resolveNextcloudTalkRoomKind(params) {
  const { account, roomToken, runtime: runtime2 } = params;
  const key = resolveRoomCacheKey({ accountId: account.accountId, roomToken });
  const cached = roomCache.get(key);
  if (cached) {
    const age = Date.now() - cached.fetchedAt;
    if (cached.kind && age < ROOM_CACHE_TTL_MS) {
      return cached.kind;
    }
    if (cached.error && age < ROOM_CACHE_ERROR_TTL_MS) {
      return void 0;
    }
  }
  const apiUser = account.config.apiUser?.trim();
  const apiPassword = readApiPassword({
    apiPassword: account.config.apiPassword,
    apiPasswordFile: account.config.apiPasswordFile
  });
  if (!apiUser || !apiPassword) {
    return void 0;
  }
  const baseUrl = account.baseUrl?.trim();
  if (!baseUrl) {
    return void 0;
  }
  const url = `${baseUrl}/ocs/v2.php/apps/spreed/api/v4/room/${roomToken}`;
  const auth = Buffer.from(`${apiUser}:${apiPassword}`, "utf-8").toString("base64");
  try {
    const { response, release } = await fetchWithSsrFGuard({
      url,
      init: {
        method: "GET",
        headers: {
          Authorization: `Basic ${auth}`,
          "OCS-APIRequest": "true",
          Accept: "application/json"
        }
      },
      auditContext: "nextcloud-talk.room-info"
    });
    try {
      if (!response.ok) {
        roomCache.set(key, {
          fetchedAt: Date.now(),
          error: `status:${response.status}`
        });
        runtime2?.log?.(
          `nextcloud-talk: room lookup failed (${response.status}) token=${roomToken}`
        );
        return void 0;
      }
      const payload = await response.json();
      const type = coerceRoomType(payload.ocs?.data?.type);
      const kind = resolveRoomKindFromType(type);
      roomCache.set(key, { fetchedAt: Date.now(), kind });
      return kind;
    } finally {
      await release();
    }
  } catch (err) {
    roomCache.set(key, {
      fetchedAt: Date.now(),
      error: err instanceof Error ? err.message : String(err)
    });
    runtime2?.error?.(`nextcloud-talk: room lookup error: ${String(err)}`);
    return void 0;
  }
}

// vendor/openclaw-runtime/win-x64/extensions/nextcloud-talk/src/runtime.ts
var runtime = null;
function setNextcloudTalkRuntime(next) {
  runtime = next;
}
function getNextcloudTalkRuntime() {
  if (!runtime) {
    throw new Error("Nextcloud Talk runtime not initialized");
  }
  return runtime;
}

// vendor/openclaw-runtime/win-x64/extensions/nextcloud-talk/src/signature.ts
import { createHmac, randomBytes } from "crypto";
var SIGNATURE_HEADER = "x-nextcloud-talk-signature";
var RANDOM_HEADER = "x-nextcloud-talk-random";
var BACKEND_HEADER = "x-nextcloud-talk-backend";
function verifyNextcloudTalkSignature(params) {
  const { signature, random, body, secret } = params;
  if (!signature || !random || !secret) {
    return false;
  }
  const expected = createHmac("sha256", secret).update(random + body).digest("hex");
  if (signature.length !== expected.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < signature.length; i++) {
    result |= signature.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return result === 0;
}
function extractNextcloudTalkHeaders(headers) {
  const getHeader = (name) => {
    const value = headers[name] ?? headers[name.toLowerCase()];
    return Array.isArray(value) ? value[0] : value;
  };
  const signature = getHeader(SIGNATURE_HEADER);
  const random = getHeader(RANDOM_HEADER);
  const backend = getHeader(BACKEND_HEADER);
  if (!signature || !random || !backend) {
    return null;
  }
  return { signature, random, backend };
}
function generateNextcloudTalkSignature(params) {
  const { body, secret } = params;
  const random = randomBytes(32).toString("hex");
  const signature = createHmac("sha256", secret).update(random + body).digest("hex");
  return { random, signature };
}

// vendor/openclaw-runtime/win-x64/extensions/nextcloud-talk/src/send.ts
function resolveCredentials(explicit, account) {
  const baseUrl = explicit.baseUrl?.trim() ?? account.baseUrl;
  const secret = explicit.secret?.trim() ?? account.secret;
  if (!baseUrl) {
    throw new Error(
      `Nextcloud Talk baseUrl missing for account "${account.accountId}" (set channels.nextcloud-talk.baseUrl).`
    );
  }
  if (!secret) {
    throw new Error(
      `Nextcloud Talk bot secret missing for account "${account.accountId}" (set channels.nextcloud-talk.botSecret/botSecretFile or NEXTCLOUD_TALK_BOT_SECRET for default).`
    );
  }
  return { baseUrl, secret };
}
function normalizeRoomToken(to) {
  const trimmed = to.trim();
  if (!trimmed) {
    throw new Error("Room token is required for Nextcloud Talk sends");
  }
  let normalized = trimmed;
  if (normalized.startsWith("nextcloud-talk:")) {
    normalized = normalized.slice("nextcloud-talk:".length).trim();
  } else if (normalized.startsWith("nc:")) {
    normalized = normalized.slice("nc:".length).trim();
  }
  if (normalized.startsWith("room:")) {
    normalized = normalized.slice("room:".length).trim();
  }
  if (!normalized) {
    throw new Error("Room token is required for Nextcloud Talk sends");
  }
  return normalized;
}
async function sendMessageNextcloudTalk(to, text, opts = {}) {
  const cfg = getNextcloudTalkRuntime().config.loadConfig();
  const account = resolveNextcloudTalkAccount({
    cfg,
    accountId: opts.accountId
  });
  const { baseUrl, secret } = resolveCredentials(
    { baseUrl: opts.baseUrl, secret: opts.secret },
    account
  );
  const roomToken = normalizeRoomToken(to);
  if (!text?.trim()) {
    throw new Error("Message must be non-empty for Nextcloud Talk sends");
  }
  const tableMode = getNextcloudTalkRuntime().channel.text.resolveMarkdownTableMode({
    cfg,
    channel: "nextcloud-talk",
    accountId: account.accountId
  });
  const message = getNextcloudTalkRuntime().channel.text.convertMarkdownTables(
    text.trim(),
    tableMode
  );
  const body = {
    message
  };
  if (opts.replyTo) {
    body.replyTo = opts.replyTo;
  }
  const bodyStr = JSON.stringify(body);
  const { random, signature } = generateNextcloudTalkSignature({
    body: message,
    secret
  });
  const url = `${baseUrl}/ocs/v2.php/apps/spreed/api/v1/bot/${roomToken}/message`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "OCS-APIRequest": "true",
      "X-Nextcloud-Talk-Bot-Random": random,
      "X-Nextcloud-Talk-Bot-Signature": signature
    },
    body: bodyStr
  });
  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    const status = response.status;
    let errorMsg = `Nextcloud Talk send failed (${status})`;
    if (status === 400) {
      errorMsg = `Nextcloud Talk: bad request - ${errorBody || "invalid message format"}`;
    } else if (status === 401) {
      errorMsg = "Nextcloud Talk: authentication failed - check bot secret";
    } else if (status === 403) {
      errorMsg = "Nextcloud Talk: forbidden - bot may not have permission in this room";
    } else if (status === 404) {
      errorMsg = `Nextcloud Talk: room not found (token=${roomToken})`;
    } else if (errorBody) {
      errorMsg = `Nextcloud Talk send failed: ${errorBody}`;
    }
    throw new Error(errorMsg);
  }
  let messageId = "unknown";
  let timestamp;
  try {
    const data = await response.json();
    if (data.ocs?.data?.id != null) {
      messageId = String(data.ocs.data.id);
    }
    if (typeof data.ocs?.data?.timestamp === "number") {
      timestamp = data.ocs.data.timestamp;
    }
  } catch {
  }
  if (opts.verbose) {
    console.log(`[nextcloud-talk] Sent message ${messageId} to room ${roomToken}`);
  }
  getNextcloudTalkRuntime().channel.activity.record({
    channel: "nextcloud-talk",
    accountId: account.accountId,
    direction: "outbound"
  });
  return { messageId, roomToken, timestamp };
}

// vendor/openclaw-runtime/win-x64/extensions/nextcloud-talk/src/inbound.ts
var CHANNEL_ID = "nextcloud-talk";
async function deliverNextcloudTalkReply(params) {
  const { payload, roomToken, accountId, statusSink } = params;
  const combined = formatTextWithAttachmentLinks(payload.text, resolveOutboundMediaUrls(payload));
  if (!combined) {
    return;
  }
  await sendMessageNextcloudTalk(roomToken, combined, {
    accountId,
    replyTo: payload.replyToId
  });
  statusSink?.({ lastOutboundAt: Date.now() });
}
async function handleNextcloudTalkInbound(params) {
  const { message, account, config, runtime: runtime2, statusSink } = params;
  const core = getNextcloudTalkRuntime();
  const pairing = createScopedPairingAccess({
    core,
    channel: CHANNEL_ID,
    accountId: account.accountId
  });
  const rawBody = message.text?.trim() ?? "";
  if (!rawBody) {
    return;
  }
  const roomKind = await resolveNextcloudTalkRoomKind({
    account,
    roomToken: message.roomToken,
    runtime: runtime2
  });
  const isGroup = roomKind === "direct" ? false : roomKind === "group" ? true : message.isGroupChat;
  const senderId = message.senderId;
  const senderName = message.senderName;
  const roomToken = message.roomToken;
  const roomName = message.roomName;
  statusSink?.({ lastInboundAt: message.timestamp });
  const dmPolicy2 = account.config.dmPolicy ?? "pairing";
  const defaultGroupPolicy = resolveDefaultGroupPolicy(config);
  const { groupPolicy, providerMissingFallbackApplied } = resolveAllowlistProviderRuntimeGroupPolicy({
    providerConfigPresent: (config.channels?.["nextcloud-talk"] ?? void 0) !== void 0,
    groupPolicy: account.config.groupPolicy,
    defaultGroupPolicy
  });
  warnMissingProviderGroupPolicyFallbackOnce({
    providerMissingFallbackApplied,
    providerKey: "nextcloud-talk",
    accountId: account.accountId,
    blockedLabel: GROUP_POLICY_BLOCKED_LABEL.room,
    log: (message2) => runtime2.log?.(message2)
  });
  const configAllowFrom = normalizeNextcloudTalkAllowlist(account.config.allowFrom);
  const configGroupAllowFrom = normalizeNextcloudTalkAllowlist(account.config.groupAllowFrom);
  const storeAllowFrom = await readStoreAllowFromForDmPolicy({
    provider: CHANNEL_ID,
    accountId: account.accountId,
    dmPolicy: dmPolicy2,
    readStore: pairing.readStoreForDmPolicy
  });
  const storeAllowList = normalizeNextcloudTalkAllowlist(storeAllowFrom);
  const roomMatch = resolveNextcloudTalkRoomMatch({
    rooms: account.config.rooms,
    roomToken,
    roomName
  });
  const roomConfig = roomMatch.roomConfig;
  if (isGroup && !roomMatch.allowed) {
    runtime2.log?.(`nextcloud-talk: drop room ${roomToken} (not allowlisted)`);
    return;
  }
  if (roomConfig?.enabled === false) {
    runtime2.log?.(`nextcloud-talk: drop room ${roomToken} (disabled)`);
    return;
  }
  const roomAllowFrom = normalizeNextcloudTalkAllowlist(roomConfig?.allowFrom);
  const allowTextCommands = core.channel.commands.shouldHandleTextCommands({
    cfg: config,
    surface: CHANNEL_ID
  });
  const useAccessGroups = config.commands?.useAccessGroups !== false;
  const hasControlCommand = core.channel.text.hasControlCommand(rawBody, config);
  const access = resolveDmGroupAccessWithCommandGate({
    isGroup,
    dmPolicy: dmPolicy2,
    groupPolicy,
    allowFrom: configAllowFrom,
    groupAllowFrom: configGroupAllowFrom,
    storeAllowFrom: storeAllowList,
    isSenderAllowed: (allowFrom) => resolveNextcloudTalkAllowlistMatch({
      allowFrom,
      senderId
    }).allowed,
    command: {
      useAccessGroups,
      allowTextCommands,
      hasControlCommand
    }
  });
  const commandAuthorized = access.commandAuthorized;
  const effectiveGroupAllowFrom = access.effectiveGroupAllowFrom;
  if (isGroup) {
    if (access.decision !== "allow") {
      runtime2.log?.(`nextcloud-talk: drop group sender ${senderId} (reason=${access.reason})`);
      return;
    }
    const groupAllow = resolveNextcloudTalkGroupAllow({
      groupPolicy,
      outerAllowFrom: effectiveGroupAllowFrom,
      innerAllowFrom: roomAllowFrom,
      senderId
    });
    if (!groupAllow.allowed) {
      runtime2.log?.(`nextcloud-talk: drop group sender ${senderId} (policy=${groupPolicy})`);
      return;
    }
  } else {
    if (access.decision !== "allow") {
      if (access.decision === "pairing") {
        const { code, created } = await pairing.upsertPairingRequest({
          id: senderId,
          meta: { name: senderName || void 0 }
        });
        if (created) {
          try {
            await sendMessageNextcloudTalk(
              roomToken,
              core.channel.pairing.buildPairingReply({
                channel: CHANNEL_ID,
                idLine: `Your Nextcloud user id: ${senderId}`,
                code
              }),
              { accountId: account.accountId }
            );
            statusSink?.({ lastOutboundAt: Date.now() });
          } catch (err) {
            runtime2.error?.(`nextcloud-talk: pairing reply failed for ${senderId}: ${String(err)}`);
          }
        }
      }
      runtime2.log?.(`nextcloud-talk: drop DM sender ${senderId} (reason=${access.reason})`);
      return;
    }
  }
  if (access.shouldBlockControlCommand) {
    logInboundDrop({
      log: (message2) => runtime2.log?.(message2),
      channel: CHANNEL_ID,
      reason: "control command (unauthorized)",
      target: senderId
    });
    return;
  }
  const mentionRegexes = core.channel.mentions.buildMentionRegexes(config);
  const wasMentioned = mentionRegexes.length ? core.channel.mentions.matchesMentionPatterns(rawBody, mentionRegexes) : false;
  const shouldRequireMention = isGroup ? resolveNextcloudTalkRequireMention({
    roomConfig,
    wildcardConfig: roomMatch.wildcardConfig
  }) : false;
  const mentionGate = resolveNextcloudTalkMentionGate({
    isGroup,
    requireMention: shouldRequireMention,
    wasMentioned,
    allowTextCommands,
    hasControlCommand,
    commandAuthorized
  });
  if (isGroup && mentionGate.shouldSkip) {
    runtime2.log?.(`nextcloud-talk: drop room ${roomToken} (no mention)`);
    return;
  }
  const route = core.channel.routing.resolveAgentRoute({
    cfg: config,
    channel: CHANNEL_ID,
    accountId: account.accountId,
    peer: {
      kind: isGroup ? "group" : "direct",
      id: isGroup ? roomToken : senderId
    }
  });
  const fromLabel = isGroup ? `room:${roomName || roomToken}` : senderName || `user:${senderId}`;
  const storePath = core.channel.session.resolveStorePath(
    config.session?.store,
    {
      agentId: route.agentId
    }
  );
  const envelopeOptions = core.channel.reply.resolveEnvelopeFormatOptions(config);
  const previousTimestamp = core.channel.session.readSessionUpdatedAt({
    storePath,
    sessionKey: route.sessionKey
  });
  const body = core.channel.reply.formatAgentEnvelope({
    channel: "Nextcloud Talk",
    from: fromLabel,
    timestamp: message.timestamp,
    previousTimestamp,
    envelope: envelopeOptions,
    body: rawBody
  });
  const groupSystemPrompt = roomConfig?.systemPrompt?.trim() || void 0;
  const ctxPayload = core.channel.reply.finalizeInboundContext({
    Body: body,
    BodyForAgent: rawBody,
    RawBody: rawBody,
    CommandBody: rawBody,
    From: isGroup ? `nextcloud-talk:room:${roomToken}` : `nextcloud-talk:${senderId}`,
    To: `nextcloud-talk:${roomToken}`,
    SessionKey: route.sessionKey,
    AccountId: route.accountId,
    ChatType: isGroup ? "group" : "direct",
    ConversationLabel: fromLabel,
    SenderName: senderName || void 0,
    SenderId: senderId,
    GroupSubject: isGroup ? roomName || roomToken : void 0,
    GroupSystemPrompt: isGroup ? groupSystemPrompt : void 0,
    Provider: CHANNEL_ID,
    Surface: CHANNEL_ID,
    WasMentioned: isGroup ? wasMentioned : void 0,
    MessageSid: message.messageId,
    Timestamp: message.timestamp,
    OriginatingChannel: CHANNEL_ID,
    OriginatingTo: `nextcloud-talk:${roomToken}`,
    CommandAuthorized: commandAuthorized
  });
  await core.channel.session.recordInboundSession({
    storePath,
    sessionKey: ctxPayload.SessionKey ?? route.sessionKey,
    ctx: ctxPayload,
    onRecordError: (err) => {
      runtime2.error?.(`nextcloud-talk: failed updating session meta: ${String(err)}`);
    }
  });
  const { onModelSelected, ...prefixOptions } = createReplyPrefixOptions({
    cfg: config,
    agentId: route.agentId,
    channel: CHANNEL_ID,
    accountId: account.accountId
  });
  const deliverReply = createNormalizedOutboundDeliverer(async (payload) => {
    await deliverNextcloudTalkReply({
      payload,
      roomToken,
      accountId: account.accountId,
      statusSink
    });
  });
  await core.channel.reply.dispatchReplyWithBufferedBlockDispatcher({
    ctx: ctxPayload,
    cfg: config,
    dispatcherOptions: {
      ...prefixOptions,
      deliver: deliverReply,
      onError: (err, info) => {
        runtime2.error?.(`nextcloud-talk ${info.kind} reply failed: ${String(err)}`);
      }
    },
    replyOptions: {
      skillFilter: roomConfig?.skills,
      onModelSelected,
      disableBlockStreaming: typeof account.config.blockStreaming === "boolean" ? !account.config.blockStreaming : void 0
    }
  });
}

// vendor/openclaw-runtime/win-x64/extensions/nextcloud-talk/src/replay-guard.ts
import path from "path";
import { createPersistentDedupe } from "openclaw/plugin-sdk";
var DEFAULT_REPLAY_TTL_MS = 24 * 60 * 60 * 1e3;
var DEFAULT_MEMORY_MAX_SIZE = 1e3;
var DEFAULT_FILE_MAX_ENTRIES = 1e4;
function sanitizeSegment(value) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "default";
  }
  return trimmed.replace(/[^a-zA-Z0-9_-]/g, "_");
}
function buildReplayKey(params) {
  const roomToken = params.roomToken.trim();
  const messageId = params.messageId.trim();
  if (!roomToken || !messageId) {
    return null;
  }
  return `${roomToken}:${messageId}`;
}
function createNextcloudTalkReplayGuard(options) {
  const stateDir = options.stateDir.trim();
  const persistentDedupe = createPersistentDedupe({
    ttlMs: options.ttlMs ?? DEFAULT_REPLAY_TTL_MS,
    memoryMaxSize: options.memoryMaxSize ?? DEFAULT_MEMORY_MAX_SIZE,
    fileMaxEntries: options.fileMaxEntries ?? DEFAULT_FILE_MAX_ENTRIES,
    resolveFilePath: (namespace) => path.join(stateDir, "nextcloud-talk", "replay-dedupe", `${sanitizeSegment(namespace)}.json`)
  });
  return {
    shouldProcessMessage: async ({ accountId, roomToken, messageId }) => {
      const replayKey = buildReplayKey({ roomToken, messageId });
      if (!replayKey) {
        return true;
      }
      return await persistentDedupe.checkAndRecord(replayKey, {
        namespace: accountId,
        onDiskError: options.onDiskError
      });
    }
  };
}

// vendor/openclaw-runtime/win-x64/extensions/nextcloud-talk/src/monitor.ts
var DEFAULT_WEBHOOK_PORT = 8788;
var DEFAULT_WEBHOOK_HOST = "0.0.0.0";
var DEFAULT_WEBHOOK_PATH = "/nextcloud-talk-webhook";
var DEFAULT_WEBHOOK_MAX_BODY_BYTES = 1024 * 1024;
var DEFAULT_WEBHOOK_BODY_TIMEOUT_MS = 3e4;
var HEALTH_PATH = "/healthz";
var WEBHOOK_ERRORS = {
  missingSignatureHeaders: "Missing signature headers",
  invalidBackend: "Invalid backend",
  invalidSignature: "Invalid signature",
  invalidPayloadFormat: "Invalid payload format",
  payloadTooLarge: "Payload too large",
  internalServerError: "Internal server error"
};
function formatError(err) {
  if (err instanceof Error) {
    return err.message;
  }
  return typeof err === "string" ? err : JSON.stringify(err);
}
function normalizeOrigin(value) {
  try {
    return new URL(value).origin.toLowerCase();
  } catch {
    return null;
  }
}
function parseWebhookPayload(body) {
  try {
    const data = JSON.parse(body);
    if (!data.type || !data.actor?.type || !data.actor?.id || !data.object?.type || !data.object?.id || !data.target?.type || !data.target?.id) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}
function writeJsonResponse(res, status, body) {
  if (body) {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
    return;
  }
  res.writeHead(status);
  res.end();
}
function writeWebhookError(res, status, error) {
  if (res.headersSent) {
    return;
  }
  writeJsonResponse(res, status, { error });
}
function validateWebhookHeaders(params) {
  const headers = extractNextcloudTalkHeaders(
    params.req.headers
  );
  if (!headers) {
    writeWebhookError(params.res, 400, WEBHOOK_ERRORS.missingSignatureHeaders);
    return null;
  }
  if (params.isBackendAllowed && !params.isBackendAllowed(headers.backend)) {
    writeWebhookError(params.res, 401, WEBHOOK_ERRORS.invalidBackend);
    return null;
  }
  return headers;
}
function verifyWebhookSignature(params) {
  const isValid = verifyNextcloudTalkSignature({
    signature: params.headers.signature,
    random: params.headers.random,
    body: params.body,
    secret: params.secret
  });
  if (!isValid) {
    writeWebhookError(params.res, 401, WEBHOOK_ERRORS.invalidSignature);
    return false;
  }
  return true;
}
function decodeWebhookCreateMessage(params) {
  const payload = parseWebhookPayload(params.body);
  if (!payload) {
    writeWebhookError(params.res, 400, WEBHOOK_ERRORS.invalidPayloadFormat);
    return { kind: "invalid" };
  }
  if (payload.type !== "Create") {
    return { kind: "ignore" };
  }
  return { kind: "message", message: payloadToInboundMessage(payload) };
}
function payloadToInboundMessage(payload) {
  const isGroupChat = true;
  return {
    messageId: String(payload.object.id),
    roomToken: payload.target.id,
    roomName: payload.target.name,
    senderId: payload.actor.id,
    senderName: payload.actor.name ?? "",
    text: payload.object.content || payload.object.name || "",
    mediaType: payload.object.mediaType || "text/plain",
    timestamp: Date.now(),
    isGroupChat
  };
}
function readNextcloudTalkWebhookBody(req, maxBodyBytes) {
  return readRequestBodyWithLimit(req, {
    maxBytes: maxBodyBytes,
    timeoutMs: DEFAULT_WEBHOOK_BODY_TIMEOUT_MS
  });
}
function createNextcloudTalkWebhookServer(opts) {
  const { port, host, path: path2, secret, onMessage, onError, abortSignal } = opts;
  const maxBodyBytes = typeof opts.maxBodyBytes === "number" && Number.isFinite(opts.maxBodyBytes) && opts.maxBodyBytes > 0 ? Math.floor(opts.maxBodyBytes) : DEFAULT_WEBHOOK_MAX_BODY_BYTES;
  const readBody = opts.readBody ?? readNextcloudTalkWebhookBody;
  const isBackendAllowed = opts.isBackendAllowed;
  const shouldProcessMessage = opts.shouldProcessMessage;
  const server = createServer(async (req, res) => {
    if (req.url === HEALTH_PATH) {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("ok");
      return;
    }
    if (req.url !== path2 || req.method !== "POST") {
      res.writeHead(404);
      res.end();
      return;
    }
    try {
      const headers = validateWebhookHeaders({
        req,
        res,
        isBackendAllowed
      });
      if (!headers) {
        return;
      }
      const body = await readBody(req, maxBodyBytes);
      const hasValidSignature = verifyWebhookSignature({
        headers,
        body,
        secret,
        res
      });
      if (!hasValidSignature) {
        return;
      }
      const decoded = decodeWebhookCreateMessage({
        body,
        res
      });
      if (decoded.kind === "invalid") {
        return;
      }
      if (decoded.kind === "ignore") {
        writeJsonResponse(res, 200);
        return;
      }
      const message = decoded.message;
      if (shouldProcessMessage) {
        const shouldProcess = await shouldProcessMessage(message);
        if (!shouldProcess) {
          writeJsonResponse(res, 200);
          return;
        }
      }
      writeJsonResponse(res, 200);
      try {
        await onMessage(message);
      } catch (err) {
        onError?.(err instanceof Error ? err : new Error(formatError(err)));
      }
    } catch (err) {
      if (isRequestBodyLimitError(err, "PAYLOAD_TOO_LARGE")) {
        writeWebhookError(res, 413, WEBHOOK_ERRORS.payloadTooLarge);
        return;
      }
      if (isRequestBodyLimitError(err, "REQUEST_BODY_TIMEOUT")) {
        writeWebhookError(res, 408, requestBodyErrorToText("REQUEST_BODY_TIMEOUT"));
        return;
      }
      const error = err instanceof Error ? err : new Error(formatError(err));
      onError?.(error);
      writeWebhookError(res, 500, WEBHOOK_ERRORS.internalServerError);
    }
  });
  const start = () => {
    return new Promise((resolve) => {
      server.listen(port, host, () => resolve());
    });
  };
  let stopped = false;
  const stop = () => {
    if (stopped) {
      return;
    }
    stopped = true;
    try {
      server.close();
    } catch {
    }
  };
  if (abortSignal) {
    if (abortSignal.aborted) {
      stop();
    } else {
      abortSignal.addEventListener("abort", stop, { once: true });
    }
  }
  return { server, start, stop };
}
async function monitorNextcloudTalkProvider(opts) {
  const core = getNextcloudTalkRuntime();
  const cfg = opts.config ?? core.config.loadConfig();
  const account = resolveNextcloudTalkAccount({
    cfg,
    accountId: opts.accountId
  });
  const runtime2 = opts.runtime ?? createLoggerBackedRuntime({
    logger: core.logging.getChildLogger(),
    exitError: () => new Error("Runtime exit not available")
  });
  if (!account.secret) {
    throw new Error(`Nextcloud Talk bot secret not configured for account "${account.accountId}"`);
  }
  const port = account.config.webhookPort ?? DEFAULT_WEBHOOK_PORT;
  const host = account.config.webhookHost ?? DEFAULT_WEBHOOK_HOST;
  const path2 = account.config.webhookPath ?? DEFAULT_WEBHOOK_PATH;
  const logger = core.logging.getChildLogger({
    channel: "nextcloud-talk",
    accountId: account.accountId
  });
  const expectedBackendOrigin = normalizeOrigin(account.baseUrl);
  const replayGuard = createNextcloudTalkReplayGuard({
    stateDir: core.state.resolveStateDir(process.env, os.homedir),
    onDiskError: (error) => {
      logger.warn(
        `[nextcloud-talk:${account.accountId}] replay guard disk error: ${String(error)}`
      );
    }
  });
  const { start, stop } = createNextcloudTalkWebhookServer({
    port,
    host,
    path: path2,
    secret: account.secret,
    isBackendAllowed: (backend) => {
      if (!expectedBackendOrigin) {
        return true;
      }
      const backendOrigin = normalizeOrigin(backend);
      return backendOrigin === expectedBackendOrigin;
    },
    shouldProcessMessage: async (message) => {
      const shouldProcess = await replayGuard.shouldProcessMessage({
        accountId: account.accountId,
        roomToken: message.roomToken,
        messageId: message.messageId
      });
      if (!shouldProcess) {
        logger.warn(
          `[nextcloud-talk:${account.accountId}] replayed webhook ignored room=${message.roomToken} messageId=${message.messageId}`
        );
      }
      return shouldProcess;
    },
    onMessage: async (message) => {
      core.channel.activity.record({
        channel: "nextcloud-talk",
        accountId: account.accountId,
        direction: "inbound",
        at: message.timestamp
      });
      if (opts.onMessage) {
        await opts.onMessage(message);
        return;
      }
      await handleNextcloudTalkInbound({
        message,
        account,
        config: cfg,
        runtime: runtime2,
        statusSink: opts.statusSink
      });
    },
    onError: (error) => {
      logger.error(`[nextcloud-talk:${account.accountId}] webhook error: ${error.message}`);
    },
    abortSignal: opts.abortSignal
  });
  if (opts.abortSignal?.aborted) {
    return { stop };
  }
  await start();
  if (opts.abortSignal?.aborted) {
    stop();
    return { stop };
  }
  const publicUrl = account.config.webhookPublicUrl ?? `http://${host === "0.0.0.0" ? "localhost" : host}:${port}${path2}`;
  logger.info(`[nextcloud-talk:${account.accountId}] webhook listening on ${publicUrl}`);
  return { stop };
}

// vendor/openclaw-runtime/win-x64/extensions/nextcloud-talk/src/normalize.ts
function normalizeNextcloudTalkMessagingTarget(raw) {
  const trimmed = raw.trim();
  if (!trimmed) {
    return void 0;
  }
  let normalized = trimmed;
  if (normalized.startsWith("nextcloud-talk:")) {
    normalized = normalized.slice("nextcloud-talk:".length).trim();
  } else if (normalized.startsWith("nc-talk:")) {
    normalized = normalized.slice("nc-talk:".length).trim();
  } else if (normalized.startsWith("nc:")) {
    normalized = normalized.slice("nc:".length).trim();
  }
  if (normalized.startsWith("room:")) {
    normalized = normalized.slice("room:".length).trim();
  }
  if (!normalized) {
    return void 0;
  }
  return `nextcloud-talk:${normalized}`.toLowerCase();
}
function looksLikeNextcloudTalkTargetId(raw) {
  const trimmed = raw.trim();
  if (!trimmed) {
    return false;
  }
  if (/^(nextcloud-talk|nc-talk|nc):/i.test(trimmed)) {
    return true;
  }
  return /^[a-z0-9]{8,}$/i.test(trimmed);
}

// vendor/openclaw-runtime/win-x64/extensions/nextcloud-talk/src/onboarding.ts
import {
  addWildcardAllowFrom,
  formatDocsLink,
  hasConfiguredSecretInput as hasConfiguredSecretInput2,
  mergeAllowFromEntries,
  promptSingleChannelSecretInput,
  promptAccountId,
  DEFAULT_ACCOUNT_ID as DEFAULT_ACCOUNT_ID2,
  normalizeAccountId as normalizeAccountId2
} from "openclaw/plugin-sdk";
var channel = "nextcloud-talk";
function setNextcloudTalkDmPolicy(cfg, dmPolicy2) {
  const existingConfig = cfg.channels?.["nextcloud-talk"];
  const existingAllowFrom = (existingConfig?.allowFrom ?? []).map((x) => String(x));
  const allowFrom = dmPolicy2 === "open" ? addWildcardAllowFrom(existingAllowFrom) : existingAllowFrom;
  const newNextcloudTalkConfig = {
    ...existingConfig,
    dmPolicy: dmPolicy2,
    allowFrom
  };
  return {
    ...cfg,
    channels: {
      ...cfg.channels,
      "nextcloud-talk": newNextcloudTalkConfig
    }
  };
}
async function noteNextcloudTalkSecretHelp(prompter) {
  await prompter.note(
    [
      "1) SSH into your Nextcloud server",
      '2) Run: ./occ talk:bot:install "OpenClaw" "<shared-secret>" "<webhook-url>" --feature reaction',
      "3) Copy the shared secret you used in the command",
      "4) Enable the bot in your Nextcloud Talk room settings",
      "Tip: you can also set NEXTCLOUD_TALK_BOT_SECRET in your env.",
      `Docs: ${formatDocsLink("/channels/nextcloud-talk", "channels/nextcloud-talk")}`
    ].join("\n"),
    "Nextcloud Talk bot setup"
  );
}
async function noteNextcloudTalkUserIdHelp(prompter) {
  await prompter.note(
    [
      "1) Check the Nextcloud admin panel for user IDs",
      "2) Or look at the webhook payload logs when someone messages",
      "3) User IDs are typically lowercase usernames in Nextcloud",
      `Docs: ${formatDocsLink("/channels/nextcloud-talk", "channels/nextcloud-talk")}`
    ].join("\n"),
    "Nextcloud Talk user id"
  );
}
async function promptNextcloudTalkAllowFrom(params) {
  const { cfg, prompter, accountId } = params;
  const resolved = resolveNextcloudTalkAccount({ cfg, accountId });
  const existingAllowFrom = resolved.config.allowFrom ?? [];
  await noteNextcloudTalkUserIdHelp(prompter);
  const parseInput = (value) => value.split(/[\n,;]+/g).map((entry) => entry.trim().toLowerCase()).filter(Boolean);
  let resolvedIds = [];
  while (resolvedIds.length === 0) {
    const entry = await prompter.text({
      message: "Nextcloud Talk allowFrom (user id)",
      placeholder: "username",
      initialValue: existingAllowFrom[0] ? String(existingAllowFrom[0]) : void 0,
      validate: (value) => String(value ?? "").trim() ? void 0 : "Required"
    });
    resolvedIds = parseInput(String(entry));
    if (resolvedIds.length === 0) {
      await prompter.note("Please enter at least one valid user ID.", "Nextcloud Talk allowlist");
    }
  }
  const merged = [
    ...existingAllowFrom.map((item) => String(item).trim().toLowerCase()).filter(Boolean),
    ...resolvedIds
  ];
  const unique = mergeAllowFromEntries(void 0, merged);
  if (accountId === DEFAULT_ACCOUNT_ID2) {
    return {
      ...cfg,
      channels: {
        ...cfg.channels,
        "nextcloud-talk": {
          ...cfg.channels?.["nextcloud-talk"],
          enabled: true,
          dmPolicy: "allowlist",
          allowFrom: unique
        }
      }
    };
  }
  return {
    ...cfg,
    channels: {
      ...cfg.channels,
      "nextcloud-talk": {
        ...cfg.channels?.["nextcloud-talk"],
        enabled: true,
        accounts: {
          ...cfg.channels?.["nextcloud-talk"]?.accounts,
          [accountId]: {
            ...cfg.channels?.["nextcloud-talk"]?.accounts?.[accountId],
            enabled: cfg.channels?.["nextcloud-talk"]?.accounts?.[accountId]?.enabled ?? true,
            dmPolicy: "allowlist",
            allowFrom: unique
          }
        }
      }
    }
  };
}
async function promptNextcloudTalkAllowFromForAccount(params) {
  const accountId = params.accountId && normalizeAccountId2(params.accountId) ? normalizeAccountId2(params.accountId) ?? DEFAULT_ACCOUNT_ID2 : resolveDefaultNextcloudTalkAccountId(params.cfg);
  return promptNextcloudTalkAllowFrom({
    cfg: params.cfg,
    prompter: params.prompter,
    accountId
  });
}
var dmPolicy = {
  label: "Nextcloud Talk",
  channel,
  policyKey: "channels.nextcloud-talk.dmPolicy",
  allowFromKey: "channels.nextcloud-talk.allowFrom",
  getCurrent: (cfg) => cfg.channels?.["nextcloud-talk"]?.dmPolicy ?? "pairing",
  setPolicy: (cfg, policy) => setNextcloudTalkDmPolicy(cfg, policy),
  promptAllowFrom: promptNextcloudTalkAllowFromForAccount
};
var nextcloudTalkOnboardingAdapter = {
  channel,
  getStatus: async ({ cfg }) => {
    const configured = listNextcloudTalkAccountIds(cfg).some((accountId) => {
      const account = resolveNextcloudTalkAccount({ cfg, accountId });
      return Boolean(account.secret && account.baseUrl);
    });
    return {
      channel,
      configured,
      statusLines: [`Nextcloud Talk: ${configured ? "configured" : "needs setup"}`],
      selectionHint: configured ? "configured" : "self-hosted chat",
      quickstartScore: configured ? 1 : 5
    };
  },
  configure: async ({
    cfg,
    prompter,
    accountOverrides,
    shouldPromptAccountIds,
    forceAllowFrom
  }) => {
    const nextcloudTalkOverride = accountOverrides["nextcloud-talk"]?.trim();
    const defaultAccountId = resolveDefaultNextcloudTalkAccountId(cfg);
    let accountId = nextcloudTalkOverride ? normalizeAccountId2(nextcloudTalkOverride) : defaultAccountId;
    if (shouldPromptAccountIds && !nextcloudTalkOverride) {
      accountId = await promptAccountId({
        cfg,
        prompter,
        label: "Nextcloud Talk",
        currentId: accountId,
        listAccountIds: listNextcloudTalkAccountIds,
        defaultAccountId
      });
    }
    let next = cfg;
    const resolvedAccount = resolveNextcloudTalkAccount({
      cfg: next,
      accountId
    });
    const accountConfigured = Boolean(resolvedAccount.secret && resolvedAccount.baseUrl);
    const allowEnv = accountId === DEFAULT_ACCOUNT_ID2;
    const canUseEnv = allowEnv && Boolean(process.env.NEXTCLOUD_TALK_BOT_SECRET?.trim());
    const hasConfigSecret = Boolean(
      hasConfiguredSecretInput2(resolvedAccount.config.botSecret) || resolvedAccount.config.botSecretFile
    );
    let baseUrl = resolvedAccount.baseUrl;
    if (!baseUrl) {
      baseUrl = String(
        await prompter.text({
          message: "Enter Nextcloud instance URL (e.g., https://cloud.example.com)",
          validate: (value) => {
            const v = String(value ?? "").trim();
            if (!v) {
              return "Required";
            }
            if (!v.startsWith("http://") && !v.startsWith("https://")) {
              return "URL must start with http:// or https://";
            }
            return void 0;
          }
        })
      ).trim();
    }
    let secret = null;
    if (!accountConfigured) {
      await noteNextcloudTalkSecretHelp(prompter);
    }
    const secretResult = await promptSingleChannelSecretInput({
      cfg: next,
      prompter,
      providerHint: "nextcloud-talk",
      credentialLabel: "bot secret",
      accountConfigured,
      canUseEnv: canUseEnv && !hasConfigSecret,
      hasConfigToken: hasConfigSecret,
      envPrompt: "NEXTCLOUD_TALK_BOT_SECRET detected. Use env var?",
      keepPrompt: "Nextcloud Talk bot secret already configured. Keep it?",
      inputPrompt: "Enter Nextcloud Talk bot secret",
      preferredEnvVar: "NEXTCLOUD_TALK_BOT_SECRET"
    });
    if (secretResult.action === "set") {
      secret = secretResult.value;
    }
    if (secretResult.action === "use-env" || secret || baseUrl !== resolvedAccount.baseUrl) {
      if (accountId === DEFAULT_ACCOUNT_ID2) {
        next = {
          ...next,
          channels: {
            ...next.channels,
            "nextcloud-talk": {
              ...next.channels?.["nextcloud-talk"],
              enabled: true,
              baseUrl,
              ...secret ? { botSecret: secret } : {}
            }
          }
        };
      } else {
        next = {
          ...next,
          channels: {
            ...next.channels,
            "nextcloud-talk": {
              ...next.channels?.["nextcloud-talk"],
              enabled: true,
              accounts: {
                ...next.channels?.["nextcloud-talk"]?.accounts,
                [accountId]: {
                  ...next.channels?.["nextcloud-talk"]?.accounts?.[accountId],
                  enabled: next.channels?.["nextcloud-talk"]?.accounts?.[accountId]?.enabled ?? true,
                  baseUrl,
                  ...secret ? { botSecret: secret } : {}
                }
              }
            }
          }
        };
      }
    }
    const existingApiUser = resolvedAccount.config.apiUser?.trim();
    const existingApiPasswordConfigured = Boolean(
      hasConfiguredSecretInput2(resolvedAccount.config.apiPassword) || resolvedAccount.config.apiPasswordFile
    );
    const configureApiCredentials = await prompter.confirm({
      message: "Configure optional Nextcloud Talk API credentials for room lookups?",
      initialValue: Boolean(existingApiUser && existingApiPasswordConfigured)
    });
    if (configureApiCredentials) {
      const apiUser = String(
        await prompter.text({
          message: "Nextcloud Talk API user",
          initialValue: existingApiUser,
          validate: (value) => String(value ?? "").trim() ? void 0 : "Required"
        })
      ).trim();
      const apiPasswordResult = await promptSingleChannelSecretInput({
        cfg: next,
        prompter,
        providerHint: "nextcloud-talk-api",
        credentialLabel: "API password",
        accountConfigured: Boolean(existingApiUser && existingApiPasswordConfigured),
        canUseEnv: false,
        hasConfigToken: existingApiPasswordConfigured,
        envPrompt: "",
        keepPrompt: "Nextcloud Talk API password already configured. Keep it?",
        inputPrompt: "Enter Nextcloud Talk API password",
        preferredEnvVar: "NEXTCLOUD_TALK_API_PASSWORD"
      });
      const apiPassword = apiPasswordResult.action === "set" ? apiPasswordResult.value : void 0;
      if (accountId === DEFAULT_ACCOUNT_ID2) {
        next = {
          ...next,
          channels: {
            ...next.channels,
            "nextcloud-talk": {
              ...next.channels?.["nextcloud-talk"],
              enabled: true,
              apiUser,
              ...apiPassword ? { apiPassword } : {}
            }
          }
        };
      } else {
        next = {
          ...next,
          channels: {
            ...next.channels,
            "nextcloud-talk": {
              ...next.channels?.["nextcloud-talk"],
              enabled: true,
              accounts: {
                ...next.channels?.["nextcloud-talk"]?.accounts,
                [accountId]: {
                  ...next.channels?.["nextcloud-talk"]?.accounts?.[accountId],
                  enabled: next.channels?.["nextcloud-talk"]?.accounts?.[accountId]?.enabled ?? true,
                  apiUser,
                  ...apiPassword ? { apiPassword } : {}
                }
              }
            }
          }
        };
      }
    }
    if (forceAllowFrom) {
      next = await promptNextcloudTalkAllowFrom({
        cfg: next,
        prompter,
        accountId
      });
    }
    return { cfg: next, accountId };
  },
  dmPolicy,
  disable: (cfg) => ({
    ...cfg,
    channels: {
      ...cfg.channels,
      "nextcloud-talk": { ...cfg.channels?.["nextcloud-talk"], enabled: false }
    }
  })
};

// vendor/openclaw-runtime/win-x64/extensions/nextcloud-talk/src/channel.ts
var meta = {
  id: "nextcloud-talk",
  label: "Nextcloud Talk",
  selectionLabel: "Nextcloud Talk (self-hosted)",
  docsPath: "/channels/nextcloud-talk",
  docsLabel: "nextcloud-talk",
  blurb: "Self-hosted chat via Nextcloud Talk webhook bots.",
  aliases: ["nc-talk", "nc"],
  order: 65,
  quickstartAllowFrom: true
};
var nextcloudTalkPlugin = {
  id: "nextcloud-talk",
  meta,
  onboarding: nextcloudTalkOnboardingAdapter,
  pairing: {
    idLabel: "nextcloudUserId",
    normalizeAllowEntry: (entry) => entry.replace(/^(nextcloud-talk|nc-talk|nc):/i, "").toLowerCase(),
    notifyApproval: async ({ id }) => {
      console.log(`[nextcloud-talk] User ${id} approved for pairing`);
    }
  },
  capabilities: {
    chatTypes: ["direct", "group"],
    reactions: true,
    threads: false,
    media: true,
    nativeCommands: false,
    blockStreaming: true
  },
  reload: { configPrefixes: ["channels.nextcloud-talk"] },
  configSchema: buildChannelConfigSchema(NextcloudTalkConfigSchema),
  config: {
    listAccountIds: (cfg) => listNextcloudTalkAccountIds(cfg),
    resolveAccount: (cfg, accountId) => resolveNextcloudTalkAccount({ cfg, accountId }),
    defaultAccountId: (cfg) => resolveDefaultNextcloudTalkAccountId(cfg),
    setAccountEnabled: ({ cfg, accountId, enabled }) => setAccountEnabledInConfigSection({
      cfg,
      sectionKey: "nextcloud-talk",
      accountId,
      enabled,
      allowTopLevel: true
    }),
    deleteAccount: ({ cfg, accountId }) => deleteAccountFromConfigSection({
      cfg,
      sectionKey: "nextcloud-talk",
      accountId,
      clearBaseFields: ["botSecret", "botSecretFile", "baseUrl", "name"]
    }),
    isConfigured: (account) => Boolean(account.secret?.trim() && account.baseUrl?.trim()),
    describeAccount: (account) => ({
      accountId: account.accountId,
      name: account.name,
      enabled: account.enabled,
      configured: Boolean(account.secret?.trim() && account.baseUrl?.trim()),
      secretSource: account.secretSource,
      baseUrl: account.baseUrl ? "[set]" : "[missing]"
    }),
    resolveAllowFrom: ({ cfg, accountId }) => (resolveNextcloudTalkAccount({ cfg, accountId }).config.allowFrom ?? []).map((entry) => String(entry).toLowerCase()),
    formatAllowFrom: ({ allowFrom }) => allowFrom.map((entry) => String(entry).trim()).filter(Boolean).map((entry) => entry.replace(/^(nextcloud-talk|nc-talk|nc):/i, "")).map((entry) => entry.toLowerCase())
  },
  security: {
    resolveDmPolicy: ({ cfg, accountId, account }) => {
      const resolvedAccountId = accountId ?? account.accountId ?? DEFAULT_ACCOUNT_ID3;
      const useAccountPath = Boolean(
        cfg.channels?.["nextcloud-talk"]?.accounts?.[resolvedAccountId]
      );
      const basePath = useAccountPath ? `channels.nextcloud-talk.accounts.${resolvedAccountId}.` : "channels.nextcloud-talk.";
      return {
        policy: account.config.dmPolicy ?? "pairing",
        allowFrom: account.config.allowFrom ?? [],
        policyPath: `${basePath}dmPolicy`,
        allowFromPath: basePath,
        approveHint: formatPairingApproveHint("nextcloud-talk"),
        normalizeEntry: (raw) => raw.replace(/^(nextcloud-talk|nc-talk|nc):/i, "").toLowerCase()
      };
    },
    collectWarnings: ({ account, cfg }) => {
      const defaultGroupPolicy = resolveDefaultGroupPolicy2(cfg);
      const { groupPolicy } = resolveAllowlistProviderRuntimeGroupPolicy2({
        providerConfigPresent: cfg.channels?.["nextcloud-talk"] !== void 0,
        groupPolicy: account.config.groupPolicy,
        defaultGroupPolicy
      });
      if (groupPolicy !== "open") {
        return [];
      }
      const roomAllowlistConfigured = account.config.rooms && Object.keys(account.config.rooms).length > 0;
      if (roomAllowlistConfigured) {
        return [
          `- Nextcloud Talk rooms: groupPolicy="open" allows any member in allowed rooms to trigger (mention-gated). Set channels.nextcloud-talk.groupPolicy="allowlist" + channels.nextcloud-talk.groupAllowFrom to restrict senders.`
        ];
      }
      return [
        `- Nextcloud Talk rooms: groupPolicy="open" with no channels.nextcloud-talk.rooms allowlist; any room can add + ping (mention-gated). Set channels.nextcloud-talk.groupPolicy="allowlist" + channels.nextcloud-talk.groupAllowFrom or configure channels.nextcloud-talk.rooms.`
      ];
    }
  },
  groups: {
    resolveRequireMention: ({ cfg, accountId, groupId }) => {
      const account = resolveNextcloudTalkAccount({ cfg, accountId });
      const rooms = account.config.rooms;
      if (!rooms || !groupId) {
        return true;
      }
      const roomConfig = rooms[groupId];
      if (roomConfig?.requireMention !== void 0) {
        return roomConfig.requireMention;
      }
      const wildcardConfig = rooms["*"];
      if (wildcardConfig?.requireMention !== void 0) {
        return wildcardConfig.requireMention;
      }
      return true;
    },
    resolveToolPolicy: resolveNextcloudTalkGroupToolPolicy
  },
  messaging: {
    normalizeTarget: normalizeNextcloudTalkMessagingTarget,
    targetResolver: {
      looksLikeId: looksLikeNextcloudTalkTargetId,
      hint: "<roomToken>"
    }
  },
  setup: {
    resolveAccountId: ({ accountId }) => normalizeAccountId3(accountId),
    applyAccountName: ({ cfg, accountId, name }) => applyAccountNameToChannelSection({
      cfg,
      channelKey: "nextcloud-talk",
      accountId,
      name
    }),
    validateInput: ({ accountId, input }) => {
      const setupInput = input;
      if (setupInput.useEnv && accountId !== DEFAULT_ACCOUNT_ID3) {
        return "NEXTCLOUD_TALK_BOT_SECRET can only be used for the default account.";
      }
      if (!setupInput.useEnv && !setupInput.secret && !setupInput.secretFile) {
        return "Nextcloud Talk requires bot secret or --secret-file (or --use-env).";
      }
      if (!setupInput.baseUrl) {
        return "Nextcloud Talk requires --base-url.";
      }
      return null;
    },
    applyAccountConfig: ({ cfg, accountId, input }) => {
      const setupInput = input;
      const namedConfig = applyAccountNameToChannelSection({
        cfg,
        channelKey: "nextcloud-talk",
        accountId,
        name: setupInput.name
      });
      if (accountId === DEFAULT_ACCOUNT_ID3) {
        return {
          ...namedConfig,
          channels: {
            ...namedConfig.channels,
            "nextcloud-talk": {
              ...namedConfig.channels?.["nextcloud-talk"],
              enabled: true,
              baseUrl: setupInput.baseUrl,
              ...setupInput.useEnv ? {} : setupInput.secretFile ? { botSecretFile: setupInput.secretFile } : setupInput.secret ? { botSecret: setupInput.secret } : {}
            }
          }
        };
      }
      return {
        ...namedConfig,
        channels: {
          ...namedConfig.channels,
          "nextcloud-talk": {
            ...namedConfig.channels?.["nextcloud-talk"],
            enabled: true,
            accounts: {
              ...namedConfig.channels?.["nextcloud-talk"]?.accounts,
              [accountId]: {
                ...namedConfig.channels?.["nextcloud-talk"]?.accounts?.[accountId],
                enabled: true,
                baseUrl: setupInput.baseUrl,
                ...setupInput.secretFile ? { botSecretFile: setupInput.secretFile } : setupInput.secret ? { botSecret: setupInput.secret } : {}
              }
            }
          }
        }
      };
    }
  },
  outbound: {
    deliveryMode: "direct",
    chunker: (text, limit) => getNextcloudTalkRuntime().channel.text.chunkMarkdownText(text, limit),
    chunkerMode: "markdown",
    textChunkLimit: 4e3,
    sendText: async ({ to, text, accountId, replyToId }) => {
      const result = await sendMessageNextcloudTalk(to, text, {
        accountId: accountId ?? void 0,
        replyTo: replyToId ?? void 0
      });
      return { channel: "nextcloud-talk", ...result };
    },
    sendMedia: async ({ to, text, mediaUrl, accountId, replyToId }) => {
      const messageWithMedia = mediaUrl ? `${text}

Attachment: ${mediaUrl}` : text;
      const result = await sendMessageNextcloudTalk(to, messageWithMedia, {
        accountId: accountId ?? void 0,
        replyTo: replyToId ?? void 0
      });
      return { channel: "nextcloud-talk", ...result };
    }
  },
  status: {
    defaultRuntime: {
      accountId: DEFAULT_ACCOUNT_ID3,
      running: false,
      lastStartAt: null,
      lastStopAt: null,
      lastError: null
    },
    buildChannelSummary: ({ snapshot }) => ({
      configured: snapshot.configured ?? false,
      secretSource: snapshot.secretSource ?? "none",
      running: snapshot.running ?? false,
      mode: "webhook",
      lastStartAt: snapshot.lastStartAt ?? null,
      lastStopAt: snapshot.lastStopAt ?? null,
      lastError: snapshot.lastError ?? null
    }),
    buildAccountSnapshot: ({ account, runtime: runtime2 }) => {
      const configured = Boolean(account.secret?.trim() && account.baseUrl?.trim());
      return {
        accountId: account.accountId,
        name: account.name,
        enabled: account.enabled,
        configured,
        secretSource: account.secretSource,
        baseUrl: account.baseUrl ? "[set]" : "[missing]",
        running: runtime2?.running ?? false,
        lastStartAt: runtime2?.lastStartAt ?? null,
        lastStopAt: runtime2?.lastStopAt ?? null,
        lastError: runtime2?.lastError ?? null,
        mode: "webhook",
        lastInboundAt: runtime2?.lastInboundAt ?? null,
        lastOutboundAt: runtime2?.lastOutboundAt ?? null
      };
    }
  },
  gateway: {
    startAccount: async (ctx) => {
      const account = ctx.account;
      if (!account.secret || !account.baseUrl) {
        throw new Error(
          `Nextcloud Talk not configured for account "${account.accountId}" (missing secret or baseUrl)`
        );
      }
      ctx.log?.info(`[${account.accountId}] starting Nextcloud Talk webhook server`);
      const { stop } = await monitorNextcloudTalkProvider({
        accountId: account.accountId,
        config: ctx.cfg,
        runtime: ctx.runtime,
        abortSignal: ctx.abortSignal,
        statusSink: (patch) => ctx.setStatus({ accountId: ctx.accountId, ...patch })
      });
      await waitForAbortSignal(ctx.abortSignal);
      stop();
    },
    logoutAccount: async ({ accountId, cfg }) => {
      const nextCfg = { ...cfg };
      const nextSection = cfg.channels?.["nextcloud-talk"] ? { ...cfg.channels["nextcloud-talk"] } : void 0;
      let cleared = false;
      let changed = false;
      if (nextSection) {
        if (accountId === DEFAULT_ACCOUNT_ID3 && nextSection.botSecret) {
          delete nextSection.botSecret;
          cleared = true;
          changed = true;
        }
        const accounts = nextSection.accounts && typeof nextSection.accounts === "object" ? { ...nextSection.accounts } : void 0;
        if (accounts && accountId in accounts) {
          const entry = accounts[accountId];
          if (entry && typeof entry === "object") {
            const nextEntry = { ...entry };
            if ("botSecret" in nextEntry) {
              const secret = nextEntry.botSecret;
              if (typeof secret === "string" ? secret.trim() : secret) {
                cleared = true;
              }
              delete nextEntry.botSecret;
              changed = true;
            }
            if (Object.keys(nextEntry).length === 0) {
              delete accounts[accountId];
              changed = true;
            } else {
              accounts[accountId] = nextEntry;
            }
          }
        }
        if (accounts) {
          if (Object.keys(accounts).length === 0) {
            delete nextSection.accounts;
            changed = true;
          } else {
            nextSection.accounts = accounts;
          }
        }
      }
      if (changed) {
        if (nextSection && Object.keys(nextSection).length > 0) {
          nextCfg.channels = { ...nextCfg.channels, "nextcloud-talk": nextSection };
        } else {
          const nextChannels = { ...nextCfg.channels };
          delete nextChannels["nextcloud-talk"];
          if (Object.keys(nextChannels).length > 0) {
            nextCfg.channels = nextChannels;
          } else {
            delete nextCfg.channels;
          }
        }
      }
      const resolved = resolveNextcloudTalkAccount({
        cfg: changed ? nextCfg : cfg,
        accountId
      });
      const loggedOut = resolved.secretSource === "none";
      if (changed) {
        await getNextcloudTalkRuntime().config.writeConfigFile(nextCfg);
      }
      return {
        cleared,
        envSecret: Boolean(process.env.NEXTCLOUD_TALK_BOT_SECRET?.trim()),
        loggedOut
      };
    }
  }
};

// vendor/openclaw-runtime/win-x64/extensions/nextcloud-talk/index.ts
var plugin = {
  id: "nextcloud-talk",
  name: "Nextcloud Talk",
  description: "Nextcloud Talk channel plugin",
  configSchema: emptyPluginConfigSchema(),
  register(api) {
    setNextcloudTalkRuntime(api.runtime);
    api.registerChannel({ plugin: nextcloudTalkPlugin });
  }
};
var nextcloud_talk_default = plugin;
export {
  nextcloud_talk_default as default
};
