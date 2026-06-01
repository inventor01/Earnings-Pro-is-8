---
name: expo-notifications push entitlement vs local-only
description: Why the expo-notifications config plugin breaks iOS builds for local-notification-only apps, and the correct fix (a local stripper config plugin).
---

# expo-notifications forces a Push Notifications capability on iOS

The `expo-notifications` iOS config plugin injects, during prebuild:
- the `aps-environment` entitlement, and
- `remote-notification` in `Info.plist` `UIBackgroundModes`.

Both are **remote-push** concerns. They make EAS/Xcode require the **Push
Notifications** capability on the App ID + a provisioning profile that includes
`aps-environment`. If the profile doesn't have it, the EAS iOS build fails at the
Xcode step with `XCODE_BUILD_ERROR`: *"Provisioning profile ... doesn't support the
Push Notifications capability / doesn't include the aps-environment entitlement."*

## Gotcha: removing the plugin entry from app.json is NOT enough
On Expo SDK 54, `expo prebuild` **auto-applies the config plugin of any installed
package** (e.g. `expo-notifications` in `package.json`) even when it is NOT listed in
`app.json`'s `plugins` array. So deleting the `["expo-notifications", ...]` entry does
nothing — the entitlement still appears in the generated
`ios/<app>/<app>.entitlements`.

## Correct fix for local-notifications-only apps
Add a **local config plugin** that runs LAST in `app.json` `plugins` and strips the
push artifacts: delete `aps-environment` via `withEntitlementsPlist` and remove
`remote-notification` from `UIBackgroundModes` via `withInfoPlist`. See
`earnings-ninja-expo/plugins/withLocalNotificationsOnly.js`. Listing it last makes its
dangerous-mod run after the auto-applied expo-notifications mod, so it wins.

**Why:** this app only schedules LOCAL notifications (no push tokens), so push infra
is unnecessary; the alternative (enabling Push Notifications on App ID
`com.earningsninja.app` + regenerating the provisioning profile in the Apple portal)
is avoidable work.

**How to verify before a (slow, free-tier-queued) EAS build:** run
`expo prebuild --platform ios --no-install --clean` and confirm the generated
`.entitlements` has no `aps-environment` and Info.plist has no `remote-notification`.
Run prebuild via a temporary console workflow, not the bash tool — prebuild touches
`.git/index.lock` and trips the main-agent git guard (use `EAS_NO_VCS=1 CI=1`).

**Fingerprint note:** this changes the native fingerprint, so it must ride a fresh
`eas build`, never an isolated OTA.
