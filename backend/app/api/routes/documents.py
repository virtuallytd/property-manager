"""Property document routes."""
import os
import uuid
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.config import settings
from app.db.session import get_db
from app.models.document import DocumentType, PropertyDocument
from app.models.property import Property
from app.models.tenancy import Tenancy
from app.models.user import User, UserRole
from app.schemas.document import DocumentOut, DocumentUpdate

router = APIRouter()


def _doc_out(d: PropertyDocument) -> DocumentOut:
    return DocumentOut(
        id=d.id,
        property_id=d.property_id,
        document_type=d.document_type,
        display_name=d.display_name,
        url=f"{settings.backend_url}/uploads/{d.file_path}",
        content_type=d.content_type,
        expires_at=d.expires_at,
        is_archived=d.is_archived,
        created_at=d.created_at,
        uploaded_by_username=d.uploader.username,
    )


def _get_property_or_403(property_id: int, user: User, db: Session) -> Property:
    prop = db.query(Property).filter(Property.id == property_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    if user.role == UserRole.ADMIN:
        return prop
    if user.role == UserRole.LANDLORD:
        if prop.landlord_id != user.id:
            raise HTTPException(status_code=403, detail="Access denied")
        return prop
    # Tenant: must be on this property
    tenancy = db.query(Tenancy).filter(
        Tenancy.property_id == property_id,
        Tenancy.tenant_id == user.id,
    ).first()
    if not tenancy:
        raise HTTPException(status_code=403, detail="Access denied")
    return prop


@router.get("/{property_id}/documents", response_model=list[DocumentOut])
def list_documents(
    property_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_property_or_403(property_id, current_user, db)
    docs = db.query(PropertyDocument).filter(PropertyDocument.property_id == property_id).order_by(PropertyDocument.created_at).all()
    return [_doc_out(d) for d in docs]


@router.post("/{property_id}/documents", response_model=DocumentOut, status_code=201)
async def upload_document(
    property_id: int,
    document_type: str = Form(...),
    display_name: str = Form(...),
    expires_at: str = Form(default=""),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == UserRole.TENANT:
        raise HTTPException(status_code=403, detail="Tenants cannot upload documents")
    prop = _get_property_or_403(property_id, current_user, db)

    try:
        doc_type = DocumentType(document_type)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid document type")

    content = await file.read()
    ext = os.path.splitext(file.filename or "file")[1] or ""
    relative_path = f"property_documents/{uuid.uuid4()}{ext}"
    full_path = os.path.join(settings.upload_dir, relative_path)
    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    with open(full_path, "wb") as f:
        f.write(content)

    parsed_expiry = None
    if expires_at:
        from datetime import datetime as _dt
        try:
            parsed_expiry = _dt.fromisoformat(expires_at)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid expires_at format")

    doc = PropertyDocument(
        property_id=property_id,
        uploaded_by=current_user.id,
        document_type=doc_type,
        display_name=display_name,
        file_path=relative_path,
        content_type=file.content_type or "application/octet-stream",
        expires_at=parsed_expiry,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return _doc_out(doc)


@router.patch("/{property_id}/documents/{doc_id}", response_model=DocumentOut)
def update_document(
    property_id: int,
    doc_id: int,
    body: DocumentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == UserRole.TENANT:
        raise HTTPException(status_code=403, detail="Tenants cannot edit documents")
    _get_property_or_403(property_id, current_user, db)
    doc = db.query(PropertyDocument).filter(
        PropertyDocument.id == doc_id,
        PropertyDocument.property_id == property_id,
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    if body.display_name is not None:
        doc.display_name = body.display_name
    if body.clear_expiry:
        doc.expires_at = None
    elif body.expires_at is not None:
        from datetime import datetime as _dt
        try:
            doc.expires_at = _dt.fromisoformat(body.expires_at)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid expires_at format")
    if body.is_archived is not None:
        doc.is_archived = body.is_archived

    db.commit()
    db.refresh(doc)
    return _doc_out(doc)


@router.delete("/{property_id}/documents/{doc_id}", status_code=204)
def delete_document(
    property_id: int,
    doc_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == UserRole.TENANT:
        raise HTTPException(status_code=403, detail="Tenants cannot delete documents")
    _get_property_or_403(property_id, current_user, db)
    doc = db.query(PropertyDocument).filter(
        PropertyDocument.id == doc_id,
        PropertyDocument.property_id == property_id,
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    # Delete physical file
    full_path = os.path.join(settings.upload_dir, doc.file_path)
    if os.path.exists(full_path):
        os.remove(full_path)
    db.delete(doc)
    db.commit()
