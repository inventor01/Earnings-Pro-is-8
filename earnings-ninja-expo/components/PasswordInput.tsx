import { useEffect, useRef, useState } from 'react';
import { View, TextInput, Pressable, Platform, type TextInputProps, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/lib/theme';

// Reusable password field with a show/hide (eye) toggle.
//
// iOS quirk: flipping secureTextEntry marks the native UITextField "fresh",
// so the OS clears ALL text on the user's next keystroke. The known-good
// repair (facebook/react-native#21572) is to rewrite the field's text with a
// DIFFERENT string after the flip commits, then restore the real value.
//
// History of this bug in this app — do not regress any of these:
//  1. Scheduling the rewrite from the press handler (rAF) raced the React
//     commit of secureTextEntry and no-oped. → must run in an effect keyed
//     on `visible`.
//  2. Rewriting the SAME text got coalesced into a native no-op. → must go
//     through a differing string (value + ' '), across two separate commits.
//  3. Doing the rewrite via `setNativeProps({ text })` silently no-ops on the
//     New Architecture once the user has typed (facebook/react-native#47266,
//     Fabric/iOS). Both rewrites must therefore be COMMITTED React value
//     updates: internal display state temporarily overrides the rendered
//     `value` so the writes flow through Fabric's real state/eventCount path.
//     The restore (phase 2) is scheduled from an effect that runs only AFTER
//     the phase-1 render has committed, so the two differing writes are
//     guaranteed to be two separate commits.
//
// The component always renders a concrete string value (internal state backs
// uncontrolled usage), so the restore commit is a real native write in both
// controlled and uncontrolled modes.
//
// Android never needed any of this and takes none of these paths.
// The eye button has a 44pt touch target and accessibility labels.
// Any extra TextInput props (returnKeyType, onSubmitEditing, etc.) pass through.
type Props = Omit<TextInputProps, 'secureTextEntry'> & {
  containerStyle?: StyleProp<ViewStyle>;
};

// While an iOS resync is in flight the rendered text is temporarily
// `base + ' '`. A change event fired inside that window (a fast keystroke, or
// the write's own echo on some RN versions) therefore starts with that temp
// string; strip the injected space so it can never reach state or the
// controlled value. Exported for tests.
export function normalizeResyncText(base: string | null, text: string): string {
  if (base != null && text.startsWith(base + ' ')) {
    return base + text.slice(base.length + 1);
  }
  return text;
}

// Rendered-value precedence: an in-flight resync override wins, then the
// parent's controlled value, then the internal mirror (uncontrolled usage).
// Always returns a string so every commit is a real native write.
// Exported for tests.
export function computeRenderedValue(
  resyncDisplay: string | null,
  propValue: string | undefined,
  internalValue: string,
): string {
  return resyncDisplay ?? propValue ?? internalValue;
}

export function PasswordInput({ containerStyle, style, ...inputProps }: Props) {
  const t = useTheme();
  const [visible, setVisible] = useState(false);
  const inputRef = useRef<TextInput>(null);
  // Internal mirror of the text — the rendered value for uncontrolled usage,
  // and the restore target for the resync in either mode.
  const [internalValue, setInternalValue] = useState(inputProps.value ?? '');
  const lastValueRef = useRef(inputProps.value ?? '');
  const mountedRef = useRef(false);

  // Non-null while an iOS resync is in flight: phase 1 renders `base + ' '`;
  // phase 2 (scheduled after phase 1 commits) clears it back to null.
  const [resyncDisplay, setResyncDisplay] = useState<string | null>(null);
  // In-flight resync window. A fresh OBJECT per window (even when the base
  // text is identical) so a rapid second toggle can never be mistaken for the
  // previous window — the phase-2 guard compares object identity.
  const pendingResyncRef = useRef<{ base: string } | null>(null);

  const handleChangeText = (text: string) => {
    const normalized = normalizeResyncText(pendingResyncRef.current?.base ?? null, text);
    if (pendingResyncRef.current != null) {
      // A real keystroke landed inside the resync window. End the window
      // immediately so the (stale) display override can never clobber it:
      // from this commit on, the fresh value is what renders.
      pendingResyncRef.current = null;
      setResyncDisplay(null);
    }
    lastValueRef.current = normalized;
    setInternalValue(normalized);
    inputProps.onChangeText?.(normalized);
  };

  useEffect(() => {
    if (inputProps.value != null) {
      lastValueRef.current = inputProps.value;
      setInternalValue(inputProps.value);
    }
  }, [inputProps.value]);

  // Phase 1: after the secureTextEntry change has committed (the only
  // reliable ordering), render the differing string.
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    if (Platform.OS !== 'ios') return;
    const current = inputProps.value ?? lastValueRef.current ?? '';
    if (!current) return; // nothing typed yet — nothing to protect
    pendingResyncRef.current = { base: current };
    setResyncDisplay(current + ' ');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Phase 2: runs only after the phase-1 render (base + ' ') has COMMITTED,
  // then restores the real value on the next frame — two guaranteed separate
  // commits with differing strings, so native can't coalesce them. The
  // cleanup cancels the frame if the window is replaced or the component
  // unmounts; a keystroke cancels via handleChangeText.
  useEffect(() => {
    if (resyncDisplay == null) return;
    const windowToken = pendingResyncRef.current;
    const frame = requestAnimationFrame(() => {
      // Identity check: only THIS window's restore may run. A newer window
      // (rapid double-toggle, even with identical text) has a fresh token.
      if (pendingResyncRef.current !== windowToken) return;
      pendingResyncRef.current = null;
      setResyncDisplay(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [resyncDisplay]);

  const toggle = () => {
    // Synchronously invalidate any in-flight resync BEFORE flipping secure
    // mode: a rapid second tap must never let the previous window's restore
    // fire around the new secureTextEntry commit (that ordering is the
    // original bug). The post-commit effect then opens a fresh window.
    pendingResyncRef.current = null;
    setResyncDisplay(null);
    setVisible((v) => !v);
  };

  const renderedValue = computeRenderedValue(resyncDisplay, inputProps.value, internalValue);

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
        value={renderedValue}
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
