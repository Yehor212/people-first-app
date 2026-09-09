# Android interaction budget

Owner-approved scope: ordinary navigation and finite control effects target at most **103 ms**, with Android phones first. This is an acceptance target, not a claim that current ZenFlow meets it.

## Local behavior and boundaries

`DrawerV2` retains its surface until normal transform completion. Reduced motion must release that surface without waiting for an absent transition event. `useNavigationV2` preserves request identity and waits until drawer removal has crossed a paint boundary before mounting a heavy destination. Reopening invalidates callbacks from the previous drawer cycle.

Android drawer CSS currently reserves route/presentation headroom with a 48 ms panel and entrance, 80 ms control transitions and no entrance stagger. These values are candidates whose actual interaction cost must be measured. They do not shorten breathing, continuous decoration, audio or canonical orb motion. Do not lower resolution, frame rate, shader quality, geometry or material fidelity to make a metric pass, and do not mount a second hidden WebGL renderer to warm a destination.

The five destinations are Mood, Habits, Diary, Planning and Settings. A module loaded into memory is not necessarily a prepared rendered screen. Separate module loading, data readiness, renderer preparation and screen presentation. Real loading/error states must remain honest; neither a URL change nor the pending badge proves readiness.

## Evidence required for an Android claim

Record one lineage: source commit plus dirty/untracked build-input hashes; build command/configuration; built APK hash; independently read installed-before and installed-after hashes; package/version/signing identity; device, API, WebView, actual refresh rate and thermal/power context. Both installed hashes must match the built artifact. Repeating one supplied hash is not two observations.

Measure activation to first visible response, destination readiness and final transition frame separately. Report p50, p95, p99, maximum, expected sample count, observed count and missing observations for each metric. A 104 ms maximum fails the 103 ms criterion even when p99 is lower. Missing observations are `UNVERIFIED`, never zero; malformed, negative or non-finite timings fail validation.

DOM/rAF observations are browser diagnostics. rAF runs before rendering; it does not prove the frame reached the display. A measured CSS duration proves configured timing only. Use real UI-tree-derived taps, independent video and frame-deadline evidence for device presentation. Do not record screenshots/video concurrently with the performance pass used to assess jank.

Phone acceptance requires a physical device and production-equivalent build, three warmed runs and ten repetitions of the worst flow. Cover normal/reduced motion × first/warm visits × five destinations, rapid selection/reopening, cancellation, Back, background/resume, IME, safe areas, ar/he and large text. Frame deadlines follow actual cadence: approximately 16.7/11.1/8.3 ms at 60/90/120 Hz. Emulator and debug observations remain diagnostic.

## Existing tooling

- `collect-source-evidence.mjs` binds build inputs; keep its manifest distinct from command-receipt output paths.
- `record-visual-journey.mjs` records separate `installed-before.json` and `installed-after.json` observations. Default capture starts from the current real UI, which must satisfy the selected journey. Optional `--prepare-route` uses the existing local benchmark setup and acquires port 9222 with `--no-rebind`; an occupied port stops that setup instead of replacing another owner's forward.
- Capture preserves shared logcat buffers, existing device recordings, app data and unowned forwards. It uses a unique recording path and removes that device copy only after a successful pull, nonempty local video and matching local/device SHA-256 readings before and after the transfer. A partial or failed pull retains the original.
- `collect-environment.mjs --schema-version 2` binds its envelope to the collector's device using `deviceKey` without recording the raw serial. `create-run-record.mjs` requires that binding to match both installation observations; an old envelope without it must be freshly collected.
- `create-run-record.mjs` requires `--source-apk`, `--installed-before` and `--installed-after`. It validates distinct observations around `--started-at`/`--ended-at` and includes their file hashes and the original environment-file hash in the artifacts. The legacy single `--installed-sha256` cannot establish a new record. Existing output files are never overwritten.
- `assertIndependentInstallationEvidence` checks observation identity, timestamps, package/version/device consistency and APK hashes. `summarizeInteractionSamples` checks the supplied timings against 103 ms; its result covers reported timings only.
- These local validators check consistency, not independent attestation of who collected a receipt. Historical schema 1/2 ledgers and structural parser success do not prove current phone performance. Retain original evidence and require reviewed runtime artifacts for the claim.

Run the focused DrawerV2/useNavigationV2/NavV2Orchestrator tests, `e2e/nav-v2-interaction-latency.spec.ts`, `scripts/__tests__/android-motion-evidence.test.ts` and the relevant checks in AGENTS.md. The deploy workflow also runs the five navigation/evidence/typecheck-control unit suites before building. The browser suite exercises shipped Android CSS in Chromium; it does not emulate Android's native bridge or compositor. Check the actual APK separately.

## Completion and other platforms

Report Technical, Visual Runtime, Artistic/Craft, Motion, Model, Plan and Release as separate applicable dimensions. Preserve `FAIL` for observed failures and `UNVERIFIED` for missing phone, artistic or platform proof. A static checker, successful build, screenshot or timing summary cannot establish the other dimensions.

Web/Vite and installed PWA share reduced-motion and navigation ownership code. Android-specific timings must remain scoped to Android. iOS/WKWebView and Desktop/Tauri need explicit regression/evidence rows; native lifecycle and store/release parity are separate from browser layout proof. No local performance result authorizes publication, installation on an unverified target, data deletion or a visual redesign.

## Sources and applicability

[Android slow rendering guidance](https://developer.android.com/topic/performance/vitals/render) explains frame deadlines and the limits of rendering diagnostics; it applies to ZenFlow's WebView/native composition rather than a CSS-duration-only score. [requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame) describes pre-repaint callbacks, which is why the browser regression labels its timing as diagnostic. [Perfetto FrameTimeline](https://perfetto.dev/docs/data-sources/frametimeline) provides expected/actual presentation evidence; missing WebView/GPU attribution must remain explicit.
