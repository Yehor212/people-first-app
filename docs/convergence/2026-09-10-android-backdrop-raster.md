# Android rendering corrections — 2026-09-10

## Result and scope

**Primary signal: verified for the reproduced rendering defects; whole-device acceptance remains partial.** Native navigation is substantially improved, the portaled editor now animates its visible surface, and the Mood refinement form enters as one complete surface. This is not a claim that every reported freeze on a Redmi Note 11 Pro 4G has been eliminated. That phone was unavailable for a direct test.

Google Play Console confirmed production `2.1.2 (40)`. Its selected vitals reports provided no usable crash/ANR/rendering samples. Missing samples do not disprove the user's report.

The patch incorporates the existing Android shared-scene work already present in this checkout and the subsequent raster/transition corrections. The old main checkout's unrelated changes and the SukharevStarter checkout were preserved.

## Owning-layer corrections

- The Android navigation shell retains one decorative scene and its WebGL programs. Page content and journal records remain outside this owner; off-page rendering stops and per-visit palette/phase semantics remain intact. Unsupported CSS-anchor engines retain the original page-placement path.
- Scene release preserves the exact fractional layout rectangle, including the brief interval after anchor removal and before React commits the inactive state. Both CSS anchor-size fallbacks use those dimensions. This closes the observed zero-size/raster invalidation gap.
- The Paper static layer retains its paint dimensions. Diary waits for initial security and entry-storage layout readiness before acquiring supplied decoration; later refreshes do not remount it. Lock/error feedback remains immediate.
- Fully covered Android document gradients are omitted. Settings has a translucent shell, so its original opaque root backdrop is retained; boot/recovery fallbacks also remain.
- Mobile journal entry/exit motion belongs to the actual portaled editor. The active Diary list stays underneath, inert and hidden from accessibility while the editor is present; it becomes interactive after exit and is removed on lock/navigation. Its background keeps the same instance through the editor visit.
- Mood's step wrapper previously animated only exit while its incoming form had no shared entrance. Native recording exposed a rectangular field fill over the outgoing step. The incoming wrapper now owns the existing canonical Bloom entrance as well as exit; the reproduced rectangle was absent from the reviewed candidate frames. Reduced motion uses the identity variant. The existing synchronous scene overlap and inert outgoing controls remain.
- Android/package/in-app version metadata is aligned to `2.1.3 (41)`. The data-schema version is unchanged. The local pre-commit hook uses `lint-staged --no-stash` to honor the task's no-stash rule while retaining every validation command.

No shader body, palette, particle count, blur, DPR, FPS target, or production dependency was reduced or replaced.

## Local validation

- Regressions were observed failing before the anchor-size, readiness, Settings backdrop, editor handoff, and incoming Mood-step fixes. Journal/scene focused suites passed 127 tests; the final Orb page suite passed 48.
- `npm run typecheck` and `npm run lint` passed.
- The full local test run passed 10,583 tests and failed six fixture-setup cases in one hook-test file because PATH selected a minimal FFmpeg without `lavfi`. The installed Homebrew FFmpeg supports it. Rerunning that complete 32-test file with the corrected PATH passed all 32. Together these runs cover 10,589 passing tests, with the pre-existing 23 skips and 7 unfinished tests left explicit. No assertion or exclusion was weakened.
- After the no-stash hook adjustment, all 11 Git-hook contract tests passed.
- Six local Chromium cases passed: normal/reduced editor portal motion and retained inert underlay, exact anchor-release geometry, and Paper/Ink/OLED backdrop ownership including translucent Settings and shell removal/restoration.
- Source production-data-integrity, generated motion inventory, and documentation-count checks passed. The motion inventory was regenerated from source.
- Candidate O production-web build, Capacitor sync, bundle-integrity check, and Gradle `assembleBenchmark`, `testDebugUnitTest`, and `lintDebug` passed. All 2,380 tracked build inputs stayed equal during packaging.

Command receipts and private logs are under `output/android-jank-release-20260910/`; native evidence is under `output/android-103ms/firstpeople-cli-20260910/`.

## Native evidence

All measurements below used `emulator-5560`, API 36, WebView 133, English/Paper, text scale 1.5 and normal motion. Timing captures used native UI-tree-selected actions with CDP/video/build/test work disconnected. APK hashes, process continuity, native input counts/order and trace hashes were checked. The production-40 control is a store-bundle-derived universal APK; candidates use the normal production web payload in a benchmark native shell. This is emulator evidence, not final Play-signature or physical-phone timing acceptance.

| Scenario/artifact | App frames | Frames >103 ms | Maximum | p99 |
| --- | ---: | ---: | ---: | ---: |
| Production-40 control: Habits/Planning/Settings/Mood | 3,143 | 7 | 148.85 ms | 41.26 ms |
| Final O: same global navigation | 3,062 | 0 | 88.94 ms | 39.76 ms |
| N: Diary/Planning navigation | 1,513 | 0 | 87.04 ms | 46.98 ms |
| N: empty editor open/back, two clean runs | 7,640 | 2 | 152.32 ms | 75.68 / 76.47 ms |
| N: Paper/Ink/Paper theme changes | 3,872 | 5 | 113.81 ms | 37.80 ms |

The N editor and theme recordings had no presentation interval above 100 ms. Global/static-page idle intervals are not interpreted as animation stalls. App frame duration is not semantic input-to-final-presentation latency. The historical strict 103 ms all-frame gate is still **not met** across all scenarios.

N editor run 1 contained four additional non-ADB input events and was rejected as contaminated, not filtered into acceptance. A global setup attempt could not find the scrolled-off menu and stopped before recording; its fresh replacement is labelled run 2. An incomplete final WebView draw at the N global trace boundary remains in its report. O's app frames were complete and all linked to display tokens.

## Visual and functional review

Twelve actual N WebGL buffers matched immutable production-40 buffers byte-for-byte at the same dusk palette, dimensions and four phases on Mood and two Diary visits. Geometry also matched. Diary native scenery differences were at most one channel level out of 255. Mood's first native phase had a small larger difference (maximum 52, 0.070 percent of channels above 8); the other three phases differed by at most one. The pairs were visually inspected. These are scoped scenery comparisons, not whole-app pixel equality.

The final Mood entrance was separately recorded on O and reviewed against the defective N transition. Native inspection also covered global navigation, ordinary Paper/Ink theme changes, OLED Settings, the existing habit expander and empty custom-habit form, Planning, Mood refinement and its scrollable actions, and the empty Diary editor. Docked keyboard portrait/landscape captures kept the focused title and Tools control visible. Browser tests independently verified portal entry/exit and reduced motion.

No journal content, habit completion, mood record, account credentials or permission grant was entered as test data. Temporary keyboard and rotation preferences were restored to their recorded original values. Cold lazy-loading feedback remains explicit rather than fabricated content.

## Remaining boundaries and integration

WebView tile-memory warnings remain: nine during N theme changes and four during O global navigation. The bounded runs showed no matching native crash/ANR; these warnings are not claimed fixed. The recurring notification-setup warning also occurred on the original build and remains unexplained. The complete physical-phone, all-language, all-platform and semantic input-latency gates are not closed by this patch.

The owner explicitly authorized the four GitHub-required checks for PR 116 on 2026-09-11, as an exception to the active local-only task rule. The existing workflows run in build-only mode; site deployment is not activated. Main integration and store release still require successful checks. The first build job exposed an ENOENT race in temporary Git-fixture cleanup after lstat; cleanup now tolerates a disappeared entry through chmod/readdir while preserving every functional assertion and propagating other filesystem errors. No remote protection is weakened and no local status is presented as a hosted check.

Version 41 build/signing helpers are prepared separately. Benchmark APKs are not upload artifacts. Signed release identity, merged source, uploaded version and Play review/availability each require their own receipt.

Candidate O APK SHA-256: `06e0572b2261a081d5aa9d390a23b366d211c95fdc4b77cd565ce0421e16bbc2`.
Candidate O source-input digest: `48103213532d00a8ed44b564ab01dfe26879affad4246ed60e3deb4d44cc42a6`.
O global trace SHA-256: `ac9713d980c000e8e5c1027ab85b31d0485d0f4f8449325e2907e7ea57ecaeae`.

Compact receipts, the immutable control, selected comparison traces/images and the final candidate are retained for the pending integration and Redmi follow-up. Superseded diagnostic captures and verified copied device traces are cleaned separately; pre-existing evidence is preserved.

## Release-variant follow-up — 2026-09-11

PR 116 merged as `1fc0f73d9884b30f8c65750cde01c42479277956` after all four required GitHub checks passed. A release AAB and APK were built and signed with the registered upload certificate. They were held before upload when final release-variant measurements exposed additional tails: 6 of 3,020 frames above 103 ms (maximum 375.35 ms, including a late Mood burst), then 15 of 3,080 (maximum 142.26 ms). The late burst did not repeat in the second capture; its precise cause is not established. Earlier benchmark results are not substituted for these release observations.

A focused native probe found the global Paper grain fully covered on Habits and Planning: disabling its image changed zero pixels in the compared visible app region. Settings differs because its shell is translucent: removal changed some pixels by one channel level. The production follow-up therefore omits the grain only below opaque V2 shells and explicitly retains it for Settings, boot/recovery, other platforms and themes. The visible vignette is unchanged.

A broader temporary grain-removal diagnostic recorded 0 of 3,045 frames over 103 ms (maximum 87.38 ms). That diagnostic also removed Settings grain and is not the shipping implementation or final acceptance. The narrower source rule has a reproduced failing Paper browser assertion followed by four passing stylesheet cases, including preservation of Settings grain and shell-removal fallback. Final native validation must bind this narrower rule to its own APK.
