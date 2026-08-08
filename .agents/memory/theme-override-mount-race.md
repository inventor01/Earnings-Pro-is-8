---
name: Theme override mount race
description: Walkthrough theme-demo override racing step advance froze a Reanimated card's background in the wrong theme (white-on-white text).
---
Rule: never let a component with a Reanimated `entering` animation mount during a theme flip — its initial styles (background/border) can freeze at mount while plain Text children re-render to the new theme, producing mixed-theme UI (e.g. white title on white card).

**Why:** The walkthrough's theme-demo step temporarily overrides the theme; advancing to the next step mounted the keyed card mid-revert. User saw an unreadable near-white header on a white card on the Premium step.

**How to apply:** (1) Clear temporary theme overrides synchronously BEFORE the state change that mounts new UI. (2) Key entering-animated surfaces by theme name (`${step}-${theme.name}`) so a theme flip remounts them cleanly. Never "fix" by hardcoding a text color — that breaks the other theme.

**Android ripple caching (Aug 2026):** any Pressable with `android_ripple` wraps its background in a native RippleDrawable that caches the mount-time backgroundColor — theme flips re-render JS-side but the native layer keeps the old color (header icons, filter pills, goal cards stuck in the previous theme). Fix: key such Pressables by theme name so a flip forces a native remount (done once inside the shared PressScale; plain ripple Pressables need it individually).

**Aug 2026 Android recurrence:** the theme-keyed remount is NOT sufficient on Android — Reanimated entering/exiting layout animations snapshot the mount-time backgroundColor even on a fresh keyed mount during the flip (seen: dark Premium walkthrough card under light text; hero Revenue pill stuck light until cold restart). Android fix: drop entering/exiting on theme-sensitive cards entirely (`Platform.OS==='android' ? {} : fade`) and/or key the affected subtree by theme name so a flip forces a native remount. Plain (non-animated) Views are immune.
