import { beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({
  adMob: {
    initialize: vi.fn(async () => undefined),
    requestConsentInfo: vi.fn(async () => ({
      status: 'NOT_REQUIRED',
      isConsentFormAvailable: false,
      canRequestAds: true,
      privacyOptionsRequirementStatus: 'NOT_REQUIRED',
    })),
    showConsentForm: vi.fn(async () => undefined),
    showPrivacyOptionsForm: vi.fn(async () => undefined),
    prepareRewardVideoAd: vi.fn(async () => undefined),
    showRewardVideoAd: vi.fn(async () => undefined),
    addListener: vi.fn(async () => ({ remove: vi.fn(async () => undefined) })),
  },
}));

vi.mock('@/lib/platform', () => ({ isNative: true, platform: 'android' }));
vi.mock('@/lib/logger', () => ({ logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/env', () => ({ IS_DEV: false }));
vi.mock('@/lib/adConfig', () => ({
  AD_FREQUENCY: { maxRewardedPerDay: 5, minIntervalMs: 1, maxRewardedPerSession: 3, dismissCooldownMs: 1 },
  AD_MOOD_RULES: { blockedMoods: [], reducedMoods: [], reducedMaxPerSession: 1 },
  AD_SACRED_ZONES: [],
  getRewardedAdUnitId: vi.fn(() => 'test-only-unit'),
  hasRewardedAdUnitId: vi.fn(() => true),
  isGoogleTestAdUnit: vi.fn(() => false),
}));
vi.mock('@/lib/storageKeys', () => ({ SK: { ONBOARDING_STATE: 'onboarding', AD_COUNT_DATE: 'date', AD_DAILY_REWARDED: 'count', AD_LAST_SHOWN: 'last' } }));
vi.mock('@/lib/safeJson', () => ({
  safeJsonParse: vi.fn(() => ({ isNewUser: false, daysActive: 4 })),
  storageGetRaw: vi.fn(() => null),
  storageSetRaw: vi.fn(),
}));
vi.mock('@capacitor-community/admob', () => ({
  AdMob: harness.adMob,
  MaxAdContentRating: { General: 'General' },
  AdmobConsentStatus: { REQUIRED: 'REQUIRED' },
  PrivacyOptionsRequirementStatus: { REQUIRED: 'REQUIRED' },
  RewardAdPluginEvents: {},
}));

describe('T222 ADS_OFF controller contract', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('does not construct or call AdMob or UMP from reachable native entry points while the ADR is undecided', async () => {
    const { initializeAds, refreshAdPrivacyOptionsStatus, showAdPrivacyOptions, showRewardedAd } = await import('../adController');

    await expect(initializeAds()).resolves.toBe(false);
    await expect(refreshAdPrivacyOptionsStatus()).resolves.toMatchObject({ error: 'ads_off' });
    await expect(showAdPrivacyOptions()).resolves.toMatchObject({ error: 'ads_off' });
    await expect(showRewardedAd({ zone: 'optional_rewards' })).resolves.toMatchObject({ error: 'ads_off' });

    expect(harness.adMob.initialize).not.toHaveBeenCalled();
    expect(harness.adMob.requestConsentInfo).not.toHaveBeenCalled();
    expect(harness.adMob.showConsentForm).not.toHaveBeenCalled();
    expect(harness.adMob.showPrivacyOptionsForm).not.toHaveBeenCalled();
    expect(harness.adMob.prepareRewardVideoAd).not.toHaveBeenCalled();
    expect(harness.adMob.showRewardVideoAd).not.toHaveBeenCalled();
    expect(harness.adMob.addListener).not.toHaveBeenCalled();
  });
});
