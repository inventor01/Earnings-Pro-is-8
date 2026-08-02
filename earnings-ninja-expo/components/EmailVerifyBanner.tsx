import { useCallback, useState } from 'react';
import {
  View, Text, Pressable, TextInput, Modal, ActivityIndicator,
  Keyboard, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/lib/theme';
import { api } from '@/lib/api';

// Non-blocking "confirm your email" nudge shown on the dashboard. Self-contained:
// it polls its own status on focus and renders nothing unless the account both
// has an email on file and hasn't confirmed it (demo/Apple/already-verified all
// return needs_verification=false server-side). Confirmation happens in-app via a
// 6-digit code, mirroring the two-factor flow. Dismiss is session-only — the
// reminder gently returns on the next launch until the email is confirmed.
export function EmailVerifyBanner() {
  const {
    SURFACE, BORDER, PRI_LITE, PRIMARY, PRIMARY_TXT, TEXT, MUTED, GREEN, CARD_BG, ON_PRIMARY,
  } = useTheme();

  const [needs, setNeeds] = useState(false);
  const [email, setEmail] = useState('');
  const [dismissed, setDismissed] = useState(false);

  const [showCode, setShowCode] = useState(false);
  const [code, setCode] = useState('');
  const [codeErr, setCodeErr] = useState('');
  const [codeBusy, setCodeBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      api.getEmailVerifyStatus()
        .then((r) => {
          if (!alive) return;
          setNeeds(!!r.needs_verification);
          setEmail(r.email || '');
        })
        .catch(() => { /* network/offline or pre-feature backend — stay hidden */ });
      return () => { alive = false; };
    }, []),
  );

  const open = () => {
    setCode('');
    setCodeErr('');
    setResent(false);
    setShowCode(true);
  };

  const confirm = async () => {
    setCodeErr('');
    const c = code.trim();
    if (c.length < 6) {
      setCodeErr('Enter the 6-digit code from your email');
      return;
    }
    setCodeBusy(true);
    try {
      await api.verifyEmail(c);
      setNeeds(false);
      setShowCode(false);
    } catch (e: any) {
      setCodeErr(e?.message || 'Could not confirm your email');
    } finally {
      setCodeBusy(false);
    }
  };

  const resend = async () => {
    setCodeErr('');
    setResent(false);
    setResending(true);
    try {
      await api.resendEmailVerification();
      setCode('');
      setResent(true);
    } catch (e: any) {
      setCodeErr(e?.message || 'Could not resend the code');
    } finally {
      setResending(false);
    }
  };

  if (!needs || dismissed) return null;

  return (
    <>
      <View
        style={{
          backgroundColor: SURFACE, borderRadius: 14, borderWidth: 1, borderColor: PRIMARY,
          padding: 14, marginBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 12,
        }}
      >
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: PRI_LITE, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="mail-unread" size={18} color={PRIMARY_TXT} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: TEXT, fontSize: 14, fontWeight: '800' }}>Confirm your email</Text>
          <Text style={{ color: MUTED, fontSize: 12, marginTop: 1 }}>
            Verify {email || 'your email'} to secure your account.
          </Text>
        </View>
        <Pressable
          onPress={open}
          style={{ borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: PRIMARY }}
        >
          <Text style={{ color: ON_PRIMARY, fontWeight: '900', fontSize: 13 }}>Verify</Text>
        </Pressable>
        <Pressable onPress={() => setDismissed(true)} hitSlop={10} style={{ paddingLeft: 2 }}>
          <Ionicons name="close" size={18} color={MUTED} />
        </Pressable>
      </View>

      <Modal visible={showCode} animationType="fade" transparent onRequestClose={() => setShowCode(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
        <Pressable
          onPress={Keyboard.dismiss}
          accessible={false}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 }}
        >
          <View style={{ backgroundColor: SURFACE, borderRadius: 18, borderWidth: 1, borderColor: BORDER, maxHeight: '100%', overflow: 'hidden' }}
            onStartShouldSetResponder={() => true}
          >
            <ScrollView keyboardShouldPersistTaps="handled" bounces={false} contentContainerStyle={{ padding: 22 }}>
            <Text style={{ color: TEXT, fontSize: 18, fontWeight: '800', marginBottom: 6 }}>Confirm your email</Text>
            <Text style={{ color: MUTED, fontSize: 13, marginBottom: 16, lineHeight: 18 }}>
              We emailed a 6-digit code{email ? ` to ${email}` : ''}. Enter it to confirm your account.
            </Text>
            <TextInput
              value={code}
              onChangeText={(v) => setCode(v.replace(/[^0-9]/g, '').slice(0, 6))}
              placeholder="123456"
              placeholderTextColor={MUTED}
              keyboardType="number-pad"
              autoFocus
              maxLength={6}
              editable={!codeBusy}
              style={{
                backgroundColor: CARD_BG, borderWidth: 1, borderColor: BORDER, borderRadius: 12,
                paddingHorizontal: 14, paddingVertical: 12, color: TEXT, fontSize: 24,
                letterSpacing: 8, textAlign: 'center', marginBottom: 12,
              }}
            />
            {resent ? (
              <View style={{ backgroundColor: 'rgba(34,197,94,0.12)', borderWidth: 1, borderColor: GREEN, borderRadius: 10, padding: 10, marginBottom: 12 }}>
                <Text style={{ color: GREEN, fontSize: 13, textAlign: 'center' }}>A new code is on its way.</Text>
              </View>
            ) : null}
            {codeErr ? (
              <View style={{ backgroundColor: 'rgba(239,68,68,0.12)', borderWidth: 1, borderColor: '#ef4444', borderRadius: 10, padding: 10, marginBottom: 12 }}>
                <Text style={{ color: '#f87171', fontSize: 13, textAlign: 'center' }}>{codeErr}</Text>
              </View>
            ) : null}
            <Pressable onPress={resend} disabled={resending || codeBusy} hitSlop={8} style={{ alignSelf: 'center', marginBottom: 14, paddingVertical: 4 }}>
              <Text style={{ color: PRIMARY_TXT, fontSize: 13, fontWeight: '700' }}>
                {resending ? 'Sending\u2026' : "Didn't get it? Resend code"}
              </Text>
            </Pressable>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable onPress={() => setShowCode(false)} style={{ flex: 1, borderRadius: 12, borderWidth: 1, borderColor: BORDER, paddingVertical: 12, alignItems: 'center' }}>
                <Text style={{ color: TEXT, fontWeight: '700', fontSize: 15 }}>Later</Text>
              </Pressable>
              <Pressable onPress={confirm} disabled={codeBusy} style={{ flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center', backgroundColor: PRIMARY, opacity: codeBusy ? 0.7 : 1 }}>
                {codeBusy ? <ActivityIndicator color={ON_PRIMARY} /> : <Text style={{ color: ON_PRIMARY, fontWeight: '900', fontSize: 15 }}>Confirm</Text>}
              </Pressable>
            </View>
            </ScrollView>
          </View>
        </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}
