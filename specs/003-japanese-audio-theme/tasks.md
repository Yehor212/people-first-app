# Tasks: Calm Music Collection And Soft Theme Change

**Input**: Design documents from `specs/003-japanese-audio-theme/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: Required by the feature specification and repository test-first policy.

**Organization**: Work is grouped by independently reviewable user story and executed sequentially in one Codex lane without subagents.

## Phase 1: Setup And Evidence Baseline

**Purpose**: Establish exact source, dependencies, rights boundary, and pre-change behavior.

- [x] T001 Install the locked project dependencies and verify the clean lane in `package-lock.json` and the worktree root
- [x] T002 Record the planning, test-first, skill-routing, platform, rollback, and no-mock-data preflight in `.preflight-token`
- [x] T003 Capture current icon-control, auth-audio, and theme-transition characterization from `src/components/navigation-v2/BackgroundMusicToggle.tsx`, `src/components/auth-screen/AuthScreen.tsx`, and `src/components/navigation-v2/ThemeToggleV2.tsx`
- [x] T004 Capture a bounded pre-change Android drawer theme video, logcat, and CDP-off frame baseline under `output/android-theme-audio-baseline/`

---

## Phase 2: Foundational Collection Contracts

**Purpose**: Define one authoritative music inventory and reject prohibited assets before runtime changes.

- [x] T005 Write failing ten-master inventory and prohibited-hash tests in `scripts/__tests__/check-app-audio-assets.test.ts` and `src/lib/__tests__/appAudioAssets.test.ts`
- [x] T006 Run the focused audio tests and record the expected RED result caused by the absent nine-master collection
- [x] T007 Add data-driven original music composition specifications to `scripts/generate-non-hyperfocus-audio.cjs`
- [x] T008 Generate nine new loop-safe masters under `public/sounds/music/` and mirrored deployment files under `docs/sounds/music/`
- [x] T009 Extend `scripts/check-app-audio-assets.cjs` to validate exact collection inventory, deterministic rebuild, decode, loop, signal, path, and provenance contracts
- [x] T010 Update `docs/audio/non-hyperfocus-generated-audio-provenance.json`, `docs/audio/non-hyperfocus-sound-effects-policy.md`, and `docs/audio/zenflow-evening-collection-review.json` with exact pending-review hashes and rights boundaries
- [x] T011 Run the focused audio tests and `npm run check:app-audio -- --write-report` GREEN; stop if any generated master or provenance row fails

**Checkpoint**: Exactly ten technically valid first-party masters exist, while human audio quality remains pending.

---

## Phase 3: User Story 1 - Start Calm Music From Entry Or Navigation (Priority: P1) MVP

**Goal**: One first-run-silent player and one icon-only controller span account entry and authenticated navigation.

**Independent Test**: Enable music on entry, complete the account gate, open navigation, and observe one uninterrupted owner and identical icon state.

### Tests For User Story 1

- [x] T012 [US1] Write failing catalog, cursor normalization, and next-track tests in `src/lib/__tests__/appAudioAssets.test.ts` and `src/lib/__tests__/appBackgroundMusicPreference.test.ts`
- [x] T013 [US1] Write failing single-player advancement, bounded recovery, lifecycle, autoplay, and ownership tests in `src/hooks/__tests__/useAppBackgroundMusic.test.tsx`
- [x] T014 [US1] Write failing global provider and auth-to-navigation continuity tests in `src/components/navigation-v2/__tests__/AppBackgroundMusicProvider.test.tsx` and `src/components/navigation-v2/__tests__/AppBackgroundMusicOwnership.static.test.ts`
- [x] T015 [US1] Write failing icon-only accessibility and layout tests in `src/components/navigation-v2/__tests__/BackgroundMusicToggle.test.tsx` and `src/components/auth-screen/__tests__/AuthScreen.providers.test.tsx`
- [x] T016 [US1] Write failing intent-cache current/next integrity tests in `src/lib/__tests__/runtimeAudioCache.test.ts`
- [x] T017 [US1] Run all US1 focused tests and record RED results tied only to the missing collection/global-control behavior

### Implementation For User Story 1

- [x] T018 [US1] Implement the immutable ten-master catalog and sequence helpers in `src/lib/appAudioAssets.ts`
- [x] T019 [US1] Extend device-local preference and cursor convergence in `src/lib/appBackgroundMusicPreference.ts` and `src/lib/storageKeys.ts`
- [x] T020 [US1] Extend intent-bound current/next integrity caching in `src/lib/runtimeAudioCache.ts` and preserve bounded service-worker behavior in `src/sw.ts`
- [x] T021 [US1] Implement sequential one-element playback, boundary fade, bounded media recovery, truthful state, lifecycle, and Media Session updates in `src/hooks/useAppBackgroundMusic.ts`
- [x] T022 [US1] Convert `src/components/navigation-v2/AppBackgroundMusicProvider.tsx` to the collection source while retaining one hidden media element
- [x] T023 [US1] Mount the provider above the account gate in `src/App.tsx` and remove the nested provider wrapper from `src/components/navigation-v2/NavV2Orchestrator.tsx`
- [x] T024 [US1] Convert `src/components/navigation-v2/BackgroundMusicToggle.tsx` into one icon-only control with auth, expanded, collapsed, and drawer presentations
- [x] T025 [US1] Replace the separate labelled auth ambience control with the shared music icon in `src/components/auth-screen/AuthScreen.tsx` without changing authentication behavior
- [x] T026 [US1] Run all US1 focused tests GREEN and run the existing audio ownership, lifecycle, comfort, auth, accessibility, and no-XP audio regression suites

**Checkpoint**: US1 works independently with one owner, first-run silence, icon-only UI, and no auth behavior change.

---

## Phase 4: User Story 2 - Experience A Soft Theme Change (Priority: P1)

**Goal**: All light/dark requests use one short opacity-only veil while preserving atomic contrast and Android drawer stability.

**Independent Test**: Repeat both theme directions from entry, drawer, and Settings under normal and reduced motion with latest-request-wins behavior.

### Tests For User Story 2

- [x] T027 [US2] Write failing coordinator cleanup, reduced-motion, persistence-failure, and rapid-request tests in `src/lib/__tests__/themeTransition.test.ts`
- [x] T028 [US2] Update failing entry, navigation, and store integration expectations in `src/components/__tests__/EntryThemeSwitcher.test.tsx`, `src/components/navigation-v2/__tests__/ThemeToggleV2.test.tsx`, and `src/stores/__tests__/themeStore.test.ts`
- [x] T029 [US2] Add a failing static CSS contract for one opacity-only veil and forbidden blur/snapshot/per-element interpolation in `src/styles/__tests__/themeTransition.test.ts`
- [x] T030 [US2] Run all US2 focused tests and record the expected RED result caused by the missing coordinator and veil

### Implementation For User Story 2

- [x] T031 [US2] Implement latest-request-wins theme preparation, commit, animation start, and cleanup in `src/lib/themeTransition.ts`
- [x] T032 [US2] Route persisted theme commits and system/storage convergence through the safe transition boundary in `src/stores/themeStore.ts`
- [x] T033 [US2] Route account-entry and navigation theme controls through the coordinator in `src/components/EntryThemeSwitcher.tsx` and `src/components/navigation-v2/ThemeToggleV2.tsx`
- [x] T034 [US2] Add the pointer-transparent opacity-only veil and reduced-motion/Android-drawer rules in `src/index.css`
- [x] T035 [US2] Run all US2 focused tests GREEN and verify no stale attributes, timers, focus loss, or contrast regression
- [ ] T036 [US2] Capture ten Android theme round trips in one uncut emulator-window video and a separate CDP-off Perfetto/gfxinfo run; current result is `FAIL` because tile warnings and rare long frames remain

**Checkpoint**: US2 is visually and measurably softer without restoring the rejected Android snapshot path.

---

## Phase 5: User Story 3 - Receive A Traceable Internal Android Build (Priority: P2)

**Goal**: Prepare the exact merged change as a uniquely versioned, signed Google Play Internal testing release.

**Independent Test**: Trace source commit to signed AAB and Play Internal testing state while Production remains untouched.

### Tests And Gates For User Story 3

- [x] T037 [US3] Update release notes and audio/theme description without unsupported claims in `CHANGELOG.md` and `docs/release/google-play/GOOGLE_PLAY_LOCALIZED_LISTING_PACKET.json`
- [ ] T038 [US3] Run typecheck, lint, focused/full Vitest, audio, i18n, visual, canonical-orb, production-data-integrity, size, build, Android, iOS, and security gates
- [x] T039 [US3] Install the exact final APK through Android MCP, compare source and installed hashes, and verify music output state, icon state, lifecycle, auth continuity, and crash-free operation
- [ ] T040 [US3] Present the ten exact audio files and hashes for owner listening approval; keep store release STOP until every master is approved
- [ ] T041 [US3] Commit the reviewed batch, push the same-named branch, obtain a green exact-tip handoff, open a PR, and pass required GitHub checks
- [ ] T042 [US3] Merge the PR into `main`, verify local/remote main equality, and remove the temporary branch/worktree only after recovery is proven
- [ ] T043 [US3] Inspect Play Console for the current maximum version code and authorized upload certificate, then make the minimal version increment in a release follow-up if required
- [ ] T044 [US3] Build the signed release AAB from exact merged `main`, verify its hash, signer, manifest, package, version, forward schema, and no-mock/no-sample artifact scans
- [ ] T045 [US3] Upload the exact AAB only to Google Play Internal testing and stop immediately before rollout for action-time owner confirmation
- [ ] T046 [US3] After confirmation, roll out only to Internal testing and verify the resulting version, track, processing state, and tester availability

**Checkpoint**: The artifact is present only in Internal testing and every identity is recorded without secrets.

---

## Phase 6: Polish And Cross-Cutting Verification

- [x] T047 Run the visual-integrity critic against the exact theme video/screenshots and keep Technical, Visual Runtime, Artistic/Craft, Motion, Model, and Plan statuses separate
- [x] T048 Reconcile Web/PWA, Android, iOS, Desktop, Store, Accessibility, Performance, Security/Privacy, Testing, and Operations evidence in `specs/003-japanese-audio-theme/quickstart.md`
- [x] T049 Run Spec Kit convergence against `spec.md`, `plan.md`, and `tasks.md`; append and complete any remaining traceable gaps
- [x] T050 Review `git diff`, `git status`, generated asset hashes, bundle contents, secret patterns, mock reachability, and unrelated-file scope before final reporting

---

## Phase 7: Native Telegram Return And Fade-Through Remediation

- [x] T051 Reproduce the exact Telegram Android flow through Android MCP and CDP, confirm the requested `redirect_to` uses `com.zenflow.app://login-callback?zenflowAuthAttempt=...`, confirm Android resolves it to `MainActivity`, and capture the failed GitHub Pages terminal destination while the native app remains signed out
- [x] T052 Write the approved root-cause design and implementation plan in `docs/superpowers/specs/2026-09-03-android-native-auth-motion-release-design.md` and `docs/superpowers/plans/2026-09-03-android-native-auth-motion-release.md`
- [x] T053 Write and run RED tests for the attempt-bound hosted native OAuth allow-list and merge-preserving patch/readback behavior
- [x] T054 Implement and run GREEN for the narrow `com.zenflow.app://login-callback?zenflowAuthAttempt=*` local/hosted contract, readiness checker, docs, and production apply script
- [x] T055 Write and run RED/GREEN tests for a main-only least-privilege Supabase native-auth redirect workflow with an exact confirmation phrase and no secret or redirect inventory output
- [x] T056 Write and run RED tests for two-phase theme enter, midpoint commit, release, reduced motion, fallback timeout, persistence failure, rapid-retap latest-request wins, and cleanup
- [x] T057 Implement the one-veil opacity-only fade-through in `src/lib/themeTransition.ts`, `src/stores/themeStore.ts`, and `src/index.css`, then run focused GREEN and visual/canonical-orb guards
- [ ] T058 Build and install a new exact APK, compare local and installed hashes, and repeat all five V2 routes, nested Settings panels, account entry, music icon, scroll/reflow, accessibility, lifecycle, Back, safe-area, and theme checks through Android MCP
- [ ] T059 Capture ten theme round trips in one uninterrupted emulator-window video plus at least three separate CDP-off Perfetto/`gfxinfo` runs; keep Motion FAIL for any >103 ms presentation gap, tile/context/ANR/crash signal, missing content, or APK mismatch
- [ ] T060 After merged `main`, dispatch the exact Supabase native-auth redirect workflow and verify its post-write hosted readback before repeating Telegram warm/cold callbacks and Google native login on the exact APK
- [ ] T061 Re-run ten-master QC, one-player/comfort/cache/lifecycle tests, real emulator audio output, no-mock source/bundle scans, and present the exact ten hashes for owner listening decisions
- [ ] T062 Run full typecheck, lint, Vitest, i18n/RTL, visual, canonical-orb, PDI, web/PWA, Android, iOS, Desktop, security, completion, and release gates from the final tree
- [ ] T063 Resolve the missing commit-protocol instruction, then commit the scoped batch, push the same-named branch, obtain exact-tip handoff, merge the PR to `main`, and prove local/remote main equality before removing the lane
- [ ] T064 Verify Play maximum versionCode, upload certificate/key, Google upload and Play App Signing OAuth clients, exact signed AAB contents, and upload only to Internal testing after all owner and release gates pass
- [x] T065 Write and run RED tests for the Android native bridge, opaque color conversion, cover/commit/readiness/reveal ordering, latest-request cancellation, reduced-motion bypass, and bridge-failure fallback
- [x] T066 Write and run RED/GREEN for the native compositor experiment, then reject and remove the local `NativeThemeTransitionPlugin`, bridge, registration, and tests after exact-APK runtime evidence failed the performance gate
- [x] T067 Build and install native candidates and reject the native path after Settings Perfetto/gfxinfo, continuous video, lifecycle, accessibility, system-bar, and crash evidence failed to improve the CSS-only path without visual regression; child-decor candidates remain `FAIL`
- [ ] T068 Inspect Play Console developer identity, `com.zenflow.app` package registration, Play App Signing key registration, draft registrations, and any warning on the Home/Android developer verification pages
- [ ] T069 Inventory exact SHA-256 fingerprints by role: local debug, upload, Play App Signing, and any proven off-Play distribution key; register only keys that actually sign distributed artifacts
- [ ] T070 If manual ownership proof is required, obtain the Console-generated snippet, build a dedicated private verification APK with the matching existing key, verify its contents/signature, upload it only to Android developer verification, and prove the snippet is absent from git and release artifacts
- [ ] T071 Record the final package/key registration states and deadline receipt without secrets, then keep Android developer verification distinct from the app update, OAuth, and Internal testing release gates
- [ ] T072 After registration and all product gates pass, upload the exact signed AAB to Google Play Internal testing and stop before rollout unless the owner gives action-time confirmation for that exact artifact and track
- [x] T073 Test and reject the non-touchable, non-focusable separate Android window surface after the first exact-APK trace regressed gaps/jank and retained tile pressure; remove its production source and tests
- [ ] T074 After motion passes, run the complete current-tree verification, resolve the commit-protocol gate, commit the entire scoped task batch, push the existing lane, merge through the required exact-tip PR into `main`, and verify remote/local main equality
- [x] T075 Correct the Perfetto report through RED/GREEN so actual FrameTimeline rows over 103 ms and presentation timestamp gaps are distinct named fields
- [x] T076 Prove the Settings midpoint starts about 124 redundant button/theme-choice palette transitions, then suppress only button color/border/shadow transitions while retaining transform/opacity press feedback, ambient motion, and canonical pixels
- [x] T077 Build/install the CSS button-suppression source as exact APK `c06f6b23...`, verify source/installed equality, continuous visual proof, and three CDP-off Perfetto/gfxinfo runs with zero frames over 103 ms; keep human Motion/Artistic approval `UNVERIFIED`

**Checkpoint**: Telegram returns to the installed app, the theme transition passes both perceptual and frame evidence, and release evidence remains separated from debug/static proof.

---

## Dependencies And Execution Order

- Phase 1 establishes the safe lane and before evidence.
- Phase 2 blocks runtime work because the collection and rights contract must exist first.
- US1 depends on Phase 2 and delivers the music experience independently.
- US2 depends only on Phase 1 but is executed after US1 to keep one active implementation focus and simplify Android attribution.
- US3 depends on US1, US2, owner audio approval, all required checks, PR merge, signing identity, and Play access.
- Phase 6 depends on every implemented story and must complete before any final PASS claim.

## Parallel Opportunities

No subagent or multi-writer parallelism is authorized. Read-only or command-level independent checks may run concurrently only when they cannot mutate shared build or evidence outputs.

## Implementation Strategy

1. Establish the ten-master collection and technical audio QC.
2. Deliver the shared icon-only player and verify account-entry continuity.
3. Deliver the isolated theme transition and compare Android before/after evidence.
4. Run full cross-platform and artifact gates.
5. Obtain human audio approval before store packaging.
6. Merge through the required PR and prepare only the authorized Internal testing release.

## Stop Conditions

- Any unknown-provenance, disputed, reference-derived, or mismatched audio enters the candidate set.
- Human approval is absent for any exact master hash.
- Android shows a blank/partial/stale frame, tile-memory/context-loss warning, ANR/crash, or a theme action-window gap above 103 ms.
- A required test, build, integrity, signing, or CI gate fails.
- The existing Play upload identity or target track cannot be verified.
- Completion would require a new dependency, broader track, production rollout, data migration, auth redesign, visual downgrade, mock runtime data, or weakened guard.
