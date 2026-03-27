// vendor/openclaw-runtime/win-x64/extensions/google-gemini-cli-auth/index.ts
import {
  buildOauthProviderAuthResult,
  emptyPluginConfigSchema
} from "openclaw/plugin-sdk";

// vendor/openclaw-runtime/win-x64/extensions/google-gemini-cli-auth/oauth.ts
import { createHash, randomBytes } from "crypto";
import { existsSync, readFileSync, readdirSync, realpathSync } from "fs";
import { createServer } from "http";
import { delimiter, dirname, join } from "path";
import { fetchWithSsrFGuard, isWSL2Sync } from "openclaw/plugin-sdk";
var CLIENT_ID_KEYS = ["OPENCLAW_GEMINI_OAUTH_CLIENT_ID", "GEMINI_CLI_OAUTH_CLIENT_ID"];
var CLIENT_SECRET_KEYS = [
  "OPENCLAW_GEMINI_OAUTH_CLIENT_SECRET",
  "GEMINI_CLI_OAUTH_CLIENT_SECRET"
];
var REDIRECT_URI = "http://localhost:8085/oauth2callback";
var AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
var TOKEN_URL = "https://oauth2.googleapis.com/token";
var USERINFO_URL = "https://www.googleapis.com/oauth2/v1/userinfo?alt=json";
var CODE_ASSIST_ENDPOINT_PROD = "https://cloudcode-pa.googleapis.com";
var CODE_ASSIST_ENDPOINT_DAILY = "https://daily-cloudcode-pa.sandbox.googleapis.com";
var CODE_ASSIST_ENDPOINT_AUTOPUSH = "https://autopush-cloudcode-pa.sandbox.googleapis.com";
var LOAD_CODE_ASSIST_ENDPOINTS = [
  CODE_ASSIST_ENDPOINT_PROD,
  CODE_ASSIST_ENDPOINT_DAILY,
  CODE_ASSIST_ENDPOINT_AUTOPUSH
];
var DEFAULT_FETCH_TIMEOUT_MS = 1e4;
var SCOPES = [
  "https://www.googleapis.com/auth/cloud-platform",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile"
];
var TIER_FREE = "free-tier";
var TIER_LEGACY = "legacy-tier";
var TIER_STANDARD = "standard-tier";
function resolveEnv(keys) {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) {
      return value;
    }
  }
  return void 0;
}
var cachedGeminiCliCredentials = null;
function extractGeminiCliCredentials() {
  if (cachedGeminiCliCredentials) {
    return cachedGeminiCliCredentials;
  }
  try {
    const geminiPath = findInPath("gemini");
    if (!geminiPath) {
      return null;
    }
    const resolvedPath = realpathSync(geminiPath);
    const geminiCliDirs = resolveGeminiCliDirs(geminiPath, resolvedPath);
    let content = null;
    for (const geminiCliDir of geminiCliDirs) {
      const searchPaths = [
        join(
          geminiCliDir,
          "node_modules",
          "@google",
          "gemini-cli-core",
          "dist",
          "src",
          "code_assist",
          "oauth2.js"
        ),
        join(
          geminiCliDir,
          "node_modules",
          "@google",
          "gemini-cli-core",
          "dist",
          "code_assist",
          "oauth2.js"
        )
      ];
      for (const p of searchPaths) {
        if (existsSync(p)) {
          content = readFileSync(p, "utf8");
          break;
        }
      }
      if (content) {
        break;
      }
      const found = findFile(geminiCliDir, "oauth2.js", 10);
      if (found) {
        content = readFileSync(found, "utf8");
        break;
      }
    }
    if (!content) {
      return null;
    }
    const idMatch = content.match(/(\d+-[a-z0-9]+\.apps\.googleusercontent\.com)/);
    const secretMatch = content.match(/(GOCSPX-[A-Za-z0-9_-]+)/);
    if (idMatch && secretMatch) {
      cachedGeminiCliCredentials = { clientId: idMatch[1], clientSecret: secretMatch[1] };
      return cachedGeminiCliCredentials;
    }
  } catch {
  }
  return null;
}
function resolveGeminiCliDirs(geminiPath, resolvedPath) {
  const binDir = dirname(geminiPath);
  const candidates = [
    dirname(dirname(resolvedPath)),
    join(dirname(resolvedPath), "node_modules", "@google", "gemini-cli"),
    join(binDir, "node_modules", "@google", "gemini-cli"),
    join(dirname(binDir), "node_modules", "@google", "gemini-cli"),
    join(dirname(binDir), "lib", "node_modules", "@google", "gemini-cli")
  ];
  const deduped = [];
  const seen = /* @__PURE__ */ new Set();
  for (const candidate of candidates) {
    const key = process.platform === "win32" ? candidate.replace(/\\/g, "/").toLowerCase() : candidate;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(candidate);
  }
  return deduped;
}
function findInPath(name) {
  const exts = process.platform === "win32" ? [".cmd", ".bat", ".exe", ""] : [""];
  for (const dir of (process.env.PATH ?? "").split(delimiter)) {
    for (const ext of exts) {
      const p = join(dir, name + ext);
      if (existsSync(p)) {
        return p;
      }
    }
  }
  return null;
}
function findFile(dir, name, depth) {
  if (depth <= 0) {
    return null;
  }
  try {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isFile() && e.name === name) {
        return p;
      }
      if (e.isDirectory() && !e.name.startsWith(".")) {
        const found = findFile(p, name, depth - 1);
        if (found) {
          return found;
        }
      }
    }
  } catch {
  }
  return null;
}
function resolveOAuthClientConfig() {
  const envClientId = resolveEnv(CLIENT_ID_KEYS);
  const envClientSecret = resolveEnv(CLIENT_SECRET_KEYS);
  if (envClientId) {
    return { clientId: envClientId, clientSecret: envClientSecret };
  }
  const extracted = extractGeminiCliCredentials();
  if (extracted) {
    return extracted;
  }
  throw new Error(
    "Gemini CLI not found. Install it first: brew install gemini-cli (or npm install -g @google/gemini-cli), or set GEMINI_CLI_OAUTH_CLIENT_ID."
  );
}
function shouldUseManualOAuthFlow(isRemote) {
  return isRemote || isWSL2Sync();
}
function generatePkce() {
  const verifier = randomBytes(32).toString("hex");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}
function resolvePlatform() {
  if (process.platform === "win32") {
    return "WINDOWS";
  }
  if (process.platform === "darwin") {
    return "MACOS";
  }
  return "PLATFORM_UNSPECIFIED";
}
async function fetchWithTimeout(url, init, timeoutMs = DEFAULT_FETCH_TIMEOUT_MS) {
  const { response, release } = await fetchWithSsrFGuard({
    url,
    init,
    timeoutMs
  });
  try {
    const body = await response.arrayBuffer();
    return new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    });
  } finally {
    await release();
  }
}
function buildAuthUrl(challenge, verifier) {
  const { clientId } = resolveOAuthClientConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    scope: SCOPES.join(" "),
    code_challenge: challenge,
    code_challenge_method: "S256",
    state: verifier,
    access_type: "offline",
    prompt: "consent"
  });
  return `${AUTH_URL}?${params.toString()}`;
}
function parseCallbackInput(input, expectedState) {
  const trimmed = input.trim();
  if (!trimmed) {
    return { error: "No input provided" };
  }
  try {
    const url = new URL(trimmed);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state") ?? expectedState;
    if (!code) {
      return { error: "Missing 'code' parameter in URL" };
    }
    if (!state) {
      return { error: "Missing 'state' parameter. Paste the full URL." };
    }
    return { code, state };
  } catch {
    if (!expectedState) {
      return { error: "Paste the full redirect URL, not just the code." };
    }
    return { code: trimmed, state: expectedState };
  }
}
async function waitForLocalCallback(params) {
  const port = 8085;
  const hostname = "localhost";
  const expectedPath = "/oauth2callback";
  return new Promise((resolve, reject) => {
    let timeout = null;
    const server = createServer((req, res) => {
      try {
        const requestUrl = new URL(req.url ?? "/", `http://${hostname}:${port}`);
        if (requestUrl.pathname !== expectedPath) {
          res.statusCode = 404;
          res.setHeader("Content-Type", "text/plain");
          res.end("Not found");
          return;
        }
        const error = requestUrl.searchParams.get("error");
        const code = requestUrl.searchParams.get("code")?.trim();
        const state = requestUrl.searchParams.get("state")?.trim();
        if (error) {
          res.statusCode = 400;
          res.setHeader("Content-Type", "text/plain");
          res.end(`Authentication failed: ${error}`);
          finish(new Error(`OAuth error: ${error}`));
          return;
        }
        if (!code || !state) {
          res.statusCode = 400;
          res.setHeader("Content-Type", "text/plain");
          res.end("Missing code or state");
          finish(new Error("Missing OAuth code or state"));
          return;
        }
        if (state !== params.expectedState) {
          res.statusCode = 400;
          res.setHeader("Content-Type", "text/plain");
          res.end("Invalid state");
          finish(new Error("OAuth state mismatch"));
          return;
        }
        res.statusCode = 200;
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(
          "<!doctype html><html><head><meta charset='utf-8'/></head><body><h2>Gemini CLI OAuth complete</h2><p>You can close this window and return to OpenClaw.</p></body></html>"
        );
        finish(void 0, { code, state });
      } catch (err) {
        finish(err instanceof Error ? err : new Error("OAuth callback failed"));
      }
    });
    const finish = (err, result) => {
      if (timeout) {
        clearTimeout(timeout);
      }
      try {
        server.close();
      } catch {
      }
      if (err) {
        reject(err);
      } else if (result) {
        resolve(result);
      }
    };
    server.once("error", (err) => {
      finish(err instanceof Error ? err : new Error("OAuth callback server error"));
    });
    server.listen(port, hostname, () => {
      params.onProgress?.(`Waiting for OAuth callback on ${REDIRECT_URI}\u2026`);
    });
    timeout = setTimeout(() => {
      finish(new Error("OAuth callback timeout"));
    }, params.timeoutMs);
  });
}
async function exchangeCodeForTokens(code, verifier) {
  const { clientId, clientSecret } = resolveOAuthClientConfig();
  const body = new URLSearchParams({
    client_id: clientId,
    code,
    grant_type: "authorization_code",
    redirect_uri: REDIRECT_URI,
    code_verifier: verifier
  });
  if (clientSecret) {
    body.set("client_secret", clientSecret);
  }
  const response = await fetchWithTimeout(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      Accept: "*/*",
      "User-Agent": "google-api-nodejs-client/9.15.1"
    },
    body
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token exchange failed: ${errorText}`);
  }
  const data = await response.json();
  if (!data.refresh_token) {
    throw new Error("No refresh token received. Please try again.");
  }
  const email = await getUserEmail(data.access_token);
  const projectId = await discoverProject(data.access_token);
  const expiresAt = Date.now() + data.expires_in * 1e3 - 5 * 60 * 1e3;
  return {
    refresh: data.refresh_token,
    access: data.access_token,
    expires: expiresAt,
    projectId,
    email
  };
}
async function getUserEmail(accessToken) {
  try {
    const response = await fetchWithTimeout(USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (response.ok) {
      const data = await response.json();
      return data.email;
    }
  } catch {
  }
  return void 0;
}
async function discoverProject(accessToken) {
  const envProject = process.env.GOOGLE_CLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT_ID;
  const platform = resolvePlatform();
  const metadata = {
    ideType: "ANTIGRAVITY",
    platform,
    pluginType: "GEMINI"
  };
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    "User-Agent": "google-api-nodejs-client/9.15.1",
    "X-Goog-Api-Client": `gl-node/${process.versions.node}`,
    "Client-Metadata": JSON.stringify(metadata)
  };
  const loadBody = {
    ...envProject ? { cloudaicompanionProject: envProject } : {},
    metadata: {
      ...metadata,
      ...envProject ? { duetProject: envProject } : {}
    }
  };
  let data = {};
  let activeEndpoint = CODE_ASSIST_ENDPOINT_PROD;
  let loadError;
  for (const endpoint of LOAD_CODE_ASSIST_ENDPOINTS) {
    try {
      const response = await fetchWithTimeout(`${endpoint}/v1internal:loadCodeAssist`, {
        method: "POST",
        headers,
        body: JSON.stringify(loadBody)
      });
      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null);
        if (isVpcScAffected(errorPayload)) {
          data = { currentTier: { id: TIER_STANDARD } };
          activeEndpoint = endpoint;
          loadError = void 0;
          break;
        }
        loadError = new Error(`loadCodeAssist failed: ${response.status} ${response.statusText}`);
        continue;
      }
      data = await response.json();
      activeEndpoint = endpoint;
      loadError = void 0;
      break;
    } catch (err) {
      loadError = err instanceof Error ? err : new Error("loadCodeAssist failed", { cause: err });
    }
  }
  const hasLoadCodeAssistData = Boolean(data.currentTier) || Boolean(data.cloudaicompanionProject) || Boolean(data.allowedTiers?.length);
  if (!hasLoadCodeAssistData && loadError) {
    if (envProject) {
      return envProject;
    }
    throw loadError;
  }
  if (data.currentTier) {
    const project = data.cloudaicompanionProject;
    if (typeof project === "string" && project) {
      return project;
    }
    if (typeof project === "object" && project?.id) {
      return project.id;
    }
    if (envProject) {
      return envProject;
    }
    throw new Error(
      "This account requires GOOGLE_CLOUD_PROJECT or GOOGLE_CLOUD_PROJECT_ID to be set."
    );
  }
  const tier = getDefaultTier(data.allowedTiers);
  const tierId = tier?.id || TIER_FREE;
  if (tierId !== TIER_FREE && !envProject) {
    throw new Error(
      "This account requires GOOGLE_CLOUD_PROJECT or GOOGLE_CLOUD_PROJECT_ID to be set."
    );
  }
  const onboardBody = {
    tierId,
    metadata: {
      ...metadata
    }
  };
  if (tierId !== TIER_FREE && envProject) {
    onboardBody.cloudaicompanionProject = envProject;
    onboardBody.metadata.duetProject = envProject;
  }
  const onboardResponse = await fetchWithTimeout(`${activeEndpoint}/v1internal:onboardUser`, {
    method: "POST",
    headers,
    body: JSON.stringify(onboardBody)
  });
  if (!onboardResponse.ok) {
    throw new Error(`onboardUser failed: ${onboardResponse.status} ${onboardResponse.statusText}`);
  }
  let lro = await onboardResponse.json();
  if (!lro.done && lro.name) {
    lro = await pollOperation(activeEndpoint, lro.name, headers);
  }
  const projectId = lro.response?.cloudaicompanionProject?.id;
  if (projectId) {
    return projectId;
  }
  if (envProject) {
    return envProject;
  }
  throw new Error(
    "Could not discover or provision a Google Cloud project. Set GOOGLE_CLOUD_PROJECT or GOOGLE_CLOUD_PROJECT_ID."
  );
}
function isVpcScAffected(payload) {
  if (!payload || typeof payload !== "object") {
    return false;
  }
  const error = payload.error;
  if (!error || typeof error !== "object") {
    return false;
  }
  const details = error.details;
  if (!Array.isArray(details)) {
    return false;
  }
  return details.some(
    (item) => typeof item === "object" && item && item.reason === "SECURITY_POLICY_VIOLATED"
  );
}
function getDefaultTier(allowedTiers) {
  if (!allowedTiers?.length) {
    return { id: TIER_LEGACY };
  }
  return allowedTiers.find((tier) => tier.isDefault) ?? { id: TIER_LEGACY };
}
async function pollOperation(endpoint, operationName, headers) {
  for (let attempt = 0; attempt < 24; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 5e3));
    const response = await fetchWithTimeout(`${endpoint}/v1internal/${operationName}`, {
      headers
    });
    if (!response.ok) {
      continue;
    }
    const data = await response.json();
    if (data.done) {
      return data;
    }
  }
  throw new Error("Operation polling timeout");
}
async function loginGeminiCliOAuth(ctx) {
  const needsManual = shouldUseManualOAuthFlow(ctx.isRemote);
  await ctx.note(
    needsManual ? [
      "You are running in a remote/VPS environment.",
      "A URL will be shown for you to open in your LOCAL browser.",
      "After signing in, copy the redirect URL and paste it back here."
    ].join("\n") : [
      "Browser will open for Google authentication.",
      "Sign in with your Google account for Gemini CLI access.",
      "The callback will be captured automatically on localhost:8085."
    ].join("\n"),
    "Gemini CLI OAuth"
  );
  const { verifier, challenge } = generatePkce();
  const authUrl = buildAuthUrl(challenge, verifier);
  if (needsManual) {
    ctx.progress.update("OAuth URL ready");
    ctx.log(`
Open this URL in your LOCAL browser:

${authUrl}
`);
    ctx.progress.update("Waiting for you to paste the callback URL...");
    const callbackInput = await ctx.prompt("Paste the redirect URL here: ");
    const parsed = parseCallbackInput(callbackInput, verifier);
    if ("error" in parsed) {
      throw new Error(parsed.error);
    }
    if (parsed.state !== verifier) {
      throw new Error("OAuth state mismatch - please try again");
    }
    ctx.progress.update("Exchanging authorization code for tokens...");
    return exchangeCodeForTokens(parsed.code, verifier);
  }
  ctx.progress.update("Complete sign-in in browser...");
  try {
    await ctx.openUrl(authUrl);
  } catch {
    ctx.log(`
Open this URL in your browser:

${authUrl}
`);
  }
  try {
    const { code } = await waitForLocalCallback({
      expectedState: verifier,
      timeoutMs: 5 * 60 * 1e3,
      onProgress: (msg) => ctx.progress.update(msg)
    });
    ctx.progress.update("Exchanging authorization code for tokens...");
    return await exchangeCodeForTokens(code, verifier);
  } catch (err) {
    if (err instanceof Error && (err.message.includes("EADDRINUSE") || err.message.includes("port") || err.message.includes("listen"))) {
      ctx.progress.update("Local callback server failed. Switching to manual mode...");
      ctx.log(`
Open this URL in your LOCAL browser:

${authUrl}
`);
      const callbackInput = await ctx.prompt("Paste the redirect URL here: ");
      const parsed = parseCallbackInput(callbackInput, verifier);
      if ("error" in parsed) {
        throw new Error(parsed.error, { cause: err });
      }
      if (parsed.state !== verifier) {
        throw new Error("OAuth state mismatch - please try again", { cause: err });
      }
      ctx.progress.update("Exchanging authorization code for tokens...");
      return exchangeCodeForTokens(parsed.code, verifier);
    }
    throw err;
  }
}

// vendor/openclaw-runtime/win-x64/extensions/google-gemini-cli-auth/index.ts
var PROVIDER_ID = "google-gemini-cli";
var PROVIDER_LABEL = "Gemini CLI OAuth";
var DEFAULT_MODEL = "google-gemini-cli/gemini-3-pro-preview";
var ENV_VARS = [
  "OPENCLAW_GEMINI_OAUTH_CLIENT_ID",
  "OPENCLAW_GEMINI_OAUTH_CLIENT_SECRET",
  "GEMINI_CLI_OAUTH_CLIENT_ID",
  "GEMINI_CLI_OAUTH_CLIENT_SECRET"
];
var geminiCliPlugin = {
  id: "google-gemini-cli-auth",
  name: "Google Gemini CLI Auth",
  description: "OAuth flow for Gemini CLI (Google Code Assist)",
  configSchema: emptyPluginConfigSchema(),
  register(api) {
    api.registerProvider({
      id: PROVIDER_ID,
      label: PROVIDER_LABEL,
      docsPath: "/providers/models",
      aliases: ["gemini-cli"],
      envVars: ENV_VARS,
      auth: [
        {
          id: "oauth",
          label: "Google OAuth",
          hint: "PKCE + localhost callback",
          kind: "oauth",
          run: async (ctx) => {
            const spin = ctx.prompter.progress("Starting Gemini CLI OAuth\u2026");
            try {
              const result = await loginGeminiCliOAuth({
                isRemote: ctx.isRemote,
                openUrl: ctx.openUrl,
                log: (msg) => ctx.runtime.log(msg),
                note: ctx.prompter.note,
                prompt: async (message) => String(await ctx.prompter.text({ message })),
                progress: spin
              });
              spin.stop("Gemini CLI OAuth complete");
              return buildOauthProviderAuthResult({
                providerId: PROVIDER_ID,
                defaultModel: DEFAULT_MODEL,
                access: result.access,
                refresh: result.refresh,
                expires: result.expires,
                email: result.email,
                credentialExtra: { projectId: result.projectId },
                notes: ["If requests fail, set GOOGLE_CLOUD_PROJECT or GOOGLE_CLOUD_PROJECT_ID."]
              });
            } catch (err) {
              spin.stop("Gemini CLI OAuth failed");
              await ctx.prompter.note(
                "Trouble with OAuth? Ensure your Google account has Gemini CLI access.",
                "OAuth help"
              );
              throw err;
            }
          }
        }
      ]
    });
  }
};
var google_gemini_cli_auth_default = geminiCliPlugin;
export {
  google_gemini_cli_auth_default as default
};
