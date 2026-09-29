// 精选 RSS:/feed.xml
import type { APIRoute } from 'astro';
import { buildRss, itemsOf, rssResponse } from '../../lib/rss';

export const GET: APIRoute = () => rssResponse(buildRss(itemsOf(''), '精选', '/feed.xml'));
