import { beforeEach, describe, expect, it } from 'vitest';

import {
  canShowRewardedAd,
  disableAds,
  getAdState,
  getRemainingRewardedAds,
  initializeAds,
  isAdSdkAvailable,
  isRewardedAdsSupported,
  refreshAdPrivacyOptionsStatus,
  showAdPrivacyOptions,
  showRewardedAd,
} from '../adController';

describe('Ads OFF controller compatibility boundary', () => {
  beforeEach(() => {
    disableAds({ clearPrivacyOptions: true });
  });

  it('keeps every native capability entry point fail-closed', async () => {
    await expect(initializeAds()).resolves.toBe(false);
    await expect(refreshAdPrivacyOptionsStatus()).resolves.toEqual({
      canRequestAds: false,
      privacyOptionsRequired: false,
      error: 'ads_off',
    });
    await expect(showAdPrivacyOptions()).resolves.toMatchObject({
      opened: false,
      error: 'ads_off',
    });

    expect(isRewardedAdsSupported()).toBe(false);
    expect(isAdSdkAvailable()).toBe(false);
    expect(canShowRewardedAd('okay', 'optional_rewards')).toEqual({
      allowed: false,
      reason: 'ads_off',
    });
  });

  it('never creates a reward or reward-ledger state', async () => {
    await expect(showRewardedAd({ currentMood: 'okay', zone: 'optional_rewards' })).resolves.toEqual({
      success: false,
      rewarded: false,
      error: 'ads_off',
    });

    expect(getRemainingRewardedAds()).toBe(0);
    expect(getAdState()).toMatchObject({
      sdkAvailable: false,
      canRequestAds: false,
      rewardedReady: false,
      sessionAdCount: 0,
      lastAdTime: 0,
      lastDismissTime: 0,
    });
  });
});
