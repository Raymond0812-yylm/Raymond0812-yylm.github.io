// 站点公共工具函数
export const SITE_NAME = '量子优化日报';
export const SITE_NAME_EN = 'QuantOpt Daily';
export const SITE_TAGLINE = '量子计算 × 组合优化 × 智能优化算法 —— 每日追踪领域最新论文与研究进展';

export const TOPIC_ORDER = ['qaoa', 'annealing', 'vqa', 'qinspired', 'hybrid', 'hardware', 'quantum-ai', 'quantum'];

export const DOMAIN_ORDER = ['satellite', 'finance', 'energy', 'logistics', 'manufacturing', 'telecom', 'transport', 'pharma', 'materials', 'it-cloud'];

export const DOMAIN_ICON = {
  satellite: '🛰️', finance: '💰', energy: '⚡', logistics: '🚚', manufacturing: '🏭',
  telecom: '📡', transport: '🚗', pharma: '💊', materials: '🧪', 'it-cloud': '💻',
};

export const TOPIC_COLOR = {
  qaoa: '#4338ca',
  annealing: '#c2410c',
  vqa: '#0f766e',
  qinspired: '#c026d3',
  hybrid: '#7e22ce',
  hardware: '#a16207',
  'quantum-ai': '#0891b2',
  quantum: '#1d4ed8',
  ml4co: '#047857',
  llm4co: '#e11d48',
};

const TOP_VENUES = /nature|science|physical review letters|prx quantum|prx |quantum$|npj|reviews of modern physics|proceedings of the national academy|communications physics|nature communications|nature physics|neurips|icml|iclr|acm computing surveys|journal of machine learning research|european journal of operational research|ieee transactions/i;

export function isTopVenue(v) {
  return TOP_VENUES.test(v || '');
}

export function fmtDate(d) {
  return d || '';
}

export function fmtAuthors(list, max = 3) {
  if (!list || !list.length) return '作者信息见原文';
  if (list.length <= max) return list.join(', ');
  return list.slice(0, max).join(', ') + ` 等 ${list.length} 人`;
}

export function fmtCites(n) {
  if (n === null || n === undefined) return '';
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n);
}

export function topicLabel(topics, key) {
  return topics?.[key]?.label || key;
}

export function groupByMonth(reports) {
  const map = new Map();
  for (const r of reports) {
    const m = r.date.slice(0, 7);
    if (!map.has(m)) map.set(m, []);
    map.get(m).push(r);
  }
  return [...map.entries()];
}

export function monthLabel(ym) {
  const [y, m] = ym.split('-');
  return `${y} 年 ${Number(m)} 月`;
}

export function searchBlob(p) {
  return [p.title, p.titleZh, ...(p.authors || []), p.venue, p.summaryZh, p.arxivId]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function escapeXml(s) {
  return String(s ?? '').replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
}
