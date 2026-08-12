import { useState } from 'react';
import { View, TextInput, Pressable, type TextInputProps, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/lib/theme';

// Reusable password field with a show/hide (eye) toggle.
// - Toggling never remounts the TextInput, so typed text, cursor position,
//   and focus are preserved.
// - The eye button has a 44pt touch target and accessibility labels.
// Any extra TextInput props (returnKeyType, onSubmitEditing, etc.) pass through.
type Props = Omit<TextInputProps, 'secureTextEntry'> & {
  containerStyle?: StyleProp<ViewStyle>;
};

export function PasswordInput({ containerStyle, style, ...inputProps }: Props) {
  const t = useTheme();
  const [visible, setVisible] = useState(false);

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
        onPress={() => setVisible((v) => !v)}
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
