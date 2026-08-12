from fastapi import APIRouter, Depends, HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from sqlalchemy import func
from backend.db import get_db
from backend.models import AuthUser, UserEntryType, Entry, UserHiddenBuiltin
from backend.schemas import EntryTypeCreate, EntryTypeResponse, HiddenBuiltinsSet
from backend.auth import get_current_user
from typing import List

# Custom EARNINGS TYPES (the Type row: Order / Bonus / Expense / Cancellation),
# mirroring the custom-platform design: entries logged against a custom type
# keep a BASE enum type (BONUS for kind='income', EXPENSE for kind='expense')
# and carry the display name in entries.custom_type — so sign rules, rollups,
# and older clients keep working, and deleting a type never touches history.

router = APIRouter()

entry_type_limiter = Limiter(key_func=get_remote_address)

# A custom type must not shadow a built-in Type pill (case-insensitive).
BUILTIN_TYPE_NAMES = {"order", "bonus", "expense", "cancellation", "tip", "tips"}

MAX_ENTRY_TYPES_PER_USER = 30


@router.get("/entry-types", response_model=List[EntryTypeResponse])
async def list_entry_types(db: Session = Depends(get_db), current_user: AuthUser = Depends(get_current_user)):
    return (
        db.query(UserEntryType)
        .filter(UserEntryType.user_id == current_user.id)
        .order_by(UserEntryType.created_at.asc(), UserEntryType.id.asc())
        .all()
    )


# ── Hidden BUILT-IN type pills (cosmetic, per-user) ─────────────────────────
# Same design as hidden expense categories: hiding only removes the selector
# pill; entries already logged under a hidden type are untouched. EXPENSE is
# NOT hideable — it anchors the Expense mode of the entry form; ORDER is NOT
# hideable — it anchors the Revenue mode and is the default selection.

HIDDEN_TYPE_KIND = "entry_type"
HIDEABLE_TYPE_KEYS = {"BONUS", "CANCELLATION"}


@router.get("/entry-types/hidden", response_model=List[str])
async def list_hidden_builtin_types(db: Session = Depends(get_db), current_user: AuthUser = Depends(get_current_user)):
    rows = (
        db.query(UserHiddenBuiltin)
        .filter(UserHiddenBuiltin.user_id == current_user.id, UserHiddenBuiltin.kind == HIDDEN_TYPE_KIND)
        .order_by(UserHiddenBuiltin.id.asc())
        .all()
    )
    return [r.key for r in rows]


@router.put("/entry-types/hidden", response_model=List[str])
async def set_hidden_builtin_types(
    payload: HiddenBuiltinsSet,
    db: Session = Depends(get_db),
    current_user: AuthUser = Depends(get_current_user),
):
    """Replace the hidden-builtins set wholesale (idempotent)."""
    keys = []
    seen = set()
    for k in payload.keys:
        k = (k or "").strip().upper()
        if not k or k in seen:
            continue
        if k not in HIDEABLE_TYPE_KEYS:
            raise HTTPException(status_code=422, detail=f"Type {k} cannot be hidden.")
        seen.add(k)
        keys.append(k)

    db.query(UserHiddenBuiltin).filter(
        UserHiddenBuiltin.user_id == current_user.id,
        UserHiddenBuiltin.kind == HIDDEN_TYPE_KIND,
    ).delete(synchronize_session=False)
    for k in keys:
        db.add(UserHiddenBuiltin(user_id=current_user.id, kind=HIDDEN_TYPE_KIND, key=k))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Could not update hidden types. Try again.")
    return keys


@router.post("/entry-types", response_model=EntryTypeResponse, status_code=201)
@entry_type_limiter.limit("20/minute")
async def create_entry_type(
    request: Request,
    payload: EntryTypeCreate,
    db: Session = Depends(get_db),
    current_user: AuthUser = Depends(get_current_user),
):
    name = (payload.name or "").strip()
    if not name:
        raise HTTPException(status_code=422, detail="Type name is required.")

    if name.lower() in BUILTIN_TYPE_NAMES:
        raise HTTPException(status_code=409, detail="That type already exists.")

    existing = (
        db.query(UserEntryType)
        .filter(
            UserEntryType.user_id == current_user.id,
            func.lower(UserEntryType.name) == name.lower(),
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="You already added that type.")

    count = db.query(UserEntryType).filter(UserEntryType.user_id == current_user.id).count()
    if count >= MAX_ENTRY_TYPES_PER_USER:
        raise HTTPException(status_code=400, detail=f"Type limit reached ({MAX_ENTRY_TYPES_PER_USER}).")

    row = UserEntryType(
        user_id=current_user.id,
        name=name,
        kind=payload.kind,
        color=payload.color,
        icon=payload.icon,
    )
    db.add(row)
    try:
        db.commit()
    except IntegrityError:
        # Lost a race with a concurrent identical create — return the winner.
        db.rollback()
        row = (
            db.query(UserEntryType)
            .filter(
                UserEntryType.user_id == current_user.id,
                func.lower(UserEntryType.name) == name.lower(),
            )
            .first()
        )
        if row is None:
            raise HTTPException(status_code=409, detail="You already added that type.")
        return row
    db.refresh(row)
    return row


@router.put("/entry-types/{type_id}", response_model=EntryTypeResponse)
async def update_entry_type(
    type_id: int,
    payload: EntryTypeCreate,
    db: Session = Depends(get_db),
    current_user: AuthUser = Depends(get_current_user),
):
    """Rename / restyle a user-created type. Existing entries logged under the
    old name are carried over so history stays attached. `kind` is fixed at
    creation and deliberately ignored here — flipping income/expense would
    silently change the meaning of historical entries."""
    row = (
        db.query(UserEntryType)
        .filter(UserEntryType.id == type_id, UserEntryType.user_id == current_user.id)
        .first()
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Type not found.")

    name = (payload.name or "").strip()
    if not name:
        raise HTTPException(status_code=422, detail="Type name is required.")

    # PATCH semantics for style (same contract as platforms): only overwrite
    # color/icon when explicitly present; explicit null = reset to auto.
    sent = payload.model_fields_set

    def _apply_style() -> bool:
        changed = False
        if "color" in sent and row.color != payload.color:
            row.color = payload.color
            changed = True
        if "icon" in sent and row.icon != payload.icon:
            row.icon = payload.icon
            changed = True
        return changed

    old_name = row.name
    if name == old_name:
        if _apply_style():
            db.commit()
            db.refresh(row)
        return row

    if name.lower() in BUILTIN_TYPE_NAMES:
        raise HTTPException(status_code=409, detail="That type already exists.")

    if name.lower() != old_name.lower():
        clash = (
            db.query(UserEntryType)
            .filter(
                UserEntryType.user_id == current_user.id,
                func.lower(UserEntryType.name) == name.lower(),
                UserEntryType.id != row.id,
            )
            .first()
        )
        if clash:
            raise HTTPException(status_code=409, detail="You already added that type.")

    row.name = name
    _apply_style()
    # Carry existing entries over to the new name so history follows the type.
    db.query(Entry).filter(
        Entry.user_id == current_user.id,
        Entry.custom_type == old_name,
    ).update({Entry.custom_type: name}, synchronize_session=False)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="You already added that type.")
    db.refresh(row)
    return row


@router.delete("/entry-types/{type_id}", status_code=204)
async def delete_entry_type(
    type_id: int,
    db: Session = Depends(get_db),
    current_user: AuthUser = Depends(get_current_user),
):
    """Delete a user-created type. Entries logged under it are KEPT — they
    store the name as a plain string plus a safe base enum type, so history
    and totals are untouched; only the selector pill goes away."""
    row = (
        db.query(UserEntryType)
        .filter(UserEntryType.id == type_id, UserEntryType.user_id == current_user.id)
        .first()
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Type not found.")
    db.delete(row)
    db.commit()
    return None
