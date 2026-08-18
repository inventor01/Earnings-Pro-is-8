from fastapi import APIRouter, Depends, HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from sqlalchemy import func
from backend.db import get_db
from backend.models import AuthUser, UserPlatform, Entry, UserLabelOverride, UserHiddenBuiltin, AppType
from backend.schemas import PlatformCreate, PlatformResponse, LabelOverrideSet, LabelOverrideResponse, HiddenBuiltinsSet
from backend.auth import get_current_user
from typing import List

router = APIRouter()

# Modest per-IP limit: platform creation is a rare, user-initiated action, so
# this only guards against scripted flooding of the table.
platform_limiter = Limiter(key_func=get_remote_address)

# Built-in AppType display labels — a custom platform must not shadow one of
# these (case-insensitive), otherwise the UI would show two identical chips.
BUILTIN_PLATFORM_NAMES = {
    "doordash", "door dash",
    "ubereats", "uber eats",
    "instacart",
    "grubhub", "grub hub",
    "shipt",
    "other",
}

# Hard cap so a single account can't grow an unbounded platform list.
MAX_PLATFORMS_PER_USER = 30


@router.get("/platforms", response_model=List[PlatformResponse])
async def list_platforms(db: Session = Depends(get_db), current_user: AuthUser = Depends(get_current_user)):
    return (
        db.query(UserPlatform)
        .filter(UserPlatform.user_id == current_user.id)
        .order_by(UserPlatform.created_at.asc(), UserPlatform.id.asc())
        .all()
    )


# ── Hidden BUILT-IN platforms (cosmetic, per-user) ──────────────────────────
# Same design as hidden expense categories: hiding only removes the selector
# pill; entries already logged under a hidden platform are untouched.

HIDDEN_PLATFORM_KIND = "platform"
BUILTIN_PLATFORM_KEYS = {a.value for a in AppType}


@router.get("/platforms/hidden", response_model=List[str])
async def list_hidden_builtin_platforms(db: Session = Depends(get_db), current_user: AuthUser = Depends(get_current_user)):
    rows = (
        db.query(UserHiddenBuiltin)
        .filter(UserHiddenBuiltin.user_id == current_user.id, UserHiddenBuiltin.kind == HIDDEN_PLATFORM_KIND)
        .order_by(UserHiddenBuiltin.id.asc())
        .all()
    )
    return [r.key for r in rows]


@router.put("/platforms/hidden", response_model=List[str])
async def set_hidden_builtin_platforms(
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
        if k not in BUILTIN_PLATFORM_KEYS:
            raise HTTPException(status_code=422, detail=f"Unknown platform key: {k}")
        seen.add(k)
        keys.append(k)
    # Never allow every built-in to be hidden while the user has no custom
    # platforms — the Platform row would be empty and revenue entries
    # unloggable. The client also guards this; the server is the backstop.
    if len(keys) >= len(BUILTIN_PLATFORM_KEYS):
        has_custom = db.query(UserPlatform).filter(UserPlatform.user_id == current_user.id).first() is not None
        if not has_custom:
            raise HTTPException(status_code=400, detail="At least one platform must stay visible.")

    db.query(UserHiddenBuiltin).filter(
        UserHiddenBuiltin.user_id == current_user.id,
        UserHiddenBuiltin.kind == HIDDEN_PLATFORM_KIND,
    ).delete(synchronize_session=False)
    for k in keys:
        db.add(UserHiddenBuiltin(user_id=current_user.id, kind=HIDDEN_PLATFORM_KIND, key=k))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Could not update hidden platforms. Try again.")
    return keys


@router.post("/platforms", response_model=PlatformResponse, status_code=201)
@platform_limiter.limit("20/minute")
async def create_platform(
    request: Request,
    payload: PlatformCreate,
    db: Session = Depends(get_db),
    current_user: AuthUser = Depends(get_current_user),
):
    name = (payload.name or "").strip()
    if not name:
        raise HTTPException(status_code=422, detail="Platform name is required.")

    if name.lower() in BUILTIN_PLATFORM_NAMES:
        raise HTTPException(status_code=409, detail="That platform already exists.")

    existing = (
        db.query(UserPlatform)
        .filter(
            UserPlatform.user_id == current_user.id,
            func.lower(UserPlatform.name) == name.lower(),
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="You already added that platform.")

    count = db.query(UserPlatform).filter(UserPlatform.user_id == current_user.id).count()
    if count >= MAX_PLATFORMS_PER_USER:
        raise HTTPException(status_code=400, detail=f"Platform limit reached ({MAX_PLATFORMS_PER_USER}).")

    row = UserPlatform(user_id=current_user.id, name=name, color=payload.color, icon=payload.icon)
    db.add(row)
    try:
        db.commit()
    except IntegrityError:
        # Lost a race with a concurrent identical create — return the winner.
        db.rollback()
        row = (
            db.query(UserPlatform)
            .filter(
                UserPlatform.user_id == current_user.id,
                func.lower(UserPlatform.name) == name.lower(),
            )
            .first()
        )
        if row is None:
            raise HTTPException(status_code=409, detail="You already added that platform.")
        return row
    db.refresh(row)
    return row

@router.put("/platforms/{platform_id}", response_model=PlatformResponse)
async def rename_platform(
    platform_id: int,
    payload: PlatformCreate,
    db: Session = Depends(get_db),
    current_user: AuthUser = Depends(get_current_user),
):
    """Rename a user-created platform. Existing entries logged against the old
    name (app=OTHER + custom_app) are carried over to the new name so history
    stays attached to the platform."""
    row = (
        db.query(UserPlatform)
        .filter(UserPlatform.id == platform_id, UserPlatform.user_id == current_user.id)
        .first()
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Platform not found.")

    name = (payload.name or "").strip()
    if not name:
        raise HTTPException(status_code=422, detail="Platform name is required.")

    # PATCH semantics for style: only overwrite color/icon when the field was
    # explicitly present in the payload (explicit null = reset to auto). A
    # legacy caller sending just {name} must never wipe stored styling.
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
        # Name unchanged — but color/icon may still be updated.
        if _apply_style():
            db.commit()
            db.refresh(row)
        return row

    if name.lower() in BUILTIN_PLATFORM_NAMES:
        raise HTTPException(status_code=409, detail="That platform already exists.")

    if name.lower() != old_name.lower():
        clash = (
            db.query(UserPlatform)
            .filter(
                UserPlatform.user_id == current_user.id,
                func.lower(UserPlatform.name) == name.lower(),
                UserPlatform.id != row.id,
            )
            .first()
        )
        if clash:
            raise HTTPException(status_code=409, detail="You already added that platform.")

    row.name = name
    _apply_style()
    # Carry the user's existing entries over to the new name so their history
    # follows the rename (entries store the platform as a plain string).
    db.query(Entry).filter(
        Entry.user_id == current_user.id,
        Entry.custom_app == old_name,
    ).update({Entry.custom_app: name}, synchronize_session=False)
    try:
        db.commit()
    except IntegrityError:
        # Lost a race with a concurrent create/rename to the same name.
        db.rollback()
        raise HTTPException(status_code=409, detail="You already added that platform.")
    db.refresh(row)
    return row

@router.delete("/platforms/{platform_id}", status_code=204)
async def delete_platform(
    platform_id: int,
    db: Session = Depends(get_db),
    current_user: AuthUser = Depends(get_current_user),
):
    """Delete a user-created platform. Entries logged under it are KEPT —
    they store the platform name as a plain string (app=OTHER + custom_app),
    so history and stats are unaffected; only the selector pill goes away."""
    row = (
        db.query(UserPlatform)
        .filter(UserPlatform.id == platform_id, UserPlatform.user_id == current_user.id)
        .first()
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Platform not found.")
    # Deleting the LAST custom platform while every built-in is hidden would
    # leave zero selectable platforms — same invariant as the hidden-set PUT.
    hidden_count = (
        db.query(UserHiddenBuiltin)
        .filter(UserHiddenBuiltin.user_id == current_user.id, UserHiddenBuiltin.kind == HIDDEN_PLATFORM_KIND)
        .count()
    )
    if hidden_count >= len(BUILTIN_PLATFORM_KEYS):
        remaining_custom = (
            db.query(UserPlatform)
            .filter(UserPlatform.user_id == current_user.id, UserPlatform.id != row.id)
            .first()
        )
        if remaining_custom is None:
            raise HTTPException(
                status_code=400,
                detail="At least one platform must stay visible. Restore a built-in platform first.",
            )
    db.delete(row)
    db.commit()
    return None


# ---------------------------------------------------------------------------
# Built-in label overrides — per-user cosmetic renames of the built-in
# Platform and Type pills. Only display labels change; the keys stored on
# entries are untouched.
# ---------------------------------------------------------------------------

LABEL_KINDS = {
    "platform": {"DOORDASH", "UBEREATS", "INSTACART", "GRUBHUB", "SHIPT", "OTHER"},
    "type": {"ORDER", "BONUS", "EXPENSE", "CANCELLATION"},
    # Section-heading titles on the Add Entry form (e.g. rename the "Platform"
    # heading to "Gig App"). Display-only, capped at 12 characters.
    "heading": {"PLATFORM", "TYPE"},
}

# Heading titles are rendered as compact section labels, so they carry a hard
# 12-character cap (enforced here, not just in the client UI).
MAX_HEADING_LABEL_LEN = 12
# A single emoji grapheme can span many code points (ZWJ sequences, skin
# tones, flags); the longest common sequences stay well under this.
MAX_HEADING_EMOJI_CODEPOINTS = 16


@router.get("/labels", response_model=List[LabelOverrideResponse])
async def list_label_overrides(
    db: Session = Depends(get_db),
    current_user: AuthUser = Depends(get_current_user),
):
    return (
        db.query(UserLabelOverride)
        .filter(UserLabelOverride.user_id == current_user.id)
        .order_by(UserLabelOverride.id.asc())
        .all()
    )


@router.put("/labels", response_model=List[LabelOverrideResponse])
async def set_label_override(
    payload: LabelOverrideSet,
    db: Session = Depends(get_db),
    current_user: AuthUser = Depends(get_current_user),
):
    """Upsert (or reset, when label is empty) one built-in label override.

    Returns the caller's full override list so the client can replace its
    cache atomically.
    """
    kind = (payload.kind or "").strip().lower()
    valid_keys = LABEL_KINDS.get(kind)
    if valid_keys is None:
        raise HTTPException(status_code=422, detail="kind must be 'platform' or 'type'.")
    key = (payload.key or "").strip().upper()
    if key not in valid_keys:
        raise HTTPException(status_code=422, detail="Unknown key for this kind.")

    label = (payload.label or "").strip()
    if kind == "heading" and label and len(label) > MAX_HEADING_LABEL_LEN:
        raise HTTPException(
            status_code=422,
            detail=f"Heading titles are limited to {MAX_HEADING_LABEL_LEN} characters.",
        )
    # Heading rows can also carry a custom emoji shown before the title.
    # payload.emoji semantics: None = leave unchanged (older clients omit the
    # field), '' = reset to the default emoji, non-empty = set. One visible
    # emoji is one GRAPHEME but many code points (👩🏽‍🚀, 🏳️‍🌈), so cap by
    # code points generously rather than len()==1.
    emoji: Optional[str] = None
    if kind == "heading" and payload.emoji is not None:
        emoji = payload.emoji.strip()
        if len(emoji) > MAX_HEADING_EMOJI_CODEPOINTS:
            raise HTTPException(status_code=422, detail="Pick a single emoji.")
    row = (
        db.query(UserLabelOverride)
        .filter(
            UserLabelOverride.user_id == current_user.id,
            UserLabelOverride.kind == kind,
            UserLabelOverride.key == key,
        )
        .first()
    )
    # Resulting emoji for THIS write: None = leave the stored value untouched
    # (payload omitted it), '' = clear, non-empty = set.
    def _apply(target: UserLabelOverride) -> None:
        target.label = label
        if emoji is not None:
            target.emoji = emoji or None

    resulting_emoji = (
        (emoji or None) if emoji is not None else (row.emoji if row is not None else None)
    )
    if not label and not resulting_emoji:
        # Nothing overridden anymore — reset to default by deleting the row.
        if row is not None:
            db.delete(row)
            db.commit()
    else:
        if row is None:
            row = UserLabelOverride(
                user_id=current_user.id, kind=kind, key=key, label=label, emoji=emoji or None
            )
            db.add(row)
        else:
            _apply(row)
        try:
            db.commit()
        except IntegrityError:
            # Race with a concurrent upsert of the same (kind, key): retry as update.
            db.rollback()
            existing = (
                db.query(UserLabelOverride)
                .filter(
                    UserLabelOverride.user_id == current_user.id,
                    UserLabelOverride.kind == kind,
                    UserLabelOverride.key == key,
                )
                .first()
            )
            if existing is None:
                raise HTTPException(status_code=409, detail="Could not save the label. Try again.")
            _apply(existing)
            db.commit()

    return (
        db.query(UserLabelOverride)
        .filter(UserLabelOverride.user_id == current_user.id)
        .order_by(UserLabelOverride.id.asc())
        .all()
    )
