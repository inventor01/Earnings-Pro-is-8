from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.db import get_db
from backend.models import Entry, EntryType, AuthUser, Goal
from backend.schemas import EntryCreate, EntryUpdate, EntryResponse
from backend.auth import get_current_user
from typing import List, Optional
from datetime import datetime, timezone
from decimal import Decimal

router = APIRouter()

@router.post("/entries", response_model=EntryResponse)
async def create_entry(entry: EntryCreate, db: Session = Depends(get_db), current_user: AuthUser = Depends(get_current_user)):
    from pytz import timezone as pytz_timezone
    
    amount = entry.amount
    
    if entry.type in [EntryType.EXPENSE, EntryType.CANCELLATION]:
        amount = -abs(amount)
    else:
        amount = abs(amount)
    
    # Calculate timestamp - prefer date/time components over timestamp (for proper timezone handling)
    if entry.date and entry.time:
        # Parse date and time as EST, then convert to UTC
        try:
            est = pytz_timezone('US/Eastern')
            datetime_str = f"{entry.date}T{entry.time}:00"
            # Create a naive datetime and localize it to EST
            naive_dt = datetime.fromisoformat(datetime_str)
            est_dt = est.localize(naive_dt)
            # Convert to UTC
            timestamp = est_dt.astimezone(timezone.utc).replace(tzinfo=None)
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
    db.commit()
    db.refresh(db_entry)
    return db_entry

@router.get("/entries", response_model=List[EntryResponse])
async def get_entries(
    timeframe: Optional[str] = None,
    day_offset: Optional[int] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    limit: int = 100,
    cursor: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: AuthUser = Depends(get_current_user)
):
    from backend.services.period import (
        get_today, get_yesterday, get_this_week, get_last_7_days,
        get_this_month, get_last_month, get_day_offset
    )
    
    query = db.query(Entry).filter(Entry.user_id == current_user.id)
    
    # Use timeframe if provided (new approach - avoids timezone issues)
    if timeframe:
        if timeframe == 'TODAY':
            if day_offset is not None:
                from_dt, to_dt = get_day_offset(day_offset)
            else:
                from_dt, to_dt = get_today()
        elif timeframe == 'YESTERDAY':
            from_dt, to_dt = get_yesterday()
        elif timeframe == 'THIS_WEEK':
            from_dt, to_dt = get_this_week()
        elif timeframe == 'LAST_7_DAYS':
            from_dt, to_dt = get_last_7_days()
        elif timeframe == 'THIS_MONTH':
            from_dt, to_dt = get_this_month()
        elif timeframe == 'LAST_MONTH':
            from_dt, to_dt = get_last_month()
        else:
            from_dt, to_dt = get_today()
        
        query = query.filter(Entry.timestamp >= from_dt)
        query = query.filter(Entry.timestamp <= to_dt)
    # Fall back to old from_date/to_date parameters for backward compatibility
    elif from_date or to_date:
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
    from pytz import timezone as pytz_timezone
    
    db_entry = db.query(Entry).filter(Entry.id == entry_id, Entry.user_id == current_user.id).first()
    if not db_entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    
    update_data = entry_update.model_dump(exclude_unset=True)
    
    # Handle date/time components if provided (for proper timezone handling)
    if "date" in update_data and "time" in update_data and update_data["date"] and update_data["time"]:
        try:
            est = pytz_timezone('US/Eastern')
            datetime_str = f"{update_data['date']}T{update_data['time']}:00"
            naive_dt = datetime.fromisoformat(datetime_str)
            est_dt = est.localize(naive_dt)
            timestamp = est_dt.astimezone(timezone.utc).replace(tzinfo=None)
            update_data["timestamp"] = timestamp
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
        # Delete entries
        entry_delete_count = db.query(Entry).filter(Entry.user_id == current_user.id).delete(synchronize_session=False)
        # Delete goals
        goal_delete_count = db.query(Goal).filter(Goal.user_id == current_user.id).delete(synchronize_session=False)
        # Commit both deletes
        db.commit()
        return {"message": f"Deleted {entry_delete_count} entries and {goal_delete_count} goals"}
    except Exception as e:
        try:
            db.rollback()
        except:
            pass
        import traceback
        print(f"ERROR in delete_all_entries: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Failed to delete data")
