---
name: Railway managed via project-scoped API token
description: How to change Railway prod env vars / redeploy programmatically, and the state after the Aug 2026 security hardening.
---

# Railway API management (project token)

The `Railway_Token` Replit secret is a **project token** (not account token):
authenticate GraphQL (`https://backboard.railway.app/graphql/v2`) with header
`Project-Access-Token: <token>`; `me{}` queries return Not Authorized.
Discover ids via `query { projectToken { projectId environmentId } }`.
Backend service is named `Earnings-Pro-is-8`; there is also a `Postgres` service.

- Change env vars: `variableUpsert(input:{projectId, environmentId, serviceId, name, value})`,
  then `serviceInstanceRedeploy(environmentId, serviceId)` — var change alone does not redeploy.
- Poll `deployments(input:{...}, first:1)` for SUCCESS.

**Aug 2026 hardening state:** prod `JWT_SECRET_KEY` rotated (old leaked value dead;
all prior tokens invalidated). Git history rewritten to purge tracked *.zip
snapshots (force-pushed; pre-rewrite history preserved on GitHub branch
`backup-before-history-purge`). Demo-account script requires `DEMO_PASSWORD`
from env — the old reviewer password `ReviewMe2026!`-era credential still works
on prod until the server demo account is retired/rotated.

**How to apply:** any prod config change or secret rotation can be done from the
repl via this API — no dashboard access needed. After a git history rewrite,
resync the workspace repo with fetch + `reset --hard FETCH_HEAD` (trees identical).
