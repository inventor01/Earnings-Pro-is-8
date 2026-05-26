import httpx
import json
from datetime import datetime, timedelta
from decimal import Decimal
from sqlalchemy.orm import Session
from backend.models import Entry, EntryType, AppType, SyncedOrder, PlatformIntegration, ApiCredential, AuthUser
import os

class UberSyncService:
    """Service to sync orders from Uber Eats API"""
    BASE_URL = "https://api.uber.com/v1"

    def __init__(self, access_token: str, user_id: str):
        self.access_token = access_token
        self.user_id = user_id
        self.headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }
    
    async def fetch_orders(self, start_date: datetime, end_date: datetime):
        """Fetch orders from Uber API"""
        try:
            async with httpx.AsyncClient() as client:
                # Uber API endpoint for deliveries
                endpoint = f"{self.BASE_URL}/marketplace/orders"
                params = {
                    "start_time": int(start_date.timestamp()),
                    "end_time": int(end_date.timestamp()),
                    "limit": 100,
                    "status": "completed"
                }
                
                response = await client.get(endpoint, headers=self.headers, params=params)
                if response.status_code == 200:
                    return response.json().get("orders", [])
                return []
        except Exception as e:
            print(f"Error fetching Uber orders: {e}")
            return []
    
    async def sync_orders(self, db: Session, orders: list):
        """Convert Uber orders to Entry records"""
        created_entries = []
        
        for order in orders:
            order_id = order.get("order_id")
            
            # Check if already synced
            existing = db.query(SyncedOrder).filter(
                SyncedOrder.user_id == self.user_id,
                SyncedOrder.platform == PlatformIntegration.UBER,
                SyncedOrder.platform_order_id == order_id
            ).first()
            
            if existing:
                continue
            
            # Create entry from Uber order
            amount = Decimal(str(order.get("fare", {}).get("total_amount", 0)))
            distance_miles = order.get("trip_distance", 0)
            timestamp = datetime.fromtimestamp(order.get("completed_at", 0))
            
            entry = Entry(
                user_id=self.user_id,
                timestamp=timestamp,
                type=EntryType.ORDER,
                app=AppType.UBEREATS,
                order_id=order_id,
                amount=amount,
                distance_miles=distance_miles,
                duration_minutes=int(order.get("trip_duration", 0) / 60)
            )
            
            db.add(entry)
            db.flush()
            
            # Track synced order
            synced_order = SyncedOrder(
                user_id=self.user_id,
                platform=PlatformIntegration.UBER,
                platform_order_id=order_id,
                entry_id=entry.id,
                sync_status="completed",
                synced_at=datetime.utcnow(),
                raw_data=json.dumps(order)
            )
            db.add(synced_order)
            created_entries.append(entry)
        
        db.commit()
        return created_entries


class ShiptSyncService:
    """Service to sync orders from Shipt API"""
    BASE_URL = "https://shipt.com/api/v1"

    def __init__(self, access_token: str, user_id: str):
        self.access_token = access_token
        self.user_id = user_id
        self.headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }
    
    async def fetch_orders(self, start_date: datetime, end_date: datetime):
        """Fetch orders from Shipt API"""
        try:
            async with httpx.AsyncClient() as client:
                endpoint = f"{self.BASE_URL}/orders"
                params = {
                    "start_date": start_date.isoformat(),
                    "end_date": end_date.isoformat(),
                    "status": "completed"
                }
                
                response = await client.get(endpoint, headers=self.headers, params=params)
                if response.status_code == 200:
                    return response.json().get("results", [])
                return []
        except Exception as e:
            print(f"Error fetching Shipt orders: {e}")
            return []
    
    async def sync_orders(self, db: Session, orders: list):
        """Convert Shipt orders to Entry records"""
        created_entries = []
        
        for order in orders:
            order_id = order.get("order_id")
            
            # Check if already synced
            existing = db.query(SyncedOrder).filter(
                SyncedOrder.user_id == self.user_id,
                SyncedOrder.platform == PlatformIntegration.SHIPT,
                SyncedOrder.platform_order_id == order_id
            ).first()
            
            if existing:
                continue
            
            # Create entry from Shipt order
            amount = Decimal(str(order.get("payout", 0)))
            distance_miles = order.get("estimated_mileage", 0)
            timestamp = datetime.fromisoformat(order.get("completed_at"))
            
            entry = Entry(
                user_id=self.user_id,
                timestamp=timestamp,
                type=EntryType.ORDER,
                app=AppType.SHIPT,
                order_id=order_id,
                amount=amount,
                distance_miles=distance_miles,
                duration_minutes=int(order.get("estimated_time", 0))
            )
            
            db.add(entry)
            db.flush()
            
            # Track synced order
            synced_order = SyncedOrder(
                user_id=self.user_id,
                platform=PlatformIntegration.SHIPT,
                platform_order_id=order_id,
                entry_id=entry.id,
                sync_status="completed",
                synced_at=datetime.utcnow(),
                raw_data=json.dumps(order)
            )
            db.add(synced_order)
            created_entries.append(entry)
        
        db.commit()
        return created_entries


async def sync_all_platforms(db: Session):
    """Sync orders for every active per-user credential. Credentials with a
    NULL user_id are legacy single-tenant rows from before the multi-user
    migration — we skip them because we can't safely attribute the synced
    Entry rows to a user."""
    credentials = (
        db.query(ApiCredential)
        .join(AuthUser, AuthUser.id == ApiCredential.user_id)
        .filter(
            ApiCredential.is_active == 1,
            ApiCredential.user_id.isnot(None),
        )
        .all()
    )

    start_date = datetime.utcnow() - timedelta(days=7)
    end_date = datetime.utcnow()

    for cred in credentials:
        try:
            if cred.platform == PlatformIntegration.UBER:
                service = UberSyncService(cred.access_token, cred.user_id)
                orders = await service.fetch_orders(start_date, end_date)
                await service.sync_orders(db, orders)
            elif cred.platform == PlatformIntegration.SHIPT:
                service = ShiptSyncService(cred.access_token, cred.user_id)
                orders = await service.fetch_orders(start_date, end_date)
                await service.sync_orders(db, orders)
        except Exception as e:
            print(f"Error syncing {cred.platform}: {e}")
