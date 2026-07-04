"""匿名意见 —— 成员可向实验室匿名提交想法，管理员可查看。

刻意不记录任何提交者身份（无 user 外键），仅存内容与时间，保证「完全匿名」承诺。
"""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, UUIDMixin


class Feedback(UUIDMixin, Base):
    __tablename__ = "feedback"

    body: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    read: Mapped[bool] = mapped_column(Boolean, default=False)  # 管理员是否已读
