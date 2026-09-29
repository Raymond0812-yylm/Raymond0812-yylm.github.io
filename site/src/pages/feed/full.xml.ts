// 全文 RSS:/feed/full.xml
import type { APIRoute } from 'astro';
import { buildRss, itemsOf, rssResponse } from '../../lib/rss';

export const GET: APIRoute = () => rssResponse(buildRss(itemsOf('full'), '全文', '/feed/full.xml'));
