---
name: EAS OTA update not landing on device
description: How to diagnose an expo-updates OTA that won't appear despite a correct publish
---

# OTA update published but never appears on device

When an `eas update` looks correctly published yet the change never shows up on the phone, diagnose in this order before blaming on-device timing:

1. **Verify server-side delivery directly.** Simulate the app's manifest request with the build's exact runtime version + channel:
   ```
   curl -s -D- -H "expo-platform: ios" -H "expo-runtime-version: <RTV>" \
     -H "expo-channel-name: <channel>" -H "expo-protocol-version: 1" -H "expo-api-version: 1" \
     -H "expo-expect-signature: false" -H "EAS-Client-ID: <uuid>" \
     -H "Accept: multipart/mixed, application/expo+json, application/json" \
     https://u.expo.dev/<projectId>
   ```
   `HTTP 200` + multipart manifest whose `runtimeVersion` matches the build = server side is correct; the problem is the device.
2. **Confirm the build's channel + RTV** with `eas build:view <id>` (fields `Channel`, `Runtime Version`).
3. **Check for multiple finished builds with the SAME version + build number.** `eas build:list --json` then inspect `runtimeVersion` per build. A build with `runtimeVersion: undefined` has **no expo-updates** in it — OTA can never work on that binary.

**Root-cause that bit us:** two internal-distribution iOS builds both had version `1.0.0` / build number `1`. The first (pre-OTA) had no expo-updates; the second added it. Installing the second over the first did **not** replace the app — iOS treats identical version+build as "already installed" — so the phone kept running the updater-less binary.

**Fix:** delete the app and reinstall the expo-updates build fresh. To give future builds distinct build numbers, `autoIncrement: true` on internal `eas.json` profiles helps — BUT read the fingerprint trap below first, because editing `eas.json` changes the runtimeVersion fingerprint.

**Two-launch rule (real, but not this bug):** with default `fallbackToCacheTimeout: 0`, launch #1 downloads in background, launch #2 (after full quit) applies. Rule out the binary issue above before chasing launch timing.

## Fingerprint trap: editing eas.json/app.json silently breaks OTA delivery to installed builds

**Why:** `runtimeVersion: { policy: "fingerprint" }` means an OTA only reaches a build whose native fingerprint == the update's runtimeVersion. **`eas.json` IS a fingerprint source** (confirmed via `npx expo-updates fingerprint:generate` — it lists `eas.json` among ~205 file sources, alongside `app.json`, native dirs, patches, autolinking config). So a one-line `eas.json` edit (e.g. adding `autoIncrement: true` to the `preview` profile) changes the fingerprint hash, and an `eas update` published from that tree gets the NEW runtimeVersion — which no already-installed build matches. The update lands on the branch and looks published, but every installed device silently ignores it.

**How to apply:** Before publishing an OTA meant for an *already-installed* build, confirm the working tree fingerprints to that build's runtimeVersion:
```
npx expo-updates fingerprint:generate --platform ios   # JSON; top-level .hash is the RTV
```
Cross-check against the installed build's RTV (`eas update:list --branch <ch>` shows the RTV of updates that DID reach it, or `eas build:view <id>`). If they differ, find the fingerprint-source file you changed (commonly `eas.json`, `app.json`, a new native dep, an icon/splash) and revert it to its build-time content, then recompute until the hash matches. Only THEN publish. JS/TS source changes do NOT affect the fingerprint — that's exactly what OTA is for.

## Verify what a build actually contains with `eas fingerprint:compare` — don't trust changelogs
`eas fingerprint:compare --build-id <fullId>` (eas-cli) computes the current tree fingerprint and prints a human-readable DIFF vs the build's stored fingerprint (new/removed native dirs, autolinking config changes, app-config changes). This is the authoritative way to answer "does this installed build contain dependency/native change X?" — far more reliable than replit.md "Recent Changes" notes.

**Why it bit us:** replit.md claimed preview build `a1eabfce` "baked in expo-audio". `fingerprint:compare` proved it actually ships **expo-av 16.0.8, not expo-audio** — the build (createdAt 23:00) was made ~50 min BEFORE the expo-av→expo-audio migration was committed (23:49). A build's `createdAt` predating a "baked-in" commit is the tell. So `a1eabfce` (RTV `a76a90d3`) does NOT match the current expo-audio tree (RTV `76a621ee`), and JS OTAs from the current tree can't reach it. The migration is a native dep change → needs a fresh `eas build`, exactly as the OTA rules say.

**How to apply:** When an OTA "won't land," run `eas fingerprint:compare --build-id <id>` FIRST. If the diff shows native/dep/config changes, OTA can't bridge it — cut a new build. Only a clean (no-diff) fingerprint means a JS OTA will actually apply.

## An OTA that crashes the app on launch — recovery + prevention

A `tsc`-clean, `expo export`-clean OTA can still crash an installed build on launch once the device applies it (observed: build badge + a tiny Customer-Center fallback that doesn't even run at launch still crash-looped build 11). A clean export does NOT prove the on-device apply is safe.

- **`update:roll-back-to-embedded` does NOT reliably reach a crash-looping device.** The device has to launch far enough to fetch+stage the rollback; if it crashes early every launch, it may never pick it up. Publishing the rollback looks successful server-side but the phone stays broken.
- **Reliable recovery is delete + reinstall from TestFlight** — a fresh install runs the *embedded* (built-in) bundle first, which bypasses the cached crashing OTA entirely. (Embedded build N is the submitted, known-good JS from before any OTA.)
- **`update:roll-back-to-embedded` flags:** `--branch <ch> --platform ios --runtime-version <RTV> --message "…" --non-interactive` (the flag is `--runtime-version`, hyphenated, and is REQUIRED in non-interactive mode).
- **Prevention:** when an OTA misbehaves and the fix actually matters, bake it into the **next native build** (bump `ios.buildNumber`, `eas build … --profile testflight --auto-submit-with-profile testflight --no-wait`) instead of re-shipping via OTA — a native build embeds the JS and skips the OTA-apply window that bit us. If you must use OTA after an incident, ship changes **one at a time** so the next crash is unambiguous.
- **`eas update` defaults to `--platform=all`, which fails** with "trying to use web support but don't have the required platforms array" on this app — always pass `--platform ios`.

## Publishing eas update from the Replit env (the part that actually fights you)
- **Detached background processes get reaped** (~1-2 min, silent, nondeterministic kill point) regardless of `setsid nohup … & disown`. They will never finish a ~3-5 min export+upload. This is NOT OOM — fewer metro workers did not help and the kill point varied (73/87/93/95%).
- **Use a temporary workflow instead** (`configureWorkflow({name, command:"bash /tmp/wrapper.sh", outputType:"console"})`, no `waitForPort`). Workflows persist across tool calls. Wrapper pattern: run the publish, `touch /tmp/done` sentinel, then `sleep infinity` so the supervisor doesn't restart-loop the one-shot. Poll for the sentinel, verify with `eas update:list`, then `removeWorkflow`.
- **Keep the metro cache warm** (do NOT `rm -rf /tmp/metro-cache` between attempts) — a warm cache bundles in ~30-40s vs ~90s cold, so the publish finishes well within a workflow's life.
- `CI=1` gives line-by-line metro progress (no spinner buffering). iOS-only (`--platform ios`) halves the work.
- Backend/Frontend/Landing workflows **auto-restart** when killed, so you can't free RAM that way; killing them with `pkill` also kills your own shell (exit 143). Don't bother.

## ios.buildNumber is a fingerprint input → keep it pinned to OTA an existing build
To deliver a JS-only OTA to an already-installed build, the published update's
runtime (fingerprint policy) must equal that build's. **`ios.buildNumber` in
`app.json` is part of the fingerprint** — bumping it (e.g. 12→13 in prep for a
future native build) changes the runtime, so an `eas update` from that tree
targets a NEW runtime and never reaches the installed build. Verified with
`eas fingerprint:compare --build-id <id>`: the *only* diff was buildNumber, yet
the fingerprints differed. **Rule:** before OTA-ing build N, set
`ios.buildNumber` back to N so `fingerprint:compare` reports "matches", then
publish. Re-bump only when you actually cut the next native build.
