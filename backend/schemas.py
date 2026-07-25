from pydantic import BaseModel, Field, field_validator, model_validator
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


# Custom platform names: user-facing display strings. Keep them short and
# non-empty; strip whitespace and treat blank as "not provided".
MAX_CUSTOM_APP_LEN = 24


def _validate_custom_app(v: Optional[str]) -> Optional[str]:
    if v is None:
        return v
    v = v.strip()
    if not v:
        return None
    if len(v) > MAX_CUSTOM_APP_LEN:
        raise ValueError(f"custom_app must be at most {MAX_CUSTOM_APP_LEN} characters.")
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
    idempotency_key: Optional[str] = None
    custom_app: Optional[str] = None

    _validate_receipt = field_validator("receipt_url")(_validate_receipt)
    _validate_custom_app = field_validator("custom_app")(_validate_custom_app)

    @model_validator(mode="after")
    def _enforce_custom_app_invariant(self):
        # Invariant: a custom platform name only ever rides on app=OTHER.
        # A custom name forces OTHER; a built-in app clears any stray name.
        if self.custom_app:
            self.app = AppType.OTHER
        elif self.app is not None and self.app != AppType.OTHER:
            self.custom_app = None
        return self


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
    custom_app: Optional[str] = None

    _validate_custom_app = field_validator("custom_app")(_validate_custom_app)

    _validate_receipt = field_validator("receipt_url")(_validate_receipt)

    @model_validator(mode="after")
    def _enforce_custom_app_invariant(self):
        # Same invariant as EntryCreate, on the partial-update shape: a custom
        # name forces app=OTHER; switching to a built-in app clears the name.
        if self.custom_app:
            self.app = AppType.OTHER
        elif self.app is not None and self.app != AppType.OTHER:
            self.custom_app = None
        return self


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
    # Echo the stable client key back so the mobile offline overlay can tell when
    # a still-queued create has already landed on the server (timed-out-but-saved
    # replay) and suppress the transient duplicate until the queue drains.
    idempotency_key: Optional[str] = None
    custom_app: Optional[str] = None
    
    class Config:
        from_attributes = True

class PlatformCreate(BaseModel):
    name: str

    _validate_name = field_validator("name")(_validate_custom_app)


class PlatformResponse(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True


class LabelOverrideSet(BaseModel):
    kind: str   # 'platform' | 'type'
    key: str    # builtin key, e.g. DOORDASH / ORDER
    label: Optional[str] = None  # None/empty → reset to default

    _validate_label = field_validator("label")(_validate_custom_app)


class LabelOverrideResponse(BaseModel):
    kind: str
    key: str
    label: str

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
