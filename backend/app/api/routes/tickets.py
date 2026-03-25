"""Ticket and comment routes."""
import os
import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.config import settings
from app.db.session import get_db
from app.models.property import Property
from app.models.tenancy import Tenancy
from sqlalchemy import or_
from app.models.settings import AppSetting, DEFAULTS
from app.models.ticket import Ticket, TicketAttachment, TicketCategory, TicketComment, TicketPriority, TicketRead, TicketStatus, TicketType, VisitResponse
from app.models.user import User, UserRole
from app.schemas.ticket import (
    AttachmentOut,
    AuthorOut,
    TicketCommentOut,
    TicketCreate,
    TicketListOut,
    TicketOut,
    TicketStatusUpdate,
    UnreadCountOut,
    VisitResponseUpdate,
)

router = APIRouter()


def _get_allowed_types(db: Session) -> list[str]:
    row = db.query(AppSetting).filter(
        AppSetting.key == "allowed_attachment_types",
        AppSetting.user_id == None,  # noqa: E711
    ).first()
    value = row.value if row else DEFAULTS.get("allowed_attachment_types", "")
    return [t.strip() for t in value.split(",") if t.strip()]


def _validate_file_types(files: list[UploadFile], allowed: list[str]) -> None:
    for file in files:
        ct = file.content_type or ""
        if not any(
            (pat.endswith("/*") and ct.startswith(pat[:-1])) or ct == pat
            for pat in allowed
        ):
            raise HTTPException(
                status_code=400,
                detail=f"File type '{ct}' is not allowed. Allowed types: {', '.join(allowed)}",
            )


def _attachment_out(a: TicketAttachment) -> AttachmentOut:
    return AttachmentOut(
        id=a.id,
        original_filename=a.original_filename,
        url=f"{settings.backend_url}/uploads/{a.file_path}",
        content_type=a.content_type,
    )


def _comment_out(c: TicketComment) -> TicketCommentOut:
    return TicketCommentOut(
        id=c.id,
        ticket_id=c.ticket_id,
        author=_author_out(c.author),
        body=c.body,
        created_at=c.created_at,
        attachments=[_attachment_out(a) for a in c.attachments],
    )


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
        attachments=[_attachment_out(a) for a in t.attachments],
        comments=[_comment_out(c) for c in t.comments],
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
async def create_ticket(
    property_id: int = Form(...),
    title: str = Form(...),
    description: str = Form(default=""),
    ticket_type: str = Form(default="maintenance"),
    category: str = Form(default=""),
    priority: str = Form(default="medium"),
    proposed_date: str = Form(default=""),
    tenant_id: str = Form(default=""),
    files: list[UploadFile] = File(default=[]),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Parse enums / optional values
    t_type = TicketType(ticket_type)
    t_priority = TicketPriority(priority) if priority else TicketPriority.MEDIUM
    t_category = TicketCategory(category) if category else None
    t_tenant_id = int(tenant_id) if tenant_id else None
    t_proposed_date = None
    if proposed_date:
        from datetime import datetime as _dt
        try:
            parsed = _dt.fromisoformat(proposed_date)
            t_proposed_date = parsed.replace(tzinfo=None) if parsed.tzinfo else parsed
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid proposed_date format")

    if current_user.role == UserRole.LANDLORD or current_user.role == UserRole.ADMIN:
        prop = db.query(Property).filter(
            Property.id == property_id,
            Property.landlord_id == current_user.id,
        ).first()
        if not prop:
            raise HTTPException(status_code=404, detail="Property not found")
        if t_type != TicketType.VISIT_REQUEST:
            raise HTTPException(status_code=400, detail="Landlords can only raise visit requests")
        if not t_proposed_date:
            raise HTTPException(status_code=400, detail="proposed_date is required for visit requests")
        if not t_tenant_id:
            raise HTTPException(status_code=400, detail="tenant_id is required for visit requests")
        tenancy = db.query(Tenancy).filter(
            Tenancy.property_id == property_id,
            Tenancy.tenant_id == t_tenant_id,
        ).first()
        if not tenancy:
            raise HTTPException(status_code=400, detail="Specified tenant is not on this property")
    else:
        tenancy = db.query(Tenancy).filter(
            Tenancy.property_id == property_id,
            Tenancy.tenant_id == current_user.id,
        ).first()
        if not tenancy:
            raise HTTPException(status_code=403, detail="You are not a tenant of this property")
        if t_type != TicketType.MAINTENANCE:
            raise HTTPException(status_code=400, detail="Tenants can only raise maintenance tickets")
        if not t_category:
            raise HTTPException(status_code=400, detail="category is required for maintenance tickets")

    ticket = Ticket(
        property_id=property_id,
        created_by=current_user.id,
        title=title,
        description=description or None,
        ticket_type=t_type,
        category=t_category,
        priority=t_priority,
        assigned_to_tenant_id=t_tenant_id if t_type == TicketType.VISIT_REQUEST else None,
        proposed_date=t_proposed_date,
        visit_response=VisitResponse.PENDING if t_type == TicketType.VISIT_REQUEST else None,
    )
    db.add(ticket)
    db.flush()

    # Save any uploaded files as ticket-level attachments
    if files:
        _validate_file_types(files, _get_allowed_types(db))
        attachments_dir = os.path.join(settings.upload_dir, "ticket_attachments")
        os.makedirs(attachments_dir, exist_ok=True)
        for file in files:
            content = await file.read()
            ext = os.path.splitext(file.filename or "file")[1] or ""
            relative_path = f"ticket_attachments/{uuid.uuid4()}{ext}"
            full_path = os.path.join(settings.upload_dir, relative_path)
            with open(full_path, "wb") as f:
                f.write(content)
            db.add(TicketAttachment(
                ticket_id=ticket.id,
                original_filename=file.filename or "attachment",
                file_path=relative_path,
                content_type=file.content_type or "application/octet-stream",
            ))

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
async def add_comment(
    ticket_id: int,
    body: str = Form(default=""),
    files: list[UploadFile] = File(default=[]),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ticket = _get_ticket_or_403(ticket_id, current_user, db)

    if ticket.status == TicketStatus.CLOSED:
        raise HTTPException(status_code=400, detail="Cannot comment on a closed ticket")

    if not body and not files:
        raise HTTPException(status_code=400, detail="Comment must have a body or at least one attachment")

    if files:
        _validate_file_types(files, _get_allowed_types(db))

    # If a tenant comments on a resolved ticket, revert it to in_progress
    if current_user.role == UserRole.TENANT and ticket.status == TicketStatus.RESOLVED:
        ticket.status = TicketStatus.IN_PROGRESS

    comment = TicketComment(
        ticket_id=ticket.id,
        author_id=current_user.id,
        body=body,
    )
    db.add(comment)
    db.flush()

    # Save any uploaded files
    attachments_dir = os.path.join(settings.upload_dir, "ticket_attachments")
    os.makedirs(attachments_dir, exist_ok=True)

    for file in files:
        content = await file.read()
        ext = os.path.splitext(file.filename or "file")[1] or ""
        relative_path = f"ticket_attachments/{uuid.uuid4()}{ext}"
        full_path = os.path.join(settings.upload_dir, relative_path)
        with open(full_path, "wb") as f:
            f.write(content)
        db.add(TicketAttachment(
            comment_id=comment.id,
            original_filename=file.filename or "attachment",
            file_path=relative_path,
            content_type=file.content_type or "application/octet-stream",
        ))

    ticket.updated_at = datetime.utcnow()
    _mark_read(ticket, current_user.id, db)
    db.commit()
    db.refresh(comment)

    return _comment_out(comment)
