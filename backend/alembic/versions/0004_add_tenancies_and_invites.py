"""Add tenancies and property_invites tables

Revision ID: 0004_add_tenancies_and_invites
Revises: 0003_add_properties
Create Date: 2026-03-24 00:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '0004_add_tenancies_and_invites'
down_revision: Union[str, None] = '0003_add_properties'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'tenancies',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('property_id', sa.Integer(), nullable=False),
        sa.Column('tenant_id', sa.Integer(), nullable=False),
        sa.Column('start_date', sa.Date(), nullable=True),
        sa.Column('end_date', sa.Date(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['property_id'], ['properties.id'], name='fk_tenancies_property_id'),
        sa.ForeignKeyConstraint(['tenant_id'], ['users.id'], name='fk_tenancies_tenant_id'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_tenancies_id'), 'tenancies', ['id'], unique=False)
    op.create_index('ix_tenancies_property_id', 'tenancies', ['property_id'], unique=False)
    op.create_index('ix_tenancies_tenant_id', 'tenancies', ['tenant_id'], unique=False)

    op.create_table(
        'property_invites',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('token', sa.String(64), nullable=False),
        sa.Column('property_id', sa.Integer(), nullable=False),
        sa.Column('created_by', sa.Integer(), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('used_at', sa.DateTime(), nullable=True),
        sa.Column('used_by_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], name='fk_invites_created_by'),
        sa.ForeignKeyConstraint(['property_id'], ['properties.id'], name='fk_invites_property_id'),
        sa.ForeignKeyConstraint(['used_by_id'], ['users.id'], name='fk_invites_used_by_id'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_property_invites_id'), 'property_invites', ['id'], unique=False)
    op.create_index(op.f('ix_property_invites_token'), 'property_invites', ['token'], unique=True)
    op.create_index('ix_property_invites_property_id', 'property_invites', ['property_id'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_property_invites_property_id', table_name='property_invites')
    op.drop_index(op.f('ix_property_invites_token'), table_name='property_invites')
    op.drop_index(op.f('ix_property_invites_id'), table_name='property_invites')
    op.drop_table('property_invites')
    op.drop_index('ix_tenancies_tenant_id', table_name='tenancies')
    op.drop_index('ix_tenancies_property_id', table_name='tenancies')
    op.drop_index(op.f('ix_tenancies_id'), table_name='tenancies')
    op.drop_table('tenancies')
