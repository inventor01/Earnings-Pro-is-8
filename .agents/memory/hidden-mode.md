---
name: Hidden Mode (stealth) — masking monetary values
description: How the Expo app hides all money values app-wide, and the hydration rule that prevents a first-frame leak.
---

# Hidden Mode (stealth privacy feature)

Global toggle that masks every monetary value in the Expo app with `•••` while keeping
non-money counts visible (entries, ORDERS, miles, hours, percentages, day counts).

State lives in `earnings-ninja-expo/lib/hiddenMode.ts` (context provider, mirrors the
`lib/theme.ts` pattern), persisted to AsyncStorage key `hidden_mode` (`'1'`/`'0'`).
`AnimatedNumber` and `StatCard` take a `hideable?` prop (default true); count-only
stats pass `hideable={false}`.

## Rule: default to masked until storage hydrates
**The provider MUST initialize `hidden = true` and only resolve to the stored value
after `AsyncStorage.getItem` returns.**

**Why:** if it initializes `false`, a user who previously enabled Hidden Mode briefly
sees real dollar amounts on cold start before hydration completes — a real privacy
leak for a stealth feature. The cost is a short mask flash for non-hidden users, which
is the correct tradeoff here.

**How to apply:** any future rewrite of the provider (or a similar persisted privacy
flag) must keep the masked-until-hydrated default; never flip the initial state to the
"visible" value to avoid the flash.

## Coverage note
When adding any new screen/component that renders a dollar value, wrap it with
`hidden ? MASK : ...`. Easy-to-miss non-obvious sites that had to be masked: Calendar
month totals, Calendar selection DayStats, and the Calendar legend `$` thresholds
(swap to Low/Medium/High when hidden rather than masking to `•••`, which would gut the
legend). Active calculator input in the Add Entry modal is intentionally left visible.
