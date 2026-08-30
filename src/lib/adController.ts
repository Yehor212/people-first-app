/**
 * Android banner-only AdMob controller.
 *
 * The native SDK stays fail-closed on unsupported platforms, missing consent,
 * missing configuration, and the first three onboarding days.
 */

import { getBannerAdUnitId, hasBannerAdUnitId } from "@/lib/adConfig";
import { IS_DEV } from "@/lib/env";
import { logger } from "@/lib/logger";
import { isNative, platform } from "@/lib/platform";
import { safeJsonParse, storageGetRaw } from "@/lib/safeJson";
import { SK } from "@/lib/storageKeys";
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

interface StoredOnboardingAdState {
  isNewUser?: boolean;
  daysActive?: number;
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

const AD_ONBOARDING_GRACE_DAYS = 3;

const AdMobPlugin: any = AdMob;
let adLifecycleEpoch = 0;
let bannerPlacementEpoch = 0;
let bannerCommandQueue: Promise<void> = Promise.resolve();
let bannerCreated = false;
let bannerVisible = false;
let bannerHeight = 0;
let bannerSizeListener: { remove?: () => Promise<void> | void } | null = null;
let bannerFailureListener: { remove?: () => Promise<void> | void } | null = null;
let bannerHeightCallback: ((height: number) => void) | null = null;
let bannerViewportWidth: number | null = null;
let privacyAuthorizationActive = false;

const ANDROID_MOTION_BENCHMARK_ENABLED =
  typeof __ANDROID_MOTION_BENCHMARK__ !== "undefined" && __ANDROID_MOTION_BENCHMARK__;

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
  return Boolean(!IS_DEV && isNative && platform === "android" && hasBannerAdUnitId("android"));
}

function isWithinOnboardingAdGracePeriod(): boolean {
  const raw = storageGetRaw(SK.ONBOARDING_STATE, "");
  const onboarding = safeJsonParse<StoredOnboardingAdState | null>(raw, null);
  if (onboarding?.isNewUser === false) return false;

  const daysActive = Number(onboarding?.daysActive ?? 1);
  const normalizedDaysActive = Number.isFinite(daysActive) && daysActive > 0 ? daysActive : 1;
  return normalizedDaysActive <= AD_ONBOARDING_GRACE_DAYS;
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
      onboardingGracePeriod: isWithinOnboardingAdGracePeriod(),
      lifecycleEpoch: adLifecycleEpoch,
      placementEpoch: bannerPlacementEpoch,
      privacyAuthorizationActive,
      pluginLoaded: true,
      bannerCreated,
      bannerVisible,
      bannerHeight,
      bannerViewportWidth: bannerViewportWidth ?? undefined,
      bannerSizeListenerActive: bannerSizeListener !== null,
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

    if (isWithinOnboardingAdGracePeriod()) {
      state.initialized = true;
      state.sdkAvailable = false;
      logger.log("[Ads] Onboarding grace period — ads disabled");
      return false;
    }

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

function reportBannerHeight(nextHeight: number): void {
  const normalizedHeight = Number.isFinite(nextHeight) && nextHeight > 0 ? nextHeight : 0;
  if (bannerHeight === normalizedHeight) return;
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
  const placementEpoch = ++bannerPlacementEpoch;
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

      bannerHeightCallback = onHeightChange;
      const currentViewportWidth = readViewportWidth();
      if (
        bannerCreated &&
        bannerViewportWidth !== null &&
        currentViewportWidth !== null &&
        bannerViewportWidth !== currentViewportWidth
      ) {
        await AdMobPlugin.removeBanner?.();
        if (!isLifecycleCurrent(lifecycleEpoch) || !isBannerPlacementCurrent(placementEpoch)) {
          onHeightChange(0);
          return { shown: false, error: "placement_changed" };
        }
        bannerCreated = false;
        bannerVisible = false;
        bannerViewportWidth = null;
        reportBannerHeight(0);
      }

      if (bannerCreated) {
        if (!bannerVisible) {
          await AdMobPlugin.resumeBanner();
          if (!isLifecycleCurrent(lifecycleEpoch) || !isBannerPlacementCurrent(placementEpoch)) {
            await AdMobPlugin.removeBanner?.();
            bannerCreated = false;
            bannerVisible = false;
            bannerViewportWidth = null;
            onHeightChange(0);
            return { shown: false, error: "placement_changed" };
          }
          bannerVisible = true;
        } else if (bannerHeight > 0) {
          onHeightChange(bannerHeight);
        }
        return { shown: true };
      }

      if (!bannerSizeListener && typeof AdMobPlugin.addListener === "function") {
        const sizeChangedEvent = BannerAdPluginEvents.SizeChanged;
        bannerSizeListener = await AdMobPlugin.addListener(
          sizeChangedEvent,
          (info: { height?: number }) => {
            if (!isLifecycleCurrent(lifecycleEpoch) || !bannerCreated || !bannerVisible) return;
            const height = Number(info?.height);
            reportBannerHeight(Number.isFinite(height) && height > 0 ? height : 0);
          }
        );
      }

      if (!bannerFailureListener && typeof AdMobPlugin.addListener === "function") {
        const failedEvent = BannerAdPluginEvents.FailedToLoad;
        bannerFailureListener = await AdMobPlugin.addListener(
          failedEvent,
          (failure: { code?: number; message?: string }) => {
            if (!isLifecycleCurrent(lifecycleEpoch)) return;
            bannerPlacementEpoch += 1;
            bannerCreated = false;
            bannerVisible = false;
            bannerViewportWidth = null;
            reportBannerHeight(0);
            logger.warn("[Ads] Android habits banner failed to load:", failure);
            void Promise.resolve(AdMobPlugin?.removeBanner?.()).catch((error) => {
              logger.warn("[Ads] Failed to remove unloaded Android habits banner:", error);
            });
          }
        );
      }

      if (!isLifecycleCurrent(lifecycleEpoch) || !isBannerPlacementCurrent(placementEpoch)) {
        onHeightChange(0);
        return { shown: false, error: "placement_changed" };
      }

      const adId = getBannerAdUnitId("android");
      await AdMobPlugin.showBanner({
        adId,
        adSize: BannerAdSize.ADAPTIVE_BANNER,
        position: BannerAdPosition.BOTTOM_CENTER,
        margin: 0,
        isTesting: false,
        npa: true,
      });

      if (!isLifecycleCurrent(lifecycleEpoch) || !isBannerPlacementCurrent(placementEpoch)) {
        await AdMobPlugin.removeBanner?.();
        bannerCreated = false;
        bannerVisible = false;
        bannerViewportWidth = null;
        onHeightChange(0);
        return { shown: false, error: "placement_changed" };
      }

      bannerCreated = true;
      bannerVisible = true;
      bannerViewportWidth = currentViewportWidth;
      return { shown: true };
    } catch (err) {
      bannerCreated = false;
      bannerVisible = false;
      bannerViewportWidth = null;
      reportBannerHeight(0);
      bannerHeightCallback = null;
      onHeightChange(0);
      logger.warn("[Ads] Android habits banner failed:", err);
      return { shown: false, error: "banner_failed" };
    }
  });
}

export function hideHabitsBanner(): Promise<void> {
  bannerPlacementEpoch += 1;
  bannerVisible = false;
  reportBannerHeight(0);
  return enqueueBannerCommand(async () => {
    if (!bannerCreated || !AdMobPlugin) return;

    try {
      await AdMobPlugin.hideBanner();
    } catch (err) {
      logger.warn("[Ads] Failed to hide Android habits banner:", err);
    }
  });
}

export function removeHabitsBanner(): Promise<void> {
  bannerPlacementEpoch += 1;
  bannerCreated = false;
  bannerVisible = false;
  bannerViewportWidth = null;
  reportBannerHeight(0);

  return enqueueBannerCommand(async () => {
    try {
      if (AdMobPlugin && typeof AdMobPlugin.removeBanner === "function") {
        await AdMobPlugin.removeBanner();
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
      await bannerFailureListener?.remove?.();
    } catch (err) {
      logger.warn("[Ads] Failed to remove Android banner failure listener:", err);
    }

    bannerSizeListener = null;
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
