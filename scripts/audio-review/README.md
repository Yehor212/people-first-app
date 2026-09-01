# First-party audio review generator

This tool creates an isolated 26-file reconstruction pack. It does not write to any ZenFlow runtime audio path.

## Requirements

- Node.js 22+
- `ffmpeg`
- `ffprobe`

## Focused test

```bash
node --expose-gc --test scripts/audio-review/__tests__/generate-first-party-review-pack.test.mjs
```

The integration test uses reduced durations but still encodes and decodes all 26 MP3 files, verifies exact inventory and SHA-256 evidence, checks the rights ledger, and enforces Hyperfocus intensity progression.

## Full review build

```bash
node --expose-gc scripts/audio-review/generate-first-party-review-pack.mjs \
  --output output/first-party-audio-review
```

Generated output includes:

- `audio/` — 26 review MP3 files;
- `evidence/provenance.json`;
- `evidence/rights-ledger.json`;
- `evidence/decoded-qc.json`;
- `evidence/verification.json`;
- `SHA256SUMS`;
- `HUMAN_LISTENING_CHECKLIST.md`.

## Release boundary

`PASS` in `verification.json` means the generator and objective decoded-audio contract passed. It does not mean the sounds are pleasant, legally approved, accepted on a physical device, or authorized for release. All generated assets remain `REVIEW_ONLY` until the owner accepts exact hashes and a separate change promotes them into runtime.