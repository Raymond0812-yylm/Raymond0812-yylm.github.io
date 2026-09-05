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

TOPIC_ORDER = ["qaoa", "annealing", "vqa", "hybrid", "hardware", "applications", "quantum", "ml4co", "llm4co"]

TOPIC_LABELS = {
    "qaoa": {"label": "量子近似优化", "desc": "QAOA 及其变体、参数策略、硬件实验与理论性能"},
    "annealing": {"label": "量子退火与绝热优化", "desc": "量子退火、绝热量子计算、反绝热驱动、退火机实验"},
    "vqa": {"label": "变分量子算法", "desc": "VQE/VQA 框架、ansatz 设计、贫瘠高原与可训练性"},
    "hybrid": {"label": "量子-经典混合与量子启发", "desc": "混合优化流水线、量子启发算法、Ising 机、进化计算×量子"},
    "hardware": {"label": "量子硬件平台", "desc": "超导、离子阱、中性原子、光量子等平台及面向优化的硬件进展"},
    "applications": {"label": "行业应用", "desc": "金融、能源、物流、调度、制药、通信等领域的量子/智能优化落地"},
    "quantum": {"label": "综述与基准", "desc": "领域综述、路线图、基准测试与开放问题"},
    "ml4co": {"label": "机器学习求解组合优化", "desc": "神经组合优化、GNN、强化学习、学习增强精确求解"},
    "llm4co": {"label": "大模型赋能优化", "desc": "LLM 自动设计启发式、LLM 作为优化器、LLM×进化计算"},
}


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

    papers.sort(key=lambda r: r["date"], reverse=True)
    db = {
        "version": 1,
        "updated": date.today().isoformat(),
        "topics": TOPIC_LABELS,
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
