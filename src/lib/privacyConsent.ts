import type { PrivacySettings } from "@/types";

export function canInitializeAds(privacy: PrivacySettings): boolean {
  return privacy.adConsent === true && privacy.adAgeEligibility === "adult";
}

export function applyAdConsentPreference(
  privacy: PrivacySettings,
  checked: boolean,
): PrivacySettings {
  return {
    ...privacy,
    adConsent: checked,
  };
}

export function applyPushNotificationsPreference(
  privacy: PrivacySettings,
  checked: boolean,
): PrivacySettings {
  return {
    ...privacy,
    pushNotifications: checked,
  };
}
