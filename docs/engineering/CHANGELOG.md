# Earnings Ninja Engineering Change Log

## 2026-10-06 — Android beta two-step invite flow

- Redesigned Android beta confirmation and invite emails with a branded, mobile-friendly template.
- The first email confirms the request immediately but intentionally does not include the Google Play tester link.
- Added admin confirmation so the delayed invite is only armed after the submitted Google account has been added to the Play Console closed-test list.
- Added a configurable minimum delay (default: 60 minutes) before the Google Play tester link can be sent.
- Added a protected invite-processing endpoint designed for a scheduled Railway job.
- Updated the /go Android funnel to explain the setup delay and Google Play propagation behavior before the user submits.
- Removed the early Google Play tester link from the post-submit funnel screen to prevent users from seeing a missing "Become a tester" button before their account is ready.
- Added smoke coverage for the new routes, delay messaging, and processor authentication.

Operational state flow: pending -> approved -> sending -> invited.

## 2026-10-06 — Android beta conversion copy refinement

- Rewrote the Android beta funnel and both tester emails in a more formal, trust-oriented voice.
- Replaced casual language with explicit access, approval, activation, and enrollment terminology.
- Strengthened expectation-setting around the approximately one-hour Google Play activation window.
- Clarified that no action is required until the second email arrives, reducing premature tester-page visits and perceived failures.
- Refined the final enrollment CTA and instructions to make the conversion path more direct.


## 2026-10-07 — Ninja Creative OS v1

- Added a protected internal creative control plane at /creative for owner oversight.
- Added persistent creative job records covering research, approval, rendering, posting and winner states.
- Added weighted opportunity scoring across virality, Ninja fit, simplicity, originality, cost efficiency and brand fit.
- Added protected APIs for queue listing, summary metrics, approvals, rejections and job updates.
- The dashboard intentionally shows only high-priority owner decisions plus queue and winner state.
- No public app user data is exposed by the creative dashboard; access requires CREATIVE_OS_TOKEN.
- Added CI coverage for authentication, table creation, job creation, summary, and approval flow.


## 2026-10-07 — Creative Research Engine v1

- Added a dedicated evidence-backed research layer to Ninja Creative OS.
- Research candidates are now persisted separately from production jobs so source evidence and subjective creative scoring cannot be conflated.
- Added research stages: raw, qualified, watched, pattern_confirmed, top3, selected, rejected and stale.
- Added cross-platform evidence fields for TikTok, Instagram and YouTube, including views, engagement, creator size, outlier/breakout metrics, VPH, actual-watch status and independent pattern support.
- Added scene-analysis fields for first frame, first-second hook, first-three-second hook, camera, motion, pacing, payoff, loop and sound dependence.
- Added an independent creative rubric for scroll-stop strength, Ninja fit, simplicity, originality, cost efficiency, loop/share potential, broad-audience fit and brand fit.
- Enforced that pattern_confirmed requires at least three independent supporting examples.
- Added idempotent source-key upserts so repeated research runs refresh an existing source instead of duplicating it.
- Added a protected batch-ingestion API plus research summary/list/update endpoints.
- Added owner-side Promote and Pass actions. Promote converts a research candidate into an approved CreativeContentJob while preserving source evidence.
- Redesigned /creative with a Research Engine funnel, actual-watch counts, confirmed-pattern counts and a top-three owner decision surface.
- Added regression smoke coverage for research-table creation, batch ingest, scoring, evidence invariants, summary and promotion into production.
