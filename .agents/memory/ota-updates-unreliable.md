---
name: OTA updates don't work — ship native builds
description: User states OTA (eas update) changes never show up on their device; ship changes via native TestFlight builds instead.
---

# OTA updates don't work for this user

The user reported (Aug 3, 2026) that OTA updates ("the OTA does not work") never reach their device — JS-only changes published via `eas update` don't show up for them.

**Why:** Possibly related to the earlier update-apply crash history (see ota-apply-crash-rollback.md) or the roll-back-to-embedded state left on the update branch; regardless, the user has confirmed OTA delivery is not landing on their device.

**How to apply:** Do NOT rely on `eas update` to deliver user-visible changes. Ship all changes — even JS-only ones — in the next native TestFlight build (bump buildNumber, `eas build --auto-submit`). Still fine to publish an OTA alongside for other users, but never tell the user a change is "live" on OTA alone.
