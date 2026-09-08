# 量子优化日报 · QuantOpt Daily

> 详细文档请阅读根目录的 **[PROJECT.md](../PROJECT.md)**

## 快速命令

```bash
cd site
npm run dev       # 开发模式
npm run build     # 构建到 ../docs/
npm run preview   # 本地预览 http://127.0.0.1:4321
```

## 页面路由

| 路径 | 内容 |
|---|---|
| `/` | 首页(统计+最新日报+专题+领域+分析) |
| `/daily/` | 日报归档 |
| `/daily/{slug}/` | 日报详情 |
| `/weekly/` | 周报归档 |
| `/weekly/{key}/` | 周报详情 |
| `/monthly/` | 月报归档 |
| `/monthly/{ym}/` | 月报详情 |
| `/papers/` | 论文库(搜索+筛选+排序) |
| `/papers/{id}/` | 论文详情 |
| `/topics/{key}/` | 方向页(8 个方向) |
| `/applications/{key}/` | 领域页(8 个领域) |
| `/specials/{key}/` | 专题页(satellite, llm) |
| `/news/` | 行业动态 |
| `/news/{date}/` | 单日行业动态 |
| `/rss.xml` | RSS |
| `/about/` | 关于 |

## 每日更新流程

```
6:00 定时任务
  → 日报 MD + 行业动态 MD 保存到工作区根目录
  → npm run build (自动解析 MD → site.json → Astro → ../docs/)
  → git add -A && git commit && git push
  → GitHub Pages 自动发布
```

数据文件说明、脚本参考、分类规则、部署详情请阅读 **[PROJECT.md](../PROJECT.md)**。
