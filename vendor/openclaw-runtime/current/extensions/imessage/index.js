// vendor/openclaw-runtime/win-x64/extensions/imessage/index.ts
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";

// vendor/openclaw-runtime/win-x64/extensions/imessage/src/channel.ts
import {
  applyAccountNameToChannelSection,
  buildChannelConfigSchema,
  DEFAULT_ACCOUNT_ID,
  deleteAccountFromConfigSection,
  formatPairingApproveHint,
  formatTrimmedAllowFromEntries,
  getChatChannelMeta,
  imessageOnboardingAdapter,
  IMessageConfigSchema,
  listIMessageAccountIds,
  looksLikeIMessageTargetId,
  migrateBaseNameToDefaultAccount,
  normalizeAccountId,
  normalizeIMessageMessagingTarget,
  PAIRING_APPROVED_MESSAGE,
  resolveChannelMediaMaxBytes,
  resolveDefaultIMessageAccountId,
  resolveIMessageAccount,
  resolveIMessageConfigAllowFrom,
  resolveIMessageConfigDefaultTo,
  resolveIMessageGroupRequireMention,
  resolveIMessageGroupToolPolicy,
  resolveAllowlistProviderRuntimeGroupPolicy,
  resolveDefaultGroupPolicy,
  setAccountEnabledInConfigSection
} from "openclaw/plugin-sdk";

// vendor/openclaw-runtime/win-x64/extensions/imessage/src/runtime.ts
var runtime = null;
function setIMessageRuntime(next) {
  runtime = next;
}
function getIMessageRuntime() {
  if (!runtime) {
    throw new Error("iMessage runtime not initialized");
  }
  return runtime;
}

// vendor/openclaw-runtime/win-x64/extensions/imessage/src/channel.ts
var meta = getChatChannelMeta("imessage");
function buildIMessageSetupPatch(input) {
  return {
    ...input.cliPath ? { cliPath: input.cliPath } : {},
    ...input.dbPath ? { dbPath: input.dbPath } : {},
    ...input.service ? { service: input.service } : {},
    ...input.region ? { region: input.region } : {}
  };
}
async function sendIMessageOutbound(params) {
  const send = params.deps?.sendIMessage ?? getIMessageRuntime().channel.imessage.sendMessageIMessage;
  const maxBytes = resolveChannelMediaMaxBytes({
    cfg: params.cfg,
    resolveChannelLimitMb: ({ cfg, accountId }) => cfg.channels?.imessage?.accounts?.[accountId]?.mediaMaxMb ?? cfg.channels?.imessage?.mediaMaxMb,
    accountId: params.accountId
  });
  return await send(params.to, params.text, {
    ...params.mediaUrl ? { mediaUrl: params.mediaUrl } : {},
    maxBytes,
    accountId: params.accountId ?? void 0,
    replyToId: params.replyToId ?? void 0
  });
}
var imessagePlugin = {
  id: "imessage",
  meta: {
    ...meta,
    aliases: ["imsg"],
    showConfigured: false
  },
  onboarding: imessageOnboardingAdapter,
  pairing: {
    idLabel: "imessageSenderId",
    notifyApproval: async ({ id }) => {
      await getIMessageRuntime().channel.imessage.sendMessageIMessage(id, PAIRING_APPROVED_MESSAGE);
    }
  },
  capabilities: {
    chatTypes: ["direct", "group"],
    media: true
  },
  reload: { configPrefixes: ["channels.imessage"] },
  configSchema: buildChannelConfigSchema(IMessageConfigSchema),
  config: {
    listAccountIds: (cfg) => listIMessageAccountIds(cfg),
    resolveAccount: (cfg, accountId) => resolveIMessageAccount({ cfg, accountId }),
    defaultAccountId: (cfg) => resolveDefaultIMessageAccountId(cfg),
    setAccountEnabled: ({ cfg, accountId, enabled }) => setAccountEnabledInConfigSection({
      cfg,
      sectionKey: "imessage",
      accountId,
      enabled,
      allowTopLevel: true
    }),
    deleteAccount: ({ cfg, accountId }) => deleteAccountFromConfigSection({
      cfg,
      sectionKey: "imessage",
      accountId,
      clearBaseFields: ["cliPath", "dbPath", "service", "region", "name"]
    }),
    isConfigured: (account) => account.configured,
    describeAccount: (account) => ({
      accountId: account.accountId,
      name: account.name,
      enabled: account.enabled,
      configured: account.configured
    }),
    resolveAllowFrom: ({ cfg, accountId }) => resolveIMessageConfigAllowFrom({ cfg, accountId }),
    formatAllowFrom: ({ allowFrom }) => formatTrimmedAllowFromEntries(allowFrom),
    resolveDefaultTo: ({ cfg, accountId }) => resolveIMessageConfigDefaultTo({ cfg, accountId })
  },
  security: {
    resolveDmPolicy: ({ cfg, accountId, account }) => {
      const resolvedAccountId = accountId ?? account.accountId ?? DEFAULT_ACCOUNT_ID;
      const useAccountPath = Boolean(cfg.channels?.imessage?.accounts?.[resolvedAccountId]);
      const basePath = useAccountPath ? `channels.imessage.accounts.${resolvedAccountId}.` : "channels.imessage.";
      return {
        policy: account.config.dmPolicy ?? "pairing",
        allowFrom: account.config.allowFrom ?? [],
        policyPath: `${basePath}dmPolicy`,
        allowFromPath: basePath,
        approveHint: formatPairingApproveHint("imessage")
      };
    },
    collectWarnings: ({ account, cfg }) => {
      const defaultGroupPolicy = resolveDefaultGroupPolicy(cfg);
      const { groupPolicy } = resolveAllowlistProviderRuntimeGroupPolicy({
        providerConfigPresent: cfg.channels?.imessage !== void 0,
        groupPolicy: account.config.groupPolicy,
        defaultGroupPolicy
      });
      if (groupPolicy !== "open") {
        return [];
      }
      return [
        `- iMessage groups: groupPolicy="open" allows any member to trigger the bot. Set channels.imessage.groupPolicy="allowlist" + channels.imessage.groupAllowFrom to restrict senders.`
      ];
    }
  },
  groups: {
    resolveRequireMention: resolveIMessageGroupRequireMention,
    resolveToolPolicy: resolveIMessageGroupToolPolicy
  },
  messaging: {
    normalizeTarget: normalizeIMessageMessagingTarget,
    targetResolver: {
      looksLikeId: looksLikeIMessageTargetId,
      hint: "<handle|chat_id:ID>"
    }
  },
  setup: {
    resolveAccountId: ({ accountId }) => normalizeAccountId(accountId),
    applyAccountName: ({ cfg, accountId, name }) => applyAccountNameToChannelSection({
      cfg,
      channelKey: "imessage",
      accountId,
      name
    }),
    applyAccountConfig: ({ cfg, accountId, input }) => {
      const namedConfig = applyAccountNameToChannelSection({
        cfg,
        channelKey: "imessage",
        accountId,
        name: input.name
      });
      const next = accountId !== DEFAULT_ACCOUNT_ID ? migrateBaseNameToDefaultAccount({
        cfg: namedConfig,
        channelKey: "imessage"
      }) : namedConfig;
      if (accountId === DEFAULT_ACCOUNT_ID) {
        return {
          ...next,
          channels: {
            ...next.channels,
            imessage: {
              ...next.channels?.imessage,
              enabled: true,
              ...buildIMessageSetupPatch(input)
            }
          }
        };
      }
      return {
        ...next,
        channels: {
          ...next.channels,
          imessage: {
            ...next.channels?.imessage,
            enabled: true,
            accounts: {
              ...next.channels?.imessage?.accounts,
              [accountId]: {
                ...next.channels?.imessage?.accounts?.[accountId],
                enabled: true,
                ...buildIMessageSetupPatch(input)
              }
            }
          }
        }
      };
    }
  },
  outbound: {
    deliveryMode: "direct",
    chunker: (text, limit) => getIMessageRuntime().channel.text.chunkText(text, limit),
    chunkerMode: "text",
    textChunkLimit: 4e3,
    sendText: async ({ cfg, to, text, accountId, deps, replyToId }) => {
      const result = await sendIMessageOutbound({
        cfg,
        to,
        text,
        accountId: accountId ?? void 0,
        deps,
        replyToId: replyToId ?? void 0
      });
      return { channel: "imessage", ...result };
    },
    sendMedia: async ({ cfg, to, text, mediaUrl, accountId, deps, replyToId }) => {
      const result = await sendIMessageOutbound({
        cfg,
        to,
        text,
        mediaUrl,
        accountId: accountId ?? void 0,
        deps,
        replyToId: replyToId ?? void 0
      });
      return { channel: "imessage", ...result };
    }
  },
  status: {
    defaultRuntime: {
      accountId: DEFAULT_ACCOUNT_ID,
      running: false,
      lastStartAt: null,
      lastStopAt: null,
      lastError: null,
      cliPath: null,
      dbPath: null
    },
    collectStatusIssues: (accounts) => accounts.flatMap((account) => {
      const lastError = typeof account.lastError === "string" ? account.lastError.trim() : "";
      if (!lastError) {
        return [];
      }
      return [
        {
          channel: "imessage",
          accountId: account.accountId,
          kind: "runtime",
          message: `Channel error: ${lastError}`
        }
      ];
    }),
    buildChannelSummary: ({ snapshot }) => ({
      configured: snapshot.configured ?? false,
      running: snapshot.running ?? false,
      lastStartAt: snapshot.lastStartAt ?? null,
      lastStopAt: snapshot.lastStopAt ?? null,
      lastError: snapshot.lastError ?? null,
      cliPath: snapshot.cliPath ?? null,
      dbPath: snapshot.dbPath ?? null,
      probe: snapshot.probe,
      lastProbeAt: snapshot.lastProbeAt ?? null
    }),
    probeAccount: async ({ timeoutMs }) => getIMessageRuntime().channel.imessage.probeIMessage(timeoutMs),
    buildAccountSnapshot: ({ account, runtime: runtime2, probe }) => ({
      accountId: account.accountId,
      name: account.name,
      enabled: account.enabled,
      configured: account.configured,
      running: runtime2?.running ?? false,
      lastStartAt: runtime2?.lastStartAt ?? null,
      lastStopAt: runtime2?.lastStopAt ?? null,
      lastError: runtime2?.lastError ?? null,
      cliPath: runtime2?.cliPath ?? account.config.cliPath ?? null,
      dbPath: runtime2?.dbPath ?? account.config.dbPath ?? null,
      probe,
      lastInboundAt: runtime2?.lastInboundAt ?? null,
      lastOutboundAt: runtime2?.lastOutboundAt ?? null
    }),
    resolveAccountState: ({ enabled }) => enabled ? "enabled" : "disabled"
  },
  gateway: {
    startAccount: async (ctx) => {
      const account = ctx.account;
      const cliPath = account.config.cliPath?.trim() || "imsg";
      const dbPath = account.config.dbPath?.trim();
      ctx.setStatus({
        accountId: account.accountId,
        cliPath,
        dbPath: dbPath ?? null
      });
      ctx.log?.info(
        `[${account.accountId}] starting provider (${cliPath}${dbPath ? ` db=${dbPath}` : ""})`
      );
      return getIMessageRuntime().channel.imessage.monitorIMessageProvider({
        accountId: account.accountId,
        config: ctx.cfg,
        runtime: ctx.runtime,
        abortSignal: ctx.abortSignal
      });
    }
  }
};

// vendor/openclaw-runtime/win-x64/extensions/imessage/index.ts
var plugin = {
  id: "imessage",
  name: "iMessage",
  description: "iMessage channel plugin",
  configSchema: emptyPluginConfigSchema(),
  register(api) {
    setIMessageRuntime(api.runtime);
    api.registerChannel({ plugin: imessagePlugin });
  }
};
var imessage_default = plugin;
export {
  imessage_default as default
};
