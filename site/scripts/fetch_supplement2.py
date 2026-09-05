# -*- coding: utf-8 -*-
"""增量回溯:专抓 量子硬件平台 / 行业应用 两个方向的论文,输出 worksheet2.jsonl 供撰写中文摘要。"""
import json, os, re, subprocess, time, urllib.parse

BASE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(BASE, "cache")
SELECT = "id,doi,title,display_name,authorships,publication_date,primary_location,cited_by_count,abstract_inverted_index,type"
BLOCK = [r"zenodo", r"ssrn", r"researchgate", r"creative and open research", r"preprints\.org", r"\bosf\b", r"authorea", r"research square", r"techrxiv"]

QUERIES = [
    # (name, title.search 短语, from_date, sort)
    ("hw_sc", "superconducting quantum processor", "2024-06-01", "cited_by_count:desc"),
    ("hw_ion", "trapped-ion quantum", "2024-06-01", "cited_by_count:desc"),
    ("hw_atom", "neutral-atom quantum", "2024-06-01", "cited_by_count:desc"),
    ("hw_photon", "photonic quantum computing", "2024-06-01", "cited_by_count:desc"),
    ("hw_qpu_r", "quantum processor", "2026-01-01", "publication_date:desc"),
    ("hw_r", "superconducting qubits", "2026-01-01", "publication_date:desc"),
    ("hw_ion_r", "trapped-ion quantum", "2026-01-01", "publication_date:desc"),
    ("hw_atom_r", "rydberg atom array", "2026-01-01", "publication_date:desc"),
    ("app_fin", "quantum portfolio optimization", "2024-06-01", "cited_by_count:desc"),
    ("app_route", "quantum vehicle routing", "2024-01-01", "cited_by_count:desc"),
    ("app_sched", "quantum scheduling", "2024-06-01", "cited_by_count:desc"),
    ("app_energy", "quantum optimization energy", "2024-06-01", "cited_by_count:desc"),
    ("app_ind", "quantum annealing industry", "2024-01-01", "cited_by_count:desc"),
    ("app_fin_r", "quantum finance optimization", "2026-01-01", "publication_date:desc"),
    ("app_energy_r", "quantum power system", "2026-01-01", "publication_date:desc"),
    ("app_log_r", "quantum logistics", "2025-06-01", "publication_date:desc"),
]


def curl_json(url):
    for i in range(3):
        try:
            r = subprocess.run(["curl", "-s", "--max-time", "60", "-A", "quant-opt-daily/0.1 (mailto:research@example.com)", url],
                               capture_output=True, timeout=70)
            if r.returncode == 0 and r.stdout.strip():
                return json.loads(r.stdout.decode("utf-8", "replace"))
        except Exception:
            pass
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


def to_rec(w):
    venue = ((w.get("primary_location") or {}).get("source") or {}).get("display_name") or ""
    doi = (w.get("doi") or "").replace("https://doi.org/", "")
    arxiv = ""
    m = re.search(r"arxiv\.org/(?:abs|pdf)/([0-9]{4}\.[0-9]{4,5})", (w.get("primary_location") or {}).get("landing_page_url") or "")
    if m:
        arxiv = m.group(1)
    elif re.match(r"10\.48550/arxiv\.(.+)", doi, re.I):
        arxiv = re.match(r"10\.48550/arxiv\.(.+)", doi, re.I).group(1)
    return {
        "title": w.get("display_name") or w.get("title") or "",
        "authors": [a["author"]["display_name"] for a in (w.get("authorships") or [])[:30] if a.get("author")],
        "abstract": oa_abstract(w.get("abstract_inverted_index")),
        "date": w.get("publication_date") or "",
        "venue": venue or "OpenAlex",
        "arxiv_id": arxiv,
        "doi": doi,
        "citations": w.get("cited_by_count", 0),
        "src": [],
    }


def norm(t):
    return re.sub(r"[^a-z0-9]", "", (t or "").lower())[:70]


def main():
    ROOT_DB = os.path.abspath(os.path.join(BASE, "..", ".."))
    db = json.load(open(os.path.join(ROOT_DB, "papers-db.json"), encoding="utf-8"))
    existing = {norm(p["title"]) for p in db["papers"]}
    existing |= {norm(p.get("arxivId") or p["title"]) for p in db["papers"]}

    raw = []
    for name, q, since, sort in QUERIES:
        params = {"filter": f"title.search:{q},from_publication_date:{since},type:article|preprint",
                  "sort": sort, "per-page": "50", "select": SELECT, "mailto": "research@example.com"}
        url = "https://api.openalex.org/works?" + urllib.parse.urlencode(params)
        data = curl_json(url)
        n = 0
        for w in (data or {}).get("results", []):
            rec = to_rec(w)
            if not rec["title"] or len(rec["abstract"]) < 120:
                continue
            if any(re.search(b, rec["venue"], re.I) for b in BLOCK):
                continue
            y = (rec["date"] or "")[:4]
            if y in ("2027", "2028", ""):
                continue
            k = norm(rec["title"])
            if k in existing:
                continue
            existing.add(k)
            rec["src"].append(name)
            raw.append(rec)
            n += 1
        print(f"[{name}] +{n}", flush=True)
        time.sleep(0.4)

    # 排除与组合优化无关的硬件论文:标题或摘要需含优化/组合/退火/QAOA 等信号
    OPT = re.compile(r"optimiz|optimis|combinatorial|QUBO|Ising|MaxCut|max-cut|annealing|QAOA|variational|scheduling|routing|portfolio|benchmark", re.I)
    cand = [p for p in raw if OPT.search(p["title"] + " " + p["abstract"][:800])]
    print(f"raw {len(raw)} -> CO-relevant {len(cand)}")

    cand.sort(key=lambda p: (p["citations"] or 0), reverse=True)
    # 配额:硬件 / 应用大致均衡,总量 ~55
    hw, app = [], []
    for p in cand:
        is_hw = re.search(r"superconduct|trapped[- ]ion|neutral[- ]atom|rydberg|photonic|spin qubit|quantum (processor|hardware|chip)|qubit", p["title"] + " " + p["abstract"][:300], re.I)
        (hw if is_hw else app).append(p)
    picked = hw[:28] + app[:27]
    picked.sort(key=lambda p: p["date"], reverse=True)
    with open(os.path.join(CACHE, "worksheet2.jsonl"), "w", encoding="utf-8") as f:
        for i, p in enumerate(picked):
            f.write(json.dumps({"idx": i, "title": p["title"], "venue": p["venue"][:60], "date": p["date"],
                                "cites": p["citations"], "authors": p["authors"][:5],
                                "abs": p["abstract"][:520]}, ensure_ascii=False) + "\n")
    with open(os.path.join(CACHE, "supplement2.json"), "w", encoding="utf-8") as f:
        json.dump(picked, f, ensure_ascii=False, indent=1)
    print("picked:", len(picked), "hw:", len(hw[:28]), "app:", len(app[:27]))


if __name__ == "__main__":
    main()
