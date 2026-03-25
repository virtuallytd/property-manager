from sqlalchemy import Column, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from app.models.base import Base


class AppSetting(Base):
    """Simple key/value store for application-wide and per-user settings."""
    __tablename__ = "app_settings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    key = Column(String(100), nullable=False)
    value = Column(Text, nullable=False)
    # nullable user_id = global/admin setting; non-null = per-user setting
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)


DEFAULTS = {
    "timezone": "UTC",
    "registration_enabled": "true",
    "allowed_attachment_types": "image/*,application/pdf",
}
