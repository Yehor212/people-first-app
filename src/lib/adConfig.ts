/**
 * Banner-only AdMob configuration.
 *
 * Android is the only runtime placement in the current release. iOS keeps an
 * empty, fail-closed slot so shared configuration never falls back to an ad.
 */

import {
  ADMOB_BANNER_ID_ANDROID,
  ADMOB_BANNER_ID_IOS,
} from '@/lib/env';

export const AD_UNIT_IDS = {
  android: {
    banner: ADMOB_BANNER_ID_ANDROID,
  },
  ios: {
    banner: ADMOB_BANNER_ID_IOS,
  },
} as const;

export type AdPlatform = keyof typeof AD_UNIT_IDS;

export function getBannerAdUnitId(targetPlatform: AdPlatform): string {
  return AD_UNIT_IDS[targetPlatform]?.banner || '';
}

export function hasBannerAdUnitId(targetPlatform: AdPlatform): boolean {
  return getBannerAdUnitId(targetPlatform).trim().length > 0;
}

export function isGoogleTestAdUnit(adId: string): boolean {
  return /^ca-app-pub-3940256099942544[~/]/.test(adId);
}
