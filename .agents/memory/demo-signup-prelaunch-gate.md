---
name: Demo/Signup 403 = prelaunch gate
description: Why /api/auth/demo and /api/auth/signup return 403 in some environments
---

`POST /api/auth/demo` and `POST /api/auth/signup` return **403 Forbidden** whenever the
backend env var `PRELAUNCH_ACCESS_CODE` is set. This is the prelaunch access gate, NOT a bug.

**Why:** `_require_prelaunch_token()` in `backend/routers/auth_routes.py` raises 403 if a
valid `prelaunch_token` (issued by `/api/waitlist/verify-access`) is missing while
`PRELAUNCH_ACCESS_CODE` is configured. When the env var is unset, the gate is a no-op and
demo/signup work without a token.

**How to apply:** If demo mode or signup "fails" with 403 (e.g. mobile `api.demo()` which
sends no token, or QA in a prelaunch-configured backend), check `PRELAUNCH_ACCESS_CODE`
before assuming app-code breakage. The web `PrelaunchPage` flow obtains the token; the mobile
demo button does not, so mobile demo requires prelaunch mode to be OFF on that backend.
