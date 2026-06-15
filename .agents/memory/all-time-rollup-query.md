---
name: All-time cumulative rollup query
description: How to query lifetime totals (e.g. total miles) without counting future-dated entries
---

To get lifetime/cumulative totals from the rollup API (e.g. total miles for the Oil Change
alert), query `api.getRollupInRange(lowerBound, upperBound)` with a key under the `['rollup']`
namespace so existing `invalidateQueries(['rollup'])` on entry add/edit/delete refetches it.

**Two non-obvious constraints:**
- **Upper bound must be `now`, not a far-future date.** The entry date picker allows
  future timestamps (up to ~+24h), so a year-2999 upper bound counts miles/dollars that
  haven't happened yet and can fire thresholds early. Use `new Date().toISOString()` in the
  queryFn.
- **Bucket the cache key to the hour** (`new Date().toISOString().slice(0,13)`), not the
  raw `now`, or the key changes every render -> refetch storms + cache-entry churn. The
  queryFn still reads live `now` on each (re)fetch, so it stays accurate.

**Why:** balances correctness (exclude future) with React Query cache stability.
**How to apply:** any "lifetime total" widget driven by the rollup endpoint.
