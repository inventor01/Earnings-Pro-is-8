from pydantic import BaseModel, Field, field_validator
from datetime import datetime
from decimal import Decimal
from typing import Optional
from backend.models import EntryType, AppType, ExpenseCategory, TimeframeType

# Hard cap on inline receipt payloads. Receipts are stored as
# `data:image/jpeg;base64,…` strings on the Entry row (no object storage yet),
# so an uncapped column would let a single request blow up SQLite and the
# rollup queries that scan the table. 2 MB of base64 ≈ 1.5 MB image, which
# comfortably covers a 0.6-quality JPEG from `expo-image-picker`.
MAX_RECEIPT_BYTES = 2_000_000


def _validate_receipt(v: Optional[str]) -> Optional[str]:
    if v is None:
        return v
    if len(v) > MAX_RECEIPT_BYTES:
        raise ValueError(
            f"receipt_url exceeds {MAX_RECEIPT_BYTES} bytes "
            f"(got {len(v)}). Downscale the image client-side before upload."
        )
    return v


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

    _validate_receipt = field_validator("receipt_url")(_validate_receipt)


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

    _validate_receipt = field_validator("receipt_url")(_validate_receipt)


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
