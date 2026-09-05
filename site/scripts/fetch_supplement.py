# -*- coding: utf-8 -*-
"""Supplement fetch: (1) landmark papers by exact-title lookup, (2) high-precision
title-search recency sweep. Outputs cache/supplement_worksheet.jsonl."""
import json, os, re, subprocess, time, urllib.parse

BASE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(BASE, "cache")
SELECT = "id,doi,title,display_name,authorships,publication_date,primary_location,cited_by_count,abstract_inverted_index,type"

LANDMARKS = [
    # (title, topics)
    ("A Quantum Approximate Optimization Algorithm", ["qaoa", "foundational"]),
    ("Variational quantum algorithms", ["vqa", "foundational"]),
    ("From the Quantum Approximate Optimization Algorithm to a Quantum Alternating Operator Ansatz", ["qaoa", "foundational"]),
    ("Quantum Approximate Optimization Algorithm: Performance, Mechanism, and Implementation on Near-Term Devices", ["qaoa", "foundational"]),
    ("Quantum approximate optimization of non-planar graph problems on a planar superconducting processor", ["qaoa", "foundational"]),
    ("Quantum optimization of maximum independent set using Rydberg atom arrays", ["annealing", "foundational"]),
    ("A review on Quantum Approximate Optimization Algorithm and its variants", ["qaoa"]),
    ("Quantum annealing in the transverse Ising model", ["annealing", "foundational"]),
    ("Quantum annealing for industry applications: introduction and review", ["annealing"]),
    ("Beyond-classical computation in quantum simulation", ["annealing"]),
    ("Warm-starting quantum optimization", ["qaoa", "hybrid"]),
    ("Quantum computing for finance", ["quantum"]),
    ("Quantum-enhanced Markov chain Monte Carlo", ["quantum"]),
    ("Combinatorial optimization by simulating adiabatic bifurcations in nonlinear Hamiltonian systems", ["hybrid"]),
    ("A coherent Ising machine for 2000-node optimization problems", ["hybrid"]),
    ("Quantum Optimization: Potential, Challenges, and the Path Forward", ["quantum"]),
    ("Attention, Learn to Solve Routing Problems!", ["ml4co", "foundational"]),
    ("Learning Combinatorial Optimization Algorithms over Graphs", ["ml4co", "foundational"]),
    ("Neural Combinatorial Optimization with Reinforcement Learning", ["ml4co", "foundational"]),
    ("Pointer Networks", ["ml4co", "foundational"]),
    ("Combinatorial optimization and reasoning with graph neural networks", ["ml4co"]),
    ("Exact Combinatorial Optimization with Graph Convolutional Neural Networks", ["ml4co", "foundational"]),
    ("POMO: Policy Optimization with Multiple Optima for Reinforcement Learning", ["ml4co"]),
    ("Mathematical discoveries from program search with large language models", ["llm4co", "foundational"]),
    ("Evolution of Heuristics: Towards Efficient Automatic Algorithm Design Using Large Language Model", ["llm4co"]),
    ("ReEvo: Large Language Models as Hyper-Heuristics with Reflective Evolution", ["llm4co"]),
    ("Large Language Models as Optimizers", ["llm4co"]),
    ("Large Language Models as Evolutionary Optimizers", ["llm4co"]),
    ("Algorithm Evolution Using Large Language Model", ["llm4co"]),
    ("AlphaEvolve: A coding agent for scientific and algorithmic discovery", ["llm4co"]),
]

RECENT = [
    # (name, title.search phrase, from_date, topics-hint)
    ("t_qaoa", "QAOA", "2025-06-01"),
    ("t_qaoa2", "quantum approximate optimization", "2025-06-01"),
    ("t_anneal", "quantum annealing", "2025-06-01"),
    ("t_qopt", "quantum optimization", "2025-06-01"),
    ("t_qco", "combinatorial optimization quantum", "2025-03-01"),
    ("t_vqa", "variational quantum optimization", "2025-03-01"),
    ("t_llm", "large language model combinatorial optimization", "2025-01-01"),
    ("t_llm2", "language models heuristic design", "2025-01-01"),
    ("t_nco", "neural combinatorial optimization", "2025-01-01"),
    ("t_gnnco", "graph neural network combinatorial optimization", "2025-01-01"),
]

BLOCK = [r"zenodo", r"ssrn", r"researchgate", r"creative and open research", r"preprints\.org", r"\bosf\b", r"authorea", r"research square", r"techrxiv"]


def curl_json(url):
    for i in range(3):
        try:
            r = subprocess.run(["curl", "-s", "--max-time", "60", "-A", "quant-opt-daily/0.1 (mailto:research@example.com)", url],
                               capture_output=True, timeout=70)
            if r.returncode == 0 and r.stdout.strip():
                return json.loads(r.stdout.decode("utf-8", "replace"))
        except Exception as e:
            print("  retry", i, e, flush=True)
        time.sleep(3)
    return None


def oa_abstract(inv):
    if not inv:
        return ""
    pos = {}
    for w, idxs in inv.items():
        for i in idxs:
            pos[i] = w
    return " ".join(pos[i] for i in sorted(pos))


def arxiv_id_of(w):
    m = re.search(r"arxiv\.org/(?:abs|pdf)/([0-9]{4}\.[0-9]{4,5})", (w.get("primary_location") or {}).get("landing_page_url") or "")
    if m:
        return m.group(1)
    doi = (w.get("doi") or "").replace("https://doi.org/", "")
    m = re.match(r"10\.48550/arxiv\.(.+)", doi, re.I)
    return m.group(1) if m else ""


def to_rec(w):
    venue = ((w.get("primary_location") or {}).get("source") or {}).get("display_name") or ""
    return {
        "title": w.get("display_name") or w.get("title") or "",
        "authors": [a["author"]["display_name"] for a in (w.get("authorships") or [])[:30] if a.get("author")],
        "abstract": oa_abstract(w.get("abstract_inverted_index")),
        "date": w.get("publication_date") or "",
        "venue": venue or "OpenAlex",
        "arxiv_id": arxiv_id_of(w),
        "doi": (w.get("doi") or "").replace("https://doi.org/", ""),
        "citations": w.get("cited_by_count", 0),
        "type": w.get("type", ""),
    }


def norm(t):
    return re.sub(r"[^a-z0-9]", "", t.lower())


def main():
    with open(os.path.join(CACHE, "selected.json"), encoding="utf-8") as f:
        existing = {norm(p["title"])[:70] for p in json.load(f)}
    out = []

    # (1) landmarks
    for title, topics in LANDMARKS:
        params = {"filter": f"title.search:{title}", "per-page": "5", "select": SELECT, "sort": "cited_by_count:desc", "mailto": "research@example.com"}
        data = curl_json("https://api.openalex.org/works?" + urllib.parse.urlencode(params))
        best = None
        want = set(re.findall(r"[a-z0-9]+", title.lower()))
        for w in (data or {}).get("results", []):
            got = set(re.findall(r"[a-z0-9]+", (w.get("display_name") or "").lower()))
            if len(want & got) / max(1, len(want)) >= 0.75:
                if best is None or (w.get("cited_by_count", 0) > best.get("cited_by_count", 0)):
                    best = w
        if not best:
            print(f"[landmark] MISS: {title}", flush=True)
            continue
        rec = to_rec(best)
        rec["topics"] = topics
        rec["bucket"] = "foundational" if "foundational" in topics else "impact"
        rec["src"] = ["landmark"]
        print(f"[landmark] {rec['title'][:60]} | {rec['venue'][:30]} | {rec['date']} | cites={rec['citations']}", flush=True)
        k = norm(rec["title"])[:70]
        if k in existing:
            print("   (already selected, skip)")
            continue
        existing.add(k)
        out.append(rec)
        time.sleep(0.3)

    # (2) recency precision sweep
    recent = []
    for name, q, since in RECENT:
        params = {"filter": f"title.search:{q},from_publication_date:{since},type:article|preprint",
                  "sort": "publication_date:desc", "per-page": "100", "select": SELECT, "mailto": "research@example.com"}
        data = curl_json("https://api.openalex.org/works?" + urllib.parse.urlencode(params))
        n = 0
        for w in (data or {}).get("results", []):
            rec = to_rec(w)
            if not rec["title"] or not rec["abstract"]:
                continue
            if any(re.search(b, rec["venue"], re.I) for b in BLOCK):
                continue
            if (rec["date"] or "")[:4] in ("2027", "2028"):
                continue
            k = norm(rec["title"])[:70]
            if k in existing:
                continue
            existing.add(k)
            rec["src"] = [name]
            rec["bucket"] = "recent"
            recent.append(rec)
            n += 1
        print(f"[recent] {name}: +{n}", flush=True)
        time.sleep(0.4)

    # topic tagging for recent
    RULES = [("qaoa", r"\bQAOA\b|quantum approximate optimization|quantum alternating operator"),
             ("llm4co", r"large language model|\bLLMs?\b|language model"),
             ("annealing", r"quantum anneal|adiabatic quantum|rydberg|ising machine"),
             ("vqa", r"variational quantum|\bVQE\b"),
             ("hybrid", r"hybrid quantum|quantum-classical|quantum[- ]inspired"),
             ("ml4co", r"neural|graph neural|reinforcement learning|machine learning|learning-based|learned"),
             ("quantum", r"quantum")]
    for r in recent:
        t = (r["title"] + " " + r["abstract"]).lower()
        r["topics"] = [k for k, pat in RULES if re.search(pat, t, re.I)] or ["quantum"]

    # quality/ranking for recent: prefer arXiv/journals with known publishers; keep balance
    def qscore(r):
        s = 0
        v = r["venue"].lower()
        if "arxiv" in v: s += 2
        if any(x in v for x in ["nature", "science", "physical review", "prx", "quantum", "npj", "ieee transactions", "acm", "informs", "european journal of operational", "computers & operations", "neurips", "icml", "iclr", "aaai", "ijcai", "advanced"]): s += 3
        s += min(r["citations"], 10) * 0.5
        return s
    recent.sort(key=lambda r: (qscore(r), r["date"]), reverse=True)
    caps = {"qaoa": 14, "annealing": 8, "vqa": 6, "hybrid": 6, "llm4co": 12, "ml4co": 10, "quantum": 6}
    cnt, picked = {}, []
    for r in recent:
        prim = r["topics"][0]
        if cnt.get(prim, 0) < caps.get(prim, 5):
            cnt[prim] = cnt.get(prim, 0) + 1
            picked.append(r)
    print("recent picked:", len(picked), cnt)

    final = out + picked
    with open(os.path.join(CACHE, "supplement.json"), "w", encoding="utf-8") as f:
        json.dump(final, f, ensure_ascii=False, indent=1)
    with open(os.path.join(CACHE, "supplement_worksheet.jsonl"), "w", encoding="utf-8") as f:
        for i, p in enumerate(final):
            f.write(json.dumps({"idx": i, "title": p["title"], "venue": p["venue"][:60], "date": p["date"], "cites": p["citations"],
                                "topics": p["topics"], "authors": p["authors"][:5], "abs": p["abstract"][:420]}, ensure_ascii=False) + "\n")
    print("supplement total:", len(final))


if __name__ == "__main__":
    main()
