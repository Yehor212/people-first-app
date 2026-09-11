# Release 40 jank attribution and visual-preservation plan

> **Execution:** SOLO, inline in the existing locked Android lane. Continue the approved interaction-budget plan; do not create another feature, branch or worktree.

**Goal:** Attribute current Android 40 stalls and remove a reproduced source of unnecessary work only when the complete existing appearance and motion survive comparison.

**Architecture:** Preserve the existing navigation, native inset owners, canonical orbs and background renderers. Separate the production-payload baseline, instrumented attribution, visual comparison and uninstrumented presentation measurement.

**Spec:** `specs/004-android-interaction-budget/spec.md`, FR-003–FR-007 and FR-010–FR-020. The owner's 2026-09-10 request explicitly permits a visually identical optimization, not reduced quality or an unverified new release.

## Explicit requirements and boundaries

- Investigate users' jank deeply and retain the current visual in full.
- Do not lower DPR, frame rate, effect density, shader precision, geometry, blur, opacity, duration or easing.
- Examine 39-to-40 delivery separately; reupload is not an installation or performance fix.
- Preserve all app data, permissions, ad consent, original signing material and existing task processes. Never click ads or create business records during measurement.
- Current release source is `92c0a42c2278cce00082aa2160f5cfe22058a15f`; its AAB SHA-256 is `6939f2789472df6047d3d09f661a8359709b3839d642894322731f5753b5eee4`. The release-payload emulator APK has debug signing and SHA-256 `73e8b7ed491c2386780f5cef36ccbda575245f33e2499cbb7688e2411f6ecf0b`; it is not a Google Play-installed physical-phone artifact.
- Production code is unchanged at this plan's creation. Current lane is clean at `aa280705ac2eda85a98f10f68e73087724f55102`; workspace doctor returned GO.

## 1. Current-release characterization

**Files:** create only run-specific evidence under `output/android-103ms/release40-jank-20260910/`. Reuse `scripts/android-motion/perfetto-orb-65s.pbtxt`, `tap-visible-node.mjs` and `analyze-perfetto.mjs`.

- [x] Independently verify local AAB, local APK and installed APK; record package, PID, device/WebView, cadence, thermal context and current public UI preferences.
- [x] Record three warmed Paper/Ink menu journeys and three navigation journeys using native UI-tree-derived taps. Each trace uses 65 seconds, two warmup cycles and three measured cycles; no simultaneous video, CDP, build, scanner or decoding workload.
- [x] Bind input timestamps to actual FrameTimeline slices. Report missing events, deadline misses, p50/p95/p99/max and continuous-animation display intervals separately from static-page idle gaps.
- [x] Capture a separate emulator-window visual journey, with before/after identity and preserved log buffers. No screenshots or video during accepted timing runs.

Run each individual capture explicitly:

```sh
node output/android-103ms/release40-jank-20260910/capture-release-frames.mjs theme-1
node scripts/android-motion/analyze-perfetto.mjs --trace output/android-103ms/release40-jank-20260910/theme-1/trace.perfetto-trace --trace-processor output/android-103ms/isolated-emulator/tools/trace_processor_shell --output output/android-103ms/release40-jank-20260910/theme-1/analysis.json
```

Repeat with labels `theme-2`, `theme-3`, `navigation-1`, `navigation-2`, `navigation-3`; do not reuse an existing output directory. The baseline can fail 103 ms and must remain recorded as FAIL.

## 2. Attribute before changing production

- [x] Inspect the worst current-release input window and distinguish main-thread computation, layout/paint, raster/GPU-service dependencies and host scheduling. Guest CPU evidence is available; physical GPU and host-driver attribution remain UNVERIFIED.
- [x] For detailed WebView profiling, resolve the actual package PID/socket and acquire an unused forward with `--no-rebind`. Trace only the one reproduced action with argument filtering; preserve source and artifact identity, record data-loss status and remove only the owned forward.
- [ ] Establish layer ownership through actual DOM/layer identifiers or paint evidence. Never join unrelated client/server counters numerically or call a wall-time wait hardware GPU time.
- [x] Use reversible diagnostic controls and repeat the baseline. Grain/rim removal, hidden static scenery, hidden flourish, removed backdrop filters, root promotion and released flourish hints were examined. All overrides were restored; ablated images are not production candidates.
- [x] Apply the production-admission decision: no visually equivalent, repeatably faster candidate was proved. Production edits, a new APK and a new release are not admitted by these measurements. Any later candidate still requires its exact notice, RED regression, inverse diff and complete parity evidence.

## 3. Candidate acceptance and delivery audit

- [ ] Re-run the same focused regression, frame journeys and source/APK installation observations after a candidate change; reject worsening tails or lost observations.
- [ ] Compare fixed-phase buffers when available plus uninterrupted actual transitions. Cover Paper/Ink, normal/reduced motion, first/warm navigation, rapid reopening, Back/resume, IME, ar/he, large text, safe areas and desktop width. Identical source or buffer pixels alone cannot establish complete presented-motion parity.
- [ ] Run the applicable type/lint/unit/build, canonical-orb, visual, production-data, security and Chrome runtime gates. Keep native, human and release evidence separate.
- [x] Verify Google Play version-code/delivery rules from official sources and inspect ZenFlow's existing update hook/plugin. Read-only Console inspection found code40 on 100% production rollout and code39 recovery prompting available. The dialog was cancelled; no prompt campaign, rollout change, remote configuration or bundle was published.

The three candidate-acceptance rows remain open because no candidate was admitted. Fresh baseline checks are documented below, not substituted for candidate or cross-platform acceptance.

## Best Practices Packet and rollback

Implied work: bind every comparison to current 40, keep profiler/recording overhead out of timing, inspect update reachability rather than assuming upload forces installation, and preserve current data and rendering quality.

| Surface | Initial status and proof path |
| --- | --- |
| Web/Vite | Runtime unchanged; any shared candidate requires production-browser regression and desktop-width review. |
| Installed PWA | UNVERIFIED; no native result implies standalone/cache/lifecycle acceptance. |
| Android/Capacitor | Current code40 payload verified before/after all measurements. Six native runs FAIL the 103 ms target; 65-second baseline video inspected through 40 sampled frames. Physical-phone performance remains UNVERIFIED. |
| iOS/WKWebView | UNVERIFIED for candidate parity; native Android-only changes must remain scoped. |
| Desktop/Tauri | UNVERIFIED for native renderer parity; browser width is a separate proof. |
| Accessibility | Preserve current large text, safe areas, focus, Back and reduced motion; ar/he comparison pending. |
| Performance | Current code40 has 46 app FrameTimeline durations over 103 ms across 16,335 frames; all nine Diary entries contain a long frame. Detailed profiles identify raster-service waits, not final physical-GPU timing. |
| Security/privacy | No records, credentials, permission or consent mutation; bounded diagnostic metadata only. |
| Testing | Characterization precedes production; exact candidate regression and blast-radius checks follow an attributed cause. |
| Store/release/operations | Code40 was released previously; this task has not published anything. User installation and update-prompt reach remain separate evidence. |

Rollback: restore only diagnostic overrides/owned forwards and starting public preferences; retain original artifacts. Any production candidate uses an explicit inverse diff limited to its added write set. Never reset the lane, clear app data, weaken a test/guard or replace the canonical visual to obtain green output.

## Execution evidence, 2026-09-10

Local evidence root: `output/android-103ms/release40-jank-20260910/`.

- `native-action-analysis.json`: 72 matched DOWN/UP actions across six 65-second captures. Native frame maxima: theme 128.645/150.902/146.901 ms; navigation 178.476/260.755/217.865 ms. Planning static idle intervals are not stalls. One last theme-1 WebView draw is incomplete at the capture boundary and retained as missing, not zero.
- `navigation-2/scheduling-constant-sql.json`: the worst 230.406 ms WebView draw overlaps 226.791 ms of guest CPU execution by the GPU-service thread. App and renderer main threads mostly sleep; this is not proof of hardware GPU duration or the user's phone cause.
- `profile-*/analysis.json` and `diary-*/analysis.json`: 14 accepted argument-filtered profiles; one `display:none` static-background control is excluded in `exclusions.json` because it also changed canvas geometry. Large baseline variance prevents a one-sample ablation from proving an optimization.
- `baseline-visual/receipt.json` and `baseline-visual/review-vfr/index.json`: original video SHA-256 `db15e582ab66f8128ba88ab1cb502069bb08555bbab8509ea7a42f687b082725`, 3221 decoded frames, strictly increasing original timestamps, 16 settled plus 24 transition samples. A sampled Diary loading-to-list gap remains visible; full microglitch absence is not claimed.
- Fresh `npm run check:all`, `check:canonical-orbs` and `check:production-data-integrity:diff` completed successfully. The color checker still reports ten existing warnings in the unchanged Android renderer; its configured threshold is unchanged. These are static/source checks, not artistic or motion acceptance.
- Nine new local diagnostic helpers passed syntax checking. The narrow security suite scanned byte-identical source-only copies outside Git history. Initial Snyk SQL-interpolation warning was addressed with constant, explicitly materialized queries; all three scheduling results remain exactly equal. The second scan (`security-reports/20260910T145449Z-70554`) has zero Snyk/Gitleaks/TruffleHog/Trivy findings in that scope.
- The final clean-start doctor correctly returns STOP for this plan's single new untracked file. The original session entered a clean locked lane; no production edit uses a dirty-state override. Neither the user's legacy checkout nor active emulator/task processes were reset.

Overall execution is PARTIAL: current cause is narrowed and unsuitable candidates are rejected; the existing Android interaction-budget plan, visual/motion acceptance and physical-phone proof are not closed.
