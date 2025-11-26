from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.db import get_db
from backend.models import AuthUser
from backend.auth import get_current_user
import jwt
import os
from typing import Dict
from pydantic import BaseModel
import hashlib
import hmac
import uuid

router = APIRouter()

SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "your-secret-key-change-in-production")

class LoginRequest(BaseModel):
    email: str
    password: str

class SignupRequest(BaseModel):
    email: str
    password: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None

class AuthResponse(BaseModel):
    access_token: str
    token_type: str
    user_id: str
    email: str

def hash_password(password: str) -> str:
    """Hash password using SHA256"""
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(password: str, hash_value: str) -> bool:
    """Verify password against hash"""
    return hash_password(password) == hash_value

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
        first_name=request.first_name or "",
        last_name=request.last_name or ""
    )
    db.add(user)
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
    """Login user"""
    if not request.email or not request.password:
        raise HTTPException(status_code=400, detail="Email and password are required")
    
    user = db.query(AuthUser).filter(AuthUser.email == request.email).first()
    if not user or not user.password_hash:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if not verify_password(request.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
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
