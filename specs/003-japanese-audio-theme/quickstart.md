# Validation Quickstart

## Prerequisites

- Clean locked feature lane at exact `origin/main`.
- Existing dependencies installed from the locked package manifest.
- Android API 36 emulator available to Android MCP.
- No production user content or mock runtime records used.
- Release phase additionally requires owner-approved audio hashes, the existing upload key, and Play Console access.

## Planning And Static Contracts

```bash
.specify/scripts/bash/check-zenflow-constitution-status.sh --json
.specify/scripts/bash/check-prerequisites.sh --json --require-tasks --include-tasks
npm run doc-counts
npm run constitution:check
```

Expected: the constitution remains proposal-only, feature paths resolve, and tracked architecture counts are fresh.

## Focused RED/GREEN

Run the focused music generator/catalog/cache/provider/control tests and theme store/coordinator/toggle tests before and after implementation. The RED run must fail because the ten-master catalog, global provider continuity, icon-only contract, or transition coordinator does not exist. The GREEN run must pass those same assertions without weakening existing audio or drawer tests.

## Audio

```bash
npm run audio:generate-non-hyperfocus
npm run check:app-audio -- --write-report
```

Expected: exactly ten music masters, stable regeneration hashes, correct decode/loop/peak/RMS/DC/transient properties, no prohibited hash, and a pending human review ledger. Store release remains stopped until the owner approves each exact hash.

## Web And Cross-Platform

```bash
npm run typecheck
npm run lint
npm run test:release -- --maxWorkers=2
npm run check:all
npm run check:production-data-integrity
npm run build
npm run check:production-data-integrity:bundle
npm run cap:sync:ios
```

Expected: zero task-attributable failures. Browser/Playwright proves icon-only entry/navigation state, first-run silence, session continuity, theme round trips, reduced motion, RTL, mobile, and desktop geometry. Installed-PWA proof covers intent-bound cache and offline replay.

## Android

1. Build and sync the exact Android artifact.
2. Install it through Android MCP and compare the source APK hash with installed `base.apk`.
3. Use current UI-tree-derived inputs to exercise account-entry music, auth-to-app continuity, drawer music control, background/foreground, competing ambience, mute, and error recovery.
4. Capture one uncut emulator-window video of ten theme round trips and verify no partial/blank/stale frames.
5. Run a separate CDP-off Perfetto/gfxinfo pass for the same bounded theme journey.
6. Search fresh logcat for tile-memory, context-loss, ANR, crash, decoder, and media errors.

Expected: audible music verified from the emulator output path, one player/owner, correct icon states, no crash/ANR, no raster failure, and no theme-window gap over 103 ms. Human listening remains separate from technical playback proof.

## Release

After merge, inspect the Play maximum version code, bump above it, build the signed AAB from exact `main`, record its hash/signer, and upload only to Internal testing. Stop before rollout for action-time owner confirmation, then verify the resulting console state.

## Current Evidence — 2026-09-02

- `VERIFIED`: generated audio QC and exact provenance for ten masters; first-run-silent single player; one icon-only control; Android foreground pause/resume; Google OAuth sign-out, chooser, callback, and post-auth recovery; Android source/installed APK hash equality; iOS Capacitor sync and unsigned Simulator build.
- `VERIFIED`: the after-video contains intermediate luminance frames where the baseline changed palette in one step; no blank, stale, or partial frame was observed.
- `FAIL`: the absolute Android motion gate is still red. Repeated Orb theme changes retain Chromium `tile memory limits exceeded` warnings and Perfetto reports `App Deadline Missed` frames; this blocks a release PASS even though the warning count improved from the baseline.
- `STOP`: artistic listening decisions are `PENDING` for all exact master hashes. A signed Google Play artifact and Internal testing upload are therefore not authorized yet.

### Exact Android candidate

- Source and installed APK SHA-256: `27023c8605f573119cd02583856330aaef4b2a0056bddbfa8629df264b4351cf`.
- Package: `com.zenflow.app`; version `2.1.2` (`versionCode 39`); target SDK 36; API 36 emulator `emulator-5554`.
- Menu accessibility: 18/18 interactive elements labeled, zero visible findings at 48dp.
- Auth accessibility: legal controls pass the 48dp audit after scrolling them fully into view; the initial viewport intersects only part of their full hit boxes.
- Audio: one DOM player/control, decoded master time advances in foreground, stops in background, resumes when WebView becomes visible, and survives the Google sign-out/sign-in boundary.
- Clean continuous video: `theme-roundtrips-final-clean.mp4`, SHA-256 `4ca2e2b9ecf4d11f3d8e90b9aadc32b4a17cd61c6c50e4c207e02ebc475ebc4d`; no black interval; 12 presentation timestamp gaps exceed 103ms, versus 18 in the baseline.
- Perfetto: `theme-final.perfetto-trace`, SHA-256 `c0f99d61d2cf799779b73916123925320b06c4a08ed12b82e88103d3c0683491`; 665 app frames, 79 `App Deadline Missed`, 47 frames over 103ms, max 272.11ms.
- `gfxinfo`: p50 22ms, p90 65ms, p95 105ms, p99 150ms, 11.08% janky; 29 tile-memory warnings; zero observed context-loss, crash, or ANR signal.

## Native Theme Investigation — 2026-09-04

- `VERIFIED`: the latest installed candidate is APK SHA-256
  `c9538ce0adb07da6a4ac1ae848111eec67e802d38fb852570dbd715ec5ca3746`;
  its pulled installed `base.apk` has the same hash. Package/version remain
  `com.zenflow.app` 2.1.2 (`versionCode 39`) on `emulator-5554`.
- `VERIFIED`: the local Capacitor native cover, bounded color/timing contract,
  latest-request handling, lifecycle-cancel result, and CSS atomic-palette guard
  were developed through observed RED then GREEN Vitest/JUnit cycles. The focused
  suite reports 57/57 and the Android contract reports 2/2.
- `VERIFIED`: candidate `28af4fca` produced a 23.96-second, 525-frame continuous
  ten-round-trip video. A frame-board review found that the atomic-palette guard
  removed the earlier mixed light/dark card states; no Orb or layout change was
  introduced.
- `FAIL`: the native architecture does not pass the performance gate. Candidate
  `28af4fca` with WebView visibility cycling reported 43 gaps over 100 ms,
  FrameTimeline p95 240.23 ms, max 762.36 ms, and 328 tile warnings. Candidate
  `69088560` kept WebView visible and improved only to 34 gaps, p95 191.11 ms,
  max 997.87 ms, and 304 tile warnings. Candidate `c9538ce0` also removed the
  forced cover hardware layer but regressed to 39 gaps, p95 215.34 ms, max
  1026.49 ms, and 264 tile warnings.
- `FAIL`: the latest `c9538ce0` `gfxinfo` reports 125/928 janky frames (13.47%),
  p95 150 ms, p99 500 ms, and 125 frame-deadline misses. Crash, ANR, and context
  loss searches are empty, but the tile-memory stop condition remains active.
- `STOP`: after three native hypotheses, no fourth motion implementation may be
  layered on without an architecture decision. The code has not been committed,
  pushed, merged, or uploaded to Play.
- `FAIL`: the owner-approved scoped atomic selector candidate
  `bb28b11c81d1deeb15727d0bfeed4caad80fb6266aeeb0863d3d99c74256b04e`
  also misses the gate. Its local APK and installed `base.apk` match, but the
  first CDP-off run reports 32 gaps over 100 ms, FrameTimeline p95 155.32 ms,
  max 829.87 ms, 89 deadline misses, and 383 tile-memory warnings. `gfxinfo`
  reports 120/1000 janky frames and p95 150 ms.
- `VERIFIED`: trace slices align the long frames to native Activity
  `traversal`/`draw-VRI` waiting in `postAndWait` for RenderThread
  `WebViewFunctor::drawGl`, with repeated full 1080x2400 draws up to 755.99 ms.
  Adding/removing the cover as a child of the Activity decor therefore remains
  coupled to the underlying WebView surface and cannot isolate its repaint.
- `UNVERIFIED`: Play Console Android developer verification state cannot yet be
  read because the ordinary Chrome `Default` profile is running with the ChatGPT
  extension enabled, but browser runtime returns no claimable Chrome session.
  Incognito and isolated-browser state are intentionally not used.

## CSS Root-Repaint Investigation — 2026-09-04

- `VERIFIED`: the native plugin, child-decor overlay, and separate-window
  candidates are absent from the selected source. The exact retained CSS APK
  `8df60b23d7ac4d21bfc3668af362eea60add878a8e1b7fa9b61e3868b44a3ce5`
  was reinstalled through Android MCP 1.14.4 and focused
  `com.zenflow.app/.MainActivity` on API 36.
- `VERIFIED`: the FrameTimeline report now separates actual rows whose `dur` is
  over 103 ms from presentation timestamp gaps. Reanalysis of the retained
  `8df60b23` trace reports 58 actual long rows and 25 timestamp gaps; the latter
  is not a valid substitute for the former because it includes idle action
  spacing.
- `VERIFIED`: a CDP animation probe on the real Settings Appearance screen found
  about 140 active animations after the palette midpoint, including 124
  button/theme-choice transitions. A narrow runtime rule allowing only button
  `transform, opacity` during the atomic handoff removed the palette fan-out and
  retained the pressed theme-button transform plus the accepted ambient motion.
- `FAIL`: temporarily hiding only off-screen sections with `visibility:hidden`
  regressed the paired trace from 20 to 24 actual rows over 103 ms and increased
  deadline misses from 37 to 47. This experiment is rejected and is not in
  production source.
- `PARTIAL`: two narrow button-suppression A/B runs reported 13 and 18 actual
  rows over 103 ms, versus 20 in the paired baseline; timestamp gaps were 5 and
  7 versus 10, and tile warnings were 61 and 56 versus 91. The direction is
  useful but not a runtime PASS because maxima remained 733.80 ms and 663.11 ms.
- `UNVERIFIED`: clean absolute emulator performance. During these runs another
  active ChatGPT worker used roughly 150-160% host CPU, the emulator used over
  120%, and the largest WebView draws spent only about 6-21% of wall duration
  scheduled on CPU while sleeping for the remainder. A source-built APK and
  three uncontended confirmation runs are still required.

## Exact Source-Built CSS Candidate — 2026-09-04

- `VERIFIED`: Android-safe build/sync, asset pruning, release-artifact checks,
  JVM tests, and `assembleDebug` succeeded. The source APK and MCP-pulled
  installed `base.apk` are byte-identical at SHA-256
  `c06f6b2341abd04c7e51d4b0ad8e500fccfa9a458d52160babcdb60f9e022f14`.
  Package/version are `com.zenflow.app` 2.1.2 (`versionCode 39`) on API 36;
  the artifact uses the debug signer and is not Play release evidence.
- `VERIFIED`: three independent CDP-off Perfetto runs each executed ten
  semantic-tree-derived light/dark round trips. `framesOver103Ms` is 0/0/0;
  p95 is 23.18/24.45/23.12 ms; p99 is 52.90/64.64/57.49 ms; maximum is
  87.48/102.34/100.23 ms. `gfxinfo` p99 is 48/65/57 ms and reports
  1.29%/1.89%/1.47% janky frames.
- `VERIFIED`: all three fresh logcats contain zero tile-memory, crash, ANR,
  SIGSEGV, or WebGL context-loss signals. The five timestamp-gap rows per run
  are retained as diagnostics but are not misreported as slow-frame duration.
- `VERIFIED`: the direct-input continuous video is H.264 1080x2400, 19.576 s,
  837 decoded frames, SHA-256
  `ba4ba65fb9a39b9a67fa7ccd6d5c648a1f0d782b0034327392a3614787926c14`.
  Its contact sheet SHA-256 is
  `f2465308c93eafd022f14fa76347eaa69a7369736bd706ed612bfd00be3e489d`;
  local inspection found no blank, clipped, mixed-palette, or missing-content
  frame. Video encoder gaps are not used as a frame-performance metric.
- `UNVERIFIED`: direct human approval of the exact video. Technical motion and
  visual-runtime evidence is current, while Artistic/Craft and human-perceived
  Motion remain pending until the owner views that exact MP4.

## Exact APK Route, Audio, And Gate Smoke — 2026-09-04

- `VERIFIED`: Android MCP opened Mood, Habits, the password-locked Diary,
  Planning, Settings overview, Appearance, Sound, and Account on the same
  `c06f6b23...` install. The current activity remained
  `com.zenflow.app/.MainActivity`; the signed-in Account surface was present and
  destructive account/data controls were not invoked.
- `VERIFIED`: the drawer exposes one icon-sized music toggle with the accessible
  state labels `Pause evening music` and `Play evening music`. One real audio
  element played `/sounds/music/indigo-dusk.mp3` with `readyState=4`; time
  advanced, paused on the control, resumed on the same control, paused after
  Android Home, and resumed with advancing time after `MainActivity` returned.
  Android AudioService reported active `USAGE_MEDIA` focus for
  `com.zenflow.app` and unmuted speaker `STREAM_MUSIC`.
- `VERIFIED`: full Vitest passed 10,115 tests across 859 files with zero
  failures. `check:all`, release-contracts (358 workspace plus 635 release
  tests), production-data-integrity source/diff/bundle, canonical-orb, visual,
  i18n/RTL, sync (409 invariants), forward-only schema, Android/iOS artifact,
  and task-completion guards passed.
- `PARTIAL`: security suite. Snyk Agent, gitleaks, trufflehog, Trivy, Checkov
  GitHub Actions, and KICS completed with no task-attributable high/critical
  issue. Snyk Code reported 70 legacy findings with no changed-path
  intersection; Trivy reported three legacy medium dependencies. Terrascan exit
  4 was parser noise in dependency/old Playwright YAML inputs with zero policy
  violations. `npm audit` remained network-stalled for over three minutes and
  was stopped, so that row is `UNVERIFIED`.
- `UNVERIFIED`: Desktop Windows runtime because macOS has no MSVC `link.exe`;
  the 115-check desktop contract itself passed. Same-account Supabase sync is
  also `UNVERIFIED` in the otherwise passing Telegram sync drill.
