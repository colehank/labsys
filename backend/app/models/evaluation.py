"""评选数据持久化 —— 出勤/发言/评分/基线/配置/优秀名单，支持管理员录入与成员评分。

compute 引擎（app/domains/evals/engine.py）保持纯函数不变；DB 层组装 dict 后调用它。
"""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import JSON, DateTime, Float, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, UUIDMixin


# 组会唯一事实源是 meetings 表（app/models/lab.py）。评选不再单独建组会，
# 出勤/发言/评分通过 meeting_id 直接挂到对应 Meeting，数据录入与组会日历同源。


class Attendance(UUIDMixin, Base):
    __tablename__ = "eval_attendance"
    __table_args__ = (UniqueConstraint("meeting_id", "name", name="uq_attendance_meeting_name"),)
    meeting_id: Mapped[str] = mapped_column(ForeignKey("meetings.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(64), index=True)
    status: Mapped[str] = mapped_column(String(16))  # present | leave | absent


class Discussion(UUIDMixin, Base):
    __tablename__ = "eval_discussion"
    __table_args__ = (UniqueConstraint("meeting_id", "name", name="uq_discussion_meeting_name"),)
    meeting_id: Mapped[str] = mapped_column(ForeignKey("meetings.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(64), index=True)
    points: Mapped[int] = mapped_column(Integer, default=0)            # 讨论得分（成员匿名评价 Top5）
    speaks: Mapped[int] = mapped_column(Integer, default=0, server_default="0")  # 发言次数（管理员录入）


class Rating(UUIDMixin, Base):
    """报告人评分聚合（态度/精良/评分人数）—— 由 RatingVote 重算得出，只读快照。"""
    __tablename__ = "eval_ratings"
    __table_args__ = (UniqueConstraint("meeting_id", "presenter", name="uq_rating_meeting_presenter"),)
    meeting_id: Mapped[str] = mapped_column(ForeignKey("meetings.id", ondelete="CASCADE"), index=True)
    presenter: Mapped[str] = mapped_column(String(64), index=True)
    attitude: Mapped[float] = mapped_column(Float, default=0.0)
    polish: Mapped[float] = mapped_column(Float, default=0.0)
    logic: Mapped[float] = mapped_column(Float, default=0.0, server_default="0")  # 报告逻辑清晰程度
    raters: Mapped[int] = mapped_column(Integer, default=0)


class RatingVote(UUIDMixin, Base):
    """单张评分选票（成员匿名提交）。唯一约束 (meeting, rater, presenter) 保证每人对每位报告人
    只计一次 —— 重复提交即覆盖，杜绝刷分。讨论 Top5 也存于此，按 rater 去重后重算讨论得分。"""
    __tablename__ = "eval_rating_votes"
    __table_args__ = (UniqueConstraint("meeting_id", "rater_id", "presenter", name="uq_vote_once"),)
    meeting_id: Mapped[str] = mapped_column(ForeignKey("meetings.id", ondelete="CASCADE"), index=True)
    rater_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    presenter: Mapped[str] = mapped_column(String(64), index=True)
    attitude: Mapped[float] = mapped_column(Float, default=0.0)
    polish: Mapped[float] = mapped_column(Float, default=0.0)
    logic: Mapped[float] = mapped_column(Float, default=0.0, server_default="0")  # 报告逻辑清晰程度
    top5: Mapped[list] = mapped_column(JSON, default=list)  # 讨论 Top5 姓名（第 i 名 +(5-i) 分）


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
    period: Mapped[str] = mapped_column(String(64), default="", server_default="")


class Excellence(UUIDMixin, Base):
    """管理员发布的优秀名单快照。"""
    __tablename__ = "eval_excellence"
    __table_args__ = (UniqueConstraint("period", name="uq_excellence_period"),)
    period: Mapped[str] = mapped_column(String(64))
    from_: Mapped[str] = mapped_column("from_date", String(16))
    to: Mapped[str] = mapped_column("to_date", String(16))
    names: Mapped[list] = mapped_column(JSON, default=list)
    count: Mapped[int] = mapped_column(Integer, default=0)
    published_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
