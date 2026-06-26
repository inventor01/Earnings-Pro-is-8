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

## Shipping

New native deps require a fresh EAS build and **do not reach installed builds over OTA**. The native module is excluded from the JS bundle, so `expo export` still succeeds without it.
