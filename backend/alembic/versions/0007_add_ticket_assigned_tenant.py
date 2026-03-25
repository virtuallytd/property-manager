"""add assigned_to_tenant_id to tickets

Revision ID: 0007
Revises: 0006
Create Date: 2026-03-24
"""
from alembic import op
import sqlalchemy as sa

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("tickets", sa.Column("assigned_to_tenant_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_tickets_assigned_to_tenant_id",
        "tickets", "users",
        ["assigned_to_tenant_id"], ["id"],
    )


def downgrade():
    op.drop_constraint("fk_tickets_assigned_to_tenant_id", "tickets", type_="foreignkey")
    op.drop_column("tickets", "assigned_to_tenant_id")
