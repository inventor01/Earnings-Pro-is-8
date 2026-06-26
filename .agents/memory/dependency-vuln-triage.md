---
name: Dependency vulnerability triage (where they live + safe fix)
description: Why the scary "50 vulns / 1 critical" dep-audit number is build-tooling-only, where it lives, and the safe non-major fix.
---

# Dependency vulns are all in the Expo app's transitive build tooling

The workspace dep-audit numbers look alarming but are concentrated and low real risk:

- `npm audit` (GitHub advisory DB) reports **0 vulnerabilities** for `frontend/`,
  `landing/`, and the root project. All findings live in **`earnings-ninja-expo/`**.
- They are **transitive build-tooling** deps of Expo/Metro/EAS (minimatch, ws,
  undici, tar, shell-quote, @xmldom/xmldom, brace-expansion, postcss, @babel/core,
  js-yaml, uuid), NOT direct/runtime deps and NOT in the Python backend. Impact is
  mostly DoS/ReDoS at build time — **not reachable from the shipped iOS app or the
  API**, and Apple does not scan npm devDependencies.

**Safe fix (non-major):** `cd earnings-ninja-expo && npm audit fix` (NO `--force`).
This stays within compatible semver, leaves `package.json` untouched (only
`package-lock.json` churns), and does NOT apply majors. It resolved the lone
"critical" + several others.

**What remains needs majors (intentionally deferred):** `uuid` 3/7/8 → 11 and
`js-yaml` 3 → 4. These require `npm audit fix --force` (breaking) and are build-time
only, so not worth the breakage risk for App Store work.

**Always re-verify after a lockfile bump on the Expo app:** `npx tsc --noEmit`
(exit 0) + `npx expo export --platform ios` (exit 0). The lockfile diff can be huge
(thousands of lines) even for a few transitive bumps — tsc+export are the real check.

**Note:** `frontend/dev-dist/` (vite-plugin-pwa workbox/sw.js) are generated build
artifacts the running Frontend dev server rewrites; they cause noisy git diffs and
false-positive SAST hits. They should be gitignored, not committed.
