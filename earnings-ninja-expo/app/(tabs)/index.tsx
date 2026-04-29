import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  RefreshControl, ActivityIndicator, Image,
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
    <View style={[kpiStyles.card, { borderTopColor: color, shadowColor: color }]}>
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
    borderTopWidth: 2,
    gap: 2,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  icon: { fontSize: 20, marginBottom: 4 },
  value: { fontSize: 24, fontFamily: 'Inter_700Bold', letterSpacing: -0.5 },
  label: { fontSize: 12, fontFamily: 'Inter_500Medium', color: colors.textSecondary },
  sub: { fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.textMuted, marginTop: 1 },
});

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
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

  const recentEntries = (entries ?? []).slice(0, 8);
  const profitColor = r.profit >= 0 ? colors.green : colors.red;
  const goalProgress = rollup?.goal_progress ?? null;
  const goalTarget = rollup?.goal?.target_profit ?? null;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.container, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Header with ninja logo */}
      <View style={styles.header}>
        <View style={styles.logoRow}>
          <Image
            source={require('../../assets/icon.png')}
            style={styles.logoImg}
            resizeMode="contain"
          />
          <View>
            <Text style={styles.logoTitle}>EARNINGS</Text>
            <Text style={styles.logoNinja}>NINJA</Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          {goalTarget != null && (
            <View style={styles.goalBadge}>
              <Text style={styles.goalBadgeText}>
                Goal: {fmt(goalTarget)}
              </Text>
            </View>
          )}
          <Pressable onPress={() => router.push('/(tabs)/settings')} style={styles.settingsBtn}>
            <Ionicons name="settings-outline" size={22} color={colors.textSecondary} />
          </Pressable>
        </View>
      </View>

      {/* Period chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={styles.chipContent}>
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
          {/* Profit hero card */}
          <View style={[styles.profitCard, { borderColor: profitColor + '50', shadowColor: profitColor }]}>
            <Text style={styles.profitLabel}>Net Profit</Text>
            <Text style={[styles.profitValue, { color: profitColor }]}>{fmt(r.profit)}</Text>
            <View style={styles.profitRow}>
              <View style={styles.profitItem}>
                <View style={[styles.profitDot, { backgroundColor: colors.green }]} />
                <Text style={styles.profitSub}>Revenue: {fmt(r.revenue)}</Text>
              </View>
              <View style={styles.profitItem}>
                <View style={[styles.profitDot, { backgroundColor: colors.red }]} />
                <Text style={styles.profitSub}>Expenses: {fmt(Math.abs(r.expenses))}</Text>
              </View>
            </View>

            {/* Goal progress bar */}
            {goalTarget != null && goalProgress != null && (
              <View style={styles.goalBar}>
                <View style={styles.goalBarTrack}>
                  <View style={[styles.goalBarFill, { width: `${Math.min(goalProgress * 100, 100)}%` as any }]} />
                </View>
                <Text style={styles.goalBarText}>
                  {Math.round(goalProgress * 100)}% of {fmt(goalTarget)} daily goal
                  {goalProgress >= 1 ? ' 🎉' : ''}
                </Text>
              </View>
            )}
          </View>

          {/* KPI grid */}
          <View style={styles.kpiGrid}>
            <KpiCard
              label="$/Hour"
              value={r.dollars_per_hour > 0 ? `$${r.dollars_per_hour.toFixed(2)}` : '$0.00'}
              icon="⏱️"
              color={colors.accent}
              sub={r.hours > 0 ? `${r.hours.toFixed(1)} hrs` : undefined}
            />
            <KpiCard
              label="$/Mile"
              value={r.dollars_per_mile > 0 ? `$${r.dollars_per_mile.toFixed(2)}` : '$0.00'}
              icon="🛣️"
              color="#a78bfa"
              sub={r.miles > 0 ? `${r.miles.toFixed(1)} mi` : undefined}
            />
            <KpiCard
              label="Miles"
              value={r.miles > 0 ? r.miles.toFixed(1) : '0.0'}
              icon="📍"
              color="#38bdf8"
            />
            <KpiCard
              label="Avg Order"
              value={r.average_order_value > 0 ? fmt(r.average_order_value) : '$0.00'}
              icon="📦"
              color="#fb923c"
            />
          </View>

          {/* AI suggestion */}
          {suggestions && (
            <View style={styles.aiCard}>
              <View style={styles.aiHeader}>
                <Text style={styles.aiIcon}>🤖</Text>
                <Text style={styles.aiTitle}>AI Earning Suggestion</Text>
              </View>
              <Text style={styles.aiText}>{suggestions.suggestion}</Text>
              {suggestions.minimum_order != null && (
                <View style={styles.aiTagRow}>
                  <View style={styles.aiTag}>
                    <Text style={styles.aiTagText}>Min: {fmt(suggestions.minimum_order)}</Text>
                  </View>
                  {suggestions.peak_time && (
                    <View style={styles.aiTag}>
                      <Text style={styles.aiTagText}>Peak: {suggestions.peak_time}</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          )}

          {/* Recent entries */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Entries</Text>
              <Pressable onPress={() => router.push('/(tabs)/history')}>
                <Text style={styles.seeAll}>See all →</Text>
              </Pressable>
            </View>

            {recentEntries.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>📭</Text>
                <Text style={styles.emptyText}>No entries yet for this period</Text>
                <Pressable style={styles.addBtn} onPress={() => router.push('/(tabs)/add')}>
                  <Text style={styles.addBtnText}>+ Log your first delivery</Text>
                </Pressable>
              </View>
            ) : (
              recentEntries.map(entry => {
                const isExpense = entry.amount < 0;
                const amtColor = isExpense ? colors.red : colors.green;
                const appColor = APP_COLORS[entry.app] ?? colors.textMuted;
                const d = new Date(entry.timestamp);
                const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
                return (
                  <View key={entry.id} style={styles.entryRow}>
                    <View style={[styles.entryIconBox, { backgroundColor: appColor + '20' }]}>
                      <View style={[styles.appDot, { backgroundColor: appColor }]} />
                    </View>
                    <View style={styles.entryInfo}>
                      <Text style={styles.entryApp}>{APP_LABELS[entry.app]}</Text>
                      <Text style={styles.entryMeta}>
                        {entry.type}{entry.category ? ` · ${entry.category}` : ''}
                        {entry.distance_miles ? ` · ${entry.distance_miles.toFixed(1)}mi` : ''}
                        {' · '}{timeStr}
                      </Text>
                    </View>
                    <Text style={[styles.entryAmt, { color: amtColor }]}>
                      {isExpense ? '' : '+'}{fmt(entry.amount)}
                    </Text>
                  </View>
                );
              })
            )}
          </View>
        </>
      )}

      {/* Add entry FAB area */}
      <Pressable style={styles.fab} onPress={() => router.push('/(tabs)/add')}>
        <Ionicons name="add" size={24} color={colors.black} />
        <Text style={styles.fabText}>Add Entry</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  container: { paddingHorizontal: 16, gap: 16 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoImg: { width: 44, height: 44, borderRadius: 10 },
  logoTitle: { fontSize: 13, fontFamily: 'Inter_700Bold', color: colors.accent, letterSpacing: 2 },
  logoNinja: { fontSize: 18, fontFamily: 'Inter_700Bold', color: colors.textPrimary, letterSpacing: 3, marginTop: -2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  goalBadge: {
    backgroundColor: colors.accent + '20', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: colors.accent + '40',
  },
  goalBadgeText: { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: colors.accent },
  settingsBtn: { padding: 4 },

  chipScroll: { marginHorizontal: -16 },
  chipContent: { paddingHorizontal: 16, gap: 8 },
  chip: {
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1,
    backgroundColor: colors.surface, borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { fontFamily: 'Inter_500Medium', fontSize: 13, color: colors.textSecondary },
  chipTextActive: { color: colors.black },

  profitCard: {
    backgroundColor: colors.surface,
    borderRadius: 20, padding: 20,
    alignItems: 'center', gap: 10,
    borderWidth: 1.5,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  profitLabel: { fontFamily: 'Inter_500Medium', fontSize: 13, color: colors.textSecondary },
  profitValue: { fontFamily: 'Inter_700Bold', fontSize: 52, letterSpacing: -2 },
  profitRow: { flexDirection: 'row', gap: 20 },
  profitItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  profitDot: { width: 8, height: 8, borderRadius: 4 },
  profitSub: { fontFamily: 'Inter_400Regular', fontSize: 12, color: colors.textSecondary },

  goalBar: { width: '100%', gap: 6 },
  goalBarTrack: { height: 8, backgroundColor: colors.surfaceAlt, borderRadius: 4, overflow: 'hidden' },
  goalBarFill: { height: '100%', backgroundColor: colors.green, borderRadius: 4 },
  goalBarText: { fontFamily: 'Inter_400Regular', fontSize: 11, color: colors.textMuted, textAlign: 'center' },

  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },

  aiCard: {
    backgroundColor: '#0f1629',
    borderRadius: 16, padding: 16, gap: 10,
    borderWidth: 1, borderColor: '#312e81',
  },
  aiHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  aiIcon: { fontSize: 18 },
  aiTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#a5b4fc' },
  aiText: { fontFamily: 'Inter_400Regular', fontSize: 14, color: colors.textPrimary, lineHeight: 21 },
  aiTagRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  aiTag: {
    backgroundColor: '#312e81', borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  aiTagText: { fontFamily: 'Inter_500Medium', fontSize: 11, color: '#a5b4fc' },

  section: { gap: 10 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: colors.textPrimary },
  seeAll: { fontFamily: 'Inter_500Medium', fontSize: 13, color: colors.accent },

  emptyState: { alignItems: 'center', paddingVertical: 32, gap: 10 },
  emptyIcon: { fontSize: 40 },
  emptyText: { fontFamily: 'Inter_400Regular', fontSize: 15, color: colors.textSecondary },
  addBtn: {
    marginTop: 4, backgroundColor: colors.accent,
    borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10,
  },
  addBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: colors.black },

  entryRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.surface, borderRadius: 14,
    padding: 14, borderWidth: 1, borderColor: colors.border,
  },
  entryIconBox: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  appDot: { width: 10, height: 10, borderRadius: 5 },
  entryInfo: { flex: 1 },
  entryApp: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: colors.textPrimary },
  entryMeta: { fontFamily: 'Inter_400Regular', fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  entryAmt: { fontFamily: 'Inter_700Bold', fontSize: 15 },

  fab: {
    backgroundColor: colors.accent, borderRadius: 16,
    paddingVertical: 16, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 4,
  },
  fabText: { fontFamily: 'Inter_700Bold', fontSize: 16, color: colors.black },
});
