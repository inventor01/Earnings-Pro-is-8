from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from sqlalchemy import inspect, text
from backend.routers import health, settings, entries, rollup, goals, suggestions, oauth, points, auth_routes, leaderboard_routes, dashboard, waitlist_routes
from backend.db import engine, Base
from backend.services.background_jobs import start_background_jobs, stop_background_jobs
import os
import logging

# Configure logging for production
logging.basicConfig(level=logging.WARNING)
logger = logging.getLogger(__name__)

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


_migrate_api_credentials_for_multi_user()
_migrate_synced_orders_for_multi_user()

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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add cache control headers to prevent stale data issues
@app.middleware("http")
async def add_cache_headers(request, call_next):
    response = await call_next(request)
    path = request.url.path
    if path.startswith("/api"):
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
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
