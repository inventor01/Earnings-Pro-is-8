from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from backend.db import get_db
from backend.models import Goal, TimeframeType, AuthUser
from backend.schemas import GoalCreate, GoalUpdate, GoalResponse
from backend.auth import get_current_user

router = APIRouter()

@router.get("/goals/{timeframe}", response_model=Optional[GoalResponse])
def get_goal(timeframe: str, db: Session = Depends(get_db), current_user: AuthUser = Depends(get_current_user)):
    try:
        tf = TimeframeType[timeframe]
    except KeyError:
        raise HTTPException(status_code=400, detail="Invalid timeframe")
    
    goal = db.query(Goal).filter(Goal.timeframe == tf, Goal.user_id == current_user.id).first()
    if not goal:
        # Return None/null instead of 404 to allow frontend to handle gracefully
        return None
    return goal

@router.post("/goals", response_model=GoalResponse)
def create_goal(goal: GoalCreate, db: Session = Depends(get_db), current_user: AuthUser = Depends(get_current_user)):
    existing = db.query(Goal).filter(Goal.timeframe == goal.timeframe, Goal.user_id == current_user.id).first()
    if existing:
        setattr(existing, 'target_profit', goal.target_profit)
        if hasattr(goal, 'goal_name') and goal.goal_name:
            setattr(existing, 'goal_name', goal.goal_name)
        db.commit()
        db.refresh(existing)
    else:
        db_goal = Goal(user_id=current_user.id, **goal.dict())
        db.add(db_goal)
        db.commit()
        db.refresh(db_goal)
        existing = db_goal
    
    return existing

@router.put("/goals/{timeframe}", response_model=GoalResponse)
def update_goal(timeframe: str, goal: GoalUpdate, db: Session = Depends(get_db), current_user: AuthUser = Depends(get_current_user)):
    try:
        tf = TimeframeType[timeframe]
    except KeyError:
        raise HTTPException(status_code=400, detail="Invalid timeframe")
    
    db_goal = db.query(Goal).filter(Goal.timeframe == tf, Goal.user_id == current_user.id).first()
    if not db_goal:
        # Create the goal if it doesn't exist instead of returning 404
        db_goal = Goal(user_id=current_user.id, timeframe=tf, target_profit=goal.target_profit)
        db.add(db_goal)
        db.commit()
        db.refresh(db_goal)
    else:
        setattr(db_goal, 'target_profit', goal.target_profit)
        db.commit()
        db.refresh(db_goal)
    
    return db_goal

@router.delete("/goals/{timeframe}")
def delete_goal(timeframe: str, db: Session = Depends(get_db), current_user: AuthUser = Depends(get_current_user)):
    try:
        tf = TimeframeType[timeframe]
    except KeyError:
        raise HTTPException(status_code=400, detail="Invalid timeframe")
    
    db_goal = db.query(Goal).filter(Goal.timeframe == tf, Goal.user_id == current_user.id).first()
    if not db_goal:
        # Return success even if goal doesn't exist (idempotent delete)
        return {"message": "Goal deleted"}
    
    db.delete(db_goal)
    db.commit()
    return {"message": "Goal deleted"}

# ── Per-date daily goals ──────────────────────────────────────────────────────
# Each EST calendar date owns an independent DailyGoal row, so editing one
# day's goal can never modify another day's. The legacy timeframe=TODAY row is
# the *inherited default*: dates with no explicit row fall back to it (lossless
# migration — pre-existing goals keep displaying unchanged until a date is
# explicitly edited). Editing TODAY's date also updates the default so future
# days inherit the new value; editing any OTHER date touches only that date.

from datetime import date as date_type
from backend.models import DailyGoal
from backend.services.period import get_est_today_date, user_tz_name
from pydantic import BaseModel
from decimal import Decimal as _Decimal

class DailyGoalUpdate(BaseModel):
    target_profit: _Decimal

def _parse_iso_date(s: str) -> date_type:
    try:
        return date_type.fromisoformat(s)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date (expected YYYY-MM-DD)")

def _daily_goal_json(row: DailyGoal, inherited: bool = False) -> dict:
    return {
        "id": row.id,
        "timeframe": "TODAY",  # legacy shape compat for the mobile Goal type
        "goal_date": row.goal_date.isoformat() if getattr(row, "goal_date", None) else None,
        "target_profit": float(row.target_profit),
        "goal_name": row.goal_name,
        "inherited": inherited,
        "created_at": row.created_at.isoformat(),
        "updated_at": row.updated_at.isoformat(),
    }

@router.get("/goals/daily/{goal_date}")
def get_daily_goal(goal_date: str, db: Session = Depends(get_db), current_user: AuthUser = Depends(get_current_user)):
    d = _parse_iso_date(goal_date)
    row = db.query(DailyGoal).filter(DailyGoal.user_id == current_user.id, DailyGoal.goal_date == d).first()
    if row:
        return _daily_goal_json(row)
    # No explicit goal for this date → inherit the legacy TODAY default.
    legacy = db.query(Goal).filter(Goal.timeframe == TimeframeType.TODAY, Goal.user_id == current_user.id).first()
    if not legacy:
        return None
    return {
        "id": legacy.id,
        "timeframe": "TODAY",
        "goal_date": d.isoformat(),
        "target_profit": float(legacy.target_profit),
        "goal_name": legacy.goal_name,
        "inherited": True,
        "created_at": legacy.created_at.isoformat(),
        "updated_at": legacy.updated_at.isoformat(),
    }

@router.put("/goals/daily/{goal_date}")
def upsert_daily_goal(goal_date: str, payload: DailyGoalUpdate, db: Session = Depends(get_db), current_user: AuthUser = Depends(get_current_user)):
    d = _parse_iso_date(goal_date)
    row = db.query(DailyGoal).filter(DailyGoal.user_id == current_user.id, DailyGoal.goal_date == d).first()
    if row:
        row.target_profit = payload.target_profit
    else:
        row = DailyGoal(user_id=current_user.id, goal_date=d, target_profit=payload.target_profit, goal_name="Daily Goal")
        db.add(row)
    # Editing TODAY also rolls the inherited default forward so future dates
    # (which have no explicit row yet) pick up the new value. Past/future date
    # edits deliberately do NOT touch the default.
    if d == get_est_today_date(user_tz_name(current_user)):
        legacy = db.query(Goal).filter(Goal.timeframe == TimeframeType.TODAY, Goal.user_id == current_user.id).first()
        if legacy:
            legacy.target_profit = payload.target_profit
        else:
            db.add(Goal(user_id=current_user.id, timeframe=TimeframeType.TODAY, target_profit=payload.target_profit, goal_name="Daily Goal"))
    db.commit()
    db.refresh(row)
    return _daily_goal_json(row)

@router.delete("/goals/daily/{goal_date}")
def delete_daily_goal(goal_date: str, db: Session = Depends(get_db), current_user: AuthUser = Depends(get_current_user)):
    d = _parse_iso_date(goal_date)
    row = db.query(DailyGoal).filter(DailyGoal.user_id == current_user.id, DailyGoal.goal_date == d).first()
    if row:
        db.delete(row)
        db.commit()
    return {"message": "Daily goal deleted"}
