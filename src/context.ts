import type { CategoryMap } from './page';
import type { Config, FilteredEntry } from './types';

export interface AppContext {
  getConfig(): Config;
  save(): void;
  recompile(): void;
  getCatMap(): CategoryMap | null;
  getFiltered(): FilteredEntry[];
  exemptTopic(id: number): void;
  openDrawer(): void;
  openSettings(): void;
  toast(msg: string): void;
  refreshCount(): void;
  ruleErrors(): Map<string, string>;
}

let current: AppContext | null = null;

export function setApp(a: AppContext): void {
  current = a;
}

export function app(): AppContext {
  if (!current) throw new Error('app not initialized');
  return current;
}
