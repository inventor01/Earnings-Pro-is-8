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

// ─── Theme tokens (mirror dashboard's Dark Neon palette) ──────────────────────
const BG       = '#0a0a0a';
const SURFACE  = '#111';
const CARD     = '#1a1a1a';
const BORDER   = '#262626';
const DIVIDER  = '#1f1f1f';
const TEXT     = '#fff';
const LABEL    = '#9ca3af';
const MUTED    = '#6b7280';
const PRIMARY  = '#facc15';
const GREEN    = '#22c55e';
const GREEN_LT = 'rgba(34,197,94,0.18)';
const GREEN_MD = 'rgba(34,197,94,0.32)';
const GREEN_HI = 'rgba(34,197,94,0.55)';
const RED      = '#ef4444';
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
}

export function CalendarModal({ visible, onClose }: CalendarModalProps) {
  const insets = useSafeAreaInsets();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear]   = useState(now.getFullYear());
  const [metric, setMetric] = useState<Metric>('profit');
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

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
    setSelectedDay(null);
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }

  function nextMonth() {
    hTap();
    setSelectedDay(null);
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }

  function jumpToToday() {
    hTap();
    const t = new Date();
    setMonth(t.getMonth());
    setYear(t.getFullYear());
    setSelectedDay(estDateString(t));
  }

  // Entries list for selected day.
  const selectedDayEntries = useMemo(() => {
    if (!selectedDay) return [];
    return entries
      .filter(e => entryDateStr(e) === selectedDay)
      .sort((a, b) => {
        const ta = new Date((a as any).timestamp || (a as any).created_at || 0).getTime();
        const tb = new Date((b as any).timestamp || (b as any).created_at || 0).getTime();
        return tb - ta;
      });
  }, [selectedDay, entries]);

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

            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ color: PRIMARY, fontSize: 20, fontWeight: '900', letterSpacing: 0.4 }}>
                {MONTH_NAMES[month]}
              </Text>
              <Text style={{ color: LABEL, fontSize: 12, fontWeight: '700', marginTop: 2 }}>
                {year}
              </Text>
            </View>

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
                const isSelected = cell.dateStr === selectedDay;
                const isToday = cell.dateStr === todayStr;
                const dotColor = getDotColor(value, hasData);

                // Day-number color: white by default, yellow if today, profit/loss tint if data.
                let dayNumColor: string;
                if (isToday)               dayNumColor = PRIMARY;
                else if (!hasData)         dayNumColor = TEXT;
                else if (metric === 'expenses') dayNumColor = value > 0 ? RED : TEXT;
                else if (value > 0)        dayNumColor = GREEN;
                else if (value < 0)        dayNumColor = RED;
                else                       dayNumColor = TEXT;

                return (
                  <Pressable
                    key={idx}
                    onPress={() => {
                      hTap();
                      setSelectedDay(prev => prev === cell.dateStr ? null : cell.dateStr);
                    }}
                    style={{
                      width: cellSize,
                      height: cellHeight,
                      backgroundColor: SURFACE,
                      borderRightWidth: isLastCol ? 0 : 1,
                      borderBottomWidth: isLastRow ? 0 : 1,
                      borderColor: BORDER,
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                    }}
                  >
                    {/* Selected ring overlay */}
                    {isSelected && (
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
                <LegendItem color={GREEN_LT} label="< $50" />
                <LegendItem color={GREEN_MD} label="$50-100" />
                <LegendItem color={GREEN_HI} label="> $100" />
                <LegendItem color={RED_LT} label="Loss" />
              </>
            )}
          </View>

          {/* ── Selected Day Detail ─────────────────────────────────────────── */}
          {selectedDay && (
            <View style={{
              marginHorizontal: 16, marginTop: 18,
              backgroundColor: SURFACE, borderRadius: 14,
              borderWidth: 1, borderColor: PRIMARY,
              ...neonGlow(PRIMARY, 6, 0.25),
            }}>
              <View style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                paddingHorizontal: 14, paddingVertical: 12,
                borderBottomWidth: 1, borderBottomColor: DIVIDER,
              }}>
                <Text style={{ color: PRIMARY, fontSize: 14, fontWeight: '900' }}>
                  {formatHumanDate(selectedDay)}
                </Text>
                <Pressable onPress={() => { hTap(); setSelectedDay(null); }} hitSlop={10}>
                  <Ionicons name="close" size={18} color={LABEL} />
                </Pressable>
              </View>

              {/* Day stats */}
              {(() => {
                const d = dailyData[selectedDay];
                if (!d || d.count === 0) {
                  return (
                    <View style={{ padding: 18, alignItems: 'center' }}>
                      <Text style={{ fontSize: 28 }}>🗓️</Text>
                      <Text style={{ color: MUTED, fontSize: 13, marginTop: 8 }}>
                        No entries on this day.
                      </Text>
                    </View>
                  );
                }
                return (
                  <>
                    <View style={{
                      flexDirection: 'row',
                      paddingVertical: 12, paddingHorizontal: 14,
                      borderBottomWidth: 1, borderBottomColor: DIVIDER,
                    }}>
                      <DayStat label="Profit"   value={`$${d.profit.toFixed(2)}`}   color={d.profit >= 0 ? GREEN : RED} />
                      <DayStat label="Revenue"  value={`$${d.revenue.toFixed(2)}`}  color={GREEN} />
                      <DayStat label="Expenses" value={`$${d.expenses.toFixed(2)}`} color={RED} last />
                    </View>

                    {selectedDayEntries.map(e => {
                      const amt = Number(e.amount) || 0;
                      const isExpense = amt < 0;
                      return (
                        <View key={e.id} style={{
                          flexDirection: 'row', alignItems: 'center',
                          paddingHorizontal: 14, paddingVertical: 10,
                          borderBottomWidth: 1, borderBottomColor: DIVIDER,
                          gap: 10,
                        }}>
                          <View style={{
                            width: 32, height: 32, borderRadius: 8,
                            backgroundColor: APP_COLORS[e.app] || '#444',
                            alignItems: 'center', justifyContent: 'center',
                          }}>
                            <Text style={{ color: '#fff', fontWeight: '900', fontSize: 13 }}>
                              {(APP_LABELS[e.app] || 'O')[0]}
                            </Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: TEXT, fontWeight: '700', fontSize: 13 }}>
                              {APP_LABELS[e.app] || e.app}
                            </Text>
                            <Text style={{ color: MUTED, fontSize: 11, marginTop: 1 }}>
                              {e.type}{e.category ? ` · ${e.category}` : ''}
                            </Text>
                          </View>
                          <Text style={{
                            color: isExpense ? RED : GREEN,
                            fontWeight: '900', fontSize: 14,
                          }}>
                            {isExpense ? '-' : '+'}${Math.abs(amt).toFixed(2)}
                          </Text>
                        </View>
                      );
                    })}
                  </>
                );
              })()}
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
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
