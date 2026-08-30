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
- YouTube license types: https://support.google.com/youtube/answer/2797468 - the Standard YouTube License is the default; a public upload is not reusable as Creative Commons material unless that license is explicitly selected.
- U.S. Copyright Office musical works guidance: https://www.copyright.gov/engage/musicians/ - the underlying composition and its sound recording are separate protected works.
- U.S. Copyright Office AI Part 2: https://www.copyright.gov/ai/Copyright-and-Artificial-Intelligence-Part-2-Copyrightability-Report.pdf - AI-assisted material needs sufficient human-authored expressive contribution for a U.S. copyright claim; prompts alone are not enough.

## Product Intent

Non-Hyperfocus sound is a quiet support layer, not a reward engine. It may confirm meaningful completion, preview an opt-in reminder sound, or provide gentle ambience on explicit surfaces. It must not add routine tap sounds, navigation sounds, picker ticks, drawer sounds, validation-error sounds, or current V2 XP behavior; the major-progress cue does not introduce V2 XP behavior.

## Approved Non-Hyperfocus Inventory

- `soft-air-veil`: auth entry ambience, generated local MP3, no human breath/voice/body sound, starts from user intent, respects master volume.
- `cloudlight-evening-loop`: 150-second original app-entry background music, generated local MP3, first-run off, persistent opt-in, foreground-only, and controlled from the V2 sidebar/drawer.
- `orb-ambience`: Orb ambience using `gentle-water-bed.mp3`, generated local MP3, no rock clacks/birds/voices, starts from user intent, respects master volume.
- `diary-reflection-loop`: diary/settings ambience using `soft-rain-veil.mp3`, generated local MP3, no fire crackle/thunder/hard impacts, starts from user intent, respects master volume.

These are tracked in `APP_AUDIO_NON_HYPERFOCUS_ASSET_IDS`. Hyperfocus files remain in the focus family and are not part of this policy's non-Hyperfocus inventory.

## Generated Non-Hyperfocus Asset Provenance

The four ambience/music assets and five short feedback cues are first-party deterministic procedural synthesis from `scripts/generate-non-hyperfocus-audio.cjs`. The provenance packet at `docs/audio/non-hyperfocus-generated-audio-provenance.json` records seeds, fixed note sequences, the original Cloudlight numeric composition, synthesis parameters, encoder version, SHA-256 hashes, public/docs/native paths, audible exclusions, rollback path, and the statement that no third-party samples, stock recordings, voices, or AI-generated audio inputs were used.

`Cloudbound Evening` was used only as a high-level mood and app-entry background-music research reference. No source waveform was imported or retained, and no melody, harmony, score, stem, or recording was transcribed. Cloudlight Evening uses its own 40-bar structure, suspended/open harmony, sparse numeric melody, felt-piano partial model, timing, four-section form, stereo field, name, and 150-second duration. The asset-specific notice is `Copyright © 2026 Yehor212 / ZenFlow. All rights reserved.` and is stored in `docs/audio/cloudlight-evening-license.md`. The repository still has no root `LICENSE`; the notice does not invent project-wide source-code terms. Formal human-authorship and jurisdiction-specific legal review remain `UNVERIFIED`.

The generator uses `lamejs@1.2.1` as a dev-time MP3 encoder. Encoder code is not shipped in the runtime bundle. Formal legal review of dev-time LGPL encoder use remains `UNVERIFIED` until reviewed by project/legal ownership.

## Audibility and Loop Contract

The gate decodes the shipped MP3 rather than trusting generator inputs. Each ambience file must stay inside asset-specific minimum and maximum bounds for peak, RMS, audible RMS after a 20 Hz high-pass, audible-band energy ratio, and peak/RMS after its runtime gain. It must also satisfy maximum DC offset, adjacent-sample transient, start/end RMS difference over half-second windows, loop-boundary amplitude difference, and loop-boundary slope difference, plus the approved duration, sample rate, and channel count. Short feedback additionally has bounded high-frequency energy, audible-band energy, DC offset, boundary amplitude/slope, transient, duration, peak, and RMS. Stereo loop metrics enforce the worst channel rather than averaging left and right, so one-ear defects cannot be hidden by a clean opposite channel. A quiet or numerically non-zero file cannot pass when its energy is effectively subsonic.

The nature ambience generator uses seeded noise, cascaded band limiting, filter warm-up, a two-second equal-power wrap crossfade, DC-mean removal, and bounded normalization. Cloudlight uses a deterministic 64 BPM numeric composition with additive felt-piano, synthetic pad/bell partials, linked stereo normalization, and a correlation-compensated four-second equal-power circular overlap. Its decoded gate additionally rejects clipped rails and pinned full-scale plateaus, bounds three-second RMS spread, enforces the half-second `loopDelta`, and compares the rendered equal-power seam for energy change and transient discontinuity. It also checks high-frequency energy, stereo correlation, mono fold-down energy, silent windows, 150-second duration, and a labeled four-times Catmull-Rom inter-sample peak estimate. The provenance packet records the exact synthesis profile and hashes so repeat generation can be compared byte for byte.

This numerical gate is not a claim of ITU-R BS.1770-5 or EBU R 128 conformance: it does not implement K-weighted integrated loudness or a standards-conformant dBTP meter. The four-times inter-sample value is explicitly `UNVERIFIED_NON_CONFORMANT_ESTIMATE`, and formal loudness remains `UNVERIFIED_NO_BS1770_METER`. The gate also cannot prove that a label such as “soft air” or “gentle water” is perceptually correct, that a particular speaker is audible, or that runtime playback succeeds. Those claims require human listening and fresh playback on the exact target device and remain `UNVERIFIED` until that evidence exists.

## Approved Action Sound Map

Allowed short feedback sounds are limited to completion, milestone, and preview triggers. Every action sound must include visual or haptic fallback metadata through `nonAudioFeedback`, must respect mute and volume, and must start from a user-initiated flow.

The release-candidate mastered cue inventory is exactly `feedback-success.mp3`, `feedback-complete.mp3`, `feedback-streak.mp3`, `feedback-milestone.mp3`, and `feedback-notification.mp3` under `sounds/feedback/`. The runtime loads these local files on demand, retries transient failures, and deduplicates concurrent loads. A regular app event uses the existing procedural cue on its first uncached trigger while the mastered cue loads for later events; the Settings preview waits for the mastered cue and uses the procedural cue only when loading or decoding fails. Mute, zero volume, and per-category comfort settings are rechecked immediately before playback so a cue cannot start after the user disables it.

- Completion: mood saved, habit completed, journal saved, focus completed, gratitude saved, breathing completed.
- Milestone: achievement unlocked, streak milestone, major progress milestone.
- Preview: the clean-room fūrin cue is the in-app reminder preview and the optional Android `zenflow_furin_v5` channel sound. Existing default, vibration-only, and silent selections remain unchanged; choosing fūrin reschedules active reminders through the existing rollback-safe reconciliation flow.

## Persistent Background Music Contract

Cloudlight Evening is not a notification or completion cue. Its first-ever state is off. After the user enables it from the V2 navigation control, the device-local preference may request playback on later app entries. Browser or WebView autoplay rejection becomes a visible `Tap to resume` state and playback waits for the first eligible user gesture; it is never reported as successful while blocked.

Only one long ZenFlow ambience owner may play at once. Cloudlight, auth ambience, Orb ambience, Diary ambience, and Hyperfocus claim the shared long-audio coordinator; the most recent explicit playback intent pauses the prior owner. Short feedback and notification sounds remain outside this exclusivity rule. Cloudlight also stops for master mute, zero volume, disabled ambient comfort, hidden/background app state, or stale playback ownership.

The 150-second MP3 is not startup-preloaded or PWA-precached. Explicit playback intent sends an allowlisted service-worker request for one full same-origin `200` body. Existing and fetched entries must match `audio/mpeg`, 2,400,757 bytes, and the tracked Cloudlight SHA-256; an invalid cache entry is removed and replaced before admission. Later media `Range` requests may be served from that complete runtime-cache entry. Initial offline availability remains `UNVERIFIED` until the exact installed-PWA cache flow is exercised from an empty cache.

## Forbidden Routine Sounds

The following interactions stay silent and are tracked in `APP_AUDIO_FORBIDDEN_ACTIONS`:

- Routine taps.
- Tab or route changes.
- Slider, stepper, and picker movement.
- Drawer, sheet, or panel open events.
- Validation errors.

Use visual state, haptics where appropriate, focus management, and accessible text instead of audio for those interactions.

## Cross-Platform Rules

- Web/PWA: no first-ever audible autoplay and no startup prefetch for Cloudlight. A saved opt-in may attempt later playback; blocked playback waits for an eligible gesture. Short feedback and existing bounded ambience may remain in the startup audio-warm inventory, while Cloudlight is request-cached only after intent.
- Android: custom notification sounds require a new immutable channel ID, a stable packaged raw resource, native push allowlisting, active-reminder rescheduling, and installed-notification proof. The optional fūrin profile uses `zenflow_furin_v5`; Cloudlight remains a separate in-app media asset.
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
