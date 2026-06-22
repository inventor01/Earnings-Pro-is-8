---
name: New-entry date default must be reseeded on modal open
description: The Add-entry modal's default date can go stale across midnight; reseed it to live "now" on each open or the first order of a new day files under Yesterday.
---

# New-entry date default & EST midnight rollover

The Add-entry modal (`earnings-ninja-expo/app/(tabs)/index.tsx`, AddEntryModal)
keeps `entryDate` in component state. The submitted `date`/`time` come from
`easternDateTime(entryDate)` (US/Eastern wall-clock — the backend's Today /
Yesterday views are EST-based).

## Rule
Whenever the modal opens for a NEW (non-editing) entry, reseed `entryDate` to a
fresh `new Date()`. Do not rely on mount-time init or `reset()`.

**Why:** state initialized with `useState(() => new Date())` is captured ONCE at
mount, and `reset()` only re-captures `new Date()` at CLOSE time. RN apps stay
mounted across days (backgrounded overnight), so without an on-open reseed the
first order after EST midnight inherits yesterday's date and `easternDateTime`
files it under Yesterday. "Test with midnight crossings" is the tell for this
class of bug.

**How to apply:** a `useEffect(() => { if (!visible || editing) return;
setEntryDate(new Date()); }, [visible, editing])`. Must skip edit mode — editing
seeds `entryDate` from the existing row's timestamp, and the two open-effects are
mutually exclusive on the `editing` flag so they don't clobber each other.

## Adjacent correctness (already in place — keep consistent)
- Client→server entry timestamps MUST be emitted as US/Eastern wall-clock via
  `easternDateTime` (NOT device-local), or non-EST users near the EST boundary
  get mislabeled days. The backend localizes those EST strings to UTC.
- The offline queue stores the full payload (date/time included), so a drained
  entry keeps its original correct EST date — not a source of this bug.
- The native iOS widget quick-add computes its date in Swift; that path is NOT
  OTA-fixable from JS.
