"""用户模型 —— 成员/管理员，账号密码 + JWT 认证主体。"""
from __future__ import annotations

import enum

from sqlalchemy import JSON, Enum, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDMixin


class Role(str, enum.Enum):
    member = "member"
    admin = "admin"


class User(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "users"

    name: Mapped[str] = mapped_column(String(64), index=True)
    email: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[Role] = mapped_column(Enum(Role, name="user_role"), default=Role.member)
    # 角色头衔，如「硕士二年级 / 博士后 / 访问学者」（对应 demo 的 member.role）
    title: Mapped[str] = mapped_column(String(64), default="")
    # 成员自己的 SSH 公钥，账号下发时注入目标机（P3）
    ssh_pubkey: Mapped[str | None] = mapped_column(Text, nullable=True)
    # 个人设置（通知偏好等），对应前端「我的」页
    settings: Mapped[dict] = mapped_column(JSON, default=dict)
