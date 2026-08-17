"""Heading-title label overrides (kind='heading', keys PLATFORM / TYPE).

The Add Entry form lets the user rename the "Platform" / "Type" section
headings themselves. Display-only: stored via the same /api/labels upsert as
built-in pill renames, capped at 12 characters server-side.
"""
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool
from sqlalchemy.orm import sessionmaker

from backend.db import Base, get_db
from backend.auth import get_current_user
from backend.models import AuthUser
from backend.routers import platforms

USER_ID = "heading-user"


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
    session.add(AuthUser(id=USER_ID, email="heading@test.com", password_hash="x"))
    session.commit()

    app = FastAPI()
    app.include_router(platforms.router, prefix="/api")
    app.dependency_overrides[get_db] = lambda: session
    app.dependency_overrides[get_current_user] = lambda: session.get(AuthUser, USER_ID)
    c = TestClient(app)
    yield c
    session.close()


def _headings(rows):
    return [o for o in rows if o["kind"] == "heading"]


def test_set_and_list_heading_label(client):
    r = client.put("/api/labels", json={"kind": "heading", "key": "PLATFORM", "label": "Gig App"})
    assert r.status_code == 200
    assert _headings(r.json()) == [{"kind": "heading", "key": "PLATFORM", "label": "Gig App"}]

    r = client.get("/api/labels")
    assert _headings(r.json()) == [{"kind": "heading", "key": "PLATFORM", "label": "Gig App"}]


def test_twelve_char_boundary(client):
    ok = client.put("/api/labels", json={"kind": "heading", "key": "TYPE", "label": "123456789012"})
    assert ok.status_code == 200

    too_long = client.put("/api/labels", json={"kind": "heading", "key": "TYPE", "label": "1234567890123"})
    assert too_long.status_code == 422


def test_whitespace_trimmed_and_blank_resets(client):
    client.put("/api/labels", json={"kind": "heading", "key": "PLATFORM", "label": "  App  "})
    r = client.get("/api/labels")
    assert _headings(r.json())[0]["label"] == "App"

    # Over the cap AFTER trimming is still rejected.
    r = client.put("/api/labels", json={"kind": "heading", "key": "PLATFORM", "label": "   1234567890123   "})
    assert r.status_code == 422

    # Empty label = reset to default (row deleted).
    r = client.put("/api/labels", json={"kind": "heading", "key": "PLATFORM", "label": ""})
    assert r.status_code == 200
    assert _headings(r.json()) == []


def test_emoji_counts_as_one_character(client):
    # 12 emoji = 12 code points → allowed; 13 → rejected.
    ok = client.put("/api/labels", json={"kind": "heading", "key": "TYPE", "label": "🚗" * 12})
    assert ok.status_code == 200
    too_long = client.put("/api/labels", json={"kind": "heading", "key": "TYPE", "label": "🚗" * 13})
    assert too_long.status_code == 422


def test_unknown_heading_key_rejected(client):
    r = client.put("/api/labels", json={"kind": "heading", "key": "CATEGORY", "label": "Nope"})
    assert r.status_code == 422


def test_pill_label_kinds_unaffected(client):
    # The pre-existing platform/type pill renames keep working and keep their
    # longer length allowance (no 12-char cap applied to them).
    r = client.put("/api/labels", json={"kind": "platform", "key": "DOORDASH", "label": "My Main Delivery App"})
    assert r.status_code == 200
