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
