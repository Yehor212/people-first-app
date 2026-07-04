import { beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => {
  type Listener = (payload?: unknown) => void;

  const storage: Record<string, string | null> = {};
  const listeners = new Map<string, Listener[]>();

  const addListener = vi.fn((eventName: string, listener: Listener) => {
    const list = listeners.get(eventName) ?? [];
    list.push(listener);
    listeners.set(eventName, list);

    return Promise.resolve({
      remove: vi.fn(() => {
        const current = listeners.get(eventName) ?? [];
        listeners.set(eventName, current.filter((candidate) => candidate !== listener));
        return Promise.resolve();
      }),
    });
  });

  const adMob = {
    initialize: vi.fn(() => Promise.resolve()),
    requestConsentInfo: vi.fn(() => Promise.resolve({
      status: 'NOT_REQUIRED',
      isConsentFormAvailable: false,
      canRequestAds: true,
      privacyOptionsRequirementStatus: 'NOT_REQUIRED',
    })),
    showConsentForm: vi.fn(() => Promise.resolve({
      status: 'OBTAINED',
      isConsentFormAvailable: true,
      canRequestAds: true,
      privacyOptionsRequirementStatus: 'REQUIRED',
    })),
    showPrivacyOptionsForm: vi.fn(() => Promise.resolve({
      status: 'OBTAINED',
      isConsentFormAvailable: true,
      canRequestAds: true,
      privacyOptionsRequirementStatus: 'NOT_REQUIRED',
    })),
    prepareRewardVideoAd: vi.fn(() => Promise.resolve()),
    showRewardVideoAd: vi.fn(() => Promise.resolve()),
    addListener,
  };

  return {
    storage,
    listeners,
    adMob,
    emit(eventName: string, payload?: unknown) {
      for (const listener of listeners.get(eventName) ?? []) {
        listener(payload);
      }
    },
    reset() {
      for (const key of Object.keys(storage)) delete storage[key];
      storage['zenflow_onboarding_state'] = JSON.stringify({ isNewUser: true, daysActive: 4 });
      listeners.clear();
      Object.values(adMob).forEach((mock) => {
        if (typeof mock === 'function' && 'mockClear' in mock) {
          mock.mockClear();
        }
      });
      adMob.requestConsentInfo.mockImplementation(() => Promise.resolve({
        status: 'NOT_REQUIRED',
        isConsentFormAvailable: false,
        canRequestAds: true,
        privacyOptionsRequirementStatus: 'NOT_REQUIRED',
      }));
      adMob.showConsentForm.mockImplementation(() => Promise.resolve({
        status: 'OBTAINED',
        isConsentFormAvailable: true,
        canRequestAds: true,
        privacyOptionsRequirementStatus: 'REQUIRED',
      }));
      adMob.showPrivacyOptionsForm.mockImplementation(() => Promise.resolve({
        status: 'OBTAINED',
        isConsentFormAvailable: true,
        canRequestAds: true,
        privacyOptionsRequirementStatus: 'NOT_REQUIRED',
      }));
      adMob.prepareRewardVideoAd.mockImplementation(() => Promise.resolve());
      adMob.showRewardVideoAd.mockImplementation(() => Promise.resolve());
    },
  };
});

vi.mock('@/lib/platform', () => ({
  isNative: true,
  platform: 'android',
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/lib/env', () => ({
  IS_DEV: false,
  ADMOB_REWARDED_ID_ANDROID: 'ca-app-pub-9501460293702808/1381197135',
  ADMOB_BANNER_ID_ANDROID: '',
  ADMOB_REWARDED_ID_IOS: '',
  ADMOB_BANNER_ID_IOS: '',
}));

vi.mock('@/lib/adConfig', () => ({
  AD_FREQUENCY: {
    maxRewardedPerDay: 5,
    minIntervalMs: 3 * 60 * 1000,
    maxRewardedPerSession: 3,
    dismissCooldownMs: 10 * 60 * 1000,
  },
  AD_MOOD_RULES: {
    blockedMoods: ['terrible', 'bad'],
    reducedMoods: [],
    reducedMaxPerSession: 1,
  },
  getRewardedAdUnitId: vi.fn(() => 'ca-app-pub-9501460293702808/1381197135'),
  hasRewardedAdUnitId: vi.fn(() => true),
  isGoogleTestAdUnit: vi.fn(() => false),
}));

vi.mock('@/lib/storageKeys', () => ({
  SK: {
    AD_DAILY_REWARDED: 'zenflow-ad-rewarded-count',
    AD_COUNT_DATE: 'zenflow-ad-count-date',
    AD_LAST_SHOWN: 'zenflow-ad-last-shown',
    ONBOARDING_STATE: 'zenflow_onboarding_state',
  },
}));

vi.mock('@/lib/safeJson', () => ({
  safeJsonParse: vi.fn((json: string | null | undefined, fallback: unknown) => {
    if (!json) return fallback;
    try {
      return JSON.parse(json);
    } catch {
      return fallback;
    }
  }),
  storageGetRaw: vi.fn((key: string) => harness.storage[key] ?? null),
  storageSetRaw: vi.fn((key: string, val: string) => {
    harness.storage[key] = val;
  }),
}));

vi.mock('@capacitor-community/admob', () => ({
  AdMob: harness.adMob,
  MaxAdContentRating: { General: 'General' },
  AdmobConsentStatus: {
    REQUIRED: 'REQUIRED',
    OBTAINED: 'OBTAINED',
    NOT_REQUIRED: 'NOT_REQUIRED',
  },
  PrivacyOptionsRequirementStatus: {
    REQUIRED: 'REQUIRED',
    NOT_REQUIRED: 'NOT_REQUIRED',
    UNKNOWN: 'UNKNOWN',
  },
  RewardAdPluginEvents: {
    Loaded: 'onRewardedVideoAdLoaded',
    FailedToLoad: 'onRewardedVideoAdFailedToLoad',
    Showed: 'onRewardedVideoAdShowed',
    FailedToShow: 'onRewardedVideoAdFailedToShow',
    Dismissed: 'onRewardedVideoAdDismissed',
    Rewarded: 'onRewardedVideoAdReward',
  },
}));

describe('adController native AdMob contracts', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    harness.reset();
  });

  it('tracks and opens the UMP privacy options entry point when required', async () => {
    harness.adMob.requestConsentInfo.mockResolvedValueOnce({
      status: 'NOT_REQUIRED',
      isConsentFormAvailable: false,
      canRequestAds: true,
      privacyOptionsRequirementStatus: 'REQUIRED',
    });

    const { initializeAds, getAdState, showAdPrivacyOptions } = await import('../adController');

    await expect(initializeAds()).resolves.toBe(true);
    expect(getAdState()).toMatchObject({
      canRequestAds: true,
      privacyOptionsRequired: true,
    });

    await expect(showAdPrivacyOptions()).resolves.toMatchObject({
      opened: true,
      canRequestAds: true,
      privacyOptionsRequired: false,
    });
    expect(harness.adMob.showPrivacyOptionsForm).toHaveBeenCalledTimes(1);
  });

  it('requires canRequestAds=true before enabling ad requests', async () => {
    harness.adMob.requestConsentInfo.mockResolvedValueOnce({
      status: 'NOT_REQUIRED',
      isConsentFormAvailable: false,
      canRequestAds: false,
      privacyOptionsRequirementStatus: 'REQUIRED',
    });

    const { initializeAds, getAdState } = await import('../adController');

    await expect(initializeAds()).resolves.toBe(false);
    expect(getAdState()).toMatchObject({
      sdkAvailable: false,
      canRequestAds: false,
      privacyOptionsRequired: true,
    });
  });

  it('does not enable or preload ads after local ad consent is revoked during initialization', async () => {
    let resolveConsentInfo: (value: {
      status: string;
      isConsentFormAvailable: boolean;
      canRequestAds: boolean;
      privacyOptionsRequirementStatus: string;
    }) => void;
    const pendingConsentInfo = new Promise<{
      status: string;
      isConsentFormAvailable: boolean;
      canRequestAds: boolean;
      privacyOptionsRequirementStatus: string;
    }>((resolve) => {
      resolveConsentInfo = resolve;
    });
    harness.adMob.requestConsentInfo.mockReturnValueOnce(pendingConsentInfo);

    const { disableAds, getAdState, initializeAds } = await import('../adController');

    const initialize = initializeAds();
    await Promise.resolve();

    disableAds({ clearPrivacyOptions: false });
    resolveConsentInfo!({
      status: 'NOT_REQUIRED',
      isConsentFormAvailable: false,
      canRequestAds: true,
      privacyOptionsRequirementStatus: 'REQUIRED',
    });

    await expect(initialize).resolves.toBe(false);
    expect(getAdState()).toMatchObject({
      initialized: false,
      sdkAvailable: false,
      canRequestAds: false,
      rewardedReady: false,
      privacyOptionsRequired: false,
    });
    expect(harness.adMob.prepareRewardVideoAd).not.toHaveBeenCalled();
  });

  it('blocks rewarded ad prompts for low mood states', async () => {
    const { initializeAds, canShowRewardedAd } = await import('../adController');

    await expect(initializeAds()).resolves.toBe(true);

    expect(canShowRewardedAd('bad')).toEqual({
      allowed: false,
      reason: 'mood_blocked',
    });
    expect(canShowRewardedAd('terrible')).toEqual({
      allowed: false,
      reason: 'mood_blocked',
    });
  });

  it('blocks rewarded ads during the first three onboarding days', async () => {
    const { initializeAds, canShowRewardedAd } = await import('../adController');

    harness.storage['zenflow_onboarding_state'] = JSON.stringify({ isNewUser: true, daysActive: 1 });
    await expect(initializeAds()).resolves.toBe(false);

    expect(canShowRewardedAd('okay')).toEqual({
      allowed: false,
      reason: 'onboarding_grace_period',
    });
    expect(harness.adMob.prepareRewardVideoAd).not.toHaveBeenCalled();
  });

  it('does not grant a reward when the rewarded ad is dismissed before the reward event', async () => {
    const { initializeAds, showRewardedAd, getRemainingRewardedAds } = await import('../adController');
    await expect(initializeAds()).resolves.toBe(true);

    harness.adMob.showRewardVideoAd.mockImplementationOnce(async () => {
      harness.emit('onRewardedVideoAdDismissed');
    });

    const result = await showRewardedAd();

    expect(result).toMatchObject({
      success: false,
      rewarded: false,
      error: 'dismissed_or_failed',
    });
    expect(getRemainingRewardedAds()).toBe(5);
  });

  it('grants a reward only after the rewarded event fires', async () => {
    const { initializeAds, showRewardedAd, getRemainingRewardedAds } = await import('../adController');
    await expect(initializeAds()).resolves.toBe(true);

    harness.adMob.showRewardVideoAd.mockImplementationOnce(async () => {
      harness.emit('onRewardedVideoAdReward', { type: 'treats', amount: 1 });
      harness.emit('onRewardedVideoAdDismissed');
    });

    const result = await showRewardedAd();

    expect(result).toMatchObject({
      success: true,
      rewarded: true,
    });
    expect(getRemainingRewardedAds()).toBe(4);
  });
});
