import os
from openai import OpenAI
from backend.models import Entry, EntryType
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import Optional

client = OpenAI(
    api_key=os.environ.get("AI_INTEGRATIONS_OPENAI_API_KEY"),
    base_url=os.environ.get("AI_INTEGRATIONS_OPENAI_BASE_URL")
)

def get_ai_suggestions(
    db: Session,
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None
) -> dict:
    """Generate AI suggestions for earning optimization based on recent data"""
    
    # Fetch recent entries
    query = db.query(Entry)
    if from_date:
        query = query.filter(Entry.timestamp >= from_date)
    if to_date:
        query = query.filter(Entry.timestamp <= to_date)
    
    entries = query.all()
    
    if not entries:
        return {
            "suggestion": "Start logging your deliveries to get personalized earning optimization tips!",
            "minimum_order": None,
            "peak_time": None,
            "reasoning": "No data available yet"
        }
    
    # Calculate metrics
    total_revenue = 0
    total_expenses = 0
    order_amounts = []
    order_times = []
    by_hour = {}
    
    for entry in entries:
        amount = float(entry.amount)
        if entry.type == EntryType.ORDER:
            total_revenue += amount
            order_amounts.append(amount)
            hour = entry.timestamp.hour
            order_times.append(hour)
            
            if hour not in by_hour:
                by_hour[hour] = {"count": 0, "total": 0}
            by_hour[hour]["count"] += 1
            by_hour[hour]["total"] += amount
        elif entry.type == EntryType.EXPENSE:
            total_expenses += abs(amount)
    
    # Calculate statistics
    avg_order = sum(order_amounts) / len(order_amounts) if order_amounts else 0
    min_order = min(order_amounts) if order_amounts else 0
    max_order = max(order_amounts) if order_amounts else 0
    
    # Find peak time
    peak_hour = None
    peak_earnings = 0
    for hour, data in by_hour.items():
        avg_per_order = data["total"] / data["count"]
        if avg_per_order > peak_earnings:
            peak_earnings = avg_per_order
            peak_hour = hour
    
    # Find minimum viable order based on data
    min_viable_order = avg_order * 0.7  # 70% of average
    
    # Prepare context for AI
    context = f"""
Based on delivery driver data:
- Total orders: {len(order_amounts)}
- Average order value: ${avg_order:.2f}
- Minimum order seen: ${min_order:.2f}
- Maximum order seen: ${max_order:.2f}
- Total revenue: ${total_revenue:.2f}
- Total expenses: ${total_expenses:.2f}
- Peak earning hour: {peak_hour}:00 (avg ${peak_earnings:.2f}/order)

Provide 2-3 specific, actionable tips to help this driver earn more. Focus on:
1. Minimum order amounts to accept to optimize income
2. Best times to work for maximum earnings
3. Cost-saving strategies based on their data

Keep response concise, practical, and directly applicable.
"""
    
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "You are an expert delivery driver coach. Provide practical, data-driven suggestions to help drivers maximize earnings."
                },
                {
                    "role": "user",
                    "content": context
                }
            ],
            temperature=0.7,
            max_tokens=300
        )
        
        suggestion_text = response.choices[0].message.content
        
        # Convert peak hour to readable format
        peak_time = None
        if peak_hour is not None:
            peak_time = f"{peak_hour}:00 - {peak_hour+1}:00"
        
        return {
            "suggestion": suggestion_text,
            "minimum_order": round(min_viable_order, 2),
            "peak_time": peak_time,
            "average_order": round(avg_order, 2),
            "total_orders": len(order_amounts),
            "reasoning": f"Based on {len(entries)} entries across {len(order_amounts)} orders"
        }
    
    except Exception as e:
        # Fallback if AI call fails
        return {
            "suggestion": f"Keep working during peak hours ({peak_hour}:00) and aim for orders above ${min_viable_order:.2f}",
            "minimum_order": round(min_viable_order, 2),
            "peak_time": f"{peak_hour}:00 - {peak_hour+1}:00" if peak_hour else None,
            "average_order": round(avg_order, 2),
            "total_orders": len(order_amounts),
            "reasoning": f"Statistical analysis of {len(entries)} entries"
        }
