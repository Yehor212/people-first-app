import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  AD_UNIT_IDS,
  getBannerAdUnitId,
  hasBannerAdUnitId,
  isValidProductionBannerAdUnitId,
} from '../adConfig';

describe('banner-only AdMob configuration', () => {
  it('exposes only a banner slot on Android and iOS', () => {
    expect(Object.keys(AD_UNIT_IDS.android)).toEqual(['banner']);
    expect(Object.keys(AD_UNIT_IDS.ios)).toEqual(['banner']);
    expect(getBannerAdUnitId('android')).toBe(AD_UNIT_IDS.android.banner);
    expect(getBannerAdUnitId('ios')).toBe(AD_UNIT_IDS.ios.banner);
  });

  it('contains no sample-id detector or fallback path in production configuration', () => {
    const configSource = readFileSync('src/lib/adConfig.ts', 'utf8');

    expect(configSource).not.toContain('GOOGLE_ADMOB_TEST_IDS');
    expect(configSource).not.toContain('isGoogleTestAdUnit');
    expect(configSource).not.toContain('3940256099942544');
  });

  it('rejects blank, malformed, and Google sample banner IDs at the runtime boundary', () => {
    expect(isValidProductionBannerAdUnitId('')).toBe(false);
    expect(isValidProductionBannerAdUnitId('banner-123')).toBe(false);
    expect(isValidProductionBannerAdUnitId('ca-app-pub-3940256099942544/6300978111')).toBe(false);
    expect(isValidProductionBannerAdUnitId('ca-app-pub-9501460293702808/9876543210')).toBe(true);
    expect(hasBannerAdUnitId('ios')).toBe(false);
  });

  it('reports configured banner slots without inventing a production fallback', () => {
    expect(hasBannerAdUnitId('android')).toBe(AD_UNIT_IDS.android.banner.length > 0);
    expect(hasBannerAdUnitId('ios')).toBe(AD_UNIT_IDS.ios.banner.length > 0);
  });
});
