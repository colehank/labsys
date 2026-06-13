"""用户相关 DTO。"""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr

from app.models import Role


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    email: EmailStr
    role: Role
    title: str
    ssh_pubkey: str | None = None
    settings: dict
    created_at: datetime


class UserSettingsUpdate(BaseModel):
    name: str | None = None
    title: str | None = None
    ssh_pubkey: str | None = None
    settings: dict | None = None
