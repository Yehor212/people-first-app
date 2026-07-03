import { describe, expect, it } from "vitest";
import {
  applyPushNotificationsPreference,
  applyAdConsentPreference,
  applyAnalyticsPreference,
  applyNoTrackingPreference,
  canInitializeRewardedAds,
} from "@/lib/privacyConsent";
import type { PrivacySettings } from "@/types";

describe("privacyConsent", () => {
  const base: PrivacySettings = {
    noTracking: false,
    analytics: false,
    consentShown: true,
    adConsent: false,
  };

  it("does not initialize rewarded ads without explicit ad consent", () => {
    expect(canInitializeRewardedAds(base)).toBe(false);
    expect(canInitializeRewardedAds({ ...base, analytics: true })).toBe(false);
  });

  it("blocks rewarded ads when no-tracking mode is enabled", () => {
    expect(canInitializeRewardedAds({ ...base, noTracking: true, adConsent: true })).toBe(false);
  });

  it("allows rewarded ads only after explicit ad consent", () => {
    expect(canInitializeRewardedAds({ ...base, adConsent: true })).toBe(true);
  });

  it("turns off analytics and ads when no-tracking is enabled", () => {
    expect(
      applyNoTrackingPreference(
        { ...base, analytics: true, adConsent: true, pushNotifications: true },
        true,
      ),
    ).toMatchObject({
      noTracking: true,
      analytics: false,
      adConsent: false,
      pushNotifications: false,
    });
  });

  it("allows the explicit no-tracking switch to turn off without enabling optional tracking", () => {
    expect(applyNoTrackingPreference({ ...base, noTracking: true }, false)).toMatchObject({
      noTracking: false,
      analytics: false,
      adConsent: false,
    });
  });

  it("turns no-tracking off when analytics is enabled", () => {
    expect(applyAnalyticsPreference({ ...base, noTracking: true }, true)).toMatchObject({
      noTracking: false,
      analytics: true,
    });
  });

  it("turns no-tracking off when ad consent is enabled", () => {
    expect(applyAdConsentPreference({ ...base, noTracking: true }, true)).toMatchObject({
      noTracking: false,
      adConsent: true,
    });
  });

  it("returns to no-tracking when the final optional signal is disabled", () => {
    expect(applyAdConsentPreference({ ...base, adConsent: true }, false)).toMatchObject({
      noTracking: true,
      analytics: false,
      adConsent: false,
    });
    expect(applyAnalyticsPreference({ ...base, analytics: true }, false)).toMatchObject({
      noTracking: true,
      analytics: false,
      adConsent: false,
    });
    expect(applyPushNotificationsPreference({ ...base, pushNotifications: true }, false)).toMatchObject({
      noTracking: true,
      analytics: false,
      adConsent: false,
      pushNotifications: false,
    });
  });

  it("requires explicit consent for remote push notifications without enabling analytics or ads", () => {
    expect(applyPushNotificationsPreference({ ...base, noTracking: true }, true)).toMatchObject({
      noTracking: false,
      analytics: false,
      adConsent: false,
      pushNotifications: true,
    });
  });
});
