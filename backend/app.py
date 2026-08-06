from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from sqlalchemy import inspect, text
from backend.routers import health, settings, entries, rollup, goals, suggestions, oauth, points, auth_routes, leaderboard_routes, dashboard, waitlist_routes, referrals, platforms, entry_types, feedback
from backend.db import engine, Base
from backend.services.background_jobs import start_background_jobs, stop_background_jobs
import os
import re
import logging

# Configure logging for production
logging.basicConfig(level=logging.WARNING, force=True)
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# Rate limiter — protects /auth/* from brute-force and abuse.
# Per-IP keying via X-Forwarded-For-aware get_remote_address. In production
# behind a reverse proxy, ensure proxy passes the real client IP.
# Defaults are intentionally permissive to avoid breaking the app; the
# per-route decorators in auth_routes.py tighten the sensitive endpoints.
limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])

def _migrate_api_credentials_for_multi_user() -> None:
    """Add `user_id` column to `api_credentials` and drop the legacy
    `UNIQUE(platform)` constraint so multiple users can connect the same
    upstream platform. Safe to re-run on every boot — detects schema state and
    no-ops if already migrated. Runs BEFORE `create_all` so the table is in
    the expected shape when SQLAlchemy reflects.

    Supports Postgres (production: ALTER TABLE) and SQLite (dev: table
    rebuild, since SQLite can't drop a UNIQUE constraint in place).
    """
    insp = inspect(engine)
    is_postgres = engine.url.get_backend_name().startswith("postgres")

    # Recovery from a botched prior migration that left `api_credentials_old`
    # behind. NEVER drop `_old` unless we're sure the live `api_credentials`
    # table is the post-migration one (has `user_id`) — otherwise `_old`
    # could be the only copy of the real credentials and a blind drop is
    # data loss. If both exist and the live table is pre-migration, refuse
    # to proceed and require manual cleanup.
    if insp.has_table("api_credentials_old") and not insp.has_table("api_credentials"):
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE api_credentials_old RENAME TO api_credentials"))
        insp = inspect(engine)
    elif insp.has_table("api_credentials_old") and insp.has_table("api_credentials"):
        live_cols = {c["name"] for c in insp.get_columns("api_credentials")}
        if "user_id" in live_cols:
            # Live table is already migrated — `_old` is a stale leftover
            # whose data was copied forward. Safe to drop.
            with engine.begin() as conn:
                conn.execute(text("DROP TABLE api_credentials_old"))
            insp = inspect(engine)
        else:
            raise RuntimeError(
                "Both `api_credentials` and `api_credentials_old` exist but the "
                "live table is pre-migration. Refusing to drop `_old` blindly "
                "(it may be the only copy of real credentials). Inspect both "
                "tables and decide which is canonical, then drop the other "
                "manually before restarting."
            )

    if not insp.has_table("api_credentials"):
        return  # nothing to migrate; create_all will build the new schema

    cols = {c["name"] for c in insp.get_columns("api_credentials")}
    if "user_id" in cols:
        return  # already migrated

    if is_postgres:
        # Postgres supports add-column + drop-constraint in place. This is the
        # production path. Wrap in defensive try/excepts because the legacy
        # constraint may have been auto-named differently in different envs.
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE api_credentials ADD COLUMN user_id VARCHAR"))
            conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_api_credentials_user_id "
                "ON api_credentials (user_id)"
            ))
            # Find and drop any UNIQUE constraint on `platform` alone.
            res = conn.execute(text(
                "SELECT conname FROM pg_constraint c "
                "JOIN pg_class t ON c.conrelid = t.oid "
                "WHERE t.relname = 'api_credentials' AND c.contype = 'u'"
            ))
            for (conname,) in res.fetchall():
                try:
                    conn.execute(text(f'ALTER TABLE api_credentials DROP CONSTRAINT "{conname}"'))
                except Exception as exc:
                    logger.warning(f"Could not drop constraint {conname}: {exc}")
            # Fail-fast if we can't install the new composite uniqueness —
            # silently warn-and-continue would leave the schema half-migrated
            # AND looking complete (user_id present), so the next boot would
            # short-circuit and the bug would stay invisible until a second
            # user tried to connect the same platform.
            conn.execute(text(
                "ALTER TABLE api_credentials ADD CONSTRAINT uq_user_platform "
                "UNIQUE (user_id, platform)"
            ))
        logger.warning(
            "Migrated api_credentials to per-user schema (postgres). "
            "Legacy rows have user_id=NULL and must be reconnected via OAuth."
        )
        return

    # SQLite path: table rebuild via rename + recreate + copy.
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE api_credentials RENAME TO api_credentials_old"))
    Base.metadata.tables["api_credentials"].create(bind=engine)
    with engine.begin() as conn:
        conn.execute(text(
            "INSERT INTO api_credentials "
            "(id, platform, access_token, refresh_token, token_expires_at, "
            " is_active, created_at, updated_at) "
            "SELECT id, platform, access_token, refresh_token, token_expires_at, "
            "       is_active, created_at, updated_at "
            "FROM api_credentials_old"
        ))
        conn.execute(text("DROP TABLE api_credentials_old"))
    logger.warning("Migrated api_credentials to per-user schema (sqlite).")


def _migrate_synced_orders_for_multi_user() -> None:
    """Add `user_id` to `synced_orders` so per-user dedupe in
    `sync_service` can filter on it. Plain ADD COLUMN works on both
    Postgres and SQLite — no constraints to juggle here."""
    insp = inspect(engine)
    if not insp.has_table("synced_orders"):
        return
    cols = {c["name"] for c in insp.get_columns("synced_orders")}
    if "user_id" in cols:
        return
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE synced_orders ADD COLUMN user_id VARCHAR"))
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_synced_orders_user_id "
            "ON synced_orders (user_id)"
        ))
    logger.warning("Migrated synced_orders to per-user schema. Legacy rows have user_id=NULL.")


def _migrate_entries_add_idempotency_key() -> None:
    """Add nullable `idempotency_key` to `entries` so `create_entry` can
    de-duplicate replayed offline adds — a create carrying a key already saved
    returns the original row instead of inserting a duplicate. Plain ADD COLUMN
    works on both Postgres and SQLite; the partial UNIQUE index guards against
    replay races while still permitting unlimited NULL-key rows (legacy rows and
    online creates that omit the key). Safe to re-run; no-ops once migrated."""
    insp = inspect(engine)
    if not insp.has_table("entries"):
        return
    cols = {c["name"] for c in insp.get_columns("entries")}
    if "idempotency_key" in cols:
        return
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE entries ADD COLUMN idempotency_key VARCHAR"))
        # Partial unique index (supported by both Postgres and SQLite >= 3.8):
        # uniqueness only applies to non-NULL keys, so many NULL-key rows coexist.
        conn.execute(text(
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_entries_user_idempotency "
            "ON entries (user_id, idempotency_key) "
            "WHERE idempotency_key IS NOT NULL"
        ))
    logger.warning("Added entries.idempotency_key for create de-duplication.")


def _migrate_entries_add_custom_app() -> None:
    """Add nullable `custom_app` to `entries` for user-created platforms.
    Entries logged against a custom platform keep app=OTHER (the enum column is
    untouched) and carry the display name here. Plain ADD COLUMN works on both
    Postgres and SQLite; safe to re-run — no-ops once the column exists."""
    insp = inspect(engine)
    if not insp.has_table("entries"):
        return
    cols = {c["name"] for c in insp.get_columns("entries")}
    if "custom_app" in cols:
        return
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE entries ADD COLUMN custom_app VARCHAR"))
    logger.warning("Added entries.custom_app for user-created platforms.")


def _migrate_entries_add_custom_type() -> None:
    """Add nullable `custom_type` to `entries` for user-created earnings types.
    Entries logged against a custom type keep a BASE enum type (BONUS/EXPENSE)
    and carry the display name here. Safe to re-run."""
    insp = inspect(engine)
    if not insp.has_table("entries"):
        return
    cols = {c["name"] for c in insp.get_columns("entries")}
    if "custom_type" in cols:
        return
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE entries ADD COLUMN custom_type VARCHAR"))
    logger.warning("Added entries.custom_type for user-created earnings types.")


def _migrate_user_entry_types_ci_unique() -> None:
    """Case-insensitive per-user uniqueness for custom entry types, same scheme
    as user_platforms (functional unique index). Safe to re-run."""
    insp = inspect(engine)
    if not insp.has_table("user_entry_types"):
        return
    with engine.begin() as conn:
        conn.execute(text(
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_user_entry_types_user_lname "
            "ON user_entry_types (user_id, lower(name))"
        ))


def _migrate_user_platforms_ci_unique() -> None:
    """Enforce case-insensitive per-user uniqueness for custom platforms at the
    DB level: a functional unique index on (user_id, lower(name)). Without it,
    two concurrent creates like 'Roadie' and 'roadie' could both commit past
    the route's pre-insert check. Works on both Postgres and SQLite (both
    support expression indexes with IF NOT EXISTS); safe to re-run."""
    insp = inspect(engine)
    if not insp.has_table("user_platforms"):
        return
    with engine.begin() as conn:
        conn.execute(text(
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_user_platforms_user_lname "
            "ON user_platforms (user_id, lower(name))"
        ))


def _migrate_user_platforms_add_color_icon() -> None:
    """Add nullable `color` (hex '#rrggbb') and `icon` (short emoji) columns to
    `user_platforms` so users can pick an identifying color/icon for a custom
    earnings type. NULL means "auto" (client derives a stable color from the
    name). Plain ADD COLUMN works on both Postgres and SQLite; safe to
    re-run — no-ops once the columns exist."""
    insp = inspect(engine)
    if not insp.has_table("user_platforms"):
        return
    cols = {c["name"] for c in insp.get_columns("user_platforms")}
    with engine.begin() as conn:
        if "color" not in cols:
            conn.execute(text("ALTER TABLE user_platforms ADD COLUMN color VARCHAR"))
        if "icon" not in cols:
            conn.execute(text("ALTER TABLE user_platforms ADD COLUMN icon VARCHAR"))
    if "color" not in cols or "icon" not in cols:
        logger.warning("Added user_platforms.color/icon for custom platform styling.")


def _migrate_points_for_multi_user() -> None:
    """Scope the gamification tables to authenticated users.

    `users` (points singleton): add nullable `auth_user_id` column + unique
    index so each AuthUser gets their own points row instead of sharing id=1.

    `daily_usage` (check-in log): add nullable `auth_user_id` column and
    replace the global UNIQUE(usage_date) constraint with a per-user composite
    UNIQUE(auth_user_id, usage_date) so two users can check in on the same day.

    Safe to re-run on every boot — short-circuits once both columns exist.
    Supports Postgres (production) and SQLite (dev).
    """
    insp = inspect(engine)
    is_postgres = engine.url.get_backend_name().startswith("postgres")

    # --- users table ---
    if insp.has_table("users"):
        users_cols = {c["name"] for c in insp.get_columns("users")}
        if "auth_user_id" not in users_cols:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE users ADD COLUMN auth_user_id VARCHAR"))
                conn.execute(text(
                    "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_auth_user_id "
                    "ON users (auth_user_id) WHERE auth_user_id IS NOT NULL"
                ))
            logger.warning("Migrated users table: added auth_user_id for per-user points.")

    # --- daily_usage table ---
    if insp.has_table("daily_usage"):
        du_cols = {c["name"] for c in insp.get_columns("daily_usage")}
        if "auth_user_id" not in du_cols:
            if is_postgres:
                with engine.begin() as conn:
                    conn.execute(text("ALTER TABLE daily_usage ADD COLUMN auth_user_id VARCHAR"))
                    conn.execute(text(
                        "CREATE INDEX IF NOT EXISTS ix_daily_usage_auth_user_id "
                        "ON daily_usage (auth_user_id)"
                    ))
                    # Drop the old global UNIQUE constraint on usage_date alone.
                    res = conn.execute(text(
                        "SELECT conname FROM pg_constraint c "
                        "JOIN pg_class t ON c.conrelid = t.oid "
                        "WHERE t.relname = 'daily_usage' AND c.contype IN ('u')"
                    ))
                    for (conname,) in res.fetchall():
                        try:
                            conn.execute(text(
                                f'ALTER TABLE daily_usage DROP CONSTRAINT "{conname}"'
                            ))
                        except Exception as exc:
                            logger.warning(f"Could not drop daily_usage constraint {conname}: {exc}")
                    conn.execute(text(
                        "CREATE UNIQUE INDEX IF NOT EXISTS uq_daily_usage_user_date "
                        "ON daily_usage (auth_user_id, usage_date) "
                        "WHERE auth_user_id IS NOT NULL"
                    ))
            else:
                # SQLite: table rebuild to drop the old UNIQUE index on usage_date.
                with engine.begin() as conn:
                    conn.execute(text("ALTER TABLE daily_usage RENAME TO daily_usage_old"))
                Base.metadata.tables["daily_usage"].create(bind=engine)
                with engine.begin() as conn:
                    conn.execute(text(
                        "INSERT INTO daily_usage "
                        "(id, auth_user_id, usage_date, points_earned, created_at) "
                        "SELECT id, NULL, usage_date, points_earned, created_at "
                        "FROM daily_usage_old"
                    ))
                    conn.execute(text("DROP TABLE daily_usage_old"))
            logger.warning("Migrated daily_usage table: added auth_user_id for per-user check-ins.")


def _migrate_auth_users_add_referral_code() -> None:
    """Add nullable `referral_code` to `auth_users` for the referral program.
    Plain ADD COLUMN works on both Postgres and SQLite; the unique index is
    created separately and tolerates NULLs (many legacy rows have no code yet).
    Safe to re-run; no-ops once the column exists."""
    insp = inspect(engine)
    if not insp.has_table("auth_users"):
        return
    cols = {c["name"] for c in insp.get_columns("auth_users")}
    if "referral_code" in cols:
        return
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE auth_users ADD COLUMN referral_code VARCHAR"))
        conn.execute(text(
            "CREATE UNIQUE INDEX IF NOT EXISTS ix_auth_users_referral_code "
            "ON auth_users (referral_code) WHERE referral_code IS NOT NULL"
        ))
    logger.warning("Added auth_users.referral_code for the referral program.")


def _migrate_auth_users_add_mfa() -> None:
    """Add opt-in email-2FA columns to `auth_users`. All additive ADD COLUMNs
    (safe on both Postgres and SQLite); booleans/integers get a server default
    so existing rows backfill to "MFA off, 0 attempts". Safe to re-run."""
    insp = inspect(engine)
    if not insp.has_table("auth_users"):
        return
    cols = {c["name"] for c in insp.get_columns("auth_users")}
    is_pg = engine.dialect.name == "postgresql"
    false_default = "FALSE" if is_pg else "0"
    with engine.begin() as conn:
        if "mfa_enabled" not in cols:
            conn.execute(text(
                f"ALTER TABLE auth_users ADD COLUMN mfa_enabled BOOLEAN NOT NULL DEFAULT {false_default}"
            ))
        if "mfa_code_hash" not in cols:
            conn.execute(text("ALTER TABLE auth_users ADD COLUMN mfa_code_hash VARCHAR"))
        if "mfa_code_expires_at" not in cols:
            conn.execute(text("ALTER TABLE auth_users ADD COLUMN mfa_code_expires_at VARCHAR"))
        if "mfa_code_attempts" not in cols:
            conn.execute(text(
                "ALTER TABLE auth_users ADD COLUMN mfa_code_attempts INTEGER NOT NULL DEFAULT 0"
            ))
    logger.warning("Ensured auth_users MFA columns exist (email two-factor auth).")


def _migrate_auth_users_add_email_verification() -> None:
    """Add email-confirmation columns to `auth_users`. All additive ADD COLUMNs
    (safe on Postgres + SQLite). CRITICAL: the one-time backfill that marks
    existing rows verified runs ONLY when the column is first created — re-running
    it on every boot would silently re-verify legitimately-unverified new signups.
    Safe to re-run."""
    insp = inspect(engine)
    if not insp.has_table("auth_users"):
        return
    cols = {c["name"] for c in insp.get_columns("auth_users")}
    is_pg = engine.dialect.name == "postgresql"
    false_default = "FALSE" if is_pg else "0"
    true_value = "TRUE" if is_pg else "1"
    with engine.begin() as conn:
        if "email_verified" not in cols:
            conn.execute(text(
                f"ALTER TABLE auth_users ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT {false_default}"
            ))
            # Grandfather every pre-existing account (incl. demo) as verified so
            # the nudge only ever targets accounts created after this feature.
            conn.execute(text(f"UPDATE auth_users SET email_verified = {true_value}"))
        if "email_verification_code_hash" not in cols:
            conn.execute(text("ALTER TABLE auth_users ADD COLUMN email_verification_code_hash VARCHAR"))
        if "email_verification_expires_at" not in cols:
            conn.execute(text("ALTER TABLE auth_users ADD COLUMN email_verification_expires_at VARCHAR"))
        if "email_verification_attempts" not in cols:
            conn.execute(text(
                "ALTER TABLE auth_users ADD COLUMN email_verification_attempts INTEGER NOT NULL DEFAULT 0"
            ))
    logger.warning("Ensured auth_users email-verification columns exist.")


def _migrate_auth_users_add_onboarding() -> None:
    """Add `onboarding_completed` to `auth_users` for the conversion onboarding
    funnel. CRITICAL: the one-time backfill that grandfathers existing rows as
    completed runs ONLY when the column is first created — re-running it on
    every boot would silently skip onboarding for legitimately-new signups.
    Safe to re-run."""
    insp = inspect(engine)
    if not insp.has_table("auth_users"):
        return
    cols = {c["name"] for c in insp.get_columns("auth_users")}
    if "onboarding_completed" in cols:
        return
    is_pg = engine.dialect.name == "postgresql"
    false_default = "FALSE" if is_pg else "0"
    true_value = "TRUE" if is_pg else "1"
    with engine.begin() as conn:
        conn.execute(text(
            f"ALTER TABLE auth_users ADD COLUMN onboarding_completed BOOLEAN NOT NULL DEFAULT {false_default}"
        ))
        # Grandfather every pre-existing account (incl. demo) so ONLY accounts
        # created after this feature ever see the onboarding flow.
        conn.execute(text(f"UPDATE auth_users SET onboarding_completed = {true_value}"))
    logger.warning("Added auth_users.onboarding_completed (grandfathered existing rows).")


def _migrate_auth_users_add_walkthrough() -> None:
    """Add `walkthrough_completed` to `auth_users` so the dashboard tutorial's
    completion survives reinstalls (device AsyncStorage alone gets wiped).
    CRITICAL: the grandfather backfill runs ONLY when the column is first
    created — re-running it on every boot would mark new signups as done.
    Safe to re-run."""
    insp = inspect(engine)
    if not insp.has_table("auth_users"):
        return
    cols = {c["name"] for c in insp.get_columns("auth_users")}
    if "walkthrough_completed" in cols:
        return
    is_pg = engine.dialect.name == "postgresql"
    false_default = "FALSE" if is_pg else "0"
    true_value = "TRUE" if is_pg else "1"
    with engine.begin() as conn:
        conn.execute(text(
            f"ALTER TABLE auth_users ADD COLUMN walkthrough_completed BOOLEAN NOT NULL DEFAULT {false_default}"
        ))
        # Grandfather every pre-existing account so only accounts created after
        # this feature can ever be auto-shown the tour by the server flag.
        conn.execute(text(f"UPDATE auth_users SET walkthrough_completed = {true_value}"))
    logger.warning("Added auth_users.walkthrough_completed (grandfathered existing rows).")


_migrate_api_credentials_for_multi_user()
_migrate_synced_orders_for_multi_user()
_migrate_entries_add_idempotency_key()
_migrate_entries_add_custom_app()
_migrate_user_platforms_ci_unique()
_migrate_user_platforms_add_color_icon()
_migrate_entries_add_custom_type()
_migrate_user_entry_types_ci_unique()
_migrate_points_for_multi_user()
_migrate_auth_users_add_referral_code()
_migrate_auth_users_add_mfa()
_migrate_auth_users_add_email_verification()
_migrate_auth_users_add_onboarding()
_migrate_auth_users_add_walkthrough()


def _migrate_auth_users_add_password_changed_at() -> None:
    """Security-event stamp used to revoke pre-existing JWTs on password reset /
    email change. Nullable — existing rows keep NULL (no revocation) until their
    first security event. Plain ADD COLUMN works on both Postgres and SQLite.
    Safe to re-run."""
    insp = inspect(engine)
    if not insp.has_table("auth_users"):
        return
    cols = {c["name"] for c in insp.get_columns("auth_users")}
    if "password_changed_at" in cols:
        return
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE auth_users ADD COLUMN password_changed_at VARCHAR"))
    logger.warning("Added auth_users.password_changed_at.")


_migrate_auth_users_add_password_changed_at()


def _migrate_problem_reports_add_title() -> None:
    """Optional short issue title for bug reports (used in the notification
    email subject). Nullable — legacy reports keep NULL. Plain ADD COLUMN
    works on both Postgres and SQLite. Safe to re-run."""
    insp = inspect(engine)
    if not insp.has_table("problem_reports"):
        return
    cols = {c["name"] for c in insp.get_columns("problem_reports")}
    if "title" in cols:
        return
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE problem_reports ADD COLUMN title VARCHAR"))
    logger.warning("Added problem_reports.title.")


_migrate_problem_reports_add_title()

Base.metadata.create_all(bind=engine)

# The CI-unique functional index for user_entry_types must be (re)applied AFTER
# create_all — on the boot that first introduces the table, the guarded call in
# the migration list above no-ops because the table doesn't exist yet.
_migrate_user_entry_types_ci_unique()

app = FastAPI(title="Delivery Driver Earnings API", docs_url=None, redoc_url=None)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# Start background jobs on startup
@app.on_event("startup")
async def startup_event():
    try:
        start_background_jobs()
        logger.info("Background jobs started successfully")
    except Exception as e:
        logger.error(f"Failed to start background jobs: {e}")

@app.on_event("shutdown")
async def shutdown_event():
    try:
        stop_background_jobs()
        logger.info("Background jobs stopped successfully")
    except Exception as e:
        logger.error(f"Error during shutdown: {e}")

# CORS — explicit allow-list. `CORS_ALLOWED_ORIGINS` is a comma-separated env
# var of full origins (scheme + host + optional port). The defaults below
# cover local dev (Vite frontend on 5000, landing site on 5173) and the
# Replit preview/dev domain if set. The native iOS app does NOT send an
# Origin header so CORS doesn't apply to it. Setting `*` was permissive
# enough that any malicious site could ride a logged-in user's cookies/JWT
# to our API — now locked down.
_default_origins = [
    "http://localhost:5000", "http://localhost:5173",
    "http://127.0.0.1:5000", "http://127.0.0.1:5173",
]
_replit_dev = os.getenv("REPLIT_DEV_DOMAIN")
if _replit_dev:
    _default_origins.append(f"https://{_replit_dev}")
_extra = os.getenv("CORS_ALLOWED_ORIGINS", "")
_cors_origins = _default_origins + [o.strip() for o in _extra.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    # Also accept any *.replit.app and *.replit.dev origin via regex so
    # deployment and preview URLs work without per-deploy env-var churn.
    allow_origin_regex=r"^https://([a-z0-9\-]+\.)*replit\.(app|dev)$",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Requested-With"],
)


# Cache-control + security headers. Cache headers prevent stale data on
# /api/*. Security headers harden every response (HSTS for HTTPS pinning,
# nosniff to prevent MIME-confusion XSS, frame-deny to prevent clickjacking
# of any HTML we serve like OAuth callbacks / privacy / support, referrer
# policy to avoid leaking internal paths to third parties).
@app.middleware("http")
async def add_security_and_cache_headers(request, call_next):
    response = await call_next(request)
    path = request.url.path
    if path.startswith("/api"):
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    # SAMEORIGIN (not DENY) so that the FastAPI-served HTML pages
    # (/privacy, /support, OAuth callback) can be iframed by other pages
    # under the same origin (e.g. an in-app legal modal). External
    # iframing is still blocked, which is the actual clickjacking threat.
    response.headers.setdefault("X-Frame-Options", "SAMEORIGIN")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    # Only emit HSTS over HTTPS (or via proxy). Browsers ignore it on http://
    # but emitting it on dev http traffic is noisy.
    if request.url.scheme == "https" or request.headers.get("x-forwarded-proto") == "https":
        response.headers.setdefault(
            "Strict-Transport-Security",
            "max-age=31536000; includeSubDomains",
        )
    return response

app.include_router(health.router, prefix="/api", tags=["health"])
app.include_router(auth_routes.router, prefix="/api", tags=["auth"])
app.include_router(settings.router, prefix="/api", tags=["settings"])
app.include_router(dashboard.router, prefix="/api", tags=["dashboard"])
app.include_router(entries.router, prefix="/api", tags=["entries"])
app.include_router(platforms.router, prefix="/api", tags=["platforms"])
app.include_router(entry_types.router, prefix="/api", tags=["entry-types"])
app.include_router(rollup.router, prefix="/api", tags=["rollup"])
app.include_router(goals.router, prefix="/api", tags=["goals"])
app.include_router(suggestions.router, prefix="/api", tags=["suggestions"])
app.include_router(oauth.router, prefix="/api", tags=["oauth"])
app.include_router(points.router, prefix="/api", tags=["points"])
app.include_router(leaderboard_routes.router, prefix="/api", tags=["leaderboard"])
app.include_router(referrals.router, prefix="/api", tags=["referrals"])
app.include_router(waitlist_routes.router, tags=["waitlist"])
app.include_router(feedback.router, prefix="/api", tags=["feedback"])

# Serve frontend static files (must be after all API routes)
# Check multiple possible dist locations
_possible_dist = [
    # Marketing/landing site is what the public domain serves now (the old
    # React webapp under frontend/ is no longer deployed to this domain).
    os.path.join(os.path.dirname(__file__), "..", "landing", "dist"),
    "/app/landing/dist",
    os.path.join(os.path.dirname(__file__), "..", "frontend", "dist"),
    os.path.join(os.path.dirname(__file__), "..", "dist"),
    "/app/dist",
]
dist_path = None
for _p in _possible_dist:
    _abs = os.path.abspath(_p)
    if os.path.exists(_abs) and os.path.isfile(os.path.join(_abs, "index.html")):
        dist_path = _abs
        break

# ── Legal pages (Privacy Policy + Support) ───────────────────────────────────
# These are required by Apple App Store Connect (privacy URL + support URL).
# Served straight from the backend so the URLs are stable across frontend
# rebuilds. Must be registered BEFORE the StaticFiles catch-all mount below.
_LEGAL_DIR = os.path.join(os.path.dirname(__file__), "legal")

@app.get("/privacy", include_in_schema=False)
@app.get("/privacy.html", include_in_schema=False)
async def privacy_policy():
    return FileResponse(
        os.path.join(_LEGAL_DIR, "privacy.html"),
        media_type="text/html",
    )

@app.get("/terms", include_in_schema=False)
@app.get("/terms.html", include_in_schema=False)
async def terms_of_service():
    return FileResponse(
        os.path.join(_LEGAL_DIR, "terms.html"),
        media_type="text/html",
    )

@app.get("/delete-account", include_in_schema=False)
@app.get("/delete-account.html", include_in_schema=False)
async def delete_account_page():
    # Required by Google Play's account-deletion policy (linked from the
    # Play store listing / Data Safety form).
    return FileResponse(
        os.path.join(_LEGAL_DIR, "delete-account.html"),
        media_type="text/html",
    )

@app.get("/support", include_in_schema=False)
@app.get("/support.html", include_in_schema=False)
async def support_page():
    return FileResponse(
        os.path.join(_LEGAL_DIR, "support.html"),
        media_type="text/html",
    )

# ── Referral invite landing page ─────────────────────────────────────────────
# The mobile app shares HTTPS invite links (custom-scheme URLs are not tappable
# in Messages/Mail/WhatsApp and are dead ends without the app installed). This
# public page shows the code, tries to open the app via its custom scheme, and
# falls back to download instructions. Must be registered BEFORE the SPA
# catch-all mount below.
_INVITE_CODE_RE = re.compile(r"^[A-Za-z2-9]{4,12}$")

@app.get("/invite/{code}", include_in_schema=False)
async def invite_page(code: str):
    from fastapi.responses import HTMLResponse

    code = code.strip().upper()
    if not _INVITE_CODE_RE.fullmatch(code):
        return HTMLResponse("<h1>Invalid invite link</h1>", status_code=404)
    deep_link = f"earningsninja://referral/{code}"
    html = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Earnings Ninja — You're invited!</title>
<style>
  body {{ margin:0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
         background:#0a0a0a; color:#fff; display:flex; min-height:100vh;
         align-items:center; justify-content:center; text-align:center; }}
  .card {{ max-width:420px; padding:40px 28px; }}
  h1 {{ font-size:26px; margin:0 0 8px; }}
  p {{ color:#a3a3a3; font-size:15px; line-height:1.5; }}
  .code {{ font-size:32px; font-weight:900; letter-spacing:6px; color:#facc15;
          background:#171717; border:1px solid #262626; border-radius:14px;
          padding:16px 8px; margin:20px 0; user-select:all; -webkit-user-select:all; }}
  .btn {{ display:block; background:#facc15; color:#000; font-weight:800; font-size:17px;
         border-radius:999px; padding:16px; text-decoration:none; margin:10px 0; }}
  .btn.ghost {{ background:transparent; color:#facc15; border:1.5px solid #facc15; }}
  .hint {{ font-size:12.5px; color:#737373; margin-top:18px; }}
</style>
</head>
<body>
<div class="card">
  <div style="font-size:44px">🥷</div>
  <h1>You're invited to Earnings Ninja</h1>
  <p>Track your delivery earnings, expenses and mileage across every gig app. Use this code when you sign up.</p>
  <div class="code">{code}</div>
  <a class="btn" href="{deep_link}">Open the app</a>
  <a class="btn ghost" href="/">Get the app</a>
  <p class="hint">Have the app already? Tap “Open the app”, or enter the code on the sign-up screen. Don't have it yet? Download Earnings Ninja from the App Store, then enter the code when you sign up.</p>
</div>
<script>
  // If the app is installed, deep-link straight into it.
  setTimeout(function() {{ window.location.href = "{deep_link}"; }}, 400);
</script>
</body>
</html>"""
    return HTMLResponse(html)

if dist_path:
    @app.get("/sw.js")
    async def service_worker():
        return FileResponse(
            os.path.join(dist_path, "sw.js"),
            media_type="application/javascript",
            headers={"Service-Worker-Allowed": "/", "Cache-Control": "no-cache"},
        )

    @app.get("/manifest.webmanifest")
    async def manifest():
        return FileResponse(
            os.path.join(dist_path, "manifest.webmanifest"),
            media_type="application/manifest+json",
        )

    @app.get("/registerSW.js")
    async def register_sw():
        return FileResponse(
            os.path.join(dist_path, "registerSW.js"),
            media_type="application/javascript",
        )

    # SPA fallback: the landing site uses history-API routing (e.g. /upgrade),
    # so any unknown path must return index.html instead of a 404 so deep links
    # and hard refreshes resolve to the client-side router.
    class _SPAStaticFiles(StaticFiles):
        async def get_response(self, path, scope):
            from starlette.exceptions import HTTPException as _HTTPException
            # Never mask API routes with the SPA fallback — unknown /api paths
            # must keep returning real 404s (the mobile backend relies on this).
            is_api = path == "api" or path.startswith("api/")
            try:
                response = await super().get_response(path, scope)
            except _HTTPException as exc:
                if exc.status_code == 404 and not is_api:
                    return await super().get_response("index.html", scope)
                raise
            if response.status_code == 404 and not is_api:
                return await super().get_response("index.html", scope)
            return response

    app.mount("/", _SPAStaticFiles(directory=dist_path, html=True), name="static")
    logger.info(f"Serving site from: {dist_path}")
else:
    @app.get("/")
    async def root():
        return {"message": "Delivery Driver Earnings API"}
