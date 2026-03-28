// vendor/openclaw-runtime/win-x64/extensions/bluebubbles/index.ts
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";

// vendor/openclaw-runtime/win-x64/extensions/bluebubbles/src/channel.ts
import {
  applyAccountNameToChannelSection,
  buildChannelConfigSchema,
  buildProbeChannelStatusSummary,
  collectBlueBubblesStatusIssues,
  DEFAULT_ACCOUNT_ID as DEFAULT_ACCOUNT_ID3,
  deleteAccountFromConfigSection,
  formatPairingApproveHint,
  migrateBaseNameToDefaultAccount,
  normalizeAccountId as normalizeAccountId3,
  PAIRING_APPROVED_MESSAGE,
  resolveBlueBubblesGroupRequireMention,
  resolveBlueBubblesGroupToolPolicy,
  setAccountEnabledInConfigSection
} from "openclaw/plugin-sdk";

// vendor/openclaw-runtime/win-x64/extensions/bluebubbles/src/accounts.ts
import {
  DEFAULT_ACCOUNT_ID,
  normalizeAccountId,
  normalizeOptionalAccountId
} from "openclaw/plugin-sdk/account-id";

// vendor/openclaw-runtime/win-x64/extensions/bluebubbles/src/secret-input.ts
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

// vendor/openclaw-runtime/win-x64/extensions/bluebubbles/src/types.ts
var DEFAULT_TIMEOUT_MS = 1e4;
function normalizeBlueBubblesServerUrl(raw) {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("BlueBubbles serverUrl is required");
  }
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  return withScheme.replace(/\/+$/, "");
}
function buildBlueBubblesApiUrl(params) {
  const normalized = normalizeBlueBubblesServerUrl(params.baseUrl);
  const url = new URL(params.path, `${normalized}/`);
  if (params.password) {
    url.searchParams.set("password", params.password);
  }
  return url.toString();
}
async function blueBubblesFetchWithTimeout(url, init, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// vendor/openclaw-runtime/win-x64/extensions/bluebubbles/src/accounts.ts
function listConfiguredAccountIds(cfg) {
  const accounts = cfg.channels?.bluebubbles?.accounts;
  if (!accounts || typeof accounts !== "object") {
    return [];
  }
  return Object.keys(accounts).filter(Boolean);
}
function listBlueBubblesAccountIds(cfg) {
  const ids = listConfiguredAccountIds(cfg);
  if (ids.length === 0) {
    return [DEFAULT_ACCOUNT_ID];
  }
  return ids.toSorted((a, b) => a.localeCompare(b));
}
function resolveDefaultBlueBubblesAccountId(cfg) {
  const preferred = normalizeOptionalAccountId(cfg.channels?.bluebubbles?.defaultAccount);
  if (preferred && listBlueBubblesAccountIds(cfg).some((accountId) => normalizeAccountId(accountId) === preferred)) {
    return preferred;
  }
  const ids = listBlueBubblesAccountIds(cfg);
  if (ids.includes(DEFAULT_ACCOUNT_ID)) {
    return DEFAULT_ACCOUNT_ID;
  }
  return ids[0] ?? DEFAULT_ACCOUNT_ID;
}
function resolveAccountConfig(cfg, accountId) {
  const accounts = cfg.channels?.bluebubbles?.accounts;
  if (!accounts || typeof accounts !== "object") {
    return void 0;
  }
  return accounts[accountId];
}
function mergeBlueBubblesAccountConfig(cfg, accountId) {
  const base = cfg.channels?.bluebubbles ?? {};
  const { accounts: _ignored, defaultAccount: _ignoredDefaultAccount, ...rest } = base;
  const account = resolveAccountConfig(cfg, accountId) ?? {};
  const chunkMode = account.chunkMode ?? rest.chunkMode ?? "length";
  return { ...rest, ...account, chunkMode };
}
function resolveBlueBubblesAccount(params) {
  const accountId = normalizeAccountId(params.accountId);
  const baseEnabled = params.cfg.channels?.bluebubbles?.enabled;
  const merged = mergeBlueBubblesAccountConfig(params.cfg, accountId);
  const accountEnabled = merged.enabled !== false;
  const serverUrl = normalizeSecretInputString(merged.serverUrl);
  const password = normalizeSecretInputString(merged.password);
  const configured = Boolean(serverUrl && hasConfiguredSecretInput(merged.password));
  const baseUrl = serverUrl ? normalizeBlueBubblesServerUrl(serverUrl) : void 0;
  return {
    accountId,
    enabled: baseEnabled !== false && accountEnabled,
    name: merged.name?.trim() || void 0,
    config: merged,
    configured,
    baseUrl
  };
}

// vendor/openclaw-runtime/win-x64/extensions/bluebubbles/src/actions.ts
import {
  BLUEBUBBLES_ACTION_NAMES,
  BLUEBUBBLES_ACTIONS,
  createActionGate,
  extractToolSend,
  jsonResult,
  readNumberParam,
  readBooleanParam,
  readReactionParams,
  readStringParam
} from "openclaw/plugin-sdk";

// vendor/openclaw-runtime/win-x64/extensions/bluebubbles/src/attachments.ts
import crypto2 from "crypto";
import path from "path";

// vendor/openclaw-runtime/win-x64/extensions/bluebubbles/src/account-resolve.ts
function resolveBlueBubblesServerAccount(params) {
  const account = resolveBlueBubblesAccount({
    cfg: params.cfg ?? {},
    accountId: params.accountId
  });
  const baseUrl = normalizeResolvedSecretInputString({
    value: params.serverUrl,
    path: "channels.bluebubbles.serverUrl"
  }) || normalizeResolvedSecretInputString({
    value: account.config.serverUrl,
    path: `channels.bluebubbles.accounts.${account.accountId}.serverUrl`
  });
  const password = normalizeResolvedSecretInputString({
    value: params.password,
    path: "channels.bluebubbles.password"
  }) || normalizeResolvedSecretInputString({
    value: account.config.password,
    path: `channels.bluebubbles.accounts.${account.accountId}.password`
  });
  if (!baseUrl) {
    throw new Error("BlueBubbles serverUrl is required");
  }
  if (!password) {
    throw new Error("BlueBubbles password is required");
  }
  return {
    baseUrl,
    password,
    accountId: account.accountId,
    allowPrivateNetwork: account.config.allowPrivateNetwork === true
  };
}

// vendor/openclaw-runtime/win-x64/extensions/bluebubbles/src/multipart.ts
function concatUint8Arrays(parts) {
  const totalLength = parts.reduce((acc, part) => acc + part.length, 0);
  const body = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of parts) {
    body.set(part, offset);
    offset += part.length;
  }
  return body;
}
async function postMultipartFormData(params) {
  const body = Buffer.from(concatUint8Arrays(params.parts));
  return await blueBubblesFetchWithTimeout(
    params.url,
    {
      method: "POST",
      headers: {
        "Content-Type": `multipart/form-data; boundary=${params.boundary}`
      },
      body
    },
    params.timeoutMs
  );
}

// vendor/openclaw-runtime/win-x64/extensions/bluebubbles/src/probe.ts
var MAX_SERVER_INFO_CACHE_SIZE = 64;
var serverInfoCache = /* @__PURE__ */ new Map();
var CACHE_TTL_MS = 10 * 60 * 1e3;
function buildCacheKey(accountId) {
  return accountId?.trim() || "default";
}
async function fetchBlueBubblesServerInfo(params) {
  const baseUrl = normalizeSecretInputString(params.baseUrl);
  const password = normalizeSecretInputString(params.password);
  if (!baseUrl || !password) {
    return null;
  }
  const cacheKey = buildCacheKey(params.accountId);
  const cached = serverInfoCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return cached.info;
  }
  const url = buildBlueBubblesApiUrl({ baseUrl, path: "/api/v1/server/info", password });
  try {
    const res = await blueBubblesFetchWithTimeout(url, { method: "GET" }, params.timeoutMs ?? 5e3);
    if (!res.ok) {
      return null;
    }
    const payload = await res.json().catch(() => null);
    const data = payload?.data;
    if (data) {
      serverInfoCache.set(cacheKey, { info: data, expires: Date.now() + CACHE_TTL_MS });
      if (serverInfoCache.size > MAX_SERVER_INFO_CACHE_SIZE) {
        const oldest = serverInfoCache.keys().next().value;
        if (oldest !== void 0) {
          serverInfoCache.delete(oldest);
        }
      }
    }
    return data ?? null;
  } catch {
    return null;
  }
}
function getCachedBlueBubblesServerInfo(accountId) {
  const cacheKey = buildCacheKey(accountId);
  const cached = serverInfoCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return cached.info;
  }
  return null;
}
function getCachedBlueBubblesPrivateApiStatus(accountId) {
  const info = getCachedBlueBubblesServerInfo(accountId);
  if (!info || typeof info.private_api !== "boolean") {
    return null;
  }
  return info.private_api;
}
function isBlueBubblesPrivateApiStatusEnabled(status) {
  return status === true;
}
function isBlueBubblesPrivateApiEnabled(accountId) {
  return isBlueBubblesPrivateApiStatusEnabled(getCachedBlueBubblesPrivateApiStatus(accountId));
}
function parseMacOSMajorVersion(version) {
  if (!version) {
    return null;
  }
  const match = /^(\d+)/.exec(version.trim());
  return match ? Number.parseInt(match[1], 10) : null;
}
function isMacOS26OrHigher(accountId) {
  const info = getCachedBlueBubblesServerInfo(accountId);
  if (!info?.os_version) {
    return false;
  }
  const major = parseMacOSMajorVersion(info.os_version);
  return major !== null && major >= 26;
}
async function probeBlueBubbles(params) {
  const baseUrl = normalizeSecretInputString(params.baseUrl);
  const password = normalizeSecretInputString(params.password);
  if (!baseUrl) {
    return { ok: false, error: "serverUrl not configured" };
  }
  if (!password) {
    return { ok: false, error: "password not configured" };
  }
  const url = buildBlueBubblesApiUrl({ baseUrl, path: "/api/v1/ping", password });
  try {
    const res = await blueBubblesFetchWithTimeout(url, { method: "GET" }, params.timeoutMs);
    if (!res.ok) {
      return { ok: false, status: res.status, error: `HTTP ${res.status}` };
    }
    return { ok: true, status: res.status };
  } catch (err) {
    return {
      ok: false,
      status: null,
      error: err instanceof Error ? err.message : String(err)
    };
  }
}

// vendor/openclaw-runtime/win-x64/extensions/bluebubbles/src/request-url.ts
function resolveRequestUrl(input) {
  if (typeof input === "string") {
    return input;
  }
  if (input instanceof URL) {
    return input.toString();
  }
  if (typeof input === "object" && input && "url" in input && typeof input.url === "string") {
    return input.url;
  }
  return String(input);
}

// vendor/openclaw-runtime/win-x64/extensions/bluebubbles/src/runtime.ts
var runtime = null;
function setBlueBubblesRuntime(next) {
  runtime = next;
}
function getBlueBubblesRuntime() {
  if (!runtime) {
    throw new Error("BlueBubbles runtime not initialized");
  }
  return runtime;
}
function warnBlueBubbles(message) {
  const formatted = `[bluebubbles] ${message}`;
  const log = runtime?.log;
  if (typeof log === "function") {
    log(formatted);
    return;
  }
  console.warn(formatted);
}

// vendor/openclaw-runtime/win-x64/extensions/bluebubbles/src/targets.ts
import {
  isAllowedParsedChatSender,
  parseChatAllowTargetPrefixes,
  parseChatTargetPrefixesOrThrow,
  resolveServicePrefixedAllowTarget,
  resolveServicePrefixedTarget
} from "openclaw/plugin-sdk";
var CHAT_ID_PREFIXES = ["chat_id:", "chatid:", "chat:"];
var CHAT_GUID_PREFIXES = ["chat_guid:", "chatguid:", "guid:"];
var CHAT_IDENTIFIER_PREFIXES = ["chat_identifier:", "chatidentifier:", "chatident:"];
var SERVICE_PREFIXES = [
  { prefix: "imessage:", service: "imessage" },
  { prefix: "sms:", service: "sms" },
  { prefix: "auto:", service: "auto" }
];
var CHAT_IDENTIFIER_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
var CHAT_IDENTIFIER_HEX_RE = /^[0-9a-f]{24,64}$/i;
function parseRawChatGuid(value) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parts = trimmed.split(";");
  if (parts.length !== 3) {
    return null;
  }
  const service = parts[0]?.trim();
  const separator = parts[1]?.trim();
  const identifier = parts[2]?.trim();
  if (!service || !identifier) {
    return null;
  }
  if (separator !== "+" && separator !== "-") {
    return null;
  }
  return `${service};${separator};${identifier}`;
}
function stripPrefix(value, prefix) {
  return value.slice(prefix.length).trim();
}
function stripBlueBubblesPrefix(value) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  if (!trimmed.toLowerCase().startsWith("bluebubbles:")) {
    return trimmed;
  }
  return trimmed.slice("bluebubbles:".length).trim();
}
function looksLikeRawChatIdentifier(value) {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }
  if (/^chat\d+$/i.test(trimmed)) {
    return true;
  }
  return CHAT_IDENTIFIER_UUID_RE.test(trimmed) || CHAT_IDENTIFIER_HEX_RE.test(trimmed);
}
function parseGroupTarget(params) {
  if (!params.lower.startsWith("group:")) {
    return null;
  }
  const value = stripPrefix(params.trimmed, "group:");
  const chatId = Number.parseInt(value, 10);
  if (Number.isFinite(chatId)) {
    return { kind: "chat_id", chatId };
  }
  if (value) {
    return { kind: "chat_guid", chatGuid: value };
  }
  if (params.requireValue) {
    throw new Error("group target is required");
  }
  return null;
}
function parseRawChatIdentifierTarget(trimmed) {
  if (/^chat\d+$/i.test(trimmed)) {
    return { kind: "chat_identifier", chatIdentifier: trimmed };
  }
  if (looksLikeRawChatIdentifier(trimmed)) {
    return { kind: "chat_identifier", chatIdentifier: trimmed };
  }
  return null;
}
function normalizeBlueBubblesHandle(raw) {
  const trimmed = raw.trim();
  if (!trimmed) {
    return "";
  }
  const lowered = trimmed.toLowerCase();
  if (lowered.startsWith("imessage:")) {
    return normalizeBlueBubblesHandle(trimmed.slice(9));
  }
  if (lowered.startsWith("sms:")) {
    return normalizeBlueBubblesHandle(trimmed.slice(4));
  }
  if (lowered.startsWith("auto:")) {
    return normalizeBlueBubblesHandle(trimmed.slice(5));
  }
  if (trimmed.includes("@")) {
    return trimmed.toLowerCase();
  }
  return trimmed.replace(/\s+/g, "");
}
function extractHandleFromChatGuid(chatGuid) {
  const parts = chatGuid.split(";");
  if (parts.length === 3 && parts[1] === "-") {
    const handle = parts[2]?.trim();
    if (handle) {
      return normalizeBlueBubblesHandle(handle);
    }
  }
  return null;
}
function normalizeBlueBubblesMessagingTarget(raw) {
  let trimmed = raw.trim();
  if (!trimmed) {
    return void 0;
  }
  trimmed = stripBlueBubblesPrefix(trimmed);
  if (!trimmed) {
    return void 0;
  }
  try {
    const parsed = parseBlueBubblesTarget(trimmed);
    if (parsed.kind === "chat_id") {
      return `chat_id:${parsed.chatId}`;
    }
    if (parsed.kind === "chat_guid") {
      const handle2 = extractHandleFromChatGuid(parsed.chatGuid);
      if (handle2) {
        return handle2;
      }
      return `chat_guid:${parsed.chatGuid}`;
    }
    if (parsed.kind === "chat_identifier") {
      return `chat_identifier:${parsed.chatIdentifier}`;
    }
    const handle = normalizeBlueBubblesHandle(parsed.to);
    if (!handle) {
      return void 0;
    }
    return parsed.service === "auto" ? handle : `${parsed.service}:${handle}`;
  } catch {
    return trimmed;
  }
}
function looksLikeBlueBubblesTargetId(raw, normalized) {
  const trimmed = raw.trim();
  if (!trimmed) {
    return false;
  }
  const candidate = stripBlueBubblesPrefix(trimmed);
  if (!candidate) {
    return false;
  }
  if (parseRawChatGuid(candidate)) {
    return true;
  }
  const lowered = candidate.toLowerCase();
  if (/^(imessage|sms|auto):/.test(lowered)) {
    return true;
  }
  if (/^(chat_id|chatid|chat|chat_guid|chatguid|guid|chat_identifier|chatidentifier|chatident|group):/.test(
    lowered
  )) {
    return true;
  }
  if (/^chat\d+$/i.test(candidate)) {
    return true;
  }
  if (looksLikeRawChatIdentifier(candidate)) {
    return true;
  }
  if (candidate.includes("@")) {
    return true;
  }
  const digitsOnly = candidate.replace(/[\s().-]/g, "");
  if (/^\+?\d{3,}$/.test(digitsOnly)) {
    return true;
  }
  if (normalized) {
    const normalizedTrimmed = normalized.trim();
    if (!normalizedTrimmed) {
      return false;
    }
    const normalizedLower = normalizedTrimmed.toLowerCase();
    if (/^(imessage|sms|auto):/.test(normalizedLower) || /^(chat_id|chat_guid|chat_identifier):/.test(normalizedLower)) {
      return true;
    }
  }
  return false;
}
function parseBlueBubblesTarget(raw) {
  const trimmed = stripBlueBubblesPrefix(raw);
  if (!trimmed) {
    throw new Error("BlueBubbles target is required");
  }
  const lower = trimmed.toLowerCase();
  const servicePrefixed = resolveServicePrefixedTarget({
    trimmed,
    lower,
    servicePrefixes: SERVICE_PREFIXES,
    isChatTarget: (remainderLower) => CHAT_ID_PREFIXES.some((p) => remainderLower.startsWith(p)) || CHAT_GUID_PREFIXES.some((p) => remainderLower.startsWith(p)) || CHAT_IDENTIFIER_PREFIXES.some((p) => remainderLower.startsWith(p)) || remainderLower.startsWith("group:"),
    parseTarget: parseBlueBubblesTarget
  });
  if (servicePrefixed) {
    return servicePrefixed;
  }
  const chatTarget = parseChatTargetPrefixesOrThrow({
    trimmed,
    lower,
    chatIdPrefixes: CHAT_ID_PREFIXES,
    chatGuidPrefixes: CHAT_GUID_PREFIXES,
    chatIdentifierPrefixes: CHAT_IDENTIFIER_PREFIXES
  });
  if (chatTarget) {
    return chatTarget;
  }
  const groupTarget = parseGroupTarget({ trimmed, lower, requireValue: true });
  if (groupTarget) {
    return groupTarget;
  }
  const rawChatGuid = parseRawChatGuid(trimmed);
  if (rawChatGuid) {
    return { kind: "chat_guid", chatGuid: rawChatGuid };
  }
  const rawChatIdentifierTarget = parseRawChatIdentifierTarget(trimmed);
  if (rawChatIdentifierTarget) {
    return rawChatIdentifierTarget;
  }
  return { kind: "handle", to: trimmed, service: "auto" };
}
function parseBlueBubblesAllowTarget(raw) {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { kind: "handle", handle: "" };
  }
  const lower = trimmed.toLowerCase();
  const servicePrefixed = resolveServicePrefixedAllowTarget({
    trimmed,
    lower,
    servicePrefixes: SERVICE_PREFIXES,
    parseAllowTarget: parseBlueBubblesAllowTarget
  });
  if (servicePrefixed) {
    return servicePrefixed;
  }
  const chatTarget = parseChatAllowTargetPrefixes({
    trimmed,
    lower,
    chatIdPrefixes: CHAT_ID_PREFIXES,
    chatGuidPrefixes: CHAT_GUID_PREFIXES,
    chatIdentifierPrefixes: CHAT_IDENTIFIER_PREFIXES
  });
  if (chatTarget) {
    return chatTarget;
  }
  const groupTarget = parseGroupTarget({ trimmed, lower, requireValue: false });
  if (groupTarget) {
    return groupTarget;
  }
  const rawChatIdentifierTarget = parseRawChatIdentifierTarget(trimmed);
  if (rawChatIdentifierTarget) {
    return rawChatIdentifierTarget;
  }
  return { kind: "handle", handle: normalizeBlueBubblesHandle(trimmed) };
}
function isAllowedBlueBubblesSender(params) {
  return isAllowedParsedChatSender({
    allowFrom: params.allowFrom,
    sender: params.sender,
    chatId: params.chatId,
    chatGuid: params.chatGuid,
    chatIdentifier: params.chatIdentifier,
    normalizeSender: normalizeBlueBubblesHandle,
    parseAllowTarget: parseBlueBubblesAllowTarget
  });
}
function formatBlueBubblesChatTarget(params) {
  if (params.chatId && Number.isFinite(params.chatId)) {
    return `chat_id:${params.chatId}`;
  }
  const guid = params.chatGuid?.trim();
  if (guid) {
    return `chat_guid:${guid}`;
  }
  const identifier = params.chatIdentifier?.trim();
  if (identifier) {
    return `chat_identifier:${identifier}`;
  }
  return "";
}

// vendor/openclaw-runtime/win-x64/extensions/bluebubbles/src/send-helpers.ts
function resolveBlueBubblesSendTarget(raw) {
  const parsed = parseBlueBubblesTarget(raw);
  if (parsed.kind === "handle") {
    return {
      kind: "handle",
      address: normalizeBlueBubblesHandle(parsed.to),
      service: parsed.service
    };
  }
  if (parsed.kind === "chat_id") {
    return { kind: "chat_id", chatId: parsed.chatId };
  }
  if (parsed.kind === "chat_guid") {
    return { kind: "chat_guid", chatGuid: parsed.chatGuid };
  }
  return { kind: "chat_identifier", chatIdentifier: parsed.chatIdentifier };
}
function extractBlueBubblesMessageId(payload) {
  if (!payload || typeof payload !== "object") {
    return "unknown";
  }
  const asRecord3 = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : null;
  const record = payload;
  const dataRecord = asRecord3(record.data);
  const resultRecord = asRecord3(record.result);
  const payloadRecord = asRecord3(record.payload);
  const messageRecord = asRecord3(record.message);
  const dataArrayFirst = Array.isArray(record.data) ? asRecord3(record.data[0]) : null;
  const roots = [record, dataRecord, resultRecord, payloadRecord, messageRecord, dataArrayFirst];
  for (const root of roots) {
    if (!root) {
      continue;
    }
    const candidates = [
      root.message_id,
      root.messageId,
      root.messageGuid,
      root.message_guid,
      root.guid,
      root.id,
      root.uuid
    ];
    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.trim()) {
        return candidate.trim();
      }
      if (typeof candidate === "number" && Number.isFinite(candidate)) {
        return String(candidate);
      }
    }
  }
  return "unknown";
}

// vendor/openclaw-runtime/win-x64/extensions/bluebubbles/src/send.ts
import crypto from "crypto";
import { stripMarkdown } from "openclaw/plugin-sdk";
var EFFECT_MAP = {
  // Bubble effects
  slam: "com.apple.MobileSMS.expressivesend.impact",
  loud: "com.apple.MobileSMS.expressivesend.loud",
  gentle: "com.apple.MobileSMS.expressivesend.gentle",
  invisible: "com.apple.MobileSMS.expressivesend.invisibleink",
  "invisible-ink": "com.apple.MobileSMS.expressivesend.invisibleink",
  "invisible ink": "com.apple.MobileSMS.expressivesend.invisibleink",
  invisibleink: "com.apple.MobileSMS.expressivesend.invisibleink",
  // Screen effects
  echo: "com.apple.messages.effect.CKEchoEffect",
  spotlight: "com.apple.messages.effect.CKSpotlightEffect",
  balloons: "com.apple.messages.effect.CKHappyBirthdayEffect",
  confetti: "com.apple.messages.effect.CKConfettiEffect",
  love: "com.apple.messages.effect.CKHeartEffect",
  heart: "com.apple.messages.effect.CKHeartEffect",
  hearts: "com.apple.messages.effect.CKHeartEffect",
  lasers: "com.apple.messages.effect.CKLasersEffect",
  fireworks: "com.apple.messages.effect.CKFireworksEffect",
  celebration: "com.apple.messages.effect.CKSparklesEffect"
};
function resolveEffectId(raw) {
  if (!raw) {
    return void 0;
  }
  const trimmed = raw.trim().toLowerCase();
  if (EFFECT_MAP[trimmed]) {
    return EFFECT_MAP[trimmed];
  }
  const normalized = trimmed.replace(/[\s_]+/g, "-");
  if (EFFECT_MAP[normalized]) {
    return EFFECT_MAP[normalized];
  }
  const compact = trimmed.replace(/[\s_-]+/g, "");
  if (EFFECT_MAP[compact]) {
    return EFFECT_MAP[compact];
  }
  return raw;
}
function resolvePrivateApiDecision(params) {
  const { privateApiStatus, wantsReplyThread, wantsEffect } = params;
  const needsPrivateApi = wantsReplyThread || wantsEffect;
  const canUsePrivateApi = needsPrivateApi && isBlueBubblesPrivateApiStatusEnabled(privateApiStatus);
  const throwEffectDisabledError = wantsEffect && privateApiStatus === false;
  if (!needsPrivateApi || privateApiStatus !== null) {
    return { canUsePrivateApi, throwEffectDisabledError };
  }
  const requested = [
    wantsReplyThread ? "reply threading" : null,
    wantsEffect ? "message effects" : null
  ].filter(Boolean).join(" + ");
  return {
    canUsePrivateApi,
    throwEffectDisabledError,
    warningMessage: `Private API status unknown; sending without ${requested}. Run a status probe to restore private-api features.`
  };
}
function extractChatGuid(chat) {
  const candidates = [
    chat.chatGuid,
    chat.guid,
    chat.chat_guid,
    chat.identifier,
    chat.chatIdentifier,
    chat.chat_identifier
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }
  return null;
}
function extractChatId(chat) {
  const candidates = [chat.chatId, chat.id, chat.chat_id];
  for (const candidate of candidates) {
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return candidate;
    }
  }
  return null;
}
function extractChatIdentifierFromChatGuid(chatGuid) {
  const parts = chatGuid.split(";");
  if (parts.length < 3) {
    return null;
  }
  const identifier = parts[2]?.trim();
  return identifier ? identifier : null;
}
function extractParticipantAddresses(chat) {
  const raw = (Array.isArray(chat.participants) ? chat.participants : null) ?? (Array.isArray(chat.handles) ? chat.handles : null) ?? (Array.isArray(chat.participantHandles) ? chat.participantHandles : null);
  if (!raw) {
    return [];
  }
  const out = [];
  for (const entry of raw) {
    if (typeof entry === "string") {
      out.push(entry);
      continue;
    }
    if (entry && typeof entry === "object") {
      const record = entry;
      const candidate = typeof record.address === "string" && record.address || typeof record.handle === "string" && record.handle || typeof record.id === "string" && record.id || typeof record.identifier === "string" && record.identifier;
      if (candidate) {
        out.push(candidate);
      }
    }
  }
  return out;
}
async function queryChats(params) {
  const url = buildBlueBubblesApiUrl({
    baseUrl: params.baseUrl,
    path: "/api/v1/chat/query",
    password: params.password
  });
  const res = await blueBubblesFetchWithTimeout(
    url,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        limit: params.limit,
        offset: params.offset,
        with: ["participants"]
      })
    },
    params.timeoutMs
  );
  if (!res.ok) {
    return [];
  }
  const payload = await res.json().catch(() => null);
  const data = payload && typeof payload.data !== "undefined" ? payload.data : null;
  return Array.isArray(data) ? data : [];
}
async function resolveChatGuidForTarget(params) {
  if (params.target.kind === "chat_guid") {
    return params.target.chatGuid;
  }
  const normalizedHandle = params.target.kind === "handle" ? normalizeBlueBubblesHandle(params.target.address) : "";
  const targetChatId = params.target.kind === "chat_id" ? params.target.chatId : null;
  const targetChatIdentifier = params.target.kind === "chat_identifier" ? params.target.chatIdentifier : null;
  const limit = 500;
  let participantMatch = null;
  for (let offset = 0; offset < 5e3; offset += limit) {
    const chats = await queryChats({
      baseUrl: params.baseUrl,
      password: params.password,
      timeoutMs: params.timeoutMs,
      offset,
      limit
    });
    if (chats.length === 0) {
      break;
    }
    for (const chat of chats) {
      if (targetChatId != null) {
        const chatId = extractChatId(chat);
        if (chatId != null && chatId === targetChatId) {
          return extractChatGuid(chat);
        }
      }
      if (targetChatIdentifier) {
        const guid = extractChatGuid(chat);
        if (guid) {
          if (guid === targetChatIdentifier) {
            return guid;
          }
          const guidIdentifier = extractChatIdentifierFromChatGuid(guid);
          if (guidIdentifier && guidIdentifier === targetChatIdentifier) {
            return guid;
          }
        }
        const identifier = typeof chat.identifier === "string" ? chat.identifier : typeof chat.chatIdentifier === "string" ? chat.chatIdentifier : typeof chat.chat_identifier === "string" ? chat.chat_identifier : "";
        if (identifier && identifier === targetChatIdentifier) {
          return guid ?? extractChatGuid(chat);
        }
      }
      if (normalizedHandle) {
        const guid = extractChatGuid(chat);
        const directHandle = guid ? extractHandleFromChatGuid(guid) : null;
        if (directHandle && directHandle === normalizedHandle) {
          return guid;
        }
        if (!participantMatch && guid) {
          const isDmChat = guid.includes(";-;");
          if (isDmChat) {
            const participants = extractParticipantAddresses(chat).map(
              (entry) => normalizeBlueBubblesHandle(entry)
            );
            if (participants.includes(normalizedHandle)) {
              participantMatch = guid;
            }
          }
        }
      }
    }
  }
  return participantMatch;
}
async function createNewChatWithMessage(params) {
  const url = buildBlueBubblesApiUrl({
    baseUrl: params.baseUrl,
    path: "/api/v1/chat/new",
    password: params.password
  });
  const payload = {
    addresses: [params.address],
    message: params.message,
    tempGuid: `temp-${crypto.randomUUID()}`
  };
  const res = await blueBubblesFetchWithTimeout(
    url,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    },
    params.timeoutMs
  );
  if (!res.ok) {
    const errorText = await res.text();
    if (res.status === 400 || res.status === 403 || errorText.toLowerCase().includes("private api")) {
      throw new Error(
        `BlueBubbles send failed: Cannot create new chat - Private API must be enabled. Original error: ${errorText || res.status}`
      );
    }
    throw new Error(`BlueBubbles create chat failed (${res.status}): ${errorText || "unknown"}`);
  }
  const body = await res.text();
  if (!body) {
    return { messageId: "ok" };
  }
  try {
    const parsed = JSON.parse(body);
    return { messageId: extractBlueBubblesMessageId(parsed) };
  } catch {
    return { messageId: "ok" };
  }
}
async function sendMessageBlueBubbles(to, text, opts = {}) {
  const trimmedText = text ?? "";
  if (!trimmedText.trim()) {
    throw new Error("BlueBubbles send requires text");
  }
  const strippedText = stripMarkdown(trimmedText);
  if (!strippedText.trim()) {
    throw new Error("BlueBubbles send requires text (message was empty after markdown removal)");
  }
  const account = resolveBlueBubblesAccount({
    cfg: opts.cfg ?? {},
    accountId: opts.accountId
  });
  const baseUrl = normalizeSecretInputString(opts.serverUrl) || normalizeSecretInputString(account.config.serverUrl);
  const password = normalizeSecretInputString(opts.password) || normalizeSecretInputString(account.config.password);
  if (!baseUrl) {
    throw new Error("BlueBubbles serverUrl is required");
  }
  if (!password) {
    throw new Error("BlueBubbles password is required");
  }
  const privateApiStatus = getCachedBlueBubblesPrivateApiStatus(account.accountId);
  const target = resolveBlueBubblesSendTarget(to);
  const chatGuid = await resolveChatGuidForTarget({
    baseUrl,
    password,
    timeoutMs: opts.timeoutMs,
    target
  });
  if (!chatGuid) {
    if (target.kind === "handle") {
      return createNewChatWithMessage({
        baseUrl,
        password,
        address: target.address,
        message: strippedText,
        timeoutMs: opts.timeoutMs
      });
    }
    throw new Error(
      "BlueBubbles send failed: chatGuid not found for target. Use a chat_guid target or ensure the chat exists."
    );
  }
  const effectId = resolveEffectId(opts.effectId);
  const wantsReplyThread = Boolean(opts.replyToMessageGuid?.trim());
  const wantsEffect = Boolean(effectId);
  const privateApiDecision = resolvePrivateApiDecision({
    privateApiStatus,
    wantsReplyThread,
    wantsEffect
  });
  if (privateApiDecision.throwEffectDisabledError) {
    throw new Error(
      "BlueBubbles send failed: reply/effect requires Private API, but it is disabled on the BlueBubbles server."
    );
  }
  if (privateApiDecision.warningMessage) {
    warnBlueBubbles(privateApiDecision.warningMessage);
  }
  const payload = {
    chatGuid,
    tempGuid: crypto.randomUUID(),
    message: strippedText
  };
  if (privateApiDecision.canUsePrivateApi) {
    payload.method = "private-api";
  }
  if (wantsReplyThread && privateApiDecision.canUsePrivateApi) {
    payload.selectedMessageGuid = opts.replyToMessageGuid;
    payload.partIndex = typeof opts.replyToPartIndex === "number" ? opts.replyToPartIndex : 0;
  }
  if (effectId && privateApiDecision.canUsePrivateApi) {
    payload.effectId = effectId;
  }
  const url = buildBlueBubblesApiUrl({
    baseUrl,
    path: "/api/v1/message/text",
    password
  });
  const res = await blueBubblesFetchWithTimeout(
    url,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    },
    opts.timeoutMs
  );
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`BlueBubbles send failed (${res.status}): ${errorText || "unknown"}`);
  }
  const body = await res.text();
  if (!body) {
    return { messageId: "ok" };
  }
  try {
    const parsed = JSON.parse(body);
    return { messageId: extractBlueBubblesMessageId(parsed) };
  } catch {
    return { messageId: "ok" };
  }
}

// vendor/openclaw-runtime/win-x64/extensions/bluebubbles/src/attachments.ts
var DEFAULT_ATTACHMENT_MAX_BYTES = 8 * 1024 * 1024;
var AUDIO_MIME_MP3 = /* @__PURE__ */ new Set(["audio/mpeg", "audio/mp3"]);
var AUDIO_MIME_CAF = /* @__PURE__ */ new Set(["audio/x-caf", "audio/caf"]);
function sanitizeFilename(input, fallback) {
  const trimmed = input?.trim() ?? "";
  const base = trimmed ? path.basename(trimmed) : "";
  const name = base || fallback;
  return name.replace(/[\r\n"\\]/g, "_");
}
function ensureExtension(filename, extension, fallbackBase) {
  const currentExt = path.extname(filename);
  if (currentExt.toLowerCase() === extension) {
    return filename;
  }
  const base = currentExt ? filename.slice(0, -currentExt.length) : filename;
  return `${base || fallbackBase}${extension}`;
}
function resolveVoiceInfo(filename, contentType) {
  const normalizedType = contentType?.trim().toLowerCase();
  const extension = path.extname(filename).toLowerCase();
  const isMp3 = extension === ".mp3" || (normalizedType ? AUDIO_MIME_MP3.has(normalizedType) : false);
  const isCaf = extension === ".caf" || (normalizedType ? AUDIO_MIME_CAF.has(normalizedType) : false);
  const isAudio = isMp3 || isCaf || Boolean(normalizedType?.startsWith("audio/"));
  return { isAudio, isMp3, isCaf };
}
function resolveAccount(params) {
  return resolveBlueBubblesServerAccount(params);
}
function safeExtractHostname(url) {
  try {
    const hostname = new URL(url).hostname.trim();
    return hostname || void 0;
  } catch {
    return void 0;
  }
}
function readMediaFetchErrorCode(error) {
  if (!error || typeof error !== "object") {
    return void 0;
  }
  const code = error.code;
  return code === "max_bytes" || code === "http_error" || code === "fetch_failed" ? code : void 0;
}
async function downloadBlueBubblesAttachment(attachment, opts = {}) {
  const guid = attachment.guid?.trim();
  if (!guid) {
    throw new Error("BlueBubbles attachment guid is required");
  }
  const { baseUrl, password, allowPrivateNetwork } = resolveAccount(opts);
  const url = buildBlueBubblesApiUrl({
    baseUrl,
    path: `/api/v1/attachment/${encodeURIComponent(guid)}/download`,
    password
  });
  const maxBytes = typeof opts.maxBytes === "number" ? opts.maxBytes : DEFAULT_ATTACHMENT_MAX_BYTES;
  const trustedHostname = safeExtractHostname(baseUrl);
  try {
    const fetched = await getBlueBubblesRuntime().channel.media.fetchRemoteMedia({
      url,
      filePathHint: attachment.transferName ?? attachment.guid ?? "attachment",
      maxBytes,
      ssrfPolicy: allowPrivateNetwork ? { allowPrivateNetwork: true } : trustedHostname ? { allowedHostnames: [trustedHostname] } : void 0,
      fetchImpl: async (input, init) => await blueBubblesFetchWithTimeout(
        resolveRequestUrl(input),
        { ...init, method: init?.method ?? "GET" },
        opts.timeoutMs
      )
    });
    return {
      buffer: new Uint8Array(fetched.buffer),
      contentType: fetched.contentType ?? attachment.mimeType ?? void 0
    };
  } catch (error) {
    if (readMediaFetchErrorCode(error) === "max_bytes") {
      throw new Error(`BlueBubbles attachment too large (limit ${maxBytes} bytes)`);
    }
    const text = error instanceof Error ? error.message : String(error);
    throw new Error(`BlueBubbles attachment download failed: ${text}`);
  }
}
async function sendBlueBubblesAttachment(params) {
  const { to, caption, replyToMessageGuid, replyToPartIndex, asVoice, opts = {} } = params;
  let { buffer, filename, contentType } = params;
  const wantsVoice = asVoice === true;
  const fallbackName = wantsVoice ? "Audio Message" : "attachment";
  filename = sanitizeFilename(filename, fallbackName);
  contentType = contentType?.trim() || void 0;
  const { baseUrl, password, accountId } = resolveAccount(opts);
  const privateApiStatus = getCachedBlueBubblesPrivateApiStatus(accountId);
  const privateApiEnabled = isBlueBubblesPrivateApiStatusEnabled(privateApiStatus);
  const isAudioMessage = wantsVoice;
  if (isAudioMessage) {
    const voiceInfo = resolveVoiceInfo(filename, contentType);
    if (!voiceInfo.isAudio) {
      throw new Error("BlueBubbles voice messages require audio media (mp3 or caf).");
    }
    if (voiceInfo.isMp3) {
      filename = ensureExtension(filename, ".mp3", fallbackName);
      contentType = contentType ?? "audio/mpeg";
    } else if (voiceInfo.isCaf) {
      filename = ensureExtension(filename, ".caf", fallbackName);
      contentType = contentType ?? "audio/x-caf";
    } else {
      throw new Error(
        "BlueBubbles voice messages require mp3 or caf audio (convert before sending)."
      );
    }
  }
  const target = resolveBlueBubblesSendTarget(to);
  const chatGuid = await resolveChatGuidForTarget({
    baseUrl,
    password,
    timeoutMs: opts.timeoutMs,
    target
  });
  if (!chatGuid) {
    throw new Error(
      "BlueBubbles attachment send failed: chatGuid not found for target. Use a chat_guid target or ensure the chat exists."
    );
  }
  const url = buildBlueBubblesApiUrl({
    baseUrl,
    path: "/api/v1/message/attachment",
    password
  });
  const boundary = `----BlueBubblesFormBoundary${crypto2.randomUUID().replace(/-/g, "")}`;
  const parts = [];
  const encoder = new TextEncoder();
  const addField = (name, value) => {
    parts.push(encoder.encode(`--${boundary}\r
`));
    parts.push(encoder.encode(`Content-Disposition: form-data; name="${name}"\r
\r
`));
    parts.push(encoder.encode(`${value}\r
`));
  };
  const addFile = (name, fileBuffer, fileName, mimeType) => {
    parts.push(encoder.encode(`--${boundary}\r
`));
    parts.push(
      encoder.encode(`Content-Disposition: form-data; name="${name}"; filename="${fileName}"\r
`)
    );
    parts.push(encoder.encode(`Content-Type: ${mimeType ?? "application/octet-stream"}\r
\r
`));
    parts.push(fileBuffer);
    parts.push(encoder.encode("\r\n"));
  };
  addFile("attachment", buffer, filename, contentType);
  addField("chatGuid", chatGuid);
  addField("name", filename);
  addField("tempGuid", `temp-${Date.now()}-${crypto2.randomUUID().slice(0, 8)}`);
  if (privateApiEnabled) {
    addField("method", "private-api");
  }
  if (isAudioMessage) {
    addField("isAudioMessage", "true");
  }
  const trimmedReplyTo = replyToMessageGuid?.trim();
  if (trimmedReplyTo && privateApiEnabled) {
    addField("selectedMessageGuid", trimmedReplyTo);
    addField("partIndex", typeof replyToPartIndex === "number" ? String(replyToPartIndex) : "0");
  } else if (trimmedReplyTo && privateApiStatus === null) {
    warnBlueBubbles(
      "Private API status unknown; sending attachment without reply threading metadata. Run a status probe to restore private-api reply features."
    );
  }
  if (caption) {
    addField("message", caption);
    addField("text", caption);
    addField("caption", caption);
  }
  parts.push(encoder.encode(`--${boundary}--\r
`));
  const res = await postMultipartFormData({
    url,
    boundary,
    parts,
    timeoutMs: opts.timeoutMs ?? 6e4
    // longer timeout for file uploads
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(
      `BlueBubbles attachment send failed (${res.status}): ${errorText || "unknown"}`
    );
  }
  const responseBody = await res.text();
  if (!responseBody) {
    return { messageId: "ok" };
  }
  try {
    const parsed = JSON.parse(responseBody);
    return { messageId: extractBlueBubblesMessageId(parsed) };
  } catch {
    return { messageId: "ok" };
  }
}

// vendor/openclaw-runtime/win-x64/extensions/bluebubbles/src/chat.ts
import crypto3 from "crypto";
import path2 from "path";
function resolveAccount2(params) {
  return resolveBlueBubblesServerAccount(params);
}
function assertPrivateApiEnabled(accountId, feature) {
  if (getCachedBlueBubblesPrivateApiStatus(accountId) === false) {
    throw new Error(
      `BlueBubbles ${feature} requires Private API, but it is disabled on the BlueBubbles server.`
    );
  }
}
function resolvePartIndex(partIndex) {
  return typeof partIndex === "number" ? partIndex : 0;
}
async function sendPrivateApiJsonRequest(params) {
  const { baseUrl, password, accountId } = resolveAccount2(params.opts);
  assertPrivateApiEnabled(accountId, params.feature);
  const url = buildBlueBubblesApiUrl({
    baseUrl,
    path: params.path,
    password
  });
  const request = { method: params.method };
  if (params.payload !== void 0) {
    request.headers = { "Content-Type": "application/json" };
    request.body = JSON.stringify(params.payload);
  }
  const res = await blueBubblesFetchWithTimeout(url, request, params.opts.timeoutMs);
  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    throw new Error(
      `BlueBubbles ${params.action} failed (${res.status}): ${errorText || "unknown"}`
    );
  }
}
async function markBlueBubblesChatRead(chatGuid, opts = {}) {
  const trimmed = chatGuid.trim();
  if (!trimmed) {
    return;
  }
  const { baseUrl, password, accountId } = resolveAccount2(opts);
  if (getCachedBlueBubblesPrivateApiStatus(accountId) === false) {
    return;
  }
  const url = buildBlueBubblesApiUrl({
    baseUrl,
    path: `/api/v1/chat/${encodeURIComponent(trimmed)}/read`,
    password
  });
  const res = await blueBubblesFetchWithTimeout(url, { method: "POST" }, opts.timeoutMs);
  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    throw new Error(`BlueBubbles read failed (${res.status}): ${errorText || "unknown"}`);
  }
}
async function sendBlueBubblesTyping(chatGuid, typing, opts = {}) {
  const trimmed = chatGuid.trim();
  if (!trimmed) {
    return;
  }
  const { baseUrl, password, accountId } = resolveAccount2(opts);
  if (getCachedBlueBubblesPrivateApiStatus(accountId) === false) {
    return;
  }
  const url = buildBlueBubblesApiUrl({
    baseUrl,
    path: `/api/v1/chat/${encodeURIComponent(trimmed)}/typing`,
    password
  });
  const res = await blueBubblesFetchWithTimeout(
    url,
    { method: typing ? "POST" : "DELETE" },
    opts.timeoutMs
  );
  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    throw new Error(`BlueBubbles typing failed (${res.status}): ${errorText || "unknown"}`);
  }
}
async function editBlueBubblesMessage(messageGuid, newText, opts = {}) {
  const trimmedGuid = messageGuid.trim();
  if (!trimmedGuid) {
    throw new Error("BlueBubbles edit requires messageGuid");
  }
  const trimmedText = newText.trim();
  if (!trimmedText) {
    throw new Error("BlueBubbles edit requires newText");
  }
  await sendPrivateApiJsonRequest({
    opts,
    feature: "edit",
    action: "edit",
    method: "POST",
    path: `/api/v1/message/${encodeURIComponent(trimmedGuid)}/edit`,
    payload: {
      editedMessage: trimmedText,
      backwardsCompatibilityMessage: opts.backwardsCompatMessage ?? `Edited to: ${trimmedText}`,
      partIndex: resolvePartIndex(opts.partIndex)
    }
  });
}
async function unsendBlueBubblesMessage(messageGuid, opts = {}) {
  const trimmedGuid = messageGuid.trim();
  if (!trimmedGuid) {
    throw new Error("BlueBubbles unsend requires messageGuid");
  }
  await sendPrivateApiJsonRequest({
    opts,
    feature: "unsend",
    action: "unsend",
    method: "POST",
    path: `/api/v1/message/${encodeURIComponent(trimmedGuid)}/unsend`,
    payload: { partIndex: resolvePartIndex(opts.partIndex) }
  });
}
async function renameBlueBubblesChat(chatGuid, displayName, opts = {}) {
  const trimmedGuid = chatGuid.trim();
  if (!trimmedGuid) {
    throw new Error("BlueBubbles rename requires chatGuid");
  }
  await sendPrivateApiJsonRequest({
    opts,
    feature: "renameGroup",
    action: "rename",
    method: "PUT",
    path: `/api/v1/chat/${encodeURIComponent(trimmedGuid)}`,
    payload: { displayName }
  });
}
async function addBlueBubblesParticipant(chatGuid, address, opts = {}) {
  const trimmedGuid = chatGuid.trim();
  if (!trimmedGuid) {
    throw new Error("BlueBubbles addParticipant requires chatGuid");
  }
  const trimmedAddress = address.trim();
  if (!trimmedAddress) {
    throw new Error("BlueBubbles addParticipant requires address");
  }
  await sendPrivateApiJsonRequest({
    opts,
    feature: "addParticipant",
    action: "addParticipant",
    method: "POST",
    path: `/api/v1/chat/${encodeURIComponent(trimmedGuid)}/participant`,
    payload: { address: trimmedAddress }
  });
}
async function removeBlueBubblesParticipant(chatGuid, address, opts = {}) {
  const trimmedGuid = chatGuid.trim();
  if (!trimmedGuid) {
    throw new Error("BlueBubbles removeParticipant requires chatGuid");
  }
  const trimmedAddress = address.trim();
  if (!trimmedAddress) {
    throw new Error("BlueBubbles removeParticipant requires address");
  }
  await sendPrivateApiJsonRequest({
    opts,
    feature: "removeParticipant",
    action: "removeParticipant",
    method: "DELETE",
    path: `/api/v1/chat/${encodeURIComponent(trimmedGuid)}/participant`,
    payload: { address: trimmedAddress }
  });
}
async function leaveBlueBubblesChat(chatGuid, opts = {}) {
  const trimmedGuid = chatGuid.trim();
  if (!trimmedGuid) {
    throw new Error("BlueBubbles leaveChat requires chatGuid");
  }
  await sendPrivateApiJsonRequest({
    opts,
    feature: "leaveGroup",
    action: "leaveChat",
    method: "POST",
    path: `/api/v1/chat/${encodeURIComponent(trimmedGuid)}/leave`
  });
}
async function setGroupIconBlueBubbles(chatGuid, buffer, filename, opts = {}) {
  const trimmedGuid = chatGuid.trim();
  if (!trimmedGuid) {
    throw new Error("BlueBubbles setGroupIcon requires chatGuid");
  }
  if (!buffer || buffer.length === 0) {
    throw new Error("BlueBubbles setGroupIcon requires image buffer");
  }
  const { baseUrl, password, accountId } = resolveAccount2(opts);
  assertPrivateApiEnabled(accountId, "setGroupIcon");
  const url = buildBlueBubblesApiUrl({
    baseUrl,
    path: `/api/v1/chat/${encodeURIComponent(trimmedGuid)}/icon`,
    password
  });
  const boundary = `----BlueBubblesFormBoundary${crypto3.randomUUID().replace(/-/g, "")}`;
  const parts = [];
  const encoder = new TextEncoder();
  const safeFilename = path2.basename(filename).replace(/[\r\n"\\]/g, "_") || "icon.png";
  parts.push(encoder.encode(`--${boundary}\r
`));
  parts.push(
    encoder.encode(`Content-Disposition: form-data; name="icon"; filename="${safeFilename}"\r
`)
  );
  parts.push(
    encoder.encode(`Content-Type: ${opts.contentType ?? "application/octet-stream"}\r
\r
`)
  );
  parts.push(buffer);
  parts.push(encoder.encode("\r\n"));
  parts.push(encoder.encode(`--${boundary}--\r
`));
  const res = await postMultipartFormData({
    url,
    boundary,
    parts,
    timeoutMs: opts.timeoutMs ?? 6e4
    // longer timeout for file uploads
  });
  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    throw new Error(`BlueBubbles setGroupIcon failed (${res.status}): ${errorText || "unknown"}`);
  }
}

// vendor/openclaw-runtime/win-x64/extensions/bluebubbles/src/monitor.ts
import { timingSafeEqual } from "crypto";
import {
  beginWebhookRequestPipelineOrReject,
  createWebhookInFlightLimiter,
  registerWebhookTargetWithPluginRoute,
  readWebhookBodyOrReject,
  resolveWebhookTargetWithAuthOrRejectSync,
  resolveWebhookTargets
} from "openclaw/plugin-sdk";

// vendor/openclaw-runtime/win-x64/extensions/bluebubbles/src/monitor-debounce.ts
var DEFAULT_INBOUND_DEBOUNCE_MS = 500;
function combineDebounceEntries(entries) {
  if (entries.length === 0) {
    throw new Error("Cannot combine empty entries");
  }
  if (entries.length === 1) {
    return entries[0].message;
  }
  const first = entries[0].message;
  const seenTexts = /* @__PURE__ */ new Set();
  const textParts = [];
  for (const entry of entries) {
    const text = entry.message.text.trim();
    if (!text) {
      continue;
    }
    const normalizedText = text.toLowerCase();
    if (seenTexts.has(normalizedText)) {
      continue;
    }
    seenTexts.add(normalizedText);
    textParts.push(text);
  }
  const allAttachments = entries.flatMap((e) => e.message.attachments ?? []);
  const timestamps = entries.map((e) => e.message.timestamp).filter((t) => typeof t === "number");
  const latestTimestamp = timestamps.length > 0 ? Math.max(...timestamps) : first.timestamp;
  const messageIds = entries.map((e) => e.message.messageId).filter((id) => Boolean(id));
  const entryWithReply = entries.find((e) => e.message.replyToId);
  return {
    ...first,
    text: textParts.join(" "),
    attachments: allAttachments.length > 0 ? allAttachments : first.attachments,
    timestamp: latestTimestamp,
    // Use first message's ID as primary (for reply reference), but we've coalesced others
    messageId: messageIds[0] ?? first.messageId,
    // Preserve reply context if present
    replyToId: entryWithReply?.message.replyToId ?? first.replyToId,
    replyToBody: entryWithReply?.message.replyToBody ?? first.replyToBody,
    replyToSender: entryWithReply?.message.replyToSender ?? first.replyToSender,
    // Clear balloonBundleId since we've combined (the combined message is no longer just a balloon)
    balloonBundleId: void 0
  };
}
function resolveBlueBubblesDebounceMs(config, core) {
  const inbound = config.messages?.inbound;
  const hasExplicitDebounce = typeof inbound?.debounceMs === "number" || typeof inbound?.byChannel?.bluebubbles === "number";
  if (!hasExplicitDebounce) {
    return DEFAULT_INBOUND_DEBOUNCE_MS;
  }
  return core.channel.debounce.resolveInboundDebounceMs({ cfg: config, channel: "bluebubbles" });
}
function createBlueBubblesDebounceRegistry(params) {
  const targetDebouncers = /* @__PURE__ */ new Map();
  return {
    getOrCreateDebouncer: (target) => {
      const existing = targetDebouncers.get(target);
      if (existing) {
        return existing;
      }
      const { account, config, runtime: runtime2, core } = target;
      const debouncer = core.channel.debounce.createInboundDebouncer({
        debounceMs: resolveBlueBubblesDebounceMs(config, core),
        buildKey: (entry) => {
          const msg = entry.message;
          const balloonBundleId = msg.balloonBundleId?.trim();
          const associatedMessageGuid = msg.associatedMessageGuid?.trim();
          if (balloonBundleId && associatedMessageGuid) {
            return `bluebubbles:${account.accountId}:balloon:${associatedMessageGuid}`;
          }
          const messageId = msg.messageId?.trim();
          if (messageId) {
            return `bluebubbles:${account.accountId}:msg:${messageId}`;
          }
          const chatKey = msg.chatGuid?.trim() ?? msg.chatIdentifier?.trim() ?? (msg.chatId ? String(msg.chatId) : "dm");
          return `bluebubbles:${account.accountId}:${chatKey}:${msg.senderId}`;
        },
        shouldDebounce: (entry) => {
          const msg = entry.message;
          if (msg.fromMe) {
            return false;
          }
          if (core.channel.text.hasControlCommand(msg.text, config)) {
            return false;
          }
          return true;
        },
        onFlush: async (entries) => {
          if (entries.length === 0) {
            return;
          }
          const flushTarget = entries[0].target;
          if (entries.length === 1) {
            await params.processMessage(entries[0].message, flushTarget);
            return;
          }
          const combined = combineDebounceEntries(entries);
          if (core.logging.shouldLogVerbose()) {
            const count = entries.length;
            const preview = combined.text.slice(0, 50);
            runtime2.log?.(
              `[bluebubbles] coalesced ${count} messages: "${preview}${combined.text.length > 50 ? "..." : ""}"`
            );
          }
          await params.processMessage(combined, flushTarget);
        },
        onError: (err) => {
          runtime2.error?.(
            `[${account.accountId}] [bluebubbles] debounce flush failed: ${String(err)}`
          );
        }
      });
      targetDebouncers.set(target, debouncer);
      return debouncer;
    },
    removeDebouncer: (target) => {
      targetDebouncers.delete(target);
    }
  };
}

// vendor/openclaw-runtime/win-x64/extensions/bluebubbles/src/monitor-normalize.ts
function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}
function readString(record, key) {
  if (!record) {
    return void 0;
  }
  const value = record[key];
  return typeof value === "string" ? value : void 0;
}
function readNumber(record, key) {
  if (!record) {
    return void 0;
  }
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : void 0;
}
function readBoolean(record, key) {
  if (!record) {
    return void 0;
  }
  const value = record[key];
  return typeof value === "boolean" ? value : void 0;
}
function readNumberLike(record, key) {
  if (!record) {
    return void 0;
  }
  const value = record[key];
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return void 0;
}
function extractAttachments(message) {
  const raw = message["attachments"];
  if (!Array.isArray(raw)) {
    return [];
  }
  const out = [];
  for (const entry of raw) {
    const record = asRecord(entry);
    if (!record) {
      continue;
    }
    out.push({
      guid: readString(record, "guid"),
      uti: readString(record, "uti"),
      mimeType: readString(record, "mimeType") ?? readString(record, "mime_type"),
      transferName: readString(record, "transferName") ?? readString(record, "transfer_name"),
      totalBytes: readNumberLike(record, "totalBytes") ?? readNumberLike(record, "total_bytes"),
      height: readNumberLike(record, "height"),
      width: readNumberLike(record, "width"),
      originalROWID: readNumberLike(record, "originalROWID") ?? readNumberLike(record, "rowid")
    });
  }
  return out;
}
function buildAttachmentPlaceholder(attachments) {
  if (attachments.length === 0) {
    return "";
  }
  const mimeTypes = attachments.map((entry) => entry.mimeType ?? "");
  const allImages = mimeTypes.every((entry) => entry.startsWith("image/"));
  const allVideos = mimeTypes.every((entry) => entry.startsWith("video/"));
  const allAudio = mimeTypes.every((entry) => entry.startsWith("audio/"));
  const tag = allImages ? "<media:image>" : allVideos ? "<media:video>" : allAudio ? "<media:audio>" : "<media:attachment>";
  const label = allImages ? "image" : allVideos ? "video" : allAudio ? "audio" : "file";
  const suffix = attachments.length === 1 ? label : `${label}s`;
  return `${tag} (${attachments.length} ${suffix})`;
}
function buildMessagePlaceholder(message) {
  const attachmentPlaceholder = buildAttachmentPlaceholder(message.attachments ?? []);
  if (attachmentPlaceholder) {
    return attachmentPlaceholder;
  }
  if (message.balloonBundleId) {
    return "<media:sticker>";
  }
  return "";
}
function formatReplyTag(message) {
  const rawId = message.replyToShortId || message.replyToId;
  if (!rawId) {
    return null;
  }
  return `[[reply_to:${rawId}]]`;
}
function extractReplyMetadata(message) {
  const replyRaw = message["replyTo"] ?? message["reply_to"] ?? message["replyToMessage"] ?? message["reply_to_message"] ?? message["repliedMessage"] ?? message["quotedMessage"] ?? message["associatedMessage"] ?? message["reply"];
  const replyRecord = asRecord(replyRaw);
  const replyHandle = asRecord(replyRecord?.["handle"]) ?? asRecord(replyRecord?.["sender"]) ?? null;
  const replySenderRaw = readString(replyHandle, "address") ?? readString(replyHandle, "handle") ?? readString(replyHandle, "id") ?? readString(replyRecord, "senderId") ?? readString(replyRecord, "sender") ?? readString(replyRecord, "from");
  const normalizedSender = replySenderRaw ? normalizeBlueBubblesHandle(replySenderRaw) || replySenderRaw.trim() : void 0;
  const replyToBody = readString(replyRecord, "text") ?? readString(replyRecord, "body") ?? readString(replyRecord, "message") ?? readString(replyRecord, "subject") ?? void 0;
  const directReplyId = readString(message, "replyToMessageGuid") ?? readString(message, "replyToGuid") ?? readString(message, "replyGuid") ?? readString(message, "selectedMessageGuid") ?? readString(message, "selectedMessageId") ?? readString(message, "replyToMessageId") ?? readString(message, "replyId") ?? readString(replyRecord, "guid") ?? readString(replyRecord, "id") ?? readString(replyRecord, "messageId");
  const associatedType = readNumberLike(message, "associatedMessageType") ?? readNumberLike(message, "associated_message_type");
  const associatedGuid = readString(message, "associatedMessageGuid") ?? readString(message, "associated_message_guid") ?? readString(message, "associatedMessageId");
  const isReactionAssociation = typeof associatedType === "number" && REACTION_TYPE_MAP.has(associatedType);
  const replyToId = directReplyId ?? (!isReactionAssociation ? associatedGuid : void 0);
  const threadOriginatorGuid = readString(message, "threadOriginatorGuid");
  const messageGuid = readString(message, "guid");
  const fallbackReplyId = !replyToId && threadOriginatorGuid && threadOriginatorGuid !== messageGuid ? threadOriginatorGuid : void 0;
  return {
    replyToId: (replyToId ?? fallbackReplyId)?.trim() || void 0,
    replyToBody: replyToBody?.trim() || void 0,
    replyToSender: normalizedSender || void 0
  };
}
function readFirstChatRecord(message) {
  const chats = message["chats"];
  if (!Array.isArray(chats) || chats.length === 0) {
    return null;
  }
  const first = chats[0];
  return asRecord(first);
}
function extractSenderInfo(message) {
  const handleValue = message.handle ?? message.sender;
  const handle = asRecord(handleValue) ?? (typeof handleValue === "string" ? { address: handleValue } : null);
  const senderId = readString(handle, "address") ?? readString(handle, "handle") ?? readString(handle, "id") ?? readString(message, "senderId") ?? readString(message, "sender") ?? readString(message, "from") ?? "";
  const senderName = readString(handle, "displayName") ?? readString(handle, "name") ?? readString(message, "senderName") ?? void 0;
  return { senderId, senderName };
}
function extractChatContext(message) {
  const chat = asRecord(message.chat) ?? asRecord(message.conversation) ?? null;
  const chatFromList = readFirstChatRecord(message);
  const chatGuid = readString(message, "chatGuid") ?? readString(message, "chat_guid") ?? readString(chat, "chatGuid") ?? readString(chat, "chat_guid") ?? readString(chat, "guid") ?? readString(chatFromList, "chatGuid") ?? readString(chatFromList, "chat_guid") ?? readString(chatFromList, "guid");
  const chatIdentifier = readString(message, "chatIdentifier") ?? readString(message, "chat_identifier") ?? readString(chat, "chatIdentifier") ?? readString(chat, "chat_identifier") ?? readString(chat, "identifier") ?? readString(chatFromList, "chatIdentifier") ?? readString(chatFromList, "chat_identifier") ?? readString(chatFromList, "identifier") ?? extractChatIdentifierFromChatGuid2(chatGuid);
  const chatId = readNumberLike(message, "chatId") ?? readNumberLike(message, "chat_id") ?? readNumberLike(chat, "chatId") ?? readNumberLike(chat, "chat_id") ?? readNumberLike(chat, "id") ?? readNumberLike(chatFromList, "chatId") ?? readNumberLike(chatFromList, "chat_id") ?? readNumberLike(chatFromList, "id");
  const chatName = readString(message, "chatName") ?? readString(chat, "displayName") ?? readString(chat, "name") ?? readString(chatFromList, "displayName") ?? readString(chatFromList, "name") ?? void 0;
  const chatParticipants = chat ? chat["participants"] : void 0;
  const messageParticipants = message["participants"];
  const chatsParticipants = chatFromList ? chatFromList["participants"] : void 0;
  const participants = Array.isArray(chatParticipants) ? chatParticipants : Array.isArray(messageParticipants) ? messageParticipants : Array.isArray(chatsParticipants) ? chatsParticipants : [];
  const participantsCount = participants.length;
  const groupFromChatGuid = resolveGroupFlagFromChatGuid(chatGuid);
  const explicitIsGroup = readBoolean(message, "isGroup") ?? readBoolean(message, "is_group") ?? readBoolean(chat, "isGroup") ?? readBoolean(message, "group");
  const isGroup = typeof groupFromChatGuid === "boolean" ? groupFromChatGuid : explicitIsGroup ?? participantsCount > 2;
  return {
    chatGuid,
    chatIdentifier,
    chatId,
    chatName,
    isGroup,
    participants
  };
}
function normalizeParticipantEntry(entry) {
  if (typeof entry === "string" || typeof entry === "number") {
    const raw = String(entry).trim();
    if (!raw) {
      return null;
    }
    const normalized = normalizeBlueBubblesHandle(raw) || raw;
    return normalized ? { id: normalized } : null;
  }
  const record = asRecord(entry);
  if (!record) {
    return null;
  }
  const nestedHandle = asRecord(record["handle"]) ?? asRecord(record["sender"]) ?? asRecord(record["contact"]) ?? null;
  const idRaw = readString(record, "address") ?? readString(record, "handle") ?? readString(record, "id") ?? readString(record, "phoneNumber") ?? readString(record, "phone_number") ?? readString(record, "email") ?? readString(nestedHandle, "address") ?? readString(nestedHandle, "handle") ?? readString(nestedHandle, "id");
  const nameRaw = readString(record, "displayName") ?? readString(record, "name") ?? readString(record, "title") ?? readString(nestedHandle, "displayName") ?? readString(nestedHandle, "name");
  const normalizedId = idRaw ? normalizeBlueBubblesHandle(idRaw) || idRaw.trim() : "";
  if (!normalizedId) {
    return null;
  }
  const name = nameRaw?.trim() || void 0;
  return { id: normalizedId, name };
}
function normalizeParticipantList(raw) {
  if (!Array.isArray(raw) || raw.length === 0) {
    return [];
  }
  const seen = /* @__PURE__ */ new Set();
  const output = [];
  for (const entry of raw) {
    const normalized = normalizeParticipantEntry(entry);
    if (!normalized?.id) {
      continue;
    }
    const key = normalized.id.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    output.push(normalized);
  }
  return output;
}
function formatGroupMembers(params) {
  const seen = /* @__PURE__ */ new Set();
  const ordered = [];
  for (const entry of params.participants ?? []) {
    if (!entry?.id) {
      continue;
    }
    const key = entry.id.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    ordered.push(entry);
  }
  if (ordered.length === 0 && params.fallback?.id) {
    ordered.push(params.fallback);
  }
  if (ordered.length === 0) {
    return void 0;
  }
  return ordered.map((entry) => entry.name ? `${entry.name} (${entry.id})` : entry.id).join(", ");
}
function resolveGroupFlagFromChatGuid(chatGuid) {
  const guid = chatGuid?.trim();
  if (!guid) {
    return void 0;
  }
  const parts = guid.split(";");
  if (parts.length >= 3) {
    if (parts[1] === "+") {
      return true;
    }
    if (parts[1] === "-") {
      return false;
    }
  }
  if (guid.includes(";+;")) {
    return true;
  }
  if (guid.includes(";-;")) {
    return false;
  }
  return void 0;
}
function extractChatIdentifierFromChatGuid2(chatGuid) {
  const guid = chatGuid?.trim();
  if (!guid) {
    return void 0;
  }
  const parts = guid.split(";");
  if (parts.length < 3) {
    return void 0;
  }
  const identifier = parts[2]?.trim();
  return identifier || void 0;
}
function formatGroupAllowlistEntry(params) {
  const guid = params.chatGuid?.trim();
  if (guid) {
    return `chat_guid:${guid}`;
  }
  const chatId = params.chatId;
  if (typeof chatId === "number" && Number.isFinite(chatId)) {
    return `chat_id:${chatId}`;
  }
  const identifier = params.chatIdentifier?.trim();
  if (identifier) {
    return `chat_identifier:${identifier}`;
  }
  return null;
}
var REACTION_TYPE_MAP = /* @__PURE__ */ new Map([
  [2e3, { emoji: "\u2764\uFE0F", action: "added" }],
  [2001, { emoji: "\u{1F44D}", action: "added" }],
  [2002, { emoji: "\u{1F44E}", action: "added" }],
  [2003, { emoji: "\u{1F602}", action: "added" }],
  [2004, { emoji: "\u203C\uFE0F", action: "added" }],
  [2005, { emoji: "\u2753", action: "added" }],
  [3e3, { emoji: "\u2764\uFE0F", action: "removed" }],
  [3001, { emoji: "\u{1F44D}", action: "removed" }],
  [3002, { emoji: "\u{1F44E}", action: "removed" }],
  [3003, { emoji: "\u{1F602}", action: "removed" }],
  [3004, { emoji: "\u203C\uFE0F", action: "removed" }],
  [3005, { emoji: "\u2753", action: "removed" }]
]);
var TAPBACK_TEXT_MAP = /* @__PURE__ */ new Map([
  ["loved", { emoji: "\u2764\uFE0F", action: "added" }],
  ["liked", { emoji: "\u{1F44D}", action: "added" }],
  ["disliked", { emoji: "\u{1F44E}", action: "added" }],
  ["laughed at", { emoji: "\u{1F602}", action: "added" }],
  ["emphasized", { emoji: "\u203C\uFE0F", action: "added" }],
  ["questioned", { emoji: "\u2753", action: "added" }],
  // Removal patterns (e.g., "Removed a heart from")
  ["removed a heart from", { emoji: "\u2764\uFE0F", action: "removed" }],
  ["removed a like from", { emoji: "\u{1F44D}", action: "removed" }],
  ["removed a dislike from", { emoji: "\u{1F44E}", action: "removed" }],
  ["removed a laugh from", { emoji: "\u{1F602}", action: "removed" }],
  ["removed an emphasis from", { emoji: "\u203C\uFE0F", action: "removed" }],
  ["removed a question from", { emoji: "\u2753", action: "removed" }]
]);
var TAPBACK_EMOJI_REGEX = /(?:\p{Regional_Indicator}{2})|(?:[0-9#*]\uFE0F?\u20E3)|(?:\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?(?:\p{Emoji_Modifier})?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?(?:\p{Emoji_Modifier})?)*)/u;
function extractFirstEmoji(text) {
  const match = text.match(TAPBACK_EMOJI_REGEX);
  return match ? match[0] : null;
}
function extractQuotedTapbackText(text) {
  const match = text.match(/[“"]([^”"]+)[”"]/s);
  return match ? match[1] : null;
}
function isTapbackAssociatedType(type) {
  return typeof type === "number" && Number.isFinite(type) && type >= 2e3 && type < 4e3;
}
function resolveTapbackActionHint(type) {
  if (typeof type !== "number" || !Number.isFinite(type)) {
    return void 0;
  }
  if (type >= 3e3 && type < 4e3) {
    return "removed";
  }
  if (type >= 2e3 && type < 3e3) {
    return "added";
  }
  return void 0;
}
function resolveTapbackContext(message) {
  const associatedType = message.associatedMessageType;
  const hasTapbackType = isTapbackAssociatedType(associatedType);
  const hasTapbackMarker = Boolean(message.associatedMessageEmoji) || Boolean(message.isTapback);
  if (!hasTapbackType && !hasTapbackMarker) {
    return null;
  }
  const replyToId = message.associatedMessageGuid?.trim() || message.replyToId?.trim() || void 0;
  const actionHint = resolveTapbackActionHint(associatedType);
  const emojiHint = message.associatedMessageEmoji?.trim() || REACTION_TYPE_MAP.get(associatedType ?? -1)?.emoji;
  return { emojiHint, actionHint, replyToId };
}
function parseTapbackText(params) {
  const trimmed = params.text.trim();
  const lower = trimmed.toLowerCase();
  if (!trimmed) {
    return null;
  }
  for (const [pattern, { emoji, action }] of TAPBACK_TEXT_MAP) {
    if (lower.startsWith(pattern)) {
      const afterPattern = trimmed.slice(pattern.length).trim();
      if (params.requireQuoted) {
        const strictMatch = afterPattern.match(/^[“"](.+)[”"]$/s);
        if (!strictMatch) {
          return null;
        }
        return { emoji, action, quotedText: strictMatch[1] };
      }
      const quotedText = extractQuotedTapbackText(afterPattern) ?? extractQuotedTapbackText(trimmed) ?? afterPattern;
      return { emoji, action, quotedText };
    }
  }
  if (lower.startsWith("reacted")) {
    const emoji = extractFirstEmoji(trimmed) ?? params.emojiHint;
    if (!emoji) {
      return null;
    }
    const quotedText = extractQuotedTapbackText(trimmed);
    if (params.requireQuoted && !quotedText) {
      return null;
    }
    const fallback = trimmed.slice("reacted".length).trim();
    return { emoji, action: params.actionHint ?? "added", quotedText: quotedText ?? fallback };
  }
  if (lower.startsWith("removed")) {
    const emoji = extractFirstEmoji(trimmed) ?? params.emojiHint;
    if (!emoji) {
      return null;
    }
    const quotedText = extractQuotedTapbackText(trimmed);
    if (params.requireQuoted && !quotedText) {
      return null;
    }
    const fallback = trimmed.slice("removed".length).trim();
    return { emoji, action: params.actionHint ?? "removed", quotedText: quotedText ?? fallback };
  }
  return null;
}
function extractMessagePayload(payload) {
  const parseRecord = (value) => {
    const record = asRecord(value);
    if (record) {
      return record;
    }
    if (Array.isArray(value)) {
      for (const entry of value) {
        const parsedEntry = parseRecord(entry);
        if (parsedEntry) {
          return parsedEntry;
        }
      }
      return null;
    }
    if (typeof value !== "string") {
      return null;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    try {
      return parseRecord(JSON.parse(trimmed));
    } catch {
      return null;
    }
  };
  const dataRaw = payload.data ?? payload.payload ?? payload.event;
  const data = parseRecord(dataRaw);
  const messageRaw = payload.message ?? data?.message ?? data;
  const message = parseRecord(messageRaw);
  if (message) {
    return message;
  }
  return null;
}
function normalizeWebhookMessage(payload) {
  const message = extractMessagePayload(payload);
  if (!message) {
    return null;
  }
  const text = readString(message, "text") ?? readString(message, "body") ?? readString(message, "subject") ?? "";
  const { senderId, senderName } = extractSenderInfo(message);
  const { chatGuid, chatIdentifier, chatId, chatName, isGroup, participants } = extractChatContext(message);
  const normalizedParticipants = normalizeParticipantList(participants);
  const fromMe = readBoolean(message, "isFromMe") ?? readBoolean(message, "is_from_me");
  const messageId = readString(message, "guid") ?? readString(message, "id") ?? readString(message, "messageId") ?? void 0;
  const balloonBundleId = readString(message, "balloonBundleId");
  const associatedMessageGuid = readString(message, "associatedMessageGuid") ?? readString(message, "associated_message_guid") ?? readString(message, "associatedMessageId") ?? void 0;
  const associatedMessageType = readNumberLike(message, "associatedMessageType") ?? readNumberLike(message, "associated_message_type");
  const associatedMessageEmoji = readString(message, "associatedMessageEmoji") ?? readString(message, "associated_message_emoji") ?? readString(message, "reactionEmoji") ?? readString(message, "reaction_emoji") ?? void 0;
  const isTapback = readBoolean(message, "isTapback") ?? readBoolean(message, "is_tapback") ?? readBoolean(message, "tapback") ?? void 0;
  const timestampRaw = readNumber(message, "date") ?? readNumber(message, "dateCreated") ?? readNumber(message, "timestamp");
  const timestamp = typeof timestampRaw === "number" ? timestampRaw > 1e12 ? timestampRaw : timestampRaw * 1e3 : void 0;
  const senderFallbackFromChatGuid = !senderId && !isGroup && chatGuid ? extractHandleFromChatGuid(chatGuid) : null;
  const normalizedSender = normalizeBlueBubblesHandle(senderId || senderFallbackFromChatGuid || "");
  if (!normalizedSender) {
    return null;
  }
  const replyMetadata = extractReplyMetadata(message);
  return {
    text,
    senderId: normalizedSender,
    senderName,
    messageId,
    timestamp,
    isGroup,
    chatId,
    chatGuid,
    chatIdentifier,
    chatName,
    fromMe,
    attachments: extractAttachments(message),
    balloonBundleId,
    associatedMessageGuid,
    associatedMessageType,
    associatedMessageEmoji,
    isTapback,
    participants: normalizedParticipants,
    replyToId: replyMetadata.replyToId,
    replyToBody: replyMetadata.replyToBody,
    replyToSender: replyMetadata.replyToSender
  };
}
function normalizeWebhookReaction(payload) {
  const message = extractMessagePayload(payload);
  if (!message) {
    return null;
  }
  const associatedGuid = readString(message, "associatedMessageGuid") ?? readString(message, "associated_message_guid") ?? readString(message, "associatedMessageId");
  const associatedType = readNumberLike(message, "associatedMessageType") ?? readNumberLike(message, "associated_message_type");
  if (!associatedGuid || associatedType === void 0) {
    return null;
  }
  const mapping = REACTION_TYPE_MAP.get(associatedType);
  const associatedEmoji = readString(message, "associatedMessageEmoji") ?? readString(message, "associated_message_emoji") ?? readString(message, "reactionEmoji") ?? readString(message, "reaction_emoji");
  const emoji = (associatedEmoji?.trim() || mapping?.emoji) ?? `reaction:${associatedType}`;
  const action = mapping?.action ?? resolveTapbackActionHint(associatedType) ?? "added";
  const { senderId, senderName } = extractSenderInfo(message);
  const { chatGuid, chatIdentifier, chatId, chatName, isGroup } = extractChatContext(message);
  const fromMe = readBoolean(message, "isFromMe") ?? readBoolean(message, "is_from_me");
  const timestampRaw = readNumberLike(message, "date") ?? readNumberLike(message, "dateCreated") ?? readNumberLike(message, "timestamp");
  const timestamp = typeof timestampRaw === "number" ? timestampRaw > 1e12 ? timestampRaw : timestampRaw * 1e3 : void 0;
  const senderFallbackFromChatGuid = !senderId && !isGroup && chatGuid ? extractHandleFromChatGuid(chatGuid) : null;
  const normalizedSender = normalizeBlueBubblesHandle(senderId || senderFallbackFromChatGuid || "");
  if (!normalizedSender) {
    return null;
  }
  return {
    action,
    emoji,
    senderId: normalizedSender,
    senderName,
    messageId: associatedGuid,
    timestamp,
    isGroup,
    chatId,
    chatGuid,
    chatIdentifier,
    chatName,
    fromMe
  };
}

// vendor/openclaw-runtime/win-x64/extensions/bluebubbles/src/monitor-processing.ts
import {
  DM_GROUP_ACCESS_REASON,
  createScopedPairingAccess,
  createReplyPrefixOptions,
  evictOldHistoryKeys,
  logAckFailure,
  logInboundDrop,
  logTypingFailure,
  readStoreAllowFromForDmPolicy,
  recordPendingHistoryEntryIfEnabled,
  resolveAckReaction,
  resolveDmGroupAccessWithLists,
  resolveControlCommandGate,
  stripMarkdown as stripMarkdown2
} from "openclaw/plugin-sdk";

// vendor/openclaw-runtime/win-x64/extensions/bluebubbles/src/history.ts
function resolveAccount3(params) {
  return resolveBlueBubblesServerAccount(params);
}
var MAX_HISTORY_FETCH_LIMIT = 100;
var HISTORY_SCAN_MULTIPLIER = 8;
var MAX_HISTORY_SCAN_MESSAGES = 500;
var MAX_HISTORY_BODY_CHARS = 2e3;
function clampHistoryLimit(limit) {
  if (!Number.isFinite(limit)) {
    return 0;
  }
  const normalized = Math.floor(limit);
  if (normalized <= 0) {
    return 0;
  }
  return Math.min(normalized, MAX_HISTORY_FETCH_LIMIT);
}
function truncateHistoryBody(text) {
  if (text.length <= MAX_HISTORY_BODY_CHARS) {
    return text;
  }
  return `${text.slice(0, MAX_HISTORY_BODY_CHARS).trimEnd()}...`;
}
async function fetchBlueBubblesHistory(chatIdentifier, limit, opts = {}) {
  const effectiveLimit = clampHistoryLimit(limit);
  if (!chatIdentifier.trim() || effectiveLimit <= 0) {
    return { entries: [], resolved: true };
  }
  let baseUrl;
  let password;
  try {
    ({ baseUrl, password } = resolveAccount3(opts));
  } catch {
    return { entries: [], resolved: false };
  }
  const possiblePaths = [
    `/api/v1/chat/${encodeURIComponent(chatIdentifier)}/messages?limit=${effectiveLimit}&sort=DESC`,
    `/api/v1/messages?chatGuid=${encodeURIComponent(chatIdentifier)}&limit=${effectiveLimit}`,
    `/api/v1/chat/${encodeURIComponent(chatIdentifier)}/message?limit=${effectiveLimit}`
  ];
  for (const path4 of possiblePaths) {
    try {
      const url = buildBlueBubblesApiUrl({ baseUrl, path: path4, password });
      const res = await blueBubblesFetchWithTimeout(
        url,
        { method: "GET" },
        opts.timeoutMs ?? 1e4
      );
      if (!res.ok) {
        continue;
      }
      const data = await res.json().catch(() => null);
      if (!data) {
        continue;
      }
      let messages = [];
      if (Array.isArray(data)) {
        messages = data;
      } else if (data.data && Array.isArray(data.data)) {
        messages = data.data;
      } else if (data.messages && Array.isArray(data.messages)) {
        messages = data.messages;
      } else {
        continue;
      }
      const historyEntries = [];
      const maxScannedMessages = Math.min(
        Math.max(effectiveLimit * HISTORY_SCAN_MULTIPLIER, effectiveLimit),
        MAX_HISTORY_SCAN_MESSAGES
      );
      for (let i = 0; i < messages.length && i < maxScannedMessages; i++) {
        const item = messages[i];
        const msg = item;
        const text = msg.text?.trim();
        if (!text) {
          continue;
        }
        const sender = msg.is_from_me ? "me" : msg.sender?.display_name || msg.sender?.address || msg.handle_id || "Unknown";
        const timestamp = msg.date_created || msg.date_delivered;
        historyEntries.push({
          sender,
          body: truncateHistoryBody(text),
          timestamp,
          messageId: msg.guid
        });
      }
      historyEntries.sort((a, b) => {
        const aTime = a.timestamp || 0;
        const bTime = b.timestamp || 0;
        return aTime - bTime;
      });
      return {
        entries: historyEntries.slice(0, effectiveLimit),
        // Ensure we don't exceed the requested limit
        resolved: true
      };
    } catch (error) {
      continue;
    }
  }
  return { entries: [], resolved: false };
}

// vendor/openclaw-runtime/win-x64/extensions/bluebubbles/src/media-send.ts
import { constants as fsConstants } from "fs";
import fs from "fs/promises";
import os from "os";
import path3 from "path";
import { fileURLToPath } from "url";
import { resolveChannelMediaMaxBytes } from "openclaw/plugin-sdk";
var HTTP_URL_RE = /^https?:\/\//i;
var MB = 1024 * 1024;
function assertMediaWithinLimit(sizeBytes, maxBytes) {
  if (typeof maxBytes !== "number" || maxBytes <= 0) {
    return;
  }
  if (sizeBytes <= maxBytes) {
    return;
  }
  const maxLabel = (maxBytes / MB).toFixed(0);
  const sizeLabel = (sizeBytes / MB).toFixed(2);
  throw new Error(`Media exceeds ${maxLabel}MB limit (got ${sizeLabel}MB)`);
}
function resolveLocalMediaPath(source) {
  if (!source.startsWith("file://")) {
    return source;
  }
  try {
    return fileURLToPath(source);
  } catch {
    throw new Error(`Invalid file:// URL: ${source}`);
  }
}
function expandHomePath(input) {
  if (input === "~") {
    return os.homedir();
  }
  if (input.startsWith("~/") || input.startsWith(`~${path3.sep}`)) {
    return path3.join(os.homedir(), input.slice(2));
  }
  return input;
}
function resolveConfiguredPath(input) {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("Empty mediaLocalRoots entry is not allowed");
  }
  if (trimmed.startsWith("file://")) {
    let parsed;
    try {
      parsed = fileURLToPath(trimmed);
    } catch {
      throw new Error(`Invalid file:// URL in mediaLocalRoots: ${input}`);
    }
    if (!path3.isAbsolute(parsed)) {
      throw new Error(`mediaLocalRoots entries must be absolute paths: ${input}`);
    }
    return parsed;
  }
  const resolved = expandHomePath(trimmed);
  if (!path3.isAbsolute(resolved)) {
    throw new Error(`mediaLocalRoots entries must be absolute paths: ${input}`);
  }
  return resolved;
}
function isPathInsideRoot(candidate, root) {
  const normalizedCandidate = path3.normalize(candidate);
  const normalizedRoot = path3.normalize(root);
  const rootWithSep = normalizedRoot.endsWith(path3.sep) ? normalizedRoot : normalizedRoot + path3.sep;
  if (process.platform === "win32") {
    const candidateLower = normalizedCandidate.toLowerCase();
    const rootLower = normalizedRoot.toLowerCase();
    const rootWithSepLower = rootWithSep.toLowerCase();
    return candidateLower === rootLower || candidateLower.startsWith(rootWithSepLower);
  }
  return normalizedCandidate === normalizedRoot || normalizedCandidate.startsWith(rootWithSep);
}
function resolveMediaLocalRoots(params) {
  const account = resolveBlueBubblesAccount({
    cfg: params.cfg,
    accountId: params.accountId
  });
  return (account.config.mediaLocalRoots ?? []).map((entry) => entry.trim()).filter((entry) => entry.length > 0);
}
async function assertLocalMediaPathAllowed(params) {
  if (params.localRoots.length === 0) {
    throw new Error(
      `Local BlueBubbles media paths are disabled by default. Set channels.bluebubbles.mediaLocalRoots${params.accountId ? ` or channels.bluebubbles.accounts.${params.accountId}.mediaLocalRoots` : ""} to explicitly allow local file directories.`
    );
  }
  const resolvedLocalPath = path3.resolve(params.localPath);
  const supportsNoFollow = process.platform !== "win32" && "O_NOFOLLOW" in fsConstants;
  const openFlags = fsConstants.O_RDONLY | (supportsNoFollow ? fsConstants.O_NOFOLLOW : 0);
  for (const rootEntry of params.localRoots) {
    const resolvedRootInput = resolveConfiguredPath(rootEntry);
    const relativeToRoot = path3.relative(resolvedRootInput, resolvedLocalPath);
    if (relativeToRoot.startsWith("..") || path3.isAbsolute(relativeToRoot) || relativeToRoot === "") {
      continue;
    }
    let rootReal;
    try {
      rootReal = await fs.realpath(resolvedRootInput);
    } catch {
      rootReal = path3.resolve(resolvedRootInput);
    }
    const candidatePath = path3.resolve(rootReal, relativeToRoot);
    if (!isPathInsideRoot(candidatePath, rootReal)) {
      continue;
    }
    let handle = null;
    try {
      handle = await fs.open(candidatePath, openFlags);
      const realPath = await fs.realpath(candidatePath);
      if (!isPathInsideRoot(realPath, rootReal)) {
        continue;
      }
      const stat = await handle.stat();
      if (!stat.isFile()) {
        continue;
      }
      const realStat = await fs.stat(realPath);
      if (stat.ino !== realStat.ino || stat.dev !== realStat.dev) {
        continue;
      }
      const data = await handle.readFile();
      return { data, realPath, sizeBytes: stat.size };
    } catch {
      continue;
    } finally {
      if (handle) {
        await handle.close().catch(() => {
        });
      }
    }
  }
  throw new Error(
    `Local media path is not under any configured mediaLocalRoots entry: ${params.localPath}`
  );
}
function resolveFilenameFromSource(source) {
  if (!source) {
    return void 0;
  }
  if (source.startsWith("file://")) {
    try {
      return path3.basename(fileURLToPath(source)) || void 0;
    } catch {
      return void 0;
    }
  }
  if (HTTP_URL_RE.test(source)) {
    try {
      return path3.basename(new URL(source).pathname) || void 0;
    } catch {
      return void 0;
    }
  }
  const base = path3.basename(source);
  return base || void 0;
}
async function sendBlueBubblesMedia(params) {
  const {
    cfg,
    to,
    mediaUrl,
    mediaPath,
    mediaBuffer,
    contentType,
    filename,
    caption,
    replyToId,
    accountId,
    asVoice
  } = params;
  const core = getBlueBubblesRuntime();
  const maxBytes = resolveChannelMediaMaxBytes({
    cfg,
    resolveChannelLimitMb: ({ cfg: cfg2, accountId: accountId2 }) => cfg2.channels?.bluebubbles?.accounts?.[accountId2]?.mediaMaxMb ?? cfg2.channels?.bluebubbles?.mediaMaxMb,
    accountId
  });
  const mediaLocalRoots = resolveMediaLocalRoots({ cfg, accountId });
  let buffer;
  let resolvedContentType = contentType ?? void 0;
  let resolvedFilename = filename ?? void 0;
  if (mediaBuffer) {
    assertMediaWithinLimit(mediaBuffer.byteLength, maxBytes);
    buffer = mediaBuffer;
    if (!resolvedContentType) {
      const hint = mediaPath ?? mediaUrl;
      const detected = await core.media.detectMime({
        buffer: Buffer.isBuffer(mediaBuffer) ? mediaBuffer : Buffer.from(mediaBuffer),
        filePath: hint
      });
      resolvedContentType = detected ?? void 0;
    }
    if (!resolvedFilename) {
      resolvedFilename = resolveFilenameFromSource(mediaPath ?? mediaUrl);
    }
  } else {
    const source = mediaPath ?? mediaUrl;
    if (!source) {
      throw new Error("BlueBubbles media delivery requires mediaUrl, mediaPath, or mediaBuffer.");
    }
    if (HTTP_URL_RE.test(source)) {
      const fetched = await core.channel.media.fetchRemoteMedia({
        url: source,
        maxBytes: typeof maxBytes === "number" && maxBytes > 0 ? maxBytes : void 0
      });
      buffer = fetched.buffer;
      resolvedContentType = resolvedContentType ?? fetched.contentType ?? void 0;
      resolvedFilename = resolvedFilename ?? fetched.fileName;
    } else {
      const localPath = expandHomePath(resolveLocalMediaPath(source));
      const localFile = await assertLocalMediaPathAllowed({
        localPath,
        localRoots: mediaLocalRoots,
        accountId
      });
      if (typeof maxBytes === "number" && maxBytes > 0) {
        assertMediaWithinLimit(localFile.sizeBytes, maxBytes);
      }
      const data = localFile.data;
      assertMediaWithinLimit(data.byteLength, maxBytes);
      buffer = new Uint8Array(data);
      if (!resolvedContentType) {
        const detected = await core.media.detectMime({
          buffer: data,
          filePath: localFile.realPath
        });
        resolvedContentType = detected ?? void 0;
      }
      if (!resolvedFilename) {
        resolvedFilename = resolveFilenameFromSource(localFile.realPath);
      }
    }
  }
  const replyToMessageGuid = replyToId?.trim() ? resolveBlueBubblesMessageId(replyToId.trim(), { requireKnownShortId: true }) : void 0;
  const attachmentResult = await sendBlueBubblesAttachment({
    to,
    buffer,
    filename: resolvedFilename ?? "attachment",
    contentType: resolvedContentType ?? void 0,
    replyToMessageGuid,
    asVoice,
    opts: {
      cfg,
      accountId
    }
  });
  const trimmedCaption = caption?.trim();
  if (trimmedCaption) {
    await sendMessageBlueBubbles(to, trimmedCaption, {
      cfg,
      accountId,
      replyToMessageGuid
    });
  }
  return attachmentResult;
}

// vendor/openclaw-runtime/win-x64/extensions/bluebubbles/src/monitor-reply-cache.ts
var REPLY_CACHE_MAX = 2e3;
var REPLY_CACHE_TTL_MS = 6 * 60 * 60 * 1e3;
var blueBubblesReplyCacheByMessageId = /* @__PURE__ */ new Map();
var blueBubblesShortIdToUuid = /* @__PURE__ */ new Map();
var blueBubblesUuidToShortId = /* @__PURE__ */ new Map();
var blueBubblesShortIdCounter = 0;
function trimOrUndefined(value) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : void 0;
}
function generateShortId() {
  blueBubblesShortIdCounter += 1;
  return String(blueBubblesShortIdCounter);
}
function rememberBlueBubblesReplyCache(entry) {
  const messageId = entry.messageId.trim();
  if (!messageId) {
    return { ...entry, shortId: "" };
  }
  let shortId = blueBubblesUuidToShortId.get(messageId);
  if (!shortId) {
    shortId = generateShortId();
    blueBubblesShortIdToUuid.set(shortId, messageId);
    blueBubblesUuidToShortId.set(messageId, shortId);
  }
  const fullEntry = { ...entry, messageId, shortId };
  blueBubblesReplyCacheByMessageId.delete(messageId);
  blueBubblesReplyCacheByMessageId.set(messageId, fullEntry);
  const cutoff = Date.now() - REPLY_CACHE_TTL_MS;
  for (const [key, value] of blueBubblesReplyCacheByMessageId) {
    if (value.timestamp < cutoff) {
      blueBubblesReplyCacheByMessageId.delete(key);
      if (value.shortId) {
        blueBubblesShortIdToUuid.delete(value.shortId);
        blueBubblesUuidToShortId.delete(key);
      }
      continue;
    }
    break;
  }
  while (blueBubblesReplyCacheByMessageId.size > REPLY_CACHE_MAX) {
    const oldest = blueBubblesReplyCacheByMessageId.keys().next().value;
    if (!oldest) {
      break;
    }
    const oldEntry = blueBubblesReplyCacheByMessageId.get(oldest);
    blueBubblesReplyCacheByMessageId.delete(oldest);
    if (oldEntry?.shortId) {
      blueBubblesShortIdToUuid.delete(oldEntry.shortId);
      blueBubblesUuidToShortId.delete(oldest);
    }
  }
  return fullEntry;
}
function resolveBlueBubblesMessageId(shortOrUuid, opts) {
  const trimmed = shortOrUuid.trim();
  if (!trimmed) {
    return trimmed;
  }
  if (/^\d+$/.test(trimmed)) {
    const uuid = blueBubblesShortIdToUuid.get(trimmed);
    if (uuid) {
      return uuid;
    }
    if (opts?.requireKnownShortId) {
      throw new Error(
        `BlueBubbles short message id "${trimmed}" is no longer available. Use MessageSidFull.`
      );
    }
  }
  return trimmed;
}
function getShortIdForUuid(uuid) {
  return blueBubblesUuidToShortId.get(uuid.trim());
}
function resolveReplyContextFromCache(params) {
  const replyToId = params.replyToId.trim();
  if (!replyToId) {
    return null;
  }
  const cached = blueBubblesReplyCacheByMessageId.get(replyToId);
  if (!cached) {
    return null;
  }
  if (cached.accountId !== params.accountId) {
    return null;
  }
  const cutoff = Date.now() - REPLY_CACHE_TTL_MS;
  if (cached.timestamp < cutoff) {
    blueBubblesReplyCacheByMessageId.delete(replyToId);
    return null;
  }
  const chatGuid = trimOrUndefined(params.chatGuid);
  const chatIdentifier = trimOrUndefined(params.chatIdentifier);
  const cachedChatGuid = trimOrUndefined(cached.chatGuid);
  const cachedChatIdentifier = trimOrUndefined(cached.chatIdentifier);
  const chatId = typeof params.chatId === "number" ? params.chatId : void 0;
  const cachedChatId = typeof cached.chatId === "number" ? cached.chatId : void 0;
  if (chatGuid && cachedChatGuid && chatGuid !== cachedChatGuid) {
    return null;
  }
  if (!chatGuid && chatIdentifier && cachedChatIdentifier && chatIdentifier !== cachedChatIdentifier) {
    return null;
  }
  if (!chatGuid && !chatIdentifier && chatId && cachedChatId && chatId !== cachedChatId) {
    return null;
  }
  return cached;
}

// vendor/openclaw-runtime/win-x64/extensions/bluebubbles/src/reactions.ts
var REACTION_TYPES = /* @__PURE__ */ new Set(["love", "like", "dislike", "laugh", "emphasize", "question"]);
var REACTION_ALIASES = /* @__PURE__ */ new Map([
  // General
  ["heart", "love"],
  ["love", "love"],
  ["\u2764", "love"],
  ["\u2764\uFE0F", "love"],
  ["red_heart", "love"],
  ["thumbs_up", "like"],
  ["thumbsup", "like"],
  ["thumbs-up", "like"],
  ["thumbsup", "like"],
  ["like", "like"],
  ["thumb", "like"],
  ["ok", "like"],
  ["thumbs_down", "dislike"],
  ["thumbsdown", "dislike"],
  ["thumbs-down", "dislike"],
  ["dislike", "dislike"],
  ["boo", "dislike"],
  ["no", "dislike"],
  // Laugh
  ["haha", "laugh"],
  ["lol", "laugh"],
  ["lmao", "laugh"],
  ["rofl", "laugh"],
  ["\u{1F602}", "laugh"],
  ["\u{1F923}", "laugh"],
  ["xd", "laugh"],
  ["laugh", "laugh"],
  // Emphasize / exclaim
  ["emphasis", "emphasize"],
  ["emphasize", "emphasize"],
  ["exclaim", "emphasize"],
  ["!!", "emphasize"],
  ["\u203C", "emphasize"],
  ["\u203C\uFE0F", "emphasize"],
  ["\u2757", "emphasize"],
  ["important", "emphasize"],
  ["bang", "emphasize"],
  // Question
  ["question", "question"],
  ["?", "question"],
  ["\u2753", "question"],
  ["\u2754", "question"],
  ["ask", "question"],
  // Apple/Messages names
  ["loved", "love"],
  ["liked", "like"],
  ["disliked", "dislike"],
  ["laughed", "laugh"],
  ["emphasized", "emphasize"],
  ["questioned", "question"],
  // Colloquial / informal
  ["fire", "love"],
  ["\u{1F525}", "love"],
  ["wow", "emphasize"],
  ["!", "emphasize"],
  // Edge: generic emoji name forms
  ["heart_eyes", "love"],
  ["smile", "laugh"],
  ["smiley", "laugh"],
  ["happy", "laugh"],
  ["joy", "laugh"]
]);
var REACTION_EMOJIS = /* @__PURE__ */ new Map([
  // Love
  ["\u2764\uFE0F", "love"],
  ["\u2764", "love"],
  ["\u2665\uFE0F", "love"],
  ["\u2665", "love"],
  ["\u{1F60D}", "love"],
  ["\u{1F495}", "love"],
  // Like
  ["\u{1F44D}", "like"],
  ["\u{1F44C}", "like"],
  // Dislike
  ["\u{1F44E}", "dislike"],
  ["\u{1F645}", "dislike"],
  // Laugh
  ["\u{1F602}", "laugh"],
  ["\u{1F923}", "laugh"],
  ["\u{1F606}", "laugh"],
  ["\u{1F601}", "laugh"],
  ["\u{1F639}", "laugh"],
  // Emphasize
  ["\u203C\uFE0F", "emphasize"],
  ["\u203C", "emphasize"],
  ["!!", "emphasize"],
  ["\u2757", "emphasize"],
  ["\u2755", "emphasize"],
  ["!", "emphasize"],
  // Question
  ["\u2753", "question"],
  ["\u2754", "question"],
  ["?", "question"]
]);
function resolveAccount4(params) {
  return resolveBlueBubblesServerAccount(params);
}
function normalizeBlueBubblesReactionInput(emoji, remove) {
  const trimmed = emoji.trim();
  if (!trimmed) {
    throw new Error("BlueBubbles reaction requires an emoji or name.");
  }
  let raw = trimmed.toLowerCase();
  if (raw.startsWith("-")) {
    raw = raw.slice(1);
  }
  const aliased = REACTION_ALIASES.get(raw) ?? raw;
  const mapped = REACTION_EMOJIS.get(trimmed) ?? REACTION_EMOJIS.get(raw) ?? aliased;
  if (!REACTION_TYPES.has(mapped)) {
    throw new Error(`Unsupported BlueBubbles reaction: ${trimmed}`);
  }
  return remove ? `-${mapped}` : mapped;
}
async function sendBlueBubblesReaction(params) {
  const chatGuid = params.chatGuid.trim();
  const messageGuid = params.messageGuid.trim();
  if (!chatGuid) {
    throw new Error("BlueBubbles reaction requires chatGuid.");
  }
  if (!messageGuid) {
    throw new Error("BlueBubbles reaction requires messageGuid.");
  }
  const reaction = normalizeBlueBubblesReactionInput(params.emoji, params.remove);
  const { baseUrl, password, accountId } = resolveAccount4(params.opts ?? {});
  if (getCachedBlueBubblesPrivateApiStatus(accountId) === false) {
    throw new Error(
      "BlueBubbles reaction requires Private API, but it is disabled on the BlueBubbles server."
    );
  }
  const url = buildBlueBubblesApiUrl({
    baseUrl,
    path: "/api/v1/message/react",
    password
  });
  const payload = {
    chatGuid,
    selectedMessageGuid: messageGuid,
    reaction,
    partIndex: typeof params.partIndex === "number" ? params.partIndex : 0
  };
  const res = await blueBubblesFetchWithTimeout(
    url,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    },
    params.opts?.timeoutMs
  );
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`BlueBubbles reaction failed (${res.status}): ${errorText || "unknown"}`);
  }
}

// vendor/openclaw-runtime/win-x64/extensions/bluebubbles/src/monitor-processing.ts
var DEFAULT_TEXT_LIMIT = 4e3;
var invalidAckReactions = /* @__PURE__ */ new Set();
var REPLY_DIRECTIVE_TAG_RE = /\[\[\s*(?:reply_to_current|reply_to\s*:\s*[^\]\n]+)\s*\]\]/gi;
var PENDING_OUTBOUND_MESSAGE_ID_TTL_MS = 2 * 60 * 1e3;
var pendingOutboundMessageIds = [];
var pendingOutboundMessageIdCounter = 0;
function trimOrUndefined2(value) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : void 0;
}
function normalizeSnippet(value) {
  return stripMarkdown2(value).replace(/\s+/g, " ").trim().toLowerCase();
}
function prunePendingOutboundMessageIds(now = Date.now()) {
  const cutoff = now - PENDING_OUTBOUND_MESSAGE_ID_TTL_MS;
  for (let i = pendingOutboundMessageIds.length - 1; i >= 0; i--) {
    if (pendingOutboundMessageIds[i].createdAt < cutoff) {
      pendingOutboundMessageIds.splice(i, 1);
    }
  }
}
function rememberPendingOutboundMessageId(entry) {
  prunePendingOutboundMessageIds();
  pendingOutboundMessageIdCounter += 1;
  const snippetRaw = entry.snippet.trim();
  const snippetNorm = normalizeSnippet(snippetRaw);
  pendingOutboundMessageIds.push({
    id: pendingOutboundMessageIdCounter,
    accountId: entry.accountId,
    sessionKey: entry.sessionKey,
    outboundTarget: entry.outboundTarget,
    chatGuid: trimOrUndefined2(entry.chatGuid),
    chatIdentifier: trimOrUndefined2(entry.chatIdentifier),
    chatId: typeof entry.chatId === "number" ? entry.chatId : void 0,
    snippetRaw,
    snippetNorm,
    isMediaSnippet: snippetRaw.toLowerCase().startsWith("<media:"),
    createdAt: Date.now()
  });
  return pendingOutboundMessageIdCounter;
}
function forgetPendingOutboundMessageId(id) {
  const index = pendingOutboundMessageIds.findIndex((entry) => entry.id === id);
  if (index >= 0) {
    pendingOutboundMessageIds.splice(index, 1);
  }
}
function chatsMatch(left, right) {
  const leftGuid = trimOrUndefined2(left.chatGuid);
  const rightGuid = trimOrUndefined2(right.chatGuid);
  if (leftGuid && rightGuid) {
    return leftGuid === rightGuid;
  }
  const leftIdentifier = trimOrUndefined2(left.chatIdentifier);
  const rightIdentifier = trimOrUndefined2(right.chatIdentifier);
  if (leftIdentifier && rightIdentifier) {
    return leftIdentifier === rightIdentifier;
  }
  const leftChatId = typeof left.chatId === "number" ? left.chatId : void 0;
  const rightChatId = typeof right.chatId === "number" ? right.chatId : void 0;
  if (leftChatId !== void 0 && rightChatId !== void 0) {
    return leftChatId === rightChatId;
  }
  return false;
}
function consumePendingOutboundMessageId(params) {
  prunePendingOutboundMessageIds();
  const bodyNorm = normalizeSnippet(params.body);
  const isMediaBody = params.body.trim().toLowerCase().startsWith("<media:");
  for (let i = 0; i < pendingOutboundMessageIds.length; i++) {
    const entry = pendingOutboundMessageIds[i];
    if (entry.accountId !== params.accountId) {
      continue;
    }
    if (!chatsMatch(entry, params)) {
      continue;
    }
    if (entry.snippetNorm && entry.snippetNorm === bodyNorm) {
      pendingOutboundMessageIds.splice(i, 1);
      return entry;
    }
    if (entry.isMediaSnippet && isMediaBody) {
      pendingOutboundMessageIds.splice(i, 1);
      return entry;
    }
  }
  return null;
}
function logVerbose(core, runtime2, message) {
  if (core.logging.shouldLogVerbose()) {
    runtime2.log?.(`[bluebubbles] ${message}`);
  }
}
function logGroupAllowlistHint(params) {
  const log = params.runtime.log ?? console.log;
  const nameHint = params.chatName ? ` (group name: ${params.chatName})` : "";
  const accountHint = params.accountId ? ` (or channels.bluebubbles.accounts.${params.accountId}.groupAllowFrom)` : "";
  if (params.entry) {
    log(
      `[bluebubbles] group message blocked (${params.reason}). Allow this group by adding "${params.entry}" to channels.bluebubbles.groupAllowFrom${nameHint}.`
    );
    log(
      `[bluebubbles] add to config: channels.bluebubbles.groupAllowFrom=["${params.entry}"]${accountHint}.`
    );
    return;
  }
  log(
    `[bluebubbles] group message blocked (${params.reason}). Allow groups by setting channels.bluebubbles.groupPolicy="open" or adding a group id to channels.bluebubbles.groupAllowFrom${accountHint}${nameHint}.`
  );
}
function resolveBlueBubblesAckReaction(params) {
  const raw = resolveAckReaction(params.cfg, params.agentId).trim();
  if (!raw) {
    return null;
  }
  try {
    normalizeBlueBubblesReactionInput(raw);
    return raw;
  } catch {
    const key = raw.toLowerCase();
    if (!invalidAckReactions.has(key)) {
      invalidAckReactions.add(key);
      logVerbose(
        params.core,
        params.runtime,
        `ack reaction skipped (unsupported for BlueBubbles): ${raw}`
      );
    }
    return null;
  }
}
var chatHistories = /* @__PURE__ */ new Map();
var historyBackfills = /* @__PURE__ */ new Map();
var HISTORY_BACKFILL_BASE_DELAY_MS = 5e3;
var HISTORY_BACKFILL_MAX_DELAY_MS = 2 * 60 * 1e3;
var HISTORY_BACKFILL_MAX_ATTEMPTS = 6;
var HISTORY_BACKFILL_RETRY_WINDOW_MS = 30 * 60 * 1e3;
var MAX_STORED_HISTORY_ENTRY_CHARS = 2e3;
var MAX_INBOUND_HISTORY_ENTRY_CHARS = 1200;
var MAX_INBOUND_HISTORY_TOTAL_CHARS = 12e3;
function buildAccountScopedHistoryKey(accountId, historyIdentifier) {
  return `${accountId}\0${historyIdentifier}`;
}
function historyDedupKey(entry) {
  const messageId = entry.messageId?.trim();
  if (messageId) {
    return `id:${messageId}`;
  }
  return `fallback:${entry.sender}\0${entry.body}\0${entry.timestamp ?? ""}`;
}
function truncateHistoryBody2(body, maxChars) {
  const trimmed = body.trim();
  if (!trimmed) {
    return "";
  }
  if (trimmed.length <= maxChars) {
    return trimmed;
  }
  return `${trimmed.slice(0, maxChars).trimEnd()}...`;
}
function mergeHistoryEntries(params) {
  if (params.limit <= 0) {
    return [];
  }
  const merged = [];
  const seen = /* @__PURE__ */ new Set();
  const appendUnique = (entry) => {
    const key = historyDedupKey(entry);
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    merged.push(entry);
  };
  for (const entry of params.apiEntries) {
    appendUnique(entry);
  }
  for (const entry of params.currentEntries) {
    appendUnique(entry);
  }
  if (merged.length <= params.limit) {
    return merged;
  }
  return merged.slice(merged.length - params.limit);
}
function pruneHistoryBackfillState() {
  for (const key of historyBackfills.keys()) {
    if (!chatHistories.has(key)) {
      historyBackfills.delete(key);
    }
  }
}
function markHistoryBackfillResolved(historyKey) {
  const state = historyBackfills.get(historyKey);
  if (state) {
    state.resolved = true;
    historyBackfills.set(historyKey, state);
    return;
  }
  historyBackfills.set(historyKey, {
    attempts: 0,
    firstAttemptAt: Date.now(),
    nextAttemptAt: Number.POSITIVE_INFINITY,
    resolved: true
  });
}
function planHistoryBackfillAttempt(historyKey, now) {
  const existing = historyBackfills.get(historyKey);
  if (existing?.resolved) {
    return null;
  }
  if (existing && now - existing.firstAttemptAt > HISTORY_BACKFILL_RETRY_WINDOW_MS) {
    markHistoryBackfillResolved(historyKey);
    return null;
  }
  if (existing && existing.attempts >= HISTORY_BACKFILL_MAX_ATTEMPTS) {
    markHistoryBackfillResolved(historyKey);
    return null;
  }
  if (existing && now < existing.nextAttemptAt) {
    return null;
  }
  const attempts = (existing?.attempts ?? 0) + 1;
  const firstAttemptAt = existing?.firstAttemptAt ?? now;
  const backoffDelay = Math.min(
    HISTORY_BACKFILL_BASE_DELAY_MS * 2 ** (attempts - 1),
    HISTORY_BACKFILL_MAX_DELAY_MS
  );
  const state = {
    attempts,
    firstAttemptAt,
    nextAttemptAt: now + backoffDelay,
    resolved: false
  };
  historyBackfills.set(historyKey, state);
  return state;
}
function buildInboundHistorySnapshot(params) {
  if (params.limit <= 0 || params.entries.length === 0) {
    return void 0;
  }
  const recent = params.entries.slice(-params.limit);
  const selected = [];
  let remainingChars = MAX_INBOUND_HISTORY_TOTAL_CHARS;
  for (let i = recent.length - 1; i >= 0; i--) {
    const entry = recent[i];
    const body = truncateHistoryBody2(entry.body, MAX_INBOUND_HISTORY_ENTRY_CHARS);
    if (!body) {
      continue;
    }
    if (selected.length > 0 && body.length > remainingChars) {
      break;
    }
    selected.push({
      sender: entry.sender,
      body,
      timestamp: entry.timestamp
    });
    remainingChars -= body.length;
    if (remainingChars <= 0) {
      break;
    }
  }
  if (selected.length === 0) {
    return void 0;
  }
  selected.reverse();
  return selected;
}
async function processMessage(message, target) {
  const { account, config, runtime: runtime2, core, statusSink } = target;
  const pairing = createScopedPairingAccess({
    core,
    channel: "bluebubbles",
    accountId: account.accountId
  });
  const privateApiEnabled = isBlueBubblesPrivateApiEnabled(account.accountId);
  const groupFlag = resolveGroupFlagFromChatGuid(message.chatGuid);
  const isGroup = typeof groupFlag === "boolean" ? groupFlag : message.isGroup;
  const text = message.text.trim();
  const attachments = message.attachments ?? [];
  const placeholder = buildMessagePlaceholder(message);
  const tapbackContext = resolveTapbackContext(message);
  const tapbackParsed = parseTapbackText({
    text,
    emojiHint: tapbackContext?.emojiHint,
    actionHint: tapbackContext?.actionHint,
    requireQuoted: !tapbackContext
  });
  const isTapbackMessage = Boolean(tapbackParsed);
  const rawBody = tapbackParsed ? tapbackParsed.action === "removed" ? `removed ${tapbackParsed.emoji} reaction` : `reacted with ${tapbackParsed.emoji}` : text || placeholder;
  const cacheMessageId = message.messageId?.trim();
  let messageShortId;
  const cacheInboundMessage = () => {
    if (!cacheMessageId) {
      return;
    }
    const cacheEntry = rememberBlueBubblesReplyCache({
      accountId: account.accountId,
      messageId: cacheMessageId,
      chatGuid: message.chatGuid,
      chatIdentifier: message.chatIdentifier,
      chatId: message.chatId,
      senderLabel: message.fromMe ? "me" : message.senderId,
      body: rawBody,
      timestamp: message.timestamp ?? Date.now()
    });
    messageShortId = cacheEntry.shortId;
  };
  if (message.fromMe) {
    cacheInboundMessage();
    if (cacheMessageId) {
      const pending = consumePendingOutboundMessageId({
        accountId: account.accountId,
        chatGuid: message.chatGuid,
        chatIdentifier: message.chatIdentifier,
        chatId: message.chatId,
        body: rawBody
      });
      if (pending) {
        const displayId = getShortIdForUuid(cacheMessageId) || cacheMessageId;
        const previewSource = pending.snippetRaw || rawBody;
        const preview = previewSource ? ` "${previewSource.slice(0, 12)}${previewSource.length > 12 ? "\u2026" : ""}"` : "";
        core.system.enqueueSystemEvent(`Assistant sent${preview} [message_id:${displayId}]`, {
          sessionKey: pending.sessionKey,
          contextKey: `bluebubbles:outbound:${pending.outboundTarget}:${cacheMessageId}`
        });
      }
    }
    return;
  }
  if (!rawBody) {
    logVerbose(core, runtime2, `drop: empty text sender=${message.senderId}`);
    return;
  }
  logVerbose(
    core,
    runtime2,
    `msg sender=${message.senderId} group=${isGroup} textLen=${text.length} attachments=${attachments.length} chatGuid=${message.chatGuid ?? ""} chatId=${message.chatId ?? ""}`
  );
  const dmPolicy2 = account.config.dmPolicy ?? "pairing";
  const groupPolicy = account.config.groupPolicy ?? "allowlist";
  const configuredAllowFrom = (account.config.allowFrom ?? []).map((entry) => String(entry));
  const storeAllowFrom = await readStoreAllowFromForDmPolicy({
    provider: "bluebubbles",
    accountId: account.accountId,
    dmPolicy: dmPolicy2,
    readStore: pairing.readStoreForDmPolicy
  });
  const accessDecision = resolveDmGroupAccessWithLists({
    isGroup,
    dmPolicy: dmPolicy2,
    groupPolicy,
    allowFrom: configuredAllowFrom,
    groupAllowFrom: account.config.groupAllowFrom,
    storeAllowFrom,
    isSenderAllowed: (allowFrom) => isAllowedBlueBubblesSender({
      allowFrom,
      sender: message.senderId,
      chatId: message.chatId ?? void 0,
      chatGuid: message.chatGuid ?? void 0,
      chatIdentifier: message.chatIdentifier ?? void 0
    })
  });
  const effectiveAllowFrom = accessDecision.effectiveAllowFrom;
  const effectiveGroupAllowFrom = accessDecision.effectiveGroupAllowFrom;
  const groupAllowEntry = formatGroupAllowlistEntry({
    chatGuid: message.chatGuid,
    chatId: message.chatId ?? void 0,
    chatIdentifier: message.chatIdentifier ?? void 0
  });
  const groupName = message.chatName?.trim() || void 0;
  if (accessDecision.decision !== "allow") {
    if (isGroup) {
      if (accessDecision.reasonCode === DM_GROUP_ACCESS_REASON.GROUP_POLICY_DISABLED) {
        logVerbose(core, runtime2, "Blocked BlueBubbles group message (groupPolicy=disabled)");
        logGroupAllowlistHint({
          runtime: runtime2,
          reason: "groupPolicy=disabled",
          entry: groupAllowEntry,
          chatName: groupName,
          accountId: account.accountId
        });
        return;
      }
      if (accessDecision.reasonCode === DM_GROUP_ACCESS_REASON.GROUP_POLICY_EMPTY_ALLOWLIST) {
        logVerbose(core, runtime2, "Blocked BlueBubbles group message (no allowlist)");
        logGroupAllowlistHint({
          runtime: runtime2,
          reason: "groupPolicy=allowlist (empty allowlist)",
          entry: groupAllowEntry,
          chatName: groupName,
          accountId: account.accountId
        });
        return;
      }
      if (accessDecision.reasonCode === DM_GROUP_ACCESS_REASON.GROUP_POLICY_NOT_ALLOWLISTED) {
        logVerbose(
          core,
          runtime2,
          `Blocked BlueBubbles sender ${message.senderId} (not in groupAllowFrom)`
        );
        logVerbose(
          core,
          runtime2,
          `drop: group sender not allowed sender=${message.senderId} allowFrom=${effectiveGroupAllowFrom.join(",")}`
        );
        logGroupAllowlistHint({
          runtime: runtime2,
          reason: "groupPolicy=allowlist (not allowlisted)",
          entry: groupAllowEntry,
          chatName: groupName,
          accountId: account.accountId
        });
        return;
      }
      return;
    }
    if (accessDecision.reasonCode === DM_GROUP_ACCESS_REASON.DM_POLICY_DISABLED) {
      logVerbose(core, runtime2, `Blocked BlueBubbles DM from ${message.senderId}`);
      logVerbose(core, runtime2, `drop: dmPolicy disabled sender=${message.senderId}`);
      return;
    }
    if (accessDecision.decision === "pairing") {
      const { code, created } = await pairing.upsertPairingRequest({
        id: message.senderId,
        meta: { name: message.senderName }
      });
      runtime2.log?.(`[bluebubbles] pairing request sender=${message.senderId} created=${created}`);
      if (created) {
        logVerbose(core, runtime2, `bluebubbles pairing request sender=${message.senderId}`);
        try {
          await sendMessageBlueBubbles(
            message.senderId,
            core.channel.pairing.buildPairingReply({
              channel: "bluebubbles",
              idLine: `Your BlueBubbles sender id: ${message.senderId}`,
              code
            }),
            { cfg: config, accountId: account.accountId }
          );
          statusSink?.({ lastOutboundAt: Date.now() });
        } catch (err) {
          logVerbose(
            core,
            runtime2,
            `bluebubbles pairing reply failed for ${message.senderId}: ${String(err)}`
          );
          runtime2.error?.(
            `[bluebubbles] pairing reply failed sender=${message.senderId}: ${String(err)}`
          );
        }
      }
      return;
    }
    logVerbose(
      core,
      runtime2,
      `Blocked unauthorized BlueBubbles sender ${message.senderId} (dmPolicy=${dmPolicy2})`
    );
    logVerbose(
      core,
      runtime2,
      `drop: dm sender not allowed sender=${message.senderId} allowFrom=${effectiveAllowFrom.join(",")}`
    );
    return;
  }
  const chatId = message.chatId ?? void 0;
  const chatGuid = message.chatGuid ?? void 0;
  const chatIdentifier = message.chatIdentifier ?? void 0;
  const peerId = isGroup ? chatGuid ?? chatIdentifier ?? (chatId ? String(chatId) : "group") : message.senderId;
  const route = core.channel.routing.resolveAgentRoute({
    cfg: config,
    channel: "bluebubbles",
    accountId: account.accountId,
    peer: {
      kind: isGroup ? "group" : "direct",
      id: peerId
    }
  });
  const messageText = text;
  const mentionRegexes = core.channel.mentions.buildMentionRegexes(config, route.agentId);
  const wasMentioned = isGroup ? core.channel.mentions.matchesMentionPatterns(messageText, mentionRegexes) : true;
  const canDetectMention = mentionRegexes.length > 0;
  const requireMention = core.channel.groups.resolveRequireMention({
    cfg: config,
    channel: "bluebubbles",
    groupId: peerId,
    accountId: account.accountId
  });
  const useAccessGroups = config.commands?.useAccessGroups !== false;
  const hasControlCmd = core.channel.text.hasControlCommand(messageText, config);
  const commandDmAllowFrom = isGroup ? configuredAllowFrom : effectiveAllowFrom;
  const ownerAllowedForCommands = commandDmAllowFrom.length > 0 ? isAllowedBlueBubblesSender({
    allowFrom: commandDmAllowFrom,
    sender: message.senderId,
    chatId: message.chatId ?? void 0,
    chatGuid: message.chatGuid ?? void 0,
    chatIdentifier: message.chatIdentifier ?? void 0
  }) : false;
  const groupAllowedForCommands = effectiveGroupAllowFrom.length > 0 ? isAllowedBlueBubblesSender({
    allowFrom: effectiveGroupAllowFrom,
    sender: message.senderId,
    chatId: message.chatId ?? void 0,
    chatGuid: message.chatGuid ?? void 0,
    chatIdentifier: message.chatIdentifier ?? void 0
  }) : false;
  const commandGate = resolveControlCommandGate({
    useAccessGroups,
    authorizers: [
      { configured: commandDmAllowFrom.length > 0, allowed: ownerAllowedForCommands },
      { configured: effectiveGroupAllowFrom.length > 0, allowed: groupAllowedForCommands }
    ],
    allowTextCommands: true,
    hasControlCommand: hasControlCmd
  });
  const commandAuthorized = commandGate.commandAuthorized;
  if (isGroup && commandGate.shouldBlock) {
    logInboundDrop({
      log: (msg) => logVerbose(core, runtime2, msg),
      channel: "bluebubbles",
      reason: "control command (unauthorized)",
      target: message.senderId
    });
    return;
  }
  const shouldBypassMention = isGroup && requireMention && !wasMentioned && commandAuthorized && hasControlCmd;
  const effectiveWasMentioned = wasMentioned || shouldBypassMention;
  if (isGroup && requireMention && canDetectMention && !wasMentioned && !shouldBypassMention) {
    logVerbose(core, runtime2, `bluebubbles: skipping group message (no mention)`);
    return;
  }
  cacheInboundMessage();
  const baseUrl = normalizeSecretInputString(account.config.serverUrl);
  const password = normalizeSecretInputString(account.config.password);
  const maxBytes = account.config.mediaMaxMb && account.config.mediaMaxMb > 0 ? account.config.mediaMaxMb * 1024 * 1024 : 8 * 1024 * 1024;
  let mediaUrls = [];
  let mediaPaths = [];
  let mediaTypes = [];
  if (attachments.length > 0) {
    if (!baseUrl || !password) {
      logVerbose(core, runtime2, "attachment download skipped (missing serverUrl/password)");
    } else {
      for (const attachment of attachments) {
        if (!attachment.guid) {
          continue;
        }
        if (attachment.totalBytes && attachment.totalBytes > maxBytes) {
          logVerbose(
            core,
            runtime2,
            `attachment too large guid=${attachment.guid} bytes=${attachment.totalBytes}`
          );
          continue;
        }
        try {
          const downloaded = await downloadBlueBubblesAttachment(attachment, {
            cfg: config,
            accountId: account.accountId,
            maxBytes
          });
          const saved = await core.channel.media.saveMediaBuffer(
            Buffer.from(downloaded.buffer),
            downloaded.contentType,
            "inbound",
            maxBytes
          );
          mediaPaths.push(saved.path);
          mediaUrls.push(saved.path);
          if (saved.contentType) {
            mediaTypes.push(saved.contentType);
          }
        } catch (err) {
          logVerbose(
            core,
            runtime2,
            `attachment download failed guid=${attachment.guid} err=${String(err)}`
          );
        }
      }
    }
  }
  let replyToId = message.replyToId;
  let replyToBody = message.replyToBody;
  let replyToSender = message.replyToSender;
  let replyToShortId;
  if (isTapbackMessage && tapbackContext?.replyToId) {
    replyToId = tapbackContext.replyToId;
  }
  if (replyToId) {
    const cached = resolveReplyContextFromCache({
      accountId: account.accountId,
      replyToId,
      chatGuid: message.chatGuid,
      chatIdentifier: message.chatIdentifier,
      chatId: message.chatId
    });
    if (cached) {
      if (!replyToBody && cached.body) {
        replyToBody = cached.body;
      }
      if (!replyToSender && cached.senderLabel) {
        replyToSender = cached.senderLabel;
      }
      replyToShortId = cached.shortId;
      if (core.logging.shouldLogVerbose()) {
        const preview = (cached.body ?? "").replace(/\s+/g, " ").slice(0, 120);
        logVerbose(
          core,
          runtime2,
          `reply-context cache hit replyToId=${replyToId} sender=${replyToSender ?? ""} body="${preview}"`
        );
      }
    }
  }
  if (replyToId && !replyToShortId) {
    replyToShortId = getShortIdForUuid(replyToId);
  }
  const replyTag = formatReplyTag({ replyToId, replyToShortId });
  const baseBody = replyTag ? isTapbackMessage ? `${rawBody} ${replyTag}` : `${replyTag} ${rawBody}` : rawBody;
  const senderLabel = message.senderName || `user:${message.senderId}`;
  const fromLabel = isGroup ? `${message.chatName?.trim() || "Group"} id:${peerId}` : senderLabel !== message.senderId ? `${senderLabel} id:${message.senderId}` : senderLabel;
  const groupSubject = isGroup ? message.chatName?.trim() || void 0 : void 0;
  const groupMembers = isGroup ? formatGroupMembers({
    participants: message.participants,
    fallback: message.senderId ? { id: message.senderId, name: message.senderName } : void 0
  }) : void 0;
  const storePath = core.channel.session.resolveStorePath(config.session?.store, {
    agentId: route.agentId
  });
  const envelopeOptions = core.channel.reply.resolveEnvelopeFormatOptions(config);
  const previousTimestamp = core.channel.session.readSessionUpdatedAt({
    storePath,
    sessionKey: route.sessionKey
  });
  const body = core.channel.reply.formatInboundEnvelope({
    channel: "BlueBubbles",
    from: fromLabel,
    timestamp: message.timestamp,
    previousTimestamp,
    envelope: envelopeOptions,
    body: baseBody,
    chatType: isGroup ? "group" : "direct",
    sender: { name: message.senderName || void 0, id: message.senderId }
  });
  let chatGuidForActions = chatGuid;
  if (!chatGuidForActions && baseUrl && password) {
    const resolveTarget = isGroup && (chatId || chatIdentifier) ? chatId ? { kind: "chat_id", chatId } : { kind: "chat_identifier", chatIdentifier: chatIdentifier ?? "" } : { kind: "handle", address: message.senderId };
    if (resolveTarget.kind !== "chat_identifier" || resolveTarget.chatIdentifier) {
      chatGuidForActions = await resolveChatGuidForTarget({
        baseUrl,
        password,
        target: resolveTarget
      }) ?? void 0;
    }
  }
  const ackReactionScope = config.messages?.ackReactionScope ?? "group-mentions";
  const removeAckAfterReply = config.messages?.removeAckAfterReply ?? false;
  const ackReactionValue = resolveBlueBubblesAckReaction({
    cfg: config,
    agentId: route.agentId,
    core,
    runtime: runtime2
  });
  const shouldAckReaction = () => Boolean(
    ackReactionValue && core.channel.reactions.shouldAckReaction({
      scope: ackReactionScope,
      isDirect: !isGroup,
      isGroup,
      isMentionableGroup: isGroup,
      requireMention: Boolean(requireMention),
      canDetectMention,
      effectiveWasMentioned,
      shouldBypassMention
    })
  );
  const ackMessageId = message.messageId?.trim() || "";
  const ackReactionPromise = shouldAckReaction() && ackMessageId && chatGuidForActions && ackReactionValue ? sendBlueBubblesReaction({
    chatGuid: chatGuidForActions,
    messageGuid: ackMessageId,
    emoji: ackReactionValue,
    opts: { cfg: config, accountId: account.accountId }
  }).then(
    () => true,
    (err) => {
      logVerbose(
        core,
        runtime2,
        `ack reaction failed chatGuid=${chatGuidForActions} msg=${ackMessageId}: ${String(err)}`
      );
      return false;
    }
  ) : null;
  const sendReadReceipts = account.config.sendReadReceipts !== false;
  if (chatGuidForActions && baseUrl && password && sendReadReceipts) {
    try {
      await markBlueBubblesChatRead(chatGuidForActions, {
        cfg: config,
        accountId: account.accountId
      });
      logVerbose(core, runtime2, `marked read chatGuid=${chatGuidForActions}`);
    } catch (err) {
      runtime2.error?.(`[bluebubbles] mark read failed: ${String(err)}`);
    }
  } else if (!sendReadReceipts) {
    logVerbose(core, runtime2, "mark read skipped (sendReadReceipts=false)");
  } else {
    logVerbose(core, runtime2, "mark read skipped (missing chatGuid or credentials)");
  }
  const outboundTarget = isGroup ? formatBlueBubblesChatTarget({
    chatId,
    chatGuid: chatGuidForActions ?? chatGuid,
    chatIdentifier
  }) || peerId : chatGuidForActions ? formatBlueBubblesChatTarget({ chatGuid: chatGuidForActions }) : message.senderId;
  const maybeEnqueueOutboundMessageId = (messageId, snippet) => {
    const trimmed = messageId?.trim();
    if (!trimmed || trimmed === "ok" || trimmed === "unknown") {
      return false;
    }
    const cacheEntry = rememberBlueBubblesReplyCache({
      accountId: account.accountId,
      messageId: trimmed,
      chatGuid: chatGuidForActions ?? chatGuid,
      chatIdentifier,
      chatId,
      senderLabel: "me",
      body: snippet ?? "",
      timestamp: Date.now()
    });
    const displayId = cacheEntry.shortId || trimmed;
    const preview = snippet ? ` "${snippet.slice(0, 12)}${snippet.length > 12 ? "\u2026" : ""}"` : "";
    core.system.enqueueSystemEvent(`Assistant sent${preview} [message_id:${displayId}]`, {
      sessionKey: route.sessionKey,
      contextKey: `bluebubbles:outbound:${outboundTarget}:${trimmed}`
    });
    return true;
  };
  const sanitizeReplyDirectiveText = (value) => {
    if (privateApiEnabled) {
      return value;
    }
    return value.replace(REPLY_DIRECTIVE_TAG_RE, " ").replace(/[ \t]+/g, " ").trim();
  };
  const historyLimit = isGroup ? account.config.historyLimit ?? 0 : account.config.dmHistoryLimit ?? 0;
  const historyIdentifier = chatGuid || chatIdentifier || (chatId ? String(chatId) : null) || (isGroup ? null : message.senderId) || "";
  const historyKey = historyIdentifier ? buildAccountScopedHistoryKey(account.accountId, historyIdentifier) : "";
  if (historyKey && historyLimit > 0) {
    const nowMs = Date.now();
    const senderLabel2 = message.fromMe ? "me" : message.senderName || message.senderId;
    const normalizedHistoryBody = truncateHistoryBody2(text, MAX_STORED_HISTORY_ENTRY_CHARS);
    const currentEntries = recordPendingHistoryEntryIfEnabled({
      historyMap: chatHistories,
      limit: historyLimit,
      historyKey,
      entry: normalizedHistoryBody ? {
        sender: senderLabel2,
        body: normalizedHistoryBody,
        timestamp: message.timestamp ?? nowMs,
        messageId: message.messageId ?? void 0
      } : null
    });
    pruneHistoryBackfillState();
    const backfillAttempt = planHistoryBackfillAttempt(historyKey, nowMs);
    if (backfillAttempt) {
      try {
        const backfillResult = await fetchBlueBubblesHistory(historyIdentifier, historyLimit, {
          cfg: config,
          accountId: account.accountId
        });
        if (backfillResult.resolved) {
          markHistoryBackfillResolved(historyKey);
        }
        if (backfillResult.entries.length > 0) {
          const apiEntries = [];
          for (const entry of backfillResult.entries) {
            const body2 = truncateHistoryBody2(entry.body, MAX_STORED_HISTORY_ENTRY_CHARS);
            if (!body2) {
              continue;
            }
            apiEntries.push({
              sender: entry.sender,
              body: body2,
              timestamp: entry.timestamp,
              messageId: entry.messageId
            });
          }
          const merged = mergeHistoryEntries({
            apiEntries,
            currentEntries: currentEntries.length > 0 ? currentEntries : chatHistories.get(historyKey) ?? [],
            limit: historyLimit
          });
          if (chatHistories.has(historyKey)) {
            chatHistories.delete(historyKey);
          }
          chatHistories.set(historyKey, merged);
          evictOldHistoryKeys(chatHistories);
          logVerbose(
            core,
            runtime2,
            `backfilled ${backfillResult.entries.length} history messages for ${isGroup ? "group" : "DM"}: ${historyIdentifier}`
          );
        } else if (!backfillResult.resolved) {
          const remainingAttempts = HISTORY_BACKFILL_MAX_ATTEMPTS - backfillAttempt.attempts;
          const nextBackoffMs = Math.max(backfillAttempt.nextAttemptAt - nowMs, 0);
          logVerbose(
            core,
            runtime2,
            `history backfill unresolved for ${historyIdentifier}; retries left=${Math.max(remainingAttempts, 0)} next_in_ms=${nextBackoffMs}`
          );
        }
      } catch (err) {
        const remainingAttempts = HISTORY_BACKFILL_MAX_ATTEMPTS - backfillAttempt.attempts;
        const nextBackoffMs = Math.max(backfillAttempt.nextAttemptAt - nowMs, 0);
        logVerbose(
          core,
          runtime2,
          `history backfill failed for ${historyIdentifier}: ${String(err)} (retries left=${Math.max(remainingAttempts, 0)} next_in_ms=${nextBackoffMs})`
        );
      }
    }
  }
  let inboundHistory;
  if (historyKey && historyLimit > 0) {
    const entries = chatHistories.get(historyKey);
    if (entries && entries.length > 0) {
      inboundHistory = buildInboundHistorySnapshot({
        entries,
        limit: historyLimit
      });
    }
  }
  const commandBody = messageText.trim();
  const ctxPayload = core.channel.reply.finalizeInboundContext({
    Body: body,
    BodyForAgent: rawBody,
    InboundHistory: inboundHistory,
    RawBody: rawBody,
    CommandBody: commandBody,
    BodyForCommands: commandBody,
    MediaUrl: mediaUrls[0],
    MediaUrls: mediaUrls.length > 0 ? mediaUrls : void 0,
    MediaPath: mediaPaths[0],
    MediaPaths: mediaPaths.length > 0 ? mediaPaths : void 0,
    MediaType: mediaTypes[0],
    MediaTypes: mediaTypes.length > 0 ? mediaTypes : void 0,
    From: isGroup ? `group:${peerId}` : `bluebubbles:${message.senderId}`,
    To: `bluebubbles:${outboundTarget}`,
    SessionKey: route.sessionKey,
    AccountId: route.accountId,
    ChatType: isGroup ? "group" : "direct",
    ConversationLabel: fromLabel,
    // Use short ID for token savings (agent can use this to reference the message)
    ReplyToId: replyToShortId || replyToId,
    ReplyToIdFull: replyToId,
    ReplyToBody: replyToBody,
    ReplyToSender: replyToSender,
    GroupSubject: groupSubject,
    GroupMembers: groupMembers,
    SenderName: message.senderName || void 0,
    SenderId: message.senderId,
    Provider: "bluebubbles",
    Surface: "bluebubbles",
    // Use short ID for token savings (agent can use this to reference the message)
    MessageSid: messageShortId || message.messageId,
    MessageSidFull: message.messageId,
    Timestamp: message.timestamp,
    OriginatingChannel: "bluebubbles",
    OriginatingTo: `bluebubbles:${outboundTarget}`,
    WasMentioned: effectiveWasMentioned,
    CommandAuthorized: commandAuthorized
  });
  let sentMessage = false;
  let streamingActive = false;
  let typingRestartTimer;
  const typingRestartDelayMs = 150;
  const clearTypingRestartTimer = () => {
    if (typingRestartTimer) {
      clearTimeout(typingRestartTimer);
      typingRestartTimer = void 0;
    }
  };
  const restartTypingSoon = () => {
    if (!streamingActive || !chatGuidForActions || !baseUrl || !password) {
      return;
    }
    clearTypingRestartTimer();
    typingRestartTimer = setTimeout(() => {
      typingRestartTimer = void 0;
      if (!streamingActive) {
        return;
      }
      sendBlueBubblesTyping(chatGuidForActions, true, {
        cfg: config,
        accountId: account.accountId
      }).catch((err) => {
        runtime2.error?.(`[bluebubbles] typing restart failed: ${String(err)}`);
      });
    }, typingRestartDelayMs);
  };
  try {
    const { onModelSelected, ...prefixOptions } = createReplyPrefixOptions({
      cfg: config,
      agentId: route.agentId,
      channel: "bluebubbles",
      accountId: account.accountId
    });
    await core.channel.reply.dispatchReplyWithBufferedBlockDispatcher({
      ctx: ctxPayload,
      cfg: config,
      dispatcherOptions: {
        ...prefixOptions,
        deliver: async (payload, info) => {
          const rawReplyToId = privateApiEnabled && typeof payload.replyToId === "string" ? payload.replyToId.trim() : "";
          const replyToMessageGuid = rawReplyToId ? resolveBlueBubblesMessageId(rawReplyToId, { requireKnownShortId: true }) : "";
          const mediaList = payload.mediaUrls?.length ? payload.mediaUrls : payload.mediaUrl ? [payload.mediaUrl] : [];
          if (mediaList.length > 0) {
            const tableMode2 = core.channel.text.resolveMarkdownTableMode({
              cfg: config,
              channel: "bluebubbles",
              accountId: account.accountId
            });
            const text3 = sanitizeReplyDirectiveText(
              core.channel.text.convertMarkdownTables(payload.text ?? "", tableMode2)
            );
            let first = true;
            for (const mediaUrl of mediaList) {
              const caption = first ? text3 : void 0;
              first = false;
              const cachedBody = (caption ?? "").trim() || "<media:attachment>";
              const pendingId = rememberPendingOutboundMessageId({
                accountId: account.accountId,
                sessionKey: route.sessionKey,
                outboundTarget,
                chatGuid: chatGuidForActions ?? chatGuid,
                chatIdentifier,
                chatId,
                snippet: cachedBody
              });
              let result;
              try {
                result = await sendBlueBubblesMedia({
                  cfg: config,
                  to: outboundTarget,
                  mediaUrl,
                  caption: caption ?? void 0,
                  replyToId: replyToMessageGuid || null,
                  accountId: account.accountId
                });
              } catch (err) {
                forgetPendingOutboundMessageId(pendingId);
                throw err;
              }
              if (maybeEnqueueOutboundMessageId(result.messageId, cachedBody)) {
                forgetPendingOutboundMessageId(pendingId);
              }
              sentMessage = true;
              statusSink?.({ lastOutboundAt: Date.now() });
              if (info.kind === "block") {
                restartTypingSoon();
              }
            }
            return;
          }
          const textLimit = account.config.textChunkLimit && account.config.textChunkLimit > 0 ? account.config.textChunkLimit : DEFAULT_TEXT_LIMIT;
          const chunkMode = account.config.chunkMode ?? "length";
          const tableMode = core.channel.text.resolveMarkdownTableMode({
            cfg: config,
            channel: "bluebubbles",
            accountId: account.accountId
          });
          const text2 = sanitizeReplyDirectiveText(
            core.channel.text.convertMarkdownTables(payload.text ?? "", tableMode)
          );
          const chunks = chunkMode === "newline" ? core.channel.text.chunkTextWithMode(text2, textLimit, chunkMode) : core.channel.text.chunkMarkdownText(text2, textLimit);
          if (!chunks.length && text2) {
            chunks.push(text2);
          }
          if (!chunks.length) {
            return;
          }
          for (const chunk of chunks) {
            const pendingId = rememberPendingOutboundMessageId({
              accountId: account.accountId,
              sessionKey: route.sessionKey,
              outboundTarget,
              chatGuid: chatGuidForActions ?? chatGuid,
              chatIdentifier,
              chatId,
              snippet: chunk
            });
            let result;
            try {
              result = await sendMessageBlueBubbles(outboundTarget, chunk, {
                cfg: config,
                accountId: account.accountId,
                replyToMessageGuid: replyToMessageGuid || void 0
              });
            } catch (err) {
              forgetPendingOutboundMessageId(pendingId);
              throw err;
            }
            if (maybeEnqueueOutboundMessageId(result.messageId, chunk)) {
              forgetPendingOutboundMessageId(pendingId);
            }
            sentMessage = true;
            statusSink?.({ lastOutboundAt: Date.now() });
            if (info.kind === "block") {
              restartTypingSoon();
            }
          }
        },
        onReplyStart: async () => {
          if (!chatGuidForActions) {
            return;
          }
          if (!baseUrl || !password) {
            return;
          }
          streamingActive = true;
          clearTypingRestartTimer();
          try {
            await sendBlueBubblesTyping(chatGuidForActions, true, {
              cfg: config,
              accountId: account.accountId
            });
          } catch (err) {
            runtime2.error?.(`[bluebubbles] typing start failed: ${String(err)}`);
          }
        },
        onIdle: async () => {
          if (!chatGuidForActions) {
            return;
          }
          if (!baseUrl || !password) {
            return;
          }
        },
        onError: (err, info) => {
          runtime2.error?.(`BlueBubbles ${info.kind} reply failed: ${String(err)}`);
        }
      },
      replyOptions: {
        onModelSelected,
        disableBlockStreaming: typeof account.config.blockStreaming === "boolean" ? !account.config.blockStreaming : void 0
      }
    });
  } finally {
    const shouldStopTyping = Boolean(chatGuidForActions && baseUrl && password) && (streamingActive || !sentMessage);
    streamingActive = false;
    clearTypingRestartTimer();
    if (sentMessage && chatGuidForActions && ackMessageId) {
      core.channel.reactions.removeAckReactionAfterReply({
        removeAfterReply: removeAckAfterReply,
        ackReactionPromise,
        ackReactionValue: ackReactionValue ?? null,
        remove: () => sendBlueBubblesReaction({
          chatGuid: chatGuidForActions,
          messageGuid: ackMessageId,
          emoji: ackReactionValue ?? "",
          remove: true,
          opts: { cfg: config, accountId: account.accountId }
        }),
        onError: (err) => {
          logAckFailure({
            log: (msg) => logVerbose(core, runtime2, msg),
            channel: "bluebubbles",
            target: `${chatGuidForActions}/${ackMessageId}`,
            error: err
          });
        }
      });
    }
    if (shouldStopTyping && chatGuidForActions) {
      sendBlueBubblesTyping(chatGuidForActions, false, {
        cfg: config,
        accountId: account.accountId
      }).catch((err) => {
        logTypingFailure({
          log: (msg) => logVerbose(core, runtime2, msg),
          channel: "bluebubbles",
          action: "stop",
          target: chatGuidForActions,
          error: err
        });
      });
    }
  }
}
async function processReaction(reaction, target) {
  const { account, config, runtime: runtime2, core } = target;
  const pairing = createScopedPairingAccess({
    core,
    channel: "bluebubbles",
    accountId: account.accountId
  });
  if (reaction.fromMe) {
    return;
  }
  const dmPolicy2 = account.config.dmPolicy ?? "pairing";
  const groupPolicy = account.config.groupPolicy ?? "allowlist";
  const storeAllowFrom = await readStoreAllowFromForDmPolicy({
    provider: "bluebubbles",
    accountId: account.accountId,
    dmPolicy: dmPolicy2,
    readStore: pairing.readStoreForDmPolicy
  });
  const accessDecision = resolveDmGroupAccessWithLists({
    isGroup: reaction.isGroup,
    dmPolicy: dmPolicy2,
    groupPolicy,
    allowFrom: account.config.allowFrom,
    groupAllowFrom: account.config.groupAllowFrom,
    storeAllowFrom,
    isSenderAllowed: (allowFrom) => isAllowedBlueBubblesSender({
      allowFrom,
      sender: reaction.senderId,
      chatId: reaction.chatId ?? void 0,
      chatGuid: reaction.chatGuid ?? void 0,
      chatIdentifier: reaction.chatIdentifier ?? void 0
    })
  });
  if (accessDecision.decision !== "allow") {
    return;
  }
  const chatId = reaction.chatId ?? void 0;
  const chatGuid = reaction.chatGuid ?? void 0;
  const chatIdentifier = reaction.chatIdentifier ?? void 0;
  const peerId = reaction.isGroup ? chatGuid ?? chatIdentifier ?? (chatId ? String(chatId) : "group") : reaction.senderId;
  const route = core.channel.routing.resolveAgentRoute({
    cfg: config,
    channel: "bluebubbles",
    accountId: account.accountId,
    peer: {
      kind: reaction.isGroup ? "group" : "direct",
      id: peerId
    }
  });
  const senderLabel = reaction.senderName || reaction.senderId;
  const chatLabel = reaction.isGroup ? ` in group:${peerId}` : "";
  const messageDisplayId = getShortIdForUuid(reaction.messageId) || reaction.messageId;
  const text = reaction.action === "removed" ? `${senderLabel} removed ${reaction.emoji} reaction [[reply_to:${messageDisplayId}]]${chatLabel}` : `${senderLabel} reacted with ${reaction.emoji} [[reply_to:${messageDisplayId}]]${chatLabel}`;
  core.system.enqueueSystemEvent(text, {
    sessionKey: route.sessionKey,
    contextKey: `bluebubbles:reaction:${reaction.action}:${peerId}:${reaction.messageId}:${reaction.senderId}:${reaction.emoji}`
  });
  logVerbose(core, runtime2, `reaction event enqueued: ${text}`);
}

// vendor/openclaw-runtime/win-x64/extensions/bluebubbles/src/monitor-shared.ts
import { normalizeWebhookPath } from "openclaw/plugin-sdk";
var DEFAULT_WEBHOOK_PATH = "/bluebubbles-webhook";
function resolveWebhookPathFromConfig(config) {
  const raw = config?.webhookPath?.trim();
  if (raw) {
    return normalizeWebhookPath(raw);
  }
  return DEFAULT_WEBHOOK_PATH;
}

// vendor/openclaw-runtime/win-x64/extensions/bluebubbles/src/monitor.ts
var webhookTargets = /* @__PURE__ */ new Map();
var webhookInFlightLimiter = createWebhookInFlightLimiter();
var debounceRegistry = createBlueBubblesDebounceRegistry({ processMessage });
function registerBlueBubblesWebhookTarget(target) {
  const registered = registerWebhookTargetWithPluginRoute({
    targetsByPath: webhookTargets,
    target,
    route: {
      auth: "plugin",
      match: "exact",
      pluginId: "bluebubbles",
      source: "bluebubbles-webhook",
      accountId: target.account.accountId,
      log: target.runtime.log,
      handler: async (req, res) => {
        const handled = await handleBlueBubblesWebhookRequest(req, res);
        if (!handled && !res.headersSent) {
          res.statusCode = 404;
          res.setHeader("Content-Type", "text/plain; charset=utf-8");
          res.end("Not Found");
        }
      }
    }
  });
  return () => {
    registered.unregister();
    debounceRegistry.removeDebouncer(registered.target);
  };
}
function parseBlueBubblesWebhookPayload(rawBody) {
  const trimmed = rawBody.trim();
  if (!trimmed) {
    return { ok: false, error: "empty payload" };
  }
  try {
    return { ok: true, value: JSON.parse(trimmed) };
  } catch {
    const params = new URLSearchParams(rawBody);
    const payload = params.get("payload") ?? params.get("data") ?? params.get("message");
    if (!payload) {
      return { ok: false, error: "invalid json" };
    }
    try {
      return { ok: true, value: JSON.parse(payload) };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}
function asRecord2(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}
function maskSecret(value) {
  if (value.length <= 6) {
    return "***";
  }
  return `${value.slice(0, 2)}***${value.slice(-2)}`;
}
function normalizeAuthToken(raw) {
  const value = raw.trim();
  if (!value) {
    return "";
  }
  if (value.toLowerCase().startsWith("bearer ")) {
    return value.slice("bearer ".length).trim();
  }
  return value;
}
function safeEqualSecret(aRaw, bRaw) {
  const a = normalizeAuthToken(aRaw);
  const b = normalizeAuthToken(bRaw);
  if (!a || !b) {
    return false;
  }
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) {
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}
async function handleBlueBubblesWebhookRequest(req, res) {
  const resolved = resolveWebhookTargets(req, webhookTargets);
  if (!resolved) {
    return false;
  }
  const { path: path4, targets } = resolved;
  const url = new URL(req.url ?? "/", "http://localhost");
  const requestLifecycle = beginWebhookRequestPipelineOrReject({
    req,
    res,
    allowMethods: ["POST"],
    inFlightLimiter: webhookInFlightLimiter,
    inFlightKey: `${path4}:${req.socket.remoteAddress ?? "unknown"}`
  });
  if (!requestLifecycle.ok) {
    return true;
  }
  try {
    const guidParam = url.searchParams.get("guid") ?? url.searchParams.get("password");
    const headerToken = req.headers["x-guid"] ?? req.headers["x-password"] ?? req.headers["x-bluebubbles-guid"] ?? req.headers["authorization"];
    const guid = (Array.isArray(headerToken) ? headerToken[0] : headerToken) ?? guidParam ?? "";
    const target = resolveWebhookTargetWithAuthOrRejectSync({
      targets,
      res,
      isMatch: (target2) => {
        const token = target2.account.config.password?.trim() ?? "";
        return safeEqualSecret(guid, token);
      }
    });
    if (!target) {
      console.warn(
        `[bluebubbles] webhook rejected: status=${res.statusCode} path=${path4} guid=${maskSecret(url.searchParams.get("guid") ?? url.searchParams.get("password") ?? "")}`
      );
      return true;
    }
    const body = await readWebhookBodyOrReject({
      req,
      res,
      profile: "post-auth",
      invalidBodyMessage: "invalid payload"
    });
    if (!body.ok) {
      console.warn(`[bluebubbles] webhook rejected: status=${res.statusCode}`);
      return true;
    }
    const parsed = parseBlueBubblesWebhookPayload(body.value);
    if (!parsed.ok) {
      res.statusCode = 400;
      res.end(parsed.error);
      console.warn(`[bluebubbles] webhook rejected: ${parsed.error}`);
      return true;
    }
    const payload = asRecord2(parsed.value) ?? {};
    const firstTarget = targets[0];
    if (firstTarget) {
      logVerbose(
        firstTarget.core,
        firstTarget.runtime,
        `webhook received path=${path4} keys=${Object.keys(payload).join(",") || "none"}`
      );
    }
    const eventTypeRaw = payload.type;
    const eventType = typeof eventTypeRaw === "string" ? eventTypeRaw.trim() : "";
    const allowedEventTypes = /* @__PURE__ */ new Set([
      "new-message",
      "updated-message",
      "message-reaction",
      "reaction"
    ]);
    if (eventType && !allowedEventTypes.has(eventType)) {
      res.statusCode = 200;
      res.end("ok");
      if (firstTarget) {
        logVerbose(firstTarget.core, firstTarget.runtime, `webhook ignored type=${eventType}`);
      }
      return true;
    }
    const reaction = normalizeWebhookReaction(payload);
    if ((eventType === "updated-message" || eventType === "message-reaction" || eventType === "reaction") && !reaction) {
      res.statusCode = 200;
      res.end("ok");
      if (firstTarget) {
        logVerbose(
          firstTarget.core,
          firstTarget.runtime,
          `webhook ignored ${eventType || "event"} without reaction`
        );
      }
      return true;
    }
    const message = reaction ? null : normalizeWebhookMessage(payload);
    if (!message && !reaction) {
      res.statusCode = 400;
      res.end("invalid payload");
      console.warn("[bluebubbles] webhook rejected: unable to parse message payload");
      return true;
    }
    target.statusSink?.({ lastInboundAt: Date.now() });
    if (reaction) {
      processReaction(reaction, target).catch((err) => {
        target.runtime.error?.(
          `[${target.account.accountId}] BlueBubbles reaction failed: ${String(err)}`
        );
      });
    } else if (message) {
      const debouncer = debounceRegistry.getOrCreateDebouncer(target);
      debouncer.enqueue({ message, target }).catch((err) => {
        target.runtime.error?.(
          `[${target.account.accountId}] BlueBubbles webhook failed: ${String(err)}`
        );
      });
    }
    res.statusCode = 200;
    res.end("ok");
    if (reaction) {
      if (firstTarget) {
        logVerbose(
          firstTarget.core,
          firstTarget.runtime,
          `webhook accepted reaction sender=${reaction.senderId} msg=${reaction.messageId} action=${reaction.action}`
        );
      }
    } else if (message) {
      if (firstTarget) {
        logVerbose(
          firstTarget.core,
          firstTarget.runtime,
          `webhook accepted sender=${message.senderId} group=${message.isGroup} chatGuid=${message.chatGuid ?? ""} chatId=${message.chatId ?? ""}`
        );
      }
    }
    return true;
  } finally {
    requestLifecycle.release();
  }
}
async function monitorBlueBubblesProvider(options) {
  const { account, config, runtime: runtime2, abortSignal, statusSink } = options;
  const core = getBlueBubblesRuntime();
  const path4 = options.webhookPath?.trim() || DEFAULT_WEBHOOK_PATH;
  const serverInfo = await fetchBlueBubblesServerInfo({
    baseUrl: account.baseUrl,
    password: account.config.password,
    accountId: account.accountId,
    timeoutMs: 5e3
  }).catch(() => null);
  if (serverInfo?.os_version) {
    runtime2.log?.(`[${account.accountId}] BlueBubbles server macOS ${serverInfo.os_version}`);
  }
  if (typeof serverInfo?.private_api === "boolean") {
    runtime2.log?.(
      `[${account.accountId}] BlueBubbles Private API ${serverInfo.private_api ? "enabled" : "disabled"}`
    );
  }
  const unregister = registerBlueBubblesWebhookTarget({
    account,
    config,
    runtime: runtime2,
    core,
    path: path4,
    statusSink
  });
  return await new Promise((resolve) => {
    const stop = () => {
      unregister();
      resolve();
    };
    if (abortSignal?.aborted) {
      stop();
      return;
    }
    abortSignal?.addEventListener("abort", stop, { once: true });
    runtime2.log?.(
      `[${account.accountId}] BlueBubbles webhook listening on ${normalizeWebhookPath(path4)}`
    );
  });
}

// vendor/openclaw-runtime/win-x64/extensions/bluebubbles/src/actions.ts
var providerId = "bluebubbles";
function mapTarget(raw) {
  const parsed = parseBlueBubblesTarget(raw);
  if (parsed.kind === "chat_guid") {
    return { kind: "chat_guid", chatGuid: parsed.chatGuid };
  }
  if (parsed.kind === "chat_id") {
    return { kind: "chat_id", chatId: parsed.chatId };
  }
  if (parsed.kind === "chat_identifier") {
    return { kind: "chat_identifier", chatIdentifier: parsed.chatIdentifier };
  }
  return {
    kind: "handle",
    address: normalizeBlueBubblesHandle(parsed.to),
    service: parsed.service
  };
}
function readMessageText(params) {
  return readStringParam(params, "text") ?? readStringParam(params, "message");
}
var SUPPORTED_ACTIONS = new Set(BLUEBUBBLES_ACTION_NAMES);
var PRIVATE_API_ACTIONS = /* @__PURE__ */ new Set([
  "react",
  "edit",
  "unsend",
  "reply",
  "sendWithEffect",
  "renameGroup",
  "setGroupIcon",
  "addParticipant",
  "removeParticipant",
  "leaveGroup"
]);
var bluebubblesMessageActions = {
  listActions: ({ cfg }) => {
    const account = resolveBlueBubblesAccount({ cfg });
    if (!account.enabled || !account.configured) {
      return [];
    }
    const gate = createActionGate(cfg.channels?.bluebubbles?.actions);
    const actions = /* @__PURE__ */ new Set();
    const macOS26 = isMacOS26OrHigher(account.accountId);
    const privateApiStatus = getCachedBlueBubblesPrivateApiStatus(account.accountId);
    for (const action of BLUEBUBBLES_ACTION_NAMES) {
      const spec = BLUEBUBBLES_ACTIONS[action];
      if (!spec?.gate) {
        continue;
      }
      if (privateApiStatus === false && PRIVATE_API_ACTIONS.has(action)) {
        continue;
      }
      if ("unsupportedOnMacOS26" in spec && spec.unsupportedOnMacOS26 && macOS26) {
        continue;
      }
      if (gate(spec.gate)) {
        actions.add(action);
      }
    }
    return Array.from(actions);
  },
  supportsAction: ({ action }) => SUPPORTED_ACTIONS.has(action),
  extractToolSend: ({ args }) => extractToolSend(args, "sendMessage"),
  handleAction: async ({ action, params, cfg, accountId, toolContext }) => {
    const account = resolveBlueBubblesAccount({
      cfg,
      accountId: accountId ?? void 0
    });
    const baseUrl = normalizeSecretInputString(account.config.serverUrl);
    const password = normalizeSecretInputString(account.config.password);
    const opts = { cfg, accountId: accountId ?? void 0 };
    const assertPrivateApiEnabled2 = () => {
      if (getCachedBlueBubblesPrivateApiStatus(account.accountId) === false) {
        throw new Error(
          `BlueBubbles ${action} requires Private API, but it is disabled on the BlueBubbles server.`
        );
      }
    };
    const resolveChatGuid = async () => {
      const chatGuid = readStringParam(params, "chatGuid");
      if (chatGuid?.trim()) {
        return chatGuid.trim();
      }
      const chatIdentifier = readStringParam(params, "chatIdentifier");
      const chatId = readNumberParam(params, "chatId", { integer: true });
      const to = readStringParam(params, "to");
      const contextTarget = toolContext?.currentChannelId?.trim();
      const target = chatIdentifier?.trim() ? {
        kind: "chat_identifier",
        chatIdentifier: chatIdentifier.trim()
      } : typeof chatId === "number" ? { kind: "chat_id", chatId } : to ? mapTarget(to) : contextTarget ? mapTarget(contextTarget) : null;
      if (!target) {
        throw new Error(`BlueBubbles ${action} requires chatGuid, chatIdentifier, chatId, or to.`);
      }
      if (!baseUrl || !password) {
        throw new Error(`BlueBubbles ${action} requires serverUrl and password.`);
      }
      const resolved = await resolveChatGuidForTarget({ baseUrl, password, target });
      if (!resolved) {
        throw new Error(`BlueBubbles ${action} failed: chatGuid not found for target.`);
      }
      return resolved;
    };
    if (action === "react") {
      assertPrivateApiEnabled2();
      const { emoji, remove, isEmpty } = readReactionParams(params, {
        removeErrorMessage: "Emoji is required to remove a BlueBubbles reaction."
      });
      if (isEmpty && !remove) {
        throw new Error(
          "BlueBubbles react requires emoji parameter. Use action=react with emoji=<emoji> and messageId=<message_id>."
        );
      }
      const rawMessageId = readStringParam(params, "messageId");
      if (!rawMessageId) {
        throw new Error(
          "BlueBubbles react requires messageId parameter (the message ID to react to). Use action=react with messageId=<message_id>, emoji=<emoji>, and to/chatGuid to identify the chat."
        );
      }
      const messageId = resolveBlueBubblesMessageId(rawMessageId, { requireKnownShortId: true });
      const partIndex = readNumberParam(params, "partIndex", { integer: true });
      const resolvedChatGuid = await resolveChatGuid();
      await sendBlueBubblesReaction({
        chatGuid: resolvedChatGuid,
        messageGuid: messageId,
        emoji,
        remove: remove || void 0,
        partIndex: typeof partIndex === "number" ? partIndex : void 0,
        opts
      });
      return jsonResult({ ok: true, ...remove ? { removed: true } : { added: emoji } });
    }
    if (action === "edit") {
      assertPrivateApiEnabled2();
      if (isMacOS26OrHigher(accountId ?? void 0)) {
        throw new Error(
          "BlueBubbles edit is not supported on macOS 26 or higher. Apple removed the ability to edit iMessages in this version."
        );
      }
      const rawMessageId = readStringParam(params, "messageId");
      const newText = readStringParam(params, "text") ?? readStringParam(params, "newText") ?? readStringParam(params, "message");
      if (!rawMessageId || !newText) {
        const missing = [];
        if (!rawMessageId) {
          missing.push("messageId (the message ID to edit)");
        }
        if (!newText) {
          missing.push("text (the new message content)");
        }
        throw new Error(
          `BlueBubbles edit requires: ${missing.join(", ")}. Use action=edit with messageId=<message_id>, text=<new_content>.`
        );
      }
      const messageId = resolveBlueBubblesMessageId(rawMessageId, { requireKnownShortId: true });
      const partIndex = readNumberParam(params, "partIndex", { integer: true });
      const backwardsCompatMessage = readStringParam(params, "backwardsCompatMessage");
      await editBlueBubblesMessage(messageId, newText, {
        ...opts,
        partIndex: typeof partIndex === "number" ? partIndex : void 0,
        backwardsCompatMessage: backwardsCompatMessage ?? void 0
      });
      return jsonResult({ ok: true, edited: rawMessageId });
    }
    if (action === "unsend") {
      assertPrivateApiEnabled2();
      const rawMessageId = readStringParam(params, "messageId");
      if (!rawMessageId) {
        throw new Error(
          "BlueBubbles unsend requires messageId parameter (the message ID to unsend). Use action=unsend with messageId=<message_id>."
        );
      }
      const messageId = resolveBlueBubblesMessageId(rawMessageId, { requireKnownShortId: true });
      const partIndex = readNumberParam(params, "partIndex", { integer: true });
      await unsendBlueBubblesMessage(messageId, {
        ...opts,
        partIndex: typeof partIndex === "number" ? partIndex : void 0
      });
      return jsonResult({ ok: true, unsent: rawMessageId });
    }
    if (action === "reply") {
      assertPrivateApiEnabled2();
      const rawMessageId = readStringParam(params, "messageId");
      const text = readMessageText(params);
      const to = readStringParam(params, "to") ?? readStringParam(params, "target");
      if (!rawMessageId || !text || !to) {
        const missing = [];
        if (!rawMessageId) {
          missing.push("messageId (the message ID to reply to)");
        }
        if (!text) {
          missing.push("text or message (the reply message content)");
        }
        if (!to) {
          missing.push("to or target (the chat target)");
        }
        throw new Error(
          `BlueBubbles reply requires: ${missing.join(", ")}. Use action=reply with messageId=<message_id>, message=<your reply>, target=<chat_target>.`
        );
      }
      const messageId = resolveBlueBubblesMessageId(rawMessageId, { requireKnownShortId: true });
      const partIndex = readNumberParam(params, "partIndex", { integer: true });
      const result = await sendMessageBlueBubbles(to, text, {
        ...opts,
        replyToMessageGuid: messageId,
        replyToPartIndex: typeof partIndex === "number" ? partIndex : void 0
      });
      return jsonResult({ ok: true, messageId: result.messageId, repliedTo: rawMessageId });
    }
    if (action === "sendWithEffect") {
      assertPrivateApiEnabled2();
      const text = readMessageText(params);
      const to = readStringParam(params, "to") ?? readStringParam(params, "target");
      const effectId = readStringParam(params, "effectId") ?? readStringParam(params, "effect");
      if (!text || !to || !effectId) {
        const missing = [];
        if (!text) {
          missing.push("text or message (the message content)");
        }
        if (!to) {
          missing.push("to or target (the chat target)");
        }
        if (!effectId) {
          missing.push(
            "effectId or effect (e.g., slam, loud, gentle, invisible-ink, confetti, lasers, fireworks, balloons, heart)"
          );
        }
        throw new Error(
          `BlueBubbles sendWithEffect requires: ${missing.join(", ")}. Use action=sendWithEffect with message=<message>, target=<chat_target>, effectId=<effect_name>.`
        );
      }
      const result = await sendMessageBlueBubbles(to, text, {
        ...opts,
        effectId
      });
      return jsonResult({ ok: true, messageId: result.messageId, effect: effectId });
    }
    if (action === "renameGroup") {
      assertPrivateApiEnabled2();
      const resolvedChatGuid = await resolveChatGuid();
      const displayName = readStringParam(params, "displayName") ?? readStringParam(params, "name");
      if (!displayName) {
        throw new Error("BlueBubbles renameGroup requires displayName or name parameter.");
      }
      await renameBlueBubblesChat(resolvedChatGuid, displayName, opts);
      return jsonResult({ ok: true, renamed: resolvedChatGuid, displayName });
    }
    if (action === "setGroupIcon") {
      assertPrivateApiEnabled2();
      const resolvedChatGuid = await resolveChatGuid();
      const base64Buffer = readStringParam(params, "buffer");
      const filename = readStringParam(params, "filename") ?? readStringParam(params, "name") ?? "icon.png";
      const contentType = readStringParam(params, "contentType") ?? readStringParam(params, "mimeType");
      if (!base64Buffer) {
        throw new Error(
          "BlueBubbles setGroupIcon requires an image. Use action=setGroupIcon with media=<image_url> or path=<local_file_path> to set the group icon."
        );
      }
      const buffer = Uint8Array.from(atob(base64Buffer), (c) => c.charCodeAt(0));
      await setGroupIconBlueBubbles(resolvedChatGuid, buffer, filename, {
        ...opts,
        contentType: contentType ?? void 0
      });
      return jsonResult({ ok: true, chatGuid: resolvedChatGuid, iconSet: true });
    }
    if (action === "addParticipant") {
      assertPrivateApiEnabled2();
      const resolvedChatGuid = await resolveChatGuid();
      const address = readStringParam(params, "address") ?? readStringParam(params, "participant");
      if (!address) {
        throw new Error("BlueBubbles addParticipant requires address or participant parameter.");
      }
      await addBlueBubblesParticipant(resolvedChatGuid, address, opts);
      return jsonResult({ ok: true, added: address, chatGuid: resolvedChatGuid });
    }
    if (action === "removeParticipant") {
      assertPrivateApiEnabled2();
      const resolvedChatGuid = await resolveChatGuid();
      const address = readStringParam(params, "address") ?? readStringParam(params, "participant");
      if (!address) {
        throw new Error("BlueBubbles removeParticipant requires address or participant parameter.");
      }
      await removeBlueBubblesParticipant(resolvedChatGuid, address, opts);
      return jsonResult({ ok: true, removed: address, chatGuid: resolvedChatGuid });
    }
    if (action === "leaveGroup") {
      assertPrivateApiEnabled2();
      const resolvedChatGuid = await resolveChatGuid();
      await leaveBlueBubblesChat(resolvedChatGuid, opts);
      return jsonResult({ ok: true, left: resolvedChatGuid });
    }
    if (action === "sendAttachment") {
      const to = readStringParam(params, "to", { required: true });
      const filename = readStringParam(params, "filename", { required: true });
      const caption = readStringParam(params, "caption");
      const contentType = readStringParam(params, "contentType") ?? readStringParam(params, "mimeType");
      const asVoice = readBooleanParam(params, "asVoice");
      const base64Buffer = readStringParam(params, "buffer");
      const filePath = readStringParam(params, "path") ?? readStringParam(params, "filePath");
      let buffer;
      if (base64Buffer) {
        buffer = Uint8Array.from(atob(base64Buffer), (c) => c.charCodeAt(0));
      } else if (filePath) {
        throw new Error(
          "BlueBubbles sendAttachment: filePath not supported in action, provide buffer as base64."
        );
      } else {
        throw new Error("BlueBubbles sendAttachment requires buffer (base64) parameter.");
      }
      const result = await sendBlueBubblesAttachment({
        to,
        buffer,
        filename,
        contentType: contentType ?? void 0,
        caption: caption ?? void 0,
        asVoice: asVoice ?? void 0,
        opts
      });
      return jsonResult({ ok: true, messageId: result.messageId });
    }
    throw new Error(`Action ${action} is not supported for provider ${providerId}.`);
  }
};

// vendor/openclaw-runtime/win-x64/extensions/bluebubbles/src/config-schema.ts
import { MarkdownConfigSchema, ToolPolicySchema } from "openclaw/plugin-sdk";
import { z as z2 } from "zod";
var allowFromEntry = z2.union([z2.string(), z2.number()]);
var bluebubblesActionSchema = z2.object({
  reactions: z2.boolean().default(true),
  edit: z2.boolean().default(true),
  unsend: z2.boolean().default(true),
  reply: z2.boolean().default(true),
  sendWithEffect: z2.boolean().default(true),
  renameGroup: z2.boolean().default(true),
  setGroupIcon: z2.boolean().default(true),
  addParticipant: z2.boolean().default(true),
  removeParticipant: z2.boolean().default(true),
  leaveGroup: z2.boolean().default(true),
  sendAttachment: z2.boolean().default(true)
}).optional();
var bluebubblesGroupConfigSchema = z2.object({
  requireMention: z2.boolean().optional(),
  tools: ToolPolicySchema
});
var bluebubblesAccountSchema = z2.object({
  name: z2.string().optional(),
  enabled: z2.boolean().optional(),
  markdown: MarkdownConfigSchema,
  serverUrl: z2.string().optional(),
  password: buildSecretInputSchema().optional(),
  webhookPath: z2.string().optional(),
  dmPolicy: z2.enum(["pairing", "allowlist", "open", "disabled"]).optional(),
  allowFrom: z2.array(allowFromEntry).optional(),
  groupAllowFrom: z2.array(allowFromEntry).optional(),
  groupPolicy: z2.enum(["open", "disabled", "allowlist"]).optional(),
  historyLimit: z2.number().int().min(0).optional(),
  dmHistoryLimit: z2.number().int().min(0).optional(),
  textChunkLimit: z2.number().int().positive().optional(),
  chunkMode: z2.enum(["length", "newline"]).optional(),
  mediaMaxMb: z2.number().int().positive().optional(),
  mediaLocalRoots: z2.array(z2.string()).optional(),
  sendReadReceipts: z2.boolean().optional(),
  allowPrivateNetwork: z2.boolean().optional(),
  blockStreaming: z2.boolean().optional(),
  groups: z2.object({}).catchall(bluebubblesGroupConfigSchema).optional()
}).superRefine((value, ctx) => {
  const serverUrl = value.serverUrl?.trim() ?? "";
  const passwordConfigured = hasConfiguredSecretInput(value.password);
  if (serverUrl && !passwordConfigured) {
    ctx.addIssue({
      code: z2.ZodIssueCode.custom,
      path: ["password"],
      message: "password is required when serverUrl is configured"
    });
  }
});
var BlueBubblesConfigSchema = bluebubblesAccountSchema.extend({
  accounts: z2.object({}).catchall(bluebubblesAccountSchema).optional(),
  defaultAccount: z2.string().optional(),
  actions: bluebubblesActionSchema
});

// vendor/openclaw-runtime/win-x64/extensions/bluebubbles/src/onboarding.ts
import {
  DEFAULT_ACCOUNT_ID as DEFAULT_ACCOUNT_ID2,
  addWildcardAllowFrom,
  formatDocsLink,
  mergeAllowFromEntries,
  normalizeAccountId as normalizeAccountId2,
  promptAccountId
} from "openclaw/plugin-sdk";
var channel = "bluebubbles";
function setBlueBubblesDmPolicy(cfg, dmPolicy2) {
  const allowFrom = dmPolicy2 === "open" ? addWildcardAllowFrom(cfg.channels?.bluebubbles?.allowFrom) : void 0;
  return {
    ...cfg,
    channels: {
      ...cfg.channels,
      bluebubbles: {
        ...cfg.channels?.bluebubbles,
        dmPolicy: dmPolicy2,
        ...allowFrom ? { allowFrom } : {}
      }
    }
  };
}
function setBlueBubblesAllowFrom(cfg, accountId, allowFrom) {
  if (accountId === DEFAULT_ACCOUNT_ID2) {
    return {
      ...cfg,
      channels: {
        ...cfg.channels,
        bluebubbles: {
          ...cfg.channels?.bluebubbles,
          allowFrom
        }
      }
    };
  }
  return {
    ...cfg,
    channels: {
      ...cfg.channels,
      bluebubbles: {
        ...cfg.channels?.bluebubbles,
        accounts: {
          ...cfg.channels?.bluebubbles?.accounts,
          [accountId]: {
            ...cfg.channels?.bluebubbles?.accounts?.[accountId],
            allowFrom
          }
        }
      }
    }
  };
}
function parseBlueBubblesAllowFromInput(raw) {
  return raw.split(/[\n,]+/g).map((entry) => entry.trim()).filter(Boolean);
}
async function promptBlueBubblesAllowFrom(params) {
  const accountId = params.accountId && normalizeAccountId2(params.accountId) ? normalizeAccountId2(params.accountId) ?? DEFAULT_ACCOUNT_ID2 : resolveDefaultBlueBubblesAccountId(params.cfg);
  const resolved = resolveBlueBubblesAccount({ cfg: params.cfg, accountId });
  const existing = resolved.config.allowFrom ?? [];
  await params.prompter.note(
    [
      "Allowlist BlueBubbles DMs by handle or chat target.",
      "Examples:",
      "- +15555550123",
      "- user@example.com",
      "- chat_id:123",
      "- chat_guid:iMessage;-;+15555550123",
      "Multiple entries: comma- or newline-separated.",
      `Docs: ${formatDocsLink("/channels/bluebubbles", "bluebubbles")}`
    ].join("\n"),
    "BlueBubbles allowlist"
  );
  const entry = await params.prompter.text({
    message: "BlueBubbles allowFrom (handle or chat_id)",
    placeholder: "+15555550123, user@example.com, chat_id:123",
    initialValue: existing[0] ? String(existing[0]) : void 0,
    validate: (value) => {
      const raw = String(value ?? "").trim();
      if (!raw) {
        return "Required";
      }
      const parts2 = parseBlueBubblesAllowFromInput(raw);
      for (const part of parts2) {
        if (part === "*") {
          continue;
        }
        const parsed = parseBlueBubblesAllowTarget(part);
        if (parsed.kind === "handle" && !parsed.handle) {
          return `Invalid entry: ${part}`;
        }
      }
      return void 0;
    }
  });
  const parts = parseBlueBubblesAllowFromInput(String(entry));
  const unique = mergeAllowFromEntries(void 0, parts);
  return setBlueBubblesAllowFrom(params.cfg, accountId, unique);
}
var dmPolicy = {
  label: "BlueBubbles",
  channel,
  policyKey: "channels.bluebubbles.dmPolicy",
  allowFromKey: "channels.bluebubbles.allowFrom",
  getCurrent: (cfg) => cfg.channels?.bluebubbles?.dmPolicy ?? "pairing",
  setPolicy: (cfg, policy) => setBlueBubblesDmPolicy(cfg, policy),
  promptAllowFrom: promptBlueBubblesAllowFrom
};
var blueBubblesOnboardingAdapter = {
  channel,
  getStatus: async ({ cfg }) => {
    const configured = listBlueBubblesAccountIds(cfg).some((accountId) => {
      const account = resolveBlueBubblesAccount({ cfg, accountId });
      return account.configured;
    });
    return {
      channel,
      configured,
      statusLines: [`BlueBubbles: ${configured ? "configured" : "needs setup"}`],
      selectionHint: configured ? "configured" : "iMessage via BlueBubbles app",
      quickstartScore: configured ? 1 : 0
    };
  },
  configure: async ({ cfg, prompter, accountOverrides, shouldPromptAccountIds }) => {
    const blueBubblesOverride = accountOverrides.bluebubbles?.trim();
    const defaultAccountId = resolveDefaultBlueBubblesAccountId(cfg);
    let accountId = blueBubblesOverride ? normalizeAccountId2(blueBubblesOverride) : defaultAccountId;
    if (shouldPromptAccountIds && !blueBubblesOverride) {
      accountId = await promptAccountId({
        cfg,
        prompter,
        label: "BlueBubbles",
        currentId: accountId,
        listAccountIds: listBlueBubblesAccountIds,
        defaultAccountId
      });
    }
    let next = cfg;
    const resolvedAccount = resolveBlueBubblesAccount({ cfg: next, accountId });
    const validateServerUrlInput = (value) => {
      const trimmed = String(value ?? "").trim();
      if (!trimmed) {
        return "Required";
      }
      try {
        const normalized = normalizeBlueBubblesServerUrl(trimmed);
        new URL(normalized);
        return void 0;
      } catch {
        return "Invalid URL format";
      }
    };
    const promptServerUrl = async (initialValue) => {
      const entered = await prompter.text({
        message: "BlueBubbles server URL",
        placeholder: "http://192.168.1.100:1234",
        initialValue,
        validate: validateServerUrlInput
      });
      return String(entered).trim();
    };
    let serverUrl = resolvedAccount.config.serverUrl?.trim();
    if (!serverUrl) {
      await prompter.note(
        [
          "Enter the BlueBubbles server URL (e.g., http://192.168.1.100:1234).",
          "Find this in the BlueBubbles Server app under Connection.",
          `Docs: ${formatDocsLink("/channels/bluebubbles", "bluebubbles")}`
        ].join("\n"),
        "BlueBubbles server URL"
      );
      serverUrl = await promptServerUrl();
    } else {
      const keepUrl = await prompter.confirm({
        message: `BlueBubbles server URL already set (${serverUrl}). Keep it?`,
        initialValue: true
      });
      if (!keepUrl) {
        serverUrl = await promptServerUrl(serverUrl);
      }
    }
    const existingPassword = resolvedAccount.config.password;
    const existingPasswordText = normalizeSecretInputString(existingPassword);
    const hasConfiguredPassword = hasConfiguredSecretInput(existingPassword);
    let password = existingPasswordText;
    if (!hasConfiguredPassword) {
      await prompter.note(
        [
          "Enter the BlueBubbles server password.",
          "Find this in the BlueBubbles Server app under Settings."
        ].join("\n"),
        "BlueBubbles password"
      );
      const entered = await prompter.text({
        message: "BlueBubbles password",
        validate: (value) => String(value ?? "").trim() ? void 0 : "Required"
      });
      password = String(entered).trim();
    } else {
      const keepPassword = await prompter.confirm({
        message: "BlueBubbles password already set. Keep it?",
        initialValue: true
      });
      if (!keepPassword) {
        const entered = await prompter.text({
          message: "BlueBubbles password",
          validate: (value) => String(value ?? "").trim() ? void 0 : "Required"
        });
        password = String(entered).trim();
      } else if (!existingPasswordText) {
        password = existingPassword;
      }
    }
    const existingWebhookPath = resolvedAccount.config.webhookPath?.trim();
    const wantsWebhook = await prompter.confirm({
      message: "Configure a custom webhook path? (default: /bluebubbles-webhook)",
      initialValue: Boolean(existingWebhookPath && existingWebhookPath !== "/bluebubbles-webhook")
    });
    let webhookPath = "/bluebubbles-webhook";
    if (wantsWebhook) {
      const entered = await prompter.text({
        message: "Webhook path",
        placeholder: "/bluebubbles-webhook",
        initialValue: existingWebhookPath || "/bluebubbles-webhook",
        validate: (value) => {
          const trimmed = String(value ?? "").trim();
          if (!trimmed) {
            return "Required";
          }
          if (!trimmed.startsWith("/")) {
            return "Path must start with /";
          }
          return void 0;
        }
      });
      webhookPath = String(entered).trim();
    }
    if (accountId === DEFAULT_ACCOUNT_ID2) {
      next = {
        ...next,
        channels: {
          ...next.channels,
          bluebubbles: {
            ...next.channels?.bluebubbles,
            enabled: true,
            serverUrl,
            password,
            webhookPath
          }
        }
      };
    } else {
      next = {
        ...next,
        channels: {
          ...next.channels,
          bluebubbles: {
            ...next.channels?.bluebubbles,
            enabled: true,
            accounts: {
              ...next.channels?.bluebubbles?.accounts,
              [accountId]: {
                ...next.channels?.bluebubbles?.accounts?.[accountId],
                enabled: next.channels?.bluebubbles?.accounts?.[accountId]?.enabled ?? true,
                serverUrl,
                password,
                webhookPath
              }
            }
          }
        }
      };
    }
    await prompter.note(
      [
        "Configure the webhook URL in BlueBubbles Server:",
        "1. Open BlueBubbles Server \u2192 Settings \u2192 Webhooks",
        "2. Add your OpenClaw gateway URL + webhook path",
        "   Example: https://your-gateway-host:3000/bluebubbles-webhook",
        "3. Enable the webhook and save",
        "",
        `Docs: ${formatDocsLink("/channels/bluebubbles", "bluebubbles")}`
      ].join("\n"),
      "BlueBubbles next steps"
    );
    return { cfg: next, accountId };
  },
  dmPolicy,
  disable: (cfg) => ({
    ...cfg,
    channels: {
      ...cfg.channels,
      bluebubbles: { ...cfg.channels?.bluebubbles, enabled: false }
    }
  })
};

// vendor/openclaw-runtime/win-x64/extensions/bluebubbles/src/channel.ts
var meta = {
  id: "bluebubbles",
  label: "BlueBubbles",
  selectionLabel: "BlueBubbles (macOS app)",
  detailLabel: "BlueBubbles",
  docsPath: "/channels/bluebubbles",
  docsLabel: "bluebubbles",
  blurb: "iMessage via the BlueBubbles mac app + REST API.",
  systemImage: "bubble.left.and.text.bubble.right",
  aliases: ["bb"],
  order: 75,
  preferOver: ["imessage"]
};
var bluebubblesPlugin = {
  id: "bluebubbles",
  meta,
  capabilities: {
    chatTypes: ["direct", "group"],
    media: true,
    reactions: true,
    edit: true,
    unsend: true,
    reply: true,
    effects: true,
    groupManagement: true
  },
  groups: {
    resolveRequireMention: resolveBlueBubblesGroupRequireMention,
    resolveToolPolicy: resolveBlueBubblesGroupToolPolicy
  },
  threading: {
    buildToolContext: ({ context, hasRepliedRef }) => ({
      currentChannelId: context.To?.trim() || void 0,
      currentThreadTs: context.ReplyToIdFull ?? context.ReplyToId,
      hasRepliedRef
    })
  },
  reload: { configPrefixes: ["channels.bluebubbles"] },
  configSchema: buildChannelConfigSchema(BlueBubblesConfigSchema),
  onboarding: blueBubblesOnboardingAdapter,
  config: {
    listAccountIds: (cfg) => listBlueBubblesAccountIds(cfg),
    resolveAccount: (cfg, accountId) => resolveBlueBubblesAccount({ cfg, accountId }),
    defaultAccountId: (cfg) => resolveDefaultBlueBubblesAccountId(cfg),
    setAccountEnabled: ({ cfg, accountId, enabled }) => setAccountEnabledInConfigSection({
      cfg,
      sectionKey: "bluebubbles",
      accountId,
      enabled,
      allowTopLevel: true
    }),
    deleteAccount: ({ cfg, accountId }) => deleteAccountFromConfigSection({
      cfg,
      sectionKey: "bluebubbles",
      accountId,
      clearBaseFields: ["serverUrl", "password", "name", "webhookPath"]
    }),
    isConfigured: (account) => account.configured,
    describeAccount: (account) => ({
      accountId: account.accountId,
      name: account.name,
      enabled: account.enabled,
      configured: account.configured,
      baseUrl: account.baseUrl
    }),
    resolveAllowFrom: ({ cfg, accountId }) => (resolveBlueBubblesAccount({ cfg, accountId }).config.allowFrom ?? []).map(
      (entry) => String(entry)
    ),
    formatAllowFrom: ({ allowFrom }) => allowFrom.map((entry) => String(entry).trim()).filter(Boolean).map((entry) => entry.replace(/^bluebubbles:/i, "")).map((entry) => normalizeBlueBubblesHandle(entry))
  },
  actions: bluebubblesMessageActions,
  security: {
    resolveDmPolicy: ({ cfg, accountId, account }) => {
      const resolvedAccountId = accountId ?? account.accountId ?? DEFAULT_ACCOUNT_ID3;
      const useAccountPath = Boolean(cfg.channels?.bluebubbles?.accounts?.[resolvedAccountId]);
      const basePath = useAccountPath ? `channels.bluebubbles.accounts.${resolvedAccountId}.` : "channels.bluebubbles.";
      return {
        policy: account.config.dmPolicy ?? "pairing",
        allowFrom: account.config.allowFrom ?? [],
        policyPath: `${basePath}dmPolicy`,
        allowFromPath: basePath,
        approveHint: formatPairingApproveHint("bluebubbles"),
        normalizeEntry: (raw) => normalizeBlueBubblesHandle(raw.replace(/^bluebubbles:/i, ""))
      };
    },
    collectWarnings: ({ account }) => {
      const groupPolicy = account.config.groupPolicy ?? "allowlist";
      if (groupPolicy !== "open") {
        return [];
      }
      return [
        `- BlueBubbles groups: groupPolicy="open" allows any member to trigger the bot. Set channels.bluebubbles.groupPolicy="allowlist" + channels.bluebubbles.groupAllowFrom to restrict senders.`
      ];
    }
  },
  messaging: {
    normalizeTarget: normalizeBlueBubblesMessagingTarget,
    targetResolver: {
      looksLikeId: looksLikeBlueBubblesTargetId,
      hint: "<handle|chat_guid:GUID|chat_id:ID|chat_identifier:ID>"
    },
    formatTargetDisplay: ({ target, display }) => {
      const shouldParseDisplay = (value) => {
        if (looksLikeBlueBubblesTargetId(value)) {
          return true;
        }
        return /^(bluebubbles:|chat_guid:|chat_id:|chat_identifier:)/i.test(value);
      };
      const extractCleanDisplay = (value) => {
        const trimmed = value?.trim();
        if (!trimmed) {
          return null;
        }
        try {
          const parsed = parseBlueBubblesTarget(trimmed);
          if (parsed.kind === "chat_guid") {
            const handle2 = extractHandleFromChatGuid(parsed.chatGuid);
            if (handle2) {
              return handle2;
            }
          }
          if (parsed.kind === "handle") {
            return normalizeBlueBubblesHandle(parsed.to);
          }
        } catch {
        }
        const stripped = trimmed.replace(/^bluebubbles:/i, "").replace(/^chat_guid:/i, "").replace(/^chat_id:/i, "").replace(/^chat_identifier:/i, "");
        const handle = extractHandleFromChatGuid(stripped);
        if (handle) {
          return handle;
        }
        if (stripped.includes(";-;") || stripped.includes(";+;")) {
          return null;
        }
        return stripped;
      };
      const trimmedDisplay = display?.trim();
      if (trimmedDisplay) {
        if (!shouldParseDisplay(trimmedDisplay)) {
          return trimmedDisplay;
        }
        const cleanDisplay = extractCleanDisplay(trimmedDisplay);
        if (cleanDisplay) {
          return cleanDisplay;
        }
      }
      const cleanTarget = extractCleanDisplay(target);
      if (cleanTarget) {
        return cleanTarget;
      }
      return display?.trim() || target?.trim() || "";
    }
  },
  setup: {
    resolveAccountId: ({ accountId }) => normalizeAccountId3(accountId),
    applyAccountName: ({ cfg, accountId, name }) => applyAccountNameToChannelSection({
      cfg,
      channelKey: "bluebubbles",
      accountId,
      name
    }),
    validateInput: ({ input }) => {
      if (!input.httpUrl && !input.password) {
        return "BlueBubbles requires --http-url and --password.";
      }
      if (!input.httpUrl) {
        return "BlueBubbles requires --http-url.";
      }
      if (!input.password) {
        return "BlueBubbles requires --password.";
      }
      return null;
    },
    applyAccountConfig: ({ cfg, accountId, input }) => {
      const namedConfig = applyAccountNameToChannelSection({
        cfg,
        channelKey: "bluebubbles",
        accountId,
        name: input.name
      });
      const next = accountId !== DEFAULT_ACCOUNT_ID3 ? migrateBaseNameToDefaultAccount({
        cfg: namedConfig,
        channelKey: "bluebubbles"
      }) : namedConfig;
      if (accountId === DEFAULT_ACCOUNT_ID3) {
        return {
          ...next,
          channels: {
            ...next.channels,
            bluebubbles: {
              ...next.channels?.bluebubbles,
              enabled: true,
              ...input.httpUrl ? { serverUrl: input.httpUrl } : {},
              ...input.password ? { password: input.password } : {},
              ...input.webhookPath ? { webhookPath: input.webhookPath } : {}
            }
          }
        };
      }
      return {
        ...next,
        channels: {
          ...next.channels,
          bluebubbles: {
            ...next.channels?.bluebubbles,
            enabled: true,
            accounts: {
              ...next.channels?.bluebubbles?.accounts,
              [accountId]: {
                ...next.channels?.bluebubbles?.accounts?.[accountId],
                enabled: true,
                ...input.httpUrl ? { serverUrl: input.httpUrl } : {},
                ...input.password ? { password: input.password } : {},
                ...input.webhookPath ? { webhookPath: input.webhookPath } : {}
              }
            }
          }
        }
      };
    }
  },
  pairing: {
    idLabel: "bluebubblesSenderId",
    normalizeAllowEntry: (entry) => normalizeBlueBubblesHandle(entry.replace(/^bluebubbles:/i, "")),
    notifyApproval: async ({ cfg, id }) => {
      await sendMessageBlueBubbles(id, PAIRING_APPROVED_MESSAGE, {
        cfg
      });
    }
  },
  outbound: {
    deliveryMode: "direct",
    textChunkLimit: 4e3,
    resolveTarget: ({ to }) => {
      const trimmed = to?.trim();
      if (!trimmed) {
        return {
          ok: false,
          error: new Error("Delivering to BlueBubbles requires --to <handle|chat_guid:GUID>")
        };
      }
      return { ok: true, to: trimmed };
    },
    sendText: async ({ cfg, to, text, accountId, replyToId }) => {
      const rawReplyToId = typeof replyToId === "string" ? replyToId.trim() : "";
      const replyToMessageGuid = rawReplyToId ? resolveBlueBubblesMessageId(rawReplyToId, { requireKnownShortId: true }) : "";
      const result = await sendMessageBlueBubbles(to, text, {
        cfg,
        accountId: accountId ?? void 0,
        replyToMessageGuid: replyToMessageGuid || void 0
      });
      return { channel: "bluebubbles", ...result };
    },
    sendMedia: async (ctx) => {
      const { cfg, to, text, mediaUrl, accountId, replyToId } = ctx;
      const { mediaPath, mediaBuffer, contentType, filename, caption } = ctx;
      const resolvedCaption = caption ?? text;
      const result = await sendBlueBubblesMedia({
        cfg,
        to,
        mediaUrl,
        mediaPath,
        mediaBuffer,
        contentType,
        filename,
        caption: resolvedCaption ?? void 0,
        replyToId: replyToId ?? null,
        accountId: accountId ?? void 0
      });
      return { channel: "bluebubbles", ...result };
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
    collectStatusIssues: collectBlueBubblesStatusIssues,
    buildChannelSummary: ({ snapshot }) => buildProbeChannelStatusSummary(snapshot, { baseUrl: snapshot.baseUrl ?? null }),
    probeAccount: async ({ account, timeoutMs }) => probeBlueBubbles({
      baseUrl: account.baseUrl,
      password: account.config.password ?? null,
      timeoutMs
    }),
    buildAccountSnapshot: ({ account, runtime: runtime2, probe }) => {
      const running = runtime2?.running ?? false;
      const probeOk = probe?.ok;
      return {
        accountId: account.accountId,
        name: account.name,
        enabled: account.enabled,
        configured: account.configured,
        baseUrl: account.baseUrl,
        running,
        connected: probeOk ?? running,
        lastStartAt: runtime2?.lastStartAt ?? null,
        lastStopAt: runtime2?.lastStopAt ?? null,
        lastError: runtime2?.lastError ?? null,
        probe,
        lastInboundAt: runtime2?.lastInboundAt ?? null,
        lastOutboundAt: runtime2?.lastOutboundAt ?? null
      };
    }
  },
  gateway: {
    startAccount: async (ctx) => {
      const account = ctx.account;
      const webhookPath = resolveWebhookPathFromConfig(account.config);
      ctx.setStatus({
        accountId: account.accountId,
        baseUrl: account.baseUrl
      });
      ctx.log?.info(`[${account.accountId}] starting provider (webhook=${webhookPath})`);
      return monitorBlueBubblesProvider({
        account,
        config: ctx.cfg,
        runtime: ctx.runtime,
        abortSignal: ctx.abortSignal,
        statusSink: (patch) => ctx.setStatus({ accountId: ctx.accountId, ...patch }),
        webhookPath
      });
    }
  }
};

// vendor/openclaw-runtime/win-x64/extensions/bluebubbles/index.ts
var plugin = {
  id: "bluebubbles",
  name: "BlueBubbles",
  description: "BlueBubbles channel plugin (macOS app)",
  configSchema: emptyPluginConfigSchema(),
  register(api) {
    setBlueBubblesRuntime(api.runtime);
    api.registerChannel({ plugin: bluebubblesPlugin });
  }
};
var bluebubbles_default = plugin;
export {
  bluebubbles_default as default
};
