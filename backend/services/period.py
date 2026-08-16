from datetime import datetime, timedelta, timezone
from pytz import timezone as pytz_timezone
from pytz.exceptions import UnknownTimeZoneError

# ─── Per-user timezone day bucketing ─────────────────────────────────────────
#
# Historically every day/week/month boundary was hardwired to US/Eastern. Each
# account now carries an IANA timezone (auth_users.timezone, auto-detected from
# the device and editable in settings); every helper here takes a tz_name and
# the routers pass the requesting user's zone via user_tz_name().
#
# CUTOVER RULE (documented for task #132): entry timestamps are absolute UTC
# instants; the calendar day an entry belongs to is computed AT READ TIME in
# the user's CURRENT timezone. Because day windows in a single zone partition
# the timeline, totals can never double-count or lose entries. Changing the
# timezone in settings therefore re-buckets *display* for all history — an
# entry logged at 11pm Detroit time shows on that Detroit day; if the user
# later switches to Denver time it may display on the adjacent day, but every
# entry always appears in exactly one day. Grandfathered accounts are
# backfilled to America/New_York, so their buckets are bit-identical to the
# old fixed-EST behavior until they change the setting.

DEFAULT_TZ = "America/New_York"


def validate_timezone(name: str) -> bool:
    """True if `name` is a resolvable IANA timezone (e.g. 'America/Detroit')."""
    if not name or not isinstance(name, str) or len(name) > 64:
        return False
    try:
        pytz_timezone(name)
        return True
    except UnknownTimeZoneError:
        return False


def user_tz_name(user) -> str:
    """The IANA zone all day-boundary math should use for this user."""
    tz = getattr(user, "timezone", None)
    return tz if tz and validate_timezone(tz) else DEFAULT_TZ


def get_est_date_range(from_date_str: str, to_date_str: str, tz_name: str = DEFAULT_TZ):
    """
    Convert two YYYY-MM-DD strings (interpreted as inclusive calendar days in
    the user's timezone) into naive UTC datetime bounds for DB comparison.
    Mirrors the convention used by get_today() / get_this_month() etc.
    (Name kept for backward compatibility; 'est' now means 'user-local'.)
    """
    tz = pytz_timezone(tz_name)

    from_year, from_month, from_day = (int(p) for p in from_date_str.split('-'))
    to_year, to_month, to_day = (int(p) for p in to_date_str.split('-'))

    start_local_naive = datetime(from_year, from_month, from_day, 0, 0, 0, 0)
    end_local_naive   = datetime(to_year, to_month, to_day, 23, 59, 59, 999999)

    start_local = tz.localize(start_local_naive)
    end_local   = tz.localize(end_local_naive)

    start_utc = start_local.astimezone(timezone.utc).replace(tzinfo=None)
    end_utc   = end_local.astimezone(timezone.utc).replace(tzinfo=None)

    return start_utc, end_utc


def _now_local(tz_name: str):
    tz = pytz_timezone(tz_name)
    return datetime.now(timezone.utc).astimezone(tz), tz


def _day_bounds_utc(tz, y: int, m: int, d: int):
    """Naive-UTC [start, end] bounds of the local calendar day (y, m, d)."""
    start_local = tz.localize(datetime(y, m, d, 0, 0, 0))
    end_local   = tz.localize(datetime(y, m, d, 23, 59, 59, 999999))
    return (
        start_local.astimezone(timezone.utc).replace(tzinfo=None),
        end_local.astimezone(timezone.utc).replace(tzinfo=None),
    )


def get_day_offset(offset_days: int = 0, tz_name: str = DEFAULT_TZ):
    """A specific local calendar day (0 = today, -1 = yesterday, ...) as naive
    UTC bounds. Localizes the target date's midnight explicitly so the bounds
    stay correct across DST transitions (a replace() on a shifted datetime
    would carry the wrong offset on the day the clocks change)."""
    now_local, tz = _now_local(tz_name)
    target = (now_local + timedelta(days=offset_days)).date()
    return _day_bounds_utc(tz, target.year, target.month, target.day)

def get_today(tz_name: str = DEFAULT_TZ):
    return get_day_offset(0, tz_name)

def get_yesterday(tz_name: str = DEFAULT_TZ):
    return get_day_offset(-1, tz_name)

def get_this_week(tz_name: str = DEFAULT_TZ):
    now_local, tz = _now_local(tz_name)
    start_day = (now_local - timedelta(days=now_local.weekday())).date()  # Monday
    start_utc, _ = _day_bounds_utc(tz, start_day.year, start_day.month, start_day.day)
    _, end_utc = _day_bounds_utc(tz, now_local.year, now_local.month, now_local.day)
    return start_utc, end_utc

def get_last_7_days(tz_name: str = DEFAULT_TZ):
    now_local, tz = _now_local(tz_name)
    start_day = (now_local - timedelta(days=6)).date()
    start_utc, _ = _day_bounds_utc(tz, start_day.year, start_day.month, start_day.day)
    _, end_utc = _day_bounds_utc(tz, now_local.year, now_local.month, now_local.day)
    return start_utc, end_utc

def get_this_month(tz_name: str = DEFAULT_TZ):
    now_local, tz = _now_local(tz_name)
    start_utc, _ = _day_bounds_utc(tz, now_local.year, now_local.month, 1)
    _, end_utc = _day_bounds_utc(tz, now_local.year, now_local.month, now_local.day)
    return start_utc, end_utc

def get_last_month(tz_name: str = DEFAULT_TZ):
    now_local, tz = _now_local(tz_name)
    first_this_month = datetime(now_local.year, now_local.month, 1)
    last_month_last_day = first_this_month - timedelta(days=1)
    start_utc, _ = _day_bounds_utc(tz, last_month_last_day.year, last_month_last_day.month, 1)
    _, end_utc = _day_bounds_utc(tz, last_month_last_day.year, last_month_last_day.month, last_month_last_day.day)
    return start_utc, end_utc

def get_est_date_for_utc(dt_utc, tz_name: str = DEFAULT_TZ):
    """User-local calendar date (datetime.date) for a naive-UTC datetime — the
    inverse of the get_*/get_day_offset boundary math, used to key per-date
    daily goals. (Name kept for backward compatibility.)"""
    tz = pytz_timezone(tz_name)
    return dt_utc.replace(tzinfo=timezone.utc).astimezone(tz).date()

def get_est_today_date(tz_name: str = DEFAULT_TZ):
    """Today's calendar date (datetime.date) in the user's timezone.
    (Name kept for backward compatibility.)"""
    tz = pytz_timezone(tz_name)
    return datetime.now(timezone.utc).astimezone(tz).date()
