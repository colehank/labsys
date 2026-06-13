"""实验室业务 DTO —— 输出形状对齐前端组件读取的字段。"""
from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel

from app.models import AnnLevel


# ── 配置 ──
class SemesterOut(BaseModel):
    name: str
    short: str
    start: date
    end: date


class MeetingDefaultOut(BaseModel):
    weekday: str
    time: str
    place: str


class ConfigOut(BaseModel):
    semester: SemesterOut
    meetingDefault: MeetingDefaultOut


# ── 公告 ──
class AnnouncementCreate(BaseModel):
    title: str
    body: str = ""
    level: AnnLevel = AnnLevel.info
    pinned: bool = False
    audience: str = "all"
    author: str = ""
    expiresAt: date | None = None


class AnnouncementOut(BaseModel):
    id: str
    title: str
    body: str
    level: AnnLevel
    pinned: bool
    audience: str
    author: str
    publishedAt: datetime
    expiresAt: date | None = None


# ── 组会 ──
class OnlineMeetingOut(BaseModel):
    url: str | None = None
    provider: str | None = None
    id: str | None = None
    password: str | None = None
    status: str | None = None


class PresenterOut(BaseModel):
    name: str
    topic: str
    kind: str = ""
    minutes: int | None = None


class MeetingOut(BaseModel):
    id: str
    y: int
    mo: int          # 0-based（对齐前端 JS getMonth）
    day: int
    mdLabel: str     # 6/14
    dateLabel: str   # 6月14日 周日
    type: str
    tone: str        # accent | info
    status: str
    online: OnlineMeetingOut | None = None
    presenters: list[PresenterOut]
