# 量子优化日报 · QuantOpt Daily

量子计算 × 组合优化 × 智能优化算法 的论文门户站。静态构建,数据完全本地化。

## 页面结构

| 路径 | 内容 |
|---|---|
| `/` | 首页:统计、最新日报、研究方向、最新收录、高影响力排行、奠基文献 |
| `/daily/` | 每日报告归档(按月分组) |
| `/daily/<date>/` | 单篇日报全文(自动解析根目录 `YYYY-MM-DD-*.md` 渲染) |
| `/papers/` | 论文库:关键词搜索 + 方向/年份/标签筛选 + 排序(纯前端,无后端) |
| `/papers/<id>/` | 论文详情:中文摘要、原始摘要、元数据、原文链接、同方向推荐 |
| `/topics/<key>/` | 方向页(qaoa / annealing / vqa / hybrid / quantum / ml4co / llm4co) |
| `/rss.xml` | 全站 RSS 订阅源 |
| `/about/` | 收录范围、数据来源、更新机制说明 |

## 数据流(每日自动更新)

```
每日 10:00 定时任务
  → paper-distill 检索/筛选,生成中文日报 MD → 保存到工作区根目录(YYYY-MM-DD-*.md)
  → npm run build:
      scripts/build-data.mjs
        1. 读取根目录 papers-db.json(回溯论文库,147 篇精选 + 中文摘要)
        2. 解析根目录全部日报 MD(标题/作者/期刊/arXiv 编号/摘要自动提取)
        3. 与回溯库按 arXiv 编号或标题合并 → src/data/site.json
      astro build → dist/(静态页面)
```

**每天新增内容不需要手工维护任何数据文件**——日报 MD 照常生成,构建时自动入库。
同一天多篇日报自动生成 `2026-09-03`、`2026-09-03-2` 这类地址。

## 常用命令

```bash
cd site
npm run dev       # 开发模式(带热更新)
npm run build     # 重新拉取数据并构建到 dist/
npm run preview   # 本地预览 dist/(http://127.0.0.1:4321)
```

## 维护回溯论文库(可选)

`papers-db.json` 由 `scripts/` 下的 Python 流水线生成:

```bash
python site/scripts/fetch_backfill.py    # OpenAlex 抓取(本网络 arXiv API 不可达,走 OpenAlex)
python site/scripts/fetch_supplement.py  # 里程碑论文定点补抓 + 最新论文精确匹配
python site/scripts/curate.py            # 主题打标/质量过滤/配额筛选 → worksheet
# 人工为 worksheet 条目撰写中文摘要(sum_b*.json / sum_s*.json)
python site/scripts/build_db.py          # 合并 → papers-db.json
```

## 部署(待办)

1. 在 GitHub 建仓库,把整个工作区(或至少 `site/`、`papers-db.json`、`*.md`)推送上去;
2. Vercel / Netlify 导入该仓库,框架选 Astro,构建目录 `site/dist`(Root Directory 设为 `site`);
3. 绑定域名后,修改 `site/astro.config.mjs` 的 `site` 字段为正式域名(RSS 链接依赖它);
4. (可选)把 Vercel Deploy Hook 配置进 paper-distill 的 `site_deploy_hook`,实现部署全自动化。
