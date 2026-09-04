# Implementation Plan: Calm Music Collection And Soft Theme Change

**Branch**: `codex/japanese-audio-theme-transition-20260902` | **Date**: 2026-09-02 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/003-japanese-audio-theme/spec.md`

## Summary

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
