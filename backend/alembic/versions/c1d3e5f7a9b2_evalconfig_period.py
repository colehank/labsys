"""eval_config.period（评选期名称，如"2026 春季 · 第二评选期"）

Revision ID: c1d3e5f7a9b2
Revises: b4e6c8d2f0a1
Create Date: 2026-06-16 18:00:00.000000
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = 'c1d3e5f7a9b2'
down_revision: str | None = 'b4e6c8d2f0a1'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table('eval_config', schema=None) as batch_op:
        batch_op.add_column(sa.Column('period', sa.String(length=64), nullable=False, server_default=''))


def downgrade() -> None:
    with op.batch_alter_table('eval_config', schema=None) as batch_op:
        batch_op.drop_column('period')
