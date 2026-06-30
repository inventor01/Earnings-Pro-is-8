---
name: Email confirmation + welcome email
description: Non-blocking email-verification nudge and post-signup welcome email — design constraints and the grandfather-migration idempotency rule.
---

# Email confirmation (non-blocking) + welcome email

## Product decisions (durable — these shape edge cases)
- Email confirmation is **NON-blocking** by user decision: the app is fully usable
  while unverified. The dashboard shows a gentle, dismissible "confirm your email"
  banner (6-digit code entered in-app, same UX as the MFA code modal).
- **Grandfathered = verified, never nudged:** pre-existing accounts, demo accounts,
  and Apple-signin accounts are all `email_verified=True`. Only new email/password
  signups start unverified. Apple is set True because Apple already verifies the
  email it returns; demo is throwaway.
- Welcome email is sent **right after signup** (not gated on confirmation).
- The client **fails open**: the banner self-polls `/auth/email/status` on focus and
  renders nothing if the call errors (offline OR a backend that predates the
  endpoint). So the OTA can ship before the Railway backend is live — feature just
  stays dormant until both are deployed.

## Grandfather-migration idempotency rule (the non-obvious trap)
**The one-time backfill that marks existing rows verified must run ONLY inside the
"column does not exist yet" block of the additive migration.** If the
`UPDATE auth_users SET email_verified=TRUE` runs on every boot, it silently
re-verifies every legitimately-unverified new signup on the next restart, killing
the feature.
**Why:** migrations are re-run on every process start; only the `ALTER TABLE ADD
COLUMN` is naturally idempotent (guarded by a column-presence check). A blanket
backfill is NOT idempotent unless it is co-located inside that same guard.
**How to apply:** any future "add a boolean flag + grandfather existing rows"
migration must put the backfill UPDATE inside `if "<col>" not in cols:`, never at
the top level of the migration function.

## Security parity with MFA
- Verify endpoint enforces an attempt cap (5) + 24h TTL + bcrypt compare; verify and
  resend are authenticated AND route-rate-limited.
- **Never log the plaintext OTP except in the explicit dev no-key fallback branch.**
  The runtime send-failure `except` must NOT print the code (it would leak a valid
  code into production logs). This applies to every emailed-code function.
