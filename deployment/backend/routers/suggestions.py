from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from backend.db import get_db
from backend.services.ai_suggestions import get_ai_suggestions
from typing import Optional
from datetime import datetime, timezone

router = APIRouter()

@router.get("/suggestions")
async def get_suggestions(
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get AI-powered suggestions for earning optimization"""
    from_dt = None
    to_dt = None
    
    if from_date:
        from_dt = datetime.fromisoformat(from_date.replace('Z', '+00:00')).astimezone(timezone.utc).replace(tzinfo=None)
    if to_date:
        to_dt = datetime.fromisoformat(to_date.replace('Z', '+00:00')).astimezone(timezone.utc).replace(tzinfo=None)
    
    suggestions = get_ai_suggestions(db, from_dt, to_dt)
    return suggestions
