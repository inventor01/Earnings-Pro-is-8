import { useEffect, useRef, useState } from 'react';
import {
  Modal, View, Text, TextInput, Pressable, Animated, Easing,
  KeyboardAvoidingView, Platform, ActivityIndicator, AccessibilityInfo,
  findNodeHandle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../lib/theme';

/**
 * GoalEditorSheet — reusable Focus-Mode editor for setting/editing a goal.
 *
 * A transparent RN Modal gives us true focus mode for free: the OS blocks
 * every touch, scroll, and gesture on the content beneath while the dashboard
 * stays visually present under the dim. No scrollEnabled bookkeeping on the
 * parent means no "stuck disabled scroll" states — closing the modal restores
 * everything, including scroll position, because we never touched it.
 *
 * - Backdrop fade + soft spring slide-up (skipped under Reduce Motion).
 * - Own KeyboardAvoidingView (a parent KAV never reaches inside a nested
 *   Modal), so Save/Cancel stay visible above the keyboard.
 * - Interactions are only "restored" (onClosed fired) after the exit
 *   animation completes — no flicker, no half-open state.
 * - VoiceOver: accessibilityViewIsModal traps focus; initial focus moves to
 *   the sheet; iOS/Android return focus to the invoking control natively on
 *   dismissal.
 * - Android back button cancels (onRequestClose).
 */
export default function GoalEditorSheet({
  visible,
  title,
  subtitle,
  initialValue,
  placeholder,
  saving,
  onSave,
  onCancel,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  initialValue: string;
  placeholder: string;
  saving: boolean;
  /** Called with a validated positive dollar amount. */
  onSave: (value: number) => void;
  onCancel: () => void;
}) {
  const { BG, SURFACE, BORDER, PRIMARY, PRIMARY_TXT, TEXT, MUTED, LABEL, RED, ON_PRIMARY } = useTheme();
  const insets = useSafeAreaInsets();

  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  // Mount state lags `visible` so the exit animation can play before unmount.
  const [mounted, setMounted] = useState(visible);

  const backdrop = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(0)).current; // 0 = offscreen, 1 = settled
  const reduceMotionRef = useRef(false);
  const cardRef = useRef<View>(null);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => { reduceMotionRef.current = v; })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => {
      reduceMotionRef.current = v;
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (visible) {
      setValue(initialValue);
      setError(null);
      setMounted(true);
      AccessibilityInfo.announceForAccessibility('Editing goal.');
      const instant = reduceMotionRef.current;
      Animated.parallel([
        Animated.timing(backdrop, {
          toValue: 1, duration: instant ? 0 : 180,
          easing: Easing.out(Easing.quad), useNativeDriver: true,
        }),
        instant
          ? Animated.timing(slide, { toValue: 1, duration: 0, useNativeDriver: true })
          : Animated.spring(slide, {
              toValue: 1, useNativeDriver: true,
              damping: 18, stiffness: 220, mass: 0.9,
            }),
      ]).start(() => {
        // Move VoiceOver/TalkBack focus into the editor once settled. Target
        // the TextInput (an accessible element) — focusing a non-accessible
        // container is a no-op for screen readers.
        const node = inputRef.current && findNodeHandle(inputRef.current);
        if (node) AccessibilityInfo.setAccessibilityFocus(node);
      });
    } else if (mounted) {
      const instant = reduceMotionRef.current;
      Animated.parallel([
        Animated.timing(backdrop, {
          toValue: 0, duration: instant ? 0 : 150,
          easing: Easing.in(Easing.quad), useNativeDriver: true,
        }),
        Animated.timing(slide, {
          toValue: 0, duration: instant ? 0 : 150,
          easing: Easing.in(Easing.quad), useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        // Unmount only after the exit transition — never mid-animation.
        if (finished) setMounted(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const handleSave = () => {
    if (saving) return;
    // Accept comma decimals ("12,50") from EU-style keypads.
    const val = parseFloat(value.replace(',', '.'));
    if (!val || !isFinite(val) || val <= 0) {
      setError('Enter a dollar amount greater than 0.');
      return;
    }
    setError(null);
    onSave(val);
  };

  if (!mounted) return null;

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={() => { if (!saving) onCancel(); }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, justifyContent: 'flex-end' }}
      >
        {/* Dim backdrop — tap to cancel. Absolute-filled so it sits behind the card. */}
        <Animated.View
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.45)', opacity: backdrop,
          }}
        >
          <Pressable
            style={{ flex: 1 }}
            onPress={() => { if (!saving) onCancel(); }}
            accessibilityLabel="Dismiss goal editor"
            accessibilityHint="Cancels editing"
          />
        </Animated.View>

        <Animated.View
          style={{
            opacity: backdrop,
            transform: [{
              translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [56, 0] }),
            }],
          }}
        >
          <View
            ref={cardRef}
            accessibilityViewIsModal
            style={{
              backgroundColor: SURFACE,
              borderTopLeftRadius: 24, borderTopRightRadius: 24,
              borderWidth: 1, borderColor: BORDER,
              paddingHorizontal: 20, paddingTop: 14,
              paddingBottom: Math.max(insets.bottom, 12) + 8,
              shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
              shadowOpacity: 0.15, shadowRadius: 16, elevation: 12,
            }}
          >
            {/* Grab handle */}
            <View style={{
              alignSelf: 'center', width: 40, height: 5, borderRadius: 3,
              backgroundColor: BORDER, marginBottom: 14,
            }} />

            <Text
              accessibilityRole="header"
              style={{ color: TEXT, fontSize: 18, fontWeight: '800' }}
            >
              {title}
            </Text>
            {subtitle ? (
              <Text style={{ color: MUTED, fontSize: 13, marginTop: 3 }}>{subtitle}</Text>
            ) : null}

            <View style={{
              flexDirection: 'row', alignItems: 'center', marginTop: 14,
              backgroundColor: BG, borderWidth: 1.5,
              borderColor: error ? RED : PRIMARY, borderRadius: 12,
              paddingHorizontal: 14,
            }}>
              <Text style={{ color: PRIMARY_TXT, fontSize: 18, fontWeight: '800', marginRight: 6 }}>$</Text>
              <TextInput
                ref={inputRef}
                value={value}
                onChangeText={(t) => { setValue(t); if (error) setError(null); }}
                placeholder={placeholder}
                placeholderTextColor={LABEL}
                keyboardType="decimal-pad"
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleSave}
                accessibilityLabel="Goal amount in dollars"
                style={{
                  flex: 1, paddingVertical: 12, color: TEXT,
                  fontSize: 18, fontWeight: '700', minHeight: 48,
                }}
              />
            </View>
            {error ? (
              <Text
                accessibilityLiveRegion="polite"
                style={{ color: RED, fontSize: 13, fontWeight: '600', marginTop: 8 }}
              >
                {error}
              </Text>
            ) : null}

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <Pressable
                onPress={() => { if (!saving) onCancel(); }}
                disabled={saving}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
                style={({ pressed }) => ({
                  flex: 1, minHeight: 48, borderRadius: 12, borderWidth: 1,
                  borderColor: BORDER, backgroundColor: BG,
                  alignItems: 'center', justifyContent: 'center',
                  opacity: pressed ? 0.8 : saving ? 0.5 : 1,
                })}
              >
                <Text style={{ color: MUTED, fontSize: 16, fontWeight: '700' }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleSave}
                disabled={saving}
                accessibilityRole="button"
                accessibilityLabel="Save goal"
                style={({ pressed }) => ({
                  flex: 2, minHeight: 48, borderRadius: 12,
                  backgroundColor: PRIMARY,
                  alignItems: 'center', justifyContent: 'center',
                  opacity: pressed ? 0.85 : saving ? 0.7 : 1,
                })}
              >
                {saving
                  ? <ActivityIndicator color={ON_PRIMARY} />
                  : <Text style={{ color: ON_PRIMARY, fontSize: 16, fontWeight: '800' }}>Save Goal</Text>}
              </Pressable>
            </View>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
