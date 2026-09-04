# ZenFlow Evening Collection And Soft Theme Transition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an exact ten-master first-party music collection with one icon-only auth-to-navigation player, add a low-cost soft theme handoff, and prepare a verified Google Play Internal testing artifact.

**Architecture:** Extend the current deterministic audio generator, asset registry, integrity cache, background-music hook, and long-audio coordinator rather than creating a parallel engine. Mount the existing provider above account gating and reuse one icon component on every requested surface. Commit theme variables atomically and animate only one pointer-transparent old-palette veil, retaining the Android drawer contrast guard.

**Tech Stack:** React 18, TypeScript, Zustand, Capacitor 8, Vite/Workbox, Framer Motion configuration, lucide-react, Node.js 22, lamejs, Vitest/Testing Library, Playwright, Android MCP, UIAutomator, logcat, gfxinfo, Perfetto.

**Spec:** `docs/superpowers/specs/2026-09-02-japanese-audio-theme-transition-design.md` and `specs/003-japanese-audio-theme/spec.md`

## Global Constraints

- Exactly ten masters: existing Cloudlight plus nine newly generated original compositions.
- No third-party or quarantined audio, samples, voices, copied melody/harmony, AI-audio input, mock runtime data, or new dependency.
- First-ever music state is off; one global media element and one long-audio owner span auth and navigation.
- Visible music UI is icon-only; accessible names, state, focus, keyboard, 44/48-pixel targets, eight locales, and RTL remain.
- Theme motion is 260-300 ms, opacity-only, reduced-motion safe, latest-request-wins, and cannot use blur, backdrop filters, page snapshots, or canonical-orb changes.
- Android acceptance requires exact APK/install identity, audible output evidence, continuous video, a separate CDP-off frame pass, no raster/tile/context failure, and no theme-window gap over 103 ms.
- Google Play destination is Internal testing only; exact-hash owner audio approval, existing upload signing identity, required CI, and action-time rollout confirmation are mandatory.

---

### Task 1: Ten-Master Generator And Provenance

**Files:**
- Modify: `scripts/generate-non-hyperfocus-audio.cjs`
- Modify: `scripts/check-app-audio-assets.cjs`
- Modify: `scripts/__tests__/check-app-audio-assets.test.ts`
- Modify: `src/lib/__tests__/appAudioAssets.test.ts`
- Modify: `docs/audio/non-hyperfocus-generated-audio-provenance.json`
- Modify: `docs/audio/non-hyperfocus-sound-effects-policy.md`
- Create: `docs/audio/zenflow-evening-collection-review.json`
- Create: `public/sounds/music/*.mp3`
- Create: `docs/sounds/music/*.mp3`

**Interfaces:**
- Produces: an exact ordered array of ten music provenance rows with `id`, `fileName`, `title`, `sequence`, `durationSeconds`, `runtimeGain`, `bytes`, `sha256`, `seed`, and composition metrics.
- Consumes: the existing Cloudlight synthesis voices, MP3 encoder, circular-loop mastering, and app-audio QC conventions.

- [ ] **Step 1: Write the failing exact-inventory test**

```ts
expect(musicAssets).toHaveLength(10);
expect(musicAssets[0].id).toBe("cloudlight-evening-loop");
expect(new Set(musicAssets.map((asset) => asset.sha256)).size).toBe(10);
expect(musicAssets.every((asset) => asset.humanReview === "PENDING")).toBe(true);
```

- [ ] **Step 2: Run the RED test**

Run: `npx vitest run scripts/__tests__/check-app-audio-assets.test.ts src/lib/__tests__/appAudioAssets.test.ts`

Expected: FAIL because the current audio contract contains one background-music master and no ten-master collection.

- [ ] **Step 3: Convert Cloudlight composition inputs into a data-driven collection**

```js
const musicAssets = [
  existingCloudlight,
  makeMusicSpec({ id: 'lantern-air', seed: 0x1a47e2c1, tempoBpm: 58, mode: 'major-pentatonic' }),
  makeMusicSpec({ id: 'rain-on-paper', seed: 0x2a91d44f, tempoBpm: 60, mode: 'suspended-pentatonic' }),
  makeMusicSpec({ id: 'indigo-dusk', seed: 0x3d17c8a5, tempoBpm: 56, mode: 'minor-pentatonic' }),
  makeMusicSpec({ id: 'quiet-courtyard', seed: 0x4c38ab72, tempoBpm: 62, mode: 'open-fifths' }),
  makeMusicSpec({ id: 'moonlit-water', seed: 0x5e62f914, tempoBpm: 54, mode: 'major-pentatonic' }),
  makeMusicSpec({ id: 'cedar-mist', seed: 0x6f28b3c0, tempoBpm: 59, mode: 'minor-pentatonic' }),
  makeMusicSpec({ id: 'glass-bell-dawn', seed: 0x7b51e6d3, tempoBpm: 64, mode: 'suspended-pentatonic' }),
  makeMusicSpec({ id: 'moss-garden', seed: 0x8c73a219, tempoBpm: 57, mode: 'open-fifths' }),
  makeMusicSpec({ id: 'after-rain', seed: 0x9d42f680, tempoBpm: 61, mode: 'major-pentatonic' }),
];
```

Each spec defines its own chord fields, note patterns, rests, voice mix, stereo placement, and loop phase; changing only the seed is insufficient and must fail the distinct-composition contract.

- [ ] **Step 4: Generate and verify the files twice**

Run `npm run audio:generate-non-hyperfocus`, record hashes, regenerate, and compare bytes. Run `npm run check:app-audio -- --write-report`.

Expected: ten stable music hashes, all decode/QC gates green, and all human decisions still `PENDING`.

- [ ] **Step 5: Commit the independently reviewable audio foundation**

Stage only generator, QC, tests, policy/provenance/review files, and the nine new public/docs masters. Commit message must contain `batch` because the change exceeds seven files.

---

### Task 2: Catalog, Preference, And Integrity Cache

**Files:**
- Modify: `src/lib/appAudioAssets.ts`
- Modify: `src/lib/__tests__/appAudioAssets.test.ts`
- Modify: `src/lib/appAudioAssets.ts`
- Modify: `src/lib/appBackgroundMusicPreference.ts`
- Modify: `src/lib/storageKeys.ts`
- Modify: `src/lib/runtimeAudioCache.ts`
- Modify: `src/lib/__tests__/runtimeAudioCache.test.ts`
- Modify: `src/sw.ts`

**Interfaces:**
- Produces: `APP_BACKGROUND_MUSIC_COLLECTION`, `getBackgroundMusicMaster(id)`, `getNextBackgroundMusicMaster(id)`, `normalizeBackgroundMusicMasterId(value)`.
- Produces: device-local `getAppBackgroundMusicCursor()` and `trySetAppBackgroundMusicCursor(id)`.
- Consumes: generator-bound public paths, byte lengths, hashes, and existing safe storage helpers.

- [ ] **Step 1: Write RED catalog and cache tests**

```ts
expect(APP_BACKGROUND_MUSIC_COLLECTION).toHaveLength(10);
expect(getNextBackgroundMusicMaster("after-rain").id).toBe("cloudlight-evening-loop");
expect(normalizeBackgroundMusicMasterId("missing")).toBe("cloudlight-evening-loop");
expect(APP_AUDIO_INTENT_CACHE_PATHS).toEqual(
  APP_BACKGROUND_MUSIC_COLLECTION.map((master) => master.publicPath),
);
```

- [ ] **Step 2: Run RED**

Run: `npx vitest run src/lib/__tests__/appAudioAssets.test.ts src/lib/__tests__/appBackgroundMusicPreference.test.ts src/lib/__tests__/runtimeAudioCache.test.ts`

Expected: FAIL because catalog/cursor and multi-master cache contracts do not exist.

- [ ] **Step 3: Implement immutable catalog and cursor**

The runtime catalog is literal and hash-bound. Cursor writes dispatch a device-local preference event and never include an account ID.

- [ ] **Step 4: Derive cache contracts from the catalog**

Do not hand-maintain a second path/hash list. Keep startup warm-cache exclusion for every music master and allow only intent-bound full-body admission.

- [ ] **Step 5: Run GREEN plus service-worker tests**

Run the RED command again, followed by the existing PWA audio-range and service-worker contract suites.

---

### Task 3: Single Global Playlist Controller

**Files:**
- Modify: `src/hooks/useAppBackgroundMusic.ts`
- Modify: `src/hooks/__tests__/useAppBackgroundMusic.test.tsx`
- Modify: `src/components/navigation-v2/AppBackgroundMusicProvider.tsx`
- Modify: `src/components/navigation-v2/__tests__/AppBackgroundMusicProvider.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/navigation-v2/NavV2Orchestrator.tsx`

**Interfaces:**
- Extends `AppBackgroundMusicControl` with `activeMasterId`, `handleMediaEnded`, and collection-aware error recovery.
- Preserves `toggle`, `retry`, `handleMediaError`, ownership, lifecycle, Media Session, mute, volume, and comfort behavior.

- [ ] **Step 1: Write RED controller tests**

```ts
expect(screen.getAllByTestId("app-background-music-audio")).toHaveLength(1);
fireEvent.ended(screen.getByTestId("app-background-music-audio"));
await waitFor(() => expect(activeMaster()).toBe("lantern-air"));
expect(getActiveLongAudioOwner()).toBe("global-cloudlight");
```

Add stale play completion, disable-during-fade, corrupt-track skip, ten-error stop, background, owner-yield, and auth-to-app remount regression cases.

- [ ] **Step 2: Run RED**

Run: `npx vitest run src/hooks/__tests__/useAppBackgroundMusic.test.tsx src/components/navigation-v2/__tests__/AppBackgroundMusicProvider.test.tsx`

- [ ] **Step 3: Implement one-element collection state machine**

Use request IDs for play/fade/error work. Set the next `src` only after stopping the current element; load, play, and fade in at the effective volume. Keep bounded recovery state per collection cycle.

- [ ] **Step 4: Move provider ownership above AuthGate**

Wrap `<Index />` with the provider inside the existing app providers and remove only the nested NavV2 wrapper. Do not change authentication hooks or account state.

- [ ] **Step 5: Run GREEN and ownership blast-radius tests**

Run the RED command plus `audioPlaybackCoordinator`, `audioLifecycle`, `audioComfort`, and auth gate suites.

---

### Task 4: Shared Icon-Only Account And Navigation Control

**Files:**
- Modify: `src/components/navigation-v2/BackgroundMusicToggle.tsx`
- Modify: `src/components/navigation-v2/__tests__/BackgroundMusicToggle.test.tsx`
- Modify: `src/components/auth-screen/AuthScreen.tsx`
- Modify: `src/components/auth-screen/__tests__/AuthScreen.providers.test.tsx`
- Remove only if no imports remain: `src/components/auth-screen/AuthMeasuredBreathToggle.tsx`

**Interfaces:**
- `BackgroundMusicTogglePresentation = "auth" | "sidebar-expanded" | "sidebar-collapsed" | "drawer"`.
- Visible output contains one icon button; assistive output contains localized action and status.

- [ ] **Step 1: Write RED icon-only tests**

```ts
expect(button).not.toHaveAttribute("title");
expect(button).toHaveAccessibleName("Play evening music");
expect(button).toHaveAttribute("aria-pressed", "false");
expect(button.textContent).toBe("");
expect(button.className).toContain("min-h-[48px]");
```

Cover all four presentations, loading/error non-colour state, focus, long localized accessible names, and RTL logical placement.

- [ ] **Step 2: Run RED**

Run: `npx vitest run src/components/navigation-v2/__tests__/BackgroundMusicToggle.test.tsx src/components/auth-screen/__tests__/AuthScreen.providers.test.tsx`

- [ ] **Step 3: Implement one icon-only button**

Use `Volume2`, `VolumeX`, and `LoaderCircle`/a warning affordance inside `aria-hidden` icon wrappers. Keep `data-app-background-music-control` so blocked autoplay gestures never recursively retrigger.

- [ ] **Step 4: Replace auth ambience card**

Remove the separate auth `<audio>` and labelled control, insert `<BackgroundMusicToggle presentation="auth" />`, and preserve entry safe-area, provider buttons, recovery choices, and legal content.

- [ ] **Step 5: Run GREEN, i18n, a11y, and visual tests**

Run the RED command plus `npm run i18n:check`, `npm run check:translation-quality`, and relevant Auth/Drawer/Sidebar screenshot suites.

---

### Task 5: Soft Theme Transition Coordinator

**Files:**
- Create: `src/lib/themeTransition.ts`
- Create: `src/lib/__tests__/themeTransition.test.ts`
- Create: `src/styles/__tests__/themeTransition.test.ts`
- Modify: `src/stores/themeStore.ts`
- Modify: `src/stores/__tests__/themeStore.test.ts`
- Modify: `src/components/EntryThemeSwitcher.tsx`
- Modify: `src/components/__tests__/EntryThemeSwitcher.test.tsx`
- Modify: `src/components/navigation-v2/ThemeToggleV2.tsx`
- Modify: `src/components/navigation-v2/__tests__/ThemeToggleV2.test.tsx`
- Modify: `src/index.css`

**Interfaces:**
- Produces: `prepareThemeTransition(): ThemeTransitionHandle` with `commitSucceeded()` and `cancel()`.
- Theme store persists first, prepares from the actual old palette, applies the new theme, then releases the handle.

- [ ] **Step 1: Capture current Android before evidence**

Record exact APK/base hashes, an uncut drawer theme round-trip video, fresh logcat, and a separate CDP-off frame pass. Preserve the current instant behavior as the baseline, including any existing failure.

- [ ] **Step 2: Write RED coordinator and CSS tests**

```ts
const first = prepareThemeTransition();
const second = prepareThemeTransition();
expect(first.cancelled).toBe(true);
expect(document.querySelector("[data-theme-transition-veil]")).toBeInTheDocument();
expect(themeCss).not.toMatch(/backdrop-filter|filter:\s*blur|::view-transition/);
```

Cover reduced motion, unavailable DOM, persistence failure, animation end, timeout fallback, unmount/rapid cancellation, and removal of every temporary token.

- [ ] **Step 3: Run RED**

Run: `npx vitest run src/lib/__tests__/themeTransition.test.ts src/styles/__tests__/themeTransition.test.ts src/stores/__tests__/themeStore.test.ts src/components/__tests__/EntryThemeSwitcher.test.tsx src/components/navigation-v2/__tests__/ThemeToggleV2.test.tsx`

- [ ] **Step 4: Implement coordinator and opacity-only CSS**

Set one old-background custom property on a dedicated fixed body-child veil with `pointer-events:none`, `opacity`, and the approved easing/duration, then remove the element and local drawer classes. Never mutate a transition-state attribute on `<html>`.

- [ ] **Step 5: Route every theme entry point through the store boundary**

Remove component-local timeout ownership from `ThemeToggleV2`; store/coordinator logic must be identical for Entry, Drawer, Sidebar, Settings, system preference, and storage convergence where animation is applicable.

- [ ] **Step 6: Run GREEN and Android after evidence**

Run the RED command, then ten exact Android round trips. Reject on a >103 ms action-window gap, blank/partial/stale frame, tile warning, context loss, crash, or visual regression.

---

### Task 6: Cross-Platform And Security Verification

**Files:**
- Update task evidence only where the repository requires tracked release notes or exact manifests.

**Interfaces:**
- Produces a complete evidence matrix, not new product behavior.

- [ ] **Step 1: Run focused and full code gates**

Run typecheck, lint, focused tests, full release tests, `check:all`, i18n, translation, canonical-orb, no-AI-template, app-audio, production-data-integrity source/bundle, size, and build commands separately.

- [ ] **Step 2: Run security scans**

Run the narrow local Snyk Code fallback if MCP is unavailable, then `/Users/yehor/.codex/bin/codex-security-suite.sh` with the standard code profile and no DAST target. Fix task-attributable findings and rerun.

- [ ] **Step 3: Verify Web/PWA/iOS/Desktop boundaries**

Use browser/Playwright for normal/reduced motion, phone/desktop, paper/ink, `en/ja/ar/he`, offline cache, console, and network. Run Capacitor iOS sync/build evidence and Tauri checks where available; mark unavailable runtime targets UNVERIFIED.

- [ ] **Step 4: Run Android MCP audio and lifecycle matrix**

Install the exact APK through MCP, compare installed bytes, start music on auth, verify non-silent output, complete auth, open drawer, stop/start, background/foreground, start competing ambience, mute/unmute, and inspect crash/media logs.

---

### Task 7: Human Audio Review Gate

**Files:**
- Modify only after owner input: `docs/audio/zenflow-evening-collection-review.json`

**Interfaces:**
- Consumes one owner decision for every exact master ID and SHA-256.
- Produces `AUDIO_FIT_PASS_RUNTIME_VERIFIED` only when every technical check and required listening context passes; it never creates legal advice.

- [ ] **Step 1: Open the exact ten-file review folder**

Provide SHA-256 and duration for each file. The owner listens to every track and its loop boundary on headphones and a speaker.

- [ ] **Step 2: Record only real owner decisions**

Do not invent reviewer identity, time, device, decision, or reasons. A rejected master returns to Task 1 with a new hash and requires re-review.

---

### Task 8: PR, Main Integration, And Internal Testing

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `docs/release/google-play/GOOGLE_PLAY_LOCALIZED_LISTING_PACKET.json`
- Modify after live Play inspection: `android/app/build.gradle`

**Interfaces:**
- Produces one exact-tip PR, one merged main commit, one signed uniquely versioned AAB, and one Internal testing release.

- [ ] **Step 1: Review and commit the batch**

Read `memory/feedback_commit_pipeline_knowledge.md`, create current verification evidence with test counts, inspect the final diff/status and secrets/mock scans, then commit with a single-quoted message containing `batch`.

- [ ] **Step 2: Push and merge through required checks**

Push only the same-named Codex branch, run exact-tip handoff, open the PR with the change notice and evidence matrix, wait for required checks, and merge normally. Do not bypass, force-push, or push directly to main.

- [ ] **Step 3: Remove the temporary lane only after recovery proof**

Verify the merge commit is on `origin/main`, the PR retains every commit, and the lane is clean. Then remove the one temporary worktree/branch and return to clean main.

- [ ] **Step 4: Inspect Play and choose the next version**

Read the live maximum version code and upload certificate. Set the new code to exactly one greater than the maximum compatible uploaded version; keep versionName aligned with the release cycle.

- [ ] **Step 5: Build and bind the signed AAB**

Build from exact merged main with the existing authorized upload key and real release configuration. Verify AAB SHA-256, signer, manifest, package/version, forward-only schema, audio inventory, no mock/sample IDs, and bundle integrity.

- [ ] **Step 6: Upload only to Internal testing**

Upload the bound AAB and release notes, confirm the target is Internal testing, then pause immediately before the rollout action for required action-time owner confirmation. After confirmation, roll out and verify processing/availability without touching Production.

---

## Final Self-Review

- Every Spec Kit FR-001 through FR-032 maps to Tasks 1-8.
- Every buildable SC maps to generator/QC, component tests, Android visual/performance proof, cross-platform gates, human review, or release binding.
- Function and state names are consistent across tasks.
- No placeholder, hidden implementation omission, mock production path, dependency addition, broader Play track, or unsupported completion claim is permitted.
