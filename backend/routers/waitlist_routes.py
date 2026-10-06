from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from slowapi import Limiter
from slowapi.util import get_remote_address
from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional
import asyncio
import html
import json
import logging
import os
from backend.db import get_db
from backend.models import WaitlistSignup, AndroidBetaTesterSignup, GrowthEvent
from backend.auth import create_prelaunch_token

router = APIRouter(prefix="/api/waitlist", tags=["waitlist"])

# Per-IP rate limit on /signup. The limiter instance lives on app.state
# (configured in backend/app.py); slowapi resolves it via the `request` param
# on each handler. 5/hour is plenty for a legitimate user joining the list,
# but cuts off mass-enrollment of victim addresses harvested from a list.
waitlist_limiter = Limiter(key_func=get_remote_address)

PRELAUNCH_ACCESS_CODE = os.getenv("PRELAUNCH_ACCESS_CODE", "")

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
    # Returned only when valid=True and prelaunch mode is active. The client
    # must include this token in subsequent /api/auth/signup and /api/auth/demo
    # requests so the server can enforce the prelaunch gate without relying on
    # client-side navigation state.
    prelaunch_token: Optional[str] = None

@router.post("/verify-access", response_model=AccessCodeResponse)
@waitlist_limiter.limit("10/minute")
def verify_access_code(request: Request, body: AccessCodeRequest):
    # If no prelaunch code is configured the gate is effectively open; any
    # string is accepted and no token is issued (callers don't need one).
    if not PRELAUNCH_ACCESS_CODE:
        return AccessCodeResponse(valid=True, message="Access granted!")

    if body.access_code == PRELAUNCH_ACCESS_CODE:
        # Issue a short-lived signed token the client must present to
        # /api/auth/signup and /api/auth/demo. This moves enforcement
        # server-side so bypassing the prelaunch SPA page is not enough.
        token = create_prelaunch_token()
        return AccessCodeResponse(valid=True, message="Access granted!", prelaunch_token=token)
    else:
        return AccessCodeResponse(valid=False, message="Invalid access code")


# ── /go Android closed-beta acquisition funnel ──────────────────────────────
logger = logging.getLogger(__name__)

ALLOWED_BETA_PLATFORMS = {
    "DoorDash", "Uber Eats", "Instacart", "Spark", "GrubHub", "Shipt", "Other",
}
ALLOWED_GROWTH_EVENTS = {
    "landing_view",
    "device_ios_selected",
    "device_android_selected",
    "ios_app_store_clicked",
    "android_beta_submitted",
}
ALLOWED_DEVICES = {"ios", "android", "desktop"}
MAX_ATTR_LEN = 100


def _clean_meta(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    value = value.strip()
    return value[:MAX_ATTR_LEN] or None


class AndroidBetaSignupRequest(BaseModel):
    email: EmailStr
    first_name: Optional[str] = None
    platforms: list[str] = []
    consent: bool
    source: Optional[str] = None
    video_id: Optional[str] = None
    format_id: Optional[str] = None
    campaign_id: Optional[str] = None

    @field_validator("first_name")
    @classmethod
    def _first_name_ok(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        value = value.strip()
        return value[:80] or None

    @field_validator("platforms")
    @classmethod
    def _platforms_ok(cls, values: list[str]) -> list[str]:
        out: list[str] = []
        for value in values[:10]:
            value = str(value).strip()
            if value in ALLOWED_BETA_PLATFORMS and value not in out:
                out.append(value)
        return out

    @field_validator("source", "video_id", "format_id", "campaign_id")
    @classmethod
    def _meta_ok(cls, value: Optional[str]) -> Optional[str]:
        return _clean_meta(value)


class AndroidBetaSignupResponse(BaseModel):
    success: bool
    message: str


class GrowthEventRequest(BaseModel):
    event_type: str
    device: Optional[str] = None
    source: Optional[str] = None
    video_id: Optional[str] = None
    format_id: Optional[str] = None
    campaign_id: Optional[str] = None

    @field_validator("event_type")
    @classmethod
    def _event_ok(cls, value: str) -> str:
        if value not in ALLOWED_GROWTH_EVENTS:
            raise ValueError("Unsupported event")
        return value

    @field_validator("device")
    @classmethod
    def _device_ok(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        return value if value in ALLOWED_DEVICES else None

    @field_validator("source", "video_id", "format_id", "campaign_id")
    @classmethod
    def _growth_meta_ok(cls, value: Optional[str]) -> Optional[str]:
        return _clean_meta(value)


@router.post("/event")
@waitlist_limiter.limit("120/hour")
def record_growth_event(
    request: Request,
    body: GrowthEventRequest,
    db: Session = Depends(get_db),
):
    event = GrowthEvent(
        event_type=body.event_type,
        device=body.device,
        source=body.source,
        video_id=body.video_id,
        format_id=body.format_id,
        campaign_id=body.campaign_id,
    )
    db.add(event)
    db.commit()
    return {"success": True}


@router.post("/android-beta", response_model=AndroidBetaSignupResponse)
@waitlist_limiter.limit("10/hour")
async def signup_android_beta(
    request: Request,
    body: AndroidBetaSignupRequest,
    db: Session = Depends(get_db),
):
    if not body.consent:
        raise HTTPException(
            status_code=422,
            detail="Consent is required so we can send the tester opt-in link.",
        )

    email = str(body.email).strip().lower()
    is_new = False
    try:
        signup = db.query(AndroidBetaTesterSignup).filter(
            AndroidBetaTesterSignup.email.ilike(email)
        ).first()

        if signup is None:
            signup = AndroidBetaTesterSignup(
                email=email,
                first_name=body.first_name,
                platforms=json.dumps(body.platforms),
                consent=True,
                source=body.source,
                video_id=body.video_id,
                format_id=body.format_id,
                campaign_id=body.campaign_id,
                status="pending",
            )
            db.add(signup)
            db.commit()
            db.refresh(signup)
            is_new = True
        else:
            # Idempotent duplicate handling. Preserve first-touch attribution,
            # but fill any fields that were previously absent.
            signup.consent = True
            if not signup.first_name and body.first_name:
                signup.first_name = body.first_name
            try:
                previous = json.loads(signup.platforms or "[]")
            except Exception:
                previous = []
            merged = list(dict.fromkeys([
                *[p for p in previous if p in ALLOWED_BETA_PLATFORMS],
                *body.platforms,
            ]))
            signup.platforms = json.dumps(merged)
            if not signup.source:
                signup.source = body.source
            if not signup.video_id:
                signup.video_id = body.video_id
            if not signup.format_id:
                signup.format_id = body.format_id
            if not signup.campaign_id:
                signup.campaign_id = body.campaign_id
            db.commit()
    except IntegrityError:
        # A concurrent duplicate can race the pre-insert lookup. Treat it as
        # success without revealing membership state.
        db.rollback()
        is_new = False
    except Exception:
        db.rollback()
        logger.exception("Android beta signup failed")
        raise HTTPException(status_code=500, detail="Failed to save beta request")

    if is_new:
        try:
            await _send_android_beta_emails(
                email=email,
                first_name=body.first_name,
                platforms=body.platforms,
                source=body.source,
                video_id=body.video_id,
                format_id=body.format_id,
                campaign_id=body.campaign_id,
            )
        except Exception:
            # The queue row is the source of truth. Email delivery is best-effort
            # and must never make a valid tester signup appear to fail.
            logger.exception("Android beta notification email failed for %s", email)

    return AndroidBetaSignupResponse(
        success=True,
        message="Your Android beta request was received.",
    )


async def _send_android_beta_emails(
    *,
    email: str,
    first_name: Optional[str],
    platforms: list[str],
    source: Optional[str],
    video_id: Optional[str],
    format_id: Optional[str],
    campaign_id: Optional[str],
) -> None:
    import resend
    from backend.services.email_service import RESEND_API_KEY, RESEND_FROM, RESEND_REPLY_TO

    if not RESEND_API_KEY:
        return

    tester_name = html.escape(first_name or "")
    greeting = f"Hi {tester_name}," if tester_name else "Hi,"
    testing_url = "https://play.google.com/apps/testing/com.earningsninja.app"
    privacy_url = "https://earningsninja.com/privacy"

    user_html = f"""<!doctype html>
<html><body style="margin:0;background:#15120f;color:#ece6da;font-family:Arial,sans-serif">
<div style="max-width:560px;margin:0 auto;padding:32px 20px">
<h1 style="font-size:24px;margin:0 0 18px;color:#f5c518">Earnings Ninja Android beta</h1>
<p>{greeting}</p>
<p>We received your Android beta request for <strong>{html.escape(email)}</strong>.</p>
<p>Your Google account still needs to be added to the closed tester list. Once it is added, we’ll email you the Google Play opt-in link and instructions.</p>
<p>When you receive that link, open it on your Android phone while signed into the same Google account, opt in, install the app, and stay opted in for at least 14 days.</p>
<p>You do not need to do anything else yet.</p>
<p style="color:#a39a8b;font-size:13px;margin-top:28px">Privacy: <a style="color:#f5c518" href="{privacy_url}">{privacy_url}</a></p>
</div></body></html>"""

    user_params = {
        "from": RESEND_FROM,
        "to": [email],
        "subject": "Earnings Ninja Android beta request received",
        "html": user_html,
        **({"reply_to": RESEND_REPLY_TO} if RESEND_REPLY_TO else {}),
    }

    notify_to = (
        os.environ.get("ANDROID_BETA_NOTIFY_EMAIL")
        or os.environ.get("SUPPORT_EMAIL")
        or "earningsninjaapp@gmail.com"
    ).strip()

    admin_html = f"""<h2>New Earnings Ninja Android beta tester request</h2>
<p><b>Email:</b> {html.escape(email)}</p>
<p><b>Name:</b> {html.escape(first_name or "—")}</p>
<p><b>Platforms:</b> {html.escape(", ".join(platforms) or "—")}</p>
<p><b>Source:</b> {html.escape(source or "go")}</p>
<p><b>Video:</b> {html.escape(video_id or "—")}</p>
<p><b>Format:</b> {html.escape(format_id or "—")}</p>
<p><b>Campaign:</b> {html.escape(campaign_id or "—")}</p>
<p><b>Next action:</b> add this exact Google account to the Play Console closed-test email list, then send the tester the official opt-in link:</p>
<p><a href="{testing_url}">{testing_url}</a></p>"""

    admin_params = {
        "from": RESEND_FROM,
        "to": [notify_to],
        "subject": f"[Earnings Ninja Android Beta] New tester: {email}",
        "html": admin_html,
        **({"reply_to": email} if email else {}),
    }

    # Resend's SDK is synchronous. Offload both sends so this async endpoint
    # does not block the event loop.
    await asyncio.gather(
        asyncio.to_thread(resend.Emails.send, user_params),
        asyncio.to_thread(resend.Emails.send, admin_params),
    )
