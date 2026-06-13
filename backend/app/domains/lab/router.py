"""实验室业务读路由 —— 配置 / 公告 / 组会排期。均需登录。"""
from __future__ import annotations

from datetime import date, datetime, timezone

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.deps import AdminUser, CurrentUser, DbSession
from app.domains.lab.serializers import ann_sort_key, announcement_out, meeting_out
from app.models import Announcement, LabConfig, Meeting, Semester
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
