---
name: Per-date daily goal keys
description: Rules for date-keyed goals — EST midnight rollover, inherited-default semantics, mirror hygiene
---

Daily goals are per-EST-calendar-date (`DAILY:YYYY-MM-DD` client keys, `daily_goals` table server-side). The legacy `goals` TODAY row is the *inherited default* for dates never explicitly edited; editing today's date also rolls that default forward, editing any other date touches only that date.

**Why:** editing one day must never change another day; lossless migration required no backfill.

**How to apply:**
- Any UI state derived from "today's EST date" must re-tick at the EST day boundary (interval + AppState-active check), not be memoized on a day offset alone — otherwise an app left open past midnight writes to yesterday's key.
- Never mirror an *inherited* default under a date key locally, or a later default change is shadowed by a stale per-date copy offline.
- Never clear a local per-date mirror on transient HTTP errors (5xx/429/etc.) — only on a true "not found"; fall back to the mirror like the offline path.
