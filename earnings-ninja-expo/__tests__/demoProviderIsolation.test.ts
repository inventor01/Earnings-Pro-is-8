// Provider-level Demo Mode isolation: the Theme and Hidden Mode providers must
// (1) switch to sandbox defaults on demo ENTRY without reading stored values,
// (2) never persist sandbox changes, and (3) restore the REAL stored
// preference on demo EXIT.

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import { createElement } from 'react';
// @ts-expect-error — no bundled types for react-test-renderer in this project
import { create, act } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { enterDemoSession, exitDemoSession } from '../lib/demoSession';
import { ThemeProvider, useThemeControls } from '../lib/theme';
import { HiddenModeProvider, useHiddenMode, HIDDEN_MODE_KEY } from '../lib/hiddenMode';

const flush = () => act(async () => { await Promise.resolve(); });

afterEach(async () => {
  exitDemoSession();
  await AsyncStorage.clear();
});

test('ThemeProvider: demo entry forces sandbox default; exit restores the real pref; demo changes never persist', async () => {
  await AsyncStorage.setItem('theme_name', 'dark'); // real user pref

  let themeApi: any;
  function Probe() { themeApi = useThemeControls(); return null; }
  let tree: any;
  await act(async () => {
    tree = create(createElement(ThemeProvider, null, createElement(Probe)));
  });
  await flush();
  expect(themeApi.themeName).toBe('dark'); // hydrated real pref pre-demo

  await act(async () => { enterDemoSession(); });
  await flush();
  expect(themeApi.themeName).toBe('light'); // sandbox default, not the real 'dark'

  await act(async () => { themeApi.setThemeName('dark'); }); // toggle inside demo
  await flush();
  expect(await AsyncStorage.getItem('theme_name')).toBe('dark'); // unchanged (was already dark)…
  await act(async () => { themeApi.setThemeName('light'); });
  await flush();
  expect(await AsyncStorage.getItem('theme_name')).toBe('dark'); // …and demo writes are dropped

  await act(async () => { exitDemoSession(); });
  await flush();
  expect(themeApi.themeName).toBe('dark'); // real pref restored

  tree.unmount();
});

test('HiddenModeProvider: demo entry unmasks; toggles never persist; exit restores the real pref', async () => {
  await AsyncStorage.setItem(HIDDEN_MODE_KEY, '1'); // real user hides earnings

  let hm: any;
  function Probe() { hm = useHiddenMode(); return null; }
  let tree: any;
  await act(async () => {
    tree = create(createElement(HiddenModeProvider, null, createElement(Probe)));
  });
  await flush();
  expect(hm.hidden).toBe(true); // real pref hydrated pre-demo

  await act(async () => { enterDemoSession(); });
  await flush();
  expect(hm.hidden).toBe(false); // sandbox default: unmasked sample data

  await act(async () => { hm.toggle(); }); // demo user flips it on
  await flush();
  expect(hm.hidden).toBe(true);
  expect(await AsyncStorage.getItem(HIDDEN_MODE_KEY)).toBe('1'); // real key untouched by demo toggle
  await act(async () => { hm.setHidden(false); });
  await flush();
  expect(await AsyncStorage.getItem(HIDDEN_MODE_KEY)).toBe('1'); // still untouched

  await act(async () => { exitDemoSession(); });
  await flush();
  expect(hm.hidden).toBe(true); // real pref restored

  tree.unmount();
});
