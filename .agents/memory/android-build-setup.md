---
name: Android build setup
description: State of the Google Play / Android effort and how Android builds work
---
- First Android build succeeded Aug 3, 2026 (EAS profile `preview` = APK; `play` = app-bundle for Play upload). Signing keystore is EAS-managed cloud (auto-generated) — never local.
- Same EAS invocation rules as iOS: `GIT_CEILING_DIRECTORIES=/home/runner/workspace EAS_NO_VCS=1`, sed package-firewall from lockfile first.
- Billing on Android is cleanly disabled until `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` is set (resolveApiKey returns '' → RC marked unavailable, gating fails open).
- User has a Play Console account (earningsninjaapp@gmail.com, created Aug 2026, personal → expect 12-testers/14-day closed-test requirement). User has NO Android device — verification is via Play internal testing / borrowed devices.
- Gap report: `docs/android-gap-report.md`. iOS widget has no Android counterpart; don't mention widgets in the Play listing.
