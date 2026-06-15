"""请求 DTO —— 形状对齐前端 store.ts 的 request 对象。"""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from app.models import RequestKind


class RequestEventOut(BaseModel):
    status: str
    note: str
    at: datetime


class RequestOut(BaseModel):
    id: str
    kind: RequestKind
    from_: str = Field(serialization_alias="from")   # 发起人姓名
    toName: str = ""                                  # 对调对象姓名
    fromDate: str = ""
    toDate: str = ""
    topic: str = ""
    detail: str = ""
    reason: str = ""
    status: str
    incoming: bool = False                            # 相对当前用户：是否“收到的”对调
    createdAt: datetime
    history: list[RequestEventOut]

    model_config = {"populate_by_name": True}


class CreateRequest(BaseModel):
    kind: RequestKind
    fromDate: str = ""
    toName: str = ""
    toDate: str = ""
    topic: str = ""
    detail: str = ""
    reason: str = ""
    note: str = ""
    # 对调专用：发起人/对方各自所在组会的 id，接受后据此真正互换报告人。
    fromMeetingId: str | None = None
    toMeetingId: str | None = None


class AdvanceRequest(BaseModel):
    next: str
    note: str = ""
