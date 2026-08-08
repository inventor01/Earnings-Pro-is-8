import { setOnline, getSyncState } from './syncStatus';

// Connectivity tracker WITHOUT a native dependency (no NetInfo / expo-network —
// adding one would change the native fingerprint and break OTA delivery to the
// installed build). Online/offline is derived from real request outcomes:
//   - any HTTP Response (even 4xx/5xx) => server reachable => online
//   - a thrown fetch (network error)   => offline
// `api.ts` calls reportSuccess/reportFailure from its fetch wrapper. While
// offline we poll a cheap public endpoint so we can flip back to online (and
// trigger a drain) WITHOUT waiting for the user to make another request.

import { isDemoActive, subscribeDemo } from './demoSession';

let probeUrl: string | null = null;
let probeTimer: ReturnType<typeof setInterval> | null = null;
let probing = false;
// Whether a probe was armed when demo started, so we can deliberately resume
// it after the sandbox ends (the sandbox itself never probes).
let probeWasArmed = false;

// Demo Mode lifecycle: entering the sandbox CANCELS any armed probe interval
// (no timer left ticking against the network); exiting restarts it only if it
// was armed before, so a previously-offline session resumes recovery polling.
subscribeDemo(() => {
  if (isDemoActive()) {
    probeWasArmed = probeTimer !== null;
    stopProbe();
  } else if (probeWasArmed) {
    probeWasArmed = false;
    startProbe();
  }
});

const PROBE_INTERVAL_MS = 8000;

export function initConnectivity(healthUrl: string): void {
  probeUrl = healthUrl;
}

export function isOnline(): boolean {
  return getSyncState().online;
}

export function reportSuccess(): void {
  setOnline(true);
  stopProbe();
}

export function reportFailure(): void {
  setOnline(false);
  // Never arm a probe from inside the sandbox (trackedFetch throws before any
  // demo request, but keep this belt-and-suspenders).
  if (isDemoActive()) return;
  startProbe();
}

/** Test-only visibility into whether the recovery interval is armed. */
export function isProbeArmed(): boolean {
  return probeTimer !== null;
}

function startProbe(): void {
  if (probeTimer || !probeUrl) return;
  probeTimer = setInterval(runProbe, PROBE_INTERVAL_MS);
}

function stopProbe(): void {
  if (probeTimer) {
    clearInterval(probeTimer);
    probeTimer = null;
  }
}

async function runProbe(): Promise<void> {
  // Demo Mode: the interval is cancelled on demo entry (see subscribeDemo
  // above); this guard is a last line of defense against a stray tick.
  if (isDemoActive()) return;
  if (probing || !probeUrl) return;
  probing = true;
  try {
    // Any response at all means the server is reachable. We don't care about
    // the status code — only that the socket round-tripped.
    await fetch(probeUrl, { method: 'GET' });
    reportSuccess();
  } catch {
    // Still offline — keep probing on the interval.
  } finally {
    probing = false;
  }
}
