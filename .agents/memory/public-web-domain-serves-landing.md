---
name: Public web domain serves landing, not the webapp
description: The public Replit web deployment intentionally serves landing/, not the frontend/ React webapp.
---

# Public web domain serves the landing site, not the webapp

The public web deployment (Replit `[deployment]`) builds and serves the marketing
**landing/** site. The old **frontend/** React webapp is intentionally NOT deployed
to the domain anymore.

**Why:** Product decision — the domain should be a marketing / sales-signup page,
not the in-app webapp. (The actual app is the Expo iOS client, whose API is the
separate Railway backend.)

**How it works / how to apply:**
- `.replit` `[deployment].build` runs the landing build (`cd landing && npm ci && npm run build`); the run command is still the FastAPI backend (so backend-hosted `/privacy` + `/support` legal pages, Apple-required, keep working).
- `backend/app.py` lists `landing/dist` (and `/app/landing/dist`) as the FIRST `_possible_dist` candidates, so it static-serves the landing build. A `_SPAStaticFiles` fallback returns `index.html` for unknown paths (history-API routes like `/upgrade`) but EXCLUDES `/api/*` so unknown API paths still return real 404 JSON — the mobile/Railway backend depends on that.
- Do NOT "fix" the deployment back to building/serving `frontend/`. The webapp source still exists but is dead at the domain by design.
- Deployment-config changes only take effect after the user publishes from the main repl.
