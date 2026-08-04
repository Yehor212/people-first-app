# Contract: Feature Availability

## API

```ts
export type FeatureAvailabilityState =
  | "available"
  | "temporarily-unavailable"
  | "experimental-hidden"
  | "blocked";

export interface FeatureAvailability {
  manifestVersion: 1;
  key: string;
  visible: boolean;
  state: FeatureAvailabilityState;
  reason:
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
    | "unknown-feature";
  source:
    | "user-setting"
    | "onboarding"
    | "local-truth"
    | "remote-rollout"
    | "kill-switch"
    | "build"
    | "release-policy";
  disclosure: "user-safe-reason" | "silent";
}

export interface FeatureAvailabilityApi {
  getFeatureAvailability(feature: ToggleableFeature): FeatureAvailability;
  isFeatureVisible(feature: ToggleableFeature): boolean;
}
```

`isFeatureVisible(feature)` is exactly `getFeatureAvailability(feature).visible`.

## Authority rules

1. The user setting can disable a toggleable feature.
2. Calendar onboarding and the behavioral garden gate can independently unlock their supported features.
3. Behavioral inputs come from current authoritative local state. Journal count is loaded from IndexedDB through the existing settled refresh mechanism.
4. While journal count loads or fails, it is unknown, never zero. Calendar unlock may still independently make a feature available.
5. Unknown keys, missing manifest rows, missing consumers, and absent persisted values fail closed unless the reviewed manifest explicitly defines a safe default.
6. Anonymous or stale design-rollout bucketing controls only reversible visual variants, never security, privacy, billing, migration, or release admission.
7. Remote rollout, kill switch, build capability, and release policy remain read-only authorities in the manifest; this API does not turn them on.
8. AI Coach, V2 rewards, habit Lottie runtime, and the journal save ceremony remain disabled where their existing evidence gates are not closed.

## Initial manifest obligations

| Gate family | Current local owner | Required disposition |
| --- | --- | --- |
| User toggle and onboarding | `FeatureFlagsContext`, `onboardingFlow` | Structured availability with boolean adapter |
| Garden behavioral gate | `computeGardenGateStage` | Replace literal journal count with async local truth |
| Supabase design rollout | Existing design rollout service/store | Inventory source and stale/unavailable behavior; do not auto-enable |
| V2 rewards | `V2_REWARDS_ENABLED` | Blocked by release policy until independently admitted |
| Habit Lottie runtime | `HABIT_LOTTIE_RUNTIME_ENABLED` | Experimental-hidden or blocked; remain false |
| Journal save ceremony | Build define plus runtime circuit breaker | Build/release policy; remain false while human gates are unverified |
| AI Coach | Default flag plus service/security prerequisites | Blocked as service-not-approved |

The durable inventory covers every route and surface in FR-027. Inventory is not runtime proof; each platform row retains its evidence status.

## User disclosure

User-facing copy is permitted only for temporarily unavailable states on a surface where the feature is expected. Copy maps stable reason codes to natural language and never exposes environment variable names, rollout bucket identifiers, internal security policy names, or unsupported dates or promises. Intentionally hidden experiments do not create teaser UI by default.

## Tests

- Authoritative journal count unlocks the expected garden stage.
- Loading/error is not treated as zero or verified empty.
- Settled refresh updates count after create/delete/import/account boundary.
- Calendar unlock remains independent of journal-count availability.
- User-disabled wins over unlock.
- Existing boolean consumers equal structured `.visible`.
- Manifest keys are unique and every known gate owner has a disposition.
- Unknown key, missing stored value, and missing consumer fail closed.
- Design rollout cannot satisfy a release or security gate.
- Negative control: no change enables AI Coach, rewards, Lottie, or ceremony.
