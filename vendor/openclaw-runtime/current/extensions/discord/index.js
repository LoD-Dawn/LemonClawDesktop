// vendor/openclaw-runtime/win-x64/extensions/discord/index.ts
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";

// vendor/openclaw-runtime/win-x64/extensions/discord/src/channel.ts
import {
  applyAccountNameToChannelSection,
  buildChannelConfigSchema,
  buildTokenChannelStatusSummary,
  collectDiscordAuditChannelIds,
  collectDiscordStatusIssues,
  DEFAULT_ACCOUNT_ID,
  deleteAccountFromConfigSection,
  discordOnboardingAdapter,
  DiscordConfigSchema,
  formatPairingApproveHint,
  getChatChannelMeta,
  listDiscordAccountIds,
  listDiscordDirectoryGroupsFromConfig,
  listDiscordDirectoryPeersFromConfig,
  looksLikeDiscordTargetId,
  migrateBaseNameToDefaultAccount,
  normalizeAccountId,
  normalizeDiscordMessagingTarget,
  normalizeDiscordOutboundTarget,
  PAIRING_APPROVED_MESSAGE,
  resolveDiscordAccount,
  resolveDefaultDiscordAccountId,
  resolveDiscordGroupRequireMention,
  resolveDiscordGroupToolPolicy,
  resolveOpenProviderRuntimeGroupPolicy,
  resolveDefaultGroupPolicy,
  setAccountEnabledInConfigSection
} from "openclaw/plugin-sdk";

// vendor/openclaw-runtime/win-x64/extensions/discord/src/runtime.ts
var runtime = null;
function setDiscordRuntime(next) {
  runtime = next;
}
function getDiscordRuntime() {
  if (!runtime) {
    throw new Error("Discord runtime not initialized");
  }
  return runtime;
}

// vendor/openclaw-runtime/win-x64/extensions/discord/src/channel.ts
var meta = getChatChannelMeta("discord");
var discordMessageActions = {
  listActions: (ctx) => getDiscordRuntime().channel.discord.messageActions?.listActions?.(ctx) ?? [],
  extractToolSend: (ctx) => getDiscordRuntime().channel.discord.messageActions?.extractToolSend?.(ctx) ?? null,
  handleAction: async (ctx) => {
    const ma = getDiscordRuntime().channel.discord.messageActions;
    if (!ma?.handleAction) {
      throw new Error("Discord message actions not available");
    }
    return ma.handleAction(ctx);
  }
};
var discordPlugin = {
  id: "discord",
  meta: {
    ...meta
  },
  onboarding: discordOnboardingAdapter,
  pairing: {
    idLabel: "discordUserId",
    normalizeAllowEntry: (entry) => entry.replace(/^(discord|user):/i, ""),
    notifyApproval: async ({ id }) => {
      await getDiscordRuntime().channel.discord.sendMessageDiscord(
        `user:${id}`,
        PAIRING_APPROVED_MESSAGE
      );
    }
  },
  capabilities: {
    chatTypes: ["direct", "channel", "thread"],
    polls: true,
    reactions: true,
    threads: true,
    media: true,
    nativeCommands: true
  },
  streaming: {
    blockStreamingCoalesceDefaults: { minChars: 1500, idleMs: 1e3 }
  },
  reload: { configPrefixes: ["channels.discord"] },
  configSchema: buildChannelConfigSchema(DiscordConfigSchema),
  config: {
    listAccountIds: (cfg) => listDiscordAccountIds(cfg),
    resolveAccount: (cfg, accountId) => resolveDiscordAccount({ cfg, accountId }),
    defaultAccountId: (cfg) => resolveDefaultDiscordAccountId(cfg),
    setAccountEnabled: ({ cfg, accountId, enabled }) => setAccountEnabledInConfigSection({
      cfg,
      sectionKey: "discord",
      accountId,
      enabled,
      allowTopLevel: true
    }),
    deleteAccount: ({ cfg, accountId }) => deleteAccountFromConfigSection({
      cfg,
      sectionKey: "discord",
      accountId,
      clearBaseFields: ["token", "name"]
    }),
    isConfigured: (account) => Boolean(account.token?.trim()),
    describeAccount: (account) => ({
      accountId: account.accountId,
      name: account.name,
      enabled: account.enabled,
      configured: Boolean(account.token?.trim()),
      tokenSource: account.tokenSource
    }),
    resolveAllowFrom: ({ cfg, accountId }) => (resolveDiscordAccount({ cfg, accountId }).config.dm?.allowFrom ?? []).map(
      (entry) => String(entry)
    ),
    formatAllowFrom: ({ allowFrom }) => allowFrom.map((entry) => String(entry).trim()).filter(Boolean).map((entry) => entry.toLowerCase()),
    resolveDefaultTo: ({ cfg, accountId }) => resolveDiscordAccount({ cfg, accountId }).config.defaultTo?.trim() || void 0
  },
  security: {
    resolveDmPolicy: ({ cfg, accountId, account }) => {
      const resolvedAccountId = accountId ?? account.accountId ?? DEFAULT_ACCOUNT_ID;
      const useAccountPath = Boolean(cfg.channels?.discord?.accounts?.[resolvedAccountId]);
      const allowFromPath = useAccountPath ? `channels.discord.accounts.${resolvedAccountId}.dm.` : "channels.discord.dm.";
      return {
        policy: account.config.dm?.policy ?? "pairing",
        allowFrom: account.config.dm?.allowFrom ?? [],
        allowFromPath,
        approveHint: formatPairingApproveHint("discord"),
        normalizeEntry: (raw) => raw.replace(/^(discord|user):/i, "").replace(/^<@!?(\d+)>$/, "$1")
      };
    },
    collectWarnings: ({ account, cfg }) => {
      const warnings = [];
      const defaultGroupPolicy = resolveDefaultGroupPolicy(cfg);
      const { groupPolicy } = resolveOpenProviderRuntimeGroupPolicy({
        providerConfigPresent: cfg.channels?.discord !== void 0,
        groupPolicy: account.config.groupPolicy,
        defaultGroupPolicy
      });
      const guildEntries = account.config.guilds ?? {};
      const guildsConfigured = Object.keys(guildEntries).length > 0;
      const channelAllowlistConfigured = guildsConfigured;
      if (groupPolicy === "open") {
        if (channelAllowlistConfigured) {
          warnings.push(
            `- Discord guilds: groupPolicy="open" allows any channel not explicitly denied to trigger (mention-gated). Set channels.discord.groupPolicy="allowlist" and configure channels.discord.guilds.<id>.channels.`
          );
        } else {
          warnings.push(
            `- Discord guilds: groupPolicy="open" with no guild/channel allowlist; any channel can trigger (mention-gated). Set channels.discord.groupPolicy="allowlist" and configure channels.discord.guilds.<id>.channels.`
          );
        }
      }
      return warnings;
    }
  },
  groups: {
    resolveRequireMention: resolveDiscordGroupRequireMention,
    resolveToolPolicy: resolveDiscordGroupToolPolicy
  },
  mentions: {
    stripPatterns: () => ["<@!?\\d+>"]
  },
  threading: {
    resolveReplyToMode: ({ cfg }) => cfg.channels?.discord?.replyToMode ?? "off"
  },
  agentPrompt: {
    messageToolHints: () => [
      "- Discord components: set `components` when sending messages to include buttons, selects, or v2 containers.",
      "- Forms: add `components.modal` (title, fields). OpenClaw adds a trigger button and routes submissions as new messages."
    ]
  },
  messaging: {
    normalizeTarget: normalizeDiscordMessagingTarget,
    targetResolver: {
      looksLikeId: looksLikeDiscordTargetId,
      hint: "<channelId|user:ID|channel:ID>"
    }
  },
  directory: {
    self: async () => null,
    listPeers: async (params) => listDiscordDirectoryPeersFromConfig(params),
    listGroups: async (params) => listDiscordDirectoryGroupsFromConfig(params),
    listPeersLive: async (params) => getDiscordRuntime().channel.discord.listDirectoryPeersLive(params),
    listGroupsLive: async (params) => getDiscordRuntime().channel.discord.listDirectoryGroupsLive(params)
  },
  resolver: {
    resolveTargets: async ({ cfg, accountId, inputs, kind }) => {
      const account = resolveDiscordAccount({ cfg, accountId });
      const token = account.token?.trim();
      if (!token) {
        return inputs.map((input) => ({
          input,
          resolved: false,
          note: "missing Discord token"
        }));
      }
      if (kind === "group") {
        const resolved2 = await getDiscordRuntime().channel.discord.resolveChannelAllowlist({
          token,
          entries: inputs
        });
        return resolved2.map((entry) => ({
          input: entry.input,
          resolved: entry.resolved,
          id: entry.channelId ?? entry.guildId,
          name: entry.channelName ?? entry.guildName ?? (entry.guildId && !entry.channelId ? entry.guildId : void 0),
          note: entry.note
        }));
      }
      const resolved = await getDiscordRuntime().channel.discord.resolveUserAllowlist({
        token,
        entries: inputs
      });
      return resolved.map((entry) => ({
        input: entry.input,
        resolved: entry.resolved,
        id: entry.id,
        name: entry.name,
        note: entry.note
      }));
    }
  },
  actions: discordMessageActions,
  setup: {
    resolveAccountId: ({ accountId }) => normalizeAccountId(accountId),
    applyAccountName: ({ cfg, accountId, name }) => applyAccountNameToChannelSection({
      cfg,
      channelKey: "discord",
      accountId,
      name
    }),
    validateInput: ({ accountId, input }) => {
      if (input.useEnv && accountId !== DEFAULT_ACCOUNT_ID) {
        return "DISCORD_BOT_TOKEN can only be used for the default account.";
      }
      if (!input.useEnv && !input.token) {
        return "Discord requires token (or --use-env).";
      }
      return null;
    },
    applyAccountConfig: ({ cfg, accountId, input }) => {
      const namedConfig = applyAccountNameToChannelSection({
        cfg,
        channelKey: "discord",
        accountId,
        name: input.name
      });
      const next = accountId !== DEFAULT_ACCOUNT_ID ? migrateBaseNameToDefaultAccount({
        cfg: namedConfig,
        channelKey: "discord"
      }) : namedConfig;
      if (accountId === DEFAULT_ACCOUNT_ID) {
        return {
          ...next,
          channels: {
            ...next.channels,
            discord: {
              ...next.channels?.discord,
              enabled: true,
              ...input.useEnv ? {} : input.token ? { token: input.token } : {}
            }
          }
        };
      }
      return {
        ...next,
        channels: {
          ...next.channels,
          discord: {
            ...next.channels?.discord,
            enabled: true,
            accounts: {
              ...next.channels?.discord?.accounts,
              [accountId]: {
                ...next.channels?.discord?.accounts?.[accountId],
                enabled: true,
                ...input.token ? { token: input.token } : {}
              }
            }
          }
        }
      };
    }
  },
  outbound: {
    deliveryMode: "direct",
    chunker: null,
    textChunkLimit: 2e3,
    pollMaxOptions: 10,
    resolveTarget: ({ to }) => normalizeDiscordOutboundTarget(to),
    sendText: async ({ to, text, accountId, deps, replyToId, silent }) => {
      const send = deps?.sendDiscord ?? getDiscordRuntime().channel.discord.sendMessageDiscord;
      const result = await send(to, text, {
        verbose: false,
        replyTo: replyToId ?? void 0,
        accountId: accountId ?? void 0,
        silent: silent ?? void 0
      });
      return { channel: "discord", ...result };
    },
    sendMedia: async ({
      to,
      text,
      mediaUrl,
      mediaLocalRoots,
      accountId,
      deps,
      replyToId,
      silent
    }) => {
      const send = deps?.sendDiscord ?? getDiscordRuntime().channel.discord.sendMessageDiscord;
      const result = await send(to, text, {
        verbose: false,
        mediaUrl,
        mediaLocalRoots,
        replyTo: replyToId ?? void 0,
        accountId: accountId ?? void 0,
        silent: silent ?? void 0
      });
      return { channel: "discord", ...result };
    },
    sendPoll: async ({ to, poll, accountId, silent }) => await getDiscordRuntime().channel.discord.sendPollDiscord(to, poll, {
      accountId: accountId ?? void 0,
      silent: silent ?? void 0
    })
  },
  status: {
    defaultRuntime: {
      accountId: DEFAULT_ACCOUNT_ID,
      running: false,
      connected: false,
      reconnectAttempts: 0,
      lastConnectedAt: null,
      lastDisconnect: null,
      lastEventAt: null,
      lastStartAt: null,
      lastStopAt: null,
      lastError: null
    },
    collectStatusIssues: collectDiscordStatusIssues,
    buildChannelSummary: ({ snapshot }) => buildTokenChannelStatusSummary(snapshot, { includeMode: false }),
    probeAccount: async ({ account, timeoutMs }) => getDiscordRuntime().channel.discord.probeDiscord(account.token, timeoutMs, {
      includeApplication: true
    }),
    auditAccount: async ({ account, timeoutMs, cfg }) => {
      const { channelIds, unresolvedChannels } = collectDiscordAuditChannelIds({
        cfg,
        accountId: account.accountId
      });
      if (!channelIds.length && unresolvedChannels === 0) {
        return void 0;
      }
      const botToken = account.token?.trim();
      if (!botToken) {
        return {
          ok: unresolvedChannels === 0,
          checkedChannels: 0,
          unresolvedChannels,
          channels: [],
          elapsedMs: 0
        };
      }
      const audit = await getDiscordRuntime().channel.discord.auditChannelPermissions({
        token: botToken,
        accountId: account.accountId,
        channelIds,
        timeoutMs
      });
      return { ...audit, unresolvedChannels };
    },
    buildAccountSnapshot: ({ account, runtime: runtime2, probe, audit }) => {
      const configured = Boolean(account.token?.trim());
      const app = runtime2?.application ?? probe?.application;
      const bot = runtime2?.bot ?? probe?.bot;
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
        connected: runtime2?.connected ?? false,
        reconnectAttempts: runtime2?.reconnectAttempts,
        lastConnectedAt: runtime2?.lastConnectedAt ?? null,
        lastDisconnect: runtime2?.lastDisconnect ?? null,
        lastEventAt: runtime2?.lastEventAt ?? null,
        application: app ?? void 0,
        bot: bot ?? void 0,
        probe,
        audit,
        lastInboundAt: runtime2?.lastInboundAt ?? null,
        lastOutboundAt: runtime2?.lastOutboundAt ?? null
      };
    }
  },
  gateway: {
    startAccount: async (ctx) => {
      const account = ctx.account;
      const token = account.token.trim();
      let discordBotLabel = "";
      try {
        const probe = await getDiscordRuntime().channel.discord.probeDiscord(token, 2500, {
          includeApplication: true
        });
        const username = probe.ok ? probe.bot?.username?.trim() : null;
        if (username) {
          discordBotLabel = ` (@${username})`;
        }
        ctx.setStatus({
          accountId: account.accountId,
          bot: probe.bot,
          application: probe.application
        });
        const messageContent = probe.application?.intents?.messageContent;
        if (messageContent === "disabled") {
          ctx.log?.warn(
            `[${account.accountId}] Discord Message Content Intent is disabled; bot may not respond to channel messages. Enable it in Discord Dev Portal (Bot \u2192 Privileged Gateway Intents) or require mentions.`
          );
        } else if (messageContent === "limited") {
          ctx.log?.info(
            `[${account.accountId}] Discord Message Content Intent is limited; bots under 100 servers can use it without verification.`
          );
        }
      } catch (err) {
        if (getDiscordRuntime().logging.shouldLogVerbose()) {
          ctx.log?.debug?.(`[${account.accountId}] bot probe failed: ${String(err)}`);
        }
      }
      ctx.log?.info(`[${account.accountId}] starting provider${discordBotLabel}`);
      return getDiscordRuntime().channel.discord.monitorDiscordProvider({
        token,
        accountId: account.accountId,
        config: ctx.cfg,
        runtime: ctx.runtime,
        abortSignal: ctx.abortSignal,
        mediaMaxMb: account.config.mediaMaxMb,
        historyLimit: account.config.historyLimit,
        setStatus: (patch) => ctx.setStatus({ accountId: account.accountId, ...patch })
      });
    }
  }
};

// vendor/openclaw-runtime/win-x64/extensions/discord/src/subagent-hooks.ts
import {
  autoBindSpawnedDiscordSubagent,
  listThreadBindingsBySessionKey,
  resolveDiscordAccount as resolveDiscordAccount2,
  unbindThreadBindingsBySessionKey
} from "openclaw/plugin-sdk";
function summarizeError(err) {
  if (err instanceof Error) {
    return err.message;
  }
  if (typeof err === "string") {
    return err;
  }
  return "error";
}
function registerDiscordSubagentHooks(api) {
  const resolveThreadBindingFlags = (accountId) => {
    const account = resolveDiscordAccount2({
      cfg: api.config,
      accountId
    });
    const baseThreadBindings = api.config.channels?.discord?.threadBindings;
    const accountThreadBindings = api.config.channels?.discord?.accounts?.[account.accountId]?.threadBindings;
    return {
      enabled: accountThreadBindings?.enabled ?? baseThreadBindings?.enabled ?? api.config.session?.threadBindings?.enabled ?? true,
      spawnSubagentSessions: accountThreadBindings?.spawnSubagentSessions ?? baseThreadBindings?.spawnSubagentSessions ?? false
    };
  };
  api.on("subagent_spawning", async (event) => {
    if (!event.threadRequested) {
      return;
    }
    const channel = event.requester?.channel?.trim().toLowerCase();
    if (channel !== "discord") {
      return;
    }
    const threadBindingFlags = resolveThreadBindingFlags(event.requester?.accountId);
    if (!threadBindingFlags.enabled) {
      return {
        status: "error",
        error: "Discord thread bindings are disabled (set channels.discord.threadBindings.enabled=true to override for this account, or session.threadBindings.enabled=true globally)."
      };
    }
    if (!threadBindingFlags.spawnSubagentSessions) {
      return {
        status: "error",
        error: "Discord thread-bound subagent spawns are disabled for this account (set channels.discord.threadBindings.spawnSubagentSessions=true to enable)."
      };
    }
    try {
      const binding = await autoBindSpawnedDiscordSubagent({
        accountId: event.requester?.accountId,
        channel: event.requester?.channel,
        to: event.requester?.to,
        threadId: event.requester?.threadId,
        childSessionKey: event.childSessionKey,
        agentId: event.agentId,
        label: event.label,
        boundBy: "system"
      });
      if (!binding) {
        return {
          status: "error",
          error: "Unable to create or bind a Discord thread for this subagent session. Session mode is unavailable for this target."
        };
      }
      return { status: "ok", threadBindingReady: true };
    } catch (err) {
      return {
        status: "error",
        error: `Discord thread bind failed: ${summarizeError(err)}`
      };
    }
  });
  api.on("subagent_ended", (event) => {
    unbindThreadBindingsBySessionKey({
      targetSessionKey: event.targetSessionKey,
      accountId: event.accountId,
      targetKind: event.targetKind,
      reason: event.reason,
      sendFarewell: event.sendFarewell
    });
  });
  api.on("subagent_delivery_target", (event) => {
    if (!event.expectsCompletionMessage) {
      return;
    }
    const requesterChannel = event.requesterOrigin?.channel?.trim().toLowerCase();
    if (requesterChannel !== "discord") {
      return;
    }
    const requesterAccountId = event.requesterOrigin?.accountId?.trim();
    const requesterThreadId = event.requesterOrigin?.threadId != null && event.requesterOrigin.threadId !== "" ? String(event.requesterOrigin.threadId).trim() : "";
    const bindings = listThreadBindingsBySessionKey({
      targetSessionKey: event.childSessionKey,
      ...requesterAccountId ? { accountId: requesterAccountId } : {},
      targetKind: "subagent"
    });
    if (bindings.length === 0) {
      return;
    }
    let binding;
    if (requesterThreadId) {
      binding = bindings.find((entry) => {
        if (entry.threadId !== requesterThreadId) {
          return false;
        }
        if (requesterAccountId && entry.accountId !== requesterAccountId) {
          return false;
        }
        return true;
      });
    }
    if (!binding && bindings.length === 1) {
      binding = bindings[0];
    }
    if (!binding) {
      return;
    }
    return {
      origin: {
        channel: "discord",
        accountId: binding.accountId,
        to: `channel:${binding.threadId}`,
        threadId: binding.threadId
      }
    };
  });
}

// vendor/openclaw-runtime/win-x64/extensions/discord/index.ts
var plugin = {
  id: "discord",
  name: "Discord",
  description: "Discord channel plugin",
  configSchema: emptyPluginConfigSchema(),
  register(api) {
    setDiscordRuntime(api.runtime);
    api.registerChannel({ plugin: discordPlugin });
    registerDiscordSubagentHooks(api);
  }
};
var discord_default = plugin;
export {
  discord_default as default
};
