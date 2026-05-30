import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, Pressable, Modal, ScrollView, ActivityIndicator,
  ViewStyle, Platform, useWindowDimensions, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, Entry, APP_LABELS, APP_COLORS } from '../lib/api';
import { useTheme } from '../lib/theme';
import { useHiddenMode, MASK } from '../lib/hiddenMode';

// ─── Theme palette is read inside each component via useTheme() ──────────────
// Heat-map intensity overlays (kept module-level since alpha-tinted shades
// only ever sit on top of the green/red theme accents and look correct in
// every theme).
const GREEN_LT = 'rgba(34,197,94,0.18)';
const GREEN_MD = 'rgba(34,197,94,0.32)';
const GREEN_HI = 'rgba(34,197,94,0.55)';
const RED_LT   = 'rgba(239,68,68,0.18)';
const RED_MD   = 'rgba(239,68,68,0.32)';
const RED_HI   = 'rgba(239,68,68,0.55)';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_NAMES = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

type Metric = 'profit' | 'revenue' | 'expenses';

const hTap = () => {
  if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
};

function neonGlow(color: string, radius = 6, opacity = 0.4): ViewStyle {
  return {
    shadowColor: color,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: opacity,
    shadowRadius: radius,
    elevation: Math.round(radius / 2),
  };
}

function PressScale({
  children, onPress, style, scale = 0.94, disabled,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle | ViewStyle[];
  scale?: number;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        style as ViewStyle,
        pressed && !disabled ? { transform: [{ scale }] } : null,
        disabled ? { opacity: 0.5 } : null,
      ]}
    >
      {children}
    </Pressable>
  );
}

// Build YYYY-MM-DD in America/New_York from a Date or ISO string.
// Mirrors the web's getESTDateString so calendar buckets match the dashboard.
function estDateString(input: Date | string): string {
  const d = input instanceof Date ? input : new Date(input);
  if (isNaN(d.getTime())) return '';
  // 'en-CA' returns YYYY-MM-DD natively.
  return d.toLocaleDateString('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
}

// Convert a backend entry's timestamp into an EST YYYY-MM-DD bucket.
// Parse 'YYYY-MM-DD' as a local Date at midnight (used for day-count math).
function parseEstYmd(yyyymmdd: string): Date {
  const [y, m, d] = yyyymmdd.split('-').map(n => parseInt(n, 10));
  return new Date(y, (m || 1) - 1, d || 1);
}

function entryDateStr(e: Entry): string {
  let raw: string | undefined =
    (e as any).timestamp || (e as any).created_at || (e as any).date;
  if (!raw || typeof raw !== 'string') return '';
  // Treat naive ISO (no Z, no offset) as UTC — that's what the backend emits.
  if (raw.includes('T') && !raw.endsWith('Z') && !/[+-]\d{2}:?\d{2}$/.test(raw)) {
    raw = raw + 'Z';
  }
  const d = new Date(raw);
  if (isNaN(d.getTime())) {
    // Fallback: assume YYYY-MM-DD prefix.
    return raw.substring(0, 10);
  }
  return estDateString(d);
}

interface CalendarModalProps {
  visible: boolean;
  onClose: () => void;
  /** Called with two YYYY-MM-DD EST dates when the user taps "Apply to Dashboard". */
  onApplyRange?: (fromDateStr: string, toDateStr: string) => void;
  /** Bulk-delete entry IDs from the parent (which owns the mutation + cache invalidation). */
  onDeleteEntries?: (ids: number[]) => Promise<void> | void;
}

export function CalendarModal({ visible, onClose, onApplyRange, onDeleteEntries }: CalendarModalProps) {
  const { BG, SURFACE, CARD, BORDER, DIVIDER, TEXT, LABEL, MUTED, PRIMARY, GREEN, RED, ON_PRIMARY } = useTheme();
  const { hidden } = useHiddenMode();
  const insets = useSafeAreaInsets();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear]   = useState(now.getFullYear());
  const [metric, setMetric] = useState<Metric>('profit');
  // Multi-day selection: tap toggles individual days; long-press fills the
  // range from the earliest already-selected day (or just selects that day if
  // none yet). Set of YYYY-MM-DD EST strings.
  const [selectedDays, setSelectedDays] = useState<Set<string>>(() => new Set());
  const [erasing, setErasing] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  // Year being browsed inside the picker (separate from `year` so user can scrub years
  // without immediately changing the calendar until they tap a month).
  const [pickerYear, setPickerYear] = useState(now.getFullYear());

  // First/last day of the visible month, padded ±36h so we don't miss entries
  // whose UTC timestamp lands in an adjacent day when bucketed back into EST.
  const { fromIso, toIso } = useMemo(() => {
    const first = new Date(year, month, 1, 0, 0, 0, 0);
    const last  = new Date(year, month + 1, 0, 23, 59, 59, 999);
    const pad = 36 * 60 * 60 * 1000; // 36h
    return {
      fromIso: new Date(first.getTime() - pad).toISOString(),
      toIso:   new Date(last.getTime()  + pad).toISOString(),
    };
  }, [year, month]);

  const { data: entries = [], isLoading, isError, refetch } = useQuery<Entry[]>({
    queryKey: ['entries-range', fromIso, toIso],
    queryFn: () => api.getEntriesInRange(fromIso, toIso, 5000),
    enabled: visible,
  });

  // Aggregate by day.
  const dailyData = useMemo(() => {
    const map: Record<string, { profit: number; revenue: number; expenses: number; count: number }> = {};
    for (const e of entries) {
      const dStr = entryDateStr(e);
      if (!dStr) continue;
      const amt = Number(e.amount) || 0;
      if (!map[dStr]) map[dStr] = { profit: 0, revenue: 0, expenses: 0, count: 0 };
      map[dStr].profit += amt;
      if (amt > 0) map[dStr].revenue += amt;
      else if (amt < 0) map[dStr].expenses += Math.abs(amt);
      map[dStr].count += 1;
    }
    // Round to 2 decimals.
    for (const k of Object.keys(map)) {
      map[k].profit   = Math.round(map[k].profit * 100) / 100;
      map[k].revenue  = Math.round(map[k].revenue * 100) / 100;
      map[k].expenses = Math.round(map[k].expenses * 100) / 100;
    }
    return map;
  }, [entries]);

  // Build calendar grid.
  const days = useMemo(() => {
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth  = new Date(year, month + 1, 0);
    const daysInMonth = lastDayOfMonth.getDate();
    const startWeekday = firstDayOfMonth.getDay();

    type Cell = { day: number; dateStr: string } | null;
    const cells: Cell[] = [];
    for (let i = 0; i < startWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ day: d, dateStr });
    }
    // Pad the trailing partial week so the grid always ends on a full row of 7.
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [year, month]);

  // Month-level totals for the header strip.
  const monthTotals = useMemo(() => {
    let profit = 0, revenue = 0, expenses = 0, days = 0;
    for (const k of Object.keys(dailyData)) {
      profit += dailyData[k].profit;
      revenue += dailyData[k].revenue;
      expenses += dailyData[k].expenses;
      if (dailyData[k].count > 0) days += 1;
    }
    return { profit, revenue, expenses, days };
  }, [dailyData]);

  function getValue(dateStr: string): number {
    const d = dailyData[dateStr];
    if (!d) return 0;
    return metric === 'profit' ? d.profit : metric === 'revenue' ? d.revenue : d.expenses;
  }

  // Cells are mostly uniform; profit/loss is conveyed by the day-number color
  // and the colored dot under it.
  function getDotColor(value: number, hasData: boolean): string | null {
    if (!hasData) return null;
    if (metric === 'expenses') return value > 0 ? RED : null;
    if (value > 0) return GREEN;
    if (value < 0) return RED;
    return null;
  }

  function prevMonth() {
    hTap();
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }

  function nextMonth() {
    hTap();
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }

  function jumpToToday() {
    hTap();
    const t = new Date();
    setMonth(t.getMonth());
    setYear(t.getFullYear());
  }

  // Clear selection on month change — the entries query is scoped to the
  // visible month (±36h pad), so selected days outside it would be unverifiable
  // and the erase action would have nothing to operate on.
  useEffect(() => {
    setSelectedDays(new Set());
  }, [month, year]);

  // Min/max of the current selection (for "Apply to Dashboard" range + display).
  const selectionBounds = useMemo<{ from: string; to: string } | null>(() => {
    if (selectedDays.size === 0) return null;
    const arr = Array.from(selectedDays).sort();
    return { from: arr[0], to: arr[arr.length - 1] };
  }, [selectedDays]);

  // Entries that fall on any selected day (sorted newest first).
  const selectedEntries = useMemo(() => {
    if (selectedDays.size === 0) return [];
    return entries
      .filter(e => selectedDays.has(entryDateStr(e)))
      .sort((a, b) => {
        const ta = new Date((a as any).timestamp || (a as any).created_at || 0).getTime();
        const tb = new Date((b as any).timestamp || (b as any).created_at || 0).getTime();
        return tb - ta;
      });
  }, [selectedDays, entries]);

  // Aggregated totals across selected days. `daysWithData` counts only the
  // subset of selected days that actually contain entries.
  const selectionTotals = useMemo(() => {
    let profit = 0, revenue = 0, expenses = 0, daysWithData = 0;
    selectedDays.forEach(k => {
      const d = dailyData[k];
      if (!d) return;
      profit   += d.profit;
      revenue  += d.revenue;
      expenses += d.expenses;
      if (d.count > 0) daysWithData += 1;
    });
    return {
      profit, revenue, expenses, daysWithData,
      entryCount: selectedEntries.length,
      dayCount: selectedDays.size,
    };
  }, [selectedDays, dailyData, selectedEntries]);

  // All days in the visible month that have at least one entry.
  const daysWithData = useMemo(
    () => Object.keys(dailyData).filter(k => dailyData[k].count > 0),
    [dailyData],
  );

  // RN Pressable fires `onPress` on release even after a long-press completes.
  // We set this ref in `handleDayLongPress` so the immediately-following tap
  // doesn't toggle the endpoint we just included in the range fill.
  const longPressFiredRef = useRef(false);

  // Tap toggles a single day in/out of the selection.
  // IMPORTANT: decide add-vs-remove from the *current* selectedDays here,
  // BEFORE entering the updater. The functional updater can be invoked
  // more than once per call (StrictMode dev double-invoke, concurrent
  // render replay), and a toggle written as `if (has) delete else add`
  // inside the updater would flip twice and cancel itself out — that's
  // the "only the most recent tap stays selected" bug.
  function handleDayPress(dateStr: string) {
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false;
      return;
    }
    hTap();
    const willAdd = !selectedDays.has(dateStr);
    setSelectedDays(prev => {
      const next = new Set(prev);
      if (willAdd) next.add(dateStr);
      else next.delete(dateStr);
      return next;
    });
  }

  // Long-press fills a range. If nothing is selected, just selects the day.
  // Otherwise: anchor = earliest already-selected day (or latest if pressed day
  // is earlier than every selection), fill all days inclusive.
  function handleDayLongPress(dateStr: string) {
    longPressFiredRef.current = true;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setSelectedDays(prev => {
      const next = new Set(prev);
      if (next.size === 0) {
        next.add(dateStr);
        return next;
      }
      const sorted = Array.from(next).sort();
      const anchor = dateStr < sorted[0] ? sorted[sorted.length - 1] : sorted[0];
      const from = anchor < dateStr ? anchor : dateStr;
      const to   = anchor < dateStr ? dateStr : anchor;
      // Walk EST days from `from` to `to` inclusive.
      const start = parseEstYmd(from);
      const end   = parseEstYmd(to);
      const cursor = new Date(start);
      while (cursor.getTime() <= end.getTime()) {
        const y = cursor.getFullYear();
        const m = String(cursor.getMonth() + 1).padStart(2, '0');
        const d = String(cursor.getDate()).padStart(2, '0');
        next.add(`${y}-${m}-${d}`);
        cursor.setDate(cursor.getDate() + 1);
      }
      return next;
    });
  }

  function clearSelection() {
    hTap();
    setSelectedDays(new Set());
  }

  function selectAllWithData() {
    hTap();
    setSelectedDays(new Set(daysWithData));
  }

  function confirmErase() {
    if (selectedEntries.length === 0 || !onDeleteEntries) return;
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    }
    const dayLabel = `${selectionTotals.daysWithData} selected day${selectionTotals.daysWithData === 1 ? '' : 's'}`;
    const entryLabel = `${selectedEntries.length} entr${selectedEntries.length === 1 ? 'y' : 'ies'}`;
    Alert.alert(
      'Erase selected days?',
      `Delete all ${entryLabel} from the ${dayLabel}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Erase',
          style: 'destructive',
          onPress: async () => {
            setErasing(true);
            const ids = selectedEntries.map(e => e.id);
            try {
              await onDeleteEntries(ids);
              setSelectedDays(new Set());
              if (Platform.OS !== 'web') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
              }
            } catch (err: any) {
              if (Platform.OS !== 'web') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
              }
              Alert.alert('Erase failed', err?.message || 'Some entries could not be deleted. Your selection has been kept so you can retry.');
            } finally {
              setErasing(false);
              refetch();
            }
          },
        },
      ],
    );
  }

  const todayStr = estDateString(new Date());
  // Compute fixed pixel cell width from the live window dimensions.
  // Container has 16px horizontal margin both sides + 1px outer borders.
  const { width: winW } = useWindowDimensions();
  const gridInnerW = Math.max(280, winW - 32 - 2);
  const cellSize = Math.floor(gridInnerW / 7);
  const cellHeight = 60;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: BG, paddingTop: insets.top > 0 ? 0 : 12 }}>
        {/* ── Sheet Header ─────────────────────────────────────────────────── */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          paddingHorizontal: 16, paddingVertical: 14,
          borderBottomWidth: 1, borderBottomColor: BORDER, backgroundColor: SURFACE,
        }}>
          <PressScale
            onPress={() => { hTap(); onClose(); }}
            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4, paddingRight: 12 }}
            scale={0.92}
          >
            <Ionicons name="chevron-back" size={22} color={PRIMARY} />
            <Text style={{ color: PRIMARY, fontSize: 16, fontWeight: '800' }}>Back</Text>
          </PressScale>
          <Text style={{ color: TEXT, fontSize: 17, fontWeight: '900', letterSpacing: 0.3 }}>
            📅 Calendar
          </Text>
          <PressScale
            onPress={jumpToToday}
            style={{
              backgroundColor: 'transparent',
              borderRadius: 10,
              borderWidth: 1.5,
              borderColor: PRIMARY,
              paddingVertical: 6, paddingHorizontal: 12,
              ...neonGlow(PRIMARY, 6, 0.35),
            }}
            scale={0.94}
          >
            <Text style={{ color: PRIMARY, fontWeight: '900', fontSize: 12 }}>Today</Text>
          </PressScale>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Month Navigator ─────────────────────────────────────────────── */}
          <View style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            paddingHorizontal: 16, paddingVertical: 14, gap: 12,
          }}>
            <PressScale
              onPress={prevMonth}
              style={{
                width: 40, height: 40, borderRadius: 10,
                backgroundColor: SURFACE, borderWidth: 1, borderColor: BORDER,
                alignItems: 'center', justifyContent: 'center',
              }}
              scale={0.9}
            >
              <Ionicons name="chevron-back" size={20} color={TEXT} />
            </PressScale>

            <PressScale
              onPress={() => {
                hTap();
                setPickerYear(year);
                setPickerOpen(true);
              }}
              scale={0.96}
              style={{
                flex: 1,
                alignItems: 'center',
                paddingVertical: 4,
                borderRadius: 10,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ color: PRIMARY, fontSize: 20, fontWeight: '900', letterSpacing: 0.4 }}>
                  {MONTH_NAMES[month]}
                </Text>
                <Ionicons name="chevron-down" size={16} color={PRIMARY} />
              </View>
              <Text style={{ color: LABEL, fontSize: 12, fontWeight: '700', marginTop: 2 }}>
                {year}
              </Text>
            </PressScale>

            <PressScale
              onPress={nextMonth}
              style={{
                width: 40, height: 40, borderRadius: 10,
                backgroundColor: SURFACE, borderWidth: 1, borderColor: BORDER,
                alignItems: 'center', justifyContent: 'center',
              }}
              scale={0.9}
            >
              <Ionicons name="chevron-forward" size={20} color={TEXT} />
            </PressScale>
          </View>

          {/* ── Metric Toggle ───────────────────────────────────────────────── */}
          <View style={{
            flexDirection: 'row', gap: 8,
            paddingHorizontal: 16, paddingBottom: 12,
          }}>
            {([
              { key: 'profit',   label: '💰 Profit'   },
              { key: 'revenue',  label: '📈 Revenue'  },
              { key: 'expenses', label: '💸 Expenses' },
            ] as { key: Metric; label: string }[]).map(m => {
              const active = metric === m.key;
              return (
                <PressScale
                  key={m.key}
                  onPress={() => { hTap(); setMetric(m.key); }}
                  scale={0.94}
                  style={{
                    flex: 1,
                    paddingVertical: 9, paddingHorizontal: 4,
                    borderRadius: 10,
                    backgroundColor: active ? 'rgba(250,204,21,0.15)' : SURFACE,
                    borderWidth: 1.5,
                    borderColor: active ? PRIMARY : BORDER,
                    alignItems: 'center',
                    ...(active ? neonGlow(PRIMARY, 6, 0.35) : {}),
                  }}
                >
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    style={{
                      color: active ? PRIMARY : LABEL,
                      fontWeight: active ? '900' : '700',
                      fontSize: 10,
                    }}
                  >
                    {m.label}
                  </Text>
                </PressScale>
              );
            })}
          </View>

          {/* ── Month Totals Strip ──────────────────────────────────────────── */}
          <View style={{
            flexDirection: 'row',
            marginHorizontal: 16, marginBottom: 14,
            backgroundColor: SURFACE, borderRadius: 12,
            borderWidth: 1, borderColor: BORDER,
          }}>
            <View style={{ flex: 1, paddingVertical: 10, paddingHorizontal: 4, alignItems: 'center' }}>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                style={{ color: LABEL, fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 }}
              >
                Profit
              </Text>
              <Text style={{
                color: monthTotals.profit >= 0 ? GREEN : RED,
                fontSize: 14, fontWeight: '900', marginTop: 2,
              }}>
                {hidden ? MASK : `$${monthTotals.profit.toFixed(0)}`}
              </Text>
            </View>
            <View style={{ width: 1, backgroundColor: BORDER, marginVertical: 8 }} />
            <View style={{ flex: 1, paddingVertical: 10, paddingHorizontal: 4, alignItems: 'center' }}>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                style={{ color: LABEL, fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 }}
              >
                Revenue
              </Text>
              <Text style={{ color: GREEN, fontSize: 14, fontWeight: '900', marginTop: 2 }}>
                {hidden ? MASK : `$${monthTotals.revenue.toFixed(0)}`}
              </Text>
            </View>
            <View style={{ width: 1, backgroundColor: BORDER, marginVertical: 8 }} />
            <View style={{ flex: 1, paddingVertical: 10, paddingHorizontal: 4, alignItems: 'center' }}>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                style={{ color: LABEL, fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 }}
              >
                Expenses
              </Text>
              <Text style={{ color: RED, fontSize: 14, fontWeight: '900', marginTop: 2 }}>
                {hidden ? MASK : `$${monthTotals.expenses.toFixed(0)}`}
              </Text>
            </View>
            <View style={{ width: 1, backgroundColor: BORDER, marginVertical: 8 }} />
            <View style={{ flex: 1, paddingVertical: 10, paddingHorizontal: 4, alignItems: 'center' }}>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                style={{ color: LABEL, fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 }}
              >
                Days
              </Text>
              <Text style={{ color: TEXT, fontSize: 14, fontWeight: '900', marginTop: 2 }}>
                {monthTotals.days}
              </Text>
            </View>
          </View>

          {/* ── Day-of-week Header (flush with grid) ────────────────────────── */}
          <View style={{
            flexDirection: 'row',
            marginHorizontal: 16,
            borderTopLeftRadius: 12,
            borderTopRightRadius: 12,
            borderWidth: 1,
            borderColor: BORDER,
            backgroundColor: SURFACE,
            overflow: 'hidden',
          }}>
            {DAY_NAMES.map((d, i) => (
              <View
                key={i}
                style={{
                  width: cellSize,
                  paddingVertical: 8,
                  alignItems: 'center',
                  borderRightWidth: i < 6 ? 1 : 0,
                  borderRightColor: BORDER,
                }}
              >
                <Text style={{
                  color: i === 0 || i === 6 ? PRIMARY : MUTED,
                  fontSize: 11,
                  fontWeight: '800',
                  letterSpacing: 0.5,
                }}>{d}</Text>
              </View>
            ))}
          </View>

          {/* ── Calendar Grid ───────────────────────────────────────────────── */}
          {isLoading ? (
            <View style={{ paddingVertical: 60, alignItems: 'center' }}>
              <ActivityIndicator color={PRIMARY} />
              <Text style={{ color: MUTED, marginTop: 10, fontSize: 12 }}>Loading month…</Text>
            </View>
          ) : isError ? (
            <View style={{ paddingVertical: 50, alignItems: 'center', gap: 10 }}>
              <Text style={{ fontSize: 32 }}>⚠️</Text>
              <Text style={{ color: TEXT, fontSize: 14, fontWeight: '700' }}>
                Couldn't load this month
              </Text>
              <Text style={{ color: MUTED, fontSize: 12, marginBottom: 4 }}>
                Check your connection and try again.
              </Text>
              <PressScale
                onPress={() => { hTap(); refetch(); }}
                style={{
                  backgroundColor: 'transparent',
                  borderWidth: 1.5,
                  borderColor: PRIMARY,
                  paddingHorizontal: 18, paddingVertical: 9, borderRadius: 10,
                  ...neonGlow(PRIMARY, 6, 0.35),
                }}
                scale={0.94}
              >
                <Text style={{ color: PRIMARY, fontWeight: '900', fontSize: 13 }}>Retry</Text>
              </PressScale>
            </View>
          ) : (
            <View style={{
              marginHorizontal: 16,
              flexDirection: 'row',
              flexWrap: 'wrap',
              borderLeftWidth: 1,
              borderRightWidth: 1,
              borderBottomWidth: 1,
              borderColor: BORDER,
              borderBottomLeftRadius: 12,
              borderBottomRightRadius: 12,
              overflow: 'hidden',
              backgroundColor: SURFACE,
            }}>
              {days.map((cell, idx) => {
                const isLastCol = idx % 7 === 6;
                const isLastRow = idx >= days.length - 7;

                if (cell === null) {
                  return (
                    <View
                      key={idx}
                      style={{
                        width: cellSize,
                        height: cellHeight,
                        backgroundColor: BG,
                        borderRightWidth: isLastCol ? 0 : 1,
                        borderBottomWidth: isLastRow ? 0 : 1,
                        borderColor: BORDER,
                      }}
                    />
                  );
                }

                const value = getValue(cell.dateStr);
                const data  = dailyData[cell.dateStr];
                const hasData = !!data && data.count > 0;
                const isToday = cell.dateStr === todayStr;
                const dotColor = getDotColor(value, hasData);
                const isSelected = selectedDays.has(cell.dateStr);

                // Day-number color: white by default, yellow if today, profit/loss tint if data.
                let dayNumColor: string;
                if (isToday)               dayNumColor = PRIMARY;
                else if (!hasData)         dayNumColor = TEXT;
                else if (metric === 'expenses') dayNumColor = value > 0 ? RED : TEXT;
                else if (value > 0)        dayNumColor = GREEN;
                else if (value < 0)        dayNumColor = RED;
                else                       dayNumColor = TEXT;

                // Soft yellow wash on selected cells so the neon ring reads cleanly.
                const cellBg = isSelected ? 'rgba(250,204,21,0.18)' : SURFACE;

                return (
                  <Pressable
                    key={idx}
                    onPress={() => handleDayPress(cell.dateStr)}
                    onLongPress={() => handleDayLongPress(cell.dateStr)}
                    delayLongPress={500}
                    style={{
                      width: cellSize,
                      height: cellHeight,
                      backgroundColor: cellBg,
                      borderRightWidth: isLastCol ? 0 : 1,
                      borderBottomWidth: isLastRow ? 0 : 1,
                      borderColor: BORDER,
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                    }}
                  >
                    {/* Neon-yellow ring + glow on every selected day */}
                    {isSelected && (
                      <View
                        pointerEvents="none"
                        style={{
                          position: 'absolute',
                          top: 0, left: 0, right: 0, bottom: 0,
                          borderWidth: 2,
                          borderColor: PRIMARY,
                          ...neonGlow(PRIMARY, 8, 0.65),
                        }}
                      />
                    )}
                    {/* Day number — perfectly centered */}
                    <Text
                      style={{
                        color: dayNumColor,
                        fontSize: 15,
                        fontWeight: isToday || isSelected ? '900' : '600',
                        lineHeight: 18,
                        textAlign: 'center',
                        textAlignVertical: 'center',
                        includeFontPadding: false,
                      }}
                    >
                      {cell.day}
                    </Text>
                    {/* Profit/loss dot — fixed-height row so cells stay aligned */}
                    <View style={{
                      height: 10,
                      marginTop: 4,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      {dotColor && (
                        <View style={{
                          width: 6,
                          height: 6,
                          borderRadius: 3,
                          backgroundColor: dotColor,
                        }} />
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}

          {/* ── Legend ──────────────────────────────────────────────────────── */}
          <View style={{
            marginHorizontal: 16, marginTop: 16,
            paddingTop: 12,
            borderTopWidth: 1, borderTopColor: BORDER,
            flexDirection: 'row', flexWrap: 'wrap', gap: 12,
          }}>
            {metric === 'expenses' ? (
              <>
                <LegendItem color={RED_LT} label="Low" />
                <LegendItem color={RED_MD} label="Medium" />
                <LegendItem color={RED_HI} label="High" />
              </>
            ) : (
              <>
                <LegendItem color={GREEN_LT} label={hidden ? 'Low' : '< $50'} />
                <LegendItem color={GREEN_MD} label={hidden ? 'Medium' : '$50-100'} />
                <LegendItem color={GREEN_HI} label={hidden ? 'High' : '> $100'} />
                <LegendItem color={RED_LT} label="Loss" />
              </>
            )}
          </View>

          {/* ── Quick Actions ───────────────────────────────────────────────── */}
          <View style={{
            flexDirection: 'row', gap: 8,
            marginHorizontal: 16, marginTop: 14,
          }}>
            <PressScale
              onPress={selectAllWithData}
              disabled={daysWithData.length === 0}
              scale={0.95}
              style={{
                flex: 1,
                paddingVertical: 10, paddingHorizontal: 8,
                borderRadius: 10,
                borderWidth: 1.5, borderColor: PRIMARY,
                backgroundColor: 'rgba(250,204,21,0.10)',
                alignItems: 'center',
                opacity: daysWithData.length === 0 ? 0.4 : 1,
                ...(daysWithData.length === 0 ? {} : neonGlow(PRIMARY, 6, 0.3)),
              }}
            >
              <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: PRIMARY, fontWeight: '900', fontSize: 11 }}>
                ✨ Select All Days w/ Data
              </Text>
            </PressScale>
            <PressScale
              onPress={clearSelection}
              disabled={selectedDays.size === 0}
              scale={0.95}
              style={{
                flex: 1,
                paddingVertical: 10, paddingHorizontal: 8,
                borderRadius: 10,
                borderWidth: 1, borderColor: BORDER,
                backgroundColor: SURFACE,
                alignItems: 'center',
                opacity: selectedDays.size === 0 ? 0.4 : 1,
              }}
            >
              <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: LABEL, fontWeight: '800', fontSize: 11 }}>
                Clear Selection
              </Text>
            </PressScale>
          </View>
          <Text style={{
            color: MUTED, fontSize: 10, marginTop: 6, marginHorizontal: 16,
            textAlign: 'center',
          }}>
            Tap days to select · long-press to fill a range
          </Text>

          {/* ── Selected Days Detail ────────────────────────────────────────── */}
          {selectionBounds && (
            <View style={{
              marginHorizontal: 16, marginTop: 14, marginBottom: 24,
              backgroundColor: SURFACE, borderRadius: 14,
              borderWidth: 1, borderColor: PRIMARY,
              ...neonGlow(PRIMARY, 6, 0.25),
            }}>
              {/* Header */}
              <View style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                paddingHorizontal: 14, paddingVertical: 12,
                borderBottomWidth: 1, borderBottomColor: DIVIDER,
              }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: PRIMARY, fontSize: 14, fontWeight: '900' }}>
                    {selectionTotals.dayCount} day{selectionTotals.dayCount === 1 ? '' : 's'} selected
                  </Text>
                  <Text style={{ color: MUTED, fontSize: 11, marginTop: 2 }}>
                    {selectionBounds.from === selectionBounds.to
                      ? formatHumanDate(selectionBounds.from)
                      : `${formatHumanDate(selectionBounds.from)} → ${formatHumanDate(selectionBounds.to)}`}
                  </Text>
                </View>
                <Pressable onPress={clearSelection} hitSlop={10}>
                  <Ionicons name="close" size={18} color={LABEL} />
                </Pressable>
              </View>

              {/* Summary stats — Entries / Revenue / Expenses / Net Profit */}
              <View style={{
                flexDirection: 'row',
                paddingVertical: 12, paddingHorizontal: 8,
                borderBottomWidth: 1, borderBottomColor: DIVIDER,
              }}>
                <DayStat label="Entries"  value={`${selectionTotals.entryCount}`}             color={TEXT} />
                <DayStat label="Revenue"  value={hidden ? MASK : `$${selectionTotals.revenue.toFixed(2)}`}    color={GREEN} />
                <DayStat label="Expenses" value={hidden ? MASK : `$${selectionTotals.expenses.toFixed(2)}`}   color={RED} />
                <DayStat label="Net"      value={hidden ? MASK : `$${selectionTotals.profit.toFixed(2)}`}     color={selectionTotals.profit >= 0 ? GREEN : RED} last />
              </View>

              {/* Apply to Dashboard */}
              <View style={{
                flexDirection: 'row', gap: 10,
                paddingHorizontal: 14, paddingTop: 12,
              }}>
                <Pressable
                  onPress={() => {
                    if (!selectionBounds || !onApplyRange) return;
                    hTap();
                    onApplyRange(selectionBounds.from, selectionBounds.to);
                    onClose();
                  }}
                  disabled={!onApplyRange}
                  style={{
                    flex: 1,
                    paddingVertical: 12, borderRadius: 10,
                    backgroundColor: PRIMARY,
                    alignItems: 'center', justifyContent: 'center',
                    ...neonGlow(PRIMARY, 12, 0.7),
                    opacity: onApplyRange ? 1 : 0.5,
                  }}
                >
                  <Text style={{ color: '#000', fontWeight: '900', fontSize: 14 }}>
                    Apply Range to Dashboard
                  </Text>
                </Pressable>
              </View>

              {/* Erase Selected Days — destructive */}
              <View style={{ paddingHorizontal: 14, paddingTop: 10, paddingBottom: 14 }}>
                <Pressable
                  onPress={confirmErase}
                  disabled={
                    !onDeleteEntries ||
                    selectedEntries.length === 0 ||
                    erasing
                  }
                  style={{
                    paddingVertical: 13, borderRadius: 10,
                    backgroundColor: 'transparent',
                    borderWidth: 1.5, borderColor: RED,
                    alignItems: 'center', justifyContent: 'center',
                    flexDirection: 'row', gap: 8,
                    opacity:
                      !onDeleteEntries || selectedEntries.length === 0 || erasing
                        ? 0.45
                        : 1,
                    ...(selectedEntries.length > 0 && !erasing
                      ? neonGlow(RED, 10, 0.6)
                      : {}),
                  }}
                >
                  {erasing ? (
                    <ActivityIndicator color={RED} />
                  ) : (
                    <Ionicons name="trash-outline" size={16} color={RED} />
                  )}
                  <Text style={{ color: RED, fontWeight: '900', fontSize: 13, letterSpacing: 0.3 }}>
                    {erasing
                      ? 'Erasing…'
                      : selectedEntries.length === 0
                        ? 'No entries on selected days'
                        : `Erase Selected Day${selectionTotals.daysWithData === 1 ? '' : 's'} (${selectedEntries.length})`}
                  </Text>
                </Pressable>
              </View>
            </View>
          )}
        </ScrollView>
      </View>

      {/* ── Month / Year Picker Overlay ───────────────────────────────────── */}
      <Modal
        visible={pickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerOpen(false)}
      >
        <Pressable
          onPress={() => setPickerOpen(false)}
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.65)',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          {/* Stop propagation so taps inside the card don't dismiss it */}
          <Pressable
            onPress={() => {}}
            style={{
              width: '100%',
              maxWidth: 360,
              backgroundColor: SURFACE,
              borderWidth: 1, borderColor: BORDER,
              borderRadius: 16,
              padding: 16,
              ...neonGlow(PRIMARY, 14, 0.25),
            }}
          >
            {/* Year selector row */}
            <View style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 14,
            }}>
              <PressScale
                onPress={() => { hTap(); setPickerYear(y => y - 1); }}
                scale={0.9}
                style={{
                  width: 38, height: 38, borderRadius: 10,
                  backgroundColor: BG, borderWidth: 1, borderColor: BORDER,
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Ionicons name="chevron-back" size={18} color={TEXT} />
              </PressScale>
              <Text style={{ color: PRIMARY, fontSize: 22, fontWeight: '900', letterSpacing: 0.4 }}>
                {pickerYear}
              </Text>
              <PressScale
                onPress={() => { hTap(); setPickerYear(y => y + 1); }}
                scale={0.9}
                style={{
                  width: 38, height: 38, borderRadius: 10,
                  backgroundColor: BG, borderWidth: 1, borderColor: BORDER,
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Ionicons name="chevron-forward" size={18} color={TEXT} />
              </PressScale>
            </View>

            {/* Month grid: 4 rows × 3 cols */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {MONTH_NAMES.map((name, i) => {
                const isCurrent = i === month && pickerYear === year;
                const todayDate = new Date();
                const isThisMonth = i === todayDate.getMonth() && pickerYear === todayDate.getFullYear();
                return (
                  <PressScale
                    key={i}
                    onPress={() => {
                      hTap();
                      setMonth(i);
                      setYear(pickerYear);
                      setPickerOpen(false);
                    }}
                    scale={0.94}
                    style={{
                      width: '31.5%',
                      paddingVertical: 14,
                      borderRadius: 10,
                      borderWidth: 1.5,
                      borderColor: isCurrent ? PRIMARY : BORDER,
                      backgroundColor: isCurrent ? 'rgba(250,204,21,0.18)' : BG,
                      alignItems: 'center',
                      ...(isCurrent ? neonGlow(PRIMARY, 6, 0.4) : {}),
                    }}
                  >
                    <Text style={{
                      color: isCurrent ? PRIMARY : isThisMonth ? PRIMARY : TEXT,
                      fontSize: 14,
                      fontWeight: isCurrent ? '900' : '700',
                      letterSpacing: 0.3,
                    }}>
                      {name.slice(0, 3)}
                    </Text>
                    {isThisMonth && !isCurrent && (
                      <View style={{
                        width: 4, height: 4, borderRadius: 2,
                        backgroundColor: PRIMARY,
                        marginTop: 4,
                      }} />
                    )}
                  </PressScale>
                );
              })}
            </View>

            {/* Footer actions */}
            <View style={{
              flexDirection: 'row', gap: 8,
              marginTop: 14,
            }}>
              <PressScale
                onPress={() => {
                  hTap();
                  const t = new Date();
                  setMonth(t.getMonth());
                  setYear(t.getFullYear());
                  setPickerYear(t.getFullYear());
                  setPickerOpen(false);
                }}
                scale={0.95}
                style={{
                  flex: 1,
                  paddingVertical: 11,
                  borderRadius: 10,
                  borderWidth: 1.5,
                  borderColor: PRIMARY,
                  backgroundColor: 'transparent',
                  alignItems: 'center',
                  ...neonGlow(PRIMARY, 6, 0.3),
                }}
              >
                <Text style={{ color: PRIMARY, fontWeight: '900', fontSize: 13 }}>Jump to Today</Text>
              </PressScale>
              <PressScale
                onPress={() => { hTap(); setPickerOpen(false); }}
                scale={0.95}
                style={{
                  flex: 1,
                  paddingVertical: 11,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: BORDER,
                  backgroundColor: BG,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: LABEL, fontWeight: '800', fontSize: 13 }}>Cancel</Text>
              </PressScale>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </Modal>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  const { BORDER, MUTED } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 14, height: 14, borderRadius: 4, backgroundColor: color, borderWidth: 1, borderColor: BORDER }} />
      <Text style={{ color: MUTED, fontSize: 11, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

function DayStat({
  label, value, color, last,
}: { label: string; value: string; color: string; last?: boolean }) {
  const { DIVIDER, LABEL } = useTheme();
  return (
    <View style={{
      flex: 1, alignItems: 'center',
      borderRightWidth: last ? 0 : 1, borderRightColor: DIVIDER,
    }}>
      <Text style={{ color: LABEL, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 }}>
        {label}
      </Text>
      <Text style={{ color, fontSize: 14, fontWeight: '900', marginTop: 2 }}>
        {value}
      </Text>
    </View>
  );
}

function formatHumanDate(yyyymmdd: string): string {
  const [y, m, d] = yyyymmdd.split('-').map(n => parseInt(n, 10));
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });
}
