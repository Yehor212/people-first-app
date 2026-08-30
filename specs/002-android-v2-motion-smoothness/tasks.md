# Tasks: Android V2 Motion Smoothness

**Input**: Design documents from `specs/002-android-v2-motion-smoothness/`

**Tests**: Test-first is mandatory. Each behavior-changing task begins with a failing focused test or a recorded characterization baseline.

**Execution**: SOLO and sequential. No task is delegated or marked parallel even when it touches a separate file.

## Phase 1: Setup and Immutable Baseline

**Purpose**: Establish exact provenance before diagnostic or production changes.

- [x] T001 Create and doctor the locked `codex/android-v2-motion-smoothness` lane at SHA `13ca51a80d23220574deba762851fe5a32372e46`.
- [x] T002 Run RAG, governance, test-first, skill-routing, Spec Kit, privacy, and implied-requirements preflight in `.preflight-token` and `specs/002-android-v2-motion-smoothness/`.
- [x] T003 Install `package-lock.json` dependencies with scripts disabled and run `scripts/check-production-data-integrity.cjs` in diff mode from the isolated lane.
- [ ] T004 Build and hash the untouched Android/web baseline in ignored `output/android-v2-motion/13ca51a/` using `package.json`, `dist/`, and `android/app/build/outputs/`.
- [ ] T005 Record API/GPU/WebView/refresh/density/theme/locale/thermal/power/animation-scale provenance with `scripts/android-motion/collect-environment.mjs`.
- [ ] T006 Capture five baseline visual checkpoints and separate initial JavaScript/Perfetto reproductions on API 36 using `e2e/android-v2-motion-visual.spec.ts` and `scripts/android-motion/`.

---

## Phase 2: Foundational Benchmark and Evidence Boundary

**Purpose**: Add diagnostics without changing production release behavior or visuals.

- [ ] T007 Write and run the failing benchmark-boundary test in `src/pages/nav-v2/__tests__/androidMotionBenchmarkContract.test.ts`.
- [ ] T008 Add release-like minified, debug-signed, profileable `benchmark` configuration in `android/app/build.gradle` and `android/app/src/benchmark/AndroidManifest.xml`.
- [ ] T009 Gate WebView debugging to the benchmark BuildConfig value in `android/app/src/main/java/com/zenflow/app/MainActivity.java` while keeping production release disabled.
- [ ] T010 Add schema-validated local evidence/environment/trace orchestration under `scripts/android-motion/` without new production dependencies.
- [ ] T011 Rerun `src/pages/nav-v2/__tests__/androidMotionBenchmarkContract.test.ts` green and assemble/install `android/app/build/outputs/apk/benchmark/` plus `android/app/build/outputs/apk/debug/` APKs.
- [ ] T012 Prove instrumentation-only visual equivalence against the exact baseline and record any unavailable device evidence as `UNVERIFIED` under ignored `output/android-v2-motion/`.

**Checkpoint**: Diagnostics are variant-scoped, release behavior is unchanged, and instrumentation has an explicit visual/provenance receipt.

---

## Phase 3: User Story 1 - Continuous V2 Motion (Priority: P1) 🎯 MVP

**Goal**: Locate and fix a reproducible launch/orb/navigation cause without changing canonical output.

**Independent Test**: Three-pass launch, 65-second idle, drag/refine/back, and five-route cycle with fixed state and before/after artifact identity.

### Tests and Characterization

- [ ] T013 [US1] Extend `e2e/orb-long-session-cadence.spec.ts` with Android-bound resource/ACK/loop evidence that fails on the reproduced symptom.
- [ ] T014 [US1] Extend `e2e/orb-user-flow-performance.spec.ts` with the deterministic five-route Android scenario and trace correlation IDs.
- [ ] T015 [US1] Capture separate JavaScript and CDP-off Perfetto passes and attribute each reproducible symptom in ignored `output/android-v2-motion/`.

### Minimal Implementation

- [ ] T016 [US1] If trace evidence proves a cause, implement only that fix in `src/components/state-of-mind/`, `src/pages/nav-v2/`, or Android-gated styles; otherwise record that no production patch is authorized in `output/android-v2-motion/**/ledger.json`.
- [ ] T017 [US1] Rerun the exact failing `e2e/orb-long-session-cadence.spec.ts` scenario and record candidate timing/resource/visual decisions under `output/android-v2-motion/`.
- [ ] T018 [US1] Mark every P1 symptom `FIXED`, `NOT_REPRODUCIBLE`, or `UNVERIFIED` with before/after hashes in `output/android-v2-motion/**/ledger.json`.

**Checkpoint**: No P1 symptom is silently omitted, and emulator improvement is not mislabeled as user-device proof.

---

## Phase 4: User Story 2 - Interactive and Lifecycle Stability (Priority: P2)

**Goal**: Prevent progressive slowdown, duplicate resources, phase jumps, and interaction regressions.

**Independent Test**: Habits/diary/planning/settings/drawer/modal/Back/IME plus five lifecycle cycles, rotation, and split-screen with stable resource counts and final-three-cycle memory.

### Tests and Characterization

- [ ] T019 [US2] Add deterministic feature/lifecycle resource assertions to `e2e/orb-long-session-cadence.spec.ts` and relevant V2 Android tests.
- [ ] T020 [US2] Capture JavaScript, Perfetto, and memory evidence for every named interaction/lifecycle symptom under `output/android-v2-motion/`.

### Minimal Implementation

- [ ] T021 [US2] If evidence proves lifecycle/listener/loop/worker duplication or phase discontinuity, fix it only in `src/components/state-of-mind/ValenceOrb.tsx`, `src/components/state-of-mind/orbWorker.ts`, or the exact owning `src/pages/nav-v2/` module; otherwise record no production change in `output/android-v2-motion/**/ledger.json`.
- [ ] T022 [US2] Repeat the exact five-cycle matrix and classify every P2 symptom in `output/android-v2-motion/**/ledger.json` without extrapolating from one route.

**Checkpoint**: One renderer/worker/loop, stable listener counts, no final-three-cycle monotonic memory growth, and correct Back/IME ownership where measurable.

---

## Phase 5: User Story 3 - Visual and Accessibility Parity (Priority: P3)

**Goal**: Demonstrate that the candidate preserves the frozen design in all required Android variants.

**Independent Test**: Five baseline and candidate phase captures for both themes, eight static locales, full `en/ar/he` motion, orientations/window modes, normal/reduced motion, and safe areas.

- [ ] T023 [US3] Extend `e2e/settings-final-audit.spec.ts` with the Android motion/locale/window checkpoint matrix and fixed pre-candidate noise calculations.
- [ ] T024 [US3] Add `e2e/android-v2-motion-visual.spec.ts` to generate phase metadata, screenshots, and side-by-side boards without using capture timing as a performance metric.
- [ ] T025 [US3] Run `e2e/android-v2-motion-visual.spec.ts` emulator checkpoints and inspect generated `output/android-v2-motion/**/visual/` frames with the SOLO `visual-integrity-critic` rubric.
- [ ] T026 [US3] Write both required physical-device visual/video outcomes or explicit `UNVERIFIED` rows to `output/android-v2-motion/**/ledger.json`.

---

## Phase 6: Verification and Closure

**Purpose**: Prove the scoped diff and preserve all evidence boundaries.

- [ ] T027 Run focused Vitest for `src/pages/nav-v2/__tests__/androidMotionBenchmarkContract.test.ts`, `src/components/state-of-mind/__tests__/canonicalOrbInvariant.test.ts`, and changed V2 motion tests.
- [ ] T028 Run the canonical, visual, and full checks defined in `package.json`: `check:canonical-orbs`, `check:visual`, and `check:all`.
- [ ] T029 Run `package.json` Android build/sync scripts, assemble `android/app/build/outputs/apk/benchmark/` and `android/app/build/outputs/apk/debug/`, and install the exact benchmark APK.
- [ ] T030 Scan changed first-party paths with Snyk, run `scripts/check-production-data-integrity.cjs` modes, and retain dependency-audit evidence under `output/android-v2-motion/`.
- [ ] T031 Run API 26 functional smoke or write the missing-emulator `UNVERIFIED` status to `output/android-v2-motion/**/ledger.json`.
- [ ] T032 Write three-warmup/five-repeat Android 12+ mid-range 60 Hz outcomes or an explicit missing-device `UNVERIFIED` status to `output/android-v2-motion/**/ledger.json`.
- [ ] T033 Write three-warmup/five-repeat Android 14+ 90/120 Hz outcomes or an explicit missing-device `UNVERIFIED` status to `output/android-v2-motion/**/ledger.json`.
- [ ] T034 Review worktree `git diff`/`git status`, `output/android-v2-motion/` hashes/privacy exclusions, and `android/app/` production debugging boundary.
- [ ] T035 Run convergence against `specs/002-android-v2-motion-smoothness/tasks.md` and record final SOLO visual-integrity statuses in `output/android-v2-motion/**/ledger.json`.

## Dependencies and Execution Order

- Phase 1 must complete before benchmark instrumentation so the clean baseline remains immutable.
- Phase 2 must complete before CDP/Perfetto attribution so diagnostic build provenance is known.
- P1 diagnosis and remediation precede P2 accumulated-session work; no broad optimization is allowed between them.
- P3 compares the retained candidate only after P1/P2 classification.
- Closure may contain `UNVERIFIED` physical rows, but those rows prevent an overall performance `PASS`.

## Implementation Strategy

1. Preserve exact-SHA artifacts and baseline captures.
2. Establish benchmark-only observability with a red/green boundary test.
3. Attribute one reproducible P1 root cause and apply one minimal candidate.
4. Expand to lifecycle accumulation only after the P1 candidate survives its exact retest.
5. Run visual/accessibility matrices separately from performance.
6. Stop without publication and report remaining evidence gaps precisely.
