# Implementation Plan: Calm Music Collection And Soft Theme Change

**Branch**: `codex/japanese-audio-theme-transition-20260902` | **Date**: 2026-09-02 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/003-japanese-audio-theme/spec.md`

## Summary

### Approved Production Release And Bounded Scan Amendment — 2026-09-10

At `2026-09-10T01:50:52Z` the owner answered the separately presented 128 MiB PDI proposal and three exact fireplace pilots: “Разрешаю ! приступай к выпуску обновления ! для всех пользователей !”. This authorizes the reviewed checker work-budget revision, integration of those exact three files, normal reviewed commit/release steps in the existing SOLO lane, and Android Google Play **Production at 100%**, superseding older internal-testing-only/no-publication constraints below. It does not authorize unrelated changes or certify undocumented listening conditions.

1. Capture PDI baseline, then RED tests for clean 80/128 MiB bundles and final-byte canary/inventory mutation. Change only the code-owned aggregate limit to 128 MiB, tests and its policy; retain 8 MiB per artifact, root/directory/file limits, full byte/hash scanning and all exclusions/waivers/hooks/CI as-is. Repeat GREEN and source/diff/bundle scans with measured wall time and peak RSS.
2. Integrate exact owner-selected `fireplace-soft`, `fireplace-deep`, `fireplace-intense` MP3s from the private `pagdev-levels-bIVcPA` audition packet. Record source/licence and processing provenance, advance matching manifest/catalog/cache identities, add independent exact-hash regression evidence, and preserve ten R7 plus fifteen other nature assets byte-for-byte. The original source and rejected/private trials remain retained. Owner selection is documented; formal hardware/duration/listening observations stay UNVERIFIED unless actually provided.
3. Complete application/audio/integrity/security/build gates, verify the data-preserving exact signed Android artifact and release target, and submit the new unique version to Production for all users. Verify the actual Play review/publishing/availability state; submission is not publication. Preserve signing identity, existing account data, permissions and system volume. No paid service, dependency, extra branch/worktree or subagent.
4. Record Web/Vite and installed PWA public/offline verification separately. iOS/WKWebView and Desktop/Tauri packaged runtime/release remain separate explicit evidence rows; a shared-source or Android pass cannot certify them. Keep exact blockers open; never invent a pass to satisfy the release request.

Rollback is the reviewed patch and retained previous audio assets before publication; after submission use the supported release stop/update path as applicable. No reset, clean, uninstall, data clear or source-original deletion. The next sections are historical except where not superseded by this amendment.

### Approved Focus, Transport And Fireplace Amendment — 2026-09-09

**Goal:** US5/US6 in the existing locked lane. **Spec:** `spec.md`, FR-053–FR-058. Use `superpowers:executing-plans` inline and test first; no subagents, commits, new worktree, publication or dependency.

**Architecture:** Keep `PlanningPage` as the existing Focus host; extend `useAppBackgroundMusic`, its catalog and `BackgroundMusicToggle`. No new timer/audio engine/store. Fire candidates stay private until hash-bound audition. This amendment supersedes historical one-button navigation and immutable-fireplace decisions only.

**Global constraints:** Preserve ten R7 and fifteen accepted nature files byte-for-byte, current device volumes, all user records, master mute/zero, saved level, comfort, foreground-only and single-owner rules. No auth/schema/orb/guard changes. Existing PDI aggregate-budget failure under T089 remains a release STOP.

1. **Planning:** First add focus-only/zero-write/loading/RTL/callback assertions in `src/pages/nav-v2/__tests__/PlanningPage.test.tsx` and rerun `planningFocusTransferContract.test.ts`. RED then simplify `src/pages/nav-v2/planning/PlanningPage.tsx` to the existing FocusTimer with completion/minute props; remove hidden mounting/model interval. Existing non-focus components and data services remain. Replace obsolete page-composition assertions with the new contract; retain schedule/model/atomic persistence unit coverage. GREEN plus their blast radius is required.
2. **Transport:** Add `previous(): void` and `next(): void` to `AppBackgroundMusicControl`; add `getPreviousBackgroundMusicAsset` beside existing next helper. Extend hook tests for wrapping, persistence failure, off/muted/paused/other owner, rapid alternating clicks and stale play results. Exact examples: `expect(result.current.enabled).toBe(false)` after off-state `next()`; `expect(result.current.activeMasterId).toBe(last.id)` after previous from first. RED before production; then one cancellable fade/source boundary using a latest cursor ref plus revision, with an explicit paused-intent guard and no duplicate decoder. Rerun the same tests GREEN.
3. **Presentation/system controls:** Auth unchanged; drawer/expanded sidebar use three icon targets; collapsed sidebar stacks them. Preserve tokens, 44/48px minima, eight locale action labels, RTL icon direction, keyboard/focus and no tooltip/title. Optional `onPrevious`/`onNext` in `src/lib/audioMediaSession.ts` are set/cleared per owner. Test semantics/unsupported actions and retained auth first, then patch and run GREEN/typecheck/lint/i18n plus real viewport checks.
4. **Fireplace:** Use `/Users/yehor/Projects/ZenFlow/private-evidence/fireplace-replacement-20260909/` for one offline ACE-Step feasibility trial through the installed pinned R7 pipeline. Reject musical/vocal/artificial/non-hearth output; if unsuitable, verify a new licensed field recording before processing. Check decode, peak/clipping/silence, transient sharpness, low rumble, stereo and repeated-loop seams. Deliver an exact-hash pilot for owner audition. Only approved masters can change three fireplace assets and corresponding manifest/catalog/cache identities; all twenty-five unaffected file hashes must match. No technical or classifier result implies perceptual approval.

Verification: story RED/GREEN → existing Focus data and audio ownership/lifecycle/comfort/cache regressions → separate types/lint/i18n/visual/data-integrity/security → build → Web/Android light/dark, ar/he, safe area, narrow/wide/collapsed and actual media state. No fabricated user records in device tests.

| Platform/domain | Impact and proof boundary |
| --- | --- |
| Web/Vite | Shared UI/transport; production preview and actual media events |
| Installed PWA | Same UI, existing intent-only hash cache; installed/offline proof separate |
| Android/Capacitor | Rebuild/install without data clear; exact APK and UI/audio proof |
| iOS/WKWebView | Shared UI; native safe-area/audio remains UNVERIFIED until exercised |
| Desktop/Tauri | Shared wide/collapsed UI; packaged playback separate and currently UNVERIFIED |
| Store/Release | No external action; PDI packaging, formal audio and rights gates remain open |
| Accessibility | Eight locales, RTL direction, keyboard/focus, 44/48px, no hidden focus stops |
| Performance | One decoder/timer; remove hidden Planning computations, no album preload |
| Security/privacy | No remote user content, permission, dependency or data-model changes |
| Testing/operations | Exact hashes, RED/GREEN, scoped reverse patch, preserve originals/data |

Rollback only the amendment's reviewed task-owned patch and any integrated fireplace copies from retained originals. Never reset the dirty lane, delete source masters, uninstall or clear personal data. Comfortable release volume stays UNVERIFIED without actual listening; the removed 0.18 multiplier must not return.

### 2026-09-09 Audio Restoration Amendment

The earlier synthesis plan below is historical for the replaced collection. Implement FR-047–FR-052 in the existing locked Android lane; do not repeat theme, auth, release, branch, or dependency changes. Current source inspection found zero R7 hashes in runtime music, a hidden `masterVolume * 0.18` multiplier, and all eighteen Hyperfocus runtime MP3s already identical to `hyperfocus-v2/runtime-masters-v2` originals.

Use new `r7-` prefixed music IDs and paths, preserving each 48 kHz stereo 320 kbps MP3 exactly (164–170 seconds; approximately 67 MB total). The master volume feeds the existing single-player fade controller directly. Preserve the existing natural-end/next-track flow instead of forcing a 150-second seamless loop. Retire only the former music files from `public` and `docs`; private originals and all non-music assets remain unchanged.

The existing catalog and intent-cache contracts receive the same exact ten filenames, byte sizes, and hashes, checked against an independent original-receipt regression. Advance the dedicated runtime-audio cache version and retire its prior version without clearing unrelated caches or personal data. No music enters startup precache. Extend the QC checker with an explicit R7 provenance/signal profile; retain all corruption, clipping, silence, exact inventory/hash, non-music, and release-review checks. Keep the historical Cloudlight signal checker and adversarial tests; do not apply its different duration/loop composition criteria to untouched R7 originals.

Constrain the procedural generator's default write set to the existing three ambience and five feedback files. Add one R7 provenance ledger with real model/source metadata and original MP3/WAV/FLAC hashes, plus a separate owner-restoration decision; do not invent formal listening or legal clearance. Hyperfocus changes require a reproduced failure and their own RED test; already identical assets are not duplicated.

Verification sequence: retained 63-test baseline → failing independent R7/hash/volume regressions → scoped implementation → identical GREEN and cache-tamper, generation-write-set, coordinator/comfort/lifecycle and 18-variant tests → decoded QC → separate typecheck/lint and PDI source/diff → production build and bundle scan → Android `-r` install and exact built/installed hash plus UI-driven playback. Web preview, installed PWA, iOS, and Desktop receive separate evidence rows; unavailable native/public proof stays UNVERIFIED. No private focus/history records are synthesized for a playback test.

Rollback: reviewed task-owned patch from pre-change `93b91e3833968e9a5af57ecba0474923e8f1d3a8`, recopy/build audio assets, and data-preserving reinstall. No reset, clean, uninstall, account logout, or source-original deletion.

| Surface/domain | Restoration impact and proof |
| --- | --- |
| Web/Vite | Shared collection/gain; local production preview and decode |
| Installed PWA | Exact-hash intent cache, retired version, offline admission and no startup album load |
| Android/Capacitor | Same audio in rebuilt APK; source/built/installed identity and real selection/playback |
| iOS/WKWebView | Same collection, unchanged gesture/lifecycle; build/runtime separately verified or UNVERIFIED |
| Desktop/Tauri | Same dist; wide web preview does not certify packaged playback |
| Store/Release | No publication in this amendment; formal context/listening and legal gates stay separate |
| Accessibility/i18n | No visible control/copy/layout change; mute and comfort remain effective in all locales |
| Performance | One decoder; intent-only current/next caching; larger album size is explicit |
| Security/privacy | No remote audio/model execution, secret, account/data/schema or new dependency |
| Testing/operations | Independent exact-receipt regressions, fail-closed QC, scoped rollback |

The following sections preserve the original implementation record; this amendment supersedes their procedural collection size/format/source decisions only.

Extend ZenFlow's existing first-party Cloudlight synthesis and single-owner background-music path into an exact ten-master collection, mount that owner above account gating, reuse one icon-only control on entry and navigation surfaces, and replace the perceived hard theme jump with one short compositor-only colour veil. Preserve first-run silence, current master-audio and comfort gates, the long-audio coordinator, the Android drawer's atomic palette protection, all auth behavior, and the no-mock-data contract. Verify the exact Android artifact with MCP-driven UI/audio checks plus a separate continuous-video and CDP-off frame-timing pass before preparing a signed Google Play Internal testing release.

## Technical Context

**Language/Version**: TypeScript 5.x, React 18.3, Node.js 22 CommonJS asset tooling, Java/Kotlin Android wrapper on Java 21

**Primary Dependencies**: Existing Capacitor 8, Zustand 5, Framer Motion 12, Vite, Workbox, lucide-react, lamejs 1.2.1; no new production or paid dependency

**Storage**: Existing safe device-local preference helpers for the music enabled flag and collection cursor; no account sync, database, migration, or remote storage

**Testing**: Vitest 4 and Testing Library; existing audio asset/QC scripts; Playwright visual regression; Android MCP, UIAutomator, logcat, `dumpsys gfxinfo`, and Perfetto FrameTimeline

**Target Platform**: Web/Vite, installed PWA, Android API 26-36 Capacitor WebView, iOS WKWebView, Desktop/Tauri; Google Play Internal testing for Android only

**Project Type**: Cross-platform local-first web application packaged through Capacitor and Tauri

**Performance Goals**: Icon feedback within 100 ms; theme transition settled within 300 ms; no theme-window presentation gap over 103 ms; zero tile-memory/context-loss/ANR/crash signal during accepted Android theme journeys; no startup preload of ten long tracks

**Constraints**: Exactly ten approved local masters; one long-audio owner; no visible music text or tooltip; accessible names remain; first-ever playback off; no blur/backdrop/snapshot transition; no mock runtime data; no new dependency; no production Play rollout

**Scale/Scope**: Ten 150-second 44.1 kHz stereo MP3 masters at 128 kbps, four icon-control presentations, three theme entry points, five runtime platforms, eight locales, and one Android internal-track artifact

## Constitution Check

The constitution status command returned `PROPOSAL_CRITERIA_ONLY`; its clauses are advisory and nonblocking. Independently binding checks come from `AGENTS.md`, `ARCHITECTURE.md`, `docs/ai/TEST_FIRST_AGENT_POLICY.md`, `docs/ai/TELEGRAM_GRADE_RUNTIME_CONTRACT.md`, `docs/ai/V2_FULLSCREEN_EDGE_TO_EDGE_CONTRACT.md`, `docs/ai/NO_AI_TEMPLATES_AGENT_POLICY.md`, `docs/ai/BEST_PRACTICES_IMPLIED_REQUIREMENTS_GATE.md`, and `docs/ai/VISUAL_MODEL_ANIMATION_QUALITY_GATE.md`.

- **Data/provenance**: PASS in design. Production audio is generated locally from numerical specifications and has exact hashes; disputed and unknown-provenance files are excluded.
- **Cross-platform**: PASS in plan. Web/PWA/Android/iOS/Desktop rows and evidence boundaries are explicit.
- **Accessibility/i18n**: PASS in plan. Icon-only remains screen-reader named, keyboard operable, focus visible, 44/48 px, reduced-motion safe, and RTL-safe.
- **Security/privacy**: PASS in plan. No user content, new permission, telemetry, secret, remote audio, or account sync is introduced.
- **Test first**: PASS in plan. Every production phase begins with a RED test or measured baseline and repeats the same evidence after the change.
- **Performance/visual integrity**: PASS in plan. The canonical orb and current drawer protection remain; Android requires continuous raster evidence and a separate profiler pass.
- **Release authority**: PASS in plan. The owner authorized Internal testing, but exact-hash audio approval, upload signing identity, and action-time rollout confirmation remain hard gates.

Post-design re-check: no plan decision conflicts with the active repository policies. The only accepted complexity is extending protected audio/service-worker/theme/native-release surfaces because those are directly required by the requested cross-platform behavior.

## Project Structure

### Documentation (this feature)

```text
specs/003-japanese-audio-theme/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── music-playback.md
│   ├── theme-transition.md
│   └── android-internal-release.md
├── checklists/
│   ├── requirements.md
│   └── release-quality.md
└── tasks.md
```

### Source Code (repository root)

```text
scripts/
├── generate-non-hyperfocus-audio.cjs
├── check-app-audio-assets.cjs
└── __tests__/check-app-audio-assets.test.ts

public/sounds/music/          # nine new generated MP3 masters
docs/sounds/music/            # nine generated deployment mirrors
docs/audio/                   # provenance, policy, and exact-hash review ledger

src/
├── App.tsx
├── components/auth-screen/AuthScreen.tsx
├── components/navigation-v2/AppBackgroundMusicProvider.tsx
├── components/navigation-v2/BackgroundMusicToggle.tsx
├── components/navigation-v2/NavV2Orchestrator.tsx
├── components/navigation-v2/ThemeToggleV2.tsx
├── hooks/useAppBackgroundMusic.ts
├── lib/appAudioAssets.ts
├── lib/appAudioAssets.ts             # authoritative collection catalog and sequence helpers
├── lib/appBackgroundMusicPreference.ts
├── lib/runtimeAudioCache.ts
├── lib/themeTransition.ts
├── stores/themeStore.ts
├── index.css
└── sw.ts

android/app/build.gradle
CHANGELOG.md
docs/release/google-play/GOOGLE_PLAY_LOCALIZED_LISTING_PACKET.json
```

Tests remain beside their current owners under `src/**/__tests__`, `scripts/__tests__`, and existing Playwright/Android motion suites.

**Structure Decision**: Preserve the existing single-project architecture. Extend the current background-music provider, audio asset registry, cache integrity layer, generator, and theme store rather than creating a second audio engine, new feature store, native media service, or alternate overlay owner.

## Complexity Tracking

| Protected scope | Why Needed | Simpler Alternative Rejected Because |
| --- | --- | --- |
| Generator plus nine binary masters | The user requested an exact ten-piece collection with store-safe rights evidence | Reusing ambience and feedback files would violate their current roles and would not produce ten music pieces |
| Global provider placement | Playback must span unauthenticated entry and authenticated navigation | Two independent players would restart or overlap across auth completion |
| Service-worker cache manifest | Long tracks must remain intentional and integrity-bound offline | Pre-caching all files increases startup/storage pressure; unrestricted runtime caching loses hash admission |
| Theme coordinator and one local overlay | The theme must feel soft without restoring the rejected Android snapshot/repaint path | Per-element colour transitions, root attributes, and root snapshots create broad compositor/style invalidation |
| Android release metadata | Google Play requires a unique, traceable bundle | Reusing version code 39 or a debug signature would not produce an admissible testing-track update |
