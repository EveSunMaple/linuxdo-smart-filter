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

describe('配置归一化 · 规则', () => {
  it('非数组 when 字段被收敛，规则不再导致 decide 崩溃', async () => {
    const store = await loadStore({
      version: 1,
      rules: [{ id: 'bad', name: '坏规则', mode: 'filter', enabled: true, when: { tagsAny: 'abc', minAsk: 1 } }],
      lexicons: {},
      exemptions: {},
    });
    const cfg = store.loadConfig();
    const rule = cfg.rules.find((r) => r.id === 'bad');
    expect(rule?.when?.tagsAny).toBeUndefined();
    expect(rule?.when?.minAsk).toBe(1);

    const { compileRules, decide } = await import('../src/engine');
    const state = compileRules(cfg.rules, null);
    const d = decide(
      { id: 1, title: '普通标题', category_id: 1, tags: [] },
      state,
      { kind: 'home', key: 'home:latest' },
      { lex: cfg.lexicons, exemptions: cfg.exemptions },
    );
    expect(d.kind).toBe('keep');
  });

  it('非数组 titleRegexAny 不再使规则编译崩溃', async () => {
    const store = await loadStore({
      version: 1,
      rules: [{ id: 'bad2', name: '坏正则', mode: 'filter', enabled: true, when: { minAsk: 1, titleRegexAny: 5 } }],
      lexicons: {},
      exemptions: {},
    });
    const cfg = store.loadConfig();
    expect(cfg.rules.find((r) => r.id === 'bad2')?.when?.titleRegexAny).toBeUndefined();
    const { compileRules } = await import('../src/engine');
    expect(() => compileRules(cfg.rules, null)).not.toThrow();
  });

  it('非法颜色被丢弃，合法颜色保留', async () => {
    const store = await loadStore({
      version: 1,
      rules: [
        {
          id: 'c1',
          name: 'a',
          mode: 'highlight',
          enabled: true,
          color: 'red;background:url(https://example.com/x)',
          when: { minShield: 1 },
        },
        { id: 'c2', name: 'b', mode: 'highlight', enabled: true, color: '#1ca551', when: { minShield: 1 } },
      ],
      lexicons: {},
      exemptions: {},
    });
    const cfg = store.loadConfig();
    expect(cfg.rules.find((r) => r.id === 'c1')?.color).toBeUndefined();
    expect(cfg.rules.find((r) => r.id === 'c2')?.color).toBe('#1ca551');
  });

  it('scope.categoryIds 非数组时收敛为空数组', async () => {
    const store = await loadStore({
      version: 1,
      rules: [
        {
          id: 's1',
          name: 'a',
          mode: 'filter',
          enabled: true,
          scope: { type: 'category', categoryIds: '4,5', includeHome: true },
          when: { minAsk: 1 },
        },
      ],
      lexicons: {},
      exemptions: {},
    });
    const cfg = store.loadConfig();
    expect(cfg.rules.find((r) => r.id === 's1')?.scope).toEqual({
      type: 'category',
      categoryIds: [],
      includeHome: true,
    });
  });
});
