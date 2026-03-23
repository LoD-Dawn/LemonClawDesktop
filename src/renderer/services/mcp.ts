import { McpServerConfig, McpServerFormData, McpRegistryEntry, McpMarketplaceCategoryInfo, McpMarketplaceServer } from '../types/mcp';

const DEFAULT_MCP_MARKETPLACE_PAGINATION = {
  page: 1,
  pageSize: 100,
  total: 0,
  pageCount: 1,
};

const MCP_CATEGORY_LABELS: Record<string, { zh: string; en: string }> = {
  search: { zh: '搜索', en: 'Search' },
  browser: { zh: '浏览器', en: 'Browser' },
  developer: { zh: '开发工具', en: 'Dev Tools' },
  'development-tools': { zh: '开发工具', en: 'Dev Tools' },
  productivity: { zh: '效率工具', en: 'Productivity' },
  design: { zh: '设计', en: 'Design' },
  data: { zh: '数据', en: 'Data' },
  'data-api': { zh: '数据 & API', en: 'Data & API' },
};

const toStartCase = (value: string): string => value
  .split(/[-_\s]+/)
  .filter(Boolean)
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
  .join(' ');

const getCategoryLabel = (categoryId: string): { zh: string; en: string } => {
  const trimmed = categoryId.trim();
  if (!trimmed) {
    return { zh: '其他', en: 'Other' };
  }

  return MCP_CATEGORY_LABELS[trimmed] || {
    zh: trimmed,
    en: toStartCase(trimmed),
  };
};

const buildMarketplaceCategories = (
  servers: McpMarketplaceServer[],
): McpMarketplaceCategoryInfo[] => {
  const categories = new Map<string, McpMarketplaceCategoryInfo>();

  for (const server of servers) {
    const categoryId = server.category?.trim();
    if (!categoryId || categories.has(categoryId)) {
      continue;
    }

    const labels = getCategoryLabel(categoryId);
    categories.set(categoryId, {
      id: categoryId,
      name_zh: labels.zh,
      name_en: labels.en,
    });
  }

  return Array.from(categories.values());
};

/**
 * Convert remote marketplace server data to McpRegistryEntry format.
 */
function convertMarketplaceToRegistry(
  servers: McpMarketplaceServer[],
): McpRegistryEntry[] {
  return servers.map((s) => ({
    id: s.id,
    name: s.name,
    descriptionKey: '',
    resourceId: s.resourceId,
    description_zh: s.description_zh,
    description_en: s.description_en,
    category: s.category,
    categoryKey: '',
    transportType: s.transportType,
    command: s.command,
    defaultArgs: s.defaultArgs,
    requiredEnvKeys: s.requiredEnvKeys,
    optionalEnvKeys: s.optionalEnvKeys,
    permission: s.permission,
  }));
}

class McpService {
  private servers: McpServerConfig[] = [];
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;
    await this.loadServers();
    this.initialized = true;
  }

  async loadServers(): Promise<McpServerConfig[]> {
    try {
      const result = await window.electron.mcp.list();
      if (result.success && result.servers) {
        this.servers = result.servers;
      } else {
        this.servers = [];
      }
      return this.servers;
    } catch (error) {
      console.error('Failed to load MCP servers:', error);
      this.servers = [];
      return this.servers;
    }
  }

  async createServer(data: McpServerFormData): Promise<{ success: boolean; servers?: McpServerConfig[]; error?: string }> {
    try {
      const result = await window.electron.mcp.create(data);
      if (result.success && result.servers) {
        this.servers = result.servers;
      }
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create MCP server';
      console.error('Failed to create MCP server:', error);
      return { success: false, error: message };
    }
  }

  async updateServer(id: string, data: Partial<McpServerFormData>): Promise<{ success: boolean; servers?: McpServerConfig[]; error?: string }> {
    try {
      const result = await window.electron.mcp.update(id, data);
      if (result.success && result.servers) {
        this.servers = result.servers;
      }
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update MCP server';
      console.error('Failed to update MCP server:', error);
      return { success: false, error: message };
    }
  }

  async deleteServer(id: string): Promise<{ success: boolean; servers?: McpServerConfig[]; error?: string }> {
    try {
      const result = await window.electron.mcp.delete(id);
      if (result.success && result.servers) {
        this.servers = result.servers;
      }
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete MCP server';
      console.error('Failed to delete MCP server:', error);
      return { success: false, error: message };
    }
  }

  async setServerEnabled(id: string, enabled: boolean): Promise<McpServerConfig[]> {
    try {
      const result = await window.electron.mcp.setEnabled({ id, enabled });
      if (result.success && result.servers) {
        this.servers = result.servers;
        return this.servers;
      }
      throw new Error(result.error || 'Failed to update MCP server');
    } catch (error) {
      console.error('Failed to update MCP server:', error);
      throw error;
    }
  }

  getServers(): McpServerConfig[] {
    return this.servers;
  }

  getEnabledServers(): McpServerConfig[] {
    return this.servers.filter(s => s.enabled);
  }

  getServerById(id: string): McpServerConfig | undefined {
    return this.servers.find(s => s.id === id);
  }

  async fetchMarketplace(): Promise<{
    registry: McpRegistryEntry[];
    categories: McpMarketplaceCategoryInfo[];
    pagination: typeof DEFAULT_MCP_MARKETPLACE_PAGINATION;
    error?: string;
  }> {
    try {
      const result = await window.electron.mcp.fetchMarketplace({ page: 1 });
      if (!result.success) {
        return {
          registry: [],
          categories: [{ id: 'all', key: 'mcpCategoryAll' }],
          pagination: result.pagination || DEFAULT_MCP_MARKETPLACE_PAGINATION,
          error: result.error || 'Failed to fetch marketplace MCPs',
        };
      }

      const servers = Array.isArray(result.data) ? result.data : [];
      const registry = convertMarketplaceToRegistry(servers);
      const categories: McpMarketplaceCategoryInfo[] = [
        { id: 'all', key: 'mcpCategoryAll' },
        ...buildMarketplaceCategories(servers),
      ];

      return {
        registry,
        categories,
        pagination: result.pagination || DEFAULT_MCP_MARKETPLACE_PAGINATION,
      };
    } catch (error) {
      console.error('Failed to fetch MCP marketplace:', error);
      return {
        registry: [],
        categories: [{ id: 'all', key: 'mcpCategoryAll' }],
        pagination: DEFAULT_MCP_MARKETPLACE_PAGINATION,
        error: error instanceof Error ? error.message : 'Failed to fetch marketplace MCPs',
      };
    }
  }
}

export const mcpService = new McpService();
