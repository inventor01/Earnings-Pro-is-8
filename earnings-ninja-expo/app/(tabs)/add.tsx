import { useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView,
  TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { api, EntryType, AppType, ExpenseCategory, EXPENSE_EMOJIS, APP_LABELS } from '@/lib/api';
import { colors } from '@/constants/colors';

const APPS: AppType[] = ['DOORDASH', 'UBEREATS', 'INSTACART', 'GRUBHUB', 'SHIPT', 'OTHER'];
const APP_COLORS: Record<AppType, string> = {
  DOORDASH: '#FF3008', UBEREATS: '#06C167', INSTACART: '#43B02A',
  GRUBHUB: '#F63440', SHIPT: '#00A6CE', OTHER: '#94a3b8',
};
const EXPENSE_CATS: ExpenseCategory[] = ['GAS', 'PARKING', 'TOLLS', 'MAINTENANCE', 'PHONE', 'SUBSCRIPTION', 'FOOD', 'OTHER'];

const CALC_BTNS = [
  '7', '8', '9',
  '4', '5', '6',
  '1', '2', '3',
  '.', '0', '⌫',
];

type Step = 'calc' | 'details';

export default function AddScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const [step, setStep] = useState<Step>('calc');
  const [amount, setAmount] = useState('0');
  const [entryType, setEntryType] = useState<EntryType>('ORDER');
  const [app, setApp] = useState<AppType>('UBEREATS');
  const [miles, setMiles] = useState('');
  const [minutes, setMinutes] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('GAS');
  const [note, setNote] = useState('');

  const mutation = useMutation({
    mutationFn: api.createEntry,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rollup'] });
      qc.invalidateQueries({ queryKey: ['entries'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('✅ Logged!', `${entryType === 'EXPENSE' ? 'Expense' : 'Entry'} of $${parseFloat(amount).toFixed(2)} saved.`);
      reset();
    },
    onError: () => {
      Alert.alert('Error', 'Failed to save entry. Please try again.');
    },
  });

  const reset = () => {
    setStep('calc');
    setAmount('0');
    setEntryType('ORDER');
    setApp('UBEREATS');
    setMiles('');
    setMinutes('');
    setNote('');
    setCategory('GAS');
  };

  const handleCalc = (btn: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (btn === '⌫') {
      setAmount(prev => prev.length <= 1 ? '0' : prev.slice(0, -1));
      return;
    }
    if (btn === '.' && amount.includes('.')) return;
    if (amount === '0' && btn !== '.') {
      setAmount(btn);
    } else {
      const parts = amount.split('.');
      if (parts[1]?.length >= 2) return;
      setAmount(prev => prev + btn);
    }
  };

  const handleNext = () => {
    const val = parseFloat(amount);
    if (!val || val <= 0) {
      Alert.alert('Invalid amount', 'Please enter an amount greater than $0.00');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setStep('details');
  };

  const handleSubmit = () => {
    const val = parseFloat(amount);
    const isNeg = entryType === 'EXPENSE' || entryType === 'CANCELLATION';
    mutation.mutate({
      type: entryType,
      app,
      amount: isNeg ? -Math.abs(val) : Math.abs(val),
      distance_miles: miles ? parseFloat(miles) : undefined,
      duration_minutes: minutes ? parseFloat(minutes) : undefined,
      category: entryType === 'EXPENSE' ? category : undefined,
      note: note.trim() || undefined,
    });
  };

  const isExpense = entryType === 'EXPENSE' || entryType === 'CANCELLATION';
  const displayAmt = parseFloat(amount) || 0;

  if (step === 'calc') {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8 }]}>
        {/* Type selector */}
        <View style={styles.typeRow}>
          {(['ORDER', 'BONUS', 'EXPENSE', 'CANCELLATION'] as EntryType[]).map(t => (
            <Pressable
              key={t}
              style={[styles.typeBtn, entryType === t && styles.typeBtnActive]}
              onPress={() => { setEntryType(t); Haptics.selectionAsync(); }}
            >
              <Text style={[styles.typeBtnText, entryType === t && styles.typeBtnTextActive]}>
                {t === 'CANCELLATION' ? 'CANCEL' : t}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Display */}
        <View style={styles.display}>
          <Text style={styles.displayPrefix}>{isExpense ? '-' : '+'}</Text>
          <Text style={[styles.displayAmount, { color: isExpense ? colors.red : colors.green }]}>
            ${displayAmt.toFixed(2)}
          </Text>
        </View>

        {/* Calc pad */}
        <View style={styles.calcGrid}>
          {CALC_BTNS.map(btn => (
            <Pressable
              key={btn}
              style={styles.calcBtn}
              onPress={() => handleCalc(btn)}
            >
              <Text style={styles.calcBtnText}>{btn}</Text>
            </Pressable>
          ))}
        </View>

        <Pressable style={styles.nextBtn} onPress={handleNext}>
          <Text style={styles.nextBtnText}>Next — Add Details</Text>
          <Ionicons name="arrow-forward" size={18} color={colors.black} />
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.detailContainer, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 }]}
      keyboardShouldPersistTaps="handled"
    >
      {/* Back + amount summary */}
      <View style={styles.detailHeader}>
        <Pressable onPress={() => setStep('calc')} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </Pressable>
        <View style={styles.amtSummary}>
          <Text style={[styles.amtSummaryText, { color: isExpense ? colors.red : colors.green }]}>
            {isExpense ? '-' : '+'}${displayAmt.toFixed(2)}
          </Text>
          <Text style={styles.amtSummaryType}>{entryType}</Text>
        </View>
      </View>

      {/* App selector */}
      <Text style={styles.fieldLabel}>Platform</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.appScroll}>
        {APPS.map(a => (
          <Pressable
            key={a}
            style={[styles.appChip, app === a && { backgroundColor: APP_COLORS[a] + '30', borderColor: APP_COLORS[a] }]}
            onPress={() => { setApp(a); Haptics.selectionAsync(); }}
          >
            <View style={[styles.appDot, { backgroundColor: APP_COLORS[a] }]} />
            <Text style={[styles.appChipText, app === a && { color: APP_COLORS[a] }]}>{APP_LABELS[a]}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Expense category */}
      {entryType === 'EXPENSE' && (
        <>
          <Text style={styles.fieldLabel}>Category</Text>
          <View style={styles.catGrid}>
            {EXPENSE_CATS.map(c => (
              <Pressable
                key={c}
                style={[styles.catBtn, category === c && styles.catBtnActive]}
                onPress={() => { setCategory(c); Haptics.selectionAsync(); }}
              >
                <Text style={styles.catEmoji}>{EXPENSE_EMOJIS[c]}</Text>
                <Text style={[styles.catText, category === c && styles.catTextActive]}>{c}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

      {/* Miles & minutes */}
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.fieldLabel}>Miles</Text>
          <TextInput
            style={styles.input}
            placeholder="0.0"
            placeholderTextColor={colors.textMuted}
            value={miles}
            onChangeText={setMiles}
            keyboardType="decimal-pad"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.fieldLabel}>Minutes</Text>
          <TextInput
            style={styles.input}
            placeholder="0"
            placeholderTextColor={colors.textMuted}
            value={minutes}
            onChangeText={setMinutes}
            keyboardType="number-pad"
          />
        </View>
      </View>

      {/* Note */}
      <Text style={styles.fieldLabel}>Note (optional)</Text>
      <TextInput
        style={[styles.input, styles.noteInput]}
        placeholder="Add a note..."
        placeholderTextColor={colors.textMuted}
        value={note}
        onChangeText={setNote}
        multiline
        numberOfLines={2}
      />

      <Pressable
        style={[styles.submitBtn, mutation.isPending && { opacity: 0.7 }]}
        onPress={handleSubmit}
        disabled={mutation.isPending}
      >
        {mutation.isPending
          ? <ActivityIndicator color={colors.black} />
          : <Text style={styles.submitBtnText}>Save Entry</Text>
        }
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 16, gap: 16 },
  scroll: { flex: 1, backgroundColor: colors.background },
  detailContainer: { paddingHorizontal: 16, gap: 14 },

  typeRow: { flexDirection: 'row', gap: 6 },
  typeBtn: {
    flex: 1, paddingVertical: 8, alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: 10,
    borderWidth: 1, borderColor: colors.border,
  },
  typeBtnActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  typeBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 10, color: colors.textSecondary },
  typeBtnTextActive: { color: colors.black },

  display: { alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 4 },
  displayPrefix: { fontSize: 32, fontFamily: 'Inter_700Bold', color: colors.textSecondary, alignSelf: 'flex-end', marginBottom: 8 },
  displayAmount: { fontSize: 64, fontFamily: 'Inter_700Bold', letterSpacing: -2 },

  calcGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  calcBtn: {
    width: '30%', aspectRatio: 1.4,
    backgroundColor: colors.surface, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  calcBtnText: { fontSize: 24, fontFamily: 'Inter_500Medium', color: colors.textPrimary },

  nextBtn: {
    backgroundColor: colors.accent, borderRadius: 16,
    paddingVertical: 18, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  nextBtnText: { fontFamily: 'Inter_700Bold', fontSize: 17, color: colors.black },

  detailHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center',
  },
  amtSummary: { flex: 1 },
  amtSummaryText: { fontFamily: 'Inter_700Bold', fontSize: 28 },
  amtSummaryType: { fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.textSecondary },

  fieldLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: colors.textSecondary },

  appScroll: { marginHorizontal: -16, paddingHorizontal: 16 },
  appChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border,
    marginRight: 8,
  },
  appDot: { width: 8, height: 8, borderRadius: 4 },
  appChipText: { fontFamily: 'Inter_500Medium', fontSize: 13, color: colors.textSecondary },

  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  catBtnActive: { borderColor: colors.accent, backgroundColor: colors.accent + '20' },
  catEmoji: { fontSize: 14 },
  catText: { fontFamily: 'Inter_500Medium', fontSize: 12, color: colors.textSecondary },
  catTextActive: { color: colors.accent },

  row: { flexDirection: 'row', gap: 12 },
  input: {
    backgroundColor: colors.surface, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 15, fontFamily: 'Inter_400Regular',
    color: colors.textPrimary, borderWidth: 1, borderColor: colors.border,
  },
  noteInput: { minHeight: 70, textAlignVertical: 'top' },

  submitBtn: {
    backgroundColor: colors.accent, borderRadius: 16,
    paddingVertical: 18, alignItems: 'center', justifyContent: 'center',
    marginTop: 8,
  },
  submitBtnText: { fontFamily: 'Inter_700Bold', fontSize: 17, color: colors.black },
});
