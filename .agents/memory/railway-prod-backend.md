---
name: Production backend runs on Railway, not Replit
description: The live mobile/app backend is hosted on Railway; the Replit Postgres is a stale backup, so data loss is not restorable from inside Replit.
---

# The live backend is on Railway — the Replit Postgres is NOT the production DB

The Expo app (and shipped clients) talk to a **Railway**-hosted FastAPI backend
(hardcoded fallback `API_BASE` in `earnings-ninja-expo/lib/api.ts`). That Railway
deployment — not Replit — serves real users.

**Consequences:**
- The Postgres reachable from inside Replit is a **stale backup**, not the live
  DB. Querying it does not reflect production state, and recent data may be
  entirely absent from it.
- Production data loss is a **Railway infrastructure** problem and cannot be
  diagnosed or restored from the Replit environment. `backend/db.py` falls back to
  an **ephemeral SQLite** file when `DATABASE_URL` is unset — if Railway ever runs
  without a persistent `DATABASE_URL`, every redeploy wipes the DB. That is the
  prime suspect for "all my data disappeared" reports.

**Why:** debugging prod issues (data loss, save failures) by inspecting Replit
state gives false conclusions; the source of truth lives on Railway.

**How to apply:** to verify backend behavior, hit the live Railway URL directly
(e.g. mint a prelaunch token via `/api/waitlist/verify-access` then
`POST /api/auth/demo` — demo accounts come preloaded with ~60 days of test data,
ideal for testing day-filtering). For data restoration / persistence fixes, the
user must act on Railway (ensure a persistent `DATABASE_URL`, restore from a
Railway backup, or migrate hosting). Harden `backend/db.py` to fail loudly when
`DATABASE_URL` is missing rather than silently using ephemeral SQLite.
