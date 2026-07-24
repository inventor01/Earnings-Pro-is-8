---
name: Random "everything deleted" root cause
description: Why users saw all data randomly wiped — ephemeral SQLite fallback on Railway
---
**Rule:** the backend must never silently fall back to SQLite when DATABASE_URL is unset; the guard in `backend/db.py` (added Jun 23, 2026) raises at boot instead. Keep that guard.

**Why:** the old code defaulted to `sqlite:///./driver_ledger.db` — an ephemeral file on Railway that is recreated EMPTY on every redeploy/container recreation. Users then get 401 (their account row is gone), the app force-logs-out and clears the local mirror too → "everything randomly deleted", total loss.

**How to apply:** the fix is only live once the current code is deployed to Railway AND `DATABASE_URL` is set in Railway variables. As of Jul 24, 2026 Railway ran pre-Jun-26 code (verified: /api/referrals 404, /api/points/user 200 unauthenticated), so it may still be on the vulnerable fallback. Deploy = user pushes to GitHub (Railway auto-deploys). After deploying, if the service crash-loops with the RuntimeError, DATABASE_URL is missing — that confirms SQLite was in use and the data-wipe diagnosis.

Secondary note: the client's forced-logout path (`authContext` 401/403) wipes the local mirror — correct for shared-device hygiene, but it means the local copy cannot rescue data after a server wipe.
