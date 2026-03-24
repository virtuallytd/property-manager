from datetime import datetime
from enum import Enum

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.models.base import Base


class PropertyType(str, Enum):
    FLAT = "flat"
    HOUSE = "house"
    HMO = "hmo"


class Property(Base):
    __tablename__ = "properties"

    id = Column(Integer, primary_key=True, index=True)
    landlord_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String(200), nullable=False)
    property_type = Column(String(20), nullable=False, default=PropertyType.FLAT)
    address_line1 = Column(String(200), nullable=False)
    address_line2 = Column(String(200), nullable=True)
    city = Column(String(100), nullable=False)
    postcode = Column(String(20), nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    landlord = relationship("User", back_populates="properties")
    tenancies = relationship("Tenancy", back_populates="property", cascade="all, delete-orphan")
    invites = relationship("PropertyInvite", back_populates="property", cascade="all, delete-orphan")
