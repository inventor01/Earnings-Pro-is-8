---
name: expo-notifications push entitlement vs local-only
description: Why the expo-notifications config plugin breaks iOS builds for local-notification-only apps, and the fix.
---

# expo-notifications config plugin forces a Push Notifications capability

The `expo-notifications` **config plugin** (the `["expo-notifications", {...}]` entry
in `app.json` plugins) injects, on iOS:
- the `aps-environment` entitlement, and
- `remote-notification` in `UIBackgroundModes`.

Both are **remote-push** concerns. They make EAS/Xcode require the **Push
Notifications** capability on the App ID + a provisioning profile that includes
`aps-environment`. If the App ID / profile doesn't have it, the EAS build fails at
the Xcode step with `XCODE_BUILD_ERROR`: *"Provisioning profile ... doesn't support
the Push Notifications capability / doesn't include the aps-environment entitlement."*

## Rule
This app uses **local notifications only** (`scheduleNotificationAsync`,
`getPermissionsAsync`, `requestPermissionsAsync`, `cancelScheduledNotificationAsync`,
`setNotificationHandler`) — no push tokens. For local-only usage, **do not include
the `expo-notifications` config plugin**. Keep the `expo-notifications` npm package
(the JS API still works for local notifications); just drop the plugin entry from
`app.json`.

**Why:** keeping the plugin would require enabling Push Notifications on App ID
`com.earningsninja.app` in the Apple portal + regenerating the provisioning profile —
unnecessary infra for an app that never sends remote push.

**How to apply:** if you ever re-add `["expo-notifications", ...]` to `app.json`,
expect the next native iOS build to need the Push Notifications capability. Only do
that if the app actually adopts remote push. Removing/adding the plugin changes the
native fingerprint, so it must ride a fresh `eas build`, never an isolated OTA.
