declare function GM_getValue<T>(key: string, defaultValue?: T): T;
declare function GM_setValue(key: string, value: unknown): void;
declare function GM_registerMenuCommand(name: string, fn: () => void, accessKey?: string): number;
declare function GM_addStyle(css: string): HTMLStyleElement;

declare const __LDF_VERSION__: string;
