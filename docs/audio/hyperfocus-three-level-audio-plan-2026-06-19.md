# Hyperfocus Three-Level Audio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the six current Hyperfocus ambience options with a controlled three-level audio system per sound family, using only Google Gemini-family generation when generation is allowed.

**Architecture:** Keep Hyperfocus ambience as local bundled MP3 files started by user gesture. Add a typed catalog for sound families and intensity levels, generate or import 18 final assets only after a Gemini/Lyria pilot passes quality gates, then update the selector from a flat 6-button grid to family selection plus intensity selection while preserving backward compatibility for existing saved sound ids.

**Tech Stack:** React 18, TypeScript, Vite public assets, Capacitor, iOS Simulator, Android adb/AVD, Tauri, Vitest, Testing Library, macOS afinfo/afconvert, Node validation scripts.

---

## Execution Status - 2026-06-19

- Spec status: PASS. The JSON spec contains 6 families and 18 variants.
- Provider status: Google audio models available here are Gemini TTS and Lyria music only; no Google SFX/soundscape model is exposed in the current toolchain. Durable evidence is now written to `output/audio-qc/hyperfocus-provider-capability-current.json` from `output/audio-qc/picsart-google-audio-models-current.json`.
- Pilot status: REJECTED. Two Lyria 3 Clip fireplace-soft pilots were generated into quarantine and rejected for peak/clipping plus end-fade loop failure. `output/audio-qc/hyperfocus-raw-candidates-current.json` now records both raw candidates as rejected with objective issue codes.
- Pro status: NOT GENERATED. Lyria 3 Pro is also music-generation, accepts only prompt/image mood inputs, dry-run pricing is 3 credits for the fireplace-soft prompt, and the 2026-06-19 generation attempt returned 402 `Not enough available credits`.
- Runtime status: a typed catalog, generated-audio manifest, generated-audio provenance ledger, variant-id fallback lookup, hook normalization, V1 Hyperfocus level selector with translation-backed level labels, strict generated-asset QC CLI, deterministic Gemini generation queue export/writer with prompt-policy blocking, pilot-only phase, and full-pack-after-pilot guard, pilot-gate readiness evidence and CLI report writer, QC JSON report writer, cross-target package report writer, QC-gated asset promotion CLI, source-audio-reuse guard, structured audible-review gate with prompt-hash binding, false-by-default audible-review template writer, manifest public-SHA integrity guard, all-or-nothing batch promotion CLI, deterministic full/pilot batch-promotion template writer, unified readiness report writer with pilot queue/template, audible-review-template, candidate-url-intake-template, accepted-candidate objective-QC, audible-review-approval, and generation-credit coverage, focused accepted-candidate QC report writer, raw quarantine candidate audit reporting, objective completion-audit reporting, full/pilot candidate URL intake template/download command, explicit pilot-only batch validation for `fireplace:soft`, full-pack URL download and batch-promotion pilot-gate enforcement, Gemini-only candidate URL intake provider/model validation, candidate URL generationId placeholder rejection, phase-specific generation authorization reports with prompt-policy blocking, explicit generation-decision report writing, original V1 focus source coverage reporting, Gemini prompt-policy coverage/reporting, Gemini TTS rejection for ambience provenance/generation, and manifest writer are implemented. Generated variants remain marked generated:false until a QC-accepted asset exists, so current level choices still resolve through legacy fallback audio.
- Verification status: catalog tests, generated-manifest catalog tests, ambient sound tests, Hyperfocus selector/hook tests, QC script unit tests including generation queue export, JSON QC report writing, cross-target package report writing, promote rejection/copy behavior and manifest rendering, TypeScript, i18n:check, i18n:deep, scoped ESLint, and Snyk CLI for src/lib plus src/components/hyperfocus passed after the catalog/UI/QC change. The latest targeted audio suite passed 7 files / 125 tests after adding generation-queue report writing, generation-decision reporting, provider-capability reporting/readiness evidence, Android APK, iOS App.app, macOS Tauri App.app package-artifact checks, source-audio-reuse promotion rejection, required audible-review provenance, audible-review prompt-hash binding, Gemini TTS rejection for ambience generation/provenance, audible-review template generation, manifest public-SHA mismatch rejection, all-or-nothing batch promotion, deterministic full/pilot batch-promotion template output, pilot-only generation queue coverage, pilot-only URL intake and promotion validation, full-pack pilot-gate enforcement, Gemini-only candidate URL intake validation, pilot-only readiness coverage, pilot-gate readiness and CLI-report coverage, all-or-nothing candidate URL intake, focused accepted-candidate QC reporting, raw quarantine candidate audit reporting, completion-audit reporting, unified readiness reporting, audible-review-template readiness coverage, accepted-candidate objective-QC readiness coverage, audible-review-approval readiness blocking, generation-credit readiness coverage, phase-specific generation-authorization coverage, original-source coverage reporting, Gemini prompt-policy reporting, prompt-policy blocking in generation authorization, and prompt-policy blocking in generation queue export.
- Runtime/browser status: V1 Hyperfocus was verified in Chromium at `http://127.0.0.1:4179/people-first-app/?dev=true`; the Diary tab opens Hyperfocus, Fireplace exposes Embers/Hearth/Bonfire, selecting Embers keeps it pressed after start, and playback requests the legacy fallback `sounds/fireplace-fx-56636.mp3` with HTTP 206 rather than missing generated assets. Screenshots are in `output/playwright/v1-hyperfocus-open.png` and `output/playwright/v1-hyperfocus-fireplace-soft-playing.png`.
- Native/emulator status: full generated-pack playback verification remains pending because no generated asset was accepted for integration. The generated-asset CLI currently fails with 18 missing files, as intended. The package report at `output/audio-qc/hyperfocus-package-current.json` currently fails with 144 missing package entries across `source-public`, `web-dist`, `ios-capacitor`, `ios-simulator-app`, `android-capacitor`, `android-debug-apk`, `desktop-tauri-dist`, and `desktop-tauri-macos-app`. iOS Simulator build/install/launch was verified on booted iPhone 17 with the current legacy/fallback audio bundle. Android emulator `codex_pixel_7_api36` booted as `emulator-5554`; `npm run cap:sync`, `./gradlew assembleDebug`, `adb install -r android/app/build/outputs/apk/debug/app-debug.apk`, and `adb shell am start -n com.zenflow.app/.MainActivity` succeeded. Android screenshots are in `output/android-emulator-hyperfocus/app-launch.png` and `output/android-emulator-hyperfocus/app-after-20s.png`.

## Current Findings

- Current Hyperfocus families in production: underwater, thunderstorm, ocean, river, cafe, fireplace.
- Current files are listed in `src/lib/ambientSounds.ts` and registered through `src/lib/appAudioAssets.ts`.
- Generated spec is saved at `docs/audio/hyperfocus-three-level-generation-spec.json`.
- Available Google audio models in this environment: Gemini TTS and Google Lyria music. Current provider capability artifact records 4 Google audio models: 2 TTS disallowed for ambience, 2 Lyria music pilot candidates, 0 SFX/soundscape models, recommended action `pilot-only-with-strict-qc`.
- Available SFX model: ElevenLabs SFX v2, but it is disallowed by the user requirement because the user asked for Gemini only.
- Lyria 3 Clip dry-run cost: 2 credits for the fireplace pilot prompt.
- ElevenLabs SFX 15s dry-run cost: 60 credits, not allowed for this task.
- Local QC tools: `afinfo` and `afconvert` are available; `ffmpeg` is not installed.
- Emulator state: iOS Simulator is available and one iPhone simulator is booted; Android AVD `codex_pixel_7_api36` exists and was booted successfully as `emulator-5554` for this pass.

## Generation Attempts - 2026-06-19

- `lyria-3-pro` preflight: params valid, quoted 3 credits. Generate attempt returned 402 `Not enough available credits`; no candidate URL was produced.
- `lyria-3-clip` preflight: params valid, quoted 2 credits. Generate attempts returned 402 `Not enough available credits`; no candidate URL was produced. A fresh 2026-06-19 retry after tool discovery produced the same 402 response.
- Current credit evidence: `output/audio-qc/hyperfocus-generation-credits-current.json` records creditBalance=1, pilotCreditCost=2, sufficientForPilot=false, next reset `2026-06-26T16:19:03.909Z`. Current generation authorization evidence includes `promptPolicy` as PASS, blocks pilot on `generation-credits-insufficient`, and blocks full on `generation-credits-insufficient` plus `pilot-gate-not-accepted`. Current generation decision evidence `output/audio-qc/hyperfocus-generation-decision-current.json` records `nextAction=wait-for-credits`, `shouldGenerate=false`, and `phase=pilot`; do not call `picsart_generate` while this report says `shouldGenerate:false`. Current source coverage evidence `output/audio-qc/hyperfocus-source-coverage-current.json` passes with 6 original V1 focus sounds mapped to 18 planned generated levels. Current prompt-policy evidence `output/audio-qc/hyperfocus-prompt-policy-current.json` passes with 18/18 prompts checked for Gemini-only, 30-second seamless non-musical loop, no voice/melody/beat, foreground/safety exclusions, and rejectIf coverage.
- Result: no new quarantine file exists for this pass, no accepted pilot candidate exists, no public Hyperfocus generated asset was promoted, and the manifest remains empty by design. `node scripts/check-hyperfocus-audio-assets.cjs --write-pilot-gate-report output/audio-qc/hyperfocus-pilot-gate-current.json --skip-audio-probe` writes the pilot gate artifact; it and readiness both record `pilot-gate-not-accepted` until `fireplace:soft` has a QC-passing accepted candidate plus approved audible review.

## Platform Verification - 2026-06-19

- Desktop contract: `npm run check:desktop-exe-contract` passed 112 checks. `npx tauri info` detects Tauri 2.11.2, Rust/Cargo, Xcode, and the configured frontend dist/CSP. A macOS Tauri app bundle exists at `src-tauri/target/release/bundle/macos/ZenFlow.app`; its runtime binary stores frontend asset paths, so the package report now checks `src-tauri/target/release/bundle/macos/ZenFlow.app/Contents/MacOS/zenflow-desktop#embedded/sounds/hyperfocus/*.mp3` for generated audio index entries. Windows EXE readiness remains platform-blocked on this Mac because `node scripts/check-desktop-toolchain.cjs` fails on missing `link.exe`/MSVC. No packaged `.exe`, `.msi`, or `.dmg` desktop installer artifact was found in the repo output search.
- iOS native: `xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug -sdk iphonesimulator -destination 'platform=iOS Simulator,id=BEB47D4E-0AB5-4F87-B0BC-D75765A47CE0' -derivedDataPath output/xcodebuild-hyperfocus-ios CODE_SIGNING_ALLOWED=NO build` succeeded and produced `output/xcodebuild-hyperfocus-ios/Build/Products/Debug-iphonesimulator/App.app`. The app was installed and launched in the booted iPhone 17 simulator as `com.zenflow.app`; screenshot: `output/ios-simulator-hyperfocus/app-launch.png`.
- iOS audio bundle: the built simulator `.app` contains the current 9 bundled MP3 files, including `measured-breath.mp3` and `polished-stone-and-paper.mp3`, but not `public/sounds/hyperfocus/*.mp3`. `npx playwright test e2e/ios-diary-v2.spec.ts --config=e2e/helpers/ios-diary/playwright.config.ts -g "serves the iOS diary ambience audio from the native bundle"` passed 1/1.
- Android native: `emulator -list-avds` returned `codex_pixel_7_api36`; it booted successfully as `emulator-5554` with `boot_completed=1`. `npm run cap:sync` succeeded, `./gradlew assembleDebug` succeeded, `adb install -r android/app/build/outputs/apk/debug/app-debug.apk` succeeded, and `adb shell am start -n com.zenflow.app/.MainActivity` launched process `3666`. Screenshots: `output/android-emulator-hyperfocus/app-launch.png` and `output/android-emulator-hyperfocus/app-after-20s.png`. Generated-pack Android playback remains UNVERIFIED because no `public/sounds/hyperfocus/*.mp3` assets exist.

## Generation Gate

This project must not generate the full 18-file pack until one pilot proves the model can produce non-musical ambience.

Allowed pilot model now: `lyria-3-clip`, only because it is Google/Lyria/Gemini-family audio. The pilot-only queue is `output/audio-qc/hyperfocus-lyria-3-clip-pilot-generation-queue.json` and contains only `fireplace:soft`; the pilot URL and promotion templates are `output/audio-qc/hyperfocus-pilot-candidate-url-intake-template.json` and `output/audio-qc/hyperfocus-gemini-pilot-batch-template.json`. The full queue and full templates are marked `phase=full-pack-after-pilot` with `requiresAcceptedPilot=true`.

Stop conditions for the pilot:

- Contains vocals, lyrics, spoken words, clear melody, beat, song structure, or instrument lead.
- Does not loop cleanly enough for a focus timer.
- Produces a soundtrack rather than an environmental soundscape.
- Cannot be exported as a local audio file suitable for `public/sounds/hyperfocus`.

If any stop condition is true, do not use ElevenLabs or another SFX provider. Wait for a Gemini soundscape/SFX-capable model or explicit user approval to relax the provider rule.

## Target Sound Families And Levels

| Family | Current role | Level 1 | Level 2 | Level 3 |
| --- | --- | --- | --- | --- |
| fireplace | warm masking | Embers | Hearth | Bonfire |
| underwater | cocoon hum | Shallow Drift | Deep Current | Abyss Focus |
| thunderstorm | rain masking | Distant Rain | Steady Storm | Monsoon Wall |
| ocean | breathing rhythm | Shoreline | Rock Pools | Heavy Surf |
| river | organic flow | Brook | Forest River | Whitewater |
| cafe | social masking | Quiet Corner | Work Cafe | Busy Rush |

Exact prompts, file names, reject criteria, and asset budgets are in `docs/audio/hyperfocus-three-level-generation-spec.json`.

---

### Task 1: Validate Generation Spec

**Files:**
- Read: `docs/audio/hyperfocus-three-level-generation-spec.json`
- Output only: terminal evidence

- [x] **Step 1: Run the spec validation command**

```bash
node - <<'VALIDATE_SPEC'
const fs = require('fs');
const spec = JSON.parse(fs.readFileSync('docs/audio/hyperfocus-three-level-generation-spec.json', 'utf8'));
if (spec.modelPolicy.requiredProvider !== 'Google Gemini family only') throw new Error('Provider policy drift');
if (spec.families.length !== 6) throw new Error('Expected 6 families');
for (const family of spec.families) {
  if (family.levels.length !== 3) throw new Error(family.id + ' does not have 3 levels');
  for (const level of family.levels) {
    if (!level.fileName.startsWith('hyperfocus-' + family.id + '-')) throw new Error('Bad file name: ' + level.fileName);
    if (!level.prompt.includes('30-second seamless')) throw new Error('Prompt missing duration/loop requirement: ' + level.fileName);
    if (!Array.isArray(level.rejectIf) || level.rejectIf.length < 3) throw new Error('Weak reject criteria: ' + level.fileName);
  }
}
console.log('PASS hyperfocus generation spec: ' + spec.families.length + ' families, 18 variants');
VALIDATE_SPEC
```

Expected: `PASS hyperfocus generation spec: 6 families, 18 variants`.

### Task 2: Gemini/Lyria Pilot

**Files:**
- Read: `docs/audio/hyperfocus-three-level-generation-spec.json`
- Generate only after confirming the pilot gate: one file, target name `public/sounds/hyperfocus/hyperfocus-fireplace-soft.mp3`

- [x] **Step 1: Validate model params without spending credits**

Use `picsart_validate_params` for model `lyria-3-clip` with the fireplace soft prompt from the spec.

Expected: valid params.

- [x] **Step 2: Quote cost**

Use `picsart_pricing` for model `lyria-3-clip` with the same prompt.

Expected from current evidence: 2 credits.

- [x] **Step 3: Generate one pilot only**

Use `picsart_generate` with model `lyria-3-clip` and the exact `fireplace.soft.prompt` value.

Expected: one audio asset URL.

- [x] **Step 4: Download to a quarantine path**

Save the result to `output/audio-quarantine/hyperfocus-fireplace-soft-raw.mp3`.

Expected: local file exists and is non-empty.

- [x] **Step 5: Reject or accept the pilot**

Run `afinfo output/audio-quarantine/hyperfocus-fireplace-soft-raw.mp3`.

Accept only if all are true:

- MP3 or convertible by `afconvert`.
- Around 30 seconds or otherwise loopable without fatigue.
- No vocals, melody, beat, or song structure after listening.
- No emergency fire cues, sirens, or harsh transient spikes.

If rejected, stop generation and keep the goal active with evidence.

### Task 3: Audio Catalog Contract

**Files:**
- Create: `src/lib/hyperfocusAudioCatalog.ts`
- Create: `src/lib/__tests__/hyperfocusAudioCatalog.test.ts`
- Modify: `src/lib/ambientSounds.ts`

- [x] **Step 1: Write failing catalog test**

Create `src/lib/__tests__/hyperfocusAudioCatalog.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { HYPERFOCUS_AUDIO_FAMILIES, getHyperfocusVariantId, parseHyperfocusVariantId } from '../hyperfocusAudioCatalog';

describe('hyperfocus three-level audio catalog', () => {
  it('defines six families with three levels each', () => {
    expect(HYPERFOCUS_AUDIO_FAMILIES).toHaveLength(6);
    for (const family of HYPERFOCUS_AUDIO_FAMILIES) {
      expect(family.levels.map((level) => level.id)).toEqual(['soft', 'deep', 'intense']);
    }
  });

  it('keeps variant ids stable and parseable', () => {
    expect(getHyperfocusVariantId('fireplace', 'soft')).toBe('fireplace:soft');
    expect(parseHyperfocusVariantId('fireplace:soft')).toEqual({ familyId: 'fireplace', levelId: 'soft' });
    expect(parseHyperfocusVariantId('fireplace')).toEqual({ familyId: 'fireplace', levelId: 'deep' });
  });
});
```

Run: `npm test -- src/lib/__tests__/hyperfocusAudioCatalog.test.ts`.

Expected: FAIL because the catalog file does not exist.

- [x] **Step 2: Implement catalog**

Create `src/lib/hyperfocusAudioCatalog.ts` with typed family ids, level ids, labels, legacy ids, and generated file paths. Until all 18 files exist, point missing variants to legacy files only behind an explicit `generated: false` flag; do not present unavailable variants in UI.

- [x] **Step 3: Update ambient sound lookup**

Update `ambientSounds.ts` so `playDirect` can accept legacy ids and future variant ids. Legacy ids must resolve to the deep level until generated files are integrated.

- [x] **Step 4: Verify catalog green**

Run: `npm test -- src/lib/__tests__/hyperfocusAudioCatalog.test.ts src/lib/__tests__/ambientSounds.test.ts`.

Expected: PASS.

### Task 4: Hyperfocus UI With Intensity Levels

**Files:**
- Modify: `src/components/hyperfocus/HyperfocusSoundSelector.tsx`
- Modify: `src/components/hyperfocus/useHyperfocusAudio.ts`
- Modify: `src/components/hyperfocus/__tests__/useHyperfocusAudio.test.tsx`
- Add or modify: component test for `HyperfocusSoundSelector`
- Modify i18n only if visible labels are added outside existing keys

- [x] **Step 1: Write UI contract test**

Test that selecting a family exposes three level buttons with 44px controls and selecting `fireplace:soft` calls `onSoundSelect('fireplace:soft')`.

Expected: FAIL before UI change.

- [x] **Step 2: Implement selector layout**

Use family buttons for the six sound families and a compact segmented control for levels: soft, deep, intense. Do not render unavailable generated variants unless their files exist and catalog marks `generated: true`.

- [x] **Step 3: Preserve existing behavior**

Existing selected ids like `river` must still work and map to `river:deep` internally. Existing tests for muted audio and generator volume must remain green.

- [x] **Step 4: Verify UI tests**

Run targeted Hyperfocus tests and `npm run typecheck`.



### Task 4A: Strict Generated Asset QC Gate

**Files:**
- Add: `scripts/check-hyperfocus-audio-assets.cjs`
- Add: `scripts/__tests__/check-hyperfocus-audio-assets.test.ts`

- [x] **Step 1: Add red test for expected 18-file pack and objective QC metrics**
- [x] **Step 2: Implement CLI that derives the pack from the spec**
- [x] **Step 3: Check missing files, MP3 naming, duration, channel/sample rate, size, RMS, peak, clipping, start/end fade, and loop seam**
- [x] **Step 4: Verify the CLI fails current state with 18 missing generated assets**
- [x] **Step 5: Add QC-gated promotion helper for moving accepted candidates into public assets**
- [x] **Step 6: Add generated-audio manifest writer and catalog integration**
- [x] **Step 7: Expose QC-gated candidate promotion through the CLI**
- [x] **Step 8: Require Google/Gemini-family provenance before generated manifest integration**
- [x] **Step 9: Refuse generated manifest entries when provenance publicSha256 is missing or stale**
- [x] **Step 10: Add all-or-nothing batch promotion for a complete 18-file Gemini candidate pack**
- [x] **Step 11: Generate a deterministic 18-entry batch promotion template from the spec**
- [x] **Step 12: Add a unified readiness report that summarizes generated-pack blockers**
- [x] **Step 13: Include audible-review template completeness in readiness reporting**
- [x] **Step 14: Include accepted generated candidate files in readiness reporting before promotion**
- [x] **Step 15: Record generation credit evidence in readiness reporting**
- [x] **Step 16: Add all-or-nothing candidate URL intake before batch promotion**
- [x] **Step 17: Include candidate URL intake template readiness coverage**
- [x] **Step 18: Reject Gemini TTS models for ambience generation and provenance**
- [x] **Step 19: Probe accepted candidate files in readiness before promotion**
- [x] **Step 20: Write a focused accepted-candidate QC report before promotion**
- [x] **Step 21: Add explicit pilot-only URL intake and promotion-batch templates**
- [x] **Step 22: Allow explicit pilot-only URL download/promotion validation without weakening default full-pack validation**
- [x] **Step 23: Include pilot-only queue/template checks in unified readiness reporting**
- [x] **Step 24: Block full-pack URL download and batch promotion until the pilot gate is accepted**
- [x] **Step 25: Reject non-Google or Gemini TTS candidate URL intake before download**
- [x] **Step 26: Reject missing or placeholder generation ids before candidate URL download**
- [x] **Step 27: Add phase-specific generation authorization reports before spending credits**
- [x] **Step 28: Add original V1 focus source coverage reporting**
- [x] **Step 29: Add Gemini prompt-policy reporting before generation handoff**
- [x] **Step 30: Block generation authorization when prompt policy is invalid**
- [x] **Step 31: Block generation queue export when prompt policy is invalid**
- [x] **Step 32: Bind audible reviews to prompt hashes**
- [x] **Step 33: Add raw quarantine candidate audit reporting**
- [x] **Step 34: Add objective completion-audit reporting**

Candidate URL intake note: `node scripts/check-hyperfocus-audio-assets.cjs --write-candidate-url-intake-template output/audio-qc/hyperfocus-pilot-candidate-url-intake-template.json --model lyria-3-clip --phase pilot` writes the 1-entry pilot URL template for `fireplace:soft`. Fill that URL first and run `node scripts/check-hyperfocus-audio-assets.cjs --download-candidate-urls <filled-pilot-template.json>`; explicit `phase=pilot` validates exactly the one pilot file. The audible review templates include `promptSha256`, and promotion/pilot gate validation rejects stale reviews after prompt changes. The full command `node scripts/check-hyperfocus-audio-assets.cjs --write-candidate-url-intake-template output/audio-qc/hyperfocus-candidate-url-intake-template.json --model lyria-3-clip` writes the 18-entry URL template after pilot acceptance; full-pack URL download and batch promotion reject with `pilot-gate-not-accepted` until `output/audio-quarantine/hyperfocus-fireplace-soft-accepted.mp3` passes objective QC and its audible review is approved. Default/no-phase batches still validate exactly the expected 18 file names, require provider `Google` plus a Gemini/Lyria-family non-TTS audio model, require a real non-placeholder `generationId`, reject non-http(s) URLs, download into a staging directory first, and only then write `output/audio-quarantine/*-accepted.mp3`; invalid batches write no accepted partial files. `--print-generation-queue` also requires prompt-policy PASS before it prints prompts for external handoff. Before any external generation call, write `output/audio-qc/hyperfocus-generation-authorization-pilot-current.json` for the pilot phase or `output/audio-qc/hyperfocus-generation-authorization-full-current.json` for the full phase; these reports derive queue size, prompt-policy status, required credits, and the full-pack pilot gate so operators do not spend credits out of sequence. `output/audio-qc/hyperfocus-source-coverage-current.json` proves the original V1 focus MP3 registry, generation spec `currentFile`, and three-level plan are aligned before generation. `output/audio-qc/hyperfocus-prompt-policy-current.json` proves all 18 prompts satisfy the Gemini-only non-musical ambience prompt policy before any prompt is sent out.

Manifest note: `node scripts/check-hyperfocus-audio-assets.cjs --write-manifest` writes `src/lib/hyperfocusGeneratedAudioManifest.ts` from QC-passed public assets only when matching Google/Gemini-family provenance exists in `docs/audio/hyperfocus-generated-audio-provenance.json` and the ledger `publicSha256` matches the current promoted public file. Current expected output is 0 generated entries until final MP3 files exist, pass QC, and have matching provenance.

Current command:

```bash
node scripts/check-hyperfocus-audio-assets.cjs --skip-audio-probe
```

Current expected result until final assets exist: FAIL with 18 `missing-file` issues for `public/sounds/hyperfocus/*.mp3`.

Raw quarantine candidate audit for existing Gemini/Lyria pilots:

```bash
node scripts/check-hyperfocus-audio-assets.cjs \
  --write-raw-candidate-report output/audio-qc/hyperfocus-raw-candidates-current.json
```

Current expected result until a new pilot passes: FAIL with 2 rejected `fireplace:soft` raw candidates in quarantine and no accepted candidate copy. This report does not promote or copy files.

Unified readiness report for operator handoff:

```bash
node scripts/check-hyperfocus-audio-assets.cjs \
  --write-readiness-report output/audio-qc/hyperfocus-readiness-current.json \
  --model lyria-3-clip \
  --skip-audio-probe
```

Current expected result until final assets exist: FAIL with blockers for insufficient pilot credits, `pilot-gate-not-accepted`, missing accepted candidates, missing public assets, missing package targets, and incomplete generated manifest. The report also records `promptPolicy` as PASS, plus pilotGenerationQueue, pilotBatchTemplate, pilotCandidateUrlIntakeTemplate, and rawQuarantineCandidates evidence. Current rawQuarantineCandidates shows 2 rejected Lyria pilot files, 0 needs-review files, and 7 objective issue codes; this is non-blocking evidence because accepted/public asset gates remain authoritative.

Objective completion audit for the full user request:

```bash
node scripts/check-hyperfocus-audio-assets.cjs \
  --write-completion-audit-report output/audio-qc/hyperfocus-completion-audit-current.json \
  --model lyria-3-clip \
  --skip-audio-probe
```

Current expected result until final assets exist: FAIL with 12 objective requirements, currently 6 pass, 2 blocked (`generation-credits`, `accepted-pilot-gate`), and 4 pending (`accepted-candidates`, `generated-public-assets`, `native-generated-packaging`, `desktop-generated-packaging`). This is the top-level gate before claiming the goal complete.

Task 4 implementation note: the UI now renders three localized level buttons for the selected family and normalizes legacy family ids to the deep variant. Because no Gemini/Lyria pilot has passed QC, these choices are runtime-compatible placeholders that still resolve through the legacy ambient files. Final completion still requires accepted per-level audio files.

### Task 4B: Deterministic Gemini Generation Queue

**Files:**
- Modify: `scripts/check-hyperfocus-audio-assets.cjs`
- Modify: `scripts/__tests__/check-hyperfocus-audio-assets.test.ts`

- [x] **Step 1: Add red tests for queue export**

The queue must derive all 18 jobs from `docs/audio/hyperfocus-three-level-generation-spec.json`, preserve exact prompts/reject criteria, use provider `Google`, accept only Gemini-family model names such as `lyria-3-clip`, and include the QC promotion command for each target file.

- [x] **Step 2: Implement CLI handoff**

Current command:

```bash
node scripts/check-hyperfocus-audio-assets.cjs --print-generation-queue --model lyria-3-clip
```

Expected: JSON with 18 jobs, first `fireplace:soft`, last `cafe:intense`. This command does not generate audio, spend credits, copy files, or write manifest entries. It is a strict handoff artifact for the Gemini generation pass.

Durable queue writer commands:

```bash
node scripts/check-hyperfocus-audio-assets.cjs \
  --write-generation-queue output/audio-qc/hyperfocus-lyria-3-clip-pilot-generation-queue.json \
  --model lyria-3-clip \
  --phase pilot

node scripts/check-hyperfocus-audio-assets.cjs \
  --write-generation-queue output/audio-qc/hyperfocus-lyria-3-clip-generation-queue.json \
  --model lyria-3-clip \
  --phase full
```

Current result: pilot queue PASS with 1 `fireplace:soft` job; full queue PASS with 18 jobs and `requiresAcceptedPilot=true`. These writer commands do not generate audio, spend credits, copy files, or write manifest entries.

- [x] **Step 3: Block non-Gemini queue models**

`node scripts/check-hyperfocus-audio-assets.cjs --print-generation-queue --model elevenlabs-sfx` must fail with `non-gemini-family-model`.

### Task 4C: Durable QC Report Writer

**Files:**
- Modify: `scripts/check-hyperfocus-audio-assets.cjs`
- Modify: `scripts/__tests__/check-hyperfocus-audio-assets.test.ts`
- Output: `output/audio-qc/hyperfocus-current.json`

- [x] **Step 1: Add red tests for JSON QC evidence**

The report must derive all 18 expected assets from the spec, record missing assets without treating them as pass, and record SHA-256, byte size, duration/sample-rate/channel/loudness/loop metrics for files that exist and pass probing.

- [x] **Step 2: Implement report CLI**

Current command:

```bash
node scripts/check-hyperfocus-audio-assets.cjs --write-qc-report output/audio-qc/hyperfocus-current.json --skip-audio-probe
```

Current expected result until final assets exist: FAIL exit with a written JSON report showing `expectedCount: 18`, `passedCount: 0`, `missingCount: 18`. This is evidence, not completion.

### Task 4D: Cross-Target Package Report

**Files:**
- Modify: `scripts/check-hyperfocus-audio-assets.cjs`
- Modify: `scripts/__tests__/check-hyperfocus-audio-assets.test.ts`
- Output: `output/audio-qc/hyperfocus-package-current.json`

- [x] **Step 1: Add red tests for generated audio packaging evidence**

The report must derive all 18 expected assets from the spec and check each runtime package target independently: source public assets, Vite web/PWA dist, iOS Capacitor bundle, iOS simulator App.app artifact contents, Android Capacitor assets, Android debug APK artifact contents, Desktop/Tauri dist, and the macOS Tauri App.app embedded asset index.

- [x] **Step 2: Implement package report CLI**

Current command:

```bash
node scripts/check-hyperfocus-audio-assets.cjs --write-package-report output/audio-qc/hyperfocus-package-current.json
```

Current expected result until final assets exist: FAIL exit with a written JSON report showing `expectedCount: 18`, `targetCount: 8`, and 144 `missing-packaged-file` issues. This proves desktop/web/native packaging is not being claimed complete before the generated MP3 files exist.

### Task 4E: Provider Capability Evidence

**Files:**
- Modify: `scripts/check-hyperfocus-audio-assets.cjs`
- Modify: `scripts/__tests__/check-hyperfocus-audio-assets.test.ts`
- Output: `output/audio-qc/picsart-google-audio-models-current.json`
- Output: `output/audio-qc/hyperfocus-provider-capability-current.json`

- [x] **Step 1: Add red tests for provider inventory classification**

The report must classify current Google audio models without generating or spending credits: Gemini TTS models are disallowed for ambience, Lyria music models are pilot candidates only with strict QC, and no SFX/soundscape model is currently exposed.

- [x] **Step 2: Implement provider capability report CLI**

Current command:

```bash
node scripts/check-hyperfocus-audio-assets.cjs \
  --write-provider-capability-report output/audio-qc/hyperfocus-provider-capability-current.json \
  --model-inventory output/audio-qc/picsart-google-audio-models-current.json \
  --generated-at 2026-06-19T16:19:03.909Z
```

Current result: PASS with 4 Google audio models, 2 TTS disallowed, 2 Lyria music pilot candidates, 0 SFX/soundscape models, and recommendation `pilot-only-with-strict-qc`. Readiness and completion audit include this as non-blocking evidence; generation remains blocked by credits and accepted-pilot gates.

### Task 4F: Explicit Generation Decision Gate

**Files:**
- Modify: `scripts/check-hyperfocus-audio-assets.cjs`
- Modify: `scripts/__tests__/check-hyperfocus-audio-assets.test.ts`
- Output: `output/audio-qc/hyperfocus-generation-decision-current.json`

- [x] **Step 1: Add red tests for the generation decision gate**

The gate must combine provider capability, credit evidence, generation authorization, readiness, and pilot/full phase state into one machine-readable decision. It must explicitly block generation when credits are insufficient.

- [x] **Step 2: Implement the decision report CLI**

Current command:

```bash
node scripts/check-hyperfocus-audio-assets.cjs \
  --write-generation-decision-report output/audio-qc/hyperfocus-generation-decision-current.json \
  --model lyria-3-clip \
  --skip-audio-probe
```

Current result: WAIT with `nextAction=wait-for-credits`, `shouldGenerate=false`, `phase=pilot`, and blocker `generation-credits-insufficient`. This report is the last local gate before any future `picsart_generate` call.

### Task 5: Asset Integration After Gemini Pilot Passes

**Files:**
- Add: `public/sounds/hyperfocus/*.mp3`
- Modify: `src/lib/appAudioAssets.ts`
- Modify: `src/lib/hyperfocusAudioCatalog.ts`
- Modify tests around asset existence

- [ ] **Step 1: Copy accepted pilot into public assets**

Promote only through the QC gate after a candidate is generated and manually/audibly approved. The gate also rejects any candidate that is byte-identical to one of the original `currentFile` Hyperfocus sources, and any Gemini-family candidate without a structured audible-review JSON confirming no vocals/speech/melody/beat, clean audible looping, no foreground distractions, no safety-alarm cues, and family/level match:

```bash
node scripts/check-hyperfocus-audio-assets.cjs \
  --promote output/audio-quarantine/hyperfocus-fireplace-soft-accepted.mp3 \
  --file-name hyperfocus-fireplace-soft.mp3 \
  --model lyria-3-clip \
  --generation-id <picsart-generation-id> \
  --source picsart \
  --approved-by operator-qc \
  --audible-review output/audio-qc/reviews/hyperfocus-fireplace-soft-audible-review.json \
  --write-manifest
```

Expected: the candidate passes objective metrics, does not exactly match a legacy source file, includes passing structured audible review, is copied into `public/sounds/hyperfocus/`, provenance is written to `docs/audio/hyperfocus-generated-audio-provenance.json`, and `src/lib/hyperfocusGeneratedAudioManifest.ts` is refreshed.

Generate false-by-default audible review templates before listening review:

```bash
node scripts/check-hyperfocus-audio-assets.cjs --write-audible-review-templates output/audio-qc/reviews
```

Generate the final-pack batch JSON scaffold from the same spec before filling generation ids:

```bash
node scripts/check-hyperfocus-audio-assets.cjs \
  --write-promotion-batch-template output/audio-qc/hyperfocus-gemini-batch-template.json \
  --model lyria-3-clip
```

For the final 18-file candidate pack, prefer the all-or-nothing batch promotion command over 18 manual promotions. The batch JSON must contain exactly the 18 expected spec file names, candidate paths, Google/Lyria model metadata, generation ids, and passing audible review payloads or review-file paths:

```bash
node scripts/check-hyperfocus-audio-assets.cjs \
  --promote-batch output/audio-qc/hyperfocus-gemini-batch.json \
  --write-manifest
```

Expected: the command preflights every candidate, rejects the entire pack without copying anything if any entry is missing/invalid, otherwise promotes all 18 files, writes provenance for all variants, and refreshes the generated manifest.

Audible review JSON shape for every accepted variant:

```json
{
  "variantId": "fireplace:soft",
  "reviewer": "operator-qc",
  "reviewedAt": "2026-06-19T00:00:00.000Z",
  "noVocals": true,
  "noSpeech": true,
  "noMelody": true,
  "noBeat": true,
  "noForegroundDistractions": true,
  "noSafetyAlarmCues": true,
  "loopAudiblyClean": true,
  "matchesPromptFamily": true,
  "matchesIntensityLevel": true,
  "notes": "Audible review passed for non-musical seamless ambience."
}
```

- [ ] **Step 2: Register the accepted variant**

Mark `fireplace:soft` as `generated: true` and point it to `sounds/hyperfocus/hyperfocus-fireplace-soft.mp3`.

- [ ] **Step 3: Add asset contract test**

Assert every `generated: true` variant exists in `public/`, has `.mp3`, and is not larger than `900000` bytes unless an explicit exception is recorded in the catalog.

- [ ] **Step 4: Repeat only after pilot quality passes**

Generate the other 17 variants one by one, never in a blind batch. Each file needs the same QC evidence.

### Task 6: Quality Control And Packaging

**Files:**
- Output: `output/audio-qc/*.json`
- Build outputs: `dist/sounds/hyperfocus/*.mp3`, Android/iOS copied web assets

- [ ] **Step 1: Static file check**

Run a Node check that records file size, duration from `afinfo`, and SHA-256 for every generated file.

Tooling status: implemented through `node scripts/check-hyperfocus-audio-assets.cjs --write-qc-report output/audio-qc/hyperfocus-current.json`. Current report is intentionally incomplete because the generated files do not exist yet. Package placement evidence is also implemented through `node scripts/check-hyperfocus-audio-assets.cjs --write-package-report output/audio-qc/hyperfocus-package-current.json`; current package report fails with 144 missing entries across source, web, iOS asset directory, iOS simulator App.app, Android asset directory, Android debug APK, Desktop/Tauri dist, and macOS Tauri App.app embedded-index targets.

Expected for final completion: all generated files have duration evidence, SHA-256, and size within budget.

- [ ] **Step 2: Web/PWA build**

Run: `npm run build`.

Expected: PASS, and generated files exist under `dist/sounds/hyperfocus`. Fresh `npm run build` passed on 2026-06-19, but current package-report targets `web-dist` and `desktop-tauri-dist` both still show 18 missing files because the accepted pack has not been generated and copied.

- [ ] **Step 3: Android packaging check**

Run Capacitor sync/build command used by the repo, then verify generated files under `android/app/src/main/assets/public/sounds/hyperfocus`.

Expected: files copied. Fresh `npm run cap:sync`, Android emulator boot, `./gradlew assembleDebug`, install, and launch passed on 2026-06-19. The package report now also inspects `android/app/build/outputs/apk/debug/app-debug.apk!/assets/public/sounds/hyperfocus/*.mp3`. Current package-report targets `android-capacitor` and `android-debug-apk` still show 18 missing files each because the generated pack is not present in source assets or the built APK.

- [ ] **Step 4: iOS simulator smoke**

Use the booted iPhone simulator. Launch the app, open Hyperfocus, choose a generated family/level, verify no crash and no console playback blocker. Record screenshots or logs.

Expected: audio can be selected; if physical speaker output cannot be captured, mark audible playback as `UNVERIFIED` and keep DOM/native state proof. Current package-report targets `ios-capacitor` and `ios-simulator-app` show 18 missing files each because the generated pack is not present in source assets or the built simulator `.app`.

- [ ] **Step 5: Desktop/Tauri packaging check**

Verify generated MP3s are referenced in built Vite output and available to Tauri runtime.

Expected: Desktop route loads and Hyperfocus selector still works. Fresh `npm run build` and `npm run check:desktop-exe-contract` passed on 2026-06-19. Current package-report targets `desktop-tauri-dist` and `desktop-tauri-macos-app` each show 18 missing files/index entries because the generated pack is not present or rebuilt into the Tauri app. Windows EXE/MSI build remains platform-blocked on this Mac by missing `link.exe`/MSVC.

---

## Self-Review

- Spec coverage: covers Gemini-only requirement, six existing Hyperfocus sounds, three levels per sound, strict generation gates, emulator checks, packaging, and fallback rules.
- Stub scan: no unresolved stub markers are used.
- Type consistency: family ids, level ids, and variant id format are consistent across spec, tests, catalog, UI, and asset paths.
