/**
 * Banner-only AdMob configuration.
 *
 * Android is the only runtime placement in the current release. iOS keeps an
 * empty, fail-closed slot so shared configuration never falls back to an ad.
 */

import { ADMOB_BANNER_ID_ANDROID, IS_ADMOB_QA_TEST_MODE } from '@/lib/env';

const PRODUCTION_BANNER_ID_PATTERN = /^ca-app-pub-(\d{16})\/\d+$/;
const GOOGLE_SAMPLE_PUBLISHER_NUMBER = 3_940_256_099_942_544;

export const AD_UNIT_IDS = {
  android: {
    banner: ADMOB_BANNER_ID_ANDROID,
  },
  ios: {
    banner: '',
  },
} as const;

export type AdPlatform = keyof typeof AD_UNIT_IDS;

export function getBannerAdUnitId(targetPlatform: AdPlatform): string {
  return AD_UNIT_IDS[targetPlatform]?.banner || '';
}

export function isValidProductionBannerAdUnitId(value: string): boolean {
  const match = PRODUCTION_BANNER_ID_PATTERN.exec(value.trim());
  return Boolean(match && Number(match[1]) !== GOOGLE_SAMPLE_PUBLISHER_NUMBER);
}

export function isValidQaBannerAdUnitId(value: string): boolean {
  const match = PRODUCTION_BANNER_ID_PATTERN.exec(value.trim());
  return Boolean(
    IS_ADMOB_QA_TEST_MODE &&
    match &&
    Number(match[1]) === GOOGLE_SAMPLE_PUBLISHER_NUMBER
  );
}

export function hasBannerAdUnitId(targetPlatform: AdPlatform): boolean {
  const adUnitId = getBannerAdUnitId(targetPlatform);
  return isValidProductionBannerAdUnitId(adUnitId) || isValidQaBannerAdUnitId(adUnitId);
}
