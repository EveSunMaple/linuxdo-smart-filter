import type { CompiledState, DecideCtx } from './engine';
import { decide, pageHasActiveRule } from './engine';
import { buildCategoryMap, type CategoryMap, isFilterablePage, pageContext } from './page';
import type { Config, FilteredEntry, PageInfo, Topic, TopicTag } from './types';

const BUCKET_MAX = 1000;

export interface Host {
  getConfig(): Config;
  getState(): CompiledState;
  getCatMap(): CategoryMap | null;
  setCatMap(map: CategoryMap): void;
  onCatMapReady(): void;
  onBucketChange(): void;
  log(...args: unknown[]): void;
}

interface Bucket {
  map: Map<number, FilteredEntry>;
  order: number[];
}

const buckets = new Map<string, Bucket>();
const pageHighlights = new Map<string, Map<number, string>>();
let currentPage: PageInfo = pageContext(location.href);
let host: Host | null = null;
let nativeFetch: typeof fetch | null = null;
let preloadDone = false;
let domRaf = 0;

function bucketFor(key: string): Bucket {
  let b = buckets.get(key);
  if (!b) {
    b = { map: new Map(), order: [] };
    buckets.set(key, b);
  }
  return b;
}

function addToBucket(key: string, entry: FilteredEntry): boolean {
  const b = bucketFor(key);
  if (b.map.has(entry.topic.id)) return false;
  b.map.set(entry.topic.id, entry);
  b.order.push(entry.topic.id);
  while (b.order.length > BUCKET_MAX) {
    const old = b.order.shift()!;
    b.map.delete(old);
  }
  return true;
}

export function currentFilteredEntries(): FilteredEntry[] {
  const b = buckets.get(currentPage.key);
  if (!b) return [];
  const out: FilteredEntry[] = [];
  for (const id of b.order) {
    const e = b.map.get(id);
    if (e) out.push(e);
  }
  return out;
}

export function filteredCount(): number {
  return currentFilteredEntries().length;
}

export function getCurrentPage(): PageInfo {
  return currentPage;
}

export function syncCurrentPage(): void {
  currentPage = pageContext(location.href);
}

export function processTopicList(
  pg: PageInfo,
  obj: unknown,
): { kept: number; filtered: number; highlights: number } | null {
  if (!host) return null;
  const rec = obj as { topic_list?: { topics?: unknown[] } };
  const tl = rec.topic_list;
  if (!tl || !Array.isArray(tl.topics)) return null;
  const state = host.getState();
  const cfg = host.getConfig();
  const ctx = { lex: cfg.lexicons, exemptions: cfg.exemptions };

  const highlights: Array<{ topic: Topic; color: string; rank: number }> = [];
  const kept: Topic[] = [];
  let filtered = 0;

  for (const raw of tl.topics) {
    const topic = raw as Topic;
    if (!topic || typeof topic.id !== 'number') {
      kept.push(topic);
      continue;
    }
    const d = decideTopic(topic, state, pg, ctx);
    if (d.kind === 'filter') {
      addToBucket(pg.key, { topic, ruleName: d.rule.name, reason: d.reason, time: Date.now() });
      filtered++;
      if (cfg.debug) host.log('过滤', topic.title, '=>', d.rule.name, d.reason);
    } else if (d.kind === 'highlight') {
      highlights.push({ topic, color: d.color, rank: d.ruleIndex });
      if (cfg.debug) host.log('高亮', topic.title, '=>', d.rule.name, d.reason);
    } else {
      kept.push(topic);
    }
  }

  highlights.sort((a, b) => a.rank - b.rank);
  if (highlights.length) {
    let hlMap = pageHighlights.get(pg.key);
    if (!hlMap) {
      hlMap = new Map();
      pageHighlights.set(pg.key, hlMap);
    }
    for (const h of highlights) hlMap.set(h.topic.id, h.color);
  }

  tl.topics = [...highlights.map((h) => h.topic), ...kept];

  if (filtered > 0) {
    host.onBucketChange();
    if (pg.key === currentPage.key) scheduleDomPass();
  }
  return { kept: kept.length, filtered, highlights: highlights.length };
}

function decideTopic(topic: Topic, state: CompiledState, pg: PageInfo, ctx: DecideCtx) {
  return decide(topic, state, pg, ctx);
}

function looksLikeTopicList(text: string): boolean {
  return text.indexOf('"topic_list"') !== -1 && text.indexOf('"topics"') !== -1;
}

function scheduleDomPass(): void {
  if (domRaf) return;
  domRaf = requestAnimationFrame(() => {
    domRaf = 0;
    domPass();
  });
}

interface DomDecided {
  kind: 'keep' | 'filter' | 'highlight';
  color?: string;
}

const domDecided = new Map<string, Map<number, DomDecided>>();

function decidedFor(key: string): Map<number, DomDecided> {
  let m = domDecided.get(key);
  if (!m) {
    m = new Map();
    domDecided.set(key, m);
  }
  return m;
}

function hideRow(row: HTMLElement): void {
  if (row.dataset.ldfHidden) return;
  row.dataset.ldfHidden = '1';
  row.style.display = 'none';
}

function paintRow(row: HTMLElement, color: string): void {
  if (!row.classList.contains('ldf-highlight')) row.classList.add('ldf-highlight');
  row.style.setProperty('--ldf-hl', color);
}

function getDomTopic(row: HTMLElement): Topic | null {
  const id = parseInt(row.getAttribute('data-topic-id') || '', 10);
  if (!Number.isFinite(id)) return null;
  const titleEl = row.querySelector<HTMLElement>('a.raw-topic-link, a.title, .topic-list-item-title');
  const title = (titleEl?.textContent || '').replace(/\s+/g, ' ').trim();
  if (!title) return null;
  const catAttr = row.getAttribute('data-category-id');
  const categoryId = catAttr ? parseInt(catAttr, 10) : 0;
  const tags: TopicTag[] = [];
  row.querySelectorAll<HTMLElement>('a.discourse-tag').forEach((a) => {
    const name = a.getAttribute('data-tag-name') || (a.textContent || '').trim();
    if (name && !tags.some((t) => t.name === name)) tags.push({ name });
  });
  const intOf = (sel: string): number | undefined => {
    const el = row.querySelector(sel);
    if (!el) return undefined;
    const n = parseInt((el.textContent || '').replace(/[^\d]/g, ''), 10);
    return Number.isFinite(n) ? n : undefined;
  };
  const replies = intOf('.posts .number, .posts-map .number');
  const views = intOf('.views .number');
  return {
    id,
    title,
    category_id: Number.isFinite(categoryId) ? categoryId : 0,
    tags,
    posts_count: replies != null ? replies + 1 : undefined,
    views,
  };
}

function domPass(): void {
  if (!host) return;
  const cfg = host.getConfig();
  if (!cfg.masterEnabled) return;
  const state = host.getState();
  if (!pageHasActiveRule(state, currentPage)) return;
  const bucket = buckets.get(currentPage.key);
  const hlMap = pageHighlights.get(currentPage.key);
  const decided = decidedFor(currentPage.key);
  let bucketChanged = false;

  document.querySelectorAll<HTMLElement>('tr[data-topic-id]').forEach((row) => {
    const id = parseInt(row.getAttribute('data-topic-id') || '', 10);
    if (!Number.isFinite(id)) return;
    if (bucket?.map.has(id)) {
      hideRow(row);
      return;
    }
    if (hlMap?.has(id)) {
      paintRow(row, hlMap.get(id)!);
      return;
    }
    const known = decided.get(id);
    if (known) {
      if (known.kind === 'filter') hideRow(row);
      else if (known.kind === 'highlight') paintRow(row, known.color || '#1ca551');
      return;
    }
    const topic = getDomTopic(row);
    if (!topic) return;
    const d = decide(topic, state, currentPage, { lex: cfg.lexicons, exemptions: cfg.exemptions });
    if (d.kind === 'filter') {
      decided.set(id, { kind: 'filter' });
      addToBucket(currentPage.key, { topic, ruleName: d.rule.name, reason: d.reason, time: Date.now() });
      bucketChanged = true;
      hideRow(row);
      if (cfg.debug) host?.log('DOM兜底过滤', topic.title, '=>', d.rule.name, d.reason);
    } else if (d.kind === 'highlight') {
      decided.set(id, { kind: 'highlight', color: d.color });
      let m = pageHighlights.get(currentPage.key);
      if (!m) {
        m = new Map();
        pageHighlights.set(currentPage.key, m);
      }
      m.set(id, d.color);
      paintRow(row, d.color);
    } else {
      decided.set(id, { kind: 'keep' });
    }
  });

  if (bucketChanged) host.onBucketChange();

  if (bucket?.order.length) {
    const body = document.querySelector('.topic-list-body');
    if (body) {
      const rows = body.querySelectorAll<HTMLElement>('tr[data-topic-id]');
      const allHidden =
        rows.length > 0 && Array.from(rows).every((r) => r.dataset.ldfHidden === '1' || r.style.display === 'none');
      if (body.children.length === 0 || allHidden) showSelfEmptyNotice(currentPage.key, bucket.order.length);
    }
  }
}

const selfEmptyShown = new Set<string>();
function showSelfEmptyNotice(key: string, count: number): void {
  if (selfEmptyShown.has(key)) return;
  selfEmptyShown.add(key);
  window.dispatchEvent(new CustomEvent('ldf:self-empty', { detail: { count } }));
}

function rewritePreload(script: HTMLScriptElement): void {
  if (!host || preloadDone) return;
  const text = script.textContent;
  if (!text || text.indexOf('"topic_list"') === -1) return;
  try {
    const outer = JSON.parse(text) as Record<string, unknown>;
    const siteRaw = outer.site;
    if (siteRaw) {
      const site = typeof siteRaw === 'string' ? JSON.parse(siteRaw) : siteRaw;
      const map = buildCategoryMap((site as { categories?: unknown })?.categories);
      if (map) {
        host.setCatMap(map);
        host.onCatMapReady();
      }
    }
    const pg = pageContext(location.href);
    currentPage = pg;
    if (isFilterablePage(pg) && pageHasActiveRule(host.getState(), pg)) {
      const tlRaw = outer.topic_list;
      const tl = typeof tlRaw === 'string' ? JSON.parse(tlRaw) : tlRaw;
      const r = processTopicList(pg, { topic_list: tl });
      if (r && typeof tlRaw === 'string') outer.topic_list = JSON.stringify(tl);
      if (r) host.log('预载改写', pg.key, r);
    }
    script.textContent = JSON.stringify(outer);
    preloadDone = true;
  } catch (e) {
    host.log('预载改写失败', e);
  }
}

function hookPreload(): void {
  const existing = document.querySelector('script#data-preloaded');
  if (existing) rewritePreload(existing as HTMLScriptElement);
  if (preloadDone) return;
  const observer = new MutationObserver((mutations) => {
    if (preloadDone) {
      observer.disconnect();
      return;
    }
    for (const m of mutations) {
      for (const node of Array.from(m.addedNodes)) {
        if (!(node instanceof Element)) continue;
        if (node.matches('script#data-preloaded')) rewritePreload(node as HTMLScriptElement);
        else {
          const s = node.querySelector('script#data-preloaded');
          if (s) rewritePreload(s as HTMLScriptElement);
        }
      }
    }
  });
  observer.observe(document.documentElement || document, { childList: true, subtree: true });
}

function hookFetch(): void {
  if (typeof nativeFetch !== 'function') return;
  const native = nativeFetch;
  window.fetch = function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const pg = pageContext(url);
    if (!host || !isFilterablePage(pg) || !pageHasActiveRule(host.getState(), pg)) {
      return native.apply(this, [input, init] as Parameters<typeof fetch>);
    }
    return native.apply(this, [input, init] as Parameters<typeof fetch>).then((resp) => {
      const ct = resp.headers.get('content-type') || '';
      if (ct.indexOf('json') === -1) return resp;
      return resp
        .clone()
        .text()
        .then((text) => {
          if (!looksLikeTopicList(text)) return resp;
          try {
            const obj = JSON.parse(text);
            const r = processTopicList(pg, obj);
            if (!r) return resp;
            return new Response(JSON.stringify(obj), {
              status: resp.status,
              statusText: resp.statusText,
              headers: resp.headers,
            });
          } catch (e) {
            host?.log('fetch 过滤失败', e);
            return resp;
          }
        });
    });
  };
}

function hookXHR(): void {
  const XHR = window.XMLHttpRequest;
  const open = XHR.prototype.open;
  const send = XHR.prototype.send;
  const descText = Object.getOwnPropertyDescriptor(XHR.prototype, 'responseText');
  const descResp = Object.getOwnPropertyDescriptor(XHR.prototype, 'response');
  XHR.prototype.open = function (
    this: XMLHttpRequest & { __ldfUrl?: string },
    method: string,
    url: string | URL,
    ...rest: unknown[]
  ) {
    this.__ldfUrl = String(url);
    return (open as (...args: unknown[]) => void).apply(this, [method, url, ...rest]);
  };
  XHR.prototype.send = function (
    this: XMLHttpRequest & { __ldfUrl?: string; __ldfCache?: string },
    ...args: unknown[]
  ) {
    const pg = pageContext(this.__ldfUrl || '');
    if (host && descText && isFilterablePage(pg) && pageHasActiveRule(host.getState(), pg)) {
      const xhr = this;
      const install = (): void => {
        if (xhr.__ldfCache !== undefined) return;
        try {
          Object.defineProperty(xhr, 'responseText', {
            configurable: true,
            get(): string {
              const orig = descText.get?.call(xhr) as string;
              if (xhr.__ldfCache !== undefined) return xhr.__ldfCache;
              if (!looksLikeTopicList(orig)) {
                xhr.__ldfCache = orig;
                return orig;
              }
              try {
                const obj = JSON.parse(orig);
                const r = processTopicList(pg, obj);
                if (!r) {
                  xhr.__ldfCache = orig;
                  return orig;
                }
                xhr.__ldfCache = JSON.stringify(obj);
                return xhr.__ldfCache;
              } catch (e) {
                host?.log('XHR 过滤失败', e);
                xhr.__ldfCache = orig;
                return orig;
              }
            },
          });
          if (descResp) {
            Object.defineProperty(xhr, 'response', {
              configurable: true,
              get(): unknown {
                if (xhr.responseType === '' || xhr.responseType === 'text') return xhr.responseText;
                return descResp.get?.call(xhr);
              },
            });
          }
        } catch (e) {
          host?.log('XHR responseText 劫持失败', e);
        }
      };
      xhr.addEventListener('readystatechange', () => {
        if (xhr.readyState === 4) install();
      });
    }
    return (send as (...args: unknown[]) => void).apply(this, args);
  };
}

function hookDom(): void {
  const observer = new MutationObserver(() => scheduleDomPass());
  const start = (): void => observer.observe(document.body, { childList: true, subtree: true });
  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start, { once: true });
}

function hookHistory(): void {
  const wrap = (fn: History['pushState']): History['pushState'] =>
    function (this: History, ...args: Parameters<History['pushState']>) {
      const r = fn.apply(this, args);
      syncCurrentPage();
      scheduleDomPass();
      return r;
    };
  history.pushState = wrap(history.pushState);
  history.replaceState = wrap(history.replaceState);
  window.addEventListener('popstate', () => {
    syncCurrentPage();
    scheduleDomPass();
  });
}

async function ensureCatMapFallback(h: Host): Promise<void> {
  if (h.getCatMap()) return;
  try {
    const resp = await (nativeFetch || fetch)('/site.json', { headers: { Accept: 'application/json' } });
    const site = (await resp.json()) as { categories?: unknown };
    const map = buildCategoryMap(site?.categories);
    if (map) {
      h.setCatMap(map);
      h.onCatMapReady();
      h.log('已从 /site.json 载入板块映射');
    }
  } catch (e) {
    h.log('拉取 /site.json 失败', e);
  }
}

export async function installInterceptors(h: Host): Promise<void> {
  host = h;
  nativeFetch = window.fetch ? window.fetch.bind(window) : null;
  hookFetch();
  hookXHR();
  hookPreload();
  hookDom();
  hookHistory();
  syncCurrentPage();
  const boot = (): void => {
    if (!preloadDone) {
      const s = document.querySelector('script#data-preloaded');
      if (s) rewritePreload(s as HTMLScriptElement);
    }
    void ensureCatMapFallback(h);
    scheduleDomPass();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
}
