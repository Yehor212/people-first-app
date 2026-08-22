/**
 * Ad Controller — AdMob SDK wrapper
 *
 * Abstracts the AdMob plugin behind a clean interface.
 * When @capacitor-community/admob is not installed, all methods
 * gracefully no-op so the app works without ads.
 */

import { isNative, platform } from '@/lib/platform';
import { logger } from '@/lib/logger';
import { IS_DEV } from '@/lib/env';
import { areAdsRuntimeEnabled } from '@/lib/adRuntimePolicy';
import {
  AD_FREQUENCY,
  AD_MOOD_RULES,
  AD_SACRED_ZONES,
  type AdPlatform,
  type AdSafeZone,
  type AdSacredZone,
  getRewardedAdUnitId,
  hasRewardedAdUnitId,
  isGoogleTestAdUnit,
} from '@/lib/adConfig';
import { SK } from '@/lib/storageKeys';
import { safeJsonParse, storageGetRaw, storageSetRaw } from '@/lib/safeJson';

// ============================================
// TYPES
// ============================================

export interface AdControllerState {
  initialized: boolean;
  sdkAvailable: boolean;
  canRequestAds: boolean;
  privacyOptionsRequired: boolean;
  consentStatus?: string;
  rewardedReady: boolean;
  sessionAdCount: number;
  lastAdTime: number;
  lastDismissTime: number;
}

interface RewardedAdResult {
  success: boolean;
  rewarded: boolean;
  error?: string;
}

export type RewardedAdZone = AdSafeZone | AdSacredZone;

interface RewardedAdOptions {
  currentMood?: string;
  zone?: RewardedAdZone;
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

interface RewardedOutcome {
  rewarded: boolean;
  error?: string;
}

// ============================================
// STATE
// ============================================

const state: AdControllerState = {
  initialized: false,
  sdkAvailable: false,
  canRequestAds: false,
  privacyOptionsRequired: false,
  rewardedReady: false,
  sessionAdCount: 0,
  lastAdTime: 0,
  lastDismissTime: 0,
};

let AdMobPlugin: any = null; // any: Capacitor AdMob plugin type is loaded dynamically
let AdMobModule: any = null;
let adLifecycleEpoch = 0;
const AD_ONBOARDING_GRACE_DAYS = 3;
const SACRED_AD_ZONES = new Set<string>(AD_SACRED_ZONES);

interface StoredOnboardingAdState {
  isNewUser?: boolean;
  daysActive?: number;
}

interface DisableAdsOptions {
  clearPrivacyOptions?: boolean;
}

function isLifecycleCurrent(epoch: number): boolean {
  return epoch === adLifecycleEpoch;
}

function resetAdAvailability(options: DisableAdsOptions = {}): void {
  state.initialized = false;
  state.sdkAvailable = false;
  state.canRequestAds = false;
  if (options.clearPrivacyOptions) state.privacyOptionsRequired = false;
  state.consentStatus = undefined;
  state.rewardedReady = false;
}

export function disableAds(options: DisableAdsOptions = {}): void {
  adLifecycleEpoch += 1;
  resetAdAvailability(options);
}

function disableUndecidedAdsRuntime(): void {
  disableAds({ clearPrivacyOptions: true });
  state.initialized = true;
}

function getNativeAdPlatform(): AdPlatform | null {
  return platform === 'android' || platform === 'ios' ? platform : null;
}

export function isRewardedAdsSupported(): boolean {
  if (!areAdsRuntimeEnabled()) return false;
  const targetPlatform = getNativeAdPlatform();
  return Boolean(isNative && targetPlatform && hasRewardedAdUnitId(targetPlatform));
}

function isWithinOnboardingAdGracePeriod(): boolean {
  const raw = storageGetRaw(SK.ONBOARDING_STATE, '');
  const onboarding = safeJsonParse<StoredOnboardingAdState | null>(raw, null);
  if (onboarding?.isNewUser === false) return false;

  const daysActive = Number(onboarding?.daysActive ?? 1);
  const normalizedDaysActive = Number.isFinite(daysActive) && daysActive > 0 ? daysActive : 1;
  return normalizedDaysActive <= AD_ONBOARDING_GRACE_DAYS;
}

function isSacredAdZone(zone?: RewardedAdZone): boolean {
  return typeof zone === 'string' && SACRED_AD_ZONES.has(zone);
}

async function canRequestNativeAds(module: any, lifecycleEpoch: number): Promise<boolean> {
  if (!AdMobPlugin || typeof AdMobPlugin.requestConsentInfo !== 'function') {
    state.canRequestAds = false;
    state.privacyOptionsRequired = false;
    return false;
  }

  try {
    return await requestNativeConsentInfo(module, { showFormIfRequired: true, lifecycleEpoch });
  } catch (err) {
    state.canRequestAds = false;
    logger.warn('[Ads] Consent check failed; ads disabled for this session:', err);
    return false;
  }
}

function updateConsentState(module: any, consentInfo: any): boolean {
  const privacyRequiredStatus = module?.PrivacyOptionsRequirementStatus?.REQUIRED ?? 'REQUIRED';
  const canRequestAds = consentInfo?.canRequestAds === true;

  state.canRequestAds = canRequestAds;
  state.consentStatus = typeof consentInfo?.status === 'string' ? consentInfo.status : undefined;
  state.privacyOptionsRequired =
    consentInfo?.privacyOptionsRequirementStatus === privacyRequiredStatus;

  return canRequestAds;
}

async function requestNativeConsentInfo(
  module: any,
  options: { showFormIfRequired: boolean; lifecycleEpoch?: number },
): Promise<boolean> {
  const requiredStatus = module?.AdmobConsentStatus?.REQUIRED ?? 'REQUIRED';
  let consentInfo = await AdMobPlugin.requestConsentInfo({
    tagForUnderAgeOfConsent: false,
  });

  if (options.lifecycleEpoch !== undefined && !isLifecycleCurrent(options.lifecycleEpoch)) {
    return false;
  }

  updateConsentState(module, consentInfo);

  if (
    options.showFormIfRequired &&
    consentInfo?.isConsentFormAvailable &&
    consentInfo.status === requiredStatus &&
    typeof AdMobPlugin.showConsentForm === 'function'
  ) {
    consentInfo = await AdMobPlugin.showConsentForm();
    if (options.lifecycleEpoch !== undefined && !isLifecycleCurrent(options.lifecycleEpoch)) {
      return false;
    }
    updateConsentState(module, consentInfo);
  }

  return state.canRequestAds;
}

async function loadAdMobModule(): Promise<any | null> {
  if (!isNative) return null;
  if (AdMobPlugin && AdMobModule) return AdMobModule;

  // Dynamic import — if package isn't installed, this throws
  // @vite-ignore keeps the app resilient if the native package is omitted in web-only builds.
  const moduleName = '@capacitor-community/admob';
  const module = await import(/* @vite-ignore */ moduleName);
  AdMobPlugin = module.AdMob;
  AdMobModule = module;
  return module;
}

export async function refreshAdPrivacyOptionsStatus(): Promise<AdPrivacyOptionsStatus> {
  if (!areAdsRuntimeEnabled()) {
    disableUndecidedAdsRuntime();
    return { canRequestAds: false, privacyOptionsRequired: false, error: 'ads_off' };
  }

  if (!isNative) {
    state.canRequestAds = false;
    state.privacyOptionsRequired = false;
    return { canRequestAds: false, privacyOptionsRequired: false, error: 'native_unavailable' };
  }

  try {
    const module = await loadAdMobModule();
    if (!module || !AdMobPlugin || typeof AdMobPlugin.requestConsentInfo !== 'function') {
      state.canRequestAds = false;
      state.privacyOptionsRequired = false;
      return { canRequestAds: false, privacyOptionsRequired: false, error: 'consent_api_unavailable' };
    }

    await requestNativeConsentInfo(module, { showFormIfRequired: false });
    return {
      canRequestAds: state.canRequestAds,
      privacyOptionsRequired: state.privacyOptionsRequired,
    };
  } catch (err) {
    state.canRequestAds = false;
    logger.warn('[Ads] Privacy options status refresh failed:', err);
    return {
      canRequestAds: false,
      privacyOptionsRequired: state.privacyOptionsRequired,
      error: 'privacy_options_status_failed',
    };
  }
}

// ============================================
// INITIALIZATION
// ============================================

/**
 * Initialize AdMob SDK. Call once at app start.
 * Gracefully handles missing SDK (PWA mode).
 */
export async function initializeAds(): Promise<boolean> {
  if (!areAdsRuntimeEnabled()) {
    disableUndecidedAdsRuntime();
    return false;
  }

  if (state.initialized) return state.sdkAvailable;
  const lifecycleEpoch = adLifecycleEpoch;

  // Only native platforms have AdMob
  if (!isNative) {
    state.initialized = true;
    state.sdkAvailable = false;
    logger.log('[Ads] PWA mode — ads disabled');
    return false;
  }

  try {
    const targetPlatform = getNativeAdPlatform();
    if (!isRewardedAdsSupported() || !targetPlatform) {
      state.initialized = true;
      state.sdkAvailable = false;
      logger.log('[Ads] No rewarded ad unit configured — ads disabled');
      return false;
    }

    const module = await loadAdMobModule();
    if (!module || !AdMobPlugin) throw new Error('AdMob module unavailable');
    if (!isLifecycleCurrent(lifecycleEpoch)) return false;

    await AdMobPlugin.initialize({
      initializeForTesting: IS_DEV,
      tagForChildDirectedTreatment: false,
      tagForUnderAgeOfConsent: false,
      maxAdContentRating: module.MaxAdContentRating?.General ?? 'General',
    });
    if (!isLifecycleCurrent(lifecycleEpoch)) return false;

    if (!(await canRequestNativeAds(module, lifecycleEpoch))) {
      if (!isLifecycleCurrent(lifecycleEpoch)) return false;
      state.initialized = true;
      state.sdkAvailable = false;
      logger.log('[Ads] Consent not available — ads disabled');
      return false;
    }
    if (!isLifecycleCurrent(lifecycleEpoch)) return false;

    if (isWithinOnboardingAdGracePeriod()) {
      state.initialized = true;
      state.sdkAvailable = false;
      state.rewardedReady = false;
      logger.log('[Ads] Onboarding grace period — rewarded ads disabled');
      return false;
    }

    state.initialized = true;
    state.sdkAvailable = true;
    state.rewardedReady = false;
    logger.log('[Ads] AdMob initialized');

    return true;
  } catch {
    state.initialized = true;
    state.sdkAvailable = false;
    logger.log('[Ads] AdMob SDK not available — ads disabled');
    return false;
  }
}

/**
 * Open the Google UMP privacy options form when the SDK requires a revocation entry point.
 */
export async function showAdPrivacyOptions(): Promise<PrivacyOptionsResult> {
  if (!areAdsRuntimeEnabled()) {
    disableUndecidedAdsRuntime();
    return {
      opened: false,
      canRequestAds: false,
      privacyOptionsRequired: false,
      error: 'ads_off',
    };
  }

  if (!isNative || !AdMobPlugin || !AdMobModule || typeof AdMobPlugin.showPrivacyOptionsForm !== 'function') {
    return {
      opened: false,
      canRequestAds: state.canRequestAds,
      privacyOptionsRequired: state.privacyOptionsRequired,
      error: 'privacy_options_unavailable',
    };
  }

  try {
    await AdMobPlugin.showPrivacyOptionsForm();

    if (typeof AdMobPlugin.requestConsentInfo === 'function') {
      await requestNativeConsentInfo(AdMobModule, { showFormIfRequired: false });
    }

    state.sdkAvailable = state.initialized && state.canRequestAds;
    state.rewardedReady = false;

    return {
      opened: true,
      canRequestAds: state.canRequestAds,
      privacyOptionsRequired: state.privacyOptionsRequired,
    };
  } catch (err) {
    logger.warn('[Ads] Privacy options form failed:', err);
    return {
      opened: false,
      canRequestAds: state.canRequestAds,
      privacyOptionsRequired: state.privacyOptionsRequired,
      error: 'privacy_options_failed',
    };
  }
}

// ============================================
// REWARDED ADS — user-initiated, opt-in only
// ============================================

/**
 * Load a rewarded ad only after explicit user opt-in.
 */
async function prepareRewardedAd(): Promise<void> {
  if (!state.sdkAvailable || !AdMobPlugin) return;
  const lifecycleEpoch = adLifecycleEpoch;

  try {
    const targetPlatform = getNativeAdPlatform();
    const adId = targetPlatform ? getRewardedAdUnitId(targetPlatform) : '';
    if (!adId) return;

    await AdMobPlugin.prepareRewardVideoAd({
      adId,
      isTesting: IS_DEV || isGoogleTestAdUnit(adId),
      npa: true,
    });
    if (!isLifecycleCurrent(lifecycleEpoch) || !state.sdkAvailable) return;
    state.rewardedReady = true;
  } catch (err) {
    state.rewardedReady = false;
    logger.warn('[Ads] Failed to prepare rewarded ad:', err);
  }
}

function getRewardedEventNames(module: any): {
  rewarded: string;
  dismissed: string;
  failedToShow: string;
} {
  const events = module?.RewardAdPluginEvents ?? {};

  return {
    rewarded: events.Rewarded ?? 'onRewardedVideoAdReward',
    dismissed: events.Dismissed ?? 'onRewardedVideoAdDismissed',
    failedToShow: events.FailedToShow ?? 'onRewardedVideoAdFailedToShow',
  };
}

async function removeAdListeners(handles: Array<{ remove?: () => Promise<void> | void }>): Promise<void> {
  await Promise.all(handles.map(async (handle) => {
    try {
      await handle.remove?.();
    } catch (err) {
      logger.warn('[Ads] Failed to remove ad listener:', err);
    }
  }));
}

async function showRewardVideoAndWaitForOutcome(): Promise<RewardedOutcome> {
  if (!AdMobPlugin || typeof AdMobPlugin.showRewardVideoAd !== 'function') {
    return { rewarded: false, error: 'sdk_unavailable' };
  }

  if (typeof AdMobPlugin.addListener !== 'function') {
    const result = await AdMobPlugin.showRewardVideoAd();
    return result && (result.amount !== undefined || result.type !== undefined)
      ? { rewarded: true }
      : { rewarded: false, error: 'dismissed_or_failed' };
  }

  const eventNames = getRewardedEventNames(AdMobModule);
  const handles: Array<{ remove?: () => Promise<void> | void }> = [];

  return new Promise((resolve) => {
    let settled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const settle = (outcome: RewardedOutcome) => {
      if (settled) return;
      settled = true;
      if (timeoutId) clearTimeout(timeoutId);
      void removeAdListeners(handles);
      resolve(outcome);
    };

    const registerListeners = async () => {
      handles.push(await AdMobPlugin.addListener(eventNames.rewarded, () => {
        settle({ rewarded: true });
      }));
      handles.push(await AdMobPlugin.addListener(eventNames.dismissed, () => {
        settle({ rewarded: false, error: 'dismissed_or_failed' });
      }));
      handles.push(await AdMobPlugin.addListener(eventNames.failedToShow, () => {
        settle({ rewarded: false, error: 'dismissed_or_failed' });
      }));

      timeoutId = setTimeout(() => {
        settle({ rewarded: false, error: 'dismissed_or_failed' });
      }, 45_000);

      try {
        const result = await AdMobPlugin.showRewardVideoAd();
        if (result && (result.amount !== undefined || result.type !== undefined)) {
          settle({ rewarded: true });
        }
      } catch (err) {
        logger.warn('[Ads] Rewarded ad show call failed:', err);
        settle({ rewarded: false, error: 'dismissed_or_failed' });
      }
    };

    registerListeners().catch((err) => {
      logger.warn('[Ads] Rewarded ad listener setup failed:', err);
      settle({ rewarded: false, error: 'dismissed_or_failed' });
    });
  });
}

/**
 * Check if a rewarded ad can be shown right now.
 * Respects frequency caps, mood gating, and cooldowns.
 */
export function canShowRewardedAd(currentMood?: string, zone?: RewardedAdZone): {
  allowed: boolean;
  reason?: string;
} {
  if (!areAdsRuntimeEnabled()) {
    return { allowed: false, reason: 'ads_off' };
  }

  if (isSacredAdZone(zone)) {
    return { allowed: false, reason: 'sacred_zone' };
  }

  if (isWithinOnboardingAdGracePeriod()) {
    return { allowed: false, reason: 'onboarding_grace_period' };
  }

  if (!state.sdkAvailable) {
    return { allowed: false, reason: 'sdk_unavailable' };
  }

  const targetPlatform = getNativeAdPlatform();
  if (!targetPlatform || !hasRewardedAdUnitId(targetPlatform)) {
    return { allowed: false, reason: 'ad_unit_unconfigured' };
  }

  // Mood gating
  if (currentMood && AD_MOOD_RULES.blockedMoods.includes(currentMood)) {
    return { allowed: false, reason: 'mood_blocked' };
  }

  // Reduced mode for bad mood
  if (currentMood && AD_MOOD_RULES.reducedMoods.includes(currentMood)) {
    if (state.sessionAdCount >= AD_MOOD_RULES.reducedMaxPerSession) {
      return { allowed: false, reason: 'mood_reduced_limit' };
    }
  }

  // Session limit
  if (state.sessionAdCount >= AD_FREQUENCY.maxRewardedPerSession) {
    return { allowed: false, reason: 'session_limit' };
  }

  // Daily limit
  const today = new Date().toDateString();
  const savedDate = storageGetRaw(SK.AD_COUNT_DATE);
  const dailyCount = savedDate === today
    ? parseInt(storageGetRaw(SK.AD_DAILY_REWARDED) || '0', 10)
    : 0;

  if (dailyCount >= AD_FREQUENCY.maxRewardedPerDay) {
    return { allowed: false, reason: 'daily_limit' };
  }

  // Cooldown between ads
  const now = Date.now();
  if (state.lastAdTime > 0 && (now - state.lastAdTime) < AD_FREQUENCY.minIntervalMs) {
    return { allowed: false, reason: 'cooldown' };
  }

  // Dismiss cooldown
  if (state.lastDismissTime > 0 && (now - state.lastDismissTime) < AD_FREQUENCY.dismissCooldownMs) {
    return { allowed: false, reason: 'dismiss_cooldown' };
  }

  return { allowed: true };
}

/**
 * Show a rewarded video ad. Returns whether the user earned the reward.
 */
export async function showRewardedAd(options: RewardedAdOptions = {}): Promise<RewardedAdResult> {
  const gate = canShowRewardedAd(options.currentMood, options.zone);
  if (!gate.allowed) {
    return { success: false, rewarded: false, error: gate.reason ?? 'not_allowed' };
  }

  try {
    // Prepare inventory only after the user explicitly opted in from an approved safe zone.
    if (!state.rewardedReady) {
      await prepareRewardedAd();
    }

    if (!state.rewardedReady) {
      return { success: false, rewarded: false, error: 'ad_not_ready' };
    }

    state.rewardedReady = false;
    const outcome = await showRewardVideoAndWaitForOutcome();

    if (!outcome.rewarded) {
      state.lastDismissTime = Date.now();
      state.rewardedReady = false;

      return { success: false, rewarded: false, error: outcome.error ?? 'dismissed_or_failed' };
    }

    // Track counts
    state.sessionAdCount++;
    state.lastAdTime = Date.now();

    const today = new Date().toDateString();
    const savedDate = storageGetRaw(SK.AD_COUNT_DATE);
    let dailyCount = savedDate === today
      ? parseInt(storageGetRaw(SK.AD_DAILY_REWARDED) || '0', 10)
      : 0;

    dailyCount++;
    storageSetRaw(SK.AD_DAILY_REWARDED, String(dailyCount));
    storageSetRaw(SK.AD_COUNT_DATE, today);
    storageSetRaw(SK.AD_LAST_SHOWN, String(Date.now()));

    state.rewardedReady = false;

    return {
      success: true,
      rewarded: true,
    };
  } catch (err) {
    state.lastDismissTime = Date.now();
    state.rewardedReady = false;
    logger.warn('[Ads] Rewarded ad failed/dismissed:', err);

    return { success: false, rewarded: false, error: 'dismissed_or_failed' };
  }
}

// ============================================
// GETTERS
// ============================================

export function getAdState(): AdControllerState {
  return { ...state };
}

export function isAdSdkAvailable(): boolean {
  return state.sdkAvailable;
}

/**
 * Get remaining rewarded ads for today
 */
export function getRemainingRewardedAds(): number {
  const today = new Date().toDateString();
  const savedDate = storageGetRaw(SK.AD_COUNT_DATE);
  const dailyCount = savedDate === today
    ? parseInt(storageGetRaw(SK.AD_DAILY_REWARDED) || '0', 10)
    : 0;

  return Math.max(0, AD_FREQUENCY.maxRewardedPerDay - dailyCount);
}
