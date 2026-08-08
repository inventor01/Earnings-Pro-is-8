"""RevenueCat webhook + server-side subscription status.

POST /api/revenuecat/webhook
    Called by RevenueCat on subscription lifecycle events. Authenticated via a
    shared secret in the Authorization header (REVENUECAT_WEBHOOK_AUTH_TOKEN
    env var — the same value must be entered as the webhook's Authorization
    header in the RevenueCat dashboard). Updates the user's stored Pro
    entitlement state idempotently; unknown users / event types are logged
    and acknowledged with 200 so RevenueCat doesn't retry forever.

GET /api/subscription/status
    Authenticated. Returns the server's view of the caller's Pro status; when
    the stored state is missing or stale, performs an on-demand RevenueCat
    REST check first (secret key permitting).

See docs/revenuecat-webhook-setup.md for the dashboard configuration steps.
"""
import hmac
import logging
import os
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from backend.auth import get_current_user
from backend.db import get_db
from backend.entitlements import (
    apply_entitlement_state,
    is_pro_now,
    is_state_stale,
    refresh_from_revenuecat,
)
from backend.models import AuthUser
from backend.services import revenuecat_service
from backend.services.revenuecat_service import PRO_ENTITLEMENT_ID

logger = logging.getLogger(__name__)

router = APIRouter()

# Event types that mean "the entitlement is (still) granted". Expiry is
# carried separately via expiration_at_ms, so a purchase with a known end
# date stores both. NON_RENEWING_PURCHASE covers promotional grants.
GRANT_EVENTS = {
    "INITIAL_PURCHASE",
    "RENEWAL",
    "UNCANCELLATION",
    "PRODUCT_CHANGE",
    "NON_RENEWING_PURCHASE",
}
# Events that mean access ended now. REFUND is a distinct lifecycle event
# (immediate revocation); CANCELLATION with cancel_reason=CUSTOMER_SUPPORT is
# handled separately below for older payload shapes.
REVOKE_EVENTS = {"EXPIRATION", "REFUND"}
# Acknowledged without changing state:
# - CANCELLATION = auto-renew turned off; access continues until expiry
#   (EXPIRATION arrives later). EXCEPT cancel_reason=CUSTOMER_SUPPORT, which
#   is a refund → revoke immediately.
# - BILLING_ISSUE = grace period; RevenueCat sends EXPIRATION if it lapses.
NOOP_EVENTS = {
    "CANCELLATION",
    "BILLING_ISSUE",
    "SUBSCRIPTION_PAUSED",
    "SUBSCRIPTION_EXTENDED",
    "SUBSCRIBER_ALIAS",
    "TEST",
}


def _webhook_secret() -> str:
    return (os.getenv("REVENUECAT_WEBHOOK_AUTH_TOKEN") or "").strip()


def _event_is_stale(user: AuthUser, event_ts) -> bool:
    """True when *event_ts* is older than the user's last-applied webhook
    event watermark — such deliveries must never mutate state."""
    stored = getattr(user, "pro_entitlement_event_ts_ms", None)
    try:
        return event_ts is not None and stored is not None and int(event_ts) < int(stored)
    except (ValueError, TypeError):
        return False


def _advance_watermark(user: AuthUser, event_ts) -> None:
    """Move the event watermark forward only — never backwards."""
    if event_ts is None:
        return
    try:
        ts = int(event_ts)
    except (ValueError, TypeError):
        return
    stored = getattr(user, "pro_entitlement_event_ts_ms", None)
    user.pro_entitlement_event_ts_ms = ts if stored is None else max(ts, int(stored))


def _ms_to_iso(ms) -> str | None:
    try:
        return datetime.fromtimestamp(int(ms) / 1000, tz=timezone.utc).isoformat()
    except (ValueError, TypeError, OSError):
        return None


@router.post("/revenuecat/webhook")
async def revenuecat_webhook(request: Request, db: Session = Depends(get_db)):
    secret = _webhook_secret()
    if not secret:
        # Fail closed: without a configured secret we cannot authenticate the
        # caller, so we must not accept entitlement mutations.
        raise HTTPException(status_code=503, detail="Webhook not configured")

    provided = request.headers.get("Authorization", "")
    # RevenueCat sends the header value exactly as configured in the
    # dashboard; accept both the raw value and a "Bearer " prefixed form.
    if not (
        hmac.compare_digest(provided, secret)
        or hmac.compare_digest(provided, f"Bearer {secret}")
    ):
        raise HTTPException(status_code=401, detail="Unauthorized")

    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    event = (body or {}).get("event") or {}
    etype = str(event.get("type") or "").upper()
    app_user_id = event.get("app_user_id") or event.get("original_app_user_id")
    event_ts = event.get("event_timestamp_ms")

    if etype == "TRANSFER":
        # Entitlement moved between RevenueCat identities. Revoke every known
        # source account immediately; verify the destination against the REST
        # API (TRANSFER payloads don't carry entitlement/expiry details). If
        # verification isn't possible, the destination is left fail-closed
        # with stale state so the next Pro-gated request re-verifies.
        handled = False
        for uid in (event.get("transferred_from") or []):
            src = db.query(AuthUser).filter(AuthUser.id == str(uid)).first()
            if src and not _event_is_stale(src, event_ts):
                apply_entitlement_state(
                    src, active=False, expires_at=None,
                    source="webhook", event_ts_ms=event_ts,
                )
                handled = True
        db.commit()
        for uid in (event.get("transferred_to") or []):
            dst = db.query(AuthUser).filter(AuthUser.id == str(uid)).first()
            if not dst or _event_is_stale(dst, event_ts):
                continue
            handled = True
            refreshed = False
            if revenuecat_service.is_configured():
                try:
                    refreshed = await refresh_from_revenuecat(dst, db)
                except Exception as exc:
                    logger.warning("Transfer refresh failed for %s: %s", dst.id, exc)
            if refreshed:
                _advance_watermark(dst, event_ts)
                db.commit()
            else:
                # Couldn't verify now: fail closed, and clear updated_at so the
                # state counts as stale and gets re-verified on the next gate.
                apply_entitlement_state(
                    dst, active=False, expires_at=None,
                    source="webhook", event_ts_ms=event_ts,
                )
                dst.pro_entitlement_updated_at = None
                db.commit()
        if not handled:
            logger.warning("RevenueCat TRANSFER: no known users; acknowledged.")
        return {"ok": True, "handled": handled}

    if not etype or not app_user_id:
        logger.warning("RevenueCat webhook: missing type/app_user_id; acknowledged.")
        return {"ok": True, "handled": False}

    # RevenueCat app_user_id == backend AuthUser.id (Purchases.logIn(user.id)).
    # Anonymous SDK ids ($RCAnonymousID:…) won't match — log and acknowledge.
    user = db.query(AuthUser).filter(AuthUser.id == str(app_user_id)).first()
    if not user:
        logger.warning(
            "RevenueCat webhook: no user for app_user_id=%s (event %s); acknowledged.",
            app_user_id, etype,
        )
        return {"ok": True, "handled": False}

    # Only the Pro entitlement matters. If the event names entitlements and
    # none of them is ours, acknowledge without touching state.
    ent_ids = event.get("entitlement_ids") or (
        [event["entitlement_id"]] if event.get("entitlement_id") else []
    )
    if ent_ids and PRO_ENTITLEMENT_ID not in ent_ids:
        return {"ok": True, "handled": False}

    # Idempotency / ordering: drop deliveries older than the last APPLIED
    # webhook event (retries and out-of-order deliveries happen).
    stored_ts = getattr(user, "pro_entitlement_event_ts_ms", None)
    try:
        if event_ts is not None and stored_ts is not None and int(event_ts) < int(stored_ts):
            return {"ok": True, "handled": False, "reason": "stale-event"}
    except (ValueError, TypeError):
        pass

    expires_iso = _ms_to_iso(event.get("expiration_at_ms"))

    if etype in GRANT_EVENTS:
        apply_entitlement_state(
            user, active=True, expires_at=expires_iso,
            source="webhook", event_ts_ms=event_ts,
        )
    elif etype in REVOKE_EVENTS:
        apply_entitlement_state(
            user, active=False, expires_at=expires_iso,
            source="webhook", event_ts_ms=event_ts,
        )
    elif etype == "CANCELLATION" and str(event.get("cancel_reason") or "").upper() == "CUSTOMER_SUPPORT":
        # Refund issued by support — access is revoked immediately.
        apply_entitlement_state(
            user, active=False, expires_at=expires_iso,
            source="webhook", event_ts_ms=event_ts,
        )
    elif etype in NOOP_EVENTS:
        return {"ok": True, "handled": False}
    else:
        logger.info("RevenueCat webhook: unrecognized event type %s; acknowledged.", etype)
        return {"ok": True, "handled": False}

    db.commit()
    return {"ok": True, "handled": True}


@router.get("/subscription/status")
async def subscription_status(
    user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """The server's view of the caller's Pro entitlement. Refreshes from the
    RevenueCat REST API first when the stored state is missing or stale."""
    refreshed = False
    if is_state_stale(user) and revenuecat_service.is_configured():
        try:
            refreshed = await refresh_from_revenuecat(user, db)
        except Exception as exc:
            logger.warning("Subscription status refresh failed for %s: %s", user.id, exc)
    return {
        "is_pro": is_pro_now(user),
        "entitlement": PRO_ENTITLEMENT_ID,
        "expires_at": getattr(user, "pro_entitlement_expires_at", None),
        "updated_at": getattr(user, "pro_entitlement_updated_at", None),
        "source": getattr(user, "pro_entitlement_source", None),
        "refreshed": refreshed,
    }
