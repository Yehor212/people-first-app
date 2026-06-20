# Hyperfocus Nature Soundscape Recovery Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recover the Hyperfocus audio project from music-like outputs by enforcing nature/environmental field-recording soundscapes, then generate and verify 18 focus-safe variants only after the pilot passes.

**Architecture:** The app can expose six V1 sound families with three intensity levels now, but generated variants remain gated until accepted MP3 files exist. Generation is driven by `docs/audio/hyperfocus-nature-soundscape-spec.json` and blocked by `scripts/check-hyperfocus-nature-soundscape-contract.cjs` if prompts drift toward songs, vocals, melody, beats, instruments, pop, or soundtrack language.

**Tech Stack:** React 18, TypeScript, Vite public assets, Vitest, Testing Library, Node validation scripts, macOS afinfo/afconvert, Picsart Google/Lyria audio when credits allow, Capacitor/Tauri packaging checks.

---

## What Was Wrong

- Lyria is a music-capable model. A loose prompt can produce song-like output instead of concentration ambience.
- The failed direction was not a usable Hyperfocus sound: it behaved like music/pop, not fire, rain, ocean, river, underwater, cafe, or fireplace ambience.
- The previous plan described the risk, but this checkout did not have an enforced spec/script gate for nature-only soundscape prompts.

## Correct Product Direction

- Primary target: nature and environmental concentration loops, not tracks.
- Every generated file must feel like a real recorded place: water, rain, ocean, river, fire, or neutral cafe room tone.
- No musical foreground: no vocals, lyrics, melody, beat, drums, instruments, song structure, intro, chorus, verse, drop, riser, outro, or cinematic score.
- Each family has three functional intensity levels:
  - soft: minimal masking, calm start
  - deep: default balanced masking
  - intense: stronger masking without harsh spikes or drama
- Cafe remains because it is a V1 focus family, but it is treated as human-environment field recording, not nature and not music.

## Required Families And Levels

| Family | Soft | Deep | Intense | Notes |
| --- | --- | --- | --- | --- |
| fireplace | Embers | Hearth | Bonfire | Pilot family; easiest to catch song drift because any melody is wrong |
| underwater | Shallow Drift | Deep Current | Abyss Focus | Pressure cocoon, no machinery or sci-fi tones |
| thunderstorm | Distant Rain | Steady Storm | Monsoon Wall | Rain masking, no jump-scare thunder |
| ocean | Shoreline | Rock Pools | Heavy Surf | Natural wave rhythm, no musical pulse |
| river | Brook | Forest River | Whitewater | Organic flow, no abrupt splashes |
| cafe | Quiet Corner | Work Cafe | Busy Rush | Indistinct room tone, no intelligible speech and no music in cafe |

## Implementation Tasks

### Task 1: Prompt Contract

**Files:**
- `docs/audio/hyperfocus-nature-soundscape-spec.json`
- `scripts/check-hyperfocus-nature-soundscape-contract.cjs`
- `scripts/__tests__/hyperfocus-nature-soundscape-contract.test.ts`

- [x] Add a spec with six families and 18 variants.
- [x] Require field-recording/environmental soundscape wording.
- [x] Require no vocals/lyrics/melody/beat/drums/instruments/song structure in every prompt.
- [x] Reject prompt drift toward artist names, K-pop, pop song, catchy, melodic, upbeat, chorus, verse, drop, soundtrack, or cinematic wording.
- [x] Verify with `npm test -- scripts/__tests__/hyperfocus-nature-soundscape-contract.test.ts`.

### Task 2: One-Pilot Generation Gate

**Files:**
- Output only until accepted: `output/audio-quarantine/**`, `output/audio-qc/**`

- [ ] Wait until credits are enough for one `lyria-3-clip` generation.
- [ ] Generate only `fireplace:soft` first.
- [ ] Download to quarantine, not `public/sounds`.
- [ ] Reject immediately if it sounds like a song, beat, melody, vocals, instruments, score, or pop loop.
- [ ] Run objective checks: duration, format, size, clipping, start/end loudness, loop seam.
- [ ] Only after audible review passes, promote to `public/sounds/hyperfocus/hyperfocus-fireplace-soft.mp3`.

### Task 3: Full Pack Generation

**Files:**
- `public/sounds/hyperfocus/*.mp3`
- `src/lib/hyperfocusGeneratedAudioManifest.ts`
- provenance/QC reports under `docs/audio` and `output/audio-qc`

- [ ] Generate the remaining 17 variants after the accepted pilot.
- [ ] Review each candidate before promotion; never blind-batch promote.
- [ ] Write SHA-256, provider, model, generation id, prompt, duration, and review status for every accepted file.
- [ ] Keep rejected candidates out of app bundles.

### Task 4: App Integration And Verification

**Files:**
- `src/lib/hyperfocusAudioCatalog.ts`
- `src/lib/ambientSounds.ts`
- `src/components/hyperfocus/HyperfocusSoundSelector.tsx`
- Hyperfocus tests

- [x] Keep three-level UI/catalog path available.
- [x] Normalize legacy IDs like `river` to `river:deep`.
- [x] Use legacy natural sounds as fallback while generated variants are missing.
- [ ] After generated assets exist, update manifest and verify every generated variant resolves to its own MP3.
- [ ] Verify Web/PWA build, Android bundle, iOS simulator, and Desktop/Tauri packaging.

## Done Criteria

- [ ] 18 MP3 files exist under `public/sounds/hyperfocus`.
- [ ] All 18 pass objective QC and audible review.
- [ ] No accepted file contains vocals, lyrics, melody, beat, instruments, song structure, pop, or soundtrack behavior.
- [ ] Manifest has all 18 entries with hashes/provenance.
- [ ] Hyperfocus selector can select all 18 variants.
- [ ] Web/PWA, Android, iOS, and Desktop packaging checks prove assets are present.

## UNVERIFIED

- Actual generated audio quality is still UNVERIFIED until credits allow generation.
- Emulator audible playback with the new generated assets is UNVERIFIED because the assets do not exist yet.
- Final packaging with 18 generated MP3s is UNVERIFIED until manifest and assets are present.
