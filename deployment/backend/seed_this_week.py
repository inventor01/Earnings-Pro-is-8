import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

from datetime import datetime, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import Entry, Settings, Base
import random

DATABASE_URL = "sqlite:///./driver_ledger.db"
engine = create_engine(DATABASE_URL)
Session = sessionmaker(bind=engine)

def seed_week_data():
    session = Session()
    
    # Monday Nov 24 - Good day
    base_date = datetime(2025, 11, 24)
    entries = [
        Entry(timestamp=base_date + timedelta(hours=6, minutes=15), type='ORDER', app='DOORDASH', order_id='DD-8901', amount=18.50, distance_miles=4.2, duration_minutes=28, note='Breakfast delivery'),
        Entry(timestamp=base_date + timedelta(hours=7, minutes=30), type='ORDER', app='UBEREATS', order_id='UE-3401', amount=22.75, distance_miles=5.8, duration_minutes=35, note='Coffee shop run'),
        Entry(timestamp=base_date + timedelta(hours=9, minutes=0), type='EXPENSE', app='OTHER', amount=-15.00, category='GAS', note='Gas station fill-up'),
        Entry(timestamp=base_date + timedelta(hours=11, minutes=45), type='ORDER', app='INSTACART', order_id='IC-7702', amount=35.60, distance_miles=8.3, duration_minutes=52, note='Grocery delivery'),
        Entry(timestamp=base_date + timedelta(hours=13, minutes=20), type='ORDER', app='GRUBHUB', order_id='GH-5503', amount=19.25, distance_miles=3.9, duration_minutes=25, note='Lunch order'),
        Entry(timestamp=base_date + timedelta(hours=15, minutes=10), type='BONUS', app='DOORDASH', amount=5.00, note='Peak pay bonus'),
        Entry(timestamp=base_date + timedelta(hours=17, minutes=30), type='ORDER', app='UBEREATS', order_id='UE-3402', amount=28.40, distance_miles=6.7, duration_minutes=42, note='Dinner delivery'),
    ]
    
    # Tuesday Nov 25 - Slower day
    base_date = datetime(2025, 11, 25)
    entries += [
        Entry(timestamp=base_date + timedelta(hours=7, minutes=0), type='ORDER', app='DOORDASH', order_id='DD-8902', amount=16.25, distance_miles=3.5, duration_minutes=22, note='Morning delivery'),
        Entry(timestamp=base_date + timedelta(hours=10, minutes=15), type='ORDER', app='INSTACART', order_id='IC-7703', amount=42.80, distance_miles=9.1, duration_minutes=58, note='Large grocery order'),
        Entry(timestamp=base_date + timedelta(hours=12, minutes=0), type='EXPENSE', app='OTHER', amount=-3.50, category='PARKING', note='Parking fee'),
        Entry(timestamp=base_date + timedelta(hours=14, minutes=30), type='ORDER', app='GRUBHUB', order_id='GH-5504', amount=15.75, distance_miles=2.8, duration_minutes=18, note='Quick delivery'),
        Entry(timestamp=base_date + timedelta(hours=18, minutes=45), type='ORDER', app='UBEREATS', order_id='UE-3403', amount=21.90, distance_miles=5.2, duration_minutes=32, note='Evening order'),
    ]
    
    # Wednesday Nov 26 - Best day
    base_date = datetime(2025, 11, 26)
    entries += [
        Entry(timestamp=base_date + timedelta(hours=6, minutes=30), type='ORDER', app='DOORDASH', order_id='DD-8903', amount=24.50, distance_miles=5.5, duration_minutes=38, note='Early bird delivery'),
        Entry(timestamp=base_date + timedelta(hours=8, minutes=15), type='ORDER', app='UBEREATS', order_id='UE-3404', amount=19.80, distance_miles=4.3, duration_minutes=27, note='Breakfast run'),
        Entry(timestamp=base_date + timedelta(hours=10, minutes=0), type='BONUS', app='INSTACART', amount=8.50, note='5-star rating bonus'),
        Entry(timestamp=base_date + timedelta(hours=11, minutes=30), type='ORDER', app='INSTACART', order_id='IC-7704', amount=38.25, distance_miles=7.8, duration_minutes=48, note='Grocery delivery'),
        Entry(timestamp=base_date + timedelta(hours=12, minutes=45), type='ORDER', app='GRUBHUB', order_id='GH-5505', amount=26.75, distance_miles=6.2, duration_minutes=41, note='Lunch rush'),
        Entry(timestamp=base_date + timedelta(hours=14, minutes=0), type='EXPENSE', app='OTHER', amount=-20.00, category='GAS', note='Gas fill-up'),
        Entry(timestamp=base_date + timedelta(hours=16, minutes=20), type='ORDER', app='DOORDASH', order_id='DD-8904', amount=32.10, distance_miles=8.5, duration_minutes=55, note='Long distance order'),
        Entry(timestamp=base_date + timedelta(hours=18, minutes=30), type='ORDER', app='UBEREATS', order_id='UE-3405', amount=29.60, distance_miles=6.9, duration_minutes=44, note='Dinner delivery'),
        Entry(timestamp=base_date + timedelta(hours=19, minutes=45), type='ORDER', app='GRUBHUB', order_id='GH-5506', amount=18.95, distance_miles=4.1, duration_minutes=26, note='Late dinner'),
    ]
    
    # Thursday Nov 27 - Moderate day
    base_date = datetime(2025, 11, 27)
    entries += [
        Entry(timestamp=base_date + timedelta(hours=8, minutes=0), type='ORDER', app='DOORDASH', order_id='DD-8905', amount=17.40, distance_miles=3.7, duration_minutes=24, note='Morning order'),
        Entry(timestamp=base_date + timedelta(hours=11, minutes=0), type='ORDER', app='INSTACART', order_id='IC-7705', amount=31.50, distance_miles=7.2, duration_minutes=46, note='Grocery run'),
        Entry(timestamp=base_date + timedelta(hours=13, minutes=15), type='ORDER', app='UBEREATS', order_id='UE-3406', amount=23.80, distance_miles=5.6, duration_minutes=36, note='Lunch delivery'),
        Entry(timestamp=base_date + timedelta(hours=15, minutes=30), type='EXPENSE', app='OTHER', amount=-2.00, category='TOLLS', note='Bridge toll'),
        Entry(timestamp=base_date + timedelta(hours=17, minutes=0), type='ORDER', app='GRUBHUB', order_id='GH-5507', amount=20.65, distance_miles=4.8, duration_minutes=31, note='Dinner order'),
        Entry(timestamp=base_date + timedelta(hours=19, minutes=15), type='ORDER', app='DOORDASH', order_id='DD-8906', amount=25.30, distance_miles=5.9, duration_minutes=39, note='Evening delivery'),
    ]
    
    # Friday Nov 28 - Busy day
    base_date = datetime(2025, 11, 28)
    entries += [
        Entry(timestamp=base_date + timedelta(hours=7, minutes=30), type='ORDER', app='UBEREATS', order_id='UE-3407', amount=21.15, distance_miles=4.9, duration_minutes=30, note='Friday morning'),
        Entry(timestamp=base_date + timedelta(hours=9, minutes=45), type='ORDER', app='INSTACART', order_id='IC-7706', amount=44.90, distance_miles=9.8, duration_minutes=62, note='Large grocery order'),
        Entry(timestamp=base_date + timedelta(hours=12, minutes=0), type='BONUS', app='DOORDASH', amount=6.50, note='Friday peak pay'),
        Entry(timestamp=base_date + timedelta(hours=12, minutes=30), type='ORDER', app='DOORDASH', order_id='DD-8907', amount=27.85, distance_miles=6.4, duration_minutes=40, note='Lunch rush'),
        Entry(timestamp=base_date + timedelta(hours=14, minutes=0), type='EXPENSE', app='OTHER', amount=-18.00, category='GAS', note='Gas station'),
        Entry(timestamp=base_date + timedelta(hours=16, minutes=45), type='ORDER', app='GRUBHUB', order_id='GH-5508', amount=22.40, distance_miles=5.3, duration_minutes=34, note='Afternoon delivery'),
        Entry(timestamp=base_date + timedelta(hours=18, minutes=30), type='ORDER', app='UBEREATS', order_id='UE-3408', amount=33.75, distance_miles=7.6, duration_minutes=49, note='Friday dinner'),
        Entry(timestamp=base_date + timedelta(hours=20, minutes=0), type='ORDER', app='DOORDASH', order_id='DD-8908', amount=28.50, distance_miles=6.8, duration_minutes=43, note='Late night order'),
    ]
    
    # Saturday Nov 29 - Weekend day
    base_date = datetime(2025, 11, 29)
    entries += [
        Entry(timestamp=base_date + timedelta(hours=9, minutes=0), type='ORDER', app='INSTACART', order_id='IC-7707', amount=39.80, distance_miles=8.7, duration_minutes=54, note='Weekend grocery'),
        Entry(timestamp=base_date + timedelta(hours=11, minutes=30), type='ORDER', app='UBEREATS', order_id='UE-3409', amount=25.60, distance_miles=5.7, duration_minutes=37, note='Brunch delivery'),
        Entry(timestamp=base_date + timedelta(hours=13, minutes=0), type='ORDER', app='DOORDASH', order_id='DD-8909', amount=19.95, distance_miles=4.4, duration_minutes=28, note='Lunch order'),
        Entry(timestamp=base_date + timedelta(hours=14, minutes=30), type='BONUS', app='GRUBHUB', amount=4.50, note='Weekend bonus'),
        Entry(timestamp=base_date + timedelta(hours=16, minutes=0), type='ORDER', app='GRUBHUB', order_id='GH-5509', amount=23.20, distance_miles=5.5, duration_minutes=35, note='Afternoon order'),
        Entry(timestamp=base_date + timedelta(hours=17, minutes=30), type='EXPENSE', app='OTHER', amount=-4.50, category='PARKING', note='Mall parking'),
        Entry(timestamp=base_date + timedelta(hours=19, minutes=0), type='ORDER', app='UBEREATS', order_id='UE-3410', amount=31.40, distance_miles=7.3, duration_minutes=47, note='Saturday dinner'),
    ]
    
    # Add all entries
    for entry in entries:
        session.add(entry)
    
    session.commit()
    
    # Count entries
    total_entries = len(entries)
    print(f"✅ Added {total_entries} entries for This Week (Nov 24-29)")
    
    # Show summary by day
    print("\n📊 Summary by Day:")
    print("Monday (Nov 24): 7 entries")
    print("Tuesday (Nov 25): 5 entries")
    print("Wednesday (Nov 26): 9 entries")
    print("Thursday (Nov 27): 6 entries")
    print("Friday (Nov 28): 8 entries")
    print("Saturday (Nov 29): 7 entries")
    print(f"\nTotal new entries: {total_entries}")
    
    session.close()

if __name__ == "__main__":
    seed_week_data()
