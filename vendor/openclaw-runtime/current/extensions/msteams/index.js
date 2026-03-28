var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// vendor/openclaw-runtime/win-x64/extensions/msteams/src/attachments/shared.ts
import { lookup } from "dns/promises";
import {
  buildHostnameAllowlistPolicyFromSuffixAllowlist,
  isHttpsUrlAllowedByHostnameSuffixAllowlist,
  isPrivateIpAddress,
  normalizeHostnameSuffixAllowlist
} from "openclaw/plugin-sdk";
function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
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
function normalizeContentType(value) {
  if (typeof value !== "string") {
    return void 0;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : void 0;
}
function inferPlaceholder(params) {
  const mime = params.contentType?.toLowerCase() ?? "";
  const name = params.fileName?.toLowerCase() ?? "";
  const fileType = params.fileType?.toLowerCase() ?? "";
  const looksLikeImage = mime.startsWith("image/") || IMAGE_EXT_RE.test(name) || IMAGE_EXT_RE.test(`x.${fileType}`);
  return looksLikeImage ? "<media:image>" : "<media:document>";
}
function isLikelyImageAttachment(att) {
  const contentType = normalizeContentType(att.contentType) ?? "";
  const name = typeof att.name === "string" ? att.name : "";
  if (contentType.startsWith("image/")) {
    return true;
  }
  if (IMAGE_EXT_RE.test(name)) {
    return true;
  }
  if (contentType === "application/vnd.microsoft.teams.file.download.info" && isRecord(att.content)) {
    const fileType = typeof att.content.fileType === "string" ? att.content.fileType : "";
    if (fileType && IMAGE_EXT_RE.test(`x.${fileType}`)) {
      return true;
    }
    const fileName = typeof att.content.fileName === "string" ? att.content.fileName : "";
    if (fileName && IMAGE_EXT_RE.test(fileName)) {
      return true;
    }
  }
  return false;
}
function isDownloadableAttachment(att) {
  const contentType = normalizeContentType(att.contentType) ?? "";
  if (contentType === "application/vnd.microsoft.teams.file.download.info" && isRecord(att.content) && typeof att.content.downloadUrl === "string") {
    return true;
  }
  if (typeof att.contentUrl === "string" && att.contentUrl.trim()) {
    return true;
  }
  return false;
}
function isHtmlAttachment(att) {
  const contentType = normalizeContentType(att.contentType) ?? "";
  return contentType.startsWith("text/html");
}
function extractHtmlFromAttachment(att) {
  if (!isHtmlAttachment(att)) {
    return void 0;
  }
  if (typeof att.content === "string") {
    return att.content;
  }
  if (!isRecord(att.content)) {
    return void 0;
  }
  const text = typeof att.content.text === "string" ? att.content.text : typeof att.content.body === "string" ? att.content.body : typeof att.content.content === "string" ? att.content.content : void 0;
  return text;
}
function decodeDataImage(src) {
  const match = /^data:(image\/[a-z0-9.+-]+)?(;base64)?,(.*)$/i.exec(src);
  if (!match) {
    return null;
  }
  const contentType = match[1]?.toLowerCase();
  const isBase64 = Boolean(match[2]);
  if (!isBase64) {
    return null;
  }
  const payload = match[3] ?? "";
  if (!payload) {
    return null;
  }
  try {
    const data = Buffer.from(payload, "base64");
    return { kind: "data", data, contentType, placeholder: "<media:image>" };
  } catch {
    return null;
  }
}
function fileHintFromUrl(src) {
  try {
    const url = new URL(src);
    const name = url.pathname.split("/").pop();
    return name || void 0;
  } catch {
    return void 0;
  }
}
function extractInlineImageCandidates(attachments) {
  const out = [];
  for (const att of attachments) {
    const html = extractHtmlFromAttachment(att);
    if (!html) {
      continue;
    }
    IMG_SRC_RE.lastIndex = 0;
    let match = IMG_SRC_RE.exec(html);
    while (match) {
      const src = match[1]?.trim();
      if (src && !src.startsWith("cid:")) {
        if (src.startsWith("data:")) {
          const decoded = decodeDataImage(src);
          if (decoded) {
            out.push(decoded);
          }
        } else {
          out.push({
            kind: "url",
            url: src,
            fileHint: fileHintFromUrl(src),
            placeholder: "<media:image>"
          });
        }
      }
      match = IMG_SRC_RE.exec(html);
    }
  }
  return out;
}
function safeHostForUrl(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "invalid-url";
  }
}
function resolveAllowedHosts(input) {
  return normalizeHostnameSuffixAllowlist(input, DEFAULT_MEDIA_HOST_ALLOWLIST);
}
function resolveAuthAllowedHosts(input) {
  return normalizeHostnameSuffixAllowlist(input, DEFAULT_MEDIA_AUTH_HOST_ALLOWLIST);
}
function resolveAttachmentFetchPolicy(params) {
  return {
    allowHosts: resolveAllowedHosts(params?.allowHosts),
    authAllowHosts: resolveAuthAllowedHosts(params?.authAllowHosts)
  };
}
function isUrlAllowed(url, allowlist) {
  return isHttpsUrlAllowedByHostnameSuffixAllowlist(url, allowlist);
}
function applyAuthorizationHeaderForUrl(params) {
  if (!params.bearerToken) {
    params.headers.delete("Authorization");
    return;
  }
  if (isUrlAllowed(params.url, params.authAllowHosts)) {
    params.headers.set("Authorization", `Bearer ${params.bearerToken}`);
    return;
  }
  params.headers.delete("Authorization");
}
function resolveMediaSsrfPolicy(allowHosts) {
  return buildHostnameAllowlistPolicyFromSuffixAllowlist(allowHosts);
}
async function resolveAndValidateIP(hostname, resolveFn) {
  const resolve = resolveFn ?? lookup;
  let resolved;
  try {
    resolved = await resolve(hostname);
  } catch {
    throw new Error(`DNS resolution failed for "${hostname}"`);
  }
  if (isPrivateOrReservedIP(resolved.address)) {
    throw new Error(`Hostname "${hostname}" resolves to private/reserved IP (${resolved.address})`);
  }
  return resolved.address;
}
async function safeFetch(params) {
  const fetchFn = params.fetchFn ?? fetch;
  const resolveFn = params.resolveFn;
  const hasDispatcher = Boolean(
    params.requestInit && typeof params.requestInit === "object" && "dispatcher" in params.requestInit
  );
  const currentHeaders = new Headers(params.requestInit?.headers);
  let currentUrl = params.url;
  if (!isUrlAllowed(currentUrl, params.allowHosts)) {
    throw new Error(`Initial download URL blocked: ${currentUrl}`);
  }
  if (resolveFn) {
    try {
      const initialHost = new URL(currentUrl).hostname;
      await resolveAndValidateIP(initialHost, resolveFn);
    } catch {
      throw new Error(`Initial download URL blocked: ${currentUrl}`);
    }
  }
  for (let i = 0; i <= MAX_SAFE_REDIRECTS; i++) {
    const res = await fetchFn(currentUrl, {
      ...params.requestInit,
      headers: currentHeaders,
      redirect: "manual"
    });
    if (![301, 302, 303, 307, 308].includes(res.status)) {
      return res;
    }
    const location = res.headers.get("location");
    if (!location) {
      return res;
    }
    let redirectUrl;
    try {
      redirectUrl = new URL(location, currentUrl).toString();
    } catch {
      throw new Error(`Invalid redirect URL: ${location}`);
    }
    if (!isUrlAllowed(redirectUrl, params.allowHosts)) {
      throw new Error(`Media redirect target blocked by allowlist: ${redirectUrl}`);
    }
    if (currentHeaders.has("authorization") && params.authorizationAllowHosts && !isUrlAllowed(redirectUrl, params.authorizationAllowHosts)) {
      currentHeaders.delete("authorization");
    }
    if (hasDispatcher) {
      return res;
    }
    if (resolveFn) {
      const redirectHost = new URL(redirectUrl).hostname;
      await resolveAndValidateIP(redirectHost, resolveFn);
    }
    currentUrl = redirectUrl;
  }
  throw new Error(`Too many redirects (>${MAX_SAFE_REDIRECTS})`);
}
async function safeFetchWithPolicy(params) {
  return await safeFetch({
    url: params.url,
    allowHosts: params.policy.allowHosts,
    authorizationAllowHosts: params.policy.authAllowHosts,
    fetchFn: params.fetchFn,
    requestInit: params.requestInit,
    resolveFn: params.resolveFn
  });
}
var IMAGE_EXT_RE, IMG_SRC_RE, ATTACHMENT_TAG_RE, DEFAULT_MEDIA_HOST_ALLOWLIST, DEFAULT_MEDIA_AUTH_HOST_ALLOWLIST, GRAPH_ROOT, isPrivateOrReservedIP, MAX_SAFE_REDIRECTS;
var init_shared = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/msteams/src/attachments/shared.ts"() {
    "use strict";
    IMAGE_EXT_RE = /\.(avif|bmp|gif|heic|heif|jpe?g|png|tiff?|webp)$/i;
    IMG_SRC_RE = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    ATTACHMENT_TAG_RE = /<attachment[^>]+id=["']([^"']+)["'][^>]*>/gi;
    DEFAULT_MEDIA_HOST_ALLOWLIST = [
      "graph.microsoft.com",
      "graph.microsoft.us",
      "graph.microsoft.de",
      "graph.microsoft.cn",
      "sharepoint.com",
      "sharepoint.us",
      "sharepoint.de",
      "sharepoint.cn",
      "sharepoint-df.com",
      "1drv.ms",
      "onedrive.com",
      "teams.microsoft.com",
      "teams.cdn.office.net",
      "statics.teams.cdn.office.net",
      "office.com",
      "office.net",
      // Azure Media Services / Skype CDN for clipboard-pasted images
      "asm.skype.com",
      "ams.skype.com",
      "media.ams.skype.com",
      // Bot Framework attachment URLs
      "trafficmanager.net",
      "blob.core.windows.net",
      "azureedge.net",
      "microsoft.com"
    ];
    DEFAULT_MEDIA_AUTH_HOST_ALLOWLIST = [
      "api.botframework.com",
      "botframework.com",
      "graph.microsoft.com",
      "graph.microsoft.us",
      "graph.microsoft.de",
      "graph.microsoft.cn"
    ];
    GRAPH_ROOT = "https://graph.microsoft.com/v1.0";
    isPrivateOrReservedIP = isPrivateIpAddress;
    MAX_SAFE_REDIRECTS = 5;
  }
});

// vendor/openclaw-runtime/win-x64/extensions/msteams/src/sdk.ts
async function loadMSTeamsSdk() {
  return await import("@microsoft/agents-hosting");
}
function buildMSTeamsAuthConfig(creds, sdk) {
  return sdk.getAuthConfigWithDefaults({
    clientId: creds.appId,
    clientSecret: creds.appPassword,
    tenantId: creds.tenantId
  });
}
function createMSTeamsAdapter(authConfig, sdk) {
  return new sdk.CloudAdapter(authConfig);
}
async function loadMSTeamsSdkWithAuth(creds) {
  const sdk = await loadMSTeamsSdk();
  const authConfig = buildMSTeamsAuthConfig(creds, sdk);
  return { sdk, authConfig };
}
var init_sdk = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/msteams/src/sdk.ts"() {
    "use strict";
  }
});

// vendor/openclaw-runtime/win-x64/extensions/msteams/src/token-response.ts
function readAccessToken(value) {
  if (typeof value === "string") {
    return value;
  }
  if (value && typeof value === "object") {
    const token = value.accessToken ?? value.token;
    return typeof token === "string" ? token : null;
  }
  return null;
}
var init_token_response = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/msteams/src/token-response.ts"() {
    "use strict";
  }
});

// vendor/openclaw-runtime/win-x64/extensions/msteams/src/secret-input.ts
import {
  hasConfiguredSecretInput,
  normalizeResolvedSecretInputString,
  normalizeSecretInputString
} from "openclaw/plugin-sdk";
var init_secret_input = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/msteams/src/secret-input.ts"() {
    "use strict";
  }
});

// vendor/openclaw-runtime/win-x64/extensions/msteams/src/token.ts
function hasConfiguredMSTeamsCredentials(cfg) {
  return Boolean(
    normalizeSecretInputString(cfg?.appId) && hasConfiguredSecretInput(cfg?.appPassword) && normalizeSecretInputString(cfg?.tenantId)
  );
}
function resolveMSTeamsCredentials(cfg) {
  const appId = normalizeSecretInputString(cfg?.appId) || normalizeSecretInputString(process.env.MSTEAMS_APP_ID);
  const appPassword = normalizeResolvedSecretInputString({
    value: cfg?.appPassword,
    path: "channels.msteams.appPassword"
  }) || normalizeSecretInputString(process.env.MSTEAMS_APP_PASSWORD);
  const tenantId = normalizeSecretInputString(cfg?.tenantId) || normalizeSecretInputString(process.env.MSTEAMS_TENANT_ID);
  if (!appId || !appPassword || !tenantId) {
    return void 0;
  }
  return { appId, appPassword, tenantId };
}
var init_token = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/msteams/src/token.ts"() {
    "use strict";
    init_secret_input();
  }
});

// vendor/openclaw-runtime/win-x64/extensions/msteams/src/graph.ts
function normalizeQuery(value) {
  return value?.trim() ?? "";
}
function escapeOData(value) {
  return value.replace(/'/g, "''");
}
async function fetchGraphJson(params) {
  const res = await fetch(`${GRAPH_ROOT}${params.path}`, {
    headers: {
      Authorization: `Bearer ${params.token}`,
      ...params.headers
    }
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Graph ${params.path} failed (${res.status}): ${text || "unknown error"}`);
  }
  return await res.json();
}
async function resolveGraphToken(cfg) {
  const creds = resolveMSTeamsCredentials(
    cfg?.channels?.msteams
  );
  if (!creds) {
    throw new Error("MS Teams credentials missing");
  }
  const { sdk, authConfig } = await loadMSTeamsSdkWithAuth(creds);
  const tokenProvider = new sdk.MsalTokenProvider(authConfig);
  const token = await tokenProvider.getAccessToken("https://graph.microsoft.com");
  const accessToken = readAccessToken(token);
  if (!accessToken) {
    throw new Error("MS Teams graph token unavailable");
  }
  return accessToken;
}
async function listTeamsByName(token, query) {
  const escaped = escapeOData(query);
  const filter = `resourceProvisioningOptions/Any(x:x eq 'Team') and startsWith(displayName,'${escaped}')`;
  const path3 = `/groups?$filter=${encodeURIComponent(filter)}&$select=id,displayName`;
  const res = await fetchGraphJson({ token, path: path3 });
  return res.value ?? [];
}
async function listChannelsForTeam(token, teamId) {
  const path3 = `/teams/${encodeURIComponent(teamId)}/channels?$select=id,displayName`;
  const res = await fetchGraphJson({ token, path: path3 });
  return res.value ?? [];
}
var init_graph = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/msteams/src/graph.ts"() {
    "use strict";
    init_shared();
    init_sdk();
    init_token_response();
    init_token();
  }
});

// vendor/openclaw-runtime/win-x64/extensions/msteams/src/graph-users.ts
async function searchGraphUsers(params) {
  const query = params.query.trim();
  if (!query) {
    return [];
  }
  if (query.includes("@")) {
    const escaped = escapeOData(query);
    const filter = `(mail eq '${escaped}' or userPrincipalName eq '${escaped}')`;
    const path4 = `/users?$filter=${encodeURIComponent(filter)}&$select=id,displayName,mail,userPrincipalName`;
    const res2 = await fetchGraphJson({ token: params.token, path: path4 });
    return res2.value ?? [];
  }
  const top = typeof params.top === "number" && params.top > 0 ? params.top : 10;
  const path3 = `/users?$search=${encodeURIComponent(`"displayName:${query}"`)}&$select=id,displayName,mail,userPrincipalName&$top=${top}`;
  const res = await fetchGraphJson({
    token: params.token,
    path: path3,
    headers: { ConsistencyLevel: "eventual" }
  });
  return res.value ?? [];
}
var init_graph_users = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/msteams/src/graph-users.ts"() {
    "use strict";
    init_graph();
  }
});

// vendor/openclaw-runtime/win-x64/extensions/msteams/src/resolve-allowlist.ts
function stripProviderPrefix(raw) {
  return raw.replace(/^(msteams|teams):/i, "");
}
function normalizeMSTeamsMessagingTarget(raw) {
  let trimmed = raw.trim();
  if (!trimmed) {
    return void 0;
  }
  trimmed = stripProviderPrefix(trimmed).trim();
  if (/^conversation:/i.test(trimmed)) {
    const id = trimmed.slice("conversation:".length).trim();
    return id ? `conversation:${id}` : void 0;
  }
  if (/^user:/i.test(trimmed)) {
    const id = trimmed.slice("user:".length).trim();
    return id ? `user:${id}` : void 0;
  }
  return trimmed || void 0;
}
function normalizeMSTeamsUserInput(raw) {
  return stripProviderPrefix(raw).replace(/^(user|conversation):/i, "").trim();
}
function parseMSTeamsConversationId(raw) {
  const trimmed = stripProviderPrefix(raw).trim();
  if (!/^conversation:/i.test(trimmed)) {
    return null;
  }
  const id = trimmed.slice("conversation:".length).trim();
  return id;
}
function normalizeMSTeamsTeamKey(raw) {
  const trimmed = stripProviderPrefix(raw).replace(/^team:/i, "").trim();
  return trimmed || void 0;
}
function normalizeMSTeamsChannelKey(raw) {
  const trimmed = raw?.trim().replace(/^#/, "").trim() ?? "";
  return trimmed || void 0;
}
function parseMSTeamsTeamChannelInput(raw) {
  const trimmed = stripProviderPrefix(raw).trim();
  if (!trimmed) {
    return {};
  }
  const parts = trimmed.split("/");
  const team = normalizeMSTeamsTeamKey(parts[0] ?? "");
  const channel2 = parts.length > 1 ? normalizeMSTeamsChannelKey(parts.slice(1).join("/")) : void 0;
  return {
    ...team ? { team } : {},
    ...channel2 ? { channel: channel2 } : {}
  };
}
function parseMSTeamsTeamEntry(raw) {
  const { team, channel: channel2 } = parseMSTeamsTeamChannelInput(raw);
  if (!team) {
    return null;
  }
  return {
    teamKey: team,
    ...channel2 ? { channelKey: channel2 } : {}
  };
}
async function resolveMSTeamsChannelAllowlist(params) {
  const token = await resolveGraphToken(params.cfg);
  const results = [];
  for (const input of params.entries) {
    const { team, channel: channel2 } = parseMSTeamsTeamChannelInput(input);
    if (!team) {
      results.push({ input, resolved: false });
      continue;
    }
    const teams = /^[0-9a-fA-F-]{16,}$/.test(team) ? [{ id: team, displayName: team }] : await listTeamsByName(token, team);
    if (teams.length === 0) {
      results.push({ input, resolved: false, note: "team not found" });
      continue;
    }
    const teamMatch = teams[0];
    const teamId = teamMatch.id?.trim();
    const teamName = teamMatch.displayName?.trim() || team;
    if (!teamId) {
      results.push({ input, resolved: false, note: "team id missing" });
      continue;
    }
    if (!channel2) {
      results.push({
        input,
        resolved: true,
        teamId,
        teamName,
        note: teams.length > 1 ? "multiple teams; chose first" : void 0
      });
      continue;
    }
    const channels = await listChannelsForTeam(token, teamId);
    const channelMatch = channels.find((item) => item.id === channel2) ?? channels.find((item) => item.displayName?.toLowerCase() === channel2.toLowerCase()) ?? channels.find(
      (item) => item.displayName?.toLowerCase().includes(channel2.toLowerCase() ?? "")
    );
    if (!channelMatch?.id) {
      results.push({ input, resolved: false, note: "channel not found" });
      continue;
    }
    results.push({
      input,
      resolved: true,
      teamId,
      teamName,
      channelId: channelMatch.id,
      channelName: channelMatch.displayName ?? channel2,
      note: channels.length > 1 ? "multiple channels; chose first" : void 0
    });
  }
  return results;
}
async function resolveMSTeamsUserAllowlist(params) {
  const token = await resolveGraphToken(params.cfg);
  const results = [];
  for (const input of params.entries) {
    const query = normalizeQuery(normalizeMSTeamsUserInput(input));
    if (!query) {
      results.push({ input, resolved: false });
      continue;
    }
    if (/^[0-9a-fA-F-]{16,}$/.test(query)) {
      results.push({ input, resolved: true, id: query });
      continue;
    }
    const users = await searchGraphUsers({ token, query, top: 10 });
    const match = users[0];
    if (!match?.id) {
      results.push({ input, resolved: false });
      continue;
    }
    results.push({
      input,
      resolved: true,
      id: match.id,
      name: match.displayName ?? void 0,
      note: users.length > 1 ? "multiple matches; chose first" : void 0
    });
  }
  return results;
}
var init_resolve_allowlist = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/msteams/src/resolve-allowlist.ts"() {
    "use strict";
    init_graph_users();
    init_graph();
  }
});

// vendor/openclaw-runtime/win-x64/extensions/msteams/src/runtime.ts
function setMSTeamsRuntime(next) {
  runtime = next;
}
function getMSTeamsRuntime() {
  if (!runtime) {
    throw new Error("MSTeams runtime not initialized");
  }
  return runtime;
}
var runtime;
var init_runtime = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/msteams/src/runtime.ts"() {
    "use strict";
    runtime = null;
  }
});

// vendor/openclaw-runtime/win-x64/extensions/msteams/src/storage.ts
import path from "path";
function resolveMSTeamsStorePath(params) {
  if (params.storePath) {
    return params.storePath;
  }
  if (params.stateDir) {
    return path.join(params.stateDir, params.filename);
  }
  const env = params.env ?? process.env;
  const stateDir = params.homedir ? getMSTeamsRuntime().state.resolveStateDir(env, params.homedir) : getMSTeamsRuntime().state.resolveStateDir(env);
  return path.join(stateDir, params.filename);
}
var init_storage = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/msteams/src/storage.ts"() {
    "use strict";
    init_runtime();
  }
});

// vendor/openclaw-runtime/win-x64/extensions/msteams/src/file-lock.ts
import { withFileLock } from "openclaw/plugin-sdk";
var init_file_lock = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/msteams/src/file-lock.ts"() {
    "use strict";
  }
});

// vendor/openclaw-runtime/win-x64/extensions/msteams/src/store-fs.ts
import fs from "fs";
import { readJsonFileWithFallback, writeJsonFileAtomically } from "openclaw/plugin-sdk";
async function readJsonFile(filePath, fallback) {
  return await readJsonFileWithFallback(filePath, fallback);
}
async function writeJsonFile(filePath, value) {
  await writeJsonFileAtomically(filePath, value);
}
async function ensureJsonFile(filePath, fallback) {
  try {
    await fs.promises.access(filePath);
  } catch {
    await writeJsonFile(filePath, fallback);
  }
}
async function withFileLock2(filePath, fallback, fn) {
  await ensureJsonFile(filePath, fallback);
  return await withFileLock(filePath, STORE_LOCK_OPTIONS, async () => {
    return await fn();
  });
}
var STORE_LOCK_OPTIONS;
var init_store_fs = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/msteams/src/store-fs.ts"() {
    "use strict";
    init_file_lock();
    STORE_LOCK_OPTIONS = {
      retries: {
        retries: 10,
        factor: 2,
        minTimeout: 100,
        maxTimeout: 1e4,
        randomize: true
      },
      stale: 3e4
    };
  }
});

// vendor/openclaw-runtime/win-x64/extensions/msteams/src/polls.ts
import crypto from "crypto";
function isRecord2(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function normalizeChoiceValue(value) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}
function extractSelections(value) {
  if (Array.isArray(value)) {
    return value.map(normalizeChoiceValue).filter((entry) => Boolean(entry));
  }
  const normalized = normalizeChoiceValue(value);
  if (!normalized) {
    return [];
  }
  if (normalized.includes(",")) {
    return normalized.split(",").map((entry) => entry.trim()).filter(Boolean);
  }
  return [normalized];
}
function readNestedValue(value, keys) {
  let current = value;
  for (const key of keys) {
    if (!isRecord2(current)) {
      return void 0;
    }
    current = current[key];
  }
  return current;
}
function readNestedString(value, keys) {
  const found = readNestedValue(value, keys);
  return typeof found === "string" && found.trim() ? found.trim() : void 0;
}
function extractMSTeamsPollVote(activity) {
  const value = activity?.value;
  if (!value || !isRecord2(value)) {
    return null;
  }
  const pollId = readNestedString(value, ["openclawPollId"]) ?? readNestedString(value, ["pollId"]) ?? readNestedString(value, ["openclaw", "pollId"]) ?? readNestedString(value, ["openclaw", "poll", "id"]) ?? readNestedString(value, ["data", "openclawPollId"]) ?? readNestedString(value, ["data", "pollId"]) ?? readNestedString(value, ["data", "openclaw", "pollId"]);
  if (!pollId) {
    return null;
  }
  const directSelections = extractSelections(value.choices);
  const nestedSelections = extractSelections(readNestedValue(value, ["choices"]));
  const dataSelections = extractSelections(readNestedValue(value, ["data", "choices"]));
  const selections = directSelections.length > 0 ? directSelections : nestedSelections.length > 0 ? nestedSelections : dataSelections;
  if (selections.length === 0) {
    return null;
  }
  return {
    pollId,
    selections
  };
}
function buildMSTeamsPollCard(params) {
  const pollId = params.pollId ?? crypto.randomUUID();
  const maxSelections = typeof params.maxSelections === "number" && params.maxSelections > 1 ? Math.floor(params.maxSelections) : 1;
  const cappedMaxSelections = Math.min(Math.max(1, maxSelections), params.options.length);
  const choices = params.options.map((option, index) => ({
    title: option,
    value: String(index)
  }));
  const hint = cappedMaxSelections > 1 ? `Select up to ${cappedMaxSelections} option${cappedMaxSelections === 1 ? "" : "s"}.` : "Select one option.";
  const card = {
    type: "AdaptiveCard",
    version: "1.5",
    body: [
      {
        type: "TextBlock",
        text: params.question,
        wrap: true,
        weight: "Bolder",
        size: "Medium"
      },
      {
        type: "Input.ChoiceSet",
        id: "choices",
        isMultiSelect: cappedMaxSelections > 1,
        style: "expanded",
        choices
      },
      {
        type: "TextBlock",
        text: hint,
        wrap: true,
        isSubtle: true,
        spacing: "Small"
      }
    ],
    actions: [
      {
        type: "Action.Submit",
        title: "Vote",
        data: {
          openclawPollId: pollId,
          pollId
        },
        msteams: {
          type: "messageBack",
          text: "openclaw poll vote",
          displayText: "Vote recorded",
          value: { openclawPollId: pollId, pollId }
        }
      }
    ]
  };
  const fallbackLines = [
    `Poll: ${params.question}`,
    ...params.options.map((option, index) => `${index + 1}. ${option}`)
  ];
  return {
    pollId,
    question: params.question,
    options: params.options,
    maxSelections: cappedMaxSelections,
    card,
    fallbackText: fallbackLines.join("\n")
  };
}
function parseTimestamp(value) {
  if (!value) {
    return null;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}
function pruneExpired(polls) {
  const cutoff = Date.now() - POLL_TTL_MS;
  const entries = Object.entries(polls).filter(([, poll]) => {
    const ts = parseTimestamp(poll.updatedAt ?? poll.createdAt) ?? 0;
    return ts >= cutoff;
  });
  return Object.fromEntries(entries);
}
function pruneToLimit(polls) {
  const entries = Object.entries(polls);
  if (entries.length <= MAX_POLLS) {
    return polls;
  }
  entries.sort((a, b) => {
    const aTs = parseTimestamp(a[1].updatedAt ?? a[1].createdAt) ?? 0;
    const bTs = parseTimestamp(b[1].updatedAt ?? b[1].createdAt) ?? 0;
    return aTs - bTs;
  });
  const keep = entries.slice(entries.length - MAX_POLLS);
  return Object.fromEntries(keep);
}
function normalizeMSTeamsPollSelections(poll, selections) {
  const maxSelections = Math.max(1, poll.maxSelections);
  const mapped = selections.map((entry) => Number.parseInt(entry, 10)).filter((value) => Number.isFinite(value)).filter((value) => value >= 0 && value < poll.options.length).map((value) => String(value));
  const limited = maxSelections > 1 ? mapped.slice(0, maxSelections) : mapped.slice(0, 1);
  return Array.from(new Set(limited));
}
function createMSTeamsPollStoreFs(params) {
  const filePath = resolveMSTeamsStorePath({
    filename: STORE_FILENAME,
    env: params?.env,
    homedir: params?.homedir,
    stateDir: params?.stateDir,
    storePath: params?.storePath
  });
  const empty = { version: 1, polls: {} };
  const readStore = async () => {
    const { value } = await readJsonFile(filePath, empty);
    const pruned = pruneToLimit(pruneExpired(value.polls ?? {}));
    return { version: 1, polls: pruned };
  };
  const writeStore = async (data) => {
    await writeJsonFile(filePath, data);
  };
  const createPoll = async (poll) => {
    await withFileLock2(filePath, empty, async () => {
      const data = await readStore();
      data.polls[poll.id] = poll;
      await writeStore({ version: 1, polls: pruneToLimit(data.polls) });
    });
  };
  const getPoll = async (pollId) => await withFileLock2(filePath, empty, async () => {
    const data = await readStore();
    return data.polls[pollId] ?? null;
  });
  const recordVote = async (params2) => await withFileLock2(filePath, empty, async () => {
    const data = await readStore();
    const poll = data.polls[params2.pollId];
    if (!poll) {
      return null;
    }
    const normalized = normalizeMSTeamsPollSelections(poll, params2.selections);
    poll.votes[params2.voterId] = normalized;
    poll.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    data.polls[poll.id] = poll;
    await writeStore({ version: 1, polls: pruneToLimit(data.polls) });
    return poll;
  });
  return { createPoll, getPoll, recordVote };
}
var STORE_FILENAME, MAX_POLLS, POLL_TTL_MS;
var init_polls = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/msteams/src/polls.ts"() {
    "use strict";
    init_storage();
    init_store_fs();
    STORE_FILENAME = "msteams-polls.json";
    MAX_POLLS = 1e3;
    POLL_TTL_MS = 30 * 24 * 60 * 60 * 1e3;
  }
});

// vendor/openclaw-runtime/win-x64/extensions/msteams/src/conversation-store-fs.ts
function parseTimestamp2(value) {
  if (!value) {
    return null;
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return parsed;
}
function pruneToLimit2(conversations) {
  const entries = Object.entries(conversations);
  if (entries.length <= MAX_CONVERSATIONS) {
    return conversations;
  }
  entries.sort((a, b) => {
    const aTs = parseTimestamp2(a[1].lastSeenAt) ?? 0;
    const bTs = parseTimestamp2(b[1].lastSeenAt) ?? 0;
    return aTs - bTs;
  });
  const keep = entries.slice(entries.length - MAX_CONVERSATIONS);
  return Object.fromEntries(keep);
}
function pruneExpired2(conversations, nowMs, ttlMs) {
  let removed = false;
  const kept = {};
  for (const [conversationId, reference] of Object.entries(conversations)) {
    const lastSeenAt = parseTimestamp2(reference.lastSeenAt);
    if (lastSeenAt != null && nowMs - lastSeenAt > ttlMs) {
      removed = true;
      continue;
    }
    kept[conversationId] = reference;
  }
  return { conversations: kept, removed };
}
function normalizeConversationId(raw) {
  return raw.split(";")[0] ?? raw;
}
function createMSTeamsConversationStoreFs(params) {
  const ttlMs = params?.ttlMs ?? CONVERSATION_TTL_MS;
  const filePath = resolveMSTeamsStorePath({
    filename: STORE_FILENAME2,
    env: params?.env,
    homedir: params?.homedir,
    stateDir: params?.stateDir,
    storePath: params?.storePath
  });
  const empty = { version: 1, conversations: {} };
  const readStore = async () => {
    const { value } = await readJsonFile(filePath, empty);
    if (value.version !== 1 || !value.conversations || typeof value.conversations !== "object" || Array.isArray(value.conversations)) {
      return empty;
    }
    const nowMs = Date.now();
    const pruned = pruneExpired2(value.conversations, nowMs, ttlMs).conversations;
    return { version: 1, conversations: pruneToLimit2(pruned) };
  };
  const list = async () => {
    const store = await readStore();
    return Object.entries(store.conversations).map(([conversationId, reference]) => ({
      conversationId,
      reference
    }));
  };
  const get = async (conversationId) => {
    const store = await readStore();
    return store.conversations[normalizeConversationId(conversationId)] ?? null;
  };
  const findByUserId = async (id) => {
    const target = id.trim();
    if (!target) {
      return null;
    }
    for (const entry of await list()) {
      const { conversationId, reference } = entry;
      if (reference.user?.aadObjectId === target) {
        return { conversationId, reference };
      }
      if (reference.user?.id === target) {
        return { conversationId, reference };
      }
    }
    return null;
  };
  const upsert = async (conversationId, reference) => {
    const normalizedId = normalizeConversationId(conversationId);
    await withFileLock2(filePath, empty, async () => {
      const store = await readStore();
      store.conversations[normalizedId] = {
        ...reference,
        lastSeenAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      const nowMs = Date.now();
      store.conversations = pruneExpired2(store.conversations, nowMs, ttlMs).conversations;
      store.conversations = pruneToLimit2(store.conversations);
      await writeJsonFile(filePath, store);
    });
  };
  const remove = async (conversationId) => {
    const normalizedId = normalizeConversationId(conversationId);
    return await withFileLock2(filePath, empty, async () => {
      const store = await readStore();
      if (!(normalizedId in store.conversations)) {
        return false;
      }
      delete store.conversations[normalizedId];
      await writeJsonFile(filePath, store);
      return true;
    });
  };
  return { upsert, get, list, remove, findByUserId };
}
var STORE_FILENAME2, MAX_CONVERSATIONS, CONVERSATION_TTL_MS;
var init_conversation_store_fs = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/msteams/src/conversation-store-fs.ts"() {
    "use strict";
    init_storage();
    init_store_fs();
    STORE_FILENAME2 = "msteams-conversations.json";
    MAX_CONVERSATIONS = 1e3;
    CONVERSATION_TTL_MS = 365 * 24 * 60 * 60 * 1e3;
  }
});

// vendor/openclaw-runtime/win-x64/extensions/msteams/src/errors.ts
function formatUnknownError(err) {
  if (err instanceof Error) {
    return err.message;
  }
  if (typeof err === "string") {
    return err;
  }
  if (err === null) {
    return "null";
  }
  if (err === void 0) {
    return "undefined";
  }
  if (typeof err === "number" || typeof err === "boolean" || typeof err === "bigint") {
    return String(err);
  }
  if (typeof err === "symbol") {
    return err.description ?? err.toString();
  }
  if (typeof err === "function") {
    return err.name ? `[function ${err.name}]` : "[function]";
  }
  try {
    return JSON.stringify(err) ?? "unknown error";
  } catch {
    return "unknown error";
  }
}
function isRecord3(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function extractStatusCode(err) {
  if (!isRecord3(err)) {
    return null;
  }
  const direct = err.statusCode ?? err.status;
  if (typeof direct === "number" && Number.isFinite(direct)) {
    return direct;
  }
  if (typeof direct === "string") {
    const parsed = Number.parseInt(direct, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  const response = err.response;
  if (isRecord3(response)) {
    const status = response.status;
    if (typeof status === "number" && Number.isFinite(status)) {
      return status;
    }
    if (typeof status === "string") {
      const parsed = Number.parseInt(status, 10);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return null;
}
function extractRetryAfterMs(err) {
  if (!isRecord3(err)) {
    return null;
  }
  const direct = err.retryAfterMs ?? err.retry_after_ms;
  if (typeof direct === "number" && Number.isFinite(direct) && direct >= 0) {
    return direct;
  }
  const retryAfter = err.retryAfter ?? err.retry_after;
  if (typeof retryAfter === "number" && Number.isFinite(retryAfter)) {
    return retryAfter >= 0 ? retryAfter * 1e3 : null;
  }
  if (typeof retryAfter === "string") {
    const parsed = Number.parseFloat(retryAfter);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed * 1e3;
    }
  }
  const response = err.response;
  if (!isRecord3(response)) {
    return null;
  }
  const headers = response.headers;
  if (!headers) {
    return null;
  }
  if (isRecord3(headers)) {
    const raw = headers["retry-after"] ?? headers["Retry-After"];
    if (typeof raw === "string") {
      const parsed = Number.parseFloat(raw);
      if (Number.isFinite(parsed) && parsed >= 0) {
        return parsed * 1e3;
      }
    }
  }
  if (typeof headers === "object" && headers !== null && "get" in headers && typeof headers.get === "function") {
    const raw = headers.get("retry-after");
    if (raw) {
      const parsed = Number.parseFloat(raw);
      if (Number.isFinite(parsed) && parsed >= 0) {
        return parsed * 1e3;
      }
    }
  }
  return null;
}
function classifyMSTeamsSendError(err) {
  const statusCode = extractStatusCode(err);
  const retryAfterMs = extractRetryAfterMs(err);
  if (statusCode === 401 || statusCode === 403) {
    return { kind: "auth", statusCode };
  }
  if (statusCode === 429) {
    return {
      kind: "throttled",
      statusCode,
      retryAfterMs: retryAfterMs ?? void 0
    };
  }
  if (statusCode === 408 || statusCode != null && statusCode >= 500) {
    return {
      kind: "transient",
      statusCode,
      retryAfterMs: retryAfterMs ?? void 0
    };
  }
  if (statusCode != null && statusCode >= 400) {
    return { kind: "permanent", statusCode };
  }
  return {
    kind: "unknown",
    statusCode: statusCode ?? void 0,
    retryAfterMs: retryAfterMs ?? void 0
  };
}
function isRevokedProxyError(err) {
  if (!(err instanceof TypeError)) {
    return false;
  }
  return /proxy that has been revoked/i.test(err.message);
}
function formatMSTeamsSendErrorHint(classification) {
  if (classification.kind === "auth") {
    return "check msteams appId/appPassword/tenantId (or env vars MSTEAMS_APP_ID/MSTEAMS_APP_PASSWORD/MSTEAMS_TENANT_ID)";
  }
  if (classification.kind === "throttled") {
    return "Teams throttled the bot; backing off may help";
  }
  if (classification.kind === "transient") {
    return "transient Teams/Bot Framework error; retry may succeed";
  }
  return void 0;
}
var init_errors = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/msteams/src/errors.ts"() {
    "use strict";
  }
});

// vendor/openclaw-runtime/win-x64/extensions/msteams/src/file-consent.ts
function buildFileConsentCard(params) {
  return {
    contentType: "application/vnd.microsoft.teams.card.file.consent",
    name: params.filename,
    content: {
      description: params.description ?? `File: ${params.filename}`,
      sizeInBytes: params.sizeInBytes,
      acceptContext: { filename: params.filename, ...params.context },
      declineContext: { filename: params.filename, ...params.context }
    }
  };
}
function buildFileInfoCard(params) {
  return {
    contentType: "application/vnd.microsoft.teams.card.file.info",
    contentUrl: params.contentUrl,
    name: params.filename,
    content: {
      uniqueId: params.uniqueId,
      fileType: params.fileType
    }
  };
}
function parseFileConsentInvoke(activity) {
  if (activity.name !== "fileConsent/invoke") {
    return null;
  }
  const value = activity.value;
  if (value?.type !== "fileUpload") {
    return null;
  }
  return {
    action: value.action === "accept" ? "accept" : "decline",
    uploadInfo: value.uploadInfo,
    context: value.context
  };
}
async function uploadToConsentUrl(params) {
  const fetchFn = params.fetchFn ?? fetch;
  const res = await fetchFn(params.url, {
    method: "PUT",
    headers: {
      "Content-Type": params.contentType ?? "application/octet-stream",
      "Content-Range": `bytes 0-${params.buffer.length - 1}/${params.buffer.length}`
    },
    body: new Uint8Array(params.buffer)
  });
  if (!res.ok) {
    throw new Error(`File upload to consent URL failed: ${res.status} ${res.statusText}`);
  }
}
var init_file_consent = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/msteams/src/file-consent.ts"() {
    "use strict";
  }
});

// vendor/openclaw-runtime/win-x64/extensions/msteams/src/pending-uploads.ts
import crypto2 from "crypto";
function storePendingUpload(upload) {
  const id = crypto2.randomUUID();
  const entry = {
    ...upload,
    id,
    createdAt: Date.now()
  };
  pendingUploads.set(id, entry);
  setTimeout(() => {
    pendingUploads.delete(id);
  }, PENDING_UPLOAD_TTL_MS);
  return id;
}
function getPendingUpload(id) {
  if (!id) {
    return void 0;
  }
  const entry = pendingUploads.get(id);
  if (!entry) {
    return void 0;
  }
  if (Date.now() - entry.createdAt > PENDING_UPLOAD_TTL_MS) {
    pendingUploads.delete(id);
    return void 0;
  }
  return entry;
}
function removePendingUpload(id) {
  if (id) {
    pendingUploads.delete(id);
  }
}
var pendingUploads, PENDING_UPLOAD_TTL_MS;
var init_pending_uploads = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/msteams/src/pending-uploads.ts"() {
    "use strict";
    pendingUploads = /* @__PURE__ */ new Map();
    PENDING_UPLOAD_TTL_MS = 5 * 60 * 1e3;
  }
});

// vendor/openclaw-runtime/win-x64/extensions/msteams/src/file-consent-helpers.ts
function prepareFileConsentActivity(params) {
  const { media, conversationId, description } = params;
  const uploadId = storePendingUpload({
    buffer: media.buffer,
    filename: media.filename,
    contentType: media.contentType,
    conversationId
  });
  const consentCard = buildFileConsentCard({
    filename: media.filename,
    description: description || `File: ${media.filename}`,
    sizeInBytes: media.buffer.length,
    context: { uploadId }
  });
  const activity = {
    type: "message",
    attachments: [consentCard]
  };
  return { activity, uploadId };
}
function requiresFileConsent(params) {
  const isPersonal = params.conversationType?.toLowerCase() === "personal";
  const isImage = params.contentType?.startsWith("image/") ?? false;
  const isLargeFile = params.bufferSize >= params.thresholdBytes;
  return isPersonal && (isLargeFile || !isImage);
}
var init_file_consent_helpers = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/msteams/src/file-consent-helpers.ts"() {
    "use strict";
    init_file_consent();
    init_pending_uploads();
  }
});

// vendor/openclaw-runtime/win-x64/extensions/msteams/src/graph-chat.ts
function buildTeamsFileInfoCard(file) {
  const rawETag = file.eTag;
  const uniqueId = rawETag.replace(/^["']|["']$/g, "").replace(/[{}]/g, "").split(",")[0] ?? rawETag;
  const lastDot = file.name.lastIndexOf(".");
  const fileType = lastDot >= 0 ? file.name.slice(lastDot + 1).toLowerCase() : "";
  return {
    contentType: "application/vnd.microsoft.teams.card.file.info",
    contentUrl: file.webDavUrl,
    name: file.name,
    content: {
      uniqueId,
      fileType
    }
  };
}
var init_graph_chat = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/msteams/src/graph-chat.ts"() {
    "use strict";
  }
});

// vendor/openclaw-runtime/win-x64/extensions/msteams/src/graph-upload.ts
async function uploadToOneDrive(params) {
  const fetchFn = params.fetchFn ?? fetch;
  const token = await params.tokenProvider.getAccessToken(GRAPH_SCOPE);
  const uploadPath = `/OpenClawShared/${encodeURIComponent(params.filename)}`;
  const res = await fetchFn(`${GRAPH_ROOT2}/me/drive/root:${uploadPath}:/content`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": params.contentType ?? "application/octet-stream"
    },
    body: new Uint8Array(params.buffer)
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`OneDrive upload failed: ${res.status} ${res.statusText} - ${body}`);
  }
  const data = await res.json();
  if (!data.id || !data.webUrl || !data.name) {
    throw new Error("OneDrive upload response missing required fields");
  }
  return {
    id: data.id,
    webUrl: data.webUrl,
    name: data.name
  };
}
async function createSharingLink(params) {
  const fetchFn = params.fetchFn ?? fetch;
  const token = await params.tokenProvider.getAccessToken(GRAPH_SCOPE);
  const res = await fetchFn(`${GRAPH_ROOT2}/me/drive/items/${params.itemId}/createLink`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      type: "view",
      scope: params.scope ?? "organization"
    })
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Create sharing link failed: ${res.status} ${res.statusText} - ${body}`);
  }
  const data = await res.json();
  if (!data.link?.webUrl) {
    throw new Error("Create sharing link response missing webUrl");
  }
  return {
    webUrl: data.link.webUrl
  };
}
async function uploadAndShareOneDrive(params) {
  const uploaded = await uploadToOneDrive({
    buffer: params.buffer,
    filename: params.filename,
    contentType: params.contentType,
    tokenProvider: params.tokenProvider,
    fetchFn: params.fetchFn
  });
  const shareLink = await createSharingLink({
    itemId: uploaded.id,
    tokenProvider: params.tokenProvider,
    scope: params.scope,
    fetchFn: params.fetchFn
  });
  return {
    itemId: uploaded.id,
    webUrl: uploaded.webUrl,
    shareUrl: shareLink.webUrl,
    name: uploaded.name
  };
}
async function uploadToSharePoint(params) {
  const fetchFn = params.fetchFn ?? fetch;
  const token = await params.tokenProvider.getAccessToken(GRAPH_SCOPE);
  const uploadPath = `/OpenClawShared/${encodeURIComponent(params.filename)}`;
  const res = await fetchFn(
    `${GRAPH_ROOT2}/sites/${params.siteId}/drive/root:${uploadPath}:/content`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": params.contentType ?? "application/octet-stream"
      },
      body: new Uint8Array(params.buffer)
    }
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`SharePoint upload failed: ${res.status} ${res.statusText} - ${body}`);
  }
  const data = await res.json();
  if (!data.id || !data.webUrl || !data.name) {
    throw new Error("SharePoint upload response missing required fields");
  }
  return {
    id: data.id,
    webUrl: data.webUrl,
    name: data.name
  };
}
async function getDriveItemProperties(params) {
  const fetchFn = params.fetchFn ?? fetch;
  const token = await params.tokenProvider.getAccessToken(GRAPH_SCOPE);
  const res = await fetchFn(
    `${GRAPH_ROOT2}/sites/${params.siteId}/drive/items/${params.itemId}?$select=eTag,webDavUrl,name`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Get driveItem properties failed: ${res.status} ${res.statusText} - ${body}`);
  }
  const data = await res.json();
  if (!data.eTag || !data.webDavUrl || !data.name) {
    throw new Error("DriveItem response missing required properties (eTag, webDavUrl, or name)");
  }
  return {
    eTag: data.eTag,
    webDavUrl: data.webDavUrl,
    name: data.name
  };
}
async function getChatMembers(params) {
  const fetchFn = params.fetchFn ?? fetch;
  const token = await params.tokenProvider.getAccessToken(GRAPH_SCOPE);
  const res = await fetchFn(`${GRAPH_ROOT2}/chats/${params.chatId}/members`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Get chat members failed: ${res.status} ${res.statusText} - ${body}`);
  }
  const data = await res.json();
  return (data.value ?? []).map((m) => ({
    aadObjectId: m.userId ?? "",
    displayName: m.displayName
  })).filter((m) => m.aadObjectId);
}
async function createSharePointSharingLink(params) {
  const fetchFn = params.fetchFn ?? fetch;
  const token = await params.tokenProvider.getAccessToken(GRAPH_SCOPE);
  const scope = params.scope ?? "organization";
  const apiRoot = scope === "users" ? GRAPH_BETA : GRAPH_ROOT2;
  const body = {
    type: "view",
    scope: scope === "users" ? "users" : "organization"
  };
  if (scope === "users" && params.recipientObjectIds?.length) {
    body.recipients = params.recipientObjectIds.map((id) => ({ objectId: id }));
  }
  const res = await fetchFn(
    `${apiRoot}/sites/${params.siteId}/drive/items/${params.itemId}/createLink`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    }
  );
  if (!res.ok) {
    const respBody = await res.text().catch(() => "");
    throw new Error(
      `Create SharePoint sharing link failed: ${res.status} ${res.statusText} - ${respBody}`
    );
  }
  const data = await res.json();
  if (!data.link?.webUrl) {
    throw new Error("Create SharePoint sharing link response missing webUrl");
  }
  return {
    webUrl: data.link.webUrl
  };
}
async function uploadAndShareSharePoint(params) {
  const uploaded = await uploadToSharePoint({
    buffer: params.buffer,
    filename: params.filename,
    contentType: params.contentType,
    tokenProvider: params.tokenProvider,
    siteId: params.siteId,
    fetchFn: params.fetchFn
  });
  let scope = "organization";
  let recipientObjectIds;
  if (params.usePerUserSharing && params.chatId) {
    try {
      const members = await getChatMembers({
        chatId: params.chatId,
        tokenProvider: params.tokenProvider,
        fetchFn: params.fetchFn
      });
      if (members.length > 0) {
        scope = "users";
        recipientObjectIds = members.map((m) => m.aadObjectId);
      }
    } catch {
    }
  }
  const shareLink = await createSharePointSharingLink({
    siteId: params.siteId,
    itemId: uploaded.id,
    tokenProvider: params.tokenProvider,
    scope,
    recipientObjectIds,
    fetchFn: params.fetchFn
  });
  return {
    itemId: uploaded.id,
    webUrl: uploaded.webUrl,
    shareUrl: shareLink.webUrl,
    name: uploaded.name
  };
}
var GRAPH_ROOT2, GRAPH_BETA, GRAPH_SCOPE;
var init_graph_upload = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/msteams/src/graph-upload.ts"() {
    "use strict";
    GRAPH_ROOT2 = "https://graph.microsoft.com/v1.0";
    GRAPH_BETA = "https://graph.microsoft.com/beta";
    GRAPH_SCOPE = "https://graph.microsoft.com";
  }
});

// vendor/openclaw-runtime/win-x64/extensions/msteams/src/media-helpers.ts
import path2 from "path";
import {
  detectMime,
  extensionForMime,
  extractOriginalFilename,
  getFileExtension
} from "openclaw/plugin-sdk";
async function getMimeType(url) {
  if (url.startsWith("data:")) {
    const match = url.match(/^data:([^;,]+)/);
    if (match?.[1]) {
      return match[1];
    }
  }
  const detected = await detectMime({ filePath: url });
  return detected ?? "application/octet-stream";
}
async function extractFilename(url) {
  if (url.startsWith("data:")) {
    const mime = await getMimeType(url);
    const ext = extensionForMime(mime) ?? ".bin";
    const prefix = mime.startsWith("image/") ? "image" : "file";
    return `${prefix}${ext}`;
  }
  try {
    const pathname = new URL(url).pathname;
    const basename = path2.basename(pathname);
    const existingExt = getFileExtension(pathname);
    if (basename && existingExt) {
      return basename;
    }
    const mime = await getMimeType(url);
    const ext = extensionForMime(mime) ?? ".bin";
    const prefix = mime.startsWith("image/") ? "image" : "file";
    return basename ? `${basename}${ext}` : `${prefix}${ext}`;
  } catch {
    return extractOriginalFilename(url);
  }
}
function isLocalPath(url) {
  if (url.startsWith("file://") || url.startsWith("/") || url.startsWith("~")) {
    return true;
  }
  if (url.startsWith("\\") && !url.startsWith("\\\\")) {
    return true;
  }
  if (/^[a-zA-Z]:[\\/]/.test(url)) {
    return true;
  }
  if (url.startsWith("\\\\")) {
    return true;
  }
  return false;
}
function extractMessageId(response) {
  if (!response || typeof response !== "object") {
    return null;
  }
  if (!("id" in response)) {
    return null;
  }
  const { id } = response;
  if (typeof id !== "string" || !id) {
    return null;
  }
  return id;
}
var init_media_helpers = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/msteams/src/media-helpers.ts"() {
    "use strict";
  }
});

// vendor/openclaw-runtime/win-x64/extensions/msteams/src/mentions.ts
function isValidTeamsId(id) {
  return TEAMS_BOT_ID_PATTERN.test(id) || AAD_OBJECT_ID_PATTERN.test(id);
}
function parseMentions(text) {
  const mentionPattern = /@\[([^\]]+)\]\(([^)]+)\)/g;
  const entities = [];
  const formattedText = text.replace(mentionPattern, (match, name, id) => {
    const trimmedId = id.trim();
    if (!isValidTeamsId(trimmedId)) {
      return match;
    }
    const trimmedName = name.trim();
    const mentionTag = `<at>${trimmedName}</at>`;
    entities.push({
      type: "mention",
      text: mentionTag,
      mentioned: {
        id: trimmedId,
        name: trimmedName
      }
    });
    return mentionTag;
  });
  return {
    text: formattedText,
    entities
  };
}
var TEAMS_BOT_ID_PATTERN, AAD_OBJECT_ID_PATTERN;
var init_mentions = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/msteams/src/mentions.ts"() {
    "use strict";
    TEAMS_BOT_ID_PATTERN = /^\d+:[a-z0-9._=-]+(?::[a-z0-9._=-]+)*$/i;
    AAD_OBJECT_ID_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
  }
});

// vendor/openclaw-runtime/win-x64/extensions/msteams/src/revoked-context.ts
async function withRevokedProxyFallback(params) {
  try {
    return await params.run();
  } catch (err) {
    if (!isRevokedProxyError(err)) {
      throw err;
    }
    params.onRevokedLog?.();
    return await params.onRevoked();
  }
}
var init_revoked_context = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/msteams/src/revoked-context.ts"() {
    "use strict";
    init_errors();
  }
});

// vendor/openclaw-runtime/win-x64/extensions/msteams/src/messenger.ts
import {
  isSilentReplyText,
  loadWebMedia,
  SILENT_REPLY_TOKEN,
  sleep
} from "openclaw/plugin-sdk";
function normalizeConversationId2(rawId) {
  return rawId.split(";")[0] ?? rawId;
}
function buildConversationReference(ref) {
  const conversationId = ref.conversation?.id?.trim();
  if (!conversationId) {
    throw new Error("Invalid stored reference: missing conversation.id");
  }
  const agent = ref.agent ?? ref.bot ?? void 0;
  if (agent == null || !agent.id) {
    throw new Error("Invalid stored reference: missing agent.id");
  }
  const user = ref.user;
  if (!user?.id) {
    throw new Error("Invalid stored reference: missing user.id");
  }
  return {
    activityId: ref.activityId,
    user,
    agent,
    conversation: {
      id: normalizeConversationId2(conversationId),
      conversationType: ref.conversation?.conversationType,
      tenantId: ref.conversation?.tenantId
    },
    channelId: ref.channelId ?? "msteams",
    serviceUrl: ref.serviceUrl,
    locale: ref.locale
  };
}
function pushTextMessages(out, text, opts) {
  if (!text) {
    return;
  }
  if (opts.chunkText) {
    for (const chunk of getMSTeamsRuntime().channel.text.chunkMarkdownTextWithMode(
      text,
      opts.chunkLimit,
      opts.chunkMode
    )) {
      const trimmed2 = chunk.trim();
      if (!trimmed2 || isSilentReplyText(trimmed2, SILENT_REPLY_TOKEN)) {
        continue;
      }
      out.push({ text: trimmed2 });
    }
    return;
  }
  const trimmed = text.trim();
  if (!trimmed || isSilentReplyText(trimmed, SILENT_REPLY_TOKEN)) {
    return;
  }
  out.push({ text: trimmed });
}
function clampMs(value, maxMs) {
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }
  return Math.min(value, maxMs);
}
function resolveRetryOptions(retry) {
  if (!retry) {
    return { enabled: false, maxAttempts: 1, baseDelayMs: 0, maxDelayMs: 0 };
  }
  return {
    enabled: true,
    maxAttempts: Math.max(1, retry?.maxAttempts ?? 3),
    baseDelayMs: Math.max(0, retry?.baseDelayMs ?? 250),
    maxDelayMs: Math.max(0, retry?.maxDelayMs ?? 1e4)
  };
}
function computeRetryDelayMs(attempt, classification, opts) {
  if (classification.retryAfterMs != null) {
    return clampMs(classification.retryAfterMs, opts.maxDelayMs);
  }
  const exponential = opts.baseDelayMs * 2 ** Math.max(0, attempt - 1);
  return clampMs(exponential, opts.maxDelayMs);
}
function shouldRetry(classification) {
  return classification.kind === "throttled" || classification.kind === "transient";
}
function renderReplyPayloadsToMessages(replies, options) {
  const out = [];
  const chunkLimit = Math.min(options.textChunkLimit, 4e3);
  const chunkText = options.chunkText !== false;
  const chunkMode = options.chunkMode ?? "length";
  const mediaMode = options.mediaMode ?? "split";
  const tableMode = options.tableMode ?? getMSTeamsRuntime().channel.text.resolveMarkdownTableMode({
    cfg: getMSTeamsRuntime().config.loadConfig(),
    channel: "msteams"
  });
  for (const payload of replies) {
    const mediaList = payload.mediaUrls ?? (payload.mediaUrl ? [payload.mediaUrl] : []);
    const text = getMSTeamsRuntime().channel.text.convertMarkdownTables(
      payload.text ?? "",
      tableMode
    );
    if (!text && mediaList.length === 0) {
      continue;
    }
    if (mediaList.length === 0) {
      pushTextMessages(out, text, { chunkText, chunkLimit, chunkMode });
      continue;
    }
    if (mediaMode === "inline") {
      const firstMedia = mediaList[0];
      if (firstMedia) {
        out.push({ text: text || void 0, mediaUrl: firstMedia });
        for (let i = 1; i < mediaList.length; i++) {
          if (mediaList[i]) {
            out.push({ mediaUrl: mediaList[i] });
          }
        }
      } else {
        pushTextMessages(out, text, { chunkText, chunkLimit, chunkMode });
      }
      continue;
    }
    pushTextMessages(out, text, { chunkText, chunkLimit, chunkMode });
    for (const mediaUrl of mediaList) {
      if (!mediaUrl) {
        continue;
      }
      out.push({ mediaUrl });
    }
  }
  return out;
}
async function buildActivity(msg, conversationRef, tokenProvider, sharePointSiteId, mediaMaxBytes) {
  const activity = { type: "message" };
  if (msg.text) {
    const { text: formattedText, entities } = parseMentions(msg.text);
    activity.text = formattedText;
    if (entities.length > 0) {
      activity.entities = entities;
    }
  }
  if (msg.mediaUrl) {
    let contentUrl = msg.mediaUrl;
    let contentType = await getMimeType(msg.mediaUrl);
    let fileName = await extractFilename(msg.mediaUrl);
    if (isLocalPath(msg.mediaUrl)) {
      const maxBytes = mediaMaxBytes ?? MSTEAMS_MAX_MEDIA_BYTES;
      const media = await loadWebMedia(msg.mediaUrl, maxBytes);
      contentType = media.contentType ?? contentType;
      fileName = media.fileName ?? fileName;
      const conversationType = conversationRef.conversation?.conversationType?.toLowerCase();
      const isPersonal = conversationType === "personal";
      const isImage = media.kind === "image";
      if (requiresFileConsent({
        conversationType,
        contentType,
        bufferSize: media.buffer.length,
        thresholdBytes: FILE_CONSENT_THRESHOLD_BYTES
      })) {
        const conversationId = conversationRef.conversation?.id ?? "unknown";
        const { activity: consentActivity } = prepareFileConsentActivity({
          media: { buffer: media.buffer, filename: fileName, contentType },
          conversationId,
          description: msg.text || void 0
        });
        return consentActivity;
      }
      if (!isPersonal && !isImage && tokenProvider && sharePointSiteId) {
        const chatId = conversationRef.conversation?.id;
        const uploaded = await uploadAndShareSharePoint({
          buffer: media.buffer,
          filename: fileName,
          contentType,
          tokenProvider,
          siteId: sharePointSiteId,
          chatId: chatId ?? void 0,
          usePerUserSharing: conversationType === "groupchat"
        });
        const driveItem = await getDriveItemProperties({
          siteId: sharePointSiteId,
          itemId: uploaded.itemId,
          tokenProvider
        });
        const fileCardAttachment = buildTeamsFileInfoCard(driveItem);
        activity.attachments = [fileCardAttachment];
        return activity;
      }
      if (!isPersonal && media.kind !== "image" && tokenProvider) {
        const uploaded = await uploadAndShareOneDrive({
          buffer: media.buffer,
          filename: fileName,
          contentType,
          tokenProvider
        });
        const fileLink = `\u{1F4CE} [${uploaded.name}](${uploaded.shareUrl})`;
        const existingText = typeof activity.text === "string" ? activity.text : void 0;
        activity.text = existingText ? `${existingText}

${fileLink}` : fileLink;
        return activity;
      }
      const base64 = media.buffer.toString("base64");
      contentUrl = `data:${media.contentType};base64,${base64}`;
    }
    activity.attachments = [
      {
        name: fileName,
        contentType,
        contentUrl
      }
    ];
  }
  return activity;
}
async function sendMSTeamsMessages(params) {
  const messages = params.messages.filter(
    (m) => m.text && m.text.trim().length > 0 || m.mediaUrl
  );
  if (messages.length === 0) {
    return [];
  }
  const retryOptions = resolveRetryOptions(params.retry);
  const sendWithRetry = async (sendOnce, meta2) => {
    if (!retryOptions.enabled) {
      return await sendOnce();
    }
    let attempt = 1;
    while (true) {
      try {
        return await sendOnce();
      } catch (err) {
        const classification = classifyMSTeamsSendError(err);
        const canRetry = attempt < retryOptions.maxAttempts && shouldRetry(classification);
        if (!canRetry) {
          throw err;
        }
        const delayMs = computeRetryDelayMs(attempt, classification, retryOptions);
        const nextAttempt = attempt + 1;
        params.onRetry?.({
          messageIndex: meta2.messageIndex,
          messageCount: meta2.messageCount,
          nextAttempt,
          maxAttempts: retryOptions.maxAttempts,
          delayMs,
          classification
        });
        await sleep(delayMs);
        attempt = nextAttempt;
      }
    }
  };
  const sendMessageInContext = async (ctx, message, messageIndex) => {
    const response = await sendWithRetry(
      async () => await ctx.sendActivity(
        await buildActivity(
          message,
          params.conversationRef,
          params.tokenProvider,
          params.sharePointSiteId,
          params.mediaMaxBytes
        )
      ),
      { messageIndex, messageCount: messages.length }
    );
    return extractMessageId(response) ?? "unknown";
  };
  const sendMessageBatchInContext = async (ctx, batch, startIndex) => {
    const messageIds = [];
    for (const [idx, message] of batch.entries()) {
      messageIds.push(await sendMessageInContext(ctx, message, startIndex + idx));
    }
    return messageIds;
  };
  const sendProactively = async (batch, startIndex) => {
    const baseRef = buildConversationReference(params.conversationRef);
    const proactiveRef = {
      ...baseRef,
      activityId: void 0
    };
    const messageIds = [];
    await params.adapter.continueConversation(params.appId, proactiveRef, async (ctx) => {
      messageIds.push(...await sendMessageBatchInContext(ctx, batch, startIndex));
    });
    return messageIds;
  };
  if (params.replyStyle === "thread") {
    const ctx = params.context;
    if (!ctx) {
      throw new Error("Missing context for replyStyle=thread");
    }
    const messageIds = [];
    for (const [idx, message] of messages.entries()) {
      const result = await withRevokedProxyFallback({
        run: async () => ({
          ids: [await sendMessageInContext(ctx, message, idx)],
          fellBack: false
        }),
        onRevoked: async () => {
          const remaining = messages.slice(idx);
          return {
            ids: remaining.length > 0 ? await sendProactively(remaining, idx) : [],
            fellBack: true
          };
        }
      });
      messageIds.push(...result.ids);
      if (result.fellBack) {
        return messageIds;
      }
    }
    return messageIds;
  }
  return await sendProactively(messages, 0);
}
var MSTEAMS_MAX_MEDIA_BYTES, FILE_CONSENT_THRESHOLD_BYTES;
var init_messenger = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/msteams/src/messenger.ts"() {
    "use strict";
    init_errors();
    init_file_consent_helpers();
    init_graph_chat();
    init_graph_upload();
    init_media_helpers();
    init_mentions();
    init_revoked_context();
    init_runtime();
    MSTEAMS_MAX_MEDIA_BYTES = 100 * 1024 * 1024;
    FILE_CONSENT_THRESHOLD_BYTES = 4 * 1024 * 1024;
  }
});

// vendor/openclaw-runtime/win-x64/extensions/msteams/src/send-context.ts
import {
  resolveChannelMediaMaxBytes
} from "openclaw/plugin-sdk";
function parseRecipient(to) {
  const trimmed = to.trim();
  const finalize = (type, id) => {
    const normalized = id.trim();
    if (!normalized) {
      throw new Error(`Invalid target value: missing ${type} id`);
    }
    return { type, id: normalized };
  };
  if (trimmed.startsWith("conversation:")) {
    return finalize("conversation", trimmed.slice("conversation:".length));
  }
  if (trimmed.startsWith("user:")) {
    return finalize("user", trimmed.slice("user:".length));
  }
  if (trimmed.startsWith("19:") || trimmed.includes("@thread")) {
    return finalize("conversation", trimmed);
  }
  return finalize("user", trimmed);
}
async function findConversationReference(recipient) {
  if (recipient.type === "conversation") {
    const ref = await recipient.store.get(recipient.id);
    if (ref) {
      return { conversationId: recipient.id, ref };
    }
    return null;
  }
  const found = await recipient.store.findByUserId(recipient.id);
  if (!found) {
    return null;
  }
  return { conversationId: found.conversationId, ref: found.reference };
}
async function resolveMSTeamsSendContext(params) {
  const msteamsCfg = params.cfg.channels?.msteams;
  if (!msteamsCfg?.enabled) {
    throw new Error("msteams provider is not enabled");
  }
  const creds = resolveMSTeamsCredentials(msteamsCfg);
  if (!creds) {
    throw new Error("msteams credentials not configured");
  }
  const store = createMSTeamsConversationStoreFs();
  const recipient = parseRecipient(params.to);
  const found = await findConversationReference({ ...recipient, store });
  if (!found) {
    throw new Error(
      `No conversation reference found for ${recipient.type}:${recipient.id}. The bot must receive a message from this conversation before it can send proactively.`
    );
  }
  const { conversationId, ref } = found;
  const core = getMSTeamsRuntime();
  const log = core.logging.getChildLogger({ name: "msteams:send" });
  const { sdk, authConfig } = await loadMSTeamsSdkWithAuth(creds);
  const adapter = createMSTeamsAdapter(authConfig, sdk);
  const tokenProvider = new sdk.MsalTokenProvider(authConfig);
  const storedConversationType = ref.conversation?.conversationType?.toLowerCase() ?? "";
  let conversationType;
  if (storedConversationType === "personal") {
    conversationType = "personal";
  } else if (storedConversationType === "channel") {
    conversationType = "channel";
  } else {
    conversationType = "groupChat";
  }
  const sharePointSiteId = msteamsCfg.sharePointSiteId;
  const mediaMaxBytes = resolveChannelMediaMaxBytes({
    cfg: params.cfg,
    resolveChannelLimitMb: ({ cfg }) => cfg.channels?.msteams?.mediaMaxMb
  });
  return {
    appId: creds.appId,
    conversationId,
    ref,
    adapter,
    log,
    conversationType,
    tokenProvider,
    sharePointSiteId,
    mediaMaxBytes
  };
}
var init_send_context = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/msteams/src/send-context.ts"() {
    "use strict";
    init_conversation_store_fs();
    init_runtime();
    init_sdk();
    init_token();
  }
});

// vendor/openclaw-runtime/win-x64/extensions/msteams/src/send.ts
import { loadOutboundMediaFromUrl } from "openclaw/plugin-sdk";
async function sendMessageMSTeams(params) {
  const { cfg, to, text, mediaUrl, mediaLocalRoots } = params;
  const tableMode = getMSTeamsRuntime().channel.text.resolveMarkdownTableMode({
    cfg,
    channel: "msteams"
  });
  const messageText = getMSTeamsRuntime().channel.text.convertMarkdownTables(text ?? "", tableMode);
  const ctx = await resolveMSTeamsSendContext({ cfg, to });
  const {
    adapter,
    appId,
    conversationId,
    ref,
    log,
    conversationType,
    tokenProvider,
    sharePointSiteId
  } = ctx;
  log.debug?.("sending proactive message", {
    conversationId,
    conversationType,
    textLength: messageText.length,
    hasMedia: Boolean(mediaUrl)
  });
  if (mediaUrl) {
    const mediaMaxBytes = ctx.mediaMaxBytes ?? MSTEAMS_MAX_MEDIA_BYTES2;
    const media = await loadOutboundMediaFromUrl(mediaUrl, {
      maxBytes: mediaMaxBytes,
      mediaLocalRoots
    });
    const isLargeFile = media.buffer.length >= FILE_CONSENT_THRESHOLD_BYTES2;
    const isImage = media.contentType?.startsWith("image/") ?? false;
    const fallbackFileName = await extractFilename(mediaUrl);
    const fileName = media.fileName ?? fallbackFileName;
    log.debug?.("processing media", {
      fileName,
      contentType: media.contentType,
      size: media.buffer.length,
      isLargeFile,
      isImage,
      conversationType
    });
    if (requiresFileConsent({
      conversationType,
      contentType: media.contentType,
      bufferSize: media.buffer.length,
      thresholdBytes: FILE_CONSENT_THRESHOLD_BYTES2
    })) {
      const { activity, uploadId } = prepareFileConsentActivity({
        media: { buffer: media.buffer, filename: fileName, contentType: media.contentType },
        conversationId,
        description: messageText || void 0
      });
      log.debug?.("sending file consent card", { uploadId, fileName, size: media.buffer.length });
      const baseRef = buildConversationReference(ref);
      const proactiveRef = { ...baseRef, activityId: void 0 };
      let messageId = "unknown";
      try {
        await adapter.continueConversation(appId, proactiveRef, async (turnCtx) => {
          const response = await turnCtx.sendActivity(activity);
          messageId = extractMessageId(response) ?? "unknown";
        });
      } catch (err) {
        const classification = classifyMSTeamsSendError(err);
        const hint = formatMSTeamsSendErrorHint(classification);
        const status = classification.statusCode ? ` (HTTP ${classification.statusCode})` : "";
        throw new Error(
          `msteams consent card send failed${status}: ${formatUnknownError(err)}${hint ? ` (${hint})` : ""}`,
          { cause: err }
        );
      }
      log.info("sent file consent card", { conversationId, messageId, uploadId });
      return {
        messageId,
        conversationId,
        pendingUploadId: uploadId
      };
    }
    if (conversationType === "personal") {
      const base64 = media.buffer.toString("base64");
      const finalMediaUrl = `data:${media.contentType};base64,${base64}`;
      return sendTextWithMedia(ctx, messageText, finalMediaUrl);
    }
    if (isImage && !sharePointSiteId) {
      const base64 = media.buffer.toString("base64");
      const finalMediaUrl = `data:${media.contentType};base64,${base64}`;
      return sendTextWithMedia(ctx, messageText, finalMediaUrl);
    }
    try {
      if (sharePointSiteId) {
        log.debug?.("uploading to SharePoint for native file card", {
          fileName,
          conversationType,
          siteId: sharePointSiteId
        });
        const uploaded2 = await uploadAndShareSharePoint({
          buffer: media.buffer,
          filename: fileName,
          contentType: media.contentType,
          tokenProvider,
          siteId: sharePointSiteId,
          chatId: conversationId,
          usePerUserSharing: conversationType === "groupChat"
        });
        log.debug?.("SharePoint upload complete", {
          itemId: uploaded2.itemId,
          shareUrl: uploaded2.shareUrl
        });
        const driveItem = await getDriveItemProperties({
          siteId: sharePointSiteId,
          itemId: uploaded2.itemId,
          tokenProvider
        });
        log.debug?.("driveItem properties retrieved", {
          eTag: driveItem.eTag,
          webDavUrl: driveItem.webDavUrl
        });
        const fileCardAttachment = buildTeamsFileInfoCard(driveItem);
        const activity2 = {
          type: "message",
          text: messageText || void 0,
          attachments: [fileCardAttachment]
        };
        const baseRef2 = buildConversationReference(ref);
        const proactiveRef2 = { ...baseRef2, activityId: void 0 };
        let messageId2 = "unknown";
        await adapter.continueConversation(appId, proactiveRef2, async (turnCtx) => {
          const response = await turnCtx.sendActivity(activity2);
          messageId2 = extractMessageId(response) ?? "unknown";
        });
        log.info("sent native file card", {
          conversationId,
          messageId: messageId2,
          fileName: driveItem.name
        });
        return { messageId: messageId2, conversationId };
      }
      log.debug?.("uploading to OneDrive (no SharePoint site configured)", {
        fileName,
        conversationType
      });
      const uploaded = await uploadAndShareOneDrive({
        buffer: media.buffer,
        filename: fileName,
        contentType: media.contentType,
        tokenProvider
      });
      log.debug?.("OneDrive upload complete", {
        itemId: uploaded.itemId,
        shareUrl: uploaded.shareUrl
      });
      const fileLink = `\u{1F4CE} [${uploaded.name}](${uploaded.shareUrl})`;
      const activity = {
        type: "message",
        text: messageText ? `${messageText}

${fileLink}` : fileLink
      };
      const baseRef = buildConversationReference(ref);
      const proactiveRef = { ...baseRef, activityId: void 0 };
      let messageId = "unknown";
      await adapter.continueConversation(appId, proactiveRef, async (turnCtx) => {
        const response = await turnCtx.sendActivity(activity);
        messageId = extractMessageId(response) ?? "unknown";
      });
      log.info("sent message with OneDrive file link", {
        conversationId,
        messageId,
        shareUrl: uploaded.shareUrl
      });
      return { messageId, conversationId };
    } catch (err) {
      const classification = classifyMSTeamsSendError(err);
      const hint = formatMSTeamsSendErrorHint(classification);
      const status = classification.statusCode ? ` (HTTP ${classification.statusCode})` : "";
      throw new Error(
        `msteams file send failed${status}: ${formatUnknownError(err)}${hint ? ` (${hint})` : ""}`,
        { cause: err }
      );
    }
  }
  return sendTextWithMedia(ctx, messageText, void 0);
}
async function sendTextWithMedia(ctx, text, mediaUrl) {
  const {
    adapter,
    appId,
    conversationId,
    ref,
    log,
    tokenProvider,
    sharePointSiteId,
    mediaMaxBytes
  } = ctx;
  let messageIds;
  try {
    messageIds = await sendMSTeamsMessages({
      replyStyle: "top-level",
      adapter,
      appId,
      conversationRef: ref,
      messages: [{ text: text || void 0, mediaUrl }],
      retry: {},
      onRetry: (event) => {
        log.debug?.("retrying send", { conversationId, ...event });
      },
      tokenProvider,
      sharePointSiteId,
      mediaMaxBytes
    });
  } catch (err) {
    const classification = classifyMSTeamsSendError(err);
    const hint = formatMSTeamsSendErrorHint(classification);
    const status = classification.statusCode ? ` (HTTP ${classification.statusCode})` : "";
    throw new Error(
      `msteams send failed${status}: ${formatUnknownError(err)}${hint ? ` (${hint})` : ""}`,
      { cause: err }
    );
  }
  const messageId = messageIds[0] ?? "unknown";
  log.info("sent proactive message", { conversationId, messageId });
  return {
    messageId,
    conversationId
  };
}
async function sendProactiveActivity({
  adapter,
  appId,
  ref,
  activity,
  errorPrefix
}) {
  const baseRef = buildConversationReference(ref);
  const proactiveRef = {
    ...baseRef,
    activityId: void 0
  };
  let messageId = "unknown";
  try {
    await adapter.continueConversation(appId, proactiveRef, async (ctx) => {
      const response = await ctx.sendActivity(activity);
      messageId = extractMessageId(response) ?? "unknown";
    });
    return messageId;
  } catch (err) {
    const classification = classifyMSTeamsSendError(err);
    const hint = formatMSTeamsSendErrorHint(classification);
    const status = classification.statusCode ? ` (HTTP ${classification.statusCode})` : "";
    throw new Error(
      `${errorPrefix} failed${status}: ${formatUnknownError(err)}${hint ? ` (${hint})` : ""}`,
      { cause: err }
    );
  }
}
async function sendPollMSTeams(params) {
  const { cfg, to, question, options, maxSelections } = params;
  const { adapter, appId, conversationId, ref, log } = await resolveMSTeamsSendContext({
    cfg,
    to
  });
  const pollCard = buildMSTeamsPollCard({
    question,
    options,
    maxSelections
  });
  log.debug?.("sending poll", {
    conversationId,
    pollId: pollCard.pollId,
    optionCount: pollCard.options.length
  });
  const activity = {
    type: "message",
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        content: pollCard.card
      }
    ]
  };
  const messageId = await sendProactiveActivity({
    adapter,
    appId,
    ref,
    activity,
    errorPrefix: "msteams poll send"
  });
  log.info("sent poll", { conversationId, pollId: pollCard.pollId, messageId });
  return {
    pollId: pollCard.pollId,
    messageId,
    conversationId
  };
}
async function sendAdaptiveCardMSTeams(params) {
  const { cfg, to, card } = params;
  const { adapter, appId, conversationId, ref, log } = await resolveMSTeamsSendContext({
    cfg,
    to
  });
  log.debug?.("sending adaptive card", {
    conversationId,
    cardType: card.type,
    cardVersion: card.version
  });
  const activity = {
    type: "message",
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        content: card
      }
    ]
  };
  const messageId = await sendProactiveActivity({
    adapter,
    appId,
    ref,
    activity,
    errorPrefix: "msteams card send"
  });
  log.info("sent adaptive card", { conversationId, messageId });
  return {
    messageId,
    conversationId
  };
}
var FILE_CONSENT_THRESHOLD_BYTES2, MSTEAMS_MAX_MEDIA_BYTES2;
var init_send = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/msteams/src/send.ts"() {
    "use strict";
    init_conversation_store_fs();
    init_errors();
    init_file_consent_helpers();
    init_graph_chat();
    init_graph_upload();
    init_media_helpers();
    init_messenger();
    init_polls();
    init_runtime();
    init_send_context();
    FILE_CONSENT_THRESHOLD_BYTES2 = 4 * 1024 * 1024;
    MSTEAMS_MAX_MEDIA_BYTES2 = 100 * 1024 * 1024;
  }
});

// vendor/openclaw-runtime/win-x64/extensions/msteams/src/policy.ts
import {
  buildChannelKeyCandidates,
  normalizeChannelSlug,
  resolveAllowlistMatchSimple,
  resolveToolsBySender,
  resolveChannelEntryMatchWithFallback,
  resolveNestedAllowlistDecision
} from "openclaw/plugin-sdk";
function resolveMSTeamsRouteConfig(params) {
  const teamId = params.teamId?.trim();
  const teamName = params.teamName?.trim();
  const conversationId = params.conversationId?.trim();
  const channelName = params.channelName?.trim();
  const teams = params.cfg?.teams ?? {};
  const allowlistConfigured = Object.keys(teams).length > 0;
  const teamCandidates = buildChannelKeyCandidates(
    teamId,
    teamName,
    teamName ? normalizeChannelSlug(teamName) : void 0
  );
  const teamMatch = resolveChannelEntryMatchWithFallback({
    entries: teams,
    keys: teamCandidates,
    wildcardKey: "*",
    normalizeKey: normalizeChannelSlug
  });
  const teamConfig = teamMatch.entry;
  const channels = teamConfig?.channels ?? {};
  const channelAllowlistConfigured = Object.keys(channels).length > 0;
  const channelCandidates = buildChannelKeyCandidates(
    conversationId,
    channelName,
    channelName ? normalizeChannelSlug(channelName) : void 0
  );
  const channelMatch = resolveChannelEntryMatchWithFallback({
    entries: channels,
    keys: channelCandidates,
    wildcardKey: "*",
    normalizeKey: normalizeChannelSlug
  });
  const channelConfig = channelMatch.entry;
  const allowed = resolveNestedAllowlistDecision({
    outerConfigured: allowlistConfigured,
    outerMatched: Boolean(teamConfig),
    innerConfigured: channelAllowlistConfigured,
    innerMatched: Boolean(channelConfig)
  });
  return {
    teamConfig,
    channelConfig,
    allowlistConfigured,
    allowed,
    teamKey: teamMatch.matchKey ?? teamMatch.key,
    channelKey: channelMatch.matchKey ?? channelMatch.key,
    channelMatchKey: channelMatch.matchKey,
    channelMatchSource: channelMatch.matchSource === "direct" || channelMatch.matchSource === "wildcard" ? channelMatch.matchSource : void 0
  };
}
function resolveMSTeamsGroupToolPolicy(params) {
  const cfg = params.cfg.channels?.msteams;
  if (!cfg) {
    return void 0;
  }
  const groupId = params.groupId?.trim();
  const groupChannel = params.groupChannel?.trim();
  const groupSpace = params.groupSpace?.trim();
  const resolved = resolveMSTeamsRouteConfig({
    cfg,
    teamId: groupSpace,
    teamName: groupSpace,
    conversationId: groupId,
    channelName: groupChannel
  });
  if (resolved.channelConfig) {
    const senderPolicy = resolveToolsBySender({
      toolsBySender: resolved.channelConfig.toolsBySender,
      senderId: params.senderId,
      senderName: params.senderName,
      senderUsername: params.senderUsername,
      senderE164: params.senderE164
    });
    if (senderPolicy) {
      return senderPolicy;
    }
    if (resolved.channelConfig.tools) {
      return resolved.channelConfig.tools;
    }
    const teamSenderPolicy = resolveToolsBySender({
      toolsBySender: resolved.teamConfig?.toolsBySender,
      senderId: params.senderId,
      senderName: params.senderName,
      senderUsername: params.senderUsername,
      senderE164: params.senderE164
    });
    if (teamSenderPolicy) {
      return teamSenderPolicy;
    }
    return resolved.teamConfig?.tools;
  }
  if (resolved.teamConfig) {
    const teamSenderPolicy = resolveToolsBySender({
      toolsBySender: resolved.teamConfig.toolsBySender,
      senderId: params.senderId,
      senderName: params.senderName,
      senderUsername: params.senderUsername,
      senderE164: params.senderE164
    });
    if (teamSenderPolicy) {
      return teamSenderPolicy;
    }
    if (resolved.teamConfig.tools) {
      return resolved.teamConfig.tools;
    }
  }
  if (!groupId) {
    return void 0;
  }
  const channelCandidates = buildChannelKeyCandidates(
    groupId,
    groupChannel,
    groupChannel ? normalizeChannelSlug(groupChannel) : void 0
  );
  for (const teamConfig of Object.values(cfg.teams ?? {})) {
    const match = resolveChannelEntryMatchWithFallback({
      entries: teamConfig?.channels ?? {},
      keys: channelCandidates,
      wildcardKey: "*",
      normalizeKey: normalizeChannelSlug
    });
    if (match.entry) {
      const senderPolicy = resolveToolsBySender({
        toolsBySender: match.entry.toolsBySender,
        senderId: params.senderId,
        senderName: params.senderName,
        senderUsername: params.senderUsername,
        senderE164: params.senderE164
      });
      if (senderPolicy) {
        return senderPolicy;
      }
      if (match.entry.tools) {
        return match.entry.tools;
      }
      const teamSenderPolicy = resolveToolsBySender({
        toolsBySender: teamConfig?.toolsBySender,
        senderId: params.senderId,
        senderName: params.senderName,
        senderUsername: params.senderUsername,
        senderE164: params.senderE164
      });
      if (teamSenderPolicy) {
        return teamSenderPolicy;
      }
      return teamConfig?.tools;
    }
  }
  return void 0;
}
function resolveMSTeamsAllowlistMatch(params) {
  return resolveAllowlistMatchSimple(params);
}
function resolveMSTeamsReplyPolicy(params) {
  if (params.isDirectMessage) {
    return { requireMention: false, replyStyle: "thread" };
  }
  const requireMention = params.channelConfig?.requireMention ?? params.teamConfig?.requireMention ?? params.globalConfig?.requireMention ?? true;
  const explicitReplyStyle = params.channelConfig?.replyStyle ?? params.teamConfig?.replyStyle ?? params.globalConfig?.replyStyle;
  const replyStyle = explicitReplyStyle ?? (requireMention ? "thread" : "top-level");
  return { requireMention, replyStyle };
}
function isMSTeamsGroupAllowed(params) {
  const { groupPolicy } = params;
  if (groupPolicy === "disabled") {
    return false;
  }
  if (groupPolicy === "open") {
    return true;
  }
  return resolveMSTeamsAllowlistMatch(params).allowed;
}
var init_policy = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/msteams/src/policy.ts"() {
    "use strict";
  }
});

// vendor/openclaw-runtime/win-x64/extensions/msteams/src/probe.ts
function decodeJwtPayload(token) {
  const parts = token.split(".");
  if (parts.length < 2) {
    return null;
  }
  const payload = parts[1] ?? "";
  const padded = payload.padEnd(payload.length + (4 - payload.length % 4) % 4, "=");
  const normalized = padded.replace(/-/g, "+").replace(/_/g, "/");
  try {
    const decoded = Buffer.from(normalized, "base64").toString("utf8");
    const parsed = JSON.parse(decoded);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}
function readStringArray(value) {
  if (!Array.isArray(value)) {
    return void 0;
  }
  const out = value.map((entry) => String(entry).trim()).filter(Boolean);
  return out.length > 0 ? out : void 0;
}
function readScopes(value) {
  if (typeof value !== "string") {
    return void 0;
  }
  const out = value.split(/\s+/).map((entry) => entry.trim()).filter(Boolean);
  return out.length > 0 ? out : void 0;
}
async function probeMSTeams(cfg) {
  const creds = resolveMSTeamsCredentials(cfg);
  if (!creds) {
    return {
      ok: false,
      error: "missing credentials (appId, appPassword, tenantId)"
    };
  }
  try {
    const { sdk, authConfig } = await loadMSTeamsSdkWithAuth(creds);
    const tokenProvider = new sdk.MsalTokenProvider(authConfig);
    await tokenProvider.getAccessToken("https://api.botframework.com");
    let graph;
    try {
      const graphToken = await tokenProvider.getAccessToken("https://graph.microsoft.com");
      const accessToken = readAccessToken(graphToken);
      const payload = accessToken ? decodeJwtPayload(accessToken) : null;
      graph = {
        ok: true,
        roles: readStringArray(payload?.roles),
        scopes: readScopes(payload?.scp)
      };
    } catch (err) {
      graph = { ok: false, error: formatUnknownError(err) };
    }
    return { ok: true, appId: creds.appId, ...graph ? { graph } : {} };
  } catch (err) {
    return {
      ok: false,
      appId: creds.appId,
      error: formatUnknownError(err)
    };
  }
}
var init_probe = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/msteams/src/probe.ts"() {
    "use strict";
    init_errors();
    init_sdk();
    init_token_response();
    init_token();
  }
});

// vendor/openclaw-runtime/win-x64/extensions/msteams/src/inbound.ts
function normalizeMSTeamsConversationId(raw) {
  return raw.split(";")[0] ?? raw;
}
function extractMSTeamsConversationMessageId(raw) {
  if (!raw) {
    return void 0;
  }
  const match = /(?:^|;)messageid=([^;]+)/i.exec(raw);
  const value = match?.[1]?.trim() ?? "";
  return value || void 0;
}
function parseMSTeamsActivityTimestamp(value) {
  if (!value) {
    return void 0;
  }
  if (value instanceof Date) {
    return value;
  }
  if (typeof value !== "string") {
    return void 0;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? void 0 : date;
}
function stripMSTeamsMentionTags(text) {
  return text.replace(/<at[^>]*>.*?<\/at>/gi, "").trim();
}
function wasMSTeamsBotMentioned(activity) {
  const botId = activity.recipient?.id;
  if (!botId) {
    return false;
  }
  const entities = activity.entities ?? [];
  return entities.some((e) => e.type === "mention" && e.mentioned?.id === botId);
}
var init_inbound = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/msteams/src/inbound.ts"() {
    "use strict";
  }
});

// vendor/openclaw-runtime/win-x64/extensions/msteams/src/attachments/remote-media.ts
async function downloadAndStoreMSTeamsRemoteMedia(params) {
  const fetched = await getMSTeamsRuntime().channel.media.fetchRemoteMedia({
    url: params.url,
    fetchImpl: params.fetchImpl,
    filePathHint: params.filePathHint,
    maxBytes: params.maxBytes,
    ssrfPolicy: params.ssrfPolicy
  });
  const mime = await getMSTeamsRuntime().media.detectMime({
    buffer: fetched.buffer,
    headerMime: fetched.contentType ?? params.contentTypeHint,
    filePath: params.filePathHint
  });
  const originalFilename = params.preserveFilenames ? params.filePathHint : void 0;
  const saved = await getMSTeamsRuntime().channel.media.saveMediaBuffer(
    fetched.buffer,
    mime ?? params.contentTypeHint,
    "inbound",
    params.maxBytes,
    originalFilename
  );
  return {
    path: saved.path,
    contentType: saved.contentType,
    placeholder: params.placeholder ?? inferPlaceholder({ contentType: saved.contentType, fileName: params.filePathHint })
  };
}
var init_remote_media = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/msteams/src/attachments/remote-media.ts"() {
    "use strict";
    init_runtime();
    init_shared();
  }
});

// vendor/openclaw-runtime/win-x64/extensions/msteams/src/attachments/download.ts
function resolveDownloadCandidate(att) {
  const contentType = normalizeContentType(att.contentType);
  const name = typeof att.name === "string" ? att.name.trim() : "";
  if (contentType === "application/vnd.microsoft.teams.file.download.info") {
    if (!isRecord(att.content)) {
      return null;
    }
    const downloadUrl = typeof att.content.downloadUrl === "string" ? att.content.downloadUrl.trim() : "";
    if (!downloadUrl) {
      return null;
    }
    const fileType = typeof att.content.fileType === "string" ? att.content.fileType.trim() : "";
    const uniqueId = typeof att.content.uniqueId === "string" ? att.content.uniqueId.trim() : "";
    const fileName = typeof att.content.fileName === "string" ? att.content.fileName.trim() : "";
    const fileHint = name || fileName || (uniqueId && fileType ? `${uniqueId}.${fileType}` : "");
    return {
      url: downloadUrl,
      fileHint: fileHint || void 0,
      contentTypeHint: void 0,
      placeholder: inferPlaceholder({
        contentType,
        fileName: fileHint,
        fileType
      })
    };
  }
  const contentUrl = typeof att.contentUrl === "string" ? att.contentUrl.trim() : "";
  if (!contentUrl) {
    return null;
  }
  return {
    url: contentUrl,
    fileHint: name || void 0,
    contentTypeHint: contentType,
    placeholder: inferPlaceholder({ contentType, fileName: name })
  };
}
function scopeCandidatesForUrl(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    const looksLikeGraph = host.endsWith("graph.microsoft.com") || host.endsWith("sharepoint.com") || host.endsWith("1drv.ms") || host.includes("sharepoint");
    return looksLikeGraph ? ["https://graph.microsoft.com", "https://api.botframework.com"] : ["https://api.botframework.com", "https://graph.microsoft.com"];
  } catch {
    return ["https://api.botframework.com", "https://graph.microsoft.com"];
  }
}
function isRedirectStatus(status) {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}
async function fetchWithAuthFallback(params) {
  const firstAttempt = await safeFetchWithPolicy({
    url: params.url,
    policy: params.policy,
    fetchFn: params.fetchFn,
    requestInit: params.requestInit
  });
  if (firstAttempt.ok) {
    return firstAttempt;
  }
  if (!params.tokenProvider) {
    return firstAttempt;
  }
  if (firstAttempt.status !== 401 && firstAttempt.status !== 403) {
    return firstAttempt;
  }
  if (!isUrlAllowed(params.url, params.policy.authAllowHosts)) {
    return firstAttempt;
  }
  const scopes = scopeCandidatesForUrl(params.url);
  const fetchFn = params.fetchFn ?? fetch;
  for (const scope of scopes) {
    try {
      const token = await params.tokenProvider.getAccessToken(scope);
      const authHeaders = new Headers(params.requestInit?.headers);
      authHeaders.set("Authorization", `Bearer ${token}`);
      const authAttempt = await safeFetchWithPolicy({
        url: params.url,
        policy: params.policy,
        fetchFn,
        requestInit: {
          ...params.requestInit,
          headers: authHeaders
        }
      });
      if (authAttempt.ok) {
        return authAttempt;
      }
      if (isRedirectStatus(authAttempt.status)) {
        return authAttempt;
      }
      if (authAttempt.status !== 401 && authAttempt.status !== 403) {
        continue;
      }
    } catch {
    }
  }
  return firstAttempt;
}
async function downloadMSTeamsAttachments(params) {
  const list = Array.isArray(params.attachments) ? params.attachments : [];
  if (list.length === 0) {
    return [];
  }
  const policy = resolveAttachmentFetchPolicy({
    allowHosts: params.allowHosts,
    authAllowHosts: params.authAllowHosts
  });
  const allowHosts = policy.allowHosts;
  const ssrfPolicy = resolveMediaSsrfPolicy(allowHosts);
  const downloadable = list.filter(isDownloadableAttachment);
  const candidates = downloadable.map(resolveDownloadCandidate).filter(Boolean);
  const inlineCandidates = extractInlineImageCandidates(list);
  const seenUrls = /* @__PURE__ */ new Set();
  for (const inline of inlineCandidates) {
    if (inline.kind === "url") {
      if (!isUrlAllowed(inline.url, allowHosts)) {
        continue;
      }
      if (seenUrls.has(inline.url)) {
        continue;
      }
      seenUrls.add(inline.url);
      candidates.push({
        url: inline.url,
        fileHint: inline.fileHint,
        contentTypeHint: inline.contentType,
        placeholder: inline.placeholder
      });
    }
  }
  if (candidates.length === 0 && inlineCandidates.length === 0) {
    return [];
  }
  const out = [];
  for (const inline of inlineCandidates) {
    if (inline.kind !== "data") {
      continue;
    }
    if (inline.data.byteLength > params.maxBytes) {
      continue;
    }
    try {
      const saved = await getMSTeamsRuntime().channel.media.saveMediaBuffer(
        inline.data,
        inline.contentType,
        "inbound",
        params.maxBytes
      );
      out.push({
        path: saved.path,
        contentType: saved.contentType,
        placeholder: inline.placeholder
      });
    } catch {
    }
  }
  for (const candidate of candidates) {
    if (!isUrlAllowed(candidate.url, allowHosts)) {
      continue;
    }
    try {
      const media = await downloadAndStoreMSTeamsRemoteMedia({
        url: candidate.url,
        filePathHint: candidate.fileHint ?? candidate.url,
        maxBytes: params.maxBytes,
        contentTypeHint: candidate.contentTypeHint,
        placeholder: candidate.placeholder,
        preserveFilenames: params.preserveFilenames,
        ssrfPolicy,
        fetchImpl: (input, init) => fetchWithAuthFallback({
          url: resolveRequestUrl(input),
          tokenProvider: params.tokenProvider,
          fetchFn: params.fetchFn,
          requestInit: init,
          policy
        })
      });
      out.push(media);
    } catch {
    }
  }
  return out;
}
var init_download = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/msteams/src/attachments/download.ts"() {
    "use strict";
    init_runtime();
    init_remote_media();
    init_shared();
  }
});

// vendor/openclaw-runtime/win-x64/extensions/msteams/src/attachments/graph.ts
import { fetchWithSsrFGuard } from "openclaw/plugin-sdk";
function readNestedString2(value, keys) {
  let current = value;
  for (const key of keys) {
    if (!isRecord(current)) {
      return void 0;
    }
    current = current[key];
  }
  return typeof current === "string" && current.trim() ? current.trim() : void 0;
}
function buildMSTeamsGraphMessageUrls(params) {
  const conversationType = params.conversationType?.trim().toLowerCase() ?? "";
  const messageIdCandidates = /* @__PURE__ */ new Set();
  const pushCandidate = (value) => {
    const trimmed = typeof value === "string" ? value.trim() : "";
    if (trimmed) {
      messageIdCandidates.add(trimmed);
    }
  };
  pushCandidate(params.messageId);
  pushCandidate(params.conversationMessageId);
  pushCandidate(readNestedString2(params.channelData, ["messageId"]));
  pushCandidate(readNestedString2(params.channelData, ["teamsMessageId"]));
  const replyToId = typeof params.replyToId === "string" ? params.replyToId.trim() : "";
  if (conversationType === "channel") {
    const teamId = readNestedString2(params.channelData, ["team", "id"]) ?? readNestedString2(params.channelData, ["teamId"]);
    const channelId = readNestedString2(params.channelData, ["channel", "id"]) ?? readNestedString2(params.channelData, ["channelId"]) ?? readNestedString2(params.channelData, ["teamsChannelId"]);
    if (!teamId || !channelId) {
      return [];
    }
    const urls2 = [];
    if (replyToId) {
      for (const candidate of messageIdCandidates) {
        if (candidate === replyToId) {
          continue;
        }
        urls2.push(
          `${GRAPH_ROOT}/teams/${encodeURIComponent(teamId)}/channels/${encodeURIComponent(channelId)}/messages/${encodeURIComponent(replyToId)}/replies/${encodeURIComponent(candidate)}`
        );
      }
    }
    if (messageIdCandidates.size === 0 && replyToId) {
      messageIdCandidates.add(replyToId);
    }
    for (const candidate of messageIdCandidates) {
      urls2.push(
        `${GRAPH_ROOT}/teams/${encodeURIComponent(teamId)}/channels/${encodeURIComponent(channelId)}/messages/${encodeURIComponent(candidate)}`
      );
    }
    return Array.from(new Set(urls2));
  }
  const chatId = params.conversationId?.trim() || readNestedString2(params.channelData, ["chatId"]);
  if (!chatId) {
    return [];
  }
  if (messageIdCandidates.size === 0 && replyToId) {
    messageIdCandidates.add(replyToId);
  }
  const urls = Array.from(messageIdCandidates).map(
    (candidate) => `${GRAPH_ROOT}/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(candidate)}`
  );
  return Array.from(new Set(urls));
}
async function fetchGraphCollection(params) {
  const fetchFn = params.fetchFn ?? fetch;
  const { response, release } = await fetchWithSsrFGuard({
    url: params.url,
    fetchImpl: fetchFn,
    init: {
      headers: { Authorization: `Bearer ${params.accessToken}` }
    },
    policy: params.ssrfPolicy,
    auditContext: "msteams.graph.collection"
  });
  try {
    const status = response.status;
    if (!response.ok) {
      return { status, items: [] };
    }
    try {
      const data = await response.json();
      return { status, items: Array.isArray(data.value) ? data.value : [] };
    } catch {
      return { status, items: [] };
    }
  } finally {
    await release();
  }
}
function normalizeGraphAttachment(att) {
  let content = att.content;
  if (typeof content === "string") {
    try {
      content = JSON.parse(content);
    } catch {
    }
  }
  return {
    contentType: normalizeContentType(att.contentType) ?? void 0,
    contentUrl: att.contentUrl ?? void 0,
    name: att.name ?? void 0,
    thumbnailUrl: att.thumbnailUrl ?? void 0,
    content
  };
}
async function downloadGraphHostedContent(params) {
  const hosted = await fetchGraphCollection({
    url: `${params.messageUrl}/hostedContents`,
    accessToken: params.accessToken,
    fetchFn: params.fetchFn,
    ssrfPolicy: params.ssrfPolicy
  });
  if (hosted.items.length === 0) {
    return { media: [], status: hosted.status, count: 0 };
  }
  const out = [];
  for (const item of hosted.items) {
    const contentBytes = typeof item.contentBytes === "string" ? item.contentBytes : "";
    if (!contentBytes) {
      continue;
    }
    let buffer;
    try {
      buffer = Buffer.from(contentBytes, "base64");
    } catch {
      continue;
    }
    if (buffer.byteLength > params.maxBytes) {
      continue;
    }
    const mime = await getMSTeamsRuntime().media.detectMime({
      buffer,
      headerMime: item.contentType ?? void 0
    });
    try {
      const saved = await getMSTeamsRuntime().channel.media.saveMediaBuffer(
        buffer,
        mime ?? item.contentType ?? void 0,
        "inbound",
        params.maxBytes
      );
      out.push({
        path: saved.path,
        contentType: saved.contentType,
        placeholder: inferPlaceholder({ contentType: saved.contentType })
      });
    } catch {
    }
  }
  return { media: out, status: hosted.status, count: hosted.items.length };
}
async function downloadMSTeamsGraphMedia(params) {
  if (!params.messageUrl || !params.tokenProvider) {
    return { media: [] };
  }
  const policy = resolveAttachmentFetchPolicy({
    allowHosts: params.allowHosts,
    authAllowHosts: params.authAllowHosts
  });
  const ssrfPolicy = resolveMediaSsrfPolicy(policy.allowHosts);
  const messageUrl = params.messageUrl;
  let accessToken;
  try {
    accessToken = await params.tokenProvider.getAccessToken("https://graph.microsoft.com");
  } catch {
    return { media: [], messageUrl, tokenError: true };
  }
  const fetchFn = params.fetchFn ?? fetch;
  const sharePointMedia = [];
  const downloadedReferenceUrls = /* @__PURE__ */ new Set();
  try {
    const { response: msgRes, release } = await fetchWithSsrFGuard({
      url: messageUrl,
      fetchImpl: fetchFn,
      init: {
        headers: { Authorization: `Bearer ${accessToken}` }
      },
      policy: ssrfPolicy,
      auditContext: "msteams.graph.message"
    });
    try {
      if (msgRes.ok) {
        const msgData = await msgRes.json();
        const spAttachments = (msgData.attachments ?? []).filter(
          (a) => a.contentType === "reference" && a.contentUrl && a.name
        );
        for (const att of spAttachments) {
          const name = att.name ?? "file";
          try {
            const shareUrl = att.contentUrl;
            if (!isUrlAllowed(shareUrl, policy.allowHosts)) {
              continue;
            }
            const encodedUrl = Buffer.from(shareUrl).toString("base64url");
            const sharesUrl = `${GRAPH_ROOT}/shares/u!${encodedUrl}/driveItem/content`;
            const media = await downloadAndStoreMSTeamsRemoteMedia({
              url: sharesUrl,
              filePathHint: name,
              maxBytes: params.maxBytes,
              contentTypeHint: "application/octet-stream",
              preserveFilenames: params.preserveFilenames,
              ssrfPolicy,
              fetchImpl: async (input, init) => {
                const requestUrl = resolveRequestUrl(input);
                const headers = new Headers(init?.headers);
                applyAuthorizationHeaderForUrl({
                  headers,
                  url: requestUrl,
                  authAllowHosts: policy.authAllowHosts,
                  bearerToken: accessToken
                });
                return await safeFetchWithPolicy({
                  url: requestUrl,
                  policy,
                  fetchFn,
                  requestInit: {
                    ...init,
                    headers
                  }
                });
              }
            });
            sharePointMedia.push(media);
            downloadedReferenceUrls.add(shareUrl);
          } catch {
          }
        }
      }
    } finally {
      await release();
    }
  } catch {
  }
  const hosted = await downloadGraphHostedContent({
    accessToken,
    messageUrl,
    maxBytes: params.maxBytes,
    fetchFn: params.fetchFn,
    preserveFilenames: params.preserveFilenames,
    ssrfPolicy
  });
  const attachments = await fetchGraphCollection({
    url: `${messageUrl}/attachments`,
    accessToken,
    fetchFn: params.fetchFn,
    ssrfPolicy
  });
  const normalizedAttachments = attachments.items.map(normalizeGraphAttachment);
  const filteredAttachments = sharePointMedia.length > 0 ? normalizedAttachments.filter((att) => {
    const contentType = att.contentType?.toLowerCase();
    if (contentType !== "reference") {
      return true;
    }
    const url = typeof att.contentUrl === "string" ? att.contentUrl : "";
    if (!url) {
      return true;
    }
    return !downloadedReferenceUrls.has(url);
  }) : normalizedAttachments;
  const attachmentMedia = await downloadMSTeamsAttachments({
    attachments: filteredAttachments,
    maxBytes: params.maxBytes,
    tokenProvider: params.tokenProvider,
    allowHosts: policy.allowHosts,
    authAllowHosts: policy.authAllowHosts,
    fetchFn: params.fetchFn,
    preserveFilenames: params.preserveFilenames
  });
  return {
    media: [...sharePointMedia, ...hosted.media, ...attachmentMedia],
    hostedCount: hosted.count,
    attachmentCount: filteredAttachments.length + sharePointMedia.length,
    hostedStatus: hosted.status,
    attachmentStatus: attachments.status,
    messageUrl
  };
}
var init_graph2 = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/msteams/src/attachments/graph.ts"() {
    "use strict";
    init_runtime();
    init_download();
    init_remote_media();
    init_shared();
  }
});

// vendor/openclaw-runtime/win-x64/extensions/msteams/src/attachments/html.ts
function summarizeMSTeamsHtmlAttachments(attachments) {
  const list = Array.isArray(attachments) ? attachments : [];
  if (list.length === 0) {
    return void 0;
  }
  let htmlAttachments = 0;
  let imgTags = 0;
  let dataImages = 0;
  let cidImages = 0;
  const srcHosts = /* @__PURE__ */ new Set();
  let attachmentTags = 0;
  const attachmentIds = /* @__PURE__ */ new Set();
  for (const att of list) {
    const html = extractHtmlFromAttachment(att);
    if (!html) {
      continue;
    }
    htmlAttachments += 1;
    IMG_SRC_RE.lastIndex = 0;
    let match = IMG_SRC_RE.exec(html);
    while (match) {
      imgTags += 1;
      const src = match[1]?.trim();
      if (src) {
        if (src.startsWith("data:")) {
          dataImages += 1;
        } else if (src.startsWith("cid:")) {
          cidImages += 1;
        } else {
          srcHosts.add(safeHostForUrl(src));
        }
      }
      match = IMG_SRC_RE.exec(html);
    }
    ATTACHMENT_TAG_RE.lastIndex = 0;
    let attachmentMatch = ATTACHMENT_TAG_RE.exec(html);
    while (attachmentMatch) {
      attachmentTags += 1;
      const id = attachmentMatch[1]?.trim();
      if (id) {
        attachmentIds.add(id);
      }
      attachmentMatch = ATTACHMENT_TAG_RE.exec(html);
    }
  }
  if (htmlAttachments === 0) {
    return void 0;
  }
  return {
    htmlAttachments,
    imgTags,
    dataImages,
    cidImages,
    srcHosts: Array.from(srcHosts).slice(0, 5),
    attachmentTags,
    attachmentIds: Array.from(attachmentIds).slice(0, 5)
  };
}
function buildMSTeamsAttachmentPlaceholder(attachments) {
  const list = Array.isArray(attachments) ? attachments : [];
  if (list.length === 0) {
    return "";
  }
  const imageCount = list.filter(isLikelyImageAttachment).length;
  const inlineCount = extractInlineImageCandidates(list).length;
  const totalImages = imageCount + inlineCount;
  if (totalImages > 0) {
    return `<media:image>${totalImages > 1 ? ` (${totalImages} images)` : ""}`;
  }
  const count = list.length;
  return `<media:document>${count > 1 ? ` (${count} files)` : ""}`;
}
var init_html = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/msteams/src/attachments/html.ts"() {
    "use strict";
    init_shared();
  }
});

// vendor/openclaw-runtime/win-x64/extensions/msteams/src/attachments/payload.ts
import { buildMediaPayload } from "openclaw/plugin-sdk";
function buildMSTeamsMediaPayload(mediaList) {
  return buildMediaPayload(mediaList, { preserveMediaTypeCardinality: true });
}
var init_payload = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/msteams/src/attachments/payload.ts"() {
    "use strict";
  }
});

// vendor/openclaw-runtime/win-x64/extensions/msteams/src/attachments.ts
var init_attachments = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/msteams/src/attachments.ts"() {
    "use strict";
    init_download();
    init_graph2();
    init_html();
    init_payload();
  }
});

// vendor/openclaw-runtime/win-x64/extensions/msteams/src/reply-dispatcher.ts
import {
  createReplyPrefixOptions,
  createTypingCallbacks,
  logTypingFailure,
  resolveChannelMediaMaxBytes as resolveChannelMediaMaxBytes2
} from "openclaw/plugin-sdk";
function createMSTeamsReplyDispatcher(params) {
  const core = getMSTeamsRuntime();
  const sendTypingIndicator = async () => {
    await withRevokedProxyFallback({
      run: async () => {
        await params.context.sendActivity({ type: "typing" });
      },
      onRevoked: async () => {
        const baseRef = buildConversationReference(params.conversationRef);
        await params.adapter.continueConversation(
          params.appId,
          { ...baseRef, activityId: void 0 },
          async (ctx) => {
            await ctx.sendActivity({ type: "typing" });
          }
        );
      },
      onRevokedLog: () => {
        params.log.debug?.("turn context revoked, sending typing via proactive messaging");
      }
    });
  };
  const typingCallbacks = createTypingCallbacks({
    start: sendTypingIndicator,
    onStartError: (err) => {
      logTypingFailure({
        log: (message) => params.log.debug?.(message),
        channel: "msteams",
        action: "start",
        error: err
      });
    }
  });
  const { onModelSelected, ...prefixOptions } = createReplyPrefixOptions({
    cfg: params.cfg,
    agentId: params.agentId,
    channel: "msteams",
    accountId: params.accountId
  });
  const chunkMode = core.channel.text.resolveChunkMode(params.cfg, "msteams");
  const { dispatcher, replyOptions, markDispatchIdle } = core.channel.reply.createReplyDispatcherWithTyping({
    ...prefixOptions,
    humanDelay: core.channel.reply.resolveHumanDelayConfig(params.cfg, params.agentId),
    typingCallbacks,
    deliver: async (payload) => {
      const tableMode = core.channel.text.resolveMarkdownTableMode({
        cfg: params.cfg,
        channel: "msteams"
      });
      const messages = renderReplyPayloadsToMessages([payload], {
        textChunkLimit: params.textLimit,
        chunkText: true,
        mediaMode: "split",
        tableMode,
        chunkMode
      });
      const mediaMaxBytes = resolveChannelMediaMaxBytes2({
        cfg: params.cfg,
        resolveChannelLimitMb: ({ cfg }) => cfg.channels?.msteams?.mediaMaxMb
      });
      const ids = await sendMSTeamsMessages({
        replyStyle: params.replyStyle,
        adapter: params.adapter,
        appId: params.appId,
        conversationRef: params.conversationRef,
        context: params.context,
        messages,
        // Enable default retry/backoff for throttling/transient failures.
        retry: {},
        onRetry: (event) => {
          params.log.debug?.("retrying send", {
            replyStyle: params.replyStyle,
            ...event
          });
        },
        tokenProvider: params.tokenProvider,
        sharePointSiteId: params.sharePointSiteId,
        mediaMaxBytes
      });
      if (ids.length > 0) {
        params.onSentMessageIds?.(ids);
      }
    },
    onError: (err, info) => {
      const errMsg = formatUnknownError(err);
      const classification = classifyMSTeamsSendError(err);
      const hint = formatMSTeamsSendErrorHint(classification);
      params.runtime.error?.(
        `msteams ${info.kind} reply failed: ${errMsg}${hint ? ` (${hint})` : ""}`
      );
      params.log.error("reply failed", {
        kind: info.kind,
        error: errMsg,
        classification,
        hint
      });
    }
  });
  return {
    dispatcher,
    replyOptions: { ...replyOptions, onModelSelected },
    markDispatchIdle
  };
}
var init_reply_dispatcher = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/msteams/src/reply-dispatcher.ts"() {
    "use strict";
    init_errors();
    init_messenger();
    init_revoked_context();
    init_runtime();
  }
});

// vendor/openclaw-runtime/win-x64/extensions/msteams/src/sent-message-cache.ts
function cleanupExpired(entry) {
  const now = Date.now();
  for (const [msgId, timestamp] of entry.timestamps) {
    if (now - timestamp > TTL_MS) {
      entry.timestamps.delete(msgId);
    }
  }
}
function recordMSTeamsSentMessage(conversationId, messageId) {
  if (!conversationId || !messageId) {
    return;
  }
  let entry = sentMessages.get(conversationId);
  if (!entry) {
    entry = { timestamps: /* @__PURE__ */ new Map() };
    sentMessages.set(conversationId, entry);
  }
  entry.timestamps.set(messageId, Date.now());
  if (entry.timestamps.size > 200) {
    cleanupExpired(entry);
  }
}
function wasMSTeamsMessageSent(conversationId, messageId) {
  const entry = sentMessages.get(conversationId);
  if (!entry) {
    return false;
  }
  cleanupExpired(entry);
  return entry.timestamps.has(messageId);
}
var TTL_MS, sentMessages;
var init_sent_message_cache = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/msteams/src/sent-message-cache.ts"() {
    "use strict";
    TTL_MS = 24 * 60 * 60 * 1e3;
    sentMessages = /* @__PURE__ */ new Map();
  }
});

// vendor/openclaw-runtime/win-x64/extensions/msteams/src/monitor-handler/inbound-media.ts
async function resolveMSTeamsInboundMedia(params) {
  const {
    attachments,
    htmlSummary,
    maxBytes,
    tokenProvider,
    allowHosts,
    conversationType,
    conversationId,
    conversationMessageId,
    activity,
    log,
    preserveFilenames
  } = params;
  let mediaList = await downloadMSTeamsAttachments({
    attachments,
    maxBytes,
    tokenProvider,
    allowHosts,
    authAllowHosts: params.authAllowHosts,
    preserveFilenames
  });
  if (mediaList.length === 0) {
    const onlyHtmlAttachments = attachments.length > 0 && attachments.every((att) => String(att.contentType ?? "").startsWith("text/html"));
    if (onlyHtmlAttachments) {
      const messageUrls = buildMSTeamsGraphMessageUrls({
        conversationType,
        conversationId,
        messageId: activity.id ?? void 0,
        replyToId: activity.replyToId ?? void 0,
        conversationMessageId,
        channelData: activity.channelData
      });
      if (messageUrls.length === 0) {
        log.debug?.("graph message url unavailable", {
          conversationType,
          hasChannelData: Boolean(activity.channelData),
          messageId: activity.id ?? void 0,
          replyToId: activity.replyToId ?? void 0
        });
      } else {
        const attempts = [];
        for (const messageUrl of messageUrls) {
          const graphMedia = await downloadMSTeamsGraphMedia({
            messageUrl,
            tokenProvider,
            maxBytes,
            allowHosts,
            authAllowHosts: params.authAllowHosts,
            preserveFilenames
          });
          attempts.push({
            url: messageUrl,
            hostedStatus: graphMedia.hostedStatus,
            attachmentStatus: graphMedia.attachmentStatus,
            hostedCount: graphMedia.hostedCount,
            attachmentCount: graphMedia.attachmentCount,
            tokenError: graphMedia.tokenError
          });
          if (graphMedia.media.length > 0) {
            mediaList = graphMedia.media;
            break;
          }
          if (graphMedia.tokenError) {
            break;
          }
        }
        if (mediaList.length === 0) {
          log.debug?.("graph media fetch empty", { attempts });
        }
      }
    }
  }
  if (mediaList.length > 0) {
    log.debug?.("downloaded attachments", { count: mediaList.length });
  } else if (htmlSummary?.imgTags) {
    log.debug?.("inline images detected but none downloaded", {
      imgTags: htmlSummary.imgTags,
      srcHosts: htmlSummary.srcHosts,
      dataImages: htmlSummary.dataImages,
      cidImages: htmlSummary.cidImages
    });
  }
  return mediaList;
}
var init_inbound_media = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/msteams/src/monitor-handler/inbound-media.ts"() {
    "use strict";
    init_attachments();
  }
});

// vendor/openclaw-runtime/win-x64/extensions/msteams/src/monitor-handler/message-handler.ts
import {
  DEFAULT_ACCOUNT_ID as DEFAULT_ACCOUNT_ID2,
  buildPendingHistoryContextFromMap,
  clearHistoryEntriesIfEnabled,
  DEFAULT_GROUP_HISTORY_LIMIT,
  createScopedPairingAccess,
  logInboundDrop,
  recordPendingHistoryEntryIfEnabled,
  resolveControlCommandGate,
  resolveDefaultGroupPolicy,
  isDangerousNameMatchingEnabled,
  readStoreAllowFromForDmPolicy,
  resolveMentionGating,
  formatAllowlistMatchMeta,
  resolveEffectiveAllowFromLists,
  resolveDmGroupAccessWithLists
} from "openclaw/plugin-sdk";
function createMSTeamsMessageHandler(deps) {
  const {
    cfg,
    runtime: runtime2,
    appId,
    adapter,
    tokenProvider,
    textLimit,
    mediaMaxBytes,
    conversationStore,
    pollStore,
    log
  } = deps;
  const core = getMSTeamsRuntime();
  const pairing = createScopedPairingAccess({
    core,
    channel: "msteams",
    accountId: DEFAULT_ACCOUNT_ID2
  });
  const logVerboseMessage = (message) => {
    if (core.logging.shouldLogVerbose()) {
      log.debug?.(message);
    }
  };
  const msteamsCfg = cfg.channels?.msteams;
  const historyLimit = Math.max(
    0,
    msteamsCfg?.historyLimit ?? cfg.messages?.groupChat?.historyLimit ?? DEFAULT_GROUP_HISTORY_LIMIT
  );
  const conversationHistories = /* @__PURE__ */ new Map();
  const inboundDebounceMs = core.channel.debounce.resolveInboundDebounceMs({
    cfg,
    channel: "msteams"
  });
  const handleTeamsMessageNow = async (params) => {
    const context = params.context;
    const activity = context.activity;
    const rawText = params.rawText;
    const text = params.text;
    const attachments = params.attachments;
    const attachmentPlaceholder = buildMSTeamsAttachmentPlaceholder(attachments);
    const rawBody = text || attachmentPlaceholder;
    const from = activity.from;
    const conversation = activity.conversation;
    const attachmentTypes = attachments.map((att) => typeof att.contentType === "string" ? att.contentType : void 0).filter(Boolean).slice(0, 3);
    const htmlSummary = summarizeMSTeamsHtmlAttachments(attachments);
    log.info("received message", {
      rawText: rawText.slice(0, 50),
      text: text.slice(0, 50),
      attachments: attachments.length,
      attachmentTypes,
      from: from?.id,
      conversation: conversation?.id
    });
    if (htmlSummary) {
      log.debug?.("html attachment summary", htmlSummary);
    }
    if (!from?.id) {
      log.debug?.("skipping message without from.id");
      return;
    }
    const rawConversationId = conversation?.id ?? "";
    const conversationId = normalizeMSTeamsConversationId(rawConversationId);
    const conversationMessageId = extractMSTeamsConversationMessageId(rawConversationId);
    const conversationType = conversation?.conversationType ?? "personal";
    const isGroupChat = conversationType === "groupChat" || conversation?.isGroup === true;
    const isChannel = conversationType === "channel";
    const isDirectMessage = !isGroupChat && !isChannel;
    const senderName = from.name ?? from.id;
    const senderId = from.aadObjectId ?? from.id;
    const dmPolicy2 = msteamsCfg?.dmPolicy ?? "pairing";
    const storedAllowFrom = await readStoreAllowFromForDmPolicy({
      provider: "msteams",
      accountId: pairing.accountId,
      dmPolicy: dmPolicy2,
      readStore: pairing.readStoreForDmPolicy
    });
    const useAccessGroups = cfg.commands?.useAccessGroups !== false;
    const dmAllowFrom = msteamsCfg?.allowFrom ?? [];
    const configuredDmAllowFrom = dmAllowFrom.map((v) => String(v));
    const groupAllowFrom = msteamsCfg?.groupAllowFrom;
    const resolvedAllowFromLists = resolveEffectiveAllowFromLists({
      allowFrom: configuredDmAllowFrom,
      groupAllowFrom,
      storeAllowFrom: storedAllowFrom,
      dmPolicy: dmPolicy2
    });
    const defaultGroupPolicy = resolveDefaultGroupPolicy(cfg);
    const groupPolicy = !isDirectMessage && msteamsCfg ? msteamsCfg.groupPolicy ?? defaultGroupPolicy ?? "allowlist" : "disabled";
    const effectiveGroupAllowFrom = resolvedAllowFromLists.effectiveGroupAllowFrom;
    const teamId = activity.channelData?.team?.id;
    const teamName = activity.channelData?.team?.name;
    const channelName = activity.channelData?.channel?.name;
    const channelGate = resolveMSTeamsRouteConfig({
      cfg: msteamsCfg,
      teamId,
      teamName,
      conversationId,
      channelName
    });
    const senderGroupPolicy = groupPolicy === "disabled" ? "disabled" : effectiveGroupAllowFrom.length > 0 ? "allowlist" : "open";
    const access = resolveDmGroupAccessWithLists({
      isGroup: !isDirectMessage,
      dmPolicy: dmPolicy2,
      groupPolicy: senderGroupPolicy,
      allowFrom: configuredDmAllowFrom,
      groupAllowFrom,
      storeAllowFrom: storedAllowFrom,
      groupAllowFromFallbackToAllowFrom: false,
      isSenderAllowed: (allowFrom) => resolveMSTeamsAllowlistMatch({
        allowFrom,
        senderId,
        senderName,
        allowNameMatching: isDangerousNameMatchingEnabled(msteamsCfg)
      }).allowed
    });
    const effectiveDmAllowFrom = access.effectiveAllowFrom;
    if (isDirectMessage && msteamsCfg && access.decision !== "allow") {
      if (access.reason === "dmPolicy=disabled") {
        log.debug?.("dropping dm (dms disabled)");
        return;
      }
      const allowMatch = resolveMSTeamsAllowlistMatch({
        allowFrom: effectiveDmAllowFrom,
        senderId,
        senderName,
        allowNameMatching: isDangerousNameMatchingEnabled(msteamsCfg)
      });
      if (access.decision === "pairing") {
        const request = await pairing.upsertPairingRequest({
          id: senderId,
          meta: { name: senderName }
        });
        if (request) {
          log.info("msteams pairing request created", {
            sender: senderId,
            label: senderName
          });
        }
      }
      log.debug?.("dropping dm (not allowlisted)", {
        sender: senderId,
        label: senderName,
        allowlistMatch: formatAllowlistMatchMeta(allowMatch)
      });
      return;
    }
    if (!isDirectMessage && msteamsCfg) {
      if (groupPolicy === "disabled") {
        log.debug?.("dropping group message (groupPolicy: disabled)", {
          conversationId
        });
        return;
      }
      if (groupPolicy === "allowlist") {
        if (channelGate.allowlistConfigured && !channelGate.allowed) {
          log.debug?.("dropping group message (not in team/channel allowlist)", {
            conversationId,
            teamKey: channelGate.teamKey ?? "none",
            channelKey: channelGate.channelKey ?? "none",
            channelMatchKey: channelGate.channelMatchKey ?? "none",
            channelMatchSource: channelGate.channelMatchSource ?? "none"
          });
          return;
        }
        if (effectiveGroupAllowFrom.length === 0 && !channelGate.allowlistConfigured) {
          log.debug?.("dropping group message (groupPolicy: allowlist, no allowlist)", {
            conversationId
          });
          return;
        }
        if (effectiveGroupAllowFrom.length > 0 && access.decision !== "allow") {
          const allowMatch = resolveMSTeamsAllowlistMatch({
            allowFrom: effectiveGroupAllowFrom,
            senderId,
            senderName,
            allowNameMatching: isDangerousNameMatchingEnabled(msteamsCfg)
          });
          if (!allowMatch.allowed) {
            log.debug?.("dropping group message (not in groupAllowFrom)", {
              sender: senderId,
              label: senderName,
              allowlistMatch: formatAllowlistMatchMeta(allowMatch)
            });
            return;
          }
        }
      }
    }
    const commandDmAllowFrom = isDirectMessage ? effectiveDmAllowFrom : configuredDmAllowFrom;
    const ownerAllowedForCommands = isMSTeamsGroupAllowed({
      groupPolicy: "allowlist",
      allowFrom: commandDmAllowFrom,
      senderId,
      senderName,
      allowNameMatching: isDangerousNameMatchingEnabled(msteamsCfg)
    });
    const groupAllowedForCommands = isMSTeamsGroupAllowed({
      groupPolicy: "allowlist",
      allowFrom: effectiveGroupAllowFrom,
      senderId,
      senderName,
      allowNameMatching: isDangerousNameMatchingEnabled(msteamsCfg)
    });
    const hasControlCommandInMessage = core.channel.text.hasControlCommand(text, cfg);
    const commandGate = resolveControlCommandGate({
      useAccessGroups,
      authorizers: [
        { configured: commandDmAllowFrom.length > 0, allowed: ownerAllowedForCommands },
        { configured: effectiveGroupAllowFrom.length > 0, allowed: groupAllowedForCommands }
      ],
      allowTextCommands: true,
      hasControlCommand: hasControlCommandInMessage
    });
    const commandAuthorized = commandGate.commandAuthorized;
    if (commandGate.shouldBlock) {
      logInboundDrop({
        log: logVerboseMessage,
        channel: "msteams",
        reason: "control command (unauthorized)",
        target: senderId
      });
      return;
    }
    const agent = activity.recipient;
    const conversationRef = {
      activityId: activity.id,
      user: { id: from.id, name: from.name, aadObjectId: from.aadObjectId },
      agent,
      bot: agent ? { id: agent.id, name: agent.name } : void 0,
      conversation: {
        id: conversationId,
        conversationType,
        tenantId: conversation?.tenantId
      },
      teamId,
      channelId: activity.channelId,
      serviceUrl: activity.serviceUrl,
      locale: activity.locale
    };
    conversationStore.upsert(conversationId, conversationRef).catch((err) => {
      log.debug?.("failed to save conversation reference", {
        error: formatUnknownError(err)
      });
    });
    const pollVote = extractMSTeamsPollVote(activity);
    if (pollVote) {
      try {
        const poll = await pollStore.recordVote({
          pollId: pollVote.pollId,
          voterId: senderId,
          selections: pollVote.selections
        });
        if (!poll) {
          log.debug?.("poll vote ignored (poll not found)", {
            pollId: pollVote.pollId
          });
        } else {
          log.info("recorded poll vote", {
            pollId: pollVote.pollId,
            voter: senderId,
            selections: pollVote.selections
          });
        }
      } catch (err) {
        log.error("failed to record poll vote", {
          pollId: pollVote.pollId,
          error: formatUnknownError(err)
        });
      }
      return;
    }
    if (!rawBody) {
      log.debug?.("skipping empty message after stripping mentions");
      return;
    }
    const teamsFrom = isDirectMessage ? `msteams:${senderId}` : isChannel ? `msteams:channel:${conversationId}` : `msteams:group:${conversationId}`;
    const teamsTo = isDirectMessage ? `user:${senderId}` : `conversation:${conversationId}`;
    const route = core.channel.routing.resolveAgentRoute({
      cfg,
      channel: "msteams",
      peer: {
        kind: isDirectMessage ? "direct" : isChannel ? "channel" : "group",
        id: isDirectMessage ? senderId : conversationId
      }
    });
    const preview = rawBody.replace(/\s+/g, " ").slice(0, 160);
    const inboundLabel = isDirectMessage ? `Teams DM from ${senderName}` : `Teams message in ${conversationType} from ${senderName}`;
    core.system.enqueueSystemEvent(`${inboundLabel}: ${preview}`, {
      sessionKey: route.sessionKey,
      contextKey: `msteams:message:${conversationId}:${activity.id ?? "unknown"}`
    });
    const channelId = conversationId;
    const { teamConfig, channelConfig } = channelGate;
    const { requireMention, replyStyle } = resolveMSTeamsReplyPolicy({
      isDirectMessage,
      globalConfig: msteamsCfg,
      teamConfig,
      channelConfig
    });
    const timestamp = parseMSTeamsActivityTimestamp(activity.timestamp);
    if (!isDirectMessage) {
      const mentionGate = resolveMentionGating({
        requireMention: Boolean(requireMention),
        canDetectMention: true,
        wasMentioned: params.wasMentioned,
        implicitMention: params.implicitMention,
        shouldBypassMention: false
      });
      const mentioned = mentionGate.effectiveWasMentioned;
      if (requireMention && mentionGate.shouldSkip) {
        log.debug?.("skipping message (mention required)", {
          teamId,
          channelId,
          requireMention,
          mentioned
        });
        recordPendingHistoryEntryIfEnabled({
          historyMap: conversationHistories,
          historyKey: conversationId,
          limit: historyLimit,
          entry: {
            sender: senderName,
            body: rawBody,
            timestamp: timestamp?.getTime(),
            messageId: activity.id ?? void 0
          }
        });
        return;
      }
    }
    const mediaList = await resolveMSTeamsInboundMedia({
      attachments,
      htmlSummary: htmlSummary ?? void 0,
      maxBytes: mediaMaxBytes,
      tokenProvider,
      allowHosts: msteamsCfg?.mediaAllowHosts,
      authAllowHosts: msteamsCfg?.mediaAuthAllowHosts,
      conversationType,
      conversationId,
      conversationMessageId: conversationMessageId ?? void 0,
      activity: {
        id: activity.id,
        replyToId: activity.replyToId,
        channelData: activity.channelData
      },
      log,
      preserveFilenames: cfg.media?.preserveFilenames
    });
    const mediaPayload = buildMSTeamsMediaPayload(mediaList);
    const envelopeFrom = isDirectMessage ? senderName : conversationType;
    const storePath = core.channel.session.resolveStorePath(cfg.session?.store, {
      agentId: route.agentId
    });
    const envelopeOptions = core.channel.reply.resolveEnvelopeFormatOptions(cfg);
    const previousTimestamp = core.channel.session.readSessionUpdatedAt({
      storePath,
      sessionKey: route.sessionKey
    });
    const body = core.channel.reply.formatAgentEnvelope({
      channel: "Teams",
      from: envelopeFrom,
      timestamp,
      previousTimestamp,
      envelope: envelopeOptions,
      body: rawBody
    });
    let combinedBody = body;
    const isRoomish = !isDirectMessage;
    const historyKey = isRoomish ? conversationId : void 0;
    if (isRoomish && historyKey) {
      combinedBody = buildPendingHistoryContextFromMap({
        historyMap: conversationHistories,
        historyKey,
        limit: historyLimit,
        currentMessage: combinedBody,
        formatEntry: (entry) => core.channel.reply.formatAgentEnvelope({
          channel: "Teams",
          from: conversationType,
          timestamp: entry.timestamp,
          body: `${entry.sender}: ${entry.body}${entry.messageId ? ` [id:${entry.messageId}]` : ""}`,
          envelope: envelopeOptions
        })
      });
    }
    const inboundHistory = isRoomish && historyKey && historyLimit > 0 ? (conversationHistories.get(historyKey) ?? []).map((entry) => ({
      sender: entry.sender,
      body: entry.body,
      timestamp: entry.timestamp
    })) : void 0;
    const commandBody = text.trim();
    const ctxPayload = core.channel.reply.finalizeInboundContext({
      Body: combinedBody,
      BodyForAgent: rawBody,
      InboundHistory: inboundHistory,
      RawBody: rawBody,
      CommandBody: commandBody,
      BodyForCommands: commandBody,
      From: teamsFrom,
      To: teamsTo,
      SessionKey: route.sessionKey,
      AccountId: route.accountId,
      ChatType: isDirectMessage ? "direct" : isChannel ? "channel" : "group",
      ConversationLabel: envelopeFrom,
      GroupSubject: !isDirectMessage ? conversationType : void 0,
      SenderName: senderName,
      SenderId: senderId,
      Provider: "msteams",
      Surface: "msteams",
      MessageSid: activity.id,
      Timestamp: timestamp?.getTime() ?? Date.now(),
      WasMentioned: isDirectMessage || params.wasMentioned || params.implicitMention,
      CommandAuthorized: commandAuthorized,
      OriginatingChannel: "msteams",
      OriginatingTo: teamsTo,
      ...mediaPayload
    });
    await core.channel.session.recordInboundSession({
      storePath,
      sessionKey: ctxPayload.SessionKey ?? route.sessionKey,
      ctx: ctxPayload,
      onRecordError: (err) => {
        logVerboseMessage(`msteams: failed updating session meta: ${String(err)}`);
      }
    });
    logVerboseMessage(`msteams inbound: from=${ctxPayload.From} preview="${preview}"`);
    const sharePointSiteId = msteamsCfg?.sharePointSiteId;
    const { dispatcher, replyOptions, markDispatchIdle } = createMSTeamsReplyDispatcher({
      cfg,
      agentId: route.agentId,
      accountId: route.accountId,
      runtime: runtime2,
      log,
      adapter,
      appId,
      conversationRef,
      context,
      replyStyle,
      textLimit,
      onSentMessageIds: (ids) => {
        for (const id of ids) {
          recordMSTeamsSentMessage(conversationId, id);
        }
      },
      tokenProvider,
      sharePointSiteId
    });
    log.info("dispatching to agent", { sessionKey: route.sessionKey });
    try {
      const { queuedFinal, counts } = await core.channel.reply.withReplyDispatcher({
        dispatcher,
        onSettled: () => {
          markDispatchIdle();
        },
        run: () => core.channel.reply.dispatchReplyFromConfig({
          ctx: ctxPayload,
          cfg,
          dispatcher,
          replyOptions
        })
      });
      log.info("dispatch complete", { queuedFinal, counts });
      if (!queuedFinal) {
        if (isRoomish && historyKey) {
          clearHistoryEntriesIfEnabled({
            historyMap: conversationHistories,
            historyKey,
            limit: historyLimit
          });
        }
        return;
      }
      const finalCount = counts.final;
      logVerboseMessage(
        `msteams: delivered ${finalCount} reply${finalCount === 1 ? "" : "ies"} to ${teamsTo}`
      );
      if (isRoomish && historyKey) {
        clearHistoryEntriesIfEnabled({
          historyMap: conversationHistories,
          historyKey,
          limit: historyLimit
        });
      }
    } catch (err) {
      log.error("dispatch failed", { error: String(err) });
      runtime2.error?.(`msteams dispatch failed: ${String(err)}`);
      try {
        await context.sendActivity(
          `\u26A0\uFE0F Agent failed: ${err instanceof Error ? err.message : String(err)}`
        );
      } catch {
      }
    }
  };
  const inboundDebouncer = core.channel.debounce.createInboundDebouncer({
    debounceMs: inboundDebounceMs,
    buildKey: (entry) => {
      const conversationId = normalizeMSTeamsConversationId(
        entry.context.activity.conversation?.id ?? ""
      );
      const senderId = entry.context.activity.from?.aadObjectId ?? entry.context.activity.from?.id ?? "";
      if (!senderId || !conversationId) {
        return null;
      }
      return `msteams:${appId}:${conversationId}:${senderId}`;
    },
    shouldDebounce: (entry) => {
      if (!entry.text.trim()) {
        return false;
      }
      if (entry.attachments.length > 0) {
        return false;
      }
      return !core.channel.text.hasControlCommand(entry.text, cfg);
    },
    onFlush: async (entries) => {
      const last = entries.at(-1);
      if (!last) {
        return;
      }
      if (entries.length === 1) {
        await handleTeamsMessageNow(last);
        return;
      }
      const combinedText = entries.map((entry) => entry.text).filter(Boolean).join("\n");
      if (!combinedText.trim()) {
        return;
      }
      const combinedRawText = entries.map((entry) => entry.rawText).filter(Boolean).join("\n");
      const wasMentioned = entries.some((entry) => entry.wasMentioned);
      const implicitMention = entries.some((entry) => entry.implicitMention);
      await handleTeamsMessageNow({
        context: last.context,
        rawText: combinedRawText,
        text: combinedText,
        attachments: [],
        wasMentioned,
        implicitMention
      });
    },
    onError: (err) => {
      runtime2.error?.(`msteams debounce flush failed: ${String(err)}`);
    }
  });
  return async function handleTeamsMessage(context) {
    const activity = context.activity;
    const rawText = activity.text?.trim() ?? "";
    const text = stripMSTeamsMentionTags(rawText);
    const attachments = Array.isArray(activity.attachments) ? activity.attachments : [];
    const wasMentioned = wasMSTeamsBotMentioned(activity);
    const conversationId = normalizeMSTeamsConversationId(activity.conversation?.id ?? "");
    const replyToId = activity.replyToId ?? void 0;
    const implicitMention = Boolean(
      conversationId && replyToId && wasMSTeamsMessageSent(conversationId, replyToId)
    );
    await inboundDebouncer.enqueue({
      context,
      rawText,
      text,
      attachments,
      wasMentioned,
      implicitMention
    });
  };
}
var init_message_handler = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/msteams/src/monitor-handler/message-handler.ts"() {
    "use strict";
    init_attachments();
    init_errors();
    init_inbound();
    init_policy();
    init_polls();
    init_reply_dispatcher();
    init_runtime();
    init_sent_message_cache();
    init_inbound_media();
  }
});

// vendor/openclaw-runtime/win-x64/extensions/msteams/src/monitor-handler.ts
async function handleFileConsentInvoke(context, log) {
  const expiredUploadMessage = "The file upload request has expired. Please try sending the file again.";
  const activity = context.activity;
  if (activity.type !== "invoke" || activity.name !== "fileConsent/invoke") {
    return false;
  }
  const consentResponse = parseFileConsentInvoke(activity);
  if (!consentResponse) {
    log.debug?.("invalid file consent invoke", { value: activity.value });
    return false;
  }
  const uploadId = typeof consentResponse.context?.uploadId === "string" ? consentResponse.context.uploadId : void 0;
  const pendingFile = getPendingUpload(uploadId);
  if (pendingFile) {
    const pendingConversationId = normalizeMSTeamsConversationId(pendingFile.conversationId);
    const invokeConversationId = normalizeMSTeamsConversationId(activity.conversation?.id ?? "");
    if (!invokeConversationId || pendingConversationId !== invokeConversationId) {
      log.info("file consent conversation mismatch", {
        uploadId,
        expectedConversationId: pendingConversationId,
        receivedConversationId: invokeConversationId || void 0
      });
      if (consentResponse.action === "accept") {
        await context.sendActivity(expiredUploadMessage);
      }
      return true;
    }
  }
  if (consentResponse.action === "accept" && consentResponse.uploadInfo) {
    if (pendingFile) {
      log.debug?.("user accepted file consent, uploading", {
        uploadId,
        filename: pendingFile.filename,
        size: pendingFile.buffer.length
      });
      try {
        await uploadToConsentUrl({
          url: consentResponse.uploadInfo.uploadUrl,
          buffer: pendingFile.buffer,
          contentType: pendingFile.contentType
        });
        const fileInfoCard = buildFileInfoCard({
          filename: consentResponse.uploadInfo.name,
          contentUrl: consentResponse.uploadInfo.contentUrl,
          uniqueId: consentResponse.uploadInfo.uniqueId,
          fileType: consentResponse.uploadInfo.fileType
        });
        await context.sendActivity({
          type: "message",
          attachments: [fileInfoCard]
        });
        log.info("file upload complete", {
          uploadId,
          filename: consentResponse.uploadInfo.name,
          uniqueId: consentResponse.uploadInfo.uniqueId
        });
      } catch (err) {
        log.debug?.("file upload failed", { uploadId, error: String(err) });
        await context.sendActivity(`File upload failed: ${String(err)}`);
      } finally {
        removePendingUpload(uploadId);
      }
    } else {
      log.debug?.("pending file not found for consent", { uploadId });
      await context.sendActivity(expiredUploadMessage);
    }
  } else {
    log.debug?.("user declined file consent", { uploadId });
    removePendingUpload(uploadId);
  }
  return true;
}
function registerMSTeamsHandlers(handler, deps) {
  const handleTeamsMessage = createMSTeamsMessageHandler(deps);
  const originalRun = handler.run;
  if (originalRun) {
    handler.run = async (context) => {
      const ctx = context;
      if (ctx.activity?.type === "invoke" && ctx.activity?.name === "fileConsent/invoke") {
        await ctx.sendActivity({ type: "invokeResponse", value: { status: 200 } });
        try {
          await withRevokedProxyFallback({
            run: async () => await handleFileConsentInvoke(ctx, deps.log),
            onRevoked: async () => true,
            onRevokedLog: () => {
              deps.log.debug?.(
                "turn context revoked during file consent invoke; skipping delayed response"
              );
            }
          });
        } catch (err) {
          deps.log.debug?.("file consent handler error", { error: String(err) });
        }
        return;
      }
      return originalRun.call(handler, context);
    };
  }
  handler.onMessage(async (context, next) => {
    try {
      await handleTeamsMessage(context);
    } catch (err) {
      deps.runtime.error?.(`msteams handler failed: ${String(err)}`);
    }
    await next();
  });
  handler.onMembersAdded(async (context, next) => {
    const membersAdded = context.activity?.membersAdded ?? [];
    for (const member of membersAdded) {
      if (member.id !== context.activity?.recipient?.id) {
        deps.log.debug?.("member added", { member: member.id });
      }
    }
    await next();
  });
  return handler;
}
var init_monitor_handler = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/msteams/src/monitor-handler.ts"() {
    "use strict";
    init_file_consent();
    init_inbound();
    init_message_handler();
    init_pending_uploads();
    init_revoked_context();
  }
});

// vendor/openclaw-runtime/win-x64/extensions/msteams/src/monitor.ts
import {
  DEFAULT_WEBHOOK_MAX_BODY_BYTES,
  keepHttpServerTaskAlive,
  mergeAllowlist,
  summarizeMapping
} from "openclaw/plugin-sdk";
function applyMSTeamsWebhookTimeouts(httpServer, opts) {
  const inactivityTimeoutMs = opts?.inactivityTimeoutMs ?? MSTEAMS_WEBHOOK_INACTIVITY_TIMEOUT_MS;
  const requestTimeoutMs = opts?.requestTimeoutMs ?? MSTEAMS_WEBHOOK_REQUEST_TIMEOUT_MS;
  const headersTimeoutMs = Math.min(
    opts?.headersTimeoutMs ?? MSTEAMS_WEBHOOK_HEADERS_TIMEOUT_MS,
    requestTimeoutMs
  );
  httpServer.setTimeout(inactivityTimeoutMs);
  httpServer.requestTimeout = requestTimeoutMs;
  httpServer.headersTimeout = headersTimeoutMs;
}
async function monitorMSTeamsProvider(opts) {
  const core = getMSTeamsRuntime();
  const log = core.logging.getChildLogger({ name: "msteams" });
  let cfg = opts.cfg;
  let msteamsCfg = cfg.channels?.msteams;
  if (!msteamsCfg?.enabled) {
    log.debug?.("msteams provider disabled");
    return { app: null, shutdown: async () => {
    } };
  }
  const creds = resolveMSTeamsCredentials(msteamsCfg);
  if (!creds) {
    log.error("msteams credentials not configured");
    return { app: null, shutdown: async () => {
    } };
  }
  const appId = creds.appId;
  const runtime2 = opts.runtime ?? {
    log: console.log,
    error: console.error,
    exit: (code) => {
      throw new Error(`exit ${code}`);
    }
  };
  let allowFrom = msteamsCfg.allowFrom;
  let groupAllowFrom = msteamsCfg.groupAllowFrom;
  let teamsConfig = msteamsCfg.teams;
  const cleanAllowEntry = (entry) => entry.replace(/^(msteams|teams):/i, "").replace(/^user:/i, "").trim();
  const resolveAllowlistUsers = async (label, entries) => {
    if (entries.length === 0) {
      return { additions: [], unresolved: [] };
    }
    const resolved = await resolveMSTeamsUserAllowlist({ cfg, entries });
    const additions = [];
    const unresolved = [];
    for (const entry of resolved) {
      if (entry.resolved && entry.id) {
        additions.push(entry.id);
      } else {
        unresolved.push(entry.input);
      }
    }
    const mapping = resolved.filter((entry) => entry.resolved && entry.id).map((entry) => `${entry.input}\u2192${entry.id}`);
    summarizeMapping(label, mapping, unresolved, runtime2);
    return { additions, unresolved };
  };
  try {
    const allowEntries = allowFrom?.map((entry) => cleanAllowEntry(String(entry))).filter((entry) => entry && entry !== "*") ?? [];
    if (allowEntries.length > 0) {
      const { additions } = await resolveAllowlistUsers("msteams users", allowEntries);
      allowFrom = mergeAllowlist({ existing: allowFrom, additions });
    }
    if (Array.isArray(groupAllowFrom) && groupAllowFrom.length > 0) {
      const groupEntries = groupAllowFrom.map((entry) => cleanAllowEntry(String(entry))).filter((entry) => entry && entry !== "*");
      if (groupEntries.length > 0) {
        const { additions } = await resolveAllowlistUsers("msteams group users", groupEntries);
        groupAllowFrom = mergeAllowlist({ existing: groupAllowFrom, additions });
      }
    }
    if (teamsConfig && Object.keys(teamsConfig).length > 0) {
      const entries = [];
      for (const [teamKey, teamCfg] of Object.entries(teamsConfig)) {
        if (teamKey === "*") {
          continue;
        }
        const channels = teamCfg?.channels ?? {};
        const channelKeys = Object.keys(channels).filter((key) => key !== "*");
        if (channelKeys.length === 0) {
          entries.push({ input: teamKey, teamKey });
          continue;
        }
        for (const channelKey of channelKeys) {
          entries.push({
            input: `${teamKey}/${channelKey}`,
            teamKey,
            channelKey
          });
        }
      }
      if (entries.length > 0) {
        const resolved = await resolveMSTeamsChannelAllowlist({
          cfg,
          entries: entries.map((entry) => entry.input)
        });
        const mapping = [];
        const unresolved = [];
        const nextTeams = { ...teamsConfig };
        resolved.forEach((entry, idx) => {
          const source = entries[idx];
          if (!source) {
            return;
          }
          const sourceTeam = teamsConfig?.[source.teamKey] ?? {};
          if (!entry.resolved || !entry.teamId) {
            unresolved.push(entry.input);
            return;
          }
          mapping.push(
            entry.channelId ? `${entry.input}\u2192${entry.teamId}/${entry.channelId}` : `${entry.input}\u2192${entry.teamId}`
          );
          const existing = nextTeams[entry.teamId] ?? {};
          const mergedChannels = {
            ...sourceTeam.channels,
            ...existing.channels
          };
          const mergedTeam = { ...sourceTeam, ...existing, channels: mergedChannels };
          nextTeams[entry.teamId] = mergedTeam;
          if (source.channelKey && entry.channelId) {
            const sourceChannel = sourceTeam.channels?.[source.channelKey];
            if (sourceChannel) {
              nextTeams[entry.teamId] = {
                ...mergedTeam,
                channels: {
                  ...mergedChannels,
                  [entry.channelId]: {
                    ...sourceChannel,
                    ...mergedChannels?.[entry.channelId]
                  }
                }
              };
            }
          }
        });
        teamsConfig = nextTeams;
        summarizeMapping("msteams channels", mapping, unresolved, runtime2);
      }
    }
  } catch (err) {
    runtime2.log?.(`msteams resolve failed; using config entries. ${String(err)}`);
  }
  msteamsCfg = {
    ...msteamsCfg,
    allowFrom,
    groupAllowFrom,
    teams: teamsConfig
  };
  cfg = {
    ...cfg,
    channels: {
      ...cfg.channels,
      msteams: msteamsCfg
    }
  };
  const port = msteamsCfg.webhook?.port ?? 3978;
  const textLimit = core.channel.text.resolveTextChunkLimit(cfg, "msteams");
  const MB = 1024 * 1024;
  const agentDefaults = cfg.agents?.defaults;
  const mediaMaxBytes = typeof agentDefaults?.mediaMaxMb === "number" && agentDefaults.mediaMaxMb > 0 ? Math.floor(agentDefaults.mediaMaxMb * MB) : 8 * MB;
  const conversationStore = opts.conversationStore ?? createMSTeamsConversationStoreFs();
  const pollStore = opts.pollStore ?? createMSTeamsPollStoreFs();
  log.info(`starting provider (port ${port})`);
  const express = await import("express");
  const { sdk, authConfig } = await loadMSTeamsSdkWithAuth(creds);
  const { ActivityHandler, MsalTokenProvider, authorizeJWT } = sdk;
  const tokenProvider = new MsalTokenProvider(authConfig);
  const adapter = createMSTeamsAdapter(authConfig, sdk);
  const handler = registerMSTeamsHandlers(new ActivityHandler(), {
    cfg,
    runtime: runtime2,
    appId,
    adapter,
    tokenProvider,
    textLimit,
    mediaMaxBytes,
    conversationStore,
    pollStore,
    log
  });
  const expressApp = express.default();
  expressApp.use(express.json({ limit: MSTEAMS_WEBHOOK_MAX_BODY_BYTES }));
  expressApp.use((err, _req, res, next) => {
    if (err && typeof err === "object" && "status" in err && err.status === 413) {
      res.status(413).json({ error: "Payload too large" });
      return;
    }
    next(err);
  });
  expressApp.use(authorizeJWT(authConfig));
  const configuredPath = msteamsCfg.webhook?.path ?? "/api/messages";
  const messageHandler = (req, res) => {
    void adapter.process(req, res, (context) => handler.run(context)).catch((err) => {
      log.error("msteams webhook failed", { error: formatUnknownError(err) });
    });
  };
  expressApp.post(configuredPath, messageHandler);
  if (configuredPath !== "/api/messages") {
    expressApp.post("/api/messages", messageHandler);
  }
  log.debug?.("listening on paths", {
    primary: configuredPath,
    fallback: "/api/messages"
  });
  const httpServer = expressApp.listen(port);
  await new Promise((resolve, reject) => {
    const onListening = () => {
      httpServer.off("error", onError);
      log.info(`msteams provider started on port ${port}`);
      resolve();
    };
    const onError = (err) => {
      httpServer.off("listening", onListening);
      log.error("msteams server error", { error: String(err) });
      reject(err);
    };
    httpServer.once("listening", onListening);
    httpServer.once("error", onError);
  });
  applyMSTeamsWebhookTimeouts(httpServer);
  httpServer.on("error", (err) => {
    log.error("msteams server error", { error: String(err) });
  });
  const shutdown = async () => {
    log.info("shutting down msteams provider");
    return new Promise((resolve) => {
      httpServer.close((err) => {
        if (err) {
          log.debug?.("msteams server close error", { error: String(err) });
        }
        resolve();
      });
    });
  };
  await keepHttpServerTaskAlive({
    server: httpServer,
    abortSignal: opts.abortSignal,
    onAbort: shutdown
  });
  return { app: expressApp, shutdown };
}
var MSTEAMS_WEBHOOK_MAX_BODY_BYTES, MSTEAMS_WEBHOOK_INACTIVITY_TIMEOUT_MS, MSTEAMS_WEBHOOK_REQUEST_TIMEOUT_MS, MSTEAMS_WEBHOOK_HEADERS_TIMEOUT_MS;
var init_monitor = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/msteams/src/monitor.ts"() {
    "use strict";
    init_conversation_store_fs();
    init_errors();
    init_monitor_handler();
    init_polls();
    init_resolve_allowlist();
    init_runtime();
    init_sdk();
    init_token();
    MSTEAMS_WEBHOOK_MAX_BODY_BYTES = DEFAULT_WEBHOOK_MAX_BODY_BYTES;
    MSTEAMS_WEBHOOK_INACTIVITY_TIMEOUT_MS = 3e4;
    MSTEAMS_WEBHOOK_REQUEST_TIMEOUT_MS = 3e4;
    MSTEAMS_WEBHOOK_HEADERS_TIMEOUT_MS = 15e3;
  }
});

// vendor/openclaw-runtime/win-x64/extensions/msteams/src/index.ts
var src_exports = {};
__export(src_exports, {
  monitorMSTeamsProvider: () => monitorMSTeamsProvider,
  probeMSTeams: () => probeMSTeams,
  resolveMSTeamsCredentials: () => resolveMSTeamsCredentials,
  sendMessageMSTeams: () => sendMessageMSTeams,
  sendPollMSTeams: () => sendPollMSTeams
});
var init_src = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/msteams/src/index.ts"() {
    "use strict";
    init_monitor();
    init_probe();
    init_send();
    init_token();
  }
});

// vendor/openclaw-runtime/win-x64/extensions/msteams/index.ts
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";

// vendor/openclaw-runtime/win-x64/extensions/msteams/src/channel.ts
import {
  buildBaseChannelStatusSummary,
  buildChannelConfigSchema,
  createDefaultChannelRuntimeState,
  DEFAULT_ACCOUNT_ID as DEFAULT_ACCOUNT_ID3,
  MSTeamsConfigSchema,
  PAIRING_APPROVED_MESSAGE,
  resolveAllowlistProviderRuntimeGroupPolicy,
  resolveDefaultGroupPolicy as resolveDefaultGroupPolicy2
} from "openclaw/plugin-sdk";

// vendor/openclaw-runtime/win-x64/extensions/msteams/src/directory-live.ts
init_graph_users();
init_graph();
async function listMSTeamsDirectoryPeersLive(params) {
  const query = normalizeQuery(params.query);
  if (!query) {
    return [];
  }
  const token = await resolveGraphToken(params.cfg);
  const limit = typeof params.limit === "number" && params.limit > 0 ? params.limit : 20;
  const users = await searchGraphUsers({ token, query, top: limit });
  return users.map((user) => {
    const id = user.id?.trim();
    if (!id) {
      return null;
    }
    const name = user.displayName?.trim();
    const handle = user.userPrincipalName?.trim() || user.mail?.trim();
    return {
      kind: "user",
      id: `user:${id}`,
      name: name || void 0,
      handle: handle ? `@${handle}` : void 0,
      raw: user
    };
  }).filter(Boolean);
}
async function listMSTeamsDirectoryGroupsLive(params) {
  const rawQuery = normalizeQuery(params.query);
  if (!rawQuery) {
    return [];
  }
  const token = await resolveGraphToken(params.cfg);
  const limit = typeof params.limit === "number" && params.limit > 0 ? params.limit : 20;
  const [teamQuery, channelQuery] = rawQuery.includes("/") ? rawQuery.split("/", 2).map((part) => part.trim()).filter(Boolean) : [rawQuery, null];
  const teams = await listTeamsByName(token, teamQuery);
  const results = [];
  for (const team of teams) {
    const teamId = team.id?.trim();
    if (!teamId) {
      continue;
    }
    const teamName = team.displayName?.trim() || teamQuery;
    if (!channelQuery) {
      results.push({
        kind: "group",
        id: `team:${teamId}`,
        name: teamName,
        handle: teamName ? `#${teamName}` : void 0,
        raw: team
      });
      if (results.length >= limit) {
        return results;
      }
      continue;
    }
    const channels = await listChannelsForTeam(token, teamId);
    for (const channel2 of channels) {
      const name = channel2.displayName?.trim();
      if (!name) {
        continue;
      }
      if (!name.toLowerCase().includes(channelQuery.toLowerCase())) {
        continue;
      }
      results.push({
        kind: "group",
        id: `conversation:${channel2.id}`,
        name: `${teamName}/${name}`,
        handle: `#${name}`,
        raw: channel2
      });
      if (results.length >= limit) {
        return results;
      }
    }
  }
  return results;
}

// vendor/openclaw-runtime/win-x64/extensions/msteams/src/onboarding.ts
init_resolve_allowlist();
init_secret_input();
init_token();
import {
  addWildcardAllowFrom,
  DEFAULT_ACCOUNT_ID,
  formatDocsLink,
  mergeAllowFromEntries,
  promptChannelAccessConfig
} from "openclaw/plugin-sdk";
var channel = "msteams";
function setMSTeamsDmPolicy(cfg, dmPolicy2) {
  const allowFrom = dmPolicy2 === "open" ? addWildcardAllowFrom(cfg.channels?.msteams?.allowFrom)?.map((entry) => String(entry)) : void 0;
  return {
    ...cfg,
    channels: {
      ...cfg.channels,
      msteams: {
        ...cfg.channels?.msteams,
        dmPolicy: dmPolicy2,
        ...allowFrom ? { allowFrom } : {}
      }
    }
  };
}
function setMSTeamsAllowFrom(cfg, allowFrom) {
  return {
    ...cfg,
    channels: {
      ...cfg.channels,
      msteams: {
        ...cfg.channels?.msteams,
        allowFrom
      }
    }
  };
}
function parseAllowFromInput(raw) {
  return raw.split(/[\n,;]+/g).map((entry) => entry.trim()).filter(Boolean);
}
function looksLikeGuid(value) {
  return /^[0-9a-fA-F-]{16,}$/.test(value);
}
async function promptMSTeamsCredentials(prompter) {
  const appId = String(
    await prompter.text({
      message: "Enter MS Teams App ID",
      validate: (value) => value?.trim() ? void 0 : "Required"
    })
  ).trim();
  const appPassword = String(
    await prompter.text({
      message: "Enter MS Teams App Password",
      validate: (value) => value?.trim() ? void 0 : "Required"
    })
  ).trim();
  const tenantId = String(
    await prompter.text({
      message: "Enter MS Teams Tenant ID",
      validate: (value) => value?.trim() ? void 0 : "Required"
    })
  ).trim();
  return { appId, appPassword, tenantId };
}
async function promptMSTeamsAllowFrom(params) {
  const existing = params.cfg.channels?.msteams?.allowFrom ?? [];
  await params.prompter.note(
    [
      "Allowlist MS Teams DMs by display name, UPN/email, or user id.",
      "We resolve names to user IDs via Microsoft Graph when credentials allow.",
      "Examples:",
      "- alex@example.com",
      "- Alex Johnson",
      "- 00000000-0000-0000-0000-000000000000"
    ].join("\n"),
    "MS Teams allowlist"
  );
  while (true) {
    const entry = await params.prompter.text({
      message: "MS Teams allowFrom (usernames or ids)",
      placeholder: "alex@example.com, Alex Johnson",
      initialValue: existing[0] ? String(existing[0]) : void 0,
      validate: (value) => String(value ?? "").trim() ? void 0 : "Required"
    });
    const parts = parseAllowFromInput(String(entry));
    if (parts.length === 0) {
      await params.prompter.note("Enter at least one user.", "MS Teams allowlist");
      continue;
    }
    const resolved = await resolveMSTeamsUserAllowlist({
      cfg: params.cfg,
      entries: parts
    }).catch(() => null);
    if (!resolved) {
      const ids2 = parts.filter((part) => looksLikeGuid(part));
      if (ids2.length !== parts.length) {
        await params.prompter.note(
          "Graph lookup unavailable. Use user IDs only.",
          "MS Teams allowlist"
        );
        continue;
      }
      const unique2 = mergeAllowFromEntries(existing, ids2);
      return setMSTeamsAllowFrom(params.cfg, unique2);
    }
    const unresolved = resolved.filter((item) => !item.resolved || !item.id);
    if (unresolved.length > 0) {
      await params.prompter.note(
        `Could not resolve: ${unresolved.map((item) => item.input).join(", ")}`,
        "MS Teams allowlist"
      );
      continue;
    }
    const ids = resolved.map((item) => item.id);
    const unique = mergeAllowFromEntries(existing, ids);
    return setMSTeamsAllowFrom(params.cfg, unique);
  }
}
async function noteMSTeamsCredentialHelp(prompter) {
  await prompter.note(
    [
      "1) Azure Bot registration \u2192 get App ID + Tenant ID",
      "2) Add a client secret (App Password)",
      "3) Set webhook URL + messaging endpoint",
      "Tip: you can also set MSTEAMS_APP_ID / MSTEAMS_APP_PASSWORD / MSTEAMS_TENANT_ID.",
      `Docs: ${formatDocsLink("/channels/msteams", "msteams")}`
    ].join("\n"),
    "MS Teams credentials"
  );
}
function setMSTeamsGroupPolicy(cfg, groupPolicy) {
  return {
    ...cfg,
    channels: {
      ...cfg.channels,
      msteams: {
        ...cfg.channels?.msteams,
        enabled: true,
        groupPolicy
      }
    }
  };
}
function setMSTeamsTeamsAllowlist(cfg, entries) {
  const baseTeams = cfg.channels?.msteams?.teams ?? {};
  const teams = { ...baseTeams };
  for (const entry of entries) {
    const teamKey = entry.teamKey;
    if (!teamKey) {
      continue;
    }
    const existing = teams[teamKey] ?? {};
    if (entry.channelKey) {
      const channels = { ...existing.channels };
      channels[entry.channelKey] = channels[entry.channelKey] ?? {};
      teams[teamKey] = { ...existing, channels };
    } else {
      teams[teamKey] = existing;
    }
  }
  return {
    ...cfg,
    channels: {
      ...cfg.channels,
      msteams: {
        ...cfg.channels?.msteams,
        enabled: true,
        teams
      }
    }
  };
}
var dmPolicy = {
  label: "MS Teams",
  channel,
  policyKey: "channels.msteams.dmPolicy",
  allowFromKey: "channels.msteams.allowFrom",
  getCurrent: (cfg) => cfg.channels?.msteams?.dmPolicy ?? "pairing",
  setPolicy: (cfg, policy) => setMSTeamsDmPolicy(cfg, policy),
  promptAllowFrom: promptMSTeamsAllowFrom
};
var msteamsOnboardingAdapter = {
  channel,
  getStatus: async ({ cfg }) => {
    const configured = Boolean(resolveMSTeamsCredentials(cfg.channels?.msteams)) || hasConfiguredMSTeamsCredentials(cfg.channels?.msteams);
    return {
      channel,
      configured,
      statusLines: [`MS Teams: ${configured ? "configured" : "needs app credentials"}`],
      selectionHint: configured ? "configured" : "needs app creds",
      quickstartScore: configured ? 2 : 0
    };
  },
  configure: async ({ cfg, prompter }) => {
    const resolved = resolveMSTeamsCredentials(cfg.channels?.msteams);
    const hasConfigCreds = hasConfiguredMSTeamsCredentials(cfg.channels?.msteams);
    const canUseEnv = Boolean(
      !hasConfigCreds && normalizeSecretInputString(process.env.MSTEAMS_APP_ID) && normalizeSecretInputString(process.env.MSTEAMS_APP_PASSWORD) && normalizeSecretInputString(process.env.MSTEAMS_TENANT_ID)
    );
    let next = cfg;
    let appId = null;
    let appPassword = null;
    let tenantId = null;
    if (!resolved && !hasConfigCreds) {
      await noteMSTeamsCredentialHelp(prompter);
    }
    if (canUseEnv) {
      const keepEnv = await prompter.confirm({
        message: "MSTEAMS_APP_ID + MSTEAMS_APP_PASSWORD + MSTEAMS_TENANT_ID detected. Use env vars?",
        initialValue: true
      });
      if (keepEnv) {
        next = {
          ...next,
          channels: {
            ...next.channels,
            msteams: { ...next.channels?.msteams, enabled: true }
          }
        };
      } else {
        ({ appId, appPassword, tenantId } = await promptMSTeamsCredentials(prompter));
      }
    } else if (hasConfigCreds) {
      const keep = await prompter.confirm({
        message: "MS Teams credentials already configured. Keep them?",
        initialValue: true
      });
      if (!keep) {
        ({ appId, appPassword, tenantId } = await promptMSTeamsCredentials(prompter));
      }
    } else {
      ({ appId, appPassword, tenantId } = await promptMSTeamsCredentials(prompter));
    }
    if (appId && appPassword && tenantId) {
      next = {
        ...next,
        channels: {
          ...next.channels,
          msteams: {
            ...next.channels?.msteams,
            enabled: true,
            appId,
            appPassword,
            tenantId
          }
        }
      };
    }
    const currentEntries = Object.entries(next.channels?.msteams?.teams ?? {}).flatMap(
      ([teamKey, value]) => {
        const channels = value?.channels ?? {};
        const channelKeys = Object.keys(channels);
        if (channelKeys.length === 0) {
          return [teamKey];
        }
        return channelKeys.map((channelKey) => `${teamKey}/${channelKey}`);
      }
    );
    const accessConfig = await promptChannelAccessConfig({
      prompter,
      label: "MS Teams channels",
      currentPolicy: next.channels?.msteams?.groupPolicy ?? "allowlist",
      currentEntries,
      placeholder: "Team Name/Channel Name, teamId/conversationId",
      updatePrompt: Boolean(next.channels?.msteams?.teams)
    });
    if (accessConfig) {
      if (accessConfig.policy !== "allowlist") {
        next = setMSTeamsGroupPolicy(next, accessConfig.policy);
      } else {
        let entries = accessConfig.entries.map((entry) => parseMSTeamsTeamEntry(entry)).filter(Boolean);
        if (accessConfig.entries.length > 0 && resolveMSTeamsCredentials(next.channels?.msteams)) {
          try {
            const resolved2 = await resolveMSTeamsChannelAllowlist({
              cfg: next,
              entries: accessConfig.entries
            });
            const resolvedChannels = resolved2.filter(
              (entry) => entry.resolved && entry.teamId && entry.channelId
            );
            const resolvedTeams = resolved2.filter(
              (entry) => entry.resolved && entry.teamId && !entry.channelId
            );
            const unresolved = resolved2.filter((entry) => !entry.resolved).map((entry) => entry.input);
            entries = [
              ...resolvedChannels.map((entry) => ({
                teamKey: entry.teamId,
                channelKey: entry.channelId
              })),
              ...resolvedTeams.map((entry) => ({
                teamKey: entry.teamId
              })),
              ...unresolved.map((entry) => parseMSTeamsTeamEntry(entry)).filter(Boolean)
            ];
            if (resolvedChannels.length > 0 || resolvedTeams.length > 0 || unresolved.length > 0) {
              const summary = [];
              if (resolvedChannels.length > 0) {
                summary.push(
                  `Resolved channels: ${resolvedChannels.map((entry) => entry.channelId).filter(Boolean).join(", ")}`
                );
              }
              if (resolvedTeams.length > 0) {
                summary.push(
                  `Resolved teams: ${resolvedTeams.map((entry) => entry.teamId).filter(Boolean).join(", ")}`
                );
              }
              if (unresolved.length > 0) {
                summary.push(`Unresolved (kept as typed): ${unresolved.join(", ")}`);
              }
              await prompter.note(summary.join("\n"), "MS Teams channels");
            }
          } catch (err) {
            await prompter.note(
              `Channel lookup failed; keeping entries as typed. ${String(err)}`,
              "MS Teams channels"
            );
          }
        }
        next = setMSTeamsGroupPolicy(next, "allowlist");
        next = setMSTeamsTeamsAllowlist(next, entries);
      }
    }
    return { cfg: next, accountId: DEFAULT_ACCOUNT_ID };
  },
  dmPolicy,
  disable: (cfg) => ({
    ...cfg,
    channels: {
      ...cfg.channels,
      msteams: { ...cfg.channels?.msteams, enabled: false }
    }
  })
};

// vendor/openclaw-runtime/win-x64/extensions/msteams/src/outbound.ts
init_polls();
init_runtime();
init_send();
var msteamsOutbound = {
  deliveryMode: "direct",
  chunker: (text, limit) => getMSTeamsRuntime().channel.text.chunkMarkdownText(text, limit),
  chunkerMode: "markdown",
  textChunkLimit: 4e3,
  pollMaxOptions: 12,
  sendText: async ({ cfg, to, text, deps }) => {
    const send = deps?.sendMSTeams ?? ((to2, text2) => sendMessageMSTeams({ cfg, to: to2, text: text2 }));
    const result = await send(to, text);
    return { channel: "msteams", ...result };
  },
  sendMedia: async ({ cfg, to, text, mediaUrl, mediaLocalRoots, deps }) => {
    const send = deps?.sendMSTeams ?? ((to2, text2, opts) => sendMessageMSTeams({
      cfg,
      to: to2,
      text: text2,
      mediaUrl: opts?.mediaUrl,
      mediaLocalRoots: opts?.mediaLocalRoots
    }));
    const result = await send(to, text, { mediaUrl, mediaLocalRoots });
    return { channel: "msteams", ...result };
  },
  sendPoll: async ({ cfg, to, poll }) => {
    const maxSelections = poll.maxSelections ?? 1;
    const result = await sendPollMSTeams({
      cfg,
      to,
      question: poll.question,
      options: poll.options,
      maxSelections
    });
    const pollStore = createMSTeamsPollStoreFs();
    await pollStore.createPoll({
      id: result.pollId,
      question: poll.question,
      options: poll.options,
      maxSelections,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      conversationId: result.conversationId,
      messageId: result.messageId,
      votes: {}
    });
    return result;
  }
};

// vendor/openclaw-runtime/win-x64/extensions/msteams/src/channel.ts
init_policy();
init_probe();
init_resolve_allowlist();
init_send();
init_token();
var meta = {
  id: "msteams",
  label: "Microsoft Teams",
  selectionLabel: "Microsoft Teams (Bot Framework)",
  docsPath: "/channels/msteams",
  docsLabel: "msteams",
  blurb: "Bot Framework; enterprise support.",
  aliases: ["teams"],
  order: 60
};
var msteamsPlugin = {
  id: "msteams",
  meta: {
    ...meta,
    aliases: [...meta.aliases]
  },
  onboarding: msteamsOnboardingAdapter,
  pairing: {
    idLabel: "msteamsUserId",
    normalizeAllowEntry: (entry) => entry.replace(/^(msteams|user):/i, ""),
    notifyApproval: async ({ cfg, id }) => {
      await sendMessageMSTeams({
        cfg,
        to: id,
        text: PAIRING_APPROVED_MESSAGE
      });
    }
  },
  capabilities: {
    chatTypes: ["direct", "channel", "thread"],
    polls: true,
    threads: true,
    media: true
  },
  agentPrompt: {
    messageToolHints: () => [
      "- Adaptive Cards supported. Use `action=send` with `card={type,version,body}` to send rich cards.",
      "- MSTeams targeting: omit `target` to reply to the current conversation (auto-inferred). Explicit targets: `user:ID` or `user:Display Name` (requires Graph API) for DMs, `conversation:19:...@thread.tacv2` for groups/channels. Prefer IDs over display names for speed."
    ]
  },
  threading: {
    buildToolContext: ({ context, hasRepliedRef }) => ({
      currentChannelId: context.To?.trim() || void 0,
      currentThreadTs: context.ReplyToId,
      hasRepliedRef
    })
  },
  groups: {
    resolveToolPolicy: resolveMSTeamsGroupToolPolicy
  },
  reload: { configPrefixes: ["channels.msteams"] },
  configSchema: buildChannelConfigSchema(MSTeamsConfigSchema),
  config: {
    listAccountIds: () => [DEFAULT_ACCOUNT_ID3],
    resolveAccount: (cfg) => ({
      accountId: DEFAULT_ACCOUNT_ID3,
      enabled: cfg.channels?.msteams?.enabled !== false,
      configured: Boolean(resolveMSTeamsCredentials(cfg.channels?.msteams))
    }),
    defaultAccountId: () => DEFAULT_ACCOUNT_ID3,
    setAccountEnabled: ({ cfg, enabled }) => ({
      ...cfg,
      channels: {
        ...cfg.channels,
        msteams: {
          ...cfg.channels?.msteams,
          enabled
        }
      }
    }),
    deleteAccount: ({ cfg }) => {
      const next = { ...cfg };
      const nextChannels = { ...cfg.channels };
      delete nextChannels.msteams;
      if (Object.keys(nextChannels).length > 0) {
        next.channels = nextChannels;
      } else {
        delete next.channels;
      }
      return next;
    },
    isConfigured: (_account, cfg) => Boolean(resolveMSTeamsCredentials(cfg.channels?.msteams)),
    describeAccount: (account) => ({
      accountId: account.accountId,
      enabled: account.enabled,
      configured: account.configured
    }),
    resolveAllowFrom: ({ cfg }) => cfg.channels?.msteams?.allowFrom ?? [],
    formatAllowFrom: ({ allowFrom }) => allowFrom.map((entry) => String(entry).trim()).filter(Boolean).map((entry) => entry.toLowerCase()),
    resolveDefaultTo: ({ cfg }) => cfg.channels?.msteams?.defaultTo?.trim() || void 0
  },
  security: {
    collectWarnings: ({ cfg }) => {
      const defaultGroupPolicy = resolveDefaultGroupPolicy2(cfg);
      const { groupPolicy } = resolveAllowlistProviderRuntimeGroupPolicy({
        providerConfigPresent: cfg.channels?.msteams !== void 0,
        groupPolicy: cfg.channels?.msteams?.groupPolicy,
        defaultGroupPolicy
      });
      if (groupPolicy !== "open") {
        return [];
      }
      return [
        `- MS Teams groups: groupPolicy="open" allows any member to trigger (mention-gated). Set channels.msteams.groupPolicy="allowlist" + channels.msteams.groupAllowFrom to restrict senders.`
      ];
    }
  },
  setup: {
    resolveAccountId: () => DEFAULT_ACCOUNT_ID3,
    applyAccountConfig: ({ cfg }) => ({
      ...cfg,
      channels: {
        ...cfg.channels,
        msteams: {
          ...cfg.channels?.msteams,
          enabled: true
        }
      }
    })
  },
  messaging: {
    normalizeTarget: normalizeMSTeamsMessagingTarget,
    targetResolver: {
      looksLikeId: (raw) => {
        const trimmed = raw.trim();
        if (!trimmed) {
          return false;
        }
        if (/^conversation:/i.test(trimmed)) {
          return true;
        }
        if (/^user:/i.test(trimmed)) {
          const id = trimmed.slice("user:".length).trim();
          return /^[0-9a-fA-F-]{16,}$/.test(id);
        }
        return trimmed.includes("@thread");
      },
      hint: "<conversationId|user:ID|conversation:ID>"
    }
  },
  directory: {
    self: async () => null,
    listPeers: async ({ cfg, query, limit }) => {
      const q = query?.trim().toLowerCase() || "";
      const ids = /* @__PURE__ */ new Set();
      for (const entry of cfg.channels?.msteams?.allowFrom ?? []) {
        const trimmed = String(entry).trim();
        if (trimmed && trimmed !== "*") {
          ids.add(trimmed);
        }
      }
      for (const userId of Object.keys(cfg.channels?.msteams?.dms ?? {})) {
        const trimmed = userId.trim();
        if (trimmed) {
          ids.add(trimmed);
        }
      }
      return Array.from(ids).map((raw) => raw.trim()).filter(Boolean).map((raw) => normalizeMSTeamsMessagingTarget(raw) ?? raw).map((raw) => {
        const lowered = raw.toLowerCase();
        if (lowered.startsWith("user:")) {
          return raw;
        }
        if (lowered.startsWith("conversation:")) {
          return raw;
        }
        return `user:${raw}`;
      }).filter((id) => q ? id.toLowerCase().includes(q) : true).slice(0, limit && limit > 0 ? limit : void 0).map((id) => ({ kind: "user", id }));
    },
    listGroups: async ({ cfg, query, limit }) => {
      const q = query?.trim().toLowerCase() || "";
      const ids = /* @__PURE__ */ new Set();
      for (const team of Object.values(cfg.channels?.msteams?.teams ?? {})) {
        for (const channelId of Object.keys(team.channels ?? {})) {
          const trimmed = channelId.trim();
          if (trimmed && trimmed !== "*") {
            ids.add(trimmed);
          }
        }
      }
      return Array.from(ids).map((raw) => raw.trim()).filter(Boolean).map((raw) => raw.replace(/^conversation:/i, "").trim()).map((id) => `conversation:${id}`).filter((id) => q ? id.toLowerCase().includes(q) : true).slice(0, limit && limit > 0 ? limit : void 0).map((id) => ({ kind: "group", id }));
    },
    listPeersLive: async ({ cfg, query, limit }) => listMSTeamsDirectoryPeersLive({ cfg, query, limit }),
    listGroupsLive: async ({ cfg, query, limit }) => listMSTeamsDirectoryGroupsLive({ cfg, query, limit })
  },
  resolver: {
    resolveTargets: async ({ cfg, inputs, kind, runtime: runtime2 }) => {
      const results = inputs.map((input) => ({
        input,
        resolved: false,
        id: void 0,
        name: void 0,
        note: void 0
      }));
      const stripPrefix = (value) => normalizeMSTeamsUserInput(value);
      if (kind === "user") {
        const pending2 = [];
        results.forEach((entry, index) => {
          const trimmed = entry.input.trim();
          if (!trimmed) {
            entry.note = "empty input";
            return;
          }
          const cleaned = stripPrefix(trimmed);
          if (/^[0-9a-fA-F-]{16,}$/.test(cleaned) || cleaned.includes("@")) {
            entry.resolved = true;
            entry.id = cleaned;
            return;
          }
          pending2.push({ input: entry.input, query: cleaned, index });
        });
        if (pending2.length > 0) {
          try {
            const resolved = await resolveMSTeamsUserAllowlist({
              cfg,
              entries: pending2.map((entry) => entry.query)
            });
            resolved.forEach((entry, idx) => {
              const target = results[pending2[idx]?.index ?? -1];
              if (!target) {
                return;
              }
              target.resolved = entry.resolved;
              target.id = entry.id;
              target.name = entry.name;
              target.note = entry.note;
            });
          } catch (err) {
            runtime2.error?.(`msteams resolve failed: ${String(err)}`);
            pending2.forEach(({ index }) => {
              const entry = results[index];
              if (entry) {
                entry.note = "lookup failed";
              }
            });
          }
        }
        return results;
      }
      const pending = [];
      results.forEach((entry, index) => {
        const trimmed = entry.input.trim();
        if (!trimmed) {
          entry.note = "empty input";
          return;
        }
        const conversationId = parseMSTeamsConversationId(trimmed);
        if (conversationId !== null) {
          entry.resolved = Boolean(conversationId);
          entry.id = conversationId || void 0;
          entry.note = conversationId ? "conversation id" : "empty conversation id";
          return;
        }
        const parsed = parseMSTeamsTeamChannelInput(trimmed);
        if (!parsed.team) {
          entry.note = "missing team";
          return;
        }
        const query = parsed.channel ? `${parsed.team}/${parsed.channel}` : parsed.team;
        pending.push({ input: entry.input, query, index });
      });
      if (pending.length > 0) {
        try {
          const resolved = await resolveMSTeamsChannelAllowlist({
            cfg,
            entries: pending.map((entry) => entry.query)
          });
          resolved.forEach((entry, idx) => {
            const target = results[pending[idx]?.index ?? -1];
            if (!target) {
              return;
            }
            if (!entry.resolved || !entry.teamId) {
              target.resolved = false;
              target.note = entry.note;
              return;
            }
            target.resolved = true;
            if (entry.channelId) {
              target.id = `${entry.teamId}/${entry.channelId}`;
              target.name = entry.channelName && entry.teamName ? `${entry.teamName}/${entry.channelName}` : entry.channelName ?? entry.teamName;
            } else {
              target.id = entry.teamId;
              target.name = entry.teamName;
              target.note = "team id";
            }
            if (entry.note) {
              target.note = entry.note;
            }
          });
        } catch (err) {
          runtime2.error?.(`msteams resolve failed: ${String(err)}`);
          pending.forEach(({ index }) => {
            const entry = results[index];
            if (entry) {
              entry.note = "lookup failed";
            }
          });
        }
      }
      return results;
    }
  },
  actions: {
    listActions: ({ cfg }) => {
      const enabled = cfg.channels?.msteams?.enabled !== false && Boolean(resolveMSTeamsCredentials(cfg.channels?.msteams));
      if (!enabled) {
        return [];
      }
      return ["poll"];
    },
    supportsCards: ({ cfg }) => {
      return cfg.channels?.msteams?.enabled !== false && Boolean(resolveMSTeamsCredentials(cfg.channels?.msteams));
    },
    handleAction: async (ctx) => {
      if (ctx.action === "send" && ctx.params.card) {
        const card = ctx.params.card;
        const to = typeof ctx.params.to === "string" ? ctx.params.to.trim() : typeof ctx.params.target === "string" ? ctx.params.target.trim() : "";
        if (!to) {
          return {
            isError: true,
            content: [{ type: "text", text: "Card send requires a target (to)." }],
            details: { error: "Card send requires a target (to)." }
          };
        }
        const result = await sendAdaptiveCardMSTeams({
          cfg: ctx.cfg,
          to,
          card
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                ok: true,
                channel: "msteams",
                messageId: result.messageId,
                conversationId: result.conversationId
              })
            }
          ],
          details: { ok: true, channel: "msteams", messageId: result.messageId }
        };
      }
      return null;
    }
  },
  outbound: msteamsOutbound,
  status: {
    defaultRuntime: createDefaultChannelRuntimeState(DEFAULT_ACCOUNT_ID3, { port: null }),
    buildChannelSummary: ({ snapshot }) => ({
      ...buildBaseChannelStatusSummary(snapshot),
      port: snapshot.port ?? null,
      probe: snapshot.probe,
      lastProbeAt: snapshot.lastProbeAt ?? null
    }),
    probeAccount: async ({ cfg }) => await probeMSTeams(cfg.channels?.msteams),
    buildAccountSnapshot: ({ account, runtime: runtime2, probe }) => ({
      accountId: account.accountId,
      enabled: account.enabled,
      configured: account.configured,
      running: runtime2?.running ?? false,
      lastStartAt: runtime2?.lastStartAt ?? null,
      lastStopAt: runtime2?.lastStopAt ?? null,
      lastError: runtime2?.lastError ?? null,
      port: runtime2?.port ?? null,
      probe
    })
  },
  gateway: {
    startAccount: async (ctx) => {
      const { monitorMSTeamsProvider: monitorMSTeamsProvider2 } = await Promise.resolve().then(() => (init_src(), src_exports));
      const port = ctx.cfg.channels?.msteams?.webhook?.port ?? 3978;
      ctx.setStatus({ accountId: ctx.accountId, port });
      ctx.log?.info(`starting provider (port ${port})`);
      return monitorMSTeamsProvider2({
        cfg: ctx.cfg,
        runtime: ctx.runtime,
        abortSignal: ctx.abortSignal
      });
    }
  }
};

// vendor/openclaw-runtime/win-x64/extensions/msteams/index.ts
init_runtime();
var plugin = {
  id: "msteams",
  name: "Microsoft Teams",
  description: "Microsoft Teams channel plugin (Bot Framework)",
  configSchema: emptyPluginConfigSchema(),
  register(api) {
    setMSTeamsRuntime(api.runtime);
    api.registerChannel({ plugin: msteamsPlugin });
  }
};
var msteams_default = plugin;
export {
  msteams_default as default
};
