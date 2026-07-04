"""评选路由 —— DB 后端的组会评分统计、名次走势、优秀名单 + 录入/评分/配置/发布。

引擎纯函数不变（与 JS 原版对拍一致）；数据从 DB 组装（app/domains/evals/store.py）。
"""
from __future__ import annotations

import re
from datetime import date, datetime, timezone

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.exc import IntegrityError

from app.core.deps import AdminUser, CurrentUser, DbSession
from app.domains.audit.service import write_audit
from app.domains.evals.engine import compute_eval, rank_series_for
from app.domains.evals.store import load_eval_data
from app.models import Attendance, Discussion, Excellence, Meeting, Presenter, Rating, RatingVote, User
from app.models.base import gen_uuid
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
    VoteDetailOut,
)

router = APIRouter(prefix="/eval", tags=["eval"])

_WD = ["一", "二", "三", "四", "五", "六", "日"]
_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def _upsert(db):
    """按连接方言选 UPSERT 构造器：生产 Postgres / 测试 SQLite 均支持 ON CONFLICT。
    统一用 index_elements（列名）推断唯一约束，避免 PG 专用的 constraint 名在 SQLite 上失效。"""
    return sqlite_insert if db.bind.dialect.name == "sqlite" else pg_insert


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

    # 评分/录入列表的下界沿用评选期起点，上界改为「今天」——不再受评选期终点 to 限制。
    # 否则评选期一旦结束（to 为过去日期），最近的组会既进不了评分入口，也无法录入出勤，
    # 导致「最近组会」错误指向评选期内最后一场旧组会（反馈 P0-5）。评选期 to 只用于统计聚合。
    today_iso = date.today().isoformat()
    out = []
    for m in data["meetings_rows"]:
        iso = f"{m.date.year:04d}-{m.date.month:02d}-{m.date.day:02d}"
        if rng.get("from") and iso < rng["from"]:
            continue
        if iso > today_iso:
            continue  # 未来的组会尚未举行，不进入评分/录入列表
        out.append(ReportOut(
            key=m.id, y=m.date.year, mo=m.date.month - 1, day=m.date.day,
            dateLabel=f"{m.date.month}月{m.date.day}日 周{_WD[m.date.weekday()]}",
            type=m.type, template=m.template or "正式报告", scored=m.scored,
            presenters=[p.name for p in m.presenters],
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
        return ExcellenceOut(
            period=latest.period, from_=latest.from_, to=latest.to,
            names=latest.names, count=latest.count,
            perfect_attendance=latest.perfect_attendance or [],
            award_excellence=latest.award_excellence,
            award_attendance=latest.award_attendance,
            note=latest.note or "",
            published=True, published_at=latest.published_at,
        )
    data = await load_eval_data(db)
    ev = _compute(data)
    names = [m["name"] for m in ev["merged"][:count]]
    perfect_att = [r["name"] for r in ev["rows"] if r.get("attRate", 0) == 100]
    rng = data["rng"]
    return ExcellenceOut(
        period=data.get("period", ""), from_=rng.get("from", ""),
        to=rng.get("to", ""), names=names, count=len(names),
        perfect_attendance=perfect_att,
        award_excellence=data.get("award_excellence", 1000),
        award_attendance=data.get("award_attendance", 100),
        published=False,
    )


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
    # UPSERT 每位报告人的聚合：core 层 ON CONFLICT DO UPDATE。原先 select-then-insert 在多名成员
    # 组会后同时提交、并发重算同一场时，会双双查不到 Rating 而各自 insert，撞唯一约束
    # (meeting, presenter) → IntegrityError → 500（反馈「评分提交失败，请重试」的真正根因）。
    for presenter, (asum, psum, lsum, n) in agg.items():
        vals = dict(attitude=asum / n if n else 0.0, polish=psum / n if n else 0.0,
                    logic=lsum / n if n else 0.0, raters=n)
        stmt = _upsert(db)(Rating).values(id=gen_uuid(), meeting_id=meeting_id, presenter=presenter, **vals)
        await db.execute(stmt.on_conflict_do_update(index_elements=["meeting_id", "presenter"], set_=vals))
    # 已无选票的报告人评分归零（撤回场景）——一条 UPDATE，天然无插入冲突。
    zero_r = update(Rating).where(Rating.meeting_id == meeting_id)
    if agg:
        zero_r = zero_r.where(Rating.presenter.notin_(list(agg)))
    await db.execute(zero_r.values(attitude=0.0, polish=0.0, logic=0.0, raters=0))

    # —— 讨论得分（每个 rater 的 Top5 只计一次；同一 rater 多次提交时取最后一次非空 top5）——
    by_rater: dict[str, list] = {}
    for v in votes:
        by_rater[v.rater_id] = [n for n in (v.top5 or []) if n]
    points: dict[str, int] = {}
    for top5 in by_rater.values():
        for i, name in enumerate(top5[:5]):
            if name:
                points[name] = points.get(name, 0) + (5 - i)
    # UPSERT 讨论得分：insert 时 speaks 默认 0，冲突只改 points，保留管理员录入的发言次数。
    for name, pts in points.items():
        stmt = _upsert(db)(Discussion).values(id=gen_uuid(), meeting_id=meeting_id, name=name, points=pts, speaks=0)
        await db.execute(stmt.on_conflict_do_update(index_elements=["meeting_id", "name"], set_=dict(points=pts)))
    # 其余成员讨论得分归零，只清 points 保留 speaks。
    zero_d = update(Discussion).where(Discussion.meeting_id == meeting_id)
    if points:
        zero_d = zero_d.where(Discussion.name.notin_(list(points)))
    await db.execute(zero_d.values(points=0))


# ── 成员：提交评分（每人对每位报告人只计一次，重复提交即覆盖）──
@router.post("/reports/{key}/rating", status_code=status.HTTP_204_NO_CONTENT)
async def submit_rating(key: str, body: RatingSubmit, me: CurrentUser, db: DbSession) -> None:
    meeting = await _meeting_by_id(db, key)
    # 非评分场（工作坊/团建/仅考勤）不接受报告评分（反馈 #8）。
    if not meeting.scored:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="该组会不参与评分")
    # 评分准入只取决于「组会真实存在 + 报告人在场 + 非自评 + 组会已举行」，
    # 不再受评选期区间限制。评选期 to 是统计聚合窗口，不应把最近组会挡在评分之外（反馈 P0-1）。
    valid_presenters = list((await db.execute(
        select(Presenter.name).where(Presenter.meeting_id == meeting.id)
    )).scalars())
    if body.presenter not in valid_presenters:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="该报告人不在本场组会中")
    # 不可给自己评分
    if me.name == body.presenter:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="不能给自己评分")
    # 未来的组会尚未举行，暂不能评分
    if meeting.date > date.today():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="该组会尚未举行，暂不能评分")
    # UPSERT 选票（唯一约束 (meeting, rater, presenter)：每人对每位报告人只计一次，重复提交即覆盖）。
    top5 = [n for n in body.top5 if n and n != me.name]
    vals = dict(attitude=body.attitude, polish=body.polish, logic=body.logic, top5=top5)
    stmt = _upsert(db)(RatingVote).values(
        id=gen_uuid(), meeting_id=meeting.id, rater_id=me.id, presenter=body.presenter, **vals,
    ).on_conflict_do_update(index_elements=["meeting_id", "rater_id", "presenter"], set_=vals)
    try:
        await db.execute(stmt)
        await _recompute_meeting_eval(db, meeting.id)
        await db.commit()
    except IntegrityError as exc:
        # UPSERT 后极少触发；作为并发写的最后兜底，回滚并给出可读提示而非裸 500。
        await db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, detail="评分正被并发写入，请稍后重试") from exc


# ── 管理员：录入出勤（端口 store.ts setAttendance）──
@router.post("/reports/{key}/attendance", status_code=status.HTTP_204_NO_CONTENT)
async def set_attendance(key: str, body: AttendanceSet, _: AdminUser, db: DbSession) -> None:
    meeting = await _meeting_by_id(db, key)
    # UPSERT 出勤：管理员「保存」一次会并发写整册成员，select-then-insert 会撞唯一约束
    # (meeting, name) → 500（反馈「保存失败」根因之一）。ON CONFLICT DO UPDATE 根治。
    stmt = _upsert(db)(Attendance).values(
        id=gen_uuid(), meeting_id=meeting.id, name=body.name, status=body.status,
    ).on_conflict_do_update(index_elements=["meeting_id", "name"], set_=dict(status=body.status))
    await db.execute(stmt)
    if body.status != "present":
        # 非出勤者清讨论得分（若讨论行不存在则无行可改，无需插入）。
        await db.execute(
            update(Discussion)
            .where(Discussion.meeting_id == meeting.id, Discussion.name == body.name)
            .values(points=0)
        )
    await db.commit()


# ── 管理员：录入发言次数（讨论得分由成员匿名评分得出，此处只录发言次数）──
@router.post("/reports/{key}/speaks", status_code=status.HTTP_204_NO_CONTENT)
async def set_speaks(key: str, body: SpeaksSet, _: AdminUser, db: DbSession) -> None:
    meeting = await _meeting_by_id(db, key)
    speaks = max(0, body.count)
    # UPSERT 发言次数：insert 时 points 默认 0，冲突只改 speaks，保留匿名评分算出的讨论得分。
    stmt = _upsert(db)(Discussion).values(
        id=gen_uuid(), meeting_id=meeting.id, name=body.name, points=0, speaks=speaks,
    ).on_conflict_do_update(index_elements=["meeting_id", "name"], set_=dict(speaks=speaks))
    await db.execute(stmt)
    await db.commit()


# ── 管理员：评选配置 ──
@router.get("/config", response_model=EvalConfigIO)
async def get_config(_: AdminUser, db: DbSession) -> EvalConfigIO:
    data = await load_eval_data(db)
    return EvalConfigIO(weights=data["weights"], filters=data["filters"],
                        range=data["rng"], progress_order=data["progress_order"],
                        period=data.get("period", ""),
                        award_excellence=data.get("award_excellence", 1000),
                        award_attendance=data.get("award_attendance", 100))


@router.put("/config", response_model=EvalConfigIO)
async def put_config(body: EvalConfigIO, admin: AdminUser, db: DbSession) -> EvalConfigIO:
    data = await load_eval_data(db)
    cfg = data["config_row"]
    if cfg is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="未初始化评选配置")
    cfg.weights = body.weights
    cfg.filters = body.filters
    cfg.range_ = body.range
    cfg.progress_order = body.progress_order
    cfg.period = body.period
    cfg.award_excellence = body.award_excellence
    cfg.award_attendance = body.award_attendance
    await write_audit(db, actor=admin.name, action="update_eval_config",
                      summary=f"更新评选标准（区间 {body.range.get('from', '')}~{body.range.get('to', '')}）")
    await db.commit()
    return body


# ── 管理员：获取全部历史优秀名单 ──
@router.get("/excellence/all", response_model=list[ExcellenceOut])
async def excellence_all(_: CurrentUser, db: DbSession) -> list[ExcellenceOut]:
    rows = list((await db.execute(
        select(Excellence).order_by(Excellence.published_at.desc())
    )).scalars())
    return [
        ExcellenceOut(
            period=e.period, from_=e.from_, to=e.to,
            names=e.names, count=e.count,
            perfect_attendance=e.perfect_attendance or [],
            award_excellence=e.award_excellence,
            award_attendance=e.award_attendance,
            note=e.note or "",
            published=True, published_at=e.published_at,
        )
        for e in rows
    ]


# ── 管理员：发布优秀名单 ──
@router.post("/excellence", response_model=ExcellenceOut, status_code=status.HTTP_201_CREATED)
async def publish_excellence(body: PublishExcellence, admin: AdminUser, db: DbSession) -> ExcellenceOut:
    data = await load_eval_data(db)
    period = data.get("period", "")
    existing = (await db.execute(
        select(Excellence).where(Excellence.period == period).limit(1)
    )).scalar_one_or_none()
    ev = _compute(data)
    # 名单默认按终极排名取前 N；允许管理员显式传 names 覆盖（手动确认名单，排名仅参考）。
    if body.names is not None:
        names = [n for n in body.names if n]
    else:
        names = [m["name"] for m in ev["merged"][: max(1, body.count)]]
    # 全勤 = 评选期内出勤率 100% 的成员
    perfect_att = [r["name"] for r in ev["rows"] if r.get("attRate", 0) == 100]
    rng = data["rng"]
    award_exc = data.get("award_excellence", 1000)
    award_att = data.get("award_attendance", 100)
    now = datetime.now(timezone.utc)
    if existing is not None:
        # 同一评选期重新发布 = 覆盖更新。原先直接抛 409，导致「第一次成功、第二次起一直失败」
        # （反馈 #4）。评选期唯一，重发即修订名单，覆盖是正确语义。
        exc = existing
        exc.from_, exc.to = rng.get("from", ""), rng.get("to", "")
        exc.names, exc.count = names, len(names)
        exc.perfect_attendance = perfect_att
        exc.award_excellence, exc.award_attendance = award_exc, award_att
        exc.note = body.note
        exc.published_at = now
    else:
        exc = Excellence(
            period=period, from_=rng.get("from", ""), to=rng.get("to", ""),
            names=names, count=len(names),
            perfect_attendance=perfect_att,
            award_excellence=award_exc, award_attendance=award_att,
            note=body.note, published_at=now,
        )
        db.add(exc)
    await write_audit(db, actor=admin.name, action="publish_excellence",
                      summary=f"发布优秀名单 {len(names)} 人（{period or '未命名评选期'}）：{'、'.join(names) or '空'}",
                      detail={"names": names, "note": body.note})
    await db.commit()
    return ExcellenceOut(
        period=exc.period, from_=exc.from_, to=exc.to,
        names=exc.names, count=exc.count,
        perfect_attendance=exc.perfect_attendance,
        award_excellence=exc.award_excellence,
        award_attendance=exc.award_attendance,
        note=exc.note,
        published=True, published_at=exc.published_at,
    )


# ── 管理员：审核某场组会的评分明细（反馈 #9）──
@router.get("/reports/{key}/votes", response_model=list[VoteDetailOut])
async def list_votes(key: str, _: AdminUser, db: DbSession) -> list[VoteDetailOut]:
    """列出某场组会的全部匿名选票明细，供管理员核查异常评分。"""
    meeting = await _meeting_by_id(db, key)
    votes = list((await db.execute(
        select(RatingVote).where(RatingVote.meeting_id == meeting.id).order_by(RatingVote.presenter)
    )).scalars())
    ids = {v.rater_id for v in votes}
    names: dict[str, str] = {}
    if ids:
        for u in (await db.execute(select(User).where(User.id.in_(ids)))).scalars():
            names[u.id] = u.name
    return [
        VoteDetailOut(
            id=v.id, rater=names.get(v.rater_id, "（已注销）"), presenter=v.presenter,
            attitude=v.attitude, polish=v.polish, logic=v.logic, top5=list(v.top5 or []),
        )
        for v in votes
    ]


# ── 管理员：删除无效选票并重算（删除即「退回」——该成员可重新提交，反馈 #9）──
@router.delete("/votes/{vote_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_vote(vote_id: str, admin: AdminUser, db: DbSession) -> None:
    v = await db.get(RatingVote, vote_id)
    if v is None:
        return
    meeting_id = v.meeting_id
    presenter = v.presenter
    await db.delete(v)
    await db.flush()
    await _recompute_meeting_eval(db, meeting_id)
    await write_audit(db, actor=admin.name, action="delete_vote",
                      summary=f"退回一条对「{presenter}」的评分")
    await db.commit()
