// 专题配置:每个专题是一条正交的内容主线,由匹配规则从全库自动聚合论文
// 2026-09-29 卫星专题人工审计:仅收量子计算(含量子启发)做任务规划/调度/轨迹/星座设计/资源分配的论文。
// 量子计算×卫星遥感数据处理(非任务规划)保留在文献库但不进本专题:
const SAT_PLANNING_EXCLUDE = new Set([
  'quantum-information-empowered-graph-neural-network-hyperspectral-91f3a', // 量子GNN高光谱变化检测
  'kernel-approximation-quantum-annealer-remote-sensing-regression-636fb', // QA核逼近遥感回归
  'hybrid-quantum-deep-learning-superpixel-encoding-earth-8e268', // 混合量子DL对地观测分类
  'quantum-annealing-remote-sensing-data-processing-review-523cf', // QA遥感数据处理综述
  'hybrid-quantum-inspired-intelligent-computing-model-real-ed75e', // 气候数据量子启发模型
]);
export const SPECIALS = [
  {
    key: 'satellite',
    title: '量子计算与卫星任务规划',
    en: 'Quantum × Satellite Mission Planning',
    icon: '🛰️',
    color: '#1d4ed8',
    desc: '卫星任务规划、对地观测调度、空间碎片清除等航天组合优化问题,正成为量子优化最具想象力的应用战场。本专题汇总该方向的建模方法、算法与硬件实验进展(经人工审核,剔除无量子方法与量子通信类论文)。',
    // domains-only 判定:domains 由 build_db 自动推导并经量子相关性护栏审计,
    // 不再用标题正则兜底,防止纯经典调度、量子通信与遥感数据处理类论文混入。
    match: (p) => !SAT_PLANNING_EXCLUDE.has(p.id) && (p.domains || []).includes('satellite'),
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
