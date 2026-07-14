---
name: OTA apply crash → roll-back-to-embedded playbook
description: When a build crashes at launch only after an OTA applies, isolate with an identical-JS update, then use eas update:roll-back-to-embedded; ship fixes as a native build.
---

# OTA apply crash isolation + recovery

Symptom (Jul 14, 2026, build 29): fresh install launches fine; second launch (after expo-updates applies a downloaded update) crashes instantly — even when the update's JS is byte-for-byte the code embedded in the binary. So the failure is the update-apply path in that binary, NOT the update content.

**Isolation ladder** (each step = user deletes app, reinstalls, launches twice):
1. Fresh install crashes on launch 1 → native build problem.
2. Launch 1 OK, launch 2 crashes → publish an update identical to the embedded JS. Still crashes → content is innocent.
3. Publish `eas update:roll-back-to-embedded` (needs `--branch --message --platform ios --runtime-version <rt>` in non-interactive mode). Launch 2 OK → apply mechanism for real updates is broken in that binary.

**Why:** a binary whose expo-updates apply path is broken will crash-loop on ANY published update; the only safe channel action is roll-back-to-embedded, and fixes must ship as a new native build.

**How to apply:** if this pattern appears, immediately roll-back-to-embedded on every live runtime that received the same updates (don't wait for reports from other builds), then bump buildNumber and `eas build --auto-submit`. Treat OTA to the affected build generation as unsafe until a new binary proves updates apply cleanly.
