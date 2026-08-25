# CC0 Kimi-Role Audio Reconstruction Design

## Status

`SOURCE_RIGHTS_DOCUMENTED_REVIEW_ONLY`. This design creates an isolated listening and evidence package. It does not authorize replacing any ZenFlow runtime asset.

## Goal

Reconstruct the useful 26-role Kimi audio concept with audibly distinct environmental families and a verifiable rights chain, without using any recovered Kimi binary, decoded derivative, spectrogram-derived signal, voice, MIDI file, or AI-generated audio input.

## Inventory

The package contains exactly:

- 18 Hyperfocus loops: `forest`, `rain`, `ocean`, `fireplace`, `river`, and `wind`, each at `soft`, `deep`, and `intense`;
- three 96-second ambience loops: `soft-air-veil.mp3`, `gentle-water-bed.mp3`, and `soft-rain-veil.mp3`;
- five short feedback cues: `feedback-success.mp3`, `feedback-complete.mp3`, `feedback-streak.mp3`, `feedback-milestone.mp3`, and `feedback-notification.mp3`.

## Source architecture

Twenty files derive only from 17 separately identified BigSoundBank field recordings whose download pages state CC0/public-domain-equivalent use. Each source record includes its title, sound number, author, official page, license page, technical description, downloaded-byte SHA-256, byte count, and decoded probe result.

Six files are first-party deterministic synthesis:

- `soft-air-veil.mp3`;
- all five feedback cues.

The procedural signals use fixed numerical seeds, cyclic value-noise fields, oscillators, harmonics, envelopes, and no external audio input.

## Audio mastering

Source-derived loops are decoded, resampled to 48 kHz stereo, filtered for the intended product role, normalized to level-specific loudness and true-peak targets, and encoded as 128 kbps MP3. The loop algorithm processes a source span longer than the target, keeps the middle body, equal-power crossfades the tail into the head, then concatenates the seam so the end returns to the exact source position used at the next loop start.

Hyperfocus levels differ through separate recordings or source regions, spectral filtering, event density, and loudness. Level acceptance is not based on volume alone.

## Objective quality gates

Every decoded MP3 must satisfy:

- 48,000 Hz, two channels, MP3, and bounded duration;
- peak no higher than -2 dBFS and zero clipped samples;
- channel DC offset no greater than 0.001;
- loop seam jump no greater than 0.055;
- 250 ms seam mean absolute difference no greater than 0.105;
- start/end RMS delta no greater than 2.5 dB;
- `soft < deep < intense` with at least a 3.0-point intensity gap;
- cross-family spectral correlation below 0.995, preventing the prior generic-noise failure mode.

The package also contains spectrograms, exact SHA-256 sums, source evidence, decoded metrics, and a hash-bound human listening checklist.

## Rights boundary

The package documents the engineering source-rights basis. It is not a legal opinion. Formal legal review, subjective listening acceptance, and physical/runtime playback remain `UNVERIFIED`. Attribution is retained for audit quality even where the source pages state that attribution is optional.

## Runtime boundary

The generator writes only beneath an explicitly supplied review output directory. It does not write to `public/sounds`, `docs/sounds`, the service worker, manifests, Android/iOS bundles, Tauri bundles, or runtime mappings.

## Platform impact

| Surface | Impact |
| --- | --- |
| Web/Vite | No runtime change; playback unverified |
| Installed PWA | No runtime change; playback unverified |
| Android/Capacitor | No runtime change; playback unverified |
| iOS/WKWebView | No runtime change; playback unverified |
| Desktop/Tauri | No runtime change; playback unverified |
| Accessibility | Existing non-audio feedback remains unchanged |
| Privacy | No recording, upload, telemetry, account data, or user content |

## Rollback

Delete the review generator, tests, workflow, documentation, and review artifact branch. No application migration is required because runtime audio is unchanged.
