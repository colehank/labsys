"""meeting template/scored + excellence note

Revision ID: d1e2f3a4b5c6
Revises: c2d3e4f5a6b7
Create Date: 2026-07-03

给组会加评分模板/是否参与评分（反馈 #8），给优秀名单加手动确认原因（反馈 #7）。
"""
from alembic import op
import sqlalchemy as sa

revision: str = "d1e2f3a4b5c6"
down_revision: str = "c2d3e4f5a6b7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("meetings", sa.Column("template", sa.String(32), nullable=False, server_default="正式报告"))
    op.add_column("meetings", sa.Column("scored", sa.Boolean(), nullable=False, server_default=sa.text("true")))
    op.add_column("eval_excellence", sa.Column("note", sa.String(255), nullable=False, server_default=""))


def downgrade() -> None:
    op.drop_column("eval_excellence", "note")
    op.drop_column("meetings", "scored")
    op.drop_column("meetings", "template")
