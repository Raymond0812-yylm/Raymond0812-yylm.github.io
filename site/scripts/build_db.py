# -*- coding: utf-8 -*-
"""Merge curated selections + handwritten Chinese summaries into papers-db.json
(the master database consumed by the website build)."""
import json, os, re, glob, hashlib
from datetime import date

BASE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(BASE, "cache")
ROOT = os.path.abspath(os.path.join(BASE, "..", ".."))
OUT = os.path.join(ROOT, "papers-db.json")

# manual metadata corrections (OpenAlex errors), keyed by (source, idx)
FIXES = {
    ("ws", 109): {"authors": ["Kenneth Langedal", "Demian Hespe", "Peter Sanders"], "citations": None,
                  "venue": "SEA 2024 (Symposium on Experimental Algorithms)"},
    ("ws", 114): {"venue": "European Journal of Operational Research"},
    ("ws", 0):   {"topics": ["hybrid", "vqa"]},
    ("ws", 3):   {"topics": ["hybrid", "qaoa"]},
    ("ws", 13):  {"topics": ["qaoa"]},
    ("ws", 31):  {"topics": ["quantum", "qaoa"]},
    ("ws", 35):  {"topics": ["hybrid", "qaoa", "ml4co"]},
    ("ws", 50):  {"topics": ["quantum"]},
    ("ws", 52):  {"topics": ["hybrid"]},
    ("ws", 68):  {"topics": ["quantum"]},
    ("ws", 113): {"topics": ["quantum", "vqa"]},
    ("ws", 118): {"topics": ["vqa", "hybrid"]},
    ("ws", 122): {"topics": ["vqa"]},
    ("sup", 15): {"topics": ["ml4co"], "bucket": "impact"},
    ("sup", 8):  {"topics": ["annealing"]},
    ("sup", 11): {"topics": ["hybrid", "quantum"]},
    ("sup", 43): {"topics": ["annealing"]},
    ("sup", 65): {"topics": ["hybrid", "ml4co"]},
}

TOPIC_ORDER = ["qaoa", "annealing", "vqa", "qinspired", "hybrid", "hardware", "quantum-ai", "quantum", "ml4co", "llm4co"]

TOPIC_LABELS = {
    "qaoa": {"label": "量子近似优化", "desc": "QAOA 及其变体、参数策略、硬件实验与理论性能"},
    "annealing": {"label": "量子退火与绝热优化", "desc": "量子退火、绝热量子计算、反绝热驱动、退火机实验"},
    "vqa": {"label": "变分量子算法", "desc": "VQE/VQA 框架、ansatz 设计、贫瘠高原与可训练性"},
    "qinspired": {"label": "量子启发式算法", "desc": "量子启发元启发式:量子粒子群、量子进化、模拟分叉、Ising 机等借鉴量子机制的经典算法"},
    "hybrid": {"label": "量子-经典混合优化", "desc": "量子-经典混合优化流水线:量子线路与经典求解器分工协同的架构与方法"},
    "hardware": {"label": "量子硬件平台", "desc": "超导、离子阱、中性原子、光量子等平台及面向优化的硬件进展"},
    "quantum-ai": {"label": "量子计算×人工智能", "desc": "量子机器学习、量子神经网络、量子与大模型/生成式AI的交叉前沿"},
    "quantum": {"label": "领域综述与交叉前沿", "desc": "领域综述、路线图、基准测试与交叉前沿探索"},
    "ml4co": {"label": "机器学习求解组合优化", "desc": "神经组合优化、GNN、强化学习、学习增强精确求解"},
    "llm4co": {"label": "大模型赋能优化", "desc": "LLM 自动设计启发式、LLM 作为优化器、LLM×进化计算"},
}

# 应用领域(与研究方向正交的二级标签,一篇论文可属多个领域)
DOMAIN_LABELS = {
    "satellite": {"label": "卫星与航天", "desc": "卫星任务规划、对地观测调度、航天器资源分配"},
    "finance": {"label": "金融投资", "desc": "投资组合、风险管理、信用评分、量化交易"},
    "energy": {"label": "能源电力", "desc": "电网调度、微电网、可再生能源、碳排放优化"},
    "logistics": {"label": "物流供应链", "desc": "车辆路径、仓储、库存、车队与供应链网络"},
    "manufacturing": {"label": "制造调度", "desc": "车间调度、生产排程、工艺规划、装配线平衡"},
    "telecom": {"label": "通信网络", "desc": "无线网络、频谱分配、基站组网、5G/6G 优化"},
    "transport": {"label": "交通出行", "desc": "城市交通、轨道交通、低空经济、自动驾驶"},
    "pharma": {"label": "医药生物", "desc": "药物发现、分子对接、蛋白质、基因分析"},
    "materials": {"label": "材料化工", "desc": "材料设计、催化、化学合成、电池优化"},
    "it-cloud": {"label": "信息技术", "desc": "云计算调度、任务卸载、边缘计算、数据中心"},
}

DOMAIN_RULES = [
    ("satellite", [r"satellite", r"spacecraft", r"earth observation", r"mission planning", r"aerospace", r"remote sensing", r"卫星", r"航天", r"任务规划", r"遥感"]),
    ("finance", [r"portfolio", r"\bfinanc", r"credit", r"trading", r"risk management", r"投资组合", r"金融", r"信贷"]),
    ("energy", [r"power system", r"smart grid", r"microgrid", r"renewable", r"energy (management|dispatch|optimization|scheduling)", r"carbon emission", r"电网", r"微网", r"电力", r"能源", r"碳排放"]),
    ("logistics", [r"vehicle routing", r"supply chain", r"logistics", r"warehouse", r"inventory", r"shipping", r"fleet", r"物流", r"供应链", r"仓储", r"库存", r"车队"]),
    ("manufacturing", [r"job shop", r"production schedul", r"manufactur", r"assembly line", r"process planning", r"生产调度", r"制造", r"车间", r"工艺"]),
    ("telecom", [r"wireless", r"telecommunication", r"network routing", r"\b5G\b", r"\b6G\b", r"MIMO", r"base station", r"spectrum", r"通信", r"无线", r"基站", r"频谱"]),
    ("transport", [r"traffic", r"railway", r"subway", r"urban air mobility", r"autonomous driving", r"intelligent transport", r"交通", r"轨道交通", r"自动驾驶"]),
    ("pharma", [r"drug", r"docking", r"protein", r"genom", r"molecular design", r"药物", r"对接", r"蛋白质", r"基因", r"分子设计"]),
    ("materials", [r"material", r"catalyst", r"chemistry", r"battery", r"材料", r"催化", r"化学", r"电池"]),
    ("it-cloud", [r"cloud computing", r"task offload", r"edge computing", r"data center", r"\bIoT\b", r"云计算", r"任务卸载", r"边缘计算", r"数据中心", r"物联网"]),
]

# 自动分类规则(顺序即优先级;用于未经人工核定的论文)
AUTO_TOPIC_RULES = [
    ("quantum-ai", [r"quantum (machine learning|neural network|deep learning|reinforcement learning)", r"quantum[- ]enhanced (machine )?learning", r"\bQML\b", r"quantum.{0,30}large language", r"large language.{0,30}quantum", r"quantum artificial intelligence", r"量子机器学习", r"量子神经网络", r"量子.{0,12}大模型", r"量子人工智能"]),
    ("llm4co", [r"large language model", r"\bLLMs?\b", r"语言模型", r"大模型", r"FunSearch", r"ReEvo", r"\bEoH\b", r"\bAEL\b", r"\bOPRO\b", r"AlphaEvolve"]),
    ("ml4co", [r"neural combinatorial", r"graph neural", r"learning to branch", r"learned (heuristic|solver|algorithm)", r"reinforcement learning", r"deep [- ]?reinforcement", r"神经组合优化", r"图神经网络", r"pointer network", r"\bPOMO\b"]),
    ("qaoa", [r"\bQAOA\b", r"quantum approximate optimization", r"quantum alternating operator", r"量子近似优化"]),
    ("vqa", [r"variational quantum", r"\bVQE\b", r"barren plateau", r"变分量子", r"贫瘠高原", r"variational eigensolver", r"\bVQAs?\b"]),
    ("annealing", [r"quantum anneal", r"annealer", r"adiabatic quantum", r"reverse annealing", r"量子退火", r"绝热量子", r"transverse[- ]field ising"]),
    ("hardware", [r"superconducting (qubit|processor|quantum)", r"trapped[- ]ion", r"\brydberg\b", r"neutral atom", r"photonic quantum", r"spin qubit", r"quantum (processor|hardware|chip)", r"ion trap", r"超导量子", r"离子阱", r"中性原子", r"光量子", r"里德堡"]),
    ("qinspired", [r"quantum[- ]inspired", r"量子启发", r"ising machine", r"simulated bifurcation", r"coherent ising", r"quantum (particle swarm|differential evolution|evolutionary|swarm|memetic)", r"量子粒子群", r"量子差分进化", r"量子演化", r"量子模因"]),
    ("hybrid", [r"hybrid quantum", r"quantum-classical", r"混合量子", r"量子[- ]经典", r"quantum[- ]classic(al)? (hybrid|loop|solver)"]),
    ("quantum", [r"review", r"survey", r"benchmark", r"perspective", r"outlook", r"综述", r"展望", r"基准"]),
]


def load_json(p):
    with open(p, encoding="utf-8") as f:
        return json.load(f)


def load_summaries(prefix):
    out = {}
    for p in sorted(glob.glob(os.path.join(CACHE, f"{prefix}*.json"))):
        for k, v in load_json(p).items():
            out[int(k)] = v
    return out


def slugify(title, arxiv_id, doi):
    words = re.findall(r"[a-z0-9]+", title.lower())
    stop = {"a", "an", "the", "of", "for", "and", "on", "in", "with", "to", "using", "via", "by", "its", "at"}
    words = [w for w in words if w not in stop][:7]
    base = "-".join(words) or "paper"
    key = arxiv_id or doi or title
    h = hashlib.md5(key.encode("utf-8")).hexdigest()[:5]
    return f"{base}-{h}"


def clean_venue(v):
    if not v:
        return "预印本"
    v = v.replace("arXiv (Cornell University)", "arXiv")
    if v == "OpenAlex":
        return "会议论文 / 预印本"
    v = re.sub(r"\s*\(.*?Università.*?\)", "", v)
    return v.strip()


def main():
    selected = load_json(os.path.join(CACHE, "selected.json"))
    supplement = load_json(os.path.join(CACHE, "supplement.json"))
    supplement2 = load_json(os.path.join(CACHE, "supplement2.json"))
    sum_ws = load_summaries("sum_b")
    sum_sup = load_summaries("sum_s")
    sum_t = load_summaries("sum_t")

    papers, seen_slugs, seen_titles = [], set(), set()

    def add(p, s, src, idx):
        fix = FIXES.get((src, idx), {})
        topics = fix.get("topics") or s.get("topics") or p.get("topics") or ["quantum"]
        curated = bool(fix.get("topics") or s.get("topics"))
        topics = [t for t in topics if t in TOPIC_ORDER]
        if not topics:
            topics = ["quantum"]
        # de-dup while preserving order
        topics = list(dict.fromkeys(topics))
        bucket = fix.get("bucket") or p.get("bucket") or "impact"
        tags = []
        if bucket == "foundational" or "foundational" in (p.get("topics") or []):
            tags.append("foundational")
        if bucket == "recent":
            tags.append("recent")
        arxiv_id = s.get("arxiv_id") or p.get("arxiv_id") or ""
        doi = p.get("doi") or ""
        if arxiv_id and not doi:
            doi = f"10.48550/arXiv.{arxiv_id}"
        venue = fix.get("venue") or s.get("venue") or clean_venue(p.get("venue"))
        norm_t = re.sub(r"[^a-z0-9]", "", p["title"].lower())[:70]
        if norm_t in seen_titles:
            return
        seen_titles.add(norm_t)
        slug = slugify(p["title"], arxiv_id, doi)
        while slug in seen_slugs:
            slug += "x"
        seen_slugs.add(slug)
        url = f"https://arxiv.org/abs/{arxiv_id}" if arxiv_id else (f"https://doi.org/{doi}" if doi else "")
        if not url:
            url = "https://scholar.google.com/scholar?q=" + re.sub(r"\s+", "+", p["title"])
        rec = {
            "id": slug,
            "title": p["title"].strip(),
            "titleZh": s["titleZh"].strip(),
            "authors": fix.get("authors", p.get("authors") or []),
            "venue": venue,
            "date": p.get("date") or "",
            "year": int((p.get("date") or "0000")[:4]) if (p.get("date") or "")[:4].isdigit() else None,
            "citations": fix["citations"] if "citations" in fix else p.get("citations"),
            "arxivId": arxiv_id,
            "doi": doi,
            "url": url,
            "topics": topics,
            "curatedTopics": curated,
            "tags": tags,
            "summaryZh": s["summaryZh"].strip(),
            "abstract": (p.get("abstract") or "")[:1500],
            "source": "backfill",
        }
        papers.append(rec)

    for i, p in enumerate(selected):
        if i in sum_ws:
            add(p, sum_ws[i], "ws", i)
    for i, p in enumerate(supplement):
        if i in sum_sup:
            add(p, sum_sup[i], "sup", i)
    for i, p in enumerate(supplement2):
        if i in sum_t:
            add(p, sum_t[i], "sup2", i)

    # 每日扩库批次(fill_day.py 产出,fill_summaries.json 提供摘要)
    fill_p = os.path.join(CACHE, "fill_papers.json")
    fill_s = os.path.join(CACHE, "fill_summaries.json")
    if os.path.exists(fill_p):
        fill_store = json.load(open(fill_p, encoding="utf-8"))
        fill_sums = json.load(open(fill_s, encoding="utf-8")) if os.path.exists(fill_s) else {}
        for p in fill_store:
            s = fill_sums.get(p.get("fid"))
            if not s:
                continue
            sp = {
                "title": p["title"], "authors": p["authors"], "abstract": p["abstract"],
                "date": p["date"], "venue": p["venue"], "arxiv_id": p.get("arxiv_id", ""),
                "doi": p.get("doi", ""), "citations": p.get("citations", 0),
                "bucket": "recent" if p.get("date", "") >= "2025-01-01" else "impact",
            }
            add(sp, s, "fill", -1)

    papers.sort(key=lambda r: r["date"], reverse=True)

    # ---- 分类归一化 + 应用领域标注 ----
    def match_key(text, rules):
        hits = []
        low = text.lower()
        for key, pats in rules:
            if any(re.search(p, low, re.I) for p in pats):
                hits.append(key)
        return hits

    QINS = re.compile(r"quantum[- ]inspired|量子启发|ising machine|simulated bifurcation|coherent ising|quantum (particle swarm|differential evolution|evolutionary|swarm|memetic)|量子粒子群|量子差分进化|量子演化|量子模因", re.I)
    HYBR = re.compile(r"hybrid quantum|quantum-classical|混合量子|量子[- ]经典", re.I)
    for p in papers:
        text = " ".join([p.get("title", ""), p.get("titleZh", ""), p.get("summaryZh", ""), p.get("abstract", "")])
        # 全库拆分:hybrid 一类拆为 qinspired / hybrid 两个方向
        if "hybrid" in p["topics"]:
            qi, hy = bool(QINS.search(text)), bool(HYBR.search(text))
            repl = ([x for x in ["hybrid", "qinspired"] if (x == "hybrid" and hy) or (x == "qinspired" and qi)]) or (["qinspired"] if qi else ["hybrid"])
            out = []
            for t in p["topics"]:
                if t == "hybrid":
                    out.extend([x for x in repl if x not in out])
                elif t not in out:
                    out.append(t)
            p["topics"] = out
        if p.get("curatedTopics"):
            t = [x for x in p["topics"] if x != "applications"]
            if not t or t == ["quantum"]:
                auto = match_key(text, AUTO_TOPIC_RULES)[:1] or ["quantum"]
                t = (t + [x for x in auto if x not in t])[:2] or ["quantum"]
            p["topics"] = t
        else:
            hits = match_key(text, AUTO_TOPIC_RULES)
            p["topics"] = hits[:3] if hits else ["quantum"]
        p["domains"] = match_key(text, DOMAIN_RULES)[:3]

    db = {
        "version": 1,
        "updated": date.today().isoformat(),
        "topics": TOPIC_LABELS,
        "domains": DOMAIN_LABELS,
        "papers": papers,
    }
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(db, f, ensure_ascii=False, indent=1)
    from collections import Counter
    print("papers:", len(papers))
    print("primary topics:", dict(Counter(p["topics"][0] for p in papers)))
    print("tags:", dict(Counter(t for p in papers for t in p["tags"])))
    print("years:", dict(sorted(Counter(p["year"] for p in papers).items())))
    print("->", OUT)


if __name__ == "__main__":
    main()
