"""Add avatar_path to users

Revision ID: 0002_add_user_avatar
Revises: 0001_add_auth_system
Create Date: 2026-03-24 00:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '0002_add_user_avatar'
down_revision: Union[str, None] = '0001_add_auth_system'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('avatar_path', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'avatar_path')
