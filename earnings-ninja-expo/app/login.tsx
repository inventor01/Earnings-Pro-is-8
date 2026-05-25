import { useEffect, useState } from 'react';
import {
  View, Text, TextInput, Pressable,
  ScrollView, ActivityIndicator, KeyboardAvoidingView,
  Platform, Image, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/authContext';
import { api } from '@/lib/api';
import { useTheme } from '@/lib/theme';
import * as AppleAuthentication from 'expo-apple-authentication';

export default function LoginScreen() {
  const t = useTheme();
  const BG = t.BG;
  const CARD = t.SURFACE;
  const BORDER = t.BORDER;
  const ACCENT = t.PRIMARY;
  const GREEN = t.GREEN;
  const TEXT = t.TEXT;
  const MUTED = t.MUTED;
  const INPUT_BG = t.CARD_BG;
  const ON_PRIMARY = t.ON_PRIMARY;

  const insets = useSafeAreaInsets();
  const { login } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [credential, setCredential] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [error, setError] = useState('');

  const [appleLoading, setAppleLoading] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    AppleAuthentication.isAvailableAsync().then(setAppleAvailable).catch(() => setAppleAvailable(false));
  }, []);

  const handleAppleSignIn = async () => {
    setError('');
    setAppleLoading(true);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) {
        throw new Error('Apple did not return an identity token');
      }
      const res = await api.appleSignIn(
        credential.identityToken,
        credential.fullName?.givenName ?? undefined,
        credential.fullName?.familyName ?? undefined,
      );
      login(res.access_token);
    } catch (e: any) {
      // `ERR_REQUEST_CANCELED` is the user backing out — don't surface as error.
      if (e?.code !== 'ERR_REQUEST_CANCELED') {
        setError(e?.message || 'Apple sign-in failed');
      }
    } finally {
      setAppleLoading(false);
    }
  };

  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMessage, setForgotMessage] = useState('');
  const [forgotError, setForgotError] = useState('');

  const handleSubmit = async () => {
    setError('');
    setLoading(true);
    try {
      const res = mode === 'login'
        ? await api.login(credential, password)
        : await api.signup(credential, password, username);
      login(res.access_token);
    } catch (e: any) {
      setError(e.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleDemo = async () => {
    setError('');
    setDemoLoading(true);
    try {
      const res = await api.demo();
      login(res.access_token);
    } catch (e: any) {
      setError(e.message || 'Failed to start demo');
    } finally {
      setDemoLoading(false);
    }
  };

  const openForgot = () => {
    setForgotEmail(credential.includes('@') ? credential : '');
    setForgotMessage('');
    setForgotError('');
    setShowForgot(true);
  };

  const submitForgot = async () => {
    setForgotMessage('');
    setForgotError('');
    if (!forgotEmail.trim()) {
      setForgotError('Enter the email on your account');
      return;
    }
    setForgotLoading(true);
    try {
      const res = await api.requestPasswordReset(forgotEmail.trim());
      setForgotMessage(res.message || 'If that email is on file, a reset link is on its way.');
    } catch (e: any) {
      setForgotError(e.message || 'Could not send reset email');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: BG }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          paddingHorizontal: 20,
          paddingTop: insets.top + 20,
          paddingBottom: insets.bottom + 20,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo + Title */}
        <View style={{ alignItems: 'center', marginBottom: 32 }}>
          <Image
            source={require('../assets/ninja-logo.png')}
            style={{
              width: 180,
              height: 180,
              resizeMode: 'contain',
              marginBottom: 12,
              shadowColor: ACCENT,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.6,
              shadowRadius: 20,
            }}
          />
          <Text style={{
            color: TEXT,
            fontSize: 24,
            fontWeight: '900',
            letterSpacing: 1,
            textAlign: 'center',
          }}>
            Earnings Ninja 🥷
          </Text>
          <Text style={{ color: MUTED, fontSize: 13, marginTop: 4, textAlign: 'center' }}>
            Track your delivery driver earnings
          </Text>
        </View>

        {/* Card */}
        <View style={{
          backgroundColor: CARD,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: BORDER,
          padding: 24,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.4,
          shadowRadius: 20,
          elevation: 10,
        }}>
          {/* Mode Toggle */}
          <View style={{
            flexDirection: 'row',
            backgroundColor: BG,
            borderRadius: 12,
            padding: 4,
            marginBottom: 20,
          }}>
            {(['login', 'signup'] as const).map((m) => (
              <Pressable
                key={m}
                onPress={() => { setMode(m); setError(''); }}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: 10,
                  backgroundColor: mode === m ? ACCENT : 'transparent',
                  alignItems: 'center',
                }}
              >
                <Text style={{
                  color: mode === m ? ON_PRIMARY : MUTED,
                  fontWeight: '700',
                  fontSize: 14,
                  textTransform: 'capitalize',
                }}>
                  {m === 'login' ? 'Sign In' : 'Sign Up'}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Fields */}
          {mode === 'signup' && (
            <View style={{ marginBottom: 12 }}>
              <Text style={{ color: MUTED, fontSize: 12, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Username</Text>
              <TextInput
                value={username}
                onChangeText={setUsername}
                placeholder="your_username"
                placeholderTextColor={MUTED}
                autoCapitalize="none"
                style={{
                  backgroundColor: INPUT_BG,
                  borderWidth: 1,
                  borderColor: BORDER,
                  borderRadius: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  color: TEXT,
                  fontSize: 16,
                }}
              />
            </View>
          )}

          <View style={{ marginBottom: 12 }}>
            <Text style={{ color: MUTED, fontSize: 12, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>
              {mode === 'login' ? 'Email or Username' : 'Email'}
            </Text>
            <TextInput
              value={credential}
              onChangeText={setCredential}
              placeholder={mode === 'login' ? 'email or username' : 'you@example.com'}
              placeholderTextColor={MUTED}
              autoCapitalize="none"
              keyboardType={mode === 'signup' ? 'email-address' : 'default'}
              style={{
                backgroundColor: INPUT_BG,
                borderWidth: 1,
                borderColor: BORDER,
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 14,
                color: TEXT,
                fontSize: 16,
              }}
            />
          </View>

          <View style={{ marginBottom: 6 }}>
            <Text style={{ color: MUTED, fontSize: 12, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={MUTED}
              secureTextEntry
              style={{
                backgroundColor: INPUT_BG,
                borderWidth: 1,
                borderColor: BORDER,
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 14,
                color: TEXT,
                fontSize: 16,
              }}
            />
          </View>

          {/* Forgot password link — only on the Sign In tab */}
          {mode === 'login' && (
            <Pressable
              onPress={openForgot}
              hitSlop={8}
              style={{ alignSelf: 'flex-end', marginTop: 4, marginBottom: 14, paddingVertical: 4 }}
            >
              <Text style={{ color: ACCENT, fontSize: 13, fontWeight: '700' }}>
                Forgot password?
              </Text>
            </Pressable>
          )}
          {mode === 'signup' && <View style={{ height: 14 }} />}

          {error ? (
            <View style={{
              backgroundColor: 'rgba(239,68,68,0.15)',
              borderRadius: 10,
              padding: 12,
              borderWidth: 1,
              borderColor: '#ef4444',
              marginBottom: 16,
            }}>
              <Text style={{ color: '#f87171', fontSize: 13, textAlign: 'center' }}>{error}</Text>
            </View>
          ) : null}

          {/* Submit */}
          <Pressable
            onPress={handleSubmit}
            disabled={loading}
            style={{
              width: '100%',
              alignSelf: 'stretch',
              backgroundColor: ACCENT,
              borderRadius: 14,
              paddingVertical: 16,
              paddingHorizontal: 16,
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: ACCENT,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.45,
              shadowRadius: 10,
              elevation: 6,
              marginBottom: 12,
              opacity: loading ? 0.85 : 1,
            }}
          >
            {loading
              ? <ActivityIndicator color={ON_PRIMARY} />
              : <Text style={{
                  color: ON_PRIMARY,
                  fontWeight: '900',
                  fontSize: 17,
                  letterSpacing: 0.3,
                  textAlign: 'center',
                  textAlignVertical: 'center',
                  includeFontPadding: false,
                }}>
                  {mode === 'login' ? 'Sign In →' : 'Create Account →'}
                </Text>
            }
          </Pressable>

          {/* Sign in with Apple — iOS only, shown when the device supports SIWA.
              Apple requires that any iOS app using third-party social login also
              offer Sign In with Apple as a peer option (App Store guideline 4.8). */}
          {Platform.OS === 'ios' && appleAvailable && (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={
                t.isDark
                  ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                  : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
              }
              cornerRadius={14}
              style={{
                width: '100%',
                height: 50,
                marginBottom: 12,
                opacity: appleLoading ? 0.6 : 1,
              }}
              onPress={handleAppleSignIn}
            />
          )}

          {/* Demo Button */}
          <Pressable
            onPress={handleDemo}
            disabled={demoLoading}
            style={{
              width: '100%',
              alignSelf: 'stretch',
              backgroundColor: 'transparent',
              borderRadius: 14,
              borderWidth: 2,
              borderColor: GREEN,
              paddingVertical: 14,
              paddingHorizontal: 16,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: demoLoading ? 0.85 : 1,
            }}
          >
            {demoLoading
              ? <ActivityIndicator color={GREEN} />
              : <Text style={{
                  color: GREEN,
                  fontWeight: '900',
                  fontSize: 17,
                  letterSpacing: 0.3,
                  textAlign: 'center',
                  textAlignVertical: 'center',
                  includeFontPadding: false,
                }}>
                  🚗 Try Demo Mode
                </Text>
            }
          </Pressable>
        </View>

        <Text style={{ color: MUTED, opacity: 0.55, fontSize: 12, textAlign: 'center', marginTop: 20 }}>
          No credit card required · Free to use
        </Text>
      </ScrollView>

      {/* Forgot-password modal */}
      <Modal visible={showForgot} animationType="fade" transparent onRequestClose={() => setShowForgot(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 }}>
          <View style={{
            backgroundColor: CARD,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: BORDER,
            padding: 22,
          }}>
            <Text style={{ color: TEXT, fontSize: 18, fontWeight: '800', marginBottom: 6 }}>
              Reset your password
            </Text>
            <Text style={{ color: MUTED, fontSize: 13, marginBottom: 16, lineHeight: 18 }}>
              Enter the email on your account. If we find a match, we'll email you a link to reset your password.
            </Text>

            <Text style={{ color: MUTED, fontSize: 12, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>
              Email
            </Text>
            <TextInput
              value={forgotEmail}
              onChangeText={setForgotEmail}
              placeholder="you@example.com"
              placeholderTextColor={MUTED}
              autoCapitalize="none"
              keyboardType="email-address"
              editable={!forgotLoading && !forgotMessage}
              style={{
                backgroundColor: INPUT_BG,
                borderWidth: 1,
                borderColor: BORDER,
                borderRadius: 12,
                paddingHorizontal: 14,
                paddingVertical: 12,
                color: TEXT,
                fontSize: 16,
                marginBottom: 12,
              }}
            />

            {forgotMessage ? (
              <View style={{ backgroundColor: 'rgba(34,197,94,0.12)', borderWidth: 1, borderColor: GREEN, borderRadius: 10, padding: 10, marginBottom: 12 }}>
                <Text style={{ color: GREEN, fontSize: 13, textAlign: 'center' }}>{forgotMessage}</Text>
              </View>
            ) : null}
            {forgotError ? (
              <View style={{ backgroundColor: 'rgba(239,68,68,0.12)', borderWidth: 1, borderColor: '#ef4444', borderRadius: 10, padding: 10, marginBottom: 12 }}>
                <Text style={{ color: '#f87171', fontSize: 13, textAlign: 'center' }}>{forgotError}</Text>
              </View>
            ) : null}

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable
                onPress={() => setShowForgot(false)}
                style={{
                  flex: 1,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: BORDER,
                  paddingVertical: 12,
                  alignItems: 'center',
                  backgroundColor: 'transparent',
                }}
              >
                <Text style={{ color: TEXT, fontWeight: '700', fontSize: 15 }}>
                  {forgotMessage ? 'Done' : 'Cancel'}
                </Text>
              </Pressable>
              {!forgotMessage && (
                <Pressable
                  onPress={submitForgot}
                  disabled={forgotLoading}
                  style={{
                    flex: 1,
                    borderRadius: 12,
                    paddingVertical: 12,
                    alignItems: 'center',
                    backgroundColor: ACCENT,
                    opacity: forgotLoading ? 0.7 : 1,
                  }}
                >
                  {forgotLoading
                    ? <ActivityIndicator color={ON_PRIMARY} />
                    : <Text style={{ color: ON_PRIMARY, fontWeight: '900', fontSize: 15 }}>Send reset link</Text>
                  }
                </Pressable>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}
