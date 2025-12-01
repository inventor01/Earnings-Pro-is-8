from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.db import get_db
from backend.models import AuthUser, Settings, Entry, EntryType, AppType, ExpenseCategory
from backend.auth import get_current_user
import jwt
import os
from typing import Dict, Optional
from pydantic import BaseModel
import bcrypt
import uuid
from decimal import Decimal
from datetime import datetime, timedelta
import random

router = APIRouter()

SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "your-secret-key-change-in-production")

class LoginRequest(BaseModel):
    credential: str
    password: str

class SignupRequest(BaseModel):
    email: str
    password: str
    username: Optional[str] = None

class AuthResponse(BaseModel):
    access_token: str
    token_type: str
    user_id: str
    email: str

def hash_password(password: str) -> str:
    """Hash password using bcrypt (secure)"""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def verify_password(password: str, hash_value: str) -> bool:
    """Verify password against bcrypt hash"""
    try:
        return bcrypt.checkpw(password.encode('utf-8'), hash_value.encode('utf-8'))
    except Exception:
        return False

def create_access_token(user_id: str, email: str) -> str:
    """Create JWT token"""
    payload = {
        "sub": user_id,
        "email": email
    }
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")

@router.post("/auth/signup", response_model=AuthResponse)
async def signup(request: SignupRequest, db: Session = Depends(get_db)):
    """Sign up new user"""
    if not request.email or not request.password:
        raise HTTPException(status_code=400, detail="Email and password are required")
    
    # Check if user exists
    existing_user = db.query(AuthUser).filter(AuthUser.email == request.email).first()
    if existing_user:
        raise HTTPException(status_code=409, detail="Email already registered")
    
    # Create new user
    user_id = str(uuid.uuid4())
    user = AuthUser(
        id=user_id,
        email=request.email,
        password_hash=hash_password(request.password),
        first_name=request.username or "",
        last_name=""
    )
    db.add(user)
    db.flush()
    
    # Auto-create settings for new user
    settings = Settings(user_id=user_id, cost_per_mile=Decimal("0.00"))
    db.add(settings)
    db.commit()
    db.refresh(user)
    
    token = create_access_token(user.id, user.email)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user_id": user.id,
        "email": user.email
    }

@router.post("/auth/login", response_model=AuthResponse)
async def login(request: LoginRequest, db: Session = Depends(get_db)):
    """Login user - accepts email or username"""
    if not request.credential or not request.password:
        raise HTTPException(status_code=400, detail="Email/username and password are required")
    
    # Try to find user by email OR username (username is stored in first_name)
    user = db.query(AuthUser).filter(
        (AuthUser.email == request.credential) | (AuthUser.first_name == request.credential)
    ).first()
    
    if not user or not user.password_hash:
        raise HTTPException(status_code=401, detail="Invalid email, username, or password")
    
    if not verify_password(request.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email, username, or password")
    
    token = create_access_token(user.id, user.email)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user_id": user.id,
        "email": user.email
    }

@router.get("/auth/me")
async def get_current_user_info(current_user: AuthUser = Depends(get_current_user)) -> Dict:
    """Get current authenticated user info"""
    return {
        "id": current_user.id,
        "email": current_user.email,
        "first_name": current_user.first_name,
        "last_name": current_user.last_name,
        "profile_image_url": current_user.profile_image_url
    }

@router.post("/auth/validate-token")
async def validate_token(current_user: AuthUser = Depends(get_current_user)) -> Dict:
    """Validate that the provided token is valid"""
    return {
        "valid": True,
        "user_id": current_user.id,
        "email": current_user.email
    }

def create_demo_transactions(db: Session, user_id: str):
    """Generate realistic demo transactions for the past 60 days"""
    apps = [AppType.DOORDASH, AppType.UBEREATS, AppType.INSTACART, AppType.GRUBHUB]
    expense_categories = [ExpenseCategory.GAS, ExpenseCategory.PARKING, ExpenseCategory.FOOD]
    
    now = datetime.utcnow()
    
    # Create transactions for the past 60 days (fills multiple calendar months with data)
    for day_offset in range(60):
        day = now - timedelta(days=day_offset)
        # Reset to start of day
        day = day.replace(hour=0, minute=0, second=0, microsecond=0)
        
        # 5-10 orders per day
        num_orders = random.randint(5, 10)
        for _ in range(num_orders):
            order_time = day + timedelta(hours=random.randint(7, 22), minutes=random.randint(0, 59))
            
            entry = Entry(
                user_id=user_id,
                timestamp=order_time,
                type=EntryType.ORDER,
                app=random.choice(apps),
                amount=Decimal(str(round(random.uniform(8.00, 35.00), 2))),
                distance_miles=round(random.uniform(0.5, 8.0), 1),
                duration_minutes=random.randint(10, 60),
                order_id=str(uuid.uuid4())[:12]
            )
            db.add(entry)
        
        # 1-2 expenses per day
        num_expenses = random.randint(1, 2)
        for _ in range(num_expenses):
            expense_time = day + timedelta(hours=random.randint(7, 22), minutes=random.randint(0, 59))
            
            entry = Entry(
                user_id=user_id,
                timestamp=expense_time,
                type=EntryType.EXPENSE,
                app=AppType.OTHER,
                amount=Decimal(str(-round(random.uniform(3.00, 15.00), 2))),
                category=random.choice(expense_categories),
                note="Demo expense"
            )
            db.add(entry)
    
    db.commit()

@router.post("/auth/demo", response_model=AuthResponse)
async def create_demo_session(db: Session = Depends(get_db)):
    """Create a unique demo session with isolated data and preloaded transactions
    
    Each demo session gets its own temporary user ID with realistic demo data
    showing the last 60 days of delivery driver transactions (fills multiple calendar months).
    """
    demo_session_id = str(uuid.uuid4())
    demo_email = f"demo-{demo_session_id[:8]}@demo.local"
    
    user = AuthUser(
        id=demo_session_id,
        email=demo_email,
        first_name="Demo User",
        last_name="",
        is_demo=True
    )
    db.add(user)
    db.flush()
    
    settings = Settings(user_id=demo_session_id, cost_per_mile=Decimal("0.75"))
    db.add(settings)
    db.flush()
    
    # Create preloaded demo transactions
    create_demo_transactions(db, demo_session_id)
    
    db.commit()
    db.refresh(user)
    
    token = create_access_token(user.id, user.email)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user_id": user.id,
        "email": user.email
    }
