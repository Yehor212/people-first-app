export const FEATURE_AVAILABILITY_MANIFEST_VERSION = 1 as const;

export type ToggleableFeature =
  | "focusTimer"
  | "breathingExercise"
  | "gratitudeJournal"
  | "quests"
  | "tasks"
  | "challenges"
  | "aiCoach"
  | "innerWorld"
  | "deltaSync";

export type FeatureAvailabilityKey =
  | ToggleableFeature
  | "v2Rewards"
  | "habitLottieRuntime"
  | "journalSaveCeremony";

export type FeatureAvailabilityState =
  | "available"
  | "temporarily-unavailable"
  | "experimental-hidden"
  | "blocked";

export type FeatureAvailabilityReason =
  | "available"
  | "disabled-by-user"
  | "unlock-required"
  | "journal-count-loading"
  | "journal-count-unavailable"
  | "rollout-disabled"
  | "kill-switch"
  | "build-capability-missing"
  | "security-proof-missing"
  | "service-not-approved"
  | "consumer-missing"
  | "configuration-missing"
  | "unknown-feature";

export type FeatureAvailabilitySource =
  | "user-setting"
  | "onboarding"
  | "local-truth"
  | "remote-rollout"
  | "kill-switch"
  | "build"
  | "release-policy";

export interface FeatureAvailability {
  manifestVersion: typeof FEATURE_AVAILABILITY_MANIFEST_VERSION;
  key: string;
  visible: boolean;
  state: FeatureAvailabilityState;
  reason: FeatureAvailabilityReason;
  source: FeatureAvailabilitySource;
  disclosure: "user-safe-reason" | "silent";
}

export type FeatureUnlockAuthorityState =
  | "not-required"
  | "unlocked"
  | "locked"
  | "loading"
  | "unavailable";

export interface FeatureAvailabilityInput {
  consumerPresent?: boolean;
  userEnabled?: boolean;
  onboarding?: FeatureUnlockAuthorityState;
  localTruth?: FeatureUnlockAuthorityState;
}

interface FeatureAvailabilityManifestEntry {
  readonly manifestVersion: typeof FEATURE_AVAILABILITY_MANIFEST_VERSION;
  readonly key: FeatureAvailabilityKey;
  readonly kind: "toggleable" | "fixed";
  readonly consumerPresent: boolean;
  readonly onboardingRequired: boolean;
  readonly authorities: readonly FeatureAvailabilitySource[];
  readonly fixed?: Omit<FeatureAvailability, "manifestVersion" | "key">;
}

const toggleableEntry = (
  key: ToggleableFeature,
  onboardingRequired: boolean,
  authorities: readonly FeatureAvailabilitySource[],
  consumerPresent = true,
): FeatureAvailabilityManifestEntry => ({
  manifestVersion: FEATURE_AVAILABILITY_MANIFEST_VERSION,
  key,
  kind: "toggleable",
  consumerPresent,
  onboardingRequired,
  authorities,
});

const fixedEntry = (
  key: Exclude<FeatureAvailabilityKey, ToggleableFeature> | "aiCoach",
  fixed: Omit<FeatureAvailability, "manifestVersion" | "key">,
  consumerPresent = false,
): FeatureAvailabilityManifestEntry => ({
  manifestVersion: FEATURE_AVAILABILITY_MANIFEST_VERSION,
  key,
  kind: "fixed",
  consumerPresent,
  onboardingRequired: false,
  authorities: [fixed.source],
  fixed,
});

export const FEATURE_AVAILABILITY_MANIFEST = Object.freeze([
  toggleableEntry("focusTimer", true, ["user-setting", "onboarding", "local-truth"]),
  toggleableEntry("breathingExercise", false, ["user-setting"], false),
  toggleableEntry("gratitudeJournal", false, ["user-setting"], false),
  toggleableEntry("quests", true, ["user-setting", "onboarding", "local-truth"]),
  toggleableEntry("tasks", true, ["user-setting", "onboarding", "local-truth"], false),
  toggleableEntry("challenges", true, ["user-setting", "onboarding", "local-truth"]),
  fixedEntry("aiCoach", {
    visible: false,
    state: "blocked",
    reason: "service-not-approved",
    source: "release-policy",
    disclosure: "silent",
  }),
  toggleableEntry("innerWorld", false, ["user-setting"], false),
  toggleableEntry("deltaSync", false, ["user-setting"]),
  fixedEntry("v2Rewards", {
    visible: false,
    state: "blocked",
    reason: "security-proof-missing",
    source: "release-policy",
    disclosure: "silent",
  }),
  fixedEntry("habitLottieRuntime", {
    visible: false,
    state: "experimental-hidden",
    reason: "build-capability-missing",
    source: "build",
    disclosure: "silent",
  }),
  fixedEntry("journalSaveCeremony", {
    visible: false,
    state: "blocked",
    reason: "security-proof-missing",
    source: "release-policy",
    disclosure: "silent",
  }),
] satisfies readonly FeatureAvailabilityManifestEntry[]);

const manifestByKey = new Map<string, FeatureAvailabilityManifestEntry>(
  FEATURE_AVAILABILITY_MANIFEST.map((entry) => [entry.key, entry])
);

function decision(
  key: string,
  visible: boolean,
  state: FeatureAvailabilityState,
  reason: FeatureAvailabilityReason,
  source: FeatureAvailabilitySource,
  disclosure: FeatureAvailability["disclosure"]
): FeatureAvailability {
  return {
    manifestVersion: FEATURE_AVAILABILITY_MANIFEST_VERSION,
    key,
    visible,
    state,
    reason,
    source,
    disclosure,
  };
}

export function getFeatureAvailability(
  feature: string,
  input: FeatureAvailabilityInput = {}
): FeatureAvailability {
  const entry = manifestByKey.get(feature);
  if (!entry) {
    return decision(feature, false, "blocked", "unknown-feature", "release-policy", "silent");
  }

  if (entry.fixed) {
    return {
      manifestVersion: FEATURE_AVAILABILITY_MANIFEST_VERSION,
      key: feature,
      ...entry.fixed,
    };
  }

  if (!entry.consumerPresent || input.consumerPresent === false) {
    return decision(feature, false, "blocked", "consumer-missing", "release-policy", "silent");
  }

  if (input.userEnabled === undefined) {
    return decision(feature, false, "blocked", "configuration-missing", "user-setting", "silent");
  }

  if (!input.userEnabled) {
    return decision(
      feature,
      false,
      "temporarily-unavailable",
      "disabled-by-user",
      "user-setting",
      "user-safe-reason"
    );
  }

  if (!entry.onboardingRequired) {
    return decision(feature, true, "available", "available", "user-setting", "silent");
  }

  if (input.onboarding === "unlocked") {
    return decision(feature, true, "available", "available", "onboarding", "silent");
  }

  if (input.onboarding !== "locked") {
    return decision(feature, false, "blocked", "consumer-missing", "onboarding", "silent");
  }

  if (input.localTruth === "unlocked") {
    return decision(feature, true, "available", "available", "local-truth", "silent");
  }

  if (input.localTruth === "loading") {
    return decision(
      feature,
      false,
      "temporarily-unavailable",
      "journal-count-loading",
      "local-truth",
      "user-safe-reason"
    );
  }

  if (input.localTruth === "unavailable") {
    return decision(
      feature,
      false,
      "temporarily-unavailable",
      "journal-count-unavailable",
      "local-truth",
      "user-safe-reason"
    );
  }

  if (input.localTruth !== "locked") {
    return decision(feature, false, "blocked", "consumer-missing", "local-truth", "silent");
  }

  return decision(
    feature,
    false,
    "temporarily-unavailable",
    "unlock-required",
    "onboarding",
    "user-safe-reason"
  );
}

export function isFeatureVisible(feature: string, input: FeatureAvailabilityInput = {}): boolean {
  return getFeatureAvailability(feature, input).visible;
}
