// vendor/openclaw-runtime/win-x64/extensions/openclaw-weixin/index.ts
import { buildChannelConfigSchema } from "openclaw/plugin-sdk";

// vendor/openclaw-runtime/win-x64/extensions/openclaw-weixin/src/channel.ts
import path12 from "path";
import { normalizeAccountId as normalizeAccountId2 } from "openclaw/plugin-sdk";

// vendor/openclaw-runtime/win-x64/extensions/openclaw-weixin/src/auth/accounts.ts
import fs from "fs";
import path2 from "path";
import { normalizeAccountId } from "openclaw/plugin-sdk";

// vendor/openclaw-runtime/win-x64/extensions/openclaw-weixin/src/storage/state-dir.ts
import os from "os";
import path from "path";
function resolveStateDir() {
  return process.env.OPENCLAW_STATE_DIR?.trim() || process.env.CLAWDBOT_STATE_DIR?.trim() || path.join(os.homedir(), ".openclaw");
}

// vendor/openclaw-runtime/win-x64/extensions/openclaw-weixin/src/auth/accounts.ts
var DEFAULT_BASE_URL = "https://ilinkai.weixin.qq.com";
var CDN_BASE_URL = "https://novac2c.cdn.weixin.qq.com/c2c";
function deriveRawAccountId(normalizedId) {
  if (normalizedId.endsWith("-im-bot")) {
    return `${normalizedId.slice(0, -7)}@im.bot`;
  }
  if (normalizedId.endsWith("-im-wechat")) {
    return `${normalizedId.slice(0, -10)}@im.wechat`;
  }
  return void 0;
}
function resolveWeixinStateDir() {
  return path2.join(resolveStateDir(), "openclaw-weixin");
}
function resolveAccountIndexPath() {
  return path2.join(resolveWeixinStateDir(), "accounts.json");
}
function listIndexedWeixinAccountIds() {
  const filePath = resolveAccountIndexPath();
  try {
    if (!fs.existsSync(filePath)) return [];
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id) => typeof id === "string" && id.trim() !== "");
  } catch {
    return [];
  }
}
function registerWeixinAccountId(accountId) {
  const dir = resolveWeixinStateDir();
  fs.mkdirSync(dir, { recursive: true });
  const existing = listIndexedWeixinAccountIds();
  if (existing.includes(accountId)) return;
  const updated = [...existing, accountId];
  fs.writeFileSync(resolveAccountIndexPath(), JSON.stringify(updated, null, 2), "utf-8");
}
function resolveAccountsDir() {
  return path2.join(resolveWeixinStateDir(), "accounts");
}
function resolveAccountPath(accountId) {
  return path2.join(resolveAccountsDir(), `${accountId}.json`);
}
function loadLegacyToken() {
  const legacyPath = path2.join(resolveStateDir(), "credentials", "openclaw-weixin", "credentials.json");
  try {
    if (!fs.existsSync(legacyPath)) return void 0;
    const raw = fs.readFileSync(legacyPath, "utf-8");
    const parsed = JSON.parse(raw);
    return typeof parsed.token === "string" ? parsed.token : void 0;
  } catch {
    return void 0;
  }
}
function readAccountFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    }
  } catch {
  }
  return null;
}
function loadWeixinAccount(accountId) {
  const primary = readAccountFile(resolveAccountPath(accountId));
  if (primary) return primary;
  const rawId = deriveRawAccountId(accountId);
  if (rawId) {
    const compat = readAccountFile(resolveAccountPath(rawId));
    if (compat) return compat;
  }
  const token = loadLegacyToken();
  if (token) return { token };
  return null;
}
function saveWeixinAccount(accountId, update) {
  const dir = resolveAccountsDir();
  fs.mkdirSync(dir, { recursive: true });
  const existing = loadWeixinAccount(accountId) ?? {};
  const token = update.token?.trim() || existing.token;
  const baseUrl = update.baseUrl?.trim() || existing.baseUrl;
  const userId = update.userId !== void 0 ? update.userId.trim() || void 0 : existing.userId?.trim() || void 0;
  const data = {
    ...token ? { token, savedAt: (/* @__PURE__ */ new Date()).toISOString() } : {},
    ...baseUrl ? { baseUrl } : {},
    ...userId ? { userId } : {}
  };
  const filePath = resolveAccountPath(accountId);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  try {
    fs.chmodSync(filePath, 384);
  } catch {
  }
}
function resolveConfigPath() {
  const envPath = process.env.OPENCLAW_CONFIG?.trim();
  if (envPath) return envPath;
  return path2.join(resolveStateDir(), "openclaw.json");
}
function loadConfigRouteTag(accountId) {
  try {
    const configPath = resolveConfigPath();
    if (!fs.existsSync(configPath)) return void 0;
    const raw = fs.readFileSync(configPath, "utf-8");
    const cfg = JSON.parse(raw);
    const channels = cfg.channels;
    const section = channels?.["openclaw-weixin"];
    if (!section) return void 0;
    if (accountId) {
      const accounts = section.accounts;
      const tag = accounts?.[accountId]?.routeTag;
      if (typeof tag === "number") return String(tag);
      if (typeof tag === "string" && tag.trim()) return tag.trim();
    }
    if (typeof section.routeTag === "number") return String(section.routeTag);
    return typeof section.routeTag === "string" && section.routeTag.trim() ? section.routeTag.trim() : void 0;
  } catch {
    return void 0;
  }
}
async function triggerWeixinChannelReload() {
}
function listWeixinAccountIds(_cfg) {
  return listIndexedWeixinAccountIds();
}
function resolveWeixinAccount(cfg, accountId) {
  const raw = accountId?.trim();
  if (!raw) {
    throw new Error("weixin: accountId is required (no default account)");
  }
  const id = normalizeAccountId(raw);
  const section = cfg.channels?.["openclaw-weixin"];
  const accountCfg = section?.accounts?.[id] ?? section ?? {};
  const accountData = loadWeixinAccount(id);
  const token = accountData?.token?.trim() || void 0;
  const stateBaseUrl = accountData?.baseUrl?.trim() || "";
  return {
    accountId: id,
    baseUrl: stateBaseUrl || DEFAULT_BASE_URL,
    cdnBaseUrl: accountCfg.cdnBaseUrl?.trim() || CDN_BASE_URL,
    token,
    enabled: accountCfg.enabled !== false,
    configured: Boolean(token),
    name: accountCfg.name?.trim() || void 0
  };
}

// vendor/openclaw-runtime/win-x64/extensions/openclaw-weixin/src/util/logger.ts
import fs2 from "fs";
import os2 from "os";
import path3 from "path";
var MAIN_LOG_DIR = path3.join("/tmp", "openclaw");
var SUBSYSTEM = "gateway/channels/openclaw-weixin";
var RUNTIME = "node";
var RUNTIME_VERSION = process.versions.node;
var HOSTNAME = os2.hostname() || "unknown";
var PARENT_NAMES = ["openclaw"];
var LEVEL_IDS = {
  TRACE: 1,
  DEBUG: 2,
  INFO: 3,
  WARN: 4,
  ERROR: 5,
  FATAL: 6
};
var DEFAULT_LOG_LEVEL = "INFO";
function resolveMinLevel() {
  const env = process.env.OPENCLAW_LOG_LEVEL?.toUpperCase();
  if (env && env in LEVEL_IDS) return LEVEL_IDS[env];
  return LEVEL_IDS[DEFAULT_LOG_LEVEL];
}
var minLevelId = resolveMinLevel();
function toLocalISO(now) {
  const offsetMs = -now.getTimezoneOffset() * 6e4;
  const sign = offsetMs >= 0 ? "+" : "-";
  const abs = Math.abs(now.getTimezoneOffset());
  const offStr = `${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
  return new Date(now.getTime() + offsetMs).toISOString().replace("Z", offStr);
}
function localDateKey(now) {
  return toLocalISO(now).slice(0, 10);
}
function resolveMainLogPath() {
  const dateKey = localDateKey(/* @__PURE__ */ new Date());
  return path3.join(MAIN_LOG_DIR, `openclaw-${dateKey}.log`);
}
var logDirEnsured = false;
function buildLoggerName(accountId) {
  return accountId ? `${SUBSYSTEM}/${accountId}` : SUBSYSTEM;
}
function writeLog(level, message, accountId) {
  const levelId = LEVEL_IDS[level] ?? LEVEL_IDS.INFO;
  if (levelId < minLevelId) return;
  const now = /* @__PURE__ */ new Date();
  const loggerName = buildLoggerName(accountId);
  const prefixedMessage = accountId ? `[${accountId}] ${message}` : message;
  const entry = JSON.stringify({
    "0": loggerName,
    "1": prefixedMessage,
    _meta: {
      runtime: RUNTIME,
      runtimeVersion: RUNTIME_VERSION,
      hostname: HOSTNAME,
      name: loggerName,
      parentNames: PARENT_NAMES,
      date: now.toISOString(),
      logLevelId: LEVEL_IDS[level] ?? LEVEL_IDS.INFO,
      logLevelName: level
    },
    time: toLocalISO(now)
  });
  try {
    if (!logDirEnsured) {
      fs2.mkdirSync(MAIN_LOG_DIR, { recursive: true });
      logDirEnsured = true;
    }
    fs2.appendFileSync(resolveMainLogPath(), `${entry}
`, "utf-8");
  } catch {
  }
}
function createLogger(accountId) {
  return {
    info(message) {
      writeLog("INFO", message, accountId);
    },
    debug(message) {
      writeLog("DEBUG", message, accountId);
    },
    warn(message) {
      writeLog("WARN", message, accountId);
    },
    error(message) {
      writeLog("ERROR", message, accountId);
    },
    withAccount(id) {
      return createLogger(id);
    },
    getLogFilePath() {
      return resolveMainLogPath();
    },
    close() {
    }
  };
}
var logger = createLogger();

// vendor/openclaw-runtime/win-x64/extensions/openclaw-weixin/src/api/session-guard.ts
var SESSION_PAUSE_DURATION_MS = 60 * 60 * 1e3;
var SESSION_EXPIRED_ERRCODE = -14;
var pauseUntilMap = /* @__PURE__ */ new Map();
function pauseSession(accountId) {
  const until = Date.now() + SESSION_PAUSE_DURATION_MS;
  pauseUntilMap.set(accountId, until);
  logger.info(
    `session-guard: paused accountId=${accountId} until=${new Date(until).toISOString()} (${SESSION_PAUSE_DURATION_MS / 1e3}s)`
  );
}
function isSessionPaused(accountId) {
  const until = pauseUntilMap.get(accountId);
  if (until === void 0) return false;
  if (Date.now() >= until) {
    pauseUntilMap.delete(accountId);
    return false;
  }
  return true;
}
function getRemainingPauseMs(accountId) {
  const until = pauseUntilMap.get(accountId);
  if (until === void 0) return 0;
  const remaining = until - Date.now();
  if (remaining <= 0) {
    pauseUntilMap.delete(accountId);
    return 0;
  }
  return remaining;
}
function assertSessionActive(accountId) {
  if (isSessionPaused(accountId)) {
    const remainingMin = Math.ceil(getRemainingPauseMs(accountId) / 6e4);
    throw new Error(
      `session paused for accountId=${accountId}, ${remainingMin} min remaining (errcode ${SESSION_EXPIRED_ERRCODE})`
    );
  }
}

// vendor/openclaw-runtime/win-x64/extensions/openclaw-weixin/src/util/random.ts
import crypto from "crypto";
function generateId(prefix) {
  return `${prefix}:${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
}
function tempFileName(prefix, ext) {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}${ext}`;
}

// vendor/openclaw-runtime/win-x64/extensions/openclaw-weixin/src/api/types.ts
var UploadMediaType = {
  IMAGE: 1,
  VIDEO: 2,
  FILE: 3,
  VOICE: 4
};
var MessageType = {
  NONE: 0,
  USER: 1,
  BOT: 2
};
var MessageItemType = {
  NONE: 0,
  TEXT: 1,
  IMAGE: 2,
  VOICE: 3,
  FILE: 4,
  VIDEO: 5
};
var MessageState = {
  NEW: 0,
  GENERATING: 1,
  FINISH: 2
};
var TypingStatus = {
  TYPING: 1,
  CANCEL: 2
};

// vendor/openclaw-runtime/win-x64/extensions/openclaw-weixin/src/messaging/inbound.ts
var contextTokenStore = /* @__PURE__ */ new Map();
function contextTokenKey(accountId, userId) {
  return `${accountId}:${userId}`;
}
function setContextToken(accountId, userId, token) {
  const k = contextTokenKey(accountId, userId);
  logger.debug(`setContextToken: key=${k}`);
  contextTokenStore.set(k, token);
}
function getContextToken(accountId, userId) {
  const k = contextTokenKey(accountId, userId);
  const val = contextTokenStore.get(k);
  logger.debug(
    `getContextToken: key=${k} found=${val !== void 0} storeSize=${contextTokenStore.size}`
  );
  return val;
}
function generateMessageSid() {
  return generateId("openclaw-weixin");
}
function isMediaItem(item) {
  return item.type === MessageItemType.IMAGE || item.type === MessageItemType.VIDEO || item.type === MessageItemType.FILE || item.type === MessageItemType.VOICE;
}
function bodyFromItemList(itemList) {
  if (!itemList?.length) return "";
  for (const item of itemList) {
    if (item.type === MessageItemType.TEXT && item.text_item?.text != null) {
      const text = String(item.text_item.text);
      const ref = item.ref_msg;
      if (!ref) return text;
      if (ref.message_item && isMediaItem(ref.message_item)) return text;
      const parts = [];
      if (ref.title) parts.push(ref.title);
      if (ref.message_item) {
        const refBody = bodyFromItemList([ref.message_item]);
        if (refBody) parts.push(refBody);
      }
      if (!parts.length) return text;
      return `[\u5F15\u7528: ${parts.join(" | ")}]
${text}`;
    }
    if (item.type === MessageItemType.VOICE && item.voice_item?.text) {
      return item.voice_item.text;
    }
  }
  return "";
}
function weixinMessageToMsgContext(msg, accountId, opts) {
  const from_user_id = msg.from_user_id ?? "";
  const ctx = {
    Body: bodyFromItemList(msg.item_list),
    From: from_user_id,
    To: from_user_id,
    AccountId: accountId,
    OriginatingChannel: "openclaw-weixin",
    OriginatingTo: from_user_id,
    MessageSid: generateMessageSid(),
    Timestamp: msg.create_time_ms,
    Provider: "openclaw-weixin",
    ChatType: "direct"
  };
  if (msg.context_token) {
    ctx.context_token = msg.context_token;
  }
  if (opts?.decryptedPicPath) {
    ctx.MediaPath = opts.decryptedPicPath;
    ctx.MediaType = "image/*";
  } else if (opts?.decryptedVideoPath) {
    ctx.MediaPath = opts.decryptedVideoPath;
    ctx.MediaType = "video/mp4";
  } else if (opts?.decryptedFilePath) {
    ctx.MediaPath = opts.decryptedFilePath;
    ctx.MediaType = opts.fileMediaType ?? "application/octet-stream";
  } else if (opts?.decryptedVoicePath) {
    ctx.MediaPath = opts.decryptedVoicePath;
    ctx.MediaType = opts.voiceMediaType ?? "audio/wav";
  }
  return ctx;
}
function getContextTokenFromMsgContext(ctx) {
  return ctx.context_token;
}

// vendor/openclaw-runtime/win-x64/extensions/openclaw-weixin/src/auth/login-qr.ts
import { randomUUID } from "crypto";

// vendor/openclaw-runtime/win-x64/extensions/openclaw-weixin/src/util/redact.ts
var DEFAULT_BODY_MAX_LEN = 200;
var DEFAULT_TOKEN_PREFIX_LEN = 6;
function truncate(s, max) {
  if (!s) return "";
  if (s.length <= max) return s;
  return `${s.slice(0, max)}\u2026(len=${s.length})`;
}
function redactToken(token, prefixLen = DEFAULT_TOKEN_PREFIX_LEN) {
  if (!token) return "(none)";
  if (token.length <= prefixLen) return `****(len=${token.length})`;
  return `${token.slice(0, prefixLen)}\u2026(len=${token.length})`;
}
function redactBody(body, maxLen = DEFAULT_BODY_MAX_LEN) {
  if (!body) return "(empty)";
  if (body.length <= maxLen) return body;
  return `${body.slice(0, maxLen)}\u2026(truncated, totalLen=${body.length})`;
}
function redactUrl(rawUrl) {
  try {
    const u = new URL(rawUrl);
    const base = `${u.origin}${u.pathname}`;
    return u.search ? `${base}?<redacted>` : base;
  } catch {
    return truncate(rawUrl, 80);
  }
}

// vendor/openclaw-runtime/win-x64/extensions/openclaw-weixin/src/auth/login-qr.ts
var ACTIVE_LOGIN_TTL_MS = 5 * 6e4;
var QR_LONG_POLL_TIMEOUT_MS = 35e3;
var DEFAULT_ILINK_BOT_TYPE = "3";
var activeLogins = /* @__PURE__ */ new Map();
function isLoginFresh(login) {
  return Date.now() - login.startedAt < ACTIVE_LOGIN_TTL_MS;
}
function purgeExpiredLogins() {
  for (const [id, login] of activeLogins) {
    if (!isLoginFresh(login)) {
      activeLogins.delete(id);
    }
  }
}
async function fetchQRCode(apiBaseUrl, botType) {
  const base = apiBaseUrl.endsWith("/") ? apiBaseUrl : `${apiBaseUrl}/`;
  const url = new URL(`ilink/bot/get_bot_qrcode?bot_type=${encodeURIComponent(botType)}`, base);
  logger.info(`Fetching QR code from: ${url.toString()}`);
  const headers = {};
  const routeTag = loadConfigRouteTag();
  if (routeTag) {
    headers.SKRouteTag = routeTag;
  }
  const response = await fetch(url.toString(), { headers });
  if (!response.ok) {
    const body = await response.text().catch(() => "(unreadable)");
    logger.error(`QR code fetch failed: ${response.status} ${response.statusText} body=${body}`);
    throw new Error(`Failed to fetch QR code: ${response.status} ${response.statusText}`);
  }
  return await response.json();
}
async function pollQRStatus(apiBaseUrl, qrcode) {
  const base = apiBaseUrl.endsWith("/") ? apiBaseUrl : `${apiBaseUrl}/`;
  const url = new URL(`ilink/bot/get_qrcode_status?qrcode=${encodeURIComponent(qrcode)}`, base);
  logger.debug(`Long-poll QR status from: ${url.toString()}`);
  const headers = {
    "iLink-App-ClientVersion": "1"
  };
  const routeTag = loadConfigRouteTag();
  if (routeTag) {
    headers.SKRouteTag = routeTag;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), QR_LONG_POLL_TIMEOUT_MS);
  try {
    const response = await fetch(url.toString(), { headers, signal: controller.signal });
    clearTimeout(timer);
    logger.debug(`pollQRStatus: HTTP ${response.status}, reading body...`);
    const rawText = await response.text();
    logger.debug(`pollQRStatus: body=${rawText.substring(0, 200)}`);
    if (!response.ok) {
      logger.error(`QR status poll failed: ${response.status} ${response.statusText} body=${rawText}`);
      throw new Error(`Failed to poll QR status: ${response.status} ${response.statusText}`);
    }
    return JSON.parse(rawText);
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof Error && err.name === "AbortError") {
      logger.debug(`pollQRStatus: client-side timeout after ${QR_LONG_POLL_TIMEOUT_MS}ms, returning wait`);
      return { status: "wait" };
    }
    throw err;
  }
}
async function startWeixinLoginWithQr(opts) {
  const sessionKey = opts.accountId || randomUUID();
  purgeExpiredLogins();
  const existing = activeLogins.get(sessionKey);
  if (!opts.force && existing && isLoginFresh(existing) && existing.qrcodeUrl) {
    return {
      qrcodeUrl: existing.qrcodeUrl,
      message: "\u4E8C\u7EF4\u7801\u5DF2\u5C31\u7EEA\uFF0C\u8BF7\u4F7F\u7528\u5FAE\u4FE1\u626B\u63CF\u3002",
      sessionKey
    };
  }
  try {
    const botType = opts.botType || DEFAULT_ILINK_BOT_TYPE;
    logger.info(`Starting Weixin login with bot_type=${botType}`);
    if (!opts.apiBaseUrl) {
      return {
        message: "No baseUrl configured. Add channels.openclaw-weixin.baseUrl to your config before logging in.",
        sessionKey
      };
    }
    const qrResponse = await fetchQRCode(opts.apiBaseUrl, botType);
    logger.info(
      `QR code received, qrcode=${redactToken(qrResponse.qrcode)} imgContentLen=${qrResponse.qrcode_img_content?.length ?? 0}`
    );
    logger.info(`\u4E8C\u7EF4\u7801\u94FE\u63A5: ${qrResponse.qrcode_img_content}`);
    const login = {
      sessionKey,
      id: randomUUID(),
      qrcode: qrResponse.qrcode,
      qrcodeUrl: qrResponse.qrcode_img_content,
      startedAt: Date.now()
    };
    activeLogins.set(sessionKey, login);
    return {
      qrcodeUrl: qrResponse.qrcode_img_content,
      message: "\u4F7F\u7528\u5FAE\u4FE1\u626B\u63CF\u4EE5\u4E0B\u4E8C\u7EF4\u7801\uFF0C\u4EE5\u5B8C\u6210\u8FDE\u63A5\u3002",
      sessionKey
    };
  } catch (err) {
    logger.error(`Failed to start Weixin login: ${String(err)}`);
    return {
      message: `Failed to start login: ${String(err)}`,
      sessionKey
    };
  }
}
var MAX_QR_REFRESH_COUNT = 3;
async function waitForWeixinLogin(opts) {
  let activeLogin = activeLogins.get(opts.sessionKey);
  if (!activeLogin) {
    logger.warn(`waitForWeixinLogin: no active login sessionKey=${opts.sessionKey}`);
    return {
      connected: false,
      message: "\u5F53\u524D\u6CA1\u6709\u8FDB\u884C\u4E2D\u7684\u767B\u5F55\uFF0C\u8BF7\u5148\u53D1\u8D77\u767B\u5F55\u3002"
    };
  }
  if (!isLoginFresh(activeLogin)) {
    logger.warn(`waitForWeixinLogin: login QR expired sessionKey=${opts.sessionKey}`);
    activeLogins.delete(opts.sessionKey);
    return {
      connected: false,
      message: "\u4E8C\u7EF4\u7801\u5DF2\u8FC7\u671F\uFF0C\u8BF7\u91CD\u65B0\u751F\u6210\u3002"
    };
  }
  const timeoutMs = Math.max(opts.timeoutMs ?? 48e4, 1e3);
  const deadline = Date.now() + timeoutMs;
  let scannedPrinted = false;
  let qrRefreshCount = 1;
  logger.info("Starting to poll QR code status...");
  while (Date.now() < deadline) {
    try {
      const statusResponse = await pollQRStatus(opts.apiBaseUrl, activeLogin.qrcode);
      logger.debug(`pollQRStatus: status=${statusResponse.status} hasBotToken=${Boolean(statusResponse.bot_token)} hasBotId=${Boolean(statusResponse.ilink_bot_id)}`);
      activeLogin.status = statusResponse.status;
      switch (statusResponse.status) {
        case "wait":
          if (opts.verbose) {
            process.stdout.write(".");
          }
          break;
        case "scaned":
          if (!scannedPrinted) {
            process.stdout.write("\n\u{1F440} \u5DF2\u626B\u7801\uFF0C\u5728\u5FAE\u4FE1\u7EE7\u7EED\u64CD\u4F5C...\n");
            scannedPrinted = true;
          }
          break;
        case "expired": {
          qrRefreshCount++;
          if (qrRefreshCount > MAX_QR_REFRESH_COUNT) {
            logger.warn(
              `waitForWeixinLogin: QR expired ${MAX_QR_REFRESH_COUNT} times, giving up sessionKey=${opts.sessionKey}`
            );
            activeLogins.delete(opts.sessionKey);
            return {
              connected: false,
              message: "\u767B\u5F55\u8D85\u65F6\uFF1A\u4E8C\u7EF4\u7801\u591A\u6B21\u8FC7\u671F\uFF0C\u8BF7\u91CD\u65B0\u5F00\u59CB\u767B\u5F55\u6D41\u7A0B\u3002"
            };
          }
          process.stdout.write(`
\u23F3 \u4E8C\u7EF4\u7801\u5DF2\u8FC7\u671F\uFF0C\u6B63\u5728\u5237\u65B0...(${qrRefreshCount}/${MAX_QR_REFRESH_COUNT})
`);
          logger.info(
            `waitForWeixinLogin: QR expired, refreshing (${qrRefreshCount}/${MAX_QR_REFRESH_COUNT})`
          );
          try {
            const botType = opts.botType || DEFAULT_ILINK_BOT_TYPE;
            const qrResponse = await fetchQRCode(opts.apiBaseUrl, botType);
            activeLogin.qrcode = qrResponse.qrcode;
            activeLogin.qrcodeUrl = qrResponse.qrcode_img_content;
            activeLogin.startedAt = Date.now();
            scannedPrinted = false;
            logger.info(`waitForWeixinLogin: new QR code obtained qrcode=${redactToken(qrResponse.qrcode)}`);
            process.stdout.write(`\u{1F504} \u65B0\u4E8C\u7EF4\u7801\u5DF2\u751F\u6210\uFF0C\u8BF7\u91CD\u65B0\u626B\u63CF

`);
            try {
              const qrterm = await import("qrcode-terminal");
              qrterm.default.generate(qrResponse.qrcode_img_content, { small: true });
            } catch {
              process.stdout.write(`QR Code URL: ${qrResponse.qrcode_img_content}
`);
            }
          } catch (refreshErr) {
            logger.error(`waitForWeixinLogin: failed to refresh QR code: ${String(refreshErr)}`);
            activeLogins.delete(opts.sessionKey);
            return {
              connected: false,
              message: `\u5237\u65B0\u4E8C\u7EF4\u7801\u5931\u8D25: ${String(refreshErr)}`
            };
          }
          break;
        }
        case "confirmed": {
          if (!statusResponse.ilink_bot_id) {
            activeLogins.delete(opts.sessionKey);
            logger.error("Login confirmed but ilink_bot_id missing from response");
            return {
              connected: false,
              message: "\u767B\u5F55\u5931\u8D25\uFF1A\u670D\u52A1\u5668\u672A\u8FD4\u56DE ilink_bot_id\u3002"
            };
          }
          activeLogin.botToken = statusResponse.bot_token;
          activeLogins.delete(opts.sessionKey);
          logger.info(
            `\u2705 Login confirmed! ilink_bot_id=${statusResponse.ilink_bot_id} ilink_user_id=${redactToken(statusResponse.ilink_user_id)}`
          );
          return {
            connected: true,
            botToken: statusResponse.bot_token,
            accountId: statusResponse.ilink_bot_id,
            baseUrl: statusResponse.baseurl,
            userId: statusResponse.ilink_user_id,
            message: "\u2705 \u4E0E\u5FAE\u4FE1\u8FDE\u63A5\u6210\u529F\uFF01"
          };
        }
      }
    } catch (err) {
      logger.error(`Error polling QR status: ${String(err)}`);
      activeLogins.delete(opts.sessionKey);
      return {
        connected: false,
        message: `Login failed: ${String(err)}`
      };
    }
    await new Promise((r) => setTimeout(r, 1e3));
  }
  logger.warn(
    `waitForWeixinLogin: timed out waiting for QR scan sessionKey=${opts.sessionKey} timeoutMs=${timeoutMs}`
  );
  activeLogins.delete(opts.sessionKey);
  return {
    connected: false,
    message: "\u767B\u5F55\u8D85\u65F6\uFF0C\u8BF7\u91CD\u8BD5\u3002"
  };
}

// vendor/openclaw-runtime/win-x64/extensions/openclaw-weixin/src/api/api.ts
import crypto2 from "crypto";
import fs3 from "fs";
import path4 from "path";
import { fileURLToPath } from "url";
function readChannelVersion() {
  try {
    const dir = path4.dirname(fileURLToPath(import.meta.url));
    const pkgPath = path4.resolve(dir, "..", "..", "package.json");
    const pkg = JSON.parse(fs3.readFileSync(pkgPath, "utf-8"));
    return pkg.version ?? "unknown";
  } catch {
    return "unknown";
  }
}
var CHANNEL_VERSION = readChannelVersion();
function buildBaseInfo() {
  return { channel_version: CHANNEL_VERSION };
}
var DEFAULT_LONG_POLL_TIMEOUT_MS = 35e3;
var DEFAULT_API_TIMEOUT_MS = 15e3;
var DEFAULT_CONFIG_TIMEOUT_MS = 1e4;
function ensureTrailingSlash(url) {
  return url.endsWith("/") ? url : `${url}/`;
}
function randomWechatUin() {
  const uint32 = crypto2.randomBytes(4).readUInt32BE(0);
  return Buffer.from(String(uint32), "utf-8").toString("base64");
}
function buildHeaders(opts) {
  const headers = {
    "Content-Type": "application/json",
    AuthorizationType: "ilink_bot_token",
    "Content-Length": String(Buffer.byteLength(opts.body, "utf-8")),
    "X-WECHAT-UIN": randomWechatUin()
  };
  if (opts.token?.trim()) {
    headers.Authorization = `Bearer ${opts.token.trim()}`;
  }
  const routeTag = loadConfigRouteTag();
  if (routeTag) {
    headers.SKRouteTag = routeTag;
  }
  logger.debug(
    `requestHeaders: ${JSON.stringify({ ...headers, Authorization: headers.Authorization ? "Bearer ***" : void 0 })}`
  );
  return headers;
}
async function apiFetch(params) {
  const base = ensureTrailingSlash(params.baseUrl);
  const url = new URL(params.endpoint, base);
  const hdrs = buildHeaders({ token: params.token, body: params.body });
  logger.debug(`POST ${redactUrl(url.toString())} body=${redactBody(params.body)}`);
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), params.timeoutMs);
  try {
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: hdrs,
      body: params.body,
      signal: controller.signal
    });
    clearTimeout(t);
    const rawText = await res.text();
    logger.debug(`${params.label} status=${res.status} raw=${redactBody(rawText)}`);
    if (!res.ok) {
      throw new Error(`${params.label} ${res.status}: ${rawText}`);
    }
    return rawText;
  } catch (err) {
    clearTimeout(t);
    throw err;
  }
}
async function getUpdates(params) {
  const timeout = params.timeoutMs ?? DEFAULT_LONG_POLL_TIMEOUT_MS;
  try {
    const rawText = await apiFetch({
      baseUrl: params.baseUrl,
      endpoint: "ilink/bot/getupdates",
      body: JSON.stringify({
        get_updates_buf: params.get_updates_buf ?? "",
        base_info: buildBaseInfo()
      }),
      token: params.token,
      timeoutMs: timeout,
      label: "getUpdates"
    });
    const resp = JSON.parse(rawText);
    return resp;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      logger.debug(`getUpdates: client-side timeout after ${timeout}ms, returning empty response`);
      return { ret: 0, msgs: [], get_updates_buf: params.get_updates_buf };
    }
    throw err;
  }
}
async function getUploadUrl(params) {
  const rawText = await apiFetch({
    baseUrl: params.baseUrl,
    endpoint: "ilink/bot/getuploadurl",
    body: JSON.stringify({
      filekey: params.filekey,
      media_type: params.media_type,
      to_user_id: params.to_user_id,
      rawsize: params.rawsize,
      rawfilemd5: params.rawfilemd5,
      filesize: params.filesize,
      thumb_rawsize: params.thumb_rawsize,
      thumb_rawfilemd5: params.thumb_rawfilemd5,
      thumb_filesize: params.thumb_filesize,
      no_need_thumb: params.no_need_thumb,
      aeskey: params.aeskey,
      base_info: buildBaseInfo()
    }),
    token: params.token,
    timeoutMs: params.timeoutMs ?? DEFAULT_API_TIMEOUT_MS,
    label: "getUploadUrl"
  });
  const resp = JSON.parse(rawText);
  return resp;
}
async function sendMessage(params) {
  await apiFetch({
    baseUrl: params.baseUrl,
    endpoint: "ilink/bot/sendmessage",
    body: JSON.stringify({ ...params.body, base_info: buildBaseInfo() }),
    token: params.token,
    timeoutMs: params.timeoutMs ?? DEFAULT_API_TIMEOUT_MS,
    label: "sendMessage"
  });
}
async function getConfig(params) {
  const rawText = await apiFetch({
    baseUrl: params.baseUrl,
    endpoint: "ilink/bot/getconfig",
    body: JSON.stringify({
      ilink_user_id: params.ilinkUserId,
      context_token: params.contextToken,
      base_info: buildBaseInfo()
    }),
    token: params.token,
    timeoutMs: params.timeoutMs ?? DEFAULT_CONFIG_TIMEOUT_MS,
    label: "getConfig"
  });
  const resp = JSON.parse(rawText);
  return resp;
}
async function sendTyping(params) {
  await apiFetch({
    baseUrl: params.baseUrl,
    endpoint: "ilink/bot/sendtyping",
    body: JSON.stringify({ ...params.body, base_info: buildBaseInfo() }),
    token: params.token,
    timeoutMs: params.timeoutMs ?? DEFAULT_CONFIG_TIMEOUT_MS,
    label: "sendTyping"
  });
}

// vendor/openclaw-runtime/win-x64/extensions/openclaw-weixin/src/api/config-cache.ts
var CONFIG_CACHE_TTL_MS = 24 * 60 * 60 * 1e3;
var CONFIG_CACHE_INITIAL_RETRY_MS = 2e3;
var CONFIG_CACHE_MAX_RETRY_MS = 60 * 60 * 1e3;
var WeixinConfigManager = class {
  constructor(apiOpts, log) {
    this.apiOpts = apiOpts;
    this.log = log;
  }
  cache = /* @__PURE__ */ new Map();
  async getForUser(userId, contextToken) {
    const now = Date.now();
    const entry = this.cache.get(userId);
    const shouldFetch = !entry || now >= entry.nextFetchAt;
    if (shouldFetch) {
      let fetchOk = false;
      try {
        const resp = await getConfig({
          baseUrl: this.apiOpts.baseUrl,
          token: this.apiOpts.token,
          ilinkUserId: userId,
          contextToken
        });
        if (resp.ret === 0) {
          this.cache.set(userId, {
            config: { typingTicket: resp.typing_ticket ?? "" },
            everSucceeded: true,
            nextFetchAt: now + Math.random() * CONFIG_CACHE_TTL_MS,
            retryDelayMs: CONFIG_CACHE_INITIAL_RETRY_MS
          });
          this.log(
            `[weixin] config ${entry?.everSucceeded ? "refreshed" : "cached"} for ${userId}`
          );
          fetchOk = true;
        }
      } catch (err) {
        this.log(`[weixin] getConfig failed for ${userId} (ignored): ${String(err)}`);
      }
      if (!fetchOk) {
        const prevDelay = entry?.retryDelayMs ?? CONFIG_CACHE_INITIAL_RETRY_MS;
        const nextDelay = Math.min(prevDelay * 2, CONFIG_CACHE_MAX_RETRY_MS);
        if (entry) {
          entry.nextFetchAt = now + nextDelay;
          entry.retryDelayMs = nextDelay;
        } else {
          this.cache.set(userId, {
            config: { typingTicket: "" },
            everSucceeded: false,
            nextFetchAt: now + CONFIG_CACHE_INITIAL_RETRY_MS,
            retryDelayMs: CONFIG_CACHE_INITIAL_RETRY_MS
          });
        }
      }
    }
    return this.cache.get(userId)?.config ?? { typingTicket: "" };
  }
};

// vendor/openclaw-runtime/win-x64/extensions/openclaw-weixin/src/messaging/process-message.ts
import path10 from "path";
import {
  createTypingCallbacks,
  resolveSenderCommandAuthorizationWithRuntime,
  resolveDirectDmAuthorizationOutcome,
  resolvePreferredOpenClawTmpDir
} from "openclaw/plugin-sdk";

// vendor/openclaw-runtime/win-x64/extensions/openclaw-weixin/src/auth/pairing.ts
import fs4 from "fs";
import path5 from "path";
import { withFileLock } from "openclaw/plugin-sdk";
function resolveCredentialsDir() {
  const override = process.env.OPENCLAW_OAUTH_DIR?.trim();
  if (override) return override;
  return path5.join(resolveStateDir(), "credentials");
}
function safeKey(raw) {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) throw new Error("invalid key for allowFrom path");
  const safe = trimmed.replace(/[\\/:*?"<>|]/g, "_").replace(/\.\./g, "_");
  if (!safe || safe === "_") throw new Error("invalid key for allowFrom path");
  return safe;
}
function resolveFrameworkAllowFromPath(accountId) {
  const base = safeKey("openclaw-weixin");
  const safeAccount = safeKey(accountId);
  return path5.join(resolveCredentialsDir(), `${base}-${safeAccount}-allowFrom.json`);
}
function readFrameworkAllowFromList(accountId) {
  const filePath = resolveFrameworkAllowFromPath(accountId);
  try {
    if (!fs4.existsSync(filePath)) return [];
    const raw = fs4.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.allowFrom)) {
      return parsed.allowFrom.filter((id) => typeof id === "string" && id.trim() !== "");
    }
  } catch {
  }
  return [];
}

// vendor/openclaw-runtime/win-x64/extensions/openclaw-weixin/src/cdn/upload.ts
import crypto3 from "crypto";
import fs5 from "fs/promises";
import path7 from "path";

// vendor/openclaw-runtime/win-x64/extensions/openclaw-weixin/src/cdn/aes-ecb.ts
import { createCipheriv, createDecipheriv } from "crypto";
function encryptAesEcb(plaintext, key) {
  const cipher = createCipheriv("aes-128-ecb", key, null);
  return Buffer.concat([cipher.update(plaintext), cipher.final()]);
}
function decryptAesEcb(ciphertext, key) {
  const decipher = createDecipheriv("aes-128-ecb", key, null);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}
function aesEcbPaddedSize(plaintextSize) {
  return Math.ceil((plaintextSize + 1) / 16) * 16;
}

// vendor/openclaw-runtime/win-x64/extensions/openclaw-weixin/src/cdn/cdn-url.ts
function buildCdnDownloadUrl(encryptedQueryParam, cdnBaseUrl) {
  return `${cdnBaseUrl}/download?encrypted_query_param=${encodeURIComponent(encryptedQueryParam)}`;
}
function buildCdnUploadUrl(params) {
  return `${params.cdnBaseUrl}/upload?encrypted_query_param=${encodeURIComponent(params.uploadParam)}&filekey=${encodeURIComponent(params.filekey)}`;
}

// vendor/openclaw-runtime/win-x64/extensions/openclaw-weixin/src/cdn/cdn-upload.ts
var UPLOAD_MAX_RETRIES = 3;
async function uploadBufferToCdn(params) {
  const { buf, uploadParam, filekey, cdnBaseUrl, label, aeskey } = params;
  const ciphertext = encryptAesEcb(buf, aeskey);
  const cdnUrl = buildCdnUploadUrl({ cdnBaseUrl, uploadParam, filekey });
  logger.debug(`${label}: CDN POST url=${redactUrl(cdnUrl)} ciphertextSize=${ciphertext.length}`);
  let downloadParam;
  let lastError;
  for (let attempt = 1; attempt <= UPLOAD_MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(cdnUrl, {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: new Uint8Array(ciphertext)
      });
      if (res.status >= 400 && res.status < 500) {
        const errMsg = res.headers.get("x-error-message") ?? await res.text();
        logger.error(
          `${label}: CDN client error attempt=${attempt} status=${res.status} errMsg=${errMsg}`
        );
        throw new Error(`CDN upload client error ${res.status}: ${errMsg}`);
      }
      if (res.status !== 200) {
        const errMsg = res.headers.get("x-error-message") ?? `status ${res.status}`;
        logger.error(
          `${label}: CDN server error attempt=${attempt} status=${res.status} errMsg=${errMsg}`
        );
        throw new Error(`CDN upload server error: ${errMsg}`);
      }
      downloadParam = res.headers.get("x-encrypted-param") ?? void 0;
      if (!downloadParam) {
        logger.error(
          `${label}: CDN response missing x-encrypted-param header attempt=${attempt}`
        );
        throw new Error("CDN upload response missing x-encrypted-param header");
      }
      logger.debug(`${label}: CDN upload success attempt=${attempt}`);
      break;
    } catch (err) {
      lastError = err;
      if (err instanceof Error && err.message.includes("client error")) throw err;
      if (attempt < UPLOAD_MAX_RETRIES) {
        logger.error(`${label}: attempt ${attempt} failed, retrying... err=${String(err)}`);
      } else {
        logger.error(`${label}: all ${UPLOAD_MAX_RETRIES} attempts failed err=${String(err)}`);
      }
    }
  }
  if (!downloadParam) {
    throw lastError instanceof Error ? lastError : new Error(`CDN upload failed after ${UPLOAD_MAX_RETRIES} attempts`);
  }
  return { downloadParam };
}

// vendor/openclaw-runtime/win-x64/extensions/openclaw-weixin/src/media/mime.ts
import path6 from "path";
var EXTENSION_TO_MIME = {
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".txt": "text/plain",
  ".csv": "text/csv",
  ".zip": "application/zip",
  ".tar": "application/x-tar",
  ".gz": "application/gzip",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".mkv": "video/x-matroska",
  ".avi": "video/x-msvideo",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".bmp": "image/bmp"
};
var MIME_TO_EXTENSION = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "image/bmp": ".bmp",
  "video/mp4": ".mp4",
  "video/quicktime": ".mov",
  "video/webm": ".webm",
  "video/x-matroska": ".mkv",
  "video/x-msvideo": ".avi",
  "audio/mpeg": ".mp3",
  "audio/ogg": ".ogg",
  "audio/wav": ".wav",
  "application/pdf": ".pdf",
  "application/zip": ".zip",
  "application/x-tar": ".tar",
  "application/gzip": ".gz",
  "text/plain": ".txt",
  "text/csv": ".csv"
};
function getMimeFromFilename(filename) {
  const ext = path6.extname(filename).toLowerCase();
  return EXTENSION_TO_MIME[ext] ?? "application/octet-stream";
}
function getExtensionFromMime(mimeType) {
  const ct = mimeType.split(";")[0].trim().toLowerCase();
  return MIME_TO_EXTENSION[ct] ?? ".bin";
}
function getExtensionFromContentTypeOrUrl(contentType, url) {
  if (contentType) {
    const ext2 = getExtensionFromMime(contentType);
    if (ext2 !== ".bin") return ext2;
  }
  const ext = path6.extname(new URL(url).pathname).toLowerCase();
  const knownExts = new Set(Object.keys(EXTENSION_TO_MIME));
  return knownExts.has(ext) ? ext : ".bin";
}

// vendor/openclaw-runtime/win-x64/extensions/openclaw-weixin/src/cdn/upload.ts
async function downloadRemoteImageToTemp(url, destDir) {
  logger.debug(`downloadRemoteImageToTemp: fetching url=${url}`);
  const res = await fetch(url);
  if (!res.ok) {
    const msg = `remote media download failed: ${res.status} ${res.statusText} url=${url}`;
    logger.error(`downloadRemoteImageToTemp: ${msg}`);
    throw new Error(msg);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  logger.debug(`downloadRemoteImageToTemp: downloaded ${buf.length} bytes`);
  await fs5.mkdir(destDir, { recursive: true });
  const ext = getExtensionFromContentTypeOrUrl(res.headers.get("content-type"), url);
  const name = tempFileName("weixin-remote", ext);
  const filePath = path7.join(destDir, name);
  await fs5.writeFile(filePath, buf);
  logger.debug(`downloadRemoteImageToTemp: saved to ${filePath} ext=${ext}`);
  return filePath;
}
async function uploadMediaToCdn(params) {
  const { filePath, toUserId, opts, cdnBaseUrl, mediaType, label } = params;
  const plaintext = await fs5.readFile(filePath);
  const rawsize = plaintext.length;
  const rawfilemd5 = crypto3.createHash("md5").update(plaintext).digest("hex");
  const filesize = aesEcbPaddedSize(rawsize);
  const filekey = crypto3.randomBytes(16).toString("hex");
  const aeskey = crypto3.randomBytes(16);
  logger.debug(
    `${label}: file=${filePath} rawsize=${rawsize} filesize=${filesize} md5=${rawfilemd5} filekey=${filekey}`
  );
  const uploadUrlResp = await getUploadUrl({
    ...opts,
    filekey,
    media_type: mediaType,
    to_user_id: toUserId,
    rawsize,
    rawfilemd5,
    filesize,
    no_need_thumb: true,
    aeskey: aeskey.toString("hex")
  });
  const uploadParam = uploadUrlResp.upload_param;
  if (!uploadParam) {
    logger.error(
      `${label}: getUploadUrl returned no upload_param, resp=${JSON.stringify(uploadUrlResp)}`
    );
    throw new Error(`${label}: getUploadUrl returned no upload_param`);
  }
  const { downloadParam: downloadEncryptedQueryParam } = await uploadBufferToCdn({
    buf: plaintext,
    uploadParam,
    filekey,
    cdnBaseUrl,
    aeskey,
    label: `${label}[orig filekey=${filekey}]`
  });
  return {
    filekey,
    downloadEncryptedQueryParam,
    aeskey: aeskey.toString("hex"),
    fileSize: rawsize,
    fileSizeCiphertext: filesize
  };
}
async function uploadFileToWeixin(params) {
  return uploadMediaToCdn({
    ...params,
    mediaType: UploadMediaType.IMAGE,
    label: "uploadFileToWeixin"
  });
}
async function uploadVideoToWeixin(params) {
  return uploadMediaToCdn({
    ...params,
    mediaType: UploadMediaType.VIDEO,
    label: "uploadVideoToWeixin"
  });
}
async function uploadFileAttachmentToWeixin(params) {
  return uploadMediaToCdn({
    ...params,
    mediaType: UploadMediaType.FILE,
    label: "uploadFileAttachmentToWeixin"
  });
}

// vendor/openclaw-runtime/win-x64/extensions/openclaw-weixin/src/cdn/pic-decrypt.ts
async function fetchCdnBytes(url, label) {
  let res;
  try {
    res = await fetch(url);
  } catch (err) {
    const cause = err.cause ?? err.code ?? "(no cause)";
    logger.error(
      `${label}: fetch network error url=${url} err=${String(err)} cause=${String(cause)}`
    );
    throw err;
  }
  logger.debug(`${label}: response status=${res.status} ok=${res.ok}`);
  if (!res.ok) {
    const body = await res.text().catch(() => "(unreadable)");
    const msg = `${label}: CDN download ${res.status} ${res.statusText} body=${body}`;
    logger.error(msg);
    throw new Error(msg);
  }
  return Buffer.from(await res.arrayBuffer());
}
function parseAesKey(aesKeyBase64, label) {
  const decoded = Buffer.from(aesKeyBase64, "base64");
  if (decoded.length === 16) {
    return decoded;
  }
  if (decoded.length === 32 && /^[0-9a-fA-F]{32}$/.test(decoded.toString("ascii"))) {
    return Buffer.from(decoded.toString("ascii"), "hex");
  }
  const msg = `${label}: aes_key must decode to 16 raw bytes or 32-char hex string, got ${decoded.length} bytes (base64="${aesKeyBase64}")`;
  logger.error(msg);
  throw new Error(msg);
}
async function downloadAndDecryptBuffer(encryptedQueryParam, aesKeyBase64, cdnBaseUrl, label) {
  const key = parseAesKey(aesKeyBase64, label);
  const url = buildCdnDownloadUrl(encryptedQueryParam, cdnBaseUrl);
  logger.debug(`${label}: fetching url=${url}`);
  const encrypted = await fetchCdnBytes(url, label);
  logger.debug(`${label}: downloaded ${encrypted.byteLength} bytes, decrypting`);
  const decrypted = decryptAesEcb(encrypted, key);
  logger.debug(`${label}: decrypted ${decrypted.length} bytes`);
  return decrypted;
}
async function downloadPlainCdnBuffer(encryptedQueryParam, cdnBaseUrl, label) {
  const url = buildCdnDownloadUrl(encryptedQueryParam, cdnBaseUrl);
  logger.debug(`${label}: fetching url=${url}`);
  return fetchCdnBytes(url, label);
}

// vendor/openclaw-runtime/win-x64/extensions/openclaw-weixin/src/media/silk-transcode.ts
var SILK_SAMPLE_RATE = 24e3;
function pcmBytesToWav(pcm, sampleRate) {
  const pcmBytes = pcm.byteLength;
  const totalSize = 44 + pcmBytes;
  const buf = Buffer.allocUnsafe(totalSize);
  let offset = 0;
  buf.write("RIFF", offset);
  offset += 4;
  buf.writeUInt32LE(totalSize - 8, offset);
  offset += 4;
  buf.write("WAVE", offset);
  offset += 4;
  buf.write("fmt ", offset);
  offset += 4;
  buf.writeUInt32LE(16, offset);
  offset += 4;
  buf.writeUInt16LE(1, offset);
  offset += 2;
  buf.writeUInt16LE(1, offset);
  offset += 2;
  buf.writeUInt32LE(sampleRate, offset);
  offset += 4;
  buf.writeUInt32LE(sampleRate * 2, offset);
  offset += 4;
  buf.writeUInt16LE(2, offset);
  offset += 2;
  buf.writeUInt16LE(16, offset);
  offset += 2;
  buf.write("data", offset);
  offset += 4;
  buf.writeUInt32LE(pcmBytes, offset);
  offset += 4;
  Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength).copy(buf, offset);
  return buf;
}
async function silkToWav(silkBuf) {
  try {
    const { decode } = await import("silk-wasm");
    logger.debug(`silkToWav: decoding ${silkBuf.length} bytes of SILK`);
    const result = await decode(silkBuf, SILK_SAMPLE_RATE);
    logger.debug(
      `silkToWav: decoded duration=${result.duration}ms pcmBytes=${result.data.byteLength}`
    );
    const wav = pcmBytesToWav(result.data, SILK_SAMPLE_RATE);
    logger.debug(`silkToWav: WAV size=${wav.length}`);
    return wav;
  } catch (err) {
    logger.warn(`silkToWav: transcode failed, will use raw silk err=${String(err)}`);
    return null;
  }
}

// vendor/openclaw-runtime/win-x64/extensions/openclaw-weixin/src/media/media-download.ts
var WEIXIN_MEDIA_MAX_BYTES = 100 * 1024 * 1024;
async function downloadMediaFromItem(item, deps) {
  const { cdnBaseUrl, saveMedia, log, errLog, label } = deps;
  const result = {};
  if (item.type === MessageItemType.IMAGE) {
    const img = item.image_item;
    if (!img?.media?.encrypt_query_param) return result;
    const aesKeyBase64 = img.aeskey ? Buffer.from(img.aeskey, "hex").toString("base64") : img.media.aes_key;
    logger.debug(
      `${label} image: encrypt_query_param=${img.media.encrypt_query_param.slice(0, 40)}... hasAesKey=${Boolean(aesKeyBase64)} aeskeySource=${img.aeskey ? "image_item.aeskey" : "media.aes_key"}`
    );
    try {
      const buf = aesKeyBase64 ? await downloadAndDecryptBuffer(
        img.media.encrypt_query_param,
        aesKeyBase64,
        cdnBaseUrl,
        `${label} image`
      ) : await downloadPlainCdnBuffer(
        img.media.encrypt_query_param,
        cdnBaseUrl,
        `${label} image-plain`
      );
      const saved = await saveMedia(buf, void 0, "inbound", WEIXIN_MEDIA_MAX_BYTES);
      result.decryptedPicPath = saved.path;
      logger.debug(`${label} image saved: ${saved.path}`);
    } catch (err) {
      logger.error(`${label} image download/decrypt failed: ${String(err)}`);
      errLog(`weixin ${label} image download/decrypt failed: ${String(err)}`);
    }
  } else if (item.type === MessageItemType.VOICE) {
    const voice = item.voice_item;
    if (!voice?.media?.encrypt_query_param || !voice.media.aes_key) return result;
    try {
      const silkBuf = await downloadAndDecryptBuffer(
        voice.media.encrypt_query_param,
        voice.media.aes_key,
        cdnBaseUrl,
        `${label} voice`
      );
      logger.debug(`${label} voice: decrypted ${silkBuf.length} bytes, attempting silk transcode`);
      const wavBuf = await silkToWav(silkBuf);
      if (wavBuf) {
        const saved = await saveMedia(wavBuf, "audio/wav", "inbound", WEIXIN_MEDIA_MAX_BYTES);
        result.decryptedVoicePath = saved.path;
        result.voiceMediaType = "audio/wav";
        logger.debug(`${label} voice: saved WAV to ${saved.path}`);
      } else {
        const saved = await saveMedia(silkBuf, "audio/silk", "inbound", WEIXIN_MEDIA_MAX_BYTES);
        result.decryptedVoicePath = saved.path;
        result.voiceMediaType = "audio/silk";
        logger.debug(`${label} voice: silk transcode unavailable, saved raw SILK to ${saved.path}`);
      }
    } catch (err) {
      logger.error(`${label} voice download/transcode failed: ${String(err)}`);
      errLog(`weixin ${label} voice download/transcode failed: ${String(err)}`);
    }
  } else if (item.type === MessageItemType.FILE) {
    const fileItem = item.file_item;
    if (!fileItem?.media?.encrypt_query_param || !fileItem.media.aes_key) return result;
    try {
      const buf = await downloadAndDecryptBuffer(
        fileItem.media.encrypt_query_param,
        fileItem.media.aes_key,
        cdnBaseUrl,
        `${label} file`
      );
      const mime = getMimeFromFilename(fileItem.file_name ?? "file.bin");
      const saved = await saveMedia(
        buf,
        mime,
        "inbound",
        WEIXIN_MEDIA_MAX_BYTES,
        fileItem.file_name ?? void 0
      );
      result.decryptedFilePath = saved.path;
      result.fileMediaType = mime;
      logger.debug(`${label} file: saved to ${saved.path} mime=${mime}`);
    } catch (err) {
      logger.error(`${label} file download failed: ${String(err)}`);
      errLog(`weixin ${label} file download failed: ${String(err)}`);
    }
  } else if (item.type === MessageItemType.VIDEO) {
    const videoItem = item.video_item;
    if (!videoItem?.media?.encrypt_query_param || !videoItem.media.aes_key) return result;
    try {
      const buf = await downloadAndDecryptBuffer(
        videoItem.media.encrypt_query_param,
        videoItem.media.aes_key,
        cdnBaseUrl,
        `${label} video`
      );
      const saved = await saveMedia(buf, "video/mp4", "inbound", WEIXIN_MEDIA_MAX_BYTES);
      result.decryptedVideoPath = saved.path;
      logger.debug(`${label} video: saved to ${saved.path}`);
    } catch (err) {
      logger.error(`${label} video download failed: ${String(err)}`);
      errLog(`weixin ${label} video download failed: ${String(err)}`);
    }
  }
  return result;
}

// vendor/openclaw-runtime/win-x64/extensions/openclaw-weixin/src/messaging/debug-mode.ts
import fs6 from "fs";
import path8 from "path";
function resolveDebugModePath() {
  return path8.join(resolveStateDir(), "openclaw-weixin", "debug-mode.json");
}
function loadState() {
  try {
    const raw = fs6.readFileSync(resolveDebugModePath(), "utf-8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.accounts === "object") return parsed;
  } catch {
  }
  return { accounts: {} };
}
function saveState(state) {
  const filePath = resolveDebugModePath();
  fs6.mkdirSync(path8.dirname(filePath), { recursive: true });
  fs6.writeFileSync(filePath, JSON.stringify(state, null, 2), "utf-8");
}
function toggleDebugMode(accountId) {
  const state = loadState();
  const next = !state.accounts[accountId];
  state.accounts[accountId] = next;
  try {
    saveState(state);
  } catch (err) {
    logger.error(`debug-mode: failed to persist state: ${String(err)}`);
  }
  return next;
}
function isDebugMode(accountId) {
  return loadState().accounts[accountId] === true;
}

// vendor/openclaw-runtime/win-x64/extensions/openclaw-weixin/src/messaging/send.ts
import { stripMarkdown } from "openclaw/plugin-sdk";
function generateClientId() {
  return generateId("openclaw-weixin");
}
function markdownToPlainText(text) {
  let result = text;
  result = result.replace(/```[^\n]*\n?([\s\S]*?)```/g, (_, code) => code.trim());
  result = result.replace(/!\[[^\]]*\]\([^)]*\)/g, "");
  result = result.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
  result = result.replace(/^\|[\s:|-]+\|$/gm, "");
  result = result.replace(
    /^\|(.+)\|$/gm,
    (_, inner) => inner.split("|").map((cell) => cell.trim()).join("  ")
  );
  result = stripMarkdown(result);
  return result;
}
function buildTextMessageReq(params) {
  const { to, text, contextToken, clientId } = params;
  const item_list = text ? [{ type: MessageItemType.TEXT, text_item: { text } }] : [];
  return {
    msg: {
      from_user_id: "",
      to_user_id: to,
      client_id: clientId,
      message_type: MessageType.BOT,
      message_state: MessageState.FINISH,
      item_list: item_list.length ? item_list : void 0,
      context_token: contextToken ?? void 0
    }
  };
}
function buildSendMessageReq(params) {
  const { to, contextToken, payload, clientId } = params;
  return buildTextMessageReq({
    to,
    text: payload.text ?? "",
    contextToken,
    clientId
  });
}
async function sendMessageWeixin(params) {
  const { to, text, opts } = params;
  if (!opts.contextToken) {
    logger.error(`sendMessageWeixin: contextToken missing, refusing to send to=${to}`);
    throw new Error("sendMessageWeixin: contextToken is required");
  }
  const clientId = generateClientId();
  const req = buildSendMessageReq({
    to,
    contextToken: opts.contextToken,
    payload: { text },
    clientId
  });
  try {
    await sendMessage({
      baseUrl: opts.baseUrl,
      token: opts.token,
      timeoutMs: opts.timeoutMs,
      body: req
    });
  } catch (err) {
    logger.error(`sendMessageWeixin: failed to=${to} clientId=${clientId} err=${String(err)}`);
    throw err;
  }
  return { messageId: clientId };
}
async function sendMediaItems(params) {
  const { to, text, mediaItem, opts, label } = params;
  const items = [];
  if (text) {
    items.push({ type: MessageItemType.TEXT, text_item: { text } });
  }
  items.push(mediaItem);
  let lastClientId = "";
  for (const item of items) {
    lastClientId = generateClientId();
    const req = {
      msg: {
        from_user_id: "",
        to_user_id: to,
        client_id: lastClientId,
        message_type: MessageType.BOT,
        message_state: MessageState.FINISH,
        item_list: [item],
        context_token: opts.contextToken ?? void 0
      }
    };
    try {
      await sendMessage({
        baseUrl: opts.baseUrl,
        token: opts.token,
        timeoutMs: opts.timeoutMs,
        body: req
      });
    } catch (err) {
      logger.error(
        `${label}: failed to=${to} clientId=${lastClientId} err=${String(err)}`
      );
      throw err;
    }
  }
  logger.debug(`${label}: success to=${to} clientId=${lastClientId}`);
  return { messageId: lastClientId };
}
async function sendImageMessageWeixin(params) {
  const { to, text, uploaded, opts } = params;
  if (!opts.contextToken) {
    logger.error(`sendImageMessageWeixin: contextToken missing, refusing to send to=${to}`);
    throw new Error("sendImageMessageWeixin: contextToken is required");
  }
  logger.debug(
    `sendImageMessageWeixin: to=${to} filekey=${uploaded.filekey} fileSize=${uploaded.fileSize} aeskey=present`
  );
  const imageItem = {
    type: MessageItemType.IMAGE,
    image_item: {
      media: {
        encrypt_query_param: uploaded.downloadEncryptedQueryParam,
        aes_key: Buffer.from(uploaded.aeskey).toString("base64"),
        encrypt_type: 1
      },
      mid_size: uploaded.fileSizeCiphertext
    }
  };
  return sendMediaItems({ to, text, mediaItem: imageItem, opts, label: "sendImageMessageWeixin" });
}
async function sendVideoMessageWeixin(params) {
  const { to, text, uploaded, opts } = params;
  if (!opts.contextToken) {
    logger.error(`sendVideoMessageWeixin: contextToken missing, refusing to send to=${to}`);
    throw new Error("sendVideoMessageWeixin: contextToken is required");
  }
  const videoItem = {
    type: MessageItemType.VIDEO,
    video_item: {
      media: {
        encrypt_query_param: uploaded.downloadEncryptedQueryParam,
        aes_key: Buffer.from(uploaded.aeskey).toString("base64"),
        encrypt_type: 1
      },
      video_size: uploaded.fileSizeCiphertext
    }
  };
  return sendMediaItems({ to, text, mediaItem: videoItem, opts, label: "sendVideoMessageWeixin" });
}
async function sendFileMessageWeixin(params) {
  const { to, text, fileName, uploaded, opts } = params;
  if (!opts.contextToken) {
    logger.error(`sendFileMessageWeixin: contextToken missing, refusing to send to=${to}`);
    throw new Error("sendFileMessageWeixin: contextToken is required");
  }
  const fileItem = {
    type: MessageItemType.FILE,
    file_item: {
      media: {
        encrypt_query_param: uploaded.downloadEncryptedQueryParam,
        aes_key: Buffer.from(uploaded.aeskey).toString("base64"),
        encrypt_type: 1
      },
      file_name: fileName,
      len: String(uploaded.fileSize)
    }
  };
  return sendMediaItems({ to, text, mediaItem: fileItem, opts, label: "sendFileMessageWeixin" });
}

// vendor/openclaw-runtime/win-x64/extensions/openclaw-weixin/src/messaging/error-notice.ts
async function sendWeixinErrorNotice(params) {
  if (!params.contextToken) {
    logger.warn(`sendWeixinErrorNotice: no contextToken for to=${params.to}, cannot notify user`);
    return;
  }
  try {
    await sendMessageWeixin({ to: params.to, text: params.message, opts: {
      baseUrl: params.baseUrl,
      token: params.token,
      contextToken: params.contextToken
    } });
    logger.debug(`sendWeixinErrorNotice: sent to=${params.to}`);
  } catch (err) {
    params.errLog(`[weixin] sendWeixinErrorNotice failed to=${params.to}: ${String(err)}`);
  }
}

// vendor/openclaw-runtime/win-x64/extensions/openclaw-weixin/src/messaging/send-media.ts
import path9 from "path";
async function sendWeixinMediaFile(params) {
  const { filePath, to, text, opts, cdnBaseUrl } = params;
  const mime = getMimeFromFilename(filePath);
  const uploadOpts = { baseUrl: opts.baseUrl, token: opts.token };
  if (mime.startsWith("video/")) {
    logger.info(`[weixin] sendWeixinMediaFile: uploading video filePath=${filePath} to=${to}`);
    const uploaded2 = await uploadVideoToWeixin({
      filePath,
      toUserId: to,
      opts: uploadOpts,
      cdnBaseUrl
    });
    logger.info(
      `[weixin] sendWeixinMediaFile: video upload done filekey=${uploaded2.filekey} size=${uploaded2.fileSize}`
    );
    return sendVideoMessageWeixin({ to, text, uploaded: uploaded2, opts });
  }
  if (mime.startsWith("image/")) {
    logger.info(`[weixin] sendWeixinMediaFile: uploading image filePath=${filePath} to=${to}`);
    const uploaded2 = await uploadFileToWeixin({
      filePath,
      toUserId: to,
      opts: uploadOpts,
      cdnBaseUrl
    });
    logger.info(
      `[weixin] sendWeixinMediaFile: image upload done filekey=${uploaded2.filekey} size=${uploaded2.fileSize}`
    );
    return sendImageMessageWeixin({ to, text, uploaded: uploaded2, opts });
  }
  const fileName = path9.basename(filePath);
  logger.info(
    `[weixin] sendWeixinMediaFile: uploading file attachment filePath=${filePath} name=${fileName} to=${to}`
  );
  const uploaded = await uploadFileAttachmentToWeixin({
    filePath,
    fileName,
    toUserId: to,
    opts: uploadOpts,
    cdnBaseUrl
  });
  logger.info(
    `[weixin] sendWeixinMediaFile: file upload done filekey=${uploaded.filekey} size=${uploaded.fileSize}`
  );
  return sendFileMessageWeixin({ to, text, fileName, uploaded, opts });
}

// vendor/openclaw-runtime/win-x64/extensions/openclaw-weixin/src/messaging/slash-commands.ts
async function sendReply(ctx, text) {
  const opts = {
    baseUrl: ctx.baseUrl,
    token: ctx.token,
    contextToken: ctx.contextToken
  };
  await sendMessageWeixin({ to: ctx.to, text, opts });
}
async function handleEcho(ctx, args, receivedAt, eventTimestamp) {
  const message = args.trim();
  if (message) {
    await sendReply(ctx, message);
  }
  const eventTs = eventTimestamp ?? 0;
  const platformDelay = eventTs > 0 ? `${receivedAt - eventTs}ms` : "N/A";
  const timing = [
    "\u23F1 \u901A\u9053\u8017\u65F6",
    `\u251C \u4E8B\u4EF6\u65F6\u95F4: ${eventTs > 0 ? new Date(eventTs).toISOString() : "N/A"}`,
    `\u251C \u5E73\u53F0\u2192\u63D2\u4EF6: ${platformDelay}`,
    `\u2514 \u63D2\u4EF6\u5904\u7406: ${Date.now() - receivedAt}ms`
  ].join("\n");
  await sendReply(ctx, timing);
}
async function handleSlashCommand(content, ctx, receivedAt, eventTimestamp) {
  const trimmed = content.trim();
  if (!trimmed.startsWith("/")) {
    return { handled: false };
  }
  const spaceIdx = trimmed.indexOf(" ");
  const command = spaceIdx === -1 ? trimmed.toLowerCase() : trimmed.slice(0, spaceIdx).toLowerCase();
  const args = spaceIdx === -1 ? "" : trimmed.slice(spaceIdx + 1);
  logger.info(`[weixin] Slash command: ${command}, args: ${args.slice(0, 50)}`);
  try {
    switch (command) {
      case "/echo":
        await handleEcho(ctx, args, receivedAt, eventTimestamp);
        return { handled: true };
      case "/toggle-debug": {
        const enabled = toggleDebugMode(ctx.accountId);
        await sendReply(
          ctx,
          enabled ? "Debug \u6A21\u5F0F\u5DF2\u5F00\u542F" : "Debug \u6A21\u5F0F\u5DF2\u5173\u95ED"
        );
        return { handled: true };
      }
      default:
        return { handled: false };
    }
  } catch (err) {
    logger.error(`[weixin] Slash command error: ${String(err)}`);
    try {
      await sendReply(ctx, `\u274C \u6307\u4EE4\u6267\u884C\u5931\u8D25: ${String(err).slice(0, 200)}`);
    } catch {
    }
    return { handled: true };
  }
}

// vendor/openclaw-runtime/win-x64/extensions/openclaw-weixin/src/messaging/process-message.ts
var MEDIA_OUTBOUND_TEMP_DIR = path10.join(resolvePreferredOpenClawTmpDir(), "weixin/media/outbound-temp");
function extractTextBody(itemList) {
  if (!itemList?.length) return "";
  for (const item of itemList) {
    if (item.type === MessageItemType.TEXT && item.text_item?.text != null) {
      return String(item.text_item.text);
    }
  }
  return "";
}
async function processOneMessage(full, deps) {
  if (!deps?.channelRuntime) {
    logger.error(
      `processOneMessage: channelRuntime is undefined, skipping message from=${full.from_user_id}`
    );
    deps.errLog("processOneMessage: channelRuntime is undefined, skip");
    return;
  }
  const receivedAt = Date.now();
  const debug = isDebugMode(deps.accountId);
  const debugTrace = [];
  const debugTs = { received: receivedAt };
  const textBody = extractTextBody(full.item_list);
  if (textBody.startsWith("/")) {
    const slashResult = await handleSlashCommand(textBody, {
      to: full.from_user_id ?? "",
      contextToken: full.context_token,
      baseUrl: deps.baseUrl,
      token: deps.token,
      accountId: deps.accountId,
      log: deps.log,
      errLog: deps.errLog
    }, receivedAt, full.create_time_ms);
    if (slashResult.handled) {
      logger.info(`[weixin] Slash command handled, skipping AI pipeline`);
      return;
    }
  }
  if (debug) {
    const itemTypes = full.item_list?.map((i) => i.type).join(",") ?? "none";
    debugTrace.push(
      "\u2500\u2500 \u6536\u6D88\u606F \u2500\u2500",
      `\u2502 seq=${full.seq ?? "?"} msgId=${full.message_id ?? "?"} from=${full.from_user_id ?? "?"}`,
      `\u2502 body="${textBody.slice(0, 40)}${textBody.length > 40 ? "\u2026" : ""}" (len=${textBody.length}) itemTypes=[${itemTypes}]`,
      `\u2502 sessionId=${full.session_id ?? "?"} contextToken=${full.context_token ? "present" : "none"}`
    );
  }
  const mediaOpts = {};
  const mainMediaItem = full.item_list?.find(
    (i) => i.type === MessageItemType.IMAGE && i.image_item?.media?.encrypt_query_param
  ) ?? full.item_list?.find(
    (i) => i.type === MessageItemType.VIDEO && i.video_item?.media?.encrypt_query_param
  ) ?? full.item_list?.find(
    (i) => i.type === MessageItemType.FILE && i.file_item?.media?.encrypt_query_param
  ) ?? full.item_list?.find(
    (i) => i.type === MessageItemType.VOICE && i.voice_item?.media?.encrypt_query_param && !i.voice_item.text
  );
  const refMediaItem = !mainMediaItem ? full.item_list?.find(
    (i) => i.type === MessageItemType.TEXT && i.ref_msg?.message_item && isMediaItem(i.ref_msg.message_item)
  )?.ref_msg?.message_item : void 0;
  const mediaDownloadStart = Date.now();
  const mediaItem = mainMediaItem ?? refMediaItem;
  if (mediaItem) {
    const label = refMediaItem ? "ref" : "inbound";
    const downloaded = await downloadMediaFromItem(mediaItem, {
      cdnBaseUrl: deps.cdnBaseUrl,
      saveMedia: deps.channelRuntime.media.saveMediaBuffer,
      log: deps.log,
      errLog: deps.errLog,
      label
    });
    Object.assign(mediaOpts, downloaded);
  }
  const mediaDownloadMs = Date.now() - mediaDownloadStart;
  if (debug) {
    debugTrace.push(
      mediaItem ? `\u2502 mediaDownload: type=${mediaItem.type} cost=${mediaDownloadMs}ms` : "\u2502 mediaDownload: none"
    );
  }
  const ctx = weixinMessageToMsgContext(full, deps.accountId, mediaOpts);
  const rawBody = ctx.Body?.trim() ?? "";
  ctx.CommandBody = rawBody;
  const senderId = full.from_user_id ?? "";
  const { senderAllowedForCommands, commandAuthorized } = await resolveSenderCommandAuthorizationWithRuntime({
    cfg: deps.config,
    rawBody,
    isGroup: false,
    dmPolicy: "pairing",
    configuredAllowFrom: [],
    configuredGroupAllowFrom: [],
    senderId,
    isSenderAllowed: (id, list) => list.length === 0 || list.includes(id),
    /** Pairing: framework credentials `*-allowFrom.json`, with account `userId` fallback for legacy installs. */
    readAllowFromStore: async () => {
      const fromStore = readFrameworkAllowFromList(deps.accountId);
      if (fromStore.length > 0) return fromStore;
      const uid = loadWeixinAccount(deps.accountId)?.userId?.trim();
      return uid ? [uid] : [];
    },
    runtime: deps.channelRuntime.commands
  });
  const directDmOutcome = resolveDirectDmAuthorizationOutcome({
    isGroup: false,
    dmPolicy: "pairing",
    senderAllowedForCommands
  });
  if (directDmOutcome === "disabled" || directDmOutcome === "unauthorized") {
    logger.info(
      `authorization: dropping message from=${senderId} outcome=${directDmOutcome}`
    );
    return;
  }
  ctx.CommandAuthorized = commandAuthorized;
  logger.debug(
    `authorization: senderId=${senderId} commandAuthorized=${String(commandAuthorized)} senderAllowed=${String(senderAllowedForCommands)}`
  );
  if (debug) {
    debugTrace.push(
      "\u2500\u2500 \u9274\u6743 & \u8DEF\u7531 \u2500\u2500",
      `\u2502 auth: cmdAuthorized=${String(commandAuthorized)} senderAllowed=${String(senderAllowedForCommands)}`
    );
  }
  const route = deps.channelRuntime.routing.resolveAgentRoute({
    cfg: deps.config,
    channel: "openclaw-weixin",
    accountId: deps.accountId,
    peer: { kind: "direct", id: ctx.To }
  });
  logger.debug(
    `resolveAgentRoute: agentId=${route.agentId ?? "(none)"} sessionKey=${route.sessionKey ?? "(none)"} mainSessionKey=${route.mainSessionKey ?? "(none)"}`
  );
  if (!route.agentId) {
    logger.error(
      `resolveAgentRoute: no agentId resolved for peer=${ctx.To} accountId=${deps.accountId} \u2014 message will not be dispatched`
    );
  }
  if (debug) {
    debugTrace.push(
      `\u2502 route: agent=${route.agentId ?? "none"} session=${route.sessionKey ?? "none"}`
    );
    debugTs.preDispatch = Date.now();
  }
  ctx.SessionKey = route.sessionKey;
  const storePath = deps.channelRuntime.session.resolveStorePath(deps.config.session?.store, {
    agentId: route.agentId
  });
  const finalized = deps.channelRuntime.reply.finalizeInboundContext(
    ctx
  );
  logger.info(
    `inbound: from=${finalized.From} to=${finalized.To} bodyLen=${(finalized.Body ?? "").length} hasMedia=${Boolean(finalized.MediaPath ?? finalized.MediaUrl)}`
  );
  logger.debug(`inbound context: ${redactBody(JSON.stringify(finalized))}`);
  await deps.channelRuntime.session.recordInboundSession({
    storePath,
    sessionKey: route.sessionKey,
    ctx: finalized,
    updateLastRoute: {
      sessionKey: route.mainSessionKey,
      channel: "openclaw-weixin",
      to: ctx.To,
      accountId: deps.accountId
    },
    onRecordError: (err) => deps.errLog(`recordInboundSession: ${String(err)}`)
  });
  logger.debug(
    `recordInboundSession: done storePath=${storePath} sessionKey=${route.sessionKey ?? "(none)"}`
  );
  const contextToken = getContextTokenFromMsgContext(ctx);
  if (contextToken) {
    setContextToken(deps.accountId, full.from_user_id ?? "", contextToken);
  }
  const humanDelay = deps.channelRuntime.reply.resolveHumanDelayConfig(deps.config, route.agentId);
  const hasTypingTicket = Boolean(deps.typingTicket);
  const typingCallbacks = createTypingCallbacks({
    start: hasTypingTicket ? () => sendTyping({
      baseUrl: deps.baseUrl,
      token: deps.token,
      body: {
        ilink_user_id: ctx.To,
        typing_ticket: deps.typingTicket,
        status: TypingStatus.TYPING
      }
    }) : async () => {
    },
    stop: hasTypingTicket ? () => sendTyping({
      baseUrl: deps.baseUrl,
      token: deps.token,
      body: {
        ilink_user_id: ctx.To,
        typing_ticket: deps.typingTicket,
        status: TypingStatus.CANCEL
      }
    }) : async () => {
    },
    onStartError: (err) => deps.log(`[weixin] typing send error: ${String(err)}`),
    onStopError: (err) => deps.log(`[weixin] typing cancel error: ${String(err)}`),
    keepaliveIntervalMs: 5e3
  });
  const debugDeliveries = [];
  const { dispatcher, replyOptions, markDispatchIdle } = deps.channelRuntime.reply.createReplyDispatcherWithTyping({
    humanDelay,
    typingCallbacks,
    deliver: async (payload) => {
      const text = markdownToPlainText(payload.text ?? "");
      const mediaUrl = payload.mediaUrl ?? payload.mediaUrls?.[0];
      logger.debug(`outbound payload: ${redactBody(JSON.stringify(payload))}`);
      logger.info(
        `outbound: to=${ctx.To} contextToken=${redactToken(contextToken)} textLen=${text.length} mediaUrl=${mediaUrl ? "present" : "none"}`
      );
      if (debug) {
        debugDeliveries.push({
          textLen: text.length,
          media: mediaUrl ? "present" : "none",
          preview: `${text.slice(0, 60)}${text.length > 60 ? "\u2026" : ""}`,
          ts: Date.now()
        });
      }
      try {
        if (mediaUrl) {
          let filePath;
          if (!mediaUrl.includes("://") || mediaUrl.startsWith("file://")) {
            if (mediaUrl.startsWith("file://")) {
              filePath = new URL(mediaUrl).pathname;
            } else if (!path10.isAbsolute(mediaUrl)) {
              filePath = path10.resolve(mediaUrl);
              logger.debug(`outbound: resolved relative path ${mediaUrl} -> ${filePath}`);
            } else {
              filePath = mediaUrl;
            }
            logger.debug(`outbound: local file path resolved filePath=${filePath}`);
          } else if (mediaUrl.startsWith("http://") || mediaUrl.startsWith("https://")) {
            logger.debug(`outbound: downloading remote mediaUrl=${mediaUrl.slice(0, 80)}...`);
            filePath = await downloadRemoteImageToTemp(mediaUrl, MEDIA_OUTBOUND_TEMP_DIR);
            logger.debug(`outbound: remote image downloaded to filePath=${filePath}`);
          } else {
            logger.warn(
              `outbound: unrecognized mediaUrl scheme, sending text only mediaUrl=${mediaUrl.slice(0, 80)}`
            );
            await sendMessageWeixin({ to: ctx.To, text, opts: {
              baseUrl: deps.baseUrl,
              token: deps.token,
              contextToken
            } });
            logger.info(`outbound: text sent to=${ctx.To}`);
            return;
          }
          await sendWeixinMediaFile({
            filePath,
            to: ctx.To,
            text,
            opts: { baseUrl: deps.baseUrl, token: deps.token, contextToken },
            cdnBaseUrl: deps.cdnBaseUrl
          });
          logger.info(`outbound: media sent OK to=${ctx.To}`);
        } else {
          logger.debug(`outbound: sending text message to=${ctx.To}`);
          await sendMessageWeixin({ to: ctx.To, text, opts: {
            baseUrl: deps.baseUrl,
            token: deps.token,
            contextToken
          } });
          logger.info(`outbound: text sent OK to=${ctx.To}`);
        }
      } catch (err) {
        logger.error(
          `outbound: FAILED to=${ctx.To} mediaUrl=${mediaUrl ?? "none"} err=${String(err)} stack=${err.stack ?? ""}`
        );
        throw err;
      }
    },
    onError: (err, info) => {
      deps.errLog(`weixin reply ${info.kind}: ${String(err)}`);
      const errMsg = err instanceof Error ? err.message : String(err);
      let notice;
      if (errMsg.includes("contextToken is required")) {
        logger.warn(`onError: contextToken missing, cannot send error notice to=${ctx.To}`);
        return;
      } else if (errMsg.includes("remote media download failed") || errMsg.includes("fetch")) {
        notice = `\u26A0\uFE0F \u5A92\u4F53\u6587\u4EF6\u4E0B\u8F7D\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u94FE\u63A5\u662F\u5426\u53EF\u8BBF\u95EE\u3002`;
      } else if (errMsg.includes("getUploadUrl") || errMsg.includes("CDN upload") || errMsg.includes("upload_param")) {
        notice = `\u26A0\uFE0F \u5A92\u4F53\u6587\u4EF6\u4E0A\u4F20\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002`;
      } else {
        notice = `\u26A0\uFE0F \u6D88\u606F\u53D1\u9001\u5931\u8D25\uFF1A${errMsg}`;
      }
      void sendWeixinErrorNotice({
        to: ctx.To,
        contextToken,
        message: notice,
        baseUrl: deps.baseUrl,
        token: deps.token,
        errLog: deps.errLog
      });
    }
  });
  logger.debug(`dispatchReplyFromConfig: starting agentId=${route.agentId ?? "(none)"}`);
  try {
    await deps.channelRuntime.reply.withReplyDispatcher({
      dispatcher,
      run: () => deps.channelRuntime.reply.dispatchReplyFromConfig({
        ctx: finalized,
        cfg: deps.config,
        dispatcher,
        replyOptions
      })
    });
    logger.debug(`dispatchReplyFromConfig: done agentId=${route.agentId ?? "(none)"}`);
  } catch (err) {
    logger.error(
      `dispatchReplyFromConfig: error agentId=${route.agentId ?? "(none)"} err=${String(err)}`
    );
    throw err;
  } finally {
    markDispatchIdle();
    logger.info(
      `debug-check: accountId=${deps.accountId} debug=${String(debug)} hasContextToken=${Boolean(contextToken)} stateDir=${process.env.OPENCLAW_STATE_DIR ?? "(unset)"}`
    );
    if (debug && contextToken) {
      const dispatchDoneAt = Date.now();
      const eventTs = full.create_time_ms ?? 0;
      const platformDelay = eventTs > 0 ? `${receivedAt - eventTs}ms` : "N/A";
      const inboundProcessMs = (debugTs.preDispatch ?? receivedAt) - receivedAt;
      const aiMs = dispatchDoneAt - (debugTs.preDispatch ?? receivedAt);
      const totalTime = eventTs > 0 ? `${dispatchDoneAt - eventTs}ms` : `${dispatchDoneAt - receivedAt}ms`;
      if (debugDeliveries.length > 0) {
        debugTrace.push("\u2500\u2500 \u56DE\u590D \u2500\u2500");
        for (const d of debugDeliveries) {
          debugTrace.push(
            `\u2502 textLen=${d.textLen} media=${d.media}`,
            `\u2502 text="${d.preview}"`
          );
        }
        const firstTs = debugDeliveries[0].ts;
        debugTrace.push(`\u2502 deliver\u8017\u65F6: ${dispatchDoneAt - firstTs}ms`);
      } else {
        debugTrace.push("\u2500\u2500 \u56DE\u590D \u2500\u2500", "\u2502 (deliver\u672A\u6355\u83B7)");
      }
      debugTrace.push(
        "\u2500\u2500 \u8017\u65F6 \u2500\u2500",
        `\u251C \u5E73\u53F0\u2192\u63D2\u4EF6: ${platformDelay}`,
        `\u251C \u5165\u7AD9\u5904\u7406(auth+route+media): ${inboundProcessMs}ms (mediaDownload: ${mediaDownloadMs}ms)`,
        `\u251C AI\u751F\u6210+\u56DE\u590D: ${aiMs}ms`,
        `\u251C \u603B\u8017\u65F6: ${totalTime}`,
        `\u2514 eventTime: ${eventTs > 0 ? new Date(eventTs).toISOString() : "N/A"}`
      );
      const timingText = `\u23F1 Debug \u5168\u94FE\u8DEF
${debugTrace.join("\n")}`;
      logger.info(`debug-timing: sending to=${ctx.To}`);
      try {
        await sendMessageWeixin({
          to: ctx.To,
          text: timingText,
          opts: { baseUrl: deps.baseUrl, token: deps.token, contextToken }
        });
        logger.info(`debug-timing: sent OK`);
      } catch (debugErr) {
        logger.error(`debug-timing: send FAILED err=${String(debugErr)}`);
      }
    }
  }
}

// vendor/openclaw-runtime/win-x64/extensions/openclaw-weixin/src/runtime.ts
var pluginRuntime = null;
function setWeixinRuntime(next) {
  pluginRuntime = next;
  logger.info(`[runtime] setWeixinRuntime called, runtime set successfully`);
}
var WAIT_INTERVAL_MS = 100;
var DEFAULT_TIMEOUT_MS = 1e4;
async function waitForWeixinRuntime(timeoutMs = DEFAULT_TIMEOUT_MS) {
  const start = Date.now();
  while (!pluginRuntime) {
    if (Date.now() - start > timeoutMs) {
      throw new Error("Weixin runtime initialization timeout");
    }
    await new Promise((resolve) => setTimeout(resolve, WAIT_INTERVAL_MS));
  }
  return pluginRuntime;
}

// vendor/openclaw-runtime/win-x64/extensions/openclaw-weixin/src/storage/sync-buf.ts
import fs7 from "fs";
import path11 from "path";
function resolveAccountsDir2() {
  return path11.join(resolveStateDir(), "openclaw-weixin", "accounts");
}
function getSyncBufFilePath(accountId) {
  return path11.join(resolveAccountsDir2(), `${accountId}.sync.json`);
}
function getLegacySyncBufDefaultJsonPath() {
  return path11.join(
    resolveStateDir(),
    "agents",
    "default",
    "sessions",
    ".openclaw-weixin-sync",
    "default.json"
  );
}
function readSyncBufFile(filePath) {
  try {
    const raw = fs7.readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw);
    if (typeof data.get_updates_buf === "string") {
      return data.get_updates_buf;
    }
  } catch {
  }
  return void 0;
}
function loadGetUpdatesBuf(filePath) {
  const value = readSyncBufFile(filePath);
  if (value !== void 0) return value;
  const accountId = path11.basename(filePath, ".sync.json");
  const rawId = deriveRawAccountId(accountId);
  if (rawId) {
    const compatPath = path11.join(resolveAccountsDir2(), `${rawId}.sync.json`);
    const compatValue = readSyncBufFile(compatPath);
    if (compatValue !== void 0) return compatValue;
  }
  return readSyncBufFile(getLegacySyncBufDefaultJsonPath());
}
function saveGetUpdatesBuf(filePath, getUpdatesBuf) {
  const dir = path11.dirname(filePath);
  fs7.mkdirSync(dir, { recursive: true });
  fs7.writeFileSync(filePath, JSON.stringify({ get_updates_buf: getUpdatesBuf }, null, 0), "utf-8");
}

// vendor/openclaw-runtime/win-x64/extensions/openclaw-weixin/src/monitor/monitor.ts
var DEFAULT_LONG_POLL_TIMEOUT_MS2 = 35e3;
var MAX_CONSECUTIVE_FAILURES = 3;
var BACKOFF_DELAY_MS = 3e4;
var RETRY_DELAY_MS = 2e3;
async function monitorWeixinProvider(opts) {
  const {
    baseUrl,
    cdnBaseUrl,
    token,
    accountId,
    config,
    abortSignal,
    longPollTimeoutMs,
    setStatus
  } = opts;
  const log = opts.runtime?.log ?? (() => {
  });
  const errLog = opts.runtime?.error ?? ((m) => log(m));
  const aLog = logger.withAccount(accountId);
  aLog.info(`waiting for Weixin runtime...`);
  let channelRuntime;
  try {
    const pluginRuntime2 = await waitForWeixinRuntime();
    channelRuntime = pluginRuntime2.channel;
    aLog.info(`Weixin runtime acquired, channelRuntime type: ${typeof channelRuntime}`);
  } catch (err) {
    aLog.error(`waitForWeixinRuntime() failed: ${String(err)}`);
    throw err;
  }
  log(`weixin monitor started (${baseUrl}, account=${accountId})`);
  aLog.info(
    `Monitor started: baseUrl=${baseUrl} timeoutMs=${longPollTimeoutMs ?? DEFAULT_LONG_POLL_TIMEOUT_MS2}`
  );
  const syncFilePath = getSyncBufFilePath(accountId);
  aLog.debug(`syncFilePath: ${syncFilePath}`);
  const previousGetUpdatesBuf = loadGetUpdatesBuf(syncFilePath);
  let getUpdatesBuf = previousGetUpdatesBuf ?? "";
  if (previousGetUpdatesBuf) {
    log(`[weixin] resuming from previous sync buf (${getUpdatesBuf.length} bytes)`);
    aLog.debug(`Using previous get_updates_buf (${getUpdatesBuf.length} bytes)`);
  } else {
    log(`[weixin] no previous sync buf, starting fresh`);
    aLog.info(`No previous get_updates_buf found, starting fresh`);
  }
  const configManager = new WeixinConfigManager({ baseUrl, token }, log);
  let nextTimeoutMs = longPollTimeoutMs ?? DEFAULT_LONG_POLL_TIMEOUT_MS2;
  let consecutiveFailures = 0;
  while (!abortSignal?.aborted) {
    try {
      aLog.debug(
        `getUpdates: get_updates_buf=${getUpdatesBuf.substring(0, 50)}..., timeoutMs=${nextTimeoutMs}`
      );
      const resp = await getUpdates({
        baseUrl,
        token,
        get_updates_buf: getUpdatesBuf,
        timeoutMs: nextTimeoutMs
      });
      aLog.debug(
        `getUpdates response: ret=${resp.ret}, msgs=${resp.msgs?.length ?? 0}, get_updates_buf_length=${resp.get_updates_buf?.length ?? 0}`
      );
      if (resp.longpolling_timeout_ms != null && resp.longpolling_timeout_ms > 0) {
        nextTimeoutMs = resp.longpolling_timeout_ms;
        aLog.debug(`Updated next poll timeout: ${nextTimeoutMs}ms`);
      }
      const isApiError = resp.ret !== void 0 && resp.ret !== 0 || resp.errcode !== void 0 && resp.errcode !== 0;
      if (isApiError) {
        const isSessionExpired = resp.errcode === SESSION_EXPIRED_ERRCODE || resp.ret === SESSION_EXPIRED_ERRCODE;
        if (isSessionExpired) {
          pauseSession(accountId);
          const pauseMs = getRemainingPauseMs(accountId);
          errLog(
            `weixin getUpdates: session expired (errcode ${SESSION_EXPIRED_ERRCODE}), pausing bot for ${Math.ceil(pauseMs / 6e4)} min`
          );
          aLog.error(
            `getUpdates: session expired (errcode=${resp.errcode} ret=${resp.ret}), pausing all requests for ${Math.ceil(pauseMs / 6e4)} min`
          );
          consecutiveFailures = 0;
          await sleep(pauseMs, abortSignal);
          continue;
        }
        consecutiveFailures += 1;
        errLog(
          `weixin getUpdates failed: ret=${resp.ret} errcode=${resp.errcode} errmsg=${resp.errmsg ?? ""} (${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES})`
        );
        aLog.error(
          `getUpdates failed: ret=${resp.ret} errcode=${resp.errcode} errmsg=${resp.errmsg} response=${redactBody(JSON.stringify(resp))}`
        );
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          errLog(
            `weixin getUpdates: ${MAX_CONSECUTIVE_FAILURES} consecutive failures, backing off 30s`
          );
          aLog.error(
            `getUpdates: ${MAX_CONSECUTIVE_FAILURES} consecutive failures, backing off 30s`
          );
          consecutiveFailures = 0;
          await sleep(BACKOFF_DELAY_MS, abortSignal);
        } else {
          await sleep(RETRY_DELAY_MS, abortSignal);
        }
        continue;
      }
      consecutiveFailures = 0;
      setStatus?.({ accountId, lastEventAt: Date.now() });
      if (resp.get_updates_buf != null && resp.get_updates_buf !== "") {
        saveGetUpdatesBuf(syncFilePath, resp.get_updates_buf);
        getUpdatesBuf = resp.get_updates_buf;
        aLog.debug(`Saved new get_updates_buf (${getUpdatesBuf.length} bytes)`);
      }
      const list = resp.msgs ?? [];
      for (const full of list) {
        aLog.info(
          `inbound message: from=${full.from_user_id} types=${full.item_list?.map((i) => i.type).join(",") ?? "none"}`
        );
        const now = Date.now();
        setStatus?.({ accountId, lastEventAt: now, lastInboundAt: now });
        const fromUserId = full.from_user_id ?? "";
        const cachedConfig = await configManager.getForUser(fromUserId, full.context_token);
        await processOneMessage(full, {
          accountId,
          config,
          channelRuntime,
          baseUrl,
          cdnBaseUrl,
          token,
          typingTicket: cachedConfig.typingTicket,
          log: opts.runtime?.log ?? (() => {
          }),
          errLog
        });
      }
    } catch (err) {
      if (abortSignal?.aborted) {
        aLog.info(`Monitor stopped (aborted)`);
        return;
      }
      consecutiveFailures += 1;
      errLog(
        `weixin getUpdates error (${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES}): ${String(err)}`
      );
      aLog.error(`getUpdates error: ${String(err)}, stack=${err.stack}`);
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        errLog(
          `weixin getUpdates: ${MAX_CONSECUTIVE_FAILURES} consecutive failures, backing off 30s`
        );
        aLog.error(
          `getUpdates: ${MAX_CONSECUTIVE_FAILURES} consecutive failures, backing off 30s`
        );
        consecutiveFailures = 0;
        await sleep(3e4, abortSignal);
      } else {
        await sleep(2e3, abortSignal);
      }
    }
  }
  aLog.info(`Monitor ended`);
}
function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        reject(new Error("aborted"));
      },
      { once: true }
    );
  });
}

// vendor/openclaw-runtime/win-x64/extensions/openclaw-weixin/src/channel.ts
function isLocalFilePath(mediaUrl) {
  return !mediaUrl.includes("://");
}
function isRemoteUrl(mediaUrl) {
  return mediaUrl.startsWith("http://") || mediaUrl.startsWith("https://");
}
var MEDIA_OUTBOUND_TEMP_DIR2 = "/tmp/openclaw/weixin/media/outbound-temp";
function resolveLocalPath(mediaUrl) {
  if (mediaUrl.startsWith("file://")) return new URL(mediaUrl).pathname;
  if (!path12.isAbsolute(mediaUrl)) return path12.resolve(mediaUrl);
  return mediaUrl;
}
async function sendWeixinOutbound(params) {
  const account = resolveWeixinAccount(params.cfg, params.accountId);
  const aLog = logger.withAccount(account.accountId);
  assertSessionActive(account.accountId);
  if (!account.configured) {
    aLog.error(`sendWeixinOutbound: account not configured`);
    throw new Error("weixin not configured: please run `openclaw channels login --channel openclaw-weixin`");
  }
  if (!params.contextToken) {
    aLog.error(`sendWeixinOutbound: contextToken missing, refusing to send to=${params.to}`);
    throw new Error("sendWeixinOutbound: contextToken is required");
  }
  const result = await sendMessageWeixin({ to: params.to, text: params.text, opts: {
    baseUrl: account.baseUrl,
    token: account.token,
    contextToken: params.contextToken
  } });
  return { channel: "openclaw-weixin", messageId: result.messageId };
}
var weixinPlugin = {
  id: "openclaw-weixin",
  meta: {
    id: "openclaw-weixin",
    label: "openclaw-weixin",
    selectionLabel: "openclaw-weixin (long-poll)",
    docsPath: "/channels/openclaw-weixin",
    docsLabel: "openclaw-weixin",
    blurb: "getUpdates long-poll upstream, sendMessage downstream; token auth.",
    order: 75
  },
  gatewayMethods: ["web.login.start", "web.login.wait"],
  configSchema: {
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {}
    }
  },
  capabilities: {
    chatTypes: ["direct"],
    media: true
  },
  messaging: {
    targetResolver: {
      // Weixin user IDs always end with @im.wechat; treat as direct IDs, skip directory lookup.
      looksLikeId: (raw) => raw.endsWith("@im.wechat")
    }
  },
  agentPrompt: {
    messageToolHints: () => [
      "To send an image or file to the current user, use the message tool with action='send' and set 'media' to a local file path or a remote URL. You do not need to specify 'to' \u2014 the current conversation recipient is used automatically.",
      "When the user asks you to find an image from the web, use a web search or browser tool to find a suitable image URL, then send it using the message tool with 'media' set to that HTTPS image URL \u2014 do NOT download the image first.",
      "IMPORTANT: When generating or saving a file to send, always use an absolute path (e.g. /tmp/photo.png), never a relative path like ./photo.png. Relative paths cannot be resolved and the file will not be delivered.",
      "IMPORTANT: When creating a cron job (scheduled task) for the current Weixin user, you MUST set delivery.to to the user's Weixin ID (the xxx@im.wechat address from the current conversation). Without an explicit 'to', the cron delivery will fail with 'requires target'. Example: delivery: { mode: 'announce', channel: 'openclaw-weixin', to: '<current_user_id@im.wechat>' }."
    ]
  },
  reload: { configPrefixes: ["channels.openclaw-weixin"] },
  config: {
    listAccountIds: (cfg) => listWeixinAccountIds(cfg),
    resolveAccount: (cfg, accountId) => resolveWeixinAccount(cfg, accountId),
    isConfigured: (account) => account.configured,
    describeAccount: (account) => ({
      accountId: account.accountId,
      name: account.name,
      enabled: account.enabled,
      configured: account.configured
    })
  },
  outbound: {
    deliveryMode: "direct",
    textChunkLimit: 4e3,
    sendText: async (ctx) => {
      const result = await sendWeixinOutbound({
        cfg: ctx.cfg,
        to: ctx.to,
        text: ctx.text,
        accountId: ctx.accountId,
        contextToken: getContextToken(ctx.accountId, ctx.to)
      });
      return result;
    },
    sendMedia: async (ctx) => {
      const account = resolveWeixinAccount(ctx.cfg, ctx.accountId);
      const aLog = logger.withAccount(account.accountId);
      assertSessionActive(account.accountId);
      if (!account.configured) {
        aLog.error(`sendMedia: account not configured`);
        throw new Error(
          "weixin not configured: please run `openclaw channels login --channel openclaw-weixin`"
        );
      }
      const mediaUrl = ctx.mediaUrl;
      if (mediaUrl && (isLocalFilePath(mediaUrl) || isRemoteUrl(mediaUrl))) {
        let filePath;
        if (isLocalFilePath(mediaUrl)) {
          filePath = resolveLocalPath(mediaUrl);
          aLog.debug(`sendMedia: uploading local file ${filePath}`);
        } else {
          aLog.debug(`sendMedia: downloading remote mediaUrl=${mediaUrl.slice(0, 80)}...`);
          filePath = await downloadRemoteImageToTemp(mediaUrl, MEDIA_OUTBOUND_TEMP_DIR2);
          aLog.debug(`sendMedia: remote image downloaded to ${filePath}`);
        }
        const contextToken = getContextToken(account.accountId, ctx.to);
        const result2 = await sendWeixinMediaFile({
          filePath,
          to: ctx.to,
          text: ctx.text ?? "",
          opts: { baseUrl: account.baseUrl, token: account.token, contextToken },
          cdnBaseUrl: account.cdnBaseUrl
        });
        return { channel: "openclaw-weixin", messageId: result2.messageId };
      }
      const result = await sendWeixinOutbound({
        cfg: ctx.cfg,
        to: ctx.to,
        text: ctx.text ?? "",
        accountId: ctx.accountId,
        contextToken: getContextToken(ctx.accountId, ctx.to)
      });
      return result;
    }
  },
  status: {
    defaultRuntime: {
      accountId: "",
      lastError: null,
      lastInboundAt: null,
      lastOutboundAt: null
    },
    collectStatusIssues: () => [],
    buildChannelSummary: ({ snapshot }) => ({
      configured: snapshot.configured ?? false,
      lastError: snapshot.lastError ?? null,
      lastInboundAt: snapshot.lastInboundAt ?? null,
      lastOutboundAt: snapshot.lastOutboundAt ?? null
    }),
    buildAccountSnapshot: ({ account, runtime }) => ({
      ...runtime,
      accountId: account.accountId,
      name: account.name,
      enabled: account.enabled,
      configured: account.configured
    })
  },
  auth: {
    login: async ({ cfg, accountId, verbose, runtime }) => {
      const account = resolveWeixinAccount(cfg, accountId);
      const log = (msg) => {
        runtime?.log?.(msg);
      };
      log(`\u6B63\u5728\u542F\u52A8\u5FAE\u4FE1\u626B\u7801\u767B\u5F55...`);
      const startResult = await startWeixinLoginWithQr({
        accountId: account.accountId,
        apiBaseUrl: account.baseUrl,
        botType: DEFAULT_ILINK_BOT_TYPE,
        verbose: Boolean(verbose)
      });
      if (!startResult.qrcodeUrl) {
        logger.warn(
          `auth.login: failed to get QR code accountId=${account.accountId} message=${startResult.message}`
        );
        log(startResult.message);
        throw new Error(startResult.message);
      }
      log(`
\u4F7F\u7528\u5FAE\u4FE1\u626B\u63CF\u4EE5\u4E0B\u4E8C\u7EF4\u7801\uFF0C\u4EE5\u5B8C\u6210\u8FDE\u63A5\uFF1A
`);
      try {
        const qrcodeterminal = await import("qrcode-terminal");
        await new Promise((resolve) => {
          qrcodeterminal.default.generate(startResult.qrcodeUrl, { small: true }, (qr) => {
            console.log(qr);
            resolve();
          });
        });
      } catch (err) {
        logger.warn(
          `auth.login: qrcode-terminal unavailable, falling back to URL err=${String(err)}`
        );
        log(`\u4E8C\u7EF4\u7801\u94FE\u63A5: ${startResult.qrcodeUrl}`);
      }
      const loginTimeoutMs = 48e4;
      log(`
\u7B49\u5F85\u8FDE\u63A5\u7ED3\u679C...
`);
      const waitResult = await waitForWeixinLogin({
        sessionKey: startResult.sessionKey,
        apiBaseUrl: account.baseUrl,
        timeoutMs: loginTimeoutMs,
        verbose: Boolean(verbose),
        botType: DEFAULT_ILINK_BOT_TYPE
      });
      if (waitResult.connected && waitResult.botToken && waitResult.accountId) {
        try {
          const normalizedId = normalizeAccountId2(waitResult.accountId);
          saveWeixinAccount(normalizedId, {
            token: waitResult.botToken,
            baseUrl: waitResult.baseUrl,
            userId: waitResult.userId
          });
          registerWeixinAccountId(normalizedId);
          void triggerWeixinChannelReload();
          log(`
\u2705 \u4E0E\u5FAE\u4FE1\u8FDE\u63A5\u6210\u529F\uFF01`);
        } catch (err) {
          logger.error(
            `auth.login: failed to save account data accountId=${waitResult.accountId} err=${String(err)}`
          );
          log(`\u26A0\uFE0F  \u4FDD\u5B58\u8D26\u53F7\u6570\u636E\u5931\u8D25: ${String(err)}`);
        }
      } else {
        logger.warn(
          `auth.login: login did not complete accountId=${account.accountId} message=${waitResult.message}`
        );
        throw new Error(waitResult.message);
      }
    }
  },
  gateway: {
    startAccount: async (ctx) => {
      logger.debug(`startAccount entry`);
      if (!ctx) {
        logger.warn(`gateway.startAccount: called with undefined ctx, skipping`);
        return;
      }
      const account = ctx.account;
      const aLog = logger.withAccount(account.accountId);
      aLog.debug(`about to call monitorWeixinProvider`);
      aLog.info(`starting weixin webhook`);
      ctx.setStatus?.({
        accountId: account.accountId,
        running: true,
        lastStartAt: Date.now(),
        lastEventAt: Date.now()
      });
      if (!account.configured) {
        aLog.error(`account not configured`);
        ctx.log?.error?.(
          `[${account.accountId}] weixin not logged in \u2014 run: openclaw channels login --channel openclaw-weixin`
        );
        ctx.setStatus?.({ accountId: account.accountId, running: false });
        throw new Error("weixin not configured: missing token");
      }
      ctx.log?.info?.(`[${account.accountId}] starting weixin provider (${DEFAULT_BASE_URL})`);
      const logPath = aLog.getLogFilePath();
      ctx.log?.info?.(`[${account.accountId}] weixin logs: ${logPath}`);
      return monitorWeixinProvider({
        baseUrl: account.baseUrl,
        cdnBaseUrl: account.cdnBaseUrl,
        token: account.token,
        accountId: account.accountId,
        config: ctx.cfg,
        runtime: ctx.runtime,
        abortSignal: ctx.abortSignal,
        setStatus: ctx.setStatus
      });
    },
    loginWithQrStart: async ({ accountId, force, timeoutMs, verbose }) => {
      const savedBaseUrl = accountId ? loadWeixinAccount(accountId)?.baseUrl?.trim() : "";
      const result = await startWeixinLoginWithQr({
        accountId: accountId ?? void 0,
        apiBaseUrl: savedBaseUrl || DEFAULT_BASE_URL,
        botType: DEFAULT_ILINK_BOT_TYPE,
        force,
        timeoutMs,
        verbose
      });
      return {
        qrDataUrl: result.qrcodeUrl,
        message: result.message,
        sessionKey: result.sessionKey
      };
    },
    loginWithQrWait: async (params) => {
      const sessionKey = params.sessionKey || params.accountId || "";
      const savedBaseUrl = params.accountId ? loadWeixinAccount(params.accountId)?.baseUrl?.trim() : "";
      const result = await waitForWeixinLogin({
        sessionKey,
        apiBaseUrl: savedBaseUrl || DEFAULT_BASE_URL,
        timeoutMs: params.timeoutMs
      });
      if (result.connected && result.botToken && result.accountId) {
        try {
          const normalizedId = normalizeAccountId2(result.accountId);
          saveWeixinAccount(normalizedId, {
            token: result.botToken,
            baseUrl: result.baseUrl,
            userId: result.userId
          });
          registerWeixinAccountId(normalizedId);
          triggerWeixinChannelReload();
          logger.info(`loginWithQrWait: saved account data for accountId=${normalizedId}`);
        } catch (err) {
          logger.error(`loginWithQrWait: failed to save account data err=${String(err)}`);
        }
      }
      return {
        connected: result.connected,
        message: result.message,
        accountId: result.accountId
      };
    }
  }
};

// vendor/openclaw-runtime/win-x64/extensions/openclaw-weixin/src/config/config-schema.ts
import { z } from "zod";
var weixinAccountSchema = z.object({
  name: z.string().optional(),
  enabled: z.boolean().optional(),
  baseUrl: z.string().default(DEFAULT_BASE_URL),
  cdnBaseUrl: z.string().default(CDN_BASE_URL),
  routeTag: z.number().optional()
});
var WeixinConfigSchema = weixinAccountSchema.extend({
  accounts: z.record(z.string(), weixinAccountSchema).optional(),
  /** Default URL for `openclaw openclaw-weixin logs-upload`. Set via `openclaw config set channels.openclaw-weixin.logUploadUrl <url>`. */
  logUploadUrl: z.string().optional()
});

// vendor/openclaw-runtime/win-x64/extensions/openclaw-weixin/src/log-upload.ts
import fs8 from "fs/promises";
import path13 from "path";
function currentDayLogFileName() {
  const now = /* @__PURE__ */ new Date();
  const offsetMs = -now.getTimezoneOffset() * 6e4;
  const dateKey = new Date(now.getTime() + offsetMs).toISOString().slice(0, 10);
  return `openclaw-${dateKey}.log`;
}
function resolveLogFileName(file) {
  if (/^\d{8}$/.test(file)) {
    const yyyy = file.slice(0, 4);
    const mm = file.slice(4, 6);
    const dd = file.slice(6, 8);
    return `openclaw-${yyyy}-${mm}-${dd}.log`;
  }
  if (/^\d{10}$/.test(file)) {
    const yyyy = file.slice(0, 4);
    const mm = file.slice(4, 6);
    const dd = file.slice(6, 8);
    return `openclaw-${yyyy}-${mm}-${dd}.log`;
  }
  return file;
}
function mainLogDir() {
  return path13.join("/tmp", "openclaw");
}
function getConfiguredUploadUrl(config) {
  const section = config.channels?.["openclaw-weixin"];
  return section?.logUploadUrl;
}
function registerWeixinCli(params) {
  const { program, config } = params;
  const root = program.command("openclaw-weixin").description("Weixin channel utilities");
  root.command("logs-upload").description("Upload a Weixin log file to a remote URL via HTTP POST").option("--url <url>", "Remote URL to POST the log file to (overrides config)").option(
    "--file <file>",
    "Log file to upload: full filename or 8-digit date YYYYMMDD (default: today)"
  ).action(async (options) => {
    const uploadUrl = options.url ?? getConfiguredUploadUrl(config);
    if (!uploadUrl) {
      console.error(
        `[weixin] No upload URL specified. Pass --url or set it with:
  openclaw config set channels.openclaw-weixin.logUploadUrl <url>`
      );
      process.exit(1);
    }
    const logDir = mainLogDir();
    const rawFile = options.file ?? currentDayLogFileName();
    const fileName = resolveLogFileName(rawFile);
    const filePath = path13.isAbsolute(fileName) ? fileName : path13.join(logDir, fileName);
    let content;
    try {
      content = await fs8.readFile(filePath);
    } catch (err) {
      console.error(`[weixin] Failed to read log file: ${filePath}
  ${String(err)}`);
      process.exit(1);
    }
    console.log(`[weixin] Uploading ${filePath} (${content.length} bytes) to ${uploadUrl} ...`);
    const formData = new FormData();
    formData.append("file", new Blob([new Uint8Array(content)], { type: "text/plain" }), fileName);
    let res;
    try {
      res = await fetch(uploadUrl, { method: "POST", body: formData });
    } catch (err) {
      console.error(`[weixin] Upload request failed: ${String(err)}`);
      process.exit(1);
    }
    const responseBody = await res.text().catch(() => "");
    if (!res.ok) {
      console.error(
        `[weixin] Upload failed: HTTP ${res.status} ${res.statusText}
  ${responseBody}`
      );
      process.exit(1);
    }
    console.log(`[weixin] Upload succeeded (HTTP ${res.status})`);
    const fileid = res.headers.get("fileid");
    if (fileid) {
      console.log(`fileid: ${fileid}`);
    } else {
      const headers = {};
      res.headers.forEach((value, key) => {
        headers[key] = value;
      });
      console.log("headers:", JSON.stringify(headers, null, 2));
    }
    if (responseBody) {
      console.log("body:", responseBody);
    }
  });
}

// vendor/openclaw-runtime/win-x64/extensions/openclaw-weixin/index.ts
var plugin = {
  id: "openclaw-weixin",
  name: "Weixin",
  description: "Weixin channel (getUpdates long-poll + sendMessage)",
  configSchema: buildChannelConfigSchema(WeixinConfigSchema),
  register(api) {
    if (!api?.runtime) {
      throw new Error("[weixin] api.runtime is not available in register()");
    }
    setWeixinRuntime(api.runtime);
    api.registerChannel({ plugin: weixinPlugin });
    api.registerCli(({ program, config }) => registerWeixinCli({ program, config }), {
      commands: ["openclaw-weixin"]
    });
  }
};
var openclaw_weixin_default = plugin;
export {
  openclaw_weixin_default as default
};
