/**
 * Compatibility context for the compile-time Ads-OFF release.
 *
 * It preserves the consumer API while exposing only unavailable/no-op values.
 * No advertising SDK operation or reward transfer is reachable from this tree.
 */

import { createContext, useContext, type ReactNode } from 'react';

interface AdContextValue {
  adsSupported: boolean;
  adsAvailable: boolean;
  canShowRewarded: boolean;
  remainingToday: number;
  googleConsentReady: boolean;
  privacyOptionsRequired: boolean;
  openAdPrivacyOptions: () => Promise<boolean>;
  watchRewardedAd: (zone?: string) => Promise<boolean>;
  rewardTreats: number;
  rewardXp: number;
  setCurrentMood: (mood: string) => void;
}

const adsOffValue: AdContextValue = {
  adsSupported: false,
  adsAvailable: false,
  canShowRewarded: false,
  remainingToday: 0,
  googleConsentReady: false,
  privacyOptionsRequired: false,
  openAdPrivacyOptions: async () => false,
  watchRewardedAd: async (_zone?: string) => false,
  rewardTreats: 0,
  rewardXp: 0,
  setCurrentMood: (_mood: string) => undefined,
};

const AdContext = createContext<AdContextValue>(adsOffValue);

interface AdProviderProps {
  children: ReactNode;
  adConsent?: boolean;
  isPremium?: boolean;
  currentMood?: string | null;
}

export function AdProvider({
  children,
  adConsent: _adConsent,
  isPremium: _isPremium,
  currentMood: _currentMood,
}: AdProviderProps) {
  return <AdContext.Provider value={adsOffValue}>{children}</AdContext.Provider>;
}

export function useAds(): AdContextValue {
  return useContext(AdContext);
}
