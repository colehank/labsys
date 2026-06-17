"""add unique constraint on users.name

Revision ID: b5c6d7e8f9a0
Revises: f5a6b7c8d9e0
Create Date: 2026-06-17

"""
from alembic import op

revision: str = "b5c6d7e8f9a0"
down_revision: str = "f5a6b7c8d9e0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # init migration created ix_users_name as non-unique; drop it first to avoid
    # two B-tree indexes on the same column after we add the unique constraint.
    op.drop_index("ix_users_name", table_name="users")
    op.create_unique_constraint("uq_user_name", "users", ["name"])


def downgrade() -> None:
    op.drop_constraint("uq_user_name", "users", type_="unique")
    # Restore the original non-unique index so earlier revisions stay consistent.
    op.create_index("ix_users_name", "users", ["name"], unique=False)
