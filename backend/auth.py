import os
import jwt
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

    user_id = payload.get("sub")
    if not user_id:
        raise _unauthorized("Invalid token")

    user = db.query(AuthUser).filter(AuthUser.id == str(user_id)).first()
    if not user:
        # Token's user no longer exists (deleted account, etc). Do NOT auto-create.
        raise _unauthorized("User not found")

    return user
