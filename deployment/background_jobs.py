import asyncio
from datetime import datetime
from apscheduler.schedulers.background import BackgroundScheduler
from backend.db import SessionLocal
from backend.services.sync_service import sync_all_platforms

scheduler = BackgroundScheduler()

def sync_job():
    """Background job to sync orders from all platforms"""
    db = SessionLocal()
    try:
        print(f"[{datetime.utcnow()}] Starting order sync...")
        asyncio.run(sync_all_platforms(db))
        print(f"[{datetime.utcnow()}] Order sync completed")
    except Exception as e:
        print(f"Error in sync job: {e}")
    finally:
        db.close()

def start_background_jobs():
    """Start all background jobs"""
    # Sync every 1 hour
    scheduler.add_job(
        sync_job,
        'interval',
        minutes=60,
        id='sync_orders',
        name='Sync Orders from Platforms',
        replace_existing=True
    )
    
    if not scheduler.running:
        scheduler.start()
        print("Background jobs started")

def stop_background_jobs():
    """Stop all background jobs"""
    if scheduler.running:
        scheduler.shutdown()
        print("Background jobs stopped")
