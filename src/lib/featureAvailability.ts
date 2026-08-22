/**
 * Versioned, fail-closed availability policy for optional ZenFlow surfaces.
 * This module classifies existing authorities; it does not activate remote,
 * build, security, billing, or motion capabilities.
 */

export const TOGGLEABLE_FEATURES = [
  "focusTimer",
  "breathingExercise",
  "gratitudeJournal",
  "quests",
  "tasks",
  "challenges",
  "aiCoach",
  "innerWorld",
  "deltaSync",
] as const;

export type ToggleableFeature = (typeof TOGGLEABLE_FEATURES)[number];

export type FeatureAvailabilityKey =
  | ToggleableFeature
  | "v2Rewards"
  | "rewardedAdAcquisition"
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
  manifestVersion: 1;
  key: string;
  visible: boolean;
  state: FeatureAvailabilityState;
  reason: FeatureAvailabilityReason;
  source: FeatureAvailabilitySource;
  disclosure: "user-safe-reason" | "silent";
}

export type FeatureAvailabilityDisclosureKey =
  | "featureAvailabilityDisabledByUser"
  | "featureAvailabilityUnlockRequired"
  | "featureAvailabilityJournalCountLoading"
  | "featureAvailabilityJournalCountUnavailable";

export type BehavioralUnlockState = "unlocked" | "locked" | "unknown-loading" | "unknown-error";

export interface FeatureAvailabilityRuntimeInput {
  userFlags?: Partial<Record<ToggleableFeature, boolean>> | null;
  calendarUnlocked?: boolean;
  behavioralUnlock?: BehavioralUnlockState;
  /** Inventory-only inputs: neither value is release admission. */
  remoteRolloutEnabled?: boolean;
  buildCapabilityPresent?: boolean;
}

type ManifestDisposition = "toggle" | "blocked" | "experimental-hidden";

export interface FeatureAvailabilityManifestEntry {
  manifestVersion: 1;
  key: FeatureAvailabilityKey;
  disposition: ManifestDisposition;
  hasRuntimeConsumer: boolean;
  defaultUserEnabled?: boolean;
  requiresProgressUnlock?: boolean;
  fixedReason?: Extract<
    FeatureAvailabilityReason,
    | "rollout-disabled"
    | "kill-switch"
    | "build-capability-missing"
    | "security-proof-missing"
    | "service-not-approved"
  >;
  fixedSource?: Extract<
    FeatureAvailabilitySource,
    "remote-rollout" | "kill-switch" | "build" | "release-policy"
  >;
}

export const FEATURE_AVAILABILITY_MANIFEST: readonly FeatureAvailabilityManifestEntry[] =
  Object.freeze([
    {
      manifestVersion: 1,
      key: "focusTimer",
      disposition: "toggle",
      hasRuntimeConsumer: true,
      defaultUserEnabled: true,
      requiresProgressUnlock: true,
    },
    {
      manifestVersion: 1,
      key: "breathingExercise",
      disposition: "toggle",
      hasRuntimeConsumer: false,
      defaultUserEnabled: true,
    },
    {
      manifestVersion: 1,
      key: "gratitudeJournal",
      disposition: "toggle",
      hasRuntimeConsumer: false,
      defaultUserEnabled: true,
    },
    {
      manifestVersion: 1,
      key: "quests",
      disposition: "toggle",
      hasRuntimeConsumer: true,
      defaultUserEnabled: true,
      requiresProgressUnlock: true,
    },
    {
      manifestVersion: 1,
      key: "tasks",
      disposition: "toggle",
      hasRuntimeConsumer: false,
      defaultUserEnabled: true,
      requiresProgressUnlock: true,
    },
    {
      manifestVersion: 1,
      key: "challenges",
      disposition: "toggle",
      hasRuntimeConsumer: true,
      defaultUserEnabled: true,
      requiresProgressUnlock: true,
    },
    {
      manifestVersion: 1,
      key: "aiCoach",
      disposition: "blocked",
      hasRuntimeConsumer: false,
      defaultUserEnabled: false,
      fixedReason: "service-not-approved",
      fixedSource: "release-policy",
    },
    {
      manifestVersion: 1,
      key: "innerWorld",
      disposition: "toggle",
      hasRuntimeConsumer: false,
      defaultUserEnabled: true,
    },
    {
      manifestVersion: 1,
      key: "deltaSync",
      disposition: "toggle",
      hasRuntimeConsumer: true,
      defaultUserEnabled: true,
    },
    {
      manifestVersion: 1,
      key: "v2Rewards",
      disposition: "blocked",
      hasRuntimeConsumer: true,
      fixedReason: "security-proof-missing",
      fixedSource: "release-policy",
    },
    {
      manifestVersion: 1,
      key: "rewardedAdAcquisition",
      disposition: "blocked",
      hasRuntimeConsumer: true,
      fixedReason: "security-proof-missing",
      fixedSource: "release-policy",
    },
    {
      manifestVersion: 1,
      key: "habitLottieRuntime",
      disposition: "experimental-hidden",
      hasRuntimeConsumer: true,
      fixedReason: "rollout-disabled",
      fixedSource: "release-policy",
    },
    {
      manifestVersion: 1,
      key: "journalSaveCeremony",
      disposition: "blocked",
      hasRuntimeConsumer: true,
      fixedReason: "build-capability-missing",
      fixedSource: "release-policy",
    },
  ] satisfies FeatureAvailabilityManifestEntry[]);

function unavailable(
  key: string,
  state: Exclude<FeatureAvailabilityState, "available">,
  reason: FeatureAvailabilityReason,
  source: FeatureAvailabilitySource,
  disclosure: FeatureAvailability["disclosure"] = "silent"
): FeatureAvailability {
  return {
    manifestVersion: 1,
    key,
    visible: false,
    state,
    reason,
    source,
    disclosure,
  };
}

function available(key: string, source: FeatureAvailabilitySource): FeatureAvailability {
  return {
    manifestVersion: 1,
    key,
    visible: true,
    state: "available",
    reason: "available",
    source,
    disclosure: "silent",
  };
}

export function getReviewedFeatureDefault(feature: ToggleableFeature): boolean | undefined {
  return FEATURE_AVAILABILITY_MANIFEST.find((entry) => entry.key === feature)?.defaultUserEnabled;
}

export function evaluateFeatureAvailability(
  key: string,
  input: FeatureAvailabilityRuntimeInput,
  manifest: readonly FeatureAvailabilityManifestEntry[] = FEATURE_AVAILABILITY_MANIFEST
): FeatureAvailability {
  const entry = manifest.find((candidate) => candidate.key === key);
  if (!entry) {
    return unavailable(key, "blocked", "unknown-feature", "release-policy");
  }

  if (entry.disposition !== "toggle") {
    return unavailable(
      key,
      entry.disposition,
      entry.fixedReason ?? "configuration-missing",
      entry.fixedSource ?? "release-policy"
    );
  }

  if (!entry.hasRuntimeConsumer) {
    return unavailable(key, "blocked", "consumer-missing", "release-policy");
  }

  const storedValue = input.userFlags?.[entry.key as ToggleableFeature];
  const userEnabled = typeof storedValue === "boolean" ? storedValue : entry.defaultUserEnabled;
  if (typeof userEnabled !== "boolean") {
    return unavailable(key, "blocked", "configuration-missing", "release-policy");
  }
  if (!userEnabled) {
    return unavailable(
      key,
      "temporarily-unavailable",
      "disabled-by-user",
      "user-setting",
      "user-safe-reason"
    );
  }

  if (!entry.requiresProgressUnlock) return available(key, "user-setting");
  if (input.calendarUnlocked) return available(key, "onboarding");

  switch (input.behavioralUnlock ?? "locked") {
    case "unlocked":
      return available(key, "local-truth");
    case "unknown-loading":
      return unavailable(
        key,
        "temporarily-unavailable",
        "journal-count-loading",
        "local-truth",
        "user-safe-reason"
      );
    case "unknown-error":
      return unavailable(
        key,
        "temporarily-unavailable",
        "journal-count-unavailable",
        "local-truth",
        "user-safe-reason"
      );
    case "locked":
    default:
      return unavailable(
        key,
        "temporarily-unavailable",
        "unlock-required",
        "onboarding",
        "user-safe-reason"
      );
  }
}

export function getFeatureAvailabilityDisclosureKey(
  availability: FeatureAvailability
): FeatureAvailabilityDisclosureKey | null {
  if (availability.disclosure !== "user-safe-reason") return null;
  switch (availability.reason) {
    case "disabled-by-user":
      return "featureAvailabilityDisabledByUser";
    case "unlock-required":
      return "featureAvailabilityUnlockRequired";
    case "journal-count-loading":
      return "featureAvailabilityJournalCountLoading";
    case "journal-count-unavailable":
      return "featureAvailabilityJournalCountUnavailable";
    default:
      return null;
  }
}
