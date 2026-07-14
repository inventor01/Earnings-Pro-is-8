---
name: Paywall billed-price prominence (App Review 3.1.2(c))
description: Apple rejects paywalls where trial/intro pricing is more conspicuous than the billed amount — hierarchy rules for any paywall UI change.
---

# Rule
On any subscription paywall, the FULL BILLED amount must be the most clear and conspicuous pricing element (font, size, weight, color, position). Free-trial, introductory ("launch deal"), strikethrough, and calculated (per-month equivalent) pricing must be subordinate in both position and size.

**Why:** Apple rejected the app under Guideline 3.1.2(c) because the FallbackPaywall showed the intro price big with the billed price small + struck-through, had a hero "X FREE TRIAL" pill, bright filled "X FREE"/"LAUNCH DEAL" badges, and a CTA reading "Try Pro Free for X" with no billed amount at all.

**How to apply:** When touching the fallback paywall (or designing a RevenueCat dashboard paywall):
- Big price on each plan row = `product.priceString` (billed), never `introPrice`.
- No strikethrough billed price; no big intro-price display; trial chips/ribbons smaller than the billed price.
- Subordinate small-print phrasing like "Free for 7 days, then $X" is fine — it matches Apple's own StoreKit copy and contains the billed amount.
- Any such change to the shipped paywall requires whatever binary/OTA path App Review demands (rejections usually require a NEW binary, not an OTA).

**Current accepted-risk position (user-directed, Cal-AI pattern):** the paywall is trial-forward — trial headline, trial timeline whose billing step states the billed amount, plan cards with a small "{N} DAYS FREE" ribbon but an 18pt/900 billed price as the dominant price, CTA "Start My N-Day Free Trial" with a "N days free, then $X per year. Auto-renews…" footnote directly beneath. This mirrors a shipping approved app; billed amount is disclosed on three surfaces. If Apple objects again, first fallback = swap CTA text back to "Upgrade — $X" (one-line change). ALL trial UI is conditional on a real ASC free trial existing; without one the paywall renders the billed-first layout.
