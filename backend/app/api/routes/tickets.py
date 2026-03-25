"""Ticket and comment routes."""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.config import settings
from app.db.session import get_db
from app.models.property import Property
from app.models.tenancy import Tenancy
from sqlalchemy import or_
from app.models.ticket import Ticket, TicketComment, TicketRead, TicketStatus, TicketType, VisitResponse
from app.models.user import User, UserRole
from app.schemas.ticket import (
    AuthorOut,
    TicketCommentCreate,
    TicketCommentOut,
    TicketCreate,
    TicketListOut,
    TicketOut,
    TicketStatusUpdate,
    UnreadCountOut,
    VisitResponseUpdate,
)

router = APIRouter()


def _author_out(user: User) -> AuthorOut:
    avatar_url = f"{settings.backend_url}/uploads/{user.avatar_path}" if user.avatar_path else None
    return AuthorOut(id=user.id, username=user.username, avatar_url=avatar_url)


def _is_unread(ticket: Ticket, user_id: int, db: Session) -> bool:
    read = db.query(TicketRead).filter(
        TicketRead.ticket_id == ticket.id,
        TicketRead.user_id == user_id,
    ).first()
    if not read:
        return True
    return read.last_read_at < ticket.updated_at


def _mark_read(ticket: Ticket, user_id: int, db: Session) -> None:
    read = db.query(TicketRead).filter(
        TicketRead.ticket_id == ticket.id,
        TicketRead.user_id == user_id,
    ).first()
    now = datetime.utcnow()
    if read:
        read.last_read_at = now
    else:
        db.add(TicketRead(ticket_id=ticket.id, user_id=user_id, last_read_at=now))
    db.commit()


def _ticket_list_out(t: Ticket, user_id: int, db: Session) -> TicketListOut:
    return TicketListOut(
        id=t.id,
        property_id=t.property_id,
        property_name=t.property.name,
        created_by=t.created_by,
        creator=_author_out(t.creator),
        title=t.title,
        ticket_type=t.ticket_type,
        category=t.category,
        status=t.status,
        priority=t.priority,
        proposed_date=t.proposed_date,
        visit_response=t.visit_response,
        created_at=t.created_at,
        updated_at=t.updated_at,
        unread=_is_unread(t, user_id, db),
    )


def _ticket_out(t: Ticket) -> TicketOut:
    return TicketOut(
        id=t.id,
        property_id=t.property_id,
        property_name=t.property.name,
        created_by=t.created_by,
        creator=_author_out(t.creator),
        title=t.title,
        description=t.description,
        ticket_type=t.ticket_type,
        category=t.category,
        status=t.status,
        priority=t.priority,
        proposed_date=t.proposed_date,
        visit_response=t.visit_response,
        visit_suggested_date=t.visit_suggested_date,
        created_at=t.created_at,
        updated_at=t.updated_at,
        comments=[
            TicketCommentOut(
                id=c.id,
                ticket_id=c.ticket_id,
                author=_author_out(c.author),
                body=c.body,
                created_at=c.created_at,
            )
            for c in t.comments
        ],
    )


def _get_ticket_or_403(ticket_id: int, user: User, db: Session) -> Ticket:
    """Fetch ticket and verify the user is allowed to see it."""
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    if user.role == UserRole.ADMIN:
        return ticket

    if user.role == UserRole.LANDLORD:
        prop = db.query(Property).filter(
            Property.id == ticket.property_id,
            Property.landlord_id == user.id,
        ).first()
        if not prop:
            raise HTTPException(status_code=403, detail="Access denied")
        return ticket

    # Tenant: must be a tenant of the property
    tenancy = db.query(Tenancy).filter(
        Tenancy.property_id == ticket.property_id,
        Tenancy.tenant_id == user.id,
    ).first()
    if not tenancy:
        raise HTTPException(status_code=403, detail="Access denied")
    # Tenants can see visit requests assigned to them and their own maintenance tickets
    if ticket.ticket_type == TicketType.VISIT_REQUEST and ticket.assigned_to_tenant_id == user.id:
        return ticket
    if ticket.created_by == user.id:
        return ticket
    raise HTTPException(status_code=403, detail="Access denied")


# ─── Endpoints that must come before /{ticket_id} ─────────────────────────────

@router.get("/unread-count", response_model=UnreadCountOut)
def unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == UserRole.ADMIN:
        tickets = db.query(Ticket).filter(Ticket.status != TicketStatus.CLOSED).all()
    elif current_user.role == UserRole.LANDLORD:
        property_ids = [p.id for p in db.query(Property).filter(Property.landlord_id == current_user.id).all()]
        tickets = db.query(Ticket).filter(
            Ticket.property_id.in_(property_ids),
            Ticket.status != TicketStatus.CLOSED,
        ).all()
    else:
        tickets = (
            db.query(Ticket)
            .filter(
                or_(
                    Ticket.created_by == current_user.id,
                    Ticket.assigned_to_tenant_id == current_user.id,
                ),
                Ticket.status != TicketStatus.CLOSED,
            )
            .all()
        )

    count = sum(1 for t in tickets if _is_unread(t, current_user.id, db))
    return UnreadCountOut(count=count)


# ─── List / create ────────────────────────────────────────────────────────────

@router.get("", response_model=list[TicketListOut])
def list_tickets(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == UserRole.ADMIN:
        tickets = db.query(Ticket).order_by(Ticket.updated_at.desc()).all()

    elif current_user.role == UserRole.LANDLORD:
        property_ids = [p.id for p in db.query(Property).filter(Property.landlord_id == current_user.id).all()]
        tickets = (
            db.query(Ticket)
            .filter(Ticket.property_id.in_(property_ids))
            .order_by(Ticket.updated_at.desc())
            .all()
        )

    else:
        # Tenant: own maintenance tickets + visit requests assigned directly to them
        tickets = (
            db.query(Ticket)
            .filter(or_(
                Ticket.created_by == current_user.id,
                Ticket.assigned_to_tenant_id == current_user.id,
            ))
            .order_by(Ticket.updated_at.desc())
            .all()
        )

    return [_ticket_list_out(t, current_user.id, db) for t in tickets]


@router.post("", response_model=TicketOut, status_code=201)
def create_ticket(
    body: TicketCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == UserRole.LANDLORD or current_user.role == UserRole.ADMIN:
        prop = db.query(Property).filter(
            Property.id == body.property_id,
            Property.landlord_id == current_user.id,
        ).first()
        if not prop:
            raise HTTPException(status_code=404, detail="Property not found")
        if body.ticket_type != TicketType.VISIT_REQUEST:
            raise HTTPException(status_code=400, detail="Landlords can only raise visit requests")
        if not body.proposed_date:
            raise HTTPException(status_code=400, detail="proposed_date is required for visit requests")
        if not body.tenant_id:
            raise HTTPException(status_code=400, detail="tenant_id is required for visit requests")
        # Verify the tenant is actually on this property
        tenancy = db.query(Tenancy).filter(
            Tenancy.property_id == body.property_id,
            Tenancy.tenant_id == body.tenant_id,
        ).first()
        if not tenancy:
            raise HTTPException(status_code=400, detail="Specified tenant is not on this property")
    else:
        tenancy = db.query(Tenancy).filter(
            Tenancy.property_id == body.property_id,
            Tenancy.tenant_id == current_user.id,
        ).first()
        if not tenancy:
            raise HTTPException(status_code=403, detail="You are not a tenant of this property")
        if body.ticket_type != TicketType.MAINTENANCE:
            raise HTTPException(status_code=400, detail="Tenants can only raise maintenance tickets")
        if not body.category:
            raise HTTPException(status_code=400, detail="category is required for maintenance tickets")

    proposed_date = None
    if body.proposed_date:
        proposed_date = body.proposed_date.replace(tzinfo=None) if body.proposed_date.tzinfo else body.proposed_date

    ticket = Ticket(
        property_id=body.property_id,
        created_by=current_user.id,
        title=body.title,
        description=body.description,
        ticket_type=body.ticket_type,
        category=body.category,
        priority=body.priority,
        assigned_to_tenant_id=body.tenant_id if body.ticket_type == TicketType.VISIT_REQUEST else None,
        proposed_date=proposed_date,
        visit_response=VisitResponse.PENDING if body.ticket_type == TicketType.VISIT_REQUEST else None,
    )
    db.add(ticket)
    db.flush()

    # Creator starts with a read record so it doesn't appear unread to themselves
    db.add(TicketRead(ticket_id=ticket.id, user_id=current_user.id, last_read_at=datetime.utcnow()))
    db.commit()
    db.refresh(ticket)
    return _ticket_out(ticket)


# ─── Single ticket ────────────────────────────────────────────────────────────

@router.get("/{ticket_id}", response_model=TicketOut)
def get_ticket(
    ticket_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ticket = _get_ticket_or_403(ticket_id, current_user, db)
    _mark_read(ticket, current_user.id, db)
    return _ticket_out(ticket)


@router.post("/{ticket_id}/read", status_code=204)
def mark_ticket_read(
    ticket_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ticket = _get_ticket_or_403(ticket_id, current_user, db)
    _mark_read(ticket, current_user.id, db)


@router.patch("/{ticket_id}/status", response_model=TicketOut)
def update_ticket_status(
    ticket_id: int,
    body: TicketStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ticket = _get_ticket_or_403(ticket_id, current_user, db)

    if current_user.role == UserRole.TENANT:
        # Tenants can only confirm closure of a resolved ticket
        if not (ticket.status == TicketStatus.RESOLVED and body.status == TicketStatus.CLOSED):
            raise HTTPException(status_code=403, detail="Only landlords can change ticket status")
        # Add system comment confirming closure
        db.add(TicketComment(
            ticket_id=ticket.id,
            author_id=current_user.id,
            body="Tenant confirmed the issue is resolved and closed the ticket.",
        ))

    ticket.status = body.status
    ticket.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(ticket)
    return _ticket_out(ticket)


@router.patch("/{ticket_id}/visit-response", response_model=TicketOut)
def respond_to_visit(
    ticket_id: int,
    body: VisitResponseUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ticket = _get_ticket_or_403(ticket_id, current_user, db)

    if ticket.ticket_type != TicketType.VISIT_REQUEST:
        raise HTTPException(status_code=400, detail="This ticket is not a visit request")
    if current_user.role != UserRole.TENANT:
        raise HTTPException(status_code=403, detail="Only tenants can respond to visit requests")
    if body.visit_response == VisitResponse.RESCHEDULED and not body.visit_suggested_date:
        raise HTTPException(status_code=400, detail="visit_suggested_date is required when rescheduling")

    ticket.visit_response = body.visit_response
    if body.visit_suggested_date:
        suggested = body.visit_suggested_date
        ticket.visit_suggested_date = suggested.replace(tzinfo=None) if suggested.tzinfo else suggested

    ticket.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(ticket)
    return _ticket_out(ticket)


@router.post("/{ticket_id}/comments", response_model=TicketCommentOut, status_code=201)
def add_comment(
    ticket_id: int,
    body: TicketCommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ticket = _get_ticket_or_403(ticket_id, current_user, db)

    if ticket.status == TicketStatus.CLOSED:
        raise HTTPException(status_code=400, detail="Cannot comment on a closed ticket")

    # If a tenant comments on a resolved ticket, revert it to in_progress
    if current_user.role == UserRole.TENANT and ticket.status == TicketStatus.RESOLVED:
        ticket.status = TicketStatus.IN_PROGRESS

    comment = TicketComment(
        ticket_id=ticket.id,
        author_id=current_user.id,
        body=body.body,
    )
    db.add(comment)

    # Bump updated_at so the other party sees it as unread
    ticket.updated_at = datetime.utcnow()

    # Mark as read for the commenter immediately
    _mark_read(ticket, current_user.id, db)

    db.commit()
    db.refresh(comment)

    return TicketCommentOut(
        id=comment.id,
        ticket_id=comment.ticket_id,
        author=_author_out(current_user),
        body=comment.body,
        created_at=comment.created_at,
    )
