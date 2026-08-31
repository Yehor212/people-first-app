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
  IS_ADMOB_QA_TEST_MODE: false,
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
      initializeAds({ adConsent: true, ageEligibility: "minor", graceComplete: true }),
    ).resolves.toBe(false);
    await expect(
      initializeAds({ adConsent: false, ageEligibility: "adult", graceComplete: true }),
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
      initializeAds({ adConsent: true, ageEligibility: "adult", graceComplete: true }),
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

  it("does not initialize AdMob before the active-day grace period is complete", async () => {
    const { getAdState, initializeAds } = await import("../adController");

    await expect(
      initializeAds({ adConsent: true, ageEligibility: "adult", graceComplete: false }),
    ).resolves.toBe(false);
    expect(getAdState()).toMatchObject({
      initialized: false,
      sdkAvailable: false,
      canRequestAds: false,
    });
    expect(bannerHarness.adMob.initialize).not.toHaveBeenCalled();
    expect(bannerHarness.adMob.requestConsentInfo).not.toHaveBeenCalled();
  });

  it("shows one non-personalized anchored adaptive banner and reports its native height", async () => {
    const controller = await import("../adController");

    expect(controller.showHabitsBanner).toBeTypeOf("function");
    if (typeof controller.showHabitsBanner !== "function") return;

    const reportedHeights: number[] = [];
    await expect(
      controller.initializeAds({ adConsent: true, ageEligibility: "adult", graceComplete: true }),
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
    expect(reportedHeights).toEqual([]);
    expect(bannerHarness.adMob.resumeBanner).not.toHaveBeenCalled();
    bannerHarness.emit("bannerAdLoaded");
    expect(reportedHeights).toEqual([50]);
    await vi.waitFor(() => expect(bannerHarness.adMob.resumeBanner).toHaveBeenCalledTimes(1));
    expect(bannerHarness.adMob.prepareRewardVideoAd).not.toHaveBeenCalled();
    expect(bannerHarness.adMob.showRewardVideoAd).not.toHaveBeenCalled();
  });

  it("keeps one hidden native view while its exact adaptive size event is pending", async () => {
    const controller = await import("../adController");

    await controller.initializeAds({ adConsent: true, ageEligibility: "adult", graceComplete: true });
    await expect(controller.showHabitsBanner(() => undefined)).resolves.toEqual({ shown: true });
    await expect(controller.showHabitsBanner(() => undefined)).resolves.toEqual({ shown: true });

    expect(bannerHarness.adMob.showBanner).toHaveBeenCalledTimes(1);
    expect(bannerHarness.adMob.removeBanner).not.toHaveBeenCalled();

    bannerHarness.emit("bannerAdSizeChanged", { width: 360, height: 50 });
    bannerHarness.emit("bannerAdLoaded");
    await vi.waitFor(() => expect(bannerHarness.adMob.resumeBanner).toHaveBeenCalledTimes(1));
  });

  it("coalesces the same-width placement while native show is still pending", async () => {
    let resolveShow: (() => void) | undefined;
    bannerHarness.adMob.showBanner.mockImplementationOnce(
      () => new Promise<void>((resolve) => {
        resolveShow = resolve;
      }),
    );
    const controller = await import("../adController");

    await controller.initializeAds({ adConsent: true, ageEligibility: "adult", graceComplete: true });
    const firstShow = controller.showHabitsBanner(() => undefined);
    await vi.waitFor(() => expect(bannerHarness.adMob.showBanner).toHaveBeenCalledTimes(1));
    const secondShow = controller.showHabitsBanner(() => undefined);

    resolveShow?.();
    await expect(Promise.all([firstShow, secondShow])).resolves.toEqual([
      { shown: true },
      { shown: true },
    ]);
    expect(bannerHarness.adMob.showBanner).toHaveBeenCalledTimes(1);
    expect(bannerHarness.adMob.removeBanner).not.toHaveBeenCalled();

    bannerHarness.emit("bannerAdSizeChanged", { width: 360, height: 50 });
    bannerHarness.emit("bannerAdLoaded");
    await vi.waitFor(() => expect(bannerHarness.adMob.resumeBanner).toHaveBeenCalledTimes(1));
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
    await controller.initializeAds({ adConsent: true, ageEligibility: "adult", graceComplete: true });
    await controller.showHabitsBanner((height: number) => reportedHeights.push(height));
    bannerHarness.emit("bannerAdSizeChanged", { width: 360, height: 50 });
    bannerHarness.emit("bannerAdLoaded");
    await vi.waitFor(() => expect(bannerHarness.adMob.resumeBanner).toHaveBeenCalledTimes(1));

    await controller.hideHabitsBanner();
    expect(bannerHarness.adMob.hideBanner).toHaveBeenCalledTimes(1);
    expect(reportedHeights).toEqual([50, 0]);

    await controller.showHabitsBanner((height: number) => reportedHeights.push(height));
    await vi.waitFor(() => expect(bannerHarness.adMob.resumeBanner).toHaveBeenCalledTimes(2));
    expect(bannerHarness.adMob.showBanner).toHaveBeenCalledTimes(1);

    await controller.removeHabitsBanner();
    expect(bannerHarness.adMob.removeBanner).toHaveBeenCalledTimes(1);
    expect(bannerHarness.listeners.get("bannerAdSizeChanged") ?? []).toHaveLength(0);
    expect(reportedHeights.at(-1)).toBe(0);
  });

  it("coalesces concurrent suppression requests and skips already-acknowledged hides", async () => {
    let acknowledgeHide: (() => void) | undefined;
    bannerHarness.adMob.hideBanner.mockImplementationOnce(
      () => new Promise<void>((resolve) => {
        acknowledgeHide = resolve;
      }),
    );
    const controller = await import("../adController");

    await controller.initializeAds({ adConsent: true, ageEligibility: "adult", graceComplete: true });
    await controller.showHabitsBanner(() => undefined);
    bannerHarness.emit("bannerAdSizeChanged", { width: 360, height: 50 });
    bannerHarness.emit("bannerAdLoaded");

    const first = controller.hideHabitsBanner();
    const second = controller.hideHabitsBanner();
    await vi.waitFor(() => expect(bannerHarness.adMob.hideBanner).toHaveBeenCalledTimes(1));

    acknowledgeHide?.();
    await expect(Promise.all([first, second])).resolves.toEqual([undefined, undefined]);
    await expect(controller.hideHabitsBanner()).resolves.toBeUndefined();

    expect(bannerHarness.adMob.hideBanner).toHaveBeenCalledTimes(1);
    expect(bannerHarness.adMob.removeBanner).not.toHaveBeenCalled();
  });

  it("rejects protected-surface acknowledgement when native hide and removal both fail", async () => {
    const controller = await import("../adController");

    await controller.initializeAds({ adConsent: true, ageEligibility: "adult", graceComplete: true });
    await controller.showHabitsBanner(() => undefined);
    bannerHarness.emit("bannerAdSizeChanged", { width: 360, height: 50 });
    bannerHarness.emit("bannerAdLoaded");

    bannerHarness.adMob.hideBanner.mockRejectedValueOnce(new Error("hide failed"));
    bannerHarness.adMob.removeBanner.mockRejectedValueOnce(new Error("remove failed"));

    await expect(controller.hideHabitsBanner()).rejects.toThrow(
      "Android banner suppression was not acknowledged",
    );

    bannerHarness.adMob.hideBanner.mockResolvedValueOnce(undefined);
    await expect(controller.hideHabitsBanner()).resolves.toBeUndefined();
    expect(bannerHarness.adMob.hideBanner).toHaveBeenCalledTimes(2);
  });

  it("rejects protected-surface acknowledgement when native hide and removal both time out", async () => {
    vi.useFakeTimers();
    try {
      const controller = await import("../adController");

      await controller.initializeAds({ adConsent: true, ageEligibility: "adult", graceComplete: true });
      await controller.showHabitsBanner(() => undefined);
      bannerHarness.adMob.hideBanner.mockImplementationOnce(() => new Promise<void>(() => undefined));
      bannerHarness.adMob.removeBanner.mockImplementationOnce(() => new Promise<void>(() => undefined));

      const suppression = controller.hideHabitsBanner();
      const assertion = expect(suppression).rejects.toThrow(
        "Android banner suppression was not acknowledged",
      );
      await vi.advanceTimersByTimeAsync(8_000);
      await vi.advanceTimersByTimeAsync(8_000);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });

  it("requires a fresh native acknowledgement after timed-out commands complete late", async () => {
    vi.useFakeTimers();
    try {
      let resolveLateHide: (() => void) | undefined;
      let resolveLateRemove: (() => void) | undefined;
      const controller = await import("../adController");

      await controller.initializeAds({ adConsent: true, ageEligibility: "adult", graceComplete: true });
      await controller.showHabitsBanner(() => undefined);
      bannerHarness.emit("bannerAdSizeChanged", { width: 360, height: 50 });
      bannerHarness.emit("bannerAdLoaded");
      bannerHarness.adMob.hideBanner.mockImplementationOnce(
        () => new Promise<void>((resolve) => {
          resolveLateHide = resolve;
        }),
      );
      bannerHarness.adMob.removeBanner.mockImplementationOnce(
        () => new Promise<void>((resolve) => {
          resolveLateRemove = resolve;
        }),
      );

      const failedSuppression = controller.hideHabitsBanner();
      const failedAssertion = expect(failedSuppression).rejects.toThrow(
        "Android banner suppression was not acknowledged",
      );
      await vi.advanceTimersByTimeAsync(8_000);
      await vi.advanceTimersByTimeAsync(8_000);
      await failedAssertion;

      await expect(controller.hideHabitsBanner()).resolves.toBeUndefined();
      expect(bannerHarness.adMob.hideBanner).toHaveBeenCalledTimes(2);

      resolveLateHide?.();
      resolveLateRemove?.();
      await Promise.resolve();

      await controller.showHabitsBanner(() => undefined);
      await expect(controller.hideHabitsBanner()).resolves.toBeUndefined();
      expect(bannerHarness.adMob.hideBanner).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
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

    await controller.initializeAds({ adConsent: true, ageEligibility: "adult", graceComplete: true });
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

    await controller.initializeAds({ adConsent: true, ageEligibility: "adult", graceComplete: true });
    await controller.showHabitsBanner(() => undefined);
    bannerHarness.emit("bannerAdSizeChanged", { width: 360, height: 50 });
    bannerHarness.emit("bannerAdLoaded");

    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 800,
    });
    await controller.showHabitsBanner(() => undefined);

    expect(bannerHarness.adMob.removeBanner).toHaveBeenCalledTimes(1);
    expect(bannerHarness.adMob.showBanner).toHaveBeenCalledTimes(2);
    expect(bannerHarness.adMob.resumeBanner).not.toHaveBeenCalled();
  });

  it("recreates after a transient background width change returns to the original width", async () => {
    const controller = await import("../adController");

    await controller.initializeAds({ adConsent: true, ageEligibility: "adult", graceComplete: true });
    await controller.showHabitsBanner(() => undefined);
    bannerHarness.emit("bannerAdSizeChanged", { width: 360, height: 50 });
    bannerHarness.emit("bannerAdLoaded");
    await vi.waitFor(() => expect(bannerHarness.adMob.resumeBanner).toHaveBeenCalled());

    let resolveRemove: (() => void) | undefined;
    bannerHarness.adMob.removeBanner.mockImplementationOnce(
      () => new Promise<void>((resolve) => {
        resolveRemove = resolve;
      }),
    );

    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 800,
    });
    const transientResize = controller.showHabitsBanner(() => undefined);
    await vi.waitFor(() => expect(bannerHarness.adMob.removeBanner).toHaveBeenCalledTimes(1));

    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 360,
    });
    const settledResize = controller.showHabitsBanner(() => undefined);
    resolveRemove?.();

    await expect(transientResize).resolves.toEqual({
      shown: false,
      error: "placement_changed",
    });
    await expect(settledResize).resolves.toEqual({ shown: true });
    expect(bannerHarness.adMob.showBanner).toHaveBeenCalledTimes(2);
  });

  it("removes the native banner and listener immediately after local consent is revoked", async () => {
    const controller = await import("../adController");
    const reportedHeights: number[] = [];

    await controller.initializeAds({ adConsent: true, ageEligibility: "adult", graceComplete: true });
    await controller.showHabitsBanner((height: number) => reportedHeights.push(height));
    bannerHarness.emit("bannerAdSizeChanged", { width: 360, height: 50 });
    bannerHarness.emit("bannerAdLoaded");

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

    await controller.initializeAds({ adConsent: true, ageEligibility: "adult", graceComplete: true });
    await expect(controller.showHabitsBanner(() => undefined)).resolves.toEqual({ shown: true });

    bannerHarness.emit("bannerAdFailedToLoad", { code: 3, message: "no fill" });
    await vi.waitFor(() => expect(bannerHarness.adMob.removeBanner).toHaveBeenCalledTimes(1));

    await expect(controller.showHabitsBanner(() => undefined)).resolves.toEqual({ shown: true });
    expect(bannerHarness.adMob.showBanner).toHaveBeenCalledTimes(2);
    expect(bannerHarness.adMob.resumeBanner).not.toHaveBeenCalled();
  });

  it("times out a hung native show and lets a later cleanup command complete", async () => {
    vi.useFakeTimers();
    bannerHarness.adMob.showBanner.mockImplementationOnce(() => new Promise<void>(() => undefined));
    const controller = await import("../adController");

    await controller.initializeAds({ adConsent: true, ageEligibility: "adult", graceComplete: true });
    const showResult = controller.showHabitsBanner(() => undefined);
    await vi.advanceTimersByTimeAsync(10_000);

    await expect(showResult).resolves.toEqual({ shown: false, error: "banner_timeout" });
    await expect(controller.removeHabitsBanner()).resolves.toBeUndefined();
    expect(bannerHarness.adMob.removeBanner).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("finishes timeout cleanup before a retry can touch the native banner", async () => {
    vi.useFakeTimers();
    let resolveRemove: (() => void) | undefined;
    bannerHarness.adMob.showBanner.mockImplementationOnce(() => new Promise<void>(() => undefined));
    bannerHarness.adMob.removeBanner.mockImplementationOnce(
      () => new Promise<void>((resolve) => {
        resolveRemove = resolve;
      }),
    );
    const controller = await import("../adController");

    await controller.initializeAds({ adConsent: true, ageEligibility: "adult", graceComplete: true });
    const timedOutShow = controller.showHabitsBanner(() => undefined);
    await vi.advanceTimersByTimeAsync(10_000);
    await vi.waitFor(() => expect(bannerHarness.adMob.removeBanner).toHaveBeenCalledTimes(1));

    const retry = controller.showHabitsBanner(() => undefined);
    await vi.advanceTimersByTimeAsync(1);
    expect(bannerHarness.adMob.showBanner).toHaveBeenCalledTimes(1);

    resolveRemove?.();
    await expect(timedOutShow).resolves.toEqual({ shown: false, error: "banner_timeout" });
    await expect(retry).resolves.toEqual({ shown: true });
    expect(bannerHarness.adMob.showBanner).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("removes a native banner when geometry arrives but Loaded never does", async () => {
    vi.useFakeTimers();
    const controller = await import("../adController");
    const reportedHeights: number[] = [];

    await controller.initializeAds({ adConsent: true, ageEligibility: "adult", graceComplete: true });
    await expect(
      controller.showHabitsBanner((height) => reportedHeights.push(height)),
    ).resolves.toEqual({ shown: true });

    bannerHarness.emit("bannerAdSizeChanged", { width: 360, height: 50 });
    expect(reportedHeights).toEqual([]);
    expect(bannerHarness.adMob.resumeBanner).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(12_100);

    expect(bannerHarness.adMob.removeBanner).toHaveBeenCalledTimes(1);
    expect(bannerHarness.adMob.resumeBanner).not.toHaveBeenCalled();
    expect(reportedHeights.at(-1)).toBe(0);
    vi.useRealTimers();
  });

  it("reports adaptive geometry before revealing a newly created native view", async () => {
    const controller = await import("../adController");
    const events: string[] = [];
    bannerHarness.adMob.resumeBanner.mockImplementationOnce(() => {
      events.push("native-visible");
      return Promise.resolve();
    });

    await controller.initializeAds({ adConsent: true, ageEligibility: "adult", graceComplete: true });
    const showResult = controller.showHabitsBanner((height) => {
      if (height > 0) events.push(`reserved-${height}`);
    });
    await vi.waitFor(() => expect(bannerHarness.adMob.showBanner).toHaveBeenCalledTimes(1));
    bannerHarness.emit("bannerAdSizeChanged", { width: 360, height: 50 });
    bannerHarness.emit("bannerAdLoaded");
    await showResult;
    await vi.waitFor(() => expect(events).toEqual(["reserved-50", "native-visible"]));
  });
});
