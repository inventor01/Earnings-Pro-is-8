---
name: create_entry drops fields not in the Entry(...) constructor
description: Backend create path can silently drop valid schema fields; check the constructor when a new persisted field "doesn't save on create".
---

The entry CREATE path builds the ORM row with an explicit `Entry(...)` constructor
that lists fields one by one. The UPDATE path instead loops/`setattr`s from the
schema, so it persists any new field automatically.

**Why:** A field can be fully present in `models.py`, `schemas.py`
(EntryCreate/Update/Response) and the mobile API types, yet still not save on
**create** because the `Entry(...)` constructor in `backend/routers/entries.py`
omitted it. Edit then appears to work (setattr) while create silently drops it —
a confusing asymmetry (e.g. `is_business_expense`, `during_business_hours`).

**How to apply:** When adding a new persisted Entry field, update the create
constructor explicitly in addition to the schema; don't assume schema membership
is enough. After any backend field change, remember it needs a deploy to reach
the live app (mobile talks to the deployed backend); JS-only changes ship OTA.
