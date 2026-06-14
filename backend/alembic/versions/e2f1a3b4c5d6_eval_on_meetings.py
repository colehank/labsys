"""eval 评估数据挂到 meetings 表（组会唯一事实源）

删除独立的 eval_reports 表；eval_attendance/discussion/ratings 的 report_id
改为 meeting_id（FK → meetings.id）。评估数据由 seed 重建，故旧行直接清空。

Revision ID: e2f1a3b4c5d6
Revises: d1aa0c5e7b22
Create Date: 2026-06-14
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "e2f1a3b4c5d6"
down_revision = "d1aa0c5e7b22"
branch_labels = None
depends_on = None

_TABLES = ("eval_attendance", "eval_discussion", "eval_ratings")


def upgrade() -> None:
    # 评估数据将由 seed 重新生成（挂到 meetings），旧行先清空避免 NOT NULL 冲突
    for t in _TABLES:
        op.execute(f"DELETE FROM {t}")
        op.drop_column(t, "report_id")  # 随列删除其 index 与 FK 约束（解除对 eval_reports 的依赖）
    op.drop_table("eval_reports")
    for t in _TABLES:
        op.add_column(t, sa.Column("meeting_id", sa.String(length=32), nullable=False))
        op.create_index(op.f(f"ix_{t}_meeting_id"), t, ["meeting_id"])
        op.create_foreign_key(
            f"fk_{t}_meeting", t, "meetings", ["meeting_id"], ["id"], ondelete="CASCADE"
        )


def downgrade() -> None:
    op.create_table(
        "eval_reports",
        sa.Column("id", sa.String(length=32), nullable=False),
        sa.Column("key", sa.String(length=32), nullable=False),
        sa.Column("mo", sa.Integer(), nullable=False),
        sa.Column("day", sa.Integer(), nullable=False),
        sa.Column("type", sa.String(length=16), nullable=False),
        sa.Column("presenters", sa.JSON(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_eval_reports_key"), "eval_reports", ["key"], unique=True)
    for t in _TABLES:
        op.execute(f"DELETE FROM {t}")
        op.drop_constraint(f"fk_{t}_meeting", t, type_="foreignkey")
        op.drop_index(op.f(f"ix_{t}_meeting_id"), table_name=t)
        op.drop_column(t, "meeting_id")
        op.add_column(t, sa.Column("report_id", sa.String(length=32), nullable=False))
        op.create_index(op.f(f"ix_{t}_report_id"), t, ["report_id"])
        op.create_foreign_key(
            f"fk_{t}_report", t, "eval_reports", ["report_id"], ["id"], ondelete="CASCADE"
        )
