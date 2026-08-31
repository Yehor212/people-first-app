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
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { App } from '@capacitor/app';
import {
  initializeAds,
  getAdState,
  refreshAdPrivacyOptionsStatus,
  showAdPrivacyOptions,
  disableAds,
  isBannerAdsSupported,
  showHabitsBanner,
  hideHabitsBanner,
  removeHabitsBanner,
} from '@/lib/adController';
import { logger } from '@/lib/logger';
import type { AdAgeEligibility } from '@/types';
import type { AdEntitlement } from '@/lib/adEligibility';

const ANDROID_MOTION_BENCHMARK_ENABLED =
  typeof __ANDROID_MOTION_BENCHMARK__ !== "undefined" && __ANDROID_MOTION_BENCHMARK__;

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

  /** True only after the native banner is acknowledged hidden/removed for protected UI. */
  prepareProtectedAdSurface: () => Promise<boolean>;

  /** Visible recovery state when native suppression could not be acknowledged. */
  protectedSurfaceSuppressionFailed: boolean;

  /** Dismisses the recovery notice without weakening the suppression gate. */
  clearProtectedSurfaceSuppressionFailure: () => void;

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
const ADAPTIVE_VIEWPORT_SETTLE_MS = 500;
const NATIVE_BANNER_RESERVATION_TIMEOUT_MS = 12_000;

// ============================================
// PROVIDER
// ============================================

interface AdProviderProps {
  children: ReactNode;
  /** Whether user has ad consent (GDPR) */
  adConsent?: boolean;
  /** Minimal local category derived without storing the date of birth */
  adAgeEligibility?: AdAgeEligibility;
  /** Account-scoped product entitlement; unknown always denies ads. */
  adEntitlement?: AdEntitlement;
  /** True when any bad/terrible entry exists on the current local date. */
  emotionProtectedToday?: boolean;
  /** Three distinct new-user active days have elapsed, or this is an existing-user cohort. */
  adGraceComplete?: boolean;
}

export function AdProvider({
  children,
  adConsent = false,
  adAgeEligibility = 'unknown',
  adEntitlement = 'unknown',
  emotionProtectedToday = true,
  adGraceComplete = false,
}: AdProviderProps) {
  const [adsAvailable, setAdsAvailable] = useState(false);
  const [bannerHeight, setBannerHeight] = useState(0);
  const [habitsBannerActive, setHabitsBannerActiveState] = useState(false);
  const [globalAdOverlayOpen, setGlobalAdOverlayOpenState] = useState(false);
  const [protectedSurfaceHandshakeActive, setProtectedSurfaceHandshakeActive] = useState(false);
  const [protectedSurfaceSuppressionFailed, setProtectedSurfaceSuppressionFailed] = useState(false);
  const protectedSurfaceHandshakeRef = useRef(false);
  const [documentVisible, setDocumentVisible] = useState(
    () => typeof document === "undefined" || document.visibilityState !== "hidden"
  );
  const [appActive, setAppActive] = useState(true);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [viewportPlacement, setViewportPlacement] = useState(
    () => ({
      width: typeof window === 'undefined' ? 0 : Math.round(window.innerWidth),
      revision: 0,
    }),
  );
  const [googleConsentReady, setGoogleConsentReady] = useState(false);
  const [privacyOptionsRequired, setPrivacyOptionsRequired] = useState(false);

  const syncControllerState = useCallback(() => {
    const controllerState = getAdState();
    setGoogleConsentReady(controllerState.canRequestAds);
    setPrivacyOptionsRequired(controllerState.privacyOptionsRequired);
    setAdsAvailable(controllerState.sdkAvailable);
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

    if (adEntitlement !== 'free' || !adConsent || adAgeEligibility !== 'adult') {
      const clearPrivacyOptions = adAgeEligibility !== 'adult';
      disableAdRequests(clearPrivacyOptions);
      if (!clearPrivacyOptions) {
        void refreshAdPrivacyOptionsStatus({ ageEligibility: adAgeEligibility })
          .then(() => {
            if (!cancelled) syncControllerState();
          })
          .catch((err) => {
            if (!cancelled) logger.warn("[Ads]", "Privacy options refresh failed:", err);
          });
      }

      return () => {
        cancelled = true;
      };
    }

    void initializeAds({
      adConsent,
      ageEligibility: adAgeEligibility,
      graceComplete: adGraceComplete,
    }).then((available) => {
      if (cancelled) return;
      syncControllerState();
      if (!available) setBannerHeight(0);
    }).catch(err => {
      if (!cancelled) logger.warn('[Ads]', 'Ad init failed:', err);
    });

    return () => {
      cancelled = true;
    };
  }, [adAgeEligibility, adConsent, adEntitlement, adGraceComplete, syncControllerState]);

  useEffect(() => {
    if (!isBannerAdsSupported()) return;
    let cancelled = false;
    let listener: { remove: () => Promise<void> } | undefined;

    void App.addListener('appStateChange', ({ isActive }) => {
      if (!cancelled) setAppActive(isActive);
    }).then((handle) => {
      if (cancelled) void handle.remove();
      else listener = handle;
    }).catch((err) => logger.warn('[Ads]', 'Native app-state listener failed:', err));

    return () => {
      cancelled = true;
      void listener?.remove();
    };
  }, []);

  // Native views survive above the WebView, so lifecycle visibility is part of
  // the placement gate rather than an eventual cleanup detail.
  useEffect(() => {
    const handleVisibilityChange = () => {
      setDocumentVisible(document.visibilityState !== "hidden");
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  useEffect(() => {
    const visualViewport = window.visualViewport;
    const updateFromViewport = () => {
      if (!visualViewport) return;
      setKeyboardOpen(visualViewport.height < window.innerHeight - 120);
    };
    const isEditable = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      return target.matches('input, textarea, select, [contenteditable="true"]');
    };
    const handleFocusIn = (event: FocusEvent) => {
      if (isEditable(event.target)) setKeyboardOpen(true);
    };
    const handleFocusOut = () => {
      window.requestAnimationFrame(updateFromViewport);
    };

    visualViewport?.addEventListener('resize', updateFromViewport, { passive: true });
    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);
    updateFromViewport();
    return () => {
      visualViewport?.removeEventListener('resize', updateFromViewport);
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
    };
  }, []);

  // Anchored adaptive banners are sized from the current Android window. A
  // width change (rotation or split-screen resize) hides the old native view
  // immediately, then rebuilds once the WebView metrics have settled. Android
  // can publish several transient widths during one configuration change.
  useEffect(() => {
    let observedWidth = Math.round(window.innerWidth);
    let settleTimer: ReturnType<typeof setTimeout> | undefined;
    const handleViewportResize = () => {
      const nextWidth = Math.round(window.innerWidth);
      if (nextWidth === observedWidth) return;
      observedWidth = nextWidth;
      setBannerHeight(0);
      void hideHabitsBanner();
      if (settleTimer !== undefined) clearTimeout(settleTimer);
      settleTimer = setTimeout(() => {
        setViewportPlacement((current) => ({
          width: nextWidth,
          revision: current.revision + 1,
        }));
      }, ADAPTIVE_VIEWPORT_SETTLE_MS);
    };
    window.addEventListener('resize', handleViewportResize, { passive: true });
    return () => {
      if (settleTimer !== undefined) clearTimeout(settleTimer);
      window.removeEventListener('resize', handleViewportResize);
    };
  }, []);

  useEffect(() => {
    if (
      !ANDROID_MOTION_BENCHMARK_ENABLED ||
      typeof location === "undefined" ||
      location.protocol !== "https:" ||
      location.hostname !== "localhost"
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
      adAgeEligibility,
      adEntitlement,
      emotionProtectedToday,
      adGraceComplete,
      adsAvailable,
      bannerHeight,
      habitsBannerActive,
      globalAdOverlayOpen,
      documentVisible,
      appActive,
      keyboardOpen,
      protectedSurfaceHandshakeActive,
      protectedSurfaceSuppressionFailed,
      googleConsentReady,
      privacyOptionsRequired,
    });
    Object.defineProperty(benchmarkGlobal, "__ZENFLOW_ANDROID_BANNER_CONTEXT_BENCHMARK__", {
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
    adAgeEligibility,
    adConsent,
    adEntitlement,
    adGraceComplete,
    adsAvailable,
    appActive,
    bannerHeight,
    documentVisible,
    emotionProtectedToday,
    globalAdOverlayOpen,
    googleConsentReady,
    habitsBannerActive,
    keyboardOpen,
    privacyOptionsRequired,
    protectedSurfaceHandshakeActive,
    protectedSurfaceSuppressionFailed,
  ]);

  useEffect(() => {
    let cancelled = false;
    const reservationTimers = new Set<ReturnType<typeof setTimeout>>();
    const shouldShow =
      adsAvailable &&
      habitsBannerActive &&
      adEntitlement === 'free' &&
      appActive &&
      documentVisible &&
      !emotionProtectedToday &&
      !keyboardOpen &&
      !globalAdOverlayOpen &&
      !protectedSurfaceHandshakeActive;

    if (!shouldShow) {
      setBannerHeight(0);
      void hideHabitsBanner();
      return () => {
        cancelled = true;
      };
    }

    const requestBanner = (retriesRemaining: number) => {
      if (cancelled || protectedSurfaceHandshakeRef.current) return;
      let receivedPositiveHeight = false;
      let recoveryScheduled = false;
      let reservationTimer: ReturnType<typeof setTimeout> | undefined;
      const clearReservationTimer = () => {
        if (reservationTimer === undefined) return;
        clearTimeout(reservationTimer);
        reservationTimers.delete(reservationTimer);
        reservationTimer = undefined;
      };
      const scheduleRecovery = () => {
        if (
          cancelled ||
          protectedSurfaceHandshakeRef.current ||
          recoveryScheduled ||
          retriesRemaining <= 0
        ) return;
        clearReservationTimer();
        recoveryScheduled = true;
        window.requestAnimationFrame(() => {
          if (!cancelled) requestBanner(retriesRemaining - 1);
        });
      };

      void showHabitsBanner((height) => {
        if (cancelled || protectedSurfaceHandshakeRef.current) return;
        const normalizedHeight = Math.max(0, height);
        if (normalizedHeight > 0) {
          receivedPositiveHeight = true;
          clearReservationTimer();
        }
        setBannerHeight(normalizedHeight);

        // A zero after a positive reservation means the native view vanished
        // while this still-eligible placement remained active. This happens
        // in rare Android lifecycle/rotation races; recover with the same
        // bounded budget used for superseded placement commands.
        if (normalizedHeight === 0 && receivedPositiveHeight) scheduleRecovery();
      }).then((result) => {
        if (cancelled || protectedSurfaceHandshakeRef.current) return;
        if (result.shown) {
          if (!receivedPositiveHeight && retriesRemaining > 0) {
            reservationTimer = setTimeout(() => {
              if (reservationTimer !== undefined) {
                reservationTimers.delete(reservationTimer);
                reservationTimer = undefined;
              }
              if (!cancelled && !receivedPositiveHeight) scheduleRecovery();
            }, NATIVE_BANNER_RESERVATION_TIMEOUT_MS);
            reservationTimers.add(reservationTimer);
          }
          return;
        }
        if (result.error !== 'placement_changed') return;

        // Android can emit a transient WebView width while returning from the
        // background. Retry only the superseded-placement result, on a later
        // paint, and keep the attempt count bounded to avoid request storms.
        scheduleRecovery();
      }).catch((err) => {
        if (!cancelled) logger.warn('[Ads]', 'Habits banner request failed:', err);
      });
    };

    requestBanner(2);

    return () => {
      cancelled = true;
      for (const timer of reservationTimers) clearTimeout(timer);
      reservationTimers.clear();
    };
  }, [
    adsAvailable,
    adEntitlement,
    appActive,
    documentVisible,
    emotionProtectedToday,
    globalAdOverlayOpen,
    habitsBannerActive,
    keyboardOpen,
    protectedSurfaceHandshakeActive,
    viewportPlacement,
  ]);

  // prepareProtectedAdSurface starts suppressing synchronously, before React
  // can commit the caller's sheet/drawer state. Keep that handshake closed
  // until the durable placement gate observes the protected surface. This
  // prevents a native zero-height callback from scheduling a recovery between
  // hide acknowledgement and overlay mount.
  useEffect(() => {
    if (!protectedSurfaceHandshakeActive) return;
    if (habitsBannerActive && !globalAdOverlayOpen) return;
    protectedSurfaceHandshakeRef.current = false;
    setProtectedSurfaceHandshakeActive(false);
  }, [globalAdOverlayOpen, habitsBannerActive, protectedSurfaceHandshakeActive]);

  useEffect(
    () => () => {
      void removeHabitsBanner();
    },
    []
  );

  const setHabitsBannerActive = useCallback((active: boolean) => {
    if (!active) setBannerHeight(0);
    setHabitsBannerActiveState(active);
  }, []);

  const prepareProtectedAdSurface = useCallback(async (): Promise<boolean> => {
    protectedSurfaceHandshakeRef.current = true;
    setProtectedSurfaceHandshakeActive(true);
    setBannerHeight(0);
    try {
      await hideHabitsBanner();
      setProtectedSurfaceSuppressionFailed(false);
      return true;
    } catch (error) {
      setProtectedSurfaceSuppressionFailed(true);
      logger.warn('[Ads] Protected surface remains closed because native suppression failed', error);
      return false;
    }
  }, []);

  const clearProtectedSurfaceSuppressionFailure = useCallback(() => {
    setProtectedSurfaceSuppressionFailed(false);
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
    prepareProtectedAdSurface,
    protectedSurfaceSuppressionFailed,
    clearProtectedSurfaceSuppressionFailure,
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
      prepareProtectedAdSurface: async () => true,
      protectedSurfaceSuppressionFailed: false,
      clearProtectedSurfaceSuppressionFailure: () => {},
      setHabitsBannerActive: () => {},
      setGlobalAdOverlayOpen: () => {},
      googleConsentReady: false,
      privacyOptionsRequired: false,
      openAdPrivacyOptions: async () => false,
    };
  }
  return context;
}
