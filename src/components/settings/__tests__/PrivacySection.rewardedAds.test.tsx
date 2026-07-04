import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PrivacySection } from '@/components/settings/PrivacySection';
import type { PrivacySettings } from '@/types';

const adState = vi.hoisted(() => ({
  watchRewardedAd: vi.fn(() => Promise.resolve(true)),
  openAdPrivacyOptions: vi.fn(() => Promise.resolve(true)),
}));

vi.mock('@/contexts/AdContext', () => ({
  useAds: () => ({
    adsAvailable: true,
    canShowRewarded: true,
    remainingToday: 2,
    googleConsentReady: true,
    privacyOptionsRequired: true,
    openAdPrivacyOptions: adState.openAdPrivacyOptions,
    watchRewardedAd: adState.watchRewardedAd,
    rewardTreats: 20,
    rewardXp: 5,
    setCurrentMood: vi.fn(),
  }),
}));

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: {
      privacyTitle: 'Privacy',
      privacyDescription: 'Control privacy settings.',
      privacyNoTracking: 'No tracking',
      privacyNoTrackingHint: 'Disable analytics and ads.',
      privacyAnalytics: 'Analytics',
      privacyAnalyticsHint: 'Help improve the app.',
      privacyAds: 'Rewarded ads',
      privacyAdsHint: 'Optional rewarded ads after consent.',
      privacyPolicy: 'Privacy Policy',
      termsOfService: 'Terms of Service',
      adPrivacyOptions: 'Google ad privacy choices',
      adPrivacyOptionsHint: 'Change or withdraw Google ad consent where required.',
      adPrivacyOptionsOpen: 'Review ad choices',
      adWatchToEarn: 'Optional ad: watch for a small bonus',
      adWatch: 'Watch optional ad',
      adRewardLabel: '+{treats} treats',
      adRemainingToday: 'Daily optional limit applies',
    },
  }),
}));

vi.mock('@/lib/env', () => ({
  BASE_URL: '/people-first-app/',
  IS_DEV: false,
}));

describe('PrivacySection rewarded ads controls', () => {
  it('keeps rewarded playback out of the privacy control surface', () => {
    const privacy: PrivacySettings = {
      noTracking: false,
      analytics: true,
      adConsent: true,
    };

    render(<PrivacySection privacy={privacy} onPrivacyChange={vi.fn()} />);

    expect(screen.queryByRole('button', { name: /optional ad/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Review ad choices' })).toBeInTheDocument();
  });

  it('keeps Google privacy choices user initiated without starting rewarded playback', () => {
    const privacy: PrivacySettings = {
      noTracking: false,
      analytics: true,
      adConsent: true,
    };

    render(<PrivacySection privacy={privacy} onPrivacyChange={vi.fn()} />);

    expect(adState.watchRewardedAd).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Review ad choices' }));
    expect(adState.openAdPrivacyOptions).toHaveBeenCalledTimes(1);
    expect(adState.watchRewardedAd).not.toHaveBeenCalled();
  });
});
