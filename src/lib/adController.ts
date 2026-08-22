/**
 * Ad Controller — AdMob SDK wrapper
 *
 * Abstracts the installed AdMob plugin behind a clean interface.
 * Non-native platforms keep ads unavailable without loading the native SDK.
 */

import { isNative, platform } from '@/lib/platform';
import { logger } from '@/lib/logger';
import {
  ADMOB_AGE_RESTRICTED_TREATMENT,
  ADMOB_CHILD_DIRECTED_TREATMENT,
  ADMOB_UNDER_AGE_OF_CONSENT,
  IS_DEV,
  type AdMobAgeRestrictedTreatment,
} from '@/lib/env';
import {
  AD_FREQUENCY,
  AD_MOOD_RULES,
  AD_SAFE_ZONES,
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
import {
  isRewardedAdsGateOpen,
  refreshRewardedAdsGate,
} from '@/lib/rewardedAdsGate';

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

export type AdPremiumStatus = 'free' | 'premium' | 'unknown';

export interface RewardedMoodSignal {
  mood: string;
  recordedAt: number;
}

export interface RewardedAdGateOptions {
  moodSignal?: RewardedMoodSignal | null;
  premiumStatus?: AdPremiumStatus;
  zone?: string;
}

interface RewardedAdOptions extends RewardedAdGateOptions {
  /** Opaque UUID of the durable owner-bound attempt, forwarded to AdMob SSV. */
  ssvCustomData?: string;
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

interface AdAudienceTreatment {
  ageRestrictedTreatment: AdMobAgeRestrictedTreatment;
  childDirected: boolean;
  underAgeOfConsent: boolean;
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
let initializationPromise: Promise<boolean> | null = null;
let rewardedAttemptInProgress = false;
const AD_ONBOARDING_GRACE_DAYS = 3;
const SAFE_AD_ZONES = new Set<string>(AD_SAFE_ZONES);
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

function getNativeAdPlatform(): AdPlatform | null {
  return platform === 'android' || platform === 'ios' ? platform : null;
}

function getAdAudienceTreatment(): AdAudienceTreatment | null {
  if (
    ADMOB_AGE_RESTRICTED_TREATMENT === null ||
    typeof ADMOB_CHILD_DIRECTED_TREATMENT !== 'boolean' ||
    typeof ADMOB_UNDER_AGE_OF_CONSENT !== 'boolean'
  ) {
    return null;
  }

  return {
    ageRestrictedTreatment: ADMOB_AGE_RESTRICTED_TREATMENT,
    childDirected: ADMOB_CHILD_DIRECTED_TREATMENT,
    underAgeOfConsent: ADMOB_UNDER_AGE_OF_CONSENT,
  };
}

export function isRewardedAdsSupported(): boolean {
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

function isApprovedAdZone(zone: unknown): zone is AdSafeZone {
  return typeof zone === 'string' && SAFE_AD_ZONES.has(zone);
}

function readStoredTimestamp(key: string): number {
  const parsed = Number(storageGetRaw(key));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function readStoredRewardedCount(): number | null {
  const raw = storageGetRaw(SK.AD_DAILY_REWARDED);
  if (typeof raw !== 'string' || !/^\d+$/.test(raw)) return null;

  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function recordDismissedNow(): void {
  const now = Date.now();
  state.lastDismissTime = now;
  storageSetRaw(SK.AD_LAST_DISMISS, String(now));
}

function isRecentBlockedMood(signal?: RewardedMoodSignal | null): boolean {
  if (!signal || !AD_MOOD_RULES.blockedMoods.includes(signal.mood)) return false;
  if (!Number.isFinite(signal.recordedAt) || signal.recordedAt <= 0) return false;

  const age = Date.now() - signal.recordedAt;
  return age >= 0 && age <= AD_MOOD_RULES.suppressionWindowMs;
}

async function canRequestNativeAds(
  module: any,
  lifecycleEpoch: number,
  audienceTreatment: AdAudienceTreatment,
): Promise<boolean> {
  if (!AdMobPlugin || typeof AdMobPlugin.requestConsentInfo !== 'function') {
    state.canRequestAds = false;
    state.privacyOptionsRequired = false;
    return false;
  }

  try {
    return await requestNativeConsentInfo(module, {
      showFormIfRequired: true,
      lifecycleEpoch,
      audienceTreatment,
    });
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
  options: {
    showFormIfRequired: boolean;
    lifecycleEpoch?: number;
    audienceTreatment?: AdAudienceTreatment | null;
  },
): Promise<boolean> {
  const requiredStatus = module?.AdmobConsentStatus?.REQUIRED ?? 'REQUIRED';
  const consentRequestOptions = options.audienceTreatment
    ? { tagForUnderAgeOfConsent: options.audienceTreatment.underAgeOfConsent }
    : {};
  let consentInfo = await AdMobPlugin.requestConsentInfo(consentRequestOptions);

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

  // Keep this a literal import so Vite emits a resolvable Android bundle chunk.
  const module = await import('@capacitor-community/admob');
  AdMobPlugin = module.AdMob;
  AdMobModule = module;
  return module;
}

export async function refreshAdPrivacyOptionsStatus(): Promise<AdPrivacyOptionsStatus> {
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

    await requestNativeConsentInfo(module, {
      showFormIfRequired: false,
      audienceTreatment: getAdAudienceTreatment(),
    });
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
async function initializeAdsOnce(): Promise<boolean> {
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

    if (isWithinOnboardingAdGracePeriod()) {
      state.initialized = true;
      state.sdkAvailable = false;
      state.rewardedReady = false;
      logger.log('[Ads] Onboarding grace period — rewarded ads disabled');
      return false;
    }

    const audienceTreatment = getAdAudienceTreatment();
    if (!audienceTreatment) {
      state.initialized = true;
      state.sdkAvailable = false;
      state.canRequestAds = false;
      state.rewardedReady = false;
      logger.warn('[Ads] Audience treatment is unverified — ads disabled');
      return false;
    }

    if (!(await refreshRewardedAdsGate())) {
      if (!isLifecycleCurrent(lifecycleEpoch)) return false;
      state.initialized = true;
      state.sdkAvailable = false;
      state.canRequestAds = false;
      state.rewardedReady = false;
      logger.warn('[Ads] Service gate is closed — rewarded ads disabled');
      return false;
    }
    if (!isLifecycleCurrent(lifecycleEpoch)) return false;

    const module = await loadAdMobModule();
    if (!module || !AdMobPlugin) throw new Error('AdMob module unavailable');
    if (!isLifecycleCurrent(lifecycleEpoch)) return false;

    if (!(await canRequestNativeAds(module, lifecycleEpoch, audienceTreatment))) {
      if (!isLifecycleCurrent(lifecycleEpoch)) return false;
      state.initialized = true;
      state.sdkAvailable = false;
      logger.log('[Ads] Consent not available — ads disabled');
      return false;
    }
    if (!isLifecycleCurrent(lifecycleEpoch)) return false;

    await AdMobPlugin.initialize({
      initializeForTesting: IS_DEV,
      ageRestrictedTreatment: audienceTreatment.ageRestrictedTreatment,
      tagForChildDirectedTreatment: audienceTreatment.childDirected,
      tagForUnderAgeOfConsent: audienceTreatment.underAgeOfConsent,
      maxAdContentRating: module.MaxAdContentRating?.General ?? 'General',
    });
    if (!isLifecycleCurrent(lifecycleEpoch)) return false;

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

export async function initializeAds(): Promise<boolean> {
  if (state.initialized) return state.sdkAvailable;
  if (initializationPromise) return initializationPromise;

  initializationPromise = initializeAdsOnce().finally(() => {
    initializationPromise = null;
  });
  return initializationPromise;
}

/**
 * Open the Google UMP privacy options form when the SDK requires a revocation entry point.
 */
export async function showAdPrivacyOptions(): Promise<PrivacyOptionsResult> {
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
      await requestNativeConsentInfo(AdMobModule, {
        showFormIfRequired: false,
        audienceTreatment: getAdAudienceTreatment(),
      });
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
async function prepareRewardedAd(ssvCustomData: string): Promise<void> {
  if (
    !state.sdkAvailable ||
    !state.canRequestAds ||
    !isRewardedAdsGateOpen() ||
    !AdMobPlugin
  ) return;
  const lifecycleEpoch = adLifecycleEpoch;

  try {
    const targetPlatform = getNativeAdPlatform();
    const adId = targetPlatform ? getRewardedAdUnitId(targetPlatform) : '';
    if (!adId) return;

    await AdMobPlugin.prepareRewardVideoAd({
      adId,
      isTesting: IS_DEV || isGoogleTestAdUnit(adId),
      npa: true,
      ssv: { customData: ssvCustomData },
    });
    if (
      !isLifecycleCurrent(lifecycleEpoch) ||
      !state.sdkAvailable ||
      !state.canRequestAds ||
      !isRewardedAdsGateOpen()
    ) return;
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
export function canShowRewardedAd(options: RewardedAdGateOptions = {}): {
  allowed: boolean;
  reason?: string;
} {
  if (isSacredAdZone(options.zone as RewardedAdZone | undefined)) {
    return { allowed: false, reason: 'sacred_zone' };
  }

  if (!isApprovedAdZone(options.zone)) {
    return { allowed: false, reason: 'invalid_zone' };
  }

  if (options.premiumStatus === 'premium') {
    return { allowed: false, reason: 'premium_user' };
  }

  if (options.premiumStatus !== 'free') {
    return { allowed: false, reason: 'premium_unknown' };
  }

  if (isWithinOnboardingAdGracePeriod()) {
    return { allowed: false, reason: 'onboarding_grace_period' };
  }

  if (!isRewardedAdsGateOpen()) {
    return { allowed: false, reason: 'service_gate_closed' };
  }

  if (!state.sdkAvailable) {
    return { allowed: false, reason: 'sdk_unavailable' };
  }

  if (!state.canRequestAds) {
    return { allowed: false, reason: 'consent_unavailable' };
  }

  const targetPlatform = getNativeAdPlatform();
  if (!targetPlatform || !hasRewardedAdUnitId(targetPlatform)) {
    return { allowed: false, reason: 'ad_unit_unconfigured' };
  }

  // Mood gating
  if (isRecentBlockedMood(options.moodSignal)) {
    return { allowed: false, reason: 'mood_blocked' };
  }

  // Session limit
  if (state.sessionAdCount >= AD_FREQUENCY.maxRewardedPerSession) {
    return { allowed: false, reason: 'session_limit' };
  }

  // Daily limit
  const today = new Date().toDateString();
  const savedDate = storageGetRaw(SK.AD_COUNT_DATE);
  const storedDailyCount = savedDate === today ? readStoredRewardedCount() : 0;
  if (storedDailyCount === null) {
    return { allowed: false, reason: 'daily_limit' };
  }
  const dailyCount = storedDailyCount;

  if (dailyCount >= AD_FREQUENCY.maxRewardedPerDay) {
    return { allowed: false, reason: 'daily_limit' };
  }

  // Cooldown between ads
  const now = Date.now();
  const lastAdTime = Math.max(state.lastAdTime, readStoredTimestamp(SK.AD_LAST_SHOWN));
  if (lastAdTime > 0 && (now - lastAdTime) < AD_FREQUENCY.minIntervalMs) {
    return { allowed: false, reason: 'cooldown' };
  }

  // Dismiss cooldown
  const lastDismissTime = Math.max(
    state.lastDismissTime,
    readStoredTimestamp(SK.AD_LAST_DISMISS),
  );
  if (lastDismissTime > 0 && (now - lastDismissTime) < AD_FREQUENCY.dismissCooldownMs) {
    return { allowed: false, reason: 'dismiss_cooldown' };
  }

  return { allowed: true };
}

/**
 * Show a rewarded video ad. Returns whether the user earned the reward.
 */
export async function showRewardedAd(options: RewardedAdOptions = {}): Promise<RewardedAdResult> {
  const gate = canShowRewardedAd(options);
  if (!gate.allowed) {
    return { success: false, rewarded: false, error: gate.reason ?? 'not_allowed' };
  }

  if (
    typeof options.ssvCustomData !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      options.ssvCustomData,
    )
  ) {
    return { success: false, rewarded: false, error: 'attempt_unbound' };
  }

  if (rewardedAttemptInProgress) {
    return { success: false, rewarded: false, error: 'ad_in_progress' };
  }

  rewardedAttemptInProgress = true;

  try {
    // Prepare inventory only after the user explicitly opted in from an approved safe zone.
    if (!state.rewardedReady) {
      await prepareRewardedAd(options.ssvCustomData);
    }

    if (!isRewardedAdsGateOpen()) {
      state.rewardedReady = false;
      return { success: false, rewarded: false, error: 'service_gate_closed' };
    }

    if (!state.rewardedReady) {
      return { success: false, rewarded: false, error: 'ad_not_ready' };
    }

    state.rewardedReady = false;
    const outcome = await showRewardVideoAndWaitForOutcome();

    if (!outcome.rewarded) {
      recordDismissedNow();
      state.rewardedReady = false;

      return { success: false, rewarded: false, error: outcome.error ?? 'dismissed_or_failed' };
    }

    // Track counts
    state.sessionAdCount++;
    const rewardedAt = Date.now();
    state.lastAdTime = rewardedAt;

    const today = new Date().toDateString();
    const savedDate = storageGetRaw(SK.AD_COUNT_DATE);
    let dailyCount = savedDate === today
      ? readStoredRewardedCount() ?? AD_FREQUENCY.maxRewardedPerDay
      : 0;

    dailyCount++;
    storageSetRaw(SK.AD_DAILY_REWARDED, String(dailyCount));
    storageSetRaw(SK.AD_COUNT_DATE, today);
    storageSetRaw(SK.AD_LAST_SHOWN, String(rewardedAt));

    state.rewardedReady = false;

    return {
      success: true,
      rewarded: true,
    };
  } catch (err) {
    recordDismissedNow();
    state.rewardedReady = false;
    logger.warn('[Ads] Rewarded ad failed/dismissed:', err);

    return { success: false, rewarded: false, error: 'dismissed_or_failed' };
  } finally {
    rewardedAttemptInProgress = false;
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

export async function refreshRewardedAdsServiceGate(
  options: { force?: boolean } = {},
): Promise<boolean> {
  const open = await refreshRewardedAdsGate(options);
  if (!open) state.rewardedReady = false;
  return open;
}

/**
 * Get remaining rewarded ads for today
 */
export function getRemainingRewardedAds(): number {
  const today = new Date().toDateString();
  const savedDate = storageGetRaw(SK.AD_COUNT_DATE);
  if (savedDate !== today) return AD_FREQUENCY.maxRewardedPerDay;

  const dailyCount = readStoredRewardedCount();
  if (dailyCount === null) return 0;

  return Math.max(0, AD_FREQUENCY.maxRewardedPerDay - dailyCount);
}
