import { extractSignals, hasTag } from './classify';
import { type CategoryMap, resolveCategoryNames } from './page';
import type { Decision, Exemptions, Lexicons, PageInfo, Rule, Signals, Topic } from './types';

export interface CompiledRule {
  rule: Rule;
  ruleIndex: number;
  categoryIds: Set<number> | null;
  scopeIds: Set<number> | null;
  regexes: RegExp[];
  compileError?: string;
}

export interface CompiledState {
  rules: CompiledRule[];
  errors: Map<string, string>;
}

export interface DecideCtx {
  lex: Lexicons;
  exemptions: Exemptions;
}

function expandIds(ids: number[], map: CategoryMap | null): Set<number> {
  const out = new Set<number>();
  if (!map) {
    for (const id of ids) out.add(id);
    return out;
  }
  const stack = [...ids];
  while (stack.length) {
    const id = stack.pop()!;
    if (out.has(id)) continue;
    out.add(id);
    for (const ch of map.childrenOf.get(id) || []) stack.push(ch);
  }
  return out;
}

function compileOne(rule: Rule, index: number, map: CategoryMap | null): CompiledRule {
  const compiled: CompiledRule = { rule, ruleIndex: index, categoryIds: null, scopeIds: null, regexes: [] };
  const w = rule.when || {};
  const hasAnyCondition =
    (w.categoryNames && w.categoryNames.length > 0) ||
    (w.tagsAny && w.tagsAny.length > 0) ||
    (w.tagsNone && w.tagsNone.length > 0) ||
    w.minAsk != null ||
    w.minBuzz != null ||
    w.minShield != null ||
    w.titleMaxLen != null ||
    w.titleMinLen != null ||
    (w.titleRegexAny && w.titleRegexAny.length > 0);
  if (!hasAnyCondition) {
    compiled.compileError = '规则没有任何匹配条件';
    return compiled;
  }
  if (w.categoryNames?.length) {
    const { ids, missing } = resolveCategoryNames(w.categoryNames, map);
    if (!map) {
      compiled.compileError = '板块映射未就绪';
      return compiled;
    }
    if (missing.length) {
      compiled.compileError = `找不到板块：${missing.join('、')}`;
      return compiled;
    }
    compiled.categoryIds = ids;
  }
  const scope = rule.scope;
  if (scope && scope.type === 'category') {
    if (!map) {
      compiled.compileError = '板块映射未就绪';
      return compiled;
    }
    compiled.scopeIds = expandIds(scope.categoryIds || [], map);
  }
  for (const src of w.titleRegexAny || []) {
    try {
      compiled.regexes.push(new RegExp(src, 'i'));
    } catch (_e) {
      compiled.compileError = `正则无效：${src}`;
      return compiled;
    }
  }
  return compiled;
}

export function compileRules(rules: Rule[], map: CategoryMap | null): CompiledState {
  const compiled: CompiledRule[] = [];
  const errors = new Map<string, string>();
  rules.forEach((rule, index) => {
    const c = compileOne(rule, index, map);
    compiled.push(c);
    if (c.compileError) errors.set(rule.id, c.compileError);
  });
  return { rules: compiled, errors };
}

export function ruleAppliesToPage(c: CompiledRule, pg: PageInfo): boolean {
  const scope = c.rule.scope;
  if (!scope || scope.type === 'global') return true;
  if (pg.kind === 'other') return false;
  if (scope.type === 'home') return pg.kind === 'home';
  if (scope.type === 'category') {
    if (scope.includeHome && pg.kind === 'home') return true;
    if (pg.kind !== 'category' || pg.categoryId == null) return false;
    return c.scopeIds ? c.scopeIds.has(pg.categoryId) : false;
  }
  return false;
}

export function pageHasActiveRule(state: CompiledState, pg: PageInfo): boolean {
  return state.rules.some((c) => c.rule.enabled && !c.compileError && ruleAppliesToPage(c, pg));
}

function matchRule(c: CompiledRule, topic: Topic, sig: Signals): boolean {
  if (c.compileError) return false;
  const w = c.rule.when || {};
  if (c.categoryIds && !c.categoryIds.has(topic.category_id)) return false;
  if (w.tagsAny?.length) {
    if (!hasTag(topic, w.tagsAny)) return false;
  }
  if (w.tagsNone?.length) {
    if (hasTag(topic, w.tagsNone)) return false;
  }
  if (w.minAsk != null && sig.askHits.length < w.minAsk) return false;
  if (w.minBuzz != null && sig.buzzHits.length < w.minBuzz) return false;
  if (w.minShield != null && sig.shieldHits.length < w.minShield) return false;
  if (w.titleMaxLen != null && sig.titleLen > w.titleMaxLen) return false;
  if (w.titleMinLen != null && sig.titleLen < w.titleMinLen) return false;
  if (c.regexes.length) {
    if (!c.regexes.some((re) => re.test(sig.title))) return false;
  }
  return true;
}

function fmtHits(hits: string[]): string {
  const shown = hits.slice(0, 4);
  return `×${hits.length}（${shown.join('、')}${hits.length > shown.length ? '…' : ''}）`;
}

function buildReason(c: CompiledRule, topic: Topic, sig: Signals): string {
  const parts: string[] = [];
  const w = c.rule.when || {};
  if (w.tagsAny?.length) {
    const tag = hasTag(topic, w.tagsAny);
    if (tag) parts.push(`标签「${tag}」`);
  }
  if (c.categoryIds) parts.push('板块命中');
  if (w.minAsk != null && sig.askHits.length) parts.push(`提问词 ${fmtHits(sig.askHits)}`);
  if (w.minBuzz != null && sig.buzzHits.length) parts.push(`主题词 ${fmtHits(sig.buzzHits)}`);
  if (w.minShield != null && sig.shieldHits.length) parts.push(`优质词 ${fmtHits(sig.shieldHits)}`);
  if (w.titleMaxLen != null || w.titleMinLen != null) parts.push(`标题长度 ${sig.titleLen}`);
  if (c.regexes.length) parts.push('标题正则');
  return parts.join(' + ') || '条件命中';
}

export function decide(topic: Topic, state: CompiledState, pg: PageInfo, ctx: DecideCtx): Decision {
  const ex = ctx.exemptions;
  if (ex.topicIds.includes(topic.id)) return { kind: 'keep' };
  const lower = String(topic.title || '').toLowerCase();
  if (ex.titleKeywords.some((k) => k && lower.includes(k.toLowerCase()))) return { kind: 'keep' };

  const sig = extractSignals(topic, ctx.lex);

  for (const c of state.rules) {
    if (c.rule.mode !== 'filter' || c.rule.shieldable !== false || !c.rule.enabled || c.compileError) continue;
    if (!ruleAppliesToPage(c, pg)) continue;
    if (!matchRule(c, topic, sig)) continue;
    return {
      kind: 'filter',
      rule: c.rule,
      ruleIndex: c.ruleIndex,
      reason: buildReason(c, topic, sig),
      signals: sig,
    };
  }

  for (const c of state.rules) {
    if (c.rule.mode !== 'highlight' || !c.rule.enabled || c.compileError) continue;
    if (!ruleAppliesToPage(c, pg)) continue;
    if (!matchRule(c, topic, sig)) continue;
    return {
      kind: 'highlight',
      rule: c.rule,
      ruleIndex: c.ruleIndex,
      color: c.rule.color || '#1ca551',
      reason: buildReason(c, topic, sig),
      signals: sig,
    };
  }

  for (const c of state.rules) {
    if (c.rule.mode !== 'filter' || c.rule.shieldable === false || !c.rule.enabled || c.compileError) continue;
    if (!ruleAppliesToPage(c, pg)) continue;
    if (!matchRule(c, topic, sig)) continue;
    if (sig.shieldHits.length > 0) continue;
    return {
      kind: 'filter',
      rule: c.rule,
      ruleIndex: c.ruleIndex,
      reason: buildReason(c, topic, sig),
      signals: sig,
    };
  }

  return { kind: 'keep' };
}
