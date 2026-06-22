---
name: Entry date-change save failure (Hermes single-digit hour)
description: Why early-morning Eastern entries failed to save/change date, and the invariant that prevents it
---

# Entry date/time must be zero-padded before it reaches the backend

When the app sends an entry's wall-clock to the API it sends a separate
`date` (`YYYY-MM-DD`) and `time` (`HH:MM`) string. The backend composes
`f"{date}T{time}:00"` and parses it. **Both components must be zero-padded**
or the parse fails.

**Why:** React Native / Hermes `Intl` does NOT zero-pad the hour when using
`toLocaleTimeString('en-CA', { hour: '2-digit', hour12: false })` — it emits
single-digit hours (`"9:30"`, `"0:05"`) for hours < 10. Node's full ICU pads
them, so this passed every desktop/Node test but broke on-device. The backend
`datetime.fromisoformat("...T9:30:00")` raised `ValueError`, and the callers
swallowed it: create fell back to `datetime.utcnow()` (wrong date) and update
silently `pass`ed (date change dropped). Symptom: changing the date on an
order timed midnight–9:59am Eastern sometimes failed/dropped silently.

**How to apply:**
- Frontend: build padded date/time with `Intl.DateTimeFormat(...).formatToParts()`
  + explicit `padStart(2,'0')` on each part; normalize `hour === '24' → '00'`.
  Do NOT trust locale string formatters to pad on Hermes.
- Backend defense-in-depth: parse from int components instead of
  `fromisoformat` so single-digit hour/month is tolerated and `24`→`0`
  normalized (EST→UTC naive). This path also covers the CSV import endpoint.
- General lesson: anything that depends on `Intl`/`toLocale*` zero-padding must
  be verified on-device (Hermes), not just in Node.
