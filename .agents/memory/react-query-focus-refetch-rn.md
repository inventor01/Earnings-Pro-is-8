---
name: React Query focus refetch in React Native (Expo app)
description: Why the Expo app needs focusManager wired to AppState, or data only refreshes on a cold app restart.
---

# React Query refetch-on-foreground must be wired manually in React Native

React Query's `refetchOnWindowFocus` (default `true`) NEVER fires on native — there
is no browser window-focus event. Unless you forward `AppState` into React Query's
`focusManager`, returning the app to the foreground does NOT refetch stale queries.

**Symptom this causes:** "some changes don't show up until you exit the app and
reopen." A full exit+reopen recreates the `QueryClient` (in-memory cache gone), so
everything refetches and the change finally appears. Anything that changed *outside*
a local mutation — backend hourly OAuth order sync, edits from the web app/another
device, or any data a mutation didn't invalidate — is invisible until that cold start.

**Fix (JS-only / OTA-safe):** in `app/_layout.tsx`, a dedicated always-on effect
(NOT token-gated — focus is app-lifecycle state, not auth state):
```ts
AppState.addEventListener('change', (s) => {
  if (Platform.OS !== 'web') focusManager.setFocused(s === 'active');
});
```
With the existing `staleTime: 30_000`, queries stale >30s refetch on foreground;
quick background/foreground toggles stay suppressed by staleTime.

**Why not token-gate it:** query focus state is app lifecycle, not auth. Keep it
separate from the token-gated AppState listener that drains the offline queue.

**Known transient (acceptable):** if offline-queued optimistic rows (negative ids)
exist and the app returns online after >30s, a focus refetch can briefly show server
state before the concurrent `tryDrain()` flushes + re-invalidates. Self-correcting,
not data loss. If it ever needs eliminating: `setFocused(false)` → await drain →
`setFocused(true)`.

**If product wants "always refresh on foreground even within 30s":** set
`refetchOnWindowFocus: 'always'` on the critical-screen queries (not done — current
30s staleTime is intentional to avoid over-fetching).
