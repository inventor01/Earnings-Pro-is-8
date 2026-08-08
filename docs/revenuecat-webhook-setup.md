# RevenueCat webhook setup (server-side Pro verification)

The backend now keeps its own record of who is Pro (`auth_users.pro_entitlement_*`),
updated by a RevenueCat webhook and verified on demand via the RevenueCat REST
API. Client-side gating stays fail-open for UX; the server is the enforcement
backstop (Pro-only API behavior uses the `require_pro` dependency in
`backend/entitlements.py` and returns a plain 403 for non-Pro users).

## What you must configure (one-time, in the RevenueCat dashboard)

1. **Generate a webhook auth secret** (any long random string), e.g.:
   `python -c "import secrets; print(secrets.token_urlsafe(32))"`
2. **Set it on the backend** as the `REVENUECAT_WEBHOOK_AUTH_TOKEN` environment
   variable (Railway → your backend service → Variables). Without it the
   webhook endpoint refuses all deliveries (503, fail closed).
3. In the RevenueCat dashboard: **Project settings → Integrations → Webhooks →
   + New webhook**, then enter:
   - **Webhook URL:** `https://<your-backend-domain>/api/revenuecat/webhook`
     (the Railway backend URL — the same host the app's `API_BASE` points at).
   - **Authorization header value:** the exact secret from step 1.
   - Leave the event selection at the default (all events); the backend
     ignores types it doesn't care about.
4. Optional: use the dashboard's "Send test event" — the backend answers 200
   (`handled: false` for TEST events).

Already configured (no action needed): `REVENUECAT_SECRET_API_KEY`, which the
backend uses for the on-demand REST fallback (`GET /v1/subscribers/{id}`) when
stored state is missing or stale.

## How it behaves

- **Webhook events:** INITIAL_PURCHASE / RENEWAL / UNCANCELLATION /
  PRODUCT_CHANGE / NON_RENEWING_PURCHASE mark the user Pro (with the event's
  expiry); EXPIRATION and refunds (REFUND, or CANCELLATION with reason
  CUSTOMER_SUPPORT) revoke immediately; TRANSFER revokes the source account
  immediately and re-verifies the destination via the REST API (failing
  closed until verifiable); plain CANCELLATION / BILLING_ISSUE change nothing until expiry.
  Out-of-order/replayed deliveries are dropped via the event timestamp.
  Unknown users or event types are logged and acknowledged with 200.
- **`GET /api/subscription/status`** (authenticated) returns the server's view
  (`is_pro`, expiry, last update source) and transparently re-checks
  RevenueCat when the stored state is missing, >24h old, or past its expiry.
## Pro-only API inventory (server-enforced)

Authoritative list of backend behavior gated with `Depends(require_pro)`
(`backend/entitlements.py`). **Any future endpoint that exclusively serves a
Pro feature must use this dependency** — client gating alone is presentation,
not enforcement.

| Endpoint | Feature |
| --- | --- |
| `GET /api/suggestions` | AI Suggestions (sold as Pro on the paywall) |

Not gated (intentionally): entries/rollup/goals/dashboard etc. serve both free
and Pro features; CSV export and advanced-analytics *rendering* happen fully
client-side from data free users can already access, so there is no separate
server surface to gate today.

- The RevenueCat `app_user_id` is the backend user id (the app calls
  `Purchases.logIn(user.id)`), so events map directly to `auth_users.id`.
  Events for anonymous SDK ids (`$RCAnonymousID:…`) are acknowledged and
  ignored.
