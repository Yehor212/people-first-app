import { describe, expect, it } from "vitest";
import {
  applyPushNotificationsPreference,
  applyAdConsentPreference,
  canInitializeAds,
} from "@/lib/privacyConsent";
import type { PrivacySettings } from "@/types";

describe("privacyConsent", () => {
  const base: PrivacySettings = {
    noTracking: false,
    analytics: false,
    consentShown: true,
    adConsent: false,
  };

  it("does not initialize ads without explicit ad consent", () => {
    expect(canInitializeAds(base)).toBe(false);
    expect(canInitializeAds({ ...base, analytics: true })).toBe(false);
  });

  it("does not let a retired no-tracking value override explicit ad consent", () => {
    expect(canInitializeAds({ ...base, noTracking: true, adConsent: true })).toBe(true);
  });

  it("allows the optional banner only after explicit ad consent", () => {
    expect(canInitializeAds({ ...base, adConsent: true })).toBe(true);
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
