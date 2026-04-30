import { requireNativeModule, NativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

interface WidgetBridgeModule extends NativeModule {
  appGroupId: string;
  setItem(key: string, value: string | null): boolean;
  getItem(key: string): string | null;
  reloadAllTimelines(): void;
}

// Lazily resolve the native module so `import` doesn't crash on web / Android
// where the module isn't autolinked.
let _native: WidgetBridgeModule | null = null;
function native(): WidgetBridgeModule | null {
  if (Platform.OS !== 'ios') return null;
  if (_native) return _native;
  try {
    _native = requireNativeModule<WidgetBridgeModule>('WidgetBridge');
    return _native;
  } catch {
    return null;
  }
}

export const WidgetBridge = {
  /** App Group identifier shared between the main app and the widget extension. */
  appGroupId: 'group.com.earningsninja.shared',

  /** Returns true on iOS dev builds where the native module is linked. */
  isAvailable(): boolean {
    return native() !== null;
  },

  /** Write a string (or clear it with `null`) to the shared App Group UserDefaults. */
  setItem(key: string, value: string | null): void {
    native()?.setItem(key, value);
  },

  /** Read a string from the shared App Group UserDefaults. */
  getItem(key: string): string | null {
    return native()?.getItem(key) ?? null;
  },

  /** Tell WidgetKit to refetch every widget timeline immediately. */
  reloadAllTimelines(): void {
    native()?.reloadAllTimelines();
  },
};
