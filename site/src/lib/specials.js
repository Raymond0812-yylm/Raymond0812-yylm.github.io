// 专题配置:每个专题是一条正交的内容主线,由匹配规则从全库自动聚合论文
// 2026-09-29 卫星专题收录标准收窄(经人工审计):仅收录
//   「卫星任务规划/调度/成像获取问题本身 + 真量子计算求解(量子退火/QAOA/门型)+ 完整研究」
// 三条件齐备的论文。量子启发算法、量子通信、遥感数据处理、星座设计、综述等
// 即使与卫星相关也不进本专题(部分保留在文献库)。
// 新论文入库后需人工审核并加入下方收录表才会出现在专题页。
const SAT_CURATED = new Set([
  // 奠基与基准
  'quantum-optimization-methods-satellite-mission-planning-05875', // 卫星任务规划的量子优化方法(2024 IEEE Access,系统性QUBO建模,被引最高)
  'quantum-algorithms-applied-satellite-mission-planning-earth-c15e1', // 应用于对地观测卫星任务规划的量子算法(2023 IEEE JSTQE,60引用)
  // 退火硬件实验
  'agile-earth-observation-satellite-scheduling-quantum-annealer-226ee', // 量子退火机求解敏捷EO卫星调度(2021 IEEE TAES,D-Wave 2000Q对比研究)
  'image-acquisition-planning-earth-observation-satellites-quantum-e9da5', // 量子退火成像获取规划(2020 arXiv,已知最早)
  // 混合求解
  'hybrid-classical-quantum-computing-approach-satellite-mission-13c31', // SMPP经典-量子混合求解(2023)
  'optimization-image-acquisition-earth-observation-satellites-quantum-f4163', // 成像获取优化(LNCS 2023)
]);
export const SPECIALS = [
  {
    key: 'satellite',
    title: '量子计算与卫星任务规划',
    en: 'Quantum × Satellite Mission Planning',
    icon: '🛰️',
    color: '#1d4ed8',
    desc: '把对地观测卫星的任务规划/调度/成像获取问题形式化为 QUBO,用量子退火与 QAOA 求解——本专题只收录「问题建模 + 真量子求解 + 实验」三要素齐备的方法论文(每篇均经人工审核),是可直接借鉴建模与实验设计的核心文献集。',
    // 人工核定收录表判定:宁缺毋滥,杜绝自动扩库噪音
    match: (p) => SAT_CURATED.has(p.id),
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
