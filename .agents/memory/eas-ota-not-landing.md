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

**Fix:** delete the app and reinstall the expo-updates build fresh. **Prevent recurrence:** set `autoIncrement: true` on internal `eas.json` build profiles (was only on `production`) so every build gets a distinct build number and installs cleanly over the prior one.

**Two-launch rule (real, but not this bug):** with default `fallbackToCacheTimeout: 0`, launch #1 downloads in background, launch #2 (after full quit) applies. Rule out the binary issue above before chasing launch timing.
