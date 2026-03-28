// vendor/openclaw-runtime/win-x64/extensions/irc/index.ts
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";

// vendor/openclaw-runtime/win-x64/extensions/irc/src/channel.ts
import {
  buildBaseAccountStatusSnapshot,
  buildBaseChannelStatusSummary,
  buildChannelConfigSchema,
  DEFAULT_ACCOUNT_ID as DEFAULT_ACCOUNT_ID3,
  deleteAccountFromConfigSection,
  formatPairingApproveHint,
  getChatChannelMeta,
  PAIRING_APPROVED_MESSAGE,
  resolveAllowlistProviderRuntimeGroupPolicy as resolveAllowlistProviderRuntimeGroupPolicy2,
  resolveDefaultGroupPolicy as resolveDefaultGroupPolicy2,
  setAccountEnabledInConfigSection
} from "openclaw/plugin-sdk";

// vendor/openclaw-runtime/win-x64/extensions/irc/src/accounts.ts
import { readFileSync } from "fs";
import { normalizeResolvedSecretInputString } from "openclaw/plugin-sdk";
import {
  DEFAULT_ACCOUNT_ID,
  normalizeAccountId,
  normalizeOptionalAccountId
} from "openclaw/plugin-sdk/account-id";
var TRUTHY_ENV = /* @__PURE__ */ new Set(["true", "1", "yes", "on"]);
function parseTruthy(value) {
  if (!value) {
    return false;
  }
  return TRUTHY_ENV.has(value.trim().toLowerCase());
}
function parseIntEnv(value) {
  if (!value?.trim()) {
    return void 0;
  }
  const parsed = Number.parseInt(value.trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 65535) {
    return void 0;
  }
  return parsed;
}
function parseListEnv(value) {
  if (!value?.trim()) {
    return void 0;
  }
  const parsed = value.split(/[\n,;]+/g).map((entry) => entry.trim()).filter(Boolean);
  return parsed.length > 0 ? parsed : void 0;
}
function listConfiguredAccountIds(cfg) {
  const accounts = cfg.channels?.irc?.accounts;
  if (!accounts || typeof accounts !== "object") {
    return [];
  }
  const ids = /* @__PURE__ */ new Set();
  for (const key of Object.keys(accounts)) {
    if (key.trim()) {
      ids.add(normalizeAccountId(key));
    }
  }
  return [...ids];
}
function resolveAccountConfig(cfg, accountId) {
  const accounts = cfg.channels?.irc?.accounts;
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
function mergeIrcAccountConfig(cfg, accountId) {
  const {
    accounts: _ignored,
    defaultAccount: _ignoredDefaultAccount,
    ...base
  } = cfg.channels?.irc ?? {};
  const account = resolveAccountConfig(cfg, accountId) ?? {};
  const merged = { ...base, ...account };
  if (base.nickserv || account.nickserv) {
    merged.nickserv = {
      ...base.nickserv,
      ...account.nickserv
    };
  }
  return merged;
}
function resolvePassword(accountId, merged) {
  if (accountId === DEFAULT_ACCOUNT_ID) {
    const envPassword = process.env.IRC_PASSWORD?.trim();
    if (envPassword) {
      return { password: envPassword, source: "env" };
    }
  }
  if (merged.passwordFile?.trim()) {
    try {
      const filePassword = readFileSync(merged.passwordFile.trim(), "utf-8").trim();
      if (filePassword) {
        return { password: filePassword, source: "passwordFile" };
      }
    } catch {
    }
  }
  const configPassword = normalizeResolvedSecretInputString({
    value: merged.password,
    path: `channels.irc.accounts.${accountId}.password`
  });
  if (configPassword) {
    return { password: configPassword, source: "config" };
  }
  return { password: "", source: "none" };
}
function resolveNickServConfig(accountId, nickserv) {
  const base = nickserv ?? {};
  const envPassword = accountId === DEFAULT_ACCOUNT_ID ? process.env.IRC_NICKSERV_PASSWORD?.trim() : void 0;
  const envRegisterEmail = accountId === DEFAULT_ACCOUNT_ID ? process.env.IRC_NICKSERV_REGISTER_EMAIL?.trim() : void 0;
  const passwordFile = base.passwordFile?.trim();
  let resolvedPassword = normalizeResolvedSecretInputString({
    value: base.password,
    path: `channels.irc.accounts.${accountId}.nickserv.password`
  }) || envPassword || "";
  if (!resolvedPassword && passwordFile) {
    try {
      resolvedPassword = readFileSync(passwordFile, "utf-8").trim();
    } catch {
    }
  }
  const merged = {
    ...base,
    service: base.service?.trim() || void 0,
    passwordFile: passwordFile || void 0,
    password: resolvedPassword || void 0,
    registerEmail: base.registerEmail?.trim() || envRegisterEmail || void 0
  };
  return merged;
}
function listIrcAccountIds(cfg) {
  const ids = listConfiguredAccountIds(cfg);
  if (ids.length === 0) {
    return [DEFAULT_ACCOUNT_ID];
  }
  return ids.toSorted((a, b) => a.localeCompare(b));
}
function resolveDefaultIrcAccountId(cfg) {
  const preferred = normalizeOptionalAccountId(cfg.channels?.irc?.defaultAccount);
  if (preferred && listIrcAccountIds(cfg).some((accountId) => normalizeAccountId(accountId) === preferred)) {
    return preferred;
  }
  const ids = listIrcAccountIds(cfg);
  if (ids.includes(DEFAULT_ACCOUNT_ID)) {
    return DEFAULT_ACCOUNT_ID;
  }
  return ids[0] ?? DEFAULT_ACCOUNT_ID;
}
function resolveIrcAccount(params) {
  const hasExplicitAccountId = Boolean(params.accountId?.trim());
  const baseEnabled = params.cfg.channels?.irc?.enabled !== false;
  const resolve = (accountId) => {
    const merged = mergeIrcAccountConfig(params.cfg, accountId);
    const accountEnabled = merged.enabled !== false;
    const enabled = baseEnabled && accountEnabled;
    const tls2 = typeof merged.tls === "boolean" ? merged.tls : accountId === DEFAULT_ACCOUNT_ID && process.env.IRC_TLS ? parseTruthy(process.env.IRC_TLS) : true;
    const envPort = accountId === DEFAULT_ACCOUNT_ID ? parseIntEnv(process.env.IRC_PORT) : void 0;
    const port = merged.port ?? envPort ?? (tls2 ? 6697 : 6667);
    const envChannels = accountId === DEFAULT_ACCOUNT_ID ? parseListEnv(process.env.IRC_CHANNELS) : void 0;
    const host = (merged.host?.trim() || (accountId === DEFAULT_ACCOUNT_ID ? process.env.IRC_HOST?.trim() : "") || "").trim();
    const nick = (merged.nick?.trim() || (accountId === DEFAULT_ACCOUNT_ID ? process.env.IRC_NICK?.trim() : "") || "").trim();
    const username = (merged.username?.trim() || (accountId === DEFAULT_ACCOUNT_ID ? process.env.IRC_USERNAME?.trim() : "") || nick || "openclaw").trim();
    const realname = (merged.realname?.trim() || (accountId === DEFAULT_ACCOUNT_ID ? process.env.IRC_REALNAME?.trim() : "") || "OpenClaw").trim();
    const passwordResolution = resolvePassword(accountId, merged);
    const nickserv = resolveNickServConfig(accountId, merged.nickserv);
    const config = {
      ...merged,
      channels: merged.channels ?? envChannels,
      tls: tls2,
      port,
      host,
      nick,
      username,
      realname,
      nickserv
    };
    return {
      accountId,
      enabled,
      name: merged.name?.trim() || void 0,
      configured: Boolean(host && nick),
      host,
      port,
      tls: tls2,
      nick,
      username,
      realname,
      password: passwordResolution.password,
      passwordSource: passwordResolution.source,
      config
    };
  };
  const normalized = normalizeAccountId(params.accountId);
  const primary = resolve(normalized);
  if (hasExplicitAccountId) {
    return primary;
  }
  if (primary.configured) {
    return primary;
  }
  const fallbackId = resolveDefaultIrcAccountId(params.cfg);
  if (fallbackId === primary.accountId) {
    return primary;
  }
  const fallback = resolve(fallbackId);
  if (!fallback.configured) {
    return primary;
  }
  return fallback;
}

// vendor/openclaw-runtime/win-x64/extensions/irc/src/config-schema.ts
import {
  DmPolicySchema,
  GroupPolicySchema,
  MarkdownConfigSchema,
  ReplyRuntimeConfigSchemaShape,
  ToolPolicySchema,
  requireOpenAllowFrom
} from "openclaw/plugin-sdk";
import { z } from "zod";
var IrcGroupSchema = z.object({
  requireMention: z.boolean().optional(),
  tools: ToolPolicySchema,
  toolsBySender: z.record(z.string(), ToolPolicySchema).optional(),
  skills: z.array(z.string()).optional(),
  enabled: z.boolean().optional(),
  allowFrom: z.array(z.union([z.string(), z.number()])).optional(),
  systemPrompt: z.string().optional()
}).strict();
var IrcNickServSchema = z.object({
  enabled: z.boolean().optional(),
  service: z.string().optional(),
  password: z.string().optional(),
  passwordFile: z.string().optional(),
  register: z.boolean().optional(),
  registerEmail: z.string().optional()
}).strict().superRefine((value, ctx) => {
  if (value.register && !value.registerEmail?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["registerEmail"],
      message: "channels.irc.nickserv.register=true requires channels.irc.nickserv.registerEmail"
    });
  }
});
var IrcAccountSchemaBase = z.object({
  name: z.string().optional(),
  enabled: z.boolean().optional(),
  dangerouslyAllowNameMatching: z.boolean().optional(),
  host: z.string().optional(),
  port: z.number().int().min(1).max(65535).optional(),
  tls: z.boolean().optional(),
  nick: z.string().optional(),
  username: z.string().optional(),
  realname: z.string().optional(),
  password: z.string().optional(),
  passwordFile: z.string().optional(),
  nickserv: IrcNickServSchema.optional(),
  dmPolicy: DmPolicySchema.optional().default("pairing"),
  allowFrom: z.array(z.union([z.string(), z.number()])).optional(),
  groupPolicy: GroupPolicySchema.optional().default("allowlist"),
  groupAllowFrom: z.array(z.union([z.string(), z.number()])).optional(),
  groups: z.record(z.string(), IrcGroupSchema.optional()).optional(),
  channels: z.array(z.string()).optional(),
  mentionPatterns: z.array(z.string()).optional(),
  markdown: MarkdownConfigSchema,
  ...ReplyRuntimeConfigSchemaShape
}).strict();
var IrcAccountSchema = IrcAccountSchemaBase.superRefine((value, ctx) => {
  requireOpenAllowFrom({
    policy: value.dmPolicy,
    allowFrom: value.allowFrom,
    ctx,
    path: ["allowFrom"],
    message: 'channels.irc.dmPolicy="open" requires channels.irc.allowFrom to include "*"'
  });
});
var IrcConfigSchema = IrcAccountSchemaBase.extend({
  accounts: z.record(z.string(), IrcAccountSchema.optional()).optional(),
  defaultAccount: z.string().optional()
}).superRefine((value, ctx) => {
  requireOpenAllowFrom({
    policy: value.dmPolicy,
    allowFrom: value.allowFrom,
    ctx,
    path: ["allowFrom"],
    message: 'channels.irc.dmPolicy="open" requires channels.irc.allowFrom to include "*"'
  });
});

// vendor/openclaw-runtime/win-x64/extensions/irc/src/monitor.ts
import { createLoggerBackedRuntime } from "openclaw/plugin-sdk";

// vendor/openclaw-runtime/win-x64/extensions/irc/src/client.ts
import net from "net";
import tls from "tls";

// vendor/openclaw-runtime/win-x64/extensions/irc/src/protocol.ts
import { randomUUID } from "crypto";

// vendor/openclaw-runtime/win-x64/extensions/irc/src/control-chars.ts
function isIrcControlChar(charCode) {
  return charCode <= 31 || charCode === 127;
}
function hasIrcControlChars(value) {
  for (const char of value) {
    if (isIrcControlChar(char.charCodeAt(0))) {
      return true;
    }
  }
  return false;
}
function stripIrcControlChars(value) {
  let out = "";
  for (const char of value) {
    if (!isIrcControlChar(char.charCodeAt(0))) {
      out += char;
    }
  }
  return out;
}

// vendor/openclaw-runtime/win-x64/extensions/irc/src/protocol.ts
var IRC_TARGET_PATTERN = /^[^\s:]+$/u;
function parseIrcLine(line) {
  const raw = line.replace(/[\r\n]+/g, "").trim();
  if (!raw) {
    return null;
  }
  let cursor = raw;
  let prefix;
  if (cursor.startsWith(":")) {
    const idx = cursor.indexOf(" ");
    if (idx <= 1) {
      return null;
    }
    prefix = cursor.slice(1, idx);
    cursor = cursor.slice(idx + 1).trimStart();
  }
  if (!cursor) {
    return null;
  }
  const firstSpace = cursor.indexOf(" ");
  const command = (firstSpace === -1 ? cursor : cursor.slice(0, firstSpace)).trim();
  if (!command) {
    return null;
  }
  cursor = firstSpace === -1 ? "" : cursor.slice(firstSpace + 1);
  const params = [];
  let trailing;
  while (cursor.length > 0) {
    cursor = cursor.trimStart();
    if (!cursor) {
      break;
    }
    if (cursor.startsWith(":")) {
      trailing = cursor.slice(1);
      break;
    }
    const spaceIdx = cursor.indexOf(" ");
    if (spaceIdx === -1) {
      params.push(cursor);
      break;
    }
    params.push(cursor.slice(0, spaceIdx));
    cursor = cursor.slice(spaceIdx + 1);
  }
  return {
    raw,
    prefix,
    command: command.toUpperCase(),
    params,
    trailing
  };
}
function parseIrcPrefix(prefix) {
  if (!prefix) {
    return {};
  }
  const nickPart = prefix.match(/^([^!@]+)!([^@]+)@(.+)$/);
  if (nickPart) {
    return {
      nick: nickPart[1],
      user: nickPart[2],
      host: nickPart[3]
    };
  }
  const nickHostPart = prefix.match(/^([^@]+)@(.+)$/);
  if (nickHostPart) {
    return {
      nick: nickHostPart[1],
      host: nickHostPart[2]
    };
  }
  if (prefix.includes("!")) {
    const [nick, user] = prefix.split("!", 2);
    return { nick, user };
  }
  if (prefix.includes(".")) {
    return { server: prefix };
  }
  return { nick: prefix };
}
function decodeLiteralEscapes(input) {
  return input.replace(/\\r/g, "\r").replace(/\\n/g, "\n").replace(/\\t/g, "	").replace(/\\0/g, "\0").replace(/\\x([0-9a-fA-F]{2})/g, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16))).replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)));
}
function sanitizeIrcOutboundText(text) {
  const decoded = decodeLiteralEscapes(text);
  return stripIrcControlChars(decoded.replace(/\r?\n/g, " ")).trim();
}
function sanitizeIrcTarget(raw) {
  const decoded = decodeLiteralEscapes(raw);
  if (!decoded) {
    throw new Error("IRC target is required");
  }
  if (decoded !== decoded.trim()) {
    throw new Error(`Invalid IRC target: ${raw}`);
  }
  if (hasIrcControlChars(decoded)) {
    throw new Error(`Invalid IRC target: ${raw}`);
  }
  if (!IRC_TARGET_PATTERN.test(decoded)) {
    throw new Error(`Invalid IRC target: ${raw}`);
  }
  return decoded;
}
function makeIrcMessageId() {
  return randomUUID();
}

// vendor/openclaw-runtime/win-x64/extensions/irc/src/client.ts
var IRC_ERROR_CODES = /* @__PURE__ */ new Set(["432", "464", "465"]);
var IRC_NICK_COLLISION_CODES = /* @__PURE__ */ new Set(["433", "436"]);
function toError(err) {
  if (err instanceof Error) {
    return err;
  }
  return new Error(typeof err === "string" ? err : JSON.stringify(err));
}
function withTimeout(promise, timeoutMs, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${timeoutMs}ms`)),
      timeoutMs
    );
    promise.then((result) => {
      clearTimeout(timer);
      resolve(result);
    }).catch((error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}
function buildFallbackNick(nick) {
  const normalized = nick.replace(/\s+/g, "");
  const safe = normalized.replace(/[^A-Za-z0-9_\-\[\]\\`^{}|]/g, "");
  const base = safe || "openclaw";
  const suffix = "_";
  const maxNickLen = 30;
  if (base.length >= maxNickLen) {
    return `${base.slice(0, maxNickLen - suffix.length)}${suffix}`;
  }
  return `${base}${suffix}`;
}
function buildIrcNickServCommands(options) {
  if (!options || options.enabled === false) {
    return [];
  }
  const password = sanitizeIrcOutboundText(options.password ?? "");
  if (!password) {
    return [];
  }
  const service = sanitizeIrcTarget(options.service?.trim() || "NickServ");
  const commands = [`PRIVMSG ${service} :IDENTIFY ${password}`];
  if (options.register) {
    const registerEmail = sanitizeIrcOutboundText(options.registerEmail ?? "");
    if (!registerEmail) {
      throw new Error("IRC NickServ register requires registerEmail");
    }
    commands.push(`PRIVMSG ${service} :REGISTER ${password} ${registerEmail}`);
  }
  return commands;
}
async function connectIrcClient(options) {
  const timeoutMs = options.connectTimeoutMs != null ? options.connectTimeoutMs : 15e3;
  const messageChunkMaxChars = options.messageChunkMaxChars != null ? options.messageChunkMaxChars : 350;
  if (!options.host.trim()) {
    throw new Error("IRC host is required");
  }
  if (!options.nick.trim()) {
    throw new Error("IRC nick is required");
  }
  const desiredNick = options.nick.trim();
  let currentNick = desiredNick;
  let ready = false;
  let closed = false;
  let nickServRecoverAttempted = false;
  let fallbackNickAttempted = false;
  const socket = options.tls ? tls.connect({
    host: options.host,
    port: options.port,
    servername: options.host
  }) : net.connect({ host: options.host, port: options.port });
  socket.setEncoding("utf8");
  let resolveReady = null;
  let rejectReady = null;
  const readyPromise = new Promise((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  const fail = (err) => {
    const error = toError(err);
    if (options.onError) {
      options.onError(error);
    }
    if (!ready && rejectReady) {
      rejectReady(error);
      rejectReady = null;
      resolveReady = null;
    }
  };
  const sendRaw = (line) => {
    const cleaned = line.replace(/[\r\n]+/g, "").trim();
    if (!cleaned) {
      throw new Error("IRC command cannot be empty");
    }
    socket.write(`${cleaned}\r
`);
  };
  const tryRecoverNickCollision = () => {
    const nickServEnabled = options.nickserv?.enabled !== false;
    const nickservPassword = sanitizeIrcOutboundText(options.nickserv?.password ?? "");
    if (nickServEnabled && !nickServRecoverAttempted && nickservPassword) {
      nickServRecoverAttempted = true;
      try {
        const service = sanitizeIrcTarget(options.nickserv?.service?.trim() || "NickServ");
        sendRaw(`PRIVMSG ${service} :GHOST ${desiredNick} ${nickservPassword}`);
        sendRaw(`NICK ${desiredNick}`);
        return true;
      } catch (err) {
        fail(err);
      }
    }
    if (!fallbackNickAttempted) {
      fallbackNickAttempted = true;
      const fallbackNick = buildFallbackNick(desiredNick);
      if (fallbackNick.toLowerCase() !== currentNick.toLowerCase()) {
        try {
          sendRaw(`NICK ${fallbackNick}`);
          currentNick = fallbackNick;
          return true;
        } catch (err) {
          fail(err);
        }
      }
    }
    return false;
  };
  const join = (channel2) => {
    const target = sanitizeIrcTarget(channel2);
    if (!target.startsWith("#") && !target.startsWith("&")) {
      throw new Error(`IRC JOIN target must be a channel: ${channel2}`);
    }
    sendRaw(`JOIN ${target}`);
  };
  const sendPrivmsg = (target, text) => {
    const normalizedTarget = sanitizeIrcTarget(target);
    const cleaned = sanitizeIrcOutboundText(text);
    if (!cleaned) {
      return;
    }
    let remaining = cleaned;
    while (remaining.length > 0) {
      let chunk = remaining;
      if (chunk.length > messageChunkMaxChars) {
        let splitAt = chunk.lastIndexOf(" ", messageChunkMaxChars);
        if (splitAt < Math.floor(messageChunkMaxChars / 2)) {
          splitAt = messageChunkMaxChars;
        }
        chunk = chunk.slice(0, splitAt).trim();
      }
      if (!chunk) {
        break;
      }
      sendRaw(`PRIVMSG ${normalizedTarget} :${chunk}`);
      remaining = remaining.slice(chunk.length).trimStart();
    }
  };
  const quit = (reason) => {
    if (closed) {
      return;
    }
    closed = true;
    const safeReason = sanitizeIrcOutboundText(reason != null ? reason : "bye");
    try {
      if (safeReason) {
        sendRaw(`QUIT :${safeReason}`);
      } else {
        sendRaw("QUIT");
      }
    } catch {
    }
    socket.end();
  };
  const close = () => {
    if (closed) {
      return;
    }
    closed = true;
    socket.destroy();
  };
  let buffer = "";
  socket.on("data", (chunk) => {
    buffer += chunk;
    let idx = buffer.indexOf("\n");
    while (idx !== -1) {
      const rawLine = buffer.slice(0, idx).replace(/\r$/, "");
      buffer = buffer.slice(idx + 1);
      idx = buffer.indexOf("\n");
      if (!rawLine) {
        continue;
      }
      if (options.onLine) {
        options.onLine(rawLine);
      }
      const line = parseIrcLine(rawLine);
      if (!line) {
        continue;
      }
      if (line.command === "PING") {
        const payload = line.trailing != null ? line.trailing : line.params[0] != null ? line.params[0] : "";
        sendRaw(`PONG :${payload}`);
        continue;
      }
      if (line.command === "NICK") {
        const prefix = parseIrcPrefix(line.prefix);
        if (prefix.nick && prefix.nick.toLowerCase() === currentNick.toLowerCase()) {
          const next = line.trailing != null ? line.trailing : line.params[0] != null ? line.params[0] : currentNick;
          currentNick = String(next).trim();
        }
        continue;
      }
      if (!ready && IRC_NICK_COLLISION_CODES.has(line.command)) {
        if (tryRecoverNickCollision()) {
          continue;
        }
        const detail = line.trailing != null ? line.trailing : line.params.join(" ") || "nickname in use";
        fail(new Error(`IRC login failed (${line.command}): ${detail}`));
        close();
        return;
      }
      if (!ready && IRC_ERROR_CODES.has(line.command)) {
        const detail = line.trailing != null ? line.trailing : line.params.join(" ") || "login rejected";
        fail(new Error(`IRC login failed (${line.command}): ${detail}`));
        close();
        return;
      }
      if (line.command === "001") {
        ready = true;
        const nickParam = line.params[0];
        if (nickParam && nickParam.trim()) {
          currentNick = nickParam.trim();
        }
        try {
          const nickServCommands = buildIrcNickServCommands(options.nickserv);
          for (const command of nickServCommands) {
            sendRaw(command);
          }
        } catch (err) {
          fail(err);
        }
        for (const channel2 of options.channels || []) {
          const trimmed = channel2.trim();
          if (!trimmed) {
            continue;
          }
          try {
            join(trimmed);
          } catch (err) {
            fail(err);
          }
        }
        if (resolveReady) {
          resolveReady();
        }
        resolveReady = null;
        rejectReady = null;
        continue;
      }
      if (line.command === "NOTICE") {
        if (options.onNotice) {
          options.onNotice(line.trailing != null ? line.trailing : "", line.params[0]);
        }
        continue;
      }
      if (line.command === "PRIVMSG") {
        const targetParam = line.params[0];
        const target = targetParam ? targetParam.trim() : "";
        const text = line.trailing != null ? line.trailing : "";
        const prefix = parseIrcPrefix(line.prefix);
        const senderNick = prefix.nick ? prefix.nick.trim() : "";
        if (!target || !senderNick || !text.trim()) {
          continue;
        }
        if (options.onPrivmsg) {
          void Promise.resolve(
            options.onPrivmsg({
              senderNick,
              senderUser: prefix.user ? prefix.user.trim() : void 0,
              senderHost: prefix.host ? prefix.host.trim() : void 0,
              target,
              text,
              rawLine
            })
          ).catch((error) => {
            fail(error);
          });
        }
      }
    }
  });
  socket.once("connect", () => {
    try {
      if (options.password && options.password.trim()) {
        sendRaw(`PASS ${options.password.trim()}`);
      }
      sendRaw(`NICK ${options.nick.trim()}`);
      sendRaw(`USER ${options.username.trim()} 0 * :${sanitizeIrcOutboundText(options.realname)}`);
    } catch (err) {
      fail(err);
      close();
    }
  });
  socket.once("error", (err) => {
    fail(err);
  });
  socket.once("close", () => {
    if (!closed) {
      closed = true;
      if (!ready) {
        fail(new Error("IRC connection closed before ready"));
      }
    }
  });
  if (options.abortSignal) {
    const abort = () => {
      quit("shutdown");
    };
    if (options.abortSignal.aborted) {
      abort();
    } else {
      options.abortSignal.addEventListener("abort", abort, { once: true });
    }
  }
  await withTimeout(readyPromise, timeoutMs, "IRC connect");
  return {
    get nick() {
      return currentNick;
    },
    isReady: () => ready && !closed,
    sendRaw,
    join,
    sendPrivmsg,
    quit,
    close
  };
}

// vendor/openclaw-runtime/win-x64/extensions/irc/src/connect-options.ts
function buildIrcConnectOptions(account, overrides = {}) {
  return {
    host: account.host,
    port: account.port,
    tls: account.tls,
    nick: account.nick,
    username: account.username,
    realname: account.realname,
    password: account.password,
    nickserv: {
      enabled: account.config.nickserv?.enabled,
      service: account.config.nickserv?.service,
      password: account.config.nickserv?.password,
      register: account.config.nickserv?.register,
      registerEmail: account.config.nickserv?.registerEmail
    },
    ...overrides
  };
}

// vendor/openclaw-runtime/win-x64/extensions/irc/src/inbound.ts
import {
  GROUP_POLICY_BLOCKED_LABEL,
  createScopedPairingAccess,
  createNormalizedOutboundDeliverer,
  createReplyPrefixOptions,
  formatTextWithAttachmentLinks,
  logInboundDrop,
  isDangerousNameMatchingEnabled,
  readStoreAllowFromForDmPolicy,
  resolveControlCommandGate,
  resolveOutboundMediaUrls,
  resolveAllowlistProviderRuntimeGroupPolicy,
  resolveDefaultGroupPolicy,
  resolveEffectiveAllowFromLists,
  warnMissingProviderGroupPolicyFallbackOnce
} from "openclaw/plugin-sdk";

// vendor/openclaw-runtime/win-x64/extensions/irc/src/normalize.ts
var IRC_TARGET_PATTERN2 = /^[^\s:]+$/u;
function isChannelTarget(target) {
  return target.startsWith("#") || target.startsWith("&");
}
function normalizeIrcMessagingTarget(raw) {
  const trimmed = raw.trim();
  if (!trimmed) {
    return void 0;
  }
  let target = trimmed;
  const lowered = target.toLowerCase();
  if (lowered.startsWith("irc:")) {
    target = target.slice("irc:".length).trim();
  }
  if (target.toLowerCase().startsWith("channel:")) {
    target = target.slice("channel:".length).trim();
    if (!target.startsWith("#") && !target.startsWith("&")) {
      target = `#${target}`;
    }
  }
  if (target.toLowerCase().startsWith("user:")) {
    target = target.slice("user:".length).trim();
  }
  if (!target || !looksLikeIrcTargetId(target)) {
    return void 0;
  }
  return target;
}
function looksLikeIrcTargetId(raw) {
  const trimmed = raw.trim();
  if (!trimmed) {
    return false;
  }
  if (hasIrcControlChars(trimmed)) {
    return false;
  }
  return IRC_TARGET_PATTERN2.test(trimmed);
}
function normalizeIrcAllowEntry(raw) {
  let value = raw.trim().toLowerCase();
  if (!value) {
    return "";
  }
  if (value.startsWith("irc:")) {
    value = value.slice("irc:".length);
  }
  if (value.startsWith("user:")) {
    value = value.slice("user:".length);
  }
  return value.trim();
}
function normalizeIrcAllowlist(entries) {
  return (entries ?? []).map((entry) => normalizeIrcAllowEntry(String(entry))).filter(Boolean);
}
function buildIrcAllowlistCandidates(message, params) {
  const nick = message.senderNick.trim().toLowerCase();
  const user = message.senderUser?.trim().toLowerCase();
  const host = message.senderHost?.trim().toLowerCase();
  const candidates = /* @__PURE__ */ new Set();
  if (nick && params?.allowNameMatching === true) {
    candidates.add(nick);
  }
  if (nick && user) {
    candidates.add(`${nick}!${user}`);
  }
  if (nick && host) {
    candidates.add(`${nick}@${host}`);
  }
  if (nick && user && host) {
    candidates.add(`${nick}!${user}@${host}`);
  }
  return [...candidates];
}
function resolveIrcAllowlistMatch(params) {
  const allowFrom = new Set(
    params.allowFrom.map((entry) => entry.trim().toLowerCase()).filter(Boolean)
  );
  if (allowFrom.has("*")) {
    return { allowed: true, source: "wildcard" };
  }
  const candidates = buildIrcAllowlistCandidates(params.message, {
    allowNameMatching: params.allowNameMatching
  });
  for (const candidate of candidates) {
    if (allowFrom.has(candidate)) {
      return { allowed: true, source: candidate };
    }
  }
  return { allowed: false };
}

// vendor/openclaw-runtime/win-x64/extensions/irc/src/policy.ts
function resolveIrcGroupMatch(params) {
  const groups = params.groups ?? {};
  const hasConfiguredGroups = Object.keys(groups).length > 0;
  const direct = groups[params.target];
  if (direct) {
    return {
      // "allowed" means the target matched an allowlisted key.
      // Explicit disables are handled later by resolveIrcGroupAccessGate.
      allowed: true,
      groupConfig: direct,
      wildcardConfig: groups["*"],
      hasConfiguredGroups
    };
  }
  const targetLower = params.target.toLowerCase();
  const directKey = Object.keys(groups).find((key) => key.toLowerCase() === targetLower);
  if (directKey) {
    const matched = groups[directKey];
    if (matched) {
      return {
        // "allowed" means the target matched an allowlisted key.
        // Explicit disables are handled later by resolveIrcGroupAccessGate.
        allowed: true,
        groupConfig: matched,
        wildcardConfig: groups["*"],
        hasConfiguredGroups
      };
    }
  }
  const wildcard = groups["*"];
  if (wildcard) {
    return {
      // "allowed" means the target matched an allowlisted key.
      // Explicit disables are handled later by resolveIrcGroupAccessGate.
      allowed: true,
      wildcardConfig: wildcard,
      hasConfiguredGroups
    };
  }
  return {
    allowed: false,
    hasConfiguredGroups
  };
}
function resolveIrcGroupAccessGate(params) {
  const policy = params.groupPolicy ?? "allowlist";
  if (policy === "disabled") {
    return { allowed: false, reason: "groupPolicy=disabled" };
  }
  if (policy === "allowlist") {
    if (!params.groupMatch.hasConfiguredGroups) {
      return {
        allowed: false,
        reason: "groupPolicy=allowlist and no groups configured"
      };
    }
    if (!params.groupMatch.allowed) {
      return { allowed: false, reason: "not allowlisted" };
    }
  }
  if (params.groupMatch.groupConfig?.enabled === false || params.groupMatch.wildcardConfig?.enabled === false) {
    return { allowed: false, reason: "disabled" };
  }
  return { allowed: true, reason: policy === "open" ? "open" : "allowlisted" };
}
function resolveIrcRequireMention(params) {
  if (params.groupConfig?.requireMention !== void 0) {
    return params.groupConfig.requireMention;
  }
  if (params.wildcardConfig?.requireMention !== void 0) {
    return params.wildcardConfig.requireMention;
  }
  return true;
}
function resolveIrcMentionGate(params) {
  if (!params.isGroup) {
    return { shouldSkip: false, reason: "direct" };
  }
  if (!params.requireMention) {
    return { shouldSkip: false, reason: "mention-not-required" };
  }
  if (params.wasMentioned) {
    return { shouldSkip: false, reason: "mentioned" };
  }
  if (params.hasControlCommand && params.allowTextCommands && params.commandAuthorized) {
    return { shouldSkip: false, reason: "authorized-command" };
  }
  return { shouldSkip: true, reason: "missing-mention" };
}
function resolveIrcGroupSenderAllowed(params) {
  const policy = params.groupPolicy ?? "allowlist";
  const inner = normalizeIrcAllowlist(params.innerAllowFrom);
  const outer = normalizeIrcAllowlist(params.outerAllowFrom);
  if (inner.length > 0) {
    return resolveIrcAllowlistMatch({
      allowFrom: inner,
      message: params.message,
      allowNameMatching: params.allowNameMatching
    }).allowed;
  }
  if (outer.length > 0) {
    return resolveIrcAllowlistMatch({
      allowFrom: outer,
      message: params.message,
      allowNameMatching: params.allowNameMatching
    }).allowed;
  }
  return policy === "open";
}

// vendor/openclaw-runtime/win-x64/extensions/irc/src/runtime.ts
var runtime = null;
function setIrcRuntime(next) {
  runtime = next;
}
function getIrcRuntime() {
  if (!runtime) {
    throw new Error("IRC runtime not initialized");
  }
  return runtime;
}

// vendor/openclaw-runtime/win-x64/extensions/irc/src/send.ts
function resolveTarget(to, opts) {
  const fromArg = normalizeIrcMessagingTarget(to);
  if (fromArg) {
    return fromArg;
  }
  const fromOpt = normalizeIrcMessagingTarget(opts?.target ?? "");
  if (fromOpt) {
    return fromOpt;
  }
  throw new Error(`Invalid IRC target: ${to}`);
}
async function sendMessageIrc(to, text, opts = {}) {
  const runtime2 = getIrcRuntime();
  const cfg = runtime2.config.loadConfig();
  const account = resolveIrcAccount({
    cfg,
    accountId: opts.accountId
  });
  if (!account.configured) {
    throw new Error(
      `IRC is not configured for account "${account.accountId}" (need host and nick in channels.irc).`
    );
  }
  const target = resolveTarget(to, opts);
  const tableMode = runtime2.channel.text.resolveMarkdownTableMode({
    cfg,
    channel: "irc",
    accountId: account.accountId
  });
  const prepared = runtime2.channel.text.convertMarkdownTables(text.trim(), tableMode);
  const payload = opts.replyTo ? `${prepared}

[reply:${opts.replyTo}]` : prepared;
  if (!payload.trim()) {
    throw new Error("Message must be non-empty for IRC sends");
  }
  const client = opts.client;
  if (client?.isReady()) {
    client.sendPrivmsg(target, payload);
  } else {
    const transient = await connectIrcClient(
      buildIrcConnectOptions(account, {
        connectTimeoutMs: 12e3
      })
    );
    transient.sendPrivmsg(target, payload);
    transient.quit("sent");
  }
  runtime2.channel.activity.record({
    channel: "irc",
    accountId: account.accountId,
    direction: "outbound"
  });
  return {
    messageId: makeIrcMessageId(),
    target
  };
}

// vendor/openclaw-runtime/win-x64/extensions/irc/src/inbound.ts
var CHANNEL_ID = "irc";
var escapeIrcRegexLiteral = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function resolveIrcEffectiveAllowlists(params) {
  const { effectiveAllowFrom, effectiveGroupAllowFrom } = resolveEffectiveAllowFromLists({
    allowFrom: params.configAllowFrom,
    groupAllowFrom: params.configGroupAllowFrom,
    storeAllowFrom: params.storeAllowList,
    dmPolicy: params.dmPolicy,
    // IRC intentionally requires explicit groupAllowFrom; do not fallback to allowFrom.
    groupAllowFromFallbackToAllowFrom: false
  });
  return { effectiveAllowFrom, effectiveGroupAllowFrom };
}
async function deliverIrcReply(params) {
  const combined = formatTextWithAttachmentLinks(
    params.payload.text,
    resolveOutboundMediaUrls(params.payload)
  );
  if (!combined) {
    return;
  }
  if (params.sendReply) {
    await params.sendReply(params.target, combined, params.payload.replyToId);
  } else {
    await sendMessageIrc(params.target, combined, {
      accountId: params.accountId,
      replyTo: params.payload.replyToId
    });
  }
  params.statusSink?.({ lastOutboundAt: Date.now() });
}
async function handleIrcInbound(params) {
  const { message, account, config, runtime: runtime2, connectedNick, statusSink } = params;
  const core = getIrcRuntime();
  const pairing = createScopedPairingAccess({
    core,
    channel: CHANNEL_ID,
    accountId: account.accountId
  });
  const rawBody = message.text?.trim() ?? "";
  if (!rawBody) {
    return;
  }
  statusSink?.({ lastInboundAt: message.timestamp });
  const senderDisplay = message.senderHost ? `${message.senderNick}!${message.senderUser ?? "?"}@${message.senderHost}` : message.senderNick;
  const allowNameMatching = isDangerousNameMatchingEnabled(account.config);
  const dmPolicy2 = account.config.dmPolicy ?? "pairing";
  const defaultGroupPolicy = resolveDefaultGroupPolicy(config);
  const { groupPolicy, providerMissingFallbackApplied } = resolveAllowlistProviderRuntimeGroupPolicy({
    providerConfigPresent: config.channels?.irc !== void 0,
    groupPolicy: account.config.groupPolicy,
    defaultGroupPolicy
  });
  warnMissingProviderGroupPolicyFallbackOnce({
    providerMissingFallbackApplied,
    providerKey: "irc",
    accountId: account.accountId,
    blockedLabel: GROUP_POLICY_BLOCKED_LABEL.channel,
    log: (message2) => runtime2.log?.(message2)
  });
  const configAllowFrom = normalizeIrcAllowlist(account.config.allowFrom);
  const configGroupAllowFrom = normalizeIrcAllowlist(account.config.groupAllowFrom);
  const storeAllowFrom = await readStoreAllowFromForDmPolicy({
    provider: CHANNEL_ID,
    accountId: account.accountId,
    dmPolicy: dmPolicy2,
    readStore: pairing.readStoreForDmPolicy
  });
  const storeAllowList = normalizeIrcAllowlist(storeAllowFrom);
  const groupMatch = resolveIrcGroupMatch({
    groups: account.config.groups,
    target: message.target
  });
  if (message.isGroup) {
    const groupAccess = resolveIrcGroupAccessGate({ groupPolicy, groupMatch });
    if (!groupAccess.allowed) {
      runtime2.log?.(`irc: drop channel ${message.target} (${groupAccess.reason})`);
      return;
    }
  }
  const directGroupAllowFrom = normalizeIrcAllowlist(groupMatch.groupConfig?.allowFrom);
  const wildcardGroupAllowFrom = normalizeIrcAllowlist(groupMatch.wildcardConfig?.allowFrom);
  const groupAllowFrom = directGroupAllowFrom.length > 0 ? directGroupAllowFrom : wildcardGroupAllowFrom;
  const { effectiveAllowFrom, effectiveGroupAllowFrom } = resolveIrcEffectiveAllowlists({
    configAllowFrom,
    configGroupAllowFrom,
    storeAllowList,
    dmPolicy: dmPolicy2
  });
  const allowTextCommands = core.channel.commands.shouldHandleTextCommands({
    cfg: config,
    surface: CHANNEL_ID
  });
  const useAccessGroups = config.commands?.useAccessGroups !== false;
  const senderAllowedForCommands = resolveIrcAllowlistMatch({
    allowFrom: message.isGroup ? effectiveGroupAllowFrom : effectiveAllowFrom,
    message,
    allowNameMatching
  }).allowed;
  const hasControlCommand = core.channel.text.hasControlCommand(rawBody, config);
  const commandGate = resolveControlCommandGate({
    useAccessGroups,
    authorizers: [
      {
        configured: (message.isGroup ? effectiveGroupAllowFrom : effectiveAllowFrom).length > 0,
        allowed: senderAllowedForCommands
      }
    ],
    allowTextCommands,
    hasControlCommand
  });
  const commandAuthorized = commandGate.commandAuthorized;
  if (message.isGroup) {
    const senderAllowed = resolveIrcGroupSenderAllowed({
      groupPolicy,
      message,
      outerAllowFrom: effectiveGroupAllowFrom,
      innerAllowFrom: groupAllowFrom,
      allowNameMatching
    });
    if (!senderAllowed) {
      runtime2.log?.(`irc: drop group sender ${senderDisplay} (policy=${groupPolicy})`);
      return;
    }
  } else {
    if (dmPolicy2 === "disabled") {
      runtime2.log?.(`irc: drop DM sender=${senderDisplay} (dmPolicy=disabled)`);
      return;
    }
    if (dmPolicy2 !== "open") {
      const dmAllowed = resolveIrcAllowlistMatch({
        allowFrom: effectiveAllowFrom,
        message,
        allowNameMatching
      }).allowed;
      if (!dmAllowed) {
        if (dmPolicy2 === "pairing") {
          const { code, created } = await pairing.upsertPairingRequest({
            id: senderDisplay.toLowerCase(),
            meta: { name: message.senderNick || void 0 }
          });
          if (created) {
            try {
              const reply = core.channel.pairing.buildPairingReply({
                channel: CHANNEL_ID,
                idLine: `Your IRC id: ${senderDisplay}`,
                code
              });
              await deliverIrcReply({
                payload: { text: reply },
                target: message.senderNick,
                accountId: account.accountId,
                sendReply: params.sendReply,
                statusSink
              });
            } catch (err) {
              runtime2.error?.(`irc: pairing reply failed for ${senderDisplay}: ${String(err)}`);
            }
          }
        }
        runtime2.log?.(`irc: drop DM sender ${senderDisplay} (dmPolicy=${dmPolicy2})`);
        return;
      }
    }
  }
  if (message.isGroup && commandGate.shouldBlock) {
    logInboundDrop({
      log: (line) => runtime2.log?.(line),
      channel: CHANNEL_ID,
      reason: "control command (unauthorized)",
      target: senderDisplay
    });
    return;
  }
  const mentionRegexes = core.channel.mentions.buildMentionRegexes(config);
  const mentionNick = connectedNick?.trim() || account.nick;
  const explicitMentionRegex = mentionNick ? new RegExp(`\\b${escapeIrcRegexLiteral(mentionNick)}\\b[:,]?`, "i") : null;
  const wasMentioned = core.channel.mentions.matchesMentionPatterns(rawBody, mentionRegexes) || (explicitMentionRegex ? explicitMentionRegex.test(rawBody) : false);
  const requireMention = message.isGroup ? resolveIrcRequireMention({
    groupConfig: groupMatch.groupConfig,
    wildcardConfig: groupMatch.wildcardConfig
  }) : false;
  const mentionGate = resolveIrcMentionGate({
    isGroup: message.isGroup,
    requireMention,
    wasMentioned,
    hasControlCommand,
    allowTextCommands,
    commandAuthorized
  });
  if (mentionGate.shouldSkip) {
    runtime2.log?.(`irc: drop channel ${message.target} (${mentionGate.reason})`);
    return;
  }
  const peerId = message.isGroup ? message.target : message.senderNick;
  const route = core.channel.routing.resolveAgentRoute({
    cfg: config,
    channel: CHANNEL_ID,
    accountId: account.accountId,
    peer: {
      kind: message.isGroup ? "group" : "direct",
      id: peerId
    }
  });
  const fromLabel = message.isGroup ? message.target : senderDisplay;
  const storePath = core.channel.session.resolveStorePath(config.session?.store, {
    agentId: route.agentId
  });
  const envelopeOptions = core.channel.reply.resolveEnvelopeFormatOptions(config);
  const previousTimestamp = core.channel.session.readSessionUpdatedAt({
    storePath,
    sessionKey: route.sessionKey
  });
  const body = core.channel.reply.formatAgentEnvelope({
    channel: "IRC",
    from: fromLabel,
    timestamp: message.timestamp,
    previousTimestamp,
    envelope: envelopeOptions,
    body: rawBody
  });
  const groupSystemPrompt = groupMatch.groupConfig?.systemPrompt?.trim() || void 0;
  const ctxPayload = core.channel.reply.finalizeInboundContext({
    Body: body,
    RawBody: rawBody,
    CommandBody: rawBody,
    From: message.isGroup ? `irc:channel:${message.target}` : `irc:${senderDisplay}`,
    To: `irc:${peerId}`,
    SessionKey: route.sessionKey,
    AccountId: route.accountId,
    ChatType: message.isGroup ? "group" : "direct",
    ConversationLabel: fromLabel,
    SenderName: message.senderNick || void 0,
    SenderId: senderDisplay,
    GroupSubject: message.isGroup ? message.target : void 0,
    GroupSystemPrompt: message.isGroup ? groupSystemPrompt : void 0,
    Provider: CHANNEL_ID,
    Surface: CHANNEL_ID,
    WasMentioned: message.isGroup ? wasMentioned : void 0,
    MessageSid: message.messageId,
    Timestamp: message.timestamp,
    OriginatingChannel: CHANNEL_ID,
    OriginatingTo: `irc:${peerId}`,
    CommandAuthorized: commandAuthorized
  });
  await core.channel.session.recordInboundSession({
    storePath,
    sessionKey: ctxPayload.SessionKey ?? route.sessionKey,
    ctx: ctxPayload,
    onRecordError: (err) => {
      runtime2.error?.(`irc: failed updating session meta: ${String(err)}`);
    }
  });
  const { onModelSelected, ...prefixOptions } = createReplyPrefixOptions({
    cfg: config,
    agentId: route.agentId,
    channel: CHANNEL_ID,
    accountId: account.accountId
  });
  const deliverReply = createNormalizedOutboundDeliverer(async (payload) => {
    await deliverIrcReply({
      payload,
      target: peerId,
      accountId: account.accountId,
      sendReply: params.sendReply,
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
        runtime2.error?.(`irc ${info.kind} reply failed: ${String(err)}`);
      }
    },
    replyOptions: {
      skillFilter: groupMatch.groupConfig?.skills,
      onModelSelected,
      disableBlockStreaming: typeof account.config.blockStreaming === "boolean" ? !account.config.blockStreaming : void 0
    }
  });
}

// vendor/openclaw-runtime/win-x64/extensions/irc/src/monitor.ts
function resolveIrcInboundTarget(params) {
  const rawTarget = params.target;
  const isGroup = isChannelTarget(rawTarget);
  if (isGroup) {
    return { isGroup: true, target: rawTarget, rawTarget };
  }
  const senderNick = params.senderNick.trim();
  return { isGroup: false, target: senderNick || rawTarget, rawTarget };
}
async function monitorIrcProvider(opts) {
  const core = getIrcRuntime();
  const cfg = opts.config ?? core.config.loadConfig();
  const account = resolveIrcAccount({
    cfg,
    accountId: opts.accountId
  });
  const runtime2 = opts.runtime ?? createLoggerBackedRuntime({
    logger: core.logging.getChildLogger(),
    exitError: () => new Error("Runtime exit not available")
  });
  if (!account.configured) {
    throw new Error(
      `IRC is not configured for account "${account.accountId}" (need host and nick in channels.irc).`
    );
  }
  const logger = core.logging.getChildLogger({
    channel: "irc",
    accountId: account.accountId
  });
  let client = null;
  client = await connectIrcClient(
    buildIrcConnectOptions(account, {
      channels: account.config.channels,
      abortSignal: opts.abortSignal,
      onLine: (line) => {
        if (core.logging.shouldLogVerbose()) {
          logger.debug?.(`[${account.accountId}] << ${line}`);
        }
      },
      onNotice: (text, target) => {
        if (core.logging.shouldLogVerbose()) {
          logger.debug?.(`[${account.accountId}] notice ${target ?? ""}: ${text}`);
        }
      },
      onError: (error) => {
        logger.error(`[${account.accountId}] IRC error: ${error.message}`);
      },
      onPrivmsg: async (event) => {
        if (!client) {
          return;
        }
        if (event.senderNick.toLowerCase() === client.nick.toLowerCase()) {
          return;
        }
        const inboundTarget = resolveIrcInboundTarget({
          target: event.target,
          senderNick: event.senderNick
        });
        const message = {
          messageId: makeIrcMessageId(),
          target: inboundTarget.target,
          rawTarget: inboundTarget.rawTarget,
          senderNick: event.senderNick,
          senderUser: event.senderUser,
          senderHost: event.senderHost,
          text: event.text,
          timestamp: Date.now(),
          isGroup: inboundTarget.isGroup
        };
        core.channel.activity.record({
          channel: "irc",
          accountId: account.accountId,
          direction: "inbound",
          at: message.timestamp
        });
        if (opts.onMessage) {
          await opts.onMessage(message, client);
          return;
        }
        await handleIrcInbound({
          message,
          account,
          config: cfg,
          runtime: runtime2,
          connectedNick: client.nick,
          sendReply: async (target, text) => {
            client?.sendPrivmsg(target, text);
            opts.statusSink?.({ lastOutboundAt: Date.now() });
            core.channel.activity.record({
              channel: "irc",
              accountId: account.accountId,
              direction: "outbound"
            });
          },
          statusSink: opts.statusSink
        });
      }
    })
  );
  logger.info(
    `[${account.accountId}] connected to ${account.host}:${account.port}${account.tls ? " (tls)" : ""} as ${client.nick}`
  );
  return {
    stop: () => {
      client?.quit("shutdown");
      client = null;
    }
  };
}

// vendor/openclaw-runtime/win-x64/extensions/irc/src/onboarding.ts
import {
  addWildcardAllowFrom,
  DEFAULT_ACCOUNT_ID as DEFAULT_ACCOUNT_ID2,
  formatDocsLink,
  promptAccountId,
  promptChannelAccessConfig
} from "openclaw/plugin-sdk";
var channel = "irc";
function parseListInput(raw) {
  return raw.split(/[\n,;]+/g).map((entry) => entry.trim()).filter(Boolean);
}
function parsePort(raw, fallback) {
  const trimmed = raw.trim();
  if (!trimmed) {
    return fallback;
  }
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 65535) {
    return fallback;
  }
  return parsed;
}
function normalizeGroupEntry(raw) {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed === "*") {
    return "*";
  }
  const normalized = normalizeIrcMessagingTarget(trimmed) ?? trimmed;
  if (isChannelTarget(normalized)) {
    return normalized;
  }
  return `#${normalized.replace(/^#+/, "")}`;
}
function updateIrcAccountConfig(cfg, accountId, patch) {
  const current = cfg.channels?.irc ?? {};
  if (accountId === DEFAULT_ACCOUNT_ID2) {
    return {
      ...cfg,
      channels: {
        ...cfg.channels,
        irc: {
          ...current,
          ...patch
        }
      }
    };
  }
  return {
    ...cfg,
    channels: {
      ...cfg.channels,
      irc: {
        ...current,
        accounts: {
          ...current.accounts,
          [accountId]: {
            ...current.accounts?.[accountId],
            ...patch
          }
        }
      }
    }
  };
}
function setIrcDmPolicy(cfg, dmPolicy2) {
  const allowFrom = dmPolicy2 === "open" ? addWildcardAllowFrom(cfg.channels?.irc?.allowFrom) : void 0;
  return {
    ...cfg,
    channels: {
      ...cfg.channels,
      irc: {
        ...cfg.channels?.irc,
        dmPolicy: dmPolicy2,
        ...allowFrom ? { allowFrom } : {}
      }
    }
  };
}
function setIrcAllowFrom(cfg, allowFrom) {
  return {
    ...cfg,
    channels: {
      ...cfg.channels,
      irc: {
        ...cfg.channels?.irc,
        allowFrom
      }
    }
  };
}
function setIrcNickServ(cfg, accountId, nickserv) {
  return updateIrcAccountConfig(cfg, accountId, { nickserv });
}
function setIrcGroupAccess(cfg, accountId, policy, entries) {
  if (policy !== "allowlist") {
    return updateIrcAccountConfig(cfg, accountId, { enabled: true, groupPolicy: policy });
  }
  const normalizedEntries = [
    ...new Set(entries.map((entry) => normalizeGroupEntry(entry)).filter(Boolean))
  ];
  const groups = Object.fromEntries(normalizedEntries.map((entry) => [entry, {}]));
  return updateIrcAccountConfig(cfg, accountId, {
    enabled: true,
    groupPolicy: "allowlist",
    groups
  });
}
async function noteIrcSetupHelp(prompter) {
  await prompter.note(
    [
      "IRC needs server host + bot nick.",
      "Recommended: TLS on port 6697.",
      "Optional: NickServ identify/register can be configured in onboarding.",
      'Set channels.irc.groupPolicy="allowlist" and channels.irc.groups for tighter channel control.',
      'Note: IRC channels are mention-gated by default. To allow unmentioned replies, set channels.irc.groups["#channel"].requireMention=false (or "*" for all).',
      "Env vars supported: IRC_HOST, IRC_PORT, IRC_TLS, IRC_NICK, IRC_USERNAME, IRC_REALNAME, IRC_PASSWORD, IRC_CHANNELS, IRC_NICKSERV_PASSWORD, IRC_NICKSERV_REGISTER_EMAIL.",
      `Docs: ${formatDocsLink("/channels/irc", "channels/irc")}`
    ].join("\n"),
    "IRC setup"
  );
}
async function promptIrcAllowFrom(params) {
  const existing = params.cfg.channels?.irc?.allowFrom ?? [];
  await params.prompter.note(
    [
      "Allowlist IRC DMs by sender.",
      "Examples:",
      "- alice",
      "- alice!ident@example.org",
      "Multiple entries: comma-separated."
    ].join("\n"),
    "IRC allowlist"
  );
  const raw = await params.prompter.text({
    message: "IRC allowFrom (nick or nick!user@host)",
    placeholder: "alice, bob!ident@example.org",
    initialValue: existing[0] ? String(existing[0]) : void 0,
    validate: (value) => String(value ?? "").trim() ? void 0 : "Required"
  });
  const parsed = parseListInput(String(raw));
  const normalized = [
    ...new Set(
      parsed.map((entry) => normalizeIrcAllowEntry(entry)).map((entry) => entry.trim()).filter(Boolean)
    )
  ];
  return setIrcAllowFrom(params.cfg, normalized);
}
async function promptIrcNickServConfig(params) {
  const resolved = resolveIrcAccount({ cfg: params.cfg, accountId: params.accountId });
  const existing = resolved.config.nickserv;
  const hasExisting = Boolean(existing?.password || existing?.passwordFile);
  const wants = await params.prompter.confirm({
    message: hasExisting ? "Update NickServ settings?" : "Configure NickServ identify/register?",
    initialValue: hasExisting
  });
  if (!wants) {
    return params.cfg;
  }
  const service = String(
    await params.prompter.text({
      message: "NickServ service nick",
      initialValue: existing?.service || "NickServ",
      validate: (value) => String(value ?? "").trim() ? void 0 : "Required"
    })
  ).trim();
  const useEnvPassword = params.accountId === DEFAULT_ACCOUNT_ID2 && Boolean(process.env.IRC_NICKSERV_PASSWORD?.trim()) && !(existing?.password || existing?.passwordFile) ? await params.prompter.confirm({
    message: "IRC_NICKSERV_PASSWORD detected. Use env var?",
    initialValue: true
  }) : false;
  const password = useEnvPassword ? void 0 : String(
    await params.prompter.text({
      message: "NickServ password (blank to disable NickServ auth)",
      validate: () => void 0
    })
  ).trim();
  if (!password && !useEnvPassword) {
    return setIrcNickServ(params.cfg, params.accountId, {
      enabled: false,
      service
    });
  }
  const register = await params.prompter.confirm({
    message: "Send NickServ REGISTER on connect?",
    initialValue: existing?.register ?? false
  });
  const registerEmail = register ? String(
    await params.prompter.text({
      message: "NickServ register email",
      initialValue: existing?.registerEmail || (params.accountId === DEFAULT_ACCOUNT_ID2 ? process.env.IRC_NICKSERV_REGISTER_EMAIL : void 0),
      validate: (value) => String(value ?? "").trim() ? void 0 : "Required"
    })
  ).trim() : void 0;
  return setIrcNickServ(params.cfg, params.accountId, {
    enabled: true,
    service,
    ...password ? { password } : {},
    register,
    ...registerEmail ? { registerEmail } : {}
  });
}
var dmPolicy = {
  label: "IRC",
  channel,
  policyKey: "channels.irc.dmPolicy",
  allowFromKey: "channels.irc.allowFrom",
  getCurrent: (cfg) => cfg.channels?.irc?.dmPolicy ?? "pairing",
  setPolicy: (cfg, policy) => setIrcDmPolicy(cfg, policy),
  promptAllowFrom: promptIrcAllowFrom
};
var ircOnboardingAdapter = {
  channel,
  getStatus: async ({ cfg }) => {
    const coreCfg = cfg;
    const configured = listIrcAccountIds(coreCfg).some(
      (accountId) => resolveIrcAccount({ cfg: coreCfg, accountId }).configured
    );
    return {
      channel,
      configured,
      statusLines: [`IRC: ${configured ? "configured" : "needs host + nick"}`],
      selectionHint: configured ? "configured" : "needs host + nick",
      quickstartScore: configured ? 1 : 0
    };
  },
  configure: async ({
    cfg,
    prompter,
    accountOverrides,
    shouldPromptAccountIds,
    forceAllowFrom
  }) => {
    let next = cfg;
    const ircOverride = accountOverrides.irc?.trim();
    const defaultAccountId = resolveDefaultIrcAccountId(next);
    let accountId = ircOverride || defaultAccountId;
    if (shouldPromptAccountIds && !ircOverride) {
      accountId = await promptAccountId({
        cfg: next,
        prompter,
        label: "IRC",
        currentId: accountId,
        listAccountIds: listIrcAccountIds,
        defaultAccountId
      });
    }
    const resolved = resolveIrcAccount({ cfg: next, accountId });
    const isDefaultAccount = accountId === DEFAULT_ACCOUNT_ID2;
    const envHost = isDefaultAccount ? process.env.IRC_HOST?.trim() : "";
    const envNick = isDefaultAccount ? process.env.IRC_NICK?.trim() : "";
    const envReady = Boolean(envHost && envNick);
    if (!resolved.configured) {
      await noteIrcSetupHelp(prompter);
    }
    let useEnv = false;
    if (envReady && isDefaultAccount && !resolved.config.host && !resolved.config.nick) {
      useEnv = await prompter.confirm({
        message: "IRC_HOST and IRC_NICK detected. Use env vars?",
        initialValue: true
      });
    }
    if (useEnv) {
      next = updateIrcAccountConfig(next, accountId, { enabled: true });
    } else {
      const host = String(
        await prompter.text({
          message: "IRC server host",
          initialValue: resolved.config.host || envHost || void 0,
          validate: (value) => String(value ?? "").trim() ? void 0 : "Required"
        })
      ).trim();
      const tls2 = await prompter.confirm({
        message: "Use TLS for IRC?",
        initialValue: resolved.config.tls ?? true
      });
      const defaultPort = resolved.config.port ?? (tls2 ? 6697 : 6667);
      const portInput = await prompter.text({
        message: "IRC server port",
        initialValue: String(defaultPort),
        validate: (value) => {
          const parsed = Number.parseInt(String(value ?? "").trim(), 10);
          return Number.isFinite(parsed) && parsed >= 1 && parsed <= 65535 ? void 0 : "Use a port between 1 and 65535";
        }
      });
      const port = parsePort(String(portInput), defaultPort);
      const nick = String(
        await prompter.text({
          message: "IRC nick",
          initialValue: resolved.config.nick || envNick || void 0,
          validate: (value) => String(value ?? "").trim() ? void 0 : "Required"
        })
      ).trim();
      const username = String(
        await prompter.text({
          message: "IRC username",
          initialValue: resolved.config.username || nick || "openclaw",
          validate: (value) => String(value ?? "").trim() ? void 0 : "Required"
        })
      ).trim();
      const realname = String(
        await prompter.text({
          message: "IRC real name",
          initialValue: resolved.config.realname || "OpenClaw",
          validate: (value) => String(value ?? "").trim() ? void 0 : "Required"
        })
      ).trim();
      const channelsRaw = await prompter.text({
        message: "Auto-join IRC channels (optional, comma-separated)",
        placeholder: "#openclaw, #ops",
        initialValue: (resolved.config.channels ?? []).join(", ")
      });
      const channels = [
        ...new Set(
          parseListInput(String(channelsRaw)).map((entry) => normalizeGroupEntry(entry)).filter((entry) => Boolean(entry && entry !== "*")).filter((entry) => isChannelTarget(entry))
        )
      ];
      next = updateIrcAccountConfig(next, accountId, {
        enabled: true,
        host,
        port,
        tls: tls2,
        nick,
        username,
        realname,
        channels: channels.length > 0 ? channels : void 0
      });
    }
    const afterConfig = resolveIrcAccount({ cfg: next, accountId });
    const accessConfig = await promptChannelAccessConfig({
      prompter,
      label: "IRC channels",
      currentPolicy: afterConfig.config.groupPolicy ?? "allowlist",
      currentEntries: Object.keys(afterConfig.config.groups ?? {}),
      placeholder: "#openclaw, #ops, *",
      updatePrompt: Boolean(afterConfig.config.groups)
    });
    if (accessConfig) {
      next = setIrcGroupAccess(next, accountId, accessConfig.policy, accessConfig.entries);
      const wantsMentions = await prompter.confirm({
        message: "Require @mention to reply in IRC channels?",
        initialValue: true
      });
      if (!wantsMentions) {
        const resolvedAfter = resolveIrcAccount({ cfg: next, accountId });
        const groups = resolvedAfter.config.groups ?? {};
        const patched = Object.fromEntries(
          Object.entries(groups).map(([key, value]) => [key, { ...value, requireMention: false }])
        );
        next = updateIrcAccountConfig(next, accountId, { groups: patched });
      }
    }
    if (forceAllowFrom) {
      next = await promptIrcAllowFrom({ cfg: next, prompter, accountId });
    }
    next = await promptIrcNickServConfig({
      cfg: next,
      prompter,
      accountId
    });
    await prompter.note(
      [
        "Next: restart gateway and verify status.",
        "Command: openclaw channels status --probe",
        `Docs: ${formatDocsLink("/channels/irc", "channels/irc")}`
      ].join("\n"),
      "IRC next steps"
    );
    return { cfg: next, accountId };
  },
  dmPolicy,
  disable: (cfg) => ({
    ...cfg,
    channels: {
      ...cfg.channels,
      irc: {
        ...cfg.channels?.irc,
        enabled: false
      }
    }
  })
};

// vendor/openclaw-runtime/win-x64/extensions/irc/src/probe.ts
function formatError(err) {
  if (err instanceof Error) {
    return err.message;
  }
  return typeof err === "string" ? err : JSON.stringify(err);
}
async function probeIrc(cfg, opts) {
  const account = resolveIrcAccount({ cfg, accountId: opts?.accountId });
  const base = {
    ok: false,
    host: account.host,
    port: account.port,
    tls: account.tls,
    nick: account.nick
  };
  if (!account.configured) {
    return {
      ...base,
      error: "missing host or nick"
    };
  }
  const started = Date.now();
  try {
    const client = await connectIrcClient(
      buildIrcConnectOptions(account, {
        connectTimeoutMs: opts?.timeoutMs ?? 8e3
      })
    );
    const elapsed = Date.now() - started;
    client.quit("probe");
    return {
      ...base,
      ok: true,
      latencyMs: elapsed
    };
  } catch (err) {
    return {
      ...base,
      error: formatError(err)
    };
  }
}

// vendor/openclaw-runtime/win-x64/extensions/irc/src/channel.ts
var meta = getChatChannelMeta("irc");
function normalizePairingTarget(raw) {
  const normalized = normalizeIrcAllowEntry(raw);
  if (!normalized) {
    return "";
  }
  return normalized.split(/[!@]/, 1)[0]?.trim() ?? "";
}
var ircPlugin = {
  id: "irc",
  meta: {
    ...meta,
    quickstartAllowFrom: true
  },
  onboarding: ircOnboardingAdapter,
  pairing: {
    idLabel: "ircUser",
    normalizeAllowEntry: (entry) => normalizeIrcAllowEntry(entry),
    notifyApproval: async ({ id }) => {
      const target = normalizePairingTarget(id);
      if (!target) {
        throw new Error(`invalid IRC pairing id: ${id}`);
      }
      await sendMessageIrc(target, PAIRING_APPROVED_MESSAGE);
    }
  },
  capabilities: {
    chatTypes: ["direct", "group"],
    media: true,
    blockStreaming: true
  },
  reload: { configPrefixes: ["channels.irc"] },
  configSchema: buildChannelConfigSchema(IrcConfigSchema),
  config: {
    listAccountIds: (cfg) => listIrcAccountIds(cfg),
    resolveAccount: (cfg, accountId) => resolveIrcAccount({ cfg, accountId }),
    defaultAccountId: (cfg) => resolveDefaultIrcAccountId(cfg),
    setAccountEnabled: ({ cfg, accountId, enabled }) => setAccountEnabledInConfigSection({
      cfg,
      sectionKey: "irc",
      accountId,
      enabled,
      allowTopLevel: true
    }),
    deleteAccount: ({ cfg, accountId }) => deleteAccountFromConfigSection({
      cfg,
      sectionKey: "irc",
      accountId,
      clearBaseFields: [
        "name",
        "host",
        "port",
        "tls",
        "nick",
        "username",
        "realname",
        "password",
        "passwordFile",
        "channels"
      ]
    }),
    isConfigured: (account) => account.configured,
    describeAccount: (account) => ({
      accountId: account.accountId,
      name: account.name,
      enabled: account.enabled,
      configured: account.configured,
      host: account.host,
      port: account.port,
      tls: account.tls,
      nick: account.nick,
      passwordSource: account.passwordSource
    }),
    resolveAllowFrom: ({ cfg, accountId }) => (resolveIrcAccount({ cfg, accountId }).config.allowFrom ?? []).map(
      (entry) => String(entry)
    ),
    formatAllowFrom: ({ allowFrom }) => allowFrom.map((entry) => normalizeIrcAllowEntry(String(entry))).filter(Boolean),
    resolveDefaultTo: ({ cfg, accountId }) => resolveIrcAccount({ cfg, accountId }).config.defaultTo?.trim() || void 0
  },
  security: {
    resolveDmPolicy: ({ cfg, accountId, account }) => {
      const resolvedAccountId = accountId ?? account.accountId ?? DEFAULT_ACCOUNT_ID3;
      const useAccountPath = Boolean(cfg.channels?.irc?.accounts?.[resolvedAccountId]);
      const basePath = useAccountPath ? `channels.irc.accounts.${resolvedAccountId}.` : "channels.irc.";
      return {
        policy: account.config.dmPolicy ?? "pairing",
        allowFrom: account.config.allowFrom ?? [],
        policyPath: `${basePath}dmPolicy`,
        allowFromPath: `${basePath}allowFrom`,
        approveHint: formatPairingApproveHint("irc"),
        normalizeEntry: (raw) => normalizeIrcAllowEntry(raw)
      };
    },
    collectWarnings: ({ account, cfg }) => {
      const warnings = [];
      const defaultGroupPolicy = resolveDefaultGroupPolicy2(cfg);
      const { groupPolicy } = resolveAllowlistProviderRuntimeGroupPolicy2({
        providerConfigPresent: cfg.channels?.irc !== void 0,
        groupPolicy: account.config.groupPolicy,
        defaultGroupPolicy
      });
      if (groupPolicy === "open") {
        warnings.push(
          '- IRC channels: groupPolicy="open" allows all channels and senders (mention-gated). Prefer channels.irc.groupPolicy="allowlist" with channels.irc.groups.'
        );
      }
      if (!account.config.tls) {
        warnings.push(
          "- IRC TLS is disabled (channels.irc.tls=false); traffic and credentials are plaintext."
        );
      }
      if (account.config.nickserv?.register) {
        warnings.push(
          '- IRC NickServ registration is enabled (channels.irc.nickserv.register=true); this sends "REGISTER" on every connect. Disable after first successful registration.'
        );
        if (!account.config.nickserv.password?.trim()) {
          warnings.push(
            "- IRC NickServ registration is enabled but no NickServ password is resolved; set channels.irc.nickserv.password, channels.irc.nickserv.passwordFile, or IRC_NICKSERV_PASSWORD."
          );
        }
      }
      return warnings;
    }
  },
  groups: {
    resolveRequireMention: ({ cfg, accountId, groupId }) => {
      const account = resolveIrcAccount({ cfg, accountId });
      if (!groupId) {
        return true;
      }
      const match = resolveIrcGroupMatch({ groups: account.config.groups, target: groupId });
      return resolveIrcRequireMention({
        groupConfig: match.groupConfig,
        wildcardConfig: match.wildcardConfig
      });
    },
    resolveToolPolicy: ({ cfg, accountId, groupId }) => {
      const account = resolveIrcAccount({ cfg, accountId });
      if (!groupId) {
        return void 0;
      }
      const match = resolveIrcGroupMatch({ groups: account.config.groups, target: groupId });
      return match.groupConfig?.tools ?? match.wildcardConfig?.tools;
    }
  },
  messaging: {
    normalizeTarget: normalizeIrcMessagingTarget,
    targetResolver: {
      looksLikeId: looksLikeIrcTargetId,
      hint: "<#channel|nick>"
    }
  },
  resolver: {
    resolveTargets: async ({ inputs, kind }) => {
      return inputs.map((input) => {
        const normalized = normalizeIrcMessagingTarget(input);
        if (!normalized) {
          return {
            input,
            resolved: false,
            note: "invalid IRC target"
          };
        }
        if (kind === "group") {
          const groupId = isChannelTarget(normalized) ? normalized : `#${normalized}`;
          return {
            input,
            resolved: true,
            id: groupId,
            name: groupId
          };
        }
        if (isChannelTarget(normalized)) {
          return {
            input,
            resolved: false,
            note: "expected user target"
          };
        }
        return {
          input,
          resolved: true,
          id: normalized,
          name: normalized
        };
      });
    }
  },
  directory: {
    self: async () => null,
    listPeers: async ({ cfg, accountId, query, limit }) => {
      const account = resolveIrcAccount({ cfg, accountId });
      const q = query?.trim().toLowerCase() ?? "";
      const ids = /* @__PURE__ */ new Set();
      for (const entry of account.config.allowFrom ?? []) {
        const normalized = normalizePairingTarget(String(entry));
        if (normalized && normalized !== "*") {
          ids.add(normalized);
        }
      }
      for (const entry of account.config.groupAllowFrom ?? []) {
        const normalized = normalizePairingTarget(String(entry));
        if (normalized && normalized !== "*") {
          ids.add(normalized);
        }
      }
      for (const group of Object.values(account.config.groups ?? {})) {
        for (const entry of group.allowFrom ?? []) {
          const normalized = normalizePairingTarget(String(entry));
          if (normalized && normalized !== "*") {
            ids.add(normalized);
          }
        }
      }
      return Array.from(ids).filter((id) => q ? id.includes(q) : true).slice(0, limit && limit > 0 ? limit : void 0).map((id) => ({ kind: "user", id }));
    },
    listGroups: async ({ cfg, accountId, query, limit }) => {
      const account = resolveIrcAccount({ cfg, accountId });
      const q = query?.trim().toLowerCase() ?? "";
      const groupIds = /* @__PURE__ */ new Set();
      for (const channel2 of account.config.channels ?? []) {
        const normalized = normalizeIrcMessagingTarget(channel2);
        if (normalized && isChannelTarget(normalized)) {
          groupIds.add(normalized);
        }
      }
      for (const group of Object.keys(account.config.groups ?? {})) {
        if (group === "*") {
          continue;
        }
        const normalized = normalizeIrcMessagingTarget(group);
        if (normalized && isChannelTarget(normalized)) {
          groupIds.add(normalized);
        }
      }
      return Array.from(groupIds).filter((id) => q ? id.toLowerCase().includes(q) : true).slice(0, limit && limit > 0 ? limit : void 0).map((id) => ({ kind: "group", id, name: id }));
    }
  },
  outbound: {
    deliveryMode: "direct",
    chunker: (text, limit) => getIrcRuntime().channel.text.chunkMarkdownText(text, limit),
    chunkerMode: "markdown",
    textChunkLimit: 350,
    sendText: async ({ to, text, accountId, replyToId }) => {
      const result = await sendMessageIrc(to, text, {
        accountId: accountId ?? void 0,
        replyTo: replyToId ?? void 0
      });
      return { channel: "irc", ...result };
    },
    sendMedia: async ({ to, text, mediaUrl, accountId, replyToId }) => {
      const combined = mediaUrl ? `${text}

Attachment: ${mediaUrl}` : text;
      const result = await sendMessageIrc(to, combined, {
        accountId: accountId ?? void 0,
        replyTo: replyToId ?? void 0
      });
      return { channel: "irc", ...result };
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
    buildChannelSummary: ({ account, snapshot }) => ({
      ...buildBaseChannelStatusSummary(snapshot),
      host: account.host,
      port: snapshot.port,
      tls: account.tls,
      nick: account.nick,
      probe: snapshot.probe,
      lastProbeAt: snapshot.lastProbeAt ?? null
    }),
    probeAccount: async ({ cfg, account, timeoutMs }) => probeIrc(cfg, { accountId: account.accountId, timeoutMs }),
    buildAccountSnapshot: ({ account, runtime: runtime2, probe }) => ({
      ...buildBaseAccountStatusSnapshot({ account, runtime: runtime2, probe }),
      host: account.host,
      port: account.port,
      tls: account.tls,
      nick: account.nick,
      passwordSource: account.passwordSource
    })
  },
  gateway: {
    startAccount: async (ctx) => {
      const account = ctx.account;
      if (!account.configured) {
        throw new Error(
          `IRC is not configured for account "${account.accountId}" (need host and nick in channels.irc).`
        );
      }
      ctx.log?.info(
        `[${account.accountId}] starting IRC provider (${account.host}:${account.port}${account.tls ? " tls" : ""})`
      );
      const { stop } = await monitorIrcProvider({
        accountId: account.accountId,
        config: ctx.cfg,
        runtime: ctx.runtime,
        abortSignal: ctx.abortSignal,
        statusSink: (patch) => ctx.setStatus({ accountId: ctx.accountId, ...patch })
      });
      return { stop };
    }
  }
};

// vendor/openclaw-runtime/win-x64/extensions/irc/index.ts
var plugin = {
  id: "irc",
  name: "IRC",
  description: "IRC channel plugin",
  configSchema: emptyPluginConfigSchema(),
  register(api) {
    setIrcRuntime(api.runtime);
    api.registerChannel({ plugin: ircPlugin });
  }
};
var irc_default = plugin;
export {
  irc_default as default
};
