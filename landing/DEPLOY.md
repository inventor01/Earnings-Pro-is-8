# Deploying the Landing Site as a Separate Replit Deployment

This site is built to be a **second, separate deployment** from the FastAPI backend that lives in `backend/`. Don't change the existing `.replit` `[deployment]` block — that one is what serves the backend (`/api/*`, `/privacy`, `/support`) and the iOS app would break without it.

Instead, add a brand-new deployment alongside it.

## One-time setup (from the Publishing UI)

1. Open the **Publishing** tool in the left sidebar.
2. Click **Create deployment** (or **+ New deployment** if you already have the backend one).
3. Pick **Static** as the deployment type.
4. Configure these three fields exactly:

   | Field            | Value                                |
   | ---------------- | ------------------------------------ |
   | Build command    | `cd landing && npm ci && npm run build` |
   | Public directory | `landing/dist`                       |
   | Custom domain    | *(optional — e.g. `earningsninja.app`)* |

5. Click **Publish**.

The first build will install deps + run `vite build` and serve `landing/dist/index.html` from Replit's CDN. Re-publish whenever you push changes to `landing/`.

## What about the footer's `/privacy` and `/support` links?

Those are served by the **backend** deployment, not this one. If the two deployments end up on different domains (e.g. landing on `earningsninja.app` and backend on `api.earningsninja.app`), the footer links will 404.

Two ways to fix:

- **Best**: put both behind the same parent domain via Replit custom domains — landing on `earningsninja.app/`, backend on `earningsninja.app/api/*`, `/privacy`, `/support`. The links Just Work.
- **Quick fix**: edit `landing/src/App.tsx` and change `PRIVACY_URL` / `SUPPORT_URL` to fully-qualified backend URLs (e.g. `https://earnings-pro-is-8-production.up.railway.app/privacy`).

## Local preview

```bash
cd landing && npm run dev   # http://localhost:5173
cd landing && npm run build && npm run preview   # production build preview
```

## Build size baseline (so you'll notice if it bloats)

- `index.html` — 1.0 KB
- CSS — 19 KB (4.5 KB gzipped)
- JS — 165 KB (52 KB gzipped)
- **Total — ~188 KB on disk, ~57 KB over the wire**
