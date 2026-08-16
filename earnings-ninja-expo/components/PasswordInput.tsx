import { useEffect, useRef, useState } from 'react';
import { View, TextInput, Pressable, Platform, type TextInputProps, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/lib/theme';

// Reusable password field with a show/hide (eye) toggle.
// - Toggling never remounts the TextInput, so typed text, cursor position,
//   and focus are preserved.
// - iOS quirk: flipping secureTextEntry marks the field "fresh", so the OS
//   clears ALL text on the next keystroke. Re-syncing the native text
//   (clear + rewrite) AFTER the flip commits resets that state so typing
//   appends instead of erasing. The resync must run in an effect keyed on
//   `visible` — scheduling it from the toggle handler (e.g. via
//   requestAnimationFrame) can fire BEFORE React commits the secureTextEntry
//   change, in which case it no-ops and the next keystroke still wipes the
//   field. Android does not need this.
// - The eye button has a 44pt touch target and accessibility labels.
// Any extra TextInput props (returnKeyType, onSubmitEditing, etc.) pass through.
type Props = Omit<TextInputProps, 'secureTextEntry'> & {
  containerStyle?: StyleProp<ViewStyle>;
};

export function PasswordInput({ containerStyle, style, ...inputProps }: Props) {
  const t = useTheme();
  const [visible, setVisible] = useState(false);
  const inputRef = useRef<TextInput>(null);
  // Tracks the latest text even for uncontrolled usage, so the post-toggle
  // resync always rewrites the current value.
  const lastValueRef = useRef(inputProps.value ?? '');
  const mountedRef = useRef(false);

  const handleChangeText = (text: string) => {
    lastValueRef.current = text;
    inputProps.onChangeText?.(text);
  };

  useEffect(() => {
    if (inputProps.value != null) lastValueRef.current = inputProps.value;
  }, [inputProps.value]);

  // Runs after the secureTextEntry prop change has committed to the native
  // view, which is the only ordering that reliably clears iOS's
  // "fresh secure field" state (see header comment).
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    if (Platform.OS !== 'ios') return;
    const current = inputProps.value ?? lastValueRef.current ?? '';
    inputRef.current?.setNativeProps({ text: '' });
    inputRef.current?.setNativeProps({ text: current });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const toggle = () => setVisible((v) => !v);

  return (
    <View
      style={[{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: t.CARD_BG,
        borderWidth: 1,
        borderColor: t.BORDER,
        borderRadius: 12,
      }, containerStyle]}
    >
      <TextInput
        ref={inputRef}
        placeholder="••••••••"
        placeholderTextColor={t.MUTED}
        autoCapitalize="none"
        autoCorrect={false}
        {...inputProps}
        onChangeText={handleChangeText}
        secureTextEntry={!visible}
        style={[{
          flex: 1,
          paddingLeft: 16,
          paddingRight: 8,
          paddingVertical: 14,
          color: t.TEXT,
          fontSize: 16,
        }, style]}
      />
      <Pressable
        onPress={toggle}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={visible ? 'Hide password' : 'Show password'}
        style={{ paddingHorizontal: 12, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' }}
      >
        <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={22} color={t.MUTED} />
      </Pressable>
    </View>
  );
}
