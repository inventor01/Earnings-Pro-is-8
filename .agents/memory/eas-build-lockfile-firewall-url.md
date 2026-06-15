---
name: EAS build fails on package-firewall.replit.local URLs in lockfile
description: Why npm ci fails on EAS Build with ENOTFOUND and how to fix the lockfile
---

# EAS Build `npm ci` fails: ENOTFOUND package-firewall.replit.local

When you `npm install` a new dependency **inside the Replit container**, npm resolves it
through Replit's internal proxy and writes that proxy URL into `package-lock.json`:
```
"resolved": "http://package-firewall.replit.local/npm/<pkg>/-/<pkg>-<ver>.tgz"
```
That hostname only exists inside Replit. On **EAS Build** servers, `npm ci --include=dev`
tries to fetch it and dies with `npm error code ENOTFOUND ... getaddrinfo ENOTFOUND
package-firewall.replit.local`. The build fails before any native compilation.

## Fix
Rewrite the offending `resolved` URL(s) to the public registry — the `integrity` sha512
is a content hash of the same tarball, so it stays valid and does NOT need changing:
```
http://package-firewall.replit.local/npm/  ->  https://registry.npmjs.org/
```
Check with `rg -c "package-firewall.replit.local" package-lock.json` and fix every hit.

**How to apply:** any time a new npm dep is added in the Replit env and the app is built
on EAS (or any CI outside Replit), scan `package-lock.json` for `package-firewall.replit.local`
BEFORE triggering the build. Pure JS OTA (`eas update`) doesn't `npm ci`, so it isn't hit —
this only bites real `eas build` runs.
