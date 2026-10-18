import { describe, expect, it, vi } from 'vitest';

function installGmStubs(): void {
  const store: Record<string, unknown> = {};
  (globalThis as Record<string, unknown>).GM_getValue = (k: string, d: unknown) => (k in store ? store[k] : d);
  (globalThis as Record<string, unknown>).GM_setValue = (k: string, v: unknown) => {
    store[k] = v;
  };
  (globalThis as Record<string, unknown>).GM_registerMenuCommand = () => 0;
  (globalThis as Record<string, unknown>).GM_addStyle = () => document.createElement('style');
}

describe('fetch 劫持', () => {
  it('过滤 topic_list，且重建响应不再携带实体相关响应头', async () => {
    installGmStubs();
    const body = JSON.stringify({
      topic_list: {
        topics: [
          { id: 401, title: '我的gemini是不是生病了', category_id: 36, tags: [{ name: '纯水' }] },
          { id: 402, title: '正常的技术讨论', category_id: 36, tags: [] },
        ],
      },
    });
    (globalThis as Record<string, unknown>).fetch = () =>
      Promise.resolve(
        new Response(body, {
          status: 200,
          headers: {
            'content-type': 'application/json',
            'content-length': String(body.length),
            'content-encoding': 'gzip',
          },
        }),
      );
    document.documentElement.innerHTML = '<head></head><body></body>';
    vi.resetModules();
    await import('../src/main');
    await new Promise((r) => setTimeout(r, 80));

    const resp = await window.fetch('/latest.json');
    const text = await resp.text();
    const ids = (JSON.parse(text) as { topic_list: { topics: Array<{ id: number }> } }).topic_list.topics.map(
      (t) => t.id,
    );
    expect(ids).toEqual([402]);
    expect(resp.headers.get('content-length')).toBeNull();
    expect(resp.headers.get('content-encoding')).toBeNull();
    expect(resp.headers.get('content-type')).toBe('application/json');
  });
});
