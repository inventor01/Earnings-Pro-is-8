import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, Pressable, Modal,
  RefreshControl, ActivityIndicator, Image, Alert,
  TextInput, KeyboardAvoidingView, Platform,
  ViewStyle, TextStyle, StyleSheet,
  NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withSequence, withRepeat, withDelay,
  Easing, runOnJS, FadeInDown, FadeOutUp, LinearTransition,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  api, Entry, EntryCreate, EntryType, AppType, ExpenseCategory, Rollup,
  APP_LABELS, APP_COLORS, EXPENSE_EMOJIS, TimeframeType, parseServerDate,
} from '@/lib/api';
import { useAuth } from '@/lib/authContext';
import * as Haptics from 'expo-haptics';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { CalendarModal } from '../../components/CalendarModal';
import { TransactionDetailModal } from '../../components/TransactionDetailModal';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as DocumentPicker from 'expo-document-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme, useThemeControls, THEMES, ThemeName } from '@/lib/theme';
import { useHiddenMode, MASK } from '@/lib/hiddenMode';
import { syncNotifState, enableMotivation, disableMotivation } from '@/lib/notifications';
import { getSoundEnabled, setSoundEnabled, playKaching } from '@/lib/sound';
import { useOilChange, OIL_CHANGE_INTERVAL } from '@/lib/oilChange';
import { widgetSync } from '@/lib/widgetSync';
import { exportEntriesCsv, easternDateTime } from '@/lib/csvExport';
import { useLocalSearchParams, router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Persists the platform the user most recently logged an ORDER against, so the
// Add Entry modal can default new orders to it (Expenses still default to OTHER).
const LAST_ORDER_APP_KEY = 'last_order_app';

// Safe haptics — silently ignored on simulators / devices without haptic engine
const hTap = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
const hTapMed = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
const hTapHeavy = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
const hNotifyOk = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

// ─── Colors come from active Theme via useTheme() ────────────────────────────
// Each component below destructures the palette at the top, e.g.
//   const { BG, SURFACE, PRIMARY, ... } = useTheme();
// Hooks like useMilestoneGlow / DashedLine read theme themselves so callers
// don't need to forward palette values.

// ─── Neon glow helper (mirrors Tailwind shadow-[0_0_Npx_color]) ──────────────
const neonGlow = (color: string, radius: number = 16, opacity: number = 0.45): ViewStyle => ({
  shadowColor: color,
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: opacity,
  shadowRadius: radius,
  elevation: Math.round(radius / 2),
});

// ─── Press-scale Pressable (mirrors web active:scale-95) ─────────────────────
function PressScale({
  children, onPress, onLongPress, scale = 0.96, style, hitSlop, disabled,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  scale?: number;
  style?: ViewStyle | ViewStyle[];
  hitSlop?: number;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      hitSlop={hitSlop}
      android_ripple={{ color: 'rgba(255,255,255,0.06)' }}
      style={({ pressed }) => [
        Array.isArray(style) ? Object.assign({}, ...style) : style,
        {
          opacity: pressed ? 0.9 : disabled ? 0.5 : 1,
          transform: [{ scale: pressed ? scale : 1 }],
        },
      ]}
    >
      {children}
    </Pressable>
  );
}

// ─── AnimatedNumber: smooth count-up via requestAnimationFrame ───────────────
function AnimatedNumber({
  value, format, style, duration = 700, hideable = true,
}: {
  value: number;
  format: (n: number) => string;
  style?: TextStyle | TextStyle[];
  duration?: number;
  // Monetary values are hidden in Hidden Mode; counts pass hideable={false}.
  hideable?: boolean;
}) {
  const { hidden } = useHiddenMode();
  const [display, setDisplay] = useState(value);
  // Track the latest *rendered* value so that if a new target arrives
  // mid-animation we tween from where we currently are (no snap/jitter).
  const displayRef = useRef(value);

  useEffect(() => {
    const start = displayRef.current;
    const end = value;
    if (start === end) return;
    const t0 = Date.now();
    let raf: number;
    const tick = () => {
      const t = Math.min((Date.now() - t0) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      const current = start + (end - start) * eased;
      displayRef.current = current;
      setDisplay(current);
      if (t < 1) raf = requestAnimationFrame(tick);
      else displayRef.current = end;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  if (hidden && hideable) return <Text style={style}>{MASK}</Text>;
  return <Text style={style}>{format(display)}</Text>;
}

// ─── Pop animation hook (Hero pulses on value change) ────────────────────────
function usePopOnChange(value: number, intensity: number = 1.08) {
  const scale = useSharedValue(1);
  const initialMount = useRef(true);
  useEffect(() => {
    if (initialMount.current) { initialMount.current = false; return; }
    scale.value = withSequence(
      withTiming(intensity, { duration: 160, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: 220, easing: Easing.inOut(Easing.quad) }),
    );
  }, [value]);
  return useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
}

// ─── Milestone glow on ninja logo ($50/$100/$150...) ─────────────────────────
function useMilestoneGlow(profit: number) {
  const { GREEN, PRIMARY } = useTheme();
  const milestone = Math.max(0, Math.floor(profit / 50));
  const glow = useSharedValue(0);
  const lastRef = useRef(0);
  useEffect(() => {
    if (milestone > lastRef.current && milestone > 0) {
      // Big celebratory pulse, then settle to gentle ambient glow
      glow.value = withSequence(
        withTiming(1, { duration: 250 }),
        withRepeat(
          withSequence(
            withTiming(0.4, { duration: 800 }),
            withTiming(0.9, { duration: 800 }),
          ),
          3, false,
        ),
        withTiming(0.35, { duration: 600 }),
      );
    } else if (milestone === 0) {
      glow.value = withTiming(0, { duration: 400 });
    }
    lastRef.current = milestone;
  }, [milestone]);

  const color = milestone >= 2 ? GREEN : PRIMARY; // green at $100+, yellow at $50+
  return useAnimatedStyle(() => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: glow.value * 0.9,
    shadowRadius: 8 + glow.value * 18,
    elevation: glow.value * 8,
  }));
}

// ─── Skeleton primitives ──────────────────────────────────────────────────────
// Subtle looped opacity shimmer (0.45 → 1.0 → 0.45). Reanimated keeps this on
// the UI thread so it stays smooth even when the rest of the JS thread is
// busy boot-loading data.
function SkeletonBox({
  width, height, radius = 8, style,
}: { width: number | `${number}%`; height: number; radius?: number; style?: ViewStyle }) {
  const { CARD_BG, BORDER } = useTheme();
  const shimmer = useSharedValue(0.5);
  useEffect(() => {
    shimmer.value = withRepeat(
      withSequence(
        withTiming(1.0, { duration: 750 }),
        withTiming(0.45, { duration: 750 }),
      ),
      -1, false,
    );
  }, [shimmer]);
  const animatedStyle = useAnimatedStyle(() => ({ opacity: shimmer.value }));
  return (
    <Animated.View
      style={[
        {
          width, height, borderRadius: radius,
          backgroundColor: CARD_BG, borderWidth: 1, borderColor: BORDER,
        },
        animatedStyle,
        style,
      ]}
    />
  );
}

function DashboardSkeleton() {
  const { SURFACE, BORDER } = useTheme();
  return (
    <View style={{ gap: 12 }}>
      {/* Hero card mock */}
      <View style={{
        backgroundColor: SURFACE, borderRadius: 20, borderWidth: 1, borderColor: BORDER, padding: 20,
      }}>
        {/* title row: label left, alt-metric pill right */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <SkeletonBox width={60} height={12} radius={4} />
          <SkeletonBox width={120} height={26} radius={8} />
        </View>
        {/* big number */}
        <SkeletonBox width={'62%'} height={48} radius={10} style={{ marginTop: 10 }} />
        {/* date row */}
        <SkeletonBox width={'45%'} height={14} radius={4} style={{ marginTop: 10, alignSelf: 'center' }} />
        {/* dashed divider stand-in */}
        <View style={{ height: 1, backgroundColor: BORDER, marginTop: 14, opacity: 0.5 }} />
        {/* three inline stats */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 14, gap: 12 }}>
          {[0, 1, 2].map(i => (
            <View key={i} style={{ flex: 1, gap: 6 }}>
              <SkeletonBox width={'70%'} height={10} radius={3} />
              <SkeletonBox width={'85%'} height={20} radius={6} />
            </View>
          ))}
        </View>
      </View>

      {/* KPI strip: $/Mile + Miles */}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {[0, 1].map(i => (
          <View key={i} style={{
            flex: 1, backgroundColor: SURFACE, borderRadius: 16, borderWidth: 1, borderColor: BORDER,
            padding: 14, gap: 8,
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <SkeletonBox width={50} height={10} radius={3} />
              <SkeletonBox width={20} height={20} radius={10} />
            </View>
            <SkeletonBox width={'60%'} height={26} radius={6} style={{ marginTop: 4 }} />
          </View>
        ))}
      </View>

      {/* Goals section header + bar */}
      <View style={{ marginTop: 4, gap: 8 }}>
        <SkeletonBox width={50} height={10} radius={3} />
        <View style={{
          backgroundColor: SURFACE, borderRadius: 16, borderWidth: 1, borderColor: BORDER, padding: 14, gap: 10,
        }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <SkeletonBox width={120} height={14} radius={4} />
            <SkeletonBox width={70} height={14} radius={4} />
          </View>
          <SkeletonBox width={'100%'} height={10} radius={5} />
        </View>
      </View>

    </View>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────
type Period = 'today' | 'yesterday' | 'week' | 'last7' | 'month' | 'lastMonth' | 'custom';

const PERIODS: { key: Period; label: string; tf: TimeframeType }[] = [
  { key: 'today',     label: 'Today',      tf: 'TODAY' },
  { key: 'yesterday', label: 'Yesterday',  tf: 'YESTERDAY' },
  { key: 'week',      label: 'This Week',  tf: 'THIS_WEEK' },
  { key: 'last7',     label: 'Last 7 Days', tf: 'LAST_7_DAYS' },
  { key: 'month',     label: 'This Month', tf: 'THIS_MONTH' },
  { key: 'lastMonth', label: 'Last Month', tf: 'LAST_MONTH' },
];

const PERIOD_LABELS: Record<Period, string> = {
  today:     "Today's",
  yesterday: "Yesterday's",
  week:      "This Week's",
  last7:     'Last 7 Days',
  month:     "This Month's",
  lastMonth: "Last Month's",
  custom:    'Custom Range',
};

// Compact "Apr 14" display for custom-range chips/labels.
function formatShortDate(yyyymmdd: string): string {
  const [y, m, d] = yyyymmdd.split('-').map(n => parseInt(n, 10));
  if (!y || !m || !d) return yyyymmdd;
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Period-swipe date math (EST, matches backend/services/period.py) ──────────
// All calendar arithmetic is done on a UTC-anchored Date so it's independent of
// the device timezone; only the *initial* "today" is resolved in US/Eastern so
// the windows line up exactly with the server's EST day/week/month boundaries.
function estTodayUTC(): Date {
  const s = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' }); // YYYY-MM-DD
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function fmtUTCDate(dt: Date): string {
  return dt.toISOString().slice(0, 10); // YYYY-MM-DD
}
// Given a period chip + integer offset (0 = the live, current window), return the
// EST {from,to} date range to query — OR null when the offset-0 timeframe path
// should be used instead (preserves exact current behavior + goal semantics for
// the live window, and lets day-periods use the backend's day_offset param).
function navRangeFor(
  period: 'today' | 'yesterday' | 'week' | 'last7' | 'month' | 'lastMonth' | 'custom',
  offset: number,
): { from: string; to: string } | null {
  if (offset === 0) return null;
  // Day-periods use the backend day_offset path; custom never swipes.
  if (period === 'today' || period === 'yesterday' || period === 'custom') return null;
  const base = estTodayUTC();
  if (period === 'week') {
    // Live "This Week" = Monday..today. For other offsets, full Mon..Sun weeks.
    const dow = (base.getUTCDay() + 6) % 7; // 0 = Monday
    const mon = new Date(base); mon.setUTCDate(base.getUTCDate() - dow + offset * 7);
    const sun = new Date(mon); sun.setUTCDate(mon.getUTCDate() + 6);
    return { from: fmtUTCDate(mon), to: fmtUTCDate(sun) };
  }
  if (period === 'last7') {
    // Rolling 7-day window [today-6 .. today], shifted by `offset` weeks.
    const end = new Date(base); end.setUTCDate(base.getUTCDate() + offset * 7);
    const start = new Date(end); start.setUTCDate(end.getUTCDate() - 6);
    return { from: fmtUTCDate(start), to: fmtUTCDate(end) };
  }
  if (period === 'month') {
    // Live "This Month" = 1st..today. For other offsets, full calendar months.
    const first = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + offset, 1));
    const last = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + offset + 1, 0));
    return { from: fmtUTCDate(first), to: fmtUTCDate(last) };
  }
  if (period === 'lastMonth') {
    // Base = previous calendar month; `offset` shifts further full months.
    const first = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() - 1 + offset, 1));
    const last = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + offset, 0));
    return { from: fmtUTCDate(first), to: fmtUTCDate(last) };
  }
  return null;
}

// Map the single-day offset actually being viewed (0 = today, -1 = yesterday, …)
// to the period tab that should be HIGHLIGHTED while swiping through days. This is
// a purely visual "how far back am I" indicator — the dashboard keeps showing that
// ONE day's numbers; only the highlighted tab moves. Mapping is by EST calendar
// (matching the server's day/week/month boundaries): today → Today, exactly 1 day
// back → Yesterday, any earlier day still inside the current week → This Week,
// still inside the current month → This Month; anything older clamps to This Month
// (the furthest indicator chip).
function dayOffsetToChip(offset: number): Period {
  if (offset >= 0) return 'today';
  if (offset === -1) return 'yesterday';
  const base = estTodayUTC();
  const target = new Date(base);
  target.setUTCDate(base.getUTCDate() + offset); // offset is negative → a past EST date
  const dow = (base.getUTCDay() + 6) % 7; // 0 = Monday
  const monday = new Date(base);
  monday.setUTCDate(base.getUTCDate() - dow);
  if (target.getTime() >= monday.getTime()) return 'week';
  if (
    target.getUTCFullYear() === base.getUTCFullYear() &&
    target.getUTCMonth() === base.getUTCMonth()
  ) return 'month';
  return 'month';
}

const APPS: { key: AppType; label: string; color: string }[] = [
  { key: 'DOORDASH',  label: 'DoorDash',  color: '#FF3008' },
  { key: 'UBEREATS',  label: 'Uber Eats', color: '#06C167' },
  { key: 'INSTACART', label: 'Instacart', color: '#43B02A' },
  { key: 'GRUBHUB',   label: 'GrubHub',   color: '#F63440' },
  { key: 'SHIPT',     label: 'Shipt',     color: '#00A6CE' },
  { key: 'OTHER',     label: 'Other',     color: '#6B7280' },
];

const EXPENSE_CATS: ExpenseCategory[] = [
  'GAS', 'PARKING', 'TOLLS', 'MAINTENANCE', 'PHONE', 'SUBSCRIPTION', 'FOOD', 'CHARITY', 'OTHER',
];

// ─── Profit Chart ─────────────────────────────────────────────────────────────
// Replaces the old decorative dashed line with a real, period-aware bar chart
// of net profit (revenue − expenses) bucketed appropriately for the dashboard's
// current period: hourly for today/yesterday/single-day, daily for week/month/
// custom ranges. Positive bars rise above the baseline (profit), negative bars
// fall below (loss). No data → subtle "—" placeholder.
function ProfitChart({
  entries,
  period,
  customRange,
  dayOffset,
  positiveColor,
  negativeColor,
}: {
  entries: Entry[];
  period: 'today' | 'yesterday' | 'week' | 'last7' | 'month' | 'lastMonth' | 'custom';
  customRange: { from: string; to: string } | null;
  dayOffset: number;
  positiveColor: string;
  negativeColor: string;
}) {
  const { LABEL, DIVIDER } = useTheme();

  // Determine buckets: list of { key, sum } where sum = signed-amount total.
  type Bucket = { key: string; sum: number };
  const buckets: Bucket[] = (() => {
    // Hourly (24) for any single-day view
    if (period === 'today' || period === 'yesterday') {
      const arr: Bucket[] = Array.from({ length: 24 }, (_, h) => ({ key: String(h), sum: 0 }));
      for (const e of entries) {
        const d = parseServerDate(e.timestamp);
        const h = d.getHours();
        if (h >= 0 && h < 24) arr[h].sum += Number(e.amount) || 0;
      }
      return arr;
    }

    // Daily for multi-day ranges. Determine the day-count from the period.
    let days = 7;
    let endDate = new Date();
    if (period === 'week' || period === 'last7') {
      days = 7;
      endDate = new Date();
    } else if (period === 'month') {
      const now = new Date();
      endDate = now;
      days = now.getDate(); // days elapsed this month
    } else if (period === 'lastMonth') {
      const now = new Date();
      // last day of previous month
      endDate = new Date(now.getFullYear(), now.getMonth(), 0);
      days = endDate.getDate();
    } else if (period === 'custom' && customRange) {
      // EST date strings 'YYYY-MM-DD' — count inclusive
      const from = new Date(customRange.from + 'T00:00:00');
      const to   = new Date(customRange.to   + 'T00:00:00');
      const ms = to.getTime() - from.getTime();
      days = Math.max(1, Math.round(ms / 86400000) + 1);
      endDate = to;
    }
    // Cap at ~31 buckets so bars stay legible.
    days = Math.min(days, 31);

    // Build ascending day keys ending on endDate.
    const dayKey = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    const arr: Bucket[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(endDate);
      d.setDate(endDate.getDate() - i);
      arr.push({ key: dayKey(d), sum: 0 });
    }
    const indexByKey = new Map(arr.map((b, i) => [b.key, i]));
    for (const e of entries) {
      const d = parseServerDate(e.timestamp);
      const k = dayKey(d);
      const idx = indexByKey.get(k);
      if (idx !== undefined) arr[idx].sum += Number(e.amount) || 0;
    }
    return arr;
  })();

  const maxAbs = Math.max(1, ...buckets.map(b => Math.abs(b.sum)));
  const hasAny = buckets.some(b => b.sum !== 0);
  const CHART_H = 110;
  const HALF = CHART_H / 2;

  // Bucket count drives bar width; keep small gaps between bars.
  const N = buckets.length;
  const GAP = N > 14 ? 1 : 2;

  if (!hasAny) {
    return (
      <View style={{ height: CHART_H, paddingVertical: 36, justifyContent: 'center' }}>
        <View style={{ height: 1.5, backgroundColor: DIVIDER, opacity: 0.4 }} />
        <Text style={{
          color: LABEL, fontSize: 11, textAlign: 'center', marginTop: 10,
          letterSpacing: 1, textTransform: 'uppercase', fontWeight: '700', opacity: 0.6,
        }}>
          No entries yet
        </Text>
      </View>
    );
  }

  return (
    <View style={{ height: CHART_H, paddingVertical: 8, justifyContent: 'center' }}>
      <View style={{ height: CHART_H - 16, flexDirection: 'row', alignItems: 'center', gap: GAP }}>
        {buckets.map((b, i) => {
          const ratio = Math.abs(b.sum) / maxAbs; // 0..1
          const h = Math.max(b.sum !== 0 ? 2 : 0, ratio * (HALF - 8));
          const positive = b.sum >= 0;
          return (
            <View key={i} style={{ flex: 1, height: '100%', justifyContent: 'center', position: 'relative' }}>
              {/* zero baseline */}
              <View style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 1, backgroundColor: DIVIDER, opacity: 0.4 }} />
              {/* bar */}
              {b.sum !== 0 && (
                <View style={{
                  position: 'absolute',
                  left: 0, right: 0,
                  top: positive ? `${50 - (h / (CHART_H - 16)) * 100}%` : '50%',
                  height: h,
                  backgroundColor: positive ? positiveColor : negativeColor,
                  opacity: 0.85,
                  borderRadius: 2,
                }} />
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ─── Small Stat Card (subtle yellow neon outline + animated value) ──────────
function StatCard({
  label, value, icon, numericValue, format, accent, hideable = true,
}: {
  label: string;
  value: string;
  icon: string;
  numericValue?: number;
  format?: (n: number) => string;
  accent?: string;
  hideable?: boolean;
}) {
  const { SURFACE, TEXT, LABEL, PRIMARY } = useTheme();
  const { hidden } = useHiddenMode();
  const acc = accent ?? PRIMARY;
  return (
    <View style={[
      {
        flex: 1,
        backgroundColor: SURFACE,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: acc + '22',
        padding: 12,
      },
      neonGlow(acc, 6, 0.10),
    ]}>
      <Text style={{ fontSize: 18, marginBottom: 4 }}>{icon}</Text>
      {numericValue !== undefined && format ? (
        <AnimatedNumber
          value={numericValue}
          format={format}
          hideable={hideable}
          style={{ color: TEXT, fontSize: 17, fontWeight: '800' }}
        />
      ) : (
        <Text style={{ color: TEXT, fontSize: 17, fontWeight: '800' }}>
          {hidden && hideable ? MASK : value}
        </Text>
      )}
      <Text style={{ color: LABEL, fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 2 }}>
        {label}
      </Text>
    </View>
  );
}

// ─── Entry Row ────────────────────────────────────────────────────────────────
// Three modes:
//   • Normal:        shows edit + delete icons on the right.
//   • Selection on:  the icons are replaced by a checkbox; tapping anywhere on
//                    the row toggles selection. Edit/delete are hidden so a
//                    long press list operation doesn't have ambiguous targets.
function EntryRow({
  entry, onDelete, onEdit, onLongPress,
  selectionMode = false, selected = false, onToggleSelect,
}: {
  entry: Entry;
  onDelete: (id: number) => void;
  onEdit?: (entry: Entry) => void;
  onLongPress?: (entry: Entry) => void;
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: number) => void;
}) {
  const { TEXT, LABEL, MUTED, RED, GREEN, DIVIDER, PRIMARY, PRI_LITE } = useTheme();
  const { hidden } = useHiddenMode();
  const isExpense = entry.amount < 0;
  const isBusiness = !!entry.is_business_expense;
  const BIZ = '#3b82f6';
  const appColor  = APP_COLORS[entry.app] || MUTED;
  const time      = parseServerDate(entry.timestamp).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
  const date      = parseServerDate(entry.timestamp).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric',
  });

  const body = (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderBottomWidth: 1,
      borderBottomColor: DIVIDER,
      backgroundColor: selectionMode && selected ? PRI_LITE : 'transparent',
    }}>
      {selectionMode && (
        <View style={{
          width: 22, height: 22, borderRadius: 11,
          borderWidth: 2,
          borderColor: selected ? PRIMARY : LABEL,
          backgroundColor: selected ? PRIMARY : 'transparent',
          alignItems: 'center', justifyContent: 'center',
          marginRight: 12,
        }}>
          {selected && <Ionicons name="checkmark" size={14} color="#000" />}
        </View>
      )}
      <View style={{
        width: 38, height: 38, borderRadius: 19,
        backgroundColor: isBusiness ? BIZ + '22' : appColor + '18',
        alignItems: 'center', justifyContent: 'center', marginRight: 12,
      }}>
        {isBusiness ? (
          <Text style={{ fontSize: 16 }}>💼</Text>
        ) : (
          <Text style={{ fontSize: 14, fontWeight: '900', color: appColor }}>
            {(APP_LABELS[entry.app] || 'O')[0]}
          </Text>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: TEXT, fontSize: 14, fontWeight: '600' }} numberOfLines={1}>
          {APP_LABELS[entry.app]}
          <Text style={{ color: LABEL, fontWeight: '400', fontSize: 12 }}> · {entry.type}</Text>
          {isBusiness ? (
            <Text style={{ color: BIZ, fontWeight: '700', fontSize: 12 }}> · 💼 Business</Text>
          ) : null}
        </Text>
        <Text style={{ color: LABEL, fontSize: 11, marginTop: 1 }} numberOfLines={1}>
          {date} · {time}{entry.distance_miles > 0 ? ` · ${Number(entry.distance_miles).toFixed(1)} mi` : ''}
        </Text>
        {entry.note ? (
          <Text style={{ color: MUTED, fontSize: 11, marginTop: 2, fontStyle: 'italic' }} numberOfLines={1}>
            {entry.note}
          </Text>
        ) : null}
      </View>
      <Text style={{
        color: isExpense ? RED : GREEN,
        fontSize: 15, fontWeight: '700',
      }}>
        {hidden ? MASK : `${isExpense ? '-' : '+'}$${Math.abs(Number(entry.amount)).toFixed(2)}`}
      </Text>
      {!selectionMode && (
        <>
          {onEdit && (
            <Pressable onPress={() => onEdit(entry)} style={{ marginLeft: 8, padding: 6 }} hitSlop={6}>
              <Ionicons name="pencil-outline" size={14} color={LABEL} />
            </Pressable>
          )}
          <Pressable onPress={() => onDelete(entry.id)} style={{ marginLeft: 4, padding: 6 }} hitSlop={6}>
            <Ionicons name="trash-outline" size={14} color={LABEL} />
          </Pressable>
        </>
      )}
    </View>
  );

  // Long press always opens the detail modal (in or out of selection mode).
  // Short tap only does something in selection mode (toggle the checkbox).
  return (
    <Pressable
      onPress={selectionMode ? () => { hTap(); onToggleSelect?.(entry.id); } : undefined}
      onLongPress={onLongPress ? () => { hTapMed(); onLongPress(entry); } : undefined}
      delayLongPress={350}
    >
      {body}
    </Pressable>
  );
}

// ─── Calculator pad palette (mirrors web Tailwind tokens) ────────────────────
const CALC = {
  HEADER_BG:      '#facc15',          // yellow-400
  CARD_BG:        '#ffffff',          // modal background
  CARD_FROM:      '#ffffff',          // gradient bg-white
  CARD_TO:        '#f9fafb',          // to-gray-50
  NUM_BG:         '#f3f4f6',          // gray-100 (used by inputs/pills in details step)
  AMOUNT_FROM:    '#dbeafe',          // blue-100
  AMOUNT_TO:      '#f3e8ff',          // purple-100
  AMOUNT_BORDER:  '#93c5fd',          // blue-300 (border-4)
  AMOUNT_TEXT:    '#0f172a',
  NUM_FROM:       '#f3f4f6',          // gray-100
  NUM_TO:         '#e5e7eb',          // gray-200
  NUM_TEXT:       '#111827',          // gray-900
  REV_FROM:       '#4ade80',          // green-400
  REV_TO:         '#22c55e',          // green-500
  EXP_FROM:       '#f87171',          // red-400
  EXP_TO:         '#ef4444',          // red-500
  OFF_BG:         '#e5e7eb',          // gray-200
  OFF_FG:         '#374151',          // gray-700
  BACKSPACE_FROM: '#fb923c',          // orange-400
  BACKSPACE_TO:   '#f97316',          // orange-500
  BACKSPACE_HELD_FROM: '#ef4444',     // red-500
  BACKSPACE_HELD_TO:   '#dc2626',     // red-600
  BACKSPACE_FG:   '#ffffff',
  NEXT_BG:        '#facc15',          // yellow-400
  NEXT_FG:        '#111827',          // gray-900
  LABEL:          '#6b7280',
  BORDER:         '#e5e7eb',
};

// ─── Calculator Pad (mirrors web CalcPad.tsx 1:1) ────────────────────────────
// Reusable gradient button helper: outer View carries shadow + flex, inner
// Pressable handles touch + press feedback, LinearGradient paints the bg.
function GradBtn({
  colors, onPress, onPressIn, onPressOut, children, flex = 1, shadow = true,
  rounded = 14, paddingVertical = 22, pressedScale = 0.95,
}: {
  colors: readonly [string, string];
  onPress?: () => void;
  onPressIn?: () => void;
  onPressOut?: () => void;
  children: React.ReactNode;
  flex?: number;
  shadow?: boolean;
  rounded?: number;
  paddingVertical?: number;
  pressedScale?: number;
}) {
  return (
    <View style={{
      flex,
      borderRadius: rounded,
      backgroundColor: colors[0], // gives iOS a solid layer for the shadow
      ...(shadow ? {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 4,
        elevation: 3,
      } : {}),
    }}>
      <View style={{ borderRadius: rounded, overflow: 'hidden' }}>
        <Pressable
          onPress={onPress}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          android_ripple={{ color: 'rgba(0,0,0,0.08)' }}
          style={({ pressed }) => ({
            opacity: pressed ? 0.92 : 1,
            transform: [{ scale: pressed ? pressedScale : 1 }],
          })}
        >
          <LinearGradient
            colors={colors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ paddingVertical, alignItems: 'center', justifyContent: 'center' }}
          >
            {children}
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

function CalcPad({ amount, mode, onAmount, onMode }: {
  amount: string;
  mode: 'add' | 'subtract';
  onAmount: (v: string) => void;
  onMode: (m: 'add' | 'subtract') => void;
}) {
  const holdRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isHeld, setIsHeld] = useState(false);

  const tap = (n: string) => {
    hTap();
    if (n === '.') {
      if (!amount.includes('.')) onAmount(amount + '.');
    } else {
      onAmount(amount === '0' ? n : amount + n);
    }
  };

  const onBackspaceIn = () => {
    setIsHeld(false);
    holdRef.current = setTimeout(() => {
      setIsHeld(true);
      hTapHeavy();
      onAmount('0');
    }, 500);
  };
  const onBackspaceOut = () => {
    if (holdRef.current) {
      clearTimeout(holdRef.current);
      holdRef.current = null;
    }
    if (!isHeld) {
      hTap();
      onAmount(amount.length > 1 ? amount.slice(0, -1) : '0');
    }
    setIsHeld(false);
  };

  // Outer card mirrors `bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-xl p-6`
  return (
    <View style={{
      borderRadius: 16,
      backgroundColor: CALC.CARD_FROM,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 16,
      elevation: 6,
    }}>
      <View style={{ borderRadius: 16, overflow: 'hidden' }}>
        <LinearGradient
          colors={[CALC.CARD_FROM, CALC.CARD_TO]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ padding: 18, gap: 14 }}
        >
          {/* Amount display — blue→purple gradient with thick blue border */}
          <View style={{
            borderRadius: 14,
            borderWidth: 4,
            borderColor: CALC.AMOUNT_BORDER,
            overflow: 'hidden',
          }}>
            <LinearGradient
              colors={[CALC.AMOUNT_FROM, CALC.AMOUNT_TO]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ paddingVertical: 22, paddingHorizontal: 20, alignItems: 'flex-end' }}
            >
              <Text style={{ color: CALC.AMOUNT_TEXT, fontSize: 48, fontWeight: '900' }}>
                {mode === 'subtract' ? '−' : ''}${amount}
              </Text>
            </LinearGradient>
          </View>

          {/* Revenue / Expense toggle */}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <GradBtn
              colors={mode === 'add' ? [CALC.REV_FROM, CALC.REV_TO] : [CALC.OFF_BG, CALC.OFF_BG]}
              onPress={() => { hTap(); onMode('add'); }}
              paddingVertical={16}
              shadow={mode === 'add'}
            >
              <Text style={{
                color: mode === 'add' ? '#ffffff' : CALC.OFF_FG,
                fontWeight: '800',
                fontSize: 17,
              }}>
                ➕ Revenue
              </Text>
            </GradBtn>
            <GradBtn
              colors={mode === 'subtract' ? [CALC.EXP_FROM, CALC.EXP_TO] : [CALC.OFF_BG, CALC.OFF_BG]}
              onPress={() => { hTap(); onMode('subtract'); }}
              paddingVertical={16}
              shadow={mode === 'subtract'}
            >
              <Text style={{
                color: mode === 'subtract' ? '#ffffff' : CALC.OFF_FG,
                fontWeight: '800',
                fontSize: 17,
              }}>
                ➖ Expense
              </Text>
            </GradBtn>
          </View>

          {/* Number grid */}
          {[
            ['7', '8', '9'],
            ['4', '5', '6'],
            ['1', '2', '3'],
            ['⌫', '0', '.'],
          ].map((row, ri) => (
            <View key={ri} style={{ flexDirection: 'row', gap: 10 }}>
              {row.map(k =>
                k === '⌫' ? (
                  <GradBtn
                    key={k}
                    colors={isHeld
                      ? [CALC.BACKSPACE_HELD_FROM, CALC.BACKSPACE_HELD_TO]
                      : [CALC.BACKSPACE_FROM, CALC.BACKSPACE_TO]}
                    onPressIn={onBackspaceIn}
                    onPressOut={onBackspaceOut}
                    paddingVertical={22}
                  >
                    <Text style={{ color: CALC.BACKSPACE_FG, fontSize: 26, fontWeight: '800' }}>
                      {isHeld ? '✓' : '⌫'}
                    </Text>
                  </GradBtn>
                ) : (
                  <GradBtn
                    key={k}
                    colors={[CALC.NUM_FROM, CALC.NUM_TO]}
                    onPress={() => tap(k)}
                    paddingVertical={22}
                  >
                    <Text style={{ color: CALC.NUM_TEXT, fontSize: 26, fontWeight: '800' }}>{k}</Text>
                  </GradBtn>
                )
              )}
            </View>
          ))}
        </LinearGradient>
      </View>
    </View>
  );
}

// ─── Details Form (mirrors web EntryForm 1:1) ──────────────────────────────────
function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text style={{ fontSize: 15, fontWeight: '700', color: '#1f2937', marginBottom: 8 }}>
      {children}
    </Text>
  );
}

function PillSelect<T extends string>({
  options,
  value,
  onChange,
  accent = CALC.HEADER_BG,
  scroll = false,
  dot = false,
}: {
  options: { key: T; label: string; color?: string }[];
  value: T;
  onChange: (v: T) => void;
  accent?: string;
  scroll?: boolean;
  // `dot` mode (used by the Platform selector): show a leading colored dot per
  // option so brands stay distinguishable even when unselected, and fill the
  // selected chip with the solid brand color + white text for an unmistakable
  // active state. Other selectors (Type / Category) keep the default styling.
  dot?: boolean;
}) {
  const Row = (
    <View style={{ flexDirection: 'row', flexWrap: scroll ? 'nowrap' : 'wrap', gap: 8 }}>
      {options.map(o => {
        const selected = value === o.key;
        const accentColor = o.color || accent;
        return (
          <Pressable
            key={o.key}
            onPress={() => { hTap(); onChange(o.key); }}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: dot ? 7 : 0,
              paddingHorizontal: 14,
              paddingVertical: 11,
              borderRadius: 12,
              // Active = bright accent w/ dark border + drop shadow that lifts it.
              // Inactive = solid muted gray chip w/ darker border so it reads as
              // a real disabled button, not invisible white-on-white.
              backgroundColor: selected ? accentColor : '#e5e7eb',
              borderWidth: 2,
              borderColor: selected ? '#0f172a' : '#9ca3af',
              opacity: pressed ? 0.85 : 1,
              transform: [{ scale: selected ? 1 : 0.98 }],
              ...(selected ? {
                shadowColor: '#000',
                shadowOpacity: 0.18,
                shadowRadius: 6,
                shadowOffset: { width: 0, height: 3 },
                elevation: 3,
              } : null),
            })}
          >
            {dot && (
              <View style={{
                width: 10, height: 10, borderRadius: 5,
                // On a selected (solid-brand) chip a white dot reads cleanly;
                // unselected chips show the true brand color as a swatch.
                backgroundColor: selected ? '#ffffff' : (o.color || '#6b7280'),
                ...(selected ? null : { borderWidth: 1, borderColor: '#00000022' }),
              }} />
            )}
            <Text style={{
              // dot-mode selected chips use a solid brand fill → white text;
              // default selected chips use the light yellow accent → dark text.
              color: selected ? (dot ? '#ffffff' : '#0f172a') : '#6b7280',
              fontWeight: selected ? '900' : '600',
              fontSize: 14,
            }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
  return scroll
    ? <ScrollView horizontal showsHorizontalScrollIndicator={false}>{Row}</ScrollView>
    : Row;
}

function FormInput({
  value, onChangeText, placeholder, keyboardType, multiline,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'decimal-pad' | 'number-pad' | 'default';
  multiline?: boolean;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor="#9ca3af"
      keyboardType={keyboardType || 'default'}
      multiline={multiline}
      style={{
        backgroundColor: '#ffffff',
        borderWidth: 2,
        borderColor: '#d1d5db',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        color: '#0f172a',
        fontSize: 16,
        fontWeight: '600',
        minHeight: multiline ? 70 : undefined,
        textAlignVertical: multiline ? 'top' : 'center',
      }}
    />
  );
}

function DetailsForm({
  isExp, amount, entryType, setEntryType, app, setApp, appAutoFilled, lastAppLabel, category, setCategory,
  isBusiness, setIsBusiness,
  miles, setMiles, minutes, setMinutes, note, setNote, onEditAmount,
  receiptUri, onPickReceipt, onRemoveReceipt,
  entryDate, showDatePicker, onToggleDatePicker, onChangeDate,
}: {
  isExp: boolean;
  amount: string;
  entryType: EntryType;
  setEntryType: (t: EntryType) => void;
  app: AppType;
  setApp: (a: AppType) => void;
  appAutoFilled: boolean;
  lastAppLabel: string;
  category: ExpenseCategory;
  setCategory: (c: ExpenseCategory) => void;
  isBusiness: boolean;
  setIsBusiness: (b: boolean) => void;
  miles: string;
  setMiles: (s: string) => void;
  minutes: string;
  setMinutes: (s: string) => void;
  note: string;
  setNote: (s: string) => void;
  onEditAmount: () => void;
  receiptUri: string | null;
  onPickReceipt: () => void;
  onRemoveReceipt: () => void;
  entryDate: Date;
  showDatePicker: boolean;
  onToggleDatePicker: () => void;
  onChangeDate: (d: Date) => void;
}) {
  return (
    <View style={{ gap: 14 }}>
      {/* Amount summary — tap to edit, mirrors blue→purple from CalcPad */}
      <Pressable
        onPress={onEditAmount}
        style={({ pressed }) => ({
          borderRadius: 16,
          overflow: 'hidden',
          opacity: pressed ? 0.9 : 1,
          shadowColor: '#000',
          shadowOpacity: 0.08,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 2 },
          elevation: 2,
        })}
      >
        <LinearGradient
          colors={isExp ? ['#fee2e2', '#fecaca'] : ['#dcfce7', '#bbf7d0']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={{
            paddingHorizontal: 18,
            paddingVertical: 18,
            borderWidth: 2,
            borderColor: isExp ? '#fca5a5' : '#86efac',
            borderRadius: 16,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Text style={{ color: '#475569', fontSize: 13, fontWeight: '700' }}>← Edit Amount</Text>
          <Text style={{
            color: isExp ? '#b91c1c' : '#15803d',
            fontSize: 32,
            fontWeight: '900',
          }}>
            {isExp ? '-' : '+'}${amount}
          </Text>
        </LinearGradient>
      </Pressable>

      {/* White → gray-50 gradient form card (mirrors web EntryForm) */}
      <View style={{
        borderRadius: 18,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 3,
        backgroundColor: '#ffffff',
      }}>
        <LinearGradient
          colors={['#ffffff', '#f9fafb']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{ padding: 18, gap: 16 }}
        >
          {/* Type */}
          <View>
            <FieldLabel>📝 Type</FieldLabel>
            <PillSelect
              options={[
                { key: 'ORDER',        label: 'Order' },
                { key: 'BONUS',        label: 'Bonus' },
                { key: 'EXPENSE',      label: 'Expense' },
                { key: 'CANCELLATION', label: 'Cancellation' },
              ]}
              value={entryType}
              onChange={setEntryType}
            />
          </View>

          {/* Platform / App (hidden for EXPENSE — mirrors web) */}
          {entryType !== 'EXPENSE' && (
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <FieldLabel>🚗 Platform</FieldLabel>
                {appAutoFilled ? (
                  <View style={{
                    flexDirection: 'row', alignItems: 'center', gap: 4,
                    backgroundColor: '#dcfce7', borderColor: '#86efac', borderWidth: 1,
                    borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3,
                    marginBottom: 6,
                  }}>
                    <Ionicons name="time-outline" size={11} color="#15803d" />
                    <Text style={{ color: '#15803d', fontSize: 11, fontWeight: '700' }}>
                      Last used: {lastAppLabel}
                    </Text>
                  </View>
                ) : (
                  <Text style={{ color: '#9ca3af', fontSize: 11, fontWeight: '600', marginBottom: 6 }}>
                    Which app was this on?
                  </Text>
                )}
              </View>
              <PillSelect
                scroll
                dot
                options={APPS.map(a => ({ key: a.key, label: a.label, color: a.color }))}
                value={app}
                onChange={setApp}
              />
            </View>
          )}

          {/* Category (only for EXPENSE) */}
          {entryType === 'EXPENSE' && (
            <View>
              <FieldLabel>🏷️ Category</FieldLabel>
              <PillSelect
                options={EXPENSE_CATS.map(c => ({
                  key: c,
                  label: `${EXPENSE_EMOJIS[c]} ${c}`,
                }))}
                value={category}
                onChange={setCategory}
              />
            </View>
          )}

          {/* Business expense toggle (only for EXPENSE) — flags the expense as
              tax-deductible. Stored as is_business_expense; surfaced with a
              distinct briefcase/blue indicator in lists + an Analytics summary. */}
          {entryType === 'EXPENSE' && (
            <View>
              <FieldLabel>💼 Business Expense</FieldLabel>
              <Pressable
                onPress={() => { hTap(); setIsBusiness(!isBusiness); }}
                style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                  borderWidth: 1.5,
                  borderColor: isBusiness ? '#2563eb' : '#e5e7eb',
                  backgroundColor: isBusiness ? '#eff6ff' : '#f9fafb',
                  borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, gap: 12,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                  <Text style={{ fontSize: 20 }}>{isBusiness ? '💼' : '🧾'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#111827', fontSize: 14, fontWeight: '700' }}>
                      Is this a business expense?
                    </Text>
                    <Text style={{ color: '#6b7280', fontSize: 11, marginTop: 1 }}>
                      Tax-deductible · tracked separately in Analytics
                    </Text>
                  </View>
                </View>
                <View style={{
                  width: 46, height: 28, borderRadius: 14, padding: 3,
                  backgroundColor: isBusiness ? '#2563eb' : '#cbd5e1',
                  alignItems: isBusiness ? 'flex-end' : 'flex-start', justifyContent: 'center',
                }}>
                  <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#ffffff' }} />
                </View>
              </Pressable>
            </View>
          )}

          {/* Receipt photo (only for EXPENSE) — uses CALC palette since this
              modal stays on the white "Add Entry" sheet regardless of theme. */}
          {entryType === 'EXPENSE' && (
            <View>
              <FieldLabel>🧾 Receipt (optional)</FieldLabel>
              {receiptUri ? (
                <View style={{
                  flexDirection: 'row', alignItems: 'center', gap: 12,
                  borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12,
                  padding: 10, backgroundColor: '#f9fafb',
                }}>
                  <Image
                    source={{ uri: receiptUri }}
                    style={{ width: 64, height: 64, borderRadius: 8, backgroundColor: '#e5e7eb' }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#111827', fontSize: 14, fontWeight: '700' }}>
                      Receipt attached
                    </Text>
                    <Text style={{ color: '#6b7280', fontSize: 12, marginTop: 2 }}>
                      Tap remove to clear
                    </Text>
                  </View>
                  <Pressable
                    onPress={onRemoveReceipt}
                    style={({ pressed }) => ({
                      backgroundColor: '#fee2e2',
                      borderWidth: 1, borderColor: '#fca5a5',
                      borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
                      opacity: pressed ? 0.85 : 1,
                    })}
                  >
                    <Text style={{ color: '#b91c1c', fontWeight: '700', fontSize: 12 }}>Remove</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  onPress={onPickReceipt}
                  style={({ pressed }) => ({
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                    gap: 8,
                    borderWidth: 1.5, borderColor: '#cbd5e1', borderStyle: 'dashed',
                    borderRadius: 12, paddingVertical: 14, backgroundColor: '#f9fafb',
                    opacity: pressed ? 0.85 : 1,
                    transform: [{ scale: pressed ? 0.98 : 1 }],
                  })}
                >
                  <Ionicons name="camera" size={18} color="#475569" />
                  <Text style={{ color: '#475569', fontSize: 14, fontWeight: '700' }}>
                    Attach Receipt Photo
                  </Text>
                </Pressable>
              )}
            </View>
          )}

          {/* Miles & Minutes — hidden for EXPENSE entries */}
          {entryType !== 'EXPENSE' && (
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <FieldLabel>🛣️ Miles</FieldLabel>
                <FormInput
                  value={miles}
                  onChangeText={setMiles}
                  placeholder="0.0"
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={{ flex: 1 }}>
                <FieldLabel>⏱️ Minutes</FieldLabel>
                <FormInput
                  value={minutes}
                  onChangeText={setMinutes}
                  placeholder="0"
                  keyboardType="number-pad"
                />
              </View>
            </View>
          )}

          {/* Date & Time — defaults to "now" on a fresh entry. Tap to pick a
              custom date/time. The picker renders inline on iOS (spinner) and
              as a system modal on Android. */}
          <View>
            <FieldLabel>📅 Date & Time</FieldLabel>
            <Pressable
              onPress={() => { hTap(); onToggleDatePicker(); }}
              style={({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                borderWidth: 1, borderColor: showDatePicker ? '#facc15' : '#e5e7eb',
                borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
                backgroundColor: '#f9fafb',
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text style={{ color: '#111827', fontSize: 14, fontWeight: '700' }}>
                {/* Show the US/Eastern wall-clock the entry will actually file
                    under (Today/Yesterday are EST), so the label matches the
                    saved day even for non-EST users. */}
                {entryDate.toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                {'  ·  '}
                {entryDate.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: true })}
              </Text>
              <Ionicons name={showDatePicker ? 'chevron-up' : 'chevron-down'} size={16} color="#6b7280" />
            </Pressable>
            {showDatePicker && (
              <View style={{ marginTop: 8, backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden' }}>
                <DateTimePicker
                  value={entryDate}
                  mode="datetime"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  // Force the iOS spinner to render with black wheel text on
                  // the white modal background. Without these the wheel text
                  // can come out white-on-white when the device is in dark
                  // mode (the modal itself is hard-coded light).
                  themeVariant="light"
                  textColor="#000000"
                  accentColor="#000000"
                  onChange={(_, selected) => {
                    if (Platform.OS === 'android') onToggleDatePicker();
                    if (selected) onChangeDate(selected);
                  }}
                  maximumDate={new Date(Date.now() + 24 * 60 * 60 * 1000)}
                />
              </View>
            )}
          </View>

          {/* Notes */}
          <View>
            <FieldLabel>📝 Notes (optional)</FieldLabel>
            <FormInput
              value={note}
              onChangeText={setNote}
              placeholder="Add any notes..."
              multiline
            />
          </View>
        </LinearGradient>
      </View>
    </View>
  );
}

// ─── Add Entry Modal ───────────────────────────────────────────────────────────
type AddEntryPrefill = { type?: 'REVENUE' | 'EXPENSE'; amount?: string };
function AddEntryModal({ visible, onClose, prefill, editing, defaultDate }: {
  visible: boolean;
  onClose: () => void;
  prefill?: AddEntryPrefill;
  editing?: Entry;
  // For NEW entries: the date the dashboard is currently viewing (e.g. the user
  // swiped to Yesterday). The modal seeds `entryDate` to this so a new entry is
  // filed under the day the user is looking at, not always "today". Undefined =>
  // use live now (today / aggregate periods).
  defaultDate?: Date;
}) {
  const { PRIMARY, ON_PRIMARY } = useTheme();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const [step, setStep]           = useState<'calc' | 'details'>('calc');
  const [amount, setAmount]       = useState('0');
  const [mode, setMode]           = useState<'add' | 'subtract'>('add');
  const [entryType, setEntryType] = useState<EntryType>('ORDER');
  const [app, setApp]             = useState<AppType>('DOORDASH');
  const [category, setCategory]  = useState<ExpenseCategory>('GAS');
  const [miles, setMiles]         = useState('');
  const [minutes, setMinutes]     = useState('');
  const [note, setNote]           = useState('');
  const [receiptUri, setReceiptUri]       = useState<string | null>(null);
  const [receiptDataUri, setReceiptDataUri] = useState<string | null>(null);
  // Tax-deductible flag for EXPENSE entries (the "business expense?" toggle).
  const [isBusiness, setIsBusiness] = useState(false);
  // Date/time the entry should be filed under. Defaults to "now" — backend
  // accepts `date`/`time` strings (interpreted in US/Eastern) and converts
  // to UTC. Editing flow seeds this from the entry's existing timestamp.
  const [entryDate, setEntryDate]   = useState<Date>(() => new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  // True while the platform was auto-filled from the last-used order platform
  // and the user hasn't manually overridden it. Drives the "Last used: …" hint.
  const [appAutoFilled, setAppAutoFilled] = useState(false);
  // The async last-used read can resolve after the user has already picked a
  // platform or switched the entry type. These refs let the late callback bail
  // out instead of clobbering a manual choice or an EXPENSE→Other nudge.
  const appTouchedRef = useRef(false);
  const entryTypeRef  = useRef<EntryType>(entryType);
  useEffect(() => { entryTypeRef.current = entryType; }, [entryType]);

  const reset = () => {
    setStep('calc'); setAmount('0'); setMode('add');
    setEntryType('ORDER'); setApp('DOORDASH'); setCategory('GAS');
    setMiles(''); setMinutes(''); setNote('');
    setReceiptUri(null); setReceiptDataUri(null);
    setIsBusiness(false);
    setEntryDate(new Date()); setShowDatePicker(false);
    setAppAutoFilled(false);
  };

  // User manually changed the platform → drop the auto-fill flag (and its hint)
  // and mark the picker "touched" so a late last-used read can't overwrite it.
  const handleAppChange = (a: AppType) => {
    appTouchedRef.current = true;
    setApp(a);
    setAppAutoFilled(false);
  };

  // Reseed the entry's date to the live "now" every time the modal opens for a
  // NEW entry. `entryDate` is otherwise only set at mount and inside reset()
  // (which runs at CLOSE time), so when the app stays mounted across the EST
  // midnight rollover (e.g. backgrounded overnight) the first order of the new
  // day would inherit yesterday's stale date and — via easternDateTime — get
  // filed under Yesterday. Editing seeds entryDate from the row, so skip then.
  useEffect(() => {
    if (!visible || editing) return;
    // Seed a NEW entry to the day the dashboard is viewing (Yesterday/N-days-back)
    // so it's filed under that day; falls back to live now for today/aggregates.
    setEntryDate(defaultDate ?? new Date());
  }, [visible, editing, defaultDate]);

  // Apply widget-driven prefill whenever the modal opens with a prefill set.
  // Skipped when we're in edit mode — `editing` takes precedence.
  useEffect(() => {
    if (!visible || !prefill || editing) return;
    if (prefill.type === 'EXPENSE') {
      setEntryType('EXPENSE'); setMode('subtract'); setApp('OTHER'); setCategory('OTHER');
    } else if (prefill.type === 'REVENUE') {
      setEntryType('ORDER'); setMode('add');
    }
    if (prefill.amount && /^\d+(\.\d+)?$/.test(prefill.amount)) {
      setAmount(prefill.amount);
    }
  }, [visible, prefill, editing]);

  // Default new ORDER entries to the platform the user last logged an order
  // against (persisted in AsyncStorage). Read fresh from storage on each open
  // so we always reflect the latest save. Skipped for edits and for EXPENSE
  // prefills (expenses keep defaulting to OTHER).
  useEffect(() => {
    if (!visible) return;
    // Fresh open → no manual interaction yet.
    appTouchedRef.current = false;
    if (editing || prefill?.type === 'EXPENSE') return;
    let cancelled = false;
    AsyncStorage.getItem(LAST_ORDER_APP_KEY).then((stored) => {
      // Bail if the modal closed, the user already picked a platform, or the
      // entry is no longer an ORDER (e.g. switched to EXPENSE) — never clobber
      // a manual choice or the EXPENSE→Other default with this late read.
      if (cancelled || !stored) return;
      if (appTouchedRef.current || entryTypeRef.current !== 'ORDER') return;
      // The key is written ONLY on a successful ORDER save, so any stored value
      // (including OTHER) reflects a real order platform and is safe to restore.
      if (VALID_APPS.has(stored)) {
        setApp(stored as AppType);
        setAppAutoFilled(true);
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [visible, prefill, editing]);

  // Editing an existing entry: prefill every field from the server row and
  // jump straight to the details step (skip the calculator pad). The amount
  // is stored signed in the DB; we strip the sign and set the `mode` to
  // recover the +/- intent.
  useEffect(() => {
    if (!visible || !editing) return;
    const amt = Math.abs(Number(editing.amount));
    setAmount(amt.toString());
    setMode(editing.amount < 0 ? 'subtract' : 'add');
    setEntryType(editing.type);
    setApp(editing.app);
    setCategory((editing.category as ExpenseCategory) || 'GAS');
    setMiles(editing.distance_miles ? String(editing.distance_miles) : '');
    setMinutes(editing.duration_minutes ? String(editing.duration_minutes) : '');
    setNote(editing.note || '');
    setReceiptUri(editing.receipt_url || null);
    setReceiptDataUri(editing.receipt_url || null);
    setIsBusiness(!!editing.is_business_expense);
    setEntryDate(parseServerDate(editing.timestamp));
    setStep('details');
  }, [visible, editing]);

  // One-way nudge: when the user switches to EXPENSE and the platform is still
  // the initial DoorDash default, flip to "Other" (gas station / parking etc.
  // don't belong to a delivery app). We deliberately do NOT auto-revert on the
  // way back to revenue — if the user picked OTHER on purpose we'd erase that
  // choice. `reset()` restores DOORDASH when the modal closes & re-opens.
  useEffect(() => {
    if (entryType === 'EXPENSE' && (app === 'DOORDASH' || appAutoFilled)) {
      setApp('OTHER');
      setAppAutoFilled(false);
    }
  }, [entryType]);

  // Image-picker helpers — request permissions, then offer Camera vs Library
  // via Alert (matches iOS conventions). We store the local `uri` for the
  // thumbnail and the `data:image/jpeg;base64,…` payload for the backend
  // (web client persists receipts the same way — no separate upload endpoint).
  // Backend caps receipt_url at 2 MB (MAX_RECEIPT_BYTES in backend/schemas.py).
  // Raw camera photos at quality:0.6 from a modern iPhone are still 3–7 MB
  // once base64-encoded, which hits the cap and the server returns 422.
  // We downscale to 1280px max edge and re-compress at 0.5 JPEG — that
  // keeps a typical receipt well under 500 KB while staying legible.
  const handleAssetResult = async (asset: ImagePicker.ImagePickerAsset | undefined) => {
    if (!asset) return;
    try {
      const manipulated = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: 1280 } }],
        { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG, base64: true },
      );
      setReceiptUri(manipulated.uri);
      if (manipulated.base64) {
        setReceiptDataUri(`data:image/jpeg;base64,${manipulated.base64}`);
      } else {
        setReceiptDataUri(null);
      }
    } catch (e) {
      // Fall back to the raw asset (may still hit the 2 MB cap, but better
      // than silently dropping the receipt).
      setReceiptUri(asset.uri);
      if (asset.base64) {
        const mime = asset.mimeType || 'image/jpeg';
        setReceiptDataUri(`data:${mime};base64,${asset.base64}`);
      } else {
        setReceiptDataUri(null);
      }
    }
  };
  const pickFromCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Camera access denied', 'Enable camera access in Settings to take receipt photos.');
      return;
    }
    // base64:false — we re-encode in handleAssetResult after downscaling.
    const res = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 1, base64: false, allowsEditing: false,
    });
    if (!res.canceled) await handleAssetResult(res.assets[0]);
  };
  const pickFromLibrary = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Photo access denied', 'Enable photo access in Settings to attach a receipt.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1, base64: false, allowsEditing: false,
    });
    if (!res.canceled) await handleAssetResult(res.assets[0]);
  };
  const onPickReceipt = () => {
    Alert.alert(
      'Attach Receipt',
      'Choose a source',
      [
        { text: 'Take Photo',   onPress: pickFromCamera },
        { text: 'Choose from Library', onPress: pickFromLibrary },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  };
  const onRemoveReceipt = () => {
    setReceiptUri(null); setReceiptDataUri(null);
  };

  const mutation = useMutation({
    mutationFn: api.createEntry,
    // Optimistic update: patch every cached `['rollup', ...]` query the
    // instant the user taps Save so the dashboard KPI numbers tick up
    // before the network round-trip resolves. Only patch when the entry's
    // date is today (or unspecified — defaults to today) — backdated
    // entries land in windows we can't cheaply check from here, so we let
    // the server-side invalidation handle them.
    onMutate: async (vars) => {
      const now = new Date();
      const p2 = (n: number) => String(n).padStart(2, '0');
      const todayStr = `${now.getFullYear()}-${p2(now.getMonth() + 1)}-${p2(now.getDate())}`;
      const isToday = !vars.date || vars.date === todayStr;

      // ---- Entries list: optimistic prepend into EVERY cached ['entries'] list.
      // Works for any date — the server invalidation will refetch each window
      // and drop the row from any list whose timeframe doesn't actually contain
      // the entry's timestamp. Brief (<200ms) cross-window flash is acceptable
      // and far better than the previous "wait for the server" experience.
      await queryClient.cancelQueries({ queryKey: ['entries'] });
      const prevEntries = queryClient.getQueriesData<Entry[]>({ queryKey: ['entries'] });
      // The synthetic row MUST carry the same instant convention the server
      // stores (UTC). The History list sorts via parseServerDate(), which
      // treats a tz-less timestamp as UTC; building the synthetic ts from the
      // EST wall-clock strings (`${date}T${time}:00`, no 'Z') made a brand-new
      // "now" entry get parsed ~4-5h in the PAST, so it sorted BELOW recent
      // rows and didn't appear at the top until an app restart refetched the
      // real UTC row. `entryDate` is the actual instant the user picked (the
      // EST date/time sent to the API are just its projection), so its ISO
      // string ('Z'-suffixed UTC) sorts correctly and matches the server row.
      const syntheticTs = entryDate.toISOString();
      const syntheticEntry: Entry = {
        id: -Date.now(), // unique negative id so it can't collide with real rows
        timestamp: syntheticTs,
        type: vars.type,
        app: vars.app,
        amount: vars.type === 'EXPENSE' ? -Math.abs(vars.amount || 0) : Math.abs(vars.amount || 0),
        distance_miles: vars.distance_miles || 0,
        duration_minutes: vars.duration_minutes || 0,
        category: vars.category,
        note: vars.note,
        receipt_url: vars.receipt_url,
        is_business_expense: vars.is_business_expense,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      };
      queryClient.setQueriesData<Entry[]>({ queryKey: ['entries'] }, (old) => {
        if (!old) return old;
        // Insert preserving timestamp-desc ordering used by the server. Sort via
        // parseServerDate (the SAME comparator the History list uses) so the
        // synthetic 'Z'-suffixed ISO ts and the server's tz-less UTC strings are
        // compared as real instants rather than raw strings.
        const next = [syntheticEntry, ...old];
        next.sort((a, b) => parseServerDate(b.timestamp).getTime() - parseServerDate(a.timestamp).getTime());
        return next;
      });

      // ---- Rollup KPIs: only patch when the entry is for today, because the
      // window-specific math (TODAY vs THIS_WEEK vs custom range) is hard to
      // recompute correctly here for backdated entries. The server invalidation
      // in onSuccess reconciles ~200ms later for those cases.
      let prevRollup: Array<[readonly unknown[], Rollup | undefined]> = [];
      if (isToday) {
        await queryClient.cancelQueries({ queryKey: ['rollup'] });
        prevRollup = queryClient.getQueriesData<Rollup>({ queryKey: ['rollup'] });
        const isExpense = vars.type === 'EXPENSE';
        const amt = Math.abs(vars.amount || 0);
        const addMiles = vars.distance_miles || 0;
        const addHours = (vars.duration_minutes || 0) / 60;
        queryClient.setQueriesData<Rollup>({ queryKey: ['rollup'] }, (old) => {
          if (!old) return old;
          const revenue  = isExpense ? old.revenue  : old.revenue  + amt;
          const expenses = isExpense ? old.expenses + amt : old.expenses;
          const profit   = revenue - expenses;
          const miles    = old.miles + addMiles;
          const hours    = old.hours + addHours;
          return {
            ...old,
            revenue,
            expenses,
            profit,
            miles,
            hours,
            dollars_per_mile: miles > 0 ? profit / miles : 0,
            goal_progress: old.goal?.target_profit
              ? profit / old.goal.target_profit
              : old.goal_progress ?? null,
          };
        });
      }
      // Close the modal immediately so the user sees the already-patched
      // dashboard right away, instead of waiting for the network round-trip
      // to the backend (which can be slow / cold-start). Use a neutral tap
      // haptic here — the *success* notification haptic is reserved for
      // onSuccess so we don't signal success on an entry that later 4xx-fails
      // and gets rolled back in onError.
      hTap();
      reset();
      onClose();
      return { prev: prevRollup, prevEntries, syntheticId: syntheticEntry.id };
    },
    onSuccess: (_data, vars, ctx) => {
      // `createEntry` returns a synthetic, NEGATIVE-id Entry when the POST
      // failed (flaky network while driving) and the entry was only QUEUED
      // offline — the server does NOT have the row yet. Invalidating in that
      // case refetches stale server data and WIPES the optimistic dashboard
      // patch, so the KPI ticks up for a moment and then snaps back to the old
      // number (it only "sticks" after the queue drains on next foreground —
      // i.e. after the user reopens the app). So only reconcile with the
      // server when the entry was actually persisted (positive id); otherwise
      // keep the optimistic state and let the foreground drain in _layout.tsx
      // invalidate once the row really lands.
      const persisted = typeof _data?.id === 'number' && _data.id > 0;
      if (persisted) {
        // Swap the optimistic synthetic-id row for the real server row IN PLACE
        // so the list immediately carries the real (positive) id. Without this
        // the row keeps its negative synthetic id until the async refetch lands,
        // and a delete/edit fired in that window targets an id the server never
        // had → 404 ("Failed to delete" on the first attempt, works on retry).
        if (ctx?.syntheticId !== undefined) {
          queryClient.setQueriesData<Entry[]>({ queryKey: ['entries'] }, (old) =>
            Array.isArray(old) ? old.map(e => (e.id === ctx.syntheticId ? _data : e)) : old,
          );
        }
        queryClient.invalidateQueries({ queryKey: ['entries'] });
        queryClient.invalidateQueries({ queryKey: ['rollup'] });
        queryClient.invalidateQueries({ queryKey: ['goal'] });
        // The Analytics modal reads its own cache keys (['analytics-rollup'] /
        // ['analytics-entries']); the prefixes above don't match them, so with
        // the global 30s staleTime reopening Analytics shortly after an add
        // would show stale data missing the new entry. Invalidate them too.
        queryClient.invalidateQueries({ queryKey: ['analytics-rollup'] });
        queryClient.invalidateQueries({ queryKey: ['analytics-entries'] });
      }
      hNotifyOk();
      // Satisfying cash-register "ka-ching" on a successful save. This is the
      // single save path for BOTH manual adds and iOS widget quick-adds (the
      // widget deep-links into this same modal/mutation), so it covers both.
      // No-ops when the Settings sound toggle is off or in an OTA-only build
      // that predates the expo-av native module.
      playKaching();
      // Remember the last app the user logged revenue against — the iOS
      // widget's quick-add buttons use this as the platform, and the Add Entry
      // modal defaults new orders to it (read back via LAST_ORDER_APP_KEY).
      if (vars.type === 'ORDER' && vars.app) {
        widgetSync.pushLastApp(vars.app);
        AsyncStorage.setItem(LAST_ORDER_APP_KEY, vars.app).catch(() => {});
      }
    },
    onError: (_err, _vars, ctx) => {
      // Roll back both optimistic patches using the snapshots we took in
      // onMutate, then invalidate to be doubly sure we converge on truth.
      if (ctx?.prev) {
        for (const [key, data] of ctx.prev) {
          queryClient.setQueryData(key, data);
        }
      }
      if (ctx?.prevEntries) {
        for (const [key, data] of ctx.prevEntries) {
          queryClient.setQueryData(key, data);
        }
      }
      queryClient.invalidateQueries({ queryKey: ['rollup'] });
      queryClient.invalidateQueries({ queryKey: ['entries'] });
      Alert.alert('Error', 'Failed to save entry.');
    },
  });

  // PUT mutation used only in the "edit existing entry" flow.
  // Optimistic update so an EDIT reflects on the dashboard INSTANTLY (KPI
  // cards, Profit Hero, Goal bar) instead of waiting for the network round-
  // trip — mirroring the create/delete optimistic flows. We apply the NET
  // delta (new − old) of the edited row to every cached `['rollup']` query and
  // swap the row in every cached `['entries']` list; the onSuccess invalidation
  // reconciles ~200ms later (and corrects any window that didn't actually
  // contain the row). Snapshots are kept for an exact rollback on error.
  const updateMutation = useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: Partial<EntryCreate> }) => api.updateEntry(id, patch),
    onMutate: async ({ id, patch }) => {
      await queryClient.cancelQueries({ queryKey: ['rollup'] });
      await queryClient.cancelQueries({ queryKey: ['entries'] });
      const prevRollup  = queryClient.getQueriesData<Rollup>({ queryKey: ['rollup'] });
      const prevEntries = queryClient.getQueriesData<Entry[]>({ queryKey: ['entries'] });

      // Locate the pre-edit row (prefer the cache; fall back to the `editing`
      // prop that populated the form) so we can compute an exact delta.
      const cachedOld = prevEntries
        .flatMap(([, list]) => list ?? [])
        .find(e => e.id === id);
      const oldEntry = cachedOld ?? editing;
      if (!oldEntry) { hTap(); reset(); onClose(); return { prevRollup, prevEntries }; }

      // Amount is SIGNED (expenses/cancellations negative). Re-derive the new
      // sign from the (possibly changed) TYPE exactly like the backend does
      // (PUT /entries normalizes: EXPENSE/CANCELLATION → negative, else
      // positive, using abs of the magnitude) so a type-flip edit
      // (ORDER↔EXPENSE) patches the dashboard in the correct direction.
      const pos = (n: number) => (n >= 0 ? n : 0);
      const oldSigned = Number(oldEntry.amount) || 0;
      const effType = patch.type ?? oldEntry.type;
      const rawMag = Math.abs(patch.amount != null ? Number(patch.amount) : oldSigned);
      const newSigned = (effType === 'EXPENSE' || effType === 'CANCELLATION') ? -rawMag : rawMag;
      const oldMiles  = Number(oldEntry.distance_miles) || 0;
      const newMiles  = patch.distance_miles != null ? Number(patch.distance_miles) : oldMiles;
      const oldMin    = Number(oldEntry.duration_minutes) || 0;
      const newMin    = patch.duration_minutes != null ? Number(patch.duration_minutes) : oldMin;

      const dRevenue  = pos(newSigned) - pos(oldSigned);
      const dExpenses = pos(-newSigned) - pos(-oldSigned);
      const dMiles    = newMiles - oldMiles;
      const dHours    = (newMin - oldMin) / 60;

      queryClient.setQueriesData<Rollup>({ queryKey: ['rollup'] }, (old) => {
        if (!old) return old;
        const revenue  = old.revenue  + dRevenue;
        const expenses = old.expenses + dExpenses;
        const profit   = revenue - expenses;
        const miles    = old.miles + dMiles;
        const hours    = old.hours + dHours;
        return {
          ...old,
          revenue,
          expenses,
          profit,
          miles,
          hours,
          dollars_per_mile: miles > 0 ? profit / miles : 0,
          goal_progress: old.goal?.target_profit
            ? profit / old.goal.target_profit
            : old.goal_progress ?? null,
        };
      });

      // Recompute the row's timestamp if its date/time changed, then swap the
      // row in every cached entries list (re-sorting to keep timestamp-desc).
      // When the user changed the date/time, reuse the SAME instant convention
      // as the create path — `entryDate.toISOString()` (UTC, 'Z'-suffixed) —
      // which is exactly what the server stores (it localizes the EST date/time
      // to UTC). The previous code built a tz-LESS Eastern string here, which
      // parseServerDate then read as UTC (~4-5h off), so an edited row landed in
      // the wrong position until an app restart refetched the real UTC row.
      const now = new Date();
      const newTs = (patch.date || patch.time) ? entryDate.toISOString() : oldEntry.timestamp;
      queryClient.setQueriesData<Entry[]>({ queryKey: ['entries'] }, (old) => {
        if (!Array.isArray(old)) return old;
        const next = old.map(e => e.id === id ? {
          ...e,
          type: patch.type ?? e.type,
          app: patch.app ?? e.app,
          amount: newSigned,
          distance_miles: newMiles,
          duration_minutes: newMin,
          category: patch.category ?? e.category,
          note: patch.note ?? e.note,
          receipt_url: patch.receipt_url ?? e.receipt_url,
          is_business_expense: patch.is_business_expense ?? e.is_business_expense,
          timestamp: newTs,
          updated_at: now.toISOString(),
        } : e);
        // Sort via parseServerDate (the SAME comparator the create flow and the
        // History list use) so mixed timestamp formats — server tz-less UTC,
        // synthetic/edit 'Z'-suffixed ISO — are compared as real instants, not
        // raw strings. Newest first.
        next.sort((a, b) => parseServerDate(b.timestamp).getTime() - parseServerDate(a.timestamp).getTime());
        return next;
      });

      // Close the modal right away so the user lands on the already-patched
      // dashboard, identical to the create flow. Neutral tap haptic here; the
      // success haptic fires in onSuccess once the server confirms.
      hTap();
      reset();
      onClose();
      return { prevRollup, prevEntries };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries'] });
      queryClient.invalidateQueries({ queryKey: ['rollup'] });
      queryClient.invalidateQueries({ queryKey: ['goal'] });
      queryClient.invalidateQueries({ queryKey: ['analytics-rollup'] });
      queryClient.invalidateQueries({ queryKey: ['analytics-entries'] });
      hNotifyOk();
    },
    onError: (e, _vars, ctx) => {
      if (ctx?.prevRollup)  for (const [key, data] of ctx.prevRollup)  queryClient.setQueryData(key, data);
      if (ctx?.prevEntries) for (const [key, data] of ctx.prevEntries) queryClient.setQueryData(key, data);
      queryClient.invalidateQueries({ queryKey: ['rollup'] });
      queryClient.invalidateQueries({ queryKey: ['entries'] });
      Alert.alert('Error', (e as Error)?.message || 'Failed to update entry.');
    },
  });

  // Format the entry instant → ('YYYY-MM-DD', 'HH:MM') in US/Eastern wall-clock.
  // The backend interprets these strings as EST and the Today/Yesterday views are
  // EST-based, so we MUST emit Eastern (NOT device-local) components — otherwise a
  // non-EST user's first order after the EST midnight rollover (e.g. 9pm Pacific)
  // gets mislabeled and lands in Yesterday. Reuses the CSV exporter's helper.
  const { date: dateStr, time: timeStr } = easternDateTime(entryDate);

  const handleSave = () => {
    const num = parseFloat(amount);
    if (!num || num <= 0) { Alert.alert('Invalid amount', 'Enter an amount > 0'); return; }
    const payload: Partial<EntryCreate> = {
      type: entryType,
      app,
      amount: mode === 'subtract' ? -num : num,
      distance_miles: miles ? parseFloat(miles) : undefined,
      duration_minutes: minutes ? parseInt(minutes) : undefined,
      category: entryType === 'EXPENSE' ? category : undefined,
      note: note || undefined,
      receipt_url: entryType === 'EXPENSE' && receiptDataUri ? receiptDataUri : undefined,
      is_business_expense: entryType === 'EXPENSE' ? isBusiness : false,
      date: dateStr,
      time: timeStr,
    };
    if (editing) {
      // Guard: rows with a non-positive id are optimistic (not-yet-saved create)
      // or offline-queued entries that don't exist on the server yet. PUTting
      // them returns 404 "Entry not found". Tell the user to wait instead of
      // surfacing a scary error. (The edit entry points also block opening, so
      // this is a defensive backstop.)
      if (editing.id <= 0) {
        Alert.alert('Still saving', 'This entry hasn’t finished saving yet. Give it a moment, then try editing again.');
        return;
      }
      updateMutation.mutate({ id: editing.id, patch: payload });
    } else {
      mutation.mutate(payload as EntryCreate);
    }
  };
  const isSaving = mutation.isPending || updateMutation.isPending;

  const isExp = mode === 'subtract';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => { reset(); onClose(); }}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: CALC.CARD_BG }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Yellow header bar — static View ensures iOS paints the bg reliably.
            paddingTop pushes content below the iPhone status bar / notch. */}
        {/* Yellow header — paddings halved (still mirrored top/bottom so text
            stays centered). Top has full insets.top for status bar; bottom
            mirrors with insets.top/2 + Pressable paddingTop=9 to compensate. */}
        <View style={{
          backgroundColor: CALC.HEADER_BG,
          paddingTop: insets.top / 2,
          paddingBottom: insets.top / 4,
          paddingLeft: 28,
          paddingRight: 28,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <Pressable
            onPress={() => {
              hTapMed();
              if (step === 'details') { setStep('calc'); }
              else { reset(); onClose(); }
            }}
            android_ripple={{ color: 'rgba(0,0,0,0.08)' }}
            style={({ pressed }) => ({
              alignSelf: 'flex-start',
              paddingVertical: 4,
              paddingRight: 12,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', height: 24 }}>
              <Ionicons
                name={step === 'calc' ? 'arrow-down' : 'arrow-back'}
                size={20}
                color="#0f172a"
                style={{ marginRight: 0 }}
              />
              <Text
                style={{
                  color: '#0f172a',
                  fontSize: 18,
                  fontWeight: '800',
                  lineHeight: 22,
                  includeFontPadding: false,
                }}
              >
                {step === 'calc' ? 'Hide' : 'Back'}
              </Text>
            </View>
          </Pressable>
        </View>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          {step === 'calc' ? (
            <CalcPad
              amount={amount}
              mode={mode}
              onAmount={setAmount}
              onMode={setMode}
            />
          ) : (
            <DetailsForm
              isExp={isExp}
              amount={amount}
              entryType={entryType}
              setEntryType={setEntryType}
              app={app}
              setApp={handleAppChange}
              appAutoFilled={appAutoFilled && entryType !== 'EXPENSE'}
              lastAppLabel={APPS.find(a => a.key === app)?.label ?? app}
              category={category}
              setCategory={setCategory}
              isBusiness={isBusiness}
              setIsBusiness={setIsBusiness}
              miles={miles}
              setMiles={setMiles}
              minutes={minutes}
              setMinutes={setMinutes}
              note={note}
              setNote={setNote}
              onEditAmount={() => setStep('calc')}
              receiptUri={receiptUri}
              onPickReceipt={onPickReceipt}
              onRemoveReceipt={onRemoveReceipt}
              entryDate={entryDate}
              showDatePicker={showDatePicker}
              onToggleDatePicker={() => setShowDatePicker(s => !s)}
              onChangeDate={setEntryDate}
            />
          )}
        </ScrollView>

        {/* ── Bottom-pinned action button ─────────────────────────────────────
            Lives outside both forms so it's flush against the bottom edge of
            the modal (same treatment as the dashboard's "+ Add Entry" sticky
            bar). Behavior swaps based on which step you're on.

            Padding is split: the wrapper View gets a SYMMETRIC top/bottom pad
            that mirrors the safe-area inset, so the inner Pressable sits
            equidistant from the top and bottom of the visible yellow zone.
            This keeps the text optically centered (the home-indicator inset
            no longer pushes the text upward visually). */}
        {(() => {
          const safePad = insets.bottom > 0 ? insets.bottom : 12;
          return (
            <View
              style={{
                backgroundColor: PRIMARY,
                paddingTop: safePad,
                paddingBottom: safePad,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: -4 },
                shadowOpacity: 0.12,
                shadowRadius: 8,
                elevation: 12,
              }}
            >
              <Pressable
                onPress={() => {
                  hTapMed();
                  if (step === 'calc') {
                    // Carry the calculator's Revenue/Expense choice into details
                    setEntryType(mode === 'subtract' ? 'EXPENSE' : 'ORDER');
                    setStep('details');
                  } else {
                    handleSave();
                  }
                }}
                disabled={isSaving}
                android_ripple={{ color: 'rgba(0,0,0,0.15)' }}
                style={({ pressed }) => ({
                  width: '100%',
                  paddingVertical: 16,
                  paddingHorizontal: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: pressed ? 0.85 : 1,
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                })}
              >
                {step === 'details' && isSaving
                  ? <ActivityIndicator color={ON_PRIMARY} />
                  : (
                    <Text
                      style={{
                        color: ON_PRIMARY,
                        fontWeight: '900',
                        fontSize: 22,
                        letterSpacing: 0.3,
                        textAlign: 'center',
                        textAlignVertical: 'center',
                        includeFontPadding: false,
                      }}
                    >
                      {step === 'calc' ? 'Next Step  →' : '💾  Save Entry'}
                    </Text>
                  )
                }
              </Pressable>
            </View>
          );
        })()}
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Settings Modal ────────────────────────────────────────────────────────────
// ─── CSV import (Settings) ────────────────────────────────────────────────────
// Tiny CSV parser — handles double-quoted fields, escaped quotes (""), CRLF.
// Returns array of row arrays; first row is treated as header by the caller.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(field); field = '';
        if (row.length > 1 || row[0] !== '') rows.push(row);
        row = [];
      } else field += c;
    }
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

const VALID_TYPES = new Set(['ORDER', 'BONUS', 'EXPENSE', 'CANCELLATION']);
const VALID_APPS  = new Set(['DOORDASH', 'UBEREATS', 'INSTACART', 'GRUBHUB', 'SHIPT', 'OTHER']);
const VALID_CATS  = new Set(['GAS', 'PARKING', 'TOLLS', 'MAINTENANCE', 'PHONE', 'SUBSCRIPTION', 'FOOD', 'LEISURE', 'CHARITY', 'OTHER']);

function csvRowsToEntries(rows: string[][]): { entries: EntryCreate[]; skipped: number } {
  if (rows.length < 2) return { entries: [], skipped: 0 };
  const header = rows[0].map(h => h.trim().toLowerCase().replace(/[\s-]+/g, '_'));
  const idx = (name: string) => header.indexOf(name);
  const iType = idx('type'), iApp = idx('app');
  const iAmt = idx('amount');
  // Without these three columns we can't build a single valid EntryCreate.
  // Bail out with a thrown Error so the caller can show a useful alert
  // instead of silently reporting "0 imported, N skipped".
  const missing: string[] = [];
  if (iType < 0) missing.push('type');
  if (iApp < 0) missing.push('app');
  if (iAmt < 0) missing.push('amount');
  if (missing.length) {
    throw new Error(`CSV is missing required column${missing.length === 1 ? '' : 's'}: ${missing.join(', ')}.`);
  }
  const iDate = idx('date'), iTime = idx('time');
  const iMiles = idx('distance_miles') >= 0 ? idx('distance_miles') : idx('miles');
  const iMin   = idx('duration_minutes') >= 0 ? idx('duration_minutes') : idx('minutes');
  const iCat   = idx('category');
  const iNote  = idx('note') >= 0 ? idx('note') : idx('notes');
  const out: EntryCreate[] = [];
  let skipped = 0;
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (row.every(c => c.trim() === '')) continue;
    const type = (row[iType] || '').trim().toUpperCase();
    const app  = (row[iApp]  || '').trim().toUpperCase();
    const amtStr = (row[iAmt] || '').trim().replace(/[$,]/g, '');
    const amount = parseFloat(amtStr);
    if (!VALID_TYPES.has(type) || !VALID_APPS.has(app) || !isFinite(amount)) { skipped++; continue; }
    const cat = iCat >= 0 ? (row[iCat] || '').trim().toUpperCase() : '';
    const entry: EntryCreate = {
      type: type as EntryType,
      app: app as AppType,
      amount,
      distance_miles: iMiles >= 0 ? parseFloat(row[iMiles] || '0') || 0 : undefined,
      duration_minutes: iMin >= 0 ? parseInt(row[iMin] || '0') || 0 : undefined,
      category: type === 'EXPENSE' && VALID_CATS.has(cat) ? (cat as ExpenseCategory) : undefined,
      note: iNote >= 0 ? (row[iNote] || '').trim() || undefined : undefined,
      date: iDate >= 0 ? (row[iDate] || '').trim() || undefined : undefined,
      time: iTime >= 0 ? (row[iTime] || '').trim() || undefined : undefined,
    };
    out.push(entry);
  }
  return { entries: out, skipped };
}

function ImportCsvRow({ onDone }: { onDone: () => void }) {
  const { SURFACE, BORDER, PRI_LITE, PRIMARY, PRIMARY_TXT, TEXT, MUTED } = useTheme();
  const [busy, setBusy] = useState(false);

  const onPick = async () => {
    if (busy) return;
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'public.comma-separated-values-text', '*/*'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (res.canceled || !res.assets?.[0]) return;
      setBusy(true);
      hTap();
      const asset = res.assets[0];
      // RN fetch can read file:// URIs into text on iOS.
      const text = await (await fetch(asset.uri)).text();
      const rows = parseCsv(text);
      const { entries, skipped } = csvRowsToEntries(rows);
      if (entries.length === 0) {
        Alert.alert('Nothing to import', skipped > 0
          ? `Found ${skipped} row${skipped === 1 ? '' : 's'} but none had valid type / app / amount columns.`
          : 'The file looks empty.');
        return;
      }
      const result = await api.importEntries(entries);
      hNotifyOk();
      Alert.alert(
        'Import complete',
        `Imported ${result.count} entr${result.count === 1 ? 'y' : 'ies'}${skipped > 0 ? `\nSkipped ${skipped} invalid row${skipped === 1 ? '' : 's'}` : ''}.`,
      );
      onDone();
    } catch (e: any) {
      Alert.alert('Import failed', e?.message || 'Could not read or import the file.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Pressable
      onPress={onPick}
      disabled={busy}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 12,
        backgroundColor: SURFACE, borderRadius: 14, borderWidth: 1, borderColor: BORDER,
        padding: 14, opacity: busy ? 0.6 : 1,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3,
      }}
    >
      <View style={{
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: PRI_LITE, alignItems: 'center', justifyContent: 'center',
      }}>
        <Ionicons name={busy ? 'hourglass' : 'cloud-upload'} size={18} color={PRIMARY_TXT} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: TEXT, fontSize: 15, fontWeight: '700' }}>
          {busy ? 'Importing…' : 'Import from CSV'}
        </Text>
        <Text style={{ color: MUTED, fontSize: 12, marginTop: 2 }}>
          Columns: date, time, type, app, amount, distance_miles, duration_minutes, category, note
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={MUTED} />
    </Pressable>
  );
}

function ExportCsvRow() {
  const { SURFACE, BORDER, PRI_LITE, PRIMARY, PRIMARY_TXT, TEXT, MUTED } = useTheme();
  const [busy, setBusy] = useState(false);

  const onExport = async () => {
    if (busy) return;
    try {
      setBusy(true);
      hTap();
      // Pull the entire history with a deliberately wide date window so the
      // export is not limited to the currently-selected dashboard period.
      const from = new Date('2000-01-01T00:00:00Z').toISOString();
      const to = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const all = await api.getEntriesInRange(from, to, 100000);
      const result = await exportEntriesCsv(all, 'earnings-ninja-all');
      if (result === 'empty') {
        Alert.alert('Nothing to export', 'You have no entries yet.');
      } else if (result === 'unavailable') {
        Alert.alert('Sharing unavailable', 'Could not open the share sheet on this device.');
      } else {
        hNotifyOk();
      }
    } catch (e: any) {
      Alert.alert('Export failed', e?.message || 'Could not export your entries.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Pressable
      onPress={onExport}
      disabled={busy}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 12,
        backgroundColor: SURFACE, borderRadius: 14, borderWidth: 1, borderColor: BORDER,
        padding: 14, opacity: busy ? 0.6 : 1,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3,
      }}
    >
      <View style={{
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: PRI_LITE, alignItems: 'center', justifyContent: 'center',
      }}>
        <Ionicons name={busy ? 'hourglass' : 'cloud-download'} size={18} color={PRIMARY_TXT} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: TEXT, fontSize: 15, fontWeight: '700' }}>
          {busy ? 'Exporting…' : 'Export to CSV'}
        </Text>
        <Text style={{ color: MUTED, fontSize: 12, marginTop: 2 }}>
          Save all of your entries as a spreadsheet file
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={MUTED} />
    </Pressable>
  );
}

function SettingsModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { BG, SURFACE, BORDER, PRIMARY, PRIMARY_TXT, PRI_LITE, TEXT, MUTED, LABEL, RED, RED_LT, ON_PRIMARY } = useTheme();
  const { themeName, setThemeName } = useThemeControls();
  const { hidden, toggle: toggleHidden } = useHiddenMode();
  const { logout, user } = useAuth();
  const queryClient = useQueryClient();
  const [editingGoal, setEditingGoal] = useState<TimeframeType | null>(null);
  const [goalInput, setGoalInput] = useState('');

  // Daily motivation notifications toggle. Hydrated from the persisted flag on
  // open so it reflects the real OS/AsyncStorage state.
  const [notifOn, setNotifOn] = useState(false);
  const [notifBusy, setNotifBusy] = useState(false);
  // Ka-Ching sound effect toggle (defaults ON; persisted in AsyncStorage).
  const [soundOn, setSoundOn] = useState(true);
  // Re-check on every open (not just first mount): reconciles the persisted flag
  // against live OS permission, so the toggle self-heals if the user revoked
  // notifications in the iOS Settings app while ours was left on.
  useEffect(() => {
    if (!visible) return;
    let alive = true;
    syncNotifState().then((v) => { if (alive) setNotifOn(v); });
    getSoundEnabled().then((v) => { if (alive) setSoundOn(v); });
    return () => { alive = false; };
  }, [visible]);

  // Toggle the ka-ching sound effect. Play a sample when turning it ON so the
  // user immediately hears what they enabled.
  const onToggleSound = () => {
    hTap();
    setSoundOn((prev) => {
      const next = !prev;
      setSoundEnabled(next);
      if (next) playKaching();
      return next;
    });
  };

  const onToggleNotif = async () => {
    if (notifBusy) return;
    hTap();
    setNotifBusy(true);
    try {
      if (notifOn) {
        await disableMotivation();
        setNotifOn(false);
      } else {
        const ok = await enableMotivation(hidden);
        if (ok) {
          setNotifOn(true);
        } else {
          Alert.alert(
            'Notifications are off',
            'Turn on notifications for Earnings Ninja in iOS Settings to get your daily motivation and evening recap.',
          );
        }
      }
    } finally {
      setNotifBusy(false);
    }
  };

  const goalToday = useQuery({ queryKey: ['goal', 'TODAY'],      queryFn: () => api.getGoal('TODAY') });
  const goalWeek  = useQuery({ queryKey: ['goal', 'THIS_WEEK'],  queryFn: () => api.getGoal('THIS_WEEK') });
  const goalMonth = useQuery({ queryKey: ['goal', 'THIS_MONTH'], queryFn: () => api.getGoal('THIS_MONTH') });
  const goalQueries = [goalToday, goalWeek, goalMonth];

  const upsertGoal = useMutation({
    mutationFn: ({ tf, target }: { tf: TimeframeType; target: number }) => api.upsertGoal(tf, target),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goal'] });
      setEditingGoal(null);
      hNotifyOk();
    },
  });

  const goalRows: { tf: TimeframeType; label: string; emoji: string }[] = [
    { tf: 'TODAY',      label: 'Daily Goal',   emoji: '☀️' },
    { tf: 'THIS_WEEK',  label: 'Weekly Goal',  emoji: '📅' },
    { tf: 'THIS_MONTH', label: 'Monthly Goal', emoji: '🗓️' },
  ];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <ScrollView style={{ flex: 1, backgroundColor: BG }} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <Text style={{ color: TEXT, fontSize: 20, fontWeight: '800' }}>⚙️ Settings</Text>
          <Pressable onPress={onClose} style={{ padding: 6 }}>
            <Ionicons name="close-circle" size={28} color={MUTED} />
          </Pressable>
        </View>

        {/* Account */}
        <View style={{
          backgroundColor: SURFACE, borderRadius: 16, borderWidth: 1, borderColor: BORDER,
          padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24,
          shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4,
        }}>
          <View style={{
            width: 48, height: 48, borderRadius: 24,
            backgroundColor: PRI_LITE, borderWidth: 2, borderColor: PRIMARY,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Text style={{ fontSize: 22 }}>🥷</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: TEXT, fontSize: 16, fontWeight: '700' }}>{user?.username || 'Driver'}</Text>
            <Text style={{ color: MUTED, fontSize: 12 }}>{user?.email || ''}</Text>
          </View>
          <Pressable
            onPress={() => Alert.alert('Sign Out', 'Are you sure?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign Out', style: 'destructive', onPress: logout },
            ])}
            style={{ backgroundColor: RED_LT, borderWidth: 1, borderColor: RED + '44', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 }}
          >
            <Text style={{ color: RED, fontWeight: '700', fontSize: 13 }}>Sign Out</Text>
          </Pressable>
        </View>

        {/* Refresh data — moved out of the header to make room for the
            settings icon. Invalidates the same queries pull-to-refresh does. */}
        <Pressable
          onPress={async () => {
            hTap();
            await Promise.all([
              queryClient.invalidateQueries({ queryKey: ['rollup'] }),
              queryClient.invalidateQueries({ queryKey: ['entries'] }),
              queryClient.invalidateQueries({ queryKey: ['goal'] }),
            ]);
            hNotifyOk();
          }}
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 12,
            backgroundColor: SURFACE, borderRadius: 14, borderWidth: 1, borderColor: BORDER,
            padding: 14, marginBottom: 24,
            shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3,
          }}
        >
          <View style={{
            width: 36, height: 36, borderRadius: 18,
            backgroundColor: PRI_LITE, alignItems: 'center', justifyContent: 'center',
          }}>
            <Ionicons name="refresh" size={18} color={PRIMARY_TXT} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: TEXT, fontSize: 15, fontWeight: '700' }}>Refresh data</Text>
            <Text style={{ color: MUTED, fontSize: 12, marginTop: 2 }}>Re-pull earnings, expenses, and goals</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={MUTED} />
        </Pressable>

        {/* Privacy */}
        <Text style={{ color: LABEL, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 }}>
          🕶️ Privacy
        </Text>
        <Pressable
          onPress={() => { hTap(); toggleHidden(); }}
          style={[
            {
              flexDirection: 'row', alignItems: 'center', gap: 12,
              backgroundColor: SURFACE, borderRadius: 14, borderWidth: 1,
              borderColor: hidden ? PRIMARY : BORDER,
              padding: 14, marginBottom: 24,
            },
            hidden ? neonGlow(PRIMARY, 10, 0.25) : undefined,
          ].filter(Boolean) as ViewStyle[]}
        >
          <View style={{
            width: 36, height: 36, borderRadius: 18,
            backgroundColor: PRI_LITE, alignItems: 'center', justifyContent: 'center',
          }}>
            <Ionicons name={hidden ? 'eye-off' : 'eye'} size={18} color={PRIMARY_TXT} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: TEXT, fontSize: 15, fontWeight: '700' }}>Enable Hidden Mode</Text>
            <Text style={{ color: MUTED, fontSize: 12, marginTop: 2 }}>Hide all dollar amounts across the app</Text>
          </View>
          {/* Pill-style toggle (no native Switch — keeps Dark Neon look) */}
          <View style={{
            width: 48, height: 28, borderRadius: 14, padding: 3,
            backgroundColor: hidden ? PRIMARY : BORDER,
            alignItems: hidden ? 'flex-end' : 'flex-start', justifyContent: 'center',
          }}>
            <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: hidden ? ON_PRIMARY : SURFACE }} />
          </View>
        </Pressable>

        {/* Notifications */}
        <Text style={{ color: LABEL, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 }}>
          🔔 Notifications
        </Text>
        <Pressable
          onPress={onToggleNotif}
          disabled={notifBusy}
          style={[
            {
              flexDirection: 'row', alignItems: 'center', gap: 12,
              backgroundColor: SURFACE, borderRadius: 14, borderWidth: 1,
              borderColor: notifOn ? PRIMARY : BORDER,
              padding: 14, marginBottom: 24,
              opacity: notifBusy ? 0.6 : 1,
            },
            notifOn ? neonGlow(PRIMARY, 10, 0.25) : undefined,
          ].filter(Boolean) as ViewStyle[]}
        >
          <View style={{
            width: 36, height: 36, borderRadius: 18,
            backgroundColor: PRI_LITE, alignItems: 'center', justifyContent: 'center',
          }}>
            <Ionicons name={notifOn ? 'notifications' : 'notifications-off'} size={18} color={PRIMARY_TXT} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: TEXT, fontSize: 15, fontWeight: '700' }}>Daily Motivation</Text>
            <Text style={{ color: MUTED, fontSize: 12, marginTop: 2 }}>Morning hype + an evening recap of your day</Text>
          </View>
          {/* Pill-style toggle (no native Switch — keeps Dark Neon look) */}
          <View style={{
            width: 48, height: 28, borderRadius: 14, padding: 3,
            backgroundColor: notifOn ? PRIMARY : BORDER,
            alignItems: notifOn ? 'flex-end' : 'flex-start', justifyContent: 'center',
          }}>
            <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: notifOn ? ON_PRIMARY : SURFACE }} />
          </View>
        </Pressable>

        {/* Sound */}
        <Text style={{ color: LABEL, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 }}>
          🔊 Sound
        </Text>
        <Pressable
          onPress={onToggleSound}
          style={[
            {
              flexDirection: 'row', alignItems: 'center', gap: 12,
              backgroundColor: SURFACE, borderRadius: 14, borderWidth: 1,
              borderColor: soundOn ? PRIMARY : BORDER,
              padding: 14, marginBottom: 24,
            },
            soundOn ? neonGlow(PRIMARY, 10, 0.25) : undefined,
          ].filter(Boolean) as ViewStyle[]}
        >
          <View style={{
            width: 36, height: 36, borderRadius: 18,
            backgroundColor: PRI_LITE, alignItems: 'center', justifyContent: 'center',
          }}>
            <Ionicons name={soundOn ? 'volume-high' : 'volume-mute'} size={18} color={PRIMARY_TXT} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: TEXT, fontSize: 15, fontWeight: '700' }}>Ka-Ching Sound</Text>
            <Text style={{ color: MUTED, fontSize: 12, marginTop: 2 }}>Cash-register sound when you log an entry</Text>
          </View>
          {/* Pill-style toggle (no native Switch — keeps Dark Neon look) */}
          <View style={{
            width: 48, height: 28, borderRadius: 14, padding: 3,
            backgroundColor: soundOn ? PRIMARY : BORDER,
            alignItems: soundOn ? 'flex-end' : 'flex-start', justifyContent: 'center',
          }}>
            <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: soundOn ? ON_PRIMARY : SURFACE }} />
          </View>
        </Pressable>

        {/* Profit Goals */}
        <Text style={{ color: LABEL, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 }}>
          🏆 Profit Goals
        </Text>
        {goalRows.map((row, i) => {
          const goal   = goalQueries[i].data;
          const target = Number(goal?.target_profit ?? 0) || 0;
          return (
            <View key={row.tf} style={{
              backgroundColor: SURFACE, borderRadius: 14, borderWidth: 1, borderColor: BORDER, padding: 14, marginBottom: 10,
              shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3,
            }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontSize: 18 }}>{row.emoji}</Text>
                  <Text style={{ color: TEXT, fontSize: 15, fontWeight: '600' }}>{row.label}</Text>
                </View>
                <Text style={{ color: PRIMARY_TXT, fontSize: 18, fontWeight: '800' }}>
                  {target > 0 ? (hidden ? MASK : `$${target.toFixed(0)}`) : 'Not set'}
                </Text>
              </View>
              {editingGoal === row.tf ? (
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                  <TextInput
                    value={goalInput}
                    onChangeText={setGoalInput}
                    placeholder="Enter amount..."
                    placeholderTextColor={LABEL}
                    keyboardType="decimal-pad"
                    autoFocus
                    style={{
                      flex: 1, backgroundColor: BG, borderWidth: 1.5, borderColor: PRIMARY,
                      borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: TEXT, fontSize: 16, fontWeight: '700',
                    }}
                  />
                  <Pressable
                    onPress={() => {
                      const val = parseFloat(goalInput);
                      if (!val || val <= 0) { Alert.alert('Invalid', 'Enter a valid amount.'); return; }
                      upsertGoal.mutate({ tf: row.tf, target: val });
                    }}
                    style={{ backgroundColor: PRIMARY, borderRadius: 10, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Text style={{ color: ON_PRIMARY, fontWeight: '800' }}>Save</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setEditingGoal(null)}
                    style={{ backgroundColor: BG, borderRadius: 10, borderWidth: 1, borderColor: BORDER, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Text style={{ color: MUTED }}>✕</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  onPress={() => { setGoalInput(target > 0 ? target.toString() : ''); setEditingGoal(row.tf); }}
                  style={{
                    marginTop: 10, borderWidth: 1, borderColor: PRIMARY + '44', borderRadius: 10,
                    paddingVertical: 8, paddingHorizontal: 12, alignItems: 'center',
                    backgroundColor: PRI_LITE,
                  }}
                >
                  <Text style={{ color: PRIMARY_TXT, fontSize: 13, fontWeight: '700' }}>
                    {target > 0 ? '✏️ Edit Goal' : '+ Set Goal'}
                  </Text>
                </Pressable>
              )}
            </View>
          );
        })}

        {/* Theme switcher */}
        <Text style={{
          color: LABEL, fontSize: 11, fontWeight: '700', textTransform: 'uppercase',
          letterSpacing: 1.5, marginTop: 24, marginBottom: 12,
        }}>
          🎨 Appearance
        </Text>
        {(Object.keys(THEMES) as ThemeName[]).map((name) => {
          const th = THEMES[name];
          const active = themeName === name;
          return (
            <Pressable
              key={name}
              onPress={() => { hTap(); setThemeName(name); }}
              style={{
                backgroundColor: SURFACE,
                borderRadius: 14,
                borderWidth: active ? 2 : 1,
                borderColor: active ? PRIMARY : BORDER,
                padding: 14,
                marginBottom: 10,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
              }}
            >
              {/* Color swatch row showing the theme's surface + accent + green/red */}
              <View style={{ flexDirection: 'row', borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: BORDER }}>
                <View style={{ width: 18, height: 36, backgroundColor: th.BG }} />
                <View style={{ width: 18, height: 36, backgroundColor: th.SURFACE }} />
                <View style={{ width: 18, height: 36, backgroundColor: th.PRIMARY }} />
                <View style={{ width: 18, height: 36, backgroundColor: th.GREEN }} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: TEXT, fontSize: 15, fontWeight: '700' }}>{th.label}</Text>
                <Text style={{ color: MUTED, fontSize: 12, marginTop: 2 }}>
                  {name === 'dark' ? 'True-black with neon glow' :
                   'Clean white with neon accents'}
                </Text>
              </View>
              {active && (
                <Ionicons name="checkmark-circle" size={22} color={PRIMARY_TXT} />
              )}
            </Pressable>
          );
        })}

        {/* Import / Export — CSV bulk import via expo-document-picker.
            Parses inline (no external dep). Expected headers (case-insensitive):
            date, time, type, app, amount, distance_miles, duration_minutes,
            category, note. Order doesn't matter; unknown columns are ignored. */}
        <View style={{ height: 28 }} />
        <Text style={{ color: LABEL, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 }}>
          📂  Import / Export Data
        </Text>
        <ImportCsvRow
          onDone={() => {
            queryClient.invalidateQueries({ queryKey: ['entries'] });
            queryClient.invalidateQueries({ queryKey: ['rollup'] });
            queryClient.invalidateQueries({ queryKey: ['analytics-rollup'] });
            queryClient.invalidateQueries({ queryKey: ['analytics-entries'] });
          }}
        />
        <View style={{ height: 12 }} />
        <ExportCsvRow />

        {/* Delete Account — Apple Guideline 5.1.1(v) requires apps that support */}
        {/* account creation to also support in-app account deletion. */}
        <View style={{ height: 28 }} />
        <Text style={{ color: LABEL, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 }}>
          ⚠️  Danger Zone
        </Text>
        <Pressable
          onPress={() => {
            Alert.alert(
              'Delete Account',
              'This permanently deletes your account and ALL of your earnings, expenses, goals and settings. This cannot be undone.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete Forever',
                  style: 'destructive',
                  onPress: () => {
                    Alert.alert(
                      'Are you absolutely sure?',
                      'Tap "Yes, delete everything" to permanently erase your account.',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Yes, delete everything',
                          style: 'destructive',
                          onPress: async () => {
                            try {
                              await api.deleteAccount();
                              await logout();
                            } catch (e: any) {
                              Alert.alert('Could not delete account', e?.message || 'Please try again.');
                            }
                          },
                        },
                      ],
                    );
                  },
                },
              ],
            );
          }}
          style={{
            backgroundColor: RED_LT,
            borderWidth: 1,
            borderColor: RED + '66',
            borderRadius: 14,
            padding: 16,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: RED, fontWeight: '800', fontSize: 14 }}>Delete My Account</Text>
          <Text style={{ color: MUTED, fontSize: 11, marginTop: 4 }}>Permanently erase all of your data</Text>
        </Pressable>
      </ScrollView>
    </Modal>
  );
}

// ─── Dashboard Screen ─────────────────────────────────────────────────────────
// ─── Goal Progress Bar ─────────────────────────────────────────────────────
// When profit ≥ 0: green/yellow fill at goalPct%, neon glow when at goal.
// When profit  < 0: empty bar with a subtle red pulse on the track to flag
// that the user is currently in the red on this period's goal.
function GoalProgressBar({
  goalPct, isLoss, color, fallbackTrack,
}: { goalPct: number; isLoss: boolean; color: string; fallbackTrack: string }) {
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (isLoss) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(0.35, { duration: 700, easing: Easing.inOut(Easing.ease) }),
          withTiming(1,    { duration: 700, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      );
    } else {
      pulse.value = withTiming(1, { duration: 200 });
    }
  }, [isLoss, pulse]);

  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <View
      style={{
        backgroundColor: isLoss ? 'transparent' : fallbackTrack,
        borderRadius: 6,
        height: 8,
        overflow: 'hidden',
        borderWidth: isLoss ? 1 : 0,
        borderColor: isLoss ? '#ef4444' : 'transparent',
      }}
    >
      {isLoss ? (
        // Empty bar (0% fill) with a pulsing red wash to draw the eye.
        <Animated.View
          style={[
            { ...StyleSheet.absoluteFillObject, backgroundColor: '#ef444433' },
            pulseStyle,
          ]}
        />
      ) : (
        <View
          style={{
            width: `${Math.min(goalPct, 100)}%`,
            height: '100%',
            backgroundColor: color,
            borderRadius: 6,
            shadowColor: color,
            shadowOpacity: goalPct >= 100 ? 0.8 : 0.35,
            shadowRadius: goalPct >= 100 ? 8 : 4,
            shadowOffset: { width: 0, height: 0 },
          }}
        />
      )}
    </View>
  );
}

// ─── Transaction sorting ─────────────────────────────────────────────────────
type SortKey = 'newest' | 'oldest' | 'highest' | 'lowest' | 'platform';
const SORT_OPTIONS: { key: SortKey; label: string; short: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'newest',   label: 'Newest First',      short: 'Newest',   icon: 'arrow-down' },
  { key: 'oldest',   label: 'Oldest First',      short: 'Oldest',   icon: 'arrow-up' },
  { key: 'highest',  label: 'Highest Amount',    short: 'Highest',  icon: 'trending-up' },
  { key: 'lowest',   label: 'Lowest Amount',     short: 'Lowest',   icon: 'trending-down' },
  { key: 'platform', label: 'By Platform (A–Z)', short: 'Platform', icon: 'apps' },
];

// ─── Analytics ───────────────────────────────────────────────────────────────
// Analytics is a full-screen modal opened from a prominent dashboard button
// (the app has no bottom tab bar). It reuses the pure-View ProfitChart and
// theme tokens so it stays 100% OTA-deployable (no native chart libraries).
type AnalyticsPeriod = 'today' | 'yesterday' | 'week' | 'month' | 'last30' | 'all';
const ANALYTICS_PERIODS: { key: AnalyticsPeriod; label: string }[] = [
  { key: 'today',     label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'week',      label: 'This Week' },
  { key: 'month',     label: 'This Month' },
  { key: 'last30',    label: 'Last 30 Days' },
  { key: 'all',       label: 'All Time' },
];

// Map the dashboard's currently-viewed period onto the closest Analytics period
// so Analytics opens to whatever the user is looking at on the dashboard.
// today/yesterday/week/month map 1:1; the dashboard-only periods fall back to
// the nearest-magnitude Analytics window (last7→This Week, lastMonth→This Month,
// custom→All Time since Analytics has no custom range).
const dashboardToAnalyticsPeriod = (p: Period): AnalyticsPeriod => {
  switch (p) {
    case 'today':     return 'today';
    case 'yesterday': return 'yesterday';
    case 'week':      return 'week';
    case 'last7':     return 'week';
    case 'month':     return 'month';
    case 'lastMonth': return 'month';
    case 'custom':    return 'all';
    default:          return 'today';
  }
};

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const hourTick = (h: number) => {
  const am = h < 12;
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}${am ? 'a' : 'p'}`;
};
const fmtDayLabel = (d: Date) =>
  d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

// Local YYYY-MM-DD (backend interprets these as inclusive EST calendar days).
const ymdLocal = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Signed vertical neon bar chart, reused for the hourly-earnings, weekday and
// expense-trend distributions. Pure-View (no native chart lib) so it's OTA-safe.
// Bars draw from a centre baseline; the tallest bar gets a brighter neon glow.
function VBarChart({
  buckets,
  positiveColor,
  negativeColor,
  height = 110,
  labels,
}: {
  buckets: number[];
  positiveColor: string;
  negativeColor: string;
  height?: number;
  labels?: (string | null)[];
}) {
  const { LABEL, DIVIDER } = useTheme();
  const maxAbs = Math.max(1, ...buckets.map(b => Math.abs(b)));
  const hasAny = buckets.some(b => b !== 0);
  const peak = buckets.reduce((mi, v, i, a) => (Math.abs(v) > Math.abs(a[mi]) ? i : mi), 0);
  const N = buckets.length;
  const GAP = N > 14 ? 1 : 3;
  const HALF = height / 2;

  if (!hasAny) {
    return (
      <View style={{ height, justifyContent: 'center' }}>
        <View style={{ height: 1.5, backgroundColor: DIVIDER, opacity: 0.4 }} />
        <Text style={{
          color: LABEL, fontSize: 11, textAlign: 'center', marginTop: 10,
          letterSpacing: 1, textTransform: 'uppercase', fontWeight: '700', opacity: 0.6,
        }}>
          No data yet
        </Text>
      </View>
    );
  }

  return (
    <View>
      <View style={{ height, flexDirection: 'row', alignItems: 'center', gap: GAP }}>
        {buckets.map((v, i) => {
          const ratio = Math.abs(v) / maxAbs;
          const h = Math.max(v !== 0 ? 3 : 0, ratio * (HALF - 6));
          const positive = v >= 0;
          const color = positive ? positiveColor : negativeColor;
          const isPeak = i === peak && v !== 0;
          return (
            <View key={i} style={{ flex: 1, height: '100%', justifyContent: 'center', position: 'relative' }}>
              <View style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 1, backgroundColor: DIVIDER, opacity: 0.35 }} />
              {v !== 0 && (
                <View style={[
                  {
                    position: 'absolute', left: 0, right: 0,
                    top: positive ? `${50 - (h / height) * 100}%` : '50%',
                    height: h, backgroundColor: color,
                    opacity: isPeak ? 1 : 0.65, borderRadius: 3,
                  },
                  isPeak ? neonGlow(color, 8, 0.55) : null,
                ].filter(Boolean) as ViewStyle[]} />
              )}
            </View>
          );
        })}
      </View>
      {labels && (
        <View style={{ flexDirection: 'row', marginTop: 7, gap: GAP }}>
          {labels.map((l, i) => (
            <View key={i} style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ color: LABEL, fontSize: 9, fontWeight: '700' }} numberOfLines={1}>{l ?? ''}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function AnalyticsModal({ visible, onClose, initialPeriod = 'today' }: { visible: boolean; onClose: () => void; initialPeriod?: AnalyticsPeriod }) {
  const {
    BG, SURFACE, BORDER, PRIMARY, PRIMARY_TXT, PRI_LITE, TEXT, TEXT_MID, MUTED, LABEL,
    GREEN, GREEN_LT, RED, RED_LT, DIVIDER, ON_PRIMARY,
  } = useTheme();
  const { hidden } = useHiddenMode();
  const insets = useSafeAreaInsets();
  const [aPeriod, setAPeriod] = useState<AnalyticsPeriod>(initialPeriod);
  const [showAllDays, setShowAllDays] = useState(false);

  // Open to the timeframe the user is currently viewing on the dashboard: sync
  // the selected period to `initialPeriod` each time the modal becomes visible
  // (the component stays mounted, so state would otherwise persist the last-used
  // period across opens). The user can still freely switch periods once open.
  useEffect(() => {
    if (visible) setAPeriod(initialPeriod);
  }, [visible, initialPeriod]);

  // `todayStamp` (local YYYY-MM-DD) is part of every query key so the cached
  // range refetches automatically after a midnight rollover while the app
  // stays open. The actual range is resolved fresh inside each queryFn so the
  // from/to dates can never be frozen to a stale day.
  const todayStamp = ymdLocal(new Date());

  // Map the selected analytics period onto either a named backend timeframe
  // (week/month — guarantees the numbers match the dashboard) or an explicit
  // from/to range (last30/all). Aggregation is all done client-side.
  const resolveRange = (p: AnalyticsPeriod): { timeframe: string | null; fromIso: string | null; toIso: string | null } => {
    const today = new Date();
    if (p === 'today')     return { timeframe: 'TODAY',     fromIso: null, toIso: null };
    if (p === 'yesterday') return { timeframe: 'YESTERDAY', fromIso: null, toIso: null };
    if (p === 'week')  return { timeframe: 'THIS_WEEK',  fromIso: null, toIso: null };
    if (p === 'month') return { timeframe: 'THIS_MONTH', fromIso: null, toIso: null };
    if (p === 'last30') {
      const from = new Date(today); from.setDate(today.getDate() - 29);
      return { timeframe: null, fromIso: ymdLocal(from), toIso: ymdLocal(today) };
    }
    return { timeframe: null, fromIso: '2020-01-01', toIso: ymdLocal(today) };
  };

  const rollupQuery = useQuery({
    queryKey: ['analytics-rollup', aPeriod, todayStamp],
    queryFn: () => {
      const r = resolveRange(aPeriod);
      return r.timeframe ? api.getRollup(r.timeframe) : api.getRollupInRange(r.fromIso!, r.toIso!);
    },
    enabled: visible,
  });
  const entriesQuery = useQuery({
    queryKey: ['analytics-entries', aPeriod, todayStamp],
    queryFn: () => {
      const r = resolveRange(aPeriod);
      return r.timeframe ? api.getEntries(r.timeframe, 5000) : api.getEntriesInRange(r.fromIso!, r.toIso!, 5000);
    },
    enabled: visible,
  });

  const rollup = rollupQuery.data;
  const entries = entriesQuery.data ?? [];
  const loading = rollupQuery.isLoading || entriesQuery.isLoading;

  // Spend per category — expenses only (stored as negative amounts), summed by
  // their category as positive totals, with each share of the total spend.
  const categoryData = useMemo(() => {
    const map = new Map<ExpenseCategory, number>();
    for (const e of entries) {
      if (e.type !== 'EXPENSE') continue;
      const cat = (e.category ?? 'OTHER') as ExpenseCategory;
      map.set(cat, (map.get(cat) ?? 0) + Math.abs(Number(e.amount) || 0));
    }
    const total = Array.from(map.values()).reduce((a, b) => a + b, 0);
    const rows = Array.from(map.entries())
      .map(([cat, amt]) => ({ cat, amt, pct: total > 0 ? (amt / total) * 100 : 0 }))
      .sort((a, b) => b.amt - a.amt);
    return { total, rows };
  }, [entries]);

  // Top platforms by NET earnings (signed sum per app — mirrors the backend's
  // by_app rollup, so expenses/cancellations logged under a platform net out).
  const platformData = useMemo(() => {
    const map = new Map<AppType, number>();
    for (const e of entries) {
      const a = e.app as AppType;
      map.set(a, (map.get(a) ?? 0) + (Number(e.amount) || 0));
    }
    const rows = Array.from(map.entries())
      .map(([app, amt]) => ({ app, amt }))
      .sort((a, b) => b.amt - a.amt);
    const maxAbs = Math.max(1, ...rows.map(r => Math.abs(r.amt)));
    return { rows, maxAbs };
  }, [entries]);

  // Miles per active day — divide total miles by the number of distinct
  // calendar days that actually have entries, so idle days (esp. in All Time)
  // don't deflate the average.
  const milesPerDay = useMemo(() => {
    const totalMiles = rollup?.miles ?? 0;
    const dayKeys = new Set<string>();
    for (const e of entries) {
      const d = parseServerDate(e.timestamp);
      dayKeys.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
    }
    const activeDays = Math.max(1, dayKeys.size);
    return totalMiles / activeDays;
  }, [entries, rollup]);

  // The profit-trend chart shows the last 7 days (week) or last 30 days
  // (everything else), reusing the dashboard's pure-View ProfitChart.
  const trendCustomRange = useMemo(() => {
    const today = new Date();
    const from = new Date(today); from.setDate(today.getDate() - 29);
    return { from: ymdLocal(from), to: ymdLocal(today) };
  }, []);

  const isSingleDay = aPeriod === 'today' || aPeriod === 'yesterday';

  // Per-day aggregation across the loaded entries — the backbone for the daily
  // breakdown list, top-earning-days ranking and the per-day averages.
  const dayAgg = useMemo(() => {
    const map = new Map<string, { date: Date; net: number; revenue: number; expenses: number; miles: number; minutes: number; orders: number }>();
    for (const e of entries) {
      const d = parseServerDate(e.timestamp);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      let rec = map.get(key);
      if (!rec) {
        rec = { date: new Date(d.getFullYear(), d.getMonth(), d.getDate()), net: 0, revenue: 0, expenses: 0, miles: 0, minutes: 0, orders: 0 };
        map.set(key, rec);
      }
      // Sign-based so the daily invariant always holds: revenue = positive
      // inflows, expenses = magnitude of ALL negative outflows (EXPENSE AND
      // CANCELLATION), so net === revenue - expenses for every day.
      const amt = Number(e.amount) || 0;
      rec.net += amt;
      if (amt >= 0) rec.revenue += amt;
      else rec.expenses += -amt;
      rec.miles += Number(e.distance_miles) || 0;
      rec.minutes += Number(e.duration_minutes) || 0;
      if (e.type === 'ORDER') rec.orders += 1;
    }
    return Array.from(map.values()).sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [entries]);

  const activeDays = Math.max(1, dayAgg.length);
  const totalOrders = useMemo(() => entries.filter(e => e.type === 'ORDER').length, [entries]);

  // Per-active-day averages (idle days excluded so they don't deflate the mean).
  const dailyAverages = useMemo(() => ({
    profit: (rollup?.profit ?? 0) / activeDays,
    revenue: (rollup?.revenue ?? 0) / activeDays,
    orders: totalOrders / activeDays,
  }), [rollup, activeDays, totalOrders]);

  // Best / worst days by net profit, and the top-earning-days ranking.
  const topDays = useMemo(() => [...dayAgg].sort((a, b) => b.net - a.net).slice(0, 5), [dayAgg]);
  const bestDay = topDays[0];

  // Hourly earnings distribution — sum of POSITIVE earning entries by hour of
  // day (gross income, expenses excluded), revealing the most lucrative hours.
  const hourly = useMemo(() => {
    const arr = Array<number>(24).fill(0);
    for (const e of entries) {
      if (e.type === 'EXPENSE') continue;
      const amt = Number(e.amount) || 0;
      if (amt <= 0) continue;
      arr[parseServerDate(e.timestamp).getHours()] += amt;
    }
    return arr;
  }, [entries]);
  const peakHour = useMemo(() => hourly.reduce((mi, v, i, a) => (v > a[mi] ? i : mi), 0), [hourly]);
  const hasHourly = hourly.some(v => v > 0);

  // Net profit by weekday (Sun..Sat) across the whole loaded period.
  const weekday = useMemo(() => {
    const arr = Array<number>(7).fill(0);
    for (const e of entries) arr[parseServerDate(e.timestamp).getDay()] += Number(e.amount) || 0;
    return arr;
  }, [entries]);
  const bestWeekday = useMemo(() => weekday.reduce((mi, v, i, a) => (v > a[mi] ? i : mi), 0), [weekday]);

  // Daily expense trend — continuous calendar days (gaps shown as zero) so the
  // shape reads as a real time series, capped at 31 bars for legibility.
  const expenseTrend = useMemo(() => {
    if (isSingleDay) return [];
    let days = 7;
    const endDate = new Date();
    if (aPeriod === 'week') days = 7;
    else if (aPeriod === 'month') days = endDate.getDate();
    else days = 30;
    days = Math.min(days, 31);
    const keyOf = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const idx = new Map<string, number>();
    const arr = Array<number>(days).fill(0);
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(endDate); d.setDate(endDate.getDate() - i);
      idx.set(keyOf(d), days - 1 - i);
    }
    for (const e of entries) {
      // All negative outflows (EXPENSE + CANCELLATION), matching dayAgg.
      const amt = Number(e.amount) || 0;
      if (amt >= 0) continue;
      const j = idx.get(keyOf(parseServerDate(e.timestamp)));
      if (j !== undefined) arr[j] += -amt;
    }
    return arr;
  }, [entries, aPeriod, isSingleDay]);
  const hasExpenseTrend = expenseTrend.some(v => v > 0);

  // Business (tax-deductible) expense summary — magnitude + count of EXPENSE
  // entries flagged is_business_expense. Also reports the deductible share of
  // total spend so drivers can see how much of their outflow is write-off-able.
  const businessExpenses = useMemo(() => {
    let total = 0, count = 0, allOutflow = 0;
    for (const e of entries) {
      const amt = Number(e.amount) || 0;
      if (amt >= 0) continue;
      allOutflow += -amt;
      if (e.is_business_expense) { total += -amt; count += 1; }
    }
    const share = allOutflow > 0 ? (total / allOutflow) * 100 : 0;
    return { total, count, share };
  }, [entries]);

  // Profit-trend chart driver — reuses the dashboard's pure-View ProfitChart.
  const chartPeriod: 'today' | 'yesterday' | 'week' | 'month' | 'custom' =
    aPeriod === 'today' ? 'today'
    : aPeriod === 'yesterday' ? 'yesterday'
    : aPeriod === 'week' ? 'week'
    : aPeriod === 'month' ? 'month'
    : 'custom';
  const chartTitle =
    isSingleDay ? '📈 Profit by Hour'
    : aPeriod === 'week' ? '📈 Profit Trend (this week)'
    : aPeriod === 'month' ? '📈 Profit Trend (this month)'
    : '📈 Profit Trend (last 30 days)';

  const profit  = rollup?.profit ?? 0;
  const isProfit = profit >= 0;
  const money = (n: number) => `${n < 0 ? '-' : ''}$${Math.abs(n).toFixed(2)}`;

  const kpis: { label: string; value: string; color?: string; hide?: boolean }[] = [
    { label: 'Net Profit',     value: money(profit), color: isProfit ? GREEN : RED, hide: true },
    { label: 'Revenue',        value: `$${(rollup?.revenue ?? 0).toFixed(0)}`, color: GREEN, hide: true },
    { label: 'Expenses',       value: `$${Math.abs(rollup?.expenses ?? 0).toFixed(0)}`, color: RED, hide: true },
    { label: '$ / Mile',       value: `$${(rollup?.dollars_per_mile ?? 0).toFixed(2)}`, color: PRIMARY_TXT, hide: true },
    { label: 'Avg Order',      value: `$${(rollup?.average_order_value ?? 0).toFixed(2)}`, hide: true },
    { label: 'Orders',         value: `${totalOrders}` },
    { label: 'Avg / Day',      value: money(dailyAverages.profit), color: isProfit ? GREEN : RED, hide: true, },
    { label: 'Active Days',    value: `${dayAgg.length}` },
    { label: 'Total Miles',    value: `${(rollup?.miles ?? 0).toFixed(1)}` },
    { label: 'Total Hours',    value: `${(rollup?.hours ?? 0).toFixed(1)}` },
    { label: 'Miles / Day',    value: `${milesPerDay.toFixed(1)}` },
  ];

  const sectionTitle = (text: string) => (
    <Text style={{ color: LABEL, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12, marginTop: 4 }}>
      {text}
    </Text>
  );

  const card: ViewStyle = {
    backgroundColor: SURFACE, borderRadius: 16, borderWidth: 1, borderColor: BORDER,
    padding: 16, marginBottom: 20,
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <ScrollView style={{ flex: 1, backgroundColor: BG }} contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <Text style={{ color: TEXT, fontSize: 20, fontWeight: '800' }}>📊 Analytics</Text>
          <Pressable onPress={onClose} style={{ padding: 6 }}>
            <Ionicons name="close-circle" size={28} color={MUTED} />
          </Pressable>
        </View>

        {/* Period filter */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 22 }}>
          {ANALYTICS_PERIODS.map(p => {
            const active = aPeriod === p.key;
            return (
              <PressScale
                key={p.key}
                onPress={() => { hTap(); setAPeriod(p.key); }}
                scale={0.95}
                style={[
                  {
                    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 1,
                    backgroundColor: active ? PRIMARY : SURFACE,
                    borderColor: active ? PRIMARY : BORDER,
                  },
                  active ? neonGlow(PRIMARY, 8, 0.3) : undefined,
                ].filter(Boolean) as ViewStyle[]}
              >
                <Text style={{ color: active ? ON_PRIMARY : TEXT_MID, fontSize: 13, fontWeight: active ? '800' : '600' }}>
                  {p.label}
                </Text>
              </PressScale>
            );
          })}
        </View>

        {loading ? (
          <View style={{ paddingVertical: 80, alignItems: 'center' }}>
            <ActivityIndicator color={PRIMARY_TXT} />
          </View>
        ) : (
          <>
            {/* KPI grid */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
              {kpis.map(k => (
                <View
                  key={k.label}
                  style={{
                    width: '47%', flexGrow: 1,
                    backgroundColor: SURFACE, borderRadius: 16, borderWidth: 1, borderColor: BORDER,
                    paddingVertical: 14, paddingHorizontal: 14,
                  }}
                >
                  <Text style={{ color: LABEL, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 }}>
                    {k.label}
                  </Text>
                  <Text style={{ color: k.color ?? TEXT, fontSize: 20, fontWeight: '900', marginTop: 6 }}>
                    {hidden && k.hide ? MASK : k.value}
                  </Text>
                </View>
              ))}
            </View>

            {/* Business (tax-deductible) expense summary — only shown when there
                is at least one flagged business expense in the period. */}
            {businessExpenses.count > 0 && (
              <View style={{
                backgroundColor: '#3b82f612', borderRadius: 16,
                borderWidth: 1, borderColor: '#3b82f655',
                padding: 16, marginBottom: 20,
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <Text style={{ fontSize: 18 }}>💼</Text>
                  <Text style={{ color: '#3b82f6', fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 }}>
                    Business Expenses (Tax-Deductible)
                  </Text>
                </View>
                <Text style={{ color: TEXT, fontSize: 24, fontWeight: '900' }}>
                  {hidden ? MASK : money(businessExpenses.total)}
                </Text>
                <Text style={{ color: LABEL, fontSize: 12, marginTop: 4 }}>
                  {businessExpenses.count} {businessExpenses.count === 1 ? 'expense' : 'expenses'} · {businessExpenses.share.toFixed(0)}% of total spend
                </Text>
              </View>
            )}

            {/* Highlight strip — best day / peak hour / best weekday */}
            {!isSingleDay && (bestDay || hasHourly) && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
                {bestDay && bestDay.net > 0 && (
                  <View style={[{
                    flexGrow: 1, minWidth: '47%', backgroundColor: SURFACE, borderRadius: 16,
                    borderWidth: 1, borderColor: GREEN, padding: 14,
                  }, neonGlow(GREEN, 7, 0.18)]}>
                    <Text style={{ color: LABEL, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 }}>🔥 Best Day</Text>
                    <Text style={{ color: GREEN, fontSize: 20, fontWeight: '900', marginTop: 6 }}>{hidden ? MASK : money(bestDay.net)}</Text>
                    <Text style={{ color: MUTED, fontSize: 11, fontWeight: '700', marginTop: 2 }}>{fmtDayLabel(bestDay.date)}</Text>
                  </View>
                )}
                {hasHourly && (
                  <View style={[{
                    flexGrow: 1, minWidth: '47%', backgroundColor: SURFACE, borderRadius: 16,
                    borderWidth: 1, borderColor: PRIMARY, padding: 14,
                  }, neonGlow(PRIMARY, 7, 0.18)]}>
                    <Text style={{ color: LABEL, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 }}>⚡ Peak Hour</Text>
                    <Text style={{ color: PRIMARY_TXT, fontSize: 20, fontWeight: '900', marginTop: 6 }}>{hourTick(peakHour)}–{hourTick((peakHour + 1) % 24)}</Text>
                    <Text style={{ color: MUTED, fontSize: 11, fontWeight: '700', marginTop: 2 }}>Most earnings</Text>
                  </View>
                )}
              </View>
            )}

            {/* Profit trend */}
            <View style={card}>
              {sectionTitle(chartTitle)}
              <ProfitChart
                entries={entries}
                period={chartPeriod}
                customRange={chartPeriod === 'custom' ? trendCustomRange : null}
                dayOffset={0}
                positiveColor={GREEN}
                negativeColor={RED}
              />
            </View>

            {/* Earnings by hour of day */}
            <View style={card}>
              {sectionTitle('⏰ Earnings by Hour')}
              {!hasHourly ? (
                <Text style={{ color: MUTED, fontSize: 13, paddingVertical: 8 }}>No earnings logged in this period.</Text>
              ) : (
                <>
                  <Text style={{ color: TEXT_MID, fontSize: 12, fontWeight: '600', marginBottom: 12 }}>
                    Best hour: <Text style={{ color: PRIMARY_TXT, fontWeight: '900' }}>{hourTick(peakHour)}–{hourTick((peakHour + 1) % 24)}</Text>
                    {!hidden && <Text style={{ color: MUTED }}>  ·  {money(hourly[peakHour])}</Text>}
                  </Text>
                  <VBarChart
                    buckets={hourly}
                    positiveColor={PRIMARY}
                    negativeColor={RED}
                    height={120}
                    labels={hourly.map((_, h) => (h % 6 === 0 ? hourTick(h) : null))}
                  />
                </>
              )}
            </View>

            {/* Earnings by weekday (multi-day only) */}
            {!isSingleDay && (
              <View style={card}>
                {sectionTitle('📆 Profit by Weekday')}
                {weekday.every(v => v === 0) ? (
                  <Text style={{ color: MUTED, fontSize: 13, paddingVertical: 8 }}>Not enough data yet.</Text>
                ) : (
                  <>
                    <Text style={{ color: TEXT_MID, fontSize: 12, fontWeight: '600', marginBottom: 12 }}>
                      Strongest day: <Text style={{ color: GREEN, fontWeight: '900' }}>{WEEKDAY_LABELS[bestWeekday]}</Text>
                    </Text>
                    <VBarChart
                      buckets={weekday}
                      positiveColor={GREEN}
                      negativeColor={RED}
                      height={120}
                      labels={WEEKDAY_LABELS}
                    />
                  </>
                )}
              </View>
            )}

            {/* Expense trend (multi-day only) */}
            {!isSingleDay && (
              <View style={card}>
                {sectionTitle('📉 Daily Expense Trend')}
                {!hasExpenseTrend ? (
                  <Text style={{ color: MUTED, fontSize: 13, paddingVertical: 8 }}>No expenses logged in this period.</Text>
                ) : (
                  <VBarChart
                    buckets={expenseTrend.map(v => -v)}
                    positiveColor={RED}
                    negativeColor={RED}
                    height={100}
                  />
                )}
              </View>
            )}

            {/* Top earning days (multi-day only) */}
            {!isSingleDay && dayAgg.length > 0 && (
              <View style={card}>
                {sectionTitle('🏅 Top Earning Days')}
                {topDays.map((d, i) => {
                  const pos = d.net >= 0;
                  return (
                    <View key={d.date.getTime()} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: i === topDays.length - 1 ? 0 : 12 }}>
                      <View style={[{
                        width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center',
                        backgroundColor: i === 0 ? PRIMARY : SURFACE, borderWidth: 1, borderColor: i === 0 ? PRIMARY : BORDER, marginRight: 12,
                      }, i === 0 ? neonGlow(PRIMARY, 6, 0.3) : undefined].filter(Boolean) as ViewStyle[]}>
                        <Text style={{ color: i === 0 ? ON_PRIMARY : TEXT_MID, fontSize: 12, fontWeight: '900' }}>{i + 1}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: TEXT, fontSize: 14, fontWeight: '700' }}>{fmtDayLabel(d.date)}</Text>
                        <Text style={{ color: MUTED, fontSize: 11, fontWeight: '600' }}>{d.orders} orders · {d.miles.toFixed(1)} mi</Text>
                      </View>
                      <Text style={{ color: pos ? GREEN : RED, fontSize: 15, fontWeight: '900' }}>{hidden ? MASK : money(d.net)}</Text>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Daily breakdown (multi-day only) */}
            {!isSingleDay && dayAgg.length > 0 && (
              <View style={card}>
                {sectionTitle('🗓️ Daily Breakdown')}
                {(showAllDays ? dayAgg : dayAgg.slice(0, 7)).map((d, i, shown) => {
                  const pos = d.net >= 0;
                  return (
                    <View
                      key={d.date.getTime()}
                      style={{
                        flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
                        borderTopWidth: i === 0 ? 0 : 1, borderTopColor: DIVIDER,
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: TEXT, fontSize: 13, fontWeight: '700' }}>{fmtDayLabel(d.date)}</Text>
                        <Text style={{ color: MUTED, fontSize: 11, fontWeight: '600', marginTop: 2 }}>
                          {hidden ? MASK : `$${d.revenue.toFixed(0)} in`}
                          {d.expenses > 0 && <Text style={{ color: RED }}>{hidden ? '' : `  ·  $${d.expenses.toFixed(0)} out`}</Text>}
                          <Text>{`  ·  ${d.orders} ord`}</Text>
                        </Text>
                      </View>
                      <Text style={{ color: pos ? GREEN : RED, fontSize: 14, fontWeight: '900' }}>{hidden ? MASK : money(d.net)}</Text>
                    </View>
                  );
                })}
                {dayAgg.length > 7 && (
                  <PressScale
                    onPress={() => { hTap(); setShowAllDays(v => !v); }}
                    scale={0.97}
                    style={{ marginTop: 12, alignItems: 'center', paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: BORDER }}
                  >
                    <Text style={{ color: PRIMARY_TXT, fontSize: 13, fontWeight: '800' }}>
                      {showAllDays ? 'Show less' : `Show all ${dayAgg.length} days`}
                    </Text>
                  </PressScale>
                )}
              </View>
            )}

            {/* Spend per category */}
            <View style={card}>
              {sectionTitle('💸 Spend by Category')}
              {categoryData.rows.length === 0 ? (
                <Text style={{ color: MUTED, fontSize: 13, paddingVertical: 8 }}>No expenses logged in this period.</Text>
              ) : (
                <>
                  <Text style={{ color: RED, fontSize: 22, fontWeight: '900', marginBottom: 14 }}>
                    {hidden ? MASK : `$${categoryData.total.toFixed(2)}`} <Text style={{ color: MUTED, fontSize: 12, fontWeight: '700' }}>total spend</Text>
                  </Text>
                  {categoryData.rows.map(r => (
                    <View key={r.cat} style={{ marginBottom: 12 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                        <Text style={{ color: TEXT_MID, fontSize: 13, fontWeight: '600' }}>
                          {EXPENSE_EMOJIS[r.cat]} {r.cat.charAt(0) + r.cat.slice(1).toLowerCase()}
                        </Text>
                        <Text style={{ color: TEXT, fontSize: 13, fontWeight: '800' }}>
                          {hidden ? MASK : `$${r.amt.toFixed(2)}`} <Text style={{ color: MUTED, fontSize: 11, fontWeight: '700' }}>· {r.pct.toFixed(0)}%</Text>
                        </Text>
                      </View>
                      <View style={{ height: 8, borderRadius: 4, backgroundColor: DIVIDER, overflow: 'hidden' }}>
                        <View style={[{ height: '100%', width: `${Math.max(2, r.pct)}%`, borderRadius: 4, backgroundColor: PRIMARY }, neonGlow(PRIMARY, 5, 0.25)]} />
                      </View>
                    </View>
                  ))}
                </>
              )}
            </View>

            {/* Top platforms */}
            <View style={card}>
              {sectionTitle('🏆 Top Platforms by Earnings')}
              {platformData.rows.length === 0 ? (
                <Text style={{ color: MUTED, fontSize: 13, paddingVertical: 8 }}>No entries in this period.</Text>
              ) : (
                platformData.rows.map(r => {
                  const pos = r.amt >= 0;
                  const barColor = APP_COLORS[r.app] ?? GREEN;
                  const width = Math.max(2, (Math.abs(r.amt) / platformData.maxAbs) * 100);
                  return (
                    <View key={r.app} style={{ marginBottom: 12 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                        <Text style={{ color: TEXT_MID, fontSize: 13, fontWeight: '600' }}>{APP_LABELS[r.app]}</Text>
                        <Text style={{ color: pos ? GREEN : RED, fontSize: 13, fontWeight: '800' }}>
                          {hidden ? MASK : `${pos ? '' : '-'}$${Math.abs(r.amt).toFixed(2)}`}
                        </Text>
                      </View>
                      <View style={{ height: 8, borderRadius: 4, backgroundColor: DIVIDER, overflow: 'hidden' }}>
                        <View style={[{ height: '100%', width: `${width}%`, borderRadius: 4, backgroundColor: pos ? barColor : RED }, neonGlow(pos ? barColor : RED, 5, 0.25)]} />
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          </>
        )}
      </ScrollView>
    </Modal>
  );
}

// ─── Expenses List ────────────────────────────────────────────────────────────
// Full-screen modal opened by tapping the dashboard's EXPENSES KPI. Lists every
// negative outflow for the selected period with a per-category filter, summing
// the shown rows in a neon header card. Reuses the SAME `['analytics-entries', …]`
// React-Query key as the Analytics modal so it shares the cache and the existing
// add/edit/delete invalidations keep it fresh (see analytics-cache-invalidation).
//
// "Outflows" = every entry with a negative amount, i.e. EXPENSE entries AND
// order CANCELLATIONs. This matches the dashboard EXPENSES KPI (rollup.expenses,
// computed server-side as the magnitude of ALL negative amounts), so the
// drill-down total reconciles exactly with the number the user tapped.
type OutflowGroup = ExpenseCategory | 'CANCELLATION';
type ExpenseCatFilter = OutflowGroup | 'ALL';
// Maps an outflow entry to its filter group: expenses keep their category;
// cancellations collapse into a synthetic 'CANCELLATION' group.
const outflowGroup = (e: Entry): OutflowGroup =>
  e.type === 'CANCELLATION' ? 'CANCELLATION' : ((e.category as ExpenseCategory) || 'OTHER');
const groupEmoji = (g: OutflowGroup): string => (g === 'CANCELLATION' ? '❌' : EXPENSE_EMOJIS[g]);
const groupLabel = (g: OutflowGroup): string => (g === 'CANCELLATION' ? 'Cancellation' : g);
function ExpensesModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const {
    BG, SURFACE, BORDER, PRIMARY, PRIMARY_TXT, TEXT, TEXT_MID, MUTED, LABEL,
    RED, RED_LT, DIVIDER, ON_PRIMARY,
  } = useTheme();
  const { hidden } = useHiddenMode();
  const insets = useSafeAreaInsets();
  const [ePeriod, setEPeriod] = useState<AnalyticsPeriod>('today');
  const [catFilter, setCatFilter] = useState<ExpenseCatFilter>('ALL');

  // Always reopen on "Today": reset the selected period each time the modal
  // becomes visible (the component stays mounted, so state would otherwise
  // persist the last-used period across opens).
  useEffect(() => {
    if (visible) setEPeriod('today');
  }, [visible]);

  // Mirrors AnalyticsModal: todayStamp keys the query so it refetches after a
  // midnight rollover, and the range is resolved fresh inside the queryFn.
  const todayStamp = ymdLocal(new Date());
  const resolveRange = (p: AnalyticsPeriod): { timeframe: string | null; fromIso: string | null; toIso: string | null } => {
    const today = new Date();
    if (p === 'today')     return { timeframe: 'TODAY',     fromIso: null, toIso: null };
    if (p === 'yesterday') return { timeframe: 'YESTERDAY', fromIso: null, toIso: null };
    if (p === 'week')  return { timeframe: 'THIS_WEEK',  fromIso: null, toIso: null };
    if (p === 'month') return { timeframe: 'THIS_MONTH', fromIso: null, toIso: null };
    if (p === 'last30') {
      const from = new Date(today); from.setDate(today.getDate() - 29);
      return { timeframe: null, fromIso: ymdLocal(from), toIso: ymdLocal(today) };
    }
    return { timeframe: null, fromIso: '2020-01-01', toIso: ymdLocal(today) };
  };

  const entriesQuery = useQuery({
    queryKey: ['analytics-entries', ePeriod, todayStamp],
    queryFn: () => {
      const r = resolveRange(ePeriod);
      return r.timeframe ? api.getEntries(r.timeframe, 5000) : api.getEntriesInRange(r.fromIso!, r.toIso!, 5000);
    },
    enabled: visible,
  });
  const loading = entriesQuery.isLoading;

  // All negative outflows (EXPENSE + CANCELLATION, stored as negative amounts),
  // most-recent first — matches the dashboard EXPENSES KPI.
  const allExpenses = useMemo(() => {
    const list = (entriesQuery.data ?? []).filter(e => Number(e.amount) < 0);
    return [...list].sort(
      (a, b) => parseServerDate(b.timestamp).getTime() - parseServerDate(a.timestamp).getTime(),
    );
  }, [entriesQuery.data]);

  // Per-group totals (magnitude) drive the filter chips + their counts.
  const catStats = useMemo(() => {
    const m = new Map<OutflowGroup, { total: number; count: number }>();
    for (const e of allExpenses) {
      const g = outflowGroup(e);
      const cur = m.get(g) ?? { total: 0, count: 0 };
      cur.total += Math.abs(Number(e.amount));
      cur.count += 1;
      m.set(g, cur);
    }
    return [...m.entries()].sort((a, b) => b[1].total - a[1].total);
  }, [allExpenses]);

  const shown = useMemo(
    () => (catFilter === 'ALL' ? allExpenses : allExpenses.filter(e => outflowGroup(e) === catFilter)),
    [allExpenses, catFilter],
  );
  const shownTotal = useMemo(
    () => shown.reduce((s, e) => s + Math.abs(Number(e.amount)), 0),
    [shown],
  );

  const money = (v: number) => `$${Math.abs(v).toFixed(2)}`;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: BG }}>
        {/* Header */}
        <View style={{
          flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
          paddingHorizontal: 20, paddingTop: insets.top + 12, paddingBottom: 14,
          borderBottomWidth: 1, borderBottomColor: DIVIDER,
        }}>
          <Text style={{ color: TEXT, fontSize: 20, fontWeight: '800' }}>💸 Expenses</Text>
          <Pressable onPress={onClose} style={{ padding: 6 }}>
            <Ionicons name="close-circle" size={28} color={MUTED} />
          </Pressable>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Period filter */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
            {ANALYTICS_PERIODS.map(p => {
              const active = ePeriod === p.key;
              return (
                <PressScale
                  key={p.key}
                  onPress={() => { hTap(); setEPeriod(p.key); }}
                  scale={0.95}
                  style={[
                    {
                      paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 1,
                      backgroundColor: active ? PRIMARY : SURFACE,
                      borderColor: active ? PRIMARY : BORDER,
                    },
                    active ? neonGlow(PRIMARY, 8, 0.3) : undefined,
                  ].filter(Boolean) as ViewStyle[]}
                >
                  <Text style={{ color: active ? ON_PRIMARY : TEXT_MID, fontSize: 13, fontWeight: active ? '800' : '600' }}>
                    {p.label}
                  </Text>
                </PressScale>
              );
            })}
          </View>

          {loading ? (
            <View style={{ paddingVertical: 80, alignItems: 'center' }}>
              <ActivityIndicator color={PRIMARY_TXT} />
            </View>
          ) : (
            <>
              {/* Total card (neon, RED accent) */}
              <View style={[
                {
                  backgroundColor: SURFACE, borderRadius: 18, borderWidth: 1.5, borderColor: RED,
                  paddingVertical: 18, paddingHorizontal: 18, marginBottom: 18,
                },
                neonGlow(RED, 12, 0.28),
              ]}>
                <Text style={{ color: LABEL, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.2 }}>
                  {catFilter === 'ALL' ? 'Total Spent' : `${groupEmoji(catFilter)} ${groupLabel(catFilter)}`}
                </Text>
                <Text style={{ color: RED, fontSize: 34, fontWeight: '900', marginTop: 4 }}>
                  {hidden ? MASK : money(shownTotal)}
                </Text>
                <Text style={{ color: MUTED, fontSize: 12, fontWeight: '600', marginTop: 2 }}>
                  {shown.length} {shown.length === 1 ? 'item' : 'items'}
                </Text>
              </View>

              {/* Category filter chips */}
              {catStats.length > 0 && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
                  <PressScale
                    onPress={() => { hTap(); setCatFilter('ALL'); }}
                    scale={0.95}
                    style={{
                      paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1,
                      backgroundColor: catFilter === 'ALL' ? RED_LT : SURFACE,
                      borderColor: catFilter === 'ALL' ? RED : BORDER,
                    }}
                  >
                    <Text style={{ color: catFilter === 'ALL' ? RED : TEXT_MID, fontSize: 12, fontWeight: '700' }}>
                      All ({allExpenses.length})
                    </Text>
                  </PressScale>
                  {catStats.map(([g, s]) => {
                    const active = catFilter === g;
                    return (
                      <PressScale
                        key={g}
                        onPress={() => { hTap(); setCatFilter(active ? 'ALL' : g); }}
                        scale={0.95}
                        style={{
                          paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1,
                          backgroundColor: active ? RED_LT : SURFACE,
                          borderColor: active ? RED : BORDER,
                        }}
                      >
                        <Text style={{ color: active ? RED : TEXT_MID, fontSize: 12, fontWeight: '700' }}>
                          {groupEmoji(g)} {groupLabel(g)} ({s.count})
                        </Text>
                      </PressScale>
                    );
                  })}
                </View>
              )}

              {/* Expense list */}
              {shown.length === 0 ? (
                <View style={{ paddingVertical: 60, alignItems: 'center' }}>
                  <Text style={{ fontSize: 40, marginBottom: 10 }}>🧾</Text>
                  <Text style={{ color: MUTED, fontSize: 14, fontWeight: '600', textAlign: 'center' }}>
                    No expenses or cancellations for this period.
                  </Text>
                </View>
              ) : (
                <View style={{
                  backgroundColor: SURFACE, borderRadius: 16, borderWidth: 1, borderColor: BORDER,
                  overflow: 'hidden',
                }}>
                  {shown.map((e, i) => {
                    const g = outflowGroup(e);
                    const biz = !!e.is_business_expense;
                    const title = g === 'CANCELLATION' ? `Cancellation · ${APP_LABELS[e.app]}` : groupLabel(g);
                    const when = parseServerDate(e.timestamp);
                    return (
                      <View
                        key={e.id}
                        style={{
                          flexDirection: 'row', alignItems: 'center',
                          paddingVertical: 12, paddingHorizontal: 16,
                          borderTopWidth: i === 0 ? 0 : 1, borderTopColor: DIVIDER,
                        }}
                      >
                        <View style={{
                          width: 40, height: 40, borderRadius: 12,
                          backgroundColor: biz ? '#3b82f622' : RED + '18',
                          alignItems: 'center', justifyContent: 'center', marginRight: 12,
                        }}>
                          <Text style={{ fontSize: 18 }}>{biz ? '💼' : groupEmoji(g)}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: TEXT, fontSize: 14, fontWeight: '700' }} numberOfLines={1}>
                            {title}
                            {biz ? <Text style={{ color: '#3b82f6', fontWeight: '700' }}>  💼 Business</Text> : null}
                          </Text>
                          <Text style={{ color: LABEL, fontSize: 11, marginTop: 1 }} numberOfLines={1}>
                            {when.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            {' · '}
                            {when.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                          </Text>
                          {e.note ? (
                            <Text style={{ color: MUTED, fontSize: 11, marginTop: 2, fontStyle: 'italic' }} numberOfLines={1}>
                              {e.note}
                            </Text>
                          ) : null}
                        </View>
                        <Text style={{ color: RED, fontSize: 15, fontWeight: '800' }}>
                          {hidden ? MASK : `-${money(Number(e.amount))}`}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

export default function DashboardScreen() {
  const {
    BG, SURFACE, CARD_BG, CARD, BORDER, PRIMARY, PRIMARY_TXT, ACCENT, PRI_LITE, PRI_DARK,
    TEXT, TEXT_MID, MUTED, LABEL, DIM, GREEN, GREEN_LT, RED, RED_LT, DIVIDER, ON_PRIMARY,
  } = useTheme();
  const { hidden, toggle: toggleHidden } = useHiddenMode();
  const { themeName, setThemeName } = useThemeControls();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<Period>('today');
  const [refreshing, setRefreshing] = useState(false);
  // Inline drill-down: tap the EXPENSES KPI to expand an itemized list of the
  // current period's outflows right under the stats row (tap again to collapse).
  const [expensesExpanded, setExpensesExpanded] = useState(false);

  // ── Scroll-to-Top floating button ─────────────────────────────────────
  // Ref to the main History/dashboard ScrollView so the FAB can animate it
  // back to the top. `showScrollTop` only flips when the scroll offset crosses
  // the threshold (returning prev when unchanged lets React bail out of a
  // re-render on every scroll frame). A reanimated shared value drives the
  // fade/scale in-out so the heavy Dashboard tree isn't re-rendered per frame.
  const scrollRef = useRef<ScrollView>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const fabAnim = useSharedValue(0);
  const onHistoryScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const next = y > 400;
    setShowScrollTop(prev => (prev === next ? prev : next));
  }, []);
  useEffect(() => {
    fabAnim.value = withTiming(showScrollTop ? 1 : 0, { duration: 200, easing: Easing.out(Easing.quad) });
  }, [showScrollTop, fabAnim]);
  const fabStyle = useAnimatedStyle(() => ({
    opacity: fabAnim.value,
    transform: [
      { scale: 0.7 + fabAnim.value * 0.3 },
      { translateY: (1 - fabAnim.value) * 10 },
    ],
  }));
  const scrollToTop = useCallback(() => {
    hTap();
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, []);

  const [showAdd, setShowAdd] = useState(false);
  const [addPrefill, setAddPrefill] = useState<AddEntryPrefill | undefined>(undefined);
  const [showSettings, setShowSettings] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showExpenses, setShowExpenses] = useState(false);

  // History list multi-select state. `selectionMode` toggles the row UI into
  // checkbox-mode; `selectedIds` is the set of currently-selected entry IDs.
  // `editingEntry` opens AddEntryModal in edit mode when non-null.
  const [selectionMode, setSelectionMode] = useState(false);
  const [detailEntry, setDetailEntry] = useState<Entry | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [exportingSel, setExportingSel] = useState(false);
  const [editingEntry, setEditingEntry] = useState<Entry | undefined>(undefined);
  const toggleSelect = useCallback((id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);
  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  // Watch for `?openEntry=1[&type=…&amount=…]` from the iOS widget deep link.
  // Open the AddEntry modal with prefill, then immediately strip the params
  // so the modal doesn't reopen on subsequent navigations.
  const searchParams = useLocalSearchParams<{ openEntry?: string; type?: string; amount?: string }>();
  useEffect(() => {
    if (searchParams.openEntry === '1') {
      const t = searchParams.type === 'EXPENSE' ? 'EXPENSE' : searchParams.type === 'REVENUE' ? 'REVENUE' : undefined;
      setAddPrefill({ type: t, amount: searchParams.amount });
      setShowAdd(true);
      router.setParams({ openEntry: undefined, type: undefined, amount: undefined } as never);
    }
  }, [searchParams.openEntry, searchParams.type, searchParams.amount]);
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState('');
  const [showAllEntries, setShowAllEntries] = useState(false);
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  // Transaction sort order for the History list. Defaults to newest-first
  // (the order the backend already returns). `showSortMenu` toggles the
  // bottom-sheet picker.
  const [sortBy, setSortBy] = useState<SortKey>('newest');
  const [showSortMenu, setShowSortMenu] = useState(false);
  // Clear the query whenever the search bar closes. Decoupled from the tap
  // handler so the toggle stays a pure functional update — no side effects
  // inside the setState updater (avoids React 19 strict-mode double-fire).
  useEffect(() => {
    if (!showSearchBar && searchQuery) setSearchQuery('');
  }, [showSearchBar]); // eslint-disable-line react-hooks/exhaustive-deps
  const [showCalendar, setShowCalendar] = useState(false);
  // When the user picks a range from the calendar, period === 'custom' and this
  // holds the YYYY-MM-DD bounds (inclusive, EST).
  const [customRange, setCustomRange] = useState<{ from: string; to: string } | null>(null);
  // Swipe navigation offset. 0 = the live, current window for the selected chip.
  // Steps by the chip's natural unit: ±1 day for Today/Yesterday, ±1 week for
  // This Week / Last 7 Days, ±1 calendar month for This Month / Last Month.
  // Reset to 0 whenever the user switches chips. Unused for the custom range.
  const [navOffset, setNavOffset] = useState(0);

  const tf = period === 'custom'
    ? 'TODAY' // unused — but keeps query keys typed cleanly
    : PERIODS.find(p => p.key === period)!.tf;

  // Day-granular periods navigate via the backend's day_offset param (only valid
  // for the TODAY timeframe). Today: offset N → day_offset N. Yesterday: the live
  // window is already -1, so offset N → day_offset N-1.
  const isDayPeriod = period === 'today' || period === 'yesterday';
  const dayApiOffset = period === 'today' ? navOffset
    : period === 'yesterday' ? navOffset - 1
    : 0;

  // Aggregate periods (week/month) at a non-zero offset resolve to an explicit
  // EST date range queried via the range endpoints. null → use the timeframe path
  // (offset 0, day-periods, or custom), which preserves goal semantics.
  const navRange = navRangeFor(period, navOffset);

  // effectiveDayOffset stays the single-day offset actually shown (used by the
  // widget-sync "is this really today?" guard and the chart's hourly view).
  const effectiveDayOffset = isDayPeriod ? dayApiOffset : 0;

  // Default date for NEW entries added while viewing a PAST day (offset < 0 =>
  // yesterday/back). File a new entry under the EST calendar day the user is
  // looking at. We shift the EST calendar date (not the absolute instant) by the
  // offset and anchor to 16:00 UTC — that lands at 11:00 EST / 12:00 EDT, firmly
  // mid-day either way, so easternDateTime always reports the intended EST date.
  // (Naive `now + offset*86_400_000` drifts a day near EST midnight on DST
  // transition days, e.g. the 23h spring-forward day.) Today (0) or aggregate
  // periods => undefined (use live now).
  const addEntryDefaultDate = useMemo(() => {
    if (!(isDayPeriod && effectiveDayOffset < 0)) return undefined;
    const { date } = easternDateTime(new Date());
    const [y, m, d] = date.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d + effectiveDayOffset, 16, 0, 0));
  }, [isDayPeriod, effectiveDayOffset]);

  // Which period tab to HIGHLIGHT. Data is always driven by `period`; when swiping
  // through individual days we keep showing that single day's numbers but move the
  // highlighted tab to reflect how far back the viewed day is (calendar-based).
  // For aggregate/custom periods the highlight is just the active period itself.
  const displayChip: Period = isDayPeriod ? dayOffsetToChip(effectiveDayOffset) : period;

  // Canonical day offset (0 = today, -1 = yesterday, …) kept in a ref so the
  // swipe/chevron handler can step it synchronously. This makes rapid repeated
  // taps that cross the Today↔Yesterday boundary accumulate correctly instead
  // of dropping steps to a stale `period`/`navOffset` closure. Re-synced after
  // every commit (covers chip taps, which set period/navOffset directly).
  const dayOffsetRef = useRef(0);
  useEffect(() => {
    dayOffsetRef.current = isDayPeriod ? dayApiOffset : 0;
  }, [isDayPeriod, dayApiOffset]);

  // Day-periods (today/yesterday, any swipe offset) share the single daily goal
  // (the TODAY goal target), so the goal bar is consistent whether you reach a
  // given day via the Today chip swiped back or the Yesterday chip. Aggregate
  // periods keep their own weekly/monthly goal. Read + edit use the same key.
  const goalTf = isDayPeriod ? 'TODAY' : tf;

  // Stable cache keys: custom range, nav range (aggregate offset), or the plain
  // timeframe+day_offset path. Each distinct window gets its own cache slot.
  const rollupKey  = period === 'custom'
    ? ['rollup', 'custom', customRange?.from, customRange?.to]
    : navRange
    ? ['rollup', tf, 'nav', navRange.from, navRange.to]
    : ['rollup', isDayPeriod ? 'TODAY' : tf, effectiveDayOffset];
  const entriesKey = period === 'custom'
    ? ['entries', 'custom', customRange?.from, customRange?.to]
    : navRange
    ? ['entries', tf, 'nav', navRange.from, navRange.to]
    : ['entries', isDayPeriod ? 'TODAY' : tf, effectiveDayOffset];

  const { data: rollup, isLoading: rollupLoading } = useQuery({
    queryKey: rollupKey,
    queryFn: () => period === 'custom' && customRange
      ? api.getRollupInRange(customRange.from, customRange.to)
      : navRange
      ? api.getRollupInRange(navRange.from, navRange.to)
      : api.getRollup(isDayPeriod ? 'TODAY' : tf, effectiveDayOffset),
    enabled: period !== 'custom' || !!customRange,
  });

  const { data: entries = [] } = useQuery({
    queryKey: entriesKey,
    queryFn: () => period === 'custom' && customRange
      ? api.getEntriesInRange(customRange.from, customRange.to)
      : navRange
      ? api.getEntriesInRange(navRange.from, navRange.to)
      : api.getEntries(isDayPeriod ? 'TODAY' : tf, 200, effectiveDayOffset),
    enabled: period !== 'custom' || !!customRange,
  });

  // Goals only exist for the fixed timeframes — disable the goal query in custom mode.
  const { data: goal, refetch: refetchGoal } = useQuery({
    queryKey: ['goal', goalTf],
    queryFn: () => api.getGoal(goalTf),
    enabled: period !== 'custom',
  });

  // ── Oil Change Alert ──────────────────────────────────────────────────────
  // All-time cumulative miles drive the reminder. The upper bound is "now" so
  // FUTURE-dated entries (the date picker allows up to +24h) don't count miles
  // that haven't been driven yet. The cache key is bucketed to the hour so it
  // stays stable (no per-render refetch) while still advancing over time; the
  // queryFn reads the live `now` on each (re)fetch. The key starts with
  // 'rollup', so every entry add/edit/delete (which invalidates ['rollup'])
  // refetches it too. Miles (not $) so the banner stays visible under Hidden Mode.
  const nowHourKey = new Date().toISOString().slice(0, 13); // YYYY-MM-DDTHH (UTC)
  const { data: allTimeRollup } = useQuery({
    queryKey: ['rollup', 'alltime', nowHourKey],
    queryFn: () => api.getRollupInRange('2000-01-01T00:00:00Z', new Date().toISOString()),
    staleTime: 60_000,
  });
  const totalMiles = allTimeRollup?.miles ?? 0;
  const oilChange = useOilChange(totalMiles);

  // ── Optimistic delete plumbing (shared by single / multi-select / calendar) ──
  // Deleting an entry must IMMEDIATELY reset the dashboard KPIs and the goal
  // progress bar to reflect the remaining entries — without waiting for the
  // network round-trip. The goal % is derived from `rollup.profit`
  // (rawGoalPct = profit / target), so the key move is patching `profit` in the
  // cached rollup the instant a row is removed. That also drives the negative
  // case: when the remaining profit drops below 0, `isGoalLoss` flips and the
  // bar switches to the empty red-pulse state. Snapshots are kept for rollback
  // and the server is invalidated afterwards to converge on the truth.
  type DeleteCtx = {
    prevRollup: Array<[readonly unknown[], Rollup | undefined]>;
    prevEntries: Array<[readonly unknown[], Entry[] | undefined]>;
  };

  const optimisticRemove = useCallback(async (ids: number[]): Promise<DeleteCtx> => {
    await queryClient.cancelQueries({ queryKey: ['rollup'] });
    await queryClient.cancelQueries({ queryKey: ['entries'] });
    // Snapshot ALL rollup/entries caches for an exact rollback, but only PATCH
    // the ACTIVE period's rollup. The deleted rows belong to the list the user
    // is deleting from (the active entries cache), so applying the delta to the
    // active rollup is correct; applying it to every cached window (TODAY/WEEK/
    // MONTH/dayOffset/custom) could write wrong values into windows that don't
    // contain these rows. The reconcile invalidation below refreshes the rest.
    const prevRollup  = queryClient.getQueriesData<Rollup>({ queryKey: ['rollup'] });
    const prevEntries = queryClient.getQueriesData<Entry[]>({ queryKey: ['entries'] });
    const idSet = new Set(ids);

    // The rows being deleted, taken from the active entries cache. If NONE of
    // the deleted ids are in the active period (e.g. a calendar delete of an
    // out-of-period row), we leave the active rollup untouched and let the
    // reconcile refetch handle it — patching here would recompute values from a
    // 200-row-capped cache and introduce drift for a window that didn't change.
    const activeEntries = queryClient.getQueryData<Entry[]>(entriesKey) ?? [];
    const removed = activeEntries.filter(e => idSet.has(e.id));

    if (removed.length > 0) {
      // Sum the removed rows' contribution. Amount is SIGNED (expenses /
      // cancellations are negative), so key off the sign rather than the type:
      // amount >= 0 reduces revenue, amount < 0 reduces expenses.
      let dRevenue = 0, dExpenses = 0, dMiles = 0, dHours = 0;
      for (const e of removed) {
        const amt = Number(e.amount) || 0;
        if (amt >= 0) dRevenue += amt; else dExpenses += Math.abs(amt);
        dMiles += Number(e.distance_miles) || 0;
        dHours += (Number(e.duration_minutes) || 0) / 60;
      }

      // average_order_value mirrors the backend: sum of ORDER-type amounts
      // divided by the ORDER-type count (NOT all positive rows — BONUS is
      // excluded). Recompute from the entries that REMAIN in the active period.
      const remainingOrders = activeEntries.filter(e => !idSet.has(e.id) && e.type === 'ORDER');
      const remainingOrderRevenue = remainingOrders.reduce((s, e) => s + (Number(e.amount) || 0), 0);
      const remainingOrderCount = remainingOrders.length;

      queryClient.setQueryData<Rollup>(rollupKey, (old) => {
        if (!old) return old;
        const revenue  = old.revenue  - dRevenue;
        const expenses = old.expenses - dExpenses;
        const profit   = revenue - expenses;
        const miles    = old.miles - dMiles;
        const hours    = old.hours - dHours;
        return {
          ...old,
          revenue,
          expenses,
          profit,
          miles,
          hours,
          dollars_per_mile: miles > 0 ? profit / miles : 0,
          average_order_value: remainingOrderCount > 0 ? remainingOrderRevenue / remainingOrderCount : 0,
          goal_progress: old.goal?.target_profit
            ? profit / old.goal.target_profit
            : old.goal_progress ?? null,
        };
      });
    }

    // Removing rows by id from EVERY entries cache is always safe — a row only
    // lives in caches whose window contains it — so the History list stays in
    // sync regardless of which period view is mounted.
    queryClient.setQueriesData<Entry[]>({ queryKey: ['entries'] }, (old) =>
      Array.isArray(old) ? old.filter(e => !idSet.has(e.id)) : old,
    );

    return { prevRollup, prevEntries };
  }, [queryClient, rollupKey, entriesKey]);

  const rollbackRemove = useCallback((ctx?: DeleteCtx) => {
    if (!ctx) return;
    for (const [key, data] of ctx.prevRollup)  queryClient.setQueryData(key, data);
    for (const [key, data] of ctx.prevEntries) queryClient.setQueryData(key, data);
  }, [queryClient]);

  // Reconcile every dashboard-feeding cache with the server after a delete.
  const reconcileAfterDelete = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['entries'] });
    queryClient.invalidateQueries({ queryKey: ['rollup'] });
    queryClient.invalidateQueries({ queryKey: ['goal'] });
    queryClient.invalidateQueries({ queryKey: ['entries-range'] });
    // Analytics modal uses its own cache keys — invalidate them so a delete
    // (single / bulk / calendar erase) is reflected when Analytics reopens.
    queryClient.invalidateQueries({ queryKey: ['analytics-rollup'] });
    queryClient.invalidateQueries({ queryKey: ['analytics-entries'] });
  }, [queryClient]);

  const deleteMutation = useMutation({
    mutationFn: api.deleteEntry,
    onMutate: (id: number) => optimisticRemove([id]),
    onError: (_e, _id, ctx) => {
      rollbackRemove(ctx);
      reconcileAfterDelete();
      Alert.alert('Error', 'Failed to delete entry.');
    },
    onSuccess: () => { reconcileAfterDelete(); },
  });

  // Bulk delete — fires DELETE requests in parallel, then invalidates once
  // at the end so the list re-renders a single time. The backend has no
  // batch endpoint, so this is just Promise.allSettled over the per-id
  // delete. Failures are surfaced as a count in an Alert. The optimistic patch
  // removes ALL ids up front; if some deletes fail, the reconcile refetch
  // brings the surviving rows (and their KPI contribution) back.
  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      const results = await Promise.allSettled(ids.map(id => api.deleteEntry(id)));
      const failed = results.filter(r => r.status === 'rejected').length;
      return { total: ids.length, failed };
    },
    onMutate: (ids: number[]) => optimisticRemove(ids),
    onSuccess: ({ total, failed }) => {
      reconcileAfterDelete();
      exitSelectionMode();
      if (failed > 0) {
        Alert.alert('Partial delete', `Deleted ${total - failed} of ${total}. ${failed} failed.`);
      } else {
        hNotifyOk();
      }
    },
    onError: (_e, _ids, ctx) => {
      rollbackRemove(ctx);
      reconcileAfterDelete();
      Alert.alert('Error', 'Bulk delete failed.');
    },
  });

  const upsertGoalMutation = useMutation({
    mutationFn: ({ target }: { target: number }) => api.upsertGoal(goalTf, target),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goal'] });
      refetchGoal();
      setEditingGoal(false);
      hNotifyOk();
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['rollup'] }),
      queryClient.invalidateQueries({ queryKey: ['entries'] }),
      queryClient.invalidateQueries({ queryKey: ['goal'] }),
    ]);
    setRefreshing(false);
  }, [queryClient]);

  const n = (v: unknown) => Number(v) || 0;
  const profit    = n(rollup?.profit);
  const revenue   = n(rollup?.revenue);
  const expenses  = n(rollup?.expenses);
  const miles     = n(rollup?.miles);
  const perMile   = n(rollup?.dollars_per_mile);
  const avgOrder  = n(rollup?.average_order_value);

  // Itemized outflows for the current period (EXPENSE + CANCELLATION, stored as
  // negative amounts), most-recent first — powers the inline expandable list
  // under the EXPENSES KPI. Reconciles with the EXPENSES KPI (rollup.expenses).
  const periodExpenses = useMemo(
    () => (entries ?? [])
      .filter(e => Number(e.amount) < 0)
      .sort((a, b) => parseServerDate(b.timestamp).getTime() - parseServerDate(a.timestamp).getTime()),
    [entries],
  );

  // Push today's net profit AND gross revenue to the iOS widget whenever we're
  // actually viewing today (period === 'today' && dayOffset === 0). Other
  // periods would lie to the widget about "today".
  useEffect(() => {
    if (period === 'today' && effectiveDayOffset === 0 && rollup) {
      widgetSync.pushProfit(profit);
      widgetSync.pushRevenue(revenue);
    }
  }, [profit, revenue, period, effectiveDayOffset, rollup]);
  const rawGoal   = goal?.target_profit;
  const goalTarget = (rawGoal !== undefined && rawGoal !== null) ? Number(rawGoal) || null : null;
  // Filter entries by search query (matches app label, type, category, note, amount)
  const q = searchQuery.trim().toLowerCase();
  const isSearching = q !== '';
  const filteredEntries = !isSearching
    ? entries
    : entries.filter(e => {
        const amt = Number(e.amount);
        const fields = [
          e.app,
          APP_LABELS[e.app] ?? '',
          e.type,
          e.category ?? '',
          e.note ?? '',
          String(e.amount),
          amt.toFixed(2),
          `$${amt.toFixed(2)}`,
        ].join(' ').toLowerCase();
        return fields.includes(q);
      });
  // Sort the (already search-filtered) entries. Sorting is applied after
  // filtering so search + sort compose, and counts/totals stay correct
  // (sorting never changes the set, only the order).
  const sortedEntries = useMemo(() => {
    const arr = [...filteredEntries];
    switch (sortBy) {
      case 'oldest':
        arr.sort((a, b) => parseServerDate(a.timestamp).getTime() - parseServerDate(b.timestamp).getTime());
        break;
      case 'highest':
        arr.sort((a, b) => Number(b.amount) - Number(a.amount));
        break;
      case 'lowest':
        arr.sort((a, b) => Number(a.amount) - Number(b.amount));
        break;
      case 'platform':
        arr.sort((a, b) => {
          const la = (APP_LABELS[a.app] ?? a.app).toLowerCase();
          const lb = (APP_LABELS[b.app] ?? b.app).toLowerCase();
          if (la !== lb) return la < lb ? -1 : 1;
          // Tie-break alphabetical platforms by newest-first.
          return parseServerDate(b.timestamp).getTime() - parseServerDate(a.timestamp).getTime();
        });
        break;
      case 'newest':
      default:
        arr.sort((a, b) => parseServerDate(b.timestamp).getTime() - parseServerDate(a.timestamp).getTime());
        break;
    }
    return arr;
  }, [filteredEntries, sortBy]);
  const displayedEntries = showAllEntries ? sortedEntries : sortedEntries.slice(0, 8);

  // Safety: whenever the currently-visible entry set changes (period switch,
  // day swipe, search filter, custom-range pick), prune `selectedIds` to the
  // intersection of what's actually shown. Keyed to `filteredEntries` (the
  // search-filtered set) so refining a search can't leave hidden rows
  // selected — bulk-delete operates on `selectedIds`, so we must never retain
  // an id the user can no longer see. Sorting doesn't change membership, so
  // it isn't a dependency. We don't auto-exit selection mode, because the
  // user may genuinely want to keep selecting across a search refinement.
  useEffect(() => {
    if (!selectionMode || selectedIds.size === 0) return;
    const visibleIds = new Set(filteredEntries.map(e => e.id));
    let changed = false;
    const next = new Set<number>();
    selectedIds.forEach(id => {
      if (visibleIds.has(id)) next.add(id); else changed = true;
    });
    if (changed) setSelectedIds(next);
  }, [filteredEntries, selectionMode]); // eslint-disable-line react-hooks/exhaustive-deps

  const orderCount = entries.filter(e => Number(e.amount) > 0).length;

  const isProfit   = profit >= 0;
  const profitColor = isProfit ? GREEN : RED;
  const profitBg    = isProfit ? GREEN_LT : RED_LT;

  // Goal progress. Clamp to [0, 100]: a negative profit is rendered as an
  // empty bar (with a red pulse — see GoalProgressBar) rather than a
  // negative-width fill, which RN would error on anyway.
  const safeGoal  = goalTarget ? Number(goalTarget) : 0;
  const rawGoalPct = safeGoal > 0 ? (profit / safeGoal) * 100 : 0;
  const goalPct   = Math.max(0, Math.min(rawGoalPct, 100));
  const isGoalLoss = safeGoal > 0 && profit < 0;
  const goalColor = goalPct >= 100 ? GREEN : PRIMARY;

  // Period label for the date bar. Day-periods show the actual weekday/date being
  // viewed (e.g. "Yesterday • Apr 29"); a navigated aggregate window shows its
  // date span (e.g. "Apr 21 – Apr 27"); the live window shows the chip label.
  const navActive = period !== 'custom';
  const dateLabelForOffset = (off: number) => {
    const d = new Date();
    d.setDate(d.getDate() + off);
    const md = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (off === 0)  return `Today • ${md}`;
    if (off === -1) return `Yesterday • ${md}`;
    if (off === 1)  return `Tomorrow • ${md}`;
    const wd = d.toLocaleDateString('en-US', { weekday: 'short' });
    return `${wd}, ${md}`;
  };
  const periodLabel = period === 'custom'
    ? `${PERIOD_LABELS[period]} earnings`
    : isDayPeriod
    ? dateLabelForOffset(dayApiOffset)
    : navRange
    ? `${formatShortDate(navRange.from)} – ${formatShortDate(navRange.to)}`
    : `${PERIOD_LABELS[period]} earnings`;

  // ── Swipe-to-navigate gesture ────────────────────────────────────────────
  // Swipe LEFT  → forward in time (offset + 1: later day / next week / next month)
  // Swipe RIGHT → back in time    (offset - 1: earlier day / prev week / prev month)
  // Threshold: |dx| > 50 AND |dx| > |dy|. Disabled only on the custom range.
  // cardShift drives a brief slide so the hero card feels like it moves with the
  // swipe while the KPIs/Goal bar recompute for the new window.
  const cardShift = useSharedValue(0);
  const cardSlideStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: cardShift.value }],
  }));
  const goToOffset = useCallback((delta: number) => {
    if (isDayPeriod) {
      // For day-periods, the canonical day shown (0 = today, -1 = yesterday, …)
      // is independent of which chip is active. Step it by `delta` (via a ref so
      // rapid taps accumulate). The DATA period stays today/yesterday (offset >= 0
      // → today/navOffset; < 0 → yesterday/navOffset+1) so the day_offset — and
      // therefore the cache key + daily goal — is identical regardless of which
      // chip we arrive through. The HIGHLIGHTED tab is derived separately from the
      // single-day offset via `displayChip`/`dayOffsetToChip` (Today → Yesterday →
      // This Week → This Month by EST calendar) so it tracks how far back you've
      // swiped while the numbers stay on that one day.
      const nextDayOffset = dayOffsetRef.current + delta;
      dayOffsetRef.current = nextDayOffset;
      if (nextDayOffset >= 0) {
        setPeriod('today');
        setNavOffset(nextDayOffset);
      } else {
        setPeriod('yesterday');
        setNavOffset(nextDayOffset + 1);
      }
    } else {
      setNavOffset(prev => prev + delta);
    }
    cardShift.value = delta > 0 ? 28 : -28;
    cardShift.value = withTiming(0, { duration: 240 });
    hTap();
  }, [cardShift, isDayPeriod]);
  const swipeGesture = Gesture.Pan()
    .enabled(navActive)
    .activeOffsetX([-15, 15])
    .failOffsetY([-20, 20])
    .onEnd((e) => {
      'worklet';
      const dx = e.translationX;
      const dy = e.translationY;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
        runOnJS(goToOffset)(dx < 0 ? 1 : -1);
      }
    });

  // ── Hero metric toggle (tap small number to swap with big number) ──
  const [heroMetric, setHeroMetric] = useState<'profit' | 'revenue'>('profit');
  const isProfitHero = heroMetric === 'profit';
  const heroValue   = isProfitHero ? profit  : revenue;
  const heroLabel   = isProfitHero ? 'NET PROFIT' : 'REVENUE';
  const heroColor   = isProfitHero ? profitColor : GREEN;
  const altValue    = isProfitHero ? revenue : profit;
  const altLabel    = isProfitHero ? 'Revenue' : 'Net Profit';

  // ── Animations ──
  const profitPopStyle = usePopOnChange(Math.round(heroValue * 100));   // pop on any cent change
  const ninjaGlowStyle = useMilestoneGlow(profit);                      // logo halo at $50/$100/...

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <ScrollView
        ref={scrollRef}
        onScroll={onHistoryScroll}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PRIMARY} />}
        contentContainerStyle={{ paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ────────────────────────────────────────────────────────── */}
        <View style={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 16,
          paddingBottom: 12,
          backgroundColor: SURFACE,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottomWidth: 1,
          borderBottomColor: BORDER,
        }}>
          {/* Left title block: shrinkable so it never pushes the right icons
              off-screen on 320dp-class phones. minWidth:0 lets flex actually
              shrink the inner Text; numberOfLines+adjustsFontSizeToFit caps it. */}
          <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10, marginRight: 8 }}>
            <Animated.View style={[{ borderRadius: 18 }, ninjaGlowStyle]}>
              <Image
                source={require('../../assets/ninja-logo.png')}
                style={{ width: 36, height: 36, resizeMode: 'contain' }}
              />
            </Animated.View>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
              style={{ flexShrink: 1, fontSize: 18, fontWeight: '900', letterSpacing: 0.3, color: TEXT }}
            >
              EARNINGS{' '}
              <Text style={{ color: PRIMARY_TXT }}>NINJA</Text>
            </Text>
          </View>
          {/* Right icon group: fixed-size, never shrinks, always visible. */}
          <View style={{ flexDirection: 'row', gap: 8, flexShrink: 0 }}>
            <PressScale
              hitSlop={8}
              onPress={() => {
                hTap();
                // Functional updater is closure-safe under rapid taps. The
                // searchQuery clear runs in an effect below — keeping side
                // effects out of the updater avoids React 19 double-fire.
                setShowSearchBar(prev => !prev);
              }}
              style={{
                width: 36, height: 36, borderRadius: 10,
                backgroundColor: showSearchBar ? PRIMARY : BG,
                borderWidth: 1, borderColor: showSearchBar ? PRIMARY : BORDER,
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Ionicons
                name={showSearchBar ? 'close' : 'search'}
                size={17}
                color={showSearchBar ? ON_PRIMARY : MUTED}
              />
            </PressScale>
            <PressScale
              hitSlop={8}
              onPress={() => { hTap(); setShowCalendar(true); }}
              style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: BG, borderWidth: 1, borderColor: BORDER, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="calendar-outline" size={17} color={MUTED} />
            </PressScale>
            <PressScale
              hitSlop={8}
              onPress={() => { hTap(); toggleHidden(); }}
              style={[
                {
                  width: 36, height: 36, borderRadius: 10,
                  backgroundColor: hidden ? PRIMARY : BG,
                  borderWidth: 1, borderColor: hidden ? PRIMARY : BORDER,
                  alignItems: 'center', justifyContent: 'center',
                },
                hidden ? neonGlow(PRIMARY, 8, 0.45) : undefined,
              ].filter(Boolean) as ViewStyle[]}
            >
              <Ionicons name={hidden ? 'eye-off' : 'eye'} size={17} color={hidden ? ON_PRIMARY : MUTED} />
            </PressScale>
            <PressScale
              hitSlop={8}
              onPress={() => { hTap(); setThemeName(themeName === 'dark' ? 'light' : 'dark'); }}
              style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: BG, borderWidth: 1, borderColor: BORDER, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name={themeName === 'dark' ? 'sunny' : 'moon'} size={17} color={MUTED} />
            </PressScale>
            <PressScale
              hitSlop={8}
              onPress={() => { hTap(); setShowSettings(true); }}
              style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: BG, borderWidth: 1, borderColor: BORDER, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="settings-outline" size={17} color={MUTED} />
            </PressScale>
          </View>
        </View>

        {/* ── Numbers Hidden banner ─────────────────────────────────────────── */}
        {hidden && (
          <View style={[
            {
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
              backgroundColor: PRI_LITE, borderBottomWidth: 1, borderBottomColor: PRIMARY + '55',
              paddingVertical: 8, paddingHorizontal: 16,
            },
          ]}>
            <Ionicons name="eye-off" size={14} color={PRIMARY_TXT} />
            <Text style={{ color: PRIMARY_TXT, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 }}>
              Numbers Hidden — tap the eye to show
            </Text>
          </View>
        )}

        {/* ── Oil Change Alert ──────────────────────────────────────────────── */}
        {/* Prominent amber banner once cumulative miles cross the interval.
            Self-contained colors so it reads on every theme. "Reset" re-baselines
            to the current mileage (logged the change), dismissing it until the
            next interval accrues. */}
        {oilChange.due && (
          <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
            <View style={[
              {
                flexDirection: 'row', alignItems: 'center', gap: 12,
                backgroundColor: '#f59e0b', borderRadius: 16, padding: 14,
              },
              neonGlow('#f59e0b', 12, 0.45),
            ]}>
              <Text style={{ fontSize: 28 }}>🛢️</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#1c1917', fontSize: 15, fontWeight: '900', letterSpacing: 0.2 }}>
                  Time for Oil Change
                </Text>
                <Text style={{ color: '#451a03', fontSize: 12, fontWeight: '700', marginTop: 2 }}>
                  {Math.round(oilChange.milesSince).toLocaleString()} mi since your last change
                </Text>
              </View>
              <PressScale
                onPress={() => { hNotifyOk(); oilChange.reset(); }}
                scale={0.92}
                style={{
                  backgroundColor: '#1c1917', borderRadius: 10,
                  paddingHorizontal: 16, paddingVertical: 10,
                }}
              >
                <Text style={{ color: '#fbbf24', fontWeight: '800', fontSize: 13 }}>Reset</Text>
              </PressScale>
            </View>
          </View>
        )}

        {/* ── Period Tabs ───────────────────────────────────────────────────── */}
        <View style={{ backgroundColor: SURFACE, borderBottomWidth: 1, borderBottomColor: BORDER }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, gap: 6, flexDirection: 'row' }}>
            {PERIODS.map(p => {
              const active = displayChip === p.key;
              return (
                <PressScale
                  key={p.key}
                  onPress={() => { hTap(); setPeriod(p.key); setNavOffset(0); }}
                  scale={0.92}
                  style={[
                    {
                      paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20,
                      backgroundColor: active ? PRIMARY : 'transparent',
                      borderWidth: 1, borderColor: active ? PRIMARY : BORDER,
                    },
                    active ? neonGlow(PRIMARY, 5, 0.18) : undefined,
                  ].filter(Boolean) as ViewStyle[]}
                >
                  <Text style={{
                    color: active ? ON_PRIMARY : MUTED,
                    fontSize: 13, fontWeight: active ? '800' : '500',
                  }}>
                    {p.label}
                  </Text>
                </PressScale>
              );
            })}
            {/* Custom Range chip — only shown after the user picks a range from the calendar. */}
            {customRange && (
              <PressScale
                onPress={() => { hTap(); setPeriod('custom'); setNavOffset(0); }}
                scale={0.92}
                style={[
                  {
                    flexDirection: 'row', alignItems: 'center', gap: 6,
                    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
                    backgroundColor: period === 'custom' ? PRIMARY : 'transparent',
                    borderWidth: 1, borderColor: period === 'custom' ? PRIMARY : BORDER,
                  },
                  period === 'custom' ? neonGlow(PRIMARY, 5, 0.18) : undefined,
                ].filter(Boolean) as ViewStyle[]}
              >
                <Ionicons
                  name="calendar"
                  size={12}
                  color={period === 'custom' ? ON_PRIMARY : MUTED}
                />
                <Text style={{
                  color: period === 'custom' ? ON_PRIMARY : MUTED,
                  fontSize: 13, fontWeight: period === 'custom' ? '800' : '500',
                }}>
                  {customRange.from === customRange.to
                    ? formatShortDate(customRange.from)
                    : `${formatShortDate(customRange.from)} – ${formatShortDate(customRange.to)}`}
                </Text>
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation?.();
                    hTap();
                    setCustomRange(null);
                    if (period === 'custom') { setPeriod('today'); setNavOffset(0); }
                  }}
                  hitSlop={8}
                  style={{ marginLeft: 2 }}
                >
                  <Ionicons
                    name="close"
                    size={13}
                    color={period === 'custom' ? ON_PRIMARY : MUTED}
                  />
                </Pressable>
              </PressScale>
            )}
          </ScrollView>
        </View>

        {/* ── Search Bar (collapsible) ──────────────────────────────────────── */}
        {showSearchBar && (
          <View style={{
            backgroundColor: SURFACE,
            borderBottomWidth: 1,
            borderBottomColor: BORDER,
            paddingHorizontal: 16,
            paddingVertical: 10,
          }}>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: BG,
              borderWidth: 1,
              borderColor: PRIMARY,
              borderRadius: 12,
              paddingHorizontal: 12,
              paddingVertical: 10,
              gap: 10,
              ...neonGlow(PRIMARY, 6, 0.25),
            }}>
              <Ionicons name="search" size={18} color={PRIMARY_TXT} />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search by app, type, category, note, or amount…"
                placeholderTextColor={MUTED}
                autoFocus
                returnKeyType="search"
                style={{
                  flex: 1,
                  color: TEXT,
                  fontSize: 14,
                  fontWeight: '600',
                  paddingVertical: 0,
                }}
              />
              {searchQuery.length > 0 && (
                <PressScale
                  onPress={() => { hTap(); setSearchQuery(''); }}
                  style={{ padding: 2 }}
                >
                  <Ionicons name="close-circle" size={18} color={MUTED} />
                </PressScale>
              )}
            </View>
            {q !== '' && (
              <Text style={{
                color: MUTED,
                fontSize: 11,
                fontWeight: '600',
                marginTop: 8,
                marginLeft: 4,
              }}>
                {filteredEntries.length} match{filteredEntries.length === 1 ? '' : 'es'}
              </Text>
            )}
          </View>
        )}

        <View style={{ paddingHorizontal: 16, paddingTop: 14, gap: 12 }}>

          {rollupLoading ? (
            <DashboardSkeleton />
          ) : (
            <>
              {/* ── Main Hero Card with neon glow (toggle Profit↔Revenue) ──── */}
              {/* Horizontal swipe on this card steps the nav offset (± day/week/month). */}
              <GestureDetector gesture={swipeGesture}>
              <Animated.View style={[
                {
                  backgroundColor: SURFACE,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: heroColor + '33',
                  padding: 20,
                },
                neonGlow(heroColor, 14, 0.22),
                profitPopStyle,
                cardSlideStyle,
              ]}>
                {/* Title row: label on the left, tappable alternate metric inline on the right */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <Text style={{ color: LABEL, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5 }}>
                    {heroLabel}
                  </Text>

                  {/* Tappable secondary metric — tap to swap with the big number */}
                  <PressScale
                    onPress={() => { hTap(); setHeroMetric(isProfitHero ? 'revenue' : 'profit'); }}
                    scale={0.96}
                    hitSlop={8}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      paddingVertical: 4,
                      paddingHorizontal: 8,
                      borderRadius: 8,
                      backgroundColor: BG,
                      borderWidth: 1,
                      borderColor: BORDER,
                    }}
                  >
                    <Text style={{ color: MUTED, fontSize: 13, fontWeight: '600' }}>
                      {altLabel}:
                    </Text>
                    <AnimatedNumber
                      value={altValue}
                      format={(n) => (n < 0 ? '-' : '') + '$' + Math.abs(n).toFixed(2)}
                      style={{ color: TEXT, fontSize: 14, fontWeight: '800' }}
                    />
                    <Ionicons name="swap-horizontal" size={14} color={LABEL} />
                  </PressScale>
                </View>

                {/* Big number with count-up */}
                <AnimatedNumber
                  value={heroValue}
                  format={(n) => (n < 0 ? '-' : '') + '$' + Math.abs(n).toFixed(2)}
                  style={{ color: heroColor, fontSize: 48, fontWeight: '900', lineHeight: 56, marginTop: 4 }}
                />

                {/* Date range row — chevrons step the nav offset (back / forward in time). */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 }}>
                  <PressScale
                    onPress={() => goToOffset(-1)}
                    disabled={!navActive}
                    scale={0.85}
                    hitSlop={12}
                    style={{ padding: 4, opacity: navActive ? 1 : 0.35 }}
                  >
                    <Ionicons name="chevron-back" size={18} color={navActive ? PRIMARY : LABEL} />
                  </PressScale>
                  <Text style={{ color: MUTED, fontSize: 13, fontWeight: '500', flex: 1, textAlign: 'center' }}>
                    {periodLabel}
                  </Text>
                  <PressScale
                    onPress={() => goToOffset(1)}
                    disabled={!navActive}
                    scale={0.85}
                    hitSlop={12}
                    style={{ padding: 4, opacity: navActive ? 1 : 0.35 }}
                  >
                    <Ionicons name="chevron-forward" size={18} color={navActive ? PRIMARY : LABEL} />
                  </PressScale>
                </View>

                {/* Profit chart — hourly for single-day views, daily otherwise. A
                    navigated aggregate window renders as a custom daily range. */}
                <ProfitChart
                  entries={entries}
                  period={navRange ? 'custom' : period}
                  customRange={navRange ?? customRange}
                  dayOffset={effectiveDayOffset}
                  positiveColor={GREEN}
                  negativeColor={RED}
                />

                {/* Three stats with count-up */}
                <View style={{ flexDirection: 'row' }}>
                  {[
                    { label: 'EXPENSES',  numeric: Math.abs(expenses), format: (n: number) => `$${Math.round(n)}`, hideable: true, expanded: expensesExpanded, onPress: () => { hTap(); setExpensesExpanded(v => !v); } },
                    { label: 'ORDERS',    numeric: orderCount,         format: (n: number) => `${Math.round(n)}`,  hideable: false },
                    { label: 'AVG ORDER', numeric: avgOrder,           format: (n: number) => `$${Math.round(n)}`, hideable: true },
                  ].map((stat, i) => {
                    const cell = (
                      <>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                          <Text style={{ color: stat.onPress ? PRIMARY : LABEL, fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                            {stat.label}
                          </Text>
                          {stat.onPress && <Ionicons name={stat.expanded ? 'chevron-down' : 'chevron-forward'} size={9} color={PRIMARY_TXT} />}
                        </View>
                        <AnimatedNumber
                          value={stat.numeric}
                          format={stat.format}
                          hideable={stat.hideable}
                          style={{ color: TEXT, fontSize: 18, fontWeight: '800', marginTop: 2 }}
                        />
                      </>
                    );
                    const cellStyle = {
                      flex: 1,
                      alignItems: 'center' as const,
                      borderLeftWidth: i > 0 ? 1 : 0,
                      borderLeftColor: DIVIDER,
                      paddingVertical: 4,
                    };
                    return stat.onPress ? (
                      <PressScale key={stat.label} onPress={stat.onPress} scale={0.95} style={cellStyle}>
                        {cell}
                      </PressScale>
                    ) : (
                      <View key={stat.label} style={cellStyle}>
                        {cell}
                      </View>
                    );
                  })}
                </View>

              </Animated.View>
              </GestureDetector>

              {/* ── Inline expandable EXPENSES drill-down ───────────────────────
                  Tap the EXPENSES KPI above to expand/collapse an itemized list
                  of this period's outflows. Reanimated enter/exit + LinearTransition
                  give a smooth open/close; all colors come from the theme tokens so
                  it stays consistent across Dark/Light. Pure JS → OTA-safe. */}
              {expensesExpanded && (
                <Animated.View
                  entering={FadeInDown.duration(220)}
                  exiting={FadeOutUp.duration(160)}
                  layout={LinearTransition.duration(220)}
                  style={{
                    backgroundColor: SURFACE,
                    borderWidth: 1, borderColor: BORDER, borderRadius: 16,
                    padding: 14, gap: 10,
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ color: LABEL, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 }}>
                      💸 {PERIOD_LABELS[period]} Expenses
                    </Text>
                    <Text style={{ color: RED, fontSize: 13, fontWeight: '800' }}>
                      {hidden ? MASK : `-$${Math.abs(expenses).toFixed(2)}`}
                    </Text>
                  </View>

                  {periodExpenses.length === 0 ? (
                    <Text style={{ color: MUTED, fontSize: 13, paddingVertical: 8, textAlign: 'center' }}>
                      No expenses in this period 🎉
                    </Text>
                  ) : (
                    periodExpenses.map((e, idx) => {
                      const g = outflowGroup(e);
                      const t = parseServerDate(e.timestamp);
                      const when = t.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' });
                      return (
                        <View
                          key={e.id ?? idx}
                          style={{
                            flexDirection: 'row', alignItems: 'center', gap: 10,
                            paddingTop: idx === 0 ? 0 : 8,
                            borderTopWidth: idx === 0 ? 0 : 1, borderTopColor: DIVIDER,
                          }}
                        >
                          <Text style={{ fontSize: 18 }}>{groupEmoji(g)}</Text>
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: TEXT, fontSize: 14, fontWeight: '700' }} numberOfLines={1}>
                              {e.note?.trim() || groupLabel(g)}
                            </Text>
                            <Text style={{ color: MUTED, fontSize: 11, marginTop: 1 }}>
                              {groupLabel(g)} · {when}
                            </Text>
                          </View>
                          <Text style={{ color: RED, fontSize: 14, fontWeight: '800' }}>
                            {hidden ? MASK : `-$${Math.abs(Number(e.amount)).toFixed(2)}`}
                          </Text>
                        </View>
                      );
                    })
                  )}

                  <PressScale
                    onPress={() => { hTap(); setShowExpenses(true); }}
                    scale={0.97}
                    style={{
                      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
                      marginTop: 4, paddingVertical: 8, borderRadius: 10, backgroundColor: BG,
                      borderWidth: 1, borderColor: BORDER,
                    }}
                  >
                    <Text style={{ color: PRIMARY_TXT, fontSize: 12, fontWeight: '800' }}>Filter & view by period</Text>
                    <Ionicons name="open-outline" size={13} color={PRIMARY_TXT} />
                  </PressScale>
                </Animated.View>
              )}

              {/* ── Secondary Stat Cards: $/Mile, Miles (centered row) ──────── */}
              <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'center' }}>
                <View style={{ flex: 1, maxWidth: '48%' }}>
                  <StatCard label="$/Mile" icon="📍" value={`$${perMile.toFixed(2)}`} numericValue={perMile} format={(n) => `$${n.toFixed(2)}`} />
                </View>
                <View style={{ flex: 1, maxWidth: '48%' }}>
                  <StatCard label="Miles"  icon="🚗" value={miles.toFixed(1)}         numericValue={miles}   format={(n) => n.toFixed(1)} hideable={false} />
                </View>
              </View>

              {/* ── Analytics entry point (full-screen modal) ──────────────── */}
              <PressScale
                onPress={() => { hTap(); setShowAnalytics(true); }}
                scale={0.97}
                style={[
                  {
                    flexDirection: 'row', alignItems: 'center', gap: 14,
                    backgroundColor: SURFACE, borderRadius: 16, borderWidth: 1.5, borderColor: PRIMARY,
                    paddingVertical: 16, paddingHorizontal: 16,
                  },
                  neonGlow(PRIMARY, 12, 0.3),
                ]}
              >
                <View style={{
                  width: 40, height: 40, borderRadius: 12,
                  backgroundColor: PRI_LITE, alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ionicons name="stats-chart" size={22} color={PRIMARY_TXT} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: TEXT, fontSize: 16, fontWeight: '800' }}>View Analytics</Text>
                  <Text style={{ color: MUTED, fontSize: 12, marginTop: 2 }}>Spend, miles & top platforms</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={PRIMARY_TXT} />
              </PressScale>

              {/* ── Goals Section (hidden in custom-range mode — goals are tied to fixed timeframes) ──── */}
              {period !== 'custom' && (
              <View>
                <Text style={{ color: LABEL, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 10 }}>
                  GOALS
                </Text>
                {editingGoal ? (
                  <View style={{
                    backgroundColor: SURFACE, borderRadius: 16, borderWidth: 1, borderColor: BORDER,
                    padding: 14, flexDirection: 'row', gap: 8,
                    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3,
                  }}>
                    <TextInput
                      value={goalInput}
                      onChangeText={setGoalInput}
                      placeholder={`${periodLabel} Goal ($)`}
                      placeholderTextColor={LABEL}
                      keyboardType="decimal-pad"
                      autoFocus
                      style={{
                        flex: 1, backgroundColor: BG, borderWidth: 1.5, borderColor: PRIMARY,
                        borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, color: TEXT, fontSize: 16, fontWeight: '700',
                      }}
                    />
                    <Pressable
                      onPress={() => {
                        const val = parseFloat(goalInput);
                        if (!val || val <= 0) return;
                        upsertGoalMutation.mutate({ target: val });
                      }}
                      style={{ backgroundColor: PRIMARY, borderRadius: 10, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Text style={{ color: ON_PRIMARY, fontWeight: '800' }}>Save</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setEditingGoal(false)}
                      style={{ backgroundColor: BG, borderRadius: 10, borderWidth: 1, borderColor: BORDER, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Text style={{ color: MUTED }}>✕</Text>
                    </Pressable>
                  </View>
                ) : (
                  <View style={{
                    backgroundColor: SURFACE, borderRadius: 16, borderWidth: 1, borderColor: BORDER, padding: 16,
                    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3,
                  }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <View>
                        <Text style={{ color: LABEL, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 }}>
                          {periodLabel} Target
                        </Text>
                        <Text style={{
                          color: isGoalLoss ? RED : TEXT,
                          fontSize: 22, fontWeight: '800', marginTop: 2,
                        }}>
                          {safeGoal > 0
                            ? (hidden
                                ? MASK
                                : (isGoalLoss
                                    ? `−$${Math.abs(profit).toFixed(2)} loss / $${safeGoal.toFixed(0)}`
                                    : `$${profit.toFixed(2)} / $${safeGoal.toFixed(0)}`))
                            : 'No goal set'}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        {safeGoal > 0 && (
                          <Text style={{
                            color: isGoalLoss ? RED : goalColor,
                            fontSize: 20, fontWeight: '900',
                          }}>
                            {isGoalLoss ? '0%' : `${Math.round(goalPct)}%`}
                          </Text>
                        )}
                        <Pressable
                          onPress={() => { setGoalInput(goalTarget ? goalTarget.toString() : ''); setEditingGoal(true); }}
                          style={{ marginTop: 4 }}
                        >
                          <Text style={{ color: PRIMARY_TXT, fontSize: 12, fontWeight: '600' }}>
                            {safeGoal > 0 ? 'Edit' : '+ Set Goal'}
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                    {/* Progress bar */}
                    {safeGoal > 0 ? (
                      <GoalProgressBar
                        goalPct={goalPct}
                        isLoss={isGoalLoss}
                        color={goalColor}
                        fallbackTrack={DIVIDER}
                      />
                    ) : (
                      <View style={{ backgroundColor: DIVIDER, borderRadius: 6, height: 8 }} />
                    )}
                    {isGoalLoss && (
                      <Text style={{ color: RED, fontSize: 12, fontWeight: '700', textAlign: 'center', marginTop: 8 }}>
                        ⚠ In the red — expenses exceed earnings this {periodLabel.toLowerCase()}.
                      </Text>
                    )}
                    {!isGoalLoss && goalPct >= 100 && (
                      <Text style={{ color: GREEN, fontSize: 13, fontWeight: '700', textAlign: 'center', marginTop: 8 }}>
                        🎉 Goal Reached!
                      </Text>
                    )}
                  </View>
                )}
              </View>
              )}

              {/* ── Entries List ─────────────────────────────────────────────── */}
              {entries.length > 0 && (
                <View style={{
                  backgroundColor: SURFACE, borderRadius: 16, borderWidth: 1, borderColor: BORDER, overflow: 'hidden',
                  shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4,
                }}>
                  {selectionMode ? (
                    // Selection-mode header: replaces the revenue/expense pills
                    // with Select-All + Delete-N + Cancel controls. Operates on
                    // the currently-displayed (filtered) entries, so search +
                    // bulk-delete compose cleanly.
                    <View style={{
                      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                      paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: DIVIDER,
                      backgroundColor: PRI_LITE,
                    }}>
                      <Pressable
                        onPress={() => {
                          hTap();
                          const allShownIds = displayedEntries.map(e => e.id);
                          const allSelected = allShownIds.every(id => selectedIds.has(id));
                          setSelectedIds(allSelected ? new Set() : new Set(allShownIds));
                        }}
                        style={{ paddingHorizontal: 10, paddingVertical: 6 }}
                      >
                        <Text style={{ color: PRIMARY_TXT, fontSize: 13, fontWeight: '800' }}>
                          {displayedEntries.every(e => selectedIds.has(e.id)) ? 'Clear all' : 'Select all'}
                        </Text>
                      </Pressable>
                      <Text style={{ color: TEXT, fontSize: 13, fontWeight: '700' }}>
                        {selectedIds.size} selected
                      </Text>
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        <Pressable
                          onPress={() => { hTap(); exitSelectionMode(); }}
                          style={{ paddingHorizontal: 10, paddingVertical: 6 }}
                        >
                          <Text style={{ color: LABEL, fontSize: 13, fontWeight: '700' }}>Cancel</Text>
                        </Pressable>
                        <Pressable
                          disabled={exportingSel}
                          onPress={async () => {
                            // Export the selected entries; if nothing is
                            // explicitly selected, fall back to the entire
                            // currently-filtered/visible set.
                            const set = selectedIds.size > 0
                              ? filteredEntries.filter(e => selectedIds.has(e.id))
                              : filteredEntries;
                            if (set.length === 0) {
                              Alert.alert('Nothing to export', 'There are no entries in the current view.');
                              return;
                            }
                            try {
                              setExportingSel(true);
                              hTap();
                              const result = await exportEntriesCsv(set, 'earnings-ninja-selection');
                              if (result === 'unavailable') {
                                Alert.alert('Sharing unavailable', 'Could not open the share sheet on this device.');
                              } else if (result === 'shared') {
                                hNotifyOk();
                              }
                            } catch (e: any) {
                              Alert.alert('Export failed', e?.message || 'Could not export these entries.');
                            } finally {
                              setExportingSel(false);
                            }
                          }}
                          style={({ pressed }) => ({
                            backgroundColor: PRI_LITE, borderRadius: 8,
                            paddingHorizontal: 12, paddingVertical: 6,
                            opacity: pressed || exportingSel ? 0.85 : 1,
                          })}
                        >
                          {exportingSel ? (
                            <ActivityIndicator size="small" color={PRIMARY_TXT} />
                          ) : (
                            <Text style={{ color: PRIMARY_TXT, fontSize: 13, fontWeight: '800' }}>
                              Export{selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}
                            </Text>
                          )}
                        </Pressable>
                        <Pressable
                          disabled={selectedIds.size === 0 || bulkDeleteMutation.isPending}
                          onPress={() => {
                            hTapHeavy();
                            const ids = Array.from(selectedIds);
                            Alert.alert(
                              `Delete ${ids.length} entr${ids.length === 1 ? 'y' : 'ies'}?`,
                              'This cannot be undone.',
                              [
                                { text: 'Cancel', style: 'cancel' },
                                { text: 'Delete', style: 'destructive', onPress: () => bulkDeleteMutation.mutate(ids) },
                              ],
                            );
                          }}
                          style={({ pressed }) => ({
                            backgroundColor: selectedIds.size === 0 ? RED_LT : RED,
                            borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6,
                            opacity: pressed ? 0.85 : 1,
                          })}
                        >
                          {bulkDeleteMutation.isPending ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <Text style={{ color: selectedIds.size === 0 ? RED : '#fff', fontSize: 13, fontWeight: '800' }}>
                              Delete{selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}
                            </Text>
                          )}
                        </Pressable>
                      </View>
                    </View>
                  ) : (
                  <View style={{
                    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: DIVIDER,
                  }}>
                    {/* Left group: Entries/Select label (truncates first) + the
                        Sort control, moved here for quick access right above the
                        transaction list. Right group keeps just the two totals
                        badges, so the row never overflows on narrow screens. */}
                    <View style={{ flexShrink: 1, minWidth: 0, marginRight: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Pressable
                        onPress={() => { hTap(); setSelectionMode(true); }}
                        hitSlop={6}
                        style={{ flexShrink: 1, minWidth: 0 }}
                      >
                        <Text
                          numberOfLines={1}
                          ellipsizeMode="tail"
                          style={{ color: LABEL, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 }}
                        >
                          {isSearching ? `Results (${filteredEntries.length})` : `Entries (${entries.length})`}
                          <Text style={{ color: PRIMARY_TXT }}> · Select</Text>
                        </Text>
                      </Pressable>
                      {/* Sort pill — opens the same Dark-Neon sort sheet; highlights when not Newest. */}
                      <PressScale
                        hitSlop={6}
                        onPress={() => { hTap(); setShowSortMenu(true); }}
                        style={[
                          {
                            flexShrink: 0,
                            flexDirection: 'row', alignItems: 'center', gap: 4,
                            paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999,
                            backgroundColor: sortBy !== 'newest' ? PRIMARY : BG,
                            borderWidth: 1, borderColor: sortBy !== 'newest' ? PRIMARY : BORDER,
                          },
                          sortBy !== 'newest' ? neonGlow(PRIMARY, 6, 0.3) : undefined,
                        ].filter(Boolean) as ViewStyle[]}
                      >
                        <Ionicons name="swap-vertical" size={13} color={sortBy !== 'newest' ? ON_PRIMARY : MUTED} />
                        <Text style={{ color: sortBy !== 'newest' ? ON_PRIMARY : TEXT_MID, fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.3 }}>
                          {SORT_OPTIONS.find(o => o.key === sortBy)?.short ?? 'Newest'}
                        </Text>
                      </PressScale>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      <View style={{ backgroundColor: GREEN_LT, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 }}>
                        <Text style={{ color: GREEN, fontSize: 10, fontWeight: '700' }}>{hidden ? MASK : `+$${revenue.toFixed(2)}`}</Text>
                      </View>
                      <View style={{ backgroundColor: RED_LT, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 }}>
                        <Text style={{ color: RED, fontSize: 10, fontWeight: '700' }}>{hidden ? MASK : `-$${Math.abs(expenses).toFixed(2)}`}</Text>
                      </View>
                    </View>
                  </View>
                  )}
                  {filteredEntries.length === 0 ? (
                    <View style={{ paddingVertical: 28, alignItems: 'center', gap: 8 }}>
                      <Text style={{ fontSize: 28 }}>🔍</Text>
                      <Text style={{ color: TEXT, fontSize: 14, fontWeight: '700' }}>
                        No matches for "{searchQuery.trim()}"
                      </Text>
                      <Text style={{ color: MUTED, fontSize: 12 }}>
                        Try a different search term.
                      </Text>
                    </View>
                  ) : (
                    displayedEntries.map(e => (
                      <EntryRow
                        key={e.id}
                        entry={e}
                        onDelete={(id) => {
                          Alert.alert('Delete Entry', 'Remove this entry?', [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(id) },
                          ]);
                        }}
                        onEdit={(entry) => {
                          hTap();
                          if (entry.id <= 0) {
                            Alert.alert('Still saving', 'This entry hasn’t finished saving yet. Give it a moment, then try editing again.');
                            return;
                          }
                          setEditingEntry(entry); setShowAdd(true);
                        }}
                        onLongPress={selectionMode ? undefined : (entry) => setDetailEntry(entry)}
                        selectionMode={selectionMode}
                        selected={selectedIds.has(e.id)}
                        onToggleSelect={toggleSelect}
                      />
                    ))
                  )}
                  {filteredEntries.length > 8 && (
                    <Pressable
                      onPress={() => setShowAllEntries(s => !s)}
                      style={{ padding: 14, alignItems: 'center', borderTopWidth: 1, borderTopColor: DIVIDER }}
                    >
                      <Text style={{ color: PRIMARY_TXT, fontSize: 13, fontWeight: '700' }}>
                        {showAllEntries
                          ? '▲ Show less'
                          : `▼ Show all ${filteredEntries.length} ${isSearching ? 'results' : 'entries'}`}
                      </Text>
                    </Pressable>
                  )}
                </View>
              )}

              {/* Empty state */}
              {entries.length === 0 && (
                <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                  <Text style={{ fontSize: 40 }}>🚗</Text>
                  <Text style={{ color: MUTED, fontSize: 15, marginTop: 12, textAlign: 'center' }}>
                    No entries yet for this period.{'\n'}Tap + to get started!
                  </Text>
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>

      {/* ── Scroll-to-Top FAB (neon glow, floats above the Add Entry bar) ──── */}
      <Animated.View
        pointerEvents={showScrollTop ? 'auto' : 'none'}
        style={[
          {
            position: 'absolute',
            right: 20,
            bottom: insets.bottom + 100,
            zIndex: 998,
          },
          fabStyle,
        ]}
      >
        <Pressable
          onPress={scrollToTop}
          accessibilityRole="button"
          accessibilityLabel="Scroll to top"
          android_ripple={{ color: 'rgba(0,0,0,0.15)', borderless: true }}
          style={({ pressed }) => ({
            width: 52,
            height: 52,
            borderRadius: 26,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: SURFACE,
            borderWidth: 1.5,
            borderColor: PRIMARY,
            shadowColor: PRIMARY,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.9,
            shadowRadius: 12,
            elevation: 10,
            transform: [{ scale: pressed ? 0.9 : 1 }],
          })}
        >
          <Ionicons name="arrow-up" size={26} color={PRIMARY_TXT} />
        </Pressable>
      </Animated.View>

      {/* ── Sticky "Add Entry" bar (heavy neon yellow halo) ─────────────────── */}
      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: PRIMARY,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          paddingTop: 22,
          paddingBottom: insets.bottom > 0 ? insets.bottom + 14 : 22,
          paddingHorizontal: 28,
          shadowColor: PRIMARY,
          shadowOffset: { width: 0, height: -6 },
          shadowOpacity: 0.4,
          shadowRadius: 16,
          elevation: 12,
          zIndex: 999,
        }}
      >
        <Pressable
          onPress={() => { hTapMed(); setShowAdd(true); }}
          android_ripple={{ color: 'rgba(0,0,0,0.15)' }}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.85 : 1,
            transform: [{ scale: pressed ? 0.96 : 1 }],
          })}
        >
          <Text style={{ color: ON_PRIMARY, fontWeight: '900', fontSize: 22, letterSpacing: 0.3 }}>
            + Add Entry
          </Text>
        </Pressable>
      </View>

      {/* ── Modals ───────────────────────────────────────────────────────────── */}
      <AddEntryModal
        visible={showAdd}
        prefill={addPrefill}
        editing={editingEntry}
        defaultDate={addEntryDefaultDate}
        onClose={() => { setShowAdd(false); setAddPrefill(undefined); setEditingEntry(undefined); }}
      />
      <SettingsModal visible={showSettings} onClose={() => setShowSettings(false)} />
      <AnalyticsModal visible={showAnalytics} onClose={() => setShowAnalytics(false)} initialPeriod={dashboardToAnalyticsPeriod(period)} />
      <ExpensesModal visible={showExpenses} onClose={() => setShowExpenses(false)} />
      {/* ── Sort Menu (Dark Neon bottom sheet) ────────────────────────────── */}
      <Modal visible={showSortMenu} transparent animationType="fade" onRequestClose={() => setShowSortMenu(false)}>
        <Pressable
          onPress={() => setShowSortMenu(false)}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation?.()}
            style={{
              backgroundColor: SURFACE,
              borderTopLeftRadius: 24, borderTopRightRadius: 24,
              borderTopWidth: 1, borderColor: BORDER,
              paddingTop: 10,
              paddingBottom: insets.bottom > 0 ? insets.bottom + 12 : 20,
              paddingHorizontal: 16,
            }}
          >
            <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: BORDER, marginBottom: 14 }} />
            <Text style={{ color: TEXT, fontSize: 18, fontWeight: '800', marginBottom: 2, marginLeft: 4 }}>Sort transactions</Text>
            {SORT_OPTIONS.map(opt => {
              const active = sortBy === opt.key;
              return (
                <PressScale
                  key={opt.key}
                  onPress={() => { hTap(); setSortBy(opt.key); setShowSortMenu(false); }}
                  scale={0.97}
                  style={[
                    {
                      flexDirection: 'row', alignItems: 'center', gap: 14,
                      paddingVertical: 14, paddingHorizontal: 14, marginTop: 8,
                      borderRadius: 14, borderWidth: 1,
                      backgroundColor: active ? PRI_LITE : BG,
                      borderColor: active ? PRIMARY : BORDER,
                    },
                    active ? neonGlow(PRIMARY, 5, 0.18) : undefined,
                  ].filter(Boolean) as ViewStyle[]}
                >
                  <Ionicons name={opt.icon} size={20} color={active ? PRIMARY : MUTED} />
                  <Text style={{ flex: 1, color: active ? TEXT : TEXT_MID, fontSize: 15, fontWeight: active ? '800' : '600' }}>
                    {opt.label}
                  </Text>
                  {active && <Ionicons name="checkmark-circle" size={22} color={PRIMARY_TXT} />}
                </PressScale>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
      <CalendarModal
        visible={showCalendar}
        onClose={() => setShowCalendar(false)}
        onApplyRange={(from, to) => {
          setCustomRange({ from, to });
          setPeriod('custom');
          setNavOffset(0);
        }}
        onDeleteEntries={async (ids) => {
          // Calendar's bulk-erase path. Reuses the per-id delete endpoint
          // (no batch route on backend) via Promise.allSettled. We optimistically
          // strip the rows from the rollup/entries caches first so the dashboard
          // KPIs + goal bar reset instantly, then reconcile with the server. On
          // any failure we roll the optimistic patch back and THROW so the
          // calendar keeps the selection visible for retry and shows error
          // haptic + alert instead of success (the reconcile refetch still runs).
          const ctx = await optimisticRemove(ids);
          const results = await Promise.allSettled(ids.map(id => api.deleteEntry(id)));
          const failed = results.filter(r => r.status === 'rejected').length;
          if (failed > 0) rollbackRemove(ctx);
          reconcileAfterDelete();
          if (failed > 0) {
            throw new Error(`Deleted ${ids.length - failed} of ${ids.length}. ${failed} could not be deleted.`);
          }
        }}
      />
      <TransactionDetailModal
        visible={!!detailEntry}
        entry={detailEntry}
        onClose={() => setDetailEntry(null)}
        onEdit={(entry) => {
          setDetailEntry(null);
          hTap();
          if (entry.id <= 0) {
            Alert.alert('Still saving', 'This entry hasn’t finished saving yet. Give it a moment, then try editing again.');
            return;
          }
          setEditingEntry(entry);
          setShowAdd(true);
        }}
        onDelete={(id) => {
          setDetailEntry(null);
          deleteMutation.mutate(id);
        }}
      />
    </View>
  );
}
