import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';

const SURFACE = '#111118';
const BORDER = '#1e1e2e';
const ACCENT = '#facc15';
const MUTED = '#4b5563';

function AddTabIcon() {
  return (
    <View
      style={{
        width: 46,
        height: 46,
        borderRadius: 23,
        backgroundColor: ACCENT,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 2,
        shadowColor: ACCENT,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.9,
        shadowRadius: 14,
        elevation: 10,
      }}
    >
      <Ionicons name="add" size={28} color="#000" />
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: SURFACE,
          borderTopColor: BORDER,
          borderTopWidth: 1,
          height: 68,
          paddingBottom: 12,
          paddingTop: 6,
        },
        tabBarActiveTintColor: ACCENT,
        tabBarInactiveTintColor: MUTED,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="speedometer" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          title: 'Log Entry',
          tabBarIcon: () => <AddTabIcon />,
          tabBarLabelStyle: { fontSize: 10, fontWeight: '700', color: ACCENT, marginTop: 2 },
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="list" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
