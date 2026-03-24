"""Add properties table

Revision ID: 0003_add_properties
Revises: 0002_update_roles
Create Date: 2026-03-24 00:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '0003_add_properties'
down_revision: Union[str, None] = '0002_update_roles'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'properties',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('landlord_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('property_type', sa.String(20), nullable=False, server_default='flat'),
        sa.Column('address_line1', sa.String(200), nullable=False),
        sa.Column('address_line2', sa.String(200), nullable=True),
        sa.Column('city', sa.String(100), nullable=False),
        sa.Column('postcode', sa.String(20), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['landlord_id'], ['users.id'], name='fk_properties_landlord_id'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_properties_id'), 'properties', ['id'], unique=False)
    op.create_index('ix_properties_landlord_id', 'properties', ['landlord_id'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_properties_landlord_id', table_name='properties')
    op.drop_index(op.f('ix_properties_id'), table_name='properties')
    op.drop_table('properties')
