import { defaultLexicons } from './lexicons';
import { defaultPresets } from './presets';
import type { Config, Exemptions, Lexicons, Rule, RuleScope, RuleWhen } from './types';

const KEY = 'ldf_config_v1';
const CONFIG_VERSION = 1;

let cached: Config | null = null;

function readRaw(): unknown {
  try {
    if (typeof GM_getValue === 'function') return GM_getValue<unknown>(KEY, null);
  } catch {
    /* ignore */
  }
  try {
    const s = localStorage.getItem(KEY);
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
}

function writeRaw(cfg: Config): void {
  try {
    if (typeof GM_setValue === 'function') {
      GM_setValue(KEY, cfg);
      return;
    }
  } catch {
    /* ignore */
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(cfg));
  } catch {
    /* ignore */
  }
}

function normalizeExemptions(x: unknown): Exemptions {
  const e = (x ?? {}) as Partial<Exemptions>;
  return {
    topicIds: Array.isArray(e.topicIds) ? e.topicIds.filter((n) => typeof n === 'number') : [],
    titleKeywords: Array.isArray(e.titleKeywords) ? e.titleKeywords.filter((s) => typeof s === 'string') : [],
  };
}

function normalizeLexicons(x: unknown): Lexicons {
  const def = defaultLexicons();
  const l = (x ?? {}) as Partial<Lexicons>;
  const pick = (v: unknown, d: string[]): string[] =>
    Array.isArray(v) ? v.filter((s) => typeof s === 'string' && s.trim().length > 0) : d;
  return { ask: pick(l.ask, def.ask), buzz: pick(l.buzz, def.buzz), shield: pick(l.shield, def.shield) };
}

function strArray(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out = v.filter((s): s is string => typeof s === 'string' && s.trim().length > 0);
  return out.length ? out : undefined;
}

function nonNegNumber(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : undefined;
}

function normalizeWhen(x: unknown): RuleWhen | undefined {
  if (!x || typeof x !== 'object') return undefined;
  const w = x as Record<string, unknown>;
  const out: RuleWhen = {};
  const categoryNames = strArray(w.categoryNames);
  if (categoryNames) out.categoryNames = categoryNames;
  const tagsAny = strArray(w.tagsAny);
  if (tagsAny) out.tagsAny = tagsAny;
  const tagsNone = strArray(w.tagsNone);
  if (tagsNone) out.tagsNone = tagsNone;
  const minAsk = nonNegNumber(w.minAsk);
  if (minAsk != null) out.minAsk = minAsk;
  const minBuzz = nonNegNumber(w.minBuzz);
  if (minBuzz != null) out.minBuzz = minBuzz;
  const minShield = nonNegNumber(w.minShield);
  if (minShield != null) out.minShield = minShield;
  const titleMaxLen = nonNegNumber(w.titleMaxLen);
  if (titleMaxLen != null) out.titleMaxLen = titleMaxLen;
  const titleMinLen = nonNegNumber(w.titleMinLen);
  if (titleMinLen != null) out.titleMinLen = titleMinLen;
  const titleRegexAny = strArray(w.titleRegexAny);
  if (titleRegexAny) out.titleRegexAny = titleRegexAny;
  return out;
}

function normalizeScope(x: unknown): RuleScope | undefined {
  if (!x || typeof x !== 'object') return undefined;
  const s = x as Record<string, unknown>;
  if (s.type === 'home') return { type: 'home' };
  if (s.type === 'category') {
    const ids = Array.isArray(s.categoryIds)
      ? s.categoryIds.filter((n): n is number => typeof n === 'number' && Number.isFinite(n))
      : [];
    return { type: 'category', categoryIds: ids, includeHome: s.includeHome === true };
  }
  return { type: 'global' };
}

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

function normalizeRule(r: Rule): Rule {
  const out: Rule = {
    id: r.id,
    name: typeof r.name === 'string' && r.name.trim() ? r.name : '未命名规则',
    mode: r.mode === 'highlight' ? 'highlight' : 'filter',
    enabled: r.enabled !== false,
  };
  if (r.preset === true) out.preset = true;
  if (r.shieldable === false) out.shieldable = false;
  if (typeof r.color === 'string' && HEX_COLOR.test(r.color)) out.color = r.color;
  const scope = normalizeScope(r.scope);
  if (scope) out.scope = scope;
  const when = normalizeWhen(r.when);
  if (when) out.when = when;
  return out;
}

function normalizeRules(x: unknown): Rule[] {
  const presets = defaultPresets();
  const raw = Array.isArray(x) ? x : [];
  const valid = raw
    .filter((r): r is Rule => {
      if (!r || typeof r !== 'object') return false;
      const id = (r as { id?: unknown }).id;
      return typeof id === 'string' && id.length > 0;
    })
    .map(normalizeRule);
  const byId = new Map(valid.map((r) => [r.id, r]));
  for (const p of presets) {
    if (!byId.has(p.id)) valid.push(p);
  }
  return valid;
}

export function createDefaultConfig(): Config {
  return {
    version: CONFIG_VERSION,
    masterEnabled: true,
    debug: false,
    rules: defaultPresets(),
    lexicons: defaultLexicons(),
    exemptions: { topicIds: [], titleKeywords: [] },
  };
}

export function loadConfig(): Config {
  if (cached) return cached;
  const raw = readRaw();
  if (!raw || typeof raw !== 'object') {
    cached = createDefaultConfig();
    return cached;
  }
  const r = raw as Partial<Config>;
  cached = {
    version: CONFIG_VERSION,
    masterEnabled: r.masterEnabled !== false,
    debug: r.debug === true,
    rules: normalizeRules(r.rules),
    lexicons: normalizeLexicons(r.lexicons),
    exemptions: normalizeExemptions(r.exemptions),
  };
  return cached;
}

export function saveConfig(): void {
  if (cached) writeRaw(cached);
}

export function getConfig(): Config {
  return loadConfig();
}

export function resetPresets(): void {
  const cfg = loadConfig();
  cfg.rules = [...cfg.rules.filter((r) => !r.preset), ...defaultPresets()];
  saveConfig();
}

export function resetLexicons(): void {
  const cfg = loadConfig();
  cfg.lexicons = defaultLexicons();
  saveConfig();
}

export function exportJSON(): string {
  return JSON.stringify(loadConfig(), null, 2);
}

export function importJSON(text: string): { ok: true } | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return { ok: false, error: `JSON 解析失败：${(e as Error).message}` };
  }
  if (!parsed || typeof parsed !== 'object') return { ok: false, error: '内容不是对象' };
  const r = parsed as Partial<Config>;
  if (!Array.isArray(r.rules) && !r.lexicons && !r.exemptions) {
    return { ok: false, error: '缺少 rules / lexicons / exemptions 字段' };
  }
  const cfg = loadConfig();
  if (Array.isArray(r.rules)) cfg.rules = normalizeRules(r.rules);
  if (r.lexicons) cfg.lexicons = normalizeLexicons(r.lexicons);
  if (r.exemptions) cfg.exemptions = normalizeExemptions(r.exemptions);
  if (typeof r.masterEnabled === 'boolean') cfg.masterEnabled = r.masterEnabled;
  if (typeof r.debug === 'boolean') cfg.debug = r.debug;
  saveConfig();
  return { ok: true };
}
