from sqlalchemy import Column, Integer, String, Float, Numeric, DateTime, Text, Enum as SQLEnum
from datetime import datetime
from decimal import Decimal
import enum
from backend.db import Base

class EntryType(str, enum.Enum):
    ORDER = "ORDER"
    BONUS = "BONUS"
    EXPENSE = "EXPENSE"
    CANCELLATION = "CANCELLATION"

class AppType(str, enum.Enum):
    DOORDASH = "DOORDASH"
    UBEREATS = "UBEREATS"
    INSTACART = "INSTACART"
    GRUBHUB = "GRUBHUB"
    SHIPT = "SHIPT"
    OTHER = "OTHER"

class ExpenseCategory(str, enum.Enum):
    GAS = "GAS"
    PARKING = "PARKING"
    TOLLS = "TOLLS"
    MAINTENANCE = "MAINTENANCE"
    PHONE = "PHONE"
    SUBSCRIPTION = "SUBSCRIPTION"
    FOOD = "FOOD"
    LEISURE = "LEISURE"
    OTHER = "OTHER"

class Entry(Base):
    __tablename__ = "entries"
    
    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    type = Column(SQLEnum(EntryType), nullable=False)
    app = Column(SQLEnum(AppType), nullable=False)
    order_id = Column(String, nullable=True)
    amount = Column(Numeric(10, 2), nullable=False)
    distance_miles = Column(Float, default=0.0)
    duration_minutes = Column(Integer, default=0)
    category = Column(SQLEnum(ExpenseCategory), nullable=True)
    note = Column(Text, nullable=True)
    receipt_url = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

class Settings(Base):
    __tablename__ = "settings"
    
    id = Column(Integer, primary_key=True, default=1)
    cost_per_mile = Column(Numeric(10, 2), default=Decimal("0"), nullable=False)

class TimeframeType(str, enum.Enum):
    TODAY = "TODAY"
    YESTERDAY = "YESTERDAY"
    THIS_WEEK = "THIS_WEEK"
    LAST_7_DAYS = "LAST_7_DAYS"
    THIS_MONTH = "THIS_MONTH"
    LAST_MONTH = "LAST_MONTH"

class Goal(Base):
    __tablename__ = "goals"
    
    id = Column(Integer, primary_key=True, index=True)
    timeframe = Column(SQLEnum(TimeframeType), unique=True, nullable=False)
    target_profit = Column(Numeric(10, 2), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

class PlatformIntegration(str, enum.Enum):
    UBER = "UBER"
    SHIPT = "SHIPT"

class ApiCredential(Base):
    __tablename__ = "api_credentials"
    
    id = Column(Integer, primary_key=True, index=True)
    platform = Column(SQLEnum(PlatformIntegration), nullable=False, unique=True)
    access_token = Column(String, nullable=False)
    refresh_token = Column(String, nullable=True)
    token_expires_at = Column(DateTime, nullable=True)
    is_active = Column(Integer, default=1, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

class SyncedOrder(Base):
    __tablename__ = "synced_orders"
    
    id = Column(Integer, primary_key=True, index=True)
    platform = Column(SQLEnum(PlatformIntegration), nullable=False)
    platform_order_id = Column(String, nullable=False, index=True)
    entry_id = Column(Integer, nullable=True)
    sync_status = Column(String, default="pending", nullable=False)
    synced_at = Column(DateTime, nullable=True)
    raw_data = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
