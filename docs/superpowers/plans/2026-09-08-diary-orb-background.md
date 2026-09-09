# V2 Diary Orb Background Implementation Plan

> Execution: SOLO in the existing locked `codex/android-103ms-20260904` lane, using executing-plans and test-driven-development. No new worktree or background agent. This is the approved feature004 extension, not a new feature or a release approval.

**Goal:** Replace the V2 Diary mountain wallpaper with the existing Orb day/night scene and its details while retaining readable, responsive journal controls.

**Architecture:** DiaryPage owns V2 presentation. It supplies a decorative ReactNode through an optional `pageBackground` slot on JournalModule. The feature renders the supplied scene in place of DiaryWallpaper; undefined preserves current callers. A small memoized component in DiaryPage composes the existing CosmicBgAdapter, OrbDayFlourish/ShootingStar and useCosmicParallax. Nothing imports page code from the journal feature. OrbPage, shaders, palettes, visual assets and canonical orbs are not edited.

**Stack:** Existing React 18 / TypeScript / Vite / Tailwind and Capacitor 8. No production dependency or data model change.

## Grounding, Alternatives and Approval

Owner approval on 2026-09-08: “в дневнике ты можешь фоны из дневной и ночной темы из Таба орба вместо той статичной картинки со всеми нюансами”. The available runtime is emulator-5560, API36, 1080×2400, WebView133; refresh its identity before native proof.

Current source: DiaryPage delegates page presentation to JournalModule. Its page section directly renders DiaryWallpaper; empty/desktop child panes already suppress their own duplicate backdrop. OrbPage composes CosmicBgAdapter with OrbDayFlourish or ShootingStar in the established theme scopes and ambient readability veil. CosmicBgAdapter chooses Paper/day versus Ink/OLED/night and owns Android day-renderer lifecycle; DayCosmicBackground samples five daylight palettes per mount and retains the complete existing motion field.

Rejected: keeping or promoting the mountain wallpaper (the owner approved a different scene and retained diagnostics did not meet the performance target); a new low-detail background (violates the selected reference); importing V2 pages into the journal feature (unnecessary reverse dependency); globally relocating the renderer (changes route ownership and canonical Orb behavior before evidence justifies it). The chosen slot is the smallest reversible integration. It does not guarantee 103 ms; measure the actual result.

## Explicit and Implied Requirements

Explicit: existing Orb day/night backgrounds with all nuances, no static mountain picture in the V2 Diary, continue the current goal, emulator is the available target. FR-010–FR-014 in the feature specification govern this extension.

Implied: retain the exact theme scope, daylight palette, background layers, decorative flourish/parallax and motion policy; one active backdrop and teardown on navigation; readable existing panels; no extra audio or fake readiness; RTL/safe-area/large-text coverage; independent source/APK identity and separate timing/video evidence.

Non-goals: V1 dialog redesign, mobile editor's separate paper/canvas style, canonical Orb mutation, global background service, data caching, account/privacy changes, new art, package changes or public deployment. Empty/list/shared desktop-editor panes belong to the V2 page and receive its one background. No persistence, encryption, validation, tombstone, queue, sync or retention rules change.

## Task 1 — Regression RED

Modify `src/features/journal/__tests__/JournalModule.handoffBehavior.test.tsx` to supply a marker page background and assert one marker, no legacy wallpaper, cleanup on unmount, and unchanged default/dialog behavior. Use existing mocked storage/security boundaries; do not read or create real records.

Create `src/pages/nav-v2/__tests__/DiaryPage.background.test.tsx`. Mock the feature boundary to render its supplied pageBackground, but render the real CosmicBgAdapter/day/night/flourish components. Mock only environment/store hooks, as neighboring scene tests do. Assert Paper at morning and after 19:00 uses daylight, Ink/OLED use cosmic night, full day layer/particle families and flourishes exist, reduced motion uses the canonical static alternative, theme changes retain one active scene, unmount removes it and Android reduced-motion ownership cleans up. A missing import/compile error is not the expected RED; tests must fail on the absent background contract before production edits.

Run `npm test -- src/pages/nav-v2/__tests__/DiaryPage.background.test.tsx src/features/journal/__tests__/JournalModule.handoffBehavior.test.tsx`. Preserve machine-readable output. Current pre-change baseline: DiaryPage.audio plus JournalModule.handoffBehavior, 69 tests, exit 0. Update the ignored test-first receipt with the actual new expected failure before implementation.

## Task 2 — Small Presenter Integration

In `src/features/journal/JournalModule.tsx`, add `pageBackground?: ReactNode`, destructure it, and replace only the page-section wallpaper line with `{pageBackground === undefined ? <DiaryWallpaper surface="page" /> : pageBackground}`. Dialog rendering never consumes this slot. Keep loading/security and all other code unchanged.

In `src/pages/nav-v2/DiaryPage.tsx`, compose the existing background pieces in a memoized decorative component. Use the same Paper/day or dark/cosmic scope and ambient veil as OrbPage, the same Android-aware decorative motion policy and the existing parallax hook. Keep its root absolute, inset-0, z-0, isolated and clipped so Android's canvas cannot overlap foreground. Hide decoration for forced colors. Pass one stable element as `pageBackground` to JournalModule. Do not add timers, a raster cache, new visual constants, new assets or global listeners; existing components own their established lifecycle.

Rerun the RED command as GREEN plus `DiaryWallpaper.static`, `DiaryPage.audio`, `CosmicBgAdapter`, `DayCosmicBackground`, `AndroidDayCosmicBackground`, OrbPage and navigation suites. Preserve default legacy wallpaper tests rather than weakening them.

## Task 3 — Verification and Rollback Decision

Run separate typecheck and focused Vitest commands, lint, check:all, check:canonical-orbs, check:no-ai-templates, check:agent-context and production-data-integrity diff/bundle checks. Use the callable Snyk Code tool, or the scoped local CLI fallback with no credentials printed; tool/auth failure stays UNVERIFIED. Refresh generated counts/inventory only through existing generators when their checks require it.

Build the existing benchmark variant using the reviewed repository packaging path. Bind the complete source snapshot and canonical input hashes before/after build to the exact APK; independently observe installed base.apk before and after runtime verification. Never uninstall or clear app data to obtain a passing flow.

On emulator: Paper and Ink/OLED; empty/history page and available editor; first/warm visits, repeated Orb↔Diary menu navigation, Back, keyboard and Home/resume; normal/reduced motion, large text, ar/he and native safe edges. Use actual UI-tree bounds for taps and capture screenshots/continuous video. No private text in reports. Collect clean Perfetto separately from video, CDP profiling and host test/build workloads. Report >103 ms frames and maxima, not only averages; distinguish presentation from DOM/CPU timing. If a new visual or input regression appears, correct within these two production files or roll back only this extension, not the inherited F3 work.

Browser: production-equivalent V2 Diary on phone and desktop widths with normal/reduced motion, Paper/Ink/OLED, ar/he, no duplicate background, console errors and accessible foreground. Installed PWA, iOS and Tauri are separate rows; do not extrapolate browser evidence.

Run visual-integrity-critic inline against current native/browser evidence and the exact Orb source reference. This reuses existing assets rather than introducing a new model/animation asset; no new generated-asset packet is required. Separate Technical, Visual Runtime, Artistic/Craft, Motion, Model and Plan. Human artistic acceptance cannot be inferred from an agent review.

## Platform and Domain Matrix

| Surface | Impact and required evidence |
| --- | --- |
| Web/Vite | V2 phone/wide Diary; fresh production browser screenshots, console and behavior required. |
| Installed PWA | Shared UI; no service-worker or persistence change; installed/offline runtime UNVERIFIED until tested. |
| Android/Capacitor | Primary emulator target; exact APK, native UI/video, keyboard/back/resume and clean frame proof required. Physical-phone claims UNVERIFIED; absent hardware does not block emulator work. |
| iOS/WKWebView | Shared UI; no native change; native runtime UNVERIFIED. |
| Desktop/Tauri | Shared V2 Diary; wide browser evidence required, packaged runtime UNVERIFIED. |
| Store/Release | No store assets, signing, publication or release action in this extension. Whole-goal release/convergence stays open. |
| Accessibility | Ar/he, large text, reduced motion, forced colors, safe areas and existing focus/targets. No new copy or controls. |
| Performance | Same full canonical scene; measure first/warm transitions and frame pacing on new APK. No resolution/effect/budget reduction. |
| Security/Privacy | Decoration receives no journal data; existing loading/lock/storage/auth paths unchanged; isolated test doubles and scoped scan only. |
| Testing | Expected RED → same GREEN, boundary/visual/navigation regressions, build and runtime. |
| Operations | Preserve 72 inherited changes, before-source copies and exact receipts; rollback only the presenter slot/background/test hunks. |

## Done When and Unknowns

The requested backdrop is present with matching day/night details, no mountain/duplicate background in V2, existing journal workflows remain usable, regression checks and exact-build emulator/browser proof have been reviewed, and every failed/unavailable row is explicitly reported. The larger Android goal is not complete merely because this background extension is implemented. Existing IME/frame failures, human craft acceptance and untested platform/release evidence remain open until new proof closes their named scope.

Constitution status was freshly PROPOSED/unratified/nonblocking before this lifecycle; it creates no blocking criterion or remediation task. The extension follows active AGENTS/governance/test-first/runtime/visual policies and the owner's approval. Spec Kit updates the existing spec, plan, requirement checklist and task appendix; optional extensions remain disabled. Cross-artifact analysis precedes production implementation and convergence cannot close unchanged older acceptance tasks without evidence.
