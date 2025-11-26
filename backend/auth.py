import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthCredentialsBearer
from sqlalchemy.orm import Session
from backend.db import get_db
from backend.models import AuthUser
from typing import Optional

security = HTTPBearer(auto_error=False)

def get_current_user(credentials = Depends(security), db: Session = Depends(get_db)) -> AuthUser:
    """Get current authenticated user from JWT token"""
    if not credentials:
        # For testing/development: create a default test user
        test_user_id = "test-user-123"
        user = db.query(AuthUser).filter(AuthUser.id == test_user_id).first()
        if not user:
            user = AuthUser(
                id=test_user_id,
                email="test@example.com",
                first_name="Test",
                last_name="User"
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        return user
    
    token = credentials.credentials
    try:
        payload = jwt.decode(token, options={"verify_signature": False})
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token"
            )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )
    
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
        db.commit()
        db.refresh(user)
    
    return user
