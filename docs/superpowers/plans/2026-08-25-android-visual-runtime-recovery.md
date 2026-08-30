# Android V2 Visual Runtime Recovery Plan

> Execution mode: SOLO. Do not delegate, spawn subagents, publish, release, or modify non-Android product behavior.

## Goal

Restore stable day-theme rendering and smooth motion for the Android V2 Orb, mood controls, global drawer, loader, sheets, and adjacent routes without changing the accepted pixels, timing contract, assets, effects, or interaction model. Future agents must be unable to call the Android visual task complete from screenshots, DOM nodes, successful taps, a mismatched APK, or a video of the wrong desktop window.

## Fixed boundaries

- Worktree: `/Users/yehor/Projects/ZenFlow/worktrees/codex-android-v2-motion-smoothness-20260822`
- Branch: `codex/android-v2-motion-smoothness`
- Base HEAD: `13ca51a80d23220574deba762851fe5a32372e46`
- Another agent owns the existing staged paths. Their staged diff is preserved and must not be reset, reverted, unstaged, staged, or overwritten.
- Staged binary-diff SHA-256 at plan start: `2f67c0160bd520cbbe9558979e3e64a5c56ec6d02d19170d16ffd3eb818e7a91`
- Current benchmark APK used for the accepted exact-artifact run: `android/app/build/outputs/apk/benchmark/app-benchmark.apk`
- Exact APK SHA-256: `70ff4f8d7062ccb4953d03c678af18dec4211aef75f7ab9bb548fbe0c1a485b9`
- Android only. Shared React paths may be edited only when the Android runtime gate is explicit and Web/PWA/iOS/Desktop behavior remains unchanged.
- Forbidden performance shortcuts: reduced DPR, resolution, FPS, particle/star count, shader quality, blur, opacity, animation duration/easing, hidden layers, Canvas2D substitution, or ordinary reduced-motion substitution.

## Explicit requirements

- Act like a user: tap the real controls, drag the mood slider, use Next/Back, reopen the drawer repeatedly, navigate all V2 routes, switch day/night/day, and cover lifecycle transitions.
- Evaluate motion from continuous video, not screenshots.
- Recheck Orb and sidebar in day theme against the stable night-theme control.
- Keep a global checklist and mark a task complete only after fresh evidence exists.
- Add a durable hook describing how future agents must verify and accept Android visual fixes.
- Fix reproduced problems without visual downgrade.

## Implied requirements included

- Bind the source APK and installed APK SHA-256 immediately before and after every accepted run.
- Reject region recordings that can capture a covering desktop window; record the specific Android Emulator Quartz window or a physical-device screen.
- Use three separate passes so tools do not contaminate one another: motion video, WebView/JavaScript diagnostics, and CDP-off FrameTimeline/Perfetto.
- Treat UIAutomator/CDP visibility as interaction evidence, never as proof of raster completeness or smoothness.
- Test loader motion, stale overlays, Android Back, background/foreground, rotation, split-screen, safe areas, RTL, reduced motion, memory, thermal state, and high refresh.
- Keep emulator results separate from mandatory physical 60 Hz and 90/120 Hz performance gates.

## Platform matrix

| Target | Status | Required boundary |
|---|---|---|
| Android/Capacitor | In scope | Full implementation and runtime evidence |
| Web/Vite | N/A runtime | Shared paths must not change behavior |
| Installed PWA | N/A | No runtime work authorized |
| iOS/WKWebView | N/A | No runtime work authorized |
| Desktop/Tauri | N/A | No runtime work authorized |
| Google Play/release | STOP | No upload, release, commit, push, or handoff authorized |

## Evidence completed

- [x] Confirmed the locked Codex worktree, branch, HEAD, dirty boundary, and staged diff hash.
- [x] Read repository architecture and Android runtime, edge-to-edge, test-first, skill-routing, best-practices, no-template, change-governance, and visual-critic contracts.
- [x] Ran `doctor --allow-dirty` with `GO` while preserving the existing dirty worktree; the strict clean-start doctor remains inapplicable to this already active owned lane.
- [x] Ran Free RAG preflight for the exact Android Orb/sidebar/hook task.
- [x] Installed APK `70ff…` on API 36 emulator `5554` and proved local/installed SHA equality before and after the accepted user-flow run.
- [x] Completed a semantic 21-action route cycle covering Orb drag, refine/Back, drawer, Habits, Diary, Planning, Settings, night, and restored day.
- [x] Captured a valid specific-emulator-window control video and verified that it contains Android rather than a covering desktop app.
- [x] Rejected the first 125-second region recording because it captured Auto Chess instead of Android despite having a valid video track.
- [x] Rejected the second isolated API 36 AVD because Android itself displayed `Process system isn't responding` before app verification.
- [x] Proved the accepted exact-APK run is not a visual-runtime PASS: its logcat contains 58 Chromium `tile memory limits exceeded, some content may not draw` events.
- [x] Proved the shared primary emulator can be overwritten during testing: package path, PID, version, and `lastUpdateTime` changed after an external install; affected runs are rejected.
- [x] Added and ran the Android visual-runtime hook RED test; expected result was `9/9 failed` because the hook did not exist.

## Evidence paths retained

- Accepted semantic journey: `output/android-motion-debug/2026-08-25-global-plan/exact-70ff-run-02/journey.json`
  - SHA-256: `bf112fad82f9e7567bc68859eaff2ff876603c54eead49c2e15ef1c10705e992`
- Accepted partial specific-window motion video: `output/android-motion-debug/2026-08-25-global-plan/exact-70ff-run-02/orb-sidebar-user-flow.mov`
  - SHA-256: `f8b1191e70eaedf4f9ef5914727b270849943723d5a6885581c17292a69d34ca`
  - Limitation: 135 seconds; the semantic journey took longer, so this is not final full-route video proof.
- Accepted logcat: `output/android-motion-debug/2026-08-25-global-plan/exact-70ff-run-02/logcat.txt`
  - SHA-256: `cb7db19f4e4953cc5bbcc7beee5fb435c853a916321fbfc979720de3a2c6f082`
  - Blocking result: 58 tile-memory warnings.
- Rejected wrong-window video: `output/android-motion-debug/2026-08-25-global-plan/exact-70ff-run-01/orb-sidebar-user-flow.mov`
  - Reason: region capture contained Auto Chess, not Android.

## Global execution checklist

### 1. Fail-closed visual evidence hook

- [x] Define RED behavior for missing evidence, APK replacement, wrong-window capture, renderer failure, valid packet, and malformed hook input.
- [x] Implement `android-visual-runtime-gate.cjs` as `UserPromptSubmit` guidance plus `Stop` evidence enforcement.
- [x] Validate a fresh hash-bound evidence packet and recompute every referenced artifact SHA-256.
- [x] Register only `UserPromptSubmit` and `Stop`; do not add or restore subagent lifecycle hooks.
- [x] Wire the hook into `check:agent-context` and `enforcement:check` without changing package scripts owned by the staged branch.
- [x] Run focused hook tests GREEN plus negative controls and malformed-input pressure tests.
- [x] Record the limitation that tracked registration cannot prove the current Codex client loaded a newly added hook; a new client/runtime probe is required.

### 2. Deterministic reproduction

- [ ] Acquire an emulator/device execution window with no concurrent APK installer; verify package path, version, PID, and SHA before interaction.
- [ ] Add timestamps to every semantic journey action and checkpoint so logcat/FrameTimeline/video can be aligned exactly.
- [ ] Record one uninterrupted specific-window video long enough to include the complete route cycle.
- [ ] Run a separate CDP/JavaScript pass for animation loops, long tasks, layout/style, worker post/render/ACK, active listeners, canvases, and allocations.
- [ ] Run a separate CDP-off Perfetto pass with FrameTimeline, SurfaceFlinger, scheduler, GPU, GC, memory, and thermal data.
- [ ] Repeat the same day route in night theme as a control and restore day without process restart.

### 3. Reproduced root causes

- [x] APK replacement during a test invalidates the run.
- [x] Region video can capture the wrong desktop window while appearing structurally valid.
- [x] Chromium tile memory exhaustion occurs on the exact day-theme route cycle.
- [x] A stale/invisible Ambient Sound overlay can intercept the drawer/Mood tap until Android Back dismisses it.
- [ ] Attribute each tile-memory cluster to its exact route, transition, compositor surface, and DOM/WebGL layer.
- [ ] Reproduce or reject loader static-frame behavior on the benchmark-only loader probe.
- [ ] Reproduce or reject Orb control disappearance after drag/refine/back and after a long route cycle.
- [ ] Reproduce or reject drawer raster gaps independently of accessibility-node presence.
- [ ] Prove the number of live orb workers, renderer canvases, rAF loops, and listeners across five lifecycle cycles.

### 4. Root-cause fixes

- [ ] Write the smallest RED test or characterization for the stale Ambient Sound input interceptor.
- [ ] Fix overlay ownership/lifecycle so an invisible or off-route sheet cannot receive pointer input.
- [ ] Test the full-screen day WebGL compositor as a controlled hypothesis; do not remove or cheapen effects without before/after pixel equivalence and device improvement.
- [ ] Reduce only proven oversized intermediate surfaces, duplicate layer promotion, redundant style/state writes, worker queues, or lifecycle duplicates.
- [ ] After every candidate, rerun the same failing scenario and reject changes that do not improve Android or exceed the baseline visual/resource noise envelope.
- [ ] Stop after three isolated failed fixes for the same cause or whenever progress requires a visual/energy downgrade.

### 5. User-flow matrix

- [ ] Cold/warm startup and animated loader.
- [ ] Orb 65-second idle, drag `-1 → 0 → +1`, refine/back, long-session repeat.
- [ ] Drawer open/close and all route buttons after every route.
- [ ] Habits completion/card/sheet and animation icons.
- [ ] Diary editor/sidebar/settings sheet.
- [ ] Planning primary panel/sheet.
- [ ] Settings paper/day and ink/night overview/detail/back.
- [ ] Android Back, IME, background/foreground ×5, rotation, split-screen, safe areas.
- [ ] Normal/reduced motion; `en`, `ar`, `he` motion; all eight locales static checkpoints.
- [ ] API 26 functional smoke.
- [ ] API 36 emulator compatibility and trace reproduction.
- [ ] Physical Android 12+ mid-range 60 Hz performance gate.
- [ ] Physical Android 14+ 90/120 Hz pacing gate.

### 6. Acceptance gates

- [ ] Zero `Tile memory limits exceeded`, WebGL context loss, ANR, crash, and frozen frame.
- [ ] Steady motion deadline-missed frames ≤1%; p95 frame overrun ≤0; p99 ≤ one target frame period.
- [ ] No consecutive missed frames, frame gap >100 ms, or frozen frame ≥700 ms.
- [ ] One renderer, worker, rAF loop; listener count stable; no monotonic memory growth in the last three lifecycle cycles.
- [ ] Candidate timing and jank stay within the predeclared baseline median/MAD noise gates.
- [ ] Phase-synchronized visual comparison remains inside baseline GPU noise with unchanged geometry, color, blur, opacity, assets, and motion trajectory.
- [ ] Focused Vitest, canonical orb, visual, full checks, Android sync/build/benchmark assembly, and scoped Snyk scan complete.
- [ ] Inline SOLO visual-integrity critic reports separate `Technical`, `Visual Runtime`, `Artistic/Craft`, `Motion`, `Model`, and `Plan` statuses.
- [ ] User reviews the final video; artistic approval is not inferred from automated evidence.

## Current status

- Technical: `FAIL` for smoothness acceptance because exact-run logcat contains 58 tile-memory warnings.
- Visual Runtime: `FAIL` because Chromium explicitly reports that content may not draw.
- Motion: `UNVERIFIED` on physical devices; partial emulator video is not a full-route performance metric.
- Artistic/Craft: `UNVERIFIED`; no final candidate exists and the user has not accepted it.
- Model: `N/A`; no 3D/model replacement is authorized.
- Plan: `IN_PROGRESS`; checkboxes above are the source of truth.

## Done only when

The exact same artifact passes the complete semantic, uninterrupted-video, CDP, and CDP-off FrameTimeline routes on the required Android targets; every referenced artifact is hash-bound; visual output stays within the baseline envelope; all blocking errors are zero; the hook tests and enforcement checks pass; and the user is shown the final emulator/device motion evidence. Build success, static screenshots, accessibility nodes, or a successful tap sequence alone cannot close this plan.
