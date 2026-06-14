"""users.disabled —— 软删除（停用账号）：有历史记录的用户改为停用而非物理删除

Revision ID: f7a9c2d4e8b1
Revises: e2f1a3b4c5d6
Create Date: 2026-06-15 12:00:00.000000
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = 'f7a9c2d4e8b1'
down_revision: str | None = 'e2f1a3b4c5d6'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column('disabled', sa.Boolean(), nullable=False, server_default=sa.false())
        )
        batch_op.create_index(batch_op.f('ix_users_disabled'), ['disabled'], unique=False)


def downgrade() -> None:
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_users_disabled'))
        batch_op.drop_column('disabled')
