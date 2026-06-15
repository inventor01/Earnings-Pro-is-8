---
name: Ka-Ching sound effect (expo-av)
description: How the entry-save / notification sound is wired and why it is lazy-loaded and native-build-gated.
---

# Ka-Ching sound effect

A short cash-register sound plays on successful entry save (manual + iOS widget
quick-add, which share the same save mutation), and when a motivation
notification is delivered while the app is foregrounded. Opt-out only — defaults
ON; a Settings pill toggle persists the choice.

## Durable decisions

- **expo-av is lazy-required, never imported at module top level.** The native
  module is loaded via `require('expo-av')` inside a try/catch on first play,
  with a `import type` for typing only.
  **Why:** if this JS ever lands on a binary that predates the native module
  (e.g. an OTA pushed to an older build), a top-level import can crash the app on
  startup. Lazy + best-effort turns "no native module" into a silent no-op.
  **How to apply:** any new native module used only for a cosmetic/optional
  effect should follow this pattern so it degrades gracefully across builds.

- **Native-build-gated, NOT OTA-safe.** Adding expo-av is a native dependency.
  The feature only works after a new `eas build --platform ios --profile preview`
  that bundles it; do not rely on OTA reaching older installed builds.

- **Foreground-only notification sound is intentional.** "Use expo-av" means an
  in-app sound, fired from `addNotificationReceivedListener` (which only runs for
  foreground deliveries). Background/lock-screen deliveries would need a native
  notification `content.sound`, which is a different mechanism and out of scope.

- **Plays on every save success, including offline-queued (negative-id) entries**
  — mirrors the existing success haptic (`hNotifyOk`), which also fires on queued
  acceptance. Kept consistent on purpose so the audio and haptic confirmations
  always agree.
