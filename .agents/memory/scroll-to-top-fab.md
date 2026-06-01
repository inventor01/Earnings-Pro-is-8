---
name: Scroll-to-Top FAB (History/dashboard)
description: How the floating scroll-to-top button on the main dashboard ScrollView is wired without per-frame re-renders.
---

The Dashboard (`earnings-ninja-expo/app/(tabs)/index.tsx`) renders its History list inside one big `ScrollView` (not a FlatList). The scroll-to-top FAB hangs off that same ScrollView via a `scrollRef`.

**Rule:** an `onScroll` handler on a frequently-scrolled list must NOT call `setState` every frame. Flip the visibility state only when the offset crosses the threshold, and return `prev` when unchanged so React bails out of the re-render:
```
setShowScrollTop(prev => (prev === next ? prev : next));
```
**Why:** the Dashboard tree is heavy (KPIs, charts, entries list). A naive `setState(y>400)` on every `scrollEventThrottle=16` event would re-render the whole screen ~60×/s and jank scrolling.

**How to apply:** drive the FAB's fade/scale with a reanimated shared value (`fabAnim`) + `useAnimatedStyle` (opacity/scale/translateY), updated from a `useEffect` keyed on the boolean state — animation runs on the UI thread, independent of React renders. Gate `pointerEvents` on the boolean so the invisible FAB never intercepts touches.

**Layout:** FAB is `position:absolute right:20 bottom:insets.bottom+100 zIndex:998`; the sticky "+ Add Entry" bar is `zIndex:999` and sits at the very bottom — the FAB floats above it by vertical placement, no touch-layer conflict.

JS-only (no native deps) → OTA-deployable via `eas update --branch preview`.
