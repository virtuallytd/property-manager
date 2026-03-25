"""add tickets and ticket_comments tables

Revision ID: 0005
Revises: 0004
Create Date: 2026-03-24
"""
from alembic import op
import sqlalchemy as sa

revision = "0005"
down_revision = "0004_add_tenancies_and_invites"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "tickets",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("property_id", sa.Integer(), nullable=False),
        sa.Column("created_by", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("ticket_type", sa.String(20), nullable=False, server_default="maintenance"),
        sa.Column("category", sa.String(20), nullable=True),
        sa.Column("status", sa.String(10), nullable=False, server_default="open"),
        sa.Column("proposed_date", sa.DateTime(), nullable=True),
        sa.Column("visit_response", sa.String(20), nullable=True),
        sa.Column("visit_suggested_date", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["property_id"], ["properties.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_tickets_id", "tickets", ["id"])

    op.create_table(
        "ticket_comments",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("ticket_id", sa.Integer(), nullable=False),
        sa.Column("author_id", sa.Integer(), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["author_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["ticket_id"], ["tickets.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ticket_comments_id", "ticket_comments", ["id"])


def downgrade():
    op.drop_index("ix_ticket_comments_id", table_name="ticket_comments")
    op.drop_table("ticket_comments")
    op.drop_index("ix_tickets_id", table_name="tickets")
    op.drop_table("tickets")
