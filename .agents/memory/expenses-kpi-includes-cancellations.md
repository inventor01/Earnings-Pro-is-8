---
name: Expenses KPI includes cancellations
description: The dashboard EXPENSES number counts cancellations too; any expense drill-down must filter amount<0, not type==='EXPENSE'.
---

The dashboard EXPENSES KPI comes from `rollup.expenses`, which the backend computes
as the magnitude of **every** negative entry (`expenses += abs(amount)` over all
`amount < 0` rows — i.e. EXPENSE *and* CANCELLATION). The frontend analytics
recompute mirrors this (all negative amounts roll into "expenses").

**Why:** a drill-down/list that filters `type === 'EXPENSE'` only will show a total
LOWER than the tapped KPI whenever cancellations exist, breaking user trust in the
number.

**How to apply:** any "expenses" detail view, export, or subtotal that must
reconcile with the EXPENSES KPI should filter `Number(amount) < 0` (not by type).
Cancellations have no `category`, so group them into a synthetic 'CANCELLATION'
bucket for category/group breakdowns rather than defaulting them to 'OTHER'.
