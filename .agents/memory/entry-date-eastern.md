---
name: Entry date/time must serialize in US/Eastern
description: Why AddEntry serializes saved date/time in America/New_York, not device-local
---

# Entry create/update must emit US/Eastern wall-clock

Any path that builds the `date` + `time` strings for an entry create/update MUST
format the instant in `America/New_York`, never from device-local Date getters.

**Why:** the backend interprets those strings as US/Eastern and the
Today/Yesterday (and all period) views compute calendar-day boundaries in
US/Eastern. A device-local serialization makes a non-EST user's first order
after the EST midnight rollover (e.g. 9pm Pacific = 12am ET) file under the
previous ET day, so it wrongly shows in Yesterday instead of Today.

**How to apply:** reuse the shared `easternDateTime(d)` helper exported from
`lib/csvExport.ts` (returns `{date:'YYYY-MM-DD', time:'HH:MM'}` in ET, 24:00→00:00
normalized). The AddEntry picker label is also ET-formatted so the displayed day
matches where it files. The native iOS DateTimePicker wheel still shows
device-local time (can't force its tz) — accepted residual mismatch; label and
storage are the source of truth. `parseServerDate` appends 'Z' (UTC) so editing
an existing entry reproduces its original ET day with no shift. Frontend-only →
OTA-safe.
