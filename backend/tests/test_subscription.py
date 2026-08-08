"""Tests for server-side Pro verification: the RevenueCat webhook (auth,
event handling, idempotent ordering), the /api/subscription/status endpoint
(stored state + REST fallback), and the require_pro gating dependency."""
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool
from sqlalchemy.orm import sessionmaker

from backend.db import Base, get_db
from backend.auth import get_current_user
from backend import entitlements
from backend.entitlements import require_pro
from backend.models import AuthUser
from backend.routers import subscription, suggestions
from backend.services import revenuecat_service

USER_ID = "sub-test-user"
SECRET = "whsec-test-secret"


def _now_ms() -> int:
    return int(datetime.now(timezone.utc).timestamp() * 1000)


def _future_ms(days=30) -> int:
    return int((datetime.now(timezone.utc) + timedelta(days=days)).timestamp() * 1000)


@pytest.fixture
def setup(monkeypatch):
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSession()

    user = AuthUser(id=USER_ID, email="sub@test.com")
    session.add(user)
    session.commit()

    app = FastAPI()
    app.include_router(subscription.router, prefix="/api")
    app.include_router(suggestions.router, prefix="/api")

    @app.get("/api/pro-only")
    async def pro_only(u: AuthUser = Depends(require_pro)):
        return {"ok": True}

    app.dependency_overrides[get_db] = lambda: session
    app.dependency_overrides[get_current_user] = lambda: session.query(AuthUser).get(USER_ID)

    monkeypatch.setenv("REVENUECAT_WEBHOOK_AUTH_TOKEN", SECRET)

    with TestClient(app) as c:
        yield c, session

    session.close()
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


def _event(etype, **overrides):
    ev = {
        "type": etype,
        "app_user_id": USER_ID,
        "entitlement_ids": ["pro"],
        "event_timestamp_ms": _now_ms(),
        "expiration_at_ms": _future_ms(),
    }
    ev.update(overrides)
    return {"api_version": "1.0", "event": ev}


def _post(client, payload, auth=SECRET):
    headers = {"Authorization": auth} if auth is not None else {}
    return client.post("/api/revenuecat/webhook", json=payload, headers=headers)


def _user(session):
    session.expire_all()
    return session.query(AuthUser).get(USER_ID)


# ── webhook auth ────────────────────────────────────────────────────────────

def test_webhook_missing_auth_rejected(setup):
    client, _ = setup
    assert _post(client, _event("INITIAL_PURCHASE"), auth=None).status_code == 401


def test_webhook_wrong_auth_rejected(setup):
    client, _ = setup
    assert _post(client, _event("INITIAL_PURCHASE"), auth="nope").status_code == 401


def test_webhook_bearer_prefixed_auth_accepted(setup):
    client, session = setup
    r = _post(client, _event("INITIAL_PURCHASE"), auth=f"Bearer {SECRET}")
    assert r.status_code == 200 and r.json()["handled"] is True


def test_webhook_unconfigured_fails_closed(setup, monkeypatch):
    client, _ = setup
    monkeypatch.delenv("REVENUECAT_WEBHOOK_AUTH_TOKEN")
    assert _post(client, _event("INITIAL_PURCHASE")).status_code == 503


# ── event handling ──────────────────────────────────────────────────────────

def test_purchase_sets_pro(setup):
    client, session = setup
    r = _post(client, _event("INITIAL_PURCHASE"))
    assert r.status_code == 200 and r.json()["handled"] is True
    u = _user(session)
    assert u.pro_entitlement_active is True
    assert u.pro_entitlement_source == "webhook"
    assert entitlements.is_pro_now(u)


def test_expiration_clears_pro(setup):
    client, session = setup
    _post(client, _event("INITIAL_PURCHASE", event_timestamp_ms=_now_ms() - 1000))
    r = _post(client, _event("EXPIRATION", expiration_at_ms=_now_ms()))
    assert r.json()["handled"] is True
    assert not entitlements.is_pro_now(_user(session))


def test_cancellation_keeps_access_until_expiry(setup):
    client, session = setup
    _post(client, _event("INITIAL_PURCHASE", event_timestamp_ms=_now_ms() - 1000))
    r = _post(client, _event("CANCELLATION", cancel_reason="UNSUBSCRIBE"))
    assert r.json()["handled"] is False
    assert entitlements.is_pro_now(_user(session))


def test_refund_revokes_immediately(setup):
    client, session = setup
    _post(client, _event("INITIAL_PURCHASE", event_timestamp_ms=_now_ms() - 1000))
    r = _post(client, _event("CANCELLATION", cancel_reason="CUSTOMER_SUPPORT"))
    assert r.json()["handled"] is True
    assert not _user(session).pro_entitlement_active


def test_refund_event_revokes_immediately(setup, monkeypatch):
    """A REFUND on an active, future-dated entitlement revokes access right
    away — and require_pro stops granting without waiting for staleness."""
    client, session = setup
    monkeypatch.setattr(revenuecat_service, "is_configured", lambda: False)
    _post(client, _event("INITIAL_PURCHASE", event_timestamp_ms=_now_ms() - 1000))
    assert client.get("/api/pro-only").status_code == 200
    r = _post(client, _event("REFUND"))
    assert r.json()["handled"] is True
    assert not _user(session).pro_entitlement_active
    assert client.get("/api/pro-only").status_code == 403


def test_stale_refund_does_not_clobber_newer_purchase(setup):
    client, session = setup
    ts = _now_ms()
    _post(client, _event("INITIAL_PURCHASE", event_timestamp_ms=ts))
    r = _post(client, _event("REFUND", event_timestamp_ms=ts - 60000))
    assert r.json()["handled"] is False
    assert entitlements.is_pro_now(_user(session))


def test_transfer_revokes_source_immediately(setup, monkeypatch):
    """A TRANSFER away from a known user kills their Pro access at once —
    require_pro must 403 without waiting for the 24h stale window."""
    client, session = setup
    monkeypatch.setattr(revenuecat_service, "is_configured", lambda: False)
    _post(client, _event("INITIAL_PURCHASE", event_timestamp_ms=_now_ms() - 1000))
    assert client.get("/api/pro-only").status_code == 200
    r = _post(client, _event(
        "TRANSFER",
        app_user_id=None,
        transferred_from=[USER_ID],
        transferred_to=["$RCAnonymousID:other"],
        entitlement_ids=None,
        expiration_at_ms=None,
    ))
    assert r.status_code == 200 and r.json()["handled"] is True
    assert not _user(session).pro_entitlement_active
    assert client.get("/api/pro-only").status_code == 403


def test_transfer_destination_verified_via_rest(setup, monkeypatch):
    """A TRANSFER to a known user reconciles their state via the REST API."""
    client, session = setup
    monkeypatch.setattr(revenuecat_service, "is_configured", lambda: True)

    async def fake_fetch(app_user_id):
        assert app_user_id == USER_ID
        return {"active": True, "expires_at": None}

    monkeypatch.setattr(revenuecat_service, "fetch_pro_entitlement", fake_fetch)
    r = _post(client, _event(
        "TRANSFER",
        app_user_id=None,
        transferred_from=["$RCAnonymousID:old"],
        transferred_to=[USER_ID],
        entitlement_ids=None,
        expiration_at_ms=None,
    ))
    assert r.json()["handled"] is True
    u = _user(session)
    assert u.pro_entitlement_active is True and u.pro_entitlement_source == "rest"
    assert client.get("/api/pro-only").status_code == 200


def test_transfer_destination_fails_closed_when_unverifiable(setup, monkeypatch):
    client, session = setup
    monkeypatch.setattr(revenuecat_service, "is_configured", lambda: False)
    # Give the destination a (bogus) pre-existing active state to prove the
    # unverifiable transfer clears it rather than trusting it.
    _post(client, _event("INITIAL_PURCHASE", event_timestamp_ms=_now_ms() - 1000))
    r = _post(client, _event(
        "TRANSFER",
        app_user_id=None,
        transferred_from=["$RCAnonymousID:old"],
        transferred_to=[USER_ID],
        entitlement_ids=None,
        expiration_at_ms=None,
    ))
    assert r.json()["handled"] is True
    u = _user(session)
    assert not u.pro_entitlement_active
    assert u.pro_entitlement_updated_at is None  # stale → re-verified next gate
    assert client.get("/api/pro-only").status_code == 403


def test_stale_transfer_does_not_revoke_repurchased_source(setup, monkeypatch):
    """A delayed TRANSFER older than a newer purchase must not revoke it."""
    client, session = setup
    monkeypatch.setattr(revenuecat_service, "is_configured", lambda: False)
    ts = _now_ms()
    _post(client, _event("INITIAL_PURCHASE", event_timestamp_ms=ts))
    r = _post(client, _event(
        "TRANSFER",
        app_user_id=None,
        event_timestamp_ms=ts - 60000,
        transferred_from=[USER_ID],
        transferred_to=["$RCAnonymousID:other"],
        entitlement_ids=None,
        expiration_at_ms=None,
    ))
    assert r.json()["handled"] is False
    assert entitlements.is_pro_now(_user(session))
    assert client.get("/api/pro-only").status_code == 200


def test_stale_transfer_does_not_clear_destination(setup, monkeypatch):
    """A replayed old TRANSFER-to must not clobber a newer entitlement, even
    when REST verification is unavailable."""
    client, session = setup
    monkeypatch.setattr(revenuecat_service, "is_configured", lambda: False)
    ts = _now_ms()
    _post(client, _event("INITIAL_PURCHASE", event_timestamp_ms=ts))
    r = _post(client, _event(
        "TRANSFER",
        app_user_id=None,
        event_timestamp_ms=ts - 60000,
        transferred_from=["$RCAnonymousID:old"],
        transferred_to=[USER_ID],
        entitlement_ids=None,
        expiration_at_ms=None,
    ))
    assert r.json()["handled"] is False
    u = _user(session)
    assert entitlements.is_pro_now(u)
    assert int(u.pro_entitlement_event_ts_ms) == ts  # watermark untouched


def test_transfer_rest_refresh_never_lowers_watermark(setup, monkeypatch):
    """REST reconciliation after a TRANSFER must not move the event watermark
    backwards (which would let other stale events apply later)."""
    client, session = setup
    monkeypatch.setattr(revenuecat_service, "is_configured", lambda: True)

    async def fake_fetch(app_user_id):
        return {"active": True, "expires_at": None}

    monkeypatch.setattr(revenuecat_service, "fetch_pro_entitlement", fake_fetch)
    ts = _now_ms()
    _post(client, _event("INITIAL_PURCHASE", event_timestamp_ms=ts))
    # Equal-timestamp transfer (not stale) triggers REST refresh; watermark
    # must end >= the purchase watermark.
    _post(client, _event(
        "TRANSFER",
        app_user_id=None,
        event_timestamp_ms=ts,
        transferred_from=["$RCAnonymousID:old"],
        transferred_to=[USER_ID],
        entitlement_ids=None,
        expiration_at_ms=None,
    ))
    assert int(_user(session).pro_entitlement_event_ts_ms) >= ts


def test_stale_event_ignored(setup):
    client, session = setup
    ts = _now_ms()
    _post(client, _event("INITIAL_PURCHASE", event_timestamp_ms=ts))
    # An older EXPIRATION delivered late must not clobber the newer state.
    r = _post(client, _event("EXPIRATION", event_timestamp_ms=ts - 60000))
    assert r.json()["handled"] is False
    assert entitlements.is_pro_now(_user(session))


def test_unknown_user_acknowledged(setup):
    client, _ = setup
    r = _post(client, _event("INITIAL_PURCHASE", app_user_id="$RCAnonymousID:abc"))
    assert r.status_code == 200 and r.json()["handled"] is False


def test_other_entitlement_ignored(setup):
    client, session = setup
    r = _post(client, _event("INITIAL_PURCHASE", entitlement_ids=["other"]))
    assert r.json()["handled"] is False
    assert not _user(session).pro_entitlement_active


def test_unknown_event_type_acknowledged(setup):
    client, _ = setup
    r = _post(client, _event("SOMETHING_NEW"))
    assert r.status_code == 200 and r.json()["handled"] is False


# ── status endpoint ─────────────────────────────────────────────────────────

def test_status_reflects_stored_state(setup, monkeypatch):
    client, session = setup
    monkeypatch.setattr(revenuecat_service, "is_configured", lambda: False)
    assert client.get("/api/subscription/status").json()["is_pro"] is False
    _post(client, _event("INITIAL_PURCHASE"))
    body = client.get("/api/subscription/status").json()
    assert body["is_pro"] is True and body["source"] == "webhook"


def test_status_rest_fallback_when_missing(setup, monkeypatch):
    client, session = setup
    monkeypatch.setattr(revenuecat_service, "is_configured", lambda: True)

    async def fake_fetch(app_user_id):
        assert app_user_id == USER_ID
        return {"active": True, "expires_at": None}

    monkeypatch.setattr(revenuecat_service, "fetch_pro_entitlement", fake_fetch)
    body = client.get("/api/subscription/status").json()
    assert body["is_pro"] is True and body["refreshed"] is True and body["source"] == "rest"


def test_status_rest_failure_leaves_state(setup, monkeypatch):
    client, session = setup
    monkeypatch.setattr(revenuecat_service, "is_configured", lambda: True)

    async def fake_fetch(app_user_id):
        return None  # lookup failed — unknown, not "not pro"

    monkeypatch.setattr(revenuecat_service, "fetch_pro_entitlement", fake_fetch)
    body = client.get("/api/subscription/status").json()
    assert body["is_pro"] is False and body["refreshed"] is False


# ── require_pro gating ──────────────────────────────────────────────────────

def test_require_pro_rejects_free_user(setup, monkeypatch):
    client, _ = setup
    monkeypatch.setattr(revenuecat_service, "is_configured", lambda: False)
    r = client.get("/api/pro-only")
    assert r.status_code == 403
    assert r.json()["detail"] == "Pro subscription required"


def test_require_pro_allows_pro_user(setup):
    client, _ = setup
    _post(client, _event("INITIAL_PURCHASE"))
    assert client.get("/api/pro-only").status_code == 200


def test_require_pro_rest_fallback_unlocks_paying_user(setup, monkeypatch):
    client, _ = setup
    monkeypatch.setattr(revenuecat_service, "is_configured", lambda: True)

    async def fake_fetch(app_user_id):
        return {"active": True, "expires_at": None}

    monkeypatch.setattr(revenuecat_service, "fetch_pro_entitlement", fake_fetch)
    assert client.get("/api/pro-only").status_code == 200


def test_suggestions_route_rejects_free_user(setup, monkeypatch):
    """/api/suggestions is a real Pro-gated production route."""
    client, _ = setup
    monkeypatch.setattr(revenuecat_service, "is_configured", lambda: False)
    r = client.get("/api/suggestions")
    assert r.status_code == 403
    assert r.json()["detail"] == "Pro subscription required"


def test_suggestions_route_allows_pro_user(setup, monkeypatch):
    client, _ = setup
    monkeypatch.setattr(
        suggestions, "get_ai_suggestions", lambda db, f, t, uid: {"suggestions": []}
    )
    _post(client, _event("INITIAL_PURCHASE"))
    assert client.get("/api/suggestions").status_code == 200


def test_suggestions_route_rest_verified_pro_user_allowed(setup, monkeypatch):
    client, _ = setup
    monkeypatch.setattr(revenuecat_service, "is_configured", lambda: True)

    async def fake_fetch(app_user_id):
        return {"active": True, "expires_at": None}

    monkeypatch.setattr(revenuecat_service, "fetch_pro_entitlement", fake_fetch)
    monkeypatch.setattr(
        suggestions, "get_ai_suggestions", lambda db, f, t, uid: {"suggestions": []}
    )
    assert client.get("/api/suggestions").status_code == 200


def test_require_pro_expired_entitlement_rejected(setup, monkeypatch):
    client, session = setup
    monkeypatch.setattr(revenuecat_service, "is_configured", lambda: False)
    past = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    u = session.query(AuthUser).get(USER_ID)
    u.pro_entitlement_active = True
    u.pro_entitlement_expires_at = past
    u.pro_entitlement_updated_at = datetime.now(timezone.utc).isoformat()
    session.commit()
    assert client.get("/api/pro-only").status_code == 403
