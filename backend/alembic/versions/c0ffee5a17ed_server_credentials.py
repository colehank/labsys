"""server_credentials —— 用户保存的 SSH 凭据（密码加密）

Revision ID: c0ffee5a17ed
Revises: f1e5034cd80c
Create Date: 2026-06-14 16:00:00.000000
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = 'c0ffee5a17ed'
down_revision: str | None = 'f1e5034cd80c'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        'server_credentials',
        sa.Column('user_id', sa.String(length=32), nullable=False),
        sa.Column('server_id', sa.String(length=32), nullable=False),
        sa.Column('username', sa.String(length=64), nullable=False),
        sa.Column('password_enc', sa.Text(), nullable=False),
        sa.Column('id', sa.String(length=32), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['server_id'], ['servers.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'server_id', name='uq_cred_user_server'),
    )
    with op.batch_alter_table('server_credentials', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_server_credentials_user_id'), ['user_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_server_credentials_server_id'), ['server_id'], unique=False)


def downgrade() -> None:
    with op.batch_alter_table('server_credentials', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_server_credentials_server_id'))
        batch_op.drop_index(batch_op.f('ix_server_credentials_user_id'))
    op.drop_table('server_credentials')
