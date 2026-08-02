"""Report a Problem: stores user bug reports / feature requests and notifies
the team by email. Screenshots arrive as client-compressed data-URLs, capped
in count and size server-side so the inline-storage path can't be abused."""
import json
import logging
import os
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, field_validator
from sqlalchemy.orm import Session

from backend.auth import get_current_user
from backend.db import get_db
from backend.models import ProblemReport

logger = logging.getLogger(__name__)
router = APIRouter()

REPORT_TYPES = {
    "Bug Report", "App Crash", "Performance Issue", "Incorrect Data",
    "Subscription Issue", "Login / Account Issue", "Notification Issue",
    "UI / Display Issue", "Feature Request", "Other",
}
MAX_SCREENSHOTS = 5
MAX_SCREENSHOT_BYTES = 2_000_000   # ~2MB per data-URL (post-compression)
MAX_TEXT_LEN = 10_000
MAX_DIAG_ITEMS = 20                # diagnostics is a small flat facts dict
MAX_DIAG_STR = 200
MAX_TOTAL_SCREENSHOT_CHARS = 8_000_000  # aggregate cap across all screenshots
MAX_REPORTS_PER_HOUR = 5           # per-user throttle


class ProblemReportIn(BaseModel):
    report_type: str
    description: str
    steps: str | None = None
    contact_email: EmailStr
    diagnostics: dict | None = None
    screenshots: list[str] = []

    @field_validator("report_type")
    @classmethod
    def _type_ok(cls, v: str) -> str:
        if v not in REPORT_TYPES:
            raise ValueError("Unknown report type")
        return v

    @field_validator("description")
    @classmethod
    def _desc_ok(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 20:
            raise ValueError("Description must be at least 20 characters")
        if len(v) > MAX_TEXT_LEN:
            raise ValueError("Description too long")
        return v

    @field_validator("steps")
    @classmethod
    def _steps_ok(cls, v: str | None) -> str | None:
        if v and len(v) > MAX_TEXT_LEN:
            raise ValueError("Steps too long")
        return v

    @field_validator("screenshots")
    @classmethod
    def _shots_ok(cls, v: list[str]) -> list[str]:
        if len(v) > MAX_SCREENSHOTS:
            raise ValueError(f"At most {MAX_SCREENSHOTS} screenshots")
        total = 0
        for s in v:
            if not s.startswith("data:image/"):
                raise ValueError("Screenshots must be image data URLs")
            if len(s) > MAX_SCREENSHOT_BYTES * 4 // 3:
                raise ValueError("A screenshot is too large")
            total += len(s)
        if total > MAX_TOTAL_SCREENSHOT_CHARS:
            raise ValueError("Screenshots are too large in total")
        return v

    @field_validator("diagnostics")
    @classmethod
    def _diag_ok(cls, v: dict | None) -> dict | None:
        if v is None:
            return None
        if len(v) > MAX_DIAG_ITEMS:
            raise ValueError("Too many diagnostic fields")
        # Coerce to a small flat string→string dict; anything else is rejected.
        out: dict[str, str] = {}
        for k, val in v.items():
            ks, vs = str(k)[:MAX_DIAG_STR], str(val)[:MAX_DIAG_STR]
            out[ks] = vs
        return out


@router.post("/feedback/report")
async def submit_problem_report(
    body: ProblemReportIn,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user is None:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # Per-user throttle: reports are large (inline screenshots), so cap the
    # rate well below anything a genuine user would hit.
    from datetime import timedelta
    hour_ago = datetime.utcnow() - timedelta(hours=1)
    recent = (
        db.query(ProblemReport)
        .filter(ProblemReport.user_id == current_user.id, ProblemReport.created_at >= hour_ago)
        .count()
    )
    if recent >= MAX_REPORTS_PER_HOUR:
        raise HTTPException(status_code=429, detail="Too many reports — please try again later.")

    report = ProblemReport(
        user_id=current_user.id,
        report_type=body.report_type,
        description=body.description,
        steps=body.steps or None,
        contact_email=str(body.contact_email),
        diagnostics=json.dumps(body.diagnostics) if body.diagnostics else None,
        screenshots=json.dumps(body.screenshots) if body.screenshots else None,
        created_at=datetime.utcnow(),
    )
    db.add(report)
    db.commit()
    db.refresh(report)

    # Notify the team. Email failure must never fail the submission — the
    # report is already persisted.
    try:
        await _send_report_email(report, screenshot_count=len(body.screenshots))
    except Exception:
        logger.exception("problem-report email failed (report %s saved)", report.id)

    return {"ok": True, "id": report.id}


async def _send_report_email(report: ProblemReport, screenshot_count: int) -> None:
    import asyncio
    import resend
    from backend.services.email_service import RESEND_API_KEY, RESEND_FROM, RESEND_REPLY_TO

    to_addr = os.environ.get("SUPPORT_EMAIL", "earningsninjaapp@gmail.com").strip()
    if not RESEND_API_KEY or not to_addr:
        return

    def esc(s: str) -> str:
        return (s or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

    diag = ""
    if report.diagnostics:
        try:
            pairs = json.loads(report.diagnostics)
            # Escape keys AND values — diagnostics are client-controlled.
            diag = "".join(
                f"<tr><td style='padding:2px 10px 2px 0;color:#666'>{esc(str(k))}</td><td>{esc(str(v))}</td></tr>"
                for k, v in pairs.items()
            )
        except Exception:
            diag = ""

    html = f"""
    <h2>🥷 {esc(report.report_type)} — report #{report.id}</h2>
    <p><b>From:</b> {esc(report.contact_email)} (user {esc(report.user_id)})</p>
    <p><b>Description:</b><br>{esc(report.description).replace(chr(10), '<br>')}</p>
    {f"<p><b>Steps:</b><br>{esc(report.steps).replace(chr(10), '<br>')}</p>" if report.steps else ""}
    <p><b>Screenshots:</b> {screenshot_count} attached (stored with the report in the DB)</p>
    {f"<table>{diag}</table>" if diag else "<p>(no diagnostics shared)</p>"}
    """
    params = {
        "from": RESEND_FROM,
        "to": [to_addr],
        "subject": f"[Earnings Ninja] {report.report_type} — report #{report.id}",
        "html": html,
    }
    if RESEND_REPLY_TO:
        params["reply_to"] = [report.contact_email]
    await asyncio.to_thread(resend.Emails.send, params)
