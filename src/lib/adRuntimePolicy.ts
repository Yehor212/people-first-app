/**
 * The product owner has not selected an ADR-MON-001 monetization model.
 * Keep every AdMob/UMP runtime path unavailable until a separately authorized
 * decision changes this source-owned policy and proves its selected branch.
 */
export const ADS_RUNTIME_MODE = 'OFF' as const;

export function areAdsRuntimeEnabled(): boolean {
  return false;
}
