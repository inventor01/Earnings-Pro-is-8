"""Custom earnings types: schema validation, model persistence, and the
custom_type base-type invariant on entry schemas."""
import pytest
from pydantic import ValidationError
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.db import Base
from backend.models import UserEntryType, Entry, EntryType
from backend.schemas import EntryTypeCreate, EntryCreate, EntryUpdate


@pytest.fixture
def db_session():
    test_engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=test_engine)
    TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
    session = TestSessionLocal()
    yield session
    session.close()
    Base.metadata.drop_all(bind=test_engine)


def test_kind_normalized_and_defaulted():
    t = EntryTypeCreate(name="Tips", kind="  Income ")
    assert t.kind == "income"
    t2 = EntryTypeCreate(name="Tolls", kind="EXPENSE")
    assert t2.kind == "expense"
    t3 = EntryTypeCreate(name="Quest")
    assert t3.kind == "income"


def test_invalid_kind_rejected():
    with pytest.raises(ValidationError):
        EntryTypeCreate(name="Weird", kind="both")


def test_color_icon_validated_like_platforms():
    t = EntryTypeCreate(name="Quest", color="#8B5CF6", icon="⭐")
    assert t.color == "#8b5cf6"
    with pytest.raises(ValidationError):
        EntryTypeCreate(name="Quest", color="purple")
    with pytest.raises(ValidationError):
        EntryTypeCreate(name="Quest", icon="x" * 17)


def test_model_persists_entry_type(db_session):
    row = UserEntryType(user_id="u1", name="Quest", kind="income", color="#f97316", icon="⭐")
    db_session.add(row)
    db_session.commit()
    got = db_session.query(UserEntryType).one()
    assert (got.name, got.kind, got.color, got.icon) == ("Quest", "income", "#f97316", "⭐")


def test_entry_create_custom_type_allowed_on_bonus_and_expense():
    e = EntryCreate(type=EntryType.BONUS, amount=5, custom_type="Quest")
    assert e.custom_type == "Quest"
    e2 = EntryCreate(type=EntryType.EXPENSE, amount=5, custom_type="Tolls")
    assert e2.custom_type == "Tolls"


def test_entry_create_custom_type_cleared_on_order_and_cancellation():
    e = EntryCreate(type=EntryType.ORDER, amount=5, custom_type="Quest")
    assert e.custom_type is None
    e2 = EntryCreate(type=EntryType.CANCELLATION, amount=5, custom_type="Quest")
    assert e2.custom_type is None


def test_entry_update_custom_type_invariant():
    u = EntryUpdate(type=EntryType.ORDER, custom_type="Quest")
    assert u.custom_type is None
    # No type in the partial update → keep the name; the route re-checks
    # against the row's final type.
    u2 = EntryUpdate(custom_type="Quest")
    assert u2.custom_type == "Quest"


def test_entry_model_persists_custom_type(db_session):
    row = Entry(user_id="u1", type=EntryType.BONUS, app="OTHER", amount=7, custom_type="Quest")
    db_session.add(row)
    db_session.commit()
    got = db_session.query(Entry).one()
    assert got.custom_type == "Quest"
    assert got.type == EntryType.BONUS
