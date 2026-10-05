// 构建站点数据:读取工作区根目录的 papers-db.json(回溯论文库)、每日日报 Markdown
// (支持一天多篇:`## 论文一：` 分节)与行业动态 Markdown(news-YYYY-MM-DD.md),
// 合并为 src/data/site.json。每日定时任务只需照旧生成 .md,再运行 `npm run build` 即可自动入库。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITE_DIR = path.resolve(__dirname, '..');
const ROOT = path.resolve(SITE_DIR, '..');
const DB_PATH = path.join(ROOT, 'papers-db.json');
const OUT_DIR = path.join(SITE_DIR, 'src', 'data');
const OUT = path.join(OUT_DIR, 'site.json');

const TOPIC_RULES = [
  ['quantum-ai', /quantum (machine learning|neural network|deep learning|reinforcement learning)|quantum[- ]enhanced (machine )?learning|\bQML\b|quantum.{0,30}large language|large language.{0,30}quantum|量子机器学习|量子神经网络|量子.{0,12}大模型/i],
  ['llm4co', /\blarge language model\b|\bLLMs?\b|语言模型|大模型|FunSearch|ReEvo|AlphaEvolve/i],
  ['ml4co', /neural combinatorial|graph neural|learning to branch|reinforcement learning|指针网络|图神经网络|神经组合优化/i],
  ['qaoa', /\bQAOA\b|quantum approximate optimization|quantum alternating operator|量子近似优化/i],
  ['vqa', /variational quantum|\bVQE\b|barren plateau|变分量子|贫瘠高原/i],
  ['annealing', /quantum anneal|annealer|adiabatic quantum|reverse annealing|量子退火|绝热量子|transverse[- ]field ising/i],
  ['hardware', /superconducting (qubit|processor|quantum)|trapped[- ]ion|\brydberg\b|neutral atom|photonic quantum|spin qubit|quantum (processor|hardware|chip)|超导量子|离子阱|中性原子|光量子|里德堡/i],
  ['qinspired', /quantum[- ]inspired|量子启发|ising machine|simulated bifurcation|coherent ising|quantum (particle swarm|differential evolution|evolutionary|swarm|memetic)|量子粒子群|量子差分进化|量子演化/i],
  ['hybrid', /hybrid quantum|quantum-classical|混合量子|量子[- ]经典/i],
  ['quantum', /review|survey|benchmark|perspective|综述|基准/i],
];

const DOMAIN_RULES = [
  ['satellite', /satellite|spacecraft|earth observation|mission planning|aerospace|remote sensing|卫星|航天|任务规划|遥感/i],
  ['finance', /portfolio|\bfinanc|credit|trading|risk management|投资组合|金融|信贷/i],
  ['energy', /power system|smart grid|microgrid|renewable|energy (management|dispatch|optimization|scheduling)|carbon emission|电网|微网|电力|能源|碳排放/i],
  ['logistics', /vehicle routing|supply chain|logistics|warehouse|inventory|shipping|fleet|物流|供应链|仓储|库存|车队/i],
  ['manufacturing', /job shop|production schedul|manufactur|assembly line|process planning|生产调度|制造|车间|工艺/i],
  ['telecom', /wireless|telecommunication|network routing|\b5G\b|\b6G\b|MIMO|base station|spectrum|通信|无线|基站|频谱/i],
  ['transport', /traffic|railway|subway|urban air mobility|autonomous driving|intelligent transport|交通|轨道交通|自动驾驶/i],
  ['pharma', /\bdrug\b|docking|protein|genom|molecular design|药物|对接|蛋白质|基因|分子设计/i],
  ['materials', /material|catalyst|chemistry|battery|材料|催化|化学|电池/i],
  ['it-cloud', /cloud computing|task offload|edge computing|data center|\bIoT\b|云计算|任务卸载|边缘计算|数据中心|物联网/i],
];

const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 70);
const stripMd = (s) => (s || '').replace(/\*\*|__|`/g, '').replace(/<([^>]+)>/g, '$1').trim();

function slugify(title, key) {
  const stop = new Set(['a', 'an', 'the', 'of', 'for', 'and', 'on', 'in', 'with', 'to', 'using', 'via', 'by', 'its', 'at']);
  const words = (title.toLowerCase().match(/[a-z0-9]+/g) || []).filter((w) => !stop.has(w)).slice(0, 7);
  let h = 0;
  for (const ch of key || title) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `${words.join('-') || 'paper'}-${h.toString(16).slice(0, 5)}`;
}

function inferTopics(text) {
  const t = TOPIC_RULES.filter(([, re]) => re.test(text)).map(([k]) => k);
  return t.length ? t : ['quantum'];
}

function inferDomains(text) {
  return DOMAIN_RULES.filter(([, re]) => re.test(text)).map(([k]) => k).slice(0, 3);
}

const stripParens = (s) => {
  let prev;
  do { prev = s; s = s.replace(/（[^（）]*）|\([^()]*\)/g, ''); } while (s !== prev);
  return s;
};

// ---------- 从一组 Markdown 行中解析单篇论文信息 ----------
function parsePaperFromLines(allLines) {
  // 只在正文信息区解析,避免误读附录中"备选/候选论文"的作者、编号等
  let cut = allLines.findIndex((l) => /^##\s/.test(l) && /(附|候选|备选|检索与筛选|溯源|速览|其他相关)/.test(l));
  if (cut < 0) cut = allLines.length;
  const lines = allLines.slice(0, cut);

  const field = (labels) => {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const label of labels) {
        if (!line.includes(label)) continue;
        if (line.trim().startsWith('|')) {
          if (/^\|?\s*:?-{2,}/.test((lines[i + 1] || '').trim())) continue; // 表头行,跳过
          const cells = line.split('|').map((c) => stripMd(c)).filter((c) => c.length);
          if (cells.length >= 2 && cells[0].replace(/[\s:：]/g, '') === label) return cells[1];
        } else {
          const m = line.match(new RegExp(`${label}\\**\\s*[：:]\\s*(.+)$`));
          if (m) return stripMd(m[1]);
        }
      }
    }
    return '';
  };

  const sectionLines = (keyword, scope = lines) => {
    const start = scope.findIndex((l) => /^#{2,4}\s/.test(l) && l.includes(keyword));
    if (start < 0) return [];
    const out = [];
    for (let i = start + 1; i < scope.length; i++) {
      if (/^#{2,4}\s/.test(scope[i])) break;
      out.push(scope[i]);
    }
    return out;
  };

  const titleEn = field(['英文标题']) || stripMd((lines.find((l) => /^#\s/.test(l)) || '').replace(/^#\s*/, ''));
  const titleZh = field(['中文标题', '中文译名']);
  let venue = field(['发表平台/期刊名称及时间', '发表平台', '期刊']);
  if (!venue) {
    const sec = sectionLines('发表平台');
    const m = sec.map((l) => l.match(/发表平台\**\s*[：:]\s*(.+)/)).find(Boolean);
    venue = m ? stripMd(m[1]) : 'arXiv 预印本';
  }
  venue = venue.replace(/（.*$/, '').replace(/\(.*$/, '').replace(/;.*$/, '').replace(/；.*$/, '').trim() || 'arXiv 预印本';
  if (/^arXiv/i.test(venue)) venue = 'arXiv 预印本';

  let authors = [];
  const authorSec = sectionLines('作者');
  const authorRows = authorSec.filter((l) => l.trim().startsWith('|') && !/^\|\s*:?-+/.test(l.trim()) && !/^\|\s*作者\s*\|/.test(l.trim()));
  if (authorRows.length) {
    authors = authorRows.map((r) => stripMd(r.split('|').filter((c) => c.trim())[0] || '')).filter(Boolean);
  } else {
    const authorsField = field(['作者列表', '作者']);
    authors = stripParens(authorsField).split(/[、,，;；]/).map((a) => a.trim()).filter((a) => a && !/^(等|et al\.?)$/i.test(a));
  }

  let arxivId = '';
  const idLine = lines.find((l) => l.includes('arXiv 编号') || l.includes('arXiv编号'));
  const mm = (idLine || '').match(/(\d{4}\.\d{4,5})/);
  if (mm) arxivId = mm[1];
  if (!arxivId) {
    const joined = allLines.join('\n');
    const m2 = joined.match(/arxiv\.org\/abs\/(\d{4}\.\d{4,5})/i) || joined.match(/arXiv[:：]\s*(\d{4}\.\d{4,5})/);
    if (m2) arxivId = m2[1];
  }

  const summarize = (sec) => {
    let s = '';
    for (const l of sec) {
      const t = stripMd(l.replace(/^[-*>\d.\s]+/, ''));
      if (!t) { if (s) break; else continue; }
      s += t;
      if (s.length > 220) break;
    }
    return s.replace(/\s+/g, ' ').trim();
  };
  // 摘要优先取"研究背景与动机";多论文简报格式则回退到"内容简评"等任何正文小节
  let summary = summarize(sectionLines('研究背景与动机'));
  if (!summary) summary = summarize(sectionLines('内容简评'));
  if (!summary) summary = summarize(sectionLines('摘要'));
  if (!summary) {
    const anySec = lines.findIndex((l) => /^#{2,4}\s/.test(l));
    if (anySec >= 0) summary = summarize(lines.slice(anySec + 1));
  }
  if (summary.length > 260) summary = summary.slice(0, 258) + '…';

  return { titleEn, titleZh: titleZh || titleEn, venue, authors, arxivId, summaryZh: summary };
}

// ---------- 解析日报 Markdown(支持一天多篇) ----------
function splitPaperSections(allLines) {
  const starts = [];
  allLines.forEach((l, i) => {
    if (/^#{1,3}\s*论文\s*(一|二|三|四|五|六|[1-9])[：:、\s]/.test(l.trim()) && !/标题/.test(l)) starts.push(i);
  });
  if (starts.length === 0) return null;
  const secs = [];
  for (let i = 0; i < starts.length; i++) {
    const end = i + 1 < starts.length ? starts[i + 1] : allLines.length;
    secs.push(allLines.slice(starts[i], end));
  }
  return secs;
}

function parseReport(file) {
  const md = fs.readFileSync(path.join(ROOT, file), 'utf-8');
  const allLines = md.split(/\r?\n/);
  const date = file.slice(0, 10);
  const secs = splitPaperSections(allLines);
  const papers = secs ? secs.map(parsePaperFromLines).filter((p) => p.titleEn) : [parsePaperFromLines(allLines)].filter((p) => p.titleEn);
  return { date, file, papers: papers.length ? papers : [{ titleEn: file, titleZh: file, venue: 'arXiv 预印本', authors: [], arxivId: '', summaryZh: '' }], markdown: md };
}

// ---------- 解析行业动态 Markdown(news-YYYY-MM-DD.md) ----------
function parseNews(file) {
  const md = fs.readFileSync(path.join(ROOT, file), 'utf-8');
  const lines = md.split(/\r?\n/);
  const date = file.replace(/^news-/i, '').replace(/\.md$/i, '');
  const starts = [];
  lines.forEach((l, i) => { if (/^##\s/.test(l)) starts.push(i); });
  const items = [];
  for (let i = 0; i < starts.length; i++) {
    const end = i + 1 < starts.length ? starts[i + 1] : lines.length;
    const sec = lines.slice(starts[i], end);
    const heading = stripMd(lines[starts[i]].replace(/^##\s*\d*[.、]?\s*/, ''));
    const f = (label) => {
      const line = sec.find((l) => l.includes(label));
      if (!line) return '';
      if (line.trim().startsWith('|')) {
        const cells = line.split('|').map((c) => stripMd(c)).filter(Boolean);
        return cells[1] || '';
      }
      return stripMd(line.split(/[：:]/).slice(1).join('：'));
    };
    const sumLine = sec.find((l) => l.includes('摘要'));
    let summary = sumLine ? stripMd(sumLine.replace(/^[-*>\s]*\**摘要\**\s*[：:]?\s*/, '')) : '';
    if (!summary) summary = (sec.filter((l) => l.trim() && !/^#/.test(l) && !/类别|来源|链接/.test(l)).map(stripMd).join(' ')).slice(0, 300);
    items.push({
      title: heading,
      region: f('地区') || '国际',
      category: f('类别') || '行业动态',
      source: f('来源'),
      url: (f('链接') || '').replace(/^https?\/\//, 'https://').replace(/：/g, ':'),
      summary,
    });
  }
  return { date, slug: date, count: items.length, items };
}

// ---------- 主流程 ----------
const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
const papers = db.papers.map((p) => ({ ...p, featured: false, reportDate: null }));
const byArxiv = new Map(papers.filter((p) => p.arxivId).map((p) => [p.arxivId, p]));
const byTitle = new Map(papers.map((p) => [norm(p.title), p]));
const usedSlugs = new Set(papers.map((p) => p.id));

const reportFiles = fs.readdirSync(ROOT).filter((f) => /^\d{4}-\d{2}-\d{2}-.+\.md$/i.test(f)).sort();
const reports = [];
const usedReportSlugs = new Set();
for (const file of reportFiles) {
  const r = parseReport(file);
  let rslug = r.date;
  for (let n = 2; usedReportSlugs.has(rslug); n++) rslug = `${r.date}-${n}`;
  usedReportSlugs.add(rslug);
  r.slug = rslug;

  const paperIds = [];
  for (const rp of r.papers) {
    let paper = (rp.arxivId && byArxiv.get(rp.arxivId)) || byTitle.get(norm(rp.titleEn));
    if (paper) {
      paper.featured = true;
      paper.reportDate = r.date;
      paper.reportSlug = rslug;
      if (!paper.summaryZh) paper.summaryZh = rp.summaryZh;
      if (!paper.titleZh) paper.titleZh = rp.titleZh;
    } else {
      let slug = slugify(rp.titleEn, rp.arxivId || rp.titleEn);
      while (usedSlugs.has(slug)) slug += 'x';
      usedSlugs.add(slug);
      const doi = rp.arxivId ? `10.48550/arXiv.${rp.arxivId}` : '';
      paper = {
        id: slug,
        title: rp.titleEn,
        titleZh: rp.titleZh,
        authors: rp.authors,
        venue: rp.venue,
        date: r.date,
        year: Number(r.date.slice(0, 4)),
        citations: null,
        arxivId: rp.arxivId,
        doi,
        url: rp.arxivId ? `https://arxiv.org/abs/${rp.arxivId}` : '',
      topics: inferTopics(`${rp.titleEn} ${rp.titleZh} ${rp.summaryZh}`),
      domains: inferDomains(`${rp.titleEn} ${rp.titleZh} ${rp.summaryZh}`),
      tags: ['recent'],
        summaryZh: rp.summaryZh,
        abstract: '',
        source: 'daily',
        featured: true,
        reportDate: r.date,
        reportSlug: rslug,
      };
      papers.push(paper);
      if (rp.arxivId) byArxiv.set(rp.arxivId, paper);
      byTitle.set(norm(rp.titleEn), paper);
    }
    paperIds.push(paper.id);
  }
  reports.push({
    date: r.date, slug: rslug, file: r.file, markdown: r.markdown,
    titleEn: r.papers[0].titleEn, titleZh: r.papers[0].titleZh,
    venue: r.papers[0].venue, authors: r.papers[0].authors,
    arxivId: r.papers.map((p) => p.arxivId).filter(Boolean).join(' / '),
    summaryZh: r.papers[0].summaryZh,
    paperIds,
    topics: papers.find((p) => p.id === paperIds[0]).topics,
    paperCount: paperIds.length,
  });
}
reports.sort((a, b) => (a.date < b.date ? 1 : -1));
papers.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
// 'quantum' 是兜底泛标签:仅当论文没有更具体的方向时才保留,避免"综述与基准"分类膨胀
for (const p of papers) {
  if (p.topics.length > 1 && p.topics.includes('quantum')) p.topics = p.topics.filter((t) => t !== 'quantum');
}
// 回溯库论文若无 domains 字段(旧数据),按规则补齐
for (const p of papers) {
  if (!Array.isArray(p.domains)) p.domains = inferDomains(`${p.title} ${p.titleZh} ${p.summaryZh} ${p.abstract}`);
}

// ---------- 行业动态 ----------
const newsFiles = fs.readdirSync(ROOT).filter((f) => /^news-\d{4}-\d{2}-\d{2}\.md$/i.test(f)).sort();
const news = newsFiles.map(parseNews).sort((a, b) => (a.date < b.date ? 1 : -1));

// ---------- 统一条目流(论文 + 行业动态)→ AIHOT 式 feed ----------
const TOPIC_LABELS = Object.fromEntries(Object.entries(db.topics || {}).map(([k, v]) => [k, typeof v === 'string' ? v : v.label || k]));
const DOMAIN_LABELS = Object.fromEntries(Object.entries(db.domains || {}).map(([k, v]) => [k, typeof v === 'string' ? v : v.label || k]));

const items = [];
for (const p of papers) {
  const url = p.url || (p.doi ? `https://doi.org/${p.doi}` : '');
  items.push({
    id: `p:${p.id}`, kind: 'paper', date: p.date,
    title: p.titleZh || p.title, titleEn: p.title,
    summary: p.summaryZh || (p.abstract || '').slice(0, 200),
    source: p.venue || 'arXiv 预印本', url,
    href: `/papers/${p.id}/`,
    selected: !!p.featured, score: p.citations ?? null,
    categories: ['papers'],
    tags: [...(p.topics || []).map((t) => TOPIC_LABELS[t] || t), ...(p.domains || []).map((t) => DOMAIN_LABELS[t] || t)].filter(Boolean).slice(0, 6),
  });
}
news.forEach((day) => day.items.forEach((it, i) => {
  items.push({
    id: `n:${day.date}:${i}`, kind: 'news', date: day.date,
    title: it.title, titleEn: '',
    summary: it.summary || '',
    source: it.source || '行业媒体', url: it.url || '',
    href: `/news/${day.date}/#n${i}`,
    selected: true, score: null,
    region: it.region || '国际', category: it.category || '行业动态',
    categories: ['news'],
    tags: [it.category, it.region === '国内' ? '国内' : '国际'].filter(Boolean),
    newsIdx: i,
  });
}));
items.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.id < b.id ? 1 : -1));

// ---------- 事件聚簇:跨天/跨源的动态按标题相似度归并(union-find) ----------
const bigrams = (s) => {
  const t = (s || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
  const out = new Set();
  for (let i = 0; i < t.length - 1; i++) out.add(t.slice(i, i + 2));
  for (const w of (s || '').toLowerCase().match(/[a-z0-9]{3,}/g) || []) out.add(w);
  return out;
};
const jaccard = (a, b) => {
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter || 1);
};
const dayDiff = (d1, d2) => Math.abs((new Date(d1) - new Date(d2)) / 86400000);
const hash12 = (s) => { let h = 0; for (const ch of s) h = (h * 131 + ch.charCodeAt(0)) >>> 0; return h.toString(36).padStart(8, '0') + s.length.toString(36); };

const newsItems = items.filter((it) => it.kind === 'news');
const grams = newsItems.map((it) => bigrams(`${it.title} ${(it.summary || '').slice(0, 80)}`));
const parent = newsItems.map((_, i) => i);
const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])));
for (let i = 0; i < newsItems.length; i++) {
  for (let j = i + 1; j < newsItems.length; j++) {
    if (dayDiff(newsItems[i].date, newsItems[j].date) > 10) continue;
    if (jaccard(grams[i], grams[j]) >= 0.34) parent[find(i)] = find(j);
  }
}
const clusters = new Map();
newsItems.forEach((it, i) => {
  const r = find(i);
  if (!clusters.has(r)) clusters.set(r, []);
  clusters.get(r).push(it);
});

// ---------- 热度:48~96h 窗口内独立条目 × 24h 半衰期;与上次构建快照差值得涨跌 ----------
const SNAP_PATH = path.join(SITE_DIR, 'scripts', 'cache', 'heat-snapshot.json');
let snap = { generatedAt: null, events: {} };
try { snap = JSON.parse(fs.readFileSync(SNAP_PATH, 'utf-8')); } catch {}
const nowMs = Date.now();
const events = [];
for (const members of clusters.values()) {
  members.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const canonical = members.reduce((best, it) => (((it.title + it.summary).length > (best.title + best.summary).length) ? it : best), members[0]);
  let heat = 0;
  for (const it of members) {
    const hours = (nowMs - new Date(it.date + 'T00:00:00Z')) / 3600000;
    if (hours < 0 || hours > 96) continue;
    heat += Math.pow(2, -hours / 24);
  }
  const eid = `e${hash12(members[0].title.toLowerCase().replace(/\s+/g, ''))}`;
  const prev = snap.events && snap.events[eid];
  let trend = 'new', deltaPct = null;
  if (prev && prev.heat > 0.05) {
    const ratio = heat / prev.heat;
    deltaPct = Math.round((ratio - 1) * 100);
    trend = ratio > 1.08 ? 'up' : ratio < 0.92 ? 'down' : 'flat';
  }
  const history = [...(prev && prev.history || []), Math.round(heat * 10) / 10].slice(-14);
  events.push({
    id: eid,
    title: canonical.title,
    summary: canonical.summary,
    latestSummary: members[members.length - 1].summary,
    firstDate: members[0].date, lastDate: members[members.length - 1].date,
    itemCount: members.length,
    sourceCount: new Set(members.map((m) => m.source)).size,
    sources: [...new Set(members.map((m) => m.source))].slice(0, 8),
    items: members.map((m) => ({ id: m.id, date: m.date, title: m.title, source: m.source, href: m.href, region: m.region, url: m.url })),
    heat: Math.round(heat * 10) / 10,
    trend, deltaPct, history,
  });
}
events.sort((a, b) => b.heat - a.heat || b.itemCount - a.itemCount);
const hot = events.filter((e) => e.heat >= 0.15).slice(0, 60).map((e, i) => ({
  rank: i + 1, id: e.id, title: e.title, heat: e.heat, trend: e.trend, deltaPct: e.deltaPct,
  history: e.history, sourceCount: e.sourceCount, sources: e.sources, itemCount: e.itemCount, lastDate: e.lastDate,
}));
// 写回快照,供下次构建对比涨跌
try {
  const snapEvents = {};
  for (const e of events) snapEvents[e.id] = { heat: e.heat, ts: nowMs, history: e.history };
  fs.mkdirSync(path.dirname(SNAP_PATH), { recursive: true });
  fs.writeFileSync(SNAP_PATH, JSON.stringify({ generatedAt: new Date().toISOString(), events: snapEvents }), 'utf-8');
} catch (e) { console.error('snapshot write failed:', e.message); }

// ---------- 搜索索引(全量条目,前端 fuse.js 检索)----------
const searchIndex = items.map((it) => ({
  id: it.id, href: it.href, kind: it.kind, date: it.date,
  title: it.title, sub: it.source, text: (it.summary || '').slice(0, 300),
  tags: it.tags,
}));
const PUB_DIR = path.join(SITE_DIR, 'public');
fs.mkdirSync(PUB_DIR, { recursive: true });
fs.writeFileSync(path.join(PUB_DIR, 'search-index.json'), JSON.stringify(searchIndex), 'utf-8');

// ---------- llms.txt(AI 助手入口说明)----------
const featuredCount = items.filter((it) => it.selected).length;
const llms = `# ${'QuantOpt Daily'}(量子优化日报)

> 量子计算 × 组合优化 × 智能优化算法的论文与行业动态追踪站。中文摘要,每日更新。

本站是静态站点,提供以下机器可读出口:

- 精选 RSS:https://raymond0812-yylm.github.io/feed.xml (入选论文与行业动态,最近 50 条)
- 全部 RSS:https://raymond0812-yylm.github.io/feed/all.xml (全部条目,最近 100 条)
- 全文 RSS:https://raymond0812-yylm.github.io/feed/full.xml (含完整中文摘要)
- 日报 RSS:https://raymond0812-yylm.github.io/feed/daily.xml (每日论文精读报告)
- 搜索索引:https://raymond0812-yylm.github.io/search-index.json (全量条目 JSON,含标题/来源/中文摘要/标签)

## 内容结构

- / 精选流:入选论文与行业动态按天分组
- /hot 热点榜:事件热度排行(48~96 小时窗口,24 小时半衰期,含涨跌标记)
- /events/[id] 事件页:同一事件的多源报道归并与时间线
- /daily /weekly /monthly 日报/周报/月报
- /topics 研究方向与应用领域
- /papers 文献库(约 ${papers.length} 篇,含趋势/合作网络等分析面板)
- /paper 页面含中文标题、中文摘要、作者与 arXiv/DOI 链接

## 引用规范

论文条目优先链接 arXiv 原文;动态条目链接原始出处。中文摘要为本站编译,转载请注明本站。
`;
fs.writeFileSync(path.join(PUB_DIR, 'llms.txt'), llms, 'utf-8');

const topicCounts = {};
for (const p of papers) for (const t of p.topics) topicCounts[t] = (topicCounts[t] || 0) + 1;
const domainCounts = {};
for (const p of papers) for (const t of p.domains || []) domainCounts[t] = (domainCounts[t] || 0) + 1;
const years = papers.map((p) => p.year).filter(Boolean);
const venues = new Set(papers.map((p) => p.venue));
const lastUpdated = [db.updated, ...reports.map((r) => r.date), ...news.map((n) => n.date)].sort().pop();

const site = {
  generatedAt: new Date().toISOString(),
  lastUpdated,
  stats: {
    papers: papers.length,
    reports: reports.length,
    news: news.reduce((s, n) => s + n.count, 0),
    newsDays: news.length,
    recent2026: papers.filter((p) => p.year === 2026).length,
    foundational: papers.filter((p) => p.tags.includes('foundational')).length,
    venues: venues.size,
    yearMin: Math.min(...years),
    yearMax: Math.max(...years),
    topicCounts,
    domainCounts,
  },
  topics: db.topics,
  domains: db.domains || {},
  papers,
  reports,
  news,
  items,
  events,
  hot,
  categoryLabels: { all: '全部', papers: '论文进展', news: '行业动态' },
};

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(site), 'utf-8');
console.log(`site.json: ${papers.length} papers, ${reports.length} daily reports, ${news.length} news days (${site.stats.news} items)`);
for (const r of reports) console.log(`  [${r.date}] (${r.paperCount} 篇) ${r.titleZh.slice(0, 36)} | ${r.arxivId || 'no-arxiv'}`);
for (const n of news) console.log(`  [新闻 ${n.date}] ${n.count} 条`);
