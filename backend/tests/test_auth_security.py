"""Security regression tests: JWT revocation edge cases and rate limits.

These lock in the guarantees added by the Aug 2026 security audit:
- tokens issued before a password reset/email change are revoked (iat check)
- MFA challenge tokens can never be used as access tokens
- password-reset, verify-reset-token, and problem-report endpoints return
  429 once their per-IP rate limits are exceeded.
"""
import uuid
from datetime import datetime, timedelta

import jwt as pyjwt
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.db import Base, get_db
from backend.models import AuthUser, ProblemReport
from backend.routers import auth_routes, feedback
from backend.routers.auth_routes import create_access_token, SECRET_KEY, JWT_ALGORITHM


@pytest.fixture
def db_session():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = Session()
    yield session
    session.close()
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


def _make_user(db, password_changed_at=None):
    user = AuthUser(
        id=str(uuid.uuid4()),
        email=f"u-{uuid.uuid4().hex[:8]}@example.com",
        password_hash="x",
        first_name="Test",
        password_changed_at=password_changed_at,
    )
    db.add(user)
    db.commit()
    return user


@pytest.fixture
def auth_app(db_session):
    app = FastAPI()
    app.state.limiter = auth_routes.auth_limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    app.include_router(auth_routes.router, prefix="/api")
    app.dependency_overrides[get_db] = lambda: db_session
    auth_routes.auth_limiter.reset()
    with TestClient(app) as client:
        yield client
    auth_routes.auth_limiter.reset()


# ---------------------------------------------------------------------------
# JWT revocation edge cases (task: revocation tests)
# ---------------------------------------------------------------------------

def test_valid_token_accepted(auth_app, db_session):
    user = _make_user(db_session)
    token = create_access_token(user.id, user.email)
    r = auth_app.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert r.json()["id"] == user.id


def test_token_issued_before_password_change_is_revoked(auth_app, db_session):
    user = _make_user(db_session)
    old_iat = datetime.utcnow() - timedelta(hours=2)
    token = pyjwt.encode(
        {"sub": user.id, "email": user.email, "iat": old_iat, "exp": datetime.utcnow() + timedelta(hours=1)},
        SECRET_KEY, algorithm=JWT_ALGORITHM,
    )
    # Password changed AFTER the token was issued -> token must die.
    user.password_changed_at = (datetime.utcnow() - timedelta(hours=1)).isoformat()
    db_session.commit()
    r = auth_app.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 401


def test_token_issued_after_password_change_survives(auth_app, db_session):
    user = _make_user(db_session, password_changed_at=(datetime.utcnow() - timedelta(hours=1)).isoformat())
    token = create_access_token(user.id, user.email)  # iat = now, after change
    r = auth_app.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200


def test_same_second_token_survives(auth_app, db_session):
    # Login immediately after a reset signs a token in the same second as
    # password_changed_at; it must not be rejected (iat is floored to seconds).
    now = datetime.utcnow().replace(microsecond=0)
    user = _make_user(db_session, password_changed_at=(now + timedelta(microseconds=500000)).isoformat())
    token = pyjwt.encode(
        {"sub": user.id, "email": user.email, "iat": now, "exp": now + timedelta(hours=1)},
        SECRET_KEY, algorithm=JWT_ALGORITHM,
    )
    r = auth_app.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200


def test_malformed_password_changed_at_is_ignored(auth_app, db_session):
    user = _make_user(db_session, password_changed_at="not-a-timestamp")
    token = create_access_token(user.id, user.email)
    r = auth_app.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200


def test_mfa_challenge_token_rejected_as_access_token(auth_app, db_session):
    user = _make_user(db_session)
    token = pyjwt.encode(
        {"sub": user.id, "email": user.email, "typ": "mfa", "purpose": "login",
         "iat": datetime.utcnow(), "exp": datetime.utcnow() + timedelta(minutes=10)},
        SECRET_KEY, algorithm=JWT_ALGORITHM,
    )
    r = auth_app.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 401


def test_expired_token_rejected(auth_app, db_session):
    user = _make_user(db_session)
    token = pyjwt.encode(
        {"sub": user.id, "email": user.email, "iat": datetime.utcnow() - timedelta(hours=2),
         "exp": datetime.utcnow() - timedelta(hours=1)},
        SECRET_KEY, algorithm=JWT_ALGORITHM,
    )
    r = auth_app.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 401


def test_token_for_deleted_user_rejected(auth_app, db_session):
    token = create_access_token(str(uuid.uuid4()), "ghost@example.com")
    r = auth_app.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 401


# ---------------------------------------------------------------------------
# Rate limits (per-IP, slowapi)
# ---------------------------------------------------------------------------

def test_reset_password_rate_limited(auth_app):
    # Limit is 10/hour; the 11th request must be 429 regardless of payload.
    codes = [
        auth_app.post("/api/auth/reset-password",
                      json={"token": "bogus", "new_password": "whatever123"}).status_code
        for _ in range(11)
    ]
    assert all(c == 400 for c in codes[:10])
    assert codes[10] == 429


def test_verify_reset_token_rate_limited(auth_app):
    codes = [auth_app.get("/api/auth/verify-reset-token/bogus").status_code for _ in range(21)]
    assert all(c == 200 for c in codes[:20])  # returns {"valid": False}
    assert codes[20] == 429


def test_feedback_report_rate_limited(db_session):
    from backend.auth import get_current_user

    user = _make_user(db_session)
    app = FastAPI()
    app.state.limiter = feedback.report_limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    app.include_router(feedback.router, prefix="/api")
    app.dependency_overrides[get_db] = lambda: db_session
    app.dependency_overrides[get_current_user] = lambda: user
    feedback.report_limiter.reset()

    body = {
        "report_type": "Bug Report",
        "description": "Something broke",
        "contact_email": "u@example.com",
    }
    with TestClient(app) as client:
        codes = []
        for _ in range(11):
            codes.append(client.post("/api/feedback/report", json=body).status_code)
            # Clear stored reports so the per-user DB cap never fires; this
            # isolates the IP limiter under test.
            db_session.query(ProblemReport).delete()
            db_session.commit()
    feedback.report_limiter.reset()
    assert all(c == 200 for c in codes[:10])
    assert codes[10] == 429
