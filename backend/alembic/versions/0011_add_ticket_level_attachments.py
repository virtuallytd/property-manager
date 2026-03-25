"""allow ticket-level attachments (nullable comment_id, add ticket_id FK)

Revision ID: 0011
Revises: 0010
Create Date: 2026-03-25
"""
from alembic import op
import sqlalchemy as sa

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None


def upgrade():
    # Make comment_id nullable
    op.alter_column("ticket_attachments", "comment_id", nullable=True)
    # Add ticket_id FK for ticket-level attachments
    op.add_column("ticket_attachments", sa.Column("ticket_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_ticket_attachments_ticket_id",
        "ticket_attachments", "tickets",
        ["ticket_id"], ["id"],
        ondelete="CASCADE",
    )


def downgrade():
    op.drop_constraint("fk_ticket_attachments_ticket_id", "ticket_attachments", type_="foreignkey")
    op.drop_column("ticket_attachments", "ticket_id")
    op.alter_column("ticket_attachments", "comment_id", nullable=False)
