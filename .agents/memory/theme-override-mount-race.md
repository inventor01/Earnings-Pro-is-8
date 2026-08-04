---
name: Theme override mount race
description: Walkthrough theme-demo override racing step advance froze a Reanimated card's background in the wrong theme (white-on-white text).
---
Rule: never let a component with a Reanimated `entering` animation mount during a theme flip — its initial styles (background/border) can freeze at mount while plain Text children re-render to the new theme, producing mixed-theme UI (e.g. white title on white card).

**Why:** The walkthrough's theme-demo step temporarily overrides the theme; advancing to the next step mounted the keyed card mid-revert. User saw an unreadable near-white header on a white card on the Premium step.

**How to apply:** (1) Clear temporary theme overrides synchronously BEFORE the state change that mounts new UI. (2) Key entering-animated surfaces by theme name (`${step}-${theme.name}`) so a theme flip remounts them cleanly. Never "fix" by hardcoding a text color — that breaks the other theme.
