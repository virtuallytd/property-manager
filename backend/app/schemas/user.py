from datetime import datetime
from pydantic import BaseModel, EmailStr

from app.models.user import UserRole


class UserCreate(BaseModel):
    email: EmailStr
    username: str
    password: str


class UserOut(BaseModel):
    id: int
    email: str
    username: str
    role: str
    is_approved: bool
    is_active: bool
    avatar_url: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}

    @classmethod
    def from_user(cls, user: object) -> "UserOut":
        from app.config import settings as _settings
        avatar_url = None
        if getattr(user, "avatar_path", None):
            avatar_url = f"{_settings.backend_url}/uploads/{user.avatar_path}"
        return cls(
            id=user.id,
            email=user.email,
            username=user.username,
            role=user.role,
            is_approved=user.is_approved,
            is_active=user.is_active,
            avatar_url=avatar_url,
            created_at=user.created_at,
        )


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class UserUpdate(BaseModel):
    is_approved: bool | None = None
    is_active: bool | None = None
    role: UserRole | None = None


class UserProfileUpdate(BaseModel):
    email: EmailStr | None = None
    current_password: str | None = None
    new_password: str | None = None
