"""add unique constraint on excellence.period

Revision ID: f5a6b7c8d9e0
Revises: e3f4a5b6c7d8
Create Date: 2026-06-17

"""
from alembic import op

revision: str = "f5a6b7c8d9e0"
down_revision: str = "e3f4a5b6c7d8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_unique_constraint("uq_excellence_period", "eval_excellence", ["period"])


def downgrade() -> None:
    op.drop_constraint("uq_excellence_period", "eval_excellence", type_="unique")
