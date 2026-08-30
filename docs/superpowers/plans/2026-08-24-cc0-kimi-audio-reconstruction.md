# CC0 Kimi Audio Reconstruction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a hash-bound, review-only package recreating all 26 quarantined audio roles from verified CC0 recordings and first-party procedural synthesis without changing runtime assets.

**Architecture:** A Python 3.12 toolchain validates an exact JSON specification, downloads and verifies BigSoundBank sources through a fail-closed rights gate, renders 48 kHz stereo MP3 files with deterministic DSP, writes evidence ledgers, and independently verifies the temporary package before atomic promotion. A read-only GitHub Actions workflow runs tests, builds the package, and uploads it as a temporary review artifact.

**Tech Stack:** Python 3.12 standard library, NumPy 2.1.3, ffmpeg/ffprobe, `unittest`, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-08-24-cc0-kimi-audio-reconstruction-design.md`

## Global Constraints

- The inventory is exactly 26 MP3 files: 18 Hyperfocus, three ambience, and five feedback cues.
- Every output stream is 48 kHz stereo MP3 at 128 kbps.
- Hyperfocus sources must pass the CC0 1.0 distribution, adaptation, and commercial-use gate.
- No Kimi binary, waveform, spectrogram, or derivative input may be used.
- Output remains under `output/cc0-kimi-audio-review`; runtime paths are forbidden.
- Human listening and all five runtime targets remain pending after objective QC.

---

### Task 1: Exact review specification and validation

**Files:** `config/audio/cc0-kimi-audio-review-spec.json`, `scripts/audio_review/model.py`, `scripts/audio_review/tests/test_review_tool.py`

**Interface:** `load_spec(path) -> ReviewSpec`; `validate_spec_dict(data) -> ReviewSpec`.

- [x] Test the exact 26-role inventory, `REVIEW_ONLY`, 48 kHz stereo, unique review paths, and CC0 sources.
- [x] Observe RED before the model exists.
- [x] Implement immutable models and aggregated fail-closed validation.
- [x] Rerun the focused test GREEN.

### Task 2: CC0 source acquisition and evidence

**Files:** `scripts/audio_review/rights.py`, `scripts/audio_review/tests/test_review_tool.py`

**Interface:** `acquire_source(SourceRequest, HttpClient) -> SourceRecord`.

- [x] Test official CC0 wording classes, local sitemap resolution, SHA-bound acquisition, offline cache reuse, and mismatched-number rejection.
- [x] Observe RED before the rights module exists.
- [x] Implement bounded HTTPS retrieval, atomic cache writes, sitemap resolution, source-page parsing, canonical license validation, source-number binding, audio-magic checks, and SHA-256 evidence.
- [x] Rerun focused tests GREEN.

### Task 3: DSP and procedural synthesis

**Files:** `scripts/audio_review/dsp.py`, `scripts/audio_review/procedural.py`, `scripts/audio_review/tests/test_review_tool.py`

**Interfaces:** `render_hyperfocus`, `generate_ambience`, `generate_feedback`, `encode_mp3`, `measure_audio`.

- [x] Test 48 kHz stereo encoding, bounded peak/DC, loop seam, deterministic ambience, smooth cue edges, and three-level progression.
- [x] Observe RED before implementation.
- [x] Implement loop crossfades, family spectral shaping, periodic textures, RMS/peak normalization, fixed-note envelopes, MP3 encoding, and decoded metrics.
- [x] Rerun focused tests GREEN.

### Task 4: Evidence, atomic build, and independent verification

**Files:** `scripts/audio_review/evidence.py`, `scripts/audio_review/builder.py`, `scripts/audio_review/build.py`, `scripts/audio_review/verify.py`, `scripts/audio_review/tests/test_review_tool.py`

**Interfaces:** `build_review_package(...) -> dict`; `verify_package(...) -> dict`.

- [x] Test hash-first tamper classification, hash-bound human review, exact 26-file build, independent verification, and preservation of an existing output on failure.
- [x] Observe separate RED runs for missing evidence and builder modules.
- [x] Implement rights/provenance/QC/environment ledgers, intensity gates, SHA256SUMS, temporary build directories, independent verification, and atomic promotion.
- [x] Rerun the full local test suite GREEN.

### Task 5: Read-only CI artifact and documentation

**Files:** `.github/workflows/cc0-kimi-audio-review.yml`, `scripts/audio_review/requirements.txt`, `docs/audio/cc0-kimi-audio-review.md`

**Interface:** a 14-day GitHub Actions artifact named `cc0-kimi-audio-review`.

- [x] Test read-only permissions, disabled credential persistence, absence of secrets and push commands, review-only output paths, and required test/build/verify commands.
- [x] Pin Python to 3.12 and NumPy to 2.1.3; install system ffmpeg.
- [x] Upload only the review package, never the source cache or runtime paths.
- [ ] Confirm the GitHub Actions run succeeds against all live source pages and download the artifact.

### Task 6: Human and runtime acceptance

**Generated file:** `human-review.json`. Runtime promotion is explicitly outside this plan.

- [ ] Listen to every Hyperfocus and ambience loop for at least ten minutes on headphones and a built-in speaker.
- [ ] Record `ACCEPT` or `REJECT` against each exact hash with concrete rejection reasons.
- [ ] Verify Web/Vite, installed PWA, Android/Capacitor, iOS/WKWebView, and Desktop/Tauri in a separate promotion branch.
- [ ] Promote no file unless every required decision and platform proof is complete.
