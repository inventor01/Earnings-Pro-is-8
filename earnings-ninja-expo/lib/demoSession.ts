// ─── Local sandbox Demo Mode: session state ──────────────────────────────────
//
// "Try Demo" no longer creates a throwaway server user (the old
// POST /api/auth/demo flow wrote real rows into the production DB on every
// tap). Instead the app flips into a fully client-side sandbox:
//   - no network calls, no JWT, no SecureStore token
//   - all data lives in memory (lib/demoStore.ts) and is reseeded on every
//     demo start — killing the app or exiting demo always resets to the seed
//   - premium is simulated inside the demo only (see lib/revenuecat.tsx)
//
// This module is deliberately React-free so low-level modules (api.ts,
// platforms.ts, widgetSync.ts, notifications.ts) can consult `isDemoActive()`
// without pulling in any UI. React state lives in authContext, which calls
// enter/exit here and mirrors the flag.
//
// SECURITY BOUNDARY: while demo is active, api.ts routes every call to the
// demo adapter and trackedFetch refuses to hit the network, so demo edits can
// never reach the production API. Storage guards (platforms/localStore/
// widgetSync) keep demo data out of every device-local mirror so a later real
// login can never inherit sandbox data.

import type { User } from './api';

export const DEMO_USER_ID = 'demo-local-sandbox';

export const DEMO_USER: User = {
  id: DEMO_USER_ID,
  email: 'demo@earningsninja.local',
  username: 'demo_ninja',
  first_name: 'Demo',
  last_name: 'Ninja',
  email_verified: true,
  is_demo: true,
  // Skip the signup onboarding funnel — the demo IS the tour.
  onboarding_completed: true,
  // Let the dashboard walkthrough offer itself (session-local for demos).
  walkthrough_completed: false,
};

let active = false;

type Listener = () => void;
const listeners = new Set<Listener>();

function emit(): void {
  for (const l of Array.from(listeners)) {
    try { l(); } catch {}
  }
}

export function isDemoActive(): boolean {
  return active;
}

export function subscribeDemo(fn: Listener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function enterDemoSession(): void {
  if (active) return;
  active = true;
  resetConversionState();
  // Lazy import avoids a hard runtime cycle if demoStore ever needs session
  // state; reseeds the in-memory dataset so every demo starts identical.
  const { resetDemoStore } = require('./demoStore') as typeof import('./demoStore');
  resetDemoStore();
  if (__DEV__) console.log('[demo] session started (local sandbox, no network)');
  emit();
}

export function exitDemoSession(): void {
  if (!active) return;
  active = false;
  resetConversionState();
  const { destroyDemoStore } = require('./demoStore') as typeof import('./demoStore');
  destroyDemoStore();
  if (__DEV__) console.log('[demo] session ended — sandbox state destroyed');
  emit();
}

// ─── Conversion prompt state ─────────────────────────────────────────────────
// After meaningful interaction (a few added entries), the demo chrome shows a
// single non-intrusive "Ready to track your real earnings?" prompt. Counters
// live here (in-memory) so they reset with the session.

const CONVERSION_ENTRY_THRESHOLD = 3;

let entriesAdded = 0;
let promptShown = false;

function resetConversionState(): void {
  entriesAdded = 0;
  promptShown = false;
}

export function noteDemoEntryAdded(): void {
  if (!active) return;
  entriesAdded += 1;
  if (__DEV__) console.log(`[demo] event demo_entry_added (count=${entriesAdded})`);
  emit();
}

export function shouldShowConversionPrompt(): boolean {
  return active && !promptShown && entriesAdded >= CONVERSION_ENTRY_THRESHOLD;
}

export function markConversionPromptShown(): void {
  promptShown = true;
  if (__DEV__) console.log('[demo] event demo_conversion_prompt_shown');
  emit();
}
