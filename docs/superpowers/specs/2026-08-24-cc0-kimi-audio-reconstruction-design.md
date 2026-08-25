# CC0 Kimi Audio Reconstruction Design

**Date:** 2026-08-24  
**Status:** Approved for review-package implementation  
**Runtime status:** No runtime replacement is authorized by this design.

## Problem

The recovered Kimi workspace contained 26 useful audio roles, but the quarantined binaries did not carry file-bound evidence sufficient for release. Seventeen Hyperfocus candidates were also encoded at 44.1 kHz rather than the project's 48 kHz contract. The clean-room reconstruction must preserve the product roles without using any Kimi MP3, decoded waveform, spectrogram, or derivative input.

## Scope

The review package contains exactly:

- 18 Hyperfocus nature variants: forest, rain, ocean, fireplace, river, and wind, each at soft, deep, and intense levels;
- three long first-party ambience loops: `soft-air-veil`, `gentle-water-bed`, and `soft-rain-veil`;
- five first-party feedback cues: success, complete, streak, milestone, and notification.

The package is generated only under `output/cc0-kimi-audio-review`. No file is copied into `public/sounds`, `docs/sounds`, Capacitor bundles, Tauri assets, or `dist`.

## Rights architecture

Hyperfocus variants use BigSoundBank / LaSonotheque source recordings only after a fail-closed build-time gate confirms all of the following:

1. the official sitemap resolves exactly one source page for the declared sound number;
2. the source page URL and page body identify that same number;
3. the source page identifies CC0;
4. the official canonical license page states CC0 1.0, redistribution, adaptation, and commercial-use rights;
5. a same-provider audio URL is bound to the same sound number;
6. source page, license page, and source audio bytes receive SHA-256 values recorded in the rights ledger.

The source shortlist is sound numbers 100, 2715, 699, 2679, 1019, 1047, 698, 2570, 2856, 823, 3218, 871, 908, 904, and 625. Live titles and credits are parsed from the source pages rather than invented in the specification.

The three ambience loops and five feedback cues use deterministic first-party synthesis. They contain no third-party sample, recording, voice, MIDI file, stock loop, or AI-generated audio input.

The evidence packet is not legal advice or a warranty against all possible third-party claims. Any failed or ambiguous rights condition blocks the build.

## Audio architecture

All output is stereo MP3 at 48 kHz and 128 kbps. Hyperfocus files target 30 seconds; ambience files target 96 seconds. Source recordings are decoded to 48 kHz stereo PCM, converted into loop-safe segments with an equal-power boundary crossfade, spectrally shaped by family, combined with low-level deterministic texture, and normalized to level-specific RMS and peak targets.

Intensity is not implemented by volume alone. Each family changes target RMS, spectral density, motion, and procedural texture while retaining the existing decoded metric rule that requires at least a three-point intensity-score gap for `soft → deep` and `deep → intense`.

Procedural ambience uses periodic frequency-domain noise so the waveform is cyclic by construction. Feedback cues use fixed note sequences with smooth attack/release envelopes and bounded peaks.

## Evidence and failure handling

A successful package contains:

- 26 MP3 files;
- `rights-ledger.json`;
- `provenance.json`;
- `qc-report.json`;
- `human-review.json`;
- `build-environment.json`;
- `SHA256SUMS`;
- `README.md`.

The independent verifier checks SHA-256 before MP3 signatures, then checks exact inventory, 48 kHz stereo streams, provenance bindings, rights coverage, objective QC, and the human-review boundary. The builder writes to a sibling temporary directory and atomically promotes it only after independent verification. An existing review directory is restored if promotion fails.

## Acceptance boundary

Objective technical success does not authorize runtime promotion. Every long loop requires at least ten minutes of human listening on headphones and a built-in speaker. The exact hashes must be accepted for absence of audible seams, speech, melody, beat, alarm-like events, mismatched intensity, and fatigue-inducing repetition. Web/Vite, installed PWA, Android/Capacitor, iOS/WKWebView, and Desktop/Tauri remain `UNVERIFIED` until a separate promotion change performs artifact and playback checks.
