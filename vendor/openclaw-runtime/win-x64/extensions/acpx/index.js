// vendor/openclaw-runtime/win-x64/extensions/acpx/src/config.ts
import path from "path";
import { fileURLToPath } from "url";
var ACPX_PERMISSION_MODES = ["approve-all", "approve-reads", "deny-all"];
var ACPX_NON_INTERACTIVE_POLICIES = ["deny", "fail"];
var ACPX_PINNED_VERSION = "0.1.15";
var ACPX_VERSION_ANY = "any";
var ACPX_BIN_NAME = process.platform === "win32" ? "acpx.cmd" : "acpx";
var ACPX_PLUGIN_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
var ACPX_BUNDLED_BIN = path.join(ACPX_PLUGIN_ROOT, "node_modules", ".bin", ACPX_BIN_NAME);
function buildAcpxLocalInstallCommand(version = ACPX_PINNED_VERSION) {
  return `npm install --omit=dev --no-save acpx@${version}`;
}
var ACPX_LOCAL_INSTALL_COMMAND = buildAcpxLocalInstallCommand();
var DEFAULT_PERMISSION_MODE = "approve-reads";
var DEFAULT_NON_INTERACTIVE_POLICY = "fail";
var DEFAULT_QUEUE_OWNER_TTL_SECONDS = 0.1;
var DEFAULT_STRICT_WINDOWS_CMD_WRAPPER = true;
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isPermissionMode(value) {
  return ACPX_PERMISSION_MODES.includes(value);
}
function isNonInteractivePermissionPolicy(value) {
  return ACPX_NON_INTERACTIVE_POLICIES.includes(value);
}
function parseAcpxPluginConfig(value) {
  if (value === void 0) {
    return { ok: true, value: void 0 };
  }
  if (!isRecord(value)) {
    return { ok: false, message: "expected config object" };
  }
  const allowedKeys = /* @__PURE__ */ new Set([
    "command",
    "expectedVersion",
    "cwd",
    "permissionMode",
    "nonInteractivePermissions",
    "strictWindowsCmdWrapper",
    "timeoutSeconds",
    "queueOwnerTtlSeconds"
  ]);
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      return { ok: false, message: `unknown config key: ${key}` };
    }
  }
  const command = value.command;
  if (command !== void 0 && (typeof command !== "string" || command.trim() === "")) {
    return { ok: false, message: "command must be a non-empty string" };
  }
  const expectedVersion = value.expectedVersion;
  if (expectedVersion !== void 0 && (typeof expectedVersion !== "string" || expectedVersion.trim() === "")) {
    return { ok: false, message: "expectedVersion must be a non-empty string" };
  }
  const cwd = value.cwd;
  if (cwd !== void 0 && (typeof cwd !== "string" || cwd.trim() === "")) {
    return { ok: false, message: "cwd must be a non-empty string" };
  }
  const permissionMode = value.permissionMode;
  if (permissionMode !== void 0 && (typeof permissionMode !== "string" || !isPermissionMode(permissionMode))) {
    return {
      ok: false,
      message: `permissionMode must be one of: ${ACPX_PERMISSION_MODES.join(", ")}`
    };
  }
  const nonInteractivePermissions = value.nonInteractivePermissions;
  if (nonInteractivePermissions !== void 0 && (typeof nonInteractivePermissions !== "string" || !isNonInteractivePermissionPolicy(nonInteractivePermissions))) {
    return {
      ok: false,
      message: `nonInteractivePermissions must be one of: ${ACPX_NON_INTERACTIVE_POLICIES.join(", ")}`
    };
  }
  const timeoutSeconds = value.timeoutSeconds;
  if (timeoutSeconds !== void 0 && (typeof timeoutSeconds !== "number" || !Number.isFinite(timeoutSeconds) || timeoutSeconds <= 0)) {
    return { ok: false, message: "timeoutSeconds must be a positive number" };
  }
  const strictWindowsCmdWrapper = value.strictWindowsCmdWrapper;
  if (strictWindowsCmdWrapper !== void 0 && typeof strictWindowsCmdWrapper !== "boolean") {
    return { ok: false, message: "strictWindowsCmdWrapper must be a boolean" };
  }
  const queueOwnerTtlSeconds = value.queueOwnerTtlSeconds;
  if (queueOwnerTtlSeconds !== void 0 && (typeof queueOwnerTtlSeconds !== "number" || !Number.isFinite(queueOwnerTtlSeconds) || queueOwnerTtlSeconds < 0)) {
    return { ok: false, message: "queueOwnerTtlSeconds must be a non-negative number" };
  }
  return {
    ok: true,
    value: {
      command: typeof command === "string" ? command.trim() : void 0,
      expectedVersion: typeof expectedVersion === "string" ? expectedVersion.trim() : void 0,
      cwd: typeof cwd === "string" ? cwd.trim() : void 0,
      permissionMode: typeof permissionMode === "string" ? permissionMode : void 0,
      nonInteractivePermissions: typeof nonInteractivePermissions === "string" ? nonInteractivePermissions : void 0,
      strictWindowsCmdWrapper: typeof strictWindowsCmdWrapper === "boolean" ? strictWindowsCmdWrapper : void 0,
      timeoutSeconds: typeof timeoutSeconds === "number" ? timeoutSeconds : void 0,
      queueOwnerTtlSeconds: typeof queueOwnerTtlSeconds === "number" ? queueOwnerTtlSeconds : void 0
    }
  };
}
function resolveConfiguredCommand(params) {
  const configured = params.configured?.trim();
  if (!configured) {
    return ACPX_BUNDLED_BIN;
  }
  if (path.isAbsolute(configured) || configured.includes(path.sep) || configured.includes("/")) {
    const baseDir = params.workspaceDir?.trim() || process.cwd();
    return path.resolve(baseDir, configured);
  }
  return configured;
}
function createAcpxPluginConfigSchema() {
  return {
    safeParse(value) {
      const parsed = parseAcpxPluginConfig(value);
      if (parsed.ok) {
        return { success: true, data: parsed.value };
      }
      return {
        success: false,
        error: {
          issues: [{ path: [], message: parsed.message }]
        }
      };
    },
    jsonSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        command: { type: "string" },
        expectedVersion: { type: "string" },
        cwd: { type: "string" },
        permissionMode: {
          type: "string",
          enum: [...ACPX_PERMISSION_MODES]
        },
        nonInteractivePermissions: {
          type: "string",
          enum: [...ACPX_NON_INTERACTIVE_POLICIES]
        },
        strictWindowsCmdWrapper: { type: "boolean" },
        timeoutSeconds: { type: "number", minimum: 1e-3 },
        queueOwnerTtlSeconds: { type: "number", minimum: 0 }
      }
    }
  };
}
function resolveAcpxPluginConfig(params) {
  const parsed = parseAcpxPluginConfig(params.rawConfig);
  if (!parsed.ok) {
    throw new Error(parsed.message);
  }
  const normalized = parsed.value ?? {};
  const fallbackCwd = params.workspaceDir?.trim() || process.cwd();
  const cwd = path.resolve(normalized.cwd?.trim() || fallbackCwd);
  const command = resolveConfiguredCommand({
    configured: normalized.command,
    workspaceDir: params.workspaceDir
  });
  const allowPluginLocalInstall = command === ACPX_BUNDLED_BIN;
  const configuredExpectedVersion = normalized.expectedVersion;
  const expectedVersion = configuredExpectedVersion === ACPX_VERSION_ANY ? void 0 : configuredExpectedVersion ?? (allowPluginLocalInstall ? ACPX_PINNED_VERSION : void 0);
  const installCommand = buildAcpxLocalInstallCommand(expectedVersion ?? ACPX_PINNED_VERSION);
  return {
    command,
    expectedVersion,
    allowPluginLocalInstall,
    installCommand,
    cwd,
    permissionMode: normalized.permissionMode ?? DEFAULT_PERMISSION_MODE,
    nonInteractivePermissions: normalized.nonInteractivePermissions ?? DEFAULT_NON_INTERACTIVE_POLICY,
    strictWindowsCmdWrapper: normalized.strictWindowsCmdWrapper ?? DEFAULT_STRICT_WINDOWS_CMD_WRAPPER,
    timeoutSeconds: normalized.timeoutSeconds,
    queueOwnerTtlSeconds: normalized.queueOwnerTtlSeconds ?? DEFAULT_QUEUE_OWNER_TTL_SECONDS
  };
}

// vendor/openclaw-runtime/win-x64/extensions/acpx/src/service.ts
import { registerAcpRuntimeBackend, unregisterAcpRuntimeBackend } from "openclaw/plugin-sdk";

// vendor/openclaw-runtime/win-x64/extensions/acpx/src/ensure.ts
import fs from "fs";
import path2 from "path";

// vendor/openclaw-runtime/win-x64/extensions/acpx/src/runtime-internals/process.ts
import { spawn } from "child_process";
import { existsSync } from "fs";
import {
  applyWindowsSpawnProgramPolicy,
  materializeWindowsSpawnProgram,
  resolveWindowsSpawnProgramCandidate
} from "openclaw/plugin-sdk";
var DEFAULT_RUNTIME = {
  platform: process.platform,
  env: process.env,
  execPath: process.execPath
};
function resolveSpawnCommand(params, options, runtime = DEFAULT_RUNTIME) {
  const strictWindowsCmdWrapper = options?.strictWindowsCmdWrapper === true;
  const cacheKey = params.command;
  const cachedProgram = options?.cache;
  const cacheHit = cachedProgram?.key === cacheKey && cachedProgram.candidate != null;
  let candidate = cachedProgram?.key === cacheKey && cachedProgram.candidate ? cachedProgram.candidate : void 0;
  if (!candidate) {
    candidate = resolveWindowsSpawnProgramCandidate({
      command: params.command,
      platform: runtime.platform,
      env: runtime.env,
      execPath: runtime.execPath,
      packageName: "acpx"
    });
    if (cachedProgram) {
      cachedProgram.key = cacheKey;
      cachedProgram.candidate = candidate;
    }
  }
  let program;
  try {
    program = applyWindowsSpawnProgramPolicy({
      candidate,
      allowShellFallback: !strictWindowsCmdWrapper
    });
  } catch (error) {
    options?.onResolved?.({
      command: params.command,
      cacheHit,
      strictWindowsCmdWrapper,
      resolution: candidate.resolution
    });
    throw error;
  }
  const resolved = materializeWindowsSpawnProgram(program, params.args);
  options?.onResolved?.({
    command: params.command,
    cacheHit,
    strictWindowsCmdWrapper,
    resolution: resolved.resolution
  });
  return {
    command: resolved.command,
    args: resolved.argv,
    shell: resolved.shell,
    windowsHide: resolved.windowsHide
  };
}
function spawnWithResolvedCommand(params, options) {
  const resolved = resolveSpawnCommand(
    {
      command: params.command,
      args: params.args
    },
    options
  );
  return spawn(resolved.command, resolved.args, {
    cwd: params.cwd,
    env: { ...process.env, OPENCLAW_SHELL: "acp" },
    stdio: ["pipe", "pipe", "pipe"],
    shell: resolved.shell,
    windowsHide: resolved.windowsHide
  });
}
async function waitForExit(child) {
  return await new Promise((resolve) => {
    let settled = false;
    const finish = (result) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(result);
    };
    child.once("error", (err) => {
      finish({ code: null, signal: null, error: err });
    });
    child.once("close", (code, signal) => {
      finish({ code, signal, error: null });
    });
  });
}
async function spawnAndCollect(params, options) {
  const child = spawnWithResolvedCommand(params, options);
  child.stdin.end();
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => {
    stdout += String(chunk);
  });
  child.stderr.on("data", (chunk) => {
    stderr += String(chunk);
  });
  const exit = await waitForExit(child);
  return {
    stdout,
    stderr,
    code: exit.code,
    error: exit.error
  };
}
function resolveSpawnFailure(err, cwd) {
  if (!err || typeof err !== "object") {
    return null;
  }
  const code = err.code;
  if (code !== "ENOENT") {
    return null;
  }
  return directoryExists(cwd) ? "missing-command" : "missing-cwd";
}
function directoryExists(cwd) {
  if (!cwd) {
    return false;
  }
  try {
    return existsSync(cwd);
  } catch {
    return false;
  }
}

// vendor/openclaw-runtime/win-x64/extensions/acpx/src/ensure.ts
var SEMVER_PATTERN = /\b\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?\b/;
function extractVersion(stdout, stderr) {
  const combined = `${stdout}
${stderr}`;
  const match = combined.match(SEMVER_PATTERN);
  return match?.[0] ?? null;
}
function isExpectedVersionConfigured(value) {
  return typeof value === "string" && value.trim().length > 0;
}
function supportsPathResolution(command) {
  return path2.isAbsolute(command) || command.includes("/") || command.includes("\\");
}
function isUnsupportedVersionProbe(stdout, stderr) {
  const combined = `${stdout}
${stderr}`.toLowerCase();
  return combined.includes("unknown option") && combined.includes("--version");
}
function resolveVersionFromPackage(command, cwd) {
  if (!supportsPathResolution(command)) {
    return null;
  }
  const commandPath = path2.isAbsolute(command) ? command : path2.resolve(cwd, command);
  let current;
  try {
    current = path2.dirname(fs.realpathSync(commandPath));
  } catch {
    return null;
  }
  while (true) {
    const packageJsonPath = path2.join(current, "package.json");
    try {
      const parsed = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
      if (parsed.name === "acpx" && typeof parsed.version === "string" && parsed.version.trim()) {
        return parsed.version.trim();
      }
    } catch {
    }
    const parent = path2.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}
function resolveVersionCheckResult(params) {
  if (params.expectedVersion && params.installedVersion !== params.expectedVersion) {
    return {
      ok: false,
      reason: "version-mismatch",
      message: `acpx version mismatch: found ${params.installedVersion}, expected ${params.expectedVersion}`,
      expectedVersion: params.expectedVersion,
      installCommand: params.installCommand,
      installedVersion: params.installedVersion
    };
  }
  return {
    ok: true,
    version: params.installedVersion,
    expectedVersion: params.expectedVersion
  };
}
async function checkAcpxVersion(params) {
  const expectedVersion = params.expectedVersion?.trim() || void 0;
  const installCommand = buildAcpxLocalInstallCommand(expectedVersion ?? ACPX_PINNED_VERSION);
  const cwd = params.cwd ?? ACPX_PLUGIN_ROOT;
  const hasExpectedVersion = isExpectedVersionConfigured(expectedVersion);
  const probeArgs = hasExpectedVersion ? ["--version"] : ["--help"];
  const spawnParams = {
    command: params.command,
    args: probeArgs,
    cwd
  };
  let result;
  try {
    result = params.spawnOptions ? await spawnAndCollect(spawnParams, params.spawnOptions) : await spawnAndCollect(spawnParams);
  } catch (error) {
    return {
      ok: false,
      reason: "execution-failed",
      message: error instanceof Error ? error.message : String(error),
      expectedVersion,
      installCommand
    };
  }
  if (result.error) {
    const spawnFailure = resolveSpawnFailure(result.error, cwd);
    if (spawnFailure === "missing-command") {
      return {
        ok: false,
        reason: "missing-command",
        message: `acpx command not found at ${params.command}`,
        expectedVersion,
        installCommand
      };
    }
    return {
      ok: false,
      reason: "execution-failed",
      message: result.error.message,
      expectedVersion,
      installCommand
    };
  }
  if ((result.code ?? 0) !== 0) {
    if (hasExpectedVersion && isUnsupportedVersionProbe(result.stdout, result.stderr)) {
      const installedVersion2 = resolveVersionFromPackage(params.command, cwd);
      if (installedVersion2) {
        return resolveVersionCheckResult({ expectedVersion, installedVersion: installedVersion2, installCommand });
      }
    }
    const stderr = result.stderr.trim();
    return {
      ok: false,
      reason: "execution-failed",
      message: stderr || `acpx ${hasExpectedVersion ? "--version" : "--help"} failed with code ${result.code ?? "unknown"}`,
      expectedVersion,
      installCommand
    };
  }
  if (!hasExpectedVersion) {
    return {
      ok: true,
      version: "unknown",
      expectedVersion
    };
  }
  const installedVersion = extractVersion(result.stdout, result.stderr);
  if (!installedVersion) {
    return {
      ok: false,
      reason: "missing-version",
      message: "acpx --version output did not include a parseable version",
      expectedVersion,
      installCommand
    };
  }
  return resolveVersionCheckResult({ expectedVersion, installedVersion, installCommand });
}
var pendingEnsure = null;
async function ensureAcpx(params) {
  if (pendingEnsure) {
    return await pendingEnsure;
  }
  pendingEnsure = (async () => {
    const pluginRoot = params.pluginRoot ?? ACPX_PLUGIN_ROOT;
    const expectedVersion = params.expectedVersion?.trim() || void 0;
    const installVersion = expectedVersion ?? ACPX_PINNED_VERSION;
    const allowInstall = params.allowInstall ?? true;
    const precheck = await checkAcpxVersion({
      command: params.command,
      cwd: pluginRoot,
      expectedVersion,
      spawnOptions: params.spawnOptions
    });
    if (precheck.ok) {
      return;
    }
    if (!allowInstall) {
      throw new Error(precheck.message);
    }
    params.logger?.warn(
      `acpx local binary unavailable or mismatched (${precheck.message}); running plugin-local install`
    );
    const install = await spawnAndCollect({
      command: "npm",
      args: ["install", "--omit=dev", "--no-save", `acpx@${installVersion}`],
      cwd: pluginRoot
    });
    if (install.error) {
      const spawnFailure = resolveSpawnFailure(install.error, pluginRoot);
      if (spawnFailure === "missing-command") {
        throw new Error("npm is required to install plugin-local acpx but was not found on PATH");
      }
      throw new Error(`failed to install plugin-local acpx: ${install.error.message}`);
    }
    if ((install.code ?? 0) !== 0) {
      const stderr = install.stderr.trim();
      const stdout = install.stdout.trim();
      const detail = stderr || stdout || `npm exited with code ${install.code ?? "unknown"}`;
      throw new Error(`failed to install plugin-local acpx: ${detail}`);
    }
    const postcheck = await checkAcpxVersion({
      command: params.command,
      cwd: pluginRoot,
      expectedVersion,
      spawnOptions: params.spawnOptions
    });
    if (!postcheck.ok) {
      throw new Error(`plugin-local acpx verification failed after install: ${postcheck.message}`);
    }
    params.logger?.info(`acpx plugin-local binary ready (version ${postcheck.version})`);
  })();
  try {
    await pendingEnsure;
  } finally {
    pendingEnsure = null;
  }
}

// vendor/openclaw-runtime/win-x64/extensions/acpx/src/runtime.ts
import { createInterface } from "readline";
import { AcpRuntimeError } from "openclaw/plugin-sdk";

// vendor/openclaw-runtime/win-x64/extensions/acpx/src/runtime-internals/shared.ts
function isRecord2(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function asTrimmedString(value) {
  return typeof value === "string" ? value.trim() : "";
}
function asString(value) {
  return typeof value === "string" ? value : void 0;
}
function asOptionalString(value) {
  const text = asTrimmedString(value);
  return text || void 0;
}
function asOptionalBoolean(value) {
  return typeof value === "boolean" ? value : void 0;
}
function deriveAgentFromSessionKey(sessionKey, fallbackAgent) {
  const match = sessionKey.match(/^agent:([^:]+):/i);
  const candidate = match?.[1] ? asTrimmedString(match[1]) : "";
  return candidate || fallbackAgent;
}
function buildPermissionArgs(mode) {
  if (mode === "approve-all") {
    return ["--approve-all"];
  }
  if (mode === "deny-all") {
    return ["--deny-all"];
  }
  return ["--approve-reads"];
}

// vendor/openclaw-runtime/win-x64/extensions/acpx/src/runtime-internals/events.ts
function toAcpxErrorEvent(value) {
  if (!isRecord2(value)) {
    return null;
  }
  if (asTrimmedString(value.type) !== "error") {
    return null;
  }
  return {
    message: asTrimmedString(value.message) || "acpx reported an error",
    code: asOptionalString(value.code),
    retryable: asOptionalBoolean(value.retryable)
  };
}
function parseJsonLines(value) {
  const events = [];
  for (const line of value.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    try {
      const parsed = JSON.parse(trimmed);
      if (isRecord2(parsed)) {
        events.push(parsed);
      }
    } catch {
    }
  }
  return events;
}
function asOptionalFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : void 0;
}
function resolveStructuredPromptPayload(parsed) {
  const method = asTrimmedString(parsed.method);
  if (method === "session/update") {
    const params = parsed.params;
    if (isRecord2(params) && isRecord2(params.update)) {
      const update = params.update;
      const tag2 = asOptionalString(update.sessionUpdate);
      return {
        type: tag2 ?? "",
        payload: update,
        ...tag2 ? { tag: tag2 } : {}
      };
    }
  }
  const sessionUpdate = asOptionalString(parsed.sessionUpdate);
  if (sessionUpdate) {
    return {
      type: sessionUpdate,
      payload: parsed,
      tag: sessionUpdate
    };
  }
  const type = asTrimmedString(parsed.type);
  const tag = asOptionalString(parsed.tag);
  return {
    type,
    payload: parsed,
    ...tag ? { tag } : {}
  };
}
function resolveStatusTextForTag(params) {
  const { tag, payload } = params;
  if (tag === "available_commands_update") {
    const commands = Array.isArray(payload.availableCommands) ? payload.availableCommands : [];
    return commands.length > 0 ? `available commands updated (${commands.length})` : "available commands updated";
  }
  if (tag === "current_mode_update") {
    const mode = asTrimmedString(payload.currentModeId) || asTrimmedString(payload.modeId) || asTrimmedString(payload.mode);
    return mode ? `mode updated: ${mode}` : "mode updated";
  }
  if (tag === "config_option_update") {
    const id = asTrimmedString(payload.id) || asTrimmedString(payload.configOptionId);
    const value = asTrimmedString(payload.currentValue) || asTrimmedString(payload.value) || asTrimmedString(payload.optionValue);
    if (id && value) {
      return `config updated: ${id}=${value}`;
    }
    if (id) {
      return `config updated: ${id}`;
    }
    return "config updated";
  }
  if (tag === "session_info_update") {
    return asTrimmedString(payload.summary) || asTrimmedString(payload.message) || "session updated";
  }
  if (tag === "plan") {
    const entries = Array.isArray(payload.entries) ? payload.entries : [];
    const first = entries.find((entry) => isRecord2(entry));
    const content = asTrimmedString(first?.content);
    return content ? `plan: ${content}` : null;
  }
  return null;
}
function resolveTextChunk(params) {
  const contentRaw = params.payload.content;
  if (isRecord2(contentRaw)) {
    const contentType = asTrimmedString(contentRaw.type);
    if (contentType && contentType !== "text") {
      return null;
    }
    const text2 = asString(contentRaw.text);
    if (text2 && text2.length > 0) {
      return {
        type: "text_delta",
        text: text2,
        stream: params.stream,
        tag: params.tag
      };
    }
  }
  const text = asString(params.payload.text);
  if (!text || text.length === 0) {
    return null;
  }
  return {
    type: "text_delta",
    text,
    stream: params.stream,
    tag: params.tag
  };
}
function parsePromptEventLine(line) {
  const trimmed = line.trim();
  if (!trimmed) {
    return null;
  }
  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return {
      type: "status",
      text: trimmed
    };
  }
  if (!isRecord2(parsed)) {
    return null;
  }
  const structured = resolveStructuredPromptPayload(parsed);
  const type = structured.type;
  const payload = structured.payload;
  const tag = structured.tag;
  switch (type) {
    case "text": {
      const content = asString(payload.content);
      if (content == null || content.length === 0) {
        return null;
      }
      return {
        type: "text_delta",
        text: content,
        stream: "output",
        ...tag ? { tag } : {}
      };
    }
    case "thought": {
      const content = asString(payload.content);
      if (content == null || content.length === 0) {
        return null;
      }
      return {
        type: "text_delta",
        text: content,
        stream: "thought",
        ...tag ? { tag } : {}
      };
    }
    case "tool_call": {
      const title = asTrimmedString(payload.title) || "tool call";
      const status = asTrimmedString(payload.status);
      const toolCallId = asOptionalString(payload.toolCallId);
      return {
        type: "tool_call",
        text: status ? `${title} (${status})` : title,
        tag: tag ?? "tool_call",
        ...toolCallId ? { toolCallId } : {},
        ...status ? { status } : {},
        title
      };
    }
    case "tool_call_update": {
      const title = asTrimmedString(payload.title) || "tool call";
      const status = asTrimmedString(payload.status);
      const toolCallId = asOptionalString(payload.toolCallId);
      const text = status ? `${title} (${status})` : title;
      return {
        type: "tool_call",
        text,
        tag: tag ?? "tool_call_update",
        ...toolCallId ? { toolCallId } : {},
        ...status ? { status } : {},
        title
      };
    }
    case "agent_message_chunk":
      return resolveTextChunk({
        payload,
        stream: "output",
        tag: "agent_message_chunk"
      });
    case "agent_thought_chunk":
      return resolveTextChunk({
        payload,
        stream: "thought",
        tag: "agent_thought_chunk"
      });
    case "usage_update": {
      const used = asOptionalFiniteNumber(payload.used);
      const size = asOptionalFiniteNumber(payload.size);
      const text = used != null && size != null ? `usage updated: ${used}/${size}` : "usage updated";
      return {
        type: "status",
        text,
        tag: "usage_update",
        ...used != null ? { used } : {},
        ...size != null ? { size } : {}
      };
    }
    case "available_commands_update":
    case "current_mode_update":
    case "config_option_update":
    case "session_info_update":
    case "plan": {
      const text = resolveStatusTextForTag({
        tag: type,
        payload
      });
      if (!text) {
        return null;
      }
      return {
        type: "status",
        text,
        tag: type
      };
    }
    case "client_operation": {
      const method = asTrimmedString(payload.method) || "operation";
      const status = asTrimmedString(payload.status);
      const summary = asTrimmedString(payload.summary);
      const text = [method, status, summary].filter(Boolean).join(" ");
      if (!text) {
        return null;
      }
      return { type: "status", text, ...tag ? { tag } : {} };
    }
    case "update": {
      const update = asTrimmedString(payload.update);
      if (!update) {
        return null;
      }
      return { type: "status", text: update, ...tag ? { tag } : {} };
    }
    case "done": {
      return {
        type: "done",
        stopReason: asOptionalString(payload.stopReason)
      };
    }
    case "error": {
      const message = asTrimmedString(payload.message) || "acpx runtime error";
      return {
        type: "error",
        message,
        code: asOptionalString(payload.code),
        retryable: asOptionalBoolean(payload.retryable)
      };
    }
    default:
      return null;
  }
}

// vendor/openclaw-runtime/win-x64/extensions/acpx/src/runtime.ts
var ACPX_BACKEND_ID = "acpx";
var ACPX_RUNTIME_HANDLE_PREFIX = "acpx:v1:";
var DEFAULT_AGENT_FALLBACK = "codex";
var ACPX_CAPABILITIES = {
  controls: ["session/set_mode", "session/set_config_option", "session/status"]
};
function encodeAcpxRuntimeHandleState(state) {
  const payload = Buffer.from(JSON.stringify(state), "utf8").toString("base64url");
  return `${ACPX_RUNTIME_HANDLE_PREFIX}${payload}`;
}
function decodeAcpxRuntimeHandleState(runtimeSessionName) {
  const trimmed = runtimeSessionName.trim();
  if (!trimmed.startsWith(ACPX_RUNTIME_HANDLE_PREFIX)) {
    return null;
  }
  const encoded = trimmed.slice(ACPX_RUNTIME_HANDLE_PREFIX.length);
  if (!encoded) {
    return null;
  }
  try {
    const raw = Buffer.from(encoded, "base64url").toString("utf8");
    const parsed = JSON.parse(raw);
    if (!isRecord2(parsed)) {
      return null;
    }
    const name = asTrimmedString(parsed.name);
    const agent = asTrimmedString(parsed.agent);
    const cwd = asTrimmedString(parsed.cwd);
    const mode = asTrimmedString(parsed.mode);
    const acpxRecordId = asOptionalString(parsed.acpxRecordId);
    const backendSessionId = asOptionalString(parsed.backendSessionId);
    const agentSessionId = asOptionalString(parsed.agentSessionId);
    if (!name || !agent || !cwd) {
      return null;
    }
    if (mode !== "persistent" && mode !== "oneshot") {
      return null;
    }
    return {
      name,
      agent,
      cwd,
      mode,
      ...acpxRecordId ? { acpxRecordId } : {},
      ...backendSessionId ? { backendSessionId } : {},
      ...agentSessionId ? { agentSessionId } : {}
    };
  } catch {
    return null;
  }
}
var AcpxRuntime = class {
  constructor(config, opts) {
    this.config = config;
    this.logger = opts?.logger;
    const requestedQueueOwnerTtlSeconds = opts?.queueOwnerTtlSeconds;
    this.queueOwnerTtlSeconds = typeof requestedQueueOwnerTtlSeconds === "number" && Number.isFinite(requestedQueueOwnerTtlSeconds) && requestedQueueOwnerTtlSeconds >= 0 ? requestedQueueOwnerTtlSeconds : this.config.queueOwnerTtlSeconds;
    this.spawnCommandOptions = {
      strictWindowsCmdWrapper: this.config.strictWindowsCmdWrapper,
      cache: this.spawnCommandCache,
      onResolved: (event) => {
        this.logSpawnResolution(event);
      }
    };
  }
  healthy = false;
  logger;
  queueOwnerTtlSeconds;
  spawnCommandCache = {};
  spawnCommandOptions;
  loggedSpawnResolutions = /* @__PURE__ */ new Set();
  isHealthy() {
    return this.healthy;
  }
  logSpawnResolution(event) {
    const key = `${event.command}::${event.strictWindowsCmdWrapper ? "strict" : "compat"}::${event.resolution}`;
    if (event.cacheHit || this.loggedSpawnResolutions.has(key)) {
      return;
    }
    this.loggedSpawnResolutions.add(key);
    this.logger?.debug?.(
      `acpx spawn resolver: command=${event.command} mode=${event.strictWindowsCmdWrapper ? "strict" : "compat"} resolution=${event.resolution}`
    );
  }
  async probeAvailability() {
    const versionCheck = await checkAcpxVersion({
      command: this.config.command,
      cwd: this.config.cwd,
      expectedVersion: this.config.expectedVersion,
      spawnOptions: this.spawnCommandOptions
    });
    if (!versionCheck.ok) {
      this.healthy = false;
      return;
    }
    try {
      const result = await spawnAndCollect(
        {
          command: this.config.command,
          args: ["--help"],
          cwd: this.config.cwd
        },
        this.spawnCommandOptions
      );
      this.healthy = result.error == null && (result.code ?? 0) === 0;
    } catch {
      this.healthy = false;
    }
  }
  async ensureSession(input) {
    const sessionName = asTrimmedString(input.sessionKey);
    if (!sessionName) {
      throw new AcpRuntimeError("ACP_SESSION_INIT_FAILED", "ACP session key is required.");
    }
    const agent = asTrimmedString(input.agent);
    if (!agent) {
      throw new AcpRuntimeError("ACP_SESSION_INIT_FAILED", "ACP agent id is required.");
    }
    const cwd = asTrimmedString(input.cwd) || this.config.cwd;
    const mode = input.mode;
    const events = await this.runControlCommand({
      args: this.buildControlArgs({
        cwd,
        command: [agent, "sessions", "ensure", "--name", sessionName]
      }),
      cwd,
      fallbackCode: "ACP_SESSION_INIT_FAILED"
    });
    const ensuredEvent = events.find(
      (event) => asOptionalString(event.agentSessionId) || asOptionalString(event.acpxSessionId) || asOptionalString(event.acpxRecordId)
    );
    const acpxRecordId = ensuredEvent ? asOptionalString(ensuredEvent.acpxRecordId) : void 0;
    const agentSessionId = ensuredEvent ? asOptionalString(ensuredEvent.agentSessionId) : void 0;
    const backendSessionId = ensuredEvent ? asOptionalString(ensuredEvent.acpxSessionId) : void 0;
    return {
      sessionKey: input.sessionKey,
      backend: ACPX_BACKEND_ID,
      runtimeSessionName: encodeAcpxRuntimeHandleState({
        name: sessionName,
        agent,
        cwd,
        mode,
        ...acpxRecordId ? { acpxRecordId } : {},
        ...backendSessionId ? { backendSessionId } : {},
        ...agentSessionId ? { agentSessionId } : {}
      }),
      cwd,
      ...acpxRecordId ? { acpxRecordId } : {},
      ...backendSessionId ? { backendSessionId } : {},
      ...agentSessionId ? { agentSessionId } : {}
    };
  }
  async *runTurn(input) {
    const state = this.resolveHandleState(input.handle);
    const args = this.buildPromptArgs({
      agent: state.agent,
      sessionName: state.name,
      cwd: state.cwd
    });
    const cancelOnAbort = async () => {
      await this.cancel({
        handle: input.handle,
        reason: "abort-signal"
      }).catch((err) => {
        this.logger?.warn?.(`acpx runtime abort-cancel failed: ${String(err)}`);
      });
    };
    const onAbort = () => {
      void cancelOnAbort();
    };
    if (input.signal?.aborted) {
      await cancelOnAbort();
      return;
    }
    if (input.signal) {
      input.signal.addEventListener("abort", onAbort, { once: true });
    }
    const child = spawnWithResolvedCommand(
      {
        command: this.config.command,
        args,
        cwd: state.cwd
      },
      this.spawnCommandOptions
    );
    child.stdin.on("error", () => {
    });
    child.stdin.end(input.text);
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    let sawDone = false;
    let sawError = false;
    const lines = createInterface({ input: child.stdout });
    try {
      for await (const line of lines) {
        const parsed = parsePromptEventLine(line);
        if (!parsed) {
          continue;
        }
        if (parsed.type === "done") {
          if (sawDone) {
            continue;
          }
          sawDone = true;
        }
        if (parsed.type === "error") {
          sawError = true;
        }
        yield parsed;
      }
      const exit = await waitForExit(child);
      if (exit.error) {
        const spawnFailure = resolveSpawnFailure(exit.error, state.cwd);
        if (spawnFailure === "missing-command") {
          this.healthy = false;
          throw new AcpRuntimeError(
            "ACP_BACKEND_UNAVAILABLE",
            `acpx command not found: ${this.config.command}`,
            { cause: exit.error }
          );
        }
        if (spawnFailure === "missing-cwd") {
          throw new AcpRuntimeError(
            "ACP_TURN_FAILED",
            `ACP runtime working directory does not exist: ${state.cwd}`,
            { cause: exit.error }
          );
        }
        throw new AcpRuntimeError("ACP_TURN_FAILED", exit.error.message, { cause: exit.error });
      }
      if ((exit.code ?? 0) !== 0 && !sawError) {
        yield {
          type: "error",
          message: stderr.trim() || `acpx exited with code ${exit.code ?? "unknown"}`
        };
        return;
      }
      if (!sawDone && !sawError) {
        yield { type: "done" };
      }
    } finally {
      lines.close();
      if (input.signal) {
        input.signal.removeEventListener("abort", onAbort);
      }
    }
  }
  getCapabilities() {
    return ACPX_CAPABILITIES;
  }
  async getStatus(input) {
    const state = this.resolveHandleState(input.handle);
    const events = await this.runControlCommand({
      args: this.buildControlArgs({
        cwd: state.cwd,
        command: [state.agent, "status", "--session", state.name]
      }),
      cwd: state.cwd,
      fallbackCode: "ACP_TURN_FAILED",
      ignoreNoSession: true
    });
    const detail = events.find((event) => !toAcpxErrorEvent(event)) ?? events[0];
    if (!detail) {
      return {
        summary: "acpx status unavailable"
      };
    }
    const status = asTrimmedString(detail.status) || "unknown";
    const acpxRecordId = asOptionalString(detail.acpxRecordId);
    const acpxSessionId = asOptionalString(detail.acpxSessionId);
    const agentSessionId = asOptionalString(detail.agentSessionId);
    const pid = typeof detail.pid === "number" && Number.isFinite(detail.pid) ? detail.pid : null;
    const summary = [
      `status=${status}`,
      acpxRecordId ? `acpxRecordId=${acpxRecordId}` : null,
      acpxSessionId ? `acpxSessionId=${acpxSessionId}` : null,
      pid != null ? `pid=${pid}` : null
    ].filter(Boolean).join(" ");
    return {
      summary,
      ...acpxRecordId ? { acpxRecordId } : {},
      ...acpxSessionId ? { backendSessionId: acpxSessionId } : {},
      ...agentSessionId ? { agentSessionId } : {},
      details: detail
    };
  }
  async setMode(input) {
    const state = this.resolveHandleState(input.handle);
    const mode = asTrimmedString(input.mode);
    if (!mode) {
      throw new AcpRuntimeError("ACP_TURN_FAILED", "ACP runtime mode is required.");
    }
    await this.runControlCommand({
      args: this.buildControlArgs({
        cwd: state.cwd,
        command: [state.agent, "set-mode", mode, "--session", state.name]
      }),
      cwd: state.cwd,
      fallbackCode: "ACP_TURN_FAILED"
    });
  }
  async setConfigOption(input) {
    const state = this.resolveHandleState(input.handle);
    const key = asTrimmedString(input.key);
    const value = asTrimmedString(input.value);
    if (!key || !value) {
      throw new AcpRuntimeError("ACP_TURN_FAILED", "ACP config option key/value are required.");
    }
    await this.runControlCommand({
      args: this.buildControlArgs({
        cwd: state.cwd,
        command: [state.agent, "set", key, value, "--session", state.name]
      }),
      cwd: state.cwd,
      fallbackCode: "ACP_TURN_FAILED"
    });
  }
  async doctor() {
    const versionCheck = await checkAcpxVersion({
      command: this.config.command,
      cwd: this.config.cwd,
      expectedVersion: this.config.expectedVersion,
      spawnOptions: this.spawnCommandOptions
    });
    if (!versionCheck.ok) {
      this.healthy = false;
      const details = [
        versionCheck.expectedVersion ? `expected=${versionCheck.expectedVersion}` : null,
        versionCheck.installedVersion ? `installed=${versionCheck.installedVersion}` : null
      ].filter((detail) => Boolean(detail));
      return {
        ok: false,
        code: "ACP_BACKEND_UNAVAILABLE",
        message: versionCheck.message,
        installCommand: versionCheck.installCommand,
        details
      };
    }
    try {
      const result = await spawnAndCollect(
        {
          command: this.config.command,
          args: ["--help"],
          cwd: this.config.cwd
        },
        this.spawnCommandOptions
      );
      if (result.error) {
        const spawnFailure = resolveSpawnFailure(result.error, this.config.cwd);
        if (spawnFailure === "missing-command") {
          this.healthy = false;
          return {
            ok: false,
            code: "ACP_BACKEND_UNAVAILABLE",
            message: `acpx command not found: ${this.config.command}`,
            installCommand: this.config.installCommand
          };
        }
        if (spawnFailure === "missing-cwd") {
          this.healthy = false;
          return {
            ok: false,
            code: "ACP_BACKEND_UNAVAILABLE",
            message: `ACP runtime working directory does not exist: ${this.config.cwd}`
          };
        }
        this.healthy = false;
        return {
          ok: false,
          code: "ACP_BACKEND_UNAVAILABLE",
          message: result.error.message,
          details: [String(result.error)]
        };
      }
      if ((result.code ?? 0) !== 0) {
        this.healthy = false;
        return {
          ok: false,
          code: "ACP_BACKEND_UNAVAILABLE",
          message: result.stderr.trim() || `acpx exited with code ${result.code ?? "unknown"}`
        };
      }
      this.healthy = true;
      return {
        ok: true,
        message: `acpx command available (${this.config.command}, version ${versionCheck.version}${this.config.expectedVersion ? `, expected ${this.config.expectedVersion}` : ""})`
      };
    } catch (error) {
      this.healthy = false;
      return {
        ok: false,
        code: "ACP_BACKEND_UNAVAILABLE",
        message: error instanceof Error ? error.message : String(error)
      };
    }
  }
  async cancel(input) {
    const state = this.resolveHandleState(input.handle);
    await this.runControlCommand({
      args: this.buildControlArgs({
        cwd: state.cwd,
        command: [state.agent, "cancel", "--session", state.name]
      }),
      cwd: state.cwd,
      fallbackCode: "ACP_TURN_FAILED",
      ignoreNoSession: true
    });
  }
  async close(input) {
    const state = this.resolveHandleState(input.handle);
    await this.runControlCommand({
      args: this.buildControlArgs({
        cwd: state.cwd,
        command: [state.agent, "sessions", "close", state.name]
      }),
      cwd: state.cwd,
      fallbackCode: "ACP_TURN_FAILED",
      ignoreNoSession: true
    });
  }
  resolveHandleState(handle) {
    const decoded = decodeAcpxRuntimeHandleState(handle.runtimeSessionName);
    if (decoded) {
      return decoded;
    }
    const legacyName = asTrimmedString(handle.runtimeSessionName);
    if (!legacyName) {
      throw new AcpRuntimeError(
        "ACP_SESSION_INIT_FAILED",
        "Invalid acpx runtime handle: runtimeSessionName is missing."
      );
    }
    return {
      name: legacyName,
      agent: deriveAgentFromSessionKey(handle.sessionKey, DEFAULT_AGENT_FALLBACK),
      cwd: this.config.cwd,
      mode: "persistent"
    };
  }
  buildControlArgs(params) {
    return ["--format", "json", "--json-strict", "--cwd", params.cwd, ...params.command];
  }
  buildPromptArgs(params) {
    const args = [
      "--format",
      "json",
      "--json-strict",
      "--cwd",
      params.cwd,
      ...buildPermissionArgs(this.config.permissionMode),
      "--non-interactive-permissions",
      this.config.nonInteractivePermissions
    ];
    if (this.config.timeoutSeconds) {
      args.push("--timeout", String(this.config.timeoutSeconds));
    }
    args.push("--ttl", String(this.queueOwnerTtlSeconds));
    args.push(params.agent, "prompt", "--session", params.sessionName, "--file", "-");
    return args;
  }
  async runControlCommand(params) {
    const result = await spawnAndCollect(
      {
        command: this.config.command,
        args: params.args,
        cwd: params.cwd
      },
      this.spawnCommandOptions
    );
    if (result.error) {
      const spawnFailure = resolveSpawnFailure(result.error, params.cwd);
      if (spawnFailure === "missing-command") {
        this.healthy = false;
        throw new AcpRuntimeError(
          "ACP_BACKEND_UNAVAILABLE",
          `acpx command not found: ${this.config.command}`,
          { cause: result.error }
        );
      }
      if (spawnFailure === "missing-cwd") {
        throw new AcpRuntimeError(
          params.fallbackCode,
          `ACP runtime working directory does not exist: ${params.cwd}`,
          { cause: result.error }
        );
      }
      throw new AcpRuntimeError(params.fallbackCode, result.error.message, { cause: result.error });
    }
    const events = parseJsonLines(result.stdout);
    const errorEvent = events.map((event) => toAcpxErrorEvent(event)).find(Boolean) ?? null;
    if (errorEvent) {
      if (params.ignoreNoSession && errorEvent.code === "NO_SESSION") {
        return events;
      }
      throw new AcpRuntimeError(
        params.fallbackCode,
        errorEvent.code ? `${errorEvent.code}: ${errorEvent.message}` : errorEvent.message
      );
    }
    if ((result.code ?? 0) !== 0) {
      throw new AcpRuntimeError(
        params.fallbackCode,
        result.stderr.trim() || `acpx exited with code ${result.code ?? "unknown"}`
      );
    }
    return events;
  }
};

// vendor/openclaw-runtime/win-x64/extensions/acpx/src/service.ts
function createDefaultRuntime(params) {
  return new AcpxRuntime(params.pluginConfig, {
    logger: params.logger,
    queueOwnerTtlSeconds: params.queueOwnerTtlSeconds
  });
}
function createAcpxRuntimeService(params = {}) {
  let runtime = null;
  let lifecycleRevision = 0;
  return {
    id: "acpx-runtime",
    async start(ctx) {
      const pluginConfig = resolveAcpxPluginConfig({
        rawConfig: params.pluginConfig,
        workspaceDir: ctx.workspaceDir
      });
      const runtimeFactory = params.runtimeFactory ?? createDefaultRuntime;
      runtime = runtimeFactory({
        pluginConfig,
        queueOwnerTtlSeconds: pluginConfig.queueOwnerTtlSeconds,
        logger: ctx.logger
      });
      registerAcpRuntimeBackend({
        id: ACPX_BACKEND_ID,
        runtime,
        healthy: () => runtime?.isHealthy() ?? false
      });
      const expectedVersionLabel = pluginConfig.expectedVersion ?? "any";
      const installLabel = pluginConfig.allowPluginLocalInstall ? "enabled" : "disabled";
      ctx.logger.info(
        `acpx runtime backend registered (command: ${pluginConfig.command}, expectedVersion: ${expectedVersionLabel}, pluginLocalInstall: ${installLabel})`
      );
      lifecycleRevision += 1;
      const currentRevision = lifecycleRevision;
      void (async () => {
        try {
          await ensureAcpx({
            command: pluginConfig.command,
            logger: ctx.logger,
            expectedVersion: pluginConfig.expectedVersion,
            allowInstall: pluginConfig.allowPluginLocalInstall,
            spawnOptions: {
              strictWindowsCmdWrapper: pluginConfig.strictWindowsCmdWrapper
            }
          });
          if (currentRevision !== lifecycleRevision) {
            return;
          }
          await runtime?.probeAvailability();
          if (runtime?.isHealthy()) {
            ctx.logger.info("acpx runtime backend ready");
          } else {
            ctx.logger.warn("acpx runtime backend probe failed after local install");
          }
        } catch (err) {
          if (currentRevision !== lifecycleRevision) {
            return;
          }
          ctx.logger.warn(
            `acpx runtime setup failed: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      })();
    },
    async stop(_ctx) {
      lifecycleRevision += 1;
      unregisterAcpRuntimeBackend(ACPX_BACKEND_ID);
      runtime = null;
    }
  };
}

// vendor/openclaw-runtime/win-x64/extensions/acpx/index.ts
var plugin = {
  id: "acpx",
  name: "ACPX Runtime",
  description: "ACP runtime backend powered by the acpx CLI.",
  configSchema: createAcpxPluginConfigSchema(),
  register(api) {
    api.registerService(
      createAcpxRuntimeService({
        pluginConfig: api.pluginConfig
      })
    );
  }
};
var acpx_default = plugin;
export {
  acpx_default as default
};
