from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.db import get_db
from backend.schemas import RollupResponse
from backend.services.rollup_service import calculate_rollup
from backend.services.period import (
    get_today, get_yesterday, get_this_week, get_last_7_days,
    get_this_month, get_last_month
)
from typing import Optional

router = APIRouter()

@router.get("/rollup", response_model=RollupResponse)
async def get_rollup(
    timeframe: Optional[str] = None,
    db: Session = Depends(get_db)
):
    from_dt = None
    to_dt = None
    
    # Use timeframe parameter to calculate date boundaries server-side (eliminates timezone issues)
    if timeframe:
        try:
            if timeframe == "TODAY":
                from_dt, to_dt = get_today()
            elif timeframe == "YESTERDAY":
                from_dt, to_dt = get_yesterday()
            elif timeframe == "THIS_WEEK":
                from_dt, to_dt = get_this_week()
            elif timeframe == "LAST_7_DAYS":
                from_dt, to_dt = get_last_7_days()
            elif timeframe == "THIS_MONTH":
                from_dt, to_dt = get_this_month()
            elif timeframe == "LAST_MONTH":
                from_dt, to_dt = get_last_month()
            else:
                raise HTTPException(status_code=400, detail="Invalid timeframe")
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid timeframe: {str(e)}")
    
    rollup = calculate_rollup(db, from_dt, to_dt, timeframe)
    return rollup
