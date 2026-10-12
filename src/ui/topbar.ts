import { app } from '../context';
import { filteredCount, getCurrentPage, syncCurrentPage } from '../intercept';
import { isFilterablePage } from '../page';
import { escHtml } from './common';

const GEAR_SVG =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';

let group: HTMLDivElement | null = null;
let mountEl: HTMLElement | null = null;
let countBtn: HTMLButtonElement | null = null;
let floating = false;

function findHeaderContainer(): HTMLElement | null {
  const candidates = [
    'ul.d-header-icons',
    '.d-header .header-buttons',
    '.d-header .icons',
    '.d-header-icons',
    '.header-buttons',
  ];
  for (const sel of candidates) {
    const el = document.querySelector<HTMLElement>(sel);
    if (el && el.getBoundingClientRect().width > 0) return el;
  }
  for (const sel of candidates) {
    const el = document.querySelector<HTMLElement>(sel);
    if (el) return el;
  }
  return null;
}

function buildGroup(): void {
  if (group) return;
  group = document.createElement('div');
  group.className = 'ldf-topbar-group';

  const gear = document.createElement('button');
  gear.type = 'button';
  gear.className = 'ldf-icon-btn';
  gear.title = 'LinuxDo 智能降噪设置';
  gear.setAttribute('aria-label', '设置');
  gear.innerHTML = GEAR_SVG;
  gear.addEventListener('click', () => app().openSettings());

  countBtn = document.createElement('button');
  countBtn.type = 'button';
  countBtn.className = 'ldf-count-btn';
  countBtn.addEventListener('click', () => {
    const page = getCurrentPage();
    if (isFilterablePage(page)) app().openDrawer();
    else app().openSettings();
  });

  group.appendChild(gear);
  group.appendChild(countBtn);
}

function debugLog(...args: unknown[]): void {
  try {
    if (app().getConfig().debug) console.log('%c[LD-SF]', 'color:#3aa', ...args);
  } catch {
    /* app not ready yet */
  }
}

function makeMount(isLi: boolean): HTMLElement {
  const el = document.createElement(isLi ? 'li' : 'div');
  el.className = 'ldf-topbar-mount';
  if (group) el.appendChild(group);
  return el;
}

function mountTo(container: HTMLElement | null): void {
  if (container) {
    mountEl = makeMount(container instanceof HTMLUListElement);
    container.appendChild(mountEl);
    if (floating) {
      floating = false;
      mountEl.classList.remove('ldf-floating');
    }
    debugLog('顶栏按钮已挂载到站点导航栏');
  } else {
    if (!mountEl) mountEl = makeMount(false);
    floating = true;
    mountEl.classList.add('ldf-floating');
    (document.body || document.documentElement).appendChild(mountEl);
    debugLog('未找到可见的站点导航栏，顶栏按钮使用浮动模式');
  }
  updateCount();
  requestAnimationFrame(() => {
    if (!mountEl || floating) return;
    const rect = mountEl.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) {
      floating = true;
      mountEl.classList.add('ldf-floating');
      (document.body || document.documentElement).appendChild(mountEl);
      debugLog('导航栏容器不可见，顶栏按钮切换为浮动模式');
    }
  });
}

export function ensureTopbar(): void {
  try {
    buildGroup();
    const container = findHeaderContainer();
    const targetContainer = container && container.getBoundingClientRect().width > 0 ? container : null;
    const alreadyMounted =
      mountEl !== null &&
      document.contains(mountEl) &&
      (targetContainer
        ? mountEl.parentElement === targetContainer
        : mountEl.parentElement === document.body && floating);
    if (alreadyMounted) {
      updateCount();
      return;
    }
    mountEl?.remove();
    mountTo(targetContainer);
  } catch (e) {
    console.error('[LD-SF] 挂载顶栏按钮失败', e);
  }
}

export function updateCount(): void {
  if (!countBtn) return;
  syncCurrentPage();
  const page = getCurrentPage();
  const n = filteredCount();
  countBtn.textContent = isFilterablePage(page) ? `已过滤 (${n})` : 'LinuxDo 降噪';
  countBtn.title = isFilterablePage(page) ? '查看本页被过滤的主题' : '打开降噪设置';
}

function onSelfEmpty(e: Event): void {
  const detail = (e as CustomEvent<{ count: number }>).detail;
  const tryInsert = (): void => {
    const body = document.querySelector('.topic-list-body');
    if (!body || body.querySelector('.ldf-selfempty')) return;
    const rows = body.querySelectorAll<HTMLElement>('tr[data-topic-id]');
    const allHidden =
      rows.length > 0 && Array.from(rows).every((r) => r.style.display === 'none' || r.dataset.ldfHidden === '1');
    if (!allHidden && body.children.length > 0) {
      setTimeout(tryInsert, 300);
      return;
    }
    const tr = document.createElement('tr');
    tr.className = 'ldf-selfempty';
    tr.innerHTML =
      '<td colspan="5">本页 ' +
      escHtml(detail.count) +
      ' 条主题全部被过滤。<a href="#" class="ldf-open-drawer">查看已过滤</a></td>';
    body.appendChild(tr);
    tr.querySelector('.ldf-open-drawer')?.addEventListener('click', (ev) => {
      ev.preventDefault();
      app().openDrawer();
    });
  };
  tryInsert();
}

export function installTopbarListeners(): void {
  window.addEventListener('ldf:self-empty', onSelfEmpty);
  window.addEventListener('ldf:refresh', updateCount);
  const remountIfLost = (): void => {
    if (!mountEl || !document.contains(mountEl)) ensureTopbar();
  };
  let raf = 0;
  const startObserving = (): void => {
    const mo = new MutationObserver(() => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        remountIfLost();
      });
    });
    mo.observe(document.body, { childList: true, subtree: true });
  };
  if (document.body) startObserving();
  else document.addEventListener('DOMContentLoaded', startObserving, { once: true });
  setInterval(ensureTopbar, 3000);
}
