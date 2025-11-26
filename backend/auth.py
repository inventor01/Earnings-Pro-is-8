import jwt
from fastapi import Depends
from fastapi.security import HTTPBearer
from sqlalchemy.orm import Session
from backend.db import get_db
from backend.models import AuthUser, Entry, EntryType, AppType, ExpenseCategory
from datetime import datetime, timedelta
from decimal import Decimal
import logging

logger = logging.getLogger(__name__)

security = HTTPBearer(auto_error=False)
DEFAULT_USER_ID = "default-user"

def seed_demo_entries(db: Session, user_id: str):
    """Seed demo entries for guest user"""
    # Check if already seeded
    existing = db.query(Entry).filter(Entry.user_id == user_id).first()
    if existing:
        return
    
    entries = []
    now = datetime.utcnow()
    
    # Last 5 days of sample data
    for day_offset in range(5):
        base_date = now - timedelta(days=day_offset)
        
        demo_entries = [
            Entry(user_id=user_id, timestamp=base_date.replace(hour=7, minute=15), type=EntryType.ORDER, app=AppType.DOORDASH, order_id=f'DD-{1000+day_offset}', amount=Decimal('18.50'), distance_miles=4.2, duration_minutes=28, note='Delivery'),
            Entry(user_id=user_id, timestamp=base_date.replace(hour=9, minute=30), type=EntryType.ORDER, app=AppType.UBEREATS, order_id=f'UE-{2000+day_offset}', amount=Decimal('22.75'), distance_miles=5.8, duration_minutes=35, note='Delivery'),
            Entry(user_id=user_id, timestamp=base_date.replace(hour=12, minute=0), type=EntryType.EXPENSE, app=AppType.OTHER, amount=Decimal('-15.00'), category=ExpenseCategory.GAS, note='Gas'),
            Entry(user_id=user_id, timestamp=base_date.replace(hour=14, minute=30), type=EntryType.ORDER, app=AppType.INSTACART, order_id=f'IC-{3000+day_offset}', amount=Decimal('35.60'), distance_miles=8.3, duration_minutes=52, note='Grocery'),
            Entry(user_id=user_id, timestamp=base_date.replace(hour=17, minute=0), type=EntryType.ORDER, app=AppType.GRUBHUB, order_id=f'GH-{4000+day_offset}', amount=Decimal('28.40'), distance_miles=6.7, duration_minutes=42, note='Delivery'),
            Entry(user_id=user_id, timestamp=base_date.replace(hour=19, minute=30), type=EntryType.BONUS, app=AppType.DOORDASH, amount=Decimal('5.00'), note='Bonus'),
        ]
        entries.extend(demo_entries)
    
    for entry in entries:
        db.add(entry)
    
    try:
        db.commit()
    except:
        db.rollback()

def get_or_create_default_user(db: Session) -> AuthUser:
    """Get or create default test user"""
    user = db.query(AuthUser).filter(AuthUser.id == DEFAULT_USER_ID).first()
    if not user:
        user = AuthUser(
            id=DEFAULT_USER_ID,
            email="user@example.com",
            first_name="Guest",
            last_name=""
        )
        db.add(user)
        try:
            db.commit()
            db.refresh(user)
            seed_demo_entries(db, user.id)
        except:
            db.rollback()
            user = db.query(AuthUser).filter(AuthUser.id == DEFAULT_USER_ID).first() or user
    else:
        # Make sure demo entries exist
        seed_demo_entries(db, user.id)
    return user

def get_current_user(credentials = Depends(security), db: Session = Depends(get_db)) -> AuthUser:
    """Get current authenticated user - defaults to test user if no token provided"""
    if not credentials:
        return get_or_create_default_user(db)
    
    token = credentials.credentials
    try:
        payload = jwt.decode(token, options={"verify_signature": False})
        user_id = payload.get("sub")
        if user_id is None:
            return get_or_create_default_user(db)
    except:
        return get_or_create_default_user(db)
    
    user = db.query(AuthUser).filter(AuthUser.id == str(user_id)).first()
    if not user:
        user = AuthUser(
            id=str(user_id),
            email=payload.get("email"),
            first_name=payload.get("first_name"),
            last_name=payload.get("last_name"),
            profile_image_url=payload.get("profile_image_url")
        )
        db.add(user)
        try:
            db.commit()
            db.refresh(user)
        except:
            db.rollback()
    
    return user
