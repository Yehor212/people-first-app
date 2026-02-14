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
} from '@/lib/adController';
import { AD_REWARDS } from '@/lib/adConfig';

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

  /** Show a rewarded ad. Returns true if user earned the reward. */
  watchRewardedAd: () => Promise<boolean>;

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
}

export function AdProvider({
  children,
  onEarnTreats,
  onEarnXp,
  adConsent = false,
  isPremium = false,
}: AdProviderProps) {
  const [adsAvailable, setAdsAvailable] = useState(false);
  const [canShow, setCanShow] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const currentMoodRef = useRef<string>('okay');

  // Initialize SDK
  useEffect(() => {
    if (isPremium || !adConsent) {
      setAdsAvailable(false);
      return;
    }

    void initializeAds().then((available) => {
      setAdsAvailable(available);
      if (available) {
        setRemaining(getRemainingRewardedAds());
        const check = canShowRewardedAd(currentMoodRef.current);
        setCanShow(check.allowed);
      }
    }).catch(() => {});
  }, [adConsent, isPremium]);

  // Refresh can-show status periodically
  useEffect(() => {
    if (!adsAvailable) return;

    const interval = setInterval(() => {
      const check = canShowRewardedAd(currentMoodRef.current);
      setCanShow(check.allowed);
      setRemaining(getRemainingRewardedAds());
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

  const watchRewardedAd = useCallback(async (): Promise<boolean> => {
    if (!adsAvailable) return false;

    const check = canShowRewardedAd(currentMoodRef.current);
    if (!check.allowed) return false;

    const result = await showRewardedAd();

    if (result.success && result.rewarded) {
      onEarnTreats?.(AD_REWARDS.rewardedVideoTreats);
      onEarnXp?.(AD_REWARDS.rewardedVideoXp);

      // Refresh state
      setRemaining(getRemainingRewardedAds());
      const newCheck = canShowRewardedAd(currentMoodRef.current);
      setCanShow(newCheck.allowed);

      return true;
    }

    // Refresh on dismiss too
    const newCheck = canShowRewardedAd(currentMoodRef.current);
    setCanShow(newCheck.allowed);

    return false;
  }, [adsAvailable, onEarnTreats, onEarnXp]);

  const value: AdContextValue = {
    adsAvailable,
    canShowRewarded: canShow,
    remainingToday: remaining,
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
      watchRewardedAd: async () => false,
      rewardTreats: 0,
      rewardXp: 0,
      setCurrentMood: () => {},
    };
  }
  return context;
}
