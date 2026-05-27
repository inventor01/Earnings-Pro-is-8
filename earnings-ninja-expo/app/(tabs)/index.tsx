import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, Pressable, Modal,
  RefreshControl, ActivityIndicator, Image, Alert,
  TextInput, KeyboardAvoidingView, Platform,
  ViewStyle, TextStyle,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withSequence, withRepeat, withDelay,
  Easing, runOnJS,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  api, Entry, EntryCreate, EntryType, AppType, ExpenseCategory,
  APP_LABELS, APP_COLORS, EXPENSE_EMOJIS, TimeframeType,
} from '@/lib/api';
import { useAuth } from '@/lib/authContext';
import * as Haptics from 'expo-haptics';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { CalendarModal } from '../../components/CalendarModal';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as DocumentPicker from 'expo-document-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme, useThemeControls, THEMES, ThemeName } from '@/lib/theme';
import { widgetSync } from '@/lib/widgetSync';
import { useLocalSearchParams, router } from 'expo-router';

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
  value, format, style, duration = 700,
}: {
  value: number;
  format: (n: number) => string;
  style?: TextStyle | TextStyle[];
  duration?: number;
}) {
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

const APPS: { key: AppType; label: string; color: string }[] = [
  { key: 'DOORDASH',  label: 'DoorDash',  color: '#FF3008' },
  { key: 'UBEREATS',  label: 'Uber Eats', color: '#06C167' },
  { key: 'INSTACART', label: 'Instacart', color: '#43B02A' },
  { key: 'GRUBHUB',   label: 'GrubHub',   color: '#F63440' },
  { key: 'SHIPT',     label: 'Shipt',     color: '#00A6CE' },
  { key: 'OTHER',     label: 'Other',     color: '#6B7280' },
];

const EXPENSE_CATS: ExpenseCategory[] = [
  'GAS', 'PARKING', 'TOLLS', 'MAINTENANCE', 'PHONE', 'SUBSCRIPTION', 'FOOD', 'OTHER',
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
        const d = new Date(e.timestamp);
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
      const d = new Date(e.timestamp);
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
  label, value, icon, numericValue, format, accent,
}: {
  label: string;
  value: string;
  icon: string;
  numericValue?: number;
  format?: (n: number) => string;
  accent?: string;
}) {
  const { SURFACE, TEXT, LABEL, PRIMARY } = useTheme();
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
          style={{ color: TEXT, fontSize: 17, fontWeight: '800' }}
        />
      ) : (
        <Text style={{ color: TEXT, fontSize: 17, fontWeight: '800' }}>{value}</Text>
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
  entry, onDelete, onEdit,
  selectionMode = false, selected = false, onToggleSelect,
}: {
  entry: Entry;
  onDelete: (id: number) => void;
  onEdit?: (entry: Entry) => void;
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: number) => void;
}) {
  const { TEXT, LABEL, MUTED, RED, GREEN, DIVIDER, PRIMARY, PRI_LITE } = useTheme();
  const isExpense = entry.amount < 0;
  const appColor  = APP_COLORS[entry.app] || MUTED;
  const time      = new Date(entry.timestamp).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
  const date      = new Date(entry.timestamp).toLocaleDateString('en-US', {
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
        backgroundColor: appColor + '18',
        alignItems: 'center', justifyContent: 'center', marginRight: 12,
      }}>
        <Text style={{ fontSize: 14, fontWeight: '900', color: appColor }}>
          {(APP_LABELS[entry.app] || 'O')[0]}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: TEXT, fontSize: 14, fontWeight: '600' }} numberOfLines={1}>
          {APP_LABELS[entry.app]}
          <Text style={{ color: LABEL, fontWeight: '400', fontSize: 12 }}> · {entry.type}</Text>
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
        {isExpense ? '-' : '+'}${Math.abs(Number(entry.amount)).toFixed(2)}
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

  if (!selectionMode) return body;
  return (
    <Pressable onPress={() => { hTap(); onToggleSelect?.(entry.id); }}>
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
}: {
  options: { key: T; label: string; color?: string }[];
  value: T;
  onChange: (v: T) => void;
  accent?: string;
  scroll?: boolean;
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
            <Text style={{
              color: selected ? '#0f172a' : '#6b7280',
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
  isExp, amount, entryType, setEntryType, app, setApp, category, setCategory,
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
  category: ExpenseCategory;
  setCategory: (c: ExpenseCategory) => void;
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

          {/* App (hidden for EXPENSE — mirrors web) */}
          {entryType !== 'EXPENSE' && (
            <View>
              <FieldLabel>🚗 App</FieldLabel>
              <PillSelect
                scroll
                options={APPS.map(a => ({ key: a.key, label: a.label, color: a.color + '55' }))}
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
                {entryDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                {'  ·  '}
                {entryDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
              </Text>
              <Ionicons name={showDatePicker ? 'chevron-up' : 'chevron-down'} size={16} color="#6b7280" />
            </Pressable>
            {showDatePicker && (
              <View style={{ marginTop: 8, backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden' }}>
                <DateTimePicker
                  value={entryDate}
                  mode="datetime"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
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
function AddEntryModal({ visible, onClose, prefill, editing }: {
  visible: boolean;
  onClose: () => void;
  prefill?: AddEntryPrefill;
  editing?: Entry;
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
  // Date/time the entry should be filed under. Defaults to "now" — backend
  // accepts `date`/`time` strings (interpreted in US/Eastern) and converts
  // to UTC. Editing flow seeds this from the entry's existing timestamp.
  const [entryDate, setEntryDate]   = useState<Date>(() => new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  const reset = () => {
    setStep('calc'); setAmount('0'); setMode('add');
    setEntryType('ORDER'); setApp('DOORDASH'); setCategory('GAS');
    setMiles(''); setMinutes(''); setNote('');
    setReceiptUri(null); setReceiptDataUri(null);
    setEntryDate(new Date()); setShowDatePicker(false);
  };

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
    setEntryDate(new Date(editing.timestamp));
    setStep('details');
  }, [visible, editing]);

  // One-way nudge: when the user switches to EXPENSE and the platform is still
  // the initial DoorDash default, flip to "Other" (gas station / parking etc.
  // don't belong to a delivery app). We deliberately do NOT auto-revert on the
  // way back to revenue — if the user picked OTHER on purpose we'd erase that
  // choice. `reset()` restores DOORDASH when the modal closes & re-opens.
  useEffect(() => {
    if (entryType === 'EXPENSE' && app === 'DOORDASH') setApp('OTHER');
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
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['entries'] });
      queryClient.invalidateQueries({ queryKey: ['rollup'] });
      queryClient.invalidateQueries({ queryKey: ['goal'] });
      // Remember the last app the user logged revenue against — the iOS
      // widget's quick-add buttons use this as the platform.
      if (vars.type === 'ORDER' && vars.app) {
        widgetSync.pushLastApp(vars.app);
      }
      hNotifyOk();
      reset();
      onClose();
    },
    onError: () => Alert.alert('Error', 'Failed to save entry.'),
  });

  // PUT mutation used only in the "edit existing entry" flow. Same cache
  // invalidations as create so dashboard/rollup re-render with the change.
  const updateMutation = useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: Partial<EntryCreate> }) => api.updateEntry(id, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries'] });
      queryClient.invalidateQueries({ queryKey: ['rollup'] });
      hNotifyOk();
      reset();
      onClose();
    },
    onError: (e: Error) => Alert.alert('Error', e.message || 'Failed to update entry.'),
  });

  // Format Date → ('YYYY-MM-DD', 'HH:MM') using device-local components.
  // Backend treats these as US/Eastern (see EntryCreate handling). This
  // mirrors the rest of the app, which is effectively EST-only.
  const pad2 = (n: number) => String(n).padStart(2, '0');
  const dateStr = `${entryDate.getFullYear()}-${pad2(entryDate.getMonth() + 1)}-${pad2(entryDate.getDate())}`;
  const timeStr = `${pad2(entryDate.getHours())}:${pad2(entryDate.getMinutes())}`;

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
      date: dateStr,
      time: timeStr,
    };
    if (editing) {
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
              setApp={setApp}
              category={category}
              setCategory={setCategory}
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
const VALID_CATS  = new Set(['GAS', 'PARKING', 'TOLLS', 'MAINTENANCE', 'PHONE', 'SUBSCRIPTION', 'FOOD', 'LEISURE', 'OTHER']);

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
  const { SURFACE, BORDER, PRI_LITE, PRIMARY, TEXT, MUTED } = useTheme();
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
        <Ionicons name={busy ? 'hourglass' : 'cloud-upload'} size={18} color={PRIMARY} />
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

function SettingsModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { BG, SURFACE, BORDER, PRIMARY, PRI_LITE, TEXT, MUTED, LABEL, RED, RED_LT, ON_PRIMARY } = useTheme();
  const { themeName, setThemeName } = useThemeControls();
  const { logout, user } = useAuth();
  const queryClient = useQueryClient();
  const [editingGoal, setEditingGoal] = useState<TimeframeType | null>(null);
  const [goalInput, setGoalInput] = useState('');

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
            <Ionicons name="refresh" size={18} color={PRIMARY} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: TEXT, fontSize: 15, fontWeight: '700' }}>Refresh data</Text>
            <Text style={{ color: MUTED, fontSize: 12, marginTop: 2 }}>Re-pull earnings, expenses, and goals</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={MUTED} />
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
                <Text style={{ color: PRIMARY, fontSize: 18, fontWeight: '800' }}>
                  {target > 0 ? `$${target.toFixed(0)}` : 'Not set'}
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
                  <Text style={{ color: PRIMARY, fontSize: 13, fontWeight: '700' }}>
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
                  {name === 'darkNeon' ? 'True-black with neon glow' :
                   name === 'simpleLight' ? 'Clean white with blue accents' :
                   'High-contrast black & white'}
                </Text>
              </View>
              {active && (
                <Ionicons name="checkmark-circle" size={22} color={PRIMARY} />
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
          📥  Import Data
        </Text>
        <ImportCsvRow
          onDone={() => {
            queryClient.invalidateQueries({ queryKey: ['entries'] });
            queryClient.invalidateQueries({ queryKey: ['rollup'] });
          }}
        />

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
export default function DashboardScreen() {
  const {
    BG, SURFACE, CARD_BG, CARD, BORDER, PRIMARY, ACCENT, PRI_LITE, PRI_DARK,
    TEXT, TEXT_MID, MUTED, LABEL, DIM, GREEN, GREEN_LT, RED, RED_LT, DIVIDER, ON_PRIMARY,
  } = useTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<Period>('today');
  const [refreshing, setRefreshing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [addPrefill, setAddPrefill] = useState<AddEntryPrefill | undefined>(undefined);
  const [showSettings, setShowSettings] = useState(false);

  // History list multi-select state. `selectionMode` toggles the row UI into
  // checkbox-mode; `selectedIds` is the set of currently-selected entry IDs.
  // `editingEntry` opens AddEntryModal in edit mode when non-null.
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
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
  // Day offset for swipe-to-change-day on the "Today" period (0 = today, -1 = yesterday, etc).
  // Only meaningful when period === 'today'. Reset whenever the user switches periods.
  const [dayOffset, setDayOffset] = useState(0);

  const tf = period === 'custom'
    ? 'TODAY' // unused — but keeps query keys typed cleanly
    : PERIODS.find(p => p.key === period)!.tf;

  // Effective day offset is only applied when we're on the TODAY chip; otherwise 0.
  const effectiveDayOffset = period === 'today' ? dayOffset : 0;

  // Stable cache keys that include the range when in custom mode so React Query
  // doesn't share data across different ranges. Day offset is also part of the
  // key so each day has its own cache slot.
  const rollupKey  = period === 'custom'
    ? ['rollup', 'custom', customRange?.from, customRange?.to]
    : ['rollup', tf, effectiveDayOffset];
  const entriesKey = period === 'custom'
    ? ['entries', 'custom', customRange?.from, customRange?.to]
    : ['entries', tf, effectiveDayOffset];

  const { data: rollup, isLoading: rollupLoading } = useQuery({
    queryKey: rollupKey,
    queryFn: () => period === 'custom' && customRange
      ? api.getRollupInRange(customRange.from, customRange.to)
      : api.getRollup(tf, effectiveDayOffset),
    enabled: period !== 'custom' || !!customRange,
  });

  const { data: entries = [] } = useQuery({
    queryKey: entriesKey,
    queryFn: () => period === 'custom' && customRange
      ? api.getEntriesInRange(customRange.from, customRange.to)
      : api.getEntries(tf, 200, effectiveDayOffset),
    enabled: period !== 'custom' || !!customRange,
  });

  // Goals only exist for the fixed timeframes — disable the goal query in custom mode.
  const { data: goal, refetch: refetchGoal } = useQuery({
    queryKey: ['goal', tf],
    queryFn: () => api.getGoal(tf),
    enabled: period !== 'custom',
  });

  // Safety: whenever the currently-visible entry set changes (period switch,
  // day swipe, search filter, custom-range pick), prune `selectedIds` to the
  // intersection. Without this, a user could select rows, then change the
  // filter and tap Delete — and we'd delete entries they can't even see.
  // We don't auto-exit selection mode, because the user may genuinely want
  // to continue selecting across a search refinement.
  useEffect(() => {
    if (!selectionMode || selectedIds.size === 0) return;
    const visibleIds = new Set(entries.map(e => e.id));
    let changed = false;
    const next = new Set<number>();
    selectedIds.forEach(id => {
      if (visibleIds.has(id)) next.add(id); else changed = true;
    });
    if (changed) setSelectedIds(next);
  }, [entries, selectionMode]); // eslint-disable-line react-hooks/exhaustive-deps

  const deleteMutation = useMutation({
    mutationFn: api.deleteEntry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries'] });
      queryClient.invalidateQueries({ queryKey: ['rollup'] });
    },
  });

  // Bulk delete — fires DELETE requests in parallel, then invalidates once
  // at the end so the list re-renders a single time. The backend has no
  // batch endpoint, so this is just Promise.allSettled over the per-id
  // delete. Failures are surfaced as a count in an Alert.
  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      const results = await Promise.allSettled(ids.map(id => api.deleteEntry(id)));
      const failed = results.filter(r => r.status === 'rejected').length;
      return { total: ids.length, failed };
    },
    onSuccess: ({ total, failed }) => {
      queryClient.invalidateQueries({ queryKey: ['entries'] });
      queryClient.invalidateQueries({ queryKey: ['rollup'] });
      exitSelectionMode();
      if (failed > 0) {
        Alert.alert('Partial delete', `Deleted ${total - failed} of ${total}. ${failed} failed.`);
      } else {
        hNotifyOk();
      }
    },
    onError: () => Alert.alert('Error', 'Bulk delete failed.'),
  });

  const upsertGoalMutation = useMutation({
    mutationFn: ({ target }: { target: number }) => api.upsertGoal(tf, target),
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
  const perHour   = n(rollup?.dollars_per_hour);
  const perMile   = n(rollup?.dollars_per_mile);
  const avgOrder  = n(rollup?.average_order_value);

  // Push today's net profit to the iOS widget whenever we're actually
  // viewing today (period === 'today' && dayOffset === 0). Other periods
  // would lie to the widget about "today".
  useEffect(() => {
    if (period === 'today' && effectiveDayOffset === 0 && rollup) {
      widgetSync.pushProfit(profit);
    }
  }, [profit, period, effectiveDayOffset, rollup]);
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
  const displayedEntries = showAllEntries ? filteredEntries : filteredEntries.slice(0, 8);
  const orderCount = entries.filter(e => Number(e.amount) > 0).length;

  const isProfit   = profit >= 0;
  const profitColor = isProfit ? GREEN : RED;
  const profitBg    = isProfit ? GREEN_LT : RED_LT;

  // Goal progress
  const safeGoal  = goalTarget ? Number(goalTarget) : 0;
  const goalPct   = safeGoal > 0 ? Math.min((profit / safeGoal) * 100, 100) : 0;
  const goalColor = goalPct >= 100 ? GREEN : PRIMARY;

  // Period label for the date bar. When the user is on the TODAY chip and has
  // swiped to a different day, replace the static "Today" label with the actual
  // weekday/date the dashboard is now showing (e.g. "Yesterday • Apr 29").
  const dayNavActive = period === 'today';
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
  const periodLabel = dayNavActive
    ? dateLabelForOffset(dayOffset)
    : PERIOD_LABELS[period];

  // ── Swipe-to-change-day gesture (mirrors web SummaryCard.tsx) ────────────
  // Swipe LEFT  → next day (dayOffset + 1)
  // Swipe RIGHT → previous day (dayOffset - 1)
  // Threshold: |dx| > 50 AND |dx| > |dy|. Disabled when not on the TODAY chip.
  const goToDay = useCallback((delta: number) => {
    setDayOffset(prev => prev + delta);
    hTap();
  }, []);
  const swipeGesture = Gesture.Pan()
    .enabled(dayNavActive)
    .activeOffsetX([-15, 15])
    .failOffsetY([-20, 20])
    .onEnd((e) => {
      'worklet';
      const dx = e.translationX;
      const dy = e.translationY;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
        runOnJS(goToDay)(dx < 0 ? 1 : -1);
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
              <Text style={{ color: PRIMARY }}>NINJA</Text>
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
              onPress={() => { hTap(); setShowSettings(true); }}
              style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: BG, borderWidth: 1, borderColor: BORDER, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="settings-outline" size={17} color={MUTED} />
            </PressScale>
          </View>
        </View>

        {/* ── Period Tabs ───────────────────────────────────────────────────── */}
        <View style={{ backgroundColor: SURFACE, borderBottomWidth: 1, borderBottomColor: BORDER }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, gap: 6, flexDirection: 'row' }}>
            {PERIODS.map(p => {
              const active = period === p.key;
              return (
                <PressScale
                  key={p.key}
                  onPress={() => { hTap(); setPeriod(p.key); setDayOffset(0); }}
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
                onPress={() => { hTap(); setPeriod('custom'); setDayOffset(0); }}
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
                    if (period === 'custom') { setPeriod('today'); setDayOffset(0); }
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
              <Ionicons name="search" size={18} color={PRIMARY} />
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
              {/* Horizontal swipe on this card cycles dayOffset ± 1 when on the TODAY chip. */}
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

                {/* Date range row — chevrons cycle days when on the TODAY chip. */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 }}>
                  <PressScale
                    onPress={() => goToDay(-1)}
                    disabled={!dayNavActive}
                    scale={0.85}
                    hitSlop={12}
                    style={{ padding: 4, opacity: dayNavActive ? 1 : 0.35 }}
                  >
                    <Ionicons name="chevron-back" size={18} color={dayNavActive ? PRIMARY : LABEL} />
                  </PressScale>
                  <Text style={{ color: MUTED, fontSize: 13, fontWeight: '500', flex: 1, textAlign: 'center' }}>
                    {dayNavActive ? periodLabel : `${periodLabel} earnings`}
                  </Text>
                  <PressScale
                    onPress={() => goToDay(1)}
                    disabled={!dayNavActive}
                    scale={0.85}
                    hitSlop={12}
                    style={{ padding: 4, opacity: dayNavActive ? 1 : 0.35 }}
                  >
                    <Ionicons name="chevron-forward" size={18} color={dayNavActive ? PRIMARY : LABEL} />
                  </PressScale>
                </View>

                {/* Profit chart — hourly for single-day views, daily otherwise */}
                <ProfitChart
                  entries={entries}
                  period={period}
                  customRange={customRange}
                  dayOffset={effectiveDayOffset}
                  positiveColor={GREEN}
                  negativeColor={RED}
                />

                {/* Three stats with count-up */}
                <View style={{ flexDirection: 'row' }}>
                  {[
                    { label: 'EXPENSES',  numeric: Math.abs(expenses), format: (n: number) => `$${Math.round(n)}` },
                    { label: 'ORDERS',    numeric: orderCount,         format: (n: number) => `${Math.round(n)}` },
                    { label: 'AVG ORDER', numeric: avgOrder,           format: (n: number) => `$${Math.round(n)}` },
                  ].map((stat, i) => (
                    <View
                      key={stat.label}
                      style={{
                        flex: 1,
                        alignItems: 'center',
                        borderLeftWidth: i > 0 ? 1 : 0,
                        borderLeftColor: DIVIDER,
                        paddingVertical: 4,
                      }}
                    >
                      <Text style={{ color: LABEL, fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                        {stat.label}
                      </Text>
                      <AnimatedNumber
                        value={stat.numeric}
                        format={stat.format}
                        style={{ color: TEXT, fontSize: 18, fontWeight: '800', marginTop: 2 }}
                      />
                    </View>
                  ))}
                </View>

              </Animated.View>
              </GestureDetector>

              {/* ── Secondary Stat Cards: $/Mile, Miles (centered row) ──────── */}
              <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'center' }}>
                <View style={{ flex: 1, maxWidth: '48%' }}>
                  <StatCard label="$/Mile" icon="📍" value={`$${perMile.toFixed(2)}`} numericValue={perMile} format={(n) => `$${n.toFixed(2)}`} />
                </View>
                <View style={{ flex: 1, maxWidth: '48%' }}>
                  <StatCard label="Miles"  icon="🚗" value={miles.toFixed(1)}         numericValue={miles}   format={(n) => n.toFixed(1)} />
                </View>
              </View>

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
                        <Text style={{ color: TEXT, fontSize: 22, fontWeight: '800', marginTop: 2 }}>
                          {safeGoal > 0 ? `$${profit.toFixed(2)} / $${safeGoal.toFixed(0)}` : 'No goal set'}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        {safeGoal > 0 && (
                          <Text style={{ color: goalColor, fontSize: 20, fontWeight: '900' }}>
                            {Math.round(goalPct)}%
                          </Text>
                        )}
                        <Pressable
                          onPress={() => { setGoalInput(goalTarget ? goalTarget.toString() : ''); setEditingGoal(true); }}
                          style={{ marginTop: 4 }}
                        >
                          <Text style={{ color: PRIMARY, fontSize: 12, fontWeight: '600' }}>
                            {safeGoal > 0 ? 'Edit' : '+ Set Goal'}
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                    {/* Progress bar */}
                    <View style={{ backgroundColor: DIVIDER, borderRadius: 6, height: 8, overflow: 'hidden' }}>
                      {safeGoal > 0 && (
                        <View style={{
                          width: `${Math.min(goalPct, 100)}%`,
                          height: '100%',
                          backgroundColor: goalColor,
                          borderRadius: 6,
                        }} />
                      )}
                    </View>
                    {goalPct >= 100 && (
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
                        <Text style={{ color: PRIMARY, fontSize: 13, fontWeight: '800' }}>
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
                    <Pressable
                      onPress={() => { hTap(); setSelectionMode(true); }}
                      hitSlop={6}
                    >
                      <Text style={{ color: LABEL, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 }}>
                        {isSearching ? `Results (${filteredEntries.length})` : `Entries (${entries.length})`}
                        <Text style={{ color: PRIMARY }}>  · Select</Text>
                      </Text>
                    </Pressable>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <View style={{ backgroundColor: GREEN_LT, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                        <Text style={{ color: GREEN, fontSize: 11, fontWeight: '700' }}>+${revenue.toFixed(2)}</Text>
                      </View>
                      <View style={{ backgroundColor: RED_LT, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                        <Text style={{ color: RED, fontSize: 11, fontWeight: '700' }}>-${Math.abs(expenses).toFixed(2)}</Text>
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
                        onEdit={(entry) => { hTap(); setEditingEntry(entry); setShowAdd(true); }}
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
                      <Text style={{ color: PRIMARY, fontSize: 13, fontWeight: '700' }}>
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
        onClose={() => { setShowAdd(false); setAddPrefill(undefined); setEditingEntry(undefined); }}
      />
      <SettingsModal visible={showSettings} onClose={() => setShowSettings(false)} />
      <CalendarModal
        visible={showCalendar}
        onClose={() => setShowCalendar(false)}
        onApplyRange={(from, to) => {
          setCustomRange({ from, to });
          setPeriod('custom');
          setDayOffset(0);
        }}
      />
    </View>
  );
}
