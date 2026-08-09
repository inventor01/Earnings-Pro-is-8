---
name: Android datetime picker crash
description: RN community DateTimePicker mode="datetime" is iOS-only; Android hard-crashes to a blank screen.
---

`@react-native-community/datetimepicker` only accepts `mode="date"` or `mode="time"` on Android; `mode="datetime"` (and inline spinner rendering) is iOS-only and throws in the native module the moment it renders — the app crashes to a blank screen with no JS error.

**Why:** shipped an Android build where adjusting an entry's date instantly blank-screened; tsc/jest can't catch it because the prop type allows "datetime".

**How to apply:** any datetime input must platform-split: iOS = inline `mode="datetime"` spinner; Android = two-step system dialogs (`mode="date"` → carry over time-of-day → `mode="time"`), each dialog handled once via `event.type === 'set'`, reset the stage on dismiss. Test date pickers on Android specifically.
