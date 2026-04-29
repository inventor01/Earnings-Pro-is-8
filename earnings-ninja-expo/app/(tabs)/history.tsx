import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable,
  RefreshControl, Alert, ActivityIndicator, TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api, Entry, APP_LABELS, APP_COLORS } from '@/lib/api';
import { colors } from '@/constants/colors';

type Period = { key: string; label: string; tf: string };

const PERIODS: Period[] = [
  { key: 'today', label: 'Today', tf: 'TODAY' },
  { key: 'yesterday', label: 'Yesterday', tf: 'YESTERDAY' },
  { key: 'week', label: 'This Week', tf: 'THIS_WEEK' },
  { key: 'month', label: 'This Month', tf: 'THIS_MONTH' },
  { key: 'last7', label: 'Last 7 Days', tf: 'LAST_7_DAYS' },
];

function fmt(n: number) {
  return (n < 0 ? '-$' : '$') + Math.abs(n).toFixed(2);
}

const TYPE_ICONS: Record<string, string> = {
  ORDER: '📦', BONUS: '⭐', EXPENSE: '💸', CANCELLATION: '❌',
};

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [period, setPeriod] = useState<Period>(PERIODS[0]);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const { data: entries = [], refetch, isLoading } = useQuery({
    queryKey: ['entries', period.tf],
    queryFn: () => api.getEntries(period.tf, 500),
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteEntry,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['entries'] });
      qc.invalidateQueries({ queryKey: ['rollup'] });
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleDelete = (entry: Entry) => {
    Alert.alert(
      'Delete Entry',
      `Delete ${entry.type} of ${fmt(Math.abs(entry.amount))}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(entry.id) },
      ]
    );
  };

  const filtered = entries.filter(e => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      APP_LABELS[e.app].toLowerCase().includes(q) ||
      e.type.toLowerCase().includes(q) ||
      (e.note?.toLowerCase().includes(q)) ||
      Math.abs(e.amount).toFixed(2).includes(q)
    );
  });

  const totalRevenue = filtered.filter(e => e.type === 'ORDER' || e.type === 'BONUS').reduce((s, e) => s + e.amount, 0);
  const totalExpenses = filtered.filter(e => e.amount < 0).reduce((s, e) => s + e.amount, 0);
  const profit = totalRevenue + totalExpenses;

  const renderEntry = ({ item: entry }: { item: Entry }) => {
    const isNeg = entry.amount < 0;
    const appColor = APP_COLORS[entry.app] ?? colors.textMuted;
    const d = new Date(entry.timestamp);
    const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

    return (
      <View style={styles.entryCard}>
        <View style={[styles.entryLeft, { backgroundColor: appColor + '20' }]}>
          <Text style={styles.typeIcon}>{TYPE_ICONS[entry.type] || '📋'}</Text>
        </View>
        <View style={styles.entryBody}>
          <View style={styles.entryTopRow}>
            <Text style={styles.entryApp}>{APP_LABELS[entry.app]}</Text>
            <Text style={[styles.entryAmt, { color: isNeg ? colors.red : colors.green }]}>
              {isNeg ? '' : '+'}{fmt(entry.amount)}
            </Text>
          </View>
          <View style={styles.entryBottomRow}>
            <Text style={styles.entryMeta}>
              {entry.type}{entry.category ? ` · ${entry.category}` : ''}
              {entry.distance_miles ? ` · ${entry.distance_miles.toFixed(1)}mi` : ''}
            </Text>
            <Text style={styles.entryDate}>{dateStr} {timeStr}</Text>
          </View>
          {entry.note ? <Text style={styles.entryNote}>"{entry.note}"</Text> : null}
        </View>
        <Pressable onPress={() => handleDelete(entry)} style={styles.deleteBtn} hitSlop={8}>
          <Ionicons name="trash-outline" size={16} color={colors.textMuted} />
        </Pressable>
      </View>
    );
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
      {/* Period filter */}
      <FlatList
        data={PERIODS}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={p => p.key}
        contentContainerStyle={styles.chipRow}
        renderItem={({ item: p }) => (
          <Pressable
            style={[styles.chip, period.key === p.key && styles.chipActive]}
            onPress={() => setPeriod(p)}
          >
            <Text style={[styles.chipText, period.key === p.key && styles.chipTextActive]}>{p.label}</Text>
          </Pressable>
        )}
        style={styles.chipList}
      />

      {/* Summary bar */}
      <View style={styles.summaryBar}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Revenue</Text>
          <Text style={[styles.summaryValue, { color: colors.green }]}>{fmt(totalRevenue)}</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Expenses</Text>
          <Text style={[styles.summaryValue, { color: colors.red }]}>{fmt(Math.abs(totalExpenses))}</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Profit</Text>
          <Text style={[styles.summaryValue, { color: profit >= 0 ? colors.green : colors.red }]}>{fmt(profit)}</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Entries</Text>
          <Text style={styles.summaryValue}>{filtered.length}</Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <Ionicons name="search" size={16} color={colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search entries..."
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {search ? (
          <Pressable onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={16} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={e => e.id.toString()}
          renderItem={renderEntry}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📭</Text>
              <Text style={styles.emptyText}>No entries found</Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  chipList: { flexGrow: 0 },
  chipRow: { paddingHorizontal: 16, gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { fontFamily: 'Inter_500Medium', fontSize: 13, color: colors.textSecondary },
  chipTextActive: { color: colors.black },
  summaryBar: {
    flexDirection: 'row', backgroundColor: colors.surface,
    marginHorizontal: 16, borderRadius: 14, padding: 12,
    marginTop: 10, borderWidth: 1, borderColor: colors.border,
  },
  summaryItem: { flex: 1, alignItems: 'center', gap: 2 },
  summaryLabel: { fontFamily: 'Inter_400Regular', fontSize: 10, color: colors.textMuted },
  summaryValue: { fontFamily: 'Inter_700Bold', fontSize: 14, color: colors.textPrimary },
  summaryDivider: { width: 1, backgroundColor: colors.border, marginVertical: 2 },
  searchRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: 12,
    marginHorizontal: 16, marginTop: 10,
    paddingHorizontal: 12, borderWidth: 1, borderColor: colors.border,
  },
  searchIcon: { marginRight: 8 },
  searchInput: {
    flex: 1, paddingVertical: 11,
    fontFamily: 'Inter_400Regular', fontSize: 14,
    color: colors.textPrimary,
  },
  list: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 24, gap: 8 },
  entryCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.surface, borderRadius: 14,
    padding: 12, borderWidth: 1, borderColor: colors.border,
  },
  entryLeft: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  typeIcon: { fontSize: 18 },
  entryBody: { flex: 1, gap: 3 },
  entryTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  entryApp: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: colors.textPrimary },
  entryAmt: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  entryBottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  entryMeta: { fontFamily: 'Inter_400Regular', fontSize: 11, color: colors.textSecondary },
  entryDate: { fontFamily: 'Inter_400Regular', fontSize: 11, color: colors.textMuted },
  entryNote: { fontFamily: 'Inter_400Regular', fontSize: 12, color: colors.textMuted, fontStyle: 'italic' },
  deleteBtn: { padding: 4 },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyIcon: { fontSize: 40 },
  emptyText: { fontFamily: 'Inter_400Regular', fontSize: 15, color: colors.textSecondary },
});
