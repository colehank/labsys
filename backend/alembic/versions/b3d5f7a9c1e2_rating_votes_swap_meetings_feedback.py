"""评分去重选票 + 对调组会引用 + 匿名反馈

Revision ID: b3d5f7a9c1e2
Revises: a1b2c3d4e5f6
Create Date: 2026-06-15 20:30:00.000000
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = 'b3d5f7a9c1e2'
down_revision: str | None = 'a1b2c3d4e5f6'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # —— 评分选票（每人对每位报告人只计一次）——
    op.create_table(
        'eval_rating_votes',
        sa.Column('id', sa.String(length=32), nullable=False),
        sa.Column('meeting_id', sa.String(length=32), nullable=False),
        sa.Column('rater_id', sa.String(length=32), nullable=False),
        sa.Column('presenter', sa.String(length=64), nullable=False),
        sa.Column('attitude', sa.Float(), nullable=False, server_default='0'),
        sa.Column('polish', sa.Float(), nullable=False, server_default='0'),
        sa.Column('top5', sa.JSON(), nullable=False),
        sa.ForeignKeyConstraint(['meeting_id'], ['meetings.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['rater_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('meeting_id', 'rater_id', 'presenter', name='uq_vote_once'),
    )
    op.create_index('ix_eval_rating_votes_meeting_id', 'eval_rating_votes', ['meeting_id'])
    op.create_index('ix_eval_rating_votes_rater_id', 'eval_rating_votes', ['rater_id'])
    op.create_index('ix_eval_rating_votes_presenter', 'eval_rating_votes', ['presenter'])

    # —— 对调请求引用的两场组会 ——
    with op.batch_alter_table('requests', schema=None) as batch_op:
        batch_op.add_column(sa.Column('from_meeting_id', sa.String(length=32), nullable=True))
        batch_op.add_column(sa.Column('to_meeting_id', sa.String(length=32), nullable=True))
        batch_op.create_foreign_key('fk_req_from_meeting', 'meetings', ['from_meeting_id'], ['id'], ondelete='SET NULL')
        batch_op.create_foreign_key('fk_req_to_meeting', 'meetings', ['to_meeting_id'], ['id'], ondelete='SET NULL')

    # —— 匿名反馈 ——
    op.create_table(
        'feedback',
        sa.Column('id', sa.String(length=32), nullable=False),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('read', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_feedback_created_at', 'feedback', ['created_at'])


def downgrade() -> None:
    op.drop_index('ix_feedback_created_at', table_name='feedback')
    op.drop_table('feedback')

    with op.batch_alter_table('requests', schema=None) as batch_op:
        batch_op.drop_constraint('fk_req_to_meeting', type_='foreignkey')
        batch_op.drop_constraint('fk_req_from_meeting', type_='foreignkey')
        batch_op.drop_column('to_meeting_id')
        batch_op.drop_column('from_meeting_id')

    op.drop_index('ix_eval_rating_votes_presenter', table_name='eval_rating_votes')
    op.drop_index('ix_eval_rating_votes_rater_id', table_name='eval_rating_votes')
    op.drop_index('ix_eval_rating_votes_meeting_id', table_name='eval_rating_votes')
    op.drop_table('eval_rating_votes')
