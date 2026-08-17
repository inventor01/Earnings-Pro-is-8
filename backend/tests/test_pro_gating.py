"""Server-side Pro enforcement: /api/entries/import requires an active Pro
entitlement (require_pro fails CLOSED with 403 for free users; the client
paywall is presentation-only and does not count as authorization)."""
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool
from sqlalchemy.orm import sessionmaker

from backend.db import Base, get_db
from backend.auth import get_current_user
from backend.models import AuthUser, Entry
from backend.routers import entries

USER_ID = "pro-gate-user"


def _iso(dt):
    return dt.isoformat()


@pytest.fixture
def harness():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSession()

    user = AuthUser(id=USER_ID, email="pro@test.com", password_hash="x")
    session.add(user)
    session.commit()

    app = FastAPI()
    app.include_router(entries.router, prefix="/api")
    app.dependency_overrides[get_db] = lambda: session
    # Real require_pro runs (it depends on get_current_user, which we override
    # to return the REAL DB row so stored entitlement state is honored).
    app.dependency_overrides[get_current_user] = lambda: session.get(AuthUser, USER_ID)
    c = TestClient(app)
    yield c, session, user
    session.close()


ROW = [{
    "type": "ORDER", "app": "DOORDASH", "amount": 12.5,
    "date": "2026-08-15", "time": "12:00",
}]


def test_import_rejected_for_free_user(harness):
    c, session, user = harness
    r = c.post("/api/entries/import", json=ROW)
    assert r.status_code == 403
    assert "pro" in r.json()["detail"].lower()
    assert session.query(Entry).count() == 0


def test_import_allowed_for_active_pro(harness):
    c, session, user = harness
    user.pro_entitlement_active = True
    user.pro_entitlement_expires_at = _iso(datetime.now(timezone.utc) + timedelta(days=30))
    user.pro_entitlement_updated_at = _iso(datetime.now(timezone.utc))
    session.commit()
    r = c.post("/api/entries/import", json=ROW)
    assert r.status_code == 200
    assert session.query(Entry).count() == 1


def test_import_rejected_when_entitlement_expired(harness):
    c, session, user = harness
    user.pro_entitlement_active = True
    user.pro_entitlement_expires_at = _iso(datetime.now(timezone.utc) - timedelta(days=1))
    # Freshly updated state → not stale → no REST re-check → fail closed.
    user.pro_entitlement_updated_at = _iso(datetime.now(timezone.utc))
    session.commit()
    r = c.post("/api/entries/import", json=ROW)
    assert r.status_code == 403
    assert session.query(Entry).count() == 0
