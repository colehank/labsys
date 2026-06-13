"""评选 DB 适配层 —— 种子写入 + 从表组装成引擎需要的 dict。

引擎（engine.compute_eval / rank_series_for）保持纯函数；本层负责持久化与装配。
report 维度的键统一用 EvalReport.key（如 r-4-19），与引擎内部一致。
"""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.evals.engine import (
    DEFAULT_FILTERS,
    DEFAULT_RANGE,
    DEFAULT_WEIGHTS,
    build_past_reports,
    seed_eval,
)
from app.models import (
    Attendance,
    Discussion,
    EvalConfig,
    EvalReport,
    PeerBaseline,
    Rating,
)


async def seed_eval_db(db: AsyncSession) -> None:
    """首次：用确定性引擎种子填充评选表（与 demo / 对拍一致）。幂等。"""
    if (await db.execute(select(EvalReport.id))).first():
        return
    reports = build_past_reports()
    seed = seed_eval(reports)

    rid_by_key: dict[str, str] = {}
    for r in reports:
        row = EvalReport(key=r["id"], mo=r["mo"], day=r["day"], type=r["type"],
                         presenters=r["presenters"])
        db.add(row)
        await db.flush()
        rid_by_key[r["id"]] = row.id

    for key, names in seed["attendance"].items():
        for name, status in names.items():
            db.add(Attendance(report_id=rid_by_key[key], name=name, status=status))
    for key, names in seed["discussion"].items():
        for name, pts in names.items():
            db.add(Discussion(report_id=rid_by_key[key], name=name, points=pts))
    for key, pres in seed["ratings"].items():
        for pn, rt in pres.items():
            db.add(Rating(report_id=rid_by_key[key], presenter=pn,
                          attitude=rt["attitude"], polish=rt["polish"], raters=rt["raters"]))
    for name, base in seed["peer_baseline"].items():
        db.add(PeerBaseline(name=name, attitude=base["attitude"], polish=base["polish"]))

    db.add(EvalConfig(weights=dict(DEFAULT_WEIGHTS), filters=dict(DEFAULT_FILTERS),
                      range_=dict(DEFAULT_RANGE), progress_order=None))
    await db.commit()
    print("eval DB seed 完成：reports/attendance/discussion/ratings/baseline/config")


async def load_eval_data(db: AsyncSession) -> dict:
    """从表组装成引擎入参。"""
    reports_rows = list(
        (await db.execute(select(EvalReport).order_by(EvalReport.mo, EvalReport.day))).scalars()
    )
    key_by_id = {r.id: r.key for r in reports_rows}
    reports = [{"id": r.key, "mo": r.mo, "day": r.day, "presenters": r.presenters} for r in reports_rows]

    attendance: dict = {r.key: {} for r in reports_rows}
    discussion: dict = {r.key: {} for r in reports_rows}
    ratings: dict = {r.key: {} for r in reports_rows}

    for a in (await db.execute(select(Attendance))).scalars():
        attendance.setdefault(key_by_id.get(a.report_id, ""), {})[a.name] = a.status
    for d in (await db.execute(select(Discussion))).scalars():
        discussion.setdefault(key_by_id.get(d.report_id, ""), {})[d.name] = d.points
    for rt in (await db.execute(select(Rating))).scalars():
        ratings.setdefault(key_by_id.get(rt.report_id, ""), {})[rt.presenter] = {
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
        "reports_rows": reports_rows,
    }
