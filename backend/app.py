from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from sqlalchemy import inspect, text
from backend.routers import health, settings, entries, rollup, goals, suggestions, oauth, points, auth_routes, leaderboard_routes, dashboard, waitlist_routes, referrals
from backend.db import engine, Base
from backend.services.background_jobs import start_background_jobs, stop_background_jobs
import os
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


_migrate_api_credentials_for_multi_user()
_migrate_synced_orders_for_multi_user()
_migrate_entries_add_idempotency_key()
_migrate_points_for_multi_user()
_migrate_auth_users_add_referral_code()

Base.metadata.create_all(bind=engine)

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
app.include_router(rollup.router, prefix="/api", tags=["rollup"])
app.include_router(goals.router, prefix="/api", tags=["goals"])
app.include_router(suggestions.router, prefix="/api", tags=["suggestions"])
app.include_router(oauth.router, prefix="/api", tags=["oauth"])
app.include_router(points.router, prefix="/api", tags=["points"])
app.include_router(leaderboard_routes.router, prefix="/api", tags=["leaderboard"])
app.include_router(referrals.router, prefix="/api", tags=["referrals"])
app.include_router(waitlist_routes.router, tags=["waitlist"])

# Serve frontend static files (must be after all API routes)
# Check multiple possible dist locations
_possible_dist = [
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

@app.get("/support", include_in_schema=False)
@app.get("/support.html", include_in_schema=False)
async def support_page():
    return FileResponse(
        os.path.join(_LEGAL_DIR, "support.html"),
        media_type="text/html",
    )

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

    app.mount("/", StaticFiles(directory=dist_path, html=True), name="static")
    logger.info(f"Serving frontend from: {dist_path}")
else:
    @app.get("/")
    async def root():
        return {"message": "Delivery Driver Earnings API"}
