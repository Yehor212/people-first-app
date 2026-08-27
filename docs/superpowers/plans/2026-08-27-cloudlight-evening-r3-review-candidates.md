# Cloudlight Evening R3 Review Candidates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce three private, blinded, hash-bound 166-second Cloudlight Evening R3 listening candidates from one original deterministic MIDI/automation source rendered in GarageBand, audit them without promoting any runtime asset, and stop for the owner's `01`, `02`, `03`, or `NONE` decision.

**Architecture:** A tracked JSON source owns the original musical form, MIDI events, automation targets, GarageBand patch identities, and the only permitted mix differences. Node tooling validates that source and writes a deterministic Standard MIDI File into an ignored private workspace. GarageBand 10.4.14 renders the same frozen project three times; separate fail-closed tooling validates the WAV/MP3 files, rights and environment receipts, blindness, and optional CLAP/YAMNet diagnostics before opening the local review folder.

**Tech Stack:** Node.js 22 CommonJS, JSON, Standard MIDI File type 1, Vitest 4, GarageBand 10.4.14 build 6648, macOS AudioToolbox `afinfo`/`afconvert`, existing hash-locked CLAP and YAMNet private environments when available.

**Spec:** `docs/superpowers/specs/2026-08-27-cloudlight-evening-r3-design.md`

## Global Constraints

- Execute SOLO in `/Users/yehor/Projects/ZenFlow/worktrees/codex-audio-cc0-rights-pack-20260825` on the locked `codex/audio-cc0-rights-pack-20260825` branch.
- Use `superpowers:executing-plans` for execution unless the owner explicitly requests subagents after reading this plan.
- Local commits are allowed. Push, pull, rebase, merge, PR, deployment, store actions, production publication, and Telegram writes are outside this candidate plan.
- The current production and docs MP3 files remain byte-identical to SHA-256 `d096c668ef6471f855b49c93bc5509ccbd63ac1fb93dc9af96ba3c7c9e65be40`.
- All new MIDI, GarageBand projects, WAVs, MP3s, screenshots, and runtime receipts stay under `output/private/cloudlight-evening-r3` or `/Users/yehor/Projects/ZenFlow/private-evidence/cloudlight-evening-r3`.
- No reference audio, sample, waveform, stem, score, MIDI, transcription, Apple Loop, Live Loop, Drummer region, third-party audio, field recording, voice, or generative-audio output enters the source or project.
- The three candidates share one composition, timing map, instruments, effects, and automation. Only the declared shimmer balance/width or piano balance may differ.
- The linear review duration is exactly 166 seconds. The selected 150-second runtime loop is a later plan after owner choice.
- GarageBand exports 48 kHz, 24-bit stereo WAV without normalization. Review MP3s are 44.1 kHz stereo at 192 kbit/s; 160/192 runtime comparison happens after selection.
- Formal ITU-R BS.1770-5 LUFS, LRA, and dBTP remain `UNVERIFIED` until an approved conformant meter is run. RMS or interpolated peaks are never relabeled as formal measurements.
- CLAP/YAMNet output remains `TRIAL_ONLY_NOT_ADMITTED` and cannot rank candidates, create `AUDIO_FIT`, or replace owner listening.
- No new dependency, Homebrew formula, binary, model, plugin, paid service, remote API, permission, analytics event, production data, or credential is added.
- Fūrin notification, Hyperfocus, auth, Orb, Diary, feedback, haptics, playback UI, caching, and runtime code are not modified.
- Preserve a hash receipt for the inherited v2 prototype before any overlapping edit. The four untracked v2 scripts/tests remain byte-identical and unstaged; Task 1 may replace only their two command lines in `package.json` after hashing the current diff:
  - `scripts/cloudlight-evening-v2-synthesis.cjs`;
  - `scripts/generate-cloudlight-evening-v2-review.cjs`;
  - `scripts/audit-cloudlight-evening-v2-review.cjs`;
  - `scripts/__tests__/cloudlight-evening-v2-synthesis.test.ts`.

## Scope Split

This plan intentionally stops before production integration. Candidate creation and production promotion are separated by an irreversible artistic decision:

1. This plan creates and audits the private `01`/`02`/`03` review candidates.
2. The owner listens and selects `01`, `02`, `03`, or `NONE`.
3. Only a selected exact hash permits a second implementation plan for the 150-second loop, production asset replacement, cache revision, package parity, runtime proof, and final Telegram handoff.

## Resolved Implementation Assumption

The design says both “five to eight piano gestures” inside approximately 15 seconds and “piano events 7-18 seconds apart.” Five independently spaced gestures cannot fit that window. R3 therefore implements seven piano note-on events grouped into two human-perceived clusters centered at 125.2 and 133.1 seconds. The clusters are 7.9 seconds apart, and every dry note ends before 138 seconds so the last 12 seconds remain pad-only. If the owner hears either cluster as a foreground phrase, all candidates fail.

## File Responsibility Map

| File                                                      | Responsibility                                                                                          |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `config/audio/cloudlight-evening-r3-source.json`          | Canonical human-readable composition, automation, patch identity, and candidate mix constraints         |
| `scripts/cloudlight-evening-r3-source.cjs`                | Strict source validation, type-1 MIDI encoding, deterministic source manifest, private-path enforcement |
| `scripts/generate-cloudlight-evening-r3-source.cjs`       | Fixed CLI that writes the private MIDI/source pack                                                      |
| `scripts/cloudlight-evening-r3-session.cjs`               | GarageBand/macOS/license/patch/project/render receipt inspection                                        |
| `scripts/cloudlight-evening-r3-review.cjs`                | WAV/MP3 decode metrics, candidate-difference validation, blinded review-pack creation                   |
| `scripts/generate-cloudlight-evening-r3-review.cjs`       | Fixed CLI for encodes and review manifest                                                               |
| `scripts/audit-cloudlight-evening-r3-review.cjs`          | Fixed CLI that fails closed on rights, inventory, signal, or blindness violations                       |
| `config/audio/cloudlight-evening-r3-ai-audit-v1.json`     | Frozen positive and prohibited diagnostic prompt bank                                                   |
| `scripts/audio_audit/cloudlight.py`                       | Read-only Cloudlight-specific CLAP/YAMNet diagnostic orchestration                                      |
| `scripts/audio_audit/backends/common.py`                  | Adds only the literal `cloudlight-evening` diagnostic family to the backend request allowlist           |
| `scripts/__tests__/cloudlight-evening-r3-source.test.ts`  | Source, MIDI, deterministic output, and private-path tests                                              |
| `scripts/__tests__/cloudlight-evening-r3-session.test.ts` | Environment and receipt tests                                                                           |
| `scripts/__tests__/cloudlight-evening-r3-review.test.ts`  | WAV metrics, encodes, manifest, blindness, and rejection tests                                          |
| `scripts/audio_audit/tests/test_cloudlight_audit.py`      | Prompt, exact-hash, fixed-root, and non-admission tests                                                 |
| `docs/audio/cloudlight-evening-r3-production-runbook.md`  | Exact GarageBand operator sequence and evidence checklist                                               |
| `package.json`                                            | Replaces only the two inherited v2 review commands with R3 source/review/audit commands                 |

---

### Task 1: Freeze The V2 Boundary And Add The R3 Source Contract

**Files:**

- Create: `config/audio/cloudlight-evening-r3-source.json`
- Create: `scripts/__tests__/cloudlight-evening-r3-source.test.ts`
- Modify: `package.json`
- Private evidence: `output/private/cloudlight-evening-r3/preservation/v2-prototype.json`

**Interfaces:**

- Produces: strict JSON source schema version 1.
- Produces: three candidate IDs `candidate-01`, `candidate-02`, and `candidate-03`.
- Preserves: the five inherited v2 dirty paths by byte count and SHA-256 without staging them.

- [ ] **Step 1: Post the protected-change notice and write the fresh test-first token**

Use this exact scope:

```text
AGENT_CHANGE_NOTICE
Risk level: L2
Trigger: protected config, scripts, package.json, and local audio-generation tooling
Current behavior: production Cloudlight is unchanged; inherited v2 prototype uses three different procedural compositions and is not R3
Proposed change: create a private deterministic MIDI/GarageBand review pipeline; no runtime path changes
Alternatives rejected: renaming v2 would preserve the rejected synthesis and violate the one-composition GarageBand contract
Affected files: the exact File Responsibility Map in this plan
Affected domains: tooling, rights provenance, private audio evidence
Affected platforms: Web/PWA/Android/iOS/Desktop do not change in this plan
User-visible impact: three local listening candidates only
Rollback: revert task commits and retain private hashes; production SHA remains unchanged
Verification: RED/GREEN tests, source hashes, GarageBand receipts, decoded audit, owner listening
Verdict: GO
```

The fresh `.preflight-token` records `static-contract`/`red-test` evidence for the source schema and package commands before any protected source edit.

- [ ] **Step 2: Record inherited v2 bytes without changing them**

Hash the five paths and store:

```json
{
  "schemaVersion": 1,
  "classification": "REJECTED_V2_PROTOTYPE_NOT_R3_INPUT",
  "reason": "procedural synthesis, three different compositions, 150-second loop-only form, and no GarageBand render provenance",
  "promotionAllowed": false,
  "files": [
    { "path": "package.json", "evidenceKind": "working-tree-diff-sha256" },
    { "path": "scripts/cloudlight-evening-v2-synthesis.cjs", "evidenceKind": "file-sha256" },
    { "path": "scripts/generate-cloudlight-evening-v2-review.cjs", "evidenceKind": "file-sha256" },
    { "path": "scripts/audit-cloudlight-evening-v2-review.cjs", "evidenceKind": "file-sha256" },
    {
      "path": "scripts/__tests__/cloudlight-evening-v2-synthesis.test.ts",
      "evidenceKind": "file-sha256"
    }
  ]
}
```

The implementation fills `bytes` and `sha256` from the actual current files. It does not move, delete, stage, or rewrite them.

- [ ] **Step 3: Write the failing source-contract test**

The test loads the future JSON and asserts the exact composition boundary:

```ts
const source = JSON.parse(
  readFileSync(join(rootDir, "config/audio/cloudlight-evening-r3-source.json"), "utf8")
);

expect(source).toMatchObject({
  schemaVersion: 1,
  id: "cloudlight-evening-r3",
  tempoBpm: 56,
  ppq: 960,
  reviewDurationSeconds: 166,
  runtimeLoopDurationSeconds: 150,
  sourceAudioInputs: [],
  appleLoopsUsed: false,
});
expect(source.candidates.map((row: { id: string }) => row.id)).toEqual([
  "candidate-01",
  "candidate-02",
  "candidate-03",
]);
expect(source.pianoClusters.flatMap((cluster: { notes: unknown[] }) => cluster.notes)).toHaveLength(
  7
);
const pianoNoteEnds = source.pianoClusters.flatMap(
  (cluster: { start: number; notes: Array<{ offset: number; duration: number }> }) =>
    cluster.notes.map((note) => cluster.start + note.offset + note.duration)
);
expect(Math.max(...pianoNoteEnds)).toBeLessThanOrEqual(138);
expect(source.harmonicFields.at(-1)?.padMidi).toEqual(source.harmonicFields[0].padMidi);
```

Also assert that candidate 02 differs from 01 only at `mix.shimmerDb` and `mix.shimmerPanPercent`, candidate 03 differs only at `mix.pianoDb`, and no source string contains the reference title except `rights.referenceResearch.title`.

- [ ] **Step 4: Run RED**

```bash
npx vitest run scripts/__tests__/cloudlight-evening-r3-source.test.ts
```

Expected: FAIL because `config/audio/cloudlight-evening-r3-source.json` and its loader do not exist.

- [ ] **Step 5: Add the canonical source JSON**

Use this exact musical data:

```json
{
  "schemaVersion": 1,
  "id": "cloudlight-evening-r3",
  "tempoBpm": 56,
  "ppq": 960,
  "reviewDurationSeconds": 166,
  "runtimeLoopDurationSeconds": 150,
  "sourceAudioInputs": [],
  "appleLoopsUsed": false,
  "humanAuthorship": {
    "compositionDirection": "Yehor212 / ZenFlow",
    "implementation": "deterministic first-party MIDI and automation",
    "aiRole": "planning, code assistance, and diagnostic audit only"
  },
  "rights": {
    "referenceResearch": {
      "title": "Cloudbound Evening",
      "use": "high-level mood and functional production grammar only",
      "audioRetained": false,
      "melodyHarmonyArrangementTranscribed": false
    }
  },
  "harmonicFields": [
    { "start": 0, "end": 30, "padMidi": [50, 57, 64, 71], "droneMidi": [45, 52] },
    { "start": 30, "end": 55, "padMidi": [49, 57, 64, 71], "droneMidi": [45, 52] },
    { "start": 55, "end": 80, "padMidi": [43, 50, 57, 64], "droneMidi": [43, 50] },
    { "start": 80, "end": 105, "padMidi": [47, 54, 61, 69], "droneMidi": [47, 54] },
    { "start": 105, "end": 126, "padMidi": [40, 47, 50, 57], "droneMidi": [47, 52] },
    { "start": 126, "end": 138, "padMidi": [45, 52, 59, 66], "droneMidi": [45, 52] },
    { "start": 138, "end": 166, "padMidi": [50, 57, 64, 71], "droneMidi": [45, 52] }
  ],
  "shimmerEvents": [
    { "start": 58.4, "duration": 8.2, "midi": 86, "velocity": 19, "side": "left" },
    { "start": 73.6, "duration": 9.4, "midi": 81, "velocity": 22, "side": "right" },
    { "start": 92.1, "duration": 7.8, "midi": 88, "velocity": 18, "side": "left" },
    { "start": 111.8, "duration": 10.1, "midi": 83, "velocity": 20, "side": "right" }
  ],
  "pianoClusters": [
    {
      "start": 125.2,
      "notes": [
        { "offset": 0, "duration": 3.6, "midi": 69, "velocity": 24 },
        { "offset": 0.42, "duration": 3.1, "midi": 76, "velocity": 20 },
        { "offset": 0.96, "duration": 2.8, "midi": 74, "velocity": 18 }
      ]
    },
    {
      "start": 133.1,
      "notes": [
        { "offset": 0, "duration": 3.4, "midi": 71, "velocity": 22 },
        { "offset": 0.38, "duration": 3, "midi": 78, "velocity": 18 },
        { "offset": 0.84, "duration": 2.5, "midi": 73, "velocity": 19 },
        { "offset": 1.28, "duration": 2.1, "midi": 69, "velocity": 17 }
      ]
    }
  ],
  "linearFade": { "start": 150, "end": 166, "fromCc11": 127, "toCc11": 0 },
  "garageBand": {
    "pianoInstrument": "/Library/Application Support/Logic/Sampler Instruments/01 Acoustic Pianos/Steinway Grand Piano 2.exs",
    "pianoSamples": "/Library/Application Support/Logic/EXS Factory Samples/01 Acoustic Pianos/Steinway Piano_consolidated.caf",
    "padPreset": "/Applications/GarageBand.app/Contents/Resources/Plug-In Settings/Sculpture/02 Modeled Pads/Ambient Pad.pst",
    "dronePreset": "/Applications/GarageBand.app/Contents/Resources/Plug-In Settings/Retro Synth/02 Synth Pads/Dark Swell Pad.pst",
    "shimmerPreset": "/Applications/GarageBand.app/Contents/Resources/Plug-In Settings/Sculpture/02 Modeled Pads/Ambient Overtones.pst",
    "reverbPreset": "/Applications/GarageBand.app/Contents/Resources/Plug-In Settings/ChromaVerb/Synth Reverbs/Clean Ambient Tail .pst",
    "reverb": { "decaySeconds": 7.5, "preDelayMs": 12, "lowCutHz": 120, "dampingHz": 4800 }
  },
  "candidates": [
    {
      "id": "candidate-01",
      "mix": {
        "padDb": -12,
        "droneDb": -21,
        "shimmerDb": -29,
        "shimmerPanPercent": 35,
        "pianoDb": -27
      }
    },
    {
      "id": "candidate-02",
      "mix": {
        "padDb": -12,
        "droneDb": -21,
        "shimmerDb": -27.8,
        "shimmerPanPercent": 45,
        "pianoDb": -27
      }
    },
    {
      "id": "candidate-03",
      "mix": {
        "padDb": -12,
        "droneDb": -21,
        "shimmerDb": -29,
        "shimmerPanPercent": 35,
        "pianoDb": -25.8
      }
    }
  ]
}
```

- [ ] **Step 6: Replace only the inherited package command lines**

Replace:

```json
"audio:generate-cloudlight-v2-review": "node scripts/generate-cloudlight-evening-v2-review.cjs",
"audio:audit-cloudlight-v2-review": "node scripts/audit-cloudlight-evening-v2-review.cjs"
```

with:

```json
"audio:generate-cloudlight-r3-source": "node scripts/generate-cloudlight-evening-r3-source.cjs",
"audio:generate-cloudlight-r3-review": "node scripts/generate-cloudlight-evening-r3-review.cjs",
"audio:audit-cloudlight-r3-review": "node scripts/audit-cloudlight-evening-r3-review.cjs"
```

Do not stage or alter the four untracked v2 scripts/tests.

- [ ] **Step 7: Run GREEN and commit**

```bash
npx vitest run scripts/__tests__/cloudlight-evening-r3-source.test.ts
git diff --check -- config/audio/cloudlight-evening-r3-source.json scripts/__tests__/cloudlight-evening-r3-source.test.ts package.json
git add config/audio/cloudlight-evening-r3-source.json scripts/__tests__/cloudlight-evening-r3-source.test.ts package.json
git commit -m 'test(audio): define Cloudlight R3 source contract'
```

Expected: PASS; the commit contains only the three named paths.

### Task 2: Generate Deterministic MIDI And Automation

**Files:**

- Create: `scripts/cloudlight-evening-r3-source.cjs`
- Create: `scripts/generate-cloudlight-evening-r3-source.cjs`
- Modify: `scripts/__tests__/cloudlight-evening-r3-source.test.ts`
- Create: `docs/audio/cloudlight-evening-r3-production-runbook.md`

**Interfaces:**

- Produces: `loadCloudlightR3Source(rootDir): CloudlightR3Source`.
- Produces: `validateCloudlightR3Source(source): string[]`.
- Produces: `encodeCloudlightR3Midi(source): Buffer`.
- Produces: `writeCloudlightR3SourcePack({ rootDir, outputDir }): SourcePackReceipt`.
- Output inventory: `cloudlight-evening-r3.mid`, `automation.json`, `source-manifest.json`, and `README.md`.

- [ ] **Step 1: Extend the test with RED MIDI and private-path cases**

```ts
const first = writeCloudlightR3SourcePack({
  rootDir,
  outputDir: join(tempRoot, "output/private/r3-a"),
});
const second = writeCloudlightR3SourcePack({
  rootDir,
  outputDir: join(tempRoot, "output/private/r3-b"),
});

expect(readFileSync(first.midiPath).subarray(0, 4).toString("ascii")).toBe("MThd");
expect(first.manifest.midiSha256).toBe(second.manifest.midiSha256);
expect(first.manifest.automationSha256).toBe(second.manifest.automationSha256);
expect(first.manifest.trackNames).toEqual([
  "Pad",
  "Drone",
  "Shimmer L",
  "Shimmer R",
  "Piano",
  "Linear Fade",
]);
expect(() =>
  writeCloudlightR3SourcePack({ rootDir, outputDir: join(rootDir, "public/sounds/r3") })
).toThrow("must stay under <root>/output/private");
```

Also reject SysEx, program data not declared by the source, an event after 166 seconds, a dry piano note ending after 138 seconds, duplicate candidate IDs, and candidate mix differences outside the allowlist.

- [ ] **Step 2: Run RED**

```bash
npx vitest run scripts/__tests__/cloudlight-evening-r3-source.test.ts
```

Expected: FAIL because the source module and MIDI writer do not exist.

- [ ] **Step 3: Implement the bounded Standard MIDI File writer**

Use type 1, PPQ 960, tempo 1,071,429 microseconds per quarter, big-endian chunk lengths, variable-length delta times, note-on/note-off, track name, tempo, CC10 pan, CC11 expression, and end-of-track only.

The time conversion is:

```js
function secondsToTicks(seconds, tempoBpm, ppq) {
  return Math.round(seconds * (tempoBpm / 60) * ppq);
}
```

Sort same-tick events as note-off, controller, then note-on so overlapping fields cannot leave stuck notes. Encode no SysEx and no imported binary event payload.

- [ ] **Step 4: Implement strict source validation**

Validation returns named violations and throws before writing:

```js
const violations = [
  ...validateTopLevelIdentity(source),
  ...validateTimeline(source),
  ...validatePianoBoundary(source, 138),
  ...validateLoopCompatiblePad(source.harmonicFields[0], source.harmonicFields.at(-1)),
  ...validateCandidateDiffs(source.candidates, {
    "candidate-02": ["shimmerDb", "shimmerPanPercent"],
    "candidate-03": ["pianoDb"],
  }),
  ...validateNoExternalAudioInputs(source),
];
```

The source manifest contains hashes, byte counts, duration, track/event counts, source/license paths, and statuses `NOT_RENDERED`, `OWNER_ARTISTIC_UNVERIFIED`, and `RUNTIME_PROMOTION_NOT_ALLOWED`.

- [ ] **Step 5: Write the fixed CLI and runbook**

The CLI accepts no caller-supplied output path:

```js
const rootDir = path.resolve(__dirname, "..");
const outputDir = path.join(rootDir, "output", "private", "cloudlight-evening-r3", "source");
const receipt = writeCloudlightR3SourcePack({ rootDir, outputDir });
console.log(JSON.stringify({ status: "SOURCE_READY", ...receipt.summary }));
```

The runbook records the exact private directory, five instrument tracks plus linear-fade control, candidate fader values, no-loop/no-audio-region inspection, export format, and screenshot receipt names.

- [ ] **Step 6: Run GREEN, determinism check, and commit**

```bash
npx vitest run scripts/__tests__/cloudlight-evening-r3-source.test.ts
npm run audio:generate-cloudlight-r3-source
shasum -a 256 output/private/cloudlight-evening-r3/source/cloudlight-evening-r3.mid output/private/cloudlight-evening-r3/source/automation.json output/private/cloudlight-evening-r3/source/source-manifest.json
npm run audio:generate-cloudlight-r3-source
shasum -a 256 output/private/cloudlight-evening-r3/source/cloudlight-evening-r3.mid output/private/cloudlight-evening-r3/source/automation.json output/private/cloudlight-evening-r3/source/source-manifest.json
git add scripts/cloudlight-evening-r3-source.cjs scripts/generate-cloudlight-evening-r3-source.cjs scripts/__tests__/cloudlight-evening-r3-source.test.ts docs/audio/cloudlight-evening-r3-production-runbook.md
git commit -m 'feat(audio): generate Cloudlight R3 MIDI source'
```

Expected: tests pass and both hash sets match byte-for-byte.

### Task 3: Bind GarageBand, License, Patches, And Render Receipts

**Files:**

- Create: `scripts/cloudlight-evening-r3-session.cjs`
- Create: `scripts/__tests__/cloudlight-evening-r3-session.test.ts`
- Modify: `docs/audio/cloudlight-evening-r3-production-runbook.md`

**Interfaces:**

- Produces: `inspectGarageBandEnvironment(paths): GarageBandEnvironment`.
- Produces: `writeGarageBandSessionReceipt({ rootDir, projectPath, renderPaths, candidateId }): SessionReceipt`.
- Produces: immutable `DEFAULT_GARAGEBAND_PATHS` from the canonical source JSON.
- Receipt binds GarageBand/macOS identity, exact license/patch/sample hashes, source hashes, project hash, render hashes, and mix ID.

- [ ] **Step 1: Write failing environment and receipt tests**

```ts
const environment = inspectGarageBandEnvironment(DEFAULT_GARAGEBAND_PATHS);
const validPrivateSessionFixture = createGarageBandSessionFixture();
const receipt = writeGarageBandSessionReceipt(validPrivateSessionFixture);

expect(environment).toMatchObject({
  garageBandVersion: "10.4.14",
  garageBandBuild: "6648",
  architecture: "arm64",
});
expect(environment.files.map((row) => row.role)).toEqual([
  "garageband-license",
  "steinway-instrument",
  "steinway-samples",
  "pad-preset",
  "drone-preset",
  "shimmer-preset",
  "reverb-preset",
]);
expect(receipt).toMatchObject({
  appleLoopsUsed: false,
  externalAudioRegions: [],
  runtimePromotionStatus: "NOT_ALLOWED",
  ownerArtisticStatus: "UNVERIFIED",
});
```

Use injectable temporary fixture paths for unit tests; use the verified absolute production paths only in the real preflight.

- [ ] **Step 2: Run RED**

```bash
npx vitest run scripts/__tests__/cloudlight-evening-r3-session.test.ts
```

Expected: FAIL because the session inspector does not exist.

- [ ] **Step 3: Implement the environment inspector**

Read:

- `/Applications/GarageBand.app/Contents/Info.plist`;
- `/Applications/GarageBand.app/Contents/Resources/GarageBand License Agreement.pdf`;
- every exact source path in `garageBand` from the canonical JSON.

Reject missing, symlinked, non-regular, or empty files. Hash every file, including the 183,959,552-byte Steinway CAF, without printing file contents.

- [ ] **Step 4: Implement project and render receipt rules**

The project must resolve inside `output/private/cloudlight-evening-r3/garageband` and end in `.band`. Each render must resolve inside `output/private/cloudlight-evening-r3/renders`. Reject hard links, symlinks, unexpected candidate IDs, missing source hashes, and project packages containing a populated `Media/Audio Files` directory.

- [ ] **Step 5: Run actual environment preflight**

```bash
npx vitest run scripts/__tests__/cloudlight-evening-r3-session.test.ts
node -e 'const m=require("./scripts/cloudlight-evening-r3-session.cjs"); console.log(JSON.stringify(m.inspectGarageBandEnvironment(m.DEFAULT_GARAGEBAND_PATHS), null, 2))'
```

Expected: GarageBand 10.4.14 build 6648, arm64 macOS, all seven license/instrument/effect files present, and no content download or installation request.

- [ ] **Step 6: Commit**

```bash
git add scripts/cloudlight-evening-r3-session.cjs scripts/__tests__/cloudlight-evening-r3-session.test.ts docs/audio/cloudlight-evening-r3-production-runbook.md
git commit -m 'feat(audio): bind Cloudlight GarageBand receipts'
```

### Task 4: Build The Frozen GarageBand Project And Render Three WAV Masters

**Private files only:**

- Create: `output/private/cloudlight-evening-r3/garageband/Cloudlight Evening R3 Base.band`
- Create: `output/private/cloudlight-evening-r3/garageband/Cloudlight Evening R3 Candidate 01.band`
- Create: `output/private/cloudlight-evening-r3/garageband/Cloudlight Evening R3 Candidate 02.band`
- Create: `output/private/cloudlight-evening-r3/garageband/Cloudlight Evening R3 Candidate 03.band`
- Create: `output/private/cloudlight-evening-r3/renders/candidate-01-linear.wav`
- Create: `output/private/cloudlight-evening-r3/renders/candidate-02-linear.wav`
- Create: `output/private/cloudlight-evening-r3/renders/candidate-03-linear.wav`
- Create: `output/private/cloudlight-evening-r3/renders/candidate-01-linear-rerender.wav`
- Create: `output/private/cloudlight-evening-r3/evidence/garageband/*.png`

**Interfaces:**

- Consumes the exact source MIDI and automation hashes from Task 2.
- Produces four WAVs and four session receipts; no tracked repository change.

- [ ] **Step 1: Open the canonical MIDI with GarageBand**

Use `computer-use:computer-use` for visible GUI interaction:

```bash
open -a GarageBand output/private/cloudlight-evening-r3/source/cloudlight-evening-r3.mid
```

Save immediately as the exact base project path. Set project tempo to 56 BPM, disable metronome/count-in, and set the end marker to 2:46.

- [ ] **Step 2: Assign the verified instruments**

- `Pad` → Sculpture `Ambient Pad`.
- `Drone` → Retro Synth `Dark Swell Pad`.
- `Shimmer L` and `Shimmer R` → Sculpture `Ambient Overtones`.
- `Piano` → Sampler `Steinway Grand Piano 2`.
- Do not add an audio track, Apple Loop, Live Loop, Drummer track, imported file, recorded microphone input, or downloaded patch.

Set the main hall from `Clean Ambient Tail`, then set decay 7.5 s, pre-delay 12 ms, low cut 120 Hz, and damping/high cut 4.8 kHz where the GarageBand control exposes those parameters. If a named parameter is absent, stop and record the unavailable control rather than inventing a value.

- [ ] **Step 3: Apply the base automation**

- Pad attack 3.5 s, release 11 s, centered with the preset's native slow stereo field.
- Drone high-pass 36 Hz, centered; confirm no animated pan.
- Shimmer L/R use CC10/pan from the MIDI, no ping-pong delay.
- Piano stays centered and dry level remains below its reverb return.
- Linear expression stays stable through 150 seconds and fades to zero at 166 seconds.

Capture screenshots of the complete track list, every instrument identity, mixer, reverb, 0:00 state, 2:05 piano region, and 2:30-2:46 fade.

- [ ] **Step 4: Freeze composition and create the candidate copies**

Do not move or edit any MIDI region after saving the base project.

- Candidate 01: pad -12 dB, drone -21 dB, shimmer -29 dB at ±35%, piano -27 dB.
- Candidate 02: identical except shimmer -27.8 dB at ±45%.
- Candidate 03: identical except piano -25.8 dB.

Capture one mixer screenshot per candidate. If GarageBand does not expose numeric fader values accurately enough, use track-volume automation nodes with the exact values; do not estimate by eye.

- [ ] **Step 5: Export 48 kHz/24-bit WAV without normalization**

Use Share → Export Song to Disk → WAV → Uncompressed 24-bit. Export the whole 166-second project. Disable normalization and keep the master fader identical.

Export candidate 01 twice without changing or reopening the project. The second render tests GarageBand reproducibility.

- [ ] **Step 6: Capture session receipts and checkpoint**

```bash
afinfo output/private/cloudlight-evening-r3/renders/candidate-01-linear.wav
afinfo output/private/cloudlight-evening-r3/renders/candidate-02-linear.wav
afinfo output/private/cloudlight-evening-r3/renders/candidate-03-linear.wav
shasum -a 256 output/private/cloudlight-evening-r3/renders/*.wav
```

Expected: stereo, 48,000 Hz, 24-bit PCM, approximately 166 seconds. If the two candidate-01 WAV hashes differ, preserve both and defer the explanation to decoded comparison in Task 5. There is no Git commit because every artifact is private and ignored.

### Task 5: Decode, Audit, Encode, And Build The Blind Review Pack

**Files:**

- Create: `scripts/cloudlight-evening-r3-review.cjs`
- Create: `scripts/generate-cloudlight-evening-r3-review.cjs`
- Create: `scripts/audit-cloudlight-evening-r3-review.cjs`
- Create: `scripts/__tests__/cloudlight-evening-r3-review.test.ts`

**Interfaces:**

- Produces: `parsePcmWav(filePath): PcmWav` for 16-bit and 24-bit PCM.
- Produces: `measureCloudlightLinearMaster(filePath): LinearMasterMetrics`.
- Produces: `buildCloudlightR3ReviewPack({ rootDir, rendersDir }): ReviewManifest`; the CLI supplies the fixed private path and the function rejects every non-private path.
- Produces: review files `candidate-01.mp3`, `candidate-02.mp3`, and `candidate-03.mp3` only.

- [ ] **Step 1: Write failing WAV and fail-closed pack tests**

Generate tiny test WAV fixtures in the test temporary directory, then assert:

```ts
const rootDir = createPrivateReviewFixture();
const validFixture = join(rootDir, "output/private/cloudlight-evening-r3/renders/valid.wav");
const publicDir = join(rootDir, "public/sounds");
const metrics = measureCloudlightLinearMaster(validFixture);
const rendersDir = join(rootDir, "output/private/cloudlight-evening-r3/renders");
const manifest = buildCloudlightR3ReviewPack({ rootDir, rendersDir });

expect(metrics).toMatchObject({
  channels: 2,
  sampleRate: 48_000,
  bitsPerSample: 24,
  finiteSamples: true,
  clippedSampleCount: 0,
  pinnedFullScaleSampleCount: 0,
  formalLoudnessStatus: "UNVERIFIED_NO_BS1770_METER",
  formalTruePeakStatus: "UNVERIFIED_NO_BS1770_METER",
});
expect(() => buildCloudlightR3ReviewPack({ rootDir, rendersDir: publicDir })).toThrow(
  "review inputs must stay under <root>/output/private"
);
expect(manifest.candidates.map((row) => row.fileName)).toEqual([
  "candidate-01.mp3",
  "candidate-02.mp3",
  "candidate-03.mp3",
]);
expect(manifest.ownerArtisticStatus).toBe("UNVERIFIED_OWNER_LISTENING_REQUIRED");
expect(manifest.runtimePromotionStatus).toBe("NOT_ALLOWED");
```

Tests corrupt one hash, add a fourth MP3, swap candidate mappings, create a symlink, inject a reference filename, and exceed a signal threshold; every case must fail.

- [ ] **Step 2: Run RED**

```bash
npx vitest run scripts/__tests__/cloudlight-evening-r3-review.test.ts
```

Expected: FAIL because the review/audit module does not exist.

- [ ] **Step 3: Implement whole-file decoded metrics**

Measure:

- format, duration, channel count, sample rate, bit depth, and complete decode;
- finite samples, sample peak, RMS, audible RMS, DC offset, clipping, pinned rails, and maximum adjacent-sample delta;
- 3-second RMS trace and spread;
- half-second silence/dropout windows;
- high-frequency energy estimate above 6.5 kHz;
- stereo correlation and mono fold-down energy ratio;
- 0:00 safety fade and 150-166 second outro decline;
- section RMS/spectral summaries for 0-30, 30-55, 55-80, 80-105, 105-126, 126-138, 138-150, and 150-166 seconds;
- candidate integrated RMS difference no greater than 0.5 dB;
- candidate-01 rerender decoded maximum absolute sample difference.

Label the interpolated peak only `NON_CONFORMANT_INTERSAMPLE_ESTIMATE`.

Use these provisional fail-closed signal bounds until formal metering is approved:

```json
{
  "samplePeakMax": 0.78,
  "rmsDbfsMin": -34,
  "rmsDbfsMax": -20,
  "dcOffsetAbsMax": 0.001,
  "adjacentSampleDeltaMax": 0.25,
  "highFrequencyEnergyRatioMax": 0.22,
  "stereoCorrelationMin": 0.2,
  "monoFoldDownEnergyRatioMin": 0.35,
  "monoFoldDownEnergyRatioMax": 1.5,
  "maxSilentWindowSeconds": 0.5,
  "threeSecondRmsSpreadDbMax": 6,
  "localThreeSecondJumpDbMax": 3,
  "candidateRmsDifferenceDbMax": 0.5
}
```

Passing these bounds is not a substitute for the provisional -24 +/-1 LUFS and <= -2 dBTP targets; those two targets remain `UNVERIFIED`.

- [ ] **Step 4: Encode private review files**

Use macOS AudioToolbox:

```js
spawnSync("afconvert", [inputWav, outputMp3, "-f", "MPG3", "-d", ".mp3", "-b", "192000"], {
  encoding: "utf8",
});
```

Decode every MP3 back to PCM with `afconvert` and re-run the relevant metrics. The review pack contains only blind filenames, Russian listening instructions, and a manifest that does not expose mix mapping. The sealed mapping stays one directory above the review folder.

- [ ] **Step 5: Implement fail-closed status rules**

Technical `PASS_AVAILABLE_CHECKS` requires exact inventory, provenance hashes, 166-second decoded duration tolerance, format, no clip/pinned sample, bounded DC/transients/dropouts, stable section dynamics, safe stereo/mono, 150-166 fade, and successful decode.

The report always retains:

```json
{
  "formalLoudnessStatus": "UNVERIFIED_NO_BS1770_METER",
  "formalTruePeakStatus": "UNVERIFIED_NO_BS1770_METER",
  "aiStatus": "PENDING_DIAGNOSTIC",
  "ownerArtisticStatus": "UNVERIFIED_OWNER_LISTENING_REQUIRED",
  "runtimePromotionStatus": "NOT_ALLOWED"
}
```

- [ ] **Step 6: Run GREEN and build the pack**

```bash
npx vitest run scripts/__tests__/cloudlight-evening-r3-review.test.ts
npm run audio:generate-cloudlight-r3-review
npm run audio:audit-cloudlight-r3-review
shasum -a 256 output/private/cloudlight-evening-r3/review/candidate-01.mp3 output/private/cloudlight-evening-r3/review/candidate-02.mp3 output/private/cloudlight-evening-r3/review/candidate-03.mp3 output/private/cloudlight-evening-r3/review/review-manifest.json
```

Expected: all available objective gates pass or the pack is not opened. Formal BS.1770 measurements remain `UNVERIFIED`.

- [ ] **Step 7: Commit tooling only**

```bash
git add scripts/cloudlight-evening-r3-review.cjs scripts/generate-cloudlight-evening-r3-review.cjs scripts/audit-cloudlight-evening-r3-review.cjs scripts/__tests__/cloudlight-evening-r3-review.test.ts
git commit -m 'feat(audio): audit Cloudlight R3 review candidates'
```

### Task 6: Run The Existing Models As A Non-Admitted Diagnostic

**Files:**

- Create: `config/audio/cloudlight-evening-r3-ai-audit-v1.json`
- Create: `scripts/audio_audit/cloudlight.py`
- Create: `scripts/audio_audit/tests/test_cloudlight_audit.py`
- Modify: `scripts/audio_audit/backends/common.py`

**Interfaces:**

- Adds only `cloudlight-evening` to `ALLOWED_REQUEST_FAMILIES`; existing Hyperfocus `EXPECTED_FAMILIES` remains unchanged.
- Produces one sealed diagnostic report per candidate under `/Users/yehor/Projects/ZenFlow/private-evidence/cloudlight-evening-r3/ai-audit`.
- Final diagnostic status remains `TRIAL_ONLY_NOT_ADMITTED` and verdict `ABSTAIN` or `FAIL`, never `PASS`.

- [ ] **Step 1: Write failing prompt and boundary tests**

The prompt policy contains these groups:

```json
{
  "family": "cloudlight-evening",
  "positivePrompts": [
    "warm dark ambient music with a soft spacious pad",
    "calm evening background music with sparse subordinate piano",
    "low-urgency atmospheric music with long blended reverb"
  ],
  "hardNegativePrompts": [
    "foreground piano solo",
    "notification bell or alarm",
    "wind rain static or breathing",
    "drums beat or rhythmic pulse",
    "horror ambience or ominous drone",
    "dramatic cinematic riser or climax",
    "bright glass transient"
  ],
  "status": "TRIAL_ONLY_NOT_ADMITTED",
  "aiMaySetOwnerPass": false
}
```

Tests require exact candidate hashes, fixed private roots, offline model loading, no score/rank in the listening folder, and unchanged Hyperfocus family validation.

- [ ] **Step 2: Run RED**

```bash
/Users/yehor/Projects/ZenFlow/private-evidence/audio-ai-audit/envs/clap/bin/python -m unittest scripts.audio_audit.tests.test_cloudlight_audit -v
```

Expected: FAIL because the Cloudlight policy and orchestrator do not exist.

- [ ] **Step 3: Implement the narrow backend extension and orchestrator**

In `common.py`:

```py
ALLOWED_REQUEST_FAMILIES = frozenset((*EXPECTED_FAMILIES, "cloudlight-evening"))
```

Validate the private review manifest and copy only the three exact-hash decoded WAV views to the fixed Cloudlight private-evidence root. Run CLAP with the frozen prompt rows and YAMNet over the whole-timeline windows. Publish raw rows, prompt variance, top event classes, model hashes, environment hashes, and contradictions. Do not define a selection threshold.

- [ ] **Step 4: Run GREEN and the diagnostic**

```bash
/Users/yehor/Projects/ZenFlow/private-evidence/audio-ai-audit/envs/clap/bin/python -m unittest scripts.audio_audit.tests.test_cloudlight_audit scripts.audio_audit.tests.test_audit_tool -v
/Users/yehor/Projects/ZenFlow/private-evidence/audio-ai-audit/envs/clap/bin/python -m scripts.audio_audit.cloudlight
```

If either private environment or its exact model receipt is unavailable, do not install or download anything. Record `AI_DIAGNOSTIC_UNVERIFIED_ENVIRONMENT_UNAVAILABLE` and continue to human review only if objective Gate 1/2 passed.

- [ ] **Step 5: Run scoped security checks and commit**

```bash
/Users/yehor/.codex/bin/codex-security-suite.sh --path . --profile quick
git add config/audio/cloudlight-evening-r3-ai-audit-v1.json scripts/audio_audit/cloudlight.py scripts/audio_audit/backends/common.py scripts/audio_audit/tests/test_cloudlight_audit.py
git commit -m 'feat(audio): add Cloudlight R3 AI diagnostics'
```

Any scanner unavailable through credentials or network remains `UNVERIFIED`; no gate is weakened.

### Task 7: Final Candidate Verification And Owner Listening Gate

**Tracked files:** none unless a prior task failed and needs a reviewed fix.

**Private files:**

- `output/private/cloudlight-evening-r3/review/candidate-01.mp3`
- `output/private/cloudlight-evening-r3/review/candidate-02.mp3`
- `output/private/cloudlight-evening-r3/review/candidate-03.mp3`
- `output/private/cloudlight-evening-r3/review/review-manifest.json`

**Interfaces:**

- Produces the owner decision `01`, `02`, `03`, or `NONE` bound to an exact SHA-256.
- Does not produce or modify the 150-second runtime asset.

- [ ] **Step 1: Re-run focused and repository documentation gates**

```bash
npx vitest run scripts/__tests__/cloudlight-evening-r3-source.test.ts scripts/__tests__/cloudlight-evening-r3-session.test.ts scripts/__tests__/cloudlight-evening-r3-review.test.ts
npm run audio:audit-cloudlight-r3-review
npm run check:no-ai-templates
npm run check:best-practices
node_modules/.bin/prettier --check config/audio/cloudlight-evening-r3-source.json config/audio/cloudlight-evening-r3-ai-audit-v1.json scripts/__tests__/cloudlight-evening-r3-source.test.ts scripts/__tests__/cloudlight-evening-r3-session.test.ts scripts/__tests__/cloudlight-evening-r3-review.test.ts docs/audio/cloudlight-evening-r3-production-runbook.md
git diff --check
git status --short
```

Confirm the only production MP3 hashes remain `d096c668ef6471f855b49c93bc5509ccbd63ac1fb93dc9af96ba3c7c9e65be40`.

- [ ] **Step 2: Verify review blindness**

The review directory contains exactly five files:

```text
README.md
candidate-01.mp3
candidate-02.mp3
candidate-03.mp3
review-manifest.json
```

Neither README nor manifest exposes “darkest”, “shimmer”, “piano +1.2 dB”, GarageBand project names, or the sealed mapping.

- [ ] **Step 3: Open the three sounds locally**

```bash
open output/private/cloudlight-evening-r3/review
open output/private/cloudlight-evening-r3/review/candidate-01.mp3
```

After candidate 01, open 02 and 03 on request or as a local playlist. Do not send candidates to Telegram without a new explicit request.

- [ ] **Step 4: Collect the hash-bound owner decision**

Before asking, the owner listens to every complete candidate once on headphones and once on a built-in phone or laptop speaker, uses low and normal comfortable volume, changes the starting candidate order between devices, and keeps the candidates running for at least 15 minutes total to expose fatigue. No excerpt-only decision is accepted.

Ask for:

```text
01 / 02 / 03 / NONE

Optional notes:
- piano too noticeable?
- shimmer resembles a notification?
- any wind/rain/static/breathing impression?
- calm or sad/anxious/cinematic?
- harsh transient?
- weak on phone speaker?
```

Only the chosen review MP3 receives `OWNER_ARTISTIC_PASS`. If `NONE`, retain all evidence, change only one musical category in R4, and do not integrate anything.

- [ ] **Step 5: Stop before production**

Report:

- source/MIDI/project/WAV/MP3 hashes;
- objective gate results;
- AI status and limitations;
- owner choice or pending state;
- unchanged production hash;
- dirty inherited v2 paths;
- exact `UNVERIFIED` items.

Then write a new implementation plan for the chosen candidate's 150-second cyclic master, 160/192 kbit/s comparison, production replacement, cache revision, Web/PWA/Android/iOS/Desktop package parity, physical-device evidence, and final Telegram Saved Messages handoff.

## Risks And Mitigations

| Risk                                                               | Mitigation                                                                                       |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| Old v2 files are mistaken for R3                                   | Hash and classify them as rejected input; never stage or import them                             |
| GarageBand preset name exists on disk but is not exposed in the UI | Stop at Task 4 and record the unavailable control; do not substitute a different timbre silently |
| MIDI import changes tempo, timing, or track mapping                | Compare imported track/event inventory with source receipt before mixing                         |
| Candidate composition drifts                                       | Freeze base project; candidate copies change only declared faders/pan                            |
| GarageBand render is not byte deterministic                        | Keep rerender, compare decoded samples, record variance, never claim byte identity without proof |
| MP3 encoding masks or sharpens transients                          | Audit both WAV and decoded MP3; owner listens to the decoded delivery file                       |
| Formal loudness meter is unavailable                               | Keep BS.1770 status `UNVERIFIED`; do not install without exact approval                          |
| AI model misclassifies ambient music                               | Keep `TRIAL_ONLY_NOT_ADMITTED` and show raw contradictions; owner remains authority              |
| Review names leak mix intent                                       | Sealed mapping outside review directory; exact blind-name test                                   |
| Production is replaced before approval                             | Review builder rejects public/docs/native paths and reports `NOT_ALLOWED`                        |
| Physical speaker changes the balance                               | Owner phone/laptop-speaker review; production device testing remains later                       |

## Done Criteria

- [ ] Canonical R3 source JSON passes strict validation.
- [ ] Two source generations produce identical MIDI, automation, and source-manifest hashes.
- [ ] GarageBand 10.4.14, exact license, Steinway sample/instrument, pad/drone/shimmer/reverb presets, and macOS identity are hash-bound.
- [ ] One frozen GarageBand composition produces exactly three declared mix variants.
- [ ] Three 166-second 48 kHz/24-bit stereo WAVs and three 192 kbit/s blind MP3s exist only in private output.
- [ ] Every available decoded technical, provenance, inventory, stereo/mono, dynamics, fade, and encode gate passes.
- [ ] Formal BS.1770 status remains truthful.
- [ ] AI results are retained as non-admitted diagnostics and never rank candidates.
- [ ] Review folder is blind and contains exactly the expected files.
- [ ] Production Cloudlight hashes remain unchanged.
- [ ] Owner returns `01`, `02`, `03`, or `NONE` for an exact review hash.
- [ ] Production integration does not begin inside this plan.

## UNVERIFIED Until Execution

- Actual MIDI and automation bytes.
- GarageBand project creation and UI exposure of the verified on-disk presets.
- Render success, exact duration, bit depth, decoded metrics, and repeat-render stability.
- Formal LUFS/LRA/dBTP.
- CLAP/YAMNet environment availability and candidate diagnostics.
- Human pleasantness, fatigue, reference non-resemblance, phone-speaker balance, and owner selection.
- The selected 150-second seamless runtime loop.
- Web/PWA/Android/iOS/Desktop packaging and playback.
- Physical devices, public deployment, store state, release, and Telegram delivery.

## Completeness Check

- Explicit request: create the sound and make it close in high-level style/mood without copying protected expression.
- Hidden work covered: deterministic source, GarageBand licensing, instrument identity, candidate blindness, objective decode, AI diagnostic limits, owner gate, rollback boundary, and no production promotion.
- Blocking question before plan execution: execution mode only.
- Safe default: inline SOLO execution.
- Next artifact after this plan: three local candidate MP3s for owner listening, not a production release.
