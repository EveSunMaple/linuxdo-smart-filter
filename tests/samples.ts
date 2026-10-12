export interface Sample {
  title: string;
  category: string;
  tags: string[];
  expect: 'filter' | 'keep' | 'highlight';
  note?: string;
  needShortAsk?: boolean;
}

export const CATEGORY_IDS: Record<string, number> = {
  开发调优: 4,
  搞七捻三: 36,
  资源分享: 14,
  福利羊毛: 33,
  综合讨论: 1,
};

export const CATEGORY_CHILDREN: Record<string, number[]> = {
  开发调优: [41, 42, 43],
  搞七捻三: [37, 38],
};

export const SAMPLES: Sample[] = [
  {
    title: 'Codex 账号采购方案求助：5 个 Pro100 分散账号 vs 1 个 Pro500 主号',
    category: '开发调优',
    tags: ['快问快答', '人工智能'],
    expect: 'filter',
    note: '开发调优·求助降噪（提问词≥2）+ 账号咨询',
  },
  {
    title: '咸鱼上的GeminiPro账号 能使用Gemini cli吗?',
    category: '搞七捻三',
    tags: ['快问快答', '人工智能'],
    expect: 'filter',
    note: 'AI标签·求助降噪（问句结尾）',
  },
  {
    title: '寻求主机配置高手!',
    category: '开发调优',
    tags: [],
    expect: 'filter',
    note: '开发调优·求助降噪（寻求+高手）',
  },
  {
    title: '【公益推广】千刀兄开启美好10月，炸弹车正在飞奔！已开放 开启千刀狂欢~公益站猛猛开起',
    category: '资源分享',
    tags: ['人工智能', 'ChatGPT', 'OpenAI', '公益推广'],
    expect: 'filter',
    note: '推广标签过滤',
  },
  {
    title: '怎么反制楼上租户制造噪音，沟通了效果不大',
    category: '搞七捻三',
    tags: ['快问快答', '病友'],
    expect: 'filter',
    note: '快问快答 + 提问词',
  },
  {
    title: '我的gemini是不是生病了',
    category: '搞七捻三',
    tags: ['纯水', 'Antigravity'],
    expect: 'filter',
    note: '纯水标签硬过滤',
  },
  {
    title: '洪恩识字号被封了，给佬们提个醒',
    category: '搞七捻三',
    tags: ['纯水'],
    expect: 'filter',
    note: '纯水标签硬过滤',
  },
  {
    title: 'Mac、Linux、WSL该如何选',
    category: '开发调优',
    tags: ['纯水'],
    expect: 'filter',
    note: '纯水标签 / 提问词≥2',
  },
  {
    title: '记录My Claude第一天及居然撬开了！！',
    category: '搞七捻三',
    tags: ['纯水'],
    expect: 'filter',
    note: '纯水标签硬过滤',
  },
  {
    title: '如果想高性价比尽可能使用opus5.5，各位佬有没有什么推荐方案?',
    category: '搞七捻三',
    tags: ['人工智能'],
    expect: 'filter',
    note: 'AI标签 + 提问词 / 账号咨询',
  },
  {
    title: '中国护照 claude kyc',
    category: '搞七捻三',
    tags: ['人工智能', 'Claude'],
    expect: 'filter',
    note: '主题词堆叠（护照+kyc）',
  },
  {
    title: 'wise和ifast用途咨询',
    category: '搞七捻三',
    tags: ['人工智能'],
    expect: 'filter',
    note: 'AI标签 + 提问词（咨询）',
  },
  {
    title: 'Plus账号没有降智，但是额度一次比一次少，这对吗?',
    category: '开发调优',
    tags: ['人工智能'],
    expect: 'filter',
    note: 'AI标签 + 提问词',
  },
  {
    title: '开源项目 FooBar 发布 v2.0：支持多账号批量管理',
    category: '开发调优',
    tags: ['开源', '人工智能'],
    expect: 'highlight',
    note: '保护优先：不误杀开源项目',
  },
  {
    title: '分享一个自建 Claude 镜像站（附部署教程）',
    category: '开发调优',
    tags: ['人工智能'],
    expect: 'highlight',
    note: '保护优先：分享/教程信号',
  },
  {
    title: '【避坑指南】这些 AI 账号商家不要买',
    category: '搞七捻三',
    tags: ['人工智能'],
    expect: 'highlight',
    note: '保护优先：避坑指南',
  },
  {
    title: 'Claude Code 与 Codex 的上下文管理机制差异',
    category: '开发调优',
    tags: ['人工智能'],
    expect: 'keep',
    note: '正常技术讨论：无求助词、无消费主题词，保留',
  },
];
