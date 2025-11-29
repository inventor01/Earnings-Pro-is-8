from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime
from calendar import monthrange
from decimal import Decimal
from backend.db import get_db
from backend.models import Goal, TimeframeType, AuthUser
from backend.schemas import GoalCreate, GoalUpdate, GoalResponse
from backend.auth import get_current_user

router = APIRouter()

def calculate_daily_goal(monthly_profit: Decimal) -> Decimal:
    """Calculate daily goal based on monthly goal divided by days in current month"""
    now = datetime.utcnow()
    days_in_month = monthrange(now.year, now.month)[1]
    daily_goal = monthly_profit / Decimal(days_in_month)
    return daily_goal.quantize(Decimal('0.01'))

def auto_create_daily_goal(db: Session, monthly_goal: Goal, user_id: str):
    """Automatically create or update TODAY goal based on monthly goal"""
    daily_goal_amount = calculate_daily_goal(Decimal(str(monthly_goal.target_profit)))
    
    existing_daily = db.query(Goal).filter(Goal.timeframe == TimeframeType.TODAY, Goal.user_id == user_id).first()
    if existing_daily:
        existing_daily.target_profit = daily_goal_amount
    else:
        existing_daily = Goal(user_id=user_id, timeframe=TimeframeType.TODAY, target_profit=daily_goal_amount)
        db.add(existing_daily)
    
    db.commit()
    db.refresh(existing_daily)

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
    
    # If monthly goal is updated, auto-create daily goal
    if existing.timeframe == TimeframeType.THIS_MONTH:
        auto_create_daily_goal(db, existing, current_user.id)
    
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
    
    # If monthly goal is updated, auto-create daily goal
    if db_goal.timeframe == TimeframeType.THIS_MONTH:
        auto_create_daily_goal(db, db_goal, current_user.id)
    
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
