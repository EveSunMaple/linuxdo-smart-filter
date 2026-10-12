export const CSS = `
:root {
  --ldf-bg: #ffffff;
  --ldf-fg: #1f2328;
  --ldf-muted: #6b7280;
  --ldf-border: #e5e7eb;
  --ldf-accent: #2563eb;
  --ldf-danger: #dc2626;
  --ldf-chip: #f3f4f6;
  --ldf-shadow: 0 12px 40px rgba(0,0,0,.18);
}
@media (prefers-color-scheme: dark) {
  :root {
    --ldf-bg: #1b1d21;
    --ldf-fg: #e6e8eb;
    --ldf-muted: #9aa1ab;
    --ldf-border: #34383f;
    --ldf-accent: #4f8dfd;
    --ldf-danger: #f87171;
    --ldf-chip: #2a2e34;
    --ldf-shadow: 0 12px 40px rgba(0,0,0,.55);
  }
}
.ldf-topbar-mount { display: inline-flex; align-items: center; list-style: none; }
.ldf-topbar-mount.ldf-floating { position: fixed; right: 14px; bottom: 14px; z-index: 99990; background: var(--ldf-bg); border: 1px solid var(--ldf-border); border-radius: 999px; padding: 6px 8px; box-shadow: var(--ldf-shadow); }
.ldf-topbar-group { display: inline-flex; align-items: center; gap: 6px; }
.ldf-btn { font: inherit; font-size: 13px; color: var(--ldf-fg); background: var(--ldf-bg); border: 1px solid var(--ldf-border); border-radius: 8px; padding: 5px 10px; cursor: pointer; }
.ldf-btn:hover { border-color: var(--ldf-accent); }
.ldf-btn.ldf-primary { background: var(--ldf-accent); border-color: var(--ldf-accent); color: #fff; }
.ldf-btn.ldf-danger { color: var(--ldf-danger); }
.ldf-icon-btn { width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center; border-radius: 50%; border: 1px solid transparent; background: transparent; color: var(--ldf-fg); cursor: pointer; }
.ldf-icon-btn:hover { background: var(--ldf-chip); }
.ldf-count-btn { font: inherit; font-size: 12.5px; color: var(--ldf-fg); background: var(--ldf-chip); border: 1px solid var(--ldf-border); border-radius: 999px; padding: 4px 12px; cursor: pointer; white-space: nowrap; }
.ldf-count-btn:hover { border-color: var(--ldf-accent); }
#ldf-drawer { position: fixed; inset: 0; z-index: 99995; display: none; }
#ldf-drawer.ldf-open { display: block; }
.ldf-drawer-overlay { position: absolute; inset: 0; background: rgba(0,0,0,.4); opacity: 0; transition: opacity .18s; }
#ldf-drawer.ldf-on .ldf-drawer-overlay { opacity: 1; }
.ldf-drawer-panel { position: absolute; top: 0; right: 0; bottom: 0; width: min(440px, 100vw); background: var(--ldf-bg); color: var(--ldf-fg); box-shadow: var(--ldf-shadow); display: flex; flex-direction: column; transform: translateX(24px); opacity: 0; transition: transform .18s, opacity .18s; }
#ldf-drawer.ldf-on .ldf-drawer-panel { transform: none; opacity: 1; }
.ldf-drawer-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid var(--ldf-border); font-size: 15px; }
.ldf-drawer-header b { color: var(--ldf-accent); }
.ldf-drawer-close { border: 0; background: transparent; color: var(--ldf-muted); font-size: 20px; cursor: pointer; line-height: 1; }
.ldf-drawer-body { flex: 1; overflow-y: auto; padding: 8px 0; }
.ldf-drawer-empty { padding: 32px 16px; text-align: center; color: var(--ldf-muted); font-size: 14px; }
.ldf-item { padding: 10px 16px; border-bottom: 1px solid var(--ldf-border); }
.ldf-item-title { color: var(--ldf-fg); font-size: 14px; font-weight: 600; text-decoration: none; line-height: 1.45; display: block; }
.ldf-item-title:hover { color: var(--ldf-accent); }
.ldf-item-meta { margin-top: 4px; font-size: 12px; color: var(--ldf-muted); display: flex; flex-wrap: wrap; gap: 4px 8px; align-items: center; }
.ldf-item-meta a { color: var(--ldf-muted); text-decoration: none; }
.ldf-item-cat { border: 1px solid var(--ldf-border); border-radius: 4px; padding: 0 5px; }
.ldf-item-reason { margin-top: 5px; font-size: 12px; color: var(--ldf-muted); background: var(--ldf-chip); border-radius: 6px; padding: 4px 8px; display: inline-block; }
.ldf-item-actions { margin-top: 6px; display: flex; gap: 8px; }
.ldf-item-actions .ldf-btn { font-size: 12px; padding: 3px 8px; }
.ldf-item-badge { font-size: 11px; border-radius: 4px; padding: 0 4px; background: var(--ldf-chip); }
#ldf-modal { position: fixed; inset: 0; z-index: 99999; display: none; background: rgba(0,0,0,.45); align-items: flex-start; justify-content: center; padding: 36px 14px 14px; overflow-y: auto; }
#ldf-modal.ldf-open { display: flex; }
.ldf-modal-box { width: min(760px, 100%); background: var(--ldf-bg); color: var(--ldf-fg); border-radius: 14px; box-shadow: var(--ldf-shadow); display: flex; flex-direction: column; max-height: calc(100vh - 60px); overflow: hidden; }
.ldf-modal-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; border-bottom: 1px solid var(--ldf-border); }
.ldf-modal-title { font-size: 16px; font-weight: 700; }
.ldf-modal-sub { font-size: 12px; color: var(--ldf-muted); margin-top: 2px; }
.ldf-modal-close { border: 0; background: transparent; color: var(--ldf-muted); font-size: 20px; cursor: pointer; line-height: 1; }
.ldf-tabs { display: flex; gap: 4px; padding: 10px 18px 0; border-bottom: 1px solid var(--ldf-border); }
.ldf-tab { border: 0; background: transparent; color: var(--ldf-muted); font: inherit; font-size: 13.5px; padding: 8px 12px; cursor: pointer; border-bottom: 2px solid transparent; }
.ldf-tab.ldf-on { color: var(--ldf-accent); border-bottom-color: var(--ldf-accent); }
.ldf-modal-body { padding: 14px 18px; overflow-y: auto; }
.ldf-toolbar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 12px; }
.ldf-toolbar .ldf-spacer { flex: 1; }
.ldf-rule-row { display: flex; align-items: center; gap: 10px; padding: 10px 10px; border: 1px solid var(--ldf-border); border-radius: 10px; margin-bottom: 8px; flex-wrap: wrap; }
.ldf-rule-main { flex: 1; min-width: 200px; }
.ldf-rule-name { font-size: 14px; font-weight: 600; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.ldf-rule-sub { font-size: 12px; color: var(--ldf-muted); margin-top: 3px; word-break: break-all; }
.ldf-chip { font-size: 11px; border-radius: 5px; padding: 1px 6px; background: var(--ldf-chip); color: var(--ldf-muted); }
.ldf-chip.ldf-filter { color: #b45309; }
.ldf-chip.ldf-highlight { color: #15803d; }
.ldf-chip.ldf-err { color: var(--ldf-danger); }
.ldf-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
.ldf-switch { position: relative; width: 36px; height: 20px; flex: none; }
.ldf-switch input { opacity: 0; width: 0; height: 0; }
.ldf-slider { position: absolute; inset: 0; background: var(--ldf-chip); border: 1px solid var(--ldf-border); border-radius: 999px; cursor: pointer; transition: background .15s; }
.ldf-slider::after { content: ''; position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; border-radius: 50%; background: var(--ldf-muted); transition: transform .15s, background .15s; }
.ldf-switch input:checked + .ldf-slider { background: color-mix(in srgb, var(--ldf-accent) 30%, transparent); border-color: var(--ldf-accent); }
.ldf-switch input:checked + .ldf-slider::after { transform: translateX(16px); background: var(--ldf-accent); }
.ldf-mini { border: 1px solid var(--ldf-border); background: var(--ldf-bg); color: var(--ldf-muted); border-radius: 6px; width: 26px; height: 26px; cursor: pointer; font-size: 12px; }
.ldf-mini:hover { color: var(--ldf-accent); border-color: var(--ldf-accent); }
.ldf-mini:disabled { opacity: .35; cursor: default; }
.ldf-field { margin-bottom: 14px; }
.ldf-field > label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; }
.ldf-hint { font-size: 12px; color: var(--ldf-muted); margin-top: 4px; line-height: 1.5; }
.ldf-input, .ldf-select, .ldf-textarea { width: 100%; box-sizing: border-box; font: inherit; font-size: 13.5px; color: var(--ldf-fg); background: var(--ldf-bg); border: 1px solid var(--ldf-border); border-radius: 8px; padding: 7px 10px; }
.ldf-textarea { min-height: 90px; resize: vertical; font-family: ui-monospace, monospace; font-size: 12.5px; line-height: 1.6; }
.ldf-input:focus, .ldf-select:focus, .ldf-textarea:focus { outline: none; border-color: var(--ldf-accent); }
.ldf-inline { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
.ldf-inline .ldf-num { width: 76px; }
.ldf-cat-list { display: flex; flex-wrap: wrap; gap: 6px 14px; padding: 8px 10px; border: 1px solid var(--ldf-border); border-radius: 8px; max-height: 160px; overflow-y: auto; }
.ldf-cat-item { font-size: 13px; display: inline-flex; align-items: center; gap: 5px; }
.ldf-seg { display: inline-flex; border: 1px solid var(--ldf-border); border-radius: 8px; overflow: hidden; }
.ldf-seg label { font-size: 13px; padding: 5px 12px; cursor: pointer; color: var(--ldf-muted); }
.ldf-seg input { display: none; }
.ldf-seg input:checked + span { color: var(--ldf-accent); font-weight: 600; }
.ldf-seg label:has(input:checked) { background: var(--ldf-chip); }
.ldf-modal-footer { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 12px 18px; border-top: 1px solid var(--ldf-border); flex-wrap: wrap; }
.ldf-footer-left { font-size: 12px; color: var(--ldf-muted); display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
#ldf-toast-host { position: fixed; left: 50%; bottom: 40px; transform: translateX(-50%); z-index: 100000; display: flex; flex-direction: column; gap: 8px; align-items: center; pointer-events: none; }
.ldf-toast { background: #111827; color: #f9fafb; font-size: 13px; border-radius: 8px; padding: 9px 14px; opacity: 0; transform: translateY(8px); transition: opacity .2s, transform .2s; max-width: min(560px, 90vw); }
.ldf-toast.ldf-toast-in { opacity: 1; transform: none; }
tr.ldf-highlight > td { box-shadow: inset 3px 0 0 var(--ldf-hl, #2f9e44); }
tr.ldf-highlight .title { color: inherit; }
.ldf-selfempty td { padding: 26px 12px !important; text-align: center; color: var(--ldf-muted); font-size: 13.5px; }
.ldf-selfempty a { color: var(--ldf-accent); margin-left: 6px; }
@media (max-width: 640px) {
  #ldf-modal { padding: 0; }
  .ldf-modal-box { max-height: 100vh; min-height: 100vh; border-radius: 0; width: 100%; }
  .ldf-drawer-panel { width: 100vw; }
}
`;
