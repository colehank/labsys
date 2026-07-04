"""用户相关 DTO。"""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models import Role


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    email: EmailStr
    role: Role
    title: str
    disabled: bool = False
    ssh_pubkey: str | None = None
    settings: dict
    created_at: datetime


class UserSettingsUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=64)
    title: str | None = None
    ssh_pubkey: str | None = None
    settings: dict | None = None


class UserCreate(BaseModel):
    """管理员新建用户。email 任意合法邮箱（不限域名）。"""
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    name: str
    title: str = ""
    role: Role = Role.member


class UserAdminUpdate(BaseModel):
    """管理员改用户资料 / 权限 / 密码 / 停用状态（password 留空则不改）。"""
    name: str | None = None
    email: EmailStr | None = None
    title: str | None = None
    role: Role | None = None
    password: str | None = Field(default=None, min_length=8, max_length=128)
    disabled: bool | None = None


class UserDeleteResult(BaseModel):
    """删除用户的结果：纯净账号物理删除，有历史记录的改为停用。"""
    action: str  # "deleted" | "disabled"
    detail: str
