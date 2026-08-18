# Changelog

## Unreleased (ships in the next native build after iOS 1.0.5 (117) / Android 1.0.5 (vc20))

### Press & hold "Platform" / "Type" titles to rename them
- On Add Entry → Revenue, long-press the **Platform** or **Type** section
  heading to rename the title (e.g. "Platform" → "Gig App", "Type" → "Order
  Type"). Strict 12-character maximum with a live counter; trimmed before
  save; empty/whitespace-only names can't be saved; "Reset to default" in the
  editor (or typing the default name back).
- Saved on the account (syncs across devices, survives reinstall) via the
  existing label-override store (`kind='heading'`, keys `PLATFORM`/`TYPE`),
  server-enforced 12-char cap. Display-only: platform/type records, entries,
  analytics keys, and Add Entry form state are untouched.
- The renamed titles also appear on the transaction detail view. Expense
  headings keep their defaults for now (Revenue-only by product decision).
- Accessibility: the headings expose an explicit VoiceOver/TalkBack rename
  action, so long-press is not the only path.

### Pick your own emoji for the "Platform" / "Type" titles
- The same long-press editor now has an emoji box next to the title field.
  Type any emoji from the regular keyboard (skin tones, flags, and combined
  emoji all work); only the first emoji is kept. Clear the box (or hit Reset)
  to go back to the defaults (🚗 for Platform, 📝 for Type).
- You can change just the emoji and keep the default title — the two are
  independent. Saved on the account like the titles (syncs across devices,
  survives reinstall); older app versions that only send a title never wipe a
  saved emoji. Display-only; entries and analytics are untouched.
- Demo Mode keeps its own sandboxed copy, like the titles.
