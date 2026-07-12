import type { PrivacySettings } from "@/types";

export function canInitializeRewardedAds(privacy: PrivacySettings): boolean {
  return privacy.adConsent === true;
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
