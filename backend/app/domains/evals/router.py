"""评选路由 —— DB 后端的组会评分统计、名次走势、优秀名单 + 录入/评分/配置/发布。

引擎纯函数不变（与 JS 原版对拍一致）；数据从 DB 组装（app/domains/evals/store.py）。
"""
from __future__ import annotations

import re
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.core.deps import AdminUser, CurrentUser, DbSession
from app.domains.evals.engine import compute_eval, rank_series_for
from app.domains.evals.store import load_eval_data
from app.models import Attendance, Discussion, Excellence, Meeting, Presenter, Rating, RatingVote
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
_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


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
    if not name.strip():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="name 不能为空")
    if not _DATE_RE.match(from_) or not _DATE_RE.match(to):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="日期格式须为 YYYY-MM-DD")
    data = await load_eval_data(db)
    if name not in data["members"]:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=f"成员「{name}」不存在")
    s = rank_series_for(name, from_, to, metric, data["members"], data["reports"], data["attendance"],
                        data["discussion"], data["ratings"], data["peer_baseline"],
                        data["weights"], data["filters"])
    return RankSeriesOut(**s)


@router.get("/reports", response_model=list[ReportOut])
async def list_reports(me: CurrentUser, db: DbSession) -> list[ReportOut]:
    """评选期内的组会（直接来自 meetings 表，与组会日历同源），供管理员录入。"""
    data = await load_eval_data(db)
    rng = data["rng"]

    # 查询当前用户的全部投票记录，建立 {meeting_id -> {presenter, ...}} 索引
    my_votes = list((await db.execute(
        select(RatingVote).where(RatingVote.rater_id == me.id)
    )).scalars())
    my_rated: dict[str, set[str]] = {}
    for v in my_votes:
        my_rated.setdefault(v.meeting_id, set()).add(v.presenter)

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
            rated_by=list(my_rated.get(m.id, set())),
        ))
    return out


@router.get("/excellence", response_model=ExcellenceOut)
async def excellence(_: CurrentUser, db: DbSession, count: int = 5) -> ExcellenceOut:
    latest = (
        await db.execute(select(Excellence).order_by(Excellence.published_at.desc()).limit(1))
    ).scalar_one_or_none()
    if latest:
        return ExcellenceOut(period=latest.period, from_=latest.from_, to=latest.to,
                             names=latest.names, count=latest.count, published=True,
                             published_at=latest.published_at)
    data = await load_eval_data(db)
    ev = _compute(data)
    names = [m["name"] for m in ev["merged"][:count]]
    rng = data["rng"]
    return ExcellenceOut(period=data.get("period", ""), from_=rng.get("from", ""),
                         to=rng.get("to", ""), names=names, count=len(names), published=False)


async def _recompute_meeting_eval(db, meeting_id: str) -> None:
    """据全部选票重算该组会的报告人评分聚合 + 讨论得分（幂等，可安全重复调用）。

    评分聚合 = 各报告人选票的态度/精良均值与人数。
    讨论得分 = 按 rater 去重后，每张 Top5 第 i 名 +(5-i) 分，汇总到各姓名。
    讨论行的 speaks（管理员录入）原样保留，只重写 points。
    """
    votes = list((await db.execute(
        select(RatingVote).where(RatingVote.meeting_id == meeting_id).order_by(RatingVote.id)
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

    # —— 讨论得分（每个 rater 的 Top5 只计一次；同一 rater 多次提交时取最后一次非空 top5）——
    by_rater: dict[str, list] = {}
    for v in votes:
        top5 = [n for n in (v.top5 or []) if n]
        by_rater[v.rater_id] = top5
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
    # 只允许对评选期内的组会提交评分
    data = await load_eval_data(db)
    rng = data["rng"]
    iso = meeting.date.isoformat()
    if rng.get("from") and iso < rng["from"]:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="该组会不在当前评选期范围内，无法评分")
    if rng.get("to") and iso > rng["to"]:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="该组会不在当前评选期范围内，无法评分")
    valid_presenters = list((await db.execute(
        select(Presenter.name).where(Presenter.meeting_id == meeting.id)
    )).scalars())
    if body.presenter not in valid_presenters:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="该报告人不在本场组会中")
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
    vote.top5 = [n for n in body.top5 if n and n != me.name]
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
                        range=data["rng"], progress_order=data["progress_order"],
                        period=data.get("period", ""))


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
    cfg.period = body.period
    await db.commit()
    return body


# ── 管理员：发布优秀名单 ──
@router.post("/excellence", response_model=ExcellenceOut, status_code=status.HTTP_201_CREATED)
async def publish_excellence(body: PublishExcellence, _: AdminUser, db: DbSession) -> ExcellenceOut:
    data = await load_eval_data(db)
    period = data.get("period", "")
    # 幂等保护：无论 period 是否为空都执行去重检查
    existing = (await db.execute(
        select(Excellence).where(Excellence.period == period).limit(1)
    )).scalar_one_or_none()
    if existing is not None:
        label = f"「{period}」" if period else "（未命名评选期）"
        raise HTTPException(status.HTTP_409_CONFLICT, detail=f"{label}优秀名单已发布，如需重新发布请先联系管理员清除旧记录")
    ev = _compute(data)
    names = [m["name"] for m in ev["merged"][: max(1, body.count)]]
    rng = data["rng"]
    exc = Excellence(period=period, from_=rng.get("from", ""), to=rng.get("to", ""),
                     names=names, count=len(names), published_at=datetime.now(timezone.utc))
    db.add(exc)
    await db.commit()
    return ExcellenceOut(period=exc.period, from_=exc.from_, to=exc.to,
                         names=exc.names, count=exc.count, published=True,
                         published_at=exc.published_at)
