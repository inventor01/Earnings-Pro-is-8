---
name: Once-ever UX flags need server sync
description: Pattern for tutorial/onboarding "show once" flags (walkthrough_completed)
---
Rule: any "show once per account" surface (dashboard walkthrough, onboarding funnel) must persist completion server-side (auth_users boolean + /auth/me + idempotent POST complete endpoint), with device AsyncStorage as an offline cache only.

**Why:** the walkthrough completion lived only in `walkthrough_done:<userId>` AsyncStorage; reinstall/TestFlight fresh install wiped it and the tour re-showed on paid accounts (v102 bug). Server flag survives reinstall and device changes.

**How to apply:**
- Guarded add-column migration with grandfather backfill INSIDE the creation guard (existing pattern in backend/app.py).
- Client: done = serverFlag===true || localFlag; heal server when local-true/server-false; write BOTH at tour start and finish; demo accounts ignore persistence and never write.
- Race: cached profile hydrates before /auth/me — a late server `true` must dismiss an already AUTO-opened tour (autoOpened ref) but never a deliberate Settings replay.
- Backend fixes go live only after git push → Railway deploy; client changes need a native build (OTA unreliable for this user).
