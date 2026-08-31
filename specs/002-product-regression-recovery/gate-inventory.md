# Gate inventory: Epic 002

## Scope and evidence boundary

This inventory records gates found in the current ZenFlow source and the
consumer that actually enforces each decision. It is not an enablement request.
Repository source and deterministic tests can prove wiring; current Supabase
rows, release secrets, installed native binaries, and user-visible public
behavior remain UNVERIFIED until checked against the exact release commit.

The inventory distinguishes:

- user settings and progressive unlocks owned by FeatureFlagsContext;
- the IndexedDB-derived diary count used by Garden Gate;
- Supabase design_flags rollout rows and their kill switches;
- compile-time environment gates in src/lib/env.ts and vite.config.ts;
- fixed release-policy blocks in src/lib/featureAvailability.ts;
- hard-disabled animation/runtime candidates that must not be enabled by this epic.

## Product surface inventory

| Requested surface | Current route or owner | Gate and consumer status | Platforms | Evidence status |
|---|---|---|---|---|
| auth/onboarding/recovery | src/components/OnboardingFlow.tsx, src/hooks/useDeepLinkHandler.ts, journal reset flow in src/features/journal/JournalModule.tsx | Core flow is present. Facebook, Telegram, and Apple auth have separate compile-time readiness inputs in src/lib/env.ts; challenge deep links use isFeatureVisible("challenges"). | Web/PWA, Android, iOS, Tauri | Source wiring VERIFIED; provider configuration and live redirects UNVERIFIED. |
| orb/mood | src/pages/Index.tsx and canonical orb components | Core experience is not owned by the optional-feature manifest. Canonical orb checks remain a separate visual/runtime release gate. | Web/PWA, Android, iOS, Tauri | Source presence VERIFIED; rendered platform parity UNVERIFIED. |
| habits/garden/tasks/focus | Habits and schedule routes plus src/components/ModalLayer.tsx | Focus uses the structured adapter. The legacy tasks, breathingExercise, gratitudeJournal, and innerWorld user toggles have consumer-missing for visibility enforcement: their product routes currently exist outside that optional gate. This epic does not hide or enable those routes. | Web/PWA, Android, iOS, Tauri | Focus consumer and missing-consumer finding VERIFIED; runtime visibility UNVERIFIED. |
| diary | src/pages/nav-v2/DiaryPage.tsx, src/features/journal/JournalModule.tsx | Core route is present. Password removal uses owner/revision/decryption preflight. Journal Save Ceremony is separately compile-time and release-policy gated. | Web/PWA, Android, iOS, Tauri | Source wiring VERIFIED; real-account cause and device behavior UNVERIFIED. |
| stats/achievements/friends/challenges | Stats routes and src/components/ModalLayer.tsx | Challenges use progressive unlock plus real diary count and adapter checks, including deep links. Stats, achievements, and friends are not optional-manifest consumers. | Web/PWA, Android, iOS, Tauri | Source routing VERIFIED; current public visibility UNVERIFIED. |
| settings/sync/import/export/delete | Settings routes, journal settings, sync hooks, import/export/delete owners | Delta sync now uses isFeatureVisible("deltaSync"); journal data actions retain their independent security and production-data gates. | Web/PWA, Android, iOS, Tauri | Source wiring VERIFIED; live sync/account behavior UNVERIFIED. |
| PWA/offline/update | vite.config.ts, service worker/update components, offline queue | PWA is disabled for Capacitor builds and can be disabled by compile-time VITE_DISABLE_PWA; offline queues are runtime state, not feature visibility. | Web/PWA | Source gate VERIFIED; installed-PWA update behavior UNVERIFIED. |
| Android/iOS/Tauri shells | Capacitor build scripts and src-tauri/tauri.conf.json | Native shells consume the same web feature decisions; target build capability receipts are required for the ceremony. No native shell is enabled by this inventory. | Android, iOS, Tauri | Build entry points VERIFIED; physical Android/iOS and Windows/Tauri runtime UNVERIFIED. |

## Versioned optional-feature manifest

src/lib/featureAvailability.ts is the single pure decision contract.
FeatureFlagsContext supplies user settings, onboarding status, and a settled
IndexedDB-derived diary count. isFeatureVisible() is retained as the boolean
adapter for existing consumers.

| Key | Intended current state | Authority | Confirmed consumer | Disclosure |
|---|---|---|---|---|
| focusTimer | available only after user setting plus onboarding or local-truth unlock | user setting, onboarding, IndexedDB local truth | ModalLayer, V2 mindful layer | user-safe reason while count loads/fails or unlock is required |
| quests | available only after user setting plus onboarding or local-truth unlock | user setting, onboarding, IndexedDB local truth | ModalLayer | user-safe reason |
| challenges | available only after user setting plus onboarding or local-truth unlock | user setting, onboarding, IndexedDB local truth | modal layers and challenge deep link | user-safe reason |
| deltaSync | available when its user setting is enabled | user setting | useDeltaSyncEffects through structured adapter | silent when available; user-safe if disabled |
| breathingExercise | existing product surface; optional visibility consumer missing | user setting record only | consumer-missing | silent until a product owner defines routing |
| gratitudeJournal | existing product surface; optional visibility consumer missing | user setting record only | consumer-missing | silent until a product owner defines routing |
| tasks | existing product surface; optional visibility consumer missing | user setting/onboarding records | consumer-missing; schedule/task UI exists independently | silent until a product owner defines routing |
| innerWorld | existing garden state; optional visibility consumer missing | user setting record only | consumer-missing; garden state exists independently | silent until a product owner defines routing |
| aiCoach | blocked | release policy | no approved consumer | silent; service not approved |
| v2Rewards | blocked | release policy | no manifest consumer | silent; security proof missing |
| habitLottieRuntime | experimental-hidden | build/runtime constant | HABIT_LOTTIE_RUNTIME_ENABLED = false | silent; candidate approval missing |
| journalSaveCeremony | blocked | release policy plus compile-time build capability | journal host is tree-pruned while false | silent; exact-candidate human gates missing |

## Supabase design rollout gates

src/stores/designFlagStore.ts reads the public design_flags rows, while
src/hooks/useDesignFlag.ts evaluates kill switch, enabled state, and
deterministic rollout bucket in that order. Migrations define:

- design.typography.v2;
- design.motion.v2;
- design.colors.oklch.mood-slider;
- design.theme.paper;
- design.nav.v2.

Only the mood-slider source currently calls useDesignFlag directly. The actual
production row values, cohort assignments, and kill-switch state are
UNVERIFIED; migration seeds are not proof of current remote state.

## Compile-time and hard-disabled gates

| Gate | Source | Current source disposition | Enablement decision |
|---|---|---|---|
| Journal Save Ceremony | `config/feature-capability-release.json` plus exact-SHA build receipt to the internal Vite literal and `ENABLE_JOURNAL_SAVE_CEREMONY` | requested false, kill switch true, all admission rows unverified; raw `VITE_ENABLE_JOURNAL_SAVE_CEREMONY` is rejected, schema v1 rejects all enabled receipts, and the dynamic import is pruned | Keep false. Tracked admission strings are not authenticated evidence; an enabling schema requires a separate evidence-bound owner-authorized release change. Visual runtime, Artistic/Craft, and user approval are UNVERIFIED. |
| Habit Lottie runtime | src/components/habit-pictogram/habitMotionAssets.ts | HABIT_LOTTIE_RUNTIME_ENABLED = false | Keep false; review candidates are not production approval. |
| Hyperfocus Spotify/DND | src/components/hyperfocus/types.ts | SHOW_SPOTIFY = false, SHOW_DND = false | Keep false; no approved service/platform packet in this epic. |
| PWA | vite.config.ts | on for web unless explicitly disabled; off for Capacitor | Preserve existing platform split. |
| Facebook/Telegram/Apple auth | src/lib/env.ts | provider and readiness flags are independent | Do not change without live provider/release evidence. |
| Rewarded ads | src/lib/adController.ts, src/lib/adConfig.ts, settings privacy control | independent consent, platform, unit-ID, readiness, safe-zone, and quota gates | No enablement. The manifest v2Rewards entry does not override this existing gate owner. |

## Rejection and verification criteria

- Reject any change that reintroduces a literal journalEntries: 0, bypasses
  isFeatureVisible() in a reviewed runtime/deep-link consumer, or enables a
  fixed blocked/experimental capability.
- Reject an enabled ceremony receipt if any technical, accessibility,
  performance, visual-runtime, Artistic/Craft, or user-approval row is not
  pass, or if the kill switch is active.
- Verify locally with the pure evaluator tests, provider async/account-boundary
  tests, scripts/__tests__/feature-availability-inventory.test.ts, i18n and
  translation checks, and the cross-target receipt tests.
- Verify release behavior only from the exact commit's CI artifacts and
  cache-busted public/native runtime. Until then, all public and physical-device
  platform rows remain UNVERIFIED.
