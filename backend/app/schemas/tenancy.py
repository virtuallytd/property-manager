from datetime import date, datetime
from pydantic import BaseModel


class TenantOut(BaseModel):
    id: int
    email: str
    username: str
    avatar_url: str | None = None

    model_config = {"from_attributes": True}


class TenancyOut(BaseModel):
    id: int
    property_id: int
    tenant: TenantOut
    start_date: date | None
    end_date: date | None
    notes: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class TenancyUpdate(BaseModel):
    start_date: date | None = None
    end_date: date | None = None
    notes: str | None = None


class InviteCreate(BaseModel):
    expires_at: datetime


class InviteOut(BaseModel):
    id: int
    token: str
    property_id: int
    expires_at: datetime
    used_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class InviteInfoOut(BaseModel):
    """Public info returned when a tenant visits an invite link."""
    property_name: str
    property_address: str
    landlord_username: str
    token: str


class LandlordOut(BaseModel):
    id: int
    username: str
    email: str
    avatar_url: str | None = None


class MyPropertyOut(BaseModel):
    """A property as seen by a tenant."""
    tenancy_id: int
    property_id: int
    name: str
    property_type: str
    address_line1: str
    address_line2: str | None
    city: str
    postcode: str
    description: str | None
    landlord: LandlordOut
    start_date: date | None
    end_date: date | None
    notes: str | None


class RegisterByInvite(BaseModel):
    token: str
    email: str
    username: str
    password: str
