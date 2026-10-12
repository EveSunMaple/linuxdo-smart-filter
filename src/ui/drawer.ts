import { app } from '../context';
import { categoryHref, categoryNameOf } from '../page';
import { escHtml } from './common';

let drawer: HTMLDivElement | null = null;

function build(): HTMLDivElement {
  if (drawer) return drawer;
  const el = document.createElement('div');
  el.id = 'ldf-drawer';
  el.innerHTML =
    '<div class="ldf-drawer-overlay"></div>' +
    '<div class="ldf-drawer-panel">' +
    '<div class="ldf-drawer-header"><span>已过滤 <b class="ldf-drawer-count">0</b></span><button class="ldf-drawer-close" type="button">×</button></div>' +
    '<div class="ldf-drawer-body"></div>' +
    '</div>';
  document.body.appendChild(el);
  drawer = el;
  el.querySelector('.ldf-drawer-overlay')?.addEventListener('click', closeDrawer);
  el.querySelector('.ldf-drawer-close')?.addEventListener('click', closeDrawer);
  return el;
}

function render(): void {
  if (!drawer) return;
  const entries = app().getFiltered();
  const map = app().getCatMap();
  (drawer.querySelector('.ldf-drawer-count') as HTMLElement).textContent = String(entries.length);
  const body = drawer.querySelector('.ldf-drawer-body') as HTMLElement;
  if (!entries.length) {
    body.innerHTML = '<div class="ldf-drawer-empty">当前页面暂无被过滤的主题。</div>';
    return;
  }
  body.innerHTML = entries
    .map((e, i) => {
      const t = e.topic;
      const cat = categoryNameOf(map, t.category_id);
      const catLink = categoryHref(map, t.category_id);
      const tags = (t.tags || []).map((x) => `<span class="ldf-item-badge">${escHtml(x.name)}</span>`).join(' ');
      const replies = Math.max(0, (t.posts_count || 0) - 1);
      return (
        '<div class="ldf-item" data-idx="' +
        i +
        '">' +
        '<a class="ldf-item-title" target="_blank" rel="noopener" href="/t/topic/' +
        t.id +
        '/1">' +
        escHtml(t.title) +
        '</a>' +
        '<div class="ldf-item-meta">' +
        '<a class="ldf-item-cat" href="' +
        catLink +
        '" target="_blank" rel="noopener">' +
        escHtml(cat) +
        '</a>' +
        tags +
        '<span>回复 ' +
        replies +
        ' · 浏览 ' +
        (t.views || 0) +
        '</span>' +
        '</div>' +
        '<div class="ldf-item-reason">命中「' +
        escHtml(e.ruleName) +
        '」' +
        (e.reason ? ` · ${escHtml(e.reason)}` : '') +
        '</div>' +
        '<div class="ldf-item-actions"><button type="button" class="ldf-btn ldf-exempt" data-id="' +
        t.id +
        '">豁免此帖</button></div>' +
        '</div>'
      );
    })
    .join('');
  body.querySelectorAll<HTMLButtonElement>('.ldf-exempt').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.id || '', 10);
      if (Number.isFinite(id)) {
        app().exemptTopic(id);
        btn.disabled = true;
        btn.textContent = '已豁免';
      }
    });
  });
}

let savedOverflow: string | null = null;

export function openDrawer(): void {
  const el = build();
  render();
  el.classList.add('ldf-open');
  if (savedOverflow === null) savedOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(() => el.classList.add('ldf-on'));
}

export function closeDrawer(): void {
  if (!drawer) return;
  drawer.classList.remove('ldf-on');
  if (savedOverflow !== null) {
    document.body.style.overflow = savedOverflow;
    savedOverflow = null;
  }
  setTimeout(() => {
    if (drawer && !drawer.classList.contains('ldf-on')) drawer.classList.remove('ldf-open');
  }, 200);
}
