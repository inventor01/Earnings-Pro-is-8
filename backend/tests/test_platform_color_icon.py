"""Custom platform color/icon: schema validation and model persistence."""
import pytest
from pydantic import ValidationError
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.db import Base
from backend.models import UserPlatform
from backend.schemas import PlatformCreate


@pytest.fixture
def db_session():
    test_engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=test_engine)
    TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
    session = TestSessionLocal()
    yield session
    session.close()
    Base.metadata.drop_all(bind=test_engine)


def test_color_normalized_lowercase():
    p = PlatformCreate(name="Roadie", color="#8B5CF6", icon="🚗")
    assert p.color == "#8b5cf6"
    assert p.icon == "🚗"


def test_empty_color_icon_become_none():
    p = PlatformCreate(name="Spark", color="", icon="  ")
    assert p.color is None
    assert p.icon is None
    p2 = PlatformCreate(name="Spark")
    assert p2.color is None and p2.icon is None


@pytest.mark.parametrize("bad", ["red", "#12345", "#1234567", "8b5cf6", "#gggggg"])
def test_invalid_color_rejected(bad):
    with pytest.raises(ValidationError):
        PlatformCreate(name="Flex", color=bad)


def test_overlong_icon_rejected():
    with pytest.raises(ValidationError):
        PlatformCreate(name="Flex", icon="x" * 17)


def test_model_persists_color_icon(db_session):
    row = UserPlatform(user_id="u1", name="Roadie", color="#f97316", icon="📦")
    db_session.add(row)
    db_session.commit()
    got = db_session.query(UserPlatform).first()
    assert got.color == "#f97316"
    assert got.icon == "📦"

    # NULL means "auto" styling on the client.
    row2 = UserPlatform(user_id="u1", name="Spark")
    db_session.add(row2)
    db_session.commit()
    got2 = db_session.query(UserPlatform).filter_by(name="Spark").one()
    assert got2.color is None and got2.icon is None
