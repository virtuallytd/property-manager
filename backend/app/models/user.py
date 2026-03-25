from datetime import datetime
from enum import Enum

from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text
from sqlalchemy.orm import relationship

from app.models.base import Base


class UserRole(str, Enum):
    ADMIN = "admin"
    LANDLORD = "landlord"
    TENANT = "tenant"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(254), unique=True, nullable=False, index=True)
    username = Column(String(100), unique=True, nullable=False, index=True)
    hashed_password = Column(String(200), nullable=False)
    role = Column(String(20), default=UserRole.LANDLORD, nullable=False)
    is_approved = Column(Boolean, default=False, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    avatar_path = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    properties = relationship("Property", back_populates="landlord")
    tenancies = relationship("Tenancy", back_populates="tenant")
    managed_tenants = relationship("LandlordTenant", foreign_keys="LandlordTenant.landlord_id", back_populates="landlord")
    landlord_links = relationship("LandlordTenant", foreign_keys="LandlordTenant.tenant_id", back_populates="tenant")
    created_tickets = relationship("Ticket", foreign_keys="Ticket.created_by", back_populates="creator")
    ticket_comments = relationship("TicketComment", foreign_keys="TicketComment.author_id", back_populates="author")


