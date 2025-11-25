import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.db import Base
from backend.models import Entry, EntryType, AppType, ExpenseCategory
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

def test_expense_stored_as_negative(db_session):
    expense = Entry(
        timestamp=datetime.utcnow(),
        type=EntryType.EXPENSE,
        app=AppType.OTHER,
        amount=-Decimal("30.00"),
        category=ExpenseCategory.GAS
    )
    db_session.add(expense)
    db_session.commit()
    
    retrieved = db_session.query(Entry).first()
    assert retrieved.amount < 0
    assert retrieved.amount == -Decimal("30.00")

def test_cancellation_stored_as_negative(db_session):
    cancellation = Entry(
        timestamp=datetime.utcnow(),
        type=EntryType.CANCELLATION,
        app=AppType.DOORDASH,
        amount=-Decimal("5.00"),
        distance_miles=2.0
    )
    db_session.add(cancellation)
    db_session.commit()
    
    retrieved = db_session.query(Entry).first()
    assert retrieved.amount < 0

def test_order_stored_as_positive(db_session):
    order = Entry(
        timestamp=datetime.utcnow(),
        type=EntryType.ORDER,
        app=AppType.UBEREATS,
        amount=Decimal("25.50"),
        distance_miles=5.0,
        duration_minutes=30
    )
    db_session.add(order)
    db_session.commit()
    
    retrieved = db_session.query(Entry).first()
    assert retrieved.amount > 0
    assert retrieved.amount == Decimal("25.50")

def test_bonus_stored_as_positive(db_session):
    bonus = Entry(
        timestamp=datetime.utcnow(),
        type=EntryType.BONUS,
        app=AppType.DOORDASH,
        amount=Decimal("10.00")
    )
    db_session.add(bonus)
    db_session.commit()
    
    retrieved = db_session.query(Entry).first()
    assert retrieved.amount > 0
