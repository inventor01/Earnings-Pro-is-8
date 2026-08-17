# Bug Fix History

## 2026-08-17 — Incorrect "at least one must stay visible" validation + platform icon standardization

### Category
Customization / Visibility / Data Integrity

### Symptoms
Hiding a revenue platform (or expense category) from the Add Entry customization was
sometimes blocked with "At least one platform must stay visible" even though the pill
row visibly showed two or more options. Reported on iOS and Android, most often around
Uber Eats.

### Platforms
iOS + Android (shared JS — identical logic on both).

### Root Cause (confirmed by code audit — NOT reproduced on device)
The platform pill row deliberately keeps rendering an already-hidden platform while it
is the current selection (e.g. editing an old entry filed under a since-hidden
platform, or a platform auto-selected as "last used"). The hide validation, however,
counted the *true* visible set (`APPS` minus `hiddenPlatforms` plus customs) from the
**current** state. So the screen could show 2 pills while the validator correctly saw
only 1 truly visible — and blocked the hide with a message that contradicted what the
user saw. Uber Eats surfaced most often because it is a common platform on historical
entries and was previously the post-hide auto-fallback selection.

There was no ID/normalization problem: built-ins are stored by stable enum key
(`UBEREATS`), never by display name; custom platforms cannot shadow built-in names
(server rejects `Uber Eats`/`UberEats` variants case-insensitively).

### Permanent Fix
- One shared resulting-state validator `canHideBuiltin(builtinKeys, hiddenKeys,
  keyToHide, customCount, minimumVisible=1)` in `earnings-ninja-expo/lib/platforms.ts`,
  returning `{ allowed, remainingVisibleCount }`. It computes what would remain AFTER
  the hide (set-based, so duplicates and already-hidden keys cannot skew the count) and
  is used by both the platform and the expense-category hide flows.
- Business rule confirmed with the product owner: at least ONE platform and ONE expense
  category must always stay visible (custom items count).
- Backend backstop added for expense categories in
  `backend/routers/expense_categories.py` (mirrors the existing platform rule): hiding
  all built-in categories is rejected with 400 unless a custom category exists. The
  platform rule already existed server-side.

### Icon standardization (same release)
Product decision: revenue platforms are identified by their color dot only.
- Custom platform pills no longer render an emoji prefix (affects e.g. Spark and
  Amazon Flex, which are user-created platforms — they are not built-ins).
- The emoji icon picker is hidden in the platform add/rename editor (color picker
  kept). Stored icons/colors are untouched — no user data migration.
- Expense categories and entry types intentionally keep their emojis (explicit product
  decision: "do not touch expenses").

### Why It Cannot Recur Through the Same Path
Validation is centralized and evaluates the resulting state, so any divergence between
"pills on screen" and "truly visible options" can no longer flip the outcome; hiding an
already-hidden key is a proven no-op. Regression tests pin the exact matrix.

### Files Changed
- `earnings-ninja-expo/lib/platforms.ts` — added `canHideBuiltin`.
- `earnings-ninja-expo/app/(tabs)/index.tsx` — platform + category hide prechecks use
  it; custom platform labels drop emoji; icon picker hidden in platform editor mode.
- `backend/routers/expense_categories.py` — minimum-visible backstop.
- `backend/tests/test_expense_categories.py` — new rule tests.
- `earnings-ninja-expo/__tests__/minVisibleValidation.test.ts` — new suite.

### Tests Added
- `minVisibleValidation.test.ts`: 2→1 allowed (either victim incl. Uber Eats), 1→0
  blocked, custom counts as remainder, already-hidden no-op, platform-agnostic sweep,
  category matrix, duplicate-key immunity.
- Backend: hide-all-categories rejected without custom; allowed with custom.

### QA Evidence
Static analysis + automated tests only (VERIFIED: jest + pytest suites pass; tsc
clean). On-device reproduction of the retained-pill scenario: NOT VERIFIED (no
device access from this environment).

### Affected Version/Build
iOS: 1.0.5 (builds ≤ 116). Android: 1.0.5 (versionCode ≤ 18).

### Fixed Version/Build
Ships in the next native builds after 2026-08-17 (iOS build 117+, Android
versionCode 19+ — OTA is not used for this app).
