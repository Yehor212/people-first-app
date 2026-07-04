/**
 * Ad System Configuration
 * Non-intrusive, mood-aware, opt-in rewarded ads
 *
 * Philosophy: ads should NEVER interrupt the user.
 * All ad placements are opt-in (user presses a button to watch).
 * Mood-aware gating prevents ads when user is feeling bad.
 */

import { ADMOB_REWARDED_ID_ANDROID, ADMOB_BANNER_ID_ANDROID, ADMOB_REWARDED_ID_IOS, ADMOB_BANNER_ID_IOS, IS_DEV } from '@/lib/env';

// ============================================
// AD UNIT IDS
// ============================================

export const GOOGLE_ADMOB_TEST_IDS = {
  android: {
    rewarded: 'ca-app-pub-3940256099942544/5224354917',
    banner: 'ca-app-pub-3940256099942544/6300978111',
  },
  ios: {
    rewarded: 'ca-app-pub-3940256099942544/1712485313',
    banner: 'ca-app-pub-3940256099942544/2934735716',
  },
} as const;

function adUnitId(envValue: string, testValue: string): string {
  return envValue || (IS_DEV ? testValue : '');
}

export const AD_UNIT_IDS = {
  android: {
    rewarded: adUnitId(ADMOB_REWARDED_ID_ANDROID, GOOGLE_ADMOB_TEST_IDS.android.rewarded),
    banner: adUnitId(ADMOB_BANNER_ID_ANDROID, GOOGLE_ADMOB_TEST_IDS.android.banner),
  },
  ios: {
    rewarded: adUnitId(ADMOB_REWARDED_ID_IOS, GOOGLE_ADMOB_TEST_IDS.ios.rewarded),
    banner: adUnitId(ADMOB_BANNER_ID_IOS, GOOGLE_ADMOB_TEST_IDS.ios.banner),
  },
} as const;

export type AdPlatform = keyof typeof AD_UNIT_IDS;

export function getRewardedAdUnitId(targetPlatform: AdPlatform): string {
  return AD_UNIT_IDS[targetPlatform]?.rewarded || '';
}

export function hasRewardedAdUnitId(targetPlatform: AdPlatform): boolean {
  return getRewardedAdUnitId(targetPlatform).trim().length > 0;
}

export function isGoogleTestAdUnit(adId: string): boolean {
  return Object.values(GOOGLE_ADMOB_TEST_IDS).some((ids) =>
    Object.values(ids).some((testId) => testId === adId),
  );
}

// ============================================
// FREQUENCY CAPS — prevent ad fatigue
// ============================================

export const AD_FREQUENCY = {
  /** Max rewarded videos per day */
  maxRewardedPerDay: 5,

  /** Min milliseconds between any two ads */
  minIntervalMs: 3 * 60 * 1000, // 3 minutes

  /** Max rewarded ads per session (app open → close) */
  maxRewardedPerSession: 3,

  /** Cooldown after user dismisses/skips an ad (ms) */
  dismissCooldownMs: 10 * 60 * 1000, // 10 minutes
} as const;

// ============================================
// MOOD-AWARE GATING — respect user's emotional state
// ============================================

export const AD_MOOD_RULES = {
  /** Moods where NO ads are shown at all */
  blockedMoods: ['terrible', 'bad'] as string[],

  /** Moods where ads are reduced (max 1 per session) */
  reducedMoods: [] as string[],

  /** Max ads when mood is reduced */
  reducedMaxPerSession: 1,
} as const;

// ============================================
// SACRED ZONES — places where ads NEVER appear
// ============================================

export const AD_SACRED_ZONES = [
  'focus_active',      // Timer is running
  'breathing_active',  // Breathing exercise in progress
  'mood_logging',      // User is logging mood
  'journaling',        // User is writing in journal
  'meditation',        // Meditation session active
  'onboarding',        // First-time user experience
] as const;

// ============================================
// SAFE ZONES — places where opt-in ads are OK
// ============================================

export const AD_SAFE_ZONES = [
  'post_focus',        // After completing a focus session
  'daily_rewards',     // Daily rewards screen
  'stats_view',        // Viewing stats/achievements
  'companion_rewards', // Explicit optional rewards area in companion surface
  'settings',          // Settings page
] as const;

// ============================================
// REWARD VALUES — what users get for watching
// ============================================

export const AD_REWARDS = {
  /** Treats earned for watching a rewarded video */
  rewardedVideoTreats: 20,

  /** Multiplier for daily reward doubling */
  dailyRewardMultiplier: 2,

  /** Bonus XP for watching a rewarded video */
  rewardedVideoXp: 25,
} as const;

// ============================================
// STORAGE KEYS
// ============================================

export const AD_STORAGE_KEYS = {
  /** Today's rewarded ad count */
  dailyRewardedCount: 'zenflow-ad-rewarded-count',

  /** Date of last count reset */
  dailyCountDate: 'zenflow-ad-count-date',

  /** Session rewarded count */
  sessionRewardedCount: 'zenflow-ad-session-count',

  /** Timestamp of last ad shown */
  lastAdTimestamp: 'zenflow-ad-last-shown',

  /** Timestamp of last dismiss */
  lastDismissTimestamp: 'zenflow-ad-last-dismiss',

  /** Whether user has seen ad consent */
  adConsentShown: 'zenflow-ad-consent-shown',
} as const;

export type AdSafeZone = (typeof AD_SAFE_ZONES)[number];
export type AdSacredZone = (typeof AD_SACRED_ZONES)[number];
