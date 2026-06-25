import { View, Text, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSyncStatus } from '@/lib/syncStatus';

// Unobtrusive connection / sync pill pinned just under the status bar. It only
// appears when there is something to say — offline, or queued writes waiting to
// sync — and stays hidden (returns null) when everything is online and synced.
// `pointerEvents="none"` so it never intercepts taps on the dashboard beneath.
export function SyncIndicator() {
  const { online, pending, syncing } = useSyncStatus();
  const insets = useSafeAreaInsets();

  if (online && pending === 0) return null;

  const offline = !online;
  const bg = offline ? '#334155' : '#facc15';
  const fg = offline ? '#e2e8f0' : '#0a0a0a';

  const label = offline
    ? pending > 0
      ? `Offline · ${pending} to sync`
      : 'Offline'
    : syncing
      ? `Syncing ${pending}…`
      : `${pending} to sync`;

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: insets.top + 6,
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 1000,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          backgroundColor: bg,
          paddingHorizontal: 14,
          paddingVertical: 7,
          borderRadius: 999,
          shadowColor: '#000',
          shadowOpacity: 0.25,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 2 },
          elevation: 4,
        }}
      >
        {!offline && syncing && <ActivityIndicator size="small" color={fg} />}
        <Text style={{ color: fg, fontWeight: '700', fontSize: 12 }}>{label}</Text>
      </View>
    </View>
  );
}
