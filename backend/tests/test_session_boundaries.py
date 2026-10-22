"""Regression coverage for token substitution, revocation, and MFA replay."""
import asyncio
import uuid
from datetime import datetime, timedelta, timezone

import jwt
import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.auth import JWT_ALGORITHM, SECRET_KEY
from backend.db import Base, get_db
from backend.models import AuthUser, PasswordResetToken
from backend.routers import auth_routes, oauth


@pytest.fixture
def harness(monkeypatch):
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    user = AuthUser(id=str(uuid.uuid4()), email="security@example.com", first_name="Security")
    session.add(user)
    session.commit()

    async def no_email(*args, **kwargs):
        return None

    monkeypatch.setattr(auth_routes, "send_mfa_code_email", no_email)
    monkeypatch.setattr(auth_routes, "_PRELAUNCH_ACCESS_CODE", "")
    auth_routes.auth_limiter.reset()
    app = FastAPI()
    app.state.limiter = auth_routes.auth_limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    app.include_router(auth_routes.router, prefix="/api")
    app.dependency_overrides[get_db] = lambda: session
    with TestClient(app, raise_server_exceptions=False) as client:
        yield client, session, user
    auth_routes.auth_limiter.reset()
    session.close()
    engine.dispose()


def signed_token(user, **claims):
    now = datetime.now(timezone.utc)
    return jwt.encode({"sub": user.id, "iat": now.timestamp(), "exp": now + timedelta(hours=1), **claims},
                      SECRET_KEY, algorithm=JWT_ALGORITHM)


def get_profile(client, token):
    return client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})


def test_oauth_state_cannot_be_used_as_an_access_token(harness):
    client, _, user = harness
    state = oauth._issue_oauth_state(user.id, "UBER")
    assert get_profile(client, state).status_code == 401


@pytest.mark.parametrize("claims", [{"typ": "refresh"}, {"purpose": "oauth_state"}, {"purpose": "prelaunch"}])
def test_non_access_token_categories_are_rejected(harness, claims):
    client, _, user = harness
    assert get_profile(client, signed_token(user, **claims)).status_code == 401


def test_legacy_access_token_remains_usable_before_security_event(harness):
    client, _, user = harness
    assert get_profile(client, signed_token(user, iat=int(datetime.now(timezone.utc).timestamp()))).status_code == 200


def test_security_event_revokes_an_earlier_token_within_the_same_second(harness):
    client, session, user = harness
    base = (datetime.now(timezone.utc) - timedelta(seconds=10)).replace(microsecond=0)
    token = signed_token(user, iat=base.timestamp() + 0.1)
    user.password_changed_at = (base + timedelta(microseconds=500000)).isoformat()
    session.commit()
    assert get_profile(client, token).status_code == 401


def test_security_event_rejects_token_without_issue_time(harness):
    client, session, user = harness
    user.password_changed_at = (datetime.now(timezone.utc) - timedelta(seconds=1)).isoformat()
    session.commit()
    token = jwt.encode({"sub": user.id, "exp": datetime.now(timezone.utc) + timedelta(hours=1)},
                       SECRET_KEY, algorithm=JWT_ALGORITHM)
    assert get_profile(client, token).status_code == 401


def test_mfa_original_challenge_cannot_repeat_resend(harness):
    client, session, user = harness
    original = asyncio.run(auth_routes._issue_mfa_challenge(user, "login", session))
    assert client.post("/api/auth/mfa/resend", json={"challenge_token": original}).status_code == 200
    replay = client.post("/api/auth/mfa/resend", json={"challenge_token": original})
    assert replay.status_code == 400


def test_mfa_old_challenge_cannot_verify_a_replacement_code(harness, monkeypatch):
    client, session, user = harness
    codes = iter(["123456", "654321"])
    monkeypatch.setattr(auth_routes, "_generate_mfa_code", lambda: next(codes))
    original = asyncio.run(auth_routes._issue_mfa_challenge(user, "login", session))
    replacement = client.post("/api/auth/mfa/resend", json={"challenge_token": original})
    assert replacement.status_code == 200
    replay = client.post("/api/auth/mfa/verify", json={"challenge_token": original, "code": "654321"})
    assert replay.status_code == 400
    valid = client.post("/api/auth/mfa/verify", json={"challenge_token": replacement.json()["challenge_token"], "code": "654321"})
    assert valid.status_code == 200


def test_mfa_resend_chain_has_a_server_enforced_limit(harness):
    client, session, user = harness
    challenge = asyncio.run(auth_routes._issue_mfa_challenge(user, "login", session))
    for _ in range(auth_routes.MFA_MAX_RESENDS):
        response = client.post("/api/auth/mfa/resend", json={"challenge_token": challenge})
        assert response.status_code == 200
        challenge = response.json()["challenge_token"]
    assert client.post("/api/auth/mfa/resend", json={"challenge_token": challenge}).status_code == 429


def test_signup_rejects_password_beyond_bcrypt_utf8_limit(harness):
    client, _, _ = harness
    response = client.post("/api/auth/signup", json={"email": "new@example.com", "password": "💚" * 19})
    assert response.status_code == 400


def test_password_reset_validates_length_before_consuming_token(harness):
    client, session, user = harness
    raw = "test-reset-token"
    record = PasswordResetToken(user_id=user.id, token=auth_routes._hash_reset_token(raw),
                                expires_at=datetime.utcnow() + timedelta(hours=1), used=False)
    session.add(record)
    session.commit()
    response = client.post("/api/auth/reset-password", json={"token": raw, "new_password": "x" * 100})
    assert response.status_code == 400
    session.expire_all()
    assert not session.get(PasswordResetToken, record.id).used


def test_mfa_challenge_is_revoked_after_password_change(harness):
    client, session, user = harness
    challenge = asyncio.run(auth_routes._issue_mfa_challenge(user, "login", session))
    user.password_changed_at = datetime.now(timezone.utc).isoformat()
    session.commit()
    assert client.post("/api/auth/mfa/resend", json={"challenge_token": challenge}).status_code == 400


def test_mfa_code_cannot_be_consumed_twice(harness, monkeypatch):
    client, session, user = harness
    monkeypatch.setattr(auth_routes, "_generate_mfa_code", lambda: "123456")
    challenge = asyncio.run(auth_routes._issue_mfa_challenge(user, "login", session))
    body = {"challenge_token": challenge, "code": "123456"}
    assert client.post("/api/auth/mfa/verify", json=body).status_code == 200
    assert client.post("/api/auth/mfa/verify", json=body).status_code == 400


def test_mfa_security_event_during_code_check_prevents_exchange(harness, monkeypatch):
    client, session, user = harness
    challenge = asyncio.run(auth_routes._issue_mfa_challenge(user, "login", session))

    def reset_during_check(*args):
        session.query(AuthUser).filter_by(id=user.id).update({
            "password_changed_at": datetime.now(timezone.utc).isoformat(),
        }, synchronize_session=False)
        session.commit()
        return True

    monkeypatch.setattr(auth_routes, "verify_password", reset_during_check)
    response = client.post("/api/auth/mfa/verify", json={"challenge_token": challenge, "code": "123456"})
    assert response.status_code == 400


def test_mfa_replacement_during_code_check_prevents_exchange(harness, monkeypatch):
    client, session, user = harness
    challenge = asyncio.run(auth_routes._issue_mfa_challenge(user, "login", session))

    def consume_in_other_worker(*args):
        session.query(AuthUser).filter_by(id=user.id).update({"mfa_code_hash": None}, synchronize_session=False)
        session.commit()
        return True

    monkeypatch.setattr(auth_routes, "verify_password", consume_in_other_worker)
    assert client.post("/api/auth/mfa/verify", json={"challenge_token": challenge, "code": "123456"}).status_code == 400


def test_mfa_attempt_limit_rejects_even_the_correct_code(harness, monkeypatch):
    client, session, user = harness
    monkeypatch.setattr(auth_routes, "_generate_mfa_code", lambda: "123456")
    challenge = asyncio.run(auth_routes._issue_mfa_challenge(user, "login", session))
    for _ in range(auth_routes.MFA_MAX_ATTEMPTS):
        assert client.post("/api/auth/mfa/verify", json={"challenge_token": challenge, "code": "000000"}).status_code == 400
    assert client.post("/api/auth/mfa/verify", json={"challenge_token": challenge, "code": "123456"}).status_code == 429


def test_mfa_expired_chain_cannot_be_extended(harness):
    _, session, user = harness
    with pytest.raises(HTTPException) as exc:
        asyncio.run(auth_routes._issue_mfa_challenge(user, "login", session,
                    gen=1, issued_at=datetime.utcnow() - auth_routes.MFA_CHALLENGE_TTL - timedelta(seconds=1)))
    assert exc.value.status_code == 400


def test_password_reset_during_login_does_not_issue_access_token(harness, monkeypatch):
    client, session, user = harness
    user.password_hash = "existing-password-hash"
    session.commit()

    def reset_during_check(*args):
        session.query(AuthUser).filter_by(id=user.id).update({
            "password_changed_at": datetime.now(timezone.utc).isoformat(),
        }, synchronize_session=False)
        session.commit()
        return True

    monkeypatch.setattr(auth_routes, "verify_password", reset_during_check)
    response = client.post("/api/auth/login", json={"credential": user.email, "password": "old-password"})
    assert response.status_code == 401


def test_valid_login_issues_a_usable_session(harness):
    client, session, user = harness
    user.password_hash = auth_routes.hash_password("valid-password")
    session.commit()
    response = client.post("/api/auth/login", json={"credential": user.email, "password": "valid-password"})
    assert response.status_code == 200
    assert get_profile(client, response.json()["access_token"]).status_code == 200


def test_enabling_mfa_does_not_exchange_its_code_for_a_session(harness, monkeypatch):
    client, session, user = harness
    monkeypatch.setattr(auth_routes, "_generate_mfa_code", lambda: "123456")
    challenge = asyncio.run(auth_routes._issue_mfa_challenge(user, "enable", session))
    response = client.post("/api/auth/mfa/verify", json={"challenge_token": challenge, "code": "123456"})
    assert response.status_code == 200
    assert response.json() == {"success": True, "mfa_enabled": True}
    session.refresh(user)
    assert user.mfa_enabled
