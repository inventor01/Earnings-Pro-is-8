from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from backend.routers import health, settings, entries, rollup, goals, suggestions, oauth, points, auth_routes, leaderboard_routes, dashboard, waitlist_routes
from backend.db import engine, Base
from backend.services.background_jobs import start_background_jobs, stop_background_jobs
import os
import logging

# Configure logging for production
logging.basicConfig(level=logging.WARNING)
logger = logging.getLogger(__name__)

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Delivery Driver Earnings API", docs_url=None, redoc_url=None)

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
# In production (Docker), dist is at /app/dist
# In development, it might be at backend/../frontend/dist
dist_path = os.path.join(os.path.dirname(__file__), "..", "dist")
dist_path = os.path.abspath(dist_path)

if os.path.exists(dist_path):
    app.mount("/", StaticFiles(directory=dist_path, html=True), name="static")
else:
    # Fallback if dist not available (for development)
    @app.get("/")
    async def root():
        return {"message": "Delivery Driver Earnings API"}
