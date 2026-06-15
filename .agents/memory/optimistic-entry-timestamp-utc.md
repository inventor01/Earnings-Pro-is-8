---
name: Optimistic entry timestamps must be UTC
description: Why optimistic/synthetic Entry rows must carry a 'Z'-suffixed UTC timestamp, not EST wall-clock
---

Optimistic (client-side, pre-server) Entry rows in the Expo app must set
`timestamp` to a UTC instant (e.g. `someDate.toISOString()`), NOT to an
EST/local wall-clock string like `${date}T${time}:00`.

**Why:** The History list (and other consumers) sort/parse timestamps with
`parseServerDate()` (lib/api.ts), which appends `Z` to any tz-less string and
therefore treats it as UTC. The backend stores naive UTC, so server rows are
correct. But a synthetic row built from EST wall-clock (no `Z`) gets parsed
~4-5h in the PAST, so a brand-new "now" entry sorted BELOW recent rows and only
jumped to the top after an app restart refetched the real UTC row. This was the
"new entries don't show at the top immediately" bug.

**How to apply:** Any place that fabricates a client-side Entry for optimistic
cache updates (create mutation, and the edit/update mutation's rebuilt
timestamp when date/time change) should derive `timestamp` from the picked
instant via `.toISOString()`. The EST date/time strings are only for the API
payload (backend localizes them to US/Eastern → UTC); they are the wrong
convention for anything read back through `parseServerDate`. Also keep
optimistic-insert sorts using `parseServerDate(...).getTime()` so they match the
list's comparator rather than comparing raw strings.
