"""Tests for DELETE /api/auth/account.

The endpoint must purge EVERY table that FK-references auth_users.id. A
hardcoded table list broke in production (500 "Internal Server Error") when
newer tables — daily_goals, user_platforms, user_entry_types,
user_label_overrides, users, daily_usage, referrals, problem_reports — held
rows for the user and the final auth_users delete hit an FK constraint.
Foreign keys are enforced (PRAGMA foreign_keys=ON) so a missed table fails
these tests exactly the way production failed.
"""
from datetime import date, datetime
from decimal import Decimal

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.pool import StaticPool
from sqlalchemy.orm import sessionmaker

from backend.db import Base, get_db
from backend.auth import get_current_user
from backend.models import (
    Achievement, AuthUser, Congratulation, DailyGoal, DailyUsage, Entry,
    EntryType, AppType, ApiCredential, Friend, Goal, PasswordResetToken,
    PlatformIntegration, ProblemReport, Referral, Settings, SyncedOrder,
    TimeframeType, User, UserEntryType, UserLabelOverride, UserPlatform,
)
from backend.routers import auth_routes

USER_ID = "delete-me-user"
OTHER_ID = "other-user"


class FakeUser:
    id = USER_ID


@pytest.fixture
def client():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    # Enforce FKs so an unpurged referencing row breaks the auth_users delete,
    # reproducing the production failure mode.
    @event.listens_for(engine, "connect")
    def _fk_on(dbapi_conn, _):
        dbapi_conn.execute("PRAGMA foreign_keys=ON")

    Base.metadata.create_all(bind=engine)
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSession()

    app = FastAPI()
    app.include_router(auth_routes.router, prefix="/api")
    app.dependency_overrides[get_db] = lambda: session
    app.dependency_overrides[get_current_user] = lambda: FakeUser()

    with TestClient(app) as c:
        yield c, session

    session.close()
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


def make_user(session, uid):
    session.add(AuthUser(id=uid, email=f"{uid}@example.com", password_hash="x"))
    session.commit()


def seed_all_user_data(session, uid, other):
    """One row in every table that references auth_users.id."""
    session.add_all([
        Entry(user_id=uid, type=EntryType.ORDER, app=AppType.DOORDASH, amount=Decimal("7.50")),
        Settings(user_id=uid, cost_per_mile=Decimal("0.5")),
        Goal(user_id=uid, timeframe=TimeframeType.TODAY, target_profit=Decimal("100")),
        DailyGoal(user_id=uid, goal_date=date(2026, 8, 1), target_profit=Decimal("120")),
        UserPlatform(user_id=uid, name="Roadie"),
        UserEntryType(user_id=uid, name="Tip Bait", kind="income"),
        UserLabelOverride(user_id=uid, kind="platform", key="DOORDASH", label="DD"),
        PasswordResetToken(user_id=uid, token=f"tok-{uid}", expires_at=datetime.utcnow()),
        User(auth_user_id=uid),
        DailyUsage(auth_user_id=uid, usage_date="2026-08-01"),
        Friend(user_id=uid, friend_id=other),
        Friend(user_id=other, friend_id=uid),
        Achievement(user_id=uid, title="First Entry"),
        Congratulation(from_user_id=uid, to_user_id=other),
        Congratulation(from_user_id=other, to_user_id=uid),
        Referral(referrer_id=other, referee_id=uid),
        Referral(referrer_id=uid, referee_id=other),  # deleting user as referrer too
        ApiCredential(user_id=uid, platform=PlatformIntegration.UBER, access_token="tok"),
        SyncedOrder(user_id=uid, platform=PlatformIntegration.UBER, platform_order_id="o1"),
        ProblemReport(
            user_id=uid, report_type="Bug Report", description="Crashed",
            contact_email=f"{uid}@example.com",
        ),
    ])
    session.commit()


def test_delete_account_purges_every_referencing_table(client):
    c, session = client
    make_user(session, USER_ID)
    make_user(session, OTHER_ID)
    seed_all_user_data(session, USER_ID, OTHER_ID)

    r = c.delete("/api/auth/account")
    assert r.status_code == 200, r.text
    assert r.json() == {"deleted": True, "user_id": USER_ID}

    assert session.query(AuthUser).filter_by(id=USER_ID).count() == 0
    # No orphan rows anywhere: scan every FK-bearing table for the user id.
    for table in Base.metadata.sorted_tables:
        for col in table.columns:
            if any(fk.column.table.name == "auth_users" for fk in col.foreign_keys):
                n = session.execute(
                    table.select().where(col == USER_ID)
                ).fetchall()
                assert n == [], f"orphan rows left in {table.name}.{col.name}"

    # The other user survives untouched.
    assert session.query(AuthUser).filter_by(id=OTHER_ID).count() == 1


def test_delete_account_only_touches_own_rows(client):
    c, session = client
    make_user(session, USER_ID)
    make_user(session, OTHER_ID)
    session.add_all([
        Entry(user_id=OTHER_ID, type=EntryType.ORDER, app=AppType.UBEREATS, amount=Decimal("9")),
        DailyGoal(user_id=OTHER_ID, goal_date=date(2026, 8, 2), target_profit=Decimal("50")),
        ProblemReport(
            user_id=OTHER_ID, report_type="Bug Report", description="Other bug",
            contact_email="o@example.com",
        ),
    ])
    session.commit()

    r = c.delete("/api/auth/account")
    assert r.status_code == 200

    assert session.query(Entry).filter_by(user_id=OTHER_ID).count() == 1
    assert session.query(DailyGoal).filter_by(user_id=OTHER_ID).count() == 1
    assert session.query(ProblemReport).filter_by(user_id=OTHER_ID).count() == 1


def test_delete_account_with_bare_user(client):
    # A user with no associated rows deletes cleanly too.
    c, session = client
    make_user(session, USER_ID)
    r = c.delete("/api/auth/account")
    assert r.status_code == 200
    assert session.query(AuthUser).filter_by(id=USER_ID).count() == 0
