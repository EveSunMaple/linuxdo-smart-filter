import { beforeEach, describe, expect, it, vi } from 'vitest';

const OPEN_SETTINGS = '打开 LinuxDo 智能降噪设置';
const OPEN_DRAWER = '查看已过滤列表';

function installGmStubs(): Record<string, () => void> {
  const store: Record<string, unknown> = {};
  const commands: Record<string, () => void> = {};
  (globalThis as Record<string, unknown>).GM_getValue = (k: string, d: unknown) => (k in store ? store[k] : d);
  (globalThis as Record<string, unknown>).GM_setValue = (k: string, v: unknown) => {
    store[k] = v;
  };
  (globalThis as Record<string, unknown>).GM_registerMenuCommand = (name: string, fn: () => void) => {
    commands[name] = fn;
    return 0;
  };
  (globalThis as Record<string, unknown>).GM_addStyle = () => document.createElement('style');
  return commands;
}

async function boot(path: string): Promise<Record<string, () => void>> {
  window.history.replaceState({}, '', path);
  const commands = installGmStubs();
  (globalThis as Record<string, unknown>).fetch = () => Promise.reject(new Error('offline'));
  document.documentElement.innerHTML = '<head></head><body></body>';
  vi.resetModules();
  await import('../src/main');
  await new Promise((r) => setTimeout(r, 80));
  return commands;
}

function pressEscape(el: Element): void {
  el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
}

function appendWaterRow(): void {
  const table = document.createElement('table');
  const tbody = document.createElement('tbody');
  tbody.className = 'topic-list-body';
  tbody.innerHTML =
    '<tr data-topic-id="301" data-category-id="36"><td><a class="title raw-topic-link">我的gemini是不是生病了</a>' +
    '<span class="discourse-tags"><a class="discourse-tag" data-tag-name="纯水">纯水</a></span></td></tr>';
  table.appendChild(tbody);
  document.body.appendChild(table);
}

describe('弹层交互', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('设置面板支持 Escape 关闭，打开时焦点进入弹层', async () => {
    const commands = await boot('/latest');
    commands[OPEN_SETTINGS]();
    const modal = document.getElementById('ldf-modal') as HTMLElement;
    expect(modal.classList.contains('ldf-open')).toBe(true);
    const closeBtn = modal.querySelector('.ldf-modal-close');
    expect(document.activeElement).toBe(closeBtn);

    pressEscape(modal);
    expect(modal.classList.contains('ldf-open')).toBe(false);
    expect(document.activeElement).not.toBe(closeBtn);
  });

  it('抽屉支持 Escape 关闭', async () => {
    const commands = await boot('/latest');
    commands[OPEN_DRAWER]();
    const drawer = document.getElementById('ldf-drawer') as HTMLElement;
    expect(drawer.classList.contains('ldf-open')).toBe(true);

    pressEscape(drawer);
    expect(drawer.classList.contains('ldf-on')).toBe(false);
  });

  it('抽屉打开时随过滤结果实时刷新', async () => {
    const commands = await boot('/latest');
    commands[OPEN_DRAWER]();
    const drawer = document.getElementById('ldf-drawer') as HTMLElement;
    expect(drawer.querySelector('.ldf-drawer-count')?.textContent).toBe('0');

    appendWaterRow();
    await new Promise((r) => setTimeout(r, 300));
    expect(drawer.querySelector('.ldf-drawer-count')?.textContent).toBe('1');
  });
});
