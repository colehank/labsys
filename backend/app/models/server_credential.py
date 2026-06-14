"""用户保存的 SSH 凭据 —— 每(用户, 服务器)一条，密码加密存储。

仅当配置了加密密钥（CIBOL_SSH_CRED_KEY）才会写入；密码以 Fernet 密文存 password_enc，
绝不存明文。WebSSH「记住」时写入，下次自动用它连接。
"""
from __future__ import annotations

from sqlalchemy import ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDMixin


class ServerCredential(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "server_credentials"
    __table_args__ = (UniqueConstraint("user_id", "server_id", name="uq_cred_user_server"),)

    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    server_id: Mapped[str] = mapped_column(ForeignKey("servers.id", ondelete="CASCADE"), index=True)
    username: Mapped[str] = mapped_column(String(64))
    password_enc: Mapped[str] = mapped_column(Text)  # Fernet 密文，绝非明文
