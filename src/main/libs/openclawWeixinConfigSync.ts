import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import type { CoworkConfig } from '../coworkStore';
import type { WeixinConfig } from '../im/types';
import type { OpenClawEngineManager } from './openclawEngineManager';
import { getCurrentApiConfig } from './claudeSettings';

export type OpenClawWeixinConfigSyncResult = {
  ok: boolean;
  changed: boolean;
  configPath: string;
  error?: string;
};

type OpenClawWeixinConfigSyncDeps = {
  engineManager: OpenClawEngineManager;
  getCoworkConfig: () => CoworkConfig;
  getWeixinConfig: () => WeixinConfig | null;
};

const OPENCLAW_AGENT_TIMEOUT_SECONDS = 3600;

const ensureDir = (dirPath: string): void => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const normalizeModelName = (modelId: string): string => {
  const trimmed = modelId.trim();
  if (!trimmed) return 'default-model';
  const slashIndex = trimmed.lastIndexOf('/');
  return slashIndex >= 0 ? trimmed.slice(slashIndex + 1) : trimmed;
};

const mapApiTypeToOpenClawApi = (
  apiType: 'anthropic' | 'openai' | undefined,
): 'anthropic-messages' | 'openai-completions' => {
  return apiType === 'openai' ? 'openai-completions' : 'anthropic-messages';
};

const stripChatCompletionsSuffix = (rawBaseUrl: string): string => {
  const trimmed = rawBaseUrl.trim().replace(/\/+$/, '');
  return trimmed.replace(/\/v1\/chat\/completions$/i, '').replace(/\/chat\/completions$/i, '');
};

export class OpenClawWeixinConfigSync {
  private readonly engineManager: OpenClawEngineManager;
  private readonly getCoworkConfig: () => CoworkConfig;
  private readonly getWeixinConfig: () => WeixinConfig | null;

  constructor(deps: OpenClawWeixinConfigSyncDeps) {
    this.engineManager = deps.engineManager;
    this.getCoworkConfig = deps.getCoworkConfig;
    this.getWeixinConfig = deps.getWeixinConfig;
  }

  sync(): OpenClawWeixinConfigSyncResult {
    const configPath = this.engineManager.getConfigPath();
    const coworkConfig = this.getCoworkConfig();
    const weixinConfig = this.getWeixinConfig();
    const apiConfig = getCurrentApiConfig('local');

    const workspaceDir = (coworkConfig.workingDirectory || '').trim();
    const resolvedWorkspaceDir = workspaceDir || path.join(app.getPath('home'), '.openclaw', 'workspace');

    const managedConfig: Record<string, unknown> = {
      gateway: {
        mode: 'local',
      },
      agents: {
        defaults: {
          timeoutSeconds: OPENCLAW_AGENT_TIMEOUT_SECONDS,
          sandbox: {
            mode: 'off',
          },
          workspace: path.resolve(resolvedWorkspaceDir),
        },
      },
      plugins: {
        entries: {
          'openclaw-weixin': {
            enabled: true,
          },
        },
      },
      channels: {
        'openclaw-weixin': {
          enabled: Boolean(weixinConfig?.enabled),
          ...(weixinConfig?.accountId ? { accountId: weixinConfig.accountId } : {}),
        },
      },
    };

    if (apiConfig?.baseURL && apiConfig.model) {
      const providerApi = mapApiTypeToOpenClawApi(apiConfig.apiType);
      const providerId = 'lemonclaw';
      const modelId = apiConfig.model.trim();
      const baseUrl = stripChatCompletionsSuffix(apiConfig.baseURL);
      managedConfig.models = {
        mode: 'replace',
        providers: {
          [providerId]: {
            baseUrl,
            api: providerApi,
            apiKey: apiConfig.apiKey,
            auth: 'api-key',
            models: [
              {
                id: modelId,
                name: normalizeModelName(modelId),
                api: providerApi,
                input: ['text'],
              },
            ],
          },
        },
      };
      (managedConfig.agents as Record<string, unknown>).defaults = {
        ...((managedConfig.agents as Record<string, unknown>).defaults as Record<string, unknown>),
        model: {
          primary: `${providerId}/${modelId}`,
        },
      };
    }

    const nextContent = `${JSON.stringify(managedConfig, null, 2)}\n`;

    let currentContent = '';
    try {
      currentContent = fs.readFileSync(configPath, 'utf8');
    } catch {
      currentContent = '';
    }

    if (currentContent === nextContent) {
      return { ok: true, changed: false, configPath };
    }

    try {
      ensureDir(path.dirname(configPath));
      const tmpPath = `${configPath}.tmp-${Date.now()}`;
      fs.writeFileSync(tmpPath, nextContent, 'utf8');
      fs.renameSync(tmpPath, configPath);
      return { ok: true, changed: true, configPath };
    } catch (error) {
      return {
        ok: false,
        changed: false,
        configPath,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
