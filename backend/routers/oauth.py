from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from backend.db import get_db
from backend.models import ApiCredential, PlatformIntegration, AuthUser
from backend.auth import get_current_user, SECRET_KEY, JWT_ALGORITHM
import httpx
import jwt
import logging
import os
import secrets

router = APIRouter()

# OAuth credentials from environment — NO fallbacks. A provider is usable only
# when all three of its env vars are set; otherwise its endpoints return 503.
# This prevents a misconfigured deploy from silently running with demo
# credentials or localhost redirect URIs.
UBER_CLIENT_ID = os.getenv("UBER_CLIENT_ID")
UBER_CLIENT_SECRET = os.getenv("UBER_CLIENT_SECRET")
UBER_REDIRECT_URI = os.getenv("UBER_REDIRECT_URI")

SHIPT_CLIENT_ID = os.getenv("SHIPT_CLIENT_ID")
SHIPT_CLIENT_SECRET = os.getenv("SHIPT_CLIENT_SECRET")
SHIPT_REDIRECT_URI = os.getenv("SHIPT_REDIRECT_URI")

logger = logging.getLogger(__name__)


def _provider_config(provider: str):
    """Return (client_id, client_secret, redirect_uri) for a configured
    provider, or raise 503 if any piece is missing. Reads module globals so
    tests can monkeypatch them."""
    if provider == "UBER":
        cfg = (UBER_CLIENT_ID, UBER_CLIENT_SECRET, UBER_REDIRECT_URI)
    elif provider == "SHIPT":
        cfg = (SHIPT_CLIENT_ID, SHIPT_CLIENT_SECRET, SHIPT_REDIRECT_URI)
    else:
        raise HTTPException(status_code=404, detail="Unknown provider")
    if not all(cfg):
        raise HTTPException(
            status_code=503,
            detail=f"{provider.capitalize()} integration is not configured",
        )
    return cfg


_unconfigured = [
    p for p, cfg in (
        ("UBER", (UBER_CLIENT_ID, UBER_CLIENT_SECRET, UBER_REDIRECT_URI)),
        ("SHIPT", (SHIPT_CLIENT_ID, SHIPT_CLIENT_SECRET, SHIPT_REDIRECT_URI)),
    ) if not all(cfg)
]
if _unconfigured:
    logger.warning(
        "OAuth providers not configured (endpoints will return 503): %s",
        ", ".join(_unconfigured),
    )

# OAuth `state` is a short-lived JWT binding the redirect back to one user.
# Without this, the callback couldn't tell which logged-in user the
# authorization-code belongs to (and an attacker could trick a victim into
# linking the attacker's upstream account to the victim's Earnings Ninja
# account — classic CSRF on the OAuth callback). The nonce defeats replay.
OAUTH_STATE_TTL = timedelta(minutes=10)


def _issue_oauth_state(user_id: str, platform: str) -> str:
    now = datetime.utcnow()
    payload = {
        "sub": user_id,
        "platform": platform,
        "nonce": secrets.token_urlsafe(16),
        "iat": now,
        "exp": now + OAUTH_STATE_TTL,
        "purpose": "oauth_state",
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=JWT_ALGORITHM)


def _verify_oauth_state(state: str, expected_platform: str) -> str:
    """Returns the user_id encoded in the state, or raises 400."""
    try:
        claims = jwt.decode(
            state,
            SECRET_KEY,
            algorithms=[JWT_ALGORITHM],
            options={"require": ["sub", "exp", "purpose", "platform"]},
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=400, detail="OAuth state expired — restart the connect flow")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=400, detail="OAuth state invalid")
    if claims.get("purpose") != "oauth_state":
        raise HTTPException(status_code=400, detail="OAuth state has wrong purpose")
    if claims.get("platform") != expected_platform:
        raise HTTPException(status_code=400, detail="OAuth state platform mismatch")
    return claims["sub"]


def _callback_html(message: str) -> HTMLResponse:
    # OAuth callbacks land in a browser, not the JSON-consuming app. A tiny
    # HTML page is friendlier than a raw JSON blob and lets the user know to
    # return to the app.
    safe = message.replace("<", "&lt;").replace(">", "&gt;")
    body = (
        "<!doctype html><meta charset='utf-8'><title>Earnings Ninja</title>"
        "<style>body{font-family:-apple-system,system-ui,sans-serif;background:#0a0a0a;"
        "color:#f1f5f9;display:grid;place-items:center;height:100vh;margin:0;text-align:center;padding:24px}"
        "h1{color:#facc15;margin:0 0 12px;font-size:22px}p{color:#94a3b8;margin:0;max-width:420px}</style>"
        f"<h1>Earnings Ninja</h1><p>{safe}</p>"
    )
    return HTMLResponse(body)


@router.get("/oauth/uber/authorize")
async def uber_authorize(current_user: AuthUser = Depends(get_current_user)):
    """Build the Uber OAuth authorize URL bound to the current user."""
    client_id, _, redirect_uri = _provider_config("UBER")
    state = _issue_oauth_state(current_user.id, "UBER")
    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "delivery.read delivery.write",
        "state": state,
    }
    query_string = "&".join([f"{k}={v}" for k, v in params.items()])
    return {"auth_url": f"https://login.uber.com/oauth/v2/authorize?{query_string}"}


@router.get("/oauth/uber/callback")
async def uber_callback(
    code: str = Query(...),
    state: str = Query(...),
    db: Session = Depends(get_db),
):
    """Handle Uber OAuth callback. The user_id comes from the signed `state`
    JWT — never from a query param or session cookie — so the credential
    is always bound to the user who initiated the connect flow."""
    client_id, client_secret, redirect_uri = _provider_config("UBER")
    user_id = _verify_oauth_state(state, "UBER")
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://login.uber.com/oauth/v2/token",
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "redirect_uri": redirect_uri,
                },
            )

            if response.status_code != 200:
                raise HTTPException(status_code=400, detail="Failed to get token from Uber")

            token_data = response.json()
            access_token = token_data.get("access_token")
            refresh_token = token_data.get("refresh_token")
            expires_in = token_data.get("expires_in", 3600)
            token_expires_at = datetime.utcnow() + timedelta(seconds=expires_in)

            cred = db.query(ApiCredential).filter(
                ApiCredential.user_id == user_id,
                ApiCredential.platform == PlatformIntegration.UBER,
            ).first()

            if cred:
                cred.access_token = access_token
                cred.refresh_token = refresh_token
                cred.token_expires_at = token_expires_at
                cred.is_active = 1
            else:
                cred = ApiCredential(
                    user_id=user_id,
                    platform=PlatformIntegration.UBER,
                    access_token=access_token,
                    refresh_token=refresh_token,
                    token_expires_at=token_expires_at,
                    is_active=1,
                )
                db.add(cred)

            db.commit()
            return _callback_html("Uber connected. You can close this window and return to the app.")

    except HTTPException:
        raise
    except Exception:
        # Never echo internal exception text to the browser — log it
        # server-side and return a generic message.
        logger.exception("Uber OAuth callback failed")
        raise HTTPException(status_code=400, detail="Could not complete the Uber connection. Please try again.")


@router.get("/oauth/shipt/authorize")
async def shipt_authorize(current_user: AuthUser = Depends(get_current_user)):
    client_id, _, redirect_uri = _provider_config("SHIPT")
    state = _issue_oauth_state(current_user.id, "SHIPT")
    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "orders.read orders.write",
        "state": state,
    }
    query_string = "&".join([f"{k}={v}" for k, v in params.items()])
    return {"auth_url": f"https://api.shipt.com/oauth/authorize?{query_string}"}


@router.get("/oauth/shipt/callback")
async def shipt_callback(
    code: str = Query(...),
    state: str = Query(...),
    db: Session = Depends(get_db),
):
    client_id, client_secret, redirect_uri = _provider_config("SHIPT")
    user_id = _verify_oauth_state(state, "SHIPT")
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.shipt.com/oauth/token",
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "redirect_uri": redirect_uri,
                },
            )

            if response.status_code != 200:
                raise HTTPException(status_code=400, detail="Failed to get token from Shipt")

            token_data = response.json()
            access_token = token_data.get("access_token")
            refresh_token = token_data.get("refresh_token")
            expires_in = token_data.get("expires_in", 3600)
            token_expires_at = datetime.utcnow() + timedelta(seconds=expires_in)

            cred = db.query(ApiCredential).filter(
                ApiCredential.user_id == user_id,
                ApiCredential.platform == PlatformIntegration.SHIPT,
            ).first()

            if cred:
                cred.access_token = access_token
                cred.refresh_token = refresh_token
                cred.token_expires_at = token_expires_at
                cred.is_active = 1
            else:
                cred = ApiCredential(
                    user_id=user_id,
                    platform=PlatformIntegration.SHIPT,
                    access_token=access_token,
                    refresh_token=refresh_token,
                    token_expires_at=token_expires_at,
                    is_active=1,
                )
                db.add(cred)

            db.commit()
            return _callback_html("Shipt connected. You can close this window and return to the app.")

    except HTTPException:
        raise
    except Exception:
        logger.exception("Shipt OAuth callback failed")
        raise HTTPException(status_code=400, detail="Could not complete the Shipt connection. Please try again.")


@router.delete("/oauth/{platform}/disconnect")
async def disconnect_platform(
    platform: str,
    db: Session = Depends(get_db),
    current_user: AuthUser = Depends(get_current_user),
):
    """Disconnect one of the current user's OAuth connections."""
    try:
        platform_enum = PlatformIntegration[platform.upper()]
    except KeyError:
        raise HTTPException(status_code=400, detail=f"Unknown platform: {platform}")

    cred = db.query(ApiCredential).filter(
        ApiCredential.user_id == current_user.id,
        ApiCredential.platform == platform_enum,
    ).first()

    if not cred:
        raise HTTPException(status_code=404, detail=f"No connection found for {platform}")

    cred.is_active = 0
    db.commit()
    return {"message": f"{platform} account disconnected"}


@router.get("/oauth/status")
async def get_oauth_status(
    db: Session = Depends(get_db),
    current_user: AuthUser = Depends(get_current_user),
):
    """Status of the current user's OAuth connections only."""
    credentials = db.query(ApiCredential).filter(
        ApiCredential.user_id == current_user.id,
    ).all()

    status = {}
    for cred in credentials:
        status[cred.platform.value] = {
            "connected": bool(cred.is_active),
            "token_expires_at": cred.token_expires_at.isoformat() if cred.token_expires_at else None,
        }

    return status
