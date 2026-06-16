"""meetings.host（主持人） + eval_ratings/eval_rating_votes.logic（报告逻辑清晰度）

对齐线下真实组会数据：排期含主持人，成员评分含「逻辑清晰程度」维度（问卷星第 3 题）。

Revision ID: b4e6c8d2f0a1
Revises: b3d5f7a9c1e2
Create Date: 2026-06-16 13:00:00.000000
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = 'b4e6c8d2f0a1'
down_revision: str | None = 'b3d5f7a9c1e2'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table('meetings', schema=None) as batch_op:
        batch_op.add_column(sa.Column('host', sa.String(length=64), nullable=False, server_default=''))
    with op.batch_alter_table('eval_ratings', schema=None) as batch_op:
        batch_op.add_column(sa.Column('logic', sa.Float(), nullable=False, server_default='0'))
    with op.batch_alter_table('eval_rating_votes', schema=None) as batch_op:
        batch_op.add_column(sa.Column('logic', sa.Float(), nullable=False, server_default='0'))
    # 主题改 Text：真实排期里报告主题是完整文献引用（含 DOI），远超 256 字符
    with op.batch_alter_table('presenters', schema=None) as batch_op:
        batch_op.alter_column('topic', existing_type=sa.String(length=256), type_=sa.Text())


def downgrade() -> None:
    with op.batch_alter_table('presenters', schema=None) as batch_op:
        batch_op.alter_column('topic', existing_type=sa.Text(), type_=sa.String(length=256))
    with op.batch_alter_table('eval_rating_votes', schema=None) as batch_op:
        batch_op.drop_column('logic')
    with op.batch_alter_table('eval_ratings', schema=None) as batch_op:
        batch_op.drop_column('logic')
    with op.batch_alter_table('meetings', schema=None) as batch_op:
        batch_op.drop_column('host')
