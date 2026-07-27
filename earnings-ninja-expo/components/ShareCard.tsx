import { forwardRef } from 'react';
import { View, Text, Image, Alert, Platform } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { useTheme } from '../lib/theme';

// Branded, theme-aware share card. Rendered OFF-SCREEN (position absolute far
// off-canvas, collapsable={false} so the native view survives to be captured)
// and snapshotted with react-native-view-shot when the user taps Share. The
// card follows the app theme: Dark mode exports the black + neon look, Light
// mode exports a clean white card that keeps the brand neon accents (per the
// brand rule, accent TEXT on white is black — neon yellow is unreadable there).
//
// NOTE: the card always shows REAL numbers even in Hidden Mode — sharing is a
// deliberate user action (the whole point is showing off the figures), unlike
// shoulder-surfing which Hidden Mode protects against.

const NEON = '#facc15';
const SERIF = Platform.select({ ios: 'Georgia', default: 'serif' });

export type ShareCardData = {
  periodLabel: string;   // e.g. "Today • Jul 25" or "This Month"
  profit: number;        // net (signed)
  revenue: number;       // gross inflows
  expenses: number;      // outflow magnitude
  orders: number;
  miles: number;
  perHour?: number | null;
};

const money = (n: number) => `${n < 0 ? '-' : ''}$${Math.abs(n).toFixed(2)}`;

export const ShareCard = forwardRef<View, { data: ShareCardData }>(({ data }, ref) => {
  const theme = useTheme();
  const isDark = theme.isDark;

  // Per-theme card palette. Dark = brand black + neon; Light = clean white
  // with black text and neon reserved for fills/borders/brand marks.
  const CARD_BG = isDark ? '#0b0b0f' : '#ffffff';
  const CARD_BORDER = isDark ? 'rgba(250,204,21,0.35)' : 'rgba(250,204,21,0.8)';
  const CARD_MUTED = isDark ? '#9aa1af' : '#64748b';
  const TEXT = isDark ? '#ffffff' : '#0f172a';
  const BRAND_TXT = isDark ? NEON : '#000000';       // wordmark + footer brand
  const HEADLINE_POS = isDark ? NEON : '#000000';     // big profit figure
  const DIVIDER = isDark ? 'rgba(255,255,255,0.10)' : '#e8edf2';
  const GREEN = '#22c55e';
  const RED = '#ef4444';

  const pos = data.profit >= 0;
  const stats: { label: string; value: string; color?: string }[] = [
    { label: 'EARNED', value: `$${data.revenue.toFixed(0)}`, color: GREEN },
    { label: 'SPENT', value: `$${Math.abs(data.expenses).toFixed(0)}`, color: RED },
    { label: 'ORDERS', value: `${data.orders}` },
    { label: 'MILES', value: data.miles.toFixed(1) },
    ...(data.perHour != null && isFinite(data.perHour)
      ? [{ label: 'PER HOUR', value: money(data.perHour) }]
      : []),
  ];
  // Editorial layout: two stats per hairline-separated row.
  const statRows: (typeof stats)[] = [];
  for (let i = 0; i < stats.length; i += 2) statRows.push(stats.slice(i, i + 2));
  return (
    <View
      ref={ref}
      collapsable={false}
      style={{
        width: 340,
        backgroundColor: CARD_BG,
        borderRadius: 24,
        borderWidth: 1.5,
        borderColor: CARD_BORDER,
        padding: 24,
        overflow: 'hidden',
      }}
    >
      {/* Brand row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <Image
          source={require('../assets/ninja-logo.png')}
          style={{ width: 34, height: 34, borderRadius: 8 }}
          resizeMode="contain"
        />
        <Text style={{ color: BRAND_TXT, fontSize: 15, fontWeight: '900', letterSpacing: 2 }}>
          EARNINGS NINJA
        </Text>
      </View>

      {/* Period kicker */}
      <Text style={{ color: CARD_MUTED, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 8 }}>
        {data.periodLabel}
      </Text>

      {/* Headline figure */}
      <Text style={{ fontFamily: SERIF, color: TEXT, fontSize: 24, lineHeight: 32 }}>
        {pos ? 'I earned' : 'Net'}
      </Text>
      <Text
        style={{
          fontFamily: SERIF,
          color: pos ? HEADLINE_POS : RED,
          fontSize: 52,
          lineHeight: 60,
          fontWeight: '700',
          marginBottom: 18,
        }}
      >
        {money(data.profit)}
      </Text>

      {/* Stat grid — editorial style: hairlines + serif figures, no boxes,
          matching the Analytics "Editorial Story" design. */}
      <View style={{ borderTopWidth: 1, borderTopColor: DIVIDER }}>
        {statRows.map((row, i) => (
          <View
            key={i}
            style={{
              flexDirection: 'row',
              paddingVertical: 14,
              borderBottomWidth: i < statRows.length - 1 ? 1 : 0,
              borderBottomColor: DIVIDER,
            }}
          >
            {row.map(s => (
              <View key={s.label} style={{ flex: 1 }}>
                <Text style={{ color: CARD_MUTED, fontSize: 10, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 }}>
                  {s.label}
                </Text>
                <Text style={{ fontFamily: SERIF, color: s.color ?? TEXT, fontSize: 24, lineHeight: 30, letterSpacing: -0.5, fontVariant: ['tabular-nums'] }}>
                  {s.value}
                </Text>
              </View>
            ))}
          </View>
        ))}
      </View>

      {/* Footer */}
      <View style={{ marginTop: 20, borderTopWidth: 1, borderTopColor: DIVIDER, paddingTop: 12 }}>
        <Text style={{ color: CARD_MUTED, fontSize: 11 }}>
          Tracked with <Text style={{ color: BRAND_TXT, fontWeight: '800' }}>Earnings Ninja</Text> · earningsninja.com
        </Text>
      </View>
    </View>
  );
});
ShareCard.displayName = 'ShareCard';

// Snapshot the off-screen card and hand the PNG to the OS share sheet.
// Never throws — failures surface as a friendly alert. A module-level
// in-flight lock guards against rapid double-taps launching two overlapping
// share sheets (the second tap is a silent no-op).
let shareInFlight = false;
export async function shareCardImage(ref: React.RefObject<View | null>) {
  if (shareInFlight) return;
  shareInFlight = true;
  try {
    if (!ref.current) throw new Error('Share card not ready');
    const uri = await captureRef(ref, { format: 'png', quality: 1 });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: 'Share your earnings',
        UTI: 'public.png',
      });
    } else {
      Alert.alert('Sharing unavailable', 'Sharing is not available on this device.');
    }
  } catch (e) {
    // User-cancelled share sheets can reject on some platforms — ignore those.
    const msg = e instanceof Error ? e.message : String(e);
    if (!/cancel/i.test(msg)) {
      Alert.alert('Could not share', 'Something went wrong creating your share image. Please try again.');
    }
  } finally {
    shareInFlight = false;
  }
}
