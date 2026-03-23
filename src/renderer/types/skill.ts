// Skill type definition
export interface Skill {
  id: string;
  name: string;
  description: string;
  enabled: boolean;       // Whether visible in popover
  isOfficial: boolean;    // "官方" badge
  isBuiltIn: boolean;     // Bundled with app, cannot be deleted
  updatedAt: number;      // Timestamp
  prompt: string;         // System prompt content
  skillPath: string;      // Absolute path to SKILL.md
  version?: string;       // Skill version from SKILL.md frontmatter
}

export type LocalizedText = { en?: string | null; zh?: string | null };

export interface MarketplaceSkillPermission {
  accessState?: string | null;
  canUse: boolean;
  canApply: boolean;
  grantStatus?: string | null;
  applicationStatus?: string | null;
  sensitiveFieldsHidden: boolean;
}

export interface MarketplacePagination {
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
}

export interface MarketTag {
  id: string;
  en: string;
  zh: string | null;
}

export interface LocalSkillInfo {
  id: string;
  name: string;
  description: string | LocalizedText;
  version: string;
}

export interface MarketplaceSkill {
  id: string;
  resourceId?: string;
  name: string;
  description: string | LocalizedText;
  tags?: MarketTag[];
  tagIds?: string[];
  url: string;              // Download URL (.zip)
  version: string;
  source: {
    from: string;           // e.g. "Github"
    url: string;            // Source repo URL
    author?: string;        // Author name
  };
  permission?: MarketplaceSkillPermission;
}
