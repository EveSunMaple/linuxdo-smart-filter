export interface TopicTag {
  name: string;
  slug?: string;
}

export interface Topic {
  id: number;
  title: string;
  fancy_title?: string;
  category_id: number;
  tags?: TopicTag[];
  posts_count?: number;
  views?: number;
  created_at?: string;
}

export type RuleMode = 'filter' | 'highlight';

export interface RuleScope {
  type: 'global' | 'home' | 'category';
  categoryIds?: number[];
  includeHome?: boolean;
}

export interface RuleWhen {
  categoryNames?: string[];
  tagsAny?: string[];
  tagsNone?: string[];
  minAsk?: number;
  minBuzz?: number;
  minShield?: number;
  titleMaxLen?: number;
  titleMinLen?: number;
  titleRegexAny?: string[];
}

export interface Rule {
  id: string;
  name: string;
  mode: RuleMode;
  enabled: boolean;
  color?: string;
  preset?: boolean;
  shieldable?: boolean;
  scope?: RuleScope;
  when?: RuleWhen;
}

export interface Lexicons {
  ask: string[];
  buzz: string[];
  shield: string[];
}

export interface Exemptions {
  topicIds: number[];
  titleKeywords: string[];
}

export interface Config {
  version: number;
  masterEnabled: boolean;
  debug: boolean;
  rules: Rule[];
  lexicons: Lexicons;
  exemptions: Exemptions;
}

export interface Signals {
  title: string;
  titleLen: number;
  askHits: string[];
  buzzHits: string[];
  shieldHits: string[];
}

export type Decision =
  | { kind: 'keep' }
  | { kind: 'filter'; rule: Rule; ruleIndex: number; reason: string; signals: Signals }
  | { kind: 'highlight'; rule: Rule; ruleIndex: number; color: string; reason: string; signals: Signals };

export interface PageInfo {
  kind: 'home' | 'category' | 'other';
  route?: string;
  categoryId?: number;
  filter?: string;
  key: string;
}

export interface FilteredEntry {
  topic: Topic;
  ruleName: string;
  reason: string;
  time: number;
}
