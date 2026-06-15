---
name: Lock Screen widget quick-add
description: Why the Lock Screen quick-add lives on the rectangular accessory and runs unauthenticated.
---

# Lock Screen widget quick-add

The iOS widget exposes today's profit + interactive +Revenue / −Expense quick-add
buttons on the **Lock Screen**, in addition to the Home Screen widget.

## Durable decisions

- **Quick-add buttons go on `accessoryRectangular` only.** `accessoryInline`
  (one text line) and `accessoryCircular` (tiny gauge) have no room for controls,
  so they stay glance-only (tap opens the app). Rectangular fits a profit line +
  a 2-button row.

- **`QuickAddIntent.authenticationPolicy = .alwaysAllowed`.**
  **Why:** the default policy requires Face ID / passcode before an interactive
  widget intent runs, which defeats a glanceable lock-screen quick-add. The intent
  only *writes* one entry (POST /api/entries) and never reads or displays any
  financial data, so the bounded risk (a stray entry from a locked phone) is
  acceptable for the frictionless logging the feature is for. Same intent serves
  the Home Screen, where the device is already unlocked, so no downside there.

- **Lock Screen renders accessory widgets in `.vibrant` (monochrome tint).** Neon
  fills don't survive it, so the lock-screen button uses a clear fill + thin
  stroke that reads cleanly under the system tint, rather than fighting it.

- **Native change → EAS build, not OTA.** Widget Swift changes only ship in a new
  `eas build --platform ios --profile preview`. Swift cannot be compiled on the
  Linux dev box; it is validated at build time.
