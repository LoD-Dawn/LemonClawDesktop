import { Skill, MarketplacePagination, MarketplaceSkill, MarketTag, LocalSkillInfo, LocalizedText } from '../types/skill';
import { i18nService } from './i18n';

export function resolveLocalizedText(text: string | LocalizedText): string {
  if (!text) return '';
  if (typeof text === 'string') return text;
  const lang = i18nService.getLanguage();
  return text[lang] || text.en || '';
}

type EmailConnectivityCheck = {
  code: 'imap_connection' | 'smtp_connection';
  level: 'pass' | 'fail';
  message: string;
  durationMs: number;
};

type EmailConnectivityTestResult = {
  testedAt: number;
  verdict: 'pass' | 'fail';
  checks: EmailConnectivityCheck[];
};

type MarketplaceFetchResult = {
  skills: MarketplaceSkill[];
  tags: MarketTag[];
  pagination: MarketplacePagination;
  error?: string;
};

const DEFAULT_MARKETPLACE_PAGINATION: MarketplacePagination = {
  page: 1,
  pageSize: 20,
  total: 0,
  pageCount: 1,
};

const normalizeMarketTag = (tag: MarketTag): MarketTag | null => {
  const id = tag.id.trim();
  if (!id) {
    return null;
  }

  return {
    id,
    en: tag.en || id,
    zh: tag.zh || null,
  };
};

const buildMarketplaceTags = (skills: MarketplaceSkill[]): MarketTag[] => {
  const seen = new Set<string>();
  const tags: MarketTag[] = [];

  skills.forEach((skill) => {
    skill.tags?.forEach((tag) => {
      const normalizedTag = normalizeMarketTag(tag);
      if (!normalizedTag || seen.has(normalizedTag.id)) {
        return;
      }
      seen.add(normalizedTag.id);
      tags.push(normalizedTag);
    });
  });

  return tags;
};

class SkillService {
  private skills: Skill[] = [];
  private initialized = false;
  private localSkillDescriptions: Map<string, string | LocalizedText> = new Map();
  private marketplaceSkillDescriptions: Map<string, string | LocalizedText> = new Map();

  async init(): Promise<void> {
    if (this.initialized) return;
    await this.loadSkills();
    this.initialized = true;
  }

  async loadSkills(): Promise<Skill[]> {
    try {
      const result = await window.electron.skills.list();
      if (result.success && result.skills) {
        this.skills = result.skills;
      } else {
        this.skills = [];
      }
      return this.skills;
    } catch (error) {
      console.error('Failed to load skills:', error);
      this.skills = [];
      return this.skills;
    }
  }

  async setSkillEnabled(id: string, enabled: boolean): Promise<Skill[]> {
    try {
      const result = await window.electron.skills.setEnabled({ id, enabled });
      if (result.success && result.skills) {
        this.skills = result.skills;
        return this.skills;
      }
      throw new Error(result.error || 'Failed to update skill');
    } catch (error) {
      console.error('Failed to update skill:', error);
      throw error;
    }
  }

  async deleteSkill(id: string): Promise<{ success: boolean; skills?: Skill[]; error?: string }> {
    try {
      const result = await window.electron.skills.delete(id);
      if (result.success && result.skills) {
        this.skills = result.skills;
      }
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete skill';
      console.error('Failed to delete skill:', error);
      return { success: false, error: message };
    }
  }

  async downloadSkill(source: string): Promise<{ success: boolean; skills?: Skill[]; error?: string }> {
    try {
      const result = await window.electron.skills.download(source);
      if (result.success && result.skills) {
        this.skills = result.skills;
      }
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to download skill';
      console.error('Failed to download skill:', error);
      return { success: false, error: message };
    }
  }

  async getSkillsRoot(): Promise<string | null> {
    try {
      const result = await window.electron.skills.getRoot();
      if (result.success && result.path) {
        return result.path;
      }
      return null;
    } catch (error) {
      console.error('Failed to get skills root:', error);
      return null;
    }
  }

  onSkillsChanged(callback: () => void): () => void {
    return window.electron.skills.onChanged(callback);
  }

  getSkills(): Skill[] {
    return this.skills;
  }

  getEnabledSkills(): Skill[] {
    return this.skills.filter(s => s.enabled);
  }

  getSkillById(id: string): Skill | undefined {
    return this.skills.find(s => s.id === id);
  }

  async getSkillConfig(skillId: string): Promise<Record<string, string>> {
    try {
      const result = await window.electron.skills.getConfig(skillId);
      if (result.success && result.config) {
        return result.config;
      }
      return {};
    } catch (error) {
      console.error('Failed to get skill config:', error);
      return {};
    }
  }

  async setSkillConfig(skillId: string, config: Record<string, string>): Promise<boolean> {
    try {
      const result = await window.electron.skills.setConfig(skillId, config);
      return result.success;
    } catch (error) {
      console.error('Failed to set skill config:', error);
      return false;
    }
  }

  async testEmailConnectivity(
    skillId: string,
    config: Record<string, string>
  ): Promise<EmailConnectivityTestResult | null> {
    try {
      const result = await window.electron.skills.testEmailConnectivity(skillId, config);
      if (result.success && result.result) {
        return result.result;
      }
      return null;
    } catch (error) {
      console.error('Failed to test email connectivity:', error);
      return null;
    }
  }

  async getAutoRoutingPrompt(): Promise<string | null> {
    try {
      const result = await window.electron.skills.autoRoutingPrompt();
      return result.success ? (result.prompt || null) : null;
    } catch (error) {
      console.error('Failed to get auto-routing prompt:', error);
      return null;
    }
  }
  async fetchMarketplaceSkills(options?: { page?: number; pageSize?: number }): Promise<MarketplaceFetchResult> {
    try {
      const result = await window.electron.skills.fetchMarketplace(options);
      if (!result.success) {
        return {
          skills: [],
          tags: [],
          pagination: DEFAULT_MARKETPLACE_PAGINATION,
          error: result.error || 'Failed to fetch marketplace skills',
        };
      }

      const skills: MarketplaceSkill[] = Array.isArray(result.data) ? result.data : [];
      const normalizedSkills = skills.map((skill) => ({
        ...skill,
        tags: Array.isArray(skill.tags)
          ? skill.tags
              .map((tag) => normalizeMarketTag(tag))
              .filter((tag): tag is MarketTag => Boolean(tag))
          : [],
        tagIds: Array.isArray(skill.tagIds) ? skill.tagIds : (skill.tags || []).map((tag) => tag.id),
      }));

      const localSkills: LocalSkillInfo[] = [];
      this.localSkillDescriptions.clear();
      for (const ls of localSkills) {
        this.localSkillDescriptions.set(ls.name, ls.description);
      }

      this.marketplaceSkillDescriptions.clear();
      for (const ms of normalizedSkills) {
        if (typeof ms.description === 'object') {
          this.marketplaceSkillDescriptions.set(ms.id, ms.description);
        }
      }

      return {
        skills: normalizedSkills,
        tags: buildMarketplaceTags(normalizedSkills),
        pagination: result.pagination || DEFAULT_MARKETPLACE_PAGINATION,
      };
    } catch (error) {
      console.error('Failed to fetch marketplace skills:', error);
      return {
        skills: [],
        tags: [],
        pagination: DEFAULT_MARKETPLACE_PAGINATION,
        error: error instanceof Error ? error.message : 'Failed to fetch marketplace skills',
      };
    }
  }

  getLocalizedSkillDescription(skillId: string, skillName: string, fallback: string): string {
    const localDesc = this.localSkillDescriptions.get(skillName);
    if (localDesc != null) return resolveLocalizedText(localDesc);
    const marketDesc = this.marketplaceSkillDescriptions.get(skillId);
    if (marketDesc != null) return resolveLocalizedText(marketDesc);
    return fallback;
  }
}

export const skillService = new SkillService();
