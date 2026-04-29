import { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  TextInput, Alert, ActivityIndicator, Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api, TimeframeType } from '@/lib/api';
import { useAuth } from '@/lib/authContext';
import { colors } from '@/constants/colors';

type GoalTimeframe = { key: TimeframeType; label: string; emoji: string };

const GOAL_TIMEFRAMES: GoalTimeframe[] = [
  { key: 'TODAY', label: 'Daily Goal', emoji: '☀️' },
  { key: 'THIS_WEEK', label: 'Weekly Goal', emoji: '📅' },
  { key: 'THIS_MONTH', label: 'Monthly Goal', emoji: '🗓️' },
];

function SettingRow({ icon, label, children }: { icon: string; label: string; children: React.ReactNode }) {
  return (
    <View style={styles.settingRow}>
      <View style={styles.settingLeft}>
        <Text style={styles.settingIcon}>{icon}</Text>
        <Text style={styles.settingLabel}>{label}</Text>
      </View>
      {children}
    </View>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const qc = useQueryClient();

  const [goalInputs, setGoalInputs] = useState<Partial<Record<TimeframeType, string>>>({});
  const [cpmInput, setCpmInput] = useState('');
  const [savingGoal, setSavingGoal] = useState<TimeframeType | null>(null);
  const [savingCpm, setSavingCpm] = useState(false);

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: api.getSettings,
    onSuccess: (d: any) => {
      if (!cpmInput) setCpmInput(d.cost_per_mile.toFixed(3));
    },
  } as any);

  const goalQueries = GOAL_TIMEFRAMES.map(tf => ({
    tf,
    query: useQuery({
      queryKey: ['goal', tf.key],
      queryFn: () => api.getGoal(tf.key),
    }),
  }));

  const settingsMutation = useMutation({
    mutationFn: api.updateSettings,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] });
      Alert.alert('✅ Saved', 'Settings updated.');
      setSavingCpm(false);
    },
    onError: () => { setSavingCpm(false); },
  });

  const handleSaveCpm = () => {
    const val = parseFloat(cpmInput);
    if (isNaN(val) || val < 0) { Alert.alert('Invalid value'); return; }
    setSavingCpm(true);
    settingsMutation.mutate({ cost_per_mile: val });
  };

  const handleSaveGoal = async (tf: TimeframeType) => {
    const val = parseFloat(goalInputs[tf] || '');
    if (isNaN(val) || val <= 0) { Alert.alert('Enter a valid dollar amount'); return; }
    setSavingGoal(tf);
    try {
      await api.upsertGoal(tf, val);
      qc.invalidateQueries({ queryKey: ['goal', tf] });
      qc.invalidateQueries({ queryKey: ['rollup'] });
      Alert.alert('✅ Goal saved');
    } catch {
      Alert.alert('Error', 'Failed to save goal');
    } finally {
      setSavingGoal(null);
    }
  };

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.container, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Profile */}
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>🥷</Text>
        </View>
        <View>
          <Text style={styles.profileName}>
            {user?.first_name || user?.username || 'Driver'}
          </Text>
          <Text style={styles.profileEmail}>{user?.email || ''}</Text>
        </View>
      </View>

      {/* Profit goals */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Profit Goals 🎯</Text>
        {goalQueries.map(({ tf, query }) => {
          const current = query.data?.target_profit;
          const inputVal = goalInputs[tf.key] !== undefined
            ? goalInputs[tf.key]!
            : current != null ? current.toFixed(0) : '';

          return (
            <View key={tf.key} style={styles.goalCard}>
              <View style={styles.goalHeader}>
                <Text style={styles.goalEmoji}>{tf.emoji}</Text>
                <Text style={styles.goalLabel}>{tf.label}</Text>
                {current != null && (
                  <Text style={styles.goalCurrent}>${current.toFixed(0)}</Text>
                )}
              </View>
              <View style={styles.goalInputRow}>
                <TextInput
                  style={styles.goalInput}
                  placeholder="Enter target $"
                  placeholderTextColor={colors.textMuted}
                  value={inputVal}
                  onChangeText={v => setGoalInputs(prev => ({ ...prev, [tf.key]: v }))}
                  keyboardType="decimal-pad"
                />
                <Pressable
                  style={styles.goalSaveBtn}
                  onPress={() => handleSaveGoal(tf.key)}
                  disabled={savingGoal === tf.key}
                >
                  {savingGoal === tf.key
                    ? <ActivityIndicator size="small" color={colors.black} />
                    : <Text style={styles.goalSaveBtnText}>Save</Text>
                  }
                </Pressable>
              </View>
            </View>
          );
        })}
      </View>

      {/* Cost per mile */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Vehicle Costs 🚗</Text>
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Cost per mile (IRS rate or actual)</Text>
          <View style={styles.goalInputRow}>
            <TextInput
              style={styles.goalInput}
              placeholder="0.670"
              placeholderTextColor={colors.textMuted}
              value={cpmInput || (settings?.cost_per_mile?.toFixed(3) ?? '')}
              onChangeText={setCpmInput}
              keyboardType="decimal-pad"
            />
            <Pressable
              style={styles.goalSaveBtn}
              onPress={handleSaveCpm}
              disabled={savingCpm}
            >
              {savingCpm
                ? <ActivityIndicator size="small" color={colors.black} />
                : <Text style={styles.goalSaveBtnText}>Save</Text>
              }
            </Pressable>
          </View>
          <Text style={styles.helpText}>Used to calculate net profit after vehicle expenses</Text>
        </View>
      </View>

      {/* Account */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.card}>
          <Pressable style={styles.menuRow} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color={colors.red} />
            <Text style={[styles.menuText, { color: colors.red }]}>Log Out</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} style={{ marginLeft: 'auto' }} />
          </Pressable>
        </View>
      </View>

      {/* App info */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>🥷 Earnings Ninja</Text>
        <Text style={styles.footerSub}>Track every dollar you earn</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  container: { paddingHorizontal: 16, gap: 20 },
  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: colors.surface, borderRadius: 16,
    padding: 16, borderWidth: 1, borderColor: colors.border,
  },
  avatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 26 },
  profileName: { fontFamily: 'Inter_700Bold', fontSize: 18, color: colors.textPrimary },
  profileEmail: { fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  section: { gap: 10 },
  sectionTitle: { fontFamily: 'Inter_700Bold', fontSize: 16, color: colors.textPrimary },
  card: {
    backgroundColor: colors.surface, borderRadius: 16,
    padding: 16, gap: 12, borderWidth: 1, borderColor: colors.border,
  },
  goalCard: {
    backgroundColor: colors.surface, borderRadius: 14,
    padding: 14, gap: 10, borderWidth: 1, borderColor: colors.border,
  },
  goalHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  goalEmoji: { fontSize: 18 },
  goalLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: colors.textPrimary, flex: 1 },
  goalCurrent: { fontFamily: 'Inter_700Bold', fontSize: 14, color: colors.accent },
  goalInputRow: { flexDirection: 'row', gap: 10 },
  goalInput: {
    flex: 1, backgroundColor: colors.background,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11,
    fontSize: 15, fontFamily: 'Inter_400Regular',
    color: colors.textPrimary, borderWidth: 1, borderColor: colors.border,
  },
  goalSaveBtn: {
    backgroundColor: colors.accent, borderRadius: 10,
    paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center',
    minWidth: 60,
  },
  goalSaveBtnText: { fontFamily: 'Inter_700Bold', fontSize: 14, color: colors.black },
  fieldLabel: { fontFamily: 'Inter_500Medium', fontSize: 13, color: colors.textSecondary },
  helpText: { fontFamily: 'Inter_400Regular', fontSize: 12, color: colors.textMuted },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  menuText: { fontFamily: 'Inter_500Medium', fontSize: 15 },
  settingRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 8,
  },
  settingLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  settingIcon: { fontSize: 18 },
  settingLabel: { fontFamily: 'Inter_500Medium', fontSize: 14, color: colors.textPrimary },
  footer: { alignItems: 'center', gap: 4, paddingTop: 8 },
  footerText: { fontFamily: 'Inter_700Bold', fontSize: 16, color: colors.textSecondary },
  footerSub: { fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.textMuted },
});
