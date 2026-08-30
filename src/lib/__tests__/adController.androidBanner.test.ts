import { beforeEach, describe, expect, it, vi } from "vitest";

const bannerHarness = vi.hoisted(() => {
  type Listener = (payload?: unknown) => void;
  const storage: Record<string, string | null> = {
    zenflow_onboarding_state: JSON.stringify({ isNewUser: false, daysActive: 20 }),
  };
  const listeners = new Map<string, Listener[]>();
  const adMob = {
    initialize: vi.fn(() => Promise.resolve()),
    requestConsentInfo: vi.fn(() =>
      Promise.resolve({
        status: "NOT_REQUIRED",
        isConsentFormAvailable: false,
        canRequestAds: true,
        privacyOptionsRequirementStatus: "NOT_REQUIRED",
      }),
    ),
    showConsentForm: vi.fn(() => Promise.resolve()),
    showPrivacyOptionsForm: vi.fn(() => Promise.resolve()),
    showBanner: vi.fn(() => Promise.resolve()),
    hideBanner: vi.fn(() => Promise.resolve()),
    resumeBanner: vi.fn(() => Promise.resolve()),
    removeBanner: vi.fn(() => Promise.resolve()),
    prepareRewardVideoAd: vi.fn(() => Promise.resolve()),
    showRewardVideoAd: vi.fn(() => Promise.resolve()),
    addListener: vi.fn((eventName: string, listener: Listener) => {
      const current = listeners.get(eventName) ?? [];
      current.push(listener);
      listeners.set(eventName, current);
      return Promise.resolve({
        remove: vi.fn(() => {
          listeners.set(
            eventName,
            (listeners.get(eventName) ?? []).filter((candidate) => candidate !== listener),
          );
          return Promise.resolve();
        }),
      });
    }),
  };

  return {
    adMob,
    storage,
    listeners,
    emit(eventName: string, payload?: unknown) {
      for (const listener of listeners.get(eventName) ?? []) listener(payload);
    },
  };
});

vi.mock("@/lib/platform", () => ({ isNative: true, platform: "android" }));
vi.mock("@/lib/logger", () => ({
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("@/lib/env", () => ({
  IS_DEV: false,
  ADMOB_BANNER_ID_ANDROID: "ca-app-pub-9501460293702808/9876543210",
  ADMOB_BANNER_ID_IOS: "",
}));
vi.mock("@/lib/adConfig", () => ({
  getBannerAdUnitId: vi.fn(() => "ca-app-pub-9501460293702808/9876543210"),
  hasBannerAdUnitId: vi.fn((target: string) => target === "android"),
  isGoogleTestAdUnit: vi.fn(() => false),
}));
vi.mock("@/lib/storageKeys", () => ({
  SK: {
    ONBOARDING_STATE: "zenflow_onboarding_state",
  },
}));
vi.mock("@/lib/safeJson", () => ({
  safeJsonParse: vi.fn((json: string | null | undefined, fallback: unknown) => {
    if (!json) return fallback;
    try {
      return JSON.parse(json);
    } catch {
      return fallback;
    }
  }),
  storageGetRaw: vi.fn((key: string) => bannerHarness.storage[key] ?? null),
  storageSetRaw: vi.fn((key: string, value: string) => {
    bannerHarness.storage[key] = value;
  }),
}));
vi.mock("@capacitor-community/admob", () => ({
  AdMob: bannerHarness.adMob,
  MaxAdContentRating: { General: "General" },
  AdmobConsentStatus: { REQUIRED: "REQUIRED" },
  PrivacyOptionsRequirementStatus: { REQUIRED: "REQUIRED" },
  BannerAdSize: { ADAPTIVE_BANNER: "ADAPTIVE_BANNER" },
  BannerAdPosition: { BOTTOM_CENTER: "BOTTOM_CENTER" },
  BannerAdPluginEvents: {
    SizeChanged: "bannerAdSizeChanged",
    Loaded: "bannerAdLoaded",
    FailedToLoad: "bannerAdFailedToLoad",
  },
}));

describe("adController Android banner-only contracts", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    bannerHarness.listeners.clear();
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 360,
    });
    bannerHarness.storage.zenflow_onboarding_state = JSON.stringify({
      isNewUser: false,
      daysActive: 20,
    });
  });

  it("fails closed before touching AdMob when age or local consent is missing", async () => {
    const { initializeAds, refreshAdPrivacyOptionsStatus, showAdPrivacyOptions } =
      await import("../adController");

    await expect(
      initializeAds({ adConsent: true, ageEligibility: "minor" }),
    ).resolves.toBe(false);
    await expect(
      initializeAds({ adConsent: false, ageEligibility: "adult" }),
    ).resolves.toBe(false);
    await expect(
      refreshAdPrivacyOptionsStatus({ ageEligibility: "minor" }),
    ).resolves.toMatchObject({
      canRequestAds: false,
      privacyOptionsRequired: false,
      error: "authorization_required",
    });
    await expect(showAdPrivacyOptions()).resolves.toMatchObject({ opened: false });
    expect(bannerHarness.adMob.initialize).not.toHaveBeenCalled();
    expect(bannerHarness.adMob.requestConsentInfo).not.toHaveBeenCalled();
    expect(bannerHarness.adMob.showPrivacyOptionsForm).not.toHaveBeenCalled();
  });

  it("keeps UMP withdrawal available to an adult while local banner consent is off", async () => {
    bannerHarness.adMob.requestConsentInfo.mockResolvedValueOnce({
      status: "OBTAINED",
      isConsentFormAvailable: true,
      canRequestAds: false,
      privacyOptionsRequirementStatus: "REQUIRED",
    });
    const controller = await import("../adController");

    controller.disableAds({ clearPrivacyOptions: false });
    await expect(
      controller.refreshAdPrivacyOptionsStatus({ ageEligibility: "adult" }),
    ).resolves.toMatchObject({
      canRequestAds: false,
      privacyOptionsRequired: true,
    });
    await expect(controller.showAdPrivacyOptions()).resolves.toMatchObject({
      opened: true,
    });

    expect(bannerHarness.adMob.initialize).not.toHaveBeenCalled();
    expect(bannerHarness.adMob.requestConsentInfo).toHaveBeenCalledWith({
      tagForUnderAgeOfConsent: false,
    });
    expect(bannerHarness.adMob.showPrivacyOptionsForm).toHaveBeenCalledTimes(1);
    expect(bannerHarness.adMob.showBanner).not.toHaveBeenCalled();
  });

  it("initializes AdMob when an adult explicitly enables the configured banner", async () => {
    const { getAdState, initializeAds } = await import("../adController");

    await expect(
      initializeAds({ adConsent: true, ageEligibility: "adult" }),
    ).resolves.toBe(true);
    expect(getAdState()).toMatchObject({
      initialized: true,
      sdkAvailable: true,
      canRequestAds: true,
    });
    expect(bannerHarness.adMob.initialize).toHaveBeenCalledTimes(1);
    expect(bannerHarness.adMob.initialize).toHaveBeenCalledWith({
      initializeForTesting: false,
      tagForChildDirectedTreatment: false,
      tagForUnderAgeOfConsent: false,
      maxAdContentRating: "General",
    });
    expect(bannerHarness.adMob.requestConsentInfo).toHaveBeenCalledWith({
      tagForUnderAgeOfConsent: false,
    });
    expect(bannerHarness.adMob.prepareRewardVideoAd).not.toHaveBeenCalled();
    expect(bannerHarness.adMob.showRewardVideoAd).not.toHaveBeenCalled();
  });

  it("shows one non-personalized anchored adaptive banner and reports its native height", async () => {
    const controller = await import("../adController");

    expect(controller.showHabitsBanner).toBeTypeOf("function");
    if (typeof controller.showHabitsBanner !== "function") return;

    const reportedHeights: number[] = [];
    await expect(
      controller.initializeAds({ adConsent: true, ageEligibility: "adult" }),
    ).resolves.toBe(true);
    await expect(
      controller.showHabitsBanner((height: number) => reportedHeights.push(height)),
    ).resolves.toEqual({ shown: true });

    expect(bannerHarness.adMob.showBanner).toHaveBeenCalledTimes(1);
    expect(bannerHarness.adMob.showBanner).toHaveBeenCalledWith({
      adId: "ca-app-pub-9501460293702808/9876543210",
      adSize: "ADAPTIVE_BANNER",
      position: "BOTTOM_CENTER",
      margin: 0,
      isTesting: false,
      npa: true,
    });

    bannerHarness.emit("bannerAdSizeChanged", { width: 360, height: 50 });
    expect(reportedHeights).toEqual([50]);
    expect(bannerHarness.adMob.prepareRewardVideoAd).not.toHaveBeenCalled();
    expect(bannerHarness.adMob.showRewardVideoAd).not.toHaveBeenCalled();
  });

  it("hides for overlays, resumes without reloading, and fully removes on route exit", async () => {
    const controller = await import("../adController");

    expect(controller.hideHabitsBanner).toBeTypeOf("function");
    expect(controller.removeHabitsBanner).toBeTypeOf("function");
    if (
      typeof controller.hideHabitsBanner !== "function" ||
      typeof controller.removeHabitsBanner !== "function"
    ) {
      return;
    }

    const reportedHeights: number[] = [];
    await controller.initializeAds({ adConsent: true, ageEligibility: "adult" });
    await controller.showHabitsBanner((height: number) => reportedHeights.push(height));
    bannerHarness.emit("bannerAdSizeChanged", { width: 360, height: 50 });

    await controller.hideHabitsBanner();
    expect(bannerHarness.adMob.hideBanner).toHaveBeenCalledTimes(1);
    expect(reportedHeights).toEqual([50, 0]);

    await controller.showHabitsBanner((height: number) => reportedHeights.push(height));
    expect(bannerHarness.adMob.resumeBanner).toHaveBeenCalledTimes(1);
    expect(bannerHarness.adMob.showBanner).toHaveBeenCalledTimes(1);

    await controller.removeHabitsBanner();
    expect(bannerHarness.adMob.removeBanner).toHaveBeenCalledTimes(1);
    expect(bannerHarness.listeners.get("bannerAdSizeChanged") ?? []).toHaveLength(0);
    expect(reportedHeights.at(-1)).toBe(0);
  });

  it("removes a pending native show when a protected surface opens before it resolves", async () => {
    let resolveShow: (() => void) | undefined;
    bannerHarness.adMob.showBanner.mockImplementationOnce(
      () => new Promise<void>((resolve) => {
        resolveShow = resolve;
      }),
    );
    const controller = await import("../adController");
    const reportedHeights: number[] = [];

    await controller.initializeAds({ adConsent: true, ageEligibility: "adult" });
    const showResult = controller.showHabitsBanner((height: number) => {
      reportedHeights.push(height);
    });
    await vi.waitFor(() => expect(bannerHarness.adMob.showBanner).toHaveBeenCalledTimes(1));

    const hideResult = controller.hideHabitsBanner();
    resolveShow?.();

    await expect(showResult).resolves.toEqual({ shown: false, error: "placement_changed" });
    await expect(hideResult).resolves.toBeUndefined();
    expect(bannerHarness.adMob.removeBanner).toHaveBeenCalledTimes(1);
    expect(bannerHarness.adMob.hideBanner).not.toHaveBeenCalled();
    expect(reportedHeights.at(-1)).toBe(0);
  });

  it("recreates the adaptive banner when the Android viewport width changes", async () => {
    const controller = await import("../adController");

    await controller.initializeAds({ adConsent: true, ageEligibility: "adult" });
    await controller.showHabitsBanner(() => undefined);
    bannerHarness.emit("bannerAdSizeChanged", { width: 360, height: 50 });

    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 800,
    });
    await controller.showHabitsBanner(() => undefined);

    expect(bannerHarness.adMob.removeBanner).toHaveBeenCalledTimes(1);
    expect(bannerHarness.adMob.showBanner).toHaveBeenCalledTimes(2);
    expect(bannerHarness.adMob.resumeBanner).not.toHaveBeenCalled();
  });

  it("removes the native banner and listener immediately after local consent is revoked", async () => {
    const controller = await import("../adController");
    const reportedHeights: number[] = [];

    await controller.initializeAds({ adConsent: true, ageEligibility: "adult" });
    await controller.showHabitsBanner((height: number) => reportedHeights.push(height));
    bannerHarness.emit("bannerAdSizeChanged", { width: 360, height: 50 });

    controller.disableAds({ clearPrivacyOptions: false });

    await vi.waitFor(() => {
      expect(bannerHarness.adMob.removeBanner).toHaveBeenCalledTimes(1);
      expect(bannerHarness.listeners.get("bannerAdSizeChanged") ?? []).toHaveLength(0);
    });
    expect(reportedHeights.at(-1)).toBe(0);
    expect(controller.getAdState()).toMatchObject({
      initialized: false,
      sdkAvailable: false,
      canRequestAds: false,
    });
  });

  it("clears a failed native banner so a later request retries instead of resuming a dead view", async () => {
    const controller = await import("../adController");

    await controller.initializeAds({ adConsent: true, ageEligibility: "adult" });
    await expect(controller.showHabitsBanner(() => undefined)).resolves.toEqual({ shown: true });

    bannerHarness.emit("bannerAdFailedToLoad", { code: 3, message: "no fill" });
    await vi.waitFor(() => expect(bannerHarness.adMob.removeBanner).toHaveBeenCalledTimes(1));

    await expect(controller.showHabitsBanner(() => undefined)).resolves.toEqual({ shown: true });
    expect(bannerHarness.adMob.showBanner).toHaveBeenCalledTimes(2);
    expect(bannerHarness.adMob.resumeBanner).not.toHaveBeenCalled();
  });
});
