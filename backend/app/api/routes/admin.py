"""Admin-only routes for user management and global settings."""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_admin
from app.core.security import hash_password
from app.db.session import get_db
from app.models.settings import AppSetting, DEFAULTS
from app.models.property import Property
from app.models.tenancy import LandlordTenant, Tenancy
from app.models.user import User, UserRole
from app.schemas.user import AdminUserOut, UserCreate, UserOut, UserUpdate

router = APIRouter()


def _get_global_settings(db: Session) -> dict:
    rows = db.query(AppSetting).filter(AppSetting.user_id == None).all()  # noqa: E711
    result = {k: v for k, v in DEFAULTS.items() if k == "registration_enabled"}
    result.update({r.key: r.value for r in rows if r.key in result})
    return result


@router.get("/stats")
def get_stats(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    total_users = db.query(User).count()
    active_users = db.query(User).filter(User.is_active == True, User.is_approved == True).count()  # noqa: E712
    pending_users = db.query(User).filter(User.is_approved == False, User.is_active == True).count()  # noqa: E712
    disabled_users = db.query(User).filter(User.is_active == False).count()
    admin_users = db.query(User).filter(User.role == UserRole.ADMIN).count()
    landlord_users = db.query(User).filter(User.role == UserRole.LANDLORD).count()
    tenant_users = db.query(User).filter(User.role == UserRole.TENANT).count()
    total_properties = db.query(Property).count()

    return {
        "users": {
            "total": total_users,
            "active": active_users,
            "pending_approval": pending_users,
            "disabled": disabled_users,
            "admins": admin_users,
            "landlords": landlord_users,
            "tenants": tenant_users,
        },
        "properties": {
            "total": total_properties,
        },
    }


@router.get("/landlords", response_model=list[UserOut])
def list_landlords(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    return db.query(User).filter(User.role == UserRole.LANDLORD, User.is_active == True).order_by(User.username.asc()).all()  # noqa: E712


@router.get("/users", response_model=list[AdminUserOut])
def list_users(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    users = db.query(User).order_by(User.created_at.asc()).all()
    result = []
    for user in users:
        property_count = None
        tenant_count = None
        if user.role == UserRole.LANDLORD:
            property_count = db.query(Property).filter(Property.landlord_id == user.id).count()
            tenant_count = db.query(LandlordTenant).filter(LandlordTenant.landlord_id == user.id).count()
        out = AdminUserOut.from_user(user)
        out.property_count = property_count
        out.tenant_count = tenant_count
        result.append(out)
    return result


@router.post("/users", response_model=UserOut, status_code=201)
def create_user(
    body: UserCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    if db.query(User).filter(User.username == body.username).first():
        raise HTTPException(status_code=400, detail="Username already taken")

    if body.role == UserRole.TENANT and body.landlord_id is None:
        raise HTTPException(status_code=400, detail="Tenant accounts must be assigned to a landlord")

    if body.landlord_id is not None:
        landlord = db.query(User).filter(
            User.id == body.landlord_id, User.role == UserRole.LANDLORD
        ).first()
        if not landlord:
            raise HTTPException(status_code=400, detail="Landlord not found")

    user = User(
        email=body.email,
        username=body.username,
        hashed_password=hash_password(body.password),
        role=body.role,
        is_approved=True,
        is_active=True,
    )
    db.add(user)
    db.flush()

    if body.landlord_id is not None:
        db.add(LandlordTenant(landlord_id=body.landlord_id, tenant_id=user.id))

    db.commit()
    db.refresh(user)
    return user


@router.patch("/users/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    body: UserUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if body.is_approved is not None:
        user.is_approved = body.is_approved
    if body.is_active is not None:
        user.is_active = body.is_active
    if body.role is not None:
        user.role = body.role

    db.commit()
    db.refresh(user)
    return user


@router.delete("/users/{user_id}", status_code=204)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    if admin.id == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if db.query(Tenancy).filter(Tenancy.tenant_id == user_id).first():
        raise HTTPException(status_code=400, detail="Cannot delete this tenant — they are currently assigned to a property. Unassign them first.")

    if db.query(Property).filter(Property.landlord_id == user_id).first():
        raise HTTPException(status_code=400, detail="Cannot delete this landlord — they still have properties. Delete or reassign their properties first.")

    if db.query(LandlordTenant).filter(LandlordTenant.landlord_id == user_id).first():
        raise HTTPException(status_code=400, detail="Cannot delete this landlord — they still have tenants assigned to them. Remove their tenants first.")

    db.query(LandlordTenant).filter(
        (LandlordTenant.tenant_id == user_id) | (LandlordTenant.landlord_id == user_id)
    ).delete(synchronize_session=False)

    db.delete(user)
    db.commit()


@router.get("/settings")
def get_admin_settings(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    return _get_global_settings(db)


class AdminSettingsBody(BaseModel):
    registration_enabled: bool | None = None


@router.patch("/settings")
def update_admin_settings(
    body: AdminSettingsBody,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    updates = body.model_dump(exclude_none=True)

    for key, val in updates.items():
        str_value = str(val).lower() if isinstance(val, bool) else str(val)
        row = db.query(AppSetting).filter(
            AppSetting.key == key,
            AppSetting.user_id == None,  # noqa: E711
        ).first()
        if row:
            row.value = str_value
        else:
            db.add(AppSetting(key=key, value=str_value, user_id=None))

    db.commit()
    return _get_global_settings(db)
