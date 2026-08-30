# Hyperfocus AI Semantic Audit Operator Contract

## Current Status

- Auditor software status: `TRIAL_ONLY_NOT_ADMITTED`.
- Current artifact audit verdict: `FAIL`.
- Visible semantic regression status: `FAIL_VISIBLE_REGRESSION`.
- Human authority: the owner reported `fireplace:deep` as the only correct file and rejected the other 17; the durable per-file owner review receipt remains pending.
- Runtime, promotion, integration, release, store, and publication status: `UNVERIFIED` / not authorized.

## Exact Model And Runtime Identity

- Semantic model: `laion/clap-htsat-fused@365dea6ef167def6676140ed93bbc43f84dabb28`, Apache-2.0, `model.safetensors` SHA-256 `3f648de6d030e17494be455d323b8d191233fbae0c7ce0ba745fd21a926a63a6`.
- Temporal event model: Google YAMNet v1 archive SHA-256 `b80da2a1a56926fb0767205051a200dd7b3beaf3ea1ea126c42a53943996e5e0`, Apache-2.0.
- Canonical inference: CPU, Python 3.12.13, two isolated hash-locked environments, offline model loading.
- Model bytes and environment receipts stay under ignored `private-evidence/audio-ai-audit/`; they are never committed or bundled.

## Security Evidence

The first source-code scan found 14 path-traversal flows in caller-controlled acquisition roots. The CLI boundary was redesigned to derive fixed repository/private paths and accept no caller-controlled write target. The final source scan reports Snyk Code, Gitleaks, TruffleHog, and Trivy status `0`.

The first model scan was `UNVERIFIED` because ModelScan lacked its TensorFlow scanner dependency and scanned zero files. After repairing the scanner runtime, ModelScan 0.8.8 inspected YAMNet `saved_model.pb` and reported one scanned file, zero issues, and zero errors. CLAP was acquired only as safetensors; safe format parsing found 477 tensors and metadata `format=pt`. These checks reduce supply-chain risk but do not prove model correctness.

## Visible Regression Result

Fixture:

- source head `e74a6b93b54afec99737ee54252dab92c34ba56c`;
- workflow run `32816404725`;
- artifact `9551607003`;
- archive SHA-256 `48931c2f8723e246112303604dd5a070107733850c2ea9d53e23b5c8a66eeb6b`;
- owner-positive ID: `fireplace:deep`;
- owner-negative IDs: the other 17 Hyperfocus variants.

The diagnostic classification `targetMargin > 0` produced:

| Metric                                 | Count |
| -------------------------------------- | ----: |
| True positive                          |     0 |
| False positive / critical false accept |     9 |
| True negative                          |     8 |
| False negative                         |     1 |

Critical false accepts:

- `forest:soft`;
- `ocean:deep`;
- `ocean:intense`;
- `rain:deep`;
- `rain:intense`;
- `rain:soft`;
- `river:deep`;
- `river:intense`;
- `river:soft`.

False reject:

- `fireplace:deep`.

Therefore neither the current CLAP prompt bank nor an uncalibrated zero-shot margin may be used as a source-selection or release threshold. YAMNet output is also diagnostic only until family-aware event thresholds and a hidden holdout are calibrated.

## Evidence Locations

Private, hash-bound artifacts:

- `private-evidence/audio-ai-audit/model-acquisition-receipt.json`;
- `private-evidence/audio-ai-audit/model-security-receipt.json`;
- `private-evidence/audio-ai-audit/environment-receipt.json`;
- `private-evidence/audio-ai-audit/visible-regression-e74a6b93/run-current/`;
- `private-evidence/audio-ai-audit/visible-regression-e74a6b93/evaluation-current/`.

The independent audit verifier checked 18 assets and 37 evidence files. The visible-regression evaluation has its own `SHA256SUMS` and does not mutate the sealed audit report.

## Operator Commands

Acquire models only when the canonical cache and receipt do not already exist:

```bash
/Users/yehor/Projects/ZenFlow/private-evidence/audio-ai-audit/envs/clap/bin/python -m scripts.audio_audit.acquire_models
```

Run the fixed visible regression only when `run-current` does not already exist:

```bash
/Users/yehor/Projects/ZenFlow/private-evidence/audio-ai-audit/envs/clap/bin/python -m scripts.audio_audit.audit
/Users/yehor/Projects/ZenFlow/private-evidence/audio-ai-audit/envs/clap/bin/python -m scripts.audio_audit.verify
/Users/yehor/Projects/ZenFlow/private-evidence/audio-ai-audit/envs/clap/bin/python -m scripts.audio_audit.regression
```

These CLIs intentionally accept no path arguments. Generic candidate-package auditing is invoked as a library call only after the candidate builder validates private roots and exact hashes.

## Decision Boundary For New Sounds

The new blind source bundle may include sealed CLAP/YAMNet diagnostics, but:

- AI does not rank files in the listening folder;
- AI does not choose `A`, `B`, `C`, or `NONE`;
- zero-shot scores cannot create semantic `PASS`;
- any model contradiction remains visible;
- an owner-controlled hidden holdout is still required before auditor admission;
- only exact owner decisions may advance a source or window.

The immediate safe use of this auditor is to reveal contamination and model disagreement before human review, not to replace human hearing.
