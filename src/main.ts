import { setApp, type AppContext } from './context';
import { getConfig, loadConfig, saveConfig } from './store';
import { compileRules, type CompiledState } from './engine';
import type { Host } from './intercept';
import { currentFilteredEntries, installInterceptors, syncCurrentPage } from './intercept';
import { injectStyles, toast } from './ui/common';
import { CSS } from './ui/styles';
import { ensureTopbar, installTopbarListeners, updateCount } from './ui/topbar';
import { openDrawer } from './ui/drawer';
import { openSettings } from './ui/settings';
import type { CategoryMap } from './page';

let catMap: CategoryMap | null = null;
let compiled: CompiledState = { rules: [], errors: new Map() };

function recompile(): void {
  const cfg = getConfig();
  compiled = compileRules(cfg.masterEnabled ? cfg.rules : [], catMap);
}

function boot(): void {
  injectStyles(CSS);
  loadConfig();
  recompile();

  const appImpl: AppContext = {
    getConfig,
    save() {
      saveConfig();
      recompile();
      updateCount();
    },
    recompile,
    getCatMap: () => catMap,
    getFiltered: () => currentFilteredEntries(),
    exemptTopic(id: number) {
      const cfg = getConfig();
      if (!cfg.exemptions.topicIds.includes(id)) cfg.exemptions.topicIds.push(id);
      saveConfig();
      toast('已豁免此帖：下次刷新后不再被过滤');
    },
    openDrawer,
    openSettings,
    toast,
    refreshCount: () => updateCount(),
    ruleErrors: () => compiled.errors,
  };
  setApp(appImpl);

  const host: Host = {
    getConfig,
    getState: () => compiled,
    getCatMap: () => catMap,
    setCatMap(m) {
      catMap = m;
    },
    onCatMapReady() {
      recompile();
    },
    onBucketChange() {
      updateCount();
    },
    log: (...args: unknown[]) => {
      if (getConfig().debug) console.log('%c[LD-SF]', 'color:#3aa', ...args);
    },
  };

  installTopbarListeners();
  void installInterceptors(host);

  const onReady = (): void => {
    syncCurrentPage();
    ensureTopbar();
    if (getConfig().debug) console.log('%c[LD-SF]', 'color:#3aa', '启动完成 v' + __LDF_VERSION__);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', onReady, { once: true });
  else onReady();

  try {
    GM_registerMenuCommand('打开 LinuxDo 智能降噪设置', openSettings);
    GM_registerMenuCommand('查看已过滤列表', openDrawer);
    GM_registerMenuCommand('暂停 / 启用降噪', () => {
      const cfg = getConfig();
      cfg.masterEnabled = !cfg.masterEnabled;
      saveConfig();
      recompile();
      updateCount();
      toast('降噪已' + (cfg.masterEnabled ? '启用' : '暂停') + '，刷新页面后生效');
    });
  } catch {
    /* menu command unavailable */
  }
}

boot();
