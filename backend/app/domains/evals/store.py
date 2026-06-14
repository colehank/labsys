"""评选 DB 适配层 —— 出勤/发言/评分挂在 meetings 表（组会唯一事实源）上。

引擎（engine.compute_eval / rank_series_for）保持纯函数；本层负责持久化与装配。
report 维度的键统一用 Meeting.id（与组会日历 /api/meetings 同源）。
"""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.domains.evals.engine import (
    DEFAULT_FILTERS,
    DEFAULT_RANGE,
    DEFAULT_WEIGHTS,
    seed_eval,
)
from app.models import (
    Attendance,
    Discussion,
    EvalConfig,
    Meeting,
    PeerBaseline,
    Rating,
)


def _iso(d) -> str:
    return f"{d.year:04d}-{d.month:02d}-{d.day:02d}"


async def _load_meetings(db: AsyncSession) -> list[Meeting]:
    return list(
        (
            await db.execute(
                select(Meeting).options(selectinload(Meeting.presenters)).order_by(Meeting.date)
            )
        ).scalars()
    )


def _report_dict(m: Meeting) -> dict:
    """把一场 Meeting 转成引擎需要的 report dict（键 = meeting.id）。"""
    return {
        "id": m.id,
        "mo": m.date.month - 1,
        "day": m.date.day,
        "type": m.type.value,
        "presenters": [p.name for p in m.presenters],
    }


async def seed_eval_db(db: AsyncSession) -> None:
    """首次：对评选期内的 meetings 用确定性引擎种子填充出勤/发言/评分。幂等。

    meetings 由 seed_lab 先建好；本层只往组会上挂评估数据，不再单独建组会表。
    """
    cfg = (await db.execute(select(EvalConfig).limit(1))).scalar_one_or_none()
    has_att = (await db.execute(select(Attendance.id))).first()
    if has_att and cfg:
        return

    meetings = await _load_meetings(db)
    rng = cfg.range_ if cfg else dict(DEFAULT_RANGE)
    period = [
        m for m in meetings
        if (not rng.get("from") or _iso(m.date) >= rng["from"])
        and (not rng.get("to") or _iso(m.date) <= rng["to"])
    ]
    reports = [_report_dict(m) for m in period]
    seed = seed_eval(reports)

    if not has_att:
        for mid, names in seed["attendance"].items():
            for name, status in names.items():
                db.add(Attendance(meeting_id=mid, name=name, status=status))
        for mid, names in seed["discussion"].items():
            for name, pts in names.items():
                db.add(Discussion(meeting_id=mid, name=name, points=pts))
        for mid, pres in seed["ratings"].items():
            for pn, rt in pres.items():
                db.add(Rating(meeting_id=mid, presenter=pn,
                              attitude=rt["attitude"], polish=rt["polish"], raters=rt["raters"]))
    if not (await db.execute(select(PeerBaseline.id))).first():
        for name, base in seed["peer_baseline"].items():
            db.add(PeerBaseline(name=name, attitude=base["attitude"], polish=base["polish"]))
    if cfg is None:
        db.add(EvalConfig(weights=dict(DEFAULT_WEIGHTS), filters=dict(DEFAULT_FILTERS),
                          range_=dict(DEFAULT_RANGE), progress_order=None))
    await db.commit()
    print(f"eval DB seed 完成：{len(period)} 场评选期组会挂 attendance/discussion/ratings + baseline/config")


async def load_eval_data(db: AsyncSession) -> dict:
    """从 meetings + 评估表组装成引擎入参。组会维度键 = Meeting.id。"""
    meetings = await _load_meetings(db)
    reports = [_report_dict(m) for m in meetings]
    ids = {m.id for m in meetings}

    attendance: dict = {m.id: {} for m in meetings}
    discussion: dict = {m.id: {} for m in meetings}
    ratings: dict = {m.id: {} for m in meetings}

    for a in (await db.execute(select(Attendance))).scalars():
        if a.meeting_id in ids:
            attendance[a.meeting_id][a.name] = a.status
    for d in (await db.execute(select(Discussion))).scalars():
        if d.meeting_id in ids:
            discussion[d.meeting_id][d.name] = d.points
    for rt in (await db.execute(select(Rating))).scalars():
        if rt.meeting_id in ids:
            ratings[rt.meeting_id][rt.presenter] = {
                "attitude": rt.attitude, "polish": rt.polish, "raters": rt.raters,
            }

    peer_baseline = {
        pb.name: {"attitude": pb.attitude, "polish": pb.polish}
        for pb in (await db.execute(select(PeerBaseline))).scalars()
    }
    cfg = (await db.execute(select(EvalConfig).limit(1))).scalar_one_or_none()

    return {
        "reports": reports, "attendance": attendance, "discussion": discussion,
        "ratings": ratings, "peer_baseline": peer_baseline,
        "weights": cfg.weights if cfg else dict(DEFAULT_WEIGHTS),
        "filters": cfg.filters if cfg else dict(DEFAULT_FILTERS),
        "rng": cfg.range_ if cfg else dict(DEFAULT_RANGE),
        "progress_order": cfg.progress_order if cfg else None,
        "config_row": cfg,
        "meetings_rows": meetings,
    }
