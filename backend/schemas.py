from pydantic import BaseModel, Field
from datetime import datetime
from decimal import Decimal
from typing import Optional
from backend.models import EntryType, AppType, ExpenseCategory

class EntryCreate(BaseModel):
    timestamp: Optional[datetime] = None
    type: EntryType
    app: AppType
    order_id: Optional[str] = None
    amount: Decimal
    distance_miles: Optional[float] = 0.0
    duration_minutes: Optional[int] = 0
    category: Optional[ExpenseCategory] = None
    note: Optional[str] = None

class EntryUpdate(BaseModel):
    timestamp: Optional[datetime] = None
    type: Optional[EntryType] = None
    app: Optional[AppType] = None
    order_id: Optional[str] = None
    amount: Optional[Decimal] = None
    distance_miles: Optional[float] = None
    duration_minutes: Optional[int] = None
    category: Optional[ExpenseCategory] = None
    note: Optional[str] = None

class EntryResponse(BaseModel):
    id: int
    timestamp: datetime
    type: EntryType
    app: AppType
    order_id: Optional[str]
    amount: Decimal
    distance_miles: float
    duration_minutes: int
    category: Optional[ExpenseCategory]
    note: Optional[str]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class SettingsResponse(BaseModel):
    cost_per_mile: Decimal
    
    class Config:
        from_attributes = True

class SettingsUpdate(BaseModel):
    cost_per_mile: Decimal

class RollupResponse(BaseModel):
    revenue: Decimal
    expenses: Decimal
    profit: Decimal
    miles: float
    hours: float
    dollars_per_mile: Decimal
    dollars_per_hour: Decimal
    by_type: dict
    by_app: dict
