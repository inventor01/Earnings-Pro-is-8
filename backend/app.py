from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.routers import health, settings, entries, rollup, goals
from backend.db import engine, Base

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Delivery Driver Earnings API")

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

@app.get("/")
async def root():
    return {"message": "Delivery Driver Earnings API"}
