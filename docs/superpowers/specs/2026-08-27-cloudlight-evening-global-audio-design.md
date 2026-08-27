# Cloudlight Evening Global Audio Design

**Date:** 2026-08-27

**Status:** Direction approved by the owner; written specification awaiting owner review

**Task:** T-GLOBAL-CLOUDLIGHT-EVENING

**Execution boundary:** Local implementation and local commit only; no push, deployment, store action, or release

## Goal

Keep the first-party fūrin cue as the optional Android notification sound, and add a separate original 150-second `Cloudlight Evening` background-music loop that a user can enable from the ZenFlow navigation sidebar or mobile drawer, after which it resumes on later app entries as soon as the current platform permits audible playback.

## Owner Decision

The owner selected the recommended behavior and asset-specific proprietary terms:

```text
Copyright © 2026 Yehor212 / ZenFlow. All rights reserved.
```

This notice applies only to the new `Cloudlight Evening` composition, sound recording, generator specification, and rendered assets. The repository has no root `LICENSE`, so this design does not invent or imply a repository-wide license.

## Explicit Requirements

- Preserve the Japanese fūrin notification cue and its Android notification-channel behavior.
- Create a separate musical background asset lasting two to three minutes; the selected duration is 150 seconds.
- Make the background asset loop seamlessly.
- Start it on later app entries after the user has enabled it once.
- Provide an immediate on/off control in the desktop sidebar and mobile drawer.
- Use the same local asset across Web/Vite, installed PWA, Android/Capacitor, iOS/WKWebView, and Desktop/Tauri.
- Apply strict technical, rights, runtime, accessibility, and human-listening gates.
- After final local verification, send the exact hash-bound MP3 to the owner's Telegram Saved Messages.

## Necessary Implied Requirements

- The first-ever state is off. Audible autoplay without prior user intent is both unreliable and disruptive; a user must enable the loop once before any automatic-resume behavior is eligible.
- Subsequent startup playback is best effort. If autoplay is blocked, the preference stays enabled and the first eligible pointer, touch, or keyboard activation starts the loop without making the user configure it again.
- The loop pauses when ZenFlow is hidden or backgrounded. ZenFlow does not add native background-audio services or continue playing after the app is closed.
- Only one long ZenFlow ambience owner plays at a time. Global music, auth ambience, Orb ambience, Diary ambience, and Hyperfocus cannot overlap.
- The global loop respects the existing master mute, master volume, Sound Comfort ambient setting, OS volume, interruptions, audio focus, and silent-mode expectations.
- A failed load produces a visible paused/error state and retry path; it never substitutes synthetic fallback business content or streams from an external service.
- The large asset is not startup-preloaded or PWA-precached. It becomes cache-eligible only after the user enables or plays it, limiting bandwidth, storage, and startup cost.
- Sound is never the sole carrier of application meaning. The control exposes visible text, icon, pressed state, loading/blocked/error state, and accessible naming.

## Current Repository Evidence

- `src/lib/notificationSounds.ts` and Android native channel code own fūrin reminder delivery.
- `src/lib/audioManager.ts` owns the persistent master mute and volume.
- `src/lib/audioComfort.ts` owns the ambient category gate and local comfort preferences.
- `src/lib/audioLifecycle.ts` pauses audio in the background and defers resume until a user gesture where required.
- `src/hooks/useUserStartedAmbienceAudio.ts` owns current user-started HTML media behavior for auth, Orb, and Diary ambience.
- `src/lib/ambientSounds.ts` owns the iOS-blessed media element and Hyperfocus playback.
- `src/components/navigation-v2/SidebarV2.tsx` is the permanent desktop rail; `DrawerV2.tsx` is the corresponding mobile navigation surface.
- The active dirty task diff temporarily renames the notification profile to Cloudlight. Implementation must first restore the accepted fūrin notification model and assets before adding the new global loop.

## Approaches Considered

### A. Persistent opt-in with permitted automatic resume — selected

The user enables music once. The choice persists locally. Later entries attempt playback only when the app is foregrounded and allowed; blocked platforms wait for the first eligible gesture. This meets the requested entry behavior without misrepresenting browser or mobile autoplay guarantees.

### B. Audible playback on every first-ever launch — rejected

This can be blocked by browsers and WebViews, can interfere with assistive audio or another media app, and conflicts with the existing no-surprise-audio contract.

### C. Manual start in every session — rejected

This is the simplest technical behavior but does not meet the requested persistent entry experience.

## Rights And Reference Boundary

`Cloudbound Evening` by 3 Minute Escape is a listening-direction reference, not a source asset. YouTube's default upload license does not grant application redistribution rights. The design therefore permits only abstract functional and emotional observations:

- low urgency;
- calm evening atmosphere;
- soft piano-forward timbre;
- generous space between foreground events;
- smooth dynamics and a long, non-alarming decay;
- suitability for relaxation, focus, and emotional reset.

The following are forbidden inputs or operations:

- downloading or retaining the reference waveform in the repository or evidence bundle;
- sampling, stem extraction, MIDI extraction, melody or harmony transcription;
- matching a recognizable motif, phrase contour, chord sequence, arrangement, or production fingerprint;
- using the reference title for the shipped asset;
- using a sound-alike recording as evidence of independent creation.

The generated work uses an original structure, tonal centre, note material, rhythm, voicing, instrumentation model, stereo field, and loop boundary. Similarity is intentionally maximized only on the high-level mood and functional axes above.

## Composition And Synthesis Design

- Product name: `Cloudlight Evening`.
- Runtime ID: `cloudlight-evening-loop`.
- Canonical file: `sounds/cloudlight-evening-loop.mp3`.
- Source duration: exactly 150 seconds.
- Format: 44.1 kHz, stereo, 128 kbps MP3, matching the current non-Hyperfocus pipeline.
- Tempo region: 60–64 BPM with rubato-like timing offsets generated deterministically.
- Tonal language: an independently chosen suspended/open-fifth and add-note palette; no reference score is imported or transcribed.
- Foreground: additive felt-piano model with softened attacks, partial-dependent decay, deterministic velocity variation, and no sampled piano.
- Support: low-density synthetic air pad and restrained bell-like upper partials; no voice, breathing, field recording, stock loop, or model-generated audio input.
- Form: four related sections with gradual density changes so the two-and-a-half-minute asset does not feel like one short phrase repeated.
- Loop: a minimum four-second equal-power circular overlap, followed by deterministic quiet-boundary rotation. The rendered start and end must remain phase- and level-compatible after MP3 decoding.
- Runtime gain: deliberately below focused audio and short feedback; the existing master-volume control remains authoritative.

The generator must be deterministic. Two clean runs with the same tracked inputs must produce identical MP3, provenance, and source-receipt hashes.

## Playback Architecture

### Preference

Add one device-local storage key through `SK` and repository storage helpers:

```text
zenflow-app-background-music-enabled
```

Default is `false`. The preference is not account data, is not synced, does not require a Dexie migration, and survives ordinary app restarts on the same installation.

The effective playback condition is:

```text
preference enabled
AND master audio enabled
AND master volume > 0
AND Sound Comfort ambient enabled
AND app foregrounded
AND global ambience owns the playback coordinator
```

### Single ambience owner

Add a small `audioPlaybackCoordinator` with explicit claim/release semantics. Long-running owners are:

- `global-cloudlight`;
- `auth-soft-air`;
- `orb-water`;
- `diary-rain`;
- `hyperfocus`.

The most recent explicit user playback intent wins. Claiming an owner pauses the previous long-running owner. Releasing a foreground owner allows global Cloudlight to reclaim playback only when its saved preference and every effective gate remain true. Short feedback and notification cues do not claim the long-running ambience coordinator.

### Global controller

Mount one controller at the V2 shell level so navigation does not recreate the media element. It exposes a stable snapshot and actions to both navigation surfaces:

```text
enabled
effectiveState: off | blocked | loading | playing | paused | error
toggle()
retry()
```

The controller uses one local `<audio loop playsInline preload="none">` element, the existing audio media-session helper, and the existing background lifecycle. It must prevent stale play promises from restarting audio after mute, preference-off, owner replacement, unmount, or background transition.

### Autoplay and resume

- First enable occurs directly inside the sidebar/drawer activation handler.
- Later app entries may attempt playback because the user previously opted in.
- `NotAllowedError` or a locked AudioContext becomes `blocked`, not `error`.
- A one-shot eligible gesture resumes blocked playback.
- Backgrounding pauses immediately.
- Foreground resume waits for an eligible gesture when the platform requires it.
- Headphone disconnect, native audio-focus loss, physical-device routing, and OS interruption behavior remain subject to platform proof; no silent automatic restart occurs after a permanent focus loss.

## Navigation Control Design

The same control appears in:

- the `SidebarV2` footer above Settings on desktop/tablet;
- the `DrawerV2` bottom section above Settings on phone layouts.

Behavior and accessibility:

- at least 44 CSS px desktop and 48 CSS px phone target;
- native `<button>` with `aria-pressed`, state-specific `aria-label`, visible name, and icon;
- expanded label: `Evening music`; collapsed rail tooltip uses the same localized label;
- visible state: `On`, `Off`, `Loading`, `Tap to resume`, or `Unavailable`;
- `Volume2`, `VolumeX`, or bounded loading icon from lucide-react;
- no color-only meaning;
- keyboard Enter/Space and focus ring;
- localized across `en`, `uk`, `es`, `de`, `fr`, `ja`, `ar`, and `he` with RTL-safe layout;
- no separate sidebar volume slider; Settings remains the single volume owner.

When master audio or ambient comfort is off, the button reports why playback is paused. It must not silently enable broader audio categories.

## Caching And Performance

- Do not add the 150-second MP3 to startup fetches or minimal PWA precache.
- Use the existing same-origin runtime-audio cache only after playback intent.
- Bind the asset path, size, MIME type, and SHA-256 in the audio manifest and provenance gate.
- Rotate a cache revision if current runtime caching can retain stale bytes at the same URL.
- Keep one media element and one decoded/streaming path; do not decode the full file into Web Audio memory merely to loop it.
- Target encoded size is below 3.0 MB at 128 kbps.
- App startup, route navigation, and sidebar render must remain independent of successful audio loading.

## Technical Audio Audit

The checker must decode the shipped MP3 and validate the whole file rather than trusting generator inputs. Required gates:

- exact expected inventory and no stale duplicate asset;
- 44.1 kHz stereo and 150-second source contract with bounded MP3 padding;
- SHA-256 equality across `public`, `docs`, `dist`, Android, iOS, and Desktop artifacts where built;
- zero clipped or pinned samples;
- inter-sample/true-peak headroom;
- bounded RMS and effective runtime gain;
- maximum absolute DC offset;
- audible-band energy and restrained high-frequency energy;
- adjacent-sample transient ceiling;
- stereo correlation and mono fold-down energy safety;
- start/end boundary amplitude and slope;
- windowed start/end RMS compatibility;
- equal-power loop-seam comparison after MP3 decoding;
- silence/dropout detection and long-window loudness consistency;
- deterministic second-run hash comparison.

If the environment lacks a standards-compliant ITU-R BS.1770 loudness meter, the report must say that LUFS and dBTP conformance are `UNVERIFIED`; RMS, peak, oversampled clipping, and local K-weighted estimates must not be relabeled as formal EBU conformance.

## Human Listening Audit

Automated metrics cannot prove pleasantness, emotional fit, lack of fatigue, or cultural interpretation. The exact final hash requires:

- full-loop listening on headphones;
- full-loop listening on a built-in speaker;
- at least three consecutive loop boundaries;
- confirmation of no copied/recognizable reference phrase;
- confirmation of no click, hiss, static, harsh bell, alarm quality, distracting bass, or fatigue-inducing repetition;
- owner acceptance after receiving the hash-bound MP3 in Telegram Saved Messages.

Until the owner responds after listening, `ARTISTIC_PASS`, `PLEASANTNESS`, and final human release acceptance remain `UNVERIFIED`, even when integration and technical checks pass.

## Cross-Platform Matrix

| Surface | Intended behavior | Required evidence |
| --- | --- | --- |
| Web/Vite | Persistent opt-in; allowed autoplay attempt; blocked state resumes from eligible gesture. | Unit/component tests, production build, browser console/network/media-state proof. |
| Installed PWA | Same control and lifecycle; asset cached only after intent and available offline after successful caching. | Service-worker cache/range tests and installed-PWA offline playback proof. |
| Android/Capacitor | Same bundled MP3, phone drawer control, pause/background behavior, and no collision with fūrin notifications. | Capacitor sync, APK hash inventory, emulator semantic interaction, logcat and notification regression. |
| iOS/WKWebView | Same bundled MP3, blessed gesture start, interruption-safe foreground lifecycle. | Capacitor sync, Xcode/simulator build where available, gesture/resume proof; physical routing remains UNVERIFIED. |
| Desktop/Tauri | Same asset and sidebar control; no native background-service behavior. | Tauri frontend build/package hash and desktop runtime proof where available. |
| Accessibility/i18n | Keyboard, screen reader, visible status, 44/48 px target, and RTL. | Testing Library, browser accessibility tree, narrow/desktop and ar/he evidence. |
| Performance | No startup fetch/decode and one long media owner. | Bundle inventory, network trace, startup smoke, memory observation. |
| Security/privacy | Local same-origin asset only; no microphone, remote stream, PII, auth, sync, analytics, or new dependency. | Scoped security suite, Snyk when callable, source/bundle scan. |
| Store/Release | No publication is implied. | Signed artifacts, consoles, public deploy, and store review remain UNVERIFIED. |

## Telegram Handoff

The owner explicitly authorizes one external write after local completion:

1. Verify an authenticated Telegram Desktop or Telegram Web session.
2. Resolve `Saved Messages` semantically; do not infer a chat from screen coordinates or a similarly named conversation.
3. Attach the exact final `cloudlight-evening-loop.mp3` whose SHA-256 passed the final artifact checks.
4. Add a short message containing the asset name, duration, SHA-256, and `TECHNICAL PASS / ARTISTIC UNVERIFIED UNTIL LISTENED` boundary.
5. Read back the sent message and attachment identity.

If no authenticated Telegram session or reliable semantic attachment path is available, no substitute recipient is allowed. Telegram delivery remains `UNVERIFIED` and the local file is handed to the owner instead.

## Test-First Plan

Before production changes, add failing contracts for:

- fūrin remaining the notification profile and Cloudlight not appearing in notification channels;
- the new audio asset manifest and proprietary rights receipt;
- deterministic 150-second generation, encoded inventory, loop and signal metrics;
- persistent preference normalization and failed-write rollback;
- single ambience-owner claim/release behavior;
- startup autoplay-blocked transition and first-gesture resume;
- mute, zero volume, ambient-comfort-off, background, stale promise, and load-error paths;
- desktop SidebarV2 and phone DrawerV2 accessible controls;
- RTL and collapsed-rail labels;
- runtime cache intent and stale-revision behavior.

Then implement the smallest code that turns each contract green and run the broader audio, navigation, lifecycle, i18n, Web/PWA, Android, iOS, Desktop, integrity, security, and diff gates.

## Rollback

- Revert the Cloudlight asset, generator/provenance additions, manifest/cache revision, controller/coordinator, storage key, navigation controls, i18n copy, tests, and docs in one follow-up commit.
- Existing fūrin notification files and channels remain unchanged by the feature and therefore require no user migration.
- The new device-local preference becomes inert if older code no longer reads it; no destructive cleanup is required.
- No database, account, sync, cloud, or production-data rollback exists.

## Done Criteria

- Fūrin is restored as the only custom notification sound and all notification regression tests pass.
- A deterministic 150-second Cloudlight MP3 and provenance/license receipt exist with matching hashes.
- The decoded asset passes every available technical and loop check without weakened thresholds.
- Desktop sidebar and mobile drawer controls work with keyboard, touch, screen reader semantics, collapsed rail, and RTL.
- Preference, master mute/volume, comfort, audio ownership, autoplay blocking, background pause, and foreground resume behave as specified.
- Web/PWA, Android, iOS, and Desktop artifact statuses are individually reported with exact evidence or `UNVERIFIED` reasons.
- Security and final diff checks find no external stream, secret, production dependency, mock runtime data, or unrelated edit.
- The exact MP3 is sent to Telegram Saved Messages with successful readback, or delivery is explicitly `UNVERIFIED` because the authenticated target is unavailable.
- Pleasantness and artistic approval remain `UNVERIFIED` until the owner listens and confirms the exact hash.

## Non-Goals

- No copy, cover, arrangement, interpolation, remix, or sound-alike reproduction of `Cloudbound Evening` or `One Summer's Day`.
- No first-ever surprise autoplay, forced system volume, native background service, lock-screen player, paid service, new production dependency, remote audio API, cloud preference, analytics event, or deployment.
- No replacement or removal of existing auth, Orb, Diary, Hyperfocus, feedback, or notification audio.
- No claim that automated QC or an AI reviewer can prove pleasantness or legal clearance.

## UNVERIFIED Ledger

- Formal legal advice and enforceability of the asset-specific notice in every jurisdiction.
- Human-authorship copyrightability beyond the owner's creative direction, selection, and later listening approval.
- Standards-compliant ITU-R BS.1770 / EBU R 128 result unless a compliant meter is actually run.
- Physical Android/iOS devices, OEM audio focus, headphone disconnect, Bluetooth routing, and phone-call interruptions.
- Signed native/Desktop artifacts, store consoles, public deployment, and release publication.
- Human pleasantness, fatigue, cultural fit, and non-resemblance approval until the owner listens to the exact final hash.
- Telegram delivery until an authenticated Saved Messages target and sent attachment are read back.
