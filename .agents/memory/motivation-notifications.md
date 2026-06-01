---
name: Motivation Notifications
description: How the Expo app's daily motivation/recap local notifications are scheduled and why they respect Hidden Mode the way they do.
---

# Motivation Notifications (Expo)

Two local notifications/day (morning 9:00, evening recap 20:00) via `expo-notifications`. Service: `lib/notifications.ts`; toggle in SettingsModal; foreground re-arm in `app/_layout.tsx`.

## Key decisions

- **One-shot DATE triggers, re-armed on foreground — NOT DAILY repeats.**
  **Why:** a DAILY repeating trigger bakes content at schedule time and would keep firing a stale "today +$X" for days. Local notifications can't compute fresh numbers at fire time, so the only way to keep the "today" framing honest is to re-author next-occurrence one-shots whenever the app is open.
  **How to apply:** any change to content/timing must keep the re-arm-on-foreground model; don't switch to repeats to "guarantee delivery" without accepting stale numbers. Stable identifiers (`motivation-morning`/`motivation-evening`) make the cancel/replace idempotent.

- **Toggling Hidden Mode must re-author notifications immediately (force reschedule), not just on next foreground.**
  **Why:** a notification scheduled while visible contains a dollar amount; if the user then enables Hidden Mode, that amount would sit in the queued notification and could appear on a public lock screen — defeating the stealth feature. There is a dedicated `useEffect` keyed on `hidden` in `_layout.tsx` that force-reschedules.
  **How to apply:** keep that effect. Pass `hidden` explicitly into the scheduler (avoids an AsyncStorage read race right after the toggle persists).

- **Toggle truth = persisted flag AND live OS permission.** `syncNotifState()` self-heals (flips off + cancels) if iOS permission was revoked out of band; SettingsModal re-checks on every open (keyed on `visible`), not just first mount.

- **Cooldown + mutex** in `refreshMotivationSchedule` (30s, bypassed by `force`) prevents routine foregrounds from firing duplicate TODAY+THIS_WEEK rollup fetches.

## Build/ship constraint

`expo-notifications` is a **native module** + adds an `app.json` config plugin → changes the native fingerprint. Requires `eas build --platform ios --profile preview`; **NOT OTA-deployable**. OTA only reaches the new build forward (same pattern as CSV export).
