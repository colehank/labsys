"""服务器模型 —— 管理员维护清单，用户端只读展示 + 申请账号。"""
from __future__ import annotations

import enum

from sqlalchemy import Enum, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, UUIDMixin


class ServerStatus(str, enum.Enum):
    online = "online"
    busy = "busy"
    offline = "offline"


class Server(UUIDMixin, Base):
    __tablename__ = "servers"

    name: Mapped[str] = mapped_column(String(64))
    ip: Mapped[str] = mapped_column(String(64), default="")
    ssh_port: Mapped[int] = mapped_column(Integer, default=22)  # fodor/hinton 走 80
    gpu: Mapped[str] = mapped_column(String(128), default="")
    status: Mapped[ServerStatus] = mapped_column(
        Enum(ServerStatus, name="server_status"), default=ServerStatus.online
    )
    net: Mapped[str] = mapped_column(String(16), default="intranet")  # intranet | public
    desc: Mapped[str] = mapped_column(Text, default="")
