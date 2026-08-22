import { describe, expect, it } from "vitest";
import {
  FEATURE_AVAILABILITY_MANIFEST,
  evaluateFeatureAvailability,
  getFeatureAvailabilityDisclosureKey,
  type FeatureAvailabilityManifestEntry,
  type FeatureAvailabilityRuntimeInput,
} from "../featureAvailability";

const readyInput: FeatureAvailabilityRuntimeInput = {
  userFlags: { focusTimer: true, quests: true, challenges: true, deltaSync: true },
  calendarUnlocked: false,
  behavioralUnlock: "unlocked",
};

describe("feature availability manifest", () => {
  it("contains one versioned disposition for every key", () => {
    const keys = FEATURE_AVAILABILITY_MANIFEST.map((entry) => entry.key);

    expect(new Set(keys).size).toBe(keys.length);
    expect(FEATURE_AVAILABILITY_MANIFEST.every((entry) => entry.manifestVersion === 1)).toBe(true);
  });

  it("fails closed for an unknown key or a missing manifest row", () => {
    expect(evaluateFeatureAvailability("not-a-feature", readyInput)).toMatchObject({
      visible: false,
      state: "blocked",
      reason: "unknown-feature",
      source: "release-policy",
      disclosure: "silent",
    });

    expect(evaluateFeatureAvailability("focusTimer", readyInput, [])).toMatchObject({
      visible: false,
      reason: "unknown-feature",
    });
  });

  it("uses only an explicit reviewed default when a persisted value is absent", () => {
    expect(
      evaluateFeatureAvailability("focusTimer", {
        ...readyInput,
        userFlags: {},
      })
    ).toMatchObject({ visible: true, state: "available" });

    const withoutDefault: FeatureAvailabilityManifestEntry = {
      ...FEATURE_AVAILABILITY_MANIFEST.find((entry) => entry.key === "focusTimer")!,
      defaultUserEnabled: undefined,
    };
    expect(
      evaluateFeatureAvailability("focusTimer", { ...readyInput, userFlags: {} }, [withoutDefault])
    ).toMatchObject({
      visible: false,
      state: "blocked",
      reason: "configuration-missing",
    });
  });

  it("keeps a user-disabled feature hidden even after every unlock", () => {
    expect(
      evaluateFeatureAvailability("focusTimer", {
        ...readyInput,
        userFlags: { focusTimer: false },
        calendarUnlocked: true,
      })
    ).toMatchObject({
      visible: false,
      state: "temporarily-unavailable",
      reason: "disabled-by-user",
      source: "user-setting",
      disclosure: "user-safe-reason",
    });
  });

  it("distinguishes loading and failed local truth without treating either as zero", () => {
    expect(
      evaluateFeatureAvailability("challenges", {
        ...readyInput,
        behavioralUnlock: "unknown-loading",
      })
    ).toMatchObject({
      visible: false,
      state: "temporarily-unavailable",
      reason: "journal-count-loading",
      source: "local-truth",
    });
    expect(
      evaluateFeatureAvailability("challenges", {
        ...readyInput,
        behavioralUnlock: "unknown-error",
      })
    ).toMatchObject({
      visible: false,
      state: "temporarily-unavailable",
      reason: "journal-count-unavailable",
      source: "local-truth",
    });
  });

  it("lets the independent calendar unlock win while local journal truth is unavailable", () => {
    expect(
      evaluateFeatureAvailability("challenges", {
        ...readyInput,
        calendarUnlocked: true,
        behavioralUnlock: "unknown-error",
      })
    ).toMatchObject({
      visible: true,
      state: "available",
      reason: "available",
      source: "onboarding",
    });
  });

  it("fails closed when a toggle has no reviewed runtime consumer", () => {
    expect(evaluateFeatureAvailability("tasks", readyInput)).toMatchObject({
      visible: false,
      state: "blocked",
      reason: "consumer-missing",
      source: "release-policy",
      disclosure: "silent",
    });
  });

  it("cannot enable protected capabilities through flags or rollout input", () => {
    const permissiveInput: FeatureAvailabilityRuntimeInput = {
      ...readyInput,
      userFlags: {
        aiCoach: true,
        focusTimer: true,
        quests: true,
        challenges: true,
        deltaSync: true,
      },
      remoteRolloutEnabled: true,
      buildCapabilityPresent: true,
    };

    expect(evaluateFeatureAvailability("aiCoach", permissiveInput)).toMatchObject({
      visible: false,
      state: "blocked",
      reason: "service-not-approved",
    });
    expect(evaluateFeatureAvailability("v2Rewards", permissiveInput)).toMatchObject({
      visible: false,
      state: "blocked",
      reason: "security-proof-missing",
    });
    expect(evaluateFeatureAvailability("rewardedAdAcquisition", permissiveInput)).toMatchObject({
      visible: false,
      state: "blocked",
      reason: "security-proof-missing",
    });
    expect(evaluateFeatureAvailability("habitLottieRuntime", permissiveInput)).toMatchObject({
      visible: false,
      state: "experimental-hidden",
      reason: "rollout-disabled",
    });
    expect(evaluateFeatureAvailability("journalSaveCeremony", permissiveInput)).toMatchObject({
      visible: false,
      state: "blocked",
      reason: "build-capability-missing",
    });
  });

  it("maps only disclosed temporary reasons to user-safe localized copy", () => {
    const disabled = evaluateFeatureAvailability("focusTimer", {
      ...readyInput,
      userFlags: { focusTimer: false },
    });
    expect(getFeatureAvailabilityDisclosureKey(disabled)).toBe("featureAvailabilityDisabledByUser");
    expect(
      getFeatureAvailabilityDisclosureKey(
        evaluateFeatureAvailability("journalSaveCeremony", readyInput)
      )
    ).toBeNull();
  });
});
