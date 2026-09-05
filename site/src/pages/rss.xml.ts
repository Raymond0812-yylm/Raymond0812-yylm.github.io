import site from '../data/site.json';
import { escapeXml } from '../lib/utils.js';

export async function GET({ site: base }: { site: URL }) {
  const data: any = site;
  const origin = base?.origin || 'https://quantum-opt-daily.example.com';
  const items: string[] = [];

  for (const r of data.reports) {
    items.push(`    <item>
      <title>${escapeXml(`[日报解读] ${r.titleZh}`)}</title>
      <link>${origin}/daily/${r.slug}/</link>
      <guid isPermaLink="true">${origin}/daily/${r.slug}/</guid>
      <pubDate>${new Date(r.date + 'T10:00:00+08:00').toUTCString()}</pubDate>
      <description>${escapeXml(r.summaryZh)}</description>
    </item>`);
  }
  for (const p of data.papers.slice(0, 40)) {
    items.push(`    <item>
      <title>${escapeXml(`${p.titleZh} / ${p.title}`)}</title>
      <link>${origin}/papers/${p.id}/</link>
      <guid isPermaLink="true">${origin}/papers/${p.id}/</guid>
      <pubDate>${new Date((p.date || data.lastUpdated) + 'T10:00:00+08:00').toUTCString()}</pubDate>
      <description>${escapeXml(p.summaryZh)}</description>
    </item>`);
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>量子优化日报 · QuantOpt Daily</title>
    <link>${origin}</link>
    <description>量子计算求解组合优化、量子赋能智能优化方向的最新论文与研究进展(中文解读)</description>
    <language>zh-CN</language>
    <lastBuildDate>${new Date(data.lastUpdated + 'T10:00:00+08:00').toUTCString()}</lastBuildDate>
    <atom:link href="${origin}/rss.xml" rel="self" type="application/rss+xml" />
${items.join('\n')}
  </channel>
</rss>`;

  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
