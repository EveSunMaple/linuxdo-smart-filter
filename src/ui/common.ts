export function injectStyles(css: string): void {
  let styleEl: HTMLStyleElement | null = null;
  try {
    styleEl = GM_addStyle(css);
  } catch {
    styleEl = null;
  }
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.textContent = css;
    (document.head || document.documentElement).appendChild(styleEl);
  }
}

export function escHtml(s: unknown): string {
  return String(s ?? '').replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string,
  );
}

export function escAttr(s: unknown): string {
  return escHtml(s);
}

export function toast(msg: string, ms = 2800): void {
  let host = document.getElementById('ldf-toast-host');
  if (!host) {
    host = document.createElement('div');
    host.id = 'ldf-toast-host';
    document.body.appendChild(host);
  }
  const el = document.createElement('div');
  el.className = 'ldf-toast';
  el.textContent = msg;
  host.appendChild(el);
  requestAnimationFrame(() => el.classList.add('ldf-toast-in'));
  setTimeout(() => {
    el.classList.remove('ldf-toast-in');
    setTimeout(() => el.remove(), 250);
  }, ms);
}

export function splitList(text: string): string[] {
  return text
    .split(/[\n,，、]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function copyText(text: string): Promise<boolean> {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text).then(
      () => true,
      () => false,
    );
  }
  return Promise.resolve(false);
}

export function trapFocus(container: HTMLElement, e: KeyboardEvent): void {
  if (e.key !== 'Tab') return;
  const focusables = Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  );
  if (!focusables.length) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  const active = document.activeElement;
  if (e.shiftKey) {
    if (active === first || !container.contains(active)) {
      e.preventDefault();
      last.focus();
    }
  } else if (active === last || !container.contains(active)) {
    e.preventDefault();
    first.focus();
  }
}
