# First-Party Procedural Audio Production Design

## Status

`REVIEW_ONLY`. This design does not authorize replacement of any runtime audio asset.

## Goal

Produce the required 26-role audio set without using any recovered external binary, decoded derivative, third-party recording, stock sample, voice, or AI-generated audio input.

## Scope

The review inventory is exactly:

- 18 Hyperfocus loops: `forest`, `rain`, `ocean`, `fireplace`, `river`, and `wind`, each at `soft`, `deep`, and `intense` levels.
- Three 96-second ambience loops: `soft-air-veil.mp3`, `gentle-water-bed.mp3`, and `soft-rain-veil.mp3`.
- Five short feedback cues: `feedback-success.mp3`, `feedback-complete.mp3`, `feedback-streak.mp3`, `feedback-milestone.mp3`, and `feedback-notification.mp3`.

## Clean-room boundary

The generator uses deterministic mathematical synthesis from fixed numerical seeds. It must not read or transform:

- recovered external MP3 or WAV files;
- external spectrograms or decoded measurements as signal inputs;
- third-party field recordings or stock libraries;
- voices, speech, MIDI files, or model-generated audio.

The resulting provenance statement is an engineering record, not legal advice. The project owner must still choose the repository license and record release/legal acceptance. Until that decision, all generated files remain `REVIEW_ONLY`.

## Audio contract

- 48,000 Hz, stereo MP3, 128 kbps.
- Hyperfocus: 30 seconds per file.
- Long ambience: 96 seconds per file.
- Feedback durations remain bounded to the existing product roles.
- Hyperfocus decoded intensity must progress `soft < deep < intense`, with at least a 3.0-point gap under the repository intensity metric.
- Decoded MP3 must have no clipped samples, bounded DC offset, bounded loop seam, correct channel count, correct sample rate, and exact SHA-256 provenance.
- Sound never becomes the only feedback channel.

## Architecture

A standalone review generator produces audio under an isolated output directory, then decodes every MP3 and writes:

- exact provenance and SHA-256 inventory;
- decoded QC metrics;
- rights ledger;
- verification record;
- human listening checklist;
- deterministic rebuild source.

No generated file is copied into `public/sounds`, `docs/sounds`, Capacitor bundles, Tauri bundles, manifests, or the service worker.

## Human acceptance gate

A human reviewer must listen to each short cue repeatedly and loop every Hyperfocus/ambience file for at least ten minutes on headphones and a device speaker. Any speech-like content, melody, beat, alarm resemblance, harsh transient, obvious seam, fatigue, or incorrect intensity order is a rejection. Acceptance is bound to the exact SHA-256 value.

## Platform impact

| Surface | Impact |
| --- | --- |
| Web/Vite | No runtime change; playback remains unverified |
| Installed PWA | No runtime change; playback remains unverified |
| Android/Capacitor | No runtime change; playback remains unverified |
| iOS/WKWebView | No runtime change; playback remains unverified |
| Desktop/Tauri | No runtime change; playback remains unverified |
| Accessibility | Existing visual/haptic fallbacks remain unchanged |
| Privacy | No recording, upload, telemetry, or user data |

## Rollback

Delete the review-only generator, tests, spec, and branch. Since no runtime mapping or binary is modified, rollback does not require an application migration.
