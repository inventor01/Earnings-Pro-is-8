import { View, ActivityIndicator } from 'react-native';

export default function Index() {
  return (
    <View style={{ flex: 1, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="large" color="#facc15" />
    </View>
  );
}
