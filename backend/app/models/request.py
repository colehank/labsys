"""请求模型 —— 请假/对调/API/SSH 申请，带状态机与历史轨迹。

状态机：
  swap:    pending   → accepted | declined | cancelled
  absence: submitted → approved | rejected | cancelled
  api:     submitted → approved | rejected | cancelled
  ssh:     submitted → approved | rejected | cancelled
"""
from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class RequestKind(str, enum.Enum):
    swap = "swap"
    absence = "absence"
    api = "api"
    ssh = "ssh"


class Request(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "requests"

    kind: Mapped[RequestKind] = mapped_column(Enum(RequestKind, name="request_kind"), index=True)
    requester_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    # 对调对象（swap 专用）
    target_user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)

    from_date: Mapped[str] = mapped_column(String(32), default="")   # 展示用日期标签
    to_date: Mapped[str] = mapped_column(String(32), default="")
    topic: Mapped[str] = mapped_column(String(256), default="")
    detail: Mapped[str] = mapped_column(String(256), default="")
    reason: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(16), index=True)

    requester: Mapped["User"] = relationship(foreign_keys=[requester_id])  # noqa: F821
    target: Mapped["User | None"] = relationship(foreign_keys=[target_user_id])  # noqa: F821
    events: Mapped[list[RequestEvent]] = relationship(
        back_populates="request", cascade="all, delete-orphan", order_by="RequestEvent.at"
    )


class RequestEvent(UUIDMixin, Base):
    """状态迁移轨迹（= 前端 history）。"""
    __tablename__ = "request_events"

    request_id: Mapped[str] = mapped_column(ForeignKey("requests.id", ondelete="CASCADE"), index=True)
    status: Mapped[str] = mapped_column(String(16))
    note: Mapped[str] = mapped_column(String(256), default="")
    actor_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    request: Mapped[Request] = relationship(back_populates="events")
