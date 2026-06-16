---
name: EAS / Expo build & OTA gotchas
description: Durable lessons for building and OTA-updating the earnings-ninja-expo iOS app via EAS
---

## react / react-dom version lockstep
EAS runs `npm ci` in strict mode, which rejects a `react-dom` that doesn't match the pinned `react`. RN doesn't use react-dom at runtime, so a transitive bump (npm pulling latest react-dom) is invisible locally but fails the CI install.
**Why:** `expo` declares `react-dom` matching the SDK's `react`; if the lockfile drifts to a newer react-dom, `npm ci` ERESOLVE breaks the build at INSTALL_DEPENDENCIES.
**How to apply:** keep `react` and `react-dom` pinned to the exact same version in package.json; after any dep change, run `npm ci --include=dev --dry-run` (must exit 0) before triggering an EAS build.

## EAS Update (OTA) channel↔branch mapping
A build embeds a `channel` (set per-profile in eas.json). `eas update` publishes to a `--branch`. Updates only reach devices if the channel points to that branch. Same-named channel+branch auto-link on first publish, but a mismatch means updates publish "successfully" yet never download.
**Why:** silent non-delivery is the #1 OTA failure mode — nothing errors, the device just never sees the update.
**How to apply:** verify with `eas channel:list` that `preview -> preview` before relying on OTA; publish JS-only changes with `eas update --branch preview`.

## fingerprint runtimeVersion policy + native changes
`runtimeVersion: { policy: "fingerprint" }` means an OTA update is served only to builds whose native fingerprint matches. JS-only changes ship OTA; anything native (new native module, app.json plugin/permission/entitlement change, icon/splash, SDK bump, widget/app-extension Swift changes) changes the fingerprint and requires a fresh `eas build`. The widget extension's native code is never OTA-updatable.
**Real-world bite:** a JS bugfix "still" looked broken on the installed app even though `eas update` published cleanly — because a native dep had been added (audio module), so the installed build's fingerprint no longer matched the update's runtimeVersion. The JS fix was correct; it just never reached the binary. The only cure is a fresh `eas build`, after which OTA works forward again.

## Detached `eas build --no-wait` output is unreliable; verify out-of-band
`nohup … eas-cli build --no-wait &` to dodge the 2-min bash cap works, but the detached stdout is buffered and frequently lost — the log can look empty even when the build was submitted and **succeeded**. Never conclude success/failure from the local log. Verify with `eas build:list --platform ios --limit N` (status + started-at) and treat each submission attempt as potentially having created a real build (don't assume a "silent" attempt did nothing — it may already be FINISHED). Kill the local process before it finishes archiving to abort a redundant submission.

## Fetch an EAS build's error/logs programmatically (GraphQL + brotli)
`eas build:view` is interactive-ish; to script failure triage, query GraphQL `https://api.expo.dev/graphql` (Bearer `$EXPO_TOKEN`):
- Error reason: `builds{ byId(buildId:$id){ status error{ errorCode message } artifacts{ applicationArchiveUrl } completedAt } } }`.
- Raw phase logs: same query asking for `logFiles` (array of URLs). Each log file is **brotli-compressed newline-JSON** — `curl <url> | brotli -d` then parse per-line JSON to read the actual `npm ci` / Fastlane output. This is how you confirm e.g. an `ENOTFOUND package-firewall.replit.local` in INSTALL_DEPENDENCIES vs a credentials/native failure.
