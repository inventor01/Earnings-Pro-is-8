from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from backend.db import get_db
from backend.schemas import RollupResponse
from backend.services.rollup_service import calculate_rollup
from typing import Optional
from datetime import datetime, timezone

router = APIRouter()

@router.get("/rollup", response_model=RollupResponse)
async def get_rollup(
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    timeframe: Optional[str] = None,
    db: Session = Depends(get_db)
):
    from_dt = None
    to_dt = None
    
    if from_date:
        from_dt = datetime.fromisoformat(from_date.replace('Z', '+00:00')).astimezone(timezone.utc).replace(tzinfo=None)
    if to_date:
        to_dt = datetime.fromisoformat(to_date.replace('Z', '+00:00')).astimezone(timezone.utc).replace(tzinfo=None)
    
    rollup = calculate_rollup(db, from_dt, to_dt, timeframe)
    return rollup
