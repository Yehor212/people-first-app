# CC0 Kimi Audio Review Package

## Purpose

This tool reconstructs the 26 quarantined Kimi audio roles without using the quarantined binaries. It generates a separate review artifact and cannot modify ZenFlow runtime audio paths.

## Local commands

```bash
python -m pip install --only-binary=:all: -r scripts/audio_review/requirements.txt
python -m unittest discover -s scripts/audio_review/tests -v
python -m scripts.audio_review.build \
  --spec config/audio/cc0-kimi-audio-review-spec.json \
  --output output/cc0-kimi-audio-review \
  --cache output/cc0-kimi-audio-cache
python -m scripts.audio_review.verify \
  --spec config/audio/cc0-kimi-audio-review-spec.json \
  --package output/cc0-kimi-audio-review
```

`ffmpeg` and `ffprobe` must be installed. Network retrieval is HTTPS-only. `--offline` permits only a complete existing cache and fails on any cache miss.

## Rights gate

The builder resolves each declared BigSoundBank sound number through the provider's official sitemap. It verifies the source page number and CC0 marker, then verifies the canonical official license page contains CC0 1.0 plus distribution, adaptation, and commercial-use language. The selected audio URL must be on the same provider and bound to the same sound number. Page, license, and audio bytes are SHA-256-bound in `rights-ledger.json`.

The source numbers are a reviewed shortlist, but source suitability is not inferred from the title. Human listening remains required. This evidence is not legal advice.

## Objective QC

The build fails unless all files decode as 48 kHz stereo, remain below peak/DC/clipping limits, and long files meet loop-boundary limits. Every Hyperfocus family must progress by at least three points on the decoded intensity score from soft to deep and deep to intense.

The verifier checks `SHA256SUMS` before MP3 signatures, then checks provenance, rights coverage, QC, and human-review bindings.

## Review and promotion

`human-review.json` starts with every decision at `PENDING` and all five runtime targets at `UNVERIFIED`. Long files require a ten-minute loop listen on headphones and a built-in speaker. A separate explicitly approved change is required to copy accepted files into runtime assets, update manifests and notices, rebuild Web/PWA/Android/iOS/Desktop artifacts, and verify physical playback.

## Rollback

The generator writes a sibling temporary directory. It replaces an existing review directory only after independent verification and restores the prior directory if atomic promotion fails. Since this change does not touch runtime assets, repository rollback is the ordinary revert of the tooling branch.
