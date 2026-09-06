// 周期(周/月)分组工具
export function isoWeekOf(dateStr) {
  if (!dateStr) return null;
  const dt = new Date(dateStr + 'T12:00:00Z');
  if (isNaN(dt)) return null;
  const day = (dt.getUTCDay() + 6) % 7; // 周一=0
  const thursday = new Date(dt);
  thursday.setUTCDate(dt.getUTCDate() - day + 3);
  const year = thursday.getUTCFullYear();
  const jan1 = new Date(Date.UTC(year, 0, 1));
  const week = Math.floor((thursday - jan1) / (7 * 86400000)) + 1;
  return { year, week, key: `${year}-W${String(week).padStart(2, '0')}` };
}

export function weekRangeOf(year, week) {
  const jan1 = new Date(Date.UTC(year, 0, 1));
  const offset = (jan1.getUTCDay() + 6) % 7;
  const monday = new Date(jan1);
  monday.setUTCDate(1 - offset + (week - 1) * 7);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  const fmt = (d) => d.toISOString().slice(0, 10);
  return [fmt(monday), fmt(sunday)];
}

export function groupByWeek(papers) {
  const map = new Map();
  for (const p of papers) {
    if (!p.date) continue;
    const w = isoWeekOf(p.date);
    if (!w) continue;
    if (!map.has(w.key)) {
      const [r0, r1] = weekRangeOf(w.year, w.week);
      map.set(w.key, { key: w.key, year: w.year, week: w.week, range: [r0, r1], papers: [] });
    }
    map.get(w.key).papers.push(p);
  }
  return [...map.values()].sort((a, b) => (a.key < b.key ? 1 : -1));
}

export function groupByMonth(papers) {
  const map = new Map();
  for (const p of papers) {
    if (!p.date) continue;
    const m = p.date.slice(0, 7);
    if (!map.has(m)) map.set(m, { key: m, papers: [] });
    map.get(m).papers.push(p);
  }
  return [...map.values()].sort((a, b) => (a.key < b.key ? 1 : -1));
}

export function monthLabel(ym) {
  const [y, m] = ym.split('-');
  return `${y} 年 ${Number(m)} 月`;
}

export function weekRangeText(year, week, range) {
  return `${range[0]} ~ ${range[1]}`;
}

// 自动生成"本期主线"叙述
export function mainLineText(periodLabel, stats) {
  const { total, topicNames, topPaper, domains } = stats;
  let s = `${periodLabel}共收录 ${total} 篇论文`;
  if (topicNames.length) s += `,研究热点集中在「${topicNames.slice(0, 3).join('」「')}」等方向`;
  if (domains.length) s += `,应用层面覆盖${domains.slice(0, 3).join('、')}`;
  s += '。';
  if (topPaper) s += `本期最受关注的工作为《${topPaper.titleZh}》(被引 ${topPaper.citations} 次)。`;
  return s;
}
