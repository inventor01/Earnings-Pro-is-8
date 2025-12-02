from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from pydantic import BaseModel, EmailStr
from typing import Optional
import os
from backend.db import get_db
from backend.models import WaitlistSignup

router = APIRouter(prefix="/api/waitlist", tags=["waitlist"])

PRELAUNCH_ACCESS_CODE = os.getenv("PRELAUNCH_ACCESS_CODE", "earningsninja2024")

class WaitlistRequest(BaseModel):
    email: EmailStr
    name: Optional[str] = None
    referral_source: Optional[str] = None

class WaitlistResponse(BaseModel):
    success: bool
    message: str

@router.post("/signup", response_model=WaitlistResponse)
def signup_waitlist(request: WaitlistRequest, db: Session = Depends(get_db)):
    try:
        existing = db.query(WaitlistSignup).filter(
            WaitlistSignup.email.ilike(request.email)
        ).first()
        
        if existing:
            return WaitlistResponse(
                success=True,
                message="You're already on the list! We'll notify you when we launch."
            )
        
        signup = WaitlistSignup(
            email=request.email.lower(),
            name=request.name,
            referral_source=request.referral_source
        )
        db.add(signup)
        db.commit()
        
        return WaitlistResponse(
            success=True,
            message="You're on the list! We'll send you an email when we launch."
        )
    except IntegrityError:
        db.rollback()
        return WaitlistResponse(
            success=True,
            message="You're already on the list! We'll notify you when we launch."
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to join waitlist")

@router.get("/count")
def get_waitlist_count(db: Session = Depends(get_db)):
    count = db.query(WaitlistSignup).count()
    return {"count": count}

class AccessCodeRequest(BaseModel):
    access_code: str

class AccessCodeResponse(BaseModel):
    valid: bool
    message: Optional[str] = None

@router.post("/verify-access", response_model=AccessCodeResponse)
def verify_access_code(request: AccessCodeRequest):
    if request.access_code == PRELAUNCH_ACCESS_CODE:
        return AccessCodeResponse(valid=True, message="Access granted!")
    else:
        return AccessCodeResponse(valid=False, message="Invalid access code")
