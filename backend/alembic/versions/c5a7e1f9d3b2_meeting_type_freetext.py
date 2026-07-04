"""meetings.type 由枚举改为自由文本 —— 管理员可自定义组会类型（团建/工作坊等）

Revision ID: c5a7e1f9d3b2
Revises: b4e6c8d2f0a1
Create Date: 2026-06-16 14:00:00.000000
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = 'c5a7e1f9d3b2'
down_revision: str | None = 'b4e6c8d2f0a1'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_ENUM = postgresql.ENUM('进展汇报', '文献精读', name='meeting_type')


def upgrade() -> None:
    op.alter_column(
        'meetings', 'type',
        existing_type=_ENUM,
        type_=sa.String(length=32),
        existing_nullable=False,
        postgresql_using='type::text',
    )
    op.execute('DROP TYPE meeting_type')


def downgrade() -> None:
    # 自定义类型在回退时会被截断/报错——仅在数据只含两种预设值时可逆
    _ENUM.create(op.get_bind(), checkfirst=True)
    op.alter_column(
        'meetings', 'type',
        existing_type=sa.String(length=32),
        type_=_ENUM,
        existing_nullable=False,
        postgresql_using='type::meeting_type',
    )
