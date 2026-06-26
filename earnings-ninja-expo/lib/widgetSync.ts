// Pushes the data the iOS widget needs into the App Group's shared
// UserDefaults, then asks WidgetKit to repaint.
//
// Keys mirror the ones read by `targets/widget/EarningsWidget.swift`:
//   - auth_token    (Bearer token; gates the "Sign in" placeholder)
//   - api_base      (e.g. "https://...replit.dev")
//   - today_profit  (string-encoded number; positive = green, negative = red)
//   - today_revenue (string-encoded number; today's gross revenue)
//   - theme         ("dark" | "light")
//
// The widget is display-only — a tap opens the app at the entry-logger route;
// it never writes data itself.
//
// All operations are no-ops on Android / Expo Go — `WidgetBridge.isAvailable()`
// returns false there.

import { WidgetBridge } from '../modules/widget-bridge';
import { API_BASE as apiBase } from './api';

// Reuse the exact same API_BASE the JS app uses so the widget can never
// drift to a different backend than the main app (env-first → app.json
// extra → dev fallback). See lib/api.ts for the resolution order.

export const widgetSync = {
  isAvailable: () => WidgetBridge.isAvailable(),

  /** Call after a successful login. The widget refuses to send a bearer
   *  token to a cleartext URL, so we don't even push it for non-HTTPS bases. */
  async onLogin(token: string) {
    if (!WidgetBridge.isAvailable()) return;
    if (!apiBase.toLowerCase().startsWith('https://')) {
      // Local dev / non-HTTPS — keep widget in "Sign in" placeholder state.
      WidgetBridge.setItem('auth_token', null);
      WidgetBridge.setItem('api_base', null);
      WidgetBridge.reloadAllTimelines();
      return;
    }
    WidgetBridge.setItem('auth_token', token);
    WidgetBridge.setItem('api_base', apiBase);
    WidgetBridge.reloadAllTimelines();
  },

  /** Call after logout. Clears credentials so the widget falls back to its
   *  "Sign in to Earnings Ninja" placeholder. */
  async onLogout() {
    if (!WidgetBridge.isAvailable()) return;
    WidgetBridge.setItem('auth_token', null);
    WidgetBridge.setItem('today_profit', null);
    WidgetBridge.setItem('today_revenue', null);
    WidgetBridge.reloadAllTimelines();
  },

  /** Call after the dashboard rollup refreshes. `profit` is today's net. */
  async pushProfit(profit: number) {
    if (!WidgetBridge.isAvailable()) return;
    WidgetBridge.setItem('today_profit', profit.toFixed(2));
    WidgetBridge.reloadAllTimelines();
  },

  /** Call after the dashboard rollup refreshes. `revenue` is today's gross
   *  revenue (before expenses) — shown on the Lock Screen mini-dashboard. */
  async pushRevenue(revenue: number) {
    if (!WidgetBridge.isAvailable()) return;
    WidgetBridge.setItem('today_revenue', revenue.toFixed(2));
    WidgetBridge.reloadAllTimelines();
  },

  /** Call after login and whenever the user switches Dark/Light so the Home
   *  Screen widget can match the app's appearance. (Lock Screen accessory
   *  widgets are rendered monochrome/tinted by iOS regardless of this value.) */
  async pushTheme(name: 'dark' | 'light') {
    if (!WidgetBridge.isAvailable()) return;
    WidgetBridge.setItem('theme', name);
    WidgetBridge.reloadAllTimelines();
  },
};
