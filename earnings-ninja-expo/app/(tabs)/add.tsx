import { useState } from 'react';
import {
  View, Text, Pressable, ScrollView,
  TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { api, EntryType, AppType, ExpenseCategory, EXPENSE_EMOJIS, APP_LABELS } from '@/lib/api';

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

type Step = 'calculator' | 'details';

export default function AddScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>('calculator');
  const [amount, setAmount] = useState('0');
  const [mode, setMode] = useState<'add' | 'subtract'>('add');
  const [isCHeld, setIsCHeld] = useState(false);
  const [entryType, setEntryType] = useState<EntryType>('ORDER');
  const [app, setApp] = useState<AppType>('UBEREATS');
  const [category, setCategory] = useState<ExpenseCategory>('GAS');
  const [miles, setMiles] = useState('');
  const [minutes, setMinutes] = useState('');
  const [note, setNote] = useState('');

  const mutation = useMutation({
    mutationFn: api.createEntry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries'] });
      queryClient.invalidateQueries({ queryKey: ['rollup'] });
      queryClient.invalidateQueries({ queryKey: ['goal'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('✅ Added!', 'Entry saved successfully.', [{ text: 'OK' }]);
      setAmount('0');
      setMiles('');
      setMinutes('');
      setNote('');
      setStep('calculator');
    },
    onError: () => {
      Alert.alert('Error', 'Failed to save entry. Please try again.');
    },
  });

  const tap = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

  const handleNumber = (n: string) => {
    tap();
    setAmount(prev => prev === '0' ? n : prev + n);
  };

  const handleDecimal = () => {
    tap();
    if (!amount.includes('.')) setAmount(amount + '.');
  };

  const handleBackspace = () => {
    tap();
    setAmount(prev => prev.length > 1 ? prev.slice(0, -1) : '0');
  };

  const handleClear = () => {
    tap();
    setAmount('0');
  };

  let cHoldTimer: ReturnType<typeof setTimeout>;

  const handleCDown = () => {
    setIsCHeld(false);
    cHoldTimer = setTimeout(() => {
      setIsCHeld(true);
      handleClear();
    }, 500);
  };

  const handleCUp = () => {
    clearTimeout(cHoldTimer);
    if (!isCHeld) handleBackspace();
    setIsCHeld(false);
  };

  const handleSubmit = () => {
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      Alert.alert('Invalid amount', 'Please enter an amount greater than 0.');
      return;
    }
    const finalAmount = mode === 'subtract' ? -numAmount : numAmount;
    mutation.mutate({
      type: entryType,
      app,
      amount: finalAmount,
      distance_miles: miles ? parseFloat(miles) : undefined,
      duration_minutes: minutes ? parseInt(minutes) : undefined,
      category: entryType === 'EXPENSE' ? category : undefined,
      note: note || undefined,
    });
  };

  const numBtnStyle = (active = false, color = '') => ({
    flex: 1,
    backgroundColor: active ? color + '22' : CARD,
    borderWidth: 1.5,
    borderColor: active ? color : BORDER,
    borderRadius: 14,
    paddingVertical: 20,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    shadowColor: active ? color : '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: active ? 0.4 : 0.1,
    shadowRadius: active ? 10 : 4,
  });

  const isExpense = mode === 'subtract';

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: BG }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingHorizontal: 14,
          paddingBottom: insets.bottom + 20,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={{ marginBottom: 16 }}>
          <Text style={{
            color: ACCENT,
            fontSize: 22,
            fontWeight: '900',
            textShadowColor: ACCENT,
            textShadowOffset: { width: 0, height: 0 },
            textShadowRadius: 8,
          }}>
            Log Entry
          </Text>
          <Text style={{ color: MUTED, fontSize: 13 }}>
            {step === 'calculator' ? 'Enter your amount' : 'Fill in details'}
          </Text>
        </View>

        {step === 'calculator' ? (
          <View style={{ gap: 12 }}>
            {/* Amount Display */}
            <View style={{
              backgroundColor: CARD,
              borderRadius: 20,
              borderWidth: 2,
              borderColor: isExpense ? RED + '66' : GREEN + '66',
              padding: 20,
              alignItems: 'flex-end',
              shadowColor: isExpense ? RED : GREEN,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.3,
              shadowRadius: 14,
            }}>
              <Text style={{ color: MUTED, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
                {isExpense ? 'Expense Amount' : 'Revenue Amount'}
              </Text>
              <Text style={{
                color: isExpense ? RED : GREEN,
                fontSize: 52,
                fontWeight: '900',
                fontVariant: ['tabular-nums'],
                textShadowColor: isExpense ? RED : GREEN,
                textShadowOffset: { width: 0, height: 0 },
                textShadowRadius: 10,
              }}>
                ${amount}
              </Text>
            </View>

            {/* Revenue / Expense Toggle */}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable
                onPress={() => { tap(); setMode('add'); }}
                style={{
                  flex: 1,
                  paddingVertical: 14,
                  borderRadius: 14,
                  backgroundColor: mode === 'add' ? GREEN + '22' : CARD,
                  borderWidth: 2,
                  borderColor: mode === 'add' ? GREEN : BORDER,
                  alignItems: 'center',
                  shadowColor: mode === 'add' ? GREEN : 'transparent',
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.5,
                  shadowRadius: 10,
                }}
              >
                <Text style={{ color: mode === 'add' ? GREEN : MUTED, fontWeight: '800', fontSize: 16 }}>
                  ➕ Revenue
                </Text>
              </Pressable>
              <Pressable
                onPress={() => { tap(); setMode('subtract'); }}
                style={{
                  flex: 1,
                  paddingVertical: 14,
                  borderRadius: 14,
                  backgroundColor: mode === 'subtract' ? RED + '22' : CARD,
                  borderWidth: 2,
                  borderColor: mode === 'subtract' ? RED : BORDER,
                  alignItems: 'center',
                  shadowColor: mode === 'subtract' ? RED : 'transparent',
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.5,
                  shadowRadius: 10,
                }}
              >
                <Text style={{ color: mode === 'subtract' ? RED : MUTED, fontWeight: '800', fontSize: 16 }}>
                  ➖ Expense
                </Text>
              </Pressable>
            </View>

            {/* Calculator Grid */}
            {[['7', '8', '9'], ['4', '5', '6'], ['1', '2', '3']].map((row) => (
              <View key={row[0]} style={{ flexDirection: 'row', gap: 10 }}>
                {row.map((n) => (
                  <Pressable key={n} onPress={() => handleNumber(n)} style={numBtnStyle()}>
                    <Text style={{ color: TEXT, fontSize: 26, fontWeight: '800' }}>{n}</Text>
                  </Pressable>
                ))}
              </View>
            ))}

            {/* Bottom Row: C, 0, . */}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable
                onPressIn={handleCDown}
                onPressOut={handleCUp}
                style={numBtnStyle(isCHeld, RED)}
              >
                <Text style={{ color: isCHeld ? RED : ACCENT, fontSize: 26, fontWeight: '900' }}>
                  {isCHeld ? '✓' : '⌫'}
                </Text>
              </Pressable>
              <Pressable onPress={() => handleNumber('0')} style={numBtnStyle()}>
                <Text style={{ color: TEXT, fontSize: 26, fontWeight: '800' }}>0</Text>
              </Pressable>
              <Pressable onPress={handleDecimal} style={numBtnStyle()}>
                <Text style={{ color: TEXT, fontSize: 26, fontWeight: '800' }}>.</Text>
              </Pressable>
            </View>

            {/* Next Step */}
            <Pressable
              onPress={() => { tap(); setStep('details'); }}
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
                elevation: 8,
              })}
            >
              <Text style={{ color: '#000', fontWeight: '900', fontSize: 18 }}>
                Next Step →
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ gap: 14 }}>
            {/* Amount Summary */}
            <Pressable
              onPress={() => setStep('calculator')}
              style={{
                backgroundColor: CARD,
                borderRadius: 14,
                borderWidth: 1.5,
                borderColor: isExpense ? RED + '55' : GREEN + '55',
                padding: 14,
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Text style={{ color: MUTED, fontSize: 13 }}>← Edit Amount</Text>
              <Text style={{
                color: isExpense ? RED : GREEN,
                fontSize: 28,
                fontWeight: '900',
                fontVariant: ['tabular-nums'],
              }}>
                {isExpense ? '-' : '+'}${amount}
              </Text>
            </Pressable>

            {/* Entry Type */}
            <View>
              <Text style={{ color: MUTED, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Entry Type</Text>
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                {(['ORDER', 'BONUS', 'EXPENSE', 'CANCELLATION'] as EntryType[]).map((t) => (
                  <Pressable
                    key={t}
                    onPress={() => { tap(); setEntryType(t); }}
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 10,
                      borderRadius: 12,
                      backgroundColor: entryType === t ? ACCENT + '22' : CARD,
                      borderWidth: 1.5,
                      borderColor: entryType === t ? ACCENT : BORDER,
                    }}
                  >
                    <Text style={{ color: entryType === t ? ACCENT : MUTED, fontWeight: '700', fontSize: 13 }}>{t}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Platform */}
            <View>
              <Text style={{ color: MUTED, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Platform</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {APPS.map((a) => (
                    <Pressable
                      key={a.key}
                      onPress={() => { tap(); setApp(a.key); }}
                      style={{
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        borderRadius: 12,
                        backgroundColor: app === a.key ? a.color + '22' : CARD,
                        borderWidth: 1.5,
                        borderColor: app === a.key ? a.color : BORDER,
                        shadowColor: app === a.key ? a.color : 'transparent',
                        shadowOffset: { width: 0, height: 0 },
                        shadowOpacity: 0.4,
                        shadowRadius: 8,
                      }}
                    >
                      <Text style={{ color: app === a.key ? a.color : MUTED, fontWeight: '700', fontSize: 13 }}>{a.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            </View>

            {/* Expense Category (if expense) */}
            {entryType === 'EXPENSE' && (
              <View>
                <Text style={{ color: MUTED, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Category</Text>
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                  {EXPENSE_CATS.map((c) => (
                    <Pressable
                      key={c}
                      onPress={() => { tap(); setCategory(c); }}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 10,
                        backgroundColor: category === c ? ACCENT + '22' : CARD,
                        borderWidth: 1,
                        borderColor: category === c ? ACCENT : BORDER,
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
              <View style={{ flex: 1 }}>
                <Text style={{ color: MUTED, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Miles</Text>
                <TextInput
                  value={miles}
                  onChangeText={setMiles}
                  placeholder="0.0"
                  placeholderTextColor={DIM}
                  keyboardType="decimal-pad"
                  style={{
                    backgroundColor: CARD,
                    borderWidth: 1.5,
                    borderColor: BORDER,
                    borderRadius: 12,
                    paddingHorizontal: 14,
                    paddingVertical: 13,
                    color: TEXT,
                    fontSize: 16,
                    fontWeight: '600',
                  }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: MUTED, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Minutes</Text>
                <TextInput
                  value={minutes}
                  onChangeText={setMinutes}
                  placeholder="0"
                  placeholderTextColor={DIM}
                  keyboardType="number-pad"
                  style={{
                    backgroundColor: CARD,
                    borderWidth: 1.5,
                    borderColor: BORDER,
                    borderRadius: 12,
                    paddingHorizontal: 14,
                    paddingVertical: 13,
                    color: TEXT,
                    fontSize: 16,
                    fontWeight: '600',
                  }}
                />
              </View>
            </View>

            {/* Note */}
            <View>
              <Text style={{ color: MUTED, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Note (optional)</Text>
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="Add a note..."
                placeholderTextColor={DIM}
                multiline
                numberOfLines={2}
                style={{
                  backgroundColor: CARD,
                  borderWidth: 1.5,
                  borderColor: BORDER,
                  borderRadius: 12,
                  paddingHorizontal: 14,
                  paddingVertical: 13,
                  color: TEXT,
                  fontSize: 15,
                  minHeight: 60,
                  textAlignVertical: 'top',
                }}
              />
            </View>

            {/* Save Button */}
            <Pressable
              onPress={handleSubmit}
              disabled={mutation.isPending}
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
                elevation: 8,
                marginTop: 4,
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
  );
}
