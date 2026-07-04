"""管理操作审计日志 —— 记录「谁·何时·做了什么」（反馈 #14）。只记录，不做撤销。"""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, JSON, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, UUIDMixin


class AuditLog(UUIDMixin, Base):
    __tablename__ = "audit_logs"

    actor: Mapped[str] = mapped_column(String(64), index=True)       # 操作者姓名
    action: Mapped[str] = mapped_column(String(48), index=True)      # 动作 key，如 save_schedule / publish_excellence
    summary: Mapped[str] = mapped_column(String(255), default="")    # 人类可读摘要
    detail: Mapped[dict] = mapped_column(JSON, default=dict)         # 结构化明细（可选）
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
