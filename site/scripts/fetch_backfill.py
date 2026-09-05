# -*- coding: utf-8 -*-
"""Backfill fetcher v2: pull historical papers (quantum optimization / ML4CO / LLM4CO)
from the OpenAlex API via curl (arXiv API unreachable on this network; OpenAlex
indexes arXiv preprints incl. abstracts and citation counts)."""
import json, os, re, subprocess, time, urllib.parse

CACHE = os.path.join(os.path.dirname(__file__), "cache")
os.makedirs(CACHE, exist_ok=True)

SELECT = "id,doi,title,display_name,authorships,publication_date,primary_location,cited_by_count,abstract_inverted_index,type"

IMPACT_QUERIES = [
    # (name, search-phrase, from_date or None, pages)
    ("landmarks",     "quantum approximate optimization algorithm", None, 1),
    ("ml4co_landmark","machine learning combinatorial optimization", None, 1),
    ("qaoa",          "QAOA quantum optimization", "2024-06-01", 1),
    ("annealing",     "quantum annealing optimization", "2024-06-01", 1),
    ("annealer",      "quantum annealer", "2024-06-01", 1),
    ("vqa",           "variational quantum algorithm optimization", "2024-06-01", 1),
    ("hybrid",        "hybrid quantum classical optimization algorithm", "2024-06-01", 1),
    ("quantco",       "quantum computing combinatorial optimization", "2024-06-01", 1),
    ("ml4co",         "machine learning combinatorial optimization", "2024-06-01", 1),
    ("llm4co",        "large language model combinatorial optimization", "2024-01-01", 1),
    ("quantfin",      "quantum portfolio optimization", "2024-01-01", 1),
]

RECENCY_QUERIES = [
    ("r_qaoa",     "QAOA", 1),
    ("r_qopt",     "quantum optimization", 1),
    ("r_anneal",   "quantum annealing", 1),
    ("r_vqa",      "variational quantum", 1),
    ("r_qco",      "quantum combinatorial optimization", 1),
    ("r_ml4co",    "machine learning combinatorial optimization", 1),
    ("r_llm4co",   "large language model combinatorial optimization", 1),
]
RECENCY_FROM = "2026-04-01"


def fetch_json(url, retries=3):
    for i in range(retries):
        try:
            r = subprocess.run(
                ["curl", "-s", "--max-time", "60", "-A", "quant-opt-daily/0.1 (mailto:research@example.com)", url],
                capture_output=True, timeout=70)
            if r.returncode == 0 and r.stdout.strip():
                return json.loads(r.stdout.decode("utf-8", "replace"))
            raise RuntimeError(f"curl rc={r.returncode} len={len(r.stdout)}")
        except Exception as e:
            print(f"  retry {i+1}: {e}", flush=True)
            time.sleep(4 * (i + 1))
    return None


def oa_abstract(inv):
    if not inv:
        return ""
    pos = {}
    for w, idxs in inv.items():
        for i in idxs:
            pos[i] = w
    return " ".join(pos[i] for i in sorted(pos))[:3000]


def arxiv_id_of(w):
    m = re.search(r"arxiv\.org/(?:abs|pdf)/([0-9]{4}\.[0-9]{4,5}|[a-z\-]+/[0-9]{7})", (w.get("primary_location") or {}).get("landing_page_url") or "")
    if m:
        return m.group(1)
    doi = (w.get("doi") or "").replace("https://doi.org/", "")
    m = re.match(r"10\.48550/arxiv\.(.+)", doi, re.I)
    return m.group(1) if m else ""


def page_query(name, q, since, sort, pages):
    out = []
    for p in range(1, pages + 1):
        params = {
            "search": q,
            "sort": sort,
            "per-page": "100",
            "page": str(p),
            "select": SELECT,
            "mailto": "research@example.com",
        }
        filt = "type:article|preprint"
        if since:
            filt += f",from_publication_date:{since}"
        params["filter"] = filt
        url = "https://api.openalex.org/works?" + urllib.parse.urlencode(params)
        print(f"[OA] {name} p{p}: ...", flush=True)
        data = fetch_json(url)
        if not data:
            break
        results = data.get("results", [])
        for w in results:
            title = w.get("display_name") or w.get("title") or ""
            if not title:
                continue
            venue = ((w.get("primary_location") or {}).get("source") or {}).get("display_name") or ""
            out.append({
                "title": title,
                "authors": [a["author"]["display_name"] for a in (w.get("authorships") or [])[:30] if a.get("author")],
                "abstract": oa_abstract(w.get("abstract_inverted_index")),
                "date": w.get("publication_date") or "",
                "venue": venue or "OpenAlex",
                "arxiv_id": arxiv_id_of(w),
                "doi": (w.get("doi") or "").replace("https://doi.org/", ""),
                "citations": w.get("cited_by_count", 0),
                "type": w.get("type", ""),
                "src": [f"oa:{name}"],
            })
        print(f"  -> {len(results)} entries", flush=True)
        if len(results) < 100:
            break
        time.sleep(0.5)
    return out


def norm_title(t):
    return re.sub(r"[^a-z0-9]", "", t.lower())


def main():
    raw = []
    for name, q, since, pages in IMPACT_QUERIES:
        raw += page_query(name, q, since, "cited_by_count:desc", pages)
    for name, q, pages in RECENCY_QUERIES:
        raw += page_query(name, q, RECENCY_FROM, "publication_date:desc", pages)

    merged, seen = [], {}
    for p in raw:
        key = norm_title(p["title"])[:80]
        if not key or len(key) < 10:
            continue
        if key in seen:
            ex = seen[key]
            ex["citations"] = max(ex["citations"] or 0, p["citations"] or 0)
            if ex["venue"] in ("OpenAlex",) and p["venue"] not in ("OpenAlex",):
                ex["venue"] = p["venue"]
            if not ex["arxiv_id"] and p["arxiv_id"]:
                ex["arxiv_id"] = p["arxiv_id"]
            for s in p["src"]:
                if s not in ex["src"]:
                    ex["src"].append(s)
            continue
        seen[key] = p
        merged.append(p)

    path = os.path.join(CACHE, "raw_merged.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(merged, f, ensure_ascii=False)
    print(f"\nTOTAL: {len(raw)} raw -> {len(merged)} unique -> {path}")
    by_year = {}
    for p in merged:
        y = (p["date"] or "????")[:4]
        by_year[y] = by_year.get(y, 0) + 1
    print("by year:", dict(sorted(by_year.items())))


if __name__ == "__main__":
    main()
