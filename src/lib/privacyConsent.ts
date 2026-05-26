import type { PrivacySettings } from "@/types";

export function canInitializeRewardedAds(privacy: PrivacySettings): boolean {
  return privacy.adConsent === true && privacy.noTracking !== true;
}

export function applyNoTrackingPreference(
  privacy: PrivacySettings,
  checked: boolean,
): PrivacySettings {
  if (!checked && !privacy.analytics && !privacy.adConsent) {
    return privacy;
  }

  return {
    ...privacy,
    noTracking: checked,
    analytics: checked ? false : privacy.analytics,
    adConsent: checked ? false : privacy.adConsent,
  };
}

export function applyAnalyticsPreference(
  privacy: PrivacySettings,
  checked: boolean,
): PrivacySettings {
  return {
    ...privacy,
    analytics: checked,
    noTracking: checked ? false : privacy.noTracking || (!privacy.adConsent && !checked),
  };
}

export function applyAdConsentPreference(
  privacy: PrivacySettings,
  checked: boolean,
): PrivacySettings {
  return {
    ...privacy,
    adConsent: checked,
    noTracking: checked ? false : privacy.noTracking || (!privacy.analytics && !checked),
  };
}
