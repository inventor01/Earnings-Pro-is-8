import { useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet,
  ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/authContext';
import { api } from '@/lib/api';
import { colors } from '@/constants/colors';

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
      let data;
      if (mode === 'login') {
        data = await api.login(credential, password);
      } else {
        data = await api.signup(credential, password, username);
      }
      await login(data.access_token);
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
      const data = await api.demo();
      await login(data.access_token);
    } catch (e: any) {
      setError(e.message || 'Failed to start demo');
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.ninja}>🥷</Text>
          <Text style={styles.title}>Earnings Ninja</Text>
          <Text style={styles.subtitle}>Track every dollar you earn</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.tabRow}>
            <Pressable
              style={[styles.tab, mode === 'login' && styles.tabActive]}
              onPress={() => { setMode('login'); setError(''); }}
            >
              <Text style={[styles.tabText, mode === 'login' && styles.tabTextActive]}>Log In</Text>
            </Pressable>
            <Pressable
              style={[styles.tab, mode === 'signup' && styles.tabActive]}
              onPress={() => { setMode('signup'); setError(''); }}
            >
              <Text style={[styles.tabText, mode === 'signup' && styles.tabTextActive]}>Sign Up</Text>
            </Pressable>
          </View>

          <TextInput
            style={styles.input}
            placeholder="Email or username"
            placeholderTextColor={colors.textMuted}
            value={credential}
            onChangeText={setCredential}
            autoCapitalize="none"
            keyboardType="email-address"
            autoCorrect={false}
          />

          {mode === 'signup' && (
            <TextInput
              style={styles.input}
              placeholder="Username"
              placeholderTextColor={colors.textMuted}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
            />
          )}

          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={colors.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            style={[styles.btn, styles.btnPrimary]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color={colors.black} />
              : <Text style={styles.btnPrimaryText}>{mode === 'login' ? 'Log In' : 'Create Account'}</Text>
            }
          </Pressable>

          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.divider} />
          </View>

          <Pressable
            style={[styles.btn, styles.btnSecondary]}
            onPress={handleDemo}
            disabled={demoLoading}
          >
            {demoLoading
              ? <ActivityIndicator color={colors.textPrimary} />
              : <Text style={styles.btnSecondaryText}>Try Demo Mode</Text>
            }
          </Pressable>

          <Text style={styles.demoHint}>No account needed — explore with sample data</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 20,
    justifyContent: 'center',
    gap: 24,
  },
  header: {
    alignItems: 'center',
    gap: 6,
  },
  ninja: { fontSize: 60 },
  title: {
    fontSize: 30,
    fontFamily: 'Inter_700Bold',
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: 3,
    marginBottom: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: { backgroundColor: colors.accent },
  tabText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: colors.textSecondary,
  },
  tabTextActive: { color: colors.black },
  input: {
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  error: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: colors.red,
    textAlign: 'center',
  },
  btn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  btnPrimary: { backgroundColor: colors.accent },
  btnPrimaryText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
    color: colors.black,
  },
  btnSecondary: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnSecondaryText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: colors.textPrimary,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: colors.textMuted,
  },
  demoHint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
