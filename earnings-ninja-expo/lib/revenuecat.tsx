import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Purchases, {
  LOG_LEVEL,
  type CustomerInfo,
  type PurchasesOffering,
  type PurchasesPackage,
} from 'react-native-purchases';
import { useTheme } from './theme';
import { useAuth } from './authContext';
import { API_BASE } from './api';

// The RevenueCat entitlement that unlocks premium features (CSV export +
// advanced analytics). Display name in the RevenueCat dashboard is
// "Earnings Ninja Pro"; the identifier MUST match what is provisioned there.
export const PRO_ENTITLEMENT_ID = 'pro';

// Public SDK API keys are SAFE to embed in the client binary — they are NOT
// secrets. The test-store key works in dev / preview builds without any App
// Store Connect product setup. For production, set
// EXPO_PUBLIC_REVENUECAT_IOS_API_KEY to your `appl_…` App Store key
// (see eas.json env / replit.md "RevenueCat" notes).
const DEFAULT_IOS_KEY = 'test_mUgMNBKbqbDktGCrdaLqZnuVRTB';

function resolveApiKey(): string {
  if (Platform.OS === 'android') {
    return process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY ?? '';
  }
  return process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY ?? DEFAULT_IOS_KEY;
}

function isEntitled(info: CustomerInfo | null): boolean {
  return !!info && info.entitlements.active[PRO_ENTITLEMENT_ID] !== undefined;
}

/**
 * Open the OS-native subscription management screen. Used as a fallback when
 * the RevenueCat Customer Center can't open (not configured in the dashboard,
 * or the native module is absent) so "Manage Subscription" is never a dead end.
 */
async function openNativeSubscriptions(): Promise<void> {
  if (Platform.OS === 'ios') {
    // The `itms-apps://` scheme opens the App Store app's native "Manage
    // Subscriptions" screen directly. The `https://` form can instead open
    // Safari to a page that fails to load, which is why the button "opened a
    // page that failed". Try the native scheme first, then fall back to https.
    try {
      await Linking.openURL('itms-apps://apps.apple.com/account/subscriptions');
      return;
    } catch {
      try {
        await Linking.openURL('https://apps.apple.com/account/subscriptions');
      } catch {
        // no-op
      }
    }
    return;
  }
  try {
    await Linking.openURL('https://play.google.com/store/account/subscriptions');
  } catch {
    // no-op
  }
}

interface SubscriptionContextValue {
  /** True when RevenueCat is available on this build (native module present). */
  available: boolean;
  /** True when the user currently owns the "pro" entitlement. */
  isPro: boolean;
  customerInfo: CustomerInfo | null;
  /** The current offering (its packages drive the fallback paywall). */
  offerings: PurchasesOffering | null;
  loading: boolean;
  /** Re-fetch customer info + offerings from RevenueCat. */
  refresh: () => Promise<void>;
  /**
   * Ensure the user is Pro. Returns true immediately if already Pro (or if
   * RevenueCat is unavailable on this build, so gating is disabled and
   * features stay usable). Otherwise presents the paywall and resolves to
   * whether the user became Pro.
   */
  requirePro: () => Promise<boolean>;
  /** Present the paywall regardless of entitlement. Resolves to isPro after. */
  presentPaywall: () => Promise<boolean>;
  /** Present the RevenueCat Customer Center (manage / cancel subscription). */
  presentCustomerCenter: () => Promise<void>;
  /** Restore previous purchases. Resolves to whether the user is Pro after. */
  restore: () => Promise<boolean>;
}

const SubscriptionContext = createContext<SubscriptionContextValue>({
  available: false,
  isPro: false,
  customerInfo: null,
  offerings: null,
  loading: true,
  refresh: async () => {},
  requirePro: async () => true,
  presentPaywall: async () => false,
  presentCustomerCenter: async () => {},
  restore: async () => false,
});

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [available, setAvailable] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [offerings, setOfferings] = useState<PurchasesOffering | null>(null);
  const [loading, setLoading] = useState(true);

  const isPro = isEntitled(customerInfo);
  const isProRef = useRef(isPro);
  isProRef.current = isPro;
  const offeringRef = useRef<PurchasesOffering | null>(null);
  offeringRef.current = offerings;
  const availableRef = useRef(false);
  // Resolves once the one-shot init (configure + first fetch) settles, so the
  // gate can wait it out instead of failing open during the startup window.
  const initPromiseRef = useRef<Promise<void> | null>(null);

  // ── Custom fallback paywall (used when no dashboard paywall is published) ──
  const [fallbackVisible, setFallbackVisible] = useState(false);
  const fallbackResolver = useRef<((becamePro: boolean) => void) | null>(null);

  const refresh = useCallback(async () => {
    if (!availableRef.current) return;
    try {
      const [info, offs] = await Promise.all([
        Purchases.getCustomerInfo(),
        Purchases.getOfferings(),
      ]);
      setCustomerInfo(info);
      setOfferings(offs.current ?? null);
    } catch {
      // best-effort
    }
  }, []);

  useEffect(() => {
    let listener: ((info: CustomerInfo) => void) | null = null;
    initPromiseRef.current = (async () => {
      const apiKey = resolveApiKey();
      if ((Platform.OS !== 'ios' && Platform.OS !== 'android') || !apiKey) {
        setAvailable(false);
        setLoading(false);
        return;
      }
      try {
        if (__DEV__) {
          try {
            await Purchases.setLogLevel(LOG_LEVEL.DEBUG);
          } catch {
            // ignore
          }
        }
        Purchases.configure({ apiKey });
        listener = (info: CustomerInfo) => setCustomerInfo(info);
        Purchases.addCustomerInfoUpdateListener(listener);
        const [info, offs] = await Promise.all([
          Purchases.getCustomerInfo(),
          Purchases.getOfferings(),
        ]);
        setCustomerInfo(info);
        setOfferings(offs.current ?? null);
        availableRef.current = true;
        setAvailable(true);
      } catch {
        // Native module missing (pre-native build) or config failure: leave
        // RevenueCat disabled so premium features stay UNGATED (no regression
        // for installs that predate the native build).
        availableRef.current = false;
        setAvailable(false);
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      if (listener) {
        try {
          Purchases.removeCustomerInfoUpdateListener(listener);
        } catch {
          // ignore
        }
      }
    };
  }, []);

  // Identify the RevenueCat customer with our backend user id. This is what
  // lets server-side promotional grants (referral free months) land on the
  // RIGHT customer — without it the SDK uses an anonymous app_user_id the
  // backend has no way to address. logIn/logOut are best-effort and no-op
  // when RevenueCat isn't available on this build. `rcIdentityRef` dedupes
  // so we don't re-issue logIn for the same id (or logOut while anonymous).
  const rcIdentityRef = useRef<string | null>(null);
  useEffect(() => {
    if (!available) return;
    const uid = user?.id ?? null;
    (async () => {
      try {
        if (uid) {
          if (rcIdentityRef.current === uid) return;
          const { customerInfo: info } = await Purchases.logIn(uid);
          rcIdentityRef.current = uid;
          setCustomerInfo(info);
        } else if (rcIdentityRef.current !== null) {
          // Only log out if we previously identified a user (avoids the SDK
          // "already anonymous" warning on first launch / logged-out state).
          // logOut resolves to the (now anonymous) CustomerInfo directly.
          const info = await Purchases.logOut();
          rcIdentityRef.current = null;
          setCustomerInfo(info);
        }
      } catch {
        // best-effort: identity sync never blocks the UI
      }
    })();
  }, [available, user?.id]);

  const openFallback = useCallback((): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      const present = (off: PurchasesOffering | null) => {
        if (!off || off.availablePackages.length === 0) {
          // Truly nothing to sell — surface it instead of a dead button.
          Alert.alert(
            'Subscriptions unavailable',
            'We couldn’t load the upgrade options right now. Please check your connection and try again.',
          );
          resolve(false);
          return;
        }
        fallbackResolver.current = resolve;
        setFallbackVisible(true);
      };

      const existing = offeringRef.current;
      if (existing && existing.availablePackages.length > 0) {
        present(existing);
        return;
      }

      // Offering not loaded yet (startup race, or no "current" offering set in
      // the dashboard). Wait for init, then fetch fresh and fall back to any
      // non-empty offering so the paywall still opens.
      (async () => {
        try {
          if (initPromiseRef.current) {
            try { await initPromiseRef.current; } catch { /* best-effort */ }
          }
          let off = offeringRef.current;
          if (!off || off.availablePackages.length === 0) {
            const offs = await Purchases.getOfferings();
            off =
              offs.current ??
              Object.values(offs.all).find((o) => o.availablePackages.length > 0) ??
              null;
            if (off) setOfferings(off);
          }
          present(off);
        } catch {
          present(null);
        }
      })();
    });
  }, []);

  const closeFallback = useCallback((becamePro: boolean) => {
    setFallbackVisible(false);
    const r = fallbackResolver.current;
    fallbackResolver.current = null;
    r?.(becamePro);
  }, []);

  const presentPaywall = useCallback(async (): Promise<boolean> => {
    if (!availableRef.current) return true; // gating disabled on this build
    // Always present our custom redesigned upgrade page. We intentionally do NOT
    // call RevenueCatUI.presentPaywall() here: whenever a paywall is published in
    // the RevenueCat dashboard for the offering it would take over and hide our
    // custom page. openFallback() reads live prices from the offering, so the
    // custom page stays accurate without the dashboard paywall.
    return await openFallback();
  }, [openFallback]);

  const requirePro = useCallback(async (): Promise<boolean> => {
    // Wait for init to settle first: availableRef/isProRef are only accurate
    // after configure + the first getCustomerInfo/getOfferings resolve, so a
    // tap during the brief startup window must not slip past the gate.
    if (initPromiseRef.current) {
      try { await initPromiseRef.current; } catch { /* init is best-effort */ }
    }
    if (!availableRef.current) return true; // native module unavailable → ungated
    if (isProRef.current) return true;
    // Nothing to sell yet (offering/packages not provisioned in the dashboard)
    // → fail OPEN rather than soft-lock a feature with no purchase path.
    const offering = offeringRef.current;
    if (!offering || offering.availablePackages.length === 0) return true;
    return await presentPaywall();
  }, [presentPaywall]);

  const presentCustomerCenter = useCallback(async () => {
    // The RevenueCat Customer Center requires dashboard configuration this
    // project doesn't have. When unconfigured, presentCustomerCenter() can
    // throw OR silently resolve without showing anything — so a try/catch
    // fallback can't reliably catch the no-op case. Route straight to the
    // OS-native subscription manager (the canonical place to view/cancel an
    // Apple subscription) so "Manage Subscription" always opens something.
    await openNativeSubscriptions();
  }, []);

  const restore = useCallback(async (): Promise<boolean> => {
    if (!availableRef.current) return false;
    try {
      const info = await Purchases.restorePurchases();
      setCustomerInfo(info);
      return isEntitled(info);
    } catch {
      return isProRef.current;
    }
  }, []);

  const onFallbackPurchase = useCallback(async (pkg: PurchasesPackage) => {
    try {
      const { customerInfo: info } = await Purchases.purchasePackage(pkg);
      setCustomerInfo(info);
      closeFallback(isEntitled(info));
    } catch (e: any) {
      // Keep the sheet open if the user simply cancelled the system dialog.
      if (e?.userCancelled) return;
      closeFallback(false);
    }
  }, [closeFallback]);

  const value = useMemo<SubscriptionContextValue>(
    () => ({
      available,
      isPro,
      customerInfo,
      offerings,
      loading,
      refresh,
      requirePro,
      presentPaywall,
      presentCustomerCenter,
      restore,
    }),
    [
      available,
      isPro,
      customerInfo,
      offerings,
      loading,
      refresh,
      requirePro,
      presentPaywall,
      presentCustomerCenter,
      restore,
    ],
  );

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
      <FallbackPaywall
        visible={fallbackVisible}
        offering={offerings}
        onClose={() => closeFallback(false)}
        onPurchase={onFallbackPurchase}
      />
    </SubscriptionContext.Provider>
  );
}

export function useSubscription(): SubscriptionContextValue {
  return useContext(SubscriptionContext);
}

// ── Fallback paywall ────────────────────────────────────────────────────────
// Shown only when the RevenueCat dashboard has no published paywall for the
// current offering. Prices are ALWAYS read live from the offering's packages —
// never hardcoded.
function packageLabel(pkg: PurchasesPackage): string {
  switch (pkg.packageType) {
    case 'LIFETIME':
      return 'Lifetime';
    case 'ANNUAL':
      return 'Yearly';
    case 'MONTHLY':
      return 'Monthly';
    default:
      return pkg.product.title || pkg.identifier;
  }
}

function introUnitWord(unit?: string): string {
  switch ((unit ?? '').toUpperCase()) {
    case 'DAY':
      return 'day';
    case 'WEEK':
      return 'week';
    case 'MONTH':
      return 'month';
    case 'YEAR':
      return 'year';
    default:
      return 'period';
  }
}

// Build a human launch-discount phrase straight from the product's introductory
// offer (configured in App Store Connect) — never hardcoded. e.g.
// "$1.99/mo for the first 3 months, then $4.99" or
// "$19.99 for the first year, then $29.99". Returns null when the product has no
// intro offer so the row falls back to the plain price.
function introPhrase(pkg: PurchasesPackage): string | null {
  const intro = pkg.product.introPrice;
  if (!intro || !intro.priceString) return null;
  if (intro.price === 0) return null; // free trial — handled by trialPhrase()
  const cycles = intro.cycles || 1;
  const perCycle = intro.periodNumberOfUnits || 1;
  const totalUnits = cycles * perCycle;
  const word = introUnitWord(intro.periodUnit);
  const duration =
    totalUnits <= 1 ? `the first ${word}` : `the first ${totalUnits} ${word}s`;
  return `${intro.priceString} for ${duration}, then ${pkg.product.priceString}`;
}

// Free-trial duration label, read straight from the product's intro offer
// (configured in App Store Connect), e.g. "7 days". Null when the offer is not a
// free trial — so all "free trial" copy disappears automatically if ASC has no
// trial set up, keeping every claim truthful.
function trialDurationLabel(pkg: PurchasesPackage): string | null {
  const intro = pkg.product.introPrice;
  if (!intro || intro.price !== 0) return null;
  const totalUnits = (intro.cycles || 1) * (intro.periodNumberOfUnits || 1);
  const word = introUnitWord(intro.periodUnit);
  return totalUnits <= 1 ? `1 ${word}` : `${totalUnits} ${word}s`;
}

// Human free-trial phrase, e.g. "Free for 7 days, then $2.99". Null when there
// is no free-trial intro offer on this package.
function trialPhrase(pkg: PurchasesPackage): string | null {
  const label = trialDurationLabel(pkg);
  if (!label) return null;
  return `Free for ${label}, then ${pkg.product.priceString}`;
}

// Total free-trial length in days (approx for month/year units) — powers the
// "how your trial works" timeline + CTA copy. Null when no free trial.
function trialTotalDays(pkg: PurchasesPackage): number | null {
  const intro = pkg.product.introPrice;
  if (!intro || intro.price !== 0) return null;
  const units = (intro.cycles || 1) * (intro.periodNumberOfUnits || 1);
  switch ((intro.periodUnit ?? '').toUpperCase()) {
    case 'DAY':
      return units;
    case 'WEEK':
      return units * 7;
    case 'MONTH':
      return units * 30;
    case 'YEAR':
      return units * 365;
    default:
      return null;
  }
}

// Longest free-trial length (in days) across an offering's packages. Lets
// upgrade entry points (Settings, gates) lead with truthful trial copy —
// returns null when ASC has no free trial configured, so trial claims
// disappear automatically (App Review 3.1.2(c) safety).
export function offeringTrialDays(offering: PurchasesOffering | null): number | null {
  if (!offering) return null;
  let best: number | null = null;
  for (const pkg of offering.availablePackages) {
    const d = trialTotalDays(pkg);
    if (d != null && (best == null || d > best)) best = d;
  }
  return best;
}

// "/year"-style billing-unit suffix for a package's billed price.
function periodSuffix(pkg: PurchasesPackage): string | null {
  switch (pkg.packageType) {
    case 'ANNUAL':
      return '/year';
    case 'MONTHLY':
      return '/month';
    default:
      return null;
  }
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// The Pro value props — deliberately minimal (Cal-AI-style paywall: few words,
// bold type, one calm grouped card).
const PRO_BENEFITS: { icon: string; title: string; sub: string }[] = [
  { icon: 'trending-up', title: 'Real Net Profit', sub: 'What is truly left after gas & miles' },
  { icon: 'sparkles', title: 'AI Suggestions', sub: 'Earn more, drive less' },
  { icon: 'phone-portrait', title: 'Widgets', sub: 'Profit on your Lock Screen' },
  { icon: 'document-text', title: 'Tax Reports', sub: 'Your whole year, one tap' },
];

// Per-month equivalent of an annual package, formatted in its own currency.
function perMonthString(annual: PurchasesPackage): string | null {
  const p = annual.product;
  if (!p?.price) return null;
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: p.currencyCode || 'USD',
      maximumFractionDigits: 2,
    }).format(p.price / 12);
  } catch {
    return null;
  }
}

// % saved on annual vs paying monthly for a year. Null when not computable.
function annualSavingsPct(
  monthly: PurchasesPackage | undefined,
  annual: PurchasesPackage | undefined,
): number | null {
  const m = monthly?.product.price;
  const a = annual?.product.price;
  if (!m || !a) return null;
  const pct = Math.round((1 - a / (m * 12)) * 100);
  return pct > 0 ? pct : null;
}

function FallbackPaywall({
  visible,
  offering,
  onClose,
  onPurchase,
}: {
  visible: boolean;
  offering: PurchasesOffering | null;
  onClose: () => void;
  onPurchase: (pkg: PurchasesPackage) => Promise<void>;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { restore } = useSubscription();
  const packages = offering?.availablePackages ?? [];
  const monthly = packages.find((p) => p.packageType === 'MONTHLY');
  const annual = packages.find((p) => p.packageType === 'ANNUAL');

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // (Re)default the selection to annual (best value) each time the sheet opens
  // or the offering loads in.
  useEffect(() => {
    if (visible) setSelectedId((annual ?? packages[0])?.identifier ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, offering]);

  const selected = packages.find((p) => p.identifier === selectedId) ?? null;
  const savings = annualSavingsPct(monthly, annual);
  const perMo = annual ? perMonthString(annual) : null;
  // Free-trial framing — only surfaces when an intro free trial is actually
  // configured in App Store Connect, so the copy never over-promises.
  const selTrial = selected ? trialPhrase(selected) : null;
  const selTrialDays = selected ? trialTotalDays(selected) : null;
  const selSuffix = selected ? periodSuffix(selected) : null;

  const scale = useSharedValue(1);
  const ctaStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const buy = async (pkg: PurchasesPackage | null) => {
    if (!pkg || busy) return;
    setBusy(true);
    try {
      await onPurchase(pkg);
    } finally {
      setBusy(false);
    }
  };

  const onRestore = async () => {
    if (busy) return;
    const ok = await restore();
    Alert.alert(
      ok ? 'Purchases restored' : 'Nothing to restore',
      ok ? 'Your Pro access is active.' : 'No previous purchases were found for this account.',
    );
    if (ok) onClose();
  };

  // The CTA always carries the FULL BILLED amount — never the intro/trial
  // price. App Review 3.1.2(c): the billed amount must be the most clear and
  // conspicuous pricing element; intro/trial info is subordinate elsewhere.
  const ctaPrice = selected ? selected.product.priceString : '';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: t.BG }}>
        {/* Close */}
        <Pressable
          onPress={onClose}
          hitSlop={12}
          style={{
            position: 'absolute',
            top: insets.top + 8,
            right: 16,
            zIndex: 10,
            width: 34,
            height: 34,
            borderRadius: 17,
            backgroundColor: t.SURFACE,
            borderWidth: 1,
            borderColor: t.BORDER,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="close" size={20} color={t.MUTED} />
        </Pressable>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingTop: insets.top + 28,
            paddingHorizontal: 22,
            paddingBottom: 180,
          }}
        >
          {/* ── Hero (Cal-AI style: huge bold headline, minimal) ─────────── */}
          <Animated.View
            entering={FadeInDown.springify().damping(18)}
            style={{ alignItems: 'center', marginBottom: 6 }}
          >
            <Text
              style={{
                color: t.TEXT,
                fontSize: 30,
                fontWeight: '900',
                textAlign: 'center',
                letterSpacing: -0.5,
                lineHeight: 36,
              }}
            >
              {selTrialDays
                ? `Start your ${selTrialDays}-day\nfree trial to continue.`
                : 'See your real\ntake-home pay.'}
            </Text>
            <Text
              style={{
                color: t.MUTED,
                fontSize: 15,
                textAlign: 'center',
                marginTop: 8,
                lineHeight: 21,
              }}
            >
              Know what is really left after gas and miles.
            </Text>
          </Animated.View>

          {/* ── How your trial works (Cal-AI timeline; only with a trial) ── */}
          {selTrialDays ? (
            <Animated.View
              entering={FadeInDown.delay(60).springify().damping(18)}
              style={{ marginTop: 26, gap: 4 }}
            >
              {[
                {
                  icon: 'lock-open',
                  title: 'Today',
                  sub: 'Unlock Real Net Profit, AI Suggestions, Widgets & Tax Reports.',
                },
                ...(selTrialDays >= 3
                  ? [
                      {
                        icon: 'notifications',
                        title: `Day ${selTrialDays - 2} — Reminder`,
                        sub: "We'll remind you before your trial ends. Cancel anytime.",
                      },
                    ]
                  : []),
                {
                  icon: 'card',
                  title: `Day ${selTrialDays} — Billing starts`,
                  /* Billed amount stated plainly right in the timeline
                     (App Review 3.1.2(c): billing terms clear & conspicuous). */
                  sub: `You'll be charged ${selected?.product.priceString ?? ''}${selSuffix ?? ''} unless you cancel first.`,
                },
              ].map((s, i, arr) => (
                <View key={s.title} style={{ flexDirection: 'row', gap: 14 }}>
                  <View style={{ alignItems: 'center' }}>
                    <View
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 19,
                        backgroundColor: '#000000',
                        borderWidth: 1.5,
                        borderColor: t.isDark ? 'rgba(250,204,21,0.55)' : '#000000',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ionicons name={s.icon as any} size={18} color="#facc15" />
                    </View>
                    {i < arr.length - 1 && (
                      <View style={{ width: 3, flex: 1, minHeight: 18, borderRadius: 2, backgroundColor: '#facc15' }} />
                    )}
                  </View>
                  <View style={{ flex: 1, paddingBottom: i < arr.length - 1 ? 16 : 0 }}>
                    <Text style={{ color: t.TEXT, fontSize: 16.5, fontWeight: '800' }}>{s.title}</Text>
                    <Text style={{ color: t.MUTED, fontSize: 13.5, lineHeight: 19, marginTop: 2 }}>{s.sub}</Text>
                  </View>
                </View>
              ))}
            </Animated.View>
          ) : (
            /* Benefits — one calm grouped card; shown when no trial */
          <Animated.View
            entering={FadeInDown.delay(60).springify().damping(18)}
            style={{
              marginTop: 26,
              backgroundColor: t.SURFACE,
              borderWidth: 1,
              borderColor: t.isDark ? 'rgba(255,255,255,0.18)' : t.BORDER,
              borderRadius: 20,
              paddingHorizontal: 16,
              paddingVertical: 6,
            }}
          >
            {PRO_BENEFITS.map((b, i) => (
              <View
                key={b.title}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 14,
                  paddingVertical: 13,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: t.DIVIDER,
                }}
              >
                <View
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 12,
                    backgroundColor: '#000000',
                    borderWidth: 1.5,
                    borderColor: t.isDark ? 'rgba(250,204,21,0.55)' : '#000000',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name={b.icon as any} size={19} color="#facc15" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: t.TEXT, fontSize: 15.5, fontWeight: '800' }}>{b.title}</Text>
                  <Text style={{ color: t.MUTED, fontSize: 13, marginTop: 1 }}>{b.sub}</Text>
                </View>
                <Ionicons name="checkmark-circle" size={20} color={t.GREEN} />
              </View>
            ))}
          </Animated.View>
          )}

          {/* ── Plans ────────────────────────────────────────────────────── */}
          {packages.length > 0 && (
            <View style={{ marginTop: 30, gap: 12 }}>
              {packages.map((pkg) => {
                const isSel = pkg.identifier === selectedId;
                const isAnnual = pkg.packageType === 'ANNUAL';
                const trial = trialPhrase(pkg);
                const trialLbl = trialDurationLabel(pkg);
                const intro = trial ? null : introPhrase(pkg);
                const suffix = periodSuffix(pkg);
                return (
                  <Pressable
                    key={pkg.identifier}
                    onPress={() => setSelectedId(pkg.identifier)}
                    style={{
                      borderWidth: 2,
                      borderColor: isSel
                        ? '#000000'
                        : t.isDark
                          ? 'rgba(255,255,255,0.18)'
                          : t.BORDER,
                      backgroundColor: isSel ? '#facc15' : t.SURFACE,
                      borderRadius: 20,
                      overflow: 'hidden',
                      ...(isSel
                        ? {
                            /* Neon glow halo around the active plan card */
                            shadowColor: '#facc15',
                            shadowOpacity: 0.65,
                            shadowRadius: 18,
                            shadowOffset: { width: 0, height: 0 },
                            elevation: 12,
                          }
                        : null),
                    }}
                  >
                    {/* Cal-AI-style ribbon across the card top when this plan
                        has a free trial. Small caps text — the billed price
                        below stays the dominant price (App Review 3.1.2(c)). */}
                    {trialLbl && (
                      <View style={{ backgroundColor: '#000000', paddingVertical: 4, alignItems: 'center' }}>
                        <Text style={{ color: '#facc15', fontSize: 10.5, fontWeight: '900', letterSpacing: 1 }}>
                          {trialLbl.toUpperCase()} FREE
                        </Text>
                      </View>
                    )}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }}>
                      <Ionicons
                        name={isSel ? 'checkmark-circle' : 'ellipse-outline'}
                        size={24}
                        color={isSel ? '#000000' : t.MUTED}
                      />
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <Text style={{ color: isSel ? '#000000' : t.TEXT, fontSize: 16.5, fontWeight: '800' }}>
                            {packageLabel(pkg)}
                          </Text>
                          {isAnnual && (
                            <View style={{ backgroundColor: t.GREEN, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
                              <Text style={{ color: '#04210f', fontSize: 10, fontWeight: '900', letterSpacing: 0.3 }}>
                                {savings != null ? `BEST VALUE · SAVE ${savings}%` : 'BEST VALUE'}
                              </Text>
                            </View>
                          )}
                          {intro && (
                            <View style={{ borderWidth: 1, borderColor: isSel ? 'rgba(0,0,0,0.4)' : t.BORDER, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
                              <Text style={{ color: isSel ? 'rgba(0,0,0,0.75)' : t.MUTED, fontSize: 10, fontWeight: '700', letterSpacing: 0.3 }}>
                                intro offer
                              </Text>
                            </View>
                          )}
                        </View>
                        <Text style={{ color: isSel ? 'rgba(0,0,0,0.7)' : t.MUTED, fontSize: 12.5, marginTop: 2 }}>
                          {trial ??
                            intro ??
                            (isAnnual && perMo
                              ? `Just ${perMo}/mo, billed yearly`
                              : pkg.packageType === 'LIFETIME'
                                ? 'One-time purchase, yours forever'
                                : pkg.product.title)}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        {/* ALWAYS the full billed amount, biggest & boldest price
                            on the row (App Review 3.1.2(c)) — intro/trial detail
                            lives in the subordinate subtitle text only. */}
                        <Text style={{ color: isSel ? '#000000' : t.TEXT, fontSize: 18, fontWeight: '900' }}>
                          {pkg.product.priceString}
                        </Text>
                        <Text style={{ color: isSel ? 'rgba(0,0,0,0.7)' : t.MUTED, fontSize: 11, marginTop: 1 }}>
                          {intro
                            ? 'after intro'
                            : trial
                              ? suffix
                                ? `${suffix}, after trial`
                                : 'after trial'
                              : (suffix ?? 'one time')}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}

          {/* Restore + legal */}
          <Pressable onPress={onRestore} disabled={busy} hitSlop={8} style={{ paddingVertical: 16, alignItems: 'center' }}>
            <Text style={{ color: t.MUTED, fontSize: 13, fontWeight: '700', textDecorationLine: 'underline' }}>
              Restore purchases
            </Text>
          </Pressable>
          <Text style={{ color: t.LABEL, fontSize: 11.5, textAlign: 'center', lineHeight: 17 }}>
            {selTrial
              ? `${selTrial}. Cancel anytime in Settings before your trial ends and you won't be charged. `
              : ''}
            Subscriptions auto-renew unless cancelled at least 24 hours before the end of the
            current period. Your Apple account is charged for renewal within 24 hours before the
            period ends. Manage or cancel anytime in your App Store account settings. Lifetime is a
            one-time purchase and does not renew.
          </Text>
          <View
            style={{ flexDirection: 'row', justifyContent: 'center', gap: 18, marginTop: 12 }}
          >
            <Pressable
              onPress={() => Linking.openURL(`${API_BASE}/privacy`)}
              hitSlop={8}
            >
              <Text
                style={{ color: t.MUTED, fontSize: 11.5, fontWeight: '700', textDecorationLine: 'underline' }}
              >
                Privacy Policy
              </Text>
            </Pressable>
            <Pressable
              onPress={() =>
                Linking.openURL(
                  'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/',
                )
              }
              hitSlop={8}
            >
              <Text
                style={{ color: t.MUTED, fontSize: 11.5, fontWeight: '700', textDecorationLine: 'underline' }}
              >
                Terms of Use
              </Text>
            </Pressable>
          </View>
        </ScrollView>

        {/* ── Sticky CTA ─────────────────────────────────────────────────── */}
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: t.BG,
            borderTopWidth: 1,
            borderTopColor: t.BORDER,
            paddingTop: 12,
            paddingHorizontal: 22,
            paddingBottom: insets.bottom + 12,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 10 }}>
            {selTrialDays ? <Ionicons name="checkmark" size={15} color={t.TEXT} /> : null}
            <Text
              style={{
                color: selTrialDays ? t.TEXT : t.MUTED,
                fontSize: selTrialDays ? 13.5 : 12,
                fontWeight: selTrialDays ? '800' : '600',
                textAlign: 'center',
              }}
            >
              {selTrialDays ? 'No Payment Due Now' : 'Cancel anytime · No commitment'}
            </Text>
          </View>
          <AnimatedPressable
            onPressIn={() => {
              scale.value = withSpring(0.97);
            }}
            onPressOut={() => {
              scale.value = withSpring(1);
            }}
            onPress={() => buy(selected)}
            disabled={busy || !selected}
            style={[
              ctaStyle,
              {
                backgroundColor: t.PRIMARY,
                borderRadius: 999,
                paddingVertical: 17,
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
                gap: 8,
                opacity: !selected ? 0.5 : 1,
                shadowColor: t.PRIMARY,
                shadowOpacity: 0.25,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: 4 },
              },
            ]}
          >
            {busy ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={{ color: '#000', fontSize: 17, fontWeight: '900', letterSpacing: 0.2 }}>
                {selTrialDays
                  ? `Start My ${selTrialDays}-Day Free Trial`
                  : selected
                    ? `Upgrade${ctaPrice ? ` — ${ctaPrice}` : ''}`
                    : 'Upgrade to Pro'}
              </Text>
            )}
          </AnimatedPressable>
          {/* Billed amount stated immediately below the trial CTA
              (App Review 3.1.2(c): billing terms adjacent & unambiguous). */}
          {selTrialDays && ctaPrice ? (
            <Text style={{ color: t.MUTED, fontSize: 11.5, textAlign: 'center', marginTop: 8, lineHeight: 16 }}>
              {selTrialDays} days free, then {ctaPrice}
              {selSuffix ? ` per ${selSuffix.slice(1)}` : ''}. Auto-renews unless you cancel.
            </Text>
          ) : null}
          <Pressable onPress={onClose} disabled={busy} hitSlop={8} style={{ paddingVertical: 10, alignItems: 'center' }}>
            <Text style={{ color: t.MUTED, fontSize: 13.5, fontWeight: '600' }}>Maybe later</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
