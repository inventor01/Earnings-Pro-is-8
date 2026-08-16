from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from backend.db import get_db
from backend.models import Entry, EntryType, AppType, AuthUser, Goal, ExpenseCategory
from backend.schemas import EntryCreate, EntryUpdate, EntryResponse
from backend.auth import get_current_user
from typing import List, Optional
from datetime import datetime, timezone
from decimal import Decimal

router = APIRouter()


def _est_components_to_utc_naive(date_str: str, time_str: str, tz_name: str = "America/New_York") -> datetime:
    """Convert a user-local wall-clock date + time into a naive UTC datetime.

    Builds the datetime from integer components instead of
    ``datetime.fromisoformat(f"{date}T{time}:00")`` so it tolerates inputs that
    are NOT strictly zero-padded — e.g. a single-digit hour ("9:30") or month
    ("2025-1-5"), which some mobile JS engines (React Native / Hermes) emit and
    which ``fromisoformat`` rejects with ValueError. Also normalizes a "24:MM"
    midnight to "00:MM". Raises on genuinely malformed input so callers can
    fall back deliberately.
    """
    from pytz import timezone as pytz_timezone

    year, month, day = (int(p) for p in date_str.split("-"))
    hh_str, mm_str = time_str.split(":")[:2]
    hour, minute = int(hh_str), int(mm_str)
    if hour == 24:
        hour = 0
    tz = pytz_timezone(tz_name)
    naive_local = datetime(year, month, day, hour, minute)
    return tz.localize(naive_local).astimezone(timezone.utc).replace(tzinfo=None)


@router.post("/entries", response_model=EntryResponse)
async def create_entry(entry: EntryCreate, db: Session = Depends(get_db), current_user: AuthUser = Depends(get_current_user)):
    # Idempotent create: if the client's offline add already reached the server
    # (e.g. the original POST saved but the phone saw a timeout and the offline
    # queue replayed it), the same idempotency_key is sent again — return the
    # original row instead of inserting a duplicate.
    if entry.idempotency_key:
        existing = db.query(Entry).filter(
            Entry.user_id == current_user.id,
            Entry.idempotency_key == entry.idempotency_key,
        ).first()
        if existing:
            return existing

    amount = entry.amount
    
    if entry.type in [EntryType.EXPENSE, EntryType.CANCELLATION]:
        amount = -abs(amount)
    else:
        amount = abs(amount)
    
    # Calculate timestamp - prefer date/time components over timestamp (for proper timezone handling)
    if entry.date and entry.time:
        # Parse date and time in the user's timezone, then convert to UTC.
        # Tolerant of non-zero-padded components (see _est_components_to_utc_naive).
        try:
            from backend.services.period import user_tz_name
            timestamp = _est_components_to_utc_naive(entry.date, entry.time, user_tz_name(current_user))
        except Exception:
            timestamp = entry.timestamp or datetime.utcnow()
    else:
        timestamp = entry.timestamp or datetime.utcnow()
    
    db_entry = Entry(
        user_id=current_user.id,
        timestamp=timestamp,
        type=entry.type,
        app=entry.app,
        order_id=entry.order_id,
        amount=amount,
        distance_miles=entry.distance_miles or 0.0,
        duration_minutes=entry.duration_minutes or 0,
        category=entry.category,
        note=entry.note,
        receipt_url=entry.receipt_url,
        is_business_expense=entry.is_business_expense or False,
        during_business_hours=entry.during_business_hours or False,
        idempotency_key=entry.idempotency_key,
        custom_app=entry.custom_app,
        custom_type=entry.custom_type,
        custom_category=entry.custom_category,
    )
    db.add(db_entry)
    try:
        db.commit()
    except IntegrityError:
        # Lost a race with a concurrent replay carrying the same key — the other
        # transaction inserted first and tripped the partial unique index. Return
        # that canonical row instead of erroring.
        db.rollback()
        if entry.idempotency_key:
            existing = db.query(Entry).filter(
                Entry.user_id == current_user.id,
                Entry.idempotency_key == entry.idempotency_key,
            ).first()
            if existing:
                return existing
        raise
    db.refresh(db_entry)
    return db_entry

@router.get("/entries", response_model=List[EntryResponse])
async def get_entries(
    timeframe: Optional[str] = None,
    day_offset: Optional[int] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    limit: int = 500,
    cursor: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: AuthUser = Depends(get_current_user)
):
    from backend.services.period import (
        get_today, get_yesterday, get_this_week, get_last_7_days,
        get_this_month, get_last_month, get_day_offset, user_tz_name
    )
    tz = user_tz_name(current_user)
    
    query = db.query(Entry).filter(Entry.user_id == current_user.id)
    
    # Use timeframe if provided (new approach - avoids timezone issues)
    if timeframe:
        if timeframe == 'TODAY':
            if day_offset is not None:
                from_dt, to_dt = get_day_offset(day_offset, tz)
            else:
                from_dt, to_dt = get_today(tz)
        elif timeframe == 'YESTERDAY':
            from_dt, to_dt = get_yesterday(tz)
        elif timeframe == 'THIS_WEEK':
            from_dt, to_dt = get_this_week(tz)
        elif timeframe == 'LAST_7_DAYS':
            from_dt, to_dt = get_last_7_days(tz)
        elif timeframe == 'THIS_MONTH':
            from_dt, to_dt = get_this_month(tz)
        elif timeframe == 'LAST_MONTH':
            from_dt, to_dt = get_last_month(tz)
        else:
            from_dt, to_dt = get_today(tz)
        
        query = query.filter(Entry.timestamp >= from_dt)
        query = query.filter(Entry.timestamp <= to_dt)
    # Fall back to old from_date/to_date parameters for backward compatibility.
    # Accepts either full ISO datetimes OR YYYY-MM-DD (interpreted as inclusive
    # EST calendar days, mirroring the timeframe helpers).
    elif from_date or to_date:
        from backend.services.period import get_est_date_range, user_tz_name as _utz
        if from_date and to_date and 'T' not in from_date and 'T' not in to_date:
            try:
                from_dt, to_dt = get_est_date_range(from_date, to_date, _utz(current_user))
                query = query.filter(Entry.timestamp >= from_dt)
                query = query.filter(Entry.timestamp <= to_dt)
            except Exception:
                pass
        else:
            if from_date:
                from_dt = datetime.fromisoformat(from_date.replace('Z', '+00:00')).astimezone(timezone.utc).replace(tzinfo=None)
                query = query.filter(Entry.timestamp >= from_dt)
            if to_date:
                to_dt = datetime.fromisoformat(to_date.replace('Z', '+00:00')).astimezone(timezone.utc).replace(tzinfo=None)
                query = query.filter(Entry.timestamp <= to_dt)
    
    if cursor:
        query = query.filter(Entry.id < cursor)
    
    query = query.order_by(Entry.timestamp.desc(), Entry.id.desc())
    entries = query.limit(limit).all()
    
    return entries

@router.put("/entries/{entry_id}", response_model=EntryResponse)
async def update_entry(entry_id: int, entry_update: EntryUpdate, db: Session = Depends(get_db), current_user: AuthUser = Depends(get_current_user)):
    db_entry = db.query(Entry).filter(Entry.id == entry_id, Entry.user_id == current_user.id).first()
    if not db_entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    
    update_data = entry_update.model_dump(exclude_unset=True)
    
    # Handle date/time components if provided (for proper timezone handling).
    # Tolerant of non-zero-padded components (see _est_components_to_utc_naive).
    if "date" in update_data and "time" in update_data and update_data["date"] and update_data["time"]:
        try:
            from backend.services.period import user_tz_name
            update_data["timestamp"] = _est_components_to_utc_naive(
                update_data["date"], update_data["time"], user_tz_name(current_user)
            )
        except Exception:
            pass
    
    # Remove date/time from update_data as they're not database columns
    update_data.pop("date", None)
    update_data.pop("time", None)
    
    if "amount" in update_data and "type" in update_data:
        amount = update_data["amount"]
        if update_data["type"] in [EntryType.EXPENSE, EntryType.CANCELLATION]:
            update_data["amount"] = -abs(amount)
        else:
            update_data["amount"] = abs(amount)
    elif "amount" in update_data:
        amount = update_data["amount"]
        if db_entry.type in [EntryType.EXPENSE, EntryType.CANCELLATION]:
            update_data["amount"] = -abs(Decimal(str(amount)))
        else:
            update_data["amount"] = abs(Decimal(str(amount)))
    elif "type" in update_data:
        if update_data["type"] in [EntryType.EXPENSE, EntryType.CANCELLATION]:
            update_data["amount"] = -abs(Decimal(str(db_entry.amount)))
        else:
            update_data["amount"] = abs(Decimal(str(db_entry.amount)))
    
    for key, value in update_data.items():
        setattr(db_entry, key, value)

    # Post-apply invariant: a custom platform name only rides on app=OTHER.
    # The schema validator can't cover the case where a client sends only
    # `app` (exclude_unset drops the coerced custom_app=None), so enforce it
    # against the FINAL entry state here.
    if db_entry.custom_app and db_entry.app != AppType.OTHER:
        db_entry.custom_app = None

    # Same for custom types: only BONUS/EXPENSE base types may carry one, so a
    # partial update that flips the type to ORDER/CANCELLATION clears the name.
    if db_entry.custom_type and db_entry.type not in (EntryType.BONUS, EntryType.EXPENSE):
        db_entry.custom_type = None

    # Custom expense-category rides only on EXPENSE entries with the safe enum
    # category OTHER. Enforce against the FINAL state (partial updates may flip
    # the type or category without resending custom_category).
    if db_entry.custom_category:
        if db_entry.type != EntryType.EXPENSE:
            db_entry.custom_category = None
        else:
            db_entry.category = ExpenseCategory.OTHER

    setattr(db_entry, 'updated_at', datetime.utcnow())
    db.commit()
    db.refresh(db_entry)
    return db_entry

@router.delete("/entries/{entry_id}")
async def delete_entry(entry_id: int, db: Session = Depends(get_db), current_user: AuthUser = Depends(get_current_user)):
    db_entry = db.query(Entry).filter(Entry.id == entry_id, Entry.user_id == current_user.id).first()
    if not db_entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    
    db.delete(db_entry)
    db.commit()
    return {"message": "Entry deleted successfully"}

@router.delete("/entries")
async def delete_all_entries(db: Session = Depends(get_db), current_user: AuthUser = Depends(get_current_user)):
    try:
        # Delete entries first
        db.query(Entry).filter(Entry.user_id == current_user.id).delete(synchronize_session=False)
        # Delete goals - use raw string comparison to ensure matching
        user_id_str = str(current_user.id)
        db.query(Goal).filter(Goal.user_id == user_id_str).delete(synchronize_session=False)
        # Commit both deletes
        db.commit()
        return {"message": "All entries and goals deleted successfully"}
    except Exception as e:
        try:
            db.rollback()
        except:
            pass
        raise HTTPException(status_code=500, detail="Failed to delete data")

@router.post("/entries/import")
async def import_entries(entries_data: List[EntryCreate], db: Session = Depends(get_db), current_user: AuthUser = Depends(get_current_user)):
    imported_entries = []
    skipped_duplicates = 0

    # Duplicate prevention: platform CSVs (Uber/DoorDash) carry a stable per-order
    # id, so re-importing the same file must not create duplicate rows. We dedupe
    # on a non-empty `order_id` scoped to this user — both against rows already in
    # the DB and against earlier rows within this same batch. Rows without an
    # order_id (e.g. manual entries) are NOT deduped, to avoid wrongly dropping two
    # legitimately-identical manual entries.
    existing_order_ids = {
        oid for (oid,) in db.query(Entry.order_id).filter(
            Entry.user_id == current_user.id,
            Entry.order_id.isnot(None),
            Entry.order_id != "",
        ).all()
    }
    seen_order_ids: set[str] = set()

    for entry in entries_data:
        try:
            order_id = (entry.order_id or "").strip()
            if order_id and (order_id in existing_order_ids or order_id in seen_order_ids):
                skipped_duplicates += 1
                continue

            amount = entry.amount
            
            if entry.type in [EntryType.EXPENSE, EntryType.CANCELLATION]:
                amount = -abs(amount)
            else:
                amount = abs(amount)
            
            # Calculate timestamp - prefer date/time components over timestamp (for proper timezone handling).
            # Tolerant of non-zero-padded components (see _est_components_to_utc_naive).
            if entry.date and entry.time:
                try:
                    from backend.services.period import user_tz_name
                    timestamp = _est_components_to_utc_naive(entry.date, entry.time, user_tz_name(current_user))
                except Exception:
                    timestamp = entry.timestamp or datetime.utcnow()
            else:
                timestamp = entry.timestamp or datetime.utcnow()
            
            db_entry = Entry(
                user_id=current_user.id,
                timestamp=timestamp,
                type=entry.type,
                app=entry.app,
                order_id=entry.order_id,
                amount=amount,
                distance_miles=entry.distance_miles or 0.0,
                duration_minutes=entry.duration_minutes or 0,
                category=entry.category,
                note=entry.note,
                receipt_url=entry.receipt_url
            )
            db.add(db_entry)
            imported_entries.append(db_entry)
            if order_id:
                seen_order_ids.add(order_id)
        except Exception as e:
            continue
    
    try:
        db.commit()
        for entry in imported_entries:
            db.refresh(entry)
        msg = f"Successfully imported {len(imported_entries)} entries"
        if skipped_duplicates:
            msg += f" ({skipped_duplicates} duplicate{'s' if skipped_duplicates != 1 else ''} skipped)"
        return {
            "message": msg,
            "count": len(imported_entries),
            "skipped_duplicates": skipped_duplicates,
            "entries": imported_entries
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to import entries")
