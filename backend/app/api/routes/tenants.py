"""Landlord tenant management routes."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_landlord
from app.db.session import get_db
from app.models.tenancy import LandlordTenant, Tenancy
from app.models.user import User

router = APIRouter()


class PropertySummary(BaseModel):
    id: int
    name: str


class TenantOut(BaseModel):
    id: int
    username: str
    email: str
    current_property: PropertySummary | None = None

    model_config = {"from_attributes": True}


@router.get("", response_model=list[TenantOut])
def list_tenants(
    db: Session = Depends(get_db),
    landlord: User = Depends(get_current_landlord),
):
    """Return all tenants scoped to this landlord, with their current property if assigned."""
    links = (
        db.query(LandlordTenant)
        .filter(LandlordTenant.landlord_id == landlord.id)
        .all()
    )

    result = []
    for link in links:
        tenant = link.tenant
        # Find the most recent active tenancy for this landlord's properties
        tenancy = (
            db.query(Tenancy)
            .join(Tenancy.property)
            .filter(
                Tenancy.tenant_id == tenant.id,
                Tenancy.property.has(landlord_id=landlord.id),
            )
            .order_by(Tenancy.created_at.desc())
            .first()
        )
        result.append(TenantOut(
            id=tenant.id,
            username=tenant.username,
            email=tenant.email,
            current_property=PropertySummary(
                id=tenancy.property.id,
                name=tenancy.property.name,
            ) if tenancy else None,
        ))

    return result


@router.post("/{tenant_id}/assign/{property_id}", status_code=204)
def assign_tenant_to_property(
    tenant_id: int,
    property_id: int,
    db: Session = Depends(get_db),
    landlord: User = Depends(get_current_landlord),
):
    """Assign one of this landlord's tenants to a property."""
    link = db.query(LandlordTenant).filter(
        LandlordTenant.landlord_id == landlord.id,
        LandlordTenant.tenant_id == tenant_id,
    ).first()
    if not link:
        raise HTTPException(status_code=404, detail="Tenant not found")

    # Verify property belongs to this landlord
    from app.models.property import Property
    prop = db.query(Property).filter(
        Property.id == property_id,
        Property.landlord_id == landlord.id,
    ).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    # Remove any existing tenancy for this tenant on landlord's properties
    existing = (
        db.query(Tenancy)
        .join(Tenancy.property)
        .filter(
            Tenancy.tenant_id == tenant_id,
            Tenancy.property.has(landlord_id=landlord.id),
        )
        .first()
    )
    if existing:
        db.delete(existing)

    db.add(Tenancy(property_id=property_id, tenant_id=tenant_id))
    db.commit()


@router.delete("/{tenant_id}/assign", status_code=204)
def unassign_tenant(
    tenant_id: int,
    db: Session = Depends(get_db),
    landlord: User = Depends(get_current_landlord),
):
    """Remove a tenant's current property assignment."""
    link = db.query(LandlordTenant).filter(
        LandlordTenant.landlord_id == landlord.id,
        LandlordTenant.tenant_id == tenant_id,
    ).first()
    if not link:
        raise HTTPException(status_code=404, detail="Tenant not found")

    tenancy = (
        db.query(Tenancy)
        .join(Tenancy.property)
        .filter(
            Tenancy.tenant_id == tenant_id,
            Tenancy.property.has(landlord_id=landlord.id),
        )
        .first()
    )
    if tenancy:
        db.delete(tenancy)
        db.commit()
