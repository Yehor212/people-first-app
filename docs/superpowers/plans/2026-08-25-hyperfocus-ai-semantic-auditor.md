# Hyperfocus AI Semantic Auditor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task in the current SOLO lane. Steps use checkbox (`- [ ]`) syntax for tracking. Do not dispatch subagents unless the current user explicitly changes the SOLO boundary.

**Goal:** Build an isolated, read-only, fail-closed AI audit tool that evaluates Hyperfocus source previews and mastered outputs with separate audio-language and temporal event models, preserves `ABSTAIN`, and never converts model output into human or release approval.

**Architecture:** `scripts/audio_audit/` is independent of generator DSP and consumes only immutable artifact paths plus tracked policy/model manifests. A CLAP runner and a YAMNet runner execute in separate hash-locked Python 3.12 environments on CPU; the orchestrator combines exact per-window evidence without voting, writes a new evidence packet atomically, and leaves human/right/release fields untouched. Current `1 PASS / 17 FAIL` owner feedback is a visible regression fixture only; auditor admission remains `UNVERIFIED` until an owner-controlled hidden holdout exists.

**Tech Stack:** Python 3.12, standard library, NumPy/SciPy/SoundFile, PyTorch 2.13.0, Transformers 5.15.1, Safetensors 0.8.0, Hugging Face Hub 1.28.0, TensorFlow 2.21.0, TensorFlow Hub 0.16.1, tf-keras 2.21.0, `unittest`, `uv` 0.11.21, CPU-only inference.

**Spec:** `docs/superpowers/specs/2026-08-25-hyperfocus-semantic-audio-v2-design.md`

## Global Constraints

- AI verdicts are exactly `PASS`, `FAIL`, `ABSTAIN`, or `UNVERIFIED`.
- AI `FAIL`, `ABSTAIN`, and `UNVERIFIED` block downstream promotion; AI `PASS` never creates human, rights, promotion, integration, release, store, or publication evidence.
- The auditor cannot import `scripts.audio_review.dsp`, candidate ranking, recipe selection, or promotion code.
- The auditor has no product/source/model-cache writes and creates evidence only under a new explicitly named output root.
- Canonical evidence runs on CPU with frozen model, weight, policy, preprocessing, calibration, dependency, OS, architecture, and runtime identities.
- No inference-time network request or automatic model download is allowed.
- Only safetensors is loaded for CLAP. The CLAP `pytorch_model.bin` and AST fallback `pytorch_model.bin` are denylisted.
- CLAP model identity is `laion/clap-htsat-fused@365dea6ef167def6676140ed93bbc43f84dabb28`, Apache-2.0.
- Temporal trial backend is Google YAMNet v1 from TensorFlow Hub; its downloaded archive remains `UNVERIFIED_DISCOVERY` until an explicit acquisition receipt freezes its SHA-256.
- The current artifact is visible regression only: expected semantic positive `fireplace:deep`; expected semantic negative all other 17 files; expected overall artifact verdict `FAIL`.
- Hidden holdout contents and labels never enter Git, RAG, generator context, prompts, calibration, or candidate metadata.
- No model code, model weight, native ML library, prompt bank, calibration data, or holdout content enters Web/PWA, Android, iOS, Desktop, or production bundles.

---

### Task 1: Strict Audit Policy And Model Manifests

**Files:**

- Create: `config/audio/hyperfocus-semantic-audit-v2.json`
- Create: `config/audio/hyperfocus-ai-models-v2.json`
- Create: `scripts/audio_audit/__init__.py`
- Create: `scripts/audio_audit/model.py`
- Create: `scripts/audio_audit/tests/__init__.py`
- Create: `scripts/audio_audit/tests/test_audit_tool.py`

**Interfaces:**

- Produces: `load_audit_policy(path: str | Path) -> AuditPolicy`
- Produces: `load_model_manifest(path: str | Path) -> ModelManifest`
- Produces: immutable `FamilyPolicy`, `ModelSpec`, `AuditPolicy`, and `ModelManifest` dataclasses.

- [ ] **Step 1: Write the failing schema tests**

```python
class AuditPolicyTests(unittest.TestCase):
    def test_canonical_policy_has_exact_literal_families_and_non_convertible_verdicts(self):
        policy = load_audit_policy(POLICY_PATH)
        self.assertEqual(tuple(policy.families), ("forest", "rain", "ocean", "fireplace", "river", "wind"))
        self.assertEqual(policy.verdicts, ("PASS", "FAIL", "ABSTAIN", "UNVERIFIED"))
        self.assertFalse(policy.ai_may_set_human_pass)

    def test_manifest_requires_exact_revision_safe_files_and_no_pickle_weights(self):
        manifest = load_model_manifest(MODEL_MANIFEST_PATH)
        clap = manifest.models["semantic-clap"]
        self.assertEqual(clap.revision, "365dea6ef167def6676140ed93bbc43f84dabb28")
        self.assertIn("model.safetensors", clap.allowed_files)
        self.assertNotIn("pytorch_model.bin", clap.allowed_files)
```

- [ ] **Step 2: Run the tests and verify RED**

Run: `python3 -m unittest scripts.audio_audit.tests.test_audit_tool.AuditPolicyTests -v`

Expected: `ModuleNotFoundError: No module named 'scripts.audio_audit'`.

- [ ] **Step 3: Implement immutable models and aggregate validation**

```python
@dataclass(frozen=True)
class ModelSpec:
    id: str
    provider: str
    repository: str
    revision: str
    license_id: str
    allowed_files: tuple[str, ...]
    denied_files: tuple[str, ...]
    status: str

@dataclass(frozen=True)
class AuditPolicy:
    schema_version: int
    families: dict[str, FamilyPolicy]
    verdicts: tuple[str, ...]
    ai_may_set_human_pass: bool
    semantic_window_seconds: float
    semantic_hop_seconds: float
```

Validation must aggregate all errors, reject extra families/verdicts, require multiple positive prompts and hard negatives per family, require source/base/delivery audit scopes, require `ABSTAIN`, and prohibit fields that authorize human or release status.

- [ ] **Step 4: Run the focused tests GREEN**

Run: `python3 -m unittest scripts.audio_audit.tests.test_audit_tool.AuditPolicyTests -v`

Expected: all `AuditPolicyTests` pass.

- [ ] **Step 5: Commit the schema boundary**

```bash
git add config/audio/hyperfocus-semantic-audit-v2.json config/audio/hyperfocus-ai-models-v2.json scripts/audio_audit
git commit -m "test(audio): define strict semantic audit policy"
```

### Task 2: Hash-Locked Audit-Only Environments

**Files:**

- Create: `scripts/audio_audit/requirements-clap.in`
- Create: `scripts/audio_audit/requirements-yamnet.in`
- Create: `scripts/audio_audit/requirements-clap.txt`
- Create: `scripts/audio_audit/requirements-yamnet.txt`
- Create: `scripts/audio_audit/environment.py`
- Modify: `scripts/audio_audit/tests/test_audit_tool.py`

**Interfaces:**

- Consumes: model manifest from Task 1.
- Produces: `validate_environment(kind: str, executable: Path, expected: EnvironmentSpec) -> dict`.

- [ ] **Step 1: Add RED tests for Python/runtime/dependency identity**

```python
def test_environment_rejects_system_python_and_unpinned_dependencies(self):
    with self.assertRaisesRegex(AuditError, "Python 3.12 audit environment required"):
        validate_environment("clap", Path(sys.executable), EXPECTED_CLAP_ENV)

def test_requirement_inputs_pin_every_direct_dependency(self):
    rows = parse_direct_requirements(CLAP_INPUT)
    self.assertEqual(rows["torch"], "2.13.0")
    self.assertEqual(rows["transformers"], "5.15.1")
    self.assertEqual(rows["safetensors"], "0.8.0")
```

- [ ] **Step 2: Verify RED**

Run: `python3 -m unittest scripts.audio_audit.tests.test_audit_tool.EnvironmentTests -v`

Expected: imports or requirement files are missing.

- [ ] **Step 3: Add exact direct dependency inputs**

`requirements-clap.in`:

```text
torch==2.13.0
transformers==5.15.1
safetensors==0.8.0
huggingface-hub==1.28.0
numpy==2.5.2
scipy==1.18.1
soundfile==0.14.0
librosa==1.0.0
```

`requirements-yamnet.in`:

```text
tensorflow==2.21.0
tensorflow-hub==0.16.1
tf-keras==2.21.0
numpy==2.5.2
scipy==1.18.1
soundfile==0.14.0
```

- [ ] **Step 4: Compile immutable wheel-only locks**

Run:

```bash
uv pip compile scripts/audio_audit/requirements-clap.in --python 3.12 --only-binary=:all: --generate-hashes -o scripts/audio_audit/requirements-clap.txt
uv pip compile scripts/audio_audit/requirements-yamnet.in --python-version 3.12 --python-platform aarch64-apple-darwin --only-binary=:all: --generate-hashes -o scripts/audio_audit/requirements-yamnet.txt
```

Expected: both locks contain only exact versions and SHA-256 hashes; resolution failure is `STOP_DEPENDENCY_UNAVAILABLE`, not permission to loosen a version.

- [ ] **Step 5: Create private Python 3.12 environments and install from locks**

Run:

```bash
uv python install 3.12
uv venv --python 3.12 /Users/yehor/Projects/ZenFlow/private-evidence/audio-ai-audit/envs/clap
uv venv --python 3.12 /Users/yehor/Projects/ZenFlow/private-evidence/audio-ai-audit/envs/yamnet
uv pip install --python /Users/yehor/Projects/ZenFlow/private-evidence/audio-ai-audit/envs/clap/bin/python --require-hashes --only-binary=:all: -r scripts/audio_audit/requirements-clap.txt
uv pip install --python /Users/yehor/Projects/ZenFlow/private-evidence/audio-ai-audit/envs/yamnet/bin/python --require-hashes --only-binary=:all: -r scripts/audio_audit/requirements-yamnet.txt
```

Expected: environments exist only under private evidence; no repository or system Python mutation.

- [ ] **Step 6: Record and validate dependency receipts**

Run each private Python with `importlib.metadata` and write canonical package/version rows plus executable SHA-256 into a private `environment-receipt.json`. The validator must reject extra direct ML packages and any Python other than 3.12.x.

- [ ] **Step 7: Run GREEN and commit only tracked locks/code**

Run: `python3 -m unittest scripts.audio_audit.tests.test_audit_tool.EnvironmentTests -v`

```bash
git add scripts/audio_audit
git commit -m "build(audio): lock isolated audit environments"
```

### Task 3: Explicit Safe Model Acquisition

**Files:**

- Create: `scripts/audio_audit/acquire_models.py`
- Create: `scripts/audio_audit/model_cache.py`
- Modify: `scripts/audio_audit/tests/test_audit_tool.py`
- Modify: `config/audio/hyperfocus-ai-models-v2.json` only to bind observed immutable archive/file hashes.

**Interfaces:**

- Consumes: `ModelManifest` and explicit private cache root.
- Produces: `acquire_models(manifest, cache_root, http_client) -> ModelAcquisitionReceipt`.
- Produces: `verify_model_cache(manifest, cache_root) -> dict[str, str]`.

- [ ] **Step 1: Add RED tests for allowlists, redirects, hashes, and no auto-download**

```python
def test_clap_acquisition_allows_only_safetensors_and_declared_metadata(self):
    receipt = acquire_models(CLAP_MANIFEST, cache_root, FakeHubClient(CLAP_FILES))
    self.assertIn("model.safetensors", receipt.files)
    self.assertNotIn("pytorch_model.bin", receipt.files)

def test_cache_rejects_tamper_symlink_and_revision_drift(self):
    (cache_root / "model.safetensors").write_bytes(b"changed")
    with self.assertRaisesRegex(AuditError, "model hash mismatch"):
        verify_model_cache(CLAP_MANIFEST, cache_root)
```

- [ ] **Step 2: Verify RED**

Run: `python3 -m unittest scripts.audio_audit.tests.test_audit_tool.ModelAcquisitionTests -v`

Expected: acquisition module is missing.

- [ ] **Step 3: Implement bounded acquisition**

The CLAP request is pinned to repository `laion/clap-htsat-fused`, revision `365dea6ef167def6676140ed93bbc43f84dabb28`, and only:

```text
config.json
merges.txt
model.safetensors
preprocessor_config.json
special_tokens_map.json
tokenizer.json
tokenizer_config.json
vocab.json
```

The YAMNet request is pinned to `https://tfhub.dev/google/yamnet/1?tf-hub-format=compressed`. It downloads once into a new private temporary directory, validates a bounded tar inventory without absolute paths, `..`, links, devices, duplicate names, or oversized members, hashes the archive and extracted files, and atomically promotes the cache. The first successful discovery updates the tracked manifest from `UNVERIFIED_DISCOVERY` to `HASH_PINNED_NOT_ADMITTED`; it does not admit the model.

- [ ] **Step 4: Run acquisition tests GREEN**

Run: `python3 -m unittest scripts.audio_audit.tests.test_audit_tool.ModelAcquisitionTests -v`

- [ ] **Step 5: Run the explicit model acquisition**

Run:

```bash
/Users/yehor/Projects/ZenFlow/private-evidence/audio-ai-audit/envs/clap/bin/python -m scripts.audio_audit.acquire_models --manifest config/audio/hyperfocus-ai-models-v2.json --cache /Users/yehor/Projects/ZenFlow/private-evidence/audio-ai-audit/models --receipt /Users/yehor/Projects/ZenFlow/private-evidence/audio-ai-audit/model-acquisition-receipt.json
```

Expected: exact file hashes and model bytes are private; no `.bin` file is downloaded or loaded; network is not used again during inference.

- [ ] **Step 6: Run narrow security scans before any weight is loaded**

Run:

```bash
/Users/yehor/.codex/bin/codex-security-suite.sh --path /Users/yehor/Projects/ZenFlow/worktrees/codex-audio-cc0-rights-pack-20260825/scripts/audio_audit --profile quick --strict
/Users/yehor/.codex/bin/codex-security-suite.sh --path /Users/yehor/Projects/ZenFlow/private-evidence/audio-ai-audit/models --profile ai --strict
```

Then scan the dependency locks with the repository-supported dependency/security checks. Any unavailable authorization is `UNVERIFIED` and blocks model admission.

- [ ] **Step 7: Commit code and the hash-only manifest update**

```bash
git add scripts/audio_audit config/audio/hyperfocus-ai-models-v2.json
git commit -m "feat(audio): acquire hash-pinned audit models"
```

### Task 4: Canonical Audio Preprocessing And Window Evidence

**Files:**

- Create: `scripts/audio_audit/preprocess.py`
- Create: `scripts/audio_audit/audio_io.py`
- Modify: `scripts/audio_audit/tests/test_audit_tool.py`

**Interfaces:**

- Produces: `decode_audio_view(path: Path) -> AudioView`.
- Produces: `make_audit_windows(view: AudioView, policy: AuditPolicy) -> tuple[AuditWindow, ...]`.
- Produces: `write_analysis_views(input_path: Path, output_root: Path, policy: AuditPolicy) -> PreprocessReceipt` in a new private evidence root only.

- [ ] **Step 1: Add RED tests for decode, normalization, windows, and tamper binding**

```python
def test_windows_cover_start_end_and_overlap_without_changing_product_bytes(self):
    original = fixture_path.read_bytes()
    windows = make_audit_windows(decode_audio_view(fixture_path), POLICY)
    self.assertEqual([(w.start_frame, w.end_frame) for w in windows], EXPECTED_WINDOWS)
    self.assertEqual(fixture_path.read_bytes(), original)

def test_loudness_normalized_view_is_analysis_only_and_hash_bound(self):
    receipt = write_analysis_views(input_path, output_root, POLICY)
    self.assertEqual(receipt.input_sha256, file_sha256(input_path))
    self.assertNotEqual(receipt.normalized_sha256, receipt.input_sha256)
```

- [ ] **Step 2: Verify RED**

Run: `/Users/yehor/Projects/ZenFlow/private-evidence/audio-ai-audit/envs/clap/bin/python -m unittest scripts.audio_audit.tests.test_audit_tool.PreprocessTests -v`

- [ ] **Step 3: Implement deterministic preprocessing**

```python
@dataclass(frozen=True)
class AuditWindow:
    id: str
    start_frame: int
    end_frame: int
    sample_rate: int
    mono: np.ndarray
    sha256: str

def make_audit_windows(view: AudioView, policy: AuditPolicy) -> tuple[AuditWindow, ...]:
    window_frames = round(policy.semantic_window_seconds * view.sample_rate)
    hop_frames = round(policy.semantic_hop_seconds * view.sample_rate)
    final_start = max(0, len(view.mono) - window_frames)
    starts = list(range(0, final_start + 1, hop_frames)) or [0]
    if starts[-1] != final_start:
        starts.append(final_start)
    rows = []
    for index, start in enumerate(starts):
        end = min(len(view.mono), start + window_frames)
        samples = np.ascontiguousarray(view.mono[start:end], dtype="<f4")
        rows.append(AuditWindow(
            id=f"w{index:03d}",
            start_frame=start,
            end_frame=end,
            sample_rate=view.sample_rate,
            mono=samples,
            sha256=hashlib.sha256(samples.tobytes()).hexdigest(),
        ))
    return tuple(rows)
```

Decode with SoundFile in the private 3.12 environment. Resample with a fixed `scipy.signal.resample_poly` ratio, downmix by arithmetic channel mean only for model input, normalize an analysis copy to the frozen RMS, and preserve original stereo bytes. Reject unsupported codec, excess duration/bytes/channels, NaN, infinity, silence, symlinks, hardlinks, and changed input hashes.

- [ ] **Step 4: Run GREEN and commit**

Run: `/Users/yehor/Projects/ZenFlow/private-evidence/audio-ai-audit/envs/clap/bin/python -m unittest scripts.audio_audit.tests.test_audit_tool.PreprocessTests -v`

```bash
git add scripts/audio_audit
git commit -m "feat(audio): add hash-bound audit preprocessing"
```

### Task 5: Isolated CLAP And YAMNet Runners

**Files:**

- Create: `scripts/audio_audit/backends/__init__.py`
- Create: `scripts/audio_audit/backends/clap_runner.py`
- Create: `scripts/audio_audit/backends/yamnet_runner.py`
- Create: `scripts/audio_audit/backend_protocol.py`
- Modify: `scripts/audio_audit/tests/test_audit_tool.py`

**Interfaces:**

- Consumes strict JSON request on stdin; produces one strict JSON response on stdout.
- Produces: `run_backend(executable: Path, module: str, request: BackendRequest) -> BackendResponse`.

- [ ] **Step 1: Add RED protocol tests**

```python
def test_backend_protocol_rejects_duplicate_keys_trailing_output_and_unknown_fields(self):
    with self.assertRaisesRegex(AuditError, "invalid backend response"):
        parse_backend_response('{"status":"PASS","status":"FAIL"}\nnoise')

def test_backend_runner_sets_offline_cpu_and_private_cache(self):
    command, env = build_backend_command(CLAP_ENV, request)
    self.assertEqual(env["HF_HUB_OFFLINE"], "1")
    self.assertEqual(env["TRANSFORMERS_OFFLINE"], "1")
    self.assertEqual(env["CUDA_VISIBLE_DEVICES"], "")
```

- [ ] **Step 2: Verify RED**

Run: `/Users/yehor/Projects/ZenFlow/private-evidence/audio-ai-audit/envs/clap/bin/python -m unittest scripts.audio_audit.tests.test_audit_tool.BackendProtocolTests -v`

- [ ] **Step 3: Implement CLAP semantic runner**

Load `ClapModel` and `ClapProcessor` from the exact private revision directory with `local_files_only=True`, `use_safetensors=True`, CPU, eval mode, gradients disabled, and deterministic algorithms. Return raw normalized audio/text embeddings, cosine similarities for every frozen prompt, target/sibling/negative margins, and prompt variance for every window.

- [ ] **Step 4: Implement YAMNet temporal runner**

Load only the verified extracted SavedModel from the private cache. Return every 0.96-second frame score, 0.48-second hop timestamp, class ID/name, max score, high percentile, duration above the frozen threshold, and first/last occurrence for declared prohibited events. Never reduce the only report to a clip mean.

- [ ] **Step 5: Run offline smoke on synthetic test-only signals**

Use a sine/noise fixture solely to validate protocol shape and determinism; it is not semantic evidence. Run each backend twice and require exact IDs plus numeric values within `1e-6` on the same CPU environment.

- [ ] **Step 6: Run GREEN and commit**

Run: `/Users/yehor/Projects/ZenFlow/private-evidence/audio-ai-audit/envs/clap/bin/python -m unittest scripts.audio_audit.tests.test_audit_tool.BackendProtocolTests -v`

```bash
git add scripts/audio_audit
git commit -m "feat(audio): add isolated semantic and event runners"
```

### Task 6: Fail-Closed Orchestrator And Independent Verifier

**Files:**

- Create: `scripts/audio_audit/audit.py`
- Create: `scripts/audio_audit/verify.py`
- Create: `scripts/audio_audit/evidence.py`
- Modify: `scripts/audio_audit/tests/test_audit_tool.py`

**Interfaces:**

- Produces: `audit_package(package_root: Path, policy: AuditPolicy, model_manifest: ModelManifest, evidence_root: Path, backends: BackendExecutables) -> AuditReport`.
- Produces: `verify_audit_report(report_root: Path, policy: AuditPolicy, model_manifest: ModelManifest) -> dict`.

- [ ] **Step 1: Add RED verdict/non-conversion tests**

```python
def test_any_fail_or_abstain_blocks_and_pass_never_sets_human_status(self):
    report = combine_results(semantic=PASS_RESULT, events=ABSTAIN_RESULT, provenance=PASS_RESULT)
    self.assertEqual(report.verdict, "ABSTAIN")
    self.assertNotIn("humanSemanticPass", report.to_dict())
    self.assertNotIn("promotionAllowed", report.to_dict())

def test_one_critical_event_cannot_be_hidden_by_aggregate_score(self):
    report = combine_results(semantic=HIGH_TARGET_SCORE, events=ONE_SPEECH_FRAME, provenance=PASS_RESULT)
    self.assertEqual(report.verdict, "FAIL")
```

- [ ] **Step 2: Verify RED**

Run: `/Users/yehor/Projects/ZenFlow/private-evidence/audio-ai-audit/envs/clap/bin/python -m unittest scripts.audio_audit.tests.test_audit_tool.OrchestratorTests -v`

- [ ] **Step 3: Implement strict combination and evidence**

Write canonical JSON with model/environment/policy/input/window/output hashes, every raw backend evidence row, separate semantic/event/provenance statuses, reasons, calibration state, coverage, and final AI verdict. Before calibration and hidden-holdout admission, any model-based candidate verdict is at most `ABSTAIN` with status `TRIAL_ONLY_NOT_ADMITTED`.

- [ ] **Step 4: Implement independent hash-first verification**

The verifier reads no model and recomputes inventory/hashes, strict JSON, model/environment identity, non-conversion fields, verdict logic, per-window completeness, and `SHA256SUMS`. It rejects a report before semantic parsing when any listed hash differs.

- [ ] **Step 5: Run GREEN and full unit suite**

Run: `/Users/yehor/Projects/ZenFlow/private-evidence/audio-ai-audit/envs/clap/bin/python -m unittest discover -s scripts/audio_audit/tests -v`

- [ ] **Step 6: Commit**

```bash
git add scripts/audio_audit
git commit -m "feat(audio): add fail-closed AI audit evidence"
```

### Task 7: Current Artifact Visible Regression And Trial Report

**Files:**

- Create: `config/audio/hyperfocus-visible-regression-v1.json`
- Create: `scripts/audio_audit/regression.py`
- Create: `docs/audio/hyperfocus-ai-audit-operator.md`
- Modify: `scripts/audio_audit/tests/test_audit_tool.py`

**Interfaces:**

- Produces: `load_visible_regression(path: str | Path) -> VisibleRegression`.

**Private inputs/outputs:**

- Input: `/Users/yehor/Projects/ZenFlow/private-evidence/cc0-audio/e74a6b93-run-32816404725/package`
- Output: `/Users/yehor/Projects/ZenFlow/private-evidence/audio-ai-audit/visible-regression-e74a6b93`

- [ ] **Step 1: Add RED fixture-binding tests**

```python
def test_visible_regression_is_bound_to_rejected_artifact_and_not_a_holdout(self):
    fixture = load_visible_regression(VISIBLE_REGRESSION_PATH)
    self.assertEqual(fixture.archive_sha256, "48931c2f8723e246112303604dd5a070107733850c2ea9d53e23b5c8a66eeb6b")
    self.assertEqual(fixture.semantic_positive_ids, ("fireplace:deep",))
    self.assertEqual(len(fixture.semantic_negative_ids), 17)
    self.assertEqual(fixture.evidence_class, "VISIBLE_REGRESSION")
```

- [ ] **Step 2: Verify RED, implement loader, then GREEN**

Run: `/Users/yehor/Projects/ZenFlow/private-evidence/audio-ai-audit/envs/clap/bin/python -m unittest scripts.audio_audit.tests.test_audit_tool.VisibleRegressionTests -v`

- [ ] **Step 3: Run the auditor twice on the exact artifact**

Run:

```bash
/Users/yehor/Projects/ZenFlow/private-evidence/audio-ai-audit/envs/clap/bin/python -m scripts.audio_audit.audit --package /Users/yehor/Projects/ZenFlow/private-evidence/cc0-audio/e74a6b93-run-32816404725/package --policy config/audio/hyperfocus-semantic-audit-v2.json --models config/audio/hyperfocus-ai-models-v2.json --visible-regression config/audio/hyperfocus-visible-regression-v1.json --output /Users/yehor/Projects/ZenFlow/private-evidence/audio-ai-audit/visible-regression-e74a6b93/run-1
/Users/yehor/Projects/ZenFlow/private-evidence/audio-ai-audit/envs/clap/bin/python -m scripts.audio_audit.audit --package /Users/yehor/Projects/ZenFlow/private-evidence/cc0-audio/e74a6b93-run-32816404725/package --policy config/audio/hyperfocus-semantic-audit-v2.json --models config/audio/hyperfocus-ai-models-v2.json --visible-regression config/audio/hyperfocus-visible-regression-v1.json --output /Users/yehor/Projects/ZenFlow/private-evidence/audio-ai-audit/visible-regression-e74a6b93/run-2
```

Both invocations run with the private CLAP/YAMNet environments and network disabled. Preserve both reports and compare canonical numeric rows. Do not tune prompts or thresholds from these results.

- [ ] **Step 4: Classify the bounded result honestly**

- Expected overall artifact result: `FAIL` from v2 provenance/recipe rules.
- Expected visible semantic labels: one positive, 17 negative.
- If model outputs do not separate these labels, record exact false accepts/false rejects and keep the auditor `TRIAL_ONLY_NOT_ADMITTED`.
- Even a perfect visible result remains `UNVERIFIED_GENERALIZATION` because no owner-controlled hidden holdout exists.

- [ ] **Step 5: Verify evidence and commit only tracked fixture/docs**

Run:

```bash
/Users/yehor/Projects/ZenFlow/private-evidence/audio-ai-audit/envs/clap/bin/python -m scripts.audio_audit.verify --report /Users/yehor/Projects/ZenFlow/private-evidence/audio-ai-audit/visible-regression-e74a6b93/run-1 --policy config/audio/hyperfocus-semantic-audit-v2.json --models config/audio/hyperfocus-ai-models-v2.json
/Users/yehor/Projects/ZenFlow/private-evidence/audio-ai-audit/envs/clap/bin/python -m scripts.audio_audit.verify --report /Users/yehor/Projects/ZenFlow/private-evidence/audio-ai-audit/visible-regression-e74a6b93/run-2 --policy config/audio/hyperfocus-semantic-audit-v2.json --models config/audio/hyperfocus-ai-models-v2.json
```

```bash
git add config/audio/hyperfocus-visible-regression-v1.json docs/audio/hyperfocus-ai-audit-operator.md scripts/audio_audit
git commit -m "test(audio): bind visible semantic regression"
```

### Task 8: Workflow, Production Exclusion, And Completion Gate

**Files:**

- Create: `.github/workflows/hyperfocus-ai-audit.yml`
- Modify: `scripts/audio_audit/tests/test_audit_tool.py`
- Modify: `scripts/check-app-audio-assets.cjs` only if a RED test proves a new audit path needs explicit exclusion without weakening existing product scans.
- Modify: `docs/audio/hyperfocus-ai-audit-operator.md`

- [ ] **Step 1: Add RED workflow and bundle-exclusion tests**

Require read-only permissions, no secrets, no push, no inference-time network, pinned Actions, explicit model-cache artifact identity, time/resource ceilings, private evidence separation, and no model/audit bytes in `dist`, native assets, or Tauri resources.

- [ ] **Step 2: Implement the smallest review-only workflow**

The workflow runs unit tests without models on pull requests. Model integration runs only by explicit `workflow_dispatch` with a pre-populated, hash-verified model cache; it never publishes model weights or private holdout data.

- [ ] **Step 3: Run all focused and governance checks**

Run:

```bash
/Users/yehor/Projects/ZenFlow/private-evidence/audio-ai-audit/envs/clap/bin/python -m unittest discover -s scripts/audio_audit/tests -v
/Users/yehor/Projects/ZenFlow/private-evidence/audio-ai-audit/envs/clap/bin/python -m unittest discover -s scripts/audio_review/tests -v
npm run check:no-ai-templates
npm run check:best-practices
npm run check:production-data-integrity:diff
git diff --check
```

- [ ] **Step 4: Review diff/status and commit**

```bash
git add .github/workflows/hyperfocus-ai-audit.yml scripts/audio_audit docs/audio/hyperfocus-ai-audit-operator.md
git commit -m "ci(audio): verify isolated semantic audit"
```

## Plan-Specific Done Boundary

- The auditor software, unit tests, model/dependency manifests, explicit acquisition, two isolated model channels, trial visible regression, evidence verifier, and production exclusion are implemented and current.
- `PASS` may be claimed only for deterministic code/tests that actually ran.
- Model admission remains `UNVERIFIED` until the owner-controlled hidden holdout and residual-risk approval exist.
- No source candidate, mastered audio, runtime asset, deployment, or release is produced by this plan; that work is in `2026-08-25-hyperfocus-source-preserving-v2-review-pack.md`.
