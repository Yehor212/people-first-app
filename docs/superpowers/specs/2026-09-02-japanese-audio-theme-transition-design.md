# ZenFlow Evening Collection And Soft Theme Transition Design

**Status**: Implemented; technical release evidence and owner audio review pending

**Spec Kit source**: `specs/003-japanese-audio-theme/spec.md`

## Goal

Ship ten original, local, loop-safe ZenFlow music pieces through one first-run-silent player that spans account entry and authenticated navigation, expose only a sound-state icon on those surfaces, and soften light/dark changes without restoring the Android snapshot/compositor failure path.

## Current Evidence

- `AppBackgroundMusicProvider` currently owns one Cloudlight `<audio>` element only inside `NavV2Orchestrator`, so it does not span account entry.
- `AuthScreen` owns a separate labelled `soft-air-veil` player.
- `BackgroundMusicToggle` renders visible title and status text when navigation is expanded.
- `ThemeToggleV2` commits immediately and deliberately disables drawer colour interpolation because prior Android runs showed partially drawn frames and Chromium tile-memory warnings.
- The tracked non-Hyperfocus pack contains nine files but only one long-form music composition; the other files are three feature ambiences and five short feedback cues.
- The downloaded `Zenflow.m4a` is excluded because its decoded recording matches an unlicensed reference.

## Music Collection

The collection contains the current `cloudlight-evening-loop` and nine new deterministic compositions. Every new piece is authored as numerical notes, timing, voice partials, dynamics, panorama, and a seeded low-level air field. No sample, recording, voice, stock loop, reference waveform, copied score, MIDI input, or model-generated audio enters the generator.

The nine new internal titles are:

1. Lantern Air
2. Rain On Paper
3. Indigo Dusk
4. Quiet Courtyard
5. Moonlit Water
6. Cedar Mist
7. Glass Bell Dawn
8. Moss Garden
9. After Rain

Names are Media Session and evidence metadata only; the icon control never displays track names. The vocabulary signals the requested restrained atmosphere without claiming cultural authenticity.

All masters are 150 seconds, 44.1 kHz stereo MP3 at 128 kbps and use a circular four-second mastering overlap. Their distinct chord fields, pentatonic colours, sparse event patterns, timbre mixes, tempi, and seeds are encoded in source. Objective QC covers exact inventory, deterministic hash regeneration, decode, duration, channels, sample rate, peak/RMS, DC, clipping, transient, silence, mono fold-down, stereo correlation, high-frequency energy, and loop boundary. Human approval remains exact-hash bound and precedes store upload.

## Playback Architecture

The existing provider moves above `AuthGate` but remains inside language and app runtime providers. It continues to use the current master volume, comfort settings, foreground lifecycle, Media Session, runtime cache, and long-audio ownership coordinator.

One media element plays the collection. Near the track boundary it fades to silence, swaps to the next verified master, and fades back to the configured gain. There is no overlapping second decoder. The cursor is device-local and stores only a stable master ID; it is not account data or listening telemetry.

Playback states are `off`, `blocked`, `loading`, `playing`, `fading`, `paused`, `recovering`, and `error`. Every asynchronous play, fade, cache, lifecycle, or error callback is bound to the latest request ID. A corrupt master is skipped once; ten failures stop the player instead of creating an infinite loop.

## Icon-Only Control

`BackgroundMusicToggle` becomes the one control component for `auth`, `sidebar-expanded`, `sidebar-collapsed`, and `drawer`. It renders a single 44-pixel or 48-pixel button with only a sound-state icon. It has no visible label, status, track title, or native `title` tooltip.

The accessible name remains localized. `aria-pressed`, `aria-busy`, a hidden status description, visible focus, keyboard activation, and non-colour loading/error affordances remain. The account-entry instance replaces the separate labelled ambience card; auth provider logic, errors, recovery choices, legal copy, and safe-area layout do not change.

## Theme Transition

The store remains the sole theme authority and persists before DOM commit. Before a successful normal-motion commit, a coordinator samples the actual pre-change background token. It appends one fixed pointer-transparent body-child veil, flushes that one node, applies the atomic new theme, and fades the veil out over 280 milliseconds with `cubic-bezier(0.2, 0, 0, 1)`.

The veil animates opacity only. It does not use blur, filters, backdrop filters, DOM screenshots, root View Transitions, element geometry, or per-element palette interpolation. It owns no focus or input. Reduced motion commits immediately. A new request cancels the previous frame/timer/listener and uses the latest actual theme.

Android drawer palette and blur suppression use temporary classes on the live drawer/backdrop nodes only; no transition attribute is written to `<html>`. The veil masks the perceived jump without allowing intermediate low-contrast element colours. Status-bar style remains delayed until the updated interface crosses its established frames.

## Current Verification Boundary

- `VERIFIED`: ten exact first-party masters pass deterministic provenance and signal/loop QC; one icon-only player spans auth and navigation; Android pause/resume and the Google OAuth round trip work on the installed APK.
- `VERIFIED`: continuous video shows gradual intermediate luminance frames instead of the baseline single-step palette jump.
- `FAIL`: the strict zero-jank/zero-tile Android gate is not met. Fresh Orb runs still contain Chromium tile-memory warnings and rare FrameTimeline `App Deadline Missed` frames; no ANR, crash, context loss, or visible blank frame was observed.
- `STOP`: human listening approval, upload signing identity, and Google Play Internal testing publication remain pending.

## Runtime And Performance Proof

Before and after captures use the same API 36 emulator, display state, exact APK hash, installed `base.apk` hash, route, themes, and semantic controls. Visual and profiler evidence remain separate:

- one continuous emulator-window video for ten theme round trips;
- Android MCP/UI-tree interactions and screenshots for state and geometry;
- a CDP-off Perfetto FrameTimeline/gfxinfo run for the bounded theme journey;
- fresh logcat for tile-memory, context-loss, ANR, crash, and media errors;
- an audio-output capture proving non-silent playback from the exact installed APK.

Acceptance requires feedback within 100 ms, settle within 300 ms, no theme-window presentation gap above 103 ms, no missing/partial/stale frame, and no tile-memory/context-loss signal. Emulator audio playback is technical evidence; musical comfort requires owner listening.

## Platform Behavior

- **Web/Vite**: first-run silent; eligible saved opt-in may resume; icon and theme veil operate without native assumptions.
- **Installed PWA**: only current and next music masters enter the integrity cache after intent; uncached offline music stays unavailable truthfully.
- **Android/Capacitor**: foreground-only playback, single owner, lifecycle pause/resume, exact installed artifact, continuous-video and profiler gates.
- **iOS/WKWebView**: user-gesture unlock and resume re-arm are preserved; no claimed device PASS without simulator/device evidence.
- **Desktop/Tauri**: the same packaged assets and icon-only control; no background service or system-start playback.

## Release

The change moves through the one authorized temporary Codex lane and required PR checks. The branch and worktree are removed only after merge and recovery verification. After merge, Play Console is inspected for its highest version code and upload certificate; the new version code is strictly higher. A release AAB must use the existing authorized upload key and be bound to the merged commit and exact SHA-256.

The only allowed destination is Google Play Internal testing. Store upload remains stopped until all ten audio hashes are owner-approved, required checks pass, signing identity matches, and Play access is verified. The final rollout action requires action-time owner confirmation. Production and every broader testing track are out of scope.

## Rollback

Revert the feature PR to restore the single Cloudlight player, separate auth ambience control, instant theme change, previous cache manifest, and previous release metadata. Remove the uploaded Internal testing release through Play Console only with separate deletion/track-management authorization. Never roll back to a build below the forward-only local schema floor.
