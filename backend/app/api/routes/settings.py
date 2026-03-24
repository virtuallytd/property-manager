import zoneinfo
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.settings import AppSetting, DEFAULTS
from app.models.user import User

router = APIRouter()

# Keys that are per-user (not global admin settings)
USER_SETTING_KEYS = {"timezone"}


def _get_user_settings(user_id: int, db: Session) -> dict:
    rows = db.query(AppSetting).filter(
        AppSetting.user_id == user_id,
        AppSetting.key.in_(USER_SETTING_KEYS),
    ).all()
    result = {k: v for k, v in DEFAULTS.items() if k in USER_SETTING_KEYS}
    result.update({r.key: r.value for r in rows})
    return result


@router.get("")
def get_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _get_user_settings(current_user.id, db)


class SettingsUpdate(BaseModel):
    timezone: str | None = None


@router.patch("")
def update_settings(
    body: SettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    updates = body.model_dump(exclude_none=True)

    if "timezone" in updates:
        try:
            zoneinfo.ZoneInfo(updates["timezone"])
        except (zoneinfo.ZoneInfoNotFoundError, KeyError):
            raise HTTPException(status_code=400, detail=f"Unknown timezone: {updates['timezone']}")

    for key, value in updates.items():
        if key not in USER_SETTING_KEYS:
            continue
        row = db.query(AppSetting).filter(
            AppSetting.key == key,
            AppSetting.user_id == current_user.id,
        ).first()
        if row:
            row.value = value
        else:
            db.add(AppSetting(key=key, value=value, user_id=current_user.id))

    db.commit()
    return _get_user_settings(current_user.id, db)
