"""Authentication routes: register, login, me."""
import os
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.config import settings
from app.core.security import create_access_token, hash_password, verify_password
from app.db.session import get_db
from app.models.settings import AppSetting, DEFAULTS
from app.models.tenancy import LandlordTenant, PropertyInvite, Tenancy
from app.models.user import User, UserRole
from app.schemas.tenancy import InviteInfoOut, RegisterByInvite
from app.schemas.user import LoginRequest, TokenResponse, UserCreate, UserOut, UserProfileUpdate

router = APIRouter()


def _registration_enabled(db: Session) -> bool:
    row = db.query(AppSetting).filter(
        AppSetting.key == "registration_enabled",
        AppSetting.user_id == None,  # noqa: E711 — intentional NULL check
    ).first()
    value = row.value if row else DEFAULTS.get("registration_enabled", "true")
    return value.lower() == "true"


@router.post("/register", response_model=UserOut, status_code=201)
def register(body: UserCreate, db: Session = Depends(get_db)):
    if not _registration_enabled(db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Registration is currently disabled",
        )

    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    if db.query(User).filter(User.username == body.username).first():
        raise HTTPException(status_code=400, detail="Username already taken")

    user = User(
        email=body.email,
        username=body.username,
        hashed_password=hash_password(body.password),
        role=UserRole.LANDLORD,
        is_approved=False,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.get("/invite/{token}", response_model=InviteInfoOut)
def get_invite_info(token: str, db: Session = Depends(get_db)):
    invite = db.query(PropertyInvite).filter(PropertyInvite.token == token).first()
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    if invite.used_at:
        raise HTTPException(status_code=410, detail="This invite has already been used")
    if invite.expires_at < datetime.utcnow():
        raise HTTPException(status_code=410, detail="This invite has expired")
    prop = invite.property
    landlord = invite.creator
    return InviteInfoOut(
        property_name=prop.name,
        property_address=f"{prop.address_line1}, {prop.city}, {prop.postcode}",
        landlord_username=landlord.username,
        token=token,
    )


@router.post("/register-invite", response_model=TokenResponse, status_code=201)
def register_by_invite(body: RegisterByInvite, db: Session = Depends(get_db)):
    invite = db.query(PropertyInvite).filter(PropertyInvite.token == body.token).first()
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    if invite.used_at:
        raise HTTPException(status_code=410, detail="This invite has already been used")
    if invite.expires_at < datetime.utcnow():
        raise HTTPException(status_code=410, detail="This invite has expired")

    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    if db.query(User).filter(User.username == body.username).first():
        raise HTTPException(status_code=400, detail="Username already taken")

    user = User(
        email=body.email,
        username=body.username,
        hashed_password=hash_password(body.password),
        role=UserRole.TENANT,
        is_approved=True,
        is_active=True,
    )
    db.add(user)
    db.flush()

    tenancy = Tenancy(property_id=invite.property_id, tenant_id=user.id)
    db.add(tenancy)

    # Link tenant to landlord (scoped ownership)
    landlord_id = invite.property.landlord_id
    existing_link = db.query(LandlordTenant).filter(
        LandlordTenant.landlord_id == landlord_id,
        LandlordTenant.tenant_id == user.id,
    ).first()
    if not existing_link:
        db.add(LandlordTenant(landlord_id=landlord_id, tenant_id=user.id))

    invite.used_at = datetime.utcnow()
    invite.used_by_id = user.id
    db.commit()
    db.refresh(user)

    token = create_access_token({"sub": str(user.id)})
    return TokenResponse(access_token=token, token_type="bearer", user=UserOut.from_user(user))


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account has been disabled",
        )
    if not user.is_approved:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is awaiting approval",
        )

    token = create_access_token({"sub": str(user.id)})
    return TokenResponse(access_token=token, token_type="bearer", user=UserOut.from_user(user))


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return UserOut.from_user(current_user)


@router.post("/me/avatar", response_model=UserOut)
async def upload_avatar(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    content_type = file.content_type or ""
    if not content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    avatars_dir = os.path.join(settings.upload_dir, "avatars")
    os.makedirs(avatars_dir, exist_ok=True)

    # Remove old avatar file if present
    if current_user.avatar_path:
        old_path = os.path.join(settings.upload_dir, current_user.avatar_path)
        if os.path.exists(old_path):
            os.remove(old_path)

    ext = os.path.splitext(file.filename or "avatar")[1] or ".jpg"
    filename = f"avatars/{uuid.uuid4()}{ext}"
    storage_path = os.path.join(settings.upload_dir, filename)

    content = await file.read()
    with open(storage_path, "wb") as f:
        f.write(content)

    current_user.avatar_path = filename
    db.commit()
    db.refresh(current_user)
    return UserOut.from_user(current_user)


@router.patch("/me", response_model=UserOut)
def update_me(body: UserProfileUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if body.email is not None and body.email != current_user.email:
        if db.query(User).filter(User.email == body.email, User.id != current_user.id).first():
            raise HTTPException(status_code=400, detail="Email already in use")
        current_user.email = body.email

    if body.current_password is not None or body.new_password is not None:
        if not body.current_password or not body.new_password:
            raise HTTPException(status_code=400, detail="Both current and new password are required")
        if not verify_password(body.current_password, current_user.hashed_password):
            raise HTTPException(status_code=400, detail="Current password is incorrect")
        current_user.hashed_password = hash_password(body.new_password)

    db.commit()
    db.refresh(current_user)
    return UserOut.from_user(current_user)
