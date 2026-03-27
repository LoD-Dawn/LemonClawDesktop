// vendor/openclaw-runtime/win-x64/extensions/tlon/index.ts
import { spawn } from "child_process";
import { existsSync } from "fs";
import { dirname, join as join2 } from "path";
import { fileURLToPath } from "url";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";

// vendor/openclaw-runtime/win-x64/extensions/tlon/src/channel.ts
import crypto from "crypto";
import { configureClient } from "@tloncorp/api";
import {
  applyAccountNameToChannelSection,
  DEFAULT_ACCOUNT_ID as DEFAULT_ACCOUNT_ID2,
  normalizeAccountId as normalizeAccountId2
} from "openclaw/plugin-sdk";

// vendor/openclaw-runtime/win-x64/extensions/tlon/src/account-fields.ts
function buildTlonAccountFields(input) {
  return {
    ...input.ship ? { ship: input.ship } : {},
    ...input.url ? { url: input.url } : {},
    ...input.code ? { code: input.code } : {},
    ...typeof input.allowPrivateNetwork === "boolean" ? { allowPrivateNetwork: input.allowPrivateNetwork } : {},
    ...input.groupChannels ? { groupChannels: input.groupChannels } : {},
    ...input.dmAllowlist ? { dmAllowlist: input.dmAllowlist } : {},
    ...typeof input.autoDiscoverChannels === "boolean" ? { autoDiscoverChannels: input.autoDiscoverChannels } : {},
    ...input.ownerShip ? { ownerShip: input.ownerShip } : {}
  };
}

// vendor/openclaw-runtime/win-x64/extensions/tlon/src/config-schema.ts
import { buildChannelConfigSchema } from "openclaw/plugin-sdk";
import { z } from "zod";
var ShipSchema = z.string().min(1);
var ChannelNestSchema = z.string().min(1);
var TlonChannelRuleSchema = z.object({
  mode: z.enum(["restricted", "open"]).optional(),
  allowedShips: z.array(ShipSchema).optional()
});
var TlonAuthorizationSchema = z.object({
  channelRules: z.record(z.string(), TlonChannelRuleSchema).optional()
});
var tlonCommonConfigFields = {
  name: z.string().optional(),
  enabled: z.boolean().optional(),
  ship: ShipSchema.optional(),
  url: z.string().optional(),
  code: z.string().optional(),
  allowPrivateNetwork: z.boolean().optional(),
  groupChannels: z.array(ChannelNestSchema).optional(),
  dmAllowlist: z.array(ShipSchema).optional(),
  autoDiscoverChannels: z.boolean().optional(),
  showModelSignature: z.boolean().optional(),
  responsePrefix: z.string().optional(),
  // Auto-accept settings
  autoAcceptDmInvites: z.boolean().optional(),
  // Auto-accept DMs from ships in dmAllowlist
  autoAcceptGroupInvites: z.boolean().optional(),
  // Auto-accept all group invites
  // Owner ship for approval system
  ownerShip: ShipSchema.optional()
  // Ship that receives approval requests and can approve/deny
};
var TlonAccountSchema = z.object({
  ...tlonCommonConfigFields
});
var TlonConfigSchema = z.object({
  ...tlonCommonConfigFields,
  authorization: TlonAuthorizationSchema.optional(),
  defaultAuthorizedShips: z.array(ShipSchema).optional(),
  accounts: z.record(z.string(), TlonAccountSchema).optional()
});
var tlonChannelConfigSchema = buildChannelConfigSchema(TlonConfigSchema);

// vendor/openclaw-runtime/win-x64/extensions/tlon/src/monitor/index.ts
import { createLoggerBackedRuntime } from "openclaw/plugin-sdk";

// vendor/openclaw-runtime/win-x64/extensions/tlon/src/runtime.ts
var runtime = null;
function setTlonRuntime(next) {
  runtime = next;
}
function getTlonRuntime() {
  if (!runtime) {
    throw new Error("Tlon runtime not initialized");
  }
  return runtime;
}

// vendor/openclaw-runtime/win-x64/extensions/tlon/src/settings.ts
var SETTINGS_DESK = "moltbot";
var SETTINGS_BUCKET = "tlon";
function parseChannelRules(value) {
  if (!value) {
    return void 0;
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (isChannelRulesObject(parsed)) {
        return parsed;
      }
    } catch {
      return void 0;
    }
  }
  if (isChannelRulesObject(value)) {
    return value;
  }
  return void 0;
}
function parseSettingsResponse(raw) {
  if (!raw || typeof raw !== "object") {
    return {};
  }
  const desk = raw;
  const bucket = desk[SETTINGS_BUCKET];
  if (!bucket || typeof bucket !== "object") {
    return {};
  }
  const settings = bucket;
  return {
    groupChannels: Array.isArray(settings.groupChannels) ? settings.groupChannels.filter((x) => typeof x === "string") : void 0,
    dmAllowlist: Array.isArray(settings.dmAllowlist) ? settings.dmAllowlist.filter((x) => typeof x === "string") : void 0,
    autoDiscover: typeof settings.autoDiscover === "boolean" ? settings.autoDiscover : void 0,
    showModelSig: typeof settings.showModelSig === "boolean" ? settings.showModelSig : void 0,
    autoAcceptDmInvites: typeof settings.autoAcceptDmInvites === "boolean" ? settings.autoAcceptDmInvites : void 0,
    autoAcceptGroupInvites: typeof settings.autoAcceptGroupInvites === "boolean" ? settings.autoAcceptGroupInvites : void 0,
    groupInviteAllowlist: Array.isArray(settings.groupInviteAllowlist) ? settings.groupInviteAllowlist.filter((x) => typeof x === "string") : void 0,
    channelRules: parseChannelRules(settings.channelRules),
    defaultAuthorizedShips: Array.isArray(settings.defaultAuthorizedShips) ? settings.defaultAuthorizedShips.filter((x) => typeof x === "string") : void 0,
    ownerShip: typeof settings.ownerShip === "string" ? settings.ownerShip : void 0,
    pendingApprovals: parsePendingApprovals(settings.pendingApprovals)
  };
}
function isChannelRulesObject(val) {
  if (!val || typeof val !== "object" || Array.isArray(val)) {
    return false;
  }
  for (const [, rule] of Object.entries(val)) {
    if (!rule || typeof rule !== "object") {
      return false;
    }
  }
  return true;
}
function parsePendingApprovals(value) {
  if (!value) {
    return void 0;
  }
  let parsed = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      return void 0;
    }
  }
  if (!Array.isArray(parsed)) {
    return void 0;
  }
  return parsed.filter((item) => {
    if (!item || typeof item !== "object") {
      return false;
    }
    const obj = item;
    return typeof obj.id === "string" && (obj.type === "dm" || obj.type === "channel" || obj.type === "group") && typeof obj.requestingShip === "string" && typeof obj.timestamp === "number";
  });
}
function parseSettingsEvent(event) {
  if (!event || typeof event !== "object") {
    return null;
  }
  const evt = event;
  if (evt["put-entry"]) {
    const put = evt["put-entry"];
    if (put.desk !== SETTINGS_DESK || put["bucket-key"] !== SETTINGS_BUCKET) {
      return null;
    }
    return {
      key: String(put["entry-key"] ?? ""),
      value: put.value
    };
  }
  if (evt["del-entry"]) {
    const del = evt["del-entry"];
    if (del.desk !== SETTINGS_DESK || del["bucket-key"] !== SETTINGS_BUCKET) {
      return null;
    }
    return {
      key: String(del["entry-key"] ?? ""),
      value: void 0
    };
  }
  return null;
}
function applySettingsUpdate(current, key, value) {
  const next = { ...current };
  switch (key) {
    case "groupChannels":
      next.groupChannels = Array.isArray(value) ? value.filter((x) => typeof x === "string") : void 0;
      break;
    case "dmAllowlist":
      next.dmAllowlist = Array.isArray(value) ? value.filter((x) => typeof x === "string") : void 0;
      break;
    case "autoDiscover":
      next.autoDiscover = typeof value === "boolean" ? value : void 0;
      break;
    case "showModelSig":
      next.showModelSig = typeof value === "boolean" ? value : void 0;
      break;
    case "autoAcceptDmInvites":
      next.autoAcceptDmInvites = typeof value === "boolean" ? value : void 0;
      break;
    case "autoAcceptGroupInvites":
      next.autoAcceptGroupInvites = typeof value === "boolean" ? value : void 0;
      break;
    case "groupInviteAllowlist":
      next.groupInviteAllowlist = Array.isArray(value) ? value.filter((x) => typeof x === "string") : void 0;
      break;
    case "channelRules":
      next.channelRules = parseChannelRules(value);
      break;
    case "defaultAuthorizedShips":
      next.defaultAuthorizedShips = Array.isArray(value) ? value.filter((x) => typeof x === "string") : void 0;
      break;
    case "ownerShip":
      next.ownerShip = typeof value === "string" ? value : void 0;
      break;
    case "pendingApprovals":
      next.pendingApprovals = parsePendingApprovals(value);
      break;
  }
  return next;
}
function createSettingsManager(api, logger) {
  let state = {
    current: {},
    loaded: false
  };
  const listeners = /* @__PURE__ */ new Set();
  const notify = () => {
    for (const listener of listeners) {
      try {
        listener(state.current);
      } catch (err) {
        logger?.error?.(`[settings] Listener error: ${String(err)}`);
      }
    }
  };
  return {
    /**
     * Get current settings (may be empty if not loaded yet).
     */
    get current() {
      return state.current;
    },
    /**
     * Whether initial settings have been loaded.
     */
    get loaded() {
      return state.loaded;
    },
    /**
     * Load initial settings via scry.
     */
    async load() {
      try {
        const raw = await api.scry("/settings/all.json");
        const allData = raw;
        const deskData = allData?.all?.[SETTINGS_DESK];
        state.current = parseSettingsResponse(deskData ?? {});
        state.loaded = true;
        logger?.log?.(`[settings] Loaded: ${JSON.stringify(state.current)}`);
        return state.current;
      } catch (err) {
        logger?.log?.(`[settings] No settings found (using defaults): ${String(err)}`);
        state.current = {};
        state.loaded = true;
        return state.current;
      }
    },
    /**
     * Subscribe to settings changes.
     */
    async startSubscription() {
      await api.subscribe({
        app: "settings",
        path: "/desk/" + SETTINGS_DESK,
        event: (event) => {
          const update = parseSettingsEvent(event);
          if (!update) {
            return;
          }
          logger?.log?.(`[settings] Update: ${update.key} = ${JSON.stringify(update.value)}`);
          state.current = applySettingsUpdate(state.current, update.key, update.value);
          notify();
        },
        err: (error) => {
          logger?.error?.(`[settings] Subscription error: ${String(error)}`);
        },
        quit: () => {
          logger?.log?.("[settings] Subscription ended");
        }
      });
      logger?.log?.("[settings] Subscribed to settings updates");
    },
    /**
     * Register a listener for settings changes.
     */
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
}

// vendor/openclaw-runtime/win-x64/extensions/tlon/src/targets.ts
var SHIP_RE = /^~?[a-z-]+$/i;
var NEST_RE = /^chat\/([^/]+)\/([^/]+)$/i;
function normalizeShip(raw) {
  const trimmed = raw.trim();
  if (!trimmed) {
    return trimmed;
  }
  return trimmed.startsWith("~") ? trimmed : `~${trimmed}`;
}
function parseChannelNest(raw) {
  const match = NEST_RE.exec(raw.trim());
  if (!match) {
    return null;
  }
  const hostShip = normalizeShip(match[1]);
  const channelName = match[2];
  return { hostShip, channelName };
}
function parseTlonTarget(raw) {
  const trimmed = raw?.trim();
  if (!trimmed) {
    return null;
  }
  const withoutPrefix = trimmed.replace(/^tlon:/i, "");
  const dmPrefix = withoutPrefix.match(/^dm[/:](.+)$/i);
  if (dmPrefix) {
    return { kind: "dm", ship: normalizeShip(dmPrefix[1]) };
  }
  const groupPrefix = withoutPrefix.match(/^(group|room)[/:](.+)$/i);
  if (groupPrefix) {
    const groupTarget = groupPrefix[2].trim();
    if (groupTarget.startsWith("chat/")) {
      const parsed = parseChannelNest(groupTarget);
      if (!parsed) {
        return null;
      }
      return {
        kind: "group",
        nest: `chat/${parsed.hostShip}/${parsed.channelName}`,
        hostShip: parsed.hostShip,
        channelName: parsed.channelName
      };
    }
    const parts = groupTarget.split("/");
    if (parts.length === 2) {
      const hostShip = normalizeShip(parts[0]);
      const channelName = parts[1];
      return {
        kind: "group",
        nest: `chat/${hostShip}/${channelName}`,
        hostShip,
        channelName
      };
    }
    return null;
  }
  if (withoutPrefix.startsWith("chat/")) {
    const parsed = parseChannelNest(withoutPrefix);
    if (!parsed) {
      return null;
    }
    return {
      kind: "group",
      nest: `chat/${parsed.hostShip}/${parsed.channelName}`,
      hostShip: parsed.hostShip,
      channelName: parsed.channelName
    };
  }
  if (SHIP_RE.test(withoutPrefix)) {
    return { kind: "dm", ship: normalizeShip(withoutPrefix) };
  }
  return null;
}
function formatTargetHint() {
  return "dm/~sampel-palnet | ~sampel-palnet | chat/~host-ship/channel | group:~host-ship/channel";
}

// vendor/openclaw-runtime/win-x64/extensions/tlon/src/types.ts
function resolveTlonAccount(cfg, accountId) {
  const base = cfg.channels?.tlon;
  if (!base) {
    return {
      accountId: accountId || "default",
      name: null,
      enabled: false,
      configured: false,
      ship: null,
      url: null,
      code: null,
      allowPrivateNetwork: null,
      groupChannels: [],
      dmAllowlist: [],
      groupInviteAllowlist: [],
      autoDiscoverChannels: null,
      showModelSignature: null,
      autoAcceptDmInvites: null,
      autoAcceptGroupInvites: null,
      defaultAuthorizedShips: [],
      ownerShip: null
    };
  }
  const useDefault = !accountId || accountId === "default";
  const account = useDefault ? base : base.accounts?.[accountId];
  const ship = account?.ship ?? base.ship ?? null;
  const url = account?.url ?? base.url ?? null;
  const code = account?.code ?? base.code ?? null;
  const allowPrivateNetwork = account?.allowPrivateNetwork ?? base.allowPrivateNetwork ?? null;
  const groupChannels = account?.groupChannels ?? base.groupChannels ?? [];
  const dmAllowlist = account?.dmAllowlist ?? base.dmAllowlist ?? [];
  const groupInviteAllowlist = account?.groupInviteAllowlist ?? base.groupInviteAllowlist ?? [];
  const autoDiscoverChannels = account?.autoDiscoverChannels ?? base.autoDiscoverChannels ?? null;
  const showModelSignature = account?.showModelSignature ?? base.showModelSignature ?? null;
  const autoAcceptDmInvites = account?.autoAcceptDmInvites ?? base.autoAcceptDmInvites ?? null;
  const autoAcceptGroupInvites = account?.autoAcceptGroupInvites ?? base.autoAcceptGroupInvites ?? null;
  const ownerShip = account?.ownerShip ?? base.ownerShip ?? null;
  const defaultAuthorizedShips = account?.defaultAuthorizedShips ?? base?.defaultAuthorizedShips ?? [];
  const configured = Boolean(ship && url && code);
  return {
    accountId: accountId || "default",
    name: account?.name ?? base.name ?? null,
    enabled: (account?.enabled ?? base.enabled ?? true) !== false,
    configured,
    ship,
    url,
    code,
    allowPrivateNetwork,
    groupChannels,
    dmAllowlist,
    groupInviteAllowlist,
    autoDiscoverChannels,
    showModelSignature,
    autoAcceptDmInvites,
    autoAcceptGroupInvites,
    defaultAuthorizedShips,
    ownerShip
  };
}
function listTlonAccountIds(cfg) {
  const base = cfg.channels?.tlon;
  if (!base) {
    return [];
  }
  const accounts = base.accounts ?? {};
  return [...base.ship ? ["default"] : [], ...Object.keys(accounts)];
}

// vendor/openclaw-runtime/win-x64/extensions/tlon/src/urbit/errors.ts
var UrbitError = class extends Error {
  code;
  constructor(code, message, options) {
    super(message, options);
    this.name = "UrbitError";
    this.code = code;
  }
};
var UrbitUrlError = class extends UrbitError {
  constructor(message, options) {
    super("invalid_url", message, options);
    this.name = "UrbitUrlError";
  }
};
var UrbitHttpError = class extends UrbitError {
  status;
  operation;
  bodyText;
  constructor(params) {
    const suffix = params.bodyText ? ` - ${params.bodyText}` : "";
    super("http_error", `${params.operation} failed: ${params.status}${suffix}`, {
      cause: params.cause
    });
    this.name = "UrbitHttpError";
    this.status = params.status;
    this.operation = params.operation;
    this.bodyText = params.bodyText;
  }
};
var UrbitAuthError = class extends UrbitError {
  constructor(code, message, options) {
    super(code, message, options);
    this.name = "UrbitAuthError";
  }
};

// vendor/openclaw-runtime/win-x64/extensions/tlon/src/urbit/fetch.ts
import { fetchWithSsrFGuard } from "openclaw/plugin-sdk";

// vendor/openclaw-runtime/win-x64/extensions/tlon/src/urbit/base-url.ts
import { isBlockedHostnameOrIp } from "openclaw/plugin-sdk";
function hasScheme(value) {
  return /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(value);
}
function validateUrbitBaseUrl(raw) {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) {
    return { ok: false, error: "Required" };
  }
  const candidate = hasScheme(trimmed) ? trimmed : `https://${trimmed}`;
  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    return { ok: false, error: "Invalid URL" };
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    return { ok: false, error: "URL must use http:// or https://" };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, error: "URL must not include credentials" };
  }
  const hostname = parsed.hostname.trim().toLowerCase().replace(/\.$/, "");
  if (!hostname) {
    return { ok: false, error: "Invalid hostname" };
  }
  const isIpv6 = hostname.includes(":");
  const host = parsed.port ? `${isIpv6 ? `[${hostname}]` : hostname}:${parsed.port}` : isIpv6 ? `[${hostname}]` : hostname;
  return { ok: true, baseUrl: `${parsed.protocol}//${host}`, hostname };
}
function isBlockedUrbitHostname(hostname) {
  const normalized = hostname.trim().toLowerCase().replace(/\.$/, "");
  if (!normalized) {
    return false;
  }
  return isBlockedHostnameOrIp(normalized);
}

// vendor/openclaw-runtime/win-x64/extensions/tlon/src/urbit/fetch.ts
async function urbitFetch(params) {
  const validated = validateUrbitBaseUrl(params.baseUrl);
  if (!validated.ok) {
    throw new UrbitUrlError(validated.error);
  }
  const url = new URL(params.path, validated.baseUrl).toString();
  return await fetchWithSsrFGuard({
    url,
    fetchImpl: params.fetchImpl,
    init: params.init,
    timeoutMs: params.timeoutMs,
    maxRedirects: params.maxRedirects,
    signal: params.signal,
    policy: params.ssrfPolicy,
    lookupFn: params.lookupFn,
    auditContext: params.auditContext,
    pinDns: params.pinDns
  });
}

// vendor/openclaw-runtime/win-x64/extensions/tlon/src/urbit/auth.ts
async function authenticate(url, code, options = {}) {
  const { response, release } = await urbitFetch({
    baseUrl: url,
    path: "/~/login",
    init: {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ password: code }).toString()
    },
    ssrfPolicy: options.ssrfPolicy,
    lookupFn: options.lookupFn,
    fetchImpl: options.fetchImpl,
    timeoutMs: options.timeoutMs ?? 15e3,
    maxRedirects: 3,
    auditContext: "tlon-urbit-login"
  });
  try {
    if (!response.ok) {
      throw new UrbitAuthError("auth_failed", `Login failed with status ${response.status}`);
    }
    await response.text().catch(() => {
    });
    const cookie = response.headers.get("set-cookie");
    if (!cookie) {
      throw new UrbitAuthError("missing_cookie", "No authentication cookie received");
    }
    return cookie;
  } finally {
    await release();
  }
}

// vendor/openclaw-runtime/win-x64/extensions/tlon/src/urbit/context.ts
function resolveShipFromHostname(hostname) {
  const trimmed = hostname.trim().toLowerCase().replace(/\.$/, "");
  if (!trimmed) {
    return "";
  }
  if (trimmed.includes(".")) {
    return trimmed.split(".")[0] ?? trimmed;
  }
  return trimmed;
}
function normalizeUrbitShip(ship, hostname) {
  const raw = ship?.replace(/^~/, "") ?? resolveShipFromHostname(hostname);
  return raw.trim();
}
function normalizeUrbitCookie(cookie) {
  return cookie.split(";")[0] ?? cookie;
}
function getUrbitContext(url, ship) {
  const validated = validateUrbitBaseUrl(url);
  if (!validated.ok) {
    throw new UrbitUrlError(validated.error);
  }
  return {
    baseUrl: validated.baseUrl,
    hostname: validated.hostname,
    ship: normalizeUrbitShip(ship, validated.hostname)
  };
}
function ssrfPolicyFromAllowPrivateNetwork(allowPrivateNetwork) {
  return allowPrivateNetwork ? { allowPrivateNetwork: true } : void 0;
}
function getDefaultSsrFPolicy() {
  return void 0;
}

// vendor/openclaw-runtime/win-x64/extensions/tlon/src/urbit/send.ts
import { scot, da } from "@urbit/aura";

// vendor/openclaw-runtime/win-x64/extensions/tlon/src/urbit/story.ts
function parseInlineMarkdown(text) {
  const result = [];
  let remaining = text;
  while (remaining.length > 0) {
    const shipMatch = remaining.match(/^(~[a-z][-a-z0-9]*)/);
    if (shipMatch) {
      result.push({ ship: shipMatch[1] });
      remaining = remaining.slice(shipMatch[0].length);
      continue;
    }
    const boldMatch = remaining.match(/^\*\*(.+?)\*\*|^__(.+?)__/);
    if (boldMatch) {
      const content = boldMatch[1] || boldMatch[2];
      result.push({ bold: parseInlineMarkdown(content) });
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }
    const italicsMatch = remaining.match(/^\*([^*]+?)\*|^_([^_]+?)_(?![a-zA-Z0-9])/);
    if (italicsMatch) {
      const content = italicsMatch[1] || italicsMatch[2];
      result.push({ italics: parseInlineMarkdown(content) });
      remaining = remaining.slice(italicsMatch[0].length);
      continue;
    }
    const strikeMatch = remaining.match(/^~~(.+?)~~/);
    if (strikeMatch) {
      result.push({ strike: parseInlineMarkdown(strikeMatch[1]) });
      remaining = remaining.slice(strikeMatch[0].length);
      continue;
    }
    const codeMatch = remaining.match(/^`([^`]+)`/);
    if (codeMatch) {
      result.push({ "inline-code": codeMatch[1] });
      remaining = remaining.slice(codeMatch[0].length);
      continue;
    }
    const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch) {
      result.push({ link: { href: linkMatch[2], content: linkMatch[1] } });
      remaining = remaining.slice(linkMatch[0].length);
      continue;
    }
    const imageMatch = remaining.match(/^!\[([^\]]*)\]\(([^)]+)\)/);
    if (imageMatch) {
      result.push({
        __image: { src: imageMatch[2], alt: imageMatch[1] }
      });
      remaining = remaining.slice(imageMatch[0].length);
      continue;
    }
    const urlMatch = remaining.match(/^(https?:\/\/[^\s<>"\]]+)/);
    if (urlMatch) {
      result.push({ link: { href: urlMatch[1], content: urlMatch[1] } });
      remaining = remaining.slice(urlMatch[0].length);
      continue;
    }
    const plainMatch = remaining.match(/^[^*_`~[#~\n:/]+/);
    if (plainMatch) {
      result.push(plainMatch[0]);
      remaining = remaining.slice(plainMatch[0].length);
      continue;
    }
    result.push(remaining[0]);
    remaining = remaining.slice(1);
  }
  return mergeAdjacentStrings(result);
}
function mergeAdjacentStrings(inlines) {
  const result = [];
  for (const item of inlines) {
    if (typeof item === "string" && typeof result[result.length - 1] === "string") {
      result[result.length - 1] = result[result.length - 1] + item;
    } else {
      result.push(item);
    }
  }
  return result;
}
function createImageBlock(src, alt = "", height = 0, width = 0) {
  return {
    block: {
      image: { src, height, width, alt }
    }
  };
}
function isImageUrl(url) {
  const imageExtensions = /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)(\?.*)?$/i;
  return imageExtensions.test(url);
}
function processInlinesForImages(inlines) {
  const cleanInlines = [];
  const imageBlocks = [];
  for (const inline of inlines) {
    if (typeof inline === "object" && "__image" in inline) {
      const img = inline.__image;
      imageBlocks.push(createImageBlock(img.src, img.alt));
    } else {
      cleanInlines.push(inline);
    }
  }
  return { inlines: cleanInlines, imageBlocks };
}
function markdownToStory(markdown) {
  const story = [];
  const lines = markdown.split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim() || "plaintext";
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      story.push({
        block: {
          code: {
            code: codeLines.join("\n"),
            lang
          }
        }
      });
      i++;
      continue;
    }
    const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headerMatch) {
      const level = headerMatch[1].length;
      const tag = `h${level}`;
      story.push({
        block: {
          header: {
            tag,
            content: parseInlineMarkdown(headerMatch[2])
          }
        }
      });
      i++;
      continue;
    }
    if (/^(-{3,}|\*{3,})$/.test(line.trim())) {
      story.push({ block: { rule: null } });
      i++;
      continue;
    }
    if (line.startsWith("> ")) {
      const quoteLines = [];
      while (i < lines.length && lines[i].startsWith("> ")) {
        quoteLines.push(lines[i].slice(2));
        i++;
      }
      const quoteText = quoteLines.join("\n");
      story.push({
        inline: [{ blockquote: parseInlineMarkdown(quoteText) }]
      });
      continue;
    }
    if (line.trim() === "") {
      i++;
      continue;
    }
    const paragraphLines = [];
    while (i < lines.length && lines[i].trim() !== "" && !lines[i].startsWith("#") && !lines[i].startsWith("```") && !lines[i].startsWith("> ") && !/^(-{3,}|\*{3,})$/.test(lines[i].trim())) {
      paragraphLines.push(lines[i]);
      i++;
    }
    if (paragraphLines.length > 0) {
      const paragraphText = paragraphLines.join("\n");
      const inlines = parseInlineMarkdown(paragraphText);
      const withBreaks = [];
      for (const inline of inlines) {
        if (typeof inline === "string" && inline.includes("\n")) {
          const parts = inline.split("\n");
          for (let j = 0; j < parts.length; j++) {
            if (parts[j]) {
              withBreaks.push(parts[j]);
            }
            if (j < parts.length - 1) {
              withBreaks.push({ break: null });
            }
          }
        } else {
          withBreaks.push(inline);
        }
      }
      const { inlines: cleanInlines, imageBlocks } = processInlinesForImages(withBreaks);
      if (cleanInlines.length > 0) {
        story.push({ inline: cleanInlines });
      }
      story.push(...imageBlocks);
    }
  }
  return story;
}

// vendor/openclaw-runtime/win-x64/extensions/tlon/src/urbit/send.ts
async function sendDm({ api, fromShip, toShip, text }) {
  const story = markdownToStory(text);
  return sendDmWithStory({ api, fromShip, toShip, story });
}
async function sendDmWithStory({ api, fromShip, toShip, story }) {
  const sentAt = Date.now();
  const idUd = scot("ud", da.fromUnix(sentAt));
  const id = `${fromShip}/${idUd}`;
  const delta = {
    add: {
      memo: {
        content: story,
        author: fromShip,
        sent: sentAt
      },
      kind: null,
      time: null
    }
  };
  const action = {
    ship: toShip,
    diff: { id, delta }
  };
  await api.poke({
    app: "chat",
    mark: "chat-dm-action",
    json: action
  });
  return { channel: "tlon", messageId: id };
}
async function sendGroupMessage({
  api,
  fromShip,
  hostShip,
  channelName,
  text,
  replyToId
}) {
  const story = markdownToStory(text);
  return sendGroupMessageWithStory({ api, fromShip, hostShip, channelName, story, replyToId });
}
async function sendGroupMessageWithStory({
  api,
  fromShip,
  hostShip,
  channelName,
  story,
  replyToId
}) {
  const sentAt = Date.now();
  let formattedReplyId = replyToId;
  if (replyToId && /^\d+$/.test(replyToId)) {
    try {
      formattedReplyId = scot("ud", BigInt(replyToId));
    } catch {
    }
  }
  const action = {
    channel: {
      nest: `chat/${hostShip}/${channelName}`,
      action: formattedReplyId ? {
        // Thread reply - needs post wrapper around reply action
        // ReplyActionAdd takes Memo: {content, author, sent} - no kind/blob/meta
        post: {
          reply: {
            id: formattedReplyId,
            action: {
              add: {
                content: story,
                author: fromShip,
                sent: sentAt
              }
            }
          }
        }
      } : {
        // Regular post
        post: {
          add: {
            content: story,
            author: fromShip,
            sent: sentAt,
            kind: "/chat",
            blob: null,
            meta: null
          }
        }
      }
    }
  };
  await api.poke({
    app: "channels",
    mark: "channel-action-1",
    json: action
  });
  return { channel: "tlon", messageId: `${fromShip}/${sentAt}` };
}
function buildMediaStory(text, mediaUrl) {
  const story = [];
  const cleanText = text?.trim() ?? "";
  const cleanUrl = mediaUrl?.trim() ?? "";
  if (cleanText) {
    story.push(...markdownToStory(cleanText));
  }
  if (cleanUrl && isImageUrl(cleanUrl)) {
    story.push(createImageBlock(cleanUrl, ""));
  } else if (cleanUrl) {
    story.push({ inline: [{ link: { href: cleanUrl, content: cleanUrl } }] });
  }
  return story.length > 0 ? story : [{ inline: [""] }];
}

// vendor/openclaw-runtime/win-x64/extensions/tlon/src/urbit/sse-client.ts
import { randomUUID } from "crypto";
import { Readable } from "stream";

// vendor/openclaw-runtime/win-x64/extensions/tlon/src/urbit/channel-ops.ts
async function pokeUrbitChannel(deps, params) {
  const pokeId = Date.now();
  const pokeData = {
    id: pokeId,
    action: "poke",
    ship: deps.ship,
    app: params.app,
    mark: params.mark,
    json: params.json
  };
  const { response, release } = await urbitFetch({
    baseUrl: deps.baseUrl,
    path: `/~/channel/${deps.channelId}`,
    init: {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Cookie: deps.cookie
      },
      body: JSON.stringify([pokeData])
    },
    ssrfPolicy: deps.ssrfPolicy,
    lookupFn: deps.lookupFn,
    fetchImpl: deps.fetchImpl,
    timeoutMs: 3e4,
    auditContext: params.auditContext
  });
  try {
    if (!response.ok && response.status !== 204) {
      const errorText = await response.text().catch(() => "");
      throw new Error(`Poke failed: ${response.status}${errorText ? ` - ${errorText}` : ""}`);
    }
    return pokeId;
  } finally {
    await release();
  }
}
async function scryUrbitPath(deps, params) {
  const scryPath = `/~/scry${params.path}`;
  const { response, release } = await urbitFetch({
    baseUrl: deps.baseUrl,
    path: scryPath,
    init: {
      method: "GET",
      headers: { Cookie: deps.cookie }
    },
    ssrfPolicy: deps.ssrfPolicy,
    lookupFn: deps.lookupFn,
    fetchImpl: deps.fetchImpl,
    timeoutMs: 3e4,
    auditContext: params.auditContext
  });
  try {
    if (!response.ok) {
      throw new Error(`Scry failed: ${response.status} for path ${params.path}`);
    }
    return await response.json();
  } finally {
    await release();
  }
}
async function createUrbitChannel(deps, params) {
  const { response, release } = await urbitFetch({
    baseUrl: deps.baseUrl,
    path: `/~/channel/${deps.channelId}`,
    init: {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Cookie: deps.cookie
      },
      body: JSON.stringify(params.body)
    },
    ssrfPolicy: deps.ssrfPolicy,
    lookupFn: deps.lookupFn,
    fetchImpl: deps.fetchImpl,
    timeoutMs: 3e4,
    auditContext: params.auditContext
  });
  try {
    if (!response.ok && response.status !== 204) {
      throw new UrbitHttpError({ operation: "Channel creation", status: response.status });
    }
  } finally {
    await release();
  }
}
async function wakeUrbitChannel(deps) {
  const { response, release } = await urbitFetch({
    baseUrl: deps.baseUrl,
    path: `/~/channel/${deps.channelId}`,
    init: {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Cookie: deps.cookie
      },
      body: JSON.stringify([
        {
          id: Date.now(),
          action: "poke",
          ship: deps.ship,
          app: "hood",
          mark: "helm-hi",
          json: "Opening API channel"
        }
      ])
    },
    ssrfPolicy: deps.ssrfPolicy,
    lookupFn: deps.lookupFn,
    fetchImpl: deps.fetchImpl,
    timeoutMs: 3e4,
    auditContext: "tlon-urbit-channel-wake"
  });
  try {
    if (!response.ok && response.status !== 204) {
      throw new UrbitHttpError({ operation: "Channel activation", status: response.status });
    }
  } finally {
    await release();
  }
}
async function ensureUrbitChannelOpen(deps, params) {
  await createUrbitChannel(deps, {
    body: params.createBody,
    auditContext: params.createAuditContext
  });
  await wakeUrbitChannel(deps);
}

// vendor/openclaw-runtime/win-x64/extensions/tlon/src/urbit/sse-client.ts
var UrbitSSEClient = class {
  url;
  cookie;
  ship;
  channelId;
  channelUrl;
  subscriptions = [];
  eventHandlers = /* @__PURE__ */ new Map();
  aborted = false;
  streamController = null;
  onReconnect;
  autoReconnect;
  reconnectAttempts = 0;
  maxReconnectAttempts;
  reconnectDelay;
  maxReconnectDelay;
  isConnected = false;
  logger;
  ssrfPolicy;
  lookupFn;
  fetchImpl;
  streamRelease = null;
  // Event ack tracking - must ack every ~50 events to keep channel healthy
  lastHeardEventId = -1;
  lastAcknowledgedEventId = -1;
  ackThreshold = 20;
  constructor(url, cookie, options = {}) {
    const ctx = getUrbitContext(url, options.ship);
    this.url = ctx.baseUrl;
    this.cookie = normalizeUrbitCookie(cookie);
    this.ship = ctx.ship;
    this.channelId = `${Math.floor(Date.now() / 1e3)}-${randomUUID()}`;
    this.channelUrl = new URL(`/~/channel/${this.channelId}`, this.url).toString();
    this.onReconnect = options.onReconnect ?? null;
    this.autoReconnect = options.autoReconnect !== false;
    this.maxReconnectAttempts = options.maxReconnectAttempts ?? 10;
    this.reconnectDelay = options.reconnectDelay ?? 1e3;
    this.maxReconnectDelay = options.maxReconnectDelay ?? 3e4;
    this.logger = options.logger ?? {};
    this.ssrfPolicy = options.ssrfPolicy;
    this.lookupFn = options.lookupFn;
    this.fetchImpl = options.fetchImpl;
  }
  async subscribe(params) {
    const subId = this.subscriptions.length + 1;
    const subscription = {
      id: subId,
      action: "subscribe",
      ship: this.ship,
      app: params.app,
      path: params.path
    };
    this.subscriptions.push(subscription);
    this.eventHandlers.set(subId, { event: params.event, err: params.err, quit: params.quit });
    if (this.isConnected) {
      try {
        await this.sendSubscription(subscription);
      } catch (error) {
        const handler = this.eventHandlers.get(subId);
        handler?.err?.(error);
      }
    }
    return subId;
  }
  async sendSubscription(subscription) {
    const { response, release } = await urbitFetch({
      baseUrl: this.url,
      path: `/~/channel/${this.channelId}`,
      init: {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Cookie: this.cookie
        },
        body: JSON.stringify([subscription])
      },
      ssrfPolicy: this.ssrfPolicy,
      lookupFn: this.lookupFn,
      fetchImpl: this.fetchImpl,
      timeoutMs: 3e4,
      auditContext: "tlon-urbit-subscribe"
    });
    try {
      if (!response.ok && response.status !== 204) {
        const errorText = await response.text().catch(() => "");
        throw new Error(
          `Subscribe failed: ${response.status}${errorText ? ` - ${errorText}` : ""}`
        );
      }
    } finally {
      await release();
    }
  }
  async connect() {
    await ensureUrbitChannelOpen(
      {
        baseUrl: this.url,
        cookie: this.cookie,
        ship: this.ship,
        channelId: this.channelId,
        ssrfPolicy: this.ssrfPolicy,
        lookupFn: this.lookupFn,
        fetchImpl: this.fetchImpl
      },
      {
        createBody: this.subscriptions,
        createAuditContext: "tlon-urbit-channel-create"
      }
    );
    await this.openStream();
    this.isConnected = true;
    this.reconnectAttempts = 0;
  }
  async openStream() {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6e4);
    this.streamController = controller;
    const { response, release } = await urbitFetch({
      baseUrl: this.url,
      path: `/~/channel/${this.channelId}`,
      init: {
        method: "GET",
        headers: {
          Accept: "text/event-stream",
          Cookie: this.cookie
        }
      },
      ssrfPolicy: this.ssrfPolicy,
      lookupFn: this.lookupFn,
      fetchImpl: this.fetchImpl,
      signal: controller.signal,
      auditContext: "tlon-urbit-sse-stream"
    });
    this.streamRelease = release;
    clearTimeout(timeoutId);
    if (!response.ok) {
      await release();
      this.streamRelease = null;
      throw new Error(`Stream connection failed: ${response.status}`);
    }
    this.processStream(response.body).catch((error) => {
      if (!this.aborted) {
        this.logger.error?.(`Stream error: ${String(error)}`);
        for (const { err } of this.eventHandlers.values()) {
          if (err) {
            err(error);
          }
        }
      }
    });
  }
  async processStream(body) {
    if (!body) {
      return;
    }
    const stream = body instanceof ReadableStream ? Readable.fromWeb(body) : body;
    let buffer = "";
    try {
      for await (const chunk of stream) {
        if (this.aborted) {
          break;
        }
        buffer += chunk.toString();
        let eventEnd;
        while ((eventEnd = buffer.indexOf("\n\n")) !== -1) {
          const eventData = buffer.substring(0, eventEnd);
          buffer = buffer.substring(eventEnd + 2);
          this.processEvent(eventData);
        }
      }
    } finally {
      if (this.streamRelease) {
        const release = this.streamRelease;
        this.streamRelease = null;
        await release();
      }
      this.streamController = null;
      if (!this.aborted && this.autoReconnect) {
        this.isConnected = false;
        this.logger.log?.("[SSE] Stream ended, attempting reconnection...");
        await this.attemptReconnect();
      }
    }
  }
  processEvent(eventData) {
    const lines = eventData.split("\n");
    let data = null;
    let eventId = null;
    for (const line of lines) {
      if (line.startsWith("id: ")) {
        eventId = parseInt(line.substring(4), 10);
      }
      if (line.startsWith("data: ")) {
        data = line.substring(6);
      }
    }
    if (!data) {
      return;
    }
    if (eventId !== null && !isNaN(eventId)) {
      if (eventId > this.lastHeardEventId) {
        this.lastHeardEventId = eventId;
        if (eventId - this.lastAcknowledgedEventId > this.ackThreshold) {
          this.logger.log?.(
            `[SSE] Acking event ${eventId} (last acked: ${this.lastAcknowledgedEventId})`
          );
          this.ack(eventId).catch((err) => {
            this.logger.error?.(`Failed to ack event ${eventId}: ${String(err)}`);
          });
        }
      }
    }
    try {
      const parsed = JSON.parse(data);
      if (parsed.response === "quit") {
        if (parsed.id) {
          const handlers = this.eventHandlers.get(parsed.id);
          if (handlers?.quit) {
            handlers.quit();
          }
        }
        return;
      }
      if (parsed.id && this.eventHandlers.has(parsed.id)) {
        const { event } = this.eventHandlers.get(parsed.id) ?? {};
        if (event && parsed.json) {
          event(parsed.json);
        }
      } else if (parsed.json) {
        for (const { event } of this.eventHandlers.values()) {
          if (event) {
            event(parsed.json);
          }
        }
      }
    } catch (error) {
      this.logger.error?.(`Error parsing SSE event: ${String(error)}`);
    }
  }
  async poke(params) {
    return await pokeUrbitChannel(
      {
        baseUrl: this.url,
        cookie: this.cookie,
        ship: this.ship,
        channelId: this.channelId,
        ssrfPolicy: this.ssrfPolicy,
        lookupFn: this.lookupFn,
        fetchImpl: this.fetchImpl
      },
      { ...params, auditContext: "tlon-urbit-poke" }
    );
  }
  async scry(path2) {
    return await scryUrbitPath(
      {
        baseUrl: this.url,
        cookie: this.cookie,
        ssrfPolicy: this.ssrfPolicy,
        lookupFn: this.lookupFn,
        fetchImpl: this.fetchImpl
      },
      { path: path2, auditContext: "tlon-urbit-scry" }
    );
  }
  /**
   * Update the cookie used for authentication.
   * Call this when re-authenticating after session expiry.
   */
  updateCookie(newCookie) {
    this.cookie = normalizeUrbitCookie(newCookie);
  }
  async ack(eventId) {
    this.lastAcknowledgedEventId = eventId;
    const ackData = {
      id: Date.now(),
      action: "ack",
      "event-id": eventId
    };
    const { response, release } = await urbitFetch({
      baseUrl: this.url,
      path: `/~/channel/${this.channelId}`,
      init: {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Cookie: this.cookie
        },
        body: JSON.stringify([ackData])
      },
      ssrfPolicy: this.ssrfPolicy,
      lookupFn: this.lookupFn,
      fetchImpl: this.fetchImpl,
      timeoutMs: 1e4,
      auditContext: "tlon-urbit-ack"
    });
    try {
      if (!response.ok) {
        throw new Error(`Ack failed with status ${response.status}`);
      }
    } finally {
      await release();
    }
  }
  async attemptReconnect() {
    if (this.aborted || !this.autoReconnect) {
      this.logger.log?.("[SSE] Reconnection aborted or disabled");
      return;
    }
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.logger.log?.(
        `[SSE] Max reconnection attempts (${this.maxReconnectAttempts}) reached. Waiting 10s before resetting...`
      );
      const extendedBackoff = 1e4;
      await new Promise((resolve) => setTimeout(resolve, extendedBackoff));
      this.reconnectAttempts = 0;
      this.logger.log?.("[SSE] Reconnection attempts reset, resuming reconnection...");
    }
    this.reconnectAttempts += 1;
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      this.maxReconnectDelay
    );
    this.logger.log?.(
      `[SSE] Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms...`
    );
    await new Promise((resolve) => setTimeout(resolve, delay));
    try {
      this.channelId = `${Math.floor(Date.now() / 1e3)}-${randomUUID()}`;
      this.channelUrl = new URL(`/~/channel/${this.channelId}`, this.url).toString();
      if (this.onReconnect) {
        await this.onReconnect(this);
      }
      await this.connect();
      this.logger.log?.("[SSE] Reconnection successful!");
    } catch (error) {
      this.logger.error?.(`[SSE] Reconnection failed: ${String(error)}`);
      await this.attemptReconnect();
    }
  }
  async close() {
    this.aborted = true;
    this.isConnected = false;
    this.streamController?.abort();
    try {
      const unsubscribes = this.subscriptions.map((sub) => ({
        id: sub.id,
        action: "unsubscribe",
        subscription: sub.id
      }));
      {
        const { response, release } = await urbitFetch({
          baseUrl: this.url,
          path: `/~/channel/${this.channelId}`,
          init: {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Cookie: this.cookie
            },
            body: JSON.stringify(unsubscribes)
          },
          ssrfPolicy: this.ssrfPolicy,
          lookupFn: this.lookupFn,
          fetchImpl: this.fetchImpl,
          timeoutMs: 3e4,
          auditContext: "tlon-urbit-unsubscribe"
        });
        try {
          void response.body?.cancel();
        } finally {
          await release();
        }
      }
      {
        const { response, release } = await urbitFetch({
          baseUrl: this.url,
          path: `/~/channel/${this.channelId}`,
          init: {
            method: "DELETE",
            headers: {
              Cookie: this.cookie
            }
          },
          ssrfPolicy: this.ssrfPolicy,
          lookupFn: this.lookupFn,
          fetchImpl: this.fetchImpl,
          timeoutMs: 3e4,
          auditContext: "tlon-urbit-channel-close"
        });
        try {
          void response.body?.cancel();
        } finally {
          await release();
        }
      }
    } catch (error) {
      this.logger.error?.(`Error closing channel: ${String(error)}`);
    }
    if (this.streamRelease) {
      const release = this.streamRelease;
      this.streamRelease = null;
      await release();
    }
  }
};

// vendor/openclaw-runtime/win-x64/extensions/tlon/src/monitor/approval.ts
function generateApprovalId(type) {
  const timestamp = Date.now();
  const randomPart = Math.random().toString(36).substring(2, 6);
  return `${type}-${timestamp}-${randomPart}`;
}
function createPendingApproval(params) {
  return {
    id: generateApprovalId(params.type),
    type: params.type,
    requestingShip: params.requestingShip,
    channelNest: params.channelNest,
    groupFlag: params.groupFlag,
    messagePreview: params.messagePreview,
    originalMessage: params.originalMessage,
    timestamp: Date.now()
  };
}
function truncate(text, maxLength) {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength - 3) + "...";
}
function formatApprovalRequest(approval) {
  const preview = approval.messagePreview ? `
"${truncate(approval.messagePreview, 100)}"` : "";
  switch (approval.type) {
    case "dm":
      return `New DM request from ${approval.requestingShip}:${preview}

Reply "approve", "deny", or "block" (ID: ${approval.id})`;
    case "channel":
      return `${approval.requestingShip} mentioned you in ${approval.channelNest}:${preview}

Reply "approve", "deny", or "block"
(ID: ${approval.id})`;
    case "group":
      return `Group invite from ${approval.requestingShip} to join ${approval.groupFlag}

Reply "approve", "deny", or "block"
(ID: ${approval.id})`;
  }
}
function parseApprovalResponse(text) {
  const trimmed = text.trim().toLowerCase();
  const match = trimmed.match(/^(approve|deny|block)(?:\s+(.+))?$/);
  if (!match) {
    return null;
  }
  const action = match[1];
  const id = match[2]?.trim();
  return { action, id };
}
function isApprovalResponse(text) {
  const trimmed = text.trim().toLowerCase();
  return trimmed.startsWith("approve") || trimmed.startsWith("deny") || trimmed.startsWith("block");
}
function findPendingApproval(pendingApprovals, id) {
  if (id) {
    return pendingApprovals.find((a) => a.id === id);
  }
  return pendingApprovals[pendingApprovals.length - 1];
}
function removePendingApproval(pendingApprovals, id) {
  return pendingApprovals.filter((a) => a.id !== id);
}
function formatApprovalConfirmation(approval, action) {
  if (action === "block") {
    return `Blocked ${approval.requestingShip}. They will no longer be able to contact the bot.`;
  }
  const actionText = action === "approve" ? "Approved" : "Denied";
  switch (approval.type) {
    case "dm":
      if (action === "approve") {
        return `${actionText} DM access for ${approval.requestingShip}. They can now message the bot.`;
      }
      return `${actionText} DM request from ${approval.requestingShip}.`;
    case "channel":
      if (action === "approve") {
        return `${actionText} ${approval.requestingShip} for ${approval.channelNest}. They can now interact in this channel.`;
      }
      return `${actionText} ${approval.requestingShip} for ${approval.channelNest}.`;
    case "group":
      if (action === "approve") {
        return `${actionText} group invite from ${approval.requestingShip} to ${approval.groupFlag}. Joining group...`;
      }
      return `${actionText} group invite from ${approval.requestingShip} to ${approval.groupFlag}.`;
  }
}
function parseAdminCommand(text) {
  const trimmed = text.trim().toLowerCase();
  if (trimmed === "blocked") {
    return { type: "blocked" };
  }
  if (trimmed === "pending") {
    return { type: "pending" };
  }
  const unblockMatch = trimmed.match(/^unblock\s+(~[\w-]+)$/);
  if (unblockMatch) {
    return { type: "unblock", ship: unblockMatch[1] };
  }
  return null;
}
function isAdminCommand(text) {
  return parseAdminCommand(text) !== null;
}
function formatBlockedList(ships) {
  if (ships.length === 0) {
    return "No ships are currently blocked.";
  }
  return `Blocked ships (${ships.length}):
${ships.map((s) => `\u2022 ${s}`).join("\n")}`;
}
function formatPendingList(approvals) {
  if (approvals.length === 0) {
    return "No pending approval requests.";
  }
  return `Pending approvals (${approvals.length}):
${approvals.map((a) => `\u2022 ${a.id}: ${a.type} from ${a.requestingShip}`).join("\n")}`;
}

// vendor/openclaw-runtime/win-x64/extensions/tlon/src/monitor/utils.ts
function extractCites(content) {
  if (!content || !Array.isArray(content)) {
    return [];
  }
  const cites = [];
  for (const verse of content) {
    if (verse?.block?.cite && typeof verse.block.cite === "object") {
      const cite = verse.block.cite;
      if (cite.chan && typeof cite.chan === "object") {
        const { nest, where } = cite.chan;
        const whereMatch = where?.match(/\/msg\/(~[a-z-]+)\/(.+)/);
        cites.push({
          type: "chan",
          nest,
          where,
          author: whereMatch?.[1],
          postId: whereMatch?.[2]
        });
      } else if (cite.group && typeof cite.group === "string") {
        cites.push({ type: "group", group: cite.group });
      } else if (cite.desk && typeof cite.desk === "object") {
        cites.push({ type: "desk", flag: cite.desk.flag, where: cite.desk.where });
      } else if (cite.bait && typeof cite.bait === "object") {
        cites.push({
          type: "bait",
          group: cite.bait.group,
          nest: cite.bait.graph,
          where: cite.bait.where
        });
      }
    }
  }
  return cites;
}
function formatModelName(modelString) {
  if (!modelString) {
    return "AI";
  }
  const modelName = modelString.includes("/") ? modelString.split("/")[1] : modelString;
  const modelMappings = {
    "claude-opus-4-5": "Claude Opus 4.5",
    "claude-sonnet-4-5": "Claude Sonnet 4.5",
    "claude-sonnet-3-5": "Claude Sonnet 3.5",
    "gpt-4o": "GPT-4o",
    "gpt-4-turbo": "GPT-4 Turbo",
    "gpt-4": "GPT-4",
    "gemini-2.0-flash": "Gemini 2.0 Flash",
    "gemini-pro": "Gemini Pro"
  };
  if (modelMappings[modelName]) {
    return modelMappings[modelName];
  }
  return modelName.replace(/-/g, " ").split(" ").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}
function isBotMentioned(messageText, botShipName, nickname) {
  if (!messageText || !botShipName) {
    return false;
  }
  if (/@all\b/i.test(messageText)) {
    return true;
  }
  const normalizedBotShip = normalizeShip(botShipName);
  const escapedShip = normalizedBotShip.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const mentionPattern = new RegExp(`(^|\\s)${escapedShip}(?=\\s|$)`, "i");
  if (mentionPattern.test(messageText)) {
    return true;
  }
  if (nickname) {
    const escapedNickname = nickname.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const nicknamePattern = new RegExp(`(^|\\s)${escapedNickname}(?=\\s|$|[,!?.])`, "i");
    if (nicknamePattern.test(messageText)) {
      return true;
    }
  }
  return false;
}
function stripBotMention(messageText, botShipName) {
  if (!messageText || !botShipName) return messageText;
  return messageText.replace(normalizeShip(botShipName), "").trim();
}
function isDmAllowed(senderShip, allowlist) {
  if (!allowlist || allowlist.length === 0) {
    return false;
  }
  const normalizedSender = normalizeShip(senderShip);
  return allowlist.map((ship) => normalizeShip(ship)).some((ship) => ship === normalizedSender);
}
function extractInlineText(items) {
  return items.map((item) => {
    if (typeof item === "string") {
      return item;
    }
    if (item && typeof item === "object") {
      if (item.ship) {
        return item.ship;
      }
      if ("sect" in item) {
        return `@${item.sect || "all"}`;
      }
      if (item["inline-code"]) {
        return `\`${item["inline-code"]}\``;
      }
      if (item.code) {
        return `\`${item.code}\``;
      }
      if (item.link && item.link.href) {
        return item.link.content || item.link.href;
      }
      if (item.bold && Array.isArray(item.bold)) {
        return `**${extractInlineText(item.bold)}**`;
      }
      if (item.italics && Array.isArray(item.italics)) {
        return `*${extractInlineText(item.italics)}*`;
      }
      if (item.strike && Array.isArray(item.strike)) {
        return `~~${extractInlineText(item.strike)}~~`;
      }
    }
    return "";
  }).join("");
}
function extractMessageText(content) {
  if (!content || !Array.isArray(content)) {
    return "";
  }
  return content.map((verse) => {
    if (verse.inline && Array.isArray(verse.inline)) {
      return verse.inline.map((item) => {
        if (typeof item === "string") {
          return item;
        }
        if (item && typeof item === "object") {
          if (item.ship) {
            return item.ship;
          }
          if ("sect" in item) {
            return `@${item.sect || "all"}`;
          }
          if (item.break !== void 0) {
            return "\n";
          }
          if (item.link && item.link.href) {
            return item.link.href;
          }
          if (item["inline-code"]) {
            return `\`${item["inline-code"]}\``;
          }
          if (item.code) {
            return `\`${item.code}\``;
          }
          if (item.bold && Array.isArray(item.bold)) {
            return `**${extractInlineText(item.bold)}**`;
          }
          if (item.italics && Array.isArray(item.italics)) {
            return `*${extractInlineText(item.italics)}*`;
          }
          if (item.strike && Array.isArray(item.strike)) {
            return `~~${extractInlineText(item.strike)}~~`;
          }
          if (item.blockquote && Array.isArray(item.blockquote)) {
            return `> ${extractInlineText(item.blockquote)}`;
          }
        }
        return "";
      }).join("");
    }
    if (verse.block && typeof verse.block === "object") {
      const block = verse.block;
      if (block.image && block.image.src) {
        const alt = block.image.alt ? ` (${block.image.alt})` : "";
        return `
${block.image.src}${alt}
`;
      }
      if (block.code && typeof block.code === "object") {
        const lang = block.code.lang || "";
        const code = block.code.code || "";
        return `
\`\`\`${lang}
${code}
\`\`\`
`;
      }
      if (block.header && typeof block.header === "object") {
        const text = block.header.content?.map((item) => typeof item === "string" ? item : "").join("") || "";
        return `
## ${text}
`;
      }
      if (block.cite && typeof block.cite === "object") {
        const cite = block.cite;
        if (cite.chan && typeof cite.chan === "object") {
          const { nest, where } = cite.chan;
          const whereMatch = where?.match(/\/msg\/(~[a-z-]+)\/(.+)/);
          if (whereMatch) {
            const [, author, _postId] = whereMatch;
            return `
> [quoted: ${author} in ${nest}]
`;
          }
          return `
> [quoted from ${nest}]
`;
        }
        if (cite.group && typeof cite.group === "string") {
          return `
> [ref: group ${cite.group}]
`;
        }
        if (cite.desk && typeof cite.desk === "object") {
          return `
> [ref: ${cite.desk.flag}]
`;
        }
        if (cite.bait && typeof cite.bait === "object") {
          return `
> [ref: ${cite.bait.graph} in ${cite.bait.group}]
`;
        }
        return `
> [quoted message]
`;
      }
    }
    return "";
  }).join("\n").trim();
}
function isSummarizationRequest(messageText) {
  const patterns = [
    /summarize\s+(this\s+)?(channel|chat|conversation)/i,
    /what\s+did\s+i\s+miss/i,
    /catch\s+me\s+up/i,
    /channel\s+summary/i,
    /tldr/i
  ];
  return patterns.some((pattern) => pattern.test(messageText));
}

// vendor/openclaw-runtime/win-x64/extensions/tlon/src/monitor/discovery.ts
async function fetchInitData(api, runtime2) {
  try {
    runtime2.log?.("[tlon] Fetching groups-ui init data...");
    const initData = await api.scry("/groups-ui/v6/init.json");
    const channels = [];
    if (initData?.groups) {
      for (const groupData of Object.values(initData.groups)) {
        if (groupData && typeof groupData === "object" && groupData.channels) {
          for (const channelNest of Object.keys(groupData.channels)) {
            if (channelNest.startsWith("chat/")) {
              channels.push(channelNest);
            }
          }
        }
      }
    }
    if (channels.length > 0) {
      runtime2.log?.(`[tlon] Auto-discovered ${channels.length} chat channel(s)`);
    } else {
      runtime2.log?.("[tlon] No chat channels found via auto-discovery");
    }
    const foreigns = initData?.foreigns || null;
    if (foreigns) {
      const pendingCount = Object.values(foreigns).filter(
        (f) => f.invites?.some((i) => i.valid)
      ).length;
      if (pendingCount > 0) {
        runtime2.log?.(`[tlon] Found ${pendingCount} pending group invite(s)`);
      }
    }
    return { channels, foreigns };
  } catch (error) {
    runtime2.log?.(`[tlon] Init data fetch failed: ${error?.message ?? String(error)}`);
    return { channels: [], foreigns: null };
  }
}
async function fetchAllChannels(api, runtime2) {
  const { channels } = await fetchInitData(api, runtime2);
  return channels;
}

// vendor/openclaw-runtime/win-x64/extensions/tlon/src/monitor/history.ts
function formatUd(id) {
  const str = String(id).replace(/\./g, "");
  const reversed = str.split("").toReversed();
  const chunks = [];
  for (let i = 0; i < reversed.length; i += 3) {
    chunks.push(
      reversed.slice(i, i + 3).toReversed().join("")
    );
  }
  return chunks.toReversed().join(".");
}
var messageCache = /* @__PURE__ */ new Map();
var MAX_CACHED_MESSAGES = 100;
function cacheMessage(channelNest, message) {
  if (!messageCache.has(channelNest)) {
    messageCache.set(channelNest, []);
  }
  const cache = messageCache.get(channelNest);
  if (!cache) {
    return;
  }
  cache.unshift(message);
  if (cache.length > MAX_CACHED_MESSAGES) {
    cache.pop();
  }
}
async function fetchChannelHistory(api, channelNest, count = 50, runtime2) {
  try {
    const scryPath = `/channels/v4/${channelNest}/posts/newest/${count}/outline.json`;
    runtime2?.log?.(`[tlon] Fetching history: ${scryPath}`);
    const data = await api.scry(scryPath);
    if (!data) {
      return [];
    }
    let posts = [];
    if (Array.isArray(data)) {
      posts = data;
    } else if (data.posts && typeof data.posts === "object") {
      posts = Object.values(data.posts);
    } else if (typeof data === "object") {
      posts = Object.values(data);
    }
    const messages = posts.map((item) => {
      const essay = item.essay || item["r-post"]?.set?.essay;
      const seal = item.seal || item["r-post"]?.set?.seal;
      return {
        author: essay?.author || "unknown",
        content: extractMessageText(essay?.content || []),
        timestamp: essay?.sent || Date.now(),
        id: seal?.id
      };
    }).filter((msg) => msg.content);
    runtime2?.log?.(`[tlon] Extracted ${messages.length} messages from history`);
    return messages;
  } catch (error) {
    runtime2?.log?.(`[tlon] Error fetching channel history: ${error?.message ?? String(error)}`);
    return [];
  }
}
async function getChannelHistory(api, channelNest, count = 50, runtime2) {
  const cache = messageCache.get(channelNest) ?? [];
  if (cache.length >= count) {
    runtime2?.log?.(`[tlon] Using cached messages (${cache.length} available)`);
    return cache.slice(0, count);
  }
  runtime2?.log?.(`[tlon] Cache has ${cache.length} messages, need ${count}, fetching from scry...`);
  return await fetchChannelHistory(api, channelNest, count, runtime2);
}
async function fetchThreadHistory(api, channelNest, parentId, count = 50, runtime2) {
  try {
    const formattedParentId = formatUd(parentId);
    runtime2?.log?.(
      `[tlon] Thread history - parentId: ${parentId} -> formatted: ${formattedParentId}`
    );
    const scryPath = `/channels/v4/${channelNest}/posts/post/id/${formattedParentId}/replies/newest/${count}.json`;
    runtime2?.log?.(`[tlon] Fetching thread history: ${scryPath}`);
    const data = await api.scry(scryPath);
    if (!data) {
      runtime2?.log?.(`[tlon] No thread history data returned`);
      return [];
    }
    let replies = [];
    if (Array.isArray(data)) {
      replies = data;
    } else if (data.replies && Array.isArray(data.replies)) {
      replies = data.replies;
    } else if (typeof data === "object") {
      replies = Object.values(data);
    }
    const messages = replies.map((item) => {
      const memo = item.memo || item["r-reply"]?.set?.memo || item;
      const seal = item.seal || item["r-reply"]?.set?.seal;
      return {
        author: memo?.author || "unknown",
        content: extractMessageText(memo?.content || []),
        timestamp: memo?.sent || Date.now(),
        id: seal?.id || item.id
      };
    }).filter((msg) => msg.content);
    runtime2?.log?.(`[tlon] Extracted ${messages.length} thread replies from history`);
    return messages;
  } catch (error) {
    runtime2?.log?.(`[tlon] Error fetching thread history: ${error?.message ?? String(error)}`);
    try {
      const altPath = `/channels/v4/${channelNest}/posts/post/id/${formatUd(parentId)}.json`;
      runtime2?.log?.(`[tlon] Trying alternate path: ${altPath}`);
      const data = await api.scry(altPath);
      if (data?.seal?.meta?.replyCount > 0 && data?.replies) {
        const replies = Array.isArray(data.replies) ? data.replies : Object.values(data.replies);
        const messages = replies.map((reply) => ({
          author: reply.memo?.author || "unknown",
          content: extractMessageText(reply.memo?.content || []),
          timestamp: reply.memo?.sent || Date.now(),
          id: reply.seal?.id
        })).filter((msg) => msg.content);
        runtime2?.log?.(`[tlon] Extracted ${messages.length} replies from post data`);
        return messages;
      }
    } catch (altError) {
      runtime2?.log?.(`[tlon] Alternate path also failed: ${altError?.message ?? String(altError)}`);
    }
    return [];
  }
}

// vendor/openclaw-runtime/win-x64/extensions/tlon/src/monitor/media.ts
import { randomUUID as randomUUID2 } from "crypto";
import { createWriteStream } from "fs";
import { mkdir } from "fs/promises";
import { homedir } from "os";
import * as path from "path";
import { Readable as Readable2 } from "stream";
import { pipeline } from "stream/promises";
import { fetchWithSsrFGuard as fetchWithSsrFGuard2 } from "openclaw/plugin-sdk";
var DEFAULT_MEDIA_DIR = path.join(homedir(), ".openclaw", "workspace", "media", "inbound");
function extractImageBlocks(content) {
  if (!content || !Array.isArray(content)) {
    return [];
  }
  const images = [];
  for (const verse of content) {
    if (verse?.block?.image?.src) {
      images.push({
        url: verse.block.image.src,
        alt: verse.block.image.alt
      });
    }
  }
  return images;
}
async function downloadMedia(url, mediaDir = DEFAULT_MEDIA_DIR) {
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      console.warn(`[tlon-media] Rejected non-http(s) URL: ${url}`);
      return null;
    }
    await mkdir(mediaDir, { recursive: true });
    const { response, release } = await fetchWithSsrFGuard2({
      url,
      init: { method: "GET" },
      policy: getDefaultSsrFPolicy(),
      auditContext: "tlon-media-download"
    });
    try {
      if (!response.ok) {
        console.error(`[tlon-media] Failed to fetch ${url}: ${response.status}`);
        return null;
      }
      const contentType = response.headers.get("content-type") || "application/octet-stream";
      const ext = getExtensionFromContentType(contentType) || getExtensionFromUrl(url) || "bin";
      const filename = `${randomUUID2()}.${ext}`;
      const localPath = path.join(mediaDir, filename);
      const body = response.body;
      if (!body) {
        console.error(`[tlon-media] No response body for ${url}`);
        return null;
      }
      const writeStream = createWriteStream(localPath);
      await pipeline(Readable2.fromWeb(body), writeStream);
      return {
        localPath,
        contentType,
        originalUrl: url
      };
    } finally {
      await release();
    }
  } catch (error) {
    console.error(`[tlon-media] Error downloading ${url}: ${error?.message ?? String(error)}`);
    return null;
  }
}
function getExtensionFromContentType(contentType) {
  const map = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/svg+xml": "svg",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "audio/mpeg": "mp3",
    "audio/ogg": "ogg"
  };
  return map[contentType.split(";")[0].trim()] ?? null;
}
function getExtensionFromUrl(url) {
  try {
    const pathname = new URL(url).pathname;
    const match = pathname.match(/\.([a-z0-9]+)$/i);
    return match ? match[1].toLowerCase() : null;
  } catch {
    return null;
  }
}
async function downloadMessageImages(content, mediaDir) {
  const images = extractImageBlocks(content);
  if (images.length === 0) {
    return [];
  }
  const attachments = [];
  for (const image of images) {
    const downloaded = await downloadMedia(image.url, mediaDir);
    if (downloaded) {
      attachments.push({
        path: downloaded.localPath,
        contentType: downloaded.contentType
      });
    }
  }
  return attachments;
}

// vendor/openclaw-runtime/win-x64/extensions/tlon/src/monitor/processed-messages.ts
import { createDedupeCache } from "openclaw/plugin-sdk";
function createProcessedMessageTracker(limit = 2e3) {
  const dedupe = createDedupeCache({ ttlMs: 0, maxSize: limit });
  const mark = (id) => {
    const trimmed = id?.trim();
    if (!trimmed) {
      return true;
    }
    return !dedupe.check(trimmed);
  };
  const has = (id) => {
    const trimmed = id?.trim();
    if (!trimmed) {
      return false;
    }
    return dedupe.peek(trimmed);
  };
  return {
    mark,
    has,
    size: () => dedupe.size()
  };
}

// vendor/openclaw-runtime/win-x64/extensions/tlon/src/monitor/index.ts
function resolveChannelAuthorization(cfg, channelNest, settings) {
  const tlonConfig = cfg.channels?.tlon;
  const fileRules = tlonConfig?.authorization?.channelRules ?? {};
  const settingsRules = settings?.channelRules ?? {};
  const rule = settingsRules[channelNest] ?? fileRules[channelNest];
  const defaultShips = settings?.defaultAuthorizedShips ?? tlonConfig?.defaultAuthorizedShips ?? [];
  const allowedShips = rule?.allowedShips ?? defaultShips;
  const mode = rule?.mode ?? "restricted";
  return { mode, allowedShips };
}
async function monitorTlonProvider(opts = {}) {
  const core = getTlonRuntime();
  const cfg = core.config.loadConfig();
  if (cfg.channels?.tlon?.enabled === false) {
    return;
  }
  const logger = core.logging.getChildLogger({ module: "tlon-auto-reply" });
  const runtime2 = opts.runtime ?? createLoggerBackedRuntime({
    logger
  });
  const account = resolveTlonAccount(cfg, opts.accountId ?? void 0);
  if (!account.enabled) {
    return;
  }
  if (!account.configured || !account.ship || !account.url || !account.code) {
    throw new Error("Tlon account not configured (ship/url/code required)");
  }
  const botShipName = normalizeShip(account.ship);
  runtime2.log?.(`[tlon] Starting monitor for ${botShipName}`);
  const ssrfPolicy = ssrfPolicyFromAllowPrivateNetwork(account.allowPrivateNetwork);
  const accountUrl = account.url;
  const accountCode = account.code;
  async function authenticateWithRetry(maxAttempts = 10) {
    for (let attempt = 1; ; attempt++) {
      if (opts.abortSignal?.aborted) {
        throw new Error("Aborted while waiting to authenticate");
      }
      try {
        runtime2.log?.(`[tlon] Attempting authentication to ${accountUrl}...`);
        return await authenticate(accountUrl, accountCode, { ssrfPolicy });
      } catch (error) {
        runtime2.error?.(
          `[tlon] Failed to authenticate (attempt ${attempt}): ${error?.message ?? String(error)}`
        );
        if (attempt >= maxAttempts) {
          throw error;
        }
        const delay = Math.min(3e4, 1e3 * Math.pow(2, attempt - 1));
        runtime2.log?.(`[tlon] Retrying authentication in ${delay}ms...`);
        await new Promise((resolve, reject) => {
          const timer = setTimeout(resolve, delay);
          if (opts.abortSignal) {
            const onAbort = () => {
              clearTimeout(timer);
              reject(new Error("Aborted"));
            };
            opts.abortSignal.addEventListener("abort", onAbort, { once: true });
          }
        });
      }
    }
  }
  let api = null;
  const cookie = await authenticateWithRetry();
  api = new UrbitSSEClient(account.url, cookie, {
    ship: botShipName,
    ssrfPolicy,
    logger: {
      log: (message) => runtime2.log?.(message),
      error: (message) => runtime2.error?.(message)
    },
    // Re-authenticate on reconnect in case the session expired
    onReconnect: async (client) => {
      runtime2.log?.("[tlon] Re-authenticating on SSE reconnect...");
      const newCookie = await authenticateWithRetry(5);
      client.updateCookie(newCookie);
      runtime2.log?.("[tlon] Re-authentication successful");
    }
  });
  const processedTracker = createProcessedMessageTracker(2e3);
  let groupChannels = [];
  let botNickname = null;
  const settingsManager = createSettingsManager(api, {
    log: (msg) => runtime2.log?.(msg),
    error: (msg) => runtime2.error?.(msg)
  });
  let effectiveDmAllowlist = account.dmAllowlist;
  let effectiveShowModelSig = account.showModelSignature ?? false;
  let effectiveAutoAcceptDmInvites = account.autoAcceptDmInvites ?? false;
  let effectiveAutoAcceptGroupInvites = account.autoAcceptGroupInvites ?? false;
  let effectiveGroupInviteAllowlist = account.groupInviteAllowlist;
  let effectiveAutoDiscoverChannels = account.autoDiscoverChannels ?? false;
  let effectiveOwnerShip = account.ownerShip ? normalizeShip(account.ownerShip) : null;
  let pendingApprovals = [];
  let currentSettings = {};
  const participatedThreads = /* @__PURE__ */ new Set();
  const dmSendersBySession = /* @__PURE__ */ new Map();
  let sharedSessionWarningSent = false;
  try {
    const selfProfile = await api.scry("/contacts/v1/self.json");
    if (selfProfile && typeof selfProfile === "object") {
      const profile = selfProfile;
      botNickname = profile.nickname?.value || null;
      if (botNickname) {
        runtime2.log?.(`[tlon] Bot nickname: ${botNickname}`);
      }
    }
  } catch (error) {
    runtime2.log?.(`[tlon] Could not fetch nickname: ${error?.message ?? String(error)}`);
  }
  let initForeigns = null;
  async function migrateConfigToSettings() {
    const migrations = [
      {
        key: "dmAllowlist",
        fileValue: account.dmAllowlist,
        settingsValue: currentSettings.dmAllowlist
      },
      {
        key: "groupInviteAllowlist",
        fileValue: account.groupInviteAllowlist,
        settingsValue: currentSettings.groupInviteAllowlist
      },
      {
        key: "groupChannels",
        fileValue: account.groupChannels,
        settingsValue: currentSettings.groupChannels
      },
      {
        key: "defaultAuthorizedShips",
        fileValue: account.defaultAuthorizedShips,
        settingsValue: currentSettings.defaultAuthorizedShips
      },
      {
        key: "autoDiscoverChannels",
        fileValue: account.autoDiscoverChannels,
        settingsValue: currentSettings.autoDiscoverChannels
      },
      {
        key: "autoAcceptDmInvites",
        fileValue: account.autoAcceptDmInvites,
        settingsValue: currentSettings.autoAcceptDmInvites
      },
      {
        key: "autoAcceptGroupInvites",
        fileValue: account.autoAcceptGroupInvites,
        settingsValue: currentSettings.autoAcceptGroupInvites
      },
      {
        key: "showModelSig",
        fileValue: account.showModelSignature,
        settingsValue: currentSettings.showModelSig
      }
    ];
    for (const { key, fileValue, settingsValue } of migrations) {
      const hasFileValue = Array.isArray(fileValue) ? fileValue.length > 0 : fileValue != null;
      const hasSettingsValue = Array.isArray(settingsValue) ? settingsValue.length > 0 : settingsValue != null;
      if (hasFileValue && !hasSettingsValue) {
        try {
          await api.poke({
            app: "settings",
            mark: "settings-event",
            json: {
              "put-entry": {
                "bucket-key": "tlon",
                "entry-key": key,
                value: fileValue,
                desk: "moltbot"
              }
            }
          });
          runtime2.log?.(`[tlon] Migrated ${key} from config to settings store`);
        } catch (err) {
          runtime2.log?.(`[tlon] Failed to migrate ${key}: ${String(err)}`);
        }
      }
    }
  }
  try {
    currentSettings = await settingsManager.load();
    await migrateConfigToSettings();
    if (currentSettings.defaultAuthorizedShips?.length) {
      runtime2.log?.(
        `[tlon] Using defaultAuthorizedShips from settings store: ${currentSettings.defaultAuthorizedShips.join(", ")}`
      );
    }
    if (currentSettings.autoDiscoverChannels !== void 0) {
      effectiveAutoDiscoverChannels = currentSettings.autoDiscoverChannels;
      runtime2.log?.(
        `[tlon] Using autoDiscoverChannels from settings store: ${effectiveAutoDiscoverChannels}`
      );
    }
    if (currentSettings.dmAllowlist?.length) {
      effectiveDmAllowlist = currentSettings.dmAllowlist;
      runtime2.log?.(
        `[tlon] Using dmAllowlist from settings store: ${effectiveDmAllowlist.join(", ")}`
      );
    }
    if (currentSettings.showModelSig !== void 0) {
      effectiveShowModelSig = currentSettings.showModelSig;
    }
    if (currentSettings.autoAcceptDmInvites !== void 0) {
      effectiveAutoAcceptDmInvites = currentSettings.autoAcceptDmInvites;
      runtime2.log?.(
        `[tlon] Using autoAcceptDmInvites from settings store: ${effectiveAutoAcceptDmInvites}`
      );
    }
    if (currentSettings.autoAcceptGroupInvites !== void 0) {
      effectiveAutoAcceptGroupInvites = currentSettings.autoAcceptGroupInvites;
      runtime2.log?.(
        `[tlon] Using autoAcceptGroupInvites from settings store: ${effectiveAutoAcceptGroupInvites}`
      );
    }
    if (currentSettings.groupInviteAllowlist?.length) {
      effectiveGroupInviteAllowlist = currentSettings.groupInviteAllowlist;
      runtime2.log?.(
        `[tlon] Using groupInviteAllowlist from settings store: ${effectiveGroupInviteAllowlist.join(", ")}`
      );
    }
    if (currentSettings.ownerShip) {
      effectiveOwnerShip = normalizeShip(currentSettings.ownerShip);
      runtime2.log?.(`[tlon] Using ownerShip from settings store: ${effectiveOwnerShip}`);
    }
    if (currentSettings.pendingApprovals?.length) {
      pendingApprovals = currentSettings.pendingApprovals;
      runtime2.log?.(`[tlon] Loaded ${pendingApprovals.length} pending approval(s) from settings`);
    }
  } catch (err) {
    runtime2.log?.(`[tlon] Settings store not available, using file config: ${String(err)}`);
  }
  if (effectiveAutoDiscoverChannels) {
    try {
      const initData = await fetchInitData(api, runtime2);
      if (initData.channels.length > 0) {
        groupChannels = initData.channels;
      }
      initForeigns = initData.foreigns;
    } catch (error) {
      runtime2.error?.(`[tlon] Auto-discovery failed: ${error?.message ?? String(error)}`);
    }
  }
  if (account.groupChannels.length > 0) {
    for (const ch of account.groupChannels) {
      if (!groupChannels.includes(ch)) {
        groupChannels.push(ch);
      }
    }
    runtime2.log?.(
      `[tlon] Added ${account.groupChannels.length} manual groupChannels to monitoring`
    );
  }
  if (currentSettings.groupChannels?.length) {
    for (const ch of currentSettings.groupChannels) {
      if (!groupChannels.includes(ch)) {
        groupChannels.push(ch);
      }
    }
  }
  if (groupChannels.length > 0) {
    runtime2.log?.(
      `[tlon] Monitoring ${groupChannels.length} group channel(s): ${groupChannels.join(", ")}`
    );
  } else {
    runtime2.log?.("[tlon] No group channels to monitor (DMs only)");
  }
  async function resolveCiteContent(cite) {
    if (cite.type !== "chan" || !cite.nest || !cite.postId) {
      return null;
    }
    try {
      const scryPath = `/channels/v4/${cite.nest}/posts/post/${cite.postId}.json`;
      runtime2.log?.(`[tlon] Fetching cited post: ${scryPath}`);
      const data = await api.scry(scryPath);
      if (data?.essay?.content) {
        const text = extractMessageText(data.essay.content);
        return text || null;
      }
      return null;
    } catch (err) {
      runtime2.log?.(`[tlon] Failed to fetch cited post: ${String(err)}`);
      return null;
    }
  }
  async function resolveAllCites(content) {
    const cites = extractCites(content);
    if (cites.length === 0) {
      return "";
    }
    const resolved = [];
    for (const cite of cites) {
      const text = await resolveCiteContent(cite);
      if (text) {
        const author = cite.author || "unknown";
        resolved.push(`> ${author} wrote: ${text}`);
      }
    }
    return resolved.length > 0 ? resolved.join("\n") + "\n\n" : "";
  }
  async function savePendingApprovals() {
    try {
      await api.poke({
        app: "settings",
        mark: "settings-event",
        json: {
          "put-entry": {
            desk: "moltbot",
            "bucket-key": "tlon",
            "entry-key": "pendingApprovals",
            value: JSON.stringify(pendingApprovals)
          }
        }
      });
    } catch (err) {
      runtime2.error?.(`[tlon] Failed to save pending approvals: ${String(err)}`);
    }
  }
  async function addToDmAllowlist(ship) {
    const normalizedShip = normalizeShip(ship);
    if (!effectiveDmAllowlist.includes(normalizedShip)) {
      effectiveDmAllowlist = [...effectiveDmAllowlist, normalizedShip];
    }
    try {
      await api.poke({
        app: "settings",
        mark: "settings-event",
        json: {
          "put-entry": {
            desk: "moltbot",
            "bucket-key": "tlon",
            "entry-key": "dmAllowlist",
            value: effectiveDmAllowlist
          }
        }
      });
      runtime2.log?.(`[tlon] Added ${normalizedShip} to dmAllowlist`);
    } catch (err) {
      runtime2.error?.(`[tlon] Failed to update dmAllowlist: ${String(err)}`);
    }
  }
  async function addToChannelAllowlist(ship, channelNest) {
    const normalizedShip = normalizeShip(ship);
    const channelRules = currentSettings.channelRules ?? {};
    const rule = channelRules[channelNest] ?? { mode: "restricted", allowedShips: [] };
    const allowedShips = [...rule.allowedShips ?? []];
    if (!allowedShips.includes(normalizedShip)) {
      allowedShips.push(normalizedShip);
    }
    const updatedRules = {
      ...channelRules,
      [channelNest]: { ...rule, allowedShips }
    };
    currentSettings = { ...currentSettings, channelRules: updatedRules };
    try {
      await api.poke({
        app: "settings",
        mark: "settings-event",
        json: {
          "put-entry": {
            desk: "moltbot",
            "bucket-key": "tlon",
            "entry-key": "channelRules",
            value: JSON.stringify(updatedRules)
          }
        }
      });
      runtime2.log?.(`[tlon] Added ${normalizedShip} to ${channelNest} allowlist`);
    } catch (err) {
      runtime2.error?.(`[tlon] Failed to update channelRules: ${String(err)}`);
    }
  }
  async function blockShip(ship) {
    const normalizedShip = normalizeShip(ship);
    try {
      await api.poke({
        app: "chat",
        mark: "chat-block-ship",
        json: { ship: normalizedShip }
      });
      runtime2.log?.(`[tlon] Blocked ship ${normalizedShip}`);
    } catch (err) {
      runtime2.error?.(`[tlon] Failed to block ship ${normalizedShip}: ${String(err)}`);
    }
  }
  async function isShipBlocked(ship) {
    const normalizedShip = normalizeShip(ship);
    try {
      const blocked = await api.scry("/chat/blocked.json");
      return Array.isArray(blocked) && blocked.some((s) => normalizeShip(s) === normalizedShip);
    } catch (err) {
      runtime2.log?.(`[tlon] Failed to check blocked list: ${String(err)}`);
      return false;
    }
  }
  async function getBlockedShips() {
    try {
      const blocked = await api.scry("/chat/blocked.json");
      return Array.isArray(blocked) ? blocked : [];
    } catch (err) {
      runtime2.log?.(`[tlon] Failed to get blocked list: ${String(err)}`);
      return [];
    }
  }
  async function unblockShip(ship) {
    const normalizedShip = normalizeShip(ship);
    try {
      await api.poke({
        app: "chat",
        mark: "chat-unblock-ship",
        json: { ship: normalizedShip }
      });
      runtime2.log?.(`[tlon] Unblocked ship ${normalizedShip}`);
      return true;
    } catch (err) {
      runtime2.error?.(`[tlon] Failed to unblock ship ${normalizedShip}: ${String(err)}`);
      return false;
    }
  }
  async function sendOwnerNotification(message) {
    if (!effectiveOwnerShip) {
      runtime2.log?.("[tlon] No ownerShip configured, cannot send notification");
      return;
    }
    try {
      await sendDm({
        api,
        fromShip: botShipName,
        toShip: effectiveOwnerShip,
        text: message
      });
      runtime2.log?.(`[tlon] Sent notification to owner ${effectiveOwnerShip}`);
    } catch (err) {
      runtime2.error?.(`[tlon] Failed to send notification to owner: ${String(err)}`);
    }
  }
  async function queueApprovalRequest(approval) {
    if (await isShipBlocked(approval.requestingShip)) {
      runtime2.log?.(`[tlon] Ignoring request from blocked ship ${approval.requestingShip}`);
      return;
    }
    const existingIndex = pendingApprovals.findIndex(
      (a) => a.type === approval.type && a.requestingShip === approval.requestingShip && (approval.type !== "channel" || a.channelNest === approval.channelNest) && (approval.type !== "group" || a.groupFlag === approval.groupFlag)
    );
    if (existingIndex !== -1) {
      const existing = pendingApprovals[existingIndex];
      if (approval.originalMessage) {
        existing.originalMessage = approval.originalMessage;
        existing.messagePreview = approval.messagePreview;
      }
      runtime2.log?.(
        `[tlon] Updated existing approval for ${approval.requestingShip} (${approval.type}) - re-sending notification`
      );
      await savePendingApprovals();
      const message2 = formatApprovalRequest(existing);
      await sendOwnerNotification(message2);
      return;
    }
    pendingApprovals.push(approval);
    await savePendingApprovals();
    const message = formatApprovalRequest(approval);
    await sendOwnerNotification(message);
    runtime2.log?.(
      `[tlon] Queued approval request: ${approval.id} (${approval.type} from ${approval.requestingShip})`
    );
  }
  async function handleApprovalResponse(text) {
    const parsed = parseApprovalResponse(text);
    if (!parsed) {
      return false;
    }
    const approval = findPendingApproval(pendingApprovals, parsed.id);
    if (!approval) {
      await sendOwnerNotification(
        "No pending approval found" + (parsed.id ? ` for ID: ${parsed.id}` : "")
      );
      return true;
    }
    if (parsed.action === "approve") {
      switch (approval.type) {
        case "dm":
          await addToDmAllowlist(approval.requestingShip);
          if (approval.originalMessage) {
            runtime2.log?.(
              `[tlon] Processing original message from ${approval.requestingShip} after approval`
            );
            await processMessage({
              messageId: approval.originalMessage.messageId,
              senderShip: approval.requestingShip,
              messageText: approval.originalMessage.messageText,
              messageContent: approval.originalMessage.messageContent,
              isGroup: false,
              timestamp: approval.originalMessage.timestamp
            });
          }
          break;
        case "channel":
          if (approval.channelNest) {
            await addToChannelAllowlist(approval.requestingShip, approval.channelNest);
            if (approval.originalMessage) {
              const parsed2 = parseChannelNest(approval.channelNest);
              runtime2.log?.(
                `[tlon] Processing original message from ${approval.requestingShip} in ${approval.channelNest} after approval`
              );
              await processMessage({
                messageId: approval.originalMessage.messageId,
                senderShip: approval.requestingShip,
                messageText: approval.originalMessage.messageText,
                messageContent: approval.originalMessage.messageContent,
                isGroup: true,
                channelNest: approval.channelNest,
                hostShip: parsed2?.hostShip,
                channelName: parsed2?.channelName,
                timestamp: approval.originalMessage.timestamp,
                parentId: approval.originalMessage.parentId,
                isThreadReply: approval.originalMessage.isThreadReply
              });
            }
          }
          break;
        case "group":
          if (approval.groupFlag) {
            try {
              await api.poke({
                app: "groups",
                mark: "group-join",
                json: {
                  flag: approval.groupFlag,
                  "join-all": true
                }
              });
              runtime2.log?.(`[tlon] Joined group ${approval.groupFlag} after approval`);
              setTimeout(async () => {
                try {
                  const discoveredChannels = await fetchAllChannels(api, runtime2);
                  let newCount = 0;
                  for (const channelNest of discoveredChannels) {
                    if (!watchedChannels.has(channelNest)) {
                      watchedChannels.add(channelNest);
                      newCount++;
                    }
                  }
                  if (newCount > 0) {
                    runtime2.log?.(
                      `[tlon] Discovered ${newCount} new channel(s) after joining group`
                    );
                  }
                } catch (err) {
                  runtime2.log?.(`[tlon] Channel discovery after group join failed: ${String(err)}`);
                }
              }, 2e3);
            } catch (err) {
              runtime2.error?.(`[tlon] Failed to join group ${approval.groupFlag}: ${String(err)}`);
            }
          }
          break;
      }
      await sendOwnerNotification(formatApprovalConfirmation(approval, "approve"));
    } else if (parsed.action === "block") {
      await blockShip(approval.requestingShip);
      await sendOwnerNotification(formatApprovalConfirmation(approval, "block"));
    } else {
      await sendOwnerNotification(formatApprovalConfirmation(approval, "deny"));
    }
    pendingApprovals = removePendingApproval(pendingApprovals, approval.id);
    await savePendingApprovals();
    return true;
  }
  async function handleAdminCommand(text) {
    const command = parseAdminCommand(text);
    if (!command) {
      return false;
    }
    switch (command.type) {
      case "blocked": {
        const blockedShips = await getBlockedShips();
        await sendOwnerNotification(formatBlockedList(blockedShips));
        runtime2.log?.(`[tlon] Owner requested blocked ships list (${blockedShips.length} ships)`);
        return true;
      }
      case "pending": {
        await sendOwnerNotification(formatPendingList(pendingApprovals));
        runtime2.log?.(
          `[tlon] Owner requested pending approvals list (${pendingApprovals.length} pending)`
        );
        return true;
      }
      case "unblock": {
        const shipToUnblock = command.ship;
        const isBlocked = await isShipBlocked(shipToUnblock);
        if (!isBlocked) {
          await sendOwnerNotification(`${shipToUnblock} is not blocked.`);
          return true;
        }
        const success = await unblockShip(shipToUnblock);
        if (success) {
          await sendOwnerNotification(`Unblocked ${shipToUnblock}.`);
        } else {
          await sendOwnerNotification(`Failed to unblock ${shipToUnblock}.`);
        }
        return true;
      }
    }
  }
  function isOwner(ship) {
    if (!effectiveOwnerShip) {
      return false;
    }
    return normalizeShip(ship) === effectiveOwnerShip;
  }
  function extractDmPartnerShip(whom) {
    const raw = typeof whom === "string" ? whom : whom && typeof whom === "object" && "ship" in whom && typeof whom.ship === "string" ? whom.ship : "";
    const normalized = normalizeShip(raw);
    return /^~?[a-z-]+$/i.test(normalized) ? normalized : "";
  }
  const processMessage = async (params) => {
    const {
      messageId,
      senderShip,
      isGroup,
      channelNest,
      hostShip,
      channelName,
      timestamp,
      parentId,
      isThreadReply,
      messageContent
    } = params;
    const groupChannel = channelNest;
    let messageText = params.messageText;
    let attachments = [];
    if (messageContent) {
      try {
        attachments = await downloadMessageImages(messageContent);
        if (attachments.length > 0) {
          runtime2.log?.(`[tlon] Downloaded ${attachments.length} image(s) from message`);
        }
      } catch (error) {
        runtime2.log?.(`[tlon] Failed to download images: ${error?.message ?? String(error)}`);
      }
    }
    if (isThreadReply && parentId && groupChannel) {
      try {
        const threadHistory = await fetchThreadHistory(api, groupChannel, parentId, 20, runtime2);
        if (threadHistory.length > 0) {
          const threadContext = threadHistory.slice(-10).map((msg) => `${msg.author}: ${msg.content}`).join("\n");
          const contextNote = `[Thread conversation - ${threadHistory.length} previous replies. You are participating in this thread. Only respond if relevant or helpful - you don't need to reply to every message.]`;
          messageText = `${contextNote}

[Previous messages]
${threadContext}

[Current message]
${messageText}`;
          runtime2?.log?.(
            `[tlon] Added thread context (${threadHistory.length} replies) to message`
          );
        }
      } catch (error) {
        runtime2?.log?.(`[tlon] Could not fetch thread context: ${error?.message ?? String(error)}`);
      }
    }
    if (isGroup && groupChannel && isSummarizationRequest(messageText)) {
      try {
        const history = await getChannelHistory(api, groupChannel, 50, runtime2);
        if (history.length === 0) {
          const noHistoryMsg = "I couldn't fetch any messages for this channel. It might be empty or there might be a permissions issue.";
          if (isGroup) {
            const parsed = parseChannelNest(groupChannel);
            if (parsed) {
              await sendGroupMessage({
                api,
                fromShip: botShipName,
                hostShip: parsed.hostShip,
                channelName: parsed.channelName,
                text: noHistoryMsg
              });
            }
          } else {
            await sendDm({
              api,
              fromShip: botShipName,
              toShip: senderShip,
              text: noHistoryMsg
            });
          }
          return;
        }
        const historyText = history.map(
          (msg) => `[${new Date(msg.timestamp).toLocaleString()}] ${msg.author}: ${msg.content}`
        ).join("\n");
        messageText = `Please summarize this channel conversation (${history.length} recent messages):

${historyText}

Provide a concise summary highlighting:
1. Main topics discussed
2. Key decisions or conclusions
3. Action items if any
4. Notable participants`;
      } catch (error) {
        const errorMsg = `Sorry, I encountered an error while fetching the channel history: ${error?.message ?? String(error)}`;
        if (isGroup && groupChannel) {
          const parsed = parseChannelNest(groupChannel);
          if (parsed) {
            await sendGroupMessage({
              api,
              fromShip: botShipName,
              hostShip: parsed.hostShip,
              channelName: parsed.channelName,
              text: errorMsg
            });
          }
        } else {
          await sendDm({ api, fromShip: botShipName, toShip: senderShip, text: errorMsg });
        }
        return;
      }
    }
    const route = core.channel.routing.resolveAgentRoute({
      cfg,
      channel: "tlon",
      accountId: opts.accountId ?? void 0,
      peer: {
        kind: isGroup ? "group" : "direct",
        id: isGroup ? groupChannel ?? senderShip : senderShip
      }
    });
    if (!isGroup) {
      const sessionKey = route.sessionKey;
      if (!dmSendersBySession.has(sessionKey)) {
        dmSendersBySession.set(sessionKey, /* @__PURE__ */ new Set());
      }
      const senders = dmSendersBySession.get(sessionKey);
      if (senders.size > 0 && !senders.has(senderShip)) {
        runtime2.log?.(
          `[tlon] \u26A0\uFE0F SECURITY: Multiple users sharing DM session. Configure "session.dmScope: per-channel-peer" in OpenClaw config.`
        );
        if (!sharedSessionWarningSent && effectiveOwnerShip) {
          sharedSessionWarningSent = true;
          const warningMsg = `\u26A0\uFE0F Security Warning: Multiple users are sharing a DM session with this bot. This can leak conversation context between users.

Fix: Add to your OpenClaw config:
session:
  dmScope: "per-channel-peer"

Docs: https://docs.openclaw.ai/concepts/session#secure-dm-mode`;
          sendDm({
            api,
            fromShip: botShipName,
            toShip: effectiveOwnerShip,
            text: warningMsg
          }).catch(
            (err) => runtime2.error?.(`[tlon] Failed to send security warning to owner: ${err}`)
          );
        }
      }
      senders.add(senderShip);
    }
    const senderRole = isOwner(senderShip) ? "owner" : "user";
    const fromLabel = isGroup ? `${senderShip} [${senderRole}] in ${channelNest}` : `${senderShip} [${senderRole}]`;
    const shouldComputeAuth = core.channel.commands.shouldComputeCommandAuthorized(
      messageText,
      cfg
    );
    let commandAuthorized = false;
    if (shouldComputeAuth) {
      const useAccessGroups = cfg.commands?.useAccessGroups !== false;
      const senderIsOwner = isOwner(senderShip);
      commandAuthorized = core.channel.commands.resolveCommandAuthorizedFromAuthorizers({
        useAccessGroups,
        authorizers: [{ configured: Boolean(effectiveOwnerShip), allowed: senderIsOwner }]
      });
      if (!commandAuthorized) {
        console.log(
          `[tlon] Command attempt denied: ${senderShip} is not owner (owner=${effectiveOwnerShip ?? "not configured"})`
        );
      }
    }
    let bodyWithAttachments = messageText;
    if (attachments.length > 0) {
      const mediaLines = attachments.map((a) => `[media attached: ${a.path} (${a.contentType}) | ${a.path}]`).join("\n");
      bodyWithAttachments = mediaLines + "\n" + messageText;
    }
    const body = core.channel.reply.formatAgentEnvelope({
      channel: "Tlon",
      from: fromLabel,
      timestamp,
      body: bodyWithAttachments
    });
    const commandBody = isGroup ? stripBotMention(messageText, botShipName) : messageText;
    const ctxPayload = core.channel.reply.finalizeInboundContext({
      Body: body,
      RawBody: messageText,
      CommandBody: commandBody,
      From: isGroup ? `tlon:group:${groupChannel}` : `tlon:${senderShip}`,
      To: `tlon:${botShipName}`,
      SessionKey: route.sessionKey,
      AccountId: route.accountId,
      ChatType: isGroup ? "group" : "direct",
      ConversationLabel: fromLabel,
      SenderName: senderShip,
      SenderId: senderShip,
      SenderRole: senderRole,
      CommandAuthorized: commandAuthorized,
      CommandSource: "text",
      Provider: "tlon",
      Surface: "tlon",
      MessageSid: messageId,
      // Include downloaded media attachments
      ...attachments.length > 0 && { Attachments: attachments },
      OriginatingChannel: "tlon",
      OriginatingTo: `tlon:${isGroup ? groupChannel : botShipName}`,
      // Include thread context for automatic reply routing
      ...parentId && { ThreadId: String(parentId), ReplyToId: String(parentId) }
    });
    const dispatchStartTime = Date.now();
    const responsePrefix = core.channel.reply.resolveEffectiveMessagesConfig(
      cfg,
      route.agentId
    ).responsePrefix;
    const humanDelay = core.channel.reply.resolveHumanDelayConfig(cfg, route.agentId);
    await core.channel.reply.dispatchReplyWithBufferedBlockDispatcher({
      ctx: ctxPayload,
      cfg,
      dispatcherOptions: {
        responsePrefix,
        humanDelay,
        deliver: async (payload) => {
          let replyText = payload.text;
          if (!replyText) {
            return;
          }
          const showSignature = effectiveShowModelSig;
          if (showSignature) {
            const extPayload = payload;
            const extRoute = route;
            const defaultModel = cfg.agents?.defaults?.model;
            const modelInfo = extPayload.metadata?.model || extPayload.model || extRoute.model || (typeof defaultModel === "string" ? defaultModel : defaultModel?.primary);
            extPayload.metadata?.model || extPayload.model || extRoute.model || (typeof defaultModel === "string" ? defaultModel : defaultModel?.primary);
            replyText = `${replyText}

_[Generated by ${formatModelName(modelInfo)}]_`;
          }
          if (isGroup && groupChannel) {
            const parsed = parseChannelNest(groupChannel);
            if (!parsed) {
              return;
            }
            await sendGroupMessage({
              api,
              fromShip: botShipName,
              hostShip: parsed.hostShip,
              channelName: parsed.channelName,
              text: replyText,
              replyToId: parentId ?? void 0
            });
            if (parentId) {
              participatedThreads.add(String(parentId));
              runtime2.log?.(`[tlon] Now tracking thread for future replies: ${parentId}`);
            }
          } else {
            await sendDm({ api, fromShip: botShipName, toShip: senderShip, text: replyText });
          }
        },
        onError: (err, info) => {
          const dispatchDuration = Date.now() - dispatchStartTime;
          runtime2.error?.(
            `[tlon] ${info.kind} reply failed after ${dispatchDuration}ms: ${String(err)}`
          );
        }
      }
    });
  };
  const watchedChannels = new Set(groupChannels);
  const _watchedDMs = /* @__PURE__ */ new Set();
  const handleChannelsFirehose = async (event) => {
    try {
      const nest = event?.nest;
      if (!nest) {
        return;
      }
      if (!watchedChannels.has(nest)) {
        return;
      }
      const response = event?.response;
      if (!response) {
        return;
      }
      const essay = response?.post?.["r-post"]?.set?.essay;
      const memo = response?.post?.["r-post"]?.reply?.["r-reply"]?.set?.memo;
      if (!essay && !memo) {
        return;
      }
      const content = memo || essay;
      const isThreadReply = Boolean(memo);
      const messageId = isThreadReply ? response?.post?.["r-post"]?.reply?.id : response?.post?.id;
      if (!processedTracker.mark(messageId)) {
        return;
      }
      const senderShip = normalizeShip(content.author ?? "");
      if (!senderShip || senderShip === botShipName) {
        return;
      }
      const citedContent = await resolveAllCites(content.content);
      const rawText = extractMessageText(content.content);
      const messageText = citedContent + rawText;
      if (!messageText.trim()) {
        return;
      }
      cacheMessage(nest, {
        author: senderShip,
        content: messageText,
        timestamp: content.sent || Date.now(),
        id: messageId
      });
      const seal = isThreadReply ? response?.post?.["r-post"]?.reply?.["r-reply"]?.set?.seal : response?.post?.["r-post"]?.set?.seal;
      const parentId = seal?.["parent-id"] || seal?.parent || null;
      const mentioned = isBotMentioned(messageText, botShipName, botNickname ?? void 0);
      const inParticipatedThread = isThreadReply && parentId && participatedThreads.has(String(parentId));
      if (!mentioned && !inParticipatedThread) {
        return;
      }
      if (inParticipatedThread && !mentioned) {
        runtime2.log?.(`[tlon] Responding to thread we participated in (no mention): ${parentId}`);
      }
      if (isOwner(senderShip)) {
        runtime2.log?.(`[tlon] Owner ${senderShip} is always allowed in channels`);
      } else {
        const { mode, allowedShips } = resolveChannelAuthorization(cfg, nest, currentSettings);
        if (mode === "restricted") {
          const normalizedAllowed = allowedShips.map(normalizeShip);
          if (!normalizedAllowed.includes(senderShip)) {
            if (effectiveOwnerShip) {
              const approval = createPendingApproval({
                type: "channel",
                requestingShip: senderShip,
                channelNest: nest,
                messagePreview: messageText.substring(0, 100),
                originalMessage: {
                  messageId: messageId ?? "",
                  messageText,
                  messageContent: content.content,
                  timestamp: content.sent || Date.now(),
                  parentId: parentId ?? void 0,
                  isThreadReply
                }
              });
              await queueApprovalRequest(approval);
            } else {
              runtime2.log?.(
                `[tlon] Access denied: ${senderShip} in ${nest} (allowed: ${allowedShips.join(", ")})`
              );
            }
            return;
          }
        }
      }
      const parsed = parseChannelNest(nest);
      await processMessage({
        messageId: messageId ?? "",
        senderShip,
        messageText,
        messageContent: content.content,
        // Pass raw content for media extraction
        isGroup: true,
        channelNest: nest,
        hostShip: parsed?.hostShip,
        channelName: parsed?.channelName,
        timestamp: content.sent || Date.now(),
        parentId,
        isThreadReply
      });
    } catch (error) {
      runtime2.error?.(
        `[tlon] Error handling channel firehose event: ${error?.message ?? String(error)}`
      );
    }
  };
  const processedDmInvites = /* @__PURE__ */ new Set();
  const handleChatFirehose = async (event) => {
    try {
      if (Array.isArray(event)) {
        for (const invite of event) {
          const ship = normalizeShip(invite.ship || "");
          if (!ship || processedDmInvites.has(ship)) {
            continue;
          }
          if (isOwner(ship)) {
            try {
              await api.poke({
                app: "chat",
                mark: "chat-dm-rsvp",
                json: { ship, ok: true }
              });
              processedDmInvites.add(ship);
              runtime2.log?.(`[tlon] Auto-accepted DM invite from owner ${ship}`);
            } catch (err) {
              runtime2.error?.(`[tlon] Failed to auto-accept DM from owner: ${String(err)}`);
            }
            continue;
          }
          if (effectiveAutoAcceptDmInvites && isDmAllowed(ship, effectiveDmAllowlist)) {
            try {
              await api.poke({
                app: "chat",
                mark: "chat-dm-rsvp",
                json: { ship, ok: true }
              });
              processedDmInvites.add(ship);
              runtime2.log?.(`[tlon] Auto-accepted DM invite from ${ship}`);
            } catch (err) {
              runtime2.error?.(`[tlon] Failed to auto-accept DM from ${ship}: ${String(err)}`);
            }
            continue;
          }
          if (effectiveOwnerShip && !isDmAllowed(ship, effectiveDmAllowlist)) {
            const approval = createPendingApproval({
              type: "dm",
              requestingShip: ship,
              messagePreview: "(DM invite - no message yet)"
            });
            await queueApprovalRequest(approval);
            processedDmInvites.add(ship);
          }
        }
        return;
      }
      if (!("whom" in event) || !("response" in event)) {
        return;
      }
      const whom = event.whom;
      const messageId = event.id;
      const response = event.response;
      const essay = response?.add?.essay;
      if (!essay) {
        return;
      }
      if (!processedTracker.mark(messageId)) {
        return;
      }
      const authorShip = normalizeShip(essay.author ?? "");
      const partnerShip = extractDmPartnerShip(whom);
      const senderShip = partnerShip || authorShip;
      if (authorShip === botShipName) {
        return;
      }
      if (!senderShip || senderShip === botShipName) {
        return;
      }
      if (authorShip && partnerShip && authorShip !== partnerShip) {
        runtime2.log?.(
          `[tlon] DM ship mismatch (author=${authorShip}, partner=${partnerShip}) - routing to partner`
        );
      }
      const citedContent = await resolveAllCites(essay.content);
      const rawText = extractMessageText(essay.content);
      const messageText = citedContent + rawText;
      if (!messageText.trim()) {
        return;
      }
      if (isOwner(senderShip) && isApprovalResponse(messageText)) {
        const handled = await handleApprovalResponse(messageText);
        if (handled) {
          runtime2.log?.(`[tlon] Processed approval response from owner: ${messageText}`);
          return;
        }
      }
      if (isOwner(senderShip) && isAdminCommand(messageText)) {
        const handled = await handleAdminCommand(messageText);
        if (handled) {
          runtime2.log?.(`[tlon] Processed admin command from owner: ${messageText}`);
          return;
        }
      }
      if (isOwner(senderShip)) {
        runtime2.log?.(`[tlon] Processing DM from owner ${senderShip}`);
        await processMessage({
          messageId: messageId ?? "",
          senderShip,
          messageText,
          messageContent: essay.content,
          isGroup: false,
          timestamp: essay.sent || Date.now()
        });
        return;
      }
      if (!isDmAllowed(senderShip, effectiveDmAllowlist)) {
        if (effectiveOwnerShip) {
          const approval = createPendingApproval({
            type: "dm",
            requestingShip: senderShip,
            messagePreview: messageText.substring(0, 100),
            originalMessage: {
              messageId: messageId ?? "",
              messageText,
              messageContent: essay.content,
              timestamp: essay.sent || Date.now()
            }
          });
          await queueApprovalRequest(approval);
        } else {
          runtime2.log?.(`[tlon] Blocked DM from ${senderShip}: not in allowlist`);
        }
        return;
      }
      await processMessage({
        messageId: messageId ?? "",
        senderShip,
        messageText,
        messageContent: essay.content,
        // Pass raw content for media extraction
        isGroup: false,
        timestamp: essay.sent || Date.now()
      });
    } catch (error) {
      runtime2.error?.(
        `[tlon] Error handling chat firehose event: ${error?.message ?? String(error)}`
      );
    }
  };
  try {
    runtime2.log?.("[tlon] Subscribing to firehose updates...");
    await api.subscribe({
      app: "channels",
      path: "/v2",
      event: handleChannelsFirehose,
      err: (error) => {
        runtime2.error?.(`[tlon] Channels firehose error: ${String(error)}`);
      },
      quit: () => {
        runtime2.log?.("[tlon] Channels firehose subscription ended");
      }
    });
    runtime2.log?.("[tlon] Subscribed to channels firehose (/v2)");
    await api.subscribe({
      app: "chat",
      path: "/v3",
      event: handleChatFirehose,
      err: (error) => {
        runtime2.error?.(`[tlon] Chat firehose error: ${String(error)}`);
      },
      quit: () => {
        runtime2.log?.("[tlon] Chat firehose subscription ended");
      }
    });
    runtime2.log?.("[tlon] Subscribed to chat firehose (/v3)");
    await api.subscribe({
      app: "contacts",
      path: "/v1/news",
      event: (event) => {
        try {
          if (event?.self) {
            const selfUpdate = event.self;
            if (selfUpdate?.contact?.nickname?.value !== void 0) {
              const newNickname = selfUpdate.contact.nickname.value || null;
              if (newNickname !== botNickname) {
                botNickname = newNickname;
                runtime2.log?.(`[tlon] Nickname updated: ${botNickname}`);
              }
            }
          }
        } catch (error) {
          runtime2.error?.(
            `[tlon] Error handling contacts event: ${error?.message ?? String(error)}`
          );
        }
      },
      err: (error) => {
        runtime2.error?.(`[tlon] Contacts subscription error: ${String(error)}`);
      },
      quit: () => {
        runtime2.log?.("[tlon] Contacts subscription ended");
      }
    });
    runtime2.log?.("[tlon] Subscribed to contacts updates (/v1/news)");
    settingsManager.onChange((newSettings) => {
      currentSettings = newSettings;
      if (newSettings.groupChannels?.length) {
        const newChannels = newSettings.groupChannels;
        for (const ch of newChannels) {
          if (!watchedChannels.has(ch)) {
            watchedChannels.add(ch);
            runtime2.log?.(`[tlon] Settings: now watching channel ${ch}`);
          }
        }
      }
      if (newSettings.dmAllowlist !== void 0) {
        effectiveDmAllowlist = newSettings.dmAllowlist.length > 0 ? newSettings.dmAllowlist : account.dmAllowlist;
        runtime2.log?.(`[tlon] Settings: dmAllowlist updated to ${effectiveDmAllowlist.join(", ")}`);
      }
      if (newSettings.showModelSig !== void 0) {
        effectiveShowModelSig = newSettings.showModelSig;
        runtime2.log?.(`[tlon] Settings: showModelSig = ${effectiveShowModelSig}`);
      }
      if (newSettings.autoAcceptDmInvites !== void 0) {
        effectiveAutoAcceptDmInvites = newSettings.autoAcceptDmInvites;
        runtime2.log?.(`[tlon] Settings: autoAcceptDmInvites = ${effectiveAutoAcceptDmInvites}`);
      }
      if (newSettings.autoAcceptGroupInvites !== void 0) {
        effectiveAutoAcceptGroupInvites = newSettings.autoAcceptGroupInvites;
        runtime2.log?.(
          `[tlon] Settings: autoAcceptGroupInvites = ${effectiveAutoAcceptGroupInvites}`
        );
      }
      if (newSettings.groupInviteAllowlist !== void 0) {
        effectiveGroupInviteAllowlist = newSettings.groupInviteAllowlist.length > 0 ? newSettings.groupInviteAllowlist : account.groupInviteAllowlist;
        runtime2.log?.(
          `[tlon] Settings: groupInviteAllowlist updated to ${effectiveGroupInviteAllowlist.join(", ")}`
        );
      }
      if (newSettings.defaultAuthorizedShips !== void 0) {
        runtime2.log?.(
          `[tlon] Settings: defaultAuthorizedShips updated to ${(newSettings.defaultAuthorizedShips || []).join(", ")}`
        );
      }
      if (newSettings.autoDiscoverChannels !== void 0) {
        effectiveAutoDiscoverChannels = newSettings.autoDiscoverChannels;
        runtime2.log?.(`[tlon] Settings: autoDiscoverChannels = ${effectiveAutoDiscoverChannels}`);
      }
      if (newSettings.ownerShip !== void 0) {
        effectiveOwnerShip = newSettings.ownerShip ? normalizeShip(newSettings.ownerShip) : account.ownerShip ? normalizeShip(account.ownerShip) : null;
        runtime2.log?.(`[tlon] Settings: ownerShip = ${effectiveOwnerShip}`);
      }
      if (newSettings.pendingApprovals !== void 0) {
        pendingApprovals = newSettings.pendingApprovals;
        runtime2.log?.(
          `[tlon] Settings: pendingApprovals updated (${pendingApprovals.length} items)`
        );
      }
    });
    try {
      await settingsManager.startSubscription();
    } catch (err) {
      runtime2.log?.(`[tlon] Settings subscription not available: ${String(err)}`);
    }
    try {
      await api.subscribe({
        app: "groups",
        path: "/groups/ui",
        event: async (event) => {
          try {
            if (event && typeof event === "object") {
              if (event.channels && typeof event.channels === "object") {
                const channels = event.channels;
                for (const [channelNest, _channelData] of Object.entries(channels)) {
                  if (!channelNest.startsWith("chat/")) {
                    continue;
                  }
                  if (!watchedChannels.has(channelNest)) {
                    watchedChannels.add(channelNest);
                    runtime2.log?.(
                      `[tlon] Auto-detected new channel (invite accepted): ${channelNest}`
                    );
                    if (effectiveAutoAcceptGroupInvites) {
                      try {
                        const currentChannels = currentSettings.groupChannels || [];
                        if (!currentChannels.includes(channelNest)) {
                          const updatedChannels = [...currentChannels, channelNest];
                          await api.poke({
                            app: "settings",
                            mark: "settings-event",
                            json: {
                              "put-entry": {
                                "bucket-key": "tlon",
                                "entry-key": "groupChannels",
                                value: updatedChannels,
                                desk: "moltbot"
                              }
                            }
                          });
                          runtime2.log?.(`[tlon] Persisted ${channelNest} to settings store`);
                        }
                      } catch (err) {
                        runtime2.error?.(
                          `[tlon] Failed to persist channel to settings: ${String(err)}`
                        );
                      }
                    }
                  }
                }
              }
              if (event.join && typeof event.join === "object") {
                const join3 = event.join;
                if (join3.channels) {
                  for (const channelNest of join3.channels) {
                    if (!channelNest.startsWith("chat/")) {
                      continue;
                    }
                    if (!watchedChannels.has(channelNest)) {
                      watchedChannels.add(channelNest);
                      runtime2.log?.(`[tlon] Auto-detected joined channel: ${channelNest}`);
                      if (effectiveAutoAcceptGroupInvites) {
                        try {
                          const currentChannels = currentSettings.groupChannels || [];
                          if (!currentChannels.includes(channelNest)) {
                            const updatedChannels = [...currentChannels, channelNest];
                            await api.poke({
                              app: "settings",
                              mark: "settings-event",
                              json: {
                                "put-entry": {
                                  "bucket-key": "tlon",
                                  "entry-key": "groupChannels",
                                  value: updatedChannels,
                                  desk: "moltbot"
                                }
                              }
                            });
                            runtime2.log?.(`[tlon] Persisted ${channelNest} to settings store`);
                          }
                        } catch (err) {
                          runtime2.error?.(
                            `[tlon] Failed to persist channel to settings: ${String(err)}`
                          );
                        }
                      }
                    }
                  }
                }
              }
            }
          } catch (error) {
            runtime2.error?.(
              `[tlon] Error handling groups-ui event: ${error?.message ?? String(error)}`
            );
          }
        },
        err: (error) => {
          runtime2.error?.(`[tlon] Groups-ui subscription error: ${String(error)}`);
        },
        quit: () => {
          runtime2.log?.("[tlon] Groups-ui subscription ended");
        }
      });
      runtime2.log?.("[tlon] Subscribed to groups-ui for real-time channel detection");
    } catch (err) {
      runtime2.log?.(`[tlon] Groups-ui subscription failed (will rely on polling): ${String(err)}`);
    }
    {
      const processedGroupInvites = /* @__PURE__ */ new Set();
      const processPendingInvites = async (foreigns) => {
        if (!foreigns || typeof foreigns !== "object") {
          return;
        }
        for (const [groupFlag, foreign] of Object.entries(foreigns)) {
          if (processedGroupInvites.has(groupFlag)) {
            continue;
          }
          if (!foreign.invites || foreign.invites.length === 0) {
            continue;
          }
          const validInvite = foreign.invites.find((inv) => inv.valid);
          if (!validInvite) {
            continue;
          }
          const inviterShip = validInvite.from;
          const normalizedInviter = normalizeShip(inviterShip);
          if (isOwner(inviterShip)) {
            try {
              await api.poke({
                app: "groups",
                mark: "group-join",
                json: {
                  flag: groupFlag,
                  "join-all": true
                }
              });
              processedGroupInvites.add(groupFlag);
              runtime2.log?.(`[tlon] Auto-accepted group invite from owner: ${groupFlag}`);
            } catch (err) {
              runtime2.error?.(`[tlon] Failed to accept group invite from owner: ${String(err)}`);
            }
            continue;
          }
          if (!effectiveAutoAcceptGroupInvites) {
            if (effectiveOwnerShip) {
              const approval = createPendingApproval({
                type: "group",
                requestingShip: inviterShip,
                groupFlag
              });
              await queueApprovalRequest(approval);
              processedGroupInvites.add(groupFlag);
            }
            continue;
          }
          const isAllowed = effectiveGroupInviteAllowlist.length > 0 ? effectiveGroupInviteAllowlist.map((s) => normalizeShip(s)).some((s) => s === normalizedInviter) : false;
          if (!isAllowed) {
            if (effectiveOwnerShip) {
              const approval = createPendingApproval({
                type: "group",
                requestingShip: inviterShip,
                groupFlag
              });
              await queueApprovalRequest(approval);
              processedGroupInvites.add(groupFlag);
            } else {
              runtime2.log?.(
                `[tlon] Rejected group invite from ${inviterShip} (not in groupInviteAllowlist): ${groupFlag}`
              );
              processedGroupInvites.add(groupFlag);
            }
            continue;
          }
          try {
            await api.poke({
              app: "groups",
              mark: "group-join",
              json: {
                flag: groupFlag,
                "join-all": true
              }
            });
            processedGroupInvites.add(groupFlag);
            runtime2.log?.(
              `[tlon] Auto-accepted group invite: ${groupFlag} (from ${validInvite.from})`
            );
          } catch (err) {
            runtime2.error?.(`[tlon] Failed to auto-accept group ${groupFlag}: ${String(err)}`);
          }
        }
      };
      if (initForeigns) {
        await processPendingInvites(initForeigns);
      }
      try {
        await api.subscribe({
          app: "groups",
          path: "/v1/foreigns",
          event: (data) => {
            void (async () => {
              try {
                await processPendingInvites(data);
              } catch (error) {
                runtime2.error?.(
                  `[tlon] Error handling foreigns event: ${error?.message ?? String(error)}`
                );
              }
            })();
          },
          err: (error) => {
            runtime2.error?.(`[tlon] Foreigns subscription error: ${String(error)}`);
          },
          quit: () => {
            runtime2.log?.("[tlon] Foreigns subscription ended");
          }
        });
        runtime2.log?.(
          "[tlon] Subscribed to foreigns (/v1/foreigns) for auto-accepting group invites"
        );
      } catch (err) {
        runtime2.log?.(`[tlon] Foreigns subscription failed: ${String(err)}`);
      }
    }
    if (effectiveAutoDiscoverChannels) {
      const discoveredChannels = await fetchAllChannels(api, runtime2);
      for (const channelNest of discoveredChannels) {
        watchedChannels.add(channelNest);
      }
      runtime2.log?.(`[tlon] Watching ${watchedChannels.size} channel(s)`);
    }
    for (const channelNest of watchedChannels) {
      runtime2.log?.(`[tlon] Watching channel: ${channelNest}`);
    }
    runtime2.log?.("[tlon] All subscriptions registered, connecting to SSE stream...");
    await api.connect();
    runtime2.log?.("[tlon] Connected! Firehose subscriptions active");
    const pollInterval = setInterval(
      async () => {
        if (!opts.abortSignal?.aborted) {
          try {
            if (effectiveAutoDiscoverChannels) {
              const discoveredChannels = await fetchAllChannels(api, runtime2);
              for (const channelNest of discoveredChannels) {
                if (!watchedChannels.has(channelNest)) {
                  watchedChannels.add(channelNest);
                  runtime2.log?.(`[tlon] Now watching new channel: ${channelNest}`);
                }
              }
            }
          } catch (error) {
            runtime2.error?.(`[tlon] Channel refresh error: ${error?.message ?? String(error)}`);
          }
        }
      },
      2 * 60 * 1e3
    );
    if (opts.abortSignal) {
      const signal = opts.abortSignal;
      await new Promise((resolve) => {
        signal.addEventListener(
          "abort",
          () => {
            clearInterval(pollInterval);
            resolve(null);
          },
          { once: true }
        );
      });
    } else {
      await new Promise(() => {
      });
    }
  } finally {
    try {
      await api?.close();
    } catch (error) {
      runtime2.error?.(`[tlon] Cleanup error: ${error?.message ?? String(error)}`);
    }
  }
}

// vendor/openclaw-runtime/win-x64/extensions/tlon/src/onboarding.ts
import {
  formatDocsLink,
  promptAccountId,
  DEFAULT_ACCOUNT_ID,
  normalizeAccountId
} from "openclaw/plugin-sdk";
var channel = "tlon";
function isConfigured(account) {
  return Boolean(account.ship && account.url && account.code);
}
function applyAccountConfig(params) {
  const { cfg, accountId, input } = params;
  const useDefault = accountId === DEFAULT_ACCOUNT_ID;
  const base = cfg.channels?.tlon ?? {};
  const nextValues = {
    enabled: true,
    ...input.name ? { name: input.name } : {},
    ...buildTlonAccountFields(input)
  };
  if (useDefault) {
    return {
      ...cfg,
      channels: {
        ...cfg.channels,
        tlon: {
          ...base,
          ...nextValues
        }
      }
    };
  }
  return {
    ...cfg,
    channels: {
      ...cfg.channels,
      tlon: {
        ...base,
        enabled: base.enabled ?? true,
        accounts: {
          ...base.accounts,
          [accountId]: {
            ...base.accounts?.[accountId],
            ...nextValues
          }
        }
      }
    }
  };
}
async function noteTlonHelp(prompter) {
  await prompter.note(
    [
      "You need your Urbit ship URL and login code.",
      "Example URL: https://your-ship-host",
      "Example ship: ~sampel-palnet",
      "If your ship URL is on a private network (LAN/localhost), you must explicitly allow it during setup.",
      `Docs: ${formatDocsLink("/channels/tlon", "channels/tlon")}`
    ].join("\n"),
    "Tlon setup"
  );
}
function parseList(value) {
  return value.split(/[\n,;]+/g).map((entry) => entry.trim()).filter(Boolean);
}
var tlonOnboardingAdapter = {
  channel,
  getStatus: async ({ cfg }) => {
    const accountIds = listTlonAccountIds(cfg);
    const configured = accountIds.length > 0 ? accountIds.some((accountId) => isConfigured(resolveTlonAccount(cfg, accountId))) : isConfigured(resolveTlonAccount(cfg, DEFAULT_ACCOUNT_ID));
    return {
      channel,
      configured,
      statusLines: [`Tlon: ${configured ? "configured" : "needs setup"}`],
      selectionHint: configured ? "configured" : "urbit messenger",
      quickstartScore: configured ? 1 : 4
    };
  },
  configure: async ({ cfg, prompter, accountOverrides, shouldPromptAccountIds }) => {
    const override = accountOverrides[channel]?.trim();
    const defaultAccountId = DEFAULT_ACCOUNT_ID;
    let accountId = override ? normalizeAccountId(override) : defaultAccountId;
    if (shouldPromptAccountIds && !override) {
      accountId = await promptAccountId({
        cfg,
        prompter,
        label: "Tlon",
        currentId: accountId,
        listAccountIds: listTlonAccountIds,
        defaultAccountId
      });
    }
    const resolved = resolveTlonAccount(cfg, accountId);
    await noteTlonHelp(prompter);
    const ship = await prompter.text({
      message: "Ship name",
      placeholder: "~sampel-palnet",
      initialValue: resolved.ship ?? void 0,
      validate: (value) => String(value ?? "").trim() ? void 0 : "Required"
    });
    const url = await prompter.text({
      message: "Ship URL",
      placeholder: "https://your-ship-host",
      initialValue: resolved.url ?? void 0,
      validate: (value) => {
        const next2 = validateUrbitBaseUrl(String(value ?? ""));
        if (!next2.ok) {
          return next2.error;
        }
        return void 0;
      }
    });
    const validatedUrl = validateUrbitBaseUrl(String(url).trim());
    if (!validatedUrl.ok) {
      throw new Error(`Invalid URL: ${validatedUrl.error}`);
    }
    let allowPrivateNetwork = resolved.allowPrivateNetwork ?? false;
    if (isBlockedUrbitHostname(validatedUrl.hostname)) {
      allowPrivateNetwork = await prompter.confirm({
        message: "Ship URL looks like a private/internal host. Allow private network access? (SSRF risk)",
        initialValue: allowPrivateNetwork
      });
      if (!allowPrivateNetwork) {
        throw new Error("Refusing private/internal Ship URL without explicit approval");
      }
    }
    const code = await prompter.text({
      message: "Login code",
      placeholder: "lidlut-tabwed-pillex-ridrup",
      initialValue: resolved.code ?? void 0,
      validate: (value) => String(value ?? "").trim() ? void 0 : "Required"
    });
    const wantsGroupChannels = await prompter.confirm({
      message: "Add group channels manually? (optional)",
      initialValue: false
    });
    let groupChannels;
    if (wantsGroupChannels) {
      const entry = await prompter.text({
        message: "Group channels (comma-separated)",
        placeholder: "chat/~host-ship/general, chat/~host-ship/support"
      });
      const parsed = parseList(String(entry ?? ""));
      groupChannels = parsed.length > 0 ? parsed : void 0;
    }
    const wantsAllowlist = await prompter.confirm({
      message: "Restrict DMs with an allowlist?",
      initialValue: false
    });
    let dmAllowlist;
    if (wantsAllowlist) {
      const entry = await prompter.text({
        message: "DM allowlist (comma-separated ship names)",
        placeholder: "~zod, ~nec"
      });
      const parsed = parseList(String(entry ?? ""));
      dmAllowlist = parsed.length > 0 ? parsed : void 0;
    }
    const autoDiscoverChannels = await prompter.confirm({
      message: "Enable auto-discovery of group channels?",
      initialValue: resolved.autoDiscoverChannels ?? true
    });
    const next = applyAccountConfig({
      cfg,
      accountId,
      input: {
        ship: String(ship).trim(),
        url: String(url).trim(),
        code: String(code).trim(),
        allowPrivateNetwork,
        groupChannels,
        dmAllowlist,
        autoDiscoverChannels
      }
    });
    return { cfg: next, accountId };
  }
};

// vendor/openclaw-runtime/win-x64/extensions/tlon/src/urbit/upload.ts
import { uploadFile } from "@tloncorp/api";
import { fetchWithSsrFGuard as fetchWithSsrFGuard3 } from "openclaw/plugin-sdk";
async function uploadImageFromUrl(imageUrl) {
  try {
    const url = new URL(imageUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      console.warn(`[tlon] Rejected non-http(s) URL: ${imageUrl}`);
      return imageUrl;
    }
    const { response, release } = await fetchWithSsrFGuard3({
      url: imageUrl,
      init: { method: "GET" },
      policy: getDefaultSsrFPolicy(),
      auditContext: "tlon-upload-image"
    });
    try {
      if (!response.ok) {
        console.warn(`[tlon] Failed to fetch image from ${imageUrl}: ${response.status}`);
        return imageUrl;
      }
      const contentType = response.headers.get("content-type") || "image/png";
      const blob = await response.blob();
      const urlPath = new URL(imageUrl).pathname;
      const fileName = urlPath.split("/").pop() || `upload-${Date.now()}.png`;
      const result = await uploadFile({
        blob,
        fileName,
        contentType
      });
      return result.url;
    } finally {
      await release();
    }
  } catch (err) {
    console.warn(`[tlon] Failed to upload image, using original URL: ${err}`);
    return imageUrl;
  }
}

// vendor/openclaw-runtime/win-x64/extensions/tlon/src/channel.ts
async function createHttpPokeApi(params) {
  const ssrfPolicy = ssrfPolicyFromAllowPrivateNetwork(params.allowPrivateNetwork);
  const cookie = await authenticate(params.url, params.code, { ssrfPolicy });
  const channelId = `${Math.floor(Date.now() / 1e3)}-${crypto.randomUUID()}`;
  const channelPath = `/~/channel/${channelId}`;
  const shipName = params.ship.replace(/^~/, "");
  return {
    poke: async (pokeParams) => {
      const pokeId = Date.now();
      const pokeData = {
        id: pokeId,
        action: "poke",
        ship: shipName,
        app: pokeParams.app,
        mark: pokeParams.mark,
        json: pokeParams.json
      };
      const { response, release } = await urbitFetch({
        baseUrl: params.url,
        path: channelPath,
        init: {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Cookie: cookie.split(";")[0]
          },
          body: JSON.stringify([pokeData])
        },
        ssrfPolicy,
        auditContext: "tlon-poke"
      });
      try {
        if (!response.ok && response.status !== 204) {
          const errorText = await response.text();
          throw new Error(`Poke failed: ${response.status} - ${errorText}`);
        }
        return pokeId;
      } finally {
        await release();
      }
    },
    delete: async () => {
    }
  };
}
var TLON_CHANNEL_ID = "tlon";
function applyTlonSetupConfig(params) {
  const { cfg, accountId, input } = params;
  const useDefault = accountId === DEFAULT_ACCOUNT_ID2;
  const namedConfig = applyAccountNameToChannelSection({
    cfg,
    channelKey: "tlon",
    accountId,
    name: input.name
  });
  const base = namedConfig.channels?.tlon ?? {};
  const payload = buildTlonAccountFields(input);
  if (useDefault) {
    return {
      ...namedConfig,
      channels: {
        ...namedConfig.channels,
        tlon: {
          ...base,
          enabled: true,
          ...payload
        }
      }
    };
  }
  return {
    ...namedConfig,
    channels: {
      ...namedConfig.channels,
      tlon: {
        ...base,
        enabled: base.enabled ?? true,
        accounts: {
          ...base.accounts,
          [accountId]: {
            ...base.accounts?.[accountId],
            enabled: true,
            ...payload
          }
        }
      }
    }
  };
}
var tlonOutbound = {
  deliveryMode: "direct",
  textChunkLimit: 1e4,
  resolveTarget: ({ to }) => {
    const parsed = parseTlonTarget(to ?? "");
    if (!parsed) {
      return {
        ok: false,
        error: new Error(`Invalid Tlon target. Use ${formatTargetHint()}`)
      };
    }
    if (parsed.kind === "dm") {
      return { ok: true, to: parsed.ship };
    }
    return { ok: true, to: parsed.nest };
  },
  sendText: async ({ cfg, to, text, accountId, replyToId, threadId }) => {
    const account = resolveTlonAccount(cfg, accountId ?? void 0);
    if (!account.configured || !account.ship || !account.url || !account.code) {
      throw new Error("Tlon account not configured");
    }
    const parsed = parseTlonTarget(to);
    if (!parsed) {
      throw new Error(`Invalid Tlon target. Use ${formatTargetHint()}`);
    }
    const api = await createHttpPokeApi({
      url: account.url,
      ship: account.ship,
      code: account.code,
      allowPrivateNetwork: account.allowPrivateNetwork ?? void 0
    });
    try {
      const fromShip = normalizeShip(account.ship);
      if (parsed.kind === "dm") {
        return await sendDm({
          api,
          fromShip,
          toShip: parsed.ship,
          text
        });
      }
      const replyId = replyToId ?? threadId ? String(replyToId ?? threadId) : void 0;
      return await sendGroupMessage({
        api,
        fromShip,
        hostShip: parsed.hostShip,
        channelName: parsed.channelName,
        text,
        replyToId: replyId
      });
    } finally {
      try {
        await api.delete();
      } catch {
      }
    }
  },
  sendMedia: async ({ cfg, to, text, mediaUrl, accountId, replyToId, threadId }) => {
    const account = resolveTlonAccount(cfg, accountId ?? void 0);
    if (!account.configured || !account.ship || !account.url || !account.code) {
      throw new Error("Tlon account not configured");
    }
    const parsed = parseTlonTarget(to);
    if (!parsed) {
      throw new Error(`Invalid Tlon target. Use ${formatTargetHint()}`);
    }
    configureClient({
      shipUrl: account.url,
      shipName: account.ship.replace(/^~/, ""),
      verbose: false,
      getCode: async () => account.code
    });
    const uploadedUrl = mediaUrl ? await uploadImageFromUrl(mediaUrl) : void 0;
    const api = await createHttpPokeApi({
      url: account.url,
      ship: account.ship,
      code: account.code,
      allowPrivateNetwork: account.allowPrivateNetwork ?? void 0
    });
    try {
      const fromShip = normalizeShip(account.ship);
      const story = buildMediaStory(text, uploadedUrl);
      if (parsed.kind === "dm") {
        return await sendDmWithStory({
          api,
          fromShip,
          toShip: parsed.ship,
          story
        });
      }
      const replyId = replyToId ?? threadId ? String(replyToId ?? threadId) : void 0;
      return await sendGroupMessageWithStory({
        api,
        fromShip,
        hostShip: parsed.hostShip,
        channelName: parsed.channelName,
        story,
        replyToId: replyId
      });
    } finally {
      try {
        await api.delete();
      } catch {
      }
    }
  }
};
var tlonPlugin = {
  id: TLON_CHANNEL_ID,
  meta: {
    id: TLON_CHANNEL_ID,
    label: "Tlon",
    selectionLabel: "Tlon (Urbit)",
    docsPath: "/channels/tlon",
    docsLabel: "tlon",
    blurb: "Decentralized messaging on Urbit",
    aliases: ["urbit"],
    order: 90
  },
  capabilities: {
    chatTypes: ["direct", "group", "thread"],
    media: true,
    reply: true,
    threads: true
  },
  onboarding: tlonOnboardingAdapter,
  reload: { configPrefixes: ["channels.tlon"] },
  configSchema: tlonChannelConfigSchema,
  config: {
    listAccountIds: (cfg) => listTlonAccountIds(cfg),
    resolveAccount: (cfg, accountId) => resolveTlonAccount(cfg, accountId ?? void 0),
    defaultAccountId: () => "default",
    setAccountEnabled: ({ cfg, accountId, enabled }) => {
      const useDefault = !accountId || accountId === "default";
      if (useDefault) {
        return {
          ...cfg,
          channels: {
            ...cfg.channels,
            tlon: {
              ...cfg.channels?.tlon,
              enabled
            }
          }
        };
      }
      return {
        ...cfg,
        channels: {
          ...cfg.channels,
          tlon: {
            ...cfg.channels?.tlon,
            accounts: {
              ...cfg.channels?.tlon?.accounts,
              [accountId]: {
                ...cfg.channels?.tlon?.accounts?.[accountId],
                enabled
              }
            }
          }
        }
      };
    },
    deleteAccount: ({ cfg, accountId }) => {
      const useDefault = !accountId || accountId === "default";
      if (useDefault) {
        const {
          ship: _ship,
          code: _code,
          url: _url,
          name: _name,
          ...rest
        } = cfg.channels?.tlon ?? {};
        return {
          ...cfg,
          channels: {
            ...cfg.channels,
            tlon: rest
          }
        };
      }
      const { [accountId]: _removed, ...remainingAccounts } = cfg.channels?.tlon?.accounts ?? {};
      return {
        ...cfg,
        channels: {
          ...cfg.channels,
          tlon: {
            ...cfg.channels?.tlon,
            accounts: remainingAccounts
          }
        }
      };
    },
    isConfigured: (account) => account.configured,
    describeAccount: (account) => ({
      accountId: account.accountId,
      name: account.name,
      enabled: account.enabled,
      configured: account.configured,
      ship: account.ship,
      url: account.url
    })
  },
  setup: {
    resolveAccountId: ({ accountId }) => normalizeAccountId2(accountId),
    applyAccountName: ({ cfg, accountId, name }) => applyAccountNameToChannelSection({
      cfg,
      channelKey: "tlon",
      accountId,
      name
    }),
    validateInput: ({ cfg, accountId, input }) => {
      const setupInput = input;
      const resolved = resolveTlonAccount(cfg, accountId ?? void 0);
      const ship = setupInput.ship?.trim() || resolved.ship;
      const url = setupInput.url?.trim() || resolved.url;
      const code = setupInput.code?.trim() || resolved.code;
      if (!ship) {
        return "Tlon requires --ship.";
      }
      if (!url) {
        return "Tlon requires --url.";
      }
      if (!code) {
        return "Tlon requires --code.";
      }
      return null;
    },
    applyAccountConfig: ({ cfg, accountId, input }) => applyTlonSetupConfig({
      cfg,
      accountId,
      input
    })
  },
  messaging: {
    normalizeTarget: (target) => {
      const parsed = parseTlonTarget(target);
      if (!parsed) {
        return target.trim();
      }
      if (parsed.kind === "dm") {
        return parsed.ship;
      }
      return parsed.nest;
    },
    targetResolver: {
      looksLikeId: (target) => Boolean(parseTlonTarget(target)),
      hint: formatTargetHint()
    }
  },
  outbound: tlonOutbound,
  status: {
    defaultRuntime: {
      accountId: "default",
      running: false,
      lastStartAt: null,
      lastStopAt: null,
      lastError: null
    },
    collectStatusIssues: (accounts) => {
      return accounts.flatMap((account) => {
        if (!account.configured) {
          return [
            {
              channel: TLON_CHANNEL_ID,
              accountId: account.accountId,
              kind: "config",
              message: "Account not configured (missing ship, code, or url)"
            }
          ];
        }
        return [];
      });
    },
    buildChannelSummary: ({ snapshot }) => {
      const s = snapshot;
      return {
        configured: s.configured ?? false,
        ship: s.ship ?? null,
        url: s.url ?? null
      };
    },
    probeAccount: async ({ account }) => {
      if (!account.configured || !account.ship || !account.url || !account.code) {
        return { ok: false, error: "Not configured" };
      }
      try {
        const ssrfPolicy = ssrfPolicyFromAllowPrivateNetwork(account.allowPrivateNetwork);
        const cookie = await authenticate(account.url, account.code, { ssrfPolicy });
        const { response, release } = await urbitFetch({
          baseUrl: account.url,
          path: "/~/name",
          init: {
            method: "GET",
            headers: { Cookie: cookie }
          },
          ssrfPolicy,
          timeoutMs: 3e4,
          auditContext: "tlon-probe-account"
        });
        try {
          if (!response.ok) {
            return { ok: false, error: `Name request failed: ${response.status}` };
          }
          return { ok: true };
        } finally {
          await release();
        }
      } catch (error) {
        return { ok: false, error: error?.message ?? String(error) };
      }
    },
    buildAccountSnapshot: ({ account, runtime: runtime2, probe }) => {
      const snapshot = {
        accountId: account.accountId,
        name: account.name,
        enabled: account.enabled,
        configured: account.configured,
        ship: account.ship,
        url: account.url,
        running: runtime2?.running ?? false,
        lastStartAt: runtime2?.lastStartAt ?? null,
        lastStopAt: runtime2?.lastStopAt ?? null,
        lastError: runtime2?.lastError ?? null,
        probe
      };
      return snapshot;
    }
  },
  gateway: {
    startAccount: async (ctx) => {
      const account = ctx.account;
      ctx.setStatus({
        accountId: account.accountId,
        ship: account.ship,
        url: account.url
      });
      ctx.log?.info(`[${account.accountId}] starting Tlon provider for ${account.ship ?? "tlon"}`);
      return monitorTlonProvider({
        runtime: ctx.runtime,
        abortSignal: ctx.abortSignal,
        accountId: account.accountId
      });
    }
  }
};

// vendor/openclaw-runtime/win-x64/extensions/tlon/index.ts
var __dirname = dirname(fileURLToPath(import.meta.url));
var ALLOWED_TLON_COMMANDS = /* @__PURE__ */ new Set([
  "activity",
  "channels",
  "contacts",
  "groups",
  "messages",
  "dms",
  "posts",
  "notebook",
  "settings",
  "help",
  "version"
]);
function findTlonBinary() {
  const skillBin = join2(__dirname, "node_modules", ".bin", "tlon");
  console.log(`[tlon] Checking for binary at: ${skillBin}, exists: ${existsSync(skillBin)}`);
  if (existsSync(skillBin)) return skillBin;
  const platform = process.platform;
  const arch = process.arch;
  const platformPkg = `@tloncorp/tlon-skill-${platform}-${arch}`;
  const platformBin = join2(__dirname, "node_modules", platformPkg, "tlon");
  console.log(
    `[tlon] Checking for platform binary at: ${platformBin}, exists: ${existsSync(platformBin)}`
  );
  if (existsSync(platformBin)) return platformBin;
  console.log(`[tlon] Falling back to PATH lookup for 'tlon'`);
  return "tlon";
}
function shellSplit(str) {
  const args = [];
  let cur = "";
  let inDouble = false;
  let inSingle = false;
  let escape = false;
  for (const ch of str) {
    if (escape) {
      cur += ch;
      escape = false;
      continue;
    }
    if (ch === "\\" && !inSingle) {
      escape = true;
      continue;
    }
    if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
      continue;
    }
    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
      continue;
    }
    if (/\s/.test(ch) && !inDouble && !inSingle) {
      if (cur) {
        args.push(cur);
        cur = "";
      }
      continue;
    }
    cur += ch;
  }
  if (cur) args.push(cur);
  return args;
}
function runTlonCommand(binary, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, {
      env: process.env
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });
    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });
    child.on("error", (err) => {
      reject(new Error(`Failed to run tlon: ${err.message}`));
    });
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr || `tlon exited with code ${code}`));
      } else {
        resolve(stdout);
      }
    });
  });
}
var plugin = {
  id: "tlon",
  name: "Tlon",
  description: "Tlon/Urbit channel plugin",
  configSchema: emptyPluginConfigSchema(),
  register(api) {
    setTlonRuntime(api.runtime);
    api.registerChannel({ plugin: tlonPlugin });
    const tlonBinary = findTlonBinary();
    api.logger.info(`[tlon] Registering tlon tool, binary: ${tlonBinary}`);
    api.registerTool({
      name: "tlon",
      label: "Tlon CLI",
      description: "Tlon/Urbit API operations: activity, channels, contacts, groups, messages, dms, posts, notebook, settings. Examples: 'activity mentions --limit 10', 'channels groups', 'contacts self', 'groups list'",
      parameters: {
        type: "object",
        properties: {
          command: {
            type: "string",
            description: "The tlon command and arguments. Examples: 'activity mentions --limit 10', 'contacts get ~sampel-palnet', 'groups list'"
          }
        },
        required: ["command"]
      },
      async execute(_id, params) {
        try {
          const args = shellSplit(params.command);
          const subcommand = args[0];
          if (!ALLOWED_TLON_COMMANDS.has(subcommand)) {
            return {
              content: [
                {
                  type: "text",
                  text: `Error: Unknown tlon subcommand '${subcommand}'. Allowed: ${[...ALLOWED_TLON_COMMANDS].join(", ")}`
                }
              ],
              details: { error: true }
            };
          }
          const output = await runTlonCommand(tlonBinary, args);
          return {
            content: [{ type: "text", text: output }],
            details: void 0
          };
        } catch (error) {
          return {
            content: [{ type: "text", text: `Error: ${error.message}` }],
            details: { error: true }
          };
        }
      }
    });
  }
};
var tlon_default = plugin;
export {
  tlon_default as default
};
