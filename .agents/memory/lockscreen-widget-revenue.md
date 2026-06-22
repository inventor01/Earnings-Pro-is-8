---
name: Lock Screen widget mini-dashboard (Net + Revenue + quick buttons)
description: How today's Revenue is added to the iOS widget, and the OTA-vs-native split plus the optimistic-write invariant the quick-add intent must keep.
---

# Lock Screen widget mini-dashboard

The `accessoryRectangular` Lock Screen widget shows a mini dashboard: Today's
NET profit, Today's REVENUE, and interactive +$10 Revenue / −$10 Expense
buttons. Home Screen small/medium widgets share the same data + intent.

## Data flow (App Group shared UserDefaults)
The RN app pushes string-encoded keys via `lib/widgetSync.ts`; the Swift widget
(`targets/widget/EarningsWidget.swift`) + intent (`QuickAddIntent.swift`) read
them. Revenue uses key `today_revenue`, mirroring `today_profit`. Both are
pushed together from the dashboard's today-rollup effect, gated on
`period==='today' && effectiveDayOffset===0` so the widget never shows a
non-today period's numbers as "today". Logout clears both keys.

## OTA-vs-native split (critical)
- **OTA-deployable:** the JS that *pushes* App-Group keys (widgetSync +
  index.tsx wiring). Shipping a new key's data lands via `eas update`.
- **NOT OTA — needs `eas build`:** anything in the Swift widget/intent —
  rendering a new line, reading a new key, the optimistic-write logic. SwiftUI
  is baked into the native binary. So a "new metric on the widget" is always a
  two-part change: OTA the data now, but the UI only appears once a native build
  containing the Swift change is installed.

## Optimistic-write invariant (QuickAddIntent)
On a successful quick-add POST, the intent optimistically bumps App-Group
numbers so the widget updates without waiting for the app:
- **Revenue tap:** bump BOTH `today_profit` (+amount) and `today_revenue`
  (+amount).
- **Expense tap:** bump ONLY `today_profit` (−amount). Expenses are
  revenue-neutral — never touch `today_revenue`.

**Why:** if you add a revenue metric to the widget but forget to bump it in the
intent's optimistic block, tapping +Revenue on the Lock Screen moves NET
instantly while REVENUE stays stale until the app next pushes a fresh rollup —
a visible inconsistency in the widget's core interaction. Any future per-metric
line added to the widget must be mirrored in this serialized write block.

**How to apply:** writes are serialized through `profitWriteQueue.sync` to avoid
read-then-write races across concurrent taps; keep every optimistic metric
update inside that same block.
