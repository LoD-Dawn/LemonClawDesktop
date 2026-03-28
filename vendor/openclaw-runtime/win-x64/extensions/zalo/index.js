var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// vendor/openclaw-runtime/win-x64/extensions/zalo/src/api.ts
async function callZaloApi(method, token, body, options) {
  const url = `${ZALO_API_BASE}/bot${token}/${method}`;
  const controller = new AbortController();
  const timeoutId = options?.timeoutMs ? setTimeout(() => controller.abort(), options.timeoutMs) : void 0;
  const fetcher = options?.fetch ?? fetch;
  try {
    const response = await fetcher(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: body ? JSON.stringify(body) : void 0,
      signal: controller.signal
    });
    const data = await response.json();
    if (!data.ok) {
      throw new ZaloApiError(
        data.description ?? `Zalo API error: ${method}`,
        data.error_code,
        data.description
      );
    }
    return data;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}
async function getMe(token, timeoutMs, fetcher) {
  return callZaloApi("getMe", token, void 0, { timeoutMs, fetch: fetcher });
}
async function sendMessage(token, params, fetcher) {
  return callZaloApi("sendMessage", token, params, { fetch: fetcher });
}
async function sendPhoto(token, params, fetcher) {
  return callZaloApi("sendPhoto", token, params, { fetch: fetcher });
}
async function getUpdates(token, params, fetcher) {
  const pollTimeoutSec = params?.timeout ?? 30;
  const timeoutMs = (pollTimeoutSec + 5) * 1e3;
  const body = { timeout: String(pollTimeoutSec) };
  return callZaloApi("getUpdates", token, body, { timeoutMs, fetch: fetcher });
}
async function setWebhook(token, params, fetcher) {
  return callZaloApi("setWebhook", token, params, { fetch: fetcher });
}
async function deleteWebhook(token, fetcher) {
  return callZaloApi("deleteWebhook", token, void 0, { fetch: fetcher });
}
var ZALO_API_BASE, ZaloApiError;
var init_api = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/zalo/src/api.ts"() {
    "use strict";
    ZALO_API_BASE = "https://bot-api.zaloplatforms.com";
    ZaloApiError = class extends Error {
      constructor(message, errorCode, description) {
        super(message);
        this.errorCode = errorCode;
        this.description = description;
        this.name = "ZaloApiError";
      }
      /** True if this is a long-polling timeout (no updates available) */
      get isPollingTimeout() {
        return this.errorCode === 408;
      }
    };
  }
});

// vendor/openclaw-runtime/win-x64/extensions/zalo/src/proxy.ts
import { ProxyAgent, fetch as undiciFetch } from "undici";
function resolveZaloProxyFetch(proxyUrl) {
  const trimmed = proxyUrl?.trim();
  if (!trimmed) {
    return void 0;
  }
  const cached = proxyCache.get(trimmed);
  if (cached) {
    return cached;
  }
  const agent = new ProxyAgent(trimmed);
  const fetcher = (input, init) => undiciFetch(input, {
    ...init,
    dispatcher: agent
  });
  proxyCache.set(trimmed, fetcher);
  return fetcher;
}
var proxyCache;
var init_proxy = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/zalo/src/proxy.ts"() {
    "use strict";
    proxyCache = /* @__PURE__ */ new Map();
  }
});

// vendor/openclaw-runtime/win-x64/extensions/zalo/src/group-access.ts
import {
  evaluateSenderGroupAccess,
  isNormalizedSenderAllowed,
  resolveOpenProviderRuntimeGroupPolicy
} from "openclaw/plugin-sdk";
function isZaloSenderAllowed(senderId, allowFrom) {
  return isNormalizedSenderAllowed({
    senderId,
    allowFrom,
    stripPrefixRe: ZALO_ALLOW_FROM_PREFIX_RE
  });
}
function resolveZaloRuntimeGroupPolicy(params) {
  return resolveOpenProviderRuntimeGroupPolicy({
    providerConfigPresent: params.providerConfigPresent,
    groupPolicy: params.groupPolicy,
    defaultGroupPolicy: params.defaultGroupPolicy
  });
}
function evaluateZaloGroupAccess(params) {
  return evaluateSenderGroupAccess({
    providerConfigPresent: params.providerConfigPresent,
    configuredGroupPolicy: params.configuredGroupPolicy,
    defaultGroupPolicy: params.defaultGroupPolicy,
    groupAllowFrom: params.groupAllowFrom,
    senderId: params.senderId,
    isSenderAllowed: isZaloSenderAllowed
  });
}
var ZALO_ALLOW_FROM_PREFIX_RE;
var init_group_access = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/zalo/src/group-access.ts"() {
    "use strict";
    ZALO_ALLOW_FROM_PREFIX_RE = /^(zalo|zl):/i;
  }
});

// vendor/openclaw-runtime/win-x64/extensions/zalo/src/monitor.webhook.ts
import { timingSafeEqual } from "crypto";
import {
  createDedupeCache,
  createFixedWindowRateLimiter,
  createWebhookAnomalyTracker,
  readJsonWebhookBodyOrReject,
  applyBasicWebhookRequestGuards,
  registerWebhookTargetWithPluginRoute,
  registerWebhookTarget,
  resolveSingleWebhookTarget,
  resolveWebhookTargets,
  WEBHOOK_ANOMALY_COUNTER_DEFAULTS,
  WEBHOOK_RATE_LIMIT_DEFAULTS
} from "openclaw/plugin-sdk";
function clearZaloWebhookSecurityStateForTest() {
  webhookRateLimiter.clear();
  webhookAnomalyTracker.clear();
}
function getZaloWebhookRateLimitStateSizeForTest() {
  return webhookRateLimiter.size();
}
function getZaloWebhookStatusCounterSizeForTest() {
  return webhookAnomalyTracker.size();
}
function timingSafeEquals(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    const length = Math.max(1, leftBuffer.length, rightBuffer.length);
    const paddedLeft = Buffer.alloc(length);
    const paddedRight = Buffer.alloc(length);
    leftBuffer.copy(paddedLeft);
    rightBuffer.copy(paddedRight);
    timingSafeEqual(paddedLeft, paddedRight);
    return false;
  }
  return timingSafeEqual(leftBuffer, rightBuffer);
}
function isReplayEvent(update, nowMs) {
  const messageId = update.message?.message_id;
  if (!messageId) {
    return false;
  }
  const key = `${update.event_name}:${messageId}`;
  return recentWebhookEvents.check(key, nowMs);
}
function recordWebhookStatus(runtime2, path, statusCode) {
  webhookAnomalyTracker.record({
    key: `${path}:${statusCode}`,
    statusCode,
    log: runtime2?.log,
    message: (count) => `[zalo] webhook anomaly path=${path} status=${statusCode} count=${String(count)}`
  });
}
function registerZaloWebhookTarget(target, opts) {
  if (opts?.route) {
    return registerWebhookTargetWithPluginRoute({
      targetsByPath: webhookTargets,
      target,
      route: opts.route,
      onLastPathTargetRemoved: opts.onLastPathTargetRemoved
    }).unregister;
  }
  return registerWebhookTarget(webhookTargets, target, opts).unregister;
}
async function handleZaloWebhookRequest(req, res, processUpdate2) {
  const resolved = resolveWebhookTargets(req, webhookTargets);
  if (!resolved) {
    return false;
  }
  const { targets, path } = resolved;
  if (!applyBasicWebhookRequestGuards({
    req,
    res,
    allowMethods: ["POST"]
  })) {
    return true;
  }
  const headerToken = String(req.headers["x-bot-api-secret-token"] ?? "");
  const matchedTarget = resolveSingleWebhookTarget(
    targets,
    (entry) => timingSafeEquals(entry.secret, headerToken)
  );
  if (matchedTarget.kind === "none") {
    res.statusCode = 401;
    res.end("unauthorized");
    recordWebhookStatus(targets[0]?.runtime, path, res.statusCode);
    return true;
  }
  if (matchedTarget.kind === "ambiguous") {
    res.statusCode = 401;
    res.end("ambiguous webhook target");
    recordWebhookStatus(targets[0]?.runtime, path, res.statusCode);
    return true;
  }
  const target = matchedTarget.target;
  const rateLimitKey = `${path}:${req.socket.remoteAddress ?? "unknown"}`;
  const nowMs = Date.now();
  if (!applyBasicWebhookRequestGuards({
    req,
    res,
    rateLimiter: webhookRateLimiter,
    rateLimitKey,
    nowMs,
    requireJsonContentType: true
  })) {
    recordWebhookStatus(target.runtime, path, res.statusCode);
    return true;
  }
  const body = await readJsonWebhookBodyOrReject({
    req,
    res,
    maxBytes: 1024 * 1024,
    timeoutMs: 3e4,
    emptyObjectOnEmpty: false,
    invalidJsonMessage: "Bad Request"
  });
  if (!body.ok) {
    recordWebhookStatus(target.runtime, path, res.statusCode);
    return true;
  }
  const raw = body.value;
  const record = raw && typeof raw === "object" ? raw : null;
  const update = record && record.ok === true && record.result ? record.result : record ?? void 0;
  if (!update?.event_name) {
    res.statusCode = 400;
    res.end("Bad Request");
    recordWebhookStatus(target.runtime, path, res.statusCode);
    return true;
  }
  if (isReplayEvent(update, nowMs)) {
    res.statusCode = 200;
    res.end("ok");
    return true;
  }
  target.statusSink?.({ lastInboundAt: Date.now() });
  processUpdate2({ update, target }).catch((err) => {
    target.runtime.error?.(`[${target.account.accountId}] Zalo webhook failed: ${String(err)}`);
  });
  res.statusCode = 200;
  res.end("ok");
  return true;
}
var ZALO_WEBHOOK_REPLAY_WINDOW_MS, webhookTargets, webhookRateLimiter, recentWebhookEvents, webhookAnomalyTracker;
var init_monitor_webhook = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/zalo/src/monitor.webhook.ts"() {
    "use strict";
    ZALO_WEBHOOK_REPLAY_WINDOW_MS = 5 * 6e4;
    webhookTargets = /* @__PURE__ */ new Map();
    webhookRateLimiter = createFixedWindowRateLimiter({
      windowMs: WEBHOOK_RATE_LIMIT_DEFAULTS.windowMs,
      maxRequests: WEBHOOK_RATE_LIMIT_DEFAULTS.maxRequests,
      maxTrackedKeys: WEBHOOK_RATE_LIMIT_DEFAULTS.maxTrackedKeys
    });
    recentWebhookEvents = createDedupeCache({
      ttlMs: ZALO_WEBHOOK_REPLAY_WINDOW_MS,
      maxSize: 5e3
    });
    webhookAnomalyTracker = createWebhookAnomalyTracker({
      maxTrackedKeys: WEBHOOK_ANOMALY_COUNTER_DEFAULTS.maxTrackedKeys,
      ttlMs: WEBHOOK_ANOMALY_COUNTER_DEFAULTS.ttlMs,
      logEvery: WEBHOOK_ANOMALY_COUNTER_DEFAULTS.logEvery
    });
  }
});

// vendor/openclaw-runtime/win-x64/extensions/zalo/src/runtime.ts
function setZaloRuntime(next) {
  runtime = next;
}
function getZaloRuntime() {
  if (!runtime) {
    throw new Error("Zalo runtime not initialized");
  }
  return runtime;
}
var runtime;
var init_runtime = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/zalo/src/runtime.ts"() {
    "use strict";
    runtime = null;
  }
});

// vendor/openclaw-runtime/win-x64/extensions/zalo/src/monitor.ts
var monitor_exports = {};
__export(monitor_exports, {
  __testing: () => __testing,
  clearZaloWebhookSecurityStateForTest: () => clearZaloWebhookSecurityStateForTest,
  getZaloWebhookRateLimitStateSizeForTest: () => getZaloWebhookRateLimitStateSizeForTest,
  getZaloWebhookStatusCounterSizeForTest: () => getZaloWebhookStatusCounterSizeForTest,
  handleZaloWebhookRequest: () => handleZaloWebhookRequest2,
  monitorZaloProvider: () => monitorZaloProvider,
  registerZaloWebhookTarget: () => registerZaloWebhookTarget2
});
import {
  createScopedPairingAccess,
  createReplyPrefixOptions,
  resolveDirectDmAuthorizationOutcome,
  resolveSenderCommandAuthorizationWithRuntime,
  resolveOutboundMediaUrls,
  resolveDefaultGroupPolicy,
  resolveInboundRouteEnvelopeBuilderWithRuntime,
  sendMediaWithLeadingCaption,
  resolveWebhookPath,
  warnMissingProviderGroupPolicyFallbackOnce
} from "openclaw/plugin-sdk";
function logVerbose(core, runtime2, message) {
  if (core.logging.shouldLogVerbose()) {
    runtime2.log?.(`[zalo] ${message}`);
  }
}
function registerZaloWebhookTarget2(target) {
  return registerZaloWebhookTarget(target, {
    route: {
      auth: "plugin",
      match: "exact",
      pluginId: "zalo",
      source: "zalo-webhook",
      accountId: target.account.accountId,
      log: target.runtime.log,
      handler: async (req, res) => {
        const handled = await handleZaloWebhookRequest2(req, res);
        if (!handled && !res.headersSent) {
          res.statusCode = 404;
          res.setHeader("Content-Type", "text/plain; charset=utf-8");
          res.end("Not Found");
        }
      }
    }
  });
}
async function handleZaloWebhookRequest2(req, res) {
  return handleZaloWebhookRequest(req, res, async ({ update, target }) => {
    await processUpdate(
      update,
      target.token,
      target.account,
      target.config,
      target.runtime,
      target.core,
      target.mediaMaxMb,
      target.statusSink,
      target.fetcher
    );
  });
}
function startPollingLoop(params) {
  const {
    token,
    account,
    config,
    runtime: runtime2,
    core,
    abortSignal,
    isStopped,
    mediaMaxMb,
    statusSink,
    fetcher
  } = params;
  const pollTimeout = 30;
  const poll = async () => {
    if (isStopped() || abortSignal.aborted) {
      return;
    }
    try {
      const response = await getUpdates(token, { timeout: pollTimeout }, fetcher);
      if (response.ok && response.result) {
        statusSink?.({ lastInboundAt: Date.now() });
        await processUpdate(
          response.result,
          token,
          account,
          config,
          runtime2,
          core,
          mediaMaxMb,
          statusSink,
          fetcher
        );
      }
    } catch (err) {
      if (err instanceof ZaloApiError && err.isPollingTimeout) {
      } else if (!isStopped() && !abortSignal.aborted) {
        runtime2.error?.(`[${account.accountId}] Zalo polling error: ${String(err)}`);
        await new Promise((resolve) => setTimeout(resolve, 5e3));
      }
    }
    if (!isStopped() && !abortSignal.aborted) {
      setImmediate(poll);
    }
  };
  void poll();
}
async function processUpdate(update, token, account, config, runtime2, core, mediaMaxMb, statusSink, fetcher) {
  const { event_name, message } = update;
  if (!message) {
    return;
  }
  switch (event_name) {
    case "message.text.received":
      await handleTextMessage(message, token, account, config, runtime2, core, statusSink, fetcher);
      break;
    case "message.image.received":
      await handleImageMessage(
        message,
        token,
        account,
        config,
        runtime2,
        core,
        mediaMaxMb,
        statusSink,
        fetcher
      );
      break;
    case "message.sticker.received":
      logVerbose(core, runtime2, `[${account.accountId}] Received sticker from ${message.from.id}`);
      break;
    case "message.unsupported.received":
      logVerbose(
        core,
        runtime2,
        `[${account.accountId}] Received unsupported message type from ${message.from.id}`
      );
      break;
  }
}
async function handleTextMessage(message, token, account, config, runtime2, core, statusSink, fetcher) {
  const { text } = message;
  if (!text?.trim()) {
    return;
  }
  await processMessageWithPipeline({
    message,
    token,
    account,
    config,
    runtime: runtime2,
    core,
    text,
    mediaPath: void 0,
    mediaType: void 0,
    statusSink,
    fetcher
  });
}
async function handleImageMessage(message, token, account, config, runtime2, core, mediaMaxMb, statusSink, fetcher) {
  const { photo, caption } = message;
  let mediaPath;
  let mediaType;
  if (photo) {
    try {
      const maxBytes = mediaMaxMb * 1024 * 1024;
      const fetched = await core.channel.media.fetchRemoteMedia({ url: photo, maxBytes });
      const saved = await core.channel.media.saveMediaBuffer(
        fetched.buffer,
        fetched.contentType,
        "inbound",
        maxBytes
      );
      mediaPath = saved.path;
      mediaType = saved.contentType;
    } catch (err) {
      runtime2.error?.(`[${account.accountId}] Failed to download Zalo image: ${String(err)}`);
    }
  }
  await processMessageWithPipeline({
    message,
    token,
    account,
    config,
    runtime: runtime2,
    core,
    text: caption,
    mediaPath,
    mediaType,
    statusSink,
    fetcher
  });
}
async function processMessageWithPipeline(params) {
  const {
    message,
    token,
    account,
    config,
    runtime: runtime2,
    core,
    text,
    mediaPath,
    mediaType,
    statusSink,
    fetcher
  } = params;
  const pairing = createScopedPairingAccess({
    core,
    channel: "zalo",
    accountId: account.accountId
  });
  const { from, chat, message_id, date } = message;
  const isGroup = chat.chat_type === "GROUP";
  const chatId = chat.id;
  const senderId = from.id;
  const senderName = from.name;
  const dmPolicy2 = account.config.dmPolicy ?? "pairing";
  const configAllowFrom = (account.config.allowFrom ?? []).map((v) => String(v));
  const configuredGroupAllowFrom = (account.config.groupAllowFrom ?? []).map((v) => String(v));
  const groupAllowFrom = configuredGroupAllowFrom.length > 0 ? configuredGroupAllowFrom : configAllowFrom;
  const defaultGroupPolicy = resolveDefaultGroupPolicy(config);
  const groupAccess = isGroup ? evaluateZaloGroupAccess({
    providerConfigPresent: config.channels?.zalo !== void 0,
    configuredGroupPolicy: account.config.groupPolicy,
    defaultGroupPolicy,
    groupAllowFrom,
    senderId
  }) : void 0;
  if (groupAccess) {
    warnMissingProviderGroupPolicyFallbackOnce({
      providerMissingFallbackApplied: groupAccess.providerMissingFallbackApplied,
      providerKey: "zalo",
      accountId: account.accountId,
      log: (message2) => logVerbose(core, runtime2, message2)
    });
    if (!groupAccess.allowed) {
      if (groupAccess.reason === "disabled") {
        logVerbose(core, runtime2, `zalo: drop group ${chatId} (groupPolicy=disabled)`);
      } else if (groupAccess.reason === "empty_allowlist") {
        logVerbose(
          core,
          runtime2,
          `zalo: drop group ${chatId} (groupPolicy=allowlist, no groupAllowFrom)`
        );
      } else if (groupAccess.reason === "sender_not_allowlisted") {
        logVerbose(core, runtime2, `zalo: drop group sender ${senderId} (groupPolicy=allowlist)`);
      }
      return;
    }
  }
  const rawBody = text?.trim() || (mediaPath ? "<media:image>" : "");
  const { senderAllowedForCommands, commandAuthorized } = await resolveSenderCommandAuthorizationWithRuntime({
    cfg: config,
    rawBody,
    isGroup,
    dmPolicy: dmPolicy2,
    configuredAllowFrom: configAllowFrom,
    configuredGroupAllowFrom: groupAllowFrom,
    senderId,
    isSenderAllowed: isZaloSenderAllowed,
    readAllowFromStore: pairing.readAllowFromStore,
    runtime: core.channel.commands
  });
  const directDmOutcome = resolveDirectDmAuthorizationOutcome({
    isGroup,
    dmPolicy: dmPolicy2,
    senderAllowedForCommands
  });
  if (directDmOutcome === "disabled") {
    logVerbose(core, runtime2, `Blocked zalo DM from ${senderId} (dmPolicy=disabled)`);
    return;
  }
  if (directDmOutcome === "unauthorized") {
    if (dmPolicy2 === "pairing") {
      const { code, created } = await pairing.upsertPairingRequest({
        id: senderId,
        meta: { name: senderName ?? void 0 }
      });
      if (created) {
        logVerbose(core, runtime2, `zalo pairing request sender=${senderId}`);
        try {
          await sendMessage(
            token,
            {
              chat_id: chatId,
              text: core.channel.pairing.buildPairingReply({
                channel: "zalo",
                idLine: `Your Zalo user id: ${senderId}`,
                code
              })
            },
            fetcher
          );
          statusSink?.({ lastOutboundAt: Date.now() });
        } catch (err) {
          logVerbose(core, runtime2, `zalo pairing reply failed for ${senderId}: ${String(err)}`);
        }
      }
    } else {
      logVerbose(
        core,
        runtime2,
        `Blocked unauthorized zalo sender ${senderId} (dmPolicy=${dmPolicy2})`
      );
    }
    return;
  }
  const { route, buildEnvelope } = resolveInboundRouteEnvelopeBuilderWithRuntime({
    cfg: config,
    channel: "zalo",
    accountId: account.accountId,
    peer: {
      kind: isGroup ? "group" : "direct",
      id: chatId
    },
    runtime: core.channel,
    sessionStore: config.session?.store
  });
  if (isGroup && core.channel.commands.isControlCommandMessage(rawBody, config) && commandAuthorized !== true) {
    logVerbose(core, runtime2, `zalo: drop control command from unauthorized sender ${senderId}`);
    return;
  }
  const fromLabel = isGroup ? `group:${chatId}` : senderName || `user:${senderId}`;
  const { storePath, body } = buildEnvelope({
    channel: "Zalo",
    from: fromLabel,
    timestamp: date ? date * 1e3 : void 0,
    body: rawBody
  });
  const ctxPayload = core.channel.reply.finalizeInboundContext({
    Body: body,
    BodyForAgent: rawBody,
    RawBody: rawBody,
    CommandBody: rawBody,
    From: isGroup ? `zalo:group:${chatId}` : `zalo:${senderId}`,
    To: `zalo:${chatId}`,
    SessionKey: route.sessionKey,
    AccountId: route.accountId,
    ChatType: isGroup ? "group" : "direct",
    ConversationLabel: fromLabel,
    SenderName: senderName || void 0,
    SenderId: senderId,
    CommandAuthorized: commandAuthorized,
    Provider: "zalo",
    Surface: "zalo",
    MessageSid: message_id,
    MediaPath: mediaPath,
    MediaType: mediaType,
    MediaUrl: mediaPath,
    OriginatingChannel: "zalo",
    OriginatingTo: `zalo:${chatId}`
  });
  await core.channel.session.recordInboundSession({
    storePath,
    sessionKey: ctxPayload.SessionKey ?? route.sessionKey,
    ctx: ctxPayload,
    onRecordError: (err) => {
      runtime2.error?.(`zalo: failed updating session meta: ${String(err)}`);
    }
  });
  const tableMode = core.channel.text.resolveMarkdownTableMode({
    cfg: config,
    channel: "zalo",
    accountId: account.accountId
  });
  const { onModelSelected, ...prefixOptions } = createReplyPrefixOptions({
    cfg: config,
    agentId: route.agentId,
    channel: "zalo",
    accountId: account.accountId
  });
  await core.channel.reply.dispatchReplyWithBufferedBlockDispatcher({
    ctx: ctxPayload,
    cfg: config,
    dispatcherOptions: {
      ...prefixOptions,
      deliver: async (payload) => {
        await deliverZaloReply({
          payload,
          token,
          chatId,
          runtime: runtime2,
          core,
          config,
          accountId: account.accountId,
          statusSink,
          fetcher,
          tableMode
        });
      },
      onError: (err, info) => {
        runtime2.error?.(`[${account.accountId}] Zalo ${info.kind} reply failed: ${String(err)}`);
      }
    },
    replyOptions: {
      onModelSelected
    }
  });
}
async function deliverZaloReply(params) {
  const { payload, token, chatId, runtime: runtime2, core, config, accountId, statusSink, fetcher } = params;
  const tableMode = params.tableMode ?? "code";
  const text = core.channel.text.convertMarkdownTables(payload.text ?? "", tableMode);
  const sentMedia = await sendMediaWithLeadingCaption({
    mediaUrls: resolveOutboundMediaUrls(payload),
    caption: text,
    send: async ({ mediaUrl, caption }) => {
      await sendPhoto(token, { chat_id: chatId, photo: mediaUrl, caption }, fetcher);
      statusSink?.({ lastOutboundAt: Date.now() });
    },
    onError: (error) => {
      runtime2.error?.(`Zalo photo send failed: ${String(error)}`);
    }
  });
  if (sentMedia) {
    return;
  }
  if (text) {
    const chunkMode = core.channel.text.resolveChunkMode(config, "zalo", accountId);
    const chunks = core.channel.text.chunkMarkdownTextWithMode(text, ZALO_TEXT_LIMIT, chunkMode);
    for (const chunk of chunks) {
      try {
        await sendMessage(token, { chat_id: chatId, text: chunk }, fetcher);
        statusSink?.({ lastOutboundAt: Date.now() });
      } catch (err) {
        runtime2.error?.(`Zalo message send failed: ${String(err)}`);
      }
    }
  }
}
async function monitorZaloProvider(options) {
  const {
    token,
    account,
    config,
    runtime: runtime2,
    abortSignal,
    useWebhook,
    webhookUrl,
    webhookSecret,
    webhookPath,
    statusSink,
    fetcher: fetcherOverride
  } = options;
  const core = getZaloRuntime();
  const effectiveMediaMaxMb = account.config.mediaMaxMb ?? DEFAULT_MEDIA_MAX_MB;
  const fetcher = fetcherOverride ?? resolveZaloProxyFetch(account.config.proxy);
  let stopped = false;
  const stopHandlers = [];
  const stop = () => {
    stopped = true;
    for (const handler of stopHandlers) {
      handler();
    }
  };
  if (useWebhook) {
    if (!webhookUrl || !webhookSecret) {
      throw new Error("Zalo webhookUrl and webhookSecret are required for webhook mode");
    }
    if (!webhookUrl.startsWith("https://")) {
      throw new Error("Zalo webhook URL must use HTTPS");
    }
    if (webhookSecret.length < 8 || webhookSecret.length > 256) {
      throw new Error("Zalo webhook secret must be 8-256 characters");
    }
    const path = resolveWebhookPath({ webhookPath, webhookUrl, defaultPath: null });
    if (!path) {
      throw new Error("Zalo webhookPath could not be derived");
    }
    await setWebhook(token, { url: webhookUrl, secret_token: webhookSecret }, fetcher);
    const unregister = registerZaloWebhookTarget2({
      token,
      account,
      config,
      runtime: runtime2,
      core,
      path,
      secret: webhookSecret,
      statusSink: (patch) => statusSink?.(patch),
      mediaMaxMb: effectiveMediaMaxMb,
      fetcher
    });
    stopHandlers.push(unregister);
    abortSignal.addEventListener(
      "abort",
      () => {
        void deleteWebhook(token, fetcher).catch(() => {
        });
      },
      { once: true }
    );
    return { stop };
  }
  try {
    await deleteWebhook(token, fetcher);
  } catch {
  }
  startPollingLoop({
    token,
    account,
    config,
    runtime: runtime2,
    core,
    abortSignal,
    isStopped: () => stopped,
    mediaMaxMb: effectiveMediaMaxMb,
    statusSink,
    fetcher
  });
  return { stop };
}
var ZALO_TEXT_LIMIT, DEFAULT_MEDIA_MAX_MB, __testing;
var init_monitor = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/zalo/src/monitor.ts"() {
    "use strict";
    init_api();
    init_group_access();
    init_monitor_webhook();
    init_proxy();
    init_runtime();
    ZALO_TEXT_LIMIT = 2e3;
    DEFAULT_MEDIA_MAX_MB = 5;
    __testing = {
      evaluateZaloGroupAccess,
      resolveZaloRuntimeGroupPolicy
    };
  }
});

// vendor/openclaw-runtime/win-x64/extensions/zalo/index.ts
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";

// vendor/openclaw-runtime/win-x64/extensions/zalo/src/channel.ts
import {
  applyAccountNameToChannelSection,
  buildChannelConfigSchema,
  buildTokenChannelStatusSummary,
  DEFAULT_ACCOUNT_ID as DEFAULT_ACCOUNT_ID4,
  deleteAccountFromConfigSection,
  chunkTextForOutbound,
  formatAllowFromLowercase,
  formatPairingApproveHint,
  migrateBaseNameToDefaultAccount,
  normalizeAccountId as normalizeAccountId4,
  PAIRING_APPROVED_MESSAGE,
  resolveDefaultGroupPolicy as resolveDefaultGroupPolicy2,
  resolveOpenProviderRuntimeGroupPolicy as resolveOpenProviderRuntimeGroupPolicy2,
  resolveChannelAccountConfigBasePath,
  setAccountEnabledInConfigSection
} from "openclaw/plugin-sdk";

// vendor/openclaw-runtime/win-x64/extensions/zalo/src/accounts.ts
import {
  DEFAULT_ACCOUNT_ID as DEFAULT_ACCOUNT_ID2,
  normalizeAccountId as normalizeAccountId2,
  normalizeOptionalAccountId
} from "openclaw/plugin-sdk/account-id";

// vendor/openclaw-runtime/win-x64/extensions/zalo/src/token.ts
import { readFileSync } from "fs";
import { DEFAULT_ACCOUNT_ID, normalizeAccountId } from "openclaw/plugin-sdk/account-id";

// vendor/openclaw-runtime/win-x64/extensions/zalo/src/secret-input.ts
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

// vendor/openclaw-runtime/win-x64/extensions/zalo/src/token.ts
function resolveZaloToken(config, accountId, options) {
  const resolvedAccountId = accountId ?? DEFAULT_ACCOUNT_ID;
  const isDefaultAccount = resolvedAccountId === DEFAULT_ACCOUNT_ID;
  const baseConfig = config;
  const resolveAccountConfig2 = (id) => {
    const accounts = baseConfig?.accounts;
    if (!accounts || typeof accounts !== "object") {
      return void 0;
    }
    const direct = accounts[id];
    if (direct) {
      return direct;
    }
    const normalized = normalizeAccountId(id);
    const matchKey = Object.keys(accounts).find((key) => normalizeAccountId(key) === normalized);
    return matchKey ? accounts[matchKey] ?? void 0 : void 0;
  };
  const accountConfig = resolveAccountConfig2(resolvedAccountId);
  const accountHasBotToken = Boolean(
    accountConfig && Object.prototype.hasOwnProperty.call(accountConfig, "botToken")
  );
  if (accountConfig && accountHasBotToken) {
    const token = options?.allowUnresolvedSecretRef ? normalizeSecretInputString(accountConfig.botToken) : normalizeResolvedSecretInputString({
      value: accountConfig.botToken,
      path: `channels.zalo.accounts.${resolvedAccountId}.botToken`
    });
    if (token) {
      return { token, source: "config" };
    }
    const tokenFile = accountConfig.tokenFile?.trim();
    if (tokenFile) {
      try {
        const fileToken = readFileSync(tokenFile, "utf8").trim();
        if (fileToken) {
          return { token: fileToken, source: "configFile" };
        }
      } catch {
      }
    }
  }
  const accountTokenFile = accountConfig?.tokenFile?.trim();
  if (!accountHasBotToken && accountTokenFile) {
    try {
      const fileToken = readFileSync(accountTokenFile, "utf8").trim();
      if (fileToken) {
        return { token: fileToken, source: "configFile" };
      }
    } catch {
    }
  }
  if (!accountHasBotToken) {
    const token = options?.allowUnresolvedSecretRef ? normalizeSecretInputString(baseConfig?.botToken) : normalizeResolvedSecretInputString({
      value: baseConfig?.botToken,
      path: "channels.zalo.botToken"
    });
    if (token) {
      return { token, source: "config" };
    }
    const tokenFile = baseConfig?.tokenFile?.trim();
    if (tokenFile) {
      try {
        const fileToken = readFileSync(tokenFile, "utf8").trim();
        if (fileToken) {
          return { token: fileToken, source: "configFile" };
        }
      } catch {
      }
    }
  }
  if (isDefaultAccount) {
    const envToken = process.env.ZALO_BOT_TOKEN?.trim();
    if (envToken) {
      return { token: envToken, source: "env" };
    }
  }
  return { token: "", source: "none" };
}

// vendor/openclaw-runtime/win-x64/extensions/zalo/src/accounts.ts
function listConfiguredAccountIds(cfg) {
  const accounts = cfg.channels?.zalo?.accounts;
  if (!accounts || typeof accounts !== "object") {
    return [];
  }
  return Object.keys(accounts).filter(Boolean);
}
function listZaloAccountIds(cfg) {
  const ids = listConfiguredAccountIds(cfg);
  if (ids.length === 0) {
    return [DEFAULT_ACCOUNT_ID2];
  }
  return ids.toSorted((a, b) => a.localeCompare(b));
}
function resolveDefaultZaloAccountId(cfg) {
  const zaloConfig = cfg.channels?.zalo;
  const preferred = normalizeOptionalAccountId(zaloConfig?.defaultAccount);
  if (preferred && listZaloAccountIds(cfg).some((accountId) => normalizeAccountId2(accountId) === preferred)) {
    return preferred;
  }
  const ids = listZaloAccountIds(cfg);
  if (ids.includes(DEFAULT_ACCOUNT_ID2)) {
    return DEFAULT_ACCOUNT_ID2;
  }
  return ids[0] ?? DEFAULT_ACCOUNT_ID2;
}
function resolveAccountConfig(cfg, accountId) {
  const accounts = cfg.channels?.zalo?.accounts;
  if (!accounts || typeof accounts !== "object") {
    return void 0;
  }
  return accounts[accountId];
}
function mergeZaloAccountConfig(cfg, accountId) {
  const raw = cfg.channels?.zalo ?? {};
  const { accounts: _ignored, defaultAccount: _ignored2, ...base } = raw;
  const account = resolveAccountConfig(cfg, accountId) ?? {};
  return { ...base, ...account };
}
function resolveZaloAccount(params) {
  const accountId = normalizeAccountId2(params.accountId);
  const baseEnabled = params.cfg.channels?.zalo?.enabled !== false;
  const merged = mergeZaloAccountConfig(params.cfg, accountId);
  const accountEnabled = merged.enabled !== false;
  const enabled = baseEnabled && accountEnabled;
  const tokenResolution = resolveZaloToken(
    params.cfg.channels?.zalo,
    accountId,
    { allowUnresolvedSecretRef: params.allowUnresolvedSecretRef }
  );
  return {
    accountId,
    name: merged.name?.trim() || void 0,
    enabled,
    token: tokenResolution.token,
    tokenSource: tokenResolution.source,
    config: merged
  };
}
function listEnabledZaloAccounts(cfg) {
  return listZaloAccountIds(cfg).map((accountId) => resolveZaloAccount({ cfg, accountId })).filter((account) => account.enabled);
}

// vendor/openclaw-runtime/win-x64/extensions/zalo/src/actions.ts
import { extractToolSend, jsonResult, readStringParam } from "openclaw/plugin-sdk";

// vendor/openclaw-runtime/win-x64/extensions/zalo/src/send.ts
init_api();
init_proxy();
function resolveSendContext(options) {
  if (options.cfg) {
    const account = resolveZaloAccount({
      cfg: options.cfg,
      accountId: options.accountId
    });
    const token2 = options.token || account.token;
    const proxy2 = options.proxy ?? account.config.proxy;
    return { token: token2, fetcher: resolveZaloProxyFetch(proxy2) };
  }
  const token = options.token ?? resolveZaloToken(void 0, options.accountId).token;
  const proxy = options.proxy;
  return { token, fetcher: resolveZaloProxyFetch(proxy) };
}
async function sendMessageZalo(chatId, text, options = {}) {
  const { token, fetcher } = resolveSendContext(options);
  if (!token) {
    return { ok: false, error: "No Zalo bot token configured" };
  }
  if (!chatId?.trim()) {
    return { ok: false, error: "No chat_id provided" };
  }
  if (options.mediaUrl) {
    return sendPhotoZalo(chatId, options.mediaUrl, {
      ...options,
      token,
      caption: text || options.caption
    });
  }
  try {
    const response = await sendMessage(
      token,
      {
        chat_id: chatId.trim(),
        text: text.slice(0, 2e3)
      },
      fetcher
    );
    if (response.ok && response.result) {
      return { ok: true, messageId: response.result.message_id };
    }
    return { ok: false, error: "Failed to send message" };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
async function sendPhotoZalo(chatId, photoUrl, options = {}) {
  const { token, fetcher } = resolveSendContext(options);
  if (!token) {
    return { ok: false, error: "No Zalo bot token configured" };
  }
  if (!chatId?.trim()) {
    return { ok: false, error: "No chat_id provided" };
  }
  if (!photoUrl?.trim()) {
    return { ok: false, error: "No photo URL provided" };
  }
  try {
    const response = await sendPhoto(
      token,
      {
        chat_id: chatId.trim(),
        photo: photoUrl.trim(),
        caption: options.caption?.slice(0, 2e3)
      },
      fetcher
    );
    if (response.ok && response.result) {
      return { ok: true, messageId: response.result.message_id };
    }
    return { ok: false, error: "Failed to send photo" };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// vendor/openclaw-runtime/win-x64/extensions/zalo/src/actions.ts
var providerId = "zalo";
function listEnabledAccounts(cfg) {
  return listEnabledZaloAccounts(cfg).filter(
    (account) => account.enabled && account.tokenSource !== "none"
  );
}
var zaloMessageActions = {
  listActions: ({ cfg }) => {
    const accounts = listEnabledAccounts(cfg);
    if (accounts.length === 0) {
      return [];
    }
    const actions = /* @__PURE__ */ new Set(["send"]);
    return Array.from(actions);
  },
  supportsButtons: () => false,
  extractToolSend: ({ args }) => extractToolSend(args, "sendMessage"),
  handleAction: async ({ action, params, cfg, accountId }) => {
    if (action === "send") {
      const to = readStringParam(params, "to", { required: true });
      const content = readStringParam(params, "message", {
        required: true,
        allowEmpty: true
      });
      const mediaUrl = readStringParam(params, "media", { trim: false });
      const result = await sendMessageZalo(to ?? "", content ?? "", {
        accountId: accountId ?? void 0,
        mediaUrl: mediaUrl ?? void 0,
        cfg
      });
      if (!result.ok) {
        return jsonResult({
          ok: false,
          error: result.error ?? "Failed to send Zalo message"
        });
      }
      return jsonResult({ ok: true, to, messageId: result.messageId });
    }
    throw new Error(`Action ${action} is not supported for provider ${providerId}.`);
  }
};

// vendor/openclaw-runtime/win-x64/extensions/zalo/src/config-schema.ts
import { MarkdownConfigSchema } from "openclaw/plugin-sdk";
import { z as z2 } from "zod";
var allowFromEntry = z2.union([z2.string(), z2.number()]);
var zaloAccountSchema = z2.object({
  name: z2.string().optional(),
  enabled: z2.boolean().optional(),
  markdown: MarkdownConfigSchema,
  botToken: buildSecretInputSchema().optional(),
  tokenFile: z2.string().optional(),
  webhookUrl: z2.string().optional(),
  webhookSecret: buildSecretInputSchema().optional(),
  webhookPath: z2.string().optional(),
  dmPolicy: z2.enum(["pairing", "allowlist", "open", "disabled"]).optional(),
  allowFrom: z2.array(allowFromEntry).optional(),
  groupPolicy: z2.enum(["disabled", "allowlist", "open"]).optional(),
  groupAllowFrom: z2.array(allowFromEntry).optional(),
  mediaMaxMb: z2.number().optional(),
  proxy: z2.string().optional(),
  responsePrefix: z2.string().optional()
});
var ZaloConfigSchema = zaloAccountSchema.extend({
  accounts: z2.object({}).catchall(zaloAccountSchema).optional(),
  defaultAccount: z2.string().optional()
});

// vendor/openclaw-runtime/win-x64/extensions/zalo/src/onboarding.ts
import {
  addWildcardAllowFrom,
  DEFAULT_ACCOUNT_ID as DEFAULT_ACCOUNT_ID3,
  hasConfiguredSecretInput as hasConfiguredSecretInput2,
  mergeAllowFromEntries,
  normalizeAccountId as normalizeAccountId3,
  promptAccountId,
  promptSingleChannelSecretInput
} from "openclaw/plugin-sdk";
var channel = "zalo";
function setZaloDmPolicy(cfg, dmPolicy2) {
  const allowFrom = dmPolicy2 === "open" ? addWildcardAllowFrom(cfg.channels?.zalo?.allowFrom) : void 0;
  return {
    ...cfg,
    channels: {
      ...cfg.channels,
      zalo: {
        ...cfg.channels?.zalo,
        dmPolicy: dmPolicy2,
        ...allowFrom ? { allowFrom } : {}
      }
    }
  };
}
function setZaloUpdateMode(cfg, accountId, mode, webhookUrl, webhookSecret, webhookPath) {
  const isDefault = accountId === DEFAULT_ACCOUNT_ID3;
  if (mode === "polling") {
    if (isDefault) {
      const {
        webhookUrl: _url2,
        webhookSecret: _secret2,
        webhookPath: _path2,
        ...rest2
      } = cfg.channels?.zalo ?? {};
      return {
        ...cfg,
        channels: {
          ...cfg.channels,
          zalo: rest2
        }
      };
    }
    const accounts2 = { ...cfg.channels?.zalo?.accounts };
    const existing = accounts2[accountId] ?? {};
    const { webhookUrl: _url, webhookSecret: _secret, webhookPath: _path, ...rest } = existing;
    accounts2[accountId] = rest;
    return {
      ...cfg,
      channels: {
        ...cfg.channels,
        zalo: {
          ...cfg.channels?.zalo,
          accounts: accounts2
        }
      }
    };
  }
  if (isDefault) {
    return {
      ...cfg,
      channels: {
        ...cfg.channels,
        zalo: {
          ...cfg.channels?.zalo,
          webhookUrl,
          webhookSecret,
          webhookPath
        }
      }
    };
  }
  const accounts = { ...cfg.channels?.zalo?.accounts };
  accounts[accountId] = {
    ...accounts[accountId],
    webhookUrl,
    webhookSecret,
    webhookPath
  };
  return {
    ...cfg,
    channels: {
      ...cfg.channels,
      zalo: {
        ...cfg.channels?.zalo,
        accounts
      }
    }
  };
}
async function noteZaloTokenHelp(prompter) {
  await prompter.note(
    [
      "1) Open Zalo Bot Platform: https://bot.zaloplatforms.com",
      "2) Create a bot and get the token",
      "3) Token looks like 12345689:abc-xyz",
      "Tip: you can also set ZALO_BOT_TOKEN in your env.",
      "Docs: https://docs.openclaw.ai/channels/zalo"
    ].join("\n"),
    "Zalo bot token"
  );
}
async function promptZaloAllowFrom(params) {
  const { cfg, prompter, accountId } = params;
  const resolved = resolveZaloAccount({ cfg, accountId });
  const existingAllowFrom = resolved.config.allowFrom ?? [];
  const entry = await prompter.text({
    message: "Zalo allowFrom (user id)",
    placeholder: "123456789",
    initialValue: existingAllowFrom[0] ? String(existingAllowFrom[0]) : void 0,
    validate: (value) => {
      const raw = String(value ?? "").trim();
      if (!raw) {
        return "Required";
      }
      if (!/^\d+$/.test(raw)) {
        return "Use a numeric Zalo user id";
      }
      return void 0;
    }
  });
  const normalized = String(entry).trim();
  const unique = mergeAllowFromEntries(existingAllowFrom, [normalized]);
  if (accountId === DEFAULT_ACCOUNT_ID3) {
    return {
      ...cfg,
      channels: {
        ...cfg.channels,
        zalo: {
          ...cfg.channels?.zalo,
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
      zalo: {
        ...cfg.channels?.zalo,
        enabled: true,
        accounts: {
          ...cfg.channels?.zalo?.accounts,
          [accountId]: {
            ...cfg.channels?.zalo?.accounts?.[accountId],
            enabled: cfg.channels?.zalo?.accounts?.[accountId]?.enabled ?? true,
            dmPolicy: "allowlist",
            allowFrom: unique
          }
        }
      }
    }
  };
}
var dmPolicy = {
  label: "Zalo",
  channel,
  policyKey: "channels.zalo.dmPolicy",
  allowFromKey: "channels.zalo.allowFrom",
  getCurrent: (cfg) => cfg.channels?.zalo?.dmPolicy ?? "pairing",
  setPolicy: (cfg, policy) => setZaloDmPolicy(cfg, policy),
  promptAllowFrom: async ({ cfg, prompter, accountId }) => {
    const id = accountId && normalizeAccountId3(accountId) ? normalizeAccountId3(accountId) ?? DEFAULT_ACCOUNT_ID3 : resolveDefaultZaloAccountId(cfg);
    return promptZaloAllowFrom({
      cfg,
      prompter,
      accountId: id
    });
  }
};
var zaloOnboardingAdapter = {
  channel,
  dmPolicy,
  getStatus: async ({ cfg }) => {
    const configured = listZaloAccountIds(cfg).some((accountId) => {
      const account = resolveZaloAccount({
        cfg,
        accountId,
        allowUnresolvedSecretRef: true
      });
      return Boolean(account.token) || hasConfiguredSecretInput2(account.config.botToken) || Boolean(account.config.tokenFile?.trim());
    });
    return {
      channel,
      configured,
      statusLines: [`Zalo: ${configured ? "configured" : "needs token"}`],
      selectionHint: configured ? "recommended \xB7 configured" : "recommended \xB7 newcomer-friendly",
      quickstartScore: configured ? 1 : 10
    };
  },
  configure: async ({
    cfg,
    prompter,
    accountOverrides,
    shouldPromptAccountIds,
    forceAllowFrom
  }) => {
    const zaloOverride = accountOverrides.zalo?.trim();
    const defaultZaloAccountId = resolveDefaultZaloAccountId(cfg);
    let zaloAccountId = zaloOverride ? normalizeAccountId3(zaloOverride) : defaultZaloAccountId;
    if (shouldPromptAccountIds && !zaloOverride) {
      zaloAccountId = await promptAccountId({
        cfg,
        prompter,
        label: "Zalo",
        currentId: zaloAccountId,
        listAccountIds: listZaloAccountIds,
        defaultAccountId: defaultZaloAccountId
      });
    }
    let next = cfg;
    const resolvedAccount = resolveZaloAccount({
      cfg: next,
      accountId: zaloAccountId,
      allowUnresolvedSecretRef: true
    });
    const accountConfigured = Boolean(resolvedAccount.token);
    const allowEnv = zaloAccountId === DEFAULT_ACCOUNT_ID3;
    const canUseEnv = allowEnv && Boolean(process.env.ZALO_BOT_TOKEN?.trim());
    const hasConfigToken = Boolean(
      hasConfiguredSecretInput2(resolvedAccount.config.botToken) || resolvedAccount.config.tokenFile
    );
    let token = null;
    if (!accountConfigured) {
      await noteZaloTokenHelp(prompter);
    }
    const tokenResult = await promptSingleChannelSecretInput({
      cfg: next,
      prompter,
      providerHint: "zalo",
      credentialLabel: "bot token",
      accountConfigured,
      canUseEnv: canUseEnv && !hasConfigToken,
      hasConfigToken,
      envPrompt: "ZALO_BOT_TOKEN detected. Use env var?",
      keepPrompt: "Zalo token already configured. Keep it?",
      inputPrompt: "Enter Zalo bot token",
      preferredEnvVar: "ZALO_BOT_TOKEN"
    });
    if (tokenResult.action === "set") {
      token = tokenResult.value;
    }
    if (tokenResult.action === "use-env" && zaloAccountId === DEFAULT_ACCOUNT_ID3) {
      next = {
        ...next,
        channels: {
          ...next.channels,
          zalo: {
            ...next.channels?.zalo,
            enabled: true
          }
        }
      };
    }
    if (token) {
      if (zaloAccountId === DEFAULT_ACCOUNT_ID3) {
        next = {
          ...next,
          channels: {
            ...next.channels,
            zalo: {
              ...next.channels?.zalo,
              enabled: true,
              botToken: token
            }
          }
        };
      } else {
        next = {
          ...next,
          channels: {
            ...next.channels,
            zalo: {
              ...next.channels?.zalo,
              enabled: true,
              accounts: {
                ...next.channels?.zalo?.accounts,
                [zaloAccountId]: {
                  ...next.channels?.zalo?.accounts?.[zaloAccountId],
                  enabled: true,
                  botToken: token
                }
              }
            }
          }
        };
      }
    }
    const wantsWebhook = await prompter.confirm({
      message: "Use webhook mode for Zalo?",
      initialValue: Boolean(resolvedAccount.config.webhookUrl)
    });
    if (wantsWebhook) {
      const webhookUrl = String(
        await prompter.text({
          message: "Webhook URL (https://...) ",
          initialValue: resolvedAccount.config.webhookUrl,
          validate: (value) => value?.trim()?.startsWith("https://") ? void 0 : "HTTPS URL required"
        })
      ).trim();
      const defaultPath = (() => {
        try {
          return new URL(webhookUrl).pathname || "/zalo-webhook";
        } catch {
          return "/zalo-webhook";
        }
      })();
      let webhookSecretResult = await promptSingleChannelSecretInput({
        cfg: next,
        prompter,
        providerHint: "zalo-webhook",
        credentialLabel: "webhook secret",
        accountConfigured: hasConfiguredSecretInput2(resolvedAccount.config.webhookSecret),
        canUseEnv: false,
        hasConfigToken: hasConfiguredSecretInput2(resolvedAccount.config.webhookSecret),
        envPrompt: "",
        keepPrompt: "Zalo webhook secret already configured. Keep it?",
        inputPrompt: "Webhook secret (8-256 chars)",
        preferredEnvVar: "ZALO_WEBHOOK_SECRET"
      });
      while (webhookSecretResult.action === "set" && typeof webhookSecretResult.value === "string" && (webhookSecretResult.value.length < 8 || webhookSecretResult.value.length > 256)) {
        await prompter.note("Webhook secret must be between 8 and 256 characters.", "Zalo webhook");
        webhookSecretResult = await promptSingleChannelSecretInput({
          cfg: next,
          prompter,
          providerHint: "zalo-webhook",
          credentialLabel: "webhook secret",
          accountConfigured: false,
          canUseEnv: false,
          hasConfigToken: false,
          envPrompt: "",
          keepPrompt: "Zalo webhook secret already configured. Keep it?",
          inputPrompt: "Webhook secret (8-256 chars)",
          preferredEnvVar: "ZALO_WEBHOOK_SECRET"
        });
      }
      const webhookSecret = webhookSecretResult.action === "set" ? webhookSecretResult.value : resolvedAccount.config.webhookSecret;
      const webhookPath = String(
        await prompter.text({
          message: "Webhook path (optional)",
          initialValue: resolvedAccount.config.webhookPath ?? defaultPath
        })
      ).trim();
      next = setZaloUpdateMode(
        next,
        zaloAccountId,
        "webhook",
        webhookUrl,
        webhookSecret,
        webhookPath || void 0
      );
    } else {
      next = setZaloUpdateMode(next, zaloAccountId, "polling");
    }
    if (forceAllowFrom) {
      next = await promptZaloAllowFrom({
        cfg: next,
        prompter,
        accountId: zaloAccountId
      });
    }
    return { cfg: next, accountId: zaloAccountId };
  }
};

// vendor/openclaw-runtime/win-x64/extensions/zalo/src/probe.ts
init_api();
async function probeZalo(token, timeoutMs = 5e3, fetcher) {
  if (!token?.trim()) {
    return { ok: false, error: "No token provided", elapsedMs: 0 };
  }
  const startTime = Date.now();
  try {
    const response = await getMe(token.trim(), timeoutMs, fetcher);
    const elapsedMs = Date.now() - startTime;
    if (response.ok && response.result) {
      return { ok: true, bot: response.result, elapsedMs };
    }
    return { ok: false, error: "Invalid response from Zalo API", elapsedMs };
  } catch (err) {
    const elapsedMs = Date.now() - startTime;
    if (err instanceof ZaloApiError) {
      return { ok: false, error: err.description ?? err.message, elapsedMs };
    }
    if (err instanceof Error) {
      if (err.name === "AbortError") {
        return { ok: false, error: `Request timed out after ${timeoutMs}ms`, elapsedMs };
      }
      return { ok: false, error: err.message, elapsedMs };
    }
    return { ok: false, error: String(err), elapsedMs };
  }
}

// vendor/openclaw-runtime/win-x64/extensions/zalo/src/channel.ts
init_proxy();

// vendor/openclaw-runtime/win-x64/extensions/zalo/src/status-issues.ts
var isRecord = (value) => Boolean(value && typeof value === "object");
var asString = (value) => typeof value === "string" ? value : typeof value === "number" ? String(value) : void 0;
function readZaloAccountStatus(value) {
  if (!isRecord(value)) {
    return null;
  }
  return {
    accountId: value.accountId,
    enabled: value.enabled,
    configured: value.configured,
    dmPolicy: value.dmPolicy
  };
}
function collectZaloStatusIssues(accounts) {
  const issues = [];
  for (const entry of accounts) {
    const account = readZaloAccountStatus(entry);
    if (!account) {
      continue;
    }
    const accountId = asString(account.accountId) ?? "default";
    const enabled = account.enabled !== false;
    const configured = account.configured === true;
    if (!enabled || !configured) {
      continue;
    }
    if (account.dmPolicy === "open") {
      issues.push({
        channel: "zalo",
        accountId,
        kind: "config",
        message: 'Zalo dmPolicy is "open", allowing any user to message the bot without pairing.',
        fix: 'Set channels.zalo.dmPolicy to "pairing" or "allowlist" to restrict access.'
      });
    }
  }
  return issues;
}

// vendor/openclaw-runtime/win-x64/extensions/zalo/src/channel.ts
var meta = {
  id: "zalo",
  label: "Zalo",
  selectionLabel: "Zalo (Bot API)",
  docsPath: "/channels/zalo",
  docsLabel: "zalo",
  blurb: "Vietnam-focused messaging platform with Bot API.",
  aliases: ["zl"],
  order: 80,
  quickstartAllowFrom: true
};
function normalizeZaloMessagingTarget(raw) {
  const trimmed = raw?.trim();
  if (!trimmed) {
    return void 0;
  }
  return trimmed.replace(/^(zalo|zl):/i, "");
}
var zaloDock = {
  id: "zalo",
  capabilities: {
    chatTypes: ["direct", "group"],
    media: true,
    blockStreaming: true
  },
  outbound: { textChunkLimit: 2e3 },
  config: {
    resolveAllowFrom: ({ cfg, accountId }) => (resolveZaloAccount({ cfg, accountId }).config.allowFrom ?? []).map(
      (entry) => String(entry)
    ),
    formatAllowFrom: ({ allowFrom }) => formatAllowFromLowercase({ allowFrom, stripPrefixRe: /^(zalo|zl):/i })
  },
  groups: {
    resolveRequireMention: () => true
  },
  threading: {
    resolveReplyToMode: () => "off"
  }
};
var zaloPlugin = {
  id: "zalo",
  meta,
  onboarding: zaloOnboardingAdapter,
  capabilities: {
    chatTypes: ["direct", "group"],
    media: true,
    reactions: false,
    threads: false,
    polls: false,
    nativeCommands: false,
    blockStreaming: true
  },
  reload: { configPrefixes: ["channels.zalo"] },
  configSchema: buildChannelConfigSchema(ZaloConfigSchema),
  config: {
    listAccountIds: (cfg) => listZaloAccountIds(cfg),
    resolveAccount: (cfg, accountId) => resolveZaloAccount({ cfg, accountId }),
    defaultAccountId: (cfg) => resolveDefaultZaloAccountId(cfg),
    setAccountEnabled: ({ cfg, accountId, enabled }) => setAccountEnabledInConfigSection({
      cfg,
      sectionKey: "zalo",
      accountId,
      enabled,
      allowTopLevel: true
    }),
    deleteAccount: ({ cfg, accountId }) => deleteAccountFromConfigSection({
      cfg,
      sectionKey: "zalo",
      accountId,
      clearBaseFields: ["botToken", "tokenFile", "name"]
    }),
    isConfigured: (account) => Boolean(account.token?.trim()),
    describeAccount: (account) => ({
      accountId: account.accountId,
      name: account.name,
      enabled: account.enabled,
      configured: Boolean(account.token?.trim()),
      tokenSource: account.tokenSource
    }),
    resolveAllowFrom: ({ cfg, accountId }) => (resolveZaloAccount({ cfg, accountId }).config.allowFrom ?? []).map(
      (entry) => String(entry)
    ),
    formatAllowFrom: ({ allowFrom }) => formatAllowFromLowercase({ allowFrom, stripPrefixRe: /^(zalo|zl):/i })
  },
  security: {
    resolveDmPolicy: ({ cfg, accountId, account }) => {
      const resolvedAccountId = accountId ?? account.accountId ?? DEFAULT_ACCOUNT_ID4;
      const basePath = resolveChannelAccountConfigBasePath({
        cfg,
        channelKey: "zalo",
        accountId: resolvedAccountId
      });
      return {
        policy: account.config.dmPolicy ?? "pairing",
        allowFrom: account.config.allowFrom ?? [],
        policyPath: `${basePath}dmPolicy`,
        allowFromPath: basePath,
        approveHint: formatPairingApproveHint("zalo"),
        normalizeEntry: (raw) => raw.replace(/^(zalo|zl):/i, "")
      };
    },
    collectWarnings: ({ account, cfg }) => {
      const defaultGroupPolicy = resolveDefaultGroupPolicy2(cfg);
      const { groupPolicy } = resolveOpenProviderRuntimeGroupPolicy2({
        providerConfigPresent: cfg.channels?.zalo !== void 0,
        groupPolicy: account.config.groupPolicy,
        defaultGroupPolicy
      });
      if (groupPolicy !== "open") {
        return [];
      }
      const explicitGroupAllowFrom = (account.config.groupAllowFrom ?? []).map(
        (entry) => String(entry)
      );
      const dmAllowFrom = (account.config.allowFrom ?? []).map((entry) => String(entry));
      const effectiveAllowFrom = explicitGroupAllowFrom.length > 0 ? explicitGroupAllowFrom : dmAllowFrom;
      if (effectiveAllowFrom.length > 0) {
        return [
          `- Zalo groups: groupPolicy="open" allows any member to trigger (mention-gated). Set channels.zalo.groupPolicy="allowlist" + channels.zalo.groupAllowFrom to restrict senders.`
        ];
      }
      return [
        `- Zalo groups: groupPolicy="open" with no groupAllowFrom/allowFrom allowlist; any member can trigger (mention-gated). Set channels.zalo.groupPolicy="allowlist" + channels.zalo.groupAllowFrom.`
      ];
    }
  },
  groups: {
    resolveRequireMention: () => true
  },
  threading: {
    resolveReplyToMode: () => "off"
  },
  actions: zaloMessageActions,
  messaging: {
    normalizeTarget: normalizeZaloMessagingTarget,
    targetResolver: {
      looksLikeId: (raw) => {
        const trimmed = raw.trim();
        if (!trimmed) {
          return false;
        }
        return /^\d{3,}$/.test(trimmed);
      },
      hint: "<chatId>"
    }
  },
  directory: {
    self: async () => null,
    listPeers: async ({ cfg, accountId, query, limit }) => {
      const account = resolveZaloAccount({ cfg, accountId });
      const q = query?.trim().toLowerCase() || "";
      const peers = Array.from(
        new Set(
          (account.config.allowFrom ?? []).map((entry) => String(entry).trim()).filter((entry) => Boolean(entry) && entry !== "*").map((entry) => entry.replace(/^(zalo|zl):/i, ""))
        )
      ).filter((id) => q ? id.toLowerCase().includes(q) : true).slice(0, limit && limit > 0 ? limit : void 0).map((id) => ({ kind: "user", id }));
      return peers;
    },
    listGroups: async () => []
  },
  setup: {
    resolveAccountId: ({ accountId }) => normalizeAccountId4(accountId),
    applyAccountName: ({ cfg, accountId, name }) => applyAccountNameToChannelSection({
      cfg,
      channelKey: "zalo",
      accountId,
      name
    }),
    validateInput: ({ accountId, input }) => {
      if (input.useEnv && accountId !== DEFAULT_ACCOUNT_ID4) {
        return "ZALO_BOT_TOKEN can only be used for the default account.";
      }
      if (!input.useEnv && !input.token && !input.tokenFile) {
        return "Zalo requires token or --token-file (or --use-env).";
      }
      return null;
    },
    applyAccountConfig: ({ cfg, accountId, input }) => {
      const namedConfig = applyAccountNameToChannelSection({
        cfg,
        channelKey: "zalo",
        accountId,
        name: input.name
      });
      const next = accountId !== DEFAULT_ACCOUNT_ID4 ? migrateBaseNameToDefaultAccount({
        cfg: namedConfig,
        channelKey: "zalo"
      }) : namedConfig;
      if (accountId === DEFAULT_ACCOUNT_ID4) {
        return {
          ...next,
          channels: {
            ...next.channels,
            zalo: {
              ...next.channels?.zalo,
              enabled: true,
              ...input.useEnv ? {} : input.tokenFile ? { tokenFile: input.tokenFile } : input.token ? { botToken: input.token } : {}
            }
          }
        };
      }
      return {
        ...next,
        channels: {
          ...next.channels,
          zalo: {
            ...next.channels?.zalo,
            enabled: true,
            accounts: {
              ...next.channels?.zalo?.accounts,
              [accountId]: {
                ...next.channels?.zalo?.accounts?.[accountId],
                enabled: true,
                ...input.tokenFile ? { tokenFile: input.tokenFile } : input.token ? { botToken: input.token } : {}
              }
            }
          }
        }
      };
    }
  },
  pairing: {
    idLabel: "zaloUserId",
    normalizeAllowEntry: (entry) => entry.replace(/^(zalo|zl):/i, ""),
    notifyApproval: async ({ cfg, id }) => {
      const account = resolveZaloAccount({ cfg });
      if (!account.token) {
        throw new Error("Zalo token not configured");
      }
      await sendMessageZalo(id, PAIRING_APPROVED_MESSAGE, { token: account.token });
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
        return { channel: "zalo", messageId: "" };
      }
      if (urls.length > 0) {
        let lastResult2 = await zaloPlugin.outbound.sendMedia({
          ...ctx,
          text,
          mediaUrl: urls[0]
        });
        for (let i = 1; i < urls.length; i++) {
          lastResult2 = await zaloPlugin.outbound.sendMedia({
            ...ctx,
            text: "",
            mediaUrl: urls[i]
          });
        }
        return lastResult2;
      }
      const outbound = zaloPlugin.outbound;
      const limit = outbound.textChunkLimit;
      const chunks = limit && outbound.chunker ? outbound.chunker(text, limit) : [text];
      let lastResult;
      for (const chunk of chunks) {
        lastResult = await outbound.sendText({ ...ctx, text: chunk });
      }
      return lastResult;
    },
    sendText: async ({ to, text, accountId, cfg }) => {
      const result = await sendMessageZalo(to, text, {
        accountId: accountId ?? void 0,
        cfg
      });
      return {
        channel: "zalo",
        ok: result.ok,
        messageId: result.messageId ?? "",
        error: result.error ? new Error(result.error) : void 0
      };
    },
    sendMedia: async ({ to, text, mediaUrl, accountId, cfg }) => {
      const result = await sendMessageZalo(to, text, {
        accountId: accountId ?? void 0,
        mediaUrl,
        cfg
      });
      return {
        channel: "zalo",
        ok: result.ok,
        messageId: result.messageId ?? "",
        error: result.error ? new Error(result.error) : void 0
      };
    }
  },
  status: {
    defaultRuntime: {
      accountId: DEFAULT_ACCOUNT_ID4,
      running: false,
      lastStartAt: null,
      lastStopAt: null,
      lastError: null
    },
    collectStatusIssues: collectZaloStatusIssues,
    buildChannelSummary: ({ snapshot }) => buildTokenChannelStatusSummary(snapshot),
    probeAccount: async ({ account, timeoutMs }) => probeZalo(account.token, timeoutMs, resolveZaloProxyFetch(account.config.proxy)),
    buildAccountSnapshot: ({ account, runtime: runtime2 }) => {
      const configured = Boolean(account.token?.trim());
      return {
        accountId: account.accountId,
        name: account.name,
        enabled: account.enabled,
        configured,
        tokenSource: account.tokenSource,
        running: runtime2?.running ?? false,
        lastStartAt: runtime2?.lastStartAt ?? null,
        lastStopAt: runtime2?.lastStopAt ?? null,
        lastError: runtime2?.lastError ?? null,
        mode: account.config.webhookUrl ? "webhook" : "polling",
        lastInboundAt: runtime2?.lastInboundAt ?? null,
        lastOutboundAt: runtime2?.lastOutboundAt ?? null,
        dmPolicy: account.config.dmPolicy ?? "pairing"
      };
    }
  },
  gateway: {
    startAccount: async (ctx) => {
      const account = ctx.account;
      const token = account.token.trim();
      let zaloBotLabel = "";
      const fetcher = resolveZaloProxyFetch(account.config.proxy);
      try {
        const probe = await probeZalo(token, 2500, fetcher);
        const name = probe.ok ? probe.bot?.name?.trim() : null;
        if (name) {
          zaloBotLabel = ` (${name})`;
        }
        ctx.setStatus({
          accountId: account.accountId,
          bot: probe.bot
        });
      } catch {
      }
      ctx.log?.info(`[${account.accountId}] starting provider${zaloBotLabel}`);
      const { monitorZaloProvider: monitorZaloProvider2 } = await Promise.resolve().then(() => (init_monitor(), monitor_exports));
      return monitorZaloProvider2({
        token,
        account,
        config: ctx.cfg,
        runtime: ctx.runtime,
        abortSignal: ctx.abortSignal,
        useWebhook: Boolean(account.config.webhookUrl),
        webhookUrl: account.config.webhookUrl,
        webhookSecret: normalizeSecretInputString(account.config.webhookSecret),
        webhookPath: account.config.webhookPath,
        fetcher,
        statusSink: (patch) => ctx.setStatus({ accountId: ctx.accountId, ...patch })
      });
    }
  }
};

// vendor/openclaw-runtime/win-x64/extensions/zalo/index.ts
init_runtime();
var plugin = {
  id: "zalo",
  name: "Zalo",
  description: "Zalo channel plugin (Bot API)",
  configSchema: emptyPluginConfigSchema(),
  register(api) {
    setZaloRuntime(api.runtime);
    api.registerChannel({ plugin: zaloPlugin, dock: zaloDock });
  }
};
var zalo_default = plugin;
export {
  zalo_default as default
};
