"""add unique constraints to eval tables and meetings.date

Revision ID: e3f4a5b6c7d8
Revises: d0e1f2a3b4c5
Create Date: 2026-06-17

"""
from __future__ import annotations

from alembic import op

revision: str = "e3f4a5b6c7d8"
down_revision: str = "d0e1f2a3b4c5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_unique_constraint(
        "uq_attendance_meeting_name", "eval_attendance", ["meeting_id", "name"]
    )
    op.create_unique_constraint(
        "uq_discussion_meeting_name", "eval_discussion", ["meeting_id", "name"]
    )
    op.create_unique_constraint(
        "uq_rating_meeting_presenter", "eval_ratings", ["meeting_id", "presenter"]
    )
    # e821e0ca1461 created ix_meetings_date as non-unique; drop it first to avoid
    # two B-tree indexes on meetings.date after the unique constraint is added.
    op.drop_index("ix_meetings_date", table_name="meetings")
    op.create_unique_constraint("uq_meeting_date", "meetings", ["date"])


def downgrade() -> None:
    op.drop_constraint("uq_meeting_date", "meetings", type_="unique")
    # Restore the original non-unique index so earlier revisions stay consistent.
    op.create_index("ix_meetings_date", "meetings", ["date"], unique=False)
    op.drop_constraint("uq_rating_meeting_presenter", "eval_ratings", type_="unique")
    op.drop_constraint("uq_discussion_meeting_name", "eval_discussion", type_="unique")
    op.drop_constraint("uq_attendance_meeting_name", "eval_attendance", type_="unique")
