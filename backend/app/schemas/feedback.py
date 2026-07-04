"""匿名意见 DTO。"""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class FeedbackCreate(BaseModel):
    body: str = Field(min_length=1, max_length=500)


class FeedbackOut(BaseModel):
    id: str
    body: str
    created_at: datetime
    read: bool
