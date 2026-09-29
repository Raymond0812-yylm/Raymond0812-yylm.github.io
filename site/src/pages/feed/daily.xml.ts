// 日报 RSS:/feed/daily.xml
import type { APIRoute } from 'astro';
import { buildRss, itemsOf, rssResponse } from '../../lib/rss';

export const GET: APIRoute = () => rssResponse(buildRss(itemsOf('daily'), '日报', '/feed/daily.xml'));
