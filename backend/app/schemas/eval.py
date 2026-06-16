"""评选 DTO —— 字段名对齐前端组件（含归一化 nXxx）。"""
from __future__ import annotations

from pydantic import BaseModel, Field


class EvalRowOut(BaseModel):
    name: str
    attitude: float
    polish: float
    logic: float
    attRate: int
    discuss: int
    meeting: float
    meetingRank: int
    nAttitude: float
    nPolish: float
    nLogic: float
    nAtt: float
    nDisc: float


class MergedOut(BaseModel):
    name: str
    mRank: int
    pRank: int
    score: float
    finalRank: int


class EvalComputeOut(BaseModel):
    total: int
    weights: dict
    rows: list[EvalRowOut]
    merged: list[MergedOut]


class RankSeriesOut(BaseModel):
    points: list[dict]
    ranks: list[int]
    total: int


class ExcellenceOut(BaseModel):
    period: str
    from_: str = Field(serialization_alias="from")
    to: str
    names: list[str]
    count: int
    published: bool

    model_config = {"populate_by_name": True}


class PresenterAtt(BaseModel):
    name: str
    topic: str = ""


class ReportOut(BaseModel):
    key: str
    mo: int
    day: int
    dateLabel: str
    type: str
    presenters: list[str]
    attendance: dict   # name -> present|leave|absent
    speaks: dict = {}  # name -> 发言次数（管理员录入）
    ratings: dict = {}  # presenter -> {attitude, polish, raters}（成员匿名提交聚合）


class RatingSubmit(BaseModel):
    presenter: str
    attitude: float = Field(ge=0, le=5)  # 评分区间 0~5，拒绝越界刷分
    polish: float = Field(ge=0, le=5)
    logic: float = Field(ge=0, le=5)     # 报告逻辑清晰程度
    top5: list[str] = Field(default=[], max_length=5)


class AttendanceSet(BaseModel):
    name: str
    status: str        # present | leave | absent


class SpeaksSet(BaseModel):
    name: str
    count: int         # 发言次数（管理员录入）


class EvalConfigIO(BaseModel):
    weights: dict
    filters: dict
    range: dict
    progress_order: list[str] | None = None


class PublishExcellence(BaseModel):
    count: int = 5
