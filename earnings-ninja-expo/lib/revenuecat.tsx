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
  Modal,
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Purchases, {
  LOG_LEVEL,
  type CustomerInfo,
  type PurchasesOffering,
  type PurchasesPackage,
} from 'react-native-purchases';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';
import { useTheme } from './theme';
import { useAuth } from './authContext';

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
      const offering = offeringRef.current;
      if (!offering || offering.availablePackages.length === 0) {
        // Nothing to sell (offering not provisioned yet) — can't gate.
        resolve(false);
        return;
      }
      fallbackResolver.current = resolve;
      setFallbackVisible(true);
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
    try {
      const result = await RevenueCatUI.presentPaywall();
      if (result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED) {
        const info = await Purchases.getCustomerInfo();
        setCustomerInfo(info);
        return isEntitled(info);
      }
      if (result === PAYWALL_RESULT.NOT_PRESENTED) {
        // No dashboard paywall published for the current offering → fallback.
        return await openFallback();
      }
      return isProRef.current; // CANCELLED or ERROR
    } catch {
      // RevenueCatUI unavailable or threw → custom fallback paywall.
      return await openFallback();
    }
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
    if (!availableRef.current) return;
    try {
      await RevenueCatUI.presentCustomerCenter();
      await refresh();
    } catch {
      // no-op
    }
  }, [refresh]);

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
  const cycles = intro.cycles || 1;
  const perCycle = intro.periodNumberOfUnits || 1;
  const totalUnits = cycles * perCycle;
  const word = introUnitWord(intro.periodUnit);
  const duration =
    totalUnits <= 1 ? `the first ${word}` : `the first ${totalUnits} ${word}s`;
  return `${intro.priceString} for ${duration}, then ${pkg.product.priceString}`;
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
  const [busyId, setBusyId] = useState<string | null>(null);
  const packages = offering?.availablePackages ?? [];

  const handle = async (pkg: PurchasesPackage) => {
    if (busyId) return;
    setBusyId(pkg.identifier);
    try {
      await onPurchase(pkg);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
        <View
          style={{
            backgroundColor: t.BG,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingHorizontal: 20,
            paddingTop: 24,
            paddingBottom: 36,
            borderWidth: 1,
            borderColor: t.BORDER,
          }}
        >
          <View style={{ alignItems: 'center', marginBottom: 4 }}>
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                backgroundColor: t.PRI_LITE,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 12,
              }}
            >
              <Ionicons name="rocket" size={28} color={t.PRIMARY_TXT} />
            </View>
            <Text style={{ color: t.TEXT, fontSize: 22, fontWeight: '800' }}>Earnings Ninja Pro</Text>
            <Text style={{ color: t.MUTED, fontSize: 14, textAlign: 'center', marginTop: 6 }}>
              Unlock CSV export and advanced analytics.
            </Text>
          </View>

          <View style={{ marginVertical: 18, gap: 10 }}>
            {['Export all your data to CSV', 'Advanced analytics & insights'].map((f) => (
              <View key={f} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Ionicons name="checkmark-circle" size={20} color={t.GREEN} />
                <Text style={{ color: t.TEXT_MID, fontSize: 15 }}>{f}</Text>
              </View>
            ))}
          </View>

          <View style={{ gap: 12 }}>
            {packages.map((pkg) => (
              <Pressable
                key={pkg.identifier}
                onPress={() => handle(pkg)}
                disabled={!!busyId}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: t.SURFACE,
                  borderColor: t.PRIMARY,
                  borderWidth: 1.5,
                  borderRadius: 14,
                  padding: 16,
                  opacity: busyId && busyId !== pkg.identifier ? 0.5 : 1,
                }}
              >
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ color: t.TEXT, fontSize: 16, fontWeight: '800' }}>
                      {packageLabel(pkg)}
                    </Text>
                    {introPhrase(pkg) ? (
                      <View
                        style={{
                          backgroundColor: t.GREEN,
                          borderRadius: 6,
                          paddingHorizontal: 6,
                          paddingVertical: 2,
                        }}
                      >
                        <Text style={{ color: '#04210f', fontSize: 10, fontWeight: '900', letterSpacing: 0.3 }}>
                          LAUNCH DEAL
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={{ color: t.MUTED, fontSize: 13, marginTop: 2 }}>
                    {introPhrase(pkg) ?? pkg.product.title}
                  </Text>
                </View>
                {busyId === pkg.identifier ? (
                  <ActivityIndicator color={t.PRIMARY_TXT} />
                ) : introPhrase(pkg) ? (
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ color: t.PRIMARY_TXT, fontSize: 17, fontWeight: '800' }}>
                      {pkg.product.introPrice?.priceString}
                    </Text>
                    <Text style={{ color: t.MUTED, fontSize: 12, textDecorationLine: 'line-through' }}>
                      {pkg.product.priceString}
                    </Text>
                  </View>
                ) : (
                  <Text style={{ color: t.PRIMARY_TXT, fontSize: 17, fontWeight: '800' }}>
                    {pkg.product.priceString}
                  </Text>
                )}
              </Pressable>
            ))}
          </View>

          <Pressable
            onPress={onClose}
            disabled={!!busyId}
            style={{ paddingVertical: 14, alignItems: 'center', marginTop: 8 }}
          >
            <Text style={{ color: t.MUTED, fontSize: 15, fontWeight: '600' }}>Maybe later</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
