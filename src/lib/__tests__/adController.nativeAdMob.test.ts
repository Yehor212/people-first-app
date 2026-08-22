import { beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => {
  type Listener = (payload?: unknown) => void;

  const storage: Record<string, string | null> = {};
  const listeners = new Map<string, Listener[]>();
  const callOrder: string[] = [];

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
    initialize: vi.fn(() => {
      callOrder.push('initialize');
      return Promise.resolve();
    }),
    requestConsentInfo: vi.fn(() => {
      callOrder.push('consent');
      return Promise.resolve({
        status: 'NOT_REQUIRED',
        isConsentFormAvailable: false,
        canRequestAds: true,
        privacyOptionsRequirementStatus: 'NOT_REQUIRED',
      });
    }),
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
    callOrder,
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
      callOrder.length = 0;
      Object.values(adMob).forEach((mock) => {
        if (typeof mock === 'function' && 'mockClear' in mock) {
          mock.mockClear();
        }
      });
      adMob.initialize.mockImplementation(() => {
        callOrder.push('initialize');
        return Promise.resolve();
      });
      adMob.requestConsentInfo.mockImplementation(() => {
        callOrder.push('consent');
        return Promise.resolve({
          status: 'NOT_REQUIRED',
          isConsentFormAvailable: false,
          canRequestAds: true,
          privacyOptionsRequirementStatus: 'NOT_REQUIRED',
        });
      });
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

vi.mock('@/lib/rewardedAdsGate', () => ({
  refreshRewardedAdsGate: vi.fn(async () => true),
  isRewardedAdsGateOpen: vi.fn(() => true),
}));

vi.mock('@/lib/env', () => ({
  IS_DEV: false,
  ADMOB_REWARDED_ID_ANDROID: 'ca-app-pub-3940256099942544/5224354917',
  ADMOB_REWARDED_ID_IOS: '',
  ADMOB_AGE_RESTRICTED_TREATMENT: 'teen',
  ADMOB_CHILD_DIRECTED_TREATMENT: false,
  ADMOB_UNDER_AGE_OF_CONSENT: false,
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
    suppressionWindowMs: 2 * 60 * 60 * 1000,
  },
  AD_SAFE_ZONES: ['optional_rewards'],
  AD_SACRED_ZONES: [
    'focus_active',
    'breathing_active',
    'mood_logging',
    'journaling',
    'meditation',
    'onboarding',
  ],
  getRewardedAdUnitId: vi.fn(() => 'ca-app-pub-3940256099942544/5224354917'),
  hasRewardedAdUnitId: vi.fn(() => true),
  isGoogleTestAdUnit: vi.fn(() => false),
}));

vi.mock('@/lib/storageKeys', () => ({
  SK: {
    AD_DAILY_REWARDED: 'zenflow-ad-rewarded-count',
    AD_COUNT_DATE: 'zenflow-ad-count-date',
    AD_LAST_SHOWN: 'zenflow-ad-last-shown',
    AD_LAST_DISMISS: 'zenflow-ad-last-dismiss',
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
    vi.useRealTimers();
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

  it('completes the current UMP request boundary before GMA initialization', async () => {
    const { initializeAds } = await import('../adController');

    await expect(initializeAds()).resolves.toBe(true);

    expect(harness.callOrder).toEqual(['consent', 'initialize']);
  });

  it('passes the current teen age treatment to Android GMA initialization', async () => {
    const { initializeAds } = await import('../adController');

    await expect(initializeAds()).resolves.toBe(true);

    expect(harness.adMob.initialize).toHaveBeenCalledWith(expect.objectContaining({
      ageRestrictedTreatment: 'teen',
      maxAdContentRating: 'General',
    }));
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

  it('initializes the SDK without preloading rewarded inventory before user opt-in', async () => {
    const { initializeAds, getAdState } = await import('../adController');

    await expect(initializeAds()).resolves.toBe(true);

    expect(getAdState()).toMatchObject({
      sdkAvailable: true,
      rewardedReady: false,
    });
    expect(harness.adMob.prepareRewardVideoAd).not.toHaveBeenCalled();
  });

  it('does not preload rewarded inventory after opening privacy options', async () => {
    const { initializeAds, showAdPrivacyOptions, getAdState } = await import('../adController');

    await expect(initializeAds()).resolves.toBe(true);
    harness.adMob.prepareRewardVideoAd.mockClear();

    await expect(showAdPrivacyOptions()).resolves.toMatchObject({ opened: true });

    expect(getAdState()).toMatchObject({
      sdkAvailable: true,
      rewardedReady: false,
    });
    expect(harness.adMob.prepareRewardVideoAd).not.toHaveBeenCalled();
  });

  it('prepares rewarded inventory only after explicit optional opt-in with opaque SSV binding', async () => {
    const { initializeAds, showRewardedAd } = await import('../adController');

    await expect(initializeAds()).resolves.toBe(true);
    harness.adMob.prepareRewardVideoAd.mockClear();
    harness.adMob.showRewardVideoAd.mockImplementationOnce(async () => {
      harness.emit('onRewardedVideoAdReward', { type: 'treats', amount: 1 });
    });

    await expect(showRewardedAd({
      zone: 'optional_rewards',
      premiumStatus: 'free',
      ssvCustomData: '22222222-2222-4222-8222-222222222222',
    })).resolves.toMatchObject({
      success: true,
      rewarded: true,
    });

    expect(harness.adMob.prepareRewardVideoAd).toHaveBeenCalledWith({
      adId: 'ca-app-pub-3940256099942544/5224354917',
      isTesting: false,
      npa: true,
      ssv: { customData: '22222222-2222-4222-8222-222222222222' },
    });
    expect(harness.adMob.showRewardVideoAd).toHaveBeenCalledTimes(1);
  });

  it('rejects a direct rewarded show that has no durable-attempt binding', async () => {
    const { initializeAds, showRewardedAd } = await import('../adController');

    await expect(initializeAds()).resolves.toBe(true);
    await expect(
      showRewardedAd({ zone: 'optional_rewards', premiumStatus: 'free' }),
    ).resolves.toEqual({
      success: false,
      rewarded: false,
      error: 'attempt_unbound',
    });
    expect(harness.adMob.prepareRewardVideoAd).not.toHaveBeenCalled();
    expect(harness.adMob.showRewardVideoAd).not.toHaveBeenCalled();
  });

  it('blocks onboarding rewarded calls before any ad request or show call', async () => {
    const { initializeAds, showRewardedAd } = await import('../adController');

    await expect(initializeAds()).resolves.toBe(true);
    harness.adMob.prepareRewardVideoAd.mockClear();

    await expect(showRewardedAd({ zone: 'onboarding', premiumStatus: 'free' })).resolves.toEqual({
      success: false,
      rewarded: false,
      error: 'sacred_zone',
    });

    expect(harness.adMob.prepareRewardVideoAd).not.toHaveBeenCalled();
    expect(harness.adMob.showRewardVideoAd).not.toHaveBeenCalled();
  });

  it('does not keep or background-preload rewarded inventory after a dismissed attempt', async () => {
    const { initializeAds, showRewardedAd, getAdState, getRemainingRewardedAds } = await import('../adController');

    await expect(initializeAds()).resolves.toBe(true);
    harness.adMob.prepareRewardVideoAd.mockClear();
    harness.adMob.showRewardVideoAd.mockImplementationOnce(async () => {
      harness.emit('onRewardedVideoAdDismissed');
    });

    await expect(showRewardedAd({
      zone: 'optional_rewards',
      premiumStatus: 'free',
      ssvCustomData: '22222222-2222-4222-8222-222222222222',
    })).resolves.toMatchObject({
      success: false,
      rewarded: false,
      error: 'dismissed_or_failed',
    });
    await Promise.resolve();

    expect(getRemainingRewardedAds()).toBe(5);
    expect(getAdState()).toMatchObject({ rewardedReady: false });
    expect(harness.adMob.prepareRewardVideoAd).toHaveBeenCalledTimes(1);
  });

  it('does not keep or background-preload rewarded inventory after a completed reward', async () => {
    const { initializeAds, showRewardedAd, getAdState, getRemainingRewardedAds } = await import('../adController');

    await expect(initializeAds()).resolves.toBe(true);
    harness.adMob.prepareRewardVideoAd.mockClear();
    harness.adMob.showRewardVideoAd.mockImplementationOnce(async () => {
      harness.emit('onRewardedVideoAdReward', { type: 'treats', amount: 1 });
      harness.emit('onRewardedVideoAdDismissed');
    });

    await expect(showRewardedAd({
      zone: 'optional_rewards',
      premiumStatus: 'free',
      ssvCustomData: '22222222-2222-4222-8222-222222222222',
    })).resolves.toMatchObject({
      success: true,
      rewarded: true,
    });
    await Promise.resolve();

    expect(getRemainingRewardedAds()).toBe(4);
    expect(getAdState()).toMatchObject({ rewardedReady: false });
    expect(harness.adMob.prepareRewardVideoAd).toHaveBeenCalledTimes(1);
  });

  it('blocks rewarded ad prompts for low mood states', async () => {
    const { initializeAds, canShowRewardedAd } = await import('../adController');

    await expect(initializeAds()).resolves.toBe(true);

    expect(canShowRewardedAd({
      zone: 'optional_rewards',
      premiumStatus: 'free',
      moodSignal: { mood: 'bad', recordedAt: Date.now() },
    })).toEqual({
      allowed: false,
      reason: 'mood_blocked',
    });
    expect(canShowRewardedAd({
      zone: 'optional_rewards',
      premiumStatus: 'free',
      moodSignal: { mood: 'terrible', recordedAt: Date.now() },
    })).toEqual({
      allowed: false,
      reason: 'mood_blocked',
    });
  });

  it('blocks rewarded ads during the first three onboarding days', async () => {
    const { initializeAds, canShowRewardedAd } = await import('../adController');

    harness.storage['zenflow_onboarding_state'] = JSON.stringify({ isNewUser: true, daysActive: 1 });
    await expect(initializeAds()).resolves.toBe(false);

    expect(canShowRewardedAd({ zone: 'optional_rewards', premiumStatus: 'free' })).toEqual({
      allowed: false,
      reason: 'onboarding_grace_period',
    });
    expect(harness.adMob.prepareRewardVideoAd).not.toHaveBeenCalled();
  });


  it('blocks rewarded ad prompts for sacred zones through the controller API', async () => {
    const { initializeAds, canShowRewardedAd } = await import('../adController');

    await expect(initializeAds()).resolves.toBe(true);

    expect(canShowRewardedAd({ zone: 'journaling', premiumStatus: 'free' })).toEqual({
      allowed: false,
      reason: 'sacred_zone',
    });
    expect(canShowRewardedAd({ zone: 'focus_active', premiumStatus: 'free' })).toEqual({
      allowed: false,
      reason: 'sacred_zone',
    });
  });

  it('does not request or show rewarded ads from sacred zones when called directly', async () => {
    const { initializeAds, showRewardedAd } = await import('../adController');

    await expect(initializeAds()).resolves.toBe(true);
    harness.adMob.prepareRewardVideoAd.mockClear();

    const result = await showRewardedAd({ zone: 'journaling', premiumStatus: 'free' });

    expect(result).toEqual({
      success: false,
      rewarded: false,
      error: 'sacred_zone',
    });
    expect(harness.adMob.showRewardVideoAd).not.toHaveBeenCalled();
    expect(harness.adMob.prepareRewardVideoAd).not.toHaveBeenCalled();
  });

  it('does not grant a reward when the rewarded ad is dismissed before the reward event', async () => {
    const { initializeAds, showRewardedAd, getRemainingRewardedAds } = await import('../adController');
    await expect(initializeAds()).resolves.toBe(true);

    harness.adMob.showRewardVideoAd.mockImplementationOnce(async () => {
      harness.emit('onRewardedVideoAdDismissed');
    });

    const result = await showRewardedAd({
      zone: 'optional_rewards',
      premiumStatus: 'free',
      ssvCustomData: '22222222-2222-4222-8222-222222222222',
    });

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

    const result = await showRewardedAd({
      zone: 'optional_rewards',
      premiumStatus: 'free',
      ssvCustomData: '22222222-2222-4222-8222-222222222222',
    });

    expect(result).toMatchObject({
      success: true,
      rewarded: true,
    });
    expect(getRemainingRewardedAds()).toBe(4);
  });

  it('defaults missing, unknown and formerly broad zones to denied', async () => {
    const { initializeAds, canShowRewardedAd } = await import('../adController');
    await expect(initializeAds()).resolves.toBe(true);

    expect(canShowRewardedAd({ premiumStatus: 'free' })).toEqual({
      allowed: false,
      reason: 'invalid_zone',
    });
    expect(canShowRewardedAd({ zone: 'daily_rewards', premiumStatus: 'free' })).toEqual({
      allowed: false,
      reason: 'invalid_zone',
    });
    expect(canShowRewardedAd({ zone: 'unknown_zone', premiumStatus: 'free' })).toEqual({
      allowed: false,
      reason: 'invalid_zone',
    });
  });

  it('denies unknown or premium entitlement and only uses recent negative mood as suppression', async () => {
    const { initializeAds, canShowRewardedAd } = await import('../adController');
    await expect(initializeAds()).resolves.toBe(true);

    expect(canShowRewardedAd({ zone: 'optional_rewards', premiumStatus: 'unknown' })).toEqual({
      allowed: false,
      reason: 'premium_unknown',
    });
    expect(canShowRewardedAd({ zone: 'optional_rewards', premiumStatus: 'premium' })).toEqual({
      allowed: false,
      reason: 'premium_user',
    });
    expect(canShowRewardedAd({ zone: 'optional_rewards', premiumStatus: 'free' })).toEqual({
      allowed: true,
    });
    expect(canShowRewardedAd({
      zone: 'optional_rewards',
      premiumStatus: 'free',
      moodSignal: { mood: 'good', recordedAt: Date.now() },
    })).toEqual({ allowed: true });
    expect(canShowRewardedAd({
      zone: 'optional_rewards',
      premiumStatus: 'free',
      moodSignal: {
        mood: 'bad',
        recordedAt: Date.now() - (3 * 60 * 60 * 1000),
      },
    })).toEqual({ allowed: true });
  });

  it('fails closed when the persisted same-day rewarded count is malformed', async () => {
    harness.storage['zenflow-ad-count-date'] = new Date().toDateString();
    harness.storage['zenflow-ad-rewarded-count'] = 'not-a-count';
    const { initializeAds, canShowRewardedAd, getRemainingRewardedAds } =
      await import('../adController');
    await expect(initializeAds()).resolves.toBe(true);

    expect(canShowRewardedAd({ zone: 'optional_rewards', premiumStatus: 'free' })).toEqual({
      allowed: false,
      reason: 'daily_limit',
    });
    expect(getRemainingRewardedAds()).toBe(0);
  });

  it('fails without showing or rewarding when rewarded inventory has no fill', async () => {
    const { initializeAds, showRewardedAd, getRemainingRewardedAds } =
      await import('../adController');
    await expect(initializeAds()).resolves.toBe(true);
    harness.adMob.prepareRewardVideoAd.mockRejectedValueOnce(new Error('no fill'));

    await expect(showRewardedAd({
      zone: 'optional_rewards',
      premiumStatus: 'free',
      ssvCustomData: '22222222-2222-4222-8222-222222222222',
    })).resolves.toEqual({
      success: false,
      rewarded: false,
      error: 'ad_not_ready',
    });
    expect(harness.adMob.showRewardVideoAd).not.toHaveBeenCalled();
    expect(getRemainingRewardedAds()).toBe(5);
  });

  it('enforces the persisted daily cap and in-process session cap', async () => {
    const now = new Date('2026-08-08T12:00:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const controller = await import('../adController');
    await expect(controller.initializeAds()).resolves.toBe(true);

    harness.storage['zenflow-ad-count-date'] = now.toDateString();
    harness.storage['zenflow-ad-rewarded-count'] = '5';
    expect(controller.canShowRewardedAd({
      zone: 'optional_rewards',
      premiumStatus: 'free',
    })).toEqual({ allowed: false, reason: 'daily_limit' });

    delete harness.storage['zenflow-ad-count-date'];
    delete harness.storage['zenflow-ad-rewarded-count'];
    for (let attempt = 0; attempt < 3; attempt += 1) {
      harness.adMob.showRewardVideoAd.mockImplementationOnce(async () => {
        harness.emit('onRewardedVideoAdReward', { type: 'treats', amount: 1 });
      });
      await expect(controller.showRewardedAd({
        zone: 'optional_rewards',
        premiumStatus: 'free',
        ssvCustomData: `22222222-2222-4222-8222-22222222222${attempt}`,
      })).resolves.toMatchObject({ success: true, rewarded: true });
      vi.advanceTimersByTime(3 * 60 * 1000);
    }

    expect(controller.canShowRewardedAd({
      zone: 'optional_rewards',
      premiumStatus: 'free',
    })).toEqual({ allowed: false, reason: 'session_limit' });
    vi.useRealTimers();
  });

  it('persists dismiss cooldown across a controller restart', async () => {
    const first = await import('../adController');
    await expect(first.initializeAds()).resolves.toBe(true);
    harness.adMob.showRewardVideoAd.mockImplementationOnce(async () => {
      harness.emit('onRewardedVideoAdDismissed');
    });

    await expect(
      first.showRewardedAd({
        zone: 'optional_rewards',
        premiumStatus: 'free',
        ssvCustomData: '22222222-2222-4222-8222-222222222222',
      }),
    ).resolves.toMatchObject({ rewarded: false });

    vi.resetModules();
    const restarted = await import('../adController');
    await expect(restarted.initializeAds()).resolves.toBe(true);
    expect(
      restarted.canShowRewardedAd({ zone: 'optional_rewards', premiumStatus: 'free' }),
    ).toEqual({ allowed: false, reason: 'dismiss_cooldown' });
  });

  it('persists rewarded cooldown across a controller restart', async () => {
    const first = await import('../adController');
    await expect(first.initializeAds()).resolves.toBe(true);
    harness.adMob.showRewardVideoAd.mockImplementationOnce(async () => {
      harness.emit('onRewardedVideoAdReward', { type: 'treats', amount: 1 });
    });

    await expect(first.showRewardedAd({
      zone: 'optional_rewards',
      premiumStatus: 'free',
      ssvCustomData: '22222222-2222-4222-8222-222222222222',
    })).resolves.toMatchObject({ success: true, rewarded: true });

    vi.resetModules();
    const restarted = await import('../adController');
    await expect(restarted.initializeAds()).resolves.toBe(true);
    expect(
      restarted.canShowRewardedAd({ zone: 'optional_rewards', premiumStatus: 'free' }),
    ).toEqual({ allowed: false, reason: 'cooldown' });
  });
});
