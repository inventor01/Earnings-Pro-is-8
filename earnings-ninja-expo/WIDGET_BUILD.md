# iOS Home/Lock Screen Widget — Build & Install

The widget code is in `targets/widget/` and the JS bridge is in
`modules/widget-bridge/`. **Expo Go cannot show widgets** — you need a
native dev build (or TestFlight build) to see and test it.

---

## One-time setup (per machine)

You need macOS with Xcode 15+ installed. The `@bacons/apple-targets` config
plugin generates the Widget Extension target automatically during prebuild.

### 1. Set your Apple Team ID in `app.json`

Open `app.json`, find the `ios` block, and add `appleTeamId`:

```json
"ios": {
  "supportsTablet": true,
  "bundleIdentifier": "com.earningsninja.app",
  "appleTeamId": "ABCDE12345",   // ← your 10-char team ID from developer.apple.com
  ...
}
```

Without this, the widget target build will fail.

### 2. Generate the native iOS project

```bash
cd earnings-ninja-expo
npx expo prebuild --platform ios --clean
```

This creates / regenerates the `ios/` directory and adds the Widget
Extension target driven by `targets/widget/expo-target.config.json`.

### 3. Open in Xcode and verify the App Group

```bash
open ios/EarningsNinja.xcworkspace
```

In Xcode:

1. Select the **EarningsNinja** target → **Signing & Capabilities** → make
   sure **App Groups** lists `group.com.earningsninja.shared` (the prebuild
   plugin should add this from `app.json`'s `entitlements`).
2. Select the **EarningsWidget** target → **Signing & Capabilities** → same
   check: `group.com.earningsninja.shared` must be listed.
3. Both targets must be signed with the same Apple Team ID.

### 4. Run on a real device

```bash
npx expo run:ios --device
```

Or build with EAS:

```bash
eas build --profile development --platform ios
```

---

## Adding the widget to the Home/Lock Screen

1. Long-press the Home Screen → tap the **+** in the top-left.
2. Search "Earnings Ninja" → pick Small or Medium → **Add Widget**.
3. For Lock Screen: long-press the Lock Screen → **Customize** → tap a
   widget slot → pick Earnings Ninja.

Before the widget can save entries silently, **open the app at least once
and log in**. The login flow pushes your auth token + the API base URL
into the App Group's shared storage so the widget's App Intent can call
the backend on its own.

---

## How it works

| Piece | Location | Job |
| --- | --- | --- |
| `EarningsWidget.swift` | `targets/widget/` | SwiftUI widget views (Small + Medium), timeline provider |
| `QuickAddIntent.swift` | `targets/widget/` | App Intent — POSTs `/api/entries` directly from the widget tap, no app open |
| `expo-target.config.json` | `targets/widget/` | Tells `@bacons/apple-targets` how to build the widget extension |
| `WidgetBridgeModule.swift` | `modules/widget-bridge/ios/` | Tiny native module — JS reads/writes App Group UserDefaults + reloads widget timelines |
| `lib/widgetSync.ts` | `lib/` | JS helper — pushes `auth_token`, `api_base`, `today_profit`, `last_app` to the App Group on login + on every entry mutation |
| Deep link `earningsninja://entry/new?type=…&amount=…` | handled in `app/_layout.tsx` | Opens AddEntry modal with prefill if the user taps the widget background instead of a quick-amount button |

---

## Troubleshooting

- **Widget shows `$0.00` forever** → open the app, scroll the dashboard
  while on the Today period; `widgetSync.pushProfit()` runs and the next
  widget refresh shows the real number.
- **Quick-amount buttons open the app instead of saving silently** →
  iOS 16. App Intent buttons in widgets require iOS 17. Tap-on-empty-area
  fallback still works on 16.x via the deep link.
- **"PluginError: Failed to resolve plugin for module @bacons/apple-targets"**
  → run `npm install --legacy-peer-deps` in `earnings-ninja-expo/`.
- **Widget extension fails to build with codesign errors** → in Xcode,
  manually set the EarningsWidget target's signing team to match the main
  app. Rebuild.
