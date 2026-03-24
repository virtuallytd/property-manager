"""Update user roles: rename 'user' to 'landlord', add 'tenant'

Revision ID: 0002_update_roles
Revises: 0001_initial
Create Date: 2026-03-24 00:00:00.000000
"""
from typing import Sequence, Union
from alembic import op

revision: str = '0002_update_roles'
down_revision: Union[str, None] = '0001_initial'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("UPDATE users SET role = 'landlord' WHERE role = 'user'")
    op.execute("ALTER TABLE users ALTER COLUMN role SET DEFAULT 'landlord'")


def downgrade() -> None:
    op.execute("UPDATE users SET role = 'user' WHERE role = 'landlord'")
    op.execute("ALTER TABLE users ALTER COLUMN role SET DEFAULT 'user'")
