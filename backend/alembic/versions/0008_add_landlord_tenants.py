"""add landlord_tenants table

Revision ID: 0008
Revises: 0007
Create Date: 2026-03-25
"""
from alembic import op
import sqlalchemy as sa

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "landlord_tenants",
        sa.Column("landlord_id", sa.Integer(), nullable=False),
        sa.Column("tenant_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["landlord_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["tenant_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("landlord_id", "tenant_id"),
    )


def downgrade():
    op.drop_table("landlord_tenants")
