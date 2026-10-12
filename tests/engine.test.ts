import { describe, expect, it } from 'vitest';
import { compileRules, decide } from '../src/engine';
import { defaultLexicons } from '../src/lexicons';
import { buildCategoryMap, pageContext } from '../src/page';
import { defaultPresets } from '../src/presets';
import type { PageInfo, Rule, Topic } from '../src/types';
import { CATEGORY_CHILDREN, CATEGORY_IDS, SAMPLES } from './samples';

function buildMap() {
  const categories: Array<Record<string, unknown>> = Object.entries(CATEGORY_IDS).map(([name, id]) => ({
    id,
    name,
    slug: `c${id}`,
    parent_category_id: null,
  }));
  for (const [parent, children] of Object.entries(CATEGORY_CHILDREN)) {
    for (const cid of children) {
      categories.push({ id: cid, name: `${parent}, Lv1`, slug: `lv${cid}`, parent_category_id: CATEGORY_IDS[parent] });
    }
  }
  return buildCategoryMap(categories)!;
}

const map = buildMap();
const homePage: PageInfo = { kind: 'home', route: 'latest', key: 'home:latest' };
const baseCtx = { lex: defaultLexicons(), exemptions: { topicIds: [] as number[], titleKeywords: [] as string[] } };

function mkTopic(title: string, category: string, tags: string[]): Topic {
  return { id: 1, title, category_id: CATEGORY_IDS[category], tags: tags.map((name) => ({ name })) };
}

describe('标题分诊回归（截图语料）', () => {
  const state = compileRules(defaultPresets(), map);
  for (const s of SAMPLES) {
    it(`${s.expect} | ${s.title.slice(0, 30)}`, () => {
      const d = decide(mkTopic(s.title, s.category, s.tags), state, homePage, baseCtx);
      expect(d.kind).toBe(s.expect);
    });
  }
});

describe('保护优先', () => {
  const state = compileRules(defaultPresets(), map);
  it('开源帖即使带人工智能标签也不被过滤', () => {
    const d = decide(
      mkTopic('开源项目 FooBar 发布 v2.0：支持多账号批量管理', '开发调优', ['人工智能']),
      state,
      homePage,
      baseCtx,
    );
    expect(d.kind).toBe('highlight');
  });
  it('硬标签规则不受保护词影响', () => {
    const d = decide(mkTopic('分享一个纯水帖，但标题有分享和教程', '搞七捻三', ['纯水']), state, homePage, baseCtx);
    expect(d.kind).toBe('filter');
  });
});

describe('短问句预设（默认关闭）', () => {
  it('关闭时保留', () => {
    const state = compileRules(defaultPresets(), map);
    const d = decide(mkTopic('青龙面板怎么装', '开发调优', []), state, homePage, baseCtx);
    expect(d.kind).toBe('keep');
  });
  it('开启后过滤', () => {
    const rules = defaultPresets().map((r) => (r.id === 'preset-short-ask' ? { ...r, enabled: true } : r));
    const state = compileRules(rules, map);
    const d = decide(mkTopic('青龙面板怎么装', '开发调优', []), state, homePage, baseCtx);
    expect(d.kind).toBe('filter');
  });
});

describe('豁免', () => {
  const state = compileRules(defaultPresets(), map);
  it('豁免主题 ID 后跳过过滤', () => {
    const ctx = { ...baseCtx, exemptions: { topicIds: [1], titleKeywords: [] } };
    const d = decide(mkTopic('寻求主机配置高手!', '开发调优', []), state, homePage, ctx);
    expect(d.kind).toBe('keep');
  });
  it('标题关键词豁免后跳过过滤', () => {
    const ctx = { ...baseCtx, exemptions: { topicIds: [], titleKeywords: ['主机配置'] } };
    const d = decide(mkTopic('寻求主机配置高手!', '开发调优', []), state, homePage, ctx);
    expect(d.kind).toBe('keep');
  });
});

describe('规则编译', () => {
  it('无效正则产生错误且不参与匹配', () => {
    const bad: Rule = {
      id: 'x',
      name: '坏规则',
      mode: 'filter',
      enabled: true,
      when: { titleRegexAny: ['('] },
    };
    const state = compileRules([bad], map);
    expect(state.errors.get('x')).toContain('正则无效');
    const d = decide(mkTopic('随便什么标题', '开发调优', []), state, homePage, baseCtx);
    expect(d.kind).toBe('keep');
  });
  it('未知板块名称产生错误', () => {
    const bad: Rule = {
      id: 'y',
      name: '板块不存在',
      mode: 'filter',
      enabled: true,
      when: { categoryNames: ['不存在的板块'], minAsk: 1 },
    };
    const state = compileRules([bad], map);
    expect(state.errors.get('y')).toContain('找不到板块');
  });
  it('板块条件自动包含子板块', () => {
    const rule: Rule = {
      id: 'z',
      name: '开发调优全量',
      mode: 'filter',
      enabled: true,
      when: { categoryNames: ['开发调优'], minAsk: 2 },
    };
    const state = compileRules([rule], map);
    const sub: Topic = { id: 2, title: '求助 请问这个怎么弄', category_id: CATEGORY_CHILDREN.开发调优[0], tags: [] };
    const d = decide(sub, state, homePage, baseCtx);
    expect(d.kind).toBe('filter');
  });
});

describe('页面上下文', () => {
  it('首页路由', () => {
    expect(pageContext('https://linux.do/latest').kind).toBe('home');
    expect(pageContext('https://linux.do/').key).toBe('home:latest');
  });
  it('板块页', () => {
    const pg = pageContext('https://linux.do/c/dev/4/l/latest');
    expect(pg.kind).toBe('category');
    expect(pg.categoryId).toBe(4);
  });
  it('帖子页不拦截', () => {
    expect(pageContext('https://linux.do/t/topic/12345').kind).toBe('other');
  });
});
