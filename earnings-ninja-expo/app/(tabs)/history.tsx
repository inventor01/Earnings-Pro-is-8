import { useState, useCallback } from 'react';
import {
  View, Text, FlatList, Pressable,
  RefreshControl, Alert, ActivityIndicator, TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api, Entry, APP_LABELS, APP_COLORS } from '@/lib/api';
import * as Haptics from 'expo-haptics';

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

type Period = { key: string; label: string; tf: string };

const PERIODS: Period[] = [
  { key: 'today', label: 'Today', tf: 'TODAY' },
  { key: 'yesterday', label: 'Yesterday', tf: 'YESTERDAY' },
  { key: 'week', label: 'This Week', tf: 'THIS_WEEK' },
  { key: 'last7', label: 'Last 7', tf: 'LAST_7_DAYS' },
  { key: 'month', label: 'Month', tf: 'THIS_MONTH' },
];

function EntryCard({ entry, selected, onSelect, onDelete }: {
  entry: Entry;
  selected: boolean;
  onSelect: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  const isExpense = entry.amount < 0 || entry.type === 'EXPENSE';
  const color = isExpense ? RED : GREEN;
  const amt = Math.abs(entry.amount);
  const appColor = APP_COLORS[entry.app] || DIM;
  const date = new Date(entry.timestamp);
  const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  return (
    <Pressable
      onLongPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onSelect(entry.id); }}
      style={{
        backgroundColor: selected ? ACCENT + '11' : CARD,
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: selected ? ACCENT + '88' : BORDER,
        marginHorizontal: 14,
        marginVertical: 4,
        overflow: 'hidden',
      }}
    >
      {/* Left colored bar */}
      <View style={{
        position: 'absolute', top: 0, bottom: 0, left: 0,
        width: 3,
        backgroundColor: appColor,
        opacity: 0.8,
      }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14, paddingLeft: 16 }}>
        {/* App Badge */}
        <View style={{
          width: 42,
          height: 42,
          borderRadius: 21,
          backgroundColor: appColor + '22',
          borderWidth: 1.5,
          borderColor: appColor,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12,
        }}>
          <Text style={{ fontSize: 15, fontWeight: '900', color: appColor }}>
            {(APP_LABELS[entry.app] || 'O')[0]}
          </Text>
        </View>

        {/* Info */}
        <View style={{ flex: 1 }}>
          <Text style={{ color: TEXT, fontSize: 14, fontWeight: '700', marginBottom: 2 }}>
            {APP_LABELS[entry.app] || entry.app}
            <Text style={{ color: DIM, fontWeight: '500', fontSize: 12 }}> · {entry.type}</Text>
          </Text>
          <Text style={{ color: MUTED, fontSize: 11 }}>
            {dateStr} at {timeStr}
            {entry.distance_miles > 0 ? ` · ${entry.distance_miles.toFixed(1)} mi` : ''}
            {entry.duration_minutes > 0 ? ` · ${entry.duration_minutes}min` : ''}
          </Text>
          {entry.note ? (
            <Text style={{ color: DIM, fontSize: 11, marginTop: 2 }} numberOfLines={1}>
              📝 {entry.note}
            </Text>
          ) : null}
        </View>

        {/* Amount */}
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <Text style={{
            color,
            fontSize: 18,
            fontWeight: '900',
            fontVariant: ['tabular-nums'],
            textShadowColor: color,
            textShadowOffset: { width: 0, height: 0 },
            textShadowRadius: 6,
          }}>
            {isExpense ? '-' : '+'}${amt.toFixed(2)}
          </Text>
          <Pressable
            onPress={() => {
              Alert.alert('Delete Entry', 'Remove this entry?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => onDelete(entry.id) },
              ]);
            }}
            style={{ padding: 4 }}
          >
            <Ionicons name="trash-outline" size={16} color={DIM} />
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState('today');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<number[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const tf = PERIODS.find(p => p.key === period)?.tf || 'TODAY';

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['entries', tf],
    queryFn: () => api.getEntries(tf as any),
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
    await queryClient.invalidateQueries({ queryKey: ['entries'] });
    setRefreshing(false);
  }, [queryClient]);

  const toggleSelect = (id: number) => {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = () => {
    Alert.alert('Delete Entries', `Delete ${selected.length} entries?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete All', style: 'destructive',
        onPress: async () => {
          for (const id of selected) await api.deleteEntry(id);
          queryClient.invalidateQueries({ queryKey: ['entries'] });
          queryClient.invalidateQueries({ queryKey: ['rollup'] });
          setSelected([]);
        },
      },
    ]);
  };

  const filtered = entries.filter(e => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      APP_LABELS[e.app]?.toLowerCase().includes(s) ||
      e.type.toLowerCase().includes(s) ||
      e.note?.toLowerCase().includes(s) ||
      Math.abs(e.amount).toFixed(2).includes(s)
    );
  });

  const revenue = filtered.filter(e => e.amount > 0).reduce((sum, e) => sum + e.amount, 0);
  const expenses = filtered.filter(e => e.amount < 0).reduce((sum, e) => sum + e.amount, 0);
  const profit = revenue + expenses;

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      {/* Header */}
      <View style={{
        paddingTop: insets.top + 12,
        paddingHorizontal: 14,
        paddingBottom: 12,
        backgroundColor: SURFACE,
        borderBottomWidth: 1,
        borderBottomColor: BORDER,
        gap: 12,
      }}>
        <Text style={{
          color: ACCENT,
          fontSize: 22,
          fontWeight: '900',
          textShadowColor: ACCENT,
          textShadowOffset: { width: 0, height: 0 },
          textShadowRadius: 8,
        }}>
          History
        </Text>

        {/* Period Chips */}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {PERIODS.map((p) => (
            <Pressable
              key={p.key}
              onPress={() => { setPeriod(p.key); setSelected([]); }}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderRadius: 16,
                backgroundColor: period === p.key ? ACCENT : CARD,
                borderWidth: 1.5,
                borderColor: period === p.key ? ACCENT : BORDER,
              }}
            >
              <Text style={{
                color: period === p.key ? '#000' : MUTED,
                fontSize: 12,
                fontWeight: '700',
              }}>
                {p.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Search */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: CARD,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: BORDER,
          paddingHorizontal: 12,
          gap: 8,
        }}>
          <Ionicons name="search" size={16} color={DIM} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search entries..."
            placeholderTextColor={DIM}
            style={{ flex: 1, color: TEXT, fontSize: 14, paddingVertical: 10 }}
          />
          {search ? (
            <Pressable onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color={DIM} />
            </Pressable>
          ) : null}
        </View>

        {/* Summary Bar */}
        {filtered.length > 0 && (
          <View style={{
            flexDirection: 'row',
            backgroundColor: CARD,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: BORDER,
            overflow: 'hidden',
          }}>
            {[
              { label: 'Revenue', value: `+$${revenue.toFixed(2)}`, color: GREEN },
              { label: 'Expenses', value: `-$${Math.abs(expenses).toFixed(2)}`, color: RED },
              { label: 'Profit', value: `$${profit.toFixed(2)}`, color: profit >= 0 ? GREEN : RED },
              { label: 'Entries', value: String(filtered.length), color: ACCENT },
            ].map((item, i) => (
              <View key={item.label} style={{
                flex: 1,
                alignItems: 'center',
                paddingVertical: 8,
                borderRightWidth: i < 3 ? 1 : 0,
                borderRightColor: BORDER,
              }}>
                <Text style={{ color: MUTED, fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5 }}>{item.label}</Text>
                <Text style={{ color: item.color, fontSize: 12, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{item.value}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Bulk Delete */}
        {selected.length > 0 && (
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <Text style={{ color: ACCENT, fontSize: 13, fontWeight: '700', flex: 1 }}>
              {selected.length} selected
            </Text>
            <Pressable
              onPress={handleBulkDelete}
              style={{ backgroundColor: RED + '22', borderWidth: 1, borderColor: RED, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 }}
            >
              <Text style={{ color: RED, fontWeight: '700', fontSize: 13 }}>Delete All</Text>
            </Pressable>
            <Pressable
              onPress={() => setSelected([])}
              style={{ backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 }}
            >
              <Text style={{ color: MUTED, fontWeight: '700', fontSize: 13 }}>Cancel</Text>
            </Pressable>
          </View>
        )}
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={ACCENT} size="large" />
        </View>
      ) : filtered.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 40 }}>📋</Text>
          <Text style={{ color: MUTED, fontSize: 15, marginTop: 12, textAlign: 'center' }}>
            {search ? 'No entries match your search.' : 'No entries for this period.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <EntryCard
              entry={item}
              selected={selected.includes(item.id)}
              onSelect={toggleSelect}
              onDelete={(id) => deleteMutation.mutate(id)}
            />
          )}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} colors={[ACCENT]} />
          }
          contentContainerStyle={{ paddingTop: 8, paddingBottom: insets.bottom + 20 }}
        />
      )}
    </View>
  );
}
