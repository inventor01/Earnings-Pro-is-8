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

## In-app legal links MUST use API_BASE, never the vanity domain

Apple rejected the app (3.1.2c) because the paywall's Privacy Policy link pointed at
`https://earningsninja.app/privacy`, which returns **404** — the vanity domain serves
the static landing deploy, and the legal pages (`/privacy`, `/support`) are served only
by the Railway backend.

**Why:** Apple taps every legal link during review; a dead privacy link in a
subscription purchase flow is an automatic rejection.

**How to apply:** any in-app link to legal pages must be `${API_BASE}/privacy` (the
mobile app's backend base, which is Railway in store builds). Terms of Use uses
Apple's standard EULA URL (`apple.com/legal/internet-services/itunes/dev/stdeula/`).
Before any submission, `curl -L` every URL that appears in-app AND in ASC metadata
and require HTTP 200. The ASC "Privacy Policy URL" field must also point at a live
200 URL (Railway `/privacy`) until the vanity domain proxies the backend legal pages.

## Railway Docker build: landing/dist is pre-built and committed

Railway's Metal builder repeatedly failed `npm ci` inside the Dockerfile's
node:20-alpine stage (npm error mid-install; vite never installed; exit 127 at
`vite build`) even with `--include=dev` + NODE_ENV=development.

**Decision:** the Dockerfile has NO node stage. `landing/dist` is committed to
git (negation rules at the bottom of .gitignore) and COPY'd straight into the
image.

**How to apply:** after any landing/ change, run `cd landing && npm run build`
and commit the refreshed `landing/dist` BEFORE the user pushes to GitHub for a
Railway deploy — otherwise prod serves the stale site.
