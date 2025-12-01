from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.db import get_db
from backend.models import Entry, AuthUser
from backend.auth import get_current_user
from backend.services.rollup_service import calculate_rollup
from typing import Optional, List, Dict, Any
from datetime import datetime

router = APIRouter()

@router.get("/dashboard/overview")
async def get_dashboard_overview(
    timeframe: Optional[str] = None,
    day_offset: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: AuthUser = Depends(get_current_user)
):
    """Combined endpoint: returns entries + rollup + goal in ONE call"""
    from backend.services.period import (
        get_today, get_yesterday, get_this_week, get_last_7_days,
        get_this_month, get_last_month, get_day_offset
    )
    
    # Determine date range
    if timeframe:
        if timeframe == 'TODAY':
            from_dt, to_dt = get_day_offset(day_offset) if day_offset is not None else get_today()
        elif timeframe == 'YESTERDAY':
            from_dt, to_dt = get_yesterday()
        elif timeframe == 'THIS_WEEK':
            from_dt, to_dt = get_this_week()
        elif timeframe == 'LAST_7_DAYS':
            from_dt, to_dt = get_last_7_days()
        elif timeframe == 'THIS_MONTH':
            from_dt, to_dt = get_this_month()
        elif timeframe == 'LAST_MONTH':
            from_dt, to_dt = get_last_month()
        else:
            from_dt, to_dt = get_today()
    else:
        from_dt, to_dt = get_today()
    
    # Get entries - limited to 100 most recent for performance
    entries = db.query(Entry).filter(
        Entry.user_id == current_user.id,
        Entry.timestamp >= from_dt,
        Entry.timestamp <= to_dt
    ).order_by(Entry.timestamp.desc()).limit(100).all()  # Limited result set for faster queries
    
    # Get rollup (includes goal data)
    rollup = calculate_rollup(db, from_dt, to_dt, timeframe, current_user.id)
    
    return {
        "entries": entries,
        "rollup": rollup,
        "timeframe": timeframe or "TODAY"
    }
