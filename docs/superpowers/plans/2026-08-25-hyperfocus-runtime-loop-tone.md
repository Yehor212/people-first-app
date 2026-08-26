# Hyperfocus Runtime Loop And Tone Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task in the current SOLO lane. Steps use checkbox (`- [ ]`) syntax for tracking. Do not dispatch subagents unless the current user explicitly changes the SOLO boundary.

**Goal:** Promote all eighteen approved CC0 source-audition recordings into deterministic loop-safe Hyperfocus runtime assets, add the `3–16 kHz` tone-control core, migrate PWA audio caching, prove cross-platform packaging, and finish with a localhost placement comparison.

**Architecture:** Private Python tooling consumes the already hash-bound source-audition packet, measures all three sources per family, assigns levels independently of blind labels, renders exact 30-second periodic PCM masters, encodes 128 kbps MP3, and emits independently verifiable evidence before tracked promotion. The existing HTML media player remains authoritative; one optional Web Audio low-pass graph adds tone control with safe bypass. Stable runtime paths preserve stored selections, while a versioned PWA cache prevents stale bytes.

**Tech Stack:** Python 3.12, NumPy 2.1.3, PCM WAV, macOS `afconvert`, React 18, TypeScript, Web Audio API, Vitest/Testing Library, Vite/Workbox, Capacitor 8, Tauri 2, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-25-hyperfocus-runtime-loop-tone-design.md`

## Global Constraints

- Exactly six families × three approved sources become exactly eighteen runtime files.
- Blind `A/B/C` labels never affect level assignment.
- The reviewed 20-second PCM windows are the only artistic audio inputs.
- Delivery is 30 seconds, 48 kHz, stereo, 128 kbps MP3, peak ≤ `-1 dBFS`, zero clipped samples, and adjacent decoded intensity ≥3 dB.
- Allowed operations are only `decode-pcm`, `equal-power-loop-crossfade`, `repeat-exactly-twice`, `linked-gain`, `safety-peak-scale`, and `encode-mp3`.
- Tone cutoff is `3–16 kHz`, defaults to `16 kHz`, steps by `0.5 kHz`, never changes pitch/playback rate, and fails open to unfiltered audio.
- Production slider placement remains untouched until the owner selects a localhost variant.
- No dependency, cloud write, deploy, push, PR, store upload, signing, or release claim is authorized.

---

### Task 1: Deterministic Source-To-Level Assignment

**Files:**

- Create: `config/audio/hyperfocus-runtime-mastering-v2.json`
- Create: `scripts/audio_candidates/mastering.py`
- Modify: `scripts/audio_candidates/tests/test_candidate_tool.py`

**Interfaces:**

- Produces: `measure_intensity(samples: np.ndarray, sample_rate: int) -> IntensityMetrics`.
- Produces: `assign_family_levels(records: tuple[PreviewRecord, ...]) -> tuple[RuntimeAssignment, ...]`.
- Produces immutable `IntensityMetrics` and `RuntimeAssignment` dataclasses.

- [ ] **Step 1: Add the failing exact-assignment tests**

Add `RuntimeMasteringTests` with literal fixtures proving that increasing RMS/motion/ZCR sorts to `soft`, `deep`, `intense`, ties resolve by candidate ID, all eighteen IDs are required, duplicate sources fail, and arbitrary blind order produces the same assignment.

- [ ] **Step 2: Run RED**

Run:

```bash
/Users/yehor/Projects/ZenFlow/private-evidence/hyperfocus-v2/envs/review/bin/python -m unittest scripts.audio_candidates.tests.test_candidate_tool.RuntimeMasteringTests -v
```

Expected: import or attribute failure because the runtime mastering API does not exist.

- [ ] **Step 3: Implement the exact metrics and validation**

Use the project intensity formula from the spec, require finite stereo 48 kHz inputs, validate the exact family/candidate inventory, sort by `(intensity_score, candidate_id)`, and return exact source/preview hash bindings. The config contains schema version `2`, the three RMS targets, 5-second crossfade, 30-second delivery duration, peak ceiling, encoder identity, and the operation allowlist.

- [ ] **Step 4: Run GREEN and all candidate tests**

Run the focused test, then:

```bash
/Users/yehor/Projects/ZenFlow/private-evidence/hyperfocus-v2/envs/review/bin/python -m unittest scripts.audio_candidates.tests.test_candidate_tool -v
```

- [ ] **Step 5: Commit**

Commit message: `feat(audio): add runtime intensity assignment`.

### Task 2: Circular Loop Mastering And MP3 Evidence

**Files:**

- Modify: `scripts/audio_candidates/mastering.py`
- Create: `scripts/audio_candidates/build_runtime_masters.py`
- Create: `scripts/audio_candidates/verify_runtime_masters.py`
- Modify: `scripts/audio_candidates/tests/test_candidate_tool.py`

**Interfaces:**

- Produces: `build_circular_base(samples: np.ndarray, sample_rate: int, crossfade_seconds: float) -> np.ndarray`.
- Produces: `master_runtime_asset(assignment: RuntimeAssignment, samples: np.ndarray, output_root: Path) -> RuntimeMasterRecord`.
- Produces fixed private package `/Users/yehor/Projects/ZenFlow/private-evidence/hyperfocus-v2/runtime-masters-v2`.

- [ ] **Step 1: Add failing loop/master tests**

Use a literal stereo fixture whose start/end disagree. Assert output is exactly 1,440,000 frames, first and second 15-second halves are byte-equal before encoding, operations equal the allowlist, output RMS approaches the assigned target without clipping, and tampering or a prohibited operation fails verification.

- [ ] **Step 2: Run RED**

Run `RuntimeLoopTests`; expect missing loop/master functions.

- [ ] **Step 3: Implement periodic PCM and bounded mastering**

Use equal-power curves `cos(t*pi/2)` and `sin(t*pi/2)` over exactly 240,000 frames. Build the 15-second base from the tail/head overlap plus untouched middle, repeat twice, apply linked gain to `-30/-26/-22 dBFS`, and scale down to the linear `-1 dBFS` ceiling when necessary. Refuse NaN, silence, mono, wrong rate, wrong duration, symlink input/output, overwrite, and unapproved operations.

- [ ] **Step 4: Add the fixed `afconvert` encoder boundary**

Encode through `/usr/bin/afconvert -f MPG3 -d .mp3 -b 128000`. Record executable SHA-256/version output and full argv. Encode a fixture twice and require identical bytes; if local CoreAudio is nondeterministic, bind each encode to decoded PCM/QC and mark byte reproducibility `UNVERIFIED` rather than weakening audio checks.

- [ ] **Step 5: Build the private 18-file package**

The builder accepts no caller-controlled paths, verifies the sealed source-audition packet first, writes atomically, includes `assignment.json`, `provenance.json`, `qc.json`, `build-environment.json`, `audio/*.mp3`, decoded analysis WAVs outside delivery, and `SHA256SUMS`.

- [ ] **Step 6: Independently verify**

Hashes are verified before JSON parsing. Re-decode every MP3 with `afconvert`, verify rate/channels/duration/bitrate/peak/clipping/seam/intensity, verify all source/preview/assignment chains, forbid model/source bytes inside delivery, and require `runtimePromotionAllowed=false` pending final human placement/listening.

- [ ] **Step 7: Run GREEN and commit**

Commit message: `feat(audio): build loop-safe runtime masters`.

### Task 3: Final Diagnostic AI Audit

**Files:**

- Create: `scripts/audio_candidates/runtime_ai.py`
- Modify: `scripts/audio_candidates/tests/test_candidate_tool.py`

**Interfaces:**

- Consumes the verified runtime master package.
- Produces fixed private evidence `/Users/yehor/Projects/ZenFlow/private-evidence/hyperfocus-v2/runtime-ai-audit-v2`.

- [ ] **Step 1: Add failing non-authority tests**

Assert the report can contain `PASS/FAIL/ABSTAIN/UNVERIFIED` model gates and diagnostics but cannot contain owner decision, human semantic pass, legal pass, promotion pass, or source ranking mutation.

- [ ] **Step 2: Run RED and implement the fixed audit adapter**

Reuse the pinned CLAP/YAMNet backend protocol and policy. Audit all 18 final MP3 decodes, keep `TRIAL_ONLY_NOT_ADMITTED`, retain visible diagnostic flags, and fail the run on missing backend/model/hash evidence.

- [ ] **Step 3: Run models and independent verifier**

Use the fixed private CLAP Python environment, then verify the sealed report and model/policy hashes. AI results never reorder or rewrite assets.

- [ ] **Step 4: Commit**

Commit message: `feat(audio): audit final runtime masters`.

### Task 4: Tracked Runtime Promotion And Provenance

**Files:**

- Create: `scripts/audio_candidates/promote_runtime.py`
- Create: `docs/audio/hyperfocus-runtime-v2-manifest.json`
- Modify: `public/sounds/hyperfocus/*.mp3` (exactly 18 generated files)
- Modify: `src/lib/hyperfocusGeneratedAudioManifest.ts`
- Modify: `docs/audio/hyperfocus-generated-audio-provenance.json`
- Modify: `THIRD_PARTY_NOTICES.md`
- Modify: `scripts/check-hyperfocus-audio-assets.cjs`
- Modify: `scripts/__tests__/check-hyperfocus-audio-assets.test.ts`
- Modify: `src/lib/__tests__/hyperfocusAudioCatalog.test.ts`

**Interfaces:**

- Promotion consumes only the fixed verified private master/AI evidence and writes only the allowlisted tracked runtime files/manifests.

- [ ] **Step 1: Add failing promotion/QC tests**

Require exact eighteen v2 output hashes, BigSoundBank-only source coverage, CC0 receipt references, operation allowlist, assignment metric evidence, decoded loop fields, no quarantine hashes, no Mixkit reachability for Hyperfocus, unchanged public paths, and `runtimePromotionAllowed=false` until remaining human/release gates close.

- [ ] **Step 2: Run RED**

Run focused script/catalog tests; expect the old runtime hashes/providers and missing v2 manifest to fail.

- [ ] **Step 3: Implement fail-closed promotion**

Verify all private evidence first, refuse dirty/unapproved targets or any path outside the exact 18 assets/manifests, copy atomically, regenerate the TypeScript manifest from the canonical JSON, update provenance/notices, and never copy source WAV/model/analysis bytes into runtime paths.

- [ ] **Step 4: Run audio gates GREEN**

Run focused tests, `npm run check:hyperfocus-audio`, `npm run check:app-audio`, PDI diff, and quarantine/source scans.

- [ ] **Step 5: Commit as a batch**

Because more than seven paths change, commit message contains `batch`: `feat(audio): batch promote cc0 runtime loops`.

### Task 5: Persisted Tone Filter Core

**Files:**

- Create: `src/lib/hyperfocusTone.ts`
- Create: `src/lib/__tests__/hyperfocusTone.test.ts`
- Modify: `src/lib/storageKeys.ts`
- Modify: `src/lib/audioManager.ts`
- Modify: `src/lib/__tests__/audioManager.test.ts`
- Modify: `src/lib/ambientSounds.ts`
- Modify: `src/lib/__tests__/ambientSounds.test.ts`
- Modify: `src/components/hyperfocus/useHyperfocusAudio.ts`
- Modify: `src/components/hyperfocus/__tests__/useHyperfocusAudio.test.tsx`

**Interfaces:**

- Produces `HYPERFOCUS_TONE_MIN_KHZ=3`, `MAX_KHZ=16`, `STEP_KHZ=0.5`, `DEFAULT_KHZ=16`.
- Produces `normalizeHyperfocusToneKhz(value: unknown) -> number` and `formatHyperfocusToneKhz(value: number) -> string`.
- Extends `AudioSettingsSnapshot` with `hyperfocusToneCutoffKhz` and adds `setHyperfocusToneCutoffKhz(value: number) -> boolean`.
- Adds `AmbientSoundGenerator.setToneCutoffKhz(value: number): ToneFilterStatus`.

- [ ] **Step 1: Write pure RED tests**

Use literal cases for `2.9→3`, `3.24→3`, `3.26→3.5`, `15.9→16`, invalid→16, and formatting. Assert persistence clamps before write, storage events reload the value, and failed storage write preserves previous state.

- [ ] **Step 2: Run RED and implement the pure preference contract**

Add the storage key and snapshot field using `safeJson` helpers; no direct `localStorage`, Dexie, sync, or analytics.

- [ ] **Step 3: Write Web Audio graph RED tests**

With a complete fake `AudioContext`, prove one media element creates at most one source node, cutoff ramps in Hz, 16 kHz uses the bounded neutral state, graph failure returns degraded bypass without stopping playback, and neither `playbackRate` nor source duration is changed.

- [ ] **Step 4: Implement minimal graph wiring**

Attach the graph lazily after the blessed element exists. Reuse nodes, resume through existing lifecycle, expose diagnostic status, and preserve current fallback/error behavior.

- [ ] **Step 5: Wire the Hyperfocus hook without final UI**

Read the persisted cutoff through `useAppAudioSettings`, call the generator on settings changes and before playback, and return cutoff/setter/status for the future selected UI. Do not render a production slider yet.

- [ ] **Step 6: Run focused and lifecycle tests GREEN; commit**

Commit message: `feat(audio): add bounded hyperfocus tone core`.

### Task 6: PWA Audio Cache Migration

**Files:**

- Modify: `src/sw.ts`
- Modify: `scripts/__tests__/audio-blind-spots-contract.test.ts`
- Modify or create: closest service-worker runtime test under `src/__tests__` or `scripts/__tests__`.

- [ ] **Step 1: Write RED cache-migration behavior test**

Execute or import the service-worker cache-name/migration boundary in a controlled environment. Assert the new namespace differs from `zenflow-runtime-audio`, activation deletes only the exact legacy namespace, unrelated caches survive, warm-cache duplicate paths are removed, and range/full-response plugins remain configured.

- [ ] **Step 2: Run RED and implement the versioned namespace**

Use `zenflow-runtime-audio-v2`, delete only `zenflow-runtime-audio` during activation, keep warming non-blocking, deduplicate the fixed audio path list, and leave all other cache strategies unchanged.

- [ ] **Step 3: Run GREEN plus PWA range tests; commit**

Commit message: `fix(pwa): migrate hyperfocus audio cache`.

### Task 7: Five-Platform Build And Byte Verification

**Files:**

- Create: `docs/audio/hyperfocus-runtime-v2-platform-matrix.json`
- Modify generated ignored paths only through standard build/sync commands.

- [ ] **Step 1: Build Web/PWA and verify dist hashes**

Run `npm run build`, PDI bundle, audio gates, and compare all 18 `dist/sounds/hyperfocus` hashes to the tracked manifest.

- [ ] **Step 2: Verify installed PWA behavior**

Run the range/offline Playwright flow, then a local browser interaction covering select, play, pause, resume, change level, change cutoff, offline reload, and console/network errors. Production URL remains `UNVERIFIED` because no deploy is authorized.

- [ ] **Step 3: Sync and verify Android**

Run `npm run cap:sync:android`, compare the 18 ignored native asset hashes, build a debug APK, scan ZIP entries, install on an available emulator, and use semantic nodes to exercise playback/cutoff/lifecycle. Physical/OEM remains `UNVERIFIED`.

- [ ] **Step 4: Sync and verify iOS**

Run `npm run cap:sync:ios`, compare the 18 ignored native asset hashes, build the simulator app when Xcode runtime is available, and exercise user-gesture playback/background-resume. Physical/TestFlight remains `UNVERIFIED`.

- [ ] **Step 5: Verify Desktop/Tauri**

Run desktop config/toolchain checks, verify `dist` hashes under the relative base, and build/scan the local Tauri artifact when the host supports its configured target. Unsupported Windows NSIS/signing stays `UNVERIFIED` on macOS.

- [ ] **Step 6: Write the truthful matrix and commit**

Record `PASS/FAIL/UNVERIFIED/SKIP` per platform with artifact hashes and no release claim. Commit message: `docs(audio): record runtime platform evidence`.

### Task 8: Localhost Tone Placement Lab

**Files:**

- Create: `scripts/audio_design_lab/build_tone_placement_lab.py`
- Create: `scripts/audio_design_lab/tests/test_tone_placement_lab.py`
- Generate ignored private output: `/Users/yehor/Projects/ZenFlow/private-evidence/hyperfocus-v2/tone-placement-lab-v1`

**Interfaces:**

- Produces a static localhost-only comparison using real family/level copy and one promoted MP3, with inline, popover, and expanded-panel placement variants.

- [ ] **Step 1: Write RED artifact tests**

Require exactly three variants, 44 px targets, native range semantics, visible `3–16 kHz`, keyboard instructions, muted/degraded states, mobile/desktop frames, RTL direction sample, no external network URLs, no production route, and no placeholder copy.

- [ ] **Step 2: Run RED and implement the lab generator**

Generate self-contained HTML/CSS/JS under private evidence. The slider controls a real local audio element plus Web Audio low-pass graph. No design-lab file enters runtime or build output.

- [ ] **Step 3: Serve and verify with Playwright**

Start a loopback-only server, open the lab, exercise all variants, capture screenshots at mobile/desktop/RTL widths, verify console/network/accessibility facts, and run the local visual-integrity critic because this is visual product work.

- [ ] **Step 4: Open localhost for owner selection**

Present the three variants and stop before production UI placement. Record only the owner's explicit selection in the next implementation step.

- [ ] **Step 5: Commit tooling only**

Commit message: `feat(audio): add localhost tone placement lab`.

## Plan-Specific Done Boundary

- Core audio, loop masters, stable runtime paths, tone-filter API, persistence, PWA cache migration, and locally available platform packages can be implemented and verified now.
- Production UI placement is intentionally incomplete until the owner selects one localhost variant.
- Human long-loop/fatigue review, legal clearance beyond CC0 evidence, physical devices, signed store artifacts, public deploy, and release remain `UNVERIFIED`/`STOP` unless new evidence and authority are supplied.
