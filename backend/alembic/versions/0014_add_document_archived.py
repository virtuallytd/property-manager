"""add is_archived to property_documents

Revision ID: 0014
Revises: 0013
Create Date: 2026-03-25
"""
from alembic import op
import sqlalchemy as sa

revision = "0014"
down_revision = "0013"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("property_documents", sa.Column("is_archived", sa.Boolean(), nullable=False, server_default="false"))


def downgrade():
    op.drop_column("property_documents", "is_archived")
