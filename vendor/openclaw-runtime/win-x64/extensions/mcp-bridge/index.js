// vendor/openclaw-runtime/win-x64/extensions/mcp-bridge/index.ts
import { Type } from "@sinclair/typebox";
var DEFAULT_TIMEOUT_MS = 12e4;
var FALLBACK_INPUT_SCHEMA = Type.Object({}, { additionalProperties: true });
var isRecord = (value) => {
  return !!value && typeof value === "object" && !Array.isArray(value);
};
var sanitizeToolSegment = (value) => {
  const sanitized = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return sanitized || "tool";
};
var buildRegisteredToolName = (server, tool, usedNames) => {
  const base = `mcp_${sanitizeToolSegment(server)}_${sanitizeToolSegment(tool)}`;
  let next = base;
  let index = 2;
  while (usedNames.has(next)) {
    next = `${base}_${index}`;
    index += 1;
  }
  usedNames.add(next);
  return next;
};
var normalizeInputSchema = (value) => {
  return isRecord(value) ? value : FALLBACK_INPUT_SCHEMA;
};
var parseToolConfig = (value) => {
  if (!isRecord(value)) {
    return null;
  }
  const server = typeof value.server === "string" ? value.server.trim() : "";
  const name = typeof value.name === "string" ? value.name.trim() : "";
  if (!server || !name) {
    return null;
  }
  return {
    server,
    name,
    description: typeof value.description === "string" ? value.description.trim() : void 0,
    inputSchema: normalizeInputSchema(value.inputSchema)
  };
};
var parsePluginConfig = (value) => {
  const raw = isRecord(value) ? value : {};
  const tools = Array.isArray(raw.tools) ? raw.tools.map(parseToolConfig).filter((tool) => !!tool) : [];
  return {
    callbackUrl: typeof raw.callbackUrl === "string" ? raw.callbackUrl.trim() : "",
    secret: typeof raw.secret === "string" ? raw.secret.trim() : "",
    requestTimeoutMs: typeof raw.requestTimeoutMs === "number" && Number.isFinite(raw.requestTimeoutMs) && raw.requestTimeoutMs > 0 ? Math.max(1e3, Math.floor(raw.requestTimeoutMs)) : DEFAULT_TIMEOUT_MS,
    tools
  };
};
var extractErrorMessage = (payload) => {
  if (!payload) {
    return null;
  }
  if (typeof payload === "string") {
    return payload.trim() || null;
  }
  if (!isRecord(payload)) {
    return null;
  }
  if (typeof payload.error === "string" && payload.error.trim()) {
    return payload.error.trim();
  }
  const content = Array.isArray(payload.content) ? payload.content : [];
  for (const block of content) {
    if (!isRecord(block)) {
      continue;
    }
    if (block.type === "text" && typeof block.text === "string" && block.text.trim()) {
      return block.text.trim();
    }
  }
  return null;
};
var ensureToolResultPayload = (payload, details) => {
  if (isRecord(payload) && Array.isArray(payload.content)) {
    return {
      ...payload,
      details: payload.details ?? details
    };
  }
  const text = typeof payload === "string" ? payload : JSON.stringify(payload ?? { ok: true }, null, 2);
  return {
    content: [{ type: "text", text }],
    details: payload ?? details
  };
};
var buildToolDescription = (tool) => {
  const parts = [
    `Proxy to MCP tool "${tool.name}" on server "${tool.server}".`
  ];
  if (tool.description) {
    parts.push(tool.description);
  }
  return parts.join(" ");
};
var invokeBridge = async (config, tool, args) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.requestTimeoutMs);
  try {
    const response = await fetch(config.callbackUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-mcp-bridge-secret": config.secret
      },
      body: JSON.stringify({
        server: tool.server,
        tool: tool.name,
        args
      }),
      signal: controller.signal
    });
    const responseText = await response.text();
    let payload = null;
    if (responseText.trim()) {
      try {
        payload = JSON.parse(responseText);
      } catch {
        if (!response.ok) {
          throw new Error(`MCP bridge HTTP ${response.status}: ${responseText.trim()}`);
        }
        payload = responseText;
      }
    }
    if (!response.ok) {
      const message = extractErrorMessage(payload) || response.statusText || "Unknown MCP bridge error";
      throw new Error(`MCP bridge HTTP ${response.status}: ${message}`);
    }
    return payload;
  } finally {
    clearTimeout(timer);
  }
};
var plugin = {
  id: "mcp-bridge",
  name: "MCP Bridge",
  description: "Expose LobsterAI-managed MCP servers as native OpenClaw tools.",
  configSchema: {
    parse(value) {
      return parsePluginConfig(value);
    },
    uiHints: {
      callbackUrl: { label: "Callback URL", advanced: true },
      secret: { label: "Secret", sensitive: true, advanced: true },
      requestTimeoutMs: { label: "Request Timeout (ms)", advanced: true }
    }
  },
  register(api) {
    const config = parsePluginConfig(api.pluginConfig);
    if (!config.callbackUrl || !config.secret || config.tools.length === 0) {
      api.logger.info("[mcp-bridge] skipped registration because callbackUrl/secret/tools are incomplete.");
      return;
    }
    const usedToolNames = /* @__PURE__ */ new Set();
    for (const tool of config.tools) {
      const registeredName = buildRegisteredToolName(tool.server, tool.name, usedToolNames);
      const details = {
        alias: registeredName,
        server: tool.server,
        tool: tool.name
      };
      api.registerTool({
        name: registeredName,
        label: `MCP ${tool.server}/${tool.name}`,
        description: buildToolDescription(tool),
        parameters: tool.inputSchema,
        async execute(_id, params) {
          try {
            const payload = await invokeBridge(config, tool, params);
            return ensureToolResultPayload(payload, details);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return {
              content: [{ type: "text", text: message }],
              isError: true,
              details
            };
          }
        }
      });
    }
    api.logger.info(`[mcp-bridge] registered ${config.tools.length} tool(s).`);
  }
};
var mcp_bridge_default = plugin;
export {
  mcp_bridge_default as default
};
