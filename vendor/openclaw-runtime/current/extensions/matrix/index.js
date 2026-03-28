var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// vendor/openclaw-runtime/win-x64/extensions/matrix/src/secret-input.ts
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
var init_secret_input = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/matrix/src/secret-input.ts"() {
    "use strict";
  }
});

// vendor/openclaw-runtime/win-x64/extensions/matrix/src/matrix/client/runtime.ts
function isBunRuntime() {
  const versions = process.versions;
  return typeof versions.bun === "string";
}
var init_runtime = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/matrix/src/matrix/client/runtime.ts"() {
    "use strict";
  }
});

// vendor/openclaw-runtime/win-x64/extensions/matrix/src/runtime.ts
function setMatrixRuntime(next) {
  runtime = next;
}
function getMatrixRuntime() {
  if (!runtime) {
    throw new Error("Matrix runtime not initialized");
  }
  return runtime;
}
var runtime;
var init_runtime2 = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/matrix/src/runtime.ts"() {
    "use strict";
    runtime = null;
  }
});

// vendor/openclaw-runtime/win-x64/extensions/matrix/src/matrix/sdk-runtime.ts
import { createRequire } from "module";
function loadMatrixSdk() {
  if (cachedMatrixSdkRuntime) {
    return cachedMatrixSdkRuntime;
  }
  const req = createRequire(import.meta.url);
  cachedMatrixSdkRuntime = req("@vector-im/matrix-bot-sdk");
  return cachedMatrixSdkRuntime;
}
function getMatrixLogService() {
  return loadMatrixSdk().LogService;
}
var cachedMatrixSdkRuntime;
var init_sdk_runtime = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/matrix/src/matrix/sdk-runtime.ts"() {
    "use strict";
    cachedMatrixSdkRuntime = null;
  }
});

// vendor/openclaw-runtime/win-x64/extensions/matrix/src/matrix/client/logging.ts
function shouldSuppressMatrixHttpNotFound(module, messageOrObject) {
  if (module !== "MatrixHttpClient") {
    return false;
  }
  return messageOrObject.some((entry) => {
    if (!entry || typeof entry !== "object") {
      return false;
    }
    return entry.errcode === "M_NOT_FOUND";
  });
}
function ensureMatrixSdkLoggingConfigured() {
  if (matrixSdkLoggingConfigured) {
    return;
  }
  const { ConsoleLogger, LogService } = loadMatrixSdk();
  matrixSdkBaseLogger = new ConsoleLogger();
  matrixSdkLoggingConfigured = true;
  LogService.setLogger({
    trace: (module, ...messageOrObject) => matrixSdkBaseLogger?.trace(module, ...messageOrObject),
    debug: (module, ...messageOrObject) => matrixSdkBaseLogger?.debug(module, ...messageOrObject),
    info: (module, ...messageOrObject) => matrixSdkBaseLogger?.info(module, ...messageOrObject),
    warn: (module, ...messageOrObject) => matrixSdkBaseLogger?.warn(module, ...messageOrObject),
    error: (module, ...messageOrObject) => {
      if (shouldSuppressMatrixHttpNotFound(module, messageOrObject)) {
        return;
      }
      matrixSdkBaseLogger?.error(module, ...messageOrObject);
    }
  });
}
var matrixSdkLoggingConfigured, matrixSdkBaseLogger;
var init_logging = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/matrix/src/matrix/client/logging.ts"() {
    "use strict";
    init_sdk_runtime();
    matrixSdkLoggingConfigured = false;
  }
});

// vendor/openclaw-runtime/win-x64/extensions/matrix/src/matrix/credentials.ts
var credentials_exports = {};
__export(credentials_exports, {
  clearMatrixCredentials: () => clearMatrixCredentials,
  credentialsMatchConfig: () => credentialsMatchConfig,
  loadMatrixCredentials: () => loadMatrixCredentials,
  resolveMatrixCredentialsDir: () => resolveMatrixCredentialsDir,
  resolveMatrixCredentialsPath: () => resolveMatrixCredentialsPath,
  saveMatrixCredentials: () => saveMatrixCredentials,
  touchMatrixCredentials: () => touchMatrixCredentials
});
import fs from "fs";
import os from "os";
import path from "path";
import { DEFAULT_ACCOUNT_ID, normalizeAccountId } from "openclaw/plugin-sdk/account-id";
function credentialsFilename(accountId) {
  const normalized = normalizeAccountId(accountId);
  if (normalized === DEFAULT_ACCOUNT_ID) {
    return "credentials.json";
  }
  return `credentials-${normalized}.json`;
}
function resolveMatrixCredentialsDir(env = process.env, stateDir) {
  const resolvedStateDir = stateDir ?? getMatrixRuntime().state.resolveStateDir(env, os.homedir);
  return path.join(resolvedStateDir, "credentials", "matrix");
}
function resolveMatrixCredentialsPath(env = process.env, accountId) {
  const dir = resolveMatrixCredentialsDir(env);
  return path.join(dir, credentialsFilename(accountId));
}
function loadMatrixCredentials(env = process.env, accountId) {
  const credPath = resolveMatrixCredentialsPath(env, accountId);
  try {
    if (!fs.existsSync(credPath)) {
      return null;
    }
    const raw = fs.readFileSync(credPath, "utf-8");
    const parsed = JSON.parse(raw);
    if (typeof parsed.homeserver !== "string" || typeof parsed.userId !== "string" || typeof parsed.accessToken !== "string") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
function saveMatrixCredentials(credentials, env = process.env, accountId) {
  const dir = resolveMatrixCredentialsDir(env);
  fs.mkdirSync(dir, { recursive: true });
  const credPath = resolveMatrixCredentialsPath(env, accountId);
  const existing = loadMatrixCredentials(env, accountId);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const toSave = {
    ...credentials,
    createdAt: existing?.createdAt ?? now,
    lastUsedAt: now
  };
  fs.writeFileSync(credPath, JSON.stringify(toSave, null, 2), "utf-8");
}
function touchMatrixCredentials(env = process.env, accountId) {
  const existing = loadMatrixCredentials(env, accountId);
  if (!existing) {
    return;
  }
  existing.lastUsedAt = (/* @__PURE__ */ new Date()).toISOString();
  const credPath = resolveMatrixCredentialsPath(env, accountId);
  fs.writeFileSync(credPath, JSON.stringify(existing, null, 2), "utf-8");
}
function clearMatrixCredentials(env = process.env, accountId) {
  const credPath = resolveMatrixCredentialsPath(env, accountId);
  try {
    if (fs.existsSync(credPath)) {
      fs.unlinkSync(credPath);
    }
  } catch {
  }
}
function credentialsMatchConfig(stored, config) {
  if (!config.userId) {
    return stored.homeserver === config.homeserver;
  }
  return stored.homeserver === config.homeserver && stored.userId === config.userId;
}
var init_credentials = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/matrix/src/matrix/credentials.ts"() {
    "use strict";
    init_runtime2();
  }
});

// vendor/openclaw-runtime/win-x64/extensions/matrix/src/matrix/client/config.ts
import { fetchWithSsrFGuard } from "openclaw/plugin-sdk";
import { DEFAULT_ACCOUNT_ID as DEFAULT_ACCOUNT_ID2, normalizeAccountId as normalizeAccountId2 } from "openclaw/plugin-sdk/account-id";
function clean(value, path4) {
  return normalizeResolvedSecretInputString({ value, path: path4 }) ?? "";
}
function deepMergeConfig(base, override) {
  const merged = { ...base, ...override };
  for (const key of ["dm", "actions"]) {
    const b = base[key];
    const o = override[key];
    if (typeof b === "object" && b !== null && typeof o === "object" && o !== null) {
      merged[key] = { ...b, ...o };
    }
  }
  return merged;
}
function resolveMatrixConfigForAccount(cfg = getMatrixRuntime().config.loadConfig(), accountId, env = process.env) {
  const normalizedAccountId = normalizeAccountId2(accountId);
  const matrixBase = cfg.channels?.matrix ?? {};
  const accounts = cfg.channels?.matrix?.accounts;
  let accountConfig = accounts?.[normalizedAccountId];
  if (!accountConfig && accounts) {
    for (const key of Object.keys(accounts)) {
      if (normalizeAccountId2(key) === normalizedAccountId) {
        accountConfig = accounts[key];
        break;
      }
    }
  }
  const matrix = accountConfig ? deepMergeConfig(matrixBase, accountConfig) : matrixBase;
  const homeserver = clean(matrix.homeserver, "channels.matrix.homeserver") || clean(env.MATRIX_HOMESERVER, "MATRIX_HOMESERVER");
  const userId = clean(matrix.userId, "channels.matrix.userId") || clean(env.MATRIX_USER_ID, "MATRIX_USER_ID");
  const accessToken = clean(matrix.accessToken, "channels.matrix.accessToken") || clean(env.MATRIX_ACCESS_TOKEN, "MATRIX_ACCESS_TOKEN") || void 0;
  const password = clean(matrix.password, "channels.matrix.password") || clean(env.MATRIX_PASSWORD, "MATRIX_PASSWORD") || void 0;
  const deviceName = clean(matrix.deviceName, "channels.matrix.deviceName") || clean(env.MATRIX_DEVICE_NAME, "MATRIX_DEVICE_NAME") || void 0;
  const initialSyncLimit = typeof matrix.initialSyncLimit === "number" ? Math.max(0, Math.floor(matrix.initialSyncLimit)) : void 0;
  const encryption = matrix.encryption ?? false;
  return {
    homeserver,
    userId,
    accessToken,
    password,
    deviceName,
    initialSyncLimit,
    encryption
  };
}
async function resolveMatrixAuth(params) {
  const cfg = params?.cfg ?? getMatrixRuntime().config.loadConfig();
  const env = params?.env ?? process.env;
  const resolved = resolveMatrixConfigForAccount(cfg, params?.accountId, env);
  if (!resolved.homeserver) {
    throw new Error("Matrix homeserver is required (matrix.homeserver)");
  }
  const {
    loadMatrixCredentials: loadMatrixCredentials2,
    saveMatrixCredentials: saveMatrixCredentials2,
    credentialsMatchConfig: credentialsMatchConfig2,
    touchMatrixCredentials: touchMatrixCredentials2
  } = await Promise.resolve().then(() => (init_credentials(), credentials_exports));
  const accountId = params?.accountId;
  const cached = loadMatrixCredentials2(env, accountId);
  const cachedCredentials = cached && credentialsMatchConfig2(cached, {
    homeserver: resolved.homeserver,
    userId: resolved.userId || ""
  }) ? cached : null;
  if (resolved.accessToken) {
    let userId = resolved.userId;
    if (!userId) {
      ensureMatrixSdkLoggingConfigured();
      const { MatrixClient } = loadMatrixSdk();
      const tempClient = new MatrixClient(resolved.homeserver, resolved.accessToken);
      const whoami = await tempClient.getUserId();
      userId = whoami;
      saveMatrixCredentials2(
        {
          homeserver: resolved.homeserver,
          userId,
          accessToken: resolved.accessToken
        },
        env,
        accountId
      );
    } else if (cachedCredentials && cachedCredentials.accessToken === resolved.accessToken) {
      touchMatrixCredentials2(env, accountId);
    }
    return {
      homeserver: resolved.homeserver,
      userId,
      accessToken: resolved.accessToken,
      deviceName: resolved.deviceName,
      initialSyncLimit: resolved.initialSyncLimit,
      encryption: resolved.encryption
    };
  }
  if (cachedCredentials) {
    touchMatrixCredentials2(env, accountId);
    return {
      homeserver: cachedCredentials.homeserver,
      userId: cachedCredentials.userId,
      accessToken: cachedCredentials.accessToken,
      deviceName: resolved.deviceName,
      initialSyncLimit: resolved.initialSyncLimit,
      encryption: resolved.encryption
    };
  }
  if (!resolved.userId) {
    throw new Error("Matrix userId is required when no access token is configured (matrix.userId)");
  }
  if (!resolved.password) {
    throw new Error(
      "Matrix password is required when no access token is configured (matrix.password)"
    );
  }
  const { response: loginResponse, release: releaseLoginResponse } = await fetchWithSsrFGuard({
    url: `${resolved.homeserver}/_matrix/client/v3/login`,
    init: {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "m.login.password",
        identifier: { type: "m.id.user", user: resolved.userId },
        password: resolved.password,
        initial_device_display_name: resolved.deviceName ?? "OpenClaw Gateway"
      })
    },
    auditContext: "matrix.login"
  });
  const login = await (async () => {
    try {
      if (!loginResponse.ok) {
        const errorText = await loginResponse.text();
        throw new Error(`Matrix login failed: ${errorText}`);
      }
      return await loginResponse.json();
    } finally {
      await releaseLoginResponse();
    }
  })();
  const accessToken = login.access_token?.trim();
  if (!accessToken) {
    throw new Error("Matrix login did not return an access token");
  }
  const auth = {
    homeserver: resolved.homeserver,
    userId: login.user_id ?? resolved.userId,
    accessToken,
    deviceName: resolved.deviceName,
    initialSyncLimit: resolved.initialSyncLimit,
    encryption: resolved.encryption
  };
  saveMatrixCredentials2(
    {
      homeserver: auth.homeserver,
      userId: auth.userId,
      accessToken: auth.accessToken,
      deviceId: login.device_id
    },
    env,
    accountId
  );
  return auth;
}
var init_config = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/matrix/src/matrix/client/config.ts"() {
    "use strict";
    init_runtime2();
    init_secret_input();
    init_sdk_runtime();
    init_logging();
  }
});

// vendor/openclaw-runtime/win-x64/extensions/matrix/src/matrix/client/storage.ts
import crypto from "crypto";
import fs2 from "fs";
import os2 from "os";
import path2 from "path";
function sanitizePathSegment(value) {
  const cleaned = value.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "");
  return cleaned || "unknown";
}
function resolveHomeserverKey(homeserver) {
  try {
    const url = new URL(homeserver);
    if (url.host) {
      return sanitizePathSegment(url.host);
    }
  } catch {
  }
  return sanitizePathSegment(homeserver);
}
function hashAccessToken(accessToken) {
  return crypto.createHash("sha256").update(accessToken).digest("hex").slice(0, 16);
}
function resolveLegacyStoragePaths(env = process.env) {
  const stateDir = getMatrixRuntime().state.resolveStateDir(env, os2.homedir);
  return {
    storagePath: path2.join(stateDir, "matrix", "bot-storage.json"),
    cryptoPath: path2.join(stateDir, "matrix", "crypto")
  };
}
function resolveMatrixStoragePaths(params) {
  const env = params.env ?? process.env;
  const stateDir = getMatrixRuntime().state.resolveStateDir(env, os2.homedir);
  const accountKey = sanitizePathSegment(params.accountId ?? DEFAULT_ACCOUNT_KEY);
  const userKey = sanitizePathSegment(params.userId);
  const serverKey = resolveHomeserverKey(params.homeserver);
  const tokenHash = hashAccessToken(params.accessToken);
  const rootDir = path2.join(
    stateDir,
    "matrix",
    "accounts",
    accountKey,
    `${serverKey}__${userKey}`,
    tokenHash
  );
  return {
    rootDir,
    storagePath: path2.join(rootDir, "bot-storage.json"),
    cryptoPath: path2.join(rootDir, "crypto"),
    metaPath: path2.join(rootDir, STORAGE_META_FILENAME),
    accountKey,
    tokenHash
  };
}
function maybeMigrateLegacyStorage(params) {
  const legacy = resolveLegacyStoragePaths(params.env);
  const hasLegacyStorage = fs2.existsSync(legacy.storagePath);
  const hasLegacyCrypto = fs2.existsSync(legacy.cryptoPath);
  const hasNewStorage = fs2.existsSync(params.storagePaths.storagePath) || fs2.existsSync(params.storagePaths.cryptoPath);
  if (!hasLegacyStorage && !hasLegacyCrypto) {
    return;
  }
  if (hasNewStorage) {
    return;
  }
  fs2.mkdirSync(params.storagePaths.rootDir, { recursive: true });
  if (hasLegacyStorage) {
    try {
      fs2.renameSync(legacy.storagePath, params.storagePaths.storagePath);
    } catch {
    }
  }
  if (hasLegacyCrypto) {
    try {
      fs2.renameSync(legacy.cryptoPath, params.storagePaths.cryptoPath);
    } catch {
    }
  }
}
function writeStorageMeta(params) {
  try {
    const payload = {
      homeserver: params.homeserver,
      userId: params.userId,
      accountId: params.accountId ?? DEFAULT_ACCOUNT_KEY,
      accessTokenHash: params.storagePaths.tokenHash,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    fs2.mkdirSync(params.storagePaths.rootDir, { recursive: true });
    fs2.writeFileSync(params.storagePaths.metaPath, JSON.stringify(payload, null, 2), "utf-8");
  } catch {
  }
}
var DEFAULT_ACCOUNT_KEY, STORAGE_META_FILENAME;
var init_storage = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/matrix/src/matrix/client/storage.ts"() {
    "use strict";
    init_runtime2();
    DEFAULT_ACCOUNT_KEY = "default";
    STORAGE_META_FILENAME = "storage-meta.json";
  }
});

// vendor/openclaw-runtime/win-x64/extensions/matrix/src/matrix/client/create-client.ts
import fs3 from "fs";
function sanitizeUserIdList(input, label) {
  const LogService = loadMatrixSdk().LogService;
  if (input == null) {
    return [];
  }
  if (!Array.isArray(input)) {
    LogService.warn(
      "MatrixClientLite",
      `Expected ${label} list to be an array, got ${typeof input}`
    );
    return [];
  }
  const filtered = input.filter(
    (entry) => typeof entry === "string" && entry.trim().length > 0
  );
  if (filtered.length !== input.length) {
    LogService.warn(
      "MatrixClientLite",
      `Dropping ${input.length - filtered.length} invalid ${label} entries from sync payload`
    );
  }
  return filtered;
}
async function createMatrixClient(params) {
  const { MatrixClient, SimpleFsStorageProvider, RustSdkCryptoStorageProvider, LogService } = loadMatrixSdk();
  ensureMatrixSdkLoggingConfigured();
  const env = process.env;
  const storagePaths = resolveMatrixStoragePaths({
    homeserver: params.homeserver,
    userId: params.userId,
    accessToken: params.accessToken,
    accountId: params.accountId,
    env
  });
  maybeMigrateLegacyStorage({ storagePaths, env });
  fs3.mkdirSync(storagePaths.rootDir, { recursive: true });
  const storage = new SimpleFsStorageProvider(storagePaths.storagePath);
  let cryptoStorage;
  if (params.encryption) {
    fs3.mkdirSync(storagePaths.cryptoPath, { recursive: true });
    try {
      const { StoreType } = await import("@matrix-org/matrix-sdk-crypto-nodejs");
      cryptoStorage = new RustSdkCryptoStorageProvider(storagePaths.cryptoPath, StoreType.Sqlite);
    } catch (err) {
      LogService.warn(
        "MatrixClientLite",
        "Failed to initialize crypto storage, E2EE disabled:",
        err
      );
    }
  }
  writeStorageMeta({
    storagePaths,
    homeserver: params.homeserver,
    userId: params.userId,
    accountId: params.accountId
  });
  const client = new MatrixClient(params.homeserver, params.accessToken, storage, cryptoStorage);
  if (client.crypto) {
    const originalUpdateSyncData = client.crypto.updateSyncData.bind(client.crypto);
    client.crypto.updateSyncData = async (toDeviceMessages, otkCounts, unusedFallbackKeyAlgs, changedDeviceLists, leftDeviceLists) => {
      const safeChanged = sanitizeUserIdList(changedDeviceLists, "changed device list");
      const safeLeft = sanitizeUserIdList(leftDeviceLists, "left device list");
      try {
        return await originalUpdateSyncData(
          toDeviceMessages,
          otkCounts,
          unusedFallbackKeyAlgs,
          safeChanged,
          safeLeft
        );
      } catch (err) {
        const message = typeof err === "string" ? err : err instanceof Error ? err.message : "";
        if (message.includes("Expect value to be String")) {
          LogService.warn(
            "MatrixClientLite",
            "Ignoring malformed device list entries during crypto sync",
            message
          );
          return;
        }
        throw err;
      }
    };
  }
  return client;
}
var init_create_client = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/matrix/src/matrix/client/create-client.ts"() {
    "use strict";
    init_sdk_runtime();
    init_logging();
    init_storage();
  }
});

// vendor/openclaw-runtime/win-x64/extensions/matrix/src/matrix/client/startup.ts
async function startMatrixClientWithGrace(params) {
  const graceMs = params.graceMs ?? MATRIX_CLIENT_STARTUP_GRACE_MS;
  let startFailed = false;
  let startError = void 0;
  let startPromise;
  try {
    startPromise = params.client.start();
  } catch (err) {
    params.onError?.(err);
    throw err;
  }
  void startPromise.catch((err) => {
    startFailed = true;
    startError = err;
    params.onError?.(err);
  });
  await new Promise((resolve) => setTimeout(resolve, graceMs));
  if (startFailed) {
    throw startError;
  }
}
var MATRIX_CLIENT_STARTUP_GRACE_MS;
var init_startup = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/matrix/src/matrix/client/startup.ts"() {
    "use strict";
    MATRIX_CLIENT_STARTUP_GRACE_MS = 2e3;
  }
});

// vendor/openclaw-runtime/win-x64/extensions/matrix/src/matrix/client/shared.ts
import { normalizeAccountId as normalizeAccountId3 } from "openclaw/plugin-sdk/account-id";
function buildSharedClientKey(auth, accountId) {
  const normalizedAccountId = normalizeAccountId3(accountId);
  return [
    auth.homeserver,
    auth.userId,
    auth.accessToken,
    auth.encryption ? "e2ee" : "plain",
    normalizedAccountId || DEFAULT_ACCOUNT_KEY
  ].join("|");
}
async function createSharedMatrixClient(params) {
  const client = await createMatrixClient({
    homeserver: params.auth.homeserver,
    userId: params.auth.userId,
    accessToken: params.auth.accessToken,
    encryption: params.auth.encryption,
    localTimeoutMs: params.timeoutMs,
    accountId: params.accountId
  });
  return {
    client,
    key: buildSharedClientKey(params.auth, params.accountId),
    started: false,
    cryptoReady: false
  };
}
async function ensureSharedClientStarted(params) {
  if (params.state.started) {
    return;
  }
  const key = params.state.key;
  const existingStartPromise = sharedClientStartPromises.get(key);
  if (existingStartPromise) {
    await existingStartPromise;
    return;
  }
  const startPromise = (async () => {
    const client = params.state.client;
    if (params.encryption && !params.state.cryptoReady) {
      try {
        const joinedRooms = await client.getJoinedRooms();
        if (client.crypto) {
          await client.crypto.prepare(
            joinedRooms
          );
          params.state.cryptoReady = true;
        }
      } catch (err) {
        const LogService = getMatrixLogService();
        LogService.warn("MatrixClientLite", "Failed to prepare crypto:", err);
      }
    }
    await startMatrixClientWithGrace({
      client,
      onError: (err) => {
        params.state.started = false;
        const LogService = getMatrixLogService();
        LogService.error("MatrixClientLite", "client.start() error:", err);
      }
    });
    params.state.started = true;
  })();
  sharedClientStartPromises.set(key, startPromise);
  try {
    await startPromise;
  } finally {
    sharedClientStartPromises.delete(key);
  }
}
async function resolveSharedMatrixClient(params = {}) {
  const accountId = normalizeAccountId3(params.accountId);
  const auth = params.auth ?? await resolveMatrixAuth({ cfg: params.cfg, env: params.env, accountId });
  const key = buildSharedClientKey(auth, accountId);
  const shouldStart = params.startClient !== false;
  const existingState = sharedClientStates.get(key);
  if (existingState) {
    if (shouldStart) {
      await ensureSharedClientStarted({
        state: existingState,
        timeoutMs: params.timeoutMs,
        initialSyncLimit: auth.initialSyncLimit,
        encryption: auth.encryption
      });
    }
    return existingState.client;
  }
  const existingPromise = sharedClientPromises.get(key);
  if (existingPromise) {
    const pending = await existingPromise;
    if (shouldStart) {
      await ensureSharedClientStarted({
        state: pending,
        timeoutMs: params.timeoutMs,
        initialSyncLimit: auth.initialSyncLimit,
        encryption: auth.encryption
      });
    }
    return pending.client;
  }
  const createPromise = createSharedMatrixClient({
    auth,
    timeoutMs: params.timeoutMs,
    accountId
  });
  sharedClientPromises.set(key, createPromise);
  try {
    const created = await createPromise;
    sharedClientStates.set(key, created);
    if (shouldStart) {
      await ensureSharedClientStarted({
        state: created,
        timeoutMs: params.timeoutMs,
        initialSyncLimit: auth.initialSyncLimit,
        encryption: auth.encryption
      });
    }
    return created.client;
  } finally {
    sharedClientPromises.delete(key);
  }
}
function stopSharedClient(key) {
  if (key) {
    const state = sharedClientStates.get(key);
    if (state) {
      state.client.stop();
      sharedClientStates.delete(key);
    }
  } else {
    for (const state of sharedClientStates.values()) {
      state.client.stop();
    }
    sharedClientStates.clear();
  }
}
function stopSharedClientForAccount(auth, accountId) {
  const key = buildSharedClientKey(auth, normalizeAccountId3(accountId));
  stopSharedClient(key);
}
var sharedClientStates, sharedClientPromises, sharedClientStartPromises;
var init_shared = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/matrix/src/matrix/client/shared.ts"() {
    "use strict";
    init_sdk_runtime();
    init_config();
    init_create_client();
    init_startup();
    init_storage();
    sharedClientStates = /* @__PURE__ */ new Map();
    sharedClientPromises = /* @__PURE__ */ new Map();
    sharedClientStartPromises = /* @__PURE__ */ new Map();
  }
});

// vendor/openclaw-runtime/win-x64/extensions/matrix/src/matrix/client.ts
var init_client = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/matrix/src/matrix/client.ts"() {
    "use strict";
    init_runtime();
    init_config();
    init_create_client();
    init_shared();
  }
});

// vendor/openclaw-runtime/win-x64/extensions/matrix/src/matrix/accounts.ts
import {
  DEFAULT_ACCOUNT_ID as DEFAULT_ACCOUNT_ID3,
  normalizeAccountId as normalizeAccountId4,
  normalizeOptionalAccountId
} from "openclaw/plugin-sdk/account-id";
function mergeAccountConfig(base, account) {
  const merged = { ...base, ...account };
  for (const key of ["dm", "actions"]) {
    const b = base[key];
    const o = account[key];
    if (typeof b === "object" && b != null && typeof o === "object" && o != null) {
      merged[key] = { ...b, ...o };
    }
  }
  delete merged.accounts;
  delete merged.defaultAccount;
  return merged;
}
function listConfiguredAccountIds(cfg) {
  const accounts = cfg.channels?.matrix?.accounts;
  if (!accounts || typeof accounts !== "object") {
    return [];
  }
  return [
    ...new Set(
      Object.keys(accounts).filter(Boolean).map((id) => normalizeAccountId4(id))
    )
  ];
}
function listMatrixAccountIds(cfg) {
  const ids = listConfiguredAccountIds(cfg);
  if (ids.length === 0) {
    return [DEFAULT_ACCOUNT_ID3];
  }
  return ids.toSorted((a, b) => a.localeCompare(b));
}
function resolveDefaultMatrixAccountId(cfg) {
  const preferred = normalizeOptionalAccountId(cfg.channels?.matrix?.defaultAccount);
  if (preferred && listMatrixAccountIds(cfg).some((accountId) => normalizeAccountId4(accountId) === preferred)) {
    return preferred;
  }
  const ids = listMatrixAccountIds(cfg);
  if (ids.includes(DEFAULT_ACCOUNT_ID3)) {
    return DEFAULT_ACCOUNT_ID3;
  }
  return ids[0] ?? DEFAULT_ACCOUNT_ID3;
}
function resolveAccountConfig(cfg, accountId) {
  const accounts = cfg.channels?.matrix?.accounts;
  if (!accounts || typeof accounts !== "object") {
    return void 0;
  }
  if (accounts[accountId]) {
    return accounts[accountId];
  }
  const normalized = normalizeAccountId4(accountId);
  for (const key of Object.keys(accounts)) {
    if (normalizeAccountId4(key) === normalized) {
      return accounts[key];
    }
  }
  return void 0;
}
function resolveMatrixAccount(params) {
  const accountId = normalizeAccountId4(params.accountId);
  const matrixBase = params.cfg.channels?.matrix ?? {};
  const base = resolveMatrixAccountConfig({ cfg: params.cfg, accountId });
  const enabled = base.enabled !== false && matrixBase.enabled !== false;
  const resolved = resolveMatrixConfigForAccount(params.cfg, accountId, process.env);
  const hasHomeserver = Boolean(resolved.homeserver);
  const hasUserId = Boolean(resolved.userId);
  const hasAccessToken = Boolean(resolved.accessToken);
  const hasPassword = Boolean(resolved.password);
  const hasPasswordAuth = hasUserId && (hasPassword || hasConfiguredSecretInput(base.password));
  const stored = loadMatrixCredentials(process.env, accountId);
  const hasStored = stored && resolved.homeserver ? credentialsMatchConfig(stored, {
    homeserver: resolved.homeserver,
    userId: resolved.userId || ""
  }) : false;
  const configured = hasHomeserver && (hasAccessToken || hasPasswordAuth || Boolean(hasStored));
  return {
    accountId,
    enabled,
    name: base.name?.trim() || void 0,
    configured,
    homeserver: resolved.homeserver || void 0,
    userId: resolved.userId || void 0,
    config: base
  };
}
function resolveMatrixAccountConfig(params) {
  const accountId = normalizeAccountId4(params.accountId);
  const matrixBase = params.cfg.channels?.matrix ?? {};
  const accountConfig = resolveAccountConfig(params.cfg, accountId);
  if (!accountConfig) {
    return matrixBase;
  }
  return mergeAccountConfig(matrixBase, accountConfig);
}
var init_accounts = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/matrix/src/matrix/accounts.ts"() {
    "use strict";
    init_secret_input();
    init_client();
    init_credentials();
  }
});

// vendor/openclaw-runtime/win-x64/extensions/matrix/src/matrix/poll-types.ts
function isPollStartType(eventType) {
  return POLL_START_TYPES.includes(eventType);
}
function getTextContent(text) {
  if (!text) {
    return "";
  }
  return text["m.text"] ?? text["org.matrix.msc1767.text"] ?? text.body ?? "";
}
function parsePollStartContent(content) {
  const poll = content[M_POLL_START] ?? content[ORG_POLL_START] ?? content["m.poll"];
  if (!poll) {
    return null;
  }
  const question = getTextContent(poll.question);
  if (!question) {
    return null;
  }
  const answers = poll.answers.map((answer) => getTextContent(answer)).filter((a) => a.trim().length > 0);
  return {
    eventId: "",
    roomId: "",
    sender: "",
    senderName: "",
    question,
    answers,
    kind: poll.kind ?? "m.poll.disclosed",
    maxSelections: poll.max_selections ?? 1
  };
}
function formatPollAsText(summary) {
  const lines = [
    "[Poll]",
    summary.question,
    "",
    ...summary.answers.map((answer, idx) => `${idx + 1}. ${answer}`)
  ];
  return lines.join("\n");
}
function buildTextContent(body) {
  return {
    "m.text": body,
    "org.matrix.msc1767.text": body
  };
}
function buildPollFallbackText(question, answers) {
  if (answers.length === 0) {
    return question;
  }
  return `${question}
${answers.map((answer, idx) => `${idx + 1}. ${answer}`).join("\n")}`;
}
function buildPollStartContent(poll) {
  const question = poll.question.trim();
  const answers = poll.options.map((option) => option.trim()).filter((option) => option.length > 0).map((option, idx) => ({
    id: `answer${idx + 1}`,
    ...buildTextContent(option)
  }));
  const isMultiple = (poll.maxSelections ?? 1) > 1;
  const maxSelections = isMultiple ? Math.max(1, answers.length) : 1;
  const fallbackText = buildPollFallbackText(
    question,
    answers.map((answer) => getTextContent(answer))
  );
  return {
    [M_POLL_START]: {
      question: buildTextContent(question),
      kind: isMultiple ? "m.poll.undisclosed" : "m.poll.disclosed",
      max_selections: maxSelections,
      answers
    },
    "m.text": fallbackText,
    "org.matrix.msc1767.text": fallbackText
  };
}
var M_POLL_START, ORG_POLL_START, POLL_START_TYPES;
var init_poll_types = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/matrix/src/matrix/poll-types.ts"() {
    "use strict";
    M_POLL_START = "m.poll.start";
    ORG_POLL_START = "org.matrix.msc3381.poll.start";
    POLL_START_TYPES = [M_POLL_START, ORG_POLL_START];
  }
});

// vendor/openclaw-runtime/win-x64/extensions/matrix/src/matrix/send-queue.ts
import { KeyedAsyncQueue } from "openclaw/plugin-sdk/keyed-async-queue";
function enqueueSend(roomId, fn, options) {
  const gapMs = options?.gapMs ?? DEFAULT_SEND_GAP_MS;
  const delayFn = options?.delayFn ?? delay;
  return roomQueues.enqueue(roomId, async () => {
    await delayFn(gapMs);
    return await fn();
  });
}
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
var DEFAULT_SEND_GAP_MS, roomQueues;
var init_send_queue = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/matrix/src/matrix/send-queue.ts"() {
    "use strict";
    DEFAULT_SEND_GAP_MS = 150;
    roomQueues = new KeyedAsyncQueue();
  }
});

// vendor/openclaw-runtime/win-x64/extensions/matrix/src/matrix/active-client.ts
import { normalizeAccountId as normalizeAccountId5 } from "openclaw/plugin-sdk/account-id";
function setActiveMatrixClient(client, accountId) {
  const key = normalizeAccountId5(accountId);
  if (client) {
    activeClients.set(key, client);
  } else {
    activeClients.delete(key);
  }
}
function getActiveMatrixClient(accountId) {
  const key = normalizeAccountId5(accountId);
  return activeClients.get(key) ?? null;
}
function getAnyActiveMatrixClient() {
  const first = activeClients.values().next();
  return first.done ? null : first.value;
}
var activeClients;
var init_active_client = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/matrix/src/matrix/active-client.ts"() {
    "use strict";
    activeClients = /* @__PURE__ */ new Map();
  }
});

// vendor/openclaw-runtime/win-x64/extensions/matrix/src/matrix/client-bootstrap.ts
async function createPreparedMatrixClient(opts) {
  const client = await createMatrixClient({
    homeserver: opts.auth.homeserver,
    userId: opts.auth.userId,
    accessToken: opts.auth.accessToken,
    encryption: opts.auth.encryption,
    localTimeoutMs: opts.timeoutMs,
    accountId: opts.accountId
  });
  if (opts.auth.encryption && client.crypto) {
    try {
      const joinedRooms = await client.getJoinedRooms();
      await client.crypto.prepare(joinedRooms);
    } catch {
    }
  }
  await startMatrixClientWithGrace({
    client,
    onError: (err) => {
      const LogService = getMatrixLogService();
      LogService.error("MatrixClientBootstrap", "client.start() error:", err);
    }
  });
  return client;
}
var init_client_bootstrap = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/matrix/src/matrix/client-bootstrap.ts"() {
    "use strict";
    init_create_client();
    init_startup();
    init_sdk_runtime();
  }
});

// vendor/openclaw-runtime/win-x64/extensions/matrix/src/matrix/send/client.ts
import { DEFAULT_ACCOUNT_ID as DEFAULT_ACCOUNT_ID4, normalizeAccountId as normalizeAccountId6 } from "openclaw/plugin-sdk/account-id";
function ensureNodeRuntime() {
  if (isBunRuntime()) {
    throw new Error("Matrix support requires Node (bun runtime not supported)");
  }
}
function findAccountConfig(accounts, accountId) {
  if (!accounts) return void 0;
  const normalized = normalizeAccountId6(accountId);
  if (accounts[normalized]) return accounts[normalized];
  for (const key of Object.keys(accounts)) {
    if (normalizeAccountId6(key) === normalized) {
      return accounts[key];
    }
  }
  return void 0;
}
function resolveMediaMaxBytes(accountId) {
  const cfg = getCore().config.loadConfig();
  const accountConfig = findAccountConfig(
    cfg.channels?.matrix?.accounts,
    accountId ?? ""
  );
  if (typeof accountConfig?.mediaMaxMb === "number") {
    return accountConfig.mediaMaxMb * 1024 * 1024;
  }
  if (typeof cfg.channels?.matrix?.mediaMaxMb === "number") {
    return cfg.channels.matrix.mediaMaxMb * 1024 * 1024;
  }
  return void 0;
}
async function resolveMatrixClient(opts) {
  ensureNodeRuntime();
  if (opts.client) {
    return { client: opts.client, stopOnDone: false };
  }
  const accountId = typeof opts.accountId === "string" && opts.accountId.trim().length > 0 ? normalizeAccountId6(opts.accountId) : void 0;
  const active = getActiveMatrixClient(accountId);
  if (active) {
    return { client: active, stopOnDone: false };
  }
  if (!accountId) {
    const defaultClient = getActiveMatrixClient(DEFAULT_ACCOUNT_ID4);
    if (defaultClient) {
      return { client: defaultClient, stopOnDone: false };
    }
    const anyActive = getAnyActiveMatrixClient();
    if (anyActive) {
      return { client: anyActive, stopOnDone: false };
    }
  }
  const shouldShareClient = Boolean(process.env.OPENCLAW_GATEWAY_PORT);
  if (shouldShareClient) {
    const client2 = await resolveSharedMatrixClient({
      timeoutMs: opts.timeoutMs,
      accountId
    });
    return { client: client2, stopOnDone: false };
  }
  const auth = await resolveMatrixAuth({ accountId });
  const client = await createPreparedMatrixClient({
    auth,
    timeoutMs: opts.timeoutMs,
    accountId
  });
  return { client, stopOnDone: true };
}
var getCore;
var init_client2 = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/matrix/src/matrix/send/client.ts"() {
    "use strict";
    init_runtime2();
    init_active_client();
    init_client_bootstrap();
    init_client();
    getCore = () => getMatrixRuntime();
  }
});

// vendor/openclaw-runtime/win-x64/extensions/matrix/src/matrix/format.ts
import MarkdownIt from "markdown-it";
function markdownToMatrixHtml(markdown) {
  const rendered = md.render(markdown ?? "");
  return rendered.trimEnd();
}
var md, escapeHtml;
var init_format = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/matrix/src/matrix/format.ts"() {
    "use strict";
    md = new MarkdownIt({
      html: false,
      linkify: true,
      breaks: true,
      typographer: false
    });
    md.enable("strikethrough");
    ({ escapeHtml } = md.utils);
    md.renderer.rules.image = (tokens, idx) => escapeHtml(tokens[idx]?.content ?? "");
    md.renderer.rules.html_block = (tokens, idx) => escapeHtml(tokens[idx]?.content ?? "");
    md.renderer.rules.html_inline = (tokens, idx) => escapeHtml(tokens[idx]?.content ?? "");
  }
});

// vendor/openclaw-runtime/win-x64/extensions/matrix/src/matrix/send/types.ts
var MsgType, RelationType, EventType;
var init_types = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/matrix/src/matrix/send/types.ts"() {
    "use strict";
    MsgType = {
      Text: "m.text",
      Image: "m.image",
      Audio: "m.audio",
      Video: "m.video",
      File: "m.file",
      Notice: "m.notice"
    };
    RelationType = {
      Annotation: "m.annotation",
      Replace: "m.replace",
      Thread: "m.thread"
    };
    EventType = {
      Direct: "m.direct",
      Reaction: "m.reaction",
      RoomMessage: "m.room.message"
    };
  }
});

// vendor/openclaw-runtime/win-x64/extensions/matrix/src/matrix/send/formatting.ts
function buildTextContent2(body, relation) {
  const content = relation ? {
    msgtype: MsgType.Text,
    body,
    "m.relates_to": relation
  } : {
    msgtype: MsgType.Text,
    body
  };
  applyMatrixFormatting(content, body);
  return content;
}
function applyMatrixFormatting(content, body) {
  const formatted = markdownToMatrixHtml(body ?? "");
  if (!formatted) {
    return;
  }
  content.format = "org.matrix.custom.html";
  content.formatted_body = formatted;
}
function buildReplyRelation(replyToId) {
  const trimmed = replyToId?.trim();
  if (!trimmed) {
    return void 0;
  }
  return { "m.in_reply_to": { event_id: trimmed } };
}
function buildThreadRelation(threadId, replyToId) {
  const trimmed = threadId.trim();
  return {
    rel_type: RelationType.Thread,
    event_id: trimmed,
    is_falling_back: true,
    "m.in_reply_to": { event_id: replyToId?.trim() || trimmed }
  };
}
function resolveMatrixMsgType(contentType, _fileName) {
  const kind = getCore2().media.mediaKindFromMime(contentType ?? "");
  switch (kind) {
    case "image":
      return MsgType.Image;
    case "audio":
      return MsgType.Audio;
    case "video":
      return MsgType.Video;
    default:
      return MsgType.File;
  }
}
function resolveMatrixVoiceDecision(opts) {
  if (!opts.wantsVoice) {
    return { useVoice: false };
  }
  if (isMatrixVoiceCompatibleAudio(opts)) {
    return { useVoice: true };
  }
  return { useVoice: false };
}
function isMatrixVoiceCompatibleAudio(opts) {
  return getCore2().media.isVoiceCompatibleAudio({
    contentType: opts.contentType,
    fileName: opts.fileName
  });
}
var getCore2;
var init_formatting = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/matrix/src/matrix/send/formatting.ts"() {
    "use strict";
    init_runtime2();
    init_format();
    init_types();
    getCore2 = () => getMatrixRuntime();
  }
});

// vendor/openclaw-runtime/win-x64/extensions/matrix/src/matrix/send/media.ts
function buildMatrixMediaInfo(params) {
  const base = {};
  if (Number.isFinite(params.size)) {
    base.size = params.size;
  }
  if (params.mimetype) {
    base.mimetype = params.mimetype;
  }
  if (params.imageInfo) {
    const dimensional = {
      ...base,
      ...params.imageInfo
    };
    if (typeof params.durationMs === "number") {
      const videoInfo = {
        ...dimensional,
        duration: params.durationMs
      };
      return videoInfo;
    }
    return dimensional;
  }
  if (typeof params.durationMs === "number") {
    const timedInfo = {
      ...base,
      duration: params.durationMs
    };
    return timedInfo;
  }
  if (Object.keys(base).length === 0) {
    return void 0;
  }
  return base;
}
function buildMediaContent(params) {
  const info = buildMatrixMediaInfo({
    size: params.size,
    mimetype: params.mimetype,
    durationMs: params.durationMs,
    imageInfo: params.imageInfo
  });
  const base = {
    msgtype: params.msgtype,
    body: params.body,
    filename: params.filename,
    info: info ?? void 0
  };
  if (!params.file && params.url) {
    base.url = params.url;
  }
  if (params.file) {
    base.file = params.file;
  }
  if (params.isVoice) {
    base["org.matrix.msc3245.voice"] = {};
    if (typeof params.durationMs === "number") {
      base["org.matrix.msc1767.audio"] = {
        duration: params.durationMs
      };
    }
  }
  if (params.relation) {
    base["m.relates_to"] = params.relation;
  }
  applyMatrixFormatting(base, params.body);
  return base;
}
async function prepareImageInfo(params) {
  const meta2 = await getCore3().media.getImageMetadata(params.buffer).catch(() => null);
  if (!meta2) {
    return void 0;
  }
  const imageInfo = { w: meta2.width, h: meta2.height };
  const maxDim = Math.max(meta2.width, meta2.height);
  if (maxDim > THUMBNAIL_MAX_SIDE) {
    try {
      const thumbBuffer = await getCore3().media.resizeToJpeg({
        buffer: params.buffer,
        maxSide: THUMBNAIL_MAX_SIDE,
        quality: THUMBNAIL_QUALITY,
        withoutEnlargement: true
      });
      const thumbMeta = await getCore3().media.getImageMetadata(thumbBuffer).catch(() => null);
      const thumbUri = await params.client.uploadContent(
        thumbBuffer,
        "image/jpeg",
        "thumbnail.jpg"
      );
      imageInfo.thumbnail_url = thumbUri;
      if (thumbMeta) {
        imageInfo.thumbnail_info = {
          w: thumbMeta.width,
          h: thumbMeta.height,
          mimetype: "image/jpeg",
          size: thumbBuffer.byteLength
        };
      }
    } catch {
    }
  }
  return imageInfo;
}
async function resolveMediaDurationMs(params) {
  if (params.kind !== "audio" && params.kind !== "video") {
    return void 0;
  }
  try {
    const { parseBuffer } = await import("music-metadata");
    const fileInfo = params.contentType || params.fileName ? {
      mimeType: params.contentType,
      size: params.buffer.byteLength,
      path: params.fileName
    } : void 0;
    const metadata = await parseBuffer(params.buffer, fileInfo, {
      duration: true,
      skipCovers: true
    });
    const durationSeconds = metadata.format.duration;
    if (typeof durationSeconds === "number" && Number.isFinite(durationSeconds)) {
      return Math.max(0, Math.round(durationSeconds * 1e3));
    }
  } catch {
  }
  return void 0;
}
async function uploadFile(client, file, params) {
  return await client.uploadContent(file, params.contentType, params.filename);
}
async function uploadMediaMaybeEncrypted(client, roomId, buffer, params) {
  const isEncrypted = client.crypto && await client.crypto.isRoomEncrypted(roomId);
  if (isEncrypted && client.crypto) {
    const encrypted = await client.crypto.encryptMedia(buffer);
    const mxc2 = await client.uploadContent(encrypted.buffer, params.contentType, params.filename);
    const file = { url: mxc2, ...encrypted.file };
    return {
      url: mxc2,
      file
    };
  }
  const mxc = await uploadFile(client, buffer, params);
  return { url: mxc };
}
var getCore3, THUMBNAIL_MAX_SIDE, THUMBNAIL_QUALITY;
var init_media = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/matrix/src/matrix/send/media.ts"() {
    "use strict";
    init_runtime2();
    init_formatting();
    getCore3 = () => getMatrixRuntime();
    THUMBNAIL_MAX_SIDE = 800;
    THUMBNAIL_QUALITY = 80;
  }
});

// vendor/openclaw-runtime/win-x64/extensions/matrix/src/matrix/send/targets.ts
function normalizeTarget(raw) {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("Matrix target is required (room:<id> or #alias)");
  }
  return trimmed;
}
function normalizeThreadId(raw) {
  if (raw === void 0 || raw === null) {
    return null;
  }
  const trimmed = String(raw).trim();
  return trimmed ? trimmed : null;
}
function setDirectRoomCached(key, value) {
  directRoomCache.set(key, value);
  if (directRoomCache.size > MAX_DIRECT_ROOM_CACHE_SIZE) {
    const oldest = directRoomCache.keys().next().value;
    if (oldest !== void 0) {
      directRoomCache.delete(oldest);
    }
  }
}
async function persistDirectRoom(client, userId, roomId) {
  let directContent = null;
  try {
    directContent = await client.getAccountData(EventType.Direct);
  } catch {
  }
  const existing = directContent && !Array.isArray(directContent) ? directContent : {};
  const current = Array.isArray(existing[userId]) ? existing[userId] : [];
  if (current[0] === roomId) {
    return;
  }
  const next = [roomId, ...current.filter((id) => id !== roomId)];
  try {
    await client.setAccountData(EventType.Direct, {
      ...existing,
      [userId]: next
    });
  } catch {
  }
}
async function resolveDirectRoomId(client, userId) {
  const trimmed = userId.trim();
  if (!trimmed.startsWith("@")) {
    throw new Error(`Matrix user IDs must be fully qualified (got "${trimmed}")`);
  }
  const cached = directRoomCache.get(trimmed);
  if (cached) {
    return cached;
  }
  try {
    const directContent = await client.getAccountData(EventType.Direct);
    const list = Array.isArray(directContent?.[trimmed]) ? directContent[trimmed] : [];
    if (list && list.length > 0) {
      setDirectRoomCached(trimmed, list[0]);
      return list[0];
    }
  } catch {
  }
  let fallbackRoom = null;
  try {
    const rooms = await client.getJoinedRooms();
    for (const roomId of rooms) {
      let members;
      try {
        members = await client.getJoinedRoomMembers(roomId);
      } catch {
        continue;
      }
      if (!members.includes(trimmed)) {
        continue;
      }
      if (members.length === 2) {
        setDirectRoomCached(trimmed, roomId);
        await persistDirectRoom(client, trimmed, roomId);
        return roomId;
      }
      if (!fallbackRoom) {
        fallbackRoom = roomId;
      }
    }
  } catch {
  }
  if (fallbackRoom) {
    setDirectRoomCached(trimmed, fallbackRoom);
    await persistDirectRoom(client, trimmed, fallbackRoom);
    return fallbackRoom;
  }
  throw new Error(`No direct room found for ${trimmed} (m.direct missing)`);
}
async function resolveMatrixRoomId(client, raw) {
  const target = normalizeTarget(raw);
  const lowered = target.toLowerCase();
  if (lowered.startsWith("matrix:")) {
    return await resolveMatrixRoomId(client, target.slice("matrix:".length));
  }
  if (lowered.startsWith("room:")) {
    return await resolveMatrixRoomId(client, target.slice("room:".length));
  }
  if (lowered.startsWith("channel:")) {
    return await resolveMatrixRoomId(client, target.slice("channel:".length));
  }
  if (lowered.startsWith("user:")) {
    return await resolveDirectRoomId(client, target.slice("user:".length));
  }
  if (target.startsWith("@")) {
    return await resolveDirectRoomId(client, target);
  }
  if (target.startsWith("#")) {
    const resolved = await client.resolveRoom(target);
    if (!resolved) {
      throw new Error(`Matrix alias ${target} could not be resolved`);
    }
    return resolved;
  }
  return target;
}
var MAX_DIRECT_ROOM_CACHE_SIZE, directRoomCache;
var init_targets = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/matrix/src/matrix/send/targets.ts"() {
    "use strict";
    init_types();
    MAX_DIRECT_ROOM_CACHE_SIZE = 1024;
    directRoomCache = /* @__PURE__ */ new Map();
  }
});

// vendor/openclaw-runtime/win-x64/extensions/matrix/src/matrix/send.ts
async function sendMessageMatrix(to, message, opts = {}) {
  const trimmedMessage = message?.trim() ?? "";
  if (!trimmedMessage && !opts.mediaUrl) {
    throw new Error("Matrix send requires text or media");
  }
  const { client, stopOnDone } = await resolveMatrixClient({
    client: opts.client,
    timeoutMs: opts.timeoutMs,
    accountId: opts.accountId
  });
  try {
    const roomId = await resolveMatrixRoomId(client, to);
    return await enqueueSend(roomId, async () => {
      const cfg = getCore4().config.loadConfig();
      const tableMode = getCore4().channel.text.resolveMarkdownTableMode({
        cfg,
        channel: "matrix",
        accountId: opts.accountId
      });
      const convertedMessage = getCore4().channel.text.convertMarkdownTables(
        trimmedMessage,
        tableMode
      );
      const textLimit = getCore4().channel.text.resolveTextChunkLimit(cfg, "matrix");
      const chunkLimit = Math.min(textLimit, MATRIX_TEXT_LIMIT);
      const chunkMode = getCore4().channel.text.resolveChunkMode(cfg, "matrix", opts.accountId);
      const chunks = getCore4().channel.text.chunkMarkdownTextWithMode(
        convertedMessage,
        chunkLimit,
        chunkMode
      );
      const threadId = normalizeThreadId(opts.threadId);
      const relation = threadId ? buildThreadRelation(threadId, opts.replyToId) : buildReplyRelation(opts.replyToId);
      const sendContent = async (content) => {
        const eventId = await client.sendMessage(roomId, content);
        return eventId;
      };
      let lastMessageId = "";
      if (opts.mediaUrl) {
        const maxBytes = resolveMediaMaxBytes(opts.accountId);
        const media = await getCore4().media.loadWebMedia(opts.mediaUrl, maxBytes);
        const uploaded = await uploadMediaMaybeEncrypted(client, roomId, media.buffer, {
          contentType: media.contentType,
          filename: media.fileName
        });
        const durationMs = await resolveMediaDurationMs({
          buffer: media.buffer,
          contentType: media.contentType,
          fileName: media.fileName,
          kind: media.kind
        });
        const baseMsgType = resolveMatrixMsgType(media.contentType, media.fileName);
        const { useVoice } = resolveMatrixVoiceDecision({
          wantsVoice: opts.audioAsVoice === true,
          contentType: media.contentType,
          fileName: media.fileName
        });
        const msgtype = useVoice ? MsgType.Audio : baseMsgType;
        const isImage = msgtype === MsgType.Image;
        const imageInfo = isImage ? await prepareImageInfo({ buffer: media.buffer, client }) : void 0;
        const [firstChunk, ...rest] = chunks;
        const body = useVoice ? "Voice message" : firstChunk ?? media.fileName ?? "(file)";
        const content = buildMediaContent({
          msgtype,
          body,
          url: uploaded.url,
          file: uploaded.file,
          filename: media.fileName,
          mimetype: media.contentType,
          size: media.buffer.byteLength,
          durationMs,
          relation,
          isVoice: useVoice,
          imageInfo
        });
        const eventId = await sendContent(content);
        lastMessageId = eventId ?? lastMessageId;
        const textChunks = useVoice ? chunks : rest;
        const followupRelation = threadId ? relation : void 0;
        for (const chunk of textChunks) {
          const text = chunk.trim();
          if (!text) {
            continue;
          }
          const followup = buildTextContent2(text, followupRelation);
          const followupEventId = await sendContent(followup);
          lastMessageId = followupEventId ?? lastMessageId;
        }
      } else {
        for (const chunk of chunks.length ? chunks : [""]) {
          const text = chunk.trim();
          if (!text) {
            continue;
          }
          const content = buildTextContent2(text, relation);
          const eventId = await sendContent(content);
          lastMessageId = eventId ?? lastMessageId;
        }
      }
      return {
        messageId: lastMessageId || "unknown",
        roomId
      };
    });
  } finally {
    if (stopOnDone) {
      client.stop();
    }
  }
}
async function sendPollMatrix(to, poll, opts = {}) {
  if (!poll.question?.trim()) {
    throw new Error("Matrix poll requires a question");
  }
  if (!poll.options?.length) {
    throw new Error("Matrix poll requires options");
  }
  const { client, stopOnDone } = await resolveMatrixClient({
    client: opts.client,
    timeoutMs: opts.timeoutMs,
    accountId: opts.accountId
  });
  try {
    const roomId = await resolveMatrixRoomId(client, to);
    const pollContent = buildPollStartContent(poll);
    const threadId = normalizeThreadId(opts.threadId);
    const pollPayload = threadId ? { ...pollContent, "m.relates_to": buildThreadRelation(threadId) } : pollContent;
    const eventId = await client.sendEvent(roomId, M_POLL_START, pollPayload);
    return {
      eventId: eventId ?? "unknown",
      roomId
    };
  } finally {
    if (stopOnDone) {
      client.stop();
    }
  }
}
async function sendTypingMatrix(roomId, typing, timeoutMs, client) {
  const { client: resolved, stopOnDone } = await resolveMatrixClient({
    client,
    timeoutMs
  });
  try {
    const resolvedTimeoutMs = typeof timeoutMs === "number" ? timeoutMs : 3e4;
    await resolved.setTyping(roomId, typing, resolvedTimeoutMs);
  } finally {
    if (stopOnDone) {
      resolved.stop();
    }
  }
}
async function sendReadReceiptMatrix(roomId, eventId, client) {
  if (!eventId?.trim()) {
    return;
  }
  const { client: resolved, stopOnDone } = await resolveMatrixClient({
    client
  });
  try {
    const resolvedRoom = await resolveMatrixRoomId(resolved, roomId);
    await resolved.sendReadReceipt(resolvedRoom, eventId.trim());
  } finally {
    if (stopOnDone) {
      resolved.stop();
    }
  }
}
async function reactMatrixMessage(roomId, messageId, emoji, client) {
  if (!emoji.trim()) {
    throw new Error("Matrix reaction requires an emoji");
  }
  const { client: resolved, stopOnDone } = await resolveMatrixClient({
    client
  });
  try {
    const resolvedRoom = await resolveMatrixRoomId(resolved, roomId);
    const reaction = {
      "m.relates_to": {
        rel_type: RelationType.Annotation,
        event_id: messageId,
        key: emoji
      }
    };
    await resolved.sendEvent(resolvedRoom, EventType.Reaction, reaction);
  } finally {
    if (stopOnDone) {
      resolved.stop();
    }
  }
}
var MATRIX_TEXT_LIMIT, getCore4;
var init_send = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/matrix/src/matrix/send.ts"() {
    "use strict";
    init_runtime2();
    init_poll_types();
    init_send_queue();
    init_client2();
    init_formatting();
    init_media();
    init_targets();
    init_types();
    init_targets();
    MATRIX_TEXT_LIMIT = 4e3;
    getCore4 = () => getMatrixRuntime();
  }
});

// vendor/openclaw-runtime/win-x64/extensions/matrix/src/matrix/actions/types.ts
var MsgType2, RelationType2, EventType2;
var init_types2 = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/matrix/src/matrix/actions/types.ts"() {
    "use strict";
    MsgType2 = {
      Text: "m.text"
    };
    RelationType2 = {
      Replace: "m.replace",
      Annotation: "m.annotation"
    };
    EventType2 = {
      RoomMessage: "m.room.message",
      RoomPinnedEvents: "m.room.pinned_events",
      RoomTopic: "m.room.topic",
      Reaction: "m.reaction"
    };
  }
});

// vendor/openclaw-runtime/win-x64/extensions/matrix/src/matrix/actions/summary.ts
function summarizeMatrixRawEvent(event) {
  const content = event.content;
  const relates = content["m.relates_to"];
  let relType;
  let eventId;
  if (relates) {
    if ("rel_type" in relates) {
      relType = relates.rel_type;
      eventId = relates.event_id;
    } else if ("m.in_reply_to" in relates) {
      eventId = relates["m.in_reply_to"]?.event_id;
    }
  }
  const relatesTo = relType || eventId ? {
    relType,
    eventId
  } : void 0;
  return {
    eventId: event.event_id,
    sender: event.sender,
    body: content.body,
    msgtype: content.msgtype,
    timestamp: event.origin_server_ts,
    relatesTo
  };
}
async function readPinnedEvents(client, roomId) {
  try {
    const content = await client.getRoomStateEvent(
      roomId,
      EventType2.RoomPinnedEvents,
      ""
    );
    const pinned = content.pinned;
    return pinned.filter((id) => id.trim().length > 0);
  } catch (err) {
    const errObj = err;
    const httpStatus = errObj.statusCode;
    const errcode = errObj.body?.errcode;
    if (httpStatus === 404 || errcode === "M_NOT_FOUND") {
      return [];
    }
    throw err;
  }
}
async function fetchEventSummary(client, roomId, eventId) {
  try {
    const raw = await client.getEvent(roomId, eventId);
    if (raw.unsigned?.redacted_because) {
      return null;
    }
    return summarizeMatrixRawEvent(raw);
  } catch {
    return null;
  }
}
var init_summary = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/matrix/src/matrix/actions/summary.ts"() {
    "use strict";
    init_types2();
  }
});

// vendor/openclaw-runtime/win-x64/extensions/matrix/src/directory-live.ts
async function fetchMatrixJson(params) {
  const res = await fetch(`${params.homeserver}${params.path}`, {
    method: params.method ?? "GET",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json"
    },
    body: params.body ? JSON.stringify(params.body) : void 0
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Matrix API ${params.path} failed (${res.status}): ${text || "unknown error"}`);
  }
  return await res.json();
}
function normalizeQuery(value) {
  return value?.trim().toLowerCase() ?? "";
}
function resolveMatrixDirectoryLimit(limit) {
  return typeof limit === "number" && limit > 0 ? limit : 20;
}
async function resolveMatrixDirectoryContext(params) {
  const query = normalizeQuery(params.query);
  if (!query) {
    return null;
  }
  const auth = await resolveMatrixAuth({ cfg: params.cfg, accountId: params.accountId });
  return { query, auth };
}
function createGroupDirectoryEntry(params) {
  return {
    kind: "group",
    id: params.id,
    name: params.name,
    handle: params.handle
  };
}
async function listMatrixDirectoryPeersLive(params) {
  const context = await resolveMatrixDirectoryContext(params);
  if (!context) {
    return [];
  }
  const { query, auth } = context;
  const res = await fetchMatrixJson({
    homeserver: auth.homeserver,
    accessToken: auth.accessToken,
    path: "/_matrix/client/v3/user_directory/search",
    method: "POST",
    body: {
      search_term: query,
      limit: resolveMatrixDirectoryLimit(params.limit)
    }
  });
  const results = res.results ?? [];
  return results.map((entry) => {
    const userId = entry.user_id?.trim();
    if (!userId) {
      return null;
    }
    return {
      kind: "user",
      id: userId,
      name: entry.display_name?.trim() || void 0,
      handle: entry.display_name ? `@${entry.display_name.trim()}` : void 0,
      raw: entry
    };
  }).filter(Boolean);
}
async function resolveMatrixRoomAlias(homeserver, accessToken, alias) {
  try {
    const res = await fetchMatrixJson({
      homeserver,
      accessToken,
      path: `/_matrix/client/v3/directory/room/${encodeURIComponent(alias)}`
    });
    return res.room_id?.trim() || null;
  } catch {
    return null;
  }
}
async function fetchMatrixRoomName(homeserver, accessToken, roomId) {
  try {
    const res = await fetchMatrixJson({
      homeserver,
      accessToken,
      path: `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/state/m.room.name`
    });
    return res.name?.trim() || null;
  } catch {
    return null;
  }
}
async function listMatrixDirectoryGroupsLive(params) {
  const context = await resolveMatrixDirectoryContext(params);
  if (!context) {
    return [];
  }
  const { query, auth } = context;
  const limit = resolveMatrixDirectoryLimit(params.limit);
  if (query.startsWith("#")) {
    const roomId = await resolveMatrixRoomAlias(auth.homeserver, auth.accessToken, query);
    if (!roomId) {
      return [];
    }
    return [createGroupDirectoryEntry({ id: roomId, name: query, handle: query })];
  }
  if (query.startsWith("!")) {
    const originalId = params.query?.trim() ?? query;
    return [createGroupDirectoryEntry({ id: originalId, name: originalId })];
  }
  const joined = await fetchMatrixJson({
    homeserver: auth.homeserver,
    accessToken: auth.accessToken,
    path: "/_matrix/client/v3/joined_rooms"
  });
  const rooms = joined.joined_rooms ?? [];
  const results = [];
  for (const roomId of rooms) {
    const name = await fetchMatrixRoomName(auth.homeserver, auth.accessToken, roomId);
    if (!name) {
      continue;
    }
    if (!name.toLowerCase().includes(query)) {
      continue;
    }
    results.push({
      kind: "group",
      id: roomId,
      name,
      handle: `#${name}`
    });
    if (results.length >= limit) {
      break;
    }
  }
  return results;
}
var init_directory_live = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/matrix/src/directory-live.ts"() {
    "use strict";
    init_client();
  }
});

// vendor/openclaw-runtime/win-x64/extensions/matrix/src/matrix/monitor/rooms.ts
import { buildChannelKeyCandidates, resolveChannelEntryMatch } from "openclaw/plugin-sdk";
function resolveMatrixRoomConfig(params) {
  const rooms = params.rooms ?? {};
  const keys = Object.keys(rooms);
  const allowlistConfigured = keys.length > 0;
  const candidates = buildChannelKeyCandidates(
    params.roomId,
    `room:${params.roomId}`,
    ...params.aliases
  );
  const {
    entry: matched,
    key: matchedKey,
    wildcardEntry,
    wildcardKey
  } = resolveChannelEntryMatch({
    entries: rooms,
    keys: candidates,
    wildcardKey: "*"
  });
  const resolved = matched ?? wildcardEntry;
  const allowed = resolved ? resolved.enabled !== false && resolved.allow !== false : false;
  const matchKey = matchedKey ?? wildcardKey;
  const matchSource = matched ? "direct" : wildcardEntry ? "wildcard" : void 0;
  return {
    allowed,
    allowlistConfigured,
    config: resolved,
    matchKey,
    matchSource
  };
}
var init_rooms = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/matrix/src/matrix/monitor/rooms.ts"() {
    "use strict";
  }
});

// vendor/openclaw-runtime/win-x64/extensions/matrix/src/matrix/monitor/allowlist.ts
import { resolveAllowlistMatchByCandidates } from "openclaw/plugin-sdk";
function normalizeAllowList(list) {
  return (list ?? []).map((entry) => String(entry).trim()).filter(Boolean);
}
function normalizeMatrixUser(raw) {
  const value = (raw ?? "").trim();
  if (!value) {
    return "";
  }
  if (!value.startsWith("@") || !value.includes(":")) {
    return value.toLowerCase();
  }
  const withoutAt = value.slice(1);
  const splitIndex = withoutAt.indexOf(":");
  if (splitIndex === -1) {
    return value.toLowerCase();
  }
  const localpart = withoutAt.slice(0, splitIndex).toLowerCase();
  const server = withoutAt.slice(splitIndex + 1).toLowerCase();
  if (!server) {
    return value.toLowerCase();
  }
  return `@${localpart}:${server.toLowerCase()}`;
}
function normalizeMatrixUserId(raw) {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) {
    return "";
  }
  const lowered = trimmed.toLowerCase();
  if (lowered.startsWith("matrix:")) {
    return normalizeMatrixUser(trimmed.slice("matrix:".length));
  }
  if (lowered.startsWith("user:")) {
    return normalizeMatrixUser(trimmed.slice("user:".length));
  }
  return normalizeMatrixUser(trimmed);
}
function normalizeMatrixAllowListEntry(raw) {
  const trimmed = raw.trim();
  if (!trimmed) {
    return "";
  }
  if (trimmed === "*") {
    return trimmed;
  }
  const lowered = trimmed.toLowerCase();
  if (lowered.startsWith("matrix:")) {
    return `matrix:${normalizeMatrixUser(trimmed.slice("matrix:".length))}`;
  }
  if (lowered.startsWith("user:")) {
    return `user:${normalizeMatrixUser(trimmed.slice("user:".length))}`;
  }
  return normalizeMatrixUser(trimmed);
}
function normalizeMatrixAllowList(list) {
  return normalizeAllowList(list).map((entry) => normalizeMatrixAllowListEntry(entry));
}
function resolveMatrixAllowListMatch(params) {
  const allowList = params.allowList;
  if (allowList.length === 0) {
    return { allowed: false };
  }
  if (allowList.includes("*")) {
    return { allowed: true, matchKey: "*", matchSource: "wildcard" };
  }
  const userId = normalizeMatrixUser(params.userId);
  const candidates = [
    { value: userId, source: "id" },
    { value: userId ? `matrix:${userId}` : "", source: "prefixed-id" },
    { value: userId ? `user:${userId}` : "", source: "prefixed-user" }
  ];
  return resolveAllowlistMatchByCandidates({ allowList, candidates });
}
function resolveMatrixAllowListMatches(params) {
  return resolveMatrixAllowListMatch(params).allowed;
}
var init_allowlist = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/matrix/src/matrix/monitor/allowlist.ts"() {
    "use strict";
  }
});

// vendor/openclaw-runtime/win-x64/extensions/matrix/src/matrix/probe.ts
async function probeMatrix(params) {
  const started = Date.now();
  const result = {
    ok: false,
    status: null,
    error: null,
    elapsedMs: 0
  };
  if (isBunRuntime()) {
    return {
      ...result,
      error: "Matrix probe requires Node (bun runtime not supported)",
      elapsedMs: Date.now() - started
    };
  }
  if (!params.homeserver?.trim()) {
    return {
      ...result,
      error: "missing homeserver",
      elapsedMs: Date.now() - started
    };
  }
  if (!params.accessToken?.trim()) {
    return {
      ...result,
      error: "missing access token",
      elapsedMs: Date.now() - started
    };
  }
  try {
    const client = await createMatrixClient({
      homeserver: params.homeserver,
      userId: params.userId ?? "",
      accessToken: params.accessToken,
      localTimeoutMs: params.timeoutMs
    });
    const userId = await client.getUserId();
    result.ok = true;
    result.userId = userId ?? null;
    result.elapsedMs = Date.now() - started;
    return result;
  } catch (err) {
    return {
      ...result,
      status: typeof err === "object" && err && "statusCode" in err ? Number(err.statusCode) : result.status,
      error: err instanceof Error ? err.message : String(err),
      elapsedMs: Date.now() - started
    };
  }
}
var init_probe = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/matrix/src/matrix/probe.ts"() {
    "use strict";
    init_client();
  }
});

// vendor/openclaw-runtime/win-x64/extensions/matrix/src/resolve-targets.ts
function findExactDirectoryMatches(matches, query) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return [];
  }
  return matches.filter((match) => {
    const id = match.id.trim().toLowerCase();
    const name = match.name?.trim().toLowerCase();
    const handle = match.handle?.trim().toLowerCase();
    return normalized === id || normalized === name || normalized === handle;
  });
}
function pickBestGroupMatch(matches, query) {
  if (matches.length === 0) {
    return void 0;
  }
  const [exact] = findExactDirectoryMatches(matches, query);
  return exact ?? matches[0];
}
function pickBestUserMatch(matches, query) {
  if (matches.length === 0) {
    return void 0;
  }
  const exact = findExactDirectoryMatches(matches, query);
  if (exact.length === 1) {
    return exact[0];
  }
  return void 0;
}
function describeUserMatchFailure(matches, query) {
  if (matches.length === 0) {
    return "no matches";
  }
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return "empty input";
  }
  const exact = findExactDirectoryMatches(matches, normalized);
  if (exact.length === 0) {
    return "no exact match; use full Matrix ID";
  }
  if (exact.length > 1) {
    return "multiple exact matches; use full Matrix ID";
  }
  return "no exact match; use full Matrix ID";
}
async function resolveMatrixTargets(params) {
  const results = [];
  for (const input of params.inputs) {
    const trimmed = input.trim();
    if (!trimmed) {
      results.push({ input, resolved: false, note: "empty input" });
      continue;
    }
    if (params.kind === "user") {
      if (trimmed.startsWith("@") && trimmed.includes(":")) {
        results.push({ input, resolved: true, id: trimmed });
        continue;
      }
      try {
        const matches = await listMatrixDirectoryPeersLive({
          cfg: params.cfg,
          query: trimmed,
          limit: 5
        });
        const best = pickBestUserMatch(matches, trimmed);
        results.push({
          input,
          resolved: Boolean(best?.id),
          id: best?.id,
          name: best?.name,
          note: best ? void 0 : describeUserMatchFailure(matches, trimmed)
        });
      } catch (err) {
        params.runtime?.error?.(`matrix resolve failed: ${String(err)}`);
        results.push({ input, resolved: false, note: "lookup failed" });
      }
      continue;
    }
    try {
      const matches = await listMatrixDirectoryGroupsLive({
        cfg: params.cfg,
        query: trimmed,
        limit: 5
      });
      const best = pickBestGroupMatch(matches, trimmed);
      results.push({
        input,
        resolved: Boolean(best?.id),
        id: best?.id,
        name: best?.name,
        note: matches.length > 1 ? "multiple matches; chose first" : void 0
      });
    } catch (err) {
      params.runtime?.error?.(`matrix resolve failed: ${String(err)}`);
      results.push({ input, resolved: false, note: "lookup failed" });
    }
  }
  return results;
}
var init_resolve_targets = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/matrix/src/resolve-targets.ts"() {
    "use strict";
    init_directory_live();
  }
});

// vendor/openclaw-runtime/win-x64/extensions/matrix/src/matrix/monitor/auto-join.ts
function registerMatrixAutoJoin(params) {
  const { client, cfg, runtime: runtime2 } = params;
  const core = getMatrixRuntime();
  const logVerbose = (message) => {
    if (!core.logging.shouldLogVerbose()) {
      return;
    }
    runtime2.log?.(message);
  };
  const autoJoin = cfg.channels?.matrix?.autoJoin ?? "always";
  const autoJoinAllowlist = cfg.channels?.matrix?.autoJoinAllowlist ?? [];
  if (autoJoin === "off") {
    return;
  }
  if (autoJoin === "always") {
    const { AutojoinRoomsMixin } = loadMatrixSdk();
    AutojoinRoomsMixin.setupOnClient(client);
    logVerbose("matrix: auto-join enabled for all invites");
    return;
  }
  client.on("room.invite", async (roomId, _inviteEvent) => {
    if (autoJoin !== "allowlist") {
      return;
    }
    let alias;
    let altAliases = [];
    try {
      const aliasState = await client.getRoomStateEvent(roomId, "m.room.canonical_alias", "").catch(() => null);
      alias = aliasState?.alias;
      altAliases = Array.isArray(aliasState?.alt_aliases) ? aliasState.alt_aliases : [];
    } catch {
    }
    const allowed = autoJoinAllowlist.includes("*") || autoJoinAllowlist.includes(roomId) || (alias ? autoJoinAllowlist.includes(alias) : false) || altAliases.some((value) => autoJoinAllowlist.includes(value));
    if (!allowed) {
      logVerbose(`matrix: invite ignored (not in allowlist) room=${roomId}`);
      return;
    }
    try {
      await client.joinRoom(roomId);
      logVerbose(`matrix: joined room ${roomId}`);
    } catch (err) {
      runtime2.error?.(`matrix: failed to join room ${roomId}: ${String(err)}`);
    }
  });
}
var init_auto_join = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/matrix/src/matrix/monitor/auto-join.ts"() {
    "use strict";
    init_runtime2();
    init_sdk_runtime();
  }
});

// vendor/openclaw-runtime/win-x64/extensions/matrix/src/matrix/monitor/direct.ts
function createDirectRoomTracker(client, opts = {}) {
  const log = opts.log ?? (() => {
  });
  const includeMemberCountInLogs = opts.includeMemberCountInLogs === true;
  let lastDmUpdateMs = 0;
  let cachedSelfUserId = null;
  const memberCountCache = includeMemberCountInLogs ? /* @__PURE__ */ new Map() : void 0;
  const ensureSelfUserId = async () => {
    if (cachedSelfUserId) {
      return cachedSelfUserId;
    }
    try {
      cachedSelfUserId = await client.getUserId();
    } catch {
      cachedSelfUserId = null;
    }
    return cachedSelfUserId;
  };
  const refreshDmCache = async () => {
    const now = Date.now();
    if (now - lastDmUpdateMs < DM_CACHE_TTL_MS) {
      return;
    }
    lastDmUpdateMs = now;
    try {
      await client.dms.update();
    } catch (err) {
      log(`matrix: dm cache refresh failed (${String(err)})`);
    }
  };
  const resolveMemberCount = async (roomId) => {
    if (!memberCountCache) {
      return null;
    }
    const cached = memberCountCache.get(roomId);
    const now = Date.now();
    if (cached && now - cached.ts < DM_CACHE_TTL_MS) {
      return cached.count;
    }
    try {
      const members = await client.getJoinedRoomMembers(roomId);
      const count = members.length;
      memberCountCache.set(roomId, { count, ts: now });
      return count;
    } catch (err) {
      log(`matrix: dm member count failed room=${roomId} (${String(err)})`);
      return null;
    }
  };
  const hasDirectFlag = async (roomId, userId) => {
    const target = userId?.trim();
    if (!target) {
      return false;
    }
    try {
      const state = await client.getRoomStateEvent(roomId, "m.room.member", target);
      return state?.is_direct === true;
    } catch {
      return false;
    }
  };
  return {
    isDirectMessage: async (params) => {
      const { roomId, senderId } = params;
      await refreshDmCache();
      if (client.dms.isDm(roomId)) {
        log(`matrix: dm detected via m.direct room=${roomId}`);
        return true;
      }
      const selfUserId = params.selfUserId ?? await ensureSelfUserId();
      const directViaState = await hasDirectFlag(roomId, senderId) || await hasDirectFlag(roomId, selfUserId ?? "");
      if (directViaState) {
        log(`matrix: dm detected via member state room=${roomId}`);
        return true;
      }
      if (!includeMemberCountInLogs) {
        log(`matrix: dm check room=${roomId} result=group`);
        return false;
      }
      const memberCount = await resolveMemberCount(roomId);
      log(`matrix: dm check room=${roomId} result=group members=${memberCount ?? "unknown"}`);
      return false;
    }
  };
}
var DM_CACHE_TTL_MS;
var init_direct = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/matrix/src/matrix/monitor/direct.ts"() {
    "use strict";
    DM_CACHE_TTL_MS = 3e4;
  }
});

// vendor/openclaw-runtime/win-x64/extensions/matrix/src/matrix/monitor/types.ts
var EventType3, RelationType3;
var init_types3 = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/matrix/src/matrix/monitor/types.ts"() {
    "use strict";
    EventType3 = {
      RoomMessage: "m.room.message",
      RoomMessageEncrypted: "m.room.encrypted",
      RoomMember: "m.room.member",
      Location: "m.location"
    };
    RelationType3 = {
      Replace: "m.replace",
      Thread: "m.thread"
    };
  }
});

// vendor/openclaw-runtime/win-x64/extensions/matrix/src/matrix/monitor/events.ts
function createSelfUserIdResolver(client) {
  let selfUserId;
  let selfUserIdLookup;
  return async () => {
    if (selfUserId) {
      return selfUserId;
    }
    if (!selfUserIdLookup) {
      selfUserIdLookup = client.getUserId().then((userId) => {
        selfUserId = userId;
        return userId;
      }).catch(() => void 0).finally(() => {
        if (!selfUserId) {
          selfUserIdLookup = void 0;
        }
      });
    }
    return await selfUserIdLookup;
  };
}
function registerMatrixMonitorEvents(params) {
  if (!matrixMonitorListenerRegistry.tryRegister(params.client)) {
    params.logVerboseMessage("matrix: skipping duplicate listener registration for client");
    return;
  }
  const {
    client,
    auth,
    logVerboseMessage,
    warnedEncryptedRooms,
    warnedCryptoMissingRooms,
    logger,
    formatNativeDependencyHint,
    onRoomMessage
  } = params;
  const resolveSelfUserId = createSelfUserIdResolver(client);
  client.on("room.message", (roomId, event) => {
    const eventId = event?.event_id;
    const senderId = event?.sender;
    if (eventId && senderId) {
      void (async () => {
        const currentSelfUserId = await resolveSelfUserId();
        if (!currentSelfUserId || senderId === currentSelfUserId) {
          return;
        }
        await sendReadReceiptMatrix(roomId, eventId, client).catch((err) => {
          logVerboseMessage(
            `matrix: early read receipt failed room=${roomId} id=${eventId}: ${String(err)}`
          );
        });
      })();
    }
    onRoomMessage(roomId, event);
  });
  client.on("room.encrypted_event", (roomId, event) => {
    const eventId = event?.event_id ?? "unknown";
    const eventType = event?.type ?? "unknown";
    logVerboseMessage(`matrix: encrypted event room=${roomId} type=${eventType} id=${eventId}`);
  });
  client.on("room.decrypted_event", (roomId, event) => {
    const eventId = event?.event_id ?? "unknown";
    const eventType = event?.type ?? "unknown";
    logVerboseMessage(`matrix: decrypted event room=${roomId} type=${eventType} id=${eventId}`);
  });
  client.on(
    "room.failed_decryption",
    async (roomId, event, error) => {
      logger.warn("Failed to decrypt message", {
        roomId,
        eventId: event.event_id,
        error: error.message
      });
      logVerboseMessage(
        `matrix: failed decrypt room=${roomId} id=${event.event_id ?? "unknown"} error=${error.message}`
      );
    }
  );
  client.on("room.invite", (roomId, event) => {
    const eventId = event?.event_id ?? "unknown";
    const sender = event?.sender ?? "unknown";
    const isDirect = event?.content?.is_direct === true;
    logVerboseMessage(
      `matrix: invite room=${roomId} sender=${sender} direct=${String(isDirect)} id=${eventId}`
    );
  });
  client.on("room.join", (roomId, event) => {
    const eventId = event?.event_id ?? "unknown";
    logVerboseMessage(`matrix: join room=${roomId} id=${eventId}`);
  });
  client.on("room.event", (roomId, event) => {
    const eventType = event?.type ?? "unknown";
    if (eventType === EventType3.RoomMessageEncrypted) {
      logVerboseMessage(
        `matrix: encrypted raw event room=${roomId} id=${event?.event_id ?? "unknown"}`
      );
      if (auth.encryption !== true && !warnedEncryptedRooms.has(roomId)) {
        warnedEncryptedRooms.add(roomId);
        const warning = "matrix: encrypted event received without encryption enabled; set channels.matrix.encryption=true and verify the device to decrypt";
        logger.warn(warning, { roomId });
      }
      if (auth.encryption === true && !client.crypto && !warnedCryptoMissingRooms.has(roomId)) {
        warnedCryptoMissingRooms.add(roomId);
        const hint = formatNativeDependencyHint({
          packageName: "@matrix-org/matrix-sdk-crypto-nodejs",
          manager: "pnpm",
          downloadCommand: "node node_modules/@matrix-org/matrix-sdk-crypto-nodejs/download-lib.js"
        });
        const warning = `matrix: encryption enabled but crypto is unavailable; ${hint}`;
        logger.warn(warning, { roomId });
      }
      return;
    }
    if (eventType === EventType3.RoomMember) {
      const membership = event?.content?.membership;
      const stateKey = event.state_key ?? "";
      logVerboseMessage(
        `matrix: member event room=${roomId} stateKey=${stateKey} membership=${membership ?? "unknown"}`
      );
    }
  });
}
var matrixMonitorListenerRegistry;
var init_events = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/matrix/src/matrix/monitor/events.ts"() {
    "use strict";
    init_send();
    init_types3();
    matrixMonitorListenerRegistry = /* @__PURE__ */ (() => {
      const registeredClients = /* @__PURE__ */ new WeakSet();
      return {
        tryRegister(client) {
          if (registeredClients.has(client)) {
            return false;
          }
          registeredClients.add(client);
          return true;
        }
      };
    })();
  }
});

// vendor/openclaw-runtime/win-x64/extensions/matrix/src/matrix/monitor/access-policy.ts
import {
  formatAllowlistMatchMeta,
  issuePairingChallenge,
  readStoreAllowFromForDmPolicy,
  resolveDmGroupAccessWithLists
} from "openclaw/plugin-sdk";
async function resolveMatrixAccessState(params) {
  const storeAllowFrom = params.isDirectMessage ? await readStoreAllowFromForDmPolicy({
    provider: "matrix",
    accountId: params.resolvedAccountId,
    dmPolicy: params.dmPolicy,
    readStore: params.readStoreForDmPolicy
  }) : [];
  const normalizedGroupAllowFrom = normalizeMatrixAllowList(params.groupAllowFrom);
  const senderGroupPolicy = params.groupPolicy === "disabled" ? "disabled" : normalizedGroupAllowFrom.length > 0 ? "allowlist" : "open";
  const access = resolveDmGroupAccessWithLists({
    isGroup: !params.isDirectMessage,
    dmPolicy: params.dmPolicy,
    groupPolicy: senderGroupPolicy,
    allowFrom: params.allowFrom,
    groupAllowFrom: normalizedGroupAllowFrom,
    storeAllowFrom,
    groupAllowFromFallbackToAllowFrom: false,
    isSenderAllowed: (allowFrom) => resolveMatrixAllowListMatches({
      allowList: normalizeMatrixAllowList(allowFrom),
      userId: params.senderId
    })
  });
  const effectiveAllowFrom = normalizeMatrixAllowList(access.effectiveAllowFrom);
  const effectiveGroupAllowFrom = normalizeMatrixAllowList(access.effectiveGroupAllowFrom);
  return {
    access,
    effectiveAllowFrom,
    effectiveGroupAllowFrom,
    groupAllowConfigured: effectiveGroupAllowFrom.length > 0
  };
}
async function enforceMatrixDirectMessageAccess(params) {
  if (!params.dmEnabled) {
    return false;
  }
  if (params.accessDecision === "allow") {
    return true;
  }
  const allowMatch = resolveMatrixAllowListMatch({
    allowList: params.effectiveAllowFrom,
    userId: params.senderId
  });
  const allowMatchMeta = formatAllowlistMatchMeta(allowMatch);
  if (params.accessDecision === "pairing") {
    await issuePairingChallenge({
      channel: "matrix",
      senderId: params.senderId,
      senderIdLine: `Matrix user id: ${params.senderId}`,
      meta: { name: params.senderName },
      upsertPairingRequest: params.upsertPairingRequest,
      buildReplyText: ({ code }) => [
        "OpenClaw: access not configured.",
        "",
        `Pairing code: ${code}`,
        "",
        "Ask the bot owner to approve with:",
        "openclaw pairing approve matrix <code>"
      ].join("\n"),
      sendPairingReply: params.sendPairingReply,
      onCreated: () => {
        params.logVerboseMessage(
          `matrix pairing request sender=${params.senderId} name=${params.senderName ?? "unknown"} (${allowMatchMeta})`
        );
      },
      onReplyError: (err) => {
        params.logVerboseMessage(
          `matrix pairing reply failed for ${params.senderId}: ${String(err)}`
        );
      }
    });
    return false;
  }
  params.logVerboseMessage(
    `matrix: blocked dm sender ${params.senderId} (dmPolicy=${params.dmPolicy}, ${allowMatchMeta})`
  );
  return false;
}
var init_access_policy = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/matrix/src/matrix/monitor/access-policy.ts"() {
    "use strict";
    init_allowlist();
  }
});

// vendor/openclaw-runtime/win-x64/extensions/matrix/src/matrix/monitor/inbound-body.ts
function resolveMatrixSenderUsername(senderId) {
  const username = senderId.split(":")[0]?.replace(/^@/, "").trim();
  return username ? username : void 0;
}
function resolveMatrixInboundSenderLabel(params) {
  const senderName = params.senderName.trim();
  const senderUsername = params.senderUsername ?? resolveMatrixSenderUsername(params.senderId);
  if (senderName && senderUsername && senderName !== senderUsername) {
    return `${senderName} (${senderUsername})`;
  }
  return senderName || senderUsername || params.senderId;
}
function resolveMatrixBodyForAgent(params) {
  if (params.isDirectMessage) {
    return params.bodyText;
  }
  return `${params.senderLabel}: ${params.bodyText}`;
}
var init_inbound_body = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/matrix/src/matrix/monitor/inbound-body.ts"() {
    "use strict";
  }
});

// vendor/openclaw-runtime/win-x64/extensions/matrix/src/matrix/monitor/location.ts
import {
  formatLocationText,
  toLocationContext
} from "openclaw/plugin-sdk";
function parseGeoUri(value) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (!trimmed.toLowerCase().startsWith("geo:")) {
    return null;
  }
  const payload = trimmed.slice(4);
  const [coordsPart, ...paramParts] = payload.split(";");
  const coords = coordsPart.split(",");
  if (coords.length < 2) {
    return null;
  }
  const latitude = Number.parseFloat(coords[0] ?? "");
  const longitude = Number.parseFloat(coords[1] ?? "");
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }
  const params = /* @__PURE__ */ new Map();
  for (const part of paramParts) {
    const segment = part.trim();
    if (!segment) {
      continue;
    }
    const eqIndex = segment.indexOf("=");
    const rawKey = eqIndex === -1 ? segment : segment.slice(0, eqIndex);
    const rawValue = eqIndex === -1 ? "" : segment.slice(eqIndex + 1);
    const key = rawKey.trim().toLowerCase();
    if (!key) {
      continue;
    }
    const valuePart = rawValue.trim();
    params.set(key, valuePart ? decodeURIComponent(valuePart) : "");
  }
  const accuracyRaw = params.get("u");
  const accuracy = accuracyRaw ? Number.parseFloat(accuracyRaw) : void 0;
  return {
    latitude,
    longitude,
    accuracy: Number.isFinite(accuracy) ? accuracy : void 0
  };
}
function resolveMatrixLocation(params) {
  const { eventType, content } = params;
  const isLocation = eventType === EventType3.Location || eventType === EventType3.RoomMessage && content.msgtype === EventType3.Location;
  if (!isLocation) {
    return null;
  }
  const geoUri = typeof content.geo_uri === "string" ? content.geo_uri.trim() : "";
  if (!geoUri) {
    return null;
  }
  const parsed = parseGeoUri(geoUri);
  if (!parsed) {
    return null;
  }
  const caption = typeof content.body === "string" ? content.body.trim() : "";
  const location = {
    latitude: parsed.latitude,
    longitude: parsed.longitude,
    accuracy: parsed.accuracy,
    caption: caption || void 0,
    source: "pin",
    isLive: false
  };
  return {
    text: formatLocationText(location),
    context: toLocationContext(location)
  };
}
var init_location = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/matrix/src/matrix/monitor/location.ts"() {
    "use strict";
    init_types3();
  }
});

// vendor/openclaw-runtime/win-x64/extensions/matrix/src/matrix/monitor/media.ts
async function fetchMatrixMediaBuffer(params) {
  const url = params.client.mxcToHttp(params.mxcUrl);
  if (!url) {
    return null;
  }
  try {
    const result = await params.client.downloadContent(params.mxcUrl);
    const raw = result.data ?? result;
    const buffer = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
    if (buffer.byteLength > params.maxBytes) {
      throw new Error("Matrix media exceeds configured size limit");
    }
    return { buffer, headerType: result.contentType };
  } catch (err) {
    throw new Error(`Matrix media download failed: ${String(err)}`, { cause: err });
  }
}
async function fetchEncryptedMediaBuffer(params) {
  if (!params.client.crypto) {
    throw new Error("Cannot decrypt media: crypto not enabled");
  }
  const decrypted = await params.client.crypto.decryptMedia(
    params.file
  );
  if (decrypted.byteLength > params.maxBytes) {
    throw new Error("Matrix media exceeds configured size limit");
  }
  return { buffer: decrypted };
}
async function downloadMatrixMedia(params) {
  let fetched;
  if (typeof params.sizeBytes === "number" && params.sizeBytes > params.maxBytes) {
    throw new Error("Matrix media exceeds configured size limit");
  }
  if (params.file) {
    fetched = await fetchEncryptedMediaBuffer({
      client: params.client,
      file: params.file,
      maxBytes: params.maxBytes
    });
  } else {
    fetched = await fetchMatrixMediaBuffer({
      client: params.client,
      mxcUrl: params.mxcUrl,
      maxBytes: params.maxBytes
    });
  }
  if (!fetched) {
    return null;
  }
  const headerType = fetched.headerType ?? params.contentType ?? void 0;
  const saved = await getMatrixRuntime().channel.media.saveMediaBuffer(
    fetched.buffer,
    headerType,
    "inbound",
    params.maxBytes
  );
  return {
    path: saved.path,
    contentType: saved.contentType,
    placeholder: "[matrix media]"
  };
}
var init_media2 = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/matrix/src/matrix/monitor/media.ts"() {
    "use strict";
    init_runtime2();
  }
});

// vendor/openclaw-runtime/win-x64/extensions/matrix/src/matrix/monitor/mentions.ts
function checkFormattedBodyMention(formattedBody, userId) {
  if (!formattedBody || !userId) {
    return false;
  }
  const escapedUserId = userId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const plainPattern = new RegExp(`href=["']https://matrix\\.to/#/${escapedUserId}["']`, "i");
  if (plainPattern.test(formattedBody)) {
    return true;
  }
  const encodedUserId = encodeURIComponent(userId).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const encodedPattern = new RegExp(`href=["']https://matrix\\.to/#/${encodedUserId}["']`, "i");
  return encodedPattern.test(formattedBody);
}
function resolveMentions(params) {
  const mentions = params.content["m.mentions"];
  const mentionedUsers = Array.isArray(mentions?.user_ids) ? new Set(mentions.user_ids) : /* @__PURE__ */ new Set();
  const mentionedInFormattedBody = params.userId ? checkFormattedBodyMention(params.content.formatted_body, params.userId) : false;
  const wasMentioned = Boolean(mentions?.room) || (params.userId ? mentionedUsers.has(params.userId) : false) || mentionedInFormattedBody || getMatrixRuntime().channel.mentions.matchesMentionPatterns(
    params.text ?? "",
    params.mentionRegexes
  );
  return { wasMentioned, hasExplicitMention: Boolean(mentions) };
}
var init_mentions = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/matrix/src/matrix/monitor/mentions.ts"() {
    "use strict";
    init_runtime2();
  }
});

// vendor/openclaw-runtime/win-x64/extensions/matrix/src/matrix/monitor/replies.ts
async function deliverMatrixReplies(params) {
  const core = getMatrixRuntime();
  const cfg = core.config.loadConfig();
  const tableMode = params.tableMode ?? core.channel.text.resolveMarkdownTableMode({
    cfg,
    channel: "matrix",
    accountId: params.accountId
  });
  const logVerbose = (message) => {
    if (core.logging.shouldLogVerbose()) {
      params.runtime.log?.(message);
    }
  };
  const chunkLimit = Math.min(params.textLimit, 4e3);
  const chunkMode = core.channel.text.resolveChunkMode(cfg, "matrix", params.accountId);
  let hasReplied = false;
  for (const reply of params.replies) {
    const hasMedia = Boolean(reply?.mediaUrl) || (reply?.mediaUrls?.length ?? 0) > 0;
    if (!reply?.text && !hasMedia) {
      if (reply?.audioAsVoice) {
        logVerbose("matrix reply has audioAsVoice without media/text; skipping");
        continue;
      }
      params.runtime.error?.("matrix reply missing text/media");
      continue;
    }
    if (reply.text && isReasoningOnlyMessage(reply.text)) {
      logVerbose("matrix reply is reasoning-only; skipping");
      continue;
    }
    const replyToIdRaw = reply.replyToId?.trim();
    const replyToId = params.threadId || params.replyToMode === "off" ? void 0 : replyToIdRaw;
    const rawText = reply.text ?? "";
    const text = core.channel.text.convertMarkdownTables(rawText, tableMode);
    const mediaList = reply.mediaUrls?.length ? reply.mediaUrls : reply.mediaUrl ? [reply.mediaUrl] : [];
    const shouldIncludeReply = (id) => Boolean(id) && (params.replyToMode === "all" || !hasReplied);
    const replyToIdForReply = shouldIncludeReply(replyToId) ? replyToId : void 0;
    if (mediaList.length === 0) {
      let sentTextChunk = false;
      for (const chunk of core.channel.text.chunkMarkdownTextWithMode(
        text,
        chunkLimit,
        chunkMode
      )) {
        const trimmed = chunk.trim();
        if (!trimmed) {
          continue;
        }
        await sendMessageMatrix(params.roomId, trimmed, {
          client: params.client,
          replyToId: replyToIdForReply,
          threadId: params.threadId,
          accountId: params.accountId
        });
        sentTextChunk = true;
      }
      if (replyToIdForReply && !hasReplied && sentTextChunk) {
        hasReplied = true;
      }
      continue;
    }
    let first = true;
    for (const mediaUrl of mediaList) {
      const caption = first ? text : "";
      await sendMessageMatrix(params.roomId, caption, {
        client: params.client,
        mediaUrl,
        replyToId: replyToIdForReply,
        threadId: params.threadId,
        audioAsVoice: reply.audioAsVoice,
        accountId: params.accountId
      });
      first = false;
    }
    if (replyToIdForReply && !hasReplied) {
      hasReplied = true;
    }
  }
}
function isReasoningOnlyMessage(text) {
  const trimmed = text.trim();
  if (trimmed.startsWith(REASONING_PREFIX)) {
    return true;
  }
  if (THINKING_TAG_RE.test(trimmed)) {
    return true;
  }
  return false;
}
var REASONING_PREFIX, THINKING_TAG_RE;
var init_replies = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/matrix/src/matrix/monitor/replies.ts"() {
    "use strict";
    init_runtime2();
    init_send();
    REASONING_PREFIX = "Reasoning:\n";
    THINKING_TAG_RE = /^\s*<\s*(?:think(?:ing)?|thought|antthinking)\b/i;
  }
});

// vendor/openclaw-runtime/win-x64/extensions/matrix/src/matrix/monitor/threads.ts
function resolveMatrixThreadTarget(params) {
  const { threadReplies, messageId, threadRootId } = params;
  if (threadReplies === "off") {
    return void 0;
  }
  const isThreadRoot = params.isThreadRoot === true;
  const hasInboundThread = Boolean(threadRootId && threadRootId !== messageId && !isThreadRoot);
  if (threadReplies === "inbound") {
    return hasInboundThread ? threadRootId : void 0;
  }
  if (threadReplies === "always") {
    return threadRootId ?? messageId;
  }
  return void 0;
}
function resolveMatrixThreadRootId(params) {
  const relates = params.content["m.relates_to"];
  if (!relates || typeof relates !== "object") {
    return void 0;
  }
  if ("rel_type" in relates && relates.rel_type === RelationType4.Thread) {
    if ("event_id" in relates && typeof relates.event_id === "string") {
      return relates.event_id;
    }
    if ("m.in_reply_to" in relates && typeof relates["m.in_reply_to"] === "object" && relates["m.in_reply_to"] && "event_id" in relates["m.in_reply_to"] && typeof relates["m.in_reply_to"].event_id === "string") {
      return relates["m.in_reply_to"].event_id;
    }
  }
  return void 0;
}
var RelationType4;
var init_threads = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/matrix/src/matrix/monitor/threads.ts"() {
    "use strict";
    RelationType4 = {
      Thread: "m.thread"
    };
  }
});

// vendor/openclaw-runtime/win-x64/extensions/matrix/src/matrix/monitor/handler.ts
import {
  DEFAULT_ACCOUNT_ID as DEFAULT_ACCOUNT_ID5,
  createScopedPairingAccess,
  createReplyPrefixOptions,
  createTypingCallbacks,
  formatAllowlistMatchMeta as formatAllowlistMatchMeta2,
  logInboundDrop,
  logTypingFailure,
  resolveControlCommandGate
} from "openclaw/plugin-sdk";
function createMatrixRoomMessageHandler(params) {
  const {
    client,
    core,
    cfg,
    runtime: runtime2,
    logger,
    logVerboseMessage,
    allowFrom,
    roomsConfig,
    mentionRegexes,
    groupPolicy,
    replyToMode,
    threadReplies,
    dmEnabled,
    dmPolicy: dmPolicy2,
    textLimit,
    mediaMaxBytes,
    startupMs,
    startupGraceMs,
    directTracker,
    getRoomInfo,
    getMemberDisplayName,
    accountId
  } = params;
  const resolvedAccountId = accountId?.trim() || DEFAULT_ACCOUNT_ID5;
  const pairing = createScopedPairingAccess({
    core,
    channel: "matrix",
    accountId: resolvedAccountId
  });
  return async (roomId, event) => {
    try {
      const eventType = event.type;
      if (eventType === EventType3.RoomMessageEncrypted) {
        return;
      }
      const isPollEvent = isPollStartType(eventType);
      const locationContent = event.content;
      const isLocationEvent = eventType === EventType3.Location || eventType === EventType3.RoomMessage && locationContent.msgtype === EventType3.Location;
      if (eventType !== EventType3.RoomMessage && !isPollEvent && !isLocationEvent) {
        return;
      }
      logVerboseMessage(
        `matrix: room.message recv room=${roomId} type=${eventType} id=${event.event_id ?? "unknown"}`
      );
      if (event.unsigned?.redacted_because) {
        return;
      }
      const senderId = event.sender;
      if (!senderId) {
        return;
      }
      const selfUserId = await client.getUserId();
      if (senderId === selfUserId) {
        return;
      }
      const eventTs = event.origin_server_ts;
      const eventAge = event.unsigned?.age;
      if (typeof eventTs === "number" && eventTs < startupMs - startupGraceMs) {
        return;
      }
      if (typeof eventTs !== "number" && typeof eventAge === "number" && eventAge > startupGraceMs) {
        return;
      }
      const roomInfo = await getRoomInfo(roomId);
      const roomName = roomInfo.name;
      const roomAliases = [roomInfo.canonicalAlias ?? "", ...roomInfo.altAliases].filter(Boolean);
      let content = event.content;
      if (isPollEvent) {
        const pollStartContent = event.content;
        const pollSummary = parsePollStartContent(pollStartContent);
        if (pollSummary) {
          pollSummary.eventId = event.event_id ?? "";
          pollSummary.roomId = roomId;
          pollSummary.sender = senderId;
          const senderDisplayName = await getMemberDisplayName(roomId, senderId);
          pollSummary.senderName = senderDisplayName;
          const pollText = formatPollAsText(pollSummary);
          content = {
            msgtype: "m.text",
            body: pollText
          };
        } else {
          return;
        }
      }
      const locationPayload = resolveMatrixLocation({
        eventType,
        content
      });
      const relates = content["m.relates_to"];
      if (relates && "rel_type" in relates) {
        if (relates.rel_type === RelationType3.Replace) {
          return;
        }
      }
      const isDirectMessage = await directTracker.isDirectMessage({
        roomId,
        senderId,
        selfUserId
      });
      const isRoom = !isDirectMessage;
      if (isRoom && groupPolicy === "disabled") {
        return;
      }
      const roomConfigInfo = isRoom ? resolveMatrixRoomConfig({
        rooms: roomsConfig,
        roomId,
        aliases: roomAliases,
        name: roomName
      }) : void 0;
      const roomConfig = roomConfigInfo?.config;
      const roomMatchMeta = roomConfigInfo ? `matchKey=${roomConfigInfo.matchKey ?? "none"} matchSource=${roomConfigInfo.matchSource ?? "none"}` : "matchKey=none matchSource=none";
      if (isRoom && roomConfig && !roomConfigInfo?.allowed) {
        logVerboseMessage(`matrix: room disabled room=${roomId} (${roomMatchMeta})`);
        return;
      }
      if (isRoom && groupPolicy === "allowlist") {
        if (!roomConfigInfo?.allowlistConfigured) {
          logVerboseMessage(`matrix: drop room message (no allowlist, ${roomMatchMeta})`);
          return;
        }
        if (!roomConfig) {
          logVerboseMessage(`matrix: drop room message (not in allowlist, ${roomMatchMeta})`);
          return;
        }
      }
      const senderName = await getMemberDisplayName(roomId, senderId);
      const senderUsername = resolveMatrixSenderUsername(senderId);
      const senderLabel = resolveMatrixInboundSenderLabel({
        senderName,
        senderId,
        senderUsername
      });
      const groupAllowFrom = cfg.channels?.matrix?.groupAllowFrom ?? [];
      const { access, effectiveAllowFrom, effectiveGroupAllowFrom, groupAllowConfigured } = await resolveMatrixAccessState({
        isDirectMessage,
        resolvedAccountId,
        dmPolicy: dmPolicy2,
        groupPolicy,
        allowFrom,
        groupAllowFrom,
        senderId,
        readStoreForDmPolicy: pairing.readStoreForDmPolicy
      });
      if (isDirectMessage) {
        const allowedDirectMessage = await enforceMatrixDirectMessageAccess({
          dmEnabled,
          dmPolicy: dmPolicy2,
          accessDecision: access.decision,
          senderId,
          senderName,
          effectiveAllowFrom,
          upsertPairingRequest: pairing.upsertPairingRequest,
          sendPairingReply: async (text) => {
            await sendMessageMatrix(`room:${roomId}`, text, { client });
          },
          logVerboseMessage
        });
        if (!allowedDirectMessage) {
          return;
        }
      }
      const roomUsers = roomConfig?.users ?? [];
      if (isRoom && roomUsers.length > 0) {
        const userMatch = resolveMatrixAllowListMatch({
          allowList: normalizeMatrixAllowList(roomUsers),
          userId: senderId
        });
        if (!userMatch.allowed) {
          logVerboseMessage(
            `matrix: blocked sender ${senderId} (room users allowlist, ${roomMatchMeta}, ${formatAllowlistMatchMeta2(
              userMatch
            )})`
          );
          return;
        }
      }
      if (isRoom && roomUsers.length === 0 && groupAllowConfigured && access.decision !== "allow") {
        const groupAllowMatch = resolveMatrixAllowListMatch({
          allowList: effectiveGroupAllowFrom,
          userId: senderId
        });
        if (!groupAllowMatch.allowed) {
          logVerboseMessage(
            `matrix: blocked sender ${senderId} (groupAllowFrom, ${roomMatchMeta}, ${formatAllowlistMatchMeta2(
              groupAllowMatch
            )})`
          );
          return;
        }
      }
      if (isRoom) {
        logVerboseMessage(`matrix: allow room ${roomId} (${roomMatchMeta})`);
      }
      const rawBody = locationPayload?.text ?? (typeof content.body === "string" ? content.body.trim() : "");
      let media = null;
      const contentUrl = "url" in content && typeof content.url === "string" ? content.url : void 0;
      const contentFile = "file" in content && content.file && typeof content.file === "object" ? content.file : void 0;
      const mediaUrl = contentUrl ?? contentFile?.url;
      if (!rawBody && !mediaUrl) {
        return;
      }
      const contentInfo = "info" in content && content.info && typeof content.info === "object" ? content.info : void 0;
      const contentType = contentInfo?.mimetype;
      const contentSize = typeof contentInfo?.size === "number" ? contentInfo.size : void 0;
      if (mediaUrl?.startsWith("mxc://")) {
        try {
          media = await downloadMatrixMedia({
            client,
            mxcUrl: mediaUrl,
            contentType,
            sizeBytes: contentSize,
            maxBytes: mediaMaxBytes,
            file: contentFile
          });
        } catch (err) {
          logVerboseMessage(`matrix: media download failed: ${String(err)}`);
        }
      }
      const bodyText = rawBody || media?.placeholder || "";
      if (!bodyText) {
        return;
      }
      const { wasMentioned, hasExplicitMention } = resolveMentions({
        content,
        userId: selfUserId,
        text: bodyText,
        mentionRegexes
      });
      const allowTextCommands = core.channel.commands.shouldHandleTextCommands({
        cfg,
        surface: "matrix"
      });
      const useAccessGroups = cfg.commands?.useAccessGroups !== false;
      const senderAllowedForCommands = resolveMatrixAllowListMatches({
        allowList: effectiveAllowFrom,
        userId: senderId
      });
      const senderAllowedForGroup = groupAllowConfigured ? resolveMatrixAllowListMatches({
        allowList: effectiveGroupAllowFrom,
        userId: senderId
      }) : false;
      const senderAllowedForRoomUsers = isRoom && roomUsers.length > 0 ? resolveMatrixAllowListMatches({
        allowList: normalizeMatrixAllowList(roomUsers),
        userId: senderId
      }) : false;
      const hasControlCommandInMessage = core.channel.text.hasControlCommand(bodyText, cfg);
      const commandGate = resolveControlCommandGate({
        useAccessGroups,
        authorizers: [
          { configured: effectiveAllowFrom.length > 0, allowed: senderAllowedForCommands },
          { configured: roomUsers.length > 0, allowed: senderAllowedForRoomUsers },
          { configured: groupAllowConfigured, allowed: senderAllowedForGroup }
        ],
        allowTextCommands,
        hasControlCommand: hasControlCommandInMessage
      });
      const commandAuthorized = commandGate.commandAuthorized;
      if (isRoom && commandGate.shouldBlock) {
        logInboundDrop({
          log: logVerboseMessage,
          channel: "matrix",
          reason: "control command (unauthorized)",
          target: senderId
        });
        return;
      }
      const shouldRequireMention = isRoom ? roomConfig?.autoReply === true ? false : roomConfig?.autoReply === false ? true : typeof roomConfig?.requireMention === "boolean" ? roomConfig?.requireMention : true : false;
      const shouldBypassMention = allowTextCommands && isRoom && shouldRequireMention && !wasMentioned && !hasExplicitMention && commandAuthorized && hasControlCommandInMessage;
      const canDetectMention = mentionRegexes.length > 0 || hasExplicitMention;
      if (isRoom && shouldRequireMention && !wasMentioned && !shouldBypassMention) {
        logger.info("skipping room message", { roomId, reason: "no-mention" });
        return;
      }
      const messageId = event.event_id ?? "";
      const replyToEventId = content["m.relates_to"]?.["m.in_reply_to"]?.event_id;
      const threadRootId = resolveMatrixThreadRootId({ event, content });
      const threadTarget = resolveMatrixThreadTarget({
        threadReplies,
        messageId,
        threadRootId,
        isThreadRoot: false
        // @vector-im/matrix-bot-sdk doesn't have this info readily available
      });
      const baseRoute = core.channel.routing.resolveAgentRoute({
        cfg,
        channel: "matrix",
        accountId,
        peer: {
          kind: isDirectMessage ? "direct" : "channel",
          id: isDirectMessage ? senderId : roomId
        }
      });
      const route = {
        ...baseRoute,
        sessionKey: threadRootId ? `${baseRoute.sessionKey}:thread:${threadRootId}` : baseRoute.sessionKey
      };
      let threadStarterBody;
      let threadLabel;
      let parentSessionKey;
      if (threadRootId) {
        const existingSession = core.channel.session.readSessionUpdatedAt({
          storePath: core.channel.session.resolveStorePath(cfg.session?.store, {
            agentId: baseRoute.agentId
          }),
          sessionKey: route.sessionKey
        });
        if (existingSession === void 0) {
          try {
            const rootEvent = await fetchEventSummary(client, roomId, threadRootId);
            if (rootEvent?.body) {
              const rootSenderName = rootEvent.sender ? await getMemberDisplayName(roomId, rootEvent.sender) : void 0;
              threadStarterBody = core.channel.reply.formatAgentEnvelope({
                channel: "Matrix",
                from: rootSenderName ?? rootEvent.sender ?? "Unknown",
                timestamp: rootEvent.timestamp,
                envelope: core.channel.reply.resolveEnvelopeFormatOptions(cfg),
                body: rootEvent.body
              });
              threadLabel = `Matrix thread in ${roomName ?? roomId}`;
              parentSessionKey = baseRoute.sessionKey;
            }
          } catch (err) {
            logVerboseMessage(
              `matrix: failed to fetch thread root ${threadRootId}: ${String(err)}`
            );
          }
        }
      }
      const envelopeFrom = isDirectMessage ? senderName : roomName ?? roomId;
      const textWithId = threadRootId ? `${bodyText}
[matrix event id: ${messageId} room: ${roomId} thread: ${threadRootId}]` : `${bodyText}
[matrix event id: ${messageId} room: ${roomId}]`;
      const storePath = core.channel.session.resolveStorePath(cfg.session?.store, {
        agentId: route.agentId
      });
      const envelopeOptions = core.channel.reply.resolveEnvelopeFormatOptions(cfg);
      const previousTimestamp = core.channel.session.readSessionUpdatedAt({
        storePath,
        sessionKey: route.sessionKey
      });
      const body = core.channel.reply.formatInboundEnvelope({
        channel: "Matrix",
        from: envelopeFrom,
        timestamp: eventTs ?? void 0,
        previousTimestamp,
        envelope: envelopeOptions,
        body: textWithId,
        chatType: isDirectMessage ? "direct" : "channel",
        senderLabel
      });
      const groupSystemPrompt = roomConfig?.systemPrompt?.trim() || void 0;
      const ctxPayload = core.channel.reply.finalizeInboundContext({
        Body: body,
        BodyForAgent: resolveMatrixBodyForAgent({
          isDirectMessage,
          bodyText,
          senderLabel
        }),
        RawBody: bodyText,
        CommandBody: bodyText,
        From: isDirectMessage ? `matrix:${senderId}` : `matrix:channel:${roomId}`,
        To: `room:${roomId}`,
        SessionKey: route.sessionKey,
        AccountId: route.accountId,
        ChatType: threadRootId ? "thread" : isDirectMessage ? "direct" : "channel",
        ConversationLabel: envelopeFrom,
        SenderName: senderName,
        SenderId: senderId,
        SenderUsername: senderUsername,
        GroupSubject: isRoom ? roomName ?? roomId : void 0,
        GroupChannel: isRoom ? roomInfo.canonicalAlias ?? roomId : void 0,
        GroupSystemPrompt: isRoom ? groupSystemPrompt : void 0,
        Provider: "matrix",
        Surface: "matrix",
        WasMentioned: isRoom ? wasMentioned : void 0,
        MessageSid: messageId,
        ReplyToId: threadTarget ? void 0 : replyToEventId ?? void 0,
        MessageThreadId: threadTarget,
        Timestamp: eventTs ?? void 0,
        MediaPath: media?.path,
        MediaType: media?.contentType,
        MediaUrl: media?.path,
        ...locationPayload?.context,
        CommandAuthorized: commandAuthorized,
        CommandSource: "text",
        OriginatingChannel: "matrix",
        OriginatingTo: `room:${roomId}`,
        ThreadStarterBody: threadStarterBody,
        ThreadLabel: threadLabel,
        ParentSessionKey: parentSessionKey
      });
      await core.channel.session.recordInboundSession({
        storePath,
        sessionKey: ctxPayload.SessionKey ?? route.sessionKey,
        ctx: ctxPayload,
        updateLastRoute: isDirectMessage ? {
          sessionKey: route.mainSessionKey,
          channel: "matrix",
          to: `room:${roomId}`,
          accountId: route.accountId
        } : void 0,
        onRecordError: (err) => {
          logger.warn("failed updating session meta", {
            error: String(err),
            storePath,
            sessionKey: ctxPayload.SessionKey ?? route.sessionKey
          });
        }
      });
      const preview = bodyText.slice(0, 200).replace(/\n/g, "\\n");
      logVerboseMessage(`matrix inbound: room=${roomId} from=${senderId} preview="${preview}"`);
      const ackReaction = (cfg.messages?.ackReaction ?? "").trim();
      const ackScope = cfg.messages?.ackReactionScope ?? "group-mentions";
      const shouldAckReaction = () => Boolean(
        ackReaction && core.channel.reactions.shouldAckReaction({
          scope: ackScope,
          isDirect: isDirectMessage,
          isGroup: isRoom,
          isMentionableGroup: isRoom,
          requireMention: Boolean(shouldRequireMention),
          canDetectMention,
          effectiveWasMentioned: wasMentioned || shouldBypassMention,
          shouldBypassMention
        })
      );
      if (shouldAckReaction() && messageId) {
        reactMatrixMessage(roomId, messageId, ackReaction, client).catch((err) => {
          logVerboseMessage(`matrix react failed for room ${roomId}: ${String(err)}`);
        });
      }
      const replyTarget = ctxPayload.To;
      if (!replyTarget) {
        runtime2.error?.("matrix: missing reply target");
        return;
      }
      let didSendReply = false;
      const tableMode = core.channel.text.resolveMarkdownTableMode({
        cfg,
        channel: "matrix",
        accountId: route.accountId
      });
      const { onModelSelected, ...prefixOptions } = createReplyPrefixOptions({
        cfg,
        agentId: route.agentId,
        channel: "matrix",
        accountId: route.accountId
      });
      const typingCallbacks = createTypingCallbacks({
        start: () => sendTypingMatrix(roomId, true, void 0, client),
        stop: () => sendTypingMatrix(roomId, false, void 0, client),
        onStartError: (err) => {
          logTypingFailure({
            log: logVerboseMessage,
            channel: "matrix",
            action: "start",
            target: roomId,
            error: err
          });
        },
        onStopError: (err) => {
          logTypingFailure({
            log: logVerboseMessage,
            channel: "matrix",
            action: "stop",
            target: roomId,
            error: err
          });
        }
      });
      const { dispatcher, replyOptions, markDispatchIdle } = core.channel.reply.createReplyDispatcherWithTyping({
        ...prefixOptions,
        humanDelay: core.channel.reply.resolveHumanDelayConfig(cfg, route.agentId),
        typingCallbacks,
        deliver: async (payload) => {
          await deliverMatrixReplies({
            replies: [payload],
            roomId,
            client,
            runtime: runtime2,
            textLimit,
            replyToMode,
            threadId: threadTarget,
            accountId: route.accountId,
            tableMode
          });
          didSendReply = true;
        },
        onError: (err, info) => {
          runtime2.error?.(`matrix ${info.kind} reply failed: ${String(err)}`);
        }
      });
      const { queuedFinal, counts } = await core.channel.reply.withReplyDispatcher({
        dispatcher,
        onSettled: () => {
          markDispatchIdle();
        },
        run: () => core.channel.reply.dispatchReplyFromConfig({
          ctx: ctxPayload,
          cfg,
          dispatcher,
          replyOptions: {
            ...replyOptions,
            skillFilter: roomConfig?.skills,
            onModelSelected
          }
        })
      });
      if (!queuedFinal) {
        return;
      }
      didSendReply = true;
      const finalCount = counts.final;
      logVerboseMessage(
        `matrix: delivered ${finalCount} reply${finalCount === 1 ? "" : "ies"} to ${replyTarget}`
      );
      if (didSendReply) {
        const previewText = bodyText.replace(/\s+/g, " ").slice(0, 160);
        core.system.enqueueSystemEvent(`Matrix message from ${senderName}: ${previewText}`, {
          sessionKey: route.sessionKey,
          contextKey: `matrix:message:${roomId}:${messageId || "unknown"}`
        });
      }
    } catch (err) {
      runtime2.error?.(`matrix handler failed: ${String(err)}`);
    }
  };
}
var init_handler = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/matrix/src/matrix/monitor/handler.ts"() {
    "use strict";
    init_summary();
    init_poll_types();
    init_send();
    init_access_policy();
    init_allowlist();
    init_inbound_body();
    init_location();
    init_media2();
    init_mentions();
    init_replies();
    init_rooms();
    init_threads();
    init_types3();
  }
});

// vendor/openclaw-runtime/win-x64/extensions/matrix/src/matrix/monitor/room-info.ts
function createMatrixRoomInfoResolver(client) {
  const roomInfoCache = /* @__PURE__ */ new Map();
  const getRoomInfo = async (roomId) => {
    const cached = roomInfoCache.get(roomId);
    if (cached) {
      return cached;
    }
    let name;
    let canonicalAlias;
    let altAliases = [];
    try {
      const nameState = await client.getRoomStateEvent(roomId, "m.room.name", "").catch(() => null);
      name = nameState?.name;
    } catch {
    }
    try {
      const aliasState = await client.getRoomStateEvent(roomId, "m.room.canonical_alias", "").catch(() => null);
      canonicalAlias = aliasState?.alias;
      altAliases = aliasState?.alt_aliases ?? [];
    } catch {
    }
    const info = { name, canonicalAlias, altAliases };
    roomInfoCache.set(roomId, info);
    return info;
  };
  const getMemberDisplayName = async (roomId, userId) => {
    try {
      const memberState = await client.getRoomStateEvent(roomId, "m.room.member", userId).catch(() => null);
      return memberState?.displayname ?? userId;
    } catch {
      return userId;
    }
  };
  return {
    getRoomInfo,
    getMemberDisplayName
  };
}
var init_room_info = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/matrix/src/matrix/monitor/room-info.ts"() {
    "use strict";
  }
});

// vendor/openclaw-runtime/win-x64/extensions/matrix/src/matrix/monitor/index.ts
import {
  createLoggerBackedRuntime,
  GROUP_POLICY_BLOCKED_LABEL,
  mergeAllowlist,
  resolveAllowlistProviderRuntimeGroupPolicy,
  resolveDefaultGroupPolicy,
  summarizeMapping,
  warnMissingProviderGroupPolicyFallbackOnce
} from "openclaw/plugin-sdk";
function isConfiguredMatrixRoomEntry(entry) {
  return entry.startsWith("!") || entry.startsWith("#") && entry.includes(":");
}
function normalizeMatrixUserEntry(raw) {
  return raw.replace(/^matrix:/i, "").replace(/^user:/i, "").trim();
}
function normalizeMatrixRoomEntry(raw) {
  return raw.replace(/^matrix:/i, "").replace(/^(room|channel):/i, "").trim();
}
function isMatrixUserId(value) {
  return value.startsWith("@") && value.includes(":");
}
async function resolveMatrixUserAllowlist(params) {
  let allowList = params.list ?? [];
  if (allowList.length === 0) {
    return allowList.map(String);
  }
  const entries = allowList.map((entry) => normalizeMatrixUserEntry(String(entry))).filter((entry) => entry && entry !== "*");
  if (entries.length === 0) {
    return allowList.map(String);
  }
  const mapping = [];
  const unresolved = [];
  const additions = [];
  const pending = [];
  for (const entry of entries) {
    if (isMatrixUserId(entry)) {
      additions.push(normalizeMatrixUserId(entry));
      continue;
    }
    pending.push(entry);
  }
  if (pending.length > 0) {
    const resolved = await resolveMatrixTargets({
      cfg: params.cfg,
      inputs: pending,
      kind: "user",
      runtime: params.runtime
    });
    for (const entry of resolved) {
      if (entry.resolved && entry.id) {
        const normalizedId = normalizeMatrixUserId(entry.id);
        additions.push(normalizedId);
        mapping.push(`${entry.input}\u2192${normalizedId}`);
      } else {
        unresolved.push(entry.input);
      }
    }
  }
  allowList = mergeAllowlist({ existing: allowList, additions });
  summarizeMapping(params.label, mapping, unresolved, params.runtime);
  if (unresolved.length > 0) {
    params.runtime.log?.(
      `${params.label} entries must be full Matrix IDs (example: @user:server). Unresolved entries are ignored.`
    );
  }
  return allowList.map(String);
}
async function resolveMatrixRoomsConfig(params) {
  let roomsConfig = params.roomsConfig;
  if (!roomsConfig || Object.keys(roomsConfig).length === 0) {
    return roomsConfig;
  }
  const mapping = [];
  const unresolved = [];
  const nextRooms = {};
  if (roomsConfig["*"]) {
    nextRooms["*"] = roomsConfig["*"];
  }
  const pending = [];
  for (const [entry, roomConfig] of Object.entries(roomsConfig)) {
    if (entry === "*") {
      continue;
    }
    const trimmed = entry.trim();
    if (!trimmed) {
      continue;
    }
    const cleaned = normalizeMatrixRoomEntry(trimmed);
    if (isConfiguredMatrixRoomEntry(cleaned)) {
      if (!nextRooms[cleaned]) {
        nextRooms[cleaned] = roomConfig;
      }
      if (cleaned !== entry) {
        mapping.push(`${entry}\u2192${cleaned}`);
      }
      continue;
    }
    pending.push({ input: entry, query: trimmed, config: roomConfig });
  }
  if (pending.length > 0) {
    const resolved = await resolveMatrixTargets({
      cfg: params.cfg,
      inputs: pending.map((entry) => entry.query),
      kind: "group",
      runtime: params.runtime
    });
    resolved.forEach((entry, index) => {
      const source = pending[index];
      if (!source) {
        return;
      }
      if (entry.resolved && entry.id) {
        if (!nextRooms[entry.id]) {
          nextRooms[entry.id] = source.config;
        }
        mapping.push(`${source.input}\u2192${entry.id}`);
      } else {
        unresolved.push(source.input);
      }
    });
  }
  roomsConfig = nextRooms;
  summarizeMapping("matrix rooms", mapping, unresolved, params.runtime);
  if (unresolved.length > 0) {
    params.runtime.log?.(
      "matrix rooms must be room IDs or aliases (example: !room:server or #alias:server). Unresolved entries are ignored."
    );
  }
  if (Object.keys(roomsConfig).length === 0) {
    return roomsConfig;
  }
  const nextRoomsWithUsers = { ...roomsConfig };
  for (const [roomKey, roomConfig] of Object.entries(roomsConfig)) {
    const users = roomConfig?.users ?? [];
    if (users.length === 0) {
      continue;
    }
    const resolvedUsers = await resolveMatrixUserAllowlist({
      cfg: params.cfg,
      runtime: params.runtime,
      label: `matrix room users (${roomKey})`,
      list: users
    });
    if (resolvedUsers !== users) {
      nextRoomsWithUsers[roomKey] = { ...roomConfig, users: resolvedUsers };
    }
  }
  return nextRoomsWithUsers;
}
async function resolveMatrixMonitorConfig(params) {
  const allowFrom = await resolveMatrixUserAllowlist({
    cfg: params.cfg,
    runtime: params.runtime,
    label: "matrix dm allowlist",
    list: params.accountConfig.dm?.allowFrom ?? []
  });
  const groupAllowFrom = await resolveMatrixUserAllowlist({
    cfg: params.cfg,
    runtime: params.runtime,
    label: "matrix group allowlist",
    list: params.accountConfig.groupAllowFrom ?? []
  });
  const roomsConfig = await resolveMatrixRoomsConfig({
    cfg: params.cfg,
    runtime: params.runtime,
    roomsConfig: params.accountConfig.groups ?? params.accountConfig.rooms
  });
  return { allowFrom, groupAllowFrom, roomsConfig };
}
async function monitorMatrixProvider(opts = {}) {
  if (isBunRuntime()) {
    throw new Error("Matrix provider requires Node (bun runtime not supported)");
  }
  const core = getMatrixRuntime();
  let cfg = core.config.loadConfig();
  if (cfg.channels?.matrix?.enabled === false) {
    return;
  }
  const logger = core.logging.getChildLogger({ module: "matrix-auto-reply" });
  const runtime2 = opts.runtime ?? createLoggerBackedRuntime({
    logger
  });
  const logVerboseMessage = (message) => {
    if (!core.logging.shouldLogVerbose()) {
      return;
    }
    logger.debug?.(message);
  };
  const account = resolveMatrixAccount({ cfg, accountId: opts.accountId });
  const accountConfig = account.config;
  const allowlistOnly = accountConfig.allowlistOnly === true;
  const { allowFrom, groupAllowFrom, roomsConfig } = await resolveMatrixMonitorConfig({
    cfg,
    runtime: runtime2,
    accountConfig
  });
  cfg = {
    ...cfg,
    channels: {
      ...cfg.channels,
      matrix: {
        ...cfg.channels?.matrix,
        dm: {
          ...cfg.channels?.matrix?.dm,
          allowFrom
        },
        groupAllowFrom,
        ...roomsConfig ? { groups: roomsConfig } : {}
      }
    }
  };
  const auth = await resolveMatrixAuth({ cfg, accountId: opts.accountId });
  const resolvedInitialSyncLimit = typeof opts.initialSyncLimit === "number" ? Math.max(0, Math.floor(opts.initialSyncLimit)) : auth.initialSyncLimit;
  const authWithLimit = resolvedInitialSyncLimit === auth.initialSyncLimit ? auth : { ...auth, initialSyncLimit: resolvedInitialSyncLimit };
  const client = await resolveSharedMatrixClient({
    cfg,
    auth: authWithLimit,
    startClient: false,
    accountId: opts.accountId
  });
  setActiveMatrixClient(client, opts.accountId);
  const mentionRegexes = core.channel.mentions.buildMentionRegexes(cfg);
  const defaultGroupPolicy = resolveDefaultGroupPolicy(cfg);
  const { groupPolicy: groupPolicyRaw, providerMissingFallbackApplied } = resolveAllowlistProviderRuntimeGroupPolicy({
    providerConfigPresent: cfg.channels?.matrix !== void 0,
    groupPolicy: accountConfig.groupPolicy,
    defaultGroupPolicy
  });
  warnMissingProviderGroupPolicyFallbackOnce({
    providerMissingFallbackApplied,
    providerKey: "matrix",
    accountId: account.accountId,
    blockedLabel: GROUP_POLICY_BLOCKED_LABEL.room,
    log: (message) => logVerboseMessage(message)
  });
  const groupPolicy = allowlistOnly && groupPolicyRaw === "open" ? "allowlist" : groupPolicyRaw;
  const replyToMode = opts.replyToMode ?? accountConfig.replyToMode ?? "off";
  const threadReplies = accountConfig.threadReplies ?? "inbound";
  const dmConfig = accountConfig.dm;
  const dmEnabled = dmConfig?.enabled ?? true;
  const dmPolicyRaw = dmConfig?.policy ?? "pairing";
  const dmPolicy2 = allowlistOnly && dmPolicyRaw !== "disabled" ? "allowlist" : dmPolicyRaw;
  const textLimit = core.channel.text.resolveTextChunkLimit(cfg, "matrix");
  const mediaMaxMb = opts.mediaMaxMb ?? accountConfig.mediaMaxMb ?? DEFAULT_MEDIA_MAX_MB;
  const mediaMaxBytes = Math.max(1, mediaMaxMb) * 1024 * 1024;
  const startupMs = Date.now();
  const startupGraceMs = DEFAULT_STARTUP_GRACE_MS;
  const directTracker = createDirectRoomTracker(client, {
    log: logVerboseMessage,
    includeMemberCountInLogs: core.logging.shouldLogVerbose()
  });
  registerMatrixAutoJoin({ client, cfg, runtime: runtime2 });
  const warnedEncryptedRooms = /* @__PURE__ */ new Set();
  const warnedCryptoMissingRooms = /* @__PURE__ */ new Set();
  const { getRoomInfo, getMemberDisplayName } = createMatrixRoomInfoResolver(client);
  const handleRoomMessage = createMatrixRoomMessageHandler({
    client,
    core,
    cfg,
    runtime: runtime2,
    logger,
    logVerboseMessage,
    allowFrom,
    roomsConfig,
    mentionRegexes,
    groupPolicy,
    replyToMode,
    threadReplies,
    dmEnabled,
    dmPolicy: dmPolicy2,
    textLimit,
    mediaMaxBytes,
    startupMs,
    startupGraceMs,
    directTracker,
    getRoomInfo,
    getMemberDisplayName,
    accountId: opts.accountId
  });
  registerMatrixMonitorEvents({
    client,
    auth,
    logVerboseMessage,
    warnedEncryptedRooms,
    warnedCryptoMissingRooms,
    logger,
    formatNativeDependencyHint: core.system.formatNativeDependencyHint,
    onRoomMessage: handleRoomMessage
  });
  logVerboseMessage("matrix: starting client");
  await resolveSharedMatrixClient({
    cfg,
    auth: authWithLimit,
    accountId: opts.accountId
  });
  logVerboseMessage("matrix: client started");
  logger.info(`matrix: logged in as ${auth.userId}`);
  if (auth.encryption && client.crypto) {
    try {
      const verificationRequest = await client.crypto.requestOwnUserVerification?.();
      if (verificationRequest) {
        logger.info("matrix: device verification requested - please verify in another client");
      }
    } catch (err) {
      logger.debug?.("Device verification request failed (may already be verified)", {
        error: String(err)
      });
    }
  }
  await new Promise((resolve) => {
    const onAbort = () => {
      try {
        logVerboseMessage("matrix: stopping client");
        stopSharedClientForAccount(auth, opts.accountId);
      } finally {
        setActiveMatrixClient(null, opts.accountId);
        resolve();
      }
    };
    if (opts.abortSignal?.aborted) {
      onAbort();
      return;
    }
    opts.abortSignal?.addEventListener("abort", onAbort, { once: true });
  });
}
var DEFAULT_MEDIA_MAX_MB, DEFAULT_STARTUP_GRACE_MS;
var init_monitor = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/matrix/src/matrix/monitor/index.ts"() {
    "use strict";
    init_resolve_targets();
    init_runtime2();
    init_accounts();
    init_active_client();
    init_client();
    init_allowlist();
    init_auto_join();
    init_direct();
    init_events();
    init_handler();
    init_room_info();
    DEFAULT_MEDIA_MAX_MB = 20;
    DEFAULT_STARTUP_GRACE_MS = 5e3;
  }
});

// vendor/openclaw-runtime/win-x64/extensions/matrix/src/matrix/index.ts
var matrix_exports = {};
__export(matrix_exports, {
  monitorMatrixProvider: () => monitorMatrixProvider,
  probeMatrix: () => probeMatrix,
  reactMatrixMessage: () => reactMatrixMessage,
  resolveMatrixAuth: () => resolveMatrixAuth,
  resolveMatrixRoomId: () => resolveMatrixRoomId,
  resolveSharedMatrixClient: () => resolveSharedMatrixClient,
  sendMessageMatrix: () => sendMessageMatrix,
  sendPollMatrix: () => sendPollMatrix,
  sendReadReceiptMatrix: () => sendReadReceiptMatrix,
  sendTypingMatrix: () => sendTypingMatrix
});
var init_matrix = __esm({
  "vendor/openclaw-runtime/win-x64/extensions/matrix/src/matrix/index.ts"() {
    "use strict";
    init_monitor();
    init_probe();
    init_send();
    init_client();
  }
});

// vendor/openclaw-runtime/win-x64/extensions/matrix/index.ts
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";

// vendor/openclaw-runtime/win-x64/extensions/matrix/src/channel.ts
import {
  applyAccountNameToChannelSection,
  buildChannelConfigSchema,
  buildProbeChannelStatusSummary,
  DEFAULT_ACCOUNT_ID as DEFAULT_ACCOUNT_ID6,
  deleteAccountFromConfigSection,
  formatPairingApproveHint,
  normalizeAccountId as normalizeAccountId8,
  PAIRING_APPROVED_MESSAGE,
  resolveAllowlistProviderRuntimeGroupPolicy as resolveAllowlistProviderRuntimeGroupPolicy2,
  resolveDefaultGroupPolicy as resolveDefaultGroupPolicy2,
  setAccountEnabledInConfigSection
} from "openclaw/plugin-sdk";

// vendor/openclaw-runtime/win-x64/extensions/matrix/src/actions.ts
init_accounts();
import {
  createActionGate as createActionGate2,
  readNumberParam as readNumberParam2,
  readStringParam as readStringParam2
} from "openclaw/plugin-sdk";

// vendor/openclaw-runtime/win-x64/extensions/matrix/src/tool-actions.ts
import {
  createActionGate,
  jsonResult,
  readNumberParam,
  readReactionParams,
  readStringParam
} from "openclaw/plugin-sdk";

// vendor/openclaw-runtime/win-x64/extensions/matrix/src/matrix/actions/messages.ts
init_send();

// vendor/openclaw-runtime/win-x64/extensions/matrix/src/matrix/actions/client.ts
init_runtime2();
init_active_client();
init_client_bootstrap();
init_client();
import { normalizeAccountId as normalizeAccountId7 } from "openclaw/plugin-sdk/account-id";
function ensureNodeRuntime2() {
  if (isBunRuntime()) {
    throw new Error("Matrix support requires Node (bun runtime not supported)");
  }
}
async function resolveActionClient(opts = {}) {
  ensureNodeRuntime2();
  if (opts.client) {
    return { client: opts.client, stopOnDone: false };
  }
  const accountId = normalizeAccountId7(opts.accountId);
  const active = getActiveMatrixClient(accountId);
  if (active) {
    return { client: active, stopOnDone: false };
  }
  const shouldShareClient = Boolean(process.env.OPENCLAW_GATEWAY_PORT);
  if (shouldShareClient) {
    const client2 = await resolveSharedMatrixClient({
      cfg: getMatrixRuntime().config.loadConfig(),
      timeoutMs: opts.timeoutMs,
      accountId
    });
    return { client: client2, stopOnDone: false };
  }
  const auth = await resolveMatrixAuth({
    cfg: getMatrixRuntime().config.loadConfig(),
    accountId
  });
  const client = await createPreparedMatrixClient({
    auth,
    timeoutMs: opts.timeoutMs,
    accountId
  });
  return { client, stopOnDone: true };
}

// vendor/openclaw-runtime/win-x64/extensions/matrix/src/matrix/actions/limits.ts
function resolveMatrixActionLimit(raw, fallback) {
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return fallback;
  }
  return Math.max(1, Math.floor(raw));
}

// vendor/openclaw-runtime/win-x64/extensions/matrix/src/matrix/actions/messages.ts
init_summary();
init_types2();
async function sendMatrixMessage(to, content, opts = {}) {
  return await sendMessageMatrix(to, content, {
    mediaUrl: opts.mediaUrl,
    replyToId: opts.replyToId,
    threadId: opts.threadId,
    client: opts.client,
    timeoutMs: opts.timeoutMs
  });
}
async function editMatrixMessage(roomId, messageId, content, opts = {}) {
  const trimmed = content.trim();
  if (!trimmed) {
    throw new Error("Matrix edit requires content");
  }
  const { client, stopOnDone } = await resolveActionClient(opts);
  try {
    const resolvedRoom = await resolveMatrixRoomId(client, roomId);
    const newContent = {
      msgtype: MsgType2.Text,
      body: trimmed
    };
    const payload = {
      msgtype: MsgType2.Text,
      body: `* ${trimmed}`,
      "m.new_content": newContent,
      "m.relates_to": {
        rel_type: RelationType2.Replace,
        event_id: messageId
      }
    };
    const eventId = await client.sendMessage(resolvedRoom, payload);
    return { eventId: eventId ?? null };
  } finally {
    if (stopOnDone) {
      client.stop();
    }
  }
}
async function deleteMatrixMessage(roomId, messageId, opts = {}) {
  const { client, stopOnDone } = await resolveActionClient(opts);
  try {
    const resolvedRoom = await resolveMatrixRoomId(client, roomId);
    await client.redactEvent(resolvedRoom, messageId, opts.reason);
  } finally {
    if (stopOnDone) {
      client.stop();
    }
  }
}
async function readMatrixMessages(roomId, opts = {}) {
  const { client, stopOnDone } = await resolveActionClient(opts);
  try {
    const resolvedRoom = await resolveMatrixRoomId(client, roomId);
    const limit = resolveMatrixActionLimit(opts.limit, 20);
    const token = opts.before?.trim() || opts.after?.trim() || void 0;
    const dir = opts.after ? "f" : "b";
    const res = await client.doRequest(
      "GET",
      `/_matrix/client/v3/rooms/${encodeURIComponent(resolvedRoom)}/messages`,
      {
        dir,
        limit,
        from: token
      }
    );
    const messages = res.chunk.filter((event) => event.type === EventType2.RoomMessage).filter((event) => !event.unsigned?.redacted_because).map(summarizeMatrixRawEvent);
    return {
      messages,
      nextBatch: res.end ?? null,
      prevBatch: res.start ?? null
    };
  } finally {
    if (stopOnDone) {
      client.stop();
    }
  }
}

// vendor/openclaw-runtime/win-x64/extensions/matrix/src/matrix/actions/reactions.ts
init_send();
init_types2();
function getReactionsPath(roomId, messageId) {
  return `/_matrix/client/v1/rooms/${encodeURIComponent(roomId)}/relations/${encodeURIComponent(messageId)}/${RelationType2.Annotation}/${EventType2.Reaction}`;
}
async function listReactionEvents(client, roomId, messageId, limit) {
  const res = await client.doRequest("GET", getReactionsPath(roomId, messageId), {
    dir: "b",
    limit
  });
  return res.chunk;
}
async function listMatrixReactions(roomId, messageId, opts = {}) {
  const { client, stopOnDone } = await resolveActionClient(opts);
  try {
    const resolvedRoom = await resolveMatrixRoomId(client, roomId);
    const limit = resolveMatrixActionLimit(opts.limit, 100);
    const chunk = await listReactionEvents(client, resolvedRoom, messageId, limit);
    const summaries = /* @__PURE__ */ new Map();
    for (const event of chunk) {
      const content = event.content;
      const key = content["m.relates_to"]?.key;
      if (!key) {
        continue;
      }
      const sender = event.sender ?? "";
      const entry = summaries.get(key) ?? {
        key,
        count: 0,
        users: []
      };
      entry.count += 1;
      if (sender && !entry.users.includes(sender)) {
        entry.users.push(sender);
      }
      summaries.set(key, entry);
    }
    return Array.from(summaries.values());
  } finally {
    if (stopOnDone) {
      client.stop();
    }
  }
}
async function removeMatrixReactions(roomId, messageId, opts = {}) {
  const { client, stopOnDone } = await resolveActionClient(opts);
  try {
    const resolvedRoom = await resolveMatrixRoomId(client, roomId);
    const chunk = await listReactionEvents(client, resolvedRoom, messageId, 200);
    const userId = await client.getUserId();
    if (!userId) {
      return { removed: 0 };
    }
    const targetEmoji = opts.emoji?.trim();
    const toRemove = chunk.filter((event) => event.sender === userId).filter((event) => {
      if (!targetEmoji) {
        return true;
      }
      const content = event.content;
      return content["m.relates_to"]?.key === targetEmoji;
    }).map((event) => event.event_id).filter((id) => Boolean(id));
    if (toRemove.length === 0) {
      return { removed: 0 };
    }
    await Promise.all(toRemove.map((id) => client.redactEvent(resolvedRoom, id)));
    return { removed: toRemove.length };
  } finally {
    if (stopOnDone) {
      client.stop();
    }
  }
}

// vendor/openclaw-runtime/win-x64/extensions/matrix/src/matrix/actions/pins.ts
init_send();
init_summary();
init_types2();
async function withResolvedPinRoom(roomId, opts, run) {
  const { client, stopOnDone } = await resolveActionClient(opts);
  try {
    const resolvedRoom = await resolveMatrixRoomId(client, roomId);
    return await run(client, resolvedRoom);
  } finally {
    if (stopOnDone) {
      client.stop();
    }
  }
}
async function updateMatrixPins(roomId, messageId, opts, update) {
  return await withResolvedPinRoom(roomId, opts, async (client, resolvedRoom) => {
    const current = await readPinnedEvents(client, resolvedRoom);
    const next = update(current);
    const payload = { pinned: next };
    await client.sendStateEvent(resolvedRoom, EventType2.RoomPinnedEvents, "", payload);
    return { pinned: next };
  });
}
async function pinMatrixMessage(roomId, messageId, opts = {}) {
  return await updateMatrixPins(
    roomId,
    messageId,
    opts,
    (current) => current.includes(messageId) ? current : [...current, messageId]
  );
}
async function unpinMatrixMessage(roomId, messageId, opts = {}) {
  return await updateMatrixPins(
    roomId,
    messageId,
    opts,
    (current) => current.filter((id) => id !== messageId)
  );
}
async function listMatrixPins(roomId, opts = {}) {
  return await withResolvedPinRoom(roomId, opts, async (client, resolvedRoom) => {
    const pinned = await readPinnedEvents(client, resolvedRoom);
    const events = (await Promise.all(
      pinned.map(async (eventId) => {
        try {
          return await fetchEventSummary(client, resolvedRoom, eventId);
        } catch {
          return null;
        }
      })
    )).filter((event) => Boolean(event));
    return { pinned, events };
  });
}

// vendor/openclaw-runtime/win-x64/extensions/matrix/src/matrix/actions/room.ts
init_send();
init_types2();
async function getMatrixMemberInfo(userId, opts = {}) {
  const { client, stopOnDone } = await resolveActionClient(opts);
  try {
    const roomId = opts.roomId ? await resolveMatrixRoomId(client, opts.roomId) : void 0;
    const profile = await client.getUserProfile(userId);
    return {
      userId,
      profile: {
        displayName: profile?.displayname ?? null,
        avatarUrl: profile?.avatar_url ?? null
      },
      membership: null,
      // Would need separate room state query
      powerLevel: null,
      // Would need separate power levels state query
      displayName: profile?.displayname ?? null,
      roomId: roomId ?? null
    };
  } finally {
    if (stopOnDone) {
      client.stop();
    }
  }
}
async function getMatrixRoomInfo(roomId, opts = {}) {
  const { client, stopOnDone } = await resolveActionClient(opts);
  try {
    const resolvedRoom = await resolveMatrixRoomId(client, roomId);
    let name = null;
    let topic = null;
    let canonicalAlias = null;
    let memberCount = null;
    try {
      const nameState = await client.getRoomStateEvent(resolvedRoom, "m.room.name", "");
      name = nameState?.name ?? null;
    } catch {
    }
    try {
      const topicState = await client.getRoomStateEvent(resolvedRoom, EventType2.RoomTopic, "");
      topic = topicState?.topic ?? null;
    } catch {
    }
    try {
      const aliasState = await client.getRoomStateEvent(resolvedRoom, "m.room.canonical_alias", "");
      canonicalAlias = aliasState?.alias ?? null;
    } catch {
    }
    try {
      const members = await client.getJoinedRoomMembers(resolvedRoom);
      memberCount = members.length;
    } catch {
    }
    return {
      roomId: resolvedRoom,
      name,
      topic,
      canonicalAlias,
      altAliases: [],
      // Would need separate query
      memberCount
    };
  } finally {
    if (stopOnDone) {
      client.stop();
    }
  }
}

// vendor/openclaw-runtime/win-x64/extensions/matrix/src/matrix/actions.ts
init_send();

// vendor/openclaw-runtime/win-x64/extensions/matrix/src/tool-actions.ts
init_send();
var messageActions = /* @__PURE__ */ new Set(["sendMessage", "editMessage", "deleteMessage", "readMessages"]);
var reactionActions = /* @__PURE__ */ new Set(["react", "reactions"]);
var pinActions = /* @__PURE__ */ new Set(["pinMessage", "unpinMessage", "listPins"]);
function readRoomId(params, required = true) {
  const direct = readStringParam(params, "roomId") ?? readStringParam(params, "channelId");
  if (direct) {
    return direct;
  }
  if (!required) {
    return readStringParam(params, "to") ?? "";
  }
  return readStringParam(params, "to", { required: true });
}
async function handleMatrixAction(params, cfg) {
  const action = readStringParam(params, "action", { required: true });
  const isActionEnabled = createActionGate(cfg.channels?.matrix?.actions);
  if (reactionActions.has(action)) {
    if (!isActionEnabled("reactions")) {
      throw new Error("Matrix reactions are disabled.");
    }
    const roomId = readRoomId(params);
    const messageId = readStringParam(params, "messageId", { required: true });
    if (action === "react") {
      const { emoji, remove, isEmpty } = readReactionParams(params, {
        removeErrorMessage: "Emoji is required to remove a Matrix reaction."
      });
      if (remove || isEmpty) {
        const result = await removeMatrixReactions(roomId, messageId, {
          emoji: remove ? emoji : void 0
        });
        return jsonResult({ ok: true, removed: result.removed });
      }
      await reactMatrixMessage(roomId, messageId, emoji);
      return jsonResult({ ok: true, added: emoji });
    }
    const reactions = await listMatrixReactions(roomId, messageId);
    return jsonResult({ ok: true, reactions });
  }
  if (messageActions.has(action)) {
    if (!isActionEnabled("messages")) {
      throw new Error("Matrix messages are disabled.");
    }
    switch (action) {
      case "sendMessage": {
        const to = readStringParam(params, "to", { required: true });
        const content = readStringParam(params, "content", {
          required: true,
          allowEmpty: true
        });
        const mediaUrl = readStringParam(params, "mediaUrl");
        const replyToId = readStringParam(params, "replyToId") ?? readStringParam(params, "replyTo");
        const threadId = readStringParam(params, "threadId");
        const result = await sendMatrixMessage(to, content, {
          mediaUrl: mediaUrl ?? void 0,
          replyToId: replyToId ?? void 0,
          threadId: threadId ?? void 0
        });
        return jsonResult({ ok: true, result });
      }
      case "editMessage": {
        const roomId = readRoomId(params);
        const messageId = readStringParam(params, "messageId", { required: true });
        const content = readStringParam(params, "content", { required: true });
        const result = await editMatrixMessage(roomId, messageId, content);
        return jsonResult({ ok: true, result });
      }
      case "deleteMessage": {
        const roomId = readRoomId(params);
        const messageId = readStringParam(params, "messageId", { required: true });
        const reason = readStringParam(params, "reason");
        await deleteMatrixMessage(roomId, messageId, { reason: reason ?? void 0 });
        return jsonResult({ ok: true, deleted: true });
      }
      case "readMessages": {
        const roomId = readRoomId(params);
        const limit = readNumberParam(params, "limit", { integer: true });
        const before = readStringParam(params, "before");
        const after = readStringParam(params, "after");
        const result = await readMatrixMessages(roomId, {
          limit: limit ?? void 0,
          before: before ?? void 0,
          after: after ?? void 0
        });
        return jsonResult({ ok: true, ...result });
      }
      default:
        break;
    }
  }
  if (pinActions.has(action)) {
    if (!isActionEnabled("pins")) {
      throw new Error("Matrix pins are disabled.");
    }
    const roomId = readRoomId(params);
    if (action === "pinMessage") {
      const messageId = readStringParam(params, "messageId", { required: true });
      const result2 = await pinMatrixMessage(roomId, messageId);
      return jsonResult({ ok: true, pinned: result2.pinned });
    }
    if (action === "unpinMessage") {
      const messageId = readStringParam(params, "messageId", { required: true });
      const result2 = await unpinMatrixMessage(roomId, messageId);
      return jsonResult({ ok: true, pinned: result2.pinned });
    }
    const result = await listMatrixPins(roomId);
    return jsonResult({ ok: true, pinned: result.pinned, events: result.events });
  }
  if (action === "memberInfo") {
    if (!isActionEnabled("memberInfo")) {
      throw new Error("Matrix member info is disabled.");
    }
    const userId = readStringParam(params, "userId", { required: true });
    const roomId = readStringParam(params, "roomId") ?? readStringParam(params, "channelId");
    const result = await getMatrixMemberInfo(userId, {
      roomId: roomId ?? void 0
    });
    return jsonResult({ ok: true, member: result });
  }
  if (action === "channelInfo") {
    if (!isActionEnabled("channelInfo")) {
      throw new Error("Matrix room info is disabled.");
    }
    const roomId = readRoomId(params);
    const result = await getMatrixRoomInfo(roomId);
    return jsonResult({ ok: true, room: result });
  }
  throw new Error(`Unsupported Matrix action: ${action}`);
}

// vendor/openclaw-runtime/win-x64/extensions/matrix/src/actions.ts
var matrixMessageActions = {
  listActions: ({ cfg }) => {
    const account = resolveMatrixAccount({ cfg });
    if (!account.enabled || !account.configured) {
      return [];
    }
    const gate = createActionGate2(cfg.channels?.matrix?.actions);
    const actions = /* @__PURE__ */ new Set(["send", "poll"]);
    if (gate("reactions")) {
      actions.add("react");
      actions.add("reactions");
    }
    if (gate("messages")) {
      actions.add("read");
      actions.add("edit");
      actions.add("delete");
    }
    if (gate("pins")) {
      actions.add("pin");
      actions.add("unpin");
      actions.add("list-pins");
    }
    if (gate("memberInfo")) {
      actions.add("member-info");
    }
    if (gate("channelInfo")) {
      actions.add("channel-info");
    }
    return Array.from(actions);
  },
  supportsAction: ({ action }) => action !== "poll",
  extractToolSend: ({ args }) => {
    const action = typeof args.action === "string" ? args.action.trim() : "";
    if (action !== "sendMessage") {
      return null;
    }
    const to = typeof args.to === "string" ? args.to : void 0;
    if (!to) {
      return null;
    }
    return { to };
  },
  handleAction: async (ctx) => {
    const { action, params, cfg } = ctx;
    const resolveRoomId = () => readStringParam2(params, "roomId") ?? readStringParam2(params, "channelId") ?? readStringParam2(params, "to", { required: true });
    if (action === "send") {
      const to = readStringParam2(params, "to", { required: true });
      const content = readStringParam2(params, "message", {
        required: true,
        allowEmpty: true
      });
      const mediaUrl = readStringParam2(params, "media", { trim: false });
      const replyTo = readStringParam2(params, "replyTo");
      const threadId = readStringParam2(params, "threadId");
      return await handleMatrixAction(
        {
          action: "sendMessage",
          to,
          content,
          mediaUrl: mediaUrl ?? void 0,
          replyToId: replyTo ?? void 0,
          threadId: threadId ?? void 0
        },
        cfg
      );
    }
    if (action === "react") {
      const messageId = readStringParam2(params, "messageId", { required: true });
      const emoji = readStringParam2(params, "emoji", { allowEmpty: true });
      const remove = typeof params.remove === "boolean" ? params.remove : void 0;
      return await handleMatrixAction(
        {
          action: "react",
          roomId: resolveRoomId(),
          messageId,
          emoji,
          remove
        },
        cfg
      );
    }
    if (action === "reactions") {
      const messageId = readStringParam2(params, "messageId", { required: true });
      const limit = readNumberParam2(params, "limit", { integer: true });
      return await handleMatrixAction(
        {
          action: "reactions",
          roomId: resolveRoomId(),
          messageId,
          limit
        },
        cfg
      );
    }
    if (action === "read") {
      const limit = readNumberParam2(params, "limit", { integer: true });
      return await handleMatrixAction(
        {
          action: "readMessages",
          roomId: resolveRoomId(),
          limit,
          before: readStringParam2(params, "before"),
          after: readStringParam2(params, "after")
        },
        cfg
      );
    }
    if (action === "edit") {
      const messageId = readStringParam2(params, "messageId", { required: true });
      const content = readStringParam2(params, "message", { required: true });
      return await handleMatrixAction(
        {
          action: "editMessage",
          roomId: resolveRoomId(),
          messageId,
          content
        },
        cfg
      );
    }
    if (action === "delete") {
      const messageId = readStringParam2(params, "messageId", { required: true });
      return await handleMatrixAction(
        {
          action: "deleteMessage",
          roomId: resolveRoomId(),
          messageId
        },
        cfg
      );
    }
    if (action === "pin" || action === "unpin" || action === "list-pins") {
      const messageId = action === "list-pins" ? void 0 : readStringParam2(params, "messageId", { required: true });
      return await handleMatrixAction(
        {
          action: action === "pin" ? "pinMessage" : action === "unpin" ? "unpinMessage" : "listPins",
          roomId: resolveRoomId(),
          messageId
        },
        cfg
      );
    }
    if (action === "member-info") {
      const userId = readStringParam2(params, "userId", { required: true });
      return await handleMatrixAction(
        {
          action: "memberInfo",
          userId,
          roomId: readStringParam2(params, "roomId") ?? readStringParam2(params, "channelId")
        },
        cfg
      );
    }
    if (action === "channel-info") {
      return await handleMatrixAction(
        {
          action: "channelInfo",
          roomId: resolveRoomId()
        },
        cfg
      );
    }
    throw new Error(`Action ${action} is not supported for provider matrix.`);
  }
};

// vendor/openclaw-runtime/win-x64/extensions/matrix/src/config-schema.ts
init_secret_input();
import { MarkdownConfigSchema, ToolPolicySchema } from "openclaw/plugin-sdk";
import { z as z2 } from "zod";
var allowFromEntry = z2.union([z2.string(), z2.number()]);
var matrixActionSchema = z2.object({
  reactions: z2.boolean().optional(),
  messages: z2.boolean().optional(),
  pins: z2.boolean().optional(),
  memberInfo: z2.boolean().optional(),
  channelInfo: z2.boolean().optional()
}).optional();
var matrixDmSchema = z2.object({
  enabled: z2.boolean().optional(),
  policy: z2.enum(["pairing", "allowlist", "open", "disabled"]).optional(),
  allowFrom: z2.array(allowFromEntry).optional()
}).optional();
var matrixRoomSchema = z2.object({
  enabled: z2.boolean().optional(),
  allow: z2.boolean().optional(),
  requireMention: z2.boolean().optional(),
  tools: ToolPolicySchema,
  autoReply: z2.boolean().optional(),
  users: z2.array(allowFromEntry).optional(),
  skills: z2.array(z2.string()).optional(),
  systemPrompt: z2.string().optional()
}).optional();
var MatrixConfigSchema = z2.object({
  name: z2.string().optional(),
  enabled: z2.boolean().optional(),
  defaultAccount: z2.string().optional(),
  accounts: z2.record(z2.string(), z2.unknown()).optional(),
  markdown: MarkdownConfigSchema,
  homeserver: z2.string().optional(),
  userId: z2.string().optional(),
  accessToken: z2.string().optional(),
  password: buildSecretInputSchema().optional(),
  deviceName: z2.string().optional(),
  initialSyncLimit: z2.number().optional(),
  encryption: z2.boolean().optional(),
  allowlistOnly: z2.boolean().optional(),
  groupPolicy: z2.enum(["open", "disabled", "allowlist"]).optional(),
  replyToMode: z2.enum(["off", "first", "all"]).optional(),
  threadReplies: z2.enum(["off", "inbound", "always"]).optional(),
  textChunkLimit: z2.number().optional(),
  chunkMode: z2.enum(["length", "newline"]).optional(),
  responsePrefix: z2.string().optional(),
  mediaMaxMb: z2.number().optional(),
  autoJoin: z2.enum(["always", "allowlist", "off"]).optional(),
  autoJoinAllowlist: z2.array(allowFromEntry).optional(),
  groupAllowFrom: z2.array(allowFromEntry).optional(),
  dm: matrixDmSchema,
  groups: z2.object({}).catchall(matrixRoomSchema).optional(),
  rooms: z2.object({}).catchall(matrixRoomSchema).optional(),
  actions: matrixActionSchema
});

// vendor/openclaw-runtime/win-x64/extensions/matrix/src/channel.ts
init_directory_live();

// vendor/openclaw-runtime/win-x64/extensions/matrix/src/group-mentions.ts
init_accounts();
init_rooms();
function stripLeadingPrefixCaseInsensitive(value, prefix) {
  return value.toLowerCase().startsWith(prefix.toLowerCase()) ? value.slice(prefix.length).trim() : value;
}
function resolveMatrixRoomConfigForGroup(params) {
  const rawGroupId = params.groupId?.trim() ?? "";
  let roomId = rawGroupId;
  roomId = stripLeadingPrefixCaseInsensitive(roomId, "matrix:");
  roomId = stripLeadingPrefixCaseInsensitive(roomId, "channel:");
  roomId = stripLeadingPrefixCaseInsensitive(roomId, "room:");
  const groupChannel = params.groupChannel?.trim() ?? "";
  const aliases = groupChannel ? [groupChannel] : [];
  const cfg = params.cfg;
  const matrixConfig = resolveMatrixAccountConfig({ cfg, accountId: params.accountId });
  return resolveMatrixRoomConfig({
    rooms: matrixConfig.groups ?? matrixConfig.rooms,
    roomId,
    aliases,
    name: groupChannel || void 0
  }).config;
}
function resolveMatrixGroupRequireMention(params) {
  const resolved = resolveMatrixRoomConfigForGroup(params);
  if (resolved) {
    if (resolved.autoReply === true) {
      return false;
    }
    if (resolved.autoReply === false) {
      return true;
    }
    if (typeof resolved.requireMention === "boolean") {
      return resolved.requireMention;
    }
  }
  return true;
}
function resolveMatrixGroupToolPolicy(params) {
  const resolved = resolveMatrixRoomConfigForGroup(params);
  return resolved?.tools;
}

// vendor/openclaw-runtime/win-x64/extensions/matrix/src/channel.ts
init_accounts();
init_client();
init_allowlist();
init_probe();
init_send();

// vendor/openclaw-runtime/win-x64/extensions/matrix/src/onboarding.ts
init_directory_live();
init_accounts();
import {
  addWildcardAllowFrom,
  formatResolvedUnresolvedNote,
  formatDocsLink,
  hasConfiguredSecretInput as hasConfiguredSecretInput2,
  mergeAllowFromEntries,
  promptSingleChannelSecretInput,
  promptChannelAccessConfig
} from "openclaw/plugin-sdk";

// vendor/openclaw-runtime/win-x64/extensions/matrix/src/matrix/deps.ts
import fs4 from "fs";
import { createRequire as createRequire2 } from "module";
import path3 from "path";
import { fileURLToPath } from "url";
import { runPluginCommandWithTimeout } from "openclaw/plugin-sdk";
var MATRIX_SDK_PACKAGE = "@vector-im/matrix-bot-sdk";
var MATRIX_CRYPTO_DOWNLOAD_HELPER = "@matrix-org/matrix-sdk-crypto-nodejs/download-lib.js";
function formatCommandError(result) {
  const stderr = result.stderr.trim();
  if (stderr) {
    return stderr;
  }
  const stdout = result.stdout.trim();
  if (stdout) {
    return stdout;
  }
  return "unknown error";
}
function isMissingMatrixCryptoRuntimeError(err) {
  const message = err instanceof Error ? err.message : String(err ?? "");
  return message.includes("Cannot find module") && message.includes("@matrix-org/matrix-sdk-crypto-nodejs-");
}
function isMatrixSdkAvailable() {
  try {
    const req = createRequire2(import.meta.url);
    req.resolve(MATRIX_SDK_PACKAGE);
    return true;
  } catch {
    return false;
  }
}
function resolvePluginRoot() {
  const currentDir = path3.dirname(fileURLToPath(import.meta.url));
  return path3.resolve(currentDir, "..", "..");
}
async function ensureMatrixCryptoRuntime(params = {}) {
  const req = createRequire2(import.meta.url);
  const requireFn = params.requireFn ?? ((id) => req(id));
  const resolveFn = params.resolveFn ?? ((id) => req.resolve(id));
  const runCommand = params.runCommand ?? runPluginCommandWithTimeout;
  const nodeExecutable = params.nodeExecutable ?? process.execPath;
  try {
    requireFn(MATRIX_SDK_PACKAGE);
    return;
  } catch (err) {
    if (!isMissingMatrixCryptoRuntimeError(err)) {
      throw err;
    }
  }
  const scriptPath = resolveFn(MATRIX_CRYPTO_DOWNLOAD_HELPER);
  params.log?.("matrix: crypto runtime missing; downloading platform library\u2026");
  const result = await runCommand({
    argv: [nodeExecutable, scriptPath],
    cwd: path3.dirname(scriptPath),
    timeoutMs: 3e5,
    env: { COREPACK_ENABLE_DOWNLOAD_PROMPT: "0" }
  });
  if (result.code !== 0) {
    throw new Error(`Matrix crypto runtime bootstrap failed: ${formatCommandError(result)}`);
  }
  try {
    requireFn(MATRIX_SDK_PACKAGE);
  } catch (err) {
    throw new Error(
      `Matrix crypto runtime remains unavailable after bootstrap: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}
async function ensureMatrixSdkInstalled(params) {
  if (isMatrixSdkAvailable()) {
    return;
  }
  const confirm = params.confirm;
  if (confirm) {
    const ok = await confirm("Matrix requires @vector-im/matrix-bot-sdk. Install now?");
    if (!ok) {
      throw new Error("Matrix requires @vector-im/matrix-bot-sdk (install dependencies first).");
    }
  }
  const root = resolvePluginRoot();
  const command = fs4.existsSync(path3.join(root, "pnpm-lock.yaml")) ? ["pnpm", "install"] : ["npm", "install", "--omit=dev", "--silent"];
  params.runtime.log?.(`matrix: installing dependencies via ${command[0]} (${root})\u2026`);
  const result = await runPluginCommandWithTimeout({
    argv: command,
    cwd: root,
    timeoutMs: 3e5,
    env: { COREPACK_ENABLE_DOWNLOAD_PROMPT: "0" }
  });
  if (result.code !== 0) {
    throw new Error(
      result.stderr.trim() || result.stdout.trim() || "Matrix dependency install failed."
    );
  }
  if (!isMatrixSdkAvailable()) {
    throw new Error(
      "Matrix dependency install completed but @vector-im/matrix-bot-sdk is still missing."
    );
  }
}

// vendor/openclaw-runtime/win-x64/extensions/matrix/src/onboarding.ts
init_resolve_targets();
var channel = "matrix";
function setMatrixDmPolicy(cfg, policy) {
  const allowFrom = policy === "open" ? addWildcardAllowFrom(cfg.channels?.matrix?.dm?.allowFrom) : void 0;
  return {
    ...cfg,
    channels: {
      ...cfg.channels,
      matrix: {
        ...cfg.channels?.matrix,
        dm: {
          ...cfg.channels?.matrix?.dm,
          policy,
          ...allowFrom ? { allowFrom } : {}
        }
      }
    }
  };
}
async function noteMatrixAuthHelp(prompter) {
  await prompter.note(
    [
      "Matrix requires a homeserver URL.",
      "Use an access token (recommended) or a password (logs in and stores a token).",
      "With access token: user ID is fetched automatically.",
      "Env vars supported: MATRIX_HOMESERVER, MATRIX_USER_ID, MATRIX_ACCESS_TOKEN, MATRIX_PASSWORD.",
      `Docs: ${formatDocsLink("/channels/matrix", "channels/matrix")}`
    ].join("\n"),
    "Matrix setup"
  );
}
async function promptMatrixAllowFrom(params) {
  const { cfg, prompter } = params;
  const existingAllowFrom = cfg.channels?.matrix?.dm?.allowFrom ?? [];
  const account = resolveMatrixAccount({ cfg });
  const canResolve = Boolean(account.configured);
  const parseInput = (raw) => raw.split(/[\n,;]+/g).map((entry) => entry.trim()).filter(Boolean);
  const isFullUserId = (value) => value.startsWith("@") && value.includes(":");
  while (true) {
    const entry = await prompter.text({
      message: "Matrix allowFrom (full @user:server; display name only if unique)",
      placeholder: "@user:server",
      initialValue: existingAllowFrom[0] ? String(existingAllowFrom[0]) : void 0,
      validate: (value) => String(value ?? "").trim() ? void 0 : "Required"
    });
    const parts = parseInput(String(entry));
    const resolvedIds = [];
    const pending = [];
    const unresolved = [];
    const unresolvedNotes = [];
    for (const part of parts) {
      if (isFullUserId(part)) {
        resolvedIds.push(part);
        continue;
      }
      if (!canResolve) {
        unresolved.push(part);
        continue;
      }
      pending.push(part);
    }
    if (pending.length > 0) {
      const results = await resolveMatrixTargets({
        cfg,
        inputs: pending,
        kind: "user"
      }).catch(() => []);
      for (const result of results) {
        if (result?.resolved && result.id) {
          resolvedIds.push(result.id);
          continue;
        }
        if (result?.input) {
          unresolved.push(result.input);
          if (result.note) {
            unresolvedNotes.push(`${result.input}: ${result.note}`);
          }
        }
      }
    }
    if (unresolved.length > 0) {
      const details = unresolvedNotes.length > 0 ? unresolvedNotes : unresolved;
      await prompter.note(
        `Could not resolve:
${details.join("\n")}
Use full @user:server IDs.`,
        "Matrix allowlist"
      );
      continue;
    }
    const unique = mergeAllowFromEntries(existingAllowFrom, resolvedIds);
    return {
      ...cfg,
      channels: {
        ...cfg.channels,
        matrix: {
          ...cfg.channels?.matrix,
          enabled: true,
          dm: {
            ...cfg.channels?.matrix?.dm,
            policy: "allowlist",
            allowFrom: unique
          }
        }
      }
    };
  }
}
function setMatrixGroupPolicy(cfg, groupPolicy) {
  return {
    ...cfg,
    channels: {
      ...cfg.channels,
      matrix: {
        ...cfg.channels?.matrix,
        enabled: true,
        groupPolicy
      }
    }
  };
}
function setMatrixGroupRooms(cfg, roomKeys) {
  const groups = Object.fromEntries(roomKeys.map((key) => [key, { allow: true }]));
  return {
    ...cfg,
    channels: {
      ...cfg.channels,
      matrix: {
        ...cfg.channels?.matrix,
        enabled: true,
        groups
      }
    }
  };
}
var dmPolicy = {
  label: "Matrix",
  channel,
  policyKey: "channels.matrix.dm.policy",
  allowFromKey: "channels.matrix.dm.allowFrom",
  getCurrent: (cfg) => cfg.channels?.matrix?.dm?.policy ?? "pairing",
  setPolicy: (cfg, policy) => setMatrixDmPolicy(cfg, policy),
  promptAllowFrom: promptMatrixAllowFrom
};
var matrixOnboardingAdapter = {
  channel,
  getStatus: async ({ cfg }) => {
    const account = resolveMatrixAccount({ cfg });
    const configured = account.configured;
    const sdkReady = isMatrixSdkAvailable();
    return {
      channel,
      configured,
      statusLines: [
        `Matrix: ${configured ? "configured" : "needs homeserver + access token or password"}`
      ],
      selectionHint: !sdkReady ? "install @vector-im/matrix-bot-sdk" : configured ? "configured" : "needs auth"
    };
  },
  configure: async ({ cfg, runtime: runtime2, prompter, forceAllowFrom }) => {
    let next = cfg;
    await ensureMatrixSdkInstalled({
      runtime: runtime2,
      confirm: async (message) => await prompter.confirm({
        message,
        initialValue: true
      })
    });
    const existing = next.channels?.matrix ?? {};
    const account = resolveMatrixAccount({ cfg: next });
    if (!account.configured) {
      await noteMatrixAuthHelp(prompter);
    }
    const envHomeserver = process.env.MATRIX_HOMESERVER?.trim();
    const envUserId = process.env.MATRIX_USER_ID?.trim();
    const envAccessToken = process.env.MATRIX_ACCESS_TOKEN?.trim();
    const envPassword = process.env.MATRIX_PASSWORD?.trim();
    const envReady = Boolean(envHomeserver && (envAccessToken || envUserId && envPassword));
    if (envReady && !existing.homeserver && !existing.userId && !existing.accessToken && !existing.password) {
      const useEnv = await prompter.confirm({
        message: "Matrix env vars detected. Use env values?",
        initialValue: true
      });
      if (useEnv) {
        next = {
          ...next,
          channels: {
            ...next.channels,
            matrix: {
              ...next.channels?.matrix,
              enabled: true
            }
          }
        };
        if (forceAllowFrom) {
          next = await promptMatrixAllowFrom({ cfg: next, prompter });
        }
        return { cfg: next };
      }
    }
    const homeserver = String(
      await prompter.text({
        message: "Matrix homeserver URL",
        initialValue: existing.homeserver ?? envHomeserver,
        validate: (value) => {
          const raw = String(value ?? "").trim();
          if (!raw) {
            return "Required";
          }
          if (!/^https?:\/\//i.test(raw)) {
            return "Use a full URL (https://...)";
          }
          return void 0;
        }
      })
    ).trim();
    let accessToken = existing.accessToken ?? "";
    let password = existing.password;
    let userId = existing.userId ?? "";
    const existingPasswordConfigured = hasConfiguredSecretInput2(existing.password);
    const passwordConfigured = () => hasConfiguredSecretInput2(password);
    if (accessToken || passwordConfigured()) {
      const keep = await prompter.confirm({
        message: "Matrix credentials already configured. Keep them?",
        initialValue: true
      });
      if (!keep) {
        accessToken = "";
        password = void 0;
        userId = "";
      }
    }
    if (!accessToken && !passwordConfigured()) {
      const authMode = await prompter.select({
        message: "Matrix auth method",
        options: [
          { value: "token", label: "Access token (user ID fetched automatically)" },
          { value: "password", label: "Password (requires user ID)" }
        ]
      });
      if (authMode === "token") {
        accessToken = String(
          await prompter.text({
            message: "Matrix access token",
            validate: (value) => value?.trim() ? void 0 : "Required"
          })
        ).trim();
        userId = "";
      } else {
        userId = String(
          await prompter.text({
            message: "Matrix user ID",
            initialValue: existing.userId ?? envUserId,
            validate: (value) => {
              const raw = String(value ?? "").trim();
              if (!raw) {
                return "Required";
              }
              if (!raw.startsWith("@")) {
                return "Matrix user IDs should start with @";
              }
              if (!raw.includes(":")) {
                return "Matrix user IDs should include a server (:server)";
              }
              return void 0;
            }
          })
        ).trim();
        const passwordResult = await promptSingleChannelSecretInput({
          cfg: next,
          prompter,
          providerHint: "matrix",
          credentialLabel: "password",
          accountConfigured: Boolean(existingPasswordConfigured),
          canUseEnv: Boolean(envPassword?.trim()) && !existingPasswordConfigured,
          hasConfigToken: existingPasswordConfigured,
          envPrompt: "MATRIX_PASSWORD detected. Use env var?",
          keepPrompt: "Matrix password already configured. Keep it?",
          inputPrompt: "Matrix password",
          preferredEnvVar: "MATRIX_PASSWORD"
        });
        if (passwordResult.action === "set") {
          password = passwordResult.value;
        }
        if (passwordResult.action === "use-env") {
          password = void 0;
        }
      }
    }
    const deviceName = String(
      await prompter.text({
        message: "Matrix device name (optional)",
        initialValue: existing.deviceName ?? "OpenClaw Gateway"
      })
    ).trim();
    const enableEncryption = await prompter.confirm({
      message: "Enable end-to-end encryption (E2EE)?",
      initialValue: existing.encryption ?? false
    });
    next = {
      ...next,
      channels: {
        ...next.channels,
        matrix: {
          ...next.channels?.matrix,
          enabled: true,
          homeserver,
          userId: userId || void 0,
          accessToken: accessToken || void 0,
          password,
          deviceName: deviceName || void 0,
          encryption: enableEncryption || void 0
        }
      }
    };
    if (forceAllowFrom) {
      next = await promptMatrixAllowFrom({ cfg: next, prompter });
    }
    const existingGroups = next.channels?.matrix?.groups ?? next.channels?.matrix?.rooms;
    const accessConfig = await promptChannelAccessConfig({
      prompter,
      label: "Matrix rooms",
      currentPolicy: next.channels?.matrix?.groupPolicy ?? "allowlist",
      currentEntries: Object.keys(existingGroups ?? {}),
      placeholder: "!roomId:server, #alias:server, Project Room",
      updatePrompt: Boolean(existingGroups)
    });
    if (accessConfig) {
      if (accessConfig.policy !== "allowlist") {
        next = setMatrixGroupPolicy(next, accessConfig.policy);
      } else {
        let roomKeys = accessConfig.entries;
        if (accessConfig.entries.length > 0) {
          try {
            const resolvedIds = [];
            const unresolved = [];
            for (const entry of accessConfig.entries) {
              const trimmed = entry.trim();
              if (!trimmed) {
                continue;
              }
              const cleaned = trimmed.replace(/^(room|channel):/i, "").trim();
              if (cleaned.startsWith("!") && cleaned.includes(":")) {
                resolvedIds.push(cleaned);
                continue;
              }
              const matches = await listMatrixDirectoryGroupsLive({
                cfg: next,
                query: trimmed,
                limit: 10
              });
              const exact = matches.find(
                (match) => (match.name ?? "").toLowerCase() === trimmed.toLowerCase()
              );
              const best = exact ?? matches[0];
              if (best?.id) {
                resolvedIds.push(best.id);
              } else {
                unresolved.push(entry);
              }
            }
            roomKeys = [...resolvedIds, ...unresolved.map((entry) => entry.trim()).filter(Boolean)];
            const resolution = formatResolvedUnresolvedNote({
              resolved: resolvedIds,
              unresolved
            });
            if (resolution) {
              await prompter.note(resolution, "Matrix rooms");
            }
          } catch (err) {
            await prompter.note(
              `Room lookup failed; keeping entries as typed. ${String(err)}`,
              "Matrix rooms"
            );
          }
        }
        next = setMatrixGroupPolicy(next, "allowlist");
        next = setMatrixGroupRooms(next, roomKeys);
      }
    }
    return { cfg: next };
  },
  dmPolicy,
  disable: (cfg) => ({
    ...cfg,
    channels: {
      ...cfg.channels,
      matrix: { ...cfg.channels?.matrix, enabled: false }
    }
  })
};

// vendor/openclaw-runtime/win-x64/extensions/matrix/src/outbound.ts
init_send();
init_runtime2();
var matrixOutbound = {
  deliveryMode: "direct",
  chunker: (text, limit) => getMatrixRuntime().channel.text.chunkMarkdownText(text, limit),
  chunkerMode: "markdown",
  textChunkLimit: 4e3,
  sendText: async ({ to, text, deps, replyToId, threadId, accountId }) => {
    const send = deps?.sendMatrix ?? sendMessageMatrix;
    const resolvedThreadId = threadId !== void 0 && threadId !== null ? String(threadId) : void 0;
    const result = await send(to, text, {
      replyToId: replyToId ?? void 0,
      threadId: resolvedThreadId,
      accountId: accountId ?? void 0
    });
    return {
      channel: "matrix",
      messageId: result.messageId,
      roomId: result.roomId
    };
  },
  sendMedia: async ({ to, text, mediaUrl, deps, replyToId, threadId, accountId }) => {
    const send = deps?.sendMatrix ?? sendMessageMatrix;
    const resolvedThreadId = threadId !== void 0 && threadId !== null ? String(threadId) : void 0;
    const result = await send(to, text, {
      mediaUrl,
      replyToId: replyToId ?? void 0,
      threadId: resolvedThreadId,
      accountId: accountId ?? void 0
    });
    return {
      channel: "matrix",
      messageId: result.messageId,
      roomId: result.roomId
    };
  },
  sendPoll: async ({ to, poll, threadId, accountId }) => {
    const resolvedThreadId = threadId !== void 0 && threadId !== null ? String(threadId) : void 0;
    const result = await sendPollMatrix(to, poll, {
      threadId: resolvedThreadId,
      accountId: accountId ?? void 0
    });
    return {
      channel: "matrix",
      messageId: result.eventId,
      roomId: result.roomId,
      pollId: result.eventId
    };
  }
};

// vendor/openclaw-runtime/win-x64/extensions/matrix/src/channel.ts
init_resolve_targets();
init_secret_input();
var matrixStartupLock = Promise.resolve();
var meta = {
  id: "matrix",
  label: "Matrix",
  selectionLabel: "Matrix (plugin)",
  docsPath: "/channels/matrix",
  docsLabel: "matrix",
  blurb: "open protocol; configure a homeserver + access token.",
  order: 70,
  quickstartAllowFrom: true
};
function normalizeMatrixMessagingTarget(raw) {
  let normalized = raw.trim();
  if (!normalized) {
    return void 0;
  }
  const lowered = normalized.toLowerCase();
  if (lowered.startsWith("matrix:")) {
    normalized = normalized.slice("matrix:".length).trim();
  }
  const stripped = normalized.replace(/^(room|channel|user):/i, "").trim();
  return stripped || void 0;
}
function buildMatrixConfigUpdate(cfg, input) {
  const existing = cfg.channels?.matrix ?? {};
  return {
    ...cfg,
    channels: {
      ...cfg.channels,
      matrix: {
        ...existing,
        enabled: true,
        ...input.homeserver ? { homeserver: input.homeserver } : {},
        ...input.userId ? { userId: input.userId } : {},
        ...input.accessToken ? { accessToken: input.accessToken } : {},
        ...input.password ? { password: input.password } : {},
        ...input.deviceName ? { deviceName: input.deviceName } : {},
        ...typeof input.initialSyncLimit === "number" ? { initialSyncLimit: input.initialSyncLimit } : {}
      }
    }
  };
}
var matrixPlugin = {
  id: "matrix",
  meta,
  onboarding: matrixOnboardingAdapter,
  pairing: {
    idLabel: "matrixUserId",
    normalizeAllowEntry: (entry) => entry.replace(/^matrix:/i, ""),
    notifyApproval: async ({ id }) => {
      await sendMessageMatrix(`user:${id}`, PAIRING_APPROVED_MESSAGE);
    }
  },
  capabilities: {
    chatTypes: ["direct", "group", "thread"],
    polls: true,
    reactions: true,
    threads: true,
    media: true
  },
  reload: { configPrefixes: ["channels.matrix"] },
  configSchema: buildChannelConfigSchema(MatrixConfigSchema),
  config: {
    listAccountIds: (cfg) => listMatrixAccountIds(cfg),
    resolveAccount: (cfg, accountId) => resolveMatrixAccount({ cfg, accountId }),
    defaultAccountId: (cfg) => resolveDefaultMatrixAccountId(cfg),
    setAccountEnabled: ({ cfg, accountId, enabled }) => setAccountEnabledInConfigSection({
      cfg,
      sectionKey: "matrix",
      accountId,
      enabled,
      allowTopLevel: true
    }),
    deleteAccount: ({ cfg, accountId }) => deleteAccountFromConfigSection({
      cfg,
      sectionKey: "matrix",
      accountId,
      clearBaseFields: [
        "name",
        "homeserver",
        "userId",
        "accessToken",
        "password",
        "deviceName",
        "initialSyncLimit"
      ]
    }),
    isConfigured: (account) => account.configured,
    describeAccount: (account) => ({
      accountId: account.accountId,
      name: account.name,
      enabled: account.enabled,
      configured: account.configured,
      baseUrl: account.homeserver
    }),
    resolveAllowFrom: ({ cfg, accountId }) => {
      const matrixConfig = resolveMatrixAccountConfig({ cfg, accountId });
      return (matrixConfig.dm?.allowFrom ?? []).map((entry) => String(entry));
    },
    formatAllowFrom: ({ allowFrom }) => normalizeMatrixAllowList(allowFrom)
  },
  security: {
    resolveDmPolicy: ({ account }) => {
      const accountId = account.accountId;
      const prefix = accountId && accountId !== "default" ? `channels.matrix.accounts.${accountId}.dm` : "channels.matrix.dm";
      return {
        policy: account.config.dm?.policy ?? "pairing",
        allowFrom: account.config.dm?.allowFrom ?? [],
        policyPath: `${prefix}.policy`,
        allowFromPath: `${prefix}.allowFrom`,
        approveHint: formatPairingApproveHint("matrix"),
        normalizeEntry: (raw) => normalizeMatrixUserId(raw)
      };
    },
    collectWarnings: ({ account, cfg }) => {
      const defaultGroupPolicy = resolveDefaultGroupPolicy2(cfg);
      const { groupPolicy } = resolveAllowlistProviderRuntimeGroupPolicy2({
        providerConfigPresent: cfg.channels?.matrix !== void 0,
        groupPolicy: account.config.groupPolicy,
        defaultGroupPolicy
      });
      if (groupPolicy !== "open") {
        return [];
      }
      return [
        '- Matrix rooms: groupPolicy="open" allows any room to trigger (mention-gated). Set channels.matrix.groupPolicy="allowlist" + channels.matrix.groups (and optionally channels.matrix.groupAllowFrom) to restrict rooms.'
      ];
    }
  },
  groups: {
    resolveRequireMention: resolveMatrixGroupRequireMention,
    resolveToolPolicy: resolveMatrixGroupToolPolicy
  },
  threading: {
    resolveReplyToMode: ({ cfg, accountId }) => resolveMatrixAccountConfig({ cfg, accountId }).replyToMode ?? "off",
    buildToolContext: ({ context, hasRepliedRef }) => {
      const currentTarget = context.To;
      return {
        currentChannelId: currentTarget?.trim() || void 0,
        currentThreadTs: context.MessageThreadId != null ? String(context.MessageThreadId) : context.ReplyToId,
        hasRepliedRef
      };
    }
  },
  messaging: {
    normalizeTarget: normalizeMatrixMessagingTarget,
    targetResolver: {
      looksLikeId: (raw) => {
        const trimmed = raw.trim();
        if (!trimmed) {
          return false;
        }
        if (/^(matrix:)?[!#@]/i.test(trimmed)) {
          return true;
        }
        return trimmed.includes(":");
      },
      hint: "<room|alias|user>"
    }
  },
  directory: {
    self: async () => null,
    listPeers: async ({ cfg, accountId, query, limit }) => {
      const account = resolveMatrixAccount({ cfg, accountId });
      const q = query?.trim().toLowerCase() || "";
      const ids = /* @__PURE__ */ new Set();
      for (const entry of account.config.dm?.allowFrom ?? []) {
        const raw = String(entry).trim();
        if (!raw || raw === "*") {
          continue;
        }
        ids.add(raw.replace(/^matrix:/i, ""));
      }
      for (const entry of account.config.groupAllowFrom ?? []) {
        const raw = String(entry).trim();
        if (!raw || raw === "*") {
          continue;
        }
        ids.add(raw.replace(/^matrix:/i, ""));
      }
      const groups = account.config.groups ?? account.config.rooms ?? {};
      for (const room of Object.values(groups)) {
        for (const entry of room.users ?? []) {
          const raw = String(entry).trim();
          if (!raw || raw === "*") {
            continue;
          }
          ids.add(raw.replace(/^matrix:/i, ""));
        }
      }
      return Array.from(ids).map((raw) => raw.trim()).filter(Boolean).map((raw) => {
        const lowered = raw.toLowerCase();
        const cleaned = lowered.startsWith("user:") ? raw.slice("user:".length).trim() : raw;
        if (cleaned.startsWith("@")) {
          return `user:${cleaned}`;
        }
        return cleaned;
      }).filter((id) => q ? id.toLowerCase().includes(q) : true).slice(0, limit && limit > 0 ? limit : void 0).map((id) => {
        const raw = id.startsWith("user:") ? id.slice("user:".length) : id;
        const incomplete = !raw.startsWith("@") || !raw.includes(":");
        return {
          kind: "user",
          id,
          ...incomplete ? { name: "incomplete id; expected @user:server" } : {}
        };
      });
    },
    listGroups: async ({ cfg, accountId, query, limit }) => {
      const account = resolveMatrixAccount({ cfg, accountId });
      const q = query?.trim().toLowerCase() || "";
      const groups = account.config.groups ?? account.config.rooms ?? {};
      const ids = Object.keys(groups).map((raw) => raw.trim()).filter((raw) => Boolean(raw) && raw !== "*").map((raw) => raw.replace(/^matrix:/i, "")).map((raw) => {
        const lowered = raw.toLowerCase();
        if (lowered.startsWith("room:") || lowered.startsWith("channel:")) {
          return raw;
        }
        if (raw.startsWith("!")) {
          return `room:${raw}`;
        }
        return raw;
      }).filter((id) => q ? id.toLowerCase().includes(q) : true).slice(0, limit && limit > 0 ? limit : void 0).map((id) => ({ kind: "group", id }));
      return ids;
    },
    listPeersLive: async ({ cfg, accountId, query, limit }) => listMatrixDirectoryPeersLive({ cfg, accountId, query, limit }),
    listGroupsLive: async ({ cfg, accountId, query, limit }) => listMatrixDirectoryGroupsLive({ cfg, accountId, query, limit })
  },
  resolver: {
    resolveTargets: async ({ cfg, inputs, kind, runtime: runtime2 }) => resolveMatrixTargets({ cfg, inputs, kind, runtime: runtime2 })
  },
  actions: matrixMessageActions,
  setup: {
    resolveAccountId: ({ accountId }) => normalizeAccountId8(accountId),
    applyAccountName: ({ cfg, accountId, name }) => applyAccountNameToChannelSection({
      cfg,
      channelKey: "matrix",
      accountId,
      name
    }),
    validateInput: ({ input }) => {
      if (input.useEnv) {
        return null;
      }
      if (!input.homeserver?.trim()) {
        return "Matrix requires --homeserver";
      }
      const accessToken = input.accessToken?.trim();
      const password = normalizeSecretInputString(input.password);
      const userId = input.userId?.trim();
      if (!accessToken && !password) {
        return "Matrix requires --access-token or --password";
      }
      if (!accessToken) {
        if (!userId) {
          return "Matrix requires --user-id when using --password";
        }
        if (!password) {
          return "Matrix requires --password when using --user-id";
        }
      }
      return null;
    },
    applyAccountConfig: ({ cfg, input }) => {
      const namedConfig = applyAccountNameToChannelSection({
        cfg,
        channelKey: "matrix",
        accountId: DEFAULT_ACCOUNT_ID6,
        name: input.name
      });
      if (input.useEnv) {
        return {
          ...namedConfig,
          channels: {
            ...namedConfig.channels,
            matrix: {
              ...namedConfig.channels?.matrix,
              enabled: true
            }
          }
        };
      }
      return buildMatrixConfigUpdate(namedConfig, {
        homeserver: input.homeserver?.trim(),
        userId: input.userId?.trim(),
        accessToken: input.accessToken?.trim(),
        password: normalizeSecretInputString(input.password),
        deviceName: input.deviceName?.trim(),
        initialSyncLimit: input.initialSyncLimit
      });
    }
  },
  outbound: matrixOutbound,
  status: {
    defaultRuntime: {
      accountId: DEFAULT_ACCOUNT_ID6,
      running: false,
      lastStartAt: null,
      lastStopAt: null,
      lastError: null
    },
    collectStatusIssues: (accounts) => accounts.flatMap((account) => {
      const lastError = typeof account.lastError === "string" ? account.lastError.trim() : "";
      if (!lastError) {
        return [];
      }
      return [
        {
          channel: "matrix",
          accountId: account.accountId,
          kind: "runtime",
          message: `Channel error: ${lastError}`
        }
      ];
    }),
    buildChannelSummary: ({ snapshot }) => buildProbeChannelStatusSummary(snapshot, { baseUrl: snapshot.baseUrl ?? null }),
    probeAccount: async ({ account, timeoutMs, cfg }) => {
      try {
        const auth = await resolveMatrixAuth({
          cfg,
          accountId: account.accountId
        });
        return await probeMatrix({
          homeserver: auth.homeserver,
          accessToken: auth.accessToken,
          userId: auth.userId,
          timeoutMs
        });
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
          elapsedMs: 0
        };
      }
    },
    buildAccountSnapshot: ({ account, runtime: runtime2, probe }) => ({
      accountId: account.accountId,
      name: account.name,
      enabled: account.enabled,
      configured: account.configured,
      baseUrl: account.homeserver,
      running: runtime2?.running ?? false,
      lastStartAt: runtime2?.lastStartAt ?? null,
      lastStopAt: runtime2?.lastStopAt ?? null,
      lastError: runtime2?.lastError ?? null,
      probe,
      lastProbeAt: runtime2?.lastProbeAt ?? null,
      lastInboundAt: runtime2?.lastInboundAt ?? null,
      lastOutboundAt: runtime2?.lastOutboundAt ?? null
    })
  },
  gateway: {
    startAccount: async (ctx) => {
      const account = ctx.account;
      ctx.setStatus({
        accountId: account.accountId,
        baseUrl: account.homeserver
      });
      ctx.log?.info(`[${account.accountId}] starting provider (${account.homeserver ?? "matrix"})`);
      const previousLock = matrixStartupLock;
      let releaseLock = () => {
      };
      matrixStartupLock = new Promise((resolve) => {
        releaseLock = resolve;
      });
      await previousLock;
      let monitorMatrixProvider2;
      try {
        const module = await Promise.resolve().then(() => (init_matrix(), matrix_exports));
        monitorMatrixProvider2 = module.monitorMatrixProvider;
      } finally {
        releaseLock();
      }
      return monitorMatrixProvider2({
        runtime: ctx.runtime,
        abortSignal: ctx.abortSignal,
        mediaMaxMb: account.config.mediaMaxMb,
        initialSyncLimit: account.config.initialSyncLimit,
        replyToMode: account.config.replyToMode,
        accountId: account.accountId
      });
    }
  }
};

// vendor/openclaw-runtime/win-x64/extensions/matrix/index.ts
init_runtime2();
var plugin = {
  id: "matrix",
  name: "Matrix",
  description: "Matrix channel plugin (matrix-js-sdk)",
  configSchema: emptyPluginConfigSchema(),
  register(api) {
    setMatrixRuntime(api.runtime);
    void ensureMatrixCryptoRuntime({ log: api.logger.info }).catch((err) => {
      const message = err instanceof Error ? err.message : String(err);
      api.logger.warn?.(`matrix: crypto runtime bootstrap failed: ${message}`);
    });
    api.registerChannel({ plugin: matrixPlugin });
  }
};
var matrix_default = plugin;
export {
  matrix_default as default
};
