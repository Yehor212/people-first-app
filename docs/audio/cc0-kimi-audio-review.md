# CC0 Kimi Audio Review Package

## Purpose

This tool reconstructs the 26 quarantined Kimi audio roles without using the quarantined binaries. It generates a separate review artifact and cannot modify ZenFlow runtime audio paths.

## Local commands

```bash
python -m pip install --only-binary=:all: --require-hashes -r scripts/audio_review/requirements.txt
python -m unittest discover -s scripts/audio_review/tests -v
python -m scripts.audio_review.build \
  --spec config/audio/cc0-kimi-audio-review-spec.json \
  --output output/cc0-kimi-audio-review \
  --cache output/cc0-kimi-audio-cache
python -m scripts.audio_review.verify \
  --spec config/audio/cc0-kimi-audio-review-spec.json \
  --package output/cc0-kimi-audio-review
```

`ffmpeg` and `ffprobe` must be installed. Network retrieval is HTTPS-only and every redirect remains bound to the exact provider host. `--offline` permits only a complete, hash-valid existing cache and fails on any cache miss or integrity mismatch.

## Rights gate

The builder resolves each declared BigSoundBank sound number through the provider's official sitemap. It verifies the source page number, named author, and CC0 marker, then verifies the canonical official license page contains non-negated CC0 1.0 distribution, adaptation, and commercial-use language. The selected audio URL must be on the same provider and bound to the same sound number.

Exact fetched source-page and license-page bytes are stored under `evidence/rights/sNNNN/` with a receipt that binds their SHA-256, byte count, content type, URL, and redirect chain. Raw third-party source audio remains private cache input and is never copied into the review artifact. `rights-ledger.json` uses `RIGHTS_EVIDENCE_CAPTURED_REVIEW_REQUIRED`: the parser records technical evidence only and cannot declare legal clearance, approval, or release readiness.

The source numbers are a reviewed shortlist, but source suitability is not inferred from the title. Human listening remains required. This evidence is not legal advice.

## Objective QC

The build fails unless all files decode as 48 kHz stereo, remain below peak/DC/clipping limits, and long files meet loop-boundary limits. Every Hyperfocus family must progress by at least three points on the decoded intensity score from soft to deep and deep to intense.

The verifier checks a complete, traversal-safe `SHA256SUMS` inventory before MP3 signatures, then checks the 26-hash quarantine denylist, provenance, rights receipts, QC, and human-review bindings. Listed or unlisted symlinks, non-regular members, duplicate paths, and extra files fail closed.

## Build integrity and determinism

NumPy wheels are SHA-256-pinned and GitHub Actions are pinned to immutable commit SHAs. The workflow uploads only `output/cc0-kimi-audio-review`; the source cache is excluded.

`build-environment.json` records Python, NumPy, FFmpeg, ffprobe, libmp3lame, OS release, Git SHA, requirements SHA-256, workflow SHA-256, `SOURCE_DATE_EPOCH`, and the quarantine-denylist SHA-256. MP3 encoding is byte-identical only for the same recorded toolchain and inputs; no cross-version or cross-platform byte identity is claimed.

## Review and promotion

`human-review.json` starts with every decision at `PENDING` and all five runtime targets at `UNVERIFIED`. Long files require a ten-minute loop listen on headphones and a built-in speaker. A separate explicitly approved change is required to copy accepted files into runtime assets, update manifests and notices, rebuild Web/PWA/Android/iOS/Desktop artifacts, and verify physical playback.

## Rollback

The generator writes a sibling temporary directory. It replaces an existing review directory only after independent verification and restores the prior directory if atomic promotion fails. Since this change does not touch runtime assets, repository rollback is the ordinary revert of the tooling branch.
