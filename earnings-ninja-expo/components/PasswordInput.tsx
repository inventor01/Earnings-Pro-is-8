import { useRef, useState } from 'react';
import { View, TextInput, Pressable, Platform, type TextInputProps, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/lib/theme';

// Reusable password field with a show/hide (eye) toggle.
// - Toggling never remounts the TextInput, so typed text, cursor position,
//   and focus are preserved.
// - iOS quirk: flipping secureTextEntry marks the field "fresh", so the OS
//   clears ALL text on the next keystroke. Re-syncing the native text right
//   after the flip (clear + rewrite) resets that state so typing appends
//   instead of erasing. Android does not need this.
// - The eye button has a 44pt touch target and accessibility labels.
// Any extra TextInput props (returnKeyType, onSubmitEditing, etc.) pass through.
type Props = Omit<TextInputProps, 'secureTextEntry'> & {
  containerStyle?: StyleProp<ViewStyle>;
};

export function PasswordInput({ containerStyle, style, ...inputProps }: Props) {
  const t = useTheme();
  const [visible, setVisible] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const toggle = () => {
    setVisible((v) => !v);
    if (Platform.OS === 'ios') {
      const current = inputProps.value ?? '';
      // Must run after the secureTextEntry prop change lands on the native side.
      requestAnimationFrame(() => {
        inputRef.current?.setNativeProps({ text: '' });
        inputRef.current?.setNativeProps({ text: current });
      });
    }
  };

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
