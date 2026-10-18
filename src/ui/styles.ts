export const CSS = `
:root {
  --ldf-bg: var(--secondary, #ffffff);
  --ldf-fg: var(--primary, #222222);
  --ldf-muted: var(--primary-medium, #909090);
  --ldf-border: var(--primary-low, #e9e9e9);
  --ldf-border-strong: var(--primary-low-mid, #bdbdbd);
  --ldf-chip: var(--primary-very-low, #f8f8f8);
  --ldf-hover: var(--d-hover, #f2f2f2);
  --ldf-accent: var(--tertiary, #0088cc);
  --ldf-accent-hover: var(--tertiary-hover, #006699);
  --ldf-accent-soft: color-mix(in srgb, var(--tertiary, #0088cc) 12%, transparent);
  --ldf-selected: var(--d-selected, #d1f0ff);
  --ldf-danger: var(--danger, #c80001);
  --ldf-success: var(--success, #009900);
  --ldf-radius: var(--d-border-radius, 4px);
  --ldf-radius-large: var(--d-border-radius-large, 8px);
  --ldf-shadow: 0 8px 30px rgba(0, 0, 0, .2);
  --ldf-shadow-modal: 0 8px 60px rgba(0, 0, 0, .25);
  --ldf-header-fg: var(--header_primary, #333333);
  --ldf-header-muted: var(--header_primary-low-mid, #d0d0d0);
}
.ldf-topbar-mount { display: inline-flex; align-items: center; list-style: none; accent-color: var(--ldf-accent); }
.ldf-topbar-mount.ldf-floating { position: fixed; right: 14px; bottom: 14px; z-index: 99990; background: var(--ldf-bg); border: 1px solid var(--ldf-border-strong); border-radius: var(--ldf-radius-large); padding: 5px 7px; box-shadow: var(--ldf-shadow); }
.ldf-topbar-group { display: inline-flex; align-items: center; gap: 4px; }
.ldf-btn { font: inherit; font-size: 13px; color: var(--ldf-fg); background: var(--ldf-bg); border: 1px solid var(--ldf-border-strong); border-radius: var(--ldf-radius); padding: 5px 10px; cursor: pointer; transition: background-color .12s, border-color .12s, color .12s; }
.ldf-btn:hover { background: var(--ldf-hover); }
.ldf-btn:disabled { opacity: .5; cursor: default; }
.ldf-btn.ldf-primary { background: var(--ldf-accent); border-color: var(--ldf-accent); color: var(--ldf-bg); }
.ldf-btn.ldf-primary:hover { background: var(--ldf-accent-hover); border-color: var(--ldf-accent-hover); }
.ldf-btn.ldf-danger { color: var(--ldf-danger); border-color: color-mix(in srgb, var(--ldf-danger) 40%, var(--ldf-border-strong)); }
.ldf-btn.ldf-danger:hover { background: color-mix(in srgb, var(--ldf-danger) 8%, transparent); }
.ldf-icon-btn { width: 34px; height: 34px; display: inline-flex; align-items: center; justify-content: center; border: 0; border-radius: var(--ldf-radius); background: transparent; color: var(--ldf-header-muted); cursor: pointer; transition: background-color .12s, color .12s; }
.ldf-icon-btn:hover { background: var(--ldf-hover); color: var(--ldf-header-fg); }
.ldf-floating .ldf-icon-btn { color: var(--ldf-muted); }
.ldf-floating .ldf-icon-btn:hover { color: var(--ldf-fg); }
.ldf-count-btn { font: inherit; font-size: 13px; color: var(--ldf-accent); background: var(--ldf-selected); border: 1px solid transparent; border-radius: var(--ldf-radius); padding: 5px 10px; cursor: pointer; white-space: nowrap; transition: border-color .12s; }
.ldf-count-btn:hover { border-color: var(--ldf-accent); }
#ldf-drawer { position: fixed; inset: 0; z-index: 99995; display: none; accent-color: var(--ldf-accent); }
#ldf-drawer.ldf-open { display: block; }
.ldf-drawer-overlay { position: absolute; inset: 0; background: rgba(0, 0, 0, .5); opacity: 0; transition: opacity .18s; }
#ldf-drawer.ldf-on .ldf-drawer-overlay { opacity: 1; }
.ldf-drawer-panel { position: absolute; top: 0; right: 0; bottom: 0; width: min(440px, 100vw); background: var(--ldf-bg); color: var(--ldf-fg); border-left: 1px solid var(--ldf-border); box-shadow: -8px 0 30px rgba(0, 0, 0, .18); display: flex; flex-direction: column; transform: translateX(24px); opacity: 0; transition: transform .18s, opacity .18s; }
#ldf-drawer.ldf-on .ldf-drawer-panel { transform: none; opacity: 1; }
.ldf-drawer-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid var(--ldf-border); font-size: 15px; font-weight: 600; }
.ldf-drawer-header b { color: var(--ldf-accent); }
.ldf-drawer-close { border: 0; background: transparent; color: var(--ldf-muted); font-size: 20px; cursor: pointer; line-height: 1; }
.ldf-drawer-close:hover { color: var(--ldf-fg); }
.ldf-drawer-body { flex: 1; overflow-y: auto; padding: 8px 0; }
.ldf-drawer-empty { padding: 32px 16px; text-align: center; color: var(--ldf-muted); font-size: 14px; }
.ldf-item { padding: 10px 16px; border-bottom: 1px solid var(--ldf-border); }
.ldf-item-title { color: var(--ldf-fg); font-size: 14px; font-weight: 600; text-decoration: none; line-height: 1.45; display: block; }
.ldf-item-title:hover { color: var(--ldf-accent); }
.ldf-item-meta { margin-top: 4px; font-size: 12px; color: var(--ldf-muted); display: flex; flex-wrap: wrap; gap: 4px 8px; align-items: center; }
.ldf-item-meta a { color: var(--ldf-muted); text-decoration: none; }
.ldf-item-cat { border: 1px solid var(--ldf-border-strong); border-radius: var(--ldf-radius); padding: 0 5px; }
.ldf-item-reason { margin-top: 5px; font-size: 12px; color: var(--ldf-muted); background: var(--ldf-accent-soft); border-radius: var(--ldf-radius); padding: 4px 8px; display: inline-block; }
.ldf-item-actions { margin-top: 6px; display: flex; gap: 8px; }
.ldf-item-actions .ldf-btn { font-size: 12px; padding: 3px 8px; }
.ldf-item-badge { font-size: 11px; border-radius: var(--ldf-radius); padding: 0 4px; background: var(--ldf-chip); color: var(--ldf-muted); border: 1px solid var(--ldf-border); }
#ldf-modal { position: fixed; inset: 0; z-index: 99999; display: none; background: rgba(0, 0, 0, .5); align-items: flex-start; justify-content: center; padding: 36px 14px 14px; overflow-y: auto; accent-color: var(--ldf-accent); }
#ldf-modal.ldf-open { display: flex; }
.ldf-modal-box { width: min(760px, 100%); background: var(--ldf-bg); color: var(--ldf-fg); border: 1px solid var(--ldf-border); border-radius: var(--ldf-radius); box-shadow: var(--ldf-shadow-modal); display: flex; flex-direction: column; max-height: calc(100vh - 60px); overflow: hidden; }
.ldf-modal-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; border-bottom: 1px solid var(--ldf-border); }
.ldf-modal-title { font-size: 16px; font-weight: 600; }
.ldf-modal-sub { font-size: 12px; color: var(--ldf-muted); margin-top: 2px; }
.ldf-modal-close { border: 0; background: transparent; color: var(--ldf-muted); font-size: 20px; cursor: pointer; line-height: 1; }
.ldf-modal-close:hover { color: var(--ldf-fg); }
.ldf-tabs { display: flex; gap: 4px; padding: 0 18px; border-bottom: 1px solid var(--ldf-border); }
.ldf-tab { border: 0; background: transparent; color: var(--ldf-muted); font: inherit; font-size: 13.5px; padding: 10px 10px 8px; cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px; transition: color .12s; }
.ldf-tab:hover { color: var(--ldf-fg); }
.ldf-tab.ldf-on { color: var(--ldf-accent); border-bottom-color: var(--ldf-accent); font-weight: 600; }
.ldf-modal-body { padding: 14px 18px; overflow-y: auto; }
.ldf-toolbar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 12px; }
.ldf-toolbar .ldf-spacer { flex: 1; }
.ldf-rule-row { display: flex; align-items: center; gap: 10px; padding: 10px; border: 1px solid var(--ldf-border); border-radius: var(--ldf-radius); margin-bottom: 8px; flex-wrap: wrap; }
.ldf-rule-row:hover { border-color: var(--ldf-border-strong); }
.ldf-rule-main { flex: 1; min-width: 200px; }
.ldf-rule-name { font-size: 14px; font-weight: 600; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.ldf-rule-sub { font-size: 12px; color: var(--ldf-muted); margin-top: 3px; word-break: break-all; }
.ldf-chip { font-size: 11px; border-radius: var(--ldf-radius); padding: 1px 6px; background: var(--ldf-chip); color: var(--ldf-muted); border: 1px solid var(--ldf-border); }
.ldf-chip.ldf-filter { color: var(--ldf-danger); background: color-mix(in srgb, var(--ldf-danger) 8%, transparent); border-color: color-mix(in srgb, var(--ldf-danger) 25%, transparent); }
.ldf-chip.ldf-highlight { color: var(--ldf-success); background: color-mix(in srgb, var(--ldf-success) 8%, transparent); border-color: color-mix(in srgb, var(--ldf-success) 25%, transparent); }
.ldf-chip.ldf-err { color: var(--ldf-danger); border-color: color-mix(in srgb, var(--ldf-danger) 40%, transparent); }
.ldf-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
.ldf-switch { position: relative; width: 36px; height: 20px; flex: none; }
.ldf-switch input { opacity: 0; width: 0; height: 0; }
.ldf-slider { position: absolute; inset: 0; background: var(--ldf-chip); border: 1px solid var(--ldf-border-strong); border-radius: 999px; cursor: pointer; transition: background .15s, border-color .15s; }
.ldf-slider::after { content: ''; position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; border-radius: 50%; background: var(--ldf-muted); transition: transform .15s, background .15s; }
.ldf-switch input:checked + .ldf-slider { background: var(--ldf-accent); border-color: var(--ldf-accent); }
.ldf-switch input:checked + .ldf-slider::after { transform: translateX(16px); background: #fff; }
.ldf-mini { border: 1px solid var(--ldf-border-strong); background: var(--ldf-bg); color: var(--ldf-muted); border-radius: var(--ldf-radius); width: 26px; height: 26px; cursor: pointer; font-size: 12px; transition: color .12s, border-color .12s; }
.ldf-mini:hover:not(:disabled) { color: var(--ldf-accent); border-color: var(--ldf-accent); }
.ldf-mini:disabled { opacity: .35; cursor: default; }
.ldf-field { margin-bottom: 14px; }
.ldf-field > label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; }
.ldf-hint { font-size: 12px; color: var(--ldf-muted); margin-top: 4px; line-height: 1.5; }
.ldf-input, .ldf-select, .ldf-textarea { width: 100%; box-sizing: border-box; font: inherit; font-size: 13.5px; color: var(--ldf-fg); background: var(--ldf-bg); border: 1px solid var(--ldf-border-strong); border-radius: var(--ldf-radius); padding: 7px 10px; }
.ldf-input::placeholder, .ldf-textarea::placeholder { color: var(--ldf-muted); }
.ldf-input:focus, .ldf-select:focus, .ldf-textarea:focus { outline: none; border-color: var(--ldf-accent); box-shadow: 0 0 0 3px var(--ldf-accent-soft); }
.ldf-textarea { min-height: 90px; resize: vertical; font-family: ui-monospace, monospace; font-size: 12.5px; line-height: 1.6; }
.ldf-inline { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
.ldf-inline .ldf-num { width: 76px; }
.ldf-cat-list { display: flex; flex-wrap: wrap; gap: 6px 14px; padding: 8px 10px; border: 1px solid var(--ldf-border); border-radius: var(--ldf-radius); max-height: 160px; overflow-y: auto; }
.ldf-cat-item { font-size: 13px; display: inline-flex; align-items: center; gap: 5px; }
.ldf-seg { display: inline-flex; border: 1px solid var(--ldf-border-strong); border-radius: var(--ldf-radius); overflow: hidden; }
.ldf-seg label { font-size: 13px; padding: 5px 12px; cursor: pointer; color: var(--ldf-muted); transition: background-color .12s, color .12s; }
.ldf-seg label + label { border-left: 1px solid var(--ldf-border-strong); }
.ldf-seg label:hover { background: var(--ldf-hover); }
.ldf-seg input { position: absolute; opacity: 0; pointer-events: none; }
.ldf-seg input:checked + span { color: var(--ldf-accent); font-weight: 600; }
.ldf-seg label:has(input:checked) { background: var(--ldf-selected); }
.ldf-modal-footer { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 12px 18px; border-top: 1px solid var(--ldf-border); flex-wrap: wrap; }
.ldf-footer-left { font-size: 12px; color: var(--ldf-muted); display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
#ldf-toast-host { position: fixed; left: 50%; bottom: 40px; transform: translateX(-50%); z-index: 100000; display: flex; flex-direction: column; gap: 8px; align-items: center; pointer-events: none; }
.ldf-toast { background: var(--ldf-bg); color: var(--ldf-fg); border: 1px solid var(--ldf-border-strong); font-size: 13px; border-radius: var(--ldf-radius); padding: 9px 14px; opacity: 0; transform: translateY(8px); transition: opacity .2s, transform .2s; max-width: min(560px, 90vw); box-shadow: 0 4px 24px rgba(0, 0, 0, .18); }
.ldf-toast.ldf-toast-in { opacity: 1; transform: none; }
tr.ldf-highlight > td:first-child { box-shadow: inset 3px 0 0 var(--ldf-hl, var(--success, #009900)); }
tr.ldf-highlight .title { color: inherit; }
.ldf-selfempty td { padding: 26px 12px !important; text-align: center; color: var(--ldf-muted); font-size: 13.5px; }
.ldf-selfempty a { color: var(--ldf-accent); margin-left: 6px; }
.ldf-btn:focus-visible, .ldf-icon-btn:focus-visible, .ldf-count-btn:focus-visible, .ldf-tab:focus-visible, .ldf-mini:focus-visible, .ldf-drawer-close:focus-visible, .ldf-modal-close:focus-visible, .ldf-switch input:focus-visible + .ldf-slider, .ldf-seg label:has(input:focus-visible) { outline: 2px solid var(--ldf-accent); outline-offset: 1px; }
@media (prefers-reduced-motion: reduce) {
  .ldf-drawer-panel, .ldf-drawer-overlay, .ldf-toast, .ldf-btn, .ldf-icon-btn, .ldf-count-btn, .ldf-tab, .ldf-mini, .ldf-slider, .ldf-slider::after { transition: none; }
}
@media (max-width: 640px) {
  #ldf-modal { padding: 0; }
  .ldf-modal-box { max-height: 100vh; min-height: 100vh; border-radius: 0; width: 100%; border: 0; }
  .ldf-drawer-panel { width: 100vw; }
}
`;
