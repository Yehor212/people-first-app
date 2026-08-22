# Gate Inventory: Epic 002

## Branch status and evidence boundary

This began as the source-backed baseline inventory and now records the
integrated local Wave 2 candidate. A row marked `VERIFIED` means only that the
named source, contract, or local test was freshly inspected or executed on this
worktree. It does not prove authenticated visibility, a live rollout row,
native runtime behavior, or the public application.

Current Supabase rollout rows, release secrets, installed native binaries, and
authenticated/public visibility remain `UNVERIFIED`. This inventory does not
authorize enabling AI, rewards, ads, Lottie, Journal Save Ceremony, or any paid
or externally configured service.

## Current product surfaces

| Requested surface | Current route or owner | Current gate/consumer evidence | Platforms | Status before Wave 2 |
| --- | --- | --- | --- | --- |
| auth/onboarding/recovery | `src/components/OnboardingFlow.tsx`, `src/hooks/useDeepLinkHandler.ts`, journal reset flow in `src/features/journal/JournalModule.tsx` | Core flows exist. Facebook, Telegram, and Apple readiness inputs are separate compile-time values in `src/lib/env.ts`; challenge deep links use the boolean `isFeatureVisible("challenges")`. | Web/PWA, Android, iOS, Tauri | Source wiring `VERIFIED`; provider setup and live redirects `UNVERIFIED` |
| orb/mood | `src/pages/Index.tsx` and canonical orb components | Core experience is not owned by optional feature flags. Canonical orb checks are a separate visual/runtime gate. | Web/PWA, Android, iOS, Tauri | Source presence `VERIFIED`; rendered parity `UNVERIFIED` |
| habits/garden/tasks/focus | habit/schedule routes, `src/components/ModalLayer.tsx`, `src/contexts/FeatureFlagsContext.tsx` | Focus, quests, and challenges use the structured boolean adapter. Garden eligibility now reads settled IndexedDB journal count; loading/error is explicit and calendar unlock remains independent. Tasks, breathing, gratitude, and inner-world still lack reviewed visibility consumers and fail closed if queried without hiding an existing core route. | Web/PWA, Android, iOS, Tauri | Local evaluator/provider/consumer tests `VERIFIED`; authenticated rendering and native lifecycle `UNVERIFIED` |
| diary | `src/pages/nav-v2/DiaryPage.tsx`, `src/features/journal/JournalModule.tsx` | Core route exists. Wave 1 changes password-removal and partial-read behavior. Journal Save Ceremony now consumes the shared schema-v1 capability decision and remains production-disabled. | Web/PWA, Android, iOS, Tauri | Source wiring and local Chromium phone path `VERIFIED`; real-account cause/device behavior `UNVERIFIED` |
| stats/achievements/friends/challenges | stats routes, `src/components/ModalLayer.tsx`, challenge deep-link handler | Challenges have onboarding/Garden Gate and stored-flag checks; stats, achievements, and friends are not all optional-flag consumers. | Web/PWA, Android, iOS, Tauri | Selected routing `VERIFIED`; complete/public visibility `UNVERIFIED` |
| settings/sync/import/export/delete | settings routes, journal settings, sync hooks, import/export/delete owners | Delta sync uses the current boolean feature flag. Journal data operations have separate auth, sync, production-data, and security gates. | Web/PWA, Android, iOS, Tauri | Source wiring `VERIFIED`; live account/sync behavior `UNVERIFIED` |
| PWA/offline/update | `vite.config.ts`, service-worker/update components, offline queue | PWA is disabled for Capacitor and can be disabled by `VITE_DISABLE_PWA`; queue state is operational state, not feature availability. | Web/PWA | Source gate `VERIFIED`; installed-PWA update lifecycle `UNVERIFIED` |
| Android/iOS/Tauri shells | existing Capacitor scripts and `src-tauri/tauri.conf.json` | Shells consume the same shared availability code and build through one target-specific schema-v1 capability receipt. The receipt cannot enable ceremony. | Android, iOS, Tauri | Entry points, contract tests, and provisional local builds `VERIFIED`; exact-commit receipts, physical Android/iOS, and Windows/Tauri runtime `UNVERIFIED` |

## Current optional-feature inputs

`src/contexts/FeatureFlagsContext.tsx` owns these stored boolean keys:

- `focusTimer`, `breathingExercise`, `gratitudeJournal`, `quests`, `tasks`,
  `challenges`, `aiCoach`, `innerWorld`, and `deltaSync`;
- default `aiCoach=false`; `deltaSync=true` according to its existing migration
  comment; other defaults are true;
- onboarding mappings exist for focus, quests, tasks, and challenges;
- Garden Gate derives habits, focus sessions, mood dates, and a settled
  `db.journalEntries.count()` result;
- loading/error journal truth is never coerced to zero;
- a missing persisted value uses only an explicit reviewed manifest default;
  missing unreviewed defaults and missing consumers fail closed.

The original literal zero and permissive fallback remain baseline facts in Git
history; they are absent from the integrated candidate.

## Integrated Wave 2 contract

Wave 2 introduces a versioned `FeatureAvailability` result and retains
`isFeatureVisible()` only as its boolean projection. The following
dispositions are implemented locally and remain bounded by the evidence in
`evidence/wave-2.md`:

| Key / capability | Local disposition | Required authority and rejection rule |
| --- | --- | --- |
| `focusTimer`, `quests`, `challenges` | Available only when stored choice and onboarding or authoritative local-truth unlock permit it | Calendar onboarding is an independent accepted unlock. Behavioral diary eligibility requires settled IndexedDB count; loading/error is not zero |
| `deltaSync` | Follow the reviewed stored setting and existing sync contract | Reject any adapter that bypasses account/sync safeguards |
| `tasks`, `breathingExercise`, `gratitudeJournal`, `innerWorld` | `consumer-missing` if queried through the manifest | Do not route or hide an existing core surface until a concrete consumer is reviewed |
| `aiCoach` | Blocked | No approved service/API/security/platform packet in this Epic |
| rewards / rewarded ads | Blocked by their existing independent privacy, consent, platform, readiness, unit-ID, safe-zone, and quota owners | A feature manifest cannot override ad/privacy/release gates |
| habit Lottie runtime | Experimental-hidden | `HABIT_LOTTIE_RUNTIME_ENABLED=false`; technical assets are not product approval |
| Journal Save Ceremony | Blocked by non-enabling schema v1 and active kill switch | Local technical/Chromium evidence exists; exact-candidate accessibility/performance, Artistic/Craft, Motion, and owner approval remain required |

## Supabase design rollout gates

`src/stores/designFlagStore.ts` reads public `design_flags` rows and
`src/hooks/useDesignFlag.ts` applies kill switch, enabled state, and rollout
bucket. Migrations name typography, motion, mood-slider color, paper theme, and
navigation variants. Only the mood-slider source was confirmed as a direct
consumer during this inventory. Current remote rows, cohorts, and kill switches
are `UNVERIFIED`; migration seeds are not live-state proof.

## Compile-time and hard-disabled gates

| Gate | Current source disposition | Wave 1 decision |
| --- | --- | --- |
| Journal Save Ceremony | `vite.config.ts` derives the production literal from `config/feature-capabilities.json`; schema v1 always returns false, the kill switch is active, and `JournalModule.tsx` prunes the dynamic import. The raw Vite variable is development-only. | Preserve false release posture; all four production targets write and validate the same non-enabling receipt contract |
| Habit Lottie runtime | `src/components/habit-pictogram/habitMotionAssets.ts`: `HABIT_LOTTIE_RUNTIME_ENABLED=false` | Keep false |
| Hyperfocus Spotify/DND | `src/components/hyperfocus/types.ts`: `SHOW_SPOTIFY=false`, `SHOW_DND=false` | Keep false |
| PWA | Enabled for web unless explicitly disabled; disabled for Capacitor | Preserve existing split |
| Facebook/Telegram/Apple auth | Independent provider/readiness inputs in `src/lib/env.ts` | No change without provider/release evidence |
| Rewarded ads | Independent consent/platform/unit-ID/readiness/safe-zone/quota gates | No enablement |

## Wave 2/3 evidence and Wave 3 rejection path

- Wave 2 local checks reject `journalEntries: 0`, unknown/missing enablement,
  unreviewed defaults, and an unnamed consumer. Fresh exact commands and counts
  are retained in `evidence/wave-2.md`.
- Wave 3 local checks cover the schema, four release targets, actual saved-card
  anchor, delivery states, and Chromium degradation paths. Exact commands,
  screenshot hashes, and remaining human gates are retained in
  `evidence/wave-3.md`.
- Authenticated rendering, live rollout rows, physical devices, Windows/Tauri,
  public deploy, and native-speaker acceptance remain `UNVERIFIED`.
- Reject Wave 3 if a raw environment variable or tracked self-attestation can
  enable ceremony, target receipts differ, or any human/visual gate is absent.
- Verify public/release behavior only on the exact accepted commit and artifact.
  Until then every authenticated, public, physical-device, and artistic row is
  `UNVERIFIED`.
