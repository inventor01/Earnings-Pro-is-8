# Earnings Ninja — Android Gap Report (Phase 1)

Date: 2026-08-03 · Codebase: Expo SDK 54 / React Native, `earnings-ninja-expo/`

## Snapshot
- Framework: Expo SDK 54, expo-router, React Query, reanimated
- Backend: FastAPI on Railway (`EXPO_PUBLIC_API_BASE`), platform-agnostic — no Android work needed
- Auth: email/password + Sign in with Apple (iOS-only) + email MFA
- Subscriptions: RevenueCat (`react-native-purchases`), entitlement `pro`
- Android identity already present in `app.json`: package `com.earningsninja.app`, versionCode 1, adaptive icons ✅

## BLOCKERS (fixed in this phase)
| Gap | Status |
|---|---|
| `eas.json` had no Android build profiles | ✅ Added: `preview` (APK for device testing) and `play` (app-bundle for Play upload) |

## DEGRADED (runs, but needs work before launch)
1. **RevenueCat Android key missing** — `lib/revenuecat.tsx` reads `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`; without it billing is cleanly disabled (no crash, Pro gating fails open). Needs: Play Console subscription products + RevenueCat Google project + key in eas.json.
2. **No Android widget** — `targets/widget` is Swift (iOS-only); `modules/widget-bridge` returns null on Android. Decision: build a Glance widget later or omit from Play listing (do NOT mention widgets in listing until built).
3. **Sign in with Apple hidden on Android** — email/password remains; Google Sign-In not implemented. Play policy does not require Google Sign-In; fine for launch, consider later.
4. **iOS-style UI details** — `presentationStyle="pageSheet"` modals render full-screen on Android (no swipe-down affordance); iOS `shadow*` props need `elevation` fallbacks in several components. Cosmetic sweep needed on a real device/emulator.
5. **Deep links** — scheme `earningsninja` works; no Android `intentFilters` (App Links) configured. Needed only if we want https links to open the app.
6. **Permissions** — `android.permissions: []`; expo-image-picker plugin injects camera/media permissions at prebuild. Verify final manifest of the built APK; remove anything unneeded for Data Safety accuracy.
7. **Notifications** — `lib/notifications.ts` already creates an Android channel (`motivation`); `plugins/withLocalNotificationsOnly` is iOS-scoped — verify it doesn't strip Android receivers. POST_NOTIFICATIONS runtime permission flow needs on-device testing.

## OK (no Android work expected)
- Core tracking/analytics/calendar/goals logic, React Query data layer, offline queue (AsyncStorage), EST day-bucketing, haptics, secure storage (expo-secure-store), theming, KeyboardAvoidingView branches, DateTimePicker platform branches.

## Play-policy items (later phases)
- Target API 36 required for submissions after Aug 31, 2026 (Expo SDK 54 targets API 36 ✅ — verify at build time).
- Account deletion: in-app ✅ (server fix live); public web page `earningsninja.com/delete-account` required — not yet built.
- New personal Play accounts: closed test with 12 testers / 14 days before production access.
- Data Safety form, content rating, listing assets, screenshots from the actual Android app.

## Phase 1 verification
- [ ] EAS Android build (preview APK) compiles — kicked off, see build list
- [ ] versionCode strategy: keep incrementing manually alongside iOS buildNumber
