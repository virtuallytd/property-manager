"""Admin-only routes for user management and global settings."""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_admin
from app.core.security import hash_password
from app.db.session import get_db
from app.models.settings import AppSetting, DEFAULTS
from app.models.user import User, UserRole
from app.schemas.user import UserCreate, UserOut, UserUpdate

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

    return {
        "users": {
            "total": total_users,
            "active": active_users,
            "pending_approval": pending_users,
            "disabled": disabled_users,
            "admins": admin_users,
        },
    }


@router.get("/users", response_model=list[UserOut])
def list_users(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    return db.query(User).order_by(User.created_at.asc()).all()


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

    user = User(
        email=body.email,
        username=body.username,
        hashed_password=hash_password(body.password),
        role=UserRole.USER,
        is_approved=True,
        is_active=True,
    )
    db.add(user)
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
