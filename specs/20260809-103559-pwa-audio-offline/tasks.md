# Tasks — PWA audio offline

**Authorization boundary**: The user authorized these scoped local source/test tasks on 2026-08-09. Task IDs are dependency ordered and each implementation task names its RED/GREEN proof. `[P]` means different files may proceed after their stated prerequisite, not that shared contracts may be guessed. Commit/push/PR/deploy/native work and `speckit-taskstoissues` remain unauthorized.

## Phase 1 — Baseline and contract

- [ ] T001 Record the focused pre-code RED/characterization output, exact commit, normalized request hash, and platform ledger in `specs/20260809-103559-pwa-audio-offline/evidence/preimplementation-analysis.md`.
- [ ] T002 [P] Add a failing exact-contract selected-cache/integrity/quota/cancel/delete state test in `src/lib/__tests__/pwaAudioOffline.test.ts`, including every `PwaAudioOfflineState` value and proof that `StorageManager.estimate()/persist()` are reachable only from explicit offline download, for FR-002 through FR-006 and SC-001 through SC-003.
- [ ] T003 [P] Add failing service-worker contract tests for no warming, verified `200` admission, and offline Range miss in `src/sw.pwaAudioOffline.test.ts` for FR-001, FR-003, FR-007, SC-001, and SC-002.
- [ ] T004 [P] Add failing interruption/explicit-Resume tests in `src/hooks/__tests__/useUserStartedAmbienceAudio.test.tsx` and `src/lib/__tests__/audioLifecycle.test.ts` for FR-008, FR-009, and SC-004.
- [ ] T005 [P] Add failing localized Media Session action/metadata tests in `src/lib/__tests__/audioMediaSession.test.ts` and rejected/running unlock tests in `src/lib/__tests__/ambientSounds.test.ts` for FR-010, FR-010A, SC-005, and SC-008.
- [ ] T006 [P] Add failing durable-success negative tests for every `APP_AUDIO_ACTION_EVENTS` persistence owner in `src/lib/__tests__/durableAudioCues.test.ts` for FR-011, FR-012, and SC-006.
- [ ] T007 [P] Add a failing tracked-file manifest generator/checker test in `scripts/__tests__/generate-pwa-audio-manifest.test.ts` for stale bytes, missing digest, duplicate ID, and untracked path under FR-003/FR-013.

## Phase 2 — Shared selected-cache foundation

- [ ] T008 Implement exact `PwaAudioCacheEntry`/`PwaAudioOfflineState` validation types and the PWA policy/state coordinator in `src/lib/pwaAudioOffline.ts` to turn T002 GREEN without URL input, automatic retry, or personal-data persistence. [FR-002–FR-006, FR-013]
- [ ] T009 Implement deterministic tracked-audio digest/size/revision generation in `scripts/generate-pwa-audio-manifest.cjs` and checked manifest output in `src/lib/pwaAudioOfflineManifest.ts` to turn T007 GREEN. [FR-003, FR-013]
- [ ] T010 Re-run `src/lib/__tests__/pwaAudioOffline.test.ts` and `scripts/__tests__/generate-pwa-audio-manifest.test.ts` with `--maxWorkers=1`; attach exact results to `specs/20260809-103559-pwa-audio-offline/evidence/preimplementation-analysis.md`. [FR-002–FR-006, SC-001–SC-003]

## Phase 3 — P1 selected offline track

- [ ] T011 [US1] Replace warming message/list/scheduler in `src/sw.ts` and `src/main.tsx` with manifest-only `PWA_AUDIO_*` message handling to turn T003’s no-cold-request assertion GREEN. [FR-001, SC-001]
- [ ] T012 [US1] Implement same-origin full-`200` stream validation, digest/size/revision check, exact revisioned cache key, progress, cancel, and selected-only delete in `src/sw.ts` to turn T003 GREEN. [FR-002–FR-005, FR-007, SC-002, SC-003]
- [ ] T013 [US1] Add Range handling over verified complete cache bodies and explicit unavailable reply for cache misses in `src/sw.ts`; keep `206` out of admission. [FR-003, FR-007, SC-002]
- [ ] T014 [US1] Add one reusable selected offline/progress/cancel/delete/unavailable control and integrate it with the actual existing ambience/focus ownership surfaces, including `src/pages/nav-v2/settings/V2SettingsSoundPanel.tsx`, `src/pages/nav-v2/OrbAmbienceControl.tsx`, `src/features/journal/JournalAmbienceSetting.tsx`, and Hyperfocus selection where applicable; preserve `preload="none"`, 44px targets, and the Web/PWA runtime gate. [FR-002, FR-004, FR-005, FR-012, FR-014]
- [ ] T015 [US1] Add all eight locale keys and RTL-safe labels for selected availability/progress/cancel/delete/quota/integrity/Resume in `src/i18n/translations.ts`; add parity proof in `src/i18n/__tests__/pwaAudioOfflineTranslations.test.ts`. [FR-004, FR-012, SC-005]
- [ ] T016 [US1] Re-run T002/T003 focused tests and `npm run check:app-audio`; capture GREEN evidence in `specs/20260809-103559-pwa-audio-offline/evidence/preimplementation-analysis.md`. [FR-001–FR-007, FR-012, SC-001–SC-003]

## Phase 4 — P1 interruption and explicit resume

- [ ] T017 [US2] Extend `src/hooks/useUserStartedAmbienceAudio.ts` with originating-control interrupted state and a labelled explicit Resume handler, ensuring visible/native resume never calls media `.play()`. [FR-008, FR-009, FR-012, SC-004]
- [ ] T018 [US2] Restrict deferred restoration in `src/lib/audioLifecycle.ts` to re-arming/unlock preparation; route element-audio resume only through T017’s explicit control. [FR-008, FR-009, SC-004]
- [ ] T019 [US2] Update `src/lib/audioMediaSession.ts` and the three existing ambience callers to accept localized title/artist and map Media Session play to the explicit Resume handler. [FR-009, FR-010, FR-012, SC-005]
- [ ] T020 [US2] Correct `src/lib/ambientSounds.ts` so rejected play/non-running context cannot set `audioUnlocked`, then re-run `src/hooks/__tests__/useUserStartedAmbienceAudio.test.tsx`, `src/lib/__tests__/audioLifecycle.test.ts`, `src/lib/__tests__/audioMediaSession.test.ts`, and `src/lib/__tests__/ambientSounds.test.ts` with `--maxWorkers=1`; record GREEN evidence. [FR-008–FR-010A, FR-012, SC-004, SC-005, SC-008]

## Phase 5 — P2 durable success cues

- [ ] T021 [US3] Inventory every `APP_AUDIO_ACTION_EVENTS` invocation and add/adjust post-local-commit guards in its existing owner files, including `src/features/journal/useJournalEditorState.ts`, without introducing a synthetic global success source. [FR-011, FR-013]
- [ ] T022 [US3] Preserve visible/haptic `nonAudioFeedback` at each updated owner and prove routine actions remain silent via `src/lib/__tests__/appAudioAssets.test.ts`. [FR-011, FR-012]
- [ ] T023 [US3] Re-run `src/lib/__tests__/durableAudioCues.test.ts` and `src/lib/__tests__/appAudioAssets.test.ts` with `--maxWorkers=1`; record rejected/conflict and resolved cases separately in `specs/20260809-103559-pwa-audio-offline/evidence/preimplementation-analysis.md`. [FR-011, FR-012, SC-006]

## Phase 6 — Cross-cutting verification and release readiness

- [ ] T024 Run `npm run i18n:check`, `npm run i18n:deep`, and `npm run check:translation-quality` after T015; record ar/he gaps in `specs/20260809-103559-pwa-audio-offline/evidence/preimplementation-analysis.md` as UNVERIFIED rather than passing them from key parity. [FR-004, FR-009, FR-010, FR-012, SC-005]
- [ ] T025 Run `npm run check:production-data-integrity:diff` after all source changes and confirm `src/sw.ts`, audio modules, manifest generator, and tests introduce no production records or evidence laundering; attach the result to `specs/20260809-103559-pwa-audio-offline/evidence/preimplementation-analysis.md`. [FR-013, SC-007]
- [ ] T026 Run `npm run check:app-audio`, `npm run check:hyperfocus-audio`, and the focused asset/audio-manager tests; retain decode, duration, channels/sample rate, clipping/true peak, loop seam, start/stop ramp, and duplicate-content results separately. Missing measurements remain `UNVERIFIED`. [FR-011–FR-015, SC-009]
- [ ] T027 Run `npm run check:all`, `npm run check:canonical-orbs`, and `npm run ci:preflight` sequentially; record results in `specs/20260809-103559-pwa-audio-offline/evidence/preimplementation-analysis.md` and classify unrelated inherited failures only after reproduction on the exact base. [FR-012–FR-014, SC-007]
- [ ] T028 Perform installed Chrome/Edge PWA browser evidence for cold launch, selection, integrity mismatch, quota, offline Range, explicit Resume, keyboard, and ar/he; record it in `specs/20260809-103559-pwa-audio-offline/evidence/preimplementation-analysis.md` without labelling native/public/listening proof PASS. [SC-001–SC-005]
- [ ] T029 Obtain Android/Capacitor, iOS/WKWebView, and Desktop/Tauri owner compatibility receipts in `specs/20260809-103559-pwa-audio-offline/evidence/preimplementation-analysis.md` for unchanged PWA-boundary behavior; otherwise leave each UNVERIFIED. [FR-014, SC-007]
- [ ] T030 Review `git diff --check`, scoped diff, `git status --short`, manifest hashes, exact cache-key rollback instructions, and the human-owned `AUDIO_FIT` matrix for headphones/phone/desktop plus startle/fatigue/masking/seam/associations/cultural neutrality; without owner sign-off keep `AUDIO_FIT=UNVERIFIED`. [FR-003, FR-005, FR-013–FR-016, SC-009]

## Dependencies and independent increments

`T001–T007 → T008–T010 → T011–T016 (US1) → T017–T020 (US2) → T021–T023 (US3) → T024–T030`.

US1 delivers selected verified offline availability; US2 delivers interruption safety independently on existing online playback; US3 delivers honest durable cues independently of cache work. T002–T007 may run in parallel; all later work shares their contract and must remain sequential where it edits the same owner.

## Coverage assertion

All FR-001–FR-014 and SC-001–SC-007 map to one or more tasks in `checklists/requirements.md`. There are no unassigned functional or measurable requirements.
