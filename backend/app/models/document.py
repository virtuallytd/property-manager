from datetime import datetime
from enum import Enum
from sqlalchemy import Boolean, Column, DateTime, Enum as SAEnum, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from app.models.base import Base


class DocumentType(str, Enum):
    GAS_SAFETY = "gas_safety"
    EPC = "epc"
    ELECTRICAL = "electrical"
    FIRE_RISK = "fire_risk"
    INSURANCE = "insurance"
    OTHER = "other"


class PropertyDocument(Base):
    __tablename__ = "property_documents"
    id = Column(Integer, primary_key=True, index=True)
    property_id = Column(Integer, ForeignKey("properties.id", ondelete="CASCADE"), nullable=False)
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    document_type = Column(SAEnum(DocumentType), nullable=False, default=DocumentType.OTHER)
    display_name = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    content_type = Column(String(100), nullable=False)
    expires_at = Column(DateTime, nullable=True)
    is_archived = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    property = relationship("Property", back_populates="documents")
    uploader = relationship("User", foreign_keys=[uploaded_by])
