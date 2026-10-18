import { app } from '../context';
import { type CategoryRecord, categoryNameOf } from '../page';
import { newRuleId, RULE_COLORS } from '../presets';
import { exportJSON, getConfig, importJSON, resetLexicons, resetPresets } from '../store';
import type { Rule, RuleWhen } from '../types';
import { escAttr, escHtml, splitList, toast } from './common';

type Tab = 'rules' | 'lexicons' | 'data';

let modal: HTMLDivElement | null = null;
let tab: Tab = 'rules';
let editing: Rule | null = null;
let isNewRule = false;

function parents(): CategoryRecord[] {
  const map = app().getCatMap();
  if (!map) return [];
  const out: CategoryRecord[] = [];
  map.byId.forEach((c) => {
    if (c.parentId === null) out.push(c);
  });
  out.sort((a, b) => a.name.localeCompare(b.name, 'zh'));
  return out;
}

function summarize(rule: Rule): string {
  const w = rule.when || {};
  const parts: string[] = [];
  if (w.categoryNames?.length) parts.push(`板块：${w.categoryNames.join('/')}`);
  if (w.tagsAny?.length) parts.push(`标签含：${w.tagsAny.join('/')}`);
  if (w.tagsNone?.length) parts.push(`标签不含：${w.tagsNone.join('/')}`);
  if (w.minAsk != null) parts.push(`提问词≥${w.minAsk}`);
  if (w.minBuzz != null) parts.push(`主题词≥${w.minBuzz}`);
  if (w.minShield != null) parts.push(`优质词≥${w.minShield}`);
  if (w.titleMinLen != null || w.titleMaxLen != null)
    parts.push(`标题长度 ${w.titleMinLen ?? 0}~${w.titleMaxLen ?? '∞'}`);
  if (w.titleRegexAny?.length) parts.push(`正则×${w.titleRegexAny.length}`);
  const scope = rule.scope;
  if (scope && scope.type !== 'global') {
    const scopeText =
      scope.type === 'home'
        ? '仅首页流'
        : '仅板块页' +
          ((scope.categoryIds || []).length
            ? `（${(scope.categoryIds || []).map((id) => categoryNameOf(app().getCatMap(), id)).join('/')}）`
            : '') +
          (scope.includeHome ? '+首页' : '');
    parts.push(`作用域：${scopeText}`);
  }
  return parts.join(' · ') || '无条件';
}

function buildModal(): HTMLDivElement {
  if (modal) return modal;
  const el = document.createElement('div');
  el.id = 'ldf-modal';
  document.body.appendChild(el);
  el.addEventListener('click', (e) => {
    if (e.target === el) closeSettings();
  });
  modal = el;
  return el;
}

export function openSettings(): void {
  buildModal();
  tab = 'rules';
  editing = null;
  renderBox();
  modal?.classList.add('ldf-open');
}

export function closeSettings(): void {
  if (modal) modal.classList.remove('ldf-open');
}

function refreshAll(): void {
  app().save();
  renderBox();
  window.dispatchEvent(new Event('ldf:refresh'));
}

function renderBox(): void {
  if (!modal) return;
  const inEditor = editing !== null;
  modal.innerHTML =
    '<div class="ldf-modal-box">' +
    renderHeader() +
    (inEditor ? '' : renderTabs()) +
    '<div class="ldf-modal-body">' +
    (inEditor
      ? renderEditor()
      : tab === 'rules'
        ? renderRulesTab()
        : tab === 'lexicons'
          ? renderLexiconsTab()
          : renderDataTab()) +
    '</div>' +
    renderFooter(inEditor) +
    '</div>';
  bindBox(inEditor);
}

function renderHeader(): string {
  return (
    '<div class="ldf-modal-header"><div><div class="ldf-modal-title">' +
    (editing ? (isNewRule ? '新建规则' : '编辑规则') : 'LinuxDo 智能降噪过滤器') +
    '</div><div class="ldf-modal-sub">' +
    (editing ? '配置匹配条件与作用范围' : '按板块 / 标签 / 标题内容分诊，命中保护信号的帖子不会被过滤') +
    '</div></div><button type="button" class="ldf-modal-close" data-act="close">✕</button></div>'
  );
}

function renderTabs(): string {
  const t = (key: Tab, label: string): string =>
    '<button type="button" class="ldf-tab' +
    (tab === key ? ' ldf-on' : '') +
    '" data-tab="' +
    key +
    '">' +
    label +
    '</button>';
  return `<div class="ldf-tabs">${t('rules', '规则')}${t('lexicons', '词库')}${t('data', '数据')}</div>`;
}

function renderRulesTab(): string {
  const cfg = getConfig();
  const errors = app().ruleErrors();
  const rows = cfg.rules
    .map((r, i) => {
      const err = errors.get(r.id);
      const modeChip =
        r.mode === 'highlight'
          ? '<span class="ldf-chip ldf-highlight">保护</span><span class="ldf-dot" style="background:' +
            escAttr(r.color || '#1ca551') +
            '"></span>'
          : '<span class="ldf-chip ldf-filter">过滤</span>';
      return (
        '<div class="ldf-rule-row" data-id="' +
        escAttr(r.id) +
        '">' +
        '<label class="ldf-switch"><input type="checkbox" data-act="toggle"' +
        (r.enabled ? ' checked' : '') +
        '><span class="ldf-slider"></span></label>' +
        '<div class="ldf-rule-main">' +
        '<div class="ldf-rule-name">' +
        '<span class="ldf-chip">#' +
        (i + 1) +
        '</span>' +
        modeChip +
        escHtml(r.name) +
        (r.preset ? '<span class="ldf-chip">预设</span>' : '') +
        (err ? `<span class="ldf-chip ldf-err" title="${escAttr(err)}">⚠ ${escHtml(err)}</span>` : '') +
        '</div>' +
        '<div class="ldf-rule-sub">' +
        escHtml(summarize(r)) +
        '</div>' +
        '</div>' +
        '<button type="button" class="ldf-mini" data-act="up"' +
        (i === 0 ? ' disabled' : '') +
        '>↑</button>' +
        '<button type="button" class="ldf-mini" data-act="down"' +
        (i === cfg.rules.length - 1 ? ' disabled' : '') +
        '>↓</button>' +
        '<button type="button" class="ldf-btn" data-act="edit">编辑</button>' +
        (r.preset ? '' : '<button type="button" class="ldf-btn ldf-danger" data-act="del">删除</button>') +
        '</div>'
      );
    })
    .join('');
  return (
    '<div class="ldf-toolbar"><button type="button" class="ldf-btn ldf-primary" data-act="add">+ 新建规则</button><span class="ldf-spacer"></span><button type="button" class="ldf-btn" data-act="reset-presets">恢复默认预设</button></div>' +
    (rows || '<div class="ldf-drawer-empty">暂无规则</div>') +
    '<div class="ldf-hint">规则按顺序判定：保护（高亮）规则优先于过滤规则；顺序影响保护色的优先级。修改后点击右下角「刷新页面」完全生效。</div>'
  );
}

function renderLexiconsTab(): string {
  const lex = getConfig().lexicons;
  return (
    '<div class="ldf-field"><label>提问词库（每行一个，也支持逗号分隔）</label><textarea class="ldf-textarea" id="ldf-lex-ask">' +
    escHtml(lex.ask.join('\n')) +
    '</textarea><div class="ldf-hint">标题命中这些词视为「求助/咨询」信号，如：求助、请问、有没有、推荐……留空则仅保留问句结尾判定。</div></div>' +
    '<div class="ldf-field"><label>主题词库（账号 / 消费 / 风控类）</label><textarea class="ldf-textarea" id="ldf-lex-buzz">' +
    escHtml(lex.buzz.join('\n')) +
    '</textarea><div class="ldf-hint">如：账号、额度、KYC、拼车、降智…… 与提问词组合时降噪效果最好。留空则关闭主题词信号。</div></div>' +
    '<div class="ldf-field"><label>保护词库（优质内容信号）</label><textarea class="ldf-textarea" id="ldf-lex-shield">' +
    escHtml(lex.shield.join('\n')) +
    '</textarea><div class="ldf-hint">标题命中这些词的帖子会被视为优质内容，任何可保护的过滤规则都不会误杀它，如：开源、教程、实测、避坑……留空则关闭保护词豁免。</div></div>' +
    '<div class="ldf-inline"><button type="button" class="ldf-btn ldf-primary" data-act="save-lex">保存词库</button><button type="button" class="ldf-btn" data-act="reset-lex">恢复默认词库</button></div>'
  );
}

function renderDataTab(): string {
  const cfg = getConfig();
  return (
    '<div class="ldf-field"><label>导出配置</label><textarea class="ldf-textarea" id="ldf-export" readonly>' +
    escHtml(exportJSON()) +
    '</textarea><div class="ldf-inline"><button type="button" class="ldf-btn" data-act="copy-export">复制导出内容</button><span class="ldf-hint">可粘贴保存，或在其他浏览器 / 设备导入。</span></div></div>' +
    '<div class="ldf-field"><label>导入配置</label><textarea class="ldf-textarea" id="ldf-import" placeholder="粘贴导出的 JSON 后点击导入"></textarea><div class="ldf-inline"><button type="button" class="ldf-btn" data-act="import">导入并覆盖</button></div></div>' +
    '<div class="ldf-field"><label>豁免名单</label><div class="ldf-hint">被豁免的主题 ID（每行一个）：</div><textarea class="ldf-textarea" id="ldf-ex-ids" style="min-height:60px">' +
    escHtml((cfg.exemptions.topicIds || []).join('\n')) +
    '</textarea><div class="ldf-hint" style="margin-top:8px">标题关键词豁免（包含这些词的标题不会被过滤）：</div><textarea class="ldf-textarea" id="ldf-ex-words" style="min-height:60px">' +
    escHtml((cfg.exemptions.titleKeywords || []).join('\n')) +
    '</textarea><div class="ldf-inline" style="margin-top:8px"><button type="button" class="ldf-btn ldf-primary" data-act="save-ex">保存豁免名单</button><button type="button" class="ldf-btn" data-act="clear-ex">清空豁免</button></div></div>'
  );
}

function renderEditor(): string {
  const r = editing!;
  const w: RuleWhen = r.when || {};
  const map = app().getCatMap();
  const parentList = parents();
  const catPicker = (cls: string, selected: string[]): string => {
    if (!map) return '<div class="ldf-hint">板块映射未就绪（刷新页面后自动加载）</div>';
    return (
      '<div class="ldf-cat-list">' +
      parentList
        .map(
          (c) =>
            '<label class="ldf-cat-item"><input type="checkbox" class="' +
            cls +
            '" value="' +
            escAttr(c.name) +
            '"' +
            (selected.includes(c.name) ? ' checked' : '') +
            '>' +
            escHtml(c.name) +
            '</label>',
        )
        .join('') +
      '</div>'
    );
  };
  const scope = r.scope || { type: 'global' as const };
  const scopeCatPicker =
    map && parentList.length
      ? '<div class="ldf-cat-list" id="ldf-e-scopecats" style="display:' +
        (scope.type === 'category' ? 'flex' : 'none') +
        '">' +
        parentList
          .map(
            (c) =>
              '<label class="ldf-cat-item"><input type="checkbox" class="ldf-e-scopecat" value="' +
              c.id +
              '"' +
              ((scope.categoryIds || []).includes(c.id) ? ' checked' : '') +
              '>' +
              escHtml(c.name) +
              '</label>',
          )
          .join('') +
        '</div><label class="ldf-cat-item" id="ldf-e-includehome-wrap" style="display:' +
        (scope.type === 'category' ? 'inline-flex' : 'none') +
        ';margin-top:6px"><input type="checkbox" id="ldf-e-includehome"' +
        (scope.includeHome ? ' checked' : '') +
        '> 同时作用于首页流</label>'
      : '';
  return (
    '<div class="ldf-field"><label>规则名称</label><input class="ldf-input" id="ldf-e-name" value="' +
    escAttr(r.name) +
    '" placeholder="例如：开发调优·求助降噪"></div>' +
    '<div class="ldf-field"><label>规则类型</label><div class="ldf-inline">' +
    '<div class="ldf-seg"><label><input type="radio" name="ldf-e-mode" value="filter"' +
    (r.mode === 'filter' ? ' checked' : '') +
    '><span>过滤</span></label><label><input type="radio" name="ldf-e-mode" value="highlight"' +
    (r.mode === 'highlight' ? ' checked' : '') +
    '><span>保护高亮</span></label></div>' +
    '<label id="ldf-e-color-wrap" style="display:' +
    (r.mode === 'highlight' ? 'inline-flex' : 'none') +
    ';align-items:center;gap:6px;font-size:13px">颜色 <input type="color" id="ldf-e-color" value="' +
    escAttr(r.color || RULE_COLORS[0]) +
    '"></label>' +
    '</div><div class="ldf-hint">过滤 = 从列表移除；保护高亮 = 永不误杀并标记颜色。</div></div>' +
    '<div class="ldf-field"><label>作用域（规则在哪些页面生效）</label><div class="ldf-inline">' +
    '<div class="ldf-seg"><label><input type="radio" name="ldf-e-scope" value="global"' +
    (scope.type === 'global' ? ' checked' : '') +
    '><span>全局</span></label><label><input type="radio" name="ldf-e-scope" value="home"' +
    (scope.type === 'home' ? ' checked' : '') +
    '><span>仅首页流</span></label><label><input type="radio" name="ldf-e-scope" value="category"' +
    (scope.type === 'category' ? ' checked' : '') +
    '><span>指定板块页</span></label></div>' +
    '</div>' +
    scopeCatPicker +
    '</div>' +
    '<div class="ldf-field"><label>条件 · 所属板块（勾选后自动包含子板块）</label>' +
    catPicker('ldf-e-cat', w.categoryNames || []) +
    '</div>' +
    '<div class="ldf-field"><label>条件 · 标签</label><div class="ldf-inline"><input class="ldf-input" id="ldf-e-tagsany" style="flex:1;min-width:200px" placeholder="包含任一标签（逗号分隔），如：人工智能, 快问快答" value="' +
    escAttr((w.tagsAny || []).join(', ')) +
    '"><input class="ldf-input" id="ldf-e-tagsnone" style="flex:1;min-width:200px" placeholder="不包含标签（逗号分隔）" value="' +
    escAttr((w.tagsNone || []).join(', ')) +
    '"></div></div>' +
    '<div class="ldf-field"><label>条件 · 标题信号（留空 = 不限制）</label><div class="ldf-inline">' +
    '提问词 ≥ <input class="ldf-input ldf-num" id="ldf-e-minask" type="number" min="0" value="' +
    escAttr(w.minAsk ?? '') +
    '">' +
    '主题词 ≥ <input class="ldf-input ldf-num" id="ldf-e-minbuzz" type="number" min="0" value="' +
    escAttr(w.minBuzz ?? '') +
    '">' +
    '优质词 ≥ <input class="ldf-input ldf-num" id="ldf-e-minshield" type="number" min="0" value="' +
    escAttr(w.minShield ?? '') +
    '">' +
    '标题长度 <input class="ldf-input ldf-num" id="ldf-e-minlen" type="number" min="0" placeholder="最小" value="' +
    escAttr(w.titleMinLen ?? '') +
    '"> ~ <input class="ldf-input ldf-num" id="ldf-e-maxlen" type="number" min="0" placeholder="最大" value="' +
    escAttr(w.titleMaxLen ?? '') +
    '">' +
    '</div><div class="ldf-hint">信号计数来自「词库」标签页中对应词库的命中数（去重后的词数）。</div></div>' +
    '<div class="ldf-field"><label>条件 · 标题正则（每行一条，满足任意一条即可）</label><textarea class="ldf-textarea" id="ldf-e-regex" placeholder="例如：^求推荐">' +
    escHtml((w.titleRegexAny || []).join('\n')) +
    '</textarea></div>' +
    '<div class="ldf-inline"><button type="button" class="ldf-btn ldf-primary" data-act="save-rule">保存规则</button><button type="button" class="ldf-btn" data-act="cancel-rule">取消</button>' +
    (isNewRule ? '' : '<button type="button" class="ldf-btn ldf-danger" data-act="del-in-editor">删除规则</button>') +
    '</div>'
  );
}

function renderFooter(inEditor: boolean): string {
  const cfg = getConfig();
  return (
    '<div class="ldf-modal-footer"><div class="ldf-footer-left">' +
    '<label class="ldf-cat-item"><input type="checkbox" id="ldf-f-master"' +
    (cfg.masterEnabled ? ' checked' : '') +
    '> 启用降噪</label>' +
    '<label class="ldf-cat-item"><input type="checkbox" id="ldf-f-debug"' +
    (cfg.debug ? ' checked' : '') +
    '> 调试日志</label>' +
    '</div>' +
    (inEditor
      ? ''
      : '<div class="ldf-inline"><button type="button" class="ldf-btn" data-act="reload">刷新页面</button><button type="button" class="ldf-btn ldf-primary" data-act="close">完成</button></div>') +
    '</div>'
  );
}

function findRule(id: string): Rule | undefined {
  return getConfig().rules.find((r) => r.id === id);
}

function bindBox(inEditor: boolean): void {
  const box = modal!;
  box.querySelector('[data-act="close"]')?.addEventListener('click', closeSettings);
  box.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) => {
    b.addEventListener('click', () => {
      tab = b.dataset.tab as Tab;
      renderBox();
    });
  });
  box.querySelector('#ldf-f-master')?.addEventListener('change', (e) => {
    getConfig().masterEnabled = (e.target as HTMLInputElement).checked;
    app().save();
    toast(`降噪总开关已${(e.target as HTMLInputElement).checked ? '启用' : '关闭'}，刷新页面后生效`);
  });
  box.querySelector('#ldf-f-debug')?.addEventListener('change', (e) => {
    getConfig().debug = (e.target as HTMLInputElement).checked;
    app().save();
  });
  box.querySelector('[data-act="reload"]')?.addEventListener('click', () => location.reload());
  if (inEditor) {
    bindEditor();
    return;
  }
  if (tab === 'rules') bindRulesTab();
  else if (tab === 'lexicons') bindLexiconsTab();
  else bindDataTab();
}

function bindRulesTab(): void {
  const box = modal!;
  box.querySelector('[data-act="add"]')?.addEventListener('click', () => {
    const hlCount = getConfig().rules.filter((r) => r.mode === 'highlight').length;
    editing = {
      id: newRuleId(),
      name: '',
      mode: 'filter',
      enabled: true,
      shieldable: true,
      scope: { type: 'global' },
      when: {},
      color: RULE_COLORS[hlCount % RULE_COLORS.length],
    };
    isNewRule = true;
    renderBox();
  });
  box.querySelector('[data-act="reset-presets"]')?.addEventListener('click', () => {
    if (!confirm('将恢复全部预设为默认状态（自定义规则保留），确定？')) return;
    resetPresets();
    app().recompile();
    renderBox();
    toast('预设已恢复');
  });
  box.querySelectorAll<HTMLDivElement>('.ldf-rule-row').forEach((row) => {
    const id = row.dataset.id!;
    row.querySelector('[data-act="toggle"]')?.addEventListener('change', (e) => {
      const r = findRule(id);
      if (r) {
        r.enabled = (e.target as HTMLInputElement).checked;
        app().save();
      }
    });
    row.querySelector('[data-act="edit"]')?.addEventListener('click', () => {
      const r = findRule(id);
      if (r) {
        editing = JSON.parse(JSON.stringify(r)) as Rule;
        isNewRule = false;
        renderBox();
      }
    });
    row.querySelector('[data-act="del"]')?.addEventListener('click', () => {
      const r = findRule(id);
      if (r && confirm(`删除规则「${r.name}」？`)) {
        const cfg = getConfig();
        cfg.rules = cfg.rules.filter((x) => x.id !== id);
        refreshAll();
      }
    });
    const move = (dir: number): void => {
      const cfg = getConfig();
      const i = cfg.rules.findIndex((x) => x.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= cfg.rules.length) return;
      const tmp = cfg.rules[i];
      cfg.rules[i] = cfg.rules[j];
      cfg.rules[j] = tmp;
      refreshAll();
    };
    row.querySelector('[data-act="up"]')?.addEventListener('click', () => move(-1));
    row.querySelector('[data-act="down"]')?.addEventListener('click', () => move(1));
  });
}

function bindEditor(): void {
  const box = modal!;
  box.querySelectorAll<HTMLInputElement>('input[name="ldf-e-mode"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      const wrap = box.querySelector<HTMLElement>('#ldf-e-color-wrap');
      if (wrap) wrap.style.display = radio.value === 'highlight' && radio.checked ? 'inline-flex' : 'none';
    });
  });
  box.querySelectorAll<HTMLInputElement>('input[name="ldf-e-scope"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      const isCat =
        (box.querySelector<HTMLInputElement>('input[name="ldf-e-scope"]:checked')?.value || '') === 'category';
      const cats = box.querySelector<HTMLElement>('#ldf-e-scopecats');
      const home = box.querySelector<HTMLElement>('#ldf-e-includehome-wrap');
      if (cats) cats.style.display = isCat ? 'flex' : 'none';
      if (home) home.style.display = isCat ? 'inline-flex' : 'none';
    });
  });
  box.querySelector('[data-act="save-rule"]')?.addEventListener('click', saveEditor);
  box.querySelector('[data-act="cancel-rule"]')?.addEventListener('click', () => {
    editing = null;
    renderBox();
  });
  box.querySelector('[data-act="del-in-editor"]')?.addEventListener('click', () => {
    const id = editing?.id;
    if (!confirm(`删除规则「${editing?.name}」？`)) return;
    const cfg = getConfig();
    cfg.rules = cfg.rules.filter((x) => x.id !== id);
    app().recompile();
    editing = null;
    refreshAll();
  });
}

function saveEditor(): void {
  const box = modal!;
  const name = (box.querySelector<HTMLInputElement>('#ldf-e-name')?.value || '').trim() || '未命名规则';
  const mode = (box.querySelector<HTMLInputElement>('input[name="ldf-e-mode"]:checked')?.value ||
    'filter') as Rule['mode'];
  const color = box.querySelector<HTMLInputElement>('#ldf-e-color')?.value || RULE_COLORS[0];
  const scopeType = (box.querySelector<HTMLInputElement>('input[name="ldf-e-scope"]:checked')?.value || 'global') as
    | 'global'
    | 'home'
    | 'category';
  const scopeCats = Array.from(box.querySelectorAll<HTMLInputElement>('.ldf-e-scopecat:checked')).map((i) =>
    parseInt(i.value, 10),
  );
  const includeHome = box.querySelector<HTMLInputElement>('#ldf-e-includehome')?.checked === true;

  const when: RuleWhen = {};
  const cats = Array.from(box.querySelectorAll<HTMLInputElement>('.ldf-e-cat:checked')).map((i) => i.value);
  if (cats.length) when.categoryNames = cats;
  const tagsAny = splitList(box.querySelector<HTMLInputElement>('#ldf-e-tagsany')?.value || '');
  if (tagsAny.length) when.tagsAny = tagsAny;
  const tagsNone = splitList(box.querySelector<HTMLInputElement>('#ldf-e-tagsnone')?.value || '');
  if (tagsNone.length) when.tagsNone = tagsNone;
  const num = (sel: string): number | undefined => {
    const v = box.querySelector<HTMLInputElement>(sel)?.value;
    if (v == null || v === '') return undefined;
    const n = parseInt(v, 10);
    return Number.isFinite(n) && n >= 0 ? n : undefined;
  };
  const minAsk = num('#ldf-e-minask');
  if (minAsk != null) when.minAsk = minAsk;
  const minBuzz = num('#ldf-e-minbuzz');
  if (minBuzz != null) when.minBuzz = minBuzz;
  const minShield = num('#ldf-e-minshield');
  if (minShield != null) when.minShield = minShield;
  const minLen = num('#ldf-e-minlen');
  if (minLen != null) when.titleMinLen = minLen;
  const maxLen = num('#ldf-e-maxlen');
  if (maxLen != null) when.titleMaxLen = maxLen;
  const regexLines = (box.querySelector<HTMLTextAreaElement>('#ldf-e-regex')?.value || '')
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (regexLines.length) {
    for (const line of regexLines) {
      try {
        new RegExp(line);
      } catch (e) {
        toast(`正则无效：${line}（${(e as Error).message}）`);
        return;
      }
    }
    when.titleRegexAny = regexLines;
  }

  const hasCondition =
    (when.categoryNames && when.categoryNames.length > 0) ||
    (when.tagsAny && when.tagsAny.length > 0) ||
    (when.tagsNone && when.tagsNone.length > 0) ||
    when.minAsk != null ||
    when.minBuzz != null ||
    when.minShield != null ||
    when.titleMaxLen != null ||
    when.titleMinLen != null ||
    (when.titleRegexAny && when.titleRegexAny.length > 0);
  if (!hasCondition) {
    toast('请至少设置一个匹配条件');
    return;
  }
  if (scopeType === 'category' && scopeCats.length === 0 && !includeHome) {
    toast('作用域选择「指定板块页」时，至少勾选一个板块或勾选首页');
    return;
  }

  const rule: Rule = { ...editing!, name, mode, color, when };
  if (scopeType === 'global') rule.scope = { type: 'global' };
  else if (scopeType === 'home') rule.scope = { type: 'home' };
  else rule.scope = { type: 'category', categoryIds: scopeCats, includeHome };

  const cfg = getConfig();
  const idx = cfg.rules.findIndex((x) => x.id === rule.id);
  if (idx >= 0) cfg.rules[idx] = rule;
  else cfg.rules.push(rule);
  app().save();
  app().recompile();
  editing = null;
  isNewRule = false;
  renderBox();
  if (rule.preset) toast('预设已修改，刷新页面后生效');
  else toast('规则已保存，刷新页面后生效');
}

function bindLexiconsTab(): void {
  const box = modal!;
  box.querySelector('[data-act="save-lex"]')?.addEventListener('click', () => {
    const cfg = getConfig();
    cfg.lexicons = {
      ask: splitList(box.querySelector<HTMLTextAreaElement>('#ldf-lex-ask')?.value || ''),
      buzz: splitList(box.querySelector<HTMLTextAreaElement>('#ldf-lex-buzz')?.value || ''),
      shield: splitList(box.querySelector<HTMLTextAreaElement>('#ldf-lex-shield')?.value || ''),
    };
    app().save();
    app().recompile();
    toast('词库已保存，刷新页面后生效');
  });
  box.querySelector('[data-act="reset-lex"]')?.addEventListener('click', () => {
    if (!confirm('恢复默认词库？当前词库修改将丢失。')) return;
    resetLexicons();
    app().recompile();
    renderBox();
    toast('词库已恢复默认');
  });
}

function bindDataTab(): void {
  const box = modal!;
  box.querySelector('[data-act="copy-export"]')?.addEventListener('click', async () => {
    const ta = box.querySelector<HTMLTextAreaElement>('#ldf-export');
    if (!ta) return;
    ta.select();
    try {
      const ok = document.execCommand('copy');
      if (ok) {
        toast('已复制到剪贴板');
        return;
      }
    } catch {
      /* fallthrough */
    }
    try {
      await navigator.clipboard.writeText(ta.value);
      toast('已复制到剪贴板');
    } catch {
      toast('复制失败，请手动全选复制');
    }
  });
  box.querySelector('[data-act="import"]')?.addEventListener('click', () => {
    const text = box.querySelector<HTMLTextAreaElement>('#ldf-import')?.value || '';
    if (!text.trim()) {
      toast('请先粘贴 JSON');
      return;
    }
    const r = importJSON(text);
    if (!r.ok) {
      toast(`导入失败：${r.error}`);
      return;
    }
    app().recompile();
    renderBox();
    toast('配置已导入，刷新页面后生效');
  });
  box.querySelector('[data-act="save-ex"]')?.addEventListener('click', () => {
    const cfg = getConfig();
    cfg.exemptions.topicIds = splitList(box.querySelector<HTMLTextAreaElement>('#ldf-ex-ids')?.value || '')
      .map((s) => parseInt(s, 10))
      .filter((n) => Number.isFinite(n));
    cfg.exemptions.titleKeywords = splitList(box.querySelector<HTMLTextAreaElement>('#ldf-ex-words')?.value || '');
    app().save();
    toast('豁免名单已保存');
  });
  box.querySelector('[data-act="clear-ex"]')?.addEventListener('click', () => {
    const cfg = getConfig();
    cfg.exemptions = { topicIds: [], titleKeywords: [] };
    app().save();
    renderBox();
    toast('豁免已清空');
  });
}
