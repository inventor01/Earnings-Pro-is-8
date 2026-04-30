import { useMemo, useState } from 'react';
import {
  View, Text, Pressable, Modal, ScrollView, ActivityIndicator,
  ViewStyle, Platform, useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, Entry, APP_LABELS, APP_COLORS } from '../lib/api';
import { useTheme } from '../lib/theme';

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
}

export function CalendarModal({ visible, onClose, onApplyRange }: CalendarModalProps) {
  const { BG, SURFACE, CARD, BORDER, DIVIDER, TEXT, LABEL, MUTED, PRIMARY, GREEN, RED, ON_PRIMARY } = useTheme();
  const insets = useSafeAreaInsets();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear]   = useState(now.getFullYear());
  const [metric, setMetric] = useState<Metric>('profit');
  // Range selection: rangeStart is set on first tap; rangeEnd is set on second tap.
  // While only rangeStart is set (rangeEnd === null), it's treated as a 1-day "in progress" range.
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [rangeEnd, setRangeEnd]     = useState<string | null>(null);
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

  // Normalized [from, to] of the current selection (ascending), or null when nothing is selected.
  const normalizedRange = useMemo<{ from: string; to: string } | null>(() => {
    if (!rangeStart) return null;
    const end = rangeEnd ?? rangeStart;
    if (rangeStart <= end) return { from: rangeStart, to: end };
    return { from: end, to: rangeStart };
  }, [rangeStart, rangeEnd]);

  // Entries that fall within the selected range (sorted newest first).
  const rangeEntries = useMemo(() => {
    if (!normalizedRange) return [];
    return entries
      .filter(e => {
        const ds = entryDateStr(e);
        return ds >= normalizedRange.from && ds <= normalizedRange.to;
      })
      .sort((a, b) => {
        const ta = new Date((a as any).timestamp || (a as any).created_at || 0).getTime();
        const tb = new Date((b as any).timestamp || (b as any).created_at || 0).getTime();
        return tb - ta;
      });
  }, [normalizedRange, entries]);

  // Aggregated totals across the selected range.
  const rangeTotals = useMemo(() => {
    if (!normalizedRange) return { profit: 0, revenue: 0, expenses: 0, days: 0, entryCount: 0 };
    let profit = 0, revenue = 0, expenses = 0, days = 0;
    for (const k of Object.keys(dailyData)) {
      if (k >= normalizedRange.from && k <= normalizedRange.to) {
        const d = dailyData[k];
        profit   += d.profit;
        revenue  += d.revenue;
        expenses += d.expenses;
        if (d.count > 0) days += 1;
      }
    }
    return { profit, revenue, expenses, days, entryCount: rangeEntries.length };
  }, [normalizedRange, dailyData, rangeEntries]);

  // Inclusive count of calendar days in the range (selected days, not just days with data).
  const rangeDayCount = useMemo(() => {
    if (!normalizedRange) return 0;
    const f = parseEstYmd(normalizedRange.from);
    const t = parseEstYmd(normalizedRange.to);
    return Math.round((t.getTime() - f.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  }, [normalizedRange]);

  // Tap handler that drives 2-tap range selection.
  function handleDayPress(dateStr: string) {
    hTap();
    // Start a new range if nothing selected, OR if a complete range exists.
    if (!rangeStart || (rangeStart && rangeEnd)) {
      setRangeStart(dateStr);
      setRangeEnd(null);
      return;
    }
    // Have a start, no end → complete the range.
    if (dateStr === rangeStart) {
      // Tapping the same day twice → keep it as a single-day selection (commit it).
      setRangeEnd(dateStr);
      return;
    }
    if (dateStr < rangeStart) {
      setRangeEnd(rangeStart);
      setRangeStart(dateStr);
    } else {
      setRangeEnd(dateStr);
    }
  }

  function clearRange() {
    hTap();
    setRangeStart(null);
    setRangeEnd(null);
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
                ${monthTotals.profit.toFixed(0)}
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
                ${monthTotals.revenue.toFixed(0)}
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
                ${monthTotals.expenses.toFixed(0)}
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

                // Range-selection visuals.
                const isRangeStart = !!normalizedRange && cell.dateStr === normalizedRange.from;
                const isRangeEnd   = !!normalizedRange && cell.dateStr === normalizedRange.to;
                const isInRange    = !!normalizedRange &&
                  cell.dateStr >= normalizedRange.from &&
                  cell.dateStr <= normalizedRange.to;
                const isRangeMiddle = isInRange && !isRangeStart && !isRangeEnd;
                const isEndpoint   = isRangeStart || isRangeEnd;

                // Day-number color: white by default, yellow if today, profit/loss tint if data.
                let dayNumColor: string;
                if (isToday)               dayNumColor = PRIMARY;
                else if (!hasData)         dayNumColor = TEXT;
                else if (metric === 'expenses') dayNumColor = value > 0 ? RED : TEXT;
                else if (value > 0)        dayNumColor = GREEN;
                else if (value < 0)        dayNumColor = RED;
                else                       dayNumColor = TEXT;

                // Soft yellow tint for in-range middle days.
                const cellBg = isRangeMiddle ? 'rgba(250,204,21,0.12)' : SURFACE;

                return (
                  <Pressable
                    key={idx}
                    onPress={() => handleDayPress(cell.dateStr)}
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
                    {/* Endpoint ring overlay (start/end of range) */}
                    {isEndpoint && (
                      <View
                        pointerEvents="none"
                        style={{
                          position: 'absolute',
                          top: 0, left: 0, right: 0, bottom: 0,
                          borderWidth: 2,
                          borderColor: PRIMARY,
                          ...neonGlow(PRIMARY, 8, 0.6),
                        }}
                      />
                    )}
                    {/* Day number — perfectly centered */}
                    <Text
                      style={{
                        color: dayNumColor,
                        fontSize: 15,
                        fontWeight: isToday || isEndpoint ? '900' : '600',
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
                <LegendItem color={GREEN_LT} label="< $50" />
                <LegendItem color={GREEN_MD} label="$50-100" />
                <LegendItem color={GREEN_HI} label="> $100" />
                <LegendItem color={RED_LT} label="Loss" />
              </>
            )}
          </View>

          {/* ── Selected Range Detail ───────────────────────────────────────── */}
          {normalizedRange && (
            <View style={{
              marginHorizontal: 16, marginTop: 18, marginBottom: 24,
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
                    {normalizedRange.from === normalizedRange.to
                      ? formatHumanDate(normalizedRange.from)
                      : `${formatHumanDate(normalizedRange.from)} → ${formatHumanDate(normalizedRange.to)}`}
                  </Text>
                  <Text style={{ color: MUTED, fontSize: 11, marginTop: 2 }}>
                    {rangeDayCount} day{rangeDayCount === 1 ? '' : 's'}
                    {!rangeEnd ? ' · tap another day to extend' : ''}
                  </Text>
                </View>
                <Pressable onPress={clearRange} hitSlop={10}>
                  <Ionicons name="close" size={18} color={LABEL} />
                </Pressable>
              </View>

              {/* Range stats */}
              {rangeTotals.entryCount === 0 ? (
                <View style={{ padding: 18, alignItems: 'center' }}>
                  <Text style={{ fontSize: 28 }}>🗓️</Text>
                  <Text style={{ color: MUTED, fontSize: 13, marginTop: 8 }}>
                    No entries in this range.
                  </Text>
                </View>
              ) : (
                <View style={{
                  flexDirection: 'row',
                  paddingVertical: 12, paddingHorizontal: 14,
                  borderBottomWidth: 1, borderBottomColor: DIVIDER,
                }}>
                  <DayStat label="Profit"   value={`$${rangeTotals.profit.toFixed(2)}`}   color={rangeTotals.profit >= 0 ? GREEN : RED} />
                  <DayStat label="Revenue"  value={`$${rangeTotals.revenue.toFixed(2)}`}  color={GREEN} />
                  <DayStat label="Expenses" value={`$${rangeTotals.expenses.toFixed(2)}`} color={RED} last />
                </View>
              )}

              {/* Action row */}
              <View style={{
                flexDirection: 'row', gap: 10,
                paddingHorizontal: 14, paddingVertical: 12,
              }}>
                <Pressable
                  onPress={clearRange}
                  style={{
                    flex: 1,
                    paddingVertical: 12, borderRadius: 10,
                    borderWidth: 1, borderColor: BORDER,
                    alignItems: 'center', justifyContent: 'center',
                    backgroundColor: 'transparent',
                  }}
                >
                  <Text style={{ color: LABEL, fontWeight: '800', fontSize: 13 }}>
                    Clear
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    if (!normalizedRange || !onApplyRange) return;
                    hTap();
                    onApplyRange(normalizedRange.from, normalizedRange.to);
                    onClose();
                  }}
                  disabled={!onApplyRange}
                  style={{
                    flex: 2,
                    paddingVertical: 12, borderRadius: 10,
                    backgroundColor: PRIMARY,
                    alignItems: 'center', justifyContent: 'center',
                    ...neonGlow(PRIMARY, 12, 0.7),
                    opacity: onApplyRange ? 1 : 0.5,
                  }}
                >
                  <Text style={{ color: '#000', fontWeight: '900', fontSize: 14 }}>
                    Apply to Dashboard
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
