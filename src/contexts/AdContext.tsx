/**
 * AdContext — React context for the ad system
 *
 * Provides ad state and actions to the component tree.
 * Handles Android banner initialization, privacy, placement, and lifecycle.
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import {
  initializeAds,
  getAdState,
  showAdPrivacyOptions,
  refreshAdPrivacyOptionsStatus,
  disableAds,
  isBannerAdsSupported,
  showHabitsBanner,
  hideHabitsBanner,
  removeHabitsBanner,
} from '@/lib/adController';
import { logger } from '@/lib/logger';

const ANDROID_MOTION_BENCHMARK_ENABLED =
  typeof __ANDROID_MOTION_BENCHMARK__ !== 'undefined' &&
  __ANDROID_MOTION_BENCHMARK__;

// ============================================
// TYPES
// ============================================

interface AdContextValue {
  /** Whether this native build has the configured Android banner capability */
  adsSupported: boolean;

  /** Whether the AdMob SDK is available (native only) */
  adsAvailable: boolean;

  /** Native banner height reserved by the active Habits surface */
  bannerHeight: number;

  /** Requests the one approved Habits placement; overlays pass false */
  setHabitsBannerActive: (active: boolean) => void;

  /** Blocks the native view while a shell-level drawer or modal is open */
  setGlobalAdOverlayOpen: (open: boolean) => void;

  /** Whether Google UMP currently allows ad requests */
  googleConsentReady: boolean;

  /** Whether Google UMP requires a visible privacy-options entry point */
  privacyOptionsRequired: boolean;

  /** Opens Google UMP privacy options when available */
  openAdPrivacyOptions: () => Promise<boolean>;
}

const AdContext = createContext<AdContextValue | null>(null);

// ============================================
// PROVIDER
// ============================================

interface AdProviderProps {
  children: ReactNode;
  /** Whether user has ad consent (GDPR) */
  adConsent?: boolean;
  /** Whether user is premium (no ads) */
  isPremium?: boolean;
  /** Latest mood used for mood-aware ad gating */
  currentMood?: string | null;
}

export function AdProvider({
  children,
  adConsent = false,
  isPremium = false,
  currentMood,
}: AdProviderProps) {
  const [adsAvailable, setAdsAvailable] = useState(false);
  const [bannerHeight, setBannerHeight] = useState(0);
  const [habitsBannerActive, setHabitsBannerActiveState] = useState(false);
  const [globalAdOverlayOpen, setGlobalAdOverlayOpenState] = useState(false);
  const [documentVisible, setDocumentVisible] = useState(
    () => typeof document === 'undefined' || document.visibilityState !== 'hidden',
  );
  const [viewportWidth, setViewportWidth] = useState(
    () => typeof window === 'undefined' ? 0 : Math.round(window.innerWidth),
  );
  const [googleConsentReady, setGoogleConsentReady] = useState(false);
  const [privacyOptionsRequired, setPrivacyOptionsRequired] = useState(false);

  const syncControllerState = useCallback(() => {
    const controllerState = getAdState();
    setGoogleConsentReady(controllerState.canRequestAds);
    setPrivacyOptionsRequired(controllerState.privacyOptionsRequired);
    setAdsAvailable(controllerState.sdkAvailable);
  }, []);

  const syncPrivacyOptionsOnly = useCallback(() => {
    const controllerState = getAdState();
    setGoogleConsentReady(controllerState.canRequestAds);
    setPrivacyOptionsRequired(controllerState.privacyOptionsRequired);
    setAdsAvailable(false);
    setBannerHeight(0);
  }, []);

  // Initialize SDK
  useEffect(() => {
    let cancelled = false;

    const disableAdRequests = (clearPrivacyOptions: boolean) => {
      if (cancelled) return;
      disableAds({ clearPrivacyOptions });
      setAdsAvailable(false);
      setBannerHeight(0);
      setGoogleConsentReady(false);
      if (clearPrivacyOptions) setPrivacyOptionsRequired(false);
    };

    if (isPremium) {
      disableAdRequests(true);
      return () => {
        cancelled = true;
      };
    }

    if (!adConsent) {
      disableAdRequests(false);
      void refreshAdPrivacyOptionsStatus()
        .catch(err => logger.warn('[Ads]', 'Privacy options refresh failed:', err))
        .finally(() => {
          if (!cancelled) syncPrivacyOptionsOnly();
        });

      return () => {
        cancelled = true;
      };
    }

    void initializeAds().then((available) => {
      if (cancelled) return;
      syncControllerState();
      if (!available) setBannerHeight(0);
    }).catch(err => {
      if (!cancelled) logger.warn('[Ads]', 'Ad init failed:', err);
    });

    return () => {
      cancelled = true;
    };
  }, [adConsent, isPremium, syncControllerState, syncPrivacyOptionsOnly]);

  // Native views survive above the WebView, so lifecycle visibility is part of
  // the placement gate rather than an eventual cleanup detail.
  useEffect(() => {
    const handleVisibilityChange = () => {
      setDocumentVisible(document.visibilityState !== 'hidden');
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Anchored adaptive banners are sized from the current Android window. A
  // width change (rotation or split-screen resize) must run the placement
  // effect again so the native view is rebuilt for the new window metrics.
  useEffect(() => {
    const handleViewportResize = () => {
      const nextWidth = Math.round(window.innerWidth);
      setViewportWidth((currentWidth) => currentWidth === nextWidth ? currentWidth : nextWidth);
    };
    window.addEventListener('resize', handleViewportResize, { passive: true });
    return () => window.removeEventListener('resize', handleViewportResize);
  }, []);

  const emotionallyProtected = currentMood === 'bad' || currentMood === 'terrible';
  useEffect(() => {
    if (
      !ANDROID_MOTION_BENCHMARK_ENABLED ||
      typeof location === 'undefined' ||
      location.protocol !== 'https:' ||
      location.hostname !== 'localhost'
    ) {
      return;
    }

    const benchmarkGlobal = globalThis as typeof globalThis & {
      __ZENFLOW_ANDROID_BANNER_CONTEXT_BENCHMARK__?: () => Record<
        string,
        boolean | number | string | null | undefined
      >;
    };
    const probe = () => ({
      adConsent,
      isPremium,
      currentMood: currentMood ?? null,
      adsAvailable,
      bannerHeight,
      habitsBannerActive,
      globalAdOverlayOpen,
      documentVisible,
      emotionallyProtected,
      googleConsentReady,
      privacyOptionsRequired,
    });
    Object.defineProperty(benchmarkGlobal, '__ZENFLOW_ANDROID_BANNER_CONTEXT_BENCHMARK__', {
      configurable: true,
      enumerable: false,
      value: probe,
    });

    return () => {
      if (benchmarkGlobal.__ZENFLOW_ANDROID_BANNER_CONTEXT_BENCHMARK__ === probe) {
        delete benchmarkGlobal.__ZENFLOW_ANDROID_BANNER_CONTEXT_BENCHMARK__;
      }
    };
  }, [
    adConsent,
    adsAvailable,
    bannerHeight,
    currentMood,
    documentVisible,
    emotionallyProtected,
    globalAdOverlayOpen,
    googleConsentReady,
    habitsBannerActive,
    isPremium,
    privacyOptionsRequired,
  ]);

  useEffect(() => {
    let cancelled = false;
    const shouldShow =
      adsAvailable &&
      habitsBannerActive &&
      documentVisible &&
      !emotionallyProtected &&
      !globalAdOverlayOpen;

    if (!shouldShow) {
      setBannerHeight(0);
      void hideHabitsBanner();
      return () => {
        cancelled = true;
      };
    }

    void showHabitsBanner((height) => {
      if (!cancelled) setBannerHeight(Math.max(0, height));
    });

    return () => {
      cancelled = true;
    };
  }, [
    adsAvailable,
    documentVisible,
    emotionallyProtected,
    globalAdOverlayOpen,
    habitsBannerActive,
    viewportWidth,
  ]);

  useEffect(
    () => () => {
      void removeHabitsBanner();
    },
    [],
  );

  const setHabitsBannerActive = useCallback((active: boolean) => {
    if (!active) setBannerHeight(0);
    setHabitsBannerActiveState(active);
  }, []);

  const setGlobalAdOverlayOpen = useCallback((open: boolean) => {
    if (open) setBannerHeight(0);
    setGlobalAdOverlayOpenState(open);
  }, []);

  const openAdPrivacyOptions = useCallback(async (): Promise<boolean> => {
    const result = await showAdPrivacyOptions();
    syncControllerState();
    return result.opened;
  }, [syncControllerState]);

  const value: AdContextValue = {
    adsSupported: isBannerAdsSupported(),
    adsAvailable,
    bannerHeight,
    setHabitsBannerActive,
    setGlobalAdOverlayOpen,
    googleConsentReady,
    privacyOptionsRequired,
    openAdPrivacyOptions,
  };

  return <AdContext.Provider value={value}>{children}</AdContext.Provider>;
}

// ============================================
// HOOK
// ============================================

export function useAds(): AdContextValue {
  const context = useContext(AdContext);
  if (!context) {
    // Return a no-op version if AdProvider isn't mounted
    return {
      adsSupported: false,
      adsAvailable: false,
      bannerHeight: 0,
      setHabitsBannerActive: () => {},
      setGlobalAdOverlayOpen: () => {},
      googleConsentReady: false,
      privacyOptionsRequired: false,
      openAdPrivacyOptions: async () => false,
    };
  }
  return context;
}
