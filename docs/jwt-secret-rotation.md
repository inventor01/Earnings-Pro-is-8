# JWT Secret Rotation Runbook

_Last updated: 2026-08-08_

## Why rotate

`JWT_SECRET_KEY` (and `PRELAUNCH_ACCESS_CODE`) were stored in plaintext in `.replit`
config until Aug 2026. Anyone with repl access, a fork, or one of the old tracked
zip snapshots could have seen them. **Treat the old JWT secret as compromised** —
with it, an attacker can forge a valid access token for any user id and bypass
login entirely. Rotation is the only fix; the old value in past snapshots/history
cannot be un-leaked.

The secrets now live only in the secrets manager:
- **Dev (this repl):** Replit Secrets (`JWT_SECRET_KEY`, `PRELAUNCH_ACCESS_CODE`)
- **Prod (Railway):** Railway service environment variables

## What breaks when you rotate

All tokens signed with the old secret become invalid immediately:
- **Access tokens** — every signed-in user is logged out and must sign in again.
- **MFA challenge tokens** — any in-flight 2FA verification dies; user re-enters password.
- **Prelaunch tokens** — in-flight signup gates expire; user re-enters the access code.
- **OAuth state tokens** — any in-flight OAuth connect flow must be restarted.

Nothing is lost permanently — no data is tied to the secret. Users simply re-log-in.
Rotate at a low-traffic time to minimize annoyance.

## How to rotate (production, Railway)

1. **Generate a strong secret** (do this locally or in the repl shell; don't reuse anything):

   ```bash
   python -c 'import secrets; print(secrets.token_hex(48))'
   ```

2. **Set it on Railway:**
   - Railway dashboard → your backend service → **Variables**
   - Edit `JWT_SECRET_KEY` → paste the new value → save.
   - Railway redeploys the service automatically on variable change. If not, trigger a redeploy.

3. **(Optional) rotate `PRELAUNCH_ACCESS_CODE`** the same way if the prelaunch gate is
   still active (set to an empty string to disable the gate entirely).

4. **Verify:**
   - The service boots (it fails fast with a clear error if `JWT_SECRET_KEY` is missing).
   - An old session token gets `401` on any authenticated endpoint.
   - A fresh login works and authenticated requests succeed.

5. **Update the dev repl** (optional but recommended): set a *different* new value in
   Replit Secrets so dev and prod never share a signing key.

## Notes

- The backend refuses to start without `JWT_SECRET_KEY` — there is no fallback secret.
- All token flows (access, MFA, prelaunch, OAuth state) sign with this single secret,
  so one rotation covers them all.
- The old plaintext value may still exist in old zip snapshots / checkpoints. Removing
  those does not un-compromise it — only rotation does. Do not reuse the old value anywhere.
