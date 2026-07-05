/**
 * AdContext — React context for the ad system
 *
 * Provides ad state and actions to the component tree.
 * Handles initialization, mood-aware gating, and reward callbacks.
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import {
  initializeAds,
  canShowRewardedAd,
  showRewardedAd,
  getRemainingRewardedAds,
  getAdState,
  showAdPrivacyOptions,
  refreshAdPrivacyOptionsStatus,
  disableAds,
} from '@/lib/adController';
import { AD_REWARDS, type AdSafeZone } from '@/lib/adConfig';
import { logger } from '@/lib/logger';

// ============================================
// TYPES
// ============================================

interface AdContextValue {
  /** Whether the AdMob SDK is available (native only) */
  adsAvailable: boolean;

  /** Whether a rewarded ad can be shown right now */
  canShowRewarded: boolean;

  /** Remaining rewarded ads today */
  remainingToday: number;

  /** Whether Google UMP currently allows ad requests */
  googleConsentReady: boolean;

  /** Whether Google UMP requires a visible privacy-options entry point */
  privacyOptionsRequired: boolean;

  /** Opens Google UMP privacy options when available */
  openAdPrivacyOptions: () => Promise<boolean>;

  /** Show a rewarded ad from an approved safe zone. Returns true if user earned the reward. */
  watchRewardedAd: (zone?: AdSafeZone) => Promise<boolean>;

  /** Treats reward for watching */
  rewardTreats: number;

  /** XP reward for watching */
  rewardXp: number;

  /** Update current mood (for mood-aware gating) */
  setCurrentMood: (mood: string) => void;
}

const AdContext = createContext<AdContextValue | null>(null);

// ============================================
// PROVIDER
// ============================================

interface AdProviderProps {
  children: ReactNode;
  /** Callback when user earns treats from watching ad */
  onEarnTreats?: (amount: number) => void;
  /** Callback when user earns XP from watching ad */
  onEarnXp?: (amount: number) => void;
  /** Whether user has ad consent (GDPR) */
  adConsent?: boolean;
  /** Whether user is premium (no ads) */
  isPremium?: boolean;
  /** Latest mood used for mood-aware ad gating */
  currentMood?: string | null;
}

export function AdProvider({
  children,
  onEarnTreats,
  onEarnXp,
  adConsent = false,
  isPremium = false,
  currentMood,
}: AdProviderProps) {
  const [adsAvailable, setAdsAvailable] = useState(false);
  const [canShow, setCanShow] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [googleConsentReady, setGoogleConsentReady] = useState(false);
  const [privacyOptionsRequired, setPrivacyOptionsRequired] = useState(false);
  const currentMoodRef = useRef<string>('okay');

  const syncControllerState = useCallback(() => {
    const controllerState = getAdState();
    setGoogleConsentReady(controllerState.canRequestAds);
    setPrivacyOptionsRequired(controllerState.privacyOptionsRequired);
    setRemaining(getRemainingRewardedAds());
    const check = canShowRewardedAd(currentMoodRef.current);
    setCanShow(check.allowed);
    setAdsAvailable(controllerState.sdkAvailable);
  }, []);

  const syncPrivacyOptionsOnly = useCallback(() => {
    const controllerState = getAdState();
    setGoogleConsentReady(controllerState.canRequestAds);
    setPrivacyOptionsRequired(controllerState.privacyOptionsRequired);
    setRemaining(0);
    setCanShow(false);
    setAdsAvailable(false);
  }, []);

  useEffect(() => {
    if (currentMood) {
      currentMoodRef.current = currentMood;
      const check = canShowRewardedAd(currentMood);
      setCanShow(check.allowed);
    }
  }, [currentMood]);

  // Initialize SDK
  useEffect(() => {
    let cancelled = false;

    const disableAdRequests = (clearPrivacyOptions: boolean) => {
      if (cancelled) return;
      disableAds({ clearPrivacyOptions });
      setAdsAvailable(false);
      setCanShow(false);
      setGoogleConsentReady(false);
      if (clearPrivacyOptions) setPrivacyOptionsRequired(false);
      setRemaining(0);
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
      if (available) {
        const check = canShowRewardedAd(currentMoodRef.current);
        setCanShow(check.allowed);
      }
    }).catch(err => {
      if (!cancelled) logger.warn('[Ads]', 'Ad init failed:', err);
    });

    return () => {
      cancelled = true;
    };
  }, [adConsent, isPremium, syncControllerState, syncPrivacyOptionsOnly]);

  // Refresh can-show status periodically
  useEffect(() => {
    if (!adsAvailable) return;

    const interval = setInterval(() => {
      const check = canShowRewardedAd(currentMoodRef.current);
      setCanShow(check.allowed);
      setRemaining(getRemainingRewardedAds());
      const controllerState = getAdState();
      setGoogleConsentReady(controllerState.canRequestAds);
      setPrivacyOptionsRequired(controllerState.privacyOptionsRequired);
    }, 30_000); // every 30s

    return () => clearInterval(interval);
  }, [adsAvailable]);

  const setCurrentMood = useCallback((mood: string) => {
    currentMoodRef.current = mood;
    if (adsAvailable) {
      const check = canShowRewardedAd(mood);
      setCanShow(check.allowed);
    }
  }, [adsAvailable]);

  const watchRewardedAd = useCallback(async (zone: AdSafeZone = 'optional_rewards'): Promise<boolean> => {
    if (!adsAvailable) return false;

    const check = canShowRewardedAd(currentMoodRef.current, zone);
    if (!check.allowed) return false;

    const result = await showRewardedAd({ currentMood: currentMoodRef.current, zone });

    if (result.success && result.rewarded) {
      onEarnTreats?.(AD_REWARDS.rewardedVideoTreats);
      onEarnXp?.(AD_REWARDS.rewardedVideoXp);

      // Refresh state
      syncControllerState();

      return true;
    }

    // Refresh on dismiss too
    syncControllerState();

    return false;
  }, [adsAvailable, onEarnTreats, onEarnXp, syncControllerState]);

  const openAdPrivacyOptions = useCallback(async (): Promise<boolean> => {
    const result = await showAdPrivacyOptions();
    syncControllerState();
    return result.opened;
  }, [syncControllerState]);

  const value: AdContextValue = {
    adsAvailable,
    canShowRewarded: canShow,
    remainingToday: remaining,
    googleConsentReady,
    privacyOptionsRequired,
    openAdPrivacyOptions,
    watchRewardedAd,
    rewardTreats: AD_REWARDS.rewardedVideoTreats,
    rewardXp: AD_REWARDS.rewardedVideoXp,
    setCurrentMood,
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
      adsAvailable: false,
      canShowRewarded: false,
      remainingToday: 0,
      googleConsentReady: false,
      privacyOptionsRequired: false,
      openAdPrivacyOptions: async () => false,
      watchRewardedAd: async () => false,
      rewardTreats: 0,
      rewardXp: 0,
      setCurrentMood: () => {},
    };
  }
  return context;
}
