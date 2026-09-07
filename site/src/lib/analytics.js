// 论文库分析:趋势、分布、作者与合作网络(构建时计算,随库更新自动刷新)

export function monthlyTrend(papers) {
  const m = {};
  for (const p of papers) {
    if (!p.date) continue;
    const k = p.date.slice(0, 7);
    m[k] = (m[k] || 0) + 1;
  }
  return Object.entries(m).sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([month, count]) => ({ month, count }));
}

export function distOf(items, keyFn, labels) {
  const c = {};
  for (const it of items) for (const k of keyFn(it) || []) c[k] = (c[k] || 0) + 1;
  return Object.entries(c)
    .map(([k, v]) => ({ key: k, label: labels?.[k]?.label ?? k, value: v }))
    .sort((a, b) => b.value - a.value);
}

export function topCited(papers, n = 5) {
  return [...papers].filter((p) => p.citations).sort((a, b) => b.citations - a.citations).slice(0, n);
}

export function yearDist(papers) {
  const c = {};
  for (const p of papers) if (p.year) c[p.year] = (c[p.year] || 0) + 1;
  return Object.entries(c).map(([year, count]) => ({ year: Number(year), count })).sort((a, b) => a.year - b.year);
}

const STOP = new Set(['for', 'the', 'and', 'with', 'of', 'on', 'in', 'to', 'a', 'an', 'via', 'using', 'based', 'from', 'by', 'at', 'its', 'their', 'toward', 'towards', 'approach', 'method', 'methods', 'study', 'research', 'novel', 'application', 'applications', 'problem', 'problems', 'optimization', 'optimal', 'quantum', 'computing', 'computer', 'towards', 'learning', 'machine', 'deep', 'neural', 'network', 'networks', 'system', 'systems', 'model', 'models', 'algorithm', 'algorithms', 'framework', 'review', 'survey', 'analysis', 'efficient', 'enhanced', 'improved', 'new']);

export function titleKeywords(papers, topn = 12) {
  const c = {};
  for (const p of papers) {
    const words = (p.title || '').toLowerCase().match(/[a-z][a-z0-9-]{2,}/g) || [];
    for (const w of words) {
      if (STOP.has(w)) continue;
      c[w] = (c[w] || 0) + 1;
    }
  }
  return Object.entries(c).filter(([, v]) => v >= 2).sort((a, b) => b[1] - a[1]).slice(0, topn).map(([w, v]) => ({ word: w, count: v }));
}

export function authorStats(papers) {
  const a = {};
  for (const p of papers) {
    for (const name of p.authors || []) {
      if (!a[name]) a[name] = { name, count: 0, cites: 0, papers: [] };
      a[name].count += 1;
      a[name].cites += p.citations || 0;
      a[name].papers.push(p);
    }
  }
  return Object.values(a);
}

export function topAuthors(papers, n = 8) {
  return authorStats(papers).sort((a, b) => (b.count - a.count) || (b.cites - a.cites)).slice(0, n);
}

export function coAuthorPairs(papers, names = null, minCount = 1) {
  const allow = names ? new Set(names) : null;
  const pairs = {};
  for (const p of papers) {
    const au = (p.authors || []).filter((x) => !allow || allow.has(x));
    for (let i = 0; i < au.length; i++) {
      for (let j = i + 1; j < au.length; j++) {
        const key = [au[i], au[j]].sort().join('||');
        if (!pairs[key]) pairs[key] = { a: au[i], b: au[j], count: 0 };
        pairs[key].count += 1;
      }
    }
  }
  return Object.values(pairs).filter((x) => x.count >= minCount).sort((a, b) => b.count - a.count);
}
