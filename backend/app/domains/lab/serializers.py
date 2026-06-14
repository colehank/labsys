"""把 ORM 行转成前端期望的形状（含日期派生字段）。"""
from __future__ import annotations

from datetime import date

from app.models import Announcement, Meeting, MeetingType
from app.schemas.lab import AnnouncementOut, MeetingOut, OnlineMeetingOut, PresenterOut

_WD_CN = ["一", "二", "三", "四", "五", "六", "日"]  # Mon..Sun (date.weekday())

# level 权重，公告排序用：pinned → level → publishedAt desc
_LEVEL_WEIGHT = {"urgent": 3, "important": 2, "info": 1}


def meeting_out(m: Meeting) -> MeetingOut:
    d: date = m.date
    mo0 = d.month - 1
    md = f"{d.month}/{d.day:02d}"
    label = f"{d.month}月{d.day}日 周{_WD_CN[d.weekday()]}"
    tone = "accent" if m.type == MeetingType.progress else "info"
    online = None
    if m.online_url or m.online_status:  # 已预约/预约失败/进行中都暴露给前端
        online = OnlineMeetingOut(
            url=m.online_url, provider=m.online_provider, id=m.online_id,
            password=m.online_password, status=m.online_status,
        )
    return MeetingOut(
        id=m.id, y=d.year, mo=mo0, day=d.day, mdLabel=md, dateLabel=label,
        type=m.type.value, tone=tone, status=m.status.value,
        time=m.time or "", place=m.place or "", online=online,
        presenters=[
            PresenterOut(name=p.name, topic=p.topic, kind=p.kind, minutes=p.minutes)
            for p in m.presenters
        ],
    )


def announcement_out(a: Announcement) -> AnnouncementOut:
    return AnnouncementOut(
        id=a.id, title=a.title, body=a.body, level=a.level, pinned=a.pinned,
        audience=a.audience, author=a.author, publishedAt=a.published_at, expiresAt=a.expires_at,
    )


def ann_sort_key(a: Announcement):
    # 排序：pinned 优先 → level 权重 → publishedAt 倒序
    return (
        not a.pinned,
        -_LEVEL_WEIGHT.get(a.level.value, 0),
        -(a.published_at.timestamp() if a.published_at else 0),
    )
