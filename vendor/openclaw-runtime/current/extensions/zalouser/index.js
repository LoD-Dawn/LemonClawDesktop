var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// vendor/openclaw-runtime/win-x64/extensions/zalouser/src/zca-client.ts
import {
  LoginQRCallbackEventType as LoginQRCallbackEventTypeRuntime,
  Reactions as ReactionsRuntime,
  ThreadType as ThreadTypeRuntime,
  Zalo as ZaloRuntime
} from "zca-js";
var ThreadType, LoginQRCallbackEventType, Reactions, Zalo;
var init_zca_client = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/zalouser/src/zca-client.ts"() {
    "use strict";
    ThreadType = ThreadTypeRuntime;
    LoginQRCallbackEventType = LoginQRCallbackEventTypeRuntime;
    Reactions = ReactionsRuntime;
    Zalo = ZaloRuntime;
  }
});

// vendor/openclaw-runtime/win-x64/extensions/zalouser/src/reaction.ts
function normalizeZaloReactionIcon(raw) {
  const trimmed = raw.trim();
  if (!trimmed) {
    return Reactions.LIKE;
  }
  return REACTION_ALIAS_MAP.get(trimmed.toLowerCase()) ?? REACTION_ALIAS_MAP.get(trimmed) ?? trimmed;
}
var REACTION_ALIAS_MAP;
var init_reaction = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/zalouser/src/reaction.ts"() {
    "use strict";
    init_zca_client();
    REACTION_ALIAS_MAP = /* @__PURE__ */ new Map([
      ["like", Reactions.LIKE],
      ["\u{1F44D}", Reactions.LIKE],
      [":+1:", Reactions.LIKE],
      ["heart", Reactions.HEART],
      ["\u2764\uFE0F", Reactions.HEART],
      ["<3", Reactions.HEART],
      ["haha", Reactions.HAHA],
      ["laugh", Reactions.HAHA],
      ["\u{1F602}", Reactions.HAHA],
      ["wow", Reactions.WOW],
      ["\u{1F62E}", Reactions.WOW],
      ["cry", Reactions.CRY],
      ["\u{1F622}", Reactions.CRY],
      ["angry", Reactions.ANGRY],
      ["\u{1F621}", Reactions.ANGRY]
    ]);
  }
});

// vendor/openclaw-runtime/win-x64/extensions/zalouser/src/runtime.ts
function setZalouserRuntime(next) {
  runtime = next;
}
function getZalouserRuntime() {
  if (!runtime) {
    throw new Error("Zalouser runtime not initialized");
  }
  return runtime;
}
var runtime;
var init_runtime = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/zalouser/src/runtime.ts"() {
    "use strict";
    runtime = null;
  }
});

// vendor/openclaw-runtime/win-x64/extensions/zalouser/src/zalo-js.ts
import { randomUUID } from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import { loadOutboundMediaFromUrl } from "openclaw/plugin-sdk";
function resolveStateDir(env = process.env) {
  return getZalouserRuntime().state.resolveStateDir(env, os.homedir);
}
function resolveCredentialsDir(env = process.env) {
  return path.join(resolveStateDir(env), "credentials", "zalouser");
}
function credentialsFilename(profile) {
  const trimmed = profile.trim().toLowerCase();
  if (!trimmed || trimmed === "default") {
    return "credentials.json";
  }
  return `credentials-${encodeURIComponent(trimmed)}.json`;
}
function resolveCredentialsPath(profile, env = process.env) {
  return path.join(resolveCredentialsDir(env), credentialsFilename(profile));
}
function withTimeout(promise, timeoutMs, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(label));
    }, timeoutMs);
    void promise.then((result) => {
      clearTimeout(timer);
      resolve(result);
    }).catch((err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function normalizeProfile(profile) {
  const trimmed = profile?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "default";
}
function toErrorMessage(error) {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
function toNumberId(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(Math.trunc(value));
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length > 0) {
      return trimmed.replace(/_\d+$/, "");
    }
  }
  return "";
}
function toStringValue(value) {
  if (typeof value === "string") {
    return value.trim();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(Math.trunc(value));
  }
  return "";
}
function toInteger(value, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.trunc(parsed);
}
function normalizeMessageContent(content) {
  if (typeof content === "string") {
    return content;
  }
  if (!content || typeof content !== "object") {
    return "";
  }
  const record = content;
  const title = typeof record.title === "string" ? record.title.trim() : "";
  const description = typeof record.description === "string" ? record.description.trim() : "";
  const href = typeof record.href === "string" ? record.href.trim() : "";
  const combined = [title, description, href].filter(Boolean).join("\n").trim();
  if (combined) {
    return combined;
  }
  try {
    return JSON.stringify(content);
  } catch {
    return "";
  }
}
function resolveInboundTimestamp(rawTs) {
  if (typeof rawTs === "number" && Number.isFinite(rawTs)) {
    return rawTs > 1e12 ? rawTs : rawTs * 1e3;
  }
  const parsed = Number.parseInt(String(rawTs ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return Date.now();
  }
  return parsed > 1e12 ? parsed : parsed * 1e3;
}
function extractMentionIds(raw) {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.map((entry) => {
    if (!entry || typeof entry !== "object") {
      return "";
    }
    return toNumberId(entry.uid);
  }).filter(Boolean);
}
function resolveGroupNameFromMessageData(data) {
  const candidates = [data.groupName, data.gName, data.idToName, data.threadName, data.roomName];
  for (const candidate of candidates) {
    const value = toStringValue(candidate);
    if (value) {
      return value;
    }
  }
  return void 0;
}
function buildEventMessage(data) {
  const msgId = toStringValue(data.msgId);
  const cliMsgId = toStringValue(data.cliMsgId);
  const uidFrom = toStringValue(data.uidFrom);
  const idTo = toStringValue(data.idTo);
  if (!msgId || !cliMsgId || !uidFrom || !idTo) {
    return void 0;
  }
  return {
    msgId,
    cliMsgId,
    uidFrom,
    idTo,
    msgType: toStringValue(data.msgType) || "webchat",
    st: toInteger(data.st, 0),
    at: toInteger(data.at, 0),
    cmd: toInteger(data.cmd, 0),
    ts: toStringValue(data.ts) || Date.now()
  };
}
function extractSendMessageId(result) {
  if (!result || typeof result !== "object") {
    return void 0;
  }
  const payload = result;
  const primary = payload.message?.msgId;
  if (primary !== void 0 && primary !== null) {
    return String(primary);
  }
  const attachmentId = payload.attachment?.[0]?.msgId;
  if (attachmentId !== void 0 && attachmentId !== null) {
    return String(attachmentId);
  }
  return void 0;
}
function resolveMediaFileName(params) {
  const explicit = params.fileName?.trim();
  if (explicit) {
    return explicit;
  }
  try {
    const parsed = new URL(params.mediaUrl);
    const fromPath = path.basename(parsed.pathname).trim();
    if (fromPath) {
      return fromPath;
    }
  } catch {
  }
  const ext = params.contentType === "image/png" ? "png" : params.contentType === "image/webp" ? "webp" : params.contentType === "image/jpeg" ? "jpg" : params.contentType === "video/mp4" ? "mp4" : params.contentType === "audio/mpeg" ? "mp3" : params.contentType === "audio/ogg" ? "ogg" : params.contentType === "audio/wav" ? "wav" : params.kind === "video" ? "mp4" : params.kind === "audio" ? "mp3" : params.kind === "image" ? "jpg" : "bin";
  return `upload.${ext}`;
}
function mapFriend(friend) {
  return {
    userId: String(friend.userId),
    displayName: friend.displayName || friend.zaloName || friend.username || String(friend.userId),
    avatar: friend.avatar || void 0
  };
}
function mapGroup(groupId, group) {
  const totalMember = typeof group.totalMember === "number" && Number.isFinite(group.totalMember) ? group.totalMember : void 0;
  return {
    groupId: String(groupId),
    name: group.name?.trim() || String(groupId),
    memberCount: totalMember
  };
}
function readCredentials(profile) {
  const filePath = resolveCredentialsPath(profile);
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    if (typeof parsed.imei !== "string" || !parsed.imei || !parsed.cookie || typeof parsed.userAgent !== "string" || !parsed.userAgent) {
      return null;
    }
    return {
      imei: parsed.imei,
      cookie: parsed.cookie,
      userAgent: parsed.userAgent,
      language: typeof parsed.language === "string" ? parsed.language : void 0,
      createdAt: typeof parsed.createdAt === "string" ? parsed.createdAt : (/* @__PURE__ */ new Date()).toISOString(),
      lastUsedAt: typeof parsed.lastUsedAt === "string" ? parsed.lastUsedAt : void 0
    };
  } catch {
    return null;
  }
}
function touchCredentials(profile) {
  const existing = readCredentials(profile);
  if (!existing) {
    return;
  }
  const next = {
    ...existing,
    lastUsedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  const dir = resolveCredentialsDir();
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(resolveCredentialsPath(profile), JSON.stringify(next, null, 2), "utf-8");
}
function writeCredentials(profile, credentials) {
  const dir = resolveCredentialsDir();
  fs.mkdirSync(dir, { recursive: true });
  const existing = readCredentials(profile);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const next = {
    ...credentials,
    createdAt: existing?.createdAt ?? now,
    lastUsedAt: now
  };
  fs.writeFileSync(resolveCredentialsPath(profile), JSON.stringify(next, null, 2), "utf-8");
}
function clearCredentials(profile) {
  const filePath = resolveCredentialsPath(profile);
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
  } catch {
  }
  return false;
}
async function ensureApi(profileInput, timeoutMs = API_LOGIN_TIMEOUT_MS) {
  const profile = normalizeProfile(profileInput);
  const cached = apiByProfile.get(profile);
  if (cached) {
    return cached;
  }
  const pending = apiInitByProfile.get(profile);
  if (pending) {
    return await pending;
  }
  const initPromise = (async () => {
    const stored = readCredentials(profile);
    if (!stored) {
      throw new Error(`No saved Zalo session for profile "${profile}"`);
    }
    const zalo = new Zalo({
      logging: false,
      selfListen: false
    });
    const api = await withTimeout(
      zalo.login({
        imei: stored.imei,
        cookie: stored.cookie,
        userAgent: stored.userAgent,
        language: stored.language
      }),
      timeoutMs,
      `Timed out restoring Zalo session for profile "${profile}"`
    );
    apiByProfile.set(profile, api);
    touchCredentials(profile);
    return api;
  })();
  apiInitByProfile.set(profile, initPromise);
  try {
    return await initPromise;
  } catch (error) {
    apiByProfile.delete(profile);
    throw error;
  } finally {
    apiInitByProfile.delete(profile);
  }
}
function invalidateApi(profileInput) {
  const profile = normalizeProfile(profileInput);
  const api = apiByProfile.get(profile);
  if (api) {
    try {
      api.listener.stop();
    } catch {
    }
  }
  apiByProfile.delete(profile);
  apiInitByProfile.delete(profile);
}
function isQrLoginFresh(login) {
  return Date.now() - login.startedAt < QR_LOGIN_TTL_MS;
}
function resetQrLogin(profileInput) {
  const profile = normalizeProfile(profileInput);
  const active = activeQrLogins.get(profile);
  if (!active) {
    return;
  }
  try {
    active.abort?.();
  } catch {
  }
  activeQrLogins.delete(profile);
}
async function fetchGroupsByIds(api, ids) {
  const result = /* @__PURE__ */ new Map();
  for (let index = 0; index < ids.length; index += GROUP_INFO_CHUNK_SIZE) {
    const chunk = ids.slice(index, index + GROUP_INFO_CHUNK_SIZE);
    if (chunk.length === 0) {
      continue;
    }
    const response = await api.getGroupInfo(chunk);
    const map = response.gridInfoMap ?? {};
    for (const [groupId, info] of Object.entries(map)) {
      result.set(groupId, info);
    }
  }
  return result;
}
function makeGroupContextCacheKey(profile, groupId) {
  return `${profile}:${groupId}`;
}
function readCachedGroupContext(profile, groupId) {
  const key = makeGroupContextCacheKey(profile, groupId);
  const cached = groupContextCache.get(key);
  if (!cached) {
    return null;
  }
  if (cached.expiresAt <= Date.now()) {
    groupContextCache.delete(key);
    return null;
  }
  groupContextCache.delete(key);
  groupContextCache.set(key, cached);
  return cached.value;
}
function trimGroupContextCache(now) {
  for (const [key, value] of groupContextCache) {
    if (value.expiresAt > now) {
      continue;
    }
    groupContextCache.delete(key);
  }
  while (groupContextCache.size > GROUP_CONTEXT_CACHE_MAX_ENTRIES) {
    const oldestKey = groupContextCache.keys().next().value;
    if (!oldestKey) {
      break;
    }
    groupContextCache.delete(oldestKey);
  }
}
function writeCachedGroupContext(profile, context) {
  const now = Date.now();
  const key = makeGroupContextCacheKey(profile, context.groupId);
  if (groupContextCache.has(key)) {
    groupContextCache.delete(key);
  }
  groupContextCache.set(key, {
    value: context,
    expiresAt: now + GROUP_CONTEXT_CACHE_TTL_MS
  });
  trimGroupContextCache(now);
}
function clearCachedGroupContext(profile) {
  for (const key of groupContextCache.keys()) {
    if (key.startsWith(`${profile}:`)) {
      groupContextCache.delete(key);
    }
  }
}
function extractGroupMembersFromInfo(groupInfo) {
  if (!groupInfo || !Array.isArray(groupInfo.currentMems)) {
    return void 0;
  }
  const members = groupInfo.currentMems.map((member) => {
    if (!member || typeof member !== "object") {
      return "";
    }
    const record = member;
    return toStringValue(record.dName) || toStringValue(record.zaloName);
  }).filter(Boolean);
  if (members.length === 0) {
    return void 0;
  }
  return members;
}
function toInboundMessage(message, ownUserId) {
  const data = message.data;
  const isGroup = message.type === ThreadType.Group;
  const senderId = toNumberId(data.uidFrom);
  const threadId = isGroup ? toNumberId(data.idTo) : toNumberId(data.uidFrom) || toNumberId(data.idTo);
  if (!threadId || !senderId) {
    return null;
  }
  const content = normalizeMessageContent(data.content);
  const normalizedOwnUserId = toNumberId(ownUserId);
  const mentionIds = extractMentionIds(data.mentions);
  const quoteOwnerId = data.quote && typeof data.quote === "object" ? toNumberId(data.quote.ownerId) : "";
  const hasAnyMention = mentionIds.length > 0;
  const canResolveExplicitMention = Boolean(normalizedOwnUserId);
  const wasExplicitlyMentioned = Boolean(
    normalizedOwnUserId && mentionIds.some((id) => id === normalizedOwnUserId)
  );
  const implicitMention = Boolean(
    normalizedOwnUserId && quoteOwnerId && quoteOwnerId === normalizedOwnUserId
  );
  const eventMessage = buildEventMessage(data);
  return {
    threadId,
    isGroup,
    senderId,
    senderName: typeof data.dName === "string" ? data.dName.trim() || void 0 : void 0,
    groupName: isGroup ? resolveGroupNameFromMessageData(data) : void 0,
    content,
    timestampMs: resolveInboundTimestamp(data.ts),
    msgId: typeof data.msgId === "string" ? data.msgId : void 0,
    cliMsgId: typeof data.cliMsgId === "string" ? data.cliMsgId : void 0,
    hasAnyMention,
    canResolveExplicitMention,
    wasExplicitlyMentioned,
    implicitMention,
    eventMessage,
    raw: message
  };
}
function zalouserSessionExists(profileInput) {
  const profile = normalizeProfile(profileInput);
  return readCredentials(profile) !== null;
}
async function checkZaloAuthenticated(profileInput) {
  const profile = normalizeProfile(profileInput);
  if (!zalouserSessionExists(profile)) {
    return false;
  }
  try {
    const api = await ensureApi(profile, 12e3);
    await withTimeout(api.fetchAccountInfo(), 12e3, "Timed out checking Zalo session");
    return true;
  } catch {
    invalidateApi(profile);
    return false;
  }
}
async function getZaloUserInfo(profileInput) {
  const profile = normalizeProfile(profileInput);
  const api = await ensureApi(profile);
  const info = await api.fetchAccountInfo();
  const user = info && typeof info === "object" && "profile" in info ? info.profile : info;
  if (!user?.userId) {
    return null;
  }
  return {
    userId: String(user.userId),
    displayName: user.displayName || user.zaloName || String(user.userId),
    avatar: user.avatar || void 0
  };
}
async function listZaloFriends(profileInput) {
  const profile = normalizeProfile(profileInput);
  const api = await ensureApi(profile);
  const friends = await api.getAllFriends();
  return friends.map(mapFriend);
}
async function listZaloFriendsMatching(profileInput, query) {
  const friends = await listZaloFriends(profileInput);
  const q = query?.trim().toLowerCase();
  if (!q) {
    return friends;
  }
  const scored = friends.map((friend) => {
    const id = friend.userId.toLowerCase();
    const name = friend.displayName.toLowerCase();
    const exact = id === q || name === q;
    const includes = id.includes(q) || name.includes(q);
    return { friend, exact, includes };
  }).filter((entry) => entry.includes).sort((a, b) => Number(b.exact) - Number(a.exact));
  return scored.map((entry) => entry.friend);
}
async function listZaloGroups(profileInput) {
  const profile = normalizeProfile(profileInput);
  const api = await ensureApi(profile);
  const allGroups = await api.getAllGroups();
  const ids = Object.keys(allGroups.gridVerMap ?? {});
  if (ids.length === 0) {
    return [];
  }
  const details = await fetchGroupsByIds(api, ids);
  const rows = [];
  for (const id of ids) {
    const info = details.get(id);
    if (!info) {
      rows.push({ groupId: id, name: id });
      continue;
    }
    rows.push(mapGroup(id, info));
  }
  return rows;
}
async function listZaloGroupsMatching(profileInput, query) {
  const groups = await listZaloGroups(profileInput);
  const q = query?.trim().toLowerCase();
  if (!q) {
    return groups;
  }
  return groups.filter((group) => {
    const id = group.groupId.toLowerCase();
    const name = group.name.toLowerCase();
    return id.includes(q) || name.includes(q);
  });
}
async function listZaloGroupMembers(profileInput, groupId) {
  const profile = normalizeProfile(profileInput);
  const api = await ensureApi(profile);
  const infoResponse = await api.getGroupInfo(groupId);
  const groupInfo = infoResponse.gridInfoMap?.[groupId];
  if (!groupInfo) {
    return [];
  }
  const memberIds = Array.isArray(groupInfo.memberIds) ? groupInfo.memberIds.map((id) => toNumberId(id)).filter(Boolean) : [];
  const memVerIds = Array.isArray(groupInfo.memVerList) ? groupInfo.memVerList.map((id) => toNumberId(id)).filter(Boolean) : [];
  const currentMembers = Array.isArray(groupInfo.currentMems) ? groupInfo.currentMems : [];
  const currentById = /* @__PURE__ */ new Map();
  for (const member of currentMembers) {
    const id = toNumberId(member?.id);
    if (!id) {
      continue;
    }
    currentById.set(id, {
      displayName: member.dName?.trim() || member.zaloName?.trim() || void 0,
      avatar: member.avatar || void 0
    });
  }
  const uniqueIds = Array.from(
    /* @__PURE__ */ new Set([...memberIds, ...memVerIds, ...currentById.keys()])
  );
  const profileMap = /* @__PURE__ */ new Map();
  if (uniqueIds.length > 0) {
    const profiles = await api.getGroupMembersInfo(uniqueIds);
    const profileEntries = profiles.profiles;
    for (const [rawId, profileValue] of Object.entries(profileEntries)) {
      const id = toNumberId(rawId) || toNumberId(profileValue?.id);
      if (!id || !profileValue) {
        continue;
      }
      profileMap.set(id, {
        displayName: profileValue.displayName?.trim() || profileValue.zaloName?.trim() || void 0,
        avatar: profileValue.avatar || void 0
      });
    }
  }
  return uniqueIds.map((id) => ({
    userId: id,
    displayName: profileMap.get(id)?.displayName || currentById.get(id)?.displayName || id,
    avatar: profileMap.get(id)?.avatar || currentById.get(id)?.avatar
  }));
}
async function resolveZaloGroupContext(profileInput, groupId) {
  const profile = normalizeProfile(profileInput);
  const normalizedGroupId = toNumberId(groupId) || groupId.trim();
  if (!normalizedGroupId) {
    throw new Error("groupId is required");
  }
  const cached = readCachedGroupContext(profile, normalizedGroupId);
  if (cached) {
    return cached;
  }
  const api = await ensureApi(profile);
  const response = await api.getGroupInfo(normalizedGroupId);
  const groupInfo = response.gridInfoMap?.[normalizedGroupId];
  const context = {
    groupId: normalizedGroupId,
    name: groupInfo?.name?.trim() || void 0,
    members: extractGroupMembersFromInfo(groupInfo)
  };
  writeCachedGroupContext(profile, context);
  return context;
}
async function sendZaloTextMessage(threadId, text, options = {}) {
  const profile = normalizeProfile(options.profile);
  const trimmedThreadId = threadId.trim();
  if (!trimmedThreadId) {
    return { ok: false, error: "No threadId provided" };
  }
  const api = await ensureApi(profile);
  const type = options.isGroup ? ThreadType.Group : ThreadType.User;
  try {
    if (options.mediaUrl?.trim()) {
      const media = await loadOutboundMediaFromUrl(options.mediaUrl.trim(), {
        mediaLocalRoots: options.mediaLocalRoots
      });
      const fileName = resolveMediaFileName({
        mediaUrl: options.mediaUrl,
        fileName: media.fileName,
        contentType: media.contentType,
        kind: media.kind
      });
      const payloadText = (text || options.caption || "").slice(0, 2e3);
      const response2 = await api.sendMessage(
        {
          msg: payloadText,
          attachments: [
            {
              data: media.buffer,
              filename: fileName.includes(".") ? fileName : `${fileName}.bin`,
              metadata: {
                totalSize: media.buffer.length
              }
            }
          ]
        },
        trimmedThreadId,
        type
      );
      return { ok: true, messageId: extractSendMessageId(response2) };
    }
    const response = await api.sendMessage(text.slice(0, 2e3), trimmedThreadId, type);
    return { ok: true, messageId: extractSendMessageId(response) };
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) };
  }
}
async function sendZaloTypingEvent(threadId, options = {}) {
  const profile = normalizeProfile(options.profile);
  const trimmedThreadId = threadId.trim();
  if (!trimmedThreadId) {
    throw new Error("No threadId provided");
  }
  const api = await ensureApi(profile);
  const type = options.isGroup ? ThreadType.Group : ThreadType.User;
  if ("sendTypingEvent" in api && typeof api.sendTypingEvent === "function") {
    await api.sendTypingEvent(trimmedThreadId, type);
  }
}
async function resolveOwnUserId(api) {
  const info = await api.fetchAccountInfo();
  const profile = "profile" in info ? info.profile : info;
  return toNumberId(profile.userId);
}
async function sendZaloReaction(params) {
  const profile = normalizeProfile(params.profile);
  const threadId = params.threadId.trim();
  const msgId = toStringValue(params.msgId);
  const cliMsgId = toStringValue(params.cliMsgId);
  if (!threadId || !msgId || !cliMsgId) {
    return { ok: false, error: "threadId, msgId, and cliMsgId are required" };
  }
  try {
    const api = await ensureApi(profile);
    const type = params.isGroup ? ThreadType.Group : ThreadType.User;
    const icon = params.remove ? { rType: -1, source: 6, icon: "" } : normalizeZaloReactionIcon(params.emoji);
    await api.addReaction(icon, {
      data: { msgId, cliMsgId },
      threadId,
      type
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) };
  }
}
async function sendZaloDeliveredEvent(params) {
  const profile = normalizeProfile(params.profile);
  const api = await ensureApi(profile);
  const type = params.isGroup ? ThreadType.Group : ThreadType.User;
  await api.sendDeliveredEvent(params.isSeen === true, params.message, type);
}
async function sendZaloSeenEvent(params) {
  const profile = normalizeProfile(params.profile);
  const api = await ensureApi(profile);
  const type = params.isGroup ? ThreadType.Group : ThreadType.User;
  await api.sendSeenEvent(params.message, type);
}
async function sendZaloLink(threadId, url, options = {}) {
  const profile = normalizeProfile(options.profile);
  const trimmedThreadId = threadId.trim();
  const trimmedUrl = url.trim();
  if (!trimmedThreadId) {
    return { ok: false, error: "No threadId provided" };
  }
  if (!trimmedUrl) {
    return { ok: false, error: "No URL provided" };
  }
  try {
    const api = await ensureApi(profile);
    const type = options.isGroup ? ThreadType.Group : ThreadType.User;
    const response = await api.sendLink(
      { link: trimmedUrl, msg: options.caption },
      trimmedThreadId,
      type
    );
    return { ok: true, messageId: String(response.msgId) };
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) };
  }
}
async function startZaloQrLogin(params) {
  const profile = normalizeProfile(params.profile);
  if (!params.force && await checkZaloAuthenticated(profile)) {
    const info = await getZaloUserInfo(profile).catch(() => null);
    const name = info?.displayName ? ` (${info.displayName})` : "";
    return {
      message: `Zalo is already linked${name}.`
    };
  }
  if (params.force) {
    await logoutZaloProfile(profile);
  }
  const existing = activeQrLogins.get(profile);
  if (existing && isQrLoginFresh(existing)) {
    if (existing.qrDataUrl) {
      return {
        qrDataUrl: existing.qrDataUrl,
        message: "QR already active. Scan it with the Zalo app."
      };
    }
  } else if (existing) {
    resetQrLogin(profile);
  }
  if (!activeQrLogins.has(profile)) {
    const login = {
      id: randomUUID(),
      profile,
      startedAt: Date.now(),
      connected: false,
      waitPromise: Promise.resolve()
    };
    login.waitPromise = (async () => {
      let capturedCredentials = null;
      try {
        const zalo = new Zalo({ logging: false, selfListen: false });
        const api = await zalo.loginQR(void 0, (event) => {
          const current2 = activeQrLogins.get(profile);
          if (!current2 || current2.id !== login.id) {
            return;
          }
          if (event.actions?.abort) {
            current2.abort = () => {
              try {
                event.actions?.abort?.();
              } catch {
              }
            };
          }
          switch (event.type) {
            case LoginQRCallbackEventType.QRCodeGenerated: {
              const image = event.data.image.replace(/^data:image\/png;base64,/, "");
              current2.qrDataUrl = image.startsWith("data:image") ? image : `data:image/png;base64,${image}`;
              break;
            }
            case LoginQRCallbackEventType.QRCodeExpired: {
              try {
                event.actions.retry();
              } catch {
                current2.error = "QR expired before confirmation. Start login again.";
              }
              break;
            }
            case LoginQRCallbackEventType.QRCodeDeclined: {
              current2.error = "QR login was declined on the phone.";
              break;
            }
            case LoginQRCallbackEventType.GotLoginInfo: {
              capturedCredentials = {
                imei: event.data.imei,
                cookie: event.data.cookie,
                userAgent: event.data.userAgent
              };
              break;
            }
            default:
              break;
          }
        });
        const current = activeQrLogins.get(profile);
        if (!current || current.id !== login.id) {
          return;
        }
        if (!capturedCredentials) {
          const ctx = api.getContext();
          const cookieJar = api.getCookie();
          const cookieJson = cookieJar.toJSON();
          capturedCredentials = {
            imei: ctx.imei,
            cookie: cookieJson?.cookies ?? [],
            userAgent: ctx.userAgent,
            language: ctx.language
          };
        }
        writeCredentials(profile, capturedCredentials);
        invalidateApi(profile);
        apiByProfile.set(profile, api);
        current.connected = true;
      } catch (error) {
        const current = activeQrLogins.get(profile);
        if (current && current.id === login.id) {
          current.error = toErrorMessage(error);
        }
      }
    })();
    activeQrLogins.set(profile, login);
  }
  const active = activeQrLogins.get(profile);
  if (!active) {
    return { message: "Failed to initialize Zalo QR login." };
  }
  const timeoutMs = Math.max(params.timeoutMs ?? DEFAULT_QR_START_TIMEOUT_MS, 3e3);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (active.error) {
      resetQrLogin(profile);
      return {
        message: `Failed to start QR login: ${active.error}`
      };
    }
    if (active.connected) {
      resetQrLogin(profile);
      return {
        message: "Zalo already connected."
      };
    }
    if (active.qrDataUrl) {
      return {
        qrDataUrl: active.qrDataUrl,
        message: "Scan this QR with the Zalo app."
      };
    }
    await delay(150);
  }
  return {
    message: "Still preparing QR. Call wait to continue checking login status."
  };
}
async function waitForZaloQrLogin(params) {
  const profile = normalizeProfile(params.profile);
  const active = activeQrLogins.get(profile);
  if (!active) {
    const connected = await checkZaloAuthenticated(profile);
    return {
      connected,
      message: connected ? "Zalo session is ready." : "No active Zalo QR login in progress."
    };
  }
  if (!isQrLoginFresh(active)) {
    resetQrLogin(profile);
    return {
      connected: false,
      message: "QR login expired. Start again to generate a fresh QR code."
    };
  }
  const timeoutMs = Math.max(params.timeoutMs ?? DEFAULT_QR_WAIT_TIMEOUT_MS, 1e3);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (active.error) {
      const message = `Zalo login failed: ${active.error}`;
      resetQrLogin(profile);
      return {
        connected: false,
        message
      };
    }
    if (active.connected) {
      resetQrLogin(profile);
      return {
        connected: true,
        message: "Login successful."
      };
    }
    await Promise.race([active.waitPromise, delay(400)]);
  }
  return {
    connected: false,
    message: "Still waiting for QR scan confirmation."
  };
}
async function logoutZaloProfile(profileInput) {
  const profile = normalizeProfile(profileInput);
  resetQrLogin(profile);
  clearCachedGroupContext(profile);
  const listener = activeListeners.get(profile);
  if (listener) {
    try {
      listener.stop();
    } catch {
    }
    activeListeners.delete(profile);
  }
  invalidateApi(profile);
  const cleared = clearCredentials(profile);
  return {
    cleared,
    loggedOut: true,
    message: cleared ? "Logged out and cleared local session." : "No local session to clear."
  };
}
async function startZaloListener(params) {
  const profile = normalizeProfile(params.profile);
  const existing = activeListeners.get(profile);
  if (existing) {
    throw new Error(
      `Zalo listener already running for profile "${profile}" (account "${existing.accountId}")`
    );
  }
  const api = await ensureApi(profile);
  const ownUserId = await resolveOwnUserId(api);
  let stopped = false;
  const cleanup = () => {
    if (stopped) {
      return;
    }
    stopped = true;
    try {
      api.listener.off("message", onMessage);
      api.listener.off("error", onError);
      api.listener.off("closed", onClosed);
    } catch {
    }
    try {
      api.listener.stop();
    } catch {
    }
    activeListeners.delete(profile);
  };
  const onMessage = (incoming) => {
    if (incoming.isSelf) {
      return;
    }
    const normalized = toInboundMessage(incoming, ownUserId);
    if (!normalized) {
      return;
    }
    params.onMessage(normalized);
  };
  const onError = (error) => {
    if (stopped || params.abortSignal.aborted) {
      return;
    }
    const wrapped = error instanceof Error ? error : new Error(String(error));
    params.onError(wrapped);
  };
  const onClosed = (code, reason) => {
    if (stopped || params.abortSignal.aborted) {
      return;
    }
    params.onError(new Error(`Zalo listener closed (${code}): ${reason || "no reason"}`));
  };
  api.listener.on("message", onMessage);
  api.listener.on("error", onError);
  api.listener.on("closed", onClosed);
  try {
    api.listener.start({ retryOnClose: true });
  } catch (error) {
    cleanup();
    throw error;
  }
  params.abortSignal.addEventListener(
    "abort",
    () => {
      cleanup();
    },
    { once: true }
  );
  activeListeners.set(profile, {
    profile,
    accountId: params.accountId,
    stop: cleanup
  });
  return { stop: cleanup };
}
async function resolveZaloGroupsByEntries(params) {
  const groups = await listZaloGroups(params.profile);
  const byName = /* @__PURE__ */ new Map();
  for (const group of groups) {
    const key = group.name.trim().toLowerCase();
    if (!key) {
      continue;
    }
    const list = byName.get(key) ?? [];
    list.push(group);
    byName.set(key, list);
  }
  return params.entries.map((input) => {
    const trimmed = input.trim();
    if (!trimmed) {
      return { input, resolved: false };
    }
    if (/^\d+$/.test(trimmed)) {
      return { input, resolved: true, id: trimmed };
    }
    const candidates = byName.get(trimmed.toLowerCase()) ?? [];
    const match = candidates[0];
    return match ? { input, resolved: true, id: match.groupId } : { input, resolved: false };
  });
}
async function resolveZaloAllowFromEntries(params) {
  const friends = await listZaloFriends(params.profile);
  const byName = /* @__PURE__ */ new Map();
  for (const friend of friends) {
    const key = friend.displayName.trim().toLowerCase();
    if (!key) {
      continue;
    }
    const list = byName.get(key) ?? [];
    list.push(friend);
    byName.set(key, list);
  }
  return params.entries.map((input) => {
    const trimmed = input.trim();
    if (!trimmed) {
      return { input, resolved: false };
    }
    if (/^\d+$/.test(trimmed)) {
      return { input, resolved: true, id: trimmed };
    }
    const matches = byName.get(trimmed.toLowerCase()) ?? [];
    const match = matches[0];
    if (!match) {
      return { input, resolved: false };
    }
    return {
      input,
      resolved: true,
      id: match.userId,
      note: matches.length > 1 ? "multiple matches; chose first" : void 0
    };
  });
}
var API_LOGIN_TIMEOUT_MS, QR_LOGIN_TTL_MS, DEFAULT_QR_START_TIMEOUT_MS, DEFAULT_QR_WAIT_TIMEOUT_MS, GROUP_INFO_CHUNK_SIZE, GROUP_CONTEXT_CACHE_TTL_MS, GROUP_CONTEXT_CACHE_MAX_ENTRIES, apiByProfile, apiInitByProfile, activeQrLogins, activeListeners, groupContextCache;
var init_zalo_js = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/zalouser/src/zalo-js.ts"() {
    "use strict";
    init_reaction();
    init_runtime();
    init_zca_client();
    API_LOGIN_TIMEOUT_MS = 2e4;
    QR_LOGIN_TTL_MS = 3 * 6e4;
    DEFAULT_QR_START_TIMEOUT_MS = 3e4;
    DEFAULT_QR_WAIT_TIMEOUT_MS = 12e4;
    GROUP_INFO_CHUNK_SIZE = 80;
    GROUP_CONTEXT_CACHE_TTL_MS = 5 * 6e4;
    GROUP_CONTEXT_CACHE_MAX_ENTRIES = 500;
    apiByProfile = /* @__PURE__ */ new Map();
    apiInitByProfile = /* @__PURE__ */ new Map();
    activeQrLogins = /* @__PURE__ */ new Map();
    activeListeners = /* @__PURE__ */ new Map();
    groupContextCache = /* @__PURE__ */ new Map();
  }
});

// vendor/openclaw-runtime/win-x64/extensions/zalouser/src/group-policy.ts
function toGroupCandidate(value) {
  return value?.trim() ?? "";
}
function normalizeZalouserGroupSlug(raw) {
  const trimmed = raw?.trim().toLowerCase() ?? "";
  if (!trimmed) {
    return "";
  }
  return trimmed.replace(/^#/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
function buildZalouserGroupCandidates(params) {
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  const push = (value) => {
    const normalized = toGroupCandidate(value);
    if (!normalized || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    out.push(normalized);
  };
  const groupId = toGroupCandidate(params.groupId);
  const groupChannel = toGroupCandidate(params.groupChannel);
  const groupName = toGroupCandidate(params.groupName);
  push(groupId);
  if (params.includeGroupIdAlias === true && groupId) {
    push(`group:${groupId}`);
  }
  push(groupChannel);
  push(groupName);
  if (groupName) {
    push(normalizeZalouserGroupSlug(groupName));
  }
  if (params.includeWildcard !== false) {
    push("*");
  }
  return out;
}
function findZalouserGroupEntry(groups, candidates) {
  if (!groups) {
    return void 0;
  }
  for (const candidate of candidates) {
    const entry = groups[candidate];
    if (entry) {
      return entry;
    }
  }
  return void 0;
}
function isZalouserGroupEntryAllowed(entry) {
  if (!entry) {
    return false;
  }
  return entry.allow !== false && entry.enabled !== false;
}
var init_group_policy = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/zalouser/src/group-policy.ts"() {
    "use strict";
  }
});

// vendor/openclaw-runtime/win-x64/extensions/zalouser/src/message-sid.ts
function toMessageSidPart(value) {
  if (typeof value === "string") {
    return value.trim();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(Math.trunc(value));
  }
  return "";
}
function parseZalouserMessageSidFull(value) {
  const raw = toMessageSidPart(value);
  if (!raw) {
    return null;
  }
  const [msgIdPart, cliMsgIdPart] = raw.split(":").map((entry) => entry.trim());
  if (!msgIdPart || !cliMsgIdPart) {
    return null;
  }
  return { msgId: msgIdPart, cliMsgId: cliMsgIdPart };
}
function resolveZalouserReactionMessageIds(params) {
  const explicitMessageId = toMessageSidPart(params.messageId);
  const explicitCliMsgId = toMessageSidPart(params.cliMsgId);
  if (explicitMessageId && explicitCliMsgId) {
    return { msgId: explicitMessageId, cliMsgId: explicitCliMsgId };
  }
  const parsedFromCurrent = parseZalouserMessageSidFull(params.currentMessageId);
  if (parsedFromCurrent) {
    return parsedFromCurrent;
  }
  const currentRaw = toMessageSidPart(params.currentMessageId);
  if (!currentRaw) {
    return null;
  }
  if (explicitMessageId && !explicitCliMsgId) {
    return { msgId: explicitMessageId, cliMsgId: currentRaw };
  }
  if (!explicitMessageId && explicitCliMsgId) {
    return { msgId: currentRaw, cliMsgId: explicitCliMsgId };
  }
  return { msgId: currentRaw, cliMsgId: currentRaw };
}
function formatZalouserMessageSidFull(params) {
  const msgId = toMessageSidPart(params.msgId);
  const cliMsgId = toMessageSidPart(params.cliMsgId);
  if (!msgId && !cliMsgId) {
    return void 0;
  }
  if (msgId && cliMsgId) {
    return `${msgId}:${cliMsgId}`;
  }
  return msgId || cliMsgId || void 0;
}
function resolveZalouserMessageSid(params) {
  const msgId = toMessageSidPart(params.msgId);
  const cliMsgId = toMessageSidPart(params.cliMsgId);
  if (msgId || cliMsgId) {
    return msgId || cliMsgId;
  }
  return toMessageSidPart(params.fallback) || void 0;
}
var init_message_sid = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/zalouser/src/message-sid.ts"() {
    "use strict";
  }
});

// vendor/openclaw-runtime/win-x64/extensions/zalouser/src/send.ts
async function sendMessageZalouser(threadId, text, options = {}) {
  return await sendZaloTextMessage(threadId, text, options);
}
async function sendImageZalouser(threadId, imageUrl, options = {}) {
  return await sendZaloTextMessage(threadId, options.caption ?? "", {
    ...options,
    mediaUrl: imageUrl
  });
}
async function sendLinkZalouser(threadId, url, options = {}) {
  return await sendZaloLink(threadId, url, options);
}
async function sendTypingZalouser(threadId, options = {}) {
  await sendZaloTypingEvent(threadId, options);
}
async function sendReactionZalouser(params) {
  const result = await sendZaloReaction({
    profile: params.profile,
    threadId: params.threadId,
    isGroup: params.isGroup,
    msgId: params.msgId,
    cliMsgId: params.cliMsgId,
    emoji: params.emoji,
    remove: params.remove
  });
  return {
    ok: result.ok,
    error: result.error
  };
}
async function sendDeliveredZalouser(params) {
  await sendZaloDeliveredEvent(params);
}
async function sendSeenZalouser(params) {
  await sendZaloSeenEvent(params);
}
var init_send = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/zalouser/src/send.ts"() {
    "use strict";
    init_zalo_js();
  }
});

// vendor/openclaw-runtime/win-x64/extensions/zalouser/src/monitor.ts
var monitor_exports = {};
__export(monitor_exports, {
  __testing: () => __testing,
  monitorZalouserProvider: () => monitorZalouserProvider
});
import {
  createTypingCallbacks,
  createScopedPairingAccess,
  createReplyPrefixOptions,
  resolveOutboundMediaUrls,
  mergeAllowlist,
  resolveMentionGatingWithBypass,
  resolveOpenProviderRuntimeGroupPolicy,
  resolveDefaultGroupPolicy,
  resolveSenderCommandAuthorization,
  sendMediaWithLeadingCaption,
  summarizeMapping,
  warnMissingProviderGroupPolicyFallbackOnce
} from "openclaw/plugin-sdk";
function normalizeZalouserEntry(entry) {
  return entry.replace(/^(zalouser|zlu):/i, "").trim();
}
function buildNameIndex(items, nameFn) {
  const index = /* @__PURE__ */ new Map();
  for (const item of items) {
    const name = nameFn(item)?.trim().toLowerCase();
    if (!name) {
      continue;
    }
    const list = index.get(name) ?? [];
    list.push(item);
    index.set(name, list);
  }
  return index;
}
function logVerbose(core, runtime2, message) {
  if (core.logging.shouldLogVerbose()) {
    runtime2.log(`[zalouser] ${message}`);
  }
}
function isSenderAllowed(senderId, allowFrom) {
  if (allowFrom.includes("*")) {
    return true;
  }
  const normalizedSenderId = senderId?.trim().toLowerCase();
  if (!normalizedSenderId) {
    return false;
  }
  return allowFrom.some((entry) => {
    const normalized = entry.toLowerCase().replace(/^(zalouser|zlu):/i, "");
    return normalized === normalizedSenderId;
  });
}
function isGroupAllowed(params) {
  const groups = params.groups ?? {};
  const keys = Object.keys(groups);
  if (keys.length === 0) {
    return false;
  }
  const entry = findZalouserGroupEntry(
    groups,
    buildZalouserGroupCandidates({
      groupId: params.groupId,
      groupName: params.groupName,
      includeGroupIdAlias: true,
      includeWildcard: true
    })
  );
  return isZalouserGroupEntryAllowed(entry);
}
function resolveGroupRequireMention(params) {
  const entry = findZalouserGroupEntry(
    params.groups ?? {},
    buildZalouserGroupCandidates({
      groupId: params.groupId,
      groupName: params.groupName,
      includeGroupIdAlias: true,
      includeWildcard: true
    })
  );
  if (typeof entry?.requireMention === "boolean") {
    return entry.requireMention;
  }
  return true;
}
async function sendZalouserDeliveryAcks(params) {
  await sendDeliveredZalouser({
    profile: params.profile,
    isGroup: params.isGroup,
    message: params.message,
    isSeen: true
  });
  await sendSeenZalouser({
    profile: params.profile,
    isGroup: params.isGroup,
    message: params.message
  });
}
async function processMessage(message, account, config, core, runtime2, statusSink) {
  const pairing = createScopedPairingAccess({
    core,
    channel: "zalouser",
    accountId: account.accountId
  });
  const rawBody = message.content?.trim();
  if (!rawBody) {
    return;
  }
  const isGroup = message.isGroup;
  const chatId = message.threadId;
  const senderId = message.senderId?.trim();
  if (!senderId) {
    logVerbose(core, runtime2, `zalouser: drop message ${chatId} (missing senderId)`);
    return;
  }
  const senderName = message.senderName ?? "";
  const configuredGroupName = message.groupName?.trim() || "";
  const groupContext = isGroup && !configuredGroupName ? await resolveZaloGroupContext(account.profile, chatId).catch((err) => {
    logVerbose(
      core,
      runtime2,
      `zalouser: group context lookup failed for ${chatId}: ${String(err)}`
    );
    return null;
  }) : null;
  const groupName = configuredGroupName || groupContext?.name?.trim() || "";
  const groupMembers = groupContext?.members?.slice(0, 20).join(", ") || void 0;
  if (message.eventMessage) {
    try {
      await sendZalouserDeliveryAcks({
        profile: account.profile,
        isGroup,
        message: message.eventMessage
      });
    } catch (err) {
      logVerbose(core, runtime2, `zalouser: delivery/seen ack failed for ${chatId}: ${String(err)}`);
    }
  }
  const defaultGroupPolicy = resolveDefaultGroupPolicy(config);
  const { groupPolicy, providerMissingFallbackApplied } = resolveOpenProviderRuntimeGroupPolicy({
    providerConfigPresent: config.channels?.zalouser !== void 0,
    groupPolicy: account.config.groupPolicy,
    defaultGroupPolicy
  });
  warnMissingProviderGroupPolicyFallbackOnce({
    providerMissingFallbackApplied,
    providerKey: "zalouser",
    accountId: account.accountId,
    log: (entry) => logVerbose(core, runtime2, entry)
  });
  const groups = account.config.groups ?? {};
  if (isGroup) {
    if (groupPolicy === "disabled") {
      logVerbose(core, runtime2, `zalouser: drop group ${chatId} (groupPolicy=disabled)`);
      return;
    }
    if (groupPolicy === "allowlist") {
      const allowed = isGroupAllowed({ groupId: chatId, groupName, groups });
      if (!allowed) {
        logVerbose(core, runtime2, `zalouser: drop group ${chatId} (not allowlisted)`);
        return;
      }
    }
  }
  const dmPolicy2 = account.config.dmPolicy ?? "pairing";
  const configAllowFrom = (account.config.allowFrom ?? []).map((v) => String(v));
  const { senderAllowedForCommands, commandAuthorized } = await resolveSenderCommandAuthorization({
    cfg: config,
    rawBody,
    isGroup,
    dmPolicy: dmPolicy2,
    configuredAllowFrom: configAllowFrom,
    senderId,
    isSenderAllowed,
    readAllowFromStore: pairing.readAllowFromStore,
    shouldComputeCommandAuthorized: (body2, cfg) => core.channel.commands.shouldComputeCommandAuthorized(body2, cfg),
    resolveCommandAuthorizedFromAuthorizers: (params) => core.channel.commands.resolveCommandAuthorizedFromAuthorizers(params)
  });
  if (!isGroup) {
    if (dmPolicy2 === "disabled") {
      logVerbose(core, runtime2, `Blocked zalouser DM from ${senderId} (dmPolicy=disabled)`);
      return;
    }
    if (dmPolicy2 !== "open") {
      const allowed = senderAllowedForCommands;
      if (!allowed) {
        if (dmPolicy2 === "pairing") {
          const { code, created } = await pairing.upsertPairingRequest({
            id: senderId,
            meta: { name: senderName || void 0 }
          });
          if (created) {
            logVerbose(core, runtime2, `zalouser pairing request sender=${senderId}`);
            try {
              await sendMessageZalouser(
                chatId,
                core.channel.pairing.buildPairingReply({
                  channel: "zalouser",
                  idLine: `Your Zalo user id: ${senderId}`,
                  code
                }),
                { profile: account.profile }
              );
              statusSink?.({ lastOutboundAt: Date.now() });
            } catch (err) {
              logVerbose(
                core,
                runtime2,
                `zalouser pairing reply failed for ${senderId}: ${String(err)}`
              );
            }
          }
        } else {
          logVerbose(
            core,
            runtime2,
            `Blocked unauthorized zalouser sender ${senderId} (dmPolicy=${dmPolicy2})`
          );
        }
        return;
      }
    }
  }
  const hasControlCommand = core.channel.commands.isControlCommandMessage(rawBody, config);
  if (isGroup && hasControlCommand && commandAuthorized !== true) {
    logVerbose(
      core,
      runtime2,
      `zalouser: drop control command from unauthorized sender ${senderId}`
    );
    return;
  }
  const peer = isGroup ? { kind: "group", id: chatId } : { kind: "group", id: senderId };
  const route = core.channel.routing.resolveAgentRoute({
    cfg: config,
    channel: "zalouser",
    accountId: account.accountId,
    peer: {
      // Use "group" kind to avoid dmScope=main collapsing all DMs into the main session.
      kind: peer.kind,
      id: peer.id
    }
  });
  const requireMention = isGroup ? resolveGroupRequireMention({
    groupId: chatId,
    groupName,
    groups
  }) : false;
  const mentionRegexes = core.channel.mentions.buildMentionRegexes(config, route.agentId);
  const explicitMention = {
    hasAnyMention: message.hasAnyMention === true,
    isExplicitlyMentioned: message.wasExplicitlyMentioned === true,
    canResolveExplicit: message.canResolveExplicitMention === true
  };
  const wasMentioned = isGroup ? core.channel.mentions.matchesMentionWithExplicit({
    text: rawBody,
    mentionRegexes,
    explicit: explicitMention
  }) : true;
  const mentionGate = resolveMentionGatingWithBypass({
    isGroup,
    requireMention,
    canDetectMention: mentionRegexes.length > 0 || explicitMention.canResolveExplicit,
    wasMentioned,
    implicitMention: message.implicitMention === true,
    hasAnyMention: explicitMention.hasAnyMention,
    allowTextCommands: core.channel.commands.shouldHandleTextCommands({
      cfg: config,
      surface: "zalouser"
    }),
    hasControlCommand,
    commandAuthorized: commandAuthorized === true
  });
  if (isGroup && mentionGate.shouldSkip) {
    logVerbose(core, runtime2, `zalouser: skip group ${chatId} (mention required, not mentioned)`);
    return;
  }
  const fromLabel = isGroup ? groupName || `group:${chatId}` : senderName || `user:${senderId}`;
  const storePath = core.channel.session.resolveStorePath(config.session?.store, {
    agentId: route.agentId
  });
  const envelopeOptions = core.channel.reply.resolveEnvelopeFormatOptions(config);
  const previousTimestamp = core.channel.session.readSessionUpdatedAt({
    storePath,
    sessionKey: route.sessionKey
  });
  const body = core.channel.reply.formatAgentEnvelope({
    channel: "Zalo Personal",
    from: fromLabel,
    timestamp: message.timestampMs,
    previousTimestamp,
    envelope: envelopeOptions,
    body: rawBody
  });
  const ctxPayload = core.channel.reply.finalizeInboundContext({
    Body: body,
    BodyForAgent: rawBody,
    RawBody: rawBody,
    CommandBody: rawBody,
    From: isGroup ? `zalouser:group:${chatId}` : `zalouser:${senderId}`,
    To: `zalouser:${chatId}`,
    SessionKey: route.sessionKey,
    AccountId: route.accountId,
    ChatType: isGroup ? "group" : "direct",
    ConversationLabel: fromLabel,
    GroupSubject: isGroup ? groupName || void 0 : void 0,
    GroupChannel: isGroup ? groupName || void 0 : void 0,
    GroupMembers: isGroup ? groupMembers : void 0,
    SenderName: senderName || void 0,
    SenderId: senderId,
    WasMentioned: isGroup ? mentionGate.effectiveWasMentioned : void 0,
    CommandAuthorized: commandAuthorized,
    Provider: "zalouser",
    Surface: "zalouser",
    MessageSid: resolveZalouserMessageSid({
      msgId: message.msgId,
      cliMsgId: message.cliMsgId,
      fallback: `${message.timestampMs}`
    }),
    MessageSidFull: formatZalouserMessageSidFull({
      msgId: message.msgId,
      cliMsgId: message.cliMsgId
    }),
    OriginatingChannel: "zalouser",
    OriginatingTo: `zalouser:${chatId}`
  });
  await core.channel.session.recordInboundSession({
    storePath,
    sessionKey: ctxPayload.SessionKey ?? route.sessionKey,
    ctx: ctxPayload,
    onRecordError: (err) => {
      runtime2.error?.(`zalouser: failed updating session meta: ${String(err)}`);
    }
  });
  const { onModelSelected, ...prefixOptions } = createReplyPrefixOptions({
    cfg: config,
    agentId: route.agentId,
    channel: "zalouser",
    accountId: account.accountId
  });
  const typingCallbacks = createTypingCallbacks({
    start: async () => {
      await sendTypingZalouser(chatId, {
        profile: account.profile,
        isGroup
      });
    },
    onStartError: (err) => {
      logVerbose(core, runtime2, `zalouser typing failed for ${chatId}: ${String(err)}`);
    }
  });
  await core.channel.reply.dispatchReplyWithBufferedBlockDispatcher({
    ctx: ctxPayload,
    cfg: config,
    dispatcherOptions: {
      ...prefixOptions,
      typingCallbacks,
      deliver: async (payload) => {
        await deliverZalouserReply({
          payload,
          profile: account.profile,
          chatId,
          isGroup,
          runtime: runtime2,
          core,
          config,
          accountId: account.accountId,
          statusSink,
          tableMode: core.channel.text.resolveMarkdownTableMode({
            cfg: config,
            channel: "zalouser",
            accountId: account.accountId
          })
        });
      },
      onError: (err, info) => {
        runtime2.error(`[${account.accountId}] Zalouser ${info.kind} reply failed: ${String(err)}`);
      }
    },
    replyOptions: {
      onModelSelected
    }
  });
}
async function deliverZalouserReply(params) {
  const { payload, profile, chatId, isGroup, runtime: runtime2, core, config, accountId, statusSink } = params;
  const tableMode = params.tableMode ?? "code";
  const text = core.channel.text.convertMarkdownTables(payload.text ?? "", tableMode);
  const sentMedia = await sendMediaWithLeadingCaption({
    mediaUrls: resolveOutboundMediaUrls(payload),
    caption: text,
    send: async ({ mediaUrl, caption }) => {
      logVerbose(core, runtime2, `Sending media to ${chatId}`);
      await sendMessageZalouser(chatId, caption ?? "", {
        profile,
        mediaUrl,
        isGroup
      });
      statusSink?.({ lastOutboundAt: Date.now() });
    },
    onError: (error) => {
      runtime2.error(`Zalouser media send failed: ${String(error)}`);
    }
  });
  if (sentMedia) {
    return;
  }
  if (text) {
    const chunkMode = core.channel.text.resolveChunkMode(config, "zalouser", accountId);
    const chunks = core.channel.text.chunkMarkdownTextWithMode(
      text,
      ZALOUSER_TEXT_LIMIT,
      chunkMode
    );
    logVerbose(core, runtime2, `Sending ${chunks.length} text chunk(s) to ${chatId}`);
    for (const chunk of chunks) {
      try {
        await sendMessageZalouser(chatId, chunk, { profile, isGroup });
        statusSink?.({ lastOutboundAt: Date.now() });
      } catch (err) {
        runtime2.error(`Zalouser message send failed: ${String(err)}`);
      }
    }
  }
}
async function monitorZalouserProvider(options) {
  let { account, config } = options;
  const { abortSignal, statusSink, runtime: runtime2 } = options;
  const core = getZalouserRuntime();
  try {
    const profile = account.profile;
    const allowFromEntries = (account.config.allowFrom ?? []).map((entry) => normalizeZalouserEntry(String(entry))).filter((entry) => entry && entry !== "*");
    if (allowFromEntries.length > 0) {
      const friends = await listZaloFriends(profile);
      const byName = buildNameIndex(friends, (friend) => friend.displayName);
      const additions = [];
      const mapping = [];
      const unresolved = [];
      for (const entry of allowFromEntries) {
        if (/^\d+$/.test(entry)) {
          additions.push(entry);
          continue;
        }
        const matches = byName.get(entry.toLowerCase()) ?? [];
        const match = matches[0];
        const id = match?.userId ? String(match.userId) : void 0;
        if (id) {
          additions.push(id);
          mapping.push(`${entry}\u2192${id}`);
        } else {
          unresolved.push(entry);
        }
      }
      const allowFrom = mergeAllowlist({ existing: account.config.allowFrom, additions });
      account = {
        ...account,
        config: {
          ...account.config,
          allowFrom
        }
      };
      summarizeMapping("zalouser users", mapping, unresolved, runtime2);
    }
    const groupsConfig = account.config.groups ?? {};
    const groupKeys = Object.keys(groupsConfig).filter((key) => key !== "*");
    if (groupKeys.length > 0) {
      const groups = await listZaloGroups(profile);
      const byName = buildNameIndex(groups, (group) => group.name);
      const mapping = [];
      const unresolved = [];
      const nextGroups = { ...groupsConfig };
      for (const entry of groupKeys) {
        const cleaned = normalizeZalouserEntry(entry);
        if (/^\d+$/.test(cleaned)) {
          if (!nextGroups[cleaned]) {
            nextGroups[cleaned] = groupsConfig[entry];
          }
          mapping.push(`${entry}\u2192${cleaned}`);
          continue;
        }
        const matches = byName.get(cleaned.toLowerCase()) ?? [];
        const match = matches[0];
        const id = match?.groupId ? String(match.groupId) : void 0;
        if (id) {
          if (!nextGroups[id]) {
            nextGroups[id] = groupsConfig[entry];
          }
          mapping.push(`${entry}\u2192${id}`);
        } else {
          unresolved.push(entry);
        }
      }
      account = {
        ...account,
        config: {
          ...account.config,
          groups: nextGroups
        }
      };
      summarizeMapping("zalouser groups", mapping, unresolved, runtime2);
    }
  } catch (err) {
    runtime2.log?.(`zalouser resolve failed; using config entries. ${String(err)}`);
  }
  let listenerStop = null;
  let stopped = false;
  const stop = () => {
    if (stopped) {
      return;
    }
    stopped = true;
    listenerStop?.();
    listenerStop = null;
  };
  const listener = await startZaloListener({
    accountId: account.accountId,
    profile: account.profile,
    abortSignal,
    onMessage: (msg) => {
      if (stopped) {
        return;
      }
      logVerbose(core, runtime2, `[${account.accountId}] inbound message`);
      statusSink?.({ lastInboundAt: Date.now() });
      processMessage(msg, account, config, core, runtime2, statusSink).catch((err) => {
        runtime2.error(`[${account.accountId}] Failed to process message: ${String(err)}`);
      });
    },
    onError: (err) => {
      if (stopped || abortSignal.aborted) {
        return;
      }
      runtime2.error(`[${account.accountId}] Zalo listener error: ${String(err)}`);
    }
  });
  listenerStop = listener.stop;
  await new Promise((resolve) => {
    abortSignal.addEventListener(
      "abort",
      () => {
        stop();
        resolve();
      },
      { once: true }
    );
  });
  return { stop };
}
var ZALOUSER_TEXT_LIMIT, __testing;
var init_monitor = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/zalouser/src/monitor.ts"() {
    "use strict";
    init_group_policy();
    init_message_sid();
    init_runtime();
    init_send();
    init_zalo_js();
    ZALOUSER_TEXT_LIMIT = 2e3;
    __testing = {
      processMessage: async (params) => {
        await processMessage(
          params.message,
          params.account,
          params.config,
          getZalouserRuntime(),
          params.runtime,
          params.statusSink
        );
      }
    };
  }
});

// vendor/openclaw-runtime/win-x64/extensions/zalouser/index.ts
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";

// vendor/openclaw-runtime/win-x64/extensions/zalouser/src/channel.ts
import fsp2 from "fs/promises";
import path3 from "path";
import {
  applyAccountNameToChannelSection,
  buildChannelConfigSchema,
  DEFAULT_ACCOUNT_ID as DEFAULT_ACCOUNT_ID3,
  chunkTextForOutbound,
  deleteAccountFromConfigSection,
  formatAllowFromLowercase,
  formatPairingApproveHint,
  migrateBaseNameToDefaultAccount,
  normalizeAccountId as normalizeAccountId3,
  resolvePreferredOpenClawTmpDir as resolvePreferredOpenClawTmpDir2,
  resolveChannelAccountConfigBasePath,
  setAccountEnabledInConfigSection
} from "openclaw/plugin-sdk";

// vendor/openclaw-runtime/win-x64/extensions/zalouser/src/accounts.ts
init_zalo_js();
import {
  DEFAULT_ACCOUNT_ID,
  normalizeAccountId,
  normalizeOptionalAccountId
} from "openclaw/plugin-sdk/account-id";
function listConfiguredAccountIds(cfg) {
  const accounts = cfg.channels?.zalouser?.accounts;
  if (!accounts || typeof accounts !== "object") {
    return [];
  }
  return Object.keys(accounts).filter(Boolean);
}
function listZalouserAccountIds(cfg) {
  const ids = listConfiguredAccountIds(cfg);
  if (ids.length === 0) {
    return [DEFAULT_ACCOUNT_ID];
  }
  return ids.toSorted((a, b) => a.localeCompare(b));
}
function resolveDefaultZalouserAccountId(cfg) {
  const zalouserConfig = cfg.channels?.zalouser;
  const preferred = normalizeOptionalAccountId(zalouserConfig?.defaultAccount);
  if (preferred && listZalouserAccountIds(cfg).some((accountId) => normalizeAccountId(accountId) === preferred)) {
    return preferred;
  }
  const ids = listZalouserAccountIds(cfg);
  if (ids.includes(DEFAULT_ACCOUNT_ID)) {
    return DEFAULT_ACCOUNT_ID;
  }
  return ids[0] ?? DEFAULT_ACCOUNT_ID;
}
function resolveAccountConfig(cfg, accountId) {
  const accounts = cfg.channels?.zalouser?.accounts;
  if (!accounts || typeof accounts !== "object") {
    return void 0;
  }
  return accounts[accountId];
}
function mergeZalouserAccountConfig(cfg, accountId) {
  const raw = cfg.channels?.zalouser ?? {};
  const { accounts: _ignored, defaultAccount: _ignored2, ...base } = raw;
  const account = resolveAccountConfig(cfg, accountId) ?? {};
  return { ...base, ...account };
}
function resolveProfile(config, accountId) {
  if (config.profile?.trim()) {
    return config.profile.trim();
  }
  if (process.env.ZALOUSER_PROFILE?.trim()) {
    return process.env.ZALOUSER_PROFILE.trim();
  }
  if (process.env.ZCA_PROFILE?.trim()) {
    return process.env.ZCA_PROFILE.trim();
  }
  if (accountId !== DEFAULT_ACCOUNT_ID) {
    return accountId;
  }
  return "default";
}
function resolveZalouserAccountSync(params) {
  const accountId = normalizeAccountId(params.accountId);
  const baseEnabled = params.cfg.channels?.zalouser?.enabled !== false;
  const merged = mergeZalouserAccountConfig(params.cfg, accountId);
  const accountEnabled = merged.enabled !== false;
  const enabled = baseEnabled && accountEnabled;
  const profile = resolveProfile(merged, accountId);
  return {
    accountId,
    name: merged.name?.trim() || void 0,
    enabled,
    profile,
    authenticated: false,
    config: merged
  };
}
async function getZcaUserInfo(profile) {
  const info = await getZaloUserInfo(profile);
  if (!info) {
    return null;
  }
  return {
    userId: info.userId,
    displayName: info.displayName
  };
}

// vendor/openclaw-runtime/win-x64/extensions/zalouser/src/config-schema.ts
import { MarkdownConfigSchema, ToolPolicySchema } from "openclaw/plugin-sdk";
import { z } from "zod";
var allowFromEntry = z.union([z.string(), z.number()]);
var groupConfigSchema = z.object({
  allow: z.boolean().optional(),
  enabled: z.boolean().optional(),
  requireMention: z.boolean().optional(),
  tools: ToolPolicySchema
});
var zalouserAccountSchema = z.object({
  name: z.string().optional(),
  enabled: z.boolean().optional(),
  markdown: MarkdownConfigSchema,
  profile: z.string().optional(),
  dmPolicy: z.enum(["pairing", "allowlist", "open", "disabled"]).optional(),
  allowFrom: z.array(allowFromEntry).optional(),
  groupPolicy: z.enum(["disabled", "allowlist", "open"]).optional(),
  groups: z.object({}).catchall(groupConfigSchema).optional(),
  messagePrefix: z.string().optional(),
  responsePrefix: z.string().optional()
});
var ZalouserConfigSchema = zalouserAccountSchema.extend({
  accounts: z.object({}).catchall(zalouserAccountSchema).optional(),
  defaultAccount: z.string().optional()
});

// vendor/openclaw-runtime/win-x64/extensions/zalouser/src/channel.ts
init_group_policy();
init_message_sid();

// vendor/openclaw-runtime/win-x64/extensions/zalouser/src/onboarding.ts
import fsp from "fs/promises";
import path2 from "path";
import {
  addWildcardAllowFrom,
  DEFAULT_ACCOUNT_ID as DEFAULT_ACCOUNT_ID2,
  formatResolvedUnresolvedNote,
  mergeAllowFromEntries,
  normalizeAccountId as normalizeAccountId2,
  promptAccountId,
  promptChannelAccessConfig,
  resolvePreferredOpenClawTmpDir
} from "openclaw/plugin-sdk";
init_zalo_js();
var channel = "zalouser";
function setZalouserAccountScopedConfig(cfg, accountId, defaultPatch, accountPatch = defaultPatch) {
  if (accountId === DEFAULT_ACCOUNT_ID2) {
    return {
      ...cfg,
      channels: {
        ...cfg.channels,
        zalouser: {
          ...cfg.channels?.zalouser,
          enabled: true,
          ...defaultPatch
        }
      }
    };
  }
  return {
    ...cfg,
    channels: {
      ...cfg.channels,
      zalouser: {
        ...cfg.channels?.zalouser,
        enabled: true,
        accounts: {
          ...cfg.channels?.zalouser?.accounts,
          [accountId]: {
            ...cfg.channels?.zalouser?.accounts?.[accountId],
            enabled: cfg.channels?.zalouser?.accounts?.[accountId]?.enabled ?? true,
            ...accountPatch
          }
        }
      }
    }
  };
}
function setZalouserDmPolicy(cfg, dmPolicy2) {
  const allowFrom = dmPolicy2 === "open" ? addWildcardAllowFrom(cfg.channels?.zalouser?.allowFrom) : void 0;
  return {
    ...cfg,
    channels: {
      ...cfg.channels,
      zalouser: {
        ...cfg.channels?.zalouser,
        dmPolicy: dmPolicy2,
        ...allowFrom ? { allowFrom } : {}
      }
    }
  };
}
async function noteZalouserHelp(prompter) {
  await prompter.note(
    [
      "Zalo Personal Account login via QR code.",
      "",
      "This plugin uses zca-js directly (no external CLI dependency).",
      "",
      "Docs: https://docs.openclaw.ai/channels/zalouser"
    ].join("\n"),
    "Zalo Personal Setup"
  );
}
async function writeQrDataUrlToTempFile(qrDataUrl, profile) {
  const trimmed = qrDataUrl.trim();
  const match = trimmed.match(/^data:image\/png;base64,(.+)$/i);
  const base64 = (match?.[1] ?? "").trim();
  if (!base64) {
    return null;
  }
  const safeProfile = profile.replace(/[^a-zA-Z0-9_-]+/g, "-") || "default";
  const filePath = path2.join(
    resolvePreferredOpenClawTmpDir(),
    `openclaw-zalouser-qr-${safeProfile}.png`
  );
  await fsp.writeFile(filePath, Buffer.from(base64, "base64"));
  return filePath;
}
async function promptZalouserAllowFrom(params) {
  const { cfg, prompter, accountId } = params;
  const resolved = resolveZalouserAccountSync({ cfg, accountId });
  const existingAllowFrom = resolved.config.allowFrom ?? [];
  const parseInput = (raw) => raw.split(/[\n,;]+/g).map((entry) => entry.trim()).filter(Boolean);
  while (true) {
    const entry = await prompter.text({
      message: "Zalouser allowFrom (name or user id)",
      placeholder: "Alice, 123456789",
      initialValue: existingAllowFrom[0] ? String(existingAllowFrom[0]) : void 0,
      validate: (value) => String(value ?? "").trim() ? void 0 : "Required"
    });
    const parts = parseInput(String(entry));
    const resolvedEntries = await resolveZaloAllowFromEntries({
      profile: resolved.profile,
      entries: parts
    });
    const unresolved = resolvedEntries.filter((item) => !item.resolved).map((item) => item.input);
    if (unresolved.length > 0) {
      await prompter.note(
        `Could not resolve: ${unresolved.join(", ")}. Use numeric user ids or exact friend names.`,
        "Zalo Personal allowlist"
      );
      continue;
    }
    const resolvedIds = resolvedEntries.filter((item) => item.resolved && item.id).map((item) => item.id);
    const unique = mergeAllowFromEntries(existingAllowFrom, resolvedIds);
    const notes = resolvedEntries.filter((item) => item.note).map((item) => `${item.input} -> ${item.id} (${item.note})`);
    if (notes.length > 0) {
      await prompter.note(notes.join("\n"), "Zalo Personal allowlist");
    }
    return setZalouserAccountScopedConfig(cfg, accountId, {
      dmPolicy: "allowlist",
      allowFrom: unique
    });
  }
}
function setZalouserGroupPolicy(cfg, accountId, groupPolicy) {
  return setZalouserAccountScopedConfig(cfg, accountId, {
    groupPolicy
  });
}
function setZalouserGroupAllowlist(cfg, accountId, groupKeys) {
  const groups = Object.fromEntries(groupKeys.map((key) => [key, { allow: true }]));
  return setZalouserAccountScopedConfig(cfg, accountId, {
    groups
  });
}
var dmPolicy = {
  label: "Zalo Personal",
  channel,
  policyKey: "channels.zalouser.dmPolicy",
  allowFromKey: "channels.zalouser.allowFrom",
  getCurrent: (cfg) => cfg.channels?.zalouser?.dmPolicy ?? "pairing",
  setPolicy: (cfg, policy) => setZalouserDmPolicy(cfg, policy),
  promptAllowFrom: async ({ cfg, prompter, accountId }) => {
    const id = accountId && normalizeAccountId2(accountId) ? normalizeAccountId2(accountId) ?? DEFAULT_ACCOUNT_ID2 : resolveDefaultZalouserAccountId(cfg);
    return promptZalouserAllowFrom({
      cfg,
      prompter,
      accountId: id
    });
  }
};
var zalouserOnboardingAdapter = {
  channel,
  dmPolicy,
  getStatus: async ({ cfg }) => {
    const ids = listZalouserAccountIds(cfg);
    let configured = false;
    for (const accountId of ids) {
      const account = resolveZalouserAccountSync({ cfg, accountId });
      const isAuth = await checkZaloAuthenticated(account.profile);
      if (isAuth) {
        configured = true;
        break;
      }
    }
    return {
      channel,
      configured,
      statusLines: [`Zalo Personal: ${configured ? "logged in" : "needs QR login"}`],
      selectionHint: configured ? "recommended \xB7 logged in" : "recommended \xB7 QR login",
      quickstartScore: configured ? 1 : 15
    };
  },
  configure: async ({
    cfg,
    prompter,
    accountOverrides,
    shouldPromptAccountIds,
    forceAllowFrom
  }) => {
    const zalouserOverride = accountOverrides.zalouser?.trim();
    const defaultAccountId = resolveDefaultZalouserAccountId(cfg);
    let accountId = zalouserOverride ? normalizeAccountId2(zalouserOverride) : defaultAccountId;
    if (shouldPromptAccountIds && !zalouserOverride) {
      accountId = await promptAccountId({
        cfg,
        prompter,
        label: "Zalo Personal",
        currentId: accountId,
        listAccountIds: listZalouserAccountIds,
        defaultAccountId
      });
    }
    let next = cfg;
    const account = resolveZalouserAccountSync({ cfg: next, accountId });
    const alreadyAuthenticated = await checkZaloAuthenticated(account.profile);
    if (!alreadyAuthenticated) {
      await noteZalouserHelp(prompter);
      const wantsLogin = await prompter.confirm({
        message: "Login via QR code now?",
        initialValue: true
      });
      if (wantsLogin) {
        const start = await startZaloQrLogin({ profile: account.profile, timeoutMs: 35e3 });
        if (start.qrDataUrl) {
          const qrPath = await writeQrDataUrlToTempFile(start.qrDataUrl, account.profile);
          await prompter.note(
            [
              start.message,
              qrPath ? `QR image saved to: ${qrPath}` : "Could not write QR image file; use gateway web login UI instead.",
              "Scan + approve on phone, then continue."
            ].join("\n"),
            "QR Login"
          );
          const scanned = await prompter.confirm({
            message: "Did you scan and approve the QR on your phone?",
            initialValue: true
          });
          if (scanned) {
            const waited = await waitForZaloQrLogin({
              profile: account.profile,
              timeoutMs: 12e4
            });
            await prompter.note(waited.message, waited.connected ? "Success" : "Login pending");
          }
        } else {
          await prompter.note(start.message, "Login pending");
        }
      }
    } else {
      const keepSession = await prompter.confirm({
        message: "Zalo Personal already logged in. Keep session?",
        initialValue: true
      });
      if (!keepSession) {
        await logoutZaloProfile(account.profile);
        const start = await startZaloQrLogin({
          profile: account.profile,
          force: true,
          timeoutMs: 35e3
        });
        if (start.qrDataUrl) {
          const qrPath = await writeQrDataUrlToTempFile(start.qrDataUrl, account.profile);
          await prompter.note(
            [start.message, qrPath ? `QR image saved to: ${qrPath}` : void 0].filter(Boolean).join("\n"),
            "QR Login"
          );
          const waited = await waitForZaloQrLogin({ profile: account.profile, timeoutMs: 12e4 });
          await prompter.note(waited.message, waited.connected ? "Success" : "Login pending");
        }
      }
    }
    next = setZalouserAccountScopedConfig(
      next,
      accountId,
      { profile: account.profile !== "default" ? account.profile : void 0 },
      { profile: account.profile, enabled: true }
    );
    if (forceAllowFrom) {
      next = await promptZalouserAllowFrom({
        cfg: next,
        prompter,
        accountId
      });
    }
    const updatedAccount = resolveZalouserAccountSync({ cfg: next, accountId });
    const accessConfig = await promptChannelAccessConfig({
      prompter,
      label: "Zalo groups",
      currentPolicy: updatedAccount.config.groupPolicy ?? "allowlist",
      currentEntries: Object.keys(updatedAccount.config.groups ?? {}),
      placeholder: "Family, Work, 123456789",
      updatePrompt: Boolean(updatedAccount.config.groups)
    });
    if (accessConfig) {
      if (accessConfig.policy !== "allowlist") {
        next = setZalouserGroupPolicy(next, accountId, accessConfig.policy);
      } else {
        let keys = accessConfig.entries;
        if (accessConfig.entries.length > 0) {
          try {
            const resolved = await resolveZaloGroupsByEntries({
              profile: updatedAccount.profile,
              entries: accessConfig.entries
            });
            const resolvedIds = resolved.filter((entry) => entry.resolved && entry.id).map((entry) => entry.id);
            const unresolved = resolved.filter((entry) => !entry.resolved).map((entry) => entry.input);
            keys = [...resolvedIds, ...unresolved.map((entry) => entry.trim()).filter(Boolean)];
            const resolution = formatResolvedUnresolvedNote({
              resolved: resolvedIds,
              unresolved
            });
            if (resolution) {
              await prompter.note(resolution, "Zalo groups");
            }
          } catch (err) {
            await prompter.note(
              `Group lookup failed; keeping entries as typed. ${String(err)}`,
              "Zalo groups"
            );
          }
        }
        next = setZalouserGroupPolicy(next, accountId, "allowlist");
        next = setZalouserGroupAllowlist(next, accountId, keys);
      }
    }
    return { cfg: next, accountId };
  }
};

// vendor/openclaw-runtime/win-x64/extensions/zalouser/src/probe.ts
init_zalo_js();
async function probeZalouser(profile, timeoutMs) {
  try {
    const user = timeoutMs ? await Promise.race([
      getZaloUserInfo(profile),
      new Promise(
        (resolve) => setTimeout(() => resolve(null), Math.max(timeoutMs, 1e3))
      )
    ]) : await getZaloUserInfo(profile);
    if (!user) {
      return { ok: false, error: "Not authenticated" };
    }
    return { ok: true, user };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// vendor/openclaw-runtime/win-x64/extensions/zalouser/src/channel.ts
init_send();

// vendor/openclaw-runtime/win-x64/extensions/zalouser/src/status-issues.ts
var isRecord = (value) => Boolean(value && typeof value === "object");
var asString = (value) => typeof value === "string" ? value : typeof value === "number" ? String(value) : void 0;
function readZalouserAccountStatus(value) {
  if (!isRecord(value)) {
    return null;
  }
  return {
    accountId: value.accountId,
    enabled: value.enabled,
    configured: value.configured,
    dmPolicy: value.dmPolicy,
    lastError: value.lastError
  };
}
function collectZalouserStatusIssues(accounts) {
  const issues = [];
  for (const entry of accounts) {
    const account = readZalouserAccountStatus(entry);
    if (!account) {
      continue;
    }
    const accountId = asString(account.accountId) ?? "default";
    const enabled = account.enabled !== false;
    if (!enabled) {
      continue;
    }
    const configured = account.configured === true;
    if (!configured) {
      issues.push({
        channel: "zalouser",
        accountId,
        kind: "auth",
        message: "Not authenticated (no saved Zalo session).",
        fix: "Run: openclaw channels login --channel zalouser"
      });
      continue;
    }
    if (account.dmPolicy === "open") {
      issues.push({
        channel: "zalouser",
        accountId,
        kind: "config",
        message: 'Zalo Personal dmPolicy is "open", allowing any user to message the bot without pairing.',
        fix: 'Set channels.zalouser.dmPolicy to "pairing" or "allowlist" to restrict access.'
      });
    }
  }
  return issues;
}

// vendor/openclaw-runtime/win-x64/extensions/zalouser/src/channel.ts
init_zalo_js();
var meta = {
  id: "zalouser",
  label: "Zalo Personal",
  selectionLabel: "Zalo (Personal Account)",
  docsPath: "/channels/zalouser",
  docsLabel: "zalouser",
  blurb: "Zalo personal account via QR code login.",
  aliases: ["zlu"],
  order: 85,
  quickstartAllowFrom: true
};
function resolveZalouserQrProfile(accountId) {
  const normalized = normalizeAccountId3(accountId);
  if (!normalized || normalized === DEFAULT_ACCOUNT_ID3) {
    return process.env.ZALOUSER_PROFILE?.trim() || process.env.ZCA_PROFILE?.trim() || "default";
  }
  return normalized;
}
async function writeQrDataUrlToTempFile2(qrDataUrl, profile) {
  const trimmed = qrDataUrl.trim();
  const match = trimmed.match(/^data:image\/png;base64,(.+)$/i);
  const base64 = (match?.[1] ?? "").trim();
  if (!base64) {
    return null;
  }
  const safeProfile = profile.replace(/[^a-zA-Z0-9_-]+/g, "-") || "default";
  const filePath = path3.join(
    resolvePreferredOpenClawTmpDir2(),
    `openclaw-zalouser-qr-${safeProfile}.png`
  );
  await fsp2.writeFile(filePath, Buffer.from(base64, "base64"));
  return filePath;
}
function mapUser(params) {
  return {
    kind: "user",
    id: params.id,
    name: params.name ?? void 0,
    avatarUrl: params.avatarUrl ?? void 0,
    raw: params.raw
  };
}
function mapGroup2(params) {
  return {
    kind: "group",
    id: params.id,
    name: params.name ?? void 0,
    raw: params.raw
  };
}
function resolveZalouserGroupToolPolicy(params) {
  const account = resolveZalouserAccountSync({
    cfg: params.cfg,
    accountId: params.accountId ?? void 0
  });
  const groups = account.config.groups ?? {};
  const entry = findZalouserGroupEntry(
    groups,
    buildZalouserGroupCandidates({
      groupId: params.groupId,
      groupChannel: params.groupChannel,
      includeWildcard: true
    })
  );
  return entry?.tools;
}
function resolveZalouserRequireMention(params) {
  const account = resolveZalouserAccountSync({
    cfg: params.cfg,
    accountId: params.accountId ?? void 0
  });
  const groups = account.config.groups ?? {};
  const entry = findZalouserGroupEntry(
    groups,
    buildZalouserGroupCandidates({
      groupId: params.groupId,
      groupChannel: params.groupChannel,
      includeWildcard: true
    })
  );
  if (typeof entry?.requireMention === "boolean") {
    return entry.requireMention;
  }
  return true;
}
var zalouserMessageActions = {
  listActions: ({ cfg }) => {
    const accounts = listZalouserAccountIds(cfg).map((accountId) => resolveZalouserAccountSync({ cfg, accountId })).filter((account) => account.enabled);
    if (accounts.length === 0) {
      return [];
    }
    return ["react"];
  },
  supportsAction: ({ action }) => action === "react",
  handleAction: async ({ action, params, cfg, accountId, toolContext }) => {
    if (action !== "react") {
      throw new Error(`Zalouser action ${action} not supported`);
    }
    const account = resolveZalouserAccountSync({ cfg, accountId });
    const threadId = (typeof params.threadId === "string" ? params.threadId.trim() : "") || (typeof params.to === "string" ? params.to.trim() : "") || (typeof params.chatId === "string" ? params.chatId.trim() : "") || (toolContext?.currentChannelId?.trim() ?? "");
    if (!threadId) {
      throw new Error("Zalouser react requires threadId (or to/chatId).");
    }
    const emoji = typeof params.emoji === "string" ? params.emoji.trim() : "";
    if (!emoji) {
      throw new Error("Zalouser react requires emoji.");
    }
    const ids = resolveZalouserReactionMessageIds({
      messageId: typeof params.messageId === "string" ? params.messageId : void 0,
      cliMsgId: typeof params.cliMsgId === "string" ? params.cliMsgId : void 0,
      currentMessageId: toolContext?.currentMessageId
    });
    if (!ids) {
      throw new Error(
        "Zalouser react requires messageId + cliMsgId (or a current message context id)."
      );
    }
    const result = await sendReactionZalouser({
      profile: account.profile,
      threadId,
      isGroup: params.isGroup === true,
      msgId: ids.msgId,
      cliMsgId: ids.cliMsgId,
      emoji,
      remove: params.remove === true
    });
    if (!result.ok) {
      throw new Error(result.error || "Failed to react on Zalo message");
    }
    return {
      content: [
        {
          type: "text",
          text: params.remove === true ? `Removed reaction ${emoji} from ${ids.msgId}` : `Reacted ${emoji} on ${ids.msgId}`
        }
      ],
      details: {
        messageId: ids.msgId,
        cliMsgId: ids.cliMsgId,
        threadId
      }
    };
  }
};
var zalouserDock = {
  id: "zalouser",
  capabilities: {
    chatTypes: ["direct", "group"],
    media: true,
    blockStreaming: true
  },
  outbound: { textChunkLimit: 2e3 },
  config: {
    resolveAllowFrom: ({ cfg, accountId }) => (resolveZalouserAccountSync({ cfg, accountId }).config.allowFrom ?? []).map(
      (entry) => String(entry)
    ),
    formatAllowFrom: ({ allowFrom }) => formatAllowFromLowercase({ allowFrom, stripPrefixRe: /^(zalouser|zlu):/i })
  },
  groups: {
    resolveRequireMention: resolveZalouserRequireMention,
    resolveToolPolicy: resolveZalouserGroupToolPolicy
  },
  threading: {
    resolveReplyToMode: () => "off"
  }
};
var zalouserPlugin = {
  id: "zalouser",
  meta,
  onboarding: zalouserOnboardingAdapter,
  capabilities: {
    chatTypes: ["direct", "group"],
    media: true,
    reactions: true,
    threads: false,
    polls: false,
    nativeCommands: false,
    blockStreaming: true
  },
  reload: { configPrefixes: ["channels.zalouser"] },
  configSchema: buildChannelConfigSchema(ZalouserConfigSchema),
  config: {
    listAccountIds: (cfg) => listZalouserAccountIds(cfg),
    resolveAccount: (cfg, accountId) => resolveZalouserAccountSync({ cfg, accountId }),
    defaultAccountId: (cfg) => resolveDefaultZalouserAccountId(cfg),
    setAccountEnabled: ({ cfg, accountId, enabled }) => setAccountEnabledInConfigSection({
      cfg,
      sectionKey: "zalouser",
      accountId,
      enabled,
      allowTopLevel: true
    }),
    deleteAccount: ({ cfg, accountId }) => deleteAccountFromConfigSection({
      cfg,
      sectionKey: "zalouser",
      accountId,
      clearBaseFields: [
        "profile",
        "name",
        "dmPolicy",
        "allowFrom",
        "groupPolicy",
        "groups",
        "messagePrefix"
      ]
    }),
    isConfigured: async (account) => await checkZaloAuthenticated(account.profile),
    describeAccount: (account) => ({
      accountId: account.accountId,
      name: account.name,
      enabled: account.enabled,
      configured: void 0
    }),
    resolveAllowFrom: ({ cfg, accountId }) => (resolveZalouserAccountSync({ cfg, accountId }).config.allowFrom ?? []).map(
      (entry) => String(entry)
    ),
    formatAllowFrom: ({ allowFrom }) => formatAllowFromLowercase({ allowFrom, stripPrefixRe: /^(zalouser|zlu):/i })
  },
  security: {
    resolveDmPolicy: ({ cfg, accountId, account }) => {
      const resolvedAccountId = accountId ?? account.accountId ?? DEFAULT_ACCOUNT_ID3;
      const basePath = resolveChannelAccountConfigBasePath({
        cfg,
        channelKey: "zalouser",
        accountId: resolvedAccountId
      });
      return {
        policy: account.config.dmPolicy ?? "pairing",
        allowFrom: account.config.allowFrom ?? [],
        policyPath: `${basePath}dmPolicy`,
        allowFromPath: basePath,
        approveHint: formatPairingApproveHint("zalouser"),
        normalizeEntry: (raw) => raw.replace(/^(zalouser|zlu):/i, "")
      };
    }
  },
  groups: {
    resolveRequireMention: resolveZalouserRequireMention,
    resolveToolPolicy: resolveZalouserGroupToolPolicy
  },
  threading: {
    resolveReplyToMode: () => "off"
  },
  actions: zalouserMessageActions,
  setup: {
    resolveAccountId: ({ accountId }) => normalizeAccountId3(accountId),
    applyAccountName: ({ cfg, accountId, name }) => applyAccountNameToChannelSection({
      cfg,
      channelKey: "zalouser",
      accountId,
      name
    }),
    validateInput: () => null,
    applyAccountConfig: ({ cfg, accountId, input }) => {
      const namedConfig = applyAccountNameToChannelSection({
        cfg,
        channelKey: "zalouser",
        accountId,
        name: input.name
      });
      const next = accountId !== DEFAULT_ACCOUNT_ID3 ? migrateBaseNameToDefaultAccount({
        cfg: namedConfig,
        channelKey: "zalouser"
      }) : namedConfig;
      if (accountId === DEFAULT_ACCOUNT_ID3) {
        return {
          ...next,
          channels: {
            ...next.channels,
            zalouser: {
              ...next.channels?.zalouser,
              enabled: true
            }
          }
        };
      }
      return {
        ...next,
        channels: {
          ...next.channels,
          zalouser: {
            ...next.channels?.zalouser,
            enabled: true,
            accounts: {
              ...next.channels?.zalouser?.accounts,
              [accountId]: {
                ...next.channels?.zalouser?.accounts?.[accountId],
                enabled: true
              }
            }
          }
        }
      };
    }
  },
  messaging: {
    normalizeTarget: (raw) => {
      const trimmed = raw?.trim();
      if (!trimmed) {
        return void 0;
      }
      return trimmed.replace(/^(zalouser|zlu):/i, "");
    },
    targetResolver: {
      looksLikeId: (raw) => {
        const trimmed = raw.trim();
        if (!trimmed) {
          return false;
        }
        return /^\d{3,}$/.test(trimmed);
      },
      hint: "<threadId>"
    }
  },
  directory: {
    self: async ({ cfg, accountId }) => {
      const account = resolveZalouserAccountSync({ cfg, accountId });
      const parsed = await getZaloUserInfo(account.profile);
      if (!parsed?.userId) {
        return null;
      }
      return mapUser({
        id: String(parsed.userId),
        name: parsed.displayName ?? null,
        avatarUrl: parsed.avatar ?? null,
        raw: parsed
      });
    },
    listPeers: async ({ cfg, accountId, query, limit }) => {
      const account = resolveZalouserAccountSync({ cfg, accountId });
      const friends = await listZaloFriendsMatching(account.profile, query);
      const rows = friends.map(
        (friend) => mapUser({
          id: String(friend.userId),
          name: friend.displayName ?? null,
          avatarUrl: friend.avatar ?? null,
          raw: friend
        })
      );
      return typeof limit === "number" && limit > 0 ? rows.slice(0, limit) : rows;
    },
    listGroups: async ({ cfg, accountId, query, limit }) => {
      const account = resolveZalouserAccountSync({ cfg, accountId });
      const groups = await listZaloGroupsMatching(account.profile, query);
      const rows = groups.map(
        (group) => mapGroup2({
          id: String(group.groupId),
          name: group.name ?? null,
          raw: group
        })
      );
      return typeof limit === "number" && limit > 0 ? rows.slice(0, limit) : rows;
    },
    listGroupMembers: async ({ cfg, accountId, groupId, limit }) => {
      const account = resolveZalouserAccountSync({ cfg, accountId });
      const members = await listZaloGroupMembers(account.profile, groupId);
      const rows = members.map(
        (member) => mapUser({
          id: member.userId,
          name: member.displayName,
          avatarUrl: member.avatar ?? null,
          raw: member
        })
      );
      return typeof limit === "number" && limit > 0 ? rows.slice(0, limit) : rows;
    }
  },
  resolver: {
    resolveTargets: async ({ cfg, accountId, inputs, kind, runtime: runtime2 }) => {
      const results = [];
      for (const input of inputs) {
        const trimmed = input.trim();
        if (!trimmed) {
          results.push({ input, resolved: false, note: "empty input" });
          continue;
        }
        if (/^\d+$/.test(trimmed)) {
          results.push({ input, resolved: true, id: trimmed });
          continue;
        }
        try {
          const account = resolveZalouserAccountSync({
            cfg,
            accountId: accountId ?? DEFAULT_ACCOUNT_ID3
          });
          if (kind === "user") {
            const friends = await listZaloFriendsMatching(account.profile, trimmed);
            const best = friends[0];
            results.push({
              input,
              resolved: Boolean(best?.userId),
              id: best?.userId,
              name: best?.displayName,
              note: friends.length > 1 ? "multiple matches; chose first" : void 0
            });
          } else {
            const groups = await listZaloGroupsMatching(account.profile, trimmed);
            const best = groups.find((group) => group.name.toLowerCase() === trimmed.toLowerCase()) ?? groups[0];
            results.push({
              input,
              resolved: Boolean(best?.groupId),
              id: best?.groupId,
              name: best?.name,
              note: groups.length > 1 ? "multiple matches; chose first" : void 0
            });
          }
        } catch (err) {
          runtime2.error?.(`zalouser resolve failed: ${String(err)}`);
          results.push({ input, resolved: false, note: "lookup failed" });
        }
      }
      return results;
    }
  },
  pairing: {
    idLabel: "zalouserUserId",
    normalizeAllowEntry: (entry) => entry.replace(/^(zalouser|zlu):/i, ""),
    notifyApproval: async ({ cfg, id }) => {
      const account = resolveZalouserAccountSync({ cfg });
      const authenticated = await checkZaloAuthenticated(account.profile);
      if (!authenticated) {
        throw new Error("Zalouser not authenticated");
      }
      await sendMessageZalouser(id, "Your pairing request has been approved.", {
        profile: account.profile
      });
    }
  },
  auth: {
    login: async ({ cfg, accountId, runtime: runtime2 }) => {
      const account = resolveZalouserAccountSync({
        cfg,
        accountId: accountId ?? DEFAULT_ACCOUNT_ID3
      });
      runtime2.log(
        `Generating QR login for Zalo Personal (account: ${account.accountId}, profile: ${account.profile})...`
      );
      const started = await startZaloQrLogin({
        profile: account.profile,
        timeoutMs: 35e3
      });
      if (!started.qrDataUrl) {
        throw new Error(started.message || "Failed to start QR login");
      }
      const qrPath = await writeQrDataUrlToTempFile2(started.qrDataUrl, account.profile);
      if (qrPath) {
        runtime2.log(`Scan QR image: ${qrPath}`);
      } else {
        runtime2.log("QR generated but could not be written to a temp file.");
      }
      const waited = await waitForZaloQrLogin({ profile: account.profile, timeoutMs: 18e4 });
      if (!waited.connected) {
        throw new Error(waited.message || "Zalouser login failed");
      }
      runtime2.log(waited.message);
    }
  },
  outbound: {
    deliveryMode: "direct",
    chunker: chunkTextForOutbound,
    chunkerMode: "text",
    textChunkLimit: 2e3,
    sendPayload: async (ctx) => {
      const text = ctx.payload.text ?? "";
      const urls = ctx.payload.mediaUrls?.length ? ctx.payload.mediaUrls : ctx.payload.mediaUrl ? [ctx.payload.mediaUrl] : [];
      if (!text && urls.length === 0) {
        return { channel: "zalouser", messageId: "" };
      }
      if (urls.length > 0) {
        let lastResult2 = await zalouserPlugin.outbound.sendMedia({
          ...ctx,
          text,
          mediaUrl: urls[0]
        });
        for (let i = 1; i < urls.length; i++) {
          lastResult2 = await zalouserPlugin.outbound.sendMedia({
            ...ctx,
            text: "",
            mediaUrl: urls[i]
          });
        }
        return lastResult2;
      }
      const outbound = zalouserPlugin.outbound;
      const limit = outbound.textChunkLimit;
      const chunks = limit && outbound.chunker ? outbound.chunker(text, limit) : [text];
      let lastResult;
      for (const chunk of chunks) {
        lastResult = await outbound.sendText({ ...ctx, text: chunk });
      }
      return lastResult;
    },
    sendText: async ({ to, text, accountId, cfg }) => {
      const account = resolveZalouserAccountSync({ cfg, accountId });
      const result = await sendMessageZalouser(to, text, { profile: account.profile });
      return {
        channel: "zalouser",
        ok: result.ok,
        messageId: result.messageId ?? "",
        error: result.error ? new Error(result.error) : void 0
      };
    },
    sendMedia: async ({ to, text, mediaUrl, accountId, cfg, mediaLocalRoots }) => {
      const account = resolveZalouserAccountSync({ cfg, accountId });
      const result = await sendMessageZalouser(to, text, {
        profile: account.profile,
        mediaUrl,
        mediaLocalRoots
      });
      return {
        channel: "zalouser",
        ok: result.ok,
        messageId: result.messageId ?? "",
        error: result.error ? new Error(result.error) : void 0
      };
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
    collectStatusIssues: collectZalouserStatusIssues,
    buildChannelSummary: ({ snapshot }) => ({
      configured: snapshot.configured ?? false,
      running: snapshot.running ?? false,
      lastStartAt: snapshot.lastStartAt ?? null,
      lastStopAt: snapshot.lastStopAt ?? null,
      lastError: snapshot.lastError ?? null,
      probe: snapshot.probe,
      lastProbeAt: snapshot.lastProbeAt ?? null
    }),
    probeAccount: async ({ account, timeoutMs }) => probeZalouser(account.profile, timeoutMs),
    buildAccountSnapshot: async ({ account, runtime: runtime2 }) => {
      const configured = await checkZaloAuthenticated(account.profile);
      const configError = "not authenticated";
      return {
        accountId: account.accountId,
        name: account.name,
        enabled: account.enabled,
        configured,
        running: runtime2?.running ?? false,
        lastStartAt: runtime2?.lastStartAt ?? null,
        lastStopAt: runtime2?.lastStopAt ?? null,
        lastError: configured ? runtime2?.lastError ?? null : runtime2?.lastError ?? configError,
        lastInboundAt: runtime2?.lastInboundAt ?? null,
        lastOutboundAt: runtime2?.lastOutboundAt ?? null,
        dmPolicy: account.config.dmPolicy ?? "pairing"
      };
    }
  },
  gateway: {
    startAccount: async (ctx) => {
      const account = ctx.account;
      let userLabel = "";
      try {
        const userInfo = await getZcaUserInfo(account.profile);
        if (userInfo?.displayName) {
          userLabel = ` (${userInfo.displayName})`;
        }
        ctx.setStatus({
          accountId: account.accountId,
          profile: userInfo
        });
      } catch {
      }
      ctx.log?.info(`[${account.accountId}] starting zalouser provider${userLabel}`);
      const { monitorZalouserProvider: monitorZalouserProvider2 } = await Promise.resolve().then(() => (init_monitor(), monitor_exports));
      return monitorZalouserProvider2({
        account,
        config: ctx.cfg,
        runtime: ctx.runtime,
        abortSignal: ctx.abortSignal,
        statusSink: (patch) => ctx.setStatus({ accountId: ctx.accountId, ...patch })
      });
    },
    loginWithQrStart: async (params) => {
      const profile = resolveZalouserQrProfile(params.accountId);
      return await startZaloQrLogin({
        profile,
        force: params.force,
        timeoutMs: params.timeoutMs
      });
    },
    loginWithQrWait: async (params) => {
      const profile = resolveZalouserQrProfile(params.accountId);
      return await waitForZaloQrLogin({
        profile,
        timeoutMs: params.timeoutMs
      });
    },
    logoutAccount: async (ctx) => await logoutZaloProfile(ctx.account.profile || resolveZalouserQrProfile(ctx.accountId))
  }
};

// vendor/openclaw-runtime/win-x64/extensions/zalouser/index.ts
init_runtime();

// vendor/openclaw-runtime/win-x64/extensions/zalouser/src/tool.ts
init_send();
init_zalo_js();
import { Type } from "@sinclair/typebox";
var ACTIONS = ["send", "image", "link", "friends", "groups", "me", "status"];
function stringEnum(values, options = {}) {
  return Type.Unsafe({
    type: "string",
    enum: [...values],
    ...options
  });
}
var ZalouserToolSchema = Type.Object(
  {
    action: stringEnum(ACTIONS, { description: `Action to perform: ${ACTIONS.join(", ")}` }),
    threadId: Type.Optional(Type.String({ description: "Thread ID for messaging" })),
    message: Type.Optional(Type.String({ description: "Message text" })),
    isGroup: Type.Optional(Type.Boolean({ description: "Is group chat" })),
    profile: Type.Optional(Type.String({ description: "Profile name" })),
    query: Type.Optional(Type.String({ description: "Search query" })),
    url: Type.Optional(Type.String({ description: "URL for media/link" }))
  },
  { additionalProperties: false }
);
function json(payload) {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    details: payload
  };
}
async function executeZalouserTool(_toolCallId, params, _signal, _onUpdate) {
  try {
    switch (params.action) {
      case "send": {
        if (!params.threadId || !params.message) {
          throw new Error("threadId and message required for send action");
        }
        const result = await sendMessageZalouser(params.threadId, params.message, {
          profile: params.profile,
          isGroup: params.isGroup
        });
        if (!result.ok) {
          throw new Error(result.error || "Failed to send message");
        }
        return json({ success: true, messageId: result.messageId });
      }
      case "image": {
        if (!params.threadId) {
          throw new Error("threadId required for image action");
        }
        if (!params.url) {
          throw new Error("url required for image action");
        }
        const result = await sendImageZalouser(params.threadId, params.url, {
          profile: params.profile,
          caption: params.message,
          isGroup: params.isGroup
        });
        if (!result.ok) {
          throw new Error(result.error || "Failed to send image");
        }
        return json({ success: true, messageId: result.messageId });
      }
      case "link": {
        if (!params.threadId || !params.url) {
          throw new Error("threadId and url required for link action");
        }
        const result = await sendLinkZalouser(params.threadId, params.url, {
          profile: params.profile,
          caption: params.message,
          isGroup: params.isGroup
        });
        if (!result.ok) {
          throw new Error(result.error || "Failed to send link");
        }
        return json({ success: true, messageId: result.messageId });
      }
      case "friends": {
        const rows = await listZaloFriendsMatching(params.profile, params.query);
        return json(rows);
      }
      case "groups": {
        const rows = await listZaloGroupsMatching(params.profile, params.query);
        return json(rows);
      }
      case "me": {
        const info = await getZaloUserInfo(params.profile);
        return json(info ?? { error: "Not authenticated" });
      }
      case "status": {
        const authenticated = await checkZaloAuthenticated(params.profile);
        return json({
          authenticated,
          output: authenticated ? "authenticated" : "not authenticated"
        });
      }
      default: {
        params.action;
        throw new Error(
          `Unknown action: ${String(params.action)}. Valid actions: send, image, link, friends, groups, me, status`
        );
      }
    }
  } catch (err) {
    return json({
      error: err instanceof Error ? err.message : String(err)
    });
  }
}

// vendor/openclaw-runtime/win-x64/extensions/zalouser/index.ts
var plugin = {
  id: "zalouser",
  name: "Zalo Personal",
  description: "Zalo personal account messaging via native zca-js integration",
  configSchema: emptyPluginConfigSchema(),
  register(api) {
    setZalouserRuntime(api.runtime);
    api.registerChannel({ plugin: zalouserPlugin, dock: zalouserDock });
    api.registerTool({
      name: "zalouser",
      label: "Zalo Personal",
      description: "Send messages and access data via Zalo personal account. Actions: send (text message), image (send image URL), link (send link), friends (list/search friends), groups (list groups), me (profile info), status (auth check).",
      parameters: ZalouserToolSchema,
      execute: executeZalouserTool
    });
  }
};
var zalouser_default = plugin;
export {
  zalouser_default as default
};
