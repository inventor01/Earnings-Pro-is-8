import jwt
from fastapi import Depends
from fastapi.security import HTTPBearer
from sqlalchemy.orm import Session
from backend.db import get_db
from backend.models import AuthUser, Entry, EntryType, AppType, ExpenseCategory
from datetime import datetime, timedelta
from decimal import Decimal
import logging

logger = logging.getLogger(__name__)

security = HTTPBearer(auto_error=False)
DEFAULT_USER_ID = "default-user"

def get_or_create_default_user(db: Session) -> AuthUser:
    """Get or create default test user - NO AUTO-SEEDING
    
    IMPORTANT: Do NOT add any auto-seeding here. This previously caused the app to
    automatically generate 30 demo entries ($476 profit) every time the default user
    was accessed, resulting in persistent data that couldn't be cleared.
    
    Users should start with a completely empty ledger. If demo data is needed,
    it should only be added explicitly via separate endpoints or manual scripts
    (see backend/scripts/seed.py or backend/seed_this_week.py).
    """
    user = db.query(AuthUser).filter(AuthUser.id == DEFAULT_USER_ID).first()
    if not user:
        user = AuthUser(
            id=DEFAULT_USER_ID,
            email="user@example.com",
            first_name="Guest",
            last_name=""
        )
        db.add(user)
        try:
            db.commit()
            db.refresh(user)
        except:
            db.rollback()
            user = db.query(AuthUser).filter(AuthUser.id == DEFAULT_USER_ID).first() or user
    return user

def get_current_user(credentials = Depends(security), db: Session = Depends(get_db)) -> AuthUser:
    """Get current authenticated user - defaults to test user if no token provided"""
    if not credentials:
        return get_or_create_default_user(db)
    
    token = credentials.credentials
    try:
        payload = jwt.decode(token, options={"verify_signature": False})
        user_id = payload.get("sub")
        if user_id is None:
            return get_or_create_default_user(db)
    except:
        return get_or_create_default_user(db)
    
    user = db.query(AuthUser).filter(AuthUser.id == str(user_id)).first()
    if not user:
        user = AuthUser(
            id=str(user_id),
            email=payload.get("email"),
            first_name=payload.get("first_name"),
            last_name=payload.get("last_name"),
            profile_image_url=payload.get("profile_image_url")
        )
        db.add(user)
        try:
            db.commit()
            db.refresh(user)
        except:
            db.rollback()
    
    return user
