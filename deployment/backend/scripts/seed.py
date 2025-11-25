import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from backend.db import SessionLocal, engine, Base
from backend.models import Entry, Settings, EntryType, AppType, ExpenseCategory
from datetime import datetime, timedelta
from decimal import Decimal
import random

def seed_database():
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    
    db.query(Entry).delete()
    db.query(Settings).delete()
    
    settings = Settings(id=1, cost_per_mile=Decimal("0"))
    db.add(settings)
    
    now = datetime.utcnow()
    
    sample_entries = []
    
    for day_offset in range(7):
        day = now - timedelta(days=day_offset)
        num_orders = random.randint(5, 12)
        
        for i in range(num_orders):
            hour = random.randint(10, 21)
            minute = random.randint(0, 59)
            timestamp = datetime(day.year, day.month, day.day, hour, minute, 0)
            
            app = random.choice(list(AppType))
            payout = round(random.uniform(5.0, 25.0), 2)
            tip = round(random.uniform(0.0, 10.0), 2)
            total = Decimal(str(payout + tip))
            distance = round(random.uniform(1.0, 10.0), 2)
            duration = random.randint(15, 60)
            
            entry = Entry(
                timestamp=timestamp,
                type=EntryType.ORDER,
                app=app,
                order_id=f"ORD-{random.randint(10000, 99999)}",
                amount=total,
                distance_miles=distance,
                duration_minutes=duration,
                note=f"Delivery to customer"
            )
            sample_entries.append(entry)
        
        if random.random() > 0.5:
            hour = random.randint(10, 20)
            timestamp = datetime(day.year, day.month, day.day, hour, 0, 0)
            bonus = Decimal(str(round(random.uniform(5.0, 15.0), 2)))
            
            entry = Entry(
                timestamp=timestamp,
                type=EntryType.BONUS,
                app=random.choice(list(AppType)),
                amount=bonus,
                distance_miles=0,
                duration_minutes=0,
                note="Peak hours bonus"
            )
            sample_entries.append(entry)
    
    for day_offset in [0, 2, 5]:
        day = now - timedelta(days=day_offset)
        
        gas_expense = Entry(
            timestamp=datetime(day.year, day.month, day.day, 18, 0, 0),
            type=EntryType.EXPENSE,
            app=AppType.OTHER,
            amount=-Decimal(str(round(random.uniform(30.0, 50.0), 2))),
            distance_miles=0,
            duration_minutes=0,
            category=ExpenseCategory.GAS,
            note="Gas fill-up"
        )
        sample_entries.append(gas_expense)
    
    for day_offset in [1, 4]:
        day = now - timedelta(days=day_offset)
        
        parking = Entry(
            timestamp=datetime(day.year, day.month, day.day, 12, 30, 0),
            type=EntryType.EXPENSE,
            app=AppType.OTHER,
            amount=-Decimal("5.00"),
            distance_miles=0,
            duration_minutes=0,
            category=ExpenseCategory.PARKING,
            note="Downtown parking"
        )
        sample_entries.append(parking)
    
    for day_offset in [3]:
        day = now - timedelta(days=day_offset)
        
        cancellation = Entry(
            timestamp=datetime(day.year, day.month, day.day, 16, 45, 0),
            type=EntryType.CANCELLATION,
            app=random.choice(list(AppType)),
            order_id=f"CAN-{random.randint(10000, 99999)}",
            amount=-Decimal("3.50"),
            distance_miles=2.5,
            duration_minutes=10,
            note="Order cancelled by customer"
        )
        sample_entries.append(cancellation)
    
    for entry in sample_entries:
        db.add(entry)
    
    db.commit()
    print(f"✅ Seeded {len(sample_entries)} entries and settings")
    db.close()

if __name__ == "__main__":
    seed_database()
