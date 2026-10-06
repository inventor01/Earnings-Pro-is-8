from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from slowapi import Limiter
from slowapi.util import get_remote_address
from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional
import asyncio
import hashlib
import hmac
import html
import json
import logging
import os
import secrets
from datetime import datetime, timedelta
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
    platforms: list[str] = Field(default_factory=list)
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
                signup_id=signup.id,
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


def _beta_delay_minutes() -> int:
    try:
        value = int(os.getenv("BETA_INVITE_DELAY_MINUTES", "60"))
    except ValueError:
        value = 60
    return min(max(value, 15), 24 * 60)


def _approval_token(signup_id: int, email: str) -> str:
    secret = os.getenv("JWT_SECRET_KEY", "")
    if not secret:
        raise RuntimeError("JWT_SECRET_KEY is required for Android beta approval links")
    payload = f"android-beta:{signup_id}:{email.lower()}".encode("utf-8")
    return hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()


def _get_approved_signup_or_404(
    db: Session,
    signup_id: int,
    token: str,
) -> AndroidBetaTesterSignup:
    signup = db.query(AndroidBetaTesterSignup).filter(
        AndroidBetaTesterSignup.id == signup_id
    ).first()
    if signup is None:
        raise HTTPException(status_code=404, detail="Tester request not found")
    expected = _approval_token(signup.id, signup.email)
    if not secrets.compare_digest(token or "", expected):
        raise HTTPException(status_code=403, detail="Invalid approval link")
    return signup


def _email_shell(*, preheader: str, eyebrow: str, heading: str, body_html: str) -> str:
    # Table-based, inline-styled HTML renders consistently across Gmail,
    # Outlook and mobile clients. Remote images are decorative only; the
    # Earnings Ninja wordmark remains visible if images are blocked.
    return f"""<!doctype html>
<html>
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
</head>
<body style="margin:0;padding:0;background:#0f0d0b;color:#f3eee5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">{html.escape(preheader)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0f0d0b">
    <tr><td align="center" style="padding:32px 16px">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px">
        <tr><td style="padding:0 0 18px">
          <table role="presentation" cellspacing="0" cellpadding="0">
            <tr>
              <td style="vertical-align:middle;padding-right:12px">
                <img src="https://earningsninja.com/icon-512.png" width="48" height="48" alt="" style="display:block;border:0;border-radius:24px">
              </td>
              <td style="vertical-align:middle;font-size:20px;font-weight:800;letter-spacing:-.02em;color:#f3eee5">Earnings Ninja</td>
            </tr>
          </table>
        </td></tr>
        <tr><td style="background:#1b1713;border:1px solid #342d26;border-radius:20px;padding:30px">
          <div style="font-size:12px;font-weight:800;letter-spacing:.14em;color:#f5c518;margin:0 0 12px">{html.escape(eyebrow.upper())}</div>
          <h1 style="margin:0 0 16px;font-size:30px;line-height:1.1;letter-spacing:-.03em;color:#ffffff">{html.escape(heading)}</h1>
          {body_html}
        </td></tr>
        <tr><td style="padding:20px 4px 0;text-align:center;font-size:12px;line-height:1.6;color:#81786c">
          Earnings Ninja · Built for gig workers who want to know what they actually kept.<br>
          <a href="https://earningsninja.com/privacy" style="color:#b4aa9c;text-decoration:underline">Privacy</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""


async def _send_android_beta_emails(
    *,
    signup_id: int,
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

    safe_name = html.escape(first_name or "")
    safe_email = html.escape(email)
    greeting = f"Hi {safe_name}," if safe_name else "Hi,"
    delay = _beta_delay_minutes()
    delay_label = "about an hour" if delay == 60 else f"about {delay} minutes"
    public_url = os.getenv("PUBLIC_APP_URL", "https://earningsninja.com").rstrip("/")
    testing_url = "https://play.google.com/apps/testing/com.earningsninja.app"
    token = _approval_token(signup_id, email)
    approval_url = f"{public_url}/api/waitlist/android-beta/approve-page?signup_id={signup_id}&token={token}"

    user_body = f"""
      <p style="margin:0 0 14px;font-size:16px;line-height:1.65;color:#d8d0c4">{greeting}</p>
      <p style="margin:0 0 20px;font-size:16px;line-height:1.65;color:#d8d0c4">
        We received your Android beta request for <strong style="color:#ffffff">{safe_email}</strong>.
      </p>
      <div style="background:#f5c518;border-radius:16px;padding:20px;margin:22px 0;color:#17130f">
        <div style="font-size:12px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;margin-bottom:6px">What happens now</div>
        <div style="font-size:25px;font-weight:900;letter-spacing:-.03em;margin-bottom:6px">Give us {html.escape(delay_label)}.</div>
        <div style="font-size:14px;line-height:1.5">We add your Google account to the closed tester list first, then give Google Play time to update before we send your join link.</div>
      </div>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:8px 0 20px">
        <tr><td style="width:28px;vertical-align:top;color:#f5c518;font-weight:900;padding:8px 0">01</td><td style="padding:8px 0 8px 10px;font-size:15px;line-height:1.55;color:#d8d0c4"><strong style="color:#ffffff">We add this exact Google account.</strong><br>Your Play Store account has to match the email above.</td></tr>
        <tr><td style="width:28px;vertical-align:top;color:#f5c518;font-weight:900;padding:8px 0">02</td><td style="padding:8px 0 8px 10px;font-size:15px;line-height:1.55;color:#d8d0c4"><strong style="color:#ffffff">Google Play catches up.</strong><br>The tester button can take a little time to appear after an account is added.</td></tr>
        <tr><td style="width:28px;vertical-align:top;color:#f5c518;font-weight:900;padding:8px 0">03</td><td style="padding:8px 0 8px 10px;font-size:15px;line-height:1.55;color:#d8d0c4"><strong style="color:#ffffff">We send a second email.</strong><br>That email contains the official Google Play tester link and the exact steps to join.</td></tr>
      </table>
      <div style="border:1px solid #4a4034;border-radius:12px;padding:14px 16px;font-size:14px;line-height:1.55;color:#bdb4a7">
        You do not need to try the tester page yet. Waiting for the second email avoids the confusing “missing join button” problem while Google Play is still updating.
      </div>
    """

    user_params = {
        "from": RESEND_FROM,
        "to": [email],
        "subject": "Android beta request received — we’re adding your account",
        "html": _email_shell(
            preheader=f"We got your Android beta request. Your tester link comes in {delay_label}.",
            eyebrow="Android closed beta",
            heading="We got your request.",
            body_html=user_body,
        ),
        "text": (
            f"{greeting}\n\n"
            f"We received your Android beta request for {email}.\n\n"
            f"Give us {delay_label}. We add your Google account to the closed tester list first, "
            "then give Google Play time to update. We will send a second email with the official "
            "tester link and joining instructions. You do not need to try the tester page yet.\n\n"
            "Earnings Ninja"
        ),
        **({"reply_to": RESEND_REPLY_TO} if RESEND_REPLY_TO else {}),
    }

    notify_to = (
        os.environ.get("ANDROID_BETA_NOTIFY_EMAIL")
        or os.environ.get("SUPPORT_EMAIL")
        or "earningsninjaapp@gmail.com"
    ).strip()

    admin_body = f"""
      <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#d8d0c4">A new Android tester is waiting to be added to Google Play.</p>
      <div style="background:#12100e;border:1px solid #342d26;border-radius:14px;padding:16px;margin:0 0 20px;font-size:14px;line-height:1.65;color:#d8d0c4">
        <div><strong style="color:#ffffff">Email:</strong> {safe_email}</div>
        <div><strong style="color:#ffffff">Name:</strong> {html.escape(first_name or "—")}</div>
        <div><strong style="color:#ffffff">Platforms:</strong> {html.escape(", ".join(platforms) or "—")}</div>
        <div><strong style="color:#ffffff">Source:</strong> {html.escape(source or "go")}</div>
        <div><strong style="color:#ffffff">Video:</strong> {html.escape(video_id or "—")}</div>
        <div><strong style="color:#ffffff">Format:</strong> {html.escape(format_id or "—")}</div>
        <div><strong style="color:#ffffff">Campaign:</strong> {html.escape(campaign_id or "—")}</div>
      </div>
      <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#d8d0c4">
        Add the exact email above to the Google Play closed-test email list. After it is added, confirm below. The tester link will not send until you confirm, and never before the {html.escape(delay_label)} setup window has passed.
      </p>
      <table role="presentation" cellspacing="0" cellpadding="0" style="margin:22px 0">
        <tr><td bgcolor="#f5c518" style="border-radius:12px">
          <a href="{html.escape(approval_url)}" style="display:inline-block;padding:15px 22px;color:#17130f;text-decoration:none;font-size:15px;font-weight:900">Confirm tester was added</a>
        </td></tr>
      </table>
      <p style="margin:0;font-size:13px;line-height:1.55;color:#81786c">Google Play tester page for reference: <a href="{testing_url}" style="color:#f5c518">{testing_url}</a></p>
    """

    admin_params = {
        "from": RESEND_FROM,
        "to": [notify_to],
        "subject": f"[Android Beta] Add tester: {email}",
        "html": _email_shell(
            preheader=f"Add {email} to Google Play, then confirm so the delayed invite can send.",
            eyebrow="Tester action required",
            heading="Add this tester first.",
            body_html=admin_body,
        ),
        "text": (
            f"New Android beta tester\n\nEmail: {email}\nName: {first_name or '—'}\n"
            f"Platforms: {', '.join(platforms) or '—'}\n\n"
            "Add this exact Google account to the Play Console closed-test list, then confirm here:\n"
            f"{approval_url}\n\nReference tester page: {testing_url}"
        ),
        **({"reply_to": email} if email else {}),
    }

    await asyncio.gather(
        asyncio.to_thread(resend.Emails.send, user_params),
        asyncio.to_thread(resend.Emails.send, admin_params),
    )


@router.get("/android-beta/approve-page", response_class=HTMLResponse)
def android_beta_approval_page(
    signup_id: int,
    token: str,
    db: Session = Depends(get_db),
):
    signup = _get_approved_signup_or_404(db, signup_id, token)
    safe_email = html.escape(signup.email)
    safe_token = html.escape(token)
    page = f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <meta name="referrer" content="no-referrer">
  <title>Confirm Android tester — Earnings Ninja</title>
</head>
<body style="margin:0;background:#15120f;color:#ece6da;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif">
  <main style="max-width:560px;margin:0 auto;padding:48px 20px">
    <div style="font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#f5c518;font-weight:800;margin-bottom:12px">Earnings Ninja · Android beta</div>
    <h1 style="font-size:32px;line-height:1.1;margin:0 0 16px">Confirm tester was added</h1>
    <p style="font-size:16px;line-height:1.6;color:#b8afa2">Only confirm after <strong style="color:#fff">{safe_email}</strong> has been added to the Google Play closed-test email list.</p>
    <button id="confirm" style="width:100%;min-height:56px;border:0;border-radius:14px;background:#f5c518;color:#15120f;font-weight:900;font-size:16px;margin-top:18px">Yes, tester is added</button>
    <p id="status" style="font-size:14px;line-height:1.5;color:#9d9487;margin-top:16px"></p>
  </main>
<script>
document.getElementById('confirm').addEventListener('click', async () => {{
  const button=document.getElementById('confirm'), status=document.getElementById('status');
  button.disabled=true; button.textContent='Confirming…';
  try {{
    const res=await fetch('/api/waitlist/android-beta/approve', {{
      method:'POST',
      headers:{{'Content-Type':'application/json'}},
      body:JSON.stringify({{signup_id:{signup.id},token:'{safe_token}'}})
    }});
    const data=await res.json();
    if(!res.ok) throw new Error(data.detail || 'Could not confirm tester.');
    button.textContent='Confirmed';
    status.textContent=data.message;
  }} catch(e) {{
    button.disabled=false; button.textContent='Try again';
    status.textContent=e.message || 'Could not confirm tester.';
  }}
}});
</script>
</body>
</html>"""
    return HTMLResponse(page)


class AndroidBetaApprovalRequest(BaseModel):
    signup_id: int
    token: str


@router.post("/android-beta/approve")
def approve_android_beta_tester(
    body: AndroidBetaApprovalRequest,
    db: Session = Depends(get_db),
):
    signup = _get_approved_signup_or_404(db, body.signup_id, body.token)
    if signup.status == "invited":
        return {"success": True, "message": "This tester was already approved and the invite email was sent."}
    if signup.status not in {"approved", "sending"}:
        signup.status = "approved"
        db.commit()

    delay = _beta_delay_minutes()
    eligible_at = signup.created_at + timedelta(minutes=delay)
    remaining = max(0, int((eligible_at - datetime.utcnow()).total_seconds() // 60))
    if remaining > 1:
        message = f"Tester confirmed. The join-link email will become eligible in about {remaining} minutes."
    else:
        message = "Tester confirmed. The join-link email is eligible and will be sent by the next delivery check."
    return {"success": True, "message": message}


async def _send_android_beta_invite_email(signup: AndroidBetaTesterSignup) -> None:
    import resend
    from backend.services.email_service import RESEND_API_KEY, RESEND_FROM, RESEND_REPLY_TO

    if not RESEND_API_KEY:
        raise RuntimeError("RESEND_API_KEY is not configured")

    safe_name = html.escape(signup.first_name or "")
    safe_email = html.escape(signup.email)
    greeting = f"Hi {safe_name}," if safe_name else "Hi,"
    testing_url = "https://play.google.com/apps/testing/com.earningsninja.app"

    body = f"""
      <p style="margin:0 0 14px;font-size:16px;line-height:1.65;color:#d8d0c4">{greeting}</p>
      <p style="margin:0 0 20px;font-size:16px;line-height:1.65;color:#d8d0c4">Your Earnings Ninja Android beta setup window is complete. Use the same Google account we saved for you: <strong style="color:#ffffff">{safe_email}</strong>.</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:24px 0">
        <tr><td align="center" bgcolor="#f5c518" style="border-radius:14px">
          <a href="{testing_url}" style="display:block;padding:17px 24px;color:#17130f;text-decoration:none;font-size:17px;font-weight:900">Open Google Play tester page</a>
        </td></tr>
      </table>
      <div style="background:#12100e;border:1px solid #342d26;border-radius:14px;padding:18px;margin:0 0 20px">
        <div style="font-size:15px;font-weight:900;color:#ffffff;margin-bottom:10px">Do this on your Android phone</div>
        <div style="font-size:14px;line-height:1.65;color:#c8c0b4">1. Make sure the Play Store is signed into <strong style="color:#fff">{safe_email}</strong>.<br>2. Open the button above and choose <strong style="color:#fff">Become a tester</strong>.<br>3. Install Earnings Ninja from Google Play.<br>4. Stay opted in for at least 14 continuous days.</div>
      </div>
      <div style="border:1px solid #4a4034;border-radius:12px;padding:14px 16px;font-size:14px;line-height:1.55;color:#bdb4a7">
        If “Become a tester” is not visible yet, Google Play may still be syncing your account. Wait 15–30 minutes, confirm you are signed into the exact email above, then reopen the link. If it still does not appear, reply to this email.
      </div>
    """

    params = {
        "from": RESEND_FROM,
        "to": [signup.email],
        "subject": "Your Earnings Ninja Android beta link is ready",
        "html": _email_shell(
            preheader="Your Android tester link is ready. Open it with the same Google account you submitted.",
            eyebrow="Android beta access",
            heading="Your tester link is ready.",
            body_html=body,
        ),
        "text": (
            f"{greeting}\n\nYour Earnings Ninja Android beta link is ready.\n\n"
            f"Use the Play Store account {signup.email}. Open this link on your Android phone:\n"
            f"{testing_url}\n\nChoose Become a tester, install Earnings Ninja, and stay opted in for "
            "at least 14 continuous days. If the Become a tester button is not visible, wait 15–30 "
            "minutes, make sure the Play Store is signed into the exact email above, and reopen the link."
        ),
        **({"reply_to": RESEND_REPLY_TO} if RESEND_REPLY_TO else {}),
    }
    await asyncio.to_thread(resend.Emails.send, params)


@router.post("/android-beta/process-invites")
async def process_due_android_beta_invites(
    request: Request,
    db: Session = Depends(get_db),
):
    expected = os.getenv("BETA_INVITE_CRON_TOKEN", "")
    provided = request.headers.get("authorization", "")
    if not expected:
        raise HTTPException(status_code=503, detail="Invite processor is not configured")
    if not secrets.compare_digest(provided, f"Bearer {expected}"):
        raise HTTPException(status_code=401, detail="Unauthorized")

    cutoff = datetime.utcnow() - timedelta(minutes=_beta_delay_minutes())
    due_ids = [
        row[0]
        for row in db.query(AndroidBetaTesterSignup.id)
        .filter(
            AndroidBetaTesterSignup.status == "approved",
            AndroidBetaTesterSignup.consent.is_(True),
            AndroidBetaTesterSignup.created_at <= cutoff,
        )
        .order_by(AndroidBetaTesterSignup.created_at.asc())
        .limit(50)
        .all()
    ]

    sent = 0
    failed = 0
    for signup_id in due_ids:
        claimed = (
            db.query(AndroidBetaTesterSignup)
            .filter(
                AndroidBetaTesterSignup.id == signup_id,
                AndroidBetaTesterSignup.status == "approved",
            )
            .update({"status": "sending"}, synchronize_session=False)
        )
        db.commit()
        if claimed != 1:
            continue

        signup = db.query(AndroidBetaTesterSignup).filter(
            AndroidBetaTesterSignup.id == signup_id
        ).first()
        if signup is None:
            continue

        try:
            await _send_android_beta_invite_email(signup)
        except Exception:
            logger.exception("Delayed Android beta invite failed for signup id %s", signup_id)
            db.query(AndroidBetaTesterSignup).filter(
                AndroidBetaTesterSignup.id == signup_id,
                AndroidBetaTesterSignup.status == "sending",
            ).update({"status": "approved"}, synchronize_session=False)
            db.commit()
            failed += 1
            continue

        db.query(AndroidBetaTesterSignup).filter(
            AndroidBetaTesterSignup.id == signup_id,
            AndroidBetaTesterSignup.status == "sending",
        ).update({"status": "invited"}, synchronize_session=False)
        db.commit()
        sent += 1

    return {"success": True, "eligible": len(due_ids), "sent": sent, "failed": failed}
