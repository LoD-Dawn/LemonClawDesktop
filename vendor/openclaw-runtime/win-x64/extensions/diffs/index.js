// vendor/openclaw-runtime/win-x64/extensions/diffs/index.ts
import path3 from "path";
import { resolvePreferredOpenClawTmpDir } from "openclaw/plugin-sdk";

// vendor/openclaw-runtime/win-x64/extensions/diffs/src/types.ts
var DIFF_LAYOUTS = ["unified", "split"];
var DIFF_MODES = ["view", "image", "file", "both"];
var DIFF_THEMES = ["light", "dark"];
var DIFF_INDICATORS = ["bars", "classic", "none"];
var DIFF_IMAGE_QUALITY_PRESETS = ["standard", "hq", "print"];
var DIFF_OUTPUT_FORMATS = ["png", "pdf"];
var DIFF_ARTIFACT_ID_PATTERN = /^[0-9a-f]{20}$/;
var DIFF_ARTIFACT_TOKEN_PATTERN = /^[0-9a-f]{48}$/;

// vendor/openclaw-runtime/win-x64/extensions/diffs/src/config.ts
var DEFAULT_IMAGE_QUALITY_PROFILES = {
  standard: {
    scale: 2,
    maxWidth: 960,
    maxPixels: 8e6
  },
  hq: {
    scale: 2.5,
    maxWidth: 1200,
    maxPixels: 14e6
  },
  print: {
    scale: 3,
    maxWidth: 1400,
    maxPixels: 24e6
  }
};
var DEFAULT_DIFFS_TOOL_DEFAULTS = {
  fontFamily: "Fira Code",
  fontSize: 15,
  lineSpacing: 1.6,
  layout: "unified",
  showLineNumbers: true,
  diffIndicators: "bars",
  wordWrap: true,
  background: true,
  theme: "dark",
  fileFormat: "png",
  fileQuality: "standard",
  fileScale: DEFAULT_IMAGE_QUALITY_PROFILES.standard.scale,
  fileMaxWidth: DEFAULT_IMAGE_QUALITY_PROFILES.standard.maxWidth,
  mode: "both"
};
var DEFAULT_DIFFS_PLUGIN_SECURITY = {
  allowRemoteViewer: false
};
var DIFFS_PLUGIN_CONFIG_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    defaults: {
      type: "object",
      additionalProperties: false,
      properties: {
        fontFamily: { type: "string", default: DEFAULT_DIFFS_TOOL_DEFAULTS.fontFamily },
        fontSize: {
          type: "number",
          minimum: 10,
          maximum: 24,
          default: DEFAULT_DIFFS_TOOL_DEFAULTS.fontSize
        },
        lineSpacing: {
          type: "number",
          minimum: 1,
          maximum: 3,
          default: DEFAULT_DIFFS_TOOL_DEFAULTS.lineSpacing
        },
        layout: {
          type: "string",
          enum: [...DIFF_LAYOUTS],
          default: DEFAULT_DIFFS_TOOL_DEFAULTS.layout
        },
        showLineNumbers: {
          type: "boolean",
          default: DEFAULT_DIFFS_TOOL_DEFAULTS.showLineNumbers
        },
        diffIndicators: {
          type: "string",
          enum: [...DIFF_INDICATORS],
          default: DEFAULT_DIFFS_TOOL_DEFAULTS.diffIndicators
        },
        wordWrap: { type: "boolean", default: DEFAULT_DIFFS_TOOL_DEFAULTS.wordWrap },
        background: { type: "boolean", default: DEFAULT_DIFFS_TOOL_DEFAULTS.background },
        theme: {
          type: "string",
          enum: [...DIFF_THEMES],
          default: DEFAULT_DIFFS_TOOL_DEFAULTS.theme
        },
        fileFormat: {
          type: "string",
          enum: [...DIFF_OUTPUT_FORMATS],
          default: DEFAULT_DIFFS_TOOL_DEFAULTS.fileFormat
        },
        format: {
          type: "string",
          enum: [...DIFF_OUTPUT_FORMATS]
        },
        fileQuality: {
          type: "string",
          enum: [...DIFF_IMAGE_QUALITY_PRESETS],
          default: DEFAULT_DIFFS_TOOL_DEFAULTS.fileQuality
        },
        fileScale: {
          type: "number",
          minimum: 1,
          maximum: 4,
          default: DEFAULT_DIFFS_TOOL_DEFAULTS.fileScale
        },
        fileMaxWidth: {
          type: "number",
          minimum: 640,
          maximum: 2400,
          default: DEFAULT_DIFFS_TOOL_DEFAULTS.fileMaxWidth
        },
        imageFormat: {
          type: "string",
          enum: [...DIFF_OUTPUT_FORMATS]
        },
        imageQuality: {
          type: "string",
          enum: [...DIFF_IMAGE_QUALITY_PRESETS]
        },
        imageScale: {
          type: "number",
          minimum: 1,
          maximum: 4
        },
        imageMaxWidth: {
          type: "number",
          minimum: 640,
          maximum: 2400
        },
        mode: {
          type: "string",
          enum: [...DIFF_MODES],
          default: DEFAULT_DIFFS_TOOL_DEFAULTS.mode
        }
      }
    },
    security: {
      type: "object",
      additionalProperties: false,
      properties: {
        allowRemoteViewer: {
          type: "boolean",
          default: DEFAULT_DIFFS_PLUGIN_SECURITY.allowRemoteViewer
        }
      }
    }
  }
};
var diffsPluginConfigSchema = {
  safeParse(value) {
    if (value === void 0) {
      return { success: true, data: void 0 };
    }
    try {
      return { success: true, data: resolveDiffsPluginDefaults(value) };
    } catch (error) {
      return {
        success: false,
        error: {
          issues: [{ path: [], message: error instanceof Error ? error.message : String(error) }]
        }
      };
    }
  },
  jsonSchema: DIFFS_PLUGIN_CONFIG_JSON_SCHEMA
};
function resolveDiffsPluginDefaults(config) {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return { ...DEFAULT_DIFFS_TOOL_DEFAULTS };
  }
  const defaults = config.defaults;
  if (!defaults || typeof defaults !== "object" || Array.isArray(defaults)) {
    return { ...DEFAULT_DIFFS_TOOL_DEFAULTS };
  }
  const fileQuality = normalizeFileQuality(defaults.fileQuality ?? defaults.imageQuality);
  const profile = DEFAULT_IMAGE_QUALITY_PROFILES[fileQuality];
  return {
    fontFamily: normalizeFontFamily(defaults.fontFamily),
    fontSize: normalizeFontSize(defaults.fontSize),
    lineSpacing: normalizeLineSpacing(defaults.lineSpacing),
    layout: normalizeLayout(defaults.layout),
    showLineNumbers: defaults.showLineNumbers !== false,
    diffIndicators: normalizeDiffIndicators(defaults.diffIndicators),
    wordWrap: defaults.wordWrap !== false,
    background: defaults.background !== false,
    theme: normalizeTheme(defaults.theme),
    fileFormat: normalizeFileFormat(defaults.fileFormat ?? defaults.imageFormat ?? defaults.format),
    fileQuality,
    fileScale: normalizeFileScale(defaults.fileScale ?? defaults.imageScale, profile.scale),
    fileMaxWidth: normalizeFileMaxWidth(
      defaults.fileMaxWidth ?? defaults.imageMaxWidth,
      profile.maxWidth
    ),
    mode: normalizeMode(defaults.mode)
  };
}
function resolveDiffsPluginSecurity(config) {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return { ...DEFAULT_DIFFS_PLUGIN_SECURITY };
  }
  const security = config.security;
  if (!security || typeof security !== "object" || Array.isArray(security)) {
    return { ...DEFAULT_DIFFS_PLUGIN_SECURITY };
  }
  return {
    allowRemoteViewer: security.allowRemoteViewer === true
  };
}
function normalizeFontFamily(fontFamily) {
  const normalized = fontFamily?.trim();
  return normalized || DEFAULT_DIFFS_TOOL_DEFAULTS.fontFamily;
}
function normalizeFontSize(fontSize) {
  if (fontSize === void 0 || !Number.isFinite(fontSize)) {
    return DEFAULT_DIFFS_TOOL_DEFAULTS.fontSize;
  }
  const rounded = Math.floor(fontSize);
  return Math.min(Math.max(rounded, 10), 24);
}
function normalizeLineSpacing(lineSpacing) {
  if (lineSpacing === void 0 || !Number.isFinite(lineSpacing)) {
    return DEFAULT_DIFFS_TOOL_DEFAULTS.lineSpacing;
  }
  return Math.min(Math.max(lineSpacing, 1), 3);
}
function normalizeLayout(layout) {
  return layout && DIFF_LAYOUTS.includes(layout) ? layout : DEFAULT_DIFFS_TOOL_DEFAULTS.layout;
}
function normalizeDiffIndicators(diffIndicators) {
  return diffIndicators && DIFF_INDICATORS.includes(diffIndicators) ? diffIndicators : DEFAULT_DIFFS_TOOL_DEFAULTS.diffIndicators;
}
function normalizeTheme(theme) {
  return theme && DIFF_THEMES.includes(theme) ? theme : DEFAULT_DIFFS_TOOL_DEFAULTS.theme;
}
function normalizeFileFormat(fileFormat) {
  return fileFormat && DIFF_OUTPUT_FORMATS.includes(fileFormat) ? fileFormat : DEFAULT_DIFFS_TOOL_DEFAULTS.fileFormat;
}
function normalizeFileQuality(fileQuality) {
  return fileQuality && DIFF_IMAGE_QUALITY_PRESETS.includes(fileQuality) ? fileQuality : DEFAULT_DIFFS_TOOL_DEFAULTS.fileQuality;
}
function normalizeFileScale(fileScale, fallback) {
  if (fileScale === void 0 || !Number.isFinite(fileScale)) {
    return fallback;
  }
  const rounded = Math.round(fileScale * 100) / 100;
  return Math.min(Math.max(rounded, 1), 4);
}
function normalizeFileMaxWidth(fileMaxWidth, fallback) {
  if (fileMaxWidth === void 0 || !Number.isFinite(fileMaxWidth)) {
    return fallback;
  }
  const rounded = Math.round(fileMaxWidth);
  return Math.min(Math.max(rounded, 640), 2400);
}
function normalizeMode(mode) {
  return mode && DIFF_MODES.includes(mode) ? mode : DEFAULT_DIFFS_TOOL_DEFAULTS.mode;
}
function resolveDiffImageRenderOptions(params) {
  const format = normalizeFileFormat(
    params.fileFormat ?? params.imageFormat ?? params.format ?? params.defaults.fileFormat
  );
  const qualityOverrideProvided = params.fileQuality !== void 0 || params.imageQuality !== void 0;
  const qualityPreset = normalizeFileQuality(
    params.fileQuality ?? params.imageQuality ?? params.defaults.fileQuality
  );
  const profile = DEFAULT_IMAGE_QUALITY_PROFILES[qualityPreset];
  const scale = normalizeFileScale(
    params.fileScale ?? params.imageScale,
    qualityOverrideProvided ? profile.scale : params.defaults.fileScale
  );
  const maxWidth = normalizeFileMaxWidth(
    params.fileMaxWidth ?? params.imageMaxWidth,
    qualityOverrideProvided ? profile.maxWidth : params.defaults.fileMaxWidth
  );
  return {
    format,
    qualityPreset,
    scale,
    maxWidth,
    maxPixels: profile.maxPixels
  };
}

// vendor/openclaw-runtime/win-x64/extensions/diffs/src/viewer-assets.ts
import crypto from "crypto";
import fs from "fs/promises";
import { fileURLToPath } from "url";
var VIEWER_ASSET_PREFIX = "/plugins/diffs/assets/";
var VIEWER_LOADER_PATH = `${VIEWER_ASSET_PREFIX}viewer.js`;
var VIEWER_RUNTIME_PATH = `${VIEWER_ASSET_PREFIX}viewer-runtime.js`;
var VIEWER_RUNTIME_FILE_URL = new URL("../assets/viewer-runtime.js", import.meta.url);
var runtimeAssetCache = null;
async function getServedViewerAsset(pathname) {
  if (pathname !== VIEWER_LOADER_PATH && pathname !== VIEWER_RUNTIME_PATH) {
    return null;
  }
  const assets = await loadViewerAssets();
  if (pathname === VIEWER_LOADER_PATH) {
    return {
      body: assets.loaderBody,
      contentType: "text/javascript; charset=utf-8"
    };
  }
  if (pathname === VIEWER_RUNTIME_PATH) {
    return {
      body: assets.runtimeBody,
      contentType: "text/javascript; charset=utf-8"
    };
  }
  return null;
}
async function loadViewerAssets() {
  const runtimePath = fileURLToPath(VIEWER_RUNTIME_FILE_URL);
  const runtimeStat = await fs.stat(runtimePath);
  if (runtimeAssetCache && runtimeAssetCache.mtimeMs === runtimeStat.mtimeMs) {
    return runtimeAssetCache;
  }
  const runtimeBody = await fs.readFile(runtimePath);
  const hash = crypto.createHash("sha1").update(runtimeBody).digest("hex").slice(0, 12);
  runtimeAssetCache = {
    mtimeMs: runtimeStat.mtimeMs,
    runtimeBody,
    loaderBody: `import "${VIEWER_RUNTIME_PATH}?v=${hash}";
`
  };
  return runtimeAssetCache;
}

// vendor/openclaw-runtime/win-x64/extensions/diffs/src/http.ts
var VIEW_PREFIX = "/plugins/diffs/view/";
var VIEWER_MAX_FAILURES_PER_WINDOW = 40;
var VIEWER_FAILURE_WINDOW_MS = 6e4;
var VIEWER_LOCKOUT_MS = 6e4;
var VIEWER_LIMITER_MAX_KEYS = 2048;
var VIEWER_CONTENT_SECURITY_POLICY = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'none'",
  "base-uri 'none'",
  "frame-ancestors 'self'",
  "object-src 'none'"
].join("; ");
function createDiffsHttpHandler(params) {
  const viewerFailureLimiter = new ViewerFailureLimiter();
  return async (req, res) => {
    const parsed = parseRequestUrl(req.url);
    if (!parsed) {
      return false;
    }
    if (parsed.pathname.startsWith(VIEWER_ASSET_PREFIX)) {
      return await serveAsset(req, res, parsed.pathname, params.logger);
    }
    if (!parsed.pathname.startsWith(VIEW_PREFIX)) {
      return false;
    }
    const remoteKey = normalizeRemoteClientKey(req.socket?.remoteAddress);
    const localRequest = isLoopbackClientIp(remoteKey);
    if (!localRequest && params.allowRemoteViewer !== true) {
      respondText(res, 404, "Diff not found");
      return true;
    }
    if (req.method !== "GET" && req.method !== "HEAD") {
      respondText(res, 405, "Method not allowed");
      return true;
    }
    if (!localRequest) {
      const throttled = viewerFailureLimiter.check(remoteKey);
      if (!throttled.allowed) {
        res.statusCode = 429;
        setSharedHeaders(res, "text/plain; charset=utf-8");
        res.setHeader("Retry-After", String(Math.max(1, Math.ceil(throttled.retryAfterMs / 1e3))));
        res.end("Too Many Requests");
        return true;
      }
    }
    const pathParts = parsed.pathname.split("/").filter(Boolean);
    const id = pathParts[3];
    const token = pathParts[4];
    if (!id || !token || !DIFF_ARTIFACT_ID_PATTERN.test(id) || !DIFF_ARTIFACT_TOKEN_PATTERN.test(token)) {
      if (!localRequest) {
        viewerFailureLimiter.recordFailure(remoteKey);
      }
      respondText(res, 404, "Diff not found");
      return true;
    }
    const artifact = await params.store.getArtifact(id, token);
    if (!artifact) {
      if (!localRequest) {
        viewerFailureLimiter.recordFailure(remoteKey);
      }
      respondText(res, 404, "Diff not found or expired");
      return true;
    }
    try {
      const html = await params.store.readHtml(id);
      if (!localRequest) {
        viewerFailureLimiter.reset(remoteKey);
      }
      res.statusCode = 200;
      setSharedHeaders(res, "text/html; charset=utf-8");
      res.setHeader("content-security-policy", VIEWER_CONTENT_SECURITY_POLICY);
      if (req.method === "HEAD") {
        res.end();
      } else {
        res.end(html);
      }
      return true;
    } catch (error) {
      if (!localRequest) {
        viewerFailureLimiter.recordFailure(remoteKey);
      }
      params.logger?.warn(`Failed to serve diff artifact ${id}: ${String(error)}`);
      respondText(res, 500, "Failed to load diff");
      return true;
    }
  };
}
function parseRequestUrl(rawUrl) {
  if (!rawUrl) {
    return null;
  }
  try {
    return new URL(rawUrl, "http://127.0.0.1");
  } catch {
    return null;
  }
}
async function serveAsset(req, res, pathname, logger) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    respondText(res, 405, "Method not allowed");
    return true;
  }
  try {
    const asset = await getServedViewerAsset(pathname);
    if (!asset) {
      respondText(res, 404, "Asset not found");
      return true;
    }
    res.statusCode = 200;
    setSharedHeaders(res, asset.contentType);
    if (req.method === "HEAD") {
      res.end();
    } else {
      res.end(asset.body);
    }
    return true;
  } catch (error) {
    logger?.warn(`Failed to serve diffs asset ${pathname}: ${String(error)}`);
    respondText(res, 500, "Failed to load asset");
    return true;
  }
}
function respondText(res, statusCode, body) {
  res.statusCode = statusCode;
  setSharedHeaders(res, "text/plain; charset=utf-8");
  res.end(body);
}
function setSharedHeaders(res, contentType) {
  res.setHeader("cache-control", "no-store, max-age=0");
  res.setHeader("content-type", contentType);
  res.setHeader("x-content-type-options", "nosniff");
  res.setHeader("referrer-policy", "no-referrer");
}
function normalizeRemoteClientKey(remoteAddress) {
  const normalized = remoteAddress?.trim().toLowerCase();
  if (!normalized) {
    return "unknown";
  }
  return normalized.startsWith("::ffff:") ? normalized.slice("::ffff:".length) : normalized;
}
function isLoopbackClientIp(clientIp) {
  return clientIp === "127.0.0.1" || clientIp === "::1";
}
var ViewerFailureLimiter = class {
  failures = /* @__PURE__ */ new Map();
  check(key) {
    this.prune();
    const state = this.failures.get(key);
    if (!state) {
      return { allowed: true, retryAfterMs: 0 };
    }
    const now = Date.now();
    if (state.lockUntilMs > now) {
      return { allowed: false, retryAfterMs: state.lockUntilMs - now };
    }
    if (now - state.windowStartMs >= VIEWER_FAILURE_WINDOW_MS) {
      this.failures.delete(key);
      return { allowed: true, retryAfterMs: 0 };
    }
    return { allowed: true, retryAfterMs: 0 };
  }
  recordFailure(key) {
    this.prune();
    const now = Date.now();
    const current = this.failures.get(key);
    const next = !current || now - current.windowStartMs >= VIEWER_FAILURE_WINDOW_MS ? {
      windowStartMs: now,
      failures: 1,
      lockUntilMs: 0
    } : {
      ...current,
      failures: current.failures + 1
    };
    if (next.failures >= VIEWER_MAX_FAILURES_PER_WINDOW) {
      next.lockUntilMs = now + VIEWER_LOCKOUT_MS;
    }
    this.failures.set(key, next);
  }
  reset(key) {
    this.failures.delete(key);
  }
  prune() {
    if (this.failures.size < VIEWER_LIMITER_MAX_KEYS) {
      return;
    }
    const now = Date.now();
    for (const [key, state] of this.failures) {
      if (state.lockUntilMs <= now && now - state.windowStartMs >= VIEWER_FAILURE_WINDOW_MS) {
        this.failures.delete(key);
      }
      if (this.failures.size < VIEWER_LIMITER_MAX_KEYS) {
        return;
      }
    }
    if (this.failures.size >= VIEWER_LIMITER_MAX_KEYS) {
      this.failures.clear();
    }
  }
};

// vendor/openclaw-runtime/win-x64/extensions/diffs/src/prompt-guidance.ts
var DIFFS_AGENT_GUIDANCE = [
  "When you need to show edits as a real diff, prefer the `diffs` tool instead of writing a manual summary.",
  "The `diffs` tool accepts either `before` + `after` text, or a unified `patch` string.",
  "Use `mode=view` when you want an interactive gateway-hosted viewer. After the tool returns, use `details.viewerUrl` with the canvas tool via `canvas present` or `canvas navigate`.",
  "Use `mode=file` when you need a rendered file artifact. Set `fileFormat=png` (default) or `fileFormat=pdf`. The tool result includes `details.filePath`.",
  "For large or high-fidelity files, use `fileQuality` (`standard`|`hq`|`print`) and optionally override `fileScale`/`fileMaxWidth`.",
  "When you need to deliver the rendered file to a user or channel, do not rely on the raw tool-result renderer. Instead, call the `message` tool and pass `details.filePath` through `path` or `filePath`.",
  "Use `mode=both` when you want both the gateway viewer URL and the rendered artifact.",
  "If the user has configured diffs plugin defaults, prefer omitting `mode`, `theme`, `layout`, and related presentation options unless you need to override them for this specific diff.",
  "Include `path` for before/after text when you know the file name."
].join("\n");

// vendor/openclaw-runtime/win-x64/extensions/diffs/src/store.ts
import crypto2 from "crypto";
import fs2 from "fs/promises";
import path from "path";
var DEFAULT_TTL_MS = 30 * 60 * 1e3;
var MAX_TTL_MS = 6 * 60 * 60 * 1e3;
var SWEEP_FALLBACK_AGE_MS = 24 * 60 * 60 * 1e3;
var DEFAULT_CLEANUP_INTERVAL_MS = 5 * 60 * 1e3;
var VIEWER_PREFIX = "/plugins/diffs/view";
var DiffArtifactStore = class {
  rootDir;
  logger;
  cleanupIntervalMs;
  cleanupInFlight = null;
  nextCleanupAt = 0;
  constructor(params) {
    this.rootDir = path.resolve(params.rootDir);
    this.logger = params.logger;
    this.cleanupIntervalMs = params.cleanupIntervalMs === void 0 ? DEFAULT_CLEANUP_INTERVAL_MS : Math.max(0, Math.floor(params.cleanupIntervalMs));
  }
  async createArtifact(params) {
    await this.ensureRoot();
    const id = crypto2.randomBytes(10).toString("hex");
    const token = crypto2.randomBytes(24).toString("hex");
    const artifactDir = this.artifactDir(id);
    const htmlPath = path.join(artifactDir, "viewer.html");
    const ttlMs = normalizeTtlMs(params.ttlMs);
    const createdAt = /* @__PURE__ */ new Date();
    const expiresAt = new Date(createdAt.getTime() + ttlMs);
    const meta = {
      id,
      token,
      title: params.title,
      inputKind: params.inputKind,
      fileCount: params.fileCount,
      createdAt: createdAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      viewerPath: `${VIEWER_PREFIX}/${id}/${token}`,
      htmlPath
    };
    await fs2.mkdir(artifactDir, { recursive: true });
    await fs2.writeFile(htmlPath, params.html, "utf8");
    await this.writeMeta(meta);
    this.scheduleCleanup();
    return meta;
  }
  async getArtifact(id, token) {
    const meta = await this.readMeta(id);
    if (!meta) {
      return null;
    }
    if (meta.token !== token) {
      return null;
    }
    if (isExpired(meta)) {
      await this.deleteArtifact(id);
      return null;
    }
    return meta;
  }
  async readHtml(id) {
    const meta = await this.readMeta(id);
    if (!meta) {
      throw new Error(`Diff artifact not found: ${id}`);
    }
    const htmlPath = this.normalizeStoredPath(meta.htmlPath, "htmlPath");
    return await fs2.readFile(htmlPath, "utf8");
  }
  async updateFilePath(id, filePath) {
    const meta = await this.readMeta(id);
    if (!meta) {
      throw new Error(`Diff artifact not found: ${id}`);
    }
    const normalizedFilePath = this.normalizeStoredPath(filePath, "filePath");
    const next = {
      ...meta,
      filePath: normalizedFilePath,
      imagePath: normalizedFilePath
    };
    await this.writeMeta(next);
    return next;
  }
  async updateImagePath(id, imagePath) {
    return this.updateFilePath(id, imagePath);
  }
  allocateFilePath(id, format = "png") {
    return path.join(this.artifactDir(id), `preview.${format}`);
  }
  async createStandaloneFileArtifact(params = {}) {
    await this.ensureRoot();
    const id = crypto2.randomBytes(10).toString("hex");
    const artifactDir = this.artifactDir(id);
    const format = params.format ?? "png";
    const filePath = path.join(artifactDir, `preview.${format}`);
    const ttlMs = normalizeTtlMs(params.ttlMs);
    const createdAt = /* @__PURE__ */ new Date();
    const expiresAt = new Date(createdAt.getTime() + ttlMs).toISOString();
    const meta = {
      kind: "standalone_file",
      id,
      createdAt: createdAt.toISOString(),
      expiresAt,
      filePath: this.normalizeStoredPath(filePath, "filePath")
    };
    await fs2.mkdir(artifactDir, { recursive: true });
    await this.writeStandaloneMeta(meta);
    this.scheduleCleanup();
    return {
      id,
      filePath: meta.filePath,
      expiresAt: meta.expiresAt
    };
  }
  allocateImagePath(id, format = "png") {
    return this.allocateFilePath(id, format);
  }
  scheduleCleanup() {
    this.maybeCleanupExpired();
  }
  async cleanupExpired() {
    await this.ensureRoot();
    const entries = await fs2.readdir(this.rootDir, { withFileTypes: true }).catch(() => []);
    const now = Date.now();
    await Promise.all(
      entries.filter((entry) => entry.isDirectory()).map(async (entry) => {
        const id = entry.name;
        const meta = await this.readMeta(id);
        if (meta) {
          if (isExpired(meta)) {
            await this.deleteArtifact(id);
          }
          return;
        }
        const standaloneMeta = await this.readStandaloneMeta(id);
        if (standaloneMeta) {
          if (isExpired(standaloneMeta)) {
            await this.deleteArtifact(id);
          }
          return;
        }
        const artifactPath = this.artifactDir(id);
        const stat = await fs2.stat(artifactPath).catch(() => null);
        if (!stat) {
          return;
        }
        if (now - stat.mtimeMs > SWEEP_FALLBACK_AGE_MS) {
          await this.deleteArtifact(id);
        }
      })
    );
  }
  async ensureRoot() {
    await fs2.mkdir(this.rootDir, { recursive: true });
  }
  maybeCleanupExpired() {
    const now = Date.now();
    if (this.cleanupInFlight || now < this.nextCleanupAt) {
      return;
    }
    this.nextCleanupAt = now + this.cleanupIntervalMs;
    const cleanupPromise = this.cleanupExpired().catch((error) => {
      this.nextCleanupAt = 0;
      this.logger?.warn(`Failed to clean expired diff artifacts: ${String(error)}`);
    }).finally(() => {
      if (this.cleanupInFlight === cleanupPromise) {
        this.cleanupInFlight = null;
      }
    });
    this.cleanupInFlight = cleanupPromise;
  }
  artifactDir(id) {
    return this.resolveWithinRoot(id);
  }
  async writeMeta(meta) {
    await this.writeJsonMeta(meta.id, "meta.json", meta);
  }
  async readMeta(id) {
    const parsed = await this.readJsonMeta(id, "meta.json", "diff artifact");
    if (!parsed) {
      return null;
    }
    return parsed;
  }
  async writeStandaloneMeta(meta) {
    await this.writeJsonMeta(meta.id, "file-meta.json", meta);
  }
  async readStandaloneMeta(id) {
    const parsed = await this.readJsonMeta(id, "file-meta.json", "standalone diff");
    if (!parsed) {
      return null;
    }
    try {
      const value = parsed;
      if (value.kind !== "standalone_file" || typeof value.id !== "string" || typeof value.createdAt !== "string" || typeof value.expiresAt !== "string" || typeof value.filePath !== "string") {
        return null;
      }
      return {
        kind: value.kind,
        id: value.id,
        createdAt: value.createdAt,
        expiresAt: value.expiresAt,
        filePath: this.normalizeStoredPath(value.filePath, "filePath")
      };
    } catch (error) {
      this.logger?.warn(`Failed to normalize standalone diff metadata for ${id}: ${String(error)}`);
      return null;
    }
  }
  metaFilePath(id, fileName) {
    return path.join(this.artifactDir(id), fileName);
  }
  async writeJsonMeta(id, fileName, data) {
    await fs2.writeFile(this.metaFilePath(id, fileName), JSON.stringify(data, null, 2), "utf8");
  }
  async readJsonMeta(id, fileName, context) {
    try {
      const raw = await fs2.readFile(this.metaFilePath(id, fileName), "utf8");
      return JSON.parse(raw);
    } catch (error) {
      if (isFileNotFound(error)) {
        return null;
      }
      this.logger?.warn(`Failed to read ${context} metadata for ${id}: ${String(error)}`);
      return null;
    }
  }
  async deleteArtifact(id) {
    await fs2.rm(this.artifactDir(id), { recursive: true, force: true }).catch(() => {
    });
  }
  resolveWithinRoot(...parts) {
    const candidate = path.resolve(this.rootDir, ...parts);
    this.assertWithinRoot(candidate);
    return candidate;
  }
  normalizeStoredPath(rawPath, label) {
    const candidate = path.isAbsolute(rawPath) ? path.resolve(rawPath) : path.resolve(this.rootDir, rawPath);
    this.assertWithinRoot(candidate, label);
    return candidate;
  }
  assertWithinRoot(candidate, label = "path") {
    const relative = path.relative(this.rootDir, candidate);
    if (relative === "" || !relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative)) {
      return;
    }
    throw new Error(`Diff artifact ${label} escapes store root: ${candidate}`);
  }
};
function normalizeTtlMs(value) {
  if (!Number.isFinite(value) || value === void 0) {
    return DEFAULT_TTL_MS;
  }
  const rounded = Math.floor(value);
  if (rounded <= 0) {
    return DEFAULT_TTL_MS;
  }
  return Math.min(rounded, MAX_TTL_MS);
}
function isExpired(meta) {
  const expiresAt = Date.parse(meta.expiresAt);
  if (!Number.isFinite(expiresAt)) {
    return true;
  }
  return Date.now() >= expiresAt;
}
function isFileNotFound(error) {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

// vendor/openclaw-runtime/win-x64/extensions/diffs/src/tool.ts
import fs4 from "fs/promises";
import { Type } from "@sinclair/typebox";

// vendor/openclaw-runtime/win-x64/extensions/diffs/src/browser.ts
import { constants as fsConstants } from "fs";
import fs3 from "fs/promises";
import path2 from "path";
import { chromium } from "playwright-core";
var DEFAULT_BROWSER_IDLE_MS = 3e4;
var SHARED_BROWSER_KEY = "__default__";
var IMAGE_SIZE_LIMIT_ERROR = "Diff frame did not render within image size limits.";
var PDF_REFERENCE_PAGE_HEIGHT_PX = 1056;
var MAX_PDF_PAGES = 50;
var sharedBrowserState = null;
var executablePathCache = null;
var PlaywrightDiffScreenshotter = class {
  config;
  browserIdleMs;
  constructor(params) {
    this.config = params.config;
    this.browserIdleMs = params.browserIdleMs ?? DEFAULT_BROWSER_IDLE_MS;
  }
  async screenshotHtml(params) {
    await fs3.mkdir(path2.dirname(params.outputPath), { recursive: true });
    const lease = await acquireSharedBrowser({
      config: this.config,
      idleMs: this.browserIdleMs
    });
    let page;
    let currentScale = params.image.scale;
    const maxRetries = 2;
    try {
      for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
        page = await lease.browser.newPage({
          viewport: {
            width: Math.max(Math.ceil(params.image.maxWidth + 240), 1200),
            height: 900
          },
          deviceScaleFactor: currentScale,
          colorScheme: params.theme
        });
        await page.route("**/*", async (route) => {
          const requestUrl = route.request().url();
          if (requestUrl === "about:blank" || requestUrl.startsWith("data:")) {
            await route.continue();
            return;
          }
          let parsed;
          try {
            parsed = new URL(requestUrl);
          } catch {
            await route.abort();
            return;
          }
          if (parsed.protocol !== "http:" || parsed.hostname !== "127.0.0.1") {
            await route.abort();
            return;
          }
          if (!parsed.pathname.startsWith(VIEWER_ASSET_PREFIX)) {
            await route.abort();
            return;
          }
          const pathname = parsed.pathname;
          const asset = await getServedViewerAsset(pathname);
          if (!asset) {
            await route.abort();
            return;
          }
          await route.fulfill({
            status: 200,
            contentType: asset.contentType,
            body: asset.body
          });
        });
        await page.setContent(injectBaseHref(params.html), { waitUntil: "load" });
        await page.waitForFunction(
          () => {
            if (document.documentElement.dataset.openclawDiffsReady === "true") {
              return true;
            }
            return [...document.querySelectorAll("[data-openclaw-diff-host]")].every((element) => {
              return element instanceof HTMLElement && element.shadowRoot?.querySelector("[data-diffs]");
            });
          },
          {
            timeout: 1e4
          }
        );
        await page.evaluate(async () => {
          await document.fonts.ready;
        });
        await page.evaluate(() => {
          const frame2 = document.querySelector(".oc-frame");
          if (frame2 instanceof HTMLElement) {
            frame2.dataset.renderMode = "image";
          }
        });
        const frame = page.locator(".oc-frame");
        await frame.waitFor();
        const initialBox = await frame.boundingBox();
        if (!initialBox) {
          throw new Error("Diff frame did not render.");
        }
        const isPdf = params.image.format === "pdf";
        const padding = isPdf ? 0 : 20;
        const clipWidth = Math.ceil(initialBox.width + padding * 2);
        const clipHeight = Math.ceil(Math.max(initialBox.height + padding * 2, 320));
        await page.setViewportSize({
          width: Math.max(clipWidth + padding, 900),
          height: Math.max(clipHeight + padding, 700)
        });
        const box = await frame.boundingBox();
        if (!box) {
          throw new Error("Diff frame was lost after resizing.");
        }
        if (isPdf) {
          await page.emulateMedia({ media: "screen" });
          await page.evaluate(() => {
            const html = document.documentElement;
            const body = document.body;
            const frame2 = document.querySelector(".oc-frame");
            html.style.background = "transparent";
            body.style.margin = "0";
            body.style.padding = "0";
            body.style.background = "transparent";
            body.style.setProperty("-webkit-print-color-adjust", "exact");
            if (frame2 instanceof HTMLElement) {
              frame2.style.margin = "0";
            }
          });
          const pdfBox = await frame.boundingBox();
          if (!pdfBox) {
            throw new Error("Diff frame was lost before PDF render.");
          }
          const pdfWidth = Math.max(Math.ceil(pdfBox.width), 1);
          const pdfHeight = Math.max(Math.ceil(pdfBox.height), 1);
          const estimatedPixels2 = pdfWidth * pdfHeight;
          const estimatedPages = Math.ceil(pdfHeight / PDF_REFERENCE_PAGE_HEIGHT_PX);
          if (estimatedPixels2 > params.image.maxPixels || estimatedPages > MAX_PDF_PAGES) {
            throw new Error(IMAGE_SIZE_LIMIT_ERROR);
          }
          await page.pdf({
            path: params.outputPath,
            width: `${pdfWidth}px`,
            height: `${pdfHeight}px`,
            printBackground: true,
            margin: {
              top: "0",
              right: "0",
              bottom: "0",
              left: "0"
            }
          });
          return params.outputPath;
        }
        const dpr = await page.evaluate(() => window.devicePixelRatio || 1);
        const rawX = Math.max(box.x - padding, 0);
        const rawY = Math.max(box.y - padding, 0);
        const rawRight = rawX + clipWidth;
        const rawBottom = rawY + clipHeight;
        const x = Math.floor(rawX * dpr) / dpr;
        const y = Math.floor(rawY * dpr) / dpr;
        const right = Math.ceil(rawRight * dpr) / dpr;
        const bottom = Math.ceil(rawBottom * dpr) / dpr;
        const cssWidth = Math.max(right - x, 1);
        const cssHeight = Math.max(bottom - y, 1);
        const estimatedPixels = cssWidth * cssHeight * dpr * dpr;
        if (estimatedPixels > params.image.maxPixels) {
          if (currentScale > 1) {
            const maxScaleForPixels = Math.sqrt(params.image.maxPixels / (cssWidth * cssHeight));
            const reducedScale = Math.max(
              1,
              Math.round(Math.min(currentScale, maxScaleForPixels) * 100) / 100
            );
            if (reducedScale < currentScale - 0.01 && attempt < maxRetries) {
              await page.close().catch(() => {
              });
              page = void 0;
              currentScale = reducedScale;
              continue;
            }
          }
          throw new Error(IMAGE_SIZE_LIMIT_ERROR);
        }
        await page.screenshot({
          path: params.outputPath,
          type: "png",
          scale: "device",
          clip: {
            x,
            y,
            width: cssWidth,
            height: cssHeight
          }
        });
        return params.outputPath;
      }
      throw new Error(IMAGE_SIZE_LIMIT_ERROR);
    } catch (error) {
      if (error instanceof Error && error.message === IMAGE_SIZE_LIMIT_ERROR) {
        throw error;
      }
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Diff PNG/PDF rendering requires a Chromium-compatible browser. Set browser.executablePath or install Chrome/Chromium. ${reason}`
      );
    } finally {
      await page?.close().catch(() => {
      });
      await lease.release();
    }
  }
};
function injectBaseHref(html) {
  if (html.includes("<base ")) {
    return html;
  }
  return html.replace("<head>", '<head><base href="http://127.0.0.1/" />');
}
async function resolveBrowserExecutablePath(config) {
  const cacheKey = JSON.stringify({
    configPath: config.browser?.executablePath?.trim() || "",
    env: [
      process.env.OPENCLAW_BROWSER_EXECUTABLE_PATH ?? "",
      process.env.BROWSER_EXECUTABLE_PATH ?? "",
      process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? ""
    ],
    path: process.env.PATH ?? ""
  });
  if (executablePathCache?.key === cacheKey) {
    return await executablePathCache.valuePromise;
  }
  const valuePromise = resolveBrowserExecutablePathUncached(config).catch((error) => {
    if (executablePathCache?.valuePromise === valuePromise) {
      executablePathCache = null;
    }
    throw error;
  });
  executablePathCache = {
    key: cacheKey,
    valuePromise
  };
  return await valuePromise;
}
async function resolveBrowserExecutablePathUncached(config) {
  const configPath = config.browser?.executablePath?.trim();
  if (configPath) {
    await assertExecutable(configPath, "browser.executablePath");
    return configPath;
  }
  const envCandidates = [
    process.env.OPENCLAW_BROWSER_EXECUTABLE_PATH,
    process.env.BROWSER_EXECUTABLE_PATH,
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
  ].map((value) => value?.trim()).filter((value) => Boolean(value));
  for (const candidate of envCandidates) {
    if (await isExecutable(candidate)) {
      return candidate;
    }
  }
  for (const candidate of await collectExecutableCandidates()) {
    if (await isExecutable(candidate)) {
      return candidate;
    }
  }
  return void 0;
}
async function acquireSharedBrowser(params) {
  const executablePath = await resolveBrowserExecutablePath(params.config);
  const desiredKey = executablePath || SHARED_BROWSER_KEY;
  if (sharedBrowserState && sharedBrowserState.key !== desiredKey) {
    await closeSharedBrowser();
  }
  if (!sharedBrowserState) {
    const browserPromise = chromium.launch({
      headless: true,
      ...executablePath ? { executablePath } : {},
      args: ["--disable-dev-shm-usage"]
    }).then((browser2) => {
      if (sharedBrowserState?.browserPromise === browserPromise) {
        sharedBrowserState.browser = browser2;
        browser2.on("disconnected", () => {
          if (sharedBrowserState?.browser === browser2) {
            clearIdleTimer(sharedBrowserState);
            sharedBrowserState = null;
          }
        });
      }
      return browser2;
    }).catch((error) => {
      if (sharedBrowserState?.browserPromise === browserPromise) {
        sharedBrowserState = null;
      }
      throw error;
    });
    sharedBrowserState = {
      browserPromise,
      idleTimer: null,
      key: desiredKey,
      users: 0
    };
  }
  clearIdleTimer(sharedBrowserState);
  const state = sharedBrowserState;
  const browser = await state.browserPromise;
  state.users += 1;
  let released = false;
  return {
    browser,
    release: async () => {
      if (released) {
        return;
      }
      released = true;
      state.users = Math.max(0, state.users - 1);
      if (state.users === 0) {
        scheduleIdleBrowserClose(state, params.idleMs);
      }
    }
  };
}
function scheduleIdleBrowserClose(state, idleMs) {
  clearIdleTimer(state);
  state.idleTimer = setTimeout(() => {
    if (sharedBrowserState === state && state.users === 0) {
      void closeSharedBrowser();
    }
  }, idleMs);
}
function clearIdleTimer(state) {
  if (!state.idleTimer) {
    return;
  }
  clearTimeout(state.idleTimer);
  state.idleTimer = null;
}
async function closeSharedBrowser() {
  const state = sharedBrowserState;
  if (!state) {
    return;
  }
  sharedBrowserState = null;
  clearIdleTimer(state);
  const browser = state.browser ?? await state.browserPromise.catch(() => null);
  await browser?.close().catch(() => {
  });
}
async function collectExecutableCandidates() {
  const candidates = /* @__PURE__ */ new Set();
  for (const command of pathCommandsForPlatform()) {
    const resolved = await findExecutableInPath(command);
    if (resolved) {
      candidates.add(resolved);
    }
  }
  for (const candidate of commonExecutablePathsForPlatform()) {
    candidates.add(candidate);
  }
  return [...candidates];
}
function pathCommandsForPlatform() {
  if (process.platform === "win32") {
    return ["chrome.exe", "msedge.exe", "brave.exe"];
  }
  if (process.platform === "darwin") {
    return ["google-chrome", "chromium", "msedge", "brave-browser", "brave"];
  }
  return [
    "chromium",
    "chromium-browser",
    "google-chrome",
    "google-chrome-stable",
    "msedge",
    "brave-browser",
    "brave"
  ];
}
function commonExecutablePathsForPlatform() {
  if (process.platform === "darwin") {
    return [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
      "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"
    ];
  }
  if (process.platform === "win32") {
    const localAppData = process.env.LOCALAPPDATA ?? "";
    const programFiles = process.env.ProgramFiles ?? "C:\\Program Files";
    const programFilesX86 = process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)";
    return [
      path2.join(localAppData, "Google", "Chrome", "Application", "chrome.exe"),
      path2.join(programFiles, "Google", "Chrome", "Application", "chrome.exe"),
      path2.join(programFilesX86, "Google", "Chrome", "Application", "chrome.exe"),
      path2.join(programFiles, "Microsoft", "Edge", "Application", "msedge.exe"),
      path2.join(programFilesX86, "Microsoft", "Edge", "Application", "msedge.exe"),
      path2.join(programFiles, "BraveSoftware", "Brave-Browser", "Application", "brave.exe"),
      path2.join(programFilesX86, "BraveSoftware", "Brave-Browser", "Application", "brave.exe")
    ];
  }
  return [
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/msedge",
    "/usr/bin/brave-browser",
    "/snap/bin/chromium"
  ];
}
async function findExecutableInPath(command) {
  const pathValue = process.env.PATH;
  if (!pathValue) {
    return void 0;
  }
  for (const directory of pathValue.split(path2.delimiter)) {
    if (!directory) {
      continue;
    }
    const candidate = path2.join(directory, command);
    if (await isExecutable(candidate)) {
      return candidate;
    }
  }
  return void 0;
}
async function assertExecutable(candidate, label) {
  if (!await isExecutable(candidate)) {
    throw new Error(`${label} not found or not executable: ${candidate}`);
  }
}
async function isExecutable(candidate) {
  try {
    await fs3.access(candidate, fsConstants.X_OK);
    return true;
  } catch {
    return false;
  }
}

// vendor/openclaw-runtime/win-x64/extensions/diffs/src/render.ts
import { parsePatchFiles } from "@pierre/diffs";
import { preloadFileDiff, preloadMultiFileDiff } from "@pierre/diffs/ssr";
var DEFAULT_FILE_NAME = "diff.txt";
var MAX_PATCH_FILE_COUNT = 128;
var MAX_PATCH_TOTAL_LINES = 12e4;
function escapeCssString(value) {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}
function escapeHtml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function escapeJsonScript(value) {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}
function buildDiffTitle(input) {
  if (input.title?.trim()) {
    return input.title.trim();
  }
  if (input.kind === "before_after") {
    return input.path?.trim() || "Text diff";
  }
  return "Patch diff";
}
function resolveBeforeAfterFileName(input) {
  if (input.path?.trim()) {
    return input.path.trim();
  }
  if (input.lang?.trim()) {
    return `diff.${input.lang.trim().replace(/^\.+/, "")}`;
  }
  return DEFAULT_FILE_NAME;
}
function buildDiffOptions(options) {
  const fontFamily = escapeCssString(options.presentation.fontFamily);
  const fontSize = Math.max(10, Math.floor(options.presentation.fontSize));
  const lineHeight = Math.max(20, Math.round(fontSize * options.presentation.lineSpacing));
  return {
    theme: {
      light: "pierre-light",
      dark: "pierre-dark"
    },
    diffStyle: options.presentation.layout,
    diffIndicators: options.presentation.diffIndicators,
    disableLineNumbers: !options.presentation.showLineNumbers,
    expandUnchanged: options.expandUnchanged,
    themeType: options.presentation.theme,
    backgroundEnabled: options.presentation.background,
    overflow: options.presentation.wordWrap ? "wrap" : "scroll",
    unsafeCSS: `
      :host {
        --diffs-font-family: "${fontFamily}", "SF Mono", Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
        --diffs-header-font-family: "${fontFamily}", "SF Mono", Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
        --diffs-font-size: ${fontSize}px;
        --diffs-line-height: ${lineHeight}px;
      }

      [data-diffs-header] {
        min-height: 64px;
        padding-inline: 18px 14px;
      }

      [data-header-content] {
        gap: 10px;
      }

      [data-metadata] {
        gap: 10px;
      }

      .oc-diff-toolbar {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        margin-inline-start: 6px;
        flex: 0 0 auto;
      }

      .oc-diff-toolbar-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        padding: 0;
        margin: 0;
        border: 0;
        border-radius: 0;
        background: transparent;
        color: inherit;
        cursor: pointer;
        opacity: 0.6;
        line-height: 0;
        overflow: visible;
        transition: opacity 120ms ease;
        flex: 0 0 auto;
      }

      .oc-diff-toolbar-button:hover {
        opacity: 1;
      }

      .oc-diff-toolbar-button[data-active="true"] {
        opacity: 0.92;
      }

      .oc-diff-toolbar-button svg {
        display: block;
        width: 16px;
        height: 16px;
        min-width: 16px;
        min-height: 16px;
        overflow: visible;
        flex: 0 0 auto;
        color: inherit;
        fill: currentColor;
        pointer-events: none;
      }
    `
  };
}
function buildImageRenderOptions(options) {
  return {
    ...options,
    presentation: {
      ...options.presentation,
      fontSize: Math.max(16, options.presentation.fontSize)
    }
  };
}
function buildRenderVariants(options) {
  return {
    viewerOptions: buildDiffOptions(options),
    imageOptions: buildDiffOptions(buildImageRenderOptions(options))
  };
}
function normalizeSupportedLanguage(value) {
  const normalized = value?.trim();
  return normalized ? normalized : void 0;
}
function buildPayloadLanguages(payload) {
  const langs = /* @__PURE__ */ new Set();
  if (payload.fileDiff?.lang) {
    langs.add(payload.fileDiff.lang);
  }
  if (payload.oldFile?.lang) {
    langs.add(payload.oldFile.lang);
  }
  if (payload.newFile?.lang) {
    langs.add(payload.newFile.lang);
  }
  if (langs.size === 0) {
    langs.add("text");
  }
  return [...langs];
}
function renderDiffCard(payload) {
  return `<section class="oc-diff-card">
    <diffs-container class="oc-diff-host" data-openclaw-diff-host>
      <template shadowrootmode="open">${payload.prerenderedHTML}</template>
    </diffs-container>
    <script type="application/json" data-openclaw-diff-payload>${escapeJsonScript(payload)}</script>
  </section>`;
}
function renderStaticDiffCard(prerenderedHTML) {
  return `<section class="oc-diff-card">
    <diffs-container class="oc-diff-host" data-openclaw-diff-host>
      <template shadowrootmode="open">${prerenderedHTML}</template>
    </diffs-container>
  </section>`;
}
function buildHtmlDocument(params) {
  return `<!doctype html>
<html lang="en"${params.runtimeMode === "image" ? ' data-openclaw-diffs-ready="true"' : ""}>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="dark light" />
    <title>${escapeHtml(params.title)}</title>
    <style>
      * {
        box-sizing: border-box;
      }

      html,
      body {
        min-height: 100%;
      }

      html {
        background: #05070b;
      }

      body {
        margin: 0;
        min-height: 100vh;
        padding: 22px;
        font-family:
          "Fira Code",
          "SF Mono",
          Monaco,
          Consolas,
          monospace;
        background: #05070b;
        color: #f8fafc;
      }

      body[data-theme="light"] {
        background: #f3f5f8;
        color: #0f172a;
      }

      .oc-frame {
        max-width: 1560px;
        margin: 0 auto;
      }

      .oc-frame[data-render-mode="image"] {
        max-width: ${Math.max(640, Math.round(params.imageMaxWidth))}px;
      }

      [data-openclaw-diff-root] {
        display: grid;
        gap: 18px;
      }

      .oc-diff-card {
        overflow: hidden;
        border-radius: 18px;
        border: 1px solid rgba(148, 163, 184, 0.16);
        background: rgba(15, 23, 42, 0.14);
        box-shadow: 0 18px 48px rgba(2, 6, 23, 0.22);
      }

      body[data-theme="light"] .oc-diff-card {
        border-color: rgba(148, 163, 184, 0.22);
        background: rgba(255, 255, 255, 0.92);
        box-shadow: 0 14px 32px rgba(15, 23, 42, 0.08);
      }

      .oc-diff-host {
        display: block;
      }

      .oc-frame[data-render-mode="image"] .oc-diff-card {
        min-height: 240px;
      }

      @media (max-width: 720px) {
        body {
          padding: 12px;
        }

        [data-openclaw-diff-root] {
          gap: 12px;
        }
      }
    </style>
  </head>
  <body data-theme="${params.theme}">
    <main class="oc-frame" data-render-mode="${params.runtimeMode}">
      <div data-openclaw-diff-root>
        ${params.bodyHtml}
      </div>
    </main>
    ${params.runtimeMode === "viewer" ? `<script type="module" src="${VIEWER_LOADER_PATH}"></script>` : ""}
  </body>
</html>`;
}
function buildRenderedSection(params) {
  return {
    viewer: renderDiffCard({
      prerenderedHTML: params.viewerPrerenderedHtml,
      ...params.payload
    }),
    image: renderStaticDiffCard(params.imagePrerenderedHtml)
  };
}
function buildRenderedBodies(sections) {
  return {
    viewerBodyHtml: sections.map((section) => section.viewer).join("\n"),
    imageBodyHtml: sections.map((section) => section.image).join("\n")
  };
}
async function renderBeforeAfterDiff(input, options) {
  const fileName = resolveBeforeAfterFileName(input);
  const lang = normalizeSupportedLanguage(input.lang);
  const oldFile = {
    name: fileName,
    contents: input.before,
    ...lang ? { lang } : {}
  };
  const newFile = {
    name: fileName,
    contents: input.after,
    ...lang ? { lang } : {}
  };
  const { viewerOptions, imageOptions } = buildRenderVariants(options);
  const [viewerResult, imageResult] = await Promise.all([
    preloadMultiFileDiff({
      oldFile,
      newFile,
      options: viewerOptions
    }),
    preloadMultiFileDiff({
      oldFile,
      newFile,
      options: imageOptions
    })
  ]);
  const section = buildRenderedSection({
    viewerPrerenderedHtml: viewerResult.prerenderedHTML,
    imagePrerenderedHtml: imageResult.prerenderedHTML,
    payload: {
      oldFile: viewerResult.oldFile,
      newFile: viewerResult.newFile,
      options: viewerOptions,
      langs: buildPayloadLanguages({
        oldFile: viewerResult.oldFile,
        newFile: viewerResult.newFile
      })
    }
  });
  return {
    ...buildRenderedBodies([section]),
    fileCount: 1
  };
}
async function renderPatchDiff(input, options) {
  const files = parsePatchFiles(input.patch).flatMap((entry) => entry.files ?? []);
  if (files.length === 0) {
    throw new Error("Patch input did not contain any file diffs.");
  }
  if (files.length > MAX_PATCH_FILE_COUNT) {
    throw new Error(`Patch input contains too many files (max ${MAX_PATCH_FILE_COUNT}).`);
  }
  const totalLines = files.reduce((sum, fileDiff) => {
    const splitLines = Number.isFinite(fileDiff.splitLineCount) ? fileDiff.splitLineCount : 0;
    const unifiedLines = Number.isFinite(fileDiff.unifiedLineCount) ? fileDiff.unifiedLineCount : 0;
    return sum + Math.max(splitLines, unifiedLines, 0);
  }, 0);
  if (totalLines > MAX_PATCH_TOTAL_LINES) {
    throw new Error(`Patch input is too large to render (max ${MAX_PATCH_TOTAL_LINES} lines).`);
  }
  const { viewerOptions, imageOptions } = buildRenderVariants(options);
  const sections = await Promise.all(
    files.map(async (fileDiff) => {
      const [viewerResult, imageResult] = await Promise.all([
        preloadFileDiff({
          fileDiff,
          options: viewerOptions
        }),
        preloadFileDiff({
          fileDiff,
          options: imageOptions
        })
      ]);
      return buildRenderedSection({
        viewerPrerenderedHtml: viewerResult.prerenderedHTML,
        imagePrerenderedHtml: imageResult.prerenderedHTML,
        payload: {
          fileDiff: viewerResult.fileDiff,
          options: viewerOptions,
          langs: buildPayloadLanguages({ fileDiff: viewerResult.fileDiff })
        }
      });
    })
  );
  return {
    ...buildRenderedBodies(sections),
    fileCount: files.length
  };
}
async function renderDiffDocument(input, options) {
  const title = buildDiffTitle(input);
  const rendered = input.kind === "before_after" ? await renderBeforeAfterDiff(input, options) : await renderPatchDiff(input, options);
  return {
    html: buildHtmlDocument({
      title,
      bodyHtml: rendered.viewerBodyHtml,
      theme: options.presentation.theme,
      imageMaxWidth: options.image.maxWidth,
      runtimeMode: "viewer"
    }),
    imageHtml: buildHtmlDocument({
      title,
      bodyHtml: rendered.imageBodyHtml,
      theme: options.presentation.theme,
      imageMaxWidth: options.image.maxWidth,
      runtimeMode: "image"
    }),
    title,
    fileCount: rendered.fileCount,
    inputKind: input.kind
  };
}

// vendor/openclaw-runtime/win-x64/extensions/diffs/src/url.ts
var DEFAULT_GATEWAY_PORT = 18789;
function buildViewerUrl(params) {
  const baseUrl = params.baseUrl?.trim() || resolveGatewayBaseUrl(params.config);
  const normalizedBase = normalizeViewerBaseUrl(baseUrl);
  const viewerPath = params.viewerPath.startsWith("/") ? params.viewerPath : `/${params.viewerPath}`;
  const parsedBase = new URL(normalizedBase);
  const basePath = parsedBase.pathname === "/" ? "" : parsedBase.pathname.replace(/\/+$/, "");
  parsedBase.pathname = `${basePath}${viewerPath}`;
  parsedBase.search = "";
  parsedBase.hash = "";
  return parsedBase.toString();
}
function normalizeViewerBaseUrl(raw) {
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`Invalid baseUrl: ${raw}`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`baseUrl must use http or https: ${raw}`);
  }
  if (parsed.search || parsed.hash) {
    throw new Error(`baseUrl must not include query/hash: ${raw}`);
  }
  parsed.search = "";
  parsed.hash = "";
  parsed.pathname = parsed.pathname.replace(/\/+$/, "");
  const withoutTrailingSlash = parsed.toString().replace(/\/+$/, "");
  return withoutTrailingSlash;
}
function resolveGatewayBaseUrl(config) {
  const scheme = config.gateway?.tls?.enabled ? "https" : "http";
  const port = typeof config.gateway?.port === "number" ? config.gateway.port : DEFAULT_GATEWAY_PORT;
  const customHost = config.gateway?.customBindHost?.trim();
  if (config.gateway?.bind === "custom" && customHost) {
    return `${scheme}://${customHost}:${port}`;
  }
  return `${scheme}://127.0.0.1:${port}`;
}

// vendor/openclaw-runtime/win-x64/extensions/diffs/src/tool.ts
var MAX_BEFORE_AFTER_BYTES = 512 * 1024;
var MAX_PATCH_BYTES = 2 * 1024 * 1024;
var MAX_TITLE_BYTES = 1024;
var MAX_PATH_BYTES = 2048;
var MAX_LANG_BYTES = 128;
function stringEnum(values, description) {
  return Type.Unsafe({
    type: "string",
    enum: [...values],
    description
  });
}
var DiffsToolSchema = Type.Object(
  {
    before: Type.Optional(Type.String({ description: "Original text content." })),
    after: Type.Optional(Type.String({ description: "Updated text content." })),
    patch: Type.Optional(
      Type.String({
        description: "Unified diff or patch text.",
        maxLength: MAX_PATCH_BYTES
      })
    ),
    path: Type.Optional(
      Type.String({
        description: "Display path for before/after input.",
        maxLength: MAX_PATH_BYTES
      })
    ),
    lang: Type.Optional(
      Type.String({
        description: "Optional language override for before/after input.",
        maxLength: MAX_LANG_BYTES
      })
    ),
    title: Type.Optional(
      Type.String({
        description: "Optional title for the rendered diff.",
        maxLength: MAX_TITLE_BYTES
      })
    ),
    mode: Type.Optional(
      stringEnum(DIFF_MODES, "Output mode: view, file, image, or both. Default: both.")
    ),
    theme: Type.Optional(stringEnum(DIFF_THEMES, "Viewer theme. Default: dark.")),
    layout: Type.Optional(stringEnum(DIFF_LAYOUTS, "Diff layout. Default: unified.")),
    fileQuality: Type.Optional(
      stringEnum(DIFF_IMAGE_QUALITY_PRESETS, "File quality preset: standard, hq, or print.")
    ),
    fileFormat: Type.Optional(stringEnum(DIFF_OUTPUT_FORMATS, "Rendered file format: png or pdf.")),
    fileScale: Type.Optional(
      Type.Number({
        description: "Optional rendered-file device scale factor override (1-4).",
        minimum: 1,
        maximum: 4
      })
    ),
    fileMaxWidth: Type.Optional(
      Type.Number({
        description: "Optional rendered-file max width in CSS pixels (640-2400).",
        minimum: 640,
        maximum: 2400
      })
    ),
    imageQuality: Type.Optional(
      stringEnum(DIFF_IMAGE_QUALITY_PRESETS, "Deprecated alias for fileQuality.")
    ),
    imageFormat: Type.Optional(stringEnum(DIFF_OUTPUT_FORMATS, "Deprecated alias for fileFormat.")),
    imageScale: Type.Optional(
      Type.Number({
        description: "Deprecated alias for fileScale.",
        minimum: 1,
        maximum: 4
      })
    ),
    imageMaxWidth: Type.Optional(
      Type.Number({
        description: "Deprecated alias for fileMaxWidth.",
        minimum: 640,
        maximum: 2400
      })
    ),
    expandUnchanged: Type.Optional(
      Type.Boolean({ description: "Expand unchanged sections instead of collapsing them." })
    ),
    ttlSeconds: Type.Optional(
      Type.Number({
        description: "Artifact lifetime in seconds. Default: 1800. Maximum: 21600.",
        minimum: 1,
        maximum: 21600
      })
    ),
    baseUrl: Type.Optional(
      Type.String({
        description: "Optional gateway base URL override used when building the viewer URL, for example https://gateway.example.com."
      })
    )
  },
  { additionalProperties: false }
);
function createDiffsTool(params) {
  return {
    name: "diffs",
    label: "Diffs",
    description: "Create a read-only diff viewer from before/after text or a unified patch. Returns a gateway viewer URL for canvas use and can also render the same diff to a PNG or PDF.",
    parameters: DiffsToolSchema,
    execute: async (_toolCallId, rawParams) => {
      const toolParams = rawParams;
      const input = normalizeDiffInput(toolParams);
      const mode = normalizeMode2(toolParams.mode, params.defaults.mode);
      const theme = normalizeTheme2(toolParams.theme, params.defaults.theme);
      const layout = normalizeLayout2(toolParams.layout, params.defaults.layout);
      const expandUnchanged = toolParams.expandUnchanged === true;
      const ttlMs = normalizeTtlMs2(toolParams.ttlSeconds);
      const image = resolveDiffImageRenderOptions({
        defaults: params.defaults,
        fileFormat: normalizeOutputFormat(
          toolParams.fileFormat ?? toolParams.imageFormat ?? toolParams.format
        ),
        fileQuality: normalizeFileQuality2(toolParams.fileQuality ?? toolParams.imageQuality),
        fileScale: toolParams.fileScale ?? toolParams.imageScale,
        fileMaxWidth: toolParams.fileMaxWidth ?? toolParams.imageMaxWidth
      });
      const rendered = await renderDiffDocument(input, {
        presentation: {
          ...params.defaults,
          layout,
          theme
        },
        image,
        expandUnchanged
      });
      const screenshotter = params.screenshotter ?? new PlaywrightDiffScreenshotter({ config: params.api.config });
      if (isArtifactOnlyMode(mode)) {
        const artifactFile = await renderDiffArtifactFile({
          screenshotter,
          store: params.store,
          html: rendered.imageHtml,
          theme,
          image,
          ttlMs
        });
        return {
          content: [
            {
              type: "text",
              text: buildFileArtifactMessage({
                format: image.format,
                filePath: artifactFile.path
              })
            }
          ],
          details: buildArtifactDetails({
            baseDetails: {
              title: rendered.title,
              inputKind: rendered.inputKind,
              fileCount: rendered.fileCount,
              mode
            },
            artifactFile,
            image
          })
        };
      }
      const artifact = await params.store.createArtifact({
        html: rendered.html,
        title: rendered.title,
        inputKind: rendered.inputKind,
        fileCount: rendered.fileCount,
        ttlMs
      });
      const viewerUrl = buildViewerUrl({
        config: params.api.config,
        viewerPath: artifact.viewerPath,
        baseUrl: normalizeBaseUrl(toolParams.baseUrl)
      });
      const baseDetails = {
        artifactId: artifact.id,
        viewerUrl,
        viewerPath: artifact.viewerPath,
        title: artifact.title,
        expiresAt: artifact.expiresAt,
        inputKind: artifact.inputKind,
        fileCount: artifact.fileCount,
        mode
      };
      if (mode === "view") {
        return {
          content: [
            {
              type: "text",
              text: `Diff viewer ready.
${viewerUrl}`
            }
          ],
          details: baseDetails
        };
      }
      try {
        const artifactFile = await renderDiffArtifactFile({
          screenshotter,
          store: params.store,
          artifactId: artifact.id,
          html: rendered.imageHtml,
          theme,
          image
        });
        await params.store.updateFilePath(artifact.id, artifactFile.path);
        return {
          content: [
            {
              type: "text",
              text: buildFileArtifactMessage({
                format: image.format,
                filePath: artifactFile.path,
                viewerUrl
              })
            }
          ],
          details: buildArtifactDetails({
            baseDetails,
            artifactFile,
            image
          })
        };
      } catch (error) {
        if (mode === "both") {
          return {
            content: [
              {
                type: "text",
                text: `Diff viewer ready.
${viewerUrl}
File rendering failed: ${error instanceof Error ? error.message : String(error)}`
              }
            ],
            details: {
              ...baseDetails,
              fileError: error instanceof Error ? error.message : String(error),
              imageError: error instanceof Error ? error.message : String(error)
            }
          };
        }
        throw error;
      }
    }
  };
}
function normalizeFileQuality2(fileQuality) {
  return fileQuality && DIFF_IMAGE_QUALITY_PRESETS.includes(fileQuality) ? fileQuality : void 0;
}
function normalizeOutputFormat(format) {
  return format && DIFF_OUTPUT_FORMATS.includes(format) ? format : void 0;
}
function isArtifactOnlyMode(mode) {
  return mode === "image" || mode === "file";
}
function buildArtifactDetails(params) {
  return {
    ...params.baseDetails,
    filePath: params.artifactFile.path,
    imagePath: params.artifactFile.path,
    path: params.artifactFile.path,
    fileBytes: params.artifactFile.bytes,
    imageBytes: params.artifactFile.bytes,
    format: params.image.format,
    fileFormat: params.image.format,
    fileQuality: params.image.qualityPreset,
    imageQuality: params.image.qualityPreset,
    fileScale: params.image.scale,
    imageScale: params.image.scale,
    fileMaxWidth: params.image.maxWidth,
    imageMaxWidth: params.image.maxWidth
  };
}
function buildFileArtifactMessage(params) {
  const lines = params.viewerUrl ? [`Diff viewer: ${params.viewerUrl}`] : [];
  lines.push(`Diff ${params.format.toUpperCase()} generated at: ${params.filePath}`);
  lines.push("Use the `message` tool with `path` or `filePath` to send this file.");
  return lines.join("\n");
}
async function renderDiffArtifactFile(params) {
  const outputPath = params.artifactId ? params.store.allocateFilePath(params.artifactId, params.image.format) : (await params.store.createStandaloneFileArtifact({
    format: params.image.format,
    ttlMs: params.ttlMs
  })).filePath;
  await params.screenshotter.screenshotHtml({
    html: params.html,
    outputPath,
    theme: params.theme,
    image: params.image
  });
  const stats = await fs4.stat(outputPath);
  return {
    path: outputPath,
    bytes: stats.size
  };
}
function normalizeDiffInput(params) {
  const patch = params.patch?.trim();
  const before = params.before;
  const after = params.after;
  if (patch) {
    assertMaxBytes(patch, "patch", MAX_PATCH_BYTES);
    if (before !== void 0 || after !== void 0) {
      throw new PluginToolInputError("Provide either patch or before/after input, not both.");
    }
    const title2 = params.title?.trim();
    if (title2) {
      assertMaxBytes(title2, "title", MAX_TITLE_BYTES);
    }
    return {
      kind: "patch",
      patch,
      title: title2
    };
  }
  if (before === void 0 || after === void 0) {
    throw new PluginToolInputError("Provide patch or both before and after text.");
  }
  assertMaxBytes(before, "before", MAX_BEFORE_AFTER_BYTES);
  assertMaxBytes(after, "after", MAX_BEFORE_AFTER_BYTES);
  const path4 = params.path?.trim() || void 0;
  const lang = params.lang?.trim() || void 0;
  const title = params.title?.trim() || void 0;
  if (path4) {
    assertMaxBytes(path4, "path", MAX_PATH_BYTES);
  }
  if (lang) {
    assertMaxBytes(lang, "lang", MAX_LANG_BYTES);
  }
  if (title) {
    assertMaxBytes(title, "title", MAX_TITLE_BYTES);
  }
  return {
    kind: "before_after",
    before,
    after,
    path: path4,
    lang,
    title
  };
}
function assertMaxBytes(value, label, maxBytes) {
  if (Buffer.byteLength(value, "utf8") <= maxBytes) {
    return;
  }
  throw new PluginToolInputError(`${label} exceeds maximum size (${maxBytes} bytes).`);
}
function normalizeBaseUrl(baseUrl) {
  const normalized = baseUrl?.trim();
  if (!normalized) {
    return void 0;
  }
  try {
    return normalizeViewerBaseUrl(normalized);
  } catch {
    throw new PluginToolInputError(`Invalid baseUrl: ${normalized}`);
  }
}
function normalizeMode2(mode, fallback) {
  return mode && DIFF_MODES.includes(mode) ? mode : fallback;
}
function normalizeTheme2(theme, fallback) {
  return theme && DIFF_THEMES.includes(theme) ? theme : fallback;
}
function normalizeLayout2(layout, fallback) {
  return layout && DIFF_LAYOUTS.includes(layout) ? layout : fallback;
}
function normalizeTtlMs2(ttlSeconds) {
  if (!Number.isFinite(ttlSeconds) || ttlSeconds === void 0) {
    return void 0;
  }
  return Math.floor(ttlSeconds * 1e3);
}
var PluginToolInputError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "ToolInputError";
  }
};

// vendor/openclaw-runtime/win-x64/extensions/diffs/index.ts
var plugin = {
  id: "diffs",
  name: "Diffs",
  description: "Read-only diff viewer and PNG/PDF renderer for agents.",
  configSchema: diffsPluginConfigSchema,
  register(api) {
    const defaults = resolveDiffsPluginDefaults(api.pluginConfig);
    const security = resolveDiffsPluginSecurity(api.pluginConfig);
    const store = new DiffArtifactStore({
      rootDir: path3.join(resolvePreferredOpenClawTmpDir(), "openclaw-diffs"),
      logger: api.logger
    });
    api.registerTool(createDiffsTool({ api, store, defaults }));
    api.registerHttpRoute({
      path: "/plugins/diffs",
      auth: "plugin",
      match: "prefix",
      handler: createDiffsHttpHandler({
        store,
        logger: api.logger,
        allowRemoteViewer: security.allowRemoteViewer
      })
    });
    api.on("before_prompt_build", async () => ({
      prependContext: DIFFS_AGENT_GUIDANCE
    }));
  }
};
var diffs_default = plugin;
export {
  diffs_default as default
};
