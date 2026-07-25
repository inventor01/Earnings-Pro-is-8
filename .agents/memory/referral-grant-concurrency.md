---
name: Referral program — attribution-only (reward retired)
description: Referrals are recorded for attribution only; the free-month RevenueCat grant promotion was retired. Historical concurrency rules kept for reference.
---

# Referral program — current policy (Jul 2026)

The "both get 1 free month" reward promotion was **RETIRED** (Jul 2026).
Referral codes, invite sharing, and deep links remain; `apply_referral` only
records the `Referral` row for attribution. **No RevenueCat promotional grants
are made** — do not reintroduce grant calls without an explicit product
decision.

**Compatibility:** the `/api/referrals/me` response keeps its `rewards_*`
fields (frozen at historical values) and `RedeemResponse` keeps
`referee_reward_granted`, because shipped app builds still render them.

## Still-relevant invariants
- `apply_referral` must NEVER break signup: soft-fail (return False) on invalid
  code, self-referral, or already-referred; never raise.
- **Referee-once** is enforced by the DB unique constraint on
  `Referral.referee_id`: catch `IntegrityError` on insert → rollback → return
  False, never 500.
- **Code generation** (`_ensure_code`): retry on `IntegrityError` (unique
  `referral_code`), re-reading to adopt a winning code or rolling a fresh one.

## Historical (retired grant era)
When grants existed, the referrer cap used a with_for_update row lock +
reserve-then-grant pattern (never holding the lock across the RevenueCat HTTP
call), and failed grants left `*_reward_granted=False` as retryable pending
slots. `REVENUECAT_SECRET_API_KEY` on Railway is no longer needed for
referrals.
