# CC0 Kimi-role audio review generator

This tool produces a separate 26-file review package. It never writes to ZenFlow runtime audio paths.

## Requirements

- Node.js 22+
- FFmpeg and ffprobe with `libmp3lame`
- network access to the exact official BigSoundBank MP3 URLs recorded in the generator

## Focused tests

```bash
node --test \
  scripts/audio-review/__tests__/generate-cc0-kimi-review-pack.test.mjs \
  scripts/audio-review/__tests__/cc0-kimi-audio-review-workflow.test.mjs
```

## Full build

```bash
node scripts/audio-review/generate-cc0-kimi-review-pack.mjs \
  --output output/cc0-kimi-audio-review \
  --source-cache output/cc0-kimi-source-cache
```

The output includes 26 MP3 files, decoded QC, source evidence, rights ledger, exact SHA-256 sums, and a human listening checklist. The GitHub workflow additionally creates spectrograms and packages the generator, tests, and specifications with the review output.

`PASS` means the objective engineering contract passed. It does not mean subjective listening, physical-device playback, formal legal review, or release authorization passed.
