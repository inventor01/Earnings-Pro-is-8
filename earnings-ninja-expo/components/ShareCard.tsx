import { forwardRef } from 'react';
import { View, Text, Image, Alert, Platform } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';

// Branded, always-dark share card. Rendered OFF-SCREEN (position absolute far
// off-canvas, collapsable={false} so the native view survives to be captured)
// and snapshotted with react-native-view-shot when the user taps Share. The
// card intentionally ignores the app theme: the exported image is the brand
// (black + neon #facc15), matching the logo, regardless of Light/Dark mode.
//
// NOTE: the card always shows REAL numbers even in Hidden Mode — sharing is a
// deliberate user action (the whole point is showing off the figures), unlike
// shoulder-surfing which Hidden Mode protects against.

const NEON = '#facc15';
const CARD_BG = '#0b0b0f';
const CARD_SURFACE = '#15151c';
const CARD_BORDER = 'rgba(250,204,21,0.35)';
const CARD_MUTED = '#9aa1af';
const GREEN = '#22c55e';
const RED = '#ef4444';

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
        <Text style={{ color: NEON, fontSize: 15, fontWeight: '900', letterSpacing: 2 }}>
          EARNINGS NINJA
        </Text>
      </View>

      {/* Period kicker */}
      <Text style={{ color: CARD_MUTED, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 8 }}>
        {data.periodLabel}
      </Text>

      {/* Headline figure */}
      <Text style={{ fontFamily: SERIF, color: '#ffffff', fontSize: 24, lineHeight: 32 }}>
        {pos ? 'I earned' : 'Net'}
      </Text>
      <Text
        style={{
          fontFamily: SERIF,
          color: pos ? NEON : RED,
          fontSize: 52,
          lineHeight: 60,
          fontWeight: '700',
          marginBottom: 18,
        }}
      >
        {money(data.profit)}
      </Text>

      {/* Stat grid */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {stats.map(s => (
          <View
            key={s.label}
            style={{
              backgroundColor: CARD_SURFACE,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.10)',
              paddingVertical: 10,
              paddingHorizontal: 14,
              minWidth: 88,
              flexGrow: 1,
            }}
          >
            <Text style={{ color: s.color ?? '#ffffff', fontSize: 17, fontWeight: '800', fontVariant: ['tabular-nums'] }}>
              {s.value}
            </Text>
            <Text style={{ color: CARD_MUTED, fontSize: 9, fontWeight: '700', letterSpacing: 1.2, marginTop: 2 }}>
              {s.label}
            </Text>
          </View>
        ))}
      </View>

      {/* Footer */}
      <View style={{ marginTop: 20, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.10)', paddingTop: 12 }}>
        <Text style={{ color: CARD_MUTED, fontSize: 11 }}>
          Tracked with <Text style={{ color: NEON, fontWeight: '800' }}>Earnings Ninja</Text> · earningsninja.com
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
