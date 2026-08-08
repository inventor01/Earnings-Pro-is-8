"""Server-side RevenueCat helpers.

Only used to GRANT promotional entitlements (free months) earned through the
referral program. Uses the RevenueCat v1 REST API with the project's SECRET
API key (`REVENUECAT_SECRET_API_KEY`, an `sk_…` key) — this key is NEVER shipped
to the client.

The client identifies each user to RevenueCat via `Purchases.logIn(user.id)`,
so the RevenueCat `app_user_id` equals the backend `AuthUser.id`. That lets us
grant directly to `app_user_id` here. RevenueCat creates the subscriber on the
fly if they haven't opened the app yet, so a referee who hasn't launched the
app can still receive their reward.
"""

import logging
import os
from datetime import datetime, timezone
from urllib.parse import quote

import httpx

logger = logging.getLogger(__name__)

REVENUECAT_V1_BASE = "https://api.revenuecat.com/v1"

# The entitlement that unlocks Pro. MUST match PRO_ENTITLEMENT_ID in the Expo
# client (earnings-ninja-expo/lib/revenuecat.tsx) and the dashboard provisioning.
PRO_ENTITLEMENT_ID = os.getenv("REVENUECAT_ENTITLEMENT_ID", "pro")

# RevenueCat promotional durations are an enum, not arbitrary days. "monthly"
# grants ~1 month of access. (Others: daily, three_day, weekly, monthly,
# two_month, three_month, six_month, yearly, lifetime.)
PROMO_DURATION_MONTH = "monthly"


def _secret_key() -> str:
    return (os.getenv("REVENUECAT_SECRET_API_KEY") or "").strip()


def is_configured() -> bool:
    """True when a RevenueCat secret key is present so grants can be issued."""
    return bool(_secret_key())


async def grant_promotional_month(app_user_id: str) -> bool:
    """Grant one free month of the Pro entitlement to *app_user_id*.

    Returns True on success, False on any failure (missing key, network error,
    non-2xx response). Callers MUST treat a False as "reward not yet granted"
    and never let it abort the surrounding request (e.g. signup must still
    succeed even if RevenueCat is unreachable).
    """
    key = _secret_key()
    if not key:
        logger.warning(
            "RevenueCat secret key not configured (REVENUECAT_SECRET_API_KEY); "
            "skipping promotional grant for %s. Reward recorded as pending.",
            app_user_id,
        )
        return False

    if not app_user_id:
        return False

    url = (
        f"{REVENUECAT_V1_BASE}/subscribers/{quote(app_user_id, safe='')}"
        f"/entitlements/{quote(PRO_ENTITLEMENT_ID, safe='')}/promotional"
    )
    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }
    payload = {"duration": PROMO_DURATION_MONTH}

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(url, json=payload, headers=headers)
        if resp.status_code // 100 == 2:
            return True
        logger.warning(
            "RevenueCat promotional grant failed for %s: %s %s",
            app_user_id,
            resp.status_code,
            resp.text[:300],
        )
        return False
    except Exception as exc:  # network / timeout / unexpected
        logger.warning("RevenueCat promotional grant errored for %s: %s", app_user_id, exc)
        return False


async def fetch_pro_entitlement(app_user_id: str) -> dict | None:
    """Query the RevenueCat v1 subscribers API for *app_user_id*'s Pro state.

    Returns ``{"active": bool, "expires_at": str | None}`` on success (where
    ``expires_at`` is the raw ISO expiry, or None for no expiry / lifetime),
    or ``None`` when the check could not be performed (missing key, network
    error, non-2xx). Callers must treat ``None`` as "unknown" — never as
    "not Pro".
    """
    key = _secret_key()
    if not key or not app_user_id:
        return None

    url = f"{REVENUECAT_V1_BASE}/subscribers/{quote(app_user_id, safe='')}"
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url, headers={"Authorization": f"Bearer {key}"})
        if resp.status_code // 100 != 2:
            logger.warning(
                "RevenueCat subscriber lookup failed for %s: %s %s",
                app_user_id, resp.status_code, resp.text[:300],
            )
            return None
        data = resp.json()
    except Exception as exc:
        logger.warning("RevenueCat subscriber lookup errored for %s: %s", app_user_id, exc)
        return None

    ent = ((data.get("subscriber") or {}).get("entitlements") or {}).get(PRO_ENTITLEMENT_ID)
    if not ent:
        return {"active": False, "expires_at": None}

    expires = ent.get("expires_date")  # ISO8601, or None for lifetime access
    if not expires:
        return {"active": True, "expires_at": None}
    try:
        dt = datetime.fromisoformat(str(expires).replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return {"active": dt > datetime.now(timezone.utc), "expires_at": str(expires)}
    except (ValueError, TypeError):
        # Unparseable expiry — be conservative and treat as not active.
        return {"active": False, "expires_at": str(expires)}
