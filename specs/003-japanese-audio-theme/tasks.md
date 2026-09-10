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

The 2026-09-09 restoration scope below supersedes the former procedural music source decision only. Historical unchecked theme/release tasks remain unchanged and are not prerequisites to implementing the explicitly requested audio correction; they still block their corresponding release claims.

- Any unknown-provenance, disputed, reference-derived, or mismatched audio enters the candidate set.
- Human approval is absent for any exact master hash.
- Android shows a blank/partial/stale frame, tile-memory/context-loss warning, ANR/crash, or a theme action-window gap above 103 ms.
- A required test, build, integrity, signing, or CI gate fails.
- The existing Play upload identity or target track cannot be verified.
- Completion would require a new dependency, broader track, production rollout, data migration, auth redesign, visual downgrade, mock runtime data, or weakened guard.

## Phase 8: Owner-Selected Original Audio Restoration

- [x] T078 [US4] Identify the exact R7 MP3/WAV/FLAC originals and the eighteen `runtime-masters-v2` nature MP3s; compare independent hashes with `public/sounds/` and preserve originals
- [x] T079 [US4] Amend `spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/music-playback.md`, and `checklists/audio-restoration.md` for FR-047–FR-052 in the current locked lane
- [x] T080 [US4] Record RED for independent exact-R7 inventory/bytes/cache/cursor assertions in `src/lib/__tests__/r7BackgroundMusicRestoration.test.ts` and master-volume regression in `src/components/navigation-v2/__tests__/AppBackgroundMusicProvider.test.tsx`; `output/audio-restoration-20260909/r7-red.json` records 10 tests, 5 passed and 5 expected failures
- [x] T081 [US4] Replace only the ten former music copies in `public/sounds/` and `docs/sounds/` with unchanged R7 originals; update `src/lib/appAudioAssets.ts` and `src/lib/runtimeAudioCache.ts` with exact original IDs, sizes, hashes and retired-cache handling
- [x] T082 [US4] Remove hidden music attenuation in `src/components/navigation-v2/AppBackgroundMusicProvider.tsx` and retain one-player, fade, mute, zero, comfort, cursor and lifecycle behavior
- [x] T083 [US4] Add R7 provenance/signal and negative regression coverage to `scripts/check-app-audio-assets.cjs`, `scripts/__tests__/check-app-audio-assets.test.ts`, and `docs/audio/`; retain existing non-music and formal-review safeguards
- [x] T084 [US4] Restrict `scripts/generate-non-hyperfocus-audio.cjs` to current non-music outputs by a test-first write-set contract so old substitutes cannot return
- [x] T085 [US4] Verify all eighteen original nature variants through `src/lib/hyperfocusAudioCatalog.ts`, existing Hyperfocus tests and UI playback; fix only a separately reproduced defect without fabricated focus/history rows
- [x] T086 [US4] Rerun focused audio tests, decode/QC, separate typecheck/lint, relevant policy/PDI/security checks, production build and bundle integrity from the final tree
- [x] T087 [US4] Rebuild and install the exact Android APK data-preservingly; compare built/installed audio hashes and exercise real music/nature selection, mute, ownership and lifecycle in the authenticated emulator
- [x] T088 [US4] Record final platform/rights/runtime status and exact evidence in `quickstart.md`, then converge only FR-047–FR-052 and review the task diff without unrelated release or main-branch actions

Order: T078–T080 establish intent and regression; T081–T084 implement original restoration; T085 diagnoses nature playback; T086–T088 verify and hand off. No subagent or multi-writer parallelism; independent read-only command checks may overlap.

Restoration verification receipt (2026-09-09): 290/290 focused tests and 18/18 nature selections passed; exact installed APK `7d1ef181...` contains the unchanged originals. T086 remains open because both PDI diff and bundle checks exited 2 at the existing 64 MiB aggregate limit. `quickstart.md` records the full evidence and five-platform boundaries. Owner recognition of the correct music is confirmed, but comfortable volume remains unverified; system-volume test permission is pending.

## Phase 9: Convergence

Scope: FR-047–FR-052, US4/AC1–4, and seven restoration-amendment decisions only; historical theme/auth/release work is not reopened. Result: three partial findings (one HIGH, two MEDIUM), zero missing/contradicting/unrequested findings. The constitution is proposal-only and has no blocking authority. This section records remaining work, not permission for guard, platform, external, or release changes.

- [x] T089 [US4] HIGH — Resolve the original-album packaging versus PDI resource-budget incompatibility under a separately approved protected-surface design before closing T086, per plan: restoration verification sequence and SC-010 (partial). Historical evidence: `scripts/production-data-integrity/core.cjs:63` capped aggregate bundle bytes at 67,108,864 while `output/audio-restoration-20260909/pdi-diff.log` and `pdi-bundle.log` stopped at the 94,540,640-byte dist. Preserve exact FR-047 originals, full inventory/hash coverage and bounded scanning; do not raise limits, add exclusions/waivers, weaken assertions or re-encode music merely to get green output. The later explicit Phase 14 owner authorization, adversarial RED/GREEN and final source/diff/Web/Android bundle measurements close this scoped issue without changing other caps or validation.
- [ ] T090 [US4] MEDIUM — Complete original-music playback verification on Web, installed/offline PWA, iOS/WKWebView and packaged Desktop/Tauri before claiming those platforms ready, per plan: restoration platform matrix and FR-052 (partial). Link evidence to the exact R7 hashes and test deliberate start, mute/zero, ownership, interruption and previously admitted offline audio where applicable; keep unavailable environments UNVERIFIED and do not alter auth or user data to fabricate access. Current limits are recorded in `quickstart.md`.
- [ ] T091 [US4] MEDIUM — Complete the owner-authorized Android listening-level check and record comfortable output or a reproduced remaining defect, per plan: Android output verification and FR-052 (partial). The owner recognizes the music but reports it too quiet at app volume 100% and Android 5/15; approval to test Android 10/15 is pending. Preserve Mac volume, untouched original bytes and the app's mute/comfort limits. Obtain fresh evidence before attributing the remaining quietness to code; any resulting code correction requires its own test-first scope.

Owner update at 23:30 UTC supersedes the pending 10/15 action in T091: leave the emulator volume unchanged. Keep release audibility unverified until separately checked. The owner accepted the other nature families but rejected fire's perceived realism; a new fireplace candidate and the requested Planning/menu behavior need their next approved design/test-first scope. The original restoration remains technically verified; it does not certify the rejected fire's artistic quality or the requested next changes.

## Phase 10: Approved Focus-Only Planning

- [x] T092 [US5] Amend `spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/music-playback.md` and `checklists/focus-transport-fireplace.md` for owner approval 2026-09-09T23:45:01Z; analyze FR-053–FR-058 before implementation
- [x] T093 [US5] Add focus-only/no-write/unchanged-data/loading/RTL/completion tests in `src/pages/nav-v2/__tests__/PlanningFocusPage.test.tsx`; run RED with current Planning and retain current workspace/model/persistence test baseline
- [x] T094 [US5] Preserve inactive workspace as `src/pages/nav-v2/planning/PlanningWorkspace.tsx` and keep its existing `PlanningPage.test.tsx` assertions targeting that module; render only existing FocusTimer from `PlanningPage.tsx` with correct callbacks/safe areas, then GREEN and related data tests

## Phase 11: Music Transport And Fireplace

- [x] T095 [US6] Add bidirectional/wrap/off/paused/mute/other-owner/rapid/stale/persistence tests in `src/hooks/__tests__/useAppBackgroundMusic.test.tsx`, `src/lib/__tests__/appAudioAssets.test.ts`, `src/lib/__tests__/audioMediaSession.test.ts` and `src/components/navigation-v2/__tests__/BackgroundMusicToggle.test.tsx`; record RED
- [x] T096 [US6] Implement previous/next and cancellable intent-preserving transport in `src/hooks/useAppBackgroundMusic.ts`, catalog helper and `src/lib/audioMediaSession.ts`; rerun GREEN plus ownership/comfort/lifecycle/cache regressions
- [x] T097 [US6] Implement three icon controls in `src/components/navigation-v2/BackgroundMusicToggle.tsx` and eight `src/i18n/languages/` action labels; preserve auth, drawer, collapsed/wide, RTL and keyboard behavior with tests
- [x] T098 [US6] Produce and strictly assess isolated fireplace trial with exact receipt under `/Users/yehor/Projects/ZenFlow/private-evidence/fireplace-replacement-20260909/`; reject unsuitable AI output and source a licensed field candidate if needed
- [ ] T099 [US6] Obtain direct hash-bound pilot audition before changing three runtime fireplace files, `docs/audio/` manifests, `src/lib/hyperfocusAudioCatalog.ts` or `src/lib/runtimeAudioCache.ts`; maintain signal/loop/provenance and unaffected-file regressions
- [x] T100 [US6] Audit fresh/existing app gain and saved mute/zero in `src/lib/audioManager.ts` and provider tests without changing device volumes or originals; record physical-release listening as UNVERIFIED if unavailable

## Phase 12: Scoped Verification And Handoff

- [x] T101 Run separate typecheck/lint, focused/broader tests, i18n, policy/visual/data-integrity/security and production build for final source; retain the earlier evidence in `output/focus-transport-fireplace-20260909/` and the final Phase 14 runs in `output/fireplace-production-release-20260910/`
- [ ] T102 Verify Web/Android real focus and transport including light/dark, ar/he, reduced-motion, safe areas, wide/collapsed, boundaries and ownership; bind installed APK and source hashes in `quickstart.md`, keeping unavailable PWA/iOS/Desktop runtime explicit
- [x] T103 Review final diff and FR-053–FR-058 convergence in `specs/003-japanese-audio-theme/quickstart.md`; report any unapproved fireplace candidate and existing release STOP without invented completion

Dependencies: T092 → T093 → T094; T092 → T095 → T096 → T097; T098 → human gate T099. T100 is an independent settings audit. T101–T103 follow available implementation, and may report the real human/platform/release gates still open. Earliest independent increment is Focus-only Planning. Solo execution; independent read-only checks and the isolated trial may run alongside work, not additional writers.

Verification receipt, 2026-09-10: 645/645 expanded tests and 62/62 overlapping volume/R7 tests pass. APK `4fd7c513...` is installed with matching source/base.apk hashes; Android transport/Focus/RTL/lifecycle checks pass in the bounded scenarios recorded in `quickstart.md`. T098/T099 remain open because all private fire trials were rejected and a suitable original plus human audition is absent. T101 remains open at the unchanged PDI aggregate limit (T089); T102 is partial because authenticated Web wide/collapsed and other platform runtime checks are unavailable. T100 completes the source/settings audit, not physical-device listening. T103 records an honest scoped handoff, not whole-feature convergence or release readiness.

## Phase 13: Convergence

Scope: FR-053–FR-058, US5/AC1–3, US6/AC1–4, four implementation decisions and three constraints/verification/rollback boundaries in the approved amendment. Result: four partial findings (two HIGH, two MEDIUM), no missing/contradicting/unrequested finding in this scope. Constitution status is PROPOSED, unratified and nonblocking; no task is derived solely from it. Historical theme/auth/release implementation is not reopened. These tasks record evidence gaps and do not authorize credentials handling, guard changes, platform/account writes or publication.

- [ ] T104 [US6] HIGH — Obtain a suitable original indoor-fireplace recording through ordinary authorized download or owner attachment, then prepare distinct Soft/Deep/Intense activity pilots and obtain direct exact-hash owner audition before any runtime/catalog/cache/manifest replacement, per FR-057 and US6/AC4 (partial, F1; closes T098/T099). Evidence: `quickstart.md` and the private `fireplace-replacement-20260909/review/rejection-decision.md` reject the ACE-Step/BigSoundBank trials; Freesound 263864 original still requires completed login. Preserve all ten R7 and fifteen accepted nature hashes; never substitute its compressed preview or infer realism from classifier scores. After approval, use test-first integration, signal/loop checks and exact bundled/native identity proof.
- [x] T105 HIGH — Rerun and close T101 only after the separately authorized T089 packaging solution passes its protected-surface test-first review, per plan: amendment verification and unchanged integrity gates (partial, F2). Historical `pdi-diff.log` and `pdi-bundle.log` exit 2 at 67,108,864 aggregate bytes; that Web dist was 94,442,096 bytes. Do not duplicate T089 implementation, weaken limits/exclusions/assertions, re-encode originals, or treat this task as authorization to alter the guard. The separate Phase 14 owner authorization and final artifact-bound verification now close this check.
- [ ] T106 [US5] MEDIUM — Complete T102 on an authorized authenticated Web surface at wide/collapsed sizes with real keyboard/focus behavior, then record installed-PWA, iOS/WKWebView and packaged Desktop/Tauri coverage or retained UNVERIFIED boundaries, per FR-054, US5/AC3 and plan: platform/verification matrix (partial, F3). Verify the current Focus/transport in light/dark and ar/he, safe areas, interruption/ownership and media controls on applicable targets. Component classes, Android phone screenshots, native sync and Web build alone are not those runtime proofs; do not bypass unavailable sign-in or fabricate user records.
- [ ] T107 [US6] MEDIUM — Verify release audibility on an owner-authorized physical output path with fresh and retained app settings, per FR-058 and plan: unchanged-volume constraint (partial, F4; technical T100 audit is complete). Distinguish app gain from speaker/headphone/system output; preserve mute/zero/comfort, R7 bytes and current emulator/Mac volumes. Record the listening context and direct result. A newly reproduced code defect needs scoped test-first correction; unavailable listening stays UNVERIFIED and does not justify gain inflation or a release claim.

## Phase 14: Owner-Authorized Production Amendment — 2026-09-10

The owner message at `2026-09-10T01:50:52Z` approves the separately proposed 128 MiB checker budget, the three exact linked fire pilots, and Google Play Production for all users. It supersedes the old track/repeat-confirmation requirements and the admission pause in T099/T104 for these exact hashes only. It does not fabricate a formal audition or close physical-output/platform evidence gaps. Historical theme/auth investigations are not reopened by this bounded Focus/music release.

- [x] T108 [US6] Integrate only the admitted PagDev Soft/Deep/Intense hashes; preserve ten R7 and fifteen nature hashes; bind source/processing/rights claims, catalog, cache v5 and strict regression evidence to the exact files in `docs/audio/fireplace-pagdev-provenance.json` (134/134 final focused tests).
- [x] T109 Complete the authorized resource-budget implementation of T089 with observed RED then GREEN 142/142, exact 128 MiB/+1-byte, late-canary and late-hash-mutation tests; preserve all other limits and full content/inventory checks. Final-artifact bundle proof remains part of T111, not this source-test result.
- [x] T110 Fix the reproduced dev-only `smol-toml` EOF-comment hang through the existing permitted dependency range, retain both bounded regression tests, verify npm audit zero findings, and regenerate the stale source-owned motion inventory without changing discovery or validation rules.
- [ ] T111 Finish the final source full preflight, audio, integrity bundle/resource, security triage, diff and commit/handoff checks; keep every failure explicit and reconcile T101/T105 only from the final tree.
- [ ] T112 Build the final Android release with the existing signing identity; verify package/version, all 28 selected audio hashes, AAB/delivery-APK/base identity and the scoped data-preserving runtime journeys. Retain physical listening and unavailable native-platform limitations.
- [ ] T113 After the contract's source/CI/artifact preconditions pass, submit that exact AAB to `com.zenflow.app` Production for 100% of users under the current owner authorization. Verify uploaded code, review status and availability; do not call review/submission a completed public rollout.

Final local receipt, 2026-09-10: full `ci:preflight` and separate `check:all` exit 0, with 10,463 passing tests and zero failures. Web and Android bundle integrity pass with complete inventory/hash coverage and measured resource use; final debug APK `1524e5f6...` matches installed `base.apk` and all 28 masters. T086/T089/T101/T105 are now closed only for these local checks. T098 is closed by the documented field recording and three admitted pilots; the formal listening-context gap is not erased. The approved control-main sync is complete and its exact backup retained. T111 remains partial at commit/staged handoff and remote integration; T112/T113 remain open because the existing upload key and signed release are unavailable. Physical listening, final wide/keyboard/PWA/iOS/Desktop proof and the reminder-warning cause remain explicit in `quickstart.md`.
