# Cloudlight Evening R3 private GarageBand production runbook

## Boundary

Use only the generated source pack at `output/private/cloudlight-evening-r3/source/`. It is ignored local evidence and must not be copied into `public/`, `docs/sounds/`, a runtime bundle, or a release artifact. The current tracked production MP3 remains outside this runbook.

The pack contains one type-1 MIDI file, automation JSON, a deterministic source manifest, and its README. It contains no audio region, imported audio, Apple Loop, candidate render, or runtime promotion.

## GarageBand session

1. Create a new empty GarageBand project at 56 BPM with a 166-second timeline. Do not enable cycle/loop playback for the review render.
2. Import `cloudlight-evening-r3.mid` from the private source pack. Keep the six MIDI tracks named `Pad`, `Drone`, `Shimmer L`, `Shimmer R`, `Piano`, and `Linear Fade`.
3. Assign only the source-declared GarageBand resources: Ambient Pad for `Pad`, Dark Swell Pad for `Drone`, Ambient Overtones for both shimmer tracks, and Steinway Grand Piano 2 for `Piano`. Apply the declared Clean Ambient Tail reverb with 7.5-second decay, 12 ms pre-delay, 120 Hz low cut, and 4800 Hz damping.
4. Keep `Linear Fade` as the imported CC11 source and verification guide from 127 at 150 seconds to 0 at 166 seconds. This separate MIDI control track does not itself control GarageBand's master output or the other instrument tracks. Do not treat it as proof of a shared fade.
5. Confirm the arrangement inspector has five instrument tracks plus the linear-fade control, no audio tracks, and no regions beyond 166 seconds. Confirm piano notes end by 138 seconds.

The shared linear gain fade across the rendered mix from 150 to 166 seconds is not applied or proven by this source pack. Task 4 must apply it in the GarageBand session and prove it from the exported candidate evidence before any review candidate can claim that boundary.

## Candidate faders

Render the same project three times. Only the listed candidate faders may differ.

| Candidate | Pad | Drone | Shimmer | Shimmer pan | Piano |
| --- | ---: | ---: | ---: | ---: | ---: |
| candidate-01 | -12 dB | -21 dB | -29 dB | 35% | -27 dB |
| candidate-02 | -12 dB | -21 dB | -27.8 dB | 45% | -27 dB |
| candidate-03 | -12 dB | -21 dB | -29 dB | 35% | -25.8 dB |

## Private export and receipts

1. Export each candidate as a 166-second 48 kHz, 24-bit stereo WAV review master with normalization off to `output/private/cloudlight-evening-r3/session/`: `candidate-01.wav`, `candidate-02.wav`, and `candidate-03.wav`.
2. Capture private screenshots named `project-overview.png`, `track-inventory.png`, `no-audio-regions.png`, `fade-automation.png`, `candidate-01-mixer.png`, `candidate-02-mixer.png`, and `candidate-03-mixer.png`.
3. Record the GarageBand/macOS version, exact instrument and preset paths, source-pack hashes, WAV SHA-256 values, and screenshots in the Task 3 session receipt.
4. Do not select, replace, cache, package, publish, or promote a candidate until the owner listens and chooses one exact candidate hash. A choice of `NONE` ends the review without production audio change.
