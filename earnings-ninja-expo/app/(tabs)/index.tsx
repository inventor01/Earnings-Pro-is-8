import { useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, Pressable, Modal,
  RefreshControl, ActivityIndicator, Image, Alert,
  TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import {
  api, Entry, EntryType, AppType, ExpenseCategory,
  APP_LABELS, APP_COLORS, EXPENSE_EMOJIS, TimeframeType,
} from '@/lib/api';
import { useAuth } from '@/lib/authContext';
import * as Haptics from 'expo-haptics';

// Safe haptics — silently ignored on simulators / devices without haptic engine
const hTap = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
const hTapMed = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
const hTapHeavy = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
const hNotifyOk = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

// ─── Colors ──────────────────────────────────────────────────────────────────
const BG       = '#0a0a0f';
const SURFACE  = '#13131a';
const CARD_BG  = '#1a1a24';
const BORDER   = '#252535';
const PRIMARY  = '#facc15';
const PRI_LITE = '#2a2410';
const PRI_DARK = '#ca8a04';
const TEXT     = '#f1f5f9';
const TEXT_MID = '#cbd5e1';
const MUTED    = '#94a3b8';
const LABEL    = '#64748b';
const GREEN    = '#22c55e';
const GREEN_LT = '#052e16';
const RED      = '#ef4444';
const RED_LT   = '#450a0a';
const DIVIDER  = '#1e1e2e';

// Keep legacy names used inside modals / CalcPad
const ACCENT   = PRIMARY;
const DIM      = LABEL;
const CARD     = CARD_BG;

// ─── Types ────────────────────────────────────────────────────────────────────
type Period = 'today' | 'yesterday' | 'week' | 'last7' | 'month';

const PERIODS: { key: Period; label: string; tf: TimeframeType }[] = [
  { key: 'today',     label: 'Today',    tf: 'TODAY' },
  { key: 'yesterday', label: 'Yest.',    tf: 'YESTERDAY' },
  { key: 'week',      label: 'Week',     tf: 'THIS_WEEK' },
  { key: 'last7',     label: '7 Days',   tf: 'LAST_7_DAYS' },
  { key: 'month',     label: 'Month',    tf: 'THIS_MONTH' },
];

const PERIOD_LABELS: Record<Period, string> = {
  today:     "Today's",
  yesterday: "Yesterday's",
  week:      "This Week's",
  last7:     'Last 7 Days',
  month:     "This Month's",
};

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

// ─── Dashed Sparkline ─────────────────────────────────────────────────────────
function DashedLine({ color = PRIMARY }: { color?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 16 }}>
      {Array.from({ length: 28 }).map((_, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            height: 1.5,
            backgroundColor: i % 2 === 0 ? color : 'transparent',
            opacity: 0.55,
          }}
        />
      ))}
    </View>
  );
}

// ─── Small Stat Card ─────────────────────────────────────────────────────────
function StatCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <View style={{
      flex: 1,
      backgroundColor: SURFACE,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: BORDER,
      padding: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 4,
      elevation: 2,
    }}>
      <Text style={{ fontSize: 18, marginBottom: 4 }}>{icon}</Text>
      <Text style={{ color: TEXT, fontSize: 17, fontWeight: '800' }}>{value}</Text>
      <Text style={{ color: LABEL, fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 2 }}>
        {label}
      </Text>
    </View>
  );
}

// ─── Entry Row ────────────────────────────────────────────────────────────────
function EntryRow({ entry, onDelete }: { entry: Entry; onDelete: (id: number) => void }) {
  const isExpense = entry.amount < 0;
  const appColor  = APP_COLORS[entry.app] || MUTED;
  const time      = new Date(entry.timestamp).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  });

  return (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderBottomWidth: 1,
      borderBottomColor: DIVIDER,
    }}>
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
        <Text style={{ color: TEXT, fontSize: 14, fontWeight: '600' }}>
          {APP_LABELS[entry.app]}
          <Text style={{ color: LABEL, fontWeight: '400', fontSize: 12 }}> · {entry.type}</Text>
        </Text>
        <Text style={{ color: LABEL, fontSize: 11, marginTop: 1 }}>
          {time}{entry.distance_miles > 0 ? ` · ${Number(entry.distance_miles).toFixed(1)} mi` : ''}
        </Text>
      </View>
      <Text style={{
        color: isExpense ? RED : GREEN,
        fontSize: 15, fontWeight: '700',
      }}>
        {isExpense ? '-' : '+'}${Math.abs(Number(entry.amount)).toFixed(2)}
      </Text>
      <Pressable onPress={() => onDelete(entry.id)} style={{ marginLeft: 10, padding: 6 }}>
        <Ionicons name="trash-outline" size={14} color={LABEL} />
      </Pressable>
    </View>
  );
}

// ─── Calculator Pad ───────────────────────────────────────────────────────────
function CalcPad({ amount, mode, onAmount, onMode, onNext }: {
  amount: string;
  mode: 'add' | 'subtract';
  onAmount: (v: string) => void;
  onMode: (m: 'add' | 'subtract') => void;
  onNext: () => void;
}) {
  const holdRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [holding, setHolding] = useState(false);

  const tap = (n: string) => {
    hTap();
    onAmount(amount === '0' ? n : amount + n);
  };

  const isExp  = mode === 'subtract';
  const color  = isExp ? RED : GREEN;
  const numBg  = SURFACE;

  const numBtn = (label: string, onPress: () => void, bg = numBg, fg = TEXT) => (
    <Pressable
      key={label}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        backgroundColor: bg,
        borderRadius: 14,
        paddingVertical: 18,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: BORDER,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text style={{ color: fg, fontSize: 24, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={{ gap: 10 }}>
      {/* Amount display */}
      <View style={{
        backgroundColor: isExp ? RED_LT : GREEN_LT,
        borderRadius: 18,
        borderWidth: 1.5,
        borderColor: color + '44',
        padding: 20,
        alignItems: 'flex-end',
      }}>
        <Text style={{ color: MUTED, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
          {isExp ? 'Expense Amount' : 'Revenue Amount'}
        </Text>
        <Text style={{ color, fontSize: 48, fontWeight: '900' }}>
          ${amount}
        </Text>
      </View>

      {/* Revenue / Expense toggle */}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Pressable
          onPress={() => { hTap(); onMode('add'); }}
          style={{
            flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center',
            backgroundColor: mode === 'add' ? GREEN_LT : SURFACE,
            borderWidth: 1.5, borderColor: mode === 'add' ? GREEN : BORDER,
          }}
        >
          <Text style={{ color: mode === 'add' ? GREEN : MUTED, fontWeight: '800', fontSize: 15 }}>➕ Revenue</Text>
        </Pressable>
        <Pressable
          onPress={() => { hTap(); onMode('subtract'); }}
          style={{
            flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center',
            backgroundColor: mode === 'subtract' ? RED_LT : SURFACE,
            borderWidth: 1.5, borderColor: mode === 'subtract' ? RED : BORDER,
          }}
        >
          <Text style={{ color: mode === 'subtract' ? RED : MUTED, fontWeight: '800', fontSize: 15 }}>➖ Expense</Text>
        </Pressable>
      </View>

      {/* Number grid */}
      {[
        ['7', '8', '9'],
        ['4', '5', '6'],
        ['1', '2', '3'],
        ['.', '0', '⌫'],
      ].map((row, ri) => (
        <View key={ri} style={{ flexDirection: 'row', gap: 10 }}>
          {row.map(k =>
            k === '⌫'
              ? (
                <Pressable
                  key={k}
                  onPress={() => { hTap(); onAmount(amount.length > 1 ? amount.slice(0, -1) : '0'); }}
                  onPressIn={() => {
                    holdRef.current = setTimeout(() => {
                      setHolding(true);
                      hTapHeavy();
                      onAmount('0');
                    }, 500);
                  }}
                  onPressOut={() => {
                    if (holdRef.current) clearTimeout(holdRef.current);
                    setHolding(false);
                  }}
                  style={({ pressed }) => ({
                    flex: 1, backgroundColor: RED_LT, borderRadius: 14,
                    paddingVertical: 18, alignItems: 'center',
                    borderWidth: 1, borderColor: RED + '44',
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Text style={{ color: RED, fontSize: 24, fontWeight: '700' }}>⌫</Text>
                </Pressable>
              )
              : numBtn(k, () => tap(k))
          )}
        </View>
      ))}

      {/* Next button */}
      <Pressable
        onPress={() => { hTapMed(); onNext(); }}
        style={({ pressed }) => ({
          backgroundColor: PRIMARY,
          borderRadius: 16, paddingVertical: 18, alignItems: 'center',
          opacity: pressed ? 0.88 : 1,
        })}
      >
        <Text style={{ color: '#000', fontWeight: '900', fontSize: 18 }}>Next →</Text>
      </Pressable>
    </View>
  );
}

// ─── Add Entry Modal ───────────────────────────────────────────────────────────
function AddEntryModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [step, setStep]           = useState<'calc' | 'details'>('calc');
  const [amount, setAmount]       = useState('0');
  const [mode, setMode]           = useState<'add' | 'subtract'>('add');
  const [entryType, setEntryType] = useState<EntryType>('ORDER');
  const [app, setApp]             = useState<AppType>('DOORDASH');
  const [category, setCategory]  = useState<ExpenseCategory>('GAS');
  const [miles, setMiles]         = useState('');
  const [minutes, setMinutes]     = useState('');
  const [note, setNote]           = useState('');

  const reset = () => {
    setStep('calc'); setAmount('0'); setMode('add');
    setEntryType('ORDER'); setApp('DOORDASH'); setCategory('GAS');
    setMiles(''); setMinutes(''); setNote('');
  };

  const mutation = useMutation({
    mutationFn: api.createEntry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries'] });
      queryClient.invalidateQueries({ queryKey: ['rollup'] });
      queryClient.invalidateQueries({ queryKey: ['goal'] });
      hNotifyOk();
      reset();
      onClose();
    },
    onError: () => Alert.alert('Error', 'Failed to save entry.'),
  });

  const handleSave = () => {
    const num = parseFloat(amount);
    if (!num || num <= 0) { Alert.alert('Invalid amount', 'Enter an amount > 0'); return; }
    mutation.mutate({
      type: entryType,
      app,
      amount: mode === 'subtract' ? -num : num,
      distance_miles: miles ? parseFloat(miles) : undefined,
      duration_minutes: minutes ? parseInt(minutes) : undefined,
      category: entryType === 'EXPENSE' ? category : undefined,
      note: note || undefined,
    });
  };

  const isExp = mode === 'subtract';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => { reset(); onClose(); }}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: BG }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          {/* Modal header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <Text style={{ color: TEXT, fontSize: 20, fontWeight: '800' }}>
              {step === 'calc' ? '💰 Log Entry' : '📝 Entry Details'}
            </Text>
            <Pressable onPress={() => { reset(); onClose(); }} style={{ padding: 6 }}>
              <Ionicons name="close-circle" size={28} color={MUTED} />
            </Pressable>
          </View>

          {step === 'calc' ? (
            <CalcPad
              amount={amount}
              mode={mode}
              onAmount={setAmount}
              onMode={setMode}
              onNext={() => setStep('details')}
            />
          ) : (
            <View style={{ gap: 16 }}>
              {/* Amount summary */}
              <Pressable
                onPress={() => setStep('calc')}
                style={{
                  backgroundColor: isExp ? RED_LT : GREEN_LT,
                  borderRadius: 14,
                  borderWidth: 1.5,
                  borderColor: (isExp ? RED : GREEN) + '44',
                  padding: 16,
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: MUTED, fontSize: 13 }}>← Edit Amount</Text>
                <Text style={{ color: isExp ? RED : GREEN, fontSize: 30, fontWeight: '900' }}>
                  {isExp ? '-' : '+'}${amount}
                </Text>
              </Pressable>

              {/* Entry type */}
              <View>
                <Text style={{ color: LABEL, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Entry Type</Text>
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                  {(['ORDER', 'BONUS', 'EXPENSE', 'CANCELLATION'] as EntryType[]).map(t => (
                    <Pressable
                      key={t}
                      onPress={() => { hTap(); setEntryType(t); }}
                      style={{
                        paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12,
                        backgroundColor: entryType === t ? PRI_LITE : SURFACE,
                        borderWidth: 1.5, borderColor: entryType === t ? PRIMARY : BORDER,
                      }}
                    >
                      <Text style={{ color: entryType === t ? PRIMARY : MUTED, fontWeight: '700', fontSize: 13 }}>{t}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Platform */}
              <View>
                <Text style={{ color: LABEL, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Platform</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {APPS.map(a => (
                      <Pressable
                        key={a.key}
                        onPress={() => { hTap(); setApp(a.key); }}
                        style={{
                          paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
                          backgroundColor: app === a.key ? a.color + '18' : SURFACE,
                          borderWidth: 1.5, borderColor: app === a.key ? a.color : BORDER,
                        }}
                      >
                        <Text style={{ color: app === a.key ? a.color : MUTED, fontWeight: '700', fontSize: 13 }}>{a.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>
              </View>

              {/* Expense category */}
              {entryType === 'EXPENSE' && (
                <View>
                  <Text style={{ color: LABEL, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Category</Text>
                  <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                    {EXPENSE_CATS.map(c => (
                      <Pressable
                        key={c}
                        onPress={() => { hTap(); setCategory(c); }}
                        style={{
                          paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
                          backgroundColor: category === c ? PRI_LITE : SURFACE,
                          borderWidth: 1, borderColor: category === c ? PRIMARY : BORDER,
                        }}
                      >
                        <Text style={{ color: category === c ? PRIMARY : MUTED, fontSize: 13, fontWeight: '700' }}>
                          {EXPENSE_EMOJIS[c]} {c}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}

              {/* Miles & Minutes */}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {[
                  { label: 'Miles', value: miles, set: setMiles, type: 'decimal-pad' as const, placeholder: '0.0' },
                  { label: 'Minutes', value: minutes, set: setMinutes, type: 'number-pad' as const, placeholder: '0' },
                ].map(f => (
                  <View key={f.label} style={{ flex: 1 }}>
                    <Text style={{ color: LABEL, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>{f.label}</Text>
                    <TextInput
                      value={f.value}
                      onChangeText={f.set}
                      placeholder={f.placeholder}
                      placeholderTextColor={LABEL}
                      keyboardType={f.type}
                      style={{
                        backgroundColor: SURFACE, borderWidth: 1, borderColor: BORDER, borderRadius: 12,
                        paddingHorizontal: 14, paddingVertical: 13, color: TEXT, fontSize: 16, fontWeight: '600',
                      }}
                    />
                  </View>
                ))}
              </View>

              {/* Note */}
              <View>
                <Text style={{ color: LABEL, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Note (optional)</Text>
                <TextInput
                  value={note}
                  onChangeText={setNote}
                  placeholder="Add a note..."
                  placeholderTextColor={LABEL}
                  multiline
                  style={{
                    backgroundColor: SURFACE, borderWidth: 1, borderColor: BORDER, borderRadius: 12,
                    paddingHorizontal: 14, paddingVertical: 13, color: TEXT, fontSize: 15, minHeight: 60, textAlignVertical: 'top',
                  }}
                />
              </View>

              {/* Save */}
              <Pressable
                onPress={handleSave}
                disabled={mutation.isPending}
                style={({ pressed }) => ({
                  backgroundColor: PRIMARY, borderRadius: 16, paddingVertical: 18, alignItems: 'center',
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                {mutation.isPending
                  ? <ActivityIndicator color="#000" />
                  : <Text style={{ color: '#000', fontWeight: '900', fontSize: 18 }}>💾 Save Entry</Text>
                }
              </Pressable>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Settings Modal ────────────────────────────────────────────────────────────
function SettingsModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
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
                    <Text style={{ color: '#000', fontWeight: '800' }}>Save</Text>
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
      </ScrollView>
    </Modal>
  );
}

// ─── Dashboard Screen ─────────────────────────────────────────────────────────
export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<Period>('today');
  const [refreshing, setRefreshing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState('');
  const [showAllEntries, setShowAllEntries] = useState(false);
  const [aiCollapsed, setAiCollapsed] = useState(true);

  const tf = PERIODS.find(p => p.key === period)!.tf;

  const { data: rollup, isLoading: rollupLoading } = useQuery({
    queryKey: ['rollup', tf],
    queryFn: () => api.getRollup(tf),
  });

  const { data: entries = [] } = useQuery({
    queryKey: ['entries', tf],
    queryFn: () => api.getEntries(tf),
  });

  const { data: goal, refetch: refetchGoal } = useQuery({
    queryKey: ['goal', tf],
    queryFn: () => api.getGoal(tf),
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
  const rawGoal   = goal?.target_profit;
  const goalTarget = (rawGoal !== undefined && rawGoal !== null) ? Number(rawGoal) || null : null;
  const displayedEntries = showAllEntries ? entries : entries.slice(0, 8);
  const orderCount = entries.filter(e => Number(e.amount) > 0).length;

  const isProfit   = profit >= 0;
  const profitColor = isProfit ? GREEN : RED;
  const profitBg    = isProfit ? GREEN_LT : RED_LT;

  // Goal progress
  const safeGoal  = goalTarget ? Number(goalTarget) : 0;
  const goalPct   = safeGoal > 0 ? Math.min((profit / safeGoal) * 100, 100) : 0;
  const goalColor = goalPct >= 100 ? GREEN : PRIMARY;

  // Period label for the date bar
  const periodLabel = PERIOD_LABELS[period];

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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Image
              source={require('../../assets/ninja-logo.png')}
              style={{ width: 36, height: 36, resizeMode: 'contain' }}
            />
            <Text style={{ fontSize: 18, fontWeight: '900', letterSpacing: 0.3, color: TEXT }}>
              EARNINGS{' '}
              <Text style={{ color: PRIMARY }}>NINJA</Text>
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
              onPress={onRefresh}
              style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: BG, borderWidth: 1, borderColor: BORDER, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="refresh" size={17} color={MUTED} />
            </Pressable>
            <Pressable
              onPress={() => setShowSettings(true)}
              style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: BG, borderWidth: 1, borderColor: BORDER, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="settings-outline" size={17} color={MUTED} />
            </Pressable>
          </View>
        </View>

        {/* ── Period Tabs ───────────────────────────────────────────────────── */}
        <View style={{ backgroundColor: SURFACE, borderBottomWidth: 1, borderBottomColor: BORDER }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, gap: 6, flexDirection: 'row' }}>
            {PERIODS.map(p => (
              <Pressable
                key={p.key}
                onPress={() => { hTap(); setPeriod(p.key); }}
                style={{
                  paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20,
                  backgroundColor: period === p.key ? PRIMARY : 'transparent',
                }}
              >
                <Text style={{
                  color: period === p.key ? '#fff' : MUTED,
                  fontSize: 13, fontWeight: period === p.key ? '700' : '500',
                }}>
                  {p.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View style={{ paddingHorizontal: 16, paddingTop: 14, gap: 12 }}>

          {rollupLoading ? (
            <View style={{ alignItems: 'center', paddingVertical: 60 }}>
              <ActivityIndicator color={PRIMARY} size="large" />
            </View>
          ) : (
            <>
              {/* ── Main Profit Card ────────────────────────────────────────── */}
              <View style={{
                backgroundColor: SURFACE,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: BORDER,
                padding: 20,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.08,
                shadowRadius: 12,
                elevation: 4,
              }}>
                {/* Label */}
                <Text style={{ color: LABEL, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5 }}>
                  NET PROFIT
                </Text>

                {/* Big profit number */}
                <Text style={{ color: profitColor, fontSize: 48, fontWeight: '900', lineHeight: 56, marginTop: 4 }}>
                  {isProfit ? '' : '-'}${Math.abs(profit).toFixed(2)}
                </Text>

                {/* Date range row */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 }}>
                  <Ionicons name="chevron-back" size={16} color={LABEL} />
                  <Text style={{ color: MUTED, fontSize: 13, fontWeight: '500', flex: 1, textAlign: 'center' }}>
                    {periodLabel} earnings
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={LABEL} />
                </View>

                {/* Dashed sparkline */}
                <DashedLine color={profitColor} />

                {/* Three stats */}
                <View style={{ flexDirection: 'row' }}>
                  {[
                    { label: 'REVENUE',  value: `$${revenue.toFixed(0)}` },
                    { label: 'ORDERS',   value: `${orderCount}` },
                    { label: 'AVG ORDER', value: `$${avgOrder.toFixed(0)}` },
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
                      <Text style={{ color: TEXT, fontSize: 18, fontWeight: '800', marginTop: 2 }}>
                        {stat.value}
                      </Text>
                    </View>
                  ))}
                </View>

              </View>

              {/* ── Secondary Stat Cards ────────────────────────────────────── */}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <StatCard label="$/Hour"    value={`$${perHour.toFixed(2)}`} icon="⏱️" />
                <StatCard label="$/Mile"    value={`$${perMile.toFixed(2)}`} icon="📍" />
                <StatCard label="Miles"     value={miles.toFixed(1)}         icon="🚗" />
              </View>

              {/* ── Expenses card ───────────────────────────────────────────── */}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <StatCard label="Revenue"   value={`$${revenue.toFixed(2)}`}          icon="💵" />
                <StatCard label="Expenses"  value={`$${Math.abs(expenses).toFixed(2)}`} icon="💸" />
              </View>

              {/* ── AI Suggestion (collapsible) ─────────────────────────────── */}
              {aiSuggestion && (
                <View style={{
                  backgroundColor: SURFACE, borderRadius: 16, borderWidth: 1, borderColor: PRIMARY + '30',
                  padding: 16,
                  shadowColor: PRIMARY, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 6,
                }}>
                  <Pressable
                    onPress={() => { hTapMed(); setAiCollapsed(c => !c); }}
                    style={({ pressed }) => ({
                      flexDirection: 'row', alignItems: 'center', gap: 8,
                      marginBottom: aiCollapsed ? 0 : 8,
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <Text style={{ fontSize: 18 }}>🤖</Text>
                    <Text style={{ color: PRIMARY, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, flex: 1 }}>
                      AI Earning Tip
                    </Text>
                    <Text style={{ color: PRIMARY, fontSize: 14, fontWeight: '700' }}>
                      {aiCollapsed ? '▼' : '▲'}
                    </Text>
                  </Pressable>
                  {!aiCollapsed && (
                    <>
                      <Text style={{ color: TEXT_MID, fontSize: 14, lineHeight: 20 }}>{aiSuggestion.suggestion}</Text>
                      {(aiSuggestion.minimum_order || aiSuggestion.peak_time) && (
                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                          {aiSuggestion.minimum_order && (
                            <View style={{ backgroundColor: GREEN_LT, borderRadius: 8, borderWidth: 1, borderColor: GREEN + '40', paddingHorizontal: 10, paddingVertical: 5 }}>
                              <Text style={{ color: GREEN, fontSize: 12, fontWeight: '700' }}>Min: ${aiSuggestion.minimum_order}</Text>
                            </View>
                          )}
                          {aiSuggestion.peak_time && (
                            <View style={{ backgroundColor: PRI_LITE, borderRadius: 8, borderWidth: 1, borderColor: PRIMARY + '40', paddingHorizontal: 10, paddingVertical: 5 }}>
                              <Text style={{ color: PRIMARY, fontSize: 12, fontWeight: '700' }}>⏰ {aiSuggestion.peak_time}</Text>
                            </View>
                          )}
                        </View>
                      )}
                    </>
                  )}
                </View>
              )}

              {/* ── Goals Section ────────────────────────────────────────────── */}
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
                      <Text style={{ color: '#000', fontWeight: '800' }}>Save</Text>
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

              {/* ── Entries List ─────────────────────────────────────────────── */}
              {entries.length > 0 && (
                <View style={{
                  backgroundColor: SURFACE, borderRadius: 16, borderWidth: 1, borderColor: BORDER, overflow: 'hidden',
                  shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4,
                }}>
                  <View style={{
                    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: DIVIDER,
                  }}>
                    <Text style={{ color: LABEL, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 }}>
                      Entries ({entries.length})
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <View style={{ backgroundColor: GREEN_LT, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                        <Text style={{ color: GREEN, fontSize: 11, fontWeight: '700' }}>+${revenue.toFixed(2)}</Text>
                      </View>
                      <View style={{ backgroundColor: RED_LT, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                        <Text style={{ color: RED, fontSize: 11, fontWeight: '700' }}>-${Math.abs(expenses).toFixed(2)}</Text>
                      </View>
                    </View>
                  </View>
                  {displayedEntries.map(e => (
                    <EntryRow
                      key={e.id}
                      entry={e}
                      onDelete={(id) => {
                        Alert.alert('Delete Entry', 'Remove this entry?', [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(id) },
                        ]);
                      }}
                    />
                  ))}
                  {entries.length > 8 && (
                    <Pressable
                      onPress={() => setShowAllEntries(s => !s)}
                      style={{ padding: 14, alignItems: 'center', borderTopWidth: 1, borderTopColor: DIVIDER }}
                    >
                      <Text style={{ color: PRIMARY, fontSize: 13, fontWeight: '700' }}>
                        {showAllEntries ? '▲ Show less' : `▼ Show all ${entries.length} entries`}
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

      {/* ── Sticky "+ Add Entry" bar ─────────────────────────────────────────── */}
      <Pressable
        onPress={() => { hTapMed(); setShowAdd(true); }}
        style={({ pressed }) => ({
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: PRIMARY,
          paddingTop: 16,
          paddingBottom: insets.bottom > 0 ? insets.bottom + 10 : 18,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          opacity: pressed ? 0.88 : 1,
          shadowColor: PRIMARY,
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.5,
          shadowRadius: 16,
          elevation: 12,
        })}
      >
        <Ionicons name="add-circle" size={24} color="#000" />
        <Text style={{ color: '#000', fontWeight: '900', fontSize: 18, letterSpacing: 0.5 }}>
          + Add Entry
        </Text>
      </Pressable>

      {/* ── Modals ───────────────────────────────────────────────────────────── */}
      <AddEntryModal visible={showAdd} onClose={() => setShowAdd(false)} />
      <SettingsModal visible={showSettings} onClose={() => setShowSettings(false)} />
    </View>
  );
}
