# -*- coding: utf-8 -*-
"""云端扩库脚本(GitHub Actions 定时运行):
按主题轮换从 OpenAlex 抓取新论文 -> 范畴过滤 -> 自动生成模板化中文简介 ->
写入 fill_papers.json / fill_summaries.json(随后 build_db.py 合库、npm 构建发布)。
自包含:仅用标准库,无本地依赖。"""
import json, os, re, time, urllib.parse, urllib.request, hashlib, random
from collections import defaultdict

BASE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(BASE, "..", ".."))
SELECT = "id,doi,title,display_name,authorships,publication_date,primary_location,cited_by_count,abstract_inverted_index,type"
UA = {"User-Agent": "QuantOptDaily-ingest/1.0 (mailto:research@example.com)"}
BLOCK = re.compile(r"zenodo|ssrn|researchgate|preprints\.org|osf|authorea|research square|techrxiv", re.I)
QUANT = re.compile(r"quantum|QAOA|anneal|Ising|adiabatic|rydberg|trapped[- ]ion|superconducting qubit|photonic quantum|VQE|variational quantum|QUBO", re.I)
TELECOM = re.compile(r"wireless network|telecommunication|base station|spectrum|5G|6G|MIMO|beamform", re.I)
PHARMA = re.compile(r"drug discovery|protein|genom|clinical trial", re.I)

THEMES = [
    ["quantum satellite mission planning", "earth observation satellite scheduling quantum", "satellite constellation optimization quantum"],
    ["quantum large language model", "quantum machine learning combinatorial optimization", "quantum neural network optimization"],
    ["quantum portfolio optimization", "quantum annealing finance risk"],
    ["quantum optimization power grid", "quantum annealing energy scheduling"],
    ["quantum vehicle routing", "quantum computing supply chain optimization"],
    ["quantum job shop scheduling", "quantum annealing production scheduling"],
    ["quantum computing traffic optimization", "quantum annealing transport"],
    ["quantum computing materials discovery optimization", "quantum annealing chemistry"],
    ["superconducting qubit processor optimization", "trapped ion quantum optimization experiment"],
    ["quantum optimization benchmark", "QUBO Ising solver comparison", "tensor network quantum optimization"],
]

KW_CN = [
    (r"quantum anneal|量子退火", "量子退火"), (r"QAOA|quantum approximate optimization", "QAOA 量子近似优化"),
    (r"max[- ]?cut|最大割", "最大割问题"), (r"portfolio|投资组合", "投资组合优化"),
    (r"vehicle routing|路径规划|物流", "物流路径优化"), (r"scheduling|调度", "调度优化"),
    (r"smart grid|power grid|energy|电网|能源", "能源电力优化"), (r"satellite|spacecraft|earth observation|卫星", "卫星任务规划"),
    (r"supply chain|供应链", "供应链优化"), (r"large language model|LLM|大模型", "大模型方法"),
    (r"machine learning|reinforcement learning|deep learning|机器学习|强化学习", "机器学习方法"),
    (r"graph neural|图神经网络", "图神经网络"), (r"Ising|QUBO", "Ising/QUBO 建模"),
    (r"error mitigation|error correction|纠错|误差缓解", "纠错与误差缓解"), (r"benchmark|基准", "基准测试"),
    (r"traffic|交通", "交通优化"), (r"warehouse|仓储|inventory|库存", "仓储库存优化"),
    (r"anomaly detection|入侵检测|intrusion", "异常检测"), (r"feature selection|特征选择", "特征选择"),
    (r"semiconductor|superconducting|超导", "超导量子硬件"), (r"trapped[- ]ion|离子阱", "离子阱硬件"),
    (r"rydberg|neutral atom|中性原子|里德堡", "中性原子阵列"), (r"photonic|光量子", "光量子硬件"),
    (r"drone|uav|无人机", "无人机调度"), (r"cloud|edge computing|云|边缘计算", "云计算与边缘计算"),
]


def http_json(url):
    for i in range(4):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.loads(r.read().decode("utf-8", "replace"))
        except Exception as e:
            print(f"  retry {i+1}: {e}", flush=True)
            time.sleep(5 * (i + 1))
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


def cn_summary(p):
    text = p["title"] + " " + p["abstract"][:900]
    kws = [cn for pat, cn in KW_CN if re.search(pat, text, re.I)]
    if not kws:
        kws = ["量子计算"]
    year = p["date"][:4]
    venue = p["venue"]
    return (f"该文围绕{'、'.join(kws[:4])}展开研究,属于量子计算求解优化问题的相关成果;"
            f"发表于 {venue}({year})。方法与结论的完整表述参见原文摘要与原文链接。")


def load(path, default):
    if os.path.exists(path):
        return json.load(open(path, encoding="utf-8"))
    return default


def main():
    doy = int(os.environ.get("INGEST_DOY", str(random.randint(0, 364))))
    theme_idx = doy % len(THEMES)
    queries = THEMES[theme_idx]
    print(f"主题 {theme_idx}: {queries}", flush=True)

    db = load(os.path.join(ROOT, "papers-db.json"), {"papers": []})
    existing = set()
    for p in db["papers"]:
        existing.add(norm(p["title"]))
        if p.get("arxivId"):
            existing.add(p["arxivId"])
    fill_p = os.path.join(BASE, "fill_papers.json")
    fill_s = os.path.join(BASE, "fill_summaries.json")
    store = load(fill_p, [])
    sums = load(fill_s, {})
    for p in store:
        existing.add(norm(p["title"]))
        if p.get("arxiv_id"):
            existing.add(p["arxiv_id"])

    new_items = []
    for q in queries:
        params = {
            "filter": f"title_and_abstract.search:{q},from_publication_date:2025-01-01,type:article|preprint",
            "sort": "relevance_score:desc",
            "per-page": "40",
            "select": SELECT,
            "mailto": "research@example.com",
        }
        url = "https://api.openalex.org/works?" + urllib.parse.urlencode(params)
        data = http_json(url)
        n = 0
        for w in (data or {}).get("results", []):
            title = w.get("display_name") or w.get("title") or ""
            abstract = oa_abstract(w.get("abstract_inverted_index"))
            if not title or len(abstract) < 150:
                continue
            venue = ((w.get("primary_location") or {}).get("source") or {}).get("display_name") or ""
            if BLOCK.search(venue):
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
            if k in existing or (arxiv and arxiv in existing):
                continue
            existing.add(k)
            new_items.append({
                "fid": fid_of(title),
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
        print(f"[{q[:34]}] +{n}", flush=True)
        time.sleep(0.6)

    picked = new_items[:25]
    for p in picked:
        store.append(p)
        sums[p["fid"]] = {
            "titleZh": p["title"],
            "summaryZh": cn_summary(p),
        }
    json.dump(store, open(fill_p, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    json.dump(sums, open(fill_s, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"云端新增入库候选 {len(picked)} 篇(已含模板化中文简介,本地任务后续精读润色)")


if __name__ == "__main__":
    main()
