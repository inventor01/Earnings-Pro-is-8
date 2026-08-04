---
name: Tour seen-flag timing
description: Auto-showing tutorials must persist "seen" at start, not on finish
---
Any auto-showing tour/checklist must write its per-account "seen/done" flag the moment it actually starts rendering — not only in the finish/skip handler.

**Why:** users can dismiss the host surface (swipe a pageSheet closed, kill the app) without ever hitting finish; the flag never persists and the tour auto-starts on EVERY open. This shipped as a real bug in the Add Entry walkthrough (fixed in iOS build 77).

**How to apply:** in the auto-start effect, right where the welcome phase is set for a production (non-demo) account, persist the flag for ALL accounts. (Aug 2026: demo's every-launch replay was RETIRED — demo persists the seen flag like real accounts.)
