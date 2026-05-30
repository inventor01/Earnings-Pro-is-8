---
name: CSV Export (Expo mobile)
description: How CSV export round-trips with the in-app importer, and the timezone trap behind it.
---

# CSV Export round-trip

The mobile CSV export (`earnings-ninja-expo/lib/csvExport.ts`) must produce files
that re-import cleanly through the in-app importer (`csvRowsToEntries` in
`app/(tabs)/index.tsx`).

## Timezone is the trap
**Rule:** export `date`/`time` columns in **US/Eastern wall-clock**, never device-local.

**Why:** the backend import path (`backend/routers/entries.py`, the create-entry
branch) interprets the `date` + `time` columns as `US/Eastern` and converts them
to UTC for storage. If export writes device-local wall time, a non-Eastern user's
entries get shifted by their UTC offset on re-import (export→import is lossy).

**How to apply:** format with
`toLocaleDateString/TimeString('en-CA', { timeZone: 'America/New_York', hour12:false })`
(en-CA gives `YYYY-MM-DD` / `HH:MM`). Normalize a `24:xx` midnight to `00:xx`.
Timezone-aware `Intl` works in this app's Hermes build (CalendarModal already
relies on it). Verified: a UTC instant → ET export → backend ET→UTC reproduces
the original instant.

## Other contract details
- Columns/order must match the importer exactly: `date,time,type,app,amount,distance_miles,duration_minutes,category,note`.
- `amount` is exported **signed** (expenses/cancellations negative); the backend
  re-normalizes sign by `type`, so signed values round-trip correctly.

## Native dep / deploy note
Uses `expo-file-system` (the `/legacy` subpath for `writeAsStringAsync` +
`cacheDirectory` on SDK 54) and `expo-sharing`. Both are native modules → a JS-only
`eas update` (OTA) is NOT enough; the feature only works after an
`eas build --platform ios --profile preview` bakes the modules in.
