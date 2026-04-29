import { useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, Pressable, Modal,
  RefreshControl, ActivityIndicator, Image, Alert,
  TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
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
const BG = '#0d0d12';
const SURFACE = '#13131a';
const CARD = '#1a1a24';
const BORDER = '#252535';
const ACCENT = '#facc15';
const GREEN = '#22c55e';
const RED = '#ef4444';
const PURPLE = '#a855f7';
const ORANGE = '#f97316';
const BLUE = '#3b82f6';
const TEXT = '#f1f5f9';
const MUTED = '#94a3b8';
const DIM = '#4b5563';

// ─── Types ────────────────────────────────────────────────────────────────────
type Period = 'today' | 'yesterday' | 'week' | 'last7' | 'month';

const PERIODS: { key: Period; label: string; tf: TimeframeType }[] = [
  { key: 'today', label: 'Today', tf: 'TODAY' },
  { key: 'yesterday', label: 'Yesterday', tf: 'YESTERDAY' },
  { key: 'week', label: 'This Week', tf: 'THIS_WEEK' },
  { key: 'last7', label: 'Last 7 Days', tf: 'LAST_7_DAYS' },
  { key: 'month', label: 'This Month', tf: 'THIS_MONTH' },
];

const PERIOD_LABELS: Record<Period, string> = {
  today: "Today's",
  yesterday: "Yesterday's",
  week: "This Week's",
  last7: 'Last 7 Days',
  month: "This Month's",
};

const APPS: { key: AppType; label: string; color: string }[] = [
  { key: 'DOORDASH', label: 'DoorDash', color: '#FF3008' },
  { key: 'UBEREATS', label: 'Uber Eats', color: '#06C167' },
  { key: 'INSTACART', label: 'Instacart', color: '#43B02A' },
  { key: 'GRUBHUB', label: 'GrubHub', color: '#F63440' },
  { key: 'SHIPT', label: 'Shipt', color: '#00A6CE' },
  { key: 'OTHER', label: 'Other', color: '#94a3b8' },
];

const EXPENSE_CATS: ExpenseCategory[] = [
  'GAS', 'PARKING', 'TOLLS', 'MAINTENANCE', 'PHONE', 'SUBSCRIPTION', 'FOOD', 'OTHER',
];

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) {
  return (
    <View style={{
      flex: 1,
      backgroundColor: CARD,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: color + '44',
      padding: 14,
      shadowColor: color,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.2,
      shadowRadius: 10,
      elevation: 5,
    }}>
      <View style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        backgroundColor: color, borderTopLeftRadius: 16, borderTopRightRadius: 16, opacity: 0.8,
      }} />
      <Text style={{ color, fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 6 }}>
        {label}
      </Text>
      <Text style={{
        color,
        fontSize: 26,
        fontWeight: '900',
        textShadowColor: color,
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 8,
      }}>
        {value}
      </Text>
      {sub && <Text style={{ color: MUTED, fontSize: 10, marginTop: 3 }}>{sub}</Text>}
      <View style={{ height: 2, backgroundColor: color + '44', borderRadius: 2, marginTop: 10 }} />
    </View>
  );
}

// ─── Goal Bar ─────────────────────────────────────────────────────────────────
function GoalBar({
  period, profit, goalAmount, onEditGoal,
}: {
  period: Period; profit: number; goalAmount: number | null; onEditGoal: () => void;
}) {
  const safeGoal = Number(goalAmount) || 0;
  const safeProfitNum = Number(profit) || 0;
  const pct = safeGoal > 0 ? Math.min((safeProfitNum / safeGoal) * 100, 100) : 0;
  const color = pct >= 100 ? ACCENT : pct >= 60 ? GREEN : BLUE;

  return (
    <View style={{
      backgroundColor: SURFACE,
      borderBottomWidth: 1,
      borderBottomColor: BORDER,
      paddingHorizontal: 14,
      paddingVertical: 10,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
          <Text style={{ color: ACCENT, fontSize: 12, fontWeight: '800' }}>
            {PERIOD_LABELS[period]} Goal:
          </Text>
          <Text style={{
            color: ACCENT,
            fontSize: 18,
            fontWeight: '900',
            textShadowColor: ACCENT,
            textShadowOffset: { width: 0, height: 0 },
            textShadowRadius: 6,
          }}>
            {safeGoal > 0 ? `$${safeProfitNum.toFixed(2)} / $${safeGoal.toFixed(0)}` : 'Not set'}
          </Text>
          <Pressable onPress={onEditGoal} style={{ paddingHorizontal: 6 }}>
            <Text style={{ color: DIM, fontSize: 11 }}>edit</Text>
          </Pressable>
        </View>
        <Text style={{ color, fontSize: 12, fontWeight: '800' }}>
          {safeGoal > 0 ? `${Math.round(pct)}%` : ''}
        </Text>
      </View>
      <View style={{ backgroundColor: BORDER, borderRadius: 6, height: 8, overflow: 'hidden' }}>
        {safeGoal > 0 && (
          <View style={{
            width: `${pct}%`,
            height: '100%',
            backgroundColor: color,
            borderRadius: 6,
            shadowColor: color,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.8,
            shadowRadius: 4,
          }} />
        )}
      </View>
      {pct >= 100 && (
        <Text style={{ color: ACCENT, fontSize: 12, fontWeight: '800', textAlign: 'center', marginTop: 4 }}>
          🎉 Goal Reached!
        </Text>
      )}
    </View>
  );
}

// ─── Entry Row ────────────────────────────────────────────────────────────────
function EntryRow({ entry, onDelete }: { entry: Entry; onDelete: (id: number) => void }) {
  const isExpense = entry.amount < 0;
  const color = isExpense ? RED : GREEN;
  const appColor = APP_COLORS[entry.app] || DIM;
  const time = new Date(entry.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  return (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderBottomWidth: 1,
      borderBottomColor: BORDER,
    }}>
      <View style={{
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: appColor + '22', borderWidth: 1.5, borderColor: appColor,
        alignItems: 'center', justifyContent: 'center', marginRight: 10,
      }}>
        <Text style={{ fontSize: 13, fontWeight: '900', color: appColor }}>
          {(APP_LABELS[entry.app] || 'O')[0]}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: TEXT, fontSize: 14, fontWeight: '700' }}>
          {APP_LABELS[entry.app]}
          <Text style={{ color: DIM, fontWeight: '500', fontSize: 12 }}> · {entry.type}</Text>
        </Text>
        <Text style={{ color: MUTED, fontSize: 11, marginTop: 1 }}>
          {time}{entry.distance_miles > 0 ? ` · ${entry.distance_miles.toFixed(1)} mi` : ''}
        </Text>
      </View>
      <Text style={{ color, fontSize: 16, fontWeight: '900' }}>
        {isExpense ? '-' : '+'}${Math.abs(entry.amount).toFixed(2)}
      </Text>
      <Pressable onPress={() => onDelete(entry.id)} style={{ marginLeft: 10, padding: 4 }}>
        <Ionicons name="trash-outline" size={15} color={DIM} />
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

  const isExp = mode === 'subtract';
  const color = isExp ? RED : GREEN;

  const numBtn = (label: string, onPress: () => void, bg = CARD, fg = TEXT) => (
    <Pressable
      key={label}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        backgroundColor: bg,
        borderRadius: 14,
        paddingVertical: 18,
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: BORDER,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <Text style={{ color: fg, fontSize: 24, fontWeight: '800' }}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={{ gap: 10 }}>
      {/* Amount display */}
      <View style={{
        backgroundColor: CARD,
        borderRadius: 18,
        borderWidth: 2,
        borderColor: color + '66',
        padding: 20,
        alignItems: 'flex-end',
        shadowColor: color,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
      }}>
        <Text style={{ color: MUTED, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
          {isExp ? 'Expense Amount' : 'Revenue Amount'}
        </Text>
        <Text style={{
          color,
          fontSize: 48,
          fontWeight: '900',
          textShadowColor: color,
          textShadowOffset: { width: 0, height: 0 },
          textShadowRadius: 10,
        }}>
          ${amount}
        </Text>
      </View>

      {/* Revenue / Expense toggle */}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Pressable
          onPress={() => { hTap(); onMode('add'); }}
          style={{
            flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center',
            backgroundColor: mode === 'add' ? GREEN + '22' : CARD,
            borderWidth: 2, borderColor: mode === 'add' ? GREEN : BORDER,
            shadowColor: mode === 'add' ? GREEN : 'transparent',
            shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 8,
          }}
        >
          <Text style={{ color: mode === 'add' ? GREEN : MUTED, fontWeight: '800', fontSize: 15 }}>➕ Revenue</Text>
        </Pressable>
        <Pressable
          onPress={() => { hTap(); onMode('subtract'); }}
          style={{
            flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center',
            backgroundColor: mode === 'subtract' ? RED + '22' : CARD,
            borderWidth: 2, borderColor: mode === 'subtract' ? RED : BORDER,
            shadowColor: mode === 'subtract' ? RED : 'transparent',
            shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 8,
          }}
        >
          <Text style={{ color: mode === 'subtract' ? RED : MUTED, fontWeight: '800', fontSize: 15 }}>➖ Expense</Text>
        </Pressable>
      </View>

      {/* Digit rows */}
      {[['7', '8', '9'], ['4', '5', '6'], ['1', '2', '3']].map((row) => (
        <View key={row[0]} style={{ flexDirection: 'row', gap: 10 }}>
          {row.map((n) => numBtn(n, () => tap(n)))}
        </View>
      ))}

      {/* Bottom row: C, 0, . */}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Pressable
          onPressIn={() => {
            holdRef.current = setTimeout(() => {
              setHolding(true);
              hTapHeavy();
              onAmount('0');
            }, 500);
          }}
          onPressOut={() => {
            if (holdRef.current) clearTimeout(holdRef.current);
            if (!holding) {
              hTap();
              onAmount(amount.length > 1 ? amount.slice(0, -1) : '0');
            }
            setHolding(false);
          }}
          style={{
            flex: 1, borderRadius: 14, paddingVertical: 18, alignItems: 'center',
            backgroundColor: holding ? RED + '33' : ACCENT + '22',
            borderWidth: 1.5, borderColor: holding ? RED : ACCENT,
          }}
        >
          <Text style={{ color: holding ? RED : ACCENT, fontSize: 24, fontWeight: '900' }}>
            {holding ? '✓' : '⌫'}
          </Text>
        </Pressable>
        {numBtn('0', () => tap('0'))}
        {numBtn('.', () => {
          if (!amount.includes('.')) {
            hTap();
            onAmount(amount + '.');
          }
        })}
      </View>

      {/* Next */}
      <Pressable
        onPress={onNext}
        style={({ pressed }) => ({
          backgroundColor: ACCENT,
          borderRadius: 16,
          paddingVertical: 18,
          alignItems: 'center',
          opacity: pressed ? 0.85 : 1,
          shadowColor: ACCENT,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.7,
          shadowRadius: 14,
        })}
      >
        <Text style={{ color: '#000', fontWeight: '900', fontSize: 18 }}>Next Step →</Text>
      </Pressable>
    </View>
  );
}

// ─── Add Entry Modal ───────────────────────────────────────────────────────────
function AddEntryModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<'calc' | 'details'>('calc');
  const [amount, setAmount] = useState('0');
  const [mode, setMode] = useState<'add' | 'subtract'>('add');
  const [entryType, setEntryType] = useState<EntryType>('ORDER');
  const [app, setApp] = useState<AppType>('UBEREATS');
  const [category, setCategory] = useState<ExpenseCategory>('GAS');
  const [miles, setMiles] = useState('');
  const [minutes, setMinutes] = useState('');
  const [note, setNote] = useState('');

  const reset = () => {
    setStep('calc'); setAmount('0'); setMode('add');
    setEntryType('ORDER'); setApp('UBEREATS'); setCategory('GAS');
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
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          {/* Modal header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <Text style={{
              color: ACCENT, fontSize: 20, fontWeight: '900',
              textShadowColor: ACCENT, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8,
            }}>
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
              {/* Amount summary (tappable to go back) */}
              <Pressable
                onPress={() => setStep('calc')}
                style={{
                  backgroundColor: CARD,
                  borderRadius: 14,
                  borderWidth: 2,
                  borderColor: (isExp ? RED : GREEN) + '55',
                  padding: 16,
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: MUTED, fontSize: 13 }}>← Edit Amount</Text>
                <Text style={{
                  color: isExp ? RED : GREEN,
                  fontSize: 30,
                  fontWeight: '900',
                  textShadowColor: isExp ? RED : GREEN,
                  textShadowOffset: { width: 0, height: 0 },
                  textShadowRadius: 8,
                }}>
                  {isExp ? '-' : '+'}${amount}
                </Text>
              </Pressable>

              {/* Entry type */}
              <View>
                <Text style={{ color: MUTED, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Entry Type</Text>
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                  {(['ORDER', 'BONUS', 'EXPENSE', 'CANCELLATION'] as EntryType[]).map(t => (
                    <Pressable
                      key={t}
                      onPress={() => { hTap(); setEntryType(t); }}
                      style={{
                        paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12,
                        backgroundColor: entryType === t ? ACCENT + '22' : CARD,
                        borderWidth: 1.5, borderColor: entryType === t ? ACCENT : BORDER,
                      }}
                    >
                      <Text style={{ color: entryType === t ? ACCENT : MUTED, fontWeight: '700', fontSize: 13 }}>{t}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Platform */}
              <View>
                <Text style={{ color: MUTED, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Platform</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {APPS.map(a => (
                      <Pressable
                        key={a.key}
                        onPress={() => { hTap(); setApp(a.key); }}
                        style={{
                          paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
                          backgroundColor: app === a.key ? a.color + '22' : CARD,
                          borderWidth: 1.5, borderColor: app === a.key ? a.color : BORDER,
                          shadowColor: app === a.key ? a.color : 'transparent',
                          shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 6,
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
                  <Text style={{ color: MUTED, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Category</Text>
                  <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                    {EXPENSE_CATS.map(c => (
                      <Pressable
                        key={c}
                        onPress={() => { hTap(); setCategory(c); }}
                        style={{
                          paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
                          backgroundColor: category === c ? ACCENT + '22' : CARD,
                          borderWidth: 1, borderColor: category === c ? ACCENT : BORDER,
                        }}
                      >
                        <Text style={{ color: category === c ? ACCENT : MUTED, fontSize: 13, fontWeight: '700' }}>
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
                    <Text style={{ color: MUTED, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>{f.label}</Text>
                    <TextInput
                      value={f.value}
                      onChangeText={f.set}
                      placeholder={f.placeholder}
                      placeholderTextColor={DIM}
                      keyboardType={f.type}
                      style={{
                        backgroundColor: CARD, borderWidth: 1.5, borderColor: BORDER, borderRadius: 12,
                        paddingHorizontal: 14, paddingVertical: 13, color: TEXT, fontSize: 16, fontWeight: '600',
                      }}
                    />
                  </View>
                ))}
              </View>

              {/* Note */}
              <View>
                <Text style={{ color: MUTED, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Note (optional)</Text>
                <TextInput
                  value={note}
                  onChangeText={setNote}
                  placeholder="Add a note..."
                  placeholderTextColor={DIM}
                  multiline
                  style={{
                    backgroundColor: CARD, borderWidth: 1.5, borderColor: BORDER, borderRadius: 12,
                    paddingHorizontal: 14, paddingVertical: 13, color: TEXT, fontSize: 15, minHeight: 60, textAlignVertical: 'top',
                  }}
                />
              </View>

              {/* Save */}
              <Pressable
                onPress={handleSave}
                disabled={mutation.isPending}
                style={({ pressed }) => ({
                  backgroundColor: ACCENT, borderRadius: 16, paddingVertical: 18, alignItems: 'center',
                  opacity: pressed ? 0.85 : 1,
                  shadowColor: ACCENT, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.7, shadowRadius: 14,
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

  const goalToday = useQuery({ queryKey: ['goal', 'TODAY'], queryFn: () => api.getGoal('TODAY') });
  const goalWeek = useQuery({ queryKey: ['goal', 'THIS_WEEK'], queryFn: () => api.getGoal('THIS_WEEK') });
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
    { tf: 'TODAY', label: 'Daily Goal', emoji: '☀️' },
    { tf: 'THIS_WEEK', label: 'Weekly Goal', emoji: '📅' },
    { tf: 'THIS_MONTH', label: 'Monthly Goal', emoji: '🗓️' },
  ];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <ScrollView style={{ flex: 1, backgroundColor: BG }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <Text style={{ color: ACCENT, fontSize: 20, fontWeight: '900' }}>⚙️ Settings</Text>
          <Pressable onPress={onClose} style={{ padding: 6 }}>
            <Ionicons name="close-circle" size={28} color={MUTED} />
          </Pressable>
        </View>

        {/* Account */}
        <View style={{
          backgroundColor: CARD, borderRadius: 16, borderWidth: 1, borderColor: BORDER,
          padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20,
        }}>
          <View style={{
            width: 48, height: 48, borderRadius: 24,
            backgroundColor: ACCENT + '22', borderWidth: 2, borderColor: ACCENT,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Text style={{ fontSize: 22 }}>🥷</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: TEXT, fontSize: 16, fontWeight: '800' }}>{user?.username || 'Driver'}</Text>
            <Text style={{ color: MUTED, fontSize: 12 }}>{user?.email || ''}</Text>
          </View>
          <Pressable
            onPress={() => Alert.alert('Sign Out', 'Are you sure?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign Out', style: 'destructive', onPress: logout },
            ])}
            style={{ backgroundColor: RED + '22', borderWidth: 1, borderColor: RED, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 }}
          >
            <Text style={{ color: RED, fontWeight: '800', fontSize: 13 }}>Sign Out</Text>
          </Pressable>
        </View>

        {/* Profit Goals */}
        <Text style={{ color: ACCENT, fontSize: 13, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 }}>
          🏆 Profit Goals
        </Text>
        {goalRows.map((row, i) => {
          const goal = goalQueries[i].data;
          const target = Number(goal?.target_profit ?? 0) || 0;
          return (
            <View key={row.tf} style={{
              backgroundColor: CARD, borderRadius: 14, borderWidth: 1, borderColor: BORDER, padding: 14, marginBottom: 10,
            }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontSize: 18 }}>{row.emoji}</Text>
                  <Text style={{ color: TEXT, fontSize: 15, fontWeight: '700' }}>{row.label}</Text>
                </View>
                <Text style={{ color: ACCENT, fontSize: 20, fontWeight: '900' }}>
                  {target > 0 ? `$${target.toFixed(0)}` : 'Not set'}
                </Text>
              </View>
              {editingGoal === row.tf ? (
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                  <TextInput
                    value={goalInput}
                    onChangeText={setGoalInput}
                    placeholder="Enter amount..."
                    placeholderTextColor={DIM}
                    keyboardType="decimal-pad"
                    autoFocus
                    style={{
                      flex: 1, backgroundColor: SURFACE, borderWidth: 1.5, borderColor: ACCENT,
                      borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: TEXT, fontSize: 16, fontWeight: '700',
                    }}
                  />
                  <Pressable
                    onPress={() => {
                      const val = parseFloat(goalInput);
                      if (!val || val <= 0) { Alert.alert('Invalid', 'Enter a valid amount.'); return; }
                      upsertGoal.mutate({ tf: row.tf, target: val });
                    }}
                    style={{ backgroundColor: ACCENT, borderRadius: 10, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Text style={{ color: '#000', fontWeight: '900' }}>Save</Text>
                  </Pressable>
                  <Pressable onPress={() => setEditingGoal(null)} style={{ backgroundColor: CARD, borderRadius: 10, borderWidth: 1, borderColor: BORDER, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: MUTED }}>✕</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  onPress={() => { setGoalInput(target > 0 ? target.toString() : ''); setEditingGoal(row.tf); }}
                  style={{ marginTop: 10, backgroundColor: SURFACE, borderRadius: 8, borderWidth: 1, borderColor: BORDER, paddingVertical: 8, alignItems: 'center' }}
                >
                  <Text style={{ color: MUTED, fontSize: 13, fontWeight: '700' }}>
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

// ─── Main Dashboard ────────────────────────────────────────────────────────────
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
  const profit = n(rollup?.profit);
  const revenue = n(rollup?.revenue);
  const expenses = n(rollup?.expenses);
  const miles = n(rollup?.miles);
  const perHour = n(rollup?.dollars_per_hour);
  const perMile = n(rollup?.dollars_per_mile);
  const avgOrder = n(rollup?.average_order_value);
  const rawGoal = goal?.target_profit;
  const goalTarget = (rawGoal !== undefined && rawGoal !== null) ? Number(rawGoal) || null : null;
  const displayedEntries = showAllEntries ? entries : entries.slice(0, 8);

  const isProfit = profit >= 0;
  const profitColor = isProfit ? GREEN : RED;

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      {/* Goal Bar (sticky top) */}
      <View style={{ paddingTop: insets.top }}>
        {editingGoal ? (
          <View style={{
            backgroundColor: SURFACE,
            borderBottomWidth: 1,
            borderBottomColor: BORDER,
            paddingHorizontal: 14,
            paddingVertical: 10,
            flexDirection: 'row',
            gap: 8,
          }}>
            <TextInput
              value={goalInput}
              onChangeText={setGoalInput}
              placeholder={`${PERIOD_LABELS[period]} Goal ($)`}
              placeholderTextColor={DIM}
              keyboardType="decimal-pad"
              autoFocus
              style={{
                flex: 1, backgroundColor: CARD, borderWidth: 1.5, borderColor: ACCENT,
                borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, color: TEXT, fontSize: 16, fontWeight: '700',
              }}
            />
            <Pressable
              onPress={() => {
                const val = parseFloat(goalInput);
                if (!val || val <= 0) return;
                upsertGoalMutation.mutate({ target: val });
              }}
              style={{ backgroundColor: ACCENT, borderRadius: 10, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ color: '#000', fontWeight: '900' }}>Save</Text>
            </Pressable>
            <Pressable onPress={() => setEditingGoal(false)} style={{ backgroundColor: CARD, borderRadius: 10, borderWidth: 1, borderColor: BORDER, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: MUTED }}>✕</Text>
            </Pressable>
          </View>
        ) : (
          <GoalBar
            period={period}
            profit={profit}
            goalAmount={goalTarget}
            onEditGoal={() => {
              setGoalInput(goalTarget ? goalTarget.toString() : '');
              setEditingGoal(true);
            }}
          />
        )}
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} />}
        contentContainerStyle={{ paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header row: Logo + Buttons ─────────────────────────────────── */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 14,
          paddingVertical: 12,
          backgroundColor: SURFACE,
          borderBottomWidth: 1,
          borderBottomColor: BORDER,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Image
              source={require('../../assets/ninja-logo.png')}
              style={{ width: 44, height: 44, resizeMode: 'contain' }}
            />
            <View>
              <Text style={{
                color: ACCENT, fontSize: 18, fontWeight: '900', letterSpacing: 0.5,
                textShadowColor: ACCENT, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8,
              }}>
                EARNINGS NINJA
              </Text>
              <Text style={{ color: MUTED, fontSize: 11 }}>Delivery Driver Tracker</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Pressable
              onPress={onRefresh}
              style={{ backgroundColor: CARD, borderRadius: 10, borderWidth: 1, borderColor: BORDER, padding: 9 }}
            >
              <Ionicons name="refresh" size={18} color={MUTED} />
            </Pressable>
            <Pressable
              onPress={() => setShowSettings(true)}
              style={{ backgroundColor: CARD, borderRadius: 10, borderWidth: 1, borderColor: BORDER, padding: 9 }}
            >
              <Ionicons name="settings-outline" size={18} color={MUTED} />
            </Pressable>
          </View>
        </View>

        {/* ── Period Chips ────────────────────────────────────────────────── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingVertical: 10 }}>
          <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 14 }}>
            {PERIODS.map(p => (
              <Pressable
                key={p.key}
                onPress={() => { hTap(); setPeriod(p.key); }}
                style={{
                  paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20,
                  backgroundColor: period === p.key ? ACCENT : CARD,
                  borderWidth: 1.5, borderColor: period === p.key ? ACCENT : BORDER,
                  shadowColor: period === p.key ? ACCENT : 'transparent',
                  shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 8,
                }}
              >
                <Text style={{ color: period === p.key ? '#000' : MUTED, fontSize: 13, fontWeight: '800' }}>
                  {p.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        {rollupLoading ? (
          <View style={{ alignItems: 'center', paddingVertical: 60 }}>
            <ActivityIndicator color={ACCENT} size="large" />
          </View>
        ) : (
          <View style={{ paddingHorizontal: 14, gap: 10 }}>
            {/* ── Main KPIs: Revenue + Expenses ─────────────────────────── */}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <KpiCard
                label="Revenue"
                value={`$${revenue.toFixed(2)}`}
                color={GREEN}
                sub={`${entries.filter(e => e.amount > 0).length} orders`}
              />
              <KpiCard
                label="Expenses"
                value={`$${Math.abs(expenses).toFixed(2)}`}
                color={RED}
                sub={`${entries.filter(e => e.amount < 0).length} items`}
              />
            </View>

            {/* ── Net Profit hero ───────────────────────────────────────── */}
            <View style={{
              backgroundColor: CARD,
              borderRadius: 20,
              borderWidth: 2,
              borderColor: profitColor + '55',
              padding: 22,
              alignItems: 'center',
              shadowColor: profitColor,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.3,
              shadowRadius: 18,
            }}>
              <View style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                backgroundColor: profitColor, borderTopLeftRadius: 20, borderTopRightRadius: 20, opacity: 0.8,
              }} />
              <Text style={{ color: MUTED, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 4 }}>
                NET PROFIT
              </Text>
              <Text style={{
                color: profitColor, fontSize: 52, fontWeight: '900', lineHeight: 60,
                textShadowColor: profitColor, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 16,
              }}>
                {isProfit ? '' : '-'}${Math.abs(profit).toFixed(2)}
              </Text>
              <View style={{ height: 2, backgroundColor: profitColor + '44', borderRadius: 2, width: '80%', marginTop: 14 }} />
            </View>

            {/* ── Performance KPIs ──────────────────────────────────────── */}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <KpiCard label="$/Hour" value={`$${perHour.toFixed(2)}`} color={BLUE} />
              <KpiCard label="$/Mile" value={`$${perMile.toFixed(2)}`} color={PURPLE} />
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <KpiCard label="Miles" value={miles.toFixed(1)} color={ORANGE} />
              <KpiCard label="Avg Order" value={`$${avgOrder.toFixed(2)}`} color={ACCENT} />
            </View>

            {/* ── AI Suggestion ─────────────────────────────────────────── */}
            {aiSuggestion && (
              <View style={{
                backgroundColor: CARD, borderRadius: 16,
                borderWidth: 1, borderColor: PURPLE + '44',
                padding: 16,
                shadowColor: PURPLE, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.15, shadowRadius: 10,
              }}>
                <View style={{
                  position: 'absolute', top: 0, left: 0, right: 0, height: 2,
                  backgroundColor: PURPLE, borderTopLeftRadius: 16, borderTopRightRadius: 16, opacity: 0.7,
                }} />
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <Text style={{ fontSize: 18 }}>🤖</Text>
                  <Text style={{ color: PURPLE, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 }}>
                    AI Earning Suggestion
                  </Text>
                </View>
                <Text style={{ color: TEXT, fontSize: 14, lineHeight: 20 }}>{aiSuggestion.suggestion}</Text>
                {(aiSuggestion.minimum_order || aiSuggestion.peak_time) && (
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                    {aiSuggestion.minimum_order && (
                      <View style={{ backgroundColor: GREEN + '22', borderRadius: 8, borderWidth: 1, borderColor: GREEN + '55', paddingHorizontal: 10, paddingVertical: 5 }}>
                        <Text style={{ color: GREEN, fontSize: 12, fontWeight: '700' }}>Min: ${aiSuggestion.minimum_order}</Text>
                      </View>
                    )}
                    {aiSuggestion.peak_time && (
                      <View style={{ backgroundColor: ACCENT + '22', borderRadius: 8, borderWidth: 1, borderColor: ACCENT + '55', paddingHorizontal: 10, paddingVertical: 5 }}>
                        <Text style={{ color: ACCENT, fontSize: 12, fontWeight: '700' }}>⏰ {aiSuggestion.peak_time}</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            )}

            {/* ── Recent Entries ────────────────────────────────────────── */}
            {entries.length > 0 ? (
              <View style={{ backgroundColor: CARD, borderRadius: 16, borderWidth: 1, borderColor: BORDER, overflow: 'hidden' }}>
                <View style={{
                  flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                  paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: BORDER,
                }}>
                  <Text style={{ color: MUTED, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 }}>
                    Entries ({entries.length})
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <View style={{ backgroundColor: GREEN + '22', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: GREEN + '44' }}>
                      <Text style={{ color: GREEN, fontSize: 11, fontWeight: '800' }}>+${revenue.toFixed(2)}</Text>
                    </View>
                    <View style={{ backgroundColor: RED + '22', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: RED + '44' }}>
                      <Text style={{ color: RED, fontSize: 11, fontWeight: '800' }}>-${Math.abs(expenses).toFixed(2)}</Text>
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
                    style={{ padding: 14, alignItems: 'center', borderTopWidth: 1, borderTopColor: BORDER }}
                  >
                    <Text style={{ color: ACCENT, fontSize: 13, fontWeight: '700' }}>
                      {showAllEntries ? '▲ Show less' : `▼ Show all ${entries.length} entries`}
                    </Text>
                  </Pressable>
                )}
              </View>
            ) : (
              <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                <Text style={{ fontSize: 40 }}>🚗</Text>
                <Text style={{ color: MUTED, fontSize: 15, marginTop: 12, textAlign: 'center' }}>
                  No entries yet for this period.{'\n'}Tap + Add Entry to get started!
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* ── Floating + Add Entry Button ──────────────────────────────────── */}
      <Pressable
        onPress={() => { hTapMed(); setShowAdd(true); }}
        style={({ pressed }) => ({
          position: 'absolute',
          bottom: insets.bottom + 16,
          left: 24,
          right: 24,
          backgroundColor: ACCENT,
          borderRadius: 30,
          paddingVertical: 18,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          opacity: pressed ? 0.88 : 1,
          shadowColor: ACCENT,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.7,
          shadowRadius: 20,
          elevation: 12,
        })}
      >
        <Ionicons name="add" size={24} color="#000" />
        <Text style={{ color: '#000', fontWeight: '900', fontSize: 18, letterSpacing: 0.5 }}>
          Add Entry
        </Text>
      </Pressable>

      {/* ── Modals ───────────────────────────────────────────────────────── */}
      <AddEntryModal visible={showAdd} onClose={() => setShowAdd(false)} />
      <SettingsModal visible={showSettings} onClose={() => setShowSettings(false)} />
    </View>
  );
}
