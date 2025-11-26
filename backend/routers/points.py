from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime, date
from backend.db import get_db
from backend.models import User, DailyUsage

router = APIRouter()

SIGNUP_POINTS = 100
DAILY_POINTS = 10
STREAK_BONUS_MULTIPLIER = 1.5

REWARDS = [
    {"points": 100, "name": "Bronze Badge", "emoji": "🥉", "description": "100 points milestone"},
    {"points": 250, "name": "Silver Badge", "emoji": "🥈", "description": "250 points milestone"},
    {"points": 500, "name": "Gold Badge", "emoji": "🥇", "description": "500 points milestone"},
    {"points": 1000, "name": "Platinum Badge", "emoji": "💎", "description": "1000 points milestone"},
    {"points": 5, "name": "5-Day Streak", "emoji": "🔥", "description": "5 consecutive days"},
    {"points": 10, "name": "10-Day Streak", "emoji": "⚡", "description": "10 consecutive days"},
    {"points": 30, "name": "Monthly Master", "emoji": "👑", "description": "30 consecutive days"},
]

def get_or_create_user(db: Session) -> User:
    user = db.query(User).filter(User.id == 1).first()
    if not user:
        user = User(id=1, total_points=SIGNUP_POINTS)
        db.add(user)
        db.commit()
        db.refresh(user)
    return user

@router.get("/points/user")
async def get_user_points(db: Session = Depends(get_db)):
    user = get_or_create_user(db)
    
    unlocked_rewards = []
    for reward in REWARDS:
        if reward["points"] <= user.total_points:
            unlocked_rewards.append(reward)
    
    return {
        "total_points": user.total_points,
        "daily_streak": user.daily_streak,
        "signup_date": user.signup_date,
        "unlocked_rewards": unlocked_rewards,
        "all_rewards": REWARDS,
        "next_reward_points": next(
            (r["points"] for r in REWARDS if r["points"] > user.total_points),
            None
        )
    }

@router.post("/points/daily-check-in")
async def daily_check_in(db: Session = Depends(get_db)):
    user = get_or_create_user(db)
    today = date.today().isoformat()
    
    # Check if already checked in today
    existing_usage = db.query(DailyUsage).filter(DailyUsage.usage_date == today).first()
    if existing_usage:
        return {"message": "Already checked in today", "points_earned": 0}
    
    # Calculate streak and points
    yesterday = (date.today().replace(day=date.today().day - 1) if date.today().day > 1 
                 else date.today().replace(month=date.today().month - 1, day=28)).isoformat()
    
    streak_active = user.last_used_date == yesterday
    
    if streak_active:
        user.daily_streak += 1
    else:
        user.daily_streak = 1
    
    # Award points with streak bonus
    points_earned = int(DAILY_POINTS * (1 + (user.daily_streak - 1) * 0.1))
    user.total_points += points_earned
    user.last_used_date = today
    
    # Record daily usage
    daily_usage = DailyUsage(usage_date=today, points_earned=points_earned)
    db.add(daily_usage)
    db.commit()
    db.refresh(user)
    
    # Get newly unlocked rewards
    new_rewards = [r for r in REWARDS if r["points"] == user.total_points]
    
    return {
        "points_earned": points_earned,
        "total_points": user.total_points,
        "daily_streak": user.daily_streak,
        "new_rewards": new_rewards,
        "message": f"Great! +{points_earned} points (Streak: {user.daily_streak} days)"
    }

@router.get("/points/rewards")
async def get_rewards():
    return {"rewards": REWARDS}
