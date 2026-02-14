/**
 * Ad Controller — AdMob SDK wrapper
 *
 * Abstracts the AdMob plugin behind a clean interface.
 * When @capacitor-community/admob is not installed, all methods
 * gracefully no-op so the app works without ads.
 */

import { Capacitor } from '@capacitor/core';
import { logger } from '@/lib/logger';
import {
  AD_UNIT_IDS,
  AD_FREQUENCY,
  AD_MOOD_RULES,
  AD_STORAGE_KEYS,
} from '@/lib/adConfig';

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

let AdMobPlugin: any = null;

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
  if (!Capacitor.isNativePlatform()) {
    state.initialized = true;
    state.sdkAvailable = false;
    logger.log('[Ads] PWA mode — ads disabled');
    return false;
  }

  try {
    // Dynamic import — if package isn't installed, this throws
    // @vite-ignore prevents Rollup from failing when the package isn't installed
    const moduleName = '@capacitor-community/admob';
    const module = await import(/* @vite-ignore */ moduleName);
    AdMobPlugin = module.AdMob;

    await AdMobPlugin.initialize({
      initializeForTesting: import.meta.env.DEV,
    });

    state.initialized = true;
    state.sdkAvailable = true;
    logger.log('[Ads] AdMob initialized');

    // Pre-load first rewarded ad
    prepareRewardedAd().catch(() => {});

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
    const platform = Capacitor.getPlatform() as 'android' | 'ios';
    const adId = AD_UNIT_IDS[platform]?.rewarded;
    if (!adId) return;

    await AdMobPlugin.prepareRewardVideoAd({ adId });
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
  const savedDate = localStorage.getItem(AD_STORAGE_KEYS.dailyCountDate);
  const dailyCount = savedDate === today
    ? parseInt(localStorage.getItem(AD_STORAGE_KEYS.dailyRewardedCount) || '0', 10)
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
    const savedDate = localStorage.getItem(AD_STORAGE_KEYS.dailyCountDate);
    let dailyCount = savedDate === today
      ? parseInt(localStorage.getItem(AD_STORAGE_KEYS.dailyRewardedCount) || '0', 10)
      : 0;

    dailyCount++;
    localStorage.setItem(AD_STORAGE_KEYS.dailyRewardedCount, String(dailyCount));
    localStorage.setItem(AD_STORAGE_KEYS.dailyCountDate, today);
    localStorage.setItem(AD_STORAGE_KEYS.lastAdTimestamp, String(Date.now()));

    // Pre-load next ad
    prepareRewardedAd().catch(() => {});

    return {
      success: true,
      rewarded: true,
    };
  } catch (err) {
    state.lastDismissTime = Date.now();
    logger.warn('[Ads] Rewarded ad failed/dismissed:', err);

    // Pre-load next ad
    prepareRewardedAd().catch(() => {});

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
  const savedDate = localStorage.getItem(AD_STORAGE_KEYS.dailyCountDate);
  const dailyCount = savedDate === today
    ? parseInt(localStorage.getItem(AD_STORAGE_KEYS.dailyRewardedCount) || '0', 10)
    : 0;

  return Math.max(0, AD_FREQUENCY.maxRewardedPerDay - dailyCount);
}
