"""Tests that the OAuth router has no demo/localhost fallbacks: unconfigured
providers must fail fast with 503, and configured providers must use the
env-provided values."""
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool
from sqlalchemy.orm import sessionmaker

from backend.db import Base, get_db
from backend.auth import get_current_user
from backend.routers import oauth

TEST_USER_ID = "oauth-test-user"


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
    app.dependency_overrides[get_db] = lambda: session
    app.dependency_overrides[get_current_user] = lambda: FakeUser()

    with TestClient(app) as c:
        yield c

    session.close()
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


def _unconfigure(monkeypatch, provider):
    for suffix in ("CLIENT_ID", "CLIENT_SECRET", "REDIRECT_URI"):
        monkeypatch.setattr(oauth, f"{provider}_{suffix}", None)


def _configure(monkeypatch, provider):
    monkeypatch.setattr(oauth, f"{provider}_CLIENT_ID", f"real_{provider.lower()}_id")
    monkeypatch.setattr(oauth, f"{provider}_CLIENT_SECRET", f"real_{provider.lower()}_secret")
    monkeypatch.setattr(
        oauth, f"{provider}_REDIRECT_URI",
        f"https://api.earningsninja.app/api/oauth/{provider.lower()}/callback",
    )


def test_no_demo_fallbacks_in_source():
    import inspect
    src = inspect.getsource(oauth)
    assert "demo_uber" not in src
    assert "demo_shipt" not in src
    assert "http://localhost" not in src


@pytest.mark.parametrize("provider", ["uber", "shipt"])
def test_unconfigured_authorize_returns_503(client, monkeypatch, provider):
    _unconfigure(monkeypatch, provider.upper())
    r = client.get(f"/api/oauth/{provider}/authorize")
    assert r.status_code == 503
    assert "not configured" in r.json()["detail"]


@pytest.mark.parametrize("provider", ["uber", "shipt"])
def test_unconfigured_callback_returns_503(client, monkeypatch, provider):
    _unconfigure(monkeypatch, provider.upper())
    r = client.get(
        f"/api/oauth/{provider}/callback",
        params={"code": "x", "state": "y"},
    )
    assert r.status_code == 503
    assert "not configured" in r.json()["detail"]


@pytest.mark.parametrize("provider", ["uber", "shipt"])
def test_partially_configured_still_503(client, monkeypatch, provider):
    p = provider.upper()
    _unconfigure(monkeypatch, p)
    monkeypatch.setattr(oauth, f"{p}_CLIENT_ID", "some_id")  # secret+redirect missing
    r = client.get(f"/api/oauth/{provider}/authorize")
    assert r.status_code == 503


def test_configured_authorize_uses_env_values(client, monkeypatch):
    _configure(monkeypatch, "UBER")
    r = client.get("/api/oauth/uber/authorize")
    assert r.status_code == 200
    url = r.json()["auth_url"]
    assert "client_id=real_uber_id" in url
    assert "https://api.earningsninja.app/api/oauth/uber/callback" in url
    assert "demo" not in url
    assert "localhost" not in url


def test_configured_shipt_authorize_uses_env_values(client, monkeypatch):
    _configure(monkeypatch, "SHIPT")
    r = client.get("/api/oauth/shipt/authorize")
    assert r.status_code == 200
    url = r.json()["auth_url"]
    assert "client_id=real_shipt_id" in url
    assert "localhost" not in url
