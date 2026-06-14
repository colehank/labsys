"""服务器 / 通知 DTO。"""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict

# status 不再由管理员设置：服务器状态改由前端按「当前连接状态」实时呈现，
# 故 DTO 不含 status（model 仍保留该列以兼容历史，但不暴露/不可写）。


class ServerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    ip: str
    ssh_port: int
    gpu: str
    net: str
    desc: str


class ServerCreate(BaseModel):
    name: str
    ip: str = ""
    ssh_port: int = 22
    gpu: str = ""
    net: str = "intranet"
    desc: str = ""


class ServerUpdate(BaseModel):
    name: str | None = None
    ip: str | None = None
    ssh_port: int | None = None
    gpu: str | None = None
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
