# Bug Fix History

## 2026-10-06 — Concurrent Gunicorn workers raced import-time schema creation

### Category
Backend / Deployment / Database Migration Safety

### Severity
High — a deployment that introduced new tables caused multiple Gunicorn workers to attempt schema creation concurrently. Railway eventually recovered after one worker created the table, but other workers failed to boot during the race.

### Platforms
Production backend / website API. Native iOS and Android binaries are not directly affected.

### Symptoms
The 2026-10-06 production deployment that introduced the Android beta tester queue logged worker boot failures during startup. PostgreSQL reported a duplicate catalog-object error while creating `android_beta_tester_signups`, including `duplicate key value violates unique constraint "pg_type_typname_nsp_index"`. Railway later reported the service online because a subsequent worker restart occurred after the table already existed.

### Confirmed Root Cause
**VERIFIED from Railway production deploy logs.** The Docker image starts Gunicorn with four workers. Each worker imports `backend.app`. That module performs legacy schema mutations and `Base.metadata.create_all(bind=engine)` at import time. Four workers therefore entered the schema-mutation path concurrently. SQLAlchemy's `checkfirst` behavior is not a cross-process lock: two workers can both observe that a table is absent and then both issue `CREATE TABLE`. PostgreSQL serializes catalog writes only after the competing DDL has already been issued, so one worker succeeded while another failed with the duplicate type/catalog constraint.

### Why the Architecture Allowed It
Schema changes are still executed from application-import code instead of a single dedicated migration process. That design predates the current multi-worker Gunicorn deployment. It was safe only when one process performed startup work. Adding a new model made the latent race visible.

### Permanent Fix
All existing import-time schema mutation work is now serialized with a PostgreSQL advisory lock. A worker must acquire `pg_advisory_lock(2026100601)` before any of the legacy migration calls or `Base.metadata.create_all` can run. The lock is held through the final post-`create_all` index migrations and then explicitly released and the dedicated connection closed. Other workers block until the first worker finishes, then re-run the existing idempotent checks against the completed schema.

SQLite/local development is unchanged because the advisory lock is PostgreSQL-only.

### Files Changed
- `backend/app.py` — added one database-wide migration advisory lock around the complete import-time schema-mutation window.
- `docs/engineering/BUG_FIX_HISTORY.md` — documented production evidence, root cause, fix, and regression prevention.

### Regression Prevention
- Existing backend smoke CI compiles the backend and exercises the `/go` beta queue on SQLite.
- Production verification must inspect Railway startup logs after schema-changing deploys for worker boot errors and duplicate DDL/catalog errors.
- Future schema work should continue moving toward a dedicated versioned migration command rather than adding uncoordinated import-time DDL. Until that migration architecture is replaced, the advisory lock is the invariant protecting multi-worker startup.

### QA Evidence
- Original failure: **VERIFIED** in Railway deployment `92fb7980-c036-4a32-8105-db2819d6257e`.
- Root cause: **VERIFIED** from the four-worker Gunicorn command plus concurrent PostgreSQL `CREATE TABLE android_beta_tester_signups` failure in deployment logs.
- Fix before production deployment: static review + backend CI required.
- Production verification after hotfix: inspect fresh Railway deploy logs; no worker boot/schema-race errors may remain before this item is considered closed.

### Affected Version/Build
Server deployment at Git commit `76d4a3698cd33d16a9032bb4561ed8998ac1de5a`.
iOS version/build: N/A — server startup issue.
Android versionCode: N/A — server startup issue.

### Fixed Version/Build
Server hotfix following the 2026-10-06 deployment.
iOS version/build: N/A.
Android versionCode: N/A.

### Rollback / Risk Notes
The lock does not alter application data or schema definitions. If acquiring the PostgreSQL lock fails, startup fails instead of running unsynchronized schema mutations. PostgreSQL releases the session advisory lock automatically if the worker process or database connection terminates unexpectedly.


## 2026-08-17 — iOS password text deletes after hide/show toggle (3rd and root-cause fix)

### Category
Authentication / iOS / Password Input

### Symptoms
On iPhone only: type a password → tap the eye to show → tap again to hide →
continue typing → previously typed text sometimes disappears. Android always
worked. Two earlier fixes reduced but did not eliminate the failure.

### Confirmed Root Cause (evidence: code audit + upstream issue; NOT reproduced on device)
Flipping `secureTextEntry` marks the native UITextField "fresh", so iOS clears
all text on the next keystroke (facebook/react-native#21572). The app's repair
rewrote the native text with a different string via
`inputRef.setNativeProps({ text })`. But this app runs the New Architecture
(Fabric — Expo SDK 54 default, RN 0.81), where `setNativeProps({ text })` on a
TextInput is **silently dropped once the user has typed**
(facebook/react-native#47266, open, iOS/Fabric). So the repair no-oped in
exactly the buggy scenario, the fresh flag survived, and the next keystroke
wiped the field.

### Why Android Doesn't Fail
Android's EditText has no "clear secure field on next keystroke" behavior;
the resync path is iOS-only and Android never executes it.

### Why the Previous Fixes Were Insufficient
1. Fix #1 moved the resync into a post-commit effect (correct ordering) — but
   rewrote the SAME text, which native coalesced into a no-op.
2. Fix #2 added the different-string trick (`value + ' '` then restore) — the
   right algorithm, but still shipped through `setNativeProps`, the channel
   Fabric drops after user input. Intermittent because the write only dies
   after native/JS event counts diverge (i.e., after typing).

### Permanent Fix
`components/PasswordInput.tsx`: the two-phase different-string rewrite now
flows through **committed React value updates** — a temporary internal
`resyncDisplay` state overrides the rendered `value` (`base + ' '`, then back
to the parent value next frame). Both writes travel Fabric's real
state/eventCount path, so they cannot be dropped. `setNativeProps` is no
longer used for text at all. A keystroke landing inside the one-frame window
immediately cancels the override so it can never clobber the user's input, and
`normalizeResyncText` still strips the temp space from any change event in the
window. Android path unchanged (iOS-only guard retained).

### Files Changed
- `earnings-ninja-expo/components/PasswordInput.tsx` — resync via committed
  state instead of setNativeProps; window-cancel on keystroke.
- `earnings-ninja-expo/__tests__/passwordResyncNormalize.test.ts` — extended.

### Tests Added
Toggle-sequence regression cases: type→show→hide→type, triple toggle, space
typed in window, paste in window, write echo. 176 jest tests pass; tsc clean.

### QA Evidence
Static analysis + upstream-issue evidence + automated tests (VERIFIED).
On-device reproduction/verification: NOT VERIFIED (no device access from this
environment) — user to verify on a real iPhone in the next TestFlight build.

### Affected Version/Build
All password screens use the one shared `PasswordInput` (login/signup, 2FA
disable, delete-account confirm). iOS 1.0.5 builds ≤ 117 affected.

### Fixed Version/Build
iOS 1.0.5 build 118; Android 1.0.5 versionCode 21 (kicked off 2026-08-17;
OTA is not used for this app).

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
Product decision (revised after user feedback): platforms are uniform by default —
color dot + name, no emoji — but a user-picked emoji still renders and the icon
picker stays available in the platform editor. Stored icons/colors are untouched —
no user data migration.
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
