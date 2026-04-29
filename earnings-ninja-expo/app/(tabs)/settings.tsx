import { useState } from 'react';
import {
  View, Text, ScrollView, Pressable,
  TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api, TimeframeType } from '@/lib/api';
import { useAuth } from '@/lib/authContext';
import * as Haptics from 'expo-haptics';

const BG = '#0a0a0f';
const SURFACE = '#111118';
const CARD = '#16161f';
const BORDER = '#1e1e2e';
const ACCENT = '#facc15';
const GREEN = '#22c55e';
const RED = '#ef4444';
const TEXT = '#f1f5f9';
const MUTED = '#94a3b8';
const DIM = '#4b5563';

type GoalTF = { key: TimeframeType; label: string; emoji: string; desc: string };

const GOAL_TFS: GoalTF[] = [
  { key: 'TODAY', label: 'Daily Goal', emoji: '☀️', desc: 'How much you want to earn today' },
  { key: 'THIS_WEEK', label: 'Weekly Goal', emoji: '📅', desc: 'Your target earnings for this week' },
  { key: 'THIS_MONTH', label: 'Monthly Goal', emoji: '🗓️', desc: 'Your monthly earnings target' },
];

function GoalCard({ tf }: { tf: GoalTF }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState('');

  const { data: goal, isLoading } = useQuery({
    queryKey: ['goal', tf.key],
    queryFn: () => api.getGoal(tf.key),
  });

  const setGoalMutation = useMutation({
    mutationFn: ({ timeframe, target }: { timeframe: TimeframeType; target: number }) =>
      api.upsertGoal(timeframe, target),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goal'] });
      setEditing(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const handleSave = () => {
    const val = parseFloat(input);
    if (!val || val <= 0) {
      Alert.alert('Invalid amount', 'Please enter a valid goal amount.');
      return;
    }
    setGoalMutation.mutate({ timeframe: tf.key, target: val });
  };

  return (
    <View style={{
      backgroundColor: CARD,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: BORDER,
      padding: 16,
      shadowColor: ACCENT,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      marginBottom: 12,
    }}>
      {/* Top accent bar */}
      <View style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        height: 2, backgroundColor: ACCENT,
        borderTopLeftRadius: 16, borderTopRightRadius: 16, opacity: 0.5,
      }} />

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 20 }}>{tf.emoji}</Text>
          <View>
            <Text style={{ color: TEXT, fontSize: 15, fontWeight: '800' }}>{tf.label}</Text>
            <Text style={{ color: MUTED, fontSize: 11, marginTop: 1 }}>{tf.desc}</Text>
          </View>
        </View>
        {isLoading ? (
          <ActivityIndicator color={ACCENT} size="small" />
        ) : (
          <Text style={{
            color: ACCENT,
            fontSize: 22,
            fontWeight: '900',
            fontVariant: ['tabular-nums'],
            textShadowColor: ACCENT,
            textShadowOffset: { width: 0, height: 0 },
            textShadowRadius: 8,
          }}>
            {goal ? `$${goal.target_profit.toFixed(0)}` : 'Not set'}
          </Text>
        )}
      </View>

      {editing ? (
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Enter goal amount..."
            placeholderTextColor={DIM}
            keyboardType="decimal-pad"
            autoFocus
            style={{
              flex: 1,
              backgroundColor: SURFACE,
              borderWidth: 1.5,
              borderColor: ACCENT,
              borderRadius: 12,
              paddingHorizontal: 14,
              paddingVertical: 12,
              color: TEXT,
              fontSize: 16,
              fontWeight: '700',
            }}
          />
          <Pressable
            onPress={handleSave}
            disabled={setGoalMutation.isPending}
            style={{
              backgroundColor: ACCENT,
              borderRadius: 12,
              paddingHorizontal: 18,
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: ACCENT,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.5,
              shadowRadius: 8,
            }}
          >
            {setGoalMutation.isPending
              ? <ActivityIndicator color="#000" size="small" />
              : <Text style={{ color: '#000', fontWeight: '900', fontSize: 15 }}>Save</Text>
            }
          </Pressable>
          <Pressable
            onPress={() => setEditing(false)}
            style={{
              backgroundColor: CARD,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: BORDER,
              paddingHorizontal: 14,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: MUTED, fontWeight: '700', fontSize: 15 }}>Cancel</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          onPress={() => { setInput(goal?.target_profit?.toString() ?? ''); setEditing(true); }}
          style={{
            marginTop: 10,
            backgroundColor: SURFACE,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: BORDER,
            paddingVertical: 10,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: MUTED, fontSize: 13, fontWeight: '700' }}>
            {goal ? '✏️ Edit Goal' : '+ Set Goal'}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

function CostPerMileCard() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState('');

  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: api.getSettings,
  });

  const updateMutation = useMutation({
    mutationFn: (cost: number) => api.updateSettings({ cost_per_mile: cost }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      setEditing(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  return (
    <View style={{
      backgroundColor: CARD,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: BORDER,
      padding: 16,
      marginBottom: 12,
    }}>
      <View style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        height: 2, backgroundColor: '#a855f7',
        borderTopLeftRadius: 16, borderTopRightRadius: 16, opacity: 0.5,
      }} />

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 20 }}>🚗</Text>
          <View>
            <Text style={{ color: TEXT, fontSize: 15, fontWeight: '800' }}>Cost Per Mile</Text>
            <Text style={{ color: MUTED, fontSize: 11, marginTop: 1 }}>Vehicle cost used in profit calc</Text>
          </View>
        </View>
        <Text style={{ color: '#a855f7', fontSize: 22, fontWeight: '900', fontVariant: ['tabular-nums'] }}>
          ${profile?.cost_per_mile?.toFixed(3) ?? '0.670'}
        </Text>
      </View>

      {editing ? (
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="e.g. 0.67"
            placeholderTextColor={DIM}
            keyboardType="decimal-pad"
            autoFocus
            style={{
              flex: 1,
              backgroundColor: SURFACE,
              borderWidth: 1.5,
              borderColor: '#a855f7',
              borderRadius: 12,
              paddingHorizontal: 14,
              paddingVertical: 12,
              color: TEXT,
              fontSize: 16,
              fontWeight: '700',
            }}
          />
          <Pressable
            onPress={() => {
              const val = parseFloat(input);
              if (!val || val <= 0) { Alert.alert('Invalid', 'Enter a valid cost per mile.'); return; }
              updateMutation.mutate(val);
            }}
            disabled={updateMutation.isPending}
            style={{
              backgroundColor: '#a855f7',
              borderRadius: 12,
              paddingHorizontal: 18,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {updateMutation.isPending
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={{ color: '#fff', fontWeight: '900', fontSize: 15 }}>Save</Text>
            }
          </Pressable>
          <Pressable
            onPress={() => setEditing(false)}
            style={{
              backgroundColor: CARD,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: BORDER,
              paddingHorizontal: 14,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: MUTED, fontWeight: '700', fontSize: 15 }}>✕</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          onPress={() => { setInput(profile?.cost_per_mile?.toString() ?? '0.67'); setEditing(true); }}
          style={{
            marginTop: 10,
            backgroundColor: SURFACE,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: BORDER,
            paddingVertical: 10,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: MUTED, fontSize: 13, fontWeight: '700' }}>✏️ Edit Rate</Text>
        </Pressable>
      )}
    </View>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { logout, user } = useAuth();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: BG }}
      contentContainerStyle={{ paddingBottom: insets.bottom + 30 }}
    >
      {/* Header */}
      <View style={{
        paddingTop: insets.top + 12,
        paddingHorizontal: 14,
        paddingBottom: 16,
        backgroundColor: SURFACE,
        borderBottomWidth: 1,
        borderBottomColor: BORDER,
      }}>
        <Text style={{
          color: ACCENT,
          fontSize: 22,
          fontWeight: '900',
          textShadowColor: ACCENT,
          textShadowOffset: { width: 0, height: 0 },
          textShadowRadius: 8,
        }}>
          Settings
        </Text>
        <Text style={{ color: MUTED, fontSize: 13, marginTop: 2 }}>
          Goals, preferences & account
        </Text>
      </View>

      <View style={{ padding: 14, gap: 0 }}>
        {/* Account Card */}
        <View style={{
          backgroundColor: CARD,
          borderRadius: 16,
          borderWidth: 1.5,
          borderColor: BORDER,
          padding: 16,
          marginBottom: 20,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
        }}>
          <View style={{
            width: 52,
            height: 52,
            borderRadius: 26,
            backgroundColor: ACCENT + '22',
            borderWidth: 2,
            borderColor: ACCENT,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Text style={{ fontSize: 24 }}>🥷</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: TEXT, fontSize: 16, fontWeight: '800' }}>{user?.username || 'Driver'}</Text>
            <Text style={{ color: MUTED, fontSize: 12, marginTop: 2 }}>{user?.email || ''}</Text>
          </View>
          <Pressable
            onPress={() => {
              Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Sign Out', style: 'destructive', onPress: logout },
              ]);
            }}
            style={{
              backgroundColor: RED + '22',
              borderWidth: 1,
              borderColor: RED,
              borderRadius: 10,
              paddingHorizontal: 14,
              paddingVertical: 8,
            }}
          >
            <Text style={{ color: RED, fontWeight: '800', fontSize: 13 }}>Sign Out</Text>
          </Pressable>
        </View>

        {/* Section: Profit Goals */}
        <View style={{ marginBottom: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Ionicons name="trophy" size={18} color={ACCENT} />
            <Text style={{
              color: ACCENT,
              fontSize: 14,
              fontWeight: '900',
              textTransform: 'uppercase',
              letterSpacing: 1.5,
            }}>
              Profit Goals
            </Text>
          </View>
          {GOAL_TFS.map((tf) => (
            <GoalCard key={tf.key} tf={tf} />
          ))}
        </View>

        {/* Section: Vehicle */}
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14, marginTop: 4 }}>
            <Ionicons name="car" size={18} color="#a855f7" />
            <Text style={{
              color: '#a855f7',
              fontSize: 14,
              fontWeight: '900',
              textTransform: 'uppercase',
              letterSpacing: 1.5,
            }}>
              Vehicle Costs
            </Text>
          </View>
          <CostPerMileCard />
        </View>

        {/* App Info */}
        <View style={{ alignItems: 'center', marginTop: 20, gap: 4 }}>
          <Text style={{ fontSize: 28 }}>🥷</Text>
          <Text style={{ color: DIM, fontSize: 12 }}>Earnings Ninja v1.0</Text>
          <Text style={{ color: '#1e1e2e', fontSize: 11 }}>Made for gig drivers</Text>
        </View>
      </View>
    </ScrollView>
  );
}
