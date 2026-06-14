"""实验室业务读路由 —— 配置 / 公告 / 组会排期。均需登录。"""
from __future__ import annotations

from datetime import date, datetime, timezone

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.deps import AdminUser, CurrentUser, DbSession
from app.domains.lab.serializers import ann_sort_key, announcement_out, meeting_out
from app.models import (
    Announcement,
    LabConfig,
    Meeting,
    MeetingStatus,
    MeetingType,
    Presenter,
    Semester,
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
async def list_announcements(_: CurrentUser, db: DbSession) -> list[AnnouncementOut]:
    """当前生效的公告（未过期），按 pinned → level → 时间排序。"""
    today = date.today()
    rows = list((await db.execute(select(Announcement))).scalars())
    active = [a for a in rows if a.expires_at is None or a.expires_at >= today]
    active.sort(key=ann_sort_key)
    return [announcement_out(a) for a in active]


@router.post("/announcements", response_model=AnnouncementOut, status_code=status.HTTP_201_CREATED)
async def publish_announcement(body: AnnouncementCreate, admin: AdminUser, db: DbSession) -> AnnouncementOut:
    ann = Announcement(
        title=body.title.strip(), body=body.body.strip(), level=body.level,
        pinned=body.pinned, audience=body.audience,
        author=body.author or f"管理员 · {admin.name}",
        published_at=datetime.now(timezone.utc), expires_at=body.expiresAt,
    )
    db.add(ann)
    await db.commit()
    await db.refresh(ann)
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
    time: str = ""
    place: str = ""
    presenters: list[PresenterIn] = []


class ScheduleIn(BaseModel):
    meetings: list[MeetingIn]


@router.put("/meetings/schedule", response_model=list[MeetingOut])
async def replace_schedule(body: ScheduleIn, _: AdminUser, db: DbSession) -> list[MeetingOut]:
    """整体保存组会排期（管理员）。

    按日期 upsert：表里有该日期则更新、没有则新增；表里多出的日期删除。
    匹配到日期的会议**保留其在线会议信息**（online_*），避免重排丢失已预约的腾讯会议。
    """
    existing = {
        m.date: m
        for m in (
            await db.execute(select(Meeting).options(selectinload(Meeting.presenters)))
        ).scalars()
    }
    seen: set[date] = set()
    for mi in body.meetings:
        seen.add(mi.date)
        m = existing.get(mi.date)
        if m is None:
            m = Meeting(date=mi.date, status=MeetingStatus.scheduled)
            db.add(m)
        try:
            m.type = MeetingType(mi.type)
        except ValueError:
            m.type = MeetingType.progress
        m.time = mi.time
        m.place = mi.place
        # presenters 关系 cascade=all,delete-orphan → 整体替换
        m.presenters = [
            Presenter(name=p.name, topic=p.topic, kind=p.kind, ord=i)
            for i, p in enumerate(mi.presenters)
        ]
    # 删除不在新排期里的日期
    for d, m in existing.items():
        if d not in seen:
            await db.delete(m)
    await db.commit()
    rows = list(
        (
            await db.execute(
                select(Meeting).options(selectinload(Meeting.presenters)).order_by(Meeting.date)
            )
        ).scalars()
    )
    return [meeting_out(m) for m in rows]
