"""API 密钥模型 —— 管理员审批后为成员签发的 dmxapi 令牌。"""
from __future__ import annotations

from sqlalchemy import Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDMixin


class ApiKey(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "api_keys"

    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    label: Mapped[str] = mapped_column(String(128), default="")
    # 上游 dmxapi 令牌（sk-…）。仅后端持有，前端展示打码。
    upstream_key: Mapped[str] = mapped_column(String(128))
    budget: Mapped[float] = mapped_column(Float, default=0.0)   # 预算上限（RMB）
    status: Mapped[str] = mapped_column(String(16), default="active")  # active | revoked
