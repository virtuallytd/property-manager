from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from app.models.document import DocumentType

DOCUMENT_TYPE_LABELS = {
    DocumentType.GAS_SAFETY: "Gas Safety Certificate",
    DocumentType.EPC: "EPC Certificate",
    DocumentType.ELECTRICAL: "Electrical Safety Report",
    DocumentType.FIRE_RISK: "Fire Risk Assessment",
    DocumentType.INSURANCE: "Building Insurance",
    DocumentType.OTHER: "Other",
}


class DocumentUpdate(BaseModel):
    display_name: Optional[str] = None
    expires_at: Optional[str] = None   # ISO date string, or None to leave unchanged
    clear_expiry: bool = False          # set True to remove expiry date
    is_archived: Optional[bool] = None

    model_config = {"from_attributes": True}


class DocumentOut(BaseModel):
    id: int
    property_id: int
    document_type: DocumentType
    display_name: str
    url: str
    content_type: str
    expires_at: Optional[datetime] = None
    is_archived: bool = False
    created_at: datetime
    uploaded_by_username: str

    model_config = {"from_attributes": True}
