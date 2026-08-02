---
name: Notification content day-boundary staleness
description: Locally scheduled notifications bake content at arm time; content must be day-aware and re-armed on every earnings mutation, not just foreground.
---

Rule: any locally scheduled notification whose copy contains volatile numbers (today's profit, week total) must know whether it delivers the SAME calendar day it was armed. If it delivers tomorrow, use only persistent values (goal target) or number-free copy.

**Why:** "Evening recap" armed after 8pm delivers tomorrow with today's profit baked in — reads as flat wrong; morning week-profit is wrong across a week boundary.

Also: one-shot-only scheduling goes silent after ~24h without an app open. Fix (Aug 2026): queue a rolling multi-day window — day 0 fresh sameDay-aware content, later days number-free rotating copy (deterministic per delivery date), cancel by id-prefix before re-arm.

**How to apply:** `nextOccurrence()` in the pure module `lib/notificationContent.ts` returns `{date, sameDay}`; body authors branch on it. Also: suppressed (cooldown/mutex) reschedules must arm a trailing refresh rather than drop, and every earnings mutation success + offline-queue drain must call the refresh — foreground-only re-arming leaves in-session saves stale. Pure content logic lives import-free so it's testable in plain Node.
