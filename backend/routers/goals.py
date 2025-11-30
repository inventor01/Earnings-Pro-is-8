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
