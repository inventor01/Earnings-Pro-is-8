---
name: RevenueCat integration (Earnings Ninja)
description: Durable decisions for Pro subscriptions in the Expo app — entitlement-id matching, fail-open gating semantics, provisioning path, build requirement.
---

# RevenueCat in the Expo app

Pro subscriptions use the **official React Native SDK** (not the SwiftUI/native target). Install it in the Expo package only — a workspace-root install causes "Native module RNPurchases not found".

## Durable decisions

- **The entitlement identifier (`pro`) must match in two independent places:** the client check and the provisioning seed script. A silent drift (it was once `premium` in the seed) makes purchases unlock nothing, with no error anywhere. Treat the identifier as a contract.

- **Gating fails OPEN in two distinct cases, and only those:** (1) the native module is unavailable (pre-native build / Expo Go) and (2) RevenueCat is present but the offering has no packages (not provisioned yet). Both must allow the feature, because closing them either locks out an older-native-build user an OTA reached, or soft-locks a feature with no purchase path.
  **Why:** an OTA/JS update can land on an older native build that lacks the module; and the new build runs before the dashboard is provisioned. Closing the gate in either state is a worse failure than letting the feature through.

- **The gate must wait for async init before deciding.** "available" and "is pro" are only known after configure + the first customer-info/offerings fetch resolve; deciding before that races and can let a tap through. The provider exposes a one-shot init promise the gate awaits.

- **Public SDK keys are not secrets** — embedding the iOS test key as a default is fine; override per-build via an `EXPO_PUBLIC_…` env var and swap to an `appl_…` key for production. The test-store key needs no App Store Connect setup.

- **Fallback paywall prices are always read live from the offering, never hardcoded** (test-store prices are immutable; prod prices come from the stores).

## Provisioning is connector/dashboard-only

There is no embeddable-key provisioning path — the public test key cannot create products. The supported route is the Replit RevenueCat connector (seed script) or hand-building entities in the dashboard. When the connector OAuth is broken (`invalid_grant`), do not loop on `proposeIntegration`; reconnect the integration or use the dashboard. The Paywall *visual* is dashboard-only regardless; the app only falls back to its own sheet.

- **A lifetime/buy-once product must be `non_consumable`, NOT `one_time`, in the seed script.** The RevenueCat **Test Store** only accepts `subscription`, `consumable`, `non_consumable` and rejects `one_time` with a `parameter_error` ("Allowed product types for Test Store…"). `non_consumable` is the semantically correct type for a permanent lifetime unlock and is valid across test/app/play stores, so use it everywhere.
  **Why:** the seed creates the same product across all three stores; `one_time` passes typing but fails at the test-store create call, aborting the whole run.

- **The seed script masks API errors** (it throws generic `Failed to create X` strings). When it fails, replay the failing call directly via the connector client in code-execution and print `res.error` to get the real `parameter_error`/message. Some failures (e.g. createApp) are also just transient — retry once before changing code.

- **Provisioning emits publishable keys** (`appl_…` iOS, `goog_…` Android, `test_…` Test Store) — not secrets. For real App Store IAP set `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` to the `appl_…` key **before** an EAS build (EXPO_PUBLIC vars bake at build time; a build started before the swap keeps the embedded test key and only talks to the Test Store).

## Shipping

New native deps require a fresh EAS build and **do not reach installed builds over OTA**. The native module is excluded from the JS bundle, so `expo export` still succeeds without it.
