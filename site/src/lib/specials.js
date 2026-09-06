// 专题配置:每个专题是一条正交的内容主线,由匹配规则从全库自动聚合论文
export const SPECIALS = [
  {
    key: 'satellite',
    title: '量子计算与卫星任务规划',
    en: 'Quantum × Satellite Mission Planning',
    icon: '🛰️',
    color: '#1d4ed8',
    desc: '卫星任务规划、对地观测调度、空间碎片清除等航天组合优化问题,正成为量子优化最具想象力的应用战场。本专题汇总该方向的建模方法、算法与硬件实验进展。',
    match: (p) => (p.domains || []).includes('satellite') ||
      /satellite|spacecraft|earth observation|space (debris|mission)|mission planning|遥感|卫星|航天/i.test(`${p.title} ${p.abstract || ''}`),
  },
  {
    key: 'llm',
    title: '量子计算与大模型',
    en: 'Quantum × LLM & AI',
    icon: '🤖',
    color: '#7e22ce',
    desc: '量子计算与人工智能、大语言模型的交叉前沿:量子机器学习、量子神经网络、大模型自动设计量子实验与优化启发式。这是本站持续追踪的重点专题。',
    match: (p) => (p.topics || []).includes('quantum-ai') || (p.topics || []).includes('llm4co') ||
      /large language model|\bLLMs?\b|quantum (machine learning|neural network)|\bQML\b/i.test(`${p.title} ${p.abstract || ''}`),
  },
];
