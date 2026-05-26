from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from slowapi import Limiter
from slowapi.util import get_remote_address
from pydantic import BaseModel, EmailStr
from typing import Optional
import os
from backend.db import get_db
from backend.models import WaitlistSignup

router = APIRouter(prefix="/api/waitlist", tags=["waitlist"])

# Per-IP rate limit on /signup. The limiter instance lives on app.state
# (configured in backend/app.py); slowapi resolves it via the `request` param
# on each handler. 5/hour is plenty for a legitimate user joining the list,
# but cuts off mass-enrollment of victim addresses harvested from a list.
waitlist_limiter = Limiter(key_func=get_remote_address)

PRELAUNCH_ACCESS_CODE = os.getenv("PRELAUNCH_ACCESS_CODE", "en2025")

class WaitlistRequest(BaseModel):
    email: EmailStr
    name: Optional[str] = None
    referral_source: Optional[str] = None

class WaitlistResponse(BaseModel):
    success: bool
    message: str

@router.post("/signup", response_model=WaitlistResponse)
@waitlist_limiter.limit("5/hour")
def signup_waitlist(request: Request, body: WaitlistRequest, db: Session = Depends(get_db)):
    # We deliberately return the SAME success message whether the email was
    # newly inserted or already present. Combined with the removal of the
    # public /count endpoint, this prevents an attacker from using waitlist
    # membership as a side channel ("does victim@x.com already exist?").
    generic_success = WaitlistResponse(
        success=True,
        message="You're on the list! We'll send you an email when we launch.",
    )
    try:
        existing = db.query(WaitlistSignup).filter(
            WaitlistSignup.email.ilike(body.email)
        ).first()

        if existing:
            return generic_success

        signup = WaitlistSignup(
            email=body.email.lower(),
            name=body.name,
            referral_source=body.referral_source,
        )
        db.add(signup)
        db.commit()
        return generic_success
    except IntegrityError:
        db.rollback()
        return generic_success
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to join waitlist")

# NOTE: GET /api/waitlist/count was removed intentionally. It returned the
# exact total to any unauthenticated caller, which let an attacker observe
# the count, POST /signup with victim@example.com, and re-check the count
# to learn whether the victim was already enrolled — a membership-disclosure
# oracle. No frontend (web, landing, or Expo) consumes the count, so removing
# the endpoint has no UX impact.

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
