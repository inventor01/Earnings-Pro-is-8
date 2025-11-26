import jwt
from fastapi import Depends
from fastapi.security import HTTPBearer
from sqlalchemy.orm import Session
from backend.db import get_db
from backend.models import AuthUser

security = HTTPBearer(auto_error=False)
DEFAULT_USER_ID = "default-user"

def get_or_create_default_user(db: Session) -> AuthUser:
    """Get or create default test user"""
    user = db.query(AuthUser).filter(AuthUser.id == DEFAULT_USER_ID).first()
    if not user:
        user = AuthUser(
            id=DEFAULT_USER_ID,
            email="user@example.com",
            first_name="User",
            last_name="Data"
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
