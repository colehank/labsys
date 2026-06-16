"""导入 2026 春季 CIBOL 大组会真实数据（排期 + 主持人 + 出勤 + 发言次数）。

数据源：scripts/cibol_2026spring.json（由微信群导出的 4 张 Excel 规范化而来）。
幂等：按日期 upsert 组会，按 (meeting,name) upsert 出勤/发言；可安全重复运行。

用法（本地或 turing，需先 alembic upgrade head）：
    uv run python -m scripts.import_cibol_2026spring            # 默认不删未匹配组会
    uv run python -m scripts.import_cibol_2026spring --prune    # 删除不在 Excel 里的组会（清掉旧 demo 排期）

设计取舍：
  · 组会类型为自由文本：团建 / AI Agent工作坊 等作为自定义类型的组会导入（无报告人）。
  · 「取消」日期建为 status=cancelled 的组会。
  · 历史报告评分（态度/精良/逻辑）由「表现评分记录表」合并汇报评分 /15 平均拆三维回填
    （3.6–5.12 共 8 场，raters=0 标记线下来源）；6.2/6.9 问卷星映射不可靠，不回填。
"""
from __future__ import annotations

import argparse
import asyncio
import json
from datetime import date
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.db import SessionLocal
from app.models import (
    Attendance,
    Discussion,
    EvalConfig,
    Meeting,
    MeetingStatus,
    Presenter,
    Rating,
)

DATA = Path(__file__).parent / "cibol_2026spring.json"
# 让真实学期数据全部进入评选期视图（/eval/reports 按此区间过滤）
EVAL_RANGE = {"from": "2026-03-01", "to": "2026-07-01"}


def _iso_to_date(s: str) -> date:
    y, m, d = (int(x) for x in s.split("-"))
    return date(y, m, d)


async def run(prune: bool) -> None:
    data = json.loads(DATA.read_text(encoding="utf-8"))
    schedule = data["schedule"]
    attendance = data["attendance"]
    speaks = data["speaks"]
    ratings_data = data.get("ratings", {})
    skipped = data.get("skipped_events", [])

    report: list[str] = []

    async with SessionLocal() as db:
        existing = {
            m.date: m
            for m in (
                await db.execute(select(Meeting).options(selectinload(Meeting.presenters)))
            ).scalars()
        }
        wanted: set[date] = set()
        date_by_iso: dict[str, str] = {}  # iso -> meeting.id

        # ── 1. 组会 + 主持人 + 报告人（按日期 upsert，保留已预约的在线会议）──
        for s in schedule:
            d = _iso_to_date(s["iso"])
            wanted.add(d)
            m = existing.get(d)
            if m is None:
                m = Meeting(date=d)
                db.add(m)
            m.type = s["type"]   # 自由文本类型（文献精读/进展汇报/团建/AI Agent工作坊…）
            m.host = "" if s["cancelled"] else (s["host"] or "")
            m.status = MeetingStatus.cancelled if s["cancelled"] else MeetingStatus.scheduled
            m.presenters = [
                Presenter(name=p["name"], topic=p["topic"], kind=p.get("kind", ""), ord=i)
                for i, p in enumerate(s["presenters"])
            ]
            await db.flush()
            date_by_iso[s["iso"]] = m.id
            if s["cancelled"]:
                tag = "取消"
            elif not s["presenters"]:
                tag = m.type  # 团建 / 工作坊 等活动
            else:
                tag = f"{m.type} · {len(s['presenters'])}人 · 主持 {m.host or '—'}"
            report.append(f"  组会 {s['iso']}  {tag}")

        # ── 2. 删除不在 Excel 里的旧组会（可选）──
        if prune:
            for d, m in existing.items():
                if d not in wanted:
                    report.append(f"  删除旧组会 {d}（不在真实排期内）")
                    await db.delete(m)

        await db.flush()

        # ── 3. 出勤（按 meeting+name upsert）──
        att_existing = {
            (a.meeting_id, a.name): a
            for a in (await db.execute(select(Attendance))).scalars()
        }
        att_n, att_skip = 0, set()
        for iso, by_name in attendance.items():
            mid = date_by_iso.get(iso)
            if mid is None:
                att_skip.add(iso)
                continue
            for name, status in by_name.items():
                a = att_existing.get((mid, name))
                if a is None:
                    db.add(Attendance(meeting_id=mid, name=name, status=status))
                else:
                    a.status = status
                att_n += 1

        # ── 4. 发言次数（按 meeting+name upsert，写 Discussion.speaks）──
        disc_existing = {
            (x.meeting_id, x.name): x
            for x in (await db.execute(select(Discussion))).scalars()
        }
        sp_n, sp_skip = 0, set()
        for iso, by_name in speaks.items():
            mid = date_by_iso.get(iso)
            if mid is None:
                sp_skip.add(iso)
                continue
            for name, cnt in by_name.items():
                x = disc_existing.get((mid, name))
                if x is None:
                    db.add(Discussion(meeting_id=mid, name=name, points=0, speaks=int(cnt)))
                else:
                    x.speaks = int(cnt)
                sp_n += 1

        # ── 4b. 历史报告评分（态度/精良/逻辑 = Excel 合并汇报评分 /15 ÷ 3，按姓名+日期）──
        rt_existing = {
            (r.meeting_id, r.presenter): r
            for r in (await db.execute(select(Rating))).scalars()
        }
        rt_n, rt_skip = 0, set()
        for iso, by_name in ratings_data.items():
            mid = date_by_iso.get(iso)
            if mid is None:
                rt_skip.add(iso)
                continue
            for name, sc in by_name.items():
                r = rt_existing.get((mid, name))
                if r is None:
                    r = Rating(meeting_id=mid, presenter=name)
                    db.add(r)
                r.attitude = float(sc["attitude"])
                r.polish = float(sc["polish"])
                r.logic = float(sc["logic"])
                r.raters = int(sc.get("raters", 0))
                rt_n += 1

        # ── 5. 评选期对齐到整学期 + 权重/阈值补 logic 维度（历史配置只有 4 键）──
        cfg = (await db.execute(select(EvalConfig).limit(1))).scalar_one_or_none()
        if cfg is not None:
            cfg.range_ = dict(EVAL_RANGE)
            report.append(f"  评选期 range → {EVAL_RANGE['from']} ~ {EVAL_RANGE['to']}")
            w = dict(cfg.weights or {})
            if "logic" not in w:
                # 旧的等权 4 键（各 0.25）→ 等权 5 键（各 0.2），否则按现有报告维度均值插入
                if all(abs(w.get(k, 0) - 0.25) < 1e-9 for k in ("attitude", "polish", "attendance", "discussion")):
                    w = {"attitude": 0.2, "polish": 0.2, "logic": 0.2, "attendance": 0.2, "discussion": 0.2}
                else:
                    w["logic"] = round((w.get("attitude", 0) + w.get("polish", 0)) / 2, 4)
                cfg.weights = w
                report.append(f"  评选权重补 logic → {w}")
            f = dict(cfg.filters or {})
            if "logicMin" not in f:
                f["logicMin"] = f.get("polishMin", 0)
                cfg.filters = f
                report.append(f"  过滤阈值补 logicMin = {f['logicMin']}")

        await db.commit()

    # ── 报告 ──
    print("=" * 60)
    print("CIBOL 2026 春季组会数据导入完成")
    print("=" * 60)
    print("\n".join(report))
    print(f"\n出勤记录写入: {att_n} 条；发言记录写入: {sp_n} 条；历史报告评分写入: {rt_n} 条")
    if skipped:
        print("\n⚠️ 未导入的非汇报事件（Meeting 模型无活动类型，请按需手工添加）:")
        for d, label in skipped:
            print(f"    {d}  {label}")
    if att_skip or sp_skip:
        print("\n⚠️ 落在未导入日期、已跳过的出勤/发言记录:")
        for iso in sorted(att_skip | sp_skip):
            print(f"    {iso}")
    if rt_skip:
        print("\n⚠️ 落在未导入日期、已跳过的历史评分:", sorted(rt_skip))
    print(
        "\nℹ️ 历史报告评分由「表现评分记录表」的合并汇报评分（/15）平均拆成态度/精良/逻辑各 /5 回填"
        "（3.6–5.12 共 8 场，raters=0 表示来自线下记录而非 web 匿名投票）；6.2/6.9 仅问卷星聚合、"
        "汇报序号→报告人不可靠，未回填，等成员 web 打分累积。讨论得分（Top5 投票）历史无数据。"
    )


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--prune", action="store_true", help="删除不在 Excel 真实排期内的旧组会")
    args = ap.parse_args()
    asyncio.run(run(args.prune))
