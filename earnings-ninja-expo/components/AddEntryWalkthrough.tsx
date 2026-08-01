// ─── Add Entry Guided Walkthrough ─────────────────────────────────────────────
// Interactive, contextual tour of the Add Entry form (Revenue + Expense),
// rendered INSIDE the AddEntryModal so it layers correctly above the pageSheet.
// Reuses the spotlight machinery pattern from components/Walkthrough.tsx but
// with its own registry/persistence namespace ("add_entry") so the two tours
// never interfere.
//
// Display rules (mirrors the dashboard tour):
//  • Production users: auto-shows the FIRST time the Add Entry sheet opens for
//    a new entry; a per-account AsyncStorage flag prevents auto-replay.
//  • Demo accounts: shows on every open; the flag is ignored and never written.
//  • Replayable from Settings → Help → Replay Add Entry Walkthrough (queues a
//    replay for the next time the sheet opens).
//  • Reduce Motion: pulses replaced with plain fades.
//
// The tour DRIVES the real form: steps declare a `prepare` action (switch to
// the details step, select the Expense type, expand "See more") so the user
// watches the actual interface move — fields are highlighted in place, not
// screenshots. The modal registers a tiny controller for this; everything is
// module-level, no context threading.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo, Pressable, Text, View, findNodeHandle, useWindowDimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import Animated, {
  Easing, FadeIn, FadeOut, cancelAnimation, useAnimatedStyle, useSharedValue,
  withRepeat, withSequence, withTiming,
} from 'react-native-reanimated';
import { useAuth } from '@/lib/authContext';
import { useTheme } from '@/lib/theme';

// ─── Persistence (FeatureWalkthroughManager-style, namespaced per feature) ────

const WALKTHROUGH_ID = 'add_entry';
const doneKey = (userId: number | string) => `walkthrough_done:${WALKTHROUGH_ID}:${userId}`;

export async function readAddEntryWalkthroughDone(userId: number | string): Promise<boolean> {
  try { return (await AsyncStorage.getItem(doneKey(userId))) === '1'; } catch { return false; }
}
async function writeAddEntryWalkthroughDone(userId: number | string): Promise<void> {
  try { await AsyncStorage.setItem(doneKey(userId), '1'); } catch {}
}
export async function resetAddEntryWalkthrough(userId: number | string): Promise<void> {
  try { await AsyncStorage.removeItem(doneKey(userId)); } catch {}
}

// Settings → Replay: queue a one-shot replay consumed the next time the Add
// Entry sheet opens (the sheet may not be mounted while Settings is up, and
// per the iOS modal-stacking rule we never present it from inside Settings).
// User-scoped: the queued replay only fires for the account that requested it,
// so an account switch between Settings and the next sheet open can't leak a
// replay into another user's session.
let replayQueuedFor: string | number | null = null;
export function queueAddEntryWalkthroughReplay(userId: string | number) { replayQueuedFor = userId; }

// ─── Target registry ──────────────────────────────────────────────────────────

export type AddEntryTargetId =
  | 'amount' | 'type' | 'platform' | 'category' | 'miles'
  | 'more' | 'business' | 'date' | 'notes' | 'action';

const targets = new Map<AddEntryTargetId, View | null>();
export function registerAddEntryTarget(id: AddEntryTargetId) {
  return (node: View | null) => { targets.set(id, node); };
}

// ─── Form controller (registered by AddEntryModal / DetailsForm) ─────────────

type FormController = {
  goCalc: () => void;
  goDetails: () => void;
  setEntryType: (t: 'ORDER' | 'EXPENSE') => void;
};
let controller: FormController | null = null;
export function registerAddEntryController(c: FormController | null) { controller = c; }

// "See more" lives inside DetailsForm, so it registers its own setter.
let setShowMoreFn: ((v: boolean) => void) | null = null;
export function registerAddEntryShowMore(fn: ((v: boolean) => void) | null) { setShowMoreFn = fn; }

// The modal's ScrollView registers a relative scroller + the overlay's local
// origin so anchors cut off by the sheet edges can be scrolled into view.
let scrollBy: ((dy: number) => void) | null = null;
export function registerAddEntryScroller(fn: ((dy: number) => void) | null) { scrollBy = fn; }

type Rect = { x: number; y: number; width: number; height: number };

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

function measureRaw(id?: AddEntryTargetId): Promise<Rect | null> {
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

// The bottom action bar sits outside the ScrollView — scrolling can't move it.
const FIXED_TARGETS = new Set<AddEntryTargetId>(['action']);

// ─── Steps ────────────────────────────────────────────────────────────────────

type Prep = { form?: 'calc' | 'details'; entryType?: 'ORDER' | 'EXPENSE'; showMore?: boolean };
type Step = {
  key: string;
  target?: AddEntryTargetId;
  emoji: string;
  title: string;
  body: string;
  prep: Prep;
};

// Part 1 — Revenue; Part 2 — Expense. `prep` is applied on EVERY visit (both
// directions) so Back always restores the right form state.
const STEPS: Step[] = [
  { key: 'amount', target: 'amount', emoji: '💵', title: 'Enter the amount',
    body: 'Type the total you earned for this order, trip, or shift — like $24.75. This one number drives your income tracking, goals, and analytics.',
    prep: { form: 'calc', entryType: 'ORDER' } },
  { key: 'next', target: 'action', emoji: '➡️', title: 'Continue to details',
    body: "After entering the amount, this button takes you to the details — where you'll tell Earnings Ninja what kind of entry this is.",
    prep: { form: 'calc', entryType: 'ORDER' } },
  { key: 'type', target: 'type', emoji: '📝', title: 'Pick the entry type',
    body: 'Choose Order for money you earned from deliveries or rides, and Bonus for promos and incentives. Expense is for money you spent — we\'ll cover that next.',
    prep: { form: 'details', entryType: 'ORDER' } },
  { key: 'platform', target: 'platform', emoji: '🚗', title: 'Choose your platform',
    body: 'Pick which app this income came from so Earnings Ninja can break down your earnings by platform. Tap ＋ Add to add your own, or press and hold any platform to edit it.',
    prep: { form: 'details', entryType: 'ORDER' } },
  { key: 'miles', target: 'miles', emoji: '🛣️', title: 'Miles & minutes',
    body: 'Logging miles and time reveals your TRUE hourly pay and captures deductible miles for tax season. Optional — but powerful.',
    prep: { form: 'details', entryType: 'ORDER' } },
  { key: 'more', target: 'more', emoji: '🔍', title: 'More options when you need them',
    body: 'Tap "See more" for the date & time, notes, and (for expenses) receipts and the business-expense toggle.',
    prep: { form: 'details', entryType: 'ORDER', showMore: false } },
  { key: 'date', target: 'date', emoji: '📅', title: 'Date & time',
    body: 'New entries are filed under right now automatically. Logging something from earlier? Set the real date so your calendar and reports stay accurate.',
    prep: { form: 'details', entryType: 'ORDER', showMore: true } },
  { key: 'notes', target: 'notes', emoji: '🗒️', title: 'Notes',
    body: 'Optional, but handy for remembering special situations — a big catering order, surge pricing, a long wait.',
    prep: { form: 'details', entryType: 'ORDER', showMore: true } },
  { key: 'save', target: 'action', emoji: '💾', title: 'Save your entry',
    body: 'When you save, your dashboard, goals, calendar, and analytics all update instantly. 💡 Consistent logging makes every report more accurate.',
    prep: { form: 'details', entryType: 'ORDER', showMore: false } },
  { key: 'expIntro', emoji: '💸', title: "Now let's record an expense",
    body: 'Expenses are money you spend while working — gas, parking, supplies. Tracking them shows your REAL profit, not just your earnings.',
    prep: { form: 'details', entryType: 'ORDER', showMore: false } },
  { key: 'expType', target: 'type', emoji: '🏷️', title: 'Switch to Expense',
    body: "We've selected Expense for you. Notice the form changed — platforms are replaced by expense categories.",
    prep: { form: 'details', entryType: 'EXPENSE', showMore: false } },
  { key: 'category', target: 'category', emoji: '⛽', title: 'Pick a category',
    body: 'Gas, maintenance, food, insurance… Categories show where your money goes and make tax prep far simpler.',
    prep: { form: 'details', entryType: 'EXPENSE', showMore: false } },
  { key: 'business', target: 'business', emoji: '💼', title: 'Business expense?',
    body: 'Flag work expenses as business expenses — they\'re tracked separately in Analytics and 💡 reduce your taxable profit. You can attach a receipt photo here too.',
    prep: { form: 'details', entryType: 'EXPENSE', showMore: true } },
  { key: 'expSave', target: 'action', emoji: '✅', title: 'Save the expense',
    body: 'Same Save button — expenses subtract from your earnings so your profit numbers reflect reality.',
    prep: { form: 'details', entryType: 'EXPENSE', showMore: false } },
];

function applyPrep(p: Prep) {
  if (!controller) return;
  if (p.entryType) controller.setEntryType(p.entryType);
  if (p.form === 'calc') controller.goCalc();
  if (p.form === 'details') controller.goDetails();
  if (p.showMore !== undefined) setShowMoreFn?.(p.showMore);
}

// ─── Overlay ──────────────────────────────────────────────────────────────────

type Phase = 'hidden' | 'welcome' | 'tour' | 'done';

export function AddEntryWalkthroughOverlay({ active }: {
  /** True while the sheet is open for a NEW entry (never for edits). */
  active: boolean;
}) {
  const { user } = useAuth();
  const t = useTheme();
  const win = useWindowDimensions();

  const [phase, setPhase] = useState<Phase>('hidden');
  const [stepIdx, setStepIdx] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  const startedThisOpen = useRef(false);

  // The overlay fills the pageSheet, not the window; measureInWindow returns
  // WINDOW coords, so we subtract our own window origin to position locally.
  const rootRef = useRef<View>(null);
  // Window-coords origin + measured size of the sheet-filling overlay. All
  // safe-band / off-screen / card-placement math uses THESE bounds (not raw
  // window dims) so iPad form-sheet layouts geometry stays correct.
  const originRef = useRef({ x: 0, y: 0 });
  const [sheet, setSheet] = useState({ w: 0, h: 0 });
  const sheetW = sheet.w || win.width;
  const sheetH = sheet.h || win.height;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub?.remove();
  }, []);

  // Auto-start when the sheet opens: replay queue > demo (always) > first time.
  useEffect(() => {
    if (!active) { startedThisOpen.current = false; setPhase('hidden'); setRect(null); return; }
    if (!user?.id || startedThisOpen.current) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    (async () => {
      const replay = replayQueuedFor === user.id;
      const done = replay || user.is_demo ? false : await readAddEntryWalkthroughDone(user.id);
      if (cancelled || done || startedThisOpen.current) return;
      startedThisOpen.current = true;
      // Let the sheet slide-in animation finish before dimming it. The replay
      // queue is only consumed HERE, when the welcome actually shows — if the
      // sheet closes during the delay the queue survives for the next open.
      timer = setTimeout(() => {
        if (cancelled) return;
        if (replayQueuedFor === user.id) replayQueuedFor = null;
        // Mark "seen" the moment the tour actually starts (production only).
        // Writing only in finish() meant swiping the sheet closed mid-tour
        // never persisted the flag → the tour auto-started on EVERY open.
        if (!user.is_demo) writeAddEntryWalkthroughDone(user.id);
        setStepIdx(0);
        setPhase('welcome');
      }, 650);
    })();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [active, user?.id, user?.is_demo]);

  const finish = useCallback((completed: boolean) => {
    setPhase('hidden');
    setRect(null);
    // Leave the form ready for a real first entry.
    applyPrep({ form: 'calc', entryType: 'ORDER', showMore: false });
    if (user?.id && !user.is_demo) writeAddEntryWalkthroughDone(user.id);
    if (completed) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, [user?.id, user?.is_demo]);

  const step = STEPS[stepIdx];

  // Prepare the form + measure the anchor whenever the step or window changes.
  useEffect(() => {
    if (phase !== 'tour') return;
    let cancelled = false;
    (async () => {
      applyPrep(step.prep);
      await sleep(120); // let the form re-render after prep
      // Refresh our own window origin (sheet position can differ per device).
      await new Promise<void>(res => {
        const node = rootRef.current;
        if (!node || !findNodeHandle(node)) return res();
        try {
          node.measureInWindow((x, y, w, h) => {
            originRef.current = { x, y };
            if (w && h) setSheet(prev => (prev.w === w && prev.h === h) ? prev : { w, h });
            res();
          });
        } catch { res(); }
      });
      let r = await measureRaw(step.target);
      // Scroll cut-off anchors into the safe band (below the sheet header,
      // above the bottom action bar), then re-measure — up to two passes.
      // Window coords, derived from the measured sheet bounds.
      const topSafe = originRef.current.y + 60;
      const bottomSafe = originRef.current.y + sheetH - 140;
      for (let pass = 0; pass < 2 && r && step.target && !FIXED_TARGETS.has(step.target); pass++) {
        const cut = r.y < topSafe || r.y + r.height > bottomSafe;
        if (!cut || !scrollBy) break;
        const dy = r.y < topSafe ? r.y - topSafe - 12 : r.y + r.height - bottomSafe + 12;
        scrollBy(dy);
        await sleep(400);
        const next = await measureRaw(step.target);
        if (!next) { r = null; break; }
        if (Math.abs(next.y - r.y) < 2) { r = next; break; }
        r = next;
      }
      if (cancelled) return;
      if (r) {
        // Convert window coords → overlay-local coords.
        r = { ...r, x: r.x - originRef.current.x, y: r.y - originRef.current.y };
        // Fully outside the sheet → centered card fallback.
        if (r.y + r.height < 0 || r.y > sheetH || r.x + r.width < 0 || r.x > sheetW) r = null;
      }
      setRect(r);
    })();
    return () => { cancelled = true; };
  }, [phase, stepIdx, win.width, win.height]);

  const goto = useCallback((idx: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (idx < 0) return;
    if (idx >= STEPS.length) { setPhase('done'); setRect(null); return; }
    setRect(null);
    setStepIdx(idx);
  }, []);

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

  const fade = reduceMotion ? { entering: FadeIn.duration(150), exiting: FadeOut.duration(120) }
                            : { entering: FadeIn.duration(260), exiting: FadeOut.duration(180) };

  if (!active || phase === 'hidden') return null;

  const DIM = 'rgba(0,0,0,0.78)';
  const PAD = 6;
  const spot = rect
    ? (() => {
        const x = Math.max(0, rect.x - PAD);
        // Clamp width to the space remaining after x (see Walkthrough.tsx) so
        // right-edge targets can't overflow the sheet bounds.
        return { x, y: Math.max(0, rect.y - PAD),
          w: Math.min(sheetW - x, rect.width + PAD * 2), h: rect.height + PAD * 2 };
      })()
    : null;

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
        maxWidth: 440, alignSelf: 'center', width: sheetW - 40,
        shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 20, elevation: 16,
      }, style]}
    >
      {children}
    </Animated.View>
  );

  // ── Welcome / Done ───────────────────────────────────────────────────────────
  if (phase === 'welcome' || phase === 'done') {
    const isWelcome = phase === 'welcome';
    return (
      <Animated.View
        ref={rootRef}
        {...fade}
        accessibilityViewIsModal
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: DIM, zIndex: 3000, alignItems: 'center', justifyContent: 'center' }}
      >
        {card(
          <>
            <Text accessibilityRole="header" style={{ fontSize: 40, textAlign: 'center' }}>{isWelcome ? '👋' : '🎉'}</Text>
            <Text style={{ color: t.TEXT, fontSize: 22, fontWeight: '900', textAlign: 'center' }}>
              {isWelcome ? "Let's Log Your First Entry" : "You're Ready!"}
            </Text>
            <Text style={{ color: t.MUTED, fontSize: 15, lineHeight: 22, textAlign: 'center' }}>
              {isWelcome
                ? 'This quick walkthrough shows you how to record both income and expenses so your reports, goals, and analytics stay accurate.'
                : 'You now know how to record income, track expenses, and build accurate profit insights. The more consistently you log, the smarter your analytics get.'}
            </Text>
            <View style={{ gap: 10, marginTop: 8 }}>
              {isWelcome
                ? <>
                    {btn('Start Tour', () => { setStepIdx(0); setPhase('tour'); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); }, true)}
                    {btn('Skip', () => finish(false), false, 'Skip the walkthrough')}
                  </>
                : btn('Start Tracking', () => finish(true), true)}
            </View>
          </>,
          { width: Math.min(360, sheetW - 40) },
        )}
      </Animated.View>
    );
  }

  // ── Tour step ────────────────────────────────────────────────────────────────
  const spaceAbove = spot ? spot.y : sheetH / 2;
  const spaceBelow = spot ? sheetH - (spot.y + spot.h) : sheetH / 2;
  const cardBelow = spaceBelow >= spaceAbove;

  return (
    <View ref={rootRef} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 3000 }} accessibilityViewIsModal>
      {spot ? (
        <>
          <Pressable onPress={() => goto(stepIdx + 1)} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: spot.y, backgroundColor: DIM }} />
          <Pressable onPress={() => goto(stepIdx + 1)} style={{ position: 'absolute', top: spot.y + spot.h, left: 0, right: 0, bottom: 0, backgroundColor: DIM }} />
          <Pressable onPress={() => goto(stepIdx + 1)} style={{ position: 'absolute', top: spot.y, left: 0, width: spot.x, height: spot.h, backgroundColor: DIM }} />
          <Pressable onPress={() => goto(stepIdx + 1)} style={{ position: 'absolute', top: spot.y, left: spot.x + spot.w, right: 0, height: spot.h, backgroundColor: DIM }} />
          <Animated.View
            pointerEvents="none"
            style={[{
              position: 'absolute', top: spot.y, left: spot.x, width: spot.w, height: spot.h,
              borderRadius: 16, borderWidth: 2.5, borderColor: t.PRIMARY,
              shadowColor: t.PRIMARY, shadowOffset: { width: 0, height: 0 }, elevation: 12,
            }, reduceMotion ? { shadowOpacity: 0.7, shadowRadius: 12 } : pulseStyle]}
          />
        </>
      ) : (
        <Pressable onPress={() => goto(stepIdx + 1)} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: DIM }} />
      )}

      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute', left: 0, right: 0,
          ...(spot
            ? cardBelow
              ? { top: Math.max(40, Math.min(spot.y + spot.h + 16, sheetH - 320)) }
              : { bottom: Math.max(24, Math.min(sheetH - spot.y + 16, sheetH - 90)) }
            : { top: Math.max(40, sheetH * 0.24) }),
        }}
      >
        {card(
          <>
            <Text style={{ color: t.PRIMARY_TXT, fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>
              {`STEP ${stepIdx + 1} OF ${STEPS.length} · ${stepIdx < 9 ? 'REVENUE' : 'EXPENSE'}`}
            </Text>
            <Text accessibilityRole="header" style={{ color: t.TEXT, fontSize: 19, fontWeight: '900' }}>
              {step.emoji}  {step.title}
            </Text>
            <Text style={{ color: t.MUTED, fontSize: 14.5, lineHeight: 21 }}>{step.body}</Text>
            <View style={{ flexDirection: 'row', gap: 4, marginTop: 2, flexWrap: 'wrap' }}>
              {STEPS.map((s, i) => (
                <View key={s.key} style={{ width: i === stepIdx ? 14 : 5, height: 5, borderRadius: 3, backgroundColor: i === stepIdx ? t.PRIMARY : t.BORDER }} />
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
