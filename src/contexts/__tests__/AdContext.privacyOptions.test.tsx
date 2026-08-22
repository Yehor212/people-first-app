import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AdProvider, useAds } from '@/contexts/AdContext';

const adController = vi.hoisted(() => ({
  state: {
    initialized: false,
    sdkAvailable: false,
    canRequestAds: false,
    privacyOptionsRequired: false,
    rewardedReady: false,
    sessionAdCount: 0,
    lastAdTime: 0,
    lastDismissTime: 0,
  },
  refreshAdPrivacyOptionsStatus: vi.fn(async () => {
    adController.state = {
      ...adController.state,
      canRequestAds: false,
      privacyOptionsRequired: true,
    };
    return {
      canRequestAds: false,
      privacyOptionsRequired: true,
    };
  }),
  disableAds: vi.fn(),
}));

vi.mock('@/lib/adController', () => ({
  isRewardedAdsSupported: vi.fn(() => false),
  initializeAds: vi.fn(async () => false),
  canShowRewardedAd: vi.fn(() => ({ allowed: false, reason: 'sdk_unavailable' })),
  showRewardedAd: vi.fn(async () => ({ success: false, rewarded: false })),
  getRemainingRewardedAds: vi.fn(() => 0),
  getAdState: vi.fn(() => adController.state),
  showAdPrivacyOptions: vi.fn(async () => ({
    opened: false,
    canRequestAds: false,
    privacyOptionsRequired: adController.state.privacyOptionsRequired,
  })),
  refreshAdPrivacyOptionsStatus: adController.refreshAdPrivacyOptionsStatus,
  disableAds: adController.disableAds,
}));

vi.mock('@/lib/adConfig', () => ({
  AD_REWARDS: {
    rewardedVideoTreats: 20,
    rewardedVideoXp: 5,
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    warn: vi.fn(),
  },
}));

function Probe() {
  const ads = useAds();

  return <div data-testid="privacy-required">{String(ads.privacyOptionsRequired)}</div>;
}

describe('AdContext Ads-OFF boundary', () => {
  it('does not invoke a privacy or native-ad path when local ad consent is off', () => {
    render(
      <AdProvider adConsent={false} isPremium={false}>
        <Probe />
      </AdProvider>,
    );

    expect(screen.getByTestId('privacy-required')).toHaveTextContent('false');
    expect(adController.disableAds).not.toHaveBeenCalled();
    expect(adController.refreshAdPrivacyOptionsStatus).not.toHaveBeenCalled();
  });
});
