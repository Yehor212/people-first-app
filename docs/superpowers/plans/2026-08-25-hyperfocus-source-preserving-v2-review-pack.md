# Hyperfocus Source-Preserving V2 Review Pack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task in the current SOLO lane. Steps use checkbox (`- [ ]`) syntax for tracking. Do not dispatch subagents unless the current user explicitly changes the SOLO boundary.

**Goal:** Produce a new rights-bound blind listening bundle with three raw CC0 source candidates per Hyperfocus family, screen it through the strict AI auditor, collect owner source/window decisions, and then render one same-source/same-window `Soft`/`Deep`/`Intense` trio per family without synthetic texture.

**Architecture:** A new Hyperfocus-only candidate specification reuses the existing hardened BigSoundBank rights acquisition but never maps a source directly to a product level. The candidate builder extracts raw, reversible, equal-duration source previews into a private blind bundle; the independent AI auditor emits sealed trial evidence; only explicit owner selections authorize base-loop and mastering stages. Final review output remains outside product/runtime paths and cannot be promoted before all AI, technical, rights, and human gates pass.

**Tech Stack:** Python 3.12 standard library, NumPy 2.1.3 for existing rights/build compatibility, WAV/PCM processing, `/usr/bin/afconvert` for local review encodes when required, CI `ffmpeg/libmp3lame` for canonical MP3 evidence, `unittest`, existing `scripts/audio_review` rights/quarantine/evidence modules, new `scripts/audio_candidates` package, strict AI auditor from `2026-08-25-hyperfocus-ai-semantic-auditor.md`.

**Spec:** `docs/superpowers/specs/2026-08-25-hyperfocus-semantic-audio-v2-design.md`

## Global Constraints

- Candidate inventory is exactly six families × three anonymous source candidates = 18 raw previews, plus `NONE` as a decision for every family.
- Candidate source names, provider item IDs, current/incumbent status, objective metrics, and AI scores are hidden from the owner until the blind decision is recorded.
- Every source must be CC0, item-page bound, author named, 48 kHz stereo, at least 30 seconds, and absent from the 26-hash quarantine denylist.
- No candidate uses recovered Kimi bytes, AI-generated audio, Mixkit, a second source, synthetic noise, procedural texture, pitch/time shift, stereo widening, source separation, or generative repair.
- Raw source previews may decode to a common PCM container and carry analysis-only playback gain metadata; preview audio receives no EQ, compression, limiting, denoising, crossfade, or product subtitle.
- AI screening is read-only. Before auditor admission, model results are `TRIAL_ONLY_NOT_ADMITTED` and cannot select a source or claim semantic `PASS`.
- The owner may choose `NONE`; no family is silently advanced with fewer than three candidates.
- After owner selection, every family uses one exact source SHA, one exact source window, and one canonical base PCM SHA across all three levels.
- Final mastering uses only bounded gain, broad EQ, broadband compression/transient control, safety limiting, and deterministic encoding.
- Review artifacts remain outside `public`, `docs/sounds`, `dist`, Android/iOS assets, Tauri resources, and all runtime paths.
- Runtime promotion, Git push, PR, deployment, store submission, and release remain outside this plan.

## Initial Rights-Candidate Matrix

The matrix is a discovery input, not artistic approval. A live mismatch in page identity, author, license, channels, sample rate, source bytes, or hard exclusion changes the candidate status to `REJECTED` and requires a new rights-qualified candidate before the blind bundle can contain three items.

| Family      | Candidate IDs                                  | Live source-page identities                                                              |
| ----------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `forest`    | `forest-c1`, `forest-c2`, `forest-c3`          | BigSoundBank `1348` Forest #2; `2749` Forest #4; `905` Forest: On the Edge               |
| `rain`      | `rain-c1`, `rain-c2`, `rain-c3`                | `1019` Summer Rain on Terrace; `2679` Rain Under an Umbrella; `2719` Rain and Thunder #4 |
| `ocean`     | `ocean-c1`, `ocean-c2`, `ocean-c3`             | `698` Sea Waves; `2567` Sea of Dellec Beach #4; `1446` Small Waves and Beach #1          |
| `fireplace` | `fireplace-c1`, `fireplace-c2`, `fireplace-c3` | `2855` Fireplace #3; `2856` Fireplace #4; `2857` Fireplace #5                            |
| `river`     | `river-c1`, `river-c2`, `river-c3`             | `1354` Small Stream #4; `3222` Mountain Stream #7; `2754` Mountain Stream #1             |
| `wind`      | `wind-c1`, `wind-c2`, `wind-c3`                | `904` Wind in the Trees; `907` Wind in Shrub; `1451` Strong Wind and Trees #2            |

Known source-description concerns are not hidden from the system: several forest candidates mention birds, `rain-c2` has umbrella/street identity, and `rain-c3` contains thunder somewhere in a long recording. They are included only as blind candidates subject to window/event screening and may be rejected by AI or owner. Their presence never lowers the exclusion criteria.

---

### Task 1: Exact Candidate Schema And Inventory

**Files:**

- Create: `config/audio/hyperfocus-source-candidates-v2.json`
- Create: `scripts/audio_candidates/__init__.py`
- Create: `scripts/audio_candidates/model.py`
- Create: `scripts/audio_candidates/tests/__init__.py`
- Create: `scripts/audio_candidates/tests/test_candidate_tool.py`

**Interfaces:**

- Produces: `load_candidate_spec(path: str | Path) -> CandidateSpec`.
- Produces immutable `CandidateSource`, `FamilyCandidates`, and `CandidateSpec` dataclasses.

- [ ] **Step 1: Write the failing exact-inventory tests**

```python
class CandidateSpecTests(unittest.TestCase):
    def test_spec_has_exact_six_by_three_cc0_source_inventory(self):
        spec = load_candidate_spec(SPEC_PATH)
        self.assertEqual(tuple(spec.families), ("forest", "rain", "ocean", "fireplace", "river", "wind"))
        self.assertEqual(sum(len(row.candidates) for row in spec.families.values()), 18)
        self.assertTrue(all(len(row.candidates) == 3 for row in spec.families.values()))
        self.assertTrue(all(row.none_allowed for row in spec.families.values()))

    def test_candidates_are_sources_not_product_levels(self):
        data = json.loads(SPEC_PATH.read_text())
        serialized = json.dumps(data).lower()
        self.assertNotIn('"level"', serialized)
        self.assertNotIn('"soft"', serialized)
        self.assertNotIn('"deep"', serialized)
        self.assertNotIn('"intense"', serialized)
```

- [ ] **Step 2: Run RED**

Run: `python3 -m unittest scripts.audio_candidates.tests.test_candidate_tool.CandidateSpecTests -v`

Expected: `ModuleNotFoundError: No module named 'scripts.audio_candidates'`.

- [ ] **Step 3: Implement strict schema validation**

```python
@dataclass(frozen=True)
class CandidateSource:
    id: str
    family: str
    provider: str
    provider_root: str
    sound_number: int
    page_url: str
    license_id: str
    license_url: str

@dataclass(frozen=True)
class FamilyCandidates:
    family: str
    candidates: tuple[CandidateSource, CandidateSource, CandidateSource]
    none_allowed: bool
```

Reject duplicate sound numbers, duplicate IDs, unapproved hosts, non-HTTPS URLs, non-CC0 entries, product labels, levels, runtime paths, unbounded preview lengths, or missing expected source-page identities.

- [ ] **Step 4: Run GREEN**

Run: `python3 -m unittest scripts.audio_candidates.tests.test_candidate_tool.CandidateSpecTests -v`

- [ ] **Step 5: Commit**

```bash
git add config/audio/hyperfocus-source-candidates-v2.json scripts/audio_candidates
git commit -m "test(audio): define blind source candidate inventory"
```

### Task 2: Source-Specific Rights Acquisition

**Files:**

- Create: `scripts/audio_candidates/rights.py`
- Create: `scripts/audio_candidates/build_sources.py`
- Modify: `scripts/audio_candidates/tests/test_candidate_tool.py`
- Reuse without weakening: `scripts/audio_review/rights.py`
- Reuse without weakening: `scripts/audio_review/quarantine.py`

**Interfaces:**

- Consumes: `CandidateSource`.
- Produces: `acquire_candidate(source: CandidateSource, cache_root: Path, client: HttpClient) -> SourceRecord`.
- Produces: `write_candidate_rights_receipt(record: SourceRecord, receipt_root: Path) -> Path`.

- [ ] **Step 1: Write RED tests for exact page/title/format/rights boundaries**

```python
def test_candidate_requires_live_number_author_cc0_stereo_48khz_and_minimum_duration(self):
    record = acquire_candidate(CANDIDATE, cache_root, VALID_CLIENT)
    self.assertEqual(record.sound_number, CANDIDATE.sound_number)
    self.assertEqual(record.license_id, "CC0-1.0")
    self.assertEqual(record.channels_declared, 2)
    self.assertEqual(record.sample_rate_declared, 48000)

def test_candidate_rejects_page_drift_mono_short_or_quarantined_source(self):
    for client, expected in REJECTING_CLIENTS:
        with self.subTest(expected=expected), self.assertRaisesRegex(RightsError, expected):
            acquire_candidate(CANDIDATE, cache_root, client)
```

- [ ] **Step 2: Verify RED**

Run: `python3 -m unittest scripts.audio_candidates.tests.test_candidate_tool.CandidateRightsTests -v`

- [ ] **Step 3: Implement a narrow adapter over the hardened rights module**

Call the existing `acquire_source()` for sitemap/page/license/audio binding, then add candidate-specific checks for expected canonical page URL, exact displayed source title captured from live evidence, stereo, 48 kHz, and decoded/probed duration ≥30 seconds. Do not copy source audio into receipts or tracked paths.

- [ ] **Step 4: Run the new rights tests GREEN**

Run: `python3 -m unittest scripts.audio_candidates.tests.test_candidate_tool.CandidateRightsTests -v`

- [ ] **Step 5: Create the isolated review-tool environment**

Run:

```bash
uv venv --python 3.12 /Users/yehor/Projects/ZenFlow/private-evidence/hyperfocus-v2/envs/review
uv pip install --python /Users/yehor/Projects/ZenFlow/private-evidence/hyperfocus-v2/envs/review/bin/python --require-hashes --only-binary=:all: -r scripts/audio_review/requirements.txt
```

Expected: NumPy is installed only in the private environment from the existing hash-locked review requirements.

- [ ] **Step 6: Run all old and new rights tests in the review environment**

Run:

```bash
/Users/yehor/Projects/ZenFlow/private-evidence/hyperfocus-v2/envs/review/bin/python -m unittest scripts.audio_candidates.tests.test_candidate_tool.CandidateRightsTests -v
/Users/yehor/Projects/ZenFlow/private-evidence/hyperfocus-v2/envs/review/bin/python -m unittest scripts.audio_review.tests.test_review_tool -v
```

- [ ] **Step 7: Acquire all 18 sources into a new private cache**

Run:

```bash
/Users/yehor/Projects/ZenFlow/private-evidence/hyperfocus-v2/envs/review/bin/python -m scripts.audio_candidates.build_sources --spec config/audio/hyperfocus-source-candidates-v2.json --cache /Users/yehor/Projects/ZenFlow/private-evidence/hyperfocus-v2/source-cache --receipts /Users/yehor/Projects/ZenFlow/private-evidence/hyperfocus-v2/rights-receipts
```

Expected: each family has exactly three `RIGHTS_REVIEWED_TECHNICAL_PENDING` records. If any candidate fails, the build stops before a blind bundle and records exact reasons; it does not reduce candidate count.

- [ ] **Step 8: Commit code only**

```bash
git add scripts/audio_candidates
git commit -m "feat(audio): acquire rights-bound source candidates"
```

### Task 3: Raw Preview Builder And Technical Verifier

**Files:**

- Create: `scripts/audio_candidates/preview.py`
- Create: `scripts/audio_candidates/evidence.py`
- Create: `scripts/audio_candidates/verify.py`
- Modify: `scripts/audio_candidates/tests/test_candidate_tool.py`

**Interfaces:**

- Produces: `build_raw_preview(source_path: Path, source_sha256: str, preview_root: Path) -> PreviewRecord`.
- Produces: `verify_preview(record: PreviewRecord, source_record: SourceRecord) -> dict`.

- [ ] **Step 1: Add RED raw-preview tests**

```python
def test_preview_is_contiguous_raw_pcm_without_dsp_or_level_identity(self):
    record = build_raw_preview(SOURCE_WAV, SOURCE_SHA, output_root)
    self.assertEqual(record.start_frame, 5 * 48000)
    self.assertEqual(record.frame_count, min(20 * 48000, record.available_frames))
    self.assertEqual(record.operations, ("decode-pcm", "contiguous-extract"))
    self.assertIsNone(record.product_level)

def test_preview_verifier_rejects_eq_compression_crossfade_or_added_layer(self):
    for operation in ("eq", "compression", "crossfade", "mix", "synthetic-texture"):
        with self.assertRaisesRegex(PreviewError, "prohibited preview operation"):
            verify_operations(("decode-pcm", operation))
```

- [ ] **Step 2: Verify RED**

Run: `/Users/yehor/Projects/ZenFlow/private-evidence/hyperfocus-v2/envs/review/bin/python -m unittest scripts.audio_candidates.tests.test_candidate_tool.PreviewTests -v`

- [ ] **Step 3: Implement deterministic preview extraction**

Read PCM WAV safely, require 48 kHz stereo finite samples, and extract a 20-second contiguous window beginning at five seconds. For a source shorter than 25 seconds but at least 30 seconds by contract, this branch is unreachable and must be tested as a validator failure. Write 24-bit stereo WAV previews; store recommended playback gain as JSON metadata only, never render it into bytes.

```python
@dataclass(frozen=True)
class PreviewRecord:
    candidate_id: str
    source_sha256: str
    start_frame: int
    frame_count: int
    sample_rate: int
    channels: int
    operations: tuple[str, ...]
    preview_path: str
    preview_sha256: str
    playback_gain_db: float
    product_level: None
```

- [ ] **Step 4: Implement independent technical verification**

Verify exact source-frame equality after decoding the preview, no unlisted operation, 48 kHz stereo, duration, finite samples, peak/DC bounds, candidate/source hash chain, denylist absence, and exact 18-file inventory.

- [ ] **Step 5: Run GREEN and commit**

Run: `/Users/yehor/Projects/ZenFlow/private-evidence/hyperfocus-v2/envs/review/bin/python -m unittest scripts.audio_candidates.tests.test_candidate_tool.PreviewTests -v`

```bash
git add scripts/audio_candidates
git commit -m "feat(audio): build source-preserving raw previews"
```

### Task 4: Blind Bundle With Sealed AI Trial Evidence

**Files:**

- Create: `scripts/audio_candidates/blind.py`
- Create: `scripts/audio_candidates/build.py`
- Create: `scripts/audio_candidates/review.py`
- Modify: `scripts/audio_candidates/tests/test_candidate_tool.py`
- Consume: `scripts/audio_audit/audit.py` from the auditor plan.

**Interfaces:**

- Produces: `build_blind_bundle(previews, bundle_root, seed_bytes) -> BlindBundle`.
- Produces: `apply_source_review(bundle, owner_input) -> SourceReviewReceipt`.

- [ ] **Step 1: Add RED blindness and non-conversion tests**

```python
def test_public_bundle_contains_only_family_and_abc_names(self):
    bundle = build_blind_bundle(PREVIEWS, output_root, bytes.fromhex("00" * 32))
    public_text = "\n".join(path.name for path in bundle.public_files)
    for forbidden in ("BigSoundBank", "current", "incumbent", "2856", "source title"):
        self.assertNotIn(forbidden.lower(), public_text.lower())

def test_ai_report_cannot_choose_candidate_or_fill_owner_fields(self):
    with self.assertRaisesRegex(ReviewError, "owner decision required"):
        apply_source_review(BUNDLE, {"forest": {"decision": "AI_TOP_SCORE"}})
```

- [ ] **Step 2: Verify RED**

Run: `/Users/yehor/Projects/ZenFlow/private-evidence/hyperfocus-v2/envs/review/bin/python -m unittest scripts.audio_candidates.tests.test_candidate_tool.BlindBundleTests -v`

- [ ] **Step 3: Implement cryptographic blind mapping**

Derive a per-family Fisher-Yates permutation from a 32-byte random seed, store the seed and source mapping only in private `blind-map.json`, and expose files as `forest-A.wav`, `forest-B.wav`, `forest-C.wav` through `wind-C.wav`. The public review form offers `A`, `B`, `C`, and `NONE` only.

- [ ] **Step 4: Run the independent AI auditor before opening the bundle**

Audit source and preview scopes with sealed model/policy evidence. Write AI reports under private `evidence/ai/`; do not add scores, rankings, source names, or warnings to the public listening folder. Before hidden-holdout admission, the report status remains `TRIAL_ONLY_NOT_ADMITTED` even if its bounded verdict is useful diagnostically.

- [ ] **Step 5: Atomically build and independently verify the bundle**

Run:

```bash
/Users/yehor/Projects/ZenFlow/private-evidence/hyperfocus-v2/envs/review/bin/python -m scripts.audio_candidates.build --spec config/audio/hyperfocus-source-candidates-v2.json --source-cache /Users/yehor/Projects/ZenFlow/private-evidence/hyperfocus-v2/source-cache --rights /Users/yehor/Projects/ZenFlow/private-evidence/hyperfocus-v2/rights-receipts --output /Users/yehor/Projects/ZenFlow/private-evidence/hyperfocus-v2/source-audition-v1 --ai-python /Users/yehor/Projects/ZenFlow/private-evidence/audio-ai-audit/envs/clap/bin/python
/Users/yehor/Projects/ZenFlow/private-evidence/hyperfocus-v2/envs/review/bin/python -m scripts.audio_candidates.verify --spec config/audio/hyperfocus-source-candidates-v2.json --package /Users/yehor/Projects/ZenFlow/private-evidence/hyperfocus-v2/source-audition-v1
```

Private output root:

`/Users/yehor/Projects/ZenFlow/private-evidence/hyperfocus-v2/source-audition-v1`

Required private evidence:

```text
blind-map.json
build-environment.json
rights-ledger.json
preview-provenance.json
preview-qc.json
ai/ai-audit-report.json
source-review.json
SHA256SUMS
```

Required public listening folder:

```text
listen/{forest,rain,ocean,fireplace,river,wind}-{A,B,C}.wav
listen/SOURCE_REVIEW.md
```

- [ ] **Step 6: Run GREEN and commit**

Run: `/Users/yehor/Projects/ZenFlow/private-evidence/hyperfocus-v2/envs/review/bin/python -m unittest scripts.audio_candidates.tests.test_candidate_tool.BlindBundleTests -v`

```bash
git add scripts/audio_candidates
git commit -m "feat(audio): build blind AI-screened source bundle"
```

### Task 5: Owner Source Decision Gate

**Private files:**

- Input: `/Users/yehor/Projects/ZenFlow/private-evidence/hyperfocus-v2/source-audition-v1/source-review.json`
- Owner input: `/Users/yehor/Projects/ZenFlow/private-evidence/hyperfocus-v2/source-audition-v1/owner-source-input.json`
- Final receipt: `/Users/yehor/Projects/ZenFlow/private-evidence/hyperfocus-v2/source-audition-v1/source-review-final.json`

- [ ] **Step 1: Open only the blind listening folder**

Run:

```bash
open -a Finder /Users/yehor/Projects/ZenFlow/private-evidence/hyperfocus-v2/source-audition-v1/listen
```

- [ ] **Step 2: Collect one owner decision per family**

Generate the owner input from the exact sealed review packet so the tool, not an agent, copies the bundle hash and all six blind mappings:

```bash
python3 -m scripts.audio_candidates.review --init-owner-input /Users/yehor/Projects/ZenFlow/private-evidence/hyperfocus-v2/source-audition-v1/source-review.json --output /Users/yehor/Projects/ZenFlow/private-evidence/hyperfocus-v2/source-audition-v1/owner-source-input.json
```

The generated file contains exact artifact identity plus `PENDING` for all six families. The owner replaces only `PENDING` with `A`, `B`, `C`, or `NONE`, supplies identity/purity ratings and rejection reasons, and enters their reviewer field. The agent never writes a decision value or reviewer attestation.

- [ ] **Step 3: Validate and seal the review**

Require all six families, exact artifact/hash mapping, decision `A|B|C|NONE`, identity/purity values 1–5, rejection reasons for `NONE`, reviewer, timestamp, and playback contexts. Any `NONE` keeps that family blocked and starts a new three-candidate source cycle.

- [ ] **Step 4: Stop until all six families have owner-selected sources**

This is an intentional human-authority gate, not deferred implementation. The next tasks execute only for families with exact owner decisions.

### Task 6: Blind Window Selection And Canonical Base Loops

**Files:**

- Create: `scripts/audio_candidates/windows.py`
- Create: `scripts/audio_candidates/base_loop.py`
- Modify: `scripts/audio_candidates/tests/test_candidate_tool.py`

**Interfaces:**

- Produces: `build_window_bundle(source_record, output_root) -> WindowBundle`.
- Produces: `build_base_loop(source_record, selected_window, output_path) -> BaseLoopRecord`.

- [ ] **Step 1: Add RED window/base identity tests**

```python
def test_window_bundle_has_three_contiguous_windows_plus_none(self):
    bundle = build_window_bundle(SOURCE_RECORD, output_root)
    self.assertEqual(tuple(row.blind_id for row in bundle.windows), ("A", "B", "C"))
    self.assertTrue(bundle.none_allowed)
    self.assertTrue(all(row.operations == ("contiguous-extract",) for row in bundle.windows))

def test_one_base_hash_is_shared_by_all_future_levels(self):
    base = build_base_loop(SOURCE_RECORD, SELECTED_WINDOW, output_path)
    self.assertEqual(base.source_sha256, SOURCE_RECORD.source_sha256)
    self.assertEqual(base.start_frame, SELECTED_WINDOW.start_frame)
    self.assertEqual(base.frame_count, 30 * 48000)
```

- [ ] **Step 2: Verify RED**

Run: `/Users/yehor/Projects/ZenFlow/private-evidence/hyperfocus-v2/envs/review/bin/python -m unittest scripts.audio_candidates.tests.test_candidate_tool.WindowAndBaseTests -v`

Expected: window/base-loop functions are missing.

- [ ] **Step 3: Implement deterministic windows and one canonical base**

Create three non-overlapping or minimally overlapping 30-second contiguous windows distributed across the selected source. Blind them independently from the source audition. After owner selection, create one 30-second 48 kHz stereo base PCM with one documented common equal-power loop crossfade. No level-specific operation exists in this task.

- [ ] **Step 4: Run the focused tests GREEN**

Run: `/Users/yehor/Projects/ZenFlow/private-evidence/hyperfocus-v2/envs/review/bin/python -m unittest scripts.audio_candidates.tests.test_candidate_tool.WindowAndBaseTests -v`

- [ ] **Step 5: Run technical and AI audit on source/windows/base**

Any prohibited event, family mismatch, or `ABSTAIN` remains visible in evidence and blocks mastering after auditor admission. Before admission, owner selection plus technical provenance can advance a review-only base, but status remains `AI_UNVERIFIED`.

- [ ] **Step 6: Commit code after GREEN tests**

```bash
git add scripts/audio_candidates
git commit -m "feat(audio): bind owner windows to canonical loops"
```

### Task 7: Source-Preserving Three-Level Mastering

**Files:**

- Create: `scripts/audio_candidates/mastering.py`
- Create: `config/audio/hyperfocus-mastering-recipes-v2.json`
- Modify: `scripts/audio_candidates/tests/test_candidate_tool.py`

**Interfaces:**

- Produces: `master_family(base: BaseLoopRecord, recipe: FamilyMasteringRecipe, output_root: Path) -> MasteredTrio`.

- [ ] **Step 1: Add RED operation-allowlist and same-base tests**

```python
def test_mastered_trio_uses_one_base_and_only_allowed_operations(self):
    trio = master_family(BASE, RECIPE, output_root)
    self.assertEqual({row.base_pcm_sha256 for row in trio.levels}, {BASE.base_pcm_sha256})
    self.assertTrue(all(set(row.operations) <= {"gain", "broad-eq", "compression", "transient-control", "safety-limit", "encode"} for row in trio.levels))

def test_recipe_rejects_texture_second_source_offset_pitch_time_or_width(self):
    for operation in PROHIBITED_OPERATIONS:
        with self.assertRaisesRegex(MasteringError, "prohibited mastering operation"):
            validate_recipe(recipe_with(operation))
```

- [ ] **Step 2: Verify RED**

Run: `/Users/yehor/Projects/ZenFlow/private-evidence/hyperfocus-v2/envs/review/bin/python -m unittest scripts.audio_candidates.tests.test_candidate_tool.MasteringTests -v`

- [ ] **Step 3: Implement bounded mastering**

Use one base PCM and fixed recipes with nominal integrated-loudness targets near `-31`, `-27`, and `-23 LUFS`, adjacent 3–5 LU separation, true peak ≤ `-1 dBTP`, broad EQ ≤ ±3 dB, ratio ≤ 2:1, and peak gain reduction ≤4 dB. If the canonical local encoder cannot meet the release MP3 contract, render WAV review masters and keep MP3/package status `UNVERIFIED`; do not substitute an unrecorded encoder.

- [ ] **Step 4: Run technical QC, AI audit, and GREEN tests**

Run:

```bash
/Users/yehor/Projects/ZenFlow/private-evidence/hyperfocus-v2/envs/review/bin/python -m unittest scripts.audio_candidates.tests.test_candidate_tool.MasteringTests -v
/Users/yehor/Projects/ZenFlow/private-evidence/audio-ai-audit/envs/clap/bin/python -m scripts.audio_audit.audit --package /Users/yehor/Projects/ZenFlow/private-evidence/hyperfocus-v2/mastering-candidates --policy config/audio/hyperfocus-semantic-audit-v2.json --models config/audio/hyperfocus-ai-models-v2.json --output /Users/yehor/Projects/ZenFlow/private-evidence/hyperfocus-v2/mastering-ai-audit
```

A model score does not permit recipe retuning against the hidden holdout.

- [ ] **Step 5: Commit code/recipes, not private audio**

```bash
git add scripts/audio_candidates config/audio/hyperfocus-mastering-recipes-v2.json
git commit -m "feat(audio): master same-scene intensity trios"
```

### Task 8: Final 18-File Review-Only Package

**Files:**

- Create: `scripts/audio_candidates/package.py`
- Modify: `scripts/audio_candidates/verify.py`
- Modify: `scripts/audio_candidates/tests/test_candidate_tool.py`
- Create: `docs/audio/hyperfocus-v2-review-operator.md`

- [ ] **Step 1: Add RED exact-inventory/non-promotion tests**

Require exactly 18 delivery files, six shared-base family proofs, rights receipts, technical QC, AI report, pending human review, hash inventory, no source bytes, no model bytes, no quarantine hashes, and `runtimePromotionAllowed=false`.

- [ ] **Step 2: Build atomically under private evidence**

Output root:

`/Users/yehor/Projects/ZenFlow/private-evidence/hyperfocus-v2/final-review-package-v1`

If any family is unselected, AI-blocked after admission, technically failing, or missing rights evidence, no 18-file package is created.

Run:

```bash
/Users/yehor/Projects/ZenFlow/private-evidence/hyperfocus-v2/envs/review/bin/python -m scripts.audio_candidates.package --sources /Users/yehor/Projects/ZenFlow/private-evidence/hyperfocus-v2/source-audition-v1/source-review-final.json --windows /Users/yehor/Projects/ZenFlow/private-evidence/hyperfocus-v2/window-reviews --masters /Users/yehor/Projects/ZenFlow/private-evidence/hyperfocus-v2/mastering-candidates --ai-report /Users/yehor/Projects/ZenFlow/private-evidence/hyperfocus-v2/mastering-ai-audit --output /Users/yehor/Projects/ZenFlow/private-evidence/hyperfocus-v2/final-review-package-v1
```

- [ ] **Step 3: Independently verify before opening**

Verify hashes before parsing, exact inventory, source/window/base equality, recipe allowlist, signal bounds, AI evidence status, human pending boundary, and no runtime path writes.

Run: `/Users/yehor/Projects/ZenFlow/private-evidence/hyperfocus-v2/envs/review/bin/python -m scripts.audio_candidates.verify --package /Users/yehor/Projects/ZenFlow/private-evidence/hyperfocus-v2/final-review-package-v1 --mode final`

- [ ] **Step 4: Open only verified review audio**

Run:

```bash
open -a Finder /Users/yehor/Projects/ZenFlow/private-evidence/hyperfocus-v2/final-review-package-v1/audio
```

- [ ] **Step 5: Collect strict blind-trio and labeled long-listening decisions**

Use 15–20-second randomized comparisons for same-scene/intensity questions, then at least ten minutes per file on headphones and built-in speaker, with required rest periods. Only owner-supplied exact-hash inputs can finalize `HUMAN_SEMANTIC_PASS`.

- [ ] **Step 6: Run final checks and commit tracked tooling/docs**

Run:

```bash
/Users/yehor/Projects/ZenFlow/private-evidence/hyperfocus-v2/envs/review/bin/python -m unittest discover -s scripts/audio_candidates/tests -v
/Users/yehor/Projects/ZenFlow/private-evidence/audio-ai-audit/envs/clap/bin/python -m unittest discover -s scripts/audio_audit/tests -v
/Users/yehor/Projects/ZenFlow/private-evidence/hyperfocus-v2/envs/review/bin/python -m unittest discover -s scripts/audio_review/tests -v
npm run check:no-ai-templates
npm run check:best-practices
npm run check:production-data-integrity:diff
git diff --check
```

```bash
git add scripts/audio_candidates docs/audio/hyperfocus-v2-review-operator.md
git commit -m "feat(audio): package strict v2 listening review"
```

## Plan-Specific Done Boundary

- The first independently useful deliverable is the new 18-file blind source-audition bundle; it is opened for owner listening after rights, technical, quarantine, and bounded AI trial evidence are complete.
- Final mastered 18-file output cannot exist before six owner source decisions and six owner window decisions. This is a required human boundary, not an agent limitation to hide.
- No candidate or master is release eligible until the AI auditor is admitted, all exact outputs pass the admitted audit, the owner completes strict listening, rights decisions are current, and every platform/release state is separately proven.
