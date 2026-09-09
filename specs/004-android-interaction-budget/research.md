# Research decisions
- Explicit reduced-motion exit: DrawerV2 schedules 1000 ms despite disabled transitions; prior runtime reproduced over one second. Shortening the normal watchdog is rejected because Android compositor events can be delayed.
- Preserve surface sequencing: useNavigationV2 avoids overlapping heavy destination mount and drawer blur. Remove only measured extra waits; never mount a second hidden WebGL renderer.
- Separate latency and frame deadlines: https://developer.android.com/topic/performance/vitals/render applies to the Capacitor WebView; gfxinfo alone has limited coverage.
- Independent installed-before/after hashes: the audited local/installed APKs differ; copying an argument into both fields is not evidence of two reads.
- Existing npm run typecheck: the root tsc command examined zero files; the project configs already exist and are maintained.
- Rejected alternatives: global 100 ms CSS, native rewrite, orb quality reduction, new production dependencies and fabricated readiness. Approval resolves scope; actual phone performance remains an evidence gap.

## Native boundary research — 2026-09-09

Decision: test an unchanged full-height WebView and editor background with one inner content reservation for the actual IME overlap. This is a newly authorized native/CSS boundary investigation under FR-019/FR-020, not the earlier unapproved broad native rewrite.

Rationale: actual df17ccd6 editor trace/video retains missing strips; DrawFn_DrawGL's longest recorded 117.631 ms slice contains 102.451 ms of sync-token waits, whereas the largest recorded Layout is 3.736 ms. Those instrumented wall times locate a rendering dependency, not input-to-photon latency or hardware GPU cost. The same standalone APK contains a legacy strip and no detected strips in two stable-root captures totaling 4709 frames. The actual application must validate this boundary before adoption.

Alternatives: forwarded-IME zeroing alone retains a strip, as does adjustNothing with native IME padding. Animated native padding makes real-app gaps longer; the old fixed-height test retained native IME padding, unclipped ancestors and changed CSS height each animation frame, so it is not this proposed single reservation. No background suppression, blur removal, renderer degradation, native recoloring or graphics-blocklist bypass is acceptable.

Official [WebView inset guidance](https://developer.android.com/develop/ui/views/layout/webapps/understand-window-insets) supports zeroing already handled inset dimensions while retaining notifications. Its documented M139 visualViewport change does not explain the observed M133 failure. Therefore provider behavior and pixel acceptance must be observed, not inferred from the article. Current receipts: output/android-103ms/native-inset-owner-20260909/app-compositor-2, stable-root-ime-20260909 and ime-adjust-nothing-20260909. No business-data or external interface change follows from this experiment.
