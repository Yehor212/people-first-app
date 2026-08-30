# Android Habit TGS And Nature Audio Implementation Plan

> Execution mode: SOLO with `superpowers:executing-plans`. No subagents, commit, push, merge, public rollout, or non-Android runtime expansion.

**Goal:** Replace the six mapped Android habit icons with the exact static first frame of their Telegram TGS, keep every poster and animated frame clipped inside the circular control, play the matching one-shot on icon hold and on a real incomplete-to-complete transition, and restore the already-bundled Hyperfocus nature audio in the Android WebView without persistent idle animation work.

**Architecture:** Keep `V2HabitPictogram` as the public icon boundary. On Android, mapped icons use a generated vector poster serialized from TGS frame 0 as the always-present visual; Web/PWA/iOS/Desktop retain the existing reduced SVG. Mount a lazy SVG Lottie layer only for a fresh playback token, reveal it after `DOMLoaded`, clip both layers to the inherited round boundary, then destroy the renderer after completion, cancellation, lifecycle change, or failure. `HeroWeeklyHabitCard` owns hold semantics and completion-edge detection. Reuse the canonical app-audio public-path resolver instead of changing the audio engine or assets.

**Tech stack:** React 18, TypeScript, Capacitor 8 Android, `lottie-web` light SVG renderer, `fflate`, Vitest/Testing Library, ADB, WebView CDP, screenrecord, Gradle.

## Explicit requirements

- Map water, boots, meditation, smoke, toys, and diary TGS files to the matching habit pictogram ids.
- Support both day and night diary variants.
- Use the exact first TGS frame instead of the legacy icon at rest on Android.
- Keep the poster and every animation frame inside the circular icon boundary.
- Play on icon hold without accidentally completing the habit.
- Play automatically only when the habit changes from incomplete to complete.
- Restore existing nature sounds on the Android emulator.
- Build an APK, perform real user-like video QA, and upload the verified Play artifact to a safe draft/test path.

## Implied requirements

- Keep short-tap, numeric-entry, row long-press/action-sheet, keyboard, RTL, 44px targets, and accessibility semantics unchanged.
- Never autoplay on initial mount, uncompletion, Web/PWA/iOS/Desktop, reduced motion, low-battery/runtime-limited mode, or unsupported habit ids.
- Keep the exact first-frame TGS poster visible until Lottie `DOMLoaded`; one renderer maximum per icon; no loop; no blank frame; deterministic teardown and session circuit breaker.
- Validate gzip, dimensions, frame rate, duration, vector-only structure, expressions, hashes, and size before shipping.
- Do not promote quarantined external Kimi audio; use only tracked, provenance-bound MP3s already shipped under `public/sounds`.
- Build APK for direct inspection and AAB for Play because Play distribution uses app bundles; upload is not publication.

## Task 1: Freeze source evidence and reproduce

**Read/inspect:** supplied `.tgs`, existing day/night journal TGS, habit icon registry/player/card tests, `ambientSounds.ts`, bundled Android public assets.

- Render continuous previews/contact sheets for all supplied animations and both diary candidates.
- Verify exact asset hashes and structural constraints.
- On the API 36 emulator, navigate by semantic controls, select a nature variant, and capture WebView/logcat evidence for the failing URL/playback state.
- Record the baseline as `FIXED`, `NOT_REPRODUCIBLE`, or `UNVERIFIED`; do not infer from source alone.

## Task 2: RED tests

**Modify:**

- `src/components/habit-pictogram/__tests__/HabitMotionPlayer.test.tsx`
- `src/components/habit-pictogram/__tests__/V2HabitPictogram.test.tsx`
- `src/pages/nav-v2/habits/hero/__tests__/HeroWeeklyHabitCard.test.tsx`
- `src/lib/__tests__/ambientSounds.test.ts`

- Prove approved mapping and day/night diary resolution.
- Prove mapped Android idle state uses the exact frame-0 poster, including reduced motion, and never exposes the legacy SVG.
- Prove the poster/runtime wrappers inherit the round clipping boundary and cannot paint outside it.
- Prove Android-only fresh token starts one non-looping player, static remains until ready, completion/error/unmount destroy it, and reduced motion imports nothing.
- Prove 450ms icon hold plays once and suppresses the following click; movement/cancel stops the hold; short click keeps existing behavior.
- Prove initial-complete does not play, false-to-true does, and true-to-false does not.
- Prove Vite/Capacitor base `.` resolves generated MP3s to `/sounds/...`, not `.sounds/...`.

Run the focused suite and preserve the expected RED output before production edits.

## Task 3: Production implementation

**Create:**

- Six mapped TGS assets under `src/assets/habit-icons/v2/<id>/` with two journal theme variants.
- `src/components/habit-pictogram/habitTgsRuntime.ts`
- `src/components/habit-pictogram/HabitMotionPlayer.css`

**Modify:**

- `habitMotionAssets.ts`, `HabitMotionPlayer.tsx`, `V2HabitPictogram.tsx`
- `HabitIconVisual.tsx`, `HeroWeeklyHabitCard.tsx`
- `ambientSounds.ts`

- Add explicit approved metadata and theme-aware TGS URLs.
- Lazy import `lottie_light`/`fflate`, fetch same-origin with `force-cache`, validate before rendering, use `runExpressions:false`, `loop:false`, `autoplay:false`.
- Keep the exact frame-0 poster underneath on Android, retain reduced SVG only for unmapped or non-Android surfaces, reveal the overlay only at `DOMLoaded`, destroy immediately on terminal state, and cap remembered/cached state.
- Add pointer hold state machine with 10px tolerance and click suppression; preserve the existing row hold action sheet.
- Track the previous completion value after mount and emit a playback token only for a later false-to-true edge.
- Replace raw generated audio URL concatenation with `resolveAppAudioAssetSrc`.

## Task 4: Verification and Android user journey

- Re-run the exact RED tests GREEN, then related habit/audio tests, typecheck, lint, `check:canonical-orbs`, `check:visual`, `check:all`, build, PDI source/bundle, and scoped Snyk.
- Sync Android, assemble/install the release-like candidate, verify APK hash and bundled TGS/MP3 paths.
- Record one continuous user journey: open Habits, short tap, hold each mapped icon, complete/uncomplete, switch day/night for diary, scroll/collapse/action sheet, select and hear multiple nature sounds, background/foreground, Android Back, rotation, reduced motion.
- Inspect WebView console/network, logcat, renderer count, memory trend, context loss, and frame pacing separately from visual capture.
- Run inline `visual-integrity-critic` with Technical, Visual Runtime, Artistic/Craft, Motion, Model, and Plan rows.

## Task 5: Artifact and Play boundary

- Inspect current Play Console version/track before selecting the next versionCode; do not assume memory is current.
- Produce a directly installable APK and a signed AAB from the exact verified source/artifact set.
- Upload only to an internal/draft test path. Stop for legal agreements, identity checks, missing signing authority, conflicting version code, or any request to publish/roll out.
- Report artifact hashes, track/draft state, and explicitly separate `uploaded`, `submitted`, and `published`.

## Platform matrix

| Surface | Status target |
|---|---|
| Android/Capacitor | Full implementation and emulator runtime evidence; physical-device performance remains UNVERIFIED if absent |
| Web/Vite | Shared build regression check; new habit motion runtime intentionally disabled |
| Installed PWA | Shared build regression check; new habit motion runtime intentionally disabled |
| iOS/WKWebView | Shared build regression check; new habit motion runtime intentionally disabled |
| Desktop/Tauri | Shared build regression check; new habit motion runtime intentionally disabled |
| Store/Release | Android Play draft/internal upload only; no production rollout |

## Stop conditions

- Any visual downgrade, blank/removed icon, duplicate loop, accidental check-in on hold, audio regression, or failed required gate blocks upload.
- Any need to redesign habit storage, weaken reduced motion, lower TGS quality, add a production dependency, use private user data, or widen beyond Android requires a new user decision.
- Missing physical devices or subjective listening approval stays `UNVERIFIED`; it is not converted to PASS by the emulator.
