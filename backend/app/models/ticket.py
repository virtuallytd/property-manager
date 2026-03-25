from datetime import datetime
from enum import Enum

from sqlalchemy import Column, DateTime, Enum as SAEnum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.models.base import Base


class TicketType(str, Enum):
    MAINTENANCE = "maintenance"
    VISIT_REQUEST = "visit_request"


class TicketCategory(str, Enum):
    PLUMBING = "plumbing"
    ELECTRICAL = "electrical"
    GENERAL = "general"
    STRUCTURAL = "structural"
    PEST_CONTROL = "pest_control"
    APPLIANCES = "appliances"


class TicketStatus(str, Enum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    AWAITING_TENANT = "awaiting_tenant"
    RESOLVED = "resolved"
    CLOSED = "closed"


class TicketPriority(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class VisitResponse(str, Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    RESCHEDULED = "rescheduled"


class Ticket(Base):
    __tablename__ = "tickets"

    id = Column(Integer, primary_key=True, index=True)
    property_id = Column(Integer, ForeignKey("properties.id", ondelete="CASCADE"), nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)

    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    ticket_type = Column(SAEnum(TicketType), nullable=False, default=TicketType.MAINTENANCE)
    category = Column(SAEnum(TicketCategory), nullable=True)  # maintenance tickets only
    status = Column(SAEnum(TicketStatus), nullable=False, default=TicketStatus.OPEN)
    priority = Column(SAEnum(TicketPriority), nullable=False, default=TicketPriority.MEDIUM)

    # Visit request fields
    assigned_to_tenant_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    proposed_date = Column(DateTime, nullable=True)
    visit_response = Column(SAEnum(VisitResponse), nullable=True)
    visit_suggested_date = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    property = relationship("Property", back_populates="tickets")
    creator = relationship("User", foreign_keys=[created_by], back_populates="created_tickets")
    assigned_tenant = relationship("User", foreign_keys=[assigned_to_tenant_id])
    attachments = relationship(
        "TicketAttachment",
        primaryjoin="Ticket.id == TicketAttachment.ticket_id",
        back_populates=None,
        cascade="all, delete-orphan",
        foreign_keys="TicketAttachment.ticket_id",
        overlaps="ticket",
    )
    comments = relationship(
        "TicketComment",
        back_populates="ticket",
        cascade="all, delete-orphan",
        order_by="TicketComment.created_at",
    )


class TicketComment(Base):
    __tablename__ = "ticket_comments"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    body = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    ticket = relationship("Ticket", back_populates="comments")
    author = relationship("User", foreign_keys=[author_id], back_populates="ticket_comments")
    attachments = relationship("TicketAttachment", back_populates="comment", cascade="all, delete-orphan")


class TicketAttachment(Base):
    __tablename__ = "ticket_attachments"

    id = Column(Integer, primary_key=True, index=True)
    comment_id = Column(Integer, ForeignKey("ticket_comments.id", ondelete="CASCADE"), nullable=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id", ondelete="CASCADE"), nullable=True)
    original_filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    content_type = Column(String(100), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    comment = relationship("TicketComment", back_populates="attachments")
    ticket_ref = relationship("Ticket", foreign_keys=[ticket_id], overlaps="attachments")


class TicketRead(Base):
    __tablename__ = "ticket_reads"

    ticket_id = Column(Integer, ForeignKey("tickets.id", ondelete="CASCADE"), primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    last_read_at = Column(DateTime, default=datetime.utcnow, nullable=False)
