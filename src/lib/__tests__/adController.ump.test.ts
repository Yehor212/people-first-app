import { beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => {
  type Listener = (payload?: unknown) => void;
  type ConsentInfo = {
    status: string;
    isConsentFormAvailable: boolean;
    canRequestAds: boolean;
    privacyOptionsRequirementStatus: string;
  };

  const listeners = new Map<string, Listener[]>();
  const storage: Record<string, string | null> = {};
  const callOrder: string[] = [];
  const audience: {
    ageRestrictedTreatment: 'teen' | null;
    childDirected: boolean | null;
    underAgeOfConsent: boolean | null;
  } = {
    ageRestrictedTreatment: null,
    childDirected: null,
    underAgeOfConsent: null,
  };
  const serviceGate = { open: true };
  let consentInfo: ConsentInfo;

  const adMob = {
    initialize: vi.fn(async () => {
      callOrder.push('initialize');
    }),
    requestConsentInfo: vi.fn(async () => {
      callOrder.push('consent');
      return consentInfo;
    }),
    showConsentForm: vi.fn(async () => consentInfo),
    showPrivacyOptionsForm: vi.fn(async () => undefined),
    prepareRewardVideoAd: vi.fn(async () => undefined),
    showRewardVideoAd: vi.fn(async () => undefined),
    addListener: vi.fn(async (eventName: string, listener: Listener) => {
      const current = listeners.get(eventName) ?? [];
      current.push(listener);
      listeners.set(eventName, current);
      return {
        remove: vi.fn(async () => {
          listeners.set(
            eventName,
            (listeners.get(eventName) ?? []).filter(candidate => candidate !== listener),
          );
        }),
      };
    }),
  };

  return {
    adMob,
    audience,
    callOrder,
    listeners,
    storage,
    serviceGate,
    emit(eventName: string, payload?: unknown) {
      for (const listener of listeners.get(eventName) ?? []) listener(payload);
    },
    setConsentInfo(next: ConsentInfo) {
      consentInfo = next;
    },
    reset() {
      audience.ageRestrictedTreatment = null;
      audience.childDirected = null;
      audience.underAgeOfConsent = null;
      serviceGate.open = true;
      callOrder.length = 0;
      listeners.clear();
      for (const key of Object.keys(storage)) delete storage[key];
      storage.zenflow_onboarding_state = JSON.stringify({ isNewUser: true, daysActive: 4 });
      consentInfo = {
        status: 'NOT_REQUIRED',
        isConsentFormAvailable: false,
        canRequestAds: true,
        privacyOptionsRequirementStatus: 'NOT_REQUIRED',
      };
      vi.clearAllMocks();
      adMob.initialize.mockImplementation(async () => {
        callOrder.push('initialize');
      });
      adMob.requestConsentInfo.mockImplementation(async () => {
        callOrder.push('consent');
        return consentInfo;
      });
      adMob.showConsentForm.mockImplementation(async () => consentInfo);
      adMob.showPrivacyOptionsForm.mockImplementation(async () => undefined);
      adMob.prepareRewardVideoAd.mockImplementation(async () => undefined);
      adMob.showRewardVideoAd.mockImplementation(async () => undefined);
    },
  };
});

vi.mock('@/lib/platform', () => ({ isNative: true, platform: 'android' }));

vi.mock('@/lib/logger', () => ({
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/rewardedAdsGate', () => ({
  refreshRewardedAdsGate: vi.fn(async () => {
    harness.callOrder.push('service_gate');
    return harness.serviceGate.open;
  }),
  isRewardedAdsGateOpen: vi.fn(() => harness.serviceGate.open),
}));

vi.mock('@/lib/env', () => ({
  IS_DEV: false,
  ADMOB_REWARDED_ID_ANDROID: 'ca-app-pub-3940256099942544/5224354917',
  ADMOB_REWARDED_ID_IOS: '',
  get ADMOB_AGE_RESTRICTED_TREATMENT() {
    return harness.audience.ageRestrictedTreatment;
  },
  get ADMOB_CHILD_DIRECTED_TREATMENT() {
    return harness.audience.childDirected;
  },
  get ADMOB_UNDER_AGE_OF_CONSENT() {
    return harness.audience.underAgeOfConsent;
  },
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
  AD_SACRED_ZONES: ['focus_active', 'breathing_active', 'mood_logging', 'journaling', 'meditation', 'onboarding'],
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
  storageSetRaw: vi.fn((key: string, value: string) => {
    harness.storage[key] = value;
  }),
}));

vi.mock('@capacitor-community/admob', () => ({
  AdMob: harness.adMob,
  MaxAdContentRating: { General: 'General' },
  AdmobConsentStatus: { REQUIRED: 'REQUIRED' },
  PrivacyOptionsRequirementStatus: { REQUIRED: 'REQUIRED' },
  RewardAdPluginEvents: {
    Rewarded: 'onRewardedVideoAdReward',
    Dismissed: 'onRewardedVideoAdDismissed',
    FailedToShow: 'onRewardedVideoAdFailedToShow',
  },
}));

function configureAudience(childDirected: boolean, underAgeOfConsent: boolean): void {
  harness.audience.ageRestrictedTreatment = 'teen';
  harness.audience.childDirected = childDirected;
  harness.audience.underAgeOfConsent = underAgeOfConsent;
}

describe('AdMob UMP and audience-treatment boundary', () => {
  beforeEach(() => {
    vi.resetModules();
    harness.reset();
  });

  it('fails closed before UMP or GMA when owner-approved audience treatment is unknown', async () => {
    const { initializeAds, getAdState } = await import('../adController');

    await expect(initializeAds()).resolves.toBe(false);
    expect(getAdState()).toMatchObject({ sdkAvailable: false, canRequestAds: false });
    expect(harness.adMob.requestConsentInfo).not.toHaveBeenCalled();
    expect(harness.adMob.initialize).not.toHaveBeenCalled();
  });

  it('fails closed when only the deprecated audience flags are configured', async () => {
    harness.audience.childDirected = false;
    harness.audience.underAgeOfConsent = true;
    const { initializeAds, getAdState } = await import('../adController');

    await expect(initializeAds()).resolves.toBe(false);
    expect(getAdState()).toMatchObject({ sdkAvailable: false, canRequestAds: false });
    expect(harness.callOrder).toEqual([]);
    expect(harness.adMob.requestConsentInfo).not.toHaveBeenCalled();
    expect(harness.adMob.initialize).not.toHaveBeenCalled();
  });

  it('fails closed at the service-owned gate before importing UMP or initializing GMA', async () => {
    configureAudience(false, false);
    harness.serviceGate.open = false;
    const { initializeAds, getAdState } = await import('../adController');

    await expect(initializeAds()).resolves.toBe(false);
    expect(getAdState()).toMatchObject({ sdkAvailable: false, canRequestAds: false });
    expect(harness.callOrder).toEqual(['service_gate']);
    expect(harness.adMob.requestConsentInfo).not.toHaveBeenCalled();
    expect(harness.adMob.initialize).not.toHaveBeenCalled();
  });

  it.each([
    { childDirected: false, underAgeOfConsent: false },
    { childDirected: true, underAgeOfConsent: true },
  ])('applies explicit owner treatment before GMA initialization: %o', async treatment => {
    configureAudience(treatment.childDirected, treatment.underAgeOfConsent);
    const { initializeAds } = await import('../adController');

    await expect(initializeAds()).resolves.toBe(true);

    expect(harness.callOrder).toEqual(['service_gate', 'consent', 'initialize']);
    expect(harness.adMob.requestConsentInfo).toHaveBeenCalledWith({
      tagForUnderAgeOfConsent: treatment.underAgeOfConsent,
    });
    expect(harness.adMob.initialize).toHaveBeenCalledWith(expect.objectContaining({
      ageRestrictedTreatment: 'teen',
      tagForChildDirectedTreatment: treatment.childDirected,
      tagForUnderAgeOfConsent: treatment.underAgeOfConsent,
    }));
  });

  it('coalesces concurrent initialization behind one current consent refresh', async () => {
    configureAudience(false, false);
    let resolveConsent!: (value: {
      status: string;
      isConsentFormAvailable: boolean;
      canRequestAds: boolean;
      privacyOptionsRequirementStatus: string;
    }) => void;
    harness.adMob.requestConsentInfo.mockImplementationOnce(() => {
      harness.callOrder.push('consent');
      return new Promise(resolve => {
        resolveConsent = resolve;
      });
    });
    const { initializeAds } = await import('../adController');

    const first = initializeAds();
    const second = initializeAds();
    await vi.waitFor(() => expect(harness.adMob.requestConsentInfo).toHaveBeenCalledTimes(1));

    resolveConsent({
      status: 'NOT_REQUIRED',
      isConsentFormAvailable: false,
      canRequestAds: true,
      privacyOptionsRequirementStatus: 'NOT_REQUIRED',
    });
    await expect(Promise.all([first, second])).resolves.toEqual([true, true]);
    expect(harness.adMob.initialize).toHaveBeenCalledTimes(1);
  });

  it('refreshes current consent again after a fresh app-process launch', async () => {
    configureAudience(false, false);
    const firstLaunch = await import('../adController');
    await expect(firstLaunch.initializeAds()).resolves.toBe(true);

    vi.resetModules();
    const secondLaunch = await import('../adController');
    await expect(secondLaunch.initializeAds()).resolves.toBe(true);

    expect(harness.adMob.requestConsentInfo).toHaveBeenCalledTimes(2);
    expect(harness.adMob.initialize).toHaveBeenCalledTimes(2);
  });

  it('keeps initialization and ad requests disabled when the current UMP refresh fails', async () => {
    configureAudience(false, false);
    harness.adMob.requestConsentInfo.mockRejectedValueOnce(new Error('ump unavailable'));
    const { initializeAds, getAdState } = await import('../adController');

    await expect(initializeAds()).resolves.toBe(false);
    expect(getAdState()).toMatchObject({ sdkAvailable: false, canRequestAds: false });
    expect(harness.adMob.initialize).not.toHaveBeenCalled();
    expect(harness.adMob.prepareRewardVideoAd).not.toHaveBeenCalled();
  });

  it('surfaces the current privacy-options requirement without preloading inventory', async () => {
    configureAudience(false, false);
    harness.setConsentInfo({
      status: 'NOT_REQUIRED',
      isConsentFormAvailable: false,
      canRequestAds: true,
      privacyOptionsRequirementStatus: 'REQUIRED',
    });
    const { initializeAds, getAdState } = await import('../adController');

    await expect(initializeAds()).resolves.toBe(true);
    expect(getAdState()).toMatchObject({ privacyOptionsRequired: true, rewardedReady: false });
    expect(harness.adMob.prepareRewardVideoAd).not.toHaveBeenCalled();
  });

  it('revokes load eligibility when refreshed UMP state can no longer request ads', async () => {
    configureAudience(false, false);
    const { initializeAds, showAdPrivacyOptions, showRewardedAd } = await import('../adController');
    await expect(initializeAds()).resolves.toBe(true);
    harness.setConsentInfo({
      status: 'REQUIRED',
      isConsentFormAvailable: true,
      canRequestAds: false,
      privacyOptionsRequirementStatus: 'REQUIRED',
    });

    await expect(showAdPrivacyOptions()).resolves.toMatchObject({
      opened: true,
      canRequestAds: false,
    });
    await expect(
      showRewardedAd({
        zone: 'optional_rewards',
        premiumStatus: 'free',
        ssvCustomData: '22222222-2222-4222-8222-222222222222',
      }),
    ).resolves.toEqual({
      success: false,
      rewarded: false,
      error: 'sdk_unavailable',
    });
    expect(harness.adMob.prepareRewardVideoAd).not.toHaveBeenCalled();
  });

  it('prevents concurrent user taps from starting duplicate rewarded loads or shows', async () => {
    configureAudience(false, false);
    const { initializeAds, showRewardedAd } = await import('../adController');
    await expect(initializeAds()).resolves.toBe(true);

    let resolvePrepare!: (value: undefined) => void;
    harness.adMob.prepareRewardVideoAd.mockImplementationOnce(
      () => new Promise<undefined>(resolve => {
        resolvePrepare = resolve;
      }),
    );
    harness.adMob.showRewardVideoAd.mockImplementationOnce(async () => {
      harness.emit('onRewardedVideoAdReward', { type: 'treats', amount: 1 });
    });

    const first = showRewardedAd({
      zone: 'optional_rewards',
      premiumStatus: 'free',
      ssvCustomData: '22222222-2222-4222-8222-222222222222',
    });
    await vi.waitFor(() => expect(harness.adMob.prepareRewardVideoAd).toHaveBeenCalledTimes(1));
    const duplicate = showRewardedAd({
      zone: 'optional_rewards',
      premiumStatus: 'free',
      ssvCustomData: '22222222-2222-4222-8222-222222222222',
    });

    await expect(duplicate).resolves.toEqual({
      success: false,
      rewarded: false,
      error: 'ad_in_progress',
    });
    expect(harness.adMob.prepareRewardVideoAd).toHaveBeenCalledTimes(1);

    resolvePrepare(undefined);
    await expect(first).resolves.toMatchObject({ success: true, rewarded: true });
    expect(harness.adMob.showRewardVideoAd).toHaveBeenCalledTimes(1);
  });

  it('does not show an ad when the service gate closes while rewarded inventory is loading', async () => {
    configureAudience(false, false);
    const { initializeAds, showRewardedAd } = await import('../adController');
    await expect(initializeAds()).resolves.toBe(true);
    harness.adMob.prepareRewardVideoAd.mockImplementationOnce(async () => {
      harness.serviceGate.open = false;
    });

    await expect(
      showRewardedAd({
        zone: 'optional_rewards',
        premiumStatus: 'free',
        ssvCustomData: '22222222-2222-4222-8222-222222222222',
      }),
    ).resolves.toEqual({
      success: false,
      rewarded: false,
      error: 'service_gate_closed',
    });
    expect(harness.adMob.showRewardVideoAd).not.toHaveBeenCalled();
  });
});
