---
name: Paywall billed-price prominence (App Review 3.1.2(c))
description: Apple rejects paywalls where trial/intro pricing is more conspicuous than the billed amount — hierarchy rules for any paywall UI change.
---

# Rule
On any subscription paywall, the FULL BILLED amount must be the most clear and conspicuous pricing element (font, size, weight, color, position). Free-trial, introductory ("launch deal"), strikethrough, and calculated (per-month equivalent) pricing must be subordinate in both position and size.

**Why:** Apple rejected the app under Guideline 3.1.2(c) because the FallbackPaywall showed the intro price big with the billed price small + struck-through, had a hero "X FREE TRIAL" pill, bright filled "X FREE"/"LAUNCH DEAL" badges, and a CTA reading "Try Pro Free for X" with no billed amount at all.

**How to apply:** When touching the fallback paywall (or designing a RevenueCat dashboard paywall):
- Big price on each plan row = `product.priceString` (billed), never `introPrice`.
- No standalone trial hero badges; trial/intro chips must be muted/outline, smaller than the price.
- CTA leads with "Upgrade — $X" (billed); trial mention only as a smaller secondary line.
- Subordinate small-print phrasing like "Free for 7 days, then $X" is fine — it matches Apple's own StoreKit copy and contains the billed amount.
- Any such change to the shipped paywall requires whatever binary/OTA path App Review demands (rejections usually require a NEW binary, not an OTA).
