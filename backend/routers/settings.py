from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from backend.db import get_db
from backend.models import Settings, AuthUser
from backend.schemas import SettingsResponse, SettingsUpdate
from backend.auth import get_current_user
from decimal import Decimal
import os

router = APIRouter()

@router.get("/settings", response_model=SettingsResponse)
async def get_settings(db: Session = Depends(get_db), current_user: AuthUser = Depends(get_current_user)):
    settings = db.query(Settings).filter(Settings.user_id == current_user.id).first()
    if not settings:
        default_cost = Decimal(os.getenv("COST_PER_MILE_DEFAULT", "0"))
        settings = Settings(user_id=current_user.id, cost_per_mile=default_cost)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings

@router.put("/settings", response_model=SettingsResponse)
async def update_settings(settings_update: SettingsUpdate, db: Session = Depends(get_db), current_user: AuthUser = Depends(get_current_user)):
    settings = db.query(Settings).filter(Settings.user_id == current_user.id).first()
    if not settings:
        settings = Settings(user_id=current_user.id)
        db.add(settings)
    
    settings.cost_per_mile = settings_update.cost_per_mile
    db.commit()
    db.refresh(settings)
    return settings
