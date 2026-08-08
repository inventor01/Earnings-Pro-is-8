"""Security-audit M-1: clients must never see raw exception text. These tests
force internal failures in the OAuth callbacks and rollup parsing and assert
the response detail is a fixed generic message."""
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool
from sqlalchemy.orm import sessionmaker

from backend.db import Base, get_db
from backend.auth import get_current_user
from backend.routers import oauth, rollup

TEST_USER_ID = "sanitize-test-user"
SECRET_MARKER = "super-secret-internal-detail"


class FakeUser:
    id = TEST_USER_ID


@pytest.fixture
def client():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSession()

    app = FastAPI()
    app.include_router(oauth.router, prefix="/api")
    app.include_router(rollup.router, prefix="/api")
    app.dependency_overrides[get_db] = lambda: session
    app.dependency_overrides[get_current_user] = lambda: FakeUser()

    with TestClient(app) as c:
        yield c

    session.close()
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


def _configure_provider(monkeypatch, provider):
    monkeypatch.setattr(oauth, f"{provider}_CLIENT_ID", "id")
    monkeypatch.setattr(oauth, f"{provider}_CLIENT_SECRET", "secret")
    monkeypatch.setattr(oauth, f"{provider}_REDIRECT_URI", "https://example.com/cb")


@pytest.mark.parametrize("provider", ["uber", "shipt"])
def test_oauth_callback_does_not_leak_exception_text(client, monkeypatch, provider):
    _configure_provider(monkeypatch, provider.upper())
    # Valid state so we get past verification, then blow up inside the try.
    state = oauth._issue_oauth_state(TEST_USER_ID, provider.upper())

    class ExplodingClient:
        def __init__(self, *a, **k):
            raise RuntimeError(SECRET_MARKER)

    monkeypatch.setattr(oauth.httpx, "AsyncClient", ExplodingClient)
    r = client.get(f"/api/oauth/{provider}/callback", params={"code": "x", "state": state})
    assert r.status_code == 400
    body = r.text
    assert SECRET_MARKER not in body
    assert "Could not complete" in r.json()["detail"]


def test_rollup_invalid_date_range_generic_message(client, monkeypatch):
    def boom(*a, **k):
        raise ValueError(SECRET_MARKER)

    monkeypatch.setattr(rollup, "get_est_date_range", boom)
    r = client.get("/api/rollup", params={"from_date": "2026-01-01", "to_date": "2026-01-31"})
    assert r.status_code == 400
    assert SECRET_MARKER not in r.text
    assert r.json()["detail"] == "Invalid date range. Use YYYY-MM-DD or ISO datetimes."


def test_rollup_malformed_iso_datetime_generic_message(client):
    r = client.get(
        "/api/rollup",
        params={"from_date": "2026-01-01Tnot-a-time", "to_date": "2026-01-31T00:00:00Z"},
    )
    assert r.status_code == 400
    assert r.json()["detail"] == "Invalid date range. Use YYYY-MM-DD or ISO datetimes."


def test_rollup_invalid_timeframe_generic_message(client, monkeypatch):
    def boom(*a, **k):
        raise ValueError(SECRET_MARKER)

    monkeypatch.setattr(rollup, "get_this_week", boom)
    r = client.get("/api/rollup", params={"timeframe": "THIS_WEEK"})
    assert r.status_code == 400
    assert SECRET_MARKER not in r.text
    assert r.json()["detail"] == "Invalid timeframe"


def test_rollup_unknown_timeframe_still_400(client):
    r = client.get("/api/rollup", params={"timeframe": "NOT_A_THING"})
    assert r.status_code == 400
    assert r.json()["detail"] == "Invalid timeframe"
