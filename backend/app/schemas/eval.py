"""评选 DTO —— 字段名对齐前端组件（含归一化 nXxx）。"""
from __future__ import annotations

from pydantic import BaseModel, Field


class EvalRowOut(BaseModel):
    name: str
    attitude: float
    polish: float
    attRate: int
    discuss: int
    meeting: float
    meetingRank: int
    nAttitude: float
    nPolish: float
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


class RatingSubmit(BaseModel):
    presenter: str
    attitude: float
    polish: float
    top5: list[str] = []


class AttendanceSet(BaseModel):
    name: str
    status: str        # present | leave | absent


class EvalConfigIO(BaseModel):
    weights: dict
    filters: dict
    range: dict
    progress_order: list[str] | None = None


class PublishExcellence(BaseModel):
    count: int = 5
