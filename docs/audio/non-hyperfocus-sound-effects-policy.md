# Non-Hyperfocus Sound Effects Policy

Purpose: keep ZenFlow sound outside Hyperfocus calm, local, intentional, and verifiable across Web, PWA, Android, iOS, and Desktop without introducing V2 XP behavior.

## Source Evidence

- WCAG 2.2 Audio Control: https://www.w3.org/WAI/WCAG22/Understanding/audio-control.html - audio that can continue must be controllable by the user.
- ITU-R BS.1770-5: https://www.itu.int/rec/R-REC-BS.1770-5-202311-I - the normative reference for programme loudness and true-peak measurement when those claims are required.
- EBU R 128: https://tech.ebu.ch/publications/r128 - a broadcast loudness-normalization recommendation based on ITU-R BS.1770 measurement.
- MDN autoplay guide: https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay - audible playback can be blocked or disruptive unless it follows user activation.
- Apple Human Interface Guidelines, Playing Audio: https://developer.apple.com/design/human-interface-guidelines/playing-audio - audio should respect user intent, interruptions, and system controls.
- Apple Human Interface Guidelines, Accessibility: https://developer.apple.com/design/human-interface-guidelines/accessibility - feedback must not depend on sound alone.
- Android audio focus: https://developer.android.com/media/optimize/audio-focus - apps should avoid unwanted playback and respect interruptions.
- Android notification channels: https://developer.android.com/develop/ui/views/notifications/channels - channel sound behavior is user-controlled and immutable after creation.
- Buxton et al., PNAS 2021 natural sounds synthesis: https://www.pnas.org/doi/10.1073/pnas.2013097118 - natural sounds, especially water, are associated with better affect, lower stress, and lower annoyance.
- Material Design sound guidance: https://m2.material.io/design/sound/about-sound.html - UI sound should be brief, purposeful, and avoid competing with the interface.

## Product Intent

Non-Hyperfocus sound is a quiet support layer, not a reward engine. It may confirm meaningful completion, preview an opt-in reminder sound, or provide gentle ambience on explicit surfaces. It must not add routine tap sounds, navigation sounds, picker ticks, drawer sounds, validation-error sounds, or current V2 XP behavior; the major-progress cue does not introduce V2 XP behavior.

## Approved Non-Hyperfocus Inventory

- `soft-air-veil`: auth entry ambience, generated local MP3, no human breath/voice/body sound, starts from user intent, respects master volume.
- `orb-ambience`: Orb ambience using `gentle-water-bed.mp3`, generated local MP3, no rock clacks/birds/voices, starts from user intent, respects master volume.
- `diary-reflection-loop`: diary/settings ambience using `soft-rain-veil.mp3`, generated local MP3, no fire crackle/thunder/hard impacts, starts from user intent, respects master volume.

These are tracked in `APP_AUDIO_NON_HYPERFOCUS_ASSET_IDS`. Hyperfocus files remain in the focus family and are not part of this policy's non-Hyperfocus inventory.

## Generated Non-Hyperfocus Asset Provenance

Generated ambience and the five short feedback cues are first-party deterministic procedural synthesis from `scripts/generate-non-hyperfocus-audio.cjs`. The provenance packet at `docs/audio/non-hyperfocus-generated-audio-provenance.json` records the seeds or fixed note sequences, synthesis parameters, encoder version, SHA-256 hashes, public/docs paths, audible exclusions, rollback path, and the statement that no third-party samples, stock recordings, voices, or AI-generated audio inputs were used.

The generator uses `lamejs@1.2.1` as a dev-time MP3 encoder. Encoder code is not shipped in the runtime bundle. Formal legal review of dev-time LGPL encoder use remains `UNVERIFIED` until reviewed by project/legal ownership.

## Audibility and Loop Contract

The gate decodes the shipped MP3 rather than trusting generator inputs. Each ambience file must stay inside asset-specific minimum and maximum bounds for peak, RMS, audible RMS after a 20 Hz high-pass, audible-band energy ratio, and peak/RMS after its runtime gain. It must also satisfy maximum DC offset, adjacent-sample transient, start/end RMS difference over half-second windows, loop-boundary amplitude difference, and loop-boundary slope difference, plus the approved duration, sample rate, and channel count. Stereo loop metrics enforce the worst channel rather than averaging left and right, so one-ear defects cannot be hidden by a clean opposite channel. A quiet or numerically non-zero file cannot pass when its energy is effectively subsonic.

The ambience generator uses seeded noise, cascaded band limiting, filter warm-up, a two-second equal-power wrap crossfade, DC-mean removal, and bounded normalization. The provenance packet records the exact synthesis profile and hashes so repeat generation can be compared byte for byte.

This numerical gate is not a claim of ITU-R BS.1770-5 or EBU R 128 conformance: it does not currently implement K-weighted integrated loudness or true-peak measurement. It also cannot prove that a label such as “soft air” or “gentle water” is perceptually correct, that a particular speaker is audible, or that runtime playback succeeds. Those claims require human listening and fresh playback on the exact target device and remain `UNVERIFIED` until that evidence exists.

## Approved Action Sound Map

Allowed short feedback sounds are limited to completion, milestone, and preview triggers. Every action sound must include visual or haptic fallback metadata through `nonAudioFeedback`, must respect mute and volume, and must start from a user-initiated flow.

The release-candidate mastered cue inventory is exactly `feedback-success.mp3`, `feedback-complete.mp3`, `feedback-streak.mp3`, `feedback-milestone.mp3`, and `feedback-notification.mp3` under `sounds/feedback/`. The runtime loads these local files on demand, retries transient failures, and deduplicates concurrent loads. A regular app event uses the existing procedural cue on its first uncached trigger while the mastered cue loads for later events; the Settings preview waits for the mastered cue and uses the procedural cue only when loading or decoding fails. Mute, zero volume, and per-category comfort settings are rechecked immediately before playback so a cue cannot start after the user disables it.

- Completion: mood saved, habit completed, journal saved, focus completed, gratitude saved, breathing completed.
- Milestone: achievement unlocked, streak milestone, major progress milestone.
- Preview: notification sound preview. Native notification channel sounds are unchanged unless a separate versioned-channel migration and rescheduling plan is implemented.

## Forbidden Routine Sounds

The following interactions stay silent and are tracked in `APP_AUDIO_FORBIDDEN_ACTIONS`:

- Routine taps.
- Tab or route changes.
- Slider, stepper, and picker movement.
- Drawer, sheet, or panel open events.
- Validation errors.

Use visual state, haptics where appropriate, focus management, and accessible text instead of audio for those interactions.

## Cross-Platform Rules

- Web/PWA: no autoplay, no startup prefetch for long ambience, and no claim of offline PWA audio readiness unless runtime caching or precache proof exists. Short feedback MP3s may load after user intent and are included in the bounded runtime-audio cache warming inventory.
- Android: do not introduce custom notification sounds without new channel IDs and active-reminder rescheduling; generated ambience assets must be copied by Capacitor sync before native readiness is claimed.
- iOS/WKWebView: resume events must re-arm audio unlock listeners only; playback waits for the next user gesture.
- Desktop/Tauri: use the same `dist` assets and keep generated bundles free of stale root sound files before claiming desktop readiness.
- Accessibility: sound never carries the only feedback. Pair it with visible state and haptic fallback where supported.
- Privacy and performance: audio is local, no third-party streaming, and long MP3s are bounded by inventory, provenance, and decoded metric checks.

## Verification

Run the focused guard before approval:

```bash
npm run audio:generate-non-hyperfocus
npm run check:app-audio -- --write-report
npm run test -- src/lib/__tests__/appAudioAssets.test.ts scripts/__tests__/check-app-audio-assets.test.ts src/lib/__tests__/audioManager.test.ts
```

Native APK, iOS `.app`, Tauri package, deployed public URL, and real-device playback remain `UNVERIFIED` until freshly rebuilt and checked for the exact target artifact.
