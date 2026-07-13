# V2 Sound Settings And Diary Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make V2 sound control explicit in Settings, make page-level MP3 ambience respect the app audio mute state, and verify the Diary release/gratitude motion surfaces.

**Architecture:** Keep long ambience as local user-started MP3 controls. Use the existing `audioManager` as the app-level master mute/volume source and add a V2 Settings sound panel instead of creating a second storage model. Preserve the canonical orb visuals; do not generate separate audio per orb state until a product need is proved.

**Tech Stack:** React 18, TypeScript, Vite/Vitest, Testing Library, local MP3 assets under `public/sounds`, existing `audioManager`, Playwright browser verification.

---

## PRE-FLIGHT ARTIFACT

DEPTH:
- Chosen depth: L3.
- Why not shallower: This touches V2 Settings UI, audio runtime behavior, i18n, Diary/Orb surfaces, and phone/desktop verification.
- Checks completed: read `AGENTS.md`, `ARCHITECTURE.md`, `docs/ai/SKILL_ROUTING_AGENT_POLICY.md`, `docs/ai/TEST_FIRST_AGENT_POLICY.md`, `docs/ai/RUFLOW_PLUS_BLUEPRINT.md`, `docs/ai/TELEGRAM_GRADE_RUNTIME_CONTRACT.md`, `docs/ai/PREFLIGHT_OPERATOR_TEMPLATE.md`, and relevant Settings/audio/Diary files.

REQUEST TRANSMUTATION:
- Raw request: Put sound work into app Settings, recheck sounds and placement, consider separate sound per orb, deeply verify Diary animations plus "release thought" and gratitude.
- Interpreted outcome: Add a clear V2 Sound settings module, make V2 ambient tracks respect app audio mute, audit whether per-orb audio is justified, and verify Diary action animation coverage.
- Missing but necessary outcomes I will include: no autoplay, no remote audio URLs, no canonical orb visual replacement, no separate MP3 generation without a UX reason, and browser proof on phone plus desktop.

GOAL:
- Atomic goal: V2 users can see and control app sound from Settings, and V2 Orb/Diary ambience does not ignore that mute state.
- Success criterion: Focused tests prove Settings sound controls call the app audio manager, Orb/Diary ambient controls obey mute, and Diary release/gratitude scenarios have automated plus browser evidence.

EVIDENCE SNAPSHOT:
- [READ: `src/lib/audioManager.ts`] Existing master mute and volume persist through `SK.AUDIO_MUTED` and `SK.AUDIO_VOLUME`.
- [READ: `src/pages/nav-v2/SettingsPage.tsx`] V2 Settings renders module cards and delegates panel bodies through `V2SettingsControlDeck`.
- [READ: `src/pages/nav-v2/OrbPage.tsx`] Orb ambience uses `polished-stone-and-paper.mp3` with a fixed per-page toggle and volume.
- [READ: `src/pages/nav-v2/DiaryPage.tsx`] Diary ambience uses `v2-diary-reflection-loop.mp3` with a fixed per-page toggle and volume.
- [READ: `src/features/journal/BurnThoughtWidget.tsx`] Release thought uses a canvas particle release scene with reduced-motion fallback and no text payload callback.
- [READ: `src/features/journal/GratitudeBloomWidget.tsx`] Gratitude uses a seed-to-bloom state machine but does not yet have a direct component test.
- [SEARCH: `public/sounds`] Current local MP3s: auth breath, orb ambience, diary reflection loop, and six hyperfocus ambience files.

1. IMPLICIT REQUIREMENTS
- The Settings sound control must not autoplay audio.
- The Sound module must work in Web, PWA, Android/iOS WebView, and Desktop/Tauri because it uses browser-safe local storage/audio helpers.
- RTL/i18n must stay covered by adding keys to all language files.
- Diary release thought must not persist private text; gratitude must create a gratitude entry through the existing callback.

2. ROOT CAUSE + DIAGNOSTIC SOURCES
- Symptom: V2 audio exists on pages but Settings has no V2 sound module.
- Root-cause hypothesis: new page-level MP3 controls were added independently of the older app audio manager.
- Diagnostic sources: Settings module map, `audioManager` state, Orb/Diary audio tests, journal widget tests, browser route smoke.

3. SYSTEMIC IMPACT
- Files likely touched: `src/lib/audioManager.ts`, `src/hooks/useAppAudioSettings.ts`, `src/pages/nav-v2/settings/*`, `src/pages/nav-v2/SettingsPage.tsx`, `src/pages/nav-v2/OrbPage.tsx`, `src/pages/nav-v2/DiaryPage.tsx`, i18n files, focused tests.
- Cross-platform risks: mobile audio gesture rules, desktop layout, RTL copy, autoplay restrictions.
- Invariants: local MP3 only, `preload="none"`, no autoplay, canonical orb visuals unchanged, 44px touch targets.

4. PLATFORM + DOMAIN MATRIX
- Platforms checked in plan: Web local preview, phone layout, desktop layout, CI-style unit/type/i18n checks.
- Domains checked: UI, state, storage helper use, i18n, performance, accessibility, motion, security scanner status.
- Runtime contract read: yes.

5. VISUAL AUDIT MATRIX
- Layers to verify: Settings module order, Sound panel hierarchy, focusable controls, touch target size, phone reflow, desktop sidebar layout, Diary action overlays.
- States to verify: sound on/off, volume changed, preview clicked, muted ambience blocked, unmuted ambience plays, Diary release opened, gratitude opened.
- Visual evidence plan: Playwright screenshots for Settings Sound and Diary action surfaces in phone and desktop where feasible.

6. FAILURE MODES
- Failure 1: Settings mute changes only short tones while Orb/Diary MP3 still plays.
  Prevention: subscribe page-level ambient controls to app audio settings and pause when muted.
  Proof: focused tests for Orb/Diary muted behavior and browser check.
- Failure 2: Adding per-orb-state tracks creates noise, weight, and unclear state mapping.
  Prevention: keep one orb ambience now; document separate per-orb audio as not implemented unless validated by UX need.
  Proof: audio plan update and no new unneeded MP3 assets.

7. STEP-BY-STEP PLAN
- [ ] **Step 1: Add a failing Settings sound test**
  - Files: `src/pages/nav-v2/__tests__/SettingsPage.test.tsx`
  - Verify: `npm test -- src/pages/nav-v2/__tests__/SettingsPage.test.tsx`
  - Expected: FAIL because `settings-module-card-sound` does not exist yet.
  - Rollback: remove the new test block.
- [ ] **Step 2: Add app audio settings subscription helpers**
  - Files: `src/lib/audioManager.ts`, `src/hooks/useAppAudioSettings.ts`
  - Verify: focused audio/settings tests.
  - Rollback: remove helper exports and hook.
- [ ] **Step 3: Add V2 Sound panel**
  - Files: `src/pages/nav-v2/settings/types.ts`, `src/pages/nav-v2/SettingsPage.tsx`, `src/pages/nav-v2/settings/V2SettingsControlDeck.tsx`, `src/pages/nav-v2/settings/V2SettingsSoundPanel.tsx`
  - Verify: SettingsPage test passes.
  - Rollback: remove `sound` section and panel.
- [ ] **Step 4: Make V2 ambience obey master mute**
  - Files: `src/pages/nav-v2/OrbPage.tsx`, `src/pages/nav-v2/DiaryPage.tsx`, related tests.
  - Verify: Orb/Diary audio tests pass and muted state prevents playback.
  - Rollback: remove hook usage and restore direct fixed-volume behavior.
- [ ] **Step 5: Add direct GratitudeBloomWidget coverage if missing**
  - Files: `src/features/journal/__tests__/GratitudeBloomWidget.test.tsx`
  - Verify: gratitude plant callback, validation, reduced-motion success path.
  - Rollback: remove test file if it is too brittle.
- [ ] **Step 6: Run browser verification**
  - Files: `output/playwright/*`
  - Verify: Settings Sound and Diary action screens on phone/desktop, no autoplay, sound placement visible and not overlapping.
  - Rollback: no app rollback; artifacts can be deleted.

8. SCOPE BOUNDARIES
- In scope: V2 Settings sound module, existing local MP3 controls, current Diary release/gratitude motion checks.
- Out of scope: generating new Gemini tracks this turn, replacing hyperfocus sound library, changing canonical orb visuals, native notification channel redesign.
- Intentionally not changing: per-orb-state audio until a UX reason is stronger than the weight/noise cost.

9. ANTI-PATTERNS CHECKED
- No direct localStorage; use existing audio manager and storage helpers.
- No autoplay.
- No remote audio URLs.
- No silent destructive fallback.
- No theme hardcoded colors in new Settings UI.

10. DEPENDENCIES AND UNKNOWNS
- Verified dependencies: audioManager, V2 Settings module deck, local MP3 assets, Diary widgets.
- Unknowns still requiring proof: full native audio behavior on real Android/iOS remains `UNVERIFIED` unless native builds are run.
- Blockers: none for local Web/desktop implementation.
