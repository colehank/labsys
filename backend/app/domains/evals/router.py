"""评选路由 —— DB 后端的组会评分统计、名次走势、优秀名单 + 录入/评分/配置/发布。

引擎纯函数不变（与 JS 原版对拍一致）；数据从 DB 组装（app/domains/evals/store.py）。
"""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.core.deps import AdminUser, CurrentUser, DbSession
from app.domains.evals.engine import compute_eval, rank_series_for
from app.domains.evals.store import load_eval_data
from app.models import Attendance, Discussion, Excellence, Meeting, Rating, RatingVote
from app.schemas.eval import (
    AttendanceSet,
    EvalComputeOut,
    EvalConfigIO,
    ExcellenceOut,
    PublishExcellence,
    RankSeriesOut,
    RatingSubmit,
    ReportOut,
    SpeaksSet,
)

router = APIRouter(prefix="/eval", tags=["eval"])

_WD = ["一", "二", "三", "四", "五", "六", "日"]


def _compute(data: dict) -> dict:
    return compute_eval(
        data["members"], data["reports"], data["attendance"], data["discussion"], data["ratings"],
        data["peer_baseline"], data["weights"], data["filters"], data["rng"],
        progress_order=data["progress_order"],
    )


async def _meeting_by_id(db, mid: str) -> Meeting:
    m = await db.get(Meeting, mid)
    if m is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="组会不存在")
    return m


@router.get("/compute", response_model=EvalComputeOut)
async def compute(_: CurrentUser, db: DbSession) -> EvalComputeOut:
    data = await load_eval_data(db)
    ev = _compute(data)
    return EvalComputeOut(total=ev["total"], weights=data["weights"], rows=ev["rows"], merged=ev["merged"])


@router.get("/rank-series", response_model=RankSeriesOut)
async def rank_series(
    _: CurrentUser, db: DbSession, name: str,
    from_: str = "2026-04-19", to: str = "2026-06-07", metric: str = "total",
) -> RankSeriesOut:
    data = await load_eval_data(db)
    s = rank_series_for(name, from_, to, metric, data["members"], data["reports"], data["attendance"],
                        data["discussion"], data["ratings"], data["peer_baseline"],
                        data["weights"], data["filters"])
    return RankSeriesOut(**s)


@router.get("/reports", response_model=list[ReportOut])
async def list_reports(_: CurrentUser, db: DbSession) -> list[ReportOut]:
    """评选期内的组会（直接来自 meetings 表，与组会日历同源），供管理员录入。"""
    data = await load_eval_data(db)
    rng = data["rng"]
    out = []
    for m in data["meetings_rows"]:
        iso = f"{m.date.year:04d}-{m.date.month:02d}-{m.date.day:02d}"
        if rng.get("from") and iso < rng["from"]:
            continue
        if rng.get("to") and iso > rng["to"]:
            continue
        out.append(ReportOut(
            key=m.id, y=m.date.year, mo=m.date.month - 1, day=m.date.day,
            dateLabel=f"{m.date.month}月{m.date.day}日 周{_WD[m.date.weekday()]}",
            type=m.type, presenters=[p.name for p in m.presenters],
            attendance=data["attendance"].get(m.id, {}),
            speaks=data["speaks"].get(m.id, {}),
            ratings=data["ratings"].get(m.id, {}),
        ))
    return out


@router.get("/excellence", response_model=ExcellenceOut)
async def excellence(_: CurrentUser, db: DbSession, count: int = 5) -> ExcellenceOut:
    latest = (
        await db.execute(select(Excellence).order_by(Excellence.published_at.desc()).limit(1))
    ).scalar_one_or_none()
    if latest:
        return ExcellenceOut(period=latest.period, from_=latest.from_, to=latest.to,
                             names=latest.names, count=latest.count, published=True)
    data = await load_eval_data(db)
    ev = _compute(data)
    names = [m["name"] for m in ev["merged"][:count]]
    rng = data["rng"]
    return ExcellenceOut(period="2026 春季 · 第二评选期", from_=rng.get("from", ""),
                         to=rng.get("to", ""), names=names, count=len(names), published=False)


async def _recompute_meeting_eval(db, meeting_id: str) -> None:
    """据全部选票重算该组会的报告人评分聚合 + 讨论得分（幂等，可安全重复调用）。

    评分聚合 = 各报告人选票的态度/精良均值与人数。
    讨论得分 = 按 rater 去重后，每张 Top5 第 i 名 +(5-i) 分，汇总到各姓名。
    讨论行的 speaks（管理员录入）原样保留，只重写 points。
    """
    votes = list((await db.execute(
        select(RatingVote).where(RatingVote.meeting_id == meeting_id)
    )).scalars())

    # —— 报告人评分聚合 ——
    agg: dict[str, list[float]] = {}
    for v in votes:
        a = agg.setdefault(v.presenter, [0.0, 0.0, 0.0, 0])
        a[0] += v.attitude
        a[1] += v.polish
        a[2] += v.logic
        a[3] += 1
    existing = {
        r.presenter: r for r in (await db.execute(
            select(Rating).where(Rating.meeting_id == meeting_id)
        )).scalars()
    }
    for presenter, (asum, psum, lsum, n) in agg.items():
        rt = existing.get(presenter)
        if rt is None:
            rt = Rating(meeting_id=meeting_id, presenter=presenter)
            db.add(rt)
        rt.attitude = asum / n if n else 0.0
        rt.polish = psum / n if n else 0.0
        rt.logic = lsum / n if n else 0.0
        rt.raters = n
    # 已无选票的报告人评分归零（撤回场景）
    for presenter, rt in existing.items():
        if presenter not in agg:
            rt.attitude = rt.polish = rt.logic = 0.0
            rt.raters = 0

    # —— 讨论得分（每个 rater 的 Top5 只计一次，取其任一张选票的 top5）——
    by_rater: dict[str, list] = {}
    for v in votes:
        by_rater.setdefault(v.rater_id, v.top5 or [])
    points: dict[str, int] = {}
    for top5 in by_rater.values():
        for i, name in enumerate(top5[:5]):
            if name:
                points[name] = points.get(name, 0) + (5 - i)
    disc = {
        d.name: d for d in (await db.execute(
            select(Discussion).where(Discussion.meeting_id == meeting_id)
        )).scalars()
    }
    for name, pts in points.items():
        d = disc.get(name)
        if d is None:
            d = Discussion(meeting_id=meeting_id, name=name, points=0)
            db.add(d)
        d.points = pts
    for name, d in disc.items():
        if name not in points:
            d.points = 0  # 保留 speaks，仅清讨论得分


# ── 成员：提交评分（每人对每位报告人只计一次，重复提交即覆盖）──
@router.post("/reports/{key}/rating", status_code=status.HTTP_204_NO_CONTENT)
async def submit_rating(key: str, body: RatingSubmit, me: CurrentUser, db: DbSession) -> None:
    meeting = await _meeting_by_id(db, key)
    # 不可给自己评分
    if me.name == body.presenter:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="不能给自己评分")
    vote = (await db.execute(
        select(RatingVote).where(
            RatingVote.meeting_id == meeting.id,
            RatingVote.rater_id == me.id,
            RatingVote.presenter == body.presenter,
        )
    )).scalar_one_or_none()
    if vote is None:
        vote = RatingVote(meeting_id=meeting.id, rater_id=me.id, presenter=body.presenter)
        db.add(vote)
    vote.attitude = body.attitude
    vote.polish = body.polish
    vote.logic = body.logic
    vote.top5 = [n for n in body.top5 if n]
    await db.flush()
    await _recompute_meeting_eval(db, meeting.id)
    await db.commit()


# ── 管理员：录入出勤（端口 store.ts setAttendance）──
@router.post("/reports/{key}/attendance", status_code=status.HTTP_204_NO_CONTENT)
async def set_attendance(key: str, body: AttendanceSet, _: AdminUser, db: DbSession) -> None:
    meeting = await _meeting_by_id(db, key)
    a = (
        await db.execute(
            select(Attendance).where(Attendance.meeting_id == meeting.id, Attendance.name == body.name)
        )
    ).scalar_one_or_none()
    if a is None:
        a = Attendance(meeting_id=meeting.id, name=body.name, status=body.status)
        db.add(a)
    else:
        a.status = body.status
    if body.status != "present":
        d = (
            await db.execute(
                select(Discussion).where(Discussion.meeting_id == meeting.id, Discussion.name == body.name)
            )
        ).scalar_one_or_none()
        if d is not None:
            d.points = 0
            d.speaks = 0
    await db.commit()


# ── 管理员：录入发言次数（讨论得分由成员匿名评分得出，此处只录发言次数）──
@router.post("/reports/{key}/speaks", status_code=status.HTTP_204_NO_CONTENT)
async def set_speaks(key: str, body: SpeaksSet, _: AdminUser, db: DbSession) -> None:
    meeting = await _meeting_by_id(db, key)
    d = (
        await db.execute(
            select(Discussion).where(Discussion.meeting_id == meeting.id, Discussion.name == body.name)
        )
    ).scalar_one_or_none()
    if d is None:
        db.add(Discussion(meeting_id=meeting.id, name=body.name, points=0, speaks=max(0, body.count)))
    else:
        d.speaks = max(0, body.count)
    await db.commit()


# ── 管理员：评选配置 ──
@router.get("/config", response_model=EvalConfigIO)
async def get_config(_: AdminUser, db: DbSession) -> EvalConfigIO:
    data = await load_eval_data(db)
    return EvalConfigIO(weights=data["weights"], filters=data["filters"],
                        range=data["rng"], progress_order=data["progress_order"])


@router.put("/config", response_model=EvalConfigIO)
async def put_config(body: EvalConfigIO, _: AdminUser, db: DbSession) -> EvalConfigIO:
    data = await load_eval_data(db)
    cfg = data["config_row"]
    if cfg is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="未初始化评选配置")
    cfg.weights = body.weights
    cfg.filters = body.filters
    cfg.range_ = body.range
    cfg.progress_order = body.progress_order
    await db.commit()
    return body


# ── 管理员：发布优秀名单 ──
@router.post("/excellence", response_model=ExcellenceOut, status_code=status.HTTP_201_CREATED)
async def publish_excellence(body: PublishExcellence, _: AdminUser, db: DbSession) -> ExcellenceOut:
    data = await load_eval_data(db)
    ev = _compute(data)
    names = [m["name"] for m in ev["merged"][: max(1, body.count)]]
    rng = data["rng"]
    exc = Excellence(period="2026 春季 · 第二评选期", from_=rng.get("from", ""), to=rng.get("to", ""),
                     names=names, count=len(names), published_at=datetime.now(timezone.utc))
    db.add(exc)
    await db.commit()
    return ExcellenceOut(period=exc.period, from_=exc.from_, to=exc.to,
                         names=exc.names, count=exc.count, published=True)
