// RSS 构建公共库:四路 feed 共用。
import siteData from '../data/site.json';

export const SITE = 'https://raymond0812-yylm.github.io';
export const NAME = '量子优化日报 QuantOpt Daily';

const xmlEsc = (s: string) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
const pubDate = (d: string) => new Date(`${d}T08:00:00+08:00`).toUTCString();

export function buildRss(items: Array<{ title: string; link: string; desc: string; date: string; guid: string }>, subtitle: string, selfPath: string) {
  const last = items[0] ? pubDate(items[0].date) : new Date().toUTCString();
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${xmlEsc(`${NAME} · ${subtitle}`)}</title>
    <link>${SITE}</link>
    <description>${xmlEsc('量子计算 × 组合优化 × 智能优化:论文中文解读与行业动态,每日自动更新')}</description>
    <language>zh-CN</language>
    <lastBuildDate>${last}</lastBuildDate>
    <atom:link href="${SITE}${selfPath}" rel="self" type="application/rss+xml"/>
${items.map((it) => `    <item>
      <title>${xmlEsc(it.title)}</title>
      <link>${SITE}${it.link}</link>
      <guid isPermaLink="false">${xmlEsc(it.guid)}</guid>
      <pubDate>${pubDate(it.date)}</pubDate>
      <description>${xmlEsc(it.desc)}</description>
    </item>`).join('\n')}
  </channel>
</rss>`;
}

export function itemsOf(kind: '' | 'all' | 'full' | 'daily') {
  const data: any = siteData;
  const base = (it: any) => ({
    title: it.kind === 'paper' ? `[论文] ${it.title}` : `[动态] ${it.title}`,
    link: it.href, guid: it.id, date: it.date,
  });
  if (kind === 'daily') {
    return (data.reports || []).slice(0, 30).map((r: any) => ({
      title: `[日报 ${r.date}] ${r.titleZh}`, link: `/daily/${r.slug}/`, guid: `daily:${r.slug}`, date: r.date, desc: r.summaryZh || '',
    }));
  }
  if (kind === 'all') {
    return data.items.slice(0, 100).map((it: any) => ({ ...base(it), desc: (it.summary || '').slice(0, 120) + '…' }));
  }
  if (kind === 'full') {
    return data.items.slice(0, 60).map((it: any) => ({ ...base(it), desc: it.summary || '' }));
  }
  return data.items.filter((it: any) => it.selected).slice(0, 50).map((it: any) => ({ ...base(it), desc: it.summary || '' }));
}

export const rssResponse = (xml: string) => new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
