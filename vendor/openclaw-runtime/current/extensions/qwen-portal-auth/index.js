// vendor/openclaw-runtime/win-x64/extensions/qwen-portal-auth/index.ts
import {
  emptyPluginConfigSchema
} from "openclaw/plugin-sdk";

// vendor/openclaw-runtime/win-x64/extensions/qwen-portal-auth/oauth.ts
import { randomUUID } from "crypto";
import { generatePkceVerifierChallenge, toFormUrlEncoded } from "openclaw/plugin-sdk";
var QWEN_OAUTH_BASE_URL = "https://chat.qwen.ai";
var QWEN_OAUTH_DEVICE_CODE_ENDPOINT = `${QWEN_OAUTH_BASE_URL}/api/v1/oauth2/device/code`;
var QWEN_OAUTH_TOKEN_ENDPOINT = `${QWEN_OAUTH_BASE_URL}/api/v1/oauth2/token`;
var QWEN_OAUTH_CLIENT_ID = "f0304373b74a44d2b584a3fb70ca9e56";
var QWEN_OAUTH_SCOPE = "openid profile email model.completion";
var QWEN_OAUTH_GRANT_TYPE = "urn:ietf:params:oauth:grant-type:device_code";
async function requestDeviceCode(params) {
  const response = await fetch(QWEN_OAUTH_DEVICE_CODE_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      "x-request-id": randomUUID()
    },
    body: toFormUrlEncoded({
      client_id: QWEN_OAUTH_CLIENT_ID,
      scope: QWEN_OAUTH_SCOPE,
      code_challenge: params.challenge,
      code_challenge_method: "S256"
    })
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Qwen device authorization failed: ${text || response.statusText}`);
  }
  const payload = await response.json();
  if (!payload.device_code || !payload.user_code || !payload.verification_uri) {
    throw new Error(
      payload.error ?? "Qwen device authorization returned an incomplete payload (missing user_code or verification_uri)."
    );
  }
  return payload;
}
async function pollDeviceToken(params) {
  const response = await fetch(QWEN_OAUTH_TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json"
    },
    body: toFormUrlEncoded({
      grant_type: QWEN_OAUTH_GRANT_TYPE,
      client_id: QWEN_OAUTH_CLIENT_ID,
      device_code: params.deviceCode,
      code_verifier: params.verifier
    })
  });
  if (!response.ok) {
    let payload;
    try {
      payload = await response.json();
    } catch {
      const text = await response.text();
      return { status: "error", message: text || response.statusText };
    }
    if (payload?.error === "authorization_pending") {
      return { status: "pending" };
    }
    if (payload?.error === "slow_down") {
      return { status: "pending", slowDown: true };
    }
    return {
      status: "error",
      message: payload?.error_description || payload?.error || response.statusText
    };
  }
  const tokenPayload = await response.json();
  if (!tokenPayload.access_token || !tokenPayload.refresh_token || !tokenPayload.expires_in) {
    return { status: "error", message: "Qwen OAuth returned incomplete token payload." };
  }
  return {
    status: "success",
    token: {
      access: tokenPayload.access_token,
      refresh: tokenPayload.refresh_token,
      expires: Date.now() + tokenPayload.expires_in * 1e3,
      resourceUrl: tokenPayload.resource_url
    }
  };
}
async function loginQwenPortalOAuth(params) {
  const { verifier, challenge } = generatePkceVerifierChallenge();
  const device = await requestDeviceCode({ challenge });
  const verificationUrl = device.verification_uri_complete || device.verification_uri;
  await params.note(
    [
      `Open ${verificationUrl} to approve access.`,
      `If prompted, enter the code ${device.user_code}.`
    ].join("\n"),
    "Qwen OAuth"
  );
  try {
    await params.openUrl(verificationUrl);
  } catch {
  }
  const start = Date.now();
  let pollIntervalMs = device.interval ? device.interval * 1e3 : 2e3;
  const timeoutMs = device.expires_in * 1e3;
  while (Date.now() - start < timeoutMs) {
    params.progress.update("Waiting for Qwen OAuth approval\u2026");
    const result = await pollDeviceToken({
      deviceCode: device.device_code,
      verifier
    });
    if (result.status === "success") {
      return result.token;
    }
    if (result.status === "error") {
      throw new Error(`Qwen OAuth failed: ${result.message}`);
    }
    if (result.status === "pending" && result.slowDown) {
      pollIntervalMs = Math.min(pollIntervalMs * 1.5, 1e4);
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
  throw new Error("Qwen OAuth timed out waiting for authorization.");
}

// vendor/openclaw-runtime/win-x64/extensions/qwen-portal-auth/index.ts
var PROVIDER_ID = "qwen-portal";
var PROVIDER_LABEL = "Qwen";
var DEFAULT_MODEL = "qwen-portal/coder-model";
var DEFAULT_BASE_URL = "https://portal.qwen.ai/v1";
var DEFAULT_CONTEXT_WINDOW = 128e3;
var DEFAULT_MAX_TOKENS = 8192;
var OAUTH_PLACEHOLDER = "qwen-oauth";
function normalizeBaseUrl(value) {
  const raw = value?.trim() || DEFAULT_BASE_URL;
  const withProtocol = raw.startsWith("http") ? raw : `https://${raw}`;
  return withProtocol.endsWith("/v1") ? withProtocol : `${withProtocol.replace(/\/+$/, "")}/v1`;
}
function buildModelDefinition(params) {
  return {
    id: params.id,
    name: params.name,
    reasoning: false,
    input: params.input,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: DEFAULT_CONTEXT_WINDOW,
    maxTokens: DEFAULT_MAX_TOKENS
  };
}
var qwenPortalPlugin = {
  id: "qwen-portal-auth",
  name: "Qwen OAuth",
  description: "OAuth flow for Qwen (free-tier) models",
  configSchema: emptyPluginConfigSchema(),
  register(api) {
    api.registerProvider({
      id: PROVIDER_ID,
      label: PROVIDER_LABEL,
      docsPath: "/providers/qwen",
      aliases: ["qwen"],
      auth: [
        {
          id: "device",
          label: "Qwen OAuth",
          hint: "Device code login",
          kind: "device_code",
          run: async (ctx) => {
            const progress = ctx.prompter.progress("Starting Qwen OAuth\u2026");
            try {
              const result = await loginQwenPortalOAuth({
                openUrl: ctx.openUrl,
                note: ctx.prompter.note,
                progress
              });
              progress.stop("Qwen OAuth complete");
              const profileId = `${PROVIDER_ID}:default`;
              const baseUrl = normalizeBaseUrl(result.resourceUrl);
              return {
                profiles: [
                  {
                    profileId,
                    credential: {
                      type: "oauth",
                      provider: PROVIDER_ID,
                      access: result.access,
                      refresh: result.refresh,
                      expires: result.expires
                    }
                  }
                ],
                configPatch: {
                  models: {
                    providers: {
                      [PROVIDER_ID]: {
                        baseUrl,
                        apiKey: OAUTH_PLACEHOLDER,
                        api: "openai-completions",
                        models: [
                          buildModelDefinition({
                            id: "coder-model",
                            name: "Qwen Coder",
                            input: ["text"]
                          }),
                          buildModelDefinition({
                            id: "vision-model",
                            name: "Qwen Vision",
                            input: ["text", "image"]
                          })
                        ]
                      }
                    }
                  },
                  agents: {
                    defaults: {
                      models: {
                        "qwen-portal/coder-model": { alias: "qwen" },
                        "qwen-portal/vision-model": {}
                      }
                    }
                  }
                },
                defaultModel: DEFAULT_MODEL,
                notes: [
                  "Qwen OAuth tokens auto-refresh. Re-run login if refresh fails or access is revoked.",
                  `Base URL defaults to ${DEFAULT_BASE_URL}. Override models.providers.${PROVIDER_ID}.baseUrl if needed.`
                ]
              };
            } catch (err) {
              progress.stop("Qwen OAuth failed");
              await ctx.prompter.note(
                "If OAuth fails, verify your Qwen account has portal access and try again.",
                "Qwen OAuth"
              );
              throw err;
            }
          }
        }
      ]
    });
  }
};
var qwen_portal_auth_default = qwenPortalPlugin;
export {
  qwen_portal_auth_default as default
};
