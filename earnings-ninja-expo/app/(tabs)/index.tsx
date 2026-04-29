import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, Pressable, Modal,
  RefreshControl, ActivityIndicator, Image, Alert,
  TextInput, KeyboardAvoidingView, Platform,
  ViewStyle, TextStyle,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withSequence, withRepeat, withDelay,
  Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
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
const BG       = '#0a0a0a';   // page background (true black)
const SURFACE  = '#111111';   // raised surface (cards, header)
const CARD_BG  = '#1a1a1a';   // inset surface (input fields, etc.)
const BORDER   = '#262626';
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
const DIVIDER  = '#1f1f1f';

// Keep legacy names used inside modals / CalcPad
const ACCENT   = PRIMARY;
const DIM      = LABEL;
const CARD     = CARD_BG;

// ─── Neon glow helper (mirrors Tailwind shadow-[0_0_Npx_color]) ──────────────
const neonGlow = (color: string, radius: number = 16, opacity: number = 0.45): ViewStyle => ({
  shadowColor: color,
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: opacity,
  shadowRadius: radius,
  elevation: Math.round(radius / 2),
});

// ─── Press-scale Pressable (mirrors web active:scale-95) ─────────────────────
function PressScale({
  children, onPress, onLongPress, scale = 0.96, style, hitSlop, disabled,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  scale?: number;
  style?: ViewStyle | ViewStyle[];
  hitSlop?: number;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      hitSlop={hitSlop}
      android_ripple={{ color: 'rgba(255,255,255,0.06)' }}
      style={({ pressed }) => [
        Array.isArray(style) ? Object.assign({}, ...style) : style,
        {
          opacity: pressed ? 0.9 : disabled ? 0.5 : 1,
          transform: [{ scale: pressed ? scale : 1 }],
        },
      ]}
    >
      {children}
    </Pressable>
  );
}

// ─── AnimatedNumber: smooth count-up via requestAnimationFrame ───────────────
function AnimatedNumber({
  value, format, style, duration = 700,
}: {
  value: number;
  format: (n: number) => string;
  style?: TextStyle | TextStyle[];
  duration?: number;
}) {
  const [display, setDisplay] = useState(value);
  // Track the latest *rendered* value so that if a new target arrives
  // mid-animation we tween from where we currently are (no snap/jitter).
  const displayRef = useRef(value);

  useEffect(() => {
    const start = displayRef.current;
    const end = value;
    if (start === end) return;
    const t0 = Date.now();
    let raf: number;
    const tick = () => {
      const t = Math.min((Date.now() - t0) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      const current = start + (end - start) * eased;
      displayRef.current = current;
      setDisplay(current);
      if (t < 1) raf = requestAnimationFrame(tick);
      else displayRef.current = end;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return <Text style={style}>{format(display)}</Text>;
}

// ─── Pop animation hook (Hero pulses on value change) ────────────────────────
function usePopOnChange(value: number, intensity: number = 1.08) {
  const scale = useSharedValue(1);
  const initialMount = useRef(true);
  useEffect(() => {
    if (initialMount.current) { initialMount.current = false; return; }
    scale.value = withSequence(
      withTiming(intensity, { duration: 160, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: 220, easing: Easing.inOut(Easing.quad) }),
    );
  }, [value]);
  return useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
}

// ─── Milestone glow on ninja logo ($50/$100/$150...) ─────────────────────────
function useMilestoneGlow(profit: number) {
  const milestone = Math.max(0, Math.floor(profit / 50));
  const glow = useSharedValue(0);
  const lastRef = useRef(0);
  useEffect(() => {
    if (milestone > lastRef.current && milestone > 0) {
      // Big celebratory pulse, then settle to gentle ambient glow
      glow.value = withSequence(
        withTiming(1, { duration: 250 }),
        withRepeat(
          withSequence(
            withTiming(0.4, { duration: 800 }),
            withTiming(0.9, { duration: 800 }),
          ),
          3, false,
        ),
        withTiming(0.35, { duration: 600 }),
      );
    } else if (milestone === 0) {
      glow.value = withTiming(0, { duration: 400 });
    }
    lastRef.current = milestone;
  }, [milestone]);

  const color = milestone >= 2 ? GREEN : PRIMARY; // green at $100+, yellow at $50+
  return useAnimatedStyle(() => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: glow.value * 0.9,
    shadowRadius: 8 + glow.value * 18,
    elevation: glow.value * 8,
  }));
}

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

// ─── Small Stat Card (subtle yellow neon outline + animated value) ──────────
function StatCard({
  label, value, icon, numericValue, format, accent = PRIMARY,
}: {
  label: string;
  value: string;
  icon: string;
  numericValue?: number;
  format?: (n: number) => string;
  accent?: string;
}) {
  return (
    <View style={[
      {
        flex: 1,
        backgroundColor: SURFACE,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: accent + '22',
        padding: 12,
      },
      neonGlow(accent, 6, 0.10),
    ]}>
      <Text style={{ fontSize: 18, marginBottom: 4 }}>{icon}</Text>
      {numericValue !== undefined && format ? (
        <AnimatedNumber
          value={numericValue}
          format={format}
          style={{ color: TEXT, fontSize: 17, fontWeight: '800' }}
        />
      ) : (
        <Text style={{ color: TEXT, fontSize: 17, fontWeight: '800' }}>{value}</Text>
      )}
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

// ─── Calculator pad palette (mirrors web Tailwind tokens) ────────────────────
const CALC = {
  HEADER_BG:      '#facc15',          // yellow-400
  CARD_BG:        '#ffffff',          // modal background
  CARD_FROM:      '#ffffff',          // gradient bg-white
  CARD_TO:        '#f9fafb',          // to-gray-50
  NUM_BG:         '#f3f4f6',          // gray-100 (used by inputs/pills in details step)
  AMOUNT_FROM:    '#dbeafe',          // blue-100
  AMOUNT_TO:      '#f3e8ff',          // purple-100
  AMOUNT_BORDER:  '#93c5fd',          // blue-300 (border-4)
  AMOUNT_TEXT:    '#0f172a',
  NUM_FROM:       '#f3f4f6',          // gray-100
  NUM_TO:         '#e5e7eb',          // gray-200
  NUM_TEXT:       '#111827',          // gray-900
  REV_FROM:       '#4ade80',          // green-400
  REV_TO:         '#22c55e',          // green-500
  EXP_FROM:       '#f87171',          // red-400
  EXP_TO:         '#ef4444',          // red-500
  OFF_BG:         '#e5e7eb',          // gray-200
  OFF_FG:         '#374151',          // gray-700
  BACKSPACE_FROM: '#fb923c',          // orange-400
  BACKSPACE_TO:   '#f97316',          // orange-500
  BACKSPACE_HELD_FROM: '#ef4444',     // red-500
  BACKSPACE_HELD_TO:   '#dc2626',     // red-600
  BACKSPACE_FG:   '#ffffff',
  NEXT_BG:        '#facc15',          // yellow-400
  NEXT_FG:        '#111827',          // gray-900
  LABEL:          '#6b7280',
  BORDER:         '#e5e7eb',
};

// ─── Calculator Pad (mirrors web CalcPad.tsx 1:1) ────────────────────────────
// Reusable gradient button helper: outer View carries shadow + flex, inner
// Pressable handles touch + press feedback, LinearGradient paints the bg.
function GradBtn({
  colors, onPress, onPressIn, onPressOut, children, flex = 1, shadow = true,
  rounded = 14, paddingVertical = 22, pressedScale = 0.95,
}: {
  colors: readonly [string, string];
  onPress?: () => void;
  onPressIn?: () => void;
  onPressOut?: () => void;
  children: React.ReactNode;
  flex?: number;
  shadow?: boolean;
  rounded?: number;
  paddingVertical?: number;
  pressedScale?: number;
}) {
  return (
    <View style={{
      flex,
      borderRadius: rounded,
      backgroundColor: colors[0], // gives iOS a solid layer for the shadow
      ...(shadow ? {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 4,
        elevation: 3,
      } : {}),
    }}>
      <View style={{ borderRadius: rounded, overflow: 'hidden' }}>
        <Pressable
          onPress={onPress}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          android_ripple={{ color: 'rgba(0,0,0,0.08)' }}
          style={({ pressed }) => ({
            opacity: pressed ? 0.92 : 1,
            transform: [{ scale: pressed ? pressedScale : 1 }],
          })}
        >
          <LinearGradient
            colors={colors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ paddingVertical, alignItems: 'center', justifyContent: 'center' }}
          >
            {children}
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

function CalcPad({ amount, mode, onAmount, onMode, onNext }: {
  amount: string;
  mode: 'add' | 'subtract';
  onAmount: (v: string) => void;
  onMode: (m: 'add' | 'subtract') => void;
  onNext: () => void;
}) {
  const holdRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isHeld, setIsHeld] = useState(false);

  const tap = (n: string) => {
    hTap();
    if (n === '.') {
      if (!amount.includes('.')) onAmount(amount + '.');
    } else {
      onAmount(amount === '0' ? n : amount + n);
    }
  };

  const onBackspaceIn = () => {
    setIsHeld(false);
    holdRef.current = setTimeout(() => {
      setIsHeld(true);
      hTapHeavy();
      onAmount('0');
    }, 500);
  };
  const onBackspaceOut = () => {
    if (holdRef.current) {
      clearTimeout(holdRef.current);
      holdRef.current = null;
    }
    if (!isHeld) {
      hTap();
      onAmount(amount.length > 1 ? amount.slice(0, -1) : '0');
    }
    setIsHeld(false);
  };

  // Outer card mirrors `bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-xl p-6`
  return (
    <View style={{
      borderRadius: 16,
      backgroundColor: CALC.CARD_FROM,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 16,
      elevation: 6,
    }}>
      <View style={{ borderRadius: 16, overflow: 'hidden' }}>
        <LinearGradient
          colors={[CALC.CARD_FROM, CALC.CARD_TO]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ padding: 18, gap: 14 }}
        >
          {/* Amount display — blue→purple gradient with thick blue border */}
          <View style={{
            borderRadius: 14,
            borderWidth: 4,
            borderColor: CALC.AMOUNT_BORDER,
            overflow: 'hidden',
          }}>
            <LinearGradient
              colors={[CALC.AMOUNT_FROM, CALC.AMOUNT_TO]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ paddingVertical: 22, paddingHorizontal: 20, alignItems: 'flex-end' }}
            >
              <Text style={{ color: CALC.AMOUNT_TEXT, fontSize: 48, fontWeight: '900' }}>
                {mode === 'subtract' ? '−' : ''}${amount}
              </Text>
            </LinearGradient>
          </View>

          {/* Revenue / Expense toggle */}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <GradBtn
              colors={mode === 'add' ? [CALC.REV_FROM, CALC.REV_TO] : [CALC.OFF_BG, CALC.OFF_BG]}
              onPress={() => { hTap(); onMode('add'); }}
              paddingVertical={16}
              shadow={mode === 'add'}
            >
              <Text style={{
                color: mode === 'add' ? '#ffffff' : CALC.OFF_FG,
                fontWeight: '800',
                fontSize: 17,
              }}>
                ➕ Revenue
              </Text>
            </GradBtn>
            <GradBtn
              colors={mode === 'subtract' ? [CALC.EXP_FROM, CALC.EXP_TO] : [CALC.OFF_BG, CALC.OFF_BG]}
              onPress={() => { hTap(); onMode('subtract'); }}
              paddingVertical={16}
              shadow={mode === 'subtract'}
            >
              <Text style={{
                color: mode === 'subtract' ? '#ffffff' : CALC.OFF_FG,
                fontWeight: '800',
                fontSize: 17,
              }}>
                ➖ Expense
              </Text>
            </GradBtn>
          </View>

          {/* Number grid */}
          {[
            ['7', '8', '9'],
            ['4', '5', '6'],
            ['1', '2', '3'],
            ['⌫', '0', '.'],
          ].map((row, ri) => (
            <View key={ri} style={{ flexDirection: 'row', gap: 10 }}>
              {row.map(k =>
                k === '⌫' ? (
                  <GradBtn
                    key={k}
                    colors={isHeld
                      ? [CALC.BACKSPACE_HELD_FROM, CALC.BACKSPACE_HELD_TO]
                      : [CALC.BACKSPACE_FROM, CALC.BACKSPACE_TO]}
                    onPressIn={onBackspaceIn}
                    onPressOut={onBackspaceOut}
                    paddingVertical={22}
                  >
                    <Text style={{ color: CALC.BACKSPACE_FG, fontSize: 26, fontWeight: '800' }}>
                      {isHeld ? '✓' : '⌫'}
                    </Text>
                  </GradBtn>
                ) : (
                  <GradBtn
                    key={k}
                    colors={[CALC.NUM_FROM, CALC.NUM_TO]}
                    onPress={() => tap(k)}
                    paddingVertical={22}
                  >
                    <Text style={{ color: CALC.NUM_TEXT, fontSize: 26, fontWeight: '800' }}>{k}</Text>
                  </GradBtn>
                )
              )}
            </View>
          ))}

          {/* Next Step — solid yellow, full width */}
          <View style={{
            borderRadius: 12,
            overflow: 'hidden',
            marginTop: 4,
          }}>
            <Pressable
              onPress={() => { hTapMed(); onNext(); }}
              android_ripple={{ color: 'rgba(0,0,0,0.12)' }}
              style={({ pressed }) => ({
                backgroundColor: CALC.NEXT_BG,
                paddingVertical: 16,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.92 : 1,
                transform: [{ scale: pressed ? 0.97 : 1 }],
              })}
            >
              <Text style={{ color: CALC.NEXT_FG, fontWeight: '800', fontSize: 18 }}>
                Next Step →
              </Text>
            </Pressable>
          </View>
        </LinearGradient>
      </View>
    </View>
  );
}

// ─── Details Form (mirrors web EntryForm 1:1) ──────────────────────────────────
function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text style={{ fontSize: 15, fontWeight: '700', color: '#1f2937', marginBottom: 8 }}>
      {children}
    </Text>
  );
}

function PillSelect<T extends string>({
  options,
  value,
  onChange,
  accent = CALC.HEADER_BG,
  scroll = false,
}: {
  options: { key: T; label: string; color?: string }[];
  value: T;
  onChange: (v: T) => void;
  accent?: string;
  scroll?: boolean;
}) {
  const Row = (
    <View style={{ flexDirection: 'row', flexWrap: scroll ? 'nowrap' : 'wrap', gap: 8 }}>
      {options.map(o => {
        const selected = value === o.key;
        const accentColor = o.color || accent;
        return (
          <Pressable
            key={o.key}
            onPress={() => { hTap(); onChange(o.key); }}
            style={({ pressed }) => ({
              paddingHorizontal: 14,
              paddingVertical: 11,
              borderRadius: 12,
              backgroundColor: selected ? accentColor : '#ffffff',
              borderWidth: 2,
              borderColor: selected ? accentColor : '#d1d5db',
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text style={{
              color: selected ? '#0f172a' : '#374151',
              fontWeight: '700',
              fontSize: 14,
            }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
  return scroll
    ? <ScrollView horizontal showsHorizontalScrollIndicator={false}>{Row}</ScrollView>
    : Row;
}

function FormInput({
  value, onChangeText, placeholder, keyboardType, multiline,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'decimal-pad' | 'number-pad' | 'default';
  multiline?: boolean;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor="#9ca3af"
      keyboardType={keyboardType || 'default'}
      multiline={multiline}
      style={{
        backgroundColor: '#ffffff',
        borderWidth: 2,
        borderColor: '#d1d5db',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        color: '#0f172a',
        fontSize: 16,
        fontWeight: '600',
        minHeight: multiline ? 70 : undefined,
        textAlignVertical: multiline ? 'top' : 'center',
      }}
    />
  );
}

function DetailsForm({
  isExp, amount, entryType, setEntryType, app, setApp, category, setCategory,
  miles, setMiles, minutes, setMinutes, note, setNote, onEditAmount, onSave, saving,
}: {
  isExp: boolean;
  amount: string;
  entryType: EntryType;
  setEntryType: (t: EntryType) => void;
  app: AppType;
  setApp: (a: AppType) => void;
  category: ExpenseCategory;
  setCategory: (c: ExpenseCategory) => void;
  miles: string;
  setMiles: (s: string) => void;
  minutes: string;
  setMinutes: (s: string) => void;
  note: string;
  setNote: (s: string) => void;
  onEditAmount: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <View style={{ gap: 14 }}>
      {/* Amount summary — tap to edit, mirrors blue→purple from CalcPad */}
      <Pressable
        onPress={onEditAmount}
        style={({ pressed }) => ({
          borderRadius: 16,
          overflow: 'hidden',
          opacity: pressed ? 0.9 : 1,
          shadowColor: '#000',
          shadowOpacity: 0.08,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 2 },
          elevation: 2,
        })}
      >
        <LinearGradient
          colors={isExp ? ['#fee2e2', '#fecaca'] : ['#dcfce7', '#bbf7d0']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={{
            paddingHorizontal: 18,
            paddingVertical: 18,
            borderWidth: 2,
            borderColor: isExp ? '#fca5a5' : '#86efac',
            borderRadius: 16,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Text style={{ color: '#475569', fontSize: 13, fontWeight: '700' }}>← Edit Amount</Text>
          <Text style={{
            color: isExp ? '#b91c1c' : '#15803d',
            fontSize: 32,
            fontWeight: '900',
          }}>
            {isExp ? '-' : '+'}${amount}
          </Text>
        </LinearGradient>
      </Pressable>

      {/* White → gray-50 gradient form card (mirrors web EntryForm) */}
      <View style={{
        borderRadius: 18,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 3,
        backgroundColor: '#ffffff',
      }}>
        <LinearGradient
          colors={['#ffffff', '#f9fafb']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{ padding: 18, gap: 16 }}
        >
          {/* Type */}
          <View>
            <FieldLabel>📝 Type</FieldLabel>
            <PillSelect
              options={[
                { key: 'ORDER',        label: 'Order' },
                { key: 'BONUS',        label: 'Bonus' },
                { key: 'EXPENSE',      label: 'Expense' },
                { key: 'CANCELLATION', label: 'Cancellation' },
              ]}
              value={entryType}
              onChange={setEntryType}
            />
          </View>

          {/* App (hidden for EXPENSE — mirrors web) */}
          {entryType !== 'EXPENSE' && (
            <View>
              <FieldLabel>🚗 App</FieldLabel>
              <PillSelect
                scroll
                options={APPS.map(a => ({ key: a.key, label: a.label, color: a.color + '55' }))}
                value={app}
                onChange={setApp}
              />
            </View>
          )}

          {/* Category (only for EXPENSE) */}
          {entryType === 'EXPENSE' && (
            <View>
              <FieldLabel>🏷️ Category</FieldLabel>
              <PillSelect
                options={EXPENSE_CATS.map(c => ({
                  key: c,
                  label: `${EXPENSE_EMOJIS[c]} ${c}`,
                }))}
                value={category}
                onChange={setCategory}
              />
            </View>
          )}

          {/* Miles & Minutes */}
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <FieldLabel>🛣️ Miles</FieldLabel>
              <FormInput
                value={miles}
                onChangeText={setMiles}
                placeholder="0.0"
                keyboardType="decimal-pad"
              />
            </View>
            <View style={{ flex: 1 }}>
              <FieldLabel>⏱️ Minutes</FieldLabel>
              <FormInput
                value={minutes}
                onChangeText={setMinutes}
                placeholder="0"
                keyboardType="number-pad"
              />
            </View>
          </View>

          {/* Notes */}
          <View>
            <FieldLabel>📝 Notes (optional)</FieldLabel>
            <FormInput
              value={note}
              onChangeText={setNote}
              placeholder="Add any notes..."
              multiline
            />
          </View>
        </LinearGradient>
      </View>

      {/* Save button — solid yellow-400 like Next Step */}
      <Pressable
        onPress={onSave}
        disabled={saving}
        style={({ pressed }) => ({
          backgroundColor: CALC.NEXT_BG,
          borderRadius: 14,
          paddingVertical: 18,
          alignItems: 'center',
          opacity: pressed ? 0.85 : 1,
          shadowColor: '#000',
          shadowOpacity: 0.12,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 3 },
          elevation: 3,
        })}
      >
        {saving
          ? <ActivityIndicator color={CALC.NEXT_FG} />
          : <Text style={{ color: CALC.NEXT_FG, fontWeight: '900', fontSize: 18 }}>💾 Save Entry</Text>
        }
      </Pressable>
    </View>
  );
}

// ─── Add Entry Modal ───────────────────────────────────────────────────────────
function AddEntryModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
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
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: CALC.CARD_BG }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Yellow header bar — static View ensures iOS paints the bg reliably.
            paddingTop pushes content below the iPhone status bar / notch. */}
        <View style={{ backgroundColor: CALC.HEADER_BG, paddingTop: insets.top }}>
          <Pressable
            onPress={() => {
              hTapMed();
              if (step === 'details') { setStep('calc'); }
              else { reset(); onClose(); }
            }}
            android_ripple={{ color: 'rgba(0,0,0,0.08)' }}
            style={({ pressed }) => ({
              paddingHorizontal: 18,
              paddingTop: 18,
              paddingBottom: 18,
              flexDirection: 'row',
              alignItems: 'center',
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Ionicons
              name={step === 'calc' ? 'arrow-down' : 'arrow-back'}
              size={22}
              color="#0f172a"
              style={{ marginRight: 10 }}
            />
            <Text
              style={{
                color: '#0f172a',
                fontSize: 18,
                fontWeight: '800',
                lineHeight: 24,
                includeFontPadding: false,
              }}
            >
              {step === 'calc' ? 'Hide' : 'Back'}
            </Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          {step === 'calc' ? (
            <CalcPad
              amount={amount}
              mode={mode}
              onAmount={setAmount}
              onMode={setMode}
              onNext={() => {
                // Carry the calculator's Revenue/Expense choice into the details form
                setEntryType(mode === 'subtract' ? 'EXPENSE' : 'ORDER');
                setStep('details');
              }}
            />
          ) : (
            <DetailsForm
              isExp={isExp}
              amount={amount}
              entryType={entryType}
              setEntryType={setEntryType}
              app={app}
              setApp={setApp}
              category={category}
              setCategory={setCategory}
              miles={miles}
              setMiles={setMiles}
              minutes={minutes}
              setMinutes={setMinutes}
              note={note}
              setNote={setNote}
              onEditAmount={() => setStep('calc')}
              onSave={handleSave}
              saving={mutation.isPending}
            />
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

  // ── Animations ──
  const profitPopStyle = usePopOnChange(Math.round(profit * 100));   // pop on any cent change
  const ninjaGlowStyle = useMilestoneGlow(profit);                   // logo halo at $50/$100/...

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
            <Animated.View style={[{ borderRadius: 18 }, ninjaGlowStyle]}>
              <Image
                source={require('../../assets/ninja-logo.png')}
                style={{ width: 36, height: 36, resizeMode: 'contain' }}
              />
            </Animated.View>
            <Text style={{ fontSize: 18, fontWeight: '900', letterSpacing: 0.3, color: TEXT }}>
              EARNINGS{' '}
              <Text style={{ color: PRIMARY }}>NINJA</Text>
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <PressScale
              onPress={() => { hTap(); onRefresh(); }}
              style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: BG, borderWidth: 1, borderColor: BORDER, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="refresh" size={17} color={MUTED} />
            </PressScale>
            <PressScale
              onPress={() => { hTap(); setShowSettings(true); }}
              style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: BG, borderWidth: 1, borderColor: BORDER, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="settings-outline" size={17} color={MUTED} />
            </PressScale>
          </View>
        </View>

        {/* ── Period Tabs ───────────────────────────────────────────────────── */}
        <View style={{ backgroundColor: SURFACE, borderBottomWidth: 1, borderBottomColor: BORDER }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, gap: 6, flexDirection: 'row' }}>
            {PERIODS.map(p => {
              const active = period === p.key;
              return (
                <PressScale
                  key={p.key}
                  onPress={() => { hTap(); setPeriod(p.key); }}
                  scale={0.92}
                  style={[
                    {
                      paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20,
                      backgroundColor: active ? PRIMARY : 'transparent',
                      borderWidth: 1, borderColor: active ? PRIMARY : BORDER,
                    },
                    active ? neonGlow(PRIMARY, 5, 0.18) : undefined,
                  ].filter(Boolean) as ViewStyle[]}
                >
                  <Text style={{
                    color: active ? '#fff' : MUTED,
                    fontSize: 13, fontWeight: active ? '800' : '500',
                  }}>
                    {p.label}
                  </Text>
                </PressScale>
              );
            })}
          </ScrollView>
        </View>

        <View style={{ paddingHorizontal: 16, paddingTop: 14, gap: 12 }}>

          {rollupLoading ? (
            <View style={{ alignItems: 'center', paddingVertical: 60 }}>
              <ActivityIndicator color={PRIMARY} size="large" />
            </View>
          ) : (
            <>
              {/* ── Main Profit Card with neon glow ─────────────────────────── */}
              <Animated.View style={[
                {
                  backgroundColor: SURFACE,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: profitColor + '33',
                  padding: 20,
                },
                neonGlow(profitColor, 14, 0.22),
                profitPopStyle,
              ]}>
                {/* Label */}
                <Text style={{ color: LABEL, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5 }}>
                  NET PROFIT
                </Text>

                {/* Big profit number with count-up */}
                <AnimatedNumber
                  value={profit}
                  format={(n) => (n < 0 ? '-' : '') + '$' + Math.abs(n).toFixed(2)}
                  style={{ color: profitColor, fontSize: 48, fontWeight: '900', lineHeight: 56, marginTop: 4 }}
                />

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

                {/* Three stats with count-up */}
                <View style={{ flexDirection: 'row' }}>
                  {[
                    { label: 'REVENUE',   numeric: revenue,    format: (n: number) => `$${Math.round(n)}` },
                    { label: 'ORDERS',    numeric: orderCount, format: (n: number) => `${Math.round(n)}` },
                    { label: 'AVG ORDER', numeric: avgOrder,   format: (n: number) => `$${Math.round(n)}` },
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
                      <AnimatedNumber
                        value={stat.numeric}
                        format={stat.format}
                        style={{ color: TEXT, fontSize: 18, fontWeight: '800', marginTop: 2 }}
                      />
                    </View>
                  ))}
                </View>

              </Animated.View>

              {/* ── Secondary Stat Cards (subtle yellow glow + count-up) ────── */}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <StatCard label="$/Hour" icon="⏱️" value={`$${perHour.toFixed(2)}`} numericValue={perHour} format={(n) => `$${n.toFixed(2)}`} />
                <StatCard label="$/Mile" icon="📍" value={`$${perMile.toFixed(2)}`} numericValue={perMile} format={(n) => `$${n.toFixed(2)}`} />
                <StatCard label="Miles"  icon="🚗" value={miles.toFixed(1)}         numericValue={miles}   format={(n) => n.toFixed(1)} />
              </View>

              {/* ── Revenue/Expense cards (green/red glow) ──────────────────── */}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <StatCard label="Revenue"  icon="💵" accent={GREEN} value={`$${revenue.toFixed(2)}`}          numericValue={revenue}          format={(n) => `$${n.toFixed(2)}`} />
                <StatCard label="Expenses" icon="💸" accent={RED}   value={`$${Math.abs(expenses).toFixed(2)}`} numericValue={Math.abs(expenses)} format={(n) => `$${n.toFixed(2)}`} />
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

      {/* ── Sticky "Add Entry" bar (heavy neon yellow halo) ─────────────────── */}
      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: PRIMARY,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          paddingTop: 22,
          paddingBottom: insets.bottom > 0 ? insets.bottom + 14 : 22,
          paddingHorizontal: 28,
          shadowColor: PRIMARY,
          shadowOffset: { width: 0, height: -6 },
          shadowOpacity: 0.4,
          shadowRadius: 16,
          elevation: 12,
          zIndex: 999,
        }}
      >
        <Pressable
          onPress={() => { hTapMed(); setShowAdd(true); }}
          android_ripple={{ color: 'rgba(0,0,0,0.15)' }}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.85 : 1,
            transform: [{ scale: pressed ? 0.96 : 1 }],
          })}
        >
          <Text style={{ color: '#000', fontWeight: '900', fontSize: 22, letterSpacing: 0.3 }}>
            + Add Entry
          </Text>
        </Pressable>
      </View>

      {/* ── Modals ───────────────────────────────────────────────────────────── */}
      <AddEntryModal visible={showAdd} onClose={() => setShowAdd(false)} />
      <SettingsModal visible={showSettings} onClose={() => setShowSettings(false)} />
    </View>
  );
}
