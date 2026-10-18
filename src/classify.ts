import type { Lexicons, Signals, Topic } from './types';

const ASCII_WORD = /^[a-z0-9.+#-]+$/;

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const wordReCache = new Map<string, RegExp | null>();

function wordBoundaryRe(word: string): RegExp | null {
  let re = wordReCache.get(word);
  if (re === undefined) {
    re = ASCII_WORD.test(word) ? new RegExp(`(^|[^a-z0-9])${escapeRe(word)}($|[^a-z0-9])`) : null;
    wordReCache.set(word, re);
  }
  return re;
}

function matchesWord(titleLower: string, word: string): boolean {
  const w = word.toLowerCase();
  const re = wordBoundaryRe(w);
  return re ? re.test(titleLower) : titleLower.includes(w);
}

function collect(titleLower: string, words: string[]): string[] {
  const hits: string[] = [];
  for (const w of words) {
    if (w && matchesWord(titleLower, w)) hits.push(w);
  }
  return hits;
}

export function extractSignals(topic: Topic, lex: Lexicons): Signals {
  const title = String(topic.title || '').trim();
  const lower = title.toLowerCase();
  const askHits = collect(lower, lex.ask);
  if (/[?？]\s*$/.test(title) || /[吗嘛呢]\s*[?？]?$/.test(title)) askHits.push('问句结尾');
  return {
    title,
    titleLen: [...title].length,
    askHits,
    buzzHits: collect(lower, lex.buzz),
    shieldHits: collect(lower, lex.shield),
  };
}

export function hasTag(topic: Topic, names: string[]): string | null {
  if (!Array.isArray(names) || names.length === 0) return null;
  const set = new Set(names.map((s) => s.toLowerCase()));
  for (const t of topic.tags || []) {
    if (t?.name && set.has(t.name.toLowerCase())) return t.name;
  }
  return null;
}
