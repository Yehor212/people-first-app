import { describe, expect, it } from "vitest";
import {
  FEATURE_AVAILABILITY_MANIFEST,
  FEATURE_AVAILABILITY_MANIFEST_VERSION,
  getFeatureAvailability,
  isFeatureVisible,
} from "@/lib/featureAvailability";

describe("featureAvailability", () => {
  it("publishes a unique versioned manifest", () => {
    const keys = FEATURE_AVAILABILITY_MANIFEST.map((entry) => entry.key);

    expect(FEATURE_AVAILABILITY_MANIFEST_VERSION).toBe(1);
    expect(new Set(keys).size).toBe(keys.length);
    expect(FEATURE_AVAILABILITY_MANIFEST.every((entry) => entry.manifestVersion === 1)).toBe(true);
  });

  it("fails closed for an unknown feature", () => {
    expect(getFeatureAvailability("not-in-the-reviewed-manifest")).toEqual({
      manifestVersion: 1,
      key: "not-in-the-reviewed-manifest",
      visible: false,
      state: "blocked",
      reason: "unknown-feature",
      source: "release-policy",
      disclosure: "silent",
    });
  });

  it("fails closed when a reviewed user setting is absent", () => {
    expect(
      getFeatureAvailability("deltaSync", {
        consumerPresent: true,
        onboarding: "not-required",
      })
    ).toMatchObject({
      visible: false,
      state: "blocked",
      reason: "configuration-missing",
      source: "user-setting",
      disclosure: "silent",
    });
  });

  it("fails closed when the expected consumer is missing", () => {
    expect(
      getFeatureAvailability("focusTimer", {
        consumerPresent: false,
        userEnabled: true,
        onboarding: "unlocked",
        localTruth: "loading",
      })
    ).toMatchObject({
      visible: false,
      state: "blocked",
      reason: "consumer-missing",
      source: "release-policy",
      disclosure: "silent",
    });
  });

  it("does not let a caller claim a consumer that the reviewed manifest marks missing", () => {
    expect(
      getFeatureAvailability("tasks", {
        consumerPresent: true,
        userEnabled: true,
        onboarding: "unlocked",
        localTruth: "unlocked",
      })
    ).toMatchObject({
      visible: false,
      state: "blocked",
      reason: "consumer-missing",
      source: "release-policy",
      disclosure: "silent",
    });
  });

  it("lets a user setting disable a feature before unlock authorities are evaluated", () => {
    expect(
      getFeatureAvailability("challenges", {
        consumerPresent: true,
        userEnabled: false,
        onboarding: "unlocked",
        localTruth: "unlocked",
      })
    ).toMatchObject({
      visible: false,
      state: "temporarily-unavailable",
      reason: "disabled-by-user",
      source: "user-setting",
      disclosure: "user-safe-reason",
    });
  });

  it("keeps calendar onboarding independent from a loading journal count", () => {
    expect(
      getFeatureAvailability("challenges", {
        consumerPresent: true,
        userEnabled: true,
        onboarding: "unlocked",
        localTruth: "loading",
      })
    ).toMatchObject({
      visible: true,
      state: "available",
      reason: "available",
      source: "onboarding",
      disclosure: "silent",
    });
  });

  it.each([
    ["loading", "journal-count-loading"],
    ["unavailable", "journal-count-unavailable"],
  ] as const)("reports journal count %s as an explicit local-truth state", (localTruth, reason) => {
    expect(
      getFeatureAvailability("challenges", {
        consumerPresent: true,
        userEnabled: true,
        onboarding: "locked",
        localTruth,
      })
    ).toMatchObject({
      visible: false,
      state: "temporarily-unavailable",
      reason,
      source: "local-truth",
      disclosure: "user-safe-reason",
    });
  });

  it("uses authoritative local truth when it independently unlocks a feature", () => {
    expect(
      getFeatureAvailability("challenges", {
        consumerPresent: true,
        userEnabled: true,
        onboarding: "locked",
        localTruth: "unlocked",
      })
    ).toMatchObject({
      visible: true,
      state: "available",
      reason: "available",
      source: "local-truth",
      disclosure: "silent",
    });
  });

  it.each([
    ["aiCoach", "service-not-approved", "release-policy", "blocked"],
    ["v2Rewards", "security-proof-missing", "release-policy", "blocked"],
    ["habitLottieRuntime", "build-capability-missing", "build", "experimental-hidden"],
    ["journalSaveCeremony", "security-proof-missing", "release-policy", "blocked"],
  ] as const)(
    "keeps %s unavailable regardless of permissive caller inputs",
    (feature, reason, source, state) => {
      expect(
        getFeatureAvailability(feature, {
          consumerPresent: true,
          userEnabled: true,
          onboarding: "unlocked",
          localTruth: "unlocked",
        })
      ).toMatchObject({
        visible: false,
        state,
        reason,
        source,
        disclosure: "silent",
      });
    }
  );

  it("does not claim fixed-gate consumers that are not wired through the manifest", () => {
    const fixedKeys = new Set([
      "aiCoach",
      "v2Rewards",
      "habitLottieRuntime",
      "journalSaveCeremony",
    ]);
    const fixedEntries = FEATURE_AVAILABILITY_MANIFEST.filter((entry) =>
      fixedKeys.has(entry.key)
    );

    expect(fixedEntries).toHaveLength(4);
    expect(fixedEntries.every((entry) => entry.consumerPresent === false)).toBe(true);
  });

  it("keeps the boolean adapter equal to structured visibility", () => {
    const cases = [
      {
        feature: "focusTimer",
        input: {
          consumerPresent: true,
          userEnabled: true,
          onboarding: "unlocked" as const,
          localTruth: "loading" as const,
        },
      },
      {
        feature: "quests",
        input: {
          consumerPresent: true,
          userEnabled: true,
          onboarding: "locked" as const,
          localTruth: "unavailable" as const,
        },
      },
      {
        feature: "aiCoach",
        input: {
          consumerPresent: true,
          userEnabled: true,
          onboarding: "not-required" as const,
          localTruth: "not-required" as const,
        },
      },
    ];

    for (const { feature, input } of cases) {
      expect(isFeatureVisible(feature, input)).toBe(getFeatureAvailability(feature, input).visible);
    }
  });
});
