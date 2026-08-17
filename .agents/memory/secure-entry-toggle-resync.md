---
name: iOS secureTextEntry toggle wipe fix
description: Why the show/hide password toggle wiped text on the next keystroke and the only reliable repair ordering.
---

# iOS secureTextEntry toggle — text wiped on next keystroke

iOS marks a field "fresh" when secureTextEntry flips; the next keystroke wipes
all text. The repair is a native clear+rewrite of the current text — but it
**only works if it runs AFTER React commits the secureTextEntry change**.

**Why:** scheduling the resync from the toggle handler via
`requestAnimationFrame` raced the commit and often no-oped, so users still lost
their password mid-typing (confirmed on device Aug 2026). Text-shape heuristics
to "detect and undo" the wipe in onChangeText are unsound (false positives on
mid-string edits, false negatives when the typed char is a prefix).

**How to apply:** in the shared `PasswordInput`, the resync lives in a
`useEffect` keyed on the `visible` state (skipping first mount). Any future
secure-field toggle must keep that ordering; never move it back into the press
handler or infer wipes from text diffs.

**Second failure (Aug 2026, on device):** a same-tick clear+rewrite of the SAME
final text got coalesced by the native update batch into a net no-op, so the
fresh flag survived and iPhone kept wiping. The repair is the canonical
"different-string" trick (facebook/react-native#21572): write `value + ' '`
after the commit, then restore the real value on the next frame from
`lastValueRef` (so an interleaved keystroke is never clobbered). Skip when the
field is empty. Never resync via same-text writes.
