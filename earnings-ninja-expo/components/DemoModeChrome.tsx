// ─── Local sandbox Demo Mode: floating chrome ────────────────────────────────
//
// Mounted by app/_layout.tsx (over the whole Stack) while a demo session is
// active. Provides:
//   - a persistent, compact "DEMO" pill so the user always knows they're in
//     sample data (tap → actions: Create Free Account / Exit Demo)
//   - a one-time conversion prompt after the user has added a few entries
//
// Exiting (or converting) destroys the sandbox and returns to the login
// screen — see lib/demoSession.ts for the isolation guarantees.

import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/authContext';
import { useTheme } from '@/lib/theme';
import {
  subscribeDemo, shouldShowConversionPrompt, markConversionPromptShown,
} from '@/lib/demoSession';

export default function DemoModeChrome() {
  const { exitDemo } = useAuth();
  const { CARD_BG, TEXT, MUTED, GREEN, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [convertVisible, setConvertVisible] = useState(false);

  // Watch the demo session for the conversion-prompt threshold (3 entries added).
  useEffect(() => {
    const check = () => {
      if (shouldShowConversionPrompt()) {
        markConversionPromptShown();
        setConvertVisible(true);
      }
    };
    check();
    return subscribeDemo(check);
  }, []);

  const leaveDemo = () => {
    setConvertVisible(false);
    exitDemo();
    router.replace('/login');
  };

  const onPillPress = () => {
    Alert.alert(
      'Demo Mode',
      'You\u2019re exploring with sample data. Nothing here is saved.',
      [
        { text: 'Create Free Account', onPress: leaveDemo },
        {
          text: 'Exit Demo',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Exit Demo?', 'Sample data will be reset.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Exit', style: 'destructive', onPress: leaveDemo },
            ]);
          },
        },
        { text: 'Keep Exploring', style: 'cancel' },
      ],
    );
  };

  return (
    <>
      {/* Persistent DEMO pill — top-center, above all screens, never blocks
          more than its own footprint. */}
      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          top: insets.top + 4,
          left: 0,
          right: 0,
          alignItems: 'center',
        }}
      >
        <Pressable
          onPress={onPillPress}
          hitSlop={8}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: isDark ? 'rgba(34,197,94,0.18)' : 'rgba(22,163,74,0.14)',
            borderColor: GREEN ?? '#22c55e',
            borderWidth: 1,
            borderRadius: 999,
            paddingHorizontal: 12,
            paddingVertical: 5,
          }}
        >
          <View
            style={{
              width: 7, height: 7, borderRadius: 4,
              backgroundColor: GREEN ?? '#22c55e', marginRight: 6,
            }}
          />
          <Text style={{ color: GREEN ?? '#22c55e', fontWeight: '800', fontSize: 12, letterSpacing: 0.6 }}>
            DEMO · sample data
          </Text>
        </Pressable>
      </View>

      {/* One-time conversion prompt */}
      <Modal visible={convertVisible} transparent animationType="fade" onRequestClose={() => setConvertVisible(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 28 }}>
          <View style={{ backgroundColor: CARD_BG ?? (isDark ? '#171717' : '#fff'), borderRadius: 20, padding: 22 }}>
            <Text style={{ color: TEXT ?? '#fff', fontSize: 20, fontWeight: '900', textAlign: 'center' }}>
              Ready to track your real earnings?
            </Text>
            <Text style={{ color: MUTED ?? '#94a3b8', fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 }}>
              You{'\u2019'}ve got the hang of it. Create a free account to start logging your own dashes — demo data isn{'\u2019'}t saved.
            </Text>
            <Pressable
              onPress={leaveDemo}
              style={{
                backgroundColor: GREEN ?? '#22c55e',
                borderRadius: 14,
                paddingVertical: 14,
                alignItems: 'center',
                marginTop: 18,
              }}
            >
              <Text style={{ color: '#052e12', fontWeight: '900', fontSize: 16 }}>Create Free Account</Text>
            </Pressable>
            <Pressable onPress={() => setConvertVisible(false)} style={{ paddingVertical: 12, alignItems: 'center', marginTop: 4 }}>
              <Text style={{ color: MUTED ?? '#94a3b8', fontWeight: '700', fontSize: 14 }}>Keep Exploring</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}
