---
name: EAS build fails on Replit npm-proxy lockfile URLs
description: Installing npm packages via Replit tooling writes package-firewall.replit.local URLs into package-lock.json, which breaks EAS builds at INSTALL_DEPENDENCIES.
---

Rule: before any `eas build`, check `earnings-ninja-expo/package-lock.json` for ALL `package-firewall.replit.local` occurrences and rewrite to `registry.npmjs.org`. There are TWO URL schemes — always run both:

```
# https variant (most common)
sed -i 's|https://package-firewall\.replit\.local|https://registry.npmjs.org|g' earnings-ninja-expo/package-lock.json
# http variant (older packages — missed by the https-only fix)
sed -i 's|http://package-firewall\.replit\.local/npm|https://registry.npmjs.org|g' earnings-ninja-expo/package-lock.json
# verify
grep -c 'package-firewall' earnings-ninja-expo/package-lock.json  # must be 0
```

**Why:** Replit's package proxy rewrites tarball URLs in the lockfile when installing packages inside the workspace. EAS build workers run `npm ci` outside Replit and get `getaddrinfo ENOTFOUND package-firewall.replit.local`, failing the build ~2 min in at Prebuild/Install-dependencies with "Unknown error." Older packages in the dep tree use `http://` not `https://`, so a single-pattern sed silently leaves them behind — the build keeps failing.

**How to apply:** run both sed commands before every EAS build. Integrity hashes are unchanged by the host rewrite so `npm ci` still verifies correctly. Also add `.easignore` excluding `dist/ android/ ios/` to avoid uploading locally-generated artifacts.

**Play Submit note:** `eas submit --profile play` can fail with "Fastlane supply failed" if the Play internal test track has no testers configured or the service account lacks permissions. If EAS submit fails, download the AAB from expo.dev/… and upload manually in Play Console → Internal testing.
