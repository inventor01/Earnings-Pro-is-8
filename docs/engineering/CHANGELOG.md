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
