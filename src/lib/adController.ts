/**
 * Android banner-only AdMob controller.
 *
 * The native SDK stays fail-closed on unsupported platforms, missing consent,
 * missing configuration, and the first three onboarding days.
 */

import { getBannerAdUnitId, hasBannerAdUnitId } from "@/lib/adConfig";
import { IS_ADMOB_QA_TEST_MODE, IS_DEV } from "@/lib/env";
import { logger } from "@/lib/logger";
import { isNative, platform } from "@/lib/platform";
import {
  AdMob,
  AdmobConsentStatus,
  BannerAdPluginEvents,
  BannerAdPosition,
  BannerAdSize,
  MaxAdContentRating,
} from "@capacitor-community/admob";
import type { AdAgeEligibility } from "@/types";

export interface AdInitializationAuthorization {
  adConsent: boolean;
  ageEligibility: AdAgeEligibility;
  graceComplete: boolean;
}

export interface AdControllerState {
  initialized: boolean;
  sdkAvailable: boolean;
  canRequestAds: boolean;
  privacyOptionsRequired: boolean;
  consentStatus?: string;
}

interface PrivacyOptionsResult {
  opened: boolean;
  canRequestAds: boolean;
  privacyOptionsRequired: boolean;
  error?: string;
}

interface AdPrivacyOptionsStatus {
  canRequestAds: boolean;
  privacyOptionsRequired: boolean;
  error?: string;
}

export interface BannerAdCommandResult {
  shown: boolean;
  error?: string;
}

interface DisableAdsOptions {
  clearPrivacyOptions?: boolean;
}

const state: AdControllerState = {
  initialized: false,
  sdkAvailable: false,
  canRequestAds: false,
  privacyOptionsRequired: false,
};

const NATIVE_BANNER_COMMAND_TIMEOUT_MS = 8_000;
const NATIVE_BANNER_LOAD_TIMEOUT_MS = 10_000;

class NativeBannerTimeoutError extends Error {
  constructor() {
    super("Android banner native command timed out");
    this.name = "NativeBannerTimeoutError";
  }
}

class NativeBannerSuppressionError extends Error {
  constructor() {
    super("Android banner suppression was not acknowledged");
    this.name = "NativeBannerSuppressionError";
  }
}

const AdMobPlugin: any = AdMob;
let adLifecycleEpoch = 0;
let bannerPlacementEpoch = 0;
let bannerCommandQueue: Promise<void> = Promise.resolve();
let bannerCreated = false;
let bannerRequested = false;
let bannerLoaded = false;
let bannerVisible = false;
let bannerHeight = 0;
let bannerMeasuredHeight = 0;
let bannerRemovalInFlight = false;
let bannerSuppressionAcknowledged = true;
let bannerSuppressionInFlight: Promise<void> | null = null;
let bannerSizeListener: { remove?: () => Promise<void> | void } | null = null;
let bannerLoadedListener: { remove?: () => Promise<void> | void } | null = null;
let bannerFailureListener: { remove?: () => Promise<void> | void } | null = null;
let bannerHeightCallback: ((height: number) => void) | null = null;
let bannerViewportWidth: number | null = null;
let bannerLoadTimeoutId: ReturnType<typeof setTimeout> | undefined;
let privacyAuthorizationActive = false;

const ANDROID_MOTION_BENCHMARK_ENABLED =
  typeof __ANDROID_MOTION_BENCHMARK__ !== "undefined" && __ANDROID_MOTION_BENCHMARK__;

function withNativeBannerTimeout<T>(operation: Promise<T>): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(
      () => reject(new NativeBannerTimeoutError()),
      NATIVE_BANNER_COMMAND_TIMEOUT_MS
    );
  });
  return Promise.race([operation, timeout]).finally(() => {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  });
}

function afterNextPaint(callback: () => void): void {
  if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
    window.requestAnimationFrame(() => callback());
    return;
  }
  setTimeout(callback, 0);
}

function isLifecycleCurrent(epoch: number): boolean {
  return epoch === adLifecycleEpoch;
}

function isBannerPlacementCurrent(epoch: number): boolean {
  return epoch === bannerPlacementEpoch;
}

function enqueueBannerCommand<T>(command: () => Promise<T>): Promise<T> {
  const result = bannerCommandQueue.then(command, command);
  bannerCommandQueue = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}

async function removeNativeBannerAfterFailure(_context: string): Promise<boolean> {
  if (!AdMobPlugin || typeof AdMobPlugin.removeBanner !== "function") return false;

  bannerRemovalInFlight = true;
  try {
    // Keep this operation inside the command queue. If Android's UI thread is
    // delayed, fail closed and wait instead of letting a retry race a pending
    // removal against the plugin's mutable AdView fields.
    await withNativeBannerTimeout(AdMobPlugin.removeBanner());
    bannerSuppressionAcknowledged = true;
    return true;
  } catch {
    bannerSuppressionAcknowledged = false;
    logger.warn("[Ads]", "Native banner removal deferred");
    return false;
  } finally {
    bannerRemovalInFlight = false;
  }
}

function clearBannerLoadWatchdog(): void {
  if (bannerLoadTimeoutId === undefined) return;
  clearTimeout(bannerLoadTimeoutId);
  bannerLoadTimeoutId = undefined;
}

function startBannerLoadWatchdog(lifecycleEpoch: number, placementEpoch: number): void {
  clearBannerLoadWatchdog();
  bannerLoadTimeoutId = setTimeout(() => {
    bannerLoadTimeoutId = undefined;
    if (
      !bannerCreated ||
      !bannerRequested ||
      bannerLoaded ||
      !isLifecycleCurrent(lifecycleEpoch) ||
      !isBannerPlacementCurrent(placementEpoch)
    )
      return;

    bannerPlacementEpoch += 1;
    bannerRequested = false;
    bannerCreated = false;
    bannerLoaded = false;
    bannerVisible = false;
    bannerMeasuredHeight = 0;
    bannerViewportWidth = null;
    reportBannerHeight(0, true);
    logger.warn("[Ads] Android habits banner load timed out; removing hidden native view");
    void enqueueBannerCommand(() =>
      removeNativeBannerAfterFailure("[Ads] Failed to remove timed-out Android habits banner:")
    );
  }, NATIVE_BANNER_LOAD_TIMEOUT_MS);
}

function scheduleBannerReveal(lifecycleEpoch: number, placementEpoch: number): void {
  afterNextPaint(() => {
    if (
      bannerVisible ||
      !bannerCreated ||
      !bannerRequested ||
      !bannerLoaded ||
      !isLifecycleCurrent(lifecycleEpoch) ||
      !isBannerPlacementCurrent(placementEpoch)
    )
      return;

    void enqueueBannerCommand(async () => {
      if (
        bannerVisible ||
        !bannerCreated ||
        !bannerRequested ||
        !bannerLoaded ||
        !isLifecycleCurrent(lifecycleEpoch) ||
        !isBannerPlacementCurrent(placementEpoch)
      )
        return;
      try {
        await withNativeBannerTimeout(AdMobPlugin.resumeBanner());
        if (
          bannerCreated &&
          isLifecycleCurrent(lifecycleEpoch) &&
          isBannerPlacementCurrent(placementEpoch)
        ) {
          bannerVisible = true;
        }
      } catch (error) {
        bannerPlacementEpoch += 1;
        bannerRequested = false;
        bannerCreated = false;
        bannerLoaded = false;
        bannerVisible = false;
        bannerMeasuredHeight = 0;
        bannerViewportWidth = null;
        clearBannerLoadWatchdog();
        reportBannerHeight(0);
        logger.warn("[Ads] Failed to reveal reserved Android habits banner:", error);
        await removeNativeBannerAfterFailure(
          "[Ads] Failed to remove unrevealed Android habits banner:"
        );
      }
    });
  });
}

function resetAdAvailability(options: DisableAdsOptions = {}): void {
  state.initialized = false;
  state.sdkAvailable = false;
  state.canRequestAds = false;
  state.consentStatus = undefined;
  if (options.clearPrivacyOptions) state.privacyOptionsRequired = false;
}

export function disableAds(options: DisableAdsOptions = {}): void {
  adLifecycleEpoch += 1;
  if (options.clearPrivacyOptions) privacyAuthorizationActive = false;
  resetAdAvailability(options);
  void removeHabitsBanner();
}

export function isBannerAdsSupported(): boolean {
  return Boolean(
    (!IS_DEV || IS_ADMOB_QA_TEST_MODE) &&
    isNative &&
    platform === "android" &&
    hasBannerAdUnitId("android")
  );
}

function installAndroidBannerBenchmarkProbe(): void {
  if (
    !ANDROID_MOTION_BENCHMARK_ENABLED ||
    typeof location === "undefined" ||
    location.protocol !== "https:" ||
    location.hostname !== "localhost"
  ) {
    return;
  }

  const benchmarkGlobal = globalThis as typeof globalThis & {
    __ZENFLOW_ANDROID_BANNER_BENCHMARK__?: () => Record<
      string,
      boolean | number | string | undefined
    >;
  };
  Object.defineProperty(benchmarkGlobal, "__ZENFLOW_ANDROID_BANNER_BENCHMARK__", {
    configurable: true,
    enumerable: false,
    value: () => ({
      ...state,
      supported: isBannerAdsSupported(),
      lifecycleEpoch: adLifecycleEpoch,
      placementEpoch: bannerPlacementEpoch,
      privacyAuthorizationActive,
      pluginLoaded: true,
      bannerRequested,
      bannerCreated,
      bannerLoaded,
      bannerVisible,
      bannerHeight,
      bannerMeasuredHeight,
      bannerSuppressionAcknowledged,
      bannerViewportWidth: bannerViewportWidth ?? undefined,
      bannerSizeListenerActive: bannerSizeListener !== null,
      bannerLoadedListenerActive: bannerLoadedListener !== null,
      bannerFailureListenerActive: bannerFailureListener !== null,
    }),
  });
}

installAndroidBannerBenchmarkProbe();

function updateConsentState(consentInfo: any): boolean {
  const privacyRequiredStatus = "REQUIRED";
  const canRequestAds = consentInfo?.canRequestAds === true;

  state.canRequestAds = canRequestAds;
  state.consentStatus = typeof consentInfo?.status === "string" ? consentInfo.status : undefined;
  state.privacyOptionsRequired =
    consentInfo?.privacyOptionsRequirementStatus === privacyRequiredStatus;

  return canRequestAds;
}

async function requestNativeConsentInfo(options: {
  showFormIfRequired: boolean;
  lifecycleEpoch?: number;
}): Promise<boolean> {
  const requiredStatus = AdmobConsentStatus.REQUIRED;
  let consentInfo = await AdMobPlugin.requestConsentInfo({
    tagForUnderAgeOfConsent: false,
  });

  if (options.lifecycleEpoch !== undefined && !isLifecycleCurrent(options.lifecycleEpoch)) {
    return false;
  }

  updateConsentState(consentInfo);

  if (
    options.showFormIfRequired &&
    consentInfo?.isConsentFormAvailable &&
    consentInfo.status === requiredStatus &&
    typeof AdMobPlugin.showConsentForm === "function"
  ) {
    consentInfo = await AdMobPlugin.showConsentForm();
    if (options.lifecycleEpoch !== undefined && !isLifecycleCurrent(options.lifecycleEpoch)) {
      return false;
    }
    updateConsentState(consentInfo);
  }

  return state.canRequestAds;
}

async function canRequestNativeAds(lifecycleEpoch: number): Promise<boolean> {
  if (!AdMobPlugin || typeof AdMobPlugin.requestConsentInfo !== "function") {
    state.canRequestAds = false;
    state.privacyOptionsRequired = false;
    return false;
  }

  try {
    return await requestNativeConsentInfo({
      showFormIfRequired: true,
      lifecycleEpoch,
    });
  } catch (err) {
    state.canRequestAds = false;
    logger.warn("[Ads] Consent check failed; ads disabled for this session:", err);
    return false;
  }
}

export async function refreshAdPrivacyOptionsStatus(
  authorization: Pick<AdInitializationAuthorization, "ageEligibility">
): Promise<AdPrivacyOptionsStatus> {
  if (authorization.ageEligibility !== "adult") {
    privacyAuthorizationActive = false;
    state.canRequestAds = false;
    state.privacyOptionsRequired = false;
    return { canRequestAds: false, privacyOptionsRequired: false, error: "authorization_required" };
  }
  privacyAuthorizationActive = true;

  if (!isBannerAdsSupported()) {
    state.canRequestAds = false;
    state.privacyOptionsRequired = false;
    return { canRequestAds: false, privacyOptionsRequired: false, error: "banner_unavailable" };
  }

  try {
    if (!AdMobPlugin || typeof AdMobPlugin.requestConsentInfo !== "function") {
      state.canRequestAds = false;
      state.privacyOptionsRequired = false;
      return {
        canRequestAds: false,
        privacyOptionsRequired: false,
        error: "consent_api_unavailable",
      };
    }

    await requestNativeConsentInfo({ showFormIfRequired: false });
    return {
      canRequestAds: state.canRequestAds,
      privacyOptionsRequired: state.privacyOptionsRequired,
    };
  } catch (err) {
    state.canRequestAds = false;
    logger.warn("[Ads] Privacy options status refresh failed:", err);
    return {
      canRequestAds: false,
      privacyOptionsRequired: state.privacyOptionsRequired,
      error: "privacy_options_status_failed",
    };
  }
}

export async function initializeAds(
  authorization: AdInitializationAuthorization
): Promise<boolean> {
  if (authorization.adConsent !== true || authorization.ageEligibility !== "adult") {
    privacyAuthorizationActive = authorization.ageEligibility === "adult";
    resetAdAvailability({ clearPrivacyOptions: authorization.ageEligibility !== "adult" });
    return false;
  }

  privacyAuthorizationActive = true;
  if (authorization.graceComplete !== true) {
    resetAdAvailability({ clearPrivacyOptions: false });
    logger.log("[Ads] Active-day grace period — ads disabled");
    return false;
  }
  if (state.initialized) return state.sdkAvailable;
  const lifecycleEpoch = adLifecycleEpoch;

  if (!isBannerAdsSupported()) {
    state.initialized = true;
    state.sdkAvailable = false;
    logger.log("[Ads] Android banner unavailable — ads disabled");
    return false;
  }

  try {
    if (!isLifecycleCurrent(lifecycleEpoch)) return false;

    await AdMobPlugin.initialize({
      initializeForTesting: false,
      tagForChildDirectedTreatment: false,
      tagForUnderAgeOfConsent: false,
      maxAdContentRating: MaxAdContentRating.General,
    });
    if (!isLifecycleCurrent(lifecycleEpoch)) return false;

    if (!(await canRequestNativeAds(lifecycleEpoch))) {
      if (!isLifecycleCurrent(lifecycleEpoch)) return false;
      state.initialized = true;
      state.sdkAvailable = false;
      logger.log("[Ads] Consent not available — ads disabled");
      return false;
    }
    if (!isLifecycleCurrent(lifecycleEpoch)) return false;

    state.initialized = true;
    state.sdkAvailable = true;
    logger.log("[Ads] Android banner SDK initialized");
    return true;
  } catch (err) {
    state.initialized = true;
    state.sdkAvailable = false;
    logger.warn("[Ads] AdMob SDK unavailable; ads disabled:", err);
    return false;
  }
}

export async function showAdPrivacyOptions(): Promise<PrivacyOptionsResult> {
  if (
    !privacyAuthorizationActive ||
    !isBannerAdsSupported() ||
    !AdMobPlugin ||
    typeof AdMobPlugin.showPrivacyOptionsForm !== "function"
  ) {
    return {
      opened: false,
      canRequestAds: state.canRequestAds,
      privacyOptionsRequired: state.privacyOptionsRequired,
      error: "privacy_options_unavailable",
    };
  }

  try {
    await AdMobPlugin.showPrivacyOptionsForm();
    if (typeof AdMobPlugin.requestConsentInfo === "function") {
      await requestNativeConsentInfo({ showFormIfRequired: false });
    }

    state.sdkAvailable = state.initialized && state.canRequestAds;
    return {
      opened: true,
      canRequestAds: state.canRequestAds,
      privacyOptionsRequired: state.privacyOptionsRequired,
    };
  } catch (err) {
    logger.warn("[Ads] Privacy options form failed:", err);
    return {
      opened: false,
      canRequestAds: state.canRequestAds,
      privacyOptionsRequired: state.privacyOptionsRequired,
      error: "privacy_options_failed",
    };
  }
}

function reportBannerHeight(nextHeight: number, force = false): void {
  const normalizedHeight = Number.isFinite(nextHeight) && nextHeight > 0 ? nextHeight : 0;
  if (!force && bannerHeight === normalizedHeight) return;
  bannerHeight = normalizedHeight;
  bannerHeightCallback?.(normalizedHeight);
}

function readViewportWidth(): number | null {
  if (typeof window === "undefined") return null;
  const width = Math.round(window.innerWidth);
  return Number.isFinite(width) && width > 0 ? width : null;
}

export function showHabitsBanner(
  onHeightChange: (height: number) => void
): Promise<BannerAdCommandResult> {
  const requestedViewportWidth = readViewportWidth();
  const reusesCurrentNativePlacement = Boolean(
    bannerCreated &&
    !bannerRemovalInFlight &&
    bannerViewportWidth !== null &&
    requestedViewportWidth !== null &&
    bannerViewportWidth === requestedViewportWidth
  );
  const placementEpoch = reusesCurrentNativePlacement
    ? bannerPlacementEpoch
    : ++bannerPlacementEpoch;
  return enqueueBannerCommand(async () => {
    if (!state.sdkAvailable || !state.canRequestAds || !isBannerAdsSupported()) {
      onHeightChange(0);
      return { shown: false, error: "banner_unavailable" };
    }

    const lifecycleEpoch = adLifecycleEpoch;
    try {
      if (
        !AdMobPlugin ||
        !isLifecycleCurrent(lifecycleEpoch) ||
        !isBannerPlacementCurrent(placementEpoch)
      ) {
        onHeightChange(0);
        return { shown: false, error: "placement_changed" };
      }

      bannerSuppressionAcknowledged = false;
      bannerRequested = true;

      bannerHeightCallback = onHeightChange;
      const currentViewportWidth = requestedViewportWidth ?? readViewportWidth();
      if (
        bannerCreated &&
        bannerViewportWidth !== null &&
        currentViewportWidth !== null &&
        bannerViewportWidth !== currentViewportWidth
      ) {
        logger.log("[Ads] Rebuilding Android habits banner for viewport width", {
          previousWidth: bannerViewportWidth,
          currentWidth: currentViewportWidth,
        });
        bannerRemovalInFlight = true;
        try {
          await AdMobPlugin.removeBanner?.();
        } finally {
          bannerRemovalInFlight = false;
        }
        // Native removal is authoritative even when a newer placement request
        // arrives while it is in flight. Clear the mirrored JS state before
        // checking the epoch so the newest request cannot resume a view that
        // Android has already destroyed.
        bannerCreated = false;
        bannerLoaded = false;
        bannerVisible = false;
        bannerMeasuredHeight = 0;
        bannerViewportWidth = null;
        clearBannerLoadWatchdog();
        reportBannerHeight(0);
        if (!isLifecycleCurrent(lifecycleEpoch) || !isBannerPlacementCurrent(placementEpoch)) {
          onHeightChange(0);
          return { shown: false, error: "placement_changed" };
        }
      }

      if (bannerCreated) {
        if (!bannerVisible) {
          if (!bannerLoaded || bannerMeasuredHeight <= 0) {
            // The patched native bridge emits the exact adaptive size before
            // the SDK Loaded event. A second placement request can arrive
            // while either event is still in flight; keep the single hidden
            // native view and restart only its bounded load watchdog.
            startBannerLoadWatchdog(lifecycleEpoch, placementEpoch);
            onHeightChange(0);
            return { shown: true };
          } else {
            reportBannerHeight(bannerMeasuredHeight);
            scheduleBannerReveal(lifecycleEpoch, placementEpoch);
            return { shown: true };
          }
        } else if (bannerHeight > 0) {
          onHeightChange(bannerHeight);
          return { shown: true };
        }
      }

      if (!bannerSizeListener && typeof AdMobPlugin.addListener === "function") {
        const sizeChangedEvent = BannerAdPluginEvents.SizeChanged;
        bannerSizeListener = await AdMobPlugin.addListener(
          sizeChangedEvent,
          (info: { height?: number }) => {
            if (!state.sdkAvailable || !bannerCreated || !bannerRequested) return;
            const currentPlacementEpoch = bannerPlacementEpoch;
            const height = Number(info?.height);
            const measuredHeight = Number.isFinite(height) && height > 0 ? height : 0;
            if (measuredHeight > 0) bannerMeasuredHeight = measuredHeight;
            if (!bannerLoaded) return;
            reportBannerHeight(measuredHeight);
            if (measuredHeight <= 0 || bannerVisible) return;
            scheduleBannerReveal(adLifecycleEpoch, currentPlacementEpoch);
          }
        );
      }

      if (!bannerLoadedListener && typeof AdMobPlugin.addListener === "function") {
        const loadedEvent = BannerAdPluginEvents.Loaded;
        bannerLoadedListener = await AdMobPlugin.addListener(loadedEvent, () => {
          if (!state.sdkAvailable || !bannerCreated || !bannerRequested) return;
          bannerLoaded = true;
          clearBannerLoadWatchdog();
          if (bannerMeasuredHeight <= 0) return;
          const currentPlacementEpoch = bannerPlacementEpoch;
          reportBannerHeight(bannerMeasuredHeight);
          if (!bannerVisible) {
            scheduleBannerReveal(adLifecycleEpoch, currentPlacementEpoch);
          }
        });
      }

      if (!bannerFailureListener && typeof AdMobPlugin.addListener === "function") {
        const failedEvent = BannerAdPluginEvents.FailedToLoad;
        bannerFailureListener = await AdMobPlugin.addListener(
          failedEvent,
          (failure: { code?: number; message?: string }) => {
            if (!bannerCreated) return;
            bannerPlacementEpoch += 1;
            bannerRequested = false;
            bannerCreated = false;
            bannerLoaded = false;
            bannerVisible = false;
            bannerMeasuredHeight = 0;
            bannerViewportWidth = null;
            clearBannerLoadWatchdog();
            reportBannerHeight(0);
            logger.warn("[Ads] Android habits banner failed to load:", failure);
            void enqueueBannerCommand(() =>
              removeNativeBannerAfterFailure(
                "[Ads] Failed to remove unloaded Android habits banner:"
              )
            );
          }
        );
      }

      if (!isLifecycleCurrent(lifecycleEpoch) || !isBannerPlacementCurrent(placementEpoch)) {
        onHeightChange(0);
        return { shown: false, error: "placement_changed" };
      }

      const adId = getBannerAdUnitId("android");
      bannerRequested = true;
      bannerCreated = true;
      bannerLoaded = false;
      bannerVisible = false;
      bannerSuppressionAcknowledged = false;
      bannerMeasuredHeight = 0;
      bannerViewportWidth = currentViewportWidth;
      await withNativeBannerTimeout(
        AdMobPlugin.showBanner({
          adId,
          adSize: BannerAdSize.ADAPTIVE_BANNER,
          position: BannerAdPosition.BOTTOM_CENTER,
          margin: 0,
          isTesting: false,
          npa: true,
        })
      );

      if (!isLifecycleCurrent(lifecycleEpoch) || !isBannerPlacementCurrent(placementEpoch)) {
        logger.log("[Ads] Removing superseded Android habits banner after native show");
        bannerRemovalInFlight = true;
        try {
          await AdMobPlugin.removeBanner?.();
        } finally {
          bannerRemovalInFlight = false;
        }
        bannerCreated = false;
        bannerRequested = false;
        bannerLoaded = false;
        bannerVisible = false;
        bannerMeasuredHeight = 0;
        bannerViewportWidth = null;
        clearBannerLoadWatchdog();
        onHeightChange(0);
        return { shown: false, error: "placement_changed" };
      }

      if (!bannerLoaded) startBannerLoadWatchdog(lifecycleEpoch, placementEpoch);

      return { shown: true };
    } catch (err) {
      bannerPlacementEpoch += 1;
      bannerRequested = false;
      bannerCreated = false;
      bannerLoaded = false;
      bannerVisible = false;
      bannerMeasuredHeight = 0;
      bannerViewportWidth = null;
      clearBannerLoadWatchdog();
      reportBannerHeight(0);
      bannerHeightCallback = null;
      onHeightChange(0);
      logger.warn("[Ads] Android habits banner failed:", err);
      await removeNativeBannerAfterFailure(
        "[Ads] Failed to remove Android habits banner after an error:"
      );
      return {
        shown: false,
        error: err instanceof NativeBannerTimeoutError ? "banner_timeout" : "banner_failed",
      };
    }
  });
}

export function hideHabitsBanner(): Promise<void> {
  bannerPlacementEpoch += 1;
  bannerRequested = false;
  bannerVisible = false;
  clearBannerLoadWatchdog();
  reportBannerHeight(0);

  if (bannerSuppressionInFlight) return bannerSuppressionInFlight;
  if (bannerSuppressionAcknowledged) return Promise.resolve();

  const suppression = enqueueBannerCommand(async () => {
    if (!bannerCreated || !AdMobPlugin) {
      bannerSuppressionAcknowledged = true;
      return;
    }

    try {
      await withNativeBannerTimeout(AdMobPlugin.hideBanner());
      bannerSuppressionAcknowledged = true;
    } catch (err) {
      logger.warn("[Ads] Failed to hide Android habits banner:", err);
      const removed = await removeNativeBannerAfterFailure(
        "[Ads] Failed to remove Android habits banner after hide failure:"
      );
      if (!removed) {
        // The native AdView may still be attached above the WebView. Preserve
        // the created state so a user retry issues another native command, and
        // reject the acknowledgement so protected UI stays unmounted.
        throw new NativeBannerSuppressionError();
      }
      bannerCreated = false;
      bannerLoaded = false;
      bannerMeasuredHeight = 0;
      bannerViewportWidth = null;
    }
  });
  const trackedSuppression = suppression.finally(() => {
    if (bannerSuppressionInFlight === trackedSuppression) {
      bannerSuppressionInFlight = null;
    }
  });
  bannerSuppressionInFlight = trackedSuppression;
  return trackedSuppression;
}

export function removeHabitsBanner(): Promise<void> {
  logger.log("[Ads] Removing Android habits banner and native listeners");
  bannerPlacementEpoch += 1;
  bannerRequested = false;
  bannerCreated = false;
  bannerLoaded = false;
  bannerVisible = false;
  bannerMeasuredHeight = 0;
  bannerViewportWidth = null;
  clearBannerLoadWatchdog();
  reportBannerHeight(0);

  return enqueueBannerCommand(async () => {
    try {
      if (AdMobPlugin && typeof AdMobPlugin.removeBanner === "function") {
        await withNativeBannerTimeout(AdMobPlugin.removeBanner());
      }
    } catch (err) {
      logger.warn("[Ads] Failed to remove Android habits banner:", err);
    }

    try {
      await bannerSizeListener?.remove?.();
    } catch (err) {
      logger.warn("[Ads] Failed to remove Android banner size listener:", err);
    }

    try {
      await bannerLoadedListener?.remove?.();
    } catch (err) {
      logger.warn("[Ads] Failed to remove Android banner loaded listener:", err);
    }

    try {
      await bannerFailureListener?.remove?.();
    } catch (err) {
      logger.warn("[Ads] Failed to remove Android banner failure listener:", err);
    }

    bannerSizeListener = null;
    bannerLoadedListener = null;
    bannerFailureListener = null;
    bannerHeightCallback = null;
  });
}

export function getAdState(): AdControllerState {
  return { ...state };
}

export function isAdSdkAvailable(): boolean {
  return state.sdkAvailable;
}
