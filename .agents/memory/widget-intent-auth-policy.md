---
name: Native Swift errors in widget targets only fail at EAS build
description: Swift compile errors in earnings-ninja-expo/targets/ slip past tsc/expo-export and first surface at the EAS Xcode step; how to triage fast.
---

Swift/native errors in the iOS widget target (and any `earnings-ninja-expo/targets/`
Swift) are NOT caught by the standard mobile pre-ship checks (`npx tsc --noEmit`,
`npx expo export --platform ios`) — those only validate JS/TS. The first place a Swift
typo shows up is the EAS Xcode compile, which errors ~3 min into the build at the
"Run fastlane" step with errorCode `XCODE_BUILD_ERROR`.

**Why it matters:** there is no local-ish guard for `targets/` Swift other than careful
review; a bad symbol costs a full ~min build cycle to discover.

**How to apply:** review widget Swift carefully before triggering a build. To triage a
failed build fast, query GraphQL `builds.byId(...).error{errorCode message}` (see
eas-expo-build.md) — the message usually names the exact Swift symbol/line.

**Historical note:** the widget once had a Lock-Screen quick-add App Intent
(`QuickAddIntent.swift`) whose `IntentAuthenticationPolicy` only accepts `.alwaysAllowed`
or `.requiresAuthentication` (NOT `.requiresLocalAuthentication`). That whole intent was
later removed when the widget was simplified to display-only (shows today's profit/revenue,
tap opens the app via `earningsninja://entry/new`). Kept only as an example of the
class of error above.
