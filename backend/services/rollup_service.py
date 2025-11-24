from sqlalchemy.orm import Session
from sqlalchemy import func
from backend.models import Entry, Settings, EntryType, AppType, Goal, TimeframeType
from decimal import Decimal
from datetime import datetime
from typing import Optional

def calculate_rollup(db: Session, from_date: Optional[datetime] = None, to_date: Optional[datetime] = None, timeframe: Optional[str] = None):
    query = db.query(Entry)
    
    if from_date:
        query = query.filter(Entry.timestamp >= from_date)
    if to_date:
        query = query.filter(Entry.timestamp <= to_date)
    
    entries = query.all()
    
    settings = db.query(Settings).first()
    cost_per_mile = settings.cost_per_mile if settings else Decimal("0")
    
    total_amount = Decimal("0")
    revenue = Decimal("0")
    expenses = Decimal("0")
    miles = 0.0
    total_minutes = 0
    
    by_type = {t.value: Decimal("0") for t in EntryType}
    by_app = {a.value: Decimal("0") for a in AppType}
    
    for entry in entries:
        amount = Decimal(str(entry.amount))
        total_amount += amount
        
        if amount > 0:
            revenue += amount
        else:
            expenses += abs(amount)
        
        miles += entry.distance_miles
        total_minutes += entry.duration_minutes
        
        by_type[entry.type.value] += amount
        by_app[entry.app.value] += amount
    
    hours = total_minutes / 60.0 if total_minutes > 0 else 0.0
    net_earnings = total_amount
    profit = total_amount
    
    dollars_per_mile = net_earnings / Decimal(str(miles)) if miles > 0 else Decimal("0")
    dollars_per_hour = net_earnings / Decimal(str(hours)) if hours > 0 else Decimal("0")
    
    # Calculate metrics for orders
    order_entries = [e for e in entries if e.type.value == 'ORDER']
    order_count = len(order_entries)
    average_order_value = Decimal("0")
    per_hour_first_to_last = Decimal("0")
    
    if order_count > 0:
        total_order_revenue = Decimal("0")
        for order in order_entries:
            total_order_revenue += Decimal(str(order.amount))
        average_order_value = total_order_revenue / Decimal(str(order_count))
        
        # Calculate per-hour rate based on first and last order
        order_timestamps = sorted([e.timestamp for e in order_entries])
        first_timestamp = order_timestamps[0]
        last_timestamp = order_timestamps[-1]
        
        hours_first_to_last = (last_timestamp - first_timestamp).total_seconds() / 3600.0
        if hours_first_to_last > 0:
            per_hour_first_to_last = profit / Decimal(str(hours_first_to_last))
        elif order_count == 1:
            per_hour_first_to_last = Decimal("0")
    
    # Get goal data if timeframe provided
    goal_data = None
    goal_progress = None
    if timeframe:
        try:
            tf = TimeframeType[timeframe]
            goal = db.query(Goal).filter(Goal.timeframe == tf).first()
            if goal:
                goal_data = {
                    "id": goal.id,
                    "timeframe": goal.timeframe.value,
                    "target_profit": float(goal.target_profit),
                    "created_at": goal.created_at.isoformat(),
                    "updated_at": goal.updated_at.isoformat()
                }
                target = float(goal.target_profit)
                if target > 0:
                    goal_progress = min(100.0, (float(revenue) / target) * 100)
        except (KeyError, ValueError):
            pass
    
    return {
        "revenue": float(revenue),
        "expenses": float(expenses),
        "profit": float(profit),
        "miles": miles,
        "hours": round(hours, 2),
        "dollars_per_mile": float(round(dollars_per_mile, 2)),
        "dollars_per_hour": float(round(dollars_per_hour, 2)),
        "average_order_value": float(round(average_order_value, 2)),
        "per_hour_first_to_last": float(round(per_hour_first_to_last, 2)),
        "by_type": {k: float(v) for k, v in by_type.items()},
        "by_app": {k: float(v) for k, v in by_app.items()},
        "goal": goal_data,
        "goal_progress": goal_progress
    }
