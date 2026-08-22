/**
 * Ads are a compile-time OFF capability in this release.
 *
 * This compatibility boundary keeps the existing application-facing API while
 * deliberately containing no native SDK, consent, request, display, callback,
 * or reward-ledger path. Re-enabling the capability requires a separately
 * authorized implementation and provenance review.
 */

import type { AdSafeZone, AdSacredZone } from '@/lib/adConfig';

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

export type RewardedAdZone = AdSafeZone | AdSacredZone;

interface RewardedAdOptions {
  currentMood?: string;
  zone?: RewardedAdZone;
}

interface RewardedAdResult {
  success: boolean;
  rewarded: boolean;
  error?: string;
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

interface DisableAdsOptions {
  clearPrivacyOptions?: boolean;
}

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

function setAdsOffState(options: DisableAdsOptions = {}): void {
  state.initialized = true;
  state.sdkAvailable = false;
  state.canRequestAds = false;
  if (options.clearPrivacyOptions) state.privacyOptionsRequired = false;
  state.consentStatus = undefined;
  state.rewardedReady = false;
  state.sessionAdCount = 0;
  state.lastAdTime = 0;
  state.lastDismissTime = 0;
}

export function disableAds(options: DisableAdsOptions = {}): void {
  setAdsOffState(options);
}

export function isRewardedAdsSupported(): boolean {
  return false;
}

export async function refreshAdPrivacyOptionsStatus(): Promise<AdPrivacyOptionsStatus> {
  setAdsOffState({ clearPrivacyOptions: true });
  return { canRequestAds: false, privacyOptionsRequired: false, error: 'ads_off' };
}

export async function initializeAds(): Promise<boolean> {
  setAdsOffState({ clearPrivacyOptions: true });
  return false;
}

export async function showAdPrivacyOptions(): Promise<PrivacyOptionsResult> {
  setAdsOffState({ clearPrivacyOptions: true });
  return {
    opened: false,
    canRequestAds: false,
    privacyOptionsRequired: false,
    error: 'ads_off',
  };
}

export function canShowRewardedAd(_currentMood?: string, _zone?: RewardedAdZone): {
  allowed: boolean;
  reason?: string;
} {
  return { allowed: false, reason: 'ads_off' };
}

export async function showRewardedAd(_options: RewardedAdOptions = {}): Promise<RewardedAdResult> {
  return { success: false, rewarded: false, error: 'ads_off' };
}

export function getAdState(): AdControllerState {
  return { ...state };
}

export function isAdSdkAvailable(): boolean {
  return false;
}

export function getRemainingRewardedAds(): number {
  return 0;
}
