from datetime import datetime
from typing import Optional
from pydantic import BaseModel

from app.models.ticket import TicketCategory, TicketStatus, TicketType, VisitResponse


class AuthorOut(BaseModel):
    id: int
    username: str
    avatar_url: Optional[str] = None

    model_config = {"from_attributes": True}


class TicketCommentOut(BaseModel):
    id: int
    ticket_id: int
    author: AuthorOut
    body: str
    created_at: datetime

    model_config = {"from_attributes": True}


class TicketOut(BaseModel):
    id: int
    property_id: int
    created_by: int
    creator: AuthorOut
    title: str
    description: Optional[str]
    ticket_type: TicketType
    category: Optional[TicketCategory]
    status: TicketStatus
    proposed_date: Optional[datetime]
    visit_response: Optional[VisitResponse]
    visit_suggested_date: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    comments: list[TicketCommentOut] = []

    model_config = {"from_attributes": True}


class TicketListOut(BaseModel):
    """Lighter version for list views — no comments."""
    id: int
    property_id: int
    created_by: int
    creator: AuthorOut
    title: str
    ticket_type: TicketType
    category: Optional[TicketCategory]
    status: TicketStatus
    proposed_date: Optional[datetime]
    visit_response: Optional[VisitResponse]
    created_at: datetime
    updated_at: datetime
    unread: bool = False

    model_config = {"from_attributes": True}


class UnreadCountOut(BaseModel):
    count: int


class TicketCreate(BaseModel):
    property_id: int
    title: str
    description: Optional[str] = None
    ticket_type: TicketType = TicketType.MAINTENANCE
    category: Optional[TicketCategory] = None
    proposed_date: Optional[datetime] = None  # visit requests only
    tenant_id: Optional[int] = None  # visit requests: which tenant this is assigned to


class TicketStatusUpdate(BaseModel):
    status: TicketStatus


class VisitResponseUpdate(BaseModel):
    visit_response: VisitResponse
    visit_suggested_date: Optional[datetime] = None  # required when rescheduled


class TicketCommentCreate(BaseModel):
    body: str
