var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// vendor/openclaw-runtime/win-x64/extensions/voice-call/src/core-bridge.ts
import fs4 from "fs";
import path5 from "path";
import { fileURLToPath, pathToFileURL } from "url";
function findPackageRoot(startDir, name) {
  let dir = startDir;
  for (; ; ) {
    const pkgPath = path5.join(dir, "package.json");
    try {
      if (fs4.existsSync(pkgPath)) {
        const raw = fs4.readFileSync(pkgPath, "utf8");
        const pkg = JSON.parse(raw);
        if (pkg.name === name) {
          return dir;
        }
      }
    } catch {
    }
    const parent = path5.dirname(dir);
    if (parent === dir) {
      return null;
    }
    dir = parent;
  }
}
function resolveOpenClawRoot() {
  if (coreRootCache) {
    return coreRootCache;
  }
  const override = process.env.OPENCLAW_ROOT?.trim();
  if (override) {
    coreRootCache = override;
    return override;
  }
  const candidates = /* @__PURE__ */ new Set();
  if (process.argv[1]) {
    candidates.add(path5.dirname(process.argv[1]));
  }
  candidates.add(process.cwd());
  try {
    const urlPath = fileURLToPath(import.meta.url);
    candidates.add(path5.dirname(urlPath));
  } catch {
  }
  for (const start of candidates) {
    for (const name of ["openclaw"]) {
      const found = findPackageRoot(start, name);
      if (found) {
        coreRootCache = found;
        return found;
      }
    }
  }
  throw new Error("Unable to resolve core root. Set OPENCLAW_ROOT to the package root.");
}
async function importCoreExtensionAPI() {
  const distPath = path5.join(resolveOpenClawRoot(), "dist", "extensionAPI.js");
  if (!fs4.existsSync(distPath)) {
    throw new Error(
      `Missing core module at ${distPath}. Run \`pnpm build\` or install the official package.`
    );
  }
  return await import(pathToFileURL(distPath).href);
}
async function loadCoreAgentDeps() {
  if (coreDepsPromise) {
    return coreDepsPromise;
  }
  coreDepsPromise = (async () => {
    return await importCoreExtensionAPI();
  })();
  return coreDepsPromise;
}
var coreRootCache, coreDepsPromise;
var init_core_bridge = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/voice-call/src/core-bridge.ts"() {
    "use strict";
    coreRootCache = null;
    coreDepsPromise = null;
  }
});

// vendor/openclaw-runtime/win-x64/extensions/voice-call/src/response-generator.ts
var response_generator_exports = {};
__export(response_generator_exports, {
  generateVoiceResponse: () => generateVoiceResponse
});
import crypto8 from "crypto";
async function generateVoiceResponse(params) {
  const { voiceConfig, callId, from, transcript, userMessage, coreConfig } = params;
  if (!coreConfig) {
    return { text: null, error: "Core config unavailable for voice response" };
  }
  let deps;
  try {
    deps = await loadCoreAgentDeps();
  } catch (err) {
    return {
      text: null,
      error: err instanceof Error ? err.message : "Unable to load core agent dependencies"
    };
  }
  const cfg = coreConfig;
  const normalizedPhone = from.replace(/\D/g, "");
  const sessionKey = `voice:${normalizedPhone}`;
  const agentId = "main";
  const storePath = deps.resolveStorePath(cfg.session?.store, { agentId });
  const agentDir = deps.resolveAgentDir(cfg, agentId);
  const workspaceDir = deps.resolveAgentWorkspaceDir(cfg, agentId);
  await deps.ensureAgentWorkspace({ dir: workspaceDir });
  const sessionStore = deps.loadSessionStore(storePath);
  const now = Date.now();
  let sessionEntry = sessionStore[sessionKey];
  if (!sessionEntry) {
    sessionEntry = {
      sessionId: crypto8.randomUUID(),
      updatedAt: now
    };
    sessionStore[sessionKey] = sessionEntry;
    await deps.saveSessionStore(storePath, sessionStore);
  }
  const sessionId = sessionEntry.sessionId;
  const sessionFile = deps.resolveSessionFilePath(sessionId, sessionEntry, {
    agentId
  });
  const modelRef = voiceConfig.responseModel || `${deps.DEFAULT_PROVIDER}/${deps.DEFAULT_MODEL}`;
  const slashIndex = modelRef.indexOf("/");
  const provider = slashIndex === -1 ? deps.DEFAULT_PROVIDER : modelRef.slice(0, slashIndex);
  const model = slashIndex === -1 ? modelRef : modelRef.slice(slashIndex + 1);
  const thinkLevel = deps.resolveThinkingDefault({ cfg, provider, model });
  const identity = deps.resolveAgentIdentity(cfg, agentId);
  const agentName = identity?.name?.trim() || "assistant";
  const basePrompt = voiceConfig.responseSystemPrompt ?? `You are ${agentName}, a helpful voice assistant on a phone call. Keep responses brief and conversational (1-2 sentences max). Be natural and friendly. The caller's phone number is ${from}. You have access to tools - use them when helpful.`;
  let extraSystemPrompt = basePrompt;
  if (transcript.length > 0) {
    const history = transcript.map((entry) => `${entry.speaker === "bot" ? "You" : "Caller"}: ${entry.text}`).join("\n");
    extraSystemPrompt = `${basePrompt}

Conversation so far:
${history}`;
  }
  const timeoutMs = voiceConfig.responseTimeoutMs ?? deps.resolveAgentTimeoutMs({ cfg });
  const runId = `voice:${callId}:${Date.now()}`;
  try {
    const result = await deps.runEmbeddedPiAgent({
      sessionId,
      sessionKey,
      messageProvider: "voice",
      sessionFile,
      workspaceDir,
      config: cfg,
      prompt: userMessage,
      provider,
      model,
      thinkLevel,
      verboseLevel: "off",
      timeoutMs,
      runId,
      lane: "voice",
      extraSystemPrompt,
      agentDir
    });
    const texts = (result.payloads ?? []).filter((p) => p.text && !p.isError).map((p) => p.text?.trim()).filter(Boolean);
    const text = texts.join(" ") || null;
    if (!text && result.meta?.aborted) {
      return { text: null, error: "Response generation was aborted" };
    }
    return { text };
  } catch (err) {
    console.error(`[voice-call] Response generation failed:`, err);
    return { text: null, error: String(err) };
  }
}
var init_response_generator = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/voice-call/src/response-generator.ts"() {
    "use strict";
    init_core_bridge();
  }
});

// vendor/openclaw-runtime/win-x64/extensions/voice-call/index.ts
import { Type } from "@sinclair/typebox";

// vendor/openclaw-runtime/win-x64/extensions/voice-call/src/cli.ts
import fs from "fs";
import os2 from "os";
import path2 from "path";
import { sleep } from "openclaw/plugin-sdk";

// vendor/openclaw-runtime/win-x64/extensions/voice-call/src/utils.ts
import os from "os";
import path from "path";
function resolveUserPath(input) {
  const trimmed = input.trim();
  if (!trimmed) {
    return trimmed;
  }
  if (trimmed.startsWith("~")) {
    const expanded = trimmed.replace(/^~(?=$|[\\/])/, os.homedir());
    return path.resolve(expanded);
  }
  return path.resolve(trimmed);
}

// vendor/openclaw-runtime/win-x64/extensions/voice-call/src/webhook/tailscale.ts
import { spawn } from "child_process";
function runTailscaleCommand(args, timeoutMs = 2500) {
  return new Promise((resolve) => {
    const proc = spawn("tailscale", args, {
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    proc.stdout.on("data", (data) => {
      stdout += data;
    });
    const timer = setTimeout(() => {
      proc.kill("SIGKILL");
      resolve({ code: -1, stdout: "" });
    }, timeoutMs);
    proc.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? -1, stdout });
    });
  });
}
async function getTailscaleSelfInfo() {
  const { code, stdout } = await runTailscaleCommand(["status", "--json"]);
  if (code !== 0) {
    return null;
  }
  try {
    const status = JSON.parse(stdout);
    return {
      dnsName: status.Self?.DNSName?.replace(/\.$/, "") || null,
      nodeId: status.Self?.ID || null
    };
  } catch {
    return null;
  }
}
async function getTailscaleDnsName() {
  const info = await getTailscaleSelfInfo();
  return info?.dnsName ?? null;
}
async function setupTailscaleExposureRoute(opts) {
  const dnsName = await getTailscaleDnsName();
  if (!dnsName) {
    console.warn("[voice-call] Could not get Tailscale DNS name");
    return null;
  }
  const { code } = await runTailscaleCommand([
    opts.mode,
    "--bg",
    "--yes",
    "--set-path",
    opts.path,
    opts.localUrl
  ]);
  if (code === 0) {
    const publicUrl = `https://${dnsName}${opts.path}`;
    console.log(`[voice-call] Tailscale ${opts.mode} active: ${publicUrl}`);
    return publicUrl;
  }
  console.warn(`[voice-call] Tailscale ${opts.mode} failed`);
  return null;
}
async function cleanupTailscaleExposureRoute(opts) {
  await runTailscaleCommand([opts.mode, "off", opts.path]);
}
async function setupTailscaleExposure(config) {
  if (config.tailscale.mode === "off") {
    return null;
  }
  const mode = config.tailscale.mode === "funnel" ? "funnel" : "serve";
  const localUrl = `http://127.0.0.1:${config.serve.port}${config.serve.path}`;
  return setupTailscaleExposureRoute({
    mode,
    path: config.tailscale.path,
    localUrl
  });
}
async function cleanupTailscaleExposure(config) {
  if (config.tailscale.mode === "off") {
    return;
  }
  const mode = config.tailscale.mode === "funnel" ? "funnel" : "serve";
  await cleanupTailscaleExposureRoute({ mode, path: config.tailscale.path });
}

// vendor/openclaw-runtime/win-x64/extensions/voice-call/src/cli.ts
function resolveMode(input) {
  const raw = input.trim().toLowerCase();
  if (raw === "serve" || raw === "off") {
    return raw;
  }
  return "funnel";
}
function resolveDefaultStorePath(config) {
  const preferred = path2.join(os2.homedir(), ".openclaw", "voice-calls");
  const resolvedPreferred = resolveUserPath(preferred);
  const existing = [resolvedPreferred].find((dir) => {
    try {
      return fs.existsSync(path2.join(dir, "calls.jsonl")) || fs.existsSync(dir);
    } catch {
      return false;
    }
  }) ?? resolvedPreferred;
  const base = config.store?.trim() ? resolveUserPath(config.store) : existing;
  return path2.join(base, "calls.jsonl");
}
function percentile(values, p) {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p / 100 * sorted.length) - 1));
  return sorted[idx] ?? 0;
}
function summarizeSeries(values) {
  if (values.length === 0) {
    return { count: 0, minMs: 0, maxMs: 0, avgMs: 0, p50Ms: 0, p95Ms: 0 };
  }
  const minMs = values.reduce(
    (min, value) => value < min ? value : min,
    Number.POSITIVE_INFINITY
  );
  const maxMs = values.reduce(
    (max, value) => value > max ? value : max,
    Number.NEGATIVE_INFINITY
  );
  const avgMs = values.reduce((sum, value) => sum + value, 0) / values.length;
  return {
    count: values.length,
    minMs,
    maxMs,
    avgMs,
    p50Ms: percentile(values, 50),
    p95Ms: percentile(values, 95)
  };
}
function resolveCallMode(mode) {
  return mode === "notify" || mode === "conversation" ? mode : void 0;
}
async function initiateCallAndPrintId(params) {
  const result = await params.runtime.manager.initiateCall(params.to, void 0, {
    message: params.message,
    mode: resolveCallMode(params.mode)
  });
  if (!result.success) {
    throw new Error(result.error || "initiate failed");
  }
  console.log(JSON.stringify({ callId: result.callId }, null, 2));
}
function registerVoiceCallCli(params) {
  const { program, config, ensureRuntime, logger } = params;
  const root = program.command("voicecall").description("Voice call utilities").addHelpText("after", () => `
Docs: https://docs.openclaw.ai/cli/voicecall
`);
  root.command("call").description("Initiate an outbound voice call").requiredOption("-m, --message <text>", "Message to speak when call connects").option(
    "-t, --to <phone>",
    "Phone number to call (E.164 format, uses config toNumber if not set)"
  ).option(
    "--mode <mode>",
    "Call mode: notify (hangup after message) or conversation (stay open)",
    "conversation"
  ).action(async (options) => {
    const rt = await ensureRuntime();
    const to = options.to ?? rt.config.toNumber;
    if (!to) {
      throw new Error("Missing --to and no toNumber configured");
    }
    await initiateCallAndPrintId({
      runtime: rt,
      to,
      message: options.message,
      mode: options.mode
    });
  });
  root.command("start").description("Alias for voicecall call").requiredOption("--to <phone>", "Phone number to call").option("--message <text>", "Message to speak when call connects").option(
    "--mode <mode>",
    "Call mode: notify (hangup after message) or conversation (stay open)",
    "conversation"
  ).action(async (options) => {
    const rt = await ensureRuntime();
    await initiateCallAndPrintId({
      runtime: rt,
      to: options.to,
      message: options.message,
      mode: options.mode
    });
  });
  root.command("continue").description("Speak a message and wait for a response").requiredOption("--call-id <id>", "Call ID").requiredOption("--message <text>", "Message to speak").action(async (options) => {
    const rt = await ensureRuntime();
    const result = await rt.manager.continueCall(options.callId, options.message);
    if (!result.success) {
      throw new Error(result.error || "continue failed");
    }
    console.log(JSON.stringify(result, null, 2));
  });
  root.command("speak").description("Speak a message without waiting for response").requiredOption("--call-id <id>", "Call ID").requiredOption("--message <text>", "Message to speak").action(async (options) => {
    const rt = await ensureRuntime();
    const result = await rt.manager.speak(options.callId, options.message);
    if (!result.success) {
      throw new Error(result.error || "speak failed");
    }
    console.log(JSON.stringify(result, null, 2));
  });
  root.command("end").description("Hang up an active call").requiredOption("--call-id <id>", "Call ID").action(async (options) => {
    const rt = await ensureRuntime();
    const result = await rt.manager.endCall(options.callId);
    if (!result.success) {
      throw new Error(result.error || "end failed");
    }
    console.log(JSON.stringify(result, null, 2));
  });
  root.command("status").description("Show call status").requiredOption("--call-id <id>", "Call ID").action(async (options) => {
    const rt = await ensureRuntime();
    const call = rt.manager.getCall(options.callId);
    console.log(JSON.stringify(call ?? { found: false }, null, 2));
  });
  root.command("tail").description("Tail voice-call JSONL logs (prints new lines; useful during provider tests)").option("--file <path>", "Path to calls.jsonl", resolveDefaultStorePath(config)).option("--since <n>", "Print last N lines first", "25").option("--poll <ms>", "Poll interval in ms", "250").action(async (options) => {
    const file = options.file;
    const since = Math.max(0, Number(options.since ?? 0));
    const pollMs = Math.max(50, Number(options.poll ?? 250));
    if (!fs.existsSync(file)) {
      logger.error(`No log file at ${file}`);
      process.exit(1);
    }
    const initial = fs.readFileSync(file, "utf8");
    const lines = initial.split("\n").filter(Boolean);
    for (const line of lines.slice(Math.max(0, lines.length - since))) {
      console.log(line);
    }
    let offset = Buffer.byteLength(initial, "utf8");
    for (; ; ) {
      try {
        const stat = fs.statSync(file);
        if (stat.size < offset) {
          offset = 0;
        }
        if (stat.size > offset) {
          const fd = fs.openSync(file, "r");
          try {
            const buf = Buffer.alloc(stat.size - offset);
            fs.readSync(fd, buf, 0, buf.length, offset);
            offset = stat.size;
            const text = buf.toString("utf8");
            for (const line of text.split("\n").filter(Boolean)) {
              console.log(line);
            }
          } finally {
            fs.closeSync(fd);
          }
        }
      } catch {
      }
      await sleep(pollMs);
    }
  });
  root.command("latency").description("Summarize turn latency metrics from voice-call JSONL logs").option("--file <path>", "Path to calls.jsonl", resolveDefaultStorePath(config)).option("--last <n>", "Analyze last N records", "200").action(async (options) => {
    const file = options.file;
    const last = Math.max(1, Number(options.last ?? 200));
    if (!fs.existsSync(file)) {
      throw new Error("No log file at " + file);
    }
    const content = fs.readFileSync(file, "utf8");
    const lines = content.split("\n").filter(Boolean).slice(-last);
    const turnLatencyMs = [];
    const listenWaitMs = [];
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        const latency = parsed.metadata?.lastTurnLatencyMs;
        const listenWait = parsed.metadata?.lastTurnListenWaitMs;
        if (typeof latency === "number" && Number.isFinite(latency)) {
          turnLatencyMs.push(latency);
        }
        if (typeof listenWait === "number" && Number.isFinite(listenWait)) {
          listenWaitMs.push(listenWait);
        }
      } catch {
      }
    }
    console.log(
      JSON.stringify(
        {
          recordsScanned: lines.length,
          turnLatency: summarizeSeries(turnLatencyMs),
          listenWait: summarizeSeries(listenWaitMs)
        },
        null,
        2
      )
    );
  });
  root.command("expose").description("Enable/disable Tailscale serve/funnel for the webhook").option("--mode <mode>", "off | serve (tailnet) | funnel (public)", "funnel").option("--path <path>", "Tailscale path to expose (recommend matching serve.path)").option("--port <port>", "Local webhook port").option("--serve-path <path>", "Local webhook path").action(
    async (options) => {
      const mode = resolveMode(options.mode ?? "funnel");
      const servePort = Number(options.port ?? config.serve.port ?? 3334);
      const servePath = String(options.servePath ?? config.serve.path ?? "/voice/webhook");
      const tsPath = String(options.path ?? config.tailscale?.path ?? servePath);
      const localUrl = `http://127.0.0.1:${servePort}`;
      if (mode === "off") {
        await cleanupTailscaleExposureRoute({ mode: "serve", path: tsPath });
        await cleanupTailscaleExposureRoute({ mode: "funnel", path: tsPath });
        console.log(JSON.stringify({ ok: true, mode: "off", path: tsPath }, null, 2));
        return;
      }
      const publicUrl = await setupTailscaleExposureRoute({
        mode,
        path: tsPath,
        localUrl
      });
      const tsInfo = publicUrl ? null : await getTailscaleSelfInfo();
      const enableUrl = tsInfo?.nodeId ? `https://login.tailscale.com/f/${mode}?node=${tsInfo.nodeId}` : null;
      console.log(
        JSON.stringify(
          {
            ok: Boolean(publicUrl),
            mode,
            path: tsPath,
            localUrl,
            publicUrl,
            hint: publicUrl ? void 0 : {
              note: "Tailscale serve/funnel may be disabled on this tailnet (or require admin enable).",
              enableUrl
            }
          },
          null,
          2
        )
      );
    }
  );
}

// vendor/openclaw-runtime/win-x64/extensions/voice-call/src/config.ts
import {
  TtsAutoSchema,
  TtsConfigSchema,
  TtsModeSchema,
  TtsProviderSchema
} from "openclaw/plugin-sdk";
import { z } from "zod";
var E164Schema = z.string().regex(/^\+[1-9]\d{1,14}$/, "Expected E.164 format, e.g. +15550001234");
var InboundPolicySchema = z.enum(["disabled", "allowlist", "pairing", "open"]);
var TelnyxConfigSchema = z.object({
  /** Telnyx API v2 key */
  apiKey: z.string().min(1).optional(),
  /** Telnyx connection ID (from Call Control app) */
  connectionId: z.string().min(1).optional(),
  /** Public key for webhook signature verification */
  publicKey: z.string().min(1).optional()
}).strict();
var TwilioConfigSchema = z.object({
  /** Twilio Account SID */
  accountSid: z.string().min(1).optional(),
  /** Twilio Auth Token */
  authToken: z.string().min(1).optional()
}).strict();
var PlivoConfigSchema = z.object({
  /** Plivo Auth ID (starts with MA/SA) */
  authId: z.string().min(1).optional(),
  /** Plivo Auth Token */
  authToken: z.string().min(1).optional()
}).strict();
var SttConfigSchema = z.object({
  /** STT provider (currently only OpenAI supported) */
  provider: z.literal("openai").default("openai"),
  /** Whisper model to use */
  model: z.string().min(1).default("whisper-1")
}).strict().default({ provider: "openai", model: "whisper-1" });
var VoiceCallServeConfigSchema = z.object({
  /** Port to listen on */
  port: z.number().int().positive().default(3334),
  /** Bind address */
  bind: z.string().default("127.0.0.1"),
  /** Webhook path */
  path: z.string().min(1).default("/voice/webhook")
}).strict().default({ port: 3334, bind: "127.0.0.1", path: "/voice/webhook" });
var VoiceCallTailscaleConfigSchema = z.object({
  /**
   * Tailscale exposure mode:
   * - "off": No Tailscale exposure
   * - "serve": Tailscale serve (private to tailnet)
   * - "funnel": Tailscale funnel (public HTTPS)
   */
  mode: z.enum(["off", "serve", "funnel"]).default("off"),
  /** Path for Tailscale serve/funnel (should usually match serve.path) */
  path: z.string().min(1).default("/voice/webhook")
}).strict().default({ mode: "off", path: "/voice/webhook" });
var VoiceCallTunnelConfigSchema = z.object({
  /**
   * Tunnel provider:
   * - "none": No tunnel (use publicUrl if set, or manual setup)
   * - "ngrok": Use ngrok for public HTTPS tunnel
   * - "tailscale-serve": Tailscale serve (private to tailnet)
   * - "tailscale-funnel": Tailscale funnel (public HTTPS)
   */
  provider: z.enum(["none", "ngrok", "tailscale-serve", "tailscale-funnel"]).default("none"),
  /** ngrok auth token (optional, enables longer sessions and more features) */
  ngrokAuthToken: z.string().min(1).optional(),
  /** ngrok custom domain (paid feature, e.g., "myapp.ngrok.io") */
  ngrokDomain: z.string().min(1).optional(),
  /**
   * Allow ngrok free tier compatibility mode.
   * When true, forwarded headers may be trusted for loopback requests
   * to reconstruct the public ngrok URL used for signing.
   *
   * IMPORTANT: This does NOT bypass signature verification.
   */
  allowNgrokFreeTierLoopbackBypass: z.boolean().default(false)
}).strict().default({ provider: "none", allowNgrokFreeTierLoopbackBypass: false });
var VoiceCallWebhookSecurityConfigSchema = z.object({
  /**
   * Allowed hostnames for webhook URL reconstruction.
   * Only these hosts are accepted from forwarding headers.
   */
  allowedHosts: z.array(z.string().min(1)).default([]),
  /**
   * Trust X-Forwarded-* headers without a hostname allowlist.
   * WARNING: Only enable if you trust your proxy configuration.
   */
  trustForwardingHeaders: z.boolean().default(false),
  /**
   * Trusted proxy IP addresses. Forwarded headers are only trusted when
   * the remote IP matches one of these addresses.
   */
  trustedProxyIPs: z.array(z.string().min(1)).default([])
}).strict().default({ allowedHosts: [], trustForwardingHeaders: false, trustedProxyIPs: [] });
var CallModeSchema = z.enum(["notify", "conversation"]);
var OutboundConfigSchema = z.object({
  /** Default call mode for outbound calls */
  defaultMode: CallModeSchema.default("notify"),
  /** Seconds to wait after TTS before auto-hangup in notify mode */
  notifyHangupDelaySec: z.number().int().nonnegative().default(3)
}).strict().default({ defaultMode: "notify", notifyHangupDelaySec: 3 });
var VoiceCallStreamingConfigSchema = z.object({
  /** Enable real-time audio streaming (requires WebSocket support) */
  enabled: z.boolean().default(false),
  /** STT provider for real-time transcription */
  sttProvider: z.enum(["openai-realtime"]).default("openai-realtime"),
  /** OpenAI API key for Realtime API (uses OPENAI_API_KEY env if not set) */
  openaiApiKey: z.string().min(1).optional(),
  /** OpenAI transcription model (default: gpt-4o-transcribe) */
  sttModel: z.string().min(1).default("gpt-4o-transcribe"),
  /** VAD silence duration in ms before considering speech ended */
  silenceDurationMs: z.number().int().positive().default(800),
  /** VAD threshold 0-1 (higher = less sensitive) */
  vadThreshold: z.number().min(0).max(1).default(0.5),
  /** WebSocket path for media stream connections */
  streamPath: z.string().min(1).default("/voice/stream"),
  /**
   * Close unauthenticated media stream sockets if no valid `start` frame arrives in time.
   * Protects against pre-auth idle connection hold attacks.
   */
  preStartTimeoutMs: z.number().int().positive().default(5e3),
  /** Maximum number of concurrently pending (pre-start) media stream sockets. */
  maxPendingConnections: z.number().int().positive().default(32),
  /** Maximum pending media stream sockets per source IP. */
  maxPendingConnectionsPerIp: z.number().int().positive().default(4),
  /** Hard cap for all open media stream sockets (pending + active). */
  maxConnections: z.number().int().positive().default(128)
}).strict().default({
  enabled: false,
  sttProvider: "openai-realtime",
  sttModel: "gpt-4o-transcribe",
  silenceDurationMs: 800,
  vadThreshold: 0.5,
  streamPath: "/voice/stream",
  preStartTimeoutMs: 5e3,
  maxPendingConnections: 32,
  maxPendingConnectionsPerIp: 4,
  maxConnections: 128
});
var VoiceCallConfigSchema = z.object({
  /** Enable voice call functionality */
  enabled: z.boolean().default(false),
  /** Active provider (telnyx, twilio, plivo, or mock) */
  provider: z.enum(["telnyx", "twilio", "plivo", "mock"]).optional(),
  /** Telnyx-specific configuration */
  telnyx: TelnyxConfigSchema.optional(),
  /** Twilio-specific configuration */
  twilio: TwilioConfigSchema.optional(),
  /** Plivo-specific configuration */
  plivo: PlivoConfigSchema.optional(),
  /** Phone number to call from (E.164) */
  fromNumber: E164Schema.optional(),
  /** Default phone number to call (E.164) */
  toNumber: E164Schema.optional(),
  /** Inbound call policy */
  inboundPolicy: InboundPolicySchema.default("disabled"),
  /** Allowlist of phone numbers for inbound calls (E.164) */
  allowFrom: z.array(E164Schema).default([]),
  /** Greeting message for inbound calls */
  inboundGreeting: z.string().optional(),
  /** Outbound call configuration */
  outbound: OutboundConfigSchema,
  /** Maximum call duration in seconds */
  maxDurationSeconds: z.number().int().positive().default(300),
  /**
   * Maximum age of a call in seconds before it is automatically reaped.
   * Catches calls stuck in unexpected states (e.g., notify-mode calls that
   * never receive a terminal webhook). Set to 0 to disable.
   * Default: 0 (disabled). Recommended: 120-300 for production.
   */
  staleCallReaperSeconds: z.number().int().nonnegative().default(0),
  /** Silence timeout for end-of-speech detection (ms) */
  silenceTimeoutMs: z.number().int().positive().default(800),
  /** Timeout for user transcript (ms) */
  transcriptTimeoutMs: z.number().int().positive().default(18e4),
  /** Ring timeout for outbound calls (ms) */
  ringTimeoutMs: z.number().int().positive().default(3e4),
  /** Maximum concurrent calls */
  maxConcurrentCalls: z.number().int().positive().default(1),
  /** Webhook server configuration */
  serve: VoiceCallServeConfigSchema,
  /** Tailscale exposure configuration (legacy, prefer tunnel config) */
  tailscale: VoiceCallTailscaleConfigSchema,
  /** Tunnel configuration (unified ngrok/tailscale) */
  tunnel: VoiceCallTunnelConfigSchema,
  /** Webhook signature reconstruction and proxy trust configuration */
  webhookSecurity: VoiceCallWebhookSecurityConfigSchema,
  /** Real-time audio streaming configuration */
  streaming: VoiceCallStreamingConfigSchema,
  /** Public webhook URL override (if set, bypasses tunnel auto-detection) */
  publicUrl: z.string().url().optional(),
  /** Skip webhook signature verification (development only, NOT for production) */
  skipSignatureVerification: z.boolean().default(false),
  /** STT configuration */
  stt: SttConfigSchema,
  /** TTS override (deep-merges with core messages.tts) */
  tts: TtsConfigSchema,
  /** Store path for call logs */
  store: z.string().optional(),
  /** Model for generating voice responses (e.g., "anthropic/claude-sonnet-4", "openai/gpt-4o") */
  responseModel: z.string().default("openai/gpt-4o-mini"),
  /** System prompt for voice responses */
  responseSystemPrompt: z.string().optional(),
  /** Timeout for response generation in ms (default 30s) */
  responseTimeoutMs: z.number().int().positive().default(3e4)
}).strict();
function resolveVoiceCallConfig(config) {
  const resolved = JSON.parse(JSON.stringify(config));
  if (resolved.provider === "telnyx") {
    resolved.telnyx = resolved.telnyx ?? {};
    resolved.telnyx.apiKey = resolved.telnyx.apiKey ?? process.env.TELNYX_API_KEY;
    resolved.telnyx.connectionId = resolved.telnyx.connectionId ?? process.env.TELNYX_CONNECTION_ID;
    resolved.telnyx.publicKey = resolved.telnyx.publicKey ?? process.env.TELNYX_PUBLIC_KEY;
  }
  if (resolved.provider === "twilio") {
    resolved.twilio = resolved.twilio ?? {};
    resolved.twilio.accountSid = resolved.twilio.accountSid ?? process.env.TWILIO_ACCOUNT_SID;
    resolved.twilio.authToken = resolved.twilio.authToken ?? process.env.TWILIO_AUTH_TOKEN;
  }
  if (resolved.provider === "plivo") {
    resolved.plivo = resolved.plivo ?? {};
    resolved.plivo.authId = resolved.plivo.authId ?? process.env.PLIVO_AUTH_ID;
    resolved.plivo.authToken = resolved.plivo.authToken ?? process.env.PLIVO_AUTH_TOKEN;
  }
  resolved.tunnel = resolved.tunnel ?? {
    provider: "none",
    allowNgrokFreeTierLoopbackBypass: false
  };
  resolved.tunnel.allowNgrokFreeTierLoopbackBypass = resolved.tunnel.allowNgrokFreeTierLoopbackBypass ?? false;
  resolved.tunnel.ngrokAuthToken = resolved.tunnel.ngrokAuthToken ?? process.env.NGROK_AUTHTOKEN;
  resolved.tunnel.ngrokDomain = resolved.tunnel.ngrokDomain ?? process.env.NGROK_DOMAIN;
  resolved.webhookSecurity = resolved.webhookSecurity ?? {
    allowedHosts: [],
    trustForwardingHeaders: false,
    trustedProxyIPs: []
  };
  resolved.webhookSecurity.allowedHosts = resolved.webhookSecurity.allowedHosts ?? [];
  resolved.webhookSecurity.trustForwardingHeaders = resolved.webhookSecurity.trustForwardingHeaders ?? false;
  resolved.webhookSecurity.trustedProxyIPs = resolved.webhookSecurity.trustedProxyIPs ?? [];
  return resolved;
}
function validateProviderConfig(config) {
  const errors = [];
  if (!config.enabled) {
    return { valid: true, errors: [] };
  }
  if (!config.provider) {
    errors.push("plugins.entries.voice-call.config.provider is required");
  }
  if (!config.fromNumber && config.provider !== "mock") {
    errors.push("plugins.entries.voice-call.config.fromNumber is required");
  }
  if (config.provider === "telnyx") {
    if (!config.telnyx?.apiKey) {
      errors.push(
        "plugins.entries.voice-call.config.telnyx.apiKey is required (or set TELNYX_API_KEY env)"
      );
    }
    if (!config.telnyx?.connectionId) {
      errors.push(
        "plugins.entries.voice-call.config.telnyx.connectionId is required (or set TELNYX_CONNECTION_ID env)"
      );
    }
    if (!config.skipSignatureVerification && !config.telnyx?.publicKey) {
      errors.push(
        "plugins.entries.voice-call.config.telnyx.publicKey is required (or set TELNYX_PUBLIC_KEY env)"
      );
    }
  }
  if (config.provider === "twilio") {
    if (!config.twilio?.accountSid) {
      errors.push(
        "plugins.entries.voice-call.config.twilio.accountSid is required (or set TWILIO_ACCOUNT_SID env)"
      );
    }
    if (!config.twilio?.authToken) {
      errors.push(
        "plugins.entries.voice-call.config.twilio.authToken is required (or set TWILIO_AUTH_TOKEN env)"
      );
    }
  }
  if (config.provider === "plivo") {
    if (!config.plivo?.authId) {
      errors.push(
        "plugins.entries.voice-call.config.plivo.authId is required (or set PLIVO_AUTH_ID env)"
      );
    }
    if (!config.plivo?.authToken) {
      errors.push(
        "plugins.entries.voice-call.config.plivo.authToken is required (or set PLIVO_AUTH_TOKEN env)"
      );
    }
  }
  return { valid: errors.length === 0, errors };
}

// vendor/openclaw-runtime/win-x64/extensions/voice-call/src/manager.ts
import fs3 from "fs";
import os3 from "os";
import path4 from "path";

// vendor/openclaw-runtime/win-x64/extensions/voice-call/src/manager/events.ts
import crypto2 from "crypto";

// vendor/openclaw-runtime/win-x64/extensions/voice-call/src/allowlist.ts
function normalizePhoneNumber(input) {
  if (!input) {
    return "";
  }
  return input.replace(/\D/g, "");
}
function isAllowlistedCaller(normalizedFrom, allowFrom) {
  if (!normalizedFrom) {
    return false;
  }
  return (allowFrom ?? []).some((num) => {
    const normalizedAllow = normalizePhoneNumber(num);
    return normalizedAllow !== "" && normalizedAllow === normalizedFrom;
  });
}

// vendor/openclaw-runtime/win-x64/extensions/voice-call/src/manager/lookup.ts
function getCallByProviderCallId(params) {
  const callId = params.providerCallIdMap.get(params.providerCallId);
  if (callId) {
    return params.activeCalls.get(callId);
  }
  for (const call of params.activeCalls.values()) {
    if (call.providerCallId === params.providerCallId) {
      return call;
    }
  }
  return void 0;
}
function findCall(params) {
  const directCall = params.activeCalls.get(params.callIdOrProviderCallId);
  if (directCall) {
    return directCall;
  }
  return getCallByProviderCallId({
    activeCalls: params.activeCalls,
    providerCallIdMap: params.providerCallIdMap,
    providerCallId: params.callIdOrProviderCallId
  });
}

// vendor/openclaw-runtime/win-x64/extensions/voice-call/src/manager/outbound.ts
import crypto from "crypto";

// vendor/openclaw-runtime/win-x64/extensions/voice-call/src/types.ts
import { z as z2 } from "zod";
var ProviderNameSchema = z2.enum(["telnyx", "twilio", "plivo", "mock"]);
var CallStateSchema = z2.enum([
  // Non-terminal states
  "initiated",
  "ringing",
  "answered",
  "active",
  "speaking",
  "listening",
  // Terminal states
  "completed",
  "hangup-user",
  "hangup-bot",
  "timeout",
  "error",
  "failed",
  "no-answer",
  "busy",
  "voicemail"
]);
var TerminalStates = /* @__PURE__ */ new Set([
  "completed",
  "hangup-user",
  "hangup-bot",
  "timeout",
  "error",
  "failed",
  "no-answer",
  "busy",
  "voicemail"
]);
var EndReasonSchema = z2.enum([
  "completed",
  "hangup-user",
  "hangup-bot",
  "timeout",
  "error",
  "failed",
  "no-answer",
  "busy",
  "voicemail"
]);
var BaseEventSchema = z2.object({
  id: z2.string(),
  // Stable provider-derived key for idempotency/replay dedupe.
  dedupeKey: z2.string().optional(),
  callId: z2.string(),
  providerCallId: z2.string().optional(),
  timestamp: z2.number(),
  // Optional per-turn nonce for speech events (Twilio <Gather> replay hardening).
  turnToken: z2.string().optional(),
  // Optional fields for inbound call detection
  direction: z2.enum(["inbound", "outbound"]).optional(),
  from: z2.string().optional(),
  to: z2.string().optional()
});
var NormalizedEventSchema = z2.discriminatedUnion("type", [
  BaseEventSchema.extend({
    type: z2.literal("call.initiated")
  }),
  BaseEventSchema.extend({
    type: z2.literal("call.ringing")
  }),
  BaseEventSchema.extend({
    type: z2.literal("call.answered")
  }),
  BaseEventSchema.extend({
    type: z2.literal("call.active")
  }),
  BaseEventSchema.extend({
    type: z2.literal("call.speaking"),
    text: z2.string()
  }),
  BaseEventSchema.extend({
    type: z2.literal("call.speech"),
    transcript: z2.string(),
    isFinal: z2.boolean(),
    confidence: z2.number().min(0).max(1).optional()
  }),
  BaseEventSchema.extend({
    type: z2.literal("call.silence"),
    durationMs: z2.number()
  }),
  BaseEventSchema.extend({
    type: z2.literal("call.dtmf"),
    digits: z2.string()
  }),
  BaseEventSchema.extend({
    type: z2.literal("call.ended"),
    reason: EndReasonSchema
  }),
  BaseEventSchema.extend({
    type: z2.literal("call.error"),
    error: z2.string(),
    retryable: z2.boolean().optional()
  })
]);
var CallDirectionSchema = z2.enum(["outbound", "inbound"]);
var TranscriptEntrySchema = z2.object({
  timestamp: z2.number(),
  speaker: z2.enum(["bot", "user"]),
  text: z2.string(),
  isFinal: z2.boolean().default(true)
});
var CallRecordSchema = z2.object({
  callId: z2.string(),
  providerCallId: z2.string().optional(),
  provider: ProviderNameSchema,
  direction: CallDirectionSchema,
  state: CallStateSchema,
  from: z2.string(),
  to: z2.string(),
  sessionKey: z2.string().optional(),
  startedAt: z2.number(),
  answeredAt: z2.number().optional(),
  endedAt: z2.number().optional(),
  endReason: EndReasonSchema.optional(),
  transcript: z2.array(TranscriptEntrySchema).default([]),
  processedEventIds: z2.array(z2.string()).default([]),
  metadata: z2.record(z2.string(), z2.unknown()).optional()
});

// vendor/openclaw-runtime/win-x64/extensions/voice-call/src/voice-mapping.ts
function escapeXml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
var OPENAI_TO_POLLY_MAP = {
  alloy: "Polly.Joanna",
  // neutral, warm
  echo: "Polly.Matthew",
  // male, warm
  fable: "Polly.Amy",
  // British, expressive
  onyx: "Polly.Brian",
  // deep male
  nova: "Polly.Salli",
  // female, friendly
  shimmer: "Polly.Kimberly"
  // female, clear
};
var DEFAULT_POLLY_VOICE = "Polly.Joanna";
function mapVoiceToPolly(voice) {
  if (!voice) {
    return DEFAULT_POLLY_VOICE;
  }
  if (voice.startsWith("Polly.") || voice.startsWith("Google.")) {
    return voice;
  }
  return OPENAI_TO_POLLY_MAP[voice.toLowerCase()] || DEFAULT_POLLY_VOICE;
}

// vendor/openclaw-runtime/win-x64/extensions/voice-call/src/manager/state.ts
var ConversationStates = /* @__PURE__ */ new Set(["speaking", "listening"]);
var StateOrder = [
  "initiated",
  "ringing",
  "answered",
  "active",
  "speaking",
  "listening"
];
function transitionState(call, newState) {
  if (call.state === newState || TerminalStates.has(call.state)) {
    return;
  }
  if (TerminalStates.has(newState)) {
    call.state = newState;
    return;
  }
  if (ConversationStates.has(call.state) && ConversationStates.has(newState)) {
    call.state = newState;
    return;
  }
  const currentIndex = StateOrder.indexOf(call.state);
  const newIndex = StateOrder.indexOf(newState);
  if (newIndex > currentIndex) {
    call.state = newState;
  }
}
function addTranscriptEntry(call, speaker, text) {
  const entry = {
    timestamp: Date.now(),
    speaker,
    text,
    isFinal: true
  };
  call.transcript.push(entry);
}

// vendor/openclaw-runtime/win-x64/extensions/voice-call/src/manager/store.ts
import fs2 from "fs";
import fsp from "fs/promises";
import path3 from "path";
function persistCallRecord(storePath, call) {
  const logPath = path3.join(storePath, "calls.jsonl");
  const line = `${JSON.stringify(call)}
`;
  fsp.appendFile(logPath, line).catch((err) => {
    console.error("[voice-call] Failed to persist call record:", err);
  });
}
function loadActiveCallsFromStore(storePath) {
  const logPath = path3.join(storePath, "calls.jsonl");
  if (!fs2.existsSync(logPath)) {
    return {
      activeCalls: /* @__PURE__ */ new Map(),
      providerCallIdMap: /* @__PURE__ */ new Map(),
      processedEventIds: /* @__PURE__ */ new Set(),
      rejectedProviderCallIds: /* @__PURE__ */ new Set()
    };
  }
  const content = fs2.readFileSync(logPath, "utf-8");
  const lines = content.split("\n");
  const callMap = /* @__PURE__ */ new Map();
  for (const line of lines) {
    if (!line.trim()) {
      continue;
    }
    try {
      const call = CallRecordSchema.parse(JSON.parse(line));
      callMap.set(call.callId, call);
    } catch {
    }
  }
  const activeCalls = /* @__PURE__ */ new Map();
  const providerCallIdMap = /* @__PURE__ */ new Map();
  const processedEventIds = /* @__PURE__ */ new Set();
  const rejectedProviderCallIds = /* @__PURE__ */ new Set();
  for (const [callId, call] of callMap) {
    if (TerminalStates.has(call.state)) {
      continue;
    }
    activeCalls.set(callId, call);
    if (call.providerCallId) {
      providerCallIdMap.set(call.providerCallId, callId);
    }
    for (const eventId of call.processedEventIds) {
      processedEventIds.add(eventId);
    }
  }
  return { activeCalls, providerCallIdMap, processedEventIds, rejectedProviderCallIds };
}
async function getCallHistoryFromStore(storePath, limit = 50) {
  const logPath = path3.join(storePath, "calls.jsonl");
  try {
    await fsp.access(logPath);
  } catch {
    return [];
  }
  const content = await fsp.readFile(logPath, "utf-8");
  const lines = content.trim().split("\n").filter(Boolean);
  const calls = [];
  for (const line of lines.slice(-limit)) {
    try {
      const parsed = CallRecordSchema.parse(JSON.parse(line));
      calls.push(parsed);
    } catch {
    }
  }
  return calls;
}

// vendor/openclaw-runtime/win-x64/extensions/voice-call/src/manager/timers.ts
function clearMaxDurationTimer(ctx, callId) {
  const timer = ctx.maxDurationTimers.get(callId);
  if (timer) {
    clearTimeout(timer);
    ctx.maxDurationTimers.delete(callId);
  }
}
function startMaxDurationTimer(params) {
  clearMaxDurationTimer(params.ctx, params.callId);
  const maxDurationMs = params.ctx.config.maxDurationSeconds * 1e3;
  console.log(
    `[voice-call] Starting max duration timer (${params.ctx.config.maxDurationSeconds}s) for call ${params.callId}`
  );
  const timer = setTimeout(async () => {
    params.ctx.maxDurationTimers.delete(params.callId);
    const call = params.ctx.activeCalls.get(params.callId);
    if (call && !TerminalStates.has(call.state)) {
      console.log(
        `[voice-call] Max duration reached (${params.ctx.config.maxDurationSeconds}s), ending call ${params.callId}`
      );
      call.endReason = "timeout";
      persistCallRecord(params.ctx.storePath, call);
      await params.onTimeout(params.callId);
    }
  }, maxDurationMs);
  params.ctx.maxDurationTimers.set(params.callId, timer);
}
function clearTranscriptWaiter(ctx, callId) {
  const waiter = ctx.transcriptWaiters.get(callId);
  if (!waiter) {
    return;
  }
  clearTimeout(waiter.timeout);
  ctx.transcriptWaiters.delete(callId);
}
function rejectTranscriptWaiter(ctx, callId, reason) {
  const waiter = ctx.transcriptWaiters.get(callId);
  if (!waiter) {
    return;
  }
  clearTranscriptWaiter(ctx, callId);
  waiter.reject(new Error(reason));
}
function resolveTranscriptWaiter(ctx, callId, transcript, turnToken) {
  const waiter = ctx.transcriptWaiters.get(callId);
  if (!waiter) {
    return false;
  }
  if (waiter.turnToken && waiter.turnToken !== turnToken) {
    return false;
  }
  clearTranscriptWaiter(ctx, callId);
  waiter.resolve(transcript);
  return true;
}
function waitForFinalTranscript(ctx, callId, turnToken) {
  if (ctx.transcriptWaiters.has(callId)) {
    return Promise.reject(new Error("Already waiting for transcript"));
  }
  const timeoutMs = ctx.config.transcriptTimeoutMs;
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      ctx.transcriptWaiters.delete(callId);
      reject(new Error(`Timed out waiting for transcript after ${timeoutMs}ms`));
    }, timeoutMs);
    ctx.transcriptWaiters.set(callId, { resolve, reject, timeout, turnToken });
  });
}

// vendor/openclaw-runtime/win-x64/extensions/voice-call/src/manager/twiml.ts
function generateNotifyTwiml(message, voice) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${voice}">${escapeXml(message)}</Say>
  <Hangup/>
</Response>`;
}

// vendor/openclaw-runtime/win-x64/extensions/voice-call/src/manager/outbound.ts
function lookupConnectedCall(ctx, callId) {
  const call = ctx.activeCalls.get(callId);
  if (!call) {
    return { kind: "error", error: "Call not found" };
  }
  if (!ctx.provider || !call.providerCallId) {
    return { kind: "error", error: "Call not connected" };
  }
  if (TerminalStates.has(call.state)) {
    return { kind: "ended", call };
  }
  return { kind: "ok", call, providerCallId: call.providerCallId, provider: ctx.provider };
}
function requireConnectedCall(ctx, callId) {
  const lookup = lookupConnectedCall(ctx, callId);
  if (lookup.kind === "error") {
    return { ok: false, error: lookup.error };
  }
  if (lookup.kind === "ended") {
    return { ok: false, error: "Call has ended" };
  }
  return {
    ok: true,
    call: lookup.call,
    providerCallId: lookup.providerCallId,
    provider: lookup.provider
  };
}
async function initiateCall(ctx, to, sessionKey, options) {
  const opts = typeof options === "string" ? { message: options } : options ?? {};
  const initialMessage = opts.message;
  const mode = opts.mode ?? ctx.config.outbound.defaultMode;
  if (!ctx.provider) {
    return { callId: "", success: false, error: "Provider not initialized" };
  }
  if (!ctx.webhookUrl) {
    return { callId: "", success: false, error: "Webhook URL not configured" };
  }
  if (ctx.activeCalls.size >= ctx.config.maxConcurrentCalls) {
    return {
      callId: "",
      success: false,
      error: `Maximum concurrent calls (${ctx.config.maxConcurrentCalls}) reached`
    };
  }
  const callId = crypto.randomUUID();
  const from = ctx.config.fromNumber || (ctx.provider?.name === "mock" ? "+15550000000" : void 0);
  if (!from) {
    return { callId: "", success: false, error: "fromNumber not configured" };
  }
  const callRecord = {
    callId,
    provider: ctx.provider.name,
    direction: "outbound",
    state: "initiated",
    from,
    to,
    sessionKey,
    startedAt: Date.now(),
    transcript: [],
    processedEventIds: [],
    metadata: {
      ...initialMessage && { initialMessage },
      mode
    }
  };
  ctx.activeCalls.set(callId, callRecord);
  persistCallRecord(ctx.storePath, callRecord);
  try {
    let inlineTwiml;
    if (mode === "notify" && initialMessage) {
      const pollyVoice = mapVoiceToPolly(ctx.config.tts?.openai?.voice);
      inlineTwiml = generateNotifyTwiml(initialMessage, pollyVoice);
      console.log(`[voice-call] Using inline TwiML for notify mode (voice: ${pollyVoice})`);
    }
    const result = await ctx.provider.initiateCall({
      callId,
      from,
      to,
      webhookUrl: ctx.webhookUrl,
      inlineTwiml
    });
    callRecord.providerCallId = result.providerCallId;
    ctx.providerCallIdMap.set(result.providerCallId, callId);
    persistCallRecord(ctx.storePath, callRecord);
    return { callId, success: true };
  } catch (err) {
    callRecord.state = "failed";
    callRecord.endedAt = Date.now();
    callRecord.endReason = "failed";
    persistCallRecord(ctx.storePath, callRecord);
    ctx.activeCalls.delete(callId);
    if (callRecord.providerCallId) {
      ctx.providerCallIdMap.delete(callRecord.providerCallId);
    }
    return {
      callId,
      success: false,
      error: err instanceof Error ? err.message : String(err)
    };
  }
}
async function speak(ctx, callId, text) {
  const connected = requireConnectedCall(ctx, callId);
  if (!connected.ok) {
    return { success: false, error: connected.error };
  }
  const { call, providerCallId, provider } = connected;
  try {
    transitionState(call, "speaking");
    persistCallRecord(ctx.storePath, call);
    addTranscriptEntry(call, "bot", text);
    const voice = provider.name === "twilio" ? ctx.config.tts?.openai?.voice : void 0;
    await provider.playTts({
      callId,
      providerCallId,
      text,
      voice
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
async function speakInitialMessage(ctx, providerCallId) {
  const call = getCallByProviderCallId({
    activeCalls: ctx.activeCalls,
    providerCallIdMap: ctx.providerCallIdMap,
    providerCallId
  });
  if (!call) {
    console.warn(`[voice-call] speakInitialMessage: no call found for ${providerCallId}`);
    return;
  }
  const initialMessage = call.metadata?.initialMessage;
  const mode = call.metadata?.mode ?? "conversation";
  if (!initialMessage) {
    console.log(`[voice-call] speakInitialMessage: no initial message for ${call.callId}`);
    return;
  }
  if (call.metadata) {
    delete call.metadata.initialMessage;
    persistCallRecord(ctx.storePath, call);
  }
  console.log(`[voice-call] Speaking initial message for call ${call.callId} (mode: ${mode})`);
  const result = await speak(ctx, call.callId, initialMessage);
  if (!result.success) {
    console.warn(`[voice-call] Failed to speak initial message: ${result.error}`);
    return;
  }
  if (mode === "notify") {
    const delaySec = ctx.config.outbound.notifyHangupDelaySec;
    console.log(`[voice-call] Notify mode: auto-hangup in ${delaySec}s for call ${call.callId}`);
    setTimeout(async () => {
      const currentCall = ctx.activeCalls.get(call.callId);
      if (currentCall && !TerminalStates.has(currentCall.state)) {
        console.log(`[voice-call] Notify mode: hanging up call ${call.callId}`);
        await endCall(ctx, call.callId);
      }
    }, delaySec * 1e3);
  }
}
async function continueCall(ctx, callId, prompt) {
  const connected = requireConnectedCall(ctx, callId);
  if (!connected.ok) {
    return { success: false, error: connected.error };
  }
  const { call, providerCallId, provider } = connected;
  if (ctx.activeTurnCalls.has(callId) || ctx.transcriptWaiters.has(callId)) {
    return { success: false, error: "Already waiting for transcript" };
  }
  ctx.activeTurnCalls.add(callId);
  const turnStartedAt = Date.now();
  const turnToken = provider.name === "twilio" ? crypto.randomUUID() : void 0;
  try {
    await speak(ctx, callId, prompt);
    transitionState(call, "listening");
    persistCallRecord(ctx.storePath, call);
    const listenStartedAt = Date.now();
    await provider.startListening({ callId, providerCallId, turnToken });
    const transcript = await waitForFinalTranscript(ctx, callId, turnToken);
    const transcriptReceivedAt = Date.now();
    await provider.stopListening({ callId, providerCallId });
    const lastTurnLatencyMs = transcriptReceivedAt - turnStartedAt;
    const lastTurnListenWaitMs = transcriptReceivedAt - listenStartedAt;
    const turnCount = call.metadata && typeof call.metadata.turnCount === "number" ? call.metadata.turnCount + 1 : 1;
    call.metadata = {
      ...call.metadata ?? {},
      turnCount,
      lastTurnLatencyMs,
      lastTurnListenWaitMs,
      lastTurnCompletedAt: transcriptReceivedAt
    };
    persistCallRecord(ctx.storePath, call);
    console.log(
      "[voice-call] continueCall latency call=" + call.callId + " totalMs=" + String(lastTurnLatencyMs) + " listenWaitMs=" + String(lastTurnListenWaitMs)
    );
    return { success: true, transcript };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  } finally {
    ctx.activeTurnCalls.delete(callId);
    clearTranscriptWaiter(ctx, callId);
  }
}
async function endCall(ctx, callId) {
  const lookup = lookupConnectedCall(ctx, callId);
  if (lookup.kind === "error") {
    return { success: false, error: lookup.error };
  }
  if (lookup.kind === "ended") {
    return { success: true };
  }
  const { call, providerCallId, provider } = lookup;
  try {
    await provider.hangupCall({
      callId,
      providerCallId,
      reason: "hangup-bot"
    });
    call.state = "hangup-bot";
    call.endedAt = Date.now();
    call.endReason = "hangup-bot";
    persistCallRecord(ctx.storePath, call);
    clearMaxDurationTimer(ctx, callId);
    rejectTranscriptWaiter(ctx, callId, "Call ended: hangup-bot");
    ctx.activeCalls.delete(callId);
    ctx.providerCallIdMap.delete(providerCallId);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// vendor/openclaw-runtime/win-x64/extensions/voice-call/src/manager/events.ts
function shouldAcceptInbound(config, from) {
  const { inboundPolicy: policy, allowFrom } = config;
  switch (policy) {
    case "disabled":
      console.log("[voice-call] Inbound call rejected: policy is disabled");
      return false;
    case "open":
      console.log("[voice-call] Inbound call accepted: policy is open");
      return true;
    case "allowlist":
    case "pairing": {
      const normalized = normalizePhoneNumber(from);
      if (!normalized) {
        console.log("[voice-call] Inbound call rejected: missing caller ID");
        return false;
      }
      const allowed = isAllowlistedCaller(normalized, allowFrom);
      const status = allowed ? "accepted" : "rejected";
      console.log(
        `[voice-call] Inbound call ${status}: ${from} ${allowed ? "is in" : "not in"} allowlist`
      );
      return allowed;
    }
    default:
      return false;
  }
}
function createWebhookCall(params) {
  const callId = crypto2.randomUUID();
  const callRecord = {
    callId,
    providerCallId: params.providerCallId,
    provider: params.ctx.provider?.name || "twilio",
    direction: params.direction,
    state: "ringing",
    from: params.from,
    to: params.to,
    startedAt: Date.now(),
    transcript: [],
    processedEventIds: [],
    metadata: {
      initialMessage: params.direction === "inbound" ? params.ctx.config.inboundGreeting || "Hello! How can I help you today?" : void 0
    }
  };
  params.ctx.activeCalls.set(callId, callRecord);
  params.ctx.providerCallIdMap.set(params.providerCallId, callId);
  persistCallRecord(params.ctx.storePath, callRecord);
  console.log(
    `[voice-call] Created ${params.direction} call record: ${callId} from ${params.from}`
  );
  return callRecord;
}
function processEvent(ctx, event) {
  const dedupeKey = event.dedupeKey || event.id;
  if (ctx.processedEventIds.has(dedupeKey)) {
    return;
  }
  ctx.processedEventIds.add(dedupeKey);
  let call = findCall({
    activeCalls: ctx.activeCalls,
    providerCallIdMap: ctx.providerCallIdMap,
    callIdOrProviderCallId: event.callId
  });
  const providerCallId = event.providerCallId;
  const eventDirection = event.direction === "inbound" || event.direction === "outbound" ? event.direction : void 0;
  if (!call && providerCallId && eventDirection) {
    if (eventDirection === "inbound" && !shouldAcceptInbound(ctx.config, event.from)) {
      const pid = providerCallId;
      if (!ctx.provider) {
        console.warn(
          `[voice-call] Inbound call rejected by policy but no provider to hang up (providerCallId: ${pid}, from: ${event.from}); call will time out on provider side.`
        );
        return;
      }
      if (ctx.rejectedProviderCallIds.has(pid)) {
        return;
      }
      ctx.rejectedProviderCallIds.add(pid);
      const callId = event.callId ?? pid;
      console.log(`[voice-call] Rejecting inbound call by policy: ${pid}`);
      void ctx.provider.hangupCall({
        callId,
        providerCallId: pid,
        reason: "hangup-bot"
      }).catch((err) => {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(`[voice-call] Failed to reject inbound call ${pid}:`, message);
      });
      return;
    }
    call = createWebhookCall({
      ctx,
      providerCallId,
      direction: eventDirection === "outbound" ? "outbound" : "inbound",
      from: event.from || "unknown",
      to: event.to || ctx.config.fromNumber || "unknown"
    });
    event.callId = call.callId;
  }
  if (!call) {
    return;
  }
  if (event.providerCallId && event.providerCallId !== call.providerCallId) {
    const previousProviderCallId = call.providerCallId;
    call.providerCallId = event.providerCallId;
    ctx.providerCallIdMap.set(event.providerCallId, call.callId);
    if (previousProviderCallId) {
      const mapped = ctx.providerCallIdMap.get(previousProviderCallId);
      if (mapped === call.callId) {
        ctx.providerCallIdMap.delete(previousProviderCallId);
      }
    }
  }
  call.processedEventIds.push(dedupeKey);
  switch (event.type) {
    case "call.initiated":
      transitionState(call, "initiated");
      break;
    case "call.ringing":
      transitionState(call, "ringing");
      break;
    case "call.answered":
      call.answeredAt = event.timestamp;
      transitionState(call, "answered");
      startMaxDurationTimer({
        ctx,
        callId: call.callId,
        onTimeout: async (callId) => {
          await endCall(ctx, callId);
        }
      });
      ctx.onCallAnswered?.(call);
      break;
    case "call.active":
      transitionState(call, "active");
      break;
    case "call.speaking":
      transitionState(call, "speaking");
      break;
    case "call.speech":
      if (event.isFinal) {
        const hadWaiter = ctx.transcriptWaiters.has(call.callId);
        const resolved = resolveTranscriptWaiter(
          ctx,
          call.callId,
          event.transcript,
          event.turnToken
        );
        if (hadWaiter && !resolved) {
          console.warn(
            `[voice-call] Ignoring speech event with mismatched turn token for ${call.callId}`
          );
          break;
        }
        addTranscriptEntry(call, "user", event.transcript);
      }
      transitionState(call, "listening");
      break;
    case "call.ended":
      call.endedAt = event.timestamp;
      call.endReason = event.reason;
      transitionState(call, event.reason);
      clearMaxDurationTimer(ctx, call.callId);
      rejectTranscriptWaiter(ctx, call.callId, `Call ended: ${event.reason}`);
      ctx.activeCalls.delete(call.callId);
      if (call.providerCallId) {
        ctx.providerCallIdMap.delete(call.providerCallId);
      }
      break;
    case "call.error":
      if (!event.retryable) {
        call.endedAt = event.timestamp;
        call.endReason = "error";
        transitionState(call, "error");
        clearMaxDurationTimer(ctx, call.callId);
        rejectTranscriptWaiter(ctx, call.callId, `Call error: ${event.error}`);
        ctx.activeCalls.delete(call.callId);
        if (call.providerCallId) {
          ctx.providerCallIdMap.delete(call.providerCallId);
        }
      }
      break;
  }
  persistCallRecord(ctx.storePath, call);
}

// vendor/openclaw-runtime/win-x64/extensions/voice-call/src/manager.ts
function resolveDefaultStoreBase(config, storePath) {
  const rawOverride = storePath?.trim() || config.store?.trim();
  if (rawOverride) {
    return resolveUserPath(rawOverride);
  }
  const preferred = path4.join(os3.homedir(), ".openclaw", "voice-calls");
  const candidates = [preferred].map((dir) => resolveUserPath(dir));
  const existing = candidates.find((dir) => {
    try {
      return fs3.existsSync(path4.join(dir, "calls.jsonl")) || fs3.existsSync(dir);
    } catch {
      return false;
    }
  }) ?? resolveUserPath(preferred);
  return existing;
}
var CallManager = class {
  activeCalls = /* @__PURE__ */ new Map();
  providerCallIdMap = /* @__PURE__ */ new Map();
  processedEventIds = /* @__PURE__ */ new Set();
  rejectedProviderCallIds = /* @__PURE__ */ new Set();
  provider = null;
  config;
  storePath;
  webhookUrl = null;
  activeTurnCalls = /* @__PURE__ */ new Set();
  transcriptWaiters = /* @__PURE__ */ new Map();
  maxDurationTimers = /* @__PURE__ */ new Map();
  constructor(config, storePath) {
    this.config = config;
    this.storePath = resolveDefaultStoreBase(config, storePath);
  }
  /**
   * Initialize the call manager with a provider.
   * Verifies persisted calls with the provider and restarts timers.
   */
  async initialize(provider, webhookUrl) {
    this.provider = provider;
    this.webhookUrl = webhookUrl;
    fs3.mkdirSync(this.storePath, { recursive: true });
    const persisted = loadActiveCallsFromStore(this.storePath);
    this.processedEventIds = persisted.processedEventIds;
    this.rejectedProviderCallIds = persisted.rejectedProviderCallIds;
    const verified = await this.verifyRestoredCalls(provider, persisted.activeCalls);
    this.activeCalls = verified;
    this.providerCallIdMap = /* @__PURE__ */ new Map();
    for (const [callId, call] of verified) {
      if (call.providerCallId) {
        this.providerCallIdMap.set(call.providerCallId, callId);
      }
    }
    for (const [callId, call] of verified) {
      if (call.answeredAt && !TerminalStates.has(call.state)) {
        const elapsed = Date.now() - call.answeredAt;
        const maxDurationMs = this.config.maxDurationSeconds * 1e3;
        if (elapsed >= maxDurationMs) {
          verified.delete(callId);
          if (call.providerCallId) {
            this.providerCallIdMap.delete(call.providerCallId);
          }
          console.log(
            `[voice-call] Skipping restored call ${callId} (max duration already elapsed)`
          );
          continue;
        }
        startMaxDurationTimer({
          ctx: this.getContext(),
          callId,
          onTimeout: async (id) => {
            await endCall(this.getContext(), id);
          }
        });
        console.log(`[voice-call] Restarted max-duration timer for restored call ${callId}`);
      }
    }
    if (verified.size > 0) {
      console.log(`[voice-call] Restored ${verified.size} active call(s) from store`);
    }
  }
  /**
   * Verify persisted calls with the provider before restoring.
   * Calls without providerCallId or older than maxDurationSeconds are skipped.
   * Transient provider errors keep the call (rely on timer fallback).
   */
  async verifyRestoredCalls(provider, candidates) {
    if (candidates.size === 0) {
      return /* @__PURE__ */ new Map();
    }
    const maxAgeMs = this.config.maxDurationSeconds * 1e3;
    const now = Date.now();
    const verified = /* @__PURE__ */ new Map();
    const verifyTasks = [];
    for (const [callId, call] of candidates) {
      if (!call.providerCallId) {
        console.log(`[voice-call] Skipping restored call ${callId} (no providerCallId)`);
        continue;
      }
      if (now - call.startedAt > maxAgeMs) {
        console.log(
          `[voice-call] Skipping restored call ${callId} (older than maxDurationSeconds)`
        );
        continue;
      }
      const task = {
        callId,
        call,
        promise: provider.getCallStatus({ providerCallId: call.providerCallId }).then((result) => {
          if (result.isTerminal) {
            console.log(
              `[voice-call] Skipping restored call ${callId} (provider status: ${result.status})`
            );
          } else if (result.isUnknown) {
            console.log(
              `[voice-call] Keeping restored call ${callId} (provider status unknown, relying on timer)`
            );
            verified.set(callId, call);
          } else {
            verified.set(callId, call);
          }
        }).catch(() => {
          console.log(
            `[voice-call] Keeping restored call ${callId} (verification failed, relying on timer)`
          );
          verified.set(callId, call);
        })
      };
      verifyTasks.push(task);
    }
    await Promise.allSettled(verifyTasks.map((t) => t.promise));
    return verified;
  }
  /**
   * Get the current provider.
   */
  getProvider() {
    return this.provider;
  }
  /**
   * Initiate an outbound call.
   */
  async initiateCall(to, sessionKey, options) {
    return initiateCall(this.getContext(), to, sessionKey, options);
  }
  /**
   * Speak to user in an active call.
   */
  async speak(callId, text) {
    return speak(this.getContext(), callId, text);
  }
  /**
   * Speak the initial message for a call (called when media stream connects).
   */
  async speakInitialMessage(providerCallId) {
    return speakInitialMessage(this.getContext(), providerCallId);
  }
  /**
   * Continue call: speak prompt, then wait for user's final transcript.
   */
  async continueCall(callId, prompt) {
    return continueCall(this.getContext(), callId, prompt);
  }
  /**
   * End an active call.
   */
  async endCall(callId) {
    return endCall(this.getContext(), callId);
  }
  getContext() {
    return {
      activeCalls: this.activeCalls,
      providerCallIdMap: this.providerCallIdMap,
      processedEventIds: this.processedEventIds,
      rejectedProviderCallIds: this.rejectedProviderCallIds,
      provider: this.provider,
      config: this.config,
      storePath: this.storePath,
      webhookUrl: this.webhookUrl,
      activeTurnCalls: this.activeTurnCalls,
      transcriptWaiters: this.transcriptWaiters,
      maxDurationTimers: this.maxDurationTimers,
      onCallAnswered: (call) => {
        this.maybeSpeakInitialMessageOnAnswered(call);
      }
    };
  }
  /**
   * Process a webhook event.
   */
  processEvent(event) {
    processEvent(this.getContext(), event);
  }
  maybeSpeakInitialMessageOnAnswered(call) {
    const initialMessage = typeof call.metadata?.initialMessage === "string" ? call.metadata.initialMessage.trim() : "";
    if (!initialMessage) {
      return;
    }
    if (!this.provider || !call.providerCallId) {
      return;
    }
    void this.speakInitialMessage(call.providerCallId);
  }
  /**
   * Get an active call by ID.
   */
  getCall(callId) {
    return this.activeCalls.get(callId);
  }
  /**
   * Get an active call by provider call ID (e.g., Twilio CallSid).
   */
  getCallByProviderCallId(providerCallId) {
    return getCallByProviderCallId({
      activeCalls: this.activeCalls,
      providerCallIdMap: this.providerCallIdMap,
      providerCallId
    });
  }
  /**
   * Get all active calls.
   */
  getActiveCalls() {
    return Array.from(this.activeCalls.values());
  }
  /**
   * Get call history (from persisted logs).
   */
  async getCallHistory(limit = 50) {
    return getCallHistoryFromStore(this.storePath, limit);
  }
};

// vendor/openclaw-runtime/win-x64/extensions/voice-call/src/providers/mock.ts
import crypto3 from "crypto";
var MockProvider = class {
  name = "mock";
  verifyWebhook(_ctx) {
    return { ok: true };
  }
  parseWebhookEvent(ctx, _options) {
    try {
      const payload = JSON.parse(ctx.rawBody);
      const events = [];
      if (Array.isArray(payload.events)) {
        for (const evt of payload.events) {
          const normalized = this.normalizeEvent(evt);
          if (normalized) {
            events.push(normalized);
          }
        }
      } else if (payload.event) {
        const normalized = this.normalizeEvent(payload.event);
        if (normalized) {
          events.push(normalized);
        }
      }
      return { events, statusCode: 200 };
    } catch {
      return { events: [], statusCode: 400 };
    }
  }
  normalizeEvent(evt) {
    if (!evt.type || !evt.callId) {
      return null;
    }
    const base = {
      id: evt.id || crypto3.randomUUID(),
      callId: evt.callId,
      providerCallId: evt.providerCallId,
      timestamp: evt.timestamp || Date.now()
    };
    switch (evt.type) {
      case "call.initiated":
      case "call.ringing":
      case "call.answered":
      case "call.active":
        return { ...base, type: evt.type };
      case "call.speaking": {
        const payload = evt;
        return {
          ...base,
          type: evt.type,
          text: payload.text || ""
        };
      }
      case "call.speech": {
        const payload = evt;
        return {
          ...base,
          type: evt.type,
          transcript: payload.transcript || "",
          isFinal: payload.isFinal ?? true,
          confidence: payload.confidence
        };
      }
      case "call.silence": {
        const payload = evt;
        return {
          ...base,
          type: evt.type,
          durationMs: payload.durationMs || 0
        };
      }
      case "call.dtmf": {
        const payload = evt;
        return {
          ...base,
          type: evt.type,
          digits: payload.digits || ""
        };
      }
      case "call.ended": {
        const payload = evt;
        return {
          ...base,
          type: evt.type,
          reason: payload.reason || "completed"
        };
      }
      case "call.error": {
        const payload = evt;
        return {
          ...base,
          type: evt.type,
          error: payload.error || "unknown error",
          retryable: payload.retryable
        };
      }
      default:
        return null;
    }
  }
  async initiateCall(input) {
    return {
      providerCallId: `mock-${input.callId}`,
      status: "initiated"
    };
  }
  async hangupCall(_input) {
  }
  async playTts(_input) {
  }
  async startListening(_input) {
  }
  async stopListening(_input) {
  }
  async getCallStatus(input) {
    const id = input.providerCallId.toLowerCase();
    if (id.includes("stale") || id.includes("ended") || id.includes("completed")) {
      return { status: "completed", isTerminal: true };
    }
    return { status: "in-progress", isTerminal: false };
  }
};

// vendor/openclaw-runtime/win-x64/extensions/voice-call/src/providers/plivo.ts
import crypto5 from "crypto";

// vendor/openclaw-runtime/win-x64/extensions/voice-call/src/http-headers.ts
function getHeader(headers, name) {
  const target = name.toLowerCase();
  const direct = headers[target];
  const value = direct ?? Object.entries(headers).find(([key]) => key.toLowerCase() === target)?.[1];
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

// vendor/openclaw-runtime/win-x64/extensions/voice-call/src/webhook-security.ts
import crypto4 from "crypto";
var REPLAY_WINDOW_MS = 10 * 60 * 1e3;
var REPLAY_CACHE_MAX_ENTRIES = 1e4;
var REPLAY_CACHE_PRUNE_INTERVAL = 64;
var twilioReplayCache = {
  seenUntil: /* @__PURE__ */ new Map(),
  calls: 0
};
var plivoReplayCache = {
  seenUntil: /* @__PURE__ */ new Map(),
  calls: 0
};
var telnyxReplayCache = {
  seenUntil: /* @__PURE__ */ new Map(),
  calls: 0
};
function sha256Hex(input) {
  return crypto4.createHash("sha256").update(input).digest("hex");
}
function createSkippedVerificationReplayKey(provider, ctx) {
  return `${provider}:skip:${sha256Hex(`${ctx.method}
${ctx.url}
${ctx.rawBody}`)}`;
}
function pruneReplayCache(cache, now) {
  for (const [key, expiresAt] of cache.seenUntil) {
    if (expiresAt <= now) {
      cache.seenUntil.delete(key);
    }
  }
  while (cache.seenUntil.size > REPLAY_CACHE_MAX_ENTRIES) {
    const oldest = cache.seenUntil.keys().next().value;
    if (!oldest) {
      break;
    }
    cache.seenUntil.delete(oldest);
  }
}
function markReplay(cache, replayKey) {
  const now = Date.now();
  cache.calls += 1;
  if (cache.calls % REPLAY_CACHE_PRUNE_INTERVAL === 0) {
    pruneReplayCache(cache, now);
  }
  const existing = cache.seenUntil.get(replayKey);
  if (existing && existing > now) {
    return true;
  }
  cache.seenUntil.set(replayKey, now + REPLAY_WINDOW_MS);
  if (cache.seenUntil.size > REPLAY_CACHE_MAX_ENTRIES) {
    pruneReplayCache(cache, now);
  }
  return false;
}
function validateTwilioSignature(authToken, signature, url, params) {
  if (!signature) {
    return false;
  }
  const dataToSign = buildTwilioDataToSign(url, params);
  const expectedSignature = crypto4.createHmac("sha1", authToken).update(dataToSign).digest("base64");
  return timingSafeEqual(signature, expectedSignature);
}
function buildTwilioDataToSign(url, params) {
  let dataToSign = url;
  const sortedParams = Array.from(params.entries()).toSorted(
    (a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0
  );
  for (const [key, value] of sortedParams) {
    dataToSign += key + value;
  }
  return dataToSign;
}
function buildCanonicalTwilioParamString(params) {
  return Array.from(params.entries()).toSorted((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0).map(([key, value]) => `${key}=${value}`).join("&");
}
function timingSafeEqual(a, b) {
  if (a.length !== b.length) {
    const dummy = Buffer.from(a);
    crypto4.timingSafeEqual(dummy, dummy);
    return false;
  }
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return crypto4.timingSafeEqual(bufA, bufB);
}
function isValidHostname(hostname) {
  if (!hostname || hostname.length > 253) {
    return false;
  }
  const hostnameRegex = /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;
  return hostnameRegex.test(hostname);
}
function extractHostname(hostHeader) {
  if (!hostHeader) {
    return null;
  }
  let hostname;
  if (hostHeader.startsWith("[")) {
    const endBracket = hostHeader.indexOf("]");
    if (endBracket === -1) {
      return null;
    }
    hostname = hostHeader.substring(1, endBracket);
    return hostname.toLowerCase();
  }
  if (hostHeader.includes("@")) {
    return null;
  }
  hostname = hostHeader.split(":")[0];
  if (!isValidHostname(hostname)) {
    return null;
  }
  return hostname.toLowerCase();
}
function extractHostnameFromHeader(headerValue) {
  const first = headerValue.split(",")[0]?.trim();
  if (!first) {
    return null;
  }
  return extractHostname(first);
}
function normalizeAllowedHosts(allowedHosts) {
  if (!allowedHosts || allowedHosts.length === 0) {
    return null;
  }
  const normalized = /* @__PURE__ */ new Set();
  for (const host of allowedHosts) {
    const extracted = extractHostname(host.trim());
    if (extracted) {
      normalized.add(extracted);
    }
  }
  return normalized.size > 0 ? normalized : null;
}
function reconstructWebhookUrl(ctx, options) {
  const { headers } = ctx;
  const allowedHosts = normalizeAllowedHosts(options?.allowedHosts);
  const hasAllowedHosts = allowedHosts !== null;
  const explicitlyTrusted = options?.trustForwardingHeaders === true;
  const trustedProxyIPs = options?.trustedProxyIPs?.filter(Boolean) ?? [];
  const hasTrustedProxyIPs = trustedProxyIPs.length > 0;
  const remoteIP = options?.remoteIP ?? ctx.remoteAddress;
  const fromTrustedProxy = !hasTrustedProxyIPs || (remoteIP ? trustedProxyIPs.includes(remoteIP) : false);
  const shouldTrustForwardingHeaders = (hasAllowedHosts || explicitlyTrusted) && fromTrustedProxy;
  const isAllowedForwardedHost = (host2) => !allowedHosts || allowedHosts.has(host2);
  let proto = "https";
  if (shouldTrustForwardingHeaders) {
    const forwardedProto = getHeader(headers, "x-forwarded-proto");
    if (forwardedProto === "http" || forwardedProto === "https") {
      proto = forwardedProto;
    }
  }
  let host = null;
  if (shouldTrustForwardingHeaders) {
    const forwardingHeaders = ["x-forwarded-host", "x-original-host", "ngrok-forwarded-host"];
    for (const headerName of forwardingHeaders) {
      const headerValue = getHeader(headers, headerName);
      if (headerValue) {
        const extracted = extractHostnameFromHeader(headerValue);
        if (extracted && isAllowedForwardedHost(extracted)) {
          host = extracted;
          break;
        }
      }
    }
  }
  if (!host) {
    const hostHeader = getHeader(headers, "host");
    if (hostHeader) {
      const extracted = extractHostnameFromHeader(hostHeader);
      if (extracted) {
        host = extracted;
      }
    }
  }
  if (!host) {
    try {
      const parsed = new URL(ctx.url);
      const extracted = extractHostname(parsed.host);
      if (extracted) {
        host = extracted;
      }
    } catch {
      host = "";
    }
  }
  if (!host) {
    host = "";
  }
  let path6 = "/";
  try {
    const parsed = new URL(ctx.url);
    path6 = parsed.pathname + parsed.search;
  } catch {
  }
  return `${proto}://${host}${path6}`;
}
function buildTwilioVerificationUrl(ctx, publicUrl, urlOptions) {
  if (!publicUrl) {
    return reconstructWebhookUrl(ctx, urlOptions);
  }
  try {
    const base = new URL(publicUrl);
    const requestUrl = new URL(ctx.url);
    base.pathname = requestUrl.pathname;
    base.search = requestUrl.search;
    return base.toString();
  } catch {
    return publicUrl;
  }
}
function isLoopbackAddress(address) {
  if (!address) {
    return false;
  }
  if (address === "127.0.0.1" || address === "::1") {
    return true;
  }
  if (address.startsWith("::ffff:127.")) {
    return true;
  }
  return false;
}
function stripPortFromUrl(url) {
  try {
    const parsed = new URL(url);
    if (!parsed.port) {
      return url;
    }
    parsed.port = "";
    return parsed.toString();
  } catch {
    return url;
  }
}
function setPortOnUrl(url, port) {
  try {
    const parsed = new URL(url);
    parsed.port = port;
    return parsed.toString();
  } catch {
    return url;
  }
}
function extractPortFromHostHeader(hostHeader) {
  if (!hostHeader) {
    return void 0;
  }
  try {
    const parsed = new URL(`https://${hostHeader}`);
    return parsed.port || void 0;
  } catch {
    return void 0;
  }
}
function createTwilioReplayKey(params) {
  const canonicalParams = buildCanonicalTwilioParamString(params.requestParams);
  return `twilio:req:${sha256Hex(
    `${params.verificationUrl}
${canonicalParams}
${params.signature}`
  )}`;
}
function decodeBase64OrBase64Url(input) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padLen = (4 - normalized.length % 4) % 4;
  const padded = normalized + "=".repeat(padLen);
  return Buffer.from(padded, "base64");
}
function base64UrlEncode(buf) {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function importEd25519PublicKey(publicKey) {
  const trimmed = publicKey.trim();
  if (trimmed.startsWith("-----BEGIN")) {
    return trimmed;
  }
  const decoded = decodeBase64OrBase64Url(trimmed);
  if (decoded.length === 32) {
    return crypto4.createPublicKey({
      key: { kty: "OKP", crv: "Ed25519", x: base64UrlEncode(decoded) },
      format: "jwk"
    });
  }
  return crypto4.createPublicKey({
    key: decoded,
    format: "der",
    type: "spki"
  });
}
function verifyTelnyxWebhook(ctx, publicKey, options) {
  if (options?.skipVerification) {
    const replayKey = createSkippedVerificationReplayKey("telnyx", ctx);
    const isReplay = markReplay(telnyxReplayCache, replayKey);
    return {
      ok: true,
      reason: "verification skipped (dev mode)",
      isReplay,
      verifiedRequestKey: replayKey
    };
  }
  if (!publicKey) {
    return { ok: false, reason: "Missing telnyx.publicKey (configure to verify webhooks)" };
  }
  const signature = getHeader(ctx.headers, "telnyx-signature-ed25519");
  const timestamp = getHeader(ctx.headers, "telnyx-timestamp");
  if (!signature || !timestamp) {
    return { ok: false, reason: "Missing signature or timestamp header" };
  }
  const eventTimeSec = parseInt(timestamp, 10);
  if (!Number.isFinite(eventTimeSec)) {
    return { ok: false, reason: "Invalid timestamp header" };
  }
  try {
    const signedPayload = `${timestamp}|${ctx.rawBody}`;
    const signatureBuffer = decodeBase64OrBase64Url(signature);
    const key = importEd25519PublicKey(publicKey);
    const isValid = crypto4.verify(null, Buffer.from(signedPayload), key, signatureBuffer);
    if (!isValid) {
      return { ok: false, reason: "Invalid signature" };
    }
    const maxSkewMs = options?.maxSkewMs ?? 5 * 60 * 1e3;
    const eventTimeMs = eventTimeSec * 1e3;
    const now = Date.now();
    if (Math.abs(now - eventTimeMs) > maxSkewMs) {
      return { ok: false, reason: "Timestamp too old" };
    }
    const replayKey = `telnyx:${sha256Hex(`${timestamp}
${signature}
${ctx.rawBody}`)}`;
    const isReplay = markReplay(telnyxReplayCache, replayKey);
    return { ok: true, isReplay, verifiedRequestKey: replayKey };
  } catch (err) {
    return {
      ok: false,
      reason: `Verification error: ${err instanceof Error ? err.message : String(err)}`
    };
  }
}
function verifyTwilioWebhook(ctx, authToken, options) {
  if (options?.skipVerification) {
    const replayKey = createSkippedVerificationReplayKey("twilio", ctx);
    const isReplay = markReplay(twilioReplayCache, replayKey);
    return {
      ok: true,
      reason: "verification skipped (dev mode)",
      isReplay,
      verifiedRequestKey: replayKey
    };
  }
  const signature = getHeader(ctx.headers, "x-twilio-signature");
  if (!signature) {
    return { ok: false, reason: "Missing X-Twilio-Signature header" };
  }
  const isLoopback = isLoopbackAddress(options?.remoteIP ?? ctx.remoteAddress);
  const allowLoopbackForwarding = options?.allowNgrokFreeTierLoopbackBypass && isLoopback;
  const verificationUrl = buildTwilioVerificationUrl(ctx, options?.publicUrl, {
    allowedHosts: options?.allowedHosts,
    trustForwardingHeaders: options?.trustForwardingHeaders || allowLoopbackForwarding,
    trustedProxyIPs: options?.trustedProxyIPs,
    remoteIP: options?.remoteIP
  });
  const params = new URLSearchParams(ctx.rawBody);
  const isValid = validateTwilioSignature(authToken, signature, verificationUrl, params);
  if (isValid) {
    const replayKey = createTwilioReplayKey({
      verificationUrl,
      signature,
      requestParams: params
    });
    const isReplay = markReplay(twilioReplayCache, replayKey);
    return { ok: true, verificationUrl, isReplay, verifiedRequestKey: replayKey };
  }
  const variants = /* @__PURE__ */ new Set();
  variants.add(verificationUrl);
  variants.add(stripPortFromUrl(verificationUrl));
  if (options?.publicUrl) {
    try {
      const publicPort = new URL(options.publicUrl).port;
      if (publicPort) {
        variants.add(setPortOnUrl(verificationUrl, publicPort));
      }
    } catch {
    }
  }
  const hostHeaderPort = extractPortFromHostHeader(getHeader(ctx.headers, "host"));
  if (hostHeaderPort) {
    variants.add(setPortOnUrl(verificationUrl, hostHeaderPort));
  }
  for (const candidateUrl of variants) {
    if (candidateUrl === verificationUrl) {
      continue;
    }
    const isValidCandidate = validateTwilioSignature(authToken, signature, candidateUrl, params);
    if (!isValidCandidate) {
      continue;
    }
    const replayKey = createTwilioReplayKey({
      verificationUrl: candidateUrl,
      signature,
      requestParams: params
    });
    const isReplay = markReplay(twilioReplayCache, replayKey);
    return { ok: true, verificationUrl: candidateUrl, isReplay, verifiedRequestKey: replayKey };
  }
  const isNgrokFreeTier = verificationUrl.includes(".ngrok-free.app") || verificationUrl.includes(".ngrok.io");
  return {
    ok: false,
    reason: `Invalid signature for URL: ${verificationUrl}`,
    verificationUrl,
    isNgrokFreeTier
  };
}
function normalizeSignatureBase64(input) {
  return Buffer.from(input, "base64").toString("base64");
}
function getBaseUrlNoQuery(url) {
  const u = new URL(url);
  return `${u.protocol}//${u.host}${u.pathname}`;
}
function timingSafeEqualString(a, b) {
  if (a.length !== b.length) {
    const dummy = Buffer.from(a);
    crypto4.timingSafeEqual(dummy, dummy);
    return false;
  }
  return crypto4.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
function validatePlivoV2Signature(params) {
  const baseUrl = getBaseUrlNoQuery(params.url);
  const digest = crypto4.createHmac("sha256", params.authToken).update(baseUrl + params.nonce).digest("base64");
  const expected = normalizeSignatureBase64(digest);
  const provided = normalizeSignatureBase64(params.signature);
  return timingSafeEqualString(expected, provided);
}
function toParamMapFromSearchParams(sp) {
  const map = {};
  for (const [key, value] of sp.entries()) {
    if (!map[key]) {
      map[key] = [];
    }
    map[key].push(value);
  }
  return map;
}
function sortedQueryString(params) {
  const parts = [];
  for (const key of Object.keys(params).toSorted()) {
    const values = [...params[key]].toSorted();
    for (const value of values) {
      parts.push(`${key}=${value}`);
    }
  }
  return parts.join("&");
}
function sortedParamsString(params) {
  const parts = [];
  for (const key of Object.keys(params).toSorted()) {
    const values = [...params[key]].toSorted();
    for (const value of values) {
      parts.push(`${key}${value}`);
    }
  }
  return parts.join("");
}
function constructPlivoV3BaseUrl(params) {
  const hasPostParams = Object.keys(params.postParams).length > 0;
  const u = new URL(params.url);
  const baseNoQuery = `${u.protocol}//${u.host}${u.pathname}`;
  const queryMap = toParamMapFromSearchParams(u.searchParams);
  const queryString = sortedQueryString(queryMap);
  let baseUrl = baseNoQuery;
  if (queryString.length > 0 || hasPostParams) {
    baseUrl = `${baseNoQuery}?${queryString}`;
  }
  if (queryString.length > 0 && hasPostParams) {
    baseUrl = `${baseUrl}.`;
  }
  if (params.method === "GET") {
    return baseUrl;
  }
  return baseUrl + sortedParamsString(params.postParams);
}
function validatePlivoV3Signature(params) {
  const baseUrl = constructPlivoV3BaseUrl({
    method: params.method,
    url: params.url,
    postParams: params.postParams
  });
  const hmacBase = `${baseUrl}.${params.nonce}`;
  const digest = crypto4.createHmac("sha256", params.authToken).update(hmacBase).digest("base64");
  const expected = normalizeSignatureBase64(digest);
  const provided = params.signatureHeader.split(",").map((s) => s.trim()).filter(Boolean).map((s) => normalizeSignatureBase64(s));
  for (const sig of provided) {
    if (timingSafeEqualString(expected, sig)) {
      return true;
    }
  }
  return false;
}
function verifyPlivoWebhook(ctx, authToken, options) {
  if (options?.skipVerification) {
    const replayKey = createSkippedVerificationReplayKey("plivo", ctx);
    const isReplay = markReplay(plivoReplayCache, replayKey);
    return {
      ok: true,
      reason: "verification skipped (dev mode)",
      isReplay,
      verifiedRequestKey: replayKey
    };
  }
  const signatureV3 = getHeader(ctx.headers, "x-plivo-signature-v3");
  const nonceV3 = getHeader(ctx.headers, "x-plivo-signature-v3-nonce");
  const signatureV2 = getHeader(ctx.headers, "x-plivo-signature-v2");
  const nonceV2 = getHeader(ctx.headers, "x-plivo-signature-v2-nonce");
  const reconstructed = reconstructWebhookUrl(ctx, {
    allowedHosts: options?.allowedHosts,
    trustForwardingHeaders: options?.trustForwardingHeaders,
    trustedProxyIPs: options?.trustedProxyIPs,
    remoteIP: options?.remoteIP
  });
  let verificationUrl = reconstructed;
  if (options?.publicUrl) {
    try {
      const req = new URL(reconstructed);
      const base = new URL(options.publicUrl);
      base.pathname = req.pathname;
      base.search = req.search;
      verificationUrl = base.toString();
    } catch {
      verificationUrl = reconstructed;
    }
  }
  if (signatureV3 && nonceV3) {
    const method = ctx.method === "GET" || ctx.method === "POST" ? ctx.method : null;
    if (!method) {
      return {
        ok: false,
        version: "v3",
        verificationUrl,
        reason: `Unsupported HTTP method for Plivo V3 signature: ${ctx.method}`
      };
    }
    const postParams = toParamMapFromSearchParams(new URLSearchParams(ctx.rawBody));
    const ok = validatePlivoV3Signature({
      authToken,
      signatureHeader: signatureV3,
      nonce: nonceV3,
      method,
      url: verificationUrl,
      postParams
    });
    if (!ok) {
      return {
        ok: false,
        version: "v3",
        verificationUrl,
        reason: "Invalid Plivo V3 signature"
      };
    }
    const replayKey = `plivo:v3:${sha256Hex(`${verificationUrl}
${nonceV3}`)}`;
    const isReplay = markReplay(plivoReplayCache, replayKey);
    return { ok: true, version: "v3", verificationUrl, isReplay, verifiedRequestKey: replayKey };
  }
  if (signatureV2 && nonceV2) {
    const ok = validatePlivoV2Signature({
      authToken,
      signature: signatureV2,
      nonce: nonceV2,
      url: verificationUrl
    });
    if (!ok) {
      return {
        ok: false,
        version: "v2",
        verificationUrl,
        reason: "Invalid Plivo V2 signature"
      };
    }
    const replayKey = `plivo:v2:${sha256Hex(`${verificationUrl}
${nonceV2}`)}`;
    const isReplay = markReplay(plivoReplayCache, replayKey);
    return { ok: true, version: "v2", verificationUrl, isReplay, verifiedRequestKey: replayKey };
  }
  return {
    ok: false,
    reason: "Missing Plivo signature headers (V3 or V2)",
    verificationUrl
  };
}

// vendor/openclaw-runtime/win-x64/extensions/voice-call/src/providers/shared/guarded-json-api.ts
import { fetchWithSsrFGuard } from "openclaw/plugin-sdk";
async function guardedJsonApiRequest(params) {
  const { response, release } = await fetchWithSsrFGuard({
    url: params.url,
    init: {
      method: params.method,
      headers: params.headers,
      body: params.body ? JSON.stringify(params.body) : void 0
    },
    policy: { allowedHostnames: params.allowedHostnames },
    auditContext: params.auditContext
  });
  try {
    if (!response.ok) {
      if (params.allowNotFound && response.status === 404) {
        return void 0;
      }
      const errorText = await response.text();
      throw new Error(`${params.errorPrefix}: ${response.status} ${errorText}`);
    }
    const text = await response.text();
    return text ? JSON.parse(text) : void 0;
  } finally {
    await release();
  }
}

// vendor/openclaw-runtime/win-x64/extensions/voice-call/src/providers/plivo.ts
function createPlivoRequestDedupeKey(ctx) {
  const nonceV3 = getHeader(ctx.headers, "x-plivo-signature-v3-nonce");
  if (nonceV3) {
    return `plivo:v3:${nonceV3}`;
  }
  const nonceV2 = getHeader(ctx.headers, "x-plivo-signature-v2-nonce");
  if (nonceV2) {
    return `plivo:v2:${nonceV2}`;
  }
  return `plivo:fallback:${crypto5.createHash("sha256").update(ctx.rawBody).digest("hex")}`;
}
var PlivoProvider = class _PlivoProvider {
  name = "plivo";
  authId;
  authToken;
  baseUrl;
  options;
  apiHost;
  // Best-effort mapping between create-call request UUID and call UUID.
  requestUuidToCallUuid = /* @__PURE__ */ new Map();
  // Used for transfer URLs and GetInput action URLs.
  callIdToWebhookUrl = /* @__PURE__ */ new Map();
  callUuidToWebhookUrl = /* @__PURE__ */ new Map();
  pendingSpeakByCallId = /* @__PURE__ */ new Map();
  pendingListenByCallId = /* @__PURE__ */ new Map();
  constructor(config, options = {}) {
    if (!config.authId) {
      throw new Error("Plivo Auth ID is required");
    }
    if (!config.authToken) {
      throw new Error("Plivo Auth Token is required");
    }
    this.authId = config.authId;
    this.authToken = config.authToken;
    this.baseUrl = `https://api.plivo.com/v1/Account/${this.authId}`;
    this.apiHost = new URL(this.baseUrl).hostname;
    this.options = options;
  }
  async apiRequest(params) {
    const { method, endpoint, body, allowNotFound } = params;
    return await guardedJsonApiRequest({
      url: `${this.baseUrl}${endpoint}`,
      method,
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.authId}:${this.authToken}`).toString("base64")}`,
        "Content-Type": "application/json"
      },
      body,
      allowNotFound,
      allowedHostnames: [this.apiHost],
      auditContext: "voice-call.plivo.api",
      errorPrefix: "Plivo API error"
    });
  }
  verifyWebhook(ctx) {
    const result = verifyPlivoWebhook(ctx, this.authToken, {
      publicUrl: this.options.publicUrl,
      skipVerification: this.options.skipVerification,
      allowedHosts: this.options.webhookSecurity?.allowedHosts,
      trustForwardingHeaders: this.options.webhookSecurity?.trustForwardingHeaders,
      trustedProxyIPs: this.options.webhookSecurity?.trustedProxyIPs,
      remoteIP: ctx.remoteAddress
    });
    if (!result.ok) {
      console.warn(`[plivo] Webhook verification failed: ${result.reason}`);
    }
    return {
      ok: result.ok,
      reason: result.reason,
      isReplay: result.isReplay,
      verifiedRequestKey: result.verifiedRequestKey
    };
  }
  parseWebhookEvent(ctx, options) {
    const flow = typeof ctx.query?.flow === "string" ? ctx.query.flow.trim() : "";
    const parsed = this.parseBody(ctx.rawBody);
    if (!parsed) {
      return { events: [], statusCode: 400 };
    }
    const callUuid = parsed.get("CallUUID") || void 0;
    if (callUuid) {
      const webhookBase = this.baseWebhookUrlFromCtx(ctx);
      if (webhookBase) {
        this.callUuidToWebhookUrl.set(callUuid, webhookBase);
      }
    }
    if (flow === "xml-speak") {
      const callId = this.getCallIdFromQuery(ctx);
      const pending = callId ? this.pendingSpeakByCallId.get(callId) : void 0;
      if (callId) {
        this.pendingSpeakByCallId.delete(callId);
      }
      const xml = pending ? _PlivoProvider.xmlSpeak(pending.text, pending.locale) : _PlivoProvider.xmlKeepAlive();
      return {
        events: [],
        providerResponseBody: xml,
        providerResponseHeaders: { "Content-Type": "text/xml" },
        statusCode: 200
      };
    }
    if (flow === "xml-listen") {
      const callId = this.getCallIdFromQuery(ctx);
      const pending = callId ? this.pendingListenByCallId.get(callId) : void 0;
      if (callId) {
        this.pendingListenByCallId.delete(callId);
      }
      const actionUrl = this.buildActionUrl(ctx, {
        flow: "getinput",
        callId
      });
      const xml = actionUrl && callId ? _PlivoProvider.xmlGetInputSpeech({
        actionUrl,
        language: pending?.language
      }) : _PlivoProvider.xmlKeepAlive();
      return {
        events: [],
        providerResponseBody: xml,
        providerResponseHeaders: { "Content-Type": "text/xml" },
        statusCode: 200
      };
    }
    const callIdFromQuery = this.getCallIdFromQuery(ctx);
    const dedupeKey = options?.verifiedRequestKey ?? createPlivoRequestDedupeKey(ctx);
    const event = this.normalizeEvent(parsed, callIdFromQuery, dedupeKey);
    return {
      events: event ? [event] : [],
      providerResponseBody: flow === "answer" || flow === "getinput" ? _PlivoProvider.xmlKeepAlive() : _PlivoProvider.xmlEmpty(),
      providerResponseHeaders: { "Content-Type": "text/xml" },
      statusCode: 200
    };
  }
  normalizeEvent(params, callIdOverride, dedupeKey) {
    const callUuid = params.get("CallUUID") || "";
    const requestUuid = params.get("RequestUUID") || "";
    if (requestUuid && callUuid) {
      this.requestUuidToCallUuid.set(requestUuid, callUuid);
    }
    const direction = params.get("Direction");
    const from = params.get("From") || void 0;
    const to = params.get("To") || void 0;
    const callStatus = params.get("CallStatus");
    const baseEvent = {
      id: crypto5.randomUUID(),
      dedupeKey,
      callId: callIdOverride || callUuid || requestUuid,
      providerCallId: callUuid || requestUuid || void 0,
      timestamp: Date.now(),
      direction: direction === "inbound" ? "inbound" : direction === "outbound" ? "outbound" : void 0,
      from,
      to
    };
    const digits = params.get("Digits");
    if (digits) {
      return { ...baseEvent, type: "call.dtmf", digits };
    }
    const transcript = _PlivoProvider.extractTranscript(params);
    if (transcript) {
      return {
        ...baseEvent,
        type: "call.speech",
        transcript,
        isFinal: true
      };
    }
    if (callStatus === "ringing") {
      return { ...baseEvent, type: "call.ringing" };
    }
    if (callStatus === "in-progress") {
      return { ...baseEvent, type: "call.answered" };
    }
    if (callStatus === "completed" || callStatus === "busy" || callStatus === "no-answer" || callStatus === "failed") {
      return {
        ...baseEvent,
        type: "call.ended",
        reason: callStatus === "completed" ? "completed" : callStatus === "busy" ? "busy" : callStatus === "no-answer" ? "no-answer" : "failed"
      };
    }
    if (params.get("Event") === "StartApp" && callUuid) {
      return { ...baseEvent, type: "call.answered" };
    }
    return null;
  }
  async initiateCall(input) {
    const webhookUrl = new URL(input.webhookUrl);
    webhookUrl.searchParams.set("provider", "plivo");
    webhookUrl.searchParams.set("callId", input.callId);
    const answerUrl = new URL(webhookUrl);
    answerUrl.searchParams.set("flow", "answer");
    const hangupUrl = new URL(webhookUrl);
    hangupUrl.searchParams.set("flow", "hangup");
    this.callIdToWebhookUrl.set(input.callId, input.webhookUrl);
    const ringTimeoutSec = this.options.ringTimeoutSec ?? 30;
    const result = await this.apiRequest({
      method: "POST",
      endpoint: "/Call/",
      body: {
        from: _PlivoProvider.normalizeNumber(input.from),
        to: _PlivoProvider.normalizeNumber(input.to),
        answer_url: answerUrl.toString(),
        answer_method: "POST",
        hangup_url: hangupUrl.toString(),
        hangup_method: "POST",
        // Plivo's API uses `hangup_on_ring` for outbound ring timeout.
        hangup_on_ring: ringTimeoutSec
      }
    });
    const requestUuid = Array.isArray(result.request_uuid) ? result.request_uuid[0] : result.request_uuid;
    if (!requestUuid) {
      throw new Error("Plivo call create returned no request_uuid");
    }
    return { providerCallId: requestUuid, status: "initiated" };
  }
  async hangupCall(input) {
    const callUuid = this.requestUuidToCallUuid.get(input.providerCallId);
    if (callUuid) {
      await this.apiRequest({
        method: "DELETE",
        endpoint: `/Call/${callUuid}/`,
        allowNotFound: true
      });
      return;
    }
    await this.apiRequest({
      method: "DELETE",
      endpoint: `/Call/${input.providerCallId}/`,
      allowNotFound: true
    });
    await this.apiRequest({
      method: "DELETE",
      endpoint: `/Request/${input.providerCallId}/`,
      allowNotFound: true
    });
  }
  resolveCallContext(params) {
    const callUuid = this.requestUuidToCallUuid.get(params.providerCallId) ?? params.providerCallId;
    const webhookBase = this.callUuidToWebhookUrl.get(callUuid) || this.callIdToWebhookUrl.get(params.callId);
    if (!webhookBase) {
      throw new Error("Missing webhook URL for this call (provider state missing)");
    }
    if (!callUuid) {
      throw new Error(`Missing Plivo CallUUID for ${params.operation}`);
    }
    return { callUuid, webhookBase };
  }
  async transferCallLeg(params) {
    const transferUrl = new URL(params.webhookBase);
    transferUrl.searchParams.set("provider", "plivo");
    transferUrl.searchParams.set("flow", params.flow);
    transferUrl.searchParams.set("callId", params.callId);
    await this.apiRequest({
      method: "POST",
      endpoint: `/Call/${params.callUuid}/`,
      body: {
        legs: "aleg",
        aleg_url: transferUrl.toString(),
        aleg_method: "POST"
      }
    });
  }
  async playTts(input) {
    const { callUuid, webhookBase } = this.resolveCallContext({
      providerCallId: input.providerCallId,
      callId: input.callId,
      operation: "playTts"
    });
    this.pendingSpeakByCallId.set(input.callId, {
      text: input.text,
      locale: input.locale
    });
    await this.transferCallLeg({
      callUuid,
      webhookBase,
      callId: input.callId,
      flow: "xml-speak"
    });
  }
  async startListening(input) {
    const { callUuid, webhookBase } = this.resolveCallContext({
      providerCallId: input.providerCallId,
      callId: input.callId,
      operation: "startListening"
    });
    this.pendingListenByCallId.set(input.callId, {
      language: input.language
    });
    await this.transferCallLeg({
      callUuid,
      webhookBase,
      callId: input.callId,
      flow: "xml-listen"
    });
  }
  async stopListening(_input) {
  }
  async getCallStatus(input) {
    const terminalStatuses = /* @__PURE__ */ new Set([
      "completed",
      "busy",
      "failed",
      "timeout",
      "no-answer",
      "cancel",
      "machine",
      "hangup"
    ]);
    try {
      const data = await guardedJsonApiRequest({
        url: `${this.baseUrl}/Call/${input.providerCallId}/`,
        method: "GET",
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.authId}:${this.authToken}`).toString("base64")}`
        },
        allowNotFound: true,
        allowedHostnames: [this.apiHost],
        auditContext: "plivo-get-call-status",
        errorPrefix: "Plivo get call status error"
      });
      if (!data) {
        return { status: "not-found", isTerminal: true };
      }
      const status = data.call_status ?? "unknown";
      return { status, isTerminal: terminalStatuses.has(status) };
    } catch {
      return { status: "error", isTerminal: false, isUnknown: true };
    }
  }
  static normalizeNumber(numberOrSip) {
    const trimmed = numberOrSip.trim();
    if (trimmed.toLowerCase().startsWith("sip:")) {
      return trimmed;
    }
    return trimmed.replace(/[^\d+]/g, "");
  }
  static xmlEmpty() {
    return `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;
  }
  static xmlKeepAlive() {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Wait length="300" />
</Response>`;
  }
  static xmlSpeak(text, locale) {
    const language = locale || "en-US";
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Speak language="${escapeXml(language)}">${escapeXml(text)}</Speak>
  <Wait length="300" />
</Response>`;
  }
  static xmlGetInputSpeech(params) {
    const language = params.language || "en-US";
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <GetInput inputType="speech" method="POST" action="${escapeXml(params.actionUrl)}" language="${escapeXml(language)}" executionTimeout="30" speechEndTimeout="1" redirect="false">
  </GetInput>
  <Wait length="300" />
</Response>`;
  }
  getCallIdFromQuery(ctx) {
    const callId = typeof ctx.query?.callId === "string" && ctx.query.callId.trim() ? ctx.query.callId.trim() : void 0;
    return callId || void 0;
  }
  buildActionUrl(ctx, opts) {
    const base = this.baseWebhookUrlFromCtx(ctx);
    if (!base) {
      return null;
    }
    const u = new URL(base);
    u.searchParams.set("provider", "plivo");
    u.searchParams.set("flow", opts.flow);
    if (opts.callId) {
      u.searchParams.set("callId", opts.callId);
    }
    return u.toString();
  }
  baseWebhookUrlFromCtx(ctx) {
    try {
      const u = new URL(
        reconstructWebhookUrl(ctx, {
          allowedHosts: this.options.webhookSecurity?.allowedHosts,
          trustForwardingHeaders: this.options.webhookSecurity?.trustForwardingHeaders,
          trustedProxyIPs: this.options.webhookSecurity?.trustedProxyIPs,
          remoteIP: ctx.remoteAddress
        })
      );
      return `${u.origin}${u.pathname}`;
    } catch {
      return null;
    }
  }
  parseBody(rawBody) {
    try {
      return new URLSearchParams(rawBody);
    } catch {
      return null;
    }
  }
  static extractTranscript(params) {
    const candidates = [
      "Speech",
      "Transcription",
      "TranscriptionText",
      "SpeechResult",
      "RecognizedSpeech",
      "Text"
    ];
    for (const key of candidates) {
      const value = params.get(key);
      if (value && value.trim()) {
        return value.trim();
      }
    }
    return null;
  }
};

// vendor/openclaw-runtime/win-x64/extensions/voice-call/src/providers/telnyx.ts
import crypto6 from "crypto";
var TelnyxProvider = class {
  name = "telnyx";
  apiKey;
  connectionId;
  publicKey;
  options;
  baseUrl = "https://api.telnyx.com/v2";
  apiHost = "api.telnyx.com";
  constructor(config, options = {}) {
    if (!config.apiKey) {
      throw new Error("Telnyx API key is required");
    }
    if (!config.connectionId) {
      throw new Error("Telnyx connection ID is required");
    }
    this.apiKey = config.apiKey;
    this.connectionId = config.connectionId;
    this.publicKey = config.publicKey;
    this.options = options;
  }
  /**
   * Make an authenticated request to the Telnyx API.
   */
  async apiRequest(endpoint, body, options) {
    return await guardedJsonApiRequest({
      url: `${this.baseUrl}${endpoint}`,
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json"
      },
      body,
      allowNotFound: options?.allowNotFound,
      allowedHostnames: [this.apiHost],
      auditContext: "voice-call.telnyx.api",
      errorPrefix: "Telnyx API error"
    });
  }
  /**
   * Verify Telnyx webhook signature using Ed25519.
   */
  verifyWebhook(ctx) {
    const result = verifyTelnyxWebhook(ctx, this.publicKey, {
      skipVerification: this.options.skipVerification
    });
    return {
      ok: result.ok,
      reason: result.reason,
      isReplay: result.isReplay,
      verifiedRequestKey: result.verifiedRequestKey
    };
  }
  /**
   * Parse Telnyx webhook event into normalized format.
   */
  parseWebhookEvent(ctx, options) {
    try {
      const payload = JSON.parse(ctx.rawBody);
      const data = payload.data;
      if (!data || !data.event_type) {
        return { events: [], statusCode: 200 };
      }
      const event = this.normalizeEvent(data, options?.verifiedRequestKey);
      return {
        events: event ? [event] : [],
        statusCode: 200
      };
    } catch {
      return { events: [], statusCode: 400 };
    }
  }
  /**
   * Convert Telnyx event to normalized event format.
   */
  normalizeEvent(data, dedupeKey) {
    let callId = "";
    if (data.payload?.client_state) {
      try {
        callId = Buffer.from(data.payload.client_state, "base64").toString("utf8");
      } catch {
        callId = data.payload.client_state;
      }
    }
    if (!callId) {
      callId = data.payload?.call_control_id || "";
    }
    const baseEvent = {
      id: data.id || crypto6.randomUUID(),
      dedupeKey,
      callId,
      providerCallId: data.payload?.call_control_id,
      timestamp: Date.now()
    };
    switch (data.event_type) {
      case "call.initiated":
        return { ...baseEvent, type: "call.initiated" };
      case "call.ringing":
        return { ...baseEvent, type: "call.ringing" };
      case "call.answered":
        return { ...baseEvent, type: "call.answered" };
      case "call.bridged":
        return { ...baseEvent, type: "call.active" };
      case "call.speak.started":
        return {
          ...baseEvent,
          type: "call.speaking",
          text: data.payload?.text || ""
        };
      case "call.transcription":
        return {
          ...baseEvent,
          type: "call.speech",
          transcript: data.payload?.transcription || "",
          isFinal: data.payload?.is_final ?? true,
          confidence: data.payload?.confidence
        };
      case "call.hangup":
        return {
          ...baseEvent,
          type: "call.ended",
          reason: this.mapHangupCause(data.payload?.hangup_cause)
        };
      case "call.dtmf.received":
        return {
          ...baseEvent,
          type: "call.dtmf",
          digits: data.payload?.digit || ""
        };
      default:
        return null;
    }
  }
  /**
   * Map Telnyx hangup cause to normalized end reason.
   * @see https://developers.telnyx.com/docs/api/v2/call-control/Call-Commands#hangup-causes
   */
  mapHangupCause(cause) {
    switch (cause) {
      case "normal_clearing":
      case "normal_unspecified":
        return "completed";
      case "originator_cancel":
        return "hangup-bot";
      case "call_rejected":
      case "user_busy":
        return "busy";
      case "no_answer":
      case "no_user_response":
        return "no-answer";
      case "destination_out_of_order":
      case "network_out_of_order":
      case "service_unavailable":
      case "recovery_on_timer_expire":
        return "failed";
      case "machine_detected":
      case "fax_detected":
        return "voicemail";
      case "user_hangup":
      case "subscriber_absent":
        return "hangup-user";
      default:
        if (cause) {
          console.warn(`[telnyx] Unknown hangup cause: ${cause}`);
        }
        return "completed";
    }
  }
  /**
   * Initiate an outbound call via Telnyx API.
   */
  async initiateCall(input) {
    const result = await this.apiRequest("/calls", {
      connection_id: this.connectionId,
      to: input.to,
      from: input.from,
      webhook_url: input.webhookUrl,
      webhook_url_method: "POST",
      client_state: Buffer.from(input.callId).toString("base64"),
      timeout_secs: 30
    });
    return {
      providerCallId: result.data.call_control_id,
      status: "initiated"
    };
  }
  /**
   * Hang up a call via Telnyx API.
   */
  async hangupCall(input) {
    await this.apiRequest(
      `/calls/${input.providerCallId}/actions/hangup`,
      { command_id: crypto6.randomUUID() },
      { allowNotFound: true }
    );
  }
  /**
   * Play TTS audio via Telnyx speak action.
   */
  async playTts(input) {
    await this.apiRequest(`/calls/${input.providerCallId}/actions/speak`, {
      command_id: crypto6.randomUUID(),
      payload: input.text,
      voice: input.voice || "female",
      language: input.locale || "en-US"
    });
  }
  /**
   * Start transcription (STT) via Telnyx.
   */
  async startListening(input) {
    await this.apiRequest(`/calls/${input.providerCallId}/actions/transcription_start`, {
      command_id: crypto6.randomUUID(),
      language: input.language || "en"
    });
  }
  /**
   * Stop transcription via Telnyx.
   */
  async stopListening(input) {
    await this.apiRequest(
      `/calls/${input.providerCallId}/actions/transcription_stop`,
      { command_id: crypto6.randomUUID() },
      { allowNotFound: true }
    );
  }
  async getCallStatus(input) {
    try {
      const data = await guardedJsonApiRequest({
        url: `${this.baseUrl}/calls/${input.providerCallId}`,
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json"
        },
        allowNotFound: true,
        allowedHostnames: [this.apiHost],
        auditContext: "telnyx-get-call-status",
        errorPrefix: "Telnyx get call status error"
      });
      if (!data) {
        return { status: "not-found", isTerminal: true };
      }
      const state = data.data?.state ?? "unknown";
      const isAlive = data.data?.is_alive;
      if (isAlive === void 0) {
        return { status: state, isTerminal: false, isUnknown: true };
      }
      return { status: state, isTerminal: !isAlive };
    } catch {
      return { status: "error", isTerminal: false, isUnknown: true };
    }
  }
};

// vendor/openclaw-runtime/win-x64/extensions/voice-call/src/providers/twilio.ts
import crypto7 from "crypto";

// vendor/openclaw-runtime/win-x64/extensions/voice-call/src/telephony-audio.ts
var TELEPHONY_SAMPLE_RATE = 8e3;
function clamp16(value) {
  return Math.max(-32768, Math.min(32767, value));
}
function resamplePcmTo8k(input, inputSampleRate) {
  if (inputSampleRate === TELEPHONY_SAMPLE_RATE) {
    return input;
  }
  const inputSamples = Math.floor(input.length / 2);
  if (inputSamples === 0) {
    return Buffer.alloc(0);
  }
  const ratio = inputSampleRate / TELEPHONY_SAMPLE_RATE;
  const outputSamples = Math.floor(inputSamples / ratio);
  const output = Buffer.alloc(outputSamples * 2);
  for (let i = 0; i < outputSamples; i++) {
    const srcPos = i * ratio;
    const srcIndex = Math.floor(srcPos);
    const frac = srcPos - srcIndex;
    const s0 = input.readInt16LE(srcIndex * 2);
    const s1Index = Math.min(srcIndex + 1, inputSamples - 1);
    const s1 = input.readInt16LE(s1Index * 2);
    const sample = Math.round(s0 + frac * (s1 - s0));
    output.writeInt16LE(clamp16(sample), i * 2);
  }
  return output;
}
function pcmToMulaw(pcm) {
  const samples = Math.floor(pcm.length / 2);
  const mulaw = Buffer.alloc(samples);
  for (let i = 0; i < samples; i++) {
    const sample = pcm.readInt16LE(i * 2);
    mulaw[i] = linearToMulaw(sample);
  }
  return mulaw;
}
function convertPcmToMulaw8k(pcm, inputSampleRate) {
  const pcm8k = resamplePcmTo8k(pcm, inputSampleRate);
  return pcmToMulaw(pcm8k);
}
function chunkAudio(audio, chunkSize = 160) {
  return function* () {
    for (let i = 0; i < audio.length; i += chunkSize) {
      yield audio.subarray(i, Math.min(i + chunkSize, audio.length));
    }
  }();
}
function linearToMulaw(sample) {
  const BIAS = 132;
  const CLIP = 32635;
  const sign = sample < 0 ? 128 : 0;
  if (sample < 0) {
    sample = -sample;
  }
  if (sample > CLIP) {
    sample = CLIP;
  }
  sample += BIAS;
  let exponent = 7;
  for (let expMask = 16384; (sample & expMask) === 0 && exponent > 0; exponent--) {
    expMask >>= 1;
  }
  const mantissa = sample >> exponent + 3 & 15;
  return ~(sign | exponent << 4 | mantissa) & 255;
}

// vendor/openclaw-runtime/win-x64/extensions/voice-call/src/providers/shared/call-status.ts
var TERMINAL_PROVIDER_STATUS_TO_END_REASON = {
  completed: "completed",
  failed: "failed",
  busy: "busy",
  "no-answer": "no-answer",
  canceled: "hangup-bot"
};
function normalizeProviderStatus(status) {
  const normalized = status?.trim().toLowerCase();
  return normalized && normalized.length > 0 ? normalized : "unknown";
}
function mapProviderStatusToEndReason(status) {
  const normalized = normalizeProviderStatus(status);
  return TERMINAL_PROVIDER_STATUS_TO_END_REASON[normalized] ?? null;
}
function isProviderStatusTerminal(status) {
  return mapProviderStatusToEndReason(status) !== null;
}

// vendor/openclaw-runtime/win-x64/extensions/voice-call/src/providers/twilio/api.ts
async function twilioApiRequest(params) {
  const bodyParams = params.body instanceof URLSearchParams ? params.body : Object.entries(params.body).reduce((acc, [key, value]) => {
    if (Array.isArray(value)) {
      for (const entry of value) {
        acc.append(key, entry);
      }
    } else if (typeof value === "string") {
      acc.append(key, value);
    }
    return acc;
  }, new URLSearchParams());
  const response = await fetch(`${params.baseUrl}${params.endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${params.accountSid}:${params.authToken}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: bodyParams
  });
  if (!response.ok) {
    if (params.allowNotFound && response.status === 404) {
      return void 0;
    }
    const errorText = await response.text();
    throw new Error(`Twilio API error: ${response.status} ${errorText}`);
  }
  const text = await response.text();
  return text ? JSON.parse(text) : void 0;
}

// vendor/openclaw-runtime/win-x64/extensions/voice-call/src/providers/twilio/twiml-policy.ts
function isOutboundDirection(direction) {
  return direction?.startsWith("outbound") ?? false;
}
function readTwimlRequestView(ctx) {
  const params = new URLSearchParams(ctx.rawBody);
  const type = typeof ctx.query?.type === "string" ? ctx.query.type.trim() : void 0;
  const callIdFromQuery = typeof ctx.query?.callId === "string" && ctx.query.callId.trim() ? ctx.query.callId.trim() : void 0;
  return {
    callStatus: params.get("CallStatus"),
    direction: params.get("Direction"),
    isStatusCallback: type === "status",
    callSid: params.get("CallSid") || void 0,
    callIdFromQuery
  };
}
function decideTwimlResponse(input) {
  if (input.callIdFromQuery && !input.isStatusCallback) {
    if (input.hasStoredTwiml) {
      return { kind: "stored", consumeStoredTwimlCallId: input.callIdFromQuery };
    }
    if (input.isNotifyCall) {
      return { kind: "empty" };
    }
    if (isOutboundDirection(input.direction)) {
      return input.canStream ? { kind: "stream" } : { kind: "pause" };
    }
  }
  if (input.isStatusCallback) {
    return { kind: "empty" };
  }
  if (input.direction === "inbound") {
    if (input.hasActiveStreams) {
      return { kind: "queue" };
    }
    if (input.canStream && input.callSid) {
      return { kind: "stream", activateStreamCallSid: input.callSid };
    }
    return { kind: "pause" };
  }
  if (input.callStatus !== "in-progress") {
    return { kind: "empty" };
  }
  return input.canStream ? { kind: "stream" } : { kind: "pause" };
}

// vendor/openclaw-runtime/win-x64/extensions/voice-call/src/providers/twilio/webhook.ts
function verifyTwilioProviderWebhook(params) {
  const result = verifyTwilioWebhook(params.ctx, params.authToken, {
    publicUrl: params.currentPublicUrl || void 0,
    allowNgrokFreeTierLoopbackBypass: params.options.allowNgrokFreeTierLoopbackBypass ?? false,
    skipVerification: params.options.skipVerification,
    allowedHosts: params.options.webhookSecurity?.allowedHosts,
    trustForwardingHeaders: params.options.webhookSecurity?.trustForwardingHeaders,
    trustedProxyIPs: params.options.webhookSecurity?.trustedProxyIPs,
    remoteIP: params.ctx.remoteAddress
  });
  if (!result.ok) {
    console.warn(`[twilio] Webhook verification failed: ${result.reason}`);
    if (result.verificationUrl) {
      console.warn(`[twilio] Verification URL: ${result.verificationUrl}`);
    }
  }
  return {
    ok: result.ok,
    reason: result.reason,
    isReplay: result.isReplay,
    verifiedRequestKey: result.verifiedRequestKey
  };
}

// vendor/openclaw-runtime/win-x64/extensions/voice-call/src/providers/twilio.ts
function createTwilioRequestDedupeKey(ctx, verifiedRequestKey) {
  if (verifiedRequestKey) {
    return verifiedRequestKey;
  }
  const signature = getHeader(ctx.headers, "x-twilio-signature") ?? "";
  const params = new URLSearchParams(ctx.rawBody);
  const callSid = params.get("CallSid") ?? "";
  const callStatus = params.get("CallStatus") ?? "";
  const direction = params.get("Direction") ?? "";
  const callId = typeof ctx.query?.callId === "string" ? ctx.query.callId.trim() : "";
  const flow = typeof ctx.query?.flow === "string" ? ctx.query.flow.trim() : "";
  const turnToken = typeof ctx.query?.turnToken === "string" ? ctx.query.turnToken.trim() : "";
  return `twilio:fallback:${crypto7.createHash("sha256").update(
    `${signature}
${callSid}
${callStatus}
${direction}
${callId}
${flow}
${turnToken}
${ctx.rawBody}`
  ).digest("hex")}`;
}
var TwilioProvider = class _TwilioProvider {
  name = "twilio";
  accountSid;
  authToken;
  baseUrl;
  callWebhookUrls = /* @__PURE__ */ new Map();
  options;
  /** Current public webhook URL (set when tunnel starts or from config) */
  currentPublicUrl = null;
  /** Optional telephony TTS provider for streaming TTS */
  ttsProvider = null;
  /** Optional media stream handler for sending audio */
  mediaStreamHandler = null;
  /** Map of call SID to stream SID for media streams */
  callStreamMap = /* @__PURE__ */ new Map();
  /** Per-call tokens for media stream authentication */
  streamAuthTokens = /* @__PURE__ */ new Map();
  /** Storage for TwiML content (for notify mode with URL-based TwiML) */
  twimlStorage = /* @__PURE__ */ new Map();
  /** Track notify-mode calls to avoid streaming on follow-up callbacks */
  notifyCalls = /* @__PURE__ */ new Set();
  activeStreamCalls = /* @__PURE__ */ new Set();
  /**
   * Delete stored TwiML for a given `callId`.
   *
   * We keep TwiML in-memory only long enough to satisfy the initial Twilio
   * webhook request (notify mode). Subsequent webhooks should not reuse it.
   */
  deleteStoredTwiml(callId) {
    this.twimlStorage.delete(callId);
    this.notifyCalls.delete(callId);
  }
  /**
   * Delete stored TwiML for a call, addressed by Twilio's provider call SID.
   *
   * This is used when we only have `providerCallId` (e.g. hangup).
   */
  deleteStoredTwimlForProviderCall(providerCallId) {
    const webhookUrl = this.callWebhookUrls.get(providerCallId);
    if (!webhookUrl) {
      return;
    }
    const callIdMatch = webhookUrl.match(/callId=([^&]+)/);
    if (!callIdMatch) {
      return;
    }
    this.deleteStoredTwiml(callIdMatch[1]);
    this.streamAuthTokens.delete(providerCallId);
  }
  constructor(config, options = {}) {
    if (!config.accountSid) {
      throw new Error("Twilio Account SID is required");
    }
    if (!config.authToken) {
      throw new Error("Twilio Auth Token is required");
    }
    this.accountSid = config.accountSid;
    this.authToken = config.authToken;
    this.baseUrl = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}`;
    this.options = options;
    if (options.publicUrl) {
      this.currentPublicUrl = options.publicUrl;
    }
  }
  setPublicUrl(url) {
    this.currentPublicUrl = url;
  }
  getPublicUrl() {
    return this.currentPublicUrl;
  }
  setTTSProvider(provider) {
    this.ttsProvider = provider;
  }
  setMediaStreamHandler(handler) {
    this.mediaStreamHandler = handler;
  }
  registerCallStream(callSid, streamSid) {
    this.callStreamMap.set(callSid, streamSid);
  }
  unregisterCallStream(callSid) {
    this.callStreamMap.delete(callSid);
    this.activeStreamCalls.delete(callSid);
  }
  isValidStreamToken(callSid, token) {
    const expected = this.streamAuthTokens.get(callSid);
    if (!expected || !token) {
      return false;
    }
    if (expected.length !== token.length) {
      const dummy = Buffer.from(expected);
      crypto7.timingSafeEqual(dummy, dummy);
      return false;
    }
    return crypto7.timingSafeEqual(Buffer.from(expected), Buffer.from(token));
  }
  /**
   * Clear TTS queue for a call (barge-in).
   * Used when user starts speaking to interrupt current TTS playback.
   */
  clearTtsQueue(callSid) {
    const streamSid = this.callStreamMap.get(callSid);
    if (streamSid && this.mediaStreamHandler) {
      this.mediaStreamHandler.clearTtsQueue(streamSid);
    }
  }
  /**
   * Make an authenticated request to the Twilio API.
   */
  async apiRequest(endpoint, params, options) {
    return await twilioApiRequest({
      baseUrl: this.baseUrl,
      accountSid: this.accountSid,
      authToken: this.authToken,
      endpoint,
      body: params,
      allowNotFound: options?.allowNotFound
    });
  }
  /**
   * Verify Twilio webhook signature using HMAC-SHA1.
   *
   * Handles reverse proxy scenarios (Tailscale, nginx, ngrok) by reconstructing
   * the public URL from forwarding headers.
   *
   * @see https://www.twilio.com/docs/usage/webhooks/webhooks-security
   */
  verifyWebhook(ctx) {
    return verifyTwilioProviderWebhook({
      ctx,
      authToken: this.authToken,
      currentPublicUrl: this.currentPublicUrl,
      options: this.options
    });
  }
  /**
   * Parse Twilio webhook event into normalized format.
   */
  parseWebhookEvent(ctx, options) {
    try {
      const params = new URLSearchParams(ctx.rawBody);
      const callIdFromQuery = typeof ctx.query?.callId === "string" && ctx.query.callId.trim() ? ctx.query.callId.trim() : void 0;
      const turnTokenFromQuery = typeof ctx.query?.turnToken === "string" && ctx.query.turnToken.trim() ? ctx.query.turnToken.trim() : void 0;
      const dedupeKey = createTwilioRequestDedupeKey(ctx, options?.verifiedRequestKey);
      const event = this.normalizeEvent(params, {
        callIdOverride: callIdFromQuery,
        dedupeKey,
        turnToken: turnTokenFromQuery
      });
      const twiml = this.generateTwimlResponse(ctx);
      return {
        events: event ? [event] : [],
        providerResponseBody: twiml,
        providerResponseHeaders: { "Content-Type": "application/xml" },
        statusCode: 200
      };
    } catch {
      return { events: [], statusCode: 400 };
    }
  }
  /**
   * Parse Twilio direction to normalized format.
   */
  static parseDirection(direction) {
    if (direction === "inbound") {
      return "inbound";
    }
    if (direction === "outbound-api" || direction === "outbound-dial") {
      return "outbound";
    }
    return void 0;
  }
  /**
   * Convert Twilio webhook params to normalized event format.
   */
  normalizeEvent(params, options) {
    const callSid = params.get("CallSid") || "";
    const callIdOverride = options?.callIdOverride;
    const baseEvent = {
      id: crypto7.randomUUID(),
      dedupeKey: options?.dedupeKey,
      callId: callIdOverride || callSid,
      providerCallId: callSid,
      timestamp: Date.now(),
      turnToken: options?.turnToken,
      direction: _TwilioProvider.parseDirection(params.get("Direction")),
      from: params.get("From") || void 0,
      to: params.get("To") || void 0
    };
    const speechResult = params.get("SpeechResult");
    if (speechResult) {
      return {
        ...baseEvent,
        type: "call.speech",
        transcript: speechResult,
        isFinal: true,
        confidence: parseFloat(params.get("Confidence") || "0.9")
      };
    }
    const digits = params.get("Digits");
    if (digits) {
      return { ...baseEvent, type: "call.dtmf", digits };
    }
    const callStatus = normalizeProviderStatus(params.get("CallStatus"));
    if (callStatus === "initiated") {
      return { ...baseEvent, type: "call.initiated" };
    }
    if (callStatus === "ringing") {
      return { ...baseEvent, type: "call.ringing" };
    }
    if (callStatus === "in-progress") {
      return { ...baseEvent, type: "call.answered" };
    }
    const endReason = mapProviderStatusToEndReason(callStatus);
    if (endReason) {
      this.streamAuthTokens.delete(callSid);
      this.activeStreamCalls.delete(callSid);
      if (callIdOverride) {
        this.deleteStoredTwiml(callIdOverride);
      }
      return { ...baseEvent, type: "call.ended", reason: endReason };
    }
    return null;
  }
  static EMPTY_TWIML = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';
  static PAUSE_TWIML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Pause length="30"/>
</Response>`;
  static QUEUE_TWIML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Please hold while we connect you.</Say>
  <Enqueue waitUrl="/voice/hold-music">hold-queue</Enqueue>
</Response>`;
  /**
   * Generate TwiML response for webhook.
   * When a call is answered, connects to media stream for bidirectional audio.
   */
  generateTwimlResponse(ctx) {
    if (!ctx) {
      return _TwilioProvider.EMPTY_TWIML;
    }
    const view = readTwimlRequestView(ctx);
    const storedTwiml = view.callIdFromQuery ? this.twimlStorage.get(view.callIdFromQuery) : void 0;
    const decision = decideTwimlResponse({
      ...view,
      hasStoredTwiml: Boolean(storedTwiml),
      isNotifyCall: view.callIdFromQuery ? this.notifyCalls.has(view.callIdFromQuery) : false,
      hasActiveStreams: this.activeStreamCalls.size > 0,
      canStream: Boolean(view.callSid && this.getStreamUrl())
    });
    if (decision.consumeStoredTwimlCallId) {
      this.deleteStoredTwiml(decision.consumeStoredTwimlCallId);
    }
    if (decision.activateStreamCallSid) {
      this.activeStreamCalls.add(decision.activateStreamCallSid);
    }
    switch (decision.kind) {
      case "stored":
        return storedTwiml ?? _TwilioProvider.EMPTY_TWIML;
      case "queue":
        return _TwilioProvider.QUEUE_TWIML;
      case "pause":
        return _TwilioProvider.PAUSE_TWIML;
      case "stream": {
        const streamUrl = view.callSid ? this.getStreamUrlForCall(view.callSid) : null;
        return streamUrl ? this.getStreamConnectXml(streamUrl) : _TwilioProvider.PAUSE_TWIML;
      }
      case "empty":
      default:
        return _TwilioProvider.EMPTY_TWIML;
    }
  }
  /**
   * Get the WebSocket URL for media streaming.
   * Derives from the public URL origin + stream path.
   */
  getStreamUrl() {
    if (!this.currentPublicUrl || !this.options.streamPath) {
      return null;
    }
    const url = new URL(this.currentPublicUrl);
    const origin = url.origin;
    const wsOrigin = origin.replace(/^https:\/\//, "wss://").replace(/^http:\/\//, "ws://");
    const path6 = this.options.streamPath.startsWith("/") ? this.options.streamPath : `/${this.options.streamPath}`;
    return `${wsOrigin}${path6}`;
  }
  getStreamAuthToken(callSid) {
    const existing = this.streamAuthTokens.get(callSid);
    if (existing) {
      return existing;
    }
    const token = crypto7.randomBytes(16).toString("base64url");
    this.streamAuthTokens.set(callSid, token);
    return token;
  }
  getStreamUrlForCall(callSid) {
    const baseUrl = this.getStreamUrl();
    if (!baseUrl) {
      return null;
    }
    const token = this.getStreamAuthToken(callSid);
    const url = new URL(baseUrl);
    url.searchParams.set("token", token);
    return url.toString();
  }
  /**
   * Generate TwiML to connect a call to a WebSocket media stream.
   * This enables bidirectional audio streaming for real-time STT/TTS.
   *
   * @param streamUrl - WebSocket URL (wss://...) for the media stream
   */
  getStreamConnectXml(streamUrl) {
    const parsed = new URL(streamUrl);
    const token = parsed.searchParams.get("token");
    parsed.searchParams.delete("token");
    const cleanUrl = parsed.toString();
    const paramXml = token ? `
      <Parameter name="token" value="${escapeXml(token)}" />` : "";
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${escapeXml(cleanUrl)}">${paramXml}
    </Stream>
  </Connect>
</Response>`;
  }
  /**
   * Initiate an outbound call via Twilio API.
   * If inlineTwiml is provided, uses that directly (for notify mode).
   * Otherwise, uses webhook URL for dynamic TwiML.
   */
  async initiateCall(input) {
    const url = new URL(input.webhookUrl);
    url.searchParams.set("callId", input.callId);
    const statusUrl = new URL(input.webhookUrl);
    statusUrl.searchParams.set("callId", input.callId);
    statusUrl.searchParams.set("type", "status");
    if (input.inlineTwiml) {
      this.twimlStorage.set(input.callId, input.inlineTwiml);
      this.notifyCalls.add(input.callId);
    }
    const params = {
      To: input.to,
      From: input.from,
      Url: url.toString(),
      // TwiML serving endpoint
      StatusCallback: statusUrl.toString(),
      // Separate status callback endpoint
      StatusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
      Timeout: "30"
    };
    const result = await this.apiRequest("/Calls.json", params);
    this.callWebhookUrls.set(result.sid, url.toString());
    return {
      providerCallId: result.sid,
      status: result.status === "queued" ? "queued" : "initiated"
    };
  }
  /**
   * Hang up a call via Twilio API.
   */
  async hangupCall(input) {
    this.deleteStoredTwimlForProviderCall(input.providerCallId);
    this.callWebhookUrls.delete(input.providerCallId);
    this.streamAuthTokens.delete(input.providerCallId);
    this.activeStreamCalls.delete(input.providerCallId);
    await this.apiRequest(
      `/Calls/${input.providerCallId}.json`,
      { Status: "completed" },
      { allowNotFound: true }
    );
  }
  /**
   * Play TTS audio via Twilio.
   *
   * Two modes:
   * 1. Core TTS + Media Streams: If TTS provider and media stream are available,
   *    generates audio via core TTS and streams it through WebSocket (preferred).
   * 2. TwiML <Say>: Falls back to Twilio's native TTS with Polly voices.
   *    Note: This may not work on all Twilio accounts.
   */
  async playTts(input) {
    const streamSid = this.callStreamMap.get(input.providerCallId);
    if (this.ttsProvider && this.mediaStreamHandler && streamSid) {
      try {
        await this.playTtsViaStream(input.text, streamSid);
        return;
      } catch (err) {
        console.warn(
          `[voice-call] Telephony TTS failed, falling back to Twilio <Say>:`,
          err instanceof Error ? err.message : err
        );
      }
    }
    const webhookUrl = this.callWebhookUrls.get(input.providerCallId);
    if (!webhookUrl) {
      throw new Error("Missing webhook URL for this call (provider state not initialized)");
    }
    console.warn(
      "[voice-call] Using TwiML <Say> fallback - telephony TTS not configured or media stream not active"
    );
    const pollyVoice = mapVoiceToPolly(input.voice);
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${pollyVoice}" language="${input.locale || "en-US"}">${escapeXml(input.text)}</Say>
  <Gather input="speech" speechTimeout="auto" action="${escapeXml(webhookUrl)}" method="POST">
    <Say>.</Say>
  </Gather>
</Response>`;
    await this.apiRequest(`/Calls/${input.providerCallId}.json`, {
      Twiml: twiml
    });
  }
  /**
   * Play TTS via core TTS and Twilio Media Streams.
   * Generates audio with core TTS, converts to mu-law, and streams via WebSocket.
   * Uses a queue to serialize playback and prevent overlapping audio.
   */
  async playTtsViaStream(text, streamSid) {
    if (!this.ttsProvider || !this.mediaStreamHandler) {
      throw new Error("TTS provider and media stream handler required");
    }
    const CHUNK_SIZE = 160;
    const CHUNK_DELAY_MS = 20;
    const handler = this.mediaStreamHandler;
    const ttsProvider = this.ttsProvider;
    await handler.queueTts(streamSid, async (signal) => {
      const muLawAudio = await ttsProvider.synthesizeForTelephony(text);
      for (const chunk of chunkAudio(muLawAudio, CHUNK_SIZE)) {
        if (signal.aborted) {
          break;
        }
        handler.sendAudio(streamSid, chunk);
        await new Promise((resolve) => setTimeout(resolve, CHUNK_DELAY_MS));
        if (signal.aborted) {
          break;
        }
      }
      if (!signal.aborted) {
        handler.sendMark(streamSid, `tts-${Date.now()}`);
      }
    });
  }
  /**
   * Start listening for speech via Twilio <Gather>.
   */
  async startListening(input) {
    const webhookUrl = this.callWebhookUrls.get(input.providerCallId);
    if (!webhookUrl) {
      throw new Error("Missing webhook URL for this call (provider state not initialized)");
    }
    const actionUrl = new URL(webhookUrl);
    if (input.turnToken) {
      actionUrl.searchParams.set("turnToken", input.turnToken);
    }
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech" speechTimeout="auto" language="${input.language || "en-US"}" action="${escapeXml(actionUrl.toString())}" method="POST">
  </Gather>
</Response>`;
    await this.apiRequest(`/Calls/${input.providerCallId}.json`, {
      Twiml: twiml
    });
  }
  /**
   * Stop listening - for Twilio this is a no-op as <Gather> auto-ends.
   */
  async stopListening(_input) {
  }
  async getCallStatus(input) {
    try {
      const data = await guardedJsonApiRequest({
        url: `${this.baseUrl}/Calls/${input.providerCallId}.json`,
        method: "GET",
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.accountSid}:${this.authToken}`).toString("base64")}`
        },
        allowNotFound: true,
        allowedHostnames: ["api.twilio.com"],
        auditContext: "twilio-get-call-status",
        errorPrefix: "Twilio get call status error"
      });
      if (!data) {
        return { status: "not-found", isTerminal: true };
      }
      const status = normalizeProviderStatus(data.status);
      return { status, isTerminal: isProviderStatusTerminal(status) };
    } catch {
      return { status: "error", isTerminal: false, isUnknown: true };
    }
  }
};

// vendor/openclaw-runtime/win-x64/extensions/voice-call/src/telephony-tts.ts
var BLOCKED_MERGE_KEYS = /* @__PURE__ */ new Set(["__proto__", "prototype", "constructor"]);
function createTelephonyTtsProvider(params) {
  const { coreConfig, ttsOverride, runtime } = params;
  const mergedConfig = applyTtsOverride(coreConfig, ttsOverride);
  return {
    synthesizeForTelephony: async (text) => {
      const result = await runtime.textToSpeechTelephony({
        text,
        cfg: mergedConfig
      });
      if (!result.success || !result.audioBuffer || !result.sampleRate) {
        throw new Error(result.error ?? "TTS conversion failed");
      }
      return convertPcmToMulaw8k(result.audioBuffer, result.sampleRate);
    }
  };
}
function applyTtsOverride(coreConfig, override) {
  if (!override) {
    return coreConfig;
  }
  const base = coreConfig.messages?.tts;
  const merged = mergeTtsConfig(base, override);
  if (!merged) {
    return coreConfig;
  }
  return {
    ...coreConfig,
    messages: {
      ...coreConfig.messages,
      tts: merged
    }
  };
}
function mergeTtsConfig(base, override) {
  if (!base && !override) {
    return void 0;
  }
  if (!override) {
    return base;
  }
  if (!base) {
    return override;
  }
  return deepMerge(base, override);
}
function deepMerge(base, override) {
  if (!isPlainObject(base) || !isPlainObject(override)) {
    return override;
  }
  const result = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (BLOCKED_MERGE_KEYS.has(key) || value === void 0) {
      continue;
    }
    const existing = base[key];
    if (isPlainObject(existing) && isPlainObject(value)) {
      result[key] = deepMerge(existing, value);
    } else {
      result[key] = value;
    }
  }
  return result;
}
function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

// vendor/openclaw-runtime/win-x64/extensions/voice-call/src/tunnel.ts
import { spawn as spawn2 } from "child_process";
async function startNgrokTunnel(config) {
  if (config.authToken) {
    await runNgrokCommand(["config", "add-authtoken", config.authToken]);
  }
  const args = ["http", String(config.port), "--log", "stdout", "--log-format", "json"];
  if (config.domain) {
    args.push("--domain", config.domain);
  }
  return new Promise((resolve, reject) => {
    const proc = spawn2("ngrok", args, {
      stdio: ["ignore", "pipe", "pipe"]
    });
    let resolved = false;
    let publicUrl = null;
    let outputBuffer = "";
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        proc.kill("SIGTERM");
        reject(new Error("ngrok startup timed out (30s)"));
      }
    }, 3e4);
    const processLine = (line) => {
      try {
        const log = JSON.parse(line);
        if (log.msg === "started tunnel" && log.url) {
          publicUrl = log.url;
        }
        if (log.addr && log.url && !publicUrl) {
          publicUrl = log.url;
        }
        if (publicUrl && !resolved) {
          resolved = true;
          clearTimeout(timeout);
          const fullUrl = publicUrl + config.path;
          console.log(`[voice-call] ngrok tunnel active: ${fullUrl}`);
          resolve({
            publicUrl: fullUrl,
            provider: "ngrok",
            stop: async () => {
              proc.kill("SIGTERM");
              await new Promise((res) => {
                proc.on("close", () => res());
                setTimeout(res, 2e3);
              });
            }
          });
        }
      } catch {
      }
    };
    proc.stdout.on("data", (data) => {
      outputBuffer += data.toString();
      const lines = outputBuffer.split("\n");
      outputBuffer = lines.pop() || "";
      for (const line of lines) {
        if (line.trim()) {
          processLine(line);
        }
      }
    });
    proc.stderr.on("data", (data) => {
      const msg = data.toString();
      if (msg.includes("ERR_NGROK")) {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          reject(new Error(`ngrok error: ${msg}`));
        }
      }
    });
    proc.on("error", (err) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        reject(new Error(`Failed to start ngrok: ${err.message}`));
      }
    });
    proc.on("close", (code) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        reject(new Error(`ngrok exited unexpectedly with code ${code}`));
      }
    });
  });
}
async function runNgrokCommand(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn2("ngrok", args, {
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });
    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });
    proc.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`ngrok command failed: ${stderr || stdout}`));
      }
    });
    proc.on("error", reject);
  });
}
async function startTailscaleTunnel(config) {
  const dnsName = await getTailscaleDnsName();
  if (!dnsName) {
    throw new Error("Could not get Tailscale DNS name. Is Tailscale running?");
  }
  const path6 = config.path.startsWith("/") ? config.path : `/${config.path}`;
  const localUrl = `http://127.0.0.1:${config.port}${path6}`;
  return new Promise((resolve, reject) => {
    const proc = spawn2("tailscale", [config.mode, "--bg", "--yes", "--set-path", path6, localUrl], {
      stdio: ["ignore", "pipe", "pipe"]
    });
    const timeout = setTimeout(() => {
      proc.kill("SIGKILL");
      reject(new Error(`Tailscale ${config.mode} timed out`));
    }, 1e4);
    proc.on("close", (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        const publicUrl = `https://${dnsName}${path6}`;
        console.log(`[voice-call] Tailscale ${config.mode} active: ${publicUrl}`);
        resolve({
          publicUrl,
          provider: `tailscale-${config.mode}`,
          stop: async () => {
            await stopTailscaleTunnel(config.mode, path6);
          }
        });
      } else {
        reject(new Error(`Tailscale ${config.mode} failed with code ${code}`));
      }
    });
    proc.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}
async function stopTailscaleTunnel(mode, path6) {
  return new Promise((resolve) => {
    const proc = spawn2("tailscale", [mode, "off", path6], {
      stdio: "ignore"
    });
    const timeout = setTimeout(() => {
      proc.kill("SIGKILL");
      resolve();
    }, 5e3);
    proc.on("close", () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}
async function startTunnel(config) {
  switch (config.provider) {
    case "ngrok":
      return startNgrokTunnel({
        port: config.port,
        path: config.path,
        authToken: config.ngrokAuthToken,
        domain: config.ngrokDomain
      });
    case "tailscale-serve":
      return startTailscaleTunnel({
        mode: "serve",
        port: config.port,
        path: config.path
      });
    case "tailscale-funnel":
      return startTailscaleTunnel({
        mode: "funnel",
        port: config.port,
        path: config.path
      });
    default:
      return null;
  }
}

// vendor/openclaw-runtime/win-x64/extensions/voice-call/src/webhook.ts
import http from "http";
import { URL as URL2 } from "url";
import {
  isRequestBodyLimitError,
  readRequestBodyWithLimit,
  requestBodyErrorToText
} from "openclaw/plugin-sdk";

// vendor/openclaw-runtime/win-x64/extensions/voice-call/src/media-stream.ts
import { WebSocket, WebSocketServer } from "ws";
var DEFAULT_PRE_START_TIMEOUT_MS = 5e3;
var DEFAULT_MAX_PENDING_CONNECTIONS = 32;
var DEFAULT_MAX_PENDING_CONNECTIONS_PER_IP = 4;
var DEFAULT_MAX_CONNECTIONS = 128;
var MediaStreamHandler = class {
  wss = null;
  sessions = /* @__PURE__ */ new Map();
  config;
  /** Pending sockets that have upgraded but not yet sent an accepted `start` frame. */
  pendingConnections = /* @__PURE__ */ new Map();
  /** Pending socket count per remote IP for pre-auth throttling. */
  pendingByIp = /* @__PURE__ */ new Map();
  preStartTimeoutMs;
  maxPendingConnections;
  maxPendingConnectionsPerIp;
  maxConnections;
  /** TTS playback queues per stream (serialize audio to prevent overlap) */
  ttsQueues = /* @__PURE__ */ new Map();
  /** Whether TTS is currently playing per stream */
  ttsPlaying = /* @__PURE__ */ new Map();
  /** Active TTS playback controllers per stream */
  ttsActiveControllers = /* @__PURE__ */ new Map();
  constructor(config) {
    this.config = config;
    this.preStartTimeoutMs = config.preStartTimeoutMs ?? DEFAULT_PRE_START_TIMEOUT_MS;
    this.maxPendingConnections = config.maxPendingConnections ?? DEFAULT_MAX_PENDING_CONNECTIONS;
    this.maxPendingConnectionsPerIp = config.maxPendingConnectionsPerIp ?? DEFAULT_MAX_PENDING_CONNECTIONS_PER_IP;
    this.maxConnections = config.maxConnections ?? DEFAULT_MAX_CONNECTIONS;
  }
  /**
   * Handle WebSocket upgrade for media stream connections.
   */
  handleUpgrade(request, socket, head) {
    if (!this.wss) {
      this.wss = new WebSocketServer({ noServer: true });
      this.wss.on("connection", (ws, req) => this.handleConnection(ws, req));
    }
    const currentConnections = this.wss.clients.size;
    if (currentConnections >= this.maxConnections) {
      this.rejectUpgrade(socket, 503, "Too many media stream connections");
      return;
    }
    this.wss.handleUpgrade(request, socket, head, (ws) => {
      this.wss?.emit("connection", ws, request);
    });
  }
  /**
   * Handle new WebSocket connection from Twilio.
   */
  async handleConnection(ws, _request) {
    let session = null;
    const streamToken = this.getStreamToken(_request);
    const ip = this.getClientIp(_request);
    if (!this.registerPendingConnection(ws, ip)) {
      ws.close(1013, "Too many pending media stream connections");
      return;
    }
    ws.on("message", async (data) => {
      try {
        const message = JSON.parse(data.toString());
        switch (message.event) {
          case "connected":
            console.log("[MediaStream] Twilio connected");
            break;
          case "start":
            session = await this.handleStart(ws, message, streamToken);
            if (session) {
              this.clearPendingConnection(ws);
            }
            break;
          case "media":
            if (session && message.media?.payload) {
              const audioBuffer = Buffer.from(message.media.payload, "base64");
              session.sttSession.sendAudio(audioBuffer);
            }
            break;
          case "stop":
            if (session) {
              this.handleStop(session);
              session = null;
            }
            break;
        }
      } catch (error) {
        console.error("[MediaStream] Error processing message:", error);
      }
    });
    ws.on("close", () => {
      this.clearPendingConnection(ws);
      if (session) {
        this.handleStop(session);
      }
    });
    ws.on("error", (error) => {
      console.error("[MediaStream] WebSocket error:", error);
    });
  }
  /**
   * Handle stream start event.
   */
  async handleStart(ws, message, streamToken) {
    const streamSid = message.streamSid || "";
    const callSid = message.start?.callSid || "";
    const effectiveToken = message.start?.customParameters?.token ?? streamToken;
    console.log(`[MediaStream] Stream started: ${streamSid} (call: ${callSid})`);
    if (!callSid) {
      console.warn("[MediaStream] Missing callSid; closing stream");
      ws.close(1008, "Missing callSid");
      return null;
    }
    if (this.config.shouldAcceptStream && !this.config.shouldAcceptStream({ callId: callSid, streamSid, token: effectiveToken })) {
      console.warn(`[MediaStream] Rejecting stream for unknown call: ${callSid}`);
      ws.close(1008, "Unknown call");
      return null;
    }
    const sttSession = this.config.sttProvider.createSession();
    sttSession.onPartial((partial) => {
      this.config.onPartialTranscript?.(callSid, partial);
    });
    sttSession.onTranscript((transcript) => {
      this.config.onTranscript?.(callSid, transcript);
    });
    sttSession.onSpeechStart(() => {
      this.config.onSpeechStart?.(callSid);
    });
    const session = {
      callId: callSid,
      streamSid,
      ws,
      sttSession
    };
    this.sessions.set(streamSid, session);
    this.config.onConnect?.(callSid, streamSid);
    sttSession.connect().catch((err) => {
      console.warn(`[MediaStream] STT connection failed (TTS still works):`, err.message);
    });
    return session;
  }
  /**
   * Handle stream stop event.
   */
  handleStop(session) {
    console.log(`[MediaStream] Stream stopped: ${session.streamSid}`);
    this.clearTtsState(session.streamSid);
    session.sttSession.close();
    this.sessions.delete(session.streamSid);
    this.config.onDisconnect?.(session.callId);
  }
  getStreamToken(request) {
    if (!request.url || !request.headers.host) {
      return void 0;
    }
    try {
      const url = new URL(request.url, `http://${request.headers.host}`);
      return url.searchParams.get("token") ?? void 0;
    } catch {
      return void 0;
    }
  }
  getClientIp(request) {
    return request.socket.remoteAddress || "unknown";
  }
  registerPendingConnection(ws, ip) {
    if (this.pendingConnections.size >= this.maxPendingConnections) {
      console.warn("[MediaStream] Rejecting connection: pending connection limit reached");
      return false;
    }
    const pendingForIp = this.pendingByIp.get(ip) ?? 0;
    if (pendingForIp >= this.maxPendingConnectionsPerIp) {
      console.warn(`[MediaStream] Rejecting connection: pending per-IP limit reached (${ip})`);
      return false;
    }
    const timeout = setTimeout(() => {
      if (!this.pendingConnections.has(ws)) {
        return;
      }
      console.warn(
        `[MediaStream] Closing pre-start idle connection after ${this.preStartTimeoutMs}ms (${ip})`
      );
      ws.close(1008, "Start timeout");
    }, this.preStartTimeoutMs);
    timeout.unref?.();
    this.pendingConnections.set(ws, { ip, timeout });
    this.pendingByIp.set(ip, pendingForIp + 1);
    return true;
  }
  clearPendingConnection(ws) {
    const pending = this.pendingConnections.get(ws);
    if (!pending) {
      return;
    }
    clearTimeout(pending.timeout);
    this.pendingConnections.delete(ws);
    const current = this.pendingByIp.get(pending.ip) ?? 0;
    if (current <= 1) {
      this.pendingByIp.delete(pending.ip);
      return;
    }
    this.pendingByIp.set(pending.ip, current - 1);
  }
  rejectUpgrade(socket, statusCode, message) {
    const statusText = statusCode === 429 ? "Too Many Requests" : "Service Unavailable";
    const body = `${message}
`;
    socket.write(
      `HTTP/1.1 ${statusCode} ${statusText}\r
Connection: close\r
Content-Type: text/plain; charset=utf-8\r
Content-Length: ${Buffer.byteLength(body)}\r
\r
` + body
    );
    socket.destroy();
  }
  /**
   * Get an active session with an open WebSocket, or undefined if unavailable.
   */
  getOpenSession(streamSid) {
    const session = this.sessions.get(streamSid);
    return session?.ws.readyState === WebSocket.OPEN ? session : void 0;
  }
  /**
   * Send a message to a stream's WebSocket if available.
   */
  sendToStream(streamSid, message) {
    const session = this.getOpenSession(streamSid);
    session?.ws.send(JSON.stringify(message));
  }
  /**
   * Send audio to a specific stream (for TTS playback).
   * Audio should be mu-law encoded at 8kHz mono.
   */
  sendAudio(streamSid, muLawAudio) {
    this.sendToStream(streamSid, {
      event: "media",
      streamSid,
      media: { payload: muLawAudio.toString("base64") }
    });
  }
  /**
   * Send a mark event to track audio playback position.
   */
  sendMark(streamSid, name) {
    this.sendToStream(streamSid, {
      event: "mark",
      streamSid,
      mark: { name }
    });
  }
  /**
   * Clear audio buffer (interrupt playback).
   */
  clearAudio(streamSid) {
    this.sendToStream(streamSid, { event: "clear", streamSid });
  }
  /**
   * Queue a TTS operation for sequential playback.
   * Only one TTS operation plays at a time per stream to prevent overlap.
   */
  async queueTts(streamSid, playFn) {
    const queue = this.getTtsQueue(streamSid);
    let resolveEntry;
    let rejectEntry;
    const promise = new Promise((resolve, reject) => {
      resolveEntry = resolve;
      rejectEntry = reject;
    });
    queue.push({
      playFn,
      controller: new AbortController(),
      resolve: resolveEntry,
      reject: rejectEntry
    });
    if (!this.ttsPlaying.get(streamSid)) {
      void this.processQueue(streamSid);
    }
    return promise;
  }
  /**
   * Clear TTS queue and interrupt current playback (barge-in).
   */
  clearTtsQueue(streamSid) {
    const queue = this.getTtsQueue(streamSid);
    queue.length = 0;
    this.ttsActiveControllers.get(streamSid)?.abort();
    this.clearAudio(streamSid);
  }
  /**
   * Get active session by call ID.
   */
  getSessionByCallId(callId) {
    return [...this.sessions.values()].find((session) => session.callId === callId);
  }
  /**
   * Close all sessions.
   */
  closeAll() {
    for (const session of this.sessions.values()) {
      this.clearTtsState(session.streamSid);
      session.sttSession.close();
      session.ws.close();
    }
    this.sessions.clear();
  }
  getTtsQueue(streamSid) {
    const existing = this.ttsQueues.get(streamSid);
    if (existing) {
      return existing;
    }
    const queue = [];
    this.ttsQueues.set(streamSid, queue);
    return queue;
  }
  /**
   * Process the TTS queue for a stream.
   * Uses iterative approach to avoid stack accumulation from recursion.
   */
  async processQueue(streamSid) {
    this.ttsPlaying.set(streamSid, true);
    while (true) {
      const queue = this.ttsQueues.get(streamSid);
      if (!queue || queue.length === 0) {
        this.ttsPlaying.set(streamSid, false);
        this.ttsActiveControllers.delete(streamSid);
        return;
      }
      const entry = queue.shift();
      this.ttsActiveControllers.set(streamSid, entry.controller);
      try {
        await entry.playFn(entry.controller.signal);
        entry.resolve();
      } catch (error) {
        if (entry.controller.signal.aborted) {
          entry.resolve();
        } else {
          console.error("[MediaStream] TTS playback error:", error);
          entry.reject(error);
        }
      } finally {
        if (this.ttsActiveControllers.get(streamSid) === entry.controller) {
          this.ttsActiveControllers.delete(streamSid);
        }
      }
    }
  }
  clearTtsState(streamSid) {
    const queue = this.ttsQueues.get(streamSid);
    if (queue) {
      queue.length = 0;
    }
    this.ttsActiveControllers.get(streamSid)?.abort();
    this.ttsActiveControllers.delete(streamSid);
    this.ttsPlaying.delete(streamSid);
    this.ttsQueues.delete(streamSid);
  }
};

// vendor/openclaw-runtime/win-x64/extensions/voice-call/src/providers/stt-openai-realtime.ts
import WebSocket2 from "ws";
var OpenAIRealtimeSTTProvider = class {
  name = "openai-realtime";
  apiKey;
  model;
  silenceDurationMs;
  vadThreshold;
  constructor(config) {
    if (!config.apiKey) {
      throw new Error("OpenAI API key required for Realtime STT");
    }
    this.apiKey = config.apiKey;
    this.model = config.model || "gpt-4o-transcribe";
    this.silenceDurationMs = config.silenceDurationMs || 800;
    this.vadThreshold = config.vadThreshold || 0.5;
  }
  /**
   * Create a new realtime transcription session.
   */
  createSession() {
    return new OpenAIRealtimeSTTSession(
      this.apiKey,
      this.model,
      this.silenceDurationMs,
      this.vadThreshold
    );
  }
};
var OpenAIRealtimeSTTSession = class _OpenAIRealtimeSTTSession {
  constructor(apiKey, model, silenceDurationMs, vadThreshold) {
    this.apiKey = apiKey;
    this.model = model;
    this.silenceDurationMs = silenceDurationMs;
    this.vadThreshold = vadThreshold;
  }
  static MAX_RECONNECT_ATTEMPTS = 5;
  static RECONNECT_DELAY_MS = 1e3;
  ws = null;
  connected = false;
  closed = false;
  reconnectAttempts = 0;
  pendingTranscript = "";
  onTranscriptCallback = null;
  onPartialCallback = null;
  onSpeechStartCallback = null;
  async connect() {
    this.closed = false;
    this.reconnectAttempts = 0;
    return this.doConnect();
  }
  async doConnect() {
    return new Promise((resolve, reject) => {
      const url = "wss://api.openai.com/v1/realtime?intent=transcription";
      this.ws = new WebSocket2(url, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "OpenAI-Beta": "realtime=v1"
        }
      });
      this.ws.on("open", () => {
        console.log("[RealtimeSTT] WebSocket connected");
        this.connected = true;
        this.reconnectAttempts = 0;
        this.sendEvent({
          type: "transcription_session.update",
          session: {
            input_audio_format: "g711_ulaw",
            input_audio_transcription: {
              model: this.model
            },
            turn_detection: {
              type: "server_vad",
              threshold: this.vadThreshold,
              prefix_padding_ms: 300,
              silence_duration_ms: this.silenceDurationMs
            }
          }
        });
        resolve();
      });
      this.ws.on("message", (data) => {
        try {
          const event = JSON.parse(data.toString());
          this.handleEvent(event);
        } catch (e) {
          console.error("[RealtimeSTT] Failed to parse event:", e);
        }
      });
      this.ws.on("error", (error) => {
        console.error("[RealtimeSTT] WebSocket error:", error);
        if (!this.connected) {
          reject(error);
        }
      });
      this.ws.on("close", (code, reason) => {
        console.log(
          `[RealtimeSTT] WebSocket closed (code: ${code}, reason: ${reason?.toString() || "none"})`
        );
        this.connected = false;
        if (!this.closed) {
          void this.attemptReconnect();
        }
      });
      setTimeout(() => {
        if (!this.connected) {
          reject(new Error("Realtime STT connection timeout"));
        }
      }, 1e4);
    });
  }
  async attemptReconnect() {
    if (this.closed) {
      return;
    }
    if (this.reconnectAttempts >= _OpenAIRealtimeSTTSession.MAX_RECONNECT_ATTEMPTS) {
      console.error(
        `[RealtimeSTT] Max reconnect attempts (${_OpenAIRealtimeSTTSession.MAX_RECONNECT_ATTEMPTS}) reached`
      );
      return;
    }
    this.reconnectAttempts++;
    const delay = _OpenAIRealtimeSTTSession.RECONNECT_DELAY_MS * 2 ** (this.reconnectAttempts - 1);
    console.log(
      `[RealtimeSTT] Reconnecting ${this.reconnectAttempts}/${_OpenAIRealtimeSTTSession.MAX_RECONNECT_ATTEMPTS} in ${delay}ms...`
    );
    await new Promise((resolve) => setTimeout(resolve, delay));
    if (this.closed) {
      return;
    }
    try {
      await this.doConnect();
      console.log("[RealtimeSTT] Reconnected successfully");
    } catch (error) {
      console.error("[RealtimeSTT] Reconnect failed:", error);
    }
  }
  handleEvent(event) {
    switch (event.type) {
      case "transcription_session.created":
      case "transcription_session.updated":
      case "input_audio_buffer.speech_stopped":
      case "input_audio_buffer.committed":
        console.log(`[RealtimeSTT] ${event.type}`);
        break;
      case "conversation.item.input_audio_transcription.delta":
        if (event.delta) {
          this.pendingTranscript += event.delta;
          this.onPartialCallback?.(this.pendingTranscript);
        }
        break;
      case "conversation.item.input_audio_transcription.completed":
        if (event.transcript) {
          console.log(`[RealtimeSTT] Transcript: ${event.transcript}`);
          this.onTranscriptCallback?.(event.transcript);
        }
        this.pendingTranscript = "";
        break;
      case "input_audio_buffer.speech_started":
        console.log("[RealtimeSTT] Speech started");
        this.pendingTranscript = "";
        this.onSpeechStartCallback?.();
        break;
      case "error":
        console.error("[RealtimeSTT] Error:", event.error);
        break;
    }
  }
  sendEvent(event) {
    if (this.ws?.readyState === WebSocket2.OPEN) {
      this.ws.send(JSON.stringify(event));
    }
  }
  sendAudio(muLawData) {
    if (!this.connected) {
      return;
    }
    this.sendEvent({
      type: "input_audio_buffer.append",
      audio: muLawData.toString("base64")
    });
  }
  onPartial(callback) {
    this.onPartialCallback = callback;
  }
  onTranscript(callback) {
    this.onTranscriptCallback = callback;
  }
  onSpeechStart(callback) {
    this.onSpeechStartCallback = callback;
  }
  async waitForTranscript(timeoutMs = 3e4) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.onTranscriptCallback = null;
        reject(new Error("Transcript timeout"));
      }, timeoutMs);
      this.onTranscriptCallback = (transcript) => {
        clearTimeout(timeout);
        this.onTranscriptCallback = null;
        resolve(transcript);
      };
    });
  }
  close() {
    this.closed = true;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
  }
  isConnected() {
    return this.connected;
  }
};

// vendor/openclaw-runtime/win-x64/extensions/voice-call/src/webhook/stale-call-reaper.ts
var CHECK_INTERVAL_MS = 3e4;
function startStaleCallReaper(params) {
  const maxAgeSeconds = params.staleCallReaperSeconds;
  if (!maxAgeSeconds || maxAgeSeconds <= 0) {
    return null;
  }
  const maxAgeMs = maxAgeSeconds * 1e3;
  const interval = setInterval(() => {
    const now = Date.now();
    for (const call of params.manager.getActiveCalls()) {
      const age = now - call.startedAt;
      if (age > maxAgeMs) {
        console.log(
          `[voice-call] Reaping stale call ${call.callId} (age: ${Math.round(age / 1e3)}s, state: ${call.state})`
        );
        void params.manager.endCall(call.callId).catch((err) => {
          console.warn(`[voice-call] Reaper failed to end call ${call.callId}:`, err);
        });
      }
    }
  }, CHECK_INTERVAL_MS);
  return () => {
    clearInterval(interval);
  };
}

// vendor/openclaw-runtime/win-x64/extensions/voice-call/src/webhook.ts
var MAX_WEBHOOK_BODY_BYTES = 1024 * 1024;
var VoiceCallWebhookServer = class {
  server = null;
  listeningUrl = null;
  config;
  manager;
  provider;
  coreConfig;
  stopStaleCallReaper = null;
  /** Media stream handler for bidirectional audio (when streaming enabled) */
  mediaStreamHandler = null;
  constructor(config, manager, provider, coreConfig) {
    this.config = config;
    this.manager = manager;
    this.provider = provider;
    this.coreConfig = coreConfig ?? null;
    if (config.streaming?.enabled) {
      this.initializeMediaStreaming();
    }
  }
  /**
   * Get the media stream handler (for wiring to provider).
   */
  getMediaStreamHandler() {
    return this.mediaStreamHandler;
  }
  /**
   * Initialize media streaming with OpenAI Realtime STT.
   */
  initializeMediaStreaming() {
    const apiKey = this.config.streaming?.openaiApiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.warn("[voice-call] Streaming enabled but no OpenAI API key found");
      return;
    }
    const sttProvider = new OpenAIRealtimeSTTProvider({
      apiKey,
      model: this.config.streaming?.sttModel,
      silenceDurationMs: this.config.streaming?.silenceDurationMs,
      vadThreshold: this.config.streaming?.vadThreshold
    });
    const streamConfig = {
      sttProvider,
      preStartTimeoutMs: this.config.streaming?.preStartTimeoutMs,
      maxPendingConnections: this.config.streaming?.maxPendingConnections,
      maxPendingConnectionsPerIp: this.config.streaming?.maxPendingConnectionsPerIp,
      maxConnections: this.config.streaming?.maxConnections,
      shouldAcceptStream: ({ callId, token }) => {
        const call = this.manager.getCallByProviderCallId(callId);
        if (!call) {
          return false;
        }
        if (this.provider.name === "twilio") {
          const twilio = this.provider;
          if (!twilio.isValidStreamToken(callId, token)) {
            console.warn(`[voice-call] Rejecting media stream: invalid token for ${callId}`);
            return false;
          }
        }
        return true;
      },
      onTranscript: (providerCallId, transcript) => {
        console.log(`[voice-call] Transcript for ${providerCallId}: ${transcript}`);
        if (this.provider.name === "twilio") {
          this.provider.clearTtsQueue(providerCallId);
        }
        const call = this.manager.getCallByProviderCallId(providerCallId);
        if (!call) {
          console.warn(`[voice-call] No active call found for provider ID: ${providerCallId}`);
          return;
        }
        const event = {
          id: `stream-transcript-${Date.now()}`,
          type: "call.speech",
          callId: call.callId,
          providerCallId,
          timestamp: Date.now(),
          transcript,
          isFinal: true
        };
        this.manager.processEvent(event);
        const callMode = call.metadata?.mode;
        const shouldRespond = call.direction === "inbound" || callMode === "conversation";
        if (shouldRespond) {
          this.handleInboundResponse(call.callId, transcript).catch((err) => {
            console.warn(`[voice-call] Failed to auto-respond:`, err);
          });
        }
      },
      onSpeechStart: (providerCallId) => {
        if (this.provider.name === "twilio") {
          this.provider.clearTtsQueue(providerCallId);
        }
      },
      onPartialTranscript: (callId, partial) => {
        console.log(`[voice-call] Partial for ${callId}: ${partial}`);
      },
      onConnect: (callId, streamSid) => {
        console.log(`[voice-call] Media stream connected: ${callId} -> ${streamSid}`);
        if (this.provider.name === "twilio") {
          this.provider.registerCallStream(callId, streamSid);
        }
        setTimeout(() => {
          this.manager.speakInitialMessage(callId).catch((err) => {
            console.warn(`[voice-call] Failed to speak initial message:`, err);
          });
        }, 500);
      },
      onDisconnect: (callId) => {
        console.log(`[voice-call] Media stream disconnected: ${callId}`);
        const disconnectedCall = this.manager.getCallByProviderCallId(callId);
        if (disconnectedCall) {
          console.log(
            `[voice-call] Auto-ending call ${disconnectedCall.callId} on stream disconnect`
          );
          void this.manager.endCall(disconnectedCall.callId).catch((err) => {
            console.warn(`[voice-call] Failed to auto-end call ${disconnectedCall.callId}:`, err);
          });
        }
        if (this.provider.name === "twilio") {
          this.provider.unregisterCallStream(callId);
        }
      }
    };
    this.mediaStreamHandler = new MediaStreamHandler(streamConfig);
    console.log("[voice-call] Media streaming initialized");
  }
  /**
   * Start the webhook server.
   * Idempotent: returns immediately if the server is already listening.
   */
  async start() {
    const { port, bind, path: webhookPath } = this.config.serve;
    const streamPath = this.config.streaming?.streamPath || "/voice/stream";
    if (this.server?.listening) {
      return this.listeningUrl ?? this.resolveListeningUrl(bind, webhookPath);
    }
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res, webhookPath).catch((err) => {
          console.error("[voice-call] Webhook error:", err);
          res.statusCode = 500;
          res.end("Internal Server Error");
        });
      });
      if (this.mediaStreamHandler) {
        this.server.on("upgrade", (request, socket, head) => {
          const path6 = this.getUpgradePathname(request);
          if (path6 === streamPath) {
            console.log("[voice-call] WebSocket upgrade for media stream");
            this.mediaStreamHandler?.handleUpgrade(request, socket, head);
          } else {
            socket.destroy();
          }
        });
      }
      this.server.on("error", reject);
      this.server.listen(port, bind, () => {
        const url = this.resolveListeningUrl(bind, webhookPath);
        this.listeningUrl = url;
        console.log(`[voice-call] Webhook server listening on ${url}`);
        if (this.mediaStreamHandler) {
          const address = this.server?.address();
          const actualPort = address && typeof address === "object" ? address.port : this.config.serve.port;
          console.log(
            `[voice-call] Media stream WebSocket on ws://${bind}:${actualPort}${streamPath}`
          );
        }
        resolve(url);
        this.stopStaleCallReaper = startStaleCallReaper({
          manager: this.manager,
          staleCallReaperSeconds: this.config.staleCallReaperSeconds
        });
      });
    });
  }
  /**
   * Stop the webhook server.
   */
  async stop() {
    if (this.stopStaleCallReaper) {
      this.stopStaleCallReaper();
      this.stopStaleCallReaper = null;
    }
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          this.server = null;
          this.listeningUrl = null;
          resolve();
        });
      } else {
        this.listeningUrl = null;
        resolve();
      }
    });
  }
  resolveListeningUrl(bind, webhookPath) {
    const address = this.server?.address();
    if (address && typeof address === "object") {
      const host = address.address && address.address.length > 0 ? address.address : bind;
      const normalizedHost = host.includes(":") && !host.startsWith("[") ? `[${host}]` : host;
      return `http://${normalizedHost}:${address.port}${webhookPath}`;
    }
    return `http://${bind}:${this.config.serve.port}${webhookPath}`;
  }
  getUpgradePathname(request) {
    try {
      const host = request.headers.host || "localhost";
      return new URL2(request.url || "/", `http://${host}`).pathname;
    } catch {
      return null;
    }
  }
  normalizeWebhookPathForMatch(pathname) {
    const trimmed = pathname.trim();
    if (!trimmed) {
      return "/";
    }
    const prefixed = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
    if (prefixed === "/") {
      return prefixed;
    }
    return prefixed.endsWith("/") ? prefixed.slice(0, -1) : prefixed;
  }
  isWebhookPathMatch(requestPath, configuredPath) {
    return this.normalizeWebhookPathForMatch(requestPath) === this.normalizeWebhookPathForMatch(configuredPath);
  }
  /**
   * Handle incoming HTTP request.
   */
  async handleRequest(req, res, webhookPath) {
    const payload = await this.runWebhookPipeline(req, webhookPath);
    this.writeWebhookResponse(res, payload);
  }
  async runWebhookPipeline(req, webhookPath) {
    const url = new URL2(req.url || "/", `http://${req.headers.host}`);
    if (url.pathname === "/voice/hold-music") {
      return {
        statusCode: 200,
        headers: { "Content-Type": "text/xml" },
        body: `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">All agents are currently busy. Please hold.</Say>
  <Play loop="0">https://s3.amazonaws.com/com.twilio.music.classical/BusyStrings.mp3</Play>
</Response>`
      };
    }
    if (!this.isWebhookPathMatch(url.pathname, webhookPath)) {
      return { statusCode: 404, body: "Not Found" };
    }
    if (req.method !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }
    let body = "";
    try {
      body = await this.readBody(req, MAX_WEBHOOK_BODY_BYTES);
    } catch (err) {
      if (isRequestBodyLimitError(err, "PAYLOAD_TOO_LARGE")) {
        return { statusCode: 413, body: "Payload Too Large" };
      }
      if (isRequestBodyLimitError(err, "REQUEST_BODY_TIMEOUT")) {
        return { statusCode: 408, body: requestBodyErrorToText("REQUEST_BODY_TIMEOUT") };
      }
      throw err;
    }
    const ctx = {
      headers: req.headers,
      rawBody: body,
      url: `http://${req.headers.host}${req.url}`,
      method: "POST",
      query: Object.fromEntries(url.searchParams),
      remoteAddress: req.socket.remoteAddress ?? void 0
    };
    const verification = this.provider.verifyWebhook(ctx);
    if (!verification.ok) {
      console.warn(`[voice-call] Webhook verification failed: ${verification.reason}`);
      return { statusCode: 401, body: "Unauthorized" };
    }
    if (!verification.verifiedRequestKey) {
      console.warn("[voice-call] Webhook verification succeeded without request identity key");
      return { statusCode: 401, body: "Unauthorized" };
    }
    const parsed = this.provider.parseWebhookEvent(ctx, {
      verifiedRequestKey: verification.verifiedRequestKey
    });
    if (verification.isReplay) {
      console.warn("[voice-call] Replay detected; skipping event side effects");
    } else {
      this.processParsedEvents(parsed.events);
    }
    return {
      statusCode: parsed.statusCode || 200,
      headers: parsed.providerResponseHeaders,
      body: parsed.providerResponseBody || "OK"
    };
  }
  processParsedEvents(events) {
    for (const event of events) {
      try {
        this.manager.processEvent(event);
      } catch (err) {
        console.error(`[voice-call] Error processing event ${event.type}:`, err);
      }
    }
  }
  writeWebhookResponse(res, payload) {
    res.statusCode = payload.statusCode;
    if (payload.headers) {
      for (const [key, value] of Object.entries(payload.headers)) {
        res.setHeader(key, value);
      }
    }
    res.end(payload.body);
  }
  /**
   * Read request body as string with timeout protection.
   */
  readBody(req, maxBytes, timeoutMs = 3e4) {
    return readRequestBodyWithLimit(req, { maxBytes, timeoutMs });
  }
  /**
   * Handle auto-response for inbound calls using the agent system.
   * Supports tool calling for richer voice interactions.
   */
  async handleInboundResponse(callId, userMessage) {
    console.log(`[voice-call] Auto-responding to inbound call ${callId}: "${userMessage}"`);
    const call = this.manager.getCall(callId);
    if (!call) {
      console.warn(`[voice-call] Call ${callId} not found for auto-response`);
      return;
    }
    if (!this.coreConfig) {
      console.warn("[voice-call] Core config missing; skipping auto-response");
      return;
    }
    try {
      const { generateVoiceResponse: generateVoiceResponse2 } = await Promise.resolve().then(() => (init_response_generator(), response_generator_exports));
      const result = await generateVoiceResponse2({
        voiceConfig: this.config,
        coreConfig: this.coreConfig,
        callId,
        from: call.from,
        transcript: call.transcript,
        userMessage
      });
      if (result.error) {
        console.error(`[voice-call] Response generation error: ${result.error}`);
        return;
      }
      if (result.text) {
        console.log(`[voice-call] AI response: "${result.text}"`);
        await this.manager.speak(callId, result.text);
      }
    } catch (err) {
      console.error(`[voice-call] Auto-response error:`, err);
    }
  }
};

// vendor/openclaw-runtime/win-x64/extensions/voice-call/src/runtime.ts
function createRuntimeResourceLifecycle(params) {
  let tunnelResult = null;
  let stopped = false;
  const runStep = async (step, suppressErrors) => {
    if (suppressErrors) {
      await step().catch(() => {
      });
      return;
    }
    await step();
  };
  return {
    setTunnelResult: (result) => {
      tunnelResult = result;
    },
    stop: async (opts) => {
      if (stopped) {
        return;
      }
      stopped = true;
      const suppressErrors = opts?.suppressErrors ?? false;
      await runStep(async () => {
        if (tunnelResult) {
          await tunnelResult.stop();
        }
      }, suppressErrors);
      await runStep(async () => {
        await cleanupTailscaleExposure(params.config);
      }, suppressErrors);
      await runStep(async () => {
        await params.webhookServer.stop();
      }, suppressErrors);
    }
  };
}
function isLoopbackBind(bind) {
  if (!bind) {
    return false;
  }
  return bind === "127.0.0.1" || bind === "::1" || bind === "localhost";
}
function resolveProvider(config) {
  const allowNgrokFreeTierLoopbackBypass = config.tunnel?.provider === "ngrok" && isLoopbackBind(config.serve?.bind) && (config.tunnel?.allowNgrokFreeTierLoopbackBypass ?? false);
  switch (config.provider) {
    case "telnyx":
      return new TelnyxProvider(
        {
          apiKey: config.telnyx?.apiKey,
          connectionId: config.telnyx?.connectionId,
          publicKey: config.telnyx?.publicKey
        },
        {
          skipVerification: config.skipSignatureVerification
        }
      );
    case "twilio":
      return new TwilioProvider(
        {
          accountSid: config.twilio?.accountSid,
          authToken: config.twilio?.authToken
        },
        {
          allowNgrokFreeTierLoopbackBypass,
          publicUrl: config.publicUrl,
          skipVerification: config.skipSignatureVerification,
          streamPath: config.streaming?.enabled ? config.streaming.streamPath : void 0,
          webhookSecurity: config.webhookSecurity
        }
      );
    case "plivo":
      return new PlivoProvider(
        {
          authId: config.plivo?.authId,
          authToken: config.plivo?.authToken
        },
        {
          publicUrl: config.publicUrl,
          skipVerification: config.skipSignatureVerification,
          ringTimeoutSec: Math.max(1, Math.floor(config.ringTimeoutMs / 1e3)),
          webhookSecurity: config.webhookSecurity
        }
      );
    case "mock":
      return new MockProvider();
    default:
      throw new Error(`Unsupported voice-call provider: ${String(config.provider)}`);
  }
}
async function createVoiceCallRuntime(params) {
  const { config: rawConfig, coreConfig, ttsRuntime, logger } = params;
  const log = logger ?? {
    info: console.log,
    warn: console.warn,
    error: console.error,
    debug: console.debug
  };
  const config = resolveVoiceCallConfig(rawConfig);
  if (!config.enabled) {
    throw new Error("Voice call disabled. Enable the plugin entry in config.");
  }
  if (config.skipSignatureVerification) {
    log.warn(
      "[voice-call] SECURITY WARNING: skipSignatureVerification=true disables webhook signature verification (development only). Do not use in production."
    );
  }
  const validation = validateProviderConfig(config);
  if (!validation.valid) {
    throw new Error(`Invalid voice-call config: ${validation.errors.join("; ")}`);
  }
  const provider = resolveProvider(config);
  const manager = new CallManager(config);
  const webhookServer = new VoiceCallWebhookServer(config, manager, provider, coreConfig);
  const lifecycle = createRuntimeResourceLifecycle({ config, webhookServer });
  const localUrl = await webhookServer.start();
  try {
    let publicUrl = config.publicUrl ?? null;
    if (!publicUrl && config.tunnel?.provider && config.tunnel.provider !== "none") {
      try {
        const nextTunnelResult = await startTunnel({
          provider: config.tunnel.provider,
          port: config.serve.port,
          path: config.serve.path,
          ngrokAuthToken: config.tunnel.ngrokAuthToken,
          ngrokDomain: config.tunnel.ngrokDomain
        });
        lifecycle.setTunnelResult(nextTunnelResult);
        publicUrl = nextTunnelResult?.publicUrl ?? null;
      } catch (err) {
        log.error(
          `[voice-call] Tunnel setup failed: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }
    if (!publicUrl && config.tailscale?.mode !== "off") {
      publicUrl = await setupTailscaleExposure(config);
    }
    const webhookUrl = publicUrl ?? localUrl;
    if (publicUrl && provider.name === "twilio") {
      provider.setPublicUrl(publicUrl);
    }
    if (provider.name === "twilio" && config.streaming?.enabled) {
      const twilioProvider = provider;
      if (ttsRuntime?.textToSpeechTelephony) {
        try {
          const ttsProvider = createTelephonyTtsProvider({
            coreConfig,
            ttsOverride: config.tts,
            runtime: ttsRuntime
          });
          twilioProvider.setTTSProvider(ttsProvider);
          log.info("[voice-call] Telephony TTS provider configured");
        } catch (err) {
          log.warn(
            `[voice-call] Failed to initialize telephony TTS: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      } else {
        log.warn("[voice-call] Telephony TTS unavailable; streaming TTS disabled");
      }
      const mediaHandler = webhookServer.getMediaStreamHandler();
      if (mediaHandler) {
        twilioProvider.setMediaStreamHandler(mediaHandler);
        log.info("[voice-call] Media stream handler wired to provider");
      }
    }
    await manager.initialize(provider, webhookUrl);
    const stop = async () => await lifecycle.stop();
    log.info("[voice-call] Runtime initialized");
    log.info(`[voice-call] Webhook URL: ${webhookUrl}`);
    if (publicUrl) {
      log.info(`[voice-call] Public URL: ${publicUrl}`);
    }
    return {
      config,
      provider,
      manager,
      webhookServer,
      webhookUrl,
      publicUrl,
      stop
    };
  } catch (err) {
    await lifecycle.stop({ suppressErrors: true });
    throw err;
  }
}

// vendor/openclaw-runtime/win-x64/extensions/voice-call/index.ts
var voiceCallConfigSchema = {
  parse(value) {
    const raw = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    const twilio = raw.twilio;
    const legacyFrom = typeof twilio?.from === "string" ? twilio.from : void 0;
    const enabled = typeof raw.enabled === "boolean" ? raw.enabled : true;
    const providerRaw = raw.provider === "log" ? "mock" : raw.provider;
    const provider = providerRaw ?? (enabled ? "mock" : void 0);
    return VoiceCallConfigSchema.parse({
      ...raw,
      enabled,
      provider,
      fromNumber: raw.fromNumber ?? legacyFrom
    });
  },
  uiHints: {
    provider: {
      label: "Provider",
      help: "Use twilio, telnyx, or mock for dev/no-network."
    },
    fromNumber: { label: "From Number", placeholder: "+15550001234" },
    toNumber: { label: "Default To Number", placeholder: "+15550001234" },
    inboundPolicy: { label: "Inbound Policy" },
    allowFrom: { label: "Inbound Allowlist" },
    inboundGreeting: { label: "Inbound Greeting", advanced: true },
    "telnyx.apiKey": { label: "Telnyx API Key", sensitive: true },
    "telnyx.connectionId": { label: "Telnyx Connection ID" },
    "telnyx.publicKey": { label: "Telnyx Public Key", sensitive: true },
    "twilio.accountSid": { label: "Twilio Account SID" },
    "twilio.authToken": { label: "Twilio Auth Token", sensitive: true },
    "outbound.defaultMode": { label: "Default Call Mode" },
    "outbound.notifyHangupDelaySec": {
      label: "Notify Hangup Delay (sec)",
      advanced: true
    },
    "serve.port": { label: "Webhook Port" },
    "serve.bind": { label: "Webhook Bind" },
    "serve.path": { label: "Webhook Path" },
    "tailscale.mode": { label: "Tailscale Mode", advanced: true },
    "tailscale.path": { label: "Tailscale Path", advanced: true },
    "tunnel.provider": { label: "Tunnel Provider", advanced: true },
    "tunnel.ngrokAuthToken": {
      label: "ngrok Auth Token",
      sensitive: true,
      advanced: true
    },
    "tunnel.ngrokDomain": { label: "ngrok Domain", advanced: true },
    "tunnel.allowNgrokFreeTierLoopbackBypass": {
      label: "Allow ngrok Free Tier (Loopback Bypass)",
      advanced: true
    },
    "streaming.enabled": { label: "Enable Streaming", advanced: true },
    "streaming.openaiApiKey": {
      label: "OpenAI Realtime API Key",
      sensitive: true,
      advanced: true
    },
    "streaming.sttModel": { label: "Realtime STT Model", advanced: true },
    "streaming.streamPath": { label: "Media Stream Path", advanced: true },
    "tts.provider": {
      label: "TTS Provider Override",
      help: "Deep-merges with messages.tts (Edge is ignored for calls).",
      advanced: true
    },
    "tts.openai.model": { label: "OpenAI TTS Model", advanced: true },
    "tts.openai.voice": { label: "OpenAI TTS Voice", advanced: true },
    "tts.openai.apiKey": {
      label: "OpenAI API Key",
      sensitive: true,
      advanced: true
    },
    "tts.elevenlabs.modelId": { label: "ElevenLabs Model ID", advanced: true },
    "tts.elevenlabs.voiceId": { label: "ElevenLabs Voice ID", advanced: true },
    "tts.elevenlabs.apiKey": {
      label: "ElevenLabs API Key",
      sensitive: true,
      advanced: true
    },
    "tts.elevenlabs.baseUrl": { label: "ElevenLabs Base URL", advanced: true },
    publicUrl: { label: "Public Webhook URL", advanced: true },
    skipSignatureVerification: {
      label: "Skip Signature Verification",
      advanced: true
    },
    store: { label: "Call Log Store Path", advanced: true },
    responseModel: { label: "Response Model", advanced: true },
    responseSystemPrompt: { label: "Response System Prompt", advanced: true },
    responseTimeoutMs: { label: "Response Timeout (ms)", advanced: true }
  }
};
var VoiceCallToolSchema = Type.Union([
  Type.Object({
    action: Type.Literal("initiate_call"),
    to: Type.Optional(Type.String({ description: "Call target" })),
    message: Type.String({ description: "Intro message" }),
    mode: Type.Optional(Type.Union([Type.Literal("notify"), Type.Literal("conversation")]))
  }),
  Type.Object({
    action: Type.Literal("continue_call"),
    callId: Type.String({ description: "Call ID" }),
    message: Type.String({ description: "Follow-up message" })
  }),
  Type.Object({
    action: Type.Literal("speak_to_user"),
    callId: Type.String({ description: "Call ID" }),
    message: Type.String({ description: "Message to speak" })
  }),
  Type.Object({
    action: Type.Literal("end_call"),
    callId: Type.String({ description: "Call ID" })
  }),
  Type.Object({
    action: Type.Literal("get_status"),
    callId: Type.String({ description: "Call ID" })
  }),
  Type.Object({
    mode: Type.Optional(Type.Union([Type.Literal("call"), Type.Literal("status")])),
    to: Type.Optional(Type.String({ description: "Call target" })),
    sid: Type.Optional(Type.String({ description: "Call SID" })),
    message: Type.Optional(Type.String({ description: "Optional intro message" }))
  })
]);
var voiceCallPlugin = {
  id: "voice-call",
  name: "Voice Call",
  description: "Voice-call plugin with Telnyx/Twilio/Plivo providers",
  configSchema: voiceCallConfigSchema,
  register(api) {
    const config = resolveVoiceCallConfig(voiceCallConfigSchema.parse(api.pluginConfig));
    const validation = validateProviderConfig(config);
    if (api.pluginConfig && typeof api.pluginConfig === "object") {
      const raw = api.pluginConfig;
      const twilio = raw.twilio;
      if (raw.provider === "log") {
        api.logger.warn('[voice-call] provider "log" is deprecated; use "mock" instead');
      }
      if (typeof twilio?.from === "string") {
        api.logger.warn("[voice-call] twilio.from is deprecated; use fromNumber instead");
      }
    }
    let runtimePromise = null;
    let runtime = null;
    const ensureRuntime = async () => {
      if (!config.enabled) {
        throw new Error("Voice call disabled in plugin config");
      }
      if (!validation.valid) {
        throw new Error(validation.errors.join("; "));
      }
      if (runtime) {
        return runtime;
      }
      if (!runtimePromise) {
        runtimePromise = createVoiceCallRuntime({
          config,
          coreConfig: api.config,
          ttsRuntime: api.runtime.tts,
          logger: api.logger
        });
      }
      try {
        runtime = await runtimePromise;
      } catch (err) {
        runtimePromise = null;
        throw err;
      }
      return runtime;
    };
    const sendError = (respond, err) => {
      respond(false, { error: err instanceof Error ? err.message : String(err) });
    };
    const resolveCallMessageRequest = async (params) => {
      const callId = typeof params?.callId === "string" ? params.callId.trim() : "";
      const message = typeof params?.message === "string" ? params.message.trim() : "";
      if (!callId || !message) {
        return { error: "callId and message required" };
      }
      const rt = await ensureRuntime();
      return { rt, callId, message };
    };
    api.registerGatewayMethod(
      "voicecall.initiate",
      async ({ params, respond }) => {
        try {
          const message = typeof params?.message === "string" ? params.message.trim() : "";
          if (!message) {
            respond(false, { error: "message required" });
            return;
          }
          const rt = await ensureRuntime();
          const to = typeof params?.to === "string" && params.to.trim() ? params.to.trim() : rt.config.toNumber;
          if (!to) {
            respond(false, { error: "to required" });
            return;
          }
          const mode = params?.mode === "notify" || params?.mode === "conversation" ? params.mode : void 0;
          const result = await rt.manager.initiateCall(to, void 0, {
            message,
            mode
          });
          if (!result.success) {
            respond(false, { error: result.error || "initiate failed" });
            return;
          }
          respond(true, { callId: result.callId, initiated: true });
        } catch (err) {
          sendError(respond, err);
        }
      }
    );
    api.registerGatewayMethod(
      "voicecall.continue",
      async ({ params, respond }) => {
        try {
          const request = await resolveCallMessageRequest(params);
          if ("error" in request) {
            respond(false, { error: request.error });
            return;
          }
          const result = await request.rt.manager.continueCall(request.callId, request.message);
          if (!result.success) {
            respond(false, { error: result.error || "continue failed" });
            return;
          }
          respond(true, { success: true, transcript: result.transcript });
        } catch (err) {
          sendError(respond, err);
        }
      }
    );
    api.registerGatewayMethod(
      "voicecall.speak",
      async ({ params, respond }) => {
        try {
          const request = await resolveCallMessageRequest(params);
          if ("error" in request) {
            respond(false, { error: request.error });
            return;
          }
          const result = await request.rt.manager.speak(request.callId, request.message);
          if (!result.success) {
            respond(false, { error: result.error || "speak failed" });
            return;
          }
          respond(true, { success: true });
        } catch (err) {
          sendError(respond, err);
        }
      }
    );
    api.registerGatewayMethod(
      "voicecall.end",
      async ({ params, respond }) => {
        try {
          const callId = typeof params?.callId === "string" ? params.callId.trim() : "";
          if (!callId) {
            respond(false, { error: "callId required" });
            return;
          }
          const rt = await ensureRuntime();
          const result = await rt.manager.endCall(callId);
          if (!result.success) {
            respond(false, { error: result.error || "end failed" });
            return;
          }
          respond(true, { success: true });
        } catch (err) {
          sendError(respond, err);
        }
      }
    );
    api.registerGatewayMethod(
      "voicecall.status",
      async ({ params, respond }) => {
        try {
          const raw = typeof params?.callId === "string" ? params.callId.trim() : typeof params?.sid === "string" ? params.sid.trim() : "";
          if (!raw) {
            respond(false, { error: "callId required" });
            return;
          }
          const rt = await ensureRuntime();
          const call = rt.manager.getCall(raw) || rt.manager.getCallByProviderCallId(raw);
          if (!call) {
            respond(true, { found: false });
            return;
          }
          respond(true, { found: true, call });
        } catch (err) {
          sendError(respond, err);
        }
      }
    );
    api.registerGatewayMethod(
      "voicecall.start",
      async ({ params, respond }) => {
        try {
          const to = typeof params?.to === "string" ? params.to.trim() : "";
          const message = typeof params?.message === "string" ? params.message.trim() : "";
          if (!to) {
            respond(false, { error: "to required" });
            return;
          }
          const rt = await ensureRuntime();
          const result = await rt.manager.initiateCall(to, void 0, {
            message: message || void 0
          });
          if (!result.success) {
            respond(false, { error: result.error || "initiate failed" });
            return;
          }
          respond(true, { callId: result.callId, initiated: true });
        } catch (err) {
          sendError(respond, err);
        }
      }
    );
    api.registerTool({
      name: "voice_call",
      label: "Voice Call",
      description: "Make phone calls and have voice conversations via the voice-call plugin.",
      parameters: VoiceCallToolSchema,
      async execute(_toolCallId, params) {
        const json = (payload) => ({
          content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
          details: payload
        });
        try {
          const rt = await ensureRuntime();
          if (typeof params?.action === "string") {
            switch (params.action) {
              case "initiate_call": {
                const message = String(params.message || "").trim();
                if (!message) {
                  throw new Error("message required");
                }
                const to2 = typeof params.to === "string" && params.to.trim() ? params.to.trim() : rt.config.toNumber;
                if (!to2) {
                  throw new Error("to required");
                }
                const result2 = await rt.manager.initiateCall(to2, void 0, {
                  message,
                  mode: params.mode === "notify" || params.mode === "conversation" ? params.mode : void 0
                });
                if (!result2.success) {
                  throw new Error(result2.error || "initiate failed");
                }
                return json({ callId: result2.callId, initiated: true });
              }
              case "continue_call": {
                const callId = String(params.callId || "").trim();
                const message = String(params.message || "").trim();
                if (!callId || !message) {
                  throw new Error("callId and message required");
                }
                const result2 = await rt.manager.continueCall(callId, message);
                if (!result2.success) {
                  throw new Error(result2.error || "continue failed");
                }
                return json({ success: true, transcript: result2.transcript });
              }
              case "speak_to_user": {
                const callId = String(params.callId || "").trim();
                const message = String(params.message || "").trim();
                if (!callId || !message) {
                  throw new Error("callId and message required");
                }
                const result2 = await rt.manager.speak(callId, message);
                if (!result2.success) {
                  throw new Error(result2.error || "speak failed");
                }
                return json({ success: true });
              }
              case "end_call": {
                const callId = String(params.callId || "").trim();
                if (!callId) {
                  throw new Error("callId required");
                }
                const result2 = await rt.manager.endCall(callId);
                if (!result2.success) {
                  throw new Error(result2.error || "end failed");
                }
                return json({ success: true });
              }
              case "get_status": {
                const callId = String(params.callId || "").trim();
                if (!callId) {
                  throw new Error("callId required");
                }
                const call = rt.manager.getCall(callId) || rt.manager.getCallByProviderCallId(callId);
                return json(call ? { found: true, call } : { found: false });
              }
            }
          }
          const mode = params?.mode ?? "call";
          if (mode === "status") {
            const sid = typeof params.sid === "string" ? params.sid.trim() : "";
            if (!sid) {
              throw new Error("sid required for status");
            }
            const call = rt.manager.getCall(sid) || rt.manager.getCallByProviderCallId(sid);
            return json(call ? { found: true, call } : { found: false });
          }
          const to = typeof params.to === "string" && params.to.trim() ? params.to.trim() : rt.config.toNumber;
          if (!to) {
            throw new Error("to required for call");
          }
          const result = await rt.manager.initiateCall(to, void 0, {
            message: typeof params.message === "string" && params.message.trim() ? params.message.trim() : void 0
          });
          if (!result.success) {
            throw new Error(result.error || "initiate failed");
          }
          return json({ callId: result.callId, initiated: true });
        } catch (err) {
          return json({
            error: err instanceof Error ? err.message : String(err)
          });
        }
      }
    });
    api.registerCli(
      ({ program }) => registerVoiceCallCli({
        program,
        config,
        ensureRuntime,
        logger: api.logger
      }),
      { commands: ["voicecall"] }
    );
    api.registerService({
      id: "voicecall",
      start: async () => {
        if (!config.enabled) {
          return;
        }
        try {
          await ensureRuntime();
        } catch (err) {
          api.logger.error(
            `[voice-call] Failed to start runtime: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      },
      stop: async () => {
        if (!runtimePromise) {
          return;
        }
        try {
          const rt = await runtimePromise;
          await rt.stop();
        } finally {
          runtimePromise = null;
          runtime = null;
        }
      }
    });
  }
};
var voice_call_default = voiceCallPlugin;
export {
  voice_call_default as default
};
