// vendor/openclaw-runtime/win-x64/extensions/line/index.ts
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";

// vendor/openclaw-runtime/win-x64/extensions/line/src/card-command.ts
import {
  createActionCard,
  createImageCard,
  createInfoCard,
  createListCard,
  createReceiptCard
} from "openclaw/plugin-sdk";
var CARD_USAGE = `Usage: /card <type> "title" "body" [options]

Types:
  info "Title" "Body" ["Footer"]
  image "Title" "Caption" --url <image-url>
  action "Title" "Body" --actions "Btn1|url1,Btn2|text2"
  list "Title" "Item1|Desc1,Item2|Desc2"
  receipt "Title" "Item1:$10,Item2:$20" --total "$30"
  confirm "Question?" --yes "Yes|data" --no "No|data"
  buttons "Title" "Text" --actions "Btn1|url1,Btn2|data2"

Examples:
  /card info "Welcome" "Thanks for joining!"
  /card image "Product" "Check it out" --url https://example.com/img.jpg
  /card action "Menu" "Choose an option" --actions "Order|/order,Help|/help"`;
function buildLineReply(lineData) {
  return {
    channelData: {
      line: lineData
    }
  };
}
function parseActions(actionsStr) {
  if (!actionsStr) {
    return [];
  }
  const results = [];
  for (const part of actionsStr.split(",")) {
    const [label, data] = part.trim().split("|").map((s) => s.trim());
    if (!label) {
      continue;
    }
    const actionData = data || label;
    if (actionData.startsWith("http://") || actionData.startsWith("https://")) {
      results.push({
        label,
        action: { type: "uri", label: label.slice(0, 20), uri: actionData }
      });
    } else if (actionData.includes("=")) {
      results.push({
        label,
        action: {
          type: "postback",
          label: label.slice(0, 20),
          data: actionData.slice(0, 300),
          displayText: label
        }
      });
    } else {
      results.push({
        label,
        action: { type: "message", label: label.slice(0, 20), text: actionData }
      });
    }
  }
  return results;
}
function parseListItems(itemsStr) {
  return itemsStr.split(",").map((part) => {
    const [title, subtitle] = part.trim().split("|").map((s) => s.trim());
    return { title: title || "", subtitle };
  }).filter((item) => item.title);
}
function parseReceiptItems(itemsStr) {
  return itemsStr.split(",").map((part) => {
    const colonIndex = part.lastIndexOf(":");
    if (colonIndex === -1) {
      return { name: part.trim(), value: "" };
    }
    return {
      name: part.slice(0, colonIndex).trim(),
      value: part.slice(colonIndex + 1).trim()
    };
  }).filter((item) => item.name);
}
function parseCardArgs(argsStr) {
  const result = {
    type: "",
    args: [],
    flags: {}
  };
  const typeMatch = argsStr.match(/^(\w+)/);
  if (typeMatch) {
    result.type = typeMatch[1].toLowerCase();
    argsStr = argsStr.slice(typeMatch[0].length).trim();
  }
  const quotedRegex = /"([^"]*?)"/g;
  let match;
  while ((match = quotedRegex.exec(argsStr)) !== null) {
    result.args.push(match[1]);
  }
  const flagRegex = /--(\w+)\s+(?:"([^"]*?)"|(\S+))/g;
  while ((match = flagRegex.exec(argsStr)) !== null) {
    result.flags[match[1]] = match[2] ?? match[3];
  }
  return result;
}
function registerLineCardCommand(api) {
  api.registerCommand({
    name: "card",
    description: "Send a rich card message (LINE).",
    acceptsArgs: true,
    requireAuth: false,
    handler: async (ctx) => {
      const argsStr = ctx.args?.trim() ?? "";
      if (!argsStr) {
        return { text: CARD_USAGE };
      }
      const parsed = parseCardArgs(argsStr);
      const { type, args, flags } = parsed;
      if (!type) {
        return { text: CARD_USAGE };
      }
      if (ctx.channel !== "line") {
        const fallbackText = args.join(" - ");
        return { text: `[${type} card] ${fallbackText}`.trim() };
      }
      try {
        switch (type) {
          case "info": {
            const [title = "Info", body = "", footer] = args;
            const bubble = createInfoCard(title, body, footer);
            return buildLineReply({
              flexMessage: {
                altText: `${title}: ${body}`.slice(0, 400),
                contents: bubble
              }
            });
          }
          case "image": {
            const [title = "Image", caption = ""] = args;
            const imageUrl = flags.url || flags.image;
            if (!imageUrl) {
              return { text: "Error: Image card requires --url <image-url>" };
            }
            const bubble = createImageCard(imageUrl, title, caption);
            return buildLineReply({
              flexMessage: {
                altText: `${title}: ${caption}`.slice(0, 400),
                contents: bubble
              }
            });
          }
          case "action": {
            const [title = "Actions", body = ""] = args;
            const actions = parseActions(flags.actions);
            if (actions.length === 0) {
              return { text: 'Error: Action card requires --actions "Label1|data1,Label2|data2"' };
            }
            const bubble = createActionCard(title, body, actions, {
              imageUrl: flags.url || flags.image
            });
            return buildLineReply({
              flexMessage: {
                altText: `${title}: ${body}`.slice(0, 400),
                contents: bubble
              }
            });
          }
          case "list": {
            const [title = "List", itemsStr = ""] = args;
            const items = parseListItems(itemsStr || flags.items || "");
            if (items.length === 0) {
              return {
                text: 'Error: List card requires items. Usage: /card list "Title" "Item1|Desc1,Item2|Desc2"'
              };
            }
            const bubble = createListCard(title, items);
            return buildLineReply({
              flexMessage: {
                altText: `${title}: ${items.map((i) => i.title).join(", ")}`.slice(0, 400),
                contents: bubble
              }
            });
          }
          case "receipt": {
            const [title = "Receipt", itemsStr = ""] = args;
            const items = parseReceiptItems(itemsStr || flags.items || "");
            const total = flags.total ? { label: "Total", value: flags.total } : void 0;
            const footer = flags.footer;
            if (items.length === 0) {
              return {
                text: 'Error: Receipt card requires items. Usage: /card receipt "Title" "Item1:$10,Item2:$20" --total "$30"'
              };
            }
            const bubble = createReceiptCard({ title, items, total, footer });
            return buildLineReply({
              flexMessage: {
                altText: `${title}: ${items.map((i) => `${i.name} ${i.value}`).join(", ")}`.slice(
                  0,
                  400
                ),
                contents: bubble
              }
            });
          }
          case "confirm": {
            const [question = "Confirm?"] = args;
            const yesStr = flags.yes || "Yes|yes";
            const noStr = flags.no || "No|no";
            const [yesLabel, yesData] = yesStr.split("|").map((s) => s.trim());
            const [noLabel, noData] = noStr.split("|").map((s) => s.trim());
            return buildLineReply({
              templateMessage: {
                type: "confirm",
                text: question,
                confirmLabel: yesLabel || "Yes",
                confirmData: yesData || "yes",
                cancelLabel: noLabel || "No",
                cancelData: noData || "no",
                altText: question
              }
            });
          }
          case "buttons": {
            const [title = "Menu", text = "Choose an option"] = args;
            const actionsStr = flags.actions || "";
            const actionParts = parseActions(actionsStr);
            if (actionParts.length === 0) {
              return { text: 'Error: Buttons card requires --actions "Label1|data1,Label2|data2"' };
            }
            const templateActions = actionParts.map((a) => {
              const action = a.action;
              const label = action.label ?? a.label;
              if (action.type === "uri") {
                return { type: "uri", label, uri: action.uri };
              }
              if (action.type === "postback") {
                return {
                  type: "postback",
                  label,
                  data: action.data
                };
              }
              return {
                type: "message",
                label,
                data: action.text
              };
            });
            return buildLineReply({
              templateMessage: {
                type: "buttons",
                title,
                text,
                thumbnailImageUrl: flags.url || flags.image,
                actions: templateActions
              }
            });
          }
          default:
            return {
              text: `Unknown card type: "${type}". Available types: info, image, action, list, receipt, confirm, buttons`
            };
        }
      } catch (err) {
        return { text: `Error creating card: ${String(err)}` };
      }
    }
  });
}

// vendor/openclaw-runtime/win-x64/extensions/line/src/channel.ts
import {
  buildChannelConfigSchema,
  buildTokenChannelStatusSummary,
  DEFAULT_ACCOUNT_ID,
  LineConfigSchema,
  processLineMessage,
  resolveAllowlistProviderRuntimeGroupPolicy,
  resolveDefaultGroupPolicy
} from "openclaw/plugin-sdk";

// vendor/openclaw-runtime/win-x64/extensions/line/src/runtime.ts
var runtime = null;
function setLineRuntime(r) {
  runtime = r;
}
function getLineRuntime() {
  if (!runtime) {
    throw new Error("LINE runtime not initialized - plugin not registered");
  }
  return runtime;
}

// vendor/openclaw-runtime/win-x64/extensions/line/src/channel.ts
var meta = {
  id: "line",
  label: "LINE",
  selectionLabel: "LINE (Messaging API)",
  detailLabel: "LINE Bot",
  docsPath: "/channels/line",
  docsLabel: "line",
  blurb: "LINE Messaging API bot for Japan/Taiwan/Thailand markets.",
  systemImage: "message.fill"
};
var linePlugin = {
  id: "line",
  meta: {
    ...meta,
    quickstartAllowFrom: true
  },
  pairing: {
    idLabel: "lineUserId",
    normalizeAllowEntry: (entry) => {
      return entry.replace(/^line:(?:user:)?/i, "");
    },
    notifyApproval: async ({ cfg, id }) => {
      const line = getLineRuntime().channel.line;
      const account = line.resolveLineAccount({ cfg });
      if (!account.channelAccessToken) {
        throw new Error("LINE channel access token not configured");
      }
      await line.pushMessageLine(id, "OpenClaw: your access has been approved.", {
        channelAccessToken: account.channelAccessToken
      });
    }
  },
  capabilities: {
    chatTypes: ["direct", "group"],
    reactions: false,
    threads: false,
    media: true,
    nativeCommands: false,
    blockStreaming: true
  },
  reload: { configPrefixes: ["channels.line"] },
  configSchema: buildChannelConfigSchema(LineConfigSchema),
  config: {
    listAccountIds: (cfg) => getLineRuntime().channel.line.listLineAccountIds(cfg),
    resolveAccount: (cfg, accountId) => getLineRuntime().channel.line.resolveLineAccount({ cfg, accountId: accountId ?? void 0 }),
    defaultAccountId: (cfg) => getLineRuntime().channel.line.resolveDefaultLineAccountId(cfg),
    setAccountEnabled: ({ cfg, accountId, enabled }) => {
      const lineConfig = cfg.channels?.line ?? {};
      if (accountId === DEFAULT_ACCOUNT_ID) {
        return {
          ...cfg,
          channels: {
            ...cfg.channels,
            line: {
              ...lineConfig,
              enabled
            }
          }
        };
      }
      return {
        ...cfg,
        channels: {
          ...cfg.channels,
          line: {
            ...lineConfig,
            accounts: {
              ...lineConfig.accounts,
              [accountId]: {
                ...lineConfig.accounts?.[accountId],
                enabled
              }
            }
          }
        }
      };
    },
    deleteAccount: ({ cfg, accountId }) => {
      const lineConfig = cfg.channels?.line ?? {};
      if (accountId === DEFAULT_ACCOUNT_ID) {
        const { channelSecret, tokenFile, secretFile, ...rest } = lineConfig;
        return {
          ...cfg,
          channels: {
            ...cfg.channels,
            line: rest
          }
        };
      }
      const accounts = { ...lineConfig.accounts };
      delete accounts[accountId];
      return {
        ...cfg,
        channels: {
          ...cfg.channels,
          line: {
            ...lineConfig,
            accounts: Object.keys(accounts).length > 0 ? accounts : void 0
          }
        }
      };
    },
    isConfigured: (account) => Boolean(account.channelAccessToken?.trim() && account.channelSecret?.trim()),
    describeAccount: (account) => ({
      accountId: account.accountId,
      name: account.name,
      enabled: account.enabled,
      configured: Boolean(account.channelAccessToken?.trim() && account.channelSecret?.trim()),
      tokenSource: account.tokenSource ?? void 0
    }),
    resolveAllowFrom: ({ cfg, accountId }) => (getLineRuntime().channel.line.resolveLineAccount({ cfg, accountId: accountId ?? void 0 }).config.allowFrom ?? []).map((entry) => String(entry)),
    formatAllowFrom: ({ allowFrom }) => allowFrom.map((entry) => String(entry).trim()).filter(Boolean).map((entry) => {
      return entry.replace(/^line:(?:user:)?/i, "");
    })
  },
  security: {
    resolveDmPolicy: ({ cfg, accountId, account }) => {
      const resolvedAccountId = accountId ?? account.accountId ?? DEFAULT_ACCOUNT_ID;
      const useAccountPath = Boolean(
        cfg.channels?.line?.accounts?.[resolvedAccountId]
      );
      const basePath = useAccountPath ? `channels.line.accounts.${resolvedAccountId}.` : "channels.line.";
      return {
        policy: account.config.dmPolicy ?? "pairing",
        allowFrom: account.config.allowFrom ?? [],
        policyPath: `${basePath}dmPolicy`,
        allowFromPath: basePath,
        approveHint: "openclaw pairing approve line <code>",
        normalizeEntry: (raw) => raw.replace(/^line:(?:user:)?/i, "")
      };
    },
    collectWarnings: ({ account, cfg }) => {
      const defaultGroupPolicy = resolveDefaultGroupPolicy(cfg);
      const { groupPolicy } = resolveAllowlistProviderRuntimeGroupPolicy({
        providerConfigPresent: cfg.channels?.line !== void 0,
        groupPolicy: account.config.groupPolicy,
        defaultGroupPolicy
      });
      if (groupPolicy !== "open") {
        return [];
      }
      return [
        `- LINE groups: groupPolicy="open" allows any member in groups to trigger. Set channels.line.groupPolicy="allowlist" + channels.line.groupAllowFrom to restrict senders.`
      ];
    }
  },
  groups: {
    resolveRequireMention: ({ cfg, accountId, groupId }) => {
      const account = getLineRuntime().channel.line.resolveLineAccount({
        cfg,
        accountId: accountId ?? void 0
      });
      const groups = account.config.groups;
      if (!groups || !groupId) {
        return false;
      }
      const groupConfig = groups[groupId] ?? groups["*"];
      return groupConfig?.requireMention ?? false;
    }
  },
  messaging: {
    normalizeTarget: (target) => {
      const trimmed = target.trim();
      if (!trimmed) {
        return void 0;
      }
      return trimmed.replace(/^line:(group|room|user):/i, "").replace(/^line:/i, "");
    },
    targetResolver: {
      looksLikeId: (id) => {
        const trimmed = id?.trim();
        if (!trimmed) {
          return false;
        }
        return /^[UCR][a-f0-9]{32}$/i.test(trimmed) || /^line:/i.test(trimmed);
      },
      hint: "<userId|groupId|roomId>"
    }
  },
  directory: {
    self: async () => null,
    listPeers: async () => [],
    listGroups: async () => []
  },
  setup: {
    resolveAccountId: ({ accountId }) => getLineRuntime().channel.line.normalizeAccountId(accountId),
    applyAccountName: ({ cfg, accountId, name }) => {
      const lineConfig = cfg.channels?.line ?? {};
      if (accountId === DEFAULT_ACCOUNT_ID) {
        return {
          ...cfg,
          channels: {
            ...cfg.channels,
            line: {
              ...lineConfig,
              name
            }
          }
        };
      }
      return {
        ...cfg,
        channels: {
          ...cfg.channels,
          line: {
            ...lineConfig,
            accounts: {
              ...lineConfig.accounts,
              [accountId]: {
                ...lineConfig.accounts?.[accountId],
                name
              }
            }
          }
        }
      };
    },
    validateInput: ({ accountId, input }) => {
      const typedInput = input;
      if (typedInput.useEnv && accountId !== DEFAULT_ACCOUNT_ID) {
        return "LINE_CHANNEL_ACCESS_TOKEN can only be used for the default account.";
      }
      if (!typedInput.useEnv && !typedInput.channelAccessToken && !typedInput.tokenFile) {
        return "LINE requires channelAccessToken or --token-file (or --use-env).";
      }
      if (!typedInput.useEnv && !typedInput.channelSecret && !typedInput.secretFile) {
        return "LINE requires channelSecret or --secret-file (or --use-env).";
      }
      return null;
    },
    applyAccountConfig: ({ cfg, accountId, input }) => {
      const typedInput = input;
      const lineConfig = cfg.channels?.line ?? {};
      if (accountId === DEFAULT_ACCOUNT_ID) {
        return {
          ...cfg,
          channels: {
            ...cfg.channels,
            line: {
              ...lineConfig,
              enabled: true,
              ...typedInput.name ? { name: typedInput.name } : {},
              ...typedInput.useEnv ? {} : typedInput.tokenFile ? { tokenFile: typedInput.tokenFile } : typedInput.channelAccessToken ? { channelAccessToken: typedInput.channelAccessToken } : {},
              ...typedInput.useEnv ? {} : typedInput.secretFile ? { secretFile: typedInput.secretFile } : typedInput.channelSecret ? { channelSecret: typedInput.channelSecret } : {}
            }
          }
        };
      }
      return {
        ...cfg,
        channels: {
          ...cfg.channels,
          line: {
            ...lineConfig,
            enabled: true,
            accounts: {
              ...lineConfig.accounts,
              [accountId]: {
                ...lineConfig.accounts?.[accountId],
                enabled: true,
                ...typedInput.name ? { name: typedInput.name } : {},
                ...typedInput.tokenFile ? { tokenFile: typedInput.tokenFile } : typedInput.channelAccessToken ? { channelAccessToken: typedInput.channelAccessToken } : {},
                ...typedInput.secretFile ? { secretFile: typedInput.secretFile } : typedInput.channelSecret ? { channelSecret: typedInput.channelSecret } : {}
              }
            }
          }
        }
      };
    }
  },
  outbound: {
    deliveryMode: "direct",
    chunker: (text, limit) => getLineRuntime().channel.text.chunkMarkdownText(text, limit),
    textChunkLimit: 5e3,
    // LINE allows up to 5000 characters per text message
    sendPayload: async ({ to, payload, accountId, cfg }) => {
      const runtime2 = getLineRuntime();
      const lineData = payload.channelData?.line ?? {};
      const sendText = runtime2.channel.line.pushMessageLine;
      const sendBatch = runtime2.channel.line.pushMessagesLine;
      const sendFlex = runtime2.channel.line.pushFlexMessage;
      const sendTemplate = runtime2.channel.line.pushTemplateMessage;
      const sendLocation = runtime2.channel.line.pushLocationMessage;
      const sendQuickReplies = runtime2.channel.line.pushTextMessageWithQuickReplies;
      const buildTemplate = runtime2.channel.line.buildTemplateMessageFromPayload;
      const createQuickReplyItems = runtime2.channel.line.createQuickReplyItems;
      let lastResult = null;
      const quickReplies = lineData.quickReplies ?? [];
      const hasQuickReplies = quickReplies.length > 0;
      const quickReply = hasQuickReplies ? createQuickReplyItems(quickReplies) : void 0;
      const sendMessageBatch = async (messages) => {
        if (messages.length === 0) {
          return;
        }
        for (let i = 0; i < messages.length; i += 5) {
          const batch = messages.slice(i, i + 5);
          const result = await sendBatch(to, batch, {
            verbose: false,
            accountId: accountId ?? void 0
          });
          lastResult = { messageId: result.messageId, chatId: result.chatId };
        }
      };
      const processed = payload.text ? processLineMessage(payload.text) : { text: "", flexMessages: [] };
      const chunkLimit = runtime2.channel.text.resolveTextChunkLimit?.(cfg, "line", accountId ?? void 0, {
        fallbackLimit: 5e3
      }) ?? 5e3;
      const chunks = processed.text ? runtime2.channel.text.chunkMarkdownText(processed.text, chunkLimit) : [];
      const mediaUrls = payload.mediaUrls ?? (payload.mediaUrl ? [payload.mediaUrl] : []);
      const shouldSendQuickRepliesInline = chunks.length === 0 && hasQuickReplies;
      if (!shouldSendQuickRepliesInline) {
        if (lineData.flexMessage) {
          const flexContents = lineData.flexMessage.contents;
          lastResult = await sendFlex(to, lineData.flexMessage.altText, flexContents, {
            verbose: false,
            accountId: accountId ?? void 0
          });
        }
        if (lineData.templateMessage) {
          const template = buildTemplate(lineData.templateMessage);
          if (template) {
            lastResult = await sendTemplate(to, template, {
              verbose: false,
              accountId: accountId ?? void 0
            });
          }
        }
        if (lineData.location) {
          lastResult = await sendLocation(to, lineData.location, {
            verbose: false,
            accountId: accountId ?? void 0
          });
        }
        for (const flexMsg of processed.flexMessages) {
          const flexContents = flexMsg.contents;
          lastResult = await sendFlex(to, flexMsg.altText, flexContents, {
            verbose: false,
            accountId: accountId ?? void 0
          });
        }
      }
      const sendMediaAfterText = !(hasQuickReplies && chunks.length > 0);
      if (mediaUrls.length > 0 && !shouldSendQuickRepliesInline && !sendMediaAfterText) {
        for (const url of mediaUrls) {
          lastResult = await runtime2.channel.line.sendMessageLine(to, "", {
            verbose: false,
            mediaUrl: url,
            accountId: accountId ?? void 0
          });
        }
      }
      if (chunks.length > 0) {
        for (let i = 0; i < chunks.length; i += 1) {
          const isLast = i === chunks.length - 1;
          if (isLast && hasQuickReplies) {
            lastResult = await sendQuickReplies(to, chunks[i], quickReplies, {
              verbose: false,
              accountId: accountId ?? void 0
            });
          } else {
            lastResult = await sendText(to, chunks[i], {
              verbose: false,
              accountId: accountId ?? void 0
            });
          }
        }
      } else if (shouldSendQuickRepliesInline) {
        const quickReplyMessages = [];
        if (lineData.flexMessage) {
          quickReplyMessages.push({
            type: "flex",
            altText: lineData.flexMessage.altText.slice(0, 400),
            contents: lineData.flexMessage.contents
          });
        }
        if (lineData.templateMessage) {
          const template = buildTemplate(lineData.templateMessage);
          if (template) {
            quickReplyMessages.push(template);
          }
        }
        if (lineData.location) {
          quickReplyMessages.push({
            type: "location",
            title: lineData.location.title.slice(0, 100),
            address: lineData.location.address.slice(0, 100),
            latitude: lineData.location.latitude,
            longitude: lineData.location.longitude
          });
        }
        for (const flexMsg of processed.flexMessages) {
          quickReplyMessages.push({
            type: "flex",
            altText: flexMsg.altText.slice(0, 400),
            contents: flexMsg.contents
          });
        }
        for (const url of mediaUrls) {
          const trimmed = url?.trim();
          if (!trimmed) {
            continue;
          }
          quickReplyMessages.push({
            type: "image",
            originalContentUrl: trimmed,
            previewImageUrl: trimmed
          });
        }
        if (quickReplyMessages.length > 0 && quickReply) {
          const lastIndex = quickReplyMessages.length - 1;
          quickReplyMessages[lastIndex] = {
            ...quickReplyMessages[lastIndex],
            quickReply
          };
          await sendMessageBatch(quickReplyMessages);
        }
      }
      if (mediaUrls.length > 0 && !shouldSendQuickRepliesInline && sendMediaAfterText) {
        for (const url of mediaUrls) {
          lastResult = await runtime2.channel.line.sendMessageLine(to, "", {
            verbose: false,
            mediaUrl: url,
            accountId: accountId ?? void 0
          });
        }
      }
      if (lastResult) {
        return { channel: "line", ...lastResult };
      }
      return { channel: "line", messageId: "empty", chatId: to };
    },
    sendText: async ({ to, text, accountId }) => {
      const runtime2 = getLineRuntime();
      const sendText = runtime2.channel.line.pushMessageLine;
      const sendFlex = runtime2.channel.line.pushFlexMessage;
      const processed = processLineMessage(text);
      let result;
      if (processed.text.trim()) {
        result = await sendText(to, processed.text, {
          verbose: false,
          accountId: accountId ?? void 0
        });
      } else {
        result = { messageId: "processed", chatId: to };
      }
      for (const flexMsg of processed.flexMessages) {
        const flexContents = flexMsg.contents;
        await sendFlex(to, flexMsg.altText, flexContents, {
          verbose: false,
          accountId: accountId ?? void 0
        });
      }
      return { channel: "line", ...result };
    },
    sendMedia: async ({ to, text, mediaUrl, accountId }) => {
      const send = getLineRuntime().channel.line.sendMessageLine;
      const result = await send(to, text, {
        verbose: false,
        mediaUrl,
        accountId: accountId ?? void 0
      });
      return { channel: "line", ...result };
    }
  },
  status: {
    defaultRuntime: {
      accountId: DEFAULT_ACCOUNT_ID,
      running: false,
      lastStartAt: null,
      lastStopAt: null,
      lastError: null
    },
    collectStatusIssues: (accounts) => {
      const issues = [];
      for (const account of accounts) {
        const accountId = account.accountId ?? DEFAULT_ACCOUNT_ID;
        if (!account.channelAccessToken?.trim()) {
          issues.push({
            channel: "line",
            accountId,
            kind: "config",
            message: "LINE channel access token not configured"
          });
        }
        if (!account.channelSecret?.trim()) {
          issues.push({
            channel: "line",
            accountId,
            kind: "config",
            message: "LINE channel secret not configured"
          });
        }
      }
      return issues;
    },
    buildChannelSummary: ({ snapshot }) => buildTokenChannelStatusSummary(snapshot),
    probeAccount: async ({ account, timeoutMs }) => getLineRuntime().channel.line.probeLineBot(account.channelAccessToken, timeoutMs),
    buildAccountSnapshot: ({ account, runtime: runtime2, probe }) => {
      const configured = Boolean(
        account.channelAccessToken?.trim() && account.channelSecret?.trim()
      );
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
        mode: "webhook",
        probe,
        lastInboundAt: runtime2?.lastInboundAt ?? null,
        lastOutboundAt: runtime2?.lastOutboundAt ?? null
      };
    }
  },
  gateway: {
    startAccount: async (ctx) => {
      const account = ctx.account;
      const token = account.channelAccessToken.trim();
      const secret = account.channelSecret.trim();
      if (!token) {
        throw new Error(
          `LINE webhook mode requires a non-empty channel access token for account "${account.accountId}".`
        );
      }
      if (!secret) {
        throw new Error(
          `LINE webhook mode requires a non-empty channel secret for account "${account.accountId}".`
        );
      }
      let lineBotLabel = "";
      try {
        const probe = await getLineRuntime().channel.line.probeLineBot(token, 2500);
        const displayName = probe.ok ? probe.bot?.displayName?.trim() : null;
        if (displayName) {
          lineBotLabel = ` (${displayName})`;
        }
      } catch (err) {
        if (getLineRuntime().logging.shouldLogVerbose()) {
          ctx.log?.debug?.(`[${account.accountId}] bot probe failed: ${String(err)}`);
        }
      }
      ctx.log?.info(`[${account.accountId}] starting LINE provider${lineBotLabel}`);
      const monitor = await getLineRuntime().channel.line.monitorLineProvider({
        channelAccessToken: token,
        channelSecret: secret,
        accountId: account.accountId,
        config: ctx.cfg,
        runtime: ctx.runtime,
        abortSignal: ctx.abortSignal,
        webhookPath: account.config.webhookPath
      });
      return monitor;
    },
    logoutAccount: async ({ accountId, cfg }) => {
      const envToken = process.env.LINE_CHANNEL_ACCESS_TOKEN?.trim() ?? "";
      const nextCfg = { ...cfg };
      const lineConfig = cfg.channels?.line ?? {};
      const nextLine = { ...lineConfig };
      let cleared = false;
      let changed = false;
      if (accountId === DEFAULT_ACCOUNT_ID) {
        if (nextLine.channelAccessToken || nextLine.channelSecret || nextLine.tokenFile || nextLine.secretFile) {
          delete nextLine.channelAccessToken;
          delete nextLine.channelSecret;
          delete nextLine.tokenFile;
          delete nextLine.secretFile;
          cleared = true;
          changed = true;
        }
      }
      const accounts = nextLine.accounts ? { ...nextLine.accounts } : void 0;
      if (accounts && accountId in accounts) {
        const entry = accounts[accountId];
        if (entry && typeof entry === "object") {
          const nextEntry = { ...entry };
          if ("channelAccessToken" in nextEntry || "channelSecret" in nextEntry || "tokenFile" in nextEntry || "secretFile" in nextEntry) {
            cleared = true;
            delete nextEntry.channelAccessToken;
            delete nextEntry.channelSecret;
            delete nextEntry.tokenFile;
            delete nextEntry.secretFile;
            changed = true;
          }
          if (Object.keys(nextEntry).length === 0) {
            delete accounts[accountId];
            changed = true;
          } else {
            accounts[accountId] = nextEntry;
          }
        }
      }
      if (accounts) {
        if (Object.keys(accounts).length === 0) {
          delete nextLine.accounts;
          changed = true;
        } else {
          nextLine.accounts = accounts;
        }
      }
      if (changed) {
        if (Object.keys(nextLine).length > 0) {
          nextCfg.channels = { ...nextCfg.channels, line: nextLine };
        } else {
          const nextChannels = { ...nextCfg.channels };
          delete nextChannels.line;
          if (Object.keys(nextChannels).length > 0) {
            nextCfg.channels = nextChannels;
          } else {
            delete nextCfg.channels;
          }
        }
        await getLineRuntime().config.writeConfigFile(nextCfg);
      }
      const resolved = getLineRuntime().channel.line.resolveLineAccount({
        cfg: changed ? nextCfg : cfg,
        accountId
      });
      const loggedOut = resolved.tokenSource === "none";
      return { cleared, envToken: Boolean(envToken), loggedOut };
    }
  },
  agentPrompt: {
    messageToolHints: () => [
      "",
      "### LINE Rich Messages",
      "LINE supports rich visual messages. Use these directives in your reply when appropriate:",
      "",
      "**Quick Replies** (bottom button suggestions):",
      "  [[quick_replies: Option 1, Option 2, Option 3]]",
      "",
      "**Location** (map pin):",
      "  [[location: Place Name | Address | latitude | longitude]]",
      "",
      "**Confirm Dialog** (yes/no prompt):",
      "  [[confirm: Question text? | Yes Label | No Label]]",
      "",
      "**Button Menu** (title + text + buttons):",
      "  [[buttons: Title | Description | Btn1:action1, Btn2:https://url.com]]",
      "",
      "**Media Player Card** (music status):",
      "  [[media_player: Song Title | Artist Name | Source | https://albumart.url | playing]]",
      "  - Status: 'playing' or 'paused' (optional)",
      "",
      "**Event Card** (calendar events, meetings):",
      "  [[event: Event Title | Date | Time | Location | Description]]",
      "  - Time, Location, Description are optional",
      "",
      "**Agenda Card** (multiple events/schedule):",
      "  [[agenda: Schedule Title | Event1:9:00 AM, Event2:12:00 PM, Event3:3:00 PM]]",
      "",
      "**Device Control Card** (smart devices, TVs, etc.):",
      "  [[device: Device Name | Device Type | Status | Control1:data1, Control2:data2]]",
      "",
      "**Apple TV Remote** (full D-pad + transport):",
      "  [[appletv_remote: Apple TV | Playing]]",
      "",
      "**Auto-converted**: Markdown tables become Flex cards, code blocks become styled cards.",
      "",
      "When to use rich messages:",
      "- Use [[quick_replies:...]] when offering 2-4 clear options",
      "- Use [[confirm:...]] for yes/no decisions",
      "- Use [[buttons:...]] for menus with actions/links",
      "- Use [[location:...]] when sharing a place",
      "- Use [[media_player:...]] when showing what's playing",
      "- Use [[event:...]] for calendar event details",
      "- Use [[agenda:...]] for a day's schedule or event list",
      "- Use [[device:...]] for smart device status/controls",
      "- Tables/code in your response auto-convert to visual cards"
    ]
  }
};

// vendor/openclaw-runtime/win-x64/extensions/line/index.ts
var plugin = {
  id: "line",
  name: "LINE",
  description: "LINE Messaging API channel plugin",
  configSchema: emptyPluginConfigSchema(),
  register(api) {
    setLineRuntime(api.runtime);
    api.registerChannel({ plugin: linePlugin });
    registerLineCardCommand(api);
  }
};
var line_default = plugin;
export {
  line_default as default
};
