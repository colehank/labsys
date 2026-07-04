"""add award bonus fields to eval_config and eval_excellence

Revision ID: c2d3e4f5a6b7
Revises: b5c6d7e8f9a0
Create Date: 2026-06-17

"""
from alembic import op
import sqlalchemy as sa

revision: str = "c2d3e4f5a6b7"
down_revision: str = "b5c6d7e8f9a0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("eval_config", sa.Column("award_excellence", sa.Integer(), nullable=False, server_default="1000"))
    op.add_column("eval_config", sa.Column("award_attendance", sa.Integer(), nullable=False, server_default="100"))
    op.add_column("eval_excellence", sa.Column("perfect_attendance", sa.JSON(), nullable=False, server_default="[]"))
    op.add_column("eval_excellence", sa.Column("award_excellence", sa.Integer(), nullable=False, server_default="1000"))
    op.add_column("eval_excellence", sa.Column("award_attendance", sa.Integer(), nullable=False, server_default="100"))


def downgrade() -> None:
    op.drop_column("eval_config", "award_excellence")
    op.drop_column("eval_config", "award_attendance")
    op.drop_column("eval_excellence", "perfect_attendance")
    op.drop_column("eval_excellence", "award_excellence")
    op.drop_column("eval_excellence", "award_attendance")
