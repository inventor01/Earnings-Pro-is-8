from datetime import datetime, timedelta

def get_today():
    now = datetime.utcnow()
    start = datetime(now.year, now.month, now.day, 0, 0, 0)
    end = datetime(now.year, now.month, now.day, 23, 59, 59)
    return start, end

def get_yesterday():
    now = datetime.utcnow()
    yesterday = now - timedelta(days=1)
    start = datetime(yesterday.year, yesterday.month, yesterday.day, 0, 0, 0)
    end = datetime(yesterday.year, yesterday.month, yesterday.day, 23, 59, 59)
    return start, end

def get_this_week():
    now = datetime.utcnow()
    start = now - timedelta(days=now.weekday())
    start = datetime(start.year, start.month, start.day, 0, 0, 0)
    end = datetime(now.year, now.month, now.day, 23, 59, 59)
    return start, end

def get_last_7_days():
    now = datetime.utcnow()
    start = now - timedelta(days=6)
    start = datetime(start.year, start.month, start.day, 0, 0, 0)
    end = datetime(now.year, now.month, now.day, 23, 59, 59)
    return start, end

def get_this_month():
    now = datetime.utcnow()
    start = datetime(now.year, now.month, 1, 0, 0, 0)
    end = datetime(now.year, now.month, now.day, 23, 59, 59)
    return start, end

def get_last_month():
    now = datetime.utcnow()
    first_this_month = datetime(now.year, now.month, 1)
    last_month = first_this_month - timedelta(days=1)
    start = datetime(last_month.year, last_month.month, 1, 0, 0, 0)
    end = datetime(last_month.year, last_month.month, last_month.day, 23, 59, 59)
    return start, end
