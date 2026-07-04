"""实验室业务读路由 —— 配置 / 公告 / 组会排期。均需登录。"""
from __future__ import annotations

from datetime import date, datetime, timezone

from fastapi import APIRouter, BackgroundTasks, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import or_, select
from sqlalchemy.orm import selectinload

from app.core.deps import AdminUser, CurrentUser, DbSession
from app.domains.audit.service import write_audit
from app.domains.lab.serializers import ann_sort_key, announcement_out, meeting_out
from app.domains.notify.service import notify
from app.models import (
    Announcement,
    LabConfig,
    Meeting,
    MeetingStatus,
    MeetingType,
    Presenter,
    Semester,
    User,
)
from app.schemas.lab import (
    AnnouncementCreate,
    AnnouncementOut,
    ConfigOut,
    MeetingDefaultOut,
    MeetingOut,
    SemesterOut,
)

router = APIRouter(tags=["lab"])


@router.get("/config", response_model=ConfigOut)
async def get_config(_: CurrentUser, db: DbSession) -> ConfigOut:
    sem = (
        await db.execute(select(Semester).where(Semester.is_current).limit(1))
    ).scalar_one_or_none()
    if sem is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="未配置当前学期")
    cfg = (await db.execute(select(LabConfig).limit(1))).scalar_one_or_none()
    return ConfigOut(
        semester=SemesterOut(name=sem.name, short=sem.short, start=sem.start, end=sem.end),
        meetingDefault=MeetingDefaultOut(
            weekday=cfg.weekday if cfg else "周日",
            time=cfg.time if cfg else "",
            place=cfg.place if cfg else "",
        ),
    )


class SemesterIn(BaseModel):
    name: str
    short: str = ""
    start: date
    end: date


class MeetingDefaultIn(BaseModel):
    weekday: str = "周日"
    time: str = ""
    place: str = ""


class ConfigIn(BaseModel):
    semester: SemesterIn
    meetingDefault: MeetingDefaultIn


@router.put("/config", response_model=ConfigOut)
async def update_config(body: ConfigIn, _: AdminUser, db: DbSession) -> ConfigOut:
    """保存当前学期与组会默认（管理员）。无则建、有则更新。"""
    sem = (
        await db.execute(select(Semester).where(Semester.is_current).limit(1))
    ).scalar_one_or_none()
    if sem is None:
        sem = Semester(is_current=True)
        db.add(sem)
    sem.name = body.semester.name.strip()
    sem.short = (body.semester.short or body.semester.name).replace("季学期", "").replace("学期", "").strip()
    sem.start = body.semester.start
    sem.end = body.semester.end

    cfg = (await db.execute(select(LabConfig).limit(1))).scalar_one_or_none()
    if cfg is None:
        cfg = LabConfig()
        db.add(cfg)
    cfg.weekday = body.meetingDefault.weekday
    cfg.time = body.meetingDefault.time
    cfg.place = body.meetingDefault.place

    await db.commit()
    await db.refresh(sem)
    await db.refresh(cfg)
    return ConfigOut(
        semester=SemesterOut(name=sem.name, short=sem.short, start=sem.start, end=sem.end),
        meetingDefault=MeetingDefaultOut(weekday=cfg.weekday, time=cfg.time, place=cfg.place),
    )


@router.get("/announcements", response_model=list[AnnouncementOut])
async def list_announcements(me: CurrentUser, db: DbSession) -> list[AnnouncementOut]:
    """当前生效的公告（未过期），按 pinned → level → 时间排序。
    管理员可见全部公告；普通成员只见 audience='all' 或 'students' 的公告。
    """
    today = date.today()
    q = select(Announcement).where(
        or_(Announcement.expires_at.is_(None), Announcement.expires_at >= today)
    )
    if me.role != "admin":
        q = q.where(Announcement.audience.in_(("all", "students")))
    rows = list((await db.execute(q)).scalars())
    rows.sort(key=ann_sort_key)
    return [announcement_out(a) for a in rows]


@router.post("/announcements", response_model=AnnouncementOut, status_code=status.HTTP_201_CREATED)
async def publish_announcement(
    body: AnnouncementCreate, admin: AdminUser, db: DbSession, tasks: BackgroundTasks
) -> AnnouncementOut:
    ann = Announcement(
        title=body.title.strip(), body=body.body.strip(), level=body.level,
        pinned=body.pinned, audience=body.audience,
        author=body.author or f"管理员 · {admin.name}",
        published_at=datetime.now(timezone.utc), expires_at=body.expiresAt,
    )
    db.add(ann)
    await db.commit()
    await db.refresh(ann)

    # 向目标受众发站内通知
    q = select(User).where(User.disabled.is_(False))
    if body.audience == "students":
        q = q.where(User.role == "member")
    users = list((await db.execute(q)).scalars())
    for u in users:
        await notify(
            db, user_id=u.id,
            title=f"新公告：{ann.title}",
            body=ann.body[:100] + ("…" if len(ann.body) > 100 else ""),
            type="info", tasks=tasks,
        )

    return announcement_out(ann)


@router.post("/announcements/{ann_id}/toggle-pin", response_model=AnnouncementOut)
async def toggle_pin(ann_id: str, _: AdminUser, db: DbSession) -> AnnouncementOut:
    ann = await db.get(Announcement, ann_id)
    if ann is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="公告不存在")
    ann.pinned = not ann.pinned
    await db.commit()
    await db.refresh(ann)
    return announcement_out(ann)


@router.delete("/announcements/{ann_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_announcement(ann_id: str, _: AdminUser, db: DbSession) -> None:
    ann = await db.get(Announcement, ann_id)
    if ann is not None:
        await db.delete(ann)
        await db.commit()


@router.get("/meetings", response_model=list[MeetingOut])
async def list_meetings(_: CurrentUser, db: DbSession) -> list[MeetingOut]:
    """整学期组会排期（按日期升序），含报告人与在线会议信息。"""
    rows = list(
        (
            await db.execute(
                select(Meeting)
                .options(selectinload(Meeting.presenters))
                .order_by(Meeting.date)
            )
        ).scalars()
    )
    return [meeting_out(m) for m in rows]


class PresenterIn(BaseModel):
    name: str
    topic: str = ""
    kind: str = ""


class MeetingIn(BaseModel):
    date: date
    type: str = "进展汇报"        # MeetingType 值：进展汇报 / 文献精读
    host: str = ""               # 主持人（排期指定，可空）
    time: str = ""
    place: str = ""
    template: str = "正式报告"    # 评分模板：正式报告 / 工作坊 / 团建 / 仅考勤
    scored: bool = True          # 是否参与正式评分
    presenters: list[PresenterIn] = []


class ScheduleIn(BaseModel):
    meetings: list[MeetingIn]
    # 学期隔离（反馈 #1）：仅在 [scope_from, scope_to] 范围内做全量替换；范围外的组会
    # 属于其它学期，一律保留。不传 scope 时退回旧的全表替换语义（兼容）。
    scope_from: date | None = None
    scope_to: date | None = None


@router.put("/meetings/schedule", response_model=list[MeetingOut])
async def replace_schedule(body: ScheduleIn, admin: AdminUser, db: DbSession) -> list[MeetingOut]:
    """整体保存组会排期（管理员）。

    按日期 upsert：表里有该日期则更新、没有则新增；表里多出的日期删除。
    匹配到日期的会议**保留其在线会议信息**（online_*），避免重排丢失已预约的腾讯会议。
    """
    dates = [mi.date for mi in body.meetings]
    if len(dates) != len(set(dates)):
        from collections import Counter
        dups = [str(d) for d, cnt in Counter(dates).items() if cnt > 1]
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=f"排期中存在重复日期：{', '.join(dups)}")
    existing = {
        m.date: m
        for m in (
            await db.execute(select(Meeting).options(selectinload(Meeting.presenters)))
        ).scalars()
    }
    seen: set[date] = set()
    added = 0
    for mi in body.meetings:
        seen.add(mi.date)
        m = existing.get(mi.date)
        if m is None:
            m = Meeting(date=mi.date, status=MeetingStatus.scheduled)
            db.add(m)
            added += 1
        m.type = mi.type or MeetingType.progress.value   # 自由文本类型，管理员自定义
        m.host = mi.host
        m.time = mi.time
        m.place = mi.place
        m.template = mi.template or "正式报告"
        m.scored = mi.scored
        # presenters 关系 cascade=all,delete-orphan → 整体替换
        m.presenters = [
            Presenter(name=p.name, topic=p.topic, kind=p.kind, ord=i)
            for i, p in enumerate(mi.presenters)
        ]
    # 删除不在新排期里的日期——但仅限本次操作的学期范围内（scope）。范围外组会属于其它
    # 学期，保留不动，避免「排下学期把本学期连数据一起删掉」（反馈 #1，按学期隔离）。
    removed = 0
    for d, m in existing.items():
        if d in seen:
            continue
        if body.scope_from and d < body.scope_from:
            continue
        if body.scope_to and d > body.scope_to:
            continue
        await db.delete(m)
        removed += 1
    scope = f"{body.scope_from}~{body.scope_to}" if body.scope_from or body.scope_to else "全学期"
    await write_audit(db, actor=admin.name, action="save_schedule",
                      summary=f"保存排期（范围 {scope}）：共 {len(body.meetings)} 场，新增 {added}、删除 {removed}")
    await db.commit()
    rows = list(
        (
            await db.execute(
                select(Meeting).options(selectinload(Meeting.presenters)).order_by(Meeting.date)
            )
        ).scalars()
    )
    return [meeting_out(m) for m in rows]
