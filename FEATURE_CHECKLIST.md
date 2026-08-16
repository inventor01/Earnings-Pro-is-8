# Feature Development Checklist

Run through this checklist for **every feature** — human or agent built. Each item is a hard-won lesson from production incidents and App Review rejections (detail in `.agents/memory/`). Skip a section only if it genuinely doesn't apply.

## 1. Data & time correctness

- [ ] All day-bucketing uses **one single project-defined timezone contract** — never the raw device clock. Client and server must agree on the same bucketing timezone helper (historically fixed US/Eastern via `estTodayUTC()`; being migrated to each user's timezone — follow whichever contract the shared date helpers currently implement, and never fork a second convention).
- [ ] Per-date keys (e.g. daily goals) roll over at the bucketing timezone's midnight; don't mirror inherited defaults under date keys, and don't clear mirrors on transient errors.
- [ ] New-entry timestamps are captured at **save time**, not modal-open time (a stale seeded `entryDate` caused "always 9:28am").
- [ ] Earnings totals/aggregates are always computed with an explicit user filter — never unscoped.
- [ ] Account deletion purges via the ORM-metadata FK sweep, never a hardcoded table list. New tables with user FKs must be covered.

## 2. Optimistic updates & offline

- [ ] Optimistic entry inserts target only query windows whose date range contains the entry.
- [ ] Optimistic `['rollup']` patches are scoped per-window via `keyWindowContainsDate`; a date move has net delta 0 and must patch both windows.
- [ ] `onMutate` only cancels queries that already hold data, or a killed first fetch strands the dashboard on its skeleton.
- [ ] A positive-id PUT/DELETE 404 = stale cached row → resync (rollback + refetch + friendly message), not a hard error.
- [ ] Queued offline entries have a stable client identity (synthetic id + idempotency_key), serialized AsyncStorage read-modify-write, a single-drain guard, and per-item delete re-checks.
- [ ] Online entry/rollup reads re-overlay the pending queue on the **success** path too — refetch must not erase queued saves; dedupe replayed creates by idempotency_key.
- [ ] Cold-start offline reads use local computation (localStore mirror + queue overlay), not just React-Query cache; reconcile is server-wins LWW after draining.
- [ ] Deleted ids get a short-TTL tombstone filtered **before** mirror writes and offline reads, or racing GETs resurrect the row.
- [ ] Queue drain has a post-enqueue trigger + foreground backoff retry; a server-reachable transient 5xx never flips connectivity offline.
- [ ] React Query focus refetch is wired to AppState (`focusManager`) — otherwise data only refreshes on cold restart.

## 3. Client/server contract

- [ ] Any client-side validation change (min lengths, caps) is mirrored in the backend validator, or the server silently rejects what the app allows.
- [ ] Remember the mobile app talks to the **deployed Railway backend** — local backend changes are not live until pushed + deployed.
- [ ] Auth-identifier changes (change email) require re-auth step-up, block passwordless accounts, and rotate the JWT (it embeds email).
- [ ] OTP/MFA flows cap attempts **and** resends, and anchor the challenge window to its original issue time.
- [ ] Guarded-migration pattern: any grandfather/backfill `UPDATE` lives **inside** the add-column guard, or re-runs corrupt new rows.

## 4. Demo mode / account scoping / flags

- [ ] Demo Mode is fully client-side; any new AsyncStorage / widget / notification / RevenueCat write gets an `isDemoActive` guard — both read and write directions.
- [ ] Every new per-account AsyncStorage mirror gets a clear call in the logout wipe, or the next account inherits stale data.
- [ ] Once-ever UX flags ("seen" flags) are mirrored server-side on `auth_users` (guarded-migration grandfather pattern); device-only flags die on reinstall. Late server-true must veto an already auto-opened surface.
- [ ] Auto-show tours persist "seen" when they **start**, not only on finish — otherwise swiping the sheet away re-triggers forever.
- [ ] Onboarding-style funnels show only on an explicit server flag `false`; fail closed to the dashboard.

## 5. RN & platform gotchas

- [ ] Never present the fullScreen paywall over a pageSheet — gate with `requirePro()` **before** opening the sheet, or unwinding the stack freezes the ScrollView beneath.
- [ ] Every form-bearing nested `Modal` needs its **own** KeyboardAvoidingView; a parent KAV never reaches inside a nested Modal.
- [ ] DateTimePicker `mode="datetime"` is iOS-only; Android needs two-step date → time dialogs or it blank-screen crashes.
- [ ] Any expo-video/expo-audio use (even muted) sets `audioMixingMode`/`interruptionMode` to mixWithOthers, or it pauses Spotify.
- [ ] Clear temporary theme overrides before mounting new UI; entering-animated surfaces freeze mount-time colors (white-on-white cards).
- [ ] Scheduled-notification copy with volatile numbers is sameDay-aware; re-arm on every earnings mutation + queue drain.
- [ ] Swift code in `earnings-ninja-expo/targets/` slips past tsc/expo-export and only fails ~3min into the EAS Xcode compile — review carefully before building.
- [ ] In-app legal links use `${API_BASE}/privacy` etc.; curl-200-check every URL App Review will see.
- [ ] Paywall: the billed amount must be the dominant price element (App Review 3.1.2(c)); trial/strikethrough/CTA copy stays subordinate.

## 6. Custom entry types & rollups

- [ ] Custom Type pills store the BASE enum (BONUS/EXPENSE) plus `custom_type` name; `kind` is fixed at creation.
- [ ] `custom_type` (and any new entry field) is threaded through **all** optimistic and offline paths, not just the online create.
- [ ] RevenueCat gating uses entitlement id `pro` (client + seed must match) and fails **open** without the native module.

## 7. Shipping

- [ ] OTA updates are **unreliable on this project** — ship everything (even JS-only changes) in native TestFlight builds until a binary proves updates apply cleanly.
- [ ] Native build: `eas build --platform ios --profile testflight --auto-submit` with `GIT_CEILING_DIRECTORIES=/home/runner EAS_NO_VCS=1`; sed `package-firewall.replit.local` → `registry.npmjs.org` in package-lock.json first.
- [ ] `eas build` can die silently after upload without registering — verify with `eas build:list --json`; Apple caps ~7 uploads/app/day.
- [ ] Landing site changes: `cd landing && npm run build`, commit the new `dist`, git push, **and** republish the Replit deployment (apex domain = Replit, not Railway).
- [ ] Backend changes go live via GitHub push → Railway deploy; verify against the live Railway URL + demo account.
- [ ] RevenueCat / native-dep / app.json / buildNumber changes always require a native build, never OTA.

## 8. Verification

- [ ] `cd earnings-ninja-expo && npx tsc --noEmit` exits 0.
- [ ] `cd earnings-ninja-expo && npx expo export --platform ios` exits 0.
- [ ] `npx jest --silent` (expo) and `python -m pytest backend/tests -q` pass.
- [ ] Test the feature offline, in Demo Mode, across a logout/login account switch, and across a bucketing-timezone midnight boundary (per the current timezone contract) where relevant.
- [ ] Verify optimistic UI: add/edit/delete an entry and confirm KPIs/rollups update without a cold restart.
- [ ] curl-check any URL surfaced to users or App Review (legal pages, reset pages) returns 200 on the **deployed** domain.
