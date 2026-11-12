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

class FakeXHR extends EventTarget {
  static queue: string[] = [];
  readyState = 0;
  responseType = '';
  status = 200;
  private _text = '';
  open(_method: string, _url: string): void {
    this.readyState = 0;
  }
  send(): void {
    this._text = FakeXHR.queue.shift() || '';
    this.readyState = 4;
    this.dispatchEvent(new Event('readystatechange'));
  }
  get responseText(): string {
    return this._text;
  }
}

function ids(text: string): number[] {
  const obj = JSON.parse(text) as { topic_list: { topics: Array<{ id: number }> } };
  return obj.topic_list.topics.map((t) => t.id);
}

describe('XHR 劫持', () => {
  it('过滤 topic_list 响应，且同一实例复用时返回最新响应', async () => {
    installGmStubs();
    (globalThis as Record<string, unknown>).fetch = () => Promise.reject(new Error('offline'));
    document.documentElement.innerHTML = '<head></head><body></body>';
    (globalThis as Record<string, unknown>).XMLHttpRequest = FakeXHR;
    FakeXHR.queue.length = 0;
    vi.resetModules();
    await import('../src/main');
    await new Promise((r) => setTimeout(r, 80));

    const water = JSON.stringify({
      topic_list: { topics: [{ id: 401, title: '我的gemini是不是生病了', category_id: 36, tags: [{ name: '纯水' }] }] },
    });
    const normal = JSON.stringify({
      topic_list: { topics: [{ id: 402, title: '正常的技术讨论', category_id: 36, tags: [] }] },
    });
    FakeXHR.queue.push(water, normal);

    const xhr = new FakeXHR();
    xhr.open('GET', '/latest.json');
    xhr.send();
    expect(ids(xhr.responseText)).toEqual([]);

    xhr.open('GET', '/latest.json');
    xhr.send();
    expect(ids(xhr.responseText)).toEqual([402]);
  });

  it('非 topic_list 响应原样返回', async () => {
    installGmStubs();
    (globalThis as Record<string, unknown>).fetch = () => Promise.reject(new Error('offline'));
    document.documentElement.innerHTML = '<head></head><body></body>';
    (globalThis as Record<string, unknown>).XMLHttpRequest = FakeXHR;
    FakeXHR.queue.length = 0;
    vi.resetModules();
    await import('../src/main');
    await new Promise((r) => setTimeout(r, 80));

    const body = JSON.stringify({ ok: true, value: 42 });
    FakeXHR.queue.push(body);
    const xhr = new FakeXHR();
    xhr.open('GET', '/latest.json');
    xhr.send();
    expect(xhr.responseText).toBe(body);
  });
});
