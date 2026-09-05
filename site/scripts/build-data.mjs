// 构建站点数据:读取工作区根目录的 papers-db.json(回溯论文库)与每日日报 Markdown,
// 合并为 src/data/site.json。每日定时任务只需照旧生成日报 .md,再运行 `npm run build` 即可自动入库。
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
  ['qaoa', /\bQAOA\b|quantum approximate optimization|quantum alternating operator|量子近似优化/i],
  ['llm4co', /large language model|\bLLMs?\b|language model|大模型|大语言模型/i],
  ['annealing', /quantum anneal|adiabatic quantum|rydberg|neutral[- ]atom|中性原子|量子退火|绝热/i],
  ['vqa', /variational quantum|\bVQE\b|变分量子/i],
  ['hybrid', /hybrid quantum|quantum-classical|quantum[- ]inspired|混合|量子启发/i],
  ['ml4co', /graph neural|reinforcement learning|neural combinatorial|machine learning|神经网络|强化学习/i],
  ['quantum', /quantum|量子/i],
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

// ---------- 解析日报 Markdown ----------
function parseReport(file) {
  const md = fs.readFileSync(path.join(ROOT, file), 'utf-8');
  const allLines = md.split(/\r?\n/);
  const date = file.slice(0, 10);
  // 只在正文信息区解析字段,避免误读附录中"备选/候选论文"的作者、编号等
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

  const sectionLines = (keyword) => {
    const start = lines.findIndex((l) => /^##\s/.test(l) && l.includes(keyword));
    if (start < 0) return [];
    const out = [];
    for (let i = start + 1; i < lines.length; i++) {
      if (/^##\s/.test(lines[i])) break;
      out.push(lines[i]);
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

  const stripParens = (s) => {
    let prev;
    do { prev = s; s = s.replace(/（[^（）]*）|\([^()]*\)/g, ''); } while (s !== prev);
    return s;
  };
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
  const mm = (idLine || '').match(/(\d{4}\.\d{4,5})/) || md.match(/arxiv\.org\/abs\/(\d{4}\.\d{4,5})/i) || md.match(/arXiv[:：]\s*(\d{4}\.\d{4,5})/);
  if (mm) arxivId = mm[1];

  const bg = sectionLines('研究背景与动机');
  let summary = '';
  for (const l of bg) {
    const t = stripMd(l.replace(/^[-*>\d.\s]+/, ''));
    if (!t) { if (summary) break; else continue; }
    summary += (summary ? '' : '') + t;
    if (summary.length > 220) break;
  }
  summary = summary.replace(/\s+/g, ' ').trim();
  if (summary.length > 260) summary = summary.slice(0, 258) + '…';

  return { date, file, titleEn, titleZh: titleZh || titleEn, venue, authors, arxivId, summaryZh: summary, markdown: md };
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
  // 同一天可能有多份报告(如 2026-09-03),用后缀区分
  let rslug = r.date;
  for (let n = 2; usedReportSlugs.has(rslug); n++) rslug = `${r.date}-${n}`;
  usedReportSlugs.add(rslug);
  r.slug = rslug;
  let paper = (r.arxivId && byArxiv.get(r.arxivId)) || byTitle.get(norm(r.titleEn));
  if (paper) {
    paper.featured = true;
    paper.reportDate = r.date;
    paper.reportSlug = rslug;
    if (!paper.summaryZh) paper.summaryZh = r.summaryZh;
    if (!paper.titleZh) paper.titleZh = r.titleZh;
  } else {
    let slug = slugify(r.titleEn, r.arxivId || r.titleEn);
    while (usedSlugs.has(slug)) slug += 'x';
    usedSlugs.add(slug);
    const doi = r.arxivId ? `10.48550/arXiv.${r.arxivId}` : '';
    paper = {
      id: slug,
      title: r.titleEn,
      titleZh: r.titleZh,
      authors: r.authors,
      venue: r.venue,
      date: r.date,
      year: Number(r.date.slice(0, 4)),
      citations: null,
      arxivId: r.arxivId,
      doi,
      url: r.arxivId ? `https://arxiv.org/abs/${r.arxivId}` : '',
      topics: inferTopics(`${r.titleEn} ${r.titleZh} ${r.summaryZh}`),
      tags: ['recent'],
      summaryZh: r.summaryZh,
      abstract: '',
      source: 'daily',
      featured: true,
      reportDate: r.date,
      reportSlug: rslug,
    };
    papers.push(paper);
    if (r.arxivId) byArxiv.set(r.arxivId, paper);
    byTitle.set(norm(r.titleEn), paper);
  }
  reports.push({ ...r, paperId: paper.id, topics: paper.topics });
}
reports.sort((a, b) => (a.date < b.date ? 1 : -1));
papers.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
// 'quantum' 是兜底泛标签:仅当论文没有更具体的方向时才保留,避免"综述与应用"分类膨胀
for (const p of papers) {
  if (p.topics.length > 1 && p.topics.includes('quantum')) p.topics = p.topics.filter((t) => t !== 'quantum');
}

const topicCounts = {};
for (const p of papers) for (const t of p.topics) topicCounts[t] = (topicCounts[t] || 0) + 1;
const years = papers.map((p) => p.year).filter(Boolean);
const venues = new Set(papers.map((p) => p.venue));
const lastUpdated = [db.updated, ...reports.map((r) => r.date)].sort().pop();

const site = {
  generatedAt: new Date().toISOString(),
  lastUpdated,
  stats: {
    papers: papers.length,
    reports: reports.length,
    recent2026: papers.filter((p) => p.year === 2026).length,
    foundational: papers.filter((p) => p.tags.includes('foundational')).length,
    venues: venues.size,
    yearMin: Math.min(...years),
    yearMax: Math.max(...years),
    topicCounts,
  },
  topics: db.topics,
  papers,
  reports,
};

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(site), 'utf-8');
console.log(`site.json: ${papers.length} papers (${reports.length} daily reports, ${papers.filter((p) => p.source === 'daily').length} report-only), topics:`, topicCounts);
for (const r of reports) console.log(`  [${r.date}] ${r.titleZh.slice(0, 40)} | ${r.arxivId || 'no-arxiv'} | authors=${r.authors.length} | venue=${r.venue}`);
