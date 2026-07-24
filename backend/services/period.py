from datetime import datetime, timedelta, timezone
from pytz import timezone as pytz_timezone

def get_est_date_range(from_date_str: str, to_date_str: str):
    """
    Convert two YYYY-MM-DD strings (interpreted as inclusive EST calendar days)
    into naive UTC datetime bounds suitable for DB comparison.
    Mirrors the convention used by get_today() / get_this_month() etc.
    """
    est = pytz_timezone('US/Eastern')

    from_year, from_month, from_day = (int(p) for p in from_date_str.split('-'))
    to_year, to_month, to_day = (int(p) for p in to_date_str.split('-'))

    start_est_naive = datetime(from_year, from_month, from_day, 0, 0, 0, 0)
    end_est_naive   = datetime(to_year, to_month, to_day, 23, 59, 59, 999999)

    start_est = est.localize(start_est_naive)
    end_est   = est.localize(end_est_naive)

    start_utc = start_est.astimezone(timezone.utc).replace(tzinfo=None)
    end_utc   = end_est.astimezone(timezone.utc).replace(tzinfo=None)

    return start_utc, end_utc


def get_day_offset(offset_days: int = 0):
    """Get a specific day with offset in EST timezone, return UTC bounds. 0 = today, -1 = yesterday, 1 = tomorrow, etc."""
    est = pytz_timezone('US/Eastern')
    
    # Get current time in EST
    now_utc = datetime.now(timezone.utc)
    now_est = now_utc.astimezone(est)
    
    # Calculate target day in EST
    target_day_est = now_est + timedelta(days=offset_days)
    
    # Create start and end times by using replace() to avoid re-localization issues
    start_est = target_day_est.replace(hour=0, minute=0, second=0, microsecond=0)
    end_est = target_day_est.replace(hour=23, minute=59, second=59, microsecond=999999)
    
    # Convert to UTC (naive datetime for database comparison)
    start_utc = start_est.astimezone(timezone.utc).replace(tzinfo=None)
    end_utc = end_est.astimezone(timezone.utc).replace(tzinfo=None)
    
    return start_utc, end_utc

def get_today():
    return get_day_offset(0)

def get_yesterday():
    return get_day_offset(-1)

def get_this_week():
    est = pytz_timezone('US/Eastern')
    
    # Get current time in EST
    now_utc = datetime.now(timezone.utc)
    now_est = now_utc.astimezone(est)
    
    # Get start of this week (Monday in EST)
    start_day_est = now_est - timedelta(days=now_est.weekday())
    start_est = est.localize(datetime(start_day_est.year, start_day_est.month, start_day_est.day, 0, 0, 0))
    
    # Get end of today in EST
    end_est = est.localize(datetime(now_est.year, now_est.month, now_est.day, 23, 59, 59))
    
    # Convert to UTC
    start_utc = start_est.astimezone(timezone.utc).replace(tzinfo=None)
    end_utc = end_est.astimezone(timezone.utc).replace(tzinfo=None)
    
    return start_utc, end_utc

def get_last_7_days():
    est = pytz_timezone('US/Eastern')
    
    # Get current time in EST
    now_utc = datetime.now(timezone.utc)
    now_est = now_utc.astimezone(est)
    
    # Get 7 days ago in EST
    start_day_est = now_est - timedelta(days=6)
    start_est = est.localize(datetime(start_day_est.year, start_day_est.month, start_day_est.day, 0, 0, 0))
    
    # Get end of today in EST
    end_est = est.localize(datetime(now_est.year, now_est.month, now_est.day, 23, 59, 59))
    
    # Convert to UTC
    start_utc = start_est.astimezone(timezone.utc).replace(tzinfo=None)
    end_utc = end_est.astimezone(timezone.utc).replace(tzinfo=None)
    
    return start_utc, end_utc

def get_this_month():
    est = pytz_timezone('US/Eastern')
    
    # Get current time in EST
    now_utc = datetime.now(timezone.utc)
    now_est = now_utc.astimezone(est)
    
    # Get start of this month in EST
    start_est = est.localize(datetime(now_est.year, now_est.month, 1, 0, 0, 0))
    
    # Get end of today in EST
    end_est = est.localize(datetime(now_est.year, now_est.month, now_est.day, 23, 59, 59))
    
    # Convert to UTC
    start_utc = start_est.astimezone(timezone.utc).replace(tzinfo=None)
    end_utc = end_est.astimezone(timezone.utc).replace(tzinfo=None)
    
    return start_utc, end_utc

def get_last_month():
    est = pytz_timezone('US/Eastern')
    
    # Get current time in EST
    now_utc = datetime.now(timezone.utc)
    now_est = now_utc.astimezone(est)
    
    # Get first day of this month
    first_this_month = datetime(now_est.year, now_est.month, 1)
    last_month_last_day = first_this_month - timedelta(days=1)
    
    # Get start and end of last month in EST
    start_est = est.localize(datetime(last_month_last_day.year, last_month_last_day.month, 1, 0, 0, 0))
    end_est = est.localize(datetime(last_month_last_day.year, last_month_last_day.month, last_month_last_day.day, 23, 59, 59))
    
    # Convert to UTC
    start_utc = start_est.astimezone(timezone.utc).replace(tzinfo=None)
    end_utc = end_est.astimezone(timezone.utc).replace(tzinfo=None)
    
    return start_utc, end_utc

def get_est_date_for_utc(dt_utc):
    """EST calendar date (datetime.date) for a naive-UTC datetime — the inverse
    of the get_*/get_day_offset boundary math, used to key per-date daily goals."""
    est = pytz_timezone('US/Eastern')
    return dt_utc.replace(tzinfo=timezone.utc).astimezone(est).date()

def get_est_today_date():
    """Today's EST calendar date (datetime.date)."""
    est = pytz_timezone('US/Eastern')
    return datetime.now(timezone.utc).astimezone(est).date()
