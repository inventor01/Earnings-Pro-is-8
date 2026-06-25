---
name: New-entry time must be captured at SAVE, not modal-open
description: Why a new entry's time silently defaulted to a stale value (e.g. "9:28am") and the rule for choosing the save instant.
---

# A new entry's time must be the SAVE instant, not the modal-OPEN instant

In the Add/Edit modal, `entryDate` is seeded when the modal OPENS (a reseed
`useEffect` on `visible`→true) and the date/time strings sent to the backend
used to be computed at RENDER from `entryDate`. So a plain new entry was filed
under the time the modal was OPENED, not when the user tapped Save. If the
modal/app was opened earlier (app launched, backgrounded then resumed, or the
user lingered filling the form), every entry silently saved that stale
open-time — the user reported it "always defaults to 9:28am".

**Rule:** in `handleSave`, only reuse `entryDate` when the user genuinely chose
it; otherwise use the live save instant.
`useLiveNow = !editing && !dateTouchedRef.current && !defaultDate` →
`saveInstant = useLiveNow ? new Date() : entryDate`. Format the EST date/time
strings from `saveInstant`, and stash it in `pendingInstantRef` so the create
`onMutate` builds the optimistic row's timestamp from the SAME instant (it reads
`pendingInstantRef.current ?? entryDate`) — otherwise the optimistic row and the
server row disagree and the freshly-added row jumps position on refetch.

**Why the three exclusions:** `editing` seeds `entryDate` from the row;
`dateTouchedRef` flips true when the user changes the picker (deliberate
choice); `defaultDate` is the viewed past day for backdated entries. In all
three the user/UI picked the instant, so don't overwrite it with "now".

**How to apply:** reset `dateTouchedRef`/`pendingInstantRef` on fresh open and in
`reset()`. The Save button is disabled while a mutation is pending (`isSaving`),
so one modal can't fire two concurrent creates — the ref read in `onMutate` is
safe in practice.
