"""请求 DTO —— 形状对齐前端 store.ts 的 request 对象。"""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator

from app.models import RequestKind


class RequestEventOut(BaseModel):
    status: str
    note: str = ""
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
    fromDate: str = Field(default="", max_length=32)
    toName: str = Field(default="", max_length=64)
    toDate: str = Field(default="", max_length=32)
    topic: str = Field(default="", max_length=256)
    detail: str = Field(default="", max_length=256)
    reason: str = Field(default="", max_length=4096)
    note: str = Field(default="", max_length=512)
    # 对调专用：发起人/对方各自所在组会的 id，接受后据此真正互换报告人。
    fromMeetingId: str | None = None
    toMeetingId: str | None = None

    @model_validator(mode="after")
    def swap_requires_fields(self):
        if self.kind == "swap":
            if not self.toName:
                raise ValueError("对调申请必须指定对方姓名")
            if not self.fromMeetingId or not self.toMeetingId:
                raise ValueError("对调申请必须指定双方组会")
        return self


class AdvanceRequest(BaseModel):
    next: Literal["accepted", "declined", "cancelled", "approved", "rejected"]
    note: str = Field(default="", max_length=512)
