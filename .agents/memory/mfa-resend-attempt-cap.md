---
name: Email 2FA resend / attempt-cap interaction
description: Why MFA "resend code" must be capped and anchored to the original challenge window, not just rely on a per-code attempt cap.
---

# MFA per-code attempt cap is bypassable if Resend is uncapped

A per-code "N wrong attempts then lock" counter is **not** a brute-force bound on
its own when a "Resend code" endpoint exists. Each Resend mints a fresh code and
resets the per-code attempt counter, so an attacker who already has the password
can cycle Resend → 5 guesses → Resend → 5 guesses … forever. Per-IP rate limits
don't fix it (distributed IPs).

**The rule:** bound the *whole verification session*, not just each code:
- Cap the number of resends per session (carry a `gen` counter in the challenge
  JWT; reject when it exceeds the cap → force a fresh password login).
- Anchor the challenge token's `exp` to the **original** issue time (carry `iat0`
  in the JWT and preserve it across resends) so Resend mints a new code but can
  **never extend** the overall window. Total guesses become
  `(maxResends + 1) * maxAttemptsPerCode` against independent random codes within
  one short, non-renewable window.

**Why:** codes are independent random draws, so resetting attempts per code is
fine *only* if the count of codes is itself bounded. Without both controls the
stated "5-attempt" guarantee is effectively unbounded.

**How to apply:** any emailed/SMS OTP flow with a Resend affordance — keep the
per-code attempt counter AND cap+anchor the session. Also: never log the OTP
plaintext outside a dev-only no-key fallback, and mask the email in failure logs.
