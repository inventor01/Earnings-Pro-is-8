---
name: Web domain routing
description: Who actually serves earningsninja.com / .app — Replit deployment vs Railway — and how to ship landing changes to each.
---

# Web domain routing (corrected Aug 3, 2026)

- **earningsninja.com (apex) is served by THIS repl's Replit deployment** (vm, public, port 5000 uvicorn). Verified via getDeploymentInfo(): primaryUrl = https://earningsninja.com, plus earnings-ninja.replit.app. The apex resolves to 34.111.179.208 (Google front end = Replit), NOT Railway (Railway edges are 69.46.x.x). Earlier note claiming apex = Railway was WRONG — both run uvicorn, which caused the confusion.
- **Railway** hosts the backend the mobile app talks to (hardcoded URL), at earnings-pro-is-8-production.up.railway.app. Railway auto-deploys on git push to GitHub main (~5–10 min). Railway also has custom domains earningsninja.com/www registered, but apex DNS never pointed there (dnsRecords currentValue empty).
- **Consequence: shipping a landing change needs BOTH** (1) gitPush → Railway, and (2) user republishes the Replit deployment (deployment build runs `cd landing && npm ci && npm run build`; run = uvicorn backend.app:app on 5000).
- **Waitlist signups on earningsninja.com land in the Replit production Postgres** (this repl's prod DB, table waitlist_signups) — a DIFFERENT database from Railway's. Mobile-app data lives on Railway's DB.
- **gitPush callback does NOT commit dirty files** despite accepting commitMessage and returning success — `git add … && git commit` manually first, then gitPush (raw `git push` fails auth).
- www.earningsninja.com CNAMEs to Railway (ygne5acl.up.railway.app).
- executeSql with environment:"production" is READ-ONLY (DELETE rejected).

**How to apply:** any "update the website" request → build landing, commit dist, gitPush, then SuggestUserAction(deploy) so the user republishes; verify apex via curl title/etag, not just Railway URL.
