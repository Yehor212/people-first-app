import { describe, expect, it } from 'vitest';
import { buildRewardedAdsGatePayload } from './gateResponse';

describe('rewarded-ads-gate Edge response', () => {
  it('is OFF by default and returns only bounded public rollout metadata', () => {
    expect(buildRewardedAdsGatePayload({})).toEqual({
      enabled: false,
      revision: 'unconfigured',
      validForSeconds: 60,
    });
  });

  it('requires exact service-owned ON plus a non-placeholder revision', () => {
    expect(buildRewardedAdsGatePayload({
      ZENFLOW_REWARDED_ADS_ENABLED: 'true',
      ZENFLOW_REWARDED_ADS_REVISION: 'android-2.1-owner-checkpoint',
      ZENFLOW_REWARDED_ADS_TTL_SECONDS: '120',
    })).toEqual({
      enabled: true,
      revision: 'android-2.1-owner-checkpoint',
      validForSeconds: 120,
    });

    for (const revision of ['', 'unconfigured', 'placeholder']) {
      expect(buildRewardedAdsGatePayload({
        ZENFLOW_REWARDED_ADS_ENABLED: 'true',
        ZENFLOW_REWARDED_ADS_REVISION: revision,
      }).enabled).toBe(false);
    }
  });

  it('caps TTL and rejects malformed values without extending stale ON', () => {
    expect(buildRewardedAdsGatePayload({
      ZENFLOW_REWARDED_ADS_TTL_SECONDS: '999999',
    }).validForSeconds).toBe(300);
    expect(buildRewardedAdsGatePayload({
      ZENFLOW_REWARDED_ADS_TTL_SECONDS: 'not-a-number',
    }).validForSeconds).toBe(60);
    expect(buildRewardedAdsGatePayload({
      ZENFLOW_REWARDED_ADS_TTL_SECONDS: '0',
    }).validForSeconds).toBe(60);
  });
});
