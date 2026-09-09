# Android interaction budget Implementation Plan

## Navigation feedback handoff — 2026-09-07 UTC, 16:24

The requested continuation now includes a concrete Android navigation fix: `useNavigationV2.ts` clears outgoing feedback in the destination commit, preserving destination Suspense loading, retained drawer ordering/cancellation and non-Android behavior. The old 320 ms cosmetic hold no longer keeps the Android indicator and its blur surface after handoff. Six new hook cases and stronger destination-loading assertions pass in the actual three source suites: 105 tests. Strict lint, benchmark sync/Gradle and scoped source security checks pass; Snyk reports one run and no findings.

The final built and independently observed installed APK is `50c3f6bfb2a66430aab4b8268d0db849060692f467cbbdf8d5a98e08e30f0aed`, package 2.1.2 / 39. All 21 selected inputs match across packaging. On Arabic/RTL Huge text with reduced motion, 15 native route selections across three passes reach a settled route/pending/fallback DOM state in 38.3–95.8 ms. These observations do not include Orb visual readiness or final presentation. With normal motion, five native selections still take 168.6–211.2 ms; drawer removal alone takes 111.4–139.4 ms. The 103 ms normal-motion gate therefore remains FAIL.

Ordinary Gboard still clips Back/save controls on the final APK. Missing Orb/foreground after repeated route changes also reproduces on the independently reinstalled old `9ac94b0e…` APK, despite ready DOM/canvas state. This rules out the navigation patch as a necessary condition for that defect; it does not establish full visual parity or its cause. The temporary scroll-layer and Vulkan-backend diagnostics were rejected, with original settings restored. No renderer quality reduction or native workaround was adopted.

All seven compared public preferences match their starting values. The app ends on Orb selection; original keyboard settings and Skia OpenGL are restored, and the owned CDP forward/temporary observer are removed. Unrelated initial dirty work is preserved. Current evidence and the final CI/browser results are linked from `output/android-103ms/software-convergence-20260907/REVIEW.md`. T009/T015/T018/T019 remain open for the actual visual/frame, normal-motion/presentation and physical-phone requirements; a new report does not close them. All older packets below retain their dated scope.

## Daylight draw-dispatch applied — 2026-09-07 UTC

The owner explicitly approved both proposed paths. The reviewed `useAndroidDayLargeEffects.ts` patch is applied; its component test also includes a typed-lint correction to the resize callback. The generated motion inventory was refreshed after Android synchronization with unchanged discovery counts and 100% coverage.

VERIFIED: the original duplicate-startup regression changed from RED to GREEN; 111 focused checks, 10,240 full-suite tests and seven browser navigation cases passed. The full suite retains 23 skipped and seven pre-existing todo cases. Chrome performance smoke completed 14 route/profile checks with no console or network errors. The exact built and independently observed installed APK is `9ac94b0edec4a221b9ee916792694f0615f9442e7130061af64bec0868f7c015`. Production code and its test passed scoped Snyk with no findings.

Two native Light returns now submit one full draw set per browser timeline tick, compared with three on the prior `4e496f6e…` APK. Four fixed daylight phases (0, 1,000, 5,000 and 12,500 ms) have identical PNG hashes and zero different RGBA pixels at 1082 × 2202. This proves scoped buffer parity and dispatch coalescing, not complete transition or presentation acceptance.

Three separate 90-second frame runs retain 10/2/2 display gaps above 103 ms, with maxima 480.116125/164.366167/133.031001 ms. Host CI ran concurrently; direct baseline performance attribution is UNVERIFIED. The independent native video completed eight actions and 13 checkpoints. Its first day-menu checkpoint lacks the miniature orb; later night/restored-day frames and a fresh warmed opening show it. Causality and reproducibility remain UNVERIFIED, and broad visual parity is not accepted. The earlier IME failure remains unresolved.

Observed public preferences were restored exactly. No physical phone is connected. T009/T015/T018/T019 remain open: 15/19 main IDs checked. Evidence is in `output/android-103ms/day-render-applied-20260907/`, especially `dispatch-comparison.json`, `pixel-comparison.json`, `frame-summary.json`, `visual-review.json` and `ci-preflight-after-inventory.log`. Earlier dated packets below remain historical evidence; the proposal is no longer awaiting permission.

## Frame attribution and IME synchronization — 2026-09-07 UTC

Three saved current-APK traces associate one long display gap per run with Light theme activation. During those draw calls, RenderThread sleeps for 82.38–96.91 ms; Chrome_InProcGp wakes its longer sleeps and is CPU-running for 86.64–115.69 ms. This identifies a rendering dependency, not the underlying Chromium operation or hardware GPU duration. Other gaps occur outside immediate input windows. Clock alignment remains approximate.

A temporary native postVisualStateCallback viewport experiment on the unchanged `4e496f6e…` APK still leaves the Back control blank after ordinary IME resize. It is rejected. Two initial captures are excluded because the handwriting tutorial intercepted the first tap. The three subsequent native captures were inspected; the aligned candidate and restored CSS have identical geometry. All 57 pre-existing dirty files remained unchanged during diagnosis. Public preferences and keyboard settings were restored, and the test package plus ten hash-verified device captures were removed.

No production fix or acceptance checkmark follows. T009/T015/T018/T019 remain open: 15/19 main IDs checked. Physical-phone and full visual/motion acceptance remain UNVERIFIED. Evidence: `output/android-103ms/frame-attribution-20260907/analysis.json` and `output/android-103ms/ime-frame-sync-20260907/receipt.json`.

## Current APK frame and video verification — 2026-09-07 UTC, 03:19

The same installed `4e496f6e1fb9c9ed748e230010e8008a0a6867c39f1aa2377c07301fe9027b2d` APK now has three separate warmed 90-second emulator traces in English/LTR, Huge text (1.5), normal motion and 60 Hz. They link 5,309 / 5,346 / 5,309 frames with no missing display tokens or reported trace errors/data loss. All three exceed the display-gap budget: 1 / 2 / 3 gaps above 103 ms, maxima 116.865834 / 109.980583 / 159.195583 ms. Each native scenario completes eight actions; this does not establish interaction latency. A separate 54.496867-second native video fully decodes to 2,268 frames; six inspected settled checkpoints show Orb/menu controls in both themes. Full transition parity and phone acceptance remain UNVERIFIED. Four independent installation pairs validate; all 18 build inputs match. Arabic/RTL, Huge, reduced motion and auto theme were restored; owned trace copies/forwards were removed after verification. No production code changed. T009/T015/T018/T019 remain open, 15/19 checked. Evidence: `output/android-103ms/current-apk-frames-20260907/receipt.json` and `summary.json`.

## Theme phase diagnosis — 2026-09-07 UTC, 02:55

The unchanged installed APK `4e496f6e1fb9c9ed748e230010e8008a0a6867c39f1aa2377c07301fe9027b2d` was exercised with 24 native theme activations under Arabic/RTL Huge text. Fourteen minimally observed baseline activations take 118.6–297.0 ms from DOM activation to veil cleanup; all exceed 103 ms. These are event/phase measurements, not input-to-photon evidence. Separate trace and animation-state reads identify pending release startup and repeated native Back visibility/layout work, without proving the whole cause. Explicit release-clock startup still exceeds 103 ms in four of six attempts and was rejected. No production change follows. Public preferences were restored exactly, temporary observers and the owned forward removed, and all 18 build-input hashes verified unchanged. T009/T015/T018/T019 remain open; 15/19 main IDs are checked. IME visual failure and physical-phone/presentation acceptance remain unresolved. Evidence: `output/android-103ms/theme-phase-20260907/receipt.json` and `analysis.json` in that directory.

> For agentic workers: use executing-plans inline, test-driven-development for behavior changes, then independent review and verification-before-completion. Owner approved autonomous execution on 2026-09-05.
**Goal:** Remove the reproduced menu delay and pursue the approved 103 ms Android interaction target with exact evidence.
**Architecture:** Preserve DrawerV2 retained-surface ownership and useNavigationV2 request identities; no second WebGL renderer.
**Tech Stack:** React 18/TypeScript/Capacitor 8, existing Vitest/Playwright/ADB.
**Spec:** specs/004-android-interaction-budget/spec.md.
**Global Constraints:** one locked lane at 939daa7e; no new production dependencies, data/auth/sync changes, visual downgrades or publication. Exact approved upper write set remains in the original audit report.

## Recorded progress — 2026-09-06

Plan name: **Android interaction budget** — Android interaction target of at most 103 ms. The [numbered task ledger](../../../specs/004-android-interaction-budget/tasks.md) records **15 of 19 main tasks completed within their documented scope**. This is a task count, not a percentage of runtime readiness or remaining effort.

Open: T009 (current-candidate repeated visual acceptance), T015 (complete current-tree verification), T018 (measured Android activation/readiness/presentation and remediation), T019 (physical-phone repetitions and full native matrix). T008 closes only its written browser scope. Historical checkmarks below retain their original artifact/date; they do not establish acceptance of a later candidate. The owner later requested same-branch commit/push; neither has occurred, and no release is authorized by these status marks.

### CI repair and current native evidence — 2026-09-07 UTC

- [x] Reproduce the structural ratchet failure and refresh the measured architecture count before the scoped DrawerV2 rendering extraction. Preserve exact moved JSX, handlers, classes and parent ownership. Rerun the same 99 characterization tests successfully; regenerate the unchanged motion inventory and pass its ten tests.
- [x] Complete uninterrupted full CI with exit 0, including 10,240 tests and the unchanged ratchet at three oversized components and score 9.2. Retain 23 skipped and seven existing unfinished tests, all 70 ratchet warnings, seven passing browser cases and exact scoped security receipts.
- [x] Build and install the extraction APK `4e496f6e...`, verify unchanged before/after source inputs and independently match installed bytes after installation and diagnostics. Inspect the native Arabic Huge/reduced drawer and its five minimum-size targets. Record five native route activations without treating their pending/loading observations as readiness or latency acceptance.
- [x] Retain automatic IME phase screenshots and metadata, reject invalid launcher captures and the failed harness, and distinguish temporary full-surface/CSS recovery from the failed automatic viewport-height prototype. No IME production workaround follows. Restore keyboard settings, remove test instrumentation/listeners/forwards and verify archived diagnostic-device files before cleanup.
- [ ] Resolve ordinary IME clipping and complete current-candidate repeated video/frame, 103 ms and physical-phone/human acceptance. T009/T015/T018/T019 stay open; main completion remains 15 of 19. Evidence: `output/android-103ms/drawer-structure-20260907/receipt.json` and `output/android-103ms/ime-surface-20260907/receipt.json`.

The dated sections below retain their historical source/APK scope.

### Ordinary IME diagnosis — 2026-09-07 UTC

- [x] Exercise ordinary Gboard on the exact installed APK through native controls with Arabic/RTL, Huge text and reduced motion. Record viewport shrink from 839 to 527 CSS px and settled native clipping as FAIL; retain the discrepancy with the complete WebView surface capture.
- [x] Record rejected hardware-layer, software-GPU, paint-containment and isolated offscreen-blur experiments. Keep global blur removal rejected for visible degradation and earlier redraw-confounded probes inconclusive. No production fix follows from these diagnostic steps.
- [x] Verify the diagnostic WebView archive/signature and test it only in a disposable read-only emulator. Record the Orb/WebGL failure as an inconclusive engine comparison; stop that instance and verify all seven original AVD file hashes unchanged.
- [x] Restore emulator-5560, original provider/keyboard settings, Arabic/RTL Huge/reduced state and exact application APK; remove the test-only instrumentation and temporary DOM/CDP changes. Retain receipts in `output/android-103ms/notify-completion-20260906/receipt.json`.
- [ ] Resolve the ordinary IME visual failure and the existing timing/technical failures, then complete T009/T015/T018/T019. Physical-phone and human acceptance remain UNVERIFIED. The main-task count remains 15 of 19.

### Current verification continuation — 2026-09-06

- [x] Apply the exact release-discovery command proposal after the owner resumes execution; preserve all 39 mandatory contract files and dependency declarations. Four regression controls, 374 workspace checks and 650 release checks pass.
- [x] Run full coverage: 862 files and 10,240 tests passed; one file/23 tests skipped and seven existing unfinished tests remain explicit. Production build, source/bundle integrity and seven browser cases pass. Inspect the normal/ar/he Huge drawer screenshots and close browser-scoped T008.
- [x] Preserve four exact negative-test fixture directories outside application output with verified hashes; rerun the unchanged audio guard successfully. RAG/completion/sync/schema checks pass. Record the remaining ratchet FAIL and independently verify that its four oversized components already exist at HEAD; do not weaken floors or refactor unrelated code.
- [x] Capture two more independent 90-second traces on the same installed APK. Each has 5,385 matched frames and no display gaps over 103 ms, maxima 66.763583/66.343750 ms. Preserve the earlier same-APK failing trace. Minimal native theme observation still takes 154–190.9 ms; reject the temporary blur experiment because it does not resolve the budget.
- [ ] Close T009/T015/T018/T019 only after their remaining visual, technical, timing and physical-phone conditions are met. Ordinary IME and human acceptance remain UNVERIFIED.

Current evidence: `output/android-103ms/finish-plan-20260906/receipt.json`. The dated snapshots below are historical.

### Continuation at 2026-09-06 17:42 UTC

- [x] Complete and decode the current `a68fa7b0...` full-route window recording: 210.016667 seconds, 10,564 frames, 24 native actions and 36 checkpoints. Independently read installed bytes before/after; app PID remained 28678. The scoped log has no matched fatal/ANR/context-loss/tile signatures. Back and theme frame boards retain visible loading/covering intervals; continuous human acceptance remains UNVERIFIED.
- [x] Analyze the separate current-candidate 90-second trace: 5,204 matched frames, 84 missed deadlines (1.614143%), 57.844108 presented fps and seven presentation gaps over 103 ms, maximum 258.622958 ms. Trace statistics contain no nonzero error/data-loss rows. Motion remains FAIL.
- [x] Inspect settled native drawer geometry and screenshots in English, Hebrew and Arabic with Huge text (1.5): all five destination controls fit and exceed 44 CSS px. Arabic/Hebrew use reduced motion. The immediate first Arabic probe caught the panel before it settled; this is not a latency pass. Restore Arabic, Huge, reduced motion, system theme and system font scale 1.0; remove the task-owned CDP forward.
- [x] Run the full suite: 10,237 passed, three failed, 23 skipped and seven existing unfinished tests. Refresh the stale generated motion inventory with its unchanged generator; retain all 1,148 owner IDs and pass the same ten inventory tests. The two package-discovery REDs remain pending the owner decision; the full suite was not rerun after this generated-only update.
- [ ] Complete T008/T009/T015/T018/T019. Ordinary soft-keyboard resize remains UNVERIFIED because focus opened Android handwriting onboarding; Back restored viewport height 839 CSS px. Immediate post-dismiss painting artifacts and later settled recovery are recorded. No mood was saved. Phone, human review and unchecked platform acceptance remain open.

Latest evidence: `output/android-103ms/resume-20260906/continuation-native-qa-receipt.json`. The 17:12 snapshot below is historical; the 14/19 main-task count is unchanged.

### Continuation at 2026-09-06 17:12 UTC

- [x] Repeat native-insets APK frame captures three times and collect a valid full-route window video: `insets-perf-01` through `03` contain no display gaps over 103 ms; `insets-visual-full-02` contains 210.015 seconds and 10,685 decoded frames. These dated diagnostic results do not establish input-to-final-presentation or physical-phone acceptance. A later control repeat of the same APK has three gaps above 103 ms.
- [x] Reproduce the self-disabled theme veil in the real browser, exclude it from the atomic-palette selector, then add a separate finite-phase RED (276 ms exceeds 103 ms). The Android-only CSS candidate uses 16/32 ms phases while preserving colors, opacity and easing. Build/install of `a68fa7b0...` is independently verified. Instrumented native activation-to-removal remains 370.9/223.7 ms, so the timing target is not met.
- [x] Fix exact technical-result/negation classification and Cyrillic word boundaries in the existing Stop checker. All packet validators remain byte-identical; 466 hook/neighbor tests pass. Scoped Snyk reports one run and zero findings. The release command proposal separately passes four isolated review tests; its live application still awaits the owner after the earlier rejection.
- [ ] Finish current-candidate native visual/frame and accessibility verification. Browser coverage has six passing cases and one navigation timeout, followed by three passing isolated repetitions; the original failure is retained. Fresh check:all, types and source/bundle PDI pass within their scope. Full current-tree success is not yet recorded.

Evidence snapshot: `output/android-103ms/resume-20260906/continuation-1712-receipt.json`. T008, T009, T015, T018 and T019 remain open; earlier blocked-build statements below are historical.

### Continuation at 2026-09-06 10:20 UTC

- [x] Build and independently verify installation of the SystemBars candidate (`78714477...`), then record a fresh 90-second diagnostic trace and continuous full-route window video. The trace has 19 missed deadlines across 5,345 frames and two display gaps above 103 ms; this is not motion acceptance.
- [x] Reproduce and fix the separate 189 px foreground scroll jump. Native backdrop replacement reset SafeArea-owned decor padding. A real Android integration test failed with padding top 136 becoming 0; the scoped MainActivity fix passes that test. On the new benchmark APK (`a5abd3d1...`), three actual Home/resume cycles preserve height 839 CSS px and scrollY 137.5238; control bounds before/after are identical. Web assets are byte-identical. Evidence: `output/android-103ms/resume-20260906/native-insets-receipt.json`.
- [ ] Complete repeated frame/video and accessibility acceptance on this newer native-insets candidate, then full-tree verification and physical-phone review. The five numbered tasks above remain open.

## Task 1 — Reduced-motion ownership (FR-001, FR-003)
Files: src/components/navigation-v2/DrawerV2.tsx; its __tests__/DrawerV2.test.tsx.
- [x] Add system/in-app reduced-motion tests: render open, activate focus, rerender closed without transitionend, assert drawer absent, body overflow restored and exit callback once. Reopen and advance stale timers; assert new dialog remains.
- [x] Run npm test -- --run src/components/navigation-v2/__tests__/DrawerV2.test.tsx --maxWorkers=2; expected RED: retained drawer remains mounted on close.
- [x] Implement explicit no-motion exit, including reduced-motion changes during closing. Preserve normal transitionend ownership and ignore child/non-transform events; handle cancellation without removing a reopened drawer.
- [x] Rerun the same tests and existing useNavigationV2/NavV2Orchestrator suites.
Core assertion: expect(screen.queryByTestId("drawer-v2")).not.toBeInTheDocument(); expect(document.body.style.overflow).toBe("clip").

## Task 2 — Measured ordinary Android interaction (FR-002–FR-005)
Files: useNavigationV2.ts and its tests; DrawerV2.tsx; src/index.css Android drawer selectors; e2e/nav-v2-interaction-latency.spec.ts. Orchestrator/loaders/status only if reproduction requires them.
- [x] Implement the production-browser normal/reduced journey and record DOM/rAF diagnostics; retain the three scenario tests and two ar/he large-text checks from 2026-09-05. These observations do not measure actual device presentation; see specs/004-android-interaction-budget/convergence.md.
- [ ] Complete presentation-based timing evidence and confirm the 103 ms limit for Android finite menu/control interactions. DOM/rAF diagnostics and configured CSS durations alone do not close this requirement.
- [x] Capture RED on the unchanged 300 ms panel and route waits. Preserve the existing feedback and post-unmount compositor boundaries until timing shows which delay is redundant.
- [x] Scope timing to Android navigation; remove entrance staggering and redundant waits only with no-loss proof. Keep true loading/error and no hidden heavy-screen mount.
- [x] Preserve the three independent 90-second Perfetto runs and continuous drawer/full-route window videos for the earlier APK. All three frame runs reproduce motion failures; see output/android-103ms/evidence-packet-20260905/android-visual-runtime-evidence.json.
- [ ] Repeat browser proof, five destinations, rapid/cancel/Back and RTL; run independent video and frame-deadline captures of a known APK.

## Task 3 — Real commit typecheck (FR-008)
Files: .husky/pre-commit; scripts/__tests__/pre-commit-typecheck.test.ts.
- [x] Exercise the actual hook in an isolated tiny referenced TS project with controlled surrounding command dependencies. An application type error must cause nonzero exit; corrected fixture must reach the remaining gate.
- [x] Observe RED for root tsc's zero-file success; replace only that command with npm run typecheck.
- [x] Rerun negative/positive controls and repo npm run typecheck. Do not weaken remaining hooks.

## Task 4 — Artifact evidence and safe capture (FR-006/FR-007)
Files: scripts/android-motion/evidence-lib.mjs, create-run-record.mjs, record-visual-journey.mjs, collect-environment.mjs and the paired evidence-lib.d.mts type contract; scripts/__tests__/android-motion-evidence.test.ts.
- [x] Add failing tests for distinct built/installed identities, missing independent reads and invalid timing observations using existing public evidence functions.
- [x] Require independently collected before/after identities; reject mismatch/absence, preserve old reports, logs, app data and unowned forwards in recording scripts.
- [x] Rerun evidence and journey-collector tests after the collector repair: 74 tests passed, with 102 neighboring checks. Receipt: output/android-103ms/journey-repair-20260906/receipt.json.
- [x] Verify and retain the real local full-route capture of 2026-09-05 with independent installed-before/after identities. Receipt and original video: output/android-103ms/isolated-emulator/visual-full-route-03/. This is the earlier unpatched APK, not the later native source candidate.
- [x] Repeat real capture on the native-insets candidate, which includes the SystemBars patch, with independent installed identities in `output/android-103ms/resume-20260906/insets-visual-full-02/`. Current theme-budget and physical-phone acceptance remain open.

## Task 5 — Consistent agent guidance (FR-007/FR-009)
Files: AGENTS.md, README.md, ARCHITECTURE.md, docs/ai/ANDROID_INTERACTION_BUDGET.md, TELEGRAM_GRADE_RUNTIME_CONTRACT.md, TASK_COMPLETION_PROTOCOL.md, SPEC_KIT_AGENT_POLICY.md; scripts/check-agent-context.mjs, check-task-completion-protocol.cjs, scripts/rag/corpus-manifest.json.
- [x] Link the Android evidence policy through existing routing; remove main-edit/orchestra contradictions, correct current command guidance; preserve historical evidence as historical.
- [x] Integrate an existing evidence checker rather than duplicate natural-language policing. Add narrowly scoped hook/test or package/CI script wiring only if needed by the approved design.
- [x] Run agent-context, best-practices, no-ai-templates, completion and relevant security checks; regenerate inventory/counts through existing generators only when stale.

## Task 6 — Verification/review/convergence (all FR/SC)
- [x] Retain the dated 2026-09-05 source/build/browser verification receipts and their original scope in specs/004-android-interaction-budget/convergence.md.
- [ ] Complete all current-tree gates. The 2026-09-07 full CI now passes uninterrupted, including 10,240 tests and the unchanged ratchet after the scoped drawer extraction. Build/browser/source-security checks pass. Ordinary Android IME remains FAIL; current-candidate repeated visual/timing and phone acceptance remain open. See the latest receipt rather than historical ratchet or failed-suite counts.
- [ ] Exact source/build/installed APK lineage; normal/reduced first/warm and repeated Android actions; separate video/Perfetto; physical phone and unchecked platform rows stay UNVERIFIED.
- [x] Independent read-only code review, inspect every finding and fix scoped defects; rerun affected checks.
- [x] Review final diff/status and write convergence/evidence ledger. No external release. No overall phone PASS without the approved physical-phone evidence.

## Completed continuation work within the same plan

- [x] Backport the disabled-inset SystemBars behavior to the installed 8.3.3 dependency and retain patches/@capacitor+android+8.3.3.patch; 11 native-source/replay tests and 43 related checks passed. The later build/install is verified in the continuation above. Original source evidence: output/android-103ms/system-bars-patch-20260906/receipt.json.
- [x] Repair journey admission, partial-failure output, pending-action reporting and log/evidence preservation; 74 collector/evidence tests passed. Evidence: output/android-103ms/journey-repair-20260906/receipt.json.
- [x] Reproduce release-contract archive discovery with two real-process RED cases, then apply the exact one-line proposal in the later owner-resumed continuation. All four isolation controls and the real release command pass. Evidence: output/android-103ms/finish-plan-20260906/; the earlier rejection is retained in release-discovery-20260906/receipt.json.
- [x] Add the Android Back fresh-readiness/stale-callback characterization; the OrbPage suite passed 45 tests, plus type/lint/canonical/PDI checks. Production Orb runtime was unchanged. Evidence: output/android-103ms/attribution-recheck-20260906/receipt.json.
- [x] Recheck retained frame coverage, phase-attribution limits and renderer scheduling; build and inspect the local original-video viewer at 500/1200 px. Evidence: output/android-103ms/attribution-recheck-20260906/viewer.html and receipt.json. This is not new motion or human acceptance.
- [ ] Finish remaining verification, then use the normal guarded path for any owner-authorized commit/push. The package proposal is now applied and verified; build/install/capture run normally. No publication has occurred.
