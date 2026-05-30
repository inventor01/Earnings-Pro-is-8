---
name: Add Entry modal field defaults & async races
description: Why async-loaded defaults in the persistent Add Entry modal must be guarded against late-resolution clobbering
---

The Add Entry modal (`app/(tabs)/index.tsx`) stays mounted; `visible` toggles
and `reset()` restores defaults on close. Several effects key off `[visible]`
to seed fields on open (widget prefill, edit prefill, last-used platform).

**Rule:** any default that is loaded **asynchronously** on open (e.g. reading a
last-used value from AsyncStorage) must, in its resolve callback, re-check the
*current* state before calling a setter — never apply blindly. Use refs for the
checks, because the async closure captures stale state.

**Why:** the user can pick a value or switch the entry type during the few ms
the async read is in flight. A blind `setX(stored)` then clobbers the manual
choice, or re-applies an order platform after the user switched to EXPENSE
(whose nudge had already forced OTHER). Effects with deps like `[entryType]`
won't re-run to correct it.

**How to apply:** track a "touched" ref (set in the manual onChange, reset on
each open) and mirror any type/mode the default is conditional on into a ref;
bail the async callback if touched, if the modal closed (cancel flag), or if the
relevant type no longer matches. Last-used platform default follows this pattern
and only applies to ORDER entries (expenses keep defaulting to OTHER).
