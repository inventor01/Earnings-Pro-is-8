---
name: web domain routing (earningsninja.app)
description: How the public web domain is served vs. the Railway backend vs. the Replit deployment, and why repointing the domain is safe for the mobile app.
---

# earningsninja domain routing

- Branding moved to **earningsninja.com** (Jul 24): landing og tags + all support@ emails now use .com; user must point earningsninja.com DNS at the chosen host and set up the .com mailbox.

- `earningsninja.app` is **not** served by the Replit deployment. It 301-redirects to
  the Railway app (`earnings-pro-is-8-production.up.railway.app`). Clicking "Publish"
  in Replit does **not** change what `earningsninja.app` shows.
- Railway deploys from the GitHub repo `inventor01/Earnings-Pro-is-8` (`origin`).
  The Replit workspace's local `main` runs far ahead of `origin/main` — recent work is
  **not** pushed to GitHub, so Railway runs an old build. The agent cannot push/fetch
  (production git is blocked in main agent).
- The Railway `Dockerfile` builds the static site that the web domain serves. It used to
  build the old `frontend/` webapp (the "coming soon" page); it now builds `landing/`.
- The **mobile app hardcodes the Railway URL directly** (`lib/api.ts` `API_BASE` =
  `https://earnings-pro-is-8-production.up.railway.app`), NOT `earningsninja.app`. So the
  web domain can be repointed to a different host **without affecting the mobile app**.

## Serving the landing site
- The landing site (`landing/`) is **purely static** (no API calls).
- BUT `/privacy` and `/support` (Apple-required legal pages) are served by the **backend**
  from `backend/legal/*.html`, and are NOT in `landing/dist`. The backend also adds an
  SPA fallback so `/upgrade` (client-side route) resolves on hard refresh.
- **Therefore the landing site cannot be a pure `static` Replit deployment** — it must be a
  `vm` deployment running the FastAPI backend (which serves landing/dist + legal + SPA
  fallback). Verified working at `https://earnings-ninja.replit.app` (`/`, `/upgrade`,
  `/privacy`, `/support` all HTTP 200).

**Why:** to make `earningsninja.app` show the new landing page without redeploying the
production backend, repoint the domain (DNS/custom-domain) from Railway to the Replit
deployment — the mobile app is unaffected because it talks to Railway directly.
