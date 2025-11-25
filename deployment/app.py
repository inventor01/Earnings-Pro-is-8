from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.routers import health, settings, entries, rollup, goals, suggestions, oauth
from backend.db import engine, Base
from backend.services.background_jobs import start_background_jobs, stop_background_jobs

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Delivery Driver Earnings API")

# Start background jobs on startup
@app.on_event("startup")
async def startup_event():
    start_background_jobs()

@app.on_event("shutdown")
async def shutdown_event():
    stop_background_jobs()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api", tags=["health"])
app.include_router(settings.router, prefix="/api", tags=["settings"])
app.include_router(entries.router, prefix="/api", tags=["entries"])
app.include_router(rollup.router, prefix="/api", tags=["rollup"])
app.include_router(goals.router, prefix="/api", tags=["goals"])
app.include_router(suggestions.router, prefix="/api", tags=["suggestions"])
app.include_router(oauth.router, prefix="/api", tags=["oauth"])

@app.get("/")
async def root():
    return {"message": "Delivery Driver Earnings API"}
