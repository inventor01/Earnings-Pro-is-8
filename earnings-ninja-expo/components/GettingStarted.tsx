// ─── Getting Started Success Checklist ────────────────────────────────────────
// Premium activation checklist shown on the Home dashboard, right below the
// Analytics section. Three milestones: first revenue entry, first expense,
// first earnings goal. Each auto-checks off when the real action succeeds
// (event-driven from the save paths), celebrates with an animated check,
// a small confetti burst, a haptic, and a success toast — then retires itself
// permanently once all three are done.
//
// Display rules:
//  • Production: shows for accounts that haven't finished all three goals;
//    per-goal progress + dismissal persist per account (AsyncStorage). Once
//    complete (and the final "You're All Set!" card is dismissed) it is
//    removed forever.
//  • Demo accounts: always shows, progress resets every launch, nothing is
//    ever persisted.
//  • The ✕ hides it (progress kept); restore via Settings → Help.
//  • Existing accounts aren't nagged: the dashboard passes "seed" signals
//    (data already visible in cache) that silently complete milestones
//    without celebrations.
//  • Reduce Motion: confetti is skipped; checks fade, toast + haptic remain.
//
// Modular: MILESTONES is data-driven so future goals can be added without a
// redesign (extra keys persist independently).

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing, FadeIn, FadeOut, useAnimatedStyle, useSharedValue,
  withDelay, withSequence, withSpring, withTiming, runOnJS,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/authContext';
import { useTheme } from '@/lib/theme';

// ─── Milestones (extensible) ──────────────────────────────────────────────────

export type MilestoneKey = 'revenue' | 'expense' | 'goal';

const MILESTONES: { key: MilestoneKey; emoji: string; title: string; desc: string; toastTitle: string; toastBody: string }[] = [
  { key: 'revenue', emoji: '💵', title: 'Log Your First Order',
    desc: 'Record your first delivery or ride to begin tracking your earnings.',
    toastTitle: '🎉 First Order Logged!', toastBody: "Great start! You're officially tracking your business." },
  { key: 'expense', emoji: '⛽', title: 'Log Your First Expense',
    desc: 'Track gas, parking, or maintenance to see your true profit.',
    toastTitle: '⛽ First Expense Added!', toastBody: 'Nice work! Every expense reveals your real profit.' },
  { key: 'goal', emoji: '🎯', title: 'Set Your First Earnings Goal',
    desc: 'Create an earnings goal to stay motivated and measure progress.',
    toastTitle: '🎯 Goal Created!', toastBody: "You're one step closer to hitting your income target." },
];

// ─── Persistence ──────────────────────────────────────────────────────────────

type GSState = { done: Partial<Record<MilestoneKey, boolean>>; dismissed: boolean; retired: boolean };
const EMPTY: GSState = { done: {}, dismissed: false, retired: false };
const storeKey = (userId: number | string) => `getting_started:${userId}`;

async function readState(userId: number | string): Promise<GSState> {
  try {
    const raw = await AsyncStorage.getItem(storeKey(userId));
    if (!raw) return { ...EMPTY, done: {} };
    const p = JSON.parse(raw);
    return { done: p.done ?? {}, dismissed: !!p.dismissed, retired: !!p.retired };
  } catch { return { ...EMPTY, done: {} }; }
}
async function writeState(userId: number | string, s: GSState): Promise<void> {
  try { await AsyncStorage.setItem(storeKey(userId), JSON.stringify(s)); } catch {}
}

/** Settings → Help → Show Getting Started Checklist. */
export async function restoreGettingStarted(userId: number | string): Promise<void> {
  const s = await readState(userId);
  if (s.retired) return; // completed forever — nothing to restore
  await writeState(userId, { ...s, dismissed: false });
  emit({ kind: 'restore' });
}

// ─── Milestone events (module-level, no context) ─────────────────────────────

type Event = { kind: 'milestone'; key: MilestoneKey } | { kind: 'restore' };
// Subscriber REGISTRY (not a singleton slot): multiple mounted cards subscribe
// independently, and an unmounting instance removes only itself.
const listeners = new Set<(e: Event) => void>();
function emit(e: Event) { listeners.forEach(fn => fn(e)); }

/** Called from the real save paths (entry create success, goal save success). */
export function markGettingStartedMilestone(key: MilestoneKey) {
  emit({ kind: 'milestone', key });
}

// ─── Confetti (lightweight, GPU-friendly, self-cleaning) ─────────────────────

const CONFETTI_COLORS = ['#facc15', '#fde047', '#f59e0b', '#22c55e', '#3b82f6', '#ec4899'];

function ConfettiPiece({ index, big, onLast }: { index: number; big: boolean; onLast?: () => void }) {
  const prog = useSharedValue(0);
  // Deterministic pseudo-random spread per index (no Math.random in worklets).
  const seed = (index * 9301 + 49297) % 233280 / 233280;
  const seed2 = (index * 233 + 887) % 1000 / 1000;
  const dx = (seed - 0.5) * (big ? 320 : 220);
  const fall = 120 + seed2 * (big ? 180 : 120);
  const rot = (seed2 - 0.5) * 720;
  const dur = 1100 + seed * 500;
  useEffect(() => {
    prog.value = withTiming(1, { duration: dur, easing: Easing.out(Easing.quad) }, (fin) => {
      if (fin && onLast) runOnJS(onLast)();
    });
  }, []);
  const style = useAnimatedStyle(() => ({
    opacity: 1 - prog.value,
    transform: [
      { translateX: dx * prog.value },
      // Up then down — simple ballistic arc.
      { translateY: -70 * prog.value + fall * prog.value * prog.value },
      { rotate: `${rot * prog.value}deg` },
      { scale: 1 - prog.value * 0.4 },
    ],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[{
        position: 'absolute', top: 0, left: '50%',
        width: index % 3 === 0 ? 8 : 6, height: index % 2 === 0 ? 10 : 6,
        borderRadius: 2, backgroundColor: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
      }, style]}
    />
  );
}

function ConfettiBurst({ big, onDone }: { big: boolean; onDone: () => void }) {
  const count = big ? 26 : 16;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 8, left: 0, right: 0, height: 1, zIndex: 10 }}>
      {Array.from({ length: count }, (_, i) => (
        <ConfettiPiece key={i} index={i} big={big} onLast={i === count - 1 ? onDone : undefined} />
      ))}
    </View>
  );
}

// ─── Animated check row ───────────────────────────────────────────────────────

function CheckRow({ emoji, title, desc, done, justCompleted, reduceMotion, colors }: {
  emoji: string; title: string; desc: string; done: boolean; justCompleted: boolean;
  reduceMotion: boolean;
  colors: { TEXT: string; MUTED: string; BORDER: string; GREEN: string; PRI_LITE: string };
}) {
  const pop = useSharedValue(justCompleted && !reduceMotion ? 0 : 1);
  useEffect(() => {
    if (justCompleted && !reduceMotion) {
      pop.value = 0;
      pop.value = withDelay(80, withSequence(
        withSpring(1.25, { damping: 12, stiffness: 220 }),
        withSpring(1, { damping: 14, stiffness: 200 }),
      ));
    }
  }, [justCompleted, reduceMotion, pop]);
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={`${title}. ${done ? 'Completed' : 'Not completed'}. ${desc}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 }}
    >
      <Animated.View style={[{
        width: 28, height: 28, borderRadius: 14,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: done ? colors.GREEN : 'transparent',
        borderWidth: done ? 0 : 2, borderColor: colors.BORDER,
      }, popStyle]}>
        {done && <Ionicons name="checkmark" size={18} color="#ffffff" />}
      </Animated.View>
      <View style={{ flex: 1 }}>
        <Text style={{
          color: done ? colors.MUTED : colors.TEXT, fontSize: 15, fontWeight: '800',
          textDecorationLine: done ? 'line-through' : 'none',
        }}>
          {emoji}  {title}
        </Text>
        {!done && <Text style={{ color: colors.MUTED, fontSize: 12.5, lineHeight: 17, marginTop: 2 }}>{desc}</Text>}
      </View>
    </View>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────

export function GettingStartedCard({ seedSignals }: {
  /** Data already visible in cache — silently completes milestones for
      existing accounts so long-time users aren't nagged. */
  seedSignals: { revenue?: boolean; expense?: boolean; goal?: boolean };
}) {
  const { user } = useAuth();
  const t = useTheme();
  const userId = user?.id;
  const isDemo = !!user?.is_demo;

  // null = still loading persisted state (render nothing yet, no flicker).
  const [state, setState] = useState<GSState | null>(null);
  const stateRef = useRef<GSState | null>(null);
  stateRef.current = state;
  const [reduceMotion, setReduceMotion] = useState(false);
  const [toast, setToast] = useState<{ title: string; body: string } | null>(null);
  const [confetti, setConfetti] = useState<{ big: boolean; id: number } | null>(null);
  const [justKey, setJustKey] = useState<MilestoneKey | null>(null);
  const [showFinale, setShowFinale] = useState(false);
  // Celebration queue — one at a time, never overlapping.
  const celebrationBusy = useRef(false);
  const queue = useRef<MilestoneKey[]>([]);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub?.remove();
  }, []);
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  // Load persisted state (demo: always fresh, never persisted). On a user
  // switch everything resets to neutral FIRST — state null, queue empty,
  // pending toast/celebration cancelled — so stale state can never be
  // persisted under the new user's storage key.
  useEffect(() => {
    setState(null);
    stateRef.current = null;
    queue.current = [];
    celebrationBusy.current = false;
    setToast(null); setConfetti(null); setJustKey(null); setShowFinale(false);
    if (toastTimer.current) { clearTimeout(toastTimer.current); toastTimer.current = null; }
    if (!userId) return;
    let cancelled = false;
    if (isDemo) { setState({ ...EMPTY, done: {} }); return; }
    readState(userId).then(s => { if (!cancelled) setState(s); });
    return () => { cancelled = true; };
  }, [userId, isDemo]);

  const persist = useCallback((s: GSState) => {
    setState(s);
    if (userId && !isDemo) writeState(userId, s);
  }, [userId, isDemo]);

  // Seed from existing data — no celebrations, just silent completion. Never
  // runs while a celebration is active: a silent retire mid-celebration would
  // yank the card away before the finale.
  useEffect(() => {
    const s = stateRef.current;
    if (!s || s.retired || celebrationBusy.current || queue.current.length > 0) return;
    const add: MilestoneKey[] = (['revenue', 'expense', 'goal'] as MilestoneKey[])
      .filter(k => seedSignals[k] && !s.done[k]);
    if (add.length === 0) return;
    const done = { ...s.done };
    for (const k of add) done[k] = true;
    const all = MILESTONES.every(m => done[m.key]);
    // Fully complete via seed → retire silently (no finale for old data).
    persist({ ...s, done, retired: s.retired || all });
  }, [seedSignals.revenue, seedSignals.expense, seedSignals.goal, state, persist]);

  const runCelebration = useCallback((key: MilestoneKey) => {
    const s = stateRef.current;
    // Re-check on every (queued) run — state may have changed while waiting.
    if (!s || s.retired || s.done[key]) {
      celebrationBusy.current = false;
      const next = queue.current.shift();
      if (next) runCelebration(next);
      return;
    }
    celebrationBusy.current = true;
    const done = { ...s.done, [key]: true };
    const all = MILESTONES.every(m => done[m.key]);
    const m = MILESTONES.find(x => x.key === key)!;
    persist({ ...s, done, dismissed: false });
    setJustKey(key);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    if (!reduceMotion) setConfetti({ big: all, id: Date.now() });
    setToast({ title: m.toastTitle, body: m.toastBody });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => {
      setToast(null);
      setJustKey(null);
      if (all) setShowFinale(true);
      celebrationBusy.current = false;
      const next = queue.current.shift();
      if (next) runCelebration(next);
    }, 2600);
  }, [persist, reduceMotion]);

  // Milestone + restore events.
  useEffect(() => {
    const onEvent = (e: Event) => {
      const s = stateRef.current;
      if (!s) return;
      if (e.kind === 'restore') { persist({ ...s, dismissed: false }); return; }
      if (s.retired || s.done[e.key]) return; // each goal completes only once
      if (celebrationBusy.current) { if (!queue.current.includes(e.key)) queue.current.push(e.key); return; }
      runCelebration(e.key);
    };
    listeners.add(onEvent);
    return () => { listeners.delete(onEvent); };
  }, [persist, runCelebration]);

  if (!state || state.retired) return null;
  if (state.dismissed && !showFinale) return null;

  const doneCount = MILESTONES.filter(m => state.done[m.key]).length;
  const fade = reduceMotion
    ? { entering: FadeIn.duration(150), exiting: FadeOut.duration(150) }
    : { entering: FadeIn.duration(300), exiting: FadeOut.duration(250) };

  // ── Finale card ──────────────────────────────────────────────────────────────
  if (showFinale) {
    return (
      <Animated.View {...fade} style={{ marginBottom: 24 }}>
        <View style={{
          borderRadius: 18, borderWidth: 1.5, borderColor: t.PRIMARY, backgroundColor: t.SURFACE,
          padding: 20, alignItems: 'center', gap: 8, overflow: 'hidden',
          shadowColor: t.PRIMARY, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 6,
        }}>
          {!reduceMotion && confetti && <ConfettiBurst big onDone={() => setConfetti(null)} />}
          <Text style={{ fontSize: 36 }}>🎉</Text>
          <Text accessibilityRole="header" style={{ color: t.TEXT, fontSize: 20, fontWeight: '900', textAlign: 'center' }}>
            You're All Set!
          </Text>
          <Text style={{ color: t.MUTED, fontSize: 14, lineHeight: 20, textAlign: 'center' }}>
            You've completed the Getting Started checklist. You're ready to make the most of Earnings Ninja.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              const s = stateRef.current!;
              setShowFinale(false);
              persist({ ...s, retired: true });
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            }}
            style={({ pressed }) => ({
              marginTop: 6, minHeight: 44, paddingHorizontal: 28, borderRadius: 12,
              backgroundColor: t.PRIMARY, alignItems: 'center', justifyContent: 'center',
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text style={{ color: t.ON_PRIMARY, fontSize: 15, fontWeight: '800' }}>Continue</Text>
          </Pressable>
        </View>
      </Animated.View>
    );
  }

  // ── Checklist card ───────────────────────────────────────────────────────────
  return (
    <Animated.View {...fade} style={{ marginBottom: 24 }}>
      <View style={{
        borderRadius: 18, overflow: 'hidden', backgroundColor: t.SURFACE,
        borderWidth: 1, borderColor: t.BORDER,
        shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 4,
      }}>
        {/* Subtle gradient accent strip */}
        <LinearGradient colors={[t.PRIMARY, '#fde047']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ height: 4 }} />
        <View style={{ padding: 16, gap: 14 }}>
          {!reduceMotion && confetti && <ConfettiBurst big={confetti.big} onDone={() => setConfetti(null)} />}

          {/* Header + close */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Text accessibilityRole="header" style={{ color: t.TEXT, fontSize: 18, fontWeight: '900' }}>
                ⭐ Getting Started
              </Text>
              <Text style={{ color: t.MUTED, fontSize: 12.5, lineHeight: 17, marginTop: 3 }}>
                Complete these three quick steps to unlock the full power of Earnings Ninja.
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Hide the Getting Started checklist"
              hitSlop={10}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                persist({ ...state, dismissed: true });
              }}
              style={({ pressed }) => ({
                width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
                backgroundColor: pressed ? t.BORDER : 'transparent',
              })}
            >
              <Ionicons name="close" size={18} color={t.MUTED} />
            </Pressable>
          </View>

          {/* Progress */}
          <View style={{ gap: 6 }}>
            <Text
              accessibilityLiveRegion="polite"
              style={{ color: t.PRIMARY_TXT, fontSize: 12, fontWeight: '800', letterSpacing: 0.5 }}
            >
              {doneCount} / {MILESTONES.length} Complete
            </Text>
            <View style={{ height: 8, borderRadius: 4, backgroundColor: t.BORDER, overflow: 'hidden' }}>
              <ProgressFill fraction={doneCount / MILESTONES.length} color={t.PRIMARY} reduceMotion={reduceMotion} />
            </View>
          </View>

          {/* Success toast (inline, never overlaps other celebrations) */}
          {toast && (
            <Animated.View
              {...fade}
              accessibilityLiveRegion="polite"
              style={{
                backgroundColor: t.PRI_LITE, borderRadius: 12, borderWidth: 1, borderColor: t.PRIMARY,
                paddingHorizontal: 12, paddingVertical: 10,
              }}
            >
              <Text style={{ color: t.TEXT, fontSize: 13.5, fontWeight: '800' }}>{toast.title}</Text>
              <Text style={{ color: t.MUTED, fontSize: 12, marginTop: 1 }}>{toast.body}</Text>
            </Animated.View>
          )}

          {/* Checklist rows */}
          <View style={{ gap: 12 }}>
            {MILESTONES.map(m => (
              <CheckRow
                key={m.key}
                emoji={m.emoji}
                title={m.title}
                desc={m.desc}
                done={!!state.done[m.key]}
                justCompleted={justKey === m.key}
                reduceMotion={reduceMotion}
                colors={{ TEXT: t.TEXT, MUTED: t.MUTED, BORDER: t.BORDER, GREEN: t.GREEN, PRI_LITE: t.PRI_LITE }}
              />
            ))}
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

function ProgressFill({ fraction, color, reduceMotion }: { fraction: number; color: string; reduceMotion: boolean }) {
  const w = useSharedValue(fraction);
  useEffect(() => {
    w.value = reduceMotion ? fraction : withSpring(fraction, { damping: 18, stiffness: 140 });
  }, [fraction, reduceMotion, w]);
  const style = useAnimatedStyle(() => ({ width: `${Math.min(1, Math.max(0, w.value)) * 100}%` }));
  return <Animated.View style={[{ height: '100%', borderRadius: 4, backgroundColor: color }, style]} />;
}
