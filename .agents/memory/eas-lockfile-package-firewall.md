---
name: EAS build fails on Replit npm-proxy lockfile URLs
description: Installing npm packages via Replit tooling writes package-firewall.replit.local URLs into package-lock.json, which breaks EAS builds at INSTALL_DEPENDENCIES.
---

Rule: before any `eas build`, check `earnings-ninja-expo/package-lock.json` for `package-firewall.replit.local` and rewrite those `resolved` URLs to `https://registry.npmjs.org`:

```
sed -i 's|http://package-firewall.replit.local/npm|https://registry.npmjs.org|g' earnings-ninja-expo/package-lock.json
```

**Why:** Replit's package proxy rewrites tarball URLs in the lockfile when installing packages inside the workspace. EAS build workers run `npm ci` outside Replit and get `getaddrinfo ENOTFOUND package-firewall.replit.local`, failing the build ~2 min in at INSTALL_DEPENDENCIES with "Unknown error. See logs of the Install dependencies build phase."

**How to apply:** any time a new npm dependency was added on Replit since the last successful EAS build, grep the lockfile before kicking off. Integrity hashes are unchanged by the host rewrite, so the sed fix is safe.
