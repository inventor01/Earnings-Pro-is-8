import { useState } from 'react';
import {
  View, Text, TextInput, Pressable,
  ScrollView, ActivityIndicator, KeyboardAvoidingView,
  Platform, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/authContext';
import { api } from '@/lib/api';

const BG = '#0a0a0f';
const CARD = '#111118';
const BORDER = '#1e1e2e';
const ACCENT = '#facc15';
const GREEN = '#22c55e';
const TEXT = '#f1f5f9';
const MUTED = '#94a3b8';
const INPUT_BG = '#16161f';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { login } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [credential, setCredential] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [error, setError] = useState('');

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
            backgroundColor: '#0a0a0f',
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
                  color: mode === m ? '#000' : MUTED,
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
                placeholderTextColor="#4b5563"
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
              placeholderTextColor="#4b5563"
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

          <View style={{ marginBottom: 20 }}>
            <Text style={{ color: MUTED, fontSize: 12, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor="#4b5563"
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

          {/* Submit Button — full-width, solid yellow.
              NOTE: object-style `style` (not the `({pressed})=>...` function form) —
              the function form was being dropped by RN here, leaving the button
              rendering as plain text on a transparent background. */}
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
              ? <ActivityIndicator color="#000" />
              : <Text style={{
                  color: '#000',
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

          {/* Demo Button — full-width, green outline only (transparent fill). */}
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

        <Text style={{ color: '#374151', fontSize: 12, textAlign: 'center', marginTop: 20 }}>
          No credit card required · Free to use
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
