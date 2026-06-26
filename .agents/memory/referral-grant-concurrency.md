---
name: Referral grant atomicity & fail-soft
description: How the referral program enforces its once/cap guarantees and why grants must never break signup.
---

# Referral program — concurrency & fail-soft rules

The referral feature ("refer a driver, both get 1 free month of Pro", referrer
reward capped at 3) grants months via RevenueCat **v1 REST** promotional
entitlements. Two non-obvious constraints drove the design:

## Grants are best-effort; they must NEVER break signup
**Why:** `apply_referral` runs inline from `_signup`. A RevenueCat outage or a
missing `REVENUECAT_SECRET_API_KEY` must not abort account creation.
**How to apply:** the Referral row is committed first; grant calls are wrapped in
try/except and a failed/absent grant leaves `*_reward_granted=False` (a *pending*
slot) so it can be retried later and nothing double-counts. The secret is read at
call time — absent key → log + skip, return False.

## The once/cap guarantees must be atomic, not check-then-act
**Why:** a code-level "count then grant" races under concurrency: parallel
referees of the same referrer can each read the same count and all grant,
exceeding the cap; concurrent double-redeem of the same referee can 500 on the
unique constraint.
**How to apply:**
- **Referee-once:** rely on the DB unique constraint on `Referral.referee_id`.
  Catch `IntegrityError` on the insert commit → rollback → return False (treat as
  "already referred"), never let it 500.
- **Referrer cap:** lock the referrer's `AuthUser` row with `with_for_update()`,
  count rewards already granted, and if under cap **reserve** the slot by setting
  `referrer_reward_granted=True` on this referral, then commit (releasing the
  lock). Do the slow RevenueCat HTTP call *after* releasing the lock; if it fails,
  flip the flag back to False to hand the slot back. Never hold a row lock across
  the external HTTP call.
- **Code generation** (`_ensure_code`): retry on `IntegrityError` (unique
  `referral_code`), re-reading to adopt a code that won for this user or rolling a
  fresh one, instead of 500-ing on a collision.

## Prod runs on Railway
`REVENUECAT_SECRET_API_KEY` must be set on Railway too, not just Replit — Replit
is dev only. Use a **v1** secret key (grant service hits `api.revenuecat.com/v1`).
