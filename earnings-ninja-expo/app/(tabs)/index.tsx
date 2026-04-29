import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { api, Rollup, APP_COLORS, APP_LABELS } from '@/lib/api';
import { useAuth } from '@/lib/authContext';
import { colors } from '@/constants/colors';

type Period = 'today' | 'yesterday' | 'week' | 'month';

const PERIODS: { key: Period; label: string; tf: string }[] = [
  { key: 'today', label: 'Today', tf: 'TODAY' },
  { key: 'yesterday', label: 'Yesterday', tf: 'YESTERDAY' },
  { key: 'week', label: 'This Week', tf: 'THIS_WEEK' },
  { key: 'month', label: 'This Month', tf: 'THIS_MONTH' },
];

function fmt(n: number): string {
  return (n < 0 ? '-$' : '$') + Math.abs(n).toFixed(2);
}

function KpiCard({ label, value, sub, color, icon }: {
  label: string; value: string; sub?: string; color: string; icon: string;
}) {
  return (
    <View style={[kpiStyles.card, { borderLeftColor: color }]}>
      <Text style={kpiStyles.icon}>{icon}</Text>
      <Text style={[kpiStyles.value, { color }]}>{value}</Text>
      <Text style={kpiStyles.label}>{label}</Text>
      {sub ? <Text style={kpiStyles.sub}>{sub}</Text> : null}
    </View>
  );
}

const kpiStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    flex: 1,
    minWidth: '46%',
    borderLeftWidth: 3,
    gap: 2,
  },
  icon: { fontSize: 20, marginBottom: 2 },
  value: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  label: { fontSize: 12, fontFamily: 'Inter_500Medium', color: colors.textSecondary },
  sub: { fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.textMuted, marginTop: 1 },
});

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [period, setPeriod] = useState<Period>('today');
  const [refreshing, setRefreshing] = useState(false);

  const tf = PERIODS.find(p => p.key === period)?.tf || 'TODAY';

  const { data: rollup, refetch: refetchRollup, isLoading } = useQuery({
    queryKey: ['rollup', tf],
    queryFn: () => api.getRollup(tf),
  });

  const { data: entries, refetch: refetchEntries } = useQuery({
    queryKey: ['entries', tf],
    queryFn: () => api.getEntries(tf),
  });

  const { data: suggestions } = useQuery({
    queryKey: ['suggestions'],
    queryFn: api.getSuggestions,
    staleTime: 5 * 60_000,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchRollup(), refetchEntries()]);
    setRefreshing(false);
  }, [refetchRollup, refetchEntries]);

  const r: Rollup = rollup ?? {
    revenue: 0, expenses: 0, profit: 0, miles: 0,
    hours: 0, dollars_per_mile: 0, dollars_per_hour: 0, average_order_value: 0,
  };

  const recentEntries = (entries ?? []).slice(0, 10);

  const profitColor = r.profit >= 0 ? colors.green : colors.red;
  const goalProgress = rollup?.goal_progress ?? null;
  const goalTarget = rollup?.goal?.target_profit ?? null;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.container, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>
            {user?.first_name ? `Hey, ${user.first_name} 👋` : 'Dashboard 🥷'}
          </Text>
          <Text style={styles.subGreeting}>Your earnings at a glance</Text>
        </View>
      </View>

      {/* Period chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
        {PERIODS.map(p => (
          <Pressable
            key={p.key}
            style={[styles.chip, period === p.key && styles.chipActive]}
            onPress={() => setPeriod(p.key)}
          >
            <Text style={[styles.chipText, period === p.key && styles.chipTextActive]}>{p.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {isLoading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      ) : (
        <>
          {/* Profit hero */}
          <View style={[styles.profitCard, { borderColor: profitColor + '40' }]}>
            <Text style={styles.profitLabel}>Net Profit</Text>
            <Text style={[styles.profitValue, { color: profitColor }]}>{fmt(r.profit)}</Text>
            <View style={styles.profitRow}>
              <Text style={styles.profitSub}>🟢 Rev: {fmt(r.revenue)}</Text>
              <Text style={styles.profitSub}>🔴 Exp: {fmt(Math.abs(r.expenses))}</Text>
            </View>

            {/* Goal bar */}
            {goalTarget != null && goalProgress != null && (
              <View style={styles.goalBar}>
                <View style={styles.goalBarBg}>
                  <View style={[styles.goalBarFill, { width: `${Math.min(goalProgress * 100, 100)}%` as any }]} />
                </View>
                <Text style={styles.goalText}>
                  {Math.round(goalProgress * 100)}% of {fmt(goalTarget)} goal
                </Text>
              </View>
            )}
          </View>

          {/* KPI grid */}
          <View style={styles.kpiGrid}>
            <KpiCard
              label="$/Hour"
              value={r.dollars_per_hour > 0 ? `$${r.dollars_per_hour.toFixed(2)}` : '—'}
              icon="⏱️"
              color={colors.accent}
            />
            <KpiCard
              label="$/Mile"
              value={r.dollars_per_mile > 0 ? `$${r.dollars_per_mile.toFixed(2)}` : '—'}
              icon="🛣️"
              color="#a78bfa"
            />
            <KpiCard
              label="Miles"
              value={r.miles > 0 ? r.miles.toFixed(1) : '—'}
              icon="📍"
              color="#38bdf8"
            />
            <KpiCard
              label="Avg Order"
              value={r.average_order_value > 0 ? fmt(r.average_order_value) : '—'}
              icon="📦"
              color="#fb923c"
            />
          </View>

          {/* AI suggestion */}
          {suggestions && (
            <View style={styles.aiCard}>
              <View style={styles.aiHeader}>
                <Text style={styles.aiIcon}>🤖</Text>
                <Text style={styles.aiTitle}>AI Suggestion</Text>
              </View>
              <Text style={styles.aiText}>{suggestions.suggestion}</Text>
              {suggestions.minimum_order != null && (
                <Text style={styles.aiSub}>Min order: {fmt(suggestions.minimum_order)}</Text>
              )}
            </View>
          )}

          {/* Recent entries */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Entries</Text>
              <Pressable onPress={() => router.push('/(tabs)/history')}>
                <Text style={styles.seeAll}>See all</Text>
              </Pressable>
            </View>

            {recentEntries.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>📭</Text>
                <Text style={styles.emptyText}>No entries yet</Text>
                <Pressable style={styles.addBtn} onPress={() => router.push('/(tabs)/add')}>
                  <Text style={styles.addBtnText}>+ Log your first delivery</Text>
                </Pressable>
              </View>
            ) : (
              recentEntries.map(entry => {
                const isExpense = entry.type === 'EXPENSE' || entry.type === 'CANCELLATION';
                const amtColor = isExpense ? colors.red : colors.green;
                const appColor = APP_COLORS[entry.app] ?? colors.textMuted;
                const d = new Date(entry.timestamp);
                const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
                return (
                  <View key={entry.id} style={styles.entryRow}>
                    <View style={[styles.appDot, { backgroundColor: appColor }]} />
                    <View style={styles.entryInfo}>
                      <Text style={styles.entryApp}>{APP_LABELS[entry.app]}</Text>
                      <Text style={styles.entryMeta}>
                        {entry.type}{entry.category ? ` · ${entry.category}` : ''} · {timeStr}
                      </Text>
                    </View>
                    <Text style={[styles.entryAmt, { color: amtColor }]}>
                      {isExpense ? '-' : '+'}{fmt(Math.abs(entry.amount))}
                    </Text>
                  </View>
                );
              })
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  container: { paddingHorizontal: 16, gap: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  greeting: { fontSize: 22, fontFamily: 'Inter_700Bold', color: colors.textPrimary },
  subGreeting: { fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.textSecondary, marginTop: 2 },
  chipScroll: { marginHorizontal: -16, paddingHorizontal: 16 },
  chip: {
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20, marginRight: 8,
    backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { fontFamily: 'Inter_500Medium', fontSize: 13, color: colors.textSecondary },
  chipTextActive: { color: colors.black },
  profitCard: {
    backgroundColor: colors.surface,
    borderRadius: 20, padding: 20,
    alignItems: 'center', gap: 8,
    borderWidth: 1,
  },
  profitLabel: { fontFamily: 'Inter_500Medium', fontSize: 14, color: colors.textSecondary },
  profitValue: { fontFamily: 'Inter_700Bold', fontSize: 48, letterSpacing: -1 },
  profitRow: { flexDirection: 'row', gap: 16 },
  profitSub: { fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.textSecondary },
  goalBar: { width: '100%', gap: 4, marginTop: 4 },
  goalBarBg: { height: 6, backgroundColor: colors.surfaceAlt, borderRadius: 3, overflow: 'hidden' },
  goalBarFill: { height: '100%', backgroundColor: colors.green, borderRadius: 3 },
  goalText: { fontFamily: 'Inter_400Regular', fontSize: 11, color: colors.textMuted, textAlign: 'center' },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  aiCard: {
    backgroundColor: '#1a1f35',
    borderRadius: 16, padding: 16, gap: 8,
    borderWidth: 1, borderColor: '#3730a3',
  },
  aiHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  aiIcon: { fontSize: 18 },
  aiTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#a5b4fc' },
  aiText: { fontFamily: 'Inter_400Regular', fontSize: 14, color: colors.textPrimary, lineHeight: 20 },
  aiSub: { fontFamily: 'Inter_500Medium', fontSize: 12, color: '#a5b4fc' },
  section: { gap: 10 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: colors.textPrimary },
  seeAll: { fontFamily: 'Inter_500Medium', fontSize: 13, color: colors.accent },
  emptyState: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  emptyIcon: { fontSize: 36 },
  emptyText: { fontFamily: 'Inter_400Regular', fontSize: 15, color: colors.textSecondary },
  addBtn: {
    marginTop: 4, backgroundColor: colors.accent,
    borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10,
  },
  addBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: colors.black },
  entryRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.surface, borderRadius: 12, padding: 14,
  },
  appDot: { width: 10, height: 10, borderRadius: 5 },
  entryInfo: { flex: 1 },
  entryApp: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: colors.textPrimary },
  entryMeta: { fontFamily: 'Inter_400Regular', fontSize: 12, color: colors.textSecondary, marginTop: 1 },
  entryAmt: { fontFamily: 'Inter_700Bold', fontSize: 16 },
});
