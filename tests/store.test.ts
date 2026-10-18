import { describe, expect, it, vi } from 'vitest';

const KEY = 'ldf_config_v1';

function installGmStubs(initial: unknown): void {
  const store: Record<string, unknown> = initial === undefined ? {} : { [KEY]: initial };
  (globalThis as Record<string, unknown>).GM_getValue = (k: string, d: unknown) => (k in store ? store[k] : d);
  (globalThis as Record<string, unknown>).GM_setValue = (k: string, v: unknown) => {
    store[k] = v;
  };
}

async function loadStore(raw: unknown): Promise<typeof import('../src/store')> {
  installGmStubs(raw);
  vi.resetModules();
  return await import('../src/store');
}

describe('配置归一化 · 词库', () => {
  it('显式清空的词库在重新加载后保持为空', async () => {
    const store = await loadStore({
      version: 1,
      masterEnabled: true,
      debug: false,
      rules: [],
      lexicons: { ask: [], buzz: ['自定义词'], shield: [] },
      exemptions: { topicIds: [], titleKeywords: [] },
    });
    const cfg = store.loadConfig();
    expect(cfg.lexicons.ask).toEqual([]);
    expect(cfg.lexicons.buzz).toEqual(['自定义词']);
    expect(cfg.lexicons.shield).toEqual([]);
  });

  it('缺失或非数组的词库回退默认值', async () => {
    const store = await loadStore({
      version: 1,
      rules: [],
      lexicons: { ask: '坏数据' },
      exemptions: {},
    });
    const { defaultLexicons } = await import('../src/lexicons');
    const cfg = store.loadConfig();
    expect(cfg.lexicons.ask).toEqual(defaultLexicons().ask);
    expect(cfg.lexicons.buzz.length).toBeGreaterThan(0);
    expect(cfg.lexicons.shield.length).toBeGreaterThan(0);
  });

  it('词库中的非字符串项被过滤', async () => {
    const store = await loadStore({
      version: 1,
      rules: [],
      lexicons: { ask: ['正常', 123, null, '  ', '另一个'], buzz: [], shield: [] },
      exemptions: {},
    });
    const cfg = store.loadConfig();
    expect(cfg.lexicons.ask).toEqual(['正常', '另一个']);
  });
});
