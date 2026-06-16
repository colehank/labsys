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
)
from app.models import (
    Attendance,
    Discussion,
    EvalConfig,
    Meeting,
    Rating,
    User,
)


async def _member_names(db: AsyncSession) -> list[str]:
    """真实评选花名册 = 在册学生（排除老师与停用账号），顺序按建号顺序。"""
    rows = (
        await db.execute(
            select(User)
            .where(User.title != "老师", User.disabled.is_(False))
            .order_by(User.created_at)
        )
    ).scalars()
    return [u.name for u in rows]


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
        "type": m.type,
        "presenters": [p.name for p in m.presenters],
    }


async def seed_eval_db(db: AsyncSession) -> None:
    """仅初始化评选配置（权重/阈值/评选期）。幂等。

    出勤、发言次数、报告评分一律由真实使用累积——不再用假成员种子回填。
    """
    cfg = (await db.execute(select(EvalConfig).limit(1))).scalar_one_or_none()
    if cfg is None:
        db.add(EvalConfig(weights=dict(DEFAULT_WEIGHTS), filters=dict(DEFAULT_FILTERS),
                          range_=dict(DEFAULT_RANGE), progress_order=None))
        await db.commit()
        print("eval DB seed：已初始化评选配置（出勤/发言/评分由真实使用累积）")


async def load_eval_data(db: AsyncSession) -> dict:
    """从 meetings + 评估表组装成引擎入参。组会维度键 = Meeting.id。"""
    meetings = await _load_meetings(db)
    reports = [_report_dict(m) for m in meetings]
    ids = {m.id for m in meetings}

    attendance: dict = {m.id: {} for m in meetings}
    discussion: dict = {m.id: {} for m in meetings}
    speaks: dict = {m.id: {} for m in meetings}
    ratings: dict = {m.id: {} for m in meetings}

    for a in (await db.execute(select(Attendance))).scalars():
        if a.meeting_id in ids:
            attendance[a.meeting_id][a.name] = a.status
    for d in (await db.execute(select(Discussion))).scalars():
        if d.meeting_id in ids:
            discussion[d.meeting_id][d.name] = d.points
            speaks[d.meeting_id][d.name] = d.speaks
    for rt in (await db.execute(select(Rating))).scalars():
        if rt.meeting_id in ids:
            ratings[rt.meeting_id][rt.presenter] = {
                "attitude": rt.attitude, "polish": rt.polish, "logic": rt.logic,
                "raters": rt.raters,
            }

    # PeerBaseline 已无任何写入方（历史遗留的同行基线维度）；保持空 dict——
    # 引擎对未被评分的成员回退为 0，行为不变，但省掉一次无意义的查询。
    peer_baseline: dict = {}
    cfg = (await db.execute(select(EvalConfig).limit(1))).scalar_one_or_none()

    return {
        "members": await _member_names(db),
        "reports": reports, "attendance": attendance, "discussion": discussion,
        "speaks": speaks, "ratings": ratings, "peer_baseline": peer_baseline,
        "weights": cfg.weights if cfg else dict(DEFAULT_WEIGHTS),
        "filters": cfg.filters if cfg else dict(DEFAULT_FILTERS),
        "rng": cfg.range_ if cfg else dict(DEFAULT_RANGE),
        "progress_order": cfg.progress_order if cfg else None,
        "config_row": cfg,
        "meetings_rows": meetings,
    }
