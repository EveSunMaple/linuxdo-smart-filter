import type { Rule } from './types';

export const RULE_COLORS = ['#2f9e44', '#1971c2', '#f08c00', '#e8590c', '#9c36b5', '#0c8599'];

export function defaultPresets(): Rule[] {
  return [
    {
      id: 'preset-tag-pure',
      name: '纯水标签硬过滤',
      preset: true,
      enabled: true,
      mode: 'filter',
      shieldable: false,
      when: { tagsAny: ['纯水', '灌水', '无意义'] },
    },
    {
      id: 'preset-tag-promo',
      name: '推广/福利标签过滤',
      preset: true,
      enabled: true,
      mode: 'filter',
      when: { tagsAny: ['公益推广', '广告', '抽奖'] },
    },
    {
      id: 'preset-dev-ask',
      name: '开发调优·求助降噪',
      preset: true,
      enabled: true,
      mode: 'filter',
      when: { categoryNames: ['开发调优'], minAsk: 2 },
    },
    {
      id: 'preset-ai-ask',
      name: 'AI标签·求助降噪',
      preset: true,
      enabled: true,
      mode: 'filter',
      when: { tagsAny: ['人工智能', '快问快答'], minAsk: 1 },
    },
    {
      id: 'preset-account-ask',
      name: '账号/消费咨询降噪',
      preset: true,
      enabled: true,
      mode: 'filter',
      when: { minAsk: 1, minBuzz: 1 },
    },
    {
      id: 'preset-buzz-stack',
      name: '主题词堆叠降噪',
      preset: true,
      enabled: true,
      mode: 'filter',
      when: { minBuzz: 2, titleMaxLen: 24 },
    },
    {
      id: 'preset-short-ask',
      name: '短问句降噪（谨慎）',
      preset: true,
      enabled: false,
      mode: 'filter',
      when: { categoryNames: ['开发调优', '搞七捻三'], minAsk: 1, titleMaxLen: 14 },
    },
    {
      id: 'preset-shield-word',
      name: '优质信号保护高亮',
      preset: true,
      enabled: true,
      mode: 'highlight',
      color: '#2f9e44',
      when: { minShield: 1 },
    },
    {
      id: 'preset-shield-tag',
      name: '开源/教程标签保护高亮',
      preset: true,
      enabled: true,
      mode: 'highlight',
      color: '#1971c2',
      when: { tagsAny: ['开源', '开源项目', '教程', '分享', '资源分享'] },
    },
  ];
}

export function newRuleId(): string {
  return 'rule-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
}
