"""实验室核心业务模型 —— 学期配置、公告、组会排期。"""
from __future__ import annotations

import enum
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class Semester(UUIDMixin, Base):
    """当前学期（管理员可改）。is_current 标记当前生效的一个。"""
    __tablename__ = "semesters"

    name: Mapped[str] = mapped_column(String(64))      # 2026 春季学期
    short: Mapped[str] = mapped_column(String(32))     # 2026 春
    start: Mapped[date] = mapped_column(Date)
    end: Mapped[date] = mapped_column(Date)
    is_current: Mapped[bool] = mapped_column(Boolean, default=False, index=True)


class LabConfig(UUIDMixin, Base):
    """全局组会默认（周几 · 时间 · 地点）。单行配置。"""
    __tablename__ = "lab_config"

    weekday: Mapped[str] = mapped_column(String(8), default="周日")
    time: Mapped[str] = mapped_column(String(32), default="14:00 – 16:00")
    place: Mapped[str] = mapped_column(String(128), default="")
    # 腾讯会议自动预约：开启后调度器在组会前 booking_auto_days_ahead 天自动建会
    auto_book: Mapped[bool] = mapped_column(Boolean, default=False)


class AnnLevel(str, enum.Enum):
    info = "info"
    important = "important"
    urgent = "urgent"


class Announcement(UUIDMixin, TimestampMixin, Base):
    """全员公告（管理员发布，首页展示）。"""
    __tablename__ = "announcements"

    title: Mapped[str] = mapped_column(String(128))
    body: Mapped[str] = mapped_column(Text, default="")
    level: Mapped[AnnLevel] = mapped_column(Enum(AnnLevel, name="ann_level"), default=AnnLevel.info)
    pinned: Mapped[bool] = mapped_column(Boolean, default=False)
    audience: Mapped[str] = mapped_column(String(16), default="all")  # all | students
    author: Mapped[str] = mapped_column(String(64), default="管理员")
    published_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[date | None] = mapped_column(Date, nullable=True)


class MeetingType(str, enum.Enum):
    """常用类型预设（仅作默认/上色参考）；type 列为自由文本，管理员可自定义任意类型
    （进展汇报 / 文献精读 / 团建 / 工作坊 …）。"""
    progress = "进展汇报"
    literature = "文献精读"


class MeetingStatus(str, enum.Enum):
    scheduled = "scheduled"
    cancelled = "cancelled"


class Meeting(UUIDMixin, TimestampMixin, Base):
    """一次组会（整学期排期，每周一次）。"""
    __tablename__ = "meetings"

    date: Mapped[date] = mapped_column(Date, index=True)
    # 自由文本类型（管理员自定义）；预设见 MeetingType
    type: Mapped[str] = mapped_column(String(32), default=MeetingType.progress.value)
    host: Mapped[str] = mapped_column(String(64), default="")   # 主持人（排期时指定，可空）
    place: Mapped[str] = mapped_column(String(128), default="")
    time: Mapped[str] = mapped_column(String(32), default="")
    status: Mapped[MeetingStatus] = mapped_column(
        Enum(MeetingStatus, name="meeting_status"), default=MeetingStatus.scheduled
    )
    # 在线会议（系统自动创建；失败则 status != ok，需管理员设置）
    online_url: Mapped[str | None] = mapped_column(String(256), nullable=True)
    online_provider: Mapped[str | None] = mapped_column(String(32), nullable=True)
    online_id: Mapped[str | None] = mapped_column(String(48), nullable=True)
    online_password: Mapped[str | None] = mapped_column(String(48), nullable=True)
    online_status: Mapped[str | None] = mapped_column(String(16), nullable=True)  # ok | failed | pending

    presenters: Mapped[list[Presenter]] = relationship(
        back_populates="meeting", cascade="all, delete-orphan", order_by="Presenter.ord"
    )


class Presenter(UUIDMixin, Base):
    """组会报告人（一次组会可有多位）。"""
    __tablename__ = "presenters"

    meeting_id: Mapped[str] = mapped_column(ForeignKey("meetings.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    name: Mapped[str] = mapped_column(String(64))     # 姓名快照（兼容外部成员）
    topic: Mapped[str] = mapped_column(Text, default="")   # 主题 / 完整文献引用（含 DOI，可很长）
    kind: Mapped[str] = mapped_column(String(32), default="")   # 进展汇报 / 文献精读
    minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    ord: Mapped[int] = mapped_column(Integer, default=0)

    meeting: Mapped[Meeting] = relationship(back_populates="presenters")
