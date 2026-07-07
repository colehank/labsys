"""评选 DTO —— 字段名对齐前端组件（含归一化 nXxx）。"""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator


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
    perfect_attendance: list[str] = []
    award_excellence: int = 1000
    award_attendance: int = 100
    note: str = ""            # 手动确认名单时的调整原因
    published: bool
    published_at: datetime | None = None

    model_config = {"populate_by_name": True}


class PresenterAtt(BaseModel):
    name: str
    topic: str = ""


class ReportOut(BaseModel):
    key: str
    y: int
    mo: int
    day: int
    dateLabel: str
    type: str
    template: str = "正式报告"  # 评分模板（前端据此渲染录入/评分表单）
    scored: bool = True          # 是否参与正式评分（False = 仅考勤等，评分入口跳过）
    presenters: list[str]
    attendance: dict   # name -> present|leave|absent
    speaks: dict = {}  # name -> 发言次数（管理员录入）
    ratings: dict = {}  # presenter -> {attitude, polish, raters}（成员匿名提交聚合）
    rated_by: list[str] = []  # 当前用户已评分的报告人姓名列表（服务端按 rater_id 过滤）


class RatingSubmit(BaseModel):
    presenter: str
    attitude: float = Field(ge=0, le=5)  # 评分区间 0~5，拒绝越界刷分
    polish: float = Field(ge=0, le=5)
    logic: float = Field(ge=0, le=5)     # 报告逻辑清晰程度
    top5: list[str] = Field(default=[], max_length=5)

    @field_validator("top5")
    @classmethod
    def deduplicate_top5(cls, v: list[str]) -> list[str]:
        return list(dict.fromkeys(n for n in v if n))


class AttendanceSet(BaseModel):
    name: str
    status: Literal["present", "leave", "absent"]


class SpeaksSet(BaseModel):
    name: str
    count: int         # 发言次数（管理员录入）


class EvalConfigIO(BaseModel):
    weights: dict
    filters: dict
    range: dict
    progress_order: list[str] | None = None
    period: str = ""
    award_excellence: int = 1000
    award_attendance: int = 100
    award_duty: int = 200


class PublishExcellence(BaseModel):
    count: int = 5
    names: list[str] | None = None  # 手动确认的名单（勾选/剔除/补选）；None = 按终极排名取前 count 名
    note: str = ""                  # 调整原因（手动增删名单时填写）


class VoteDetailOut(BaseModel):
    """管理员审核用：某场组会的单张评分选票明细。"""
    id: str
    rater: str          # 评分人姓名
    presenter: str
    attitude: float
    polish: float
    logic: float
    top5: list[str] = []
