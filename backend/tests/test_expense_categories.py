"""Custom expense categories + hideable built-ins: route CRUD, the
custom_category invariant on entry schemas/routes, and rename carry-over."""
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool
from sqlalchemy.orm import sessionmaker

from backend.db import Base, get_db
from backend.auth import get_current_user
from backend.models import (
    Entry, EntryType, ExpenseCategory, UserExpenseCategory, UserHiddenBuiltin,
)
from backend.schemas import EntryCreate, EntryUpdate, ExpenseCategoryCreate
from backend.routers import expense_categories, entries

USER_ID = "cat-user"
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
    Base.metadata.create_all(bind=engine)
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSession()

    app = FastAPI()
    app.include_router(expense_categories.router, prefix="/api")
    app.include_router(entries.router, prefix="/api")
    app.dependency_overrides[get_db] = lambda: session
    app.dependency_overrides[get_current_user] = lambda: FakeUser()
    c = TestClient(app)
    c.db = session
    yield c
    session.close()


# ── Schema validation ────────────────────────────────────────────────────────

def test_color_icon_validated():
    c = ExpenseCategoryCreate(name="Car Wash", color="#8B5CF6", icon="🧽")
    assert c.color == "#8b5cf6"
    with pytest.raises(ValidationError):
        ExpenseCategoryCreate(name="Car Wash", color="purple")
    with pytest.raises(ValidationError):
        ExpenseCategoryCreate(name="Car Wash", icon="x" * 17)


def test_entry_create_custom_category_forces_other_and_expense_only():
    e = EntryCreate(type=EntryType.EXPENSE, amount=5, category=ExpenseCategory.GAS, custom_category="Car Wash")
    assert e.custom_category == "Car Wash"
    assert e.category == ExpenseCategory.OTHER
    e2 = EntryCreate(type=EntryType.ORDER, amount=5, custom_category="Car Wash")
    assert e2.custom_category is None


def test_entry_update_custom_category_invariant():
    u = EntryUpdate(type=EntryType.BONUS, custom_category="Car Wash")
    assert u.custom_category is None
    # No type in the partial update → keep the name; the route re-checks
    # against the row's final type.
    u2 = EntryUpdate(custom_category="Car Wash")
    assert u2.custom_category == "Car Wash"
    assert u2.category == ExpenseCategory.OTHER


# ── Category CRUD routes ─────────────────────────────────────────────────────

def test_create_list_categories(client):
    r = client.post("/api/expense-categories", json={"name": "Car Wash", "icon": "🧽"})
    assert r.status_code == 201, r.text
    row = r.json()
    assert row["name"] == "Car Wash" and row["icon"] == "🧽"
    assert [c["name"] for c in client.get("/api/expense-categories").json()] == ["Car Wash"]


def test_duplicate_and_builtin_rejected(client):
    assert client.post("/api/expense-categories", json={"name": "Car Wash"}).status_code == 201
    assert client.post("/api/expense-categories", json={"name": "car wash"}).status_code == 409
    assert client.post("/api/expense-categories", json={"name": "gas"}).status_code == 409
    assert client.post("/api/expense-categories", json={"name": "  "}).status_code == 422


def test_rename_carries_entries_over(client):
    cat_id = client.post("/api/expense-categories", json={"name": "Car Wash"}).json()["id"]
    client.db.add(Entry(user_id=USER_ID, type=EntryType.EXPENSE, app="OTHER", amount=-7,
                        category=ExpenseCategory.OTHER, custom_category="Car Wash"))
    client.db.add(Entry(user_id=OTHER_ID, type=EntryType.EXPENSE, app="OTHER", amount=-7,
                        category=ExpenseCategory.OTHER, custom_category="Car Wash"))
    client.db.commit()
    r = client.put(f"/api/expense-categories/{cat_id}", json={"name": "Detailing"})
    assert r.status_code == 200 and r.json()["name"] == "Detailing"
    mine = client.db.query(Entry).filter(Entry.user_id == USER_ID).one()
    other = client.db.query(Entry).filter(Entry.user_id == OTHER_ID).one()
    assert mine.custom_category == "Detailing"       # my history follows
    assert other.custom_category == "Car Wash"       # other users untouched


def test_rename_conflicts_rejected(client):
    a = client.post("/api/expense-categories", json={"name": "Car Wash"}).json()["id"]
    client.post("/api/expense-categories", json={"name": "Detailing"})
    assert client.put(f"/api/expense-categories/{a}", json={"name": "detailing"}).status_code == 409
    assert client.put(f"/api/expense-categories/{a}", json={"name": "GAS"}).status_code == 409
    assert client.put("/api/expense-categories/999", json={"name": "X"}).status_code == 404


def test_delete_keeps_entries(client):
    cat_id = client.post("/api/expense-categories", json={"name": "Car Wash"}).json()["id"]
    client.db.add(Entry(user_id=USER_ID, type=EntryType.EXPENSE, app="OTHER", amount=-7,
                        category=ExpenseCategory.OTHER, custom_category="Car Wash"))
    client.db.commit()
    assert client.delete(f"/api/expense-categories/{cat_id}").status_code == 204
    assert client.get("/api/expense-categories").json() == []
    kept = client.db.query(Entry).one()
    assert kept.custom_category == "Car Wash"
    assert client.delete(f"/api/expense-categories/{cat_id}").status_code == 404


def test_cannot_touch_another_users_category(client):
    row = UserExpenseCategory(user_id=OTHER_ID, name="Theirs")
    client.db.add(row)
    client.db.commit()
    assert client.put(f"/api/expense-categories/{row.id}", json={"name": "Mine"}).status_code == 404
    assert client.delete(f"/api/expense-categories/{row.id}").status_code == 404


# ── Hidden built-ins ─────────────────────────────────────────────────────────

def test_hidden_builtins_roundtrip(client):
    assert client.get("/api/expense-categories/hidden").json() == []
    r = client.put("/api/expense-categories/hidden", json={"keys": ["GAS", "gas", "tolls"]})
    assert r.status_code == 200
    assert r.json() == ["GAS", "TOLLS"]  # normalized + deduped
    assert client.get("/api/expense-categories/hidden").json() == ["GAS", "TOLLS"]
    # Wholesale replace (unhide GAS)
    assert client.put("/api/expense-categories/hidden", json={"keys": ["TOLLS"]}).json() == ["TOLLS"]
    assert client.get("/api/expense-categories/hidden").json() == ["TOLLS"]
    # Clear all
    assert client.put("/api/expense-categories/hidden", json={"keys": []}).json() == []


def test_hidden_builtins_cannot_hide_all_without_custom(client):
    all_keys = [c.value for c in ExpenseCategory]
    r = client.put("/api/expense-categories/hidden", json={"keys": all_keys})
    assert r.status_code == 400
    assert "at least one" in r.json()["detail"].lower()
    # Hiding all-but-one is fine.
    assert client.put("/api/expense-categories/hidden", json={"keys": all_keys[:-1]}).status_code == 200


def test_hidden_builtins_all_allowed_with_custom_category(client):
    assert client.post("/api/expense-categories", json={"name": "Car Wash"}).status_code == 201
    all_keys = [c.value for c in ExpenseCategory]
    r = client.put("/api/expense-categories/hidden", json={"keys": all_keys})
    assert r.status_code == 200
    assert sorted(r.json()) == sorted(all_keys)


def test_delete_last_custom_blocked_while_all_builtins_hidden(client):
    cid = client.post("/api/expense-categories", json={"name": "Car Wash"}).json()["id"]
    all_keys = [c.value for c in ExpenseCategory]
    assert client.put("/api/expense-categories/hidden", json={"keys": all_keys}).status_code == 200
    r = client.delete(f"/api/expense-categories/{cid}")
    assert r.status_code == 400
    assert "at least one" in r.json()["detail"].lower()
    # Restoring a built-in unblocks the delete.
    assert client.put("/api/expense-categories/hidden", json={"keys": all_keys[:-1]}).status_code == 200
    assert client.delete(f"/api/expense-categories/{cid}").status_code == 204


def test_hidden_builtins_rejects_unknown_key(client):
    assert client.put("/api/expense-categories/hidden", json={"keys": ["NOT_A_CAT"]}).status_code == 422


# ── Entry routes honor custom_category ───────────────────────────────────────

def test_entry_create_and_update_with_custom_category(client):
    r = client.post("/api/entries", json={
        "type": "EXPENSE", "app": "OTHER", "amount": 12.5,
        "category": "GAS", "custom_category": "Car Wash",
    })
    assert r.status_code in (200, 201), r.text
    body = r.json()
    assert body["custom_category"] == "Car Wash"
    assert body["category"] == "OTHER"  # forced safe enum

    # Switching the entry back to a built-in category clears the custom name.
    r2 = client.put(f"/api/entries/{body['id']}", json={"category": "GAS", "custom_category": None})
    assert r2.status_code == 200, r2.text
    assert r2.json()["custom_category"] is None
    assert r2.json()["category"] == "GAS"

    # Flipping the TYPE away from EXPENSE clears a custom category server-side.
    r3 = client.put(f"/api/entries/{body['id']}", json={"custom_category": "Car Wash"})
    assert r3.json()["custom_category"] == "Car Wash"
    r4 = client.put(f"/api/entries/{body['id']}", json={"type": "BONUS"})
    assert r4.json()["custom_category"] is None
