import { beforeEach, describe, expect, it, vi } from 'vitest';

function installGmStubs(): void {
  const store: Record<string, unknown> = {};
  (globalThis as Record<string, unknown>).GM_getValue = (k: string, d: unknown) => (k in store ? store[k] : d);
  (globalThis as Record<string, unknown>).GM_setValue = (k: string, v: unknown) => {
    store[k] = v;
  };
  (globalThis as Record<string, unknown>).GM_registerMenuCommand = () => 0;
  (globalThis as Record<string, unknown>).GM_addStyle = () => document.createElement('style');
}

async function boot(path: string): Promise<void> {
  window.history.replaceState({}, '', path);
  installGmStubs();
  (globalThis as Record<string, unknown>).fetch = () => Promise.reject(new Error('offline'));
  document.documentElement.innerHTML = '<head></head><body></body>';
  vi.resetModules();
  await import('../src/main');
  await new Promise((r) => setTimeout(r, 80));
}

function appendRow(): HTMLElement {
  const table = document.createElement('table');
  const tbody = document.createElement('tbody');
  tbody.className = 'topic-list-body';
  tbody.innerHTML =
    '<tr data-topic-id="301" data-category-id="36"><td><a class="title raw-topic-link">我的gemini是不是生病了</a>' +
    '<span class="discourse-tags"><a class="discourse-tag" data-tag-name="纯水">纯水</a></span></td></tr>';
  table.appendChild(tbody);
  document.body.appendChild(table);
  return tbody.querySelector('tr[data-topic-id="301"]') as HTMLElement;
}

describe('DOM 兜底仅在列表页生效', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('帖子页（kind=other）的表格行不被隐藏', async () => {
    await boot('/t/topic/12345');
    const row = appendRow();
    await new Promise((r) => setTimeout(r, 200));
    expect(row.style.display).not.toBe('none');
    expect(row.dataset.ldfHidden).toBeUndefined();
  });

  it('首页（kind=home）的表格行仍会被过滤', async () => {
    await boot('/latest');
    const row = appendRow();
    await new Promise((r) => setTimeout(r, 200));
    expect(row.style.display).toBe('none');
  });
});
