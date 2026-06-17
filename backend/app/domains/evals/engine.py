"""评选引擎 —— 从 frontend/src/store.ts 的 computeEval / 种子逻辑逐行移植的纯函数。

设计为纯函数（输入普通 dict，无 ORM），便于 pytest 对拍 JS 原版（tests/test_eval.py）。
DB 层从表里组装这些 dict 再调用 compute_eval。
"""
from __future__ import annotations

import math
from datetime import date, timedelta

# ⚠️ DEMO 花名册——仅供 tests/test_eval.py 对拍 JS 原版使用，切勿在生产路径引用。
# 真实评选成员一律来自 users 表（见 store._member_names）。下方 seed_eval /
# build_past_reports 同理：均为测试夹具，已无运行时引用，勿接回业务代码。
MEMBERS: list[str] = [
    "林知远", "Wei Chen", "苏沐", "顾长川", "陈屿", "Mei Lin", "周野", "沈书瑶",
    "Hao Zhang", "唐辒", "罗一帆", "Priya Nair", "钱牧之", "叶承", "白露",
    "Kenji Sato", "卫青禾", "孟繁", "陆鸢", "韩望舒",
]

# 默认评选期与权重/阈值（= data.ts evalPeriod + store.ts 初值）
DEFAULT_RANGE = {"from": "2026-04-19", "to": "2026-06-07"}
# 报告评分三维（态度/精良/逻辑清晰，对齐问卷星表单）+ 出勤 + 讨论
DEFAULT_WEIGHTS = {"attitude": 0.2, "polish": 0.2, "logic": 0.2, "attendance": 0.2, "discussion": 0.2}
DEFAULT_FILTERS = {"attitudeMin": 0, "polishMin": 0, "logicMin": 0, "attMin": 100, "discMin": 4}


def eval_h(s: str, salt: int) -> int:
    """与 JS `(x*31 + charCode) >>> 0` 逐位等价（32 位无符号；BMP 字符 ord == UTF-16 单元）。"""
    x = salt & 0xFFFFFFFF
    for ch in s:
        x = (x * 31 + ord(ch)) & 0xFFFFFFFF
    return x


def _js_round(x: float) -> int:
    """JS Math.round（.5 向上），区别于 Python 银行家舍入。"""
    return math.floor(x + 0.5)


def build_past_reports() -> list[dict]:
    """复刻 data.ts pastReports：本评选期 8 次组会。"""
    out: list[dict] = []
    start = date(2026, 4, 19)
    ri, n = 5, 0
    while len(out) < 8:
        cur = start + timedelta(days=7 * n)
        mo, day = cur.month - 1, cur.day
        per = 2 if n % 3 == 2 else 1
        pres = []
        for _ in range(per):
            pres.append(MEMBERS[ri % len(MEMBERS)])
            ri += 3
        out.append({
            "id": f"r-{mo + 1}-{day}", "y": cur.year, "mo": mo, "day": day,
            "type": "进展汇报" if n % 2 == 0 else "文献精读",
            "presenters": pres,
        })
        n += 1
    return out


def seed_eval(reports: list[dict]) -> dict:
    """复刻 store.ts 的确定性种子：出勤 / 发言 / 评分 / 同行基线。"""
    attendance: dict = {}
    discussion: dict = {}
    ratings: dict = {}
    for r in reports:
        rid = r["id"]
        attendance[rid], discussion[rid], ratings[rid] = {}, {}, {}
        for name in MEMBERS:
            presenter = name in r["presenters"]
            hv = eval_h(name + rid, 7) % 100
            if presenter:
                stt = "present"
            else:
                stt = "present" if hv < 80 else "leave" if hv < 91 else "absent"
            attendance[rid][name] = stt
            if stt == "present":
                disc = (eval_h(name + rid, 13) % (3 if presenter else 5)) + (3 if presenter else 0)
            else:
                disc = 0
            discussion[rid][name] = disc
        for pn in r["presenters"]:
            ratings[rid][pn] = {
                "attitude": 3 + (eval_h(pn + rid, 5) % 21) / 10,
                "polish": 3 + (eval_h(pn + rid, 9) % 21) / 10,
                "logic": 3 + (eval_h(pn + rid, 11) % 21) / 10,
                "raters": 9 + (eval_h(pn + rid, 3) % 8),
            }
    peer_baseline = {
        name: {
            "attitude": 3 + (eval_h(name, 5) % 21) / 10,
            "polish": 3 + (eval_h(name, 9) % 21) / 10,
            "logic": 3 + (eval_h(name, 11) % 21) / 10,
        }
        for name in MEMBERS
    }
    return {"attendance": attendance, "discussion": discussion,
            "ratings": ratings, "peer_baseline": peer_baseline}


def _norm(rows: list[dict], key: str, nk: str) -> None:
    if not rows:
        return
    vals = [r[key] for r in rows]
    mn, mx = min(vals), max(vals)
    for r in rows:
        r[nk] = ((r[key] - mn) / (mx - mn)) * 100 if mx > mn else 50.0


def compute_eval(
    members: list[str],
    reports: list[dict],
    attendance: dict,
    discussion: dict,
    ratings: dict,
    peer_baseline: dict,
    weights: dict | None = None,
    filters: dict | None = None,
    rng: dict | None = None,
    cancelled: set[str] | None = None,
    progress_order: list[str] | None = None,
) -> dict:
    """逐行移植 store.ts computeEval。返回 rows / survivors / merged / total 等。"""
    weights = weights or DEFAULT_WEIGHTS
    filters = filters or DEFAULT_FILTERS
    rng = rng or DEFAULT_RANGE
    cancelled = cancelled or set()

    def iso_of(r: dict) -> str:
        return f"{r['y']:04d}-{r['mo'] + 1:02d}-{r['day']:02d}"

    rs = [
        r for r in reports
        if r["id"] not in cancelled
        and (not rng.get("from") or iso_of(r) >= rng["from"])
        and (not rng.get("to") or iso_of(r) <= rng["to"])
    ]
    total = len(rs) or 1

    rows: list[dict] = []
    for name in members:
        present = discuss = 0
        a_sum = p_sum = l_sum = 0.0
        a_n = p_n = l_n = 0
        for r in rs:
            rid = r["id"]
            if attendance.get(rid, {}).get(name) == "present":
                present += 1
            discuss += discussion.get(rid, {}).get(name, 0)
            rt = ratings.get(rid, {}).get(name)
            if rt:
                a_sum += rt["attitude"]; a_n += 1
                p_sum += rt["polish"]; p_n += 1
                l_sum += rt.get("logic", 0.0); l_n += 1
        base = peer_baseline.get(name, {"attitude": 0, "polish": 0, "logic": 0})
        attitude = a_sum / a_n if a_n else base["attitude"]
        polish = p_sum / p_n if p_n else base["polish"]
        logic = l_sum / l_n if l_n else base.get("logic", 0)
        rows.append({
            "name": name, "attitude": attitude, "polish": polish, "logic": logic,
            "attRate": _js_round(present / total * 100), "discuss": discuss, "reported": a_n,
        })

    _norm(rows, "attitude", "nAttitude")
    _norm(rows, "polish", "nPolish")
    _norm(rows, "logic", "nLogic")
    _norm(rows, "attRate", "nAtt")
    _norm(rows, "discuss", "nDisc")

    w = weights
    sw = (w["attitude"] + w["polish"] + w.get("logic", 0)
          + w["attendance"] + w["discussion"]) or 1
    for r in rows:
        r["meeting"] = (
            w["attitude"] * r["nAttitude"] + w["polish"] * r["nPolish"]
            + w.get("logic", 0) * r["nLogic"]
            + w["attendance"] * r["nAtt"] + w["discussion"] * r["nDisc"]
        ) / sw

    by_meeting = sorted(rows, key=lambda r: -r["meeting"])  # 稳定排序，等价 JS b.meeting-a.meeting
    for i, r in enumerate(by_meeting):
        r["meetingRank"] = i + 1

    f = filters
    survivors = [
        r for r in by_meeting
        if r["attitude"] >= f["attitudeMin"] and r["polish"] >= f["polishMin"]
        and r["logic"] >= f.get("logicMin", 0)
        and r["attRate"] >= f["attMin"] and r["discuss"] >= f["discMin"]
    ]
    surv_names = [r["name"] for r in survivors]

    order = list(progress_order) if progress_order else []
    if not order:
        order = surv_names[:]
    else:
        order = [n for n in order if n in surv_names]
        for n in surv_names:
            if n not in order:
                order.append(n)
    progress_rank = {n: i + 1 for i, n in enumerate(order)}

    surv_by_meeting = sorted(survivors, key=lambda r: r["meetingRank"])
    m_rank_among = {r["name"]: i + 1 for i, r in enumerate(surv_by_meeting)}

    merged = [
        {"name": r["name"], "row": r, "mRank": m_rank_among[r["name"]],
         "pRank": progress_rank[r["name"]],
         "score": (m_rank_among[r["name"]] + progress_rank[r["name"]]) / 2}
        for r in survivors
    ]
    merged.sort(key=lambda m: (m["score"], m["mRank"]))
    for i, m in enumerate(merged):
        m["finalRank"] = i + 1

    return {"rows": by_meeting, "survivors": survivors, "order": order,
            "progressRank": progress_rank, "mRankAmong": m_rank_among,
            "merged": merged, "total": total}


def rank_series_for(
    name: str, from_iso: str, to_iso: str, metric: str,
    members: list[str], reports: list[dict], attendance: dict, discussion: dict,
    ratings: dict, peer_baseline: dict, weights: dict | None = None,
    filters: dict | None = None, cancelled: set[str] | None = None,
) -> dict:
    """逐行移植 store.ts rankSeriesFor：某人在区间内逐次累计的名次走势。"""
    cancelled = cancelled or set()

    def iso_of(r: dict) -> str:
        return f"{r['y']:04d}-{r['mo'] + 1:02d}-{r['day']:02d}"

    reps = sorted(
        [
            {"r": r, "iso": iso_of(r)}
            for r in reports if r["id"] not in cancelled
        ],
        key=lambda x: x["iso"],
    )
    reps = [
        x for x in reps
        if (not from_iso or x["iso"] >= from_iso) and (not to_iso or x["iso"] <= to_iso)
    ]
    total = len(members)
    points: list[dict] = []
    ranks: list[int] = []
    for x in reps:
        r = x["r"]
        ev = compute_eval(members, reports, attendance, discussion, ratings, peer_baseline,
                          weights, filters, {"from": from_iso, "to": x["iso"]}, cancelled)
        arr = ev["rows"]
        if metric == "discuss":
            arr = sorted(ev["rows"], key=lambda a: (-a["discuss"], -a["meeting"]))
        elif metric == "report":
            arr = sorted(ev["rows"], key=lambda a: (-(a["nAttitude"] + a["nPolish"] + a["nLogic"]), -a["meeting"]))
        idx = next((i for i, a in enumerate(arr) if a["name"] == name), -1)
        points.append({"label": f"{r['mo'] + 1}/{r['day']:02d}"})
        ranks.append(idx + 1 if idx >= 0 else max(total, 1))
    return {"points": points, "ranks": ranks, "total": total}

