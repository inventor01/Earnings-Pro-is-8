---
name: Dependency vulnerability triage (where they live + safe fix)
description: Why the scary dep-audit numbers are build-tooling-only, where they live, and the safe non-major fix boundary.
---

# Dependency vulns are all in the Expo app's transitive build tooling

**Rule:** Treat the workspace dependency-audit total as low real risk. Findings are
concentrated in `earnings-ninja-expo/` and are transitive build-tooling deps
(minimatch, ws, undici, tar, shell-quote, @xmldom/xmldom, brace-expansion, postcss,
@babel/core, js-yaml, uuid) of Expo/Metro/EAS — not direct/runtime deps, not in the
Python backend.

**Why:** `npm audit` (GitHub advisory DB) reports 0 for `frontend/`, `landing/`, and
root; only the Expo project shows findings. Impact is build-time DoS/ReDoS, not
reachable from the shipped iOS app or the API, and Apple does not scan npm
devDependencies.

**How to apply:**
- Safe (non-major) remediation = `npm audit fix` **without** `--force` in
  `earnings-ninja-expo`. It only touches `package-lock.json`, never `package.json`.
- What's left after that needs major bumps (uuid→11, js-yaml 3→4) via `--force`;
  defer unless explicitly asked — build-time-only, breakage risk not worth it.
- Always re-verify any Expo lockfile bump with `npx tsc --noEmit` and
  `npx expo export --platform ios` (both exit 0). The lockfile diff can be thousands
  of lines for a few transitive bumps — those two checks are the real gate.

# Backend pins that look "wrong" but aren't

`fastapi`/`starlette` pins can trip outdated reviewers: by 2026 FastAPI (0.138.x) runs
on the **Starlette 1.x** line, so `starlette==1.3.1` is correct, not a 0.x typo.
Source of truth = the running Backend API workflow + installed versions, not a
reviewer's prior-era assumption. `deployment/` mirrors root but is archived/non-served
(the `.replit [deployment]` run launches `backend.app:app` directly).

# `npm audit fix` has two EAS-build side effects — handle before building

Running `npm audit fix` in `earnings-ninja-expo` (even non-force) does two things
beyond the intended vuln fix, both of which bite EAS builds/OTA:

1. **Re-injects firewall URLs into the lockfile.** It re-resolves through the Replit
   package proxy, rewriting `"resolved"` entries to
   `http://package-firewall.replit.local/npm/...`. These break EAS `INSTALL_DEPENDENCIES`.
   **Fix before any `eas build`:**
   `sed -i 's#http://package-firewall\.replit\.local/npm/#https://registry.npmjs.org/#g' package-lock.json`
   then confirm `grep -c replit.local package-lock.json` == 0.

2. **Bumps Expo native-module patch versions** (e.g. expo 54.0.34→54.0.35,
   @bacons/apple-targets, expo-font) within their semver ranges. This **changes the
   native fingerprint**, so the tree no longer matches previously-built binaries and
   OTAs won't land on them — verify with `eas fingerprint:compare --build-id <id>`.
   If it differs, you must cut a NEW build (bump `app.json` ios.buildNumber first,
   since the testflight profile has autoIncrement:false) for OTAs to land going forward.
