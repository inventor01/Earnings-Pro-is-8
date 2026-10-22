# Earnings Ninja security QA — 21 October 2026

Reviewed from main commit `e765111e84e1bacb4569b2b8d52d78fc6090c257`. Changes are on `codex/security-qa-20261021`.

## Fixes

- Access-token validation now rejects OAuth state, MFA, prelaunch and other token categories. New sessions explicitly identify their purpose; existing uncategorized access tokens remain supported.
- Password resets and login-email changes revoke older sessions at full timestamp precision, including tokens issued earlier in the same second. Missing/invalid issuance times fail revocation checks. Login and MFA exchanges cannot mint a usable session across a concurrent password change.
- MFA challenges bind to the current server-side code generation. Old/resubmitted challenges, replaced codes and consumed codes cannot be replayed. Conditional database updates enforce attempt and resend limits across workers. Resends cannot extend the original verification deadline. Enabling MFA never returns a login token.
- Signup and password-reset validation enforce bcrypt's UTF-8 byte limit before hashing or consuming a reset token, preventing oversized-password server errors.
- Malformed subscription expiries cannot become lifetime Pro access. Purchases must explicitly include the Pro entitlement before granting access. Malformed webhooks are rejected without mutation. Event watermarks require valid timestamps. Production PostgreSQL row locks serialize lifecycle updates; an older REST response cannot overwrite a newer webhook. Stale active entitlements are rechecked when RevenueCat is configured.
- OAuth query parameters are properly URL encoded.
- EAS archives explicitly exclude local credentials, signing keys, environment files and dependencies.
- Compatible dependency patches include XML parsing, CSS processing, compression, shell quoting, tar handling and UUID fixes. Unused Vitest tooling was removed from the legacy web app. Lockfiles use HTTPS npm registry URLs instead of a private Replit HTTP mirror.
- The Python 3.11 CI runner exposed an inherited vulnerable setuptools version. Requirements now enforce setuptools 83 or later, and CI/container builds upgrade their package-installation tooling before installing the backend.
- CI runs backend regressions, a production-container build/import check, mobile type checking/tests/iOS export, both web builds, Python auditing (including Gunicorn) and the reviewed npm advisory gate. Existing secret scanning remains enabled. The mobile test environment now sets UTC consistently.

## Verification

| Check | Result |
|---|---|
| Backend tests | 213 passed; baseline 173 passed |
| Mobile TypeScript | Passed |
| Mobile Jest | 191 tests in 23 suites passed |
| Expo iOS production export | Passed, Hermes bundle generated |
| Landing and legacy web production builds | Both passed |
| Dependency-gate regressions | 3 passed |
| Python `pip-audit` | No known vulnerabilities in the resolved QA environment |
| Gitleaks 8.30.1 current-source scan | No leaks detected; official release digest verified |
| Bandit | No high-severity findings; four medium/low-confidence findings reviewed: three fixed-literal migration statements and one escaped HTML email, not attacker-controlled SQL |

The same security fixes were merged into the existing local TestFlight source using a three-way merge, preserving its unpublished app features. That source separately passed **243 backend tests, 231 mobile tests in 32 suites, TypeScript checking and an iOS production export**. Its existing credential/archive exclusions were preserved. Original versions of changed local files were backed up before applying the merge.

Python checks used an isolated Python 3.13 environment with the updated SQLAlchemy 2.0.55 pin. CI and the production Dockerfile use Python 3.11. Tests used disposable SQLite databases and disabled outbound email/network calls. PostgreSQL concurrency behavior is guarded in code but was not exercised against a live PostgreSQL service. The iOS export verifies JavaScript/assets, not an Xcode archive, signing, installation or physical-device behavior. Production was not mutated during QA.

## Remaining upstream dependency findings

`npm audit` reports affected packages and their dependent ancestors separately. The counts below are dependency-graph entries, not distinct vulnerabilities.

| Project | Before | After | Critical after |
|---|---:|---:|---:|
| Root | 10 | 0 | 0 |
| Expo mobile | 75 | 58 | 0 |
| Legacy frontend | 27 | 11 | 0 |
| Landing | 12 | 5 | 0 |

The remaining entries trace to these six advisories. They are documented exceptions, not repaired vulnerabilities. `scripts/audit-dependencies.mjs` permits only these exact package versions, advisories and projects. New findings, incomplete audits and any critical severity fail CI.

| Package/version | Exposure and constraint | Follow-up |
|---|---|---|
| `braces` 3.0.3 | Build/test glob parsing in Metro, Jest and Tailwind; no patched release at review time. Patterns come from repository/tool configuration. | Update when patched; keep development servers private and review imported build configuration. [Advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) |
| `decode-uri-component` 0.2.2 | Expo Router 6 imports it through CommonJS `query-string`. The inspected Router call sites only invoke `stringify`, not the vulnerable decoder. Patched 0.5 is ESM and cannot be substituted blindly into that CommonJS API. | Upgrade Router with a supported Expo SDK migration and rerun deep-link/device tests. [Advisory](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr) |
| `image-size` 1.2.1 | Metro's local build-asset parser expects the v1 callable export. Patched v2 changes the export/API; a global override breaks that consumer. This path is not the native app's remote-image decoder. | Upgrade Metro/Expo together; accept only reviewed local assets in builds. [JXL/HEIF advisory](https://github.com/advisories/GHSA-5p2g-fcmc-qvqq), [ICNS advisory](https://github.com/advisories/GHSA-w3rx-r6r6-pgpr) |
| `node-forge` 1.4.0 | Expo CLI/code-signing build tooling; not imported by app source. No patched release at review time. | Monitor upstream replacement/fix; use trusted signing inputs and isolated build runners. [Advisory](https://github.com/advisories/GHSA-86w9-cpqp-85rv) |
| `sprintf-js` 1.0.3 | Jest/CLI argument-processing dependency, using tool-owned format strings. No patched release at review time. | Update the tool chain when a fix is available. [Advisory](https://github.com/advisories/GHSA-hp3w-g68c-fv3c) |

These exceptions must be reassessed when upgrading Expo, Metro, Jest or Tailwind, or when their inputs become user-controlled. This pass does not establish that the app has no vulnerabilities.

## Release notes

No database columns or secrets are required by these fixes. An MFA challenge already in progress at deployment must be restarted because it lacks the new generation binding. Existing normal sessions continue to work unless a security event has revoked them. Backend fixes require deploying the reviewed server changes. Mobile dependency/archive changes require a new native/TestFlight build; no build or store submission was started by this QA pass.

Reference contracts: [JWT validation categories, RFC 8725](https://www.rfc-editor.org/rfc/rfc8725.html), [RevenueCat webhook event fields](https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields).
