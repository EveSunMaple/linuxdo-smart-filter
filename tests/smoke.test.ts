import { beforeEach, describe, expect, it, vi } from 'vitest';

function installGmStubs(): Record<string, unknown> {
  const store: Record<string, unknown> = {};
  (globalThis as Record<string, unknown>).GM_getValue = (k: string, d: unknown) => (k in store ? store[k] : d);
  (globalThis as Record<string, unknown>).GM_setValue = (k: string, v: unknown) => {
    store[k] = v;
  };
  (globalThis as Record<string, unknown>).GM_registerMenuCommand = () => 0;
  (globalThis as Record<string, unknown>).GM_addStyle = (css: string) => {
    const el = document.createElement('style');
    el.textContent = css;
    document.head.appendChild(el);
    return el;
  };
  return store;
}

async function boot(html: string): Promise<void> {
  installGmStubs();
  (globalThis as Record<string, unknown>).fetch = () => Promise.reject(new Error('offline'));
  document.documentElement.innerHTML = html;
  vi.resetModules();
  await import('../src/main');
  await new Promise((r) => setTimeout(r, 80));
}

const SITE = {
  categories: [
    { id: 4, name: '开发调优', slug: 'dev', parent_category_id: null },
    { id: 36, name: '搞七捻三', slug: 'other', parent_category_id: null },
  ],
};

function preloadScript(topics: unknown[]): string {
  const tl = { topics };
  return (
    '<head></head><body><script id="data-preloaded" type="application/json">' +
    JSON.stringify({ site: JSON.stringify(SITE), topic_list: JSON.stringify(tl) }) +
    '</script></body>'
  );
}

function readPreloadTopics(): Array<Record<string, unknown>> {
  const s = document.querySelector('script#data-preloaded') as HTMLScriptElement;
  const outer = JSON.parse(s.textContent || '{}') as Record<string, unknown>;
  const tl = typeof outer.topic_list === 'string' ? JSON.parse(outer.topic_list) : outer.topic_list;
  return (tl as { topics: Array<Record<string, unknown>> }).topics;
}

describe('启动冒烟', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('无顶栏时挂载浮动按钮', async () => {
    await boot('<head></head><body></body>');
    const mount = document.querySelector('.ldf-topbar-mount');
    expect(mount).toBeTruthy();
    expect(document.querySelector('.ldf-count-btn')).toBeTruthy();
  });

  it('预载数据在首屏即被过滤与保护', async () => {
    const topics = [
      { id: 101, title: '我的gemini是不是生病了', category_id: 36, tags: [{ name: '纯水' }], posts_count: 5, views: 10 },
      { id: 102, title: '开源项目 FooBar 发布 v2.0：支持多账号批量管理', category_id: 4, tags: [{ name: '开源' }], posts_count: 8, views: 99 },
      { id: 103, title: '闲聊：今天天气不错', category_id: 36, tags: [], posts_count: 2, views: 3 },
    ];
    await boot(preloadScript(topics));
    const after = readPreloadTopics();
    const ids = after.map((t) => t.id);
    expect(ids).not.toContain(101);
    expect(ids).toContain(102);
    expect(ids).toContain(103);
    expect(after[0].id).toBe(102);
  });

  it('DOM 兜底：渲染后新增的水帖也会被隐藏', async () => {
    await boot('<head></head><body></body>');
    const body = document.createElement('table');
    body.innerHTML = '';
    const tbody = document.createElement('tbody');
    tbody.className = 'topic-list-body';
    tbody.innerHTML =
      '<tr data-topic-id="201" data-category-id="36"><td><a class="title raw-topic-link">我的gemini是不是生病了</a><span class="discourse-tags"><a class="discourse-tag" data-tag-name="纯水">纯水</a></span></td></tr>' +
      '<tr data-topic-id="202" data-category-id="36"><td><a class="title raw-topic-link">正常讨论：上下文管理机制的差异</a></td></tr>';
    body.appendChild(tbody);
    document.body.appendChild(body);
    await new Promise((r) => setTimeout(r, 120));
    const row201 = document.querySelector('tr[data-topic-id="201"]') as HTMLElement;
    const row202 = document.querySelector('tr[data-topic-id="202"]') as HTMLElement;
    expect(row201.style.display).toBe('none');
    expect(row202.style.display).not.toBe('none');
  });
});
