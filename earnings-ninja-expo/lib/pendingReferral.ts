import AsyncStorage from '@react-native-async-storage/async-storage';

// A referral code captured from a deep link (earningsninja://referral/CODE)
// before the user has an account. It's stashed here so the signup screen can
// prefill it, then cleared once consumed. Best-effort: storage failures never
// surface to the user.
const PENDING_REFERRAL_KEY = 'pending_referral_code_v1';

export async function setPendingReferral(code: string): Promise<void> {
  try {
    const trimmed = (code || '').trim().toUpperCase();
    if (trimmed) await AsyncStorage.setItem(PENDING_REFERRAL_KEY, trimmed);
  } catch {
    // ignore
  }
}

export async function getPendingReferral(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(PENDING_REFERRAL_KEY);
  } catch {
    return null;
  }
}

export async function clearPendingReferral(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PENDING_REFERRAL_KEY);
  } catch {
    // ignore
  }
}
