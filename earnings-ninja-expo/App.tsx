import { useRef, useState } from 'react';
import { StyleSheet, View, ActivityIndicator, BackHandler, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync();

const APP_URL = 'https://earnings-pro-is-8-production.up.railway.app';

export default function App() {
  const webViewRef = useRef<WebView>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const handleAndroidBack = () => {
    if (canGoBack && webViewRef.current) {
      webViewRef.current.goBack();
      return true;
    }
    return false;
  };

  if (Platform.OS === 'android') {
    BackHandler.addEventListener('hardwareBackPress', handleAndroidBack);
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" backgroundColor="#0f172a" />
      <WebView
        ref={webViewRef}
        source={{ uri: APP_URL }}
        style={styles.webview}
        onNavigationStateChange={(state) => setCanGoBack(state.canGoBack)}
        onLoadStart={() => setIsLoading(true)}
        onLoadEnd={() => {
          setIsLoading(false);
          SplashScreen.hideAsync();
        }}
        onError={() => SplashScreen.hideAsync()}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        allowsBackForwardNavigationGestures={true}
        pullToRefreshEnabled={true}
        bounces={false}
        startInLoadingState={false}
        scalesPageToFit={false}
        mixedContentMode="always"
        userAgent="EarningsNinja/1.0 (Mobile)"
        injectedJavaScript={`
          (function() {
            // Prevent zoom on input focus
            const meta = document.querySelector('meta[name="viewport"]');
            if (meta) {
              meta.setAttribute('content',
                'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover'
              );
            }
            // Hide PWA install banner since we are in native app
            window.addEventListener('beforeinstallprompt', function(e) {
              e.preventDefault();
            });
          })();
          true;
        `}
      />
      {isLoading && (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#facc15" />
        </View>
      )}
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
  loader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f172a',
  },
});
