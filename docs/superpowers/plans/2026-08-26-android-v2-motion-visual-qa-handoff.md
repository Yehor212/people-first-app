# Android V2 Motion And Visual QA Handoff Plan

Live unavailable/review-required items are tracked separately in
`docs/superpowers/plans/2026-08-27-android-v2-motion-unverified-ledger.md` so an
independent failure does not stall the next fixable Android V2 motion packet.

> **For the next agent:** REQUIRED SUB-SKILL: use `superpowers:executing-plans` in SOLO mode. Do not spawn subagents. Execute the checkboxes in order and update each item only after fresh evidence exists.

**Goal:** Finish the Android-only V2 motion repair so day theme, Orb controls, drawer/sidebar, theme switching, loader, buttons, sheets, modals, and lifecycle transitions remain continuously visible and perceptually smooth without changing accepted pixels, motion trajectory, timing, content, or quality.

**Architecture constraint:** The current evidence points to Android WebView/Chromium composition pressure in the day theme, not to one generic React animation defect. Continue with exact-artifact benchmark builds, three non-overlapping diagnostic passes, and one-variable compositor experiments. Never promote an experiment to product code until the same installed artifact improves Android FrameTimeline and remains inside the visual noise envelope.

**Tech stack:** Capacitor 8, Android WebView, React 18, TypeScript, Vite, WebGL2/OffscreenCanvas worker, ADB/UIAutomator, CDP, Perfetto FrameTimeline, `dumpsys gfxinfo`, Vitest, Playwright, `ffprobe`, and the repository Android motion scripts.

## 1. Authority and fixed boundaries

- Execution is SOLO. Do not delegate or launch the retired project orchestra.
- Scope is Android/Capacitor only. Shared React paths may change only behind a proven Android runtime boundary, with unchanged Web/PWA/iOS/Desktop behavior.
- Do not commit, push, merge, hand off through Git, upload to Google Play, deploy, or publish without a new explicit user authorization.
- Do not reset, revert, unstage, stage, overwrite, or clean existing work. Several agents own the current dirty worktree.
- Do not use real journal, habit, account, or telemetry data. Use an empty local test state. A development route may only bypass unavailable local authentication; it must not fabricate domain records.
- Forbidden shortcuts: reducing DPR, resolution, target FPS, particle/star/thread count, shader quality, blur, filter strength, opacity, animation duration/easing, or asset quality; hiding layers; switching the normal experience to reduced motion; Canvas2D substitution; or accepting a different visual design.
- Preserve canonical `ValenceOrb` and `MiniValenceOrb`, public APIs, storage, sync, schema, user types, and cross-platform behavior.
- Stop after three isolated failed fixes for the same root cause, or immediately if the only path requires visual, motion, accessibility, battery-policy, data, or privacy loss.

## 2. Exact starting state

| Item | Current value | Status |
| --- | --- | --- |
| Worktree | `/Users/yehor/Projects/ZenFlow/worktrees/codex-android-v2-motion-smoothness-20260822` | VERIFIED |
| Branch | `codex/android-v2-motion-smoothness` | VERIFIED |
| HEAD/base | `13ca51a80d23220574deba762851fe5a32372e46` | VERIFIED |
| Staged binary diff SHA-256 | `2f67c0160bd520cbbe9558979e3e64a5c56ec6d02d19170d16ffd3eb818e7a91` | VERIFIED before this plan; recompute before every handoff |
| Strict edit doctor | `STOP`: existing worktree has 181 changed paths | VERIFIED; do not “fix” by cleaning user work |
| Installed emulator | `emulator-5554`, API 36 | VERIFIED |
| Installed package | `com.zenflow.app`, versionCode 38, versionName 2.1.1 | VERIFIED |
| Installed APK | `output/android-motion-debug/2026-08-26-theme-buttons-candidate-25/app-benchmark-candidate-25.apk` | VERIFIED exact install; candidate is `REJECTED` |
| Installed/source APK SHA-256 | `98ef18b1e6c64a8efbfca24630c0ec7839c48ec7cb9ba079985936b73908a10a` | VERIFIED before and after the final accepted candidate25 run |
| Current source vs installed APK | Candidate25's single-pass drawer blur was rejected and reverted in source | MISMATCH; a new benchmark build is required before any new runtime claim |
| Current runtime | App force-stopped; no CDP forward or runtime style/DOM experiment remains active | VERIFIED at the latest handoff; verify again at execution start |

`npm run agent:workspace -- doctor --mode edit --agent codex --json` is expected to remain `STOP` while this inherited dirty lane exists. The next agent must record that fact, confirm the lock and exact paths, and continue only within the user-owned lane. It must not obtain a false green doctor by deleting or moving changes.

## 3. Status language

- `PASS`: every required fresh check for the named claim passed on the exact installed artifact.
- `FAIL`: an executed check reproduced a defect or crossed a fixed threshold.
- `FIXED`: the original reproduction is green after the scoped patch and blast-radius checks.
- `NOT_REPRODUCIBLE`: the exact controlled scenario was executed but the symptom did not occur; include run count and environment.
- `UNVERIFIED`: required evidence is absent, invalid, mismatched, contaminated, or unavailable.
- `REJECTED`: the experiment was measured and must not be retried as a solution without new evidence.
- `STOP`: an authority, quality, safety, device, or three-failed-experiments boundary blocks continuation.

Build success, DOM presence, accessibility nodes, successful taps, static screenshots, or a single video never imply motion or visual-runtime `PASS`.

## 4. Explicit and implied requirements

### Explicit requirements

- Check the product as a user: tap real visible controls, drag the mood slider, open/close the drawer, use Android Back, switch themes, and traverse every V2 route.
- Judge opening, closing, dragging, pressing, loading, and theme transitions from continuous video, not from screenshots.
- Fix day-theme disappearance, clipping, blanking, and stutter affecting the Orb bar, buttons, sidebar/drawer, and related elements.
- Use the stable night theme as the same-action control, while preserving the day design.
- Make all buttons and other animations pleasant to the eye without mock data or visual regression.
- Leave a complete plan and durable guard so a future agent cannot call the task complete from inadequate evidence.

### Implied requirements included

- Bind source, built APK, installed `base.apk`, WebView, device, display, thermal, power, locale, theme, and motion settings to every run.
- Separate visual capture, WebView/JavaScript instrumentation, and Perfetto so one tool does not distort another.
- Verify raster completeness independently from semantic clickability: a UI node may exist while Chromium fails to draw it.
- Cover high refresh, API 26 compatibility, lifecycle, rotation, split-screen, IME, Android Back, safe areas, RTL, reduced motion, memory, GC, and thermal invalidation.
- Establish a five-run baseline median/MAD and five-capture visual noise envelope before accepting a candidate.
- Require two physical-device gates; emulator results remain compatibility/diagnostic evidence only.
- Preserve privacy: local evidence only, no external telemetry, no real user content, and redact incidental notification/account text before sharing media.

## 5. Evidence already completed

### Accepted diagnostic evidence

- [x] Exact candidate20 APK/install identity was verified: both hashes are `90a519…a7a`.
- [x] Day and night were measured on the same candidate and route contract.
- [x] Day 65-second CDP probe: `2585` frames over `66.291 s`, `38.979533 Hz`, `53` gaps over `100 ms`, interval p95 `58.8 ms`, p99 `154.8 ms`, worker ACK p95 `15.2 ms`, p99 `39.7 ms`.
- [x] Night 65-second control: `3886` frames over `67.550 s`, `57.513039 Hz`, `3` gaps over `100 ms`, interval p95 `22.9 ms`, p99 `39.1 ms`, worker ACK p95 `6.9 ms`, p99 `11.9 ms`.
- [x] Candidate20 CDP evidence reports one Orb worker and two active canvases in day versus one canvas in night; no CDP error was recorded in these two probes.
- [x] Candidate20 Perfetto: `2561` app frames, `39.970525` presented FPS, `576/2561` (`22.491214%`) deadline-missed frames, FrameTimeline p95 `94.681417 ms`, p99 `276.898233 ms`, max `761.886417 ms`, and `37` presentation gaps over `100 ms`.
- [x] Perfetto thread CPU points to composition/render work: `RenderThread 45.040207 s`, `Chrome_InProcGp 21.174767 s`, `VizWebView 8.405117 s`, app main thread `3.434107 s`.
- [x] Candidate20 Chromium logcat contains `tile memory limits exceeded, some content may not draw` while the user-visible day-theme disappearance occurs.
- [x] Candidate20 day layer tree contains `39` total layers, `32` drawing layers, and a total drawing-area ratio of `6.360469` viewport equivalents; the full-screen large-effects canvas is one of several full-screen drawing surfaces.
- [x] Current source restored `AndroidDayLargeEffects` as a sibling outside the contained daylight paint tree; focused test is green: `1` file, `10/10` tests.
- [x] Android visual-runtime hook unit suite is green: `1` file, `9/9` tests.
- [x] `node scripts/check-android-visual-runtime-gate.cjs` is green. It correctly reports that current Codex-client hook loading remains `UNVERIFIED`.
- [x] Fresh candidate20 media integrity: AVFoundation fully decoded `187` H.264 samples from `targeted-theme-drawer.mp4`; duration `40.3882 s`, dimensions `1080 × 2400`. The bundled FFmpeg build cannot demux MP4 or decode H.264, so its `Invalid data` result is a tool-capability limitation rather than video-corruption proof.
- [x] Evidence tooling v2 focused suite is green after RED→GREEN: `2` files, `30/30` tests. It now covers source/untracked provenance, candidate/run statuses, monotonic semantic action wrappers, clickable-node inventory, full video decode, both physical-device gates, and explicit user review.
- [x] Fresh semantic candidate20 `drawer-theme` visual reproduction: exact APK/install SHA stayed `90a519…a7a`; one uncut `59.830878 s` H.264 video fully decoded (`1909` samples, `1080 × 2400`); `8` Chromium tile-memory warnings; no searched ANR/crash/context-loss marker. At video offsets `51.3 s` and `51.7 s`, most drawer content is black/undrawn around the warning cluster while adjacent `50.9 s`, `51.1 s`, and `51.5 s` frames are complete. Candidate20 remains `FAIL`.
- [x] Candidate24 post-restoration baseline is immutable and ledger-bound: APK/install/pulled-base SHA-256 `caa6ee…22cb3`, package `com.zenflow.app`, version `2.1.1 (38)`, v2 signing. Day CDP improved to `56.104412 Hz` with `3` gaps >100 ms; night reached `59.365752 Hz` with `4` gaps. CDP-off day Perfetto improved to `4.492241%` deadline missed with `3` presentation gaps >100 ms and zero tile warnings in that clean pass. The separate visual pass still logged `9` tile warnings and showed partially undrawn drawer frames around both theme switches. Candidate24 status is `FAIL`, not `FIXED`.
- [x] Candidate25 single-pass drawer-blur experiment is immutable and ledger-bound: APK/install SHA-256 `98ef18b…08a10a`, package `com.zenflow.app`, version `2.1.1 (38)`, v2 signing. It reduced the theme Perfetto run to `3.149394%` deadline misses and max WebView draw to `273.107708 ms`, but retained `5` gaps >100 ms. Its uncut `61.3747 s` H.264 visual run fully decoded (`1578` samples), logged `7` tile-memory warnings, and showed partially drawn/horizontally displaced drawer frames at both theme switches on 1×, derived 0.25×, and frame-by-frame review. The steady comparison was outside the automated noise envelope. Candidate25 is `REJECTED`; its source-only blur change was reverted without touching the immutable APK/evidence.
- [x] Two follow-up runtime-only experiments were measured and rejected without product-source promotion: strict night containment regressed to `54.391175%` deadline misses / `36.348245 FPS` / `8` gaps; localizing transition suppression to the drawer regressed to `46.051033%` / `38.033998 FPS` / `10` gaps plus `4` tile warnings. Both injections were cleared by verified process restarts. Together with candidate25, the three-failed-experiment STOP boundary is reached.

### What the evidence does and does not prove

The day-specific full-screen composition path is a confirmed performance/raster-risk boundary. The Chromium tile warning directly says some content may not draw and is consistent with the disappearing mood bar, buttons, and drawer content. The exact per-element causal chain is still `UNVERIFIED` until a time-aligned scenario shows a missing element, its layer/surface state, and the same warning or missed-frame cluster at that moment.

Night is a behavioral control proving the shared Orb worker can run near its intended cadence under the lighter composition tree. Night is not a replacement visual reference: day pixels, colors, blur, blending, and atmosphere must remain day-specific.

### Evidence paths

- Day CDP: `output/android-motion-debug/2026-08-26-candidate20-cdp/orb-65s.json`
- Night CDP: `output/android-motion-debug/2026-08-26-candidate20-cdp/orb-night-65s.json`
- Day layer graph: `output/android-motion-debug/2026-08-26-candidate20-cdp/day-layers-full.json`
- Perfetto summary: `output/android-motion-debug/2026-08-26-theme-buttons-candidate-20/perfetto-summary.json`
- Perfetto trace: use the trace whose SHA-256 is `2ec3db8e166f10e590af0d54b0c54e4c8e9c6f3f34341b5dae00f64055c4c0b3`, as recorded in the summary.
- Chromium/HWUI logcat: `output/android-motion-debug/2026-08-26-theme-buttons-candidate-20/perf-logcat.txt`
- Existing user-flow video: `output/android-motion-debug/2026-08-26-theme-buttons-candidate-20/targeted-theme-drawer.mp4`

The existing video is `FAIL` evidence because the user observed the missing mood bar/buttons/sidebar in it. It is not a final visual proof.

## 6. Rejected and invalid experiments — do not loop back

| Experiment | Evidence | Result | Why it stays rejected |
| --- | --- | --- | --- |
| Candidate22 built after ordinary `cap:sync:android` | APK SHA `ea52da1021779f474f977b9933fb9abef659d7cbfa139bba53b0f929a05e4b00`; `orb-day-65s.json` has `frameCount=0` | INVALID | The benchmark probe was absent from the copied web bundle. This is instrumentation invalidity, not product performance. |
| Candidate23 canvas moved inside contained day root | APK SHA `b4cf129c93f7f07e8941c367e2c278b9b3dc5d746246ec38520f9269a72e9647`; day cadence `26.302248 Hz`, `58` gaps, p95 `75.6 ms`, p99 `191.4 ms` | REJECTED | It regressed candidate20 and could delay a 10-second diagnostic timer beyond 40 seconds after reboot. Never hand off candidate23 as a candidate. |
| CSS fallback after WebGL/context loss | `candidate23/orb-day-layers-css-fallback.json`: `206` layers, `197` drawing, drawing ratio `25.392343` | REJECTED | Catastrophic compositor expansion and timer stalls. |
| Runtime negative z-stack injection | `candidate20-cdp/day-layers-negative-stack.json`: drawing ratio `6.369426` | REJECTED | Did not reduce drawing area; promoted a different full-screen surface. Runtime injection was not source code and has been cleared by force-stop. |
| `desynchronized:true` as a direct fix | Chrome requires a translucent desynchronized canvas to have no DOM above it | REJECTED as standalone | ZenFlow must render controls above the translucent day ambience; the hint risks tearing/flicker and does not solve visual ordering. |
| Blanket removal/addition of `will-change`, opacity tricks, hiding layers | No acceptable artifact | REJECTED | These move promotion costs or alter pixels and do not prove lower total composited area. |

## 7. How visual motion must be checked

### 7.1 Gate A — exact artifact and environment identity

Before touching the app, create `output/android-v2-motion/<source-sha>/<device>/<run>/environment.json` with:

- Git HEAD, staged diff SHA-256, unstaged diff SHA-256, and dirty path list.
- A SHA-256 manifest for every tracked build-input directory/file and every untracked build input. Diff fingerprints alone do not bind untracked bytes.
- APK path, APK SHA-256, installed `base.apk` SHA-256, package, versionCode/versionName, signing certificate digest, and install timestamp.
- Device serial/model, API, ABI, GPU renderer/vendor, display resolution, active refresh rate, density, orientation, WebView package/version, locale, theme, normal/reduced motion, and all three Android animation scales.
- Battery percentage, charging state, battery saver, thermal status, available memory, and background-process state.
- Exact scenario id, UTC start/end time, action log, tool versions, and whether CDP, tracing, taps overlay, or recording was enabled.

Use only a release-like `benchmark` build:

```bash
npm run cap:sync:android:benchmark
cd android
./gradlew assembleBenchmark
```

Do not run ordinary `npm run cap:sync:android` before `assembleBenchmark`; candidate22 proved that this can silently install a non-instrumented web bundle. WebView debugging is benchmark-only; production release must keep it disabled.

After install, obtain the actual path with `adb shell pm path com.zenflow.app`, pull that exact `base.apk`, and compare SHA-256 to the intended artifact. Recheck immediately before and immediately after every accepted run. Any hash, PID, path, version, or `lastUpdateTime` change invalidates the run.

### 7.2 Gate B — three independent passes

Run the same deterministic scenario three times; never combine the tools into one claimed performance result.

1. **CDP/JavaScript pass, recorder off:** collect Orb frame/ACK samples, long tasks, LoAF, layout/style activity, worker create/terminate, listeners add/remove, RAF request/fire/cancel, canvas/context count, allocations, errors, and layer attribution.
2. **CDP off, screen recording off:** collect Perfetto FrameTimeline, SurfaceFlinger, scheduler, GPU, WebView/HWUI draw, GC, memory, and thermal state. `gfxinfo` is supplemental because WebView/OpenGL coverage can be incomplete.
3. **Visual pass only:** record the real Android display and action timestamps. Do not use encoded-video frame rate as the performance metric.

For the 65-second Orb CDP pass:

```bash
adb forward tcp:9222 localabstract:webview_devtools_remote
node scripts/android-motion/collect-webview-probe.mjs \
  --duration-ms 65000 \
  --output output/android-v2-motion/<source-sha>/<device>/<run>/orb-day-65s.json
```

For a layer snapshot:

```bash
node scripts/android-motion/collect-webview-layers.mjs \
  --label orb-day-steady \
  --summary-only \
  --output output/android-v2-motion/<source-sha>/<device>/<run>/orb-day-layers.json
```

The next agent must add monotonic start/end timestamps to every entry produced by `scripts/android-motion/run-real-user-journey.mjs` before relying on it for video/trace correlation. The current action entries do not have timestamps.

### 7.3 Gate C — user interaction protocol

Every tap must target a current visible semantic/accessibility node, not a remembered coordinate. Record node label, bounds, center, action start/end, expected immediate feedback, and actual next state. Coordinates are allowed for a slider or canvas only after resolving its current semantic bounds.

At each checkpoint verify both:

- **semantic truth:** the expected accessible node exists, is enabled, visible-to-user, has non-zero bounds, and the action reaches it;
- **raster truth:** the pixels for that node are present, unclipped, unobscured, stable for at least one second before/after the transition, and remain present through the animation.

For ordinary controls, verify at least `44 × 44 dp` touch bounds unless the control is an allowed inline exception. Check focus, pressed state, disabled state, Android Back ownership, and safe-area clearance.

### 7.4 Required scenario matrix

| Surface | Continuous user actions | Visual invariants |
| --- | --- | --- |
| Startup/loader | cold launch; warm launch; background/foreground during loader; wait for first complete Orb state | loader visibly animates; no static first frame, blank frame, flash, stale previous page, or content jump |
| Orb steady state | 65 seconds idle in day; repeat in night; repeat day after long route cycle | Orb, label, mood bar, Next, menu, and background stay visible; no cadence hiccup, blank tile, or stale frame |
| Orb drag | drag `-1 → 0 → +1` with 2–3 second dwell at each point; reverse; short and slow drags; release outside track | thumb remains attached to input, label updates continuously, bar never disappears, no teleport or phase reset |
| Orb refine | tap Next; scroll actions into view; use Back button and Android Back; re-enter; repeat after 65 seconds | controls appear immediately, opening/closing has no one-frame pop, content is not clipped, Orb phase does not jump |
| Drawer/sidebar | open/close 10 times from Orb; repeat from Habits, Diary, Planning, Settings; use scrim, close button, Android Back | every icon, label, theme control, Settings row, and close button remains drawn; no empty rectangles, crop, z-order error, or stale overlay |
| Navigation | full cycle Orb → Habits → Diary → Planning → Settings → Orb, then reverse | tap feedback is immediate; previous page does not flash; destination controls render before transition completes |
| Habits | open cards/sheets; complete/uncomplete; long-press each mapped TGS icon; scroll/collapse; Android Back | poster and animation stay clipped in the circle; no blank frame, accidental completion, double renderer, or clipped sheet |
| Diary | open editor, sidebar, settings sheet; focus IME; type non-sensitive test text; save/back/discard through real flows | editor/sidebar/sheet open and close continuously; IME and Back do not shift/crop controls or expose stale content |
| Planning | open primary panel and every available sheet; scroll; close by button/scrim/Back | panel and buttons stay visible throughout entrance/exit; no clipped bottom/safe-area jump |
| Settings | scroll overview; enter/exit each detail; paper → ink → paper and ink → paper → ink; rapid and slow switching | outgoing/incoming background do not overlap incorrectly; no flash, freeze, duplicate background, missing row, or phase jump |
| Global overlays | open every reachable modal/sheet/banner/ambient-sound panel; close by every supported path | invisible/off-route overlay never intercepts input; z-index and Back ownership remain correct |
| Lifecycle | background/foreground ×5; process pause/resume; rotation portrait/landscape; split-screen enter/resize/exit | exactly one worker/canvas/RAF loop; no lost controls, phase jump, memory staircase, or wrong safe area |
| Accessibility/locale | normal/reduced motion; static checkpoints `en`, `uk`, `es`, `de`, `fr`, `ja`, `ar`, `he`; full motion in `en`, `ar`, `he` | RTL order/bidi, labels, clipping, target bounds, focus, and motion preference remain correct |
| Compatibility | API 26 smoke; API 36 emulator; physical Android 12+ 60 Hz; physical Android 14+ 90/120 Hz | API 26 functionality; emulator compatibility; both physical performance gates |

Do not silently skip a discovered button. At the beginning of each route, dump the visible UI tree, enumerate enabled clickable nodes, and reconcile them with the action ledger. Every node ends as `PASS`, `FAIL`, `NOT_REPRODUCIBLE`, `N/A` with reason, or `UNVERIFIED`.

### 7.5 Continuous video protocol

- Record the Android display with ADB screen recording or a verified emulator-window capture. Never use an arbitrary desktop region; a prior run recorded the wrong application window.
- Use one uncut video per scenario, each below the recorder’s reliable time limit. Start at least one second before the first input and keep at least one second after the final animation settles.
- No pause, splice, time warp, stabilization, frame interpolation, or post-processing in acceptance media.
- Keep “Show taps” off during performance passes. It may be enabled only in a visual pass and its exact state must be recorded and restored.
- Store a separate monotonic action-timestamp JSON. A video without action correlation can show a symptom but cannot attribute its cause.
- Verify the captured file with a decoder that actually supports its container/codec: duration, width, height, codec, sample count, and full-file decodability. Use `ffprobe`/`ffmpeg` only when their build advertises the needed demuxer/decoder; on macOS use `scripts/android-motion/inspect-video.swift` as the AVFoundation fallback. Never classify a video as corrupt from an unsupported bundled decoder. Then confirm its first/middle/last frames contain Android, not another desktop window.
- Review every sequence three ways: native speed for perceived smoothness, `0.25×` for transient artifacts, and frame-by-frame around each input/transition.
- Compare day and night at matched action timestamps side-by-side. Screenshots are allowed only as phase checkpoints; they cannot close motion.

### 7.6 Video defect rubric

For every opening, closing, drag, route switch, theme change, loader, button press, sheet, and modal, inspect:

- missing, transparent, black, white, stale, or partially drawn frames;
- a one-frame flash at the first/last animation frame;
- disappearing mood bar, thumb, label, menu button, drawer icon, text, close button, or settings/theme control;
- crop against the viewport, circular mask, sheet edge, safe area, system bars, keyboard, landscape, or split-screen bounds;
- incorrect z-order, scrim, blend mode, mask seam, blur edge, tile boundary, or retained previous-theme layer;
- velocity discontinuity, uneven cadence, mid-animation pause, double-start, phase reset, overshoot, snap, teleport, or touch/visual desynchronization;
- delayed pressed state, missed feedback, invisible input interceptor, duplicate close/open, or Android Back revealing an obsolete frame;
- geometry, color, blur, opacity, asset, particle count, trajectory, duration, or easing change relative to the exact baseline;
- reduced-motion behavior: motion is reduced intentionally but layout/content must remain complete, responsive, and non-static where the contract still requires a loader indicator.

Any perceptible defect is `FAIL` even if a frame counter is green. Any numeric miss is `FAIL` even if the recording appears acceptable.

## 8. Performance and visual acceptance gates

### Physical-device measurement protocol

- Android 12+ mid-range 60 Hz and Android 14+ 90/120 Hz are mandatory. The API 36 emulator is not user-performance proof.
- For each physical device and scenario: three warmups, then five measured repetitions.
- Invalidate a repetition if thermal throttling, battery saver, charging transition, unexpected refresh-rate change, external APK install, notification overlay, screen recording in a performance pass, or unrelated load occurs.
- Freeze the baseline threshold before viewing candidate results: median and MAD across five repetitions.

### Absolute gates

- steady motion deadline-missed frames `≤ 1%`;
- `frameOverrunMs` p95 `≤ 0`, p99 `≤` one target frame period;
- no consecutive missed frames, presentation gap `>100 ms`, frozen frame `≥700 ms`, ANR, crash, WebGL context loss, or `tile memory limits exceeded`;
- Orb cadence is judged against its current 60 Hz contract; any high-refresh change must preserve motion speed and avoid CPU/GPU/thermal regression;
- after warmup, worker ACK p95 `≤` one target frame period and p99 `≤` two periods;
- exactly one Orb renderer/worker/RAF loop; listener count stable; no monotonic memory growth in the last three of five lifecycle cycles;
- candidate timing must not regress more than `max(1 ms, 2×MAD)` and jank rate more than `max(0.5 percentage points, 2×MAD)`.

### Visual gate

- Five baseline captures define natural GPU noise at phase-synchronized checkpoints.
- Candidate remains inside that envelope for geometry, colors, blur, filters, opacity, assets, masks, DPR, counts, trajectory, velocity, duration, and easing.
- Static checkpoints: all eight locales, both themes, portrait, landscape, split-screen, safe areas, normal and reduced motion.
- Full motion: `en`, `ar`, `he`; emulator and both physical devices.
- Produce side-by-side frame boards and paired uncut videos, but do not infer user artistic approval. The user must actually view the final media.

## 9. Technical continuation plan

### Task 0 — Freeze and verify the inherited lane

- [x] Re-read `AGENTS.md`, `ARCHITECTURE.md`, `docs/ai/TEST_FIRST_AGENT_POLICY.md`, `docs/ai/TELEGRAM_GRADE_RUNTIME_CONTRACT.md`, `docs/ai/V2_FULLSCREEN_EDGE_TO_EDGE_CONTRACT.md`, `docs/ai/BEST_PRACTICES_IMPLIED_REQUIREMENTS_GATE.md`, and `docs/ai/VISUAL_INTEGRITY_CRITIC_PROTOCOL.md`.
- [x] Run Free RAG for the exact continuation request. Fresh task hash: `a2b4bb166e33e3edc92c4dc1a1fe11630d749ee4f14f3c654b6b39fac27de8e2`.
- [x] Record strict doctor `STOP` without cleaning; verify locked branch/worktree/HEAD. Fresh doctor reported `171` changed paths and the expected dirty-lane-only STOP.
- [x] Recompute staged and unstaged diff hashes and compare the staged hash with `2f67c0…e7a91`. Fresh staged hash matches exactly.
- [x] Inventory and hash untracked build inputs without changing the index. Fresh manifest: `output/android-v2-motion/13ca51a80d23220574deba762851fe5a32372e46/emulator-5554/2026-08-26-phase0-provenance/source-manifest.json`. Its external receipt records the manifest SHA-256 so the manifest never self-references through this untracked plan.
- [x] Confirm the current source still places `AndroidDayLargeEffects` outside the contained day root and rerun `AndroidDayCosmicBackground.test.tsx`. Fresh result: `1` file, `10/10` tests PASS.
- [x] Create a new evidence run directory; never reuse or overwrite an earlier run. Fresh environment JSON SHA-256: `2f800dcd588496f87e8acec350b1cb941a20ae69aa61b235a4d252eaef96b745`.

### Task 0A — Close evidence-integrity gaps before candidate24

**Relevant files:**

- `specs/002-android-v2-motion-smoothness/contracts/android-motion-evidence.schema.json`
- `scripts/android-motion/evidence-lib.mjs`
- `scripts/android-motion/collect-source-evidence.mjs`
- `scripts/android-motion/collect-environment.mjs`
- `scripts/android-motion/run-real-user-journey.mjs`
- `scripts/android-motion/inspect-video.swift`
- `scripts/codex-governance/android-visual-runtime-core.cjs`
- focused tests under `scripts/__tests__/`

- [x] RED→GREEN source/candidate/run ledger v2: bind staged/unstaged fingerprints, tracked build inputs, untracked bytes, exact APK/install identity, per-run environment, and `FIXED | FAIL | REJECTED | NOT_REPRODUCIBLE | UNVERIFIED`.
- [x] RED→GREEN monotonic action wrapper and current visible/enabled/clickable UIAutomator-node inventory.
- [x] RED→GREEN full media decode and fail-closed physical 60 Hz, physical 90/120 Hz, 1×/0.25×/frame review, and explicit user-acceptance guard.
- [ ] Add timestamps to every checkpoint, derive every scroll/drag from current semantic bounds, and reconcile every discovered clickable node before using the journey for acceptance.
- [ ] Verify the currently running Codex client loaded the updated hook; static registration remains `UNVERIFIED`.

### Task 1 — Build the first post-restoration benchmark candidate

**Relevant files:**

- `src/pages/nav-v2/DayCosmicBackground.tsx`
- `src/pages/nav-v2/DayCosmicBackground.css`
- `src/pages/nav-v2/AndroidDayLargeEffects.tsx`
- `src/pages/nav-v2/__tests__/AndroidDayCosmicBackground.test.tsx`
- `android/app/src/benchmark/AndroidManifest.xml`
- `package.json`

- [x] Run `npm run cap:sync:android:benchmark` and `./gradlew assembleBenchmark` in that order. Both commands exited `0`; Gradle reported `BUILD SUCCESSFUL`.
- [x] Copy the artifact into a new immutable evidence directory, hash it, install it, pull installed `base.apk`, and prove exact equality. Candidate24 SHA-256: `caa6ee09fb3587c45a5f6baf6db7c6175655cdb2c01a8424ef9d9c76bca22cb3`.
- [x] Verify benchmark-only WebView debugging and production-release debugging disabled. Fresh benchmark contract: `1` file, `5/5` tests PASS.
- [x] Verify package/version/signature/manifest and record WebView/device/thermal/display state. Package/version `com.zenflow.app / 2.1.1 / 38`; v2 signature; API 36 emulator at 60 Hz; WebView `133.0.6943.137`; thermal status `0`.
- [x] Run a 65-second day probe and layer snapshot before changing architecture. Status `FAIL`: `56.104412 Hz`, `3` gaps >100 ms, drawing-area ratio `6.360348`.
- [x] Run the same night probe on the same installed artifact. Status `FAIL`: `59.365752 Hz`, `4` gaps >100 ms, drawing-area ratio `4.557995`.

### Task 2 — Add time-correlated user journey evidence before another product patch

**Relevant files:**

- `scripts/android-motion/run-real-user-journey.mjs`
- `scripts/android-motion/run-real-user-journey.d.mts`
- `scripts/__tests__/android-motion-evidence.test.ts`

- [x] Write RED tests requiring monotonic action/checkpoint evidence, exact artifact identity, semantic bounds, bounded scenarios, and clickable-node reconciliation.
- [x] Implement only test/evidence plumbing; no product behavior was changed in this task step.
- [x] Rerun the focused evidence suite green. Fresh focused total after scenario/process fixes: `2` files, `38/38` tests.
- [ ] Perform one uncut day Orb/drawer video and correlate the first disappearing/clipped/stalled frame to action time, logcat, layer state, and FrameTimeline token.
- [ ] Repeat the exact action sequence in night theme as control.

### Task 3 — Select one compositor hypothesis from evidence

The unresolved engineering problem is how to remove excessive full-screen translucent composition without losing a single accepted visual or motion property. The following are hypotheses, not pre-approved fixes:

1. **One opaque day-ambience renderer:** render the canonical static and dynamic daylight background into one full-DPR `alpha:false` WebGL surface behind DOM controls. This may reduce translucent full-screen intermediates, but exact CSS blur/blend/grain parity is high risk. Reject unless phase pixel differences remain inside baseline noise and physical-device FrameTimeline improves.
2. **Bounded/tiled dynamic surfaces:** split only effects whose true animated bounds are materially smaller than the viewport. Preserve full DPR, counts, coordinates, speed, filters, and blending. Reject if summed drawing area or FrameTimeline does not improve.
3. **Targeted promotion removal:** remove a single proven redundant promotion only when CDP shows the same pixels with fewer drawing surfaces. Reject blanket `will-change`, transform, opacity, or containment changes.

Do not retry CSS fallback, canvas-inside-contained-root, negative z-stack, `desynchronized:true`, quality reduction, or layer hiding.

- [x] Use layer attribution and Perfetto to select exactly one hypothesis.
- [ ] State expected behavior, affected Android scope, failure risk, baseline evidence, rollback, and exact files in an `AGENT_CHANGE_NOTICE` before protected product edits.
- [ ] Add the smallest RED contract: visual DOM ordering plus a runtime layer/drawing-area assertion that would fail on the current day path.
- [x] Change one compositor variable only. Candidate25 replaced only the chained Android drawer-panel blur with its variance-equivalent single pass; the rejected source change was then reverted.
- [x] Build a fresh benchmark APK; do not use live CDP CSS as candidate evidence. Candidate25 was built via the required benchmark sync followed by `assembleBenchmark`.
- [x] Rerun day/night CDP, layer graph, CDP-off Perfetto, logcat, and the exact user video. All accepted run records are bound in the candidate25 ledger; results are `FAIL`.
- [x] Mark candidate `REJECTED` unless it improves a physical device and stays inside visual/resource noise. Candidate25 is `REJECTED`: no physical improvement is available and visual comparison is outside the automated noise envelope.

### Task 4 — Close the full user-flow matrix

- [ ] Startup and loader.
- [ ] Orb 65-second idle and complete drag/refine/back sequence.
- [ ] Drawer/sidebar open-close ×10 and from all five routes.
- [ ] Every clickable control reconciled from the UI tree.
- [ ] Habits, Diary, Planning, Settings, sheets, modals, and ambient-sound overlay.
- [ ] Day → night → day and night → day → night without process restart.
- [ ] Android Back, IME, background/foreground ×5, rotation, landscape, split-screen, and safe areas.
- [ ] Normal/reduced motion; `en`/`ar`/`he` motion; all eight locales static.
- [ ] No missing bar, button, label, icon, drawer row, or stale/invisible input interceptor in any accepted video.

Fresh candidate32 partial runtime evidence (2026-08-27; these rows do not
complete the checkboxes above):

- Exact host/installed APK SHA-256 remained
  `fa963da1101200ae1d6aab9443ffb53ecc655cf34a4d1e5db8d6bb6d6fba0c62`,
  package/version `com.zenflow.app / 2.1.1 / 38`, except for one explicitly
  invalidated Habits attempt where another process replaced the APK. The exact
  APK was reinstalled and passed four no-click SHA checks over 30 seconds.
- Drawer Paper→Ink removed the inactive full-screen day WebGL compositor layer
  and produced no tile-memory warning, but visual frame review found native
  status-bar icons switching before the WebView theme frame. candidate32 is
  therefore a visual `FAIL`, not a promoted candidate.
- The valid drawer→Habits video contains destination feedback followed by a
  stale Orb frame, an almost blank Habits shell, and then final Habits content.
  This is a generic phone drawer route `FAIL`, tracked as UV-015.
- Diary Statistics, Favorites, Settings panel, editor open, IME hide, and empty
  editor Back were exercised without saving a journal record. Planning
  Today/Schedule/Focus/Review and all five Settings module open/Back paths were
  exercised with fresh semantic trees. These remain partial and
  `UNVERIFIED` for full motion because not every action was correlated and the
  user has not reviewed the videos.
- Settings displays `ZenFlow v2.0.0` despite the exact APK being `2.1.1`; this
  non-motion version-provenance defect is isolated as UV-016 because fixing it
  would cross the storage/sync/API boundary of this lane.
- No candidate32 CDP-off Perfetto was promoted: the visual kill gate failed
  first, so performance remains `UNVERIFIED` for candidate32.

### Task 5 — Close device and performance gates

- [x] API 36 emulator compatibility and diagnostic reproduction. Candidate25 exact-artifact CDP, Perfetto, and visual runs reproduce the failure; this is a diagnostic `FAIL`, not a device PASS.
- [ ] API 26 emulator functional smoke.
- [ ] Android 12+ mid-range physical 60 Hz: 3 warmups + 5 measurements.
- [ ] Android 14+ physical 90/120 Hz: 3 warmups + 5 measurements at the active refresh rate.
- [ ] Baseline/candidate median and MAD frozen before candidate inspection.
- [ ] All absolute performance gates in section 8 pass.
- [ ] Memory/listener/worker/RAF lifecycle counts stabilize; no thermal regression.

### Task 6 — Regression and integrity gates

- [x] Focused Vitest for each changed module, with recorded RED then GREEN. Final focused handoff run: `6` files, `98/98` tests.
- [x] `npm run check:canonical-orbs`.
- [x] `npm run check:visual`.
- [x] `npm run check:all`. The first fresh run exposed two evidence-test type errors; after a fixture-only RED→GREEN correction, the full rerun exited `0`. ESLint still reports two warnings in `AndroidDayLargeEffects.tsx`, and the color audit reports ten allowed findings below its threshold, so this is not a claim of warning-free lint.
- [x] Android benchmark build and manifest/package inspection. Candidate25 package/version/signature and exact installed hash are ledger-bound; candidate remains rejected.
- [x] `npm run check:production-data-integrity:diff` and bundle mode after the production-equivalent build.
- [x] Scoped security scan attempted and recorded as `UNVERIFIED_PARTIAL`, not PASS. Snyk high-severity mode returned `0` issues; the all-severity run listed `27` findings and then ended with `403 Forbidden`. The narrow local security suite for `scripts/android-motion` recorded two LOW Swift path-traversal findings, zero TruffleHog findings, no Trivy language/config findings, and twelve Gitleaks history matches requiring separate triage.
- [x] `npm run check:no-ai-templates` for changed plan/governance output.
- [x] `node scripts/check-android-visual-runtime-gate.cjs` and focused `android-visual-runtime-hook.test.ts`. Gate passes; current client hook loading remains explicitly `UNVERIFIED`.
- [ ] Verify the current Codex client actually loaded the new hook; static registration alone remains `UNVERIFIED`.
- [ ] Review final `git diff`, `git status`, staged hash, untracked inventory, secrets, real user data, and test-only reachability.

### Task 7 — Final visual-integrity and user review

- [ ] Run the inline SOLO `visual-integrity-critic` against exact artifact paths and the complete evidence ledger.
- [ ] Report independent statuses: `Technical`, `Visual Runtime`, `Artistic/Craft`, `Motion`, `Model`, and `Plan`.
- [ ] Show the user final uncut emulator and physical-device videos plus side-by-side day/night and baseline/candidate boards.
- [ ] Keep `Artistic/Craft` and user acceptance `UNVERIFIED` until the user actually reviews and accepts the media.
- [ ] Keep release/publication `STOP` unless a new explicit authorization is given after all gates pass.

## 10. Evidence ledger schema

Each scenario row must contain:

```json
{
  "scenarioId": "orb-day-drawer-open-close",
  "artifactSha256": "exact installed APK hash",
  "device": "serial/model/API/refresh",
  "theme": "paper",
  "locale": "en",
  "motion": "normal",
  "run": 1,
  "startedAt": "ISO-8601",
  "endedAt": "ISO-8601",
  "actions": "path to timestamped action JSON",
  "video": "path and SHA-256",
  "cdp": "separate pass path and SHA-256",
  "perfetto": "separate pass path and SHA-256",
  "logcat": "path and SHA-256",
  "symptom": "exact user-visible defect or none",
  "rootCause": "evidence-backed cause or UNVERIFIED",
  "fix": "candidate id or none",
  "visualDiff": "path/status",
  "performance": "metrics/status",
  "status": "FIXED | FAIL | NOT_REPRODUCIBLE | UNVERIFIED | REJECTED"
}
```

The literal example values describe fields, not production or test data. Store actual evidence only under ignored local `output/`; never commit user content or device identifiers that are not needed for the test.

## 11. Platform and proof matrix

| Surface | Status now | Completion boundary |
| --- | --- | --- |
| Android/Capacitor | FAIL | Day candidate20 misses `22.49%` of deadlines and logs tile-memory draw loss; complete sections 7–9 |
| Web/Vite | N/A runtime | Shared paths must remain behaviorally unchanged; run static/build blast-radius checks |
| Installed PWA | N/A | No runtime expansion authorized |
| iOS/WKWebView | N/A | No runtime expansion authorized |
| Desktop/Tauri | N/A | No runtime expansion authorized |
| Store/Release | STOP | No commit, push, upload, rollout, or publication authorized |
| Accessibility | PARTIAL | Semantic interaction tooling exists; full target/RTL/reduced-motion matrix pending |
| Performance | FAIL emulator; UNVERIFIED physical | Candidate20 misses gates; both physical-device gates absent |
| Security/Privacy | PARTIAL | Local empty-state boundary defined; changed-code scan and final media redaction pending |
| Operations | PARTIAL | Hook static/unit checks pass; current client loading and final exact-tip handoff absent |

## 12. Sources that constrain the method

- [Android slow rendering](https://developer.android.com/topic/performance/vitals/render): manually exercise real use cases on a release-like build, then use system traces to diagnose frames; 60/90/120 Hz imply roughly 16/11/8 ms frame windows.
- [Android performance measurement overview](https://developer.android.com/topic/performance/measuring-performance): jank is a visible pause and must be measured across user journeys and refresh rates.
- [Perfetto FrameTimeline](https://perfetto.dev/docs/data-sources/frametimeline): correlates app completion, GPU/post time, SurfaceFlinger composition, presentation, dropped frames, and jank source on Android 12+.
- [Android WebView debugging](https://developer.android.com/develop/ui/views/layout/webapps/debugging): CDP is the supported path for inspecting HTML/CSS/JavaScript inside WebView; keep it benchmark-only.
- [Android WebView window insets](https://developer.android.com/develop/ui/views/layout/webapps/understand-window-insets): IME changes the visual viewport and web-side resize/focus handling must preserve the active field; incorrect or double-consumed insets can prevent `scrollIntoView()` from keeping it reachable. The recorded WebView is M133, so newer M139 IME behavior is not assumed as proof.
- [Chrome desynchronized canvas constraints](https://developer.chrome.com/blog/desynchronized): translucent desynchronized canvas cannot have DOM above it and may flicker/tear, so it is not a safe direct ZenFlow fix.
- [Testing Library guiding principles](https://testing-library.com/docs/guiding-principles/): automated interactions should resemble real user behavior.
- [Playwright best practices](https://playwright.dev/docs/best-practices): prefer visible roles/labels and web-first assertions rather than implementation selectors.
- [Android Macrobenchmark overview](https://developer.android.com/topic/performance/benchmarking/macrobenchmark-overview): benchmark complete user journeys with `UIAutomator` and repeated `FrameTimingMetric` measurements; emulator measurements do not replace physical-device performance proof.
- [Android Macrobenchmark interaction control](https://developer.android.com/topic/performance/benchmarking/macrobenchmark-control-app): drive realistic app states and interactions while keeping benchmark setup and measured work distinct.
- [Chromium TileManager scheduling](https://chromium.googlesource.com/chromium/src/+/49b3e6465bc0781cffa00374219e97e0348b51bd/cc/tiles/tile_manager.cc): when the tile memory budget cannot fit required NOW-priority tiles, Chromium leaves tiles unscheduled and records an out-of-memory condition; a visually missing surface must therefore be correlated with tile scheduling rather than dismissed as an FPS-only issue.
- [Android hardware-accelerated rendering](https://developer.android.com/topic/performance/hardware-accel): hardware layers and textures consume memory, and excessive or unsupported drawing can produce incorrect/invisible output; Android's rule of thumb is to avoid drawing more than roughly 2.5 screenfuls of pixels per frame.
- [Rendering performance](https://web.dev/articles/rendering-performance): compositor-only motion can avoid paint, but layer count and promotion still need active control; indiscriminate promotion is not a safe fix.
- [Same-document View Transitions](https://developer.chrome.com/docs/web-platform/view-transitions/same-document): transition snapshots can freeze dynamic video/canvas content. ZenFlow's native Capacitor path currently bypasses `document.startViewTransition`, so this mechanism must not be named as the Android cause without contrary runtime evidence.
- [Element-scoped View Transitions](https://developer.chrome.com/docs/css-ui/view-transitions/element-scoped-view-transitions): scoping can reduce root-overlay and z-order hazards, but the feature requires Chrome 147+ and is unavailable in the currently recorded Android WebView 133; it is not an admissible current fix.
- [Android screenshot testing](https://developer.android.com/training/testing/ui-tests/screenshot): use approved golden images, minimize redundant combinations, and prefer a smart structural/semantic differ over raw pixel thresholds when platform noise exists.
- [UI Automator screenshots and artifacts](https://developer.android.com/training/testing/other-components/ui-automator#screenshots): a persistent UI Automator test can capture the active window or a semantic element and bind the artifact to the test result without restarting the automation service for every assertion.
- [LPIPS, CVPR 2018](https://openaccess.thecvf.com/content_cvpr_2018/html/Zhang_The_Unreasonable_Effectiveness_CVPR_2018_paper.html): deep feature distances matched human perceptual similarity judgments better than shallow pixel metrics in the authors' dataset; use as a review signal, not an automatic artistic PASS.
- [FLIP, NVIDIA Research](https://research.nvidia.com/labs/rtr/publication/andersson2020flip/): perceptual image differences should account for human contrast sensitivity and perceptually uniform color rather than count every changed pixel equally.

## 13. Current honest status and done condition

- **Technical:** `FAIL` — candidate25 remains above the `≤1%` deadline-miss limit, retains gaps over `100 ms`, and is rejected after exact APK/install verification.
- **Visual Runtime:** `FAIL` — candidate25 shows malformed drawer frames at both theme switches aligned to Chromium tile-memory warnings.
- **Artistic/Craft:** `UNVERIFIED` — steady candidate25 comparison was outside the automated noise envelope and no final candidate or user-approved video exists.
- **Motion:** `FAIL` on the API 36 emulator; `UNVERIFIED` on physical 60/90/120 Hz devices.
- **Model:** `N/A` — no 3D model replacement is authorized.
- **Plan:** `STOP_THREE_FAILED_EXPERIMENTS` — the completed and pending checkboxes above remain the source of truth; do not start a fourth architecture experiment without a new approved hypothesis/evidence boundary.

Done only when one exact installed artifact passes the complete semantic journey, uncut video review, separate CDP diagnostics, separate CDP-off FrameTimeline/Perfetto runs, both physical-device gates, visual noise envelope, regression/integrity checks, inline visual critic, and actual user review. Until then the product result remains `FAIL/UNVERIFIED`, never “almost PASS”.

## 14. Revision 2 — all-controls, glitch-free, human-eye motion completion

This revision expands the broad pending rows in Tasks 4–7. It does not change any
historical `[x]`, does not revive candidate25, and does not authorize a fourth
compositor experiment by itself. Tasks 8–16 below are the authoritative
decomposition for future execution; the older Task 4–7 rows remain roll-up rows
and may be checked only after every corresponding detailed row is green.

### 14.1 Correct answer about prior completion

- The previous plan was **not** complete apart from physical devices.
- Exact APK provenance, focused Orb/drawer/theme diagnostics, candidate builds,
  several regression gates, and failure preservation were completed.
- The accepted candidate25 visual journey exercised only eight actions and five
  UI-tree inventories. It did not exercise every discovered control.
- Startup/loader, the complete Orb select/refine/back flow, every route control,
  record-dependent Habits/Diary states, Planning modes, Settings modules,
  sheets/modals, IME, lifecycle, rotation, split-screen, reduced motion,
  `en/ar/he` full motion, API 26, final visual critic, and user acceptance remain
  incomplete or `UNVERIFIED`.
- Candidate25 is `REJECTED`; its videos prove the defect, not smoothness.

### 14.2 Blocking decisions before execution resumes

- [ ] **Architecture authority:** the user explicitly approves a fresh
  architecture cycle after reviewing an exact `AGENT_CHANGE_NOTICE`. Without
  this approval, `STOP_THREE_FAILED_EXPERIMENTS` remains binding.
- [ ] **Disposable-record authority:** choose one of these two truthful paths:
  (a) authorize task-owned, non-sensitive, local-only disposable QA records that
  are created through the real UI and deleted through the real UI after evidence;
  or (b) keep every record-dependent Habit/Diary/Planning control
  `UNVERIFIED_BLOCKED_NO_DATA_AUTHORITY`. Production mock/fallback records and
  real user records remain forbidden in both paths.
- [ ] **Physical-device availability:** connect an Android 12+ mid-range 60 Hz
  device and an Android 14+ 90/120 Hz device, with exact serial aliases recorded
  locally. No emulator row substitutes for either device.
- [ ] **User-review availability:** reserve a final review checkpoint where the
  user views the exact uncut emulator and physical-device videos. Agent review
  cannot substitute this row.
- [ ] **Permission/external-action authority:** Android permission prompts,
  document/photo pickers, browser intents, feedback forms, share sheets, update
  actions, and notification settings may be opened and safely denied/dismissed.
  Granting a permission, selecting a real file, sending feedback, sharing,
  installing an update, or leaving the app for an external action requires
  separate explicit authorization at that action.

### 14.3 Complete-control coverage contract

Create `scripts/android-motion/build-control-manifest.mjs` and extend
`specs/002-android-v2-motion-smoothness/contracts/android-motion-evidence.schema.json`.
The manifest is generated from the current UIAutomator tree at every named state,
then reconciled with DOM accessibility metadata from the benchmark WebView.

```ts
export interface AndroidMotionControlRow {
  controlId: string;
  route: "global" | "orb" | "habits" | "diary" | "planning" | "settings";
  state: string;
  role: string;
  accessibleName: string;
  resourceId: string | null;
  bounds: { left: number; top: number; right: number; bottom: number };
  interaction: "tap" | "toggle" | "drag" | "scroll" | "type" | "android-back";
  transitionClass: "none" | "press" | "route" | "drawer" | "sheet" | "modal" | "theme" | "ime" | "system";
  dataAuthority: "empty-state" | "transient-unsaved" | "disposable-local-record";
  mandatory: boolean;
  discoveredAt: string;
  exercisedRunIds: string[];
  status: "PASS" | "FAIL" | "UNVERIFIED" | "BLOCKED" | "NOT_APPLICABLE";
  exclusionReason: string | null;
}
```

Coverage is fail-closed:

```text
mandatory_discovered = mandatory_exercised_pass
mandatory_fail = 0
mandatory_unverified = 0
mandatory_blocked = 0
unreconciled_clickable_nodes = 0
duplicate_control_ids = 0
invisible_interceptors = 0
```

`NOT_APPLICABLE` is allowed only for a control proven unreachable in the exact
platform/state by source plus runtime evidence. A static source list, a DOM node,
or one successful tap does not prove visual or motion coverage.

### 14.4 Route and control-family manifest

| Surface | Mandatory states and controls | Required motion evidence |
| --- | --- | --- |
| Global shell | cold/warm loader; Open menu; backdrop dismiss; Close menu; Mood, Habits, Diary, Planning, Settings routes; theme toggle; pending-route indicator; visible mini-player/offline-banner actions when reachable | pressed state, drawer enter/exit, route morph, focus restoration, overlay ownership, repeated tap rejection |
| Orb select | Orb tap; three scope radio controls; semantic slider `-1 → 0 → +1 → 0 → -1`; short/slow drag; release outside track; Next enabled/disabled; ambience toggle | Orb phase continuity, label/thumb attachment, aura/field continuity, press latency, select→refine transition |
| Orb refine | every discovered emotion tag; note input focus/IME; Back; Save mood; Open diary when reachable; Android Back | mini-Orb continuity, grid response, scroll, IME resize, refine→select and refine→diary transitions, safe exit without unintended durable write |
| Habits | empty state; create sheet; template library and every visible category tab; template selection/cancel; every visible hero control; show-more/collapse; action sheet open/close; skip/archive/edit/details/delete only with disposable-record authority | sheet/scrim completeness, row expand/collapse, TGS/celebration continuity, focus return, Back precedence, no double activation |
| Diary | loader/empty state; hub tabs/rails; new-entry/open-editor; editor close/back; toolbar controls; calendar/search/filter/settings; sticker/photo/audio/export/password/legal dialogs only when safely reachable; entry actions/viewer only with disposable-record authority | lazy-load continuity, editor/toolbar/keyboard stability, modal/sheet z-order, safe exit, save ceremony only with authorized disposable record, privacy overlay correctness |
| Planning | modes `today`, `schedule`, `focus`, `review`; empty schedule action; bridge actions; focus-timer controls; review action; every visible timeline/calendar control | mode-rail response, section transition, timer/miniplayer handoff, scroll, sheet/modal/Back and background-resume continuity |
| Settings | overview cards `account`, `appearance`, `sound`, `notifications`, `privacy`; detail Back; theme modes and customization menu/reset; text size; language; sound/master volume; reminders; privacy/data controls; About/footer/legal/update/feedback dialogs where reachable; system permission/chooser/external-intent entry points only under the authority boundary in 14.2 | overview→detail transition, theme roundtrips, sliders/toggles, menu/dialog/system motion, IME, focus return, RTL geometry, no persistence failure hidden from user, no unauthorized grant/send/share/update |

For dynamic lists, “every control” means every distinct control family plus every
currently visible instance discovered in that run. Virtualized/off-screen controls
must be discovered after semantic scrolling and then exercised. The executor must
not use coordinate grids or speculative taps.

### 14.5 Variant matrix without hidden Cartesian gaps

Tier A — full functional coverage:

- [ ] API 36 emulator, `en`, paper, normal motion, portrait: every mandatory
  control row and every transition class.
- [ ] Same artifact, `en`, ink, normal motion, portrait: every motion-sensitive
  control and all theme/background-dependent controls.
- [ ] Same artifact, paper and ink: theme roundtrips in both orders without
  process restart.

Tier B — accessibility and window coverage:

- [ ] Full motion journeys in `en`, `ar`, and `he`; mirrored direction,
  bidi-isolated values, text reflow, focus order, and edge clipping checked.
- [ ] Static complete-control checkpoints in `en`, `uk`, `es`, `de`, `fr`,
  `ja`, `ar`, and `he` for both themes.
- [ ] Normal and reduced motion for startup, every route transition, drawer,
  sheets/modals, Orb select/refine, and Settings theme changes.
- [ ] Portrait, landscape, split-screen narrow/wide, status/navigation-bar
  changes, cutout/safe areas, and IME-open states.

Tier C — lifecycle and accumulation:

- [ ] Cold launch ×5 and warm launch ×5.
- [ ] Drawer open/close ×10 from each of the five routes.
- [ ] Android Back at every drawer, sheet, modal, editor, IME, detail, and route
  state; predictive Back ownership recorded where supported.
- [ ] Background/foreground ×5 from Orb, an open drawer, an open sheet/modal,
  an IME state, active focus timer, and active media/ambience state.
- [ ] Rotation and split-screen changes during rest and during an active
  transition; no duplicate renderer/worker/listener/timer remains afterwards.

Tier D — platform/performance:

- [ ] API 26 emulator functional smoke for all five routes, drawer, Back, IME,
  theme, and one representative sheet/modal. Unsupported diagnostics are marked
  `UNVERIFIED`, not silently omitted.
- [ ] API 36 emulator diagnostic reproduction for every critical user journey.
- [ ] Android 12+ physical 60 Hz and Android 14+ physical 90/120 Hz: three
  warmups plus five accepted measured repetitions per critical journey.

### 14.6 Separate-pass evidence for every critical journey

Critical journeys are: startup, Orb idle/drag/refine/back, drawer/theme, five-route
cycle, Habits sheet/action, Diary editor/IME/modal, Planning mode/timer, Settings
detail/theme/slider, lifecycle, rotation, and split-screen.

1. **Semantic visual pass:** one uncut device-window recording per journey,
   starting at least one second before input and ending at least one second after
   the final animation settles. It records monotonic action/checkpoint times but
   makes no performance claim.
2. **CDP/JavaScript pass:** no recording; collect Orb/worker/RAF/long-frame data,
   accessibility/DOM reconciliation, current layer tree, animation state, and
   resource counts. Remove the PID-scoped forward immediately after the pass.
3. **CDP-off Perfetto pass:** no recording and no DevTools connection; collect
   FrameTimeline, RenderThread/WebViewFunctor, SurfaceFlinger, Buffer Stuffing,
   scheduler and GPU attribution. Bind every input window to frame tokens using
   Android boot time and host/device clock uncertainty.
4. **Lifecycle/resource pass:** no recording; collect `gfxinfo framestats`, PSS,
   Java/native heap where warranted, worker/listener/RAF/timer counts, thermal,
   power and refresh state before/after each cycle.

Every pass repeats installed `base.apk` SHA verification afterwards. Any external
install, theme/locale drift, thermal invalidation, notification overlay, capture
contamination, or missing semantic target invalidates the run.

### 14.7 “Pleasant to the human eye” gate

The phrase is operationalized; it is not inferred from average FPS.

Technical frame gates:

- [ ] `AppDeadlineMissed ≤ 1%` on both physical devices; zero consecutive missed
  frames and zero presentation gaps `>100 ms`.
- [ ] No `tile memory limits exceeded`, ANR, crash, WebGL context loss,
  Buffer Stuffing cluster at an interaction, or frozen presentation `≥700 ms`.
- [ ] Pressed-state or drag response appears on the next presented frame after
  the input event, within one active-refresh frame period after clock uncertainty.
- [ ] No duplicate worker/RAF loop; listener/timer counts stabilize; the final
  three lifecycle cycles have no monotonic memory increase.

Perceptual motion gates, reviewed at 1×, 0.25×, and frame-by-frame:

- [ ] No missing, partial, black, white, stale, clipped, or horizontally shifted
  frame anywhere in the transition.
- [ ] No delayed pressed state, dead tap, double activation, invisible overlay
  interception, focus jump, or Back revealing an obsolete frame.
- [ ] Start/end geometry and duration match the frozen baseline within one
  presented frame; easing names and declared durations remain byte-identical
  unless the user separately approves a design change.
- [ ] Phase-synchronized keypoint trajectories remain inside the baseline
  median/MAD envelope; no isolated displacement/velocity outlier, teleport,
  phase reset, mid-motion pause, unintended overshoot, or terminal snap occurs.
- [ ] Motion has clear cause and rest: input response is immediate, moving
  surfaces retain visual weight and z-order, overlapping elements do not detach,
  and the final resting frame is visually stable.
- [ ] Day and night use identical action timing for control comparison, while
  each retains its accepted colors, blur, blend, assets, density and complexity.
- [ ] Inline SOLO visual-integrity review reports `Technical`, `Artistic/Craft`,
  `Motion`, `Model`, and `Plan` independently. `GO` is impossible while any
  relevant row is `FAIL` or `UNVERIFIED`.
- [ ] The user watches and accepts the final uncut videos. Agent judgment alone
  never changes user acceptance to PASS.

### 14.8 Architecture-reset protocol after the current STOP

- [ ] Recapture one exact failing journey with action timestamps, current
  LayerTree before/during/after, logcat warning window, and matching Perfetto app
  and display frame tokens. Do not start a product patch until this correlation
  exists.
- [ ] Produce `AGENT_CHANGE_NOTICE` with one evidence-backed root cause, exact
  Android-only files, expected layer/frame change, pixel-risk analysis, rollback,
  and the reproduction command.
- [ ] Obtain explicit user approval for that notice. Approval of this plan is not
  automatically approval of the product patch.
- [ ] Write a RED static/runtime contract that fails for the proven ownership
  error and protects canonical DOM order, full DPR, counts, blur, filters,
  timing/easing, accessibility and release WebView-debug boundaries.
- [ ] Change one architectural variable. Rebuild through
  `npm run cap:sync:android:benchmark` followed by
  `cd android && ./gradlew assembleBenchmark`.
- [ ] Accept the candidate for the full matrix only when the exact installed APK
  improves the matching Perfetto scenario, produces zero tile warnings, has no
  gaps `>100 ms`, and phase-matched visual captures remain within the frozen
  noise envelope.
- [ ] A new architecture cycle may test at most three mutually exclusive,
  trace-backed hypotheses. It may not repeat candidate23, candidate25, CSS
  fallback, negative z-stack, `desynchronized:true`, contained day canvas,
  blanket containment/promotion/transition changes, or any quality reduction.

### 14.9 Executable task sequence

#### Task 8 — Re-freeze current source and unblock authority

**Files:** modify only this plan and ignored `output/android-v2-motion/**` receipts.

- [ ] Re-run doctor, branch/HEAD/lock, staged fingerprint and dirty-path
  inventory; preserve the inherited worktree.
- [ ] Record the five decisions from section 14.2 with `APPROVED`, `DENIED`, or
  `UNVERIFIED` status and do not infer missing authority.
- [ ] Build a new source manifest; verify that rejected single-blur source is
  absent and no runtime injection/forward/app process remains.
- [ ] Reserve the next free baseline-only directory, then build the current
  pre-change source through `npm run cap:sync:android:benchmark` followed by
  `cd android && ./gradlew assembleBenchmark`; install, pull `base.apk`, and
  prove source/APK/install equality before any new user interaction.
- [ ] Freeze five phase-synchronized pre-change captures for every transition
  class used by the root-cause journey. This current-source baseline is the
  candidate comparison baseline; candidate20/24/25 remain historical diagnostic
  evidence and `13ca51a…e46` remains the canonical source reference.
- [ ] Verify a separate five-capture canonical visual packet for clean
  `13ca51a80d23220574deba762851fe5a32372e46`. If the packet is absent, create a
  task-owned read-only `git archive` source export under ignored
  `output/android-v2-motion/baselines/13ca51a…e46/`, add only manifest-bound
  benchmark instrumentation, and prove that instrumentation is inside the clean
  baseline noise envelope before using it. Do not reset or transplant files in
  the dirty worktree.
- [ ] Compare the current-source pre-change packet with the clean canonical
  packet. If it is already outside the accepted visual envelope, stop and obtain
  a user decision before treating current source as the design baseline.

#### Task 9 — Build fail-closed control and transition manifests

**Files:**

- Create `scripts/android-motion/build-control-manifest.mjs`.
- Create `scripts/android-motion/run-control-matrix.mjs`.
- Modify `scripts/android-motion/run-real-user-journey.mjs` and `.d.mts`.
- Modify `scripts/android-motion/evidence-lib.mjs` and `.d.mts`.
- Modify `specs/002-android-v2-motion-smoothness/contracts/android-motion-evidence.schema.json`.
- Test `scripts/__tests__/android-motion-evidence.test.ts`.

- [ ] RED: reject a manifest with an unexercised mandatory control, duplicate
  `controlId`, speculative coordinate, missing transition classification, or
  unexplained exclusion.
- [ ] GREEN: generate stable IDs from route/state/semantic identity, refresh
  bounds before every action, scroll only within current semantic bounds, and
  reconcile UIAutomator and DOM accessibility nodes.
- [ ] Emit route/state coverage totals and make the runtime gate reject any
  motion PASS when mandatory coverage is below 100%.

#### Task 10 — Capture exact correlated failure ownership

**Files:**

- Create `scripts/android-motion/correlate-motion-evidence.mjs`.
- Modify `scripts/android-motion/analyze-perfetto.mjs`.
- Test `scripts/__tests__/android-motion-evidence.test.ts`.

- [ ] RED: reject correlation when action time, device boot time, logcat warning,
  LayerTree snapshot and FrameTimeline token cannot be joined inside recorded
  uncertainty.
- [ ] Run the same drawer/theme action in separate visual, CDP and Perfetto
  passes on the exact new baseline APK.
- [ ] Produce one root-cause packet naming the owning surfaces/slices or retain
  `ROOT_CAUSE_UNVERIFIED` and stop without a product patch.

#### Task 11 — Approve and build one new architecture candidate

**Files:** only the exact owners named by Task 10, plus their focused tests and
benchmark build files already present in the repository.

- [ ] Write and obtain approval for `AGENT_CHANGE_NOTICE`.
- [ ] Record RED, implement one variable, record GREEN, run focused blast-radius
  checks, and review the product-source diff before building.
- [ ] Reserve the next free candidate directory without overwriting prior
  artifacts; build, sign, install, pull `base.apk`, hash and initialize ledger.
- [ ] Run the matching CDP, Perfetto and visual kill gates before any broader
  matrix. Reject immediately on visual mismatch, tile warning, `>100 ms` gap,
  context loss, ANR/crash, or performance regression.

#### Task 12 — Execute every control route-by-route

- [ ] Global shell and drawer matrix.
- [ ] Orb select/refine/Back/ambience matrix.
- [ ] Habits empty and authorized record-dependent matrix.
- [ ] Diary empty/transient-unsaved and authorized record-dependent matrix.
- [ ] Planning four-mode/timer/Back matrix.
- [ ] Settings five-module/theme/language/sound/reminder/privacy/dialog matrix.
- [ ] Re-run discovery after each state change; finish only with zero mandatory
  unexercised or unreconciled nodes.

#### Task 13 — Execute window, accessibility and lifecycle variants

- [ ] Complete Tier B and Tier C from section 14.5 on the same installed APK.
- [ ] Verify focus restoration, TalkBack-semantic target identity where a human
  accessibility session is available, reduced motion, RTL, IME, Back ownership,
  safe areas, rotation and split-screen.
- [ ] Prove one renderer/worker/loop and stable resources after five cycles.

#### Task 14 — Execute emulator and physical performance gates

- [ ] Complete API 26 functional smoke and API 36 diagnostic rows.
- [ ] On both physical devices, freeze three warmups/five-run baseline median and
  MAD before viewing candidate results.
- [ ] Run every critical journey without video/CDP during measurement; archive
  Perfetto/FrameTimeline/gfxinfo/environment evidence and invalidate contaminated
  repetitions.

#### Task 15 — Complete visual and human-eye review

- [ ] Review every uncut journey at 1× and 0.25× and inspect every input/transition
  frame-by-frame with timestamps.
- [ ] Produce phase-matched baseline/candidate and day/night boards for every
  transition class, not merely one screenshot per route.
- [ ] Run the inline SOLO visual-integrity rubric and retain independent FAIL or
  UNVERIFIED rows without softening.
- [ ] Present exact emulator and physical-device videos to the user and record
  actual acceptance or rejection.

#### Task 16 — Final convergence without publication

- [ ] Run focused tests, typecheck, lint, i18n, visual/canonical gates,
  `check:all`, PDI diff/bundle, Android benchmark build, manifest/signature and
  release WebView-debug checks.
- [ ] Triage changed-code Snyk/Security Suite findings; a terminal `403` remains
  `UNVERIFIED_PARTIAL`, and no scanner exclusion may be weakened for green output.
- [ ] Verify final diff/status/staged fingerprint/untracked manifest, secrets,
  real-data absence, test-only reachability, stopped app and empty CDP forwards.
- [ ] Check the older Task 4–7 roll-up boxes only after Tasks 8–16 and every
  mandatory coverage row are proven.
- [ ] Keep commit, push, merge, Play upload and release `STOP` until separately
  authorized after all quality and user-review gates pass.

### 14.10 Revision-2 done condition

Overall completion requires one exact installed candidate with:

- 100% mandatory semantic-control coverage and zero unexplained exclusions;
- every transition class reviewed at 1×, 0.25× and frame-by-frame;
- zero visual glitches, tile warnings, gaps `>100 ms`, ANR/crash/context loss,
  stale overlays or duplicate resources;
- all absolute physical performance gates passed on 60 Hz and 90/120 Hz;
- visual/noise parity, normal/reduced-motion and locale/window/lifecycle coverage;
- Technical, Visual Runtime, Artistic/Craft, Motion and Plan all PASS;
- explicit user acceptance of final media;
- no Git publication or release action unless separately authorized.

Until every item above is proven, the truthful overall state remains
`FAIL/UNVERIFIED/STOP`, regardless of build or test success.

## 15. Revision 3 — observed-defect root cause first, complete-app motion closure second

This revision clarifies execution order after the user's report. It does **not**
narrow final coverage to four scenarios. It makes those scenarios the shortest
causal gate before the complete route/control matrix in sections 14.3–14.6.
Revision 2 remains the authoritative coverage contract; Revision 3 is the
authoritative sequence. No executor may repeatedly polish the already accepted
Orb-select resting page while navigation, theme, Next/refine, Habits, Diary,
Planning, or Settings motion remains failing or unverified.

### 15.1 Two non-substitutable levels of work

**Level 1 — causal recovery:** reproduce and correlate the four user-observed
failures on one exact installed pre-change APK:

1. Open the drawer and choose a different route; capture the drawer-close,
   pending-route, old-page exit, new-page mount, and first stable frame.
2. With the drawer open, perform `paper → ink → paper` and
   `ink → paper → ink`; capture the drawer, scrim, background, route content,
   and theme-control surfaces throughout the change.
3. On Orb select, set valence through the semantic slider and press `Next`;
   capture pressed state, select teardown, refine mount, mini-Orb continuity,
   and first interactive frame.
4. On Orb refine, exercise every visible emotion control, semantic scroll,
   transient-unsaved note + IME open/close, UI Back, Android Back, and re-entry.
   `Save mood` and `Open diary` remain blocked unless disposable local record
   authority is explicitly granted.

Orb select at rest is only a frozen visual/control checkpoint. It is not another
optimization target unless a candidate changes it outside the baseline envelope.

**Level 2 — complete-app closure:** after one candidate passes every Level-1
kill gate, execute the complete semantic manifest from section 14.4 across:

- Global shell and drawer from Orb, Habits, Diary, Planning, and Settings;
- Orb select/refine, slider, scope controls, ambience, Next, both Back paths,
  and every reachable emotion/note action;
- Habits empty state, creation/template sheets, category controls, expansion,
  action sheets, and authorized record-dependent actions;
- Diary hub, tabs/rails, editor/toolbar, IME, calendar/search/filter/settings,
  dialogs and authorized entry-dependent actions;
- Planning today/schedule/focus/review, timeline/calendar, timer/miniplayer,
  sheets/modals, Back, background/foreground and restoration;
- Settings overview and every reachable account/appearance/sound/notification/
  privacy detail control, sliders/toggles, dialogs, language, theme and Back;
- every drawer destination from every source route, both theme roundtrip orders,
  normal/reduced motion, `en/ar/he`, portrait/landscape/split-screen, safe areas,
  rotation, lifecycle, IME and Android Back ownership.

No route is complete until discovery after semantic scrolling reports zero
unexercised mandatory nodes. Controls blocked by missing data or external-action
authority remain explicit `BLOCKED/UNVERIFIED`; they are never silently counted
as PASS.

### 15.2 Shared-cause hypothesis tree — evidence decides, not preference

The source and official platform guidance currently support these hypotheses,
in priority order:

- **H1 — simultaneous full-screen ownership:** drawer close, deferred route
  update, React transition/lazy mount, and old/new page/background surfaces
  temporarily coexist and exceed a compositor/tile budget.
- **H2 — theme-wide invalidation:** root theme mutation repaints retained
  day/night surfaces plus drawer blur/scrim/content in one window, producing the
  partial/stale drawer frames aligned with Chromium tile-memory warnings.
- **H3 — Orb Next/refine mount burst:** select teardown and the simultaneous
  mount of multiple `Bloom`, backdrop-filter, textarea/footer and mini-Orb
  surfaces compete with the persistent full-screen day composition.
- **H4 — multiple causes:** the four visual failures do not share owning
  surfaces or FrameTimeline signatures and therefore require separately scoped
  fixes. Similar appearance alone is not proof of one cause.

The native Android route path currently bypasses document View Transitions, and
element-scoped View Transitions are unavailable in WebView 133. Neither may be
used as a causal explanation or proposed solution without new runtime evidence.

For each failure, join one semantic action timestamp to:

- UIAutomator target identity and before/during/after UI trees;
- uncut video frame/time and three phase checkpoints;
- CDP DOM mount/unmount counts, computed visibility, active animations,
  LayerTree/surface ownership and canvas/worker/resource counts;
- logcat tile/context/ANR window;
- CDP-off Perfetto FrameTimeline app/display tokens, `AppDeadlineMissed`,
  `BufferStuffing`, RenderThread/WebViewFunctor and SurfaceFlinger slices.

If these cannot be joined inside measured clock uncertainty, root cause remains
`UNVERIFIED` and no product fix starts.

### 15.3 Candidate architecture boundary

After correlation, `AGENT_CHANGE_NOTICE` may propose exactly one reversible,
Android-only ownership change. Admissible directions are limited to evidence-
named owners, for example a persistent shell/background with a bounded content
swap, or a compositor-ready mount/commit boundary that prevents simultaneous
full-page paint. They are hypotheses, not pre-approved implementation choices.

The candidate must retain exact assets, DOM semantics, DPR, object/effect counts,
blur/filter/opacity, colors, durations, easing and Orb trajectory. Disabling or
shortening animation, reducing quality/effects, hiding content until later,
freezing a stale snapshot, blanket layer promotion/containment, or reusing any
rejected candidate23/25 approach is an immediate `REJECTED` result.

### 15.4 Strict execution gates

1. **Pre-change proof:** exact source/APK/install identity; one uncut video for
   each Level-1 scenario, reviewed at 1×, 0.25× and frame-by-frame; separate CDP
   and separate CDP-off Perfetto reproductions.
2. **Correlation proof:** one joined packet per scenario and an explicit H1–H4
   disposition. A warning or average FPS by itself is insufficient.
3. **Patch authority:** approved `AGENT_CHANGE_NOTICE`, one RED contract, one
   architectural variable, focused GREEN proof, diff review.
4. **Candidate kill gate:** exact new APK/install hash, zero tile warnings,
   context loss, ANR/crash, blank/stale/clipped frames or gaps `>100 ms`; no
   phase/keypoint visual regression; `AppDeadlineMissed ≤1%` where the physical
   gate is available.
5. **Complete-app semantic sweep:** every Level-2 route/control and every
   reachable state in sections 14.4–14.6; video is visual proof only, CDP and
   Perfetto remain separate measurement passes.
6. **Blast-radius and endurance:** drawer ×10 from each route, both theme
   roundtrips, cold/warm launch ×5, background/foreground ×5, rotation,
   split-screen, IME and Back; stable renderer/worker/listener/timer/memory state.
7. **Platform/human closure:** API 26 functional smoke, API 36 diagnostics,
   physical Android 12+ 60 Hz, physical Android 14+ 90/120 Hz, SOLO visual
   critic, and actual user viewing of the final uncut videos.

An early Level-1 failure rejects the candidate before the expensive full sweep.
A Level-1 PASS never substitutes for Level 2. Final status stays
`FAIL/UNVERIFIED/STOP` until both levels and the physical/user gates are complete.

### 15.5 Semantic automation must not contaminate motion

The first broad pre-change route-cycle proved that repeatedly launching
`adb shell uiautomator dump` is not an admissible motion harness. Each dump
registers a fresh `UiAutomation` service; the captured run contained
accessibility/system-server contention, 144- and 264-frame skips, and an HWUI
frame lasting 6266 ms. The visual symptom is preserved, but that run is
`REJECTED_CONTAMINATED` for performance and root-cause attribution.

- [ ] Move semantic discovery/action to one persistent `UiDevice` session in a
  Macrobenchmark/instrumentation companion. Do not poll by spawning a new
  `uiautomator` process per assertion.
- [ ] RED: reject any accepted motion run containing multiple UiAutomation
  registrations, missing action wall-clock times, a missing partial journey on
  failure, or accessibility-harness contention overlapping the measured window.
- [ ] Persist every action/checkpoint/inventory atomically as it happens so a
  mid-journey visual failure retains the exact last accepted state and action.
- [ ] Use UIAutomator only to identify and activate semantic nodes. Review video
  separately, and run CDP/Perfetto without UI-tree polling in their measured
  windows.
- [ ] Warm the persistent runner before the uncut visual journey and record its
  overhead envelope. Reject the run if the harness itself causes a deadline miss
  cluster or changes the visible app composition.

This preserves the user's requirement for real accessibility-node interaction
while following Android Macrobenchmark practice and preventing the verifier from
creating the jank it is meant to diagnose.

## 16. Revision 4 — AI visual-defect oracle and no-regression architecture boundary

This revision replaces “record every attempt” with a layered AI/runtime oracle.
It does not remove final human review or the one final uncut proof for each
critical journey. No individual metric can claim visual or motion PASS.

### 16.1 What the AI must detect

| Oracle | Detects | Cannot prove alone |
| --- | --- | --- |
| Semantic state | missing controls, wrong route, invisible click interceptor, stale drawer ownership, incorrect focus/Back | actual raster pixels or smoothness |
| Geometry/style rAF samples | partial mount, late pop-in, opacity/transform discontinuity, clipping, layout jump, z-order state | Chromium tile loss when DOM still says visible |
| Phase-aligned golden frames | color, typography, spacing, borders, blur, shadows, assets and static composition | temporal continuity between checkpoints |
| Perceptual differ | structural/JND-weighted differences using SSIM plus LPIPS/FLIP-style signals | product intent or artistic approval |
| Temporal differ | duplicate/stale frame streak, abrupt adjacent-frame perceptual jump, optical-flow/trajectory discontinuity, velocity/jerk outlier | root thread/surface cause |
| CDP LayerTree/paint | unexpected promotion, expanded raster bounds, full-screen invalidation, layer/tile ownership | actual Android presentation deadline |
| FrameTimeline/Perfetto | App/SF deadline miss, BufferStuffing, GPU/CPU cause, presentation gap and frame token | pixel correctness or user comfort |
| Visual-integrity critic + user | craft, human comfort, intentionality and final acceptance | physical performance without traces |

The accepted gate is the intersection of these oracles. A successful semantic
tap, one screenshot, average FPS, SSIM, LPIPS/FLIP, or model judgment never
promotes the run by itself.

### 16.2 Minimal-capture policy

- Do not record video for source inspection, unit tests, CDP diagnostics,
  LayerTree, Perfetto, or rejected micro-experiments.
- Reuse the exact immutable pre-change FAIL videos for baseline defect classes.
- During implementation, use action-anchored rAF samples and a small set of
  deterministic phase screenshots only when raster pixels must be compared.
- Record a new uncut video only after a candidate passes semantic, CDP,
  LayerTree and Perfetto kill gates, then combine many related controls into one
  journey instead of creating one video per button.
- Final video remains mandatory because native raster loss can contradict DOM
  visibility and a one-frame glitch can fall between screenshots.

### 16.3 Fresh Orb Next/refine findings

- [x] Added `capture-scene-transition.mjs`: two pre-window accessibility
  snapshots (cold WebView priming + semantic bounds), a 3-second settle and
  logcat clear, then zero UIAutomation registrations in the measured window.
- [x] Anchored samples to the actual WebView `click` event rather than mixing
  monotonic clocks from different Node processes.
- [x] Added fail-closed scene summary for first-visible time, complete-scene
  time, partial-scene duration, pop-in spread, missing selectors and
  post-settle disappearance. Fresh evidence tests pass `29/29`.
- [x] Exact pre-change APK/install SHA `8d7924…0693`: header/emotion visible at
  `289.8 ms`, note/actions at `405.7 ms`, mini-Orb at `1118.3 ms`; pop-in spread
  `828.5 ms`; zero tile warnings, skipped-frame/Davey messages, UIAutomation
  registrations, ANR, fatal exception or context loss in the action window.
- [x] Root cause narrowed to canonical mini-Orb startup: the forced-canonical
  120px renderer waits in the 900-ms mini queue and then cold-starts a fresh
  Worker/OffscreenCanvas while `MiniValenceOrb` keeps the entire chrome at
  `opacity:0` until a real canonical frame is published.
- [x] Candidate26 (`fe8037…9484`) removed the queue but retained Worker-first
  startup: mini-Orb `679.9 ms`, spread `665.8 ms`; `REJECTED`.
- [x] Candidate27 (`a634e7…e51d`) used the main renderer path: no mini-Orb
  canvas appeared within 5 seconds; `REJECTED`.
- [x] Candidate28 (`962734…84fc`) used a 200-ms staged Worker start: mini-Orb
  `982.2 ms`, spread `780 ms`; `REJECTED`.
- [x] Removed all candidate26–28 product experiments from source, retained the
  diagnostic tooling/evidence, re-ran focused canonical tests `104/104`, and
  restored the exact pre-change installed APK `8d7924…0693` before stopping.

### 16.4 Architecture reset after three rejected refine candidates

No fourth scheduling/render-lane tweak is allowed. The next approved cycle must
choose one design that removes cold renderer replacement rather than tuning it:

1. **One persistent canonical Orb presentation surface:** preserve one live
   renderer across select/refine and move/scale its presentation shell while
   proving phase, pixel, DPR and filter equivalence at both sizes.
2. **Reusable canonical renderer ownership:** retain one renderer/worker service
   and perform a verified target handoff without a second concurrent renderer,
   hidden full-screen surface, stale bitmap, Canvas/CSS substitute, or context
   leak.
3. **Scene commit after canonical readiness with continuous source surface:**
   keep the current live select Orb and controls responsive until the exact
   canonical refine surface is ready, then commit the established Bloom scene;
   reject if input latency, duration, pixels or user-perceived causality regress.

Before implementation, prototype ownership only in a focused contract/harness,
prove renderer/worker/context counts, and submit a new exact
`AGENT_CHANGE_NOTICE`. The drawer/theme problem is a separate architecture
packet: stable open-drawer LayerTree is `49` layers, `42` drawing layers and
`9.58644×` screen drawing area; the clipped outer 4px blur is already bounded,
so changing its clip geometry is rejected as an unsupported hypothesis.

### 16.5 Remaining global scope

- [ ] Correlate drawer route/theme failure with a persistent UiDevice journey,
  action clock, LayerTree changes and CDP-off FrameTimeline without video.
- [ ] Find the owner of the `9.58644×` drawer/day composition without removing
  blur, effects, DPR, layers that affect pixels, or motion quality.
- [ ] After focused architecture gates pass, execute every mandatory semantic
  control on Orb, Habits, Diary, Planning and Settings as defined in 14.4.
- [ ] Complete normal/reduced, paper/ink, `en/ar/he`, IME, Back, lifecycle,
  rotation, split-screen, API 26/36 and both physical-device gates.
- [ ] Only then record consolidated final videos, run visual-integrity review,
  and obtain actual user acceptance.

Current status remains `Technical FAIL`, `Visual Runtime FAIL`, `Motion FAIL`
on the API 36 emulator, `Artistic/Craft UNVERIFIED`, physical devices
`UNVERIFIED`, and overall `STOP`.

### 16.6 Persistent portal-host execution result

- [x] candidate29 (`b7d978…8ace`) preserved the exact APK/install identity but
  mounted `ValenceOrb` while its portal host was detached. The route stayed on
  the real loading surface, Worker/canvas counts were zero, and tile-memory
  warnings appeared. No semantic Next action was executed; `REJECTED`.
- [x] candidate30 (`3a481b…3aa2`) attached the empty host before mounting the
  canonical renderer. Focused Next evidence improved mini-Orb visibility from
  `1118.3 ms` to `256.5 ms`, reduced scene spread from `828.5 ms` to
  `291.2 ms`, and kept one Worker/canvas with no action-window tile warning,
  ANR, context loss, skipped-frame or Davey signal. However, after reparent it
  produced only one size-120 frame and stopped with `pendingRaf=0`; `REJECTED`.
- [x] candidate31 (`c30b40…ef14`) added an explicit post-reparent resume. The
  same Worker/canvas survived and focused Next kept mini-Orb first-visible with
  the header at `185.4 ms`, but the 30-second lifecycle probe recorded only two
  size-120 frames before `pendingRaf=0`. A later IntersectionObserver callback
  re-paused the renderer; `REJECTED`.
- [x] Applied the three-attempt systematic-debugging STOP rule. No fourth
  portal/reparent patch is permitted. The Android portal owner and its route
  integration were removed from product source; candidate ledgers and failure
  evidence remain preserved.
- [ ] Review a new unified same-parent layout design in which the canonical Orb
  never changes DOM parent and select/refine content/layout changes around it.
  This is a broader visual-layout change and cannot inherit approval from the
  rejected portal-host design.

### 16.7 Interaction-priority scheduling result

- [x] Recovered the post-API-error source state without resetting or staging
  anything. Fresh focused proof after the patch passed `ValenceOrb.motion`,
  `OrbPage` Next/refine and the six-file Android V2 motion set (`228/228`), plus
  typecheck, production-data-integrity diff and canonical-Orb checks.
- [x] Built candidate38 only after benchmark Capacitor sync, then
  `assembleBenchmark`. Host APK and the pulled installed `base.apk` both match
  `b023f2532b05bf5a7e9e2a0ed363bb37ad95fe53c5fff2535be614e2170c716b`;
  package/version are `com.zenflow.app / 2.1.1 / 38`.
- [x] Fresh CDP/LayerTree Next→refine run completed with no tile-memory warning,
  ANR, fatal exception, context loss, skipped-frame or Davey log message, and
  the installed SHA remained unchanged after the run.
- [x] candidate38 is `REJECTED`: immediate interaction-priority scheduling
  restored the mini-Orb that candidate37 failed to publish, but the first full
  refine scene still arrived only at `981.3 ms`; the partial scene lasted
  `768 ms`. This is slower than rejected candidate26 (`679.9 ms`) and proves
  that queue priority does not remove cold canonical renderer startup.
- [x] Stopped candidate38 before Perfetto and video under the minimal-capture
  policy. Immutable evidence and a validated ledger are under
  `output/android-motion-debug/2026-08-27-orb-interaction-priority-candidate-38/`.
- [x] Removed only the rejected interaction-priority product integration and
  its two narrow expectations without touching the retained resize/worker work
  or unrelated dirty paths. Fresh Orb/mini-Orb focused tests pass `149/149`.
  A further scheduling/queue adjustment is prohibited by section 16.4; resume
  the next independent active-queue packet.

### 16.8 Habits sheet and Android IME execution result

- [x] Added a narrow RED→GREEN regression proving an open Habits sheet owns
  accessibility interaction: `habits-page-content` becomes `inert` and
  `aria-hidden`, while portal-rendered sheet controls remain reachable.
  Focused Habits/form checks pass `69/69`; typecheck,
  production-data-integrity diff and canonical-Orb checks also pass.
- [x] candidate39 (`d7c00a…7350`) reproduced exposed background controls.
  candidate40 (`8f720d…6eb1`) verified the ownership fix through semantic
  UIAutomator actions, but selecting `Drink water` immediately focused the
  prefilled name and collapsed WebView/sheet geometry to `190/178 px`.
- [x] Added a RED→GREEN template-focus contract and changed only prefilled
  template focus policy to `autoFocus={!selectedTemplateId}`. candidate41
  (`965789…a986`) opened the same template with WebView `839 px`, sheet
  `827 px`, `scrollTop=0`, no IME, visible form controls and inert background.
- [x] A real semantic tap on the candidate41 name input reproduced the critical
  manual-focus failure: the retained delayed centered scroll moved the form to
  `-256 px`, placed the field behind the fixed header and aligned with
  tile-memory warnings and stale pixels.
- [x] Added a second RED→GREEN focus contract and removed the custom
  `setTimeout(300) + scrollIntoView(... center)` override without changing
  visual tokens, effects, durations or easing. Focused tests pass `19/19` and
  the full Habits/form set remains `69/69`.
- [x] candidate42 was built in the required order. Host APK, pulled installed
  `base.apk`, package/version and certificate match
  `a11071f04e0d166b00568b5bb8d30e72c7cdd5caa4965cf954238a08beb26fc8 / com.zenflow.app / 2.1.1 / 38 / c4a7cf3f…df75`.
- [x] candidate42 remains `FAIL`: after manual semantic focus, the active input
  initially stayed at `y=406…456` outside the resized `95 px` scroll clip; a
  later accessibility scroll could place it behind the header. Chromium logged
  13 tile-memory warnings and LayerTree remained `68/62` layers with a
  `40.18354` drawing-area ratio.
- [x] A diagnostic-only sheet-owner clamp made the input fully visible at
  `y=103…152` inside the `y=103…181` intersection without changing pixels, but
  compositor pressure remained. It is hypothesis evidence, not an installed
  source fix or PASS.
- [x] Applied the three-candidate move-on boundary. UV-018 preserves the exact
  evidence and forbids a fourth focus-timing tweak; continue the independent
  Diary packet while the combined scroll-owner/compositor design remains
  `UNVERIFIED`.

### 16.9 Diary navigation, empty editor, IME and Back result

- [x] Re-bound the exact installed candidate42 SHA before the Diary packet and
  after every accepted action window; package bytes remained
  `a11071f04e0d166b00568b5bb8d30e72c7cdd5caa4965cf954238a08beb26fc8`.
- [x] A semantic drawer→Diary action reproduced the generic navigation defect:
  the drawer remained visible with `Diary` highlighted, then Android logged
  `33/36/45/42` skipped frames and `1281/1379/1500 ms` Davey frames before the
  settled Diary page appeared. No second tap was used.
- [x] A semantic `New entry` action used an empty editor only and created no
  product record. The first captured state was an almost blank loading surface
  with a spinner; the editor controls became complete only in the later settled
  checkpoint.
- [x] The editor did not summon IME on open. A real semantic tap on
  `What's on your mind?` focused the expected `EditText` and opened IME without
  tile-memory warnings; LayerTree was `10/7`, drawing-area ratio `3.845899`.
- [x] The focused editor still `FAIL`s visual reachability: at
  `innerHeight=190 px`, the shell height is `190 px`, `--diary-keyboard-inset`
  remains `0 px`, and the scroll area and mobile Tools panel both begin at
  `y=138.76`. The active editor spans `y=122…382`, so almost all of it is
  covered by Tools/IME.
- [x] Android Back precedence is correct in the empty path: first Back hides
  IME while keeping editor controls; second Back returns to Diary without
  saving. No mock or real user record was created.
- [x] Preserved the packet under
  `output/android-motion-debug/2026-08-27-diary-editor-ime-candidate-42-run-01/`,
  appended validated candidate42 ledger run
  `candidate42-diary-navigation-editor-ime`, recorded UV-019, and moved to the
  independent Planning packet.

### 16.10 Planning route, modes and timeline compositor result

- [x] Re-bound candidate42 before the Planning packet and retained the exact
  `a11071…26fc8` installed SHA through navigation, page scroll and semantic
  Focus-mode activation. No event, task or focus-session record was created.
- [x] At `+2 s`, the drawer was still visibly open with a Planning loading
  spinner while UIAutomator already exposed destination controls including
  `View schedule`, `Add Event` and `Start focus`. No hidden destination control
  was tapped while the drawer owned the visual surface.
- [x] Drawer→Planning then logged `32/47/54/33` skipped frames and
  `1421/1718/1538 ms` Davey frames before the settled page. This extends the
  generic UV-015 route defect to Planning.
- [x] Attributed settled LayerTree proved a separate Planning root cause:
  `107/100` layers, drawing-area ratio `68.066002`, with the schedule horizontal
  scroller alone measuring `368928 × 315` physical pixels (`116.2M` pixels).
- [x] Source/runtime correlation is exact: `getExtendedDates()` returns 61
  dates and the scroll canvas width is `allDates.length × DAY_WIDTH_PX`, where
  `DAY_WIDTH_PX = 24 × 96 = 2304`; the resulting `140544 CSS px` surface is
  fully composited even though day-column DOM rendering is windowed.
- [x] A semantic `Focus` mode action completed without product data or a new
  critical log marker, and its timer UI was visually present. The unbounded
  timeline layer remained (`111/104`, ratio `68.313129`), so the performance
  kill gate stopped further timer/event interactions.
- [x] Preserved the packet under
  `output/android-motion-debug/2026-08-27-planning-modes-candidate-42-run-01/`,
  appended validated candidate42 ledger run
  `candidate42-planning-navigation-modes`, recorded UV-020, and moved to the
  independent Settings packet.

### 16.11 Settings navigation, Appearance, Back and Sound characterization

- [x] Re-bound exact candidate42 for the Settings packet. Installed SHA-256
  remained `a11071f04e0d166b00568b5bb8d30e72c7cdd5caa4965cf954238a08beb26fc8`
  through the final accepted Settings action.
- [x] Planning→drawer→Settings reproduced the generic route-visibility defect:
  at `+2 s` the drawer remained visibly open with Settings pressed while the
  accessibility tree already exposed Settings controls. The destination
  settled only after six Chromium tile-memory warnings, `84/78` skipped-frame
  messages and `1691/1564/1477/1358 ms` Davey frames.
- [x] Appearance opened semantically. At `+2 s` its controls were visible over
  a flat/incomplete day surface; the canonical day background appeared only in
  the later settled checkpoint. The completed reversible theme sequence
  restored its original `System` selection and exact installed APK SHA.
- [x] Android Back from Appearance returned to the Settings overview, but the
  `+1 s` checkpoint still showed the detail and HWUI recorded an `881 ms`
  frame. No tile-memory warning occurred in that isolated Back window.
- [x] Sound opened semantically and was fully visible at `+1 s` without a new
  critical log marker. DOM state was internally consistent, but Android's
  accessibility tree exported visually enabled switches as
  `checkable=false / checked=false` while the live DOM reported
  `aria-checked=true / data-state=checked`.
- [x] The already-completed `App sound ON→OFF→ON` characterization was
  reversible. Final DOM evidence proves `App sound=true`,
  `Background sounds=true`, `Activity sounds=true`, `Vibration=false`; its
  isolated log window contains no Davey, tile warning, ANR or context-loss
  marker. No further Sound, Reminders, Privacy, theme, account, sync or data
  control is authorized in this packet.
- [x] Tool boundaries are explicit: two emulator `screenrecord` MP4 attempts
  were invalid to `ffprobe`, Settings LayerTree emitted no accepted snapshot in
  two attempts, and one overlapping shell UIAutomator process failed because
  its automation service was already registered. These are
  `UNVERIFIED_TOOLING`, not ZenFlow crashes and not visual-video evidence.
- [x] Preserved the packet under
  `output/android-motion-debug/2026-08-27-settings-controls-candidate-42-run-01/`,
  appended validated candidate42 ledger run
  `candidate42-settings-navigation-controls`, and recorded UV-021. Candidate42
  remains `FAIL`; the full five-module/control/video matrix remains unchecked.

### 16.12 Safe static closeout and current STOP boundary

- [x] Focused Vitest rerun passed `4/4` files and `155/155` tests covering
  `ValenceOrb.motion`, OrbPage Next/refine, Habits sheet ownership and template
  focus behavior.
- [x] `npm run typecheck`, `npm run check:canonical-orbs`,
  `npm run check:production-data-integrity:diff` and
  `npm run check:no-ai-templates` all exited `0`. Production-data-integrity
  reported `errors=0`, `warnings=0`, `scanned=2126`, `reachable=803`.
- [x] Focused ESLint over the changed TS/TSX paths exited `0`.
  `npm run check:visual` also exited `0`: canonical Orb, 118 image/6 SVG brand
  assets, visual-regression guard (`0` findings) and V2 paper-theme guard all
  passed.
- [x] Scoped `git diff --check` passed for the changed source/test/plan paths.
  The candidate42 ledger validates with four runs and final SHA-256
  `0598e697e5dcb38b1886ce01ea8fca1741064544ad215b2d981875d821f9d5be`.
- [x] Inline visual-integrity critic returned `STOP`: Technical `FAIL`,
  Artistic/Craft `FAIL`, Motion `FAIL`, Model `UNVERIFIED`, Plan `PASS`.
  Candidate42 ledger completion now records `visualCritic=FAIL`.
- [x] Execution stops before the next product/architecture mutation boundary:
  UV-021/UV-015 require approved ownership design. Physical devices, a working
  continuous-video path and actual user review remain external/unverified.
- [x] The final live-install re-bind hit a fresh external gate: `adb devices -l`
  returned no attached target and `pm path` failed with
  `no devices/emulators found`. The last accepted Settings run retains exact
  before/after candidate42 SHA evidence, but the current live install is now
  `BLOCKED_EXTERNAL` (UV-022). No emulator or external process was restarted.
