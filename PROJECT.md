# 量子优化日报 (QuantOpt Daily) — 项目完整文档

> **本文档是后续 AI Agent 接手本项目的唯一引导文件。** 包含架构、数据流、脚本、规则、部署、自动化、更新日志的完整描述。接手后请先通读全文。

---

## 一、项目定位

追踪**量子计算求解组合优化问题**的前沿进展，以中文深度解读的形式沉淀为可检索、可分享的研究档案。网站是一个纯静态 Astro 站点，部署在 GitHub Pages 上，内容完全由本地定时任务驱动更新。

- **正式网址**:https://raymond0812-yylm.github.io
- **GitHub 仓库**:https://github.com/Raymond0812-yylm/Raymond0812-yylm.github.io
- **品牌名**:量子优化日报 · QuantOpt Daily(不要写成 QuanOpt)

## 二、收录范围(红线)

**只收录与量子计算相关的研究**，具体包括：

| 研究方向 (key) | 说明 |
|---|---|
| `qaoa` | QAOA 及其变体、参数策略、硬件实验与理论性能 |
| `annealing` | 量子退火、绝热量子计算、反绝热驱动、退火机实验 |
| `vqa` | VQE/VQA 框架、ansatz 设计、贫瘠高原与可训练性 |
| `hybrid` | 量子-经典混合优化流水线：量子线路与经典求解器分工协同 |
| `hardware` | 超导、离子阱、中性原子、光量子等平台及面向优化的硬件进展 |
| `quantum-ai` | 量子机器学习、量子神经网络、量子与大模型/生成式 AI 的交叉前沿 |
| `quantum` | 领域综述、路线图、基准测试与交叉前沿探索(兜底泛标签，多方向时自动移除) |
| `ml4co` | 机器学习求解组合优化(须涉及量子，纯经典 ML4CO 已清除) |
| `llm4co` | LLM 自动设计启发式、LLM 作为优化器(须涉及量子) |

**明确排除**：纯通信网络/无线组网、医药生物、纯经典 ML4CO(无量子)、后量子密码学、量子点纳米材料(与量子计算无关)。

### 应用领域标签 (domains)

与研究方向正交的二级标签，一篇论文可属多个领域：

`satellite`(卫星与航天，**最高优先级**)、`finance`、`energy`、`logistics`、`manufacturing`、`transport`、`materials`、`it-cloud`

> **已删除**:telecom(通信网络)、pharma(医药生物)——用户明确不关注。

### 专题

两个重点专题，从全库自动聚合匹配论文：

| 专题 key | 标题 | 匹配规则 |
|---|---|---|
| `satellite` | 量子计算与卫星任务规划 | domains 含 satellite 或标题匹配卫星/航天/遥感等 |
| `llm` | 量子计算与大模型 | topics 含 quantum-ai 或 llm4co，或标题/摘要匹配 LLM/大模型等 |

---

## 三、目录结构

```
每日论文推送/                       ← 工作区根目录 = git 仓库根
├── PROJECT.md                     ← 本文件
├── papers-db.json                 ← 论文主数据库(493+ 篇，含中文摘要)
├── .gitignore
├── 2026-08-31-*.md                ← 每日论文报告(9 期)
├── 2026-09-0?-*.md
├── news-2026-09-06.md             ← 行业动态(3 天)
├── news-2026-09-07.md
├── news-2026-09-08.md
├── docs/                          ← Astro 构建产物(GitHub Pages 发布目录)
│   ├── index.html
│   ├── papers/                    ← 论文详情页 × N
│   ├── daily/                     ← 日报归档 + 详情
│   ├── weekly/                    ← 周报归档 + 详情
│   ├── monthly/                   ← 月报归档 + 详情
│   ├── topics/                    ← 方向页 × 8
│   ├── applications/              ← 领域页 × 8
│   ├── specials/                  ← 专题页 × 2 + 索引
│   ├── news/                      ← 新闻归档
│   ├── about/                     ← 关于页
│   ├── rss.xml                    ← RSS 订阅
│   └── _astro/                    ← 静态资源
├── site/                          ← Astro 项目源码
│   ├── package.json
│   ├── astro.config.mjs           ← site: 'https://raymond0812-yylm.github.io', outDir: '../docs'
│   ├── public/                    ← 静态资源(favicon.svg, manifest, icons)
│   ├── src/
│   │   ├── layouts/Base.astro     ← 全局布局(侧边栏+顶栏+底部标签栏)
│   │   ├── components/
│   │   │   ├── PaperCard.astro    ← 论文卡片
│   │   │   ├── ArchivePanel.astro ← 日报归档面板(月份树)
│   │   │   ├── PeriodTabs.astro   ← 日报/周报/月报切换标签
│   │   │   ├── TrendChart.astro   ← 月度趋势 SVG 折线图
│   │   │   ├── HBars.astro        ← 水平条形图
│   │   │   └── NetGraph.astro     ← 作者合作网络 SVG 图
│   │   ├── lib/
│   │   │   ├── utils.js           ← 公共函数(主题颜色、格式化)
│   │   │   ├── periods.js         ← 周/月分组(含 PERIOD_START = '2026-08-31')
│   │   │   ├── specials.js        ← 专题定义(satellite, llm)
│   │   │   └── analytics.js       ← 分析函数(趋势、分布、作者、合作)
│   │   ├── pages/
│   │   │   ├── index.astro        ← 首页(9 个分析面板)
│   │   │   ├── papers/index.astro ← 论文库(搜索+筛选+库情分析)
│   │   │   ├── papers/[id].astro  ← 论文详情
│   │   │   ├── daily/index.astro  ← 日报归档
│   │   │   ├── daily/[id].astro   ← 日报详情(Markdown 渲染)
│   │   │   ├── weekly/index.astro ← 周报归档
│   │   │   ├── weekly/[week].astro← 周报详情(VOL 期号头+主线+统计)
│   │   │   ├── monthly/…          ← 月报(同周报结构)
│   │   │   ├── topics/…           ← 方向页
│   │   │   ├── applications/…     ← 领域页
│   │   │   ├── specials/…         ← 专题页(含作者合作网络)
│   │   │   ├── news/…             ← 行业动态归档+详情
│   │   │   ├── about.astro        ← 关于页
│   │   │   └── rss.xml.ts         ← RSS 生成
│   │   └── styles/global.css      ← 全局样式(含深色主题变量)
│   └── scripts/
│       ├── build-data.mjs         ← 核心:合并 DB + 日报 MD + 新闻 MD → site.json
│       ├── build_db.py            ← 合并回溯库+扩库数据 → papers-db.json
│       ├── cloud_ingest.py        ← 云端扩库脚本(GitHub Actions 调用)
│       ├── fill_day.py            ← 本地扩库脚本(按主题轮换)
│       ├── fetch_backfill.py      ← 初始回溯抓取(OpenAlex)
│       ├── fetch_supplement.py    ← 里程碑论文定点补抓
│       ├── fetch_supplement2.py   ← 硬件/应用方向补抓
│       ├── curate.py              ← 筛选过滤(首次回溯用)
│       └── retag.py               ← 重新打标(保留人工核定标记)
├── .github/workflows/ingest.yml   ← GitHub Actions ⚠️ 需手动恢复(见第八节)
├── .gitignore
└── .zcode/config.json             ← ZCode 工作区配置(不入库)
```

## 四、数据流(完整链路)

```
每日 6:00 本地定时任务 (ZCode)
  │
  ├─ paper-distill MCP 检索/筛选 → 精选 2~3 篇论文
  ├─ 生成中文日报 → 保存 YYYY-MM-DD-*.md
  ├─ 网络搜索行业动态 → 保存 news-YYYY-MM-DD.md
  ├─ npm run build (site/)
  │     └─ scripts/build-data.mjs:
  │         1. 读取 papers-db.json (回溯库)
  │         2. 解析 *.md 日报 (支持一天多篇 `## 论文一：` 分节)
  │         3. 解析 news-*.md 行业动态
  │         4. 合并 → src/data/site.json
  │     └─ astro build → docs/
  ├─ git add -A && git commit && git push
  └→ GitHub Pages 自动发布 (~1 分钟)
```

```
每天 1:00 本地定时任务 (ZCode)
  │
  ├─ 按主题轮换: python site/scripts/fill_day.py "搜索词1" ...
  ├─ 筛选新候选 → 写中文摘要 → fill_summaries.json
  ├─ python site/scripts/build_db.py (合库)
  ├─ npm run build
  ├─ git add -A && git commit && git push
  └→ GitHub Pages 自动发布
```

## 五、数据文件说明

| 文件 | 用途 | 维护方式 |
|---|---|---|
| `papers-db.json` | 论文主数据库(标题/中文标题/作者/摘要/方向/领域/引用数) | build_db.py 自动生成，**不要手动编辑** |
| `site/src/data/site.json` | 网站全部数据(构建时自动生成) | build-data.mjs 自动生成 |
| `site/scripts/cache/fill_papers.json` | 扩库候选累积池(fid → 元数据) | fill_day.py / cloud_ingest.py 追加 |
| `site/scripts/cache/fill_summaries.json` | 扩库候选中文摘要(fid → titleZh + summaryZh) | 本地 AI 手写 / cloud_ingest.py 模板生成 |
| `YYYY-MM-DD-*.md` | 每日论文报告(构建时自动解析) | 每日定时任务生成 |
| `news-YYYY-MM-DD.md` | 行业动态(构建时自动解析) | 每日定时任务生成 |

## 六、研究方向与应用领域定义

### 方向优先级(自动分类时按此顺序匹配，先到先得)

```
quantum-ai → llm4co(已废弃) → ml4co(已废弃) → qaoa → vqa → annealing → hardware → hybrid → quantum(兜底)
```

### 领域判定规则(收紧版)

领域标签**仅依据标题 + 中文摘要前 140 字 + 英文摘要前 240 字**中的明确应用证据判定。
纯方法论文(如 QAOA 理论、Ising 机硬件)不会因为摘要深处提到某个行业词就被挂上领域标签。

### 已废弃的方向键

`ml4co` 和 `llm4co` 曾是独立方向，后并入 `quantum-ai`。如果 papers-db.json 中出现这些键，build_db.py 的归一化逻辑会自动重映射。`applications` 已删除(应用场景改用 domains 标签)。

## 七、页面路由

| 路径 | 说明 |
|---|---|
| `/` | 首页(统计、最新日报、研究方向、专题、最新收录、高被引排行、奠基文献) |
| `/daily/` | 日报归档(按月分组) |
| `/daily/{slug}/` | 日报详情(Markdown 渲染，slug 格式: `2026-09-06` 或 `2026-09-03-2`) |
| `/weekly/` | 周报归档 |
| `/weekly/{key}/` | 周报详情(key 格式: `2026-W35`) |
| `/monthly/` | 月报归档 |
| `/monthly/{ym}/` | 月报详情(ym 格式: `2026-09`) |
| `/papers/` | 论文库(搜索+方向/年份/标签筛选+排序) |
| `/papers/{id}/` | 论文详情 |
| `/topics/{key}/` | 方向页(含画像：趋势图+关键词+高被引) |
| `/applications/{key}/` | 领域页(含画像：趋势图+交叉方向) |
| `/specials/{key}/` | 专题页(satellite, llm;含作者合作网络) |
| `/news/` | 行业动态归档 |
| `/news/{date}/` | 单日行业动态 |
| `/rss.xml` | RSS 订阅 |
| `/about/` | 关于页 |

## 八、每日自动化定时任务(ZCode Cron)

### 任务 1:凌晨论文库自动扩库(`0 1 * * *`)

- 按日期 mod 10 轮换主题(卫星/量子AI/金融/能源/物流/制造/交通/材料/硬件/基准)
- 运行 `fill_day.py` 抓取 → 筛选 10~20 篇 → 写中文摘要 → `build_db.py` 合库 → `npm run build` → `git add/commit/push`

### 任务 2:每日论文推送(`0 6 * * *`)

- paper-distill MCP 检索/筛选 → 生成日报 MD(多篇格式:`## 论文一：`分节)
- 网络搜索行业动态 → 生成 news MD(`- **地区**:国际/国内` 必填)
- `npm run build` → `git add/commit/push`

### 注意事项

- 定时任务**仅在 ZCode 运行且电脑开机时触发**；关机期间不会补跑
- push 失败时等 30 秒重试(最多 8 次)；网络不稳定是国内访问 GitHub 的常见问题
- 本地任务push前应先 `git pull --rebase origin main`(处理云端可能存在的冲突)

## 九、GitHub Actions(云端备用流水线)

⚠️ **当前状态：未激活**。工作流文件(`.github/workflows/ingest.yml`)已从仓库移除，因为推送令牌缺少 `workflow` scope。

**恢复方法**(二选一)：
1. 在 GitHub → Settings → Developer settings → Personal access tokens 中，编辑现有令牌并勾选 `workflow` scope，然后用 git 推送本地保留的 `.github/workflows/ingest.yml` 文件
2. 在 GitHub 网页上手动创建 `.github/workflows/ingest.yml` 文件(内容从本地复制)

启用后：每天 UTC 21:30(北京 5:30)自动在 GitHub 服务器上抓取/入库/建站/发布，不依赖本机开机。

## 十、关键技术细节

### 日报 Markdown 解析规则(build-data.mjs)

- 文件名匹配: `YYYY-MM-DD-*.md` → 日报; `news-YYYY-MM-DD.md` → 行业动态
- 多论文日报用 `## 论文一：` 分节; 单论文日报用 `## 一、论文基本信息` 格式
- 解析字段：英文标题、中文标题、作者列表(去括号+分号拆分)、发表平台(截取到括号前)、arXiv 编号(从表格行或链接提取)、研究背景与动机(取第一段，最长 260 字)
- 附录区域(`## 附`、`## 候选`等)自动截断不参与字段提取
- 同一天多篇日报自动生成 slug 后缀(`2026-09-03`、`2026-09-03-2`)

### 论文方向自动分类

- 按正则规则匹配标题+中文摘要+英文摘要，按优先级排序取前 3 个方向
- `quantum` 是兜底泛标签：仅当论文没有更具体的方向时才保留
- `curatedTopics: true` 标记人工核定的分类，不会被自动规则覆盖

### 领域标注

- 按标题+摘要前部中的明确应用证据判定，取前 3 个领域
- 方法论文(如 QAOA 理论)即使摘要深处提到某个行业词也不会被挂上领域标签

## 十一、部署

- **GitHub Pages**:main 分支 `/docs` 目录，自动部署(push 后 ~1 分钟)
- **自定义域名**:未配置(用户决定暂不购买域名)
- **Astro 配置**:`site: 'https://raymond0812-yylm.github.io'`, `outDir: '../docs'`

## 十二、Git 推送

- 远程:`https://Raymond0812-yylm:<TOKEN>@github.com/Raymond0812-yylm/Raymond0812-yylm.github.io.git`
- 令牌:`REDACTED-token-must-be-revoked`(scope: repo, 无 workflow)
- ⚠️ 网络不稳定(国内访问 GitHub)，push 失败时等 25~30 秒重试(最多 8~12 次)
- ⚠️ 推送含 workflow 文件的提交会因缺少 workflow scope 被拒绝

## 十三、更新日志

详见 [CHANGELOG.md](CHANGELOG.md)。

## 十四、给接手 Agent 的操作指引

### 日常更新(已有定时任务自动执行)
不需要手动操作。定时任务自动完成：抓取 → 筛选 → 生成 MD → 构建网站 → git push → GitHub Pages 发布。

### 手动扩库
```bash
python site/scripts/fill_day.py "search phrase 1" "search phrase 2"
# 然后为 fill_worksheet.jsonl 中的新条目写中文摘要到 fill_summaries.json
python site/scripts/build_db.py
cd site && npm run build
git add -A && git commit && git push
```

### 修改网站样式/结构
编辑 `site/src/` 下的 `.astro` / `.css` / `.js` 文件，然后 `npm run build` + push。

### 新增研究方向
1. 在 `site/scripts/build_db.py` 的 `TOPIC_LABELS` 中添加新方向
2. 在 `site/src/lib/utils.js` 的 `TOPIC_ORDER` 和 `TOPIC_COLOR` 中添加
3. 在 `site/src/styles/global.css` 中添加 `.badge.t-{key}` 配色
4. 在 `site/src/pages/topics/[topic].astro` 的 `getStaticPaths` 中确认自动生成
5. 重建并推送

### 排查问题
- 网站不更新：检查 `docs/` 目录是否最新 → 检查 git push 是否成功 → 检查 GitHub Pages 是否 building
- 构建失败：检查 `papers-db.json` 是否为合法 JSON → 检查 build-data.mjs 报错
- push 失败：网络问题，等 30 秒重试；如果反复失败尝试 `git pull --rebase origin main`

### 已知限制
- OpenAlex API 偶尔超时(脚本自带重试)
- 国内访问 GitHub 不稳定(push 和 Pages 都可能受影响)
- 引用数来自 OpenAlex，存在滞后与误差
- 云端 GitHub Actions 扩库流水线尚未激活(需令牌补 workflow scope)
