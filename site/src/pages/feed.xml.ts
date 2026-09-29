// 精选 RSS(根路径 /feed.xml,与旧订阅地址兼容):内容与 /feed/index.xml 相同。
import type { APIRoute } from 'astro';
import { buildRss, itemsOf, rssResponse } from '../lib/rss';

export const GET: APIRoute = () => rssResponse(buildRss(itemsOf(''), '精选', '/feed.xml'));
