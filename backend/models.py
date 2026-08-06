from sqlalchemy import Column, Integer, String, Float, Numeric, DateTime, Date, Text, Enum as SQLEnum, Boolean, ForeignKey, Index, text
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
    CHARITY = "CHARITY"
    OTHER = "OTHER"

class AuthUser(Base):
    __tablename__ = "auth_users"
    
    id = Column(String, primary_key=True)
    email = Column(String, nullable=True, unique=True, index=True)
    password_hash = Column(String, nullable=True)
    first_name = Column(String, nullable=True)
    last_name = Column(String, nullable=True)
    profile_image_url = Column(String, nullable=True)
    is_demo = Column(Boolean, default=False, nullable=False)
    # Short, shareable code other drivers enter to credit this user with a
    # referral. Generated lazily on first GET /referrals/me. Nullable for
    # legacy rows; unique so a code maps to exactly one referrer.
    referral_code = Column(String, nullable=True, unique=True, index=True)
    # Opt-in email two-factor auth. When mfa_enabled is true, /auth/login emails a
    # 6-digit code (hashed here with an ISO-string expiry + attempt counter) and
    # withholds the access token until /auth/mfa/verify exchanges the code for it.
    # Security-event stamp (ISO8601 UTC). Set whenever the password is reset or
    # the login email changes; get_current_user rejects any JWT whose iat is
    # older, so a stolen token dies the moment the victim resets their password.
    password_changed_at = Column(String, nullable=True)
    mfa_enabled = Column(Boolean, default=False, nullable=False)
    mfa_code_hash = Column(String, nullable=True)
    mfa_code_expires_at = Column(String, nullable=True)  # ISO8601 UTC
    mfa_code_attempts = Column(Integer, default=0, nullable=False)
    # Email confirmation (NON-blocking). New email/password signups start
    # unverified and see a gentle in-app nudge; Apple/demo/existing rows are
    # grandfathered to verified. The 6-digit code is hashed here with an ISO
    # expiry + attempt counter, mirroring the MFA columns above.
    email_verified = Column(Boolean, default=False, nullable=False)
    # Conversion onboarding funnel: new signups walk through it once, then this
    # flips true (synced server-side so a reinstall never re-onboards an
    # existing account). Existing rows are grandfathered true by the boot
    # migration; demo accounts are created with it true.
    onboarding_completed = Column(Boolean, default=False, nullable=False)
    # Dashboard tutorial walkthrough: device-local AsyncStorage alone loses the
    # flag on reinstall, so completion is also synced server-side. Existing rows
    # are grandfathered true by the boot migration; demo accounts intentionally
    # ignore it (tour shows every demo session).
    walkthrough_completed = Column(Boolean, default=False, nullable=False)
    email_verification_code_hash = Column(String, nullable=True)
    email_verification_expires_at = Column(String, nullable=True)  # ISO8601 UTC
    email_verification_attempts = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

class Entry(Base):
    __tablename__ = "entries"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("auth_users.id"), nullable=False, index=True)
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
    is_business_expense = Column(Boolean, default=False, nullable=True)
    during_business_hours = Column(Boolean, default=False, nullable=True)
    # Client-generated key for idempotent creates. NULL for legacy rows and any
    # create that omits it. The partial unique index below makes a replayed
    # offline add (same key) collide instead of inserting a duplicate, while
    # still allowing unlimited NULL-key rows.
    idempotency_key = Column(String, nullable=True)
    # Custom platform name for entries logged against a user-created platform.
    # The enum `app` stays OTHER for these rows so existing rollups/analytics
    # keep working; this column carries the display identity.
    custom_app = Column(String, nullable=True)
    # Custom entry-type name for entries logged against a user-created type.
    # The enum `type` stays a safe BASE type (BONUS for income customs,
    # EXPENSE for expense customs) so sign rules, rollups, and older clients
    # keep working; this column carries the display identity.
    custom_type = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    __table_args__ = (
        Index(
            "uq_entries_user_idempotency",
            "user_id",
            "idempotency_key",
            unique=True,
            sqlite_where=text("idempotency_key IS NOT NULL"),
            postgresql_where=text("idempotency_key IS NOT NULL"),
        ),
    )

class UserPlatform(Base):
    """A user-created delivery platform (beyond the built-in AppType enum).

    Entries logged against one of these carry app=OTHER + custom_app=<name>.
    `name` stores the user's original casing; case-insensitive uniqueness per
    user is enforced both in the route AND by a functional unique index on
    (user_id, lower(name)) created in `_migrate_user_platforms_ci_unique()`,
    so concurrent case-variant creates cannot both commit.
    """
    __tablename__ = "user_platforms"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("auth_users.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    # Optional user-chosen identity: a hex color ('#rrggbb') used for chart/
    # calendar/pill dots, and a short emoji icon shown on the selector pill.
    # NULL means "auto" — the client derives a stable color from the name.
    color = Column(String, nullable=True)
    icon = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        Index("uq_user_platforms_user_name", "user_id", "name", unique=True),
    )

class UserEntryType(Base):
    """A user-created earnings type (beyond the built-in EntryType enum).

    Entries logged against one of these carry a BASE enum type (BONUS for
    kind='income', EXPENSE for kind='expense') + custom_type=<name>, so all
    sign rules, rollups, and legacy clients keep working. `kind` is fixed at
    creation — flipping it would silently change the meaning of history.
    Same CI-uniqueness scheme as UserPlatform (functional index added in
    `_migrate_user_entry_types_ci_unique()`).
    """
    __tablename__ = "user_entry_types"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("auth_users.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    kind = Column(String, nullable=False, default="income")  # 'income' | 'expense'
    color = Column(String, nullable=True)
    icon = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        Index("uq_user_entry_types_user_name", "user_id", "name", unique=True),
    )

class UserLabelOverride(Base):
    """Per-user cosmetic rename of a BUILT-IN pill label in the entry form.

    kind='platform' → keys are AppType enum values (DOORDASH, UBEREATS, ...).
    kind='type'     → keys are entry types (ORDER, BONUS, EXPENSE, CANCELLATION).
    Only the displayed label changes; the underlying key stored on entries is
    untouched, so analytics/CSV/history stay stable. Deleting the row resets
    the label back to the default.
    """
    __tablename__ = "user_label_overrides"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("auth_users.id"), nullable=False, index=True)
    kind = Column(String, nullable=False)
    key = Column(String, nullable=False)
    label = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        Index("uq_user_label_overrides_user_kind_key", "user_id", "kind", "key", unique=True),
    )

class Settings(Base):
    __tablename__ = "settings"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("auth_users.id"), nullable=False, unique=True, index=True)
    cost_per_mile = Column(Numeric(10, 2), default=Decimal("0"), nullable=False)

class TimeframeType(str, enum.Enum):
    TODAY = "TODAY"
    YESTERDAY = "YESTERDAY"
    THIS_WEEK = "THIS_WEEK"
    LAST_7_DAYS = "LAST_7_DAYS"
    THIS_MONTH = "THIS_MONTH"
    LAST_MONTH = "LAST_MONTH"
    SAVINGS_GOAL = "SAVINGS_GOAL"

class Goal(Base):
    __tablename__ = "goals"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("auth_users.id"), nullable=False, index=True)
    timeframe = Column(SQLEnum(TimeframeType), nullable=False)
    target_profit = Column(Numeric(10, 2), nullable=False)
    goal_name = Column(String, default="Savings Goal", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    __table_args__ = (
        __import__('sqlalchemy').UniqueConstraint('user_id', 'timeframe', name='uq_user_timeframe'),
    )

class DailyGoal(Base):
    """Per-calendar-date daily profit goal (EST dates, YYYY-MM-DD semantics).

    Each date's goal is an independent row, so editing one day can never
    change another day's goal. The legacy `goals` row with timeframe=TODAY is
    retained as the *inherited default*: dates with no explicit DailyGoal row
    fall back to it (lossless migration — no backfill required, existing
    behavior is preserved until a user edits a specific date).
    """
    __tablename__ = "daily_goals"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("auth_users.id"), nullable=False, index=True)
    goal_date = Column(Date, nullable=False)
    target_profit = Column(Numeric(10, 2), nullable=False)
    goal_name = Column(String, default="Daily Goal", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    __table_args__ = (
        __import__('sqlalchemy').UniqueConstraint('user_id', 'goal_date', name='uq_user_goal_date'),
    )

class WaitlistSignup(Base):
    __tablename__ = "waitlist_signups"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, nullable=False, unique=True, index=True)
    name = Column(String, nullable=True)
    referral_source = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

class PlatformIntegration(str, enum.Enum):
    UBER = "UBER"
    SHIPT = "SHIPT"

class ApiCredential(Base):
    __tablename__ = "api_credentials"

    id = Column(Integer, primary_key=True, index=True)
    # `user_id` scopes every credential to one AuthUser. Nullable for backward
    # compatibility with rows created before the multi-user migration; new
    # rows MUST always be created with `user_id` set (enforced in the OAuth
    # callback). Composite uniqueness is enforced by __table_args__ below so
    # one user can connect each platform exactly once.
    user_id = Column(String, ForeignKey("auth_users.id"), nullable=True, index=True)
    platform = Column(SQLEnum(PlatformIntegration), nullable=False)
    access_token = Column(String, nullable=False)
    refresh_token = Column(String, nullable=True)
    token_expires_at = Column(DateTime, nullable=True)
    is_active = Column(Integer, default=1, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    __table_args__ = (
        __import__('sqlalchemy').UniqueConstraint('user_id', 'platform', name='uq_user_platform'),
    )

class SyncedOrder(Base):
    __tablename__ = "synced_orders"

    id = Column(Integer, primary_key=True, index=True)
    # Without `user_id`, dedupe on (platform, platform_order_id) would let one
    # user's synced order suppress another user's import when their upstream
    # accounts share an order id (e.g. both connect the same demo Uber
    # sandbox). Nullable for legacy rows from the single-tenant era.
    user_id = Column(String, ForeignKey("auth_users.id"), nullable=True, index=True)
    platform = Column(SQLEnum(PlatformIntegration), nullable=False)
    platform_order_id = Column(String, nullable=False, index=True)
    entry_id = Column(Integer, nullable=True)
    sync_status = Column(String, default="pending", nullable=False)
    synced_at = Column(DateTime, nullable=True)
    raw_data = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    auth_user_id = Column(String, ForeignKey("auth_users.id"), nullable=True, index=True, unique=True)
    total_points = Column(Integer, default=0, nullable=False)
    daily_streak = Column(Integer, default=0, nullable=False)
    last_used_date = Column(String, nullable=True)
    signup_date = Column(DateTime, default=datetime.utcnow, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

class DailyUsage(Base):
    __tablename__ = "daily_usage"
    __table_args__ = (
        Index("uq_daily_usage_user_date", "auth_user_id", "usage_date", unique=True),
    )
    
    id = Column(Integer, primary_key=True, index=True)
    auth_user_id = Column(String, ForeignKey("auth_users.id"), nullable=True, index=True)
    usage_date = Column(String, nullable=False, index=True)
    points_earned = Column(Integer, default=10, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

class Friend(Base):
    __tablename__ = "friends"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("auth_users.id"), nullable=False, index=True)
    friend_id = Column(String, ForeignKey("auth_users.id"), nullable=False, index=True)
    status = Column(String, default="pending", nullable=False)  # pending, accepted, blocked
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

class Achievement(Base):
    __tablename__ = "achievements"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("auth_users.id"), nullable=False, index=True)
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    icon = Column(String, nullable=True)
    unlocked_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

class Congratulation(Base):
    __tablename__ = "congratulations"
    
    id = Column(Integer, primary_key=True, index=True)
    from_user_id = Column(String, ForeignKey("auth_users.id"), nullable=False, index=True)
    to_user_id = Column(String, ForeignKey("auth_users.id"), nullable=False, index=True)
    message = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

class Referral(Base):
    __tablename__ = "referrals"

    id = Column(Integer, primary_key=True, index=True)
    # The user who shared their code (gets a reward, capped).
    referrer_id = Column(String, ForeignKey("auth_users.id"), nullable=False, index=True)
    # The new user who redeemed a code. UNIQUE so a user can only ever be
    # referred once (prevents a user farming multiple rewards through one signup).
    referee_id = Column(String, ForeignKey("auth_users.id"), nullable=False, unique=True, index=True)
    # Whether the free-month promo entitlement was successfully granted in
    # RevenueCat for each side. Lets a future retry re-grant without
    # double-counting the cap.
    referrer_reward_granted = Column(Boolean, default=False, nullable=False)
    referee_reward_granted = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

class ProblemReport(Base):
    """A user-submitted bug report / feature request from the in-app
    "Report a Problem" flow. Screenshots are stored inline (compressed
    client-side, hard-capped server-side) so no object storage is needed."""
    __tablename__ = "problem_reports"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("auth_users.id"), nullable=False, index=True)
    report_type = Column(String, nullable=False)
    title = Column(String, nullable=True)   # optional short issue title
    description = Column(Text, nullable=False)
    steps = Column(Text, nullable=True)
    contact_email = Column(String, nullable=False)
    diagnostics = Column(Text, nullable=True)   # JSON blob (device info), user-consented
    screenshots = Column(Text, nullable=True)   # JSON array of data-URLs
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("auth_users.id"), nullable=False, index=True)
    token = Column(String, unique=True, nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False)
    used = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
