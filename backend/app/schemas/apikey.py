"""API 密钥 DTO。"""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class ApiKeyOut(BaseModel):
    id: str
    label: str
    masked_key: str
    budget: float
    status: str
    created_at: datetime
    # dmxapi 实时用量（未配置凭据时为 None，前端降级展示）
    used_rmb: float | None = None
    remain_rmb: float | None = None


class ApiKeyIssue(BaseModel):
    user_name: str
    label: str = ""
    upstream_key: str
    budget: float = 0.0
