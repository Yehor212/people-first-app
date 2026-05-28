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
import {
  AD_FREQUENCY,
  AD_MOOD_RULES,
  type AdPlatform,
  getRewardedAdUnitId,
  hasRewardedAdUnitId,
  isGoogleTestAdUnit,
} from '@/lib/adConfig';
import { SK } from '@/lib/storageKeys';
import { storageGetRaw, storageSetRaw } from '@/lib/safeJson';

// ============================================
// TYPES
// ============================================

export interface AdControllerState {
  initialized: boolean;
  sdkAvailable: boolean;
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

// ============================================
// STATE
// ============================================

const state: AdControllerState = {
  initialized: false,
  sdkAvailable: false,
  rewardedReady: false,
  sessionAdCount: 0,
  lastAdTime: 0,
  lastDismissTime: 0,
};

let AdMobPlugin: any = null; // any: Capacitor AdMob plugin type is loaded dynamically

function getNativeAdPlatform(): AdPlatform | null {
  return platform === 'android' || platform === 'ios' ? platform : null;
}

async function canRequestNativeAds(module: any): Promise<boolean> {
  if (!AdMobPlugin || typeof AdMobPlugin.requestConsentInfo !== 'function') {
    return true;
  }

  try {
    const requiredStatus = module.AdmobConsentStatus?.REQUIRED ?? 'REQUIRED';
    const obtainedStatus = module.AdmobConsentStatus?.OBTAINED ?? 'OBTAINED';
    const notRequiredStatus = module.AdmobConsentStatus?.NOT_REQUIRED ?? 'NOT_REQUIRED';
    let consentInfo = await AdMobPlugin.requestConsentInfo({
      tagForUnderAgeOfConsent: false,
    });

    if (consentInfo?.isConsentFormAvailable && consentInfo.status === requiredStatus) {
      consentInfo = await AdMobPlugin.showConsentForm();
    }

    return consentInfo?.canRequestAds === true ||
      consentInfo?.status === obtainedStatus ||
      consentInfo?.status === notRequiredStatus;
  } catch (err) {
    logger.warn('[Ads] Consent check failed; ads disabled for this session:', err);
    return false;
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
  if (state.initialized) return state.sdkAvailable;

  // Only native platforms have AdMob
  if (!isNative) {
    state.initialized = true;
    state.sdkAvailable = false;
    logger.log('[Ads] PWA mode — ads disabled');
    return false;
  }

  try {
    const targetPlatform = getNativeAdPlatform();
    if (!targetPlatform || !hasRewardedAdUnitId(targetPlatform)) {
      state.initialized = true;
      state.sdkAvailable = false;
      logger.log('[Ads] No rewarded ad unit configured — ads disabled');
      return false;
    }

    // Dynamic import — if package isn't installed, this throws
    // @vite-ignore keeps the app resilient if the native package is omitted in web-only builds.
    const moduleName = '@capacitor-community/admob';
    const module = await import(/* @vite-ignore */ moduleName);
    AdMobPlugin = module.AdMob;

    await AdMobPlugin.initialize({
      initializeForTesting: IS_DEV,
      tagForChildDirectedTreatment: false,
      tagForUnderAgeOfConsent: false,
      maxAdContentRating: module.MaxAdContentRating?.General ?? 'General',
    });

    if (!(await canRequestNativeAds(module))) {
      state.initialized = true;
      state.sdkAvailable = false;
      logger.log('[Ads] Consent not available — ads disabled');
      return false;
    }

    state.initialized = true;
    state.sdkAvailable = true;
    logger.log('[Ads] AdMob initialized');

    // Pre-load first rewarded ad
    prepareRewardedAd().catch(err => logger.warn('[Ads]', 'Rewarded ad preload failed:', err));

    return true;
  } catch {
    state.initialized = true;
    state.sdkAvailable = false;
    logger.log('[Ads] AdMob SDK not available — ads disabled');
    return false;
  }
}

// ============================================
// REWARDED ADS — user-initiated, opt-in only
// ============================================

/**
 * Pre-load a rewarded ad so it's ready when user taps "Watch"
 */
async function prepareRewardedAd(): Promise<void> {
  if (!state.sdkAvailable || !AdMobPlugin) return;

  try {
    const targetPlatform = getNativeAdPlatform();
    const adId = targetPlatform ? getRewardedAdUnitId(targetPlatform) : '';
    if (!adId) return;

    await AdMobPlugin.prepareRewardVideoAd({
      adId,
      isTesting: IS_DEV || isGoogleTestAdUnit(adId),
      npa: true,
    });
    state.rewardedReady = true;
  } catch (err) {
    state.rewardedReady = false;
    logger.warn('[Ads] Failed to prepare rewarded ad:', err);
  }
}

/**
 * Check if a rewarded ad can be shown right now.
 * Respects frequency caps, mood gating, and cooldowns.
 */
export function canShowRewardedAd(currentMood?: string): {
  allowed: boolean;
  reason?: string;
} {
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
export async function showRewardedAd(): Promise<RewardedAdResult> {
  if (!state.sdkAvailable || !AdMobPlugin) {
    return { success: false, rewarded: false, error: 'sdk_unavailable' };
  }

  try {
    // Prepare ad if not ready
    if (!state.rewardedReady) {
      await prepareRewardedAd();
    }

    const _result = await AdMobPlugin.showRewardVideoAd();

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

    // Pre-load next ad
    prepareRewardedAd().catch(err => logger.warn('[Ads]', 'Rewarded ad preload failed:', err));

    return {
      success: true,
      rewarded: true,
    };
  } catch (err) {
    state.lastDismissTime = Date.now();
    logger.warn('[Ads] Rewarded ad failed/dismissed:', err);

    // Pre-load next ad
    prepareRewardedAd().catch(err => logger.warn('[Ads]', 'Rewarded ad preload failed:', err));

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
