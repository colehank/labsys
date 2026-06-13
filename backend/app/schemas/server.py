"""服务器 / 通知 DTO。"""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models import ServerStatus


class ServerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    ip: str
    ssh_port: int
    gpu: str
    status: ServerStatus
    net: str
    desc: str


class ServerCreate(BaseModel):
    name: str
    ip: str = ""
    ssh_port: int = 22
    gpu: str = ""
    status: ServerStatus = ServerStatus.online
    net: str = "intranet"
    desc: str = ""


class ServerUpdate(BaseModel):
    name: str | None = None
    ip: str | None = None
    ssh_port: int | None = None
    gpu: str | None = None
    status: ServerStatus | None = None
    net: str | None = None
    desc: str | None = None


class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    type: str
    title: str
    body: str
    read: bool
    created_at: datetime
