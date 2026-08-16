// Pin the device zone to UTC so tz-bridge tests exercise the real
// account-zone ≠ device-zone path deterministically on any machine.
process.env.TZ = 'UTC';

// Global mock: AsyncStorage's native module doesn't exist under jest-expo's
// node environment, and lib/userTz (imported transitively by estRange /
// chartBuckets / rollupWindow) touches it at module scope. The official jest
// mock keeps values in memory per test file.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
