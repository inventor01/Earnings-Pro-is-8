from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from backend.db import get_db
from backend.services.ai_suggestions import get_ai_suggestions
from backend.entitlements import require_pro
from typing import Optional
from datetime import datetime, timezone

router = APIRouter()

@router.get("/suggestions")
async def get_suggestions(
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    db: Session = Depends(get_db),
    # AI Suggestions is a Pro feature (sold as such on the paywall). Server-side
    # enforcement backstop: non-Pro users get a 403 even if a modified client
    # bypasses the UI gate. require_pro authenticates AND checks entitlement
    # (with an on-demand RevenueCat re-check for stale state).
    current_user = Depends(require_pro)
):
    """Get AI-powered suggestions for earning optimization (Pro only)"""
    from_dt = None
    to_dt = None
    
    if from_date:
        from_dt = datetime.fromisoformat(from_date.replace('Z', '+00:00')).astimezone(timezone.utc).replace(tzinfo=None)
    if to_date:
        to_dt = datetime.fromisoformat(to_date.replace('Z', '+00:00')).astimezone(timezone.utc).replace(tzinfo=None)
    
    user_id = current_user.id if current_user else None
    suggestions = get_ai_suggestions(db, from_dt, to_dt, user_id)
    return suggestions
