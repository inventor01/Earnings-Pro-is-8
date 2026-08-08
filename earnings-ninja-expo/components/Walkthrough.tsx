// ─── Interactive App Walkthrough ──────────────────────────────────────────────
// Premium spotlight-style guided tour shown once after onboarding (every launch
// for demo accounts). Highlights real UI with a dimmed backdrop + floating
// cards. Self-contained: screens register anchor views in a module-level
// registry; the overlay measures them with measureInWindow, so no context
// threading through the (very large) dashboard file is needed.
//
// Display rules:
//  • Production users: auto-shows once after onboarding; a persistent
//    per-account flag (AsyncStorage) prevents it from ever auto-showing again.
//  • Demo accounts: the flag is ignored and never written — the tour runs on
//    every launch (onboarding → walkthrough → home).
//  • Replayable any time from Settings → Help → Replay App Walkthrough.
//  • Reduce Motion: pulses/springs are replaced with plain fades.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo, Dimensions, Platform, Pressable, Text, View, findNodeHandle, useWindowDimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import Animated, {
  Easing, FadeIn, FadeOut, cancelAnimation, useAnimatedStyle, useSharedValue,
  withRepeat, withSequence, withTiming,
} from 'react-native-reanimated';
import { useAuth } from '@/lib/authContext';
import { api } from '@/lib/api';
import { useTheme, useThemeControls } from '@/lib/theme';

// ─── Persistence ──────────────────────────────────────────────────────────────

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const doneKey = (userId: number | string) => `walkthrough_done:${userId}`;

export async function readWalkthroughDone(userId: number | string): Promise<boolean> {
  try { return (await AsyncStorage.getItem(doneKey(userId))) === '1'; } catch { return false; }
}
async function writeWalkthroughDone(userId: number | string): Promise<void> {
  try { await AsyncStorage.setItem(doneKey(userId), '1'); } catch {}
}
export async function resetWalkthrough(userId: number | string): Promise<void> {
  try { await AsyncStorage.removeItem(doneKey(userId)); } catch {}
}

// ─── Target registry ──────────────────────────────────────────────────────────
// Screens attach anchor views via ref callbacks: ref={registerWalkthroughTarget('hero')}

export type WalkthroughTargetId =
  | 'hero' | 'addEntry' | 'calendar' | 'analytics' | 'goals' | 'kpis' | 'settings' | 'entryRow';

const targets = new Map<WalkthroughTargetId, View | null>();

export function registerWalkthroughTarget(id: WalkthroughTargetId) {
  return (node: View | null) => { targets.set(id, node); };
}

type Rect = { x: number; y: number; width: number; height: number };

// Targets that live OUTSIDE the dashboard ScrollView — scrolling can't move
// them, so never try. NOTE: the header (incl. the calendar icon) scrolls WITH
// the content, so 'calendar' is NOT fixed — going back to it from further down
// must scroll the screen back up.
const FIXED_TARGETS = new Set<WalkthroughTargetId>(['addEntry', 'settings']);

function measureRaw(id?: WalkthroughTargetId): Promise<Rect | null> {
  return new Promise(resolve => {
    const node = id ? targets.get(id) : null;
    if (!node || !findNodeHandle(node)) return resolve(null);
    try {
      node.measureInWindow((x, y, width, height) => {
        if (!width || !height) return resolve(null);
        resolve({ x, y, width, height });
      });
    } catch { resolve(null); }
  });
}

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

// Poll the anchor until its window position stops moving (the native animated
// scroll has settled) instead of guessing with a fixed delay — a fixed wait
// either cuts the scroll short or adds a dead pause before the spotlight lands.
async function waitForScrollSettle(id: WalkthroughTargetId): Promise<Rect | null> {
  let prev = await measureRaw(id);
  for (let i = 0; i < 14; i++) { // hard cap ~1s so a hung measure can't stall the tour
    await sleep(70);
    const cur = await measureRaw(id);
    if (!cur) return prev;
    if (prev && Math.abs(cur.y - prev.y) < 1) return cur;
    prev = cur;
  }
  return prev;
}

// The dashboard registers a relative scroller so the tour can bring
// scrolled-away anchors (goals, analytics, KPIs) into view instead of
// spotlighting a half-cut element.
let scrollBy: ((dy: number) => void) | null = null;
export function registerWalkthroughScroller(fn: ((dy: number) => void) | null) {
  scrollBy = fn;
}

// Measure a step's anchor; if it's cut off by the header or the sticky Add
// Entry bar, scroll it into the safe band and re-measure.
async function measureTarget(id?: WalkthroughTargetId): Promise<Rect | null> {
  let r = await measureRaw(id);
  if (!r || !id) return null;
  const win = Dimensions.get('window');
  const topSafe = 70;                  // below the status bar
  const bottomSafe = win.height - 150; // above the sticky Add Entry bar
  // Up to two adjust-and-remeasure passes: the first scroll can land short
  // (animated scroll still settling, or clamped at the top/bottom edge).
  for (let pass = 0; pass < 2; pass++) {
    const cut = r.y < topSafe || r.y + r.height > bottomSafe;
    if (!cut || !scrollBy || FIXED_TARGETS.has(id)) break;
    const dy = r.y < topSafe
      ? r.y - topSafe - 12               // scroll up so the top clears the status bar
      : r.y + r.height - bottomSafe + 12; // scroll down so the bottom clears the bar
    scrollBy(dy);
    const next = await waitForScrollSettle(id);
    if (!next) return null;
    // No movement (already clamped at an edge) → accept what we have.
    if (Math.abs(next.y - r.y) < 2) { r = next; break; }
    r = next;
  }
  // Still (or fixed and) fully off-screen → centered card fallback, no spotlight.
  if (r.y + r.height < 0 || r.y > win.height || r.x + r.width < 0 || r.x > win.width) return null;
  return r;
}

// ─── Start requests (module-level, no context) ───────────────────────────────

type StartListener = (opts: { replay: boolean }) => void;
let startListener: StartListener | null = null;

/** Ask the mounted overlay to begin the tour (used by Settings → Replay). */
export function requestWalkthroughStart(opts: { replay?: boolean } = {}) {
  startListener?.({ replay: !!opts.replay });
}

// ─── Steps ────────────────────────────────────────────────────────────────────

type Step = {
  key: string;
  target?: WalkthroughTargetId;
  emoji: string;
  title: string;
  body: string;
};

const STEPS: Step[] = [
  { key: 'dashboard', target: 'hero', emoji: '📊', title: 'Your live dashboard',
    body: "Know what you made, what you kept, and how close you are to your goal — every number updates the moment you log an entry." },
  { key: 'add', target: 'addEntry', emoji: '➕', title: 'Log every order',
    body: 'Every delivery or ride you log brings you closer to knowing what your gig work is really worth.' },
  { key: 'calendar', target: 'calendar', emoji: '📅', title: 'Your earnings history',
    body: 'Review what you made by day, week, or month so you always know where you stand after a shift.' },
  { key: 'editEntries', target: 'entryRow', emoji: '✏️', title: 'View & edit any entry',
    body: 'Keep your history accurate. Edit or delete an entry whenever something changes.' },
  { key: 'analytics', target: 'analytics', emoji: '📈', title: 'Know your real numbers',
    body: 'See your real hourly pay, trends, profit, and expenses — insights your gig apps do not show you.' },
  { key: 'goals', target: 'goals', emoji: '🎯', title: 'Set income goals',
    body: "Set daily, weekly, and monthly goals so you know whether your work is paying off." },
  { key: 'expenses', target: 'kpis', emoji: '💸', title: 'Expenses & orders',
    body: 'Revenue is not the whole story. Track gas, maintenance, and other costs to see what you actually keep.' },
  { key: 'reminders', emoji: '🔔', title: 'Helpful nudges, not spam',
    body: "Stay consistent with gentle reminders and a daily recap. You control every notification in Settings." },
  { key: 'widgets', emoji: '📱', title: 'Home screen widget',
    body: "See today's earnings at a glance and quick-add orders without opening the app." },
  { key: 'theme', emoji: '🌙', title: 'Light & Dark Themes',
    body: "Choose the look that helps you stay focused — switch between Light and Dark themes anytime in Settings." },
  { key: 'premium', emoji: '⭐', title: 'Go further with Premium',
    body: 'Go deeper with advanced analytics, AI insights, profit forecasts, and more powerful reports whenever you are ready.' },
];

// ─── Overlay ──────────────────────────────────────────────────────────────────

type Phase = 'hidden' | 'welcome' | 'tour' | 'done';

export function WalkthroughOverlay() {
  const { user } = useAuth();
  const t = useTheme();
  const { themeName, setThemeOverride } = useThemeControls();
  // Reactive: re-renders (and re-measures, via the effect deps below) on
  // rotation and iPad split-screen resizes so the spotlight can't go stale.
  const win = useWindowDimensions();

  const [phase, setPhase] = useState<Phase>('hidden');
  const [stepIdx, setStepIdx] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  const autoStarted = useRef(false);
  // Pending auto-start timer — must be cleared if a manual start (Settings
  // replay) wins the race, or the late timer would yank an in-progress tour
  // back to the welcome screen.
  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub?.remove();
  }, []);

  // Settings → Replay. A manual start cancels any pending auto-start and
  // marks auto-start as consumed so only one start path can ever win.
  useEffect(() => {
    startListener = () => {
      if (autoTimer.current) { clearTimeout(autoTimer.current); autoTimer.current = null; }
      autoStarted.current = true;
      autoOpened.current = false; // deliberate replay — never server-vetoed
      setStepIdx(0);
      setPhase('welcome');
    };
    return () => { startListener = null; };
  }, []);

  // Auto-start: once per account for real users; every launch for demo.
  // `autoStarted` is process-lifetime, so it MUST reset when the signed-in
  // account changes — otherwise user B on the same device never gets their
  // first-run tour after user A consumed the flag.
  const autoStartUserRef = useRef<string | number | null>(null);
  // True while a tour that was opened AUTOMATICALLY is on screen. A late
  // server profile with walkthrough_completed=true dismisses it (the cached
  // profile hydrates first and may predate the server flag) — but must never
  // dismiss a deliberate Settings replay.
  const autoOpened = useRef(false);
  useEffect(() => {
    if (autoStartUserRef.current !== (user?.id ?? null)) {
      autoStartUserRef.current = user?.id ?? null;
      autoStarted.current = false;
      autoOpened.current = false;
      if (autoTimer.current) { clearTimeout(autoTimer.current); autoTimer.current = null; }
    }
    if (!user?.id) return;
    // Server veto: if the authoritative profile says this account already saw
    // the tour, close an auto-opened one immediately (and mirror the flag
    // locally so offline launches skip the read next time).
    if (!user.is_demo && user.walkthrough_completed === true) {
      writeWalkthroughDone(user.id);
      if (autoOpened.current) {
        autoOpened.current = false;
        setPhase('hidden');
        setRect(null);
      }
    }
    if (autoStarted.current) return;
    const isDemo = !!user.is_demo;
    let cancelled = false;
    (async () => {
      // Real accounts: the tour shows once per device per account, then stays
      // dismissed. Demo accounts: the persisted flag is ignored AND never
      // written — every demo session starts with the full tour (the
      // `autoStarted` ref still prevents repeats within one session, and it
      // resets whenever the signed-in account changes).
      // Server flag is authoritative when true: it survives reinstalls, where
      // the device-local AsyncStorage flag gets wiped. The local flag still
      // covers offline launches and older servers that omit the field.
      const doneOnServer = user.walkthrough_completed === true;
      const doneLocally = isDemo ? false : await readWalkthroughDone(user.id);
      const done = isDemo ? false : (doneOnServer || doneLocally);
      if (cancelled) return;
      // Heal the server flag if this device already saw the tour but the
      // server missed the write (e.g. it was completed on an older build).
      if (!isDemo && doneLocally && !doneOnServer) {
        api.completeWalkthrough().catch(() => {});
      }
      if (done || autoStarted.current) return;
      autoStarted.current = true;
      // Let the dashboard settle (skeleton → content) before dimming it.
      autoTimer.current = setTimeout(() => {
        autoTimer.current = null;
        if (cancelled) return;
        // Persist "seen" as soon as the tour starts so killing the app
        // mid-tour can't make it auto-show again forever (real accounts only —
        // demo must never write completion state). Written BOTH locally and
        // server-side so completion survives reinstalls; a failed server
        // write is retried by the heal path above on the next launch.
        if (!isDemo) {
          writeWalkthroughDone(user.id);
          api.completeWalkthrough().catch(() => {});
        }
        autoOpened.current = true;
        setStepIdx(0);
        setPhase('welcome');
      }, 900);
    })();
    return () => {
      cancelled = true;
      if (autoTimer.current) { clearTimeout(autoTimer.current); autoTimer.current = null; }
    };
    // walkthrough_completed is included so the late-arriving server profile
    // (cached user hydrates first) can veto/heal after the initial run.
  }, [user?.id, user?.is_demo, user?.walkthrough_completed]);

  const finish = useCallback((completed: boolean) => {
    autoOpened.current = false;
    setPhase('hidden');
    setRect(null);
    if (user?.id && !user.is_demo) {
      writeWalkthroughDone(user.id);
      api.completeWalkthrough().catch(() => {});
    }
    if (completed) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, [user?.id, user?.is_demo]);

  const step = STEPS[stepIdx];

  // ── Live theme demo on the 'theme' step ────────────────────────────────────
  // Temporarily override to the OPPOSITE theme so the user actually sees the
  // switch, then bounce back after a few seconds. The override is never
  // persisted, and it's cleared the moment the step/tour is left — the user's
  // saved preference (light/dark/system) always wins afterwards.
  const demoActive = phase === 'tour' && step?.key === 'theme';
  useEffect(() => {
    if (!demoActive) return;
    const demoTheme: 'dark' | 'light' = themeName === 'dark' ? 'light' : 'dark';
    const showTimer = setTimeout(() => setThemeOverride(demoTheme), 600);
    const revertTimer = setTimeout(() => setThemeOverride(null), 3800);
    return () => {
      clearTimeout(showTimer);
      clearTimeout(revertTimer);
      setThemeOverride(null); // leaving the step early always restores
    };
    // themeName intentionally omitted: it changes WHEN the override applies,
    // and re-running would flip the demo back and forth.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoActive, setThemeOverride]);

  // (Re)measure the current step's anchor whenever the step OR the window
  // size (rotation / split-screen) changes.
  useEffect(() => {
    if (phase !== 'tour') return;
    let cancelled = false;
    measureTarget(step?.target).then(r => { if (!cancelled) setRect(r); });
    return () => { cancelled = true; };
  }, [phase, stepIdx, step?.target, win.width, win.height]);

  const goto = useCallback((idx: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (idx < 0) return;
    // Leaving the theme-demo step: restore the real theme BEFORE the next
    // card mounts. Otherwise the new card can mount mid-flip and freeze the
    // demo theme's background under real-theme text (white-on-white title).
    if (STEPS[stepIdx]?.key === 'theme') setThemeOverride(null);
    if (idx >= STEPS.length) { setPhase('done'); return; }
    // Keep the previous rect while the next anchor is measured — the spotlight
    // glides to its new position instead of blacking out and popping back in.
    setStepIdx(idx);
  }, [stepIdx, setThemeOverride]);

  // Spotlight pulse (disabled under Reduce Motion).
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (phase === 'tour' && rect && !reduceMotion) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
          withTiming(0, { duration: 900, easing: Easing.inOut(Easing.quad) }),
        ), -1, false);
    } else {
      cancelAnimation(pulse);
      pulse.value = 0;
    }
  }, [phase, rect, reduceMotion, pulse]);
  const pulseStyle = useAnimatedStyle(() => ({
    shadowOpacity: 0.5 + pulse.value * 0.45,
    shadowRadius: 10 + pulse.value * 8,
  }));

  // Android: skip Reanimated entering/exiting on the card entirely. The
  // layout-animation snapshot can freeze the mount-time backgroundColor while
  // Text children re-render to the real theme after the theme-demo revert —
  // seen on-device as a dark card with dark title on the Premium step. The
  // theme-keyed remount below is not enough on Android because the freshly
  // entering view snapshots mid-flip. iOS keeps the fade.
  const fade = Platform.OS === 'android' ? {}
             : reduceMotion ? { entering: FadeIn.duration(150), exiting: FadeOut.duration(120) }
                            : { entering: FadeIn.duration(260), exiting: FadeOut.duration(180) };

  const DIM = 'rgba(0,0,0,0.78)';
  const PAD = 6; // breathing room around the spotlighted element
  const spot = rect
    ? (() => {
        const x = Math.max(0, rect.x - PAD);
        // Clamp width to the space REMAINING after x, not the full screen —
        // otherwise a right-edge target yields x + w > screen and the
        // highlight ring/tap zones drift off the element.
        return { x, y: Math.max(0, rect.y - PAD),
          w: Math.min(win.width - x, rect.width + PAD * 2), h: rect.height + PAD * 2 };
      })()
    : null;

  // ── Spotlight glide ──────────────────────────────────────────────────────────
  // Shared values drive the dim rects + ring so the hole animates smoothly
  // between steps. Snaps (no glide) on the first spotlight after a full-dim
  // step and under Reduce Motion.
  const sx = useSharedValue(0), sy = useSharedValue(0);
  const sw = useSharedValue(0), sh = useSharedValue(0);
  const spotLive = useRef(false);
  useEffect(() => {
    if (!spot) { spotLive.current = false; return; }
    if (!spotLive.current || reduceMotion) {
      sx.value = spot.x; sy.value = spot.y; sw.value = spot.w; sh.value = spot.h;
      spotLive.current = true;
    } else {
      const cfg = { duration: 320, easing: Easing.out(Easing.cubic) };
      sx.value = withTiming(spot.x, cfg);
      sy.value = withTiming(spot.y, cfg);
      sw.value = withTiming(spot.w, cfg);
      sh.value = withTiming(spot.h, cfg);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spot?.x, spot?.y, spot?.w, spot?.h, reduceMotion]);
  const topDimStyle = useAnimatedStyle(() => ({ height: sy.value }));
  const bottomDimStyle = useAnimatedStyle(() => ({ top: sy.value + sh.value }));
  const leftDimStyle = useAnimatedStyle(() => ({ top: sy.value, width: sx.value, height: sh.value }));
  const rightDimStyle = useAnimatedStyle(() => ({ top: sy.value, left: sx.value + sw.value, height: sh.value }));
  const ringStyle = useAnimatedStyle(() => ({ top: sy.value, left: sx.value, width: sw.value, height: sh.value }));

  if (phase === 'hidden') return null;

  const btn = (label: string, onPress: () => void, primary?: boolean, a11y?: string) => (
    <Pressable
      key={label}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y || label}
      hitSlop={8}
      style={({ pressed }) => ({
        minHeight: 44, minWidth: 44, paddingHorizontal: 18, borderRadius: 12,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: primary ? t.PRIMARY : 'transparent',
        borderWidth: primary ? 0 : 1, borderColor: t.BORDER,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Text style={{ color: primary ? t.ON_PRIMARY : t.MUTED, fontWeight: '800', fontSize: 15 }}>{label}</Text>
    </Pressable>
  );

  const card = (children: React.ReactNode, style?: object) => (
    <Animated.View
      {...fade}
      style={[{
        backgroundColor: t.SURFACE, borderRadius: 20, borderWidth: 1, borderColor: t.BORDER,
        padding: 20, gap: 10, marginHorizontal: 20,
        // Tablets / landscape: keep the card a readable column, centered.
        maxWidth: 440, alignSelf: 'center', width: win.width - 40,
        shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 20, elevation: 16,
      }, style]}
    >
      {children}
    </Animated.View>
  );

  // ── Welcome / Done full-screen overlays ─────────────────────────────────────
  if (phase === 'welcome' || phase === 'done') {
    const isWelcome = phase === 'welcome';
    return (
      <Animated.View {...fade} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: DIM, zIndex: 2000, alignItems: 'center', justifyContent: 'center' }}>
        {card(
          <>
            <Text accessibilityRole="header" style={{ fontSize: 40, textAlign: 'center' }}>{isWelcome ? '👋' : '🎉'}</Text>
            <Text style={{ color: t.TEXT, fontSize: 22, fontWeight: '900', textAlign: 'center' }}>
              {isWelcome ? 'Welcome to Earnings Ninja!' : '🥷 You’re ready to take control.'}
            </Text>
            <Text style={{ color: t.MUTED, fontSize: 15, lineHeight: 22, textAlign: 'center' }}>
              {isWelcome
                ? "Let's take 60 seconds to tour the features that will help you earn more and stay organized."
                 : 'No more guessing what you made. Track your earnings, track your costs, and know your real profit after every shift.'}
            </Text>
            <View style={{ gap: 10, marginTop: 8 }}>
              {isWelcome
                ? <>
                    {btn('Start Tour', () => { setStepIdx(0); setPhase('tour'); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); }, true)}
                    {btn('Skip', () => finish(false), false, 'Skip the walkthrough')}
                  </>
                : btn('Log My First Entry', () => finish(true), true)}
            </View>
          </>,
          { width: Math.min(360, win.width - 40) },
        )}
      </Animated.View>
    );
  }

  // ── Tour step ────────────────────────────────────────────────────────────────
  // Place the info card in the larger free region above/below the spotlight.
  const spaceAbove = spot ? spot.y : win.height / 2;
  const spaceBelow = spot ? win.height - (spot.y + spot.h) : win.height / 2;
  const cardBelow = spaceBelow >= spaceAbove;

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 2000 }} accessibilityViewIsModal>
      {/* Dimmed backdrop — 4 rects around the spotlight keep the real UI visible
          through the hole. Tapping the dim area advances (never traps). */}
      {spot ? (
        <>
          <AnimatedPressable onPress={() => goto(stepIdx + 1)} style={[{ position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: DIM }, topDimStyle]} />
          <AnimatedPressable onPress={() => goto(stepIdx + 1)} style={[{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: DIM }, bottomDimStyle]} />
          <AnimatedPressable onPress={() => goto(stepIdx + 1)} style={[{ position: 'absolute', left: 0, backgroundColor: DIM }, leftDimStyle]} />
          <AnimatedPressable onPress={() => goto(stepIdx + 1)} style={[{ position: 'absolute', right: 0, backgroundColor: DIM }, rightDimStyle]} />
          {/* Glowing highlight ring */}
          <Animated.View
            pointerEvents="none"
            style={[{
              position: 'absolute',
              borderRadius: 16, borderWidth: 2.5, borderColor: t.PRIMARY,
              shadowColor: t.PRIMARY, shadowOffset: { width: 0, height: 0 }, elevation: 12,
            }, ringStyle, reduceMotion ? { shadowOpacity: 0.7, shadowRadius: 12 } : pulseStyle]}
          />
        </>
      ) : (
        <Pressable onPress={() => goto(stepIdx + 1)} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: DIM }} />
      )}

      {/* Floating info card — keyed by step so the fade replays per step now
          that the rect is no longer nulled between steps. */}
      <View
        // Keyed by theme too: if the theme flips while a card is mounted
        // (theme-demo revert), remount so no frozen background survives.
        key={`${stepIdx}-${t.name}`}
        pointerEvents="box-none"
        style={{
          position: 'absolute', left: 0, right: 0,
          ...(spot
            // Clamps keep the card fully on-screen even on short devices
            // (SE-class) or when the spotlight sits near a screen edge.
            ? cardBelow
              ? { top: Math.max(60, Math.min(spot.y + spot.h + 16, win.height - 300)) }
              : { bottom: Math.max(24, Math.min(win.height - spot.y + 16, win.height - 90)) }
            : { top: Math.max(60, win.height * 0.28) }),
        }}
      >
        {card(
          <>
            <Text style={{ color: t.PRIMARY_TXT, fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>
              {`STEP ${stepIdx + 1} OF ${STEPS.length}`}
            </Text>
            <Text accessibilityRole="header" style={{ color: t.TEXT, fontSize: 19, fontWeight: '900' }}>
              {step.emoji}  {step.title}
            </Text>
            <Text style={{ color: t.MUTED, fontSize: 14.5, lineHeight: 21 }}>{step.body}</Text>
            {/* Progress dots */}
            <View style={{ flexDirection: 'row', gap: 5, marginTop: 2 }}>
              {STEPS.map((s, i) => (
                <View key={s.key} style={{ width: i === stepIdx ? 16 : 6, height: 6, borderRadius: 3, backgroundColor: i === stepIdx ? t.PRIMARY : t.BORDER }} />
              ))}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
              {btn('Skip', () => finish(false), false, 'Skip the walkthrough')}
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {stepIdx > 0 && btn('Back', () => goto(stepIdx - 1))}
                {btn(stepIdx === STEPS.length - 1 ? 'Finish' : 'Next', () => goto(stepIdx + 1), true)}
              </View>
            </View>
          </>,
        )}
      </View>
    </View>
  );
}
