import { useEffect, useState } from 'react';
import {
  View, Text, Pressable, TextInput, Modal,
  ActivityIndicator, Switch, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/lib/theme';
import { api } from '@/lib/api';

// Settings row for opt-in email two-factor auth. Self-contained: fetches its own
// status, and drives the enable (emailed-code confirm) and disable (password)
// flows through their own modals so the giant Settings screen only mounts <TwoFactorRow />.
export function TwoFactorRow() {
  const {
    SURFACE, BORDER, PRI_LITE, PRIMARY, PRIMARY_TXT, TEXT, MUTED, GREEN, CARD_BG, ON_PRIMARY,
  } = useTheme();

  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  // Enable-confirm (code) modal
  const [showCode, setShowCode] = useState(false);
  const [challenge, setChallenge] = useState('');
  const [codeEmail, setCodeEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeErr, setCodeErr] = useState('');
  const [codeBusy, setCodeBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  // Disable (password) modal
  const [showPw, setShowPw] = useState(false);
  const [pw, setPw] = useState('');
  const [pwErr, setPwErr] = useState('');
  const [pwBusy, setPwBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    api.getMfaStatus()
      .then((r) => { if (alive) setEnabled(!!r.enabled); })
      .catch(() => { if (alive) setAvailable(false); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const startEnable = async () => {
    setBusy(true);
    try {
      const r = await api.enableMfa();
      if (r.already_enabled) {
        setEnabled(true);
        return;
      }
      setChallenge(r.challenge_token || '');
      setCodeEmail(r.email || '');
      setCode('');
      setCodeErr('');
      setResent(false);
      setShowCode(true);
    } catch (e: any) {
      Alert.alert('Two-factor', e?.message || 'Could not start setup.');
    } finally {
      setBusy(false);
    }
  };

  const confirmEnable = async () => {
    setCodeErr('');
    const c = code.trim();
    if (c.length < 6) {
      setCodeErr('Enter the 6-digit code from your email');
      return;
    }
    setCodeBusy(true);
    try {
      await api.confirmMfaEnable(challenge, c);
      setEnabled(true);
      setShowCode(false);
      Alert.alert('Two-factor on', 'You\u2019ll now enter an emailed code each time you sign in.');
    } catch (e: any) {
      setCodeErr(e?.message || 'Could not verify code');
    } finally {
      setCodeBusy(false);
    }
  };

  const resend = async () => {
    setCodeErr('');
    setResent(false);
    setResending(true);
    try {
      const r = await api.resendMfa(challenge);
      setChallenge(r.challenge_token);
      if (r.email) setCodeEmail(r.email);
      setCode('');
      setResent(true);
    } catch (e: any) {
      setCodeErr(e?.message || 'Could not resend code');
    } finally {
      setResending(false);
    }
  };

  const confirmDisable = async () => {
    setPwErr('');
    setPwBusy(true);
    try {
      await api.disableMfa(pw || undefined);
      setEnabled(false);
      setShowPw(false);
      setPw('');
    } catch (e: any) {
      setPwErr(e?.message || 'Could not turn off two-factor');
    } finally {
      setPwBusy(false);
    }
  };

  const onToggle = (next: boolean) => {
    if (busy || loading) return;
    if (next) {
      startEnable();
    } else {
      setPw('');
      setPwErr('');
      setShowPw(true);
    }
  };

  if (!available) return null;

  return (
    <>
      <View
        style={{
          backgroundColor: SURFACE, borderRadius: 14, borderWidth: 1, borderColor: BORDER, padding: 16,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: PRI_LITE, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="shield-checkmark" size={18} color={PRIMARY_TXT} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: TEXT, fontSize: 15, fontWeight: '700' }}>Two-Factor Authentication</Text>
            <Text style={{ color: MUTED, fontSize: 12, marginTop: 1 }}>
              {enabled ? 'On \u2014 emailed code required at sign-in' : 'Email a code at sign-in for extra security'}
            </Text>
          </View>
          {loading || busy
            ? <ActivityIndicator color={PRIMARY_TXT} />
            : <Switch
                value={enabled}
                onValueChange={onToggle}
                trackColor={{ false: BORDER, true: PRIMARY }}
                thumbColor={'#fff'}
              />
          }
        </View>
      </View>

      {/* Enable-confirm code modal */}
      <Modal visible={showCode} animationType="fade" transparent onRequestClose={() => setShowCode(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 }}>
          <View style={{ backgroundColor: SURFACE, borderRadius: 18, borderWidth: 1, borderColor: BORDER, padding: 22 }}>
            <Text style={{ color: TEXT, fontSize: 18, fontWeight: '800', marginBottom: 6 }}>Confirm your email</Text>
            <Text style={{ color: MUTED, fontSize: 13, marginBottom: 16, lineHeight: 18 }}>
              We emailed a 6-digit code{codeEmail ? ` to ${codeEmail}` : ''}. Enter it to turn on two-factor.
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
                <Text style={{ color: TEXT, fontWeight: '700', fontSize: 15 }}>Cancel</Text>
              </Pressable>
              <Pressable onPress={confirmEnable} disabled={codeBusy} style={{ flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center', backgroundColor: PRIMARY, opacity: codeBusy ? 0.7 : 1 }}>
                {codeBusy ? <ActivityIndicator color={ON_PRIMARY} /> : <Text style={{ color: ON_PRIMARY, fontWeight: '900', fontSize: 15 }}>Turn on</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Disable (password) modal */}
      <Modal visible={showPw} animationType="fade" transparent onRequestClose={() => setShowPw(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 }}>
          <View style={{ backgroundColor: SURFACE, borderRadius: 18, borderWidth: 1, borderColor: BORDER, padding: 22 }}>
            <Text style={{ color: TEXT, fontSize: 18, fontWeight: '800', marginBottom: 6 }}>Turn off two-factor?</Text>
            <Text style={{ color: MUTED, fontSize: 13, marginBottom: 16, lineHeight: 18 }}>
              Enter your password to confirm. Leave blank if you sign in with Apple.
            </Text>
            <TextInput
              value={pw}
              onChangeText={setPw}
              placeholder="••••••••"
              placeholderTextColor={MUTED}
              secureTextEntry
              editable={!pwBusy}
              style={{
                backgroundColor: CARD_BG, borderWidth: 1, borderColor: BORDER, borderRadius: 12,
                paddingHorizontal: 14, paddingVertical: 12, color: TEXT, fontSize: 16, marginBottom: 12,
              }}
            />
            {pwErr ? (
              <View style={{ backgroundColor: 'rgba(239,68,68,0.12)', borderWidth: 1, borderColor: '#ef4444', borderRadius: 10, padding: 10, marginBottom: 12 }}>
                <Text style={{ color: '#f87171', fontSize: 13, textAlign: 'center' }}>{pwErr}</Text>
              </View>
            ) : null}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable onPress={() => setShowPw(false)} style={{ flex: 1, borderRadius: 12, borderWidth: 1, borderColor: BORDER, paddingVertical: 12, alignItems: 'center' }}>
                <Text style={{ color: TEXT, fontWeight: '700', fontSize: 15 }}>Cancel</Text>
              </Pressable>
              <Pressable onPress={confirmDisable} disabled={pwBusy} style={{ flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center', backgroundColor: '#ef4444', opacity: pwBusy ? 0.7 : 1 }}>
                {pwBusy ? <ActivityIndicator color={'#fff'} /> : <Text style={{ color: '#fff', fontWeight: '900', fontSize: 15 }}>Turn off</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
