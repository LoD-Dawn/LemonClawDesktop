var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// vendor/openclaw-runtime/win-x64/extensions/twitch/src/token.ts
import { DEFAULT_ACCOUNT_ID as DEFAULT_ACCOUNT_ID2, normalizeAccountId } from "../../../src/routing/session-key.js";
function normalizeTwitchToken(raw) {
  if (!raw) {
    return void 0;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return void 0;
  }
  return trimmed.startsWith("oauth:") ? trimmed : `oauth:${trimmed}`;
}
function resolveTwitchToken(cfg, opts = {}) {
  const accountId = normalizeAccountId(opts.accountId);
  const twitchCfg = cfg?.channels?.twitch;
  const accountCfg = accountId === DEFAULT_ACCOUNT_ID2 ? twitchCfg?.accounts?.[DEFAULT_ACCOUNT_ID2] : twitchCfg?.accounts?.[accountId];
  let token;
  if (accountId === DEFAULT_ACCOUNT_ID2) {
    token = normalizeTwitchToken(
      (typeof twitchCfg?.accessToken === "string" ? twitchCfg.accessToken : void 0) || accountCfg?.accessToken
    );
  } else {
    token = normalizeTwitchToken(accountCfg?.accessToken);
  }
  if (token) {
    return { token, source: "config" };
  }
  const allowEnv = accountId === DEFAULT_ACCOUNT_ID2;
  const envToken = allowEnv ? normalizeTwitchToken(opts.envToken ?? process.env.OPENCLAW_TWITCH_ACCESS_TOKEN) : void 0;
  if (envToken) {
    return { token: envToken, source: "env" };
  }
  return { token: "", source: "none" };
}
var init_token = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/twitch/src/token.ts"() {
    "use strict";
  }
});

// vendor/openclaw-runtime/win-x64/extensions/twitch/src/utils/twitch.ts
import { randomUUID } from "crypto";
function normalizeTwitchChannel(channel2) {
  const trimmed = channel2.trim().toLowerCase();
  return trimmed.startsWith("#") ? trimmed.slice(1) : trimmed;
}
function missingTargetError(provider, hint) {
  return new Error(`Delivering to ${provider} requires target${hint ? ` ${hint}` : ""}`);
}
function generateMessageId() {
  return `${Date.now()}-${randomUUID()}`;
}
function normalizeToken(token) {
  return token.startsWith("oauth:") ? token.slice(6) : token;
}
function isAccountConfigured(account, resolvedToken) {
  const token = resolvedToken ?? account?.accessToken;
  return Boolean(account?.username && token && account?.clientId);
}
var init_twitch = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/twitch/src/utils/twitch.ts"() {
    "use strict";
  }
});

// vendor/openclaw-runtime/win-x64/extensions/twitch/src/twitch-client.ts
import { RefreshingAuthProvider, StaticAuthProvider } from "@twurple/auth";
import { ChatClient, LogLevel } from "@twurple/chat";
var TwitchClientManager;
var init_twitch_client = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/twitch/src/twitch-client.ts"() {
    "use strict";
    init_token();
    init_twitch();
    TwitchClientManager = class {
      constructor(logger) {
        this.logger = logger;
      }
      clients = /* @__PURE__ */ new Map();
      messageHandlers = /* @__PURE__ */ new Map();
      /**
       * Create an auth provider for the account.
       */
      async createAuthProvider(account, normalizedToken) {
        if (!account.clientId) {
          throw new Error("Missing Twitch client ID");
        }
        if (account.clientSecret) {
          const authProvider = new RefreshingAuthProvider({
            clientId: account.clientId,
            clientSecret: account.clientSecret
          });
          await authProvider.addUserForToken({
            accessToken: normalizedToken,
            refreshToken: account.refreshToken ?? null,
            expiresIn: account.expiresIn ?? null,
            obtainmentTimestamp: account.obtainmentTimestamp ?? Date.now()
          }).then((userId) => {
            this.logger.info(
              `Added user ${userId} to RefreshingAuthProvider for ${account.username}`
            );
          }).catch((err) => {
            this.logger.error(
              `Failed to add user to RefreshingAuthProvider: ${err instanceof Error ? err.message : String(err)}`
            );
          });
          authProvider.onRefresh((userId, token) => {
            this.logger.info(
              `Access token refreshed for user ${userId} (expires in ${token.expiresIn ? `${token.expiresIn}s` : "unknown"})`
            );
          });
          authProvider.onRefreshFailure((userId, error) => {
            this.logger.error(`Failed to refresh access token for user ${userId}: ${error.message}`);
          });
          const refreshStatus = account.refreshToken ? "automatic token refresh enabled" : "token refresh disabled (no refresh token)";
          this.logger.info(`Using RefreshingAuthProvider for ${account.username} (${refreshStatus})`);
          return authProvider;
        }
        this.logger.info(`Using StaticAuthProvider for ${account.username} (no clientSecret provided)`);
        return new StaticAuthProvider(account.clientId, normalizedToken);
      }
      /**
       * Get or create a chat client for an account
       */
      async getClient(account, cfg, accountId) {
        const key = this.getAccountKey(account);
        const existing = this.clients.get(key);
        if (existing) {
          return existing;
        }
        const tokenResolution = resolveTwitchToken(cfg, {
          accountId
        });
        if (!tokenResolution.token) {
          this.logger.error(
            `Missing Twitch token for account ${account.username} (set channels.twitch.accounts.${account.username}.token or OPENCLAW_TWITCH_ACCESS_TOKEN for default)`
          );
          throw new Error("Missing Twitch token");
        }
        this.logger.debug?.(`Using ${tokenResolution.source} token source for ${account.username}`);
        if (!account.clientId) {
          this.logger.error(`Missing Twitch client ID for account ${account.username}`);
          throw new Error("Missing Twitch client ID");
        }
        const normalizedToken = normalizeToken(tokenResolution.token);
        const authProvider = await this.createAuthProvider(account, normalizedToken);
        const client = new ChatClient({
          authProvider,
          channels: [account.channel],
          rejoinChannelsOnReconnect: true,
          requestMembershipEvents: true,
          logger: {
            minLevel: LogLevel.WARNING,
            custom: {
              log: (level, message) => {
                switch (level) {
                  case LogLevel.CRITICAL:
                    this.logger.error(message);
                    break;
                  case LogLevel.ERROR:
                    this.logger.error(message);
                    break;
                  case LogLevel.WARNING:
                    this.logger.warn(message);
                    break;
                  case LogLevel.INFO:
                    this.logger.info(message);
                    break;
                  case LogLevel.DEBUG:
                    this.logger.debug?.(message);
                    break;
                  case LogLevel.TRACE:
                    this.logger.debug?.(message);
                    break;
                }
              }
            }
          }
        });
        this.setupClientHandlers(client, account);
        client.connect();
        this.clients.set(key, client);
        this.logger.info(`Connected to Twitch as ${account.username}`);
        return client;
      }
      /**
       * Set up message and event handlers for a client
       */
      setupClientHandlers(client, account) {
        const key = this.getAccountKey(account);
        client.onMessage((channelName, _user, messageText, msg) => {
          const handler = this.messageHandlers.get(key);
          if (handler) {
            const normalizedChannel = channelName.startsWith("#") ? channelName.slice(1) : channelName;
            const from = `twitch:${msg.userInfo.userName}`;
            const preview = messageText.slice(0, 100).replace(/\n/g, "\\n");
            this.logger.debug?.(
              `twitch inbound: channel=${normalizedChannel} from=${from} len=${messageText.length} preview="${preview}"`
            );
            handler({
              username: msg.userInfo.userName,
              displayName: msg.userInfo.displayName,
              userId: msg.userInfo.userId,
              message: messageText,
              channel: normalizedChannel,
              id: msg.id,
              timestamp: /* @__PURE__ */ new Date(),
              isMod: msg.userInfo.isMod,
              isOwner: msg.userInfo.isBroadcaster,
              isVip: msg.userInfo.isVip,
              isSub: msg.userInfo.isSubscriber,
              chatType: "group"
            });
          }
        });
        this.logger.info(`Set up handlers for ${key}`);
      }
      /**
       * Set a message handler for an account
       * @returns A function that removes the handler when called
       */
      onMessage(account, handler) {
        const key = this.getAccountKey(account);
        this.messageHandlers.set(key, handler);
        return () => {
          this.messageHandlers.delete(key);
        };
      }
      /**
       * Disconnect a client
       */
      async disconnect(account) {
        const key = this.getAccountKey(account);
        const client = this.clients.get(key);
        if (client) {
          client.quit();
          this.clients.delete(key);
          this.messageHandlers.delete(key);
          this.logger.info(`Disconnected ${key}`);
        }
      }
      /**
       * Disconnect all clients
       */
      async disconnectAll() {
        this.clients.forEach((client) => client.quit());
        this.clients.clear();
        this.messageHandlers.clear();
        this.logger.info(" Disconnected all clients");
      }
      /**
       * Send a message to a channel
       */
      async sendMessage(account, channel2, message, cfg, accountId) {
        try {
          const client = await this.getClient(account, cfg, accountId);
          const messageId = crypto.randomUUID();
          await client.say(channel2, message);
          return { ok: true, messageId };
        } catch (error) {
          this.logger.error(
            `Failed to send message: ${error instanceof Error ? error.message : String(error)}`
          );
          return {
            ok: false,
            error: error instanceof Error ? error.message : String(error)
          };
        }
      }
      /**
       * Generate a unique key for an account
       */
      getAccountKey(account) {
        return `${account.username}:${account.channel}`;
      }
      /**
       * Clear all clients and handlers (for testing)
       */
      _clearForTest() {
        this.clients.clear();
        this.messageHandlers.clear();
      }
    };
  }
});

// vendor/openclaw-runtime/win-x64/extensions/twitch/src/client-manager-registry.ts
function getOrCreateClientManager(accountId, logger) {
  const existing = registry.get(accountId);
  if (existing) {
    return existing.manager;
  }
  const manager = new TwitchClientManager(logger);
  registry.set(accountId, {
    manager,
    accountId,
    logger,
    createdAt: Date.now()
  });
  logger.info(`Registered client manager for account: ${accountId}`);
  return manager;
}
function getClientManager(accountId) {
  return registry.get(accountId)?.manager;
}
async function removeClientManager(accountId) {
  const entry = registry.get(accountId);
  if (!entry) {
    return;
  }
  await entry.manager.disconnectAll();
  registry.delete(accountId);
  entry.logger.info(`Unregistered client manager for account: ${accountId}`);
}
var registry;
var init_client_manager_registry = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/twitch/src/client-manager-registry.ts"() {
    "use strict";
    init_twitch_client();
    registry = /* @__PURE__ */ new Map();
  }
});

// vendor/openclaw-runtime/win-x64/extensions/twitch/src/utils/markdown.ts
function stripMarkdownForTwitch(markdown) {
  return markdown.replace(/!\[[^\]]*]\([^)]+\)/g, "").replace(/\[([^\]]+)]\([^)]+\)/g, "$1").replace(/\*\*([^*]+)\*\*/g, "$1").replace(/__([^_]+)__/g, "$1").replace(/\*([^*]+)\*/g, "$1").replace(/_([^_]+)_/g, "$1").replace(/~~([^~]+)~~/g, "$1").replace(/```[\s\S]*?```/g, (block) => block.replace(/```[^\n]*\n?/g, "").replace(/```/g, "")).replace(/`([^`]+)`/g, "$1").replace(/^#{1,6}\s+/gm, "").replace(/^\s*[-*+]\s+/gm, "").replace(/^\s*\d+\.\s+/gm, "").replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n/g, " ").replace(/[ \t]{2,}/g, " ").trim();
}
function chunkTextForTwitch(text, limit) {
  const cleaned = stripMarkdownForTwitch(text);
  if (!cleaned) {
    return [];
  }
  if (limit <= 0) {
    return [cleaned];
  }
  if (cleaned.length <= limit) {
    return [cleaned];
  }
  const chunks = [];
  let remaining = cleaned;
  while (remaining.length > limit) {
    const window = remaining.slice(0, limit);
    const lastSpaceIndex = window.lastIndexOf(" ");
    if (lastSpaceIndex === -1) {
      chunks.push(window);
      remaining = remaining.slice(limit);
    } else {
      chunks.push(window.slice(0, lastSpaceIndex));
      remaining = remaining.slice(lastSpaceIndex + 1);
    }
  }
  if (remaining) {
    chunks.push(remaining);
  }
  return chunks;
}
var init_markdown = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/twitch/src/utils/markdown.ts"() {
    "use strict";
  }
});

// vendor/openclaw-runtime/win-x64/extensions/twitch/src/access-control.ts
function checkTwitchAccessControl(params) {
  const { message, account, botUsername } = params;
  if (account.requireMention ?? true) {
    const mentions = extractMentions(message.message);
    if (!mentions.includes(botUsername.toLowerCase())) {
      return {
        allowed: false,
        reason: "message does not mention the bot (requireMention is enabled)"
      };
    }
  }
  if (account.allowFrom && account.allowFrom.length > 0) {
    const allowFrom = account.allowFrom;
    const senderId = message.userId;
    if (!senderId) {
      return {
        allowed: false,
        reason: "sender user ID not available for allowlist check"
      };
    }
    if (allowFrom.includes(senderId)) {
      return {
        allowed: true,
        matchKey: senderId,
        matchSource: "allowlist"
      };
    }
    return {
      allowed: false,
      reason: "sender is not in allowFrom allowlist"
    };
  }
  if (account.allowedRoles && account.allowedRoles.length > 0) {
    const allowedRoles = account.allowedRoles;
    if (allowedRoles.includes("all")) {
      return {
        allowed: true,
        matchKey: "all",
        matchSource: "role"
      };
    }
    const hasAllowedRole = checkSenderRoles({
      message,
      allowedRoles
    });
    if (!hasAllowedRole) {
      return {
        allowed: false,
        reason: `sender does not have any of the required roles: ${allowedRoles.join(", ")}`
      };
    }
    return {
      allowed: true,
      matchKey: allowedRoles.join(","),
      matchSource: "role"
    };
  }
  return {
    allowed: true
  };
}
function checkSenderRoles(params) {
  const { message, allowedRoles } = params;
  const { isMod, isOwner, isVip, isSub } = message;
  for (const role of allowedRoles) {
    switch (role) {
      case "moderator":
        if (isMod) {
          return true;
        }
        break;
      case "owner":
        if (isOwner) {
          return true;
        }
        break;
      case "vip":
        if (isVip) {
          return true;
        }
        break;
      case "subscriber":
        if (isSub) {
          return true;
        }
        break;
    }
  }
  return false;
}
function extractMentions(message) {
  const mentionRegex = /@(\w+)/g;
  const mentions = [];
  let match;
  while ((match = mentionRegex.exec(message)) !== null) {
    const username = match[1];
    if (username) {
      mentions.push(username.toLowerCase());
    }
  }
  return mentions;
}
var init_access_control = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/twitch/src/access-control.ts"() {
    "use strict";
  }
});

// vendor/openclaw-runtime/win-x64/extensions/twitch/src/runtime.ts
function setTwitchRuntime(next) {
  runtime = next;
}
function getTwitchRuntime() {
  if (!runtime) {
    throw new Error("Twitch runtime not initialized");
  }
  return runtime;
}
var runtime;
var init_runtime = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/twitch/src/runtime.ts"() {
    "use strict";
    runtime = null;
  }
});

// vendor/openclaw-runtime/win-x64/extensions/twitch/src/monitor.ts
var monitor_exports = {};
__export(monitor_exports, {
  monitorTwitchProvider: () => monitorTwitchProvider
});
import { createReplyPrefixOptions } from "openclaw/plugin-sdk";
async function processTwitchMessage(params) {
  const { message, account, accountId, config, runtime: runtime2, core, statusSink } = params;
  const cfg = config;
  const route = core.channel.routing.resolveAgentRoute({
    cfg,
    channel: "twitch",
    accountId,
    peer: {
      kind: "group",
      // Twitch chat is always group-like
      id: message.channel
    }
  });
  const rawBody = message.message;
  const body = core.channel.reply.formatAgentEnvelope({
    channel: "Twitch",
    from: message.displayName ?? message.username,
    timestamp: message.timestamp?.getTime(),
    envelope: core.channel.reply.resolveEnvelopeFormatOptions(cfg),
    body: rawBody
  });
  const ctxPayload = core.channel.reply.finalizeInboundContext({
    Body: body,
    BodyForAgent: rawBody,
    RawBody: rawBody,
    CommandBody: rawBody,
    From: `twitch:user:${message.userId}`,
    To: `twitch:channel:${message.channel}`,
    SessionKey: route.sessionKey,
    AccountId: route.accountId,
    ChatType: "group",
    ConversationLabel: message.channel,
    SenderName: message.displayName ?? message.username,
    SenderId: message.userId,
    SenderUsername: message.username,
    Provider: "twitch",
    Surface: "twitch",
    MessageSid: message.id,
    OriginatingChannel: "twitch",
    OriginatingTo: `twitch:channel:${message.channel}`
  });
  const storePath = core.channel.session.resolveStorePath(cfg.session?.store, {
    agentId: route.agentId
  });
  await core.channel.session.recordInboundSession({
    storePath,
    sessionKey: ctxPayload.SessionKey ?? route.sessionKey,
    ctx: ctxPayload,
    onRecordError: (err) => {
      runtime2.error?.(`Failed updating session meta: ${String(err)}`);
    }
  });
  const tableMode = core.channel.text.resolveMarkdownTableMode({
    cfg,
    channel: "twitch",
    accountId
  });
  const { onModelSelected, ...prefixOptions } = createReplyPrefixOptions({
    cfg,
    agentId: route.agentId,
    channel: "twitch",
    accountId
  });
  await core.channel.reply.dispatchReplyWithBufferedBlockDispatcher({
    ctx: ctxPayload,
    cfg,
    dispatcherOptions: {
      ...prefixOptions,
      deliver: async (payload) => {
        await deliverTwitchReply({
          payload,
          channel: message.channel,
          account,
          accountId,
          config,
          tableMode,
          runtime: runtime2,
          statusSink
        });
      }
    },
    replyOptions: {
      onModelSelected
    }
  });
}
async function deliverTwitchReply(params) {
  const { payload, channel: channel2, account, accountId, config, runtime: runtime2, statusSink } = params;
  try {
    const clientManager = getOrCreateClientManager(accountId, {
      info: (msg) => runtime2.log?.(msg),
      warn: (msg) => runtime2.log?.(msg),
      error: (msg) => runtime2.error?.(msg),
      debug: (msg) => runtime2.log?.(msg)
    });
    const client = await clientManager.getClient(
      account,
      config,
      accountId
    );
    if (!client) {
      runtime2.error?.(`No client available for sending reply`);
      return;
    }
    if (!payload.text) {
      runtime2.error?.(`No text to send in reply payload`);
      return;
    }
    const textToSend = stripMarkdownForTwitch(payload.text);
    await client.say(channel2, textToSend);
    statusSink?.({ lastOutboundAt: Date.now() });
  } catch (err) {
    runtime2.error?.(`Failed to send reply: ${String(err)}`);
  }
}
async function monitorTwitchProvider(options) {
  const { account, accountId, config, runtime: runtime2, abortSignal, statusSink } = options;
  const core = getTwitchRuntime();
  let stopped = false;
  const coreLogger = core.logging.getChildLogger({ module: "twitch" });
  const logVerboseMessage = (message) => {
    if (!core.logging.shouldLogVerbose()) {
      return;
    }
    coreLogger.debug?.(message);
  };
  const logger = {
    info: (msg) => coreLogger.info(msg),
    warn: (msg) => coreLogger.warn(msg),
    error: (msg) => coreLogger.error(msg),
    debug: logVerboseMessage
  };
  const clientManager = getOrCreateClientManager(accountId, logger);
  try {
    await clientManager.getClient(
      account,
      config,
      accountId
    );
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    runtime2.error?.(`Failed to connect: ${errorMsg}`);
    throw error;
  }
  const unregisterHandler = clientManager.onMessage(account, (message) => {
    if (stopped) {
      return;
    }
    const botUsername = account.username.toLowerCase();
    if (message.username.toLowerCase() === botUsername) {
      return;
    }
    const access = checkTwitchAccessControl({
      message,
      account,
      botUsername
    });
    if (!access.allowed) {
      return;
    }
    statusSink?.({ lastInboundAt: Date.now() });
    void processTwitchMessage({
      message,
      account,
      accountId,
      config,
      runtime: runtime2,
      core,
      statusSink
    }).catch((err) => {
      runtime2.error?.(`Message processing failed: ${String(err)}`);
    });
  });
  const stop = () => {
    stopped = true;
    unregisterHandler();
  };
  abortSignal.addEventListener("abort", stop, { once: true });
  return { stop };
}
var init_monitor = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/twitch/src/monitor.ts"() {
    "use strict";
    init_access_control();
    init_client_manager_registry();
    init_runtime();
    init_markdown();
  }
});

// vendor/openclaw-runtime/win-x64/extensions/twitch/index.ts
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";

// vendor/openclaw-runtime/win-x64/extensions/twitch/src/plugin.ts
import { buildChannelConfigSchema } from "openclaw/plugin-sdk";

// vendor/openclaw-runtime/win-x64/extensions/twitch/src/config.ts
var DEFAULT_ACCOUNT_ID = "default";
function getAccountConfig(coreConfig, accountId) {
  if (!coreConfig || typeof coreConfig !== "object") {
    return null;
  }
  const cfg = coreConfig;
  const twitch = cfg.channels?.twitch;
  const twitchRaw = twitch;
  const accounts = twitchRaw?.accounts;
  if (accountId === DEFAULT_ACCOUNT_ID) {
    const accountFromAccounts = accounts?.[DEFAULT_ACCOUNT_ID];
    const baseLevel = {
      username: typeof twitchRaw?.username === "string" ? twitchRaw.username : void 0,
      accessToken: typeof twitchRaw?.accessToken === "string" ? twitchRaw.accessToken : void 0,
      clientId: typeof twitchRaw?.clientId === "string" ? twitchRaw.clientId : void 0,
      channel: typeof twitchRaw?.channel === "string" ? twitchRaw.channel : void 0,
      enabled: typeof twitchRaw?.enabled === "boolean" ? twitchRaw.enabled : void 0,
      allowFrom: Array.isArray(twitchRaw?.allowFrom) ? twitchRaw.allowFrom : void 0,
      allowedRoles: Array.isArray(twitchRaw?.allowedRoles) ? twitchRaw.allowedRoles : void 0,
      requireMention: typeof twitchRaw?.requireMention === "boolean" ? twitchRaw.requireMention : void 0,
      clientSecret: typeof twitchRaw?.clientSecret === "string" ? twitchRaw.clientSecret : void 0,
      refreshToken: typeof twitchRaw?.refreshToken === "string" ? twitchRaw.refreshToken : void 0,
      expiresIn: typeof twitchRaw?.expiresIn === "number" ? twitchRaw.expiresIn : void 0,
      obtainmentTimestamp: typeof twitchRaw?.obtainmentTimestamp === "number" ? twitchRaw.obtainmentTimestamp : void 0
    };
    const merged = {
      ...accountFromAccounts,
      ...baseLevel
    };
    if (merged.username) {
      return merged;
    }
    if (accountFromAccounts) {
      return accountFromAccounts;
    }
    return null;
  }
  if (!accounts || !accounts[accountId]) {
    return null;
  }
  return accounts[accountId];
}
function listAccountIds(cfg) {
  const twitch = cfg.channels?.twitch;
  const twitchRaw = twitch;
  const accountMap = twitchRaw?.accounts;
  const ids = [];
  if (accountMap) {
    ids.push(...Object.keys(accountMap));
  }
  const hasBaseLevelConfig = twitchRaw && (typeof twitchRaw.username === "string" || typeof twitchRaw.accessToken === "string" || typeof twitchRaw.channel === "string");
  if (hasBaseLevelConfig && !ids.includes(DEFAULT_ACCOUNT_ID)) {
    ids.push(DEFAULT_ACCOUNT_ID);
  }
  return ids;
}

// vendor/openclaw-runtime/win-x64/extensions/twitch/src/send.ts
init_client_manager_registry();
init_token();
init_markdown();
init_twitch();
async function sendMessageTwitchInternal(channel2, text, cfg, accountId = DEFAULT_ACCOUNT_ID, stripMarkdown = true, logger = console) {
  const account = getAccountConfig(cfg, accountId);
  if (!account) {
    const availableIds = Object.keys(cfg.channels?.twitch?.accounts ?? {});
    return {
      ok: false,
      messageId: generateMessageId(),
      error: `Account not found: ${accountId}. Available accounts: ${availableIds.join(", ") || "none"}`
    };
  }
  const tokenResolution = resolveTwitchToken(cfg, { accountId });
  if (!isAccountConfigured(account, tokenResolution.token)) {
    return {
      ok: false,
      messageId: generateMessageId(),
      error: `Account ${accountId} is not properly configured. Required: username, clientId, and token (config or env for default account).`
    };
  }
  const normalizedChannel = channel2 || account.channel;
  if (!normalizedChannel) {
    return {
      ok: false,
      messageId: generateMessageId(),
      error: "No channel specified and no default channel in account config"
    };
  }
  const cleanedText = stripMarkdown ? stripMarkdownForTwitch(text) : text;
  if (!cleanedText) {
    return {
      ok: true,
      messageId: "skipped"
    };
  }
  const clientManager = getClientManager(accountId);
  if (!clientManager) {
    return {
      ok: false,
      messageId: generateMessageId(),
      error: `Client manager not found for account: ${accountId}. Please start the Twitch gateway first.`
    };
  }
  try {
    const result = await clientManager.sendMessage(
      account,
      normalizeTwitchChannel(normalizedChannel),
      cleanedText,
      cfg,
      accountId
    );
    if (!result.ok) {
      return {
        ok: false,
        messageId: result.messageId ?? generateMessageId(),
        error: result.error ?? "Send failed"
      };
    }
    return {
      ok: true,
      messageId: result.messageId ?? generateMessageId()
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to send message: ${errorMsg}`);
    return {
      ok: false,
      messageId: generateMessageId(),
      error: errorMsg
    };
  }
}

// vendor/openclaw-runtime/win-x64/extensions/twitch/src/outbound.ts
init_markdown();
init_twitch();
var twitchOutbound = {
  /** Direct delivery mode - messages are sent immediately */
  deliveryMode: "direct",
  /** Twitch chat message limit is 500 characters */
  textChunkLimit: 500,
  /** Word-boundary chunker with markdown stripping */
  chunker: chunkTextForTwitch,
  /**
   * Resolve target from context.
   *
   * Handles target resolution with allowlist support for implicit/heartbeat modes.
   * For explicit mode, accepts any valid channel name.
   *
   * @param params - Resolution parameters
   * @returns Resolved target or error
   */
  resolveTarget: ({ to, allowFrom, mode }) => {
    const trimmed = to?.trim() ?? "";
    const allowListRaw = (allowFrom ?? []).map((entry) => String(entry).trim()).filter(Boolean);
    const hasWildcard = allowListRaw.includes("*");
    const allowList = allowListRaw.filter((entry) => entry !== "*").map((entry) => normalizeTwitchChannel(entry)).filter((entry) => entry.length > 0);
    if (trimmed) {
      const normalizedTo = normalizeTwitchChannel(trimmed);
      if (!normalizedTo) {
        return {
          ok: false,
          error: missingTargetError("Twitch", "<channel-name>")
        };
      }
      if (mode === "implicit" || mode === "heartbeat") {
        if (hasWildcard || allowList.length === 0) {
          return { ok: true, to: normalizedTo };
        }
        if (allowList.includes(normalizedTo)) {
          return { ok: true, to: normalizedTo };
        }
        return {
          ok: false,
          error: missingTargetError("Twitch", "<channel-name>")
        };
      }
      return { ok: true, to: normalizedTo };
    }
    return {
      ok: false,
      error: missingTargetError("Twitch", "<channel-name>")
    };
  },
  /**
   * Send a text message to a Twitch channel.
   *
   * Strips markdown if enabled, validates account configuration,
   * and sends the message via the Twitch client.
   *
   * @param params - Send parameters including target, text, and config
   * @returns Delivery result with message ID and status
   *
   * @example
   * const result = await twitchOutbound.sendText({
   *   cfg: openclawConfig,
   *   to: "#mychannel",
   *   text: "Hello Twitch!",
   *   accountId: "default",
   * });
   */
  sendText: async (params) => {
    const { cfg, to, text, accountId } = params;
    const signal = params.signal;
    if (signal?.aborted) {
      throw new Error("Outbound delivery aborted");
    }
    const resolvedAccountId = accountId ?? DEFAULT_ACCOUNT_ID;
    const account = getAccountConfig(cfg, resolvedAccountId);
    if (!account) {
      const availableIds = Object.keys(cfg.channels?.twitch?.accounts ?? {});
      throw new Error(
        `Twitch account not found: ${resolvedAccountId}. Available accounts: ${availableIds.join(", ") || "none"}`
      );
    }
    const channel2 = to || account.channel;
    if (!channel2) {
      throw new Error("No channel specified and no default channel in account config");
    }
    const result = await sendMessageTwitchInternal(
      normalizeTwitchChannel(channel2),
      text,
      cfg,
      resolvedAccountId,
      true,
      // stripMarkdown
      console
    );
    if (!result.ok) {
      throw new Error(result.error ?? "Send failed");
    }
    return {
      channel: "twitch",
      messageId: result.messageId,
      timestamp: Date.now()
    };
  },
  /**
   * Send media to a Twitch channel.
   *
   * Note: Twitch chat doesn't support direct media uploads.
   * This sends the media URL as text instead.
   *
   * @param params - Send parameters including media URL
   * @returns Delivery result with message ID and status
   *
   * @example
   * const result = await twitchOutbound.sendMedia({
   *   cfg: openclawConfig,
   *   to: "#mychannel",
   *   text: "Check this out!",
   *   mediaUrl: "https://example.com/image.png",
   *   accountId: "default",
   * });
   */
  sendMedia: async (params) => {
    const { text, mediaUrl } = params;
    const signal = params.signal;
    if (signal?.aborted) {
      throw new Error("Outbound delivery aborted");
    }
    const message = mediaUrl ? `${text || ""} ${mediaUrl}`.trim() : text;
    if (!twitchOutbound.sendText) {
      throw new Error("sendText not implemented");
    }
    return twitchOutbound.sendText({
      ...params,
      text: message
    });
  }
};

// vendor/openclaw-runtime/win-x64/extensions/twitch/src/actions.ts
function errorResponse(error) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({ ok: false, error })
      }
    ],
    details: { ok: false }
  };
}
function readStringParam(args, key, options = {}) {
  const value = args[key];
  if (value === void 0 || value === null) {
    if (options.required) {
      throw new Error(`Missing required parameter: ${key}`);
    }
    return void 0;
  }
  if (typeof value === "string") {
    return options.trim !== false ? value.trim() : value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    const str = String(value);
    return options.trim !== false ? str.trim() : str;
  }
  throw new Error(`Parameter ${key} must be a string, number, or boolean`);
}
var TWITCH_ACTIONS = /* @__PURE__ */ new Set(["send"]);
var twitchMessageActions = {
  /**
   * List available actions for this channel.
   */
  listActions: () => [...TWITCH_ACTIONS],
  /**
   * Check if an action is supported.
   */
  supportsAction: ({ action }) => TWITCH_ACTIONS.has(action),
  /**
   * Extract tool send parameters from action arguments.
   *
   * Parses and validates the "to" and "message" parameters for sending.
   *
   * @param params - Arguments from the tool call
   * @returns Parsed send parameters or null if invalid
   *
   * @example
   * const result = twitchMessageActions.extractToolSend!({
   *   args: { to: "#mychannel", message: "Hello!" }
   * });
   * // Returns: { to: "#mychannel", message: "Hello!" }
   */
  extractToolSend: ({ args }) => {
    try {
      const to = readStringParam(args, "to", { required: true });
      const message = readStringParam(args, "message", { required: true });
      if (!to || !message) {
        return null;
      }
      return { to, message };
    } catch {
      return null;
    }
  },
  /**
   * Handle an action execution.
   *
   * Processes the "send" action to send messages to Twitch.
   *
   * @param ctx - Action context including action type, parameters, and config
   * @returns Tool result with content or null if action not supported
   *
   * @example
   * const result = await twitchMessageActions.handleAction!({
   *   action: "send",
   *   params: { message: "Hello Twitch!", to: "#mychannel" },
   *   cfg: openclawConfig,
   *   accountId: "default",
   * });
   */
  handleAction: async (ctx) => {
    if (ctx.action !== "send") {
      return {
        content: [{ type: "text", text: "Unsupported action" }],
        details: { ok: false, error: "Unsupported action" }
      };
    }
    const message = readStringParam(ctx.params, "message", { required: true });
    const to = readStringParam(ctx.params, "to", { required: false });
    const accountId = ctx.accountId ?? DEFAULT_ACCOUNT_ID;
    const account = getAccountConfig(ctx.cfg, accountId);
    if (!account) {
      return errorResponse(
        `Account not found: ${accountId}. Available accounts: ${Object.keys(ctx.cfg.channels?.twitch?.accounts ?? {}).join(", ") || "none"}`
      );
    }
    const targetChannel = to || account.channel;
    if (!targetChannel) {
      return errorResponse("No channel specified and no default channel in account config");
    }
    if (!twitchOutbound.sendText) {
      return errorResponse("sendText not implemented");
    }
    try {
      const result = await twitchOutbound.sendText({
        cfg: ctx.cfg,
        to: targetChannel,
        text: message ?? "",
        accountId
      });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result)
          }
        ],
        details: { ok: true }
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return errorResponse(errorMsg);
    }
  }
};

// vendor/openclaw-runtime/win-x64/extensions/twitch/src/plugin.ts
init_client_manager_registry();

// vendor/openclaw-runtime/win-x64/extensions/twitch/src/config-schema.ts
import { MarkdownConfigSchema } from "openclaw/plugin-sdk";
import { z } from "zod";
var TwitchRoleSchema = z.enum(["moderator", "owner", "vip", "subscriber", "all"]);
var TwitchAccountSchema = z.object({
  /** Twitch username */
  username: z.string(),
  /** Twitch OAuth access token (requires chat:read and chat:write scopes) */
  accessToken: z.string(),
  /** Twitch client ID (from Twitch Developer Portal or twitchtokengenerator.com) */
  clientId: z.string().optional(),
  /** Channel name to join */
  channel: z.string().min(1),
  /** Enable this account */
  enabled: z.boolean().optional(),
  /** Allowlist of Twitch user IDs who can interact with the bot (use IDs for safety, not usernames) */
  allowFrom: z.array(z.string()).optional(),
  /** Roles allowed to interact with the bot (e.g., ["moderator", "vip", "subscriber"]) */
  allowedRoles: z.array(TwitchRoleSchema).optional(),
  /** Require @mention to trigger bot responses */
  requireMention: z.boolean().optional(),
  /** Outbound response prefix override for this channel/account. */
  responsePrefix: z.string().optional(),
  /** Twitch client secret (required for token refresh via RefreshingAuthProvider) */
  clientSecret: z.string().optional(),
  /** Refresh token (required for automatic token refresh) */
  refreshToken: z.string().optional(),
  /** Token expiry time in seconds (optional, for token refresh tracking) */
  expiresIn: z.number().nullable().optional(),
  /** Timestamp when token was obtained (optional, for token refresh tracking) */
  obtainmentTimestamp: z.number().optional()
});
var TwitchConfigBaseSchema = z.object({
  name: z.string().optional(),
  enabled: z.boolean().optional(),
  markdown: MarkdownConfigSchema.optional()
});
var SimplifiedSchema = z.intersection(TwitchConfigBaseSchema, TwitchAccountSchema);
var MultiAccountSchema = z.intersection(
  TwitchConfigBaseSchema,
  z.object({
    /** Per-account configuration (for multi-account setups) */
    accounts: z.record(z.string(), TwitchAccountSchema)
  }).refine((val) => Object.keys(val.accounts || {}).length > 0, {
    message: "accounts must contain at least one entry"
  })
);
var TwitchConfigSchema = z.union([SimplifiedSchema, MultiAccountSchema]);

// vendor/openclaw-runtime/win-x64/extensions/twitch/src/onboarding.ts
import {
  formatDocsLink,
  promptChannelAccessConfig
} from "openclaw/plugin-sdk";
init_twitch();
var channel = "twitch";
function setTwitchAccount(cfg, account) {
  const existing = getAccountConfig(cfg, DEFAULT_ACCOUNT_ID);
  const merged = {
    username: account.username ?? existing?.username ?? "",
    accessToken: account.accessToken ?? existing?.accessToken ?? "",
    clientId: account.clientId ?? existing?.clientId ?? "",
    channel: account.channel ?? existing?.channel ?? "",
    enabled: account.enabled ?? existing?.enabled ?? true,
    allowFrom: account.allowFrom ?? existing?.allowFrom,
    allowedRoles: account.allowedRoles ?? existing?.allowedRoles,
    requireMention: account.requireMention ?? existing?.requireMention,
    clientSecret: account.clientSecret ?? existing?.clientSecret,
    refreshToken: account.refreshToken ?? existing?.refreshToken,
    expiresIn: account.expiresIn ?? existing?.expiresIn,
    obtainmentTimestamp: account.obtainmentTimestamp ?? existing?.obtainmentTimestamp
  };
  return {
    ...cfg,
    channels: {
      ...cfg.channels,
      twitch: {
        ...cfg.channels?.twitch,
        enabled: true,
        accounts: {
          ...cfg.channels?.twitch?.accounts,
          [DEFAULT_ACCOUNT_ID]: merged
        }
      }
    }
  };
}
async function noteTwitchSetupHelp(prompter) {
  await prompter.note(
    [
      "Twitch requires a bot account with OAuth token.",
      "1. Create a Twitch application at https://dev.twitch.tv/console",
      "2. Generate a token with scopes: chat:read and chat:write",
      "   Use https://twitchtokengenerator.com/ or https://twitchapps.com/tmi/",
      "3. Copy the token (starts with 'oauth:') and Client ID",
      "Env vars supported: OPENCLAW_TWITCH_ACCESS_TOKEN",
      `Docs: ${formatDocsLink("/channels/twitch", "channels/twitch")}`
    ].join("\n"),
    "Twitch setup"
  );
}
async function promptToken(prompter, account, envToken) {
  const existingToken = account?.accessToken ?? "";
  if (existingToken && !envToken) {
    const keepToken = await prompter.confirm({
      message: "Access token already configured. Keep it?",
      initialValue: true
    });
    if (keepToken) {
      return existingToken;
    }
  }
  return String(
    await prompter.text({
      message: "Twitch OAuth token (oauth:...)",
      initialValue: envToken ?? "",
      validate: (value) => {
        const raw = String(value ?? "").trim();
        if (!raw) {
          return "Required";
        }
        if (!raw.startsWith("oauth:")) {
          return "Token should start with 'oauth:'";
        }
        return void 0;
      }
    })
  ).trim();
}
async function promptUsername(prompter, account) {
  return String(
    await prompter.text({
      message: "Twitch bot username",
      initialValue: account?.username ?? "",
      validate: (value) => value?.trim() ? void 0 : "Required"
    })
  ).trim();
}
async function promptClientId(prompter, account) {
  return String(
    await prompter.text({
      message: "Twitch Client ID",
      initialValue: account?.clientId ?? "",
      validate: (value) => value?.trim() ? void 0 : "Required"
    })
  ).trim();
}
async function promptChannelName(prompter, account) {
  const channelName = String(
    await prompter.text({
      message: "Channel to join",
      initialValue: account?.channel ?? "",
      validate: (value) => value?.trim() ? void 0 : "Required"
    })
  ).trim();
  return channelName;
}
async function promptRefreshTokenSetup(prompter, account) {
  const useRefresh = await prompter.confirm({
    message: "Enable automatic token refresh (requires client secret and refresh token)?",
    initialValue: Boolean(account?.clientSecret && account?.refreshToken)
  });
  if (!useRefresh) {
    return {};
  }
  const clientSecret = String(
    await prompter.text({
      message: "Twitch Client Secret (for token refresh)",
      initialValue: account?.clientSecret ?? "",
      validate: (value) => value?.trim() ? void 0 : "Required"
    })
  ).trim() || void 0;
  const refreshToken = String(
    await prompter.text({
      message: "Twitch Refresh Token",
      initialValue: account?.refreshToken ?? "",
      validate: (value) => value?.trim() ? void 0 : "Required"
    })
  ).trim() || void 0;
  return { clientSecret, refreshToken };
}
async function configureWithEnvToken(cfg, prompter, account, envToken, forceAllowFrom, dmPolicy2) {
  const useEnv = await prompter.confirm({
    message: "Twitch env var OPENCLAW_TWITCH_ACCESS_TOKEN detected. Use env token?",
    initialValue: true
  });
  if (!useEnv) {
    return null;
  }
  const username = await promptUsername(prompter, account);
  const clientId = await promptClientId(prompter, account);
  const cfgWithAccount = setTwitchAccount(cfg, {
    username,
    clientId,
    accessToken: "",
    // Will use env var
    enabled: true
  });
  if (forceAllowFrom && dmPolicy2.promptAllowFrom) {
    return { cfg: await dmPolicy2.promptAllowFrom({ cfg: cfgWithAccount, prompter }) };
  }
  return { cfg: cfgWithAccount };
}
function setTwitchAccessControl(cfg, allowedRoles, requireMention) {
  const account = getAccountConfig(cfg, DEFAULT_ACCOUNT_ID);
  if (!account) {
    return cfg;
  }
  return setTwitchAccount(cfg, {
    ...account,
    allowedRoles,
    requireMention
  });
}
var dmPolicy = {
  label: "Twitch",
  channel,
  policyKey: "channels.twitch.allowedRoles",
  // Twitch uses roles instead of DM policy
  allowFromKey: "channels.twitch.accounts.default.allowFrom",
  getCurrent: (cfg) => {
    const account = getAccountConfig(cfg, DEFAULT_ACCOUNT_ID);
    if (account?.allowedRoles?.includes("all")) {
      return "open";
    }
    if (account?.allowFrom && account.allowFrom.length > 0) {
      return "allowlist";
    }
    return "disabled";
  },
  setPolicy: (cfg, policy) => {
    const allowedRoles = policy === "open" ? ["all"] : policy === "allowlist" ? [] : ["moderator"];
    return setTwitchAccessControl(cfg, allowedRoles, true);
  },
  promptAllowFrom: async ({ cfg, prompter }) => {
    const account = getAccountConfig(cfg, DEFAULT_ACCOUNT_ID);
    const existingAllowFrom = account?.allowFrom ?? [];
    const entry = await prompter.text({
      message: "Twitch allowFrom (user IDs, one per line, recommended for security)",
      placeholder: "123456789",
      initialValue: existingAllowFrom[0] ? String(existingAllowFrom[0]) : void 0
    });
    const allowFrom = String(entry ?? "").split(/[\n,;]+/g).map((s) => s.trim()).filter(Boolean);
    return setTwitchAccount(cfg, {
      ...account ?? void 0,
      allowFrom
    });
  }
};
var twitchOnboardingAdapter = {
  channel,
  getStatus: async ({ cfg }) => {
    const account = getAccountConfig(cfg, DEFAULT_ACCOUNT_ID);
    const configured = account ? isAccountConfigured(account) : false;
    return {
      channel,
      configured,
      statusLines: [`Twitch: ${configured ? "configured" : "needs username, token, and clientId"}`],
      selectionHint: configured ? "configured" : "needs setup"
    };
  },
  configure: async ({ cfg, prompter, forceAllowFrom }) => {
    const account = getAccountConfig(cfg, DEFAULT_ACCOUNT_ID);
    if (!account || !isAccountConfigured(account)) {
      await noteTwitchSetupHelp(prompter);
    }
    const envToken = process.env.OPENCLAW_TWITCH_ACCESS_TOKEN?.trim();
    if (envToken && !account?.accessToken) {
      const envResult = await configureWithEnvToken(
        cfg,
        prompter,
        account,
        envToken,
        forceAllowFrom,
        dmPolicy
      );
      if (envResult) {
        return envResult;
      }
    }
    const username = await promptUsername(prompter, account);
    const token = await promptToken(prompter, account, envToken);
    const clientId = await promptClientId(prompter, account);
    const channelName = await promptChannelName(prompter, account);
    const { clientSecret, refreshToken } = await promptRefreshTokenSetup(prompter, account);
    const cfgWithAccount = setTwitchAccount(cfg, {
      username,
      accessToken: token,
      clientId,
      channel: channelName,
      clientSecret,
      refreshToken,
      enabled: true
    });
    const cfgWithAllowFrom = forceAllowFrom && dmPolicy.promptAllowFrom ? await dmPolicy.promptAllowFrom({ cfg: cfgWithAccount, prompter }) : cfgWithAccount;
    if (!account?.allowFrom || account.allowFrom.length === 0) {
      const accessConfig = await promptChannelAccessConfig({
        prompter,
        label: "Twitch chat",
        currentPolicy: account?.allowedRoles?.includes("all") ? "open" : account?.allowedRoles?.includes("moderator") ? "allowlist" : "disabled",
        currentEntries: [],
        placeholder: "",
        updatePrompt: false
      });
      if (accessConfig) {
        const allowedRoles = accessConfig.policy === "open" ? ["all"] : accessConfig.policy === "allowlist" ? ["moderator", "vip"] : [];
        const cfgWithAccessControl = setTwitchAccessControl(cfgWithAllowFrom, allowedRoles, true);
        return { cfg: cfgWithAccessControl };
      }
    }
    return { cfg: cfgWithAllowFrom };
  },
  dmPolicy,
  disable: (cfg) => {
    const twitch = cfg.channels?.twitch;
    return {
      ...cfg,
      channels: {
        ...cfg.channels,
        twitch: { ...twitch, enabled: false }
      }
    };
  }
};

// vendor/openclaw-runtime/win-x64/extensions/twitch/src/probe.ts
init_twitch();
import { StaticAuthProvider as StaticAuthProvider2 } from "@twurple/auth";
import { ChatClient as ChatClient2 } from "@twurple/chat";
async function probeTwitch(account, timeoutMs) {
  const started = Date.now();
  if (!account.accessToken || !account.username) {
    return {
      ok: false,
      error: "missing credentials (accessToken, username)",
      username: account.username,
      elapsedMs: Date.now() - started
    };
  }
  const rawToken = normalizeToken(account.accessToken.trim());
  let client;
  try {
    const authProvider = new StaticAuthProvider2(account.clientId ?? "", rawToken);
    client = new ChatClient2({
      authProvider
    });
    const connectionPromise = new Promise((resolve, reject) => {
      let settled = false;
      let connectListener;
      let disconnectListener;
      let authFailListener;
      const cleanup = () => {
        if (settled) {
          return;
        }
        settled = true;
        connectListener?.unbind();
        disconnectListener?.unbind();
        authFailListener?.unbind();
      };
      connectListener = client?.onConnect(() => {
        cleanup();
        resolve();
      });
      disconnectListener = client?.onDisconnect((_manually, reason) => {
        cleanup();
        reject(reason || new Error("Disconnected"));
      });
      authFailListener = client?.onAuthenticationFailure(() => {
        cleanup();
        reject(new Error("Authentication failed"));
      });
    });
    const timeout = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`timeout after ${timeoutMs}ms`)), timeoutMs);
    });
    client.connect();
    await Promise.race([connectionPromise, timeout]);
    client.quit();
    client = void 0;
    return {
      ok: true,
      connected: true,
      username: account.username,
      channel: account.channel,
      elapsedMs: Date.now() - started
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      username: account.username,
      channel: account.channel,
      elapsedMs: Date.now() - started
    };
  } finally {
    if (client) {
      try {
        client.quit();
      } catch {
      }
    }
  }
}

// vendor/openclaw-runtime/win-x64/extensions/twitch/src/resolver.ts
init_twitch();
import { ApiClient } from "@twurple/api";
import { StaticAuthProvider as StaticAuthProvider3 } from "@twurple/auth";
function normalizeUsername(input) {
  const trimmed = input.trim();
  if (trimmed.startsWith("@")) {
    return trimmed.slice(1).toLowerCase();
  }
  return trimmed.toLowerCase();
}
function createLogger(logger) {
  return {
    info: (msg) => logger?.info(msg),
    warn: (msg) => logger?.warn(msg),
    error: (msg) => logger?.error(msg),
    debug: (msg) => logger?.debug?.(msg) ?? (() => {
    })
  };
}
async function resolveTwitchTargets(inputs, account, kind, logger) {
  const log = createLogger(logger);
  if (!account.clientId || !account.accessToken) {
    log.error("Missing Twitch client ID or accessToken");
    return inputs.map((input) => ({
      input,
      resolved: false,
      note: "missing Twitch credentials"
    }));
  }
  const normalizedToken = normalizeToken(account.accessToken);
  const authProvider = new StaticAuthProvider3(account.clientId, normalizedToken);
  const apiClient = new ApiClient({ authProvider });
  const results = [];
  for (const input of inputs) {
    const normalized = normalizeUsername(input);
    if (!normalized) {
      results.push({
        input,
        resolved: false,
        note: "empty input"
      });
      continue;
    }
    const looksLikeUserId = /^\d+$/.test(normalized);
    try {
      if (looksLikeUserId) {
        const user = await apiClient.users.getUserById(normalized);
        if (user) {
          results.push({
            input,
            resolved: true,
            id: user.id,
            name: user.name
          });
          log.debug?.(`Resolved user ID ${normalized} -> ${user.name}`);
        } else {
          results.push({
            input,
            resolved: false,
            note: "user ID not found"
          });
          log.warn(`User ID ${normalized} not found`);
        }
      } else {
        const user = await apiClient.users.getUserByName(normalized);
        if (user) {
          results.push({
            input,
            resolved: true,
            id: user.id,
            name: user.name,
            note: user.displayName !== user.name ? `display: ${user.displayName}` : void 0
          });
          log.debug?.(`Resolved username ${normalized} -> ${user.id} (${user.name})`);
        } else {
          results.push({
            input,
            resolved: false,
            note: "username not found"
          });
          log.warn(`Username ${normalized} not found`);
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      results.push({
        input,
        resolved: false,
        note: `API error: ${errorMessage}`
      });
      log.error(`Failed to resolve ${input}: ${errorMessage}`);
    }
  }
  return results;
}

// vendor/openclaw-runtime/win-x64/extensions/twitch/src/status.ts
init_token();
init_twitch();
function collectTwitchStatusIssues(accounts, getCfg) {
  const issues = [];
  for (const entry of accounts) {
    const accountId = entry.accountId;
    if (!accountId) {
      continue;
    }
    let account = null;
    let cfg;
    if (getCfg) {
      try {
        cfg = getCfg();
        account = getAccountConfig(cfg, accountId);
      } catch {
      }
    }
    if (!entry.configured) {
      issues.push({
        channel: "twitch",
        accountId,
        kind: "config",
        message: "Twitch account is not properly configured",
        fix: "Add required fields: username, accessToken, and clientId to your account configuration"
      });
      continue;
    }
    if (entry.enabled === false) {
      issues.push({
        channel: "twitch",
        accountId,
        kind: "config",
        message: "Twitch account is disabled",
        fix: "Set enabled: true in your account configuration to enable this account"
      });
      continue;
    }
    if (account && account.username && account.accessToken && !account.clientId) {
      issues.push({
        channel: "twitch",
        accountId,
        kind: "config",
        message: "Twitch client ID is required",
        fix: "Add clientId to your Twitch account configuration (from Twitch Developer Portal)"
      });
    }
    const tokenResolution = cfg ? resolveTwitchToken(cfg, { accountId }) : { token: "", source: "none" };
    if (account && isAccountConfigured(account, tokenResolution.token)) {
      if (account.accessToken?.startsWith("oauth:")) {
        issues.push({
          channel: "twitch",
          accountId,
          kind: "config",
          message: "Token contains 'oauth:' prefix (will be stripped)",
          fix: "The 'oauth:' prefix is optional. You can use just the token value, or keep it as-is (it will be normalized automatically)."
        });
      }
      if (account.clientSecret && !account.refreshToken) {
        issues.push({
          channel: "twitch",
          accountId,
          kind: "config",
          message: "clientSecret provided without refreshToken",
          fix: "For automatic token refresh, provide both clientSecret and refreshToken. Otherwise, clientSecret is not needed."
        });
      }
      if (account.allowFrom && account.allowFrom.length === 0) {
        issues.push({
          channel: "twitch",
          accountId,
          kind: "config",
          message: "allowFrom is configured but empty",
          fix: "Either add user IDs to allowFrom, remove the allowFrom field, or use allowedRoles instead."
        });
      }
      if (account.allowedRoles?.includes("all") && account.allowFrom && account.allowFrom.length > 0) {
        issues.push({
          channel: "twitch",
          accountId,
          kind: "intent",
          message: "allowedRoles is set to 'all' but allowFrom is also configured",
          fix: "When allowedRoles is 'all', the allowFrom list is not needed. Remove allowFrom or set allowedRoles to specific roles."
        });
      }
    }
    if (entry.lastError) {
      issues.push({
        channel: "twitch",
        accountId,
        kind: "runtime",
        message: `Last error: ${entry.lastError}`,
        fix: "Check your token validity and network connection. Ensure the bot has the required OAuth scopes."
      });
    }
    if (entry.configured && !entry.running && !entry.lastStartAt && !entry.lastInboundAt && !entry.lastOutboundAt) {
      issues.push({
        channel: "twitch",
        accountId,
        kind: "runtime",
        message: "Account has never connected successfully",
        fix: "Start the Twitch gateway to begin receiving messages. Check logs for connection errors."
      });
    }
    if (entry.running && entry.lastStartAt) {
      const uptime = Date.now() - entry.lastStartAt;
      const daysSinceStart = uptime / (1e3 * 60 * 60 * 24);
      if (daysSinceStart > 7) {
        issues.push({
          channel: "twitch",
          accountId,
          kind: "runtime",
          message: `Connection has been running for ${Math.floor(daysSinceStart)} days`,
          fix: "Consider restarting the connection periodically to refresh the connection. Twitch tokens may expire after long periods."
        });
      }
    }
  }
  return issues;
}

// vendor/openclaw-runtime/win-x64/extensions/twitch/src/plugin.ts
init_token();
init_twitch();
var twitchPlugin = {
  /** Plugin identifier */
  id: "twitch",
  /** Plugin metadata */
  meta: {
    id: "twitch",
    label: "Twitch",
    selectionLabel: "Twitch (Chat)",
    docsPath: "/channels/twitch",
    blurb: "Twitch chat integration",
    aliases: ["twitch-chat"]
  },
  /** Onboarding adapter */
  onboarding: twitchOnboardingAdapter,
  /** Pairing configuration */
  pairing: {
    idLabel: "twitchUserId",
    normalizeAllowEntry: (entry) => entry.replace(/^(twitch:)?user:?/i, ""),
    notifyApproval: async ({ id }) => {
      console.warn(`Pairing approved for user ${id} (notification sent via chat if possible)`);
    }
  },
  /** Supported chat capabilities */
  capabilities: {
    chatTypes: ["group"]
  },
  /** Configuration schema for Twitch channel */
  configSchema: buildChannelConfigSchema(TwitchConfigSchema),
  /** Account configuration management */
  config: {
    /** List all configured account IDs */
    listAccountIds: (cfg) => listAccountIds(cfg),
    /** Resolve an account config by ID */
    resolveAccount: (cfg, accountId) => {
      const account = getAccountConfig(cfg, accountId ?? DEFAULT_ACCOUNT_ID);
      if (!account) {
        return {
          username: "",
          accessToken: "",
          clientId: "",
          enabled: false
        };
      }
      return account;
    },
    /** Get the default account ID */
    defaultAccountId: () => DEFAULT_ACCOUNT_ID,
    /** Check if an account is configured */
    isConfigured: (_account, cfg) => {
      const account = getAccountConfig(cfg, DEFAULT_ACCOUNT_ID);
      const tokenResolution = resolveTwitchToken(cfg, { accountId: DEFAULT_ACCOUNT_ID });
      return account ? isAccountConfigured(account, tokenResolution.token) : false;
    },
    /** Check if an account is enabled */
    isEnabled: (account) => account?.enabled !== false,
    /** Describe account status */
    describeAccount: (account) => {
      return {
        accountId: DEFAULT_ACCOUNT_ID,
        enabled: account?.enabled !== false,
        configured: account ? isAccountConfigured(account, account?.accessToken) : false
      };
    }
  },
  /** Outbound message adapter */
  outbound: twitchOutbound,
  /** Message actions adapter */
  actions: twitchMessageActions,
  /** Resolver adapter for username -> user ID resolution */
  resolver: {
    resolveTargets: async ({
      cfg,
      accountId,
      inputs,
      kind,
      runtime: runtime2
    }) => {
      const account = getAccountConfig(cfg, accountId ?? DEFAULT_ACCOUNT_ID);
      if (!account) {
        return inputs.map((input) => ({
          input,
          resolved: false,
          note: "account not configured"
        }));
      }
      const log = {
        info: (msg) => runtime2.log(msg),
        warn: (msg) => runtime2.log(msg),
        error: (msg) => runtime2.error(msg),
        debug: (msg) => runtime2.log(msg)
      };
      return await resolveTwitchTargets(inputs, account, kind, log);
    }
  },
  /** Status monitoring adapter */
  status: {
    /** Default runtime state */
    defaultRuntime: {
      accountId: DEFAULT_ACCOUNT_ID,
      running: false,
      lastStartAt: null,
      lastStopAt: null,
      lastError: null
    },
    /** Build channel summary from snapshot */
    buildChannelSummary: ({ snapshot }) => ({
      configured: snapshot.configured ?? false,
      running: snapshot.running ?? false,
      lastStartAt: snapshot.lastStartAt ?? null,
      lastStopAt: snapshot.lastStopAt ?? null,
      lastError: snapshot.lastError ?? null,
      probe: snapshot.probe,
      lastProbeAt: snapshot.lastProbeAt ?? null
    }),
    /** Probe account connection */
    probeAccount: async ({
      account,
      timeoutMs
    }) => {
      return await probeTwitch(account, timeoutMs);
    },
    /** Build account snapshot with current status */
    buildAccountSnapshot: ({
      account,
      cfg,
      runtime: runtime2,
      probe
    }) => {
      const twitch = cfg.channels;
      const twitchCfg = twitch?.twitch;
      const accountMap = twitchCfg?.accounts ?? {};
      const resolvedAccountId = Object.entries(accountMap).find(([, value]) => value === account)?.[0] ?? DEFAULT_ACCOUNT_ID;
      const tokenResolution = resolveTwitchToken(cfg, { accountId: resolvedAccountId });
      return {
        accountId: resolvedAccountId,
        enabled: account?.enabled !== false,
        configured: isAccountConfigured(account, tokenResolution.token),
        running: runtime2?.running ?? false,
        lastStartAt: runtime2?.lastStartAt ?? null,
        lastStopAt: runtime2?.lastStopAt ?? null,
        lastError: runtime2?.lastError ?? null,
        probe
      };
    },
    /** Collect status issues for all accounts */
    collectStatusIssues: collectTwitchStatusIssues
  },
  /** Gateway adapter for connection lifecycle */
  gateway: {
    /** Start an account connection */
    startAccount: async (ctx) => {
      const account = ctx.account;
      const accountId = ctx.accountId;
      ctx.setStatus?.({
        accountId,
        running: true,
        lastStartAt: Date.now(),
        lastError: null
      });
      ctx.log?.info(`Starting Twitch connection for ${account.username}`);
      const { monitorTwitchProvider: monitorTwitchProvider2 } = await Promise.resolve().then(() => (init_monitor(), monitor_exports));
      await monitorTwitchProvider2({
        account,
        accountId,
        config: ctx.cfg,
        runtime: ctx.runtime,
        abortSignal: ctx.abortSignal
      });
    },
    /** Stop an account connection */
    stopAccount: async (ctx) => {
      const account = ctx.account;
      const accountId = ctx.accountId;
      await removeClientManager(accountId);
      ctx.setStatus?.({
        accountId,
        running: false,
        lastStopAt: Date.now()
      });
      ctx.log?.info(`Stopped Twitch connection for ${account.username}`);
    }
  }
};

// vendor/openclaw-runtime/win-x64/extensions/twitch/index.ts
init_runtime();
init_monitor();
var plugin = {
  id: "twitch",
  name: "Twitch",
  description: "Twitch channel plugin",
  configSchema: emptyPluginConfigSchema(),
  register(api) {
    setTwitchRuntime(api.runtime);
    api.registerChannel({ plugin: twitchPlugin });
  }
};
var twitch_default = plugin;
export {
  twitch_default as default,
  monitorTwitchProvider
};
