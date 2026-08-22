# Cross-Platform Audio Contract Implementation Plan

> **Governance update (2026-08-14):** Execute only an explicitly authorized task and do so SOLO. Use `superpowers:executing-plans` only for an approved plan; do not invoke subagents or auto-start the next task. Existing checkboxes are tracking only.

**Goal:** Make ZenFlow app-owned sound effects and ambience discoverable, centrally registered, and verifiably available across Web, PWA, Android/Capacitor, iOS/WKWebView, Desktop/Tauri, phone, and wide layouts.

**Architecture:** Add a local audio manifest as the source of truth for shipped audio files and generated feedback sounds. Wire user-facing audio surfaces to the manifest and make master mute/volume apply to sign-in ambience, orb ambience, diary ambience, focus ambient library, and generated UI feedback while leaving user journal recordings under their own players.

**Tech Stack:** React 18, TypeScript, Vite public assets, Capacitor webDir dist, Tauri/Vite desktop build, Vitest, Testing Library, Playwright.

---

### Task 1: Audio Manifest Contract

**Files:**
- Create: `src/lib/appAudioAssets.ts`
- Create: `src/lib/__tests__/appAudioAssets.test.ts`
- Modify: `src/lib/ambientSounds.ts`

- [ ] **Step 1: Write failing manifest test**

Create `src/lib/__tests__/appAudioAssets.test.ts` with assertions that every app-owned MP3 asset is local, exists in `public/sounds`, starts from a user gesture, respects master volume, and lists all platforms: web, pwa, android, ios, desktop.

Run: `npm test -- src/lib/__tests__/appAudioAssets.test.ts`
Expected: FAIL because `@/lib/appAudioAssets` does not exist.

- [ ] **Step 2: Implement manifest**

Create `src/lib/appAudioAssets.ts` exporting `APP_AUDIO_PLATFORMS`, `APP_AUDIO_ASSETS`, `APP_AUDIO_FEEDBACK_EVENTS`, `getAppAudioAsset`, and `getAppAudioAssetSrc`.

- [ ] **Step 3: Wire ambient focus files to manifest**

Update `src/lib/ambientSounds.ts` so the six focus ambient sound paths come from `getAppAudioAssetSrc(...)`.

- [ ] **Step 4: Verify manifest green**

Run: `npm test -- src/lib/__tests__/appAudioAssets.test.ts src/lib/__tests__/ambientSounds.test.ts`
Expected: PASS.

### Task 2: Master Audio Coverage

**Files:**
- Modify: `src/components/auth-screen/AuthScreen.tsx`
- Modify: `src/components/auth-screen/__tests__/AuthScreen.providers.test.tsx`
- Modify: `src/components/hyperfocus/useHyperfocusAudio.ts`
- Modify: `src/components/hyperfocus/HyperfocusMode.tsx`
- Modify: `src/components/hyperfocus/HyperfocusSoundSelector.tsx`
- Create: `src/components/hyperfocus/__tests__/useHyperfocusAudio.test.tsx`

- [ ] **Step 1: Write failing auth mute test**

Add a test proving the measured-breath button is disabled and does not call `play()` when app audio is muted.

Run: `npm test -- src/components/auth-screen/__tests__/AuthScreen.providers.test.tsx`
Expected: FAIL because AuthScreen does not read app audio settings.

- [ ] **Step 2: Write failing hyperfocus mute test**

Add a hook test proving selected focus ambience does not call `playDirect()` while app audio is muted and generator volume follows master volume while unmuted.

Run: `npm test -- src/components/hyperfocus/__tests__/useHyperfocusAudio.test.tsx`
Expected: FAIL because the hook does not read app audio settings.

- [ ] **Step 3: Implement master coverage**

Use `useAppAudioSettings()` in AuthScreen and useHyperfocusAudio. Disable sign-in ambience when muted; pause focus ambience when muted; set generator volume from master volume; pass disabled state into HyperfocusSoundSelector.

- [ ] **Step 4: Verify green**

Run: `npm test -- src/components/auth-screen/__tests__/AuthScreen.providers.test.tsx src/components/hyperfocus/__tests__/useHyperfocusAudio.test.tsx`.

### Task 3: Settings Sound Map

**Files:**
- Modify: `src/pages/nav-v2/settings/V2SettingsSoundPanel.tsx`
- Modify: `src/pages/nav-v2/__tests__/SettingsPage.test.tsx`
- Modify: `src/i18n/types.ts`
- Modify: `src/i18n/languages/{en,uk,es,de,fr,ja,ar,he}.ts`

- [ ] **Step 1: Write failing settings test**

Extend the V2 Settings sound test to expect a sound map listing sign-in breath, orb ambience, diary ambience, focus ambience, generated feedback, and cross-platform readiness copy.

Run: `npm test -- src/pages/nav-v2/__tests__/SettingsPage.test.tsx`
Expected: FAIL because the map is not rendered.

- [ ] **Step 2: Render sound map**

Use the manifest to show where each app-owned audio family appears and that playback is tap-started/local/cross-platform.

- [ ] **Step 3: Add translations**

Add concise keys for the map in all 8 languages, including RTL-safe strings.

- [ ] **Step 4: Verify green**

Run: `npm test -- src/pages/nav-v2/__tests__/SettingsPage.test.tsx`, `npm run i18n:check`, and `npm run i18n:deep`.

### Task 4: Cross-Platform Proof

**Files:**
- Output only: `output/playwright/*`, `dist/sounds/*`, Android/iOS synced web assets when commands succeed.

- [ ] **Step 1: Build Web/PWA/Desktop assets**

Run: `npm run build`; verify `dist/sounds/*.mp3` includes every manifest asset.

- [ ] **Step 2: Build/sync native web assets**

Run: `npm run cap:sync:android` and `npm run cap:sync:ios` when local toolchains allow. Verify copied assets or mark exact blockers `UNVERIFIED`.

- [ ] **Step 3: Runtime smoke**

Use Playwright against local preview/dev route to verify phone and desktop Settings sound map, Orb ambience, Diary ambience, Auth measured breath muted state, and no page errors.

- [ ] **Step 4: Final gates**

Run focused tests, `npm run typecheck`, `npm run lint`, `npm run check:canonical-orbs`, `npm run check:visual`, and Snyk Code on changed TS/TSX scope.

---

## Self-Review

- Spec coverage: covers the user's explicit cross-platform sound visibility request plus missing master mute/volume coverage for auth and hyperfocus.
- Placeholder scan: no TODO/TBD placeholders.
- Type consistency: manifest IDs are referenced by tests before implementation and then by UI/hooks.
