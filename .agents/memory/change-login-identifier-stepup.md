---
name: Changing login identifiers requires step-up auth
description: Rules for change-email/change-username endpoints — re-auth, passwordless block, token rotation.
---

Rule: any endpoint that rebinds a login identifier (email) must require step-up auth, not just a bearer token.

**Why:** A stolen/idle session token would otherwise let an attacker rebind the login email and take over the account. Architect flagged this on the change-email feature: password accounts re-entered their password, but passwordless (Sign in with Apple) accounts were changeable with a session token alone.

**How to apply:**
- Password accounts: require the current password in the request body.
- Passwordless accounts (no `password_hash`): block email change with a friendly message ("set a password via Forgot password first") until real step-up (Apple re-auth / MFA) exists.
- Username changes are lower-risk (not a credential) and stay session-only.
- JWTs embed the email claim, so change-email returns a fresh access token; the mobile client persists it via `login(token)` so the change survives restarts. Old tokens stay valid because `get_current_user` looks up by user id.
- New email is set `email_verified=False` and a 6-digit code goes to the NEW address (same flow as signup); verification is non-blocking ("Later" allowed).
