---
name: iOS modal stacking freezes underlying ScrollView
description: Never present the fullScreen paywall Modal over a pageSheet Modal — unwinding the stack freezes the ScrollView beneath.
---

# iOS modal stacking freeze

**Rule:** On iOS, never auto-present a root-level fullScreen RN Modal (the fallback paywall) on top of a pageSheet Modal (Analytics/Expenses sheets). Gate BEFORE opening the sheet (`requirePro()` at the entry button) so only one modal ever presents.

**Why:** With the paywall stacked over the Analytics pageSheet, dismissing both (even sequenced via the paywall Modal's `onDismiss`) left the dashboard ScrollView underneath permanently unresponsive until force-quit. Dismissal-ordering fixes (resolve `presentPaywall()` from `onDismiss`) were NOT sufficient — only eliminating the stacking fixed it.

**How to apply:**
- Pro gates run at the button that opens a sheet, not inside the sheet.
- If a CTA inside a sheet must open the paywall, close the sheet first and present the paywall from the sheet Modal's `onDismiss` (iOS); Android can present directly.
- Async gated buttons need a re-entrancy ref guard: two concurrent `presentPaywall()` calls overwrite the fallback paywall's single resolver slot and strand the first caller.
