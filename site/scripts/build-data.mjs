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
      category: f('类别') || '行业动态',
      source: f('来源'),
      url: (f('链接') || '').replace(/^https?\/\//, 'https://'),
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
};

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(site), 'utf-8');
console.log(`site.json: ${papers.length} papers, ${reports.length} daily reports, ${news.length} news days (${site.stats.news} items)`);
for (const r of reports) console.log(`  [${r.date}] (${r.paperCount} 篇) ${r.titleZh.slice(0, 36)} | ${r.arxivId || 'no-arxiv'}`);
for (const n of news) console.log(`  [新闻 ${n.date}] ${n.count} 条`);
