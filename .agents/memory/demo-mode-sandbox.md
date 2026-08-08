---
name: Local sandbox Demo Mode
description: Isolation invariants for the Expo app's fully client-side demo; any new persisted state or network path must honor them.
---

"Try Demo" runs a fully client-side sandbox: in-memory data only, no server user, no JWT, no network. All api calls route through a central demo switch, and the fetch wrapper hard-fails in demo.

**Rule:** while demo is active, nothing demo-derived may be written to device storage (AsyncStorage/SecureStore), the widget, scheduled notifications, or RevenueCat — and demo must not READ a real user's persisted preferences either (isolation runs both ways). Simulated Pro exists only in the subscription context value. "Sign Out" in demo must end the sandbox without running the real-account local-data wipe.

**Why:** the old demo (`POST /api/auth/demo`, kept only for old builds/reviewer) wrote throwaway users into the prod DB; and any leaked demo state (mirrors, prefs, entitlement, drafts) is inherited by the next real login on the device. A demo "Sign Out" running real logout cleanup would destroy a signed-out real account's unsynced offline data. Direct-fetch paths (connectivity probe) bypass the api-layer guard and need their own.

**How to apply:** when adding any AsyncStorage read/write, mirror, widget push, notification schedule/flag, RC identity call, or direct fetch, guard it with the demo-active check (or confirm it's only reachable with a real token). Regression suite: `__tests__/demoIsolation.test.ts`.
