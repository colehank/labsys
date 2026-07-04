"""merge meeting_type_freetext and evalconfig_period

Revision ID: d0e1f2a3b4c5
Revises: c5a7e1f9d3b2, c1d3e5f7a9b2
Create Date: 2026-06-17

"""
from __future__ import annotations

from alembic import op  # noqa: F401

# revision identifiers, used by Alembic.
revision: str = "d0e1f2a3b4c5"
down_revision: tuple[str, str] = ("c5a7e1f9d3b2", "c1d3e5f7a9b2")
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
