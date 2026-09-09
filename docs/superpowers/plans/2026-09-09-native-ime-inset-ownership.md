# Native IME ownership investigation and repair

> For agentic workers: use `superpowers:executing-plans` inline. The owner requires continued work in the existing lane; do not create a worktree or delegate. This is a new evidence-driven boundary investigation, not a restart of the historical Android plan.

**Goal:** Remove the remaining Android keyboard painting defects without changing the canonical appearance, then finish the original verification and integration goal.

**Architecture:** The existing SafeArea owner now leases a stable, full-height WebView only to the Android phone editor. Measured IME overlap is reserved inside its opaque surface, with owner/page/destroy cleanup and the legacy path preserved elsewhere. A bounded caret observer and short-landscape reflow keep the existing controls and active line reachable. The earlier zeroing-only and animated-padding proposals below are rejected historical controls, not pending implementation instructions.

**Tech Stack:** Android API36 emulator, installed WebView133, Java, existing Capacitor8 SafeArea patch, native UIAutomator input, window-specific video.

**Spec:** `specs/004-android-interaction-budget/spec.md`, FR003/004/006/007/015–020. The owner's 2026-09-09 instruction explicitly authorizes reconsidering native ownership and fixing the glitches without visual regression.

## Final RTL checkpoint — 2026-09-09, 07:55 UTC

The unchanged installed `bed4cf97` APK now has fresh Arabic/Paper/Huge/reduced and Hebrew/Ink/Huge/normal docked portrait/landscape verification. Both actual compact probes pass all three geometry checks. Arabic nested sticker search releases/reacquires the editor lease; Hebrew Home/resume, zero-overlap floating handwriting and settled/scrolled expanded Tools are inspected. Eighteen observation receipts and referenced image hashes are independently checked, with transitional/setup failures explicitly excluded from acceptance. Original public and OS settings, Orb state, installed app/test APK identity and empty owned-forward state are restored. No production source changes.

This closes the exact-final RTL/nested/observed-floating repetition gaps, not T031's separate presentation criterion. Current frame diagnostics still FAIL, other-platform/human acceptance remains UNVERIFIED, and original integration gates remain open. The inline critic remains FIX. Exact matrix, hashes, exclusions and restoration: `output/android-103ms/keyboard-viewport-lease-20260909/FINAL_RTL_RUNTIME.md`. The 07:20 checkpoint below is historical and its pending RTL rows are superseded only by these actual new runs.

## Verification checkpoint — 2026-09-09, 07:20 UTC

The final prefix-follow-up APK is built and independently matched on emulator-5560: `com.zenflow.app`, 2.1.2/39, SHA-256 `bed4cf979b6115b662d92e6148d7501690502f12ee990699a726dce0a83d0e59`. Its 96-input manifest remains unchanged through the current captures and offline analyses. Three final clean editor recordings complete 12 hide/refocus cycles and decode 2,428 / 2,440 / 2,430 frames with zero dark-strip detections; every full-duration board was inspected. Exact-final English/Paper/Huge/normal docked-landscape, caret, Home/resume, portrait restoration and expanded Tools checks pass. The earlier RTL, nested-picker and floating-keyboard checks remain bound to their earlier APK, not relabeled as final-build runs.

The uninterrupted final `ci:preflight` exits 0 with 10,334 passing tests, 23 skipped and seven existing unfinished cases; the separate workspace/release suites pass 374/650 cases. The subsequent production-browser run passes all seven cases without retries or errors; normal and ar/he Huge screenshots were inspected. Existing oxlint and ratchet warnings remain. Final production-prefix and frame-capture/profiler scans pass within their recorded scopes. The later exact-source attribution and replay/isolation helper suites also complete with zero Snyk/secrets findings; details are in the current evidence packet.

Three clean navigation traces and three clean theme traces, each with 12 measured native actions, retain over-budget frames. Navigation app-frame maxima are 193.218/221.607/226.107 ms. Continuous Orb/theme display-interval maxima are 141.260/176.735/291.114 ms, with 4/7/9 intervals above 103 ms. All application display tokens match; static Planning idle gaps are not freezes, and end-truncated draw slices are not assigned zero durations. Native input matching does not prove semantic readiness or final interaction latency.

One complete, separate Chromium theme profile locates a raster/wait boundary: its 113.958 ms longest draw contains 93.727 ms of sync-token waits and 91.818 ms of contained RenderWorker command wall slices, versus 1.403 ms of WebGL commands. This is attribution, not clean timing or per-layer GPU ownership. The earlier over-cap partial profile is retained/excluded. No new production visual workaround follows from this result. At 07:08 UTC the same PID/APK is restored to English/Paper/Huge/normal Orb with no editor, menu, lease or veil; subsequent read-only layer inventories preserve identity.

T030 remains complete; T031 retains exact-final RTL/nested/floating repetitions and separate presentation acceptance. T009/T015/T018/T019/T023 and the fix-first all-branch integration remain open. Technical: PASS within the completed full CI/browser/native scopes. Visual Runtime: PASS for the stated editor cases, whole-goal UNVERIFIED. Motion: FAIL for current clean frame diagnostics. Artistic/Craft and Model: UNVERIFIED. Plan: PASS for the implemented boundary, not whole-goal convergence. Full trace hashes, exclusions, scanner scope, rollback and five-platform matrix are in `output/android-103ms/keyboard-viewport-lease-20260909/KEYBOARD_VIEWPORT_EVIDENCE.md`. This checkpoint is documentation-only after the captured 96-input snapshot; the implementation checkpoint and experiments below retain their historical scope.

## Implementation checkpoint — 2026-09-09, 06:00 UTC

T029's identical-app characterization supports the new boundary; T030's implementation and scoped regression checks are complete. Two final live native runs pass 18 tests each after correcting the per-test Activity lifecycle and proving the document-listener registration race. Current host coverage includes 29 lease/caret/compact-layout cases, exact native patch replay and the existing iOS/text-reflow neighbors. The production write set is the existing SafeArea Java/patch, `useJournalKeyboardViewport.ts`, `journalCaretVisibility.ts`, `JournalEntryEditor.tsx` and Android-lease-only rules in `src/index.css`. Existing canonical scenes, materials, labels, touch sizes, storage and dependencies are preserved.

Real ordinary docked landscape exposed a further geometry defect after the first caret correction: only 122.667 CSS px remained above the keyboard, less than the old fixed header and Tools panel together. The same controls now share a 51.286 px row only in that short, wide, keyboard-occupied editor; the 71.381 px content area keeps the active line visible. Portrait, floating/hidden keyboard and expanded Tools retain their previous layout. Actual Arabic/Paper/reduced/Huge and Hebrew/Ink/normal/Huge checks cover rotation, resume and control reachability; nested sticker search releases the lease and closing it reacquires it.

Benchmark `4a81d66c4a0fc7e4c99de86ec0d79f4d5a66320eae42523dcda2070f3f82f5da` is independently matched on emulator-5560. Three full recordings complete 12 hide/refocus cycles and decode 1,864 / 2,068 / 1,995 frames with zero dark-strip detections; all full-duration boards and crop alignment were inspected. This is scoped editor evidence, not the 103 ms gate. Native long-text composition, other engines/platforms and human craft approval remain unverified. Isolated current-observer browser checks cover all eight scripts, Enter, rotation and retained manual reading without writing production records.

The first full CI run exits 1 with 10,332 passing tests and two failures. Both follow-ups are corrected: the two warnings now use the existing finite `[Journal]` diagnostic code; the touch-size test selects the actual global Android control rule rather than the first Android rule, preserving all assertions and adding input/select/textarea coverage. The same 54 cases and 14 neighbors pass. Full CI is running again. This prefix-only change postdates the recorded APK and requires its own final packaging/verification; old video hashes are not transferred to new bytes.

At 06:09 UTC the exact two-file security follow-up completes with one Snyk run and zero findings; Gitleaks/TruffleHog report zero secrets. The second full CI attempt detects generated inventory drift after the warning change and is stopped (exit143), not accepted as complete. The unchanged generator refreshes the inventory to 1,152 owners / 56 exclusions / 803 candidate files and 100% discovery; focused revalidation is running. Documentation/constitution freshness checks pass. No test, threshold or exclusion was weakened.

T031 remains open for final build/browser/CI and separate presentation evidence. Original T009/T015/T018/T019/T023 and all-branch main integration remain open. The rejected conditional tasks below must not be replayed. Exact receipts, exclusions, restoration, rollback, platform matrix and inline critic are in `output/android-103ms/keyboard-viewport-lease-20260909/KEYBOARD_VIEWPORT_EVIDENCE.md`.

## Global constraints

- Keep `ValenceOrb`, `MiniValenceOrb`, existing backgrounds, blur, colors, density, motion quality and all prior source changes.
- Keep the existing locked `codex/android-103ms-20260904` lane at HEAD939daa7e117331ef75201cff3a2c74d314861be2. No reset, clean, shared stash, new branch or worktree.
- No new production dependency, permission, graphics-blocklist override, user record, auth/storage/sync mutation or keyboard-controller replacement.
- Four empty-field keyboard Back/refocus cycles are a diagnostic, not the103ms or physical-phone acceptance gate. Repeat actual app flows after an accepted production correction.
- Unknown native platforms, artistic approval and release remain explicit; no main integration before the requested repair is verified.

## Evidence before this experiment

The current source listener is `node_modules/@capacitor-community/safe-area/android/src/main/java/com/getcapacitor/community/safearea/SafeAreaPlugin.java`. Its tracked patch preserves the earlier floating-keyboard fix. `SafeAreaKeyboardInsetsTest.java` checks native padding and forwarded system-bar insets, but not forwarded IME insets.

Fresh original-fixture capture: `output/android-103ms/gpu-cpu-attribution-20260908.2GdUKi/editor-native-owner-baseline-20260909/`. Eight native actions completed on the original d6206fd8 APK; video SHA256de2e713f9e3871a6be07687674eab269b57f5f94873a11835069e9910e140137. All2239 frames decoded. The bounded detector flags six frames in four episodes; original frame `strip-13s037.png` visibly contains the exposed dark region. Neither its timing nor a passing native geometry test proves presentation acceptance.

Prior animated-padding, recursive redispatch and fixed-native-surface/CSS-height experiments were rejected by real output. They must not be silently reinstated. Current official [Android WebView inset guidance](https://developer.android.com/develop/ui/views/layout/webapps/understand-window-insets) says to zero dimensions already applied natively while continuing inset notifications. Its M139 visual-viewport behavior alone cannot explain a WebView133 defect.

## Task 1 — One-variable native ownership control

**Files:** `output/android-103ms/native-inset-owner-20260909/probe/`, `build-probe.mjs`, `record-probe.mjs`, `analyze-probe.mjs`.

**Interfaces:** The disposable `com.zenflow.renderprobe/.RenderProbeActivity` accepts `insetMode=legacy|zero-ime`; both modes retain the same static HTML/CSS, native padding, provider and APK. No JavaScript or network permission is present. The only rendering-input difference is:

```java
return new WindowInsets.Builder(insets)
    .setInsets(bars, Insets.NONE)
    .setInsets(WindowInsets.Type.ime(), zeroIme ? Insets.NONE : ime)
    .build();
```

- [x] Re-record and inspect the original unchanged fixture before adding the control.
- [x] Add the isolated two-mode fixture using the original manifest, CSS and disposable signing key.
- [x] Build with `node output/android-103ms/native-inset-owner-20260909/build-probe.mjs hardened`; retain source and APK hashes.
- [x] Run `node output/android-103ms/native-inset-owner-20260909/record-probe.mjs legacy-1` and `node output/android-103ms/native-inset-owner-20260909/record-probe.mjs zero-ime-1` sequentially with no scanner/build/profiler during either recording.
- [ ] Run the matching `analyze-probe.mjs` commands, inspect every selected suspect frame and the full-duration boards, and repeat a promising outcome before adopting it.
- [x] If zeroing does not remove the visible defect, reject it as this defect's remedy and keep production unchanged. Retain the result; investigate actual native/Chromium work rather than another unmeasured sizing workaround.

Task1 outcome: both modes retain a detected strip. The legacy recording has one suspect frame among2323; zero-IME has one among2339. The zero-IME original frame at6.158333s was inspected and contains the dark gap. The zeroing-only production proposal is rejected, and Task2's conditional implementation must not proceed on this evidence.

The recorder identifies the field from a fresh native UI tree, checks the installed fixture bytes before/after, verifies the existing main APK remains df17ccd6, and targets only the exact emulator window. Preserve the original handwriting setting `null`, hardware-IME setting0 and font-scale1.0; restore the temporary handwriting override after the experiment.

## Task 2 — Production gate after causal confirmation

**Possible write set:** the existing `SafeAreaKeyboardInsetsTest.java`, installed SafeArea Java and its existing patch-package file. No production write is authorized by a merely successful build of Task1.

The smallest candidate regression adds this assertion to the existing real-listener test helper, after forwarding actual synthetic inset values through `ViewCompat.dispatchApplyWindowInsets`:

```java
assertEquals(
    scenario + " must not forward keyboard overlap already handled natively",
    Insets.NONE,
    forwarded.getInsets(WindowInsetsCompat.Type.ime())
);
```

- [ ] Only after Task1 supports the hypothesis, run the unchanged existing docked/floating/hidden/version/landscape cases with that additional assertion and observe the expected nonzero forwarded IME failure before production editing.
- [ ] Refresh the existing feature004 clarification, checklist, analysis and governance evidence to the measured root cause; do not reuse the rejected animation candidate's token.
- [ ] Change only the existing listener's returned IME dimensions, retaining native clearance and update delivery; rerun the identical regression and neighboring Back/backdrop tests. If native zeroing is not the demonstrated cause, do not apply this candidate.
- [ ] Rebuild the exact production-equivalent benchmark, verify independent installed bytes and run the same real-app empty editor, floating/docked keyboard, Back/re-entry, normal/reduced motion, Arabic/Hebrew, large text, theme and resume flows. Reject missing controls, worse painting or changed accepted visuals.
- [ ] Run scoped Snyk/secret checks, application/tooling typecheck, lint, relevant tests and broad CI, visual/canonical/PDI gates, followed by separate CDP-off frame proof. Retain every FAIL and UNVERIFIED row.

Rollback is an inverse diff of only the new correction and a data-preserving reinstall of the retained benchmark/test APK; keep original fixture/evidence and all82 inherited source paths. A failing candidate is not committed as a repair. The original all-branch integration and platform acceptance remain open until their conditions are actually met.

## Task 3 — Raster attribution and stable-root control

`output/android-103ms/native-inset-owner-20260909/app-compositor-2/` retains the unchanged df17ccd6 real-app trace and40-second window video. Four native body-focus/Back cycles complete with a verified empty editor before/after and unchanged PID24378. The trace contains659031 events,129767270 bytes and no reported data loss. Trace SHA256: `eeb720e96a65816cadc8dd22c5780be4499fcc23a71387b47d2c10caa941ad01`. The longest DrawFn_DrawGL slice is117.631ms, containing102.451ms of sync-token waits; corresponding raster-command wall slices total90.272ms. These are instrumented slice durations, not CPU samples or103ms presentation acceptance. Layout's recorded maximum is3.736ms. `compositor-analysis.json` binds the calculation to the trace, recorder receipt and analyzer source. The first attempt correctly stopped before tracing because its empty-field check also selected the populated date input; it is not a successful capture.

The next fixture at `output/android-103ms/stable-root-ime-20260909/` keeps the WebView and opaque editor background at full height. It uses the real native keyboard overlap only as CSS padding inside the editor; the paper's minimum height tracks the remaining content space. The window uses adjustNothing. This is distinct from the rejected test that left native IME padding active while changing the shared CSS height on every animation frame. It does not recolor an exposed native strip or replace any application visual.

One APK (`a43489d6a767540c0881e7830c027e7034ff4dc070d40c3a835cd7cd1113b728`) contains both legacy and stable-root modes. Legacy1 has one detected strip frame among2333. Stable-root1 and2 have zero among2351 and2358, with all8 native actions completed per run. Both full-duration boards and the first-run30fps hide-transition board were inspected; this simplified fixture is not application pixel parity or complete motion acceptance. A fresh native tree shows the stable-root WebView remains `[0,136][1080,2339]` with the keyboard shown. No production source had changed at this historical fixture stage; the later implemented correction is described in the leading checkpoint.

Before considering a production correction, separate the two candidate mechanisms. `output/android-103ms/ime-adjust-nothing-20260909/` has an identical static no-JavaScript legacy/padding implementation in both modes; only the window's adjustResize/adjustNothing setting differs. APK: `a616ca765a9e84dbbbcecb6a2b94f72fecb5379ffe15aea402f8e6520a217ee7`. The first adjustNothing run still flags one strip frame among2369; its same-APK legacy control and direct suspect-frame review remain in progress. Do not infer that changing this flag alone repairs the app.

The adjustment-only control was subsequently rejected. The existing feature004 requirements/clarification/checklist/analysis and opt-in identical-real-app characterization then preceded the separate native/layout RED and production correction. Preserve the rejected candidates and all common native insets/Back tests. The simplified fixture alone did not authorize or verify the later implementation.

Security: exact eight new trace/stable-root diagnostic sources were scanned at `/Users/yehor/.codex/security/reports/20260909T022050Z-93800`. Snyk reports one informational `java/JavaScriptEnabled` item in the standalone trusted-page fixture; it remains an explicit finding, not a zero-finding PASS. Gitleaks and TruffleHog report zero secrets; Trivy has no Results and does not prove dependency coverage. The adjustment-only fixture is not yet included in this scan. No APK, signing key, recording or trace was sent to these scanners.

## Platform and domain matrix

| Area | Current scope and required proof |
| --- | --- |
| Web/Vite and installed PWA | Native lease is inactive; new CSS is Android-lease scoped. Current isolated browser caret checks pass; full route/installed PWA runtime remains UNVERIFIED. |
| Android/Capacitor | Native 18-case regression and recorded API36/provider133 benchmark editor checks pass in their stated scopes. Final-prefix APK and presented-frame acceptance remain open; other API/provider outcomes remain UNVERIFIED. |
| iOS/WKWebView and Desktop/Tauri | Existing iOS keyboard path and desktop editor remain outside the lease. Static iOS/reflow checks pass; packaged native runtime remains UNVERIFIED. |
| Accessibility and visuals | Preserve focus, all control geometry, safe areas, RTL, large text and normal/reduced motion. No blur or density reduction. |
| Performance | Inspect raster/wait boundaries separately from input-to-presentation; diagnostic video is not103ms proof. |
| Security/privacy/data | Empty isolated field, no app records/network permission; exact source scanner scope, no APK/key/user-content uploads. |
| Testing and operations | Before/after source/APK identity, bounded capture, actual exit codes, settings restoration and reviewed incremental rollback. |
| Store/release/integration | No remote mutation from this experiment. Full original fix-first integration requirement remains open. |
