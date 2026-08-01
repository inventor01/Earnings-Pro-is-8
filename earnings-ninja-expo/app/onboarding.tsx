import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  PanResponder,
  type LayoutChangeEvent,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/authContext';
import { useTheme } from '@/lib/theme';
import { api } from '@/lib/api';
import { useSubscription } from '@/lib/revenuecat';
import { applyOptimisticGoal } from '@/lib/goalOptimistic';
import { writePlatformsMirror } from '@/lib/platforms';
import {
  GIG_APP_OPTIONS,
  GOAL_STOPS,
  CHALLENGE_OPTIONS,
  DEFAULT_ONBOARDING_STATE,
  markPendingDoneWithoutUser,
  goalLabel,
  solutionForChallenge,
  splitSelectedApps,
  paywallHeadlineForGoal,
  readOnboardingState,
  writeOnboardingState,
  clearFreshSignupFlag,
  type OnboardingState,
  type ChallengeKey,
} from '@/lib/onboarding';

// Step indices. 0 Welcome → 1 Apps → 2 Goal → 3 Challenge → 4 Solution →
// 5 Building → 6 Blurred preview (→ paywall → dashboard).
const TOTAL_STEPS = 7;

// Checklist shown during the "building your dashboard" animation.
const BUILD_ITEMS = [
  'Personalized dashboard',
  'Profit tracking',
  'Goal tracking',
  'Tax-ready records',
];

export default function OnboardingScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { user, refreshUser } = useAuth();
  const { presentPaywall } = useSubscription();
  const qc = useQueryClient();

  const userId = user?.id ?? null;
  const [state, setState] = useState<OnboardingState | null>(null);
  const [finishing, setFinishing] = useState(false);
  // Guards against double-running the paywall handoff (e.g. re-render races).
  const finishRan = useRef(false);

  // Load the saved state so killing the app mid-flow resumes at the same step.
  // While the profile (and its user id) hasn't resolved yet — a fresh signup
  // whose /auth/me is still in flight or failing — start from the default
  // state immediately so the flow is NEVER a blank dead-end; once the id
  // arrives, merge in any saved progress (keeping whichever step is further)
  // and start persisting under the account key.
  useEffect(() => {
    if (!userId) {
      setState((prev) => prev ?? { ...DEFAULT_ONBOARDING_STATE });
      return;
    }
    let cancelled = false;
    readOnboardingState(userId).then((s) => {
      if (cancelled) return;
      setState((prev) => {
        const base = prev && prev.step > s.step ? { ...s, ...prev } : s;
        // Never resume INTO the transient building step — restart it from the
        // solution screen so the animation always runs from a stable point.
        const next = { ...base, step: base.step === 5 ? 4 : Math.min(base.step, 6) };
        writeOnboardingState(userId, next).catch(() => {});
        return next;
      });
    });
    return () => { cancelled = true; };
  }, [userId]);

  const update = useCallback(
    (patch: Partial<OnboardingState>) => {
      setState((prev) => {
        if (!prev) return prev;
        const next = { ...prev, ...patch };
        if (userId) writeOnboardingState(userId, next).catch(() => {});
        return next;
      });
    },
    [userId],
  );

  // ── Persistence of the personalization answers ──────────────────────────
  // Saved when the user advances past each step. Both paths are offline
  // tolerant: the goal upsert falls back to the mutation queue; platform
  // creates that fail stay in pendingPlatforms and are retried at completion
  // (and are harmless to lose — the user can add platforms any time).
  const saveGoal = useCallback(
    async (goal: number) => {
      try {
        await applyOptimisticGoal(qc, 'THIS_WEEK', goal);
        await api.upsertGoal('THIS_WEEK', goal);
      } catch {
        // Non-2xx permanent failure — onboarding must never dead-end on it.
      }
    },
    [qc],
  );

  const savePlatforms = useCallback(
    async (selected: string[], pendingOnly?: string[]) => {
      const names = pendingOnly ?? splitSelectedApps(selected).customNames;
      const stillPending: string[] = [];
      for (const name of names) {
        try {
          await api.addPlatform(name);
        } catch (e: any) {
          // 409 duplicate = already exists (fine). Anything else → retry later.
          if (e?.status !== 409) stillPending.push(name);
        }
      }
      if (names.length > stillPending.length) {
        // At least one create landed — refresh the entry form's platform list.
        try {
          const list = await api.getPlatforms();
          await writePlatformsMirror(list);
          qc.setQueryData(['platforms'], list);
        } catch {}
        qc.invalidateQueries({ queryKey: ['platforms'] });
      }
      return stillPending;
    },
    [qc],
  );

  // ── Completion: paywall handoff then dashboard (soft paywall) ────────────
  const finish = useCallback(async () => {
    if (finishRan.current || !state) return;
    finishRan.current = true;
    setFinishing(true);

    // Flush anything still pending, then mark done locally FIRST so a crash
    // right after the paywall can never re-run the whole funnel.
    const stillPending = await savePlatforms(state.apps, state.pendingPlatforms);
    if (user?.is_demo) {
      // Demo/reviewer accounts re-run the funnel on EVERY launch: never mark
      // completion (server or local) and reset the saved progress so the next
      // session starts from the welcome screen. Normal demo sessions never get
      // here (their server flag is true); only the reviewer account (flag
      // manually reset to false) reaches this path.
      if (userId) writeOnboardingState(userId, { ...DEFAULT_ONBOARDING_STATE }).catch(() => {});
    } else {
      let serverSynced = false;
      try {
        await api.completeOnboarding();
        serverSynced = true;
      } catch {
        // Offline / transient — localDone keeps the flow from re-showing; the
        // server flag lands on a later sync (syncOnboardingCompletion below).
      }
      update({ localDone: true, serverSynced, pendingPlatforms: stillPending, step: 6 });
      if (!userId) {
        // No profile yet (auth/me still failing) → update() couldn't persist
        // localDone under an account key. Record it device-scoped so the funnel
        // can never re-run; adopted into the account state on a later launch.
        markPendingDoneWithoutUser().catch(() => {});
      }
    }
    refreshUser().catch(() => {});
    clearFreshSignupFlag().catch(() => {});

    // Outcome-focused, goal-personalized paywall. Declining still lands on
    // the dashboard — feature gating elsewhere is unchanged.
    try {
      await presentPaywall({
        headline: paywallHeadlineForGoal(state.weeklyGoal),
        subheadline: 'Your personalized dashboard is ready.',
        showSocialProof: true,
      });
    } catch {}
    router.replace('/(tabs)');
  }, [state, user?.is_demo, userId, savePlatforms, update, refreshUser, presentPaywall]);

  // ── Building-step animation ──────────────────────────────────────────────
  const [builtCount, setBuiltCount] = useState(0);
  useEffect(() => {
    if (state?.step !== 5) return;
    setBuiltCount(0);
    const timers: ReturnType<typeof setTimeout>[] = [];
    BUILD_ITEMS.forEach((_, i) => {
      timers.push(setTimeout(() => setBuiltCount(i + 1), 600 * (i + 1)));
    });
    timers.push(setTimeout(() => update({ step: 6 }), 600 * BUILD_ITEMS.length + 900));
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.step]);

  if (!state) return <View style={{ flex: 1, backgroundColor: t.BG }} />;

  const goNext = () => update({ step: Math.min(state.step + 1, TOTAL_STEPS - 1) });
  const goBack = () => update({ step: Math.max(state.step - 1, 0) });

  const primary = (label: string, onPress: () => void, disabled = false) => (
    <Pressable
      onPress={onPress}
      disabled={disabled || finishing}
      style={{
        backgroundColor: t.PRIMARY,
        borderRadius: 999,
        paddingVertical: 17,
        paddingHorizontal: 20,
        alignItems: 'center',
        opacity: disabled || finishing ? 0.5 : 1,
        shadowColor: t.PRIMARY,
        shadowOpacity: 0.3,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
      }}
    >
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.75}
        style={{ color: t.ON_PRIMARY, fontSize: 17, fontWeight: '900', letterSpacing: 0.2, textAlign: 'center' }}
      >
        {label}
      </Text>
    </Pressable>
  );

  const showChrome = state.step > 0 && state.step < 5;

  return (
    <View style={{ flex: 1, backgroundColor: t.BG, paddingTop: insets.top }}>
      {/* Progress + back */}
      {showChrome ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 12 }}>
          <Pressable onPress={goBack} hitSlop={12} accessibilityLabel="Go back">
            <Ionicons name="chevron-back" size={24} color={t.MUTED} />
          </Pressable>
          <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: t.SURFACE, overflow: 'hidden' }}>
            <View
              style={{
                width: `${((state.step + 1) / TOTAL_STEPS) * 100}%`,
                height: '100%',
                borderRadius: 3,
                backgroundColor: t.PRIMARY,
              }}
            />
          </View>
        </View>
      ) : (
        <View style={{ height: 44 }} />
      )}

      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {state.step === 0 && (
          <Animated.View entering={FadeInDown.springify().damping(18)} style={{ flex: 1, justifyContent: 'center' }}>
            <Text style={{ fontSize: 64, textAlign: 'center', marginBottom: 16 }}>🥷</Text>
            <Text style={{ color: t.TEXT, fontSize: 34, fontWeight: '900', textAlign: 'center', letterSpacing: -0.5, lineHeight: 40 }}>
              Track every dollar{'\n'}you earn.
            </Text>
            <Text style={{ color: t.MUTED, fontSize: 16, textAlign: 'center', marginTop: 12, lineHeight: 23 }}>
              Earnings Ninja turns your gig driving into a business you can actually see — profit, goals, and taxes included.
            </Text>
            <View style={{ marginTop: 36 }}>{primary('Get Started', goNext)}</View>
          </Animated.View>
        )}

        {state.step === 1 && (
          <Animated.View entering={FadeInDown.springify().damping(18)}>
            <Text style={{ color: t.TEXT, fontSize: 26, fontWeight: '900', marginTop: 12 }}>
              Which apps do you drive for?
            </Text>
            <Text style={{ color: t.MUTED, fontSize: 14.5, marginTop: 6, lineHeight: 20 }}>
              We'll set up your earnings tracker for each one. Pick all that apply.
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 22 }}>
              {GIG_APP_OPTIONS.map((opt) => {
                const on = state.apps.includes(opt.key);
                return (
                  <Pressable
                    key={opt.key}
                    onPress={() =>
                      update({
                        apps: on ? state.apps.filter((k) => k !== opt.key) : [...state.apps, opt.key],
                      })
                    }
                    accessibilityState={{ selected: on }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                      borderRadius: 999,
                      borderWidth: 2,
                      borderColor: on ? t.PRIMARY : t.BORDER,
                      backgroundColor: on ? t.PRIMARY : t.SURFACE,
                    }}
                  >
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: opt.color }} />
                    <Text style={{ color: on ? t.ON_PRIMARY : t.TEXT, fontSize: 15, fontWeight: '700' }}>
                      {opt.label}
                    </Text>
                    {/* Always rendered (opacity 0 when unselected) so the chip
                        width never changes on toggle — no reflow/jumping. */}
                    <Ionicons name="checkmark" size={16} color={t.ON_PRIMARY} style={{ opacity: on ? 1 : 0 }} />
                  </Pressable>
                );
              })}
            </View>
            <View style={{ marginTop: 32 }}>
              {primary('Continue', async () => {
                // Fire-and-forget the custom-platform creates; failures are
                // kept in pendingPlatforms and retried at completion.
                const pending = await savePlatforms(state.apps);
                update({ pendingPlatforms: pending, step: 2 });
              }, state.apps.length === 0)}
            </View>
          </Animated.View>
        )}

        {state.step === 2 && (
          <Animated.View entering={FadeInDown.springify().damping(18)}>
            <Text style={{ color: t.TEXT, fontSize: 26, fontWeight: '900', marginTop: 12 }}>
              What's your weekly income goal?
            </Text>
            <Text style={{ color: t.MUTED, fontSize: 14.5, marginTop: 6, lineHeight: 20 }}>
              We'll track your progress toward it every week.
            </Text>
            <View style={{ alignItems: 'center', marginTop: 40 }}>
              <Text style={{ color: t.PRIMARY_TXT, fontSize: 52, fontWeight: '900', letterSpacing: -1 }}>
                {goalLabel(state.weeklyGoal)}
              </Text>
              <Text style={{ color: t.MUTED, fontSize: 14, marginTop: 2 }}>per week</Text>
            </View>
            <GoalSlider
              value={state.weeklyGoal}
              onChange={(v) => update({ weeklyGoal: v })}
            />
            <View style={{ marginTop: 36 }}>
              {primary('Continue', () => {
                saveGoal(state.weeklyGoal);
                update({ step: 3 });
              })}
            </View>
          </Animated.View>
        )}

        {state.step === 3 && (
          <Animated.View entering={FadeInDown.springify().damping(18)}>
            <Text style={{ color: t.TEXT, fontSize: 26, fontWeight: '900', marginTop: 12 }}>
              What's your biggest challenge?
            </Text>
            <Text style={{ color: t.MUTED, fontSize: 14.5, marginTop: 6, lineHeight: 20 }}>
              We'll tailor Earnings Ninja to what matters most to you.
            </Text>
            <View style={{ gap: 12, marginTop: 22 }}>
              {CHALLENGE_OPTIONS.map((opt) => {
                const on = state.challenge === opt.key;
                return (
                  <Pressable
                    key={opt.key}
                    onPress={() => update({ challenge: opt.key as ChallengeKey, step: 4 })}
                    accessibilityState={{ selected: on }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 14,
                      padding: 16,
                      borderRadius: 16,
                      borderWidth: 2,
                      borderColor: on ? t.PRIMARY : t.BORDER,
                      backgroundColor: t.SURFACE,
                    }}
                  >
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 12,
                        backgroundColor: t.CARD_BG,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ionicons name={opt.icon as any} size={20} color={t.PRIMARY_TXT} />
                    </View>
                    <Text style={{ color: t.TEXT, fontSize: 16, fontWeight: '700', flex: 1 }}>{opt.label}</Text>
                    <Ionicons name="chevron-forward" size={18} color={t.MUTED} />
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>
        )}

        {state.step === 4 && (() => {
          const sol = solutionForChallenge(state.challenge);
          return (
            <Animated.View entering={FadeInDown.springify().damping(18)}>
              <Text style={{ color: t.TEXT, fontSize: 27, fontWeight: '900', marginTop: 12, lineHeight: 33 }}>
                {sol.title}
              </Text>
              <Text style={{ color: t.MUTED, fontSize: 15, marginTop: 10, lineHeight: 22 }}>{sol.sub}</Text>
              <View
                style={{
                  marginTop: 24,
                  backgroundColor: t.SURFACE,
                  borderWidth: 1,
                  borderColor: t.BORDER,
                  borderRadius: 20,
                  paddingHorizontal: 16,
                  paddingVertical: 6,
                }}
              >
                {sol.points.map((p, i) => (
                  <View
                    key={p.text}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 14,
                      paddingVertical: 14,
                      borderTopWidth: i === 0 ? 0 : 1,
                      borderTopColor: t.DIVIDER,
                    }}
                  >
                    <View
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 12,
                        backgroundColor: '#000000',
                        borderWidth: 1.5,
                        borderColor: t.isDark ? 'rgba(250,204,21,0.55)' : '#000000',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ionicons name={p.icon as any} size={18} color="#facc15" />
                    </View>
                    <Text style={{ color: t.TEXT, fontSize: 15, fontWeight: '600', flex: 1, lineHeight: 20 }}>
                      {p.text}
                    </Text>
                    <Ionicons name="checkmark-circle" size={20} color={t.GREEN} />
                  </View>
                ))}
              </View>
              <View style={{ marginTop: 32 }}>{primary('Build My Dashboard', () => update({ step: 5 }))}</View>
            </Animated.View>
          );
        })()}

        {state.step === 5 && (
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <Text style={{ color: t.TEXT, fontSize: 24, fontWeight: '900', textAlign: 'center' }}>
              Building your personalized{'\n'}dashboard…
            </Text>
            <View style={{ marginTop: 32, gap: 16, alignSelf: 'center' }}>
              {BUILD_ITEMS.map((item, i) => (
                <View key={item} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  {i < builtCount ? (
                    <Animated.View entering={FadeIn}>
                      <Ionicons name="checkmark-circle" size={24} color={t.GREEN} />
                    </Animated.View>
                  ) : (
                    <Ionicons name="ellipse-outline" size={24} color={t.BORDER} />
                  )}
                  <Text
                    style={{
                      color: i < builtCount ? t.TEXT : t.MUTED,
                      fontSize: 16.5,
                      fontWeight: i < builtCount ? '800' : '600',
                    }}
                  >
                    {item}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {state.step === 6 && (
          <Animated.View entering={FadeInDown.springify().damping(18)}>
            <Text style={{ color: t.TEXT, fontSize: 26, fontWeight: '900', marginTop: 12, lineHeight: 32 }}>
              Your dashboard{'\n'}is ready.
            </Text>
            <Text style={{ color: t.MUTED, fontSize: 14.5, marginTop: 8, lineHeight: 20 }}>
              Here's a preview — premium analytics are waiting inside.
            </Text>
            <BlurredPreview weeklyGoal={state.weeklyGoal} />
            <View style={{ marginTop: 24 }}>
              {primary('Unlock My Personalized Dashboard', finish)}
            </View>
            <Pressable onPress={finish} disabled={finishing} hitSlop={12} style={{ paddingVertical: 14, alignItems: 'center' }}>
              <Text style={{ color: t.MUTED, fontSize: 13.5, fontWeight: '600' }}>Continue to dashboard</Text>
            </Pressable>
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
}

// ── Weekly-goal slider ($300–$1500+, snapping to the preset stops) ──────────
function GoalSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const t = useTheme();
  const [width, setWidth] = useState(0);
  const widthRef = useRef(0);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const idx = Math.max(0, GOAL_STOPS.indexOf(value as (typeof GOAL_STOPS)[number]));

  const snapFromX = useCallback((x: number) => {
    const w = widthRef.current;
    if (w <= 0) return;
    const frac = Math.min(1, Math.max(0, x / w));
    const i = Math.round(frac * (GOAL_STOPS.length - 1));
    onChangeRef.current(GOAL_STOPS[i]);
  }, []);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => snapFromX(e.nativeEvent.locationX),
      onPanResponderMove: (e) => snapFromX(e.nativeEvent.locationX),
    }),
  ).current;

  const onLayout = (e: LayoutChangeEvent) => {
    widthRef.current = e.nativeEvent.layout.width;
    setWidth(e.nativeEvent.layout.width);
  };

  const frac = GOAL_STOPS.length > 1 ? idx / (GOAL_STOPS.length - 1) : 0;

  return (
    <View style={{ marginTop: 36 }}>
      <View
        onLayout={onLayout}
        {...pan.panHandlers}
        accessibilityRole="adjustable"
        accessibilityLabel="Weekly income goal"
        accessibilityValue={{ text: goalLabel(value) }}
        style={{ height: 44, justifyContent: 'center' }}
      >
        <View style={{ height: 8, borderRadius: 4, backgroundColor: t.SURFACE }} />
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            width: Math.max(8, frac * width),
            height: 8,
            borderRadius: 4,
            backgroundColor: t.PRIMARY,
          }}
        />
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: Math.max(0, frac * Math.max(0, width - 28)),
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: t.PRIMARY,
            borderWidth: 3,
            borderColor: t.BG,
            shadowColor: '#000',
            shadowOpacity: 0.3,
            shadowRadius: 6,
            shadowOffset: { width: 0, height: 2 },
          }}
        />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
        {GOAL_STOPS.map((s, i) => (
          <Pressable key={s} onPress={() => onChange(s)} hitSlop={10}>
            <Text
              style={{
                color: i === idx ? t.PRIMARY_TXT : t.MUTED,
                fontSize: 12.5,
                fontWeight: i === idx ? '900' : '600',
              }}
            >
              {goalLabel(s)}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// ── Blurred premium-analytics preview (pure RN — no native blur dep) ────────
function BlurredPreview({ weeklyGoal }: { weeklyGoal: number }) {
  const t = useTheme();
  const bars = [0.45, 0.7, 0.55, 0.9, 0.65, 1, 0.8];
  return (
    <View
      style={{
        marginTop: 20,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: t.BORDER,
        backgroundColor: t.SURFACE,
        overflow: 'hidden',
      }}
    >
      <View style={{ padding: 16 }}>
        {/* Un-blurred: their own goal, front and center */}
        <Text style={{ color: t.MUTED, fontSize: 12, fontWeight: '700', letterSpacing: 1 }}>WEEKLY GOAL</Text>
        <Text style={{ color: t.TEXT, fontSize: 28, fontWeight: '900', marginTop: 2 }}>{goalLabel(weeklyGoal)}</Text>

        {/* "Blurred" premium rows: skeleton amounts under a frosted overlay */}
        <View style={{ marginTop: 16, gap: 12 }}>
          {['Real net profit', 'Best hours to drive', 'AI earning suggestions'].map((label) => (
            <View key={label} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: t.MUTED, fontSize: 13.5, fontWeight: '600' }}>{label}</Text>
              <View style={{ width: 74, height: 18, borderRadius: 6, backgroundColor: t.CARD_BG, opacity: 0.9 }} />
            </View>
          ))}
        </View>

        {/* Blurred trend chart */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 90, marginTop: 20 }}>
          {bars.map((h, i) => (
            <View
              key={i}
              style={{
                flex: 1,
                height: `${h * 100}%`,
                borderRadius: 6,
                backgroundColor: t.PRIMARY,
                opacity: 0.25,
              }}
            />
          ))}
        </View>
      </View>
      {/* Frosted overlay with lock */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 92,
          bottom: 0,
          backgroundColor: t.isDark ? 'rgba(10,10,10,0.55)' : 'rgba(255,255,255,0.6)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: t.PRIMARY,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="lock-closed" size={20} color={t.ON_PRIMARY} />
        </View>
      </View>
    </View>
  );
}
