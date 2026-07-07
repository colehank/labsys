"""eval_config.award_duty —— 职务津贴标准额度

Revision ID: b8c9d0e1f2a3
Revises: a7b8c9d0e1f2
Create Date: 2026-07-07

"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision: str = "b8c9d0e1f2a3"
down_revision: str = "a7b8c9d0e1f2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "eval_config",
        sa.Column("award_duty", sa.Integer(), nullable=False, server_default="200"),
    )


def downgrade() -> None:
    op.drop_column("eval_config", "award_duty")
