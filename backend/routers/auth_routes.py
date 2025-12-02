from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from backend.db import get_db
from backend.models import AuthUser, Settings, Entry, EntryType, AppType, ExpenseCategory, Goal, TimeframeType, PasswordResetToken
import secrets
from backend.auth import get_current_user
from backend.services.email_service import send_password_reset_email
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

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

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
    
    # Check if email already exists
    existing_email = db.query(AuthUser).filter(AuthUser.email == request.email).first()
    if existing_email:
        raise HTTPException(status_code=409, detail="Email already registered")
    
    # Check if username already exists (case-insensitive)
    username = request.username.strip() if request.username else ""
    if username:
        existing_username = db.query(AuthUser).filter(
            func.lower(AuthUser.first_name) == username.lower(),
            AuthUser.is_demo == False
        ).first()
        if existing_username:
            raise HTTPException(status_code=409, detail="Username already taken")
    
    # Create new user
    user_id = str(uuid.uuid4())
    user = AuthUser(
        id=user_id,
        email=request.email,
        password_hash=hash_password(request.password),
        first_name=username,
        last_name=""
    )
    db.add(user)
    db.flush()
    
    # Auto-create settings for new user
    settings = Settings(user_id=user_id, cost_per_mile=Decimal("0.00"))
    db.add(settings)
    db.flush()
    
    # Create default goals for regular user (like demo users get)
    # These persist every day until the user changes them
    daily_goal = Goal(user_id=user_id, timeframe=TimeframeType.TODAY, target_profit=Decimal("200.00"), goal_name="Daily Goal")
    weekly_goal = Goal(user_id=user_id, timeframe=TimeframeType.THIS_WEEK, target_profit=Decimal("1400.00"), goal_name="Weekly Goal")
    monthly_goal = Goal(user_id=user_id, timeframe=TimeframeType.THIS_MONTH, target_profit=Decimal("6000.00"), goal_name="Monthly Goal")
    db.add(daily_goal)
    db.add(weekly_goal)
    db.add(monthly_goal)
    
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
    
    credential = request.credential.strip()
    
    # Try to find user by email first (case-sensitive for email)
    user = db.query(AuthUser).filter(AuthUser.email == credential).first()
    
    # If not found by email, try by username (case-insensitive)
    if not user:
        user = db.query(AuthUser).filter(
            func.lower(AuthUser.first_name) == credential.lower(),
            AuthUser.first_name != "",
            AuthUser.is_demo == False
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

@router.post("/auth/forgot-password")
async def forgot_password(request: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """Request a password reset link"""
    email = request.email.strip()
    
    # Find user by email case-insensitively (excluding demo users)
    user = db.query(AuthUser).filter(
        func.lower(AuthUser.email) == email.lower(),
        AuthUser.is_demo == False
    ).first()
    
    # Always return success to prevent email enumeration attacks
    if not user:
        return {"message": "If an account with that email exists, a password reset link has been sent."}
    
    # Invalidate any existing reset tokens for this user
    db.query(PasswordResetToken).filter(
        PasswordResetToken.user_id == user.id,
        PasswordResetToken.used == False
    ).update({"used": True})
    
    # Generate a secure reset token
    reset_token = secrets.token_urlsafe(32)
    
    # Create reset token (expires in 1 hour)
    token_record = PasswordResetToken(
        user_id=user.id,
        token=reset_token,
        expires_at=datetime.utcnow() + timedelta(hours=1)
    )
    db.add(token_record)
    db.commit()
    
    # Send password reset email
    await send_password_reset_email(
        to_email=user.email,
        reset_token=reset_token,
        user_name=user.first_name
    )
    
    return {"message": "If an account with that email exists, a password reset link has been sent."}

@router.post("/auth/reset-password")
async def reset_password(request: ResetPasswordRequest, db: Session = Depends(get_db)):
    """Reset password using a valid reset token"""
    # Find the token
    token_record = db.query(PasswordResetToken).filter(
        PasswordResetToken.token == request.token,
        PasswordResetToken.used == False
    ).first()
    
    if not token_record:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    
    # Check if token is expired
    if datetime.utcnow() > token_record.expires_at:
        token_record.used = True
        db.commit()
        raise HTTPException(status_code=400, detail="Reset token has expired")
    
    # Validate new password
    if len(request.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    
    # Find the user
    user = db.query(AuthUser).filter(AuthUser.id == token_record.user_id).first()
    if not user:
        raise HTTPException(status_code=400, detail="User not found")
    
    # Update password
    user.password_hash = hash_password(request.new_password)
    
    # Mark token as used
    token_record.used = True
    
    db.commit()
    
    return {"message": "Password has been reset successfully"}

@router.get("/auth/verify-reset-token/{token}")
async def verify_reset_token(token: str, db: Session = Depends(get_db)):
    """Verify if a reset token is valid"""
    token_record = db.query(PasswordResetToken).filter(
        PasswordResetToken.token == token,
        PasswordResetToken.used == False
    ).first()
    
    if not token_record:
        return {"valid": False, "message": "Invalid reset token"}
    
    if datetime.utcnow() > token_record.expires_at:
        return {"valid": False, "message": "Reset token has expired"}
    
    return {"valid": True}

def create_demo_transactions(db: Session, user_id: str):
    """Generate realistic demo transactions for the past 60 days (EST timezone aware)
    
    Each day guaranteed to have minimum $200 profit with varying amounts ($200-$500)
    """
    apps = [AppType.DOORDASH, AppType.UBEREATS, AppType.INSTACART, AppType.GRUBHUB]
    expense_categories = [ExpenseCategory.GAS, ExpenseCategory.PARKING, ExpenseCategory.FOOD]
    
    # Get today's date in EST (frontend's reference timezone)
    import pytz
    est = pytz.timezone('America/New_York')
    today_est = datetime.now(est).date()
    
    # Create transactions for the past 60 days (EST dates)
    for day_offset in range(60):
        # Calculate target EST date
        target_est_date = today_est - timedelta(days=day_offset)
        
        # Determine target daily profit: minimum $200, varying up to $500
        target_daily_profit = random.uniform(200.00, 500.00)
        
        # Generate 6-12 orders to hit revenue targets
        num_orders = random.randint(6, 12)
        total_revenue = 0
        
        for _ in range(num_orders):
            # Create time in EST timezone
            hour = random.randint(7, 22)
            minute = random.randint(0, 59)
            est_datetime = est.localize(datetime(target_est_date.year, target_est_date.month, target_est_date.day, hour, minute, 0))
            # Convert to UTC for storage
            utc_datetime = est_datetime.astimezone(pytz.UTC)
            
            # Order amounts between $12-$45 for realistic earnings
            order_amount = round(random.uniform(12.00, 45.00), 2)
            total_revenue += order_amount
            
            entry = Entry(
                user_id=user_id,
                timestamp=utc_datetime,
                type=EntryType.ORDER,
                app=random.choice(apps),
                amount=Decimal(str(order_amount)),
                distance_miles=round(random.uniform(0.5, 8.0), 1),
                duration_minutes=random.randint(10, 60),
                order_id=str(uuid.uuid4())[:12]
            )
            db.add(entry)
        
        # Calculate expenses to hit target profit
        # Expenses should be: revenue - target_profit
        ideal_expenses = total_revenue - target_daily_profit
        
        # Ensure minimum expense requirements based on profit level
        if target_daily_profit > 320.00:
            # If profit > $320, ensure $60 minimum for total expenses
            min_daily_expenses = 60.00
            min_gas_expense = 50.00  # Gas should be $50-$70
        elif target_daily_profit > 200.00:
            # If profit > $200, ensure $45 minimum for gas
            min_daily_expenses = 20.00
            min_gas_expense = 45.00
        else:
            # Regular: $5-$15 for gas, $20 minimum total
            min_daily_expenses = 20.00
            min_gas_expense = 5.00
        
        # Ensure we meet minimum expense requirements
        if ideal_expenses < min_daily_expenses:
            ideal_expenses = min_daily_expenses
        
        # Generate 2-4 realistic expenses
        num_expenses = random.randint(2, 4)
        remaining_expenses = ideal_expenses
        
        for i in range(num_expenses):
            hour = random.randint(7, 22)
            minute = random.randint(0, 59)
            est_datetime = est.localize(datetime(target_est_date.year, target_est_date.month, target_est_date.day, hour, minute, 0))
            utc_datetime = est_datetime.astimezone(pytz.UTC)
            
            # First expense is always GAS with minimum requirement
            if i == 0:
                if target_daily_profit > 320.00:
                    # Profit > $320: gas should be $50-$70
                    expense_amount = round(random.uniform(50.00, 70.00), 2)
                elif target_daily_profit > 200.00:
                    # Profit > $200: gas should be $45-$60
                    expense_amount = round(random.uniform(45.00, 60.00), 2)
                else:
                    # Regular: gas can be $5-$15
                    expense_amount = round(random.uniform(5.00, 15.00), 2)
                category = ExpenseCategory.GAS
            else:
                # Remaining expenses distributed among other categories
                remaining_for_others = remaining_expenses - expense_amount
                if i == num_expenses - 1:
                    # Last expense gets remaining amount
                    expense_amount = remaining_for_others
                else:
                    # Distribute remaining expenses
                    expense_amount = round(remaining_for_others / (num_expenses - i) * random.uniform(0.8, 1.2), 2)
                    expense_amount = min(expense_amount, remaining_for_others - 1)
                
                expense_amount = max(1.00, min(expense_amount, 20.00))
                category = random.choice([ExpenseCategory.PARKING, ExpenseCategory.FOOD])
            
            remaining_expenses -= expense_amount
            
            entry = Entry(
                user_id=user_id,
                timestamp=utc_datetime,
                type=EntryType.EXPENSE,
                app=AppType.OTHER,
                amount=Decimal(str(-expense_amount)),
                category=category,
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
    
    # Create default goals for demo account
    daily_goal = Goal(user_id=demo_session_id, timeframe=TimeframeType.TODAY, target_profit=Decimal("200.00"), goal_name="Daily Goal")
    weekly_goal = Goal(user_id=demo_session_id, timeframe=TimeframeType.THIS_WEEK, target_profit=Decimal("1400.00"), goal_name="Weekly Goal")
    monthly_goal = Goal(user_id=demo_session_id, timeframe=TimeframeType.THIS_MONTH, target_profit=Decimal("6000.00"), goal_name="Monthly Goal")
    db.add(daily_goal)
    db.add(weekly_goal)
    db.add(monthly_goal)
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
