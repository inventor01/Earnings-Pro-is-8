---
name: Widget App Intent authenticationPolicy enum member
description: Valid IntentAuthenticationPolicy members for the iOS widget quick-add intent, and why native Swift errors only surface at EAS build time.
---

`IntentAuthenticationPolicy` (App Intents framework) has exactly two members:
`.alwaysAllowed` and `.requiresAuthentication`. There is NO `.requiresLocalAuthentication`
— using it makes the Xcode compile fail with `type 'IntentAuthenticationPolicy' has no
member 'requiresLocalAuthentication'`, which errors the EAS build ~3 min in at the
"Run fastlane" / Xcode step (errorCode `XCODE_BUILD_ERROR`).

For the quick-add widget intent (`targets/widget/QuickAddIntent.swift`): use
`.requiresAuthentication` to force Face ID / Touch ID / passcode before a Lock-Screen
write executes; use `.alwaysAllowed` to let it run while locked with no prompt.

**Why it bit us:** a security change set it to the non-existent `.requiresLocalAuthentication`.

**How to apply:** Swift/native errors in the widget target (and any `targets/` Swift) are
NOT caught by the standard mobile pre-ship checks (`npx tsc --noEmit`,
`npx expo export --platform ios`) — those only validate JS/TS. The only local-ish guard
is careful review; otherwise the EAS Xcode compile is the first place a Swift typo shows
up. To triage a failed build fast, query GraphQL `builds.byId(...).error{errorCode message}`
(see eas-expo-build.md) — the message usually names the exact Swift symbol.
