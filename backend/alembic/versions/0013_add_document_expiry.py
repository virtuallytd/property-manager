"""add expires_at to property_documents

Revision ID: 0013
Revises: 0012
Create Date: 2026-03-25
"""
from alembic import op
import sqlalchemy as sa

revision = "0013"
down_revision = "0012"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("property_documents", sa.Column("expires_at", sa.DateTime(), nullable=True))


def downgrade():
    op.drop_column("property_documents", "expires_at")
