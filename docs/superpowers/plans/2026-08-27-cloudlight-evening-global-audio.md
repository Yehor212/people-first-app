# Cloudlight Evening Global Audio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve the existing fūrin notification sound and ship a separate original 150-second Cloudlight Evening loop with persistent, accessible sidebar/drawer control, single-ambience ownership, cross-platform packaging, strict audio evidence, and a hash-bound Telegram Saved Messages handoff.

**Architecture:** A deterministic generator owns the long MP3 and rights/QC receipts. A small device-local preference plus an exclusive long-audio coordinator feed a V2-shell background-music provider; the shared control appears in both `SidebarV2` and `DrawerV2`. Playback remains foreground-only, respects existing master audio and comfort gates, and handles autoplay blocking through a first-eligible-gesture resume.

**Tech Stack:** React 18, TypeScript, Vitest/Testing Library, Vite/Workbox PWA, Capacitor 8, Tauri, deterministic Node.js PCM/MP3 generation, Android Gradle/adb, macOS AudioToolbox utilities.

**Spec:** `docs/superpowers/specs/2026-08-27-cloudlight-evening-global-audio-design.md`

## Global Constraints

- Execution stays in `/Users/yehor/Projects/ZenFlow/worktrees/codex-audio-cc0-rights-pack-20260825` on its locked `codex/` branch.
- Local commits are allowed; push, deployment, store actions, and release publication are not authorized.
- Fūrin remains the optional Android notification profile and `feedback-notification.mp3` remains its preview.
- Cloudlight Evening is a separate original 150-second asset with no reference waveform, sample, score, melody, harmony, stem, stock loop, voice, field recording, or model-generated audio input.
- Asset-specific notice: `Copyright © 2026 Yehor212 / ZenFlow. All rights reserved.` No repository-wide license is implied.
- First-ever background-music state is off. Later auto-resume is eligible only after explicit opt-in and remains subject to browser/WebView policy.
- One long ZenFlow audio owner at a time; short feedback and notifications remain outside the exclusivity coordinator.
- No new paid service, production dependency, native background service, cloud preference, analytics event, auth/sync/storage migration, or mock production fallback.
- UI copy is localized in `en`, `uk`, `es`, `de`, `fr`, `ja`, `ar`, and `he`; phone targets are at least 48 CSS px and desktop targets at least 44 CSS px.
- Technical metrics never become a claim of pleasantness, legal clearance, ITU-R BS.1770, EBU R 128, physical-device behavior, store readiness, or release publication without the matching evidence.

---

### Task 1: Restore the approved Fūrin notification contract

**Files:**
- Modify: `src/lib/__tests__/notificationSounds.test.ts`
- Modify: `src/lib/__tests__/nativePushRealm.test.ts`
- Modify: `src/lib/__tests__/localNotifications.test.ts`
- Modify: `src/pages/nav-v2/__tests__/SettingsPage.test.tsx`
- Modify: `android/app/src/test/java/com/zenflow/app/NotificationChannelContractTest.java`
- Modify: `android/app/src/test/java/com/zenflow/app/PushDeliveryPermitTest.java`
- Modify: `src/lib/notificationSounds.ts`
- Modify: `src/lib/nativePushRealm.ts`
- Modify: `src/lib/pushNotifications.ts`
- Modify: `android/app/src/main/java/com/zenflow/app/NotificationChannelContract.java`
- Modify: `android/app/src/main/java/com/zenflow/app/PushDeliveryPermit.java`
- Modify: `android/app/src/main/java/com/zenflow/app/ZenFlowMessagingService.java`
- Modify: `android/app/src/main/res/values*/strings.xml`
- Modify: `src/i18n/types.ts`
- Modify: `src/i18n/languages/*.ts`

**Interfaces:**
- Produces: `NotificationSoundType = "default" | "furin" | "gentle" | "silent"` and immutable channel `zenflow_furin_v5` with raw resource `zenflow_furin.wav`.
- Preserves: default/gentle/silent channel IDs and reminder rescheduling/rollback behavior.

- [ ] **Step 1: Restore failing notification expectations first**

Use literal expectations in TypeScript and Java:

```ts
expect(NOTIFICATION_SOUNDS.map((sound) => sound.channelId)).toEqual([
  "zenflow_default_v4",
  "zenflow_furin_v5",
  "zenflow_gentle_v4",
  "zenflow_silent_v4",
]);
expect(NOTIFICATION_SOUNDS[1]).toMatchObject({
  id: "furin",
  labelKey: "soundFurin",
  sound: "zenflow_furin.wav",
});
```

```java
NotificationChannelContract.Profile profile =
    NotificationChannelContract.profileFor("zenflow_furin_v5");
assertEquals("zenflow_furin", profile.soundResourceName());
```

- [ ] **Step 2: Run RED against the current mistaken Cloudlight-notification diff**

Run:

```bash
npx vitest run src/lib/__tests__/notificationSounds.test.ts src/lib/__tests__/nativePushRealm.test.ts src/lib/__tests__/localNotifications.test.ts src/pages/nav-v2/__tests__/SettingsPage.test.tsx
cd android && ./gradlew :app:testDebugUnitTest --tests com.zenflow.app.PushDeliveryPermitTest --tests com.zenflow.app.NotificationChannelContractTest --rerun-tasks --console=plain
```

Expected: failures name `cloudlight`, `zenflow_cloudlight_v5`, or `zenflow_cloudlight.wav` where Fūrin literals are required.

- [ ] **Step 3: Restore production identifiers and all eight translations**

Restore the existing user-facing concept:

```ts
{
  id: "furin",
  labelKey: "soundFurin",
  description: "Soft Japanese glass wind-bell",
  channelId: "zenflow_furin_v5",
  sound: "zenflow_furin.wav",
  vibrate: true,
  importance: 3,
}
```

Restore matching native resource names and localized channel copy. Remove Cloudlight identifiers only from notification code; the later long asset uses `cloudlight-evening-loop` and never a notification channel.

- [ ] **Step 4: Run GREEN and exact stale-string checks**

Run the Step 2 commands again, then:

```bash
rg -n "zenflow_cloudlight_v5|zenflow_cloudlight\.wav|soundCloudlight" src android/app/src/main --glob '!**/build/**'
```

Expected: tests pass; the search returns no notification occurrence.

- [ ] **Step 5: Commit only the notification restoration**

```bash
git add src/lib src/pages/nav-v2/__tests__/SettingsPage.test.tsx src/i18n android/app/src/main android/app/src/test
git commit -m 'fix(notifications): batch restore furin sound profile'
```

### Task 2: Generate and audit the original 150-second loop

**Files:**
- Modify: `scripts/__tests__/check-app-audio-assets.test.ts`
- Modify: `scripts/generate-non-hyperfocus-audio.cjs`
- Modify: `scripts/check-app-audio-assets.cjs`
- Modify: `src/lib/appAudioAssets.ts`
- Modify: `src/lib/__tests__/appAudioAssets.test.ts`
- Modify: `docs/audio/non-hyperfocus-generated-audio-provenance.json`
- Modify: `docs/audio/non-hyperfocus-sound-effects-policy.md`
- Modify: `docs/audits/audio-web-research-plan-2026-06-19.md`
- Create: `docs/audio/cloudlight-evening-license.md`
- Create: `public/sounds/cloudlight-evening-loop.mp3`
- Create: `docs/sounds/cloudlight-evening-loop.mp3`
- Restore: `public/sounds/feedback/feedback-notification.mp3`
- Restore: `docs/sounds/feedback/feedback-notification.mp3`
- Restore: `android/app/src/main/res/raw/zenflow_furin.wav`
- Remove: `android/app/src/main/res/raw/zenflow_cloudlight.wav`

**Interfaces:**
- Produces manifest asset ID `cloudlight-evening-loop` with family `entry`, comfort texture `air`, `warmCacheOnStartup: false`, and all five platform tags.
- Produces deterministic rights receipt with asset-specific proprietary notice and explicit missing root-license boundary.

- [ ] **Step 1: Add RED inventory, rights, and signal contracts**

Add literal asset expectations:

```ts
expect(getAppAudioAsset("cloudlight-evening-loop")).toMatchObject({
  publicPath: "sounds/cloudlight-evening-loop.mp3",
  startsOnUserGesture: true,
  respectsMasterVolume: true,
  warmCacheOnStartup: false,
});
```

Extend the QC fixture to require source duration `150`, decoded duration in the MP3-padding window, stereo 44.1 kHz, deterministic spec, matching public/docs hashes, no clips, bounded DC/transient/high-frequency energy, stereo/mono safety, seam metrics, and the exact notice:

```text
Copyright © 2026 Yehor212 / ZenFlow. All rights reserved.
```

- [ ] **Step 2: Run RED**

```bash
npx vitest run src/lib/__tests__/appAudioAssets.test.ts scripts/__tests__/check-app-audio-assets.test.ts
```

Expected: missing asset, missing provenance/license receipt, missing 150-second thresholds, and missing output file.

- [ ] **Step 3: Add deterministic composition synthesis**

In the existing generator, define a separate long-music asset and render it from tracked numeric structures:

```js
{
  id: "cloudlight-evening-loop",
  fileName: "cloudlight-evening-loop.mp3",
  role: "Persistent opt-in app-entry background music",
  seed: 0xc10d1e57,
  durationSeconds: 150,
  tempoBpm: 62,
  targetRms: 0.045,
  targetPeak: 0.22,
  runtimeGain: 0.18,
  loopCrossfadeSeconds: 4,
  deterministicSpec: "original-four-section-felt-piano-air-pad-circular-loop",
}
```

Use an independently selected suspended/open-fifth/add-note pitch pool, four deterministic density sections, softened additive felt-piano attacks, partial-dependent decay, a restrained synthetic air pad, linked stereo gain, DC removal, a four-second equal-power circular crossfade, and quiet-boundary rotation. Do not add any external decoder input or reference-derived note data.

- [ ] **Step 4: Add decoded long-loop checks**

Extend `parseWavMetrics` or a focused long-loop inspector to return:

```ts
{
  peak: number;
  rms: number;
  dcOffsetAbs: number;
  transientDelta: number;
  audibleBandEnergyRatio: number;
  highFrequencyEnergyRatio: number;
  stereoCorrelation: number;
  monoFoldDownEnergyRatio: number;
  boundaryDelta: number;
  boundarySlopeDelta: number;
  startEndRmsDelta: number;
  maxSilentWindowSeconds: number;
}
```

Fail closed on missing/non-finite metrics. Keep formal LUFS/dBTP status `UNVERIFIED` unless a standards-compliant meter actually runs.

- [ ] **Step 5: Regenerate twice and prove deterministic hashes**

```bash
npm run audio:generate-non-hyperfocus
shasum -a 256 public/sounds/cloudlight-evening-loop.mp3 docs/sounds/cloudlight-evening-loop.mp3 docs/audio/non-hyperfocus-generated-audio-provenance.json
npm run audio:generate-non-hyperfocus
shasum -a 256 public/sounds/cloudlight-evening-loop.mp3 docs/sounds/cloudlight-evening-loop.mp3 docs/audio/non-hyperfocus-generated-audio-provenance.json
npm run check:app-audio -- --write-report
```

Expected: both hash sets are byte-identical; QC passes; fūrin public/docs/native hashes match their restored provenance.

- [ ] **Step 6: Commit the generator, assets, policy, and receipt**

```bash
git add scripts src/lib/appAudioAssets.ts src/lib/__tests__/appAudioAssets.test.ts docs/audio docs/audits docs/sounds public/sounds android/app/src/main/res/raw
git commit -m 'feat(audio): batch add Cloudlight Evening loop'
```

### Task 3: Add the device-local preference and exclusive ambience coordinator

**Files:**
- Modify: `src/lib/storageKeys.ts`
- Create: `src/lib/appBackgroundMusicPreference.ts`
- Create: `src/lib/audioPlaybackCoordinator.ts`
- Create: `src/lib/__tests__/appBackgroundMusicPreference.test.ts`
- Create: `src/lib/__tests__/audioPlaybackCoordinator.test.ts`

**Interfaces:**
- Produces: `getAppBackgroundMusicEnabled(): boolean`.
- Produces: `trySetAppBackgroundMusicEnabled(enabled: boolean): { ok: boolean; enabled: boolean }`.
- Produces: `claimLongAudio(ownerId: LongAudioOwnerId, pause: () => void): () => void` and `subscribeLongAudioOwner(listener): () => void`.

- [ ] **Step 1: Write RED preference tests**

```ts
expect(getAppBackgroundMusicEnabled()).toBe(false);
expect(trySetAppBackgroundMusicEnabled(true)).toEqual({ ok: true, enabled: true });
expect(getAppBackgroundMusicEnabled()).toBe(true);
```

Mock a failed repository storage-helper write and require `{ ok: false, enabled: previous }` without publishing a change event.

- [ ] **Step 2: Write RED ownership tests**

```ts
const pauseGlobal = vi.fn();
const releaseGlobal = claimLongAudio("global-cloudlight", pauseGlobal);
const pauseOrb = vi.fn();
const releaseOrb = claimLongAudio("orb-water", pauseOrb);
expect(pauseGlobal).toHaveBeenCalledTimes(1);
expect(getActiveLongAudioOwner()).toBe("orb-water");
releaseOrb();
expect(getActiveLongAudioOwner()).toBeNull();
releaseGlobal();
```

Also prove stale releases cannot clear a newer owner and duplicate claims do not double-pause.

- [ ] **Step 3: Run RED**

```bash
npx vitest run src/lib/__tests__/appBackgroundMusicPreference.test.ts src/lib/__tests__/audioPlaybackCoordinator.test.ts
```

Expected: modules and exported functions are absent.

- [ ] **Step 4: Implement storage-helper-only persistence and synchronous coordinator**

Use `SK.APP_BACKGROUND_MUSIC_ENABLED = "zenflow-app-background-music-enabled"`; store a JSON boolean through `safeLocalStorageGet`/`safeLocalStorageSet`. The coordinator keeps no user data, performs no async work, and notifies subscribers only after an actual owner change.

- [ ] **Step 5: Run GREEN and commit**

```bash
npx vitest run src/lib/__tests__/appBackgroundMusicPreference.test.ts src/lib/__tests__/audioPlaybackCoordinator.test.ts
git add src/lib/storageKeys.ts src/lib/appBackgroundMusicPreference.ts src/lib/audioPlaybackCoordinator.ts src/lib/__tests__
git commit -m 'feat(audio): add background music preference and ownership'
```

### Task 4: Build the global playback provider and lifecycle state machine

**Files:**
- Create: `src/hooks/useAppBackgroundMusic.ts`
- Create: `src/hooks/__tests__/useAppBackgroundMusic.test.tsx`
- Create: `src/components/navigation-v2/AppBackgroundMusicProvider.tsx`
- Create: `src/components/navigation-v2/__tests__/AppBackgroundMusicProvider.test.tsx`
- Modify: `src/components/navigation-v2/NavV2Orchestrator.tsx`
- Modify: `src/lib/audioMediaSession.ts`
- Modify: `src/lib/audioLifecycle.ts`
- Modify: `src/lib/__tests__/audioLifecycle.test.ts`

**Interfaces:**
- Produces context hook `useAppBackgroundMusicControl(): AppBackgroundMusicControl`.
- `AppBackgroundMusicControl` contains `enabled`, `state`, `toggle`, and `retry`.
- States are `off | blocked | loading | playing | paused | error`.

- [ ] **Step 1: Write RED state-machine tests**

Cover these literal transitions:

```text
off --toggle--> loading --play resolves--> playing
off --toggle--> loading --NotAllowedError--> blocked
blocked --eligible gesture--> loading/playing
playing --master mute--> paused
playing --ambient comfort off--> paused
playing --background--> paused
loading --toggle off--> off, and late play resolution stays off
error --retry--> loading
```

Assert `preload="none"`, `loop`, `playsInline`, same-origin source, media-session pause/stop handlers, and cleanup of listeners/timers.

- [ ] **Step 2: Run RED**

```bash
npx vitest run src/hooks/__tests__/useAppBackgroundMusic.test.tsx src/components/navigation-v2/__tests__/AppBackgroundMusicProvider.test.tsx src/lib/__tests__/audioLifecycle.test.ts
```

Expected: provider/hook and new lifecycle registration are absent.

- [ ] **Step 3: Implement one shell-level media element**

The provider resolves `getAppAudioAssetSrc("cloudlight-evening-loop")`, mounts one hidden audio element, claims `global-cloudlight`, applies `appAudio.volume * 0.18`, and uses generation counters plus an `AbortController`/listener cleanup so stale promises cannot revive playback.

On saved enabled state, call `play()` once after mount. Convert `NotAllowedError` to `blocked` and install one-shot `pointerdown`, `touchstart`, `touchend`, and eligible keyboard listeners. Other failures become `error` without external fallback.

- [ ] **Step 4: Integrate foreground lifecycle and media session**

Register provider pause with `registerAudioBackgroundPauseHandler`. On foreground, remain paused/blocked until the saved preference and an eligible gesture allow resume. Do not create native background playback. Media Session metadata uses title `Cloudlight Evening` and artist `ZenFlow`.

- [ ] **Step 5: Wrap the V2 shell and run GREEN**

Mount `AppBackgroundMusicProvider` above the V2 root so route changes do not recreate it. Rerun Step 2 tests plus `src/components/navigation-v2/__tests__/NavV2Orchestrator.test.tsx`.

- [ ] **Step 6: Commit**

```bash
git add src/hooks src/components/navigation-v2/AppBackgroundMusicProvider.tsx src/components/navigation-v2/NavV2Orchestrator.tsx src/components/navigation-v2/__tests__ src/lib/audioMediaSession.ts src/lib/audioLifecycle.ts src/lib/__tests__/audioLifecycle.test.ts
git commit -m 'feat(audio): add persistent Cloudlight playback controller'
```

### Task 5: Enforce single-owner behavior across existing long ambience

**Files:**
- Modify: `src/hooks/useUserStartedAmbienceAudio.ts`
- Modify: `src/hooks/__tests__/useUserStartedAmbienceAudio.test.tsx`
- Modify: `src/components/auth-screen/AuthScreen.tsx`
- Modify: `src/pages/nav-v2/OrbAmbienceControl.tsx`
- Modify: `src/features/journal/JournalAmbienceSetting.tsx`
- Modify: `src/components/hyperfocus/useHyperfocusAudio.ts`
- Test: existing Hyperfocus audio tests selected by `rg` after reading the hook's current test owner.

**Interfaces:**
- Extends `UseUserStartedAmbienceAudioOptions` with required `ownerId: LongAudioOwnerId`.
- Surface owners use `auth-soft-air`, `orb-water`, `diary-rain`; Hyperfocus uses `hyperfocus`.

- [ ] **Step 1: Add RED ownership tests to the shared ambience hook**

Assert that a successful start claims its owner, replacement invokes pause/stop, ordinary stop releases only its own claim, and unmount releases without clearing a newer owner.

- [ ] **Step 2: Run RED**

```bash
npx vitest run src/hooks/__tests__/useUserStartedAmbienceAudio.test.tsx src/lib/__tests__/audioLifecycle.test.ts
```

Expected: `ownerId` and coordinator calls are absent.

- [ ] **Step 3: Implement claim/release in the hook and Hyperfocus**

Claim before the first audible `play()` call and release on stop, failure, disable, background pause, and unmount. Pass literal owner IDs from each existing call site. Hyperfocus claims on direct/async start and releases on stop/unmount.

- [ ] **Step 4: Run GREEN and interaction regression tests**

```bash
npx vitest run src/hooks/__tests__/useUserStartedAmbienceAudio.test.tsx src/lib/__tests__/audioLifecycle.test.ts src/pages/nav-v2/__tests__/DiaryPage.audio.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useUserStartedAmbienceAudio.ts src/hooks/__tests__/useUserStartedAmbienceAudio.test.tsx src/components/auth-screen/AuthScreen.tsx src/pages/nav-v2/OrbAmbienceControl.tsx src/features/journal/JournalAmbienceSetting.tsx src/components/hyperfocus
git commit -m 'fix(audio): batch prevent overlapping ambience'
```

### Task 6: Add one accessible navigation control to desktop and phone surfaces

**Files:**
- Create: `src/components/navigation-v2/BackgroundMusicToggle.tsx`
- Create: `src/components/navigation-v2/__tests__/BackgroundMusicToggle.test.tsx`
- Modify: `src/components/navigation-v2/SidebarV2.tsx`
- Modify: `src/components/navigation-v2/DrawerV2.tsx`
- Modify: `src/components/navigation-v2/__tests__/SidebarV2.test.tsx`
- Modify: `src/components/navigation-v2/__tests__/DrawerV2.test.tsx`
- Modify: `src/i18n/types.ts`
- Modify: `src/i18n/languages/en.ts`
- Modify: `src/i18n/languages/uk.ts`
- Modify: `src/i18n/languages/es.ts`
- Modify: `src/i18n/languages/de.ts`
- Modify: `src/i18n/languages/fr.ts`
- Modify: `src/i18n/languages/ja.ts`
- Modify: `src/i18n/languages/ar.ts`
- Modify: `src/i18n/languages/he.ts`

**Interfaces:**
- Consumes `useAppBackgroundMusicControl()`.
- Produces shared presentations `sidebar-expanded`, `sidebar-collapsed`, and `drawer`.

- [ ] **Step 1: Write RED component and integration tests**

Assert a native button with `aria-pressed`, 44/48 px class contracts, visible state, collapsed title, drawer placement above Settings, keyboard activation, and no volume slider. Test states `playing`, `off`, `loading`, `blocked`, and `error`.

- [ ] **Step 2: Add literal copy contract**

Add full-language keys for `Evening music`, `On`, `Off`, `Loading`, `Tap to resume`, `Unavailable`, `Play evening music`, `Pause evening music`, and master/comfort-paused explanations. Preserve RTL-safe whole strings without concatenating natural-language fragments.

- [ ] **Step 3: Run RED**

```bash
npx vitest run src/components/navigation-v2/__tests__/BackgroundMusicToggle.test.tsx src/components/navigation-v2/__tests__/SidebarV2.test.tsx src/components/navigation-v2/__tests__/DrawerV2.test.tsx
```

Expected: shared control and localized keys are absent.

- [ ] **Step 4: Implement shared control and both placements**

Use only lucide icons, theme tokens, current sidebar/drawer surfaces, native button semantics, visible state text, and existing focus-ring patterns. The control never enables master audio or ambient comfort implicitly.

- [ ] **Step 5: Run GREEN, i18n, and RTL checks**

```bash
npx vitest run src/components/navigation-v2/__tests__/BackgroundMusicToggle.test.tsx src/components/navigation-v2/__tests__/SidebarV2.test.tsx src/components/navigation-v2/__tests__/DrawerV2.test.tsx
npm run i18n:check
npm run i18n:deep
```

- [ ] **Step 6: Commit**

```bash
git add src/components/navigation-v2 src/i18n
git commit -m 'feat(navigation): batch add evening music controls'
```

### Task 7: Make large-audio caching intent-based and prove packages

**Files:**
- Modify: `src/lib/appAudioAssets.ts`
- Modify: `src/lib/runtimeAudioCache.ts`
- Modify: `src/lib/__tests__/runtimeAudioCache.test.ts`
- Modify: `src/sw.ts` only if current request-time CacheFirst behavior cannot cache the new path without startup warming.
- Generated/ignored verification targets: `dist`, Android public assets, iOS public assets, Tauri frontend output.

**Interfaces:**
- `AppAudioAsset.warmCacheOnStartup` controls only the warm list; the service-worker runtime audio route continues to cache the asset after the first actual request.

- [ ] **Step 1: Write RED cache-scope tests**

```ts
expect(APP_AUDIO_SW_CACHE_PATHS).not.toContain("sounds/cloudlight-evening-loop.mp3");
expect(isRuntimeAudioPath("/people-first-app/sounds/cloudlight-evening-loop.mp3")).toBe(true);
```

Also assert every existing short/normal asset remains in the startup warm list.

- [ ] **Step 2: Run RED**

```bash
npx vitest run src/lib/__tests__/runtimeAudioCache.test.ts
```

- [ ] **Step 3: Filter startup warming without disabling request-time caching**

Add `warmCacheOnStartup: true` to existing assets and `false` only to Cloudlight. Build `APP_AUDIO_SW_CACHE_PATHS` from warm assets plus feedback/hyperfocus contracts, while the Workbox `CacheFirst` route still matches every same-origin MP3 under `/sounds/`.

- [ ] **Step 4: Run GREEN and production builds**

```bash
npx vitest run src/lib/__tests__/runtimeAudioCache.test.ts
npm run build
npm run cap:sync:android
npm run cap:sync:ios
```

Verify exact MP3 SHA-256 in `dist`, Android, and iOS copied assets. Run `npm run desktop:check`, then `npm run desktop:build` when the local Tauri/Rust toolchain check passes; otherwise record the exact `UNVERIFIED` blocker.

- [ ] **Step 5: Commit source changes only**

```bash
git add src/lib/appAudioAssets.ts src/lib/runtimeAudioCache.ts src/lib/__tests__/runtimeAudioCache.test.ts src/sw.ts
git commit -m 'perf(pwa): cache long music after user intent'
```

### Task 8: Full verification, installed runtime, review, and Telegram handoff

**Files:**
- Modify generated QC report under `output/audio-qc` only as ignored evidence.
- Create/update repository completion evidence only if required by the existing commit hooks.
- External write: one final MP3 and hash message to Telegram Saved Messages after every local required gate.

**Interfaces:**
- Consumes exact final public MP3 SHA-256.
- Produces no production deployment; Telegram readback is the only authorized external mutation.

- [ ] **Step 1: Run complete focused and blast-radius checks**

```bash
npm run typecheck
npm run lint
npm run oxlint
npm run i18n:check
npm run i18n:deep
npm run check:no-ai-templates
npm run check:app-audio -- --write-report
npm run check:production-data-integrity:diff
npm run build
```

Run all focused tests from Tasks 1–7 plus existing `audioManager`, `audioLifecycle`, navigation, Settings, local notification, push realm, and app-audio suites. Do not convert known unrelated baseline warnings into PASS.

- [ ] **Step 2: Run native/platform artifact checks**

```bash
cd android && ./gradlew :app:testDebugUnitTest :app:assembleDebug --rerun-tasks --console=plain
```

Hash the APK and extract/hash the fūrin WAV, Cloudlight MP3, and in-app fūrin preview. Confirm no Cloudlight notification channel/resource exists. Run iOS sync/build checks and Tauri checks as locally supported.

- [ ] **Step 3: Verify Web/PWA and installed Android behavior**

Use semantic browser/CDP or Playwright interaction to prove first state off, one-tap enable, playing state, navigation persistence, sidebar/drawer off, blocked-autoplay recovery, master/comfort gate, no startup preload, request-time cache, and background pause/resume.

Install the exact debug APK on the named emulator, drive the phone drawer semantically, confirm the same MP3 hash in the APK, inspect logs for media errors, and separately confirm the fūrin notification channel remains valid.

- [ ] **Step 4: Run scoped security and independent code review**

Read and use `codex-security:security-diff-scan`, then run:

```bash
/Users/yehor/.codex/bin/codex-security-suite.sh --path . --profile quick
```

Use `superpowers:requesting-code-review` for an independent read-only review only because that selected skill explicitly authorizes the review worker. The main agent verifies every finding against the current diff and tests.

- [ ] **Step 5: Inspect final Git boundary and commit**

```bash
git diff --check
git diff --stat
git status --short
git diff --cached --check
git commit -m 'feat(audio): batch ship Cloudlight Evening experience'
```

Stage only task-owned paths. Confirm no secrets, reference audio, unrelated generated files, external URLs, fake data, or unreviewed dependency entered the commit.

- [ ] **Step 6: Send the exact MP3 to Telegram Saved Messages**

Verify an authenticated Telegram session and semantically open `Saved Messages`. Validate `finalSha256` against `/^[a-f0-9]{64}$/`, attach the exact final file, and construct the factual message from the measured values:

```ts
const telegramMessage = [
  "Cloudlight Evening — 2:30 loop",
  "Copyright © 2026 Yehor212 / ZenFlow. All rights reserved.",
  `SHA-256: ${finalSha256}`,
  "Technical status: PASS for the checks listed in the task handoff.",
  "Artistic/pleasantness status: UNVERIFIED until you listen to this exact hash.",
].join("\n");
```

Read back the attachment name, duration/size when exposed, message text, and destination identity. If Telegram is not authenticated or semantic target verification fails, do not send elsewhere; open the local folder and report Telegram as `UNVERIFIED`.

- [ ] **Step 7: Final evidence packet**

Report changed behavior, exact hashes, test counts, platform matrix, technical audio metrics, security results, commit SHA, Telegram readback, missing physical/store evidence, and the human pleasantness boundary. Include exactly one Best Practices implied-work line required by repository policy.
