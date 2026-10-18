import { defaultLexicons } from './lexicons';
import { defaultPresets } from './presets';
import type { Config, Exemptions, Lexicons, Rule } from './types';

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

function normalizeRules(x: unknown): Rule[] {
  const presets = defaultPresets();
  const raw = Array.isArray(x) ? (x as Rule[]) : [];
  const valid = raw.filter((r) => r && typeof r === 'object' && typeof r.id === 'string' && r.id.length > 0);
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
