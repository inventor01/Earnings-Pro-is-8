import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.db import Base
from backend.models import Entry, Settings, EntryType, AppType, ExpenseCategory
from backend.services.rollup_service import calculate_rollup
from datetime import datetime
from decimal import Decimal

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
    settings = Settings(id=1, cost_per_mile=Decimal("0"))
    db_session.add(settings)
    
    entry1 = Entry(
        timestamp=datetime.utcnow(),
        type=EntryType.ORDER,
        app=AppType.DOORDASH,
        amount=Decimal("25.00"),
        distance_miles=5.0,
        duration_minutes=30
    )
    entry2 = Entry(
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
    settings = Settings(id=1, cost_per_mile=Decimal("0"))
    db_session.add(settings)
    
    expense1 = Entry(
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
    settings = Settings(id=1, cost_per_mile=Decimal("0"))
    db_session.add(settings)
    
    entry = Entry(
        timestamp=datetime.utcnow(),
        type=EntryType.ORDER,
        app=AppType.DOORDASH,
        amount=Decimal("100.00"),
        distance_miles=10.0,
        duration_minutes=60
    )
    expense = Entry(
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
    settings = Settings(id=1, cost_per_mile=Decimal("0"))
    db_session.add(settings)
    
    entry = Entry(
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
    settings = Settings(id=1, cost_per_mile=Decimal("0"))
    db_session.add(settings)
    
    entry = Entry(
        timestamp=datetime.utcnow(),
        type=EntryType.ORDER,
        app=AppType.DOORDASH,
        amount=Decimal("60.00"),
        distance_miles=5.0,
        duration_minutes=120
    )
    db_session.add(entry)
    db_session.commit()
    
    rollup = calculate_rollup(db_session)
    
    assert rollup["hours"] == 2.0
    assert rollup["dollars_per_hour"] == Decimal("30.00")
