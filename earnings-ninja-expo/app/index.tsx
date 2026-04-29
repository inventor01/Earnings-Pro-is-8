import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';

const WEB_APP_URL =
  process.env.EXPO_PUBLIC_API_BASE ||
  (Constants.expoConfig?.extra?.apiBase as string | undefined) ||
  'https://b21ea173-8d4d-4445-a8db-6d8c912d7dc4-00-l5lnc6lhje6p.picard.replit.dev';

export default function App() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <WebView
        source={{ uri: WEB_APP_URL }}
        style={styles.webview}
        startInLoadingState
        renderLoading={() => (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color="#eab308" />
          </View>
        )}
        allowsBackForwardNavigationGestures
        pullToRefreshEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled
        domStorageEnabled
        cacheEnabled
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        originWhitelist={['*']}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  webview: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  loading: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a',
  },
});
