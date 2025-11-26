from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc, or_
from backend.db import get_db
from backend.models import AuthUser, Friend, Achievement, Congratulation, Entry, EntryType
from backend.auth import get_current_user
from pydantic import BaseModel
from datetime import datetime, timedelta
from decimal import Decimal
from typing import List, Optional

router = APIRouter()

class UserLeaderboardItem(BaseModel):
    id: str
    username: str
    email: str
    points: int
    daily_streak: int
    total_earnings: float
    is_friend: bool = False
    profile_image_url: Optional[str] = None

class AddFriendRequest(BaseModel):
    friend_email_or_username: str

class SendCongratRequest(BaseModel):
    friend_id: str
    message: str = ""

class LeaderboardResponse(BaseModel):
    leaderboard: List[UserLeaderboardItem]
    friends: List[UserLeaderboardItem]
    achievements: list

def calculate_user_points(db: Session, user_id: str) -> int:
    """Calculate points based on earnings and streak"""
    entries = db.query(Entry).filter(Entry.user_id == user_id).all()
    total_earnings = sum(float(e.amount) for e in entries if float(e.amount) > 0)
    points = int(total_earnings) + (len(entries) * 10)
    return points

def calculate_total_earnings(db: Session, user_id: str) -> float:
    """Calculate total earnings for user"""
    entries = db.query(Entry).filter(
        Entry.user_id == user_id,
        Entry.type == EntryType.ORDER
    ).all()
    return float(sum(float(e.amount) for e in entries))

@router.get("/leaderboard")
async def get_leaderboard(current_user: AuthUser = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get leaderboard with friends and achievements"""
    
    # Get all users except current user and guest
    all_users = db.query(AuthUser).filter(
        AuthUser.id != current_user.id,
        AuthUser.id != "default-user"
    ).all()
    
    # Build leaderboard
    leaderboard_items = []
    for user in all_users:
        points = calculate_user_points(db, user.id)
        earnings = calculate_total_earnings(db, user.id)
        
        # Check if friend
        friend = db.query(Friend).filter(
            Friend.user_id == current_user.id,
            Friend.friend_id == user.id,
            Friend.status == "accepted"
        ).first()
        
        username = user.first_name if user.first_name else user.email
        leaderboard_items.append(UserLeaderboardItem(
            id=user.id,
            username=username,
            email=user.email or "",
            points=points,
            daily_streak=0,
            total_earnings=earnings,
            is_friend=friend is not None,
            profile_image_url=user.profile_image_url
        ))
    
    # Sort by points
    leaderboard_items.sort(key=lambda x: x.points, reverse=True)
    
    # Get current user's friends
    friend_records = db.query(Friend).filter(
        Friend.user_id == current_user.id,
        Friend.status == "accepted"
    ).all()
    
    friend_ids = [f.friend_id for f in friend_records]
    friends = [item for item in leaderboard_items if item.id in friend_ids]
    friends.sort(key=lambda x: x.points, reverse=True)
    
    # Get achievements
    achievements = db.query(Achievement).filter(Achievement.user_id == current_user.id).all()
    
    return {
        "leaderboard": leaderboard_items[:50],
        "friends": friends,
        "achievements": [{"title": a.title, "description": a.description, "icon": a.icon} for a in achievements]
    }

@router.post("/leaderboard/add-friend")
async def add_friend(request: AddFriendRequest, current_user: AuthUser = Depends(get_current_user), db: Session = Depends(get_db)):
    """Add a friend by email or username"""
    
    # Find user by email or username (first_name)
    friend = db.query(AuthUser).filter(
        or_(
            AuthUser.email == request.friend_email_or_username,
            AuthUser.first_name == request.friend_email_or_username
        )
    ).first()
    
    if not friend:
        raise HTTPException(status_code=404, detail="User not found")
    
    if friend.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot add yourself")
    
    # Check if already friends
    existing = db.query(Friend).filter(
        Friend.user_id == current_user.id,
        Friend.friend_id == friend.id
    ).first()
    
    if existing:
        if existing.status == "accepted":
            raise HTTPException(status_code=400, detail="Already friends")
        existing.status = "accepted"
    else:
        new_friend = Friend(
            user_id=current_user.id,
            friend_id=friend.id,
            status="accepted"
        )
        # Also add reverse friendship
        reverse_friend = Friend(
            user_id=friend.id,
            friend_id=current_user.id,
            status="accepted"
        )
        db.add(new_friend)
        db.add(reverse_friend)
    
    db.commit()
    return {"success": True, "message": "Friend added"}

@router.post("/leaderboard/send-congrats")
async def send_congratulations(request: SendCongratRequest, current_user: AuthUser = Depends(get_current_user), db: Session = Depends(get_db)):
    """Send congratulations to a friend"""
    
    friend = db.query(AuthUser).filter(AuthUser.id == request.friend_id).first()
    if not friend:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if they're friends
    friend_record = db.query(Friend).filter(
        Friend.user_id == current_user.id,
        Friend.friend_id == request.friend_id,
        Friend.status == "accepted"
    ).first()
    
    if not friend_record:
        raise HTTPException(status_code=403, detail="Must be friends to send congratulations")
    
    congrats = Congratulation(
        from_user_id=current_user.id,
        to_user_id=request.friend_id,
        message=request.message or "Great job! 🎉"
    )
    db.add(congrats)
    db.commit()
    
    return {"success": True, "message": "Congratulations sent"}

@router.get("/leaderboard/recent-congrats")
async def get_recent_congrats(current_user: AuthUser = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get recent congratulations received"""
    
    congrats = db.query(Congratulation).filter(
        Congratulation.to_user_id == current_user.id
    ).order_by(desc(Congratulation.created_at)).limit(10).all()
    
    result = []
    for c in congrats:
        from_user = db.query(AuthUser).filter(AuthUser.id == c.from_user_id).first()
        if from_user:
            result.append({
                "from_username": from_user.first_name or from_user.email,
                "message": c.message,
                "created_at": c.created_at
            })
    
    return {"congrats": result}
