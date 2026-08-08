from fastapi import APIRouter, Depends, HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from sqlalchemy import func
from backend.db import get_db
from backend.models import AuthUser, UserExpenseCategory, UserHiddenBuiltin, Entry, ExpenseCategory
from backend.schemas import ExpenseCategoryCreate, ExpenseCategoryResponse, HiddenBuiltinsSet
from backend.auth import get_current_user
from typing import List

# Custom EXPENSE CATEGORIES (the Category row shown on EXPENSE entries),
# mirroring the custom-type design: entries filed under a custom category keep
# the safe enum category=OTHER and carry the display name in
# entries.custom_category — so rollups and older clients keep working, and
# deleting a category never touches history. Built-in categories can also be
# HIDDEN per user (cosmetic — stored entries/analytics untouched).

router = APIRouter()

expense_cat_limiter = Limiter(key_func=get_remote_address)

# Built-in enum values a custom category must not shadow (case-insensitive).
BUILTIN_CATEGORY_KEYS = {c.value for c in ExpenseCategory}
BUILTIN_CATEGORY_NAMES = {c.value.lower() for c in ExpenseCategory}

MAX_EXPENSE_CATEGORIES_PER_USER = 30

HIDDEN_KIND = "expense_category"


@router.get("/expense-categories", response_model=List[ExpenseCategoryResponse])
async def list_expense_categories(db: Session = Depends(get_db), current_user: AuthUser = Depends(get_current_user)):
    return (
        db.query(UserExpenseCategory)
        .filter(UserExpenseCategory.user_id == current_user.id)
        .order_by(UserExpenseCategory.created_at.asc(), UserExpenseCategory.id.asc())
        .all()
    )


@router.get("/expense-categories/hidden", response_model=List[str])
async def list_hidden_builtin_categories(db: Session = Depends(get_db), current_user: AuthUser = Depends(get_current_user)):
    rows = (
        db.query(UserHiddenBuiltin)
        .filter(UserHiddenBuiltin.user_id == current_user.id, UserHiddenBuiltin.kind == HIDDEN_KIND)
        .order_by(UserHiddenBuiltin.id.asc())
        .all()
    )
    return [r.key for r in rows]


@router.put("/expense-categories/hidden", response_model=List[str])
async def set_hidden_builtin_categories(
    payload: HiddenBuiltinsSet,
    db: Session = Depends(get_db),
    current_user: AuthUser = Depends(get_current_user),
):
    """Replace the hidden-builtins set wholesale (idempotent). Hiding is
    cosmetic — entries stored under a hidden category are untouched."""
    keys = []
    seen = set()
    for k in payload.keys:
        k = (k or "").strip().upper()
        if not k or k in seen:
            continue
        if k not in BUILTIN_CATEGORY_KEYS:
            raise HTTPException(status_code=422, detail=f"Unknown category key: {k}")
        seen.add(k)
        keys.append(k)

    db.query(UserHiddenBuiltin).filter(
        UserHiddenBuiltin.user_id == current_user.id,
        UserHiddenBuiltin.kind == HIDDEN_KIND,
    ).delete(synchronize_session=False)
    for k in keys:
        db.add(UserHiddenBuiltin(user_id=current_user.id, kind=HIDDEN_KIND, key=k))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Could not update hidden categories. Try again.")
    return keys


@router.post("/expense-categories", response_model=ExpenseCategoryResponse, status_code=201)
@expense_cat_limiter.limit("20/minute")
async def create_expense_category(
    request: Request,
    payload: ExpenseCategoryCreate,
    db: Session = Depends(get_db),
    current_user: AuthUser = Depends(get_current_user),
):
    name = (payload.name or "").strip()
    if not name:
        raise HTTPException(status_code=422, detail="Category name is required.")

    if name.lower() in BUILTIN_CATEGORY_NAMES:
        raise HTTPException(status_code=409, detail="That category already exists.")

    existing = (
        db.query(UserExpenseCategory)
        .filter(
            UserExpenseCategory.user_id == current_user.id,
            func.lower(UserExpenseCategory.name) == name.lower(),
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="You already added that category.")

    count = db.query(UserExpenseCategory).filter(UserExpenseCategory.user_id == current_user.id).count()
    if count >= MAX_EXPENSE_CATEGORIES_PER_USER:
        raise HTTPException(status_code=400, detail=f"Category limit reached ({MAX_EXPENSE_CATEGORIES_PER_USER}).")

    row = UserExpenseCategory(
        user_id=current_user.id,
        name=name,
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
            db.query(UserExpenseCategory)
            .filter(
                UserExpenseCategory.user_id == current_user.id,
                func.lower(UserExpenseCategory.name) == name.lower(),
            )
            .first()
        )
        if row is None:
            raise HTTPException(status_code=409, detail="You already added that category.")
        return row
    db.refresh(row)
    return row


@router.put("/expense-categories/{cat_id}", response_model=ExpenseCategoryResponse)
async def update_expense_category(
    cat_id: int,
    payload: ExpenseCategoryCreate,
    db: Session = Depends(get_db),
    current_user: AuthUser = Depends(get_current_user),
):
    """Rename / restyle a user-created category. Existing entries filed under
    the old name are carried over so history stays attached."""
    row = (
        db.query(UserExpenseCategory)
        .filter(UserExpenseCategory.id == cat_id, UserExpenseCategory.user_id == current_user.id)
        .first()
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Category not found.")

    name = (payload.name or "").strip()
    if not name:
        raise HTTPException(status_code=422, detail="Category name is required.")

    # PATCH semantics for style (same contract as platforms/types): only
    # overwrite color/icon when explicitly present; explicit null = reset.
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

    if name.lower() in BUILTIN_CATEGORY_NAMES:
        raise HTTPException(status_code=409, detail="That category already exists.")

    if name.lower() != old_name.lower():
        clash = (
            db.query(UserExpenseCategory)
            .filter(
                UserExpenseCategory.user_id == current_user.id,
                func.lower(UserExpenseCategory.name) == name.lower(),
                UserExpenseCategory.id != row.id,
            )
            .first()
        )
        if clash:
            raise HTTPException(status_code=409, detail="You already added that category.")

    row.name = name
    _apply_style()
    # Carry existing entries over to the new name so history follows.
    db.query(Entry).filter(
        Entry.user_id == current_user.id,
        Entry.custom_category == old_name,
    ).update({Entry.custom_category: name}, synchronize_session=False)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="You already added that category.")
    db.refresh(row)
    return row


@router.delete("/expense-categories/{cat_id}", status_code=204)
async def delete_expense_category(
    cat_id: int,
    db: Session = Depends(get_db),
    current_user: AuthUser = Depends(get_current_user),
):
    """Delete a user-created category. Entries filed under it are KEPT — they
    store the name as a plain string plus the safe enum category OTHER, so
    history and totals are untouched; only the selector pill goes away."""
    row = (
        db.query(UserExpenseCategory)
        .filter(UserExpenseCategory.id == cat_id, UserExpenseCategory.user_id == current_user.id)
        .first()
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Category not found.")
    db.delete(row)
    db.commit()
    return None
