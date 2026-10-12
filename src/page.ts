import type { PageInfo } from './types';

const HOME_ROUTES = ['latest', 'new', 'unseen', 'hot', 'top', 'read'];

export interface CategoryRecord {
  id: number;
  name: string;
  slug: string;
  parentId: number | null;
}

export interface CategoryMap {
  byId: Map<number, CategoryRecord>;
  byName: Map<string, CategoryRecord[]>;
  childrenOf: Map<number, number[]>;
}

export function pageContext(href: string): PageInfo {
  try {
    const url = new URL(href, 'https://linux.do/');
    const catParam = /[?&]category=(\d+)/i.exec(url.search);
    if (catParam) {
      const id = parseInt(catParam[1], 10);
      const f = (/[?&]order=([a-z]+)/i.exec(url.search) || [])[1] || 'latest';
      return { kind: 'category', categoryId: id, filter: f.toLowerCase(), key: 'cat:' + id + ':' + f.toLowerCase() };
    }
    if (url.pathname === '/' || url.pathname === '') return { kind: 'home', route: 'latest', key: 'home:latest' };
    const hm = new RegExp('^/(' + HOME_ROUTES.join('|') + ')(\\.json)?(/.*)?$', 'i').exec(url.pathname);
    if (hm) {
      const route = hm[1].toLowerCase();
      return { kind: 'home', route, key: 'home:' + route };
    }
    const cm = /^\/c\/[^/]+(?:\/[^/]+)?\/(\d+)(?:\/l\/([a-z]+))?/i.exec(url.pathname);
    if (cm) {
      const id = parseInt(cm[1], 10);
      const f = (cm[2] || 'latest').toLowerCase();
      return { kind: 'category', categoryId: id, filter: f, key: 'cat:' + id + ':' + f };
    }
    return { kind: 'other', key: 'other' };
  } catch {
    return { kind: 'other', key: 'other' };
  }
}

export function isFilterablePage(pg: PageInfo): boolean {
  return pg.kind === 'home' || pg.kind === 'category';
}

export function buildCategoryMap(categories: unknown): CategoryMap | null {
  if (!Array.isArray(categories)) return null;
  const byId = new Map<number, CategoryRecord>();
  const byName = new Map<string, CategoryRecord[]>();
  const childrenOf = new Map<number, number[]>();
  for (const c of categories as Array<Record<string, unknown>>) {
    if (!c || typeof c.id !== 'number' || typeof c.name !== 'string') continue;
    const rec: CategoryRecord = {
      id: c.id,
      name: c.name,
      slug: typeof c.slug === 'string' ? c.slug : '',
      parentId: typeof c.parent_category_id === 'number' ? c.parent_category_id : null,
    };
    byId.set(rec.id, rec);
    if (!byName.has(rec.name)) byName.set(rec.name, []);
    byName.get(rec.name)!.push(rec);
  }
  for (const rec of byId.values()) {
    if (rec.parentId == null) continue;
    if (!childrenOf.has(rec.parentId)) childrenOf.set(rec.parentId, []);
    childrenOf.get(rec.parentId)!.push(rec.id);
  }
  if (!byId.size) return null;
  return { byId, byName, childrenOf };
}

export function resolveCategoryNames(names: string[], map: CategoryMap | null): { ids: Set<number>; missing: string[] } {
  const ids = new Set<number>();
  const missing: string[] = [];
  if (!map) return { ids, missing: [...names] };
  for (const name of names) {
    const cands = map.byName.get(name);
    if (!cands || !cands.length) {
      missing.push(name);
      continue;
    }
    const root = cands.find((c) => c.parentId === null) || cands[0];
    const stack = [root.id];
    while (stack.length) {
      const id = stack.pop()!;
      if (ids.has(id)) continue;
      ids.add(id);
      for (const child of map.childrenOf.get(id) || []) stack.push(child);
    }
  }
  return { ids, missing };
}

export function categoryNameOf(map: CategoryMap | null, id: number): string {
  const rec = map?.byId.get(id);
  return rec ? rec.name : '#' + id;
}

export function categoryHref(map: CategoryMap | null, id: number): string {
  const rec = map?.byId.get(id);
  if (!rec) return '#';
  const parts = [rec.slug || 'category'];
  let cur = rec;
  while (cur.parentId != null) {
    const parent = map?.byId.get(cur.parentId);
    if (!parent) break;
    parts.unshift(parent.slug || 'category');
    cur = parent;
  }
  return '/c/' + parts.join('/') + '/' + rec.id;
}
