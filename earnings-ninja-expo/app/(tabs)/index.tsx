import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable,
  RefreshControl, ActivityIndicator, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api, APP_COLORS, APP_LABELS, Entry } from '@/lib/api';
import { useAuth } from '@/lib/authContext';

const BG = '#0a0a0f';
const SURFACE = '#111118';
const CARD = '#16161f';
const BORDER = '#1e1e2e';
const ACCENT = '#facc15';
const GREEN = '#22c55e';
const RED = '#ef4444';
const TEXT = '#f1f5f9';
const MUTED = '#94a3b8';
const DIM = '#4b5563';

type Period = 'today' | 'yesterday' | 'week' | 'last7' | 'month';

const PERIODS: { key: Period; label: string; tf: string }[] = [
  { key: 'today', label: 'Today', tf: 'TODAY' },
  { key: 'yesterday', label: 'Yesterday', tf: 'YESTERDAY' },
  { key: 'week', label: 'This Week', tf: 'THIS_WEEK' },
  { key: 'last7', label: 'Last 7', tf: 'LAST_7_DAYS' },
  { key: 'month', label: 'Month', tf: 'THIS_MONTH' },
];

interface KpiCardProps {
  label: string;
  value: string;
  color: string;
  sub?: string;
}

function KpiCard({ label, value, color, sub }: KpiCardProps) {
  return (
    <View style={{
      flex: 1,
      backgroundColor: CARD,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: color + '55',
      padding: 14,
      shadowColor: color,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.25,
      shadowRadius: 10,
      elevation: 6,
      minWidth: 0,
    }}>
      {/* Top glow bar */}
      <View style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        height: 2, backgroundColor: color, borderTopLeftRadius: 16, borderTopRightRadius: 16,
        opacity: 0.7,
      }} />
      <Text style={{
        color: color,
        fontSize: 10,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 4,
        fontVariant: ['tabular-nums'],
      }}>
        {label}
      </Text>
      <Text style={{
        color: color,
        fontSize: 22,
        fontWeight: '900',
        fontVariant: ['tabular-nums'],
        textShadowColor: color,
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 8,
      }}>
        {value}
      </Text>
      {sub && (
        <Text style={{ color: MUTED, fontSize: 10, marginTop: 3 }}>{sub}</Text>
      )}
    </View>
  );
}

function ProfitHeroCard({ profit, revenue, expenses }: { profit: number; revenue: number; expenses: number }) {
  const isPositive = profit >= 0;
  const color = isPositive ? GREEN : RED;
  return (
    <View style={{
      backgroundColor: CARD,
      borderRadius: 20,
      borderWidth: 2,
      borderColor: color + '66',
      padding: 24,
      alignItems: 'center',
      shadowColor: color,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.35,
      shadowRadius: 18,
      elevation: 10,
      marginBottom: 4,
    }}>
      {/* Top glow bar */}
      <View style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        height: 3, backgroundColor: color, borderTopLeftRadius: 20, borderTopRightRadius: 20,
        opacity: 0.8,
      }} />
      <Text style={{
        color: MUTED,
        fontSize: 11,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 2,
        marginBottom: 6,
      }}>
        NET PROFIT
      </Text>
      <Text style={{
        color: color,
        fontSize: 56,
        fontWeight: '900',
        fontVariant: ['tabular-nums'],
        textShadowColor: color,
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 16,
        lineHeight: 64,
      }}>
        {isPositive ? '' : '-'}${Math.abs(profit).toFixed(2)}
      </Text>
      <View style={{ flexDirection: 'row', gap: 24, marginTop: 12 }}>
        <View style={{ alignItems: 'center' }}>
          <Text style={{ color: MUTED, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 }}>Revenue</Text>
          <Text style={{ color: GREEN, fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'] }}>${revenue.toFixed(2)}</Text>
        </View>
        <View style={{ width: 1, backgroundColor: BORDER }} />
        <View style={{ alignItems: 'center' }}>
          <Text style={{ color: MUTED, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 }}>Expenses</Text>
          <Text style={{ color: RED, fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'] }}>-${Math.abs(expenses).toFixed(2)}</Text>
        </View>
      </View>
    </View>
  );
}

function GoalBar({ progress, goal, current }: { progress: number; goal: number; current: number }) {
  const pct = Math.min(progress, 100);
  const color = pct >= 100 ? ACCENT : pct >= 60 ? GREEN : '#3b82f6';
  return (
    <View style={{
      backgroundColor: CARD,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: BORDER,
      padding: 14,
    }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
        <Text style={{ color: MUTED, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 }}>
          🎯 Goal Progress
        </Text>
        <Text style={{ color: color, fontSize: 12, fontWeight: '800' }}>
          {pct.toFixed(0)}% · ${current.toFixed(0)} / ${goal.toFixed(0)}
        </Text>
      </View>
      <View style={{ backgroundColor: '#1e1e2e', borderRadius: 8, height: 10, overflow: 'hidden' }}>
        <View style={{
          width: `${pct}%`,
          height: '100%',
          backgroundColor: color,
          borderRadius: 8,
          shadowColor: color,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.8,
          shadowRadius: 6,
        }} />
      </View>
      {pct >= 100 && (
        <Text style={{ color: ACCENT, fontSize: 13, fontWeight: '800', textAlign: 'center', marginTop: 8 }}>
          🎉 Goal Reached! Excellent work!
        </Text>
      )}
    </View>
  );
}

function EntryRow({ entry, onDelete }: { entry: Entry; onDelete: (id: number) => void }) {
  const isExpense = entry.amount < 0 || entry.type === 'EXPENSE';
  const color = isExpense ? RED : GREEN;
  const amt = Math.abs(entry.amount);
  const time = new Date(entry.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  return (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderBottomWidth: 1,
      borderBottomColor: BORDER,
    }}>
      <View style={{
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: (APP_COLORS[entry.app] || DIM) + '22',
        borderWidth: 1.5,
        borderColor: APP_COLORS[entry.app] || DIM,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
      }}>
        <Text style={{ fontSize: 14, fontWeight: '900', color: APP_COLORS[entry.app] || DIM }}>
          {(APP_LABELS[entry.app] || 'O')[0]}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: TEXT, fontSize: 14, fontWeight: '700' }}>
          {APP_LABELS[entry.app] || entry.app}
        </Text>
        <Text style={{ color: MUTED, fontSize: 11, marginTop: 1 }}>
          {entry.type} · {time}
          {entry.distance_miles > 0 ? ` · ${entry.distance_miles.toFixed(1)} mi` : ''}
        </Text>
      </View>
      <Text style={{ color, fontSize: 16, fontWeight: '900', fontVariant: ['tabular-nums'] }}>
        {isExpense ? '-' : '+'}${amt.toFixed(2)}
      </Text>
      <Pressable onPress={() => onDelete(entry.id)} style={{ marginLeft: 12, padding: 4 }}>
        <Ionicons name="trash-outline" size={16} color="#4b5563" />
      </Pressable>
    </View>
  );
}

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const { logout } = useAuth();
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<Period>('today');
  const [refreshing, setRefreshing] = useState(false);

  const tf = PERIODS.find(p => p.key === period)?.tf || 'TODAY';

  const { data: rollup, isLoading: rollupLoading } = useQuery({
    queryKey: ['rollup', tf],
    queryFn: () => api.getRollup(tf as any),
  });

  const { data: entries = [] } = useQuery({
    queryKey: ['entries', tf],
    queryFn: () => api.getEntries(tf as any),
  });

  const { data: goal } = useQuery({
    queryKey: ['goal', tf],
    queryFn: () => api.getGoal(tf as any),
  });

  const { data: aiSuggestion } = useQuery({
    queryKey: ['ai-suggestion'],
    queryFn: api.getSuggestions,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteEntry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries'] });
      queryClient.invalidateQueries({ queryKey: ['rollup'] });
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['rollup'] });
    await queryClient.invalidateQueries({ queryKey: ['entries'] });
    setRefreshing(false);
  }, [queryClient]);

  const profit = rollup?.profit ?? 0;
  const revenue = rollup?.revenue ?? 0;
  const expenses = rollup?.expenses ?? 0;
  const miles = rollup?.miles ?? 0;
  const perMile = rollup?.dollars_per_mile ?? 0;
  const perHour = rollup?.dollars_per_hour ?? 0;
  const avgOrder = rollup?.average_order_value ?? 0;

  const goalTarget = goal?.target_profit ?? 0;
  const goalProgress = goalTarget > 0 ? (profit / goalTarget) * 100 : 0;

  const recentEntries = entries.slice(0, 10);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: BG }}
      contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={ACCENT}
          colors={[ACCENT]}
        />
      }
    >
      {/* Header */}
      <View style={{
        paddingTop: insets.top + 12,
        paddingHorizontal: 16,
        paddingBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottomWidth: 1,
        borderBottomColor: BORDER,
        backgroundColor: SURFACE,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Image
            source={require('../../assets/ninja-logo.png')}
            style={{
              width: 40,
              height: 40,
              resizeMode: 'contain',
            }}
          />
          <View>
            <Text style={{
              color: ACCENT,
              fontSize: 18,
              fontWeight: '900',
              letterSpacing: 0.5,
              textShadowColor: ACCENT,
              textShadowOffset: { width: 0, height: 0 },
              textShadowRadius: 8,
            }}>
              Earnings Ninja
            </Text>
            <Text style={{ color: MUTED, fontSize: 11 }}>🚗 Dashboard</Text>
          </View>
        </View>
        <Pressable onPress={logout} style={{ padding: 8 }}>
          <Ionicons name="log-out-outline" size={22} color={MUTED} />
        </Pressable>
      </View>

      <View style={{ paddingHorizontal: 14, paddingTop: 14, gap: 12 }}>
        {/* Period Chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -4 }}>
          <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 4, paddingVertical: 2 }}>
            {PERIODS.map((p) => (
              <Pressable
                key={p.key}
                onPress={() => setPeriod(p.key)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 20,
                  backgroundColor: period === p.key ? ACCENT : CARD,
                  borderWidth: 1.5,
                  borderColor: period === p.key ? ACCENT : BORDER,
                  shadowColor: period === p.key ? ACCENT : 'transparent',
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.5,
                  shadowRadius: 8,
                }}
              >
                <Text style={{
                  color: period === p.key ? '#000' : MUTED,
                  fontSize: 13,
                  fontWeight: '700',
                }}>
                  {p.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        {rollupLoading ? (
          <View style={{ alignItems: 'center', paddingVertical: 40 }}>
            <ActivityIndicator color={ACCENT} size="large" />
          </View>
        ) : (
          <>
            {/* Profit Hero Card */}
            <ProfitHeroCard profit={profit} revenue={revenue} expenses={Math.abs(expenses)} />

            {/* Goal Bar */}
            {goalTarget > 0 && (
              <GoalBar progress={goalProgress} goal={goalTarget} current={profit} />
            )}

            {/* KPI Grid */}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <KpiCard label="$/Hour" value={`$${perHour.toFixed(2)}`} color="#3b82f6" />
              <KpiCard label="$/Mile" value={`$${perMile.toFixed(2)}`} color="#a855f7" />
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <KpiCard label="Miles" value={miles.toFixed(1)} color="#f97316" />
              <KpiCard label="Avg Order" value={`$${avgOrder.toFixed(2)}`} color={ACCENT} />
            </View>

            {/* AI Suggestion */}
            {aiSuggestion && (
              <View style={{
                backgroundColor: CARD,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: '#a855f7' + '55',
                padding: 16,
                shadowColor: '#a855f7',
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.2,
                shadowRadius: 10,
              }}>
                {/* Top glow bar */}
                <View style={{
                  position: 'absolute', top: 0, left: 0, right: 0,
                  height: 2, backgroundColor: '#a855f7',
                  borderTopLeftRadius: 16, borderTopRightRadius: 16, opacity: 0.7,
                }} />
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <Text style={{ fontSize: 18 }}>🤖</Text>
                  <Text style={{
                    color: '#a855f7',
                    fontSize: 12,
                    fontWeight: '800',
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                  }}>
                    AI Earning Suggestion
                  </Text>
                </View>
                <Text style={{ color: TEXT, fontSize: 14, lineHeight: 20 }}>
                  {aiSuggestion.suggestion}
                </Text>
                {aiSuggestion.minimum_order && (
                  <View style={{
                    flexDirection: 'row',
                    gap: 8,
                    marginTop: 10,
                    flexWrap: 'wrap',
                  }}>
                    <View style={{ backgroundColor: GREEN + '22', borderRadius: 8, borderWidth: 1, borderColor: GREEN + '55', paddingHorizontal: 10, paddingVertical: 5 }}>
                      <Text style={{ color: GREEN, fontSize: 12, fontWeight: '700' }}>Min: ${aiSuggestion.minimum_order}</Text>
                    </View>
                    {aiSuggestion.peak_time && (
                      <View style={{ backgroundColor: ACCENT + '22', borderRadius: 8, borderWidth: 1, borderColor: ACCENT + '55', paddingHorizontal: 10, paddingVertical: 5 }}>
                        <Text style={{ color: ACCENT, fontSize: 12, fontWeight: '700' }}>⏰ {aiSuggestion.peak_time}</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            )}

            {/* Recent Entries */}
            {recentEntries.length > 0 && (
              <View style={{
                backgroundColor: CARD,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: BORDER,
                overflow: 'hidden',
              }}>
                <View style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: BORDER,
                }}>
                  <Text style={{ color: MUTED, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 }}>
                    Recent Entries
                  </Text>
                  <Text style={{ color: ACCENT, fontSize: 12, fontWeight: '700' }}>
                    {entries.length} total
                  </Text>
                </View>
                {recentEntries.map((entry) => (
                  <EntryRow
                    key={entry.id}
                    entry={entry}
                    onDelete={(id) => deleteMutation.mutate(id)}
                  />
                ))}
              </View>
            )}

            {recentEntries.length === 0 && !rollupLoading && (
              <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                <Text style={{ fontSize: 40 }}>🚗</Text>
                <Text style={{ color: MUTED, fontSize: 15, marginTop: 12, textAlign: 'center' }}>
                  No entries for this period.{'\n'}Tap Log Entry to add one!
                </Text>
              </View>
            )}
          </>
        )}
      </View>
    </ScrollView>
  );
}
