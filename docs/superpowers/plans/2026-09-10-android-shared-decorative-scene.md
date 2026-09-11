# Android shared decorative scene implementation plan

> **For agentic workers:** Use `superpowers:executing-plans`, SOLO in the existing locked lane. Continue spec004; no new worktree, design-approval loop or private-page retention.

**Goal:** Remove reproduced Android scenery reconstruction during navigation, preserve the complete current visual, then publish only a verified qualifying update under the owner's 2026-09-10 release authorization.

**Architecture:** A navigation-scoped owner holds one empty host node. React renders only decoration into that constant portal target; each current page leases the host into its existing background location. A lease release detaches the host and pauses rendering. The page, journal records, lock state and editor still unmount normally.

**Tech Stack:** Existing React, TypeScript, Capacitor, WebGL2 and Testing Library; no dependency or asset changes.

**Spec:** `specs/004-android-interaction-budget/spec.md`, FR-003–FR-007, FR-010–FR-020 and the 2026-09-10 owner clarification.

## Global constraints

- Preserve DPR, effect count, geometry, colors, shader precision, opacity, blur and motion timings. No canonical orb changes.
- Palette is sampled once per route visit; a fresh visit starts the existing scene clock at zero. Theme changes within a visit retain current behavior.
- Exactly one decorative scene may be attached; no animation/draw while its lease is inactive. Final owner teardown releases all resources.
- Native Android ownership stays stable across phone/tablet breakpoints and rotation; it is selected by platform, not reactive width. Disabling retention preserves the page tree and disposes only decoration. Two new executed RED tests reproduce the pre-fix page reset; actual orientation proof remains required.
- IndexedDB remains local truth. No private records, unlock state, API result, loading state or business data enters the scene owner.
- Original page-owned path remains for Web/Vite, installed PWA, iOS/WKWebView and Desktop/Tauri. Their runtime status must be explicit.
- Source tests use `--exclude 'output/**'`: ignored source snapshots are evidence, not executable suites. No real tests or assertions are excluded.
- Baseline is release40 source92c0a42c, local payload APK73e8b7ed. Candidate identity and actual installation must be independently verified before comparison.

## Task 4 — Approved permanent-placement experiment, 21:12 UTC

The owner approved proceeding with the first proposed unconventional approach: leave decoration in one navigation-owned position. Exact static-texture caching is not combined with this experiment. Candidate-c remains the immutable immediate control, not a newly passing release. Its2378 inputs still match; nine affected existing files have recovery copies in `output/android-103ms/permanent-scene-20260910/before/`.

**Files:** `src/pages/nav-v2/CosmicSceneHost.tsx`, new `CosmicSceneHost.css`, `CosmicBgAdapter.tsx`, page-owned `CosmicSceneFlourish.tsx` and its Orb/Diary call sites, owner/adjacent tests and this spec004 plan. The CSS change is scoped to the anchored scene and makes only the corresponding Diary page shell transparent so it cannot cover its own background. No private Journal component is retained or rewritten.

**Interfaces:** `CosmicSceneHostProvider` adds optional `placement: "page" | "anchored"` and `sceneClassName: string`. Existing callers default to page placement. `RetainedCosmicSceneProvider` selects anchored placement only when enabled and the engine supports `anchor-name`, `position-anchor`, `anchor()` and `anchor-size()`; otherwise the candidate-c path remains. The empty page slot defines `--zenflow-cosmic-scene-slot`; the stationary frame follows its physical rectangle, preserving RTL, content height and safe-area geometry without a per-frame JS measurement loop. Its theme scope mirrors the original Orb/Diary scope. Readable veils remain local. Flourishes keep their page lifecycle but portal into the scene paint context; their mounted presenter owns the existing parallax hook. Anchored flourish has explicit z1 between static z0 and ready canvas z2, independent of portal append order. Legacy flourish stays at its original location/z0.

**F1 correction:** Independent read-only source review identified reversed transparent-canvas/flourish stacking in candidate-d. Main verified the concrete z-indexes, transparent GL clear and three alpha-blended passes. The exact first attempt and its12 native composition captures remain evidence, not an accepted visual. `flourish-red.json` executes11 tests with10 passes and one expected failure at the actual host containment assertion. Correct the decorative context only, then compare full native composition and new/cancelled page-owned parallax/meteor lifetimes before timing admission.

```css
.cosmic-scene-frame {
  position: absolute;
  position-anchor: --zenflow-cosmic-scene-slot;
  top: anchor(--zenflow-cosmic-scene-slot top, 0px);
  left: anchor(--zenflow-cosmic-scene-slot left, 0px);
  width: anchor-size(--zenflow-cosmic-scene-slot width, 0px);
  height: anchor-size(--zenflow-cosmic-scene-slot height, 0px);
  z-index: -1;
}
```

The native WebView133 accepts the required geometry primitives. A temporary empty, noninteractive probe under the real navigation root exactly matched the current Orb parent at x0/y0/412.19049072265625×839.2380981445312 CSS px and was removed in the same readback call. This is layout evidence, not visual or performance admission. [MDN anchor()](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/anchor) explains containing-block edge positioning; actual scene, scroll, clipping and raster-cache benefit still need native proof.

- [x] Run the existing owner/Day/navigation/Diary baseline before edits:60/60, `source-baseline.json`.
- [ ] Add and execute real DOM parent/connection RED plus capability, stale-cleanup and Suspense controls.
- [ ] Keep the constant portal target attached under the stationary frame; lease changes only switch active anchor and existing activity/visit state. On final teardown or disable, dispose decoration without remounting the private page.
- [ ] Run the same regressions GREEN, type/lint/data/visual guards and scoped source security. Expected assertion: `expect(scene.parentElement?.parentElement).toBe(initialFrame)` across page replacement and inactive state; page content must be absent after navigation.
- [ ] Build an independently identified candidate and compare actual native source/installed hashes, complete rendered background geometry/pixels, visit phases, inactive draw counts and uninterrupted transitions. Confirm Paper/Ink/reduced, ar/he/Huge, rotation/scroll/IME/Back/resume and capability fallback.
- [ ] Run independent CDP-off FrameTimeline measurements with no concurrent build/scanner/video. Preserve all failures; do not claim CSS connectivity guarantees compositor cache retention.
- [ ] Admit only if complete appearance is preserved and repeated native tails improve without weakening103ms. Otherwise apply the exact inverse of this Task4 patch, retaining candidate-c and failed evidence. Qualifying release and all other open acceptance gates remain unchanged.

Platform matrix: Android alone changes placement when supported. Web/Vite, installed PWA, iOS/WKWebView and Desktop/Tauri retain the original path; current experiment runtime proof is UNVERIFIED for every platform until run. No asset/model, shader, time palette, DPR, blur, easing, data, auth, sync, dependency, signing or permission change is authorized by Task4. Main executes this tightly coupled task inline; no parallel implementation or new lane.

## Task 1 — Ownership, pause and per-visit regression

**Files:** `src/pages/nav-v2/CosmicSceneHost.tsx`, `CosmicBgAdapter.tsx`, `DayCosmicBackground.tsx`, `useAndroidDayLargeEffects.ts`; `src/components/navigation-v2/NavV2Orchestrator.tsx`; existing adjacent tests and a new owner test.

**Interfaces:** `CosmicSceneHostProvider({children, renderScene})` provides `(slot: HTMLElement) => () => void`. `renderScene({active: boolean, activationKey: number})` returns decoration only. `DayCosmicBackground` gains optional `activationKey`; the rendering hook resets its clock without recreating GL programs.

- [x] Add real-navigation DOM/canvas identity regression, inactive nonzero-resize draw assertion, and new-visit palette assertion.
- [x] Run before production. `output/android-103ms/diary-scene-lifetime-20260910/source-red.json`:55 total,52 passed,3 expected failures,4 source suites.
- [x] Implement a constant portal host with empty page-owned slots. React manages only portal children; acquire/release moves the separate host. Token identity prevents old cleanup from releasing a newer lease.

```tsx
// A changed portal target would recreate the scene and its GPU resources.
createPortal(renderScene({ active, activationKey }), host);
```

- [x] Preserve Day DOM/canvas adjacency and ancestor geometry through `display: contents` wrappers; no guessed fixed height.
- [x] Feed active/visit changes to the existing GL controller; guard inactive resize/context restoration and reset only per-visit elapsed time and coalescing state.
- [x] Add StrictMode/teardown/stale cleanup, new-night-visit, non-Android and theme controls. Assert actual DOM identities and resource/draw counts.

```tsx
expect(screen.getByTestId("day-cosmic-background") === initialDay).toBe(true);
expect(screen.getByTestId("android-day-webgl-large-effects") === initialCanvas).toBe(true);
expect(screen.queryByTestId("diary-page")).not.toBeInTheDocument();
expect(initialCanvas.isConnected).toBe(false);
expect(gl.drawArrays).toHaveBeenCalledTimes(drawsBeforeInactiveResize);
```

- [x] Run unchanged regressions GREEN, separately typecheck and lint, then inspect the exact diff before native packaging. Candidate-c passes91/91 in seven source suites (`palette-extraction-green.json`), including all24 local-hour boundaries. The earlier six-suite67/67 receipt and initial awaited-Suspense harness failures remain retained. Typecheck and strict source lint separately passed.

```sh
npx vitest run --exclude 'output/**' src/components/navigation-v2/__tests__/NavV2Orchestrator.test.tsx src/pages/nav-v2/__tests__/AndroidDayCosmicBackground.test.tsx src/pages/nav-v2/__tests__/CosmicBgAdapter.androidVisualStability.test.tsx src/pages/nav-v2/__tests__/DiaryPage.background.test.tsx
npm run typecheck
```

## Task 2 — Native and complete-visual admission

**Files:** Existing Android build/measurement scripts and run-specific `output/android-103ms/diary-scene-lifetime-20260910/` evidence. No new renderer or relaxed measurement budget.

- [x] Build and independently match installed candidate; preserve data/preferences and never seed real storage. Candidate-c APK `74344ec36bd57805137623308a7a33d9b7a8304b0f12fe314d15a000626cb99b` matches actual installed bytes before and after native captures; all2378 build inputs match. This is a debug-signed benchmark native shell with the normal web payload, not a Play upload artifact.
- [ ] Verify one retained scene across Orb/Diary/Planning, inactive frame silence, new-visit palette/phase, cold/warm/error paths, Back/resume, Paper/Ink, reduced motion, ar/he/Huge, IME and actual geometry.
- [ ] Compare full fixed-phase background buffers and separate uninterrupted native transitions. Run CDP-off FrameTimeline captures without concurrent build/scanner/video work; reject lost observations, appearance changes or worse repeated tails.
- [ ] If loading-height churn remains, use fresh geometry evidence for the next minimal change; do not predeclare a fixed-height solution or cache private journal state.
- [x] Run full applicable CI, Chrome performance, canonical/visual/data and source security checks; obtain bounded independent read-only review. Main verifies findings and runs the visual critic. Current CI and14 Chrome route/profile cases pass; all8 existing Diary i18n scenarios pass. The critic remains STOP for the incomplete outcome and failed native budget, not a source/build failure.

## Task 3 — Qualifying release and closure

### Native finding and next bounded change — 18:38UTC

Candidate-a normal web payload APK `d44ffc232678b910e467632d439d6a69b04755fc8ac0433b6c971d3d05d1b233` matches the installed APK. Three native visits retain one Day/canvas/host; private journal shells unmount. The resource diagnostic creates three GL programs total, submits no daylight draw on inactive Planning and creates no new programs on reacquisition. Baseline creates nine programs for the same diagnostic journey. These are resource facts, not timing claims.

All12 matched daylight buffer PNGs are byte-identical to baseline40 at0/1000/5000/12500ms on Orb, first Diary and repeated Diary; dimensions, palettes and DPR2.625 also match. `candidate-a-daylight-parity.json` covers the afternoon WebGL layers, not every static/UI layer, motion frame, palette or platform. Temporary interception was removed and the document reloaded; it was never used in the timing run.

The separate CDP-off navigation trace still FAILS the103ms goal: three Diary max app-frame durations are134.878/217.376/175.346ms; completed WebView draw maxima116.192/111.591/115.888ms. Final buffer height still changes2202→2557 during each Diary entry. Do not infer acceptance or durable improvement from this single trace.

The next patch is Android page-only first-entry header continuity in `src/features/journal/JournalModule.tsx`, not an assumed fixed-height solution. Move the unchanged header JSX outside the first content-opacity entrance; retain the200ms content entrance, outer exit/inert boundary, later full-view transitions and every security/data gate. Non-Android paths remain original. No placeholder history or cached private content. Two selected tests gave one expected Android RED and one passing non-Android control; the full two journal suites then passed98/98. Settled geometry, real opacity/transition/video and repeated timing for the combined candidate remain required.

The notification-reconciliation warning after reinstall is also reproduced on the original baseline40; its cause is UNVERIFIED and it is not a newly established scene regression. Preserve the incident evidence and do not describe dismissal as repair.

### Release gate

- [ ] Reinspect live Play version/track and original signing/build pipeline. Increment from the verified highest code only after candidate admission.
- [ ] Build/test signed AAB, bind source/version/hash, submit the verified app/track under current authorization; no security-policy or paid-service changes.
- [ ] Reread Console status. Uploaded, submitted, approved and available are distinct states; report only the observed one.
- [x] Refresh generated counts/inventories as needed, review final diff/status and record platform, technical, visual, craft, motion, model and release statuses. Final documentation/agent/data checks and diff review pass; `CANDIDATE-REVIEW.md` records PARTIAL / RELEASE STOP. Physical-phone performance stays UNVERIFIED without phone evidence.

### Current admission result — candidate-c, 2026-09-10

T033 remains open and release is STOP. The final source change only extracts the unchanged local-time sampler into `dayCosmicMode.ts`; its function body and all other component statements match candidate-b. This keeps the existing400-line component guard intact. No shader, palette value, visual asset, CSS, native code, dependency, storage or auth behavior was changed by the extraction.

Full `ci:preflight` exits0:10568 tests passed,23 skipped and7 pre-existing unfinished cases; separate workspace/release-contract suites passed374/662. `check:all`, source/diff/bundle production-data checks, native assemble/unit/lint, scoped security and dependency audit pass. The final ratchet has3 large components against the unchanged3 limit,0 violations and70 existing/advisory warnings. Documentation counts are current; constitution criteria remain proposed, not ratified.

Native candidate-c retains one Day/canvas/host across three Diary visits, while private shells have distinct lifetimes. Three GL programs are created for the diagnostic journey instead of baseline40's nine; inactive Planning submits no daylight draw. All12 afternoon WebGL buffer PNGs remain byte-identical to baseline40 with matching geometry and DPR2.625. This does not cover all CSS layers, complete transitions, other palettes or human visual approval.

The fresh CDP-off navigation run completes12 measured native actions and links all1629 observed app frames to display frames. Seven app frames exceed103ms; the three Diary burst maxima are150.853750/161.001792/143.972000ms. No app frames or WebView draws are incomplete in this trace; the informational `traced_chunks_discarded=8` statistic remains in the evidence. Planning idle gaps are not animation stalls. Source/installed identity is stable, and no build, test, scanner, video or WebView profiler ran concurrently. This is FAIL for the budget, not proof of physical-phone latency or a durable before/after improvement.

The seven valid candidate-b height-control profiles do not establish a repeatable103ms repair; the failed scene-height capture is excluded and retained. No fixed-height or private-page cache was added. Candidate-b native ar/he/Huge, reduced-motion, empty-editor/IME/Back, sidebar/favorites/statistics and rotation checks have bounded evidence. Hebrew Huge calendar/landscape clipping remains a visual concern without an exact baseline40 attribution control. Candidate-c's notification-reconciliation warning reappeared by the post-trace restoration capture; its arrival time and causal contribution are unknown, and dismissal is not a repair.

The current evidence packet is `output/android-103ms/diary-scene-lifetime-20260910/CANDIDATE-REVIEW.md`. Browser and remaining platform evidence must keep their exact scope; none overrides the failed native budget. T034 has not begun: no version increment, signed release, new commit/push or Console write is performed while admission fails.

Browser follow-up:14 fresh Chrome route/profile cases pass with all readiness flags true and zero console/request/HTTP errors under unchanged strict settings. All8 existing Diary i18n layout scenarios pass. The main reviewer inspects settled Ink/Paper Diary at412×839 and1440×900 in the in-app browser; no horizontal page overflow is observed. An initial Paper frame predates miniature-orb readiness and is not a settled-frame pass. Installed PWA, iOS/WKWebView, native Tauri, physical phone, complete transition parity and human approval remain UNVERIFIED. These are local candidate checks, not a deployment.

## Sources, tradeoffs and rollback

[React createPortal](https://react.dev/reference/react-dom/createPortal) explains changed-target recreation; [React DOM refs](https://react.dev/learn/manipulating-the-dom-with-refs) defines the boundary for manipulating children React does not manage. The owned empty host/slot applies those constraints to ZenFlow decoration, not page content.

Retention costs one inactive GL resource set. Reject native memory/lifecycle or visual regression; DOM survival does not by itself prove Chromium raster-cache reuse. Rollback is an exact inverse diff, preserving original artifacts and all user data. Candidate and Console evidence are required for release success.
