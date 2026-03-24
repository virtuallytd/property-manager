"""Property management routes — landlord only."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_landlord
from app.db.session import get_db
from app.models.property import Property
from app.models.user import User
from app.schemas.property import PropertyCreate, PropertyOut, PropertyUpdate

router = APIRouter()


def _to_out(prop: Property) -> PropertyOut:
    return PropertyOut(
        id=prop.id,
        landlord_id=prop.landlord_id,
        name=prop.name,
        property_type=prop.property_type,
        address_line1=prop.address_line1,
        address_line2=prop.address_line2,
        city=prop.city,
        postcode=prop.postcode,
        description=prop.description,
        tenant_count=0,  # populated when tenancies are built
        created_at=prop.created_at,
    )


@router.get("", response_model=list[PropertyOut])
def list_properties(
    db: Session = Depends(get_db),
    landlord: User = Depends(get_current_landlord),
):
    props = db.query(Property).filter(Property.landlord_id == landlord.id).order_by(Property.created_at.desc()).all()
    return [_to_out(p) for p in props]


@router.post("", response_model=PropertyOut, status_code=201)
def create_property(
    body: PropertyCreate,
    db: Session = Depends(get_db),
    landlord: User = Depends(get_current_landlord),
):
    prop = Property(**body.model_dump(), landlord_id=landlord.id)
    db.add(prop)
    db.commit()
    db.refresh(prop)
    return _to_out(prop)


@router.get("/{property_id}", response_model=PropertyOut)
def get_property(
    property_id: int,
    db: Session = Depends(get_db),
    landlord: User = Depends(get_current_landlord),
):
    prop = db.query(Property).filter(Property.id == property_id, Property.landlord_id == landlord.id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    return _to_out(prop)


@router.patch("/{property_id}", response_model=PropertyOut)
def update_property(
    property_id: int,
    body: PropertyUpdate,
    db: Session = Depends(get_db),
    landlord: User = Depends(get_current_landlord),
):
    prop = db.query(Property).filter(Property.id == property_id, Property.landlord_id == landlord.id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(prop, field, value)
    db.commit()
    db.refresh(prop)
    return _to_out(prop)


@router.delete("/{property_id}", status_code=204)
def delete_property(
    property_id: int,
    db: Session = Depends(get_db),
    landlord: User = Depends(get_current_landlord),
):
    prop = db.query(Property).filter(Property.id == property_id, Property.landlord_id == landlord.id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    db.delete(prop)
    db.commit()
