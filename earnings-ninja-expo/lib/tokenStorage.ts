import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'auth_token';

const isNative = Platform.OS === 'ios' || Platform.OS === 'android';

export async function getToken(): Promise<string | null> {
  if (isNative) {
    const t = await SecureStore.getItemAsync(KEY);
    if (t) return t;
    const legacy = await AsyncStorage.getItem(KEY);
    if (legacy) {
      await SecureStore.setItemAsync(KEY, legacy);
      await AsyncStorage.removeItem(KEY);
      return legacy;
    }
    return null;
  }
  return AsyncStorage.getItem(KEY);
}

export async function setToken(token: string): Promise<void> {
  if (isNative) {
    await SecureStore.setItemAsync(KEY, token);
    await AsyncStorage.removeItem(KEY).catch(() => {});
    return;
  }
  await AsyncStorage.setItem(KEY, token);
}

export async function clearToken(): Promise<void> {
  if (isNative) {
    await SecureStore.deleteItemAsync(KEY).catch(() => {});
    await AsyncStorage.removeItem(KEY).catch(() => {});
    return;
  }
  await AsyncStorage.removeItem(KEY);
}
