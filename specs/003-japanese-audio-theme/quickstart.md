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
npm run check:app-audio -- --write-report
npx vitest run src/lib/__tests__/r7BackgroundMusicRestoration.test.ts scripts/__tests__/r7-audio-contract.test.ts
```

Expected for the 2026-09-09 restoration: exactly the ten original R7 MP3 hashes, natural 164–170-second playback, current decoded/loudness checks, no prohibited or retired music file, and the explicit human-review ledger. Do not regenerate music: the default procedural generator now produces only three ambience files and five feedback cues. Store release remains stopped until the exact-hash listening and other release gates pass. Earlier evidence sections below describe their historical artifacts, not R7.

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

The owner amendment at `2026-09-10T01:50:52Z` authorizes `com.zenflow.app` on Google Play Production for 100% of users. It supersedes the historical Internal-testing-only and repeat-confirmation instructions below. After the source/CI and artifact preconditions in `contracts/android-internal-release.md` pass, inspect the maximum uploaded version code, build and bind the signed AAB, submit the exact artifact, and read the resulting review/availability state. A submitted release is not necessarily available to users.

## Production Candidate Evidence — 2026-09-10

The same owner message explicitly accepts the proposed bounded 128 MiB integrity-checker budget and admits the three exact linked fireplace candidates. This is operational approval for these bytes, not evidence of listening duration, equipment or a formal perceptual review. Earlier fire rejection receipts refer to different artifacts.

- `VERIFIED`: fireplace Soft `af3033bf4e49c4623dfea15124d2fcab8d8213de35591785cdaef7985791032e`, Deep `ea59625628045952a2ccd8fac21278662c735e34e0e1cc01d97e3cccb5f234f1`, and Intense `bc7816cc301b44e70090583fe4236e7cdd1ca18e657d6f7447b2c98d0892fabd` match `docs/audio/fireplace-pagdev-provenance.json`. All ten R7 tracks and fifteen other nature loops retain their prior hashes. Source, processing, CC0 uploader declaration, decoded signal and loop metrics are recorded separately from human review.
- `VERIFIED`: integrity baseline 136/136; the new resource-boundary regression produced four expected failures before the implementation; the final focused integrity suites pass 142/142. Exact 128 MiB acceptance, 128 MiB plus one byte rejection, a late binary canary and late hash mutation are covered; the 8 MiB per-file, root/directory/file caps and full content/hash checks remain active.
- `VERIFIED`: final fireplace/catalog/cache regression run passes 134/134 in `output/fireplace-production-release-20260910/fireplace-final-green.json`. The audio checker also characterizes and fixes its existing multiline catalog parser defect without relaxing asset assertions.
- `VERIFIED`: the dev-only `smol-toml` lock entry was updated from 1.6.1 to the advisory-fixed 1.7.1. Both bounded EOF-comment hang reproductions pass after their pre-update timeout failures. The fresh npm audit reports zero vulnerabilities; this is not a blanket security guarantee.
- `VERIFIED`: the source-owned non-orb inventory was regenerated after the broad release run found stale source hashes and retired Planning reachability. Its generator, discovery rules and validation assertions are unchanged. Inventory coverage is 100%; this is not motion/runtime approval.
- `VERIFIED`: the fresh Play all-bundles view has maximum uploaded code 38, version 2.1.1. A Production draft is named `2.1.2 (39)` but has no uploaded bundle in that view. Source code 39 is therefore not yet used by a Play artifact. Recheck immediately before uploading.
- `VERIFIED`: final Android build/sync, `assembleDebug`, `testDebugUnitTest` and `lintDebug` complete successfully: 604 Gradle tasks, 57 executed/547 up-to-date, exit 0. Built and independently installed `base.apk` SHA-256 match at `1524e5f62cc578a6654c9cca0e83d70691c24386d1531122076ea69885396e71`; package `com.zenflow.app`, version 2.1.2/code 39, target SDK 36. All 28 selected audio files inside that APK match the source masters. This final-source debug APK supersedes the earlier `f1a87b09...` candidate; it is not a signed Play release.
- `VERIFIED`: real Android controls select Embers, Hearth and Full Hearth, each exposing the playing-state Mute control and loading the corresponding soft/deep/intense audio resource. Background R7 music remains paused at 100.429752 seconds while fireplace owns audio. Closing Hyperfocus restores the unchanged idle Focus screen and resumes that music at 100.458115 seconds; previous selects Shoji Rain (playing at 1.975775 seconds), next returns to Moss Garden (playing at 1.997147 seconds), both with no media error. No session was completed, no user history was added, no data was cleared, and device/Mac volumes and permissions were unchanged. The final process 9445 crash buffer was empty; that is not an all-app clean-runtime claim. The temporary read-only WebView forwarding port was removed afterward.
- `FAIL`, followed by verified correction: the broad preflight reached its last ratchet gate with 10,462 passing tests but counted the retained Planning workspace as a fourth oversized component. Its explanatory comment grew the original 400-line file to 401 lines. Four byte-equivalent helper implementations already existed in `planningScheduleUtils`; reusing them leaves a 362-line shell by the guard's line-count method, without altering JSX, behavior, thresholds or exemptions. The new regression first failed (33 passed/1 failed), then all 46 related tests passed. The final full preflight exits 0, including ratchet with three oversized components and score 9.2 at the unchanged 9.2 floor.
- `VERIFIED`: final `npm run ci:preflight` completes with 873 passing test files/one skipped and 10,463 passing tests/23 skipped/seven pre-existing todo cases, zero failures. Separate release-contract groups pass 374 and 650 tests. Coverage is statements 65.93%, branches 55.35%, functions 63.68%, lines 68.14%. Typecheck, zero-warning ESLint, eight-language i18n/translation guards, Web build/PWA-manifest validation, source/bundle integrity, artifact/size/audio/canonical-orb/RAG/completion/sync/schema and ratchet checks complete successfully. Oxlint reports 37 existing warnings; ratchet reports 70 diagnostic/missing-measurement warnings. Passing these guards does not certify unavailable runtime or public states.
- `VERIFIED`: final Web bundle is 95,163,432 bytes (90.755 MiB), 519 files. A complete source-plus-bundle integrity scan takes 3.08 seconds wall time, peak RSS 244,793,344 bytes and peak footprint 214,499,504 bytes; zero errors/warnings/baselines/waivers. The preserved `production-web-manifest-final.json` binds build inputs `76789e2c52be560bd0576dabd6b4e4864b6a63268e8432a9fc7caaaa4a254f30` and artifact inventory `9fe40b34f1f2fc67978558318b0015600a9fc1e4e1e856d2732cd88b460bbae0`. The extra `--diff` scan also passes. Android builds reuse `dist`, so this retained Web receipt identifies that particular completed build.
- `VERIFIED`: final Android public assets total 89,950,989 bytes (85.784 MiB), 237 files. The source-plus-native-bundle integrity scan exits 0 in 4.48 seconds, peak RSS 238,157,824 bytes and peak footprint 239,238,984 bytes; zero errors/warnings/baselines/waivers. The separate final `check:all` exits 0, including color and visual guards. Its ten color findings belong to unchanged `useAndroidDayLargeEffects.ts` and remain warning-only under the existing threshold; no threshold was changed.
- `VERIFIED`: after the separate owner authorization, the control `main` was advanced by `agent:workspace sync --apply --reviewed-sha fc6118fe924028512581084c119ccc2725b3fc99`. The post-sync doctor reports clean `main`, zero changed/ignored paths, zero ahead/behind and the exact authorized tip. The former `.codex/hooks.json` edit was preserved outside the repository; its backup and post-sync file both hash to `789a860519d98f7e143c825b09499d28caba6cc7df0963f36b901599abe4cbee`. The feature lane and legacy root were not synchronized or rewritten.
- `VERIFIED`: the earlier key search was too narrow. The existing `zenflow-upload-20260825.p12` was found outside the repository, and its adjacent public certificate was freshly compared with the live Play Console upload certificate. A scoped macOS Keychain lookup then allowed `keytool -list` to open this PKCS12 successfully: alias `zenflow-upload-20260825`, `PrivateKeyEntry`, SHA-256 `5D:55:3F:05:89:C5:B3:46:F5:3F:96:38:4D:E6:2C:06:F8:5E:37:BD:94:AB:1A:8F:55:EA:4A:7C:CB:4B:63:94`, exact Play match. The password was passed transiently through the child environment and not printed or persisted. The key was not generated, rotated, reset, modified or copied into the repository.
- `UNVERIFIED`: signed final-artifact binding, feature integration/remote CI and Play submission are not yet complete. The owner reiterated release authorization with the existing key unchanged. No new commit, push, merge, upload or rollout is claimed until its own receipt exists. The supplemental `memory/feedback_commit_pipeline_knowledge.md` reference could not be recovered from the known workspaces, personal instruction directories, Spotlight or tracked Git history; the current tracked `AGENTS.md`, workspace protocol and actual Husky hooks were inspected instead, without inventing or weakening a protocol.

Source evidence is under `output/fireplace-production-release-20260910/`; retained listening/processing originals remain in the private `fireplace-replacement-20260909` evidence directory. The final scoped security scan at `2026-09-10T03:00:10Z` returns the same 21 Snyk findings at identical rule/path/line identities as the preceding scan: twelve isolated test fixtures, eight translation labels and one BroadcastChannel listener whose next line checks the actual origin before parsing the event. Every finding line already exists in HEAD. No suppression or waiver was introduced, and scanner exit 1 is not called an unqualified PASS. Gitleaks, TruffleHog and Trivy exit 0; fresh npm audit reports zero vulnerabilities. Both integrity baseline and waiver ledgers are explicitly empty.

### Current Release Boundaries

| Target/domain | Current evidence and remaining boundary |
| --- | --- |
| Web/Vite | Final production build, shared audio/catalog/cache, full preflight and measured bundle integrity verified. Authenticated wide/collapsed/keyboard and public deployment remain `UNVERIFIED` (T106). |
| Installed PWA | Source/cache regression tests covered; installed offline/update behavior for cache v5 remains `UNVERIFIED` (T090/T106). |
| Android/Capacitor | The exact debug APK and bounded Focus/music/fireplace UI journeys above are verified. Final signed release, physical listening, calls/headset controls and fresh presented-frame timing remain `UNVERIFIED` (T107/T112). |
| iOS/WKWebView | Final three-fireplace revision sync/build/native playback and safe-area runtime remain `UNVERIFIED` (T090/T106). Earlier native evidence does not certify this artifact. |
| Desktop/Tauri | Shared source covered; final packaged runtime, scaling, media controls and wide/collapsed layout remain `UNVERIFIED` (T090/T106). |
| Store/release | Production 100% is authorized. The control main is clean at its authorized upstream tip, and the unchanged existing upload-key access and certificate identity are verified. Feature integration/remote CI and final artifact/submission evidence remain missing (T111–T113). Nothing has been submitted in this amendment. |
| Accessibility/performance | Current automated i18n/RTL/labels and bounded Android controls covered. Keyboard/screen-reader, other native safe areas, physical listening and fresh 103 ms proof remain `UNVERIFIED`; no canonical visual was downgraded. |
| Security/privacy/operations | Source/bundle integrity, exact ledgers and scoped scans are recorded individually. No new runtime dependency, account operation, permission change, remote audio request, history row or schema migration was introduced. |

The Android reminder-reconciliation warning appeared again after installation while notification permission was denied. Its cause is `UNVERIFIED`: this does not prove that the permission state caused it or that audio changes introduced it. Only the warning was dismissed; no Retry, reschedule, permission grant or notification-code change occurred.

A fresh Android hierarchy audit found no touch targets below 48dp, but its simplified text/content-description heuristic flagged the empty Focus label input. Read-only inspection of the actual WebView confirms its associated visible label, `aria-label` and Chromium accessibility-tree name are all `What are you focusing on?`, with `ignored: false`. No source change was made to silence the heuristic. Actual TalkBack behavior remains `UNVERIFIED`.

Visual Integrity Critic: **STOP for broad completion**. Inline read-only review of actual Android screenshots/UI is used; there is no independent subagent evidence. `Technical: PASS` for final local preflight and debug-build checks, not signed-release readiness. `Visual Runtime: PASS` only for the inspected Android Focus/menu/fireplace states. `Artistic/Craft: UNVERIFIED` for final owner perceptual acceptance. `Motion: UNVERIFIED` for fresh presented-frame and perceived quality. `Model: UNVERIFIED` (not applicable; no model/generated visual change). `Plan: PASS` for the authorized bounded implementation and explicit release gates, not for completed publication.

The inspected Android states retain readable controls, selection hierarchy and existing spacing without observed primary-content overlap. Missing wide/keyboard/other-native evidence, reminder root cause and exact signed release prevent a broad quality claim. Required next actions are final source/integration/artifact and store checks using the verified existing upload identity; do not infer publication or physical realism from build/decoder results.

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

## Original R7 Restoration — 2026-09-09

This section supersedes the historical collection and APK evidence above for the audio restoration only. Source is the existing `codex/android-103ms-20260904` lane at base `93b91e3833968e9a5af57ecba0474923e8f1d3a8` plus its uncommitted restoration patch. No commit, merge, publication, dependency, account/schema change, or new signed release artifact occurred.

### Original Identity And Playback

- `VERIFIED`: the ten unchanged R7 MP3s replace the former ten music files. All 50 copies across `public`, `docs`, `dist`, Android assets, and iOS assets match the retained original review MP3 bytes and declared SHA-256. The album is 67,022,840 bytes. Original MP3/WAV/FLAC sources remain untouched.
- `VERIFIED`: all eighteen Hyperfocus MP3s were already the correct originals. All 72 copies across `public`, `dist`, Android assets, and iOS assets match `hyperfocus-v2/runtime-masters-v2/audio`. Hyperfocus does not use the legacy `docs/sounds` mirror; no unnecessary duplicate or regenerated nature asset was added.
- `VERIFIED`: the installed API 36 emulator played all ten original music files in their intended cyclic order. The test sought the actual media element to 0.3 seconds before each natural end and observed the real next-track transition, advancing time, one player, and no media error. It was not full-track human listening.
- `VERIFIED`: real Android accessibility-tree inputs selected forest, rain, ocean, fireplace, river, and wind at Soft, Deep, and Intense: 18/18 decoded and played the exact selected file with `readyState=4`, advancing time, no media error, and music paused. Leaving the unfinished Hyperfocus session stopped nature and resumed music without completing a focus-history record.
- `VERIFIED`: the hidden `masterVolume * 0.18` music attenuation is removed. Selected volume feeds the existing fade controller directly; focused tests retain mute, zero, comfort, one-owner, cursor, and lifecycle gates. The real pause control held the position unchanged for about 24 seconds; resume advanced it. A short real Android Home/foreground round trip paused/resumed correctly. Calls, long background intervals, and physical-device listening were not tested.
- `VERIFIED`: runtime-audio cache v4 admits only the exact originals and retires only its previous named versions. Full-body, same-size corruption, and partial-response tests cover admission. Music remains intent-loaded, not startup precached. The default procedural generator writes only the existing three ambience and five feedback files.
- `UNVERIFIED`: comfortable listening volume. At 23:21 UTC the owner confirmed, "Музыка правильная, но слишком тихая". App volume was 100%; Android media volume was 5/15. Permission to test Android at 10/15 was requested and had not arrived when this evidence was recorded. Mac volume and original files were not changed. This recognition is not formal all-master, headphones, or device-speaker approval.

The twenty retired runtime/documentation music copies are recoverable from the private `audio-restoration-20260909/retired-assets/{public,docs}` evidence directory. No retained source original was deleted. The R6 Rainlit Chamber reference helped identify the collection but is not an eleventh R7 track.

### Current Verification

| Check | Result and boundary |
| --- | --- |
| Focused Vitest | `PASS`: 290 tests in 19 files, zero failures; independent R7 RED was retained before implementation. This is not a new full-repository Vitest run. |
| Original audio QC | `PASS`: exact inventories, hashes and decoding; ten R7 masters measure -18.01 to -17.97 integrated LUFS and -3.47 to -2.89 dBTP. All eighteen nature asset checks passed. Human listening and rights are separate. |
| Separate typecheck / lint / `check:all` | `PASS` from the restoration tree. Static visual/i18n guards do not certify rendered or artistic quality. |
| Policy and documentation guards | `PASS`: no-AI-templates, best-practices, task-completion, generated doc-counts and constitution check. Constitution remains proposal-only. |
| Web build / Android build / iOS sync | `PASS`: production web build, Android Capacitor sync and `assembleDebug`, and iOS Capacitor sync. iOS native build/runtime was not rerun. |
| Scoped Snyk Code and secrets suite | `PASS`: five changed first-party source files covered, zero Snyk results; gitleaks and trufflehog exit 0 on the same narrow scope. Full-app security is not certified. |
| PDI diff / bundle | `FAIL`, exit 2: `bundle aggregate byte limit exceeded (67108864): dist`. Current `dist` is 94,540,640 bytes, including 80,344,845 MP3 bytes. The 64 MiB aggregate guard, exclusions, and assertions were not weakened; original music was not compressed to hide the failure. This blocks release readiness. |

### Exact Installed Artifact And Retained Evidence

- Debug APK: `android/app/build/outputs/apk/debug/app-debug.apk`, 100,125,759 bytes; source APK and installed `base.apk` SHA-256 are both `7d1ef181218647be383df076eb58e67a921ae2a6849ca20fc548ac284dc288c4`.
- Package `com.zenflow.app`, version `2.1.2`, version code `39`, target SDK `36`, `emulator-5560`. The data-preserving update retained the first-install timestamp and signed-in app surface. It did not rerun backend sign-in or prove fresh server authorization. All 36 embedded MP3s match their current `public` source files.
- Evidence directory: `output/audio-restoration-20260909/`. `audio-tests-verified.json` SHA-256 `a8caf4681171f0629aa941c3792f5aefd3d91f403f7bc2ba7bf7756ebfdb49f9`; `nature-runtime.json` `53ab65c282826e27bec07a712abf81eb8292c723cfc0b924558fa4e85a552e09`; `music-sequence-runtime.json` `e1660a8c4c8dfa11425856a4f33f778cc2bc7cdc7d69a60f84412ae4d2235646`; `music-lifecycle-runtime.json` `2cca5f0c9114192c1bc25d483eb9d56b57a35cf4d5b4dba193b0fbdb86ec15b8`; `snyk-code-sarif.json` `9a04e2d02ebfc9373a1a7492360f5920e1d3824dbef96ddedd68761099396d94`.
- Latest decoded QC: `output/audio-qc/app-audio-assets-report.json`, generated `2026-09-09T23:17:33.848Z`. Build, lint, typecheck, check-all, PDI and scoped-security logs are retained in the restoration evidence directory. Earlier signed APK/AABs predate R7 and are not this restoration's release artifacts.

### Platform And Domain Status

| Platform/domain | Current evidence | Remaining boundary |
| --- | --- | --- |
| Web/Vite | Production build, original-copy/decode checks and local R7 control/source presence verified | Playback in the local preview remained gated by the existing app-audio-off state; audible Web playback and public deployment `UNVERIFIED` |
| Installed PWA | Shared v4 cache tests, whole-body/hash rejection and no-startup-album contract verified | Installed/offline runtime `UNVERIFIED`; source cache tests do not prove device storage/quota behavior |
| Android/Capacitor | Exact built/installed APK identity; 10 music and 18 nature playback; pause/foreground and ownership verified | Physical device, comfortable volume, calls and long-background behavior `UNVERIFIED` |
| iOS/WKWebView | Capacitor sync and every original music/nature copy verified | New native build, gesture/output/interruption and device runtime `UNVERIFIED` |
| Desktop/Tauri | Shared source and web build include the exact originals | Packaged desktop playback `UNVERIFIED` |
| Store/Release | No upload or rollout; honest original/AI provenance and owner selection recorded | `STOP`: PDI capacity error; formal exact-hash listening and legal/store clearance still pending; historical release gates remain open |
| Accessibility/i18n | No new copy, visible control, layout or gesture; existing mute/comfort and static i18n gates preserved | No new visual, RTL, safe-area, motion or artistic approval inferred from audio tests |
| Performance | One decoder and intent-only current/next loading retained; measured album/bundle sizes explicit | No fresh presented-frame, startup-memory or physical-device budget claim |
| Security/privacy | No remote model/audio call, production dependency, secret, permission, user record or schema introduced | PDI is blocked; narrow scanner results are not whole-product clearance |
| Testing/operations | Regression evidence, exact artifacts and recoverable old music retained | Guard-compatible larger-media packaging needs separate scoped authorization; no limit/exclusion bypass |

`Technical`: scoped audio/build checks PASS, overall integrity gate FAIL. `Visual Runtime`, `Artistic/Craft`, `Motion`, and `Model`: no new visual change or approval claimed. `Plan`: restoration implemented and Android-playback verified; volume comfort, broader platform runtime and release readiness remain open. Additional implied work protected future regeneration and stale-cache migration so the replaced collection cannot silently return.

### Subsequent Owner Feedback — 2026-09-09 23:30 UTC

The owner declined the proposed emulator volume change: leave the current level unchanged and make release audibility a separate acceptance requirement. No volume-up action was taken. The owner also reports having checked the nature sounds: all are satisfactory except fire, which is rejected as unnatural/illogical and needs replacement or a new candidate. This is a human-content failure for the fireplace family, not a reversal of the 18/18 file-identity and decoding result. Preserve the other fifteen variants. The same message requests a focus-only Planning surface with an optional small future-feature hint and previous/next music controls in the side menu. Those new behavior/asset changes are under design review, not included in APK `7d1ef181...` and not claimed implemented here.

## Focus, Music Transport And Fireplace — 2026-09-10 00:57 UTC

This supersedes the preceding design-review status for FR-053–FR-058 only. Owner approval is 2026-09-09T23:45:01Z. Source remains the existing locked `codex/android-103ms-20260904` lane at base `93b91e3833968e9a5af57ecba0474923e8f1d3a8` plus its uncommitted patch. No commit, merge, publication, dependency, permission, auth/schema, system-volume or canonical-orb change occurred.

### Implemented And Exercised

- `VERIFIED`: `PlanningPage.tsx` mounts only the existing FocusTimer and Hyperfocus entry. Former workspace code and tests remain in `PlanningWorkspace.tsx` and `PlanningPage.test.tsx`. Hidden schedule/review/mode calculations do not mount. Tests preserve record identity, loading, completion-boundary promises/rejections and minute callbacks. The optional future hint was omitted.
- `VERIFIED`: navigation has previous/state/next icons, cyclic persisted selection, explicit resume and one media element. Component tests cover collapsed stacking, 44px/48px targets, eight-locale action/state labels and the one-button auth surface. Pending fade/play effects are cancelled, including a rapid full cycle back to the same ID. A failing clock-origin regression led to using one animation-frame clock for fade timing.
- `VERIFIED`, Android: real accessibility-tree actions traversed all ten music files with Next, exercised Previous, paused, changed selection while off without playing, then deliberately resumed the selected file. Actual WebView media state confirmed file, decoding and advancing time. These short checks are not full-song listening.
- `VERIFIED`, Android: starting Forest during an unfinished Hyperfocus session paused music; closing stopped nature and resumed music. Opening/selecting nature before starting the timer correctly stayed silent. Android Home held the music position for about 38.8 seconds; foreground return resumed it. No focus session/history record was fabricated or completed for testing.
- `VERIFIED`, Android: English/Arabic/Hebrew Planning and light/dark drawer screenshots were inspected. Drawer buttons measure 48×48 CSS pixels and RTL directions match their labels. In-app reduced motion yields 0.01ms computed button transitions, not proof of frame performance. English, Paper theme and reduced motion off were restored; existing large text was retained.
- `VERIFIED`: 50/50 R7 copies in five roots match the original provenance hashes; 72/72 nature copies in four roots remain unchanged against the already-verified baseline. All 36 embedded APK MP3s match `public`. No fireplace candidate entered runtime.
- `VERIFIED`, source/tests: default app volume remains 30%, existing saved levels and mute/zero remain respected, and the provider applies the selected gain without the old 0.18 multiplier. Final emulator volume remains 5/15, app volume 100%; Mac volume is untouched. Comfortable release-device listening is `UNVERIFIED`.

### Verification And Artifact Identity

Evidence is under `output/focus-transport-fireplace-20260909/`. Failed attempts remain beside corrected runs and are not reported as final passes.

| Check | Result and boundary |
| --- | --- |
| Expanded Vitest | `PASS`: 645/645 in `blast-radius-clock-fixed.json`; V2 pages/navigation, music/coordinator/comfort and Hyperfocus. Prior 643/644 exposed the clock-origin defect; independent RED and final GREEN are retained. |
| Volume/R7 tests | `PASS`: 62/62 in `volume-contract.json`; overlaps the broader suite, not an additional unique-test total. |
| Separate types/lint and `check:all` | `PASS`: final logs include application TypeScript, ESLint, 3,647-key/eight-locale i18n/translation, colors, canonical orbs and static visuals. Existing color warnings remain explicit. |
| Music/nature asset QC | `PASS`: `app-audio.log` and `hyperfocus-audio.log`; identity/decoding/signal checks do not establish fire realism. |
| Scoped Snyk Code | `PASS`: seven relevant first-party source files, one SARIF run, zero findings. Not whole-product security clearance. |
| Web/native build | `PASS`: final Web build, repository Android-safe sync plus `assembleDebug`, and iOS sync. An earlier Web-to-native sync produced duplicate gzip resources; the existing `cap:sync:android` pipeline corrected the attempt without changing scripts/exclusions. |
| PDI diff/bundle | `FAIL`, exit 2: existing 67,108,864-byte aggregate limit; fresh final Web `dist` is 94,442,096 bytes. T089 remains open; limits/exclusions/waivers/assertions/original encodings were not weakened. |

Source and installed `base.apk` SHA-256 both equal `4fd7c51367f1944d5bdb2ebcae6c8ce66b11fd2a5b11c62339f3e2d027676a01`; APK size is 100,125,399 bytes. Package `com.zenflow.app`, version `2.1.2`, code `39`, min/target SDK 26/36, API 36 `emulator-5560`. Installation preserved the September 5 first-install timestamp and signed-in local surface. This is a debug artifact, not store delivery or fresh backend-login proof.

Source-inventory digest: `9cd4c569755b92df626b5d27b3e5e5757e1043c50993966582851c3fc76a481a` over 2,308 existing tracked/untracked nonignored files in `src`, `public`, `scripts`, package manifests, Vite/Capacitor config and three TypeScript configs. Method: SHA-256 of sorted `path + NUL + SHA256(contents) + LF` entries; supplements the base commit/APK binding.

`android-runtime.jsonl` SHA-256: `d85c55b9e744429d83b51edae54853afd24304a815d89a07c46a0552cb350b33`. Its first two records lack useful media fields and are not media proof. Later records separate music/nature from the existing static audio-unlock bootstrap, which reports media error 4; no blanket zero-media-errors claim is made. The helper reads state only. Temporary CDP forwarding and the owned Web-preview server were removed; the emulator and app session remain available.

Screenshot hashes: `planning-en.png` = `1e52c6d66fc72327851fddc6d96289bd5ad43623d78f9d25c004a7a98d827ff2`; `planning-ar.png` = `43ed164fcfb746abe72ef517e0b3b667c5dfb75e3708fa5d71826f51d4cf7100`; `planning-he.png` = `fe037c6830fc839a3c27e2b5aca73e12d4ad8cd05f4919c6707bad1e0962256a`; `drawer-en-actual-dark.png` = `903577af25b5cf23573a0c58c1fc0e9d5bf4c1df93a3dbc01a7b70e59bd5c00e`; `drawer-he-dark.png` = `f19c785a1a1867dc34e9c899f8d420a547e85b6b71d6d889f50dee53ce517dee`. The misnamed `drawer-en-dark.png` actually shows the light Paper palette.

### Fireplace Is Not Replaced

The private ACE-Step trial and three BigSoundBank-derived pilots were rejected. The AI trial has a full-scale peak, tail silence and strong diagnostic musical signals. Safe static gain leaves the recorded-source pilots too quiet, with insufficient distinction between Deep/Intense. The classifier is not a calibrated perceptual judge, and the assistant audio-input path was unavailable: none is claimed directly heard or perceptually approved.

Exact receipts and `review/rejection-decision.md` are retained under `/Users/yehor/Projects/ZenFlow/private-evidence/fireplace-replacement-20260909/`. Candidate ceich93 sound 263864 is documented as an indoor-fireplace recording under CC0, but the author warns of compressed-preview artifacts. Only the original WAV is suitable for the next review. Freesound still requires login after the registration flow; the original was not downloaded, credentials were not read and the agent did not create an account. T098/T099 remain open. Runtime admission requires a suitable exact-hash pilot and direct owner audition.

### Platform, Domain And Critic Boundaries

| Surface/domain | Current status |
| --- | --- |
| Web/Vite | Build and real one-button account-entry state verified. Authenticated Planning/transport, wide/collapsed rendering are `UNVERIFIED`: the production preview shows unavailable Google/Telegram sign-in. No auth bypass or invented account data. |
| Installed PWA | Shared source/build included; installed/offline/update behavior `UNVERIFIED`. Cache unit tests alone do not establish those paths. |
| Android/Capacitor | Debug installation and bounded UI/media/RTL/lifecycle checks verified. Physical listening, calls, native headset/system transport and fresh frame timing `UNVERIFIED`. |
| iOS/WKWebView | Source/audio copied by successful sync; native build, safe areas, playback/lifecycle `UNVERIFIED` for this revision. |
| Desktop/Tauri | Shared source/build included; packaged app, window scaling, wide/collapsed rendering and playback `UNVERIFIED`. |
| Store/release | No upload/rollout. PDI, exact-hash human audio/rights review and historical release gates remain open. |
| Accessibility/performance | Static i18n/component contracts plus Android ar/he and reduced-motion proof; browser keyboard/screen-reader and new 103ms/frame proof `UNVERIFIED`. No visual downgrade. |
| Security/privacy/operations | No new dependency, permission, user record, schema or external runtime audio call. Rejected media and generated Python caches remain private/outside source; originals preserved. Narrow scan is not whole-product clearance. |

Android also showed a reminder-reconciliation failure message on startup, locale changes and foreground return. It was captured and dismissed; notification code was not changed and no Retry/reschedule/permission action was taken. Root cause is `UNVERIFIED`; neither a pre-existing defect nor an audio regression is established without a paired reproduction. A separately scoped diagnosis is required before claiming all-app clean runtime.

Visual Integrity Critic: **STOP for broad quality/completion**, inline read-only review with no independent subagent evidence. `Technical: PASS` for scoped UI/tests/build; overall PDI `FAIL`. `Visual Runtime: PASS` only for inspected Android paths. `Artistic/Craft: UNVERIFIED` pending exact-revision owner review. `Motion: UNVERIFIED` for perceived/presented-frame quality; only reduced-motion computed style was verified. `Model: UNVERIFIED`, not applicable because no model/generated visual changed. `Plan: PASS` for the approved bounded amendment, not completed fireplace or release delivery.

Critic findings: brief fit, hierarchy, spacing, existing token style and observed Android controls are consistent; no primary text/control overlap was seen. Broad evidence remains incomplete for wide/collapsed and other native surfaces. Required next actions: original fire intake and pilot audition, authorized platform access for T102, and the existing T089 packaging decision. Additional implied protections cover off-state silence, cyclic/rapid-selection cancellation, ownership, RTL and record/callback preservation.
