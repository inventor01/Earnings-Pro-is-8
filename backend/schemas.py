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
    custom_type: Optional[str] = None
    custom_category: Optional[str] = None

    # NOTE: the custom_type line must precede the custom_app one — once the
    # class attribute `_validate_custom_app` is assigned, the bare name inside
    # this class body refers to the wrapped proxy, not the module function.
    _validate_custom_type = field_validator("custom_type")(_validate_custom_app)
    _validate_custom_category = field_validator("custom_category")(_validate_custom_app)
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
        # Invariant: a custom type name only ever rides on a BASE enum type of
        # BONUS (income) or EXPENSE — never ORDER/CANCELLATION, which carry
        # their own analytics semantics (order counts, cancellation lists).
        if self.custom_type and self.type not in (EntryType.BONUS, EntryType.EXPENSE):
            self.custom_type = None
        # Invariant: a custom expense-category name rides only on EXPENSE
        # entries with category=OTHER (mirrors the custom_app design).
        if self.custom_category:
            if self.type != EntryType.EXPENSE:
                self.custom_category = None
            else:
                self.category = ExpenseCategory.OTHER
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
    custom_type: Optional[str] = None
    custom_category: Optional[str] = None

    # custom_type first — see ordering note on EntryCreate.
    _validate_custom_type = field_validator("custom_type")(_validate_custom_app)
    _validate_custom_category = field_validator("custom_category")(_validate_custom_app)
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
        # Custom type rides only on BONUS/EXPENSE base types (see EntryCreate).
        # On partial updates the route re-checks against the row's final type.
        if self.custom_type and self.type is not None and self.type not in (EntryType.BONUS, EntryType.EXPENSE):
            self.custom_type = None
        # Custom expense-category rides only on EXPENSE + category=OTHER. On
        # partial updates the route re-checks against the row's final state.
        if self.custom_category:
            if self.type is not None and self.type != EntryType.EXPENSE:
                self.custom_category = None
            else:
                self.category = ExpenseCategory.OTHER
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
    custom_type: Optional[str] = None
    custom_category: Optional[str] = None
    
    class Config:
        from_attributes = True

def _validate_platform_color(v):
    if v is None:
        return None
    v = str(v).strip()
    if v == "":
        return None
    import re
    if not re.fullmatch(r"#[0-9a-fA-F]{6}", v):
        raise ValueError("color must be a hex value like #8b5cf6")
    return v.lower()


def _validate_platform_icon(v):
    if v is None:
        return None
    v = str(v).strip()
    if v == "":
        return None
    # Emoji can span several code points (ZWJ sequences); 16 is generous while
    # still preventing arbitrary text from being stored.
    if len(v) > 16:
        raise ValueError("icon is too long")
    return v


class PlatformCreate(BaseModel):
    name: str
    # Optional identity: hex color for charts/dots, short emoji icon for the
    # selector pill. Omitted/empty → NULL ("auto" styling on the client).
    color: Optional[str] = None
    icon: Optional[str] = None

    _validate_name = field_validator("name")(_validate_custom_app)
    _validate_color = field_validator("color")(_validate_platform_color)
    _validate_icon = field_validator("icon")(_validate_platform_icon)


class PlatformResponse(BaseModel):
    id: int
    name: str
    color: Optional[str] = None
    icon: Optional[str] = None

    class Config:
        from_attributes = True


class EntryTypeCreate(BaseModel):
    name: str
    # 'income' customs ride on base type BONUS, 'expense' customs on EXPENSE.
    # Fixed at creation (updates ignore it) — flipping would silently change
    # the meaning of historical entries.
    kind: str = "income"
    color: Optional[str] = None
    icon: Optional[str] = None

    _validate_name = field_validator("name")(_validate_custom_app)
    _validate_color = field_validator("color")(_validate_platform_color)
    _validate_icon = field_validator("icon")(_validate_platform_icon)

    @field_validator("kind")
    @classmethod
    def _validate_kind(cls, v):
        v = (v or "income").strip().lower()
        if v not in ("income", "expense"):
            raise ValueError("kind must be 'income' or 'expense'")
        return v


class EntryTypeResponse(BaseModel):
    id: int
    name: str
    kind: str
    color: Optional[str] = None
    icon: Optional[str] = None

    class Config:
        from_attributes = True


class ExpenseCategoryCreate(BaseModel):
    name: str
    color: Optional[str] = None
    icon: Optional[str] = None

    _validate_name = field_validator("name")(_validate_custom_app)
    _validate_color = field_validator("color")(_validate_platform_color)
    _validate_icon = field_validator("icon")(_validate_platform_icon)


class ExpenseCategoryResponse(BaseModel):
    id: int
    name: str
    color: Optional[str] = None
    icon: Optional[str] = None

    class Config:
        from_attributes = True


class HiddenBuiltinsSet(BaseModel):
    # Full replacement list of hidden built-in expense-category keys.
    keys: list[str]


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
