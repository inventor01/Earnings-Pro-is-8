import os
import jwt
from datetime import datetime, timedelta, timezone
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer
from sqlalchemy.orm import Session
from backend.db import get_db
from backend.models import AuthUser
import logging

logger = logging.getLogger(__name__)

security = HTTPBearer(auto_error=False)

SECRET_KEY = os.environ.get("JWT_SECRET_KEY")
if not SECRET_KEY:
    raise RuntimeError(
        "JWT_SECRET_KEY environment variable is required. "
        "Generate one with: python -c 'import secrets; print(secrets.token_hex(48))' "
        "and add it as a Replit secret."
    )

JWT_ALGORITHM = "HS256"

# ---------------------------------------------------------------------------
# Prelaunch token helpers
# ---------------------------------------------------------------------------
# A prelaunch token is a short-lived JWT issued by /api/waitlist/verify-access
# when the caller presents a valid access code. The /api/auth/signup and
# /api/auth/demo endpoints require this token when PRELAUNCH_ACCESS_CODE is
# configured, enforcing the closed-beta gate server-side.

PRELAUNCH_TOKEN_TTL = timedelta(hours=1)


def create_prelaunch_token() -> str:
    """Issue a short-lived signed JWT proving the caller verified the prelaunch
    access code. Signed with the app's SECRET_KEY so it cannot be forged."""
    now = datetime.utcnow()
    payload = {
        "purpose": "prelaunch",
        "iat": now,
        "exp": now + PRELAUNCH_TOKEN_TTL,
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=JWT_ALGORITHM)


def verify_prelaunch_token(token: str) -> bool:
    """Return True if *token* is a valid, unexpired prelaunch token."""
    if not token:
        return False
    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[JWT_ALGORITHM],
            options={"require": ["exp"]},
        )
        return payload.get("purpose") == "prelaunch"
    except jwt.InvalidTokenError:
        return False


DEFAULT_USER_ID = "default-user"


def get_or_create_default_user(db: Session) -> AuthUser:
    """Return the legacy shared 'Guest' user. ONLY used by the explicit guest
    flow — never as an auth fallback. Kept for compatibility with frontends
    that POST to /api/auth/guest (if any).
    """
    user = db.query(AuthUser).filter(AuthUser.id == DEFAULT_USER_ID).first()
    if not user:
        user = AuthUser(
            id=DEFAULT_USER_ID,
            email="user@example.com",
            first_name="Guest",
            last_name="",
        )
        db.add(user)
        try:
            db.commit()
            db.refresh(user)
        except Exception:
            db.rollback()
            user = db.query(AuthUser).filter(AuthUser.id == DEFAULT_USER_ID).first() or user
    return user


def _unauthorized(detail: str = "Not authenticated") -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_user(
    credentials=Depends(security),
    db: Session = Depends(get_db),
) -> AuthUser:
    """Authenticate the request via a signed JWT. Rejects missing, malformed,
    expired, or tampered tokens. Never silently downgrades to a shared account.
    """
    if not credentials:
        raise _unauthorized("Missing Authorization header")

    token = credentials.credentials
    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[JWT_ALGORITHM],
            options={"require": ["sub", "exp"]},
        )
    except jwt.ExpiredSignatureError:
        raise _unauthorized("Token expired")
    except jwt.InvalidTokenError:
        raise _unauthorized("Invalid token")

    # Reject MFA challenge tokens. They carry `sub`+`exp` (so they'd otherwise
    # satisfy the decode above) but are only valid at /auth/mfa/verify — never as
    # a full access token. Without this guard a half-authenticated user (password
    # correct, 2nd factor NOT yet supplied) could call any protected route.
    if payload.get("typ") == "mfa":
        raise _unauthorized("Invalid token")

    user_id = payload.get("sub")
    if not user_id:
        raise _unauthorized("Invalid token")

    user = db.query(AuthUser).filter(AuthUser.id == str(user_id)).first()
    if not user:
        # Token's user no longer exists (deleted account, etc). Do NOT auto-create.
        raise _unauthorized("User not found")

    # Session revocation on security events: any token issued BEFORE the last
    # password reset / login-email change is dead, even if unexpired. Tokens
    # issued in the same second as the event (e.g. the fresh token returned by
    # the event itself) remain valid (strict <).
    changed_at = getattr(user, "password_changed_at", None)
    if changed_at:
        try:
            changed_dt = datetime.fromisoformat(changed_at)
            if changed_dt.tzinfo is None:
                # Stored via datetime.utcnow().isoformat() — naive but UTC.
                changed_dt = changed_dt.replace(tzinfo=timezone.utc)
            # PyJWT encodes iat at integer-second granularity, while the stored
            # stamp has microseconds. Floor BOTH to whole seconds or a token
            # issued later within the same second (e.g. the fresh token
            # /auth/change-email returns) would compare as older and be killed.
            changed_ts = int(changed_dt.timestamp())
            iat = payload.get("iat")
            if iat is not None and int(float(iat)) < changed_ts:
                raise _unauthorized("Token expired")
        except HTTPException:
            raise
        except (ValueError, TypeError):
            pass  # malformed stamp — never lock every session out

    return user
