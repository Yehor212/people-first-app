# Hyperfocus Three-Level Audio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the six current Hyperfocus ambience options with a controlled three-level audio system per sound family, using only Google Gemini-family generation when generation is allowed.

**Architecture:** Keep Hyperfocus ambience as local bundled MP3 files started by user gesture. Add a typed catalog for sound families and intensity levels, generate or import 18 final assets only after a Gemini/Lyria pilot passes quality gates, then update the selector from a flat 6-button grid to family selection plus intensity selection while preserving backward compatibility for existing saved sound ids.

**Tech Stack:** React 18, TypeScript, Vite public assets, Capacitor, iOS Simulator, Android adb/AVD, Tauri, Vitest, Testing Library, macOS afinfo/afconvert, Node validation scripts.

---

## Current Findings

- Current Hyperfocus families in production: underwater, thunderstorm, ocean, river, cafe, fireplace.
- Current files are listed in `src/lib/ambientSounds.ts` and registered through `src/lib/appAudioAssets.ts`.
- Generated spec is saved at `docs/audio/hyperfocus-three-level-generation-spec.json`.
- Available Google audio models in this environment: Gemini TTS and Google Lyria music.
- Available SFX model: ElevenLabs SFX v2, but it is disallowed by the user requirement because the user asked for Gemini only.
- Lyria 3 Clip dry-run cost: 2 credits for the fireplace pilot prompt.
- ElevenLabs SFX 15s dry-run cost: 60 credits, not allowed for this task.
- Local QC tools: `afinfo` and `afconvert` are available; `ffmpeg` is not installed.
- Emulator state: iOS Simulator is available and one iPhone simulator is booted; Android SDK adb exists but no Android device is currently attached.

## Generation Gate

This project must not generate the full 18-file pack until one pilot proves the model can produce non-musical ambience.

Allowed pilot model now: `lyria-3-clip`, only because it is Google/Lyria/Gemini-family audio.

Stop conditions for the pilot:

- Contains vocals, lyrics, spoken words, clear melody, beat, song structure, or instrument lead.
- Does not loop cleanly enough for a focus timer.
- Produces a soundtrack rather than an environmental soundscape.
- Cannot be exported as a local audio file suitable for `public/sounds/hyperfocus`.

If any stop condition is true, do not use ElevenLabs or another SFX provider. Wait for a Gemini soundscape/SFX-capable model or explicit user approval to relax the provider rule.

## Target Sound Families And Levels

| Family | Current role | Level 1 | Level 2 | Level 3 |
| --- | --- | --- | --- | --- |
| fireplace | warm indoor hearth masking | Embers | Hearth | Full Hearth |
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

- [ ] **Step 1: Run the spec validation command**

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

- [ ] **Step 1: Validate model params without spending credits**

Use `picsart_validate_params` for model `lyria-3-clip` with the fireplace soft prompt from the spec.

Expected: valid params.

- [ ] **Step 2: Quote cost**

Use `picsart_pricing` for model `lyria-3-clip` with the same prompt.

Expected from current evidence: 2 credits.

- [ ] **Step 3: Generate one pilot only**

Use `picsart_generate` with model `lyria-3-clip` and the exact `fireplace.soft.prompt` value.

Expected: one audio asset URL.

- [ ] **Step 4: Download to a quarantine path**

Save the result to `output/audio-quarantine/hyperfocus-fireplace-soft-raw.mp3`.

Expected: local file exists and is non-empty.

- [ ] **Step 5: Reject or accept the pilot**

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

- [ ] **Step 1: Write failing catalog test**

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

- [ ] **Step 2: Implement catalog**

Create `src/lib/hyperfocusAudioCatalog.ts` with typed family ids, level ids, labels, legacy ids, and generated file paths. Until all 18 files exist, point missing variants to legacy files only behind an explicit `generated: false` flag; do not present unavailable variants in UI.

- [ ] **Step 3: Update ambient sound lookup**

Update `ambientSounds.ts` so `playDirect` can accept legacy ids and future variant ids. Legacy ids must resolve to the deep level until generated files are integrated.

- [ ] **Step 4: Verify catalog green**

Run: `npm test -- src/lib/__tests__/hyperfocusAudioCatalog.test.ts src/lib/__tests__/ambientSounds.test.ts`.

Expected: PASS.

### Task 4: Hyperfocus UI With Intensity Levels

**Files:**
- Modify: `src/components/hyperfocus/HyperfocusSoundSelector.tsx`
- Modify: `src/components/hyperfocus/useHyperfocusAudio.ts`
- Modify: `src/components/hyperfocus/__tests__/useHyperfocusAudio.test.tsx`
- Add or modify: component test for `HyperfocusSoundSelector`
- Modify i18n only if visible labels are added outside existing keys

- [ ] **Step 1: Write UI contract test**

Test that selecting a family exposes three level buttons with 44px controls and selecting `fireplace:soft` calls `onSoundSelect('fireplace:soft')`.

Expected: FAIL before UI change.

- [ ] **Step 2: Implement selector layout**

Use family buttons for the six sound families and a compact segmented control for levels: soft, deep, intense. Do not render unavailable generated variants unless their files exist and catalog marks `generated: true`.

- [ ] **Step 3: Preserve existing behavior**

Existing selected ids like `river` must still work and map to `river:deep` internally. Existing tests for muted audio and generator volume must remain green.

- [ ] **Step 4: Verify UI tests**

Run targeted Hyperfocus tests and `npm run typecheck`.

### Task 5: Asset Integration After Gemini Pilot Passes

**Files:**
- Add: `public/sounds/hyperfocus/*.mp3`
- Modify: `src/lib/appAudioAssets.ts`
- Modify: `src/lib/hyperfocusAudioCatalog.ts`
- Modify tests around asset existence

- [ ] **Step 1: Copy accepted pilot into public assets**

Copy only after QC passes:

```bash
mkdir -p public/sounds/hyperfocus
cp output/audio-quarantine/hyperfocus-fireplace-soft-accepted.mp3 public/sounds/hyperfocus/hyperfocus-fireplace-soft.mp3
```

Expected: file exists, non-zero bytes.

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

Expected: all generated files have duration evidence and size within budget.

- [ ] **Step 2: Web/PWA build**

Run: `npm run build`.

Expected: PASS, and generated files exist under `dist/sounds/hyperfocus`.

- [ ] **Step 3: Android packaging check**

Run Capacitor sync/build command used by the repo, then verify generated files under `android/app/src/main/assets/public/sounds/hyperfocus`.

Expected: files copied. If no AVD is running, record Android runtime smoke as `UNVERIFIED` with exact `adb devices` output.

- [ ] **Step 4: iOS simulator smoke**

Use the booted iPhone simulator. Launch the app, open Hyperfocus, choose a generated family/level, verify no crash and no console playback blocker. Record screenshots or logs.

Expected: audio can be selected; if physical speaker output cannot be captured, mark audible playback as `UNVERIFIED` and keep DOM/native state proof.

- [ ] **Step 5: Desktop/Tauri packaging check**

Verify generated MP3s are referenced in built Vite output and available to Tauri runtime.

Expected: Desktop route loads and Hyperfocus selector still works.

---

## Self-Review

- Spec coverage: covers Gemini-only requirement, six existing Hyperfocus sounds, three levels per sound, strict generation gates, emulator checks, packaging, and fallback rules.
- Stub scan: no unresolved stub markers are used.
- Type consistency: family ids, level ids, and variant id format are consistent across spec, tests, catalog, UI, and asset paths.
