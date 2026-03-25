from datetime import datetime
from pydantic import BaseModel

from app.models.property import PropertyType


class PropertyCreate(BaseModel):
    name: str
    property_type: PropertyType
    address_line1: str
    address_line2: str | None = None
    city: str
    postcode: str
    description: str | None = None


class PropertyUpdate(BaseModel):
    name: str | None = None
    property_type: PropertyType | None = None
    address_line1: str | None = None
    address_line2: str | None = None
    city: str | None = None
    postcode: str | None = None
    description: str | None = None


class PropertyOut(BaseModel):
    id: int
    landlord_id: int
    name: str
    property_type: PropertyType
    address_line1: str
    address_line2: str | None
    city: str
    postcode: str
    description: str | None
    tenant_count: int
    open_ticket_count: int
    created_at: datetime

    model_config = {"from_attributes": True}
