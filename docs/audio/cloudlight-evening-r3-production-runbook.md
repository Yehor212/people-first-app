# Cloudlight Evening R3 private GarageBand production runbook

## Boundary

Use only the generated source pack at `output/private/cloudlight-evening-r3/source/`. It is ignored local evidence and must not be copied into `public/`, `docs/sounds/`, a runtime bundle, or a release artifact. The current tracked production MP3 remains outside this runbook.

The pack contains one type-1 MIDI file, automation JSON, a deterministic source manifest, and its README. It contains no audio region, imported audio, Apple Loop, candidate render, or runtime promotion.

## Task 3 read-only environment preflight

Run this before opening GarageBand or creating a project:

```bash
node -e 'const m=require("./scripts/cloudlight-evening-r3-session.cjs"); console.log(JSON.stringify(m.inspectGarageBandEnvironment(m.DEFAULT_GARAGEBAND_PATHS), null, 2))'
```

The preflight must report GarageBand `10.4.14` build `6648`, architecture `arm64`, the local macOS version/build, and these seven roles in this order: `garageband-license`, `steinway-instrument`, `steinway-samples`, `pad-preset`, `drone-preset`, `shimmer-preset`, and `reverb-preset`. Every row and the GarageBand `Info.plist` must have a nonzero byte count and SHA-256. The command reads and hashes the installed files; it must not launch GarageBand, download content, install a patch, or alter any inspected resource.

A missing, changed, symlinked, non-regular, empty, or hardlinked file is `STOP`. A GarageBand version/build or architecture mismatch is also `STOP`; do not change the expected values to fit the machine. The retained installed-license PDF hash is provenance evidence, not qualified legal clearance.

At the start of Task 4, use visible GarageBand UI inspection to prove that the intended export workflow can produce 48 kHz, 24-bit stereo WAV without normalization. Capture that visible gate as `output/private/cloudlight-evening-r3/evidence/garageband/export-settings.png`. The screenshot must show WAV, uncompressed 24-bit, and normalization disabled; the operator must also visibly confirm an explicit 48 kHz setting or an authoritative GarageBand project/export readout. If 48 kHz, 24-bit output, or normalization-off is not actually available and visible, stop and ask the owner. Do not resample, substitute an encoder, install a dependency, infer a hidden setting, or silently lower the format. This gate occurs before project construction or rendering.

## GarageBand session

1. Open the exact canonical `output/private/cloudlight-evening-r3/source/cloudlight-evening-r3.mid` in GarageBand, then immediately save it as `output/private/cloudlight-evening-r3/garageband/Cloudlight Evening R3 Base.band`. Set 56 BPM with a 166-second timeline and do not enable cycle/loop playback for the review render. Do not create an empty project and manually re-import another MIDI copy.
2. Keep the six imported MIDI tracks named `Pad`, `Drone`, `Shimmer L`, `Shimmer R`, `Piano`, and `Linear Fade`.
3. Assign only the source-declared GarageBand resources: Ambient Pad for `Pad`, Dark Swell Pad for `Drone`, Ambient Overtones for both shimmer tracks, and Steinway Grand Piano 2 for `Piano`. Apply the declared Clean Ambient Tail reverb with 7.5-second decay, 12 ms pre-delay, 120 Hz low cut, and 4800 Hz damping. If GarageBand does not visibly expose any named reverb control needed for those exact values, stop and record the unavailable control; do not estimate, substitute, or claim that value.
4. Keep `Linear Fade` as the imported CC11 source and verification guide from 127 at 150 seconds to 0 at 166 seconds. This separate MIDI control track does not itself control GarageBand's master output or the other instrument tracks. Do not treat it as proof of a shared fade.
5. Confirm the arrangement inspector has five instrument tracks plus the linear-fade control, no audio tracks, and no regions beyond 166 seconds. Confirm piano notes end by 138 seconds.

The shared linear gain fade across the rendered mix from 150 to 166 seconds is not applied or proven by this source pack. Task 4 must apply it in the GarageBand session and prove it from the exported candidate evidence before any review candidate can claim that boundary.

## Candidate faders

Freeze composition, timing, instruments, effects, and automation in the base project, then save three candidate copies. Export each frozen candidate copy once, and export candidate 01 a second time without changing or reopening that project. Across all four exports, only the declared mix values below may differ; the candidate-01 primary and rerender must use identical project and mix state.

| Candidate    |    Pad |  Drone |  Shimmer | Shimmer pan |    Piano |
| ------------ | -----: | -----: | -------: | ----------: | -------: |
| candidate-01 | -12 dB | -21 dB |   -29 dB |        ±35% |   -27 dB |
| candidate-02 | -12 dB | -21 dB | -27.8 dB |        ±45% |   -27 dB |
| candidate-03 | -12 dB | -21 dB |   -29 dB |        ±35% | -25.8 dB |

## Private export and receipts

1. Export each candidate as a 166-second 48 kHz, 24-bit stereo WAV review master with normalization off: `output/private/cloudlight-evening-r3/renders/candidate-01-linear.wav`, `output/private/cloudlight-evening-r3/renders/candidate-02-linear.wav`, and `output/private/cloudlight-evening-r3/renders/candidate-03-linear.wav`. Export candidate 01 again without any project change as `output/private/cloudlight-evening-r3/renders/candidate-01-linear-rerender.wav`.
2. Capture these exact private screenshots directly under `output/private/cloudlight-evening-r3/evidence/garageband/`: `export-settings.png`, `project-overview-0-00.png`, `track-inventory.png`, `instrument-identities.png`, `reverb-controls.png`, `no-audio-regions.png`, `piano-2-05.png`, `fade-2-30-to-2-46.png`, `candidate-01-mixer.png`, `candidate-02-mixer.png`, and `candidate-03-mixer.png`. Each image must show its named UI state; a filename alone is not semantic proof.
3. After all four WAV files and the three frozen candidate projects exist, create four separate Task 4 session receipts with `writeGarageBandSessionReceipt`: candidate 01 primary, candidate 01 rerender, candidate 02 primary, and candidate 03 primary. Every call must provide `visualEvidencePaths` containing the eight common screenshot paths from step 2 plus only the matching candidate mixer screenshot, for exactly nine direct paths. Candidate 01 primary and rerender use the same candidate-01 mixer screenshot because the rerender must occur without a project or mix change. Use these exact project paths:
   - `output/private/cloudlight-evening-r3/garageband/Cloudlight Evening R3 Candidate 01.band` for both candidate 01 renders;
   - `output/private/cloudlight-evening-r3/garageband/Cloudlight Evening R3 Candidate 02.band`;
   - `output/private/cloudlight-evening-r3/garageband/Cloudlight Evening R3 Candidate 03.band`.
4. Each call must pass exactly its matching candidate ID and render path. The resulting private receipt files are:
   - `output/private/cloudlight-evening-r3/receipts/candidate-01-linear-session-receipt.json`;
   - `output/private/cloudlight-evening-r3/receipts/candidate-01-linear-rerender-session-receipt.json`;
   - `output/private/cloudlight-evening-r3/receipts/candidate-02-linear-session-receipt.json`;
   - `output/private/cloudlight-evening-r3/receipts/candidate-03-linear-session-receipt.json`.
5. A receipt call is valid only when it binds the exact Task 2 source bytes and hashes: MIDI `6187d20bdd9ece8b6694b96028f5621deb19597f70ed8025790da8fdeb7f8697`, automation `c45551d77487ce9aea7881d67a760bf83e834ab3a28a6638264b292f83398187`, source manifest `840c6ed88666461077054aff032b9e45ccc75a14e20de89ea1996357ba763d80`, and the canonical tracked source config. It also binds the GarageBand/macOS environment, installed license and all six declared resources, deterministic project-tree inventory/hash, matching render hash, declared candidate mix, and all nine exact screenshot hashes. The `.band` package must contain no symlink, hardlink, non-regular or empty file, and `Media/Audio Files` must be empty.
6. Receipt fields remain evidence-bounded. `appleLoopsUsed: false`, `externalAudioRegions: []`, and `mix` are hash-bound source declarations plus limited bundle-inventory observations; they are not a parsed proof of the live GarageBand UI state. Screenshot hashes prove only which bytes were retained, not what those pixels mean. Therefore every receipt must retain `projectSemanticVerificationStatus: UNVERIFIED`, `mixApplicationVerificationStatus: UNVERIFIED`, and `visualEvidenceStatus: HASH_BOUND_NOT_SEMANTICALLY_VERIFIED` until the controller and owner inspect the visible evidence. Receipt creation also does not prove WAV format, duration, signal quality, artistic fit, rights clearance, or release readiness. Every receipt deliberately remains `runtimePromotionStatus: NOT_ALLOWED` and `ownerArtisticStatus: UNVERIFIED`. Task 5 must independently decode and audit the full 166-second masters; the owner must then choose exact candidate hash `01`, `02`, `03`, or `NONE`.
7. Do not select, replace, cache, package, publish, or promote a candidate until the owner listens and chooses one exact candidate hash. A choice of `NONE` ends the review without production audio change. The later 150-second seamless runtime loop is a separate post-selection plan; none of these 166-second linear receipts authorizes it.
