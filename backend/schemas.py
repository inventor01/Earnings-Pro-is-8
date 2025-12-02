from pydantic import BaseModel, Field
from datetime import datetime
from decimal import Decimal
from typing import Optional
from backend.models import EntryType, AppType, ExpenseCategory, TimeframeType

class EntryCreate(BaseModel):
    timestamp: Optional[datetime] = None
    date: Optional[str] = None
    time: Optional[str] = None
    type: EntryType
    app: Optional[AppType] = AppType.OTHER
    order_id: Optional[str] = None
    amount: Decimal
    distance_miles: Optional[float] = 0.0
    duration_minutes: Optional[int] = 0
    category: Optional[ExpenseCategory] = None
    note: Optional[str] = None
    receipt_url: Optional[str] = None
    is_business_expense: Optional[bool] = False
    during_business_hours: Optional[bool] = False

class EntryUpdate(BaseModel):
    timestamp: Optional[datetime] = None
    date: Optional[str] = None
    time: Optional[str] = None
    type: Optional[EntryType] = None
    app: Optional[AppType] = None
    order_id: Optional[str] = None
    amount: Optional[Decimal] = None
    distance_miles: Optional[float] = None
    duration_minutes: Optional[int] = None
    category: Optional[ExpenseCategory] = None
    note: Optional[str] = None
    receipt_url: Optional[str] = None
    is_business_expense: Optional[bool] = None
    during_business_hours: Optional[bool] = None

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
    is_business_expense: Optional[bool]
    during_business_hours: Optional[bool]
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
    goal_name: Optional[str] = "Savings Goal"

class GoalUpdate(BaseModel):
    target_profit: Decimal

class GoalResponse(BaseModel):
    id: int
    timeframe: TimeframeType
    target_profit: Decimal
    goal_name: str
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
    by_type: dict[str, float]
    by_app: dict[str, float]
    goal: Optional[GoalResponse] = None
    goal_progress: Optional[float] = None
