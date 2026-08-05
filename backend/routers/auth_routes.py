from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from backend.db import get_db
from backend.models import (
    AuthUser, Settings, Entry, EntryType, AppType, ExpenseCategory, Goal,
    TimeframeType, PasswordResetToken,
    Friend, Achievement, Congratulation,
    ApiCredential, SyncedOrder, Base,
)
import hashlib
import re
import secrets
from backend.auth import get_current_user, verify_prelaunch_token
from backend.services.email_service import (
    send_password_reset_email,
    send_mfa_code_email,
    send_email_verification_email,
    send_welcome_email,
)
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
    # Optional referral code the new driver was invited with (attribution only;
    # the free-month reward promotion was retired).
    referral_code: Optional[str] = None

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

def _hash_reset_token(token: str) -> str:
    """Reset tokens are stored ONLY as SHA-256 digests: a read-only DB leak must
    never expose a live account-takeover secret. The raw token exists solely in
    the emailed link; inbound tokens are hashed before lookup."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


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


# ---------------------------------------------------------------------------
# Email two-factor auth (opt-in)
# ---------------------------------------------------------------------------
MFA_CODE_TTL = timedelta(minutes=10)
# The challenge token outlives the code slightly so "Resend" still works after
# the first code expires without forcing the user back to the password screen.
# This window is anchored to the FIRST issue (iat0) and is NOT renewed by Resend,
# so the whole verification session has a hard ceiling.
MFA_CHALLENGE_TTL = timedelta(minutes=15)
MFA_MAX_ATTEMPTS = 5
# Resend mints a new code (each with its own MFA_MAX_ATTEMPTS budget). Capping the
# number of resends per session bounds total guesses to (MFA_MAX_RESENDS + 1) *
# MFA_MAX_ATTEMPTS against independent random codes — without this an attacker who
# already has the password could cycle Resend forever to brute the second factor.
MFA_MAX_RESENDS = 3


class MfaVerifyRequest(BaseModel):
    challenge_token: str
    code: str


class MfaResendRequest(BaseModel):
    challenge_token: str


class MfaDisableRequest(BaseModel):
    password: Optional[str] = None


def _mask_email(email: str) -> str:
    """`john@x.com` -> `j**n@x.com`. Shown to the user so they know which inbox
    to check without echoing the full address back over the wire."""
    try:
        local, domain = email.split("@", 1)
    except ValueError:
        return email
    if len(local) <= 2:
        masked = local[0] + "*"
    else:
        masked = local[0] + "*" * (len(local) - 2) + local[-1]
    return f"{masked}@{domain}"


def _generate_mfa_code() -> str:
    """Cryptographically-random 6-digit code (secrets, not random)."""
    return f"{secrets.randbelow(1000000):06d}"


async def _issue_mfa_challenge(
    user: AuthUser,
    purpose: str,
    db: Session,
    *,
    gen: int = 0,
    issued_at: Optional[datetime] = None,
) -> str:
    """Generate + email a fresh code, persist its bcrypt hash / ISO expiry /
    reset attempt counter on the user, and return a signed short-lived challenge
    token (`typ='mfa'`) that only /auth/mfa/verify accepts. `purpose` is 'login'
    (exchange for an access token) or 'enable' (flip mfa_enabled on).

    `gen` is the resend generation (0 = first code). `issued_at` anchors the
    challenge's expiry to the ORIGINAL issue so Resend can mint a new code but
    never extend the overall window — once `issued_at + MFA_CHALLENGE_TTL` passes
    the session is dead and the user must re-enter their password."""
    code = _generate_mfa_code()
    user.mfa_code_hash = hash_password(code)
    user.mfa_code_expires_at = (datetime.utcnow() + MFA_CODE_TTL).isoformat()
    user.mfa_code_attempts = 0
    db.commit()
    try:
        await send_mfa_code_email(user.email, code, user.first_name)
    except Exception as e:
        # Don't 500 on email failure — the user can hit Resend. Never log the code.
        print(f"[MFA] Failed to send code to {_mask_email(user.email or '')}: {e}")
    now = datetime.utcnow()
    origin = issued_at or now
    # Hard ceiling anchored to the first issue; clamp so we never mint an already-
    # expired token if Resend is hit right at the edge of the window.
    exp = origin + MFA_CHALLENGE_TTL
    if exp <= now:
        exp = now + timedelta(seconds=30)
    payload = {
        "sub": user.id,
        "typ": "mfa",
        "purpose": purpose,
        "gen": gen,
        "iat0": int(origin.timestamp()),
        "iat": now,
        "exp": exp,
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=JWT_ALGORITHM)


def _decode_mfa_challenge(token: str) -> Dict:
    """Decode + validate an MFA challenge token. Raises 400 on anything off."""
    try:
        payload = jwt.decode(
            token, SECRET_KEY, algorithms=[JWT_ALGORITHM], options={"require": ["sub", "exp"]}
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=400, detail="This verification session expired. Please sign in again.")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=400, detail="Invalid verification session.")
    if payload.get("typ") != "mfa":
        raise HTTPException(status_code=400, detail="Invalid verification session.")
    return payload


# ---------------------------------------------------------------------------
# Email confirmation (NON-blocking gentle nudge — code entered in-app like MFA)
# ---------------------------------------------------------------------------
# Codes live a full day because confirmation is optional and the app is usable
# meanwhile — the nudge can sit on the dashboard until the driver gets to it.
EMAIL_VERIFY_CODE_TTL = timedelta(hours=24)
EMAIL_VERIFY_MAX_ATTEMPTS = 5


class EmailVerifyRequest(BaseModel):
    code: str


async def _issue_email_verification(user: AuthUser, db: Session) -> Optional[str]:
    """Generate a fresh 6-digit confirmation code, persist its bcrypt hash / ISO
    expiry / reset attempt counter on the user, and return the plaintext code so
    the caller can email it (directly or via a background task). Returns None and
    does nothing for accounts that shouldn't be nudged (already verified, demo,
    or no email on file)."""
    if user.is_demo or not user.email or user.email_verified:
        return None
    code = _generate_mfa_code()
    user.email_verification_code_hash = hash_password(code)
    user.email_verification_expires_at = (datetime.utcnow() + EMAIL_VERIFY_CODE_TTL).isoformat()
    user.email_verification_attempts = 0
    db.commit()
    return code


@router.post("/auth/signup", response_model=AuthResponse)
@auth_limiter.limit("5/hour")
async def signup(
    request: Request,
    body: SignupRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    # `request` is required by slowapi; alias the legacy `request` body to `body`.
    _require_prelaunch_token(body.prelaunch_token)
    return await _signup(body, db, background_tasks)


async def _signup(
    request: SignupRequest,
    db: Session = Depends(get_db),
    background_tasks: Optional[BackgroundTasks] = None,
):
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

    # Apply a referral code if one was supplied. Best-effort: a bad code or a
    # RevenueCat hiccup must never block account creation.
    if request.referral_code:
        try:
            from backend.routers.referrals import apply_referral
            await apply_referral(db, user, request.referral_code)
        except Exception:
            db.rollback()

    # Email-confirmation nudge (NON-blocking) + welcome email, both right after
    # signup. Best-effort: a Resend hiccup must never break account creation, so
    # email-sending runs as a background task when one is available.
    try:
        verify_code = await _issue_email_verification(user, db)
        recipient = user.email
        first_name = user.first_name
        if recipient:
            if background_tasks is not None:
                background_tasks.add_task(send_welcome_email, recipient, first_name)
                if verify_code:
                    background_tasks.add_task(
                        send_email_verification_email, recipient, verify_code, first_name
                    )
            else:
                await send_welcome_email(recipient, first_name)
                if verify_code:
                    await send_email_verification_email(recipient, verify_code, first_name)
    except Exception as e:
        print(f"[Signup] Failed to queue welcome/verification email: {e}")

    token = create_access_token(user.id, user.email)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user_id": user.id,
        "email": user.email
    }

@router.post("/auth/login")
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
            # Apple has already verified the email it returns, so there's nothing
            # for us to nudge — mark it confirmed up front.
            email_verified=True,
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

    # Password is correct. If this user opted into email 2FA, withhold the access
    # token: email a code and return a challenge the client exchanges at
    # /auth/mfa/verify. Branching only AFTER the password check means we never
    # reveal whether MFA is on for an account the caller can't authenticate to.
    if user.mfa_enabled and user.email:
        challenge = await _issue_mfa_challenge(user, "login", db)
        return {
            "mfa_required": True,
            "challenge_token": challenge,
            "email": _mask_email(user.email),
        }

    token = create_access_token(user.id, user.email)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user_id": user.id,
        "email": user.email
    }


@router.post("/auth/mfa/verify")
@auth_limiter.limit("10/minute")
async def mfa_verify(request: Request, body: MfaVerifyRequest, db: Session = Depends(get_db)):
    """Exchange a challenge token + emailed code for an access token (login) or
    flip mfa_enabled on (enable). Enforces expiry + a 5-attempt cap per code."""
    payload = _decode_mfa_challenge(body.challenge_token)
    user = db.query(AuthUser).filter(AuthUser.id == str(payload.get("sub"))).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid verification session.")
    if not user.mfa_code_hash or not user.mfa_code_expires_at:
        raise HTTPException(status_code=400, detail="No code is pending. Please request a new one.")

    try:
        expires = datetime.fromisoformat(user.mfa_code_expires_at)
    except Exception:
        expires = datetime.utcnow() - timedelta(seconds=1)
    if datetime.utcnow() > expires:
        user.mfa_code_hash = None
        user.mfa_code_expires_at = None
        user.mfa_code_attempts = 0
        db.commit()
        raise HTTPException(status_code=400, detail="That code expired. Please request a new one.")

    if (user.mfa_code_attempts or 0) >= MFA_MAX_ATTEMPTS:
        user.mfa_code_hash = None
        user.mfa_code_expires_at = None
        user.mfa_code_attempts = 0
        db.commit()
        raise HTTPException(status_code=429, detail="Too many incorrect codes. Please request a new one.")

    code = (body.code or "").strip()
    if not verify_password(code, user.mfa_code_hash):
        user.mfa_code_attempts = (user.mfa_code_attempts or 0) + 1
        db.commit()
        remaining = max(0, MFA_MAX_ATTEMPTS - user.mfa_code_attempts)
        raise HTTPException(status_code=400, detail=f"Incorrect code. {remaining} attempt(s) left.")

    # Correct — consume the code so it can't be replayed.
    user.mfa_code_hash = None
    user.mfa_code_expires_at = None
    user.mfa_code_attempts = 0
    if payload.get("purpose") == "enable":
        user.mfa_enabled = True
        db.commit()
        return {"success": True, "mfa_enabled": True}

    db.commit()
    token = create_access_token(user.id, user.email)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user_id": user.id,
        "email": user.email,
    }


@router.post("/auth/mfa/resend")
@auth_limiter.limit("5/minute")
async def mfa_resend(request: Request, body: MfaResendRequest, db: Session = Depends(get_db)):
    """Issue a brand-new code for an in-flight challenge (login or enable).

    Capped at MFA_MAX_RESENDS per session and anchored to the original challenge
    window so Resend can't be cycled to defeat the per-code attempt cap."""
    payload = _decode_mfa_challenge(body.challenge_token)
    user = db.query(AuthUser).filter(AuthUser.id == str(payload.get("sub"))).first()
    if not user or not user.email:
        raise HTTPException(status_code=400, detail="Invalid verification session.")
    gen = int(payload.get("gen") or 0)
    if gen >= MFA_MAX_RESENDS:
        raise HTTPException(status_code=429, detail="Too many code requests. Please sign in again.")
    iat0 = payload.get("iat0")
    issued_at = datetime.utcfromtimestamp(iat0) if iat0 else None
    challenge = await _issue_mfa_challenge(
        user, payload.get("purpose") or "login", db, gen=gen + 1, issued_at=issued_at,
    )
    return {"challenge_token": challenge, "email": _mask_email(user.email)}


@router.get("/auth/mfa/status")
async def mfa_status(current_user: AuthUser = Depends(get_current_user)):
    return {"enabled": bool(current_user.mfa_enabled), "email": current_user.email}


@router.post("/auth/mfa/enable")
@auth_limiter.limit("5/minute")
async def mfa_enable(
    request: Request,
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Start enabling 2FA: email a confirmation code and return a challenge. The
    user must confirm via /auth/mfa/verify (purpose='enable') so we never turn on
    2FA for an inbox they can't actually receive mail at (lockout protection)."""
    if not current_user.email:
        raise HTTPException(status_code=400, detail="Add an email to your account before turning on two-factor.")
    if current_user.mfa_enabled:
        return {"already_enabled": True, "email": _mask_email(current_user.email)}
    challenge = await _issue_mfa_challenge(current_user, "enable", db)
    return {"challenge_token": challenge, "email": _mask_email(current_user.email)}


@router.post("/auth/mfa/disable")
async def mfa_disable(
    body: MfaDisableRequest,
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Turn off 2FA. Password-based accounts must re-enter their password so a
    stolen unlocked session can't silently strip the second factor."""
    if current_user.password_hash:
        if not body.password or not verify_password(body.password, current_user.password_hash):
            raise HTTPException(status_code=401, detail="Incorrect password.")
    current_user.mfa_enabled = False
    current_user.mfa_code_hash = None
    current_user.mfa_code_expires_at = None
    current_user.mfa_code_attempts = 0
    db.commit()
    return {"success": True, "mfa_enabled": False}


@router.get("/auth/me")
async def get_current_user_info(current_user: AuthUser = Depends(get_current_user)) -> Dict:
    """Get current authenticated user info"""
    return {
        "id": current_user.id,
        "email": current_user.email,
        "username": current_user.first_name,
        "first_name": current_user.first_name,
        "last_name": current_user.last_name,
        "profile_image_url": current_user.profile_image_url,
        "email_verified": bool(current_user.email_verified),
        "is_demo": bool(current_user.is_demo),
        "onboarding_completed": bool(current_user.onboarding_completed),
    }


@router.post("/auth/onboarding/complete")
async def complete_onboarding(
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict:
    """Mark the one-time onboarding funnel done for this account. Idempotent —
    synced server-side so a reinstall never re-onboards an existing user.

    Demo accounts persist too: each "Try Demo Mode" session mints a brand-new
    account (flag false), so the funnel still shows on every NEW demo session —
    but relaunching the app mid-session, or the persistent reviewer account,
    completes once and never re-runs (reviewer re-demos by resetting the flag)."""
    if not current_user.onboarding_completed:
        current_user.onboarding_completed = True
        db.commit()
    return {"onboarding_completed": True}


def _email_verification_needed(user: AuthUser) -> bool:
    """A confirmation nudge is only relevant for non-demo accounts that have an
    email on file and haven't confirmed it yet."""
    return bool(user.email) and not user.is_demo and not user.email_verified


@router.get("/auth/email/status")
async def email_verification_status(current_user: AuthUser = Depends(get_current_user)) -> Dict:
    """Lightweight poll for the in-app confirmation banner. `needs_verification`
    is the single flag the client uses to decide whether to show the nudge."""
    return {
        "email": current_user.email,
        "email_verified": bool(current_user.email_verified),
        "needs_verification": _email_verification_needed(current_user),
    }


@router.post("/auth/verify-email")
@auth_limiter.limit("10/minute")
async def verify_email(
    request: Request,
    body: EmailVerifyRequest,
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict:
    """Confirm the account email with the 6-digit code we sent. Idempotent for
    already-verified accounts. Enforces an attempt cap and expiry like MFA."""
    if current_user.email_verified:
        return {"email_verified": True, "needs_verification": False}
    if not current_user.email or current_user.is_demo:
        raise HTTPException(status_code=400, detail="This account doesn't need email confirmation.")

    code = (body.code or "").strip()
    if not code:
        raise HTTPException(status_code=400, detail="Enter the code from your email.")

    if not current_user.email_verification_code_hash or not current_user.email_verification_expires_at:
        raise HTTPException(status_code=400, detail="No active code. Tap resend to get a new one.")

    try:
        expires_at = datetime.fromisoformat(current_user.email_verification_expires_at)
    except (ValueError, TypeError):
        expires_at = datetime.utcnow() - timedelta(seconds=1)
    if datetime.utcnow() > expires_at:
        raise HTTPException(status_code=400, detail="That code expired. Tap resend to get a new one.")

    if (current_user.email_verification_attempts or 0) >= EMAIL_VERIFY_MAX_ATTEMPTS:
        raise HTTPException(status_code=429, detail="Too many attempts. Tap resend to get a new code.")

    if not verify_password(code, current_user.email_verification_code_hash):
        current_user.email_verification_attempts = (current_user.email_verification_attempts or 0) + 1
        db.commit()
        raise HTTPException(status_code=400, detail="That code is incorrect.")

    current_user.email_verified = True
    current_user.email_verification_code_hash = None
    current_user.email_verification_expires_at = None
    current_user.email_verification_attempts = 0
    db.commit()
    return {"email_verified": True, "needs_verification": False}


@router.post("/auth/verify-email/resend")
@auth_limiter.limit("5/hour")
async def resend_email_verification(
    request: Request,
    background_tasks: BackgroundTasks,
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict:
    """Mint and email a fresh confirmation code. Anti-enumeration isn't a concern
    here (the caller is authenticated and confirming their own email)."""
    if current_user.email_verified:
        return {"sent": False, "email_verified": True, "needs_verification": False}
    if not current_user.email or current_user.is_demo:
        raise HTTPException(status_code=400, detail="This account doesn't need email confirmation.")

    code = await _issue_email_verification(current_user, db)
    if code:
        background_tasks.add_task(
            send_email_verification_email, current_user.email, code, current_user.first_name
        )
    return {"sent": bool(code), "email_verified": False, "needs_verification": True}


class ChangeUsernameRequest(BaseModel):
    username: str


class ChangeEmailRequest(BaseModel):
    email: str
    # Required for accounts that have a password: changing the login email is a
    # sensitive operation, so we re-confirm the user's identity first.
    password: Optional[str] = None


USERNAME_RE = re.compile(r"^[A-Za-z0-9](?:[A-Za-z0-9_. -]*[A-Za-z0-9])?$")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]{2,}$")


@router.post("/auth/change-username")
@auth_limiter.limit("10/hour")
async def change_username(
    request: Request,
    body: ChangeUsernameRequest,
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict:
    """Change the account's username (stored as first_name — the same field
    signup and login-by-username use). Case-insensitive duplicate prevention
    against all non-demo accounts."""
    if current_user.is_demo:
        raise HTTPException(status_code=400, detail="Demo accounts can't change their username.")

    username = (body.username or "").strip()
    if len(username) < 3 or len(username) > 20:
        raise HTTPException(status_code=400, detail="Username must be 3–20 characters.")
    if not USERNAME_RE.match(username):
        raise HTTPException(
            status_code=400,
            detail="Username can only use letters, numbers, spaces, dots, dashes and underscores.",
        )

    # No-op rename (same name, possibly different casing) is always allowed.
    if (current_user.first_name or "").lower() != username.lower():
        taken = db.query(AuthUser).filter(
            func.lower(AuthUser.first_name) == username.lower(),
            AuthUser.is_demo == False,
            AuthUser.id != current_user.id,
        ).first()
        if taken:
            raise HTTPException(status_code=409, detail="Username already taken.")

    current_user.first_name = username
    db.commit()
    return {"success": True, "username": username}


@router.post("/auth/change-email")
@auth_limiter.limit("5/hour")
async def change_email(
    request: Request,
    body: ChangeEmailRequest,
    background_tasks: BackgroundTasks,
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict:
    """Change the account's login email. Requires the current password (when the
    account has one), enforces uniqueness, resets verification state, emails a
    fresh 6-digit confirmation code to the NEW address, and returns a fresh
    access token (tokens embed the email claim)."""
    if current_user.is_demo:
        raise HTTPException(status_code=400, detail="Demo accounts can't change their email.")

    email = (body.email or "").strip().lower()
    if not EMAIL_RE.match(email):
        raise HTTPException(status_code=400, detail="Enter a valid email address.")

    # Re-authenticate before changing the login identifier. Password accounts
    # must re-enter their password; passwordless accounts (e.g. Sign in with
    # Apple) have no credential to re-verify, so a stolen session token alone
    # would be enough to rebind the login email — block them instead of
    # silently allowing an account takeover pivot.
    if current_user.password_hash:
        if not body.password or not verify_password(body.password, current_user.password_hash):
            raise HTTPException(status_code=401, detail="Incorrect password.")
    else:
        raise HTTPException(
            status_code=400,
            detail=(
                "This account signs in without a password, so its email can't be "
                "changed here. Set a password first using 'Forgot password' on the "
                "sign-in screen, then try again."
            ),
        )

    if (current_user.email or "").lower() == email:
        raise HTTPException(status_code=400, detail="That's already your email.")

    taken = db.query(AuthUser).filter(
        func.lower(AuthUser.email) == email,
        AuthUser.id != current_user.id,
    ).first()
    if taken:
        raise HTTPException(status_code=409, detail="That email is already in use.")

    current_user.email = email
    # Login identifier changed — revoke all previously-issued tokens (the fresh
    # one returned below is issued after this stamp, so it stays valid).
    current_user.password_changed_at = datetime.utcnow().isoformat()
    # The new address is unconfirmed until the user enters the code we send it.
    current_user.email_verified = False
    current_user.email_verification_code_hash = None
    current_user.email_verification_expires_at = None
    current_user.email_verification_attempts = 0
    db.commit()

    try:
        code = await _issue_email_verification(current_user, db)
        if code:
            background_tasks.add_task(
                send_email_verification_email, email, code, current_user.first_name
            )
    except Exception as e:
        # Best-effort: the email change itself succeeded; the user can resend.
        print(f"[ChangeEmail] Failed to queue verification email: {e}")

    token = create_access_token(current_user.id, current_user.email)
    return {
        "success": True,
        "email": email,
        "email_verified": False,
        "needs_verification": True,
        "access_token": token,
        "token_type": "bearer",
    }


@router.post("/auth/validate-token")
async def validate_token(current_user: AuthUser = Depends(get_current_user)) -> Dict:
    """Validate that the provided token is valid"""
    return {
        "valid": True,
        "user_id": current_user.id,
        "email": current_user.email
    }

async def _issue_reset_token_and_email(user_id: str, user_email: str, user_name: str) -> None:
    """Background task: persist a reset token and send the email.

    Runs *after* the HTTP response has already been returned to the client so
    the caller cannot distinguish the "account exists" path from the
    "account not found" path via response latency.
    """
    from backend.db import SessionLocal
    db = SessionLocal()
    try:
        db.query(PasswordResetToken).filter(
            PasswordResetToken.user_id == user_id,
            PasswordResetToken.used == False
        ).update({"used": True})

        reset_token = secrets.token_urlsafe(32)
        token_record = PasswordResetToken(
            user_id=user_id,
            token=_hash_reset_token(reset_token),
            expires_at=datetime.utcnow() + timedelta(hours=1)
        )
        db.add(token_record)
        db.commit()

        await send_password_reset_email(
            to_email=user_email,
            reset_token=reset_token,
            user_name=user_name
        )
    except Exception:
        pass
    finally:
        db.close()


@router.post("/auth/forgot-password")
@auth_limiter.limit("5/hour")
async def forgot_password(
    request: Request,
    body: ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Request a password reset link.

    Always returns the same response body regardless of whether the address
    belongs to a real account.  The token-creation and email steps are
    deferred to a background task that runs *after* the response is sent,
    eliminating the server-side timing difference that would otherwise allow
    an attacker to enumerate valid email addresses by measuring latency.
    """
    email = body.email.strip()

    user = db.query(AuthUser).filter(
        func.lower(AuthUser.email) == email.lower(),
        AuthUser.is_demo == False
    ).first()

    if user:
        background_tasks.add_task(
            _issue_reset_token_and_email,
            user.id,
            user.email,
            user.first_name,
        )

    return {"message": "If an account with that email exists, a password reset link has been sent."}

@router.post("/auth/reset-password")
async def reset_password(request: ResetPasswordRequest, db: Session = Depends(get_db)):
    """Reset password using a valid reset token"""
    # Find the token
    token_record = db.query(PasswordResetToken).filter(
        PasswordResetToken.token == _hash_reset_token(request.token),
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
    # Kill every previously-issued session token: a stolen JWT must not survive
    # the victim resetting their password (see get_current_user iat check).
    user.password_changed_at = datetime.utcnow().isoformat()
    
    # Mark token as used
    token_record.used = True
    
    db.commit()
    
    return {"message": "Password has been reset successfully"}

@router.get("/auth/verify-reset-token/{token}")
async def verify_reset_token(token: str, db: Session = Depends(get_db)):
    """Verify if a reset token is valid"""
    token_record = db.query(PasswordResetToken).filter(
        PasswordResetToken.token == _hash_reset_token(token),
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
@auth_limiter.limit("3/hour")
async def create_demo_session(request: Request, body: DemoRequest = DemoRequest(), db: Session = Depends(get_db)):
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
        is_demo=True,
        # Demo accounts are throwaway and never see the confirmation nudge.
        email_verified=True,
        # Demo mode showcases the full experience: every demo session starts
        # with the onboarding funnel (flag false + is_demo means completion is
        # never persisted, so it re-runs on every new demo session).
        onboarding_completed=False,
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

    # Dynamically sweep EVERY table whose columns FK-reference auth_users.id.
    # A hardcoded table list here broke in production: newer tables
    # (daily_goals, user_platforms, user_entry_types, user_label_overrides,
    # users, daily_usage, referrals, problem_reports, ...) weren't purged, so
    # the final auth_users delete hit a foreign-key constraint → 500. Deriving
    # the list from the ORM metadata means a future table with a user FK is
    # covered automatically. reversed(sorted_tables) deletes dependents before
    # their dependencies. Rows matching ANY user-FK column are removed (covers
    # friends.friend_id, congratulations.from/to, referrals.referrer/referee).
    for table in reversed(Base.metadata.sorted_tables):
        if table.name == AuthUser.__tablename__:
            continue
        fk_cols = [
            col for col in table.columns
            if any(fk.column.table.name == AuthUser.__tablename__ for fk in col.foreign_keys)
        ]
        if not fk_cols:
            continue
        db.execute(table.delete().where(or_(*[col == user_id for col in fk_cols])))
    db.query(AuthUser).filter(AuthUser.id == user_id).delete(synchronize_session=False)

    db.commit()
    return {"deleted": True, "user_id": user_id}
