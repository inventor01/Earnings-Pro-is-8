from fastapi import APIRouter, Depends, HTTPException, status, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session
from sqlalchemy import func
from backend.db import get_db
from backend.models import (
    AuthUser, Settings, Entry, EntryType, AppType, ExpenseCategory, Goal,
    TimeframeType, PasswordResetToken,
    Friend, Achievement, Congratulation,
    ApiCredential, SyncedOrder,
)
import secrets
from backend.auth import get_current_user, verify_prelaunch_token
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

# Rate limits on /auth/* endpoints. The limiter instance lives on app.state
# (configured in backend/app.py); slowapi resolves it via the `request` param
# that each decorated handler now accepts. Keys default to remote IP — keep
# values strict enough to throttle credential-stuffing and signup spam, loose
# enough that a real user retyping a password isn't locked out.
auth_limiter = Limiter(key_func=get_remote_address)

from backend.auth import SECRET_KEY, JWT_ALGORITHM

# Token lifetime — long enough for mobile users to stay signed in across days
# without re-auth, short enough that a leaked token has a bounded blast radius.
ACCESS_TOKEN_TTL = timedelta(days=30)

class LoginRequest(BaseModel):
    credential: str
    password: str

# If PRELAUNCH_ACCESS_CODE is set in the environment, /api/auth/signup and
# /api/auth/demo require a valid prelaunch_token issued by
# /api/waitlist/verify-access. Set it to an empty string to disable the gate.
_PRELAUNCH_ACCESS_CODE = os.getenv("PRELAUNCH_ACCESS_CODE", "")


def _require_prelaunch_token(prelaunch_token: Optional[str]) -> None:
    """Raise 403 if prelaunch mode is active and token is missing or invalid."""
    if not _PRELAUNCH_ACCESS_CODE:
        return
    if not verify_prelaunch_token(prelaunch_token or ""):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="A valid prelaunch access token is required to sign up.",
        )


class SignupRequest(BaseModel):
    email: str
    password: str
    username: Optional[str] = None
    # Signed token issued by /api/waitlist/verify-access. Required when the
    # server has PRELAUNCH_ACCESS_CODE configured; ignored otherwise.
    prelaunch_token: Optional[str] = None

class AuthResponse(BaseModel):
    access_token: str
    token_type: str
    user_id: str
    email: str

class ForgotPasswordRequest(BaseModel):
    email: str

class AppleSignInRequest(BaseModel):
    # `identity_token` is the JWT issued by Apple's Sign In with Apple flow
    # (returned by expo-apple-authentication's `signInAsync`). We verify it
    # server-side against Apple's JWKS to confirm the user really signed in
    # with Apple — we never trust client-supplied `user`/`email` alone.
    identity_token: str
    # Apple only returns name on FIRST sign-in. The client should cache these
    # client-side after the first auth and forward them here so we can set
    # them on account creation. After that they're ignored.
    first_name: Optional[str] = None
    last_name: Optional[str] = None

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
    """Create a signed JWT with an expiration claim. The `exp` claim is required
    by `backend.auth.get_current_user` — tokens without it are rejected."""
    now = datetime.utcnow()
    payload = {
        "sub": user_id,
        "email": email,
        "iat": now,
        "exp": now + ACCESS_TOKEN_TTL,
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=JWT_ALGORITHM)

@router.post("/auth/signup", response_model=AuthResponse)
@auth_limiter.limit("5/hour")
async def signup(request: Request, body: SignupRequest, db: Session = Depends(get_db)):
    # `request` is required by slowapi; alias the legacy `request` body to `body`.
    _require_prelaunch_token(body.prelaunch_token)
    return await _signup(body, db)


async def _signup(request: SignupRequest, db: Session = Depends(get_db)):
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
@auth_limiter.limit("10/minute")
async def login(request: Request, body: LoginRequest, db: Session = Depends(get_db)):
    return await _login(body, db)


# Apple Sign In — verifies an Apple-issued identity token server-side and
# either creates a new AuthUser (id = `apple:{sub}`) or returns the
# existing one, then issues our HS256 access token. The Apple `sub` claim
# is a stable opaque identifier scoped to our bundle id (`aud`). Email may
# be a private relay address; that's fine, we store whatever Apple gives us.
APPLE_ISSUER = "https://appleid.apple.com"
APPLE_JWKS_URL = "https://appleid.apple.com/auth/keys"
# Match the iOS bundle id in earnings-ninja-expo/app.json.
APPLE_AUDIENCE = os.getenv("APPLE_AUDIENCE", "com.earningsninja.app")
_apple_jwk_client: Optional[jwt.PyJWKClient] = None


def _get_apple_jwk_client() -> jwt.PyJWKClient:
    global _apple_jwk_client
    if _apple_jwk_client is None:
        # PyJWKClient caches keys in-memory after first fetch; fine for our
        # request volume. cache_keys=True is the default.
        _apple_jwk_client = jwt.PyJWKClient(APPLE_JWKS_URL)
    return _apple_jwk_client


@router.post("/auth/apple", response_model=AuthResponse)
@auth_limiter.limit("20/minute")
async def apple_sign_in(request: Request, body: AppleSignInRequest, db: Session = Depends(get_db)):
    if not body.identity_token:
        raise HTTPException(status_code=400, detail="identity_token is required")

    # Resolve the signing key from Apple's JWKS by the token's kid header,
    # then verify signature + issuer + audience + expiration.
    try:
        client = _get_apple_jwk_client()
        signing_key = client.get_signing_key_from_jwt(body.identity_token)
        payload = jwt.decode(
            body.identity_token,
            signing_key.key,
            algorithms=["ES256", "RS256"],
            audience=APPLE_AUDIENCE,
            issuer=APPLE_ISSUER,
            options={"require": ["sub", "exp", "iss", "aud"]},
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Apple identity token expired")
    except jwt.InvalidAudienceError:
        raise HTTPException(status_code=401, detail="Apple token audience mismatch")
    except jwt.InvalidIssuerError:
        raise HTTPException(status_code=401, detail="Apple token issuer mismatch")
    except Exception as e:
        # Any other failure (bad signature, malformed, JWKS unreachable) —
        # treat as auth failure, don't leak details to the client.
        import logging
        logging.getLogger(__name__).warning(f"Apple SIWA token verification failed: {e}")
        raise HTTPException(status_code=401, detail="Invalid Apple identity token")

    apple_sub = payload["sub"]
    email = payload.get("email")
    # Apple sends `email_verified` as either bool True or the string "true".
    email_verified = payload.get("email_verified") in (True, "true")
    user_id = f"apple:{apple_sub}"

    # Find by apple sub first — this is the only stable identifier we should
    # ever auto-link on. Do NOT fall back to email match: an attacker who
    # registers a Sign In with Apple identity could otherwise hijack an
    # existing email/password account whose email happens to match. Even
    # though Apple verifies the email before issuing a token, an existing
    # email/password account is a separate identity we must not silently
    # take over. Users who want to merge accounts must do so via an
    # explicit, authenticated link flow (future work).
    user = db.query(AuthUser).filter(AuthUser.id == user_id).first()

    if not user:
        # If an existing AuthUser already owns this email, we can't insert a
        # new row with the same value (AuthUser.email has UNIQUE). Drop the
        # email on the new Apple-keyed account; the user can set it later
        # from settings. This preserves account separation without 500ing.
        email_to_store = email if email_verified else None
        if email_to_store:
            collision = db.query(AuthUser).filter(AuthUser.email == email_to_store).first()
            if collision:
                email_to_store = None
        user = AuthUser(
            id=user_id,
            email=email_to_store,
            first_name=body.first_name,
            last_name=body.last_name,
            is_demo=False,
        )
        db.add(user)
        db.flush()
        # Seed default goals so the dashboard isn't empty on first launch.
        db.add(Goal(user_id=user.id, timeframe=TimeframeType.TODAY,      target_profit=Decimal("200.00"),  goal_name="Daily Goal"))
        db.add(Goal(user_id=user.id, timeframe=TimeframeType.THIS_WEEK,  target_profit=Decimal("1400.00"), goal_name="Weekly Goal"))
        db.add(Goal(user_id=user.id, timeframe=TimeframeType.THIS_MONTH, target_profit=Decimal("6000.00"), goal_name="Monthly Goal"))
        db.commit()
        db.refresh(user)

    token = create_access_token(user.id, user.email or "")
    return {
        "access_token": token,
        "token_type": "bearer",
        "user_id": user.id,
        "email": user.email or "",
    }


async def _login(request: LoginRequest, db: Session = Depends(get_db)):
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
@auth_limiter.limit("5/hour")
async def forgot_password(request: Request, body: ForgotPasswordRequest, db: Session = Depends(get_db)):
    return await _forgot_password(body, db)


async def _forgot_password(request: ForgotPasswordRequest, db: Session = Depends(get_db)):
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

class DemoRequest(BaseModel):
    # Signed token issued by /api/waitlist/verify-access. Required when the
    # server has PRELAUNCH_ACCESS_CODE configured; ignored otherwise.
    prelaunch_token: Optional[str] = None


@router.post("/auth/demo", response_model=AuthResponse)
async def create_demo_session(body: DemoRequest = DemoRequest(), db: Session = Depends(get_db)):
    """Create a unique demo session with isolated data and preloaded transactions.

    Each demo session gets its own temporary user ID with realistic demo data
    showing the last 60 days of delivery driver transactions (fills multiple calendar months).
    """
    _require_prelaunch_token(body.prelaunch_token)
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


@router.delete("/auth/account")
async def delete_account(
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Permanently delete the authenticated user's account and all associated data.

    Required by Apple App Store Guideline 5.1.1(v): apps that support account creation
    must also provide an in-app way for users to delete their account.

    Cascades through every table that references auth_users.id so no orphan rows remain.
    """
    user_id = current_user.id

    # Delete all rows in tables that have a user_id FK to auth_users.id.
    # SyncedOrder and ApiCredential must be removed before AuthUser to satisfy
    # FK constraints and to ensure OAuth tokens and synced order data (including
    # raw_data payloads) are fully purged on account deletion.
    db.query(Congratulation).filter(
        (Congratulation.from_user_id == user_id) | (Congratulation.to_user_id == user_id)
    ).delete(synchronize_session=False)
    db.query(Friend).filter(
        (Friend.user_id == user_id) | (Friend.friend_id == user_id)
    ).delete(synchronize_session=False)
    db.query(Achievement).filter(Achievement.user_id == user_id).delete(synchronize_session=False)
    db.query(Goal).filter(Goal.user_id == user_id).delete(synchronize_session=False)
    db.query(Settings).filter(Settings.user_id == user_id).delete(synchronize_session=False)
    db.query(Entry).filter(Entry.user_id == user_id).delete(synchronize_session=False)
    db.query(PasswordResetToken).filter(PasswordResetToken.user_id == user_id).delete(synchronize_session=False)
    # Purge OAuth credentials and synced order history so no third-party tokens
    # or raw platform data outlive the account, and the hourly background sync
    # cannot use retained credentials after deletion.
    db.query(SyncedOrder).filter(SyncedOrder.user_id == user_id).delete(synchronize_session=False)
    db.query(ApiCredential).filter(ApiCredential.user_id == user_id).delete(synchronize_session=False)
    db.query(AuthUser).filter(AuthUser.id == user_id).delete(synchronize_session=False)

    db.commit()
    return {"deleted": True, "user_id": user_id}
