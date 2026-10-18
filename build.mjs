import { mkdirSync, readFileSync } from 'node:fs';
import { build, context } from 'esbuild';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

const meta = `// ==UserScript==
// @name         LinuxDo Smart Filter
// @name:zh-CN   LinuxDo 智能降噪过滤器
// @namespace    https://github.com/EveSunMaple
// @version      ${pkg.version}
// @description  Filter low-value topics on linux.do by category/tags/title triage, with whitelist protection for quality posts
// @description:zh-CN  按板块/标签/标题内容分诊过滤 linux.do 低信息量主题，优质帖保护高亮，支持预设与自定义规则
// @author       EveSunMaple
// @license      Apache-2.0
// @match        https://linux.do/*
// @run-at       document-start
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_addStyle
// @noframes
// @updateURL    https://raw.githubusercontent.com/EveSunMaple/linuxdo-smart-filter/main/dist/linuxdo-smart-filter.user.js
// @downloadURL  https://raw.githubusercontent.com/EveSunMaple/linuxdo-smart-filter/main/dist/linuxdo-smart-filter.user.js
// ==/UserScript==
`;

const options = {
  entryPoints: ['src/main.ts'],
  bundle: true,
  format: 'iife',
  target: ['es2021'],
  outfile: 'dist/linuxdo-smart-filter.user.js',
  banner: { js: meta },
  legalComments: 'none',
  charset: 'utf8',
  logLevel: 'info',
  define: { __LDF_VERSION__: JSON.stringify(pkg.version) },
};

mkdirSync('dist', { recursive: true });

if (process.argv.includes('--watch')) {
  const ctx = await context(options);
  await ctx.watch();
  console.log('watching...');
} else {
  await build(options);
}
