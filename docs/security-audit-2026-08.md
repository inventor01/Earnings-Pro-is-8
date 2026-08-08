# Earnings Ninja — Production Security Audit

_Date: 2026-08-08 · Scope: full (secrets, backend/API/auth/db, mobile client, payments, infra, dependencies) · Method: read-only static review + subagent deep-dives. No code was changed._

---

## 1. Executive summary

The app is in **better shape than a typical vibe-coded project**. The backend gets the fundamentals right: JWT verification has no hardcoded fallback secret, `/docs` and `/redoc` are disabled in production, CORS is an explicit allowlist (not `*`), all inspected data routes enforce `Depends(get_current_user)` with per-user ownership filters (no IDOR found), request schemas don't accept `user_id`/`is_admin`/`is_pro` (no mass-assignment), and no raw-SQL injection surface exists. No live secrets are committed to git.

The real risks cluster in three places: **(1)** the production JWT secret and prelaunch code live in plaintext repl config, **(2)** Pro entitlement is enforced **only on the client and fails open**, with **no server-side verification and no RevenueCat webhook**, and **(3)** OAuth ships with hardcoded demo credentials + `http://localhost` redirects as env-fallbacks.

**Production-readiness: conditional.** Ship-blocking items are the two 🔴 below; the 🟠 items should follow shortly after.

**Security score: 72 / 100.**

---

## 2. Findings by severity

### 🔴 Critical

**C-1 — Production JWT secret & prelaunch code stored in plaintext repl config**
- **Files:** `.replit:120-121` (`JWT_SECRET_KEY`, `PRELAUNCH_ACCESS_CODE`).
- **Risk:** `.replit` is gitignored (not in git history — good), but it holds the actual signing secret in cleartext. Anyone who the repl is shared with, or anyone who forks it, obtains the key.
- **Attack scenario:** With `JWT_SECRET_KEY`, an attacker forges a valid JWT for **any** `sub` (user id) → full account impersonation of every user, bypassing login entirely. If this same value is the one Railway production uses, the exposure is live, not theoretical.
- **Root cause:** Secret kept in a config file instead of the secrets manager.
- **Fix:** Move `JWT_SECRET_KEY` and `PRELAUNCH_ACCESS_CODE` into Replit Secrets / Railway environment variables, remove them from `.replit`, and **rotate the JWT secret** (rotating invalidates all existing tokens — users re-login once).
- **Verify:** `grep JWT_SECRET_KEY .replit` returns nothing; backend still boots reading it from env; old tokens rejected.

**C-2 — Pro entitlement is client-only, fails open, with no server verification**
- **Files:** `earnings-ninja-expo/lib/revenuecat.tsx:276-277,415-420` (`requirePro()` returns `true` when RevenueCat is unavailable); consumers in `app/(tabs)/index.tsx:3361-3369,3436-3446,4762-4766`; backend has **no** entitlement-verification route and **no** RevenueCat webhook.
- **Risk:** Premium status is derived solely from client-side `CustomerInfo.entitlements.active['pro']` held in React state. It's never checked server-side.
- **Attack scenario:** (a) A rooted/modified client or JS tampering forces `isPro = true` → all premium features unlocked without paying. (b) Any RevenueCat/native-module/store outage makes `requirePro()` return `true`, so gates open for everyone during the outage.
- **Impact:** Revenue loss / subscription bypass. (Note: this is a *feature* bypass, not a data-authorization bypass — no premium data endpoints exist server-side yet, which is also why the fix matters before you add any.)
- **Fix:** Add a RevenueCat webhook endpoint (validate the configured Authorization/signing secret, constant-time compare, idempotent updates) that persists entitlement + expiry per authenticated user; enforce Pro on every premium **backend** operation; treat the client flag as presentation only. For sensitive client gates, **fail closed** with an explicit retry/unavailable state instead of granting access.

### 🟠 High

**H-1 — OAuth ships hardcoded demo credentials and `http://localhost` redirect fallbacks**
- **Files:** `backend/routers/oauth.py:16-24` (`demo_uber_client`/`demo_uber_secret`, `demo_shipt_*`, `http://localhost:5000/...` redirect URIs as `os.getenv` defaults).
- **Risk:** A deployment missing these env vars silently runs OAuth with publicly-known credentials and an insecure HTTP callback, enabling misconfiguration and callback interception.
- **Fix:** Fail startup if production OAuth secrets/redirect URIs are unset; remove the demo fallbacks; require HTTPS allowlisted redirect URIs.

**H-2 — Web builds store bearer JWT in AsyncStorage/localStorage** — ✅ Resolved / downgraded to Low (2026-08-08)
- **Files:** `earnings-ninja-expo/lib/tokenStorage.ts:21,30` (native uses SecureStore — good; web falls back to AsyncStorage → `localStorage`); `frontend/src/lib/authContext.tsx`, `frontend/src/lib/api.ts`.
- **Risk:** On any web/Expo-web deployment the auth token is readable by any XSS payload. (Native iOS/Android are fine.)
- **Status (2026-08-08):** **The web app is not shipped.** The public domain (earningsninja.com) serves only the static landing site (`landing/dist`, SPA-served by the backend with `/api` excluded); the React web app in `frontend/` is not deployed anywhere in production, and the Expo web target is not published. This drops the finding to Low per the original assessment.
- **Hardening applied anyway:** `frontend/` now stores the auth JWT in **sessionStorage** (per-tab, cleared on tab close) instead of persistent `localStorage`, and purges any previously persisted `localStorage` token on load (`frontend/src/lib/authContext.tsx`, `api.ts`, `SettingsDrawer.tsx`, `PointsCard.tsx`). This limits token persistence if the dormant app is ever revived.
- **Future work (if web ships):** move web auth to an HttpOnly+Secure cookie session flow (backend change); sessionStorage still exposes the token to active XSS, it only removes persistence.

### 🟡 Medium

**M-1 — Verbose error text returned to callers**
- **Files:** `backend/routers/oauth.py:153-154,226-227` and `backend/routers/rollup.py:39-40,62-63` return `detail=str(e)` / f-string with `str(e)` for arbitrary exceptions.
- **Risk:** Leaks internal/parser/upstream error details to (sometimes unauthenticated) callers.
- **Fix:** Return fixed generic validation messages; log the real exception server-side with a correlation id.

**M-2 — Database TLS not enforced in code**
- **Files:** `backend/db.py:6-43` requires `DATABASE_URL` and refuses ephemeral SQLite (good), but adds no `sslmode=require`.
- **Risk:** If a production URL without TLS is ever supplied, traffic to Postgres is unencrypted. (Neon enforces TLS by default, so likely OK today — but code doesn't guarantee it.)
- **Fix:** Enforce/verify `sslmode=require` (or provider equivalent) for production URLs; reject non-TLS production URLs.

**M-3 — CORS regex allows all `*.replit.app` / `*.replit.dev`**
- **Files:** `backend/app.py:540-560` — explicit allowlist + credentials enabled (good), but the regex trusts any Replit subdomain.
- **Risk:** With `allow_credentials=True`, any page on a Replit subdomain is a trusted cross-origin. Low practical risk but wider than needed.
- **Fix:** Narrow to owned production origins for the credentialed path.

### 🟢 Low / Info

- **L-1** `/api/health` (`backend/routers/health.py:5-7`) is unauthenticated liveness only — fine; keep it free of diagnostic data and rate-limit if externally reachable.
- **L-2** Public RevenueCat SDK keys in `eas.json` / `revenuecat.tsx` (`goog_…`, `appl_…`) — these are **meant** to be public client keys; not a finding, but never treat them as a trust boundary.
- **L-3** Committed source zips at repo root (`earnings-ninja-*.zip`, `earnings-ninja-deploy.zip`, `store-previews/*.zip`) bloat the repo and risk shipping stale/secret-bearing snapshots. Recommend removing from tracking.
- **L-4** `.replit` dev workflow uses `--reload`; ensure Railway/Docker production does not (confirmed: `Dockerfile`/`railway.json`/`start.sh` don't).

---

## 3. Audit negatives (verified NOT vulnerable)

- **JWT:** `backend/auth.py:15-18` requires `JWT_SECRET_KEY` (no hardcoded fallback), HS256 explicit, `sub`/`exp` required, expiry validated by PyJWT; password/email change timestamps revoke older tokens.
- **IDOR / authorization:** all inspected data routes use `Depends(get_current_user)` + ownership predicates; none allow reading/writing another user's rows via arbitrary id.
- **Mass assignment:** create/update schemas (`backend/schemas.py`) don't accept `user_id`/`is_admin`/`is_pro`; owner set from the authenticated user.
- **SQL injection:** only fixed migration DDL uses raw SQL; no user-input interpolation.
- **Secrets in git:** `.env.production` files contain only `${VAR}` placeholders; the Google Play service-account JSON is **not** tracked; `driver_ledger.db` is **not** tracked (gitignored) and shows no user rows.
- **API docs:** `/docs` and `/redoc` disabled in production (`backend/app.py:512`).
- **Dependencies:** (per prior audit) all dependency CVEs are in `earnings-ninja-expo` transitive **build tooling** — 0 in `frontend`/`landing`/root runtime; build-time only.

---

## 4. Prioritized remediation checklist

1. **[🔴 C-1]** Move `JWT_SECRET_KEY` + `PRELAUNCH_ACCESS_CODE` to secrets manager and rotate the JWT secret.
2. **[🔴 C-2]** Add server-side RevenueCat verification + webhook; make premium gates fail closed.
3. **[🟠 H-1]** Remove OAuth demo-credential/localhost fallbacks; require prod values + HTTPS redirects.
4. **[🟠 H-2]** ✅ Done (2026-08-08): confirmed web isn't shipped (domain serves landing only) and moved `frontend/` token storage to sessionStorage; HttpOnly cookie flow noted as future work if web ever ships.
5. **[🟡 M-1]** Stop returning `str(e)` to clients; log server-side.
6. **[🟡 M-2]** Enforce Postgres TLS in code.
7. **[🟡 M-3]** Narrow credentialed CORS to owned origins.
8. **[🟢]** Remove committed zips from tracking; add a CI check blocking `*.db`/secret commits.
