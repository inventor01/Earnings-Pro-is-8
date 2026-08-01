---
name: Onboarding funnel gating
description: How the one-time conversion onboarding flow decides who sees it and how completion syncs
---

The mobile onboarding funnel must FAIL CLOSED toward the dashboard: only an explicit server `onboarding_completed === false` (fresh signup) shows it. `undefined` (old cached profile, older server) and demo accounts always skip.

**Why:** existing users must never be re-onboarded; the server flag is grandfathered true for pre-feature rows inside the add-column guard (same pattern as email verification — backfill must stay inside the guard or re-runs wipe new-signup state).

**How to apply:**
- Server flag (`auth_users.onboarding_completed`, `/api/auth/onboarding/complete`) is the reinstall/cross-device source of truth; a per-account AsyncStorage state gives mid-flow resume and offline completion (`localDone` sticks; server flag retried on later app opens from `_layout`).
- A device-local `freshSignup` flag set at signup routes the new account into onboarding before `/auth/me` resolves (avoids dashboard flash); it is cleared once the profile resolves with no onboarding due.
- The paywall handoff uses `presentPaywall(options)` overrides (headline/subheadline/social proof) — never touch pricing rows, billed-price prominence (3.1.2(c)), or the trial/legal blocks.
- Social proof copy must stay neutral (no fabricated ratings/user counts) until real data is approved.
