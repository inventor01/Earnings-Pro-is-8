"""Server-side Pro entitlement helpers.

The stored state on AuthUser (pro_entitlement_*) is the backend's source of
truth for gating Pro-only API behavior. It is kept current by:

1. The RevenueCat webhook (`backend/routers/subscription.py`) — pushed updates
   on purchase / renewal / expiration / refund events.
2. An on-demand REST fallback (`refresh_from_revenuecat`) — used when the
   stored state is missing or stale (e.g. webhook not configured yet, missed
   delivery, or an active subscription whose stored expiry has passed).

Client-side gating remains fail-open by design (presentation only); this
module is the enforcement backstop: `require_pro` fails CLOSED with a 403.
"""
import logging
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.auth import get_current_user
from backend.db import get_db
from backend.models import AuthUser
from backend.services import revenuecat_service

logger = logging.getLogger(__name__)

# Stored state older than this is re-verified against RevenueCat before a
# Pro-gated request is rejected (only when the secret API key is configured).
STALE_AFTER = timedelta(hours=24)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _parse_iso(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except (ValueError, TypeError):
        return None


def is_pro_now(user: AuthUser) -> bool:
    """True when the stored state says the user's Pro entitlement is active
    right now (active flag set AND expiry, if any, in the future)."""
    if not bool(getattr(user, "pro_entitlement_active", False)):
        return False
    expires = _parse_iso(getattr(user, "pro_entitlement_expires_at", None))
    return expires is None or expires > _now()


def is_state_stale(user: AuthUser) -> bool:
    """True when the stored entitlement state should be re-verified against
    RevenueCat: never written, older than STALE_AFTER, or marked active but
    past its stored expiry (renewal may have happened without a webhook)."""
    updated = _parse_iso(getattr(user, "pro_entitlement_updated_at", None))
    if updated is None:
        return True
    if bool(getattr(user, "pro_entitlement_active", False)):
        expires = _parse_iso(getattr(user, "pro_entitlement_expires_at", None))
        if expires is not None and expires <= _now():
            return True
    return _now() - updated > STALE_AFTER


def apply_entitlement_state(
    user: AuthUser,
    *,
    active: bool,
    expires_at: str | None,
    source: str,
    event_ts_ms: int | None = None,
) -> None:
    """Write new entitlement state onto *user* (caller commits)."""
    user.pro_entitlement_active = bool(active)
    user.pro_entitlement_expires_at = expires_at
    user.pro_entitlement_updated_at = _now().isoformat()
    user.pro_entitlement_source = source
    if event_ts_ms is not None:
        user.pro_entitlement_event_ts_ms = int(event_ts_ms)


async def refresh_from_revenuecat(user: AuthUser, db: Session) -> bool:
    """On-demand REST fallback: query RevenueCat and refresh the stored state.
    Returns True when a definitive answer was obtained and stored; False when
    the check couldn't run (unconfigured / network error) — stored state is
    left untouched in that case."""
    state = await revenuecat_service.fetch_pro_entitlement(user.id)
    if state is None:
        return False
    apply_entitlement_state(
        user,
        active=state["active"],
        expires_at=state["expires_at"],
        source="rest",
    )
    db.commit()
    return True


async def require_pro(
    user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AuthUser:
    """FastAPI dependency for Pro-only endpoints. Fails CLOSED: non-Pro users
    get a generic 403. When the stored state is missing/stale, a live
    RevenueCat check runs first so a paying user is never wrongly rejected."""
    if is_pro_now(user):
        return user
    if is_state_stale(user) and revenuecat_service.is_configured():
        try:
            await refresh_from_revenuecat(user, db)
        except Exception as exc:  # never 500 a gate on a lookup hiccup
            logger.warning("Pro re-verification failed for %s: %s", user.id, exc)
        if is_pro_now(user):
            return user
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Pro subscription required",
    )
