# First-Party Kimi Audio Reconstruction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a deterministic, rights-traceable, 26-file review-only audio pack without modifying ZenFlow runtime audio.

**Architecture:** A standalone Python/NumPy synthesis tool generates clean-room waveforms, encodes them through a build-time FFmpeg process, decodes each MP3 for objective QC, and writes hash-bound provenance, rights, verification, and listening evidence. Generated binaries remain outside runtime paths and are reviewed separately before any promotion decision.

**Tech Stack:** Python 3, NumPy, FFmpeg/ffprobe, `unittest`, JSON evidence.

**Spec:** `docs/superpowers/specs/2026-08-24-first-party-kimi-audio-reconstruction-design.md`

## Global Constraints

- Inventory is exactly 26 MP3 files.
- Every waveform is first-party deterministic procedural synthesis.
- No recovered Kimi binary or derivative is an input.
- No third-party recording, sample, voice, MIDI, or AI-generated audio input is allowed.
- Output is 48 kHz stereo MP3 at 128 kbps.
- Runtime replacement is forbidden in this change.
- Human listening and all five platform playback states remain `UNVERIFIED` until separately demonstrated.

---

### Task 1: Lock the exact review contract

**Files:**
- Create: `docs/audio/first-party-kimi-audio-reconstruction-spec.json`
- Create: `docs/superpowers/specs/2026-08-24-first-party-kimi-audio-reconstruction-design.md`

- [ ] Define the six Hyperfocus families, three levels, three ambience files, and five feedback files.
- [ ] Encode the 48 kHz/stereo/duration/peak/intensity requirements.
- [ ] Encode fail-closed rights and release states.
- [ ] Review the documents for placeholders, contradictions, and accidental runtime authorization.

### Task 2: Add the deterministic synthesis engine

**Files:**
- Create: `scripts/audio_review/generate_first_party_review_pack.py`
- Test: `scripts/audio_review/tests/test_generate_first_party_review_pack.py`

- [ ] Write a failing inventory test requiring the exact 26 filenames.
- [ ] Run the focused test and confirm it fails because the generator does not exist.
- [ ] Implement deterministic seeded signal layers for forest, rain, ocean, fireplace, river, wind, long ambience, and short cues.
- [ ] Implement bounded RMS/peak normalization and loop crossfades.
- [ ] Rerun the inventory and deterministic-generation tests green.

### Task 3: Add decoded MP3 QC and provenance

**Files:**
- Modify: `scripts/audio_review/generate_first_party_review_pack.py`
- Modify: `scripts/audio_review/tests/test_generate_first_party_review_pack.py`

- [ ] Write failing tests for 48 kHz stereo MP3, exact SHA-256, duration, clipping, DC offset, seam limits, and intensity progression.
- [ ] Run the focused suite and confirm the expected failures.
- [ ] Encode with FFmpeg, decode the produced MP3, calculate QC metrics, and reject failed assets.
- [ ] Write `provenance.json`, `rights-ledger.json`, `decoded-qc.json`, `verification.json`, and `SHA256SUMS`.
- [ ] Rerun the focused suite green.

### Task 4: Produce the isolated review artifact

**Files:**
- Generated outside runtime: `output/first-party-audio-review/**`
- Generated archive: `output/first-party-audio-review.zip`

- [ ] Run the complete 26-file generator.
- [ ] Run the full review-pack test suite.
- [ ] Confirm generated files do not appear under `public/sounds`, `docs/sounds`, native bundles, manifests, or service-worker paths.
- [ ] Write a hash-bound human listening checklist.
- [ ] Package audio, source, tests, evidence, and logs into one review ZIP.

### Task 5: Hand off without runtime promotion

**Files:**
- No runtime files.

- [ ] Review the Git diff for runtime audio paths.
- [ ] Open a draft pull request containing only the reproducible tooling and contract.
- [ ] Attach or otherwise provide the isolated review ZIP outside runtime.
- [ ] Record Web, PWA, Android, iOS, Desktop, human listening, and legal acceptance as `UNVERIFIED`.
- [ ] Do not merge or promote binaries without an explicit follow-up acceptance decision.
