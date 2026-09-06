# -*- coding: utf-8 -*-
"""每日扩库流水线(供凌晨定时任务与人工调用):
用法: python fill_day.py "search phrase 1" "search phrase 2" ...
从 OpenAlex 抓取候选论文,与库内已有内容去重后追加到 cache/fill_papers.json,
并把待写摘要的条目输出到 cache/fill_worksheet.jsonl。
之后由 AI 按 cache/fill_summaries.json 的格式 {"<fid>": {"titleZh","summaryZh"}} 补摘要,
build_db.py 会自动把已有摘要的条目合入 papers-db.json。"""
import json, os, re, subprocess, time, urllib.parse, hashlib, sys

BASE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(BASE, "cache")
ROOT = os.path.abspath(os.path.join(BASE, "..", ".."))
SELECT = "id,doi,title,display_name,authorships,publication_date,primary_location,cited_by_count,abstract_inverted_index,type"
BLOCK = [r"zenodo", r"ssrn", r"researchgate", r"creative and open research", r"preprints\.org", r"\bosf\b", r"authorea", r"research square", r"techrxiv"]


def curl_json(url):
    for i in range(3):
        try:
            r = subprocess.run(["curl", "-s", "--max-time", "60", "-A", "quant-opt-daily/0.1 (mailto:research@example.com)", url],
                               capture_output=True, timeout=70)
            if r.returncode == 0 and r.stdout.strip():
                return json.loads(r.stdout.decode("utf-8", "replace"))
        except Exception:
            pass
        time.sleep(4)
    return None


def oa_abstract(inv):
    if not inv:
        return ""
    pos = {}
    for w, idxs in inv.items():
        for i in idxs:
            pos[i] = w
    return " ".join(pos[i] for i in sorted(pos))


def norm(t):
    return re.sub(r"[^a-z0-9]", "", (t or "").lower())[:70]


def fid_of(title):
    return hashlib.md5(norm(title).encode()).hexdigest()[:12]


def existing_keys():
    keys = set()
    db = json.load(open(os.path.join(ROOT, "papers-db.json"), encoding="utf-8"))
    for p in db["papers"]:
        keys.add(norm(p["title"]))
        if p.get("arxivId"):
            keys.add(p["arxivId"])
    fill_p = os.path.join(CACHE, "fill_papers.json")
    if os.path.exists(fill_p):
        for p in json.load(open(fill_p, encoding="utf-8")):
            keys.add(norm(p["title"]))
    return keys


def main():
    phrases = sys.argv[1:]
    if not phrases:
        print("usage: fill_day.py \"phrase1\" \"phrase2\" ...")
        return
    since = os.environ.get("FILL_SINCE", "2024-01-01")
    keys = existing_keys()
    fill_p = os.path.join(CACHE, "fill_papers.json")
    store = json.load(open(fill_p, encoding="utf-8")) if os.path.exists(fill_p) else []

    added = 0
    for q in phrases:
        params = {
            "filter": f"title_and_abstract.search:{q},from_publication_date:{since},type:article|preprint",
            "sort": os.environ.get("FILL_SORT", "relevance_score:desc"),
            "per-page": os.environ.get("FILL_PER_PAGE", "50"),
            "select": SELECT,
            "mailto": "research@example.com",
        }
        url = "https://api.openalex.org/works?" + urllib.parse.urlencode(params)
        data = curl_json(url)
        n = 0
        for w in (data or {}).get("results", []):
            title = w.get("display_name") or w.get("title") or ""
            abstract = oa_abstract(w.get("abstract_inverted_index"))
            if not title or len(abstract) < 150:
                continue
            venue = ((w.get("primary_location") or {}).get("source") or {}).get("display_name") or ""
            if any(re.search(b, venue, re.I) for b in BLOCK):
                continue
            date = w.get("publication_date") or ""
            if date[:4] in ("2027", "2028", ""):
                continue
            doi = (w.get("doi") or "").replace("https://doi.org/", "")
            arxiv = ""
            m = re.search(r"arxiv\.org/(?:abs|pdf)/([0-9]{4}\.[0-9]{4,5})", (w.get("primary_location") or {}).get("landing_page_url") or "")
            if m:
                arxiv = m.group(1)
            elif re.match(r"10\.48550/arxiv\.(.+)", doi, re.I):
                arxiv = re.match(r"10\.48550/arxiv\.(.+)", doi, re.I).group(1)
            k = norm(title)
            if k in keys or (arxiv and arxiv in keys):
                continue
            keys.add(k)
            fid = fid_of(title)
            store.append({
                "fid": fid,
                "title": title,
                "authors": [a["author"]["display_name"] for a in (w.get("authorships") or [])[:30] if a.get("author")],
                "abstract": abstract[:2500],
                "date": date,
                "venue": venue or "预印本",
                "arxiv_id": arxiv,
                "doi": doi,
                "citations": w.get("cited_by_count", 0),
                "theme": q[:40],
            })
            n += 1
        print(f"[{q[:36]}] +{n}", flush=True)
        time.sleep(0.5)

    with open(fill_p, "w", encoding="utf-8") as f:
        json.dump(store, f, ensure_ascii=False, indent=1)

    # 待写摘要工作单:还没有摘要的条目
    sums = {}
    sums_p = os.path.join(CACHE, "fill_summaries.json")
    if os.path.exists(sums_p):
        sums = json.load(open(sums_p, encoding="utf-8"))
    todo = [p for p in store if p["fid"] not in sums]
    with open(os.path.join(CACHE, "fill_worksheet.jsonl"), "w", encoding="utf-8") as f:
        for p in todo:
            f.write(json.dumps({"fid": p["fid"], "title": p["title"], "venue": p["venue"][:50], "date": p["date"],
                                "cites": p["citations"], "authors": p["authors"][:5], "abs": p["abstract"][:520]},
                               ensure_ascii=False) + "\n")
    print(f"store={len(store)}, 待写摘要={len(todo)} (fill_worksheet.jsonl)")


if __name__ == "__main__":
    main()
