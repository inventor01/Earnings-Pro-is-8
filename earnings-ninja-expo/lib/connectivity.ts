import { setOnline, getSyncState } from './syncStatus';

// Connectivity tracker WITHOUT a native dependency (no NetInfo / expo-network —
// adding one would change the native fingerprint and break OTA delivery to the
// installed build). Online/offline is derived from real request outcomes:
//   - any HTTP Response (even 4xx/5xx) => server reachable => online
//   - a thrown fetch (network error)   => offline
// `api.ts` calls reportSuccess/reportFailure from its fetch wrapper. While
// offline we poll a cheap public endpoint so we can flip back to online (and
// trigger a drain) WITHOUT waiting for the user to make another request.

let probeUrl: string | null = null;
let probeTimer: ReturnType<typeof setInterval> | null = null;
let probing = false;

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
  startProbe();
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
