---
name: Expo theme system (Dark/Light)
description: How the 2-theme system works and why PRIMARY is split into PRIMARY + PRIMARY_TXT
---

# Theme system (earnings-ninja-expo)

Exactly two themes live in `lib/theme.ts`: `dark` (default) and `light`.
`ThemeName = 'dark' | 'light'`. Tokens are theme-object inline styles (NO Tailwind in
the Expo app — only the web `frontend/` uses Tailwind). `useTheme()` returns the token
object; `useThemeControls()` returns `{ themeName, setThemeName }`.

## PRIMARY vs PRIMARY_TXT (the important rule)
- `PRIMARY` = brand neon yellow `#facc15` in BOTH themes. Use it for FILLS, GLOWS,
  BORDERS, and active-state backgrounds (`backgroundColor: PRIMARY`, `neonGlow(PRIMARY)`,
  `borderColor: PRIMARY`).
- `PRIMARY_TXT` = accent color used as FOREGROUND text/icons. Dark = `#facc15`
  (identical to PRIMARY); Light = `#a16207` (deep gold, WCAG-AA on white).
- **Why:** neon yellow as text on a white background is unreadable (~1.2:1). Splitting
  fill vs text lets Light mode keep the exact neon brand for fills/glows while staying
  legible. In Dark mode the two are equal, so the split is a no-op.
- **How to apply:** any NEW `color:`/`color={...}` foreground that wants the brand accent
  must use `PRIMARY_TXT`, never `PRIMARY`. Keep using `PRIMARY` for backgroundColor /
  borderColor / glow. `GREEN`/`RED` stay brand-exact in both themes.

## Migration
Legacy persisted names map via `normalizeThemeName`: `simpleLight`→`light`; everything
else (`darkNeon`, `bwNeon`, unknown, null)→`dark`. Canonical value is rewritten to
AsyncStorage on load.

## Widget (NATIVE — not OTA)
`ThemeProvider` pushes the current theme to the iOS App Group via
`widgetSync.pushTheme(name)` (writes the `theme` key). `targets/widget/EarningsWidget.swift`
reads it through `WidgetStore.isLight` and swaps Home-widget bg/text/card colors
(`Color.wBg/wCard/wMuted/wText/wAccentText`). Lock Screen accessory widgets are rendered
monochrome/tinted by iOS regardless, so they are intentionally left untouched.
**Swift changes require a new `eas build` — they do NOT ship via `eas update` OTA.**
