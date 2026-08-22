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
  refreshRewardedAdsServiceGate,
  disableAds,
  isRewardedAdsSupported,
  type AdPremiumStatus,
  type RewardedMoodSignal,
} from '@/lib/adController';
import { AD_REWARDS, type AdSafeZone } from '@/lib/adConfig';
import { logger } from '@/lib/logger';
import {
  beginRewardedAdAttempt,
  settleRewardedAdAttempt,
} from '@/features/ads/rewardedAttemptLedger';
import { triggerDataRefresh } from '@/hooks/useIndexedDB';

// ============================================
// TYPES
// ============================================

interface AdContextValue {
  /** Whether this native build has a configured rewarded-ad capability */
  adsSupported: boolean;

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
  setCurrentMood: (mood: RewardedMoodSignal | null) => void;
}

const AdContext = createContext<AdContextValue | null>(null);

// ============================================
// PROVIDER
// ============================================

interface AdProviderProps {
  children: ReactNode;
  /** Whether user has ad consent (GDPR) */
  adConsent?: boolean;
  /** Verified entitlement state. Unknown fails closed. */
  premiumStatus?: AdPremiumStatus;
  /** Latest timestamped mood used only as a recent suppression signal. */
  currentMood?: RewardedMoodSignal | null;
}

export function AdProvider({
  children,
  adConsent = false,
  premiumStatus = 'unknown',
  currentMood,
}: AdProviderProps) {
  const [adsAvailable, setAdsAvailable] = useState(false);
  const [canShow, setCanShow] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [googleConsentReady, setGoogleConsentReady] = useState(false);
  const [privacyOptionsRequired, setPrivacyOptionsRequired] = useState(false);
  const currentMoodRef = useRef<RewardedMoodSignal | null>(null);

  const getOptionalRewardGate = useCallback(
    () => ({
      moodSignal: currentMoodRef.current,
      premiumStatus,
      zone: 'optional_rewards' as const,
    }),
    [premiumStatus],
  );

  const syncControllerState = useCallback(() => {
    const controllerState = getAdState();
    setGoogleConsentReady(controllerState.canRequestAds);
    setPrivacyOptionsRequired(controllerState.privacyOptionsRequired);
    setRemaining(getRemainingRewardedAds());
    const check = canShowRewardedAd(getOptionalRewardGate());
    setCanShow(check.allowed);
    setAdsAvailable(controllerState.sdkAvailable);
  }, [getOptionalRewardGate]);

  const syncPrivacyOptionsOnly = useCallback(() => {
    const controllerState = getAdState();
    setGoogleConsentReady(controllerState.canRequestAds);
    setPrivacyOptionsRequired(controllerState.privacyOptionsRequired);
    setRemaining(0);
    setCanShow(false);
    setAdsAvailable(false);
  }, []);

  useEffect(() => {
    currentMoodRef.current = currentMood ?? null;
    const check = canShowRewardedAd({
      moodSignal: currentMood ?? null,
      premiumStatus,
      zone: 'optional_rewards',
    });
    setCanShow(check.allowed);
  }, [currentMood, premiumStatus]);

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

    if (premiumStatus !== 'free') {
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
        const check = canShowRewardedAd(getOptionalRewardGate());
        setCanShow(check.allowed);
      }
    }).catch(err => {
      if (!cancelled) logger.warn('[Ads]', 'Ad init failed:', err);
    });

    return () => {
      cancelled = true;
    };
  }, [adConsent, getOptionalRewardGate, premiumStatus, syncControllerState, syncPrivacyOptionsOnly]);

  // Refresh can-show status periodically
  useEffect(() => {
    if (!adsAvailable) return;

    const interval = setInterval(() => {
      void refreshRewardedAdsServiceGate({ force: true })
        .catch(err => {
          logger.warn('[Ads]', 'Service gate refresh failed:', err);
          return false;
        })
        .finally(syncControllerState);
    }, 60_000);

    return () => clearInterval(interval);
  }, [adsAvailable, syncControllerState]);

  const setCurrentMood = useCallback((mood: RewardedMoodSignal | null) => {
    currentMoodRef.current = mood;
    if (adsAvailable) {
      const check = canShowRewardedAd({
        moodSignal: mood,
        premiumStatus,
        zone: 'optional_rewards',
      });
      setCanShow(check.allowed);
    }
  }, [adsAvailable, premiumStatus]);

  const watchRewardedAd = useCallback(async (zone: AdSafeZone = 'optional_rewards'): Promise<boolean> => {
    if (!adsAvailable) return false;

    const gate = {
      moodSignal: currentMoodRef.current,
      premiumStatus,
      zone,
    };
    const check = canShowRewardedAd(gate);
    if (!check.allowed) return false;

    let attempt: Awaited<ReturnType<typeof beginRewardedAdAttempt>>;
    try {
      attempt = await beginRewardedAdAttempt();
    } catch (error) {
      logger.warn('[Ads]', 'Unable to persist rewarded attempt; ad request blocked:', error);
      return false;
    }
    if (attempt.status !== 'created') return false;

    let result: Awaited<ReturnType<typeof showRewardedAd>>;
    try {
      result = await showRewardedAd({
        ...gate,
        ssvCustomData: attempt.attemptId,
      });
    } catch (error) {
      logger.warn('[Ads]', 'Rewarded ad show failed:', error);
      result = { success: false, rewarded: false, error: 'dismissed_or_failed' };
    }

    const earned = result.success && result.rewarded;
    try {
      const settlement = await settleRewardedAdAttempt({
        attemptId: attempt.attemptId,
        expectedOwnerUserId: attempt.ownerUserId,
        outcome: earned ? 'earned' : 'dismissed',
      });

      if (earned && (settlement.status === 'earned' || settlement.status === 'already-earned')) {
        try {
          await triggerDataRefresh();
        } catch (error) {
          logger.warn('[Ads]', 'Reward committed but mounted state refresh failed:', error);
        }
        syncControllerState();
        return true;
      }
    } catch (error) {
      logger.warn('[Ads]', 'Rewarded attempt settlement failed:', error);
    }

    syncControllerState();
    return false;
  }, [adsAvailable, premiumStatus, syncControllerState]);

  const openAdPrivacyOptions = useCallback(async (): Promise<boolean> => {
    const result = await showAdPrivacyOptions();
    syncControllerState();
    return result.opened;
  }, [syncControllerState]);

  const value: AdContextValue = {
    adsSupported: isRewardedAdsSupported(),
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
      adsSupported: false,
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
