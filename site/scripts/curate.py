# -*- coding: utf-8 -*-
"""Curate raw_merged.json -> selected backfill set + summarization worksheet."""
import json, os, re
from collections import defaultdict

BASE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(BASE, "cache")

TOPIC_RULES = [
    # (topic, regex list on title+abstract) first match = primary topic
    ("qaoa", [r"\bQAOA\b", r"quantum approximate optimization"]),
    ("llm4co", [r"large language model", r"\bLLMs?\b"]),
    ("annealing", [r"quantum anneal", r"quantum annealer", r"adiabatic quantum"]),
    ("vqa", [r"variational quantum", r"\bVQE\b", r"variational eigensolver"]),
    ("hybrid", [r"hybrid quantum", r"quantum-classical", r"quantum[- ]inspired"]),
    ("ml4co", [r"machine learning", r"graph neural", r"reinforcement learning", r"neural network", r"deep learning"]),
    ("quantum", [r"quantum"]),
]

REQUIRED_PATTERNS = [
    r"\bQAOA\b", r"quantum approximate optimization", r"quantum anneal", r"quantum annealer",
    r"adiabatic quantum", r"variational quantum", r"\bVQE\b", r"hybrid quantum", r"quantum-classical",
    r"quantum[- ]inspired", r"quantum computing", r"quantum computer", r"quantum algorithm",
    r"quantum optimizer", r"quantum optimization", r"quantum-enhanced", r"quantum enhanced",
    r"quantum hardware", r"quantum processor", r"quantum supremacy", r"quantum advantage",
    r"large language model", r"\bLLMs?\b", r"machine learning", r"graph neural", r"reinforcement learning",
    r"deep learning", r"neural network", r"neural combinatorial",
]

CO_HINTS = [
    r"combinatorial optimization", r"optimization problem", r"MaxCut", r"max-cut",
    r"portfolio", r"scheduling", r"knapsack", r"travelling salesman", r"traveling salesman",
    r"\bTSP\b", r"vehicle routing", r"graph coloring", r"maximum (independent|clique)",
    r"MIS\b", r"unit commitment", r"job shop", r"quadratic assignment", r"\bSAT\b",
    r"binary optimization", r"Ising", r"QUBO", r"mixed-integer", r"constraint satisfaction",
    r"optimization", r"optimisation",
]

JUNK_TITLE = [
    r"survey of surveys", r"conference proceedings", r"table of contents",
    r"corrigendum", r"erratum", r"publisher'?s note", r"reviewer acknowledgement",
]

BLOCKLIST_VENUES = [
    r"zenodo", r"social science research network", r"\bssrn\b", r"researchgate",
    r"creative and open research", r"preprints\.org", r"osf\.io", r"\bosf\b",
]


def txt(p):
    return (p["title"] + " " + p["abstract"]).lower()


def match_any(t, pats):
    for pat in pats:
        if re.search(pat, t, re.I):
            return True
    return False


def topics_of(p):
    t = txt(p)
    found = []
    for topic, pats in TOPIC_RULES:
        if match_any(t, pats):
            found.append(topic)
    if not found:
        found = ["quantum"] if re.search(r"quantum", t) else []
    return found


def main():
    with open(os.path.join(CACHE, "raw_merged.json"), encoding="utf-8") as f:
        papers = json.load(f)

    sel, stats = [], defaultdict(int)
    for p in papers:
        t = txt(p)
        year = (p["date"] or "0000")[:4]
        if year in ("2027", "2028", "0000"):
            stats["drop-baddate"] += 1
            continue
        if any(re.search(j, p["title"], re.I) for j in JUNK_TITLE):
            stats["drop-junktitle"] += 1
            continue
        if any(re.search(b, p["venue"], re.I) for b in BLOCKLIST_VENUES):
            stats["drop-blockvenue"] += 1
            continue
        if not match_any(t, REQUIRED_PATTERNS):
            stats["drop-irrelevant"] += 1
            continue
        if not p["abstract"] and (p["citations"] or 0) < 20:
            stats["drop-noabstract"] += 1
            continue
        topics = topics_of(p)
        if not topics:
            stats["drop-notopic"] += 1
            continue
        p["topics"] = topics
        is_co = match_any(t, CO_HINTS)
        if not is_co:
            stats["drop-notco"] += 1
            continue
        p["is_co"] = is_co
        if year.isdigit() and int(year) <= 2023:
            if (p["citations"] or 0) >= 120 and re.search(r"quantum|neural|machine learning|reinforcement|large language", t):
                p["bucket"] = "foundational"
                sel.append(p)
                stats["foundational"] += 1
            else:
                stats["drop-old-lowcite"] += 1
            continue
        recency = any(s.startswith("oa:r_") for s in p["src"])
        if recency:
            if int(year) >= 2026:
                p["bucket"] = "recent"
                sel.append(p)
                stats["recent"] += 1
            else:
                stats["drop-recency-old"] += 1
        else:
            if (p["citations"] or 0) >= 4:
                p["bucket"] = "impact"
                sel.append(p)
                stats["impact"] += 1
            else:
                stats["drop-lowcite"] += 1

    # relevance score for ranking recency papers
    STRONG = [r"\bqaoa\b", r"quantum approximate optimization", r"quantum anneal", r"adiabatic quantum",
              r"variational quantum", r"\bvqe\b", r"hybrid quantum", r"quantum-classical",
              r"quantum computing.*optimization", r"combinatorial optimization", r"large language model",
              r"graph neural", r"reinforcement learning", r"neural combinatorial", r"qubo", r"ising",
              r"maxcut", r"max-cut", r"portfolio optimization", r"\bTSP\b", r"vehicle routing", r"knapsack"]
    def relscore(p):
        t = txt(p)
        s = sum(2 if re.search(pat, p["title"], re.I) else 0 for pat in STRONG)
        s += sum(1 for pat in STRONG if re.search(pat, t))
        return s

    # per-topic caps over the combined set; priority: foundational > impact(citations) > recent(relevance+date)
    cap = {"qaoa": 32, "annealing": 20, "vqa": 16, "hybrid": 18, "ml4co": 20, "llm4co": 12, "quantum": 16}
    FOUND_CAP = 18
    rank = {"foundational": 0, "impact": 1, "recent": 2}
    def sort_key(p):
        if p["bucket"] == "foundational":
            return (0, -(p["citations"] or 0))
        if p["bucket"] == "impact":
            return (1, -(p["citations"] or 0))
        return (2, -relscore(p), p["date"])
    by_topic = defaultdict(int)
    found_n = 0
    final = []
    for p in sorted(sel, key=sort_key):
        if p["bucket"] == "foundational":
            if found_n >= FOUND_CAP:
                continue
            found_n += 1
            final.append(p)
            continue
        prim = p["topics"][0]
        if by_topic[prim] < cap.get(prim, 14):
            by_topic[prim] += 1
            final.append(p)

    # dedupe near-identical titles again after filters
    seen, dedup = set(), []
    def norm(s):
        return re.sub(r"[^a-z0-9]", "", s.lower())[:70]
    for p in sorted(final, key=lambda x: (-(x["citations"] or 0), x["date"]), reverse=False):
        k = norm(p["title"])
        if k in seen:
            continue
        seen.add(k)
        dedup.append(p)
    final = dedup

    final.sort(key=lambda x: (x["date"] or ""), reverse=True)
    with open(os.path.join(CACHE, "selected.json"), "w", encoding="utf-8") as f:
        json.dump(final, f, ensure_ascii=False, indent=1)

    # worksheet for manual Chinese summaries
    ws = os.path.join(CACHE, "worksheet.jsonl")
    with open(ws, "w", encoding="utf-8") as f:
        for i, p in enumerate(final):
            f.write(json.dumps({
                "idx": i,
                "title": p["title"],
                "venue": p["venue"],
                "date": p["date"],
                "citations": p["citations"],
                "arxiv_id": p["arxiv_id"],
                "doi": p["doi"],
                "topics": p["topics"],
                "authors": p["authors"][:8],
                "abstract": p["abstract"][:620],
            }, ensure_ascii=False) + "\n")

    print("stats:", dict(sorted(stats.items())))
    print("final:", len(final))
    bt = defaultdict(int)
    bb = defaultdict(int)
    for p in final:
        bt[p["topics"][0]] += 1
        bb[p["bucket"]] += 1
    print("by primary topic:", dict(bt))
    print("by bucket:", dict(bb))


if __name__ == "__main__":
    main()
