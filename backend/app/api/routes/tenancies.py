"""Tenancy and invite management routes."""
import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_landlord
from app.db.session import get_db
from app.models.property import Property
from app.models.tenancy import PropertyInvite, Tenancy
from app.models.user import User
from app.schemas.tenancy import (
    InviteCreate,
    InviteOut,
    TenancyOut,
    TenancyUpdate,
    TenantOut,
)

router = APIRouter()


def _check_property(property_id: int, landlord: User, db: Session) -> Property:
    prop = db.query(Property).filter(
        Property.id == property_id,
        Property.landlord_id == landlord.id,
    ).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    return prop


def _tenancy_out(t: Tenancy, db: Session) -> TenancyOut:
    from app.config import settings as _settings
    tenant = t.tenant
    avatar_url = None
    if tenant.avatar_path:
        avatar_url = f"{_settings.backend_url}/uploads/{tenant.avatar_path}"
    return TenancyOut(
        id=t.id,
        property_id=t.property_id,
        tenant=TenantOut(id=tenant.id, email=tenant.email, username=tenant.username, avatar_url=avatar_url),
        start_date=t.start_date,
        end_date=t.end_date,
        notes=t.notes,
        created_at=t.created_at,
    )


# ─── Tenancies ────────────────────────────────────────────────────────────────

@router.get("/{property_id}/tenancies", response_model=list[TenancyOut])
def list_tenancies(
    property_id: int,
    db: Session = Depends(get_db),
    landlord: User = Depends(get_current_landlord),
):
    _check_property(property_id, landlord, db)
    tenancies = db.query(Tenancy).filter(Tenancy.property_id == property_id).all()
    return [_tenancy_out(t, db) for t in tenancies]


@router.patch("/{property_id}/tenancies/{tenancy_id}", response_model=TenancyOut)
def update_tenancy(
    property_id: int,
    tenancy_id: int,
    body: TenancyUpdate,
    db: Session = Depends(get_db),
    landlord: User = Depends(get_current_landlord),
):
    _check_property(property_id, landlord, db)
    tenancy = db.query(Tenancy).filter(Tenancy.id == tenancy_id, Tenancy.property_id == property_id).first()
    if not tenancy:
        raise HTTPException(status_code=404, detail="Tenancy not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(tenancy, field, value)
    db.commit()
    db.refresh(tenancy)
    return _tenancy_out(tenancy, db)


@router.delete("/{property_id}/tenancies/{tenancy_id}", status_code=204)
def remove_tenancy(
    property_id: int,
    tenancy_id: int,
    db: Session = Depends(get_db),
    landlord: User = Depends(get_current_landlord),
):
    _check_property(property_id, landlord, db)
    tenancy = db.query(Tenancy).filter(Tenancy.id == tenancy_id, Tenancy.property_id == property_id).first()
    if not tenancy:
        raise HTTPException(status_code=404, detail="Tenancy not found")
    db.delete(tenancy)
    db.commit()


# ─── Invites ──────────────────────────────────────────────────────────────────

@router.get("/{property_id}/invites", response_model=list[InviteOut])
def list_invites(
    property_id: int,
    db: Session = Depends(get_db),
    landlord: User = Depends(get_current_landlord),
):
    _check_property(property_id, landlord, db)
    invites = (
        db.query(PropertyInvite)
        .filter(PropertyInvite.property_id == property_id, PropertyInvite.used_at == None)  # noqa: E711
        .order_by(PropertyInvite.created_at.desc())
        .all()
    )
    return invites


@router.post("/{property_id}/invites", response_model=InviteOut, status_code=201)
def create_invite(
    property_id: int,
    body: InviteCreate,
    db: Session = Depends(get_db),
    landlord: User = Depends(get_current_landlord),
):
    _check_property(property_id, landlord, db)
    expires_at = body.expires_at.replace(tzinfo=None) if body.expires_at.tzinfo else body.expires_at
    if expires_at <= datetime.utcnow():
        raise HTTPException(status_code=400, detail="Expiry date must be in the future")
    invite = PropertyInvite(
        token=secrets.token_urlsafe(32),
        property_id=property_id,
        created_by=landlord.id,
        expires_at=expires_at,
    )
    db.add(invite)
    db.commit()
    db.refresh(invite)
    return invite


@router.delete("/{property_id}/invites/{invite_id}", status_code=204)
def revoke_invite(
    property_id: int,
    invite_id: int,
    db: Session = Depends(get_db),
    landlord: User = Depends(get_current_landlord),
):
    _check_property(property_id, landlord, db)
    invite = db.query(PropertyInvite).filter(
        PropertyInvite.id == invite_id,
        PropertyInvite.property_id == property_id,
    ).first()
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    db.delete(invite)
    db.commit()



