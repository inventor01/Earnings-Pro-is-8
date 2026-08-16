---
name: Per-user timezone bucketing
description: Rules for day/week/month bucketing after the cutover from fixed US/Eastern to per-account IANA timezones
---

**Rule:** every day-boundary computation must use the account's timezone — `user_tz_name(current_user)` server-side, `getUserTz()` client-side. Never a hardcoded zone, never the device clock. Timestamps stay absolute UTC; day assignment is computed at read time in the user's CURRENT zone (day windows partition the timeline, so a zone change only re-buckets display and can never double-count).

**Why:** the app originally bucketed everything in fixed US/Eastern; the cutover parameterized all boundary math, and one missed call site silently mis-files entries for non-Eastern users.

**How to apply:**
- Client default zone must stay America/New_York until server sync (matches the grandfather backfill, keeps pre-sync lockstep with old rows).
- The native DateTimePicker only edits device-local Dates: always round-trip through the account-zone bridge helpers (shift instant → picker wall-clock, unshift on change), or a traveling user's "9:00 AM" saves as a different time. Fixed-UTC-hour anchors (e.g. "noon Eastern") also pick the wrong day in far zones — anchor via wall-to-UTC in the account zone.
- After a timezone change: invalidate all queries AND force a notification-schedule refresh (scheduled copy carries old-zone day figures).
- Every signup path (email AND social) must send the validated device zone — social/OAuth account-creation paths are easy to miss.
- Displayed times (lists, detail modals) must pass an explicit account-zone `timeZone` to Intl, or the device zone leaks in and disagrees with bucketing.
