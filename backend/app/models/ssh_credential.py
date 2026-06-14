"""用户的 SSH 登录账密 —— 用户级、与具体服务器解耦，可有多条。

实验室通常一个账号通所有机器（统一身份/共享 home），故账密**不绑定服务器**、
跨所有服务器与设备共用。一个用户可存多条（如个人账号、项目共享账号）。
密码以 Fernet 密文存 password_enc，绝不存明文。
"""
from __future__ import annotations

from sqlalchemy import ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDMixin


class SshCredential(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "ssh_credentials"
    # 同一用户同一账号名只存一条（再存即更新密码）
    __table_args__ = (UniqueConstraint("user_id", "username", name="uq_sshcred_user_name"),)

    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    username: Mapped[str] = mapped_column(String(64))
    password_enc: Mapped[str] = mapped_column(Text)  # Fernet 密文，绝非明文
