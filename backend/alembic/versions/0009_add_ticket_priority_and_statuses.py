"""add ticket priority and extended statuses

Revision ID: 0009
Revises: 0008
Create Date: 2026-03-25
"""
from alembic import op
import sqlalchemy as sa

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade():
    # Add new values to the ticketstatus enum.
    # ALTER TYPE ... ADD VALUE cannot run inside a transaction in PostgreSQL,
    # so we commit the open transaction first.
    connection = op.get_bind()
    connection.execute(sa.text("COMMIT"))
    connection.execute(sa.text("ALTER TYPE ticketstatus ADD VALUE IF NOT EXISTS 'in_progress'"))
    connection.execute(sa.text("ALTER TYPE ticketstatus ADD VALUE IF NOT EXISTS 'awaiting_tenant'"))
    connection.execute(sa.text("ALTER TYPE ticketstatus ADD VALUE IF NOT EXISTS 'resolved'"))

    # Create the priority enum type and add the column
    connection.execute(sa.text(
        "CREATE TYPE ticketpriority AS ENUM ('low', 'medium', 'high', 'urgent')"
    ))
    op.add_column(
        "tickets",
        sa.Column(
            "priority",
            sa.Enum("low", "medium", "high", "urgent", name="ticketpriority"),
            nullable=False,
            server_default="medium",
        ),
    )


def downgrade():
    op.drop_column("tickets", "priority")
    op.execute("DROP TYPE IF EXISTS ticketpriority")
    # Note: PostgreSQL does not support removing values from an enum type,
    # so the added ticketstatus values (in_progress, awaiting_tenant, resolved)
    # cannot be cleanly removed here.
