from fastapi import APIRouter, Depends, HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from sqlalchemy import func
from backend.db import get_db
from backend.models import AuthUser, UserPlatform
from backend.schemas import PlatformCreate, PlatformResponse
from backend.auth import get_current_user
from typing import List

router = APIRouter()

# Modest per-IP limit: platform creation is a rare, user-initiated action, so
# this only guards against scripted flooding of the table.
platform_limiter = Limiter(key_func=get_remote_address)

# Built-in AppType display labels — a custom platform must not shadow one of
# these (case-insensitive), otherwise the UI would show two identical chips.
BUILTIN_PLATFORM_NAMES = {
    "doordash", "door dash",
    "ubereats", "uber eats",
    "instacart",
    "grubhub", "grub hub",
    "shipt",
    "other",
}

# Hard cap so a single account can't grow an unbounded platform list.
MAX_PLATFORMS_PER_USER = 30


@router.get("/platforms", response_model=List[PlatformResponse])
async def list_platforms(db: Session = Depends(get_db), current_user: AuthUser = Depends(get_current_user)):
    return (
        db.query(UserPlatform)
        .filter(UserPlatform.user_id == current_user.id)
        .order_by(UserPlatform.created_at.asc(), UserPlatform.id.asc())
        .all()
    )


@router.post("/platforms", response_model=PlatformResponse, status_code=201)
@platform_limiter.limit("20/minute")
async def create_platform(
    request: Request,
    payload: PlatformCreate,
    db: Session = Depends(get_db),
    current_user: AuthUser = Depends(get_current_user),
):
    name = (payload.name or "").strip()
    if not name:
        raise HTTPException(status_code=422, detail="Platform name is required.")

    if name.lower() in BUILTIN_PLATFORM_NAMES:
        raise HTTPException(status_code=409, detail="That platform already exists.")

    existing = (
        db.query(UserPlatform)
        .filter(
            UserPlatform.user_id == current_user.id,
            func.lower(UserPlatform.name) == name.lower(),
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="You already added that platform.")

    count = db.query(UserPlatform).filter(UserPlatform.user_id == current_user.id).count()
    if count >= MAX_PLATFORMS_PER_USER:
        raise HTTPException(status_code=400, detail=f"Platform limit reached ({MAX_PLATFORMS_PER_USER}).")

    row = UserPlatform(user_id=current_user.id, name=name)
    db.add(row)
    try:
        db.commit()
    except IntegrityError:
        # Lost a race with a concurrent identical create — return the winner.
        db.rollback()
        row = (
            db.query(UserPlatform)
            .filter(
                UserPlatform.user_id == current_user.id,
                func.lower(UserPlatform.name) == name.lower(),
            )
            .first()
        )
        if row is None:
            raise HTTPException(status_code=409, detail="You already added that platform.")
        return row
    db.refresh(row)
    return row
