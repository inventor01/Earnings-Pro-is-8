"""Tests for /api/feedback/report: server-side caps on screenshots, text
validation, the per-user hourly throttle, and HTML-escaping of client-supplied
diagnostics in the notification email."""
import json
from datetime import datetime, timedelta

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool
from sqlalchemy.orm import sessionmaker

from backend.db import Base, get_db
from backend.auth import get_current_user
from backend.models import ProblemReport
from backend.routers import feedback

TEST_USER_ID = "feedback-test-user"


class FakeUser:
    id = TEST_USER_ID


@pytest.fixture
def client(monkeypatch):
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSession()

    app = FastAPI()
    app.include_router(feedback.router, prefix="/api")
    app.dependency_overrides[get_db] = lambda: session
    app.dependency_overrides[get_current_user] = lambda: FakeUser()

    # Never send real email from tests.
    async def _no_email(report, screenshot_count):
        return None

    monkeypatch.setattr(feedback, "_send_report_email", _no_email)

    with TestClient(app) as c:
        yield c, session

    session.close()
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


def valid_payload(**overrides):
    payload = {
        "report_type": "Bug Report",
        "description": "Something is broken and here is how it happened.",
        "contact_email": "user@example.com",
        "screenshots": [],
    }
    payload.update(overrides)
    return payload


def small_data_url():
    return "data:image/png;base64," + "A" * 100


def test_valid_report_accepted(client):
    c, session = client
    r = c.post("/api/feedback/report", json=valid_payload())
    assert r.status_code == 200
    assert r.json()["ok"] is True
    assert session.query(ProblemReport).count() == 1


def test_rejects_more_than_five_screenshots(client):
    c, session = client
    r = c.post(
        "/api/feedback/report",
        json=valid_payload(screenshots=[small_data_url()] * 6),
    )
    assert r.status_code == 422
    assert session.query(ProblemReport).count() == 0


def test_rejects_oversized_screenshot(client):
    c, session = client
    too_big = "data:image/png;base64," + "A" * (
        feedback.MAX_SCREENSHOT_BYTES * 4 // 3 + 1
    )
    r = c.post("/api/feedback/report", json=valid_payload(screenshots=[too_big]))
    assert r.status_code == 422
    assert session.query(ProblemReport).count() == 0


def test_rejects_aggregate_screenshot_size(client):
    c, session = client
    # Each individually under the per-shot cap, but together over the aggregate cap.
    per_shot = feedback.MAX_TOTAL_SCREENSHOT_CHARS // 4 + 1
    shot = "data:image/png;base64," + "A" * per_shot
    r = c.post("/api/feedback/report", json=valid_payload(screenshots=[shot] * 5))
    assert r.status_code == 422
    assert session.query(ProblemReport).count() == 0


def test_rejects_non_image_data_url(client):
    c, session = client
    r = c.post(
        "/api/feedback/report",
        json=valid_payload(screenshots=["data:text/html;base64,PGI+aGk8L2I+"]),
    )
    assert r.status_code == 422
    assert session.query(ProblemReport).count() == 0


def test_rejects_short_description(client):
    c, _ = client
    r = c.post("/api/feedback/report", json=valid_payload(description="too short"))
    assert r.status_code == 422


def test_rejects_unknown_report_type(client):
    c, _ = client
    r = c.post("/api/feedback/report", json=valid_payload(report_type="Rant"))
    assert r.status_code == 422


def test_throttle_429_after_five_reports_per_hour(client):
    c, session = client
    for i in range(feedback.MAX_REPORTS_PER_HOUR):
        r = c.post("/api/feedback/report", json=valid_payload())
        assert r.status_code == 200, r.text
    r = c.post("/api/feedback/report", json=valid_payload())
    assert r.status_code == 429
    assert session.query(ProblemReport).count() == feedback.MAX_REPORTS_PER_HOUR


def test_throttle_ignores_reports_older_than_an_hour(client):
    c, session = client
    old = datetime.utcnow() - timedelta(hours=2)
    for _ in range(feedback.MAX_REPORTS_PER_HOUR):
        session.add(
            ProblemReport(
                user_id=TEST_USER_ID,
                report_type="Bug Report",
                description="x" * 30,
                contact_email="user@example.com",
                created_at=old,
            )
        )
    session.commit()
    r = c.post("/api/feedback/report", json=valid_payload())
    assert r.status_code == 200


@pytest.mark.asyncio
async def test_email_escapes_diagnostics(monkeypatch):
    import resend
    from backend.services import email_service

    captured = {}

    def fake_send(params):
        captured.update(params)
        return {"id": "fake"}

    monkeypatch.setattr(resend.Emails, "send", staticmethod(fake_send))
    monkeypatch.setattr(email_service, "RESEND_API_KEY", "test-key")

    report = ProblemReport(
        id=123,
        user_id=TEST_USER_ID,
        report_type="Bug Report",
        description="<script>alert('d')</script> long enough description",
        steps="<img src=x onerror=alert(1)>",
        contact_email="user@example.com",
        diagnostics=json.dumps(
            {"<b>key</b>": "<script>alert('v')</script>", "os": "iOS & stuff"}
        ),
        created_at=datetime.utcnow(),
    )
    await feedback._send_report_email(report, screenshot_count=2)

    html = captured["html"]
    assert "<script>" not in html
    assert "&lt;script&gt;alert(&#x27;v&#x27;)&lt;/script&gt;" in html or "&lt;script&gt;" in html
    assert "&lt;b&gt;key&lt;/b&gt;" in html
    assert "iOS &amp; stuff" in html
    assert "<img src=x" not in html
