"""ssh_credentials —— 用户级 SSH 账密（与服务器解耦），替换 server_credentials

Revision ID: d1aa0c5e7b22
Revises: c0ffee5a17ed
Create Date: 2026-06-14 17:30:00.000000
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = 'd1aa0c5e7b22'
down_revision: str | None = 'c0ffee5a17ed'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 旧表与服务器绑定，弃用（无真实数据）
    op.drop_table('server_credentials')
    op.create_table(
        'ssh_credentials',
        sa.Column('user_id', sa.String(length=32), nullable=False),
        sa.Column('username', sa.String(length=64), nullable=False),
        sa.Column('password_enc', sa.Text(), nullable=False),
        sa.Column('id', sa.String(length=32), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'username', name='uq_sshcred_user_name'),
    )
    with op.batch_alter_table('ssh_credentials', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_ssh_credentials_user_id'), ['user_id'], unique=False)


def downgrade() -> None:
    with op.batch_alter_table('ssh_credentials', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_ssh_credentials_user_id'))
    op.drop_table('ssh_credentials')
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
