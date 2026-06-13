"""评选数据持久化 —— 出勤/发言/评分/基线/配置/优秀名单，支持管理员录入与成员评分。

compute 引擎（app/domains/evals/engine.py）保持纯函数不变；DB 层组装 dict 后调用它。
"""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import JSON, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, UUIDMixin


class EvalReport(UUIDMixin, Base):
    """评选期内的一次历史组会（供管理员录入出勤/发言、成员评分）。"""
    __tablename__ = "eval_reports"

    key: Mapped[str] = mapped_column(String(32), unique=True, index=True)  # r-4-19
    mo: Mapped[int] = mapped_column(Integer)   # 0-based
    day: Mapped[int] = mapped_column(Integer)
    type: Mapped[str] = mapped_column(String(16))
    presenters: Mapped[list] = mapped_column(JSON, default=list)  # 报告人姓名列表


class Attendance(UUIDMixin, Base):
    __tablename__ = "eval_attendance"
    report_id: Mapped[str] = mapped_column(ForeignKey("eval_reports.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(64), index=True)
    status: Mapped[str] = mapped_column(String(16))  # present | leave | absent


class Discussion(UUIDMixin, Base):
    __tablename__ = "eval_discussion"
    report_id: Mapped[str] = mapped_column(ForeignKey("eval_reports.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(64), index=True)
    points: Mapped[int] = mapped_column(Integer, default=0)


class Rating(UUIDMixin, Base):
    __tablename__ = "eval_ratings"
    report_id: Mapped[str] = mapped_column(ForeignKey("eval_reports.id", ondelete="CASCADE"), index=True)
    presenter: Mapped[str] = mapped_column(String(64), index=True)
    attitude: Mapped[float] = mapped_column(Float, default=0.0)
    polish: Mapped[float] = mapped_column(Float, default=0.0)
    raters: Mapped[int] = mapped_column(Integer, default=0)


class PeerBaseline(UUIDMixin, Base):
    __tablename__ = "eval_peer_baseline"
    name: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    attitude: Mapped[float] = mapped_column(Float, default=0.0)
    polish: Mapped[float] = mapped_column(Float, default=0.0)


class EvalConfig(UUIDMixin, Base):
    """评选权重 / 阈值 / 区间（管理员可调）。单行。"""
    __tablename__ = "eval_config"
    weights: Mapped[dict] = mapped_column(JSON, default=dict)
    filters: Mapped[dict] = mapped_column(JSON, default=dict)
    range_: Mapped[dict] = mapped_column("range", JSON, default=dict)
    progress_order: Mapped[list | None] = mapped_column(JSON, nullable=True)


class Excellence(UUIDMixin, Base):
    """管理员发布的优秀名单快照。"""
    __tablename__ = "eval_excellence"
    period: Mapped[str] = mapped_column(String(64))
    from_: Mapped[str] = mapped_column("from_date", String(16))
    to: Mapped[str] = mapped_column("to_date", String(16))
    names: Mapped[list] = mapped_column(JSON, default=list)
    count: Mapped[int] = mapped_column(Integer, default=0)
    published_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
