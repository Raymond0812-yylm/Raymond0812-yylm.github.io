# -*- coding: utf-8 -*-
"""按扩充后的 9 方向体系,为 papers-db.json 全部论文重新打标。
方向优先级:先按研究域(llm4co/ml4co),再按量子算法(qaoa/vqa/annealing/hybrid),
再按载体与场景(hardware/applications),最后兜底(quantum=综述与基准)。"""
import json, os, re, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DB = os.path.join(ROOT, "papers-db.json")

# (key, 正则列表) —— 顺序即优先级
TOPIC_RULES = [
    ("llm4co", [r"large language model", r"\bLLMs?\b", r"语言模型", r"大模型",
                r"FunSearch", r"ReEvo", r"\bEoH\b", r"\bAEL\b", r"\bOPRO\b", r"AlphaEvolve"]),
    ("ml4co", [r"neural combinatorial", r"graph neural", r"learning to branch", r"learned (heuristic|solver|algorithm)",
               r"reinforcement learning", r"deep [- ]?reinforcement", r"神经组合优化", r"图神经网络",
               r"machine learning.{0,30}combinatorial", r"combinatorial optimization.{0,30}machine learning",
               r"pointer network", r"\bPOMO\b", r"attention model.{0,30}routing"]),
    ("qaoa", [r"\bQAOA\b", r"quantum approximate optimization", r"quantum alternating operator", r"量子近似优化"]),
    ("vqa", [r"variational quantum", r"\bVQE\b", r"barren plateau", r"变分量子", r"贫瘠高原",
             r"variational eigensolver", r"\bVQAs?\b"]),
    ("annealing", [r"quantum anneal", r"annealer", r"adiabatic quantum", r"reverse annealing",
                   r"量子退火", r"绝热量子", r"transverse[- ]field ising", r"quantum annealing"]),
    ("hardware", [r"superconducting (qubit|processor|quantum)", r"trapped[- ]ion", r"\brydberg\b",
                  r"neutral atom", r"photonic quantum", r"spin qubit", r"quantum (processor|hardware|chip)",
                  r"ion trap", r"超导量子", r"离子阱", r"中性原子", r"光量子", r"里德堡"]),
    ("hybrid", [r"hybrid quantum", r"quantum-classical", r"quantum[- ]inspired", r"ising machine",
                r"simulated bifurcation", r"coherent ising", r"混合量子", r"量子启发", r"量子[- ]经典",
                r"quantum[- ]classic(al)? (hybrid|loop)"]),
    ("applications", [r"portfolio", r"\bfinanc", r"credit scor", r"supply chain", r"vehicle routing",
                      r"schedul", r"job shop", r"microgrid", r"smart grid", r"power system", r"energy (management|optimization|dispatch)",
                      r"telecommunication", r"network (routing|design|optimization)", r"drug", r"docking", r"protein",
                      r"material design", r"logistics", r"aerospace", r"antenna", r"inventory", r"newsvendor",
                      r"投资组合", r"金融", r"物流", r"调度", r"电网", r"供应链", r"药物", r"碳排"]),
    ("quantum", [r"review", r"survey", r"benchmark", r"perspective", r"outlook", r"综述", r"展望", r"基准"]),
]

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


def topics_of(text):
    found = []
    for key, pats in TOPIC_RULES:
        if any(re.search(p, text, re.I) for p in pats):
            found.append(key)
    return found[:3] if found else ["quantum"]


def main():
    db = json.load(open(DB, encoding="utf-8"))
    changed = 0
    for p in db["papers"]:
        if p.get("curatedTopics"):
            continue  # 人工核定的分类,不用自动规则覆盖
        text = " ".join([p.get("title", ""), p.get("titleZh", ""), p.get("summaryZh", ""), p.get("abstract", "")])
        old = p["topics"]
        new = topics_of(text)
        # 摘要是中文报告节选的日报论文:补充英文标题已有,足够
        if new != old:
            changed += 1
        p["topics"] = new
    db["topics"] = TOPIC_LABELS
    json.dump(db, open(DB, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    from collections import Counter
    prim = Counter(p["topics"][0] for p in db["papers"])
    allc = Counter(t for p in db["papers"] for t in p["topics"])
    print("changed:", changed, "/", len(db["papers"]))
    print("primary:", dict(prim.most_common()))
    print("all-tag counts:", dict(allc.most_common()))


if __name__ == "__main__":
    main()
