"""Task #132: per-user timezone day bucketing.

Verifies the parameterized period helpers produce correct naive-UTC bounds in
different IANA zones (including across DST transitions), the validation /
fallback helpers, and that the same UTC instant buckets to different calendar
days depending on the user's zone — while day windows in any single zone
always partition the timeline (no double counting, nothing lost)."""
from datetime import datetime, timedelta

import pytest

from backend.services.period import (
    DEFAULT_TZ,
    get_est_date_range,
    get_est_date_for_utc,
    get_day_offset,
    user_tz_name,
    validate_timezone,
)


class _U:
    def __init__(self, tz):
        self.timezone = tz


def test_validate_timezone():
    assert validate_timezone("America/Detroit")
    assert validate_timezone("America/New_York")
    assert validate_timezone("Asia/Tokyo")
    assert validate_timezone("UTC")
    assert not validate_timezone("Mars/OlympusMons")
    assert not validate_timezone("")
    assert not validate_timezone(None)
    assert not validate_timezone("x" * 100)


def test_user_tz_name_fallback():
    assert user_tz_name(_U("America/Chicago")) == "America/Chicago"
    assert user_tz_name(_U(None)) == DEFAULT_TZ
    assert user_tz_name(_U("Not/AZone")) == DEFAULT_TZ
    assert user_tz_name(object()) == DEFAULT_TZ  # no timezone attr at all


def test_date_range_eastern_summer():
    # July 1 2026, EDT = UTC-4 → local midnight = 04:00 UTC.
    start, end = get_est_date_range("2026-07-01", "2026-07-01", "America/New_York")
    assert start == datetime(2026, 7, 1, 4, 0, 0)
    assert end == datetime(2026, 7, 2, 3, 59, 59, 999999)


def test_date_range_eastern_winter():
    # Jan 15 2026, EST = UTC-5 → local midnight = 05:00 UTC.
    start, end = get_est_date_range("2026-01-15", "2026-01-15", "America/New_York")
    assert start == datetime(2026, 1, 15, 5, 0, 0)
    assert end == datetime(2026, 1, 16, 4, 59, 59, 999999)


def test_date_range_tokyo():
    # Tokyo is UTC+9, no DST → local midnight = previous day 15:00 UTC.
    start, end = get_est_date_range("2026-07-01", "2026-07-01", "Asia/Tokyo")
    assert start == datetime(2026, 6, 30, 15, 0, 0)
    assert end == datetime(2026, 7, 1, 14, 59, 59, 999999)


def test_date_range_spans_dst_spring_forward():
    # US DST spring-forward: Sunday Mar 8 2026 (2am → 3am). The local day is
    # only 23h long; bounds must still be exact local midnight → 23:59:59.999.
    start, end = get_est_date_range("2026-03-08", "2026-03-08", "America/New_York")
    assert start == datetime(2026, 3, 8, 5, 0, 0)          # EST midnight
    assert end == datetime(2026, 3, 9, 3, 59, 59, 999999)  # EDT end of day
    # 23-hour day
    assert (end - start) == timedelta(hours=23) - timedelta(microseconds=1)


def test_days_partition_timeline_no_gap_no_overlap():
    # Consecutive days in one zone must tile the timeline exactly, even across
    # the DST transition — this is what guarantees no double counting.
    for tz in ("America/New_York", "America/Denver", "Asia/Tokyo"):
        prev_end = None
        for day in ("2026-03-07", "2026-03-08", "2026-03-09"):
            s, e = get_est_date_range(day, day, tz)
            if prev_end is not None:
                assert s - prev_end == timedelta(microseconds=1)
            prev_end = e


def test_same_instant_different_local_day():
    # 03:00 UTC on July 2 = 11pm July 1 in New York, but 8pm July 1 in LA and
    # already noon July 2 in Tokyo.
    instant = datetime(2026, 7, 2, 3, 0, 0)
    assert get_est_date_for_utc(instant, "America/New_York").isoformat() == "2026-07-01"
    assert get_est_date_for_utc(instant, "America/Los_Angeles").isoformat() == "2026-07-01"
    assert get_est_date_for_utc(instant, "Asia/Tokyo").isoformat() == "2026-07-02"


def test_get_day_offset_bounds_round_trip():
    # Whatever "today" is in each zone, its bounds must map back to the same
    # local date at both ends (start-of-day and end-of-day are the same day).
    for tz in ("America/New_York", "Pacific/Honolulu", "Asia/Tokyo", "UTC"):
        start, end = get_day_offset(0, tz)
        assert get_est_date_for_utc(start, tz) == get_est_date_for_utc(end, tz)
        # And yesterday's window ends exactly 1µs before today's starts.
        y_start, y_end = get_day_offset(-1, tz)
        assert start - y_end == timedelta(microseconds=1)


def test_default_matches_legacy_eastern():
    # No-arg calls must behave exactly like the old fixed-EST helpers so
    # grandfathered accounts (backfilled to America/New_York) see no change.
    assert get_est_date_range("2026-01-15", "2026-01-15") == get_est_date_range(
        "2026-01-15", "2026-01-15", "America/New_York"
    )
