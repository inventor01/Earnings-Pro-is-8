"""
Create (or refresh) the App Store reviewer demo account.

Apple's App Store review team needs working credentials to test the app
(Guideline 2.1). This script creates a real, fully functional account with
two weeks of realistic sample data so reviewers see a populated dashboard.

Run BEFORE submitting to App Store Connect, against your PRODUCTION database.
You can re-run any time to wipe & repopulate the demo entries.

Usage (against the local SQLite dev DB):
    python -m backend.scripts.create_demo_account

Usage against Railway production (set DATABASE_URL inline):
    DATABASE_URL="postgresql://..." \
    DEMO_EMAIL="reviewer@earningsninja.app" \
    DEMO_PASSWORD="ReviewMe2026!" \
    python -m backend.scripts.create_demo_account

Environment variables:
    DEMO_EMAIL     — defaults to "reviewer@earningsninja.app"
    DEMO_PASSWORD  — defaults to "ReviewMe2026!"

After running, paste the printed credentials into App Store Connect:
    App Information → App Review Information → Sign-In Information.
"""

import os
import sys
import uuid
import random
from datetime import datetime, timedelta
from decimal import Decimal

# Make `backend.*` importable when invoked as a script.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

import bcrypt  # noqa: E402

from backend.db import SessionLocal, engine, Base  # noqa: E402
from backend.models import (  # noqa: E402
    AuthUser, Entry, Settings, Goal,
    EntryType, AppType, ExpenseCategory, TimeframeType,
)


DEMO_EMAIL = os.environ.get("DEMO_EMAIL", "reviewer@earningsninja.app")
DEMO_PASSWORD = os.environ.get("DEMO_PASSWORD", "ReviewMe2026!")


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def make_demo_account(db) -> str:
    """Create the demo user (or update password if it already exists). Returns user_id."""
    existing = db.query(AuthUser).filter(AuthUser.email == DEMO_EMAIL).first()
    if existing:
        existing.password_hash = hash_password(DEMO_PASSWORD)
        existing.is_demo = True
        existing.first_name = "App Store"
        existing.last_name = "Reviewer"
        existing.updated_at = datetime.utcnow()
        db.flush()
        print(f"  · Found existing demo user, password reset.")
        return existing.id

    user_id = str(uuid.uuid4())
    user = AuthUser(
        id=user_id,
        email=DEMO_EMAIL,
        password_hash=hash_password(DEMO_PASSWORD),
        first_name="App Store",
        last_name="Reviewer",
        is_demo=True,
    )
    db.add(user)
    db.flush()
    print(f"  · Created new demo user.")
    return user_id


def wipe_demo_data(db, user_id: str) -> None:
    """Remove this user's existing entries/settings/goals so re-runs are idempotent."""
    db.query(Entry).filter(Entry.user_id == user_id).delete()
    db.query(Settings).filter(Settings.user_id == user_id).delete()
    db.query(Goal).filter(Goal.user_id == user_id).delete()
    db.flush()


def seed_demo_data(db, user_id: str) -> dict:
    """Generate 14 days of realistic delivery driver activity."""
    rng = random.Random(42)  # deterministic so reviewers see the same numbers

    db.add(Settings(user_id=user_id, cost_per_mile=Decimal("0.67")))

    db.add(Goal(
        user_id=user_id, timeframe=TimeframeType.TODAY,
        target_profit=Decimal("150.00"), goal_name="Daily Goal",
    ))
    db.add(Goal(
        user_id=user_id, timeframe=TimeframeType.THIS_WEEK,
        target_profit=Decimal("900.00"), goal_name="Weekly Goal",
    ))

    apps = list(AppType)
    expense_categories = [
        ExpenseCategory.GAS, ExpenseCategory.GAS, ExpenseCategory.GAS,
        ExpenseCategory.FOOD, ExpenseCategory.MAINTENANCE,
    ]

    total_orders = 0
    total_expenses = 0
    now = datetime.utcnow()

    for day_offset in range(14):
        day = now - timedelta(days=day_offset)
        num_orders = rng.randint(8, 16)

        for _ in range(num_orders):
            hour = rng.randint(10, 21)
            minute = rng.randint(0, 59)
            ts = datetime(day.year, day.month, day.day, hour, minute, 0)
            payout = round(rng.uniform(6.0, 22.0), 2)
            tip = round(rng.uniform(0.0, 12.0), 2)

            db.add(Entry(
                user_id=user_id,
                timestamp=ts,
                type=EntryType.ORDER,
                app=rng.choice(apps),
                order_id=f"DEMO-{rng.randint(10000, 99999)}",
                amount=Decimal(str(round(payout + tip, 2))),
                distance_miles=round(rng.uniform(1.5, 9.0), 2),
                duration_minutes=rng.randint(12, 45),
                note="Demo order",
            ))
            total_orders += 1

        # 1-2 expenses per day (gas, occasional food/maintenance), stored as negative
        for _ in range(rng.randint(1, 2)):
            cat = rng.choice(expense_categories)
            amt = -round(rng.uniform(5.0, 55.0), 2)
            db.add(Entry(
                user_id=user_id,
                timestamp=datetime(day.year, day.month, day.day, rng.randint(8, 22), rng.randint(0, 59), 0),
                type=EntryType.EXPENSE,
                app=AppType.OTHER,
                amount=Decimal(str(amt)),
                category=cat,
                note=f"Demo expense ({cat.value.lower()})",
            ))
            total_expenses += 1

    return {"orders": total_orders, "expenses": total_expenses}


def main():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        print("─" * 60)
        print("Earnings Ninja — App Store reviewer demo account")
        print("─" * 60)
        print(f"  Database : {os.environ.get('DATABASE_URL', '<default SQLite>')[:60]}…")
        print(f"  Email    : {DEMO_EMAIL}")
        print()

        user_id = make_demo_account(db)
        wipe_demo_data(db, user_id)
        counts = seed_demo_data(db, user_id)
        db.commit()

        print(f"  · Seeded {counts['orders']} orders + {counts['expenses']} expenses across 14 days.")
        print()
        print("─" * 60)
        print("✅ DONE. Copy these into App Store Connect:")
        print("─" * 60)
        print(f"   Username : {DEMO_EMAIL}")
        print("   Password : (set via DEMO_PASSWORD env var — not printed)")
        print("─" * 60)
        print("   App Store Connect → My App → App Information →")
        print("   App Review Information → Sign-In Information")
        print("─" * 60)
    except Exception as e:
        db.rollback()
        print(f"❌ Failed: {e}", file=sys.stderr)
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
