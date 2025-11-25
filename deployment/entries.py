from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.db import get_db
from backend.models import Entry, EntryType
from backend.schemas import EntryCreate, EntryUpdate, EntryResponse
from typing import List, Optional
from datetime import datetime, timezone
from decimal import Decimal

router = APIRouter()

@router.post("/entries", response_model=EntryResponse)
async def create_entry(entry: EntryCreate, db: Session = Depends(get_db)):
    amount = entry.amount
    
    if entry.type in [EntryType.EXPENSE, EntryType.CANCELLATION]:
        amount = -abs(amount)
    else:
        amount = abs(amount)
    
    db_entry = Entry(
        timestamp=entry.timestamp or datetime.utcnow(),
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
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    limit: int = 100,
    cursor: Optional[int] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Entry)
    
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
async def update_entry(entry_id: int, entry_update: EntryUpdate, db: Session = Depends(get_db)):
    db_entry = db.query(Entry).filter(Entry.id == entry_id).first()
    if not db_entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    
    update_data = entry_update.model_dump(exclude_unset=True)
    
    if "amount" in update_data and "type" in update_data:
        amount = update_data["amount"]
        if update_data["type"] in [EntryType.EXPENSE, EntryType.CANCELLATION]:
            update_data["amount"] = -abs(amount)
        else:
            update_data["amount"] = abs(amount)
    elif "amount" in update_data:
        amount = update_data["amount"]
        if db_entry.type in [EntryType.EXPENSE, EntryType.CANCELLATION]:
            update_data["amount"] = -abs(amount)
        else:
            update_data["amount"] = abs(amount)
    elif "type" in update_data:
        if update_data["type"] in [EntryType.EXPENSE, EntryType.CANCELLATION]:
            update_data["amount"] = -abs(db_entry.amount)
        else:
            update_data["amount"] = abs(db_entry.amount)
    
    for key, value in update_data.items():
        setattr(db_entry, key, value)
    
    db_entry.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(db_entry)
    return db_entry

@router.delete("/entries/{entry_id}")
async def delete_entry(entry_id: int, db: Session = Depends(get_db)):
    db_entry = db.query(Entry).filter(Entry.id == entry_id).first()
    if not db_entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    
    db.delete(db_entry)
    db.commit()
    return {"message": "Entry deleted successfully"}

@router.delete("/entries")
async def delete_all_entries(db: Session = Depends(get_db)):
    db.query(Entry).delete()
    db.commit()
    return {"message": "All entries deleted successfully"}
