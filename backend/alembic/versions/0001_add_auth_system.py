"""Add authentication system: users, platform_credentials, user_id FK columns

Revision ID: 0001_add_auth_system
Revises: 2aaa3e7487a9
Create Date: 2026-03-24 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '0001_add_auth_system'
down_revision: Union[str, None] = '2aaa3e7487a9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create users table
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('email', sa.String(254), nullable=False),
        sa.Column('username', sa.String(100), nullable=False),
        sa.Column('hashed_password', sa.String(200), nullable=False),
        sa.Column('role', sa.String(20), nullable=False, server_default='user'),
        sa.Column('is_approved', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_users_id'), 'users', ['id'], unique=False)
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)
    op.create_index(op.f('ix_users_username'), 'users', ['username'], unique=True)

    # 2. Create platform_credentials table
    op.create_table(
        'platform_credentials',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('platform_id', sa.Integer(), nullable=False),
        sa.Column('consumer_key_encrypted', sa.Text(), nullable=False),
        sa.Column('consumer_secret_encrypted', sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(['platform_id'], ['platforms.id']),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'platform_id', name='uq_user_platform_credential'),
    )
    op.create_index(op.f('ix_platform_credentials_id'), 'platform_credentials', ['id'], unique=False)

    # 3. Truncate tables that need user_id (resets all existing data)
    #    CASCADE handles FK-dependent rows automatically.
    op.execute("TRUNCATE TABLE post_targets, post_tweets, posts, accounts, oauth_states CASCADE")
    op.execute("TRUNCATE TABLE app_settings CASCADE")

    # 4a. Add user_id to accounts (table is empty, so we can set NOT NULL immediately)
    op.add_column('accounts', sa.Column('user_id', sa.Integer(), nullable=False))
    op.create_foreign_key('fk_accounts_user_id', 'accounts', 'users', ['user_id'], ['id'])

    # 4b. Add user_id to posts (table is empty)
    op.add_column('posts', sa.Column('user_id', sa.Integer(), nullable=False))
    op.create_foreign_key('fk_posts_user_id', 'posts', 'users', ['user_id'], ['id'])

    # 4c. Rework app_settings: the old schema had `key` as primary key (String).
    #     We drop and recreate with id (Integer PK) + user_id.
    op.drop_table('app_settings')
    op.create_table(
        'app_settings',
        sa.Column('id', sa.Integer(), nullable=False, autoincrement=True),
        sa.Column('key', sa.String(100), nullable=False),
        sa.Column('value', sa.Text(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], name='fk_app_settings_user_id'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_app_settings_user_id', 'app_settings', ['user_id'], unique=False)

    # 4d. Add user_id to oauth_states
    op.add_column('oauth_states', sa.Column('user_id', sa.Integer(), nullable=True))
    op.create_foreign_key('fk_oauth_states_user_id', 'oauth_states', 'users', ['user_id'], ['id'])


def downgrade() -> None:
    # Reverse oauth_states changes
    op.drop_constraint('fk_oauth_states_user_id', 'oauth_states', type_='foreignkey')
    op.drop_column('oauth_states', 'user_id')

    # Recreate old app_settings with key as PK
    op.drop_table('app_settings')
    op.create_table(
        'app_settings',
        sa.Column('key', sa.String(100), nullable=False),
        sa.Column('value', sa.Text(), nullable=False),
        sa.PrimaryKeyConstraint('key'),
    )

    # Reverse posts changes
    op.drop_constraint('fk_posts_user_id', 'posts', type_='foreignkey')
    op.drop_column('posts', 'user_id')

    # Reverse accounts changes
    op.drop_constraint('fk_accounts_user_id', 'accounts', type_='foreignkey')
    op.drop_column('accounts', 'user_id')

    # Drop platform_credentials
    op.drop_index(op.f('ix_platform_credentials_id'), table_name='platform_credentials')
    op.drop_table('platform_credentials')

    # Drop users
    op.drop_index(op.f('ix_users_username'), table_name='users')
    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_index(op.f('ix_users_id'), table_name='users')
    op.drop_table('users')
