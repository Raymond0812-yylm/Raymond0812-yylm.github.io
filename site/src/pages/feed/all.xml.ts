// 全部动态 RSS:/feed/all.xml
import type { APIRoute } from 'astro';
import { buildRss, itemsOf, rssResponse } from '../../lib/rss';

export const GET: APIRoute = () => rssResponse(buildRss(itemsOf('all'), '全部动态', '/feed/all.xml'));
