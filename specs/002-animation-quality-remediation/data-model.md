# Data Model: Animation Quality Remediation

## Scope

No user journal, habit, account, sync, IndexedDB, Supabase, analytics, export, backup, or migration model changes. The only retained state touched is a device-session runtime-performance snapshot. Schedule event records are read-only inputs and are not changed.

## RuntimeRoute

An ephemeral, privacy-minimized string used only in device-local diagnostics.

Fields:

- pathname: required absolute application path; normalized to start with slash.
- nav: optional; retained only when the key and value are explicitly approved.
- navLayout: optional; retained only for supported layout enum values.
- fragment: never retained.
- all other query keys and values: never retained.

Validation:

- malformed values fall back to a safe pathname with no query or fragment;
- duplicate allowed keys collapse through URLSearchParams serialization;
- key name alone is insufficient: its value must pass the allowlist;
- output cannot contain callback code, state, tokens, email, reset identifiers, error descriptions, journal content, or arbitrary user-provided strings.

## RuntimePerformanceModeSnapshot

Existing session-scoped object:

- mode
- activatedAt
- durationMs
- reason
- route

State transition on read:

1. parse using the existing schema;
2. sanitize route;
3. if route changed, rewrite the same snapshot key with every non-route field preserved;
4. return the sanitized object;
5. if parsing fails, retain current invalid-snapshot behavior rather than inventing state.

No versioned migration is required because sessionStorage is device-session scoped and rewrite-on-read is idempotent.

## ScheduleMotionDecision

An ephemeral boolean derived from the existing reactive motion policy.

- true: all current full-motion animation arrays, timings, easings, springs, layers, colors, and dimensions remain active and unchanged.
- false: indefinite ambient loops render a deterministic static frame and have no repeat transition.

Propagation:

ScheduleTimeline -> AnimatedClockRing, PremiumDayPill, TimelineDayColumn -> EventCard3D and CurrentTimeOrb.

This boolean is not persisted, is not a new store, and contains no user data.

## AndroidAdMobConfiguration

Build-time configuration only:

- debug application ID: must be present through the authorized environment/configuration path and must not be Google's sample ID;
- release application ID: existing release enforcement remains unchanged;
- missing debug ID: configuration fails before manifest merge/runtime.

No ID is added to tracked source, fixtures, evidence, logs, or bundles by this feature.

## Invariants

- Sanitization is idempotent.
- Sanitization never adds query data.
- Snapshot rewrite preserves valid non-route fields.
- Schedule false mode cannot retain repeat Infinity.
- Schedule true/default mode is behaviorally identical to the current constants.
- No business record, synthetic history, sample advertising identity, secret, or production-derived dataset is created.

