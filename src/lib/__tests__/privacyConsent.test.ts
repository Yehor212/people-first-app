import { describe, expect, it } from "vitest";
import {
  applyPushNotificationsPreference,
  applyAdConsentPreference,
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

  it("does not let a retired no-tracking value override explicit ad consent", () => {
    expect(canInitializeRewardedAds({ ...base, noTracking: true, adConsent: true })).toBe(true);
  });

  it("allows rewarded ads only after explicit ad consent", () => {
    expect(canInitializeRewardedAds({ ...base, adConsent: true })).toBe(true);
  });

  it("changes only explicit ad consent and leaves retired fields inert", () => {
    expect(applyAdConsentPreference({ ...base, noTracking: true, analytics: true }, true)).toEqual({
      ...base,
      noTracking: true,
      analytics: true,
      adConsent: true,
    });
  });

  it("does not mutate unrelated legacy fields when optional ads are disabled", () => {
    expect(
      applyAdConsentPreference({ ...base, noTracking: true, analytics: true, adConsent: true }, false),
    ).toEqual({
      ...base,
      noTracking: true,
      analytics: true,
      adConsent: false,
    });
  });

  it("changes only explicit remote-push consent", () => {
    expect(applyPushNotificationsPreference({ ...base, noTracking: true }, true)).toEqual({
      ...base,
      noTracking: true,
      pushNotifications: true,
    });
  });
});
