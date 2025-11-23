from pydantic import BaseModel, Field
from datetime import datetime
from decimal import Decimal
from typing import Optional
from backend.models import EntryType, AppType, ExpenseCategory, TimeframeType

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
    receipt_url: Optional[str] = None

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
    receipt_url: Optional[str] = None

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
    receipt_url: Optional[str]
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

class GoalCreate(BaseModel):
    timeframe: TimeframeType
    target_profit: Decimal

class GoalUpdate(BaseModel):
    target_profit: Decimal

class GoalResponse(BaseModel):
    id: int
    timeframe: TimeframeType
    target_profit: Decimal
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class RollupResponse(BaseModel):
    revenue: float
    expenses: float
    profit: float
    miles: float
    hours: float
    dollars_per_mile: float
    dollars_per_hour: float
    average_order_value: float
    per_hour_first_to_last: float
    by_type: dict[str, float]
    by_app: dict[str, float]
    goal: Optional[GoalResponse] = None
    goal_progress: Optional[float] = None
