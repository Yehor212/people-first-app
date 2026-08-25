# CC0 Kimi-Role Audio Reconstruction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a hash-bound 26-file listening package using documented CC0 field recordings and deterministic first-party synthesis without modifying ZenFlow runtime audio.

**Architecture:** A standalone Node.js generator downloads an exact source inventory, masters source-derived environmental loops with FFmpeg, synthesizes first-party cues in PCM, decodes all outputs for objective QC, and writes rights/provenance evidence. A least-privilege GitHub Actions workflow packages audio, spectrograms, generator source, tests, and evidence into a review-only ZIP.

**Tech Stack:** Node.js 22, FFmpeg/ffprobe, Node test runner, GitHub Actions, JSON evidence.

**Spec:** `docs/superpowers/specs/2026-08-25-cc0-kimi-audio-reconstruction-design.md`

## Global Constraints

- Inventory is exactly 26 MP3 files.
- Twenty files use only recorded BigSoundBank CC0 sources; six use first-party deterministic synthesis.
- No recovered Kimi audio or derivative signal is an input.
- No voice, MIDI, or AI-generated audio input is allowed.
- Output is 48 kHz stereo MP3 at 128 kbps.
- Generated files remain outside runtime paths.
- Human listening, platform playback, formal legal review, and release authorization remain `UNVERIFIED`.

---

### Task 1: Lock inventory and rights contract

**Files:**
- Create: `docs/audio/cc0-kimi-audio-reconstruction-spec.json`
- Create: `docs/superpowers/specs/2026-08-25-cc0-kimi-audio-reconstruction-design.md`

- [x] Record the exact 26-file inventory and 20/6 source split.
- [x] Record objective audio, rights, platform, and release gates.
- [x] Keep runtime promotion explicitly unauthorized.

### Task 2: Implement the hybrid generator test-first

**Files:**
- Create: `scripts/audio-review/generate-cc0-kimi-review-pack.mjs`
- Create: `scripts/audio-review/__tests__/generate-cc0-kimi-review-pack.test.mjs`

- [x] Add failing tests for exact inventory, source URLs, rights declarations, source-span bounds, and deterministic procedural PCM.
- [x] Implement CC0 source acquisition, source mastering, procedural synthesis, decoded QC, spectral fingerprints, provenance, and rights evidence.
- [x] Run static and focused tests green.

### Task 3: Add a review-artifact workflow

**Files:**
- Create: `.github/workflows/cc0-kimi-audio-review.yml`
- Create: `scripts/audio-review/__tests__/cc0-kimi-audio-review-workflow.test.mjs`

- [x] Require read-only repository permissions and pinned GitHub actions.
- [x] Install FFmpeg, run tests, build all 26 full-duration files, verify fail-closed release state, generate spectrograms, and upload one artifact.
- [x] Keep output outside all runtime asset paths.

### Task 4: Freeze source bytes and rerun

**Files:**
- Create: `docs/audio/cc0-kimi-audio-source-lock.json`
- Modify: `scripts/audio-review/generate-cc0-kimi-review-pack.mjs`
- Modify: `scripts/audio-review/__tests__/generate-cc0-kimi-review-pack.test.mjs`

- [ ] Generate the bootstrap artifact and extract exact source SHA-256 and byte counts.
- [ ] Commit the source-byte lock and fail when a future download differs.
- [ ] Rerun the full artifact workflow green.

### Task 5: Independent artifact inspection

**Files:**
- Generated: `output/cc0-kimi-audio-review/**`
- Generated: `cc0-kimi-audio-review-<sha>.zip`

- [ ] Download the final workflow artifact.
- [ ] Independently verify inventory, hashes, probes, decoded metrics, family distinctness, source locks, and runtime isolation.
- [ ] Deliver the ZIP for human listening without merging or promoting runtime assets.
