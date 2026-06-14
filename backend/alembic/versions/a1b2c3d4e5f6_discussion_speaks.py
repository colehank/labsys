"""eval_discussion.speaks —— 发言次数（管理员录入，独立于成员评价的讨论得分）

Revision ID: a1b2c3d4e5f6
Revises: f7a9c2d4e8b1
Create Date: 2026-06-15 14:00:00.000000
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = 'a1b2c3d4e5f6'
down_revision: str | None = 'f7a9c2d4e8b1'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table('eval_discussion', schema=None) as batch_op:
        batch_op.add_column(sa.Column('speaks', sa.Integer(), nullable=False, server_default='0'))


def downgrade() -> None:
    with op.batch_alter_table('eval_discussion', schema=None) as batch_op:
        batch_op.drop_column('speaks')
