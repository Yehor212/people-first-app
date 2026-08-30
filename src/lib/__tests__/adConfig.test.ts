import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  AD_UNIT_IDS,
  getBannerAdUnitId,
  hasBannerAdUnitId,
  isGoogleTestAdUnit,
} from '../adConfig';

const googleAndroidBannerTestId = 'ca-app-pub-3940256099942544/6300978111';
const googleIosBannerTestId = 'ca-app-pub-3940256099942544/2934735716';

describe('banner-only AdMob configuration', () => {
  it('exposes only a banner slot on Android and iOS', () => {
    expect(Object.keys(AD_UNIT_IDS.android)).toEqual(['banner']);
    expect(Object.keys(AD_UNIT_IDS.ios)).toEqual(['banner']);
    expect(getBannerAdUnitId('android')).toBe(AD_UNIT_IDS.android.banner);
    expect(getBannerAdUnitId('ios')).toBe(AD_UNIT_IDS.ios.banner);
  });

  it('recognizes Google sample publisher IDs without bundling exact test-unit fallbacks', () => {
    const configSource = readFileSync('src/lib/adConfig.ts', 'utf8');

    expect(isGoogleTestAdUnit(googleAndroidBannerTestId)).toBe(true);
    expect(isGoogleTestAdUnit(googleIosBannerTestId)).toBe(true);
    expect(isGoogleTestAdUnit('ca-app-pub-9501460293702808/9876543210')).toBe(false);
    expect(configSource).not.toContain(googleAndroidBannerTestId);
    expect(configSource).not.toContain(googleIosBannerTestId);
  });

  it('reports configured banner slots without inventing a production fallback', () => {
    expect(hasBannerAdUnitId('android')).toBe(AD_UNIT_IDS.android.banner.length > 0);
    expect(hasBannerAdUnitId('ios')).toBe(AD_UNIT_IDS.ios.banner.length > 0);
  });
});
