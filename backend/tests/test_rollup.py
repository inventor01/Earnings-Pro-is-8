import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.db import Base
from backend.models import Entry, Settings, EntryType, AppType, ExpenseCategory
from backend.services.rollup_service import calculate_rollup
from datetime import datetime, timedelta
from decimal import Decimal

TEST_USER_ID = "test-user-1"

@pytest.fixture
def db_session():
    test_engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=test_engine)
    TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
    session = TestSessionLocal()
    yield session
    session.close()
    Base.metadata.drop_all(bind=test_engine)

def test_rollup_revenue_calculation(db_session):
    settings = Settings(id=1, user_id=TEST_USER_ID, cost_per_mile=Decimal("0"))
    db_session.add(settings)
    
    entry1 = Entry(
        user_id=TEST_USER_ID,
        timestamp=datetime.utcnow(),
        type=EntryType.ORDER,
        app=AppType.DOORDASH,
        amount=Decimal("25.00"),
        distance_miles=5.0,
        duration_minutes=30
    )
    entry2 = Entry(
        user_id=TEST_USER_ID,
        timestamp=datetime.utcnow(),
        type=EntryType.BONUS,
        app=AppType.UBEREATS,
        amount=Decimal("10.00"),
        distance_miles=0,
        duration_minutes=0
    )
    db_session.add(entry1)
    db_session.add(entry2)
    db_session.commit()
    
    rollup = calculate_rollup(db_session)
    
    assert rollup["revenue"] == Decimal("35.00")
    assert rollup["expenses"] == Decimal("0")

def test_rollup_expense_calculation(db_session):
    settings = Settings(id=1, user_id=TEST_USER_ID, cost_per_mile=Decimal("0"))
    db_session.add(settings)
    
    expense1 = Entry(
        user_id=TEST_USER_ID,
        timestamp=datetime.utcnow(),
        type=EntryType.EXPENSE,
        app=AppType.OTHER,
        amount=-Decimal("40.00"),
        distance_miles=0,
        duration_minutes=0,
        category=ExpenseCategory.GAS
    )
    db_session.add(expense1)
    db_session.commit()
    
    rollup = calculate_rollup(db_session)
    
    assert rollup["expenses"] == Decimal("40.00")

def test_rollup_profit_with_mileage(db_session):
    settings = Settings(id=1, user_id=TEST_USER_ID, cost_per_mile=Decimal("0"))
    db_session.add(settings)
    
    entry = Entry(
        user_id=TEST_USER_ID,
        timestamp=datetime.utcnow(),
        type=EntryType.ORDER,
        app=AppType.DOORDASH,
        amount=Decimal("100.00"),
        distance_miles=10.0,
        duration_minutes=60
    )
    expense = Entry(
        user_id=TEST_USER_ID,
        timestamp=datetime.utcnow(),
        type=EntryType.EXPENSE,
        app=AppType.OTHER,
        amount=-Decimal("20.00"),
        distance_miles=0,
        duration_minutes=0,
        category=ExpenseCategory.GAS
    )
    db_session.add(entry)
    db_session.add(expense)
    db_session.commit()
    
    rollup = calculate_rollup(db_session)
    
    assert rollup["revenue"] == Decimal("100.00")
    assert rollup["expenses"] == Decimal("20.00")
    assert rollup["miles"] == 10.0
    cost_of_miles = Decimal("10.0") * Decimal("0")
    expected_profit = Decimal("100.00") - Decimal("20.00") - cost_of_miles
    assert rollup["profit"] == expected_profit

def test_rollup_dollars_per_mile(db_session):
    settings = Settings(id=1, user_id=TEST_USER_ID, cost_per_mile=Decimal("0"))
    db_session.add(settings)
    
    entry = Entry(
        user_id=TEST_USER_ID,
        timestamp=datetime.utcnow(),
        type=EntryType.ORDER,
        app=AppType.DOORDASH,
        amount=Decimal("50.00"),
        distance_miles=10.0,
        duration_minutes=60
    )
    db_session.add(entry)
    db_session.commit()
    
    rollup = calculate_rollup(db_session)
    
    assert rollup["dollars_per_mile"] == Decimal("5.00")

def test_rollup_dollars_per_hour(db_session):
    settings = Settings(id=1, user_id=TEST_USER_ID, cost_per_mile=Decimal("0"))
    db_session.add(settings)
    
    # dollars_per_hour is based on elapsed time between first and last entry,
    # so create two entries 2 hours apart totaling $60 profit -> $30/hour.
    base = datetime.utcnow()
    entry1 = Entry(
        user_id=TEST_USER_ID,
        timestamp=base - timedelta(hours=2),
        type=EntryType.ORDER,
        app=AppType.DOORDASH,
        amount=Decimal("40.00"),
        distance_miles=5.0,
        duration_minutes=60
    )
    entry2 = Entry(
        user_id=TEST_USER_ID,
        timestamp=base,
        type=EntryType.ORDER,
        app=AppType.DOORDASH,
        amount=Decimal("20.00"),
        distance_miles=2.0,
        duration_minutes=60
    )
    db_session.add(entry1)
    db_session.add(entry2)
    db_session.commit()
    
    rollup = calculate_rollup(db_session)
    
    assert rollup["hours"] == 2.0
    assert rollup["dollars_per_hour"] == Decimal("30.00")

USER_A = "user-a"
USER_B = "user-b"

def _seed_two_users(db_session):
    db_session.add(Settings(id=1, user_id=USER_A, cost_per_mile=Decimal("0")))
    db_session.add(Settings(id=2, user_id=USER_B, cost_per_mile=Decimal("0.50")))
    now = datetime.utcnow()
    db_session.add(Entry(
        user_id=USER_A, timestamp=now, type=EntryType.ORDER,
        app=AppType.DOORDASH, amount=Decimal("30.00"),
        distance_miles=6.0, duration_minutes=30
    ))
    db_session.add(Entry(
        user_id=USER_A, timestamp=now, type=EntryType.EXPENSE,
        app=AppType.OTHER, amount=-Decimal("5.00"),
        distance_miles=0, duration_minutes=0, category=ExpenseCategory.GAS
    ))
    db_session.add(Entry(
        user_id=USER_B, timestamp=now, type=EntryType.ORDER,
        app=AppType.UBEREATS, amount=Decimal("100.00"),
        distance_miles=20.0, duration_minutes=120
    ))
    db_session.add(Entry(
        user_id=USER_B, timestamp=now, type=EntryType.BONUS,
        app=AppType.UBEREATS, amount=Decimal("15.00"),
        distance_miles=0, duration_minutes=0
    ))
    db_session.commit()

def test_rollup_user_isolation_user_a(db_session):
    _seed_two_users(db_session)

    rollup = calculate_rollup(db_session, user_id=USER_A)

    # Only user A's entries: $30 order, $5 expense, 6 miles, 0.5 hours
    assert rollup["revenue"] == 30.0
    assert rollup["expenses"] == 5.0
    assert rollup["profit"] == 25.0
    assert rollup["miles"] == 6.0
    assert rollup["hours"] == 0.5
    # None of user B's amounts leak into breakdowns
    assert rollup["by_app"][AppType.UBEREATS.value] == 0.0
    assert rollup["by_app"][AppType.DOORDASH.value] == 30.0
    assert rollup["by_type"][EntryType.BONUS.value] == 0.0

def test_rollup_user_isolation_user_b(db_session):
    _seed_two_users(db_session)

    rollup = calculate_rollup(db_session, user_id=USER_B)

    # Only user B's entries: $100 order + $15 bonus, no expenses, 20 miles
    assert rollup["revenue"] == 115.0
    assert rollup["expenses"] == 0.0
    assert rollup["profit"] == 115.0
    assert rollup["miles"] == 20.0
    assert rollup["hours"] == 2.0
    assert rollup["by_app"][AppType.DOORDASH.value] == 0.0
    assert rollup["by_app"][AppType.UBEREATS.value] == 115.0
    assert rollup["by_type"][EntryType.EXPENSE.value] == 0.0

def test_rollup_user_isolation_settings(db_session):
    """Each user's rollup must use that user's own settings row."""
    _seed_two_users(db_session)

    # calculate_rollup with user_id must pick that user's Settings
    # (user A cost_per_mile=0, user B cost_per_mile=0.50), not just
    # the first Settings row in the table.
    rollup_b = calculate_rollup(db_session, user_id=USER_B)
    rollup_a = calculate_rollup(db_session, user_id=USER_A)

    assert rollup_a["revenue"] == 30.0
    assert rollup_b["revenue"] == 115.0

def test_rollup_user_with_no_entries(db_session):
    _seed_two_users(db_session)

    rollup = calculate_rollup(db_session, user_id="user-with-no-data")

    assert rollup["revenue"] == 0.0
    assert rollup["expenses"] == 0.0
    assert rollup["profit"] == 0.0
    assert rollup["miles"] == 0.0
    assert rollup["hours"] == 0.0
