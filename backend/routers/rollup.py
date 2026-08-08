from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.db import get_db
from backend.schemas import RollupResponse
from backend.services.rollup_service import calculate_rollup
from backend.services.period import (
    get_today, get_yesterday, get_this_week, get_last_7_days,
    get_this_month, get_last_month, get_day_offset, get_est_date_range
)
from backend.models import AuthUser
from backend.auth import get_current_user
from typing import Optional
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("/rollup", response_model=RollupResponse)
async def get_rollup(
    timeframe: Optional[str] = None,
    day_offset: int = 0,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: AuthUser = Depends(get_current_user)
):
    from_dt = None
    to_dt = None

    # Custom range: from_date/to_date take precedence when both provided.
    # Accept either YYYY-MM-DD (interpreted as inclusive EST calendar days) or
    # full ISO datetimes for backward compat.
    if from_date and to_date and not timeframe:
        try:
            if 'T' in from_date or 'T' in to_date:
                from_dt = datetime.fromisoformat(from_date.replace('Z', '+00:00')).astimezone(timezone.utc).replace(tzinfo=None)
                to_dt   = datetime.fromisoformat(to_date.replace('Z', '+00:00')).astimezone(timezone.utc).replace(tzinfo=None)
            else:
                from_dt, to_dt = get_est_date_range(from_date, to_date)
        except Exception:
            # Don't leak parser internals to the client; details go to logs.
            logger.warning("Rollup date range parse failed", exc_info=True)
            raise HTTPException(status_code=400, detail="Invalid date range. Use YYYY-MM-DD or ISO datetimes.")
        rollup = calculate_rollup(db, from_dt, to_dt, None, current_user.id)
        return rollup

    # Use timeframe parameter to calculate date boundaries server-side (eliminates timezone issues)
    if timeframe:
        try:
            if timeframe == "TODAY":
                # When TODAY is requested, apply day_offset for day navigation
                from_dt, to_dt = get_day_offset(day_offset)
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
        except HTTPException:
            raise
        except Exception:
            logger.warning("Rollup timeframe computation failed", exc_info=True)
            raise HTTPException(status_code=400, detail="Invalid timeframe")
    
    rollup = calculate_rollup(db, from_dt, to_dt, timeframe, current_user.id)
    return rollup
